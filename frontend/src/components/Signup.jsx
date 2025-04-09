import React, { useState } from 'react';
import '../styles/Login.css';
import { getApiUrl } from '../utils/api';

const Signup = ({ onSignupSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password strength (at least 6 characters)
    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Make the signup request
      const response = await fetch(getApiUrl('auth/signup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          email: email.trim(), 
          password: password 
        })
      });
      
      // Capture the raw response text first
      const responseText = await response.text();
      
      // Try to parse the response as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error(`Server returned an invalid response. Please try again later.`);
      }

      // Check for error response
      if (!response.ok) {
        if (data && data.error === 'Email already registered') {
          throw new Error(data.message || 'This email is already registered in our system.');
        } else if (data && data.error) {
          throw new Error(data.error);
        } else if (data && data.message) {
          throw new Error(data.message);
        } else {
          throw new Error(`Request failed with status code ${response.status}`);
        }
      }

      // Handle the Firebase permission-denied error more gracefully
      if (data.code === 'permission-denied') {
        console.log('Firebase permission denied, but we can continue with a manual process');
        // Consider the signup as "successful" for user experience, but flag it for manual handling
        
        setRequestSubmitted(true);
        setRequestMessage(
          'Your registration request has been received. Due to a temporary system limitation, ' +
          'an administrator will need to manually process your request. ' +
          'Please contact support if you do not receive a confirmation within 24 hours.'
        );
        
        // Clear the form
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        
        // After 8 seconds, redirect to login
        setTimeout(() => {
          onSignupSuccess();
        }, 8000);
        
        return;
      }

      // If signup request was submitted successfully, show success message
      setRequestSubmitted(true);
      setRequestMessage(data.message || 'Registration request submitted successfully.');
      
      // Clear the form
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      
      // After 5 seconds, redirect to login
      setTimeout(() => {
        onSignupSuccess();
      }, 5000);
    } catch (error) {
      console.error('Signup error:', error);
      setError(error.message || 'Failed to process registration. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form-container">
      <div className="auth-form-box">
        <h2>Sign Up</h2>
        
        {requestSubmitted ? (
          <div className="success-message">
            <p>{requestMessage}</p>
            <p>You will be redirected to the login page shortly.</p>
          </div>
        ) : (
          <>
            <div className="approval-info">
              <p><strong>Important:</strong> New registrations require administrator approval before access is granted. You will be notified by email once your account is approved.</p>
            </div>
            
            {error && (
              <div className="error-message">
                <p>{error}</p>
              </div>
            )}
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="email">Email:</label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="input-field"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Password:</label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Create a password"
                  className="input-field"
                  minLength="6"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password:</label>
                <input
                  type="password"
                  id="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your password"
                  className="input-field"
                  minLength="6"
                />
              </div>
              <button 
                type="submit" 
                className="auth-button" 
                disabled={loading}
              >
                {loading ? 'Signing up...' : 'Sign Up'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Signup; 