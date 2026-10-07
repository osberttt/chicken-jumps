import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs from any folder (itch.io, zip, file host).
  base: './',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
