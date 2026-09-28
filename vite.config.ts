import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: { target: ['es2022', 'safari16.4'] },
  server: { port: 5173, strictPort: true },
});
