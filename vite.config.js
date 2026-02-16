import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const REPO_NAME =
  process.env.GITHUB_REPOSITORY?.split('/')[1] ||
  process.env.VITE_GH_PAGES_REPO ||
  'Dashboard-Seguridad';

const BASE_PATH = process.env.NODE_ENV === 'production' ? `/${REPO_NAME}/` : '/';

export default defineConfig({
  root: 'react',
  base: BASE_PATH,
  plugins: [react()],
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
