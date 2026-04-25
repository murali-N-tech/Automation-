const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded; // { id: '...', email: '...' }
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Backward-compatible exports:
// - const { requireAuth } = require('...')
// - const authMiddleware = require('...')
module.exports = requireAuth;
module.exports.requireAuth = requireAuth;
module.exports.authMiddleware = requireAuth;