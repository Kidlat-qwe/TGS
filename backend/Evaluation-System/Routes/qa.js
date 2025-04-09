import express from 'express';
import { authenticateToken } from '../Middlewares/auth.js';
import db from '../db-config/db.js';

const router = express.Router();

// Get all QA evaluations
router.get('/evaluations', authenticateToken, async (req, res) => {
  try {
    // Check if the user is QA or admin
    if (req.user.userType !== 'qa' && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access. Only QA and admin users can access QA evaluations.' });
    }
    
    // First, let's check what columns exist in the evaluations table
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluations'
    `;
    
    const columnsResult = await db.pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    // Build a query based on existing columns to avoid errors
    let query = 'SELECT e.* FROM evaluations e';
    
    // Add join with users table if teacher_id exists
    if (columns.includes('teacher_id')) {
      query += ' LEFT JOIN users u ON e.teacher_id = u.id::text';
    }
    
    // Filter by QA status if the column exists
    if (columns.includes('qa_status')) {
      query += ' WHERE e.qa_status IS NOT NULL';
    }
    
    // Add order by if created_at exists
    if (columns.includes('created_at')) {
      query += ' ORDER BY e.created_at DESC';
    } else {
      query += ' ORDER BY e.id DESC'; // Fallback to id
    }
    
    console.log('Executing query:', query);
    const result = await db.pool.query(query);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching QA evaluations:', error);
    res.status(500).json({ 
      error: 'Failed to fetch QA evaluations', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get QA evaluation by ID
router.get('/evaluations/:id', authenticateToken, async (req, res) => {
  try {
    const evaluationId = req.params.id;
    
    // Check if the user is QA or admin
    if (req.user.userType !== 'qa' && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access. Only QA and admin users can access QA evaluations.' });
    }
    
    if (!evaluationId || isNaN(evaluationId)) {
      return res.status(400).json({ error: 'Invalid evaluation ID' });
    }
    
    // Check what columns exist
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluations'
    `;
    
    const columnsResult = await db.pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    // Build a query based on existing columns
    let query = 'SELECT e.* FROM evaluations e';
    
    // Add join with users if teacher_id exists
    if (columns.includes('teacher_id')) {
      query += ' LEFT JOIN users u ON e.teacher_id = u.id::text';
      // Include teacher info in selection
      query = query.replace('SELECT e.*', 'SELECT e.*, u.name as teacher_name, u.email as teacher_email');
    }
    
    // Add WHERE clause for ID
    query += ' WHERE e.id = $1';
    
    // Add QA status filter if the column exists
    if (columns.includes('qa_status')) {
      query += ' AND e.qa_status IS NOT NULL';
    }
    
    console.log('Executing single evaluation query:', query);
    const result = await db.pool.query(query, [evaluationId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'QA evaluation not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching QA evaluation with ID ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch QA evaluation', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Update QA status for an evaluation
router.put('/evaluations/:id', authenticateToken, async (req, res) => {
  try {
    const evaluationId = req.params.id;
    const { qa_status, qa_comments } = req.body;
    
    // Check if the user is QA or admin
    if (req.user.userType !== 'qa' && req.user.userType !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access. Only QA and admin users can update QA evaluations.' });
    }
    
    if (!evaluationId || isNaN(evaluationId)) {
      return res.status(400).json({ error: 'Invalid evaluation ID' });
    }
    
    if (!qa_status) {
      return res.status(400).json({ error: 'QA status is required' });
    }
    
    // Check what columns exist
    const columnsQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'evaluations'
    `;
    
    const columnsResult = await db.pool.query(columnsQuery);
    const columns = columnsResult.rows.map(row => row.column_name);
    
    // If required columns don't exist, return error
    if (!columns.includes('qa_status')) {
      return res.status(400).json({ error: 'QA status column does not exist in the database' });
    }
    
    // Build the update query based on existing columns
    let updateFields = ['qa_status = $1'];
    const queryParams = [qa_status];
    let paramIndex = 2;
    
    if (columns.includes('qa_comments')) {
      updateFields.push(`qa_comments = $${paramIndex}`);
      queryParams.push(qa_comments || null);
      paramIndex++;
    }
    
    if (columns.includes('qa_updated_at')) {
      updateFields.push(`qa_updated_at = CURRENT_TIMESTAMP`);
    }
    
    if (columns.includes('qa_updated_by')) {
      updateFields.push(`qa_updated_by = $${paramIndex}`);
      queryParams.push(req.user.userId);
      paramIndex++;
    }
    
    // Add the evaluation ID as the last parameter
    queryParams.push(evaluationId);
    
    const query = `
      UPDATE evaluations
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    console.log('Executing update query:', query);
    const result = await db.pool.query(query, queryParams);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }
    
    res.json({
      success: true,
      message: 'QA status updated successfully',
      evaluation: result.rows[0]
    });
  } catch (error) {
    console.error(`Error updating QA status for evaluation ID ${req.params.id}:`, error);
    res.status(500).json({ 
      error: 'Failed to update QA status', 
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router; 