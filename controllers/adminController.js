const Admin = require("../models/Admin");
const jwt = require("jsonwebtoken");
const getJwtSecret = require("../utils/jwtSecret");

const generateToken = (id) => {
  return jwt.sign({ id: id.toString() }, getJwtSecret(), {
    expiresIn: "1h",
  });
};

const authAdmin = async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }
    const admin = await Admin.findOne({ email: String(email).toLowerCase() });
    if (!admin || !(await admin.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }
    res.json({
      _id: admin._id,
      email: admin.email,
      token: generateToken(admin._id),
    });
  } catch (error) {
    res.status(500).json({ message: "Authentication failed" });
  }
};

module.exports = { authAdmin };
