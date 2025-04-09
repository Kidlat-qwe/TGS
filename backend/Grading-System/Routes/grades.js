import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get student grades for rankings
router.get('/rankings', async (req, res) => {
  try {
    const { schoolYearId, quarter, classId } = req.query;
    
    let query = `
      SELECT 
        u.user_id as student_id,
        u.fname,
        u.mname,
        u.lname,
        c.grade_level,
        c.section,
          ROUND(AVG(sg.grade)::numeric, 2) as average_grade
      FROM users u
      JOIN class_student cs ON u.user_id = cs.student_id
        JOIN class c ON cs.class_id = c.class_id
      JOIN student_grade sg ON u.user_id = sg.student_id
      WHERE c.school_year_id = $1
      AND sg.quarter = $2
    `;

    const queryParams = [schoolYearId, quarter];

    // Add class filter if specified
    if (classId && classId !== 'All Classes (Campus-wide)') {
      query += ` AND c.class_id = $3`;
      queryParams.push(classId);
    }

    // Group by student and order by average grade
    query += `
        GROUP BY 
        u.user_id,
        u.fname,
        u.mname,
        u.lname,
        c.grade_level,
          c.section
      ORDER BY average_grade DESC
    `;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching academic rankings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all student grades
router.get('/', async (req, res) => {
  try {
    const { schoolYearId, quarter, classId } = req.query;
    
    // Different query for final average vs quarterly grades
    const query = quarter === 'final' ? `
      WITH quarterly_grades AS (
            SELECT 
          student_id,
          subject_id,
          ROUND(AVG(CASE WHEN quarter = '1' THEN grade END)::numeric, 2) as q1,
          ROUND(AVG(CASE WHEN quarter = '2' THEN grade END)::numeric, 2) as q2,
          ROUND(AVG(CASE WHEN quarter = '3' THEN grade END)::numeric, 2) as q3,
          ROUND(AVG(CASE WHEN quarter = '4' THEN grade END)::numeric, 2) as q4
        FROM student_grade
        GROUP BY student_id, subject_id
      ),
      student_grades AS (
        SELECT 
          u.user_id as student_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section,
          COUNT(DISTINCT cs2.subject_id) as total_subjects,
          COUNT(DISTINCT CASE WHEN qg.q1 IS NOT NULL AND qg.q2 IS NOT NULL AND qg.q3 IS NOT NULL AND qg.q4 IS NOT NULL THEN cs2.subject_id END) as graded_subjects,
          CASE 
            WHEN COUNT(DISTINCT cs2.subject_id) = COUNT(DISTINCT CASE WHEN qg.q1 IS NOT NULL AND qg.q2 IS NOT NULL AND qg.q3 IS NOT NULL AND qg.q4 IS NOT NULL THEN cs2.subject_id END)
            THEN ROUND(AVG(
              (COALESCE(qg.q1, 0) + COALESCE(qg.q2, 0) + COALESCE(qg.q3, 0) + COALESCE(qg.q4, 0)) / 4
            )::numeric, 2)
            ELSE NULL
          END as average_grade
        FROM users u
        JOIN class_student cs ON u.user_id = cs.student_id
            JOIN class c ON cs.class_id = c.class_id
        LEFT JOIN class_subject cs2 ON c.class_id = cs2.class_id
        LEFT JOIN quarterly_grades qg ON u.user_id = qg.student_id AND cs2.subject_id = qg.subject_id
        WHERE c.school_year_id = $1
        ${classId ? 'AND c.class_id = $2' : ''}
        GROUP BY 
          u.user_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section
      )
      SELECT 
        student_id,
        fname,
        mname,
        lname,
        grade_level,
        section,
        CASE 
          WHEN average_grade IS NOT NULL 
          THEN RANK() OVER (ORDER BY average_grade DESC)
          ELSE NULL
        END as rank_number,
        CASE 
          WHEN average_grade IS NOT NULL THEN CAST(average_grade AS text)
          ELSE 'TBA'
        END as average_grade,
        total_subjects,
        graded_subjects
      FROM student_grades
      ORDER BY 
        CASE WHEN average_grade IS NULL THEN 1 ELSE 0 END,
        average_grade DESC NULLS LAST,
        lname,
        fname
    ` : buildRankingQuery();

    const queryParams = quarter === 'final' 
      ? classId 
        ? [schoolYearId, classId]
        : [schoolYearId]
      : [schoolYearId, quarter];

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to build the ranking query
const buildRankingQuery = () => `
  WITH student_grades AS (
      SELECT 
      u.user_id as student_id,
      u.fname,
      u.mname,
      u.lname,
        c.grade_level,
        c.section,
      COUNT(DISTINCT cs2.subject_id) as total_subjects,
      COUNT(DISTINCT sg.subject_id) as graded_subjects,
      CASE 
        WHEN COUNT(DISTINCT cs2.subject_id) = COUNT(DISTINCT sg.subject_id) 
        THEN ROUND(AVG(sg.grade)::numeric, 2)
        ELSE NULL
      END as average_grade
    FROM users u
    JOIN class_student cs ON u.user_id = cs.student_id
        JOIN class c ON cs.class_id = c.class_id
    JOIN class_subject cs2 ON c.class_id = cs2.class_id
    LEFT JOIN student_grade sg ON u.user_id = sg.student_id 
      AND sg.subject_id = cs2.subject_id 
      AND sg.quarter = $2
    WHERE c.school_year_id = $1
        GROUP BY 
      u.user_id,
      u.fname,
      u.mname,
      u.lname,
        c.grade_level,
          c.section
  )
  SELECT 
    student_id,
    fname,
    mname,
    lname,
    grade_level,
    section,
    CASE 
      WHEN average_grade IS NOT NULL 
      THEN RANK() OVER (ORDER BY average_grade DESC)
      ELSE NULL
    END as rank_number,
    CASE 
      WHEN average_grade IS NOT NULL THEN average_grade::text
      ELSE 'TBA'
    END as average_grade,
    total_subjects,
    graded_subjects
  FROM student_grades
        ORDER BY 
          average_grade DESC NULLS LAST,
    lname,
    fname;
`;

// Get existing grades
router.get('/check-existing', async (req, res) => {
  try {
    const { classId, subjectId, quarter } = req.query;
    
    // Validate parameters
    if (!classId || !subjectId || !quarter) {
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        details: 'classId, subjectId, and quarter are required' 
      });
    }
    
    const query = `
      SELECT 
        sg.student_id,
        sg.grade
      FROM student_grade sg
      WHERE sg.class_id = $1 
      AND sg.subject_id = $2 
      AND sg.quarter = $3
    `;
    const result = await pool.query(query, [classId, subjectId, quarter]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error checking existing grades:', error);
    res.status(500).json({ error: 'Failed to check existing grades' });
  }
});

// Grade validation middleware
const validateGrade = (req, res, next) => {
  if (Array.isArray(req.body)) {
    const invalidGrades = req.body.filter(grade => 
      !grade.student_id || 
      !grade.class_id || 
      !grade.subject_id || 
      !grade.teacher_id || 
      !grade.quarter ||
      typeof grade.grade !== 'number' ||
      grade.grade < 0 ||
      grade.grade > 100
    );

    if (invalidGrades.length > 0) {
      return res.status(400).json({ 
        error: 'Invalid grade data', 
        details: 'All grades must be between 0 and 100' 
      });
    }
  }
  next();
};

// Upload grades
router.post('/upload', validateGrade, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gradesData = req.body;

    // Validate the incoming data structure
    if (!Array.isArray(gradesData)) {
      throw new Error('Invalid data format');
    }

    // Check if grades already exist for this class, subject, and quarter
    const checkQuery = `
      SELECT 1 FROM student_grade 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND quarter = $3 
      LIMIT 1
    `;
    const checkResult = await client.query(checkQuery, [
      gradesData[0].class_id,
      gradesData[0].subject_id,
      gradesData[0].quarter
    ]);

    if (checkResult.rows.length > 0) {
      // Update existing grades
      for (const grade of gradesData) {
        const updateQuery = `
          UPDATE student_grade 
          SET grade = $1 
          WHERE student_id = $2 
          AND class_id = $3 
          AND subject_id = $4 
          AND quarter = $5
        `;
        await client.query(updateQuery, [
          grade.grade,
          grade.student_id,
          grade.class_id,
          grade.subject_id,
          grade.quarter
        ]);
      }
    } else {
      // Insert new grades
      const insertQuery = `
        INSERT INTO student_grade 
        (student_id, class_id, subject_id, teacher_id, quarter, grade)
        VALUES ($1, $2, $3, $4, $5, $6)
      `;

      for (const grade of gradesData) {
        await client.query(insertQuery, [
          grade.student_id,
          grade.class_id,
          grade.subject_id,
          grade.teacher_id,
          grade.quarter,
          grade.grade
        ]);
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Grades uploaded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading grades:', error);
    res.status(500).json({ 
      error: 'Failed to upload grades',
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// Submit grades (new endpoint specifically for grade submission)
router.post('/submit', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const gradesData = req.body;

    // Validate the incoming data
    if (!Array.isArray(gradesData) || gradesData.length === 0) {
      throw new Error('Invalid grade data format');
    }

    // Delete existing grades if any
    const deleteQuery = `
      DELETE FROM student_grade 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND quarter = $3
    `;
    await client.query(deleteQuery, [
      gradesData[0].class_id,
      gradesData[0].subject_id,
      gradesData[0].quarter
    ]);

    // Insert new grades
    const insertQuery = `
      INSERT INTO student_grade 
      (student_id, class_id, subject_id, teacher_id, quarter, grade)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    for (const grade of gradesData) {
      await client.query(insertQuery, [
        grade.student_id,
        grade.class_id,
        grade.subject_id,
        grade.teacher_id,
        grade.quarter,
        grade.grade
      ]);
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Grades submitted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error submitting grades:', error);
    res.status(500).json({ error: 'Failed to submit grades' });
  } finally {
    client.release();
  }
});

// Get computed grades for a class and subject
router.get('/computed', async (req, res) => {
  try {
    const { class_id, subject_id, school_year_id, quarter } = req.query;
    
    if (!class_id || !subject_id || !quarter) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    
    let query = `
      SELECT * FROM computed_grades 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND quarter = $3
    `;
    
    const params = [class_id, subject_id, quarter];
    
    // Add school_year_id parameter if provided
    if (school_year_id) {
      query += ` AND school_year_id = $4`;
      params.push(school_year_id);
    }
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching computed grades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save computed grades
router.post('/computed', async (req, res) => {
  try {
    console.log("Received computed grades data:", JSON.stringify(req.body, null, 2));
    
    const { 
      class_id, 
      subject_id, 
      school_year_id, 
      student_id, 
      quarter, 
      written_works_total, 
      written_works_percentage, 
      performance_tasks_total, 
      performance_tasks_percentage, 
      quarterly_assessment_total, 
      quarterly_assessment_percentage, 
      final_grade 
    } = req.body;
    
    // Validate required fields
    if (!class_id || !subject_id || !student_id || !quarter) {
      console.error("Missing required fields in request:", req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Parse all numeric values to ensure proper data types
    const parsedValues = {
      class_id: parseInt(class_id),
      subject_id: parseInt(subject_id),
      student_id: parseInt(student_id),
      quarter: parseInt(quarter),
      school_year_id: school_year_id ? parseInt(school_year_id) : null,
      written_works_total: parseFloat(written_works_total || 0),
      written_works_percentage: parseFloat(written_works_percentage || 0),
      performance_tasks_total: parseFloat(performance_tasks_total || 0),
      performance_tasks_percentage: parseFloat(performance_tasks_percentage || 0),
      quarterly_assessment_total: parseFloat(quarterly_assessment_total || 0),
      quarterly_assessment_percentage: parseFloat(quarterly_assessment_percentage || 0),
      final_grade: parseFloat(final_grade || 0)
    };
    
    // Validate all IDs are integers
    if (isNaN(parsedValues.class_id) || isNaN(parsedValues.subject_id) || 
        isNaN(parsedValues.student_id) || isNaN(parsedValues.quarter)) {
      console.error("Invalid ID values found:", parsedValues);
      return res.status(400).json({ error: 'Invalid ID values' });
    }
    
    console.log("Parsed values:", parsedValues);
    
    // Check if a record already exists for this student, class, subject, and quarter
    let checkQuery = `
      SELECT grade_id FROM computed_grades 
      WHERE class_id = $1 
      AND subject_id = $2 
      AND student_id = $3 
      AND quarter = $4
    `;
    
    const checkParams = [
      parsedValues.class_id, 
      parsedValues.subject_id, 
      parsedValues.student_id, 
      parsedValues.quarter
    ];
    
    // Only add school_year_id to the query if it's provided
    if (parsedValues.school_year_id) {
      checkQuery += ' AND school_year_id = $5';
      checkParams.push(parsedValues.school_year_id);
    }
    
    console.log("Checking for existing record with params:", checkParams);
    const checkResult = await pool.query(checkQuery, checkParams);
    console.log("Check result:", checkResult.rows);
    
    let result;
    
    if (checkResult.rows.length > 0) {
      // Update existing record - SIMPLIFIED APPROACH
      const gradeId = checkResult.rows[0].grade_id;
      console.log("Updating existing record with grade_id:", gradeId);
      
      // Build update query with sequential parameters
      let updateQuery;
      let updateParams;
      
      if (parsedValues.school_year_id) {
        updateQuery = `
          UPDATE computed_grades SET
            school_year_id = $1,
            written_works_total = $2,
            written_works_percentage = $3,
            performance_tasks_total = $4,
            performance_tasks_percentage = $5,
            quarterly_assessment_total = $6,
            quarterly_assessment_percentage = $7,
            final_grade = $8,
            updated_at = CURRENT_TIMESTAMP
          WHERE grade_id = $9
          RETURNING *
        `;
        
        updateParams = [
          parsedValues.school_year_id,
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade,
          gradeId
        ];
      } else {
        updateQuery = `
          UPDATE computed_grades SET
            written_works_total = $1,
            written_works_percentage = $2,
            performance_tasks_total = $3,
            performance_tasks_percentage = $4,
            quarterly_assessment_total = $5,
            quarterly_assessment_percentage = $6,
            final_grade = $7,
            updated_at = CURRENT_TIMESTAMP
          WHERE grade_id = $8
          RETURNING *
        `;
        
        updateParams = [
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade,
          gradeId
        ];
      }
      
      console.log("Executing update with query:", updateQuery);
      console.log("Update params:", updateParams);
      
      result = await pool.query(updateQuery, updateParams);
      console.log("Update result:", result.rows[0]);
    } else {
      // Insert new record - SIMPLIFIED APPROACH
      console.log("Creating new computed grade record");
      
      let insertQuery;
      let insertParams;
      
      if (parsedValues.school_year_id) {
        insertQuery = `
          INSERT INTO computed_grades (
            class_id, subject_id, school_year_id, student_id, quarter,
            written_works_total, written_works_percentage,
            performance_tasks_total, performance_tasks_percentage,
            quarterly_assessment_total, quarterly_assessment_percentage,
            final_grade
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *
        `;
        
        insertParams = [
          parsedValues.class_id,
          parsedValues.subject_id, 
          parsedValues.school_year_id,
          parsedValues.student_id,
          parsedValues.quarter,
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade
        ];
      } else {
        insertQuery = `
          INSERT INTO computed_grades (
            class_id, subject_id, student_id, quarter,
            written_works_total, written_works_percentage,
            performance_tasks_total, performance_tasks_percentage,
            quarterly_assessment_total, quarterly_assessment_percentage,
            final_grade
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;
        
        insertParams = [
          parsedValues.class_id,
          parsedValues.subject_id,
          parsedValues.student_id,
          parsedValues.quarter,
          parsedValues.written_works_total,
          parsedValues.written_works_percentage,
          parsedValues.performance_tasks_total,
          parsedValues.performance_tasks_percentage,
          parsedValues.quarterly_assessment_total,
          parsedValues.quarterly_assessment_percentage,
          parsedValues.final_grade
        ];
      }
      
      console.log("Executing insert with query:", insertQuery);
      console.log("Insert params:", insertParams);
      
      result = await pool.query(insertQuery, insertParams);
      console.log("Insert result:", result.rows[0]);
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error saving computed grades:', error);
    // Include the full error stack in the response for debugging
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack
    });
  }
});

// Get grades for a specific student
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(`Fetching grades for student ID: ${studentId}`);

    // Validate studentId
    if (!studentId || isNaN(parseInt(studentId))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid student ID is required' 
      });
    }

    // First, check if student exists
    const studentQuery = `
      SELECT user_id, fname, mname, lname, gender 
      FROM users 
      WHERE user_id = $1 AND user_type = 'student'
    `;

    const studentResult = await pool.query(studentQuery, [studentId]);
    
    if (studentResult.rows.length === 0) {
      console.log(`Student with ID ${studentId} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    const student = studentResult.rows[0];

    // Get active school year
    let activeSchoolYear = null;
    try {
      const activeYearQuery = 'SELECT * FROM school_year WHERE is_active = true LIMIT 1';
      const activeYearResult = await pool.query(activeYearQuery);
      
      if (activeYearResult.rows.length > 0) {
        activeSchoolYear = activeYearResult.rows[0];
      }
    } catch (activeYearError) {
      console.error('Error fetching active school year:', activeYearError);
      // Continue without active school year info
    }

    // Get all grades for the student across all subjects, classes, and quarters
    const gradesQuery = `
      SELECT 
        sg.student_id,
        sg.class_id,
        sg.subject_id,
        sg.teacher_id,
        sg.quarter,
        sg.grade,
        s.subject_name,
        c.grade_level,
        c.section,
        c.school_year_id,
        sy.school_year,
        u.fname as teacher_fname,
        u.mname as teacher_mname,
        u.lname as teacher_lname
      FROM student_grade sg
      JOIN subject s ON sg.subject_id = s.subject_id
      JOIN class c ON sg.class_id = c.class_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      LEFT JOIN users u ON sg.teacher_id = u.user_id
      WHERE sg.student_id = $1
      ORDER BY sy.school_year DESC, s.subject_name ASC, sg.quarter ASC
    `;

    const gradesResult = await pool.query(gradesQuery, [studentId]);
    console.log(`Found ${gradesResult.rows.length} grade records for student`);

    // Group grades by school year and subject
    const gradesByYearAndSubject = {};
    
    gradesResult.rows.forEach(grade => {
      const yearId = grade.school_year_id;
      const subjectId = grade.subject_id;
      
      if (!gradesByYearAndSubject[yearId]) {
        gradesByYearAndSubject[yearId] = {
          school_year_id: yearId,
          school_year: grade.school_year,
          grade_level: grade.grade_level,
          section: grade.section,
          subjects: {}
        };
      }
      
      if (!gradesByYearAndSubject[yearId].subjects[subjectId]) {
        gradesByYearAndSubject[yearId].subjects[subjectId] = {
          subject_id: subjectId,
          subject_name: grade.subject_name,
          quarters: {}
        };
      }
      
      gradesByYearAndSubject[yearId].subjects[subjectId].quarters[grade.quarter] = {
        grade: grade.grade,
        teacher: grade.teacher_fname ? 
          `${grade.teacher_fname} ${grade.teacher_mname ? grade.teacher_mname[0] + '. ' : ''}${grade.teacher_lname}` : 
          'Unknown Teacher'
      };
    });
    
    // Convert to array and calculate averages
    const formattedGrades = Object.values(gradesByYearAndSubject).map(yearData => {
      const subjects = Object.values(yearData.subjects).map(subject => {
        // Calculate subject average from quarters
        const quarters = Object.values(subject.quarters);
        let average = null;
        
        if (quarters.length > 0) {
          const sum = quarters.reduce((acc, q) => acc + q.grade, 0);
          average = (sum / quarters.length).toFixed(2);
        }
        
        return {
          ...subject,
          quarters: subject.quarters,
          average: average
        };
      });
      
      // Calculate year average from subject averages
      const validSubjectAverages = subjects
        .filter(s => s.average !== null)
        .map(s => parseFloat(s.average));
      
      let yearAverage = null;
      if (validSubjectAverages.length > 0) {
        const sum = validSubjectAverages.reduce((acc, avg) => acc + avg, 0);
        yearAverage = (sum / validSubjectAverages.length).toFixed(2);
      }
      
      return {
        ...yearData,
        subjects: subjects,
        average: yearAverage,
        is_active: activeSchoolYear && yearData.school_year_id === activeSchoolYear.school_year_id
      };
    });
    
    // Return comprehensive student grade data
    res.json({
      success: true,
      student: student,
      grades_by_year: formattedGrades
    });
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch student grades',
      error: error.message,
      stack: error.stack
    });
  }
});

export default router; 