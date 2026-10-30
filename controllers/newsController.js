const News = require("../models/News");
const slugify = require("../utils/slugify");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const categoryNames = {
  africa: "Africa",
  business: "Business",
  "breaking news": "Breaking News",
  "breaking-news": "Breaking News",
  "county news": "County News",
  "county-news": "County News",
  education: "Education",
  entertainment: "World",
  news: "News",
  politics: "Politics",
  podcasts: "Podcasts",
  sports: "Sports",
  tech: "Technology",
  technology: "Technology",
  world: "World"
};

const normalizeCategory = (category) => {
  if (typeof category !== "string") return category;
  const normalized = category.trim().toLowerCase();
  return categoryNames[normalized] || category.trim();
};

const validRegions = ["north-africa", "south-africa", "east-africa", "west-africa"];

const normalizeNewsCategories = (news) => {
  news.forEach((article) => {
    article.category = normalizeCategory(article.category);
  });
  return news;
};

const allowedNewsFields = [
  "title",
  "category",
  "region",
  "content",
  "tags",
  "isBreaking",
  "isFeatured",
  "status",
  "seoTitle",
  "seoDesc"
];

const pickAllowed = (body, fields) => {
  const data = {};
  fields.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      let value = body[key];
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        return;
      }
      data[key] = value;
    }
  });
  return data;
};

const sanitizeString = (value) => {
  if (typeof value !== "string") return value;
  return value.trim();
};

const parseTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags !== "string" || !tags.trim()) return [];
  try {
    const parsedTags = JSON.parse(tags);
    if (Array.isArray(parsedTags)) return parsedTags.map(String).filter(Boolean);
  } catch (error) {
    // Admin form values are comma-separated rather than JSON.
  }
  return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
};

