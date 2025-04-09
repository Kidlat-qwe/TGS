# Email Configuration Instructions

## Summary of Changes Made

We've successfully configured the email system to use Gmail for sending emails. Here's what we did:

1. **Updated Email Service Configuration**:
   - Removed SendGrid dependencies and code
   - Configured Nodemailer to use Gmail's SMTP server
   - Added error handling and logging

2. **Fixed Authentication Issues**:
   - Modified the Gmail configuration to use SSL (port 465)
   - Set up the Gmail App Password format correctly (without spaces)
   - Improved connection verification

3. **Added Testing Tools**:
   - Created test scripts to verify email functionality
   - Added detailed logging and error diagnostics
   - Saved working configuration for reference

## How to Use the Email System

### Required Gmail Settings

1. **Enable 2-Step Verification**:
   - Go to your Google Account > Security
   - Turn on 2-Step Verification

2. **Create an App Password**:
   - Go to your Google Account > Security > App passwords
   - Select "Mail" for the app and "Other" (name it "Token System")
   - Click "Generate" to get a 16-character password
   - Copy this password without spaces

3. **Update .env File**:
   - Use the following configuration:
   ```
   # Gmail SMTP Configuration (SSL)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_SECURE=true
   SMTP_USER=your-gmail@gmail.com
   SMTP_PASS=yourgmailapppassword
   ```

### Testing Email Functionality

1. **Using the Test Script**:
   ```
   node test-send-email.js
   ```
   - This will send a test email to your admin address
   - Check your inbox or spam folder for the email
   - The script saves logs to the `logs/email-test.log` file

2. **Testing in Development Mode**:
   - When SMTP is not configured, emails are logged to the console
   - Enable debug mode by setting `debug: true` in the transporter

### Troubleshooting

If emails are not being received:

1. **Check Your Spam Folder**:
   - Gmail might flag automated emails as spam initially

2. **Verify App Password**:
   - Make sure the App Password is correct and entered without spaces
   - Generate a new one if needed

3. **Check Logs**:
   - Look at `logs/email-test.log` and server logs
   - Check for authentication errors (EAUTH)

4. **Network Issues**:
   - Ensure port 465 is not blocked by firewalls
   - Try using a different network if possible

## Email Features

The system provides the following email capabilities:

1. **Approval Emails**:
   - Sent when an admin approves a user
   - Contains login information and access details

2. **Admin Notifications**:
   - Sent when users submit contact requests
   - Includes the message and contact information
   - Configured with reply-to for easy responses

3. **Resend Functionality**:
   - Ability to resend approval emails if needed
   - Available through the admin interface

## Working Configuration

The current working configuration has been tested and confirmed to work with Gmail:

```json
{
  "host": "smtp.gmail.com",
  "port": 465,
  "secure": true,
  "user": "mjtamayo0703@gmail.com",
  "passwordLength": 16
}
```

Make sure your Gmail account has 2-Step Verification enabled and is using an App Password. 