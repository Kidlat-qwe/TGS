import React, { useState, useEffect, useRef } from 'react';
import '../styles/PendingUsers.css';
import { getApiUrl, fetchWithAuth } from '../utils/api';

const PendingUsers = () => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [accessType, setAccessType] = useState('unlimited');
  const [trialDuration, setTrialDuration] = useState('7');
  const [systemAccess, setSystemAccess] = useState('both');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [buttonLoading, setButtonLoading] = useState({ id: null, action: null }); // Track which button is loading
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showErrorAlert, setShowErrorAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const tableContainerRef = useRef(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showEnableModal, setShowEnableModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  useEffect(() => {
    fetchPendingUsers();
  }, []);

  // Add overflow detection
  useEffect(() => {
    const checkForOverflow = () => {
      if (tableContainerRef.current) {
        const hasHorizontalOverflow = tableContainerRef.current.scrollWidth > tableContainerRef.current.clientWidth;
        const hasVerticalOverflow = tableContainerRef.current.scrollHeight > tableContainerRef.current.clientHeight;

        if (hasHorizontalOverflow || hasVerticalOverflow) {
          tableContainerRef.current.classList.add('has-overflow');
        } else {
          tableContainerRef.current.classList.remove('has-overflow');
        }
      }
    };

    // Check after data loads
    if (!loading && pendingUsers.length > 0) {
      // Small delay to ensure rendering is complete
      setTimeout(checkForOverflow, 100);
    }

    // Add window resize listener
    window.addEventListener('resize', checkForOverflow);

    // Cleanup
    return () => {
      window.removeEventListener('resize', checkForOverflow);
    };
  }, [loading, pendingUsers, statusFilter]);

  const fetchPendingUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await fetchWithAuth('pending-users');
      console.log('Fetched pending users:', data);

      // Preserve the emailStatusLogged flag when updating users
      setPendingUsers(prevUsers => {
        // Create a map of existing users with their emailStatusLogged flags
        const existingUsersMap = {};
        prevUsers.forEach(user => {
          if (user.id && user.emailStatusLogged) {
            existingUsersMap[user.id] = { emailStatusLogged: true };
          }
        });

        // Apply the flag to new data where applicable
        return (data || []).map(user => {
          // Reset trial duration calculation cache for all users
          user.trialDurationLogged = false;
          user.cachedTrialDuration = null;

          if (user.id && existingUsersMap[user.id]) {
            return { ...user, ...existingUsersMap[user.id] };
          }
          return user;
        });
      });
    } catch (error) {
      console.error('Error fetching pending users:', error);
      setError(`Failed to load users: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openApprovalModal = (user) => {
    setSelectedUser(user);
    setShowApprovalModal(true);
    setAccessType('unlimited'); // Default to unlimited
    setTrialDuration('7'); // Default to 7 days trial
    setSystemAccess('both'); // Default to both systems
  };

  const closeApprovalModal = () => {
    setShowApprovalModal(false);
    setSelectedUser(null);
  };

  const openDeleteModal = (user) => {
    setSelectedUser(user);
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setSelectedUser(null);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    // Reset cached values to ensure they're recalculated after editing
    if (user) {
      user.trialDurationLogged = false;
      user.cachedTrialDuration = null;
    }

    // Set the accessType from the user, defaulting to unlimited if not present
    setAccessType(user.accessType || 'unlimited');

    // If this user has a previously selected trial duration, use that directly
    if (user.selectedTrialDuration) {
      console.log(`Using stored trial duration: ${user.selectedTrialDuration} days`);
      setTrialDuration(user.selectedTrialDuration);
    }
    // If it's a trial user, determine the trial duration from expiresAt
    else if (user.accessType === 'trial' && user.expiresAt) {
      try {
        // For recently updated users, check the difference between now and expiration
        // For older users, check the difference between approval date and expiration
        const startDate = user.updatedAt ? new Date(user.updatedAt) : 
                          (user.approvedAt ? new Date(user.approvedAt) : new Date());
        const expiresDate = new Date(user.expiresAt);

        // Calculate difference in days
        const diffTime = Math.abs(expiresDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        console.log(`Trial duration calculation: ${diffDays} days from ${startDate.toISOString()} to ${expiresDate.toISOString()}`);

        // Set trial duration based on the calculated days
        if (diffDays <= 1) setTrialDuration('1');
        else if (diffDays <= 3) setTrialDuration('3');
        else setTrialDuration('7');
      } catch (e) {
        console.error('Error calculating trial duration:', e);
        setTrialDuration('7'); // Default to 7 days if there's an error
      }
    } else {
      setTrialDuration('7'); // Default trial duration
    }

    // Set the systemAccess from the user, defaulting to both if not present
    setSystemAccess(user.systemAccess || 'both');
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
    setSelectedUser(null);
  };

  const handleApprove = async () => {
    if (!selectedUser) return;
    setButtonLoading({ id: selectedUser.id, action: 'approve' });

    // Determine the actual accessType to send to the server
    const finalAccessType = accessType === 'trial' 
      ? `trial-${trialDuration}d` 
      : accessType;

    await handleAction(selectedUser.id, 'approve', '', finalAccessType, systemAccess);
    setButtonLoading({ id: null, action: null });
    closeApprovalModal();
  };

  const handleDelete = async () => {
    if (!selectedUser) return;
    setButtonLoading({ id: selectedUser.id, action: 'delete' });
    try {
      await handleAction(selectedUser.id, 'delete');
      console.log(`Successfully deleted user ${selectedUser.email}`);
    } catch (error) {
      console.error("Error deleting user:", error);
      // Show an error message to the user
      setNotification({
        show: true,
        message: `Failed to delete user: ${error.message || 'Unknown error'}`,
        type: 'error'
      });
    } finally {
      // Always refresh the user list and reset UI state
      setTimeout(() => {
        fetchPendingUsers();
      }, 500);  // Short delay to ensure server has processed the request
      setButtonLoading({ id: null, action: null });
      closeDeleteModal();
    }
  };

  const handleEdit = async () => {
    try {
      setEditLoading(true);

      // Debug selected user
      console.log("Updating user:", selectedUser?.email);
      console.log("New accessType:", accessType);
      console.log("New trialDuration:", trialDuration);
      console.log("New systemAccess:", systemAccess);

      // Special processing for trial access
      let finalAccessType = accessType;
      if (accessType === 'trial') {
        finalAccessType = `trial-${trialDuration}d`;
      }

      console.log("Final accessType to be sent:", finalAccessType);

      const token = localStorage.getItem('token');

      // Call the API to update the user
      const response = await fetch(getApiUrl(`pending-users/${selectedUser.id}/edit`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessType: finalAccessType,
          systemAccess,
          trialDuration: accessType === 'trial' ? trialDuration : null
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to update user');
      }

      console.log("User updated successfully:", data);

      // Update the user in our local state
      setPendingUsers(prev => 
        prev.map(user => {
          if (user.id === selectedUser.id) {
            // Create a copy of the user
            const updatedUser = { ...user };

            // Update the properties
            updatedUser.accessType = accessType;
            updatedUser.systemAccess = systemAccess;
            updatedUser.updatedAt = new Date().toISOString();

            // Reset cached values to ensure they're recalculated
            updatedUser.trialDurationLogged = false;
            updatedUser.cachedTrialDuration = null;

            // For trial users, set expiration date
            if (accessType === 'trial') {
              const days = parseInt(trialDuration, 10);
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + days);
              updatedUser.expiresAt = expiresAt.toISOString();
              updatedUser.selectedTrialDuration = trialDuration;
            } else {
              // For unlimited access, remove expiration date
              delete updatedUser.expiresAt;
              delete updatedUser.selectedTrialDuration;
            }

            return updatedUser;
          }
          return user;
        })
      );

      // Show success message
      setNotification({
        show: true,
        message: 'User updated successfully',
        type: 'success'
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);

      // Close the modal
      closeEditModal();
    } catch (error) {
      console.error("Error updating user:", error);

      // Show error message
      setNotification({
        show: true,
        message: error.message || 'Failed to update user',
        type: 'error'
      });

      // Hide notification after 5 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);
    } finally {
      setEditLoading(false);
    }
  };

  const handleAction = async (id, action, reason = '', accessType = 'unlimited', systemAccess = 'both') => {
    try {
      // Determine the appropriate endpoint and endpoint type
      let endpoint;
      let useProcess = false;
      let method = 'POST';

      if (action === 'resend-email') {
        endpoint = `pending-users/${id}/resend-email`;
      } else if (action === 'approve' || action === 'reject') {
        // Use process endpoint for approve and reject
        endpoint = `pending-users/${id}/process`;
        useProcess = true;
      } else if (action === 'delete') {
        // For delete action, use the DELETE endpoint directly
        endpoint = `pending-users/${id}`;
        method = 'DELETE';
      } else {
        endpoint = `pending-users/${id}/${action}`;
      }

      console.log(`Sending ${action} request to ${endpoint} with method ${method}`);

      // Set up the request data based on the action
      const requestData = {};

      if (action === 'approve') {
        // For approval, we need to include access details and the action
        requestData.accessType = accessType;
        requestData.systemAccess = systemAccess;
        if (useProcess) requestData.action = 'approve';
        console.log(`Approval request with accessType: ${accessType}, systemAccess: ${systemAccess}`);
      } else if (action === 'reject') {
        // For rejection, include the reason
        requestData.reason = reason;
        if (useProcess) requestData.action = 'reject';
      } else if (action === 'disable' || action === 'enable') {
        // For disable/enable, include the reason
        requestData.reason = reason;
      }

      // Use the fetchWithAuth utility
      const data = await fetchWithAuth(endpoint, {
        method: method,
        body: JSON.stringify(requestData),
      });

      // Successful response
      console.log(`${action} successful:`, data);

      // Show success notification
      setNotification({
        show: true,
        message: data.message || `User ${action === 'approve' ? 'approved' : 
                               action === 'reject' ? 'rejected' : 
                               action === 'delete' ? 'deleted' : 
                               action === 'edit' ? 'updated' :
                               action === 'disable' ? 'disabled' : 
                               action === 'enable' ? 'enabled' : 
                               action === 'resend-email' ? 'email resent to' : 
                               action} successfully`,
        type: 'success'
      });

      // Update the local state to reflect the changes
      setPendingUsers(prev => {
        if (action === 'delete') {
          // For delete, remove the user from the list
          return prev.filter(user => user.id !== id);
        } else if (action === 'approve' || action === 'reject' || action === 'edit' || action === 'disable' || action === 'enable') {
          // For approve/reject/edit/disable/enable, update the user in the list
          return prev.map(user => {
            if (user.id === id) {
              // Deep copy the user object to avoid state mutation issues
              const updatedUser = { ...user };

      if (action === 'approve') {
                updatedUser.status = 'approved';
                updatedUser.accessType = accessType;
                updatedUser.systemAccess = systemAccess;

                // If trial access, calculate and set expiration date
                if (accessType.startsWith('trial-')) {
                  const daysMatch = accessType.match(/trial-(\d+)d/);
                  if (daysMatch && daysMatch[1]) {
                    const days = parseInt(daysMatch[1], 10);
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + days);
                    updatedUser.expiresAt = expiresAt.toISOString();
                    // Also store the selected trial duration for easier reference later
                    updatedUser.selectedTrialDuration = days.toString();
                  }
                } else {
                  // For unlimited access, remove any expiration date
                  delete updatedUser.expiresAt;
                  delete updatedUser.selectedTrialDuration;
                }

                // Set approval timestamp
                updatedUser.approvedAt = new Date().toISOString();
              } else if (action === 'reject') {
                updatedUser.status = 'rejected';
                updatedUser.rejectionReason = reason;
                updatedUser.rejectedAt = new Date().toISOString();
              } else if (action === 'edit') {
                // For edit, we update access settings
                updatedUser.accessType = accessType;
                updatedUser.systemAccess = systemAccess;
                updatedUser.updatedAt = new Date().toISOString();

                // If trial access, calculate and set expiration date
                if (accessType === 'trial') {
                  const days = parseInt(trialDuration, 10);
                  const expiresAt = new Date();
                  expiresAt.setDate(expiresAt.getDate() + days);
                  updatedUser.expiresAt = expiresAt.toISOString();
                  // Also store the selected trial duration for easier reference
                  updatedUser.selectedTrialDuration = trialDuration;
                } else {
                  // For unlimited access, remove any expiration date
                  delete updatedUser.expiresAt;
                  delete updatedUser.selectedTrialDuration;
                }
              } else if (action === 'disable') {
                // For disable, mark as disabled
                updatedUser.isDisabled = true;
                updatedUser.disabledReason = reason;
                updatedUser.disabledAt = new Date().toISOString();
              } else if (action === 'enable') {
                // For enable, mark as not disabled
                updatedUser.isDisabled = false;
                updatedUser.disabledReason = null;
                updatedUser.disabledAt = null;
                updatedUser.enabledAt = new Date().toISOString();
              } else if (action === 'resend-email') {
                // For resend-email, update email sent timestamp
                updatedUser.emailSentAt = new Date().toISOString();
                updatedUser.emailSent = true;
              }

                return updatedUser;
              }
              return user;
            });
        } else if (action === 'resend-email') {
          // For resend-email, update the user's email status
          return prev.map(user => {
            if (user.id === id) {
              return {
                ...user,
                emailSentAt: new Date().toISOString(),
                emailSent: true
              };
            }
            return user;
          });
        }

        // Default: return unchanged list
        return prev;
      });

      // For approved users, show special success message with more details
      if (action === 'approve') {
        setSuccessMessage(
          `User approved successfully. An email confirmation has been sent to ${selectedUser?.email}.`
        );
        setShowSuccessAlert(true);

        // Hide success alert after 5 seconds
        setTimeout(() => {
          setShowSuccessAlert(false);
        }, 5000);
      }

      // After successful processing, hide any notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);

      return true;

    } catch (error) {
      console.error(`Error during ${action} action:`, error);

      // Show error notification
      setNotification({
        show: true,
        message: error.message || `Failed to ${action} user`,
        type: 'error'
      });

      // For more important errors, show as alert
      if (action === 'approve' || action === 'edit') {
        setErrorMessage(error.message || `Failed to ${action} user`);
        setShowErrorAlert(true);

        // Hide error alert after 5 seconds
        setTimeout(() => {
          setShowErrorAlert(false);
        }, 5000);
      }

      // Hide notification after 5 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);

      return false;
    }
  };

  const handleReject = async () => {
    if (!selectedUser) return;

    setButtonLoading({ id: selectedUser.id, action: 'reject' });

    try {
      const successful = await handleAction(selectedUser.id, 'reject', rejectionReason);

      if (successful) {
        closeRejectModal();
      }
    } catch (error) {
      console.error('Rejection error:', error);
    } finally {
      setButtonLoading({ id: null, action: null });
    }
  };

  // Handler function for clicking the Reject button
  const handleRejectClick = (user) => {
    setSelectedUser(user);
    setRejectionReason('');
    setShowRejectModal(true);
  };

  // Format date to a readable format
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Determine trial duration for display
  const getTrialDuration = (user) => {
    if (!user.accessType || user.accessType !== 'trial' || !user.expiresAt) {
      return '(Unlimited)';
    }

    try {
      // Get current date and expiration date
      const currentDate = new Date();
      const expiresDate = new Date(user.expiresAt);

      // Check if trial has already expired
      if (currentDate > expiresDate) {
        return '(Trial Expired)';
      }

      // Get the reference date for trial calculation
      // If the user was recently updated, use that date instead of approval date
      const referenceDate = user.updatedAt ? new Date(user.updatedAt) : 
                            (user.approvedAt ? new Date(user.approvedAt) : new Date());

      // Calculate difference in days between reference date and expiration
      const diffTime = Math.abs(expiresDate - referenceDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Only log once per user by using a trialDurationLogged flag
      if (!user.trialDurationLogged) {
        console.log(`Trial duration display calculation for ${user.email}:`, {
          referenceDate: referenceDate.toISOString(),
          expiresDate: expiresDate.toISOString(),
          diffDays
        });

        // Mark as logged to prevent future logs
        user.trialDurationLogged = true;
      }

      // If expiration is today (less than 24 hours from reference date)
      if (diffDays === 0) {
        return '(Trial ends today)';
      }

      // Return appropriate badge based on original trial length
      if (diffDays === 1) return '(1-day Trial)';
      if (diffDays === 3) return '(3-day Trial)';
      if (diffDays === 7) return '(7-day Trial)';

      // For custom durations
      return `(${diffDays}-day Trial)`;
    } catch (e) {
      console.error('Error calculating trial duration:', e);
      return '(Trial)';
    }
  };

  // Filter users based on the selected status filter
  const filteredUsers = () => {
    let filtered = pendingUsers;
    
    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => user.status === statusFilter);
    }
    
    // Apply search filter
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(user => 
        user.email.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  // Get the page title based on the selected filter
  const getPageTitle = () => {
    const filtered = filteredUsers();
    const count = filtered.length;
    const countText = `(${count} ${count === 1 ? 'user' : 'users'})`;

    if (statusFilter === 'all') {
      return `User Registrations ${countText}`;
    } else if (statusFilter === 'approved') {
      return `Approved User Registrations ${countText}`;
    } else if (statusFilter === 'pending') {
      return `Pending User Registrations ${countText}`;
    }
    return `User Registrations ${countText}`;
  };

  // Helper to check if a specific button is in loading state
  const isButtonLoading = (id, action) => {
    return buttonLoading.id === id && buttonLoading.action === action;
  };

  // Add renderSystemAccessBadge function before the renderAccessBadge function
  const renderSystemAccessBadge = (systemAccess) => {
    if (!systemAccess) return null;

    let badgeClass = '';
    let badgeText = '';

    switch(systemAccess) {
      case 'both':
        badgeClass = 'bg-primary';
        badgeText = 'All Systems';
        break;
      case 'grading':
        badgeClass = 'bg-success';
        badgeText = 'Grading System';
        break;
      case 'evaluation':
        badgeClass = 'bg-warning';
        badgeText = 'Evaluation System';
        break;
      default:
        badgeClass = 'bg-secondary';
        badgeText = systemAccess;
    }

    return (
      <span className={`badge ${badgeClass}`}>
        {badgeText}
      </span>
    );
  };

  // Render approval modal
  const renderApprovalModal = () => {
    if (!showApprovalModal) return null;

    const isApproveButtonLoading = isButtonLoading(selectedUser?.id, 'approve');

    return (
      <div className="approval-modal-overlay">
        <div className="approval-modal">
          <h3>Approve User</h3>
          <p>Please select access type for <strong>{selectedUser?.email}</strong>:</p>

          <div className="form-group">
            <label>Access Type</label>
            <select 
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="access-select"
              disabled={isApproveButtonLoading}
            >
              <option value="unlimited">Unlimited Access (no time limitation)</option>
              <option value="trial">Trial Access (time limited)</option>
            </select>
          </div>

          {accessType === 'trial' && (
            <div className="form-group">
              <label>Trial Duration</label>
              <select 
                value={trialDuration}
                onChange={(e) => setTrialDuration(e.target.value)}
                className="trial-select"
                disabled={isApproveButtonLoading}
              >
                <option value="1">1 Day Trial</option>
                <option value="3">3 Day Trial</option>
                <option value="7">7 Day Trial</option>
              </select>
              <div className="form-note">
                User will have access for {trialDuration} day{trialDuration !== '1' ? 's' : ''} from approval
              </div>
            </div>
          )}

          <h4>System Access</h4>
          <p>Select which systems this user can generate tokens for:</p>

          <div className="form-group">
            <select
              value={systemAccess}
              onChange={(e) => setSystemAccess(e.target.value)}
              className="access-select"
              disabled={isApproveButtonLoading}
            >
              <option value="both">Both Systems</option>
              <option value="evaluation">Evaluation System Only</option>
              <option value="grading">Grading System Only</option>
            </select>
          </div>

          <div className="modal-actions">
            <button 
              className="cancel-btn" 
              onClick={closeApprovalModal}
              disabled={isApproveButtonLoading}
            >
              Cancel
            </button>
            <button 
              className={`approve-btn modal-button ${isApproveButtonLoading ? 'button-loading' : ''}`} 
              onClick={handleApprove}
              disabled={isApproveButtonLoading}
            >
              {isApproveButtonLoading ? (
                <span className="button-loader"></span>
              ) : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render delete confirmation modal
  const renderDeleteModal = () => {
    if (!showDeleteModal) return null;

    const isDeleteButtonLoading = isButtonLoading(selectedUser?.id, 'delete');

    return (
      <div className="approval-modal-overlay">
        <div className="approval-modal">
          <h3>Delete User</h3>
          <p>Are you sure you want to delete user <strong>{selectedUser?.email}</strong>?</p>
          <p className="delete-warning">This will permanently remove the user's account and Firebase authentication credentials. This action cannot be undone.</p>

          <div className="modal-actions">
            <button 
              className="cancel-btn" 
              onClick={closeDeleteModal}
              disabled={isDeleteButtonLoading}
            >
              Cancel
            </button>
            <button 
              className={`delete-confirm-btn ${isDeleteButtonLoading ? 'button-loading' : ''}`} 
              onClick={handleDelete}
              disabled={isDeleteButtonLoading}
            >
              {isDeleteButtonLoading ? (
                <span className="button-loader"></span>
              ) : 'Delete User'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render edit modal
  const renderEditModal = () => {
    if (!showEditModal) return null;

    const isEditButtonLoading = isButtonLoading(selectedUser?.id, 'edit');

    console.log('Rendering edit modal for user:', selectedUser);

    return (
      <div className="approval-modal-overlay">
        <div className="approval-modal">
          <h3>Edit User Access</h3>
          <p>Update access settings for <strong>{selectedUser?.email}</strong>:</p>
          <p style={{color: '#888', fontSize: '12px'}}>User ID: {selectedUser?.id}</p>

          <div className="form-group">
            <label>Access Type</label>
            <select 
              value={accessType}
              onChange={(e) => setAccessType(e.target.value)}
              className="access-select"
              disabled={isEditButtonLoading}
            >
              <option value="unlimited">Unlimited Access (no time limitation)</option>
              <option value="trial">Trial Access (time limited)</option>
            </select>
          </div>

          {accessType === 'trial' && (
            <div className="form-group">
              <label>Trial Duration</label>
              <select 
                value={trialDuration}
                onChange={(e) => setTrialDuration(e.target.value)}
                className="trial-select"
                disabled={isEditButtonLoading}
              >
                <option value="1">1 Day Trial</option>
                <option value="3">3 Day Trial</option>
                <option value="7">7 Day Trial</option>
              </select>
              <div className="form-note">
                User will have access for {trialDuration} day{trialDuration !== '1' ? 's' : ''} from approval
              </div>
            </div>
          )}

          <h4>System Access</h4>
          <p>Select which systems this user can generate tokens for:</p>

          <div className="form-group">
            <select
              value={systemAccess}
              onChange={(e) => setSystemAccess(e.target.value)}
              className="access-select"
              disabled={isEditButtonLoading}
            >
              <option value="both">Both Systems</option>
              <option value="evaluation">Evaluation System Only</option>
              <option value="grading">Grading System Only</option>
            </select>
          </div>

          <div className="modal-actions">
            <button 
              className="cancel-btn" 
              onClick={closeEditModal}
              disabled={isEditButtonLoading}
            >
              Cancel
            </button>
            <button 
              className={`approve-btn modal-button ${editLoading ? 'button-loading' : ''}`} 
              onClick={handleEdit}
              disabled={editLoading}
            >
              {editLoading ? (
                <span className="button-loader"></span>
              ) : 'Update'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add a renderAccessBadge function to make badge display consistent
  const renderAccessBadge = (user) => {
    // If user is not approved yet, show "Pending"
    if (user.status !== 'approved') {
      return <span className="badge bg-secondary">Pending</span>;
    }

    if (user.accessType === 'trial') {
      // Check if we already calculated the trial duration for this user
      if (!user.cachedTrialDuration) {
        // First check if we have a stored selectedTrialDuration
        if (user.selectedTrialDuration) {
          user.cachedTrialDuration = `Trial (${user.selectedTrialDuration}-day)`;
        } else {
          // Fall back to calculating from dates
          user.cachedTrialDuration = getTrialDuration(user);
        }
      }

      return (
        <span className="badge bg-info">
          {user.cachedTrialDuration}
        </span>
      );
    } else if (user.accessType === 'unlimited') {
      return <span className="badge bg-success">Unlimited</span>;
    } else {
      return <span className="badge bg-warning">{user.accessType || 'Unknown'}</span>;
    }
  };

  // Add function to handle resending email
  const handleResendEmail = async (user) => {
    if (!user || !user.id) return;

    // Set the button to loading state
    setButtonLoading({ id: user.id, action: 'resend-email' });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log(`Resending approval email to ${user.email}`);

      const response = await fetch(getApiUrl(`pending-users/${user.id}/resend-email`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to resend email');
      }

      console.log('Email resent successfully:', data);

      // Update the user in the local state
      setPendingUsers(prev => 
        prev.map(u => {
          if (u.id === user.id) {
            return {
              ...u,
              emailSent: true,
              emailSentAt: new Date().toISOString()
            };
          }
          return u;
        })
      );

      // Show success notification
      setNotification({
        show: true,
        message: `Email resent successfully to ${user.email}`,
        type: 'success'
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);

    } catch (error) {
      console.error('Error resending email:', error);

      setNotification({
        show: true,
        message: error.message || 'Failed to resend email',
        type: 'error'
      });

      // Hide error notification after 5 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);
    } finally {
      // Reset the button loading state
      setButtonLoading({ id: null, action: null });
    }
  };

  // Find the renderEmailStatus function and update it to prevent repeated logging
  const renderEmailStatus = (user) => {
    // Only log once during initial render, not on every render cycle
    const shouldLogStatus = user.emailStatusLogged !== true;

    if (shouldLogStatus) {
      // Comment out logs that are causing spam
      // console.log(`Rendering email status for user: ${user.id}`, user.email, user.status, `Email sent: ${user.emailSent}`);
      // Mark as logged to prevent future logs
      user.emailStatusLogged = true;
    }

    // Rest of the function remains the same
    if (user.status !== 'approved') {
      return null;
    }

    if (!user.emailSent) {
      return (
        <div className="email-status-inline">
          <span 
            className="email-status not-sent" 
            title="Approval email has not been sent"
          >
            <span className="status-icon">✕</span>
            <span className="status-text">Email not sent</span>
          </span>
          <button 
            className="resend-email-btn-prominent"
            onClick={(e) => {
              e.stopPropagation();
              handleResendEmail(user);
            }}
            title="Resend approval email"
            disabled={isButtonLoading(user.id, 'resend-email')}
          >
            {isButtonLoading(user.id, 'resend-email') ? (
              <span className="button-loader"></span>
            ) : 'Resend Email'}
          </button>
        </div>
      );
    }

    // Only log badge rendering once
    if (shouldLogStatus) {
      // Comment out logs that are causing spam
      // console.log(`Rendering success email badge for ${user.email}`);
    }

    return (
      <div className="email-status-inline">
        <span 
          className="email-status sent" 
          title={`Email sent at ${formatDate(user.emailSentAt)}`}
        >
          <span className="status-icon">✓</span>
          <span className="status-text">Email sent</span>
        </span>
        <button 
          className="resend-email-btn-prominent"
          onClick={(e) => {
            e.stopPropagation();
            handleResendEmail(user);
          }}
          title="Resend approval email"
          disabled={isButtonLoading(user.id, 'resend-email')}
        >
          {isButtonLoading(user.id, 'resend-email') ? (
            <span className="button-loader"></span>
          ) : 'Resend Email'}
        </button>
      </div>
    );
  };

  // Add handler functions for opening/closing disable and enable modals
  const openDisableModal = (user) => {
    setSelectedUser(user);
    setShowDisableModal(true);
  };

  const closeDisableModal = () => {
    setShowDisableModal(false);
    setSelectedUser(null);
  };

  const openEnableModal = (user) => {
    setSelectedUser(user);
    setShowEnableModal(true);
  };

  const closeEnableModal = () => {
    setShowEnableModal(false);
    setSelectedUser(null);
  };

  // Add handler functions for disabling and enabling accounts
  const handleDisable = async () => {
    if (!selectedUser) return;

    setButtonLoading({ id: selectedUser.id, action: 'disable' });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const reason = document.getElementById('disableReason').value;
      if (!reason.trim()) {
        throw new Error('Please provide a reason for disabling the account');
      }

      console.log(`Disabling account for ${selectedUser.email} with reason: ${reason}`);

      const response = await fetch(getApiUrl(`pending-users/${selectedUser.id}/disable`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to disable account');
      }

      console.log('Account disabled successfully:', data);

      // Update the user in the local state
      setPendingUsers(prev => 
        prev.map(user => {
          if (user.id === selectedUser.id) {
            return {
              ...user,
              isDisabled: true,
              disabledReason: reason,
              disabledAt: new Date().toISOString()
            };
          }
          return user;
        })
      );

      // Show success message
      setNotification({
        show: true,
        message: `Account for ${selectedUser.email} has been disabled`,
        type: 'success'
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);

    } catch (error) {
      console.error('Error disabling account:', error);

      setNotification({
        show: true,
        message: error.message || 'Failed to disable account',
        type: 'error'
      });

      // Hide error notification after 5 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);
    } finally {
      // Reset loading state and close modal
      setButtonLoading({ id: null, action: null });
      closeDisableModal();
    }
  };

  const handleEnable = async () => {
    if (!selectedUser) return;

    setButtonLoading({ id: selectedUser.id, action: 'enable' });

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log(`Enabling account for ${selectedUser.email}`);

      const response = await fetch(getApiUrl(`pending-users/${selectedUser.id}/enable`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to enable account');
      }

      console.log('Account enabled successfully:', data);

      // Update the user in the local state
      setPendingUsers(prev => 
        prev.map(user => {
          if (user.id === selectedUser.id) {
            return {
              ...user,
              isDisabled: false,
              disabledReason: null,
              disabledAt: null,
              enabledAt: new Date().toISOString()
            };
          }
          return user;
        })
      );

      // Show success message
      setNotification({
        show: true,
        message: `Account for ${selectedUser.email} has been enabled`,
        type: 'success'
      });

      // Hide notification after 3 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 3000);

    } catch (error) {
      console.error('Error enabling account:', error);

      setNotification({
        show: true,
        message: error.message || 'Failed to enable account',
        type: 'error'
      });

      // Hide error notification after 5 seconds
      setTimeout(() => {
        setNotification({ show: false, message: '', type: '' });
      }, 5000);
    } finally {
      // Reset loading state and close modal
      setButtonLoading({ id: null, action: null });
      closeEnableModal();
    }
  };

  // Update the renderDisableEnableButton function to use shorter text
  const renderDisableEnableButton = (user) => {
    if (user.status !== 'approved') {
      return null;
    }

    if (user.isDisabled) {
      return (
        <button 
          className={`btn btn-sm btn-success ${isButtonLoading(user.id, 'enable') ? 'button-loading' : ''}`}
          onClick={() => openEnableModal(user)}
          disabled={isButtonLoading(user.id, 'enable')}
        >
          {isButtonLoading(user.id, 'enable') ? <span className="button-loader"></span> : 'Enable'}
        </button>
      );
    } else {
      return (
        <button 
          className={`btn btn-sm btn-warning ${isButtonLoading(user.id, 'disable') ? 'button-loading' : ''}`}
          onClick={() => openDisableModal(user)}
          disabled={isButtonLoading(user.id, 'disable')}
        >
          {isButtonLoading(user.id, 'disable') ? <span className="button-loader"></span> : 'Disable'}
        </button>
      );
    }
  };

  // Update the Disable Modal buttons
  const renderDisableModal = () => {
    if (!showDisableModal || !selectedUser) return null;

    return (
      <div className="approval-modal-overlay">
        <div className="approval-modal">
          <h3>Disable Account</h3>
          <p>Are you sure you want to disable the account for <strong>{selectedUser.email}</strong>?</p>
          <p>The user will no longer be able to log in while the account is disabled.</p>
          
          <div className="form-group">
            <label>Reason for disabling</label>
            <textarea 
              id="disableReason"
              className="form-control"
              placeholder="Please provide a reason for disabling this account"
              rows={3}
              required
            />
          </div>

          <div className="modal-actions">
            <button 
              className="cancel-btn" 
              onClick={closeDisableModal}
              disabled={isButtonLoading(selectedUser.id, 'disable')}
            >
              Cancel
            </button>
            <button 
              className={`delete-confirm-btn ${isButtonLoading(selectedUser.id, 'disable') ? 'button-loading' : ''}`}
              onClick={handleDisable}
              disabled={isButtonLoading(selectedUser.id, 'disable')}
              style={{ backgroundColor: "#1a1a1a", color: "white" }}
            >
              {isButtonLoading(selectedUser.id, 'disable') ? <span className="button-loader"></span> : 'Disable'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Update the Enable Modal buttons
  const renderEnableModal = () => {
    if (!showEnableModal || !selectedUser) return null;

    return (
      <div className="approval-modal-overlay">
        <div className="approval-modal">
          <h3>Enable Account</h3>
          <p>Are you sure you want to enable the account for <strong>{selectedUser.email}</strong>?</p>
          <p>The user will be able to log in again after the account is enabled.</p>
          
          <div className="modal-actions">
            <button 
              className="cancel-btn" 
              onClick={closeEnableModal}
              disabled={isButtonLoading(selectedUser.id, 'enable')}
            >
              Cancel
            </button>
            <button 
              className={`btn btn-success ${isButtonLoading(selectedUser.id, 'enable') ? 'button-loading' : ''}`}
              onClick={handleEnable}
              disabled={isButtonLoading(selectedUser.id, 'enable')}
            >
              {isButtonLoading(selectedUser.id, 'enable') ? <span className="button-loader"></span> : 'Enable'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Add a function to render the account status badge
  const renderAccountStatusBadge = (user) => {
    if (user.status !== 'approved') {
      return null;
    }

    if (user.isDisabled) {
      return (
        <span 
          className="badge bg-danger"
          title={`Disabled on ${formatDate(user.disabledAt)}`}
        >
          Account Disabled
        </span>
      );
    }

    return null;
  };

  // Add a helper function to render action buttons in a container to ensure consistent alignment
  const renderActionButtons = (user) => {
    if (user.status === 'pending') {
      return (
        <div className="action-buttons-container">
          <button 
            className={`approve-btn ${isButtonLoading(user.id, 'approve') ? 'button-loading' : ''}`}
            onClick={() => openApprovalModal(user)}
            disabled={loading || buttonLoading.id !== null}
          >
            {isButtonLoading(user.id, 'approve') ? <span className="button-loader"></span> : 'Approve'}
          </button>
          <button 
            className={`reject-btn ${isButtonLoading(user.id, 'reject') ? 'button-loading' : ''}`}
            onClick={() => handleRejectClick(user)}
            disabled={loading || buttonLoading.id !== null}
          >
            {isButtonLoading(user.id, 'reject') ? <span className="button-loader"></span> : 'Reject'}
          </button>
        </div>
      );
    } else {
      return (
        <div className="processed-actions">
          <div className="approval-info" title={user.status === 'approved' 
              ? `User approved by ${user.approvedBy || 'admin'} on ${formatDate(user.approvedAt)}` 
              : `User rejected by ${user.rejectedBy || 'admin'} on ${formatDate(user.rejectedAt)}`}>
            <div className="approval-text">
              {user.status === 'approved' 
                ? `Approved on ${formatDate(user.approvedAt)}` 
                : `Rejected on ${formatDate(user.rejectedAt)}`}
            </div>
            <div className="approval-details">
              {user.status === 'approved' 
                ? `Approved by ${user.approvedBy || 'admin'} on ${formatDate(user.approvedAt)}` 
                : `Rejected by ${user.rejectedBy || 'admin'} on ${formatDate(user.rejectedAt)}`}
            </div>
          </div>

          {user.status === 'approved' && (
            <div className="action-buttons-container">
              <button 
                className={`edit-btn ${isButtonLoading(user.id, 'edit') ? 'button-loading' : ''}`}
                onClick={() => openEditModal(user)}
                disabled={loading || buttonLoading.id !== null}
              >
                {isButtonLoading(user.id, 'edit') ? <span className="button-loader"></span> : 'Edit'}
              </button>
              <button 
                className={`delete-btn ${isButtonLoading(user.id, 'delete') ? 'button-loading' : ''}`}
                onClick={() => openDeleteModal(user)}
                disabled={loading || buttonLoading.id !== null}
              >
                {isButtonLoading(user.id, 'delete') ? <span className="button-loader"></span> : 'Delete'}
              </button>
              {renderDisableEnableButton(user)}
            </div>
          )}

          {user.status === 'rejected' && (
            <div className="action-buttons-container">
              <button 
                className={`delete-btn ${isButtonLoading(user.id, 'delete') ? 'button-loading' : ''}`}
                onClick={() => openDeleteModal(user)}
                disabled={loading || buttonLoading.id !== null}
              >
                {isButtonLoading(user.id, 'delete') ? <span className="button-loader"></span> : 'Delete'}
              </button>
            </div>
          )}
        </div>
      );
    }
  };

  const closeRejectModal = () => {
    setShowRejectModal(false);
    setSelectedUser(null);
    setRejectionReason('');
  };

  // Render the rejection modal
  const renderRejectModal = () => {
    if (!showRejectModal) return null;

    const isRejectButtonLoading = isButtonLoading(selectedUser?.id, 'reject');

    return (
      <div className="approval-modal-overlay">
        <div className="approval-modal">
          <h3>Reject User Registration</h3>
          <p>Are you sure you want to reject the registration for <strong>{selectedUser?.email}</strong>?</p>

          <div className="form-group">
            <label>Reason for Rejection</label>
            <textarea 
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="rejection-reason"
              placeholder="Provide a reason for rejecting this registration (optional)"
              disabled={isRejectButtonLoading}
              rows={4}
            />
          </div>

          <div className="modal-actions">
            <button 
              className="cancel-btn" 
              onClick={closeRejectModal}
              disabled={isRejectButtonLoading}
            >
              Cancel
            </button>
            <button 
              className={`delete-confirm-btn ${isRejectButtonLoading ? 'button-loading' : ''}`} 
              onClick={handleReject}
              disabled={isRejectButtonLoading}
              style={{ backgroundColor: "#1a1a1a", color: "white" }}
            >
              {isRejectButtonLoading ? (
                <span className="button-loader"></span>
              ) : 'Reject Registration'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="pending-users-container">
      <div className="pending-users-content">
        {notification.show && (
          <div className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        )}

        {error && !notification.show && <div className="error-message">{error}</div>}

        <div className="pending-users-table-container">
          <div className="pending-users-table-header">
            <h2>{getPageTitle()}</h2>
            <div className="user-filter-controls">
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search by email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    className="clear-search-btn" 
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="filter-buttons">
                <button 
                  className={`filter-btn ${statusFilter === 'all' ? 'active' : ''}`} 
                  onClick={() => setStatusFilter('all')}
                  disabled={loading}
                >
                  All Users
                </button>
                <button 
                  className={`filter-btn ${statusFilter === 'approved' ? 'active' : ''}`} 
                  onClick={() => setStatusFilter('approved')}
                  disabled={loading}
                >
                  Approved Users
                </button>
                <button 
                  className={`filter-btn ${statusFilter === 'pending' ? 'active' : ''}`} 
                  onClick={() => setStatusFilter('pending')}
                  disabled={loading}
                >
                  Pending Users
                </button>
              </div>
              <button 
                onClick={fetchPendingUsers} 
                className={`refresh-button ${loading && !buttonLoading.id ? 'button-loading' : ''}`}
                disabled={loading}
              >
                {loading && !buttonLoading.id ? (
                  <span className="button-loader"></span>
                ) : 'Refresh List'}
              </button>
            </div>
          </div>

          <div className="pending-users-table-scroll" ref={tableContainerRef}>
            {loading && !buttonLoading.id && <div className="loading">Loading...</div>}

            {!loading && filteredUsers().length === 0 ? (
              <div className="no-data">
                {statusFilter === 'all' ? 'No user registrations found' : 
                 statusFilter === 'approved' ? 'No approved users found' : 'No pending users found'}
              </div>
            ) : (
              <table className="pending-users-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Request Date</th>
                    <th>Status & Access</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers().map(user => (
                    <tr 
                      key={user.id} 
                      className={`status-row-${user.status} ${user.status !== 'pending' ? 'processed' : ''}`}
                    >
                      <td>{user.email}</td>
                      <td>{formatDate(user.requestDate)}</td>
                      <td>
                        {renderAccessBadge(user)}
                        {" "} {/* Add space between badges */}
                        {renderSystemAccessBadge(user.systemAccess)}
                        {" "} {/* Add space between badges */}
                        {renderEmailStatus(user)}
                        {renderAccountStatusBadge(user)}
                      </td>
                      <td className="actions">
                        {renderActionButtons(user)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {renderApprovalModal()}
      {renderDeleteModal()}
      {renderEditModal()}
      {renderDisableModal()}
      {renderEnableModal()}
      {renderRejectModal()}
    </div>
  );
};

export default PendingUsers; 