const getNewsList = async (req, res, includeUnpublished) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = includeUnpublished ? {} : { status: "published" };

    if (req.query.category) {
      const category = normalizeCategory(String(req.query.category));
      if (category === "World") {
        query.category = /^(?:world|entertainment)$/i;
      } else {
        query.category = new RegExp(`^${escapeRegExp(category)}$`, "i");
      }
    }
    if (req.query.region) {
      const region = String(req.query.region).trim().toLowerCase();
      if (!validRegions.includes(region)) {
        return res.status(400).json({ message: "Invalid Africa region" });
      }
      query.region = region;
    }
    if (includeUnpublished && req.query.status) {
      if (!["draft", "published"].includes(req.query.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      query.status = req.query.status;
    }
    if (req.query.isFeatured || req.query.featured) {
      query.isFeatured = (req.query.isFeatured || req.query.featured) === "true";
    }
    if (req.query.isBreaking || req.query.breaking) {
      query.isBreaking = (req.query.isBreaking || req.query.breaking) === "true";
    }
    if (req.query.search) {
      const search = String(req.query.search).trim();
      if (search.length > 0 && search.length <= 100) {
        query.title = { $regex: escapeRegExp(search), $options: "i" };
      }
    }

    const news = normalizeNewsCategories(
      await News.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
    );
    const total = await News.countDocuments(query);

    res.json({ news, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    res.status(500).json({ message: "Failed to load news" });
  }
};

const getNews = (req, res) => getNewsList(req, res, false);

const getAdminNews = (req, res) => getNewsList(req, res, true);

const getNewsById = async (req, res) => {
  try {
    const isObjectId = /^[a-f\d]{24}$/i.test(req.params.id);
    const lookup = isObjectId ? { _id: req.params.id } : { slug: req.params.id };
    const news = await News.findOne({ ...lookup, status: "published" });
    if (news) {
      news.views += 1;
      await news.save();
      news.category = normalizeCategory(news.category);
      res.json(news);
    } else {
      res.status(404).json({ message: "News not found" });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to load news" });
  }
};

const createNews = async (req, res) => {
  try {
    const data = pickAllowed(req.body, allowedNewsFields);

    if (!data.title || !String(data.title).trim()) {
      return res.status(400).json({ message: "Title is required" });
    }
    if (!data.category || !String(data.category).trim()) {
      return res.status(400).json({ message: "Category is required" });
    }

    const normalizedCategory = normalizeCategory(data.category);
    const normalizedRegion = typeof data.region === "string" ? data.region.trim().toLowerCase() : "";
    if (normalizedCategory === "Africa" && !validRegions.includes(normalizedRegion)) {
      return res.status(400).json({ message: "Choose a valid region for Africa news" });
    }

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    let slug = slugify(String(data.title));
    const existing = await News.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;

    const news = await News.create({
      title: String(data.title).trim(),
      slug,
      category: normalizedCategory,
      region: normalizedCategory === "Africa" ? normalizedRegion : undefined,
      content: sanitizeString(data.content) || "",
      image: imageFile ? imageFile.path : "",
      video: videoFile ? videoFile.path : "",
      tags: parseTags(data.tags),
      isBreaking: data.isBreaking === "true" || data.isBreaking === true,
      isFeatured: data.isFeatured === "true" || data.isFeatured === true,
      status: data.status || "published",
      seoTitle: sanitizeString(data.seoTitle) || "",
      seoDesc: sanitizeString(data.seoDesc) || ""
    });
    res.status(201).json(news);
  } catch (error) {
    res.status(500).json({ message: "Failed to create news" });
  }
};

const updateNews = async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ message: "News not found" });

    const data = pickAllowed(req.body, allowedNewsFields);

    if (data.title !== undefined) {
      if (!String(data.title).trim()) {
        return res.status(400).json({ message: "Title is required" });
      }
      const titleChanged = String(data.title) !== news.title;
      news.title = String(data.title).trim();
      if (titleChanged) {
        let slug = slugify(news.title);
        const existing = await News.findOne({ slug, _id: { $ne: news._id } });
        if (existing) slug = `${slug}-${Date.now()}`;
        news.slug = slug;
      }
    }
    if (data.category !== undefined) {
      if (!String(data.category).trim()) {
        return res.status(400).json({ message: "Category is required" });
      }
      news.category = normalizeCategory(data.category);
    }
    if (data.category !== undefined && news.category !== "Africa") {
      news.region = undefined;
    } else if (news.category === "Africa" && data.region !== undefined) {
      const normalizedRegion = String(data.region).trim().toLowerCase();
      if (!validRegions.includes(normalizedRegion)) {
        return res.status(400).json({ message: "Choose a valid region for Africa news" });
      }
      news.region = normalizedRegion;
    } else if (news.category === "Africa" && !news.region) {
      return res.status(400).json({ message: "Choose a valid region for Africa news" });
    }
    if (data.content !== undefined) news.content = sanitizeString(data.content) || "";
    if (data.tags !== undefined) news.tags = parseTags(data.tags);
    if (data.isBreaking !== undefined) news.isBreaking = data.isBreaking === "true" || data.isBreaking === true;
    if (data.isFeatured !== undefined) news.isFeatured = data.isFeatured === "true" || data.isFeatured === true;
    if (data.status !== undefined) {
      if (!["draft", "published"].includes(data.status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      news.status = data.status;
    }
    if (data.seoTitle !== undefined) news.seoTitle = sanitizeString(data.seoTitle) || "";
    if (data.seoDesc !== undefined) news.seoDesc = sanitizeString(data.seoDesc) || "";

    const imageFile = req.files?.image?.[0];
    const videoFile = req.files?.video?.[0];
    if (imageFile) news.image = imageFile.path;
    if (videoFile) news.video = videoFile.path;

    const updatedNews = await news.save();
    res.json(updatedNews);
  } catch (error) {
    res.status(500).json({ message: "Failed to update news" });
  }
};

const deleteNews = async (req, res) => {
  try {
    const news = await News.findByIdAndDelete(req.params.id);
    if (news) res.json({ message: "News removed" });
    else res.status(404).json({ message: "News not found" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete news" });
  }
};

module.exports = { getNews, getAdminNews, getNewsById, createNews, updateNews, deleteNews };
