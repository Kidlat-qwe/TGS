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
    },
    server: {
      port: 3000,
      host: true,
      proxy: {
        '/api': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        }
      }
    }
  }
})
