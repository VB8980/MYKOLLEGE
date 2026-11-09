import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Конфигурация Vite: сборка в статический сайт с base './' для переносимости
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1600,
  },
});
