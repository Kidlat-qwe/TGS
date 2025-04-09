import express from 'express';
import jwt from 'jsonwebtoken';
import { collection, addDoc, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../config.js';
import { verifyAdmin } from '../Middlewares/auth.js';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Generate API token endpoint
router.post('/generate', verifyAdmin, async (req, res) => {
  try {
    console.log('Token generation request received:', req.body);
    console.log('Using JWT_SECRET:', JWT_SECRET.substring(0, 5) + '...');
    
    const { description, expiration, userType = 'admin', system } = req.body;
    
    if (!description) {
      console.log('Description is missing in request');
      return res.status(400).json({ error: 'Description is required' });
    }

    if (!system || !['evaluation', 'grading'].includes(system)) {
      console.log('Valid system type is missing in request');
      return res.status(400).json({ error: 'Valid system type (evaluation or grading) is required' });
    }

    if (!req.user || !req.user.email) {
      console.log('User information missing in request');
      return res.status(401).json({ error: 'User information not found' });
    }
    
    // Check if user has access to generate tokens for the requested system
    const userSystemAccess = req.user.systemAccess || 'both';
    if (userSystemAccess !== 'both' && userSystemAccess !== system) {
      console.log(`User ${req.user.email} attempted to generate token for ${system} system but only has access to ${userSystemAccess}`);
      return res.status(403).json({ 
        error: 'Access denied',
        message: `You don't have permission to generate tokens for the ${system} system`
      });
    }
    
    // Check daily token generation limit (5 tokens per day)
    try {
      // Skip the limit check for admin users
      if (req.user.role === 'admin') {
        console.log(`Admin user ${req.user.email} bypassing daily token generation limit`);
      } else {
        // Get today's date at midnight (start of day) for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tokenRef = collection(db, 'api-tokens');
        const startOfDay = today.toISOString();
        
        // Create tomorrow's date for the query
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const endOfDay = tomorrow.toISOString();
        
        // Query tokens created by this user today
        const q = query(
          tokenRef, 
          where("createdBy", "==", req.user.email),
          where("createdAt", ">=", startOfDay),
          where("createdAt", "<", endOfDay)
        );
        
        const querySnapshot = await getDocs(q);
        const tokensCreatedToday = querySnapshot.size;
        
        console.log(`User ${req.user.email} has created ${tokensCreatedToday} tokens today`);
        
        // Check if user has reached the daily limit
        if (tokensCreatedToday >= 5) {
          console.log(`User ${req.user.email} has reached the daily token generation limit (5)`);
          return res.status(429).json({ 
            error: 'Daily limit reached',
            message: 'You have reached the daily limit of 5 tokens per day'
          });
        }
      }
    } catch (limitError) {
      console.error('Error checking token generation limit:', limitError);
      // Continue with token generation even if the limit check fails
    }
    
    // Check user's access type and enforce expiration limits
    let finalExpiration = expiration || '30d';
    
    // Handle "Never Expires" option for admin users
    if (req.user.role === 'admin' && (expiration === 'never' || expiration === 'never_expires')) {
      console.log(`Admin user ${req.user.email} creating token that never expires`);
      finalExpiration = undefined; // JWT tokens without expiration will never expire
    } 
    // For trial users, enforce a maximum token expiration of 7 days
    else if (req.user.accessType === 'trial') {
      // Parse the expiration to check if it's longer than 7 days
      const match = finalExpiration.match(/^(\d+)([dhmy])$/);
      if (match) {
        const [, value, unit] = match;
        const numValue = parseInt(value, 10);
        
        let exceedsLimit = false;
        
        // Check if expiration exceeds 7 days based on unit
        switch (unit) {
          case 'd': // days
            exceedsLimit = numValue > 7;
            break;
          case 'h': // hours
            exceedsLimit = numValue > 168; // 7 days * 24 hours
            break;
          case 'm': // months or minutes
            exceedsLimit = true; // Any month value exceeds 7 days
            break;
          case 'y': // years
            exceedsLimit = true; // Any year value exceeds 7 days
            break;
        }
        
        if (exceedsLimit) {
          console.log(`Trial user ${req.user.email} attempted to create token with expiration ${finalExpiration}, limiting to 7d`);
          finalExpiration = '7d';
        }
      }
    }

    // Create API token with system-specific payload
    const tokenPayload = { 
      type: 'api-token',
      createdBy: req.user.email,
      description,
      createdAt: new Date().toISOString(),
      userType: userType, // For evaluation system compatibility
      role: 'admin', // For grading system compatibility
      id: Date.now(), // Add a unique ID for the token
      email: req.user.email, // Add email for evaluation system compatibility
      uid: `token-${Date.now()}`, // Add uid for compatibility
      system: system // Add system identifier
    };
    console.log('Creating token with payload:', { ...tokenPayload });

    // Create token with or without expiration
    let apiToken;
    if (finalExpiration === undefined) {
      // Create token without expiration
      apiToken = jwt.sign(tokenPayload, JWT_SECRET);
      console.log('Created token without expiration (never expires)');
    } else {
      // Create token with expiration
      apiToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: finalExpiration });
      console.log(`Created token with expiration: ${finalExpiration}`);
    }

    try {
      // Store token in Firestore
      const tokenRef = collection(db, 'api-tokens');
      const tokenData = {
        token: apiToken,
        description,
        createdBy: req.user.email,
        createdAt: new Date().toISOString(),
        expiration: finalExpiration === undefined ? 'never_expires' : finalExpiration,
        status: 'active',
        userType: userType, // Store userType in Firestore
        role: 'admin', // Store role in Firestore
        system: system // Store system identifier in Firestore
      };

      console.log('Storing token in Firestore...');
      const docRef = await addDoc(tokenRef, tokenData);
      console.log('Token stored successfully with ID:', docRef.id);

      res.json({ 
        id: docRef.id,
        ...tokenData,
        token: apiToken // Include the full token in the response
      });
    } catch (dbError) {
      console.error('Firestore error:', dbError);
      res.status(500).json({ 
        error: 'Failed to store token in database', 
        message: dbError.message,
        details: dbError.code 
      });
    }
  } catch (error) {
    console.error('Token generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate token',
      message: error.message,
      details: error.stack
    });
  }
});

