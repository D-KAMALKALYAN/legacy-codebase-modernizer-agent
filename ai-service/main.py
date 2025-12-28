from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.config import settings
from app.api.endpoints import router
import logging

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler (replaces deprecated on_event)"""
    # Startup
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
    
    yield
    
    # Shutdown
    logger.info("🛑 AI Service shutting down...")

# Create FastAPI app with lifespan
app = FastAPI(
    title="Legacy Code Modernization AI Service",
    description="AI-powered code analysis and modernization suggestions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.BACKEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower()
    )