const path = require('path');
const mongoose = require('mongoose');
const { GridFSBucket } = require('mongoose').mongo;
const axios = require('axios');
const Job = require('../models/Job');

// Initialize GridFS
let gridfsBucket;
mongoose.connection.on('open', () => {
  gridfsBucket = new GridFSBucket(mongoose.connection.db, {
    bucketName: 'uploads'
  });
});

/**
 * Trigger AI analysis for a job
 */
async function triggerAIAnalysis(jobId, fileId, uploadType) {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🤖 TRIGGERING AI ANALYSIS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`File ID: ${fileId}`);
  console.log(`Upload Type: ${uploadType}`);
  console.log(`AI Service URL: ${aiServiceUrl}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Update job status to processing
    await Job.findByIdAndUpdate(jobId, { status: 'processing' });
    console.log(`✅ Job status updated to 'processing'`);
    
    // Call AI service with file_id (not file_path)
    console.log(`📡 Calling AI service...`);
    const response = await axios.post(
      `${aiServiceUrl}/api/analyze`,
      {
        job_id: jobId.toString(),
        file_id: fileId.toString(), // ✅ Sending GridFS ID
        upload_type: uploadType,
        force_refresh: false
      },
      {
        timeout: 300000, // 5 minute timeout
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 AI SERVICE RESPONSE RECEIVED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Status: ${response.status}`);
    
    const analysisResult = response.data;
    
    // ✅ CRITICAL: report_path now contains GridFS file ID, not filesystem path
    const reportId = analysisResult.report_path; // This is now a GridFS ObjectId string
    
    console.log(`Report ID (GridFS): ${reportId || 'NOT PROVIDED'}`);
    console.log(`Issues Count: ${analysisResult.issues?.length || 0}`);
    
    // Prepare metadata
    const metadata = {
      fileCount: analysisResult.summary?.files_analyzed || 0,
      totalLines: analysisResult.summary?.total_lines || 0,
      languages: analysisResult.summary?.languages_detected || [],
      totalIssues: analysisResult.summary?.total_issues || 0,
      critical: analysisResult.summary?.critical || 0,
      warnings: analysisResult.summary?.warnings || 0,
      tokens_used: analysisResult.metadata?.tokens_used || 0,
      cost_estimate: analysisResult.metadata?.cost_estimate || 0,
      cached: analysisResult.metadata?.cached || false
    };
    
    console.log(`📝 Updating job in database...`);
    
    // Update job with results
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      {
        status: 'completed',
        reportId: reportId ? new mongoose.Types.ObjectId(reportId) : null, // ✅ Store as ObjectId
        completedAt: new Date(),
        metadata: metadata
      },
      { new: true }
    );
    
    if (!updatedJob) {
      throw new Error(`Job ${jobId} not found in database`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ JOB UPDATE SUCCESSFUL`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Job ID: ${updatedJob._id}`);
    console.log(`Status: ${updatedJob.status}`);
    console.log(`Report ID: ${updatedJob.reportId || 'NULL'}`); // ✅ Changed from reportPath
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(`❌ AI ANALYSIS FAILED`);
    console.error(`${'='.repeat(60)}`);
    console.error(`Job ID: ${jobId}`);
    console.error(`Error: ${error.message}`);
    
    // ✅ FIXED: Properly serialize error message
    let errorMessage = error.message || 'AI analysis failed';
    
    if (error.response?.data?.detail) {
      // If detail is an array (Pydantic validation errors), stringify it
      if (Array.isArray(error.response.data.detail)) {
        errorMessage = JSON.stringify(error.response.data.detail);
      } else {
        errorMessage = error.response.data.detail;
      }
    }
    
    console.error(`${'='.repeat(60)}\n`);
    
    // Update job status to failed
    try {
      await Job.findByIdAndUpdate(jobId, {
        status: 'failed',
        errorMessage: errorMessage, // ✅ Now properly serialized
        completedAt: new Date()
      });
      console.log(`✅ Job status updated to 'failed'`);
    } catch (updateError) {
      console.error(`❌ Failed to update job status:`, updateError.message);
    }
  }
}

/**
 * @route   POST /api/jobs/upload/snippet
 * @desc    Upload code snippet
 * @access  Private
 */
