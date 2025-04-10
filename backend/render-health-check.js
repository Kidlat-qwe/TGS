/**
 * Render Health Check Script
 * 
 * This script is a simple port binding test specifically for Render deployment.
 * It attempts to bind to the PORT environment variable to verify it's available.
 */

import http from 'http';

// Get PORT from environment with fallback
const PORT = process.env.PORT || 10000;

console.log('=== RENDER PORT BINDING TEST ===');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Attempting to bind to port: ${PORT}`);
console.log(`Port from environment: ${process.env.PORT || 'not set'}`);
console.log('All environment variables:');
Object.keys(process.env)
  .filter(key => !key.includes('SECRET') && !key.includes('KEY') && !key.includes('PASS'))
  .forEach(key => {
    console.log(`- ${key}: ${process.env[key]}`);
  });

// Create a simple test server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    port: PORT,
    message: 'Render port binding test successful'
  }));
});

// Try to bind to the port
server.listen(PORT, '0.0.0.0', () => {
  const address = server.address();
  console.log(`✅ SUCCESS! Server bound to ${address.address}:${address.port}`);
  
  // After 10 seconds, exit with success
  console.log('Server will exit in 10 seconds with success...');
  setTimeout(() => {
    console.log('Exiting with success');
    process.exit(0);
  }, 10000);
});

// Handle errors
server.on('error', (error) => {
  console.error(`❌ ERROR: Failed to bind to port ${PORT}`);
  console.error(error);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
  } else if (error.code === 'EACCES') {
    console.error(`Port ${PORT} requires elevated privileges.`);
  }
  
  // Exit with error
  process.exit(1);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Process interrupted');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 