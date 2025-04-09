import express from 'express';
import { authenticateToken } from '../Middlewares/auth.js';
import db from '../db-config/db.js';

const router = express.Router();

// Root endpoint - will handle /api/evaluation
router.get('/', async (req, res) => {
  console.log('GET /api/evaluation - Received request to root evaluation route');
  res.json({
    status: 'Evaluation API is running',
    endpoints: [
      '/evaluations',
      '/evaluations/:id',
      '/evaluations/teacher/:teacherId',
      '/evaluations/table-info',
      '/evaluations/all-comment-replies'
    ]
  });
});

// Get all evaluations - will handle /api/evaluation/evaluations
router.get('/evaluations', async (req, res) => {
  console.log('GET /api/evaluation/evaluations - Received request');
  
  try {
    // First check if evaluations table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'evaluations'
      ) as exists
    `;
    
    console.log('Checking if evaluations table exists...');
    const tableResult = await db.pool.query(tableExistsQuery);
    const evaluationsTableExists = tableResult.rows[0].exists;
    console.log('Evaluations table exists:', evaluationsTableExists);
    
    if (!evaluationsTableExists) {
      // Create the evaluations table if it doesn't exist
      console.log('Creating evaluations table...');
      await db.pool.query(`
        CREATE TABLE evaluations (
          id SERIAL PRIMARY KEY,
          title VARCHAR(255),
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          teacher_id INTEGER,
          status VARCHAR(50) DEFAULT 'pending'
        )
      `);
      console.log('Created evaluations table');
      
      // Return empty array as there are no evaluations yet
      return res.json([]);
    }
    
    // Use a very simple query to avoid any type issues
    const query = 'SELECT * FROM evaluations ORDER BY id DESC';
    console.log('Executing simple query:', query);
    
    const result = await db.pool.query(query);
    console.log(`Fetched ${result.rows.length} evaluations`);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all evaluations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch evaluations', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get evaluations by teacher ID/email
router.get('/evaluations/teacher/:teacherId', authenticateToken, async (req, res) => {
  try {
    const teacherId = req.params.teacherId;
    
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID or email is required' });
    }
    
    // Check if evaluations table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'evaluations'
      ) as exists
    `;
    
    const tableResult = await db.pool.query(tableExistsQuery);
    const evaluationsTableExists = tableResult.rows[0].exists;
    
    if (!evaluationsTableExists) {
      // Return empty array if table doesn't exist
      return res.json([]);
    }
    
    // First, let's check what columns exist in the evaluations table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluations'
    `;
    
    const columnsResult = await db.pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    let query;
    let queryParams;
    
    if (teacherId.includes('@')) {
      // This is an email address
      if (columns.includes('teacher_email')) {
        // The table has a teacher_email column
        query = `
          SELECT * FROM evaluations
          WHERE teacher_email = $1
          ORDER BY id DESC
        `;
        queryParams = [teacherId];
      } else {
        // No teacher_email column, return empty result
        return res.json([]);
      }
    } else {
      // This is an ID
      if (columns.includes('teacher_id')) {
        query = `
          SELECT * FROM evaluations
          WHERE teacher_id = $1::integer
          ORDER BY id DESC
        `;
        queryParams = [teacherId];
      } else {
        // No teacher_id column, return empty result
        return res.json([]);
      }
    }
    
    const result = await db.pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error(`Error fetching evaluations for teacher ${req.params.teacherId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch evaluations by teacher', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Temporary route to inspect table structure
router.get('/evaluations/table-info', authenticateToken, async (req, res) => {
  try {
    // Check if evaluations table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'evaluations'
      ) as exists
    `;
    
    const tableResult = await db.pool.query(tableExistsQuery);
    const evaluationsTableExists = tableResult.rows[0].exists;
    
    if (!evaluationsTableExists) {
      return res.json({
        exists: false,
        message: "Evaluations table does not exist",
        columns: []
      });
    }
    
    // Query to get column information for the evaluations table
    const query = `
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'evaluations'
    `;
    
    const result = await db.pool.query(query);
    
    res.json({
      exists: true,
      columns: result.rows
    });
  } catch (error) {
    console.error('Error fetching table information:', error);
    res.status(500).json({ 
      error: 'Failed to fetch table information', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get all comment replies
router.get('/evaluations/all-comment-replies', async (req, res) => {
  try {
    console.log('Fetching all comment replies');
    
    // First check if comment_replies table exists
    try {
      // Create the table if it doesn't exist
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS comment_replies (
          id SERIAL PRIMARY KEY,
          evaluation_id INTEGER NOT NULL,
          reply_text TEXT NOT NULL,
          reply_by VARCHAR(255) NOT NULL,
          reply_type VARCHAR(50) DEFAULT 'teacher',
          reply_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Get all replies
      const query = `
        SELECT * FROM comment_replies 
        ORDER BY reply_at DESC
      `;
      
      const result = await db.pool.query(query);
      console.log(`Fetched ${result.rows.length} comment replies`);
      
      res.json(result.rows);
    } catch (dbError) {
      console.error('Database query error:', dbError);
      res.status(500).json({ 
        error: 'Database error', 
        details: dbError.message
      });
    }
  } catch (error) {
    console.error('Error fetching all comment replies:', error);
    res.status(500).json({ error: 'Failed to fetch all comment replies', details: error.message });
  }
});

// Get evaluation by ID - must be after all other specific routes
router.get('/evaluations/:id', authenticateToken, async (req, res) => {
  try {
    const evaluationId = req.params.id;
    
    if (!evaluationId || isNaN(evaluationId)) {
      return res.status(400).json({ error: 'Invalid evaluation ID' });
    }
    
    // Check if evaluations table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'evaluations'
      ) as exists
    `;
    
    const tableResult = await db.pool.query(tableExistsQuery);
    const evaluationsTableExists = tableResult.rows[0].exists;
    
    if (!evaluationsTableExists) {
      return res.status(404).json({ error: 'Evaluations table does not exist' });
    }
    
    // Use a simple query to get evaluation by ID
    const query = 'SELECT * FROM evaluations WHERE id = $1';
    console.log('Executing simple query:', query, 'with ID:', evaluationId);
    
    const result = await db.pool.query(query, [evaluationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching evaluation with ID ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch evaluation', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Add other evaluation-related routes here

export default router; 