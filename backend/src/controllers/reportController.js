const path = require('path');
const fs = require('fs').promises;
const Job = require('../models/Job');

/**
 * @route   GET /api/reports/:jobId
 * @desc    Get report for a job
 * @access  Private
 */
const getReport = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Ensure user owns this job
    if (job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this report'
      });
    }

    // Check job status
    if (job.status === 'pending' || job.status === 'processing') {
      return res.status(202).json({
        success: false,
        message: `Job is still ${job.status}. Please wait for analysis to complete.`,
        status: job.status
      });
    }

    if (job.status === 'failed') {
      return res.status(500).json({
        success: false,
        message: 'Job analysis failed',
        error: job.errorMessage
      });
    }

    // Check if report exists
    if (!job.reportPath) {
      return res.status(404).json({
        success: false,
        message: 'Report not yet generated for this job',
        hint: 'This may happen for cached results. Try re-analyzing with force_refresh=true'
      });
    }

    // Check if report file actually exists
    const fs = require('fs').promises;
    try {
      await fs.access(job.reportPath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found on disk',
        reportPath: job.reportPath,
        hint: 'The report may have been deleted. Try re-analyzing the code.'
      });
    }

    // Read report file
    const reportContent = await fs.readFile(job.reportPath, 'utf-8');

    res.status(200).json({
      success: true,
      data: {
        jobId: job._id,
        fileName: job.fileName,
        reportContent,
        format: path.extname(job.reportPath).substring(1), // md or pdf
        generatedAt: job.completedAt,
        metadata: {
          totalIssues: job.metadata?.totalIssues || 0,
          critical: job.metadata?.critical || 0,
          warnings: job.metadata?.warnings || 0,
          cached: job.metadata?.cached || false
        }
      }
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report'
    });
  }
};

/**
 * @route   GET /api/reports/:jobId/download
 * @desc    Download report file
 * @access  Private
 */
const downloadReport = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    // Ensure user owns this job
    if (job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to download this report'
      });
    }

    // Check if report exists
    if (!job.reportPath) {
      return res.status(404).json({
        success: false,
        message: 'Report not yet generated for this job'
      });
    }

    // Send file for download
    res.download(job.reportPath, `report-${job._id}${path.extname(job.reportPath)}`);
  } catch (error) {
    console.error('Download report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download report'
    });
  }
};

module.exports = {
  getReport,
  downloadReport
};