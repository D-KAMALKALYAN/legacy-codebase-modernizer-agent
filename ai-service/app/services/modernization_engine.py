"""
Core engine for code modernization analysis - STORAGE-AGNOSTIC
Works with ANY storage backend (GridFS, S3, Local)
Supports: snippets, folders, and ZIP files
"""

import os
import time
import zipfile
import io
from typing import Dict, Any, List
from datetime import datetime
import logging

from app.config import settings
from app.services.cache_service import cache_service
from app.services.llm_service import llm_service
from app.services.validation_service import validation_service
from app.storage.storage_service import storage_service
from app.utils.token_counter import token_counter
from app.models.schemas import CodeIssue, AnalysisSummary, AnalysisMetadata

logger = logging.getLogger(__name__)


class ModernizationEngine:
    """Core engine for code modernization analysis"""
    
    def __init__(self):
        self.prompt_template = self._load_prompt_template()
        self.llm_service = llm_service
        self.validation_service = validation_service
        self.storage = storage_service
    
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
        file_id: str,
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
            if upload_type == "zip":
                # For ZIP files, read as binary and extract
                file_content_bytes = await self.storage.read_file(file_id)
                files_data = await self._extract_zip(file_content_bytes)
                
                if not files_data:
                    raise ValueError("No code files found in ZIP archive")
                
                # Combine all code for caching
                code_content = "\n\n".join(f['content'] for f in files_data)
                logger.info(f"✅ Extracted {len(files_data)} files from ZIP")
                
            else:
                # For snippet uploads, read as text
                try:
                    code_content = await self.storage.read_file_as_text(file_id)
                    files_data = [{
                        "path": file_id,
                        "name": f"uploaded_{upload_type}",
                        "content": code_content,
                        "lines": len(code_content.split('\n'))
                    }]
                    logger.info(f"✅ File loaded: {len(code_content)} characters")
                    
                except ValueError as e:
                    # Handle case where snippet is accidentally binary
                    logger.error(f"❌ Storage read error: {e}")
                    raise ValueError(
                        f"Unable to read file as text: {str(e)}. "
                        f"If this is a ZIP file, please use upload_type='zip'"
                    )
        
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found in storage: {file_id}")
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"❌ Storage read error: {e}")
            raise
        
        # ============================================================
        # STEP 2: GENERATE CACHE KEY FROM CONTENT
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
                "storage_backend": self.storage.backend_type
            }
        }
        
        # Cache result
        cache_service.set(cache_key, result, upload_type)
        
        logger.info(
            f"✅ Analysis complete in {result['metadata']['processing_time']:.2f}s. "
            f"Cost: ${cost_estimate:.6f}"
        )
        
        return result
    
    async def _extract_zip(self, zip_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Extract code files from ZIP archive
        
        Args:
            zip_bytes: ZIP file content as bytes
            
        Returns:
            List of file data dictionaries
        """
        files_data = []
        
        try:
            with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zip_ref:
                for file_info in zip_ref.filelist:
                    # Skip directories
                    if file_info.is_dir():
                        continue
                    
                    # Only process code files
                    if not self._is_code_file(file_info.filename):
                        logger.debug(f"⏭️  Skipping non-code file: {file_info.filename}")
                        continue
                    
                    # Skip files that are too large (> 1MB)
                    if file_info.file_size > 1_000_000:
                        logger.warning(f"⚠️  Skipping large file: {file_info.filename} ({file_info.file_size} bytes)")
                        continue
                    
                    content_bytes = zip_ref.read(file_info.filename)
                    
                    # Try to decode as text with multiple encodings
                    content = None
                    for encoding in ['utf-8', 'latin-1', 'cp1252', 'iso-8859-1']:
                        try:
                            content = content_bytes.decode(encoding)
                            break
                        except UnicodeDecodeError:
                            continue
                    
                    if content is None:
                        logger.warning(f"⚠️  Skipping binary file: {file_info.filename}")
                        continue
                    
                    files_data.append({
                        "path": file_info.filename,
                        "name": os.path.basename(file_info.filename),
                        "content": content,
                        "lines": len(content.split('\n')),
                        "size": file_info.file_size
                    })
                    
                    logger.info(f"✅ Extracted: {file_info.filename} ({file_info.file_size} bytes)")
        
            logger.info(f"📦 Extracted {len(files_data)} code files from ZIP")
            return files_data
            
        except zipfile.BadZipFile:
            raise ValueError("Invalid ZIP file format")
        except Exception as e:
            logger.error(f"❌ ZIP extraction error: {e}")
            raise ValueError(f"Failed to extract ZIP file: {str(e)}")
    
    def _is_code_file(self, filename: str) -> bool:
        """
        Check if file is a code file based on extension
        
        Args:
            filename: File name to check
            
        Returns:
            True if it's a code file
        """
        code_extensions = {
            # Web/JavaScript
            '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
            '.vue', '.svelte',
            
            # Python
            '.py', '.pyw', '.pyx',
            
            # Java/JVM
            '.java', '.kt', '.scala', '.groovy',
            
            # C/C++
            '.c', '.cpp', '.cc', '.cxx', '.h', '.hpp', '.hxx',
            
            # C#/.NET
            '.cs', '.vb', '.fs',
            
            # Go
            '.go',
            
            # Rust
            '.rs',
            
            # Ruby
            '.rb', '.rake',
            
            # PHP
            '.php', '.phtml',
            
            # Swift/Objective-C
            '.swift', '.m', '.mm',
            
            # Shell/Scripting
            '.sh', '.bash', '.zsh', '.fish',
            
            # SQL
            '.sql',
            
            # Legacy/COBOL
            '.cbl', '.cob', '.cobol',
            
            # Other
            '.pl', '.pm', '.r', '.lua', '.dart',
            
            # Config (sometimes contains code)
            '.json', '.yaml', '.yml', '.toml'
        }
        
        filename_lower = filename.lower()
        return any(filename_lower.endswith(ext) for ext in code_extensions)
    
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
            filename = file_data.get('path', '').lower()
            
            # Extension-based detection first
            if filename.endswith(('.ts', '.tsx')):
                detected.add('typescript')
            elif filename.endswith(('.js', '.jsx', '.mjs')):
                detected.add('javascript')
            elif filename.endswith('.py'):
                detected.add('python')
            elif filename.endswith('.java'):
                detected.add('java')
            elif filename.endswith(('.c', '.h')):
                detected.add('c')
            elif filename.endswith(('.cpp', '.cc', '.cxx', '.hpp')):
                detected.add('cpp')
            elif filename.endswith('.go'):
                detected.add('go')
            elif filename.endswith('.rs'):
                detected.add('rust')
            elif filename.endswith('.rb'):
                detected.add('ruby')
            elif filename.endswith('.php'):
                detected.add('php')
            elif filename.endswith(('.cbl', '.cob', '.cobol')):
                detected.add('cobol')
            
            # Content-based fallback detection
            elif not detected:
                if any(keyword in content for keyword in ['function', 'const ', 'let ', 'var ', '=>']):
                    if 'interface ' in content or ': string' in content:
                        detected.add('typescript')
                    else:
                        detected.add('javascript')
                elif any(keyword in content for keyword in ['def ', 'import ', 'class ', 'print(']):
                    detected.add('python')
                elif 'public class' in content or 'System.out' in content:
                    detected.add('java')
        
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