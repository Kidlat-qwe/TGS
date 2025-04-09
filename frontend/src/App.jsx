import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Signup from './components/Signup';
import TokenGenerator from './components/TokenGenerator';
import './styles/App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  
  // Get API base URL from environment variable or use a relative URL as fallback
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    
    // Function to verify token validity with the server
    const verifyToken = async () => {
      try {
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
