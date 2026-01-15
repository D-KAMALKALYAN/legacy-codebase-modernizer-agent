from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.config import settings
from app.api.endpoints import router
from app.storage.storage_service import storage_service  # ✅ NEW
import logging
import signal
import sys
import asyncio

logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

is_shutting_down = False
active_requests = 0

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler with storage initialization"""
    # ==================== STARTUP ====================
    logger.info("=" * 60)
    logger.info("🚀 Legacy Code Modernization AI Service Starting...")
    logger.info("=" * 60)
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"LLM Provider: {settings.LLM_PROVIDER}")
    
    if settings.LLM_PROVIDER == "ollama":
        logger.info(f"LLM Model: {settings.OLLAMA_MODEL}")
    elif settings.LLM_PROVIDER == "openai":
        logger.info(f"LLM Model: {settings.OPENAI_MODEL}")
    elif settings.LLM_PROVIDER == "anthropic":
        logger.info(f"LLM Model: {settings.ANTHROPIC_MODEL}")
    
    logger.info(f"Storage Backend: {settings.STORAGE_BACKEND.upper()}")  # ✅ NEW
    logger.info(f"Redis Enabled: {settings.REDIS_ENABLED}")
    if settings.REDIS_ENABLED:
        redis_url_masked = settings.REDIS_URL
        if "@" in redis_url_masked:
            parts = redis_url_masked.split("@")
            redis_url_masked = f"{parts[0].split(':')[0]}://***:***@{parts[1]}"
        logger.info(f"Redis URL: {redis_url_masked}")
    logger.info(f"Max Tokens Per Request: {settings.MAX_TOKENS_PER_REQUEST}")
    logger.info("=" * 60)
    
    # ============================================================
    # INITIALIZE STORAGE BACKEND (NEW)
    # ============================================================
    try:
        storage_config = settings.get_storage_config()
        storage_service.initialize(**storage_config)
        await storage_service.connect()
        logger.info(f"✅ Storage backend initialized: {storage_service.backend_type}")
    except Exception as e:
        logger.error(f"❌ Storage initialization failed: {e}")
        raise
    
    # Initialize cache (Redis) - removed explicit connect to avoid AttributeError
    # If needed, implement connect() in cache_service.py
    if settings.REDIS_ENABLED:
        from app.services.cache_service import cache_service
    
    yield
    
    # ==================== SHUTDOWN ====================
    logger.info("=" * 60)
    logger.info("🛑 AI Service shutting down...")
    logger.info("=" * 60)
    
    global is_shutting_down
    is_shutting_down = True
    
    logger.info(f"⏳ Waiting for {active_requests} active requests to complete...")
    
    shutdown_timeout = 25
    wait_time = 0
    
    while active_requests > 0 and wait_time < shutdown_timeout:
        await asyncio.sleep(0.5)
        wait_time += 0.5
        
        if wait_time % 5 == 0 and active_requests > 0:
            logger.info(f"⏳ Still waiting... {active_requests} requests active")
    
    if active_requests > 0:
        logger.warning(f"⚠️ Shutdown timeout. {active_requests} requests terminated.")
    else:
        logger.info("✅ All requests completed")
    
    # Close connections
    try:
        if settings.REDIS_ENABLED:
            from app.services.cache_service import cache_service
            if hasattr(cache_service, 'close'):
                await cache_service.close()
                logger.info("✅ Cache connection closed")
        
        # Close storage connection
        await storage_service.close()
        logger.info("✅ Storage connection closed")
        
    except Exception as e:
        logger.error(f"❌ Error during shutdown: {e}")
    
    logger.info("✅ Graceful shutdown complete")
    logger.info("=" * 60)

app = FastAPI(
    title="Legacy Code Modernization AI Service",
    description="AI-powered code analysis and modernization suggestions",
    version="1.0.0",
    lifespan=lifespan
)

@app.middleware("http")
async def track_requests(request: Request, call_next):
    """Track active requests for graceful shutdown"""
    global active_requests, is_shutting_down
    
    if is_shutting_down:
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service Unavailable",
                "message": "AI service is shutting down. Retry in 30 seconds."
            }
        )
    
    active_requests += 1
    logger.debug(f"📥 Request started: {request.url.path} | Active: {active_requests}")
    
    try:
        response = await call_next(request)
        return response
    finally:
        active_requests -= 1
        logger.debug(f"📤 Request completed | Active: {active_requests}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.BACKEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    if is_shutting_down:
        return JSONResponse(
            status_code=503,
            content={"status": "shutting_down", "active_requests": active_requests}
        )
    
    from app.services.llm_service import llm_service
    
    return {
        "status": "healthy",
        "provider": llm_service.provider,
        "model": llm_service.model,
        "storage_backend": storage_service.backend_type,  # ✅ NEW
        "active_requests": active_requests
    }

app.include_router(router)

def handle_sigterm(signum, frame):
    """Handle SIGTERM"""
    logger.info("🛑 Received SIGTERM signal")
    global is_shutting_down
    is_shutting_down = True

def handle_sigint(signum, frame):
    """Handle SIGINT (Ctrl+C)"""
    logger.info("🛑 Received SIGINT")
    global is_shutting_down
    is_shutting_down = True
    sys.exit(0)

signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigint)

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )