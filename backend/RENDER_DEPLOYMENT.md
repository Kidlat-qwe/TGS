# Render Deployment Guide for Evaluation System

This guide provides step-by-step instructions for deploying the Evaluation System to Render.

## Prerequisites

- A [Render](https://render.com) account
- Your code pushed to a Git repository (GitHub, GitLab, or Bitbucket)
- A PostgreSQL database (you can use Render's managed PostgreSQL service)

## Setting Up a Web Service

1. Log in to your Render dashboard
2. Click the "New +" button and select "Web Service"
3. Connect your Git repository
4. Configure your web service with the following settings:

   - **Name**: `evaluation-system` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose the region closest to your users
   - **Branch**: `main` (or your deployment branch)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `node backend/check-render-env.js && node build/server.js`
   - **Plan**: Select an appropriate plan based on your needs

## Environment Variables

The application requires several environment variables to function correctly. Set the following in the Render dashboard under the "Environment" section of your web service:

### Required Variables

#### Database Configuration

Either set the connection string:

- `DATABASE_URL`: Full PostgreSQL connection string (e.g., `postgres://username:password@host:port/database`)

OR set individual credentials:

- `PGUSER`: PostgreSQL username
- `PGPASSWORD`: PostgreSQL password
- `PGHOST`: PostgreSQL host
- `PGDATABASE`: PostgreSQL database name
- `PGPORT`: PostgreSQL port (default: 5432)
- `PGSSL`: Set to `true` for SSL connections (recommended for production)

#### JWT Authentication

- `JWT_SECRET`: A strong secret key for JWT token generation
- `JWT_EXPIRES_IN`: Token expiration time (e.g., `7d` for 7 days)

#### System Configuration

- `NODE_ENV`: Set to `production` for deployment
- `PORT`: Port for the server (Render will set this automatically)
- `FRONTEND_URL`: URL of your frontend application
- `TOKEN_SYSTEM_URL`: URL of the Token System service
- `EVALUATION_SYSTEM_URL`: URL of the Evaluation System service (this service)
- `GRADING_SYSTEM_URL`: URL of the Grading System service

### Optional Variables

- `LOG_LEVEL`: Sets the logging level (`error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`)
- `MAX_REQUEST_SIZE`: Maximum request size in bytes (default: `1mb`)
- `RATE_LIMIT_WINDOW_MS`: Rate limiting window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window

## Setting Up a PostgreSQL Database

1. In your Render dashboard, click "New +" and select "PostgreSQL"
2. Configure your database:
   - **Name**: `evaluation-db` (or your preferred name)
   - **Database**: Choose a name for your database
   - **User**: Create a database user
   - **Region**: Choose the same region as your web service
   - **Plan**: Select an appropriate plan

3. After creation, copy the "Internal Database URL" from the database settings
4. Set this as the `DATABASE_URL` environment variable in your web service

## Health Checks and Monitoring

Render automatically performs health checks on your service. The Evaluation System provides a health endpoint at `/api/health` that you can configure in your Render dashboard:

1. Go to your web service settings
2. Under "Health Check Path", enter `/api/health`
3. Save the changes

## Auto-Deploy Configuration

By default, Render will automatically deploy your service when changes are pushed to your configured branch. To disable this:

1. Go to your web service settings
2. Under "Auto-Deploy", toggle off "Deploy automatically"

## Troubleshooting

If your deployment fails, check the following:

1. **Environment Variables**: Ensure all required environment variables are correctly set
2. **Logs**: Check the logs in the Render dashboard for error messages
3. **Environment Check Script**: The `check-render-env.js` script will report any missing environment variables
4. **Database Connection**: Verify your database credentials and connection string
5. **Permissions**: Ensure your database user has appropriate permissions

If the issue persists, refer to the [Render Documentation](https://render.com/docs) or contact Render support.

## Security Considerations

- Always use environment variables for sensitive information, never hardcode them
- Use SSL for database connections in production
- Set appropriate CORS settings in your application
- Consider using Render's IP allowlisting for database access
- Enable automated backups for your database

## Custom Domains and HTTPS

Render provides free SSL certificates and custom domain support:

1. Go to your web service settings
2. Under "Custom Domain", click "Add Custom Domain"
3. Follow the instructions to configure your domain

## Scaling

To scale your application on Render:

1. Go to your web service settings
2. Under "Scaling", adjust the number of instances
3. Consider using a higher plan for more resources

## Monitoring and Logging

Render provides built-in monitoring and logging:

1. Go to your web service dashboard
2. Click on "Metrics" to view performance metrics
3. Click on "Logs" to view application logs

For more advanced monitoring, consider integrating with a third-party service like New Relic or Datadog.

# Render Deployment Guide

This guide explains how to set up and deploy your application on Render.com, with specific focus on managing environment variables.

## Setting Up Environment Variables on Render

When deploying to Render, you'll need to configure your environment variables through the Render dashboard instead of using a local `.env` file.

### Required Environment Variables

The following environment variables must be set in your Render service:

#### Database Configuration
You have two options for database configuration:

**Option 1**: Use Render's PostgreSQL service and connect with `DATABASE_URL` (recommended)
```
DATABASE_URL=postgres://username:password@host:port/database
```

**Option 2**: Configure individual PostgreSQL parameters
```
PGUSER=your_database_user
PGPASSWORD=your_database_password
PGHOST=your_database_host
PGDATABASE=your_database_name
PGPORT=5432
PGSSL=true
```

#### JWT Authentication
```
JWT_SECRET=your-strong-secret-key-at-least-16-chars
JWT_EXPIRES_IN=7d
```

#### System Configuration
```
NODE_ENV=production
PORT=10000  # Render will override this with its internal port
```

#### Optional Configuration
```
FRONTEND_URL=https://your-frontend-url.com
LOG_LEVEL=info
```

### Steps to Configure on Render

1. Navigate to your service on the Render dashboard
2. Click on "Environment" in the left sidebar
3. Add each environment variable as a key-value pair
4. Click "Save Changes" after adding all variables

### Security Best Practices

- Use a strong, unique `JWT_SECRET` for each environment
- Never commit `.env` files to your repository
- Use the PostgreSQL connection string provided by Render if using their database service
- For sensitive variables, consider using Render's secret environment variables feature

### Health Checks

The `check-env.js` script will verify that all required environment variables are set before your application starts. If any are missing, the application will exit with an error code.

You can add this to your startup script in the Render dashboard:

```
node backend/check-env.js && node server.js
```

## Troubleshooting

If your application fails to start on Render, check the following:

1. Verify all required environment variables are set
2. Check for correct database connection details
3. Ensure your `JWT_SECRET` is set and secure
4. Check if your application is listening on the port provided by Render (via `PORT`)

If issues persist, refer to the Render logs for detailed error information.

## Local Development

For local development:

1. Run `node backend/generate-env-template.js` to create a `.env.template` file
2. Copy `.env.template` to `.env` and update the values
3. Use `node backend/check-env.js` to verify your local environment configuration 