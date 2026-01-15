from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class AnalysisRequest(BaseModel):
    """Request model for code analysis"""
    job_id: str = Field(..., description="Job ID from backend")
    file_id: str = Field(..., description="Storage file ID (GridFS ID, S3 key, etc.)")  # ✅ CHANGED
    upload_type: str = Field(..., description="Type: snippet, folder, or zip")
    force_refresh: bool = Field(default=False, description="Skip cache and force new analysis")

class CodeIssue(BaseModel):
    """Individual code issue"""
    type: str = Field(..., description="Issue type: security, performance, syntax, etc.")
    severity: str = Field(..., description="Severity: critical, warning, info")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="Confidence score 0.0-1.0") 
    file: str = Field(..., description="File path")
    line: Optional[int] = Field(None, description="Line number")
    message: str = Field(..., description="Issue description")
    suggestion: str = Field(..., description="Recommended fix")
    code_snippet: Optional[str] = Field(None, description="Problematic code")
    fixed_code: Optional[str] = Field(None, description="Suggested fix")
                                         
class AnalysisSummary(BaseModel):
    """Summary of analysis"""
    total_issues: int
    critical: int
    warnings: int
    info: int
    files_analyzed: int
    total_lines: int
    languages_detected: List[str]

class AnalysisMetadata(BaseModel):
    """Analysis metadata"""
    cached: bool = Field(default=False, description="Whether result was cached")
    cached_at: Optional[datetime] = Field(None, description="When result was cached")
    tokens_used: int = Field(default=0, description="LLM tokens consumed")
    model: str = Field(..., description="LLM model used")
    processing_time: float = Field(..., description="Processing time in seconds")
    cost_estimate: float = Field(default=0.0, description="Estimated cost in USD")
    validation_applied: bool = True 
    min_confidence: float = 0.5 
    storage_backend: Optional[str] = Field(None, description="Storage backend used")  # ✅ NEW

class AnalysisResponse(BaseModel):
    """Response model for code analysis"""
    job_id: str
    status: str = Field(default="completed", description="Status: completed, failed")
    analysis: Dict[str, Any] = Field(..., description="Analysis results")
    issues: List[CodeIssue] = Field(default_factory=list, description="List of issues found")
    summary: AnalysisSummary
    metadata: AnalysisMetadata
    report_path: Optional[str] = Field(None, description="Path to generated report")
    error: Optional[str] = Field(None, description="Error message if failed")

class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    llm_provider: str
    redis_connected: bool
    storage_backend: str 
    timestamp: datetime