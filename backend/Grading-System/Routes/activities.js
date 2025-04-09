import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Add new activity
router.post('/', async (req, res) => {
  try {
    const { 
      class_id, 
      subject_id, 
      school_year_id,
      activity_type,
      title,
      max_score,
      quarter,
      user_id
    } = req.body;

    // Validate required fields
    if (!class_id || !subject_id || !school_year_id || !activity_type || 
        !title || !max_score || !quarter || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get teacher's name from users table
    const teacherQuery = `
      SELECT CONCAT(
        fname, 
        CASE 
          WHEN mname IS NOT NULL AND mname != '' THEN ' ' || mname || ' '
          ELSE ' '
        END,
        lname
      ) as full_name
      FROM users 
      WHERE user_id = $1
    `;

    const teacherResult = await pool.query(teacherQuery, [user_id]);
    const teacherName = teacherResult.rows[0]?.full_name || 'Unknown Teacher';

    const query = `
      INSERT INTO activities (
        class_id,
        subject_id,
        school_year_id,
        activity_type,
        title,
        max_score,
        quarter,
        teachers_name
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      class_id,
      subject_id,
      school_year_id,
      activity_type,
      title,
      max_score,
      quarter,
      teacherName
    ];

    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get activities for a class
router.get('/', async (req, res) => {
  try {
    console.log('Fetching activities with query params:', req.query);
    const { classId, subjectId, schoolYearId, quarter } = req.query;

    // If no parameters are provided, return all activities
    if (!classId || !subjectId || !schoolYearId || !quarter) {
      console.log('No specific parameters provided, fetching all activities');
      
      // Get all activities with a limit for performance
      const allActivitiesQuery = `
        SELECT 
          a.activity_id,
          a.class_id,
          a.subject_id,
          a.school_year_id,
          a.teachers_name,
          a.activity_type,
          a.title,
          a.max_score,
          a.quarter,
          a.created_at,
          a.updated_at,
          c.grade_level,
          c.section,
          s.subject_name
        FROM activities a
        LEFT JOIN class c ON a.class_id = c.class_id
        LEFT JOIN subject s ON a.subject_id = s.subject_id
        ORDER BY a.created_at DESC
        LIMIT 100
      `;
      
      try {
        const result = await pool.query(allActivitiesQuery);
        console.log(`Found ${result.rows.length} activities total`);
        return res.json(result.rows);
      } catch (joinError) {
        console.error('Error with JOINed query, falling back to simpler query:', joinError);
        
        // Fallback to a simpler query if the JOINs fail
        const simpleQuery = `
          SELECT * FROM activities
          ORDER BY created_at DESC
          LIMIT 100
        `;
        
        const simpleResult = await pool.query(simpleQuery);
        console.log(`Found ${simpleResult.rows.length} activities with simple query`);
        return res.json(simpleResult.rows);
      }
    }

    // If specific parameters are provided, perform the filtered query
    const query = `
      SELECT 
        a.activity_id,
        a.class_id,
        a.subject_id,
        a.school_year_id,
        a.teachers_name,
        a.activity_type,
        a.title,
        a.max_score,
        a.quarter,
        a.created_at,
        a.updated_at
      FROM activities a
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.school_year_id = $3 
      AND a.quarter = $4
      ORDER BY a.created_at ASC
    `;

    const result = await pool.query(query, [
      classId,
      subjectId,
      schoolYearId,
      quarter
    ]);

    console.log(`Found ${result.rows.length} activities with the specified filters`);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
});

// Get activities for a class with subject and quarter (alternative endpoint)
router.get('/class/:classId/subject/:subjectId/quarter/:quarter', async (req, res) => {
  try {
    const { classId, subjectId, quarter } = req.params;
    
    if (!classId || !subjectId || !quarter) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const query = `
      SELECT activity_id, class_id, subject_id, activity_type, title as activity_name, 
             max_score, quarter, teachers_name, created_at, updated_at
      FROM activities
      WHERE class_id = $1 AND subject_id = $2 AND quarter = $3
      ORDER BY activity_type, created_at
    `;
    
    const result = await pool.query(query, [classId, subjectId, quarter]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get activities and grades for class
router.get('/activities-and-grades', async (req, res) => {
  try {
    const { class_id, subject_id, quarter } = req.query;

    // Query to get written works
    const writtenWorksQuery = `
      SELECT 
        a.activity_id,
        a.title,
        a.max_score,
        a.activity_type,
        a.quarter,
        a.teachers_name,
        json_agg(
          json_build_object(
            'student_id', s.student_id,
            'score', s.score
          )
        ) as scores
      FROM activities a
      LEFT JOIN activity_scores s ON a.activity_id = s.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.quarter = $3
      AND a.activity_type = 'written'
      GROUP BY a.activity_id
      ORDER BY a.activity_id
    `;

    // Query to get performance tasks
    const performanceTasksQuery = `
      SELECT 
        a.activity_id,
        a.title,
        a.max_score,
        a.activity_type,
        a.quarter,
        a.teachers_name,
        json_agg(
          json_build_object(
            'student_id', s.student_id,
            'score', s.score
          )
        ) as scores
      FROM activities a
      LEFT JOIN activity_scores s ON a.activity_id = s.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.quarter = $3
      AND a.activity_type = 'performance'
      GROUP BY a.activity_id
      ORDER BY a.activity_id
    `;

    // Query to get quarterly assessment
    const assessmentQuery = `
      SELECT 
        a.activity_id,
        a.title,
        a.max_score,
        a.activity_type,
        a.quarter,
        a.teachers_name,
        json_agg(
          json_build_object(
            'student_id', s.student_id,
            'score', s.score
          )
        ) as scores
      FROM activities a
      LEFT JOIN activity_scores s ON a.activity_id = s.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.quarter = $3
      AND a.activity_type = 'assessment'
      GROUP BY a.activity_id
      ORDER BY a.activity_id
    `;

    const [writtenWorks, performanceTasks, assessment] = await Promise.all([
      pool.query(writtenWorksQuery, [class_id, subject_id, quarter]),
      pool.query(performanceTasksQuery, [class_id, subject_id, quarter]),
      pool.query(assessmentQuery, [class_id, subject_id, quarter])
    ]);

    res.json({
      written: writtenWorks.rows,
      performance: performanceTasks.rows,
      assessment: assessment.rows
    });

  } catch (error) {
    console.error('Error fetching activities and grades:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      written: [],
      performance: [],
      assessment: []
    });
  }
});

// Get scores
router.get('/scores', async (req, res) => {
  try {
    const { classId, subjectId, schoolYearId, quarter } = req.query;

    // Validate required parameters
    if (!classId || !subjectId || !schoolYearId || !quarter) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const query = `
      SELECT 
        s.score_id,
        s.activity_id,
        s.student_id,
        s.teachers_name,
        s.score,
        s.quarter,
        s.created_at,
        s.updated_at,
        a.title as activity_title,
        a.activity_type,
        a.max_score
      FROM activity_scores s
      JOIN activities a ON s.activity_id = a.activity_id
      WHERE a.class_id = $1 
      AND a.subject_id = $2 
      AND a.school_year_id = $3 
      AND s.quarter = $4
      ORDER BY s.created_at ASC
    `;

    const result = await pool.query(query, [
      classId,
      subjectId,
      schoolYearId,
      quarter
    ]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get scores for students in a class for a specific quarter
router.get('/scores/class/:classId/quarter/:quarter', async (req, res) => {
  try {
    const { classId, quarter } = req.params;
    
    if (!classId || !quarter) {
      return res.status(400).json({ error: "Missing required parameters" });
    }
    
    const query = `
      SELECT s.score_id, s.activity_id, s.student_id, s.score, s.quarter,
             a.class_id, a.subject_id, a.activity_type, s.teachers_name
      FROM activity_scores s
      JOIN activities a ON s.activity_id = a.activity_id
      WHERE a.class_id = $1 AND s.quarter = $2
    `;
    
    const result = await pool.query(query, [classId, quarter]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching scores:', error);
    res.status(500).json({ error: error.message });
  }
});

// Save/Update score
router.post('/scores', async (req, res) => {
  try {
    const { student_id, activity_id, score, quarter, user_id } = req.body;
    
    if (!student_id || !activity_id || score === undefined || !quarter || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get teacher's name
    const teacherQuery = `
      SELECT CONCAT(
        fname, 
        CASE 
          WHEN mname IS NOT NULL AND mname != '' THEN ' ' || mname || ' '
          ELSE ' '
        END,
        lname
      ) as full_name
      FROM users 
      WHERE user_id = $1
    `;

    const teacherResult = await pool.query(teacherQuery, [user_id]);
    const teacherName = teacherResult.rows[0]?.full_name || 'Unknown Teacher';
    
    // Check if score already exists
    const checkQuery = `
      SELECT * FROM activity_scores 
      WHERE student_id = $1 AND activity_id = $2 AND quarter = $3
    `;
    
    const existingScore = await pool.query(checkQuery, [student_id, activity_id, quarter]);
    
    if (existingScore.rows.length > 0) {
      // Update existing score
      const updateQuery = `
        UPDATE activity_scores 
        SET score = $1, updated_at = CURRENT_TIMESTAMP, teachers_name = $2
        WHERE student_id = $3 AND activity_id = $4 AND quarter = $5
        RETURNING *
      `;
      const result = await pool.query(updateQuery, [score, teacherName, student_id, activity_id, quarter]);
      res.json(result.rows[0]);
    } else {
      // Insert new score
      const insertQuery = `
        INSERT INTO activity_scores (student_id, activity_id, score, quarter, teachers_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await pool.query(insertQuery, [student_id, activity_id, score, quarter, teacherName]);
      res.json(result.rows[0]);
    }
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: error.message });
  }
});

