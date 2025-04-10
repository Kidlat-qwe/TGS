# API Testing Tools

This directory contains tools to help you test and debug API connections between your frontend and backend applications.

## 1. API Connection Tester (Browser-based)

The `public/api-tester.html` file provides a simple browser-based interface for testing API connections directly from your browser.

### How to Use:

1. Open `http://localhost:YOUR_PORT/api-tester.html` in your browser when your frontend server is running.
2. Enter the backend API URL (defaults to `https://token-system-api.onrender.com`).
3. Select the API endpoint you want to test.
4. Choose the HTTP method (GET, POST, PUT, DELETE, etc.).
5. If using POST/PUT, enter the JSON request body in the textarea.
6. Click "Test Connection" to send the request.
7. View the results in the "Response" section.

The page also includes a "Check Frontend Status" button to verify that your frontend server is responding correctly.

## 2. Network Connectivity Checker (Node.js)

The `network-check.js` script is a comprehensive network diagnostic tool that tests connectivity to your backend API from the command line.

### Features:

- DNS resolution test (both forward and reverse)
- TCP port connection test
- HTTP request test with full response headers and body
- Health endpoint detection (automatically checks common health endpoints)

### Requirements:

- Node.js installed on your system

### Usage:

```bash
# Test the default backend API
node network-check.js

# Test a specific backend API
node network-check.js https://your-backend-api.com
```

### Example Output:

```
🔍 Network Connectivity Check Tool
==================================
Testing connectivity to: https://token-system-api.onrender.com

✅ URL Format: Valid

📡 DNS Resolution Test
---------------------
✅ DNS Resolved: token-system-api.onrender.com → 35.222.85.38 (IPv4) in 123ms
ℹ️ Reverse DNS Lookup: Not available (common for cloud services)

🔌 TCP Port Connection Test
-------------------------
Attempting to connect to token-system-api.onrender.com:443...
✅ TCP Connection: Successful in 78ms

🌐 HTTP Request Test
------------------
Sending GET request to https://token-system-api.onrender.com...
✅ HTTP Response: 200 OK in 342ms
ℹ️ Response Headers:
   - content-type: application/json
   - date: Wed, 22 May 2024 15:23:45 GMT
   - content-length: 156
ℹ️ Response Body (first 1KB):
{"status":"success","message":"Welcome to the Token System API"}

💓 Health Endpoint Tests
---------------------
Testing endpoint: https://token-system-api.onrender.com/api/health
✅ /api/health: 200 OK in 285ms
   Response: {"status":"healthy","uptime":"2d 3h 12m"}

Testing endpoint: https://token-system-api.onrender.com/api/health-check
⚠️ /api/health-check: 404 Not Found in 267ms
   Response: {"error":"Endpoint not found"}

Testing endpoint: https://token-system-api.onrender.com/health
⚠️ /health: 404 Not Found in 254ms
   Response: {"error":"Endpoint not found"}

Testing endpoint: https://token-system-api.onrender.com/
✅ /: 200 OK in 301ms
   Response: {"status":"success","message":"Welcome to the Token System API"}

✨ All tests completed.
```

## Troubleshooting Common Issues

### CORS Errors in Browser

If you see CORS errors in the browser console when using the API tester:

1. Ensure your backend API has CORS properly configured to allow requests from your frontend origin.
2. For development, you can add `'*'` to the allowed origins in your backend CORS configuration.
3. For production, specify the exact frontend domain in your CORS configuration.

### Connection Timeouts

If connections are timing out:

1. Check that your backend server is running and accessible over the network.
2. Verify there are no firewall rules blocking the connection.
3. If using cloud services, check that your service is not in a sleep/paused state.

### SSL/TLS Certificate Errors

If you see SSL certificate errors:

1. Ensure your backend is using a valid SSL certificate if using HTTPS.
2. For development environments with self-signed certificates, you may need to add exceptions in your browser or use appropriate flags when making requests.

## Next Steps

After verifying connectivity:

1. Use the API tester to debug specific API endpoints and requests.
2. Check responses match your expected format and data.
3. Test edge cases and error conditions to ensure robust handling. 