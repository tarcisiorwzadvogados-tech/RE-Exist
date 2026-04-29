import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.USER_EMAIL': JSON.stringify(env.USER_EMAIL),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var, and auto-disabled on Replit
      // because its proxy closes WebSocket connections, causing infinite page reloads.
      hmr: process.env.DISABLE_HMR !== 'true' && !process.env.REPLIT_DOMAINS,
      allowedHosts: true,
      proxy: {
        '/api': { target: 'http://localhost:3001', changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
    },
  };
});
