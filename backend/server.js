import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pg from 'pg';
import { promisify } from 'util';
import * as fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';
import cookieParser from 'cookie-parser';

// Import auth middleware
import { verifyAdmin } from './Token-System/Middlewares/auth.js';

// Import the email service
import emailService from './Token-System/Utils/email-service.js';

// Get filename for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file in the parent directory
// This ensures all imported modules have access to the same environment variables
const envPath = path.join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log(`Loaded environment variables from: ${envPath}`);
  console.log(`SMTP_HOST: ${process.env.SMTP_HOST || 'not set'}`);
  console.log(`SMTP_USER: ${process.env.SMTP_USER || 'not set'}`);
}

// File paths for persistent storage
const APPROVED_USERS_FILE = path.join(__dirname, 'data', 'approved-users.json');
const PENDING_USERS_FILE = path.join(__dirname, 'data', 'pending-users.json');
const ADMIN_CONTACTS_FILE = path.join(__dirname, 'data', 'admin-contacts.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// Initialize data from persistent storage
loadPersistentData();

// Function to load data from persistent storage
function loadPersistentData() {
  try {
    // Initialize global variables to prevent null/undefined errors
    global.approvedUsers = [];
    global.mockPendingUsers = [];
    global.adminContacts = [];

    // Load approved users
    if (fs.existsSync(APPROVED_USERS_FILE)) {
      const approvedUsersData = fs.readFileSync(APPROVED_USERS_FILE, 'utf8');
      global.approvedUsers = JSON.parse(approvedUsersData);
      console.log(`Loaded ${global.approvedUsers.length} approved users from persistent storage`);
    } else {
      global.approvedUsers = [
        {
          email: 'admin@gmail.com',
          password: 'password123', // For testing only
          role: 'admin'
        }
      ];
      savePersistentData();
      console.log('Initialized approved users with default admin');
    }

    // Load pending users
    if (fs.existsSync(PENDING_USERS_FILE)) {
      const pendingUsersData = fs.readFileSync(PENDING_USERS_FILE, 'utf8');
      global.mockPendingUsers = JSON.parse(pendingUsersData);
      console.log(`Loaded ${global.mockPendingUsers.length} pending users from persistent storage`);
    } else {
      global.mockPendingUsers = [];
      console.log('Initialized empty mock pending users list');
    }

    // Load admin contact requests
    if (fs.existsSync(ADMIN_CONTACTS_FILE)) {
      const adminContactsData = fs.readFileSync(ADMIN_CONTACTS_FILE, 'utf8');
      global.adminContacts = JSON.parse(adminContactsData);
      console.log(`Loaded ${global.adminContacts.length} admin contact requests from persistent storage`);
    } else {
      global.adminContacts = [];
      console.log('Initialized empty admin contacts list');
    }
  } catch (error) {
    console.error('Error loading persistent data:', error);
    // Initialize with defaults if loading fails
    if (!global.approvedUsers) {
      global.approvedUsers = [
        {
          email: 'admin@gmail.com',
          password: 'password123', // For testing only
          role: 'admin'
        }
      ];
    }
    if (!global.mockPendingUsers) {
      global.mockPendingUsers = [];
    }
    if (!global.adminContacts) {
      global.adminContacts = [];
    }
  }
}

// Function to save data to persistent storage
function savePersistentData() {
  try {
    // Create data directory if it doesn't exist (check again just to be sure)
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
      fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
      console.log('Created data directory');
    }

    // Save approved users
    if (global.approvedUsers) {
      try {
        fs.writeFileSync(APPROVED_USERS_FILE, JSON.stringify(global.approvedUsers, null, 2));
        console.log(`Saved ${global.approvedUsers.length} approved users to persistent storage`);
      } catch (approvedUsersError) {
        console.error('Error saving approved users:', approvedUsersError);
      }
    }

    // Save pending users
    if (global.mockPendingUsers) {
      try {
        fs.writeFileSync(PENDING_USERS_FILE, JSON.stringify(global.mockPendingUsers, null, 2));
        console.log(`Saved ${global.mockPendingUsers.length} pending users to persistent storage`);
      } catch (pendingUsersError) {
        console.error('Error saving pending users:', pendingUsersError);
      }
    }

    // Save admin contact requests
    if (global.adminContacts) {
      try {
        fs.writeFileSync(ADMIN_CONTACTS_FILE, JSON.stringify(global.adminContacts, null, 2));
        console.log(`Saved ${global.adminContacts.length} admin contacts to persistent storage`);
      } catch (adminContactsError) {
        console.error('Error saving admin contacts:', adminContactsError);
      }
    }
  } catch (error) {
    console.error('Error saving persistent data:', error);
  }
}

