import os
from typing import List, Dict, Tuple
import logging

logger = logging.getLogger(__name__)

class FileReader:
    """Utility for reading and processing code files"""
    
    # Code file extensions to process
    CODE_EXTENSIONS = {
        '.js', '.jsx', '.ts', '.tsx',  # JavaScript/TypeScript
        '.py', '.pyw',                  # Python
        '.java',                        # Java
        '.go',                          # Go
        '.rb',                          # Ruby
        '.php',                         # PHP
        '.cs',                          # C#
        '.cpp', '.c', '.h',             # C/C++
        '.rs',                          # Rust
        '.swift',                       # Swift
        '.kt',                          # Kotlin
        '.scala',                       # Scala
        '.sql',                         # SQL
        '.sh', '.bash',                 # Shell
        '.html', '.css',                # Web
        '.json', '.yaml', '.yml', '.xml', # Config
        '.cbl', '.cob', '.cpy', '.CBL', '.COB', '.CPY', #COBOL
    }
    
    # Directories to skip
    SKIP_DIRS = {
        'node_modules', '__pycache__', '.git', '.svn',
        'venv', 'env', 'dist', 'build', 'target',
        '.idea', '.vscode', 'coverage'
    }
    
    @staticmethod
    def read_file(file_path: str) -> Tuple[str, str]:
        """
        Read single file
        
        Args:
            file_path: Path to file
            
        Returns:
            Tuple of (file_name, content)
        """
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            return os.path.basename(file_path), content
        except UnicodeDecodeError:
            logger.warning(f"Skipping binary file: {file_path}")
            return os.path.basename(file_path), ""
        except Exception as e:
            logger.error(f"Error reading file {file_path}: {e}")
            return os.path.basename(file_path), ""
    
    @staticmethod
    def read_directory(dir_path: str, max_files: int = 100) -> List[Dict[str, str]]:
        """
        Read all code files in directory
        
        Args:
            dir_path: Path to directory
            max_files: Maximum number of files to read
            
        Returns:
            List of dicts with file info
        """
        files_data = []
        file_count = 0
        
        for root, dirs, files in os.walk(dir_path):
            # Skip unwanted directories
            dirs[:] = [d for d in dirs if d not in FileReader.SKIP_DIRS]
            
            for file in sorted(files):
                if file_count >= max_files:
                    logger.warning(f"Reached max file limit ({max_files}). Stopping.")
                    return files_data
                
                # Skip hidden files
                if file.startswith('.'):
                    continue
                
                # Check extension
                _, ext = os.path.splitext(file)
                if ext.lower() not in FileReader.CODE_EXTENSIONS:
                    continue
                
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, dir_path)
                
                _, content = FileReader.read_file(file_path)
                if content:  # Only add non-empty files
                    files_data.append({
                        "path": relative_path,
                        "name": file,
                        "extension": ext,
                        "content": content,
                        "lines": len(content.split('\n'))
                    })
                    file_count += 1
        
        logger.info(f"Read {len(files_data)} files from {dir_path}")
        return files_data
    
    @staticmethod
    def detect_languages(files_data: List[Dict[str, str]]) -> List[str]:
        """
        Detect programming languages in files
        
        Args:
            files_data: List of file data dicts
            
        Returns:
            List of detected languages
        """
        extension_to_language = {
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.go': 'Go',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.cs': 'C#',
            '.cpp': 'C++',
            '.c': 'C',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.sql': 'SQL',
            '.sh': 'Shell',
            '.html': 'HTML',
            '.css': 'CSS',
            '.cbl': 'COBOL',  
            '.cob': 'COBOL',  
            '.CBL': 'COBOL',
            '.COB': 'COBOL',
        }
        
        languages = set()
        for file_data in files_data:
            ext = file_data.get('extension', '').lower()
            if ext in extension_to_language:
                languages.add(extension_to_language[ext])
        
        return sorted(list(languages))
    
    @staticmethod
    def get_file_stats(files_data: List[Dict[str, str]]) -> Dict[str, int]:
        """
        Get statistics about files
        
        Args:
            files_data: List of file data dicts
            
        Returns:
            Dict with statistics
        """
        total_lines = sum(file_data.get('lines', 0) for file_data in files_data)
        
        return {
            "total_files": len(files_data),
            "total_lines": total_lines,
            "languages": FileReader.detect_languages(files_data)
        }

# Global instance
file_reader = FileReader()