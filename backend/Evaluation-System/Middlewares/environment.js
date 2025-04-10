/**
 * Centralized environment configuration middleware for the Evaluation System
 * This file handles loading environment variables from various sources
 * and provides helper functions for accessing them
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Paths to check for .env files
const ROOT_DIR = process.cwd();
const BACKEND_DIR = path.join(ROOT_DIR, 'backend');
const EVALUATION_DIR = path.join(BACKEND_DIR, 'Evaluation-System');

console.log('========== ENVIRONMENT CONFIGURATION ==========');
console.log(`Environment: ${process.env.NODE_ENV}`);
console.log(`Current directory: ${__dirname}`);
console.log(`Process directory: ${process.cwd()}`);

// Try to load environment variables from different locations
const envPaths = [
  path.join(ROOT_DIR, '.env'),
  path.join(BACKEND_DIR, '.env'),
  path.join(EVALUATION_DIR, '.env')
];

let envLoaded = false;

envPaths.forEach(envPath => {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment variables from: ${envPath}`);
    dotenv.config({ path: envPath });
    envLoaded = true;
  }
});

if (!envLoaded) {
  console.log('No .env files found, relying on system environment variables');
}

/**
 * Gets an environment variable with support for prefixed versions
 * @param {string} name - The variable name without prefix
 * @param {string} prefix - The prefix to check (default: 'EVALUATION_')
 * @param {*} defaultValue - Default value if not found
 * @returns {string|undefined} The environment variable value or default
 */
function getEnv(name, prefix = 'EVALUATION_', defaultValue = undefined) {
  // Check for variable with prefix
  const prefixedValue = process.env[`${prefix}${name}`];
  if (prefixedValue !== undefined) {
    return prefixedValue;
  }
  
  // Check for variable without prefix
  const value = process.env[name];
  if (value !== undefined) {
    return value;
  }
  
  // Return default value if provided
  return defaultValue;
}

/**
 * Gets a required environment variable, throws error if not found
 * @param {string} name - The variable name without prefix
 * @param {string} prefix - The prefix to check (default: 'EVALUATION_')
 * @returns {string} The environment variable value
 * @throws {Error} If variable is not found
 */
function getRequiredEnv(name, prefix = 'EVALUATION_') {
  const value = getEnv(name, prefix);
  if (value === undefined) {
    throw new Error(`Required environment variable ${name} or ${prefix}${name} is not set`);
  }
  return value;
}

/**
 * Database configuration object
 */
const dbConfig = {
  get user() { return getEnv('PGUSER') || getEnv('DB_USER'); },
  get password() { return getEnv('PGPASSWORD') || getEnv('DB_PASSWORD'); },
  get host() { return getEnv('PGHOST') || getEnv('DB_HOST'); },
  get database() { return getEnv('PGDATABASE') || getEnv('DB_NAME'); },
  get port() { return getEnv('PGPORT') || getEnv('DB_PORT'); },
  get ssl() { 
    const sslValue = getEnv('PGSSL') || getEnv('DB_SSL');
    return sslValue === 'true' || sslValue === true; 
  },
  get connectionString() { return getEnv('DATABASE_URL') || getEnv('DB_CONNECTION_STRING'); },
  get poolConfig() {
    return {
      max: parseInt(getEnv('PG_MAX_CONNECTIONS') || '10', 10),
      idleTimeoutMillis: parseInt(getEnv('PG_IDLE_TIMEOUT') || '60000', 10),
      connectionTimeoutMillis: parseInt(getEnv('PG_CONNECTION_TIMEOUT') || '10000', 10)
    };
  },
  get connectionRetries() {
    return parseInt(getEnv('PG_CONNECTION_RETRIES') || '3', 10);
  }
};

/**
 * JWT configuration object
 */
const jwtConfig = {
  get secret() { 
    const secret = getEnv('JWT_SECRET');
    if (!secret) {
      console.warn('WARNING: JWT_SECRET not set, using default value');
      return 'evaluation-system-jwt-default-secret-do-not-use-in-production';
    }
    return secret;
  },
  get expiresIn() { return getEnv('JWT_EXPIRES_IN', 'EVALUATION_', '1d'); }
};

/**
 * Server configuration object
 */
const serverConfig = {
  get port() { return getEnv('PORT', 'EVALUATION_', 3002); },
  get frontendUrl() { return getEnv('FRONTEND_URL', 'EVALUATION_', 'http://localhost:3000'); }
};

/**
 * Print configuration summary (without sensitive values)
 */
function printConfigSummary() {
  console.log('\n--- Configuration Summary ---');
  console.log('Database:');
  console.log(`  Host: ${dbConfig.host || 'Not set'}`);
  console.log(`  Database: ${dbConfig.database || 'Not set'}`);
  console.log(`  Connection String: ${dbConfig.connectionString ? '**Set**' : 'Not set'}`);
  console.log(`  SSL: ${dbConfig.ssl}`);
  
  console.log('Server:');
  console.log(`  Port: ${serverConfig.port}`);
  console.log(`  Frontend URL: ${serverConfig.frontendUrl}`);
  
  console.log('JWT:');
  console.log(`  Secret: ${jwtConfig.secret ? '**Set**' : 'Not set'} (Length: ${jwtConfig.secret?.length || 0})`);
  console.log(`  Expires In: ${jwtConfig.expiresIn}`);
  
  console.log('================================\n');
}

// Print configuration on load
printConfigSummary();

module.exports = {
  getEnv,
  getRequiredEnv,
  dbConfig,
  jwtConfig,
  serverConfig,
  printConfigSummary
}; 