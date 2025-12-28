const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const Job = require('../models/Job');
const {
  validateFileSize,
  validateFileType,
  extractZip,
  generateFolderStructure,
  analyzeDirectory,
  saveSnippet
} = require('../utils/fileHandler');

/**
 * Trigger AI analysis for a job
 */
async function triggerAIAnalysis(jobId, filePath, uploadType) {
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🤖 TRIGGERING AI ANALYSIS`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Job ID: ${jobId}`);
  console.log(`File Path: ${filePath}`);
  console.log(`Upload Type: ${uploadType}`);
  console.log(`AI Service URL: ${aiServiceUrl}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Update job status to processing
    await Job.findByIdAndUpdate(jobId, { status: 'processing' });
    console.log(`✅ Job status updated to 'processing'`);
    
    // Call AI service
    console.log(`📡 Calling AI service...`);
    const response = await axios.post(
      `${aiServiceUrl}/api/analyze`,
      {
        job_id: jobId.toString(),
        file_path: filePath,
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
    console.log(`Response Keys: ${Object.keys(response.data).join(', ')}`);
    
    const analysisResult = response.data;
    
    console.log(`Job ID: ${analysisResult.job_id}`);
    console.log(`Status: ${analysisResult.status}`);
    console.log(`Report Path: ${analysisResult.report_path || 'NOT PROVIDED'}`);
    console.log(`Issues Count: ${analysisResult.issues?.length || 0}`);
    console.log(`Summary:`, JSON.stringify(analysisResult.summary, null, 2));
    console.log(`Metadata:`, JSON.stringify(analysisResult.metadata, null, 2));
    console.log(`${'='.repeat(60)}\n`);
    
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
    console.log(`   Report Path to save: ${analysisResult.report_path}`);
    
    // Update job with results
    const updatedJob = await Job.findByIdAndUpdate(
      jobId,
      {
        status: 'completed',
        reportPath: analysisResult.report_path,
        completedAt: new Date(),
        metadata: metadata
      },
      { new: true } // Return updated document
    );
    
    if (!updatedJob) {
      throw new Error(`Job ${jobId} not found in database`);
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ JOB UPDATE SUCCESSFUL`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Job ID: ${updatedJob._id}`);
    console.log(`Status: ${updatedJob.status}`);
    console.log(`Report Path: ${updatedJob.reportPath || 'NULL'}`);
    console.log(`Completed At: ${updatedJob.completedAt}`);
    console.log(`Issues: ${metadata.totalIssues} (${metadata.critical} critical, ${metadata.warnings} warnings)`);
    console.log(`Cached: ${metadata.cached ? 'YES' : 'NO'}`);
    console.log(`${'='.repeat(60)}\n`);
    
  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(`❌ AI ANALYSIS FAILED`);
    console.error(`${'='.repeat(60)}`);
    console.error(`Job ID: ${jobId}`);
    console.error(`Error Type: ${error.name}`);
    console.error(`Error Message: ${error.message}`);
    
    if (error.response) {
      console.error(`Response Status: ${error.response.status}`);
      console.error(`Response Data:`, JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error(`No response received from AI service`);
      console.error(`Request was made but no response`);
    } else {
      console.error(`Error setting up request: ${error.message}`);
    }
    
    console.error(`Stack Trace:`, error.stack);
    console.error(`${'='.repeat(60)}\n`);
    
    // Update job status to failed
    try {
      await Job.findByIdAndUpdate(jobId, {
        status: 'failed',
        errorMessage: error.response?.data?.detail || error.message || 'AI analysis failed',
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

    // Create user-specific upload directory
    const uploadDir = path.join(__dirname, '../../uploads', req.user.id.toString());
    await fs.mkdir(uploadDir, { recursive: true });

    // Save snippet
    const snippetFileName = fileName || `snippet-${Date.now()}.${language}`;
    const filePath = await saveSnippet(code, snippetFileName, uploadDir);

    // Create job
    const job = await Job.create({
      userId: req.user.id,
      uploadType: 'snippet',
      fileName: snippetFileName,
      filePath,
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

    // Trigger AI analysis asynchronously (don't wait for response)
    triggerAIAnalysis(job._id, job.filePath, job.uploadType).catch(err => {
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
    if (!validateFileSize(file.size)) {
      return res.status(400).json({
        success: false,
        message: `File size exceeds maximum allowed size of ${process.env.MAX_FILE_SIZE_MB || 50}MB`
      });
    }

    // Validate file type
    if (path.extname(file.name).toLowerCase() !== '.zip') {
      return res.status(400).json({
        success: false,
        message: 'Only ZIP files are allowed'
      });
    }

    // Create user-specific upload directory
    const uploadDir = path.join(__dirname, '../../uploads', req.user.id.toString());
    await fs.mkdir(uploadDir, { recursive: true });

    // Save ZIP file
    const zipFileName = `upload-${Date.now()}-${file.name}`;
    const zipPath = path.join(uploadDir, zipFileName);
    await file.mv(zipPath);

    // Extract ZIP
    const extractPath = path.join(uploadDir, `extracted-${Date.now()}`);
    await extractZip(zipPath, extractPath);

    // Generate folder structure
    const folderStructure = await generateFolderStructure(extractPath);

    // Analyze directory
    const metadata = await analyzeDirectory(extractPath);

    // Create job
    const job = await Job.create({
      userId: req.user.id,
      uploadType: 'zip',
      fileName: zipFileName,
      filePath: extractPath,
      fileSize: file.size,
      folderStructure,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'ZIP file uploaded and extracted successfully',
      data: {
        job,
        folderStructure
      }
    });

    // Trigger AI analysis asynchronously
    triggerAIAnalysis(job._id, job.filePath, job.uploadType).catch(err => {
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

    // Create user-specific upload directory
    const uploadDir = path.join(__dirname, '../../uploads', req.user.id.toString());
    const folderPath = path.join(uploadDir, `folder-${Date.now()}`);
    await fs.mkdir(folderPath, { recursive: true });

    // Save all files
    let totalSize = 0;
    for (const file of files) {
      totalSize += file.size;
      
      // Recreate folder structure from file path
      const relativePath = file.name;
      const filePath = path.join(folderPath, relativePath);
      const fileDir = path.dirname(filePath);
      
      await fs.mkdir(fileDir, { recursive: true });
      await file.mv(filePath);
    }

    // Validate total size
    if (!validateFileSize(totalSize)) {
      return res.status(400).json({
        success: false,
        message: `Total folder size exceeds maximum allowed size of ${process.env.MAX_FILE_SIZE_MB || 50}MB`
      });
    }

    // Generate folder structure
    const folderStructure = await generateFolderStructure(folderPath);

    // Analyze directory
    const metadata = await analyzeDirectory(folderPath);

    // Create job
    const job = await Job.create({
      userId: req.user.id,
      uploadType: 'folder',
      fileName: path.basename(folderPath),
      filePath: folderPath,
      fileSize: totalSize,
      folderStructure,
      metadata
    });

    res.status(201).json({
      success: true,
      message: 'Folder uploaded successfully',
      data: {
        job,
        folderStructure
      }
    });

    // Trigger AI analysis asynchronously
    triggerAIAnalysis(job._id, job.filePath, job.uploadType).catch(err => {
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

    // Ensure user owns this job
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