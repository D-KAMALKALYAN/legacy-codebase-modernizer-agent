require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const connectDB = require('./src/config/database');

// Import routes
const authRoutes = require('./src/routes/auth');
const jobRoutes = require('./src/routes/jobs');
const reportRoutes = require('./src/routes/reports');

const app = express();

// Connect to MongoDB
connectDB();

// ============================================================
// GRACEFUL SHUTDOWN STATE (shared with server.js)
// ============================================================
let isShuttingDown = false;

// Export setter for server.js to use
app.setShutdownState = (state) => {
  isShuttingDown = state;
};

// ============================================================
// MIDDLEWARE: REJECT REQUESTS DURING SHUTDOWN
// ============================================================
app.use((req, res, next) => {
  if (isShuttingDown) {
    return res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Server is shutting down. Please retry in 30 seconds.'
    });
  }
  next();
});

// ============================================================
// STANDARD MIDDLEWARE
// ============================================================
app.use(cors({ 
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true 
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  createParentPath: true,
  limits: { 
    fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || 50) * 1024 * 1024 
  }
}));

// ============================================================
// HEALTH CHECK (updated for graceful shutdown)
// ============================================================
app.get('/health', (req, res) => {
  // Return 503 if shutting down (for load balancers)
  if (isShuttingDown) {
    return res.status(503).json({ 
      status: 'shutting_down',
      timestamp: new Date()
    });
  }
  
  // Normal health check
  const mongoose = require('mongoose');
  res.json({ 
    status: 'healthy', 
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: process.uptime()
  });
});

// ============================================================
// API ROUTES
// ============================================================
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/reports', reportRoutes);

// ============================================================
// ERROR HANDLERS
// ============================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

module.exports = app;