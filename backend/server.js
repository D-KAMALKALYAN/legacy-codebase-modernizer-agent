const app = require("./app");
const mongoose = require('mongoose');
const PORT = process.env.PORT || 5000;

// ============================================================
// GRACEFUL SHUTDOWN SETUP
// ============================================================

// Track active connections
const connections = new Set();
let isShuttingDown = false;

// Create HTTP server
const server = app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`🔐 JWT configured: ${!!process.env.JWT_SECRET}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Track all connections
server.on('connection', (connection) => {
  connections.add(connection);
  
  connection.on('close', () => {
    connections.delete(connection);
  });
});

// ============================================================
// GRACEFUL SHUTDOWN HANDLER
// ============================================================

async function gracefulShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  
  // Prevent new requests
  isShuttingDown = true;
  
  // Step 1: Stop accepting new connections
  console.log('⏳ Step 1/4: Closing HTTP server...');
  server.close(() => {
    console.log('✅ HTTP server closed (no new connections)');
  });
  
  // Step 2: Wait for active connections to close (max 30s)
  console.log(`⏳ Step 2/4: Waiting for ${connections.size} active connections to close...`);
  
  const shutdownTimeout = setTimeout(() => {
    console.log('⚠️  Timeout reached (30s). Force closing remaining connections.');
    connections.forEach(conn => conn.destroy());
  }, 30000);
  
  // Wait for all connections to close
  await new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      if (connections.size === 0) {
        clearInterval(checkInterval);
        clearTimeout(shutdownTimeout);
        console.log('✅ All connections closed');
        resolve();
      }
    }, 100);
  });
  
  // Step 3: Cleanup in-progress jobs (BEFORE closing DB)
  console.log('⏳ Step 3/4: Cleaning up in-progress jobs...');
  
  try {
    const Job = require('./src/models/Job');
    
    // Mark stuck jobs as failed
    const result = await Job.updateMany(
      { status: 'processing' },
      { 
        status: 'failed',
        error: 'Server shutdown during processing',
        completedAt: new Date()
      }
    );
    
    if (result.modifiedCount > 0) {
      console.log(`⚠️  Marked ${result.modifiedCount} jobs as failed due to shutdown`);
    } else {
      console.log('✅ No in-progress jobs to clean up');
    }
  } catch (error) {
    console.error('❌ Error cleaning up jobs:', error);
  }
  
  // Step 4: Close database connections (AFTER job cleanup)
  console.log('⏳ Step 4/4: Closing database connections...');
  
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing MongoDB:', error);
  }
  
  console.log('✅ Graceful shutdown complete');
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // Railway/Render/Docker
process.on('SIGINT', () => gracefulShutdown('SIGINT'));   // Ctrl+C

// Handle uncaught errors gracefully
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// ============================================================
// MIDDLEWARE: REJECT REQUESTS DURING SHUTDOWN
// ============================================================

// Add this middleware to your app.js
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.status(503).json({
      success: false,
      error: 'Service Unavailable',
      message: 'Server is shutting down. Please retry in a few seconds.'
    });
    return;
  }
  next();
});

// Export for testing
module.exports = { server, gracefulShutdown };