const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
  phone: { type: String, required: true, trim: true, maxlength: 50 },
  opportunity: { type: mongoose.Schema.Types.ObjectId, ref: "Opportunity", required: true },
  status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending" },
  paymentStatus: {
    type: String,
    enum: ["not_required", "pending", "paid", "failed"],
    default: "not_required"
  },
  paymentMethod: {
    type: String,
    enum: ["card", "stripe", "orange", "lonestar", "free"],
    default: "card"
  },
  paymentProof: { type: String, trim: true },
  accountHolder: { type: String, trim: true },
  transactionReference: { type: String, trim: true, maxlength: 200 },
  stripeCheckoutSessionId: { type: String, sparse: true, unique: true },
  amountPaid: { type: Number, min: 0 },
  registeredAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Registration", registrationSchema);
