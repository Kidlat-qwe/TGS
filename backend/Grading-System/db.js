import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get directory name in ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file if it exists
const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

// Get the database connection string - prioritize the one from .env
const connectionString = process.env.DB_CONNECTION_STRING;

// Determine if running in Replit
const isReplit = !!process.env.REPL_SLUG;

// Database configuration with fallback values
let dbConfig;

// If connection string exists and we're in Replit or explicitly configured to use it, use it
if (connectionString && (isReplit || process.env.USE_CONNECTION_STRING === 'true')) {
  console.log('Using database connection string for Grading System');
  dbConfig = {
    connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  // Otherwise use individual parameters
  console.log('Using individual database parameters for Grading System');
  dbConfig = {
    user: process.env.PGUSER || process.env.DB_USER || "postgres",
    host: process.env.PGHOST || process.env.DB_HOST || "localhost",
    database: process.env.PGDATABASE || process.env.DB_NAME || "Grade",
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || "2025",
    port: parseInt(process.env.PGPORT || process.env.DB_PORT || "5432"),
    ssl: (process.env.PGSSL === 'true' || isReplit) ? {
      rejectUnauthorized: false
    } : undefined
  };
}

// Log connection details (safely)
console.log('Grading System Database Config:', {
  host: dbConfig.host || 'using connection string',
  database: dbConfig.database || 'using connection string',
  port: dbConfig.port || 'using connection string',
  ssl: dbConfig.ssl ? 'enabled' : 'disabled',
  user: dbConfig.user ? '(set)' : 'using connection string'
});

// Create a connection pool
const { Pool } = pg;
const pool = new Pool(dbConfig);

// Add event listeners for database connection
pool.on('connect', () => {
  console.log('New client connected to Grading System PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Unexpected error on grading system client:', err);
});

// Test the connection
async function testConnection() {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to Grading System database!');
    client.release();
    return true;
  } catch (error) {
    console.error('Error connecting to Grading System database:', error.message);
    return false;
  }
}

// Execute test connection when this module is imported
testConnection();

export { pool }; 