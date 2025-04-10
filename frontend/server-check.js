/**
 * Simple Backend Server Status Check
 * 
 * This script performs a simple check on the backend server status
 * and provides detailed information about the response.
 */

import fetch from 'node-fetch';

// Default backend URL if not provided as argument
const DEFAULT_BACKEND_URL = 'https://token-system-api.onrender.com';
const backendUrl = process.argv[2] || DEFAULT_BACKEND_URL;

async function checkServer() {
  console.log(`\n🔍 Checking backend server status`);
  console.log(`================================`);
  console.log(`Server URL: ${backendUrl}\n`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Server-Check-Tool/1.0',
        'Accept': 'application/json,text/html,*/*'
      },
      timeout: 10000
    });
    const endTime = Date.now();
    
    console.log(`Response Status: ${response.status} ${response.statusText}`);
    console.log(`Response Time: ${endTime - startTime}ms`);
    
    console.log(`\nResponse Headers:`);
    for (const [key, value] of response.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    
    console.log(`\nResponse Body (${body.length} bytes):`);
    if (contentType.includes('application/json')) {
      try {
        console.log(JSON.stringify(JSON.parse(body), null, 2));
      } catch (e) {
        console.log(body);
      }
    } else {
      console.log(body);
    }
    
    // Check if this looks like a Render.com "not found" page
    if (response.status === 404 && (
        body.includes('not found') || 
        response.headers.get('x-render-routing') === 'no-server')) {
      console.log(`\n❌ DIAGNOSIS: The backend service appears to be offline or suspended.`);
      console.log(`   This is a Render.com 404 response, which typically means:`);
      console.log(`   1. The service has been deleted`);
      console.log(`   2. The service has been suspended due to inactivity`);
      console.log(`   3. The service name has changed\n`);
      console.log(`   Try checking your Render.com dashboard to confirm the service status.`);
    }
    
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log(`\nDiagnosis: DNS resolution failed. The domain does not exist or is not reachable.`);
    } else if (error.code === 'ECONNREFUSED') {
      console.log(`\nDiagnosis: Connection refused. The server exists but is not accepting connections.`);
    } else if (error.code === 'ETIMEDOUT') {
      console.log(`\nDiagnosis: Connection timed out. The server might be slow or blocked.`);
    }
  }
}

checkServer().catch(console.error); 