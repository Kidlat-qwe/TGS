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

// Add JSON body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

// Create API proxy middleware with enhanced error handling
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false, // Don't verify SSL certificates
  pathRewrite: {
    '^/api': '/api' // Keep the /api prefix when forwarding
  },
  logLevel: 'debug', // More detailed logging
  onProxyReq: (proxyReq, req, res) => {
    // Log the headers we're sending to the backend
    console.log(`Proxying ${req.method} ${req.url} to ${BACKEND_URL}${req.url}`);
    
    // Add potential authentication headers
    // Uncomment and adjust if your backend requires authentication
    // proxyReq.setHeader('Authorization', 'Bearer your-token-here');
    
    // Copy authentication headers from client if present
    if (req.headers.authorization) {
      console.log('Forwarding Authorization header from client');
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    
    // Log request details for debugging
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    // If there's a body, log it (useful for debugging)
    if (req.body) {
      console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response status code from the backend
    console.log(`Backend responded with status: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
    
    // For error responses, log more details
    if (proxyRes.statusCode >= 400) {
      console.log('Response headers:', JSON.stringify(proxyRes.headers, null, 2));
      
      // Capture the response body for error analysis
      let responseBody = '';
      proxyRes.on('data', (chunk) => {
        responseBody += chunk;
      });
      
      proxyRes.on('end', () => {
        try {
          // Try to parse as JSON if possible
          const parsedBody = JSON.parse(responseBody);
          console.log('Error response body:', JSON.stringify(parsedBody, null, 2));
        } catch (e) {
          // Otherwise log as string
          console.log('Error response body (raw):', responseBody);
        }
      });
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    // Send a friendly error response
    res.status(502).json({
      error: 'Backend API Connection Error',
      message: 'Unable to connect to the backend API service',
      details: err.message,
      backendUrl: BACKEND_URL,
      path: req.path,
      originalUrl: req.originalUrl
    });
  }
});

// Try a direct healthcheck to the backend on startup
const checkBackendHealth = async () => {
  // List of potential health check endpoints to try
  const healthEndpoints = [
    '/api/health',
    '/api/health-check',
    '/health',
    '/healthz',
    '/api/v1/health',
    '/'
  ];
  
  for (const endpoint of healthEndpoints) {
    try {
      const url = `${BACKEND_URL}${endpoint}`;
      console.log(`Checking backend health at ${url}...`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });
      
      if (response.ok) {
        console.log(`Backend health check successful at ${endpoint}!`);
        try {
          const data = await response.json();
          console.log('Health check response:', JSON.stringify(data, null, 2));
        } catch (e) {
          const text = await response.text();
          console.log('Health check response (text):', text);
        }
        
        // If we found a working endpoint, no need to try others
        return;
      } else {
        console.log(`Backend endpoint ${endpoint} returned status: ${response.status}`);
      }
    } catch (err) {
      console.log(`Backend health check error for ${endpoint}:`, err.message);
    }
  }
  
  // If we get here, none of the health endpoints worked
  console.error('Could not connect to any backend health endpoints. Please check your backend URL configuration.');
};

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
  
  // Check backend health after server starts
  checkBackendHealth();
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 