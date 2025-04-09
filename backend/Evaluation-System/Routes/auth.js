import express from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken, csrfProtection, isAdmin } from '../Middlewares/auth.js';
import { getCookieOptions } from '../utils/cookies.js';
import db from '../db-config/db.js';

const router = express.Router();

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;
// JWT expiration time from environment or default
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Allowed email domain - get from environment or use default
const ALLOWED_EMAIL_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'rhet-corp.com';

// Log the JWT configuration for debugging
console.log('Auth Routes - JWT configuration:');
console.log(`- JWT_SECRET: ${JWT_SECRET ? '✅ Set' : '❌ Not Set'}`);
console.log(`- JWT_EXPIRY: ${JWT_EXPIRY}`);
console.log(`- ALLOWED_EMAIL_DOMAIN: ${ALLOWED_EMAIL_DOMAIN}`);

// Validate email domain
const isAllowedEmailDomain = (email) => {
  return email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
};

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      email: user.email,
      userType: user.user_type
    }, 
    JWT_SECRET, 
    { 
      expiresIn: JWT_EXPIRY 
    }
  );
};

// Get CSRF token
router.get('/csrf-token', csrfProtection, (req, res) => {
  // Send the CSRF token
  res.json({ csrfToken: req.csrfToken() });
});

// Logout endpoint
router.post('/logout', csrfProtection, (req, res) => {
  res.clearCookie('auth_token', getCookieOptions());
  res.json({ success: true, message: 'Logged out successfully' });
});

// Authentication check endpoint
router.get('/check', authenticateToken, (req, res) => {
  res.json({ 
    authenticated: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      userType: req.user.userType
    }
  });
});

// Add login route here (from your server.js)
// router.post('/login', ...);

export default router; 