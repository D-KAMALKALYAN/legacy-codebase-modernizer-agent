const path = require('path');
const fs = require('fs').promises;
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