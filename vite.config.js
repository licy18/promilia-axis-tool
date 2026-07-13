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
            [
              'WorkbenchAnalysisReportDialog.vue',
              'WorkbenchConfigurationLibraryPanel.vue',
              'WorkbenchPresetLibraryDialog.vue',
              'WorkbenchScenarioComparisonDialog.vue',
            ].some(fileName => id.includes(`/features/workbench/${fileName}`))
          ) {
            return 'workbench-project-tools';
          }
          if (
            id.endsWith('/threeValueMechanicsProfile.js') ||
            id.endsWith('/threeValueMechanicsAdapter.js') ||
            id.endsWith('/threeValueAppliedSourceBinding.js') ||
            id.endsWith('/threeValueHpOperandSourceBinding.js') ||
            id.endsWith('/threeValueMechanicsLayerInputs.js') ||
            id.endsWith('/threeValueMechanismConfiguration.js') ||
            id.endsWith('/threeValueMechanicsProfileCatalog.js') ||
            id.endsWith('/workbenchConfigurationSourceContract.js') ||
            id.endsWith('/workbenchMechanicsProfileSelection.js')
          ) {
            return 'azpr-mechanics-runtime';
          }
          if (
            [
              'ActionRuleDiagnosticsPanel.vue',
              'AnalysisPanel.vue',
              'EffectTimelinePanel.vue',
              'EnemyPanel.vue',
              'PropertiesPanel.vue',
              'TeamLoadoutPanel.vue',
              'WorkbenchCycleSectionPanel.vue',
              'WorkbenchLayoutBar.vue',
              'WorkbenchProjectDropOverlay.vue',
              'WorkbenchScenarioBar.vue',
            ].some(fileName =>
              id.includes(`/features/workbench/${fileName}`)
            ) ||
            [
              '/domain/workbenchLayout.js',
              '/domain/workbenchProjectFileReceiver.js',
              '/features/workbench/runtimeEffectReview.js',
            ].some(modulePath => id.endsWith(modulePath))
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
