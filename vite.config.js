import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { readFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { basename, dirname, resolve } from 'path';

const TEST_INCLUDE = ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'];
const DOM_TEST_INCLUDE = [
  'src/__tests__/features/**/*.{test,spec}.{js,jsx,ts,tsx}',
  'src/__tests__/views/**/*.{test,spec}.{js,jsx,ts,tsx}',
  'src/__tests__/domain/workbenchAnalysisReportPng.test.js',
  'src/__tests__/domain/workbenchProjectFileReceiver.test.js',
];

const EXTERNALIZED_WORKBENCH_JSON_ASSETS = new Set([
  'character-acceptance-catalog.json',
  'character-acceptance-manifest-index.json',
  'characters.json',
  'combat-formula-evidence.json',
  'enemy-level-profiles.json',
  'kibo-passive-mechanics.json',
  'optimization-qualification-catalog.json',
  'soulessence-effect-mechanics.json',
  'workbench-action-status-catalog.json',
  'workbench-kibo-action-catalog.json',
  'workbench-seed.json',
  'workbench-skill-core.json',
]);

function externalizeWorkbenchJsonAssets() {
  const virtualPrefix = '\0external-workbench-json:';
  const virtualSuffix = ':module';
  return {
    name: 'externalize-workbench-json-assets',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer, options = {}) {
      if (options.ssr || !importer) return null;
      const sourcePath = source.split('?', 1)[0];
      const fileName = basename(sourcePath);
      if (
        !sourcePath.endsWith('.json') ||
        !EXTERNALIZED_WORKBENCH_JSON_ASSETS.has(fileName)
      ) {
        return null;
      }
      return `${virtualPrefix}${resolve(
        dirname(importer),
        sourcePath
      )}${virtualSuffix}`;
    },
    async load(id) {
      if (!id.startsWith(virtualPrefix) || !id.endsWith(virtualSuffix)) {
        return null;
      }
      const filePath = id.slice(virtualPrefix.length, -virtualSuffix.length);
      const fileName = basename(filePath);
      const referenceId = this.emitFile({
        type: 'asset',
        name: fileName,
        source: await readFile(filePath),
      });
      return [
        `const url = import.meta.ROLLUP_FILE_URL_${referenceId};`,
        'const response = await fetch(url);',
        `if (!response.ok) throw new Error('Unable to load ${fileName}: ' + response.status);`,
        'const value = await response.json();',
        'export default value;',
      ].join('\n');
    },
  };
}

function resolveVitestWorkerCount() {
  const configured = Number(process.env.VITEST_MAX_WORKERS);
  // Large generated combat catalogs consume several GB per active worker.
  return Number.isInteger(configured) && configured > 0
    ? configured
    : Math.max(1, Math.min(2, availableParallelism() - 1));
}

const vitestWorkerCount = resolveVitestWorkerCount();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [externalizeWorkbenchJsonAssets(), vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
      format: { comments: false },
    },
  },
  test: {
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'core',
          include: TEST_INCLUDE,
          exclude: DOM_TEST_INCLUDE,
          environment: 'node',
          pool: 'threads',
          maxWorkers: vitestWorkerCount,
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'dom',
          include: DOM_TEST_INCLUDE,
          environment: 'jsdom',
          pool: 'forks',
          maxWorkers: vitestWorkerCount,
          // Keep jsdom module state and memory out of the core worker pool.
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
});
