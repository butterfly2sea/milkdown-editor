import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  clearScreen: false,
  build: {
    target: 'es2022',
  },
});
