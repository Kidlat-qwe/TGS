/**
 * Simplified server entry point for Render deployment
 * This file uses whatever port is available, with multiple fallbacks
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get port from environment or fallbacks
// Render will set the PORT environment variable automatically
const DEFAULT_PORTS = [process.env.PORT, 3000, 8080, 10000];

console.log(`🔍 Available ports will be tried in this order: ${DEFAULT_PORTS.join(', ')}`);
console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`🏠 Current directory: ${__dirname}`);

// Create Express application
const app = express();

// Basic configuration
app.use(express.json());
app.use(cors({
  origin: '*', // Allow all origins for simplicity
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Simple health check route - this is the most important part for Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'token-system',
    version: '1.0.0'
  });
});

// Simple API health check route
app.get('/api/health-check', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (req, res) => {
  res.send(`Token Generating System is running`);
});

// In production, serve static frontend files
const frontendPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendPath)) {
  console.log(`📂 Serving static files from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  
  // For any other routes not handled by API, serve index.html
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api/')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

// Try to start the server on the first available port
async function startServer() {
  // Try each port in sequence
  for (const port of DEFAULT_PORTS) {
    if (!port) continue; // Skip undefined/null values
    
    const portNum = parseInt(port, 10);
    if (isNaN(portNum)) continue; // Skip invalid ports
    
    try {
      // Create server instance
      const server = http.createServer(app);
      
      // Try to start the server
      await new Promise((resolve, reject) => {
        server.once('error', (err) => {
          console.log(`❌ Failed to bind to port ${portNum}: ${err.message}`);
          server.close();
          resolve(false);
        });
        
        server.once('listening', () => {
          console.log(`✅ Server successfully started on port ${portNum}`);
          resolve(true);
        });
        
        server.listen(portNum, '0.0.0.0');
      }).then(success => {
        if (success) {
          console.log(`\n🚀 Server is running at http://0.0.0.0:${portNum}`);
          console.log(`🏥 Health check available at http://0.0.0.0:${portNum}/health`);
        } else {
          // Close the server if it failed to start
          server.close();
        }
        return success;
      });
      
      // If we got here with the server running, we're done
      if (server.listening) {
        return;
      }
    } catch (err) {
      console.error(`Error trying port ${portNum}:`, err);
    }
  }
  
  // If we get here, all ports failed
  console.error('❌ FATAL: Could not bind to any port! Tried:', DEFAULT_PORTS);
  process.exit(1);
}

// Start the server
startServer().catch(err => {
  console.error('❌ Fatal server error:', err);
  process.exit(1);
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Server shutting down');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Server shutting down');
  process.exit(0);
}); 