import pkg from 'pg';
const { Pool } = pkg;
import { promisify } from 'util';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get directory path for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = promisify(setTimeout);

// Debug the environment
console.log('DB Config: Running in environment:', process.env.NODE_ENV);
console.log('DB Config: Current directory:', __dirname);
console.log('DB Config: Process CWD:', process.cwd());

// Load environment variables with multiple fallback mechanisms
// First load from process root (for Render and other deployment platforms)
dotenv.config();
console.log('DB Config: Loaded root environment variables');

// Then try to load from the backend directory
const backendEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(backendEnvPath)) {
  console.log(`DB Config: Loading environment variables from: ${backendEnvPath}`);
  dotenv.config({ path: backendEnvPath });
}

// Finally try to load from the Evaluation-System directory
const evaluationEnvPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(evaluationEnvPath)) {
  console.log(`DB Config: Loading environment variables from: ${evaluationEnvPath}`);
  dotenv.config({ path: evaluationEnvPath });
} else {
  console.warn(`DB Config: Warning: .env file not found at ${evaluationEnvPath}, using environment variables from parent directories or deployment platform`);
}

// Debug: List all environment variables starting with EVALUATION_ 
console.log('DB Config: Checking for prefixed environment variables:');
let hasPrefixedVars = false;
Object.keys(process.env).forEach(key => {
  if (key.startsWith('EVALUATION_')) {
    console.log(`- Found ${key}`);
    hasPrefixedVars = true;
  }
});
if (!hasPrefixedVars) {
  console.warn('DB Config: No EVALUATION_ prefixed variables found');
}

// Check for prefixed environment variables (from main backend .env)
// This helps with deployment platforms where all variables are in a single environment
console.log('DB Config: Checking if we need to use prefixed environment variables');
if (!process.env.PGUSER && process.env.EVALUATION_PGUSER) {
  console.log('DB Config: Using prefixed environment variables from EVALUATION_ prefix');
  process.env.PGUSER = process.env.EVALUATION_PGUSER;
  process.env.PGPASSWORD = process.env.EVALUATION_PGPASSWORD;
  process.env.PGHOST = process.env.EVALUATION_PGHOST;
  process.env.PGDATABASE = process.env.EVALUATION_PGDATABASE;
  process.env.PGPORT = process.env.EVALUATION_PGPORT;
  process.env.PGSSL = process.env.EVALUATION_PGSSL;
  process.env.DATABASE_URL = process.env.EVALUATION_DATABASE_URL;
} else if (!process.env.PGUSER) {
  // Still no database variables found? Try with explicit fallbacks
  console.log('DB Config: No database variables found. Setting explicit values from environment or defaults');
  
  // RENDER-SPECIFIC VARIABLES: Render might have set these directly
  if (process.env.RENDER_DATABASE_URL) {
    console.log('DB Config: Found RENDER_DATABASE_URL, using that');
    process.env.DATABASE_URL = process.env.RENDER_DATABASE_URL;
  }
  
  // LAST RESORT: Set hard-coded values from the RENDER_DEPLOYMENT.md
  // Only use this if we're on Render and have no other options
  if (process.env.RENDER && !process.env.PGUSER && !process.env.DATABASE_URL) {
    console.log('DB Config: Setting hard-coded database values as last resort');
    process.env.PGUSER = 'neondb_owner';
    process.env.PGPASSWORD = 'npg_eSz8JNlO0xcD';
    process.env.PGHOST = 'ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech';
    process.env.PGDATABASE = 'neondb';
    process.env.PGPORT = '5432';
    process.env.PGSSL = 'true';
    process.env.DATABASE_URL = 'postgresql://neondb_owner:npg_eSz8JNlO0xcD@ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
  }
}

