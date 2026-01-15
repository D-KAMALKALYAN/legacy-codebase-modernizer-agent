"""
Abstract Storage Interface - Makes code storage-agnostic
Supports: GridFS (V1), S3 (V2), Azure Blob, Local FS
"""

from abc import ABC, abstractmethod
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class StorageInterface(ABC):
    """Abstract base class for storage backends"""
    
    @abstractmethod
    async def read_file(self, file_id: str) -> bytes:
        """Read file content as bytes"""
        pass
    
    @abstractmethod
    async def read_file_as_text(self, file_id: str, encoding: str = 'utf-8') -> str:
        """Read file content as text"""
        pass
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def file_exists(self, file_id: str) -> bool:
        """Check if file exists"""
        pass
    
    @abstractmethod
    async def get_file_metadata(self, file_id: str) -> dict:
        """Get file metadata (size, content_type, etc.)"""
        pass
    
    @abstractmethod
    async def connect(self):
        """Initialize storage connection"""
        pass
    
    @abstractmethod
    async def close(self):
        """Close storage connection"""
        pass


class GridFSStorage(StorageInterface):
    """GridFS storage implementation (MongoDB)"""
    
    def __init__(self, mongodb_uri: str, database: str):
        self.mongodb_uri = mongodb_uri
        self.database = database
        self.client = None
        self.db = None
        self.fs = None
    
    async def connect(self):
        """Initialize MongoDB connection"""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
            
            self.client = AsyncIOMotorClient(self.mongodb_uri)
            self.db = self.client[self.database]
            self.fs = AsyncIOMotorGridFSBucket(self.db, bucket_name="uploads")
            
            # Test connection
            await self.client.admin.command('ping')
            logger.info(f"✅ GridFS connected: {self.database}")
            
            # Debug: Log collections to verify bucket
            collections = await self.db.list_collection_names()
            logger.info(f"📂 Available collections: {collections}")
            
        except Exception as e:
            logger.error(f"❌ GridFS connection failed: {e}")
            raise
    
    async def close(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("GridFS connection closed")
    
    async def read_file(self, file_id: str) -> bytes:
        """Read file from GridFS"""
        try:
            from bson import ObjectId
            
            object_id = ObjectId(file_id)
            
            # Debug logging
            logger.info(f"🔍 Looking for file: {file_id}")
            
            # Check in uploads.files collection
            files_collection = self.db["uploads.files"]
            file_doc = await files_collection.find_one({"_id": object_id})
            
            if not file_doc:
                logger.error(f"❌ File not found in uploads.files collection")
                raise FileNotFoundError(f"File not found in GridFS: {file_id}")
            
            logger.info(f"✅ Found file metadata: {file_doc.get('filename')}")
            
            # Read content
            logger.info(f"📖 Reading file content from GridFS")
            download_stream = await self.fs.open_download_stream(object_id)
            content = await download_stream.read()
            
            logger.info(f"✅ Read {len(content)} bytes from GridFS")
            return content
            
        except ValueError:
            raise ValueError(f"Invalid GridFS ID: {file_id}")
        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"❌ GridFS read error: {type(e).__name__}: {e}")
            raise
    
    async def read_file_as_text(self, file_id: str, encoding: str = 'utf-8') -> str:
        """Read file as text"""
        content = await self.read_file(file_id)
        return content.decode(encoding)
    
    async def write_file(self, filename: str, content: bytes, content_type: str = 'text/plain') -> str:
        """
        Write file to GridFS
        
        Args:
            filename: Name of file
            content: File content as bytes
            content_type: MIME type
            
        Returns:
            GridFS file ID as string
        """
        try:
            logger.info(f"📝 Writing file to GridFS: {filename} ({len(content)} bytes)")
            
            # Upload to GridFS
            file_id = await self.fs.upload_from_stream(
                filename,
                content,
                metadata={"contentType": content_type}
            )
            
            logger.info(f"✅ File written to GridFS: {file_id}")
            return str(file_id)
            
        except Exception as e:
            logger.error(f"❌ GridFS write error: {e}")
            raise
    
    async def file_exists(self, file_id: str) -> bool:
        """Check if file exists"""
        try:
            from bson import ObjectId
            object_id = ObjectId(file_id)
            cursor = self.fs.find({"_id": object_id})
            file_info_list = await cursor.to_list(length=1)
            return bool(file_info_list)
        except Exception:
            return False
    
    async def get_file_metadata(self, file_id: str) -> dict:
        """Get file metadata"""
        try:
            from bson import ObjectId
            object_id = ObjectId(file_id)
            cursor = self.fs.find({"_id": object_id})
            file_info_list = await cursor.to_list(length=1)
            
            if not file_info_list:
                raise FileNotFoundError(f"File not found: {file_id}")
            
            file_info = file_info_list[0]
            return {
                "file_id": file_id,
                "filename": file_info.get("filename"),
                "size": file_info.get("length"),
                "content_type": file_info.get("contentType"),
                "upload_date": file_info.get("uploadDate")
            }
        except Exception as e:
            logger.error(f"❌ Metadata fetch error: {e}")
            raise


