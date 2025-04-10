# Token Generating System - Frontend

This is the frontend for the Token Generating System, built with React and Vite.

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Start the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Backend Connectivity

The frontend communicates with a backend API server. If you're experiencing backend connectivity issues:

1. The application includes a **Mock API** to allow development to continue when the backend is unavailable.
2. See [MOCK-API.md](./MOCK-API.md) for details on how to use the mock API.
3. Use the [testing tools](./README-testing-tools.md) to diagnose backend connectivity issues.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `node server.js` - Run the production server (after building)
- `node connection-test.js` - Test backend API connectivity

## Testing Tools

This project includes several tools for testing and diagnosing connectivity issues:

1. **API Connection Tester** - Browser-based tool for testing API connections
2. **Network Connectivity Checker** - Command-line tool for testing network connectivity
3. **CORS Connection Checker** - Tool for diagnosing CORS configuration issues
4. **Backend Connection Tester** - Tool for testing login API endpoint

See [README-testing-tools.md](./README-testing-tools.md) for details on using these tools.

## Environment Configuration

The application uses the following environment variables:

- `VITE_API_URL` - Base URL for API requests (defaults to "/api")
- `VITE_BACKEND_URL` - Backend server URL (defaults to "https://token-system-api.onrender.com")
- `VITE_PORT` - Port for the development server (defaults to 3000)

For development, you can create a `.env.local` file to override these variables.

## Deployment

The application can be deployed to various platforms:

- **Vercel**: `npm run deploy:vercel`
- **Netlify**: `npm run deploy:netlify`
- **Render**: Configure using `render.yaml`

## Troubleshooting

If you encounter issues:

1. Check backend connectivity using the testing tools
2. Enable the mock API if the backend is unavailable
3. Check environment variables for correct configuration
4. Check browser console for error messages
5. Use the CORS checker to diagnose CORS issues 