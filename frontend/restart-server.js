/**
 * Server Restart Script
 * 
 * This script helps restart the server with the mock API changes
 * to fix the 502 error when the backend is down.
 * 
 * Run with: node restart-server.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔄 Restarting server with mock API enabled...');

// Set environment variables to ensure mock API is used
process.env.USE_MOCK_API = 'true';

try {
  // Check if we're running in Render.com environment
  const isRender = process.env.RENDER === 'true';
  
  if (isRender) {
    console.log('Detected Render.com environment. Creating .render-restart file...');
    // Write a file that will trigger a restart in Render
    fs.writeFileSync(path.join(__dirname, '.render-restart'), new Date().toISOString());
    console.log('Restart file created. Server should restart shortly.');
  } else {
    // For local environment, just restart the server
    console.log('Local environment detected. Stopping and restarting server...');
    
    try {
      // Attempt to kill any running node processes
      console.log('Stopping running server processes...');
      execSync('taskkill /F /IM node.exe', { stdio: 'ignore' });
    } catch (error) {
      // It's okay if this fails
      console.log('No running node processes found or unable to stop them.');
    }
    
    // Start server in a new process
    console.log('Starting server with mock API enabled...');
    execSync('node server.js', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('Error restarting server:', error);
} 