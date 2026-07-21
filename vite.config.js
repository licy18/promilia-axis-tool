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
    target: 'es2022',
    minify: 'terser',
    terserOptions: {
      compress: { passes: 2 },
      format: { comments: false },
    },
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (
            [
              '/simulation/mechanics/verifiedCombatRuntime.js',
              '/simulation/mechanics/verifiedBattleEffectGeneration.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'verified-combat-runtime';
          }
          if (
            [
              '/data/verifiedCombatMechanicsPackage.js',
              '/simulation/mechanics/verifiedCombatStaticProperties.js',
              '/simulation/mechanics/threeValueMechanismConfiguration.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'verified-combat-configuration';
          }
          if (
            id.endsWith(
              '/simulation/projection/projectTimelineStateDisplaySeries.js'
            )
          ) {
            return 'workbench-timeline-projection';
          }
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
              '/features/workbench/verifiedActionMechanicsTrace.js',
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
