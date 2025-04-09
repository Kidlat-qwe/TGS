import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all subjects
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM subject');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching subjects:', error);
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// Create a new subject
router.post('/', async (req, res) => {
  try {
    const { subjectName } = req.body;
    const result = await pool.query(
      'INSERT INTO subject (subject_name) VALUES ($1) RETURNING *',
      [subjectName]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding subject:', error);
    res.status(500).json({ error: 'Failed to add subject' });
  }
});

// Update a subject
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectName } = req.body;
    const result = await pool.query(
      'UPDATE subject SET subject_name = $1 WHERE subject_id = $2 RETURNING *',
      [subjectName, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject:', error);
    res.status(500).json({ error: 'Failed to update subject' });
  }
});

// Get subject by name
router.get('/by-name/:subjectName', async (req, res) => {
  try {
    const { subjectName } = req.params;
    
    // Validate parameter
    if (!subjectName) {
      return res.status(400).json({ error: 'Subject name is required' });
    }
    
    const result = await pool.query(
      'SELECT * FROM subject WHERE subject_name = $1',
      [subjectName]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching subject by name:', error);
    res.status(500).json({ error: 'Failed to fetch subject' });
  }
});

// Export the router
export default router; 