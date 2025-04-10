import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Get the backend URL from environment or use a default production URL
const BACKEND_URL = process.env.BACKEND_URL || 'https://tgs-backend.onrender.com';

console.log(`Starting server with configuration:`);
console.log(`- PORT: ${PORT}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- BACKEND_URL: ${BACKEND_URL}`);
console.log(`- __dirname: ${__dirname}`);

// Enable CORS with more options
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization']
}));

// Add additional headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

// Create API proxy middleware with error handling
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/api': '/api' // Keep the /api prefix when forwarding
  },
  logLevel: 'debug', // More detailed logging
  onProxyReq: (proxyReq, req, res) => {
    console.log(`Proxying ${req.method} ${req.url} to ${BACKEND_URL}/api${req.url}`);
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    // Send a friendly error response
    res.status(502).json({
      error: 'Backend API Connection Error',
      message: 'Unable to connect to the backend API service',
      details: err.message,
      backendUrl: BACKEND_URL,
      path: req.path
    });
  }
});

// Proxy API requests to the backend server
app.use('/api', apiProxy);

// Log all requests
app.use((req, res, next) => {
  const host = req.get('host') || '';
  const referer = req.get('referer') || 'direct';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${host} (referer: ${referer})`);
  next();
});

// Serve static assets from the dist directory
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1h', // Cache static assets for 1 hour
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) {
      // Do not cache HTML files
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// Serve the main index.html for any unknown route (SPA client-side routing)
app.get('*', (req, res) => {
  console.log(`Serving index.html for path: ${req.originalUrl}`);
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server Error',
    message: err.message
  });
});

// Start server with graceful shutdown
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 