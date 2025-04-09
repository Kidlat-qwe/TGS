# Firebase Configuration Guide

This guide explains how to configure Firebase for the Token Management System to work correctly, particularly for the user registration feature.

## Current Issue: Permission Denied

If you are seeing a "permission-denied" error when trying to sign up, it means the Firebase security rules need to be updated. By default, Firebase restricts access to collections unless explicitly allowed in the security rules.

## How to Fix Firebase Security Rules

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Select your project (`token-9b7f3`)
3. From the left navigation menu, click on **Firestore Database**
4. Click on the **Rules** tab
5. Copy and paste the following rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Only allow authenticated access by default
      allow read, write: if request.auth != null;
    }
    
    // Special rule for pending users collection to allow unauthenticated creation
    match /pending-users/{userId} {
      // Allow creation without authentication for signup
      allow create: if true;
      // But keep read operations secured
      allow read: if request.auth != null;
    }
  }
}
```

6. Click **Publish** to update the rules

## Explanation of the Rules

- The first rule (`match /{document=**}`) restricts all collections to authenticated users only by default
- The second rule allows anyone to create documents in the `pending-users` collection, which is necessary for the signup process
- Reading from the `pending-users` collection still requires authentication to protect user data

## Additional Firebase Configuration

If you're setting up the project from scratch, here are additional steps:

1. **Enable Authentication**: In Firebase Console, go to Authentication and enable Email/Password authentication method

2. **Initialize Firestore**: Make sure Firestore Database is enabled and initialized

3. **Environment Variables**: Set up these environment variables in your backend `.env` file:
   ```
   FIREBASE_API_KEY=AIzaSyDTh3Fbkwh8btz9I5G1l7GaItYYTZJLgMo
   FIREBASE_AUTH_DOMAIN=token-9b7f3.firebaseapp.com
   FIREBASE_PROJECT_ID=token-9b7f3
   JWT_SECRET=your-secret-key-here
   ```

## Testing Your Configuration

After updating the rules, try the following:

1. Restart your backend server
2. Try signing up with a test email and password
3. If successful, you should see a message that the registration request is pending approval

## Troubleshooting

- **Rules not updating**: Sometimes there might be a delay after publishing rules. Wait a few minutes and try again.
- **Still getting permission errors**: Make sure your Firebase project ID matches exactly what's in your configuration.
- **Authentication errors**: Double-check that Email/Password authentication is enabled in the Firebase console.

## Using Manual Registration for Now

Until the Firebase rules are properly configured, you can use the "Submit Registration Request Manually" button in the signup form. This will bypass the Firebase database write operation but still provide a good user experience. 