#!/bin/bash

# This script handles starting the app in Replit
# It can run in both production (default) and development modes

# Check if the script is called with "dev" argument
if [ "$1" == "dev" ]; then
  echo "Starting in development mode..."
  MODE="development"
else
  echo "Starting in production mode..."
  MODE="production"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ] || [ ! -d "frontend/node_modules" ] || [ ! -d "backend/node_modules" ]; then
  echo "Installing dependencies..."
  npm run install:all
fi

# Build frontend if in production mode
if [ "$MODE" == "production" ]; then
  echo "Building frontend..."
  npm run build:frontend
fi

# Start the application
if [ "$MODE" == "development" ]; then
  echo "Starting development servers..."
  npm run dev
else
  echo "Starting production server..."
  npm start
fi 