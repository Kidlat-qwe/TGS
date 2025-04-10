/**
 * Test script to directly validate backend API functionality
 * Run this with: node test-backend.js
 */

// Use the same backend URL as your production environment
const BACKEND_URL = process.env.BACKEND_URL || 'https://token-system-api.onrender.com';

console.log(`Testing backend API at: ${BACKEND_URL}`);

// Endpoints to test
const endpoints = [
  { path: '/api/health', method: 'GET' },
  { path: '/api/health-check', method: 'GET' },
  { path: '/health', method: 'GET' },
  { path: '/api/auth/login', method: 'POST', body: { email: 'test@example.com', password: 'password123' } },
  { path: '/', method: 'GET' }
];

// Function to test a single endpoint
async function testEndpoint(endpoint) {
  const { path, method, body } = endpoint;
  const url = `${BACKEND_URL}${path}`;
  
  console.log(`\nTesting ${method} ${url}`);
  
  try {
    const options = {
      method,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    };
    
    // Add body for POST/PUT requests
    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(body);
    }
    
    const startTime = Date.now();
    const response = await fetch(url, options);
    const endTime = Date.now();
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Time: ${endTime - startTime}ms`);
    
    // Log response headers
    console.log('Response Headers:');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });
    
    // Try to get response body
    try {
      const text = await response.text();
      
      // Try to parse as JSON if possible
      try {
        const data = JSON.parse(text);
        console.log('Response Body (JSON):', JSON.stringify(data, null, 2));
      } catch (e) {
        // Otherwise show as text
        console.log('Response Body (text):', text.substring(0, 500));
        if (text.length > 500) {
          console.log(`...and ${text.length - 500} more characters`);
        }
      }
    } catch (e) {
      console.log('Could not read response body:', e.message);
    }
    
    return { success: response.ok, status: response.status };
  } catch (error) {
    console.error(`Error testing ${path}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Run all tests sequentially
async function runTests() {
  console.log('=== Starting Backend API Tests ===');
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log('\n=== Tests Complete ===');
}

// Run the tests
runTests().catch(error => {
  console.error('Test execution error:', error);
}); 