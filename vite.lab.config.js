import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist/lab',
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      input: 'lab.html',
      output: { entryFileNames: 'assets/lab.js', inlineDynamicImports: true },
    },
  },
});