// Make these functions available globally
global.loadPersistentData = loadPersistentData;
global.savePersistentData = savePersistentData;

// ===== APP CONFIGURATION =====

const app = express();
const PORT = 5000; // Set port explicitly to 5000 to match frontend expectations

// Maximum number of connection retries
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5 seconds

// Configure CORS
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'http://localhost:3000', 
    'http://localhost:5174', 
    'http://127.0.0.1:5173',
    // Add Replit domains
    `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`,
    // Wildcard for Replit domains as fallback
    /.+\.repl\.co$/
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // This is important for cookies
}));

app.use(express.json());
app.use(cookieParser()); // Add cookie parser middleware

// ===== DATABASE CONFIGURATION =====

// Load environment variables with defaults for evaluation system
const evaluationEnvPath = path.join(__dirname, 'Evaluation-System', '.env');
if (fs.existsSync(evaluationEnvPath)) {
  console.log(`Loading Evaluation System environment variables from: ${evaluationEnvPath}`);
  // Load the evaluation system env variables into process.env
  dotenv.config({ path: evaluationEnvPath });
}

const evaluationDbConfig = {
  user: process.env.PGUSER || 'postgres',
  host: process.env.PGHOST || 'localhost',
  database: process.env.PGDATABASE || 'lca',
  password: process.env.PGPASSWORD || '2025',
  port: parseInt(process.env.PGPORT || '5432'),
  max: parseInt(process.env.PG_MAX_CONNECTIONS || '20'),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.PG_CONNECTION_TIMEOUT || '2000'),
  ssl: process.env.PGSSL === 'true' ? {
    rejectUnauthorized: false
  } : undefined
};

// Create connection pool for evaluation system
const { Pool } = pg;
const evaluationPool = new Pool(evaluationDbConfig);

// Import grading system pool from db.js instead of creating one here
import { pool as gradePool } from './Grading-System/db.js';

// Add event listeners for evaluation pool
evaluationPool.on('connect', () => {
  console.log('New client connected to Evaluation PostgreSQL');
});

evaluationPool.on('error', (err, client) => {
  console.error('Unexpected error on evaluation client:', err);
  setTimeout(testConnection, RETRY_DELAY);
});

evaluationPool.on('remove', () => {
  console.log('Evaluation client removed from pool');
});

// Export both pools for use in other files
export { evaluationPool, gradePool };

// ===== ROUTE IMPORTS =====

// Token System Routes
import tokenAuth from './Token-System/Routes/auth.js';
import tokenTokens from './Token-System/Routes/tokens.js';
import tokenAdminContacts from './Token-System/Routes/admin-contacts.js';
import tokenPendingUsers from './Token-System/Routes/pending-users.js';

// Evaluation System Routes - Import the main index router
import evaluationRoutes from './Evaluation-System/Routes/index.js';

// Grading System Routes
import gradingAuth from './Grading-System/Routes/auth.js';
import gradingActivities from './Grading-System/Routes/activities.js';
import gradingClasses from './Grading-System/Routes/classes.js';
import gradingGrades from './Grading-System/Routes/grades.js';
import gradingSchoolYears from './Grading-System/Routes/school-years.js';
import gradingSubjects from './Grading-System/Routes/subjects.js';
import gradingTeachers from './Grading-System/Routes/teachers.js';
import gradingUsers from './Grading-System/Routes/users.js';
import gradingStudents from './Grading-System/Routes/students.js';
import gradingAttendance from './Grading-System/Routes/attendance.js';
import gradingCriteria from './Grading-System/Routes/grading-criteria.js';
import gradingStudentStatus from './Grading-System/Routes/student-status.js';

