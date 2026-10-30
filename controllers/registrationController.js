const mongoose = require("mongoose");
const Registration = require("../models/Registration");
const Opportunity = require("../models/Opportunity");
const xlsx = require("xlsx");

const allowedRegFields = [
  "name",
  "email",
  "phone",
  "opportunityId",
  "transactionReference",
  "paymentMethod",
  "amount",
  "status"
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

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getRegistrationQuery = (params) => {
  const query = {};
  if (params.opportunityId) query.opportunity = params.opportunityId;
  if (params.status && ["pending", "confirmed", "cancelled"].includes(params.status)) {
    query.status = params.status;
  }
  if (params.paymentStatus && ["not_required", "pending", "paid", "failed"].includes(params.paymentStatus)) {
    query.paymentStatus = params.paymentStatus;
  }
  if (params.paymentMethod && ["card", "stripe", "orange", "lonestar", "free"].includes(params.paymentMethod)) {
    query.paymentMethod = params.paymentMethod;
  }
  if (params.localOnly === "true" || params.localOnly === true) {
    query.paymentMethod = { $in: ["orange", "lonestar"] };
  }
  if (params.search) {
    const search = String(params.search).trim();
    if (search.length > 0 && search.length <= 100) {
      const escaped = escapeRegExp(search);
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
        { transactionReference: { $regex: escaped, $options: "i" } }
      ];
    }
  }
  return query;
};

const createRegistration = async (req, res) => {
  try {
    const data = pickAllowed(req.body, allowedRegFields);
    let paymentMethod = data.paymentMethod || "card";

    if (!data.name || !data.email || !data.phone || !data.opportunityId) {
      return res.status(400).json({ message: "Name, email, phone, and opportunity are required" });
    }

    const name = sanitizeString(data.name);
    const email = sanitizeString(data.email).toLowerCase();
    const phone = sanitizeString(data.phone);

    let opp;
    if (mongoose.isValidObjectId(data.opportunityId)) {
      opp = await Opportunity.findById(data.opportunityId);
    }
    if (!opp) {
      opp = await Opportunity.findOne({ slug: data.opportunityId });
    }
    if (!opp) return res.status(404).json({ message: "Opportunity not found" });

    if (opp.totalSeats && opp.filledSeats >= opp.totalSeats) {
      return res.status(409).json({ message: "No seats available" });
    }

    if (opp.deadline && new Date() > new Date(opp.deadline)) {
      return res.status(409).json({ message: "Registration deadline has passed" });
    }

    const isFree = opp.isFree || opp.pricingType === "free";
    if (isFree) {
      paymentMethod = "free";
    }

    let paymentProof = null;
    if (req.file && req.file.path) {
      paymentProof = req.file.path;
    } else if (typeof data.transactionReference === "string" && data.transactionReference.trim()) {
      paymentProof = data.transactionReference.trim();
    }

    let accountHolder = null;
    if (paymentMethod === "orange") {
      accountHolder = "Myean D Torgean";
    } else if (paymentMethod === "lonestar") {
      accountHolder = "Myean D Torgbean";
    }

    let finalAmount = isFree ? 0 : (opp.fees || 0);
    if (data.amount && Number(data.amount) > 0 && (opp.type === "Donation" || opp.slug === "support-our-journalism")) {
      const amt = Number(data.amount);
      if (amt < 0.5 || amt > 999999.99 || !Number.isFinite(amt)) {
        return res.status(400).json({ message: "Invalid donation amount" });
      }
      finalAmount = amt;
    }

    const registrationData = {
      name,
      email,
      phone,
      opportunity: opp._id,
      paymentMethod,
      accountHolder,
      transactionReference: data.transactionReference ? sanitizeString(data.transactionReference) : "",
      paymentProof,
      status: "pending",
      paymentStatus: isFree ? "not_required" : (paymentMethod === "orange" || paymentMethod === "lonestar") ? "pending" : "pending",
      amountPaid: finalAmount
    };

    const registration = await Registration.create(registrationData);

    opp.filledSeats = (opp.filledSeats || 0) + 1;
    await opp.save();

    await registration.populate("opportunity", "title type fees pricingType");

    res.status(201).json({
      success: true,
      message: (paymentMethod === "orange" || paymentMethod === "lonestar")
        ? "Transaction submitted for verification. We will send you confirmation shortly."
        : "Registration created successfully.",
      registration
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create registration" });
  }
};

const getRegistrations = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const query = getRegistrationQuery(req.query);

    const registrations = await Registration.find(query)
      .populate("opportunity", "title type")
      .sort({ registeredAt: -1 })
      .skip(skip)
      .limit(limit);
    const total = await Registration.countDocuments(query);

    res.json({ registrations, page, pages: Math.ceil(total / limit), total });
  } catch (error) {
    res.status(500).json({ message: "Failed to load registrations" });
  }
};

const updateRegistrationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid registration status" });
    }
    const registration = await Registration.findById(req.params.id);
    if (!registration) return res.status(404).json({ message: "Registration not found" });
    registration.status = status;
    await registration.save();
    res.json(registration);
  } catch (error) {
    res.status(500).json({ message: "Failed to update status" });
  }
};

const updateRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const data = pickAllowed(req.body, allowedRegFields);
    if (data.status !== undefined && !["pending", "confirmed", "cancelled"].includes(data.status)) {
      return res.status(400).json({ message: "Invalid registration status" });
    }

    const opportunityChanged = data.opportunityId
      && data.opportunityId !== registration.opportunity.toString();
    let previousOpportunity;
    let nextOpportunity;
    if (opportunityChanged) {
      [previousOpportunity, nextOpportunity] = await Promise.all([
        Opportunity.findById(registration.opportunity),
        Opportunity.findById(data.opportunityId)
      ]);
      if (!nextOpportunity) {
        return res.status(404).json({ message: "Opportunity not found" });
      }
    }

    if (data.name !== undefined) registration.name = sanitizeString(data.name);
    if (data.email !== undefined) registration.email = sanitizeString(data.email).toLowerCase();
    if (data.phone !== undefined) registration.phone = sanitizeString(data.phone);
    if (data.status !== undefined) registration.status = data.status;
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

    await registration.populate("opportunity", "title type");
    return res.json(registration);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update registration" });
  }
};

const deleteRegistration = async (req, res) => {
  try {
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    const opportunity = await Opportunity.findById(registration.opportunity);
    await registration.deleteOne();

    if (opportunity) {
      opportunity.filledSeats = Math.max(0, (opportunity.filledSeats || 0) - 1);
      await opportunity.save();
    }

    return res.json({ message: "Registration deleted" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete registration" });
  }
};

const exportRegistrations = async (req, res) => {
  try {
    const query = getRegistrationQuery(req.query);
    const registrations = await Registration.find(query)
      .populate("opportunity", "title type")
      .sort({ registeredAt: -1 });
    const format = req.query.format === "csv" ? "csv" : "xlsx";

    const data = registrations.map((reg) => {
      const opportunityTitle = reg.opportunity
        ? `${reg.opportunity.title} (${reg.opportunity.type})`
        : "N/A";
      return {
        Name: reg.name,
        Email: reg.email,
        Phone: reg.phone,
        ClassOrOpportunity: opportunityTitle,
        PaymentMethod: reg.paymentMethod || "card",
        PaymentStatus: reg.paymentStatus || "not_required",
        PaymentProof: reg.paymentProof || "",
        AccountHolder: reg.accountHolder || "",
        RegisteredAt: reg.registeredAt ? reg.registeredAt.toISOString() : "",
        Status: reg.status
      };
    });

    const exportData = data.map((registration) =>
      Object.fromEntries(
        Object.entries(registration).map(([key, value]) => [
          key,
          typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/.test(value)
            ? `'${value}`
            : value
        ])
      )
    );

    const worksheet = xlsx.utils.json_to_sheet(exportData);
    const filename = `registrations.${format}`;

    if (format === "csv") {
      const csv = xlsx.utils.sheet_to_csv(worksheet, {
        forceQuotes: true,
        blankrows: false
      });
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      return res.send(`\uFEFF${csv}`);
    }

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, "Registrations");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    return res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: "Failed to export registrations" });
  }
};

const verifyLocalPayment = async (req, res) => {
  try {
    const { action } = req.body;
    const registration = await Registration.findById(req.params.id);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }

    if (action === "reject") {
      registration.paymentStatus = "failed";
      registration.status = "cancelled";
    } else if (action === "approve") {
      registration.paymentStatus = "paid";
      registration.status = "confirmed";
    } else {
      return res.status(400).json({ message: "Invalid action" });
    }

    await registration.save();
    await registration.populate("opportunity", "title type");

    res.json({
      success: true,
      message: action === "reject" ? "Payment rejected" : "Payment verified and registration confirmed",
      registration
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify payment" });
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
