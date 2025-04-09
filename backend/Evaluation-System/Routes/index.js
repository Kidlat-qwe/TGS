// Main routes file that combines all route modules
import express from 'express';
const router = express.Router();

// Import route modules
import authRoutes from './auth.js';
import userRoutes from './users.js';
import videoRoutes from './videos.js';
import evaluationRoutes from './evaluations.js';
import qaRoutes from './qa.js';

console.log('Setting up Evaluation System routes in index.js:');

// Register route modules
router.use('/auth', authRoutes);
console.log('- Mounted /auth routes');

router.use('/users', userRoutes);
console.log('- Mounted /users routes');

router.use('/videos', videoRoutes); // Contains video-related routes
console.log('- Mounted /videos routes');

// Test endpoint directly in index.js
router.get('/test', (req, res) => {
  console.log('Test endpoint called');
  res.json({ status: 'Evaluation API test endpoint working' });
});
console.log('- Added /test direct endpoint');

console.log('- About to mount /evaluation routes');
router.use('/', evaluationRoutes); // Mount directly at root to match /api/evaluation/evaluations
console.log('- Mounted evaluation routes at root path');

router.use('/qa', qaRoutes); // Contains QA-related routes
console.log('- Mounted /qa routes');

// Root API endpoint
router.get('/', (req, res) => {
  console.log('Root API endpoint called');
  res.json({
    status: 'API is running',
    message: 'Welcome to the Token Generation System API',
    routes: ['/auth', '/users', '/videos', '/evaluations', '/qa', '/test']
  });
});
console.log('- Added root endpoint');

console.log('Evaluation System routes setup complete');

export default router; 