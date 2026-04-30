import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// PORT is only needed for dev server, not for build
const port = process.env.PORT ? parseInt(process.env.PORT) : 5173;

export default defineConfig({
  plugins: [react()],
  server: { port },
  build: {
    outDir: 'dist',
  },
});