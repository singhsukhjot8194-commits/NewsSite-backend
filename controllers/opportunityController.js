const Opportunity = require('../models/Opportunity');
const slugify = require('../utils/slugify');

const getOpportunityList = async (req, res, includeUnpublished) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = includeUnpublished
      ? {}
      : { $or: [{ isPublished: true }, { isPublished: { $exists: false } }] };
    if (req.query.type) query.type = req.query.type;
    if (req.query.status) query.status = req.query.status;
    if (req.query.isFeatured) query.isFeatured = req.query.isFeatured === 'true';

    const opps = await Opportunity.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);
    const total = await Opportunity.countDocuments(query);

    res.json({ opportunities: opps, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getOpportunities = (req, res) => getOpportunityList(req, res, false);
const getAdminOpportunities = (req, res) => getOpportunityList(req, res, true);

const validatePricing = (data, res) => {
  if (data.isFree === true) {
    data.fees = 0;
    return true;
  }
  const fees = Number(data.fees);
  if (
    !Number.isFinite(fees)
    || fees < 0.5
    || fees > 999999.99
    || Math.round(fees * 100) / 100 !== fees
  ) {
    res.status(400).json({
      message: 'Paid service prices must be USD 0.50–999,999.99 with no more than two decimal places.'
    });
    return false;
  }
  data.fees = fees;
  return true;
};

const normalizePricingType = (value) => {
  if (['free', 'subscription', 'special'].includes(value)) return value;
  return null;
};

const getOpportunityById = async (req, res) => {
  try {
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const query = {
      $or: [{ isPublished: true }, { isPublished: { $exists: false } }]
    };
    if (isObjectId) {
      query._id = req.params.id;
    } else {
      query.slug = req.params.id;
    }
    const opp = await Opportunity.findOne(query);
    if (opp) res.json(opp);
    else res.status(404).json({ message: 'Opportunity not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createOpportunity = async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.file) data.banner = `/uploads/${req.file.filename}`;
    
    let slug = slugify(data.title);
    const existing = await Opportunity.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now()}`;
    data.slug = slug;

    const normalizedPricingType = normalizePricingType(data.pricingType);
    if (data.pricingType !== undefined && !normalizedPricingType) {
      return res.status(400).json({ message: 'Choose Free, Subscription, or Special pricing.' });
    }
    const pricingType = normalizedPricingType
      || (data.isFree === 'true' || data.isFree === true ? 'free' : 'special');
    data.pricingType = pricingType;
    data.isFree = pricingType === 'free';
    if (!validatePricing(data, res)) return;
    if (data.isPublished !== undefined) {
      data.isPublished = data.isPublished === 'true' || data.isPublished === true;
    } else {
      data.isPublished = false;
    }

    if (data.isFeatured === 'true' || data.isFeatured === true) data.isFeatured = true;
    else data.isFeatured = false;

    const opp = await Opportunity.create(data);
    res.status(201).json(opp);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateOpportunity = async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

    const data = { ...req.body };
    if (req.file) data.banner = `/uploads/${req.file.filename}`;
    
    if (data.title && data.title !== opp.title) {
        data.slug = slugify(data.title);
    }
    
    if (data.pricingType !== undefined) {
      const pricingType = normalizePricingType(data.pricingType);
      if (!pricingType) {
        return res.status(400).json({ message: 'Choose Free, Subscription, or Special pricing.' });
      }
      data.pricingType = pricingType;
      data.isFree = pricingType === 'free';
    } else if (data.isFree !== undefined) {
      data.isFree = data.isFree === 'true' || data.isFree === true;
      data.pricingType = data.isFree ? 'free' : (opp.pricingType || 'special');
    }
    if (data.isFeatured !== undefined) data.isFeatured = data.isFeatured === 'true' || data.isFeatured === true;
    if (data.isPublished !== undefined) {
      data.isPublished = data.isPublished === 'true' || data.isPublished === true;
    }
    if (data.pricingType === 'free' || data.isFree === true) data.fees = 0;
    else if (data.pricingType !== undefined || data.isFree === false || data.fees !== undefined) {
      const pricing = { ...opp.toObject(), ...data };
      if (!validatePricing(pricing, res)) return;
      data.fees = pricing.fees;
    }

    const updatedOpp = await Opportunity.findByIdAndUpdate(req.params.id, data, { new: true });
    res.json(updatedOpp);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteOpportunity = async (req, res) => {
  try {
    const opp = await Opportunity.findByIdAndDelete(req.params.id);
    if (opp) res.json({ message: 'Opportunity removed' });
    else res.status(404).json({ message: 'Opportunity not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOpportunities,
  getAdminOpportunities,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity
};
