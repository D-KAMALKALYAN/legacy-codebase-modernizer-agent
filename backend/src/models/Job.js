const mongoose = require("mongoose");

const jobSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  uploadType: {
    type: String,
    enum: ['snippet', 'folder', 'zip'],
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId, // For single file (e.g., snippet or ZIP)
    default: null
  },
  fileIds: {
    type: [mongoose.Schema.Types.ObjectId], // For multiple files (e.g., folder upload)
    default: []
  },
  fileSize: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  folderStructure: {
    type: Object,
    default: null
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId, // ✅ GridFS ID for generated report
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  metadata: {
    fileCount: { type: Number, default: 0 },
    totalLines: { type: Number, default: 0 },
    languages: [String],
    totalIssues: { type: Number, default: 0 },
    critical: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    tokens_used: { type: Number, default: 0 },
    cost_estimate: { type: Number, default: 0 },
    cached: { type: Boolean, default: false }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: {
    type: Date,
    default: null
  }
});

const Job = mongoose.model("Job", jobSchema);
module.exports = Job;