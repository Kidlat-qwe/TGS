// Firebase configuration
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import dotenv from 'dotenv';

dotenv.config();

// For debugging, let's log the config values
console.log('Firebase Config:', {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID
});

const firebaseConfig = {
  apiKey: "AIzaSyDTh3Fbkwh8btz9I5G1l7GaItYYTZJLgMo",
  authDomain: "token-9b7f3.firebaseapp.com",
  projectId: "token-9b7f3",
  storageBucket: "token-9b7f3.appspot.com",
  messagingSenderId: "644079800512",
  appId: "1:644079800512:web:bac21852221e668bcd9d25"
};

console.log('Initializing Firebase with project:', firebaseConfig.projectId);

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log('Firebase initialized successfully');

export { auth, db }; 