const express = require('express');
const router = express.Router();
const { getNews, getAdminNews, getNewsById, createNews, updateNews, deleteNews } = require('../controllers/newsController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.get('/admin', protect, getAdminNews);

router.route('/')
  .get(getNews)
  .post(protect, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), createNews);

router.route('/:id')
  .get(getNewsById)
  .put(protect, upload.fields([{ name: 'image', maxCount: 1 }, { name: 'video', maxCount: 1 }]), updateNews)
  .delete(protect, deleteNews);

module.exports = router;
