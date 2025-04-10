import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on mode
  const env = loadEnv(mode, process.cwd(), '')
  
  // Detect environment
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production'
  
  // Get the backend URL from environment variables or use default
  const backendUrl = env.BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:5000'
  console.log(`Using backend URL: ${backendUrl}`)
  
  // Define allowed hosts - include Render domains and any from env
  const allowedHosts = [
    'localhost', 
    '127.0.0.1', 
    'tgs-frontend.onrender.com', 
    '.onrender.com',  // Wildcard for all Render subdomains
    'all'             // Allow all hosts as a fallback
  ]
  
  console.log('Allowed hosts:', allowedHosts)
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    define: {
      'import.meta.env.VITE_IS_PRODUCTION': JSON.stringify(isProduction),
      'import.meta.env.VITE_API_BASE': JSON.stringify('/api'),
      'import.meta.env.VITE_BACKEND_URL': JSON.stringify(backendUrl),
      // Add the allowed hosts to the build
      'import.meta.env.VITE_ALLOWED_HOSTS': JSON.stringify(allowedHosts.join(','))
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Add optimization settings for better bundling
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
      // Minimize chunk size to prevent timeouts
      chunkSizeWarningLimit: 1000,
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
      // Force dependency optimization to avoid issues
      force: true
    },
    server: {
      port: 3000,
      host: true,
      // Increase timeout values to prevent 502 errors
      hmr: {
        timeout: 60000,
      },
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
          timeout: 60000,
          proxyTimeout: 60000,
          rewrite: (path) => path.replace(/^\/api/, '/api')
        }
      },
      // Use the allowed hosts array
      allowedHosts: allowedHosts
    },
    preview: {
      port: 3000,
      host: true,
      // Use the allowed hosts array
      allowedHosts: allowedHosts
    }
  }
})
