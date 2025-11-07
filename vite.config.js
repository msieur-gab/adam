import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  // Set base path for GitHub Pages
  base: process.env.GITHUB_PAGES ? '/adam/' : '/',

  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'node_modules/piper-tts-web/dist/onnx', dest: '.' },
        { src: 'node_modules/piper-tts-web/dist/piper', dest: '.' },
        { src: 'node_modules/piper-tts-web/dist/worker', dest: '.' },
      ]
    }),
  ],

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
          'kokoro': ['kokoro-js'],
          'piper': ['piper-tts-web']
        }
      }
    }
  },

  server: {
    port: 3000,
    open: true
  },

  optimizeDeps: {
    include: ['lit', 'dexie', 'kokoro-js', 'piper-tts-web']
  }
});
