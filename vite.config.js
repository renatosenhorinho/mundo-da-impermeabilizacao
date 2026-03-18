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

export default defineConfig({
  root: '.',
  base: '/',
  plugins: [
    react(),
    asyncCssPlugin(),
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        quemsomos: resolve(__dirname, 'quem-somos.html'),
        contato: resolve(__dirname, 'contato.html')
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-framer': ['framer-motion'],
          'vendor-utils': ['clsx', 'tailwind-merge'],
        },
      },
    },
  }
});