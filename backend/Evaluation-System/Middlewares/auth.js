import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with multiple fallback mechanisms
// First load from process root (for Render and other deployment platforms)
dotenv.config();

// Then try to load from the backend directory
const backendEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnvPath)) {
  console.log(`Auth Middleware: Loading environment variables from: ${backendEnvPath}`);
  dotenv.config({ path: backendEnvPath });
}

// Finally try to load from the Evaluation-System directory
const evaluationEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(evaluationEnvPath)) {
  console.log(`Auth Middleware: Loading environment variables from: ${evaluationEnvPath}`);
  dotenv.config({ path: evaluationEnvPath });
} else {
  console.warn(`Auth Middleware: Warning: .env file not found at ${evaluationEnvPath}, using environment variables from parent directories`);
}

// The JWT_SECRET should be available from one of the above sources
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Debug: Log the JWT_SECRET (first few chars only for security)
console.log(`Auth Middleware: Using JWT_SECRET: ${JWT_SECRET ? (JWT_SECRET.substring(0, 5) + '...') : 'Not set'}`);

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  console.log('Evaluation System - Verifying token with JWT_SECRET:', JWT_SECRET.substring(0, 5) + '...');
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error('Token verification failed:', err);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    // Check if token is for evaluation system
    if (user.system && user.system !== 'evaluation') {
      console.error('Token system mismatch:', user.system);
      return res.status(403).json({ error: 'This token is not authorized for the evaluation system' });
    }
    
    // Log the token payload for debugging
    console.log('Token payload:', user);
    
    req.user = user;
    next();
  });
};

export const isAdmin = (req, res, next) => {
  if (req.user.userType !== 'admin' && req.user.user_type !== 'admin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Add CSRF middleware if used in routes
export const csrfProtection = (req, res, next) => {
  // Implement CSRF protection if needed
  next();
}; 