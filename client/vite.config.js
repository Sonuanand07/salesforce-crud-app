import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, API and OAuth routes are proxied to the Express server so cookies stay same-origin.
const backend = 'http://localhost:3000';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': backend, '/auth': backend } },
});
