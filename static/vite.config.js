import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Crucial for Atlassian Forge Custom UI relative path resolution
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'zustand'],
          charts: ['recharts'],
          echarts: ['echarts', 'echarts-for-react'],
          grid: ['react-grid-layout', 'react-resizable', '@tanstack/react-table'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 3000,
  },
});
