import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * The demo imports the library from source, so it always exercises the current
 * working tree; the published package still ships the built dist.
 */
const librarySource = fileURLToPath(new URL('../src/index.ts', import.meta.url));

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      'telegram-md-entities': librarySource,
    },
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: false,
  },
});
