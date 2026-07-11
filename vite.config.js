import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (
            id.endsWith('/threeValueMechanicsProfile.js') ||
            id.endsWith('/threeValueMechanicsAdapter.js') ||
            id.endsWith('/threeValueMechanicsLayerInputs.js')
          ) {
            return 'azpr-mechanics-runtime';
          }
          if (
            [
              'ActionRuleDiagnosticsPanel.vue',
              'EffectTimelinePanel.vue',
              'EnemyPanel.vue',
              'TeamLoadoutPanel.vue',
              'WorkbenchCycleSectionPanel.vue',
              'WorkbenchLayoutBar.vue',
              'WorkbenchProjectDropOverlay.vue',
              'WorkbenchScenarioBar.vue',
            ].some(fileName => id.includes(`/features/workbench/${fileName}`))
          ) {
            return 'workbench-secondary-ui';
          }
        },
      },
    },
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    globals: true,
    environment: 'jsdom',
  },
});
