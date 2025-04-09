import { auth } from '../../config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, deleteUser as firebaseDeleteUser } from 'firebase/auth';
import { sendApprovalEmail } from './email-service.js';
import { evaluationPool, gradePool } from '../../server.js';
import { collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../config.js';

// Function to approve a user and create their account
export const approveUser = async (pendingUser, accessType = 'unlimited', systemAccess = 'both') => {
  try {
    console.log(`Approving user ${pendingUser.email} with access type: ${accessType}, system access: ${systemAccess}`);
    
    // Get the user email and password from pending user data
    const userEmail = pendingUser.email;
    const userPassword = pendingUser.password || 'password123'; // Fallback if no password stored
    
    // Calculate expiration date if it's a trial
    let expiresAt = null;
    let trialDays = 0;
    
    // Handle different trial durations
    if (accessType.startsWith('trial-')) {
      // Extract the number of days from the accessType 
      // (e.g., 'trial-1d' => 1, 'trial-3d' => 3, 'trial-7d' => 7)
      const daysMatch = accessType.match(/trial-(\d+)d/);
      if (daysMatch && daysMatch[1]) {
        trialDays = parseInt(daysMatch[1], 10);
      } else {
        // Default to 7 days if the format is unexpected
        trialDays = 7;
      }
      
      // Set expiration date to the specified days from now
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + trialDays);
      expiresAt = expirationDate.toISOString();
      console.log(`User ${userEmail} will have access until ${expiresAt} (${trialDays}-day trial)`);
      
      // Normalize accessType to just 'trial' for storage
      accessType = 'trial';
    }
    
    try {
      // Attempt to create Firebase Auth user
      console.log(`Creating Firebase Auth user for ${userEmail}`);
      const userCredential = await createUserWithEmailAndPassword(auth, userEmail, userPassword);
      const user = userCredential.user;
      
      console.log(`Successfully created Firebase Auth user: ${user.uid}`);
      
      // Update the pending user record
      pendingUser.status = 'approved';
      pendingUser.approvedAt = new Date().toISOString();
      pendingUser.uid = user.uid;
      pendingUser.accessType = accessType;
      pendingUser.systemAccess = systemAccess;
      if (expiresAt) {
        pendingUser.expiresAt = expiresAt;
      }
      
      // Add to approved users list for tracking
      if (!global.approvedUsers) {
        global.approvedUsers = [];
      }
      
      // Check if user already exists in approved users
      const existingApprovedUser = global.approvedUsers.find(u => u.email === userEmail);
      
      if (!existingApprovedUser) {
        // Add new approved user
        global.approvedUsers.push({
          email: userEmail,
          password: userPassword,
          role: 'user',
          uid: user.uid,
          approvedAt: new Date().toISOString(),
          accessType: accessType,
          systemAccess: systemAccess,
          expiresAt: expiresAt
        });
        
        console.log(`Added ${userEmail} to approved users list`);
      } else {
        // Update existing approved user
        existingApprovedUser.uid = user.uid;
        existingApprovedUser.approvedAt = new Date().toISOString();
        existingApprovedUser.accessType = accessType;
        existingApprovedUser.systemAccess = systemAccess;
        existingApprovedUser.expiresAt = expiresAt;
        console.log(`Updated existing approved user: ${userEmail}`);
      }
      
      // Save changes to persistent storage
      global.savePersistentData();
      
      // Send approval email notification
      try {
        console.log(`Sending approval email to ${userEmail}`);
        const emailResult = await sendApprovalEmail({
          email: userEmail,
          accessType,
          systemAccess,
          expiresAt
        });
        
        if (emailResult.success) {
          console.log(`Approval email sent successfully to ${userEmail}`);
          pendingUser.emailSent = true;
          pendingUser.emailSentAt = new Date().toISOString();
        } else {
          console.error(`Failed to send approval email to ${userEmail}:`, emailResult.error);
          pendingUser.emailSent = false;
          pendingUser.emailError = emailResult.error;
        }
        
        // Update persistent storage with email status
        global.savePersistentData();
      } catch (emailError) {
        console.error(`Error sending approval email to ${userEmail}:`, emailError);
        pendingUser.emailSent = false;
        pendingUser.emailError = emailError.message;
        
        // Still save the persistent data even if email fails
        global.savePersistentData();
      }
      
      return {
        success: true,
        uid: user.uid,
        emailSent: pendingUser.emailSent || false
      };
    } catch (authError) {
      console.error('Firebase Auth error:', authError.code, authError.message);
      
      // Special handling if user already exists
      if (authError.code === 'auth/email-already-in-use') {
        console.log(`User ${userEmail} already exists in Firebase Auth`);
        
        // Update the pending user record anyway
        pendingUser.status = 'approved';
        pendingUser.approvedAt = new Date().toISOString();
        pendingUser.note = 'User account already exists';
        pendingUser.accessType = accessType;
        pendingUser.systemAccess = systemAccess;
        if (expiresAt) {
          pendingUser.expiresAt = expiresAt;
        }
        
        // Add to approved users list if not already there
        if (!global.approvedUsers) {
          global.approvedUsers = [];
        }
        
        if (!global.approvedUsers.find(u => u.email === userEmail)) {
          global.approvedUsers.push({
            email: userEmail,
            password: userPassword,
            role: 'user',
            approvedAt: new Date().toISOString(),
            accessType: accessType,
            systemAccess: systemAccess,
            expiresAt: expiresAt,
            note: 'Approved without Firebase Auth creation'
          });
        } else {
          // Update existing user with new access type
          const existingUser = global.approvedUsers.find(u => u.email === userEmail);
          existingUser.accessType = accessType;
          existingUser.systemAccess = systemAccess;
          existingUser.expiresAt = expiresAt;
          existingUser.approvedAt = new Date().toISOString();
        }
        
        // Save changes to persistent storage
        global.savePersistentData();
        
        // Send approval email notification
        try {
          console.log(`Sending approval email to existing user ${userEmail}`);
          const emailResult = await sendApprovalEmail({
            email: userEmail,
            accessType,
            systemAccess,
            expiresAt
          });
          
          if (emailResult.success) {
            console.log(`Approval email sent successfully to existing user ${userEmail}`);
            pendingUser.emailSent = true;
            pendingUser.emailSentAt = new Date().toISOString();
          } else {
            console.error(`Failed to send approval email to existing user ${userEmail}:`, emailResult.error);
            pendingUser.emailSent = false;
            pendingUser.emailError = emailResult.error;
          }
          
          // Update persistent storage with email status
          global.savePersistentData();
        } catch (emailError) {
          console.error(`Error sending approval email to existing user ${userEmail}:`, emailError);
          pendingUser.emailSent = false;
          pendingUser.emailError = emailError.message;
          
          // Still save the persistent data even if email fails
          global.savePersistentData();
        }
        
        return {
          success: true,
          note: 'User account already exists',
          emailSent: pendingUser.emailSent || false
        };
      }
      
      // For other errors, update status but add error note
      pendingUser.status = 'approved';
      pendingUser.approvedAt = new Date().toISOString();
      pendingUser.error = authError.message;
      pendingUser.accessType = accessType;
      pendingUser.systemAccess = systemAccess;
      if (expiresAt) {
        pendingUser.expiresAt = expiresAt;
      }
      
      // Add to approved users list anyway for fallback login
      if (!global.approvedUsers) {
        global.approvedUsers = [];
      }
      
      global.approvedUsers.push({
        email: userEmail,
        password: userPassword,
        role: 'user',
        approvedAt: new Date().toISOString(),
        accessType: accessType,
        systemAccess: systemAccess,
        expiresAt: expiresAt,
        error: authError.message
      });
      
      // Save changes to persistent storage
      global.savePersistentData();
      
      // Send approval email notification even if there was an auth error
      try {
        console.log(`Sending approval email to user ${userEmail} despite auth error`);
        const emailResult = await sendApprovalEmail({
          email: userEmail,
          accessType,
          systemAccess,
          expiresAt
        });
        
        if (emailResult.success) {
          console.log(`Approval email sent successfully to user ${userEmail} despite auth error`);
          pendingUser.emailSent = true;
          pendingUser.emailSentAt = new Date().toISOString();
        } else {
          console.error(`Failed to send approval email to user ${userEmail} despite auth error:`, emailResult.error);
          pendingUser.emailSent = false;
          pendingUser.emailError = emailResult.error;
        }
        
        // Update persistent storage with email status
        global.savePersistentData();
      } catch (emailError) {
        console.error(`Error sending approval email to user ${userEmail} despite auth error:`, emailError);
        pendingUser.emailSent = false;
        pendingUser.emailError = emailError.message;
        
        // Still save the persistent data even if email fails
        global.savePersistentData();
      }
      
      return {
        success: false,
        error: authError.message,
        emailSent: pendingUser.emailSent || false
      };
    }
  } catch (error) {
    console.error('Error in approveUser:', error);
    return {
      success: false,
      error: error.message,
      emailSent: false
    };
  }
};

