const express = require('express');
const router = express.Router();
const {
  getOpportunities,
  getAdminOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getCurriculum,
  addCurriculumTopic,
  updateCurriculumTopic,
  deleteCurriculumTopic,
  accessClassroom
} = require('../controllers/opportunityController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .get(getOpportunities)
  .post(protect, upload.single('banner'), createOpportunity);

router.get('/admin', protect, getAdminOpportunities);

// Student Classroom Access Verification
router.post('/:id/classroom/access', accessClassroom);

// Admin Course Curriculum Management
router.get('/:id/curriculum', protect, getCurriculum);
router.post('/:id/curriculum/topic', protect, upload.array('images', 5), addCurriculumTopic);
router.put('/:id/curriculum/topic/:topicId', protect, upload.array('images', 5), updateCurriculumTopic);
router.delete('/:id/curriculum/topic/:topicId', protect, deleteCurriculumTopic);

router.route('/:id')
  .get(getOpportunityById)
  .put(protect, upload.single('banner'), updateOpportunity)
  .delete(protect, deleteOpportunity);

module.exports = router;
