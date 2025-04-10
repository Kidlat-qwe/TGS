import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Get the backend URL from environment or use the local development server
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

console.log(`Starting server with configuration:`);
console.log(`- PORT: ${PORT}`);
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`- BACKEND_URL: ${BACKEND_URL}`);
console.log(`- __dirname: ${__dirname}`);

// Add JSON body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// Special route for API status check
app.get('/api-status', (req, res) => {
  res.json({
    status: 'Frontend server is running',
    backendUrl: BACKEND_URL,
    timestamp: new Date().toISOString()
  });
});

// Create API proxy middleware with enhanced error handling
const apiProxy = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
  secure: false, // Don't verify SSL certificates
  ws: true, // Support websockets if needed
  xfwd: true, // Add x-forwarded headers
  followRedirects: true, // Follow HTTP 3xx responses as redirects
  pathRewrite: {
    '^/api': '/api' // Keep the /api prefix when forwarding
  },
  // Set reasonable timeouts (in milliseconds)
  proxyTimeout: 60000, // 60 seconds
  timeout: 60000, // 60 seconds
  // Retry configuration
  // Set to 0 to disable retries
  // Set to a positive number for the maximum number of retries
  // Set to -1 for unlimited retries
  retry: 1, // Try once, then retry once if it fails
  logLevel: 'debug', // More detailed logging
  onProxyReq: (proxyReq, req, res) => {
    // Log the headers we're sending to the backend
    console.log(`Proxying ${req.method} ${req.url} to ${BACKEND_URL}${req.url}`);
    
    // Copy authentication headers from client if present
    if (req.headers.authorization) {
      console.log('Forwarding Authorization header from client');
      proxyReq.setHeader('Authorization', req.headers.authorization);
    }
    
    // Additional headers that might help
    proxyReq.setHeader('X-Forwarded-Proto', 'https');
    proxyReq.setHeader('X-Forwarded-Host', req.headers.host || 'unknown');
    proxyReq.setHeader('X-Forwarded-For', req.ip || 'unknown');
    
    // Log request details for debugging
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    // Only handle request body for methods that expect one
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      try {
        const bodyData = JSON.stringify(req.body);
        console.log('Request body:', bodyData);
        
        // Make sure content-type is set
        proxyReq.setHeader('Content-Type', 'application/json');
        // Update content-length
        proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
        // Write body to request
        proxyReq.write(bodyData);
        proxyReq.end();
      } catch (error) {
        console.error('Error handling request body:', error);
      }
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Log the response status code from the backend
    console.log(`Backend responded with status: ${proxyRes.statusCode} for ${req.method} ${req.url}`);
    
    // For any response, add debugging headers
    res.setHeader('X-Proxy-Response-Time', Date.now());
    res.setHeader('X-Proxied-By', 'token-frontend-proxy');
    
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
          
          // For 500 errors, display the actual error message from the backend
          if (proxyRes.statusCode === 500) {
            console.error('BACKEND SERVER ERROR (500):', parsedBody.message || parsedBody.error || 'Unknown server error');
            console.error('This is an error from your backend server, not a connection issue.');
          }
        } catch (e) {
          // Otherwise log as string
          console.log('Error response body (raw):', responseBody);
          if (proxyRes.statusCode === 500) {
            console.error('BACKEND SERVER ERROR (500) - Raw response:', responseBody);
          }
        }
      });
    }
  },
  onError: (err, req, res) => {
    console.error('Proxy error:', err);
    
    // Try to determine if it's a timeout
    const isTimeout = err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.message.includes('timeout');
    const isConnectionRefused = err.code === 'ECONNREFUSED';
    
    // If connection is refused, try to use mock API
    if (isConnectionRefused) {
      console.log('Backend server is not running. Consider enabling mock API mode in api.js');
    }
    
    // Send a friendly error response
    res.status(502).json({
      error: isTimeout ? 'Backend API Timeout' : 'Backend API Connection Error',
      message: isTimeout 
        ? 'The backend API took too long to respond. Render free tier services can sleep after inactivity and take time to wake up.'
        : isConnectionRefused
          ? 'Unable to connect to the backend API service. Make sure your backend is running on ' + BACKEND_URL + '.'
          : 'Unable to connect to the backend API service. The backend might be down or misconfigured.',
      suggestion: isTimeout
        ? 'Please try again in a moment while the backend service wakes up.'
        : isConnectionRefused
          ? 'Try starting your backend server with "node backend/server.js"'
          : 'Please check that the backend service is running and properly configured.',
      details: err.message,
      code: err.code,
      backendUrl: BACKEND_URL,
      path: req.path,
      originalUrl: req.originalUrl
    });
  }
});

// Function to check if the backend is likely sleeping (free tier Render)
const isBackendSleeping = async () => {
  try {
    // Try to make a simple HEAD request to see if the backend responds quickly
    console.log(`Checking if backend is responding at ${BACKEND_URL}...`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
    
    const response = await fetch(BACKEND_URL, {
      method: 'HEAD',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return false; // If we get here, the backend is responding
  } catch (err) {
    console.log(`Backend may be sleeping: ${err.message}`);
    return true; // If we get an error, backend is likely sleeping
  }
};

// Try a direct healthcheck to the backend on startup
const checkBackendHealth = async () => {
  // First check if the backend is likely sleeping
  const sleeping = await isBackendSleeping();
  if (sleeping) {
    console.log('Backend appears to be in sleep mode (normal for free Render tier).');
    console.log('The first request may take up to 30-60 seconds to wake up the service.');
  }
  
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
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
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
        console.log('Backend service is running and responding to health checks.');
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
  console.log('The backend may be in sleep mode (normal for free Render tier) or misconfigured.');
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