// Import Grading System Middleware
import { authenticateToken as gradingAuthMiddleware } from './Grading-System/Middlewares/middleware.js';

// Make sure the Evaluation System has access to its environment variables
console.log('Evaluation System JWT_SECRET:', process.env.JWT_SECRET ? (process.env.JWT_SECRET.substring(0, 5) + '...') : 'Not set');
console.log('Evaluation System DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');

// ===== ROUTE SETUP =====

// Token System Routes
app.use('/api/auth', tokenAuth);
app.use('/api/tokens', tokenTokens);
app.use('/api/admin-contacts', tokenAdminContacts);
app.use('/api/pending-users', tokenPendingUsers);

// Mount Evaluation System routes
console.log('Mounting Evaluation System routes at /api/evaluation');
app.use('/api/evaluation', evaluationRoutes);
console.log('Evaluation System routes mounted successfully');

// Grading System Routes
app.use('/api/grading/auth', gradingAuth); // Auth routes shouldn't require token authentication
// Apply token authentication middleware to all other grading system routes
app.use('/api/grading/users', gradingAuthMiddleware, gradingUsers);
app.use('/api/grading/subjects', gradingAuthMiddleware, gradingSubjects);
app.use('/api/grading/school-years', gradingAuthMiddleware, gradingSchoolYears);
app.use('/api/grading/teachers', gradingAuthMiddleware, gradingTeachers);
app.use('/api/grading/classes', gradingAuthMiddleware, gradingClasses);
app.use('/api/grading/grades', gradingAuthMiddleware, gradingGrades);
app.use('/api/grading/activities', gradingAuthMiddleware, gradingActivities);
app.use('/api/grading/students', gradingAuthMiddleware, gradingStudents);
app.use('/api/grading/attendance', gradingAuthMiddleware, gradingAttendance);
app.use('/api/grading/criteria', gradingAuthMiddleware, gradingCriteria);
app.use('/api/grading/student-status', gradingAuthMiddleware, gradingStudentStatus);

// ===== UTILITY ROUTES =====

// Health check endpoint
app.get('/api/health', verifyAdmin, (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    user: req.user ? {
      email: req.user.email,
      role: req.user.role,
      accessType: req.user.accessType,
      systemAccess: req.user.systemAccess
    } : null
  });
});

