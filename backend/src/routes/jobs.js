const express = require('express');
const {
  uploadSnippet,
  uploadZip,
  uploadFolder,
  getJobs,
  getJob
} = require('../controllers/jobController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(protect);

router.post('/upload/snippet', uploadSnippet);
router.post('/upload/zip', uploadZip);
router.post('/upload/folder', uploadFolder);
router.get('/', getJobs);
router.get('/:id', getJob);

module.exports = router;