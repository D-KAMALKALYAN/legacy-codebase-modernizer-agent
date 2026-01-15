import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application configuration settings"""
    
    # Server
    PORT = int(os.getenv("PORT", 8000))
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    
    # ============================================================
    # STORAGE BACKEND CONFIGURATION (NEW)
    # ============================================================
    # Options: "gridfs" (V1), "s3" (V2), "local" (dev/test)
    # 
    # V1 (Current): STORAGE_BACKEND=gridfs
    # V2 (Future):  STORAGE_BACKEND=s3
    # Dev/Test:     STORAGE_BACKEND=local
    # ============================================================
    STORAGE_BACKEND = os.getenv("STORAGE_BACKEND", "gridfs").lower()
    
    # GridFS Configuration (MongoDB)
    MONGODB_URI = os.getenv("MONGODB_URI")
    MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "legacy-modernizer")
    
    # S3 Configuration (AWS/MinIO) - For Future V2
    S3_BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
    S3_REGION = os.getenv("S3_REGION", "us-east-1")
    S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL")  # For MinIO/S3-compatible
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")
    
    # Local Storage Configuration (Dev/Test)
    LOCAL_STORAGE_PATH = os.getenv("LOCAL_STORAGE_PATH", "./uploads")
    
    # ============================================================
    # LLM PROVIDER CONFIGURATION
    # ============================================================
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()

    LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1")) 
    
    # Ollama (Local LLM)
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    
    # OpenAI (Cloud API)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    
    # Anthropic (Cloud API)
    ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
    ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-haiku-4-20250514")
    
    # Redis
    REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
    REDIS_ENABLED = os.getenv("REDIS_ENABLED", "true").lower() == "true"
    CACHE_TTL_SNIPPET = int(os.getenv("CACHE_TTL_SNIPPET", 2592000))  # 30 days
    CACHE_TTL_FOLDER = int(os.getenv("CACHE_TTL_FOLDER", 604800))    # 7 days
    CACHE_TTL_ZIP = int(os.getenv("CACHE_TTL_ZIP", 1209600))         # 14 days
    
    # Processing
    MAX_TOKENS_PER_REQUEST = int(os.getenv("MAX_TOKENS_PER_REQUEST", 8000))
    CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", 3000))
    MAX_FILES_PER_ANALYSIS = int(os.getenv("MAX_FILES_PER_ANALYSIS", 100))
    
    # Backend
    BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:5000")
    
    # Logging
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
    
    @classmethod
    def get_storage_config(cls) -> dict:
        """
        Get storage configuration based on selected backend
        Returns dict with backend-specific config
        """
        if cls.STORAGE_BACKEND == "gridfs":
            return {
                "backend_type": "gridfs",
                "mongodb_uri": cls.MONGODB_URI,
                "database": cls.MONGODB_DATABASE
            }
        
        elif cls.STORAGE_BACKEND == "s3":
            return {
                "backend_type": "s3",
                "bucket_name": cls.S3_BUCKET_NAME,
                "region": cls.S3_REGION,
                "endpoint_url": cls.S3_ENDPOINT_URL
            }
        
        elif cls.STORAGE_BACKEND == "local":
            return {
                "backend_type": "local",
                "base_path": cls.LOCAL_STORAGE_PATH
            }
        
        else:
            raise ValueError(f"Invalid STORAGE_BACKEND: {cls.STORAGE_BACKEND}")
    
    @classmethod
    def validate(cls):
        """Validate required settings"""
        # LLM validation
        if cls.LLM_PROVIDER == "openai" and not cls.OPENAI_API_KEY:
            raise ValueError(
                "❌ OPENAI_API_KEY is required when LLM_PROVIDER=openai\n"
                "   Get your key at: https://platform.openai.com/api-keys\n"
                "   OR switch to local LLM: LLM_PROVIDER=ollama"
            )
        
        if cls.LLM_PROVIDER == "anthropic" and not cls.ANTHROPIC_API_KEY:
            raise ValueError(
                "❌ ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic\n"
                "   Get your key at: https://console.anthropic.com\n"
                "   OR switch to local LLM: LLM_PROVIDER=ollama"
            )
        
        if cls.LLM_PROVIDER not in ["openai", "anthropic", "ollama"]:
            raise ValueError(
                f"❌ Invalid LLM_PROVIDER: {cls.LLM_PROVIDER}\n"
                f"   Valid options: ollama (local), openai (cloud), anthropic (cloud)"
            )
        
        # Storage validation
        if cls.STORAGE_BACKEND == "gridfs" and not cls.MONGODB_URI:
            raise ValueError(
                "❌ MONGODB_URI is required when STORAGE_BACKEND=gridfs"
            )
        
        if cls.STORAGE_BACKEND == "s3" and not cls.S3_BUCKET_NAME:
            raise ValueError(
                "❌ S3_BUCKET_NAME is required when STORAGE_BACKEND=s3"
            )
        
        if cls.STORAGE_BACKEND not in ["gridfs", "s3", "local"]:
            raise ValueError(
                f"❌ Invalid STORAGE_BACKEND: {cls.STORAGE_BACKEND}\n"
                f"   Valid options: gridfs (V1), s3 (V2), local (dev)"
            )
        
        # Info messages
        if cls.LLM_PROVIDER == "ollama":
            print("ℹ️  Using LOCAL LLM (Ollama) - FREE for testing")
            print(f"ℹ️  Model: {cls.OLLAMA_MODEL}")
        
        print(f"ℹ️  Storage Backend: {cls.STORAGE_BACKEND.upper()}")
    
    @classmethod
    def get_cache_ttl(cls, upload_type: str) -> int:
        """Get cache TTL based on upload type"""
        ttl_map = {
            "snippet": cls.CACHE_TTL_SNIPPET,
            "folder": cls.CACHE_TTL_FOLDER,
            "zip": cls.CACHE_TTL_ZIP
        }
        return ttl_map.get(upload_type, cls.CACHE_TTL_FOLDER)

settings = Settings()

# Validate on import
try:
    settings.validate()
    print("✅ Configuration validated successfully")
except ValueError as e:
    print(f"❌ Configuration error: {e}")
    raise