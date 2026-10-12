const express = require('express');
const router = express.Router();
const {
  createRegistration,
  getRegistrations,
  deleteRegistration,
  updateRegistration,
  updateRegistrationStatus,
  exportRegistrations,
  verifyLocalPayment
} = require('../controllers/registrationController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.route('/')
  .post(upload.single('paymentProof'), createRegistration)
  .get(protect, getRegistrations);

router.post('/admin', protect, upload.single('paymentProof'), createRegistration);

router.route('/export').get(protect, exportRegistrations);

router.route('/:id')
  .put(protect, updateRegistration)
  .delete(protect, deleteRegistration);

router.put('/:id/status', protect, updateRegistrationStatus);
router.put('/:id/verify-payment', protect, verifyLocalPayment);

module.exports = router;
