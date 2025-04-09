import express from "express";
import { verifyAdmin } from "../Middlewares/auth.js";
import {
  approveUser,
  deleteUserAccount,
  disableUserAccount,
  enableUserAccount,
} from "../Utils/user-management.js";
import { resendApprovalEmail } from "../Utils/email-service.js";

const router = express.Router();

// Authenticated endpoint to get pending users
router.get("/", verifyAdmin, (req, res) => {
  try {
    // Ensure we're working with the latest data
    global.loadPersistentData();

    // Check if mockPendingUsers exists, initialize if not
    if (!global.mockPendingUsers) {
      global.mockPendingUsers = [];
      console.log("Initialized empty mockPendingUsers array");
    }

    // Filter out any invalid entries that might have crept in
    const validUsers = global.mockPendingUsers.filter(
      (user) => user && user.id && user.email && user.status,
    );

    // If we filtered some invalid users, update the global array and save
    if (validUsers.length !== global.mockPendingUsers.length) {
      console.log(
        `Filtered out ${global.mockPendingUsers.length - validUsers.length} invalid user entries`,
      );
      global.mockPendingUsers = validUsers;
      global.savePersistentData();
    }

    console.log(`Returning ${global.mockPendingUsers.length} pending users`);
    return res.json(global.mockPendingUsers);
  } catch (error) {
    console.error("Error fetching pending users:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// New endpoint to approve or reject a user registration
router.post("/:id/process", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { action, reason, accessType, systemAccess } = req.body;

    if (!id || !action) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (action !== "approve" && action !== "reject" && action !== "delete") {
      return res.status(400).json({ error: "Invalid action" });
    }

    // For mock data
    const mockUser = global.mockPendingUsers?.find((user) => user.id === id);

    if (mockUser) {
      console.log(`Processing user ${mockUser.email} with action: ${action}`);

      if (action === "approve") {
        // Set access type (default to unlimited if not specified)
        const userAccessType = accessType || "unlimited";
        const userSystemAccess = systemAccess || "both";

        console.log(
          `Setting access type: ${userAccessType} for user ${mockUser.email}`,
        );
        console.log(
          `Setting system access: ${userSystemAccess} for user ${mockUser.email}`,
        );

        // Use our enhanced function to approve user
        const result = await approveUser(
          mockUser,
          userAccessType,
          userSystemAccess,
        );

        if (result.success) {
          console.log(`Successfully approved user ${mockUser.email}`);
          return res.json({
            message: `User approved successfully`,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              status: mockUser.status,
              accessType: mockUser.accessType,
              systemAccess: mockUser.systemAccess,
              expiresAt: mockUser.expiresAt,
              emailSent: result.emailSent || mockUser.emailSent || false,
              emailSentAt: mockUser.emailSentAt,
              emailError: mockUser.emailError,
              note: result.note,
            },
          });
        } else {
          console.log(
            `Approved user ${mockUser.email} with fallback login due to: ${result.error}`,
          );
          return res.json({
            message: `User approved with fallback login`,
            warning: result.error,
            user: {
              id: mockUser.id,
              email: mockUser.email,
              status: mockUser.status,
              accessType: mockUser.accessType,
              systemAccess: mockUser.systemAccess,
              expiresAt: mockUser.expiresAt,
              emailSent: result.emailSent || mockUser.emailSent || false,
              emailSentAt: mockUser.emailSentAt,
              emailError: mockUser.emailError,
            },
          });
        }
      } else if (action === "reject") {
        // Handle rejection
        mockUser.status = "rejected";
        mockUser.rejectedAt = new Date().toISOString();
        mockUser.rejectedBy = req.user.email;
        if (reason) mockUser.reason = reason;

        // Save to persistent storage
        global.savePersistentData();

        return res.json({
          message: `User rejected successfully`,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            status: mockUser.status,
          },
        });
      } else if (action === "delete") {
        // Handle deletion
        const result = await deleteUserAccount(mockUser);

        if (result.success) {
          console.log(`Successfully deleted user ${mockUser.email}`);

          // Remove from mock pending users list
          const userIndex = global.mockPendingUsers.findIndex(
            (user) => user.id === id,
          );
          if (userIndex !== -1) {
            console.log(
              `Removing user from mockPendingUsers at index ${userIndex}`,
            );
            global.mockPendingUsers.splice(userIndex, 1);
          } else {
            console.log(`User ${mockUser.email} not found in mockPendingUsers`);
          }

          // Remove from approved users list if present
          const approvedIndex = global.approvedUsers
            ? global.approvedUsers.findIndex(
                (user) => user.email === mockUser.email,
              )
            : -1;
          if (approvedIndex !== -1) {
            console.log(
              `Removing user from approvedUsers at index ${approvedIndex}`,
            );
            global.approvedUsers.splice(approvedIndex, 1);
          }

          // Save changes to persistent storage
          global.savePersistentData();
          console.log("Persistent data saved after user deletion");

          // Log the state of mockPendingUsers after deletion
          console.log(
            `mockPendingUsers count after deletion: ${global.mockPendingUsers.length}`,
          );

          return res.json({
            message: `User deleted successfully`,
            details: {
              firebaseAccountDeleted: result.firebaseDeleted,
              tokensDeleted: result.tokensDeleted,
              allDataDeleted: result.allDataDeleted,
              message: result.message,
            },
            user: {
              id: mockUser.id,
              email: mockUser.email,
            },
          });
        } else {
          return res.status(500).json({
            error: "Failed to delete user",
            message: result.error,
          });
        }
      }
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error processing pending user:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// New endpoint to edit user access settings
router.post("/:id/edit", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    let { accessType, systemAccess } = req.body;

    console.log(`Edit request received for user ${id}:`, {
      accessType,
      systemAccess,
    });

    if (!id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Initialize if needed
    if (!global.mockPendingUsers) {
      global.mockPendingUsers = [];
    }

    // Find the user in pending users
    const pendingUser = global.mockPendingUsers.find((user) => user.id === id);

    if (!pendingUser) {
      console.log(`User with ID ${id} not found`);
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`Found user:`, {
      email: pendingUser.email,
      status: pendingUser.status,
    });

    if (pendingUser.status !== "approved") {
      return res.status(400).json({ error: "Can only edit approved users" });
    }

    console.log(
      `Editing user ${pendingUser.email} - changing access type to: ${accessType}, system access to: ${systemAccess}`,
    );

    // Calculate expiration date if changing to a trial
    let expiresAt = null;
    if (accessType && accessType.startsWith("trial-")) {
      try {
        // Extract the number of days from the accessType
        // (e.g., 'trial-1d' => 1, 'trial-3d' => 3, 'trial-7d' => 7)
        const daysMatch = accessType.match(/trial-(\d+)d/);
        let trialDays = 7; // Default to 7 days

        if (daysMatch && daysMatch[1]) {
          trialDays = parseInt(daysMatch[1], 10);
        }

        // Set expiration date to the specified days from now
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + trialDays);
        expiresAt = expirationDate.toISOString();
        console.log(
          `User ${pendingUser.email} will have access until ${expiresAt} (${trialDays}-day trial)`,
        );

        // Normalize accessType to just 'trial' for storage
        accessType = "trial";
      } catch (parseError) {
        console.error("Error parsing trial duration:", parseError);
        // Fallback to 7-day trial if there's an error
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + 7);
        expiresAt = expirationDate.toISOString();
        accessType = "trial";
      }
    } else if (accessType === "trial") {
      // Legacy support for just 'trial' without days specified
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7);
      expiresAt = expirationDate.toISOString();
      console.log(
        `User ${pendingUser.email} will have access until ${expiresAt} (7-day trial)`,
      );
    }

    try {
      // Update the pending user record
      pendingUser.accessType = accessType;
      pendingUser.systemAccess = systemAccess;
      pendingUser.updatedAt = new Date().toISOString();
      pendingUser.updatedBy = req.user.email;

      if (expiresAt) {
        pendingUser.expiresAt = expiresAt;
      } else {
        // If changing from trial to unlimited, remove the expiration
        pendingUser.expiresAt = null;
      }

      // Update in approved users list if present
      if (global.approvedUsers) {
        const approvedUser = global.approvedUsers.find(
          (u) => u.email === pendingUser.email,
        );
        if (approvedUser) {
          approvedUser.accessType = accessType;
          approvedUser.systemAccess = systemAccess;
          approvedUser.updatedAt = new Date().toISOString();

          if (expiresAt) {
            approvedUser.expiresAt = expiresAt;
          } else {
            approvedUser.expiresAt = null;
          }

          console.log(
            `Updated access settings for ${pendingUser.email} in approved users list`,
          );
        }
      }

      // Save changes to persistent storage
      try {
        global.savePersistentData();
        console.log("Changes saved to persistent storage");
      } catch (saveError) {
        console.error("Error saving to persistent storage:", saveError);
        // Continue anyway since we've updated the in-memory objects
      }

      console.log("Sending successful response for edit user");
      return res.json({
        message: `User access settings updated successfully`,
        user: {
          id: pendingUser.id,
          email: pendingUser.email,
          status: pendingUser.status,
          accessType: pendingUser.accessType,
          systemAccess: pendingUser.systemAccess,
          expiresAt: pendingUser.expiresAt,
        },
      });
    } catch (updateError) {
      console.error("Error updating user records:", updateError);
      return res
        .status(500)
        .json({
          error: "Error updating user records",
          details: updateError.message,
        });
    }
  } catch (error) {
    console.error("Error updating user access:", error);
    return res
      .status(500)
      .json({ error: "Server error", details: error.message });
  }
});

