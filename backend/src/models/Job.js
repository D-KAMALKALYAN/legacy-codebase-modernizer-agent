const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  uploadType: {
    type: String,
    enum: ['snippet', 'zip', 'folder'],
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalFileName: {
    type: String,
    default: null
  },
  fileId: {
    type: String,
    default: null
  },
  fileIds: [{
    type: String
  }],
  fileSize: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  reportId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  folderStructure: {
    type: Object,
    default: {}
  },
  metadata: {
    fileCount: { type: Number, default: 0 },
    totalLines: { type: Number, default: 0 },
    languages: [{ type: String }],
    totalIssues: { type: Number, default: 0 },
    critical: { type: Number, default: 0 },
    warnings: { type: Number, default: 0 },
    info: { type: Number, default: 0 },
    tokens_used: { type: Number, default: 0 },
    cost_estimate: { type: Number, default: 0 },
    cached: { type: Boolean, default: false }
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  completedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Indexes for performance
jobSchema.index({ userId: 1, createdAt: -1 });
jobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);