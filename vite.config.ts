import { defineConfig } from 'vite';
import { readFileSync } from 'fs';

const tauriConf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  clearScreen: false,
  build: {
    target: 'es2022',
  },
  define: {
    __APP_VERSION__: JSON.stringify(tauriConf.version),
  },
});
