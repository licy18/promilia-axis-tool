import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchAnalysisReportDialog from '../../features/workbench/WorkbenchAnalysisReportDialog.vue';

describe('WorkbenchAnalysisReportDialog', () => {
  it('reviews a validated comparison report and locates either source', async () => {
    const wrapper = mount(WorkbenchAnalysisReportDialog, {
      attachTo: document.body,
      props: {
        visible: true,
        report: createReport(),
        validation: { status: 'valid' },
        reproducibilityAudit: createReproducibilityAudit(),
      },
      global: { stubs: { teleport: true } },
    });

    expect(
      wrapper
        .get('[data-testid="workbench-analysis-report"]')
        .attributes('data-report-kind')
    ).toBe('scenario-comparison');
    expect(
      wrapper
        .get('[data-testid="workbench-analysis-report-validation"]')
        .attributes('data-validation-status')
    ).toBe('valid');
    expect(
      wrapper.findAll('[data-testid="workbench-analysis-report-source"]')
    ).toHaveLength(2);
    expect(
      wrapper.findAll('[data-testid="workbench-analysis-report-action"]')
    ).toHaveLength(1);
    expect(
      wrapper
        .get('[data-testid="workbench-analysis-report-reproducibility"]')
        .attributes('data-reproducibility-status')
    ).toBe('drift');
    expect(
      wrapper.findAll('[data-testid="workbench-analysis-report-difference"]')
    ).toHaveLength(1);

    await wrapper
      .get('[data-testid="workbench-analysis-report-locate-current"]')
      .trigger('click');
    expect(wrapper.emitted('locate-source')?.at(-1)?.[0]).toEqual({
      role: 'current',
      actionId: 'action-1',
      statePointId: 'current-point',
      frameIndex: 18,
    });
    await wrapper
      .get('[data-testid="workbench-analysis-report-locate-baseline"]')
      .trigger('click');
    expect(wrapper.emitted('locate-source')?.at(-1)?.[0]).toEqual({
      role: 'baseline',
      actionId: 'action-1',
      statePointId: 'baseline-point',
      frameIndex: 12,
    });
    await wrapper
      .findAll('[data-testid="workbench-analysis-report-open-source"]')[1]
      .trigger('click');
    expect(wrapper.emitted('locate-source')?.at(-1)?.[0]).toEqual({
      role: 'baseline',
    });
    await wrapper
      .get('[data-testid="workbench-analysis-report-export-json"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-analysis-report-export-png"]')
      .trigger('click');
    expect(wrapper.emitted('export-json')).toHaveLength(1);
    expect(wrapper.emitted('export-png')).toHaveLength(1);
    expect(wrapper.vm.getExportSurface()).toBeTruthy();

    wrapper.unmount();
  });
});

function createReproducibilityAudit() {
  return {
    status: 'drift',
    reason: '当前数据与运行时产生 1 处冻结输出差异',
    summary: {
      sourceCount: 2,
      differenceCount: 1,
      reportedDifferenceCount: 1,
      replayedAppliedTransactionCount: 2,
    },
    differences: [
      {
        path: '$.analysis.comparison.metrics[0].current',
        kind: 'value-changed',
        expected: 100,
        actual: 99,
      },
    ],
  };
}

function createReport() {
  const metric = (current, baseline) => ({
    current,
    baseline,
    delta: current - baseline,
    changed: current !== baseline,
  });
  return {
    schemaVersion: 1,
    type: 'workbench-analysis-report',
    exportedAt: '2026-07-12T12:00:00.000Z',
    title: '当前方案 / 基准方案 · 全轴',
    analysisKind: 'scenario-comparison',
    sources: [
      { role: 'current', label: '当前方案', windowId: 'full-axis' },
      { role: 'baseline', label: '基准方案', windowId: 'full-axis' },
    ],
    summary: {
      sourceCount: 2,
      actionReferenceCount: 2,
      appliedTransactionCount: 2,
      appliedSourceDeltaCount: 6,
    },
    analysis: {
      comparison: {
        metrics: [
          {
            key: 'enemyHpDelta',
            label: '敌人 HP 伤害',
            unit: 'hp',
            ...metric(100, 80),
          },
        ],
        actions: [
          {
            key: 'action-1',
            currentActionId: 'action-1',
            baselineActionId: 'action-1',
            currentName: '普通攻击',
            baselineName: '普通攻击',
            actorName: '末音',
            currentStatePointId: 'current-point',
            baselineStatePointId: 'baseline-point',
            currentFrameIndex: 18,
            baselineFrameIndex: 12,
            metrics: {
              enemyHpDelta: metric(100, 80),
              enemyToughnessDelta: metric(20, 10),
              selfEnergyDelta: metric(5, 3),
            },
          },
        ],
      },
    },
  };
}
