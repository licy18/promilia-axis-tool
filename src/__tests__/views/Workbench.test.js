import { readFileSync } from 'node:fs';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import {
  WORKBENCH_DRAFT_STORAGE_KEY,
  createWorkbenchDraftSnapshot,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchActionDraft,
  getSkillActionCatalog,
} from '../../domain/workbenchProjectFactory';
import AnalysisPanel from '../../features/workbench/AnalysisPanel.vue';
import EventLogPanel from '../../features/workbench/EventLogPanel.vue';
import ResourceMonitorPanel from '../../features/workbench/ResourceMonitorPanel.vue';
import RuntimeSelectedDetailPanel from '../../features/workbench/RuntimeSelectedDetailPanel.vue';
import PropertiesPanel from '../../features/workbench/PropertiesPanel.vue';
import TimelineGridPreview from '../../features/workbench/TimelineGridPreview.vue';
import WorkbenchFlowPanel from '../../features/workbench/WorkbenchFlowPanel.vue';
import Workbench from '../../views/Workbench.vue';

function readTestSource(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function compactSource(source) {
  return source.replace(/\s+/g, '');
}

describe('Workbench view', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.localStorage.clear();
  });

  it('renders the first real-data simulation slice', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const text = wrapper.text();

    expect(text).toContain('工作台：末音 / 哈库茵剑舞 / 迅狼');
    expect(text).toContain('末音');
    expect(text).toContain('迅狼');
    expect(text).toContain('哈库茵剑舞');
    expect(text).toContain('DAMAGE_PROJECTED');
    expect(text).toContain('stage5-damage-layer-breakdown-v1');
    expect(text).toContain('攻击 1,920 × 倍率 649%');
    expect(text).toContain('三值来源');
    expect(text).toContain(
      '三值框架 3轨 · 曲线 3条/15点 · 状态 16点 · 细节后补'
    );
    expect(text).toContain(
      '生成合同 1动作/6命中 · Delta 16 · 候选 15 · 已用 1'
    );
    expect(text).toContain('运行投影 HP 12,461 · 韧性 0 · 能量 0 · 日志 1');
    expect(
      wrapper
        .find('[data-testid="workbench-three-value-generation-layer-summary"]')
        .text()
    ).toBe('生成合同 1动作/6命中 · Delta 16 · 候选 15 · 已用 1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-three-value-runtime-projection-summary"]'
        )
        .text()
    ).toBe('运行投影 HP 12,461 · 韧性 0 · 能量 0 · 日志 1');
    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.exists()).toBe(true);
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-flow-phase')).toBe('action-edit');
    expect(flowPanel.attributes('data-flow-primary-kind')).toBe(
      'open-runtime-results'
    );
    expect(flowPanel.attributes('data-flow-primary-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-flow-primary-state-point-id')).toBe('');
    expect(flowPanel.attributes('data-main-flow-next-target-kind')).toBe(
      'runtime-results'
    );
    expect(
      flowPanel.attributes('data-main-flow-action-edit-state-point-id')
    ).toBe('');
    expect(flowPanel.attributes('data-main-flow-return-state-point-id')).toBe(
      ''
    );
    const mainFlowWorkspace = wrapper.find(
      '[data-testid="workbench-main-flow-workspace"]'
    );
    expect(mainFlowWorkspace.exists()).toBe(true);
    expect(mainFlowWorkspace.attributes('data-flow-phase')).toBe('action-edit');
    expect(mainFlowWorkspace.attributes('data-main-flow-current-region')).toBe(
      'action-edit'
    );
    expect(
      mainFlowWorkspace.attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-results');
    expect(mainFlowWorkspace.attributes('data-main-flow-next-region')).toBe(
      'runtime-review'
    );
    expect(
      mainFlowWorkspace.attributes(
        'data-main-flow-pending-runtime-state-point-id'
      )
    ).toBe('');
    expect(
      mainFlowWorkspace.attributes('data-main-flow-selected-action-id')
    ).toBe('action-0001');
    expect(
      mainFlowWorkspace.attributes(
        'data-main-flow-selected-runtime-state-point-id'
      )
    ).toBe('');
    expect(mainFlowWorkspace.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '0',
      'data-main-flow-dispatch-status': 'idle',
      'data-main-flow-dispatch-handled': 'false',
      'data-main-flow-dispatch-has-result': 'false',
      'data-main-flow-dispatch-kind': '',
      'data-main-flow-dispatch-source': '',
      'data-main-flow-dispatch-handler-key': '',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-loop-step': 'action-edit',
      'data-main-flow-loop-status': 'ready',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'open-runtime-results',
      'data-main-flow-loop-next-target-kind': 'runtime-results',
      'data-main-flow-loop-current-region': 'action-edit',
      'data-main-flow-loop-next-region': 'runtime-review',
      'data-runtime-review-selection-status': 'empty',
      'data-runtime-review-selected-action-id': '',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-pending-state-point-id': '',
      'data-runtime-review-source': '',
      'data-runtime-review-source-kind': 'none',
      'data-runtime-review-last-action-kind': '',
      'data-runtime-review-last-action-source': '',
    });
    expect(flowPanel.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '0',
      'data-main-flow-dispatch-status': 'idle',
      'data-main-flow-dispatch-handled': 'false',
      'data-main-flow-dispatch-kind': '',
      'data-main-flow-loop-step': 'action-edit',
      'data-main-flow-loop-status': 'ready',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'open-runtime-results',
      'data-main-flow-loop-next-target-kind': 'runtime-results',
    });
    const primaryFlow = wrapper.find('[data-testid="workbench-primary-flow"]');
    expect(primaryFlow.exists()).toBe(true);
    expect(primaryFlow.attributes('data-flow-phase')).toBe('action-edit');
    expect(primaryFlow.attributes('data-main-flow-current-region')).toBe(
      'action-edit'
    );
    expect(primaryFlow.attributes('data-main-flow-next-target-kind')).toBe(
      'runtime-results'
    );
    expect(primaryFlow.attributes('data-main-flow-next-region')).toBe(
      'runtime-review'
    );
    expect(primaryFlow.find('.timeline-area').exists()).toBe(true);
    expect(
      primaryFlow
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-flow-selected-action-id': 'action-0001',
      'data-flow-selected-state-curve-point-id': '',
    });
    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.exists()).toBe(true);
    expect(runtimeReviewStack.attributes('data-main-flow-current-region')).toBe(
      'action-edit'
    );
    expect(
      runtimeReviewStack.attributes(
        'data-main-flow-selected-runtime-state-point-id'
      )
    ).toBe('');
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-layout': 'overview',
      'data-runtime-review-selection-status': 'empty',
      'data-runtime-review-selected-action-id': '',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-source': '',
      'data-runtime-review-source-kind': 'none',
    });
    expect(
      runtimeReviewStack.findComponent(ResourceMonitorPanel).exists()
    ).toBe(true);
    expect(runtimeReviewStack.findComponent(EventLogPanel).exists()).toBe(true);
    const runtimeOutputs =
      runtimeReviewStack
        .findComponent(ResourceMonitorPanel)
        .props('runtimeProjection') ?? null;
    expect(runtimeOutputs).toMatchObject({
      sourceKind: 'azpr-three-value-runtime-outputs',
      outputNames: ['simLog', 'stateCurves', 'resourceCurves', 'summary'],
      outputAliases: {
        resources: 'resourceCurves',
      },
    });
    expect(
      runtimeReviewStack.findComponent(EventLogPanel).props('runtimeProjection')
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(AnalysisPanel).props('runtimeProjection')
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(WorkbenchFlowPanel).props('runtimeProjection')
        .runtimeOutputs
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(WorkbenchFlowPanel).props('runtimeOutputs')
    ).toBe(runtimeOutputs);
    expect(
      wrapper.findComponent(WorkbenchFlowPanel).props('flowModel')
        .runtimeOutputs
    ).toBe(runtimeOutputs);
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('overview');
    expect(
      wrapper.find('.event-area').attributes('data-runtime-review-role')
    ).toBe('overview');
    const sideInspector = wrapper.find(
      '[data-testid="workbench-side-inspector"]'
    );
    expect(sideInspector.exists()).toBe(true);
    expect(sideInspector.attributes('data-flow-phase')).toBe('action-edit');
    expect(sideInspector.attributes('data-main-flow-inspector-mode')).toBe(
      'action-properties'
    );
    expect(sideInspector.findComponent(PropertiesPanel).exists()).toBe(true);
    expect(sideInspector.find('.analysis-panel').exists()).toBe(true);
    expect(flowPanel.attributes('data-runtime-sim-log-count')).toBe('1');
    expect(flowPanel.attributes('data-contract-name')).toBe(
      'Action -> Hit -> ThreeValueDelta'
    );
    expect(flowPanel.attributes('data-generation-entry-status')).toBe(
      'action-hit-three-value-delta-generation-ready'
    );
    expect(flowPanel.attributes('data-runtime-input-source')).toBe(
      'threeValueRuntimeInput.appliedDeltas'
    );
    expect(flowPanel.attributes('data-runtime-output-status')).toBe(
      'runtime-output-contract-ready'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('-1');
    expect(
      flowPanel.find('[data-testid="workbench-flow-selected-action"]').text()
    ).toBe('普通攻击');
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-count"]').text()
    ).toBe('1 日志');
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toBe('未选中');
    expect(
      flowPanel.find('[data-testid="workbench-flow-edit-result"]').text()
    ).toBe('无刷新结果');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('-/1');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-previous"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-next"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-open-runtime"]')
        .attributes('disabled')
    ).toBeUndefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-open-runtime"]')
        .attributes('data-primary-action')
    ).toBe('true');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-edit-runtime-action"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-edit-runtime-action"]')
        .attributes('data-primary-action')
    ).toBe('false');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-return-edit-result"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-return-edit-result"]')
        .attributes('data-primary-action')
    ).toBe('false');
    expect(
      wrapper
        .findAll(
          '[data-testid="workbench-three-value-calculator-diagnostic-row"]'
        )
        .map(row => [
          row.attributes('data-calculator-scope'),
          row.find('span').text(),
          row.find('strong').text(),
          row.find('small').text(),
        ])
    ).toEqual([
      [
        'generation',
        '生成适配器',
        '3类/16条 · 可替换 16',
        '适配器 HP适配器 6 / 能量适配器 5 / 削韧适配器 5 · 来源 HP候选 5 / 能量候选 5 / 削韧候选 5 / +1 · 状态 候选未确认 15 / 公式未确认 1 · 缺口 最终公式 16 / 防御抗性顺序 6 / 命中绑定 6 / +4',
      ],
      [
        'runtime',
        '运行适配器',
        '1类/1条 · 可替换 1',
        '适配器 HP适配器 1 · 来源 HP预览 1 · 状态 公式未确认 1 · 缺口 最终公式 1 / 防御抗性顺序 1 / 命中绑定 1',
      ],
    ]);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-monitor"]')
        .exists()
    ).toBe(true);
    const resourceArea = wrapper.find(
      '[data-testid="workbench-resource-area"]'
    );
    expect(resourceArea.exists()).toBe(true);
    expect(
      resourceArea
        .find('[data-testid="workbench-runtime-resource-monitor"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper.find('[data-testid="workbench-runtime-enemy-hp-delta"]').text()
    ).toBe('12,461');
    expect(
      wrapper.find('[data-testid="workbench-runtime-enemy-hp-state"]').text()
    ).toBe('剩余 0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-enemy-toughness-delta"]')
        .text()
    ).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-enemy-toughness-state"]')
        .text()
    ).toBe('剩余待确认');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-count"]').text()
    ).toBe('1 日志');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-track-filter"]')
        .map(button => [
          button.attributes('data-track-filter'),
          button.text(),
          button.attributes('data-active'),
        ])
    ).toEqual([
      ['all', '全部1', 'true'],
      ['enemyHpDamage', 'HP1', 'false'],
      ['enemyToughnessDamage', '韧性0', 'false'],
      ['selfEnergyChange', '能量0', 'false'],
    ]);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-energy-actor-row"]')
        .map(row => row.text())
    ).toEqual(expect.arrayContaining([expect.stringContaining('末音')]));
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-energy-actor-state"]')
        .map(row => row.text())
    ).toEqual(expect.arrayContaining([expect.stringContaining('当前待确认')]));
    expect(
      wrapper.find('[data-testid="workbench-runtime-resource-chart"]').exists()
    ).toBe(true);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-resource-chart-mode"]')
        .map(button => [
          button.attributes('data-mode'),
          button.attributes('data-active'),
          button.text(),
        ])
    ).toEqual([
      ['delta', 'true', '累计变化'],
      ['state', 'false', '状态值'],
    ]);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-resource-chart-series"]')
        .map(row => [
          row.attributes('data-series-key'),
          row.attributes('data-track-key'),
          row.attributes('data-point-count'),
        ])
    ).toEqual(
      expect.arrayContaining([
        ['enemy-hp', 'enemyHpDamage', '1'],
        ['enemy-toughness', 'enemyToughnessDamage', '0'],
        expect.arrayContaining([
          expect.stringContaining('self-energy-'),
          'selfEnergyChange',
          expect.any(String),
        ]),
      ])
    );
    let runtimeCurvePoints = wrapper.findAll(
      '[data-testid="workbench-runtime-resource-chart-point"]'
    );
    expect(runtimeCurvePoints).toHaveLength(1);
    expect(runtimeCurvePoints[0].attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(runtimeCurvePoints[0].attributes('data-value')).toBe('12461');
    expect(runtimeCurvePoints[0].attributes('data-curve-mode')).toBe('delta');
    expect(runtimeCurvePoints[0].attributes('data-state-value')).toBe('0');
    expect(runtimeCurvePoints[0].attributes('data-overrun')).toBe('3833');

    await wrapper
      .find(
        '[data-testid="workbench-runtime-resource-chart-mode"][data-mode="state"]'
      )
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-resource-chart-mode"][data-mode="state"]'
        )
        .attributes('data-active')
    ).toBe('true');
    const stateModeHpPoint = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-point"][data-track-key="enemyHpDamage"]'
    );
    expect(stateModeHpPoint.attributes('data-curve-mode')).toBe('state');
    expect(stateModeHpPoint.attributes('data-value')).toBe('0');
    expect(stateModeHpPoint.attributes('data-cumulative')).toBe('12461');
    expect(stateModeHpPoint.attributes('data-state-value')).toBe('0');
    expect(stateModeHpPoint.attributes('data-overrun')).toBe('3833');
    const stateModeSeriesRows = wrapper.findAll(
      '[data-testid="workbench-runtime-resource-chart-series"]'
    );
    expect(
      stateModeSeriesRows
        .find(row => row.attributes('data-series-key') === 'enemy-hp')
        ?.text()
    ).toContain('剩余 0 / 溢出 3,833');
    expect(
      stateModeSeriesRows
        .filter(row => row.attributes('data-track-key') === 'selfEnergyChange')
        .map(row => row.text())
    ).toEqual(expect.arrayContaining([expect.stringContaining('当前待确认')]));

    await wrapper
      .find(
        '[data-testid="workbench-runtime-resource-chart-mode"][data-mode="delta"]'
      )
      .trigger('click');
    await nextTick();
    runtimeCurvePoints = wrapper.findAll(
      '[data-testid="workbench-runtime-resource-chart-point"]'
    );
    expect(runtimeCurvePoints[0].attributes('data-value')).toBe('12461');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-row"]').text()
    ).toContain('普通攻击 · HP 12,461');
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-detail"]').text()
    ).toContain('action-0001|applied-frame-0-point-0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-log-fallback');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-layout')
    ).toBe('full');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-placement')
    ).toBe('inline');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail-handoff"]')
        .exists()
    ).toBe(false);
    expect(runtimeCurvePoints[0].attributes('data-state-point-id')).toBe(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-state-point"]')
        .text()
    );
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-contribution-row"]')
        .map(row => row.text())
    ).toEqual(['敌人 HP12,461', '敌人韧性0', '自身能量0']);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-source-row"]')
        .map(row => row.text())
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Skill10900101'),
        expect.stringContaining('Element109001081'),
      ])
    );
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-calculator-row"]')
        .map(row => [row.attributes('data-calculator-key'), row.text()])
    ).toEqual([
      ['calculator', '适配器HP适配器'],
      ['kind', '来源HP预览'],
      ['replaceable', '替换可替换'],
      ['status', '公式公式未确认'],
      ['unresolved', '缺口最终公式、防御抗性顺序、命中绑定'],
    ]);
    expect(text).toContain(
      'HP 2 个候选 (109001081, 109001306) / 削韧 2 个候选 (109001081, 109001306) / 充能 2 个候选 (109001081, 109001306)'
    );
    expect(text).toContain(
      '公式候选 A 覆盖候选 1,600-3,360 / G 常量匹配 10,000'
    );
    expect(text).toContain('公式函数候选 f1 G/10000 / f2 self.ATK[0]*A/10000');
    expect(text).toContain('候选预览 f2 等级值 307 vs raw 12,461，约 2.5%');
    expect(text).toContain('组合诊断 f2 需 ×40.6 才接近 raw / 每 hit ×8.1');
    expect(text).toContain('执行矩阵摘要 1 动作 · 2 行 · 2 element');
    expect(text).toContain('缩放 ×40.6 / 每 hit ×8.1 · hit绑定 2/2');
    expect(text).toContain('执行矩阵 2 element');
    expect(text).toContain('function未确认 · A覆盖候选 2');
    expect(text).toContain('缩放 ×40.6 / 每 hit ×8.1 · 差异 2/2');
    expect(text).toContain(
      '逐hit候选 5/5段 · 三值字段 12 · 帧 12f/6f/12f/7f/4f · 绝对帧 0s12f/0s22f/1s3f/2s3f/3s4f · 连段桥 4/4'
    );
    expect(text).toContain('候选曲线');
    expect(text).toContain('HP参数候选');
    expect(text).toContain('5点 · 2,500-13,000 · raw-param');
    expect(text).toContain('削韧候选');
    expect(text).toContain('5点 · 7,000 · raw-field');
    expect(text).toContain('能量候选');
    expect(text).toContain('5点 · 2,399-3,000 · raw-field');
    expect(text).toContain('候选时间曲线');
    expect(text).toContain('60fps · 30s0f');
    expect(text).toContain('0s12f-3s4f · 2,500-13,000 · raw-param');
    expect(text).toContain('0s12f-3s4f · 7,000 · raw-field');
    expect(text).toContain('0s12f-3s4f · 2,399-3,000 · raw-field');
    expect(text).toContain('状态曲线');
    expect(text).toContain('敌人HP伤害');
    expect(text).toContain('已用 1点 Δ12,461 Σ12,461');
    expect(text).toContain('候选 5点 Δ2,500-13,000 Σ28,700');
    expect(text).toContain('敌人韧性削减');
    expect(text).toContain('自身能量变化');
    expect(
      wrapper.find('[data-testid="workbench-candidate-value-series"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-candidate-value-series-row"]')
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="workbench-candidate-value-chart"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-candidate-value-chart-row"]')
    ).toHaveLength(3);
    expect(
      wrapper.find('[data-testid="workbench-state-curves"]').exists()
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-row"]')
    ).toHaveLength(3);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('全部视角16/16点已用/候选 · 全部轨道 · 全部三值点');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('日志筛选1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .findAll('[data-testid="workbench-state-curve-layer-toggle"]')
        .map(toggle => toggle.attributes('data-layer-key'))
    ).toEqual(['applied', 'candidate', 'sampled', 'placeholder']);
    const stateCurveLayerToggles = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-state-curve-layer-toggle"]')
        .map(toggle => [toggle.attributes('data-layer-key'), toggle])
    );
    const getStateCurveLayerToggleText = key =>
      stateCurveLayerToggles[key].element.closest('label')?.textContent ?? '';
    expect(getStateCurveLayerToggleText('applied')).toContain('已用 1');
    expect(stateCurveLayerToggles.applied.attributes('data-point-count')).toBe(
      '1'
    );
    expect(getStateCurveLayerToggleText('candidate')).toContain('候选 15');
    expect(
      stateCurveLayerToggles.candidate.attributes('data-point-count')
    ).toBe('15');
    expect(getStateCurveLayerToggleText('sampled')).toContain('采样 0');
    expect(getStateCurveLayerToggleText('placeholder')).toContain('占位 0');
    expect(
      wrapper
        .findAll('[data-testid="workbench-state-curve-layer-role"]')
        .map(role => role.text())
    ).toEqual(['进曲线/日志', '不进结果', '不进结果', '不进结果']);
    const stateCurveTrackToggles = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-state-curve-track-toggle"]')
        .map(toggle => [toggle.attributes('data-track-key'), toggle])
    );
    expect(Object.keys(stateCurveTrackToggles)).toEqual([
      'enemyHpDamage',
      'enemyToughnessDamage',
      'selfEnergyChange',
    ]);
    expect(
      stateCurveTrackToggles.enemyHpDamage.attributes('data-point-count')
    ).toBe('6');
    expect(
      stateCurveTrackToggles.enemyToughnessDamage.attributes('data-point-count')
    ).toBe('5');
    expect(
      stateCurveTrackToggles.selfEnergyChange.attributes('data-point-count')
    ).toBe('5');
    const hpStateCurveRow = wrapper.find(
      '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpStateCurveRow.text()).toContain('raw-damage · 2/2层 · 6点');
    expect(hpStateCurveRow.text()).toContain('已用 1点 Δ12,461 Σ12,461');
    expect(hpStateCurveRow.text()).toContain('候选 5点 Δ2,500-13,000 Σ28,700');
    const hpStateCurvePoints = hpStateCurveRow.findAll(
      '[data-testid="workbench-state-curve-point"]'
    );
    expect(hpStateCurvePoints).toHaveLength(6);
    expect(hpStateCurvePoints[0].attributes('data-layer-key')).toBe('applied');
    expect(hpStateCurvePoints[0].attributes('data-participation')).toBe(
      '已应用'
    );
    expect(hpStateCurvePoints[0].attributes('data-frame-label')).toBe('0s0f');
    expect(hpStateCurvePoints[0].text()).toContain('已用 Δ12,461 Σ12,461');
    expect(
      hpStateCurvePoints[0]
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('参与当前三值曲线和模拟日志');
    expect(hpStateCurvePoints[0].text()).toContain('普通攻击');
    const firstCandidatePoint = hpStateCurvePoints.find(
      point =>
        point.attributes('data-layer-key') === 'candidate' &&
        point.attributes('data-frame-label') === '0s12f'
    );
    expect(firstCandidatePoint).toBeTruthy();
    expect(firstCandidatePoint.attributes('data-participation')).toBe(
      '候选诊断'
    );
    expect(firstCandidatePoint.text()).toContain('候选 Δ2,500 Σ2,500');
    expect(
      firstCandidatePoint
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('候选诊断，不参与当前结果');
    expect(firstCandidatePoint.text()).toContain('hit1');
    expect(firstCandidatePoint.text()).toContain('109001306');
    expect(firstCandidatePoint.text()).toContain('109001081');
    const firstCandidateStatePointId = firstCandidatePoint.attributes(
      'data-state-point-id'
    );
    expect(firstCandidateStatePointId).toBeTruthy();
    const stateTimelineMarkers = wrapper.findAll(
      '[data-testid="workbench-timeline-state-curve-marker"]'
    );
    expect(stateTimelineMarkers).toHaveLength(1);
    expect(stateTimelineMarkers[0].attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(stateTimelineMarkers[0].attributes('data-layer-key')).toBe(
      'applied'
    );
    expect(stateTimelineMarkers[0].attributes('data-frame-label')).toBe('0s0f');
    expect(stateTimelineMarkers[0].attributes('data-lane-id')).toBe(
      'actor-109001'
    );
    expect(stateTimelineMarkers[0].attributes('data-marker-title')).toContain(
      '状态点 敌人HP伤害 已用 0s0f: Δ12,461 Σ12,461'
    );
    expect(stateTimelineMarkers[0].attributes('data-marker-title')).toContain(
      '普通攻击'
    );
    const appliedStatePointId = stateTimelineMarkers[0].attributes(
      'data-state-point-id'
    );
    expect(appliedStatePointId).toBeTruthy();
    expect(hpStateCurvePoints[0].attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    let actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-has-runtime-trace')).toBe('true');
    expect(actionResultRow.attributes('data-runtime-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(actionResultRow.attributes('data-source-delta-ids')).toContain(
      'action-0001|applied-frame-0-point-0'
    );
    expect(actionResultRow.attributes()).toMatchObject({
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-action-result',
      'data-flow-action-state-point-id': appliedStatePointId,
    });
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-runtime-trace"]')
        .text()
    ).toContain(
      '定位 1条运行结果 · HP 12,461 · Delta action-0001|applied-frame-0-point-0'
    );
    await firstCandidatePoint.trigger('click');
    await nextTick();
    expect(firstCandidatePoint.classes()).toContain('selected');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${appliedStatePointId}"]`
        )
        .classes()
    ).not.toContain('selected');
    await stateTimelineMarkers[0].trigger('click');
    await nextTick();
    expect(
      getLastDispatchedFlowAction(wrapper, TimelineGridPreview)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'state-curve-point',
      statePointId: appliedStatePointId,
      payload: {
        preserveStateCurveFilters: true,
      },
    });
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${appliedStatePointId}"]`
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-state-curve-point"][data-state-point-id="${appliedStatePointId}"]`
        )
        .classes()
    ).toContain('selected');
    wrapper
      .findComponent(AnalysisPanel)
      .vm.$emit('select-state-curve-point', appliedStatePointId);
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-kind': 'select-runtime-state-point',
      'data-main-flow-dispatch-source': 'state-curve-point',
      'data-main-flow-dispatch-state-point-id': appliedStatePointId,
      'data-runtime-review-selected-state-point-id': appliedStatePointId,
      'data-runtime-review-source': 'state-curve-point',
    });
    const focusAllButton = wrapper.find(
      '[data-testid="workbench-state-curve-focus-all"]'
    );
    const focusSelectedButton = wrapper.find(
      '[data-testid="workbench-state-curve-focus-selected"]'
    );
    expect(focusAllButton.classes()).not.toContain('active');
    expect(focusSelectedButton.attributes('disabled')).toBeUndefined();
    expect(focusSelectedButton.classes()).toContain('active');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${appliedStatePointId}"]`
        )
        .attributes('data-runtime-focus-source')
    ).toBe('state-curve-point');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-point"]')
    ).toHaveLength(1);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .text()
    ).toContain('raw-damage · 1/1层 · 1点');
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(1);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('1/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-nav-prev"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-nav-next"]')
        .attributes('disabled')
    ).toBeUndefined();
    await wrapper
      .find('[data-testid="workbench-state-curve-nav-next"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('2/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(firstCandidateStatePointId);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="selected-frame"]'
        )
        .classes()
    ).toContain('active');
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-frame-hotspot"]'
      )
    ).toHaveLength(1);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
        )
        .attributes('data-series-key')
    ).toBe('hpDamageFormulaParamCandidate');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
        )
        .attributes('data-state-track-key')
    ).toBe('enemyHpDamage');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-marker"][data-track-focused="true"]'
        )
        .attributes('data-series-key')
    ).toBe('hpDamageFormulaParamCandidate');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="hpDamageFormulaParamCandidate"]'
        )
        .attributes('data-track-focused')
    ).toBe('true');
    const frameGroupOptions = wrapper.findAll(
      '[data-testid="workbench-state-curve-frame-group-option"]'
    );
    expect(frameGroupOptions).toHaveLength(3);
    expect(
      frameGroupOptions.map(option => option.attributes('data-track-key'))
    ).toEqual(['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange']);
    expect(frameGroupOptions[0].attributes('data-state-point-id')).toBe(
      firstCandidateStatePointId
    );
    const toughnessFrameGroupOption = frameGroupOptions.find(
      option => option.attributes('data-track-key') === 'enemyToughnessDamage'
    );
    expect(toughnessFrameGroupOption).toBeTruthy();
    await toughnessFrameGroupOption.trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('3/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-track-key')
    ).toBe('enemyToughnessDamage');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
        )
        .attributes('data-series-key')
    ).toBe('toughnessDamageCandidate');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-marker"][data-track-focused="true"]'
        )
        .attributes('data-series-key')
    ).toBe('toughnessDamageCandidate');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="toughnessDamageCandidate"]'
        )
        .attributes('data-track-focused')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="hpDamageFormulaParamCandidate"]'
        )
        .attributes('data-track-focused')
    ).toBe('false');
    expect(toughnessFrameGroupOption.text()).toContain('韧性');
    const hpFrameGroupOption = wrapper
      .findAll('[data-testid="workbench-state-curve-frame-group-option"]')
      .find(option => option.attributes('data-track-key') === 'enemyHpDamage');
    expect(hpFrameGroupOption).toBeTruthy();
    await hpFrameGroupOption.trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('2/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(firstCandidateStatePointId);
    await wrapper
      .find('[data-testid="workbench-state-curve-nav-prev"]')
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('1/16');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(appliedStatePointId);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(1);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="all"]'
        )
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
        )
        .exists()
    ).toBe(false);
    await focusAllButton.trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-point"]')
    ).toHaveLength(16);
    expect(
      wrapper.find('[data-testid="workbench-state-curve-focus-all"]').classes()
    ).toContain('active');
    const timelineStateTrackToggles = wrapper.findAll(
      '[data-testid="workbench-timeline-state-track-toggle"]'
    );
    expect(
      timelineStateTrackToggles.map(toggle =>
        toggle.attributes('data-track-key')
      )
    ).toEqual(['enemyHpDamage']);
    expect(timelineStateTrackToggles[0].attributes('data-point-count')).toBe(
      '1'
    );
    expect(timelineStateTrackToggles[0].element.checked).toBe(true);
    await stateCurveTrackToggles.enemyHpDamage.setValue(false);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('10');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .exists()
    ).toBe(false);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper.find(
        '[data-testid="workbench-timeline-state-track-toggle"][data-track-key="enemyHpDamage"]'
      ).element.checked
    ).toBe(false);
    await wrapper
      .find(
        '[data-testid="workbench-timeline-state-track-toggle"][data-track-key="enemyHpDamage"]'
      )
      .setValue(true);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-track-toggle"][data-track-key="enemyHpDamage"]'
      ).element.checked
    ).toBe(true);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(1);
    const timelineStateLayerToggles = wrapper.findAll(
      '[data-testid="workbench-timeline-state-layer-toggle"]'
    );
    expect(
      timelineStateLayerToggles.map(toggle =>
        toggle.attributes('data-layer-key')
      )
    ).toEqual(['applied']);
    expect(timelineStateLayerToggles[0].attributes('data-point-count')).toBe(
      '1'
    );
    expect(timelineStateLayerToggles[0].element.checked).toBe(true);
    await timelineStateLayerToggles[0].setValue(false);
    await nextTick();
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      ).element.checked
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('15');
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      )
      .setValue(true);
    await nextTick();
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(1);
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      )
      .setValue(false);
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .text()
    ).toContain('raw-damage · 1/1层 · 1点');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
        )
        .findAll('[data-testid="workbench-state-curve-point"]')
    ).toHaveLength(1);
    await wrapper
      .find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      )
      .setValue(true);
    await nextTick();
    const candidateMarkers = wrapper.findAll(
      '[data-testid="workbench-timeline-candidate-value-marker"]'
    );
    expect(candidateMarkers).toHaveLength(15);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-curve-track"]'
      )
    ).toHaveLength(1);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-curve"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-frame-hotspot"]'
      )
    ).toHaveLength(5);
    const candidateToggles = wrapper.findAll(
      '[data-testid="workbench-candidate-value-toggle"]'
    );
    expect(candidateToggles).toHaveLength(3);
    expect(
      candidateToggles.map(toggle => toggle.attributes('data-series-key'))
    ).toEqual([
      'hpDamageFormulaParamCandidate',
      'toughnessDamageCandidate',
      'selfEnergyCandidate',
    ]);
    const candidateScopeOptions = wrapper.findAll(
      '[data-testid="workbench-candidate-value-scope-option"]'
    );
    expect(candidateScopeOptions).toHaveLength(2);
    expect(
      candidateScopeOptions.map(option => option.attributes('data-scope-key'))
    ).toEqual(['all', 'selected-frame']);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="all"]'
        )
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="selected-frame"]'
        )
        .attributes('disabled')
    ).toBeUndefined();
    const actorFilter = wrapper.find(
      '[data-testid="workbench-candidate-value-actor-filter"]'
    );
    expect(actorFilter.element.value).toBe('all');
    expect(actorFilter.text()).toContain('末音');
    expect(actorFilter.text()).not.toContain('寒悠悠');
    await actorFilter.setValue('actor-109001');
    await nextTick();
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(15);
    const actionFilter = wrapper.find(
      '[data-testid="workbench-candidate-value-action-filter"]'
    );
    expect(actionFilter.element.value).toBe('all');
    expect(actionFilter.text()).toContain('普通攻击');
    await actionFilter.setValue('action-0001');
    await nextTick();
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(15);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="hpDamageFormulaParamCandidate"]'
        )
        .attributes('data-point-count')
    ).toBe('5');
    expect(
      candidateMarkers.every(
        marker => marker.attributes('data-lane-id') === 'actor-109001'
      )
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-marker"][data-series-key="hpDamageFormulaParamCandidate"][data-hit-index="1"]'
        )
        .attributes('data-frame-label')
    ).toBe('0s12f');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-marker"][data-series-key="hpDamageFormulaParamCandidate"][data-hit-index="1"]'
        )
        .attributes('data-marker-title')
    ).toBe('HP参数候选 0s12f hit1: 2,500 raw-param');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-frame-hotspot"][data-hit-index="1"]'
        )
        .attributes('data-marker-title')
    ).toBe(
      '0s12f hit1: HP参数候选 2,500 raw-param / 削韧候选 7,000 raw-field / 能量候选 2,700 raw-field'
    );
    await wrapper
      .find(
        '[data-testid="workbench-timeline-candidate-value-frame-hotspot"][data-hit-index="1"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-nav-position"]').text()
    ).toBe('2/16');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-state-curve-point"][data-state-point-id="${firstCandidateStatePointId}"]`
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-state-curve-frame-group-option"][data-state-point-id="${firstCandidateStatePointId}"]`
        )
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-candidate-value-frame-summary"]')
        .attributes('data-hit-index')
    ).toBe('1');
    const selectedFrameValues = wrapper
      .find('[data-testid="workbench-candidate-value-frame-summary-values"]')
      .text();
    expect(selectedFrameValues).toContain('HP 2,500 raw-param');
    expect(selectedFrameValues).toContain('韧性 7,000 raw-field');
    expect(selectedFrameValues).toContain('能量 2,700 raw-field');
    const selectedFrameSource = wrapper
      .find('[data-testid="workbench-candidate-value-frame-summary-source"]')
      .text();
    expect(selectedFrameSource).toContain('hitSkill 10900101');
    expect(selectedFrameSource).toContain('109001081');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="selected-frame"]'
        )
        .attributes('disabled')
    ).toBeUndefined();
    const selectedFrameDetailRows = wrapper.findAll(
      '[data-testid="workbench-candidate-value-frame-detail-row"]'
    );
    expect(selectedFrameDetailRows).toHaveLength(3);
    const hpFrameDetail = wrapper.find(
      '[data-testid="workbench-candidate-value-frame-detail-row"][data-series-key="hpDamageFormulaParamCandidate"]'
    );
    expect(hpFrameDetail.attributes('data-candidate-count')).toBe('4');
    expect(hpFrameDetail.attributes('data-source-frame-index')).toBe('12');
    expect(hpFrameDetail.text()).toContain('HP参数候选');
    expect(hpFrameDetail.text()).toContain('2,500 raw-param');
    expect(hpFrameDetail.text()).toContain(
      '样本 1,000/1,800/1,900/2,500 · 候选 4'
    );
    expect(hpFrameDetail.text()).toContain(
      '帧 src12 / disp12 / local12 / chain0 / abs12'
    );
    expect(hpFrameDetail.attributes('data-element-detail-count')).toBe('2');
    expect(hpFrameDetail.text()).toContain(
      '109001306 HP1,000/1,800/2,500 函数f1:G/10000/f2:self.ATK[0]*A/10000 槽A覆盖1,600-3,360/G直连10,000 韧性7,000 能量2,700/宠物10,399/间隔9,999'
    );
    expect(hpFrameDetail.text()).toContain(
      '109001081 HP1,000/1,900/2,500 函数f1:G/10000/f2:self.ATK[0]*A/10000 槽A覆盖1,600-3,360/G直连10,000 韧性7,000 能量2,700/宠物10,399/间隔9,999'
    );
    const elementComparison = wrapper.find(
      '[data-testid="workbench-candidate-element-comparison"]'
    );
    expect(elementComparison.exists()).toBe(true);
    const elementComparisonRows = wrapper.findAll(
      '[data-testid="workbench-candidate-element-comparison-row"]'
    );
    expect(elementComparisonRows).toHaveLength(2);
    const element109001306Row = elementComparisonRows.find(
      row => row.attributes('data-element-config-id') === '109001306'
    );
    expect(element109001306Row).toBeTruthy();
    expect(element109001306Row.text()).toContain('109001306');
    expect(element109001306Row.text()).toContain('1,000/1,800/2,500');
    expect(element109001306Row.text()).toContain(
      'f1:G/10000/f2:self.ATK[0]*A/10000'
    );
    expect(element109001306Row.text()).toContain(
      'A覆盖1,600-3,360/G直连10,000'
    );
    expect(element109001306Row.text()).toContain('7,000');
    expect(element109001306Row.text()).toContain(
      '能量2,700/宠物10,399/间隔9,999'
    );
    expect(element109001306Row.text()).toContain('function组合待验证');
    expect(element109001306Row.text()).toContain('等级覆盖待验证:1');
    expect(element109001306Row.text()).toContain('每hit倍率待分配');
    expect(element109001306Row.attributes('title')).toContain(
      '函数 f1:G/10000/f2:self.ATK[0]*A/10000'
    );
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-marker"][data-series-key="hpDamageFormulaParamCandidate"][data-hit-index="5"]'
        )
        .attributes('data-frame-label')
    ).toBe('3s4f');
    await wrapper
      .find(
        '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="selected-frame"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="selected-frame"]'
        )
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-curve"]'
      )
    ).toHaveLength(3);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-frame-hotspot"]'
      )
    ).toHaveLength(1);
    await wrapper
      .find(
        '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="all"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(15);
    expect(
      wrapper.find('[data-testid="workbench-state-curve-focus-all"]').classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('16');
    await wrapper
      .find(
        '[data-testid="workbench-candidate-value-toggle"][data-series-key="hpDamageFormulaParamCandidate"]'
      )
      .setValue(false);
    await nextTick();
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(10);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-curve"]'
      )
    ).toHaveLength(2);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="hpDamageFormulaParamCandidate"]'
        )
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-candidate-value-frame-summary-values"]')
        .text()
    ).not.toContain('HP');
    expect(
      wrapper.findAll(
        '[data-testid="workbench-candidate-value-frame-detail-row"]'
      )
    ).toHaveLength(2);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-candidate-value-frame-detail-row"][data-series-key="hpDamageFormulaParamCandidate"]'
        )
        .exists()
    ).toBe(false);
    await wrapper
      .find(
        '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="generation"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="generation"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      ).element.checked
    ).toBe(false);
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      ).element.checked
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('15');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('生成视角15/16点候选/采样/占位 · 全部轨道 · 全部三值点');
    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="selfEnergyChange"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('0/1');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('日志筛选0/1条能量 · 全部角色 · 全部动作');
    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    await actionResultRow.trigger('click');
    await nextTick();
    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected')).toBe('true');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('运行视角1/16点已用 · 全部轨道 · 选中三值点');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('结果定位1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="all"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-row"]')
        .attributes('data-selected')
    ).toBe('true');
    const actionResultCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(actionResultCurveSelection.exists()).toBe(true);
    expect(actionResultCurveSelection.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(actionResultCurveSelection.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      actionResultCurveSelection.attributes('data-runtime-focus-source')
    ).toBe('analysis-action-result');
    expect(actionResultCurveSelection.text()).toContain('动作结果定位');
    const actionResultDetailPanel = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(actionResultDetailPanel.exists()).toBe(true);
    expect(actionResultDetailPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(actionResultDetailPanel.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(actionResultDetailPanel.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(actionResultDetailPanel.attributes('data-detail-mode')).toBe(
      'compact'
    );
    expect(actionResultDetailPanel.attributes('data-full-detail-source')).toBe(
      'workbench-runtime-selected-detail'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-action-result-detail-action"]')
        .text()
    ).toContain('普通攻击');
    const actionResultDetailRows = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-action-result-detail-row"]')
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(Object.keys(actionResultDetailRows)).toEqual([
      'point',
      'delta',
      'cumulative',
      'state-status',
    ]);
    expect(actionResultDetailRows.point.text()).toContain('敌人HP伤害');
    expect(actionResultDetailRows.delta.text()).toBe('Delta12,461');
    expect(actionResultDetailRows.cumulative.text()).toBe('累计12,461');
    expect(actionResultDetailRows['state-status'].text()).toBe(
      '剩余 / 状态0 · raw-hp-projection'
    );
    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.exists()).toBe(true);
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(actionContributionPanel.attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': appliedStatePointId,
    });
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': appliedStatePointId,
    });
    expect(actionContributionPanel.text()).toContain('动作贡献拆分');
    expect(actionContributionPanel.text()).toContain('普通攻击');
    const actionContributionRows = wrapper.findAll(
      '[data-testid="workbench-action-contribution-row"]'
    );
    expect(actionContributionRows[0].attributes()).toMatchObject({
      'data-flow-action-kind': 'select-contribution-point',
      'data-flow-action-source': 'analysis-action-contribution',
      'data-flow-action-state-point-id': appliedStatePointId,
    });
    expect(
      actionContributionRows.map(row => [
        row.attributes('data-track-key'),
        row.attributes('data-active'),
        row.attributes('data-count'),
        row.attributes('data-delta'),
        row.text(),
      ])
    ).toEqual([
      [
        'enemyHpDamage',
        'true',
        '1',
        '12461',
        expect.stringContaining(
          '敌人 HP12,461详情已同步 · 已应用 1条 · action-0001|applied-frame-0-point-0'
        ),
      ],
      [
        'enemyToughnessDamage',
        'false',
        '0',
        '0',
        expect.stringContaining('敌人韧性0暂无已应用结果'),
      ],
      [
        'selfEnergyChange',
        'false',
        '0',
        '0',
        expect.stringContaining('自身能量0暂无已应用结果'),
      ],
    ]);
    const actionContributionDetail = wrapper.find(
      '[data-testid="workbench-action-contribution-detail"]'
    );
    expect(actionContributionDetail.exists()).toBe(true);
    expect(actionContributionDetail.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(actionContributionDetail.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    const actionContributionDetailRows = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-action-contribution-detail-row"]')
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(actionContributionDetailRows.statePoint.text()).toContain(
      appliedStatePointId
    );
    expect(actionContributionDetailRows.sourceDelta.text()).toContain(
      'action-0001|applied-frame-0-point-0'
    );
    expect(actionContributionDetailRows.sourceIds.text()).toContain(
      'Skill 10900101'
    );
    expect(actionContributionDetailRows.sourceIds.text()).toContain(
      'Element 109001081'
    );
    expect(actionContributionDetailRows.calculator.text()).toBe(
      '适配器HP适配器'
    );
    expect(actionContributionDetailRows.kind.text()).toBe('来源类型HP预览');
    expect(actionContributionDetailRows.status.text()).toBe(
      '公式状态公式未确认'
    );
    expect(actionContributionDetailRows.unresolved.text()).toContain(
      '最终公式、防御抗性顺序、命中绑定'
    );
    await actionContributionRows[0].trigger('click');
    await nextTick();
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('贡献定位1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    const contributionFocusedCurvePoint = wrapper.find(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${appliedStatePointId}"]`
    );
    expect(contributionFocusedCurvePoint.exists()).toBe(true);
    expect(contributionFocusedCurvePoint.attributes('data-selected')).toBe(
      'true'
    );
    expect(
      contributionFocusedCurvePoint.attributes('data-runtime-focus-source')
    ).toBe('action-contribution');
    const contributionFocusedTimelineMarker = wrapper.find(
      `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${appliedStatePointId}"]`
    );
    expect(contributionFocusedTimelineMarker.exists()).toBe(true);
    expect(contributionFocusedTimelineMarker.classes()).toContain('selected');
    expect(
      contributionFocusedTimelineMarker.attributes('data-runtime-focus-source')
    ).toBe('action-contribution');
    await wrapper
      .find(
        '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="runtime"]'
      )
      .trigger('click');
    await nextTick();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-three-value-calculator-diagnostic-row"][data-calculator-scope="runtime"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="applied"]'
      ).element.checked
    ).toBe(true);
    expect(
      wrapper.find(
        '[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="candidate"]'
      ).element.checked
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/1');
    expect(
      wrapper.find('[data-testid="workbench-state-curve-view-summary"]').text()
    ).toBe('运行视角1/16点已用 · 全部轨道 · 选中三值点');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-summary"]')
        .text()
    ).toBe('运行视角1/1条全部 · 全部角色 · 全部动作');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="all"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(text).toContain('候选三值');
    expect(text).toContain(
      '候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 动画+命中 / Skill0_6 动画+命中 · 普攻链 10900102->Skill0_2 / 10900103->Skill0_3 / +2 · 命中候选 5/5段 · 三值候选 5/5段 · 目标缺失 80102'
    );
    expect(text).toContain('伤害 12,461 · 韧性 0 · 能量 0');
    expect(text).toContain('low');
  });

  it('prioritizes runtime detail in the side inspector while reviewing results', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const sideInspector = wrapper.find(
      '[data-testid="workbench-side-inspector"]'
    );
    expect(sideInspector.attributes('data-main-flow-inspector-mode')).toBe(
      'action-properties'
    );
    expect(
      sideInspector
        .find('[data-inspector-panel-key="properties"]')
        .attributes('data-inspector-panel-order')
    ).toBe('0');
    expect(
      sideInspector
        .find('[data-inspector-panel-key="runtime-detail"]')
        .attributes('data-inspector-panel-order')
    ).toBe('2');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    expect(sideInspector.attributes('data-main-flow-inspector-mode')).toBe(
      'runtime-detail'
    );
    expect(
      sideInspector
        .find('[data-inspector-panel-key="runtime-detail"]')
        .attributes('data-inspector-panel-order')
    ).toBe('0');
    expect(
      sideInspector
        .find('[data-inspector-panel-key="properties"]')
        .attributes('data-inspector-panel-order')
    ).toBe('1');
  });

  it('drives the edit-runtime-return loop from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      attachTo: document.body,
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const openRuntimeButton = wrapper.find(
      '[data-testid="workbench-flow-open-runtime"]'
    );
    expect(openRuntimeButton.attributes('disabled')).toBeUndefined();
    expect(openRuntimeButton.attributes('data-primary-action')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-primary-kind')
    ).toBe('open-runtime-results');

    const originalRuntimeLogScrollIntoView = Element.prototype.scrollIntoView;
    const runtimeLogScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = runtimeLogScrollIntoView;

    try {
      await openRuntimeButton.trigger('click');
      await nextTick();
      await nextTick();
      await Promise.resolve();
    } finally {
      if (originalRuntimeLogScrollIntoView) {
        Element.prototype.scrollIntoView = originalRuntimeLogScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      canRun: true,
    });
    const selectedRuntimePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    const scrolledRuntimeLogRow = runtimeLogScrollIntoView.mock.contexts.find(
      element =>
        element?.getAttribute('data-testid') ===
          'workbench-runtime-sim-log-row' &&
        element.getAttribute('data-state-point-id') === selectedRuntimePointId
    );
    expect(scrolledRuntimeLogRow).toBeTruthy();
    const focusedFlowPanel = wrapper.find(
      '[data-testid="workbench-flow-panel"]'
    );
    expect(focusedFlowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(focusedFlowPanel.attributes('data-flow-phase')).toBe(
      'runtime-result'
    );
    expect(
      focusedFlowPanel.attributes('data-runtime-detail-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(focusedFlowPanel.attributes('data-flow-primary-kind')).toBe(
      'focus-runtime-action'
    );
    expect(focusedFlowPanel.attributes('data-flow-primary-action-id')).toBe(
      'action-0001'
    );
    expect(
      focusedFlowPanel.attributes('data-flow-primary-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(focusedFlowPanel.attributes('data-main-flow-next-target-kind')).toBe(
      'runtime-action-edit'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-flow-phase')
    ).toBe('runtime-result');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-current-region')
    ).toBe('runtime-review');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-selected-runtime-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-sequence': '1',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-has-result': 'true',
      'data-main-flow-dispatch-kind': 'open-runtime-results',
      'data-main-flow-dispatch-source': 'workbench-flow-panel',
      'data-main-flow-dispatch-handler-key': 'openRuntimeResults',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-dispatch-state-point-id': '',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
      'data-main-flow-loop-current-region': 'runtime-review',
      'data-main-flow-loop-next-region': 'action-edit',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-action-id': 'action-0001',
      'data-runtime-review-selected-state-point-id': selectedRuntimePointId,
      'data-runtime-review-pending-state-point-id': '',
      'data-runtime-review-source': '',
      'data-runtime-review-source-kind': 'none',
      'data-runtime-review-last-action-kind': '',
      'data-runtime-review-last-action-source': '',
    });
    expect(focusedFlowPanel.attributes()).toMatchObject({
      'data-main-flow-dispatch-sequence': '1',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-kind': 'open-runtime-results',
      'data-main-flow-dispatch-source': 'workbench-flow-panel',
      'data-main-flow-dispatch-handler-key': 'openRuntimeResults',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-primary-flow"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-side-inspector"]')
        .attributes('data-main-flow-inspector-mode')
    ).toBe('runtime-detail');
    expect(
      focusedFlowPanel.attributes('data-main-flow-action-edit-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(
      focusedFlowPanel.attributes('data-main-flow-return-state-point-id')
    ).toBe('');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-flow-selected-action-id': 'action-0001',
      'data-flow-selected-state-curve-point-id': selectedRuntimePointId,
    });
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': selectedRuntimePointId,
    });
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': selectedRuntimePointId,
    });
    expect(wrapper.find('.event-log-panel').attributes()).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-flow-state-point-id': selectedRuntimePointId,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail"]')
        .attributes('data-flow-phase')
    ).toBe('runtime-result');
    expect(
      focusedFlowPanel
        .find('[data-testid="workbench-flow-runtime-detail"]')
        .text()
    ).toContain('敌人HP伤害');

    const editRuntimeActionButton = focusedFlowPanel.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(editRuntimeActionButton.attributes('disabled')).toBeUndefined();
    expect(editRuntimeActionButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(editRuntimeActionButton.attributes('data-state-point-id')).toBe(
      selectedRuntimePointId
    );
    expect(editRuntimeActionButton.attributes('data-primary-action')).toBe(
      'true'
    );

    const originalScrollIntoView = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      await editRuntimeActionButton.trigger('click');
      await nextTick();
      await nextTick();
      await Promise.resolve();

      const scrolledElement = scrollIntoView.mock.contexts.at(-1);
      expect(scrolledElement?.getAttribute('data-testid')).toBe(
        'workbench-action-frame-control'
      );
      expect(scrolledElement?.getAttribute('data-edit-field')).toBe('startMs');
    } finally {
      if (originalScrollIntoView) {
        Element.prototype.scrollIntoView = originalScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      statePointId: selectedRuntimePointId,
      canRun: true,
      payload: {
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
      },
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'workbench-flow-panel'
    );
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-source')
    ).toBe('workbench-flow-panel');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    const refreshedFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    const refreshedStatePointId = refreshedFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(selectedRuntimePointId);
    const editResultFlowPanel = wrapper.find(
      '[data-testid="workbench-flow-panel"]'
    );
    expect(editResultFlowPanel.attributes('data-flow-phase')).toBe(
      'edit-result-ready'
    );
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-ready',
    });
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-ready',
    });
    expect(wrapper.find('.event-log-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-ready',
    });
    const returnEditResultButton = editResultFlowPanel.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(
      editResultFlowPanel.attributes('data-edit-result-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(editResultFlowPanel.attributes('data-flow-primary-kind')).toBe(
      'return-runtime-result'
    );
    expect(editResultFlowPanel.attributes('data-flow-primary-action-id')).toBe(
      'action-0001'
    );
    expect(
      editResultFlowPanel.attributes('data-flow-primary-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      editResultFlowPanel.attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-result-return');
    expect(
      editResultFlowPanel.attributes(
        'data-main-flow-action-edit-state-point-id'
      )
    ).toBe('');
    expect(
      editResultFlowPanel.attributes('data-main-flow-return-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-ready');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-current-region')
    ).toBe('action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-pending-runtime-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-primary-flow"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-result-return');
    expect(
      wrapper
        .find('[data-testid="workbench-side-inspector"]')
        .attributes('data-main-flow-inspector-mode')
    ).toBe('edit-result');
    expect(returnEditResultButton.attributes('disabled')).toBeUndefined();
    expect(returnEditResultButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(returnEditResultButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(returnEditResultButton.attributes('data-primary-action')).toBe(
      'true'
    );
    const propertiesResultReturn = wrapper.find(
      '[data-testid="workbench-action-edit-result-return"]'
    );
    expect(propertiesResultReturn.exists()).toBe(true);
    expect(propertiesResultReturn.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(propertiesResultReturn.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(
      propertiesResultReturn.attributes('data-origin-state-point-id')
    ).toBe(selectedRuntimePointId);
    const detailResultReturn = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(detailResultReturn.exists()).toBe(true);
    expect(detailResultReturn.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(detailResultReturn.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnEditResultButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
      payload: {
        originStatePointId: selectedRuntimePointId,
        status: 'refreshed-edit-result',
      },
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-primary-kind')
    ).toBe('focus-runtime-action');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-main-flow-action-edit-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-main-flow-return-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-current-region')
    ).toBe('runtime-review');
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-selected-runtime-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-main-flow-workspace"]')
        .attributes('data-main-flow-pending-runtime-state-point-id')
    ).toBe('');
    expect(
      wrapper
        .find('[data-testid="workbench-primary-flow"]')
        .attributes('data-main-flow-next-target-kind')
    ).toBe('runtime-action-edit');
    expect(
      wrapper
        .find('[data-testid="workbench-side-inspector"]')
        .attributes('data-main-flow-inspector-mode')
    ).toBe('runtime-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-flow-selected-action-id': 'action-0001',
      'data-flow-selected-state-curve-point-id': refreshedStatePointId,
    });
    expect(wrapper.find('.analysis-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-state-point-id': refreshedStatePointId,
    });
    expect(wrapper.find('.resource-monitor-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-state-point-id': refreshedStatePointId,
    });
    expect(wrapper.find('.event-log-panel').attributes()).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-state-point-id': refreshedStatePointId,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail"]')
        .attributes()
    ).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-flow-edit-result-state-point-id': refreshedStatePointId,
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-result-context-status')
    ).toBe('refreshed-edit-result');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-result-context-origin-state-point-id')
    ).toBe(selectedRuntimePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-return-result"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('supports the visible workbench loop across curve, log, detail, edit, and refreshed result', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const openedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(openedStatePointId).toBeTruthy();
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-phase')
    ).toBe('runtime-result');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-review-stack"]')
        .attributes('data-runtime-review-layout')
    ).toBe('result-check');
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('primary');
    expect(
      wrapper.find('.event-area').attributes('data-runtime-review-role')
    ).toBe('secondary');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(openedStatePointId);

    const runtimeCurvePoint = wrapper.find(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedStatePointId}"]`
    );
    expect(runtimeCurvePoint.exists()).toBe(true);

    await runtimeCurvePoint.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      statePointId: openedStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-resource-chart-selection-action-focus"]'
        )
        .text()
    ).toBe('编辑结果动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-action-focus"]')
        .text()
    ).toBe('编辑结果动作');

    const runtimeLogRow = wrapper.find(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedStatePointId}"]`
    );
    expect(runtimeLogRow.exists()).toBe(true);

    await runtimeLogRow.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-row',
      statePointId: openedStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail"]')
        .attributes()
    ).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-state-point-id': openedStatePointId,
      'data-runtime-review-source': 'event-log-runtime-row',
      'data-runtime-review-source-kind': 'log',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-action"]')
        .text()
    ).toContain('普通攻击');

    const detailActionFocus = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-action-focus"]'
    );
    expect(detailActionFocus.attributes('disabled')).toBeUndefined();
    expect(detailActionFocus.text()).toBe('编辑结果动作');

    await detailActionFocus.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: openedStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-frame-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');

    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('6');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('100');

    const editFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    const refreshedStatePointId = editFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(openedStatePointId);
    expect(editFeedback.attributes('data-origin-state-point-id')).toBe(
      openedStatePointId
    );

    const returnButton = wrapper.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnButton.attributes('disabled')).toBeUndefined();
    expect(returnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(returnButton.text()).toBe('查看刷新结果');

    await returnButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'workbench-flow-panel',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
      payload: {
        originStatePointId: openedStatePointId,
        status: 'refreshed-edit-result',
      },
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-flow-phase')
    ).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-review-stack"]')
        .attributes('data-runtime-review-layout')
    ).toBe('result-check');
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('primary');
    expect(
      wrapper.find('.event-area').attributes('data-runtime-review-role')
    ).toBe('secondary');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-result-context-status')
    ).toBe('refreshed-edit-result');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-return-result"]')
        .text()
    ).toBe('查看刷新结果');
  });

  it('guards the desktop result loop layout contract', () => {
    const appSource = compactSource(readTestSource('../../App.vue'));
    const workbenchSource = compactSource(
      readTestSource('../../views/Workbench.vue')
    );
    const resourcePanelSource = compactSource(
      readTestSource('../../features/workbench/ResourceMonitorPanel.vue')
    );
    const eventPanelSource = compactSource(
      readTestSource('../../features/workbench/EventLogPanel.vue')
    );
    const resultPhaseSelector =
      ":is([data-flow-phase='runtime-result'],[data-flow-phase='edit-result-review'])";

    expect(appSource).toContain(
      '.app{width:100%;min-width:0;min-height:100vh;'
    );
    expect(appSource).not.toContain('width:100vw');
    expect(workbenchSource).toContain(
      'grid-template-columns:minmax(230px,280px)minmax(0,1fr)minmax(260px,340px);'
    );
    expect(workbenchSource).toContain(
      '.primary-flow{display:grid;grid-area:mainflow;align-content:start;gap:14px;min-width:0;}'
    );
    expect(workbenchSource).toContain(
      '.runtime-review-stack{display:grid;grid-template-columns:minmax(280px,0.92fr)minmax(320px,1.08fr);align-items:start;gap:14px;min-width:0;}'
    );
    expect(workbenchSource).toContain(
      `.primary-flow${resultPhaseSelector}.runtime-review-stack{order:-1;}`
    );
    expect(workbenchSource).toContain(
      `.primary-flow${resultPhaseSelector}.timeline-area{order:1;}`
    );
    expect(workbenchSource).toContain(
      ".runtime-review-stack[data-runtime-review-layout='result-check']{grid-template-columns:minmax(300px,1.12fr)minmax(220px,0.88fr);align-items:stretch;gap:10px;}"
    );
    expect(workbenchSource).toContain(
      '.timeline-area,.resource-area,.event-area{min-width:0;}'
    );
    expect(resourcePanelSource).toContain(
      `.resource-monitor-panel${resultPhaseSelector}.runtime-curve-panel{`
    );
    expect(resourcePanelSource).toContain(
      `.resource-monitor-panel${resultPhaseSelector}.runtime-curve-chart{min-height:96px;}`
    );
    expect(eventPanelSource).toContain(
      `.event-log-panel${resultPhaseSelector}.runtime-log-list{max-height:132px;}`
    );
    expect(eventPanelSource).toContain(
      `.event-log-panel${resultPhaseSelector}.runtime-log-row{grid-template-columns:52px46pxminmax(0,1fr);gap:6px;padding:6px8px;}`
    );
    expect(workbenchSource).not.toContain(
      ".primary-flow[data-flow-phase='runtime-result'].runtime-review-stack"
    );
    expect(resourcePanelSource).not.toContain(
      ".resource-monitor-panel[data-flow-phase='runtime-result']"
    );
    expect(eventPanelSource).not.toContain(
      ".event-log-panel[data-flow-phase='runtime-result']"
    );
  });

  it('guards the narrow result loop layout contract', () => {
    const workbenchSource = compactSource(
      readTestSource('../../views/Workbench.vue')
    );
    const resourcePanelSource = compactSource(
      readTestSource('../../features/workbench/ResourceMonitorPanel.vue')
    );
    const eventPanelSource = compactSource(
      readTestSource('../../features/workbench/EventLogPanel.vue')
    );
    const runtimeDetailPanelSource = compactSource(
      readTestSource('../../features/workbench/RuntimeSelectedDetailPanel.vue')
    );

    expect(workbenchSource).toContain(
      ".runtime-review-stack[data-runtime-review-layout='result-check']{grid-template-columns:1fr;}"
    );
    expect(resourcePanelSource).toContain(
      '@media(max-width:760px){.runtime-state-grid,.runtime-curve-selection-primary,.runtime-curve-selection-grid{grid-template-columns:1fr;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-selection-heading{grid-template-columns:minmax(0,1fr);align-items:stretch;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-action-focus{width:100%;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-selection-nav{grid-template-columns:28pxminmax(0,1fr)28px;}'
    );
    expect(resourcePanelSource).toContain(
      '.runtime-curve-legend-row{grid-template-columns:9pxminmax(0,1fr);}'
    );
    expect(eventPanelSource).toContain(
      '@media(max-width:760px){.event-list>li,.runtime-log-row,.runtime-log-detail,.runtime-select-filters{grid-template-columns:1fr;gap:4px;}'
    );
    expect(eventPanelSource).toContain(
      '.runtime-track-filters{grid-template-columns:repeat(2,minmax(0,1fr));}'
    );
    expect(eventPanelSource).toContain(
      ".runtime-log-filter-summary,.runtime-log-navigation,.runtime-log-detail[data-detail-layout='compact'],.runtime-log-detail.runtime-log-edit-context,.runtime-log-detail.runtime-log-detail-handoff{grid-template-columns:1fr;}"
    );
    expect(eventPanelSource).toContain(
      '.runtime-log-selection-note{align-items:stretch;flex-direction:column;}'
    );
    expect(eventPanelSource).toContain(
      '.runtime-log-selection-notebutton,.runtime-log-action-focus,.runtime-log-result-return{width:100%;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-edit-context,.runtime-detail-return-context,.runtime-detail-contribution-summary{grid-template-columns:1fr;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-summarystrong,.runtime-detail-valuesstrong,.runtime-detail-metastrong{overflow-wrap:anywhere;text-align:left;text-overflow:clip;white-space:normal;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-contribution-row,.runtime-detail-calculator-row,.runtime-detail-source-row{align-items:flex-start;flex-direction:column;gap:3px;}'
    );
    expect(runtimeDetailPanelSource).toContain(
      '.runtime-detail-contribution-rowstrong,.runtime-detail-calculator-rowstrong,.runtime-detail-source-rowstrong{overflow-wrap:anywhere;text-align:left;white-space:normal;}'
    );
  });

  it('edits selected action timing with 60fps frame controls', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper
        .find('[data-testid="workbench-action-frame-controls"]')
        .attributes('data-frame-rate')
    ).toBe('60');
    expect(
      wrapper.find('[data-testid="workbench-start-frame-input"]').element.value
    ).toBe('0');
    expect(
      wrapper.find('[data-testid="workbench-duration-frame-input"]').element
        .value
    ).toBe('60');

    await wrapper
      .find('[data-testid="workbench-start-frame-input"]')
      .setValue('30');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('500');

    await wrapper
      .find('[data-testid="workbench-duration-frame-input"]')
      .setValue('45');
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-duration-frame-input"]').element
        .value
    ).toBe('45');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      id: 'action-0001',
      startMs: 500,
      durationMs: 750,
    });
  });

  it('records failed main flow dispatch results at the workbench layer', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    wrapper
      .findComponent(TimelineGridPreview)
      .vm.$emit('dispatch-flow-action', {
        kind: 'unsupported-flow-action',
        source: 'test-flow-source',
        statePointId: 'runtime-point-for-failure',
      });
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-sequence': '1',
      'data-main-flow-dispatch-status': 'failed',
      'data-main-flow-dispatch-handled': 'false',
      'data-main-flow-dispatch-has-result': 'true',
      'data-main-flow-dispatch-kind': 'unsupported-flow-action',
      'data-main-flow-dispatch-source': 'test-flow-source',
      'data-main-flow-dispatch-handler-key': '',
      'data-main-flow-dispatch-reason': 'unsupported-flow-action-kind',
      'data-main-flow-dispatch-action-id': '',
      'data-main-flow-dispatch-state-point-id': 'runtime-point-for-failure',
      'data-main-flow-loop-step': 'action-edit',
      'data-main-flow-loop-status': 'blocked',
      'data-main-flow-loop-recovery-needed': 'true',
      'data-main-flow-loop-next-action-kind': 'open-runtime-results',
      'data-main-flow-loop-next-target-kind': 'runtime-results',
      'data-runtime-review-selection-status': 'empty',
      'data-runtime-review-selected-action-id': '',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-source-kind': 'none',
    });

    const recoveryButton = wrapper.find(
      '[data-testid="workbench-flow-open-runtime"]'
    );
    expect(recoveryButton.attributes('disabled')).toBeUndefined();

    await recoveryButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-recovery',
      actionId: 'action-0001',
      canRun: true,
    });
    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-flow-phase': 'runtime-result',
      'data-main-flow-dispatch-sequence': '2',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-handled': 'true',
      'data-main-flow-dispatch-has-result': 'true',
      'data-main-flow-dispatch-kind': 'open-runtime-results',
      'data-main-flow-dispatch-source': 'workbench-flow-recovery',
      'data-main-flow-dispatch-handler-key': 'openRuntimeResults',
      'data-main-flow-dispatch-reason': '',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-loop-step': 'runtime-review',
      'data-main-flow-loop-status': 'advanced',
      'data-main-flow-loop-recovery-needed': 'false',
      'data-main-flow-loop-next-action-kind': 'focus-runtime-action',
      'data-main-flow-loop-next-target-kind': 'runtime-action-edit',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-action-id': 'action-0001',
      'data-runtime-review-source-kind': 'none',
    });
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(true);
  });

  it('opens the refreshed runtime result after a direct action edit from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-edit-result-state-point-id')).toBe('');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-return-edit-result"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(false);

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const refreshedStatePointId = flowPanel.attributes(
      'data-edit-result-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    const actionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(actionEditFeedback.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionEditFeedback.attributes('data-edit-origin')).toBe('');
    const pendingRuntimeDetailPanel = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail"]'
    );
    expect(pendingRuntimeDetailPanel.exists()).toBe(true);
    expect(pendingRuntimeDetailPanel.attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'pending-result',
      'data-runtime-review-selected-state-point-id': '',
      'data-runtime-review-primary-operation-kind': 'return-runtime-result',
      'data-runtime-review-primary-operation-enabled': 'true',
      'data-runtime-review-focus-action-enabled': 'false',
      'data-runtime-review-return-result-enabled': 'true',
    });
    expect(
      pendingRuntimeDetailPanel
        .find(
          '[data-testid="workbench-runtime-selected-detail-return-context"]'
        )
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
    const returnEditResultButton = flowPanel.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnEditResultButton.attributes('disabled')).toBeUndefined();
    expect(returnEditResultButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(returnEditResultButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnEditResultButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('runs the selected runtime review primary operation from the workbench stack', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const firstLogRow = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    const statePointId = firstLogRow.attributes('data-state-point-id');
    expect(statePointId).toBeTruthy();

    await firstLogRow.trigger('click');
    await nextTick();

    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-primary-operation-kind': 'focus-runtime-action',
      'data-runtime-review-primary-operation-enabled': 'true',
    });
    expect(
      runtimeReviewStack
        .find('[data-testid="workbench-runtime-review-primary-bar"]')
        .attributes()
    ).toMatchObject({
      'data-primary-operation-action-id': 'action-0001',
      'data-primary-operation-kind': 'focus-runtime-action',
      'data-primary-operation-state-point-id': statePointId,
    });
    const primaryOperation = runtimeReviewStack.find(
      '[data-testid="workbench-runtime-review-primary-operation"]'
    );
    expect(primaryOperation.exists()).toBe(true);
    expect(primaryOperation.attributes()).toMatchObject({
      'data-action-id': 'action-0001',
      'data-operation-kind': 'focus-runtime-action',
      'data-state-point-id': statePointId,
    });
    expect(primaryOperation.attributes('disabled')).toBeUndefined();
    expect(primaryOperation.text()).toBe('编辑结果动作');

    await primaryOperation.trigger('click');
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-kind': 'focus-runtime-action',
      'data-main-flow-dispatch-source': 'runtime-review-primary',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-dispatch-state-point-id': statePointId,
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'runtime-review-primary'
    );
  });

  it('returns to the refreshed runtime result from the workbench review primary operation', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const refreshedStatePointId = flowPanel.attributes(
      'data-edit-result-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();

    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-selection-status': 'pending-result',
      'data-runtime-review-primary-operation-kind': 'return-runtime-result',
      'data-runtime-review-primary-operation-enabled': 'true',
    });
    expect(
      runtimeReviewStack
        .find('[data-testid="workbench-runtime-review-primary-bar"]')
        .attributes()
    ).toMatchObject({
      'data-primary-operation-action-id': 'action-0001',
      'data-primary-operation-kind': 'return-runtime-result',
      'data-primary-operation-state-point-id': refreshedStatePointId,
    });
    const primaryOperation = runtimeReviewStack.find(
      '[data-testid="workbench-runtime-review-primary-operation"]'
    );
    expect(primaryOperation.exists()).toBe(true);
    expect(primaryOperation.attributes()).toMatchObject({
      'data-action-id': 'action-0001',
      'data-operation-kind': 'return-runtime-result',
      'data-state-point-id': refreshedStatePointId,
    });
    expect(primaryOperation.text()).toBe('查看刷新结果');

    await primaryOperation.trigger('click');
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-main-flow-workspace"]').attributes()
    ).toMatchObject({
      'data-flow-phase': 'edit-result-review',
      'data-main-flow-dispatch-status': 'handled',
      'data-main-flow-dispatch-kind': 'return-runtime-result',
      'data-main-flow-dispatch-source': 'runtime-review-primary',
      'data-main-flow-dispatch-action-id': 'action-0001',
      'data-main-flow-dispatch-state-point-id': refreshedStatePointId,
      'data-runtime-review-selection-status': 'selected',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
  });

  it('returns to the refreshed resource result from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const selectedRuntimePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toContain('自身能量');

    const editRuntimeActionButton = flowPanel.find(
      '[data-testid="workbench-flow-edit-runtime-action"]'
    );
    expect(editRuntimeActionButton.attributes('disabled')).toBeUndefined();

    await editRuntimeActionButton.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('1500');
    await nextTick();

    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(selectedRuntimePointId);

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    const returnEditResultButton = flowPanel.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnEditResultButton.attributes('data-action-id')).toBe(
      'action-0002'
    );
    expect(returnEditResultButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnEditResultButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toContain('自身能量');
  });

  it('refreshes runtime navigation order after editing a result action time', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const previousRuntimePointButton = flowPanel.find(
      '[data-testid="workbench-flow-runtime-previous"]'
    );
    const firstActionRuntimePointId = previousRuntimePointButton.attributes(
      'data-state-point-id'
    );

    await previousRuntimePointButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'workbench-flow-navigation',
      statePointId: firstActionRuntimePointId,
      canRun: true,
    });
    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(firstActionRuntimePointId);

    await flowPanel
      .find('[data-testid="workbench-flow-edit-runtime-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('6000');
    await nextTick();

    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(firstActionRuntimePointId);

    await wrapper
      .find('[data-testid="workbench-flow-return-edit-result"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('2/2');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-previous"]')
        .attributes('disabled')
    ).toBeUndefined();
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-next"]')
        .attributes('disabled')
    ).toBeDefined();
  });

  it('navigates runtime result points from the main flow panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('2/2');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-next"]')
        .attributes('disabled')
    ).toBeDefined();
    const previousRuntimePointButton = flowPanel.find(
      '[data-testid="workbench-flow-runtime-previous"]'
    );
    const previousRuntimePointId = previousRuntimePointButton.attributes(
      'data-state-point-id'
    );
    expect(previousRuntimePointButton.attributes('disabled')).toBeUndefined();
    expect(previousRuntimePointId).toBeTruthy();

    await previousRuntimePointButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(previousRuntimePointId);
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-navigation-index"]')
        .text()
    ).toBe('1/2');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-runtime-previous"]')
        .attributes('disabled')
    ).toBeDefined();
    const nextRuntimePointButton = flowPanel.find(
      '[data-testid="workbench-flow-runtime-next"]'
    );
    const nextRuntimePointId = nextRuntimePointButton.attributes(
      'data-state-point-id'
    );
    expect(nextRuntimePointButton.attributes('disabled')).toBeUndefined();
    expect(nextRuntimePointId).toBeTruthy();

    await nextRuntimePointButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'workbench-flow-navigation',
      statePointId: nextRuntimePointId,
      canRun: true,
    });
    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextRuntimePointId);
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
  });

  it('navigates runtime result points from the runtime detail panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let detailNavigation = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-navigation"]'
    );
    expect(detailNavigation.attributes()).toMatchObject({
      'data-navigation-count': '2',
      'data-navigation-index': '1',
    });
    expect(
      detailNavigation
        .find(
          '[data-testid="workbench-runtime-selected-detail-navigation-index"]'
        )
        .text()
    ).toBe('2/2');
    const previousButton = detailNavigation.find(
      '[data-testid="workbench-runtime-selected-detail-navigation-prev"]'
    );
    const previousStatePointId = previousButton.attributes(
      'data-state-point-id'
    );
    expect(previousButton.attributes('disabled')).toBeUndefined();
    expect(previousStatePointId).toBeTruthy();

    await previousButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'runtime-detail-navigation',
      statePointId: previousStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(previousStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0001');

    detailNavigation = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-navigation"]'
    );
    expect(detailNavigation.attributes('data-navigation-index')).toBe('0');
    expect(
      detailNavigation
        .find(
          '[data-testid="workbench-runtime-selected-detail-navigation-prev"]'
        )
        .attributes('disabled')
    ).toBeDefined();
    const nextButton = detailNavigation.find(
      '[data-testid="workbench-runtime-selected-detail-navigation-next"]'
    );
    const nextStatePointId = nextButton.attributes('data-state-point-id');
    expect(nextButton.attributes('disabled')).toBeUndefined();
    expect(nextStatePointId).toBeTruthy();

    await nextButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'runtime-detail-navigation',
      statePointId: nextStatePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');
  });

  it('syncs runtime detail when selecting another action in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const firstActionStatePointId = flowPanel
      .find('[data-testid="workbench-flow-runtime-previous"]')
      .attributes('data-state-point-id');
    expect(firstActionStatePointId).toBeTruthy();

    await wrapper
      .find(
        '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
      )
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(firstActionStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
  });

  it('clears stale runtime detail when inserting a no-result action in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const initialStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(initialStatePointId).toBeTruthy();

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-overview-active')).toBe('true');
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('-1');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe('');
    expect(flowPanel.attributes('data-runtime-detail-state-point-id')).toBe('');
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');
  });

  it('opens the first runtime result from a selected no-result action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe('');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('-1');

    await flowPanel
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(
      getLastDispatchedFlowAction(wrapper, WorkbenchFlowPanel)
    ).toMatchObject({
      kind: 'open-runtime-results',
      source: 'workbench-flow-panel',
      actionId: 'action-0002',
      payload: {
        fallbackToFirstRuntimePoint: true,
      },
      canRun: true,
    });
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBeTruthy();
  });

  it('syncs runtime detail after deleting the selected runtime action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    const firstActionStatePointId = flowPanel
      .find('[data-testid="workbench-flow-runtime-previous"]')
      .attributes('data-state-point-id');
    expect(firstActionStatePointId).toBeTruthy();

    await wrapper
      .findAll('[data-testid="workbench-delete-action"]')[1]
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(firstActionStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(firstActionStatePointId);
  });

  it('opens the copied action result and contribution split in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toBeTruthy();

    await wrapper
      .find('[data-testid="workbench-copy-action"]')
      .trigger('click');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');

    const copiedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(copiedStatePointId).toBeTruthy();
    expect(copiedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      copiedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );

    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0002'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      copiedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
  });

  it('opens the inserted action result and contribution split when adding an action in the runtime view', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toContain('action-0001');

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    await nextTick();

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');

    const insertedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(insertedStatePointId).toContain('action-0002');
    expect(insertedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(insertedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(insertedStatePointId);

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      insertedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );

    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0002'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      insertedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(insertedStatePointId);
  });

  it('keeps the result loop usable across adding, copying, editing, and reviewing a refreshed result', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    stubTimelineGeometry(wrapper);

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toContain('action-0001');

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    const insertedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(insertedStatePointId).toContain('action-0002');

    await wrapper
      .find(
        '.action-item[data-action-id="action-0002"] [data-testid="workbench-copy-action"]'
      )
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0003');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0003'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('3');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('2');
    const copiedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(copiedStatePointId).toContain('action-0003');
    expect(copiedStatePointId).not.toBe(insertedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(copiedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0003');

    await wrapper
      .find('[data-testid="workbench-runtime-selected-detail-action-focus"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-origin')
    ).toBe('runtime-focus');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromX: 220,
      toX: 286,
      fromY: 20,
      toY: 20,
    });

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-ready');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0003');

    const dragEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(dragEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(dragEditFeedback.attributes('data-origin-state-point-id')).toBe(
      copiedStatePointId
    );
    const refreshedStatePointId = dragEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toContain('action-0003');
    expect(refreshedStatePointId).not.toBe(copiedStatePointId);

    await wrapper
      .find('[data-testid="workbench-flow-return-edit-result"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0003"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('syncs runtime detail after shifting a generated action batch in the runtime view', async () => {
    const secondaryCharacterId =
      workbenchSeed.defaults.secondaryCharacterId ??
      workbenchSeed.gameData.characters.find(
        character => character.id !== workbenchSeed.defaults.characterId
      ).id;
    const generationBatch = {
      batchId: 'segment-batch-0001',
      source: 'skill-action-variant-split',
      skillId: workbenchSeed.defaults.skillId,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-08T00:00:00.000Z',
    };
    const draft = createWorkbenchDraftSnapshot(
      {
        selection: {
          characterId: workbenchSeed.defaults.characterId,
          secondaryCharacterId,
          skillId: workbenchSeed.defaults.skillId,
          enemyId: workbenchSeed.defaults.enemyId,
        },
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'action-0001',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 0,
            generationBatch,
          }),
          createWorkbenchActionDraft({
            id: 'action-0002',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 2000,
            generationBatch,
          }),
        ],
        selectedActionId: 'action-0001',
      },
      '2026-07-08T00:00:00.000Z'
    );
    window.localStorage.setItem(
      WORKBENCH_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );

    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    const originalStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originalStatePointId).toBeTruthy();

    await wrapper
      .find('[data-testid="workbench-summary-shift-action-batch-later"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('500');

    const shiftedStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(shiftedStatePointId).toBeTruthy();
    expect(shiftedStatePointId).not.toBe(originalStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(shiftedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(shiftedStatePointId);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
        )
        .attributes('data-selected-state-point-id')
    ).toBe(shiftedStatePointId);
  });

  it('keeps result detail and contribution split usable after deleting a generated action batch in the runtime view', async () => {
    const secondaryCharacterId =
      workbenchSeed.defaults.secondaryCharacterId ??
      workbenchSeed.gameData.characters.find(
        character => character.id !== workbenchSeed.defaults.characterId
      ).id;
    const generationBatch = {
      batchId: 'segment-batch-0001',
      source: 'skill-action-variant-split',
      skillId: workbenchSeed.defaults.skillId,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-08T00:00:00.000Z',
    };
    const draft = createWorkbenchDraftSnapshot(
      {
        selection: {
          characterId: workbenchSeed.defaults.characterId,
          secondaryCharacterId,
          skillId: workbenchSeed.defaults.skillId,
          enemyId: workbenchSeed.defaults.enemyId,
        },
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'action-0001',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 0,
          }),
          createWorkbenchActionDraft({
            id: 'action-0002',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 1000,
            generationBatch,
          }),
          createWorkbenchActionDraft({
            id: 'action-0003',
            skillId: workbenchSeed.defaults.skillId,
            actorCharacterId: workbenchSeed.defaults.characterId,
            startMs: 2000,
            generationBatch,
          }),
        ],
        selectedActionId: 'action-0002',
      },
      '2026-07-08T00:00:00.000Z'
    );
    window.localStorage.setItem(
      WORKBENCH_DRAFT_STORAGE_KEY,
      JSON.stringify(draft)
    );

    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0002'
    );
    const batchStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(batchStatePointId).toContain('action-0002');

    await wrapper
      .find('[data-testid="workbench-summary-delete-action-batch"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(
      wrapper
        .find('[data-testid="workbench-action-batch-summary-count"]')
        .text()
    ).toBe('0');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');

    const fallbackStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(fallbackStatePointId).toContain('action-0001');
    expect(fallbackStatePointId).not.toBe(batchStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(fallbackStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(fallbackStatePointId);

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      fallbackStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      fallbackStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
  });

  it('falls back to the first runtime result when opening without a matching action point', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0002');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');

    await flowPanel
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-action-id')).toBe('action-0001');
    expect(flowPanel.attributes('data-runtime-overview-active')).toBe('false');
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('1');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('0');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(
      flowPanel.attributes('data-runtime-detail-state-point-id')
    ).toBeTruthy();
    expect(
      flowPanel.find('[data-testid="workbench-flow-runtime-detail"]').text()
    ).toContain('敌人HP伤害');
    expect(
      flowPanel
        .find('[data-testid="workbench-flow-edit-runtime-action"]')
        .attributes('disabled')
    ).toBeUndefined();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
  });

  it('selects the source action when an action result is focused', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('等待动作');
    let actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-current-action')).toBe('false');
    expect(actionResultRow.attributes('data-draft-status')).toBe('dirty');
    expect(actionResultRow.attributes('data-draft-dirty')).toBe('true');
    expect(actionResultRow.attributes('data-result-refresh-status')).toBe(
      'current-draft'
    );
    expect(actionResultRow.attributes('data-edit-source-field')).toBe('');

    await actionResultRow.trigger('click');
    await nextTick();

    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-current-action')).toBe('true');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-current-action"]')
        .text()
    ).toBe('正在编辑');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-draft-status"]')
        .text()
    ).toBe('草稿已变更');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-refresh-status"]')
        .text()
    ).toBe('结果已随当前草稿刷新');
    const actionResultDetailPanel = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(actionResultDetailPanel.attributes('data-current-action')).toBe(
      'true'
    );
    expect(actionResultDetailPanel.attributes('data-draft-status')).toBe(
      'dirty'
    );
    expect(actionResultDetailPanel.attributes('data-draft-dirty')).toBe('true');
    expect(
      actionResultDetailPanel.attributes('data-result-refresh-status')
    ).toBe('current-draft');
    expect(actionResultDetailPanel.attributes('data-edit-source-field')).toBe(
      ''
    );
    expect(actionResultDetailPanel.text()).toContain('正在编辑');
    expect(actionResultDetailPanel.text()).toContain('草稿已变更');
    expect(actionResultDetailPanel.text()).toContain('结果已随当前草稿刷新');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).not.toContain('selected');
    expect(wrapper.find('[data-testid="workbench-level-input"]').exists()).toBe(
      true
    );
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    await nextTick();

    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-edit-source-field')).toBe('level');
    expect(actionResultRow.attributes('data-edit-source-label')).toBe(
      '等级变更'
    );
    expect(actionResultRow.attributes('data-edit-source-summary')).toBe(
      '1 -> 2'
    );
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-edit-source"]')
        .exists()
    ).toBe(false);
    const editedActionResultDetailPanel = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(
      editedActionResultDetailPanel.attributes('data-edit-source-field')
    ).toBe('level');
    expect(
      editedActionResultDetailPanel.attributes('data-edit-source-summary')
    ).toBe('1 -> 2');
    expect(editedActionResultDetailPanel.text()).not.toContain(
      '等级变更 1 -> 2'
    );
    const actionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(actionEditFeedback.exists()).toBe(true);
    expect(actionEditFeedback.attributes('data-action-id')).toBe('action-0001');
    expect(actionEditFeedback.attributes('data-edit-source-field')).toBe(
      'level'
    );
    expect(actionEditFeedback.attributes('data-edit-source-summary')).toBe(
      '1 -> 2'
    );
    const feedbackStatePointId = actionEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(feedbackStatePointId).toBeTruthy();
    expect(actionEditFeedback.attributes('data-runtime-delta-count')).toBe('1');
    expect(actionEditFeedback.attributes('data-result-focused')).toBe('true');
    expect(actionEditFeedback.attributes('data-result-focus-status')).toBe(
      'focused'
    );
    expect(feedbackStatePointId).toBe(
      actionResultRow.attributes('data-runtime-state-point-id')
    );
    expect(actionEditFeedback.text()).toContain('最近编辑');
    expect(actionEditFeedback.text()).toContain('等级变更 1 -> 2');
    expect(
      actionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-status"]')
        .text()
    ).toBe('结果已定位');

    const levelEditControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="level"]'
    );
    expect(levelEditControl.exists()).toBe(true);
    expect(levelEditControl.attributes('data-edit-focused')).toBe('false');
    expect(levelEditControl.attributes('data-edit-focus-summary')).toBe('');
    let sourceTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(sourceTimelineAction.attributes('data-edit-focused')).toBe('false');
    expect(sourceTimelineAction.attributes('data-edit-focus-field')).toBe('');
    expect(sourceTimelineAction.attributes('data-edit-focus-summary')).toBe('');

    const focusSourceButton = actionEditFeedback.find(
      '[data-testid="workbench-action-edit-feedback-focus"]'
    );
    expect(focusSourceButton.attributes()).toMatchObject({
      'data-flow-action-kind': 'focus-edit-source',
      'data-flow-action-source': 'analysis-edit-source',
      'data-flow-action-field': 'level',
    });

    await focusSourceButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'focus-edit-source',
      source: 'analysis-edit-source',
      actionId: 'action-0001',
      fieldKey: 'level',
      canRun: true,
    });

    const focusedLevelEditControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="level"]'
    );
    expect(focusedLevelEditControl.attributes('data-edit-focused')).toBe(
      'true'
    );
    expect(focusedLevelEditControl.attributes('data-edit-focus-summary')).toBe(
      '1 -> 2'
    );
    expect(focusedLevelEditControl.classes()).toContain('edit-focused');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focused')
    ).toBe('false');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    sourceTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(sourceTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(sourceTimelineAction.attributes('data-edit-focus-field')).toBe(
      'level'
    );
    expect(sourceTimelineAction.attributes('data-edit-focus-label')).toBe(
      '等级变更'
    );
    expect(sourceTimelineAction.attributes('data-edit-focus-summary')).toBe(
      '1 -> 2'
    );
    expect(sourceTimelineAction.classes()).toContain('edit-focused');

    const resultFocusButton = wrapper.find(
      '[data-testid="workbench-action-edit-feedback-result-focus"]'
    );
    expect(resultFocusButton.attributes('data-runtime-state-point-id')).toBe(
      feedbackStatePointId
    );
    expect(resultFocusButton.attributes()).toMatchObject({
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-edit-result',
      'data-flow-action-state-point-id': feedbackStatePointId,
    });
    expect(resultFocusButton.attributes('disabled')).toBeDefined();
    expect(resultFocusButton.text()).toBe('结果已定位');

    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0001');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(feedbackStatePointId);
    const focusedActionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(focusedActionEditFeedback.attributes('data-result-focused')).toBe(
      'true'
    );
    expect(
      focusedActionEditFeedback.attributes('data-result-focus-status')
    ).toBe('focused');
    expect(
      focusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-status"]')
        .text()
    ).toBe('结果已定位');
    expect(
      focusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-focus"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      focusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-focus"]')
        .text()
    ).toBe('结果已定位');

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    const alternateRuntimePoint = wrapper
      .findAll('[data-testid="workbench-runtime-resource-chart-point"]')
      .find(
        point =>
          point.attributes('data-state-point-id') &&
          point.attributes('data-state-point-id') !== feedbackStatePointId
      );
    expect(alternateRuntimePoint).toBeTruthy();
    const alternateStatePointId = alternateRuntimePoint.attributes(
      'data-state-point-id'
    );

    await alternateRuntimePoint.trigger('click');
    await nextTick();

    const unfocusedActionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(unfocusedActionEditFeedback.attributes('data-result-focused')).toBe(
      'false'
    );
    expect(
      unfocusedActionEditFeedback.attributes('data-result-focus-status')
    ).toBe('available');
    expect(
      unfocusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-result-status"]')
        .text()
    ).toBe('结果未定位');
    const jumpBackButton = unfocusedActionEditFeedback.find(
      '[data-testid="workbench-action-edit-feedback-result-focus"]'
    );
    expect(jumpBackButton.attributes()).toMatchObject({
      'data-primary-action': 'true',
      'data-result-focus-status': 'available',
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-edit-result',
      'data-flow-action-state-point-id': feedbackStatePointId,
    });
    expect(jumpBackButton.attributes('disabled')).toBeUndefined();
    expect(jumpBackButton.text()).toBe('查看刷新结果');
    expect(
      unfocusedActionEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-focus"]')
        .attributes('data-primary-action')
    ).toBe('false');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${alternateStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');

    await jumpBackButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-result',
      source: 'analysis-edit-result',
      actionId: 'action-0001',
      statePointId: feedbackStatePointId,
      canRun: true,
    });

    const jumpedBackActionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(jumpedBackActionEditFeedback.attributes('data-result-focused')).toBe(
      'true'
    );
    expect(
      jumpedBackActionEditFeedback.attributes('data-result-focus-status')
    ).toBe('focused');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(feedbackStatePointId);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    await nextTick();

    actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-draft-status')).toBe('saved');
    expect(actionResultRow.attributes('data-draft-dirty')).toBe('false');
    expect(actionResultRow.attributes('data-result-refresh-status')).toBe(
      'saved-draft'
    );
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-draft-status"]')
        .text()
    ).toBe('草稿已保存');
    expect(
      actionResultRow
        .find('[data-testid="workbench-action-result-refresh-status"]')
        .text()
    ).toBe('结果来自已保存草稿');
    expect(
      wrapper
        .find('[data-testid="workbench-action-result-detail-panel"]')
        .attributes('data-draft-status')
    ).toBe('saved');
    expect(
      wrapper
        .find('[data-testid="workbench-action-result-detail-panel"]')
        .attributes('data-result-refresh-status')
    ).toBe('saved-draft');
  });

  it('links runtime sim log selection to the focused state curve point', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const appliedMarker = wrapper.find(
      '[data-testid="workbench-timeline-state-curve-marker"]'
    );
    const appliedStatePointId = appliedMarker.attributes('data-state-point-id');

    expect(appliedStatePointId).toBeTruthy();
    expect(
      wrapper.find('[data-testid="workbench-state-curve-focus-all"]').classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').exists()
    ).toBe(false);

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-row"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(appliedStatePointId);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${appliedStatePointId}"]`
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(appliedStatePointId);
    const logFocusedResourcePanel = wrapper.find('.resource-monitor-panel');
    const logFocusedEventPanel = wrapper.find('.event-log-panel');
    const logFocusedDetailPanel = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail"]'
    );
    for (const panel of [
      logFocusedResourcePanel,
      logFocusedEventPanel,
      logFocusedDetailPanel,
    ]) {
      expect(panel.attributes()).toMatchObject({
        'data-runtime-review-selection-status': 'selected',
        'data-runtime-review-selected-action-id': 'action-0001',
        'data-runtime-review-selected-state-point-id': appliedStatePointId,
        'data-runtime-review-source': 'event-log-runtime-row',
        'data-runtime-review-source-kind': 'log',
      });
    }
    expect(
      logFocusedDetailPanel.attributes('data-runtime-review-detail-synced')
    ).toBe('true');
    expect(logFocusedDetailPanel.attributes()).toMatchObject({
      'data-runtime-review-primary-operation-kind': 'focus-runtime-action',
      'data-runtime-review-primary-operation-enabled': 'true',
      'data-runtime-review-focus-action-enabled': 'true',
      'data-runtime-review-return-result-enabled': 'false',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-layout')
    ).toBe('compact');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-detail-row"]')
        .map(row => [row.attributes('data-detail-key'), row.text()])
    ).toEqual([
      ['action', '动作普通攻击'],
      ['state-point', `状态点${appliedStatePointId}`],
    ]);
    const selectedLogDetailHandoff = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-detail-handoff"]'
    );
    expect(selectedLogDetailHandoff.exists()).toBe(true);
    expect(selectedLogDetailHandoff.attributes('data-detail-source')).toBe(
      'runtime-selected-detail'
    );
    expect(selectedLogDetailHandoff.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(selectedLogDetailHandoff.text()).toContain('三值详情面板');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-contribution"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-source"]').exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-calculator"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-action"]')
        .text()
    ).toContain('普通攻击');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-delta"]')
        .text()
    ).toBe('12,461');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-cumulative"]')
        .text()
    ).toBe('12,461');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-value"]')
        .text()
    ).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-overrun"]')
        .text()
    ).toBe('3,833');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-selected-detail-baseline-status"]'
        )
        .text()
    ).toBe('敌人面板');
    expect(
      wrapper
        .findAll(
          '[data-testid="workbench-runtime-selected-detail-calculator-row"]'
        )
        .map(row => [row.attributes('data-calculator-key'), row.text()])
    ).toEqual([
      ['calculator', '适配器HP适配器'],
      ['kind', '来源HP预览'],
      ['replaceable', '替换可替换'],
      ['status', '公式公式未确认'],
      ['unresolved', '缺口最终公式、防御抗性顺序、命中绑定'],
    ]);
    expect(
      wrapper
        .findAll(
          '[data-testid="workbench-runtime-selected-detail-contribution-row"]'
        )
        .map(row => [
          row.attributes('data-contribution-key'),
          row.attributes('data-active'),
          row.text(),
        ])
    ).toEqual([
      ['hp', 'true', '敌人 HP12,461'],
      ['toughness', 'false', '敌人韧性0'],
      ['energy', 'false', '自身能量0'],
    ]);
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').text()
    ).toContain('109001081');

    const runtimeDetailActionFocus = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-action-focus"]'
    );
    expect(runtimeDetailActionFocus.exists()).toBe(true);
    expect(runtimeDetailActionFocus.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(runtimeDetailActionFocus.attributes('data-focus-field')).toBe(
      'startMs'
    );
    expect(runtimeDetailActionFocus.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(runtimeDetailActionFocus.attributes('disabled')).toBeUndefined();
    expect(runtimeDetailActionFocus.text()).toBe('编辑结果动作');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-edit-context"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-action-edit-result-return"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-return-result"]')
        .exists()
    ).toBe(false);

    await runtimeDetailActionFocus.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: appliedStatePointId,
      canRun: true,
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    const runtimeDetailStartControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focused')).toBe(
      'true'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focus-origin')).toBe(
      'runtime-focus'
    );
    expect(runtimeDetailStartControl.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    expect(
      runtimeDetailStartControl.attributes('data-edit-focus-summary')
    ).toContain('敌人 HP');
    const runtimeDetailEditContext = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-edit-context"]'
    );
    expect(runtimeDetailEditContext.exists()).toBe(true);
    expect(
      runtimeDetailEditContext.attributes('data-edit-context-status')
    ).toBe('edit-focus-synced');
    expect(runtimeDetailEditContext.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(runtimeDetailEditContext.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(runtimeDetailEditContext.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(runtimeDetailEditContext.text()).toContain('编辑焦点已同步');
    expect(runtimeDetailEditContext.text()).toContain('结果定位');
    const originResultReturn = wrapper.find(
      '[data-testid="workbench-action-edit-result-return"]'
    );
    expect(originResultReturn.exists()).toBe(true);
    expect(originResultReturn.attributes('data-return-status')).toBe(
      'origin-result'
    );
    expect(originResultReturn.attributes('data-action-id')).toBe('action-0001');
    expect(originResultReturn.attributes('data-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(originResultReturn.attributes('data-origin-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(originResultReturn.text()).toContain('回到来源结果');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    const runtimeDetailEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(runtimeDetailEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(runtimeDetailEditFeedback.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    expect(
      runtimeDetailEditFeedback.attributes('data-origin-state-point-id')
    ).toBe(appliedStatePointId);
    expect(runtimeDetailEditFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      runtimeDetailEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');
    const refreshedRuntimeStatePointId = runtimeDetailEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedRuntimeStatePointId).toBeTruthy();
    expect(refreshedRuntimeStatePointId).not.toBe(appliedStatePointId);
    const refreshedResultReturn = wrapper.find(
      '[data-testid="workbench-action-edit-result-return"]'
    );
    expect(refreshedResultReturn.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(refreshedResultReturn.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(refreshedResultReturn.attributes('data-origin-state-point-id')).toBe(
      appliedStatePointId
    );
    expect(refreshedResultReturn.text()).toContain('回到刷新后结果');
    const refreshedResultReturnButton = refreshedResultReturn.find(
      '[data-testid="workbench-action-edit-result-return-button"]'
    );
    expect(refreshedResultReturnButton.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    const runtimeDetailReturnButton = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(runtimeDetailReturnButton.exists()).toBe(true);
    expect(runtimeDetailReturnButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(
      runtimeDetailReturnButton.attributes('data-origin-state-point-id')
    ).toBe(appliedStatePointId);
    expect(runtimeDetailReturnButton.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(runtimeDetailReturnButton.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(runtimeDetailReturnButton.text()).toBe('查看刷新结果');

    await refreshedResultReturnButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, PropertiesPanel)).toMatchObject(
      {
        kind: 'return-runtime-result',
        source: 'properties-panel',
        actionId: 'action-0001',
        statePointId: refreshedRuntimeStatePointId,
        canRun: true,
      }
    );
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedRuntimeStatePointId);
    const syncedActionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(syncedActionResultRow.attributes('data-selected')).toBe('true');
    expect(
      syncedActionResultRow.attributes('data-result-location-status')
    ).toBe('selected-result');
    expect(
      syncedActionResultRow.attributes('data-selected-state-point-id')
    ).toBe(refreshedRuntimeStatePointId);
    expect(
      syncedActionResultRow
        .find('[data-testid="workbench-action-result-location-status"]')
        .text()
    ).toBe('当前位置已同步');
    const syncedActionResultDetail = wrapper.find(
      '[data-testid="workbench-action-result-detail-panel"]'
    );
    expect(
      syncedActionResultDetail.attributes('data-result-location-status')
    ).toBe('selected-result');
    expect(
      syncedActionResultDetail.attributes('data-selected-state-point-id')
    ).toBe(refreshedRuntimeStatePointId);
    expect(
      syncedActionResultDetail
        .find('[data-testid="workbench-action-result-detail-location-status"]')
        .text()
    ).toBe('当前位置已同步');
    const syncedRuntimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(
      syncedRuntimeLogNavigation.attributes('data-navigation-status')
    ).toBe('synced');
    expect(syncedRuntimeLogNavigation.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(syncedRuntimeLogNavigation.text()).toContain('日志已同步');
    const feedbackLocationChain = wrapper.find(
      '[data-testid="workbench-action-edit-feedback-location-chain"]'
    );
    expect(feedbackLocationChain.exists()).toBe(true);
    expect(feedbackLocationChain.attributes('data-chain-status')).toBe(
      'synced'
    );
    expect(feedbackLocationChain.attributes('data-chain-synced-count')).toBe(
      '3'
    );
    expect(feedbackLocationChain.attributes('data-chain-total-count')).toBe(
      '3'
    );
    expect(feedbackLocationChain.attributes('data-action-synced')).toBe('true');
    expect(feedbackLocationChain.attributes('data-result-synced')).toBe('true');
    expect(feedbackLocationChain.attributes('data-detail-synced')).toBe('true');
    expect(feedbackLocationChain.text()).toContain('3/3已同步');
    expect(feedbackLocationChain.text()).toContain('动作已选中');
    expect(feedbackLocationChain.text()).toContain('结果已定位');
    expect(feedbackLocationChain.text()).toContain('详情已同步');
  });

  it('keeps runtime detail return synced after a result edit reorders points', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    const firstLogRow = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    const originStatePointId = firstLogRow.attributes('data-state-point-id');
    expect(originStatePointId).toBeTruthy();

    await firstLogRow.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-action"]')
        .text()
    ).toContain('普通攻击');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(originStatePointId);

    await wrapper
      .find('[data-testid="workbench-runtime-selected-detail-action-focus"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('6000');
    await nextTick();

    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(originStatePointId);

    const detailReturnButton = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-return-result"]'
    );
    expect(detailReturnButton.exists()).toBe(true);
    expect(detailReturnButton.attributes('data-action-id')).toBe('action-0001');
    expect(detailReturnButton.attributes('data-origin-state-point-id')).toBe(
      originStatePointId
    );
    expect(detailReturnButton.attributes('data-return-status')).toBe(
      'refreshed-edit-result'
    );
    expect(detailReturnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await detailReturnButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, RuntimeSelectedDetailPanel)
    ).toMatchObject({
      kind: 'return-runtime-result',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
    });

    const flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-runtime-detail-action-id')).toBe(
      'action-0001'
    );
    expect(flowPanel.attributes('data-runtime-navigation-count')).toBe('2');
    expect(flowPanel.attributes('data-runtime-navigation-index')).toBe('1');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);

    const logNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(logNavigation.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(logNavigation.attributes('data-navigation-count')).toBe('2');
    expect(logNavigation.attributes('data-navigation-index')).toBe('1');

    const curveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(curveSelection.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(curveSelection.attributes('data-navigation-count')).toBe('2');
    expect(curveSelection.attributes('data-navigation-index')).toBe('1');

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
  });

  it('links runtime sim log detail to the action edit focus', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-row"]')
      .trigger('click');
    await nextTick();

    const statePointId = wrapper
      .find('[data-testid="workbench-runtime-sim-log-state-point"]')
      .text();
    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-row',
      statePointId,
      canRun: true,
    });
    const logActionFocus = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-action-focus"]'
    );

    expect(logActionFocus.exists()).toBe(true);
    expect(logActionFocus.attributes('data-action-id')).toBe('action-0001');
    expect(logActionFocus.attributes('data-focus-field')).toBe('startMs');
    expect(logActionFocus.attributes('data-state-point-id')).toBe(statePointId);
    expect(logActionFocus.attributes('disabled')).toBeUndefined();
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-edit-context"]')
        .exists()
    ).toBe(false);

    await logActionFocus.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'event-log-runtime-detail',
      actionId: 'action-0001',
      statePointId,
      canRun: true,
      payload: {
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
      },
    });
    const focusedTimelineAction = wrapper.find(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
    );
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'event-log-runtime-detail'
    );
    const logStartControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    );
    expect(logStartControl.attributes('data-edit-focused')).toBe('true');
    expect(logStartControl.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(logStartControl.attributes('data-edit-focus-origin')).toBe(
      'runtime-focus'
    );
    expect(logStartControl.attributes('data-edit-focus-source')).toBe(
      'event-log-runtime-detail'
    );
    expect(logStartControl.attributes('data-edit-focus-summary')).toContain(
      '敌人 HP'
    );
    const logEditContext = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-edit-context"]'
    );
    expect(logEditContext.exists()).toBe(true);
    expect(logEditContext.attributes('data-edit-context-status')).toBe(
      'edit-focus-synced'
    );
    expect(logEditContext.attributes('data-action-id')).toBe('action-0001');
    expect(logEditContext.attributes('data-edit-focus-field')).toBe('startMs');
    expect(logEditContext.attributes('data-state-point-id')).toBe(statePointId);
    expect(logEditContext.text()).toContain('编辑焦点已同步');
    expect(logEditContext.text()).toContain('结果定位');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    const logEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(logEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(logEditFeedback.attributes('data-edit-focus-source')).toBe(
      'event-log-runtime-detail'
    );
    expect(logEditFeedback.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(logEditFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    const refreshedStatePointId = logEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(statePointId);
    expect(
      logEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');

    const logResultReturnButton = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-return-result"]'
    );
    expect(logResultReturnButton.exists()).toBe(true);
    expect(logResultReturnButton.attributes('data-action-id')).toBe(
      'action-0001'
    );
    expect(logResultReturnButton.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(logResultReturnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(logResultReturnButton.text()).toBe('查看刷新结果');

    await logResultReturnButton.trigger('click');
    await nextTick();

    expect(getLastDispatchedFlowAction(wrapper, EventLogPanel)).toMatchObject({
      kind: 'return-runtime-result',
      source: 'event-log-runtime-detail',
      actionId: 'action-0001',
      statePointId: refreshedStatePointId,
      canRun: true,
      payload: {
        originStatePointId: statePointId,
        status: 'refreshed-edit-result',
      },
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    const returnedLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(returnedLogNavigation.attributes('data-navigation-status')).toBe(
      'synced'
    );
    expect(returnedLogNavigation.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
  });

  it('keeps log and resource curve navigation synced after editing from a log result', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    const firstLogRow = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    const originStatePointId = firstLogRow.attributes('data-state-point-id');
    expect(originStatePointId).toBeTruthy();

    await firstLogRow.trigger('click');
    await nextTick();

    let runtimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(runtimeLogNavigation.attributes('data-navigation-index')).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-navigation-index')
    ).toBe('0');

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-action-focus"]')
      .trigger('click');
    await nextTick();

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('6000');
    await nextTick();

    const refreshedStatePointId = wrapper
      .find('[data-testid="workbench-action-edit-feedback"]')
      .attributes('data-runtime-state-point-id');
    expect(refreshedStatePointId).toBeTruthy();
    expect(refreshedStatePointId).not.toBe(originStatePointId);

    const originalLogReturnScrollIntoView = Element.prototype.scrollIntoView;
    const logReturnScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = logReturnScrollIntoView;

    try {
      await wrapper
        .find('[data-testid="workbench-runtime-sim-log-return-result"]')
        .trigger('click');
      await nextTick();
      await nextTick();
      await nextTick();
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      if (originalLogReturnScrollIntoView) {
        Element.prototype.scrollIntoView = originalLogReturnScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    runtimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(runtimeLogNavigation.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(runtimeLogNavigation.attributes('data-navigation-count')).toBe('2');
    expect(runtimeLogNavigation.attributes('data-navigation-index')).toBe('1');
    const returnedRuntimeLogRow = wrapper.find(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${refreshedStatePointId}"]`
    );
    expect(returnedRuntimeLogRow.exists()).toBe(true);
    expect(returnedRuntimeLogRow.attributes('data-selected')).toBe('true');
    const scrolledReturnedRuntimeLogRow =
      logReturnScrollIntoView.mock.contexts.find(
        element =>
          element?.getAttribute('data-testid') ===
            'workbench-runtime-sim-log-row' &&
          element.getAttribute('data-state-point-id') === refreshedStatePointId
      );
    expect(scrolledReturnedRuntimeLogRow).toBeTruthy();

    const curveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(curveSelection.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(curveSelection.attributes('data-navigation-count')).toBe('2');
    expect(curveSelection.attributes('data-navigation-index')).toBe('1');
    expect(curveSelection.attributes('data-runtime-focus-source')).toBe(
      'event-log-runtime-detail'
    );

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );

    const actionEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(actionEditFeedback.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionEditFeedback.attributes('data-result-focused')).toBe('true');

    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('returns to the refreshed result and contribution split after dragging a runtime-focused action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    stubTimelineGeometry(wrapper);

    await wrapper
      .find('[data-testid="workbench-flow-open-runtime"]')
      .trigger('click');
    await nextTick();

    const originStatePointId = wrapper
      .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
      .text();
    expect(originStatePointId).toContain('action-0001');

    await wrapper
      .find('[data-testid="workbench-runtime-selected-detail-action-focus"]')
      .trigger('click');
    await nextTick();

    await dragTimelineAction(wrapper, 'action-0001', {
      fromX: 100,
      toX: 169,
      fromY: 20,
      toY: 20,
    });

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).not.toBe('0');

    let flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-ready');
    const dragEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(dragEditFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(dragEditFeedback.attributes('data-edit-focus-source')).toBe(
      'runtime-detail'
    );
    expect(dragEditFeedback.attributes('data-origin-state-point-id')).toBe(
      originStatePointId
    );
    expect(dragEditFeedback.attributes('data-result-focused')).toBe('false');
    const refreshedStatePointId = dragEditFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedStatePointId).toContain('action-0001');
    expect(refreshedStatePointId).not.toBe(originStatePointId);

    const returnButton = wrapper.find(
      '[data-testid="workbench-flow-return-edit-result"]'
    );
    expect(returnButton.exists()).toBe(true);
    expect(returnButton.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );

    await returnButton.trigger('click');
    await nextTick();

    flowPanel = wrapper.find('[data-testid="workbench-flow-panel"]');
    expect(flowPanel.attributes('data-flow-phase')).toBe('edit-result-review');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-navigation"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);

    const returnedEditFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(returnedEditFeedback.attributes('data-runtime-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(returnedEditFeedback.attributes('data-result-focused')).toBe('true');

    const actionResultRow = wrapper.find(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    );
    expect(actionResultRow.attributes('data-selected-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(actionResultRow.attributes('data-result-location-status')).toBe(
      'selected-result'
    );
    const actionContributionPanel = wrapper.find(
      '[data-testid="workbench-action-contribution-panel"]'
    );
    expect(actionContributionPanel.attributes('data-action-id')).toBe(
      'action-0001'
    );
    const hpContributionRow = wrapper.find(
      '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
    );
    expect(hpContributionRow.attributes('data-state-point-id')).toBe(
      refreshedStatePointId
    );
    expect(hpContributionRow.attributes('data-active')).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-action-contribution-detail"]')
        .attributes('data-state-point-id')
    ).toBe(refreshedStatePointId);
  });

  it('links runtime resource curve points to the focused state curve point', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    await nextTick();

    const runtimeCurvePoints = wrapper
      .findAll('[data-testid="workbench-runtime-resource-chart-point"]')
      .filter(point => point.attributes('data-state-point-id'));
    expect(runtimeCurvePoints.length).toBeGreaterThan(1);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');
    const runtimeCurvePoint = runtimeCurvePoints[0];
    const statePointId = runtimeCurvePoint.attributes('data-state-point-id');

    expect(statePointId).toBeTruthy();

    const originalRuntimeCurveScrollIntoView = Element.prototype.scrollIntoView;
    const runtimeCurveScrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = runtimeCurveScrollIntoView;

    try {
      await runtimeCurvePoint.trigger('click');
      await nextTick();
      await nextTick();
      await Promise.resolve();
    } finally {
      if (originalRuntimeCurveScrollIntoView) {
        Element.prototype.scrollIntoView = originalRuntimeCurveScrollIntoView;
      } else {
        delete Element.prototype.scrollIntoView;
      }
    }

    const runtimeReviewStack = wrapper.find(
      '[data-testid="workbench-runtime-review-stack"]'
    );
    expect(runtimeReviewStack.attributes()).toMatchObject({
      'data-runtime-review-layout': 'result-check',
      'data-runtime-review-selection-status': 'selected',
      'data-runtime-review-selected-state-point-id': statePointId,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-resource-area"]')
        .attributes('data-runtime-review-role')
    ).toBe('primary');
    expect(
      wrapper.find('.event-area').attributes('data-runtime-review-role')
    ).toBe('secondary');

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      statePointId,
      canRun: true,
    });
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-focus-selected"]')
        .classes()
    ).toContain('active');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-state-curve-point"]')
        .attributes('data-state-point-id')
    ).toBe(statePointId);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${statePointId}"]`
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(statePointId);
    const curveFocusedResourcePanel = wrapper.find('.resource-monitor-panel');
    const curveFocusedEventPanel = wrapper.find('.event-log-panel');
    const curveFocusedDetailPanel = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail"]'
    );
    for (const panel of [
      curveFocusedResourcePanel,
      curveFocusedEventPanel,
      curveFocusedDetailPanel,
    ]) {
      expect(panel.attributes()).toMatchObject({
        'data-runtime-review-selection-status': 'selected',
        'data-runtime-review-selected-action-id': 'action-0001',
        'data-runtime-review-selected-state-point-id': statePointId,
        'data-runtime-review-source': 'resource-runtime-curve',
        'data-runtime-review-source-kind': 'curve',
      });
    }
    expect(
      curveFocusedDetailPanel.attributes('data-runtime-review-detail-synced')
    ).toBe('true');
    expect(curveFocusedDetailPanel.attributes()).toMatchObject({
      'data-runtime-review-primary-operation-kind': 'focus-runtime-action',
      'data-runtime-review-primary-operation-enabled': 'true',
      'data-runtime-review-focus-action-enabled': 'true',
      'data-runtime-review-return-result-enabled': 'false',
    });
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-placement')
    ).toBe('selected-first');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    const curveScrolledRuntimeLogRow =
      runtimeCurveScrollIntoView.mock.contexts.find(
        element =>
          element?.getAttribute('data-testid') ===
            'workbench-runtime-sim-log-row' &&
          element.getAttribute('data-state-point-id') === statePointId
      );
    expect(curveScrolledRuntimeLogRow).toBeTruthy();
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-selected-detail-contribution-row"][data-active="true"]'
        )
        .text()
    ).toBe('敌人 HP12,461');
    const runtimeContributionSummary = wrapper.find(
      '[data-testid="workbench-runtime-selected-detail-contribution-summary"]'
    );
    expect(runtimeContributionSummary.attributes()).toMatchObject({
      'data-active-count': '1',
      'data-total-count': '3',
      'data-primary-contribution-key': 'hp',
    });
    expect(
      runtimeContributionSummary
        .find(
          '[data-testid="workbench-runtime-selected-detail-contribution-summary-primary"]'
        )
        .text()
    ).toBe('敌人 HP 12,461');
    const runtimeCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(runtimeCurveSelection.exists()).toBe(true);
    expect(runtimeCurveSelection.attributes('data-state-point-id')).toBe(
      statePointId
    );
    expect(runtimeCurveSelection.attributes('data-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(runtimeCurveSelection.attributes('data-curve-mode')).toBe('delta');
    expect(runtimeCurveSelection.attributes('data-runtime-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(
      Number(runtimeCurveSelection.attributes('data-navigation-count'))
    ).toBeGreaterThan(1);
    expect(runtimeCurveSelection.attributes('data-navigation-index')).toBe('0');
    const runtimeCurveSelectionSource = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-source"]'
    );
    expect(runtimeCurveSelectionSource.text()).toBe('手动选择');
    expect(
      runtimeCurveSelectionSource.attributes('data-result-context-active')
    ).toBe('false');
    const runtimeCurveSelectionPrimary = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-primary"]'
    );
    expect(runtimeCurveSelectionPrimary.attributes()).toMatchObject({
      'data-track-key': 'enemyHpDamage',
      'data-state-point-id': statePointId,
    });
    expect(
      runtimeCurveSelectionPrimary
        .find(
          '[data-testid="workbench-runtime-resource-chart-selection-primary-delta"]'
        )
        .text()
    ).toBe('12,461');
    expect(
      runtimeCurveSelectionPrimary
        .find(
          '[data-testid="workbench-runtime-resource-chart-selection-primary-state"]'
        )
        .text()
    ).toBe('累计 12,461 · 剩余 0 · 溢出 3,833');
    const runtimeCurveSelectionRows = Object.fromEntries(
      runtimeCurveSelection
        .findAll(
          '[data-testid="workbench-runtime-resource-chart-selection-row"]'
        )
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(Object.keys(runtimeCurveSelectionRows)).toEqual(['point', 'action']);
    expect(runtimeCurveSelectionRows.point.text()).toContain('敌人 HP');
    expect(runtimeCurveSelectionRows.action.text()).toContain('普通攻击');

    const nextButton = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-next"]'
    );
    const nextStatePointId = nextButton.attributes('data-state-point-id');
    expect(nextStatePointId).toBeTruthy();
    expect(nextButton.attributes('disabled')).toBeUndefined();

    await nextButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      statePointId: nextStatePointId,
      canRun: true,
    });
    const nextRuntimeCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(nextRuntimeCurveSelection.attributes('data-state-point-id')).toBe(
      nextStatePointId
    );
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${nextStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(nextStatePointId);
    expect(
      wrapper
        .find('[data-testid="workbench-flow-panel"]')
        .attributes('data-action-id')
    ).toBe('action-0002');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${nextStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');

    const previousButton = nextRuntimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-prev"]'
    );
    expect(previousButton.attributes('data-state-point-id')).toBe(statePointId);
    expect(previousButton.attributes('disabled')).toBeUndefined();

    await previousButton.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-resource-chart-selection"]')
        .attributes('data-state-point-id')
    ).toBe(statePointId);

    const actionFocusButton = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection-action-focus"]'
    );
    const focusedActionId = actionFocusButton.attributes('data-action-id');
    expect(focusedActionId).toBeTruthy();
    expect(actionFocusButton.attributes('data-focus-field')).toBe('startMs');
    expect(actionFocusButton.attributes('disabled')).toBeUndefined();

    await actionFocusButton.trigger('click');
    await nextTick();

    expect(
      getLastDispatchedFlowAction(wrapper, ResourceMonitorPanel)
    ).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'resource-runtime-curve',
      actionId: focusedActionId,
      statePointId,
      canRun: true,
      payload: {
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人HP伤害',
      },
    });
    const focusedTimelineAction = wrapper.find(
      `[data-testid="workbench-timeline-action"][data-action-id="${focusedActionId}"]`
    );
    expect(focusedTimelineAction.exists()).toBe(true);
    expect(focusedTimelineAction.classes()).toContain('selected');
    expect(focusedTimelineAction.attributes('data-edit-focused')).toBe('true');
    expect(focusedTimelineAction.attributes('data-edit-focus-field')).toBe(
      'startMs'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-label')).toBe(
      '结果定位'
    );
    expect(focusedTimelineAction.attributes('data-edit-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(
      focusedTimelineAction.attributes('data-edit-focus-summary')
    ).toContain('三值点');
    const resourceStartControl = wrapper.find(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    );
    expect(resourceStartControl.attributes('data-edit-focused')).toBe('true');
    expect(resourceStartControl.attributes('data-edit-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(
      resourceStartControl.attributes('data-edit-focus-summary')
    ).toContain('敌人 HP');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('100');
    await nextTick();

    const runtimeOriginFeedback = wrapper.find(
      '[data-testid="workbench-action-edit-feedback"]'
    );
    expect(runtimeOriginFeedback.exists()).toBe(true);
    expect(runtimeOriginFeedback.attributes('data-action-id')).toBe(
      focusedActionId
    );
    expect(runtimeOriginFeedback.attributes('data-edit-source-field')).toBe(
      'startMs'
    );
    expect(runtimeOriginFeedback.attributes('data-edit-origin')).toBe(
      'runtime-focus'
    );
    expect(runtimeOriginFeedback.attributes('data-edit-focus-source')).toBe(
      'resource-runtime-curve'
    );
    expect(runtimeOriginFeedback.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(runtimeOriginFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      runtimeOriginFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');
    const refreshedRuntimeStatePointId = runtimeOriginFeedback.attributes(
      'data-runtime-state-point-id'
    );
    expect(refreshedRuntimeStatePointId).toBeTruthy();
    expect(refreshedRuntimeStatePointId).not.toBe(statePointId);
    const resultPointMap = runtimeOriginFeedback.find(
      '[data-testid="workbench-action-edit-feedback-result-map"]'
    );
    expect(resultPointMap.exists()).toBe(true);
    expect(resultPointMap.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(resultPointMap.attributes('data-runtime-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    const resultPointMapRows = Object.fromEntries(
      resultPointMap
        .findAll(
          '[data-testid="workbench-action-edit-feedback-result-map-row"]'
        )
        .map(row => [row.attributes('data-result-point-key'), row])
    );
    expect(resultPointMapRows.origin.text()).toContain('原结果');
    expect(resultPointMapRows.origin.text()).toContain('敌人 HP');
    expect(resultPointMapRows.runtime.text()).toContain('刷新后');
    expect(resultPointMapRows.runtime.text()).toContain('结果未定位');
    const resultFocusButton = runtimeOriginFeedback.find(
      '[data-testid="workbench-action-edit-feedback-result-focus"]'
    );
    expect(resultFocusButton.attributes()).toMatchObject({
      'data-flow-action-kind': 'select-runtime-result',
      'data-flow-action-source': 'analysis-edit-result',
      'data-flow-action-state-point-id': refreshedRuntimeStatePointId,
    });
    expect(resultFocusButton.attributes('disabled')).toBeUndefined();

    await resultFocusButton.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedRuntimeStatePointId);
    const refreshedCurveSelection = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-selection"]'
    );
    expect(refreshedCurveSelection.attributes('data-state-point-id')).toBe(
      refreshedRuntimeStatePointId
    );
    expect(
      refreshedCurveSelection.attributes('data-runtime-focus-source')
    ).toBe('analysis-edit-result');
    expect(
      refreshedCurveSelection.attributes('data-result-context-status')
    ).toBe('refreshed-edit-result');
    expect(
      refreshedCurveSelection.attributes(
        'data-result-context-origin-state-point-id'
      )
    ).toBe(statePointId);
    expect(
      refreshedCurveSelection.attributes('data-result-context-action-id')
    ).toBe(focusedActionId);
    const refreshedCurveSelectionSource = refreshedCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-source"]'
    );
    expect(refreshedCurveSelectionSource.text()).toBe('刷新后结果');
    expect(
      refreshedCurveSelectionSource.attributes('data-result-context-active')
    ).toBe('true');
  });

  it('links applied state curve points to the shared runtime detail', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const appliedStatePoint = wrapper.find(
      '[data-testid="workbench-state-curve-point"][data-layer-key="applied"]'
    );
    const statePointId = appliedStatePoint.attributes('data-state-point-id');

    expect(statePointId).toBeTruthy();

    await appliedStatePoint.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find(
          `[data-testid="workbench-state-curve-point"][data-state-point-id="${statePointId}"]`
        )
        .classes()
    ).toContain('selected');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(statePointId);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-track"]')
        .text()
    ).toContain('HP');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-source-delta"]')
        .text()
    ).toContain('action-0001|applied-frame-0-point-0');
    expect(
      wrapper.find('[data-testid="workbench-runtime-selected-detail"]').text()
    ).toContain('10900101');
  });

  it('exposes sampled and placeholder state curve layers before values are applied', async () => {
    let stateCurveLayerFilters = {
      applied: true,
      candidate: true,
      sampled: false,
      placeholder: false,
    };
    let wrapper;
    const updateStateCurveLayerFilters = event => {
      stateCurveLayerFilters = {
        ...stateCurveLayerFilters,
        [event.layerKey]: event.visible,
      };
      void wrapper.setProps({ stateCurveLayerFilters });
    };
    wrapper = mount(AnalysisPanel, {
      props: {
        ...createStateCurvePanelProps(),
        stateCurveLayerFilters,
        onUpdateStateCurveLayerFilter: updateStateCurveLayerFilters,
      },
    });
    const findLayerToggle = key =>
      wrapper.find(
        `[data-testid="workbench-state-curve-layer-toggle"][data-layer-key="${key}"]`
      );
    const getLayerToggleText = key =>
      findLayerToggle(key).element.closest('label')?.textContent ?? '';

    expect(
      wrapper.find('[data-testid="workbench-state-curves"]').exists()
    ).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('0');
    expect(getLayerToggleText('sampled')).toContain('采样 1');
    expect(getLayerToggleText('sampled')).toContain('不进结果');
    expect(findLayerToggle('sampled').attributes('data-point-count')).toBe('1');
    expect(findLayerToggle('sampled').attributes('data-track-count')).toBe('1');
    expect(getLayerToggleText('placeholder')).toContain('占位 1');
    expect(getLayerToggleText('placeholder')).toContain('不进结果');
    expect(findLayerToggle('placeholder').attributes('data-point-count')).toBe(
      '1'
    );
    expect(
      wrapper.findAll('[data-testid="workbench-state-curve-row"]')
    ).toHaveLength(0);

    await findLayerToggle('sampled').setValue(true);
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('1');
    const sampledRow = wrapper.find(
      '[data-testid="workbench-state-curve-row"][data-track-key="selfEnergyChange"]'
    );
    expect(sampledRow.exists()).toBe(true);
    expect(sampledRow.text()).toContain('sp · 1/1层 · 1点');
    expect(sampledRow.text()).toContain('采样 1点 Δ0.3375 Σ0.3375');
    const sampledPoints = sampledRow.findAll(
      '[data-testid="workbench-state-curve-point"]'
    );
    expect(sampledPoints).toHaveLength(1);
    expect(sampledPoints[0].attributes('data-layer-key')).toBe('sampled');
    expect(sampledPoints[0].attributes('data-participation')).toBe('采样诊断');
    expect(sampledPoints[0].attributes('data-frame-label')).toBe('0s12f');
    expect(sampledPoints[0].text()).toContain('采样 Δ0.3375 Σ0.3375');
    expect(
      sampledPoints[0]
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('采样诊断，不参与当前结果');
    expect(sampledPoints[0].text()).toContain('recover-sp-applied');
    expect(sampledPoints[0].text()).toContain('element 109001081');
    expect(sampledPoints[0].text()).toContain('SP 10->10.3375');

    await findLayerToggle('placeholder').setValue(true);
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-state-curves"] .source-heading strong')
        .text()
    ).toBe('2');
    const placeholderRow = wrapper.find(
      '[data-testid="workbench-state-curve-row"][data-track-key="enemyHpDamage"]'
    );
    expect(placeholderRow.exists()).toBe(true);
    expect(placeholderRow.text()).toContain('raw-damage · 1/1层 · 1点');
    expect(placeholderRow.text()).toContain('占位 1点 Δ0 Σ0');
    const placeholderPoints = placeholderRow.findAll(
      '[data-testid="workbench-state-curve-point"]'
    );
    expect(placeholderPoints).toHaveLength(1);
    expect(placeholderPoints[0].attributes('data-layer-key')).toBe(
      'placeholder'
    );
    expect(placeholderPoints[0].attributes('data-participation')).toBe(
      '缺口占位'
    );
    expect(placeholderPoints[0].attributes('data-frame-label')).toBe('1s0f');
    expect(placeholderPoints[0].text()).toContain('占位 Δ0 Σ0');
    expect(
      placeholderPoints[0]
        .find('[data-testid="workbench-state-curve-point-participation"]')
        .text()
    ).toBe('缺口占位，不参与当前结果');
    expect(placeholderPoints[0].text()).toContain('资源动作');
    expect(placeholderPoints[0].text()).toContain('action-result-placeholder');
  });

  it('shows Hanyouyou summon target candidates in per-hit workbench evidence', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-character-select"]')
      .setValue('101003');
    await nextTick();
    await nextTick();

    const text = wrapper.text();
    expect(text).toContain('寒悠悠');
    expect(text).toContain(
      '逐hit候选 4/4段 · 三值字段 6 · 召唤目标 2/4段/4元素 · 触发候选 0f/1f/4f/5f/20f/25f/29f/34f'
    );
    expect(text).toContain(
      '三值框架 3轨 · 曲线 3条/12点 · 状态 13点 · 细节后补'
    );
    expect(text).toContain('状态曲线');
    expect(text).toContain('候选 4点 Δ6,400-18,000 Σ44,300');
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-candidate-value-marker"]'
      )
    ).toHaveLength(12);

    const hit4Hotspot = wrapper.find(
      '[data-testid="workbench-timeline-candidate-value-frame-hotspot"][data-hit-index="4"]'
    );
    expect(hit4Hotspot.exists()).toBe(true);
    await hit4Hotspot.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-candidate-value-frame-summary-source"]')
        .text()
    ).toContain('召唤目标 480059->48005901 · 触发候选帧 0/1/4/25/34/43');
    const hpFrameDetail = wrapper.find(
      '[data-testid="workbench-candidate-value-frame-detail-row"][data-series-key="hpDamageFormulaParamCandidate"]'
    );
    expect(hpFrameDetail.text()).toContain(
      '101003156 召唤目标480059->48005901'
    );
    expect(hpFrameDetail.text()).toContain(
      '101003182 召唤目标480059->48005901'
    );

    const comparisonRows = wrapper.findAll(
      '[data-testid="workbench-candidate-element-comparison-row"]'
    );
    const summonRow = comparisonRows.find(
      row => row.attributes('data-element-config-id') === '101003156'
    );
    expect(summonRow).toBeTruthy();
    expect(summonRow.text()).toContain('召唤触发候选待确认');
    expect(summonRow.attributes('title')).toContain(
      '召唤目标 480059->48005901'
    );
    expect(summonRow.attributes('title')).toContain(
      '召唤候选帧 0/1/4/25/34/43'
    );
  });

  it('shows the selected actor current-rank attribute panel', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-panel"]')
        .attributes('data-character-id')
    ).toBe('109001');
    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-policy"]')
        .text()
    ).toBe('80级 / 临阶 7');
    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-source"]')
        .text()
    ).toContain('role-attribute-dynamic-current-rank');
    const rows = Object.fromEntries(
      wrapper
        .findAll('[data-testid="workbench-character-attribute-row"]')
        .map(row => [row.attributes('data-attribute-key'), row.text()])
    );
    expect(rows.attack).toContain('攻击');
    expect(rows.attack).toContain('1920');
    expect(rows.maxHp).toContain('生命');
    expect(rows.maxHp).toContain('10748');
    expect(rows.critRate).toContain('6.1%');

    await wrapper
      .find('[data-testid="workbench-secondary-character-select"]')
      .setValue('101003');
    await nextTick();
    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');
    await nextTick();
    await wrapper
      .find('.action-item[data-action-id="action-0002"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-character-attribute-panel"]')
        .attributes('data-character-id')
    ).toBe('109001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-character-attribute-row"][data-attribute-key="attack"]'
        )
        .text()
    ).toContain('攻击');
  });

  it('updates simulation output when editable controls change', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondEnemy = workbenchSeed.gameData.enemies.find(
      enemy => enemy.id !== workbenchSeed.defaults.enemyId
    );

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    expect(wrapper.text()).toContain('714%');

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('1200');
    expect(wrapper.text()).toContain('1200ms');

    await wrapper
      .find('[data-testid="workbench-enemy-select"]')
      .setValue(String(secondEnemy.id));
    expect(wrapper.text()).toContain(secondEnemy.name);
  });

  it('shows skill logic sources and display-versus-logic timing differences', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper
        .find('[data-testid="workbench-skill-logic-source"]')
        .attributes('data-logic-status')
    ).toBe('mapped');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-status"]').text()
    ).toBe('已映射');
    expect(
      wrapper.find('[data-testid="workbench-skill-display-timing"]').text()
    ).toContain('CD 0ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-display-timing"]').text()
    ).toContain('#1657');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-timing"]').text()
    ).toContain('selfCD 0ms / GCD 0ms');
    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-element-value-row"]')
        .map(row => row.text())
    ).toEqual([
      '#973 · 109001081 · 1#1600|7#10000',
      '#985 · 109001306 · 1#1600|7#10000',
    ]);
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 1 / A：公式槽位，语义未确认');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 7 / G：恒定公式槽位，语义未确认');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-link"]')
        .attributes('data-link-status')
    ).toBe('unmatched');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('动作形态倍率 普攻 / 649%');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('未解释参数 1, 7');

    await wrapper
      .find('[data-testid="workbench-character-select"]')
      .setValue('101007');
    await nextTick();
    await wrapper
      .find('[data-testid="workbench-skill-select"]')
      .setValue('10100712');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-skill-logic-source"]')
        .attributes('data-logic-status')
    ).toBe('mismatch');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-status"]').text()
    ).toBe('来源差异');
    expect(
      wrapper.find('[data-testid="workbench-skill-display-timing"]').text()
    ).toContain('CD 13000ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-timing"]').text()
    ).toContain('CD 20000ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-logic-mismatch"]').text()
    ).toContain('显示 CD 13000ms / SP 0，逻辑 CD 20000ms / SP 0');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('动作形态倍率 星鸣技 / 180%');
    expect(
      wrapper.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('未解释参数 1, 7');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 1 / A');
    expect(
      wrapper
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('参数 7 / G');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    wrapper.unmount();

    const restored = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已恢复草稿'
    );
    expect(
      restored
        .find('[data-testid="workbench-skill-logic-source"]')
        .attributes('data-logic-status')
    ).toBe('mismatch');
    expect(
      restored.find('[data-testid="workbench-skill-logic-mismatch"]').text()
    ).toContain('逻辑 CD 20000ms');
    expect(
      restored.find('[data-testid="workbench-skill-value-param-link"]').text()
    ).toContain('未解释参数 1, 7');
    expect(
      restored
        .find('[data-testid="workbench-skill-value-param-semantics"]')
        .text()
    ).toContain('语义未确认');
  });

  it('selects a skill action variant and saves the projection choice', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const segmentSelect = wrapper.find(
      '[data-testid="workbench-damage-segment-select"]'
    );
    const segmentOptions = Array.from(segmentSelect.element.options).map(
      option => option.textContent
    );

    expect(segmentSelect.element.value).toBe('0');
    expect(segmentOptions).toEqual(
      expect.arrayContaining(['普通攻击 / 649% / 普攻5段总值', '重击 / 190%'])
    );

    await segmentSelect.setValue('1');

    expect(
      wrapper.find('[data-testid="workbench-damage-segment-select"]').element
        .value
    ).toBe('1');
    expect(wrapper.find('.selection-note').text()).toContain('190%');
    expect(wrapper.find('.damage-row').text()).toContain('重击');
    expect(
      wrapper.find('.action-item[data-action-id="action-0001"]').text()
    ).toContain('190%');
    expect(wrapper.text()).toContain('hit绑定 0/2 · 缺口候选 1/1');
    expect(wrapper.text()).toContain('伤害元素候选 1/1');
    expect(wrapper.text()).toContain('关联等级链 1/1');
    expect(wrapper.text()).toContain('参数来源候选 1/1');
    expect(wrapper.text()).toContain('应用入口候选 1/1');
    expect(wrapper.text()).toContain('原生入口 1/1');
    expect(wrapper.text()).toContain('反汇编片段 1/1');
    expect(wrapper.text()).toContain('充能探针 1/1');
    expect(wrapper.text()).toContain('构造探针 1/1');
    expect(wrapper.text()).toContain('修正探针 1/1');
    expect(wrapper.text()).toContain('归属探针 1/1');
    expect(wrapper.text()).toContain('采样契约 1/1');
    expect(wrapper.text()).toContain('来源差异 1/1');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      id: 'action-0001',
      skillId: workbenchSeed.defaults.skillId,
      actionVariantIndex: 1,
      damageSegmentIndex: 1,
    });
  });

  it('lists Endaxis-style combat actions instead of fancy skill names', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const entries = wrapper.findAll('[data-testid="workbench-skill-entry"]');
    expect(
      entries.map(entry => entry.find('.skill-entry-name').text())
    ).toEqual([
      '普通攻击',
      '重击',
      '闪击',
      '跃击',
      '星鸣技',
      '星结合击',
      '星决技',
      '星携技',
      '极限反击',
      '完美招架',
    ]);
    expect(entries.map(entry => entry.attributes('data-action-kind'))).toEqual([
      'normal-attack',
      'charged-attack',
      'dodge-attack',
      'plunging-attack',
      'star-skill',
      'star-combo',
      'ultimate',
      'star-carry',
      'limit-counter',
      'perfect-parry',
    ]);
    expect(entries.map(entry => entry.text()).join(' ')).not.toContain(
      '哈库茵剑舞'
    );
    expect(entries.map(entry => entry.text()).join(' ')).not.toContain(
      '暴击率'
    );
    expect(
      entries
        .find(entry => entry.attributes('data-action-kind') === 'star-skill')
        ?.attributes('data-skill-id')
    ).toBe('10900112');
  });

  it('adds a selected combat action directly from the action library', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const starSkillEntry = findActionLibraryEntry(wrapper, 'star-skill');
    await starSkillEntry.trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(
      wrapper.find('.action-item[data-action-id="action-0002"]').text()
    ).toContain('星鸣技');
    expect(
      wrapper.find('.action-item[data-action-id="action-0002"]').text()
    ).toContain('1s30f');
    expect(
      wrapper.findAll('.damage-row').some(row => row.text().includes('星鸣技'))
    ).toBe(true);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      skillId: 10900112,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      actionVariantIndex: 0,
      damageSegmentIndex: 0,
      durationMs: 1500,
    });
    expect(savedDraft.actionDrafts[1].note).toContain('星鸣技：160%');
  });

  it('uses distinct frame-based default durations for direct combat actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await findActionLibraryEntry(wrapper, 'charged-attack').trigger('click');
    await findActionLibraryEntry(wrapper, 'dodge-attack').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );
    expect(
      wrapper
        .findAll('.action-item')
        .map(action => action.find('.action-name').text())
    ).toEqual(['普通攻击', '重击', '闪击']);
    expect(
      wrapper.find('.action-item[data-action-id="action-0002"]').text()
    ).toContain('1s12f');
    expect(
      wrapper.find('.action-item[data-action-id="action-0003"]').text()
    ).toContain('0s36f');
  });

  it('rebuilds the workbench project when the selected character changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const nextCharacter = workbenchSeed.gameData.characters.find(
      character => character.id !== workbenchSeed.defaults.characterId
    );
    const nextSkill = workbenchSeed.gameData.skills.find(
      skill => skill.characterId === nextCharacter.id
    );

    await wrapper
      .find('[data-testid="workbench-character-select"]')
      .setValue(String(nextCharacter.id));

    expect(wrapper.text()).toContain(
      `工作台：${nextCharacter.name} / ${nextSkill.name}`
    );
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
  });

  it('adds, selects, edits, and deletes timeline actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('2');
    expect(
      wrapper.findAll('[data-testid="workbench-delete-action"]')
    ).toHaveLength(2);

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('2400');
    expect(wrapper.text()).toContain('2400ms');

    await wrapper
      .findAll('[data-testid="workbench-delete-action"]')[1]
      .trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
  });

  it('copies the selected action and tracks unsaved draft changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '未保存草稿'
    );

    await wrapper
      .find('[data-testid="workbench-copy-action"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('1000');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已保存草稿'
    );

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('nudges and deletes timeline actions with keyboard shortcuts', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-copy-action"]')
      .trigger('click');
    let timelineActions = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );

    await timelineActions[1].trigger('keydown', { key: 'ArrowRight' });
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('1016.666667');

    timelineActions = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );
    await timelineActions[1].trigger('keydown', {
      key: 'ArrowLeft',
      shiftKey: true,
    });
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('950');

    timelineActions = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );
    await timelineActions[1].trigger('keydown', { key: 'Delete' });

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('adds wait and annotation actions without projecting extra damage', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('等待动作');
    expect(
      wrapper.find('[data-testid="workbench-duration-input"]').element.value
    ).toBe('1000');

    await wrapper
      .find('[data-testid="workbench-duration-input"]')
      .setValue('1500');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('等技能冷却');
    expect(wrapper.text()).toContain('WAIT');
    expect(wrapper.text()).toContain('1500ms / 等技能冷却');

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('注释动作');

    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('准备爆发');
    expect(wrapper.text()).toContain('ANNOTATION');
    expect(wrapper.text()).toContain('准备爆发');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
  });

  it('edits enemy parameters and reads resource events from simulation', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const spSkill = workbenchSeed.gameData.skills.find(
      skill => Number(skill.spCost) > 0
    );

    expect(wrapper.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.80'
    );
    expect(
      wrapper.find('[data-testid="workbench-resource-event-count"]').text()
    ).toBe('0');
    expect(
      wrapper.find('[data-testid="workbench-resource-empty"]').text()
    ).toBe('暂无资源事件');

    await wrapper
      .find('[data-testid="workbench-enemy-level-input"]')
      .setValue('95');
    await wrapper
      .find('[data-testid="workbench-enemy-hp-multiplier-input"]')
      .setValue('2');
    await wrapper
      .find('[data-testid="workbench-enemy-defense-multiplier-input"]')
      .setValue('1.5');

    expect(wrapper.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.95'
    );
    expect(wrapper.text()).toContain('2x / 1.5x');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );

    await wrapper
      .find('[data-testid="workbench-character-select"]')
      .setValue(String(spSkill.characterId));
    await nextTick();
    await wrapper
      .find('[data-testid="workbench-skill-select"]')
      .setValue(String(spSkill.id));

    expect(
      wrapper.find('[data-testid="workbench-resource-event-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-resource-sp-total"]').text()
    ).toBe(`-${spSkill.spCost}`);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-count"]').text()
    ).toBe('2 日志');
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-energy-actor-row"]')
        .map(row => row.text())
        .some(text => text.includes(`SP -${spSkill.spCost}`))
    ).toBe(true);
    const runtimeCurvePointTracks = wrapper
      .findAll('[data-testid="workbench-runtime-resource-chart-point"]')
      .map(point => point.attributes('data-track-key'));
    expect(runtimeCurvePointTracks).toEqual(
      expect.arrayContaining(['selfEnergyChange'])
    );
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-resource-chart-point"][data-track-key="selfEnergyChange"]'
        )
        .attributes('data-delta')
    ).toBe(`-${spSkill.spCost}`);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log"]').text()
    ).toContain(`SP -${spSkill.spCost}`);
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('2/2');

    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="selfEnergyChange"]'
      )
      .trigger('click');

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/2');
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-row"]').text()
    ).toContain(`SP -${spSkill.spCost}`);
    expect(
      wrapper
        .findAll('[data-testid="workbench-runtime-sim-log-contribution-row"]')
        .map(row => row.text())
    ).toEqual(['敌人 HP0', '敌人韧性0', `自身能量-${spSkill.spCost}`]);
    expect(
      wrapper.find('[data-testid="workbench-runtime-sim-log-source"]').text()
    ).toContain(String(spSkill.id));

    const hpRuntimeCurvePoint = wrapper.find(
      '[data-testid="workbench-runtime-resource-chart-point"][data-track-key="enemyHpDamage"]'
    );
    await hpRuntimeCurvePoint.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/2');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-selection-filtered"]')
        .text()
    ).toContain('选中三值点不在当前日志筛选内');
    const filteredRuntimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(
      filteredRuntimeLogNavigation.attributes('data-navigation-status')
    ).toBe('filtered-out');
    expect(filteredRuntimeLogNavigation.attributes('data-state-point-id')).toBe(
      hpRuntimeCurvePoint.attributes('data-state-point-id')
    );
    expect(
      filteredRuntimeLogNavigation.attributes('data-navigation-index')
    ).toBe('-1');
    expect(filteredRuntimeLogNavigation.text()).toContain('筛选外');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-row"]')
        .attributes('data-selected')
    ).toBe('false');

    await wrapper
      .find('[data-testid="workbench-runtime-sim-log-show-selected"]')
      .trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-filter-count"]')
        .text()
    ).toBe('1/2');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="enemyHpDamage"]'
        )
        .attributes('data-active')
    ).toBe('true');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-selection-filtered"]')
        .exists()
    ).toBe(false);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${hpRuntimeCurvePoint.attributes('data-state-point-id')}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    const syncedRuntimeLogNavigation = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation"]'
    );
    expect(
      syncedRuntimeLogNavigation.attributes('data-navigation-status')
    ).toBe('synced');
    expect(syncedRuntimeLogNavigation.attributes('data-state-point-id')).toBe(
      hpRuntimeCurvePoint.attributes('data-state-point-id')
    );
    expect(syncedRuntimeLogNavigation.attributes('data-navigation-index')).toBe(
      '0'
    );
    expect(syncedRuntimeLogNavigation.text()).toContain('日志已同步');
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(wrapper.text()).toContain('RESOURCE_CHANGE');
  });

  it('adds resource and enemy event actions without projecting extra damage', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('资源动作');
    expect(
      wrapper.find('[data-testid="workbench-resource-change-input"]').element
        .value
    ).toBe('50');

    await wrapper
      .find('[data-testid="workbench-resource-change-input"]')
      .setValue('-35');
    await wrapper
      .find('[data-testid="workbench-resource-reason-input"]')
      .setValue('manual-test');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('扣除测试资源');

    expect(
      wrapper.find('[data-testid="workbench-resource-event-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-resource-sp-total"]').text()
    ).toBe('-35');
    expect(wrapper.text()).toContain('RESOURCE_CHANGE');
    expect(wrapper.text()).toContain('SP -35 / manual-test');

    await wrapper
      .find('[data-testid="workbench-add-enemy-event-action"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '3 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('敌人事件');

    await wrapper
      .find('[data-testid="workbench-enemy-event-type-input"]')
      .setValue('phase-2');
    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('进入二阶段');

    expect(wrapper.text()).toContain('ENEMY_EVENT');
    expect(wrapper.text()).toContain('phase-2 / 进入二阶段');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
    const placeholderStateLayerToggle = wrapper.find(
      '[data-testid="workbench-timeline-state-layer-toggle"][data-layer-key="placeholder"]'
    );
    expect(placeholderStateLayerToggle.exists()).toBe(true);
    await placeholderStateLayerToggle.setValue(true);
    await nextTick();
    const placeholderStateMarkers = wrapper
      .findAll('[data-testid="workbench-timeline-state-curve-marker"]')
      .filter(marker => marker.attributes('data-layer-key') === 'placeholder');
    expect(placeholderStateMarkers.length).toBeGreaterThan(0);
    expect(
      placeholderStateMarkers.some(
        marker => marker.attributes('data-action-id') === 'action-0002'
      )
    ).toBe(true);
    expect(
      placeholderStateMarkers.some(
        marker => marker.attributes('data-action-id') === 'action-0003'
      )
    ).toBe(true);
    expect(
      placeholderStateMarkers.every(marker =>
        marker
          .attributes('data-marker-title')
          ?.includes('action-result-placeholder')
      )
    ).toBe(true);
  });

  it('adds a switch action targeting a secondary actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('2 actor');
    expect(
      wrapper.find('[data-testid="workbench-secondary-character-select"]')
        .element.value
    ).toBe('101003');

    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('切人动作');
    expect(
      wrapper.find('[data-testid="workbench-switch-target-select"]').element
        .value
    ).toBe('101003');
    expect(wrapper.text()).toContain('SWITCH');
    expect(wrapper.text()).toContain('末音 -> 寒悠悠');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');

    const nextSecondary = workbenchSeed.gameData.characters.find(
      character =>
        character.id !== workbenchSeed.defaults.characterId &&
        character.id !== 101003
    );
    await wrapper
      .find('[data-testid="workbench-secondary-character-select"]')
      .setValue(String(nextSecondary.id));

    expect(
      wrapper.find('[data-testid="workbench-switch-target-select"]').element
        .value
    ).toBe(String(nextSecondary.id));
    expect(wrapper.text()).toContain(`末音 -> ${nextSecondary.name}`);
  });

  it('renders actor lanes and keeps system events on a system lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(
      wrapper
        .findAll('[data-testid="workbench-timeline-lane-label"]')
        .map(lane => lane.text())
    ).toEqual(['末音猛攻', '寒悠悠增幅']);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
        )
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
        )
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-damage-marker"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');

    await wrapper
      .find('[data-testid="workbench-add-switch-action"]')
      .trigger('click');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(wrapper.text()).toContain('切人 -> 寒悠悠');

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-row"][data-lane-id="system"]')
        .exists()
    ).toBe(true);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');
    expect(
      wrapper
        .findAll('[data-testid="workbench-timeline-lane-label"]')
        .map(lane => lane.text())
    ).toContain('系统事件轨');
  });

  it('flags overlapping actions on the same timeline lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe(
      '0'
    );
    expect(wrapper.find('[data-testid="workbench-overlap-empty"]').text()).toBe(
      '暂无轨道重叠'
    );

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    expect(
      wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')
    ).toHaveLength(0);

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('500');

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe(
      '1'
    );
    expect(
      wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')
    ).toHaveLength(2);
    expect(
      wrapper.find('[data-testid="workbench-overlap-item"]').text()
    ).toContain('末音');
    expect(
      wrapper.find('[data-testid="workbench-overlap-item"]').text()
    ).toContain('普通攻击 / 普通攻击');
    expect(
      wrapper.find('[data-testid="workbench-overlap-item"]').text()
    ).toContain('500-1000ms');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('drags actor-bound actions between actor lanes without moving system events', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    stubTimelineGeometry(wrapper);

    await wrapper
      .find('[data-testid="workbench-add-resource-action"]')
      .trigger('click');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');

    await dragTimelineAction(wrapper, 'action-0002', {
      fromY: 20,
      toY: 110,
    });

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: 101003,
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    stubTimelineGeometry(wrapper);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromY: 200,
      toY: 110,
    });

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');
  });

  it('edits action ownership from the properties panel and filters skill choices by actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === secondaryCharacterId
    );

    expect(
      wrapper.find('[data-testid="workbench-action-actor-select"]').element
        .value
    ).toBe('109001');

    await wrapper
      .find('[data-testid="workbench-action-actor-select"]')
      .setValue(String(secondaryCharacterId));

    expect(
      wrapper.find('[data-testid="workbench-action-actor-select"]').element
        .value
    ).toBe(String(secondaryCharacterId));
    expect(
      wrapper.find('[data-testid="workbench-skill-select"]').element.value
    ).toBe(String(secondarySkills[0].id));
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-damage-marker"][data-action-id="action-0001"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');

    const optionValues = Array.from(
      wrapper.find('[data-testid="workbench-skill-select"]').element.options
    ).map(option => Number(option.value));
    expect(optionValues).toEqual(secondarySkills.map(skill => skill.id));

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-action-actor-readonly"]').element
        .value
    ).toBe('系统 / 事件轨');
  });

  it('uses the action library actor context for new and copied actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === secondaryCharacterId
    );

    expect(
      findActionLibraryActorButton(wrapper, 109001).attributes('data-active')
    ).toBe('true');

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );
    expect(
      findActionLibraryActorButton(wrapper, secondaryCharacterId).attributes(
        'data-active'
      )
    ).toBe('true');

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper.find('[data-testid="workbench-skill-select"]').element.value
    ).toBe(String(secondarySkills[0].id));

    await wrapper
      .findAll('[data-testid="workbench-copy-action"]')[1]
      .trigger('click');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      findActionLibraryActorButton(wrapper, secondaryCharacterId).attributes(
        'data-active'
      )
    ).toBe('true');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    expect(
      findActionLibraryActorButton(wrapper, 109001).attributes('data-active')
    ).toBe('true');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0003',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });
  });

  it('adds a selected combat action from the action library for the active actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const primarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === workbenchSeed.defaults.characterId
    );
    const primaryEntries = getSkillActionCatalog(primarySkills, 1);
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      skill => Number(skill.characterId) === secondaryCharacterId
    );
    const secondaryEntries = getSkillActionCatalog(secondarySkills, 1);
    const selectedSecondaryEntry =
      secondaryEntries.find(entry => entry.kind === 'star-skill') ??
      secondaryEntries[0];

    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-entry"]')
        .map(entry => entry.attributes('data-action-kind'))
    ).toEqual(primaryEntries.map(entry => entry.kind));

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );

    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-entry"]')
        .map(entry => entry.attributes('data-action-kind'))
    ).toEqual(secondaryEntries.map(entry => entry.kind));
    expect(
      findActionLibraryEntry(wrapper, selectedSecondaryEntry.kind).exists()
    ).toBe(true);

    await findActionLibraryEntry(wrapper, selectedSecondaryEntry.kind).trigger(
      'click'
    );

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper.find('[data-testid="workbench-skill-select"]').element.value
    ).toBe(String(selectedSecondaryEntry.skillId));
    expect(
      wrapper.find('[data-testid="workbench-level-input"]').element.value
    ).toBe('1');
    expect(wrapper.text()).toContain(selectedSecondaryEntry.label);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: selectedSecondaryEntry.skillId,
      level: 1,
    });
  });

  it('inserts new actions after the selected action instead of the global tail', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkill = workbenchSeed.gameData.skills.find(
      skill => Number(skill.characterId) === secondaryCharacterId
    );

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );
    await findActionLibrarySkillEntry(wrapper, secondarySkill.id).trigger(
      'click'
    );
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
    ]);
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0003',
      type: 'annotation',
      startMs: 2000,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkill.id,
      startMs: 2000,
    });
  });

  it('pushes actor actions to the next same-lane slot while allowing cross-lane time sharing', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkill = workbenchSeed.gameData.skills.find(
      skill => Number(skill.characterId) === secondaryCharacterId
    );

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger(
      'click'
    );
    await findActionLibrarySkillEntry(wrapper, secondarySkill.id).trigger(
      'click'
    );

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await findActionLibraryActorButton(
      wrapper,
      workbenchSeed.defaults.characterId
    ).trigger('click');
    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('4000');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).toContain('自动推迟：同轨已有动作占用，已从 2000ms 调整到 4000ms。');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-109001');
    expect(
      wrapper.findAll('[data-testid="workbench-action-insert-delay-badge"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-action-insert-delay-note"]').text()
    ).toContain('自动推迟 2000ms -> 4000ms');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('末音');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('普通攻击');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('2000ms -> 4000ms');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
      'action-0004',
    ]);
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      actorCharacterId: secondaryCharacterId,
      startMs: 2000,
      insertion: null,
    });
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0004')
    ).toMatchObject({
      actorCharacterId: workbenchSeed.defaults.characterId,
      startMs: 4000,
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 4000,
        delayedByMs: 2000,
        laneId: 'actor-109001',
        reason: 'same-lane-conflict',
        conflictActionIds: ['action-0002'],
      },
    });
  });

  it('pushes system events to the next system-lane slot', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2000');

    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-add-enemy-event-action"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('3600');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).toContain('自动推迟：同轨已有动作占用，已从 2000ms 调整到 3600ms。');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('system');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('系统');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('敌人事件');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-item"]').text()
    ).toContain('2000ms -> 3600ms');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(savedDraft.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0002',
      'action-0003',
    ]);
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      type: 'annotation',
      startMs: 2000,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0003',
      type: 'enemyEvent',
      startMs: 3600,
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 3600,
        delayedByMs: 1600,
        laneId: 'system',
        reason: 'same-lane-conflict',
        conflictActionIds: ['action-0002'],
      },
    });
  });

  it('cleans the auto-delay note line when the note is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue(
        '手写备注\n自动推迟：同轨已有动作占用，已从 2000ms 调整到 4000ms。'
      );

    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).toBe('手写备注');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      note: '手写备注',
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 4000,
      },
    });
  });

  it('clears stale auto-delay metadata when the delayed start time is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('4500');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('4500');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');
    expect(
      wrapper.findAll('[data-testid="workbench-action-insert-delay-badge"]')
    ).toHaveLength(0);
    expect(
      wrapper
        .find('[data-testid="workbench-action-insert-delay-note"]')
        .exists()
    ).toBe(false);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      startMs: 4500,
      note: expect.stringContaining('普通攻击：'),
      insertion: null,
    });
  });

  it('clears stale auto-delay metadata when the delayed duration is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper
      .find('[data-testid="workbench-add-annotation-action"]')
      .trigger('click');
    await wrapper
      .find('.action-item[data-action-id="action-0001"]')
      .trigger('click');
    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('3600');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await wrapper
      .find('[data-testid="workbench-duration-input"]')
      .setValue('1200');

    expect(
      wrapper.find('[data-testid="workbench-duration-input"]').element.value
    ).toBe('1200');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      type: 'wait',
      durationMs: 1200,
      note: '等待窗口',
      insertion: null,
    });
  });

  it('clears stale auto-delay metadata when the delayed action is dragged to another lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    stubTimelineGeometry(wrapper);
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('1');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromY: 20,
      toY: 110,
    });

    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
        )
        .attributes('data-lane-id')
    ).toBe('actor-101003');
    expect(
      wrapper.find('[data-testid="workbench-note-input"]').element.value
    ).not.toContain('自动推迟');
    expect(
      wrapper.find('[data-testid="workbench-insert-delay-count"]').text()
    ).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(
      window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)
    );
    expect(
      savedDraft.actionDrafts.find(action => action.id === 'action-0003')
    ).toMatchObject({
      actorCharacterId: 101003,
      note: expect.stringContaining('普通攻击：'),
      insertion: null,
    });
  });

  it('keeps generated action ids unique after deleting the first action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    await wrapper
      .findAll('[data-testid="workbench-delete-action"]')[0]
      .trigger('click');
    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    const actionIds = wrapper
      .findAll('.action-item')
      .map(action => action.attributes('data-action-id'));
    expect(actionIds).toEqual(['action-0002', 'action-0003']);
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('drags a timeline action and snaps its start time', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const lane = wrapper.find(
      '[data-testid="workbench-timeline-lane"]'
    ).element;
    lane.getBoundingClientRect = () => ({
      width: 600,
      height: 210,
      left: 0,
      right: 600,
      top: 0,
      bottom: 210,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 1 });
    wrapper
      .find('[data-testid="workbench-timeline-action"]')
      .element.dispatchEvent(pointerDown);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 169 }));
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 169 }));
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('3450');
    expect(wrapper.text()).toContain('3450ms');
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
  });

  it('zooms the timeline and resizes an action duration from the timeline', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const lane = wrapper.find(
      '[data-testid="workbench-timeline-lane"]'
    ).element;
    lane.getBoundingClientRect = () => ({
      width: 600,
      height: 210,
      left: 0,
      right: 600,
      top: 0,
      bottom: 210,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    await wrapper
      .find('[data-testid="workbench-timeline-zoom-input"]')
      .setValue('2');
    expect(
      wrapper.find('[data-testid="workbench-timeline-zoom-value"]').text()
    ).toBe('2x');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-lane"]')
        .attributes('style')
    ).toContain('width: 200%');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-scale-track"]')
        .attributes('style')
    ).toContain('width: 200%');

    await wrapper
      .find('[data-testid="workbench-add-wait-action"]')
      .trigger('click');
    const handle = wrapper.find(
      '[data-testid="workbench-action-duration-handle"][data-action-id="action-0002"]'
    ).element;
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 2 });
    handle.dispatchEvent(pointerDown);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140 }));
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 140 }));
    await nextTick();

    expect(
      wrapper.find('[data-testid="workbench-action-type"]').element.value
    ).toBe('等待动作');
    expect(
      wrapper.find('[data-testid="workbench-duration-input"]').element.value
    ).toBe('3000');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '有未保存改动'
    );
  });

  it('saves, restores, and resets a versioned workbench draft', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    await wrapper
      .find('[data-testid="workbench-start-input"]')
      .setValue('2400');
    await wrapper
      .find('[data-testid="workbench-enemy-level-input"]')
      .setValue('95');
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');

    const rawDraft = window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY);
    const draft = JSON.parse(rawDraft);
    expect(rawDraft).not.toContain('skillBlocks');
    expect(draft).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'workbench-draft',
      enemyConfig: {
        level: 95,
      },
      selectedActionId: 'action-0002',
    });
    expect(draft.actionDrafts).toHaveLength(2);
    expect(draft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      startMs: 2400,
    });
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已保存草稿'
    );
    wrapper.unmount();

    const restored = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已恢复草稿'
    );
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe(
      '2 action'
    );
    expect(
      restored.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('2400');
    expect(restored.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.95'
    );

    await restored
      .find('[data-testid="workbench-reset-draft"]')
      .trigger('click');

    expect(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)).toBeNull();
    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe(
      '已重置草稿'
    );
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe(
      '1 action'
    );
    expect(
      restored.find('[data-testid="workbench-start-input"]').element.value
    ).toBe('0');
    expect(restored.find('[data-testid="workbench-enemy-level"]').text()).toBe(
      'Lv.80'
    );
  });
});

