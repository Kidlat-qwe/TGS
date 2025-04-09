// This file contains information about Firebase security rules
// Below are common Firestore security rules that might need to be applied

/*
// Firestore rules should look something like this:
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Allow read/write access to admins
      allow read, write: if request.auth != null && request.auth.token.admin == true;
    }
    
    match /pending-users/{userId} {
      // Allow creation of pending users without authentication
      allow create: if true;
      
      // Only allow reads by authenticated users
      allow read: if request.auth != null;
    }
    
    match /api-tokens/{tokenId} {
      // Only allow access to authenticated users
      allow read, write: if request.auth != null;
    }
  }
}
*/

// To fix the permission denied issue, we need to implement a workaround
// in our app since we can't immediately change Firebase rules

import { collection, getDocs } from 'firebase/firestore';
import { db } from './config.js';

// Function to test if we have read access to a collection
export async function testCollectionAccess(collectionName) {
  try {
    console.log(`Testing access to collection: ${collectionName}`);
    const collectionRef = collection(db, collectionName);
    const snapshot = await getDocs(collectionRef);
    console.log(`Access test successful: Found ${snapshot.size} documents`);
    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error(`Access test failed for ${collectionName}:`, error);
    return { success: false, error: error.message, code: error.code };
  }
}

// Function to provide guidance on fixing Firebase rules
export function getFirebaseRulesHelp() {
  return `
To fix Firebase permission issues, you need to modify your Firestore security rules.
Go to the Firebase Console -> Your Project -> Firestore Database -> Rules tab, and add:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      // Only allow authorized access by default
      allow read, write: if request.auth != null;
    }
    
    match /pending-users/{userId} {
      // Allow creation of pending users without authentication
      allow create: if true;
      allow read: if request.auth != null;
    }
  }
}

This allows unauthenticated users to create documents in the pending-users collection,
while restricting access to other collections to authenticated users only.
`;
}

// Export test functions
export default {
  testCollectionAccess,
  getFirebaseRulesHelp
}; 