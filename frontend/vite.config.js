import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy so the app can call /api during local development without CORS friction.
// In production the app talks to VITE_API_BASE directly (see src/lib/api.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
});
