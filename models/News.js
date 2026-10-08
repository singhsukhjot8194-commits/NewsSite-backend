const mongoose = require('mongoose');

const newsSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  category: { type: String, required: true },
  region: { type: String, enum: ['north-africa', 'south-africa', 'east-africa', 'west-africa'] },
  content: { type: String, required: true },
  image: { type: String },
  video: { type: String },
  tags: [{ type: String }],
  isBreaking: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  seoTitle: { type: String },
  seoDesc: { type: String },
  views: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('News', newsSchema);
