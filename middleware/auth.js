const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const getJwtSecret = require("../utils/jwtSecret");

const JWT_EXPIRY = "1h";

const generateToken = (id) => {
  return jwt.sign({ id: id.toString() }, getJwtSecret(), {
    expiresIn: JWT_EXPIRY,
  });
};

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization || "";
  const parts = authorization.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") {
    return res.status(401).json({ message: "Not authorized, no valid token provided" });
  }

  const token = parts[1];

  let secret;
  try {
    secret = getJwtSecret();
  } catch (error) {
    return next(error);
  }

  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === "string" || !decoded.id) {
      return res.status(401).json({ message: "Not authorized, token failed" });
    }

    const admin = await Admin.findById(decoded.id).select("-password");
    if (!admin) {
      return res.status(401).json({ message: "Not authorized, admin account not found" });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

module.exports = { protect, generateToken, JWT_EXPIRY };
