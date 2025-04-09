import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get all classes with optional school year filter
router.get('/', async (req, res) => {
  try {
    const { schoolYearId } = req.query;
    
    const query = `
      SELECT c.class_id, c.grade_level, c.section, c.class_description, 
             s.school_year, c.school_year_id, c.class_adviser_id,
             u.fname as adviser_fname, u.mname as adviser_mname, u.lname as adviser_lname
      FROM class c
      JOIN school_year s ON c.school_year_id = s.school_year_id
      LEFT JOIN users u ON c.class_adviser_id = u.user_id
      ${schoolYearId ? 'WHERE c.school_year_id = $1' : ''}
      ORDER BY c.grade_level, c.section
    `;

    const queryParams = schoolYearId ? [schoolYearId] : [];
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a single class
router.get('/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await pool.query(`
      SELECT c.class_id, c.grade_level, c.section, c.class_description, 
             s.school_year, c.school_year_id, c.class_adviser_id,
             u.fname as adviser_fname, u.mname as adviser_mname, u.lname as adviser_lname
      FROM class c
      JOIN school_year s ON c.school_year_id = s.school_year_id
      LEFT JOIN users u ON c.class_adviser_id = u.user_id
      WHERE c.class_id = $1
    `, [classId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new class
router.post('/', async (req, res) => {
  try {
    const { grade_level, section, class_description, school_year_id, class_adviser_id } = req.body;
    
    // Verify the school year is active
    const schoolYearCheck = await pool.query(
      'SELECT is_active FROM school_year WHERE school_year_id = $1',
      [school_year_id]
    );
    
    if (schoolYearCheck.rows.length === 0) {
      return res.status(404).json({ error: 'School year not found' });
    }
    
    if (!schoolYearCheck.rows[0].is_active) {
      return res.status(400).json({ error: 'Classes can only be added for the active school year' });
    }
    
    // If class adviser ID is provided, verify it's a valid teacher
    if (class_adviser_id) {
      const teacherCheck = await pool.query(
        'SELECT * FROM users WHERE user_id = $1 AND user_type = $2 AND teacher_status = true',
        [class_adviser_id, 'teacher']
      );
      
      if (teacherCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Teacher not found or not active' });
      }

      // Check if teacher is already a class adviser for another class in the same school year
      const existingAdviserCheck = await pool.query(
        'SELECT c.class_id, c.grade_level, c.section FROM class c WHERE c.class_adviser_id = $1 AND c.school_year_id = $2',
        [class_adviser_id, school_year_id]
      );

      if (existingAdviserCheck.rows.length > 0) {
        const existingClass = existingAdviserCheck.rows[0];
        return res.status(400).json({ 
          error: `This teacher is already assigned as class adviser for Grade ${existingClass.grade_level}-${existingClass.section} in the same school year` 
        });
      }
    }
    
    const result = await pool.query(
      'INSERT INTO class (grade_level, section, class_description, school_year_id, class_adviser_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [grade_level, section, class_description, school_year_id, class_adviser_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students in a class
router.get('/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const query = `
      SELECT u.* 
      FROM users u
      JOIN class_student cs ON u.user_id = cs.student_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get students in a class (alternative endpoint)
router.get('/students-by-class/:classId', async (req, res) => {
  try {
    const { classId } = req.params;
    
    const query = `
      SELECT u.user_id as student_id, u.fname, u.mname, u.lname, u.email, cs.class_id 
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class students:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get available students for a class
router.get('/:classId/available-students', async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolYearId, includePreviousGrade } = req.query;
    
    // First, get the target class grade level
    const classInfoQuery = `
      SELECT grade_level 
      FROM class 
      WHERE class_id = $1
    `;
    const classInfoResult = await pool.query(classInfoQuery, [classId]);
    
    if (classInfoResult.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    const targetGradeLevel = classInfoResult.rows[0].grade_level;
    const targetGradeNumber = parseInt(targetGradeLevel.toString().replace('Grade ', ''));
    
    // Get all unassigned students
    const unassignedStudentsQuery = `
      SELECT u.user_id, u.fname, u.mname, u.lname, u.email, u.gender, u.user_type
      FROM users u
      WHERE u.user_type = 'student'
      AND u.user_id NOT IN (
        SELECT cs.student_id 
        FROM class_student cs
        JOIN class c ON cs.class_id = c.class_id
        WHERE c.school_year_id = $1
      )
      AND u.user_id NOT IN (
        SELECT cs.student_id 
        FROM class_student cs 
        WHERE cs.class_id = $2
      )
    `;
    
    const unassignedStudents = await pool.query(unassignedStudentsQuery, [schoolYearId, classId]);
    const students = unassignedStudents.rows;
    
    // Get previous grade level for each student and apply validation rules
    const validatedStudents = await Promise.all(students.map(async (student) => {
      try {
        // Get previous grade level for this student
        const gradeResponse = await pool.query(`
          SELECT c.grade_level
          FROM class_student cs
          JOIN class c ON cs.class_id = c.class_id
          JOIN school_year sy ON c.school_year_id = sy.school_year_id
          WHERE cs.student_id = $1
          ORDER BY sy.school_year DESC
          LIMIT 1
        `, [student.user_id]);
        
        if (gradeResponse.rows.length === 0) {
          // New student - always valid
          return {
            ...student,
            previousGradeLevel: null,
            isValidGradeProgression: true
          };
        }
        
        const previousGradeLevel = gradeResponse.rows[0].grade_level;
        const previousGradeNumber = parseInt(previousGradeLevel.toString().replace('Grade ', ''));
        
        // Apply validation rules:
        // 1. Student can advance one grade (previousGrade + 1)
        // 2. Student can repeat the same grade (previousGrade)
        // 3. Student cannot go backwards or skip grades
        const isValidGradeProgression = (
          previousGradeNumber === targetGradeNumber - 1 || // Advancing one grade
          previousGradeNumber === targetGradeNumber        // Repeating grade
        );
        
        return {
          ...student,
          previousGradeLevel,
          isValidGradeProgression
        };
      } catch (error) {
        console.error(`Error processing student ${student.user_id}:`, error);
        return {
          ...student,
          previousGradeLevel: null,
          isValidGradeProgression: false
        };
      }
    }));
    
    // Filter to only return valid students
    const eligibleStudents = validatedStudents.filter(student => 
      student.isValidGradeProgression
    );
    
    res.json(eligibleStudents);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign student to class
router.post('/:classId/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const { student_id } = req.body;
    
    // Use current date for date_enrolled
    const currentDate = new Date().toISOString().split('T')[0];
    
    await pool.query(
      'INSERT INTO class_student (class_id, student_id, date_enrolled) VALUES ($1, $2, $3)',
      [classId, student_id, currentDate]
    );
    
    res.json({ message: 'Student assigned successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remove student from class
router.delete('/:classId/students/:studentId', async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    
    await pool.query(
      'DELETE FROM class_student WHERE class_id = $1 AND student_id = $2',
      [classId, studentId]
    );
    
    res.json({ message: 'Student removed successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get class subjects with teachers
router.get('/:classId/subjects', async (req, res) => {
  try {
    const { classId } = req.params;
    const result = await pool.query(
      `SELECT cs.class_id, cs.subject_id, s.subject_name, cs.teacher_id, 
              u.fname, u.mname, u.lname, u.gender
       FROM class_subject cs
       JOIN subject s ON cs.subject_id = s.subject_id
       LEFT JOIN users u ON cs.teacher_id = u.user_id
       WHERE cs.class_id = $1`,
      [classId]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Assign subject to a class
router.post('/:classId/subjects', async (req, res) => {
  try {
    const { classId } = req.params;
    const { subject_id, teacher_id } = req.body;
    
    // Validate input
    if (!subject_id || !teacher_id) {
      return res.status(400).json({ error: 'Subject ID and Teacher ID are required' });
    }
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if subject exists
    const subjectCheck = await pool.query('SELECT * FROM subject WHERE subject_id = $1', [subject_id]);
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not found' });
    }

    // Check if teacher exists
    const teacherCheck = await pool.query('SELECT * FROM users WHERE user_id = $1 AND user_type = \'teacher\'', [teacher_id]);
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Check if this subject is already assigned to this class
    const existingCheck = await pool.query(
      'SELECT * FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subject_id]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ error: 'This subject is already assigned to this class' });
    }
    
    // Insert the new class-subject assignment
    const result = await pool.query(
      'INSERT INTO class_subject (class_id, subject_id, teacher_id) VALUES ($1, $2, $3) RETURNING *',
      [classId, subject_id, teacher_id]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error assigning subject to class:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a subject's teacher in a class
router.put('/:classId/subjects/:subjectId/teacher', async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    const { teacher_id } = req.body;
    
    // Validate input
    if (!teacher_id) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if subject is assigned to class
    const subjectCheck = await pool.query(
      'SELECT * FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not assigned to this class' });
    }
    
    // Check if teacher exists
    const teacherCheck = await pool.query('SELECT * FROM users WHERE user_id = $1 AND user_type = \'teacher\'', [teacher_id]);
    if (teacherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    
    // Update the teacher for this class-subject
    const result = await pool.query(
      'UPDATE class_subject SET teacher_id = $1 WHERE class_id = $2 AND subject_id = $3 RETURNING *',
      [teacher_id, classId, subjectId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating subject teacher:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a subject from a class
router.delete('/:classId/subjects/:subjectId', async (req, res) => {
  try {
    const { classId, subjectId } = req.params;
    
    // Check if class exists
    const classCheck = await pool.query('SELECT * FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if subject is assigned to class
    const subjectCheck = await pool.query(
      'SELECT * FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );
    if (subjectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Subject not assigned to this class' });
    }
    
    // Check if there are any grades for this class-subject that would be orphaned
    const gradeCheck = await pool.query(
      `SELECT COUNT(*) FROM student_grade sg
       JOIN class_student cs ON sg.student_id = cs.student_id
       WHERE cs.class_id = $1 AND sg.subject_id = $2`,
      [classId, subjectId]
    );
    
    // Delete the subject from the class
    await pool.query(
      'DELETE FROM class_subject WHERE class_id = $1 AND subject_id = $2',
      [classId, subjectId]
    );
    
    res.json({ 
      message: 'Subject removed from class successfully',
      gradesAffected: parseInt(gradeCheck.rows[0].count)
    });
  } catch (error) {
    console.error('Error removing subject from class:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get class average grades for students
router.get('/:classId/student-average/:quarter', async (req, res) => {
  try {
    const { classId } = req.params;
    const { quarter } = req.query;
    
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
        WHERE c.class_id = $1
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
    ` : `
      WITH student_grades AS (
        SELECT 
          u.user_id as student_id,
          u.fname,
          u.mname,
          u.lname,
          c.grade_level,
          c.section,
          COUNT(DISTINCT cs2.subject_id) as total_subjects,
          COUNT(DISTINCT CASE WHEN sg.grade IS NOT NULL THEN sg.subject_id END) as graded_subjects,
          CASE 
            WHEN COUNT(DISTINCT cs2.subject_id) = COUNT(DISTINCT CASE WHEN sg.grade IS NOT NULL THEN sg.subject_id END)
            THEN ROUND(AVG(COALESCE(sg.grade, 0))::numeric, 2)
            ELSE NULL
          END as average_grade
        FROM users u
        JOIN class_student cs ON u.user_id = cs.student_id
        JOIN class c ON cs.class_id = c.class_id
        LEFT JOIN class_subject cs2 ON c.class_id = cs2.class_id
        LEFT JOIN student_grade sg ON u.user_id = sg.student_id 
          AND sg.subject_id = cs2.subject_id 
          AND sg.quarter = $2
        WHERE c.class_id = $1
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
    `;

    const queryParams = quarter === 'final' ? [classId] : [classId, quarter];
    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching class average grades:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get students in a class for grade upload
router.get('/:classId/grade-upload/students', async (req, res) => {
  try {
    const { classId } = req.params;
    const query = `
      SELECT 
        u.user_id,
        u.fname,
        u.mname,
        u.lname
      FROM users u
      JOIN class_student cs ON u.user_id = cs.student_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    const result = await pool.query(query, [classId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching students for grade upload:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// Get enrollment statistics for a class
router.get('/:classId/enrollment-statistics', async (req, res) => {
  try {
    const { classId } = req.params;
    const { schoolYearId, month, year } = req.query;
    
    if (!classId || !schoolYearId) {
      return res.status(400).json({ error: 'Class ID and School Year ID are required' });
    }
    
    // Get the school year information to calculate the first Friday of June
    const schoolYearResult = await pool.query(
      'SELECT * FROM school_year WHERE school_year_id = $1',
      [schoolYearId]
    );
    
    if (schoolYearResult.rows.length === 0) {
      return res.status(404).json({ error: 'School year not found' });
    }
    
    const schoolYear = schoolYearResult.rows[0];
    const schoolYearStart = schoolYear.school_year.split('-')[0];
    
    // Calculate the first Friday of June for this school year
    const june1st = new Date(`${schoolYearStart}-06-01`);
    const dayOfWeek = june1st.getDay(); // 0 = Sunday, 6 = Saturday
    const daysUntilFriday = (dayOfWeek <= 5) ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
    const firstFridayOfJune = new Date(june1st);
    firstFridayOfJune.setDate(june1st.getDate() + daysUntilFriday);
    
    // Format as YYYY-MM-DD for SQL comparison
    const cutoffDate = firstFridayOfJune.toISOString().split('T')[0];
    
    // Calculate the end date of the selected month
    let endOfMonth;
    if (month && year) {
      // Month is 1-based in the query, but 0-based in JavaScript Date
      // Last day of month = day 0 of next month
      endOfMonth = new Date(year, parseInt(month), 0);
    } else {
      // If no month/year provided, use current date
      endOfMonth = new Date();
    }
    const endOfMonthStr = endOfMonth.toISOString().split('T')[0];
    
    // Get enrollment statistics
    const query = `
      SELECT 
        u.gender,
        SUM(CASE WHEN cs.date_enrolled <= $3 THEN 1 ELSE 0 END) as enrolled_before_cutoff,
        SUM(CASE WHEN cs.date_enrolled > $3 THEN 1 ELSE 0 END) as enrolled_after_cutoff,
        COUNT(*) as total
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      JOIN class c ON cs.class_id = c.class_id
      WHERE cs.class_id = $1 AND c.school_year_id = $2
      GROUP BY u.gender
    `;
    
    const result = await pool.query(query, [classId, schoolYearId, cutoffDate]);
    
    // Get dropped/transferred out students as of the end of the selected month
    const statusQuery = `
      SELECT 
        u.gender,
        COUNT(CASE WHEN ss.status_type IN ('DROPPED_OUT', 'TRANSFERRED_OUT') AND ss.effective_date <= $3 THEN 1 END) as dropped_count
      FROM student_status ss
      JOIN users u ON ss.student_id = u.user_id
      WHERE ss.class_id = $1 AND ss.school_year_id = $2
      GROUP BY u.gender
    `;
    
    const statusResult = await pool.query(statusQuery, [classId, schoolYearId, endOfMonthStr]);
    
    // Format the response
    const stats = {
      cutoffDate,
      endOfMonth: endOfMonthStr,
      enrollment: {
        male: 0,
        female: 0,
        total: 0
      },
      lateEnrollment: {
        male: 0,
        female: 0,
        total: 0
      },
      registeredLearners: {
        male: 0,
        female: 0,
        total: 0
      }
    };
    
    // Initialize dropped count
    const droppedCount = {
      male: 0,
      female: 0
    };
    
    // Process dropped/transferred out stats
    statusResult.rows.forEach(row => {
      if (row.gender === 'M') {
        droppedCount.male = parseInt(row.dropped_count || 0);
      } else if (row.gender === 'F') {
        droppedCount.female = parseInt(row.dropped_count || 0);
      }
    });
    
    // Process enrollment stats
    result.rows.forEach(row => {
      if (row.gender === 'M') {
        stats.enrollment.male = parseInt(row.enrolled_before_cutoff);
        stats.lateEnrollment.male = parseInt(row.enrolled_after_cutoff);
        
        // Calculate registered learners (total enrolled minus dropped/transferred out)
        const totalEnrolledMale = parseInt(row.total);
        stats.registeredLearners.male = Math.max(0, totalEnrolledMale - droppedCount.male);
      } else if (row.gender === 'F') {
        stats.enrollment.female = parseInt(row.enrolled_before_cutoff);
        stats.lateEnrollment.female = parseInt(row.enrolled_after_cutoff);
        
        // Calculate registered learners (total enrolled minus dropped/transferred out)
        const totalEnrolledFemale = parseInt(row.total);
        stats.registeredLearners.female = Math.max(0, totalEnrolledFemale - droppedCount.female);
      }
    });
    
    // Calculate totals
    stats.enrollment.total = stats.enrollment.male + stats.enrollment.female;
    stats.lateEnrollment.total = stats.lateEnrollment.male + stats.lateEnrollment.female;
    stats.registeredLearners.total = stats.registeredLearners.male + stats.registeredLearners.female;
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching enrollment statistics:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router; 