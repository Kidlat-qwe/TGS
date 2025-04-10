/**
 * Network Connectivity Checker
 * 
 * This script tests network connectivity to the backend API server and
 * provides detailed diagnostics about the connection.
 * 
 * Usage:
 * node network-check.js [backend-url]
 * 
 * If no backend URL is provided, it defaults to https://token-system-api.onrender.com
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import dns from 'dns';
import net from 'net';
import { performance } from 'perf_hooks';

// Default backend URL if not provided as argument
const DEFAULT_BACKEND_URL = 'https://token-system-api.onrender.com';
const backendUrl = process.argv[2] || DEFAULT_BACKEND_URL;

console.log(`\n🔍 Network Connectivity Check Tool`);
console.log(`==================================`);
console.log(`Testing connectivity to: ${backendUrl}\n`);

// Parse the URL
let parsedUrl;
try {
  parsedUrl = new URL(backendUrl);
  console.log(`✅ URL Format: Valid`);
} catch (error) {
  console.error(`❌ URL Format: Invalid - ${error.message}`);
  process.exit(1);
}

// Run all checks
async function runAllChecks() {
  await checkDns(parsedUrl.hostname);
  await checkPortConnection(parsedUrl);
  await makeHttpRequest(backendUrl);
  await checkHealthEndpoints(backendUrl);
  
  console.log(`\n✨ All tests completed.`);
}

// DNS Resolution Check
async function checkDns(hostname) {
  console.log(`\n📡 DNS Resolution Test`);
  console.log(`---------------------`);
  
  return new Promise((resolve) => {
    const startTime = performance.now();
    
    dns.lookup(hostname, (err, address, family) => {
      const duration = Math.round(performance.now() - startTime);
      
      if (err) {
        console.error(`❌ DNS Lookup Failed: ${err.message} (${duration}ms)`);
        resolve(false);
        return;
      }
      
      console.log(`✅ DNS Resolved: ${hostname} → ${address} (IPv${family}) in ${duration}ms`);
      
      // Now try reverse lookup
      dns.reverse(address, (err, hostnames) => {
        if (err) {
          console.log(`ℹ️ Reverse DNS Lookup: Not available (common for cloud services)`);
        } else {
          console.log(`ℹ️ Reverse DNS Lookup: ${address} → ${hostnames.join(', ')}`);
        }
        resolve(true);
      });
    });
  });
}

// TCP Port Connection Test
async function checkPortConnection(parsedUrl) {
  const port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
  const hostname = parsedUrl.hostname;
  
  console.log(`\n🔌 TCP Port Connection Test`);
  console.log(`-------------------------`);
  console.log(`Attempting to connect to ${hostname}:${port}...`);
  
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const startTime = performance.now();
    
    // Set a timeout for the connection attempt
    socket.setTimeout(5000);
    
    socket.on('connect', () => {
      const duration = Math.round(performance.now() - startTime);
      console.log(`✅ TCP Connection: Successful in ${duration}ms`);
      socket.end();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      console.error(`❌ TCP Connection: Timeout after 5000ms`);
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', (error) => {
      const duration = Math.round(performance.now() - startTime);
      console.error(`❌ TCP Connection: Failed - ${error.message} (${duration}ms)`);
      resolve(false);
    });
    
    socket.connect(port, hostname);
  });
}

// HTTP Request Test
async function makeHttpRequest(url) {
  console.log(`\n🌐 HTTP Request Test`);
  console.log(`------------------`);
  console.log(`Sending GET request to ${url}...`);
  
  return new Promise((resolve) => {
    const startTime = performance.now();
    const parsedUrl = new URL(url);
    const requestModule = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = requestModule.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Network-Check-Tool/1.0',
        'Accept': 'application/json,text/html,*/*'
      }
    }, (res) => {
      const duration = Math.round(performance.now() - startTime);
      
      console.log(`✅ HTTP Response: ${res.statusCode} ${res.statusMessage} in ${duration}ms`);
      console.log(`ℹ️ Response Headers:`);
      Object.entries(res.headers).forEach(([key, value]) => {
        console.log(`   - ${key}: ${value}`);
      });
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
        // Limit data to prevent huge responses
        if (data.length > 1024) {
          res.destroy();
          data = data.substring(0, 1024) + '... (response truncated)';
        }
      });
      
      res.on('end', () => {
        console.log(`ℹ️ Response Body (first 1KB):`);
        console.log(data || '(empty body)');
        resolve(true);
      });
    });
    
    req.on('timeout', () => {
      console.error(`❌ HTTP Request: Timeout after 10000ms`);
      req.destroy();
      resolve(false);
    });
    
    req.on('error', (error) => {
      const duration = Math.round(performance.now() - startTime);
      console.error(`❌ HTTP Request: Failed - ${error.message} (${duration}ms)`);
      resolve(false);
    });
  });
}

// Check health endpoints
async function checkHealthEndpoints(baseUrl) {
  const healthEndpoints = [
    '/api/health',
    '/api/health-check',
    '/health',
    '/'
  ];
  
  console.log(`\n💓 Health Endpoint Tests`);
  console.log(`---------------------`);
  
  for (const endpoint of healthEndpoints) {
    const url = new URL(endpoint, baseUrl).toString();
    console.log(`\nTesting endpoint: ${url}`);
    
    await new Promise((resolve) => {
      const startTime = performance.now();
      const parsedUrl = new URL(url);
      const requestModule = parsedUrl.protocol === 'https:' ? https : http;
      
      const req = requestModule.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Network-Check-Tool/1.0',
          'Accept': 'application/json,text/html,*/*'
        }
      }, (res) => {
        const duration = Math.round(performance.now() - startTime);
        
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ ${endpoint}: ${res.statusCode} ${res.statusMessage} in ${duration}ms`);
        } else {
          console.log(`⚠️ ${endpoint}: ${res.statusCode} ${res.statusMessage} in ${duration}ms`);
        }
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
          // Limit data to prevent huge responses
          if (data.length > 1024) {
            res.destroy();
            data = data.substring(0, 1024) + '... (truncated)';
          }
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            console.log(`   Response: ${JSON.stringify(jsonData)}`);
          } catch (e) {
            console.log(`   Response: ${data.substring(0, 100).trim()}${data.length > 100 ? '...' : ''}`);
          }
          resolve();
        });
      });
      
      req.on('timeout', () => {
        console.error(`❌ ${endpoint}: Timeout after 10000ms`);
        req.destroy();
        resolve();
      });
      
      req.on('error', (error) => {
        const duration = Math.round(performance.now() - startTime);
        console.error(`❌ ${endpoint}: Failed - ${error.message} (${duration}ms)`);
        resolve();
      });
    });
  }
}

// Run all checks
runAllChecks(); 