import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'react',
  envDir: '..',
  plugins: [react()],
  base: '/Dashboard-Seguridad/',
  build: {
    outDir: '../dist',
    emptyOutDir: true
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: '/'
  }
});
