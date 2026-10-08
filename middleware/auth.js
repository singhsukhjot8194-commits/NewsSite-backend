const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const getJwtSecret = require('../utils/jwtSecret');

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token, ...extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || extra.length) {
    return res.status(401).json({ message: 'Not authorized, no valid token provided' });
  }

  let secret;
  try {
    secret = getJwtSecret();
  } catch (error) {
    return next(error);
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string' || !decoded.id) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }

    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin) {
      return res.status(401).json({ message: 'Not authorized, admin account not found' });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token failed' });
  }
};

module.exports = { protect };