const uploadSnippet = async (req, res) => {
  try {
    const { code, language, fileName } = req.body;

    if (!code || !language) {
      return res.status(400).json({
        success: false,
        message: 'Code content and language are required'
      });
    }

    // Save snippet to GridFS
    const snippetFileName = fileName || `snippet-${Date.now()}.${language}`;
    const uploadStream = gridfsBucket.openUploadStream(snippetFileName, {
      contentType: 'text/plain'
    });
    uploadStream.write(code);
    uploadStream.end();

    const fileId = uploadStream.id;

    // Create job
    const job = await Job.create({
      userId: req.user.id,
      uploadType: 'snippet',
      fileName: snippetFileName,
      fileId: fileId.toString(),
      fileSize: Buffer.byteLength(code, 'utf-8'),
      metadata: {
        fileCount: 1,
        totalLines: code.split('\n').length,
        languages: [language]
      }
    });

    res.status(201).json({
      success: true,
      message: 'Snippet uploaded successfully',
      data: { job }
    });

    // Trigger AI analysis asynchronously
    triggerAIAnalysis(job._id, job.fileId, job.uploadType).catch(err => {
      console.error('AI analysis trigger failed:', err);
    });

  } catch (error) {
    console.error('Upload snippet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload snippet'
    });
  }
};

/**
 * @route   POST /api/jobs/upload/zip
 * @desc    Upload ZIP file
 * @access  Private
 */
const uploadZip = async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const file = req.files.file;

    // Validate file size
    const maxSize = (process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024;
    if (file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds maximum of ${process.env.MAX_FILE_SIZE_MB || 50}MB`
      });
    }

    // Validate file type
    if (path.extname(file.name).toLowerCase() !== '.zip') {
      return res.status(400).json({
        success: false,
        message: 'Only ZIP files are allowed'
      });
    }

    // Save ZIP to GridFS
    const zipFileName = `upload-${Date.now()}-${file.name}`;
    const uploadStream = gridfsBucket.openUploadStream(zipFileName, {
      contentType: 'application/zip'
    });
    uploadStream.write(file.data);
    uploadStream.end();

    const fileId = uploadStream.id;

    // Create job
    const job = await Job.create({
      userId: req.user.id,
      uploadType: 'zip',
      fileName: zipFileName,
      fileId: fileId.toString(),
      fileSize: file.size,
      folderStructure: {},
      metadata: {}
    });

    res.status(201).json({
      success: true,
      message: 'ZIP file uploaded successfully',
      data: { job }
    });

    // Trigger AI analysis asynchronously
    triggerAIAnalysis(job._id, job.fileId, job.uploadType).catch(err => {
      console.error('AI analysis trigger failed:', err);
    });

  } catch (error) {
    console.error('Upload ZIP error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload ZIP file'
    });
  }
};

/**
 * @route   POST /api/jobs/upload/folder
 * @desc    Upload folder (multiple files)
 * @access  Private
 */
const uploadFolder = async (req, res) => {
  try {
    if (!req.files || !req.files.files) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];

    let totalSize = 0;
    const fileIds = [];

    for (const file of files) {
      totalSize += file.size;

      const uploadStream = gridfsBucket.openUploadStream(file.name, {
        contentType: file.mimetype
      });
      uploadStream.write(file.data);
      uploadStream.end();

      fileIds.push(uploadStream.id.toString());
    }

    // Validate total size
    const maxSize = (process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024;
    if (totalSize > maxSize) {
      return res.status(400).json({
        success: false,
        message: `Total size exceeds maximum of ${process.env.MAX_FILE_SIZE_MB || 50}MB`
      });
    }

    // Create job
    const job = await Job.create({
      userId: req.user.id,
      uploadType: 'folder',
      fileName: `folder-${Date.now()}`,
      fileIds,
      fileSize: totalSize,
      folderStructure: {},
      metadata: {}
    });

    res.status(201).json({
      success: true,
      message: 'Folder uploaded successfully',
      data: { job }
    });

    // Trigger AI analysis asynchronously
    triggerAIAnalysis(job._id, job.fileIds[0], job.uploadType).catch(err => {
      console.error('AI analysis trigger failed:', err);
    });

  } catch (error) {
    console.error('Upload folder error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload folder'
    });
  }
};

/**
 * @route   GET /api/jobs
 * @desc    Get all jobs for current user
 * @access  Private
 */
const getJobs = async (req, res) => {
  try {
    const jobs = await Job.find({ userId: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: jobs.length,
      data: { jobs }
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jobs'
    });
  }
};

/**
 * @route   GET /api/jobs/:id
 * @desc    Get single job by ID
 * @access  Private
 */
const getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (job.userId.toString() !== req.user.id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this job'
      });
    }

    res.status(200).json({
      success: true,
      data: { job }
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job'
    });
  }
};

module.exports = {
  uploadSnippet,
  uploadZip,
  uploadFolder,
  getJobs,
  getJob
};