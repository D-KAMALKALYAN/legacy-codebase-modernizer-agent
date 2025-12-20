const express = require('express');
const { getReport, downloadReport } = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

router.get('/:jobId', getReport);
router.get('/:jobId/download', downloadReport);

module.exports = router;