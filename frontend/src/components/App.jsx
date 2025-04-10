import React, { useEffect } from 'react';
import { USE_MOCK_API } from '../utils/api';

// Component code...

// Handle health check endpoint errors by providing an alternative response
useEffect(() => {
  // Create a custom fetch for the health endpoint
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    // If it's a health check endpoint and mock API is enabled
    if (USE_MOCK_API && typeof url === 'string' && url.includes('/health')) {
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
}, []);

// Rest of the component code... 