class S3Storage(StorageInterface):
    """S3 storage implementation (AWS/MinIO/etc.) - FUTURE V2"""
    
    def __init__(self, bucket_name: str, region: str = 'us-east-1', 
                 endpoint_url: Optional[str] = None):
        self.bucket_name = bucket_name
        self.region = region
        self.endpoint_url = endpoint_url
        self.client = None
        self.session = None
    
    async def connect(self):
        """Initialize S3 client"""
        try:
            import aioboto3
            
            self.session = aioboto3.Session()
            self.client = await self.session.client(
                's3',
                region_name=self.region,
                endpoint_url=self.endpoint_url
            ).__aenter__()
            
            logger.info(f"✅ S3 connected: {self.bucket_name}")
        except Exception as e:
            logger.error(f"❌ S3 connection failed: {e}")
            raise
    
    async def close(self):
        """Close S3 client"""
        if self.client:
            await self.client.__aexit__(None, None, None)
            logger.info("S3 connection closed")
    
    async def read_file(self, file_id: str) -> bytes:
        """Read file from S3"""
        try:
            response = await self.client.get_object(Bucket=self.bucket_name, Key=file_id)
            content = await response['Body'].read()
            logger.info(f"✅ Read {len(content)} bytes from S3")
            return content
        except Exception as e:
            logger.error(f"❌ S3 read error: {e}")
            raise FileNotFoundError(f"File not found: {file_id}")
    
    async def read_file_as_text(self, file_id: str, encoding: str = 'utf-8') -> str:
        """Read file as text"""
        content = await self.read_file(file_id)
        return content.decode(encoding)
    
    async def write_file(self, filename: str, content: bytes, content_type: str = 'text/plain') -> str:
        """Write file to S3"""
        try:
            file_key = f"reports/{filename}"
            await self.client.put_object(
                Bucket=self.bucket_name,
                Key=file_key,
                Body=content,
                ContentType=content_type
            )
            logger.info(f"✅ File written to S3: {file_key}")
            return file_key
        except Exception as e:
            logger.error(f"❌ S3 write error: {e}")
            raise
    
    async def file_exists(self, file_id: str) -> bool:
        """Check if file exists"""
        try:
            await self.client.head_object(Bucket=self.bucket_name, Key=file_id)
            return True
        except Exception:
            return False
    
    async def get_file_metadata(self, file_id: str) -> dict:
        """Get file metadata"""
        try:
            response = await self.client.head_object(Bucket=self.bucket_name, Key=file_id)
            return {
                "file_id": file_id,
                "size": response['ContentLength'],
                "content_type": response['ContentType'],
                "last_modified": response['LastModified']
            }
        except Exception as e:
            logger.error(f"❌ S3 metadata error: {e}")
            raise


class LocalFileStorage(StorageInterface):
    """Local filesystem storage (for development/testing)"""
    
    def __init__(self, base_path: str = "./uploads"):
        self.base_path = base_path
    
    async def connect(self):
        """Initialize local storage"""
        import os
        os.makedirs(self.base_path, exist_ok=True)
        logger.info(f"✅ Local storage ready: {self.base_path}")
    
    async def close(self):
        """No-op for local storage"""
        pass
    
    async def read_file(self, file_id: str) -> bytes:
        """Read file from local filesystem"""
        import os
        file_path = os.path.join(self.base_path, file_id)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_id}")
        
        with open(file_path, 'rb') as f:
            content = f.read()
        
        logger.info(f"✅ Read {len(content)} bytes from local storage")
        return content
    
    async def read_file_as_text(self, file_id: str, encoding: str = 'utf-8') -> str:
        """Read file as text"""
        content = await self.read_file(file_id)
        return content.decode(encoding)
    
    async def write_file(self, filename: str, content: bytes, content_type: str = 'text/plain') -> str:
        """Write file to local filesystem"""
        import os
        file_path = os.path.join(self.base_path, filename)
        
        os.makedirs(os.path.dirname(file_path) or self.base_path, exist_ok=True)
        
        with open(file_path, 'wb') as f:
            f.write(content)
        
        logger.info(f"✅ File written to local storage: {file_path}")
        return filename
    
    async def file_exists(self, file_id: str) -> bool:
        """Check if file exists"""
        import os
        return os.path.exists(os.path.join(self.base_path, file_id))
    
    async def get_file_metadata(self, file_id: str) -> dict:
        """Get file metadata"""
        import os
        file_path = os.path.join(self.base_path, file_id)
        
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_id}")
        
        stat = os.stat(file_path)
        return {
            "file_id": file_id,
            "size": stat.st_size,
            "last_modified": stat.st_mtime
        }