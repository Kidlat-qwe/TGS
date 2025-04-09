/**
 * Validates that all required environment variables are set
 * @returns {boolean} True if all required environment variables are set, false otherwise
 */
const validateEnv = () => {
  // Define required environment variables by category
  const requiredEnvVars = {
    database: ['PGUSER', 'PGPASSWORD', 'PGHOST', 'PGDATABASE'],
    auth: ['JWT_SECRET'],
    server: ['PORT', 'FRONTEND_URL'],
  };

  const allRequired = [
    ...requiredEnvVars.database,
    ...requiredEnvVars.auth,
    ...requiredEnvVars.server
  ];
  
  // Check if any required variables are missing
  const missingVars = allRequired.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error(`Error: Missing required environment variables: ${missingVars.join(', ')}`);
    return false;
  }
  
  // Validate specific variables
  if (process.env.NODE_ENV === 'production') {
    // In production, FRONTEND_URL must be set and not localhost
    if (!process.env.FRONTEND_URL || process.env.FRONTEND_URL.includes('localhost')) {
      console.error('Error: FRONTEND_URL in production should be a real domain, not localhost');
      return false;
    }
    
    // In production, JWT_SECRET should be strong
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      console.warn('Warning: JWT_SECRET should be at least 32 characters long in production');
    }
  }
  
  // Video base directory must exist
  if (process.env.VIDEO_BASE_DIR) {
    const fs = require('fs');
    if (!fs.existsSync(process.env.VIDEO_BASE_DIR)) {
      console.error(`Error: VIDEO_BASE_DIR does not exist: ${process.env.VIDEO_BASE_DIR}`);
      return false;
    }
  }
  
  return true;
};

module.exports = validateEnv; 