import { defineConfig } from 'vite';

export default defineConfig({
  // Set base path for GitHub Pages
  base: process.env.GITHUB_PAGES ? '/adam/' : '/',

  build: {
    target: 'esnext',
    outDir: 'dist',
    // Use default minification (no terser dependency needed)
    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit'],
          'dexie': ['dexie'],
          'transformers': ['@xenova/transformers'],
          'kokoro': ['kokoro-js']
        }
      }
    }
  },

  server: {
    port: 3000,
    open: true
  },

  optimizeDeps: {
    include: ['lit', 'dexie', 'kokoro-js']
  }
});
