import { defineConfig } from 'vite';

// Allow overriding API target if client/server run in different hosts (e.g., Windows vs WSL)
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:5001';

export default defineConfig({
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
