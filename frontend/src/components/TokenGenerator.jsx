import React, { useState, useEffect } from 'react';
import '../styles/TokenGenerator.css';
import PendingUsers from './PendingUsers';
import { getApiUrl, fetchWithAuth } from '../utils/api';

const TokenGenerator = ({ onLogout }) => {
  const [tokens, setTokens] = useState([]);
  const [description, setDescription] = useState('');
  const [expiration, setExpiration] = useState('30d');
  const [system, setSystem] = useState('evaluation');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tokenToDelete, setTokenToDelete] = useState(null);
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [loadingTokenId, setLoadingTokenId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('tokens');
  const [currentUser, setCurrentUser] = useState(null);
  const [pendingUsersCount, setPendingUsersCount] = useState(0);
  const [hasPendingNotification, setHasPendingNotification] = useState(false);
  const [dailyTokensCreated, setDailyTokensCreated] = useState(0);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  // Get current user data from the token
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        // Decode JWT token to get user data
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const userData = JSON.parse(jsonPayload);
        console.log('Current user loaded from token:', userData);
        console.log('Current expiration value before user update:', expiration);
        setCurrentUser(userData);

        // Set appropriate default expiration based on user role and access type
        if (userData.role === 'admin') {
          console.log('Setting default expiration for admin user to 7d');
          setExpiration('7d');
        } else if (userData.accessType === 'trial') {
          // If there's a stored selectedTrialDuration, use that directly
          if (userData.selectedTrialDuration) {
            console.log(`Setting expiration based on selected trial duration: ${userData.selectedTrialDuration} days`);
            // Force token expiration to match trial duration (no longer than trial)
            const trialDuration = parseInt(userData.selectedTrialDuration, 10);
            if (trialDuration === 1) {
              setExpiration('1d'); // 1-day trial users can only use 1d expiration
            } else if (trialDuration === 3) {
              setExpiration('3d'); // 3-day trial users can only use 3d expiration
            } else {
              setExpiration('7d'); // 7-day trial users can only use 7d expiration
            }
          } 
          // Otherwise try to determine from expiration date
          else if (userData.expiresAt) {
            try {
              // Get reference date (either creation or approval date)
              const startDate = userData.updatedAt ? new Date(userData.updatedAt) : 
                                (userData.approvedAt ? new Date(userData.approvedAt) : new Date());
              const expiresDate = new Date(userData.expiresAt);

              // Calculate difference in days
              const diffTime = Math.abs(expiresDate - startDate);
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

              console.log(`Trial duration calculation: ${diffDays} days from ${startDate.toISOString()} to ${expiresDate.toISOString()}`);

              // Set expiration exactly matching the trial duration (no longer than trial)
              if (diffDays <= 1) {
                console.log('Setting default token expiration to 1d for 1-day trial user');
                setExpiration('1d');
              } else if (diffDays <= 3) {
                console.log('Setting default token expiration to 3d for 3-day trial user');
                setExpiration('3d');
              } else {
                console.log('Setting default token expiration to 7d for 7-day trial user');
                setExpiration('7d');
              }
            } catch (e) {
              console.error('Error calculating trial duration, defaulting to 7d:', e);
              setExpiration('7d');
            }
          } else {
            // Default for trial users if we can't determine the specific duration
            console.log('No trial duration info available, defaulting to 7d');
            setExpiration('7d');
          }
        }

        // Set default system based on systemAccess
        if (userData.systemAccess) {
          if (userData.systemAccess === 'evaluation') {
            setSystem('evaluation');
          } else if (userData.systemAccess === 'grading') {
            setSystem('grading');
          }
          // If 'both', keep the current default
        }

        console.log('Current expiration value after user update:', expiration);
      } catch (error) {
        console.error('Error decoding token:', error);
      }
    }
  }, []);

  // Add effect to monitor expiration changes
  useEffect(() => {
    console.log('Expiration value changed to:', expiration);
  }, [expiration]);

  // Update current time more frequently for seconds display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  // Fetch pending users count for admin
  useEffect(() => {
    if (currentUser && currentUser.role === 'admin') {
      const fetchPendingCount = async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(getApiUrl('pending-users'), {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });

          if (response.ok) {
            const data = await response.json();
            const pendingCount = data.filter(user => user.status === 'pending').length;
            setPendingUsersCount(pendingCount);
            if (pendingCount > 0 && activeTab !== 'users') {
              setHasPendingNotification(true);
            }
          }
        } catch (error) {
          console.error('Error fetching pending users count:', error);
        }
      };

      fetchPendingCount();

      // Set up interval to periodically check for new pending users
      const interval = setInterval(fetchPendingCount, 60000); // Check every minute

      return () => clearInterval(interval);
    }
  }, [currentUser, activeTab]);

  // Clear notification when switching to users tab
  useEffect(() => {
    if (activeTab === 'users') {
      setHasPendingNotification(false);
    }
  }, [activeTab]);

  // Function to calculate expiration date from creation date and expiration string
  const calculateExpirationDate = (createdAt, expirationString) => {
    const created = new Date(createdAt);

    // Parse the expiration string (e.g., "30d", "7d", "365d")
    const match = expirationString.match(/^(\d+)([dhmy])$/);
    if (!match) return null;

    const [, value, unit] = match;
    const numValue = parseInt(value, 10);

    const expDate = new Date(created);

    switch (unit) {
      case 'd': // days
        expDate.setDate(expDate.getDate() + numValue);
        break;
      case 'h': // hours
        expDate.setHours(expDate.getHours() + numValue);
        break;
      case 'm': // months
        expDate.setMonth(expDate.getMonth() + numValue);
        break;
      case 'y': // years
        expDate.setFullYear(expDate.getFullYear() + numValue);
        break;
      default:
        return null;
    }

    return expDate;
  };

  // Function to format time remaining until expiration
  const formatTimeRemaining = (expirationDate, currentTime) => {
    if (!expirationDate) return 'Unknown';

    const now = currentTime || new Date();
    const diff = expirationDate - now;

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    // Format hours, minutes and seconds to always have 2 digits
    const formattedHours = hours.toString().padStart(2, '0');
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toString().padStart(2, '0');

    if (days > 30) {
      return `${Math.floor(days / 30)} months, ${days % 30} days`;
    } else if (days > 0) {
      return `${days} days, ${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    } else {
      return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`;
    }
  };

  // Calculate daily tokens usage
  const calculateDailyTokensUsage = (tokensList) => {
    // Skip calculation for admin users - they have unlimited tokens
    if (currentUser && currentUser.role === 'admin') {
      setDailyTokensCreated(0);
      return;
    }

    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Filter tokens created today
    const todayTokens = tokensList.filter(token => {
      const tokenDate = new Date(token.createdAt);
      return tokenDate >= today;
    });

    setDailyTokensCreated(todayTokens.length);
  };

  const fetchTokens = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('Fetching tokens with auth token:', token ? 'present' : 'missing');

      const response = await fetch(getApiUrl('tokens'), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch tokens');
      }

      const data = await response.json();
      setTokens(data);

      // Calculate daily tokens usage based on fetched tokens
      calculateDailyTokensUsage(data);
    } catch (error) {
      console.error('Error fetching tokens:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  // Reset copied state after 2 seconds
  useEffect(() => {
    if (copiedTokenId) {
      const timer = setTimeout(() => {
        setCopiedTokenId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copiedTokenId]);

  const handleGenerateToken = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsGeneratingToken(true);

    try {
      const token = localStorage.getItem('token');
      const tokenExpiration = expiration; // Make a local copy to ensure it's not modified
      console.log('Generating token with:', { description, expiration: tokenExpiration, system });

      const response = await fetch(getApiUrl('tokens/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ 
          description, 
          expiration: tokenExpiration, // Use the local copy
          system 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || data.error || 'Failed to generate token');
      }

      console.log('Token generated successfully:', { id: data.id, expiration: data.expiration });
      setSuccess('Token generated successfully!');
      setDescription('');
      await fetchTokens(); // This will update the dailyTokensCreated count
    } catch (error) {
      console.error('Error generating token:', error);
      setError(error.message);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleDeleteToken = (tokenId) => {
    // Set the token to delete regardless of expiration status
    setTokenToDelete(tokenId);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteToken = async () => {
    try {
      setError('');
      setSuccess('');
      
      const token = localStorage.getItem('token');
      
      console.log(`Attempting to delete token with ID: ${tokenToDelete}`);

      const response = await fetch(getApiUrl(`tokens/${tokenToDelete}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete token');
      }

      // Close the modal first
      setShowDeleteConfirm(false);
      setTokenToDelete(null);
      
      // Then show success message and refresh the list
      setSuccess('Token deleted successfully!');
      await fetchTokens();
    } catch (error) {
      console.error('Error deleting token:', error);
      setError(`Failed to delete token: ${error.message}`);
      setShowDeleteConfirm(false);
      setTokenToDelete(null);
    }
  };

  const cancelDeleteToken = () => {
    setShowDeleteConfirm(false);
    setTokenToDelete(null);
  };

  const copyTokenToClipboard = async (id, obfuscatedToken) => {
    setCopiedTokenId(null);
    setLoadingTokenId(id);

    try {
      const token = localStorage.getItem('token');

      // Get full token value
      const response = await fetch(getApiUrl(`tokens/${id}/full`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to retrieve token');
      }

      const data = await response.json();

      // Copy to clipboard
      await navigator.clipboard.writeText(data.token);

      setLoadingTokenId(null);
      setCopiedTokenId(id);
    } catch (error) {
      console.error('Error copying token:', error);
      setError('Failed to copy token: ' + error.message);
      setLoadingTokenId(null);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    if (onLogout) {
      onLogout();
    }
  };

  const showLogoutConfirmation = () => {
    setShowLogoutConfirm(true);
  };

  const cancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // Get trial expiration info
  const getTrialInfo = () => {
    if (!currentUser || !currentUser.accessType || currentUser.accessType === 'unlimited') {
      return null;
    }

    if (currentUser.accessType === 'trial' && currentUser.expiresAt) {
      const expiryDate = new Date(currentUser.expiresAt);
      const now = new Date();
      const isExpired = now > expiryDate;

      if (isExpired) {
        return {
          isExpired: true,
          message: 'Your trial has expired. Please contact the administrator for full access.'
        };
      }

      return {
        isExpired: false,
        message: `Trial expires in ${formatTimeRemaining(expiryDate, now)}`,
        expiryDate
      };
    }

    return null;
  };

  const trialInfo = getTrialInfo();

  // Render token form section with daily limit info
  const renderTokenForm = () => {
    const remainingTokens = 5 - dailyTokensCreated;
    const hasReachedLimit = remainingTokens <= 0;
    const isAdmin = currentUser && currentUser.role === 'admin';

    return (
      <div className="form-container">
        <h2>Generate New API Token</h2>
        {!isAdmin && (
        <div className="daily-limit-info">
          <div className={`limit-status ${hasReachedLimit ? 'limit-reached' : ''}`}>
            <span className="limit-label">Daily Limit:</span>
            <span className="limit-value">{dailyTokensCreated} / 5 tokens used</span>
            {!hasReachedLimit && (
              <span className="remaining-tokens">
                ({remainingTokens} token{remainingTokens !== 1 ? 's' : ''} remaining today)
              </span>
            )}
          </div>
          {hasReachedLimit && (
            <div className="limit-warning">
              You've reached your daily limit of 5 tokens. Please try again tomorrow.
            </div>
          )}
        </div>
        )}
        {isAdmin && (
          <div className="admin-note">
            <p>As an admin, you can generate unlimited tokens with no daily limit.</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleGenerateToken}>
          <div className="form-group">
            <label>Description</label>
            <input 
              type="text" 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Enter a description for this token" 
              required 
              disabled={(!isAdmin && hasReachedLimit) || trialInfo?.isExpired || isGeneratingToken}
            />
          </div>
          <div className="form-group">
            <label>Expiration</label>
            <select 
              value={expiration} 
              onChange={(e) => {
                console.log('Expiration selected by user:', e.target.value);
                setExpiration(e.target.value);
              }}
              disabled={(!isAdmin && hasReachedLimit) || trialInfo?.isExpired || isGeneratingToken}
            >
              {/* Admin users get the admin-specific options */}
              {currentUser && currentUser.role === 'admin' && (
                <>
                  <option value="1h">1 Hour</option>
                  <option value="1d">1 Day</option>
                  <option value="3d">3 Days</option>
                  <option value="7d">7 Days</option>
                  <option value="never">Never Expires</option>
                </>
              )}

              {/* Users with unlimited access get the same limited options as admin */}
              {currentUser && currentUser.accessType === 'unlimited' && currentUser.role !== 'admin' && (
                <>
                  <option value="1h">1 Hour</option>
                  <option value="1d">1 Day</option>
                  <option value="3d">3 Days</option>
                  <option value="7d">7 Days</option>
                  <option value="never">Never Expires</option>
                </>
              )}

              {/* Show hourly options only for regular users (not unlimited, not admin, not trial) */}
              {currentUser && currentUser.accessType !== 'unlimited' && currentUser.accessType !== 'trial' && currentUser.role !== 'admin' && (
                <>
                <option value="1h">1 Hour</option>
                <option value="24h">24 Hours</option>
                </>
              )}

              {/* For 1-day trial users, show ONLY 1d option */}
              {currentUser && currentUser.accessType === 'trial' && 
               (currentUser.selectedTrialDuration === '1' || 
                (currentUser.expiresAt && (() => {
                  try {
                    const startDate = currentUser.updatedAt ? new Date(currentUser.updatedAt) : 
                                     (currentUser.approvedAt ? new Date(currentUser.approvedAt) : new Date());
                    const expiresDate = new Date(currentUser.expiresAt);
                    const diffTime = Math.abs(expiresDate - startDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays <= 1;
                  } catch (e) {
                    return false;
                  }
                })())
               ) && (
                <option value="1d">1 Day</option>
              )}

              {/* For 3-day trial users, show ONLY 3d option */}
              {currentUser && currentUser.accessType === 'trial' && 
               (currentUser.selectedTrialDuration === '3' || 
                (currentUser.expiresAt && (() => {
                  try {
                    const startDate = currentUser.updatedAt ? new Date(currentUser.updatedAt) : 
                                     (currentUser.approvedAt ? new Date(currentUser.approvedAt) : new Date());
                    const expiresDate = new Date(currentUser.expiresAt);
                    const diffTime = Math.abs(expiresDate - startDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays > 1 && diffDays <= 3;
                  } catch (e) {
                    return false;
                  }
                })())
               ) && (
                  <option value="3d">3 Days</option>
              )}

              {/* For 7-day trial users, show ONLY 7d option */}
              {currentUser && currentUser.accessType === 'trial' && 
               (currentUser.selectedTrialDuration === '7' || 
                (currentUser.expiresAt && (() => {
                  try {
                    const startDate = currentUser.updatedAt ? new Date(currentUser.updatedAt) : 
                                     (currentUser.approvedAt ? new Date(currentUser.approvedAt) : new Date());
                    const expiresDate = new Date(currentUser.expiresAt);
                    const diffTime = Math.abs(expiresDate - startDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays > 3;
                  } catch (e) {
                    return false;
                  }
                })())
               ) && (
              <option value="7d">7 Days</option>
              )}

              {/* For regular non-admin users WITHOUT unlimited access, show standard day options */}
              {currentUser && currentUser.accessType !== 'unlimited' && currentUser.accessType !== 'trial' && currentUser.role !== 'admin' && (
                <>
                  <option value="1d">1 Day</option>
                  <option value="3d">3 Days</option>
                  <option value="7d">7 Days</option>
                  <option value="30d">30 Days</option>
                  <option value="90d">90 Days</option>
                  <option value="365d">1 Year</option>
                </>
              )}
            </select>
          </div>
          <div className="form-group">
            <label>System</label>
            {currentUser?.systemAccess && currentUser.systemAccess !== 'both' ? (
              <>
                <div className="static-field">
                  {currentUser.systemAccess === 'evaluation' ? 'Evaluation System' : 'Grading System'}
                </div>
                <div className="form-note">
                  Your account is restricted to generating tokens for the {currentUser.systemAccess} system only.
                </div>
              </>
            ) : (
              <>
                <select 
                  value={system} 
                  onChange={(e) => setSystem(e.target.value)}
                  disabled={(!isAdmin && hasReachedLimit) || trialInfo?.isExpired || isGeneratingToken}
                >
                  {(!currentUser?.systemAccess || 
                    currentUser.systemAccess === 'both' || 
                    currentUser.systemAccess === 'evaluation') && (
                    <option value="evaluation">Evaluation System</option>
                  )}
                  {(!currentUser?.systemAccess || 
                    currentUser.systemAccess === 'both' || 
                    currentUser.systemAccess === 'grading') && (
                    <option value="grading">Grading System</option>
                  )}
                </select>
              </>
            )}
          </div>
          <button 
            type="submit" 
            className={`generate-button ${isGeneratingToken ? 'loading' : ''}`}
            disabled={((!isAdmin && hasReachedLimit) || trialInfo?.isExpired || isGeneratingToken)}
          >
            {isGeneratingToken ? (
              <>
                <span className="loading-spinner"></span>
                <span>Generating...</span>
              </>
            ) : (
              'Generate Token'
            )}
          </button>
          {!isAdmin && hasReachedLimit && (
            <div className="limit-note">
              Each user is limited to generating 5 tokens per day to prevent abuse.
            </div>
          )}
        </form>
      </div>
    );
  };

  return (
    <div className="token-generator-container">
      {/* Header with user info and logout button */}
      <div className="header">
        <div>
          <h1>Token Generator</h1>
          {currentUser && (
            <div className="user-info">
              Logged in as <span className="user-email">{currentUser.email}</span>
              {currentUser.role === 'admin' && <span className="super-admin-badge">Admin</span>}
              {currentUser.email === 'moderator@gmail.com' && <span className="moderator-badge">Moderator</span>}
              {currentUser.systemAccess && (
                <span className="system-access-indicator">
                  {currentUser.systemAccess === 'both' ? 'All Systems Access' : 
                   currentUser.systemAccess === 'evaluation' ? 'Evaluation System Only' : 'Grading System Only'}
                </span>
              )}
            </div>
          )}
        </div>
        <button onClick={showLogoutConfirmation} className="logout-button">
          Logout
        </button>
      </div>

      {/* Tabs for navigation */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'tokens' ? 'active' : ''}`}
          onClick={() => setActiveTab('tokens')}
        >
          Token Management
        </button>

        {currentUser && currentUser.role === 'admin' && (
          <button 
            className={`tab ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Approvals
            {hasPendingNotification && pendingUsersCount > 0 && (
              <span className="notification-badge">{pendingUsersCount}</span>
            )}
          </button>
        )}
      </div>

      {/* Trial status bar if applicable */}
      {trialInfo && (
        <div className={`trial-status-bar ${trialInfo.isExpired ? 'expired' : ''}`}>
          {trialInfo.message}
        </div>
      )}

      {/* Content based on active tab */}
      {activeTab === 'tokens' ? (
        // Token management content
        <div className="tokens-container">
          {/* Form to generate new tokens */}
          {renderTokenForm()}

          {/* Tokens list */}
          <div className="tokens-list">
            <div className="tokens-list-header">
              <h2>Your API Tokens</h2>
              <button onClick={fetchTokens} className="refresh-button">
                Refresh List
              </button>
            </div>

            <div className="table-container">
              {tokens.length === 0 ? (
                <div className="no-tokens">
                  <p>You haven't generated any tokens yet.</p>
                  <p>Each user can only see and manage their own tokens. Generate a new token using the form above to get started.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Created</th>
                      <th>Expires</th>
                      <th>System</th>
                      <th>Token</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map(token => (
                      <tr key={token.id}>
                        <td>{token.description}</td>
                        <td>{new Date(token.createdAt).toLocaleString()}</td>
                        <td>
                          {(() => {
                            const expDate = calculateExpirationDate(token.createdAt, token.expiration);
                            if (!expDate) return 'Invalid expiration';

                            const isExpired = expDate < currentTime;

                            if (isExpired) {
                              return <span className="expired">Expired</span>;
                            }

                            return (
                              <div className="expiration-info">
                                <div>{expDate.toLocaleString()}</div>
                                <div className="time-remaining">
                                  {formatTimeRemaining(expDate, currentTime)}
                                </div>
                              </div>
                            );
                          })()}
                        </td>
                        <td>
                          <span className={`system-tag ${token.system}`}>
                            {token.system === 'evaluation' ? 'Evaluation' : 'Grading'}
                          </span>
                        </td>
                        <td>
                          <div className="token-display">
                            {(() => {
                              const expDate = calculateExpirationDate(token.createdAt, token.expiration);
                              const isExpired = expDate && expDate < currentTime;
                              
                              if (isExpired) {
                                return (
                                  <>
                                    <span className="token-value hidden-token">{token.displayToken}</span>
                                    <button 
                                      className="copy-button"
                                      disabled={true}
                                    >
                                      <span>Copy</span>
                                    </button>
                                  </>
                                );
                              } else {
                                return (
                                  <>
                                    <span className="token-value">{token.displayToken}</span>
                                    <button 
                                      className="copy-button"
                                      onClick={() => copyTokenToClipboard(token.id, token.token)}
                                      disabled={loadingTokenId === token.id || trialInfo?.isExpired}
                                    >
                                      {loadingTokenId === token.id ? (
                                        <span className="loading-indicator">Loading...</span>
                                      ) : copiedTokenId === token.id ? (
                                        <span className="copied-indicator">Copied!</span>
                                      ) : (
                                        <span>Copy</span>
                                      )}
                                    </button>
                                  </>
                                );
                              }
                            })()}
                          </div>
                        </td>
                        <td>
                          <button 
                            className="delete-button"
                            onClick={() => handleDeleteToken(token.id)}
                            disabled={trialInfo?.isExpired}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : (
        // User approvals content (only for super admin)
        currentUser && currentUser.role === 'admin' && (
          <PendingUsers />
        )
      )}

      {/* Logout confirmation dialog */}
      {showLogoutConfirm && (
        <div className="confirmation-dialog">
          <div className="confirmation-content">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>
            <div className="confirmation-buttons">
              <button onClick={handleLogout} className="confirm-button">Yes, Logout</button>
              <button onClick={cancelLogout} className="cancel-button">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete token confirmation dialog */}
      {showDeleteConfirm && (
        <div className="confirmation-dialog">
          <div className="confirmation-content">
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete this token? This action cannot be undone.</p>
            <div className="confirmation-buttons">
              <button onClick={confirmDeleteToken} className="confirm-button">Yes, Delete</button>
              <button onClick={cancelDeleteToken} className="cancel-button">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TokenGenerator; 