// Get all tokens endpoint
router.get('/', verifyAdmin, async (req, res) => {
  try {
    console.log('Fetching tokens from Firestore for user:', req.user.email);
    const tokenRef = collection(db, 'api-tokens');
    
    // Create a query to filter tokens by the current user's email
    const q = query(tokenRef, where("createdBy", "==", req.user.email));
    const querySnapshot = await getDocs(q);
    
    const tokens = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      tokens.push({
        id: doc.id,
        description: data.description,
        createdBy: data.createdBy,
        createdAt: data.createdAt,
        expiration: data.expiration,
        status: data.status,
        system: data.system,
        // Include the full token in the response
        token: data.token,
        // Add a display version for UI
        displayToken: `${data.token.substring(0, 15)}...`
      });
    });

    console.log(`Found ${tokens.length} tokens for user ${req.user.email}`);
    // Sort tokens by creation date, newest first
    const sortedTokens = tokens.sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json(sortedTokens);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    res.status(500).json({ 
      error: 'Failed to fetch tokens',
      message: error.message 
    });
  }
});

// Delete token endpoint
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deleting token with ID: ${id}`);

    // Get a reference to the document
    const tokenDoc = doc(db, 'api-tokens', id);
    
    // Check if the document exists
    const docSnap = await getDoc(tokenDoc);
    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Delete the document
    await deleteDoc(tokenDoc);
    
    console.log(`Token ${id} deleted successfully`);
    res.json({ message: 'Token deleted successfully' });
  } catch (error) {
    console.error('Failed to delete token:', error);
    res.status(500).json({ 
      error: 'Failed to delete token',
      message: error.message 
    });
  }
});

// Get full token endpoint (for copying)
router.get('/:id/full', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Retrieving full token with ID: ${id}`);

    // Get a reference to the document
    const tokenDoc = doc(db, 'api-tokens', id);
    
    // Check if the document exists
    const docSnap = await getDoc(tokenDoc);
    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Return the full token
    const tokenData = docSnap.data();
    
    console.log(`Full token for ${id} retrieved successfully`);
    res.json({ token: tokenData.token });
  } catch (error) {
    console.error('Failed to retrieve full token:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve full token',
      message: error.message 
    });
  }
});

// Update token system endpoint
router.put('/:id/system', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { system } = req.body;
    
    if (!system || !['evaluation', 'grading'].includes(system)) {
      return res.status(400).json({ error: 'Valid system type (evaluation or grading) is required' });
    }
    
    console.log(`Updating token ${id} system to: ${system}`);

    // Get a reference to the document
    const tokenDoc = doc(db, 'api-tokens', id);
    
    // Check if the document exists
    const docSnap = await getDoc(tokenDoc);
    if (!docSnap.exists()) {
      return res.status(404).json({ error: 'Token not found' });
    }
    
    // Update the document
    await updateDoc(tokenDoc, { system });
    
    console.log(`Token ${id} system updated successfully`);
    res.json({ message: 'Token system updated successfully' });
  } catch (error) {
    console.error('Failed to update token system:', error);
    res.status(500).json({ 
      error: 'Failed to update token system',
      message: error.message 
    });
  }
});

export default router; 