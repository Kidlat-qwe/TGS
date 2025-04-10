/**
 * Backend Connection Tester
 * 
 * This script tests the connection to the backend server and diagnoses any issues.
 * It attempts to make a login request with test credentials and reports the results.
 * 
 * Run with: node connection-test.js [backend-url]
 */

import fetch from 'node-fetch';
import https from 'https';

// Default backend URL if not provided as argument
const DEFAULT_BACKEND_URL = 'https://token-system-api.onrender.com';
const backendUrl = process.argv[2] || DEFAULT_BACKEND_URL;

console.log(`\n🔍 Backend Connection Tester`);
console.log(`==================================`);
console.log(`Testing connection to: ${backendUrl}\n`);

// Create HTTPS agent that ignores certificate errors (useful for development)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false, // Ignore SSL certificate issues for testing
});

// Test the login endpoint
async function testLogin() {
  try {
    const loginUrl = `${backendUrl}/api/auth/login`;
    console.log(`Testing login endpoint: ${loginUrl}`);
    
    const requestBody = {
      email: 'test@example.com',
      password: 'password123'
    };
    
    console.log('Request payload:', JSON.stringify(requestBody, null, 2));
    
    const response = await fetch(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody),
      agent: backendUrl.startsWith('https') ? httpsAgent : undefined,
      timeout: 10000 // 10 second timeout
    });
    
    console.log(`\nResponse status: ${response.status} ${response.statusText}`);
    console.log('Response headers:');
    
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    
    // Try to get response body
    try {
      const responseText = await response.text();
      console.log('\nResponse body:');
      
      if (!responseText) {
        console.log('  (empty response)');
      } else {
        try {
          // Try to parse as JSON if possible
          const jsonData = JSON.parse(responseText);
          console.log(JSON.stringify(jsonData, null, 2));
          
          // Check for expected fields
          if (jsonData.token) {
            console.log('\n✅ Login response contains token (successful auth)');
          } else if (jsonData.error) {
            console.log(`\n⚠️ Login response contains error: ${jsonData.error}`);
          }
        } catch (e) {
          // If not JSON, show as text
          console.log(responseText);
          console.log('\n⚠️ Warning: Response is not valid JSON!');
        }
      }
    } catch (e) {
      console.error('Error reading response body:', e.message);
    }
    
    // Provide diagnosis
    if (response.status >= 200 && response.status < 300) {
      console.log('\n✅ Connection successful! Backend is responding correctly.');
    } else if (response.status === 401) {
      console.log('\n✅ Connection successful, but credentials were rejected (expected for test credentials).');
    } else if (response.status >= 500) {
      console.log('\n❌ Backend server error. The server is responding but has an internal issue.');
    } else {
      console.log('\n⚠️ Backend is responding, but with an unexpected status code.');
    }
    
  } catch (error) {
    console.error('\n❌ Connection failed:', error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\nDiagnosis: The server address cannot be resolved. Check if the domain is correct.');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\nDiagnosis: Connection refused. The server may be down or not listening on the expected port.');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\nDiagnosis: Connection timed out. The server might be too slow to respond or blocked by a firewall.');
    }
  }
}

// Run the test
testLogin().catch(error => {
  console.error('Error running tests:', error);
}); 