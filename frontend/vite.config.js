import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: '0.0.0.0', // Make it accessible from outside the container
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
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
      '0ed9e2b2-bfa8-4006-9953-4bc997847956-00-1tcopzcg7tap6.pike.replit.dev', // Your specific Replit domain
      'all' // This enables all hosts
    ]
  }
})
