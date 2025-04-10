import React, { useState } from 'react';
import '../styles/Login.css';
import { getApiUrl, fetchWithAuth } from '../utils/api';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactEmail, setContactEmail] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactStatus, setContactStatus] = useState({ show: false, message: '', type: '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      const response = await fetch(getApiUrl('auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      // Check for empty response before trying to parse JSON
      const responseText = await response.text();
      let data;
      
      try {
        // Only try to parse as JSON if there's actual content
        data = responseText ? JSON.parse(responseText) : {};
      } catch (jsonError) {
        console.error('Error parsing JSON response:', jsonError, 'Raw response:', responseText);
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('Server returned an empty response. The backend might be unavailable or experiencing issues.');
        } else {
          throw new Error('The server response was not valid. This might indicate a backend issue.');
        }
      }

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          throw new Error('Invalid email or password. Please try again.');
        } else if (response.status === 403) {
          throw new Error('Your account is not approved yet or has been disabled.');
        } else if (response.status >= 500) {
          throw new Error('The server encountered an error. Please try again later.');
        }
        
        // Use the error message from the response if available
        throw new Error(data.error || data.message || `Login failed with status ${response.status}`);
      }

      // Check if the response contains a token
      if (!data.token) {
        throw new Error('No authentication token received. Please try again.');
      }

      localStorage.setItem('token', data.token);
      onLogin(data.token);
    } catch (error) {
      console.error('Login error:', error);
      
      // Show a connectivity error if the fetch operation failed
      if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        setError('Unable to connect to the server. Please check your internet connection and try again.');
      } else {
        setError(error.message || 'Failed to login. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setContactStatus({ show: false, message: '', type: '' });
    
    if (!contactEmail.trim() || !contactMessage.trim()) {
      setContactStatus({
        show: true,
        message: 'Please fill in all fields.',
        type: 'error'
      });
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(getApiUrl('admin-contacts'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email: contactEmail.trim(), 
          message: contactMessage.trim(),
          subject: 'Registration Assistance Request'
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message');
      }

      setContactStatus({
        show: true,
        message: 'Your message has been sent. An administrator will contact you shortly.',
        type: 'success'
      });
      
      // Clear the form
      setContactEmail('');
      setContactMessage('');
      
      // Hide the contact form after success
      setTimeout(() => {
        setShowContactForm(false);
      }, 3000);
      
    } catch (error) {
      setContactStatus({
        show: true,
        message: error.message || 'Failed to send message. Please try again.',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Close modal if user clicks outside of it
  const handleModalBackdropClick = (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      setShowContactForm(false);
      // Reset status when closing the form
      setContactStatus({ show: false, message: '', type: '' });
    }
  };

  return (
    <div className="auth-form-container">
      <div className="auth-form-box">
        <h2> Login</h2>
        {error && <div className="error-message">{error}</div>}
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
              placeholder="Enter your password"
              className="input-field"
            />
          </div>
          <button 
            type="submit" 
            className="auth-button"
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="customer-service-section">
          <button 
            className="contact-toggle-btn" 
            onClick={() => setShowContactForm(true)}
            disabled={loading}
          >
            Need help with your registration?
          </button>
        </div>
      </div>

      {/* Contact Form Modal */}
      {showContactForm && (
        <div className="modal-backdrop" onClick={handleModalBackdropClick}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Contact Administrator</h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setShowContactForm(false)}
              >
                &times;
              </button>
            </div>
            
            {contactStatus.show && (
              <div className={`notification ${contactStatus.type}`}>
                {contactStatus.message}
              </div>
            )}
            
            <form onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label htmlFor="contactEmail">Your Email:</label>
                <input
                  type="email"
                  id="contactEmail"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="input-field"
                  disabled={loading}
                />
              </div>
              <div className="form-group">
                <label htmlFor="contactMessage">Message to Admin:</label>
                <textarea
                  id="contactMessage"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  required
                  placeholder="Describe your issue with registration"
                  className="input-field textarea"
                  rows="4"
                  disabled={loading}
                ></textarea>
              </div>
              <button 
                type="submit" 
                className="contact-submit-btn"
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login; 