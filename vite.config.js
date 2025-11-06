import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Root config for server/vite.ts compatibility
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
      host: '0.0.0.0'
    },
    allowedHosts: ['.repl.co', '.replit.dev', '.replit.app', 'localhost'],
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  }
})