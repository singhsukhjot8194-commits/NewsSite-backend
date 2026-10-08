const express = require('express');
const { createCheckoutSession, getCheckoutStatus } = require('../controllers/paymentController');

const router = express.Router();

router.post('/checkout', createCheckoutSession);
router.get('/status/:sessionId', getCheckoutStatus);

module.exports = router;
