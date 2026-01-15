from fastapi import APIRouter, HTTPException, status
from app.models.schemas import (
    AnalysisRequest,
    AnalysisResponse,
    HealthResponse,
    CodeIssue,
    AnalysisSummary,
    AnalysisMetadata
)
from app.services.modernization_engine import modernization_engine
from app.services.report_service import report_service
from app.services.cache_service import cache_service
from app.storage.storage_service import storage_service  # ✅ NEW
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    cache_stats = cache_service.get_stats()
    
    return HealthResponse(
        status="healthy",
        llm_provider=modernization_engine.llm_service.provider,
        redis_connected=cache_stats.get("connected", False),
        storage_backend=storage_service.backend_type,  # ✅ NEW
        timestamp=datetime.now()
    )

@router.post("/api/analyze", response_model=AnalysisResponse)
async def analyze_code(request: AnalysisRequest):
    """
    Analyze code and generate modernization suggestions
    STORAGE-AGNOSTIC: Works with GridFS, S3, or Local storage
    
    Args:
        request: Analysis request with job details
        
    Returns:
        Analysis results with issues and recommendations
    """
    try:
        logger.info(f"📥 Received analysis request for job: {request.job_id}")
        logger.info(f"   File ID: {request.file_id}")
        logger.info(f"   Upload Type: {request.upload_type}")
        logger.info(f"   Storage Backend: {storage_service.backend_type}")
        
        # Inject storage service into report service
        report_service.set_storage(storage_service)
        
        # Perform analysis (storage-agnostic)
        analysis_result = await modernization_engine.analyze(
            file_id=request.file_id,
            upload_type=request.upload_type,
            force_refresh=request.force_refresh
        )
        
        # Generate report and upload to storage
        report_file_id = None  # ✅ Changed from report_path
        try:
            logger.info(f"🔄 Generating report for job {request.job_id}")
            report_file_id = await report_service.generate_markdown(
                analysis_result,
                request.job_id
            )
            logger.info(f"✅ Report uploaded: {report_file_id}")
        except Exception as e:
            logger.error(f"⚠️ Report generation failed: {e}", exc_info=True)
        
        # Build response
        response = AnalysisResponse(
            job_id=request.job_id,
            status="completed",
            analysis=analysis_result.get("analysis", {}),
            issues=[CodeIssue(**issue) for issue in analysis_result.get("issues", [])],
            summary=AnalysisSummary(**analysis_result.get("summary")),
            metadata=AnalysisMetadata(**analysis_result.get("metadata")),
            report_path=report_file_id  # ✅ Now contains file ID, not path
        )
        
        logger.info(f"✅ Analysis completed for job: {request.job_id}")
        return response
        
    except FileNotFoundError as e:
        logger.error(f"❌ File not found: {e}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File not found in {storage_service.backend_type}: {request.file_id}"
        )
    
    except ValueError as e:
        logger.error(f"❌ Invalid input: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    
    except Exception as e:
        logger.error(f"❌ Analysis failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Analysis failed: {str(e)}"
        )

@router.get("/api/cache/stats")
async def get_cache_stats():
    """Get Redis cache statistics"""
    return cache_service.get_stats()

@router.delete("/api/cache/clear/{job_id}")
async def clear_cache(job_id: str):
    """Clear cache for specific job (admin endpoint)"""
    return {"message": "Cache clearing not fully implemented in V1"}