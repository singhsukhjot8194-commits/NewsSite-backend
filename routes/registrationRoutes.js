const express = require('express');
const router = express.Router();
const { createRegistration, getRegistrations, deleteRegistration, updateRegistration, updateRegistrationStatus, exportRegistrations } = require('../controllers/registrationController');
const { protect } = require('../middleware/auth');

router.route('/')
  .post(createRegistration)
  .get(protect, getRegistrations);

router.post('/admin', protect, createRegistration);

router.route('/export').get(protect, exportRegistrations);

router.route('/:id')
  .put(protect, updateRegistration)
  .delete(protect, deleteRegistration);

router.put('/:id/status', protect, updateRegistrationStatus);

module.exports = router;
