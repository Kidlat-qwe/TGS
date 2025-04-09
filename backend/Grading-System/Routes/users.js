import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all users with pagination
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // First get total count
    const totalResult = await pool.query('SELECT COUNT(*) FROM users');
    const total = parseInt(totalResult.rows[0].count);

    // Then get paginated data
    const result = await pool.query(
      'SELECT * FROM users ORDER BY user_id LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      users: result.rows,
      total: total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user by ID
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const query = `
      SELECT 
        user_id,
        email,
        user_type,
        fname,
        mname,
        lname,
        gender,
        teacher_status
      FROM users 
      WHERE user_id = $1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get user by email
router.get('/byEmail/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Validate email parameter
    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required' });
    }
    
    // Query the database for the user with the provided email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    
    // If no user found, return 404
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return the user data
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user by email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user by firebase_uid
router.get('/firebase/:firebaseUid', async (req, res) => {
  try {
    const { firebaseUid } = req.params;
    console.log('Fetching user with firebase_uid:', firebaseUid);
    
    const query = `
      SELECT 
        user_id,
        email,
        user_type,
        fname,
        mname,
        lname,
        gender,
        teacher_status,
        firebase_uid
      FROM users 
      WHERE firebase_uid = $1
    `;
    
    const result = await pool.query(query, [firebaseUid]);
    console.log('Query result:', result.rows);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching user by firebase_uid:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    // Check for Firebase user ID in headers or query
    const firebaseUid = req.headers.firebase_uid || req.query.firebase_uid;
    
    if (!firebaseUid) {
      console.log('No firebase_uid provided in request');
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please provide firebase_uid in either headers or query parameters'
      });
    }
    
    console.log('Fetching user profile with firebase_uid:', firebaseUid);
    
    // Use a simpler query with only basic fields to avoid column mismatch
    const query = `
      SELECT 
        user_id,
        email,
        user_type,
        fname,
        mname,
        lname,
        gender
      FROM users 
      WHERE firebase_uid = $1
    `;
    
    const result = await pool.query(query, [firebaseUid]);
    console.log('Query executed successfully');
    
    if (result.rows.length === 0) {
      console.log(`User with firebase_uid ${firebaseUid} not found`);
      return res.status(404).json({ 
        error: 'User not found',
        message: `No user found with the provided firebase_uid: ${firebaseUid}`
      });
    }
    
    console.log(`Found user: ${result.rows[0].fname} ${result.rows[0].lname}`);
    
    // Return user profile
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    console.error('Detailed error info:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user data',
      message: error.message,
      stack: error.stack
    });
  }
});

// Create a new user
router.post('/', async (req, res) => {
  try {
    const {
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      firebase_uid
    } = req.body;

    const query = `
      INSERT INTO users (
        email,
        fname,
        mname,
        lname,
        gender,
        user_type,
        teacher_status,
        firebase_uid
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      firebase_uid
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a user
router.put('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const {
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status
    } = req.body;

    // First check if the user exists
    const checkUser = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
    
    if (checkUser.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const query = `
      UPDATE users
      SET 
        email = $1,
        fname = $2,
        mname = $3,
        lname = $4,
        gender = $5,
        user_type = $6,
        teacher_status = $7
      WHERE user_id = $8
      RETURNING *
    `;

    const values = [
      email,
      fname,
      mname,
      lname,
      gender,
      user_type,
      teacher_status,
      userId
    ];

    const result = await pool.query(query, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 