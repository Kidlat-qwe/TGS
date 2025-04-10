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
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Increase the warning limit to avoid unnecessary warnings
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: undefined,
        },
      }
    },
    server: {
      port: 3000,
      host: true, // Listen on all addresses, equivalent to 0.0.0.0
      proxy: {
        '/api': {
          target: isProduction && isRender ? '/' : 'http://localhost:5000',
          changeOrigin: true,
        }
      },
      // Disable HMR for compatibility with Replit and Render
      hmr: false,
      // Allow ALL hosts
      allowedHosts: 'all',
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
      }
    },
    preview: {
      port: 3000,
      host: true,
      allowedHosts: 'all',
      cors: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
      }
    }
  }
})
