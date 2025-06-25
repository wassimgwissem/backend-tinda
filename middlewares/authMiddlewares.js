// const jwt = require('jsonwebtoken');
// const dotenv = require('dotenv');

// dotenv.config();

// const JWT_SECRET = process.env.JWT_SECRET;

// const authMiddleware = (req, res, next) => {
//     const authHeader = req.headers.authorization;
//     if (!authHeader) return res.status(401).json({ error: 'No token provided' });
//     const token = authHeader.split(' ')[1];
//     try {
//         const decoded = jwt.verify(token, JWT_SECRET);
//         req.user = decoded;
//         next();
//     } catch {
//         res.status(401).json({ error: 'Invalid token' });
//     }
// }
// module.exports = authMiddleware;
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const authMiddleware = (req, res, next) => {
  // Try cookie first, then Authorization header
  const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.clearCookie('token');
    res.status(401).json({ 
      error: 'Invalid session',
      details: err.name === 'TokenExpiredError' ? 'Session expired' : 'Invalid token'
    });
  }
};
module.exports = authMiddleware;
