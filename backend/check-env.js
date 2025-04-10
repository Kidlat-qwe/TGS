#!/usr/bin/env node

/**
 * Environment Variable Checker
 * 
 * This script validates that all required environment variables are set
 * before the application starts. It can be run manually or integrated
 * into the application startup process.
 * 
 * Usage: 
 *   node check-env.js
 * 
 * Exit codes:
 *   0 - All required variables are set correctly
 *   1 - One or more required variables are missing
 */

// Define color codes for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Define the required environment variables grouped by category
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

// Define warnings for specific variables
const variableWarnings = {
  'JWT_SECRET': (value) => {
    if (value && value.length < 16) {
      return 'JWT_SECRET should be at least a 16-character string for security';
    }
    if (value === 'change-this-to-a-strong-secret-key') {
      return 'JWT_SECRET is using the default value. Change this in production!';
    }
    return null;
  },
  'NODE_ENV': (value) => {
    if (value === 'production') {
      return null;
    }
    return `NODE_ENV is set to '${value}'. Use 'production' for production environments.`;
  },
};

// Check if the database configuration is valid
function checkDatabaseConfig() {
  // Check if DATABASE_URL is provided
  if (process.env.DATABASE_URL) {
    console.log(`${colors.green}✓${colors.reset} DATABASE_URL is set`);
    return true;
  }

  // If DATABASE_URL is not set, check if individual parameters are set
  console.log(`${colors.yellow}!${colors.reset} DATABASE_URL not found, checking individual connection parameters...`);
  
  let missingVars = [];
  const dbParams = requiredVars.database.slice(1); // Skip DATABASE_URL
  
  for (const varName of dbParams) {
      if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    console.log(`${colors.red}✗${colors.reset} Missing database parameters: ${missingVars.join(', ')}`);
    return false;
  } else {
    console.log(`${colors.green}✓${colors.reset} All individual database parameters are set`);
    return true;
  }
}

// Check environment variables
function checkEnvironmentVariables() {
  let missingVars = [];
  let warningMessages = [];
  let isValid = true;
  
  console.log(`\n${colors.blue}=== Checking Environment Variables ===${colors.reset}\n`);
  
  // 1. Check database configuration
  const dbConfigValid = checkDatabaseConfig();
  if (!dbConfigValid) {
    isValid = false;
  }
  
  console.log(''); // Empty line for readability
  
  // 2. Check other required variables (authentication and system)
  for (const category of ['authentication', 'system']) {
    console.log(`${colors.cyan}Checking ${category} variables:${colors.reset}`);
    
    for (const varName of requiredVars[category]) {
      const value = process.env[varName];
      
      if (!value) {
        console.log(`${colors.red}✗${colors.reset} ${varName} is missing`);
        missingVars.push(varName);
        isValid = false;
      } else {
        console.log(`${colors.green}✓${colors.reset} ${varName} is set`);
        
        // Check for warnings
        if (variableWarnings[varName]) {
          const warning = variableWarnings[varName](value);
          if (warning) {
            console.log(`  ${colors.yellow}!${colors.reset} Warning: ${warning}`);
            warningMessages.push(warning);
          }
        }
      }
    }
    
    console.log(''); // Empty line for readability
  }
  
  // Summary
  console.log(`${colors.blue}=== Environment Check Summary ===${colors.reset}`);
  
  if (isValid) {
    console.log(`${colors.green}✓ All required environment variables are properly set${colors.reset}`);
  } else {
    console.log(`${colors.red}✗ Some required environment variables are missing:${colors.reset}`);
    for (const varName of missingVars) {
      console.log(`  - ${varName}`);
    }
  }
  
  if (warningMessages.length > 0) {
    console.log(`\n${colors.yellow}Warnings:${colors.reset}`);
    for (const warning of warningMessages) {
      console.log(`  - ${warning}`);
    }
  }
  
  return isValid;
}

// Main function
function main() {
  const isValid = checkEnvironmentVariables();
  
  if (!isValid) {
    console.log(`\n${colors.yellow}To fix missing variables:${colors.reset}`);
    console.log('1. Create a .env file in the project root');
    console.log('2. Add the missing variables with appropriate values');
    console.log('3. Run "node backend/generate-env-template.js" to create a template');
    
    process.exit(1);
  }
  
  process.exit(0);
}

// Run the script
main(); 