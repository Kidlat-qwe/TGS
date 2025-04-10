# Deploying to Render

This guide provides instructions for deploying the Token Generating System to Render, with a focus on properly configuring environment variables for authentication between the Token Generating System, Evaluation System, and Grading System.

## Prerequisites

- A Render account (https://render.com)
- Your code pushed to a Git repository (GitHub, GitLab, etc.)

## Step 1: Create a New Web Service on Render

1. Log in to your Render account
2. Click "New +" and select "Web Service"
3. Connect your Git repository that contains this project
4. Configure your service:
   - **Name**: Choose a name for your service (e.g., "token-generating-system")
   - **Region**: Choose a region close to your users
   - **Branch**: Select your main branch (e.g., "main" or "master")
   - **Runtime**: Node
   - **Build Command**: `npm install && cd frontend && npm install && npm run build`
   - **Start Command**: `node backend/check-render-env.js && node backend/server.js`
   - **Instance Type**: Select appropriate instance (Free tier for testing)

## Step 2: Configure Environment Variables

This is the most critical step. You must properly configure all required environment variables in Render's environment variables section.

1. In your Render dashboard, go to your web service
2. Click on "Environment" in the left sidebar
3. Add the following environment variables:

### Shared JWT Configuration (Critical)

```
JWT_SECRET=V82CpEqP2dwHhJUzL4X1s6bK7vGtRy9ZmN3fT5aQwE8D
```

### Token Generating System Configuration

```
PORT=10000
NODE_ENV=production

FIREBASE_API_KEY=AIzaSyDTh3Fbkwh8btz9I5G1l7GaItYYTZJLgMo
FIREBASE_AUTH_DOMAIN=token-9b7f3.firebaseapp.com
FIREBASE_PROJECT_ID=token-9b7f3
FIREBASE_STORAGE_BUCKET=token-9b7f3.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=644079800512
FIREBASE_APP_ID=1:644079800512:web:bac21852221e668bcd9d25

APP_URL=https://your-render-url.onrender.com
EMAIL_FROM=mjtamayo0703@gmail.com

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=mjtamayo0703@gmail.com
SMTP_PASS=mggvpiwnvtqoyyvm
```

### Evaluation System Configuration

```
PGUSER=neondb_owner
PGPASSWORD=npg_eSz8JNlO0xcD
PGHOST=ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech
PGDATABASE=neondb
PGPORT=5432
PGSSL=true
DATABASE_URL=postgresql://neondb_owner:npg_eSz8JNlO0xcD@ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

# IMPORTANT: Also include the prefixed versions for better compatibility
EVALUATION_PGUSER=neondb_owner
EVALUATION_PGPASSWORD=npg_eSz8JNlO0xcD
EVALUATION_PGHOST=ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech
EVALUATION_PGDATABASE=neondb
EVALUATION_PGPORT=5432
EVALUATION_PGSSL=true
EVALUATION_DATABASE_URL=postgresql://neondb_owner:npg_eSz8JNlO0xcD@ep-divine-smoke-a138jirw-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
EVALUATION_PG_MAX_CONNECTIONS=10
EVALUATION_PG_IDLE_TIMEOUT=60000
EVALUATION_PG_CONNECTION_TIMEOUT=10000
EVALUATION_PG_CONNECTION_RETRIES=3
```

### Grading System Configuration

```
GRADING_PORT=5174
GRADING_DB_USER=postgres
GRADING_DB_PASSWORD=2025
GRADING_DB_HOST=localhost
GRADING_DB_NAME=Grade
GRADING_DB_PORT=5432
GRADING_DB_CONNECTION_STRING=postgresql://neondb_owner:npg_4z8ePRbJqwFX@ep-twilight-hill-a1hfyfgl-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

## Step 3: Deploy Your Service

1. Click "Save Changes" to save your environment variables
2. Click "Manual Deploy" > "Deploy latest commit"
3. Wait for the deployment to complete (you can follow the logs)

## Step 4: Troubleshooting Deployment

If you encounter issues during deployment:

1. **Check Logs**: In your Render dashboard, go to "Logs" to see detailed error messages
2. **Run Environment Check**: On your local machine, run `node backend/check-render-env.js` to see what variables are set
3. **Verify Database Connection**: Make sure the Neon PostgreSQL database allows connections from Render's IP addresses
4. **Restart the Service**: After making any changes to environment variables, restart your service

## Step 5: Verify Authentication Works

1. Visit your deployed application at the Render URL
2. Log in to the Token Generating System
3. Generate a new token for the Evaluation System
4. Use the token-validator tool to verify it works:
   ```bash
   # Run locally
   cd backend/tools
   node token-validator.js YOUR_TOKEN_HERE
   ```
5. Test with the Evaluation API:
   ```bash
   # Run locally
   cd backend/tools
   node test-evaluation-api.js
   # When prompted, enter:
   # - Your token
   # - Your Render URL (e.g., https://your-app.onrender.com)
   # - API endpoint (e.g., /api/evaluation/submissions)
   ```

## Additional Troubleshooting Tips

### Environment Variable Issues

If you see errors related to environment variables:

1. **Verify Environment Variables**: Make sure all required variables are set in Render
   - Go to your Render dashboard > Environment
   - Check that all variables listed above are set correctly
   - Make sure both the prefixed (EVALUATION_*) and non-prefixed versions of database variables are set

2. **Check Environment Variable Format**:
   - Ensure there are no trailing spaces or quotes in your environment variables
   - Database URLs should follow the format: `postgresql://username:password@host:port/database?sslmode=require`

3. **Use the check-render-env.js Script**:
   - This script will help diagnose environment variable issues
   - It will run automatically before your server starts (via the start command)
   - You can also run it manually via SSH in Render's shell access

### Database Connection Issues

If you see database connection errors:

1. **Check Database Credentials**: Verify that your database credentials are correct
2. **Check Database Firewall**: Ensure your database allows connections from Render's IP addresses
   - For Neon PostgreSQL, go to the Neon dashboard > Your project > Settings > Network Access
   - Add Render's IP ranges if necessary
3. **Test Database Connection Locally**:
   ```bash
   psql "postgresql://neondb_owner:password@host:port/neondb?sslmode=require"
   ```

### JWT Authentication Issues

If tokens aren't working between systems:

1. **Verify JWT_SECRET**: Make sure the JWT_SECRET is the same across all systems
2. **Check Token System Field**: When generating tokens, ensure the system field is correctly set to 'evaluation' or 'grading'
3. **Test with Token Validator**: Use the token-validator.js tool to debug token issues

## Additional Resources

- [Render Documentation](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [Environment Variables on Render](https://render.com/docs/environment-variables)
- [Render IP Addresses](https://render.com/docs/static-outbound-ip-addresses) (for database whitelisting) 