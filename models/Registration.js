const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: 'Opportunity', required: true },
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  paymentStatus: {
    type: String,
    enum: ['not_required', 'pending', 'paid', 'failed'],
    default: 'not_required'
  },
  stripeCheckoutSessionId: { type: String, sparse: true, unique: true },
  amountPaid: { type: Number, min: 0 },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Registration', registrationSchema);
