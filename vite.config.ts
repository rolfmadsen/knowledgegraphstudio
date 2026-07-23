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
    // Vite 8 uses OXC/Rolldown as the default minifier for both JS and CSS.
    // Do NOT set minify: 'esbuild' — esbuild is no longer bundled with Vite 8.
    chunkSizeWarningLimit: 7000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // AI worker and WebLLM — already lazy, keep separate
          if (id.includes('@mlc-ai/web-llm')) {
            return 'webllm';
          }

          // Git / filesystem — heavy, only loaded on git operations
          if (id.includes('@isomorphic-git/lightning-fs') || id.includes('isomorphic-git')) {
            return 'git';
          }

          // Monaco editor — self-hosted, lazy loaded (code view only)
          if (id.includes('@monaco-editor') || id.includes('monaco-editor')) {
            return 'monaco';
          }

          // XYFlow / React Flow — large, canvas only
          if (id.includes('@xyflow')) {
            return 'xyflow';
          }

          // Dagre graph layout — used in workers and notations
          if (id.includes('@dagrejs') || id.includes('dagre')) {
            return 'dagre';
          }

          // Fuse.js — search, small but separate
          if (id.includes('fuse.js') || id.includes('fuse')) {
            return 'fuse';
          }

          // Core React vendor bundle (react, react-dom, zustand, zundo, lucide)
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/zustand/') ||
              id.includes('/zundo/') ||
              id.includes('/lucide-react/')
            ) {
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
