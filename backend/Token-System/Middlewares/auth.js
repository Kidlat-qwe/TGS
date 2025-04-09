import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

// Middleware to verify admin authentication
export const verifyAdmin = async (req, res, next) => {
  try {
    // Check for token in the Authorization header and in cookies
    let token = req.headers.authorization?.split(' ')[1];
    
    // If no token in Authorization header, check for token in cookies
    if (!token && req.cookies && req.cookies.auth_token) {
      token = req.cookies.auth_token;
      console.log('Using token from cookie');
    }
    
    if (!token) {
      console.log('No token provided in request (neither in header nor in cookie)');
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      console.log('Verifying token with JWT_SECRET:', JWT_SECRET.substring(0, 5) + '...');
      const decoded = jwt.verify(token, JWT_SECRET);
      console.log('Token verified successfully:', { email: decoded.email });
      req.user = decoded;
      
      // Check if the user account is disabled (unless the user is an admin)
      if (decoded.role !== 'admin') {
        // Check in the approved users list
        const userInApprovedList = global.approvedUsers?.find(user => user.email === decoded.email);
        
        if (userInApprovedList && userInApprovedList.isDisabled === true) {
          console.log(`Access denied for disabled account: ${decoded.email}`);
          return res.status(403).json({ 
            error: 'Account Disabled', 
            message: 'Your account has been disabled. Please contact an administrator.'
          });
        }
        
        // Check in the pending users list by email
        const userInPendingList = global.mockPendingUsers?.find(user => user.email === decoded.email && user.isDisabled === true);
        
        if (userInPendingList) {
          console.log(`Access denied for disabled account in pending list: ${decoded.email}`);
          return res.status(403).json({ 
            error: 'Account Disabled', 
            message: 'Your account has been disabled. Please contact an administrator.'
          });
        }
      }
      
      next();
    } catch (verifyError) {
      console.error('Token verification failed:', verifyError);
      res.status(401).json({ error: 'Invalid token', message: verifyError.message });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Authentication failed', message: error.message });
  }
}; 