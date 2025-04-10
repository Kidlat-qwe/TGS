import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Detect environment
  const isProduction = mode === 'production' || process.env.NODE_ENV === 'production'
  const isRender = Boolean(process.env.RENDER)
  
  console.log(`📦 Running in ${isProduction ? 'production' : 'development'} mode`)
  console.log(`🚀 Deployment: ${isRender ? 'Render' : 'Local'}`)
  
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
    },
    server: {
      port: 3000, // Explicitly set port to 3000 instead of relying on env variables
      host: '0.0.0.0', // Make it accessible from outside the container
      proxy: {
        // In development, always proxy API requests to the backend
        // In production on Render, this will be handled by serving static files from the backend
        '/api': {
          target: isProduction && isRender ? '/' : 'http://localhost:5000',
          changeOrigin: true,
        }
      },
      // Disable HMR for compatibility with Replit and Render
      hmr: false,
      // Allow all hosts
      allowedHosts: 'all'
    }
  }
})
