import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
const asyncCssPlugin = () => ({
  name: 'async-css',
  transformIndexHtml(html) {
    return html.replace(
      /<link rel="stylesheet" (.*?)href="(.*?)">/g,
      '<link rel="preload" as="style" href="$2" onload="this.onload=null;this.rel=\'stylesheet\'"><noscript><link rel="stylesheet" href="$2"></noscript>'
    );
  }
});

const mpaRewritePlugin = () => ({
  name: 'mpa-rewrite',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url.startsWith('/produtos/') && !req.url.includes('.')) {
        req.url = '/produtos.html';
      }
      if (req.url.startsWith('/admin')) {
        req.url = '/admin.html';
      }
      next();
    });
  }
});

export default defineConfig({
  root: '.',
  base: '/',
  plugins: [
    react(),
    asyncCssPlugin(),
    mpaRewritePlugin(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: true,
    minify: 'terser',
    target: 'es2020',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
      },
    },
    modulePreload: {
      polyfill: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quemsomos: resolve(__dirname, 'quem-somos.html'),
        contato: resolve(__dirname, 'contato.html'),
        produtos: resolve(__dirname, 'produtos.html'),
        admin: resolve(__dirname, 'admin.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Group UI core and vendors to reduce request count while isolating heavy animations
            if (id.includes('framer-motion')) return 'vendor-framer';
            return 'vendor-core';
          }
        },
      },
    },
  }
});