// Add a manual endpoint to view pending users without authentication (for debugging)
router.get("/debug", (req, res) => {
  console.log("Debug endpoint called to view pending users");

  // Initialize if needed
  if (!global.mockPendingUsers) {
    global.mockPendingUsers = [];
  }

  // Add the test user directly if it doesn't exist
  const testEmail = "sumacchoy666@gmail.com";
  const existingUserIndex = global.mockPendingUsers.findIndex(
    (u) => u.email === testEmail,
  );

  if (existingUserIndex === -1) {
    console.log(`Adding test user ${testEmail} to pending users`);
    global.mockPendingUsers.push({
      id: `mock-test-${Date.now()}`,
      email: testEmail,
      status: "pending",
      requestDate: new Date().toISOString(),
    });

    // Save to persistent storage
    global.savePersistentData();
  }

  res.json({
    count: global.mockPendingUsers.length,
    users: global.mockPendingUsers,
  });
});

// Add a debug endpoint to check approved users
router.get("/debug/approved", (req, res) => {
  console.log("Checking approved users");

  if (!global.approvedUsers) {
    global.approvedUsers = [];
  }

  // Don't send passwords in the response
  const safeApprovedUsers = global.approvedUsers.map((user) => ({
    email: user.email,
    role: user.role,
    approvedAt: user.approvedAt,
  }));

  res.json({
    count: global.approvedUsers.length,
    users: safeApprovedUsers,
  });
});

