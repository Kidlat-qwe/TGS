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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      onLogin(data.token);
    } catch (error) {
      setError(error.message);
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