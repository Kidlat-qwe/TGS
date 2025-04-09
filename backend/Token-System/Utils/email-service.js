import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Get directory name for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Email templates directory
const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'emails');

// Create templates directory if it doesn't exist
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  console.log(`Created email templates directory at ${TEMPLATES_DIR}`);
}

// Configure transporter based on environment variables
export const createTransporter = () => {
  // Check if SMTP credentials are configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    console.log('Using nodemailer with SMTP for email delivery');
    console.log(`SMTP User: ${process.env.SMTP_USER}`);
    
    // For Gmail, use more reliable settings
    if ((process.env.SMTP_HOST || 'smtp.gmail.com').includes('gmail')) {
      console.log('Using Gmail-specific configuration');
      
      return nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true, // Use SSL
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS.trim() // Trim spaces just in case
        }
      });
    } else {
      // For non-Gmail SMTP
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        tls: {
          rejectUnauthorized: false // Allow self-signed certificates and prevent TLS issues
        }
      });
    }
  } else {
    // If no email transport is available, create a console logger transport for debugging
    console.log('\n⚠️ WARNING: No SMTP configuration found in .env file');
    console.log('⚠️ Emails will only be logged to console and not actually sent');
    console.log('⚠️ To fix this, configure SMTP settings in your .env file\n');
    
    return {
      sendMail: (mailOptions) => {
        console.log('\n============ EMAIL WOULD BE SENT ============');
        console.log('TO:', mailOptions.to);
        console.log('FROM:', mailOptions.from);
        console.log('SUBJECT:', mailOptions.subject);
        console.log('TEXT PREVIEW:', mailOptions.text ? mailOptions.text.substring(0, 150) + '...' : 'No text content');
        console.log('HTML PREVIEW:', mailOptions.html ? mailOptions.html.substring(0, 150) + '...' : 'No HTML content');
        console.log('============================================\n');
        
        // Return a successful result for testing purposes
        return Promise.resolve({
          success: true,
          messageId: `debug-${Date.now()}@localhost`,
          response: 'Logged to console (SMTP not configured)'
        });
      }
    };
  }
};

