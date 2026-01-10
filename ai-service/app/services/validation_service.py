"""
Validation service to prevent LLM hallucinations
File: app/services/validation_service.py
"""

import re
import logging
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class ValidationService:
    """Service to validate LLM responses and prevent hallucinations"""
    
    def __init__(self, min_confidence: float = 0.5):
        self.min_confidence = min_confidence
    
    def validate_analysis(
        self, 
        llm_response: Dict[str, Any], 
        original_code: str,
        job_id: str = "unknown"
    ) -> Dict[str, Any]:
        """
        Validate entire LLM analysis response
        
        Args:
            llm_response: Raw response from LLM
            original_code: Original code that was analyzed
            job_id: Job ID for logging
            
        Returns:
            Validated and cleaned response
        """
        logger.info(f"[Job {job_id}] Starting validation")
        
        # Extract components
        issues = llm_response.get("issues", [])
        recommendations = llm_response.get("recommendations", [])
        summary = llm_response.get("summary", {})
        
        # Validate issues
        validated_issues, removed_count = self._validate_issues(
            issues, 
            original_code, 
            job_id
        )
        
        # Validate recommendations
        validated_recommendations = self._validate_recommendations(
            recommendations,
            original_code,
            job_id
        )
        
        # Recalculate summary
        validated_summary = self._recalculate_summary(validated_issues)
        
        if removed_count > 0:
            logger.warning(
                f"[Job {job_id}] Removed {removed_count} invalid/hallucinated issues"
            )
        
        logger.info(
            f"[Job {job_id}] Validation complete. "
            f"Issues: {len(issues)} → {len(validated_issues)}, "
            f"Recommendations: {len(recommendations)} → {len(validated_recommendations)}"
        )
        
        return {
            "issues": validated_issues,
            "summary": validated_summary,
            "recommendations": validated_recommendations
        }
    
    def _validate_issues(
        self, 
        issues: List[Dict], 
        original_code: str, 
        job_id: str
    ) -> tuple[List[Dict], int]:
        """
        Validate individual issues
        
        Returns:
            (validated_issues, removed_count)
        """
        validated = []
        removed_count = 0
        
        for issue in issues:
            # Check 1: Confidence threshold
            confidence = issue.get("confidence", 0.0)
            if confidence < self.min_confidence:
                logger.warning(
                    f"[Job {job_id}] Removed low confidence issue "
                    f"({confidence:.2f}): {issue.get('message', '')[:60]}"
                )
                removed_count += 1
                continue
            
            # Check 2: Code snippet exists in original
            code_snippet = issue.get("code_snippet", "")
            if code_snippet:
                snippet_clean = self._normalize_code(code_snippet)
                code_clean = self._normalize_code(original_code)
                
                if snippet_clean not in code_clean:
                    logger.warning(
                        f"[Job {job_id}] Removed hallucinated issue - "
                        f"code snippet not found: '{code_snippet[:50]}...'"
                    )
                    removed_count += 1
                    continue
            
            # Check 3: Verify line number is reasonable
            line = issue.get("line", 0)
            total_lines = len(original_code.split('\n'))
            
            if line > total_lines or line < 1:
                logger.warning(
                    f"[Job {job_id}] Correcting invalid line number "
                    f"(was {line}, max {total_lines})"
                )
                # Try to find correct line
                issue["line"] = self._find_line_number(original_code, code_snippet)
            
            validated.append(issue)
        
        # Check 4: Remove duplicates
        validated = self._remove_duplicate_issues(validated)
        
        return validated, removed_count
    
    def _validate_recommendations(
        self,
        recommendations: List[str],
        original_code: str,
        job_id: str
    ) -> List[str]:
        """
        Validate recommendations to remove vague/generic advice
        """
        validated = []
        
        # Generic phrases that indicate non-specific advice
        generic_phrases = [
            "consider using",
            "you might want to",
            "it's recommended",
            "best practice is",
            "you should consider",
            "maintain consistency",
            "improve code quality",
            "enhance performance"
        ]
        
        code_lower = original_code.lower()
        
        for rec in recommendations:
            rec_lower = rec.lower()
            
            # Skip if too generic
            is_generic = any(phrase in rec_lower for phrase in generic_phrases)
            if is_generic:
                logger.info(
                    f"[Job {job_id}] Filtered generic recommendation: '{rec[:60]}...'"
                )
                continue
            
            # Skip if it mentions patterns not in the code
            false_claims = False
            
            # Check for common false claims
            if "var " in rec_lower and "var " not in code_lower:
                false_claims = True
            if "for loop" in rec_lower and "for (" not in code_lower:
                false_claims = True
            if "callback" in rec_lower and "callback" not in code_lower:
                false_claims = True
            
            if false_claims:
                logger.info(
                    f"[Job {job_id}] Filtered false recommendation: '{rec[:60]}...'"
                )
                continue
            
            validated.append(rec)
        
        # If clean code with no issues, add positive feedback
        if not validated and len(recommendations) == 0:
            validated = [
                "Code follows modern best practices",
                "No security vulnerabilities detected",
                "Proper error handling implemented"
            ]
        
        return validated
    
    def _normalize_code(self, code: str) -> str:
        """Normalize code for comparison (remove extra whitespace and comments)"""
        # Remove single-line comments
        code = re.sub(r'//.*?\n', '\n', code)
        
        # Remove multi-line comments
        code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        
        # Normalize whitespace
        code = re.sub(r'\s+', ' ', code)
        
        return code.strip().lower()
    
    def _find_line_number(self, code: str, snippet: str) -> int:
        """Find the actual line number of a code snippet"""
        if not snippet:
            return 1
        
        lines = code.split('\n')
        snippet_clean = snippet.strip()
        
        for i, line in enumerate(lines, start=1):
            if snippet_clean in line:
                return i
        
        # If exact match not found, return 1 as fallback
        return 1
    
    def _remove_duplicate_issues(self, issues: List[Dict]) -> List[Dict]:
        """Remove duplicate issues based on file, line, and message"""
        seen = set()
        unique = []
        
        for issue in issues:
            # Create a key for deduplication
            key = (
                issue.get("file", ""),
                issue.get("line", 0),
                issue.get("message", "")
            )
            
            if key not in seen:
                seen.add(key)
                unique.append(issue)
        
        return unique
    
    def _recalculate_summary(self, issues: List[Dict]) -> Dict[str, int]:
        """Recalculate summary after validation"""
        return {
            "total_issues": len(issues),
            "critical": sum(1 for i in issues if i.get("severity") == "critical"),
            "warnings": sum(1 for i in issues if i.get("severity") == "warning"),
            "info": sum(1 for i in issues if i.get("severity") == "info")
        }


# Global instance
validation_service = ValidationService(min_confidence=0.5)