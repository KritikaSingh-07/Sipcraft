import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: {
      port: 5173,
      strictPort: true,
      // Same-origin API in development: cookies and CORS behave exactly like production behind a proxy.
      proxy: {
        '/api': { target: env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: true },
        '/uploads': { target: env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: true },
      },
    },
    preview: {
      port: 4173,
      proxy: {
        '/api': { target: env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: true },
        '/uploads': { target: env.VITE_DEV_API_TARGET || 'http://localhost:5000', changeOrigin: true },
      },
    },
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('recharts') || id.includes('d3-')) return 'charts';
            if (id.includes('framer-motion') || id.includes('motion-')) return 'motion';
            if (id.includes('swiper')) return 'swiper';
            if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
            if (id.includes('@tanstack') || id.includes('axios') || id.includes('zustand')) return 'data';
            return undefined;
          },
        },
      },
    },
  };
});
