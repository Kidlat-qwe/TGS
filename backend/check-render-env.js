/**
 * Render Environment Check Script
 * 
 * This script verifies that all required environment variables are set correctly
 * before the main application starts. It's designed to be run as part of the
 * start command in Render to prevent deployment with missing configuration.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=====================================');
console.log('RENDER ENVIRONMENT VARIABLE CHECKER');
console.log('=====================================');
console.log('This script checks environment variables for debugging deployment issues');
console.log('\nEnvironment:', process.env.NODE_ENV || 'undefined');
console.log('Running on Render:', process.env.RENDER ? 'Yes' : 'No');
console.log('Current directory:', __dirname);
console.log('Process CWD:', process.cwd());

// Load root environment variables
dotenv.config();
console.log('\nLoaded environment variables from root');

// Check if we have .env files
const rootEnvPath = path.resolve(process.cwd(), '.env');
const backendEnvPath = path.resolve(__dirname, '.env');
const evaluationEnvPath = path.resolve(__dirname, 'Evaluation-System/.env');
const gradingEnvPath = path.resolve(__dirname, 'Grading-System/.env');

console.log('\nChecking for .env files:');
console.log(`- Root .env: ${fs.existsSync(rootEnvPath) ? 'Found' : 'Not found'}`);
console.log(`- Backend .env: ${fs.existsSync(backendEnvPath) ? 'Found' : 'Not found'}`);
console.log(`- Evaluation-System .env: ${fs.existsSync(evaluationEnvPath) ? 'Found' : 'Not found'}`);
console.log(`- Grading-System .env: ${fs.existsSync(gradingEnvPath) ? 'Found' : 'Not found'}`);

// Check for critical environment variables
console.log('\nChecking JWT Secret:');
console.log(`- JWT_SECRET: ${process.env.JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
if (process.env.JWT_SECRET) {
  console.log(`  Length: ${process.env.JWT_SECRET.length} characters`);
  console.log(`  First 5 chars: ${process.env.JWT_SECRET.substring(0, 5)}...`);
}
console.log(`- EVALUATION_JWT_SECRET: ${process.env.EVALUATION_JWT_SECRET ? '✅ Set' : '❌ Not set'}`);
console.log(`- GRADING_JWT_SECRET: ${process.env.GRADING_JWT_SECRET ? '✅ Set' : '❌ Not set'}`);

// Check for database variables
console.log('\nChecking Database Variables:');
console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
console.log(`- EVALUATION_DATABASE_URL: ${process.env.EVALUATION_DATABASE_URL ? '✅ Set' : '❌ Not set'}`);
console.log(`- PGUSER: ${process.env.PGUSER ? '✅ Set' : '❌ Not set'}`);
console.log(`- EVALUATION_PGUSER: ${process.env.EVALUATION_PGUSER ? '✅ Set' : '❌ Not set'}`);
console.log(`- PGHOST: ${process.env.PGHOST || 'Not set'}`);
console.log(`- EVALUATION_PGHOST: ${process.env.EVALUATION_PGHOST || 'Not set'}`);

// Check for Render-specific variables
console.log('\nChecking Render-specific variables:');
console.log(`- RENDER_EXTERNAL_URL: ${process.env.RENDER_EXTERNAL_URL || 'Not set'}`);
console.log(`- RENDER_SERVICE_ID: ${process.env.RENDER_SERVICE_ID || 'Not set'}`);
console.log(`- RENDER_GIT_COMMIT: ${process.env.RENDER_GIT_COMMIT || 'Not set'}`);
console.log(`- RENDER_GIT_BRANCH: ${process.env.RENDER_GIT_BRANCH || 'Not set'}`);

// List all environment variables (optional - uncomment if needed)
console.log('\nAll environment variables:');
const envVars = Object.keys(process.env).sort();
const relevantVars = envVars.filter(key => 
  key.includes('JWT') || 
  key.includes('PG') || 
  key.includes('DATABASE') || 
  key.includes('EVALUATION') || 
  key.includes('GRADING') || 
  key.includes('RENDER') ||
  key === 'NODE_ENV' ||
  key === 'PORT'
);

relevantVars.forEach(key => {
  const value = process.env[key];
  const displayValue = key.includes('SECRET') || key.includes('PASSWORD') || key.includes('URL')
    ? `${value ? value.substring(0, 10) : ''}...`
    : value;
  console.log(`- ${key}: ${displayValue || 'Not set'}`);
});

console.log('\n=====================================');
console.log('ENVIRONMENT CHECK COMPLETE');
console.log('=====================================');

// If we're missing critical variables, provide a template
if (!process.env.EVALUATION_PGUSER && !process.env.PGUSER) {
  console.log('\n⚠️ WARNING: Missing database environment variables');
  console.log('Copy these environment variables to Render:');
  console.log(`
JWT_SECRET=V82CpEqP2dwHhJUzL4X1s6bK7vGtRy9ZmN3fT5aQwE8D

# Evaluation Database Configuration
PGUSER=neondb_owner
PGPASSWORD=npg_eSz8JNlO0xcD
PGHOST=ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech
PGDATABASE=neondb
PGPORT=5432
PGSSL=true
DATABASE_URL=postgresql://neondb_owner:npg_eSz8JNlO0xcD@ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
`);
}

console.log('======== RENDER ENVIRONMENT CHECK ========');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Current directory: ${__dirname}`);
console.log(`Process directory: ${process.cwd()}`);

// Required environment variable categories
const requiredVars = {
  // Common
  Common: [
    'NODE_ENV',
    'PORT'
  ],
  
  // JWT Authentication
  JWT: [
    'JWT_SECRET',
    'JWT_EXPIRES_IN'
  ],
  
  // Database Configuration - Either connectionString OR individual credentials must be set
  Database: [
    'DATABASE_URL', // OR individual credentials below
    'PGUSER', 
    'PGPASSWORD',
    'PGHOST',
    'PGDATABASE',
    'PGPORT'
  ],
  
  // System Integration
  Systems: [
    'FRONTEND_URL',
    'TOKEN_SYSTEM_URL',
    'EVALUATION_SYSTEM_URL',
    'GRADING_SYSTEM_URL'
  ]
};

// Check prefixed versions too (for compatibility)
const prefixes = ['', 'TOKEN_', 'EVALUATION_', 'GRADING_'];

// Track any missing variables
const missingVars = [];
const configuredVars = [];

// Special case for database - need either DATABASE_URL or individual credentials
let hasDatabaseUrl = false;
let hasIndividualDbCredentials = false;

// Helper function to check if a variable exists with any prefix
function checkVariable(varName) {
  for (const prefix of prefixes) {
    const fullName = `${prefix}${varName}`;
    if (process.env[fullName] !== undefined) {
      configuredVars.push(fullName);
      return true;
    }
  }
  
  missingVars.push(varName);
  return false;
}

// Check all required variables
console.log('\nChecking required environment variables:');

// Check database configuration specially
if (checkVariable('DATABASE_URL')) {
  hasDatabaseUrl = true;
  console.log('✅ Database connection string is configured');
} else {
  console.log('❌ DATABASE_URL not found, checking individual credentials');
  
  // Check if all individual database credentials are set
  const individualDbVars = ['PGUSER', 'PGPASSWORD', 'PGHOST', 'PGDATABASE', 'PGPORT'];
  const missingDbVars = [];
  
  for (const dbVar of individualDbVars) {
    if (!checkVariable(dbVar)) {
      missingDbVars.push(dbVar);
    }
  }
  
  if (missingDbVars.length === 0) {
    hasIndividualDbCredentials = true;
    console.log('✅ Individual database credentials are configured');
  } else {
    console.log(`❌ Missing database credentials: ${missingDbVars.join(', ')}`);
  }
}

// Check all other variables
for (const [category, variables] of Object.entries(requiredVars)) {
  if (category === 'Database') continue; // Already handled specially
  
  console.log(`\n${category} Configuration:`);
  for (const varName of variables) {
    if (checkVariable(varName)) {
      console.log(`✅ ${varName}`);
    } else {
      console.log(`❌ ${varName}`);
    }
  }
}

// Evaluate database configuration
if (!hasDatabaseUrl && !hasIndividualDbCredentials) {
  console.error('\n❌ ERROR: Database configuration is missing!');
  console.error('Either DATABASE_URL or all individual database credentials must be set.');
  process.exit(1);
}

// Report status
if (missingVars.length > 0) {
  console.error('\n❌ ERROR: Missing required environment variables:');
  console.error(missingVars.join(', '));
  console.error('\nPlease set these variables in your Render dashboard or environment.');
  console.error('Refer to RENDER_DEPLOYMENT.md for more information.');
  process.exit(1);
} else {
  console.log('\n✅ All required environment variables are configured!');
  console.log(`Found ${configuredVars.length} configured variables.`);
  console.log('\n✅ Environment check passed. Starting application...');
}

// Check PostgreSQL SSL configuration
const pgSsl = process.env.PGSSL || process.env.DB_SSL;
console.log(`\nPostgreSQL SSL: ${pgSsl || 'Not configured (defaulting to false)'}`);

// Check URLs for potential issues
const urlVars = ['FRONTEND_URL', 'TOKEN_SYSTEM_URL', 'EVALUATION_SYSTEM_URL', 'GRADING_SYSTEM_URL'];
for (const varName of urlVars) {
  for (const prefix of prefixes) {
    const fullName = `${prefix}${varName}`;
    const url = process.env[fullName];
    if (url) {
      try {
        new URL(url);
        console.log(`✅ ${fullName}: ${url}`);
      } catch (error) {
        console.warn(`⚠️ Warning: ${fullName} contains an invalid URL: ${url}`);
      }
    }
  }
}

console.log('\n======== ENVIRONMENT CHECK COMPLETE ========\n'); 