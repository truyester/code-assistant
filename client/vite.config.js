import { defineConfig } from 'vite';
import { resolve } from 'path';

// Permite que en desarrollo /api apunte al backend local o remoto según env
const apiTarget = process.env.VITE_API_TARGET || 'http://localhost:5001';

export default defineConfig({
  server: {
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
      // Incluimos múltiples puntos de entrada (landing y app) para que app.html se genere en dist
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
      },
    },
  },
});
