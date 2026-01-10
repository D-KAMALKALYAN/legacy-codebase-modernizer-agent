from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.config import settings
from app.api.endpoints import router
import logging
import signal
import sys
import asyncio

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# ============================================================
# GRACEFUL SHUTDOWN STATE
# ============================================================
is_shutting_down = False
active_requests = 0

# ============================================================
# LIFESPAN CONTEXT MANAGER
# ============================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event handler with graceful shutdown
    Handles startup and shutdown events
    """
    # ==================== STARTUP ====================
    logger.info("=" * 60)
    logger.info("🚀 Legacy Code Modernization AI Service Starting...")
    logger.info("=" * 60)
    logger.info(f"Environment: {settings.ENVIRONMENT}")
    logger.info(f"LLM Provider: {settings.LLM_PROVIDER}")
    
    # Show correct model based on provider
    if settings.LLM_PROVIDER == "ollama":
        logger.info(f"LLM Model: {settings.OLLAMA_MODEL}")
    elif settings.LLM_PROVIDER == "openai":
        logger.info(f"LLM Model: {settings.OPENAI_MODEL}")
    elif settings.LLM_PROVIDER == "anthropic":
        logger.info(f"LLM Model: {settings.ANTHROPIC_MODEL}")
    
    logger.info(f"Redis Enabled: {settings.REDIS_ENABLED}")
    if settings.REDIS_ENABLED:
        # Mask Redis password in URL
        redis_url_masked = settings.REDIS_URL
        if "@" in redis_url_masked:
            parts = redis_url_masked.split("@")
            redis_url_masked = f"{parts[0].split(':')[0]}://***:***@{parts[1]}"
        logger.info(f"Redis URL: {redis_url_masked}")
    logger.info(f"Max Tokens Per Request: {settings.MAX_TOKENS_PER_REQUEST}")
    logger.info("=" * 60)
    
    # Yield control to FastAPI (app runs here)
    yield
    
    # ==================== SHUTDOWN ====================
    logger.info("=" * 60)
    logger.info("🛑 AI Service shutting down...")
    logger.info("=" * 60)
    
    global is_shutting_down
    is_shutting_down = True
    
    # Wait for active requests to complete (max 25s)
    # Railway/Render give 30s total, reserve 5s for cleanup
    logger.info(f"⏳ Waiting for {active_requests} active requests to complete...")
    
    shutdown_timeout = 25
    wait_time = 0
    
    while active_requests > 0 and wait_time < shutdown_timeout:
        await asyncio.sleep(0.5)
        wait_time += 0.5
        
        # Log every 5 seconds
        if wait_time % 5 == 0 and active_requests > 0:
            logger.info(f"⏳ Still waiting... {active_requests} requests active")
    
    if active_requests > 0:
        logger.warning(
            f"⚠️  Shutdown timeout reached. "
            f"{active_requests} requests will be terminated."
        )
    else:
        logger.info("✅ All requests completed successfully")
    
    # Close connections
    try:
        # Close Redis/cache if needed
        from app.services.cache_service import cache_service
        if hasattr(cache_service, 'close'):
            await cache_service.close()
            logger.info("✅ Cache connection closed")
    except Exception as e:
        logger.error(f"❌ Error closing cache: {e}")
    
    logger.info("✅ Graceful shutdown complete")
    logger.info("=" * 60)

# ============================================================
# CREATE FASTAPI APP
# ============================================================

app = FastAPI(
    title="Legacy Code Modernization AI Service",
    description="AI-powered code analysis and modernization suggestions",
    version="1.0.0",
    lifespan=lifespan
)

# ============================================================
# MIDDLEWARE: TRACK ACTIVE REQUESTS
# ============================================================

@app.middleware("http")
async def track_requests(request: Request, call_next):
    """
    Track active requests for graceful shutdown
    Reject new requests during shutdown
    """
    global active_requests, is_shutting_down
    
    # Reject new requests during shutdown
    if is_shutting_down:
        return JSONResponse(
            status_code=503,
            content={
                "error": "Service Unavailable",
                "message": "AI service is shutting down. Please retry in 30 seconds."
            }
        )
    
    # Increment counter
    active_requests += 1
    logger.debug(f"📥 Request started: {request.url.path} | Active: {active_requests}")
    
    try:
        # Process request
        response = await call_next(request)
        return response
    finally:
        # Decrement counter
        active_requests -= 1
        logger.debug(f"📤 Request completed: {request.url.path} | Active: {active_requests}")

# ============================================================
# CORS MIDDLEWARE
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.BACKEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# HEALTH CHECK ENDPOINT
# ============================================================

@app.get("/health")
async def health_check():
    """
    Health check endpoint for deployment platforms
    Returns 503 during shutdown for load balancers
    """
    if is_shutting_down:
        return JSONResponse(
            status_code=503,
            content={
                "status": "shutting_down",
                "active_requests": active_requests
            }
        )
    
    from app.services.llm_service import llm_service
    
    return {
        "status": "healthy",
        "provider": llm_service.provider,
        "model": llm_service.model,
        "active_requests": active_requests,
        "uptime": "N/A"  # Could track this if needed
    }

# ============================================================
# INCLUDE API ROUTES
# ============================================================

app.include_router(router)

# ============================================================
# SIGNAL HANDLERS (for local development & Docker)
# ============================================================

def handle_sigterm(signum, frame):
    """Handle SIGTERM signal from deployment platforms"""
    logger.info("🛑 Received SIGTERM signal")
    global is_shutting_down
    is_shutting_down = True

def handle_sigint(signum, frame):
    """Handle SIGINT signal (Ctrl+C)"""
    logger.info("🛑 Received SIGINT (Ctrl+C)")
    global is_shutting_down
    is_shutting_down = True
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGTERM, handle_sigterm)
signal.signal(signal.SIGINT, handle_sigint)

# ============================================================
# RUN SERVER (for local development)
# ============================================================

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )