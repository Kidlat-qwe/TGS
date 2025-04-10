# Mock API Configuration

This project includes a mock API system to allow frontend development to continue when the backend API is unavailable.

## How It Works

The mock API system is implemented in `src/utils/api.js` and provides simulated responses for key API endpoints.

### Enabling/Disabling Mock API

To enable or disable the mock API, edit the `USE_MOCK_API` flag in `src/utils/api.js`:

```javascript
// Flag to enable mock API when the backend is down
export const USE_MOCK_API = true; // Set to false to use the real backend API
```

### Default Test Credentials

When mock API is enabled, you can use the following test credentials to log in:

- **Email:** test@example.com
- **Password:** password123

These credentials are pre-filled in the login form when mock API mode is enabled.

## Currently Mocked Endpoints

The following API endpoints are currently mocked:

1. **`auth/login`** - Simulates login authentication
   - Success response includes a mock JWT token and user details
   - Returns error for invalid credentials

2. **`health`** - Simulates health status check
   - Returns a health status indicating the system is operational

## Adding New Mock Endpoints

To add a new mock endpoint, edit the `MOCK_RESPONSES` object in `src/utils/api.js`:

```javascript
const MOCK_RESPONSES = {
  // Existing endpoints...
  
  // Add your new endpoint
  'your/new/endpoint': {
    success: {
      // Your success response data
    },
    error: {
      // Your error response data
    }
  }
};
```

## Troubleshooting

### Testing Backend Connectivity

You can use these tools to test backend connectivity:

1. **Browser-based CORS checker:** Open http://localhost:3000/cors-check.html
2. **Node.js connection tester:** Run `node connection-test.js` from the frontend directory

### Common Issues

- If you're seeing "Failed to execute 'json' on 'Response'" errors, it usually indicates:
  - The backend API is returning an empty or malformed response
  - There's a network connectivity issue
  - CORS is not properly configured

- If you need to test specific API functionality that's not currently mocked:
  1. Add the required endpoint to the `MOCK_RESPONSES` object
  2. Update the mock response structure to match the expected API response

## Reverting to Real API

Once the backend API is available again:

1. Set `USE_MOCK_API = false` in `src/utils/api.js`
2. Test the connection with the CORS checker tool
3. Verify that authentication works with actual credentials 