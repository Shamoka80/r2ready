
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@assets": path.resolve(__dirname, "../attached_assets"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: ['.repl.co', '.replit.dev', '.replit.app', 'localhost'],
    hmr: {
      overlay: false,
      timeout: 10000
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 30000,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
        }
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'production' ? false : true,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Split node_modules into separate chunks
          if (id.includes('node_modules')) {
            // React core - most important, separate chunk
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('react/jsx-runtime')) {
              return 'vendor-react';
            }
            // React Query - separate chunk
            if (id.includes('@tanstack/react-query')) {
              return 'vendor-query';
            }
            // All Radix UI components together
            if (id.includes('@radix-ui')) {
              return 'vendor-radix';
            }
            // Router
            if (id.includes('wouter')) {
              return 'vendor-router';
            }
            // Icons library
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            // Charts library
            if (id.includes('recharts')) {
              return 'vendor-charts';
            }
            // Animation library
            if (id.includes('framer-motion')) {
              return 'vendor-animation';
            }
            // Date utilities
            if (id.includes('date-fns')) {
              return 'vendor-date';
            }
            // Form libraries
            if (id.includes('react-hook-form') || id.includes('@hookform')) {
              return 'vendor-forms';
            }
            // All other vendor code
            return 'vendor-misc';
          }
        }
      }
    }
  }
})
