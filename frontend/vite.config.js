import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current directory.
  // Import.meta.env.VITE_* vars are accessible here as well
  const env = loadEnv(mode, process.cwd())
  
  // Determine the backend URL/port for API proxy
  // Use environment variables if available, otherwise use defaults
  const backendPort = process.env.BACKEND_PORT || env.VITE_BACKEND_PORT || process.env.PORT || 5000
  const backendHost = process.env.BACKEND_HOST || env.VITE_BACKEND_HOST || 'localhost'
  const backendUrl = process.env.BACKEND_URL || env.VITE_BACKEND_URL || `http://${backendHost}:${backendPort}`
  
  console.log(`🔗 Vite proxying API requests to: ${backendUrl}`)
  
  // For production builds, define constant environment variables
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production'
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Define environment variables for the client
    define: {
      'import.meta.env.VITE_IS_PRODUCTION': JSON.stringify(isProduction),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
      'import.meta.env.VITE_API_BASE': JSON.stringify('/api'),
    },
    server: {
      port: parseInt(process.env.VITE_PORT || env.VITE_PORT || 5173),
      host: process.env.VITE_HOST || env.VITE_HOST || '0.0.0.0', // Make it accessible from outside the container
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          rewrite: (path) => path,
        }
      },
      // Completely disable HMR for Replit to avoid WebSocket issues
      hmr: false,
      // Allow all hosts, including Replit domains
      allowedHosts: [
        'localhost',
        '127.0.0.1',
        '.replit.dev',
        '.repl.co',
        '.onrender.com',  // Add Render domains
        '0ed9e2b2-bfa8-4006-9953-4bc997847956-00-1tcopzcg7tap6.pike.replit.dev', // Your specific Replit domain
        'all' // This enables all hosts
      ]
    }
  }
})
