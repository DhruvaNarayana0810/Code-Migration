import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // allow overriding backend port via environment variable (VITE_BACKEND_PORT)
  const backendPort = process.env.VITE_BACKEND_PORT || process.env.BACKEND_PORT || '8001';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/graph': `http://localhost:${backendPort}`,
        '/analyze': `http://localhost:${backendPort}`,
        '/migrate': `http://localhost:${backendPort}`,
        '/health': `http://localhost:${backendPort}`,
      }
    }
  };
});