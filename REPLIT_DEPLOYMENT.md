# Replit Deployment Guide

## Overview
This document contains instructions for deploying the Token Generator System on Replit.

## Getting Started
1. Create a new Replit project by importing from GitHub
2. Choose this repository URL

## Configuration
Ensure the following environment variables are set in the Replit Secrets tab:

- `PORT`: 5000
- `JWT_SECRET`: Your secure JWT secret key
- `FIREBASE_API_KEY`: Your Firebase API key
- `FIREBASE_AUTH_DOMAIN`: Your Firebase Auth Domain
- `FIREBASE_PROJECT_ID`: Your Firebase Project ID
- `FIREBASE_STORAGE_BUCKET`: Your Firebase Storage Bucket
- `FIREBASE_MESSAGING_SENDER_ID`: Your Firebase Messaging Sender ID
- `FIREBASE_APP_ID`: Your Firebase App ID

## Email Configuration
Add these email configurations to Replit Secrets:

- `EMAIL_FROM`: Your sender email
- `SMTP_HOST`: Your SMTP host (e.g., smtp.gmail.com)
- `SMTP_PORT`: Your SMTP port (e.g., 465)
- `SMTP_SECURE`: true (for SSL)
- `SMTP_USER`: Your SMTP username (email)
- `SMTP_PASS`: Your SMTP password or app password

## Database Configuration (If using PostgreSQL)
If your app uses PostgreSQL, add these to Replit Secrets:

- `PGUSER`: Your PostgreSQL username
- `PGHOST`: Your PostgreSQL host
- `PGDATABASE`: Your PostgreSQL database name
- `PGPASSWORD`: Your PostgreSQL password
- `PGPORT`: Your PostgreSQL port (default: 5432)

## Running the Application
The application should start automatically when the Replit project runs.

If it doesn't start automatically:
1. Open the Shell in Replit
2. Run `npm run replit`

## Troubleshooting
- **API Connection Issues**: Check that environment variables are set correctly
- **Database Connection Issues**: Verify PostgreSQL credentials and connection
- **Email Not Sending**: Verify SMTP settings, especially if using Gmail
- **Firebase Authentication Issues**: Ensure Firebase configuration is correct

## Notes
- The frontend runs on the default Replit domain
- The backend API is accessible via the `/api` endpoint
- All API requests from the frontend are proxied to the backend 