// Function to delete a user account
export const deleteUserAccount = async (userToDelete) => {
  try {
    console.log(`Attempting to delete user ${userToDelete.email}`);
    
    // First check if this user has a Firebase account
    let userDeleted = false;
    let tokensDeleted = false;
    let allDataDeleted = false;
    
    if (userToDelete.uid) {
      try {
        console.log(`User has a Firebase account, attempting to delete from Firebase Auth`);
        
        // Since we don't have full Firebase Admin SDK, we'll try to use the regular Firebase Auth SDK
        try {
          // Sign in as admin to perform administrative operations
          const adminEmail = 'admin@gmail.com';
          const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
          
          console.log('Signing in as admin to delete user...');
          await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          
          // Now try to delete user from Firebase Auth
          console.log(`Attempting to delete user ${userToDelete.email} with UID ${userToDelete.uid} from Firebase`);
          
          try {
            // In a regular Firebase setup, we need to delete our own account
            // But we can't delete another user's account with the client SDK
            
            // Try to sign in as the user to be deleted
            console.log(`Signing in as ${userToDelete.email} to delete their account`);
            const userPassword = userToDelete.password || 'password123'; // Use saved password if available
            
            // Sign out of admin account first
            await signOut(auth);
            
            // Sign in as user to be deleted
            const userCredential = await signInWithEmailAndPassword(auth, userToDelete.email, userPassword);
            const user = userCredential.user;
            
            // Delete the user account from Firebase
            await firebaseDeleteUser(user);
            
            console.log(`Successfully deleted Firebase account for ${userToDelete.email}`);
            userDeleted = true;
            
            // Sign out after deletion
            // Note: This will throw an error since account is deleted, which is expected
            try {
              await signOut(auth);
            } catch (signOutError) {
              console.log('Expected error during sign out after deletion');
            }
            
            // Sign back in as admin
            await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
          } catch (userAuthError) {
            console.error('Error authenticating as user to delete:', userAuthError);
            console.log('User will be removed from local system only');
            
            // Make sure we're signed back in as admin
            try {
              await signOut(auth);
              await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
            } catch (authError) {
              console.error('Error signing back in as admin:', authError);
            }
          }
        } catch (adminAuthError) {
          console.error('Admin authentication failed:', adminAuthError);
          console.log('User will be removed from local system only');
        }
      } catch (firebaseDeleteError) {
        console.error('Error deleting user from Firebase:', firebaseDeleteError);
        console.log('User will be removed from local system only');
      }
    } else {
      console.log(`User ${userToDelete.email} has no Firebase account associated`);
    }
    
    // Delete all tokens created by this user from Firestore
    try {
      console.log(`Deleting tokens created by ${userToDelete.email} from Firestore`);
      
      // Get reference to the tokens collection
      const tokenRef = collection(db, 'api-tokens');
      
      // Create a query to find all tokens created by this user
      const q = query(tokenRef, where("createdBy", "==", userToDelete.email));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = [];
      querySnapshot.forEach((doc) => {
        console.log(`Deleting token with ID: ${doc.id}`);
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`Successfully deleted ${deletePromises.length} tokens for user ${userToDelete.email}`);
        tokensDeleted = true;
      } else {
        console.log(`No tokens found for user ${userToDelete.email}`);
        tokensDeleted = true; // Mark as true since there's nothing to delete
      }
    } catch (tokenDeleteError) {
      console.error('Error deleting user tokens from Firestore:', tokenDeleteError);
      console.log('Tokens may need manual cleanup');
    }
    
    // Delete user data from Firestore 'pending-users' collection
    try {
      console.log(`Checking for user data in 'pending-users' collection for ${userToDelete.email}`);
      
      // Get reference to the pending-users collection
      const pendingUsersRef = collection(db, 'pending-users');
      
      // Create a query to find documents with this email
      const q = query(pendingUsersRef, where("email", "==", userToDelete.email));
      const querySnapshot = await getDocs(q);
      
      const deletePromises = [];
      querySnapshot.forEach((doc) => {
        console.log(`Deleting pending user document with ID: ${doc.id}`);
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      if (deletePromises.length > 0) {
        await Promise.all(deletePromises);
        console.log(`Successfully deleted ${deletePromises.length} pending user documents for ${userToDelete.email}`);
      } else {
        console.log(`No pending user documents found for ${userToDelete.email}`);
      }
      
      allDataDeleted = true;
    } catch (firestoreDeleteError) {
      console.error('Error deleting user data from Firestore:', firestoreDeleteError);
      console.log('User data may need manual cleanup in Firestore');
    }
    
    // Always remove from our system even if Firebase deletion fails
    console.log(`Removing user ${userToDelete.email} from local system`);
    
    return {
      success: true,
      firebaseDeleted: userDeleted,
      tokensDeleted: tokensDeleted,
      allDataDeleted: allDataDeleted,
      message: userDeleted && tokensDeleted && allDataDeleted
        ? 'User and all associated data completely deleted from the system'
        : 'User removed from system; some data may require manual cleanup in Firebase Console'
    };
  } catch (error) {
    console.error('Error in deleteUserAccount function:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// New function to disable a user account
export const disableUserAccount = async (userToDisable) => {
  try {
    console.log(`Disabling user account for ${userToDisable.email}`);
    
    // Update the user status in the pending users list
    if (global.mockPendingUsers) {
      const pendingUser = global.mockPendingUsers.find(user => user.id === userToDisable.id);
      if (pendingUser) {
        pendingUser.isDisabled = true;
        pendingUser.disabledAt = new Date().toISOString();
      }
    }
    
    // Update the user status in the approved users list
    if (global.approvedUsers) {
      const approvedUser = global.approvedUsers.find(user => user.email === userToDisable.email);
      if (approvedUser) {
        approvedUser.isDisabled = true;
        approvedUser.disabledAt = new Date().toISOString();
      }
    }
    
    // Save changes to persistent storage
    global.savePersistentData();
    
    return {
      success: true,
      message: `User account for ${userToDisable.email} has been disabled`
    };
  } catch (error) {
    console.error(`Error disabling user account for ${userToDisable.email}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to disable user account'
    };
  }
};

// New function to enable a previously disabled user account
export const enableUserAccount = async (userToEnable) => {
  try {
    console.log(`Enabling user account for ${userToEnable.email}`);
    
    // Update the user status in the pending users list
    if (global.mockPendingUsers) {
      const pendingUser = global.mockPendingUsers.find(user => user.id === userToEnable.id);
      if (pendingUser) {
        pendingUser.isDisabled = false;
        pendingUser.disabledAt = null;
        pendingUser.enabledAt = new Date().toISOString();
      }
    }
    
    // Update the user status in the approved users list
    if (global.approvedUsers) {
      const approvedUser = global.approvedUsers.find(user => user.email === userToEnable.email);
      if (approvedUser) {
        approvedUser.isDisabled = false;
        approvedUser.disabledAt = null;
        approvedUser.enabledAt = new Date().toISOString();
      }
    }
    
    // Save changes to persistent storage
    global.savePersistentData();
    
    return {
      success: true,
      message: `User account for ${userToEnable.email} has been enabled`
    };
  } catch (error) {
    console.error(`Error enabling user account for ${userToEnable.email}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to enable user account'
    };
  }
}; 