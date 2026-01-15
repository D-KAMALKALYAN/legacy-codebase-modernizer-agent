"""
Core engine for code modernization analysis - STORAGE-AGNOSTIC
Works with ANY storage backend (GridFS, S3, Local)
"""

import os
import time
from typing import Dict, Any, List
from datetime import datetime
import logging

from app.config import settings
from app.services.cache_service import cache_service
from app.services.llm_service import llm_service
from app.services.validation_service import validation_service
from app.storage.storage_service import storage_service  # ✅ NEW: Abstract storage
from app.utils.token_counter import token_counter
from app.models.schemas import CodeIssue, AnalysisSummary, AnalysisMetadata

logger = logging.getLogger(__name__)


class ModernizationEngine:
    """Core engine for code modernization analysis"""
    
    def __init__(self):
        self.prompt_template = self._load_prompt_template()
        self.llm_service = llm_service
        self.validation_service = validation_service
        self.storage = storage_service  # ✅ NEW
    
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
            return "Analyze this code and return JSON with issues, summary, and recommendations:\n\n{code_files}"
    
    async def analyze(
        self,
        file_id: str,  # ✅ CHANGED: Now accepts file_id instead of file_path
        upload_type: str,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Main analysis entry point - STORAGE-AGNOSTIC
        
        Args:
            file_id: Storage file ID (GridFS ID, S3 key, local path, etc.)
            upload_type: Type: snippet, folder, zip
            force_refresh: Skip cache if True
            
        Returns:
            Analysis results dict
        """
        start_time = time.time()
        
        # ============================================================
        # STEP 1: READ FILE FROM STORAGE
        # ============================================================
        logger.info(f"📖 Reading file from storage: {file_id}")
        try:
            code_content = await self.storage.read_file_as_text(file_id)
            logger.info(f"✅ File loaded: {len(code_content)} characters")
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found in storage: {file_id}")
        except Exception as e:
            logger.error(f"❌ Storage read error: {e}")
            raise
        
        # ============================================================
        # STEP 2: GENERATE CACHE KEY FROM CONTENT (not file_id)
        # ============================================================
        cache_key = cache_service.generate_cache_key(code_content, upload_type)
        logger.info(f"🔑 Cache key: {cache_key[:60]}...")
        
        # ============================================================
        # STEP 3: CHECK CACHE
        # ============================================================
        if not force_refresh:
            cached_result = cache_service.get(cache_key)
            if cached_result:
                logger.info("✅ Returning cached analysis result")
                cached_result["metadata"]["cached"] = True
                cached_result["metadata"]["processing_time"] = time.time() - start_time
                cached_result["metadata"]["storage_backend"] = self.storage.backend_type
                return cached_result
        
        # Parse file data (for V1, treating everything as single file)
        # In V2, we'll handle ZIP extraction and folder structures
        files_data = [{
            "path": file_id,
            "name": f"uploaded_{upload_type}",
            "content": code_content,
            "lines": len(code_content.split('\n'))
        }]
        
        if not files_data:
            raise ValueError("No valid code files found to analyze")
        
        # Get file stats
        stats = self._get_file_stats(files_data)
        
        # Build prompt
        prompt = self._build_prompt(files_data)
        
        # Store original code for validation
        original_code = self._extract_original_code(files_data)
        
        # Count tokens
        input_tokens = token_counter.count_tokens(prompt)
        logger.info(f"Prompt tokens: {input_tokens}")
        
        # Check token limit
        if input_tokens > settings.MAX_TOKENS_PER_REQUEST:
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
        
        # Validate LLM response
        validated_response = self.validation_service.validate_analysis(
            llm_response=llm_response,
            original_code=original_code,
            job_id=cache_key[:8]
        )
        
        # Calculate cost
        cost_estimate = token_counter.estimate_cost(
            input_tokens,
            output_tokens,
            llm_metadata.get("model")
        )
        
        # Build response with validated data
        result = {
            "analysis": validated_response,
            "issues": [
                issue if isinstance(issue, dict) else issue.model_dump() 
                for issue in self._parse_issues(validated_response.get("issues", []))
            ],
            "summary": self._build_summary(
                validated_response.get("summary", {}),
                stats
            ).model_dump(),
            "metadata": {
                "cached": False,
                "cached_at": None,
                "tokens_used": total_tokens,
                "model": llm_metadata.get("model", settings.OPENAI_MODEL),
                "processing_time": time.time() - start_time,
                "cost_estimate": cost_estimate,
                "validation_applied": True,
                "min_confidence": self.validation_service.min_confidence,
                "storage_backend": self.storage.backend_type  # ✅ NEW
            }
        }
        
        # Cache result
        cache_service.set(cache_key, result, upload_type)
        
        logger.info(
            f"✅ Analysis complete in {result['metadata']['processing_time']:.2f}s. "
            f"Cost: ${cost_estimate:.6f}"
        )
        
        return result
    
    def _get_file_stats(self, files_data: List[Dict[str, str]]) -> Dict:
        """Get file statistics with proper language detection"""
        total_lines = sum(f['lines'] for f in files_data)
        
        # Detect languages from file content
        languages = self._detect_languages(files_data)
        
        return {
            "total_files": len(files_data),
            "total_lines": total_lines,
            "languages": languages
        }
    
    def _detect_languages(self, files_data: List[Dict[str, str]]) -> List[str]:
        """
        Detect programming languages from code content
        Simple heuristic-based detection for V1
        """
        detected = set()
        
        for file_data in files_data:
            content = file_data.get('content', '').lower()
            
            # JavaScript/TypeScript detection
            if any(keyword in content for keyword in ['function', 'const ', 'let ', 'var ', '=>', 'console.log']):
                if 'interface ' in content or 'type ' in content or ': string' in content:
                    detected.add('typescript')
                else:
                    detected.add('javascript')
            
            # Python detection
            elif any(keyword in content for keyword in ['def ', 'import ', 'class ', 'print(', '__init__']):
                detected.add('python')
            
            # Java detection
            elif any(keyword in content for keyword in ['public class', 'private ', 'void ', 'System.out']):
                detected.add('java')
            
            # C/C++ detection
            elif any(keyword in content for keyword in ['#include', 'int main', 'printf(', 'std::']):
                if 'std::' in content or 'cout' in content:
                    detected.add('cpp')
                else:
                    detected.add('c')
            
            # Go detection
            elif any(keyword in content for keyword in ['func ', 'package ', 'import (', 'fmt.Print']):
                detected.add('go')
            
            # Ruby detection
            elif any(keyword in content for keyword in ['def ', 'end', 'puts ', 'require ']):
                detected.add('ruby')
            
            # PHP detection
            elif '<?php' in content or '$_' in content:
                detected.add('php')
            
            # Rust detection
            elif any(keyword in content for keyword in ['fn ', 'let mut', 'impl ', 'use std::']):
                detected.add('rust')
        
        # If no language detected, return "unknown"
        return list(detected) if detected else ['unknown']
    
    def _extract_original_code(self, files_data: List[Dict[str, str]]) -> str:
        """Extract all code content for validation"""
        code_parts = []
        for file_data in files_data:
            code_parts.append(file_data['content'])
        return "\n\n".join(code_parts)
    
    def _build_prompt(self, files_data: List[Dict[str, str]]) -> str:
        """Build prompt from files"""
        code_files_str = ""
        for idx, file_data in enumerate(files_data, 1):
            code_files_str += f"\n## File {idx}: {file_data['path']}\n"
            code_files_str += f"```\n"
            code_files_str += file_data['content']
            code_files_str += "\n```\n"
        
        return self.prompt_template.format(code_files=code_files_str)
    
    def _parse_issues(self, issues_raw: List[Dict]) -> List[CodeIssue]:
        """Parse issues into Pydantic models"""
        issues = []
        for issue in issues_raw:
            try:
                if "confidence" not in issue:
                    issue["confidence"] = 0.8
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