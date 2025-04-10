import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import fs from 'fs';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables with multiple fallback mechanisms
// First load from process root (for Render and other deployment platforms)
dotenv.config();

// Then try to load from the backend directory
const backendEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnvPath)) {
  console.log(`Grading Middleware: Loading environment variables from: ${backendEnvPath}`);
  dotenv.config({ path: backendEnvPath });
}

// Finally try to load from the Grading-System directory
const gradingEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(gradingEnvPath)) {
  console.log(`Grading Middleware: Loading environment variables from: ${gradingEnvPath}`);
  dotenv.config({ path: gradingEnvPath });
} else {
  console.warn(`Grading Middleware: Warning: .env file not found at ${gradingEnvPath}, using environment variables from parent directories or deployment platform`);
}

// Check for prefixed environment variables (from main backend .env)
// This helps with deployment platforms where all variables are in a single environment
if (!process.env.JWT_SECRET && process.env.GRADING_JWT_SECRET) {
  process.env.JWT_SECRET = process.env.GRADING_JWT_SECRET;
  console.log('Using prefixed JWT_SECRET from main backend .env file');
}

// Get JWT secret with fallbacks
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

console.log('Grading System JWT_SECRET loaded:', JWT_SECRET ? '(secret is set)' : '(warning: secret not set)');

// Middleware to attach pool to request object
export const attachDb = (req, res, next) => {
    req.pool = pool;
    next();
};

/**
 * Validates a token for the Grading System
 * @param {string} token - JWT token to validate
 * @returns {Object} Decoded token payload if valid
 * @throws {Error} If token is invalid or not authorized for grading system
 */
const validateGradingToken = (token) => {
    if (!token) {
        throw new Error('No token provided');
    }
    
    try {
        // Verify the token signature and expiration
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check if token is for grading system or unspecified (for backward compatibility)
        if (decoded.system && decoded.system !== 'grading') {
            throw new Error(`Token not authorized for grading system (system: ${decoded.system})`);
        }
        
        return decoded;
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token signature');
        } else if (error.name === 'TokenExpiredError') {
            throw new Error('Token has expired');
        } else {
            throw error;
        }
    }
};

/**
 * Middleware to authenticate and validate tokens for the Grading System
 */
export const authenticateToken = (req, res, next) => {
    try {
        // Extract token from Authorization header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        // Also check cookies if token not in header
        const cookieToken = req.cookies?.auth_token;
        
        const finalToken = token || cookieToken;

        if (!finalToken) {
            console.error('Authentication failed: No token provided');
            return res.status(401).json({ 
                error: 'Authentication required',
                message: 'No authentication token provided'
            });
        }

        // Log token details for debugging
        console.log('Grading System - Token received:', finalToken.substring(0, 10) + '...');
        console.log('Grading System - Verifying with JWT_SECRET:', JWT_SECRET.substring(0, 3) + '...');

        try {
            const decoded = validateGradingToken(finalToken);
            
            // Log the token payload for debugging
            console.log('Token payload:', JSON.stringify(decoded, null, 2));
            
            req.user = decoded;
            next();
        } catch (error) {
            console.error('Token validation failed:', error.message);
            
            return res.status(403).json({ 
                error: 'Authentication failed',
                message: error.message,
                details: 'Token validation failed'
            });
        }
    } catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(500).json({ 
            error: 'Authentication process failed',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Admin check middleware
export const isAdmin = (req, res, next) => {
    try {
        if (req.user.userType !== 'admin' && req.user.user_type !== 'admin' && req.user.role !== 'admin') {
            console.error('Admin access denied for user:', req.user);
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (error) {
        console.error('Admin check middleware error:', error);
        res.status(500).json({ error: 'Authorization process failed' });
    }
};

// Teacher check middleware
export const isTeacher = (req, res, next) => {
    try {
        if (req.user.userType !== 'teacher' && req.user.user_type !== 'teacher') {
            console.error('Teacher access denied for user:', req.user);
            return res.status(403).json({ error: 'Teacher access required' });
        }
        next();
    } catch (error) {
        console.error('Teacher check middleware error:', error);
        res.status(500).json({ error: 'Authorization process failed' });
    }
}; 