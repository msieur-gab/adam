import { defineConfig } from 'vite';

export default defineConfig({
  // Set base path for GitHub Pages (https://msieur-gab.github.io/adam/)
  base: process.env.GITHUB_PAGES ? '/adam/' : '/',

  build: {
    target: 'esnext',
    outDir: 'dist',

    // Mobile-optimized build settings
    minify: 'terser', // Better compression than esbuild
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging (remove in production)
        passes: 2, // Multiple compression passes
        pure_funcs: ['console.debug'], // Remove debug logs
      },
      mangle: {
        safari10: true // Fix Safari 10 issues
      },
    },

    // Optimize chunk sizes for mobile
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        manualChunks: {
          'lit': ['lit'],
          'dexie': ['dexie'],
          'transformers': ['@xenova/transformers'],
          'kokoro': ['kokoro-js']
        },
        // Optimize chunk naming for caching
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  },

  server: {
    port: 3000,
    open: true
  },

  optimizeDeps: {
    include: ['lit', 'dexie', 'kokoro-js'],
    // Optimize for mobile browsers
    esbuildOptions: {
      target: 'es2020',
    }
  },

  // Enable better caching for PWA
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      // Use relative URLs for better caching
      return filename;
    }
  }
});
