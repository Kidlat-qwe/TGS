# Token Authentication Troubleshooting Tools

This directory contains tools to help troubleshoot token authentication issues between the Token Generating System (TGS) and the Evaluation/Grading systems.

## Setup

Before using these tools, install the required dependencies:

```bash
cd backend
npm install node-fetch readline jsonwebtoken dotenv
```

## Tools Available

### 1. Token Validator

The `token-validator.js` tool helps you check if a token is valid and properly configured for use with the Evaluation or Grading systems.

```bash
node tools/token-validator.js YOUR_TOKEN_HERE
```

This tool will:
- Verify if the token can be validated with the JWT secret
- Check if the token is configured for the correct system
- Check if the token has expired
- Display the full token payload

### 2. Evaluation API Tester

The `test-evaluation-api.js` tool helps you test if your token works with a specific Evaluation System API endpoint.

```bash
node tools/test-evaluation-api.js
```

When running this tool:
1. You'll be prompted to enter your JWT token
2. You'll be asked for the API URL (defaults to http://localhost:3002)
3. You'll specify which endpoint to test (e.g., `/api/evaluation/submissions`)

The tool will then attempt to authenticate with the API and show detailed results.

## Common Issues and Solutions

### Issue 1: "JWT Secret Mismatch"

**Symptoms:** 
- "Invalid token signature" errors
- Token validation fails in one system but works in another

**Solution:**
1. Ensure all three systems use the exact same JWT_SECRET value
2. Update the `.env` files in all three systems to use the same secret:
   - `backend/.env` (main shared file)
   - `backend/Evaluation-System/.env`
   - `backend/Grading-System/.env`

### Issue 2: "System Field Missing or Incorrect"

**Symptoms:**
- "Token not authorized for evaluation system" errors
- Authentication works in TGS but fails in Evaluation System

**Solution:**
1. When generating tokens, make sure to specify `system: "evaluation"` for tokens meant for the Evaluation System
2. In TGS, select "Evaluation System" in the dropdown when generating tokens

### Issue 3: "Token Expired"

**Symptoms:**
- "Token expired" errors
- Authentication worked previously but stopped working

**Solution:**
1. Generate a new token with an appropriate expiration time
2. For testing, use a longer expiration time like "30d" (30 days)

### Issue 4: "Token Format Incorrect"

**Symptoms:**
- "No token provided" errors
- Authentication fails despite having a valid token

**Solution:**
1. Ensure the token is sent in the Authorization header as `Bearer YOUR_TOKEN_HERE`
2. Check that there are no extra spaces or characters in the token
3. Verify the token is being sent properly in your API requests

## Steps to Fix Token Authentication Issues

1. **Update JWT Secrets**: Ensure all systems use the same JWT_SECRET in their .env files
2. **Restart Servers**: Restart all three server systems after updating environment variables
3. **Generate New Token**: Create a new token with the correct system field (evaluation)
4. **Test with Tools**: Use the provided tools to validate token and test API endpoints
5. **Check Logs**: Review server logs for detailed error messages

## Need Further Help?

If you continue experiencing issues after using these tools, check the server logs for more detailed error messages and ensure all systems are running with the updated environment variables. 