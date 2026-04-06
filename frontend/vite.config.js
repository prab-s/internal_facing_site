import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  build: {
    chunkSizeWarningLimit: 1400
  },
  server: {
    host: '0.0.0.0',
    port: 8001,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true
      }
    },
    allowedHosts: ['localhost', 'xps.local', '*bitrep.nz']
  }
});
