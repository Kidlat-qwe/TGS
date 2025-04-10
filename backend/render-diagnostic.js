/**
 * Render Deployment Diagnostic Script
 * 
 * This script tests various port bindings and diagnostics for Render deployment.
 * Run it with: node render-diagnostic.js
 */

import http from 'http';
import os from 'os';

console.log('=======================================');
console.log('RENDER DEPLOYMENT DIAGNOSTIC TOOL');
console.log('=======================================');

console.log('\nEnvironment Information:');
console.log(`- Node.js version: ${process.version}`);
console.log(`- Platform: ${os.platform()} ${os.release()}`);
console.log(`- Architecture: ${os.arch()}`);
console.log(`- Memory: ${Math.round(os.totalmem() / (1024 * 1024))} MB total`);
console.log(`- Free memory: ${Math.round(os.freemem() / (1024 * 1024))} MB free`);

// Check environment variables
console.log('\nEnvironment Variables:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
console.log(`- PORT: ${process.env.PORT || 'not set'}`);
console.log(`- RENDER: ${process.env.RENDER || 'not set'}`);

// List all environment variables with RENDER prefix
console.log('\nAll RENDER environment variables:');
Object.keys(process.env)
  .filter(key => key.includes('RENDER'))
  .forEach(key => {
    console.log(`- ${key}: ${process.env[key]}`);
  });

// Try to bind to different ports
const testPorts = [
  process.env.PORT || '(not set)',
  5000,
  3000,
  8080
];

console.log('\nTesting port availability:');
const servers = [];

// Try each port
for (const port of testPorts) {
  if (port === '(not set)') continue;
  
  try {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Port test successful');
    });
    
    server.on('error', (error) => {
      console.log(`- Port ${port}: ❌ ERROR - ${error.code}`);
    });
    
    server.listen(port, '0.0.0.0', () => {
      console.log(`- Port ${port}: ✅ AVAILABLE`);
      servers.push({ port, server });
    });
  } catch (error) {
    console.log(`- Port ${port}: ❌ ERROR - ${error.message}`);
  }
}

// Give it a second to try binding to all ports
setTimeout(() => {
  console.log('\nPort binding summary:');
  if (servers.length === 0) {
    console.log('Failed to bind to any ports!');
  } else {
    console.log(`Successfully bound to ${servers.length} port(s)`);
    
    // Close all servers
    servers.forEach(({ port, server }) => {
      server.close();
      console.log(`Closed server on port ${port}`);
    });
  }
  
  console.log('\n=======================================');
  console.log('DIAGNOSTIC COMPLETE');
  console.log('=======================================');
  
  process.exit(0);
}, 3000); 