function createStateCurvePanelProps() {
  return {
    summary: {
      totalRawDamage: 0,
      formulaVersion: 'test',
      confidence: 'medium',
      projectedHitCount: 0,
      threeValueCurveFrameworkSummary: {
        trackCount: 3,
        candidateTrackCount: 0,
        chartPointCount: 0,
        stateCurvePointCount: 2,
        detailsDeferred: true,
      },
    },
    diagnostics: {
      limitations: [],
    },
    damageTimeline: [],
    actionResultTimeline: [],
    candidateValueSeries: {
      summary: {
        pointCount: 0,
      },
      series: [],
      chart: {
        summary: {
          pointCount: 0,
          displayFrameAdjustmentCount: 0,
        },
        series: [],
      },
    },
    threeValueCurveFramework: {
      stateCurves: {
        summary: {
          pointCount: 2,
        },
        tracks: [
          {
            trackKey: 'selfEnergyChange',
            label: '自身能量变化',
            valueUnit: 'sp',
            pointCount: 1,
            layers: [
              createStateCurveLayer('applied'),
              createStateCurveLayer('candidate'),
              createStateCurveLayer('sampled', {
                pointCount: 1,
                deltaMin: 0.3375,
                deltaMax: 0.3375,
                finalCumulative: 0.3375,
                points: [
                  {
                    sourceKind: 'runtime-recover-sp-applied-sample',
                    eventType: 'recover-sp-applied',
                    actionId: 'action-sample',
                    sourceElementConfigId: 109001081,
                    frameIndex: 12,
                    frameLabel: '0s12f',
                    delta: 0.3375,
                    cumulative: 0.3375,
                    spBefore: 10,
                    spAfter: 10.3375,
                  },
                ],
              }),
              createStateCurveLayer('placeholder'),
            ],
          },
          {
            trackKey: 'enemyHpDamage',
            label: '敌人HP伤害',
            valueUnit: 'raw-damage',
            pointCount: 1,
            layers: [
              createStateCurveLayer('applied'),
              createStateCurveLayer('candidate'),
              createStateCurveLayer('sampled'),
              createStateCurveLayer('placeholder', {
                pointCount: 1,
                deltaMin: 0,
                deltaMax: 0,
                finalCumulative: 0,
                points: [
                  {
                    sourceKind: 'action-result-placeholder',
                    actionId: 'action-placeholder',
                    actionName: '资源动作',
                    frameIndex: 60,
                    frameLabel: '1s0f',
                    delta: 0,
                    cumulative: 0,
                  },
                ],
              }),
            ],
          },
        ],
      },
    },
    insertionDiagnostics: {
      autoDelayedCount: 0,
      autoDelayedItems: [],
    },
    timelineDiagnostics: {
      overlapCount: 0,
      overlaps: [],
    },
  };
}

