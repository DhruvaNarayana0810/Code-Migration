import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  // allow overriding backend port via environment variable (VITE_BACKEND_PORT)
  const backendPort = process.env.VITE_BACKEND_PORT || process.env.BACKEND_PORT || '8000';

  return {
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/scan-repo': `http://localhost:${backendPort}`,
        '/chat': `http://localhost:${backendPort}`,
        '/graph': `http://localhost:${backendPort}`,
        '/analyze': `http://localhost:${backendPort}`,
        '/migrate': `http://localhost:${backendPort}`,
        '/analyze-migration': `http://localhost:${backendPort}`,
        '/entity-info': `http://localhost:${backendPort}`,
        '/bug-risk': `http://localhost:${backendPort}`,
        '/suggestions': `http://localhost:${backendPort}`,
        '/generate-docs': `http://localhost:${backendPort}`,
        '/suggest-improvements': `http://localhost:${backendPort}`,
        '/health': `http://localhost:${backendPort}`,
      }
    }
  };
});