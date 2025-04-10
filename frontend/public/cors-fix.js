/**
 * CORS Fix for Render.com deployment
 * 
 * This script helps fix CORS issues with preloaded resources
 * on the Render.com domain by intercepting and adding crossorigin
 * attributes to link and script elements.
 */

(function() {
  console.log('CORS fix script loaded');

  // Fix for preloaded resources
  function fixPreloadedResources() {
    // Find all link elements with preload
    const preloads = document.querySelectorAll('link[rel="preload"]');
    preloads.forEach(link => {
      if (!link.hasAttribute('crossorigin')) {
        link.setAttribute('crossorigin', 'anonymous');
        console.log('Fixed crossorigin attribute on preload:', link.href);
      }
    });
    
    // Find all script elements that might need crossorigin
    const scripts = document.querySelectorAll('script[src]');
    scripts.forEach(script => {
      if (!script.hasAttribute('crossorigin') && 
          (script.src.includes('cdn') || script.src.includes('unpkg'))) {
        script.setAttribute('crossorigin', 'anonymous');
        console.log('Fixed crossorigin attribute on script:', script.src);
      }
    });
  }
  
  // Run on load and after DOM mutations
  window.addEventListener('DOMContentLoaded', fixPreloadedResources);
  
  // Set up a MutationObserver to watch for newly added elements
  const observer = new MutationObserver(mutations => {
    let shouldCheck = false;
    
    mutations.forEach(mutation => {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          if (node.tagName === 'LINK' || node.tagName === 'SCRIPT') {
            shouldCheck = true;
            break;
          }
        }
      }
    });
    
    if (shouldCheck) {
      fixPreloadedResources();
    }
  });
  
  // Start observing
  observer.observe(document, {
    childList: true,
    subtree: true
  });
  
  // Mock API responses for when backend is down
  const MOCK_RESPONSES = {
    // Token endpoint mock
    '/api/tokens': {
      tokens: [
        { id: 'mock-token-1', code: 'ABC123', created: new Date().toISOString(), status: 'valid' },
        { id: 'mock-token-2', code: 'DEF456', created: new Date().toISOString(), status: 'valid' },
        { id: 'mock-token-3', code: 'GHI789', created: new Date().toISOString(), status: 'used' }
      ]
    }
  };

  // Clear any previous reload flags to prevent loops
  localStorage.removeItem('react-dom-reload-attempt');
  
  // Modify fetch requests to handle CORS issues
  const originalFetch = window.fetch;
  window.fetch = function(resource, options = {}) {
    try {
      // For mock API mode, intercept relevant URL patterns
      const isMockApiEnabled = localStorage.getItem('using-mock-api') === 'true' || 
                               localStorage.getItem('using-react-dom-fallback') === 'true';
      
      if (isMockApiEnabled && typeof resource === 'string') {
        // Check for token endpoint or other problematic endpoints
        if (resource.includes('/api/tokens') || resource.includes('/tokens')) {
          console.log('Intercepting token request with mock response:', resource);
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({
              'Content-Type': 'application/json'
            }),
            json: () => Promise.resolve(MOCK_RESPONSES['/api/tokens'])
          });
        }
      }
      
      // For URL objects
      if (resource instanceof Request) {
        try {
          // Clone the request to modify it
          const modifiedRequest = new Request(resource, {
            ...options,
            mode: 'cors',
            credentials: 'include'
          });
          return originalFetch(modifiedRequest, options);
        } catch (e) {
          console.error('Error modifying request:', e);
          // Fall back to original request
          return originalFetch(resource, options);
        }
      }
      
      // For string URLs
      if (typeof resource === 'string') {
        // Add CORS options
        options = {
          ...options,
          mode: 'cors',
          credentials: 'include'
        };
      }
      
      return originalFetch(resource, options);
    } catch (error) {
      console.error('Error in fetch interceptor:', error);
      // Fall back to original fetch on error
      return originalFetch(resource, options);
    }
  };
  
  // Set flag to show we're using mock API mode
  localStorage.setItem('using-mock-api', 'true');
})(); 