// Add endpoint to resend email notification
router.post("/:id/resend-email", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Find the user in pending users
    const pendingUser = global.mockPendingUsers?.find((user) => user.id === id);

    if (!pendingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    if (pendingUser.status !== "approved") {
      return res.status(400).json({ error: "User is not approved yet" });
    }

    console.log(`Resending approval email to ${pendingUser.email}`);

    // Resend the email
    const emailResult = await resendApprovalEmail(pendingUser);

    if (emailResult.success) {
      pendingUser.emailSent = true;
      pendingUser.emailSentAt = new Date().toISOString();
      pendingUser.emailError = null;

      // Save changes to persistent storage
      global.savePersistentData();

      return res.json({
        success: true,
        message: `Approval email resent to ${pendingUser.email}`,
        user: {
          id: pendingUser.id,
          email: pendingUser.email,
          status: pendingUser.status,
          emailSent: pendingUser.emailSent,
          emailSentAt: pendingUser.emailSentAt,
        },
      });
    } else {
      pendingUser.emailSent = false;
      pendingUser.emailError = emailResult.error;

      // Save changes to persistent storage
      global.savePersistentData();

      return res.status(500).json({
        success: false,
        error: "Failed to send email",
        message: emailResult.error,
        user: {
          id: pendingUser.id,
          email: pendingUser.email,
          status: pendingUser.status,
          emailSent: pendingUser.emailSent,
          emailError: pendingUser.emailError,
        },
      });
    }
  } catch (error) {
    console.error("Error resending email:", error);
    return res
      .status(500)
      .json({ error: "Server error", message: error.message });
  }
});

