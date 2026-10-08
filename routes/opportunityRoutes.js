const express = require('express');
const router = express.Router();
const {
  getOpportunities,
  getAdminOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity
} = require('../controllers/opportunityController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .get(getOpportunities)
  .post(protect, upload.single('banner'), createOpportunity);

router.get('/admin', protect, getAdminOpportunities);

router.route('/:id')
  .get(getOpportunityById)
  .put(protect, upload.single('banner'), updateOpportunity)
  .delete(protect, deleteOpportunity);

module.exports = router;
