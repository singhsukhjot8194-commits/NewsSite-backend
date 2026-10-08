const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET_KEY;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET_KEY must be configured with at least 32 characters.');
  }
  return secret;
};

module.exports = getJwtSecret;
