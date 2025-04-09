import express from 'express';
import jwt from 'jsonwebtoken';
import { auth } from '../../config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config.js';
import dotenv from 'dotenv';
import { evaluationPool, gradePool } from '../../server.js';
import cookieParser from 'cookie-parser';

dotenv.config();

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Add cookie parser middleware to the router
router.use(cookieParser());

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt received:', { email: req.body.email });
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      // Attempt Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Firebase Authentication successful:', { uid: user.uid });

      // Check if this is an approved user and get their role
      let userRole = 'user';
      let accessType = 'unlimited';
      let expiresAt = null;
      let isExpired = false;
      let systemAccess = 'both'; // Default to both systems
      let isDisabled = false; // Check if account is disabled
      
      if (global.approvedUsers && global.approvedUsers.length > 0) {
        const approvedUser = global.approvedUsers.find(u => u.email === email);
        if (approvedUser) {
          userRole = approvedUser.role || 'user';
          accessType = approvedUser.accessType || 'unlimited';
          expiresAt = approvedUser.expiresAt || null;
          systemAccess = approvedUser.systemAccess || 'both';
          isDisabled = approvedUser.isDisabled || false;
          
          // Check if trial has expired
          if (accessType === 'trial' && expiresAt) {
            const expirationDate = new Date(expiresAt);
            const currentDate = new Date();
            
            if (currentDate > expirationDate) {
              console.log(`Trial period has expired for user ${email}`);
              isExpired = true;
            }
          }
        }
      }
      
      // Check if the account is disabled
      if (isDisabled) {
        console.log(`Account ${email} is disabled. Login denied.`);
        return res.status(403).json({
          error: 'Account Disabled',
          message: 'Your account has been disabled. Please contact the administrator.'
        });
      }
      
      // If trial has expired, return an error
      if (isExpired) {
        return res.status(403).json({
          error: 'Trial period has expired',
          message: 'Your trial period has ended. Please contact the administrator for full access.'
        });
      }

      // Generate JWT token with role information
      const token = jwt.sign(
        { 
          email: user.email, 
          uid: user.uid,
          role: userRole,
          accessType: accessType,
          systemAccess: systemAccess,
          expiresAt: expiresAt
        }, 
        JWT_SECRET, 
        { expiresIn: '1h' }
      );

      // Set the token as an HTTP-only cookie
      res.cookie('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'strict',
        maxAge: 3600000, // 1 hour in milliseconds
        path: '/'
      });

      // Also return the token in the response body for backward compatibility
      res.json({ 
        token,
        user: {
          email: user.email,
          uid: user.uid,
          role: userRole,
          accessType: accessType,
          systemAccess: systemAccess,
          expiresAt: expiresAt
        }
      });
    } catch (authError) {
      console.error('Firebase Authentication failed:', authError.code, authError.message);
      
      // Check if this is a mock approved user
      if (global.approvedUsers && global.approvedUsers.length > 0) {
        console.log('Checking mock approved users as Firebase Auth failed');
        
        // Find the user by email and password
        const mockUser = global.approvedUsers.find(u => 
          u.email === email && u.password === password
        );
        
        if (mockUser) {
          console.log('Found matching mock approved user:', mockUser.email);
          
          // Check if account is disabled
          if (mockUser.isDisabled) {
            console.log(`Mock account ${email} is disabled. Login denied.`);
            return res.status(403).json({
              error: 'Account Disabled',
              message: 'Your account has been disabled. Please contact the administrator.'
            });
          }
          
          // Check if trial has expired for mock user
          let isExpired = false;
          if (mockUser.accessType === 'trial' && mockUser.expiresAt) {
            const expirationDate = new Date(mockUser.expiresAt);
            const currentDate = new Date();
            
            if (currentDate > expirationDate) {
              console.log(`Trial period has expired for mock user ${email}`);
              isExpired = true;
            }
          }
          
          // If trial has expired, return an error
          if (isExpired) {
            return res.status(403).json({
              error: 'Trial period has expired',
              message: 'Your trial period has ended. Please contact the administrator for full access.'
            });
          }
          
          // Generate JWT token for mock user
          const token = jwt.sign(
            { 
              email: mockUser.email, 
              uid: mockUser.uid || `mock-uid-${Date.now()}`,
              role: mockUser.role || 'user',
              accessType: mockUser.accessType || 'unlimited',
              systemAccess: mockUser.systemAccess || 'both',
              expiresAt: mockUser.expiresAt || null
            }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
          );
          
          // Set the token as an HTTP-only cookie
          res.cookie('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: 'strict',
            maxAge: 3600000, // 1 hour in milliseconds
            path: '/'
          });
          
          return res.json({ 
            token,
            user: {
              email: mockUser.email,
              uid: mockUser.uid || `mock-uid-${Date.now()}`,
              role: mockUser.role || 'user',
              accessType: mockUser.accessType || 'unlimited',
              systemAccess: mockUser.systemAccess || 'both',
              expiresAt: mockUser.expiresAt || null
            },
            note: 'Logged in using mock credentials'
          });
        }
        
        console.log('No matching mock approved user found');
      }

      // Also check if the user exists in the pending users list and is disabled
      if (global.mockPendingUsers && global.mockPendingUsers.length > 0) {
        const pendingUser = global.mockPendingUsers.find(u => u.email === email);
        
        if (pendingUser && pendingUser.isDisabled) {
          console.log(`Pending account ${email} is disabled. Login denied.`);
          return res.status(403).json({
            error: 'Account Disabled',
            message: 'Your account has been disabled. Please contact the administrator.'
          });
        }
      }
      
      return res.status(401).json({ 
        error: 'Invalid credentials',
        message: 'The email or password you entered is incorrect'
      });
    }
  } catch (error) {
    console.error('Server error during login:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// Add a logout route to clear the auth cookie
router.post('/logout', (req, res) => {
  try {
    // Clear the auth cookie
    res.clearCookie('auth_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/'
    });
    
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Error during logout:', error);
    res.status(500).json({ error: 'Server error', message: error.message });
  }
});

// User signup endpoint
router.post('/signup', async (req, res) => {
  try {
    console.log('Signup attempt received:', { email: req.body.email });
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log('Missing credentials');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if email already exists in the approved users list
    if (global.approvedUsers && global.approvedUsers.some(user => user.email === email)) {
      console.log(`Email ${email} already exists in approved users`);
      return res.status(400).json({ 
        error: 'Email already registered', 
        message: 'This email address is already registered in our system.'
      });
    }

    // Check if email already exists in the pending users list
    if (global.mockPendingUsers && global.mockPendingUsers.some(user => user.email === email)) {
      console.log(`Email ${email} already exists in pending users`);
      return res.status(400).json({ 
        error: 'Email already registered', 
        message: 'A registration request with this email is already pending approval.'
      });
    }

    try {
      // Log additional information about the request
      console.log('Processing signup request with:');
      console.log('- Email:', email);
      console.log('- Password length:', password ? password.length : 0);
      
      // Check if the email already exists in Firebase
      try {
        // First, check if the email exists in Firestore pending-users collection
        const pendingUsersRef = collection(db, 'pending-users');
        const q = query(pendingUsersRef, where("email", "==", email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          console.log(`Email ${email} already exists in Firestore pending-users`);
          return res.status(400).json({ 
            error: 'Email already registered', 
            message: 'A registration request with this email is already pending approval.'
          });
        }
      } catch (checkError) {
        console.error('Error checking for existing email in Firestore:', checkError);
        // Continue with the flow if we can't check Firestore
      }
      
      // Store the user registration request in Firestore
      try {
        const docRef = await addDoc(collection(db, 'pending-users'), {
          email,
          password, // Note: In a production app, you'd handle this more securely
          status: 'pending',
          requestDate: new Date().toISOString()
        });
        
        console.log('Registration request stored with ID:', docRef.id);
        
        res.status(201).json({ 
          success: true,
          message: 'Registration request submitted successfully. An administrator will review your request.',
          id: docRef.id
        });
      } catch (firestoreError) {
        console.error('Firestore error when storing pending user:', firestoreError);
        
        // If we have a permissions issue with Firestore, we can temporarily store in memory
        // and inform the user their request was received
        if (firestoreError.code === 'permission-denied' || firestoreError.code) {
          console.log('Permission denied for Firestore. Using fallback approach.');
          
          // Add the user to mock data
          const mockId = `mock-${Date.now()}`;
          if (!global.mockPendingUsers) {
            global.mockPendingUsers = [];
          }
          
          // Store the password so we can create the account later
          global.mockPendingUsers.push({
            id: mockId,
            email,
            password, // Save the password for account creation
            status: 'pending',
            requestDate: new Date().toISOString()
          });
          
          // Save to persistent storage
          global.savePersistentData();
          
          console.log(`Added user ${email} to mock pending users with ID ${mockId}`);
          console.log(`Current mock users: ${global.mockPendingUsers.length}`);
          
          // Return a response that appears successful but notes the permission issue
          return res.status(201).json({ 
            success: true,
            message: 'Registration request received. Due to a temporary system limitation, an administrator will need to contact you directly about your request.',
            status: 'received',
            note: 'Admin notification system temporarily unavailable'
          });
        }
        
        // For other Firestore errors, return an error
        throw firestoreError;
      }
    } catch (firebaseError) {
      console.error('Firebase signup error:', firebaseError);
      
      // Map Firebase error codes to user-friendly messages
      let errorMessage = 'Failed to process registration request';
      if (firebaseError.code === 'auth/email-already-in-use') {
        errorMessage = 'Email address is already in use';
      } else if (firebaseError.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address';
      } else if (firebaseError.code === 'permission-denied') {
        errorMessage = 'Unable to process your request due to a system configuration issue. Please try again later.';
      }
      
      return res.status(400).json({ error: errorMessage, code: firebaseError.code });
    }
  } catch (error) {
    console.error('Server error during signup:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: 'We encountered an issue processing your request. Please try again later.'
    });
  }
});

export default router; 