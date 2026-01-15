const mongoose = require('mongoose');
const { GridFSBucket } = require('mongoose').mongo;
const Job = require('../models/Job');

// Initialize GridFS
let gridfsBucket;
mongoose.connection.on('open', () => {
  gridfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads' // Collection name for GridFS
  });
});

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
    if (!job.reportId) {
      return res.status(404).json({
        success: false,
        message: 'Report not yet generated for this job',
        hint: 'This may happen for cached results. Try re-analyzing with force_refresh=true'
      });
    }

    // Find the file in GridFS
    const files = await gridfsBucket.find({ _id: new mongoose.Types.ObjectId(job.reportId) }).toArray();
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found in storage',
        hint: 'The report may have been deleted. Try re-analyzing the code.'
      });
    }

    // Read report content
    const downloadStream = gridfsBucket.openDownloadStream(new mongoose.Types.ObjectId(job.reportId));
    let reportContent = '';
    downloadStream.on('data', (chunk) => {
      reportContent += chunk.toString('utf-8');
    });
    downloadStream.on('error', (error) => {
      throw error;
    });
    await new Promise((resolve, reject) => {
      downloadStream.on('end', resolve);
      downloadStream.on('error', reject);
    });

    res.status(200).json({
      success: true,
      data: {
        jobId: job._id,
        fileName: files[0].filename,
        reportContent,
        format: files[0].filename.split('.').pop(), // md or pdf
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
    if (!job.reportId) {
      return res.status(404).json({
        success: false,
        message: 'Report not yet generated for this job'
      });
    }

    // Find the file in GridFS
    const files = await gridfsBucket.find({ _id: new mongoose.Types.ObjectId(job.reportId) }).toArray();
    if (files.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Set headers for download
    res.set('Content-Type', files[0].contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${files[0].filename}"`);

    // Stream the file
    const downloadStream = gridfsBucket.openDownloadStream(new mongoose.Types.ObjectId(job.reportId));
    downloadStream.pipe(res);

    downloadStream.on('error', (error) => {
      console.error('Download stream error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to download report'
      });
    });
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