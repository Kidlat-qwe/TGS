import fetch from 'node-fetch';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Default API URL (you can change this if your Evaluation System is running on a different URL)
const DEFAULT_API_URL = 'http://localhost:3002';

/**
 * Tests an API endpoint with the provided token
 * @param {string} endpoint - The API endpoint to test
 * @param {string} token - The JWT token to use for authentication
 * @param {string} apiUrl - The base API URL
 */
async function testEndpoint(endpoint, token, apiUrl) {
  try {
    console.log(`🔍 Testing endpoint: ${endpoint}`);
    console.log(`🔑 Using token: ${token.substring(0, 15)}...${token.substring(token.length - 10)}`);
    
    const response = await fetch(`${apiUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS! Endpoint accessed successfully');
      console.log('📄 Response data:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ ERROR ${response.status}: ${response.statusText}`);
      console.log('📄 Error details:');
      console.log(JSON.stringify(data, null, 2));
      
      // Provide troubleshooting guidance based on error
      if (response.status === 401) {
        console.log('\n🔧 Troubleshooting: Authentication is required. Make sure:');
        console.log('1. You are providing a token in the Authorization header');
        console.log('2. The token format is correct (Bearer <token>)');
      } else if (response.status === 403) {
        console.log('\n🔧 Troubleshooting: Token validation failed. Check:');
        
        if (data.error && data.error.includes('not authorized for the evaluation system')) {
          console.log('1. This token is for a different system. Generate a token with system="evaluation"');
        } else if (data.error && data.error.includes('expired')) {
          console.log('1. Your token has expired. Generate a new token');
        } else {
          console.log('1. JWT_SECRET matches between Token Generating System and Evaluation System');
          console.log('2. Token has the correct format and hasn\'t been tampered with');
          console.log('3. Token has "system": "evaluation" in its payload');
        }
      }
    }
  } catch (error) {
    console.error('❌ NETWORK ERROR:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the Evaluation System is running');
    console.log(`2. Check if the API URL is correct: ${apiUrl}`);
    console.log('3. Verify network connectivity');
  }
}

/**
 * Main function to run the test
 */
async function runTest() {
  console.log('=================================================');
  console.log('🧪 EVALUATION SYSTEM API TOKEN TESTER');
  console.log('=================================================');
  
  // Get user inputs
  rl.question('Enter your JWT token: ', (token) => {
    rl.question(`Enter API URL (default: ${DEFAULT_API_URL}): `, (apiUrl) => {
      const finalApiUrl = apiUrl || DEFAULT_API_URL;
      
      rl.question('Enter API endpoint to test (e.g., /api/evaluation/submissions): ', async (endpoint) => {
        // Make sure endpoint starts with /
        const finalEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        
        console.log('\n=================================================');
        await testEndpoint(finalEndpoint, token, finalApiUrl);
        console.log('=================================================\n');
        
        // Provide additional help
        console.log('📝 Additional Tips:');
        console.log('1. Make sure both the Token Generating System and Evaluation System use the same JWT_SECRET');
        console.log('2. When generating tokens in TGS, specify system="evaluation"');
        console.log('3. Check server logs for detailed error messages');
        console.log('4. Verify token expiration time is appropriate');
        
        rl.close();
      });
    });
  });
}

// Run the test
runTest(); 