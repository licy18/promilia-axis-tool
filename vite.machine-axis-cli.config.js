import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  logLevel: 'silent',
  build: {
    ssr: resolve(__dirname, 'scripts/machine-axis-cli-entry.mjs'),
    target: 'node24',
    outDir: resolve(__dirname, 'work/machine-axis-cli-dist'),
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      output: {
        entryFileNames: 'machine-axis-cli.mjs',
        inlineDynamicImports: true,
      },
    },
  },
});
