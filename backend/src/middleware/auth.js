const jwt = require('jsonwebtoken');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set. Refusing to start without a signing key.');
}

function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  // Also accept ?token= for browser-opened print/download URLs
  const raw = (header && header.startsWith('Bearer ') ? header.slice(7) : null) || req.query.token;
  if (!raw) {
    return res.status(401).json({ success: false, error: 'Missing or invalid Authorization header' });
  }

  const token = raw;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, role: payload.role, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token invalid or expired' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = { authenticate, authorize };