// Debug: Log loaded database configuration variables
console.log('Evaluation System Environment Variables:');
console.log(`- PGUSER: ${process.env.PGUSER ? '✅ Set' : '❌ Not set'}`);
console.log(`- PGPASSWORD: ${process.env.PGPASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`- PGHOST: ${process.env.PGHOST || 'Not set'}`);
console.log(`- PGDATABASE: ${process.env.PGDATABASE || 'Not set'}`);
console.log(`- PGPORT: ${process.env.PGPORT || '5432 (default)'}`);
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);

// Additional debug: Check render-specific env vars
if (process.env.RENDER) {
  console.log('DB Config: Running on Render platform');
  console.log(`- RENDER_EXTERNAL_URL: ${process.env.RENDER_EXTERNAL_URL || 'Not set'}`);
  console.log(`- RENDER_SERVICE_ID: ${process.env.RENDER_SERVICE_ID || 'Not set'}`);
}

// Maximum number of connection retries
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Validate required database environment variables
// Only if we're not using the DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.log('DB Config: Validating individual database parameters');
  const requiredDBVars = ['PGUSER', 'PGPASSWORD', 'PGHOST', 'PGDATABASE'];
  let missingVars = [];
  
  requiredDBVars.forEach(varName => {
    if (!process.env[varName]) {
      console.error(`Error: Required database environment variable ${varName} is not set`);
      missingVars.push(varName);
    }
  });
  
  if (missingVars.length > 0) {
    console.error(`Error: Missing required database variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }
} else {
  console.log('DB Config: Using DATABASE_URL for connection, no need to validate individual parameters');
}

// Environment-specific pool configuration
const poolConfigs = {
  development: {
    max: parseInt(process.env.PG_MAX_CONNECTIONS || '10'),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '2000'),
  },
  test: {
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 2000,
  },
  production: {
    max: parseInt(process.env.PG_MAX_CONNECTIONS || '20'),
    idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '5000'), // Increased for production
  }
};

// Select the appropriate pool config based on environment
const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`DB Config: Using pool configuration for ${nodeEnv} environment`);
const poolConfig = poolConfigs[nodeEnv];

// Get connection retries from environment or default to 3
const CONNECTION_RETRIES = parseInt(process.env.PG_CONNECTION_RETRIES || '3');

// Connect to the database - prefer DATABASE_URL if available
let pool;
let dbConfig = {};

if (process.env.DATABASE_URL) {
  console.log('DB Config: Creating pool using DATABASE_URL');
  pool = new Pool({ 
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined,
    ...poolConfig
  });
  
  dbConfig = {
    connectionString: `${process.env.DATABASE_URL.substring(0, 25)}...`,
    ssl: process.env.PGSSL === 'true' ? 'enabled' : 'disabled',
    ...poolConfig
  };
} else {
  console.log('DB Config: Creating pool using individual parameters');
  // Load database configuration from environment variables
  dbConfig = {
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: parseInt(process.env.PGPORT || '5432'),
    // Connection pool configuration
    ...poolConfig,
    // Add SSL configuration for Neon
    ssl: process.env.PGSSL === 'true' ? {
      rejectUnauthorized: true
    } : undefined
  };
  
  pool = new Pool(dbConfig);
}

// Log database configuration with hidden password
console.log('Database configuration:', {
  ...dbConfig,
  password: dbConfig.password ? '********' : undefined, // Hide password in logs
  connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  retries: CONNECTION_RETRIES
});

// Log connection information
console.log('Evaluation System DB connection information:');
if (process.env.DATABASE_URL) {
  console.log('- Using DATABASE_URL for connection');
} else {
  console.log('- Using individual connection parameters');
}
console.log(`- Connected to database: ${dbConfig.database || 'via connection string'} on host: ${dbConfig.host || 'via connection string'}`);
console.log(`- SSL enabled: ${process.env.PGSSL === 'true' || dbConfig.ssl ? 'Yes' : 'No'}`);

// Add event listeners for the pool
pool.on('connect', () => {
  console.log('New client connected to PostgreSQL');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err);
  // Attempt to reconnect on error
  setTimeout(testConnection, RETRY_DELAY);
});

pool.on('remove', () => {
  console.log('Client removed from pool');
});

// Track pool statistics
const poolStats = {
  totalQueries: 0,
  activeConnections: 0,
  connectionErrors: 0,
  queryErrors: 0,
  lastCheckTime: Date.now()
};

// Update and log pool statistics periodically
setInterval(() => {
  const now = Date.now();
  const elapsed = (now - poolStats.lastCheckTime) / 1000;
  const qps = poolStats.totalQueries / elapsed;
  
  console.log('DB Pool Stats:', {
    total: pool.totalCount,
    idle: pool.idleCount,
    active: pool.totalCount - pool.idleCount,
    waiting: pool.waitingCount,
    queryErrors: poolStats.queryErrors,
    connectionErrors: poolStats.connectionErrors,
    queriesPerSecond: qps.toFixed(2)
  });
  
  poolStats.totalQueries = 0;
  poolStats.lastCheckTime = now;
}, 60000); // Log stats every minute

// Function to test database connection with retries
async function testConnection(retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await pool.query('SELECT NOW()');
      console.log('PostgreSQL connected successfully to lca database:', res.rows[0].now);
      
      // Test if the teacher_grades table exists
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'teacher_grades'
        );
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('Creating teacher_grades table for the first time...');
        await pool.query(`
          CREATE TABLE teacher_grades (
            id SERIAL PRIMARY KEY,
            teacher_id VARCHAR(255) NOT NULL,
            grade NUMERIC(5,2),
            qa_comments TEXT,
            evaluation_ids INTEGER[],
            qa_evaluator VARCHAR(255),
            month INTEGER,
            year INTEGER,
            tc_grades NUMERIC(5,2),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE
          )
        `);
        console.log('teacher_grades table created successfully');
      } else {
        // Only log that table exists, don't modify it
        console.log('teacher_grades table exists, preserving existing data');
        
        // Log current table structure without modifying it
        const tableStructure = await pool.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'teacher_grades'
          ORDER BY ordinal_position;
        `);
        console.log('Current teacher_grades table structure:', tableStructure.rows);
        
        // Check if tc_grades column exists and add it if it doesn't
        const tc_gradesExists = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'teacher_grades'
            AND column_name = 'tc_grades'
          );
        `);
        
        if (!tc_gradesExists.rows[0].exists) {
          console.log('Adding tc_grades column to teacher_grades table...');
          await pool.query(`
            ALTER TABLE teacher_grades 
            ADD COLUMN tc_grades NUMERIC(5,2)
          `);
          console.log('tc_grades column added successfully');
        } else {
          console.log('tc_grades column already exists');
        }
      }
      
      // Check if the video_markers table exists
      const videoMarkersCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public'
          AND table_name = 'video_markers'
        );
      `);
      
      if (!videoMarkersCheck.rows[0].exists) {
        console.log('Creating video_markers table for the first time...');
        await pool.query(`
          CREATE TABLE video_markers (
            id SERIAL PRIMARY KEY,
            recording_id VARCHAR(255) NOT NULL,
            teacher_id VARCHAR(255) NOT NULL,
            marker_type VARCHAR(50) NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER NOT NULL,
            title VARCHAR(255),
            description TEXT,
            created_by VARCHAR(255) NOT NULL,
            is_public BOOLEAN DEFAULT false,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        console.log('video_markers table created successfully');
      } else {
        console.log('video_markers table exists, preserving existing data');
      }
      
      return true;
    } catch (err) {
      poolStats.connectionErrors++;
      console.error(`Connection attempt ${i + 1}/${retries} failed:`, err.message);
      if (i < retries - 1) {
        console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
        await sleep(RETRY_DELAY);
      }
    }
  }
  console.error('Failed to connect to PostgreSQL after multiple attempts');
  return false;
}

// Initialize connection
testConnection().catch(err => {
  console.error('Failed to initialize database connection:', err);
  process.exit(1); // Exit if we can't connect to the database
});

// Enhanced query execution function with better retry logic
async function executeQuery(queryText, params, retries = CONNECTION_RETRIES) {
  let lastError = null;
  let currentTry = 0;
  
  while (currentTry < retries) {
    try {
      currentTry++;
      
      // Log query attempt in non-production environments
      if (process.env.NODE_ENV !== 'production') {
        console.log(`DB Query attempt ${currentTry}/${retries}: ${queryText.substring(0, 100)}...`);
      }
      
      // Track statistics
      poolStats.totalQueries++;
      poolStats.activeConnections++;
      
      // Execute the query
      const result = await pool.query(queryText, params);
      
      // Track successful connection
      poolStats.activeConnections--;
      
      return result;
    } catch (error) {
      poolStats.activeConnections--; // Make sure to decrement on error too
      
      // Specific handling based on error type
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
        // This is a connection error, retry appropriate
        poolStats.connectionErrors++;
        lastError = error;
        
        const backoff = Math.min(1000 * Math.pow(2, currentTry - 1), 10000); // Exponential backoff up to 10 seconds
        console.warn(`Database connection issue (attempt ${currentTry}/${retries}), retrying in ${backoff}ms: ${error.message}`);
        
        // Wait before retrying
        await sleep(backoff);
        continue;
      } else {
        // Other query errors don't need retries
        poolStats.queryErrors++;
        console.error('Database query error:', {
          query: queryText.substring(0, 200) + (queryText.length > 200 ? '...' : ''),
          code: error.code,
          message: error.message
        });
        throw error;
      }
    }
  }
  
  // All retries failed
  console.error(`Failed to execute query after ${retries} attempts`);
  throw lastError || new Error('Maximum query retries exceeded');
}

// User-related database functions with enhanced error handling
const userFunctions = {
  // Create a new user
  createUser: async (email, name, userType) => {
    try {
      const result = await executeQuery(
        'INSERT INTO users (email, name, user_type, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
        [email, name, userType]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Get user by email
  getUserByEmail: async (email) => {
    try {
      const result = await executeQuery(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user by email:', error);
      throw error;
    }
  },

  // Get user by ID
  getUserById: async (id) => {
    try {
      const result = await executeQuery(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error getting user by ID:', error);
      throw error;
    }
  },

  // Update user type
  updateUserType: async (id, userType) => {
    try {
      const result = await executeQuery(
        'UPDATE users SET user_type = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [userType, id]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error updating user type:', error);
      throw error;
    }
  },

  // Get all users
  getAllUsers: async () => {
    try {
      const result = await executeQuery(
        'SELECT * FROM users ORDER BY created_at DESC',
        []
      );
      return result.rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  },

  // Delete user
  deleteUser: async (id) => {
    try {
      await executeQuery('DELETE FROM users WHERE id = $1', [id]);
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
};

// Video markers functions
const markerFunctions = {
  // Create a new video marker
  createMarker: async (data) => {
    try {
      const { 
        recording_id, 
        teacher_id, 
        marker_type, 
        start_time, 
        end_time, 
        title, 
        description, 
        created_by,
        is_public
      } = data;
      
      const result = await executeQuery(
        `INSERT INTO video_markers 
         (recording_id, teacher_id, marker_type, start_time, end_time, title, description, created_by, is_public, created_at, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) 
         RETURNING *`,
        [recording_id, teacher_id, marker_type, start_time, end_time, title, description, created_by, is_public || false]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating video marker:', error);
      throw error;
    }
  },

  // Get markers for a specific recording
  getMarkersByRecording: async (recording_id) => {
    try {
      const result = await executeQuery(
        'SELECT * FROM video_markers WHERE recording_id = $1 ORDER BY created_at DESC',
        [recording_id]
      );
      
      return result.rows;
    } catch (error) {
      console.error('Error getting markers by recording:', error);
      throw error;
    }
  },

  // Get all public "Amazing Moments" markers for all teachers
  getPublicAmazingMoments: async (limit = 10) => {
    try {
      console.log('DB DEBUG: Getting public amazing moments, limit:', limit);
      
      // First check if there are any public amazing moments
      const countQuery = `
        SELECT COUNT(*) 
        FROM video_markers 
        WHERE marker_type = 'amazing' AND is_public = true
      `;
      
      const countResult = await executeQuery(countQuery, []);
      const count = parseInt(countResult.rows[0].count);
      console.log(`DB DEBUG: Found ${count} public amazing moments in database`);
      
      // If no public amazing moments, log more details
      if (count === 0) {
        console.log('DB DEBUG: No public amazing moments found, checking database...');
        
        // Check if there are any amazing moments (public or private)
        const amazingQuery = `
          SELECT COUNT(*) 
          FROM video_markers 
          WHERE marker_type = 'amazing'
        `;
        
        const amazingResult = await executeQuery(amazingQuery, []);
        const amazingCount = parseInt(amazingResult.rows[0].count);
        console.log(`DB DEBUG: Total amazing moments (public or private): ${amazingCount}`);
        
        // List all markers with their is_public status for debugging
        if (amazingCount > 0) {
          console.log('DB DEBUG: Checking amazing moments records:');
          const detailQuery = `
            SELECT id, marker_type, is_public, teacher_id, title 
            FROM video_markers 
            WHERE marker_type = 'amazing' 
            LIMIT 10
          `;
          
          const detailResult = await executeQuery(detailQuery, []);
          console.log('DB DEBUG: Amazing moments details:', detailResult.rows);
        }
      }
      
      // Original query to get public amazing moments with user info
      const result = await executeQuery(
        `SELECT vm.*, u.name as teacher_name, u.email as teacher_email 
         FROM video_markers vm
         LEFT JOIN users u ON vm.teacher_id = u.email
         WHERE vm.marker_type = 'amazing' AND vm.is_public = true
         ORDER BY vm.created_at DESC
         LIMIT $1`,
        [limit]
      );
      
      console.log(`DB DEBUG: Returning ${result.rows.length} public amazing moments`);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting public amazing moments:', error);
      throw error;
    }
  },

  // Get teacher-specific markers (both amazing and error)
  getTeacherMarkers: async (teacher_id) => {
    try {
      console.log(`DB: Getting markers for teacher_id: ${teacher_id}`);
      
      // Normalize the teacher_id to try multiple formats
      let baseUsername = teacher_id;
      
      // Remove domain part if it exists
      if (baseUsername.includes('@')) {
        baseUsername = baseUsername.split('@')[0];
      }
      
      // Remove t. prefix if it exists
      if (baseUsername.startsWith('t.')) {
        baseUsername = baseUsername.substring(2);
      }
      
      // Create alternate formats to try
      const alternateFormats = [
        teacher_id,  // Original format
        `t.${baseUsername}@little-champions.com`,
        `t.${baseUsername}@rhet-corp.com`,
        baseUsername
      ];
      
      console.log(`DB: Will try these teacher ID formats: ${alternateFormats.join(', ')}`);
      
      // Build a parameterized query that checks multiple formats
      const placeholders = alternateFormats.map((_, i) => `$${i + 1}`).join(' OR teacher_id = ');
      const query = `SELECT * FROM video_markers WHERE teacher_id = ${placeholders} ORDER BY created_at DESC`;
      
      const result = await executeQuery(query, alternateFormats);
      console.log(`DB: Found ${result.rows.length} markers across all formats for teacher ${teacher_id}`);
      
      return result.rows;
    } catch (error) {
      console.error('Error getting teacher markers:', error);
      throw error;
    }
  },

  // Update a marker
  updateMarker: async (id, data) => {
    try {
      const { start_time, end_time, title, description, is_public, marker_type } = data;
      
      const result = await executeQuery(
        `UPDATE video_markers 
         SET start_time = $1, end_time = $2, title = $3, description = $4, is_public = $5, marker_type = $6, updated_at = NOW()
         WHERE id = $7
         RETURNING *`,
        [start_time, end_time, title, description, is_public, marker_type, id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error updating marker:', error);
      throw error;
    }
  },

  // Delete a marker
  deleteMarker: async (id) => {
    try {
      const result = await executeQuery(
        'DELETE FROM video_markers WHERE id = $1 RETURNING id',
        [id]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('Error deleting marker:', error);
      throw error;
    }
  },

  // Make an Amazing Moment public (for debugging purposes)
  makeAmazingMomentPublic: async (markerId) => {
    try {
      console.log(`DB DEBUG: Attempting to make Amazing Moment (ID: ${markerId}) public`);
      
      // First check if marker exists and is an amazing moment
      const checkQuery = `
        SELECT id, marker_type, is_public, teacher_id, title 
        FROM video_markers 
        WHERE id = $1
      `;
      
      const checkResult = await executeQuery(checkQuery, [markerId]);
      
      if (checkResult.rows.length === 0) {
        console.log(`DB DEBUG: Marker with ID ${markerId} not found`);
        return { success: false, message: "Marker not found" };
      }
      
      const marker = checkResult.rows[0];
      console.log(`DB DEBUG: Found marker:`, marker);
      
      if (marker.marker_type !== 'amazing') {
        console.log(`DB DEBUG: Marker is not an Amazing Moment (type: ${marker.marker_type})`);
        return { success: false, message: "Marker is not an Amazing Moment" };
      }
      
      // Update the marker to be public
      const updateQuery = `
        UPDATE video_markers
        SET is_public = true
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await executeQuery(updateQuery, [markerId]);
      console.log(`DB DEBUG: Updated marker to public:`, result.rows[0]);
      
      return { 
        success: true, 
        message: "Amazing Moment is now public",
        marker: result.rows[0]
      };
    } catch (error) {
      console.error('Error making Amazing Moment public:', error);
      return { success: false, message: error.message };
    }
  }
};

// Create the DB object to export
const db = {
  pool,
  testConnection,
  executeQuery,
  ...userFunctions,
  markerFunctions,
  makeAmazingMomentPublic: async (markerId) => {
    try {
      const result = await executeQuery(
        `UPDATE video_markers
         SET is_public = TRUE, 
             updated_at = NOW()
         WHERE id = $1 AND marker_type = 'amazing'
         RETURNING *`,
        [markerId]
      );
      
      if (result.rows.length === 0) {
        return { 
          success: false, 
          message: 'Marker not found or is not an amazing moment' 
        };
      }
      
      return { 
        success: true, 
        message: 'Amazing moment is now public',
        marker: result.rows[0]
      };
    } catch (error) {
      console.error('Error making amazing moment public:', error);
      return { 
        success: false, 
        message: error.message
      };
    }
  }
};

export default db; 