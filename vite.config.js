import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit'],
          'dexie': ['dexie'],
          'transformers': ['@xenova/transformers']
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  },
  optimizeDeps: {
    include: ['lit', 'dexie']
  }
});
