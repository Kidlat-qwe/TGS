import express from 'express';
import { pool } from '../db.js';

const router = express.Router();

// Get attendance records by class and date
router.get('/', async (req, res) => {
  try {
    console.log('Fetching attendance with query params:', req.query);
    const { classId, date } = req.query;
    
    if (!classId || !date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Both classId and date are required parameters' 
      });
    }
    
    // Parse the date to extract month and year
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format. Please use YYYY-MM-DD format.' 
      });
    }
    
    const month = dateObj.getMonth() + 1; // JavaScript months are 0-indexed
    const year = dateObj.getFullYear();
    const day = dateObj.getDate();
    
    console.log(`Parsed date: year=${year}, month=${month}, day=${day}`);
    
    // First check if class exists
    const classCheck = await pool.query('SELECT class_id FROM class WHERE class_id = $1', [classId]);
    if (classCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Class not found'
      });
    }
    
    // Get active school year ID if not provided
    let schoolYearId;
    try {
      const schoolYearQuery = 'SELECT school_year_id FROM school_year WHERE is_active = TRUE LIMIT 1';
      const schoolYearResult = await pool.query(schoolYearQuery);
      
      if (schoolYearResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No active school year found'
        });
      }
      
      schoolYearId = schoolYearResult.rows[0].school_year_id;
      console.log(`Using active school year: ${schoolYearId}`);
    } catch (error) {
      console.error('Error getting active school year:', error);
      return res.status(500).json({
        success: false,
        message: 'Error getting active school year',
        error: error.message
      });
    }
    
    // Get students in the class
    const studentsQuery = `
      SELECT cs.student_id, u.fname, u.mname, u.lname, u.gender
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    
    const studentsResult = await pool.query(studentsQuery, [classId]);
    console.log(`Found ${studentsResult.rows.length} students in the class`);
    
    // Get attendance records for this specific date
    const attendanceQuery = `
      SELECT student_id, status 
      FROM student_attendance
      WHERE class_id = $1
        AND school_year_id = $2
        AND month = $3
        AND day = $4
    `;
    
    const attendanceResult = await pool.query(attendanceQuery, [
      classId,
      schoolYearId,
      month,
      day
    ]);
    
    console.log(`Found ${attendanceResult.rows.length} attendance records for this date`);
    
    // Build a map of attendance records
    const attendanceMap = {};
    attendanceResult.rows.forEach(record => {
      attendanceMap[record.student_id] = record.status;
    });
    
    // Format the response
    const studentsWithAttendance = studentsResult.rows.map(student => {
      return {
        ...student,
        status: attendanceMap[student.student_id] || null
      };
    });
    
    // Return success response
    res.json({
      success: true,
      date: date,
      classId: classId,
      schoolYearId: schoolYearId,
      students: studentsWithAttendance
    });
    
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch attendance data',
      error: error.message
    });
  }
});

// Get attendance for a class in a specific month
router.get('/class/:classId/month/:month/year/:year', async (req, res) => {
  try {
    const { classId, month, year } = req.params;
    const { schoolYearId } = req.query;
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'schoolYearId is a required query parameter' });
    }
    
    const monthInt = parseInt(month);
    
    // Get all students in the class
    const studentsQuery = `
      SELECT cs.student_id, u.fname, u.mname, u.lname, u.gender
      FROM class_student cs
      JOIN users u ON cs.student_id = u.user_id
      WHERE cs.class_id = $1
      ORDER BY u.lname, u.fname
    `;
    
    const studentsResult = await pool.query(studentsQuery, [classId]);
    
    // Get attendance records for this class, month, and school year
    const attendanceQuery = `
      SELECT student_id, day, status 
      FROM student_attendance
      WHERE class_id = $1
        AND school_year_id = $2
        AND month = $3
    `;
    
    const attendanceResult = await pool.query(attendanceQuery, [
      classId,
      schoolYearId,
      monthInt
    ]);
    
    // Build a map of attendance records
    const attendanceMap = {};
    
    attendanceResult.rows.forEach(record => {
      if (!attendanceMap[record.student_id]) {
        attendanceMap[record.student_id] = {};
      }
      attendanceMap[record.student_id][record.day] = record.status;
    });
    
    // Format the response
    const studentsWithAttendance = studentsResult.rows.map(student => {
      return {
        ...student,
        attendance: attendanceMap[student.student_id] || {}
      };
    });
    
    // Calculate days in month
    const daysInMonth = new Date(parseInt(year), monthInt, 0).getDate();
    
    res.json({
      students: studentsWithAttendance,
      daysInMonth: daysInMonth
    });
    
  } catch (error) {
    console.error('Error fetching attendance:', error);
    res.status(500).json({ error: 'Failed to fetch attendance data' });
  }
});

// Update attendance for a single student on a specific day
router.post('/update', async (req, res) => {
  try {
    const { 
      class_id, 
      student_id, 
      school_year_id, 
      month, 
      day, 
      status 
    } = req.body;
    
    // Validate inputs
    if (!class_id || !student_id || !school_year_id || !month || !day) {
      return res.status(400).json({ 
        error: 'Missing required fields' 
      });
    }
    
    // Validate status
    if (status && !['P', 'A', 'L'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status',
        detail: "Status must be 'P' (present), 'A' (absent), or 'L' (late)"
      });
    }
    
    // If status is null/empty, delete the record if it exists
    if (!status) {
      await pool.query(
        'DELETE FROM student_attendance WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND month = $4 AND day = $5',
        [student_id, class_id, school_year_id, month, day]
      );
      
      return res.json({ message: 'Attendance record cleared' });
    }
    
    // Otherwise, insert or update the record
    const query = `
      INSERT INTO student_attendance
        (student_id, class_id, school_year_id, month, day, status)
      VALUES
        ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (student_id, class_id, school_year_id, month, day)
      DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING attendance_id
    `;
    
    const result = await pool.query(query, [
      student_id,
      class_id,
      school_year_id,
      month,
      day,
      status
    ]);
    
    res.json({
      message: 'Attendance record updated',
      attendanceId: result.rows[0].attendance_id
    });
    
  } catch (error) {
    console.error('Error updating attendance:', error);
    res.status(500).json({ error: 'Failed to update attendance record' });
  }
});

// Batch update multiple attendance records
router.post('/batch', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { 
      class_id, 
      school_year_id, 
      month,
      records,
      total_school_days
    } = req.body;
    
    // Validate inputs
    if (!class_id || !school_year_id || !month || !Array.isArray(records)) {
      return res.status(400).json({ 
        error: 'Invalid request data' 
      });
    }
    
    await client.query('BEGIN');
    
    const updatedRecords = [];
    
    for (const record of records) {
      const { student_id, day, status } = record;
      
      // Skip invalid records
      if (!student_id || !day) continue;
      
      if (!status) {
        // Delete record if status is empty
        await client.query(
          'DELETE FROM student_attendance WHERE student_id = $1 AND class_id = $2 AND school_year_id = $3 AND month = $4 AND day = $5',
          [student_id, class_id, school_year_id, month, day]
        );
        
        updatedRecords.push({ student_id, day, action: 'deleted' });
      } else {
        // Insert or update record
        const query = `
          INSERT INTO student_attendance
            (student_id, class_id, school_year_id, month, day, status)
          VALUES
            ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (student_id, class_id, school_year_id, month, day)
          DO UPDATE SET
            status = EXCLUDED.status,
            updated_at = CURRENT_TIMESTAMP
          RETURNING attendance_id
        `;
        
        const result = await client.query(query, [
          student_id,
          class_id,
          school_year_id,
          month,
          day,
          status
        ]);
        
        updatedRecords.push({ 
          student_id, 
          day, 
          attendance_id: result.rows[0].attendance_id,
          action: 'updated'
        });
      }
    }
    
    // Store the total_school_days in a separate table or metadata if needed
    // For now, we'll just include it in the response
    
    await client.query('COMMIT');
    
    res.json({
      message: `Updated ${updatedRecords.length} attendance records`,
      records: updatedRecords,
      total_school_days: total_school_days
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in batch attendance update:', error);
    res.status(500).json({ error: 'Failed to update attendance records' });
  } finally {
    client.release();
  }
});

// Get attendance summary by gender for a specific month
router.get('/summary/:classId/:month/:year', async (req, res) => {
  try {
    const { classId, month, year } = req.params;
    const { schoolYearId } = req.query;
    
    console.log('Fetching attendance summary:', { classId, month, year, schoolYearId });
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'schoolYearId is required' });
    }
    
    // Get attendance with gender information - use more detailed query
    const query = `
      SELECT 
        sa.status, 
        u.gender,
        sa.student_id,
        sa.day
      FROM student_attendance sa
      JOIN users u ON sa.student_id = u.user_id
      WHERE sa.class_id = $1
        AND sa.school_year_id = $2
        AND sa.month = $3
    `;
    
    const result = await pool.query(query, [classId, schoolYearId, month]);
    
    console.log(`Found ${result.rowCount} attendance records`);
    
    // Calculate summary
    const summary = {
      male: { present: 0, absent: 0, late: 0 },
      female: { present: 0, absent: 0, late: 0 }
    };
    
    // Keep track of unique student/day combinations to avoid double counting
    const processedEntries = new Set();
    
    result.rows.forEach(row => {
      const entryKey = `${row.student_id}-${row.day}`;
      
      // Skip if we've already processed this student/day combination
      if (processedEntries.has(entryKey)) return;
      
      processedEntries.add(entryKey);
      
      const gender = row.gender === 'M' ? 'male' : 'female';
      
      if (row.status === 'P') {
        summary[gender].present++;
      } else if (row.status === 'A') {
        summary[gender].absent++;
      } else if (row.status === 'L') {
        summary[gender].late++;
      }
    });
    
    console.log('Calculated summary:', summary);
    
    // Get total school days (unique days with any attendance record)
    const daysQuery = `
      SELECT COUNT(DISTINCT day) as total_days
      FROM student_attendance
      WHERE class_id = $1
        AND school_year_id = $2
        AND month = $3
    `;
    
    const daysResult = await pool.query(daysQuery, [classId, schoolYearId, month]);
    const totalDays = daysResult.rows[0]?.total_days || 0;
    
    console.log('Total days with attendance records:', totalDays);
    
    res.json({
      summary,
      totalDays
    });
    
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Delete attendance for a specific class for a month/year
router.delete('/class/:classId/month/:month/year/:year', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { classId, month, year } = req.params;
    const { schoolYearId, day } = req.query;
    
    if (!schoolYearId) {
      return res.status(400).json({ error: 'schoolYearId is a required query parameter' });
    }
    
    await client.query('BEGIN');
    
    let deleteQuery;
    let queryParams;
    
    if (day) {
      // Delete records for a specific day only
      deleteQuery = `
        DELETE FROM student_attendance 
        WHERE class_id = $1 
        AND school_year_id = $2 
        AND month = $3 
        AND day = $4
      `;
      queryParams = [classId, schoolYearId, month, day];
      console.log(`Deleting attendance records for class ${classId}, day ${day}, month ${month}, year ${year}`);
    } else {
      // Delete all records for the month
      deleteQuery = `
        DELETE FROM student_attendance 
        WHERE class_id = $1 
        AND school_year_id = $2 
        AND month = $3
      `;
      queryParams = [classId, schoolYearId, month];
      console.log(`Deleting all attendance records for class ${classId}, month ${month}, year ${year}`);
    }
    
    const result = await client.query(deleteQuery, queryParams);
    
    await client.query('COMMIT');
    
    res.json({
      message: `Deleted ${result.rowCount} attendance records`,
      recordsDeleted: result.rowCount
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting attendance records:', error);
    res.status(500).json({ error: 'Failed to delete attendance records' });
  } finally {
    client.release();
  }
});

// Debug endpoint to check database structure
router.get('/debug', async (req, res) => {
  try {
    console.log('Checking student_attendance table structure');
    
    // Check if the table exists
    const tableCheckQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'student_attendance'
      ) as student_attendance_exists
    `;
    
    const tableCheckResult = await pool.query(tableCheckQuery);
    const tableExists = tableCheckResult.rows[0].student_attendance_exists;
    
    // Get table columns if the table exists
    let columns = [];
    let recordCount = 0;
    
    if (tableExists) {
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'student_attendance'
        ORDER BY ordinal_position
      `;
      
      const columnsResult = await pool.query(columnsQuery);
      columns = columnsResult.rows;
      
      // Count records
      const countQuery = 'SELECT COUNT(*) as count FROM student_attendance';
      const countResult = await pool.query(countQuery);
      recordCount = countResult.rows[0].count;
    }
    
    // Check other related tables
    const otherTablesQuery = `
      SELECT 
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class')) as class_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_student')) as class_student_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')) as users_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_year')) as school_year_exists
    `;
    
    const otherTablesResult = await pool.query(otherTablesQuery);
    
    // Get sample data if available
    let sampleData = [];
    if (tableExists && recordCount > 0) {
      const sampleQuery = 'SELECT * FROM student_attendance LIMIT 5';
      const sampleResult = await pool.query(sampleQuery);
      sampleData = sampleResult.rows;
    }
    
    res.json({
      student_attendance_exists: tableExists,
      record_count: recordCount,
      table_columns: columns,
      related_tables: otherTablesResult.rows[0],
      sample_data: sampleData,
      database_name: process.env.PGDATABASE || 'unknown'
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking database structure',
      error: error.message
    });
  }
});

export default router; 