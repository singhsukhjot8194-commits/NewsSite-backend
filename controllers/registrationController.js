const mongoose = require('mongoose');
const Registration = require('../models/Registration');
const Opportunity = require('../models/Opportunity');
const xlsx = require('xlsx');

const getRegistrationQuery = (params) => {
  const query = {};
  if (params.opportunityId) query.opportunity = params.opportunityId;
  if (params.status) query.status = params.status;
  if (params.paymentStatus) query.paymentStatus = params.paymentStatus;
  if (params.paymentMethod) query.paymentMethod = params.paymentMethod;
  if (params.localOnly === 'true' || params.localOnly === true) {
    query.paymentMethod = { $in: ['orange', 'lonestar'] };
  }
  if (params.search) {
    const search = params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { transactionReference: { $regex: search, $options: 'i' } }
    ];
  }
  return query;
};

const createRegistration = async (req, res) => {
  try {
    const { name, email, phone, opportunityId, transactionReference } = req.body;
    let paymentMethod = req.body.paymentMethod || 'card';

    if (!name || !email || !phone || !opportunityId) {
      return res.status(400).json({ message: 'Name, email, phone, and opportunity are required' });
    }

    let opp;
    if (mongoose.isValidObjectId(opportunityId)) {
      opp = await Opportunity.findById(opportunityId);
    }
    if (!opp) {
      opp = await Opportunity.findOne({ slug: opportunityId });
    }
    if (!opp) return res.status(404).json({ message: 'Opportunity not found' });

    // Check seat availability
    if (opp.totalSeats && opp.filledSeats >= opp.totalSeats) {
      return res.status(409).json({ message: 'No seats available' });
    }

    // Check registration deadline
    if (opp.deadline && new Date() > new Date(opp.deadline)) {
      return res.status(409).json({ message: 'Registration deadline has passed' });
    }

    const isFree = opp.isFree || opp.pricingType === 'free';
    if (isFree) {
      paymentMethod = 'free';
    }

    let paymentProof = null;
    if (req.file && req.file.path) {
      paymentProof = req.file.path;
    } else if (typeof req.body.paymentProof === 'string' && req.body.paymentProof.trim()) {
      paymentProof = req.body.paymentProof.trim();
    }

    let accountHolder = null;
    if (paymentMethod === 'orange') {
      accountHolder = 'Myean D Torgean';
    } else if (paymentMethod === 'lonestar') {
      accountHolder = 'Myean D Torgbean';
    }

    let finalAmount = isFree ? 0 : (opp.fees || 0);
    if (req.body.amount && Number(req.body.amount) > 0) {
      finalAmount = Number(req.body.amount);
    }

    const registrationData = {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      opportunity: opp._id,
      paymentMethod,
      accountHolder,
      transactionReference: transactionReference ? transactionReference.trim() : '',
      paymentProof,
      status: 'pending',
      paymentStatus: isFree ? 'not_required' : (paymentMethod === 'orange' || paymentMethod === 'lonestar') ? 'pending' : 'pending',
      amountPaid: finalAmount
    };

    const registration = await Registration.create(registrationData);

    opp.filledSeats = (opp.filledSeats || 0) + 1;
    await opp.save();

    await registration.populate('opportunity', 'title type fees pricingType');

    res.status(201).json({
      success: true,
      message: (paymentMethod === 'orange' || paymentMethod === 'lonestar')
        ? 'Transaction submitted for verification. We will send you confirmation shortly.'
        : 'Registration created successfully.',
      registration
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getRegistrations = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = getRegistrationQuery(req.query);

    const registrations = await Registration.find(query).populate('opportunity', 'title type').sort({ registeredAt: -1 }).skip(skip).limit(limit);
    const total = await Registration.countDocuments(query);

    res.json({ registrations, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateRegistrationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid registration status' });
    }
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    registration.status = status;
    await registration.save();
    res.json(registration);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const { name, email, phone, opportunityId, status } = req.body;
    if (status !== undefined && !['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid registration status' });
    }

    const opportunityChanged = opportunityId
      && opportunityId !== registration.opportunity.toString();
    let previousOpportunity;
    let nextOpportunity;
    if (opportunityChanged) {
      [previousOpportunity, nextOpportunity] = await Promise.all([
        Opportunity.findById(registration.opportunity),
        Opportunity.findById(opportunityId)
      ]);
      if (!nextOpportunity) {
        return res.status(404).json({ message: 'Opportunity not found' });
      }
    }

    if (name !== undefined) registration.name = name;
    if (email !== undefined) registration.email = email;
    if (phone !== undefined) registration.phone = phone;
    if (status !== undefined) registration.status = status;
    if (opportunityChanged) registration.opportunity = nextOpportunity._id;
    await registration.save();

    if (opportunityChanged) {
      if (previousOpportunity) {
        previousOpportunity.filledSeats = Math.max(0, (previousOpportunity.filledSeats || 0) - 1);
      }
      nextOpportunity.filledSeats = (nextOpportunity.filledSeats || 0) + 1;
      await Promise.all([
        previousOpportunity?.save(),
        nextOpportunity.save()
      ]);
    }

    await registration.populate('opportunity', 'title type');
    return res.json(registration);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const deleteRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    const opportunity = await Opportunity.findById(registration.opportunity);
    await registration.deleteOne();

    if (opportunity) {
      opportunity.filledSeats = Math.max(0, (opportunity.filledSeats || 0) - 1);
      await opportunity.save();
    }

    return res.json({ message: 'Registration deleted' });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

const exportRegistrations = async (req, res) => {
  try {
    const query = getRegistrationQuery(req.query);
    const registrations = await Registration.find(query)
      .populate('opportunity', 'title type')
      .sort({ registeredAt: -1 });
    const format = req.query.format === 'csv' ? 'csv' : 'xlsx';

    const data = registrations.map((reg) => ({
      Name: reg.name,
      Email: reg.email,
      Phone: reg.phone,
      ClassOrOpportunity: reg.opportunity
        ? `${reg.opportunity.title} (${reg.opportunity.type})`
        : 'N/A',
      PaymentMethod: reg.paymentMethod || 'card',
      PaymentStatus: reg.paymentStatus || 'not_required',
      PaymentProof: reg.paymentProof || '',
      AccountHolder: reg.accountHolder || '',
      RegisteredAt: reg.registeredAt ? reg.registeredAt.toISOString() : '',
      Status: reg.status
    }));

    const exportData = format === 'csv'
      ? data.map((registration) =>
        Object.fromEntries(
          Object.entries(registration).map(([key, value]) => [
            key,
            typeof value === 'string' && /^[\u0000-\u0020]*[=+\-@]/.test(value)
              ? `'${value}`
              : value
          ])
        )
      )
      : data;
    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const filename = `registrations.${format}`;

    if (format === 'csv') {
      const csv = xlsx.utils.sheet_to_csv(worksheet, {
        forceQuotes: true,
        blankrows: false
      });
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      return res.send(`\uFEFF${csv}`);
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Registrations');
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const verifyLocalPayment = async (req, res) => {
  try {
    const { action } = req.body; // 'approve' or 'reject'
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: 'Registration not found' });
    }

    if (action === 'reject') {
      registration.paymentStatus = 'failed';
      registration.status = 'cancelled';
    } else {
      registration.paymentStatus = 'paid';
      registration.status = 'confirmed';
    }

    await registration.save();
    await registration.populate('opportunity', 'title type');

    res.json({
      success: true,
      message: action === 'reject' ? 'Payment rejected' : 'Payment verified and registration confirmed',
      registration
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  createRegistration,
  getRegistrations,
  deleteRegistration,
  updateRegistration,
  updateRegistrationStatus,
  exportRegistrations,
  verifyLocalPayment
};
