"""
Storage Service - Factory for creating storage backends
This is the ONLY file that needs to change when switching storage providers
"""

import logging
from typing import Optional
from app.storage.storage_interface import (
    StorageInterface,
    GridFSStorage,
    S3Storage,
    LocalFileStorage
)

logger = logging.getLogger(__name__)


class StorageService:
    """
    Storage service factory
    Provides unified interface for all storage backends
    """
    
    def __init__(self):
        self._backend: Optional[StorageInterface] = None
        self._backend_type: Optional[str] = None
    
    def initialize(self, backend_type: str, **kwargs):
        """
        Initialize storage backend
        
        Args:
            backend_type: Type of storage (gridfs, s3, local)
            **kwargs: Backend-specific configuration
        """
        self._backend_type = backend_type.lower()
        
        if self._backend_type == "gridfs":
            self._backend = GridFSStorage(
                mongodb_uri=kwargs['mongodb_uri'],
                database=kwargs.get('database', 'legacy-modernizer')
            )
        
        elif self._backend_type == "s3":
            self._backend = S3Storage(
                bucket_name=kwargs['bucket_name'],
                region=kwargs.get('region', 'us-east-1'),
                endpoint_url=kwargs.get('endpoint_url')  # For MinIO
            )
        
        elif self._backend_type == "local":
            self._backend = LocalFileStorage(
                base_path=kwargs.get('base_path', './uploads')
            )
        
        else:
            raise ValueError(
                f"Unsupported storage backend: {backend_type}. "
                f"Supported: gridfs, s3, local"
            )
        
        logger.info(f"Storage backend initialized: {self._backend_type}")
    
    async def connect(self):
        """Connect to storage backend"""
        if not self._backend:
            raise RuntimeError("Storage backend not initialized")
        await self._backend.connect()
    
    async def close(self):
        """Close storage connection"""
        if self._backend:
            await self._backend.close()
    
    async def read_file(self, file_id: str) -> bytes:
        """Read file content as bytes"""
        if not self._backend:
            raise RuntimeError("Storage backend not initialized")
        return await self._backend.read_file(file_id)
    
    async def read_file_as_text(self, file_id: str, encoding: str = 'utf-8') -> str:
        """Read file content as text"""
        if not self._backend:
            raise RuntimeError("Storage backend not initialized")
        return await self._backend.read_file_as_text(file_id, encoding)
    
    async def file_exists(self, file_id: str) -> bool:
        """Check if file exists"""
        if not self._backend:
            raise RuntimeError("Storage backend not initialized")
        return await self._backend.file_exists(file_id)
    
    async def get_file_metadata(self, file_id: str) -> dict:
        """Get file metadata"""
        if not self._backend:
            raise RuntimeError("Storage backend not initialized")
        return await self._backend.get_file_metadata(file_id)
    
    async def write_file(self, filename: str, content: bytes, content_type: str = 'text/plain') -> str:
        """
        Write file to storage
        
        Args:
            filename: Name of file
            content: File content as bytes
            content_type: MIME type
            
        Returns:
            File ID in storage system
        """
        if not self._backend:
            raise RuntimeError("Storage backend not initialized")
        return await self._backend.write_file(filename, content, content_type)
    
    @property
    def backend_type(self) -> str:
        """Get current backend type"""
        return self._backend_type or "not_initialized"


# Global storage service instance
storage_service = StorageService()