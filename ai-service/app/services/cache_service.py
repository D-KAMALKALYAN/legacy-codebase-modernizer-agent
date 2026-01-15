"""
Cache service for storing analysis results in Redis
FIXED: Content-based hashing (no file I/O)
"""

import redis
import json
import hashlib
from typing import Optional, Dict, Any
from app.config import settings
import logging

logger = logging.getLogger(__name__)


class CacheService:
    """Redis caching service for LLM responses"""
    
    def __init__(self):
        self.enabled = settings.REDIS_ENABLED
        self.client = None
        
        if self.enabled:
            try:
                self.client = redis.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5
                )
                # Test connection
                self.client.ping()
                logger.info("✅ Redis connected successfully")
            except Exception as e:
                logger.warning(f"⚠️ Redis connection failed: {e}. Caching disabled.")
                self.enabled = False
    
    def generate_cache_key(self, content: str, upload_type: str) -> str:
        """
        Generate unique cache key based on CODE CONTENT (not file path)
        
        Args:
            content: The actual code content as a string
            upload_type: Type of upload (snippet, folder, zip)
            
        Returns:
            Cache key string
        """
        try:
            # Normalize content (strip whitespace for consistent hashing)
            normalized_content = content.strip()
            
            # Include upload type in hash to prevent collisions
            content_with_type = f"{upload_type}:{normalized_content}"
            
            # Create SHA-256 hash
            hash_object = hashlib.sha256(content_with_type.encode('utf-8'))
            content_hash = hash_object.hexdigest()
            
            cache_key = f"analysis:{upload_type}:{content_hash}"
            
            logger.debug(f"✅ Cache key generated: {cache_key[:60]}...")
            return cache_key
            
        except Exception as e:
            logger.error(f"❌ Error generating cache key: {e}")
            # Return unique error key that won't match anything
            import time
            error_hash = hashlib.sha256(f"error:{time.time()}".encode()).hexdigest()
            return f"analysis:error:{error_hash}"
    
    def get(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """
        Get cached analysis result
        
        Args:
            cache_key: Cache key to lookup
            
        Returns:
            Cached result or None
        """
        if not self.enabled or not self.client:
            logger.debug("Cache disabled or not connected")
            return None
        
        try:
            cached_data = self.client.get(cache_key)
            if cached_data:
                logger.info(f"✅ Cache HIT for key: {cache_key[:60]}...")
                return json.loads(cached_data)
            else:
                logger.info(f"❌ Cache MISS for key: {cache_key[:60]}...")
                return None
        except Exception as e:
            logger.error(f"❌ Redis GET error: {e}")
            return None
    
    def set(self, cache_key: str, data: Dict[str, Any], upload_type: str) -> bool:
        """
        Cache analysis result
        
        Args:
            cache_key: Cache key
            data: Data to cache
            upload_type: Type of upload (for TTL selection)
            
        Returns:
            Success boolean
        """
        if not self.enabled or not self.client:
            logger.debug("Cache disabled or not connected")
            return False
        
        try:
            ttl = settings.get_cache_ttl(upload_type)
            
            # Convert Pydantic models to dicts before caching
            cache_data = {}
            for key, value in data.items():
                if hasattr(value, 'model_dump'):
                    cache_data[key] = value.model_dump()
                elif hasattr(value, 'dict'):
                    cache_data[key] = value.dict()
                elif isinstance(value, list):
                    cache_data[key] = [
                        item.model_dump() if hasattr(item, 'model_dump') 
                        else item.dict() if hasattr(item, 'dict')
                        else item
                        for item in value
                    ]
                else:
                    cache_data[key] = value
            
            serialized_data = json.dumps(cache_data, default=str)
            
            self.client.setex(
                cache_key,
                ttl,
                serialized_data
            )
            
            logger.info(f"✅ Cached result for key: {cache_key[:60]}... (TTL: {ttl}s)")
            return True
        except Exception as e:
            logger.error(f"❌ Redis SET error: {e}")
            return False
    
    def delete(self, cache_key: str) -> bool:
        """Delete cached result"""
        if not self.enabled or not self.client:
            return False
        
        try:
            self.client.delete(cache_key)
            logger.info(f"✅ Deleted cache key: {cache_key[:60]}...")
            return True
        except Exception as e:
            logger.error(f"❌ Redis DELETE error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.enabled or not self.client:
            return {"enabled": False, "connected": False}
        
        try:
            info = self.client.info()
            return {
                "enabled": True,
                "connected": True,
                "keys": self.client.dbsize(),
                "memory_used": info.get("used_memory_human", "N/A"),
                "uptime_days": info.get("uptime_in_days", 0)
            }
        except Exception as e:
            logger.error(f"❌ Redis stats error: {e}")
            return {"enabled": True, "connected": False, "error": str(e)}


# Global cache instance
cache_service = CacheService()