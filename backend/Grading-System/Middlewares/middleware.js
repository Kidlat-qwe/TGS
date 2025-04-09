import jwt from 'jsonwebtoken';
import { pool } from '../db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from multiple possible locations
dotenv.config(); // Load from process root
dotenv.config({ path: path.join(__dirname, '..', '.env') }); // Load from Grading-System
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') }); // Load from backend

// Get JWT secret with fallbacks
const JWT_SECRET = process.env.JWT_SECRET || process.env.GRADING_JWT_SECRET || 'your-secret-key-here';

console.log('Grading System JWT_SECRET loaded:', JWT_SECRET ? '(secret is set)' : '(warning: secret not set)');

// Middleware to attach pool to request object
export const attachDb = (req, res, next) => {
    req.pool = pool;
    next();
};

// Authentication middleware
export const authenticateToken = (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            console.error('Authentication failed: No token provided');
            return res.status(401).json({ error: 'Authentication required' });
        }

        // Log token details for debugging
        console.log('Grading System - Token received:', token.substring(0, 10) + '...');
        console.log('Grading System - Verifying with JWT_SECRET:', JWT_SECRET.substring(0, 3) + '...');

        jwt.verify(token, JWT_SECRET, (err, user) => {
            if (err) {
                console.error('Token verification failed:', err.name, err.message);

                // Provide more specific error messages based on the type of JWT error
                if (err.name === 'JsonWebTokenError') {
                    return res.status(403).json({ 
                        error: 'Invalid token', 
                        details: 'The token signature is invalid',
                        message: 'Please check that you are using the correct token for this system'
                    });
                } else if (err.name === 'TokenExpiredError') {
                    return res.status(403).json({ 
                        error: 'Token expired', 
                        details: 'Your session has expired',
                        message: 'Please obtain a new token'
                    });
                } else {
                    return res.status(403).json({ 
                        error: 'Invalid token', 
                        details: err.message,
                        message: 'There was a problem with your authentication token'
                    });
                }
            }

            // Log the token payload for debugging
            console.log('Token payload:', JSON.stringify(user, null, 2));

            // Check if token is for grading system
            // More permissive check - allow tokens that don't specify a system or specify grading
            if (user.system && user.system !== 'grading') {
                console.error('Token system mismatch:', user.system);
                return res.status(403).json({ 
                    error: 'This token is not authorized for the grading system',
                    details: `Token system: ${user.system}`,
                    message: 'Please obtain a token specifically for the grading system'
                });
            }

            req.user = user;
            next();
        });
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