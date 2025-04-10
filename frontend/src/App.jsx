import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import TokenGenerator from './components/TokenGenerator';
import './styles/App.css';
import { USE_MOCK_API } from './utils/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  
  // Get API base URL from environment variable or use a relative URL as fallback
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  // Set up a fetch interceptor for health endpoints to handle server errors
  useEffect(() => {
    if (USE_MOCK_API) {
      // Store the original fetch function
      const originalFetch = window.fetch;
      
      // Replace with our interceptor
      window.fetch = function(url, options) {
        if (typeof url === 'string' && url.includes('/health')) {
          console.log('Intercepting health check request with mock response');
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              status: 'healthy',
              uptime: '3d 2h 45m',
              version: '1.0.0',
              mock: true
            })
          });
        }
        // Otherwise use the original fetch
        return originalFetch.apply(this, arguments);
      };
      
      // Restore original fetch on component unmount
      return () => {
        window.fetch = originalFetch;
      };
    }
  }, []);

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    
    // Function to verify token validity with the server
    const verifyToken = async () => {
      try {
        // If Mock API is enabled, consider the token valid
        if (USE_MOCK_API && token) {
          console.log('Using mock API - automatic authentication');
          setIsAuthenticated(true);
          return;
        }
        
        // Call a health check endpoint that requires authentication
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          },
          credentials: 'include' // Include cookies in the request
        });
        
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          // If token is invalid, clear it from localStorage
          localStorage.removeItem('token');
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error('Token verification error:', error);
        
        // Even if there's an error, if mock API is enabled, proceed with authentication
        if (USE_MOCK_API && token) {
          console.log('Error communicating with server, but mock API is enabled - proceeding with authentication');
          setIsAuthenticated(true);
          return;
        }
        
        localStorage.removeItem('token');
        setIsAuthenticated(false);
      }
    };
    
    // If there's a token in localStorage or we might have a cookie, verify it
    verifyToken();
  }, [API_BASE_URL]);

  const handleLogin = (token) => {
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    // Clear token from localStorage
    localStorage.removeItem('token');
    
    try {
      // Call the server's logout endpoint to clear the cookie
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include', // Include cookies in the request
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Error during logout:', error);
    }
    
    // Set app state to unauthenticated
    setIsAuthenticated(false);
  };

  const handleSignupSuccess = () => {
    // After successful signup, show login screen
    setShowSignup(false);
  };

  return (
    <div className="app">
      {!isAuthenticated ? (
        <div className="auth-container">
          <div className="auth-header">
            <h1>Token Generator System</h1>
            <p>Welcome to the RHET Token Generator admin portal</p>
          </div>
          
          {showSignup ? (
            <>
              <Signup onSignupSuccess={handleSignupSuccess} />
              <p className="auth-toggle">
                Already have an account? <button onClick={() => setShowSignup(false)}>Login</button>
              </p>
            </>
          ) : (
            <>
              <Login onLogin={handleLogin} />
              <p className="auth-toggle">
                Need an account? <button onClick={() => setShowSignup(true)}>Sign Up</button>
              </p>
            </>
          )}
        </div>
      ) : (
        <TokenGenerator onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
