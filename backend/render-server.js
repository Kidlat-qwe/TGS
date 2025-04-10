/**
 * Simplified server entry point for Render deployment
 * This file ensures we bind directly to port 5000 as required by Render
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the directory path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set port explicitly to 5000 for Render
const PORT = 5000;

// Create Express application
const app = express();

// Basic configuration
app.use(express.json());
app.use(cors());

// Simple health check route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'token-system',
    version: '1.0.0',
    port: PORT
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
  res.send('Token Generating System is running');
});

// In production, serve static frontend files
const frontendPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(frontendPath)) {
  console.log(`Serving static files from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  
  // For any other routes not handled by API, serve index.html
  app.get('*', (req, res) => {
    if (!req.url.startsWith('/api/')) {
      res.sendFile(path.join(frontendPath, 'index.html'));
    }
  });
}

// Start the server on port 5000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check available at http://0.0.0.0:${PORT}/health`);
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