const Opportunity = require('../models/Opportunity');
const Registration = require('../models/Registration');
const slugify = require('../utils/slugify');

const getOpportunityList = async (req, res, includeUnpublished) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = includeUnpublished
      ? {}
      : { $or: [{ isPublished: true }, { isPublished: { $exists: false } }] };
    if (req.query.type) {
      query.type = req.query.type;
    } else if (!includeUnpublished) {
      query.type = { $ne: 'Donation' };
    }
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
    if (req.file) data.banner = req.file.path;
    
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
    if (req.file) data.banner = req.file.path;
    
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

// Curriculum Management (Admin)
const getCurriculum = async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ message: 'Course not found' });
    const sorted = [...(opp.curriculum || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    res.json({ curriculum: sorted, courseTitle: opp.title, courseId: opp._id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addCurriculumTopic = async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ message: 'Course not found' });

    const { title, summary, content, order } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Topic title is required' });
    }

    const images = [];
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((f) => images.push(f.path));
    } else if (req.file) {
      images.push(req.file.path);
    }

    let parsedResources = [];
    if (req.body.resources) {
      try {
        parsedResources = typeof req.body.resources === 'string'
          ? JSON.parse(req.body.resources)
          : req.body.resources;
      } catch (e) {
        parsedResources = [];
      }
    }

    const newTopic = {
      title: title.trim(),
      summary: summary ? summary.trim() : '',
      content: content ? content.trim() : '',
      order: order ? Number(order) : (opp.curriculum.length + 1),
      images,
      resources: Array.isArray(parsedResources) ? parsedResources : []
    };

    opp.curriculum.push(newTopic);
    await opp.save();

    res.status(201).json({
      success: true,
      message: 'Topic added successfully',
      topic: opp.curriculum[opp.curriculum.length - 1],
      curriculum: opp.curriculum
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateCurriculumTopic = async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ message: 'Course not found' });

    const topic = opp.curriculum.id(req.params.topicId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    const { title, summary, content, order, existingImages } = req.body;
    if (title) topic.title = title.trim();
    if (summary !== undefined) topic.summary = summary.trim();
    if (content !== undefined) topic.content = content.trim();
    if (order !== undefined) topic.order = Number(order);

    let images = [];
    if (existingImages) {
      try {
        images = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
      } catch (e) {
        images = topic.images || [];
      }
    } else {
      images = topic.images || [];
    }

    if (req.files && Array.isArray(req.files)) {
      req.files.forEach((f) => images.push(f.path));
    } else if (req.file) {
      images.push(req.file.path);
    }
    topic.images = images;

    if (req.body.resources) {
      try {
        topic.resources = typeof req.body.resources === 'string'
          ? JSON.parse(req.body.resources)
          : req.body.resources;
      } catch (e) {}
    }

    await opp.save();
    res.json({ success: true, message: 'Topic updated successfully', topic });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteCurriculumTopic = async (req, res) => {
  try {
    const opp = await Opportunity.findById(req.params.id);
    if (!opp) return res.status(404).json({ message: 'Course not found' });

    const topic = opp.curriculum.id(req.params.topicId);
    if (!topic) return res.status(404).json({ message: 'Topic not found' });

    topic.deleteOne();
    await opp.save();

    res.json({ success: true, message: 'Topic deleted successfully', curriculum: opp.curriculum });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Classroom Access Verification (Student Portal)
const accessClassroom = async (req, res) => {
  try {
    const { email, phone } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Please enter your registered email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(req.params.id);
    const oppQuery = isObjectId ? { _id: req.params.id } : { slug: req.params.id };

    const opp = await Opportunity.findOne(oppQuery);
    if (!opp) return res.status(404).json({ message: 'Course not found.' });

    // Look up registration for this course
    const regQuery = {
      opportunity: opp._id,
      email: cleanEmail
    };
    if (phone && phone.trim()) {
      regQuery.$or = [{ email: cleanEmail }, { phone: phone.trim() }];
      delete regQuery.email;
    }

    const registration = await Registration.findOne(regQuery).sort({ createdAt: -1 });

    if (!registration) {
      return res.status(403).json({
        allowed: false,
        reason: 'not_enrolled',
        message: 'No enrollment found for this email address. Please register for this course first.'
      });
    }

    const isFree = opp.isFree || opp.pricingType === 'free';
    const isPaid = registration.paymentStatus === 'paid';

    if (!isFree && !isPaid) {
      const isFailed = registration.paymentStatus === 'failed' || registration.status === 'cancelled';
      if (isFailed) {
        return res.status(403).json({
          allowed: false,
          reason: 'payment_failed',
          message: 'Payment verification failed or registration was cancelled. Please contact support.'
        });
      }
      return res.status(403).json({
        allowed: false,
        reason: 'pending_verification',
        message: 'Your payment is currently pending verification. Once verified via Stripe or approved by our admin (for Orange/Lonestar Mobile Money), you will be granted access immediately.'
      });
    }

    // Access Granted!
    const sortedCurriculum = [...(opp.curriculum || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

    res.json({
      allowed: true,
      student: {
        id: registration._id,
        name: registration.name,
        email: registration.email,
        paymentStatus: registration.paymentStatus,
        paymentMethod: registration.paymentMethod
      },
      course: {
        id: opp._id,
        title: opp.title,
        type: opp.type,
        banner: opp.banner,
        shortDesc: opp.shortDesc,
        mode: opp.mode
      },
      curriculum: sortedCurriculum
    });
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
  deleteOpportunity,
  getCurriculum,
  addCurriculumTopic,
  updateCurriculumTopic,
  deleteCurriculumTopic,
  accessClassroom
};
