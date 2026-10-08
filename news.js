const mongoose = require('mongoose');
const newsSchema = new mongoose.Schema({
    title: String,
    slug: { type: String, unique: true },
    category: String, // e.g., Politics, Sports
    content: String,
    image: String,
    tags: [String],
    isBreaking: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    seoTitle: String,
    seoDesc: String,
    views: { type: Number, default: 0 }
}, { timestamps: true });
module.exports = mongoose.model('News', newsSchema);