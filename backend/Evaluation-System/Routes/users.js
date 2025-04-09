import express from 'express';
import { authenticateToken, isAdmin, csrfProtection } from '../Middlewares/auth.js';
import validator from '../Middlewares/validator.js';
import schemas from '../schemas/index.js';
import db from '../db-config/db.js';
import { extractUsername } from '../utils/helpers.js';

const router = express.Router();

// Get all users
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { userType } = req.query;
    
    let query = 'SELECT id, email, name, user_type FROM users';
    const queryParams = [];
    
    if (userType) {
      query += ' WHERE user_type = $1';
      queryParams.push(userType);
    }
    
    query += ' ORDER BY name';
    
    const result = await db.executeQuery(query, queryParams);
    
    // Format the response to include display names
    const users = result.rows.map(user => ({
      ...user,
      displayName: user.name || extractUsername(user.email)
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get users by type
router.get('/by-type', authenticateToken, async (req, res) => {
  try {
    const { userType } = req.query;
    
    if (!userType) {
      return res.status(400).json({ error: 'User type parameter is required' });
    }
    
    const query = 'SELECT id, email, name, user_type FROM users WHERE user_type = $1 ORDER BY name';
    const result = await db.executeQuery(query, [userType]);
    
    // Format the response to include display names
    const users = result.rows.map(user => ({
      ...user,
      displayName: user.name || extractUsername(user.email)
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by type:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users by type', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    // req.user contains the authenticated user's ID from the JWT token
    const userId = req.user.userId;
    
    const query = 'SELECT id, email, name, user_type FROM users WHERE id = $1';
    const result = await db.executeQuery(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // Format the response to include display name
    const userProfile = {
      ...user,
      displayName: user.name || extractUsername(user.email)
    };
    
    res.json(userProfile);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user profile', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get QA users
router.get('/qa-users', authenticateToken, async (req, res) => {
  try {
    // Check if the user is QA or admin
    if (req.user.userType !== 'qa' && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access' });
    }
    
    // Get all users with QA user type
    const result = await db.executeQuery(
      'SELECT id, email, name, user_type FROM users WHERE user_type = $1 ORDER BY name',
      ['qa']
    );
    
    // Format the response to include display names
    const users = result.rows.map(user => ({
      ...user,
      displayName: user.name || extractUsername(user.email)
    }));
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching QA users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch QA users', 
      details: error.message
    });
  }
});

// Create user (admin only)
router.post('/', authenticateToken, csrfProtection, isAdmin, validator.body(schemas.createUser), async (req, res) => {
  // Add your implementation from server.js
});

export default router; 