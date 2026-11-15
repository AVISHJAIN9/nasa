import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3006,
    watch: {
      ignored: ['**/*.glb'],
    },
    proxy: {
      // FastAPI / Python ML Fusion, Sources, Multimodal & Sensor stream paths
      '^/api/v1/(assess|space-weather|iss|sources|assistant|llm|minute|claims|registry|audio|behavior|face-metrics|eye-metrics|gestures|motion|twin|panel|fed|mission|consent|sensors|passive|signals|readings|baseline-history|drift-watchdog|timescale-replay|v3-flags|security-events|ml-multimodal|gateway-service)': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // Root level ML endpoints directly proxied to FastAPI
      '^/(assess|minute|claims|registry)': {
        target: 'http://localhost:8001',
        changeOrigin: true,
      },
      // Node.js Primary API & Clinical Core
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/v1': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Frame sequence and loop video live in public/ and are served as-is.
    target: 'es2020',
  },
});
