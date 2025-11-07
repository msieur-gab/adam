import { defineConfig } from 'vite';

export default defineConfig({
  // Set base path for GitHub Pages (https://msieur-gab.github.io/adam/)
  base: process.env.GITHUB_PAGES ? '/adam/' : '/',

  build: {
    target: 'esnext',
    outDir: 'dist',
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
