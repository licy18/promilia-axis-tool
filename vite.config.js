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
              '/domain/actionHitOverrides.js',
              '/domain/combatScenario.js',
              '/domain/timebase.js',
              '/domain/workbenchActionScheduling.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'workbench-core-contracts';
          }
          if (
            [
              '/simulation/mechanics/verifiedCombatRuntime.js',
              '/simulation/mechanics/verifiedBattleEffectGeneration.js',
              '/simulation/mechanics/verifiedActionVariantRuntime.js',
              '/simulation/mechanics/actionEffectiveTimeline.js',
              '/domain/verifiedActionContextScheduling.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'verified-combat';
          }
          if (
            [
              '/data/verifiedCombatMechanicsPackage.js',
              '/simulation/mechanics/verifiedCombatStaticProperties.js',
              '/simulation/mechanics/threeValueMechanismConfiguration.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'verified-combat';
          }
          if (
            [
              '/simulation/projection/projectCycleBoundaryInheritance.js',
              '/simulation/projection/projectTimelineStateDisplaySeries.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'workbench-ui';
          }
          if (
            [
              'TimelineGridPreview.vue',
              'TimelineOperationAxis.vue',
              'TimelineSwitchEventMarker.vue',
              'ActionHitOverrideList.vue',
            ].some(fileName =>
              id.includes(`/features/workbench/${fileName}`)
            ) ||
            [
              '/simulation/projection/projectTimelineOperationInputs.js',
              '/domain/azprInputCommandProfile.js',
              '/domain/workbenchJointAttackInsertion.js',
            ].some(modulePath => id.endsWith(modulePath))
          ) {
            return 'workbench-ui';
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
            return 'workbench-ui';
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
