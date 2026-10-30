const mongoose = require("mongoose");

const newsSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, unique: true, trim: true, maxlength: 220 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    region: { type: String, trim: true, lowercase: true, maxlength: 50 },
    content: { type: String, default: "" },
    image: { type: String, trim: true },
    video: { type: String, trim: true },
    tags: [{ type: String, trim: true, maxlength: 50 }],
    isBreaking: { type: Boolean, default: false },
    isFeatured: { type: Boolean, default: false },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    seoTitle: { type: String, trim: true, maxlength: 200 },
    seoDesc: { type: String, trim: true, maxlength: 300 },
    views: { type: Number, default: 0, min: 0 }
}, { timestamps: true });

module.exports = mongoose.model("News", newsSchema);
