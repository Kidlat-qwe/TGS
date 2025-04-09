# Token Generating System

A system for generating and validating JWT tokens for authentication across multiple services.

## Project Structure

The project is now organized into two main directories:

- **frontend/** - Contains the React frontend application
- **backend/** - Contains the Node.js/Express backend application, including:
  - **Token-System/** - Token generation and management
  - **Evaluation-System/** - External evaluation system
  - **Grading-System/** - External grading system

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd token-system
```

2. Install dependencies for both frontend and backend:
```bash
npm run install:all
```

3. Set up environment variables:
- Copy `.env.example` to `.env` if it doesn't exist
- Update the values as needed

## Running the Application

### Development Mode

To run both frontend and backend in development mode:

```bash
npm run dev
```

To run only the frontend:

```bash
npm run start:frontend
```

To run only the backend:

```bash
npm run start:backend
```

### Production Mode

To build the frontend and run the application in production mode:

```bash
npm run build
npm start
```

## Authentication System

The Token Generating System (TGS) creates JWT tokens that can be used for authentication in both the Evaluation and Grading systems.

### Token Flow

1. Generate a token from the TGS with a specific system target (evaluation or grading)
2. Use the token in the Authorization header when making requests to the target system
3. The target system validates the token using the shared JWT secret

For detailed information on troubleshooting token authentication, see `backend/tools/README.md`.

## Environment Variables

The system uses several environment variables:

- `JWT_SECRET` - Shared JWT secret used across all systems
- `PORT` - Port for the backend server
- Various database and service configurations for each system

### Important Notes

1. All systems must use the same `JWT_SECRET` to properly validate tokens
2. Tokens are system-specific and must include the correct `system` field
3. The token format for API requests should be `Authorization: Bearer <token>`

For detailed deployment instructions, see `REPLIT_DEPLOYMENT.md`.

## Replit Deployment Information

This project has been prepared for deployment on Replit. For detailed deployment instructions, please refer to the [REPLIT_DEPLOYMENT.md](./REPLIT_DEPLOYMENT.md) file.

### Key Changes for Replit Compatibility

1. **Dynamic API Endpoints**: All API endpoints now use relative paths or environment variables instead of hardcoded URLs.
2. **CORS Configuration**: The backend now accepts requests from Replit domains.
3. **Proxy Configuration**: Vite is configured to proxy API requests to the backend.
4. **Environment Variables**: Environment-specific variables are separated for development and production.
5. **Start Scripts**: Custom start scripts have been created for Replit's environment.

To deploy this project on Replit:
1. Create a new Replit project by importing this repository
2. Configure all necessary environment variables in Replit Secrets
3. Run the application using `npm run replit`

For any issues during deployment, check the troubleshooting section in the deployment guide.

A comprehensive system for generating tokens, managing users, and sending notifications.

## Features

- User authentication and authorization
- Token generation and management
- Email notifications for user approvals
- Administrator dashboard for user management

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL database

### Installation

1. Clone the repository
2. Install dependencies for both frontend and backend:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
cd ..
```

3. Set up environment variables by copying the example .env file and configuring it:

```bash
cp .env.example .env
```

4. Start the development servers:

```bash
# Start the backend server (in one terminal)
cd backend
npm run dev

# Start the frontend (in another terminal)
npm run dev
```

## Email Configuration

The application uses Nodemailer to send email notifications for user approvals. To enable this functionality:

1. Configure your SMTP settings in the `.env` file:

```
# SMTP Configuration for Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

2. For Gmail users:
   - You'll need to generate an App Password instead of using your regular password
   - Go to your Google Account > Security > 2-Step Verification > App passwords
   - Generate a new app password for "Mail" and use it as your SMTP_PASS

3. If SMTP is not configured, the system will log email content to the console for development purposes.

## Firebase Configuration

The system uses Firebase for user authentication. You'll need to set up a Firebase project and configure your credentials in the `.env` file:

```
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
```

## Development Notes

- The frontend is built with React and Vite
- The backend is built with Express.js
- User authentication is handled through Firebase Auth
- Email notifications are sent using Nodemailer with SMTP
- If email sending fails, the system will retry at the next opportunity
