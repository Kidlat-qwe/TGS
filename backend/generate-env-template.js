#!/usr/bin/env node

/**
 * Environment Template Generator
 * 
 * This script generates a .env.template file with all required and optional
 * environment variables for the application. It's useful for new developers
 * joining the project or for setting up new environments.
 * 
 * Usage:
 *   node generate-env-template.js
 * 
 * The script will create a .env.template file in the root directory.
 * This template can be copied to .env and filled with appropriate values.
 */

const fs = require('fs');
const path = require('path');

// Define the required environment variables (same as in check-env.js)
const requiredVars = {
  // Database configuration
  database: [
    'DATABASE_URL',  // Priority 1: Full connection string
    // If DATABASE_URL is not provided, these are required
    'PGUSER',
    'PGPASSWORD',
    'PGHOST',
    'PGDATABASE',
  ],

  // Authentication
  authentication: [
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
  ],

  // System configuration
  system: [
    'NODE_ENV',
    'PORT',
  ]
};

// Define optional environment variables with their default values
const optionalVars = {
  'FRONTEND_URL': 'http://localhost:3000',
  'LOG_LEVEL': 'info',
  'PGPORT': '5432',
  'PGSSL': 'true',
};

// Create the template content
function generateTemplateContent() {
  let content = '';
  
  // Add header comments
  content += '# Application Environment Variables\n';
  content += '# Copy this file to .env and fill in the appropriate values\n';
  content += '# WARNING: Never commit .env files to version control\n\n';
  
  // Add database section
  content += '# Database Configuration\n';
  content += '# Option 1: Use a connection string (recommended)\n';
  content += 'DATABASE_URL=postgres://username:password@localhost:5432/database\n\n';
  
  content += '# Option 2: Use individual connection parameters\n';
  content += '# (Only used if DATABASE_URL is not set)\n';
  content += 'PGUSER=postgres\n';
  content += 'PGPASSWORD=password\n';
  content += 'PGHOST=localhost\n';
  content += 'PGDATABASE=mydatabase\n';
  content += 'PGPORT=5432\n';
  content += 'PGSSL=true\n\n';
  
  // Add authentication section
  content += '# Authentication\n';
  content += '# Must be at least 16 characters, use a strong random value\n';
  content += 'JWT_SECRET=change-this-to-a-strong-secret-key\n';
  content += 'JWT_EXPIRES_IN=7d\n\n';
  
  // Add system configuration section
  content += '# System Configuration\n';
  content += 'NODE_ENV=development\n';
  content += 'PORT=3001\n\n';
  
  // Add optional variables section
  content += '# Optional Configuration\n';
  content += 'FRONTEND_URL=http://localhost:3000\n';
  content += 'LOG_LEVEL=info\n';
  
  return content;
}

// Generate and write the template file
function generateTemplateFile() {
  const templateContent = generateTemplateContent();
  const templatePath = path.join(process.cwd(), '.env.template');
  
  fs.writeFile(templatePath, templateContent, (err) => {
    if (err) {
      console.error('❌ Error creating .env.template file:', err);
  process.exit(1);
} 
    
    console.log('✅ .env.template file successfully created!');
    console.log(`📄 Location: ${templatePath}`);
    console.log('');
    console.log('Instructions:');
    console.log('  1. Copy this file to .env');
    console.log('  2. Fill in the appropriate values for your environment');
    console.log('  3. Run "node backend/check-env.js" to verify your configuration');
    console.log('');
    console.log('⚠️  WARNING: Never commit .env files to version control');
  });
}

// Run the generator
generateTemplateFile(); 