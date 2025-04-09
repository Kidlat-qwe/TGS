import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all students
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users WHERE user_type = \'student\'');
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student by ID (specific endpoint with detailed info)
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(`Fetching student with ID: ${studentId} (detailed endpoint)`);
    
    if (!studentId || isNaN(parseInt(studentId))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid student ID is required' 
      });
    }
    
    // Query to get student details
    const query = `
      SELECT 
        u.user_id,
        u.username,
        u.email,
        u.fname,
        u.mname,
        u.lname,
        u.gender,
        u.contact_number,
        u.address,
        u.user_type,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.user_id = $1 AND u.user_type = 'student'
    `;
    
    const result = await pool.query(query, [studentId]);
    
    if (result.rows.length === 0) {
      console.log(`Student with ID ${studentId} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    // Get current class information if available
    let classInfo = null;
    try {
      const classQuery = `
        SELECT 
          c.class_id,
          c.grade_level,
          c.section,
          c.school_year_id,
          sy.school_year
        FROM class_student cs
        JOIN class c ON cs.class_id = c.class_id
        JOIN school_year sy ON c.school_year_id = sy.school_year_id
        WHERE cs.student_id = $1
        ORDER BY sy.school_year DESC
        LIMIT 1
      `;
      
      const classResult = await pool.query(classQuery, [studentId]);
      if (classResult.rows.length > 0) {
        classInfo = classResult.rows[0];
      }
    } catch (classError) {
      console.error('Error fetching class info:', classError);
      // Continue without class info
    }
    
    // Return combined student info
    res.json({
      success: true,
      student: result.rows[0],
      current_class: classInfo
    });
  } catch (error) {
    console.error(`Error fetching student with ID ${req.params.studentId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch student data',
      error: error.message 
    });
  }
});

