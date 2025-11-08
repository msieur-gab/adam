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
    // RSS Proxy Plugin (for development - bypasses CORS)
    {
      name: 'rss-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url?.startsWith('/api/rss?')) {
            const url = new URL(req.url, 'http://localhost');
            const feedUrl = url.searchParams.get('url');

            if (!feedUrl) {
              res.statusCode = 400;
              res.end('Missing url parameter');
              return;
            }

            try {
              const response = await fetch(feedUrl);
              const text = await response.text();

              res.setHeader('Content-Type', 'application/xml');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(text);
            } catch (error) {
              res.statusCode = 500;
              res.end(`Failed to fetch RSS feed: ${error.message}`);
            }
          } else {
            next();
          }
        });
      }
    }
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
    include: ['lit', 'dexie', 'piper-tts-web']
  }
});