// Debug endpoint to check if tables exist
router.get('/debug', async (req, res) => {
  try {
    console.log('Checking activities table structure');
    
    // Check if the activities table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'activities'
      ) as activities_exists;
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0].activities_exists;
    
    // Get information about the activities table if it exists
    let columns = [];
    let recordCount = 0;
    
    if (tableExists) {
      // Get column information
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'activities'
        ORDER BY ordinal_position
      `;
      
      const columnsResult = await pool.query(columnsQuery);
      columns = columnsResult.rows;
      
      // Count records
      const countQuery = 'SELECT COUNT(*) as count FROM activities';
      const countResult = await pool.query(countQuery);
      recordCount = countResult.rows[0].count;
    }
    
    // Check for related tables
    const relatedTablesQuery = `
      SELECT 
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'activity_scores')) as activity_scores_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class')) as class_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject')) as subject_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_year')) as school_year_exists
    `;
    
    const relatedTablesResult = await pool.query(relatedTablesQuery);
    
    // Get sample data if available
    let sampleData = [];
    if (tableExists && recordCount > 0) {
      const sampleQuery = 'SELECT * FROM activities LIMIT 5';
      const sampleResult = await pool.query(sampleQuery);
      sampleData = sampleResult.rows;
    }
    
    // Check for activity types distribution
    let activityTypeDistribution = {};
    if (tableExists && recordCount > 0) {
      const distributionQuery = `
        SELECT activity_type, COUNT(*) as count
        FROM activities
        GROUP BY activity_type
      `;
      
      const distributionResult = await pool.query(distributionQuery);
      
      distributionResult.rows.forEach(row => {
        activityTypeDistribution[row.activity_type] = parseInt(row.count);
      });
    }
    
    res.json({
      activities_table_exists: tableExists,
      record_count: recordCount,
      columns: columns,
      related_tables: relatedTablesResult.rows[0],
      sample_data: sampleData,
      activity_type_distribution: activityTypeDistribution,
      database_name: process.env.PGDATABASE || 'unknown'
    });
  } catch (error) {
    console.error('Error checking tables:', error);
    res.status(500).json({ 
      error: 'Failed to check tables',
      message: error.message,
      stack: error.stack
    });
  }
});

// Delete activity
router.delete('/:activityId', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // First delete all scores associated with this activity
    await client.query(
      'DELETE FROM activity_scores WHERE activity_id = $1',
      [req.params.activityId]
    );

    // Then delete the activity itself
    const result = await client.query(
      'DELETE FROM activities WHERE activity_id = $1 RETURNING *',
      [req.params.activityId]
    );

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.json({ 
      message: 'Activity and associated scores deleted successfully',
      deletedActivity: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting activity:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// THIS MUST BE THE LAST ROUTE - Get single activity by ID
router.get('/:activityId', async (req, res) => {
  try {
    const { activityId } = req.params;
    console.log(`Fetching activity with ID: ${activityId}`);
    
    if (!activityId || isNaN(parseInt(activityId))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid activity ID is required' 
      });
    }
    
    const query = `
      SELECT 
        a.activity_id,
        a.class_id,
        a.subject_id,
        a.school_year_id,
        a.activity_type,
        a.title,
        a.max_score,
        a.quarter,
        a.teachers_name,
        a.created_at,
        a.updated_at,
        c.grade_level,
        c.section,
        s.subject_name
      FROM activities a
      LEFT JOIN class c ON a.class_id = c.class_id
      LEFT JOIN subject s ON a.subject_id = s.subject_id
      WHERE a.activity_id = $1
    `;
    
    const result = await pool.query(query, [activityId]);
    
    if (result.rows.length === 0) {
      console.log(`Activity with ID ${activityId} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Activity not found' 
      });
    }
    
    // Get scores for this activity
    const scoresQuery = `
      SELECT 
        score_id, 
        student_id, 
        score, 
        quarter, 
        teachers_name, 
        created_at, 
        updated_at
      FROM activity_scores
      WHERE activity_id = $1
    `;
    
    const scoresResult = await pool.query(scoresQuery, [activityId]);
    console.log(`Found activity with ID ${activityId} and ${scoresResult.rows.length} scores`);
    
    res.json({
      success: true,
      activity: result.rows[0],
      scores: scoresResult.rows
    });
  } catch (error) {
    console.error(`Error fetching activity with ID ${req.params.activityId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch activity data',
      error: error.message 
    });
  }
});

export default router; 