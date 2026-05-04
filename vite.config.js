import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Rewrite produto/* URLs to produtos.html in dev
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
    // esbuild é ~10x mais rápido que terser e produz bundles equivalentes
    minify: 'esbuild',
    target: 'es2022',
    // Aumenta o limite do warning (vendor-core é grande mas gzipa bem)
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      input: {
        main:      resolve(__dirname, 'index.html'),
        quemsomos: resolve(__dirname, 'quem-somos.html'),
        contato:   resolve(__dirname, 'contato.html'),
        produtos:  resolve(__dirname, 'produtos.html'),
        admin:     resolve(__dirname, 'admin.html'),
      },
      output: {
        // Granular chunk splitting para máximo cache reuse
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Framer Motion — pesado, lazy-loaded apenas ao abrir menu mobile
          if (id.includes('framer-motion')) return 'vendor-framer';

          // Supabase — usado só em analytics + admin (lazy)
          if (id.includes('@supabase') || id.includes('ws') || id.includes('websocket')) {
            return 'vendor-supabase';
          }

          // React Router — carregado apenas em páginas com SPA
          if (id.includes('react-router')) return 'vendor-router';

          // React core + DOM — inseparáveis, cache longo
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('scheduler')) {
            return 'vendor-react';
          }

          // Tudo mais (lucide, clsx, number-flow, radix, etc.)
          return 'vendor-libs';
        },
      },
    },
  },
});