// Get student grades
router.get('/:studentId/grades', async (req, res) => {
  try {
    const { studentId } = req.params;
    const result = await pool.query(
      `SELECT sg.*, s.subject_name, c.grade_level, c.section,
              u.fname as teacher_fname, u.mname as teacher_mname, u.lname as teacher_lname
       FROM student_grade sg
       JOIN subject s ON sg.subject_id = s.subject_id
       JOIN class c ON sg.class_id = c.class_id
       LEFT JOIN users u ON sg.teacher_id = u.user_id
       WHERE sg.student_id = $1`,
      [studentId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get student's previous grade level
router.get('/:studentId/previous-grade', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Find the most recent class where the student was enrolled, ordered by school year
    const query = `
      SELECT c.grade_level, c.class_id, sy.school_year
      FROM class_student cs
      JOIN class c ON cs.class_id = c.class_id
      JOIN school_year sy ON c.school_year_id = sy.school_year_id
      WHERE cs.student_id = $1
      ORDER BY sy.school_year DESC
      LIMIT 1
    `;
    
    const result = await pool.query(query, [studentId]);
    
    if (result.rows.length === 0) {
      // Student has no previous grade level (new student)
      return res.json({ 
        previousGradeLevel: null,
        isNewStudent: true
      });
    }
    
    // Return the previous grade level
    res.json({
      previousGradeLevel: result.rows[0].grade_level,
      classId: result.rows[0].class_id,
      schoolYear: result.rows[0].school_year,
      isNewStudent: false
    });
  } catch (error) {
    console.error('Error fetching student previous grade:', error);
    res.status(500).json({ error: 'Failed to fetch student history' });
  }
});

// Get school years where the student was enrolled
router.get('/:studentId/enrolled-years', async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Validate studentId is a number
    if (!studentId || isNaN(parseInt(studentId))) {
      return res.status(400).json({ error: 'Valid student ID is required' });
    }
    
    console.log(`Attempting simplified fetch for student ID: ${studentId}`);
    
    // Step 1: Just check if the student exists first
    const studentCheck = await pool.query(
      'SELECT user_id FROM users WHERE user_id = $1 LIMIT 1',
      [studentId]
    );
    
    if (studentCheck.rows.length === 0) {
      console.log(`Student ${studentId} not found`);
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Step 2: Get active school year regardless (will be needed for UI)
    let activeSchoolYear = null;
    try {
      const activeYearResult = await pool.query(
        'SELECT * FROM school_year WHERE is_active = true LIMIT 1'
      );
      
      if (activeYearResult.rows.length > 0) {
        activeSchoolYear = activeYearResult.rows[0];
        console.log('Active school year found:', activeSchoolYear.school_year_id);
      }
    } catch (activeYearError) {
      console.error('Error fetching active year:', activeYearError);
      // Continue without active year
    }
    
    // Step 3: Use a different approach - first get class enrollments with single simple query
    const enrollmentsQuery = `
      SELECT cs.class_id, c.school_year_id
      FROM class_student cs
      JOIN class c ON cs.class_id = c.class_id
      WHERE cs.student_id = $1
    `;
    
    try {
      const enrollmentsResult = await pool.query(enrollmentsQuery, [studentId]);
      console.log(`Found ${enrollmentsResult.rows.length} class enrollments`);
      
      if (enrollmentsResult.rows.length === 0) {
        console.log('No enrollments found, returning empty array');
        return res.json([]);
      }
      
      // Get unique school year IDs
      const schoolYearIds = [...new Set(
        enrollmentsResult.rows.map(row => row.school_year_id)
      )];
      
      console.log('Unique school year IDs:', schoolYearIds);
      
      if (schoolYearIds.length === 0) {
        console.log('No school year IDs found, returning empty array');
        return res.json([]);
      }
      
      // Get school year details - use parameterized query with numbered parameters
      const placeholders = schoolYearIds.map((_, i) => `$${i + 1}`).join(',');
      const yearsQuery = `
        SELECT * FROM school_year
        WHERE school_year_id IN (${placeholders})
        ORDER BY school_year DESC
      `;
      
      const yearsResult = await pool.query(yearsQuery, schoolYearIds);
      
      // Mark active year
      const years = yearsResult.rows.map(year => ({
        ...year,
        is_active: activeSchoolYear && year.school_year_id === activeSchoolYear.school_year_id
      }));
      
      console.log(`Successfully retrieved ${years.length} school years`);
      return res.json(years);
      
    } catch (enrollmentsError) {
      console.error('Error in enrollment query:', enrollmentsError);
      
      // Fallback to just return all school years if there's an error
      try {
        console.log('Using fallback - getting all school years');
        const allYearsResult = await pool.query('SELECT * FROM school_year ORDER BY school_year DESC');
        
        // Mark active year
        const allYears = allYearsResult.rows.map(year => ({
          ...year,
          is_active: activeSchoolYear && year.school_year_id === activeSchoolYear.school_year_id
        }));
        
        console.log(`Fallback successful - returning ${allYears.length} school years`);
        return res.json(allYears);
      } catch (fallbackError) {
        console.error('Even fallback failed:', fallbackError);
        return res.status(500).json({ 
          error: 'Failed to fetch school years',
          details: fallbackError.message 
        });
      }
    }
  } catch (error) {
    console.error('Top-level error in enrolled-years endpoint:', error);
    return res.status(500).json({ 
      error: 'Server error processing request',
      message: error.message
    });
  }
});

// Get student grades by school year
router.get('/:studentId/:schoolYearId', async (req, res) => {
  try {
    const { studentId, schoolYearId } = req.params;
    const onlyAssigned = req.query.onlyAssigned === 'true';
    
    // First, get the student's class information
    const classQuery = `
      SELECT c.class_id, c.grade_level, c.section
      FROM class_student cs
      JOIN class c ON cs.class_id = c.class_id
      WHERE cs.student_id = $1 AND c.school_year_id = $2
    `;
    const classResult = await pool.query(classQuery, [studentId, schoolYearId]);
    
    // Get student information
    const studentQuery = `
      SELECT user_id as student_id, fname, mname, lname
      FROM users
      WHERE user_id = $1
    `;
    const studentResult = await pool.query(studentQuery, [studentId]);
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Return empty data structure if student isn't enrolled in this school year
    if (classResult.rows.length === 0) {
      return res.status(200).json({
        ...studentResult.rows[0],
        grade_level: null,
        section: null,
        average: null,
        grades: [],
        enrolled: false,
        message: 'Student not enrolled in any class for this school year'
      });
    }
    
    // Combine class and student info
    const classInfo = classResult.rows[0];
    const studentData = {
      ...studentResult.rows[0],
      grade_level: classInfo.grade_level,
      section: classInfo.section,
      average: null,
      grades: [],
      enrolled: true
    };
    
    // Get grades for the student, but only for subjects assigned to their class if onlyAssigned is true
    let gradesQuery;
    let queryParams;
    
    if (onlyAssigned) {
      // Only get subjects assigned to the student's class
      gradesQuery = `
        SELECT s.subject_id, s.subject_name,
          MAX(CASE WHEN sg.quarter = '1' THEN sg.grade END) as quarter1,
          MAX(CASE WHEN sg.quarter = '2' THEN sg.grade END) as quarter2,
          MAX(CASE WHEN sg.quarter = '3' THEN sg.grade END) as quarter3,
          MAX(CASE WHEN sg.quarter = '4' THEN sg.grade END) as quarter4,
          ROUND(AVG(sg.grade)::numeric, 2) as final_grade
        FROM subject s
        JOIN class_subject cs ON s.subject_id = cs.subject_id
        LEFT JOIN student_grade sg ON s.subject_id = sg.subject_id 
          AND sg.student_id = $1 
          AND sg.class_id = $2
        WHERE cs.class_id = $2
        GROUP BY s.subject_id, s.subject_name
        ORDER BY s.subject_name
      `;
      queryParams = [studentId, classInfo.class_id];
    } else {
      // Get all subjects (previous behavior)
      gradesQuery = `
        SELECT s.subject_id, s.subject_name,
          MAX(CASE WHEN sg.quarter = '1' THEN sg.grade END) as quarter1,
          MAX(CASE WHEN sg.quarter = '2' THEN sg.grade END) as quarter2,
          MAX(CASE WHEN sg.quarter = '3' THEN sg.grade END) as quarter3,
          MAX(CASE WHEN sg.quarter = '4' THEN sg.grade END) as quarter4,
          AVG(sg.grade) as final_grade
        FROM subject s
        LEFT JOIN student_grade sg ON s.subject_id = sg.subject_id 
          AND sg.student_id = $1 
          AND sg.class_id = $2
        GROUP BY s.subject_id, s.subject_name
        ORDER BY s.subject_name
      `;
      queryParams = [studentId, classInfo.class_id];
    }
    
    const gradesResult = await pool.query(gradesQuery, queryParams);
    studentData.grades = gradesResult.rows;
    
    // Calculate overall average from final grades that are not null
    const validGrades = studentData.grades
      .filter(grade => grade.final_grade !== null)
      .map(grade => parseFloat(grade.final_grade));
    
    if (validGrades.length > 0) {
      const sum = validGrades.reduce((acc, grade) => acc + grade, 0);
      studentData.average = (sum / validGrades.length).toFixed(2);
    }
    
    res.json(studentData);
  } catch (error) {
    console.error('Error fetching student grades:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get student by ID (simple endpoint that matches the URL in the screenshot)
// This must be the LAST route to avoid conflicts with more specific routes
router.get('/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(`Fetching student with ID: ${studentId} (simplified endpoint)`);
    
    // Continue with student lookup
    if (!studentId || isNaN(parseInt(studentId))) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid student ID is required' 
      });
    }
    
    // Simple query to get student details
    const query = `
      SELECT * FROM users
      WHERE user_id = $1 AND user_type = 'student'
    `;
    
    const result = await pool.query(query, [studentId]);
    
    if (result.rows.length === 0) {
      console.log(`Student with ID ${studentId} not found`);
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }
    
    // Return student info
    res.json(result.rows[0]);
  } catch (error) {
    console.error(`Error fetching student with ID ${req.params.studentId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch student data',
      error: error.message 
    });
  }
});

export default router; 