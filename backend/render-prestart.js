/**
 * Render Pre-Start Script
 * 
 * This script runs before the main server to check the environment and report issues.
 * It helps diagnose deployment problems on Render.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('================================');
console.log('📋 RENDER DEPLOYMENT PRE-CHECK');
console.log('================================');

// Check if the PORT environment variable is set
const PORT = process.env.PORT;
console.log(`🔌 PORT environment variable: ${PORT || 'Not set'}`);

// Check if we're in the Render environment
const isRender = Boolean(process.env.RENDER);
console.log(`🚀 Running on Render: ${isRender ? 'Yes' : 'No'}`);

// Check for frontend build artifacts
const frontendPath = path.join(__dirname, '..', 'dist');
const frontendExists = fs.existsSync(frontendPath);
console.log(`📦 Frontend build artifacts: ${frontendExists ? 'Found' : 'Not found'}`);

if (frontendExists) {
  try {
    const files = fs.readdirSync(frontendPath);
    console.log(`   - Found ${files.length} files in dist directory`);
    if (files.includes('index.html')) {
      console.log('   - index.html found ✅');
    } else {
      console.log('   - index.html not found ❌');
    }
  } catch (error) {
    console.log(`   - Error reading directory: ${error.message}`);
  }
}

// Check for important files
const serverFile = path.join(__dirname, 'render-server.js');
console.log(`🗂️ Server file: ${fs.existsSync(serverFile) ? 'Found' : 'Not found'}`);

// Try to bind to a few ports to see what's available
console.log('\n🔌 Testing port availability:');

// Only test if we're not on Render or PORT is not set
if (!isRender || !PORT) {
  const testPorts = [3000, 8080, 10000];
  
  testPorts.forEach(port => {
    try {
      const server = http.createServer();
      server.once('error', () => {
        console.log(`   - Port ${port}: Not available`);
      });
      server.once('listening', () => {
        console.log(`   - Port ${port}: Available ✅`);
        server.close();
      });
      server.listen(port, '0.0.0.0');
    } catch (error) {
      console.log(`   - Error testing port ${port}: ${error.message}`);
    }
  });
}

console.log('\n✅ Pre-start checks complete. Starting main server...');
console.log('================================\n');

// The main server will start after this script completes 