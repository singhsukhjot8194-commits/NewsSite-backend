const News = require('../models/News');
const slugify = require('../utils/slugify');

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const categoryNames = {
  africa: 'Africa',
  business: 'Business',
  'breaking news': 'Breaking News',
  'breaking-news': 'Breaking News',
  'county news': 'County News',
  'county-news': 'County News',
  education: 'Education',
  editorial: 'Editorial',
  entertainment: 'World',
  news: 'News',
  politics: 'Politics',
  podcasts: 'Podcasts',
  sports: 'Sports',
  tech: 'Technology',
  technology: 'Technology',
  world: 'World'
};

const normalizeCategory = (category) => {
  if (typeof category !== 'string') return category;
  const normalized = category.trim().toLowerCase();
  return categoryNames[normalized] || category.trim();
};

const validRegions = ['north-africa', 'south-africa', 'east-africa', 'west-africa'];

const normalizeNewsCategories = (news) => {
  news.forEach((article) => {
    article.category = normalizeCategory(article.category);
  });
  return news;
};

const getNewsList = async (req, res, includeUnpublished) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = includeUnpublished ? {} : { status: 'published' };
    if (req.query.category) {
      const category = normalizeCategory(req.query.category);
      if (category === 'World') {
        query.category = /^(?:world|entertainment)$/i;
      } else {
        query.category = new RegExp(`^${escapeRegExp(category)}$`, 'i');
      }
    }
    if (req.query.region) {
      const region = String(req.query.region).trim().toLowerCase();
      if (!validRegions.includes(region)) {
        return res.status(400).json({ message: 'Invalid Africa region' });
      }
      query.region = region;
    }
    if (includeUnpublished && req.query.status) query.status = req.query.status;
    if (req.query.isFeatured || req.query.featured) {
      query.isFeatured = (req.query.isFeatured || req.query.featured) === 'true';
    }
    if (req.query.isBreaking || req.query.breaking) {
      query.isBreaking = (req.query.isBreaking || req.query.breaking) === 'true';
    }
    if (req.query.search) {
      query.title = { $regex: req.query.search, $options: 'i' };
    }

    const news = normalizeNewsCategories(
      await News.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
    );
    const total = await News.countDocuments(query);

    res.json({ news, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getNews = (req, res) => getNewsList(req, res, false);

const getAdminNews = (req, res) => getNewsList(req, res, true);

const getNewsById = async (req, res) => {
  try {
    const isObjectId = /^[a-f\d]{24}$/i.test(req.params.id);
    const lookup = isObjectId ? { _id: req.params.id } : { slug: req.params.id };
    const news = await News.findOne({ ...lookup, status: 'published' });
    if (news) {
      news.views += 1;
      await news.save();
      news.category = normalizeCategory(news.category);
      res.json(news);
    }
    else res.status(404).json({ message: 'News not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const parseTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags !== 'string' || !tags.trim()) return [];

  try {
    const parsedTags = JSON.parse(tags);
    if (Array.isArray(parsedTags)) return parsedTags;
  } catch (error) {
    // Admin form values are comma-separated rather than JSON.
  }

  return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
};

const createNews = async (req, res) => {
  try {
    const { title, category, region, content, tags, isBreaking, isFeatured, status, seoTitle, seoDesc } = req.body;
    const normalizedCategory = normalizeCategory(category);
    const normalizedRegion = typeof region === 'string' ? region.trim().toLowerCase() : '';
    if (normalizedCategory === 'Africa' && !validRegions.includes(normalizedRegion)) {
      return res.status(400).json({ message: 'Choose a valid region for Africa news' });
    }
    if (normalizedRegion && !validRegions.includes(normalizedRegion)) {
      return res.status(400).json({ message: 'Invalid Africa region' });
    }
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    let slug = slugify(title);
    const existing = await News.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const news = await News.create({
      title, slug, category: normalizedCategory, region: normalizedCategory === 'Africa' ? normalizedRegion : undefined, content,
      image: imageFile ? `/uploads/${imageFile.filename}` : '',
      video: videoFile ? `/uploads/${videoFile.filename}` : '',
      tags: parseTags(tags),
      isBreaking: isBreaking === 'true',
      isFeatured: isFeatured === 'true',
      status: status || 'published', seoTitle, seoDesc
    });
    res.status(201).json(news);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ message: 'News not found' });

    const { title, category, region, content, tags, isBreaking, isFeatured, status, seoTitle, seoDesc } = req.body;

    const titleChanged = title && title !== news.title;
    news.title = title || news.title;
    if (titleChanged) {
      let slug = slugify(title);
      const existing = await News.findOne({ slug, _id: { $ne: news._id } });
      if (existing) slug = `${slug}-${Date.now()}`;
      news.slug = slug;
    }
    if (category) news.category = normalizeCategory(category);
    if (category && news.category !== 'Africa') {
      news.region = undefined;
    } else if (news.category === 'Africa' && region !== undefined) {
      const normalizedRegion = String(region).trim().toLowerCase();
      if (!validRegions.includes(normalizedRegion)) {
        return res.status(400).json({ message: 'Choose a valid region for Africa news' });
      }
      news.region = normalizedRegion;
    } else if (news.category === 'Africa' && !news.region) {
      return res.status(400).json({ message: 'Choose a valid region for Africa news' });
    }
    news.content = content || news.content;
    if (tags !== undefined) news.tags = parseTags(tags);
    if (isBreaking !== undefined) news.isBreaking = isBreaking === 'true';
    if (isFeatured !== undefined) news.isFeatured = isFeatured === 'true';
    if (status) news.status = status;
    if (seoTitle !== undefined) news.seoTitle = seoTitle;
    if (seoDesc !== undefined) news.seoDesc = seoDesc;
    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    if (imageFile) news.image = `/uploads/${imageFile.filename}`;
    if (videoFile) news.video = `/uploads/${videoFile.filename}`;

    const updatedNews = await news.save();
    res.json(updatedNews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (news) res.json({ message: 'News removed' });
    else res.status(404).json({ message: 'News not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getNews, getAdminNews, getNewsById, createNews, updateNews, deleteNews };