// New endpoint to disable a user account
router.post("/:id/disable", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Find the user in pending users
    const mockUser = global.mockPendingUsers?.find((user) => user.id === id);

    if (mockUser) {
      console.log(`Disabling account for user ${mockUser.email}`);

      // Use our function to disable the user account
      const result = await disableUserAccount(mockUser);

      if (result.success) {
        console.log(`Successfully disabled account for user ${mockUser.email}`);
        return res.json({
          message: `User account disabled successfully`,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            status: mockUser.status,
            accessType: mockUser.accessType,
            systemAccess: mockUser.systemAccess,
            isDisabled: mockUser.isDisabled,
            disabledAt: mockUser.disabledAt,
          },
        });
      } else {
        return res.status(500).json({
          error: "Failed to disable user account",
          message: result.error,
        });
      }
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error disabling user account:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// New endpoint to enable a user account
router.post("/:id/enable", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // Find the user in pending users
    const mockUser = global.mockPendingUsers?.find((user) => user.id === id);

    if (mockUser) {
      console.log(`Enabling account for user ${mockUser.email}`);

      // Use our function to enable the user account
      const result = await enableUserAccount(mockUser);

      if (result.success) {
        console.log(`Successfully enabled account for user ${mockUser.email}`);
        return res.json({
          message: `User account enabled successfully`,
          user: {
            id: mockUser.id,
            email: mockUser.email,
            status: mockUser.status,
            accessType: mockUser.accessType,
            systemAccess: mockUser.systemAccess,
            isDisabled: mockUser.isDisabled,
            enabledAt: mockUser.enabledAt,
          },
        });
      } else {
        return res.status(500).json({
          error: "Failed to enable user account",
          message: result.error,
        });
      }
    } else {
      return res.status(404).json({ error: "User not found" });
    }
  } catch (error) {
    console.error("Error enabling user account:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// New dedicated endpoint to delete a user account completely
router.delete("/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: "Missing required parameter: id" });
    }

    console.log(`Received request to delete user with ID: ${id}`);

    // Find the user in pending users
    const userToDelete = global.mockPendingUsers?.find(
      (user) => user.id === id,
    );

    if (!userToDelete) {
      return res.status(404).json({ error: "User not found" });
    }

    console.log(`Found user to delete: ${userToDelete.email}`);

    // Use our enhanced function to delete the user account and all related data
    const result = await deleteUserAccount(userToDelete);

    if (result.success) {
      console.log(
        `Successfully processed deletion of user ${userToDelete.email}`,
      );

      // Remove from mock pending users list
      const userIndex = global.mockPendingUsers.findIndex(
        (user) => user.id === id,
      );
      if (userIndex !== -1) {
        console.log(
          `Removing user from mockPendingUsers at index ${userIndex}`,
        );
        global.mockPendingUsers.splice(userIndex, 1);
      } else {
        console.log(
          `User ${userToDelete.email} not found in mockPendingUsers (unusual condition)`,
        );
      }

      // Remove from approved users list if present
      const approvedIndex = global.approvedUsers
        ? global.approvedUsers.findIndex(
            (user) => user.email === userToDelete.email,
          )
        : -1;
      if (approvedIndex !== -1) {
        console.log(
          `Removing user from approvedUsers at index ${approvedIndex}`,
        );
        global.approvedUsers.splice(approvedIndex, 1);
      }

      // Save changes to persistent storage
      global.savePersistentData();
      console.log("Persistent data saved after user deletion");

      // Log the detailed results of the deletion
      console.log("Deletion results:", {
        firebaseAccountDeleted: result.firebaseDeleted,
        tokensDeleted: result.tokensDeleted,
        allDataDeleted: result.allDataDeleted,
      });

      return res.json({
        message: `User account for ${userToDelete.email} completely deleted`,
        details: {
          firebaseAccountDeleted: result.firebaseDeleted,
          tokensDeleted: result.tokensDeleted,
          allDataDeleted: result.allDataDeleted,
          message: result.message,
        },
      });
    } else {
      console.error(
        `Failed to delete user ${userToDelete.email}:`,
        result.error,
      );
      return res.status(500).json({
        error: "Failed to delete user account",
        message: result.error,
      });
    }
  } catch (error) {
    console.error("Error deleting user account:", error);
    return res
      .status(500)
      .json({ error: "Server error", message: error.message });
  }
});

