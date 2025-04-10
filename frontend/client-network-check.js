/**
 * Client Network Troubleshooting Script
 * 
 * This script helps diagnose and fix client-side network issues
 * including 502 Bad Gateway errors with the development server.
 * 
 * Usage:
 * 1. Run this script when encountering 502 errors
 * 2. Follow the instructions to clear browser data and restart the server
 */

import fetch from 'node-fetch';
import child_process from 'child_process';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Console color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`\n${colors.cyan}🔍 Client Network Troubleshooting Tool${colors.reset}`);
console.log(`${colors.cyan}========================================${colors.reset}`);

async function runTroubleshooter() {
  try {
    console.log('\n1. Checking for common issues with 502 Bad Gateway errors...');
    
    // Check 1: Check if the development server is running
    console.log('\n   Checking if development server is accessible...');
    try {
      const response = await fetch('http://localhost:3000');
      console.log(`   ${colors.green}✓ Development server is responding${colors.reset}`);
    } catch (error) {
      console.log(`   ${colors.red}✗ Development server is not responding: ${error.message}${colors.reset}`);
      console.log(`   ${colors.yellow}  This suggests the Vite development server may not be running.${colors.reset}`);
    }
    
    // Check 2: Create a browser instructions file
    console.log('\n2. Creating browser troubleshooting instructions...');
    
    const browserInstructions = `
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
1. Edit \`vite.config.js\`
2. Change the server.port value to something else (e.g., 8080)
3. Restart the development server

## Step 6: Restart Development Server

Sometimes simply restarting the server fixes transient issues:
\`\`\`
npm run dev
\`\`\`
`;

    fs.writeFileSync(path.join(__dirname, 'BROWSER-TROUBLESHOOTING.md'), browserInstructions);
    console.log(`   ${colors.green}✓ Created BROWSER-TROUBLESHOOTING.md with instructions${colors.reset}`);
    
    // Step 3: Update package.json to add troubleshooting scripts
    console.log('\n3. Adding helper scripts to package.json...');
    
    try {
      const packageJsonPath = path.join(__dirname, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Add troubleshooting scripts if they don't exist
      if (!packageJson.scripts.troubleshoot) {
        packageJson.scripts.troubleshoot = "node client-network-check.js";
      }
      
      if (!packageJson.scripts['dev:clear']) {
        packageJson.scripts['dev:clear'] = "vite --force";
      }
      
      if (!packageJson.scripts['dev:alt-port']) {
        packageJson.scripts['dev:alt-port'] = "vite --port 8080";
      }
      
      // Write updated package.json
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log(`   ${colors.green}✓ Added troubleshooting scripts to package.json${colors.reset}`);
    } catch (error) {
      console.log(`   ${colors.red}✗ Could not update package.json: ${error.message}${colors.reset}`);
    }
    
    // Step 4: Interactive restart options
    console.log('\n4. Would you like to restart the development server?');
    console.log('   1) Restart with default settings');
    console.log('   2) Restart with forced dependency optimization (helps with 502 errors)');
    console.log('   3) Restart on alternate port (8080)');
    console.log('   4) Exit without restarting');
    
    rl.question('\n   Enter your choice (1-4): ', (answer) => {
      switch (answer.trim()) {
        case '1':
          console.log(`\n${colors.green}Restarting development server...${colors.reset}`);
          console.log('Press Ctrl+C to stop the server when needed.');
          child_process.spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true });
          break;
        case '2':
          console.log(`\n${colors.green}Restarting with forced optimization...${colors.reset}`);
          console.log('Press Ctrl+C to stop the server when needed.');
          child_process.spawn('npm', ['run', 'dev:clear'], { stdio: 'inherit', shell: true });
          break;
        case '3':
          console.log(`\n${colors.green}Restarting on port 8080...${colors.reset}`);
          console.log('Press Ctrl+C to stop the server when needed.');
          child_process.spawn('npm', ['run', 'dev:alt-port'], { stdio: 'inherit', shell: true });
          break;
        case '4':
        default:
          console.log(`\n${colors.yellow}Exiting without restart. To fix the issue:${colors.reset}`);
          console.log('1. Read the browser troubleshooting steps in BROWSER-TROUBLESHOOTING.md');
          console.log('2. Run "npm run dev" to start the server when ready');
          console.log('3. If issues persist, try "npm run dev:clear" to force dependency optimization');
          rl.close();
      }
    });
    
  } catch (error) {
    console.error(`${colors.red}Error during troubleshooting: ${error}${colors.reset}`);
  }
}

runTroubleshooter(); 