// Generate the approval email HTML template
const generateApprovalEmail = (user, loginUrl) => {
  const appUrl = loginUrl || process.env.APP_URL || 'http://localhost:5173';
  
  // Set access type text based on user's access
  let accessTypeText = 'unlimited access';
  let systemAccessText = 'all systems';
  
  if (user.accessType === 'trial') {
    const expiresAt = user.expiresAt ? new Date(user.expiresAt) : null;
    if (expiresAt) {
      const formattedDate = expiresAt.toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      accessTypeText = `trial access until ${formattedDate}`;
    } else {
      accessTypeText = 'trial access';
    }
  }
  
  if (user.systemAccess === 'token') {
    systemAccessText = 'Token Generator System';
  } else if (user.systemAccess === 'grading') {
    systemAccessText = 'Grading System';
  } else if (user.systemAccess === 'evaluation') {
    systemAccessText = 'Evaluation System';
  }
  
  // Create the email template
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4A90E2; color: white; padding: 10px 20px; text-align: center; }
    .content { padding: 20px; border: 1px solid #ddd; border-top: none; }
    .button { display: inline-block; background-color: #4A90E2; color: white; padding: 10px 20px; 
              text-decoration: none; border-radius: 4px; margin-top: 20px; }
    .footer { margin-top: 20px; font-size: 12px; color: #777; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Your Account Has Been Approved!</h2>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Great news! Your account has been approved by the administrator.</p>
      <p>You now have <strong>${accessTypeText}</strong> to the <strong>${systemAccessText}</strong>.</p>
      <p>You can log in using your registered email and password.</p>
      <a href="${appUrl}" class="button">Log In Now</a>
      <p>If you have any questions or need assistance, please contact the administrator.</p>
      <p>Thank you!</p>
    </div>
    <div class="footer">
      <p>This is an automated message, please do not reply directly to this email.</p>
      <p>For support, please contact <a href="mailto:mjtamayo0703@gmail.com">mjtamayo0703@gmail.com</a></p>
    </div>
  </div>
</body>
</html>
`;

  // Save the template to a file for reference
  const timestamp = Date.now();
  const filePath = path.join(TEMPLATES_DIR, `email-${timestamp}.html`);
  fs.writeFileSync(filePath, html);
  console.log(`Saved email template to ${filePath}`);
  
  return html;
};

// Function to send approval email
export const sendApprovalEmail = async (user) => {
  try {
    console.log(`Preparing to send approval email to ${user.email}`);
    
    if (!user || !user.email) {
      throw new Error('Invalid user provided');
    }
    
    // Create the transporter
    const transporter = createTransporter();
    
    // Generate the HTML email
    const htmlContent = generateApprovalEmail(user);
    
    // Create text version
    const textContent = `
Your Account Has Been Approved!

Hello,

Great news! Your account has been approved by the administrator.

You can now log in using your registered email and password at ${process.env.APP_URL || 'http://localhost:5173'}.

Thank you!

For support, please contact mjtamayo0703@gmail.com
    `;
    
    // Build better email options
    const fromEmail = process.env.EMAIL_FROM || 'noreply@tokensystem.com';
    
    // Send the email
    const mailOptions = {
      from: `"Token Generating System" <${fromEmail}>`,
      to: user.email,
      subject: 'Your Account Has Been Approved',
      text: textContent,
      html: htmlContent,
      headers: {
        'X-Priority': '1',
        'Importance': 'high'
      }
    };
    
    console.log(`Sending approval email to ${user.email} with the following configuration:`);
    console.log(`SMTP Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
    console.log(`SMTP Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`SMTP Secure: ${process.env.SMTP_SECURE || 'false'}`);
    console.log(`SMTP User: ${process.env.SMTP_USER ? '(configured)' : '(not configured)'}`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log(`Email sent successfully to ${user.email}`);
    console.log('Email delivery info:', info);
    
    return {
      success: true,
      info
    };
  } catch (error) {
    console.error('Error sending approval email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Function to resend approval email to an already approved user
export const resendApprovalEmail = async (user) => {
  try {
    console.log(`Preparing to resend approval email to ${user.email}`);
    
    if (!user || !user.email) {
      throw new Error('Invalid user provided');
    }
    
    if (user.status !== 'approved') {
      throw new Error('User is not approved yet');
    }
    
    // Just use the existing sendApprovalEmail function
    const result = await sendApprovalEmail(user);
    
    if (result.success) {
      console.log(`Approval email resent successfully to ${user.email}`);
      return {
        success: true,
        info: result.info,
        message: `Approval email resent to ${user.email}`
      };
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Error resending approval email:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Utility function to test email configuration
export const testEmailConfiguration = async (testEmail = 'mjtamayo0703@gmail.com') => {
  try {
    console.log(`\n🔍 Testing email configuration with test email: ${testEmail}`);
    
    // Create the transporter
    const transporter = createTransporter();
    
    // Create test email content
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; border-radius: 5px;">
        <h2 style="color: #4A90E2;">Email Configuration Test</h2>
        <p>This is a test email to verify that your email configuration is working correctly.</p>
        <p>If you received this email, it means your SMTP settings are properly configured.</p>
        <p>Here are the configuration details used:</p>
        <ul>
          <li>SMTP Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}</li>
          <li>SMTP Port: ${process.env.SMTP_PORT || '587'}</li>
          <li>SMTP Secure: ${process.env.SMTP_SECURE || 'false'}</li>
          <li>SMTP User: ${process.env.SMTP_USER || '(not configured)'}</li>
          <li>From Email: ${process.env.EMAIL_FROM || 'noreply@tokensystem.com'}</li>
        </ul>
        <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
          This is an automated test message. Timestamp: ${new Date().toISOString()}
        </p>
      </div>
    `;
    
    const fromEmail = process.env.EMAIL_FROM || 'noreply@tokensystem.com';
    
    // Send the test email
    const mailOptions = {
      from: `"Token Generating System" <${fromEmail}>`,
      to: testEmail,
      subject: 'Test Email - Email Configuration Check',
      text: `
        Email Configuration Test
        
        This is a test email to verify that your email configuration is working correctly.
        If you received this email, it means your SMTP settings are properly configured.
        
        Here are the configuration details used:
        - SMTP Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}
        - SMTP Port: ${process.env.SMTP_PORT || '587'}
        - SMTP Secure: ${process.env.SMTP_SECURE || 'false'}
        - SMTP User: ${process.env.SMTP_USER || '(not configured)'}
        - From Email: ${process.env.EMAIL_FROM || 'noreply@tokensystem.com'}
        
        This is an automated test message. Timestamp: ${new Date().toISOString()}
      `,
      html: html
    };
    
    // Add detailed logging
    console.log('\n📧 Sending test email with the following configuration:');
    console.log(`SMTP Host: ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
    console.log(`SMTP Port: ${process.env.SMTP_PORT || '587'}`);
    console.log(`SMTP Secure: ${process.env.SMTP_SECURE || 'false'}`);
    console.log(`SMTP User: ${process.env.SMTP_USER ? '(configured)' : '(not configured)'}`);
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test email sent successfully!');
    console.log('Email delivery info:', info);
    
    return {
      success: true,
      message: 'Test email sent successfully',
      info
    };
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
};

// Export the email service functions
export default {
  sendApprovalEmail,
  resendApprovalEmail,
  testEmailConfiguration
}; 