// Add specific endpoints for approve and reject actions
router.post("/:id/approve", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { accessType, systemAccess } = req.body;

    console.log(`Approve endpoint called for user ${id}`);

    if (!id) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // Find the user in pending users
    const mockUser = global.mockPendingUsers?.find((user) => user.id === id);

    if (!mockUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Set access type (default to unlimited if not specified)
    const userAccessType = accessType || "unlimited";
    const userSystemAccess = systemAccess || "both";

    console.log(
      `Setting access type: ${userAccessType} for user ${mockUser.email}`,
    );
    console.log(
      `Setting system access: ${userSystemAccess} for user ${mockUser.email}`,
    );

    // Use our enhanced function to approve user
    const result = await approveUser(
      mockUser,
      userAccessType,
      userSystemAccess,
    );

    if (result.success) {
      console.log(`Successfully approved user ${mockUser.email}`);
      return res.json({
        message: `User approved successfully`,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          status: mockUser.status,
          accessType: mockUser.accessType,
          systemAccess: mockUser.systemAccess,
          expiresAt: mockUser.expiresAt,
          emailSent: result.emailSent || mockUser.emailSent || false,
          emailSentAt: mockUser.emailSentAt,
          emailError: mockUser.emailError,
          note: result.note,
        },
      });
    } else {
      console.log(
        `Approved user ${mockUser.email} with fallback login due to: ${result.error}`,
      );
      return res.json({
        message: `User approved with fallback login`,
        warning: result.error,
        user: {
          id: mockUser.id,
          email: mockUser.email,
          status: mockUser.status,
          accessType: mockUser.accessType,
          systemAccess: mockUser.systemAccess,
          expiresAt: mockUser.expiresAt,
          emailSent: result.emailSent || mockUser.emailSent || false,
          emailSentAt: mockUser.emailSentAt,
          emailError: mockUser.emailError,
        },
      });
    }
  } catch (error) {
    console.error("Error approving user:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

// Reject endpoint
router.post("/:id/reject", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log(`Reject endpoint called for user ${id}`);

    if (!id) {
      return res.status(400).json({ error: "Missing user ID" });
    }

    // Initialize if needed
    if (!global.mockPendingUsers) {
      global.mockPendingUsers = [];
    }

    // Find the user in pending users
    const pendingUser = global.mockPendingUsers.find((user) => user.id === id);

    if (!pendingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update user status to rejected
    pendingUser.status = "rejected";
    pendingUser.rejectionReason = reason || "";
    pendingUser.rejectedAt = new Date().toISOString();
    pendingUser.rejectedBy = req.user.email;

    // Save changes to persistent storage
    global.savePersistentData();

    console.log(`User ${pendingUser.email} rejected by ${req.user.email}`);

    return res.json({
      message: `User rejected successfully`,
      user: {
        id: pendingUser.id,
        email: pendingUser.email,
        status: pendingUser.status,
        rejectionReason: pendingUser.rejectionReason,
        rejectedAt: pendingUser.rejectedAt,
        rejectedBy: pendingUser.rejectedBy,
      },
    });
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({ error: "Server error", message: error.message });
  }
});

export default router;
