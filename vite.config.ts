import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    nodePolyfills(),
  ],
  preview: {
    allowedHosts: true
  },
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/scratch/**'],
  },
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@isomorphic-git/lightning-fs') || id.includes('isomorphic-git')) {
            return 'git';
          }
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('zustand') || id.includes('lucide')) {
              return 'vendor';
            }
          }
        }
      },
      onwarn(warning, warn) {
        // Suppress eval warnings from dependencies like vm-browserify
        if (warning.code === 'EVAL') return;
        warn(warning);
      }
    }
  }
})
