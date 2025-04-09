import express from 'express';
import { collection, addDoc, query, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config.js';
import { verifyAdmin } from '../Middlewares/auth.js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
// Import the email service that is already working
import emailService, { createTransporter } from '../Utils/email-service.js';

// Get directory name for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root directory (3 levels up from Routes folder)
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });

const router = express.Router();

// Helper function to send email notification to admin
const sendEmailToAdmin = async (contactDetails) => {
  try {
    console.log('Attempting to send admin notification email to mjtamayo0703@gmail.com');
    console.log('Environment check:');
    console.log(`SMTP_HOST: ${process.env.SMTP_HOST || 'undefined'}`);
    console.log(`SMTP_PORT: ${process.env.SMTP_PORT || 'undefined'}`);
    console.log(`SMTP_USER: ${process.env.SMTP_USER || 'undefined'}`);
    console.log(`SMTP_PASS length: ${process.env.SMTP_PASS ? process.env.SMTP_PASS.length : 0}`);
    
    // Create HTML content for the admin notification
    const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
  <h2 style="color: #4A90E2;">New Contact Request</h2>
  <p><strong>From:</strong> ${contactDetails.email}</p>
  <p><strong>Subject:</strong> ${contactDetails.subject}</p>
  <p><strong>Timestamp:</strong> ${new Date(contactDetails.timestamp).toLocaleString()}</p>
  
  <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
    <h3 style="margin-top: 0;">Message:</h3>
    <p style="white-space: pre-line;">${contactDetails.message}</p>
  </div>
  
  <p style="color: #666; font-size: 14px;">To respond, simply reply to this email (it will go directly to the sender).</p>
</div>
    `;
    
    // Create plain text version
    const text = `
You have received a new contact request from: ${contactDetails.email}

Message:
${contactDetails.message}

Timestamp: ${contactDetails.timestamp}

To respond, simply reply to this email (it will go to the sender's email address).
    `;
    
    // Prepare the admin notification email HTML content
    const adminEmail = 'mjtamayo0703@gmail.com';
    const fromEmail = process.env.SMTP_USER || process.env.EMAIL_FROM || 'noreply@tokensystem.com';
    
    // Build email content with better formatting
    const mailOptions = {
      from: `"Token System" <${fromEmail}>`,
      to: adminEmail,
      replyTo: contactDetails.email, // Makes it easy to reply directly to the user
      subject: `New Contact Request: ${contactDetails.subject}`,
      text: text,
      html: html,
      headers: {
        'X-Priority': '1',
        'Importance': 'high'
      }
    };
    
    // Create a transporter for this specific email
    const transporter = createTransporter();
    
    // Add diagnostic logging
    console.log(`Sending email to admin ${adminEmail} from ${fromEmail}`);
    
    try {
      // Verify the connection before sending
      await transporter.verify();
      console.log('SMTP connection verified successfully');
      
      // Send the email
      const info = await transporter.sendMail(mailOptions);
      console.log('Admin notification email sent successfully:', info);
      return { success: true, info };
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      if (emailError.code === 'EAUTH') {
        console.log('Authentication error - verify your Gmail credentials');
        console.log('Make sure you are using an App Password if 2FA is enabled');
      }
      
      throw emailError;
    }
  } catch (error) {
    console.error('Error sending admin notification email:', error);
    return { success: false, error: error.message };
  }
};

// New endpoint for contacting admin about registration
router.post('/', async (req, res) => {
  try {
    console.log('Contact admin request received:', req.body);
    const { email, message, subject } = req.body;
    
    if (!email || !message) {
      return res.status(400).json({ error: 'Email and message are required' });
    }

    // Create contact request object
    const contactData = {
      email,
      message,
      subject: subject || 'Registration Assistance Request',
      timestamp: new Date().toISOString(),
      status: 'unread'
    };

    let contactId = null;
    let firestoreSuccess = true;
    
    // First, try to send the email notification - this is the most important part
    try {
      console.log('Sending admin notification email first...');
      const emailResult = await sendEmailToAdmin({
        ...contactData,
        id: `pending-${Date.now()}`
      });
      
      contactData.emailSent = emailResult.success;
      contactData.emailSentAt = new Date().toISOString();
      
      if (!emailResult.success) {
        contactData.emailError = emailResult.error || 'Unknown error sending email';
        console.warn('Failed to send admin notification email:', emailResult.error);
      } else {
        console.log('Admin notification email sent successfully');
      }
    } catch (emailError) {
      console.error('Error sending admin notification email:', emailError);
      contactData.emailSent = false;
      contactData.emailError = emailError.message;
    }
    
    // Now, try to store in Firestore (but we already sent the email, so this is less critical)
    try {
      console.log('Storing contact request in Firestore...');
      const docRef = await addDoc(collection(db, 'admin-contacts'), contactData);
      contactId = docRef.id;
      console.log('Contact request stored with ID:', contactId);
    } catch (firestoreError) {
      console.error('Firestore error when storing contact request:', firestoreError);
      firestoreSuccess = false;
      
      // Fall back to in-memory storage
      if (!global.adminContacts) {
        global.adminContacts = [];
      }
      
      contactId = `contact-${Date.now()}`;
      const contactRecord = {
        id: contactId,
        ...contactData
      };
      
      global.adminContacts.push(contactRecord);
      
      // Save to persistent storage
      global.savePersistentData();
      
      console.log(`Added contact request from ${email} with ID ${contactId} to in-memory storage`);
    }
    
    // Return success response to the client
    return res.status(200).json({ 
      success: true,
      message: 'Your message has been sent. An administrator will contact you shortly.',
      id: contactId,
      emailSent: contactData.emailSent || false,
      stored: firestoreSuccess ? 'firestore' : 'in-memory'
    });
    
  } catch (error) {
    console.error('Server error processing contact request:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Endpoint for admins to view contact requests
router.get('/', verifyAdmin, async (req, res) => {
  try {
    console.log('Admin requesting contact messages');
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
    
    // Try to fetch from Firestore first
    try {
      const contactsRef = collection(db, 'admin-contacts');
      const q = query(contactsRef);
      const querySnapshot = await getDocs(q);
      
      const contacts = [];
      querySnapshot.forEach((doc) => {
        contacts.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      console.log(`Found ${contacts.length} contact requests in Firestore`);
      
      // Sort by timestamp descending (newest first)
      const sortedContacts = contacts.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      return res.json(sortedContacts);
    } catch (firestoreError) {
      console.error('Firestore error when fetching contacts:', firestoreError);
      
      // Fall back to in-memory storage
      if (!global.adminContacts) {
        global.adminContacts = [];
      }
      
      // Sort by timestamp descending
      const sortedContacts = [...global.adminContacts].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      );
      
      return res.json(sortedContacts);
    }
  } catch (error) {
    console.error('Server error fetching contact requests:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Endpoint to mark a contact as read
router.post('/:id/read', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Admin marking contact ${id} as read`);
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin role required.' });
    }
    
    // Try to update in Firestore
    try {
      const contactRef = doc(db, 'admin-contacts', id);
      await updateDoc(contactRef, { 
        status: 'read',
        readAt: new Date().toISOString(),
        readBy: req.user.email
      });
      
      console.log(`Contact ${id} marked as read in Firestore`);
      return res.json({ success: true });
    } catch (firestoreError) {
      console.error('Firestore error when updating contact:', firestoreError);
      
      // Fall back to in-memory storage
      if (global.adminContacts) {
        const contactIndex = global.adminContacts.findIndex(c => c.id === id);
        if (contactIndex !== -1) {
          global.adminContacts[contactIndex].status = 'read';
          global.adminContacts[contactIndex].readAt = new Date().toISOString();
          global.adminContacts[contactIndex].readBy = req.user.email;
          
          // Save to persistent storage
          global.savePersistentData();
          
          return res.json({ success: true });
        } else {
          return res.status(404).json({ error: 'Contact not found' });
        }
      } else {
        return res.status(404).json({ error: 'Contacts storage not initialized' });
      }
    }
  } catch (error) {
    console.error('Server error updating contact:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Add a test endpoint to directly test admin email sending
router.post('/test-email', async (req, res) => {
  try {
    console.log('Test admin email endpoint called');
    
    // Create test contact details
    const contactDetails = {
      email: req.body.email || 'test-user@example.com',
      message: req.body.message || 'This is a test message from the admin contact test endpoint',
      subject: req.body.subject || 'Test Contact Message',
      timestamp: new Date().toISOString(),
      id: `test-${Date.now()}`
    };
    
    console.log('Sending test admin notification email with details:', contactDetails);
    
    // Send the email notification directly
    const emailResult = await sendEmailToAdmin(contactDetails);
    
    // Return detailed response
    return res.status(200).json({
      success: emailResult.success,
      message: emailResult.success 
        ? 'Test admin notification email sent successfully' 
        : 'Failed to send test admin notification email',
      details: emailResult,
      contactDetails
    });
  } catch (error) {
    console.error('Error in test admin email endpoint:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error',
      message: error.message
    });
  }
});

export default router; 