function getLastDispatchedFlowAction(wrapper, component = AnalysisPanel) {
  const events =
    wrapper.findComponent(component).emitted('dispatch-flow-action') ?? [];
  const lastEvent = events[events.length - 1];
  return lastEvent?.[0] ?? null;
}

function createStateCurveLayer(key, overrides = {}) {
  return {
    key,
    pointCount: 0,
    deltaMin: null,
    deltaMax: null,
    finalCumulative: 0,
    points: [],
    ...overrides,
  };
}

function stubTimelineGeometry(wrapper) {
  const lane = wrapper.find('[data-testid="workbench-timeline-lane"]').element;
  lane.getBoundingClientRect = () => ({
    width: 600,
    height: 240,
    left: 0,
    right: 600,
    top: 0,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  stubLaneRow(wrapper, 'actor-109001', 0, 72);
  stubLaneRow(wrapper, 'actor-101003', 84, 156);
  stubLaneRow(wrapper, 'system', 168, 240);
}

function stubLaneRow(wrapper, laneId, top, bottom) {
  const row = wrapper.find(
    `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"]`
  );
  if (!row.exists()) {
    return;
  }

  row.element.getBoundingClientRect = () => ({
    width: 600,
    height: bottom - top,
    left: 0,
    right: 600,
    top,
    bottom,
    x: 0,
    y: top,
    toJSON: () => {},
  });
}

async function dragTimelineAction(
  wrapper,
  actionId,
  { fromX = 100, toX = 100, fromY, toY }
) {
  const action = wrapper.find(
    `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
  ).element;
  const pointerDown = new MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: fromX,
    clientY: fromY,
  });
  Object.defineProperty(pointerDown, 'pointerId', {
    value: Number(actionId.replace(/\D/g, '')) || 1,
  });
  action.dispatchEvent(pointerDown);
  await nextTick();
  window.dispatchEvent(
    new MouseEvent('pointermove', { clientX: toX, clientY: toY })
  );
  await nextTick();
  window.dispatchEvent(
    new MouseEvent('pointerup', { clientX: toX, clientY: toY })
  );
  await nextTick();
}

async function createAutoDelayedPrimarySkillAction(wrapper) {
  await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
  await wrapper
    .find('.action-item[data-action-id="action-0001"]')
    .trigger('click');
  await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
}

function findActionLibraryActorButton(wrapper, characterId) {
  return wrapper.find(
    `[data-testid="workbench-action-library-actor"][data-character-id="${Number(characterId)}"]`
  );
}

function findActionLibrarySkillEntry(wrapper, skillId) {
  return wrapper.find(
    `[data-testid="workbench-skill-entry"][data-skill-id="${Number(skillId)}"]`
  );
}

function findActionLibraryEntry(wrapper, actionKind) {
  return wrapper.find(
    `[data-testid="workbench-skill-entry"][data-action-kind="${actionKind}"]`
  );
}
