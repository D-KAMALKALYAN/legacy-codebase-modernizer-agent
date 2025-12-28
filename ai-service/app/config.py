import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Application configuration settings"""
    
    # Server
    PORT = int(os.getenv("PORT", 8000))
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
    
    # ============================================================
    # LLM PROVIDER CONFIGURATION
    # ============================================================
    # Options: "ollama", "openai", "anthropic"
    # 
    # FOR LOCAL TESTING (FREE):
    #   LLM_PROVIDER=ollama
    # 
    # FOR PRODUCTION (PAID):
    #   LLM_PROVIDER=openai
    # ============================================================
    LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama").lower()
    
    # ============================================================
    # OLLAMA CONFIGURATION (Local LLM)
    # ============================================================
    # Use for free local testing during development
    OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
    # Available models: llama3.2:3b, mistral, codellama, phi3
    # Install: ollama pull llama3.2:3b
    
    # ============================================================
    # OPENAI CONFIGURATION (Cloud API)
    # ============================================================
    # Use for production/resume showcase (requires API key)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    # Recommended models: gpt-4o-mini (cheap), gpt-4o (best quality)
    
    # ============================================================
    # ANTHROPIC CONFIGURATION (Cloud API)
    # ============================================================
    # Alternative to OpenAI (requires API key)
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
    def validate(cls):
        """Validate required settings"""
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
        
        if cls.LLM_PROVIDER == "ollama":
            print("ℹ️  Using LOCAL LLM (Ollama) - FREE for testing")
            print(f"ℹ️  Model: {cls.OLLAMA_MODEL}")
            print(f"ℹ️  Base URL: {cls.OLLAMA_BASE_URL}")
    
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