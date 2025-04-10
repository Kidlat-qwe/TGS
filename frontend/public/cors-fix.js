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
  
  // Modify fetch requests to handle CORS issues
  const originalFetch = window.fetch;
  window.fetch = function(resource, options = {}) {
    // For URL objects
    if (resource instanceof Request) {
      // Clone the request to modify it
      const modifiedRequest = new Request(resource, {
        ...resource,
        mode: 'cors',
        credentials: 'include'
      });
      return originalFetch(modifiedRequest, options);
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
  };
})(); 