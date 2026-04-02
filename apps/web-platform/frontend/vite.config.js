import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const appTarget = process.env.VITE_APP_TARGET || 'all';
const base = '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true
      }
    }
  }
});
