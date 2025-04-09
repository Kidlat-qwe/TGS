import express from 'express';
import path from 'path';
import fs from 'fs';
import { parseFileName } from '../utils/helpers.js';

const router = express.Router();

// Use environment variable for video base directory
const BASE_DIR = process.env.VIDEO_BASE_DIR || 'C:/Users/DELL/Desktop/Zoom Recording Archive/02';

// Root endpoint to handle /api/evaluation/videos
router.get('/', (req, res) => {
  console.log('GET /api/evaluation/videos - Root videos endpoint accessed');
  
  try {
    // List the base directory
    const baseContents = fs.readdirSync(BASE_DIR);
    
    // Get details for each teacher directory
    const dirDetails = baseContents.map(teacherEmail => {
      const teacherPath = path.join(BASE_DIR, teacherEmail);
      if (fs.statSync(teacherPath).isDirectory()) {
        const files = fs.readdirSync(teacherPath);
        
        // Get file details for each video
        const videoFiles = files.map(file => {
          const filePath = path.join(teacherPath, file);
          const stats = fs.statSync(filePath);
          
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        });
        
        return {
          teacherEmail,
          videoCount: files.length,
          videos: videoFiles
        };
      }
      return null;
    }).filter(Boolean);

    res.json({
      status: 'success',
      baseDir: BASE_DIR,
      teacherCount: dirDetails.length,
      teachers: dirDetails
    });
  } catch (error) {
    console.error('Error listing videos directory:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to list videos',
      error: error.message
    });
  }
});

// Play video route
router.get('/play-video/:teacherEmail/:filename', (req, res) => {
  const { teacherEmail, filename } = req.params;
  const decodedTeacherEmail = decodeURIComponent(teacherEmail);
  const decodedFilename = decodeURIComponent(filename);
  
  // Construct the full file path
  const filePath = path.join(BASE_DIR, decodedTeacherEmail, decodedFilename);
  console.log('Play video request:', { teacherEmail, filename, filePath });
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return res.status(404).send('File not found');
  }
  
  // Get file stats
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  
  // Set headers for video playback
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', 'inline');
  
  // Handle range requests
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    const chunkSize = (end - start) + 1;
    console.log('Range request:', { start, end, chunkSize });
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    
    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    console.log('Full file request');
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
});

// Test file route
router.get('/test-file/:teacherEmail/:filename', (req, res) => {
  try {
    const { teacherEmail, filename } = req.params;
    const filePath = path.join(BASE_DIR, decodeURIComponent(teacherEmail), decodeURIComponent(filename));
    
    console.log('Testing file access:', filePath);
    
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.json({
        exists: true,
        size: stat.size,
        path: filePath,
        classCode: parseFileName(decodeURIComponent(filename)).classCode
      });
    } else {
      res.json({
        exists: false,
        path: filePath
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
      params: req.params
    });
  }
});

// List directory route
router.get('/list-dir', (req, res) => {
  try {
    // List the base directory
    const baseContents = fs.readdirSync(BASE_DIR);
    
    // Get details for each teacher directory
    const dirDetails = baseContents.map(teacherEmail => {
      const teacherPath = path.join(BASE_DIR, teacherEmail);
      if (fs.statSync(teacherPath).isDirectory()) {
        const files = fs.readdirSync(teacherPath);
        return {
          teacherEmail,
          files
        };
      }
      return null;
    }).filter(Boolean);

    res.json({
      baseDir: BASE_DIR,
      contents: dirDetails
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      baseDir: BASE_DIR
    });
  }
});

// Check file route
router.get('/check-file', (req, res) => {
  const teacherEmail = req.query.teacher;
  const filename = req.query.file;
  
  if (!teacherEmail || !filename) {
    return res.status(400).json({ error: 'Missing teacher or filename parameter' });
  }

  const filePath = path.join(BASE_DIR, teacherEmail, filename);
  
  try {
    const exists = fs.existsSync(filePath);
    const stats = exists ? fs.statSync(filePath) : null;
    
    res.json({
      exists,
      filePath,
      stats: stats ? {
        size: stats.size,
        isFile: stats.isFile(),
        created: stats.birthtime,
        modified: stats.mtime
      } : null
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
      filePath
    });
  }
});

// Direct video access by filename - adding this route after all the more specific routes
router.get('/:filename', (req, res) => {
  const { filename } = req.params;
  const decodedFilename = decodeURIComponent(filename);
  
  console.log('Direct video request for:', decodedFilename);
  
  // First, check if the file is directly in the BASE_DIR
  const directPath = path.join(BASE_DIR, decodedFilename);
  if (fs.existsSync(directPath) && fs.statSync(directPath).isFile()) {
    serveVideoFile(directPath, req, res);
    return;
  }
  
  // If not found in base dir, search in all teacher directories
  try {
    const teacherDirs = fs.readdirSync(BASE_DIR).filter(dir => 
      fs.statSync(path.join(BASE_DIR, dir)).isDirectory()
    );
    
    let filePath = null;
    
    // Find the first matching file in any teacher directory
    for (const teacherDir of teacherDirs) {
      const possiblePath = path.join(BASE_DIR, teacherDir, decodedFilename);
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
        break;
      }
    }
    
    // If no file was found
    if (!filePath) {
      console.error('File not found in any directory:', decodedFilename);
      return res.status(404).send('File not found');
    }
    
    serveVideoFile(filePath, req, res);
  } catch (error) {
    console.error('Error serving video by filename:', error);
    return res.status(500).send('Error processing video request');
  }
});

// Helper function to serve a video file with proper headers
function serveVideoFile(filePath, req, res) {
  // Get file stats
  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  
  // Set headers for video playback
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Content-Disposition', 'inline');
  
  // Handle range requests
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    
    const chunkSize = (end - start) + 1;
    console.log('Range request:', { start, end, chunkSize });
    
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
    res.setHeader('Content-Length', chunkSize);
    
    const stream = fs.createReadStream(filePath, { start, end });
    stream.pipe(res);
  } else {
    console.log('Full file request');
    res.setHeader('Content-Length', fileSize);
    fs.createReadStream(filePath).pipe(res);
  }
}

export default router; 