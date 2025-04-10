/**
 * React DOM Client Fallback
 * 
 * This script provides a fallback mechanism when react-dom_client.js fails to load
 * with a 502 error. It will dynamically attempt to load React DOM from a CDN.
 */

(function() {
  console.log('React DOM Fallback script loaded');
  
  // Prevent infinite refresh loop
  if (localStorage.getItem('react-dom-fallback-loaded')) {
    console.log('Already attempted to load fallback, skipping to prevent refresh loop');
    // Clear any reload attempts that might be causing loops
    localStorage.removeItem('react-dom-reload-attempt');
    return;
  }
  
  // Check if we need to use the fallback
  const needsFallback = 
    !window.React || 
    !window.ReactDOM ||
    (localStorage.getItem('react-dom-reload-attempt') && 
     Date.now() - localStorage.getItem('react-dom-reload-attempt') < 10000);
  
  if (needsFallback) {
    console.log('Loading React DOM from CDN fallback...');
    
    // Mark that we've attempted to load the fallback to prevent loops
    localStorage.setItem('react-dom-fallback-loaded', Date.now());
    
    // Create script elements for React and ReactDOM
    const reactScript = document.createElement('script');
    reactScript.src = 'https://unpkg.com/react@18/umd/react.production.min.js';
    reactScript.crossOrigin = 'anonymous';
    
    const reactDomScript = document.createElement('script');
    reactDomScript.src = 'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js';
    reactDomScript.crossOrigin = 'anonymous';
    
    // Append to document
    document.head.appendChild(reactScript);
    document.head.appendChild(reactDomScript);
    
    // Mark that we've used the fallback
    localStorage.setItem('using-react-dom-fallback', 'true');
    
    // Only reload once
    if (!localStorage.getItem('page-reloaded-for-fallback')) {
      localStorage.setItem('page-reloaded-for-fallback', 'true');
      
      // Reload the page after a delay to let the scripts load
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
  }
})(); 