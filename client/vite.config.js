import { defineConfig } from 'vite';
import { resolve } from 'path';

// Permite ajustar el backend según entorno (Render en prod, localhost en dev)
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
  build: {
    rollupOptions: {
      // Genera salidas para index.html (landing) y app.html (app principal)
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
});
