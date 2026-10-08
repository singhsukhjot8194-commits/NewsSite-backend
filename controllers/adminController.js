const Admin = require('../models/Admin');
const jwt = require('jsonwebtoken');
const getJwtSecret = require('../utils/jwtSecret');

const generateToken = (id) => {
  return jwt.sign({ id: id.toString() }, getJwtSecret(), {
    expiresIn: '30d',
  });
};

const authAdmin = async (req, res) => {
  const { email, password } = req.body;
  try {
    const admin = await Admin.findOne({ email });
    if (admin && (await admin.matchPassword(password))) {
      res.json({
        _id: admin._id,
        email: admin.email,
        token: generateToken(admin._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { authAdmin };
