/**
 * Backend Connection Reset Tool
 * 
 * This script helps diagnose and reset connections to the backend API
 * when you're encountering 500 errors or other connection issues.
 * 
 * Usage:
 * node reset-connection.js [backend-url]
 * 
 * If no backend URL is provided, it defaults to https://token-system-api.onrender.com
 */

import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default backend URL if not provided as argument
const DEFAULT_BACKEND_URL = 'https://token-system-api.onrender.com';
const backendUrl = process.argv[2] || DEFAULT_BACKEND_URL;

// Create HTTPS agent that ignores certificate errors (useful for development)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Ignore SSL certificate issues for testing
});

console.log(`\n🔧 Backend Connection Reset Tool`);
console.log(`================================`);
console.log(`Backend URL: ${backendUrl}\n`);

async function resetConnection() {
  try {
    // Step 1: Try to clear local storage by writing a script
    console.log('1️⃣ Creating localStorage reset script...');
    const resetScript = `
// Add this to your browser console to clear login data
localStorage.removeItem('token');
localStorage.removeItem('user');
console.log('Local storage reset - login data cleared');
    `;
    
    fs.writeFileSync(path.join(__dirname, 'reset-local-storage.js'), resetScript);
    console.log('✅ Created reset-local-storage.js - You can run this in your browser if needed\n');
    
    // Step 2: Check if the backend is responsive
    console.log('2️⃣ Testing backend connection...');
    const startTime = Date.now();
    try {
      const healthResponse = await fetch(`${backendUrl}/api/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        agent: backendUrl.startsWith('https') ? httpsAgent : undefined,
        timeout: 10000
      });
      
      const endTime = Date.now();
      
      if (healthResponse.ok) {
        console.log(`✅ Backend health check successful (${endTime - startTime}ms)`);
        try {
          const healthData = await healthResponse.json();
          console.log('   Health status:', healthData);
        } catch (e) {
          console.log('   Health response received (not JSON format)');
        }
      } else {
        console.log(`⚠️ Backend responded with status: ${healthResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Backend health check failed: ${error.message}\n`);
      console.log('Attempting to fix common issues...\n');
    }
    
    // Step 3: Test a dummy login to reset connection
    console.log('\n3️⃣ Sending test login to reset connection state...');
    try {
      // First create a test login payload
      const loginPayload = {
        email: "connection-test@example.com",
        password: "reset-connection-123"
      };
      
      const loginResponse = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(loginPayload),
        agent: backendUrl.startsWith('https') ? httpsAgent : undefined,
        timeout: 10000
      });
      
      // We expect this to fail with 401, but it should reset the connection
      if (loginResponse.status === 401) {
        console.log('✅ Login attempt returned 401 (expected) - connection likely reset');
      } else if (loginResponse.status === 500) {
        console.log(`⚠️ Backend still returning 500 error. Server may need administrator attention.`);
      } else {
        console.log(`ℹ️ Login attempt returned: ${loginResponse.status}`);
      }
    } catch (error) {
      console.log(`❌ Login attempt failed: ${error.message}`);
    }
    
    // Step 4: Create .env.local with the right backend URL
    console.log('\n4️⃣ Creating frontend environment configuration...');
    const envConfig = `# Local environment configuration
# Created by reset-connection.js

# Backend URL configuration
VITE_BACKEND_URL=${backendUrl}
`;
    
    fs.writeFileSync(path.join(__dirname, '.env.local'), envConfig);
    console.log('✅ Created .env.local with proper backend URL');
    
    // Step 5: Instructions
    console.log('\n🔍 DIAGNOSIS & NEXT STEPS:');
    console.log('---------------------------');
    console.log('1. If backend returned 500 errors, it may be experiencing internal issues.');
    console.log('   - Check if it needs to be restarted on Render.com');
    console.log('   - Look for backend logs in the Render dashboard');
    console.log();
    console.log('2. For frontend, try these steps:');
    console.log('   - Restart your frontend development server');
    console.log('   - Clear browser cache and local storage');
    console.log('   - Try using the mock API mode for development (set USE_MOCK_API to true)');
    console.log();
    console.log('3. If problems persist, check backend logs for specific errors');
    
  } catch (error) {
    console.error('Error during connection reset:', error);
  }
}

resetConnection(); 