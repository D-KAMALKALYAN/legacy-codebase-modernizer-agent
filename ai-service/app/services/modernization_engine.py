"""
Core engine for code modernization analysis - WITH VALIDATION
File: app/services/modernization_engine.py
"""

import os
import time
from typing import Dict, Any, List
from datetime import datetime
import logging

from app.config import settings
from app.services.cache_service import cache_service
from app.services.llm_service import llm_service
from app.services.validation_service import validation_service  # NEW
from app.utils.file_reader import file_reader
from app.utils.token_counter import token_counter
from app.models.schemas import CodeIssue, AnalysisSummary, AnalysisMetadata

logger = logging.getLogger(__name__)


class ModernizationEngine:
    """Core engine for code modernization analysis"""
    
    def __init__(self):
        self.prompt_template = self._load_prompt_template()
        self.llm_service = llm_service
        self.validation_service = validation_service  # NEW
    
    def _load_prompt_template(self) -> str:
        """Load prompt template from file"""
        template_path = os.path.join(
            os.path.dirname(__file__),
            "../../prompt_templates/analysis_prompt.txt"
        )
        try:
            with open(template_path, 'r') as f:
                return f.read()
        except Exception as e:
            logger.error(f"Failed to load prompt template: {e}")
            # Fallback minimal template
            return "Analyze this code and return JSON with issues, summary, and recommendations:\n\n{code_files}"
    
    async def analyze(
        self,
        file_path: str,
        upload_type: str,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Main analysis entry point
        
        Args:
            file_path: Path to uploaded file/folder
            upload_type: Type: snippet, folder, zip
            force_refresh: Skip cache if True
            
        Returns:
            Analysis results dict
        """
        start_time = time.time()
        
        # Generate cache key
        cache_key = cache_service.generate_cache_key(file_path, upload_type)
        
        # Check cache (unless force_refresh)
        if not force_refresh:
            cached_result = cache_service.get(cache_key)
            if cached_result:
                logger.info("✅ Returning cached analysis result")
                cached_result["metadata"]["cached"] = True
                cached_result["metadata"]["processing_time"] = time.time() - start_time
                return cached_result
        
        # Read files
        logger.info(f"Reading files from {file_path}")
        if upload_type == "snippet":
            file_name, content = file_reader.read_file(file_path)
            files_data = [{
                "path": file_name,
                "name": file_name,
                "content": content,
                "lines": len(content.split('\n'))
            }]
        else:
            files_data = file_reader.read_directory(
                file_path,
                max_files=settings.MAX_FILES_PER_ANALYSIS
            )
        
        if not files_data:
            raise ValueError("No valid code files found to analyze")
        
        # Get file stats
        stats = file_reader.get_file_stats(files_data)
        
        # Build prompt
        prompt = self._build_prompt(files_data)
        
        # Store original code for validation
        original_code = self._extract_original_code(files_data)
        
        # Count tokens
        input_tokens = token_counter.count_tokens(prompt)
        logger.info(f"Prompt tokens: {input_tokens}")
        
        # Check token limit
        if input_tokens > settings.MAX_TOKENS_PER_REQUEST:
            # Chunk files if needed (V1: Simple truncation)
            logger.warning(
                f"Token limit exceeded ({input_tokens} > {settings.MAX_TOKENS_PER_REQUEST}). "
                f"Truncating."
            )
            prompt = token_counter.truncate_to_token_limit(
                prompt,
                settings.MAX_TOKENS_PER_REQUEST
            )
            input_tokens = settings.MAX_TOKENS_PER_REQUEST
        
        # Call LLM
        logger.info("Calling LLM for analysis...")
        llm_response = await llm_service.analyze_code(prompt)
        
        # Extract metadata
        llm_metadata = llm_response.pop("_metadata", {})
        output_tokens = llm_metadata.get("tokens_output", 0)
        total_tokens = llm_metadata.get("tokens_total", input_tokens)
        
        # ============================================================
        # NEW: VALIDATE LLM RESPONSE TO PREVENT HALLUCINATIONS
        # ============================================================
        validated_response = self.validation_service.validate_analysis(
            llm_response=llm_response,
            original_code=original_code,
            job_id=cache_key[:8]  # Use first 8 chars of cache key as job ID
        )
        
        # Calculate cost
        cost_estimate = token_counter.estimate_cost(
            input_tokens,
            output_tokens,
            llm_metadata.get("model")
        )
        
        # Build response with validated data
        result = {
            "analysis": validated_response,  # Use validated response
            "issues": [
                issue if isinstance(issue, dict) else issue.model_dump() 
                for issue in self._parse_issues(validated_response.get("issues", []))
            ],
            "summary": self._build_summary(
                validated_response.get("summary", {}),  # Use validated summary
                stats
            ).model_dump(),
            "metadata": {
                "cached": False,
                "cached_at": None,
                "tokens_used": total_tokens,
                "model": llm_metadata.get("model", settings.OPENAI_MODEL),
                "processing_time": time.time() - start_time,
                "cost_estimate": cost_estimate,
                "validation_applied": True,  # NEW: Flag that validation was applied
                "min_confidence": self.validation_service.min_confidence  # NEW
            }
        }
        
        # Cache result
        cache_service.set(cache_key, result, upload_type)
        
        logger.info(
            f"✅ Analysis complete in {result['metadata']['processing_time']:.2f}s. "
            f"Cost: ${cost_estimate:.6f}"
        )
        
        return result
    
    def _extract_original_code(self, files_data: List[Dict[str, str]]) -> str:
        """Extract all code content for validation"""
        code_parts = []
        for file_data in files_data:
            code_parts.append(file_data['content'])
        return "\n\n".join(code_parts)
    
    def _build_prompt(self, files_data: List[Dict[str, str]]) -> str:
        """Build prompt from files"""
        # Format files for prompt
        code_files_str = ""
        for idx, file_data in enumerate(files_data, 1):
            code_files_str += f"\n## File {idx}: {file_data['path']}\n"
            code_files_str += f"```{file_data.get('extension', '').lstrip('.')}\n"
            code_files_str += file_data['content']
            code_files_str += "\n```\n"
        
        return self.prompt_template.format(code_files=code_files_str)
    
    def _parse_issues(self, issues_raw: List[Dict]) -> List[CodeIssue]:
        """Parse issues into Pydantic models"""
        issues = []
        for issue in issues_raw:
            try:
                # Ensure confidence field exists
                if "confidence" not in issue:
                    issue["confidence"] = 0.8  # Default confidence
                issues.append(CodeIssue(**issue))
            except Exception as e:
                logger.warning(f"Failed to parse issue: {e}")
        return issues
    
    def _build_summary(self, llm_summary: Dict, stats: Dict) -> AnalysisSummary:
        """Build summary with file stats"""
        return AnalysisSummary(
            total_issues=llm_summary.get("total_issues", 0),
            critical=llm_summary.get("critical", 0),
            warnings=llm_summary.get("warnings", 0),
            info=llm_summary.get("info", 0),
            files_analyzed=stats["total_files"],
            total_lines=stats["total_lines"],
            languages_detected=stats["languages"]
        )


# Global instance
modernization_engine = ModernizationEngine()