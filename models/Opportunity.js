const mongoose = require('mongoose');

const opportunitySchema = new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    banner: { type: String },
    shortDesc: { type: String, required: true },
    fullDetails: { type: String, required: true },
    type: {
        type: String,
        enum: ['Class', 'Opportunity', 'Workshop', 'Webinar', 'Internship', 'Course', 'Event', 'Subscription', 'Donation'],
        required: true
    },
    date: { type: Date },
    time: { type: String },
    duration: { type: String },
    mode: { type: String, enum: ['Online', 'Offline', 'Hybrid'], default: 'Online' },
    location: { type: String },
    eligibility: { type: String },
    pricingType: { type: String, enum: ['free', 'subscription', 'special'] },
    isFree: { type: Boolean, default: true },
    fees: { type: Number, default: 0 },
    deadline: { type: Date },
    totalSeats: { type: Number },
    filledSeats: { type: Number, default: 0 },
    status: {
        type: String,
        enum: ['draft', 'published', 'closed', 'upcoming', 'ongoing', 'completed'],
        default: 'draft'
    },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Opportunity', opportunitySchema);