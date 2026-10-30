const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    order: { type: Number, default: 1, min: 1 },
    summary: { type: String, default: "", trim: true, maxlength: 1000 },
    content: { type: String, default: "", trim: true },
    images: [{ type: String, trim: true }],
    resources: [{
        title: { type: String, trim: true },
        url: { type: String, trim: true }
    }]
}, { timestamps: true });

const opportunitySchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, maxlength: 220 },
    banner: { type: String, trim: true },
    shortDesc: { type: String, required: true, trim: true, maxlength: 1000 },
    fullDetails: { type: String, required: true, trim: true },
    type: {
        type: String,
        enum: ["Class", "Opportunity", "Workshop", "Webinar", "Internship", "Course", "Event", "Subscription", "Donation"],
        required: true
    },
    date: { type: Date },
    time: { type: String, trim: true },
    duration: { type: String, trim: true },
    mode: { type: String, enum: ["Online", "Offline", "Hybrid"], default: "Online" },
    location: { type: String, trim: true },
    eligibility: { type: String, trim: true },
    pricingType: { type: String, enum: ["free", "subscription", "special"] },
    isFree: { type: Boolean, default: true },
    fees: { type: Number, default: 0, min: 0 },
    deadline: { type: Date },
    totalSeats: { type: Number, min: 0 },
    filledSeats: { type: Number, default: 0, min: 0 },
    curriculum: [topicSchema],
    status: {
        type: String,
        enum: ["draft", "published", "closed", "upcoming", "ongoing", "completed"],
        default: "draft"
    },
    isPublished: { type: Boolean, default: true },
    isFeatured: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Opportunity", opportunitySchema);
