import os
from datetime import datetime
from typing import Dict, Any
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import logging

logger = logging.getLogger(__name__)

class ReportService:
    """Service for generating Markdown and PDF reports"""
    
    def __init__(self):
        self.storage = None  # Will be injected
    
    def set_storage(self, storage_service):
        """Inject storage service dependency"""
        self.storage = storage_service
    
    async def generate_markdown(self, analysis_data: Dict[str, Any], job_id: str) -> str:
        """
        Generate Markdown report and upload to storage
        
        Args:
            analysis_data: Analysis results
            job_id: Job ID
            
        Returns:
            File ID in storage system (GridFS ID, S3 key, etc.)
        """
        try:
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"report_{job_id}_{timestamp}.md"
            
            # Build markdown content
            md_content = self._build_markdown_content(analysis_data, job_id)
            
            # ============================================================
            # UPLOAD TO STORAGE (GridFS, S3, etc.) - NOT LOCAL FILESYSTEM
            # ============================================================
            if not self.storage:
                # Fallback: Save locally if storage not available
                logger.warning("⚠️ Storage service not available. Saving locally.")
                return self._save_local_fallback(filename, md_content)
            
            # Upload to storage backend
            logger.info(f"📤 Uploading report to {self.storage.backend_type}: {filename}")
            file_id = await self.storage.write_file(
                filename=filename,
                content=md_content.encode('utf-8'),
                content_type='text/markdown'
            )
            
            logger.info(f"✅ Report uploaded to storage: {file_id}")
            
            # Return file ID (GridFS ObjectId, S3 key, etc.)
            return file_id
            
        except Exception as e:
            logger.error(f"❌ Failed to generate/upload report: {e}")
            raise
    
    def _save_local_fallback(self, filename: str, content: str) -> str:
        """Fallback: Save locally and return path (for backward compatibility)"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        reports_dir = os.path.abspath(os.path.join(current_dir, "../../../reports"))
        os.makedirs(reports_dir, exist_ok=True)
        
        filepath = os.path.abspath(os.path.join(reports_dir, filename))
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        logger.info(f"✅ Report saved locally: {filepath}")
        return filepath
    
    def _build_markdown_content(self, data: Dict[str, Any], job_id: str) -> str:
        """Build markdown report content"""
        summary = data.get("summary", {})
        issues = data.get("issues", [])
        analysis = data.get("analysis", {})
        metadata = data.get("metadata", {})
        
        md = f"""# Legacy Code Modernization Report

**Job ID:** `{job_id}`  
**Generated:** {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}  
**Model:** {metadata.get('model', 'N/A')}  
**Processing Time:** {metadata.get('processing_time', 0):.2f}s  
**Cost:** ${metadata.get('cost_estimate', 0):.6f}

---

## Executive Summary

- **Files Analyzed:** {summary.get('files_analyzed', 0)}
- **Total Lines:** {summary.get('total_lines', 0):,}
- **Languages Detected:** {', '.join(summary.get('languages_detected', []))}

### Issues Found

- **Total Issues:** {summary.get('total_issues', 0)}
- **Critical:** {summary.get('critical', 0)} 🔴
- **Warnings:** {summary.get('warnings', 0)} 🟡
- **Info:** {summary.get('info', 0)} 🔵

---

## Critical Issues

"""
        
        # Add critical issues
        critical_issues = [i for i in issues if i.get('severity') == 'critical']
        if critical_issues:
            for idx, issue in enumerate(critical_issues, 1):
                md += f"""
### {idx}. {issue.get('message', 'N/A')}

**Type:** {issue.get('type', 'N/A').title()}  
**File:** `{issue.get('file', 'N/A')}`  
**Line:** {issue.get('line', 'N/A')}

**Issue:**
```
{issue.get('code_snippet', 'No code snippet available')}
```

**Recommendation:**
{issue.get('suggestion', 'No suggestion available')}

**Fixed Code:**
```
{issue.get('fixed_code', 'No fix provided')}
```

---
"""
        else:
            md += "\n*No critical issues found.*\n\n"
        
        # Add warnings
        md += "\n## Warnings\n\n"
        warning_issues = [i for i in issues if i.get('severity') == 'warning']
        if warning_issues:
            for idx, issue in enumerate(warning_issues, 1):
                md += f"""
### {idx}. {issue.get('message', 'N/A')}

**File:** `{issue.get('file', 'N/A')}` (Line {issue.get('line', 'N/A')})  
**Suggestion:** {issue.get('suggestion', 'No suggestion')}

---
"""
        else:
            md += "\n*No warnings found.*\n\n"
        
        # Add recommendations
        recommendations = analysis.get('recommendations', [])
        if recommendations:
            md += "\n## General Recommendations\n\n"
            for idx, rec in enumerate(recommendations, 1):
                md += f"{idx}. {rec}\n"
        
        # Add footer
        md += f"""

---

## Metadata

- **Cached Result:** {'Yes' if metadata.get('cached') else 'No'}
- **Tokens Used:** {metadata.get('tokens_used', 0):,}
- **Model Provider:** {metadata.get('model', 'N/A').split('-')[0].title()}
- **Storage Backend:** {metadata.get('storage_backend', 'N/A').upper()}

---

*Generated by Legacy Code Modernization Assistant*
"""
        
        return md
    
    async def generate_pdf(self, analysis_data: Dict[str, Any], job_id: str) -> str:
        """
        Generate PDF report and upload to storage
        
        Args:
            analysis_data: Analysis results
            job_id: Job ID
            
        Returns:
            File ID in storage system
        """
        try:
            # Generate filename
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"report_{job_id}_{timestamp}.pdf"
            
            # Create PDF in memory
            import io
            pdf_buffer = io.BytesIO()
            
            doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
            styles = getSampleStyleSheet()
            story = []
            
            metadata = analysis_data.get('metadata', {})
            summary = analysis_data.get('summary', {})
            
            # Title
            title_style = ParagraphStyle(
                'CustomTitle',
                parent=styles['Heading1'],
                fontSize=24,
                textColor='#333333',
                spaceAfter=30,
            )
            story.append(Paragraph("Legacy Code Modernization Report", title_style))
            story.append(Spacer(1, 0.2 * inch))
            
            # Metadata
            meta_text = f"""
            <b>Job ID:</b> {job_id}<br/>
            <b>Generated:</b> {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}<br/>
            <b>Files Analyzed:</b> {summary.get('files_analyzed', 0)}<br/>
            <b>Total Issues:</b> {summary.get('total_issues', 0)}<br/>
            <b>Cost:</b> ${metadata.get('cost_estimate', 0):.6f}
            """
            story.append(Paragraph(meta_text, styles['Normal']))
            story.append(Spacer(1, 0.3 * inch))
            
            # Issues summary
            story.append(Paragraph("Issues Summary", styles['Heading2']))
            issues_summary = f"""
            <b>Critical:</b> {summary.get('critical', 0)}<br/>
            <b>Warnings:</b> {summary.get('warnings', 0)}<br/>
            <b>Info:</b> {summary.get('info', 0)}
            """
            story.append(Paragraph(issues_summary, styles['Normal']))
            story.append(Spacer(1, 0.3 * inch))
            
            # Critical issues
            issues = analysis_data.get('issues', [])
            critical_issues = [i for i in issues if i.get('severity') == 'critical']
            
            if critical_issues:
                story.append(Paragraph("Critical Issues", styles['Heading2']))
                for idx, issue in enumerate(critical_issues, 1):
                    issue_text = f"""
                    <b>{idx}. {issue.get('message', 'N/A')}</b><br/>
                    <b>File:</b> {issue.get('file', 'N/A')} (Line {issue.get('line', 'N/A')})<br/>
                    <b>Suggestion:</b> {issue.get('suggestion', 'No suggestion')}
                    """
                    story.append(Paragraph(issue_text, styles['Normal']))
                    story.append(Spacer(1, 0.2 * inch))
            
            # Build PDF
            doc.build(story)
            
            # Get PDF bytes
            pdf_bytes = pdf_buffer.getvalue()
            pdf_buffer.close()
            
            # Upload to storage
            if not self.storage:
                logger.warning("⚠️ Storage service not available. Saving PDF locally.")
                return self._save_pdf_local_fallback(filename, pdf_bytes)
            
            logger.info(f"📤 Uploading PDF to {self.storage.backend_type}: {filename}")
            file_id = await self.storage.write_file(
                filename=filename,
                content=pdf_bytes,
                content_type='application/pdf'
            )
            
            logger.info(f"✅ PDF uploaded to storage: {file_id}")
            return file_id
            
        except Exception as e:
            logger.error(f"❌ Failed to generate/upload PDF: {e}")
            raise
    
    def _save_pdf_local_fallback(self, filename: str, content: bytes) -> str:
        """Fallback: Save PDF locally"""
        current_dir = os.path.dirname(os.path.abspath(__file__))
        reports_dir = os.path.abspath(os.path.join(current_dir, "../../../reports"))
        os.makedirs(reports_dir, exist_ok=True)
        
        filepath = os.path.abspath(os.path.join(reports_dir, filename))
        
        with open(filepath, 'wb') as f:
            f.write(content)
        
        logger.info(f"✅ PDF saved locally: {filepath}")
        return filepath

# Global instance
report_service = ReportService()