// Test email configuration
app.post('/api/test-email', verifyAdmin, async (req, res) => {
  try {
    console.log('Testing email configuration...');

    // Use the test email address from the request or default to the admin email
    const testEmail = req.body.email || 'mjtamayo0703@gmail.com';

    // Call the test email function
    const result = await emailService.testEmailConfiguration(testEmail);

    if (result.success) {
      res.json({
        success: true,
        message: `Test email sent successfully to ${testEmail}`,
        details: result.info
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Failed to send test email',
        message: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('Error testing email:', error);
    res.status(500).json({
      success: false,
      error: 'Error testing email configuration',
      message: error.message
    });
  }
});

// Route to view all registered routes (admin only)
app.get('/api/routes', verifyAdmin, (req, res) => {
  try {
    // Ensure only admins can access this endpoint
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'This endpoint is restricted to administrators only'
      });
    }

    const routes = [];

    app._router.stack.forEach(function(middleware){
      if(middleware.route){ // routes registered directly on the app
        routes.push({
          path: middleware.route.path,
          method: Object.keys(middleware.route.methods)[0].toUpperCase()
        });
      } else if(middleware.name === 'router'){ // router middleware 
        middleware.handle.stack.forEach(function(handler){
          if(handler.route){
            const baseRoute = middleware.regexp.toString().split('(?:')[1]?.split('\\/?')[0] || '';
            const path = baseRoute.replace(/\\/g, '') + handler.route.path;
            const method = Object.keys(handler.route.methods)[0].toUpperCase();
            routes.push({ path, method });
          }
        });
      }
    });

    // Group routes by system
    const groupedRoutes = {
      token: routes.filter(r => 
        r.path.startsWith('/api/auth') || 
        r.path.startsWith('/api/tokens') || 
        r.path.startsWith('/api/admin-contacts') || 
        r.path.startsWith('/api/pending-users')),
      evaluation: routes.filter(r => r.path.includes('/api/evaluation/')),
      grading: routes.filter(r => r.path.includes('/api/grading/')),
      utility: routes.filter(r => 
        r.path.startsWith('/api/health') || 
        r.path.startsWith('/api/routes') ||
        r.path.startsWith('/api/test-firebase'))
    };

    res.json({
      totalRoutes: routes.length,
      systemCounts: {
        token: groupedRoutes.token.length,
        evaluation: groupedRoutes.evaluation.length,
        grading: groupedRoutes.grading.length,
        utility: groupedRoutes.utility.length
      },
      routes: groupedRoutes
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Test Firebase connection
app.get('/api/test-firebase', async (req, res) => {
  try {
    console.log('Testing Firebase connection...');
    const adminRef = collection(db, 'admins');
    const snapshot = await getDocs(adminRef);
    console.log('Firebase connection successful, found documents:', snapshot.size);
    res.json({ 
      status: 'success', 
      message: 'Firebase connection successful',
      documentCount: snapshot.size
    });
  } catch (error) {
    console.error('Firebase connection error:', error);
    res.status(500).json({ 
      error: 'Firebase connection failed', 
      details: error.message 
    });
  }
});

// ===== SERVE STATIC FILES IN PRODUCTION MODE =====

// Check if we are in production mode (NODE_ENV === 'production' or running on Replit)
const isProduction = process.env.NODE_ENV === 'production' || process.env.REPL_SLUG;

if (isProduction) {
  console.log('\n📦 Running in production mode - Serving static frontend files');

  // Static file serving with correct path based on ES modules
  const frontendPath = path.join(__dirname, '..', 'dist');

  // Check if the dist directory exists
  if (fs.existsSync(frontendPath)) {
    console.log(`📂 Serving static files from: ${frontendPath}`);

    // Serve static files from the dist directory
    app.use(express.static(frontendPath));

    // Add a specific handler for the root path
    app.get('/', (req, res) => {
      // Check if the request is from a browser (looking for HTML)
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('text/html')) {
        // Send the index.html for browser requests
        res.sendFile(path.join(frontendPath, 'index.html'));
      } else {
        // For API or other requests, just send the "server is running" message
        res.send('server is running');
      }
    });

    // For any other routes not handled by the API, serve the index.html
    app.get('*', (req, res) => {
      // Exclude API routes
      if (!req.url.startsWith('/api/')) {
        res.sendFile(path.join(frontendPath, 'index.html'));
      }
    });
  } else {
    console.warn(`❌ Could not find frontend build directory: ${frontendPath}`);
    console.warn('❌ Frontend will not be served. You may need to run "npm run build" first.');
    
    // If frontend files are not available, add a simple root route
    app.get('/', (req, res) => {
      res.send('server is running');
    });
  }
} else {
  // In development mode, just serve a simple root route
  app.get('/', (req, res) => {
    res.send('server is running');
  });
}

// ===== SERVER STARTUP =====

// Create server instance
try {
  const server = app.listen(PORT, () => {
    console.log(`\n✨ Server running on port ${PORT}`);
    console.log('\n🏫 EDUCATION MANAGEMENT SYSTEM');
    console.log('----------------------------');
    console.log('📊 Grading System: Available');
    console.log('📝 Evaluation System: Available');
    console.log('🔐 Authentication Services: Configured and ready');
    console.log('\n👉 Use /api/routes endpoint to view all available API routes (admin only)');
    console.log('👉 Nodemailer configured for email notifications');
    console.log('\n⚡ Server is ready to accept connections!');
  });

  // Handle server events
  server.on('error', (error) => {
    console.error('\n❌ SERVER ERROR:', error);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Please try a different port or stop the other process.`);
    }
  });

  // Handle global unhandled exceptions
  process.on('uncaughtException', (error) => {
    console.error('\n❌ UNHANDLED EXCEPTION:', error);
    console.log('The server will continue running, but you should fix this error.');
  });

  // Handle global unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ UNHANDLED PROMISE REJECTION:', reason);
    console.log('The server will continue running, but you should fix this error.');
  });
} catch (error) {
  console.error('\n❌ FATAL ERROR starting server:', error);
  console.log('Unable to start the server due to the above error.');
}
