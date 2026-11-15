import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { localPreview } from './src/local/preview.ts';

export default defineConfig({
  root: 'src/client',
  publicDir: '../../public',
  plugins: [react(), localPreview()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
});
