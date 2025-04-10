
# Browser Troubleshooting Steps

If you're experiencing 502 Bad Gateway errors with react-dom_client.js, follow these steps:

## Step 1: Clear Browser Cache and Local Storage

1. Open your browser's developer tools (F12 or Right-click > Inspect)
2. Go to Application tab
3. Select "Clear site data" (includes cookies, local storage, and cache)
4. Reload the page

## Step 2: Try Incognito/Private Mode

Open the application in a private/incognito window to test without extensions or cached data.

## Step 3: Disable Browser Extensions

Some browser extensions can interfere with development servers. Try disabling them.

## Step 4: Check Network Settings

1. In developer tools, go to Network tab
2. Look for failed requests with status 502
3. Check the request headers and response
4. Make sure there's no proxy interference

## Step 5: Try a Different Port

If the issues persist, try changing the development server port:
1. Edit `vite.config.js`
2. Change the server.port value to something else (e.g., 8080)
3. Restart the development server

## Step 6: Restart Development Server

Sometimes simply restarting the server fixes transient issues:
```
npm run dev
```
