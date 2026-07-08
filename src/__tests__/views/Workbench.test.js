import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import { WORKBENCH_DRAFT_STORAGE_KEY } from '../../domain/workbenchDraftStorage';
import { getSkillActionCatalog } from '../../domain/workbenchProjectFactory';
import AnalysisPanel from '../../features/workbench/AnalysisPanel.vue';
import Workbench from '../../views/Workbench.vue';

describe('Workbench view', () => {
  beforeEach(() => {
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
    const focusAllButton = wrapper.find(
      '[data-testid="workbench-state-curve-focus-all"]'
    );
    const focusSelectedButton = wrapper.find(
      '[data-testid="workbench-state-curve-focus-selected"]'
    );
    expect(focusAllButton.classes()).toContain('active');
    expect(focusSelectedButton.attributes('disabled')).toBeUndefined();
    await focusSelectedButton.trigger('click');
    await nextTick();
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
    ).toBe('action-result');
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
    expect(actionContributionPanel.text()).toContain('动作贡献拆分');
    expect(actionContributionPanel.text()).toContain('普通攻击');
    const actionContributionRows = wrapper.findAll(
      '[data-testid="workbench-action-contribution-row"]'
    );
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

    await actionEditFeedback
      .find('[data-testid="workbench-action-edit-feedback-focus"]')
      .trigger('click');
    await nextTick();

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
    expect(jumpBackButton.attributes('disabled')).toBeUndefined();
    expect(jumpBackButton.text()).toBe('定位结果');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${alternateStatePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');

    await jumpBackButton.trigger('click');
    await nextTick();

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
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
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

    await runtimeDetailActionFocus.trigger('click');
    await nextTick();

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

    await refreshedResultReturnButton.trigger('click');
    await nextTick();

    expect(
      wrapper
        .find('[data-testid="workbench-runtime-selected-detail-state-point"]')
        .text()
    ).toBe(refreshedRuntimeStatePointId);
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
    expect(logEditFeedback.attributes('data-origin-state-point-id')).toBe(
      statePointId
    );
    expect(logEditFeedback.attributes('data-origin-track-key')).toBe(
      'enemyHpDamage'
    );
    expect(
      logEditFeedback
        .find('[data-testid="workbench-action-edit-feedback-origin"]')
        .text()
    ).toBe('来自结果定位');
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
    const runtimeCurvePoint = runtimeCurvePoints[0];
    const statePointId = runtimeCurvePoint.attributes('data-state-point-id');

    expect(statePointId).toBeTruthy();

    await runtimeCurvePoint.trigger('click');
    await nextTick();

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
    expect(
      wrapper
        .find('[data-testid="workbench-runtime-sim-log-detail"]')
        .attributes('data-detail-source')
    ).toBe('runtime-selected-detail');
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
        )
        .attributes('data-selected')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-runtime-selected-detail-contribution-row"][data-active="true"]'
        )
        .text()
    ).toBe('敌人 HP12,461');
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
      'manual'
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
    const runtimeCurveSelectionRows = Object.fromEntries(
      runtimeCurveSelection
        .findAll(
          '[data-testid="workbench-runtime-resource-chart-selection-row"]'
        )
        .map(row => [row.attributes('data-detail-key'), row])
    );
    expect(Object.keys(runtimeCurveSelectionRows)).toEqual([
      'point',
      'action',
      'delta',
      'cumulative',
      'state',
    ]);
    expect(runtimeCurveSelectionRows.point.text()).toContain('敌人 HP');
    expect(runtimeCurveSelectionRows.action.text()).toContain('普通攻击');
    expect(runtimeCurveSelectionRows.delta.text()).toBe('Delta12,461');
    expect(runtimeCurveSelectionRows.cumulative.text()).toBe('累计12,461');
    expect(runtimeCurveSelectionRows.state.text()).toBe('剩余0 · 溢出 3,833');

    const nextButton = runtimeCurveSelection.find(
      '[data-testid="workbench-runtime-resource-chart-selection-next"]'
    );
    const nextStatePointId = nextButton.attributes('data-state-point-id');
    expect(nextStatePointId).toBeTruthy();
    expect(nextButton.attributes('disabled')).toBeUndefined();

    await nextButton.trigger('click');
    await nextTick();

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
    expect(
      focusedTimelineAction.attributes('data-edit-focus-summary')
    ).toContain('三值点');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focused')
    ).toBe('true');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
        )
        .attributes('data-edit-focus-summary')
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
    ).toBe('action-result');
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

async function dragTimelineAction(wrapper, actionId, { fromY, toY }) {
  const action = wrapper.find(
    `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
  ).element;
  const pointerDown = new MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 100,
    clientY: fromY,
  });
  Object.defineProperty(pointerDown, 'pointerId', {
    value: Number(actionId.replace(/\D/g, '')) || 1,
  });
  action.dispatchEvent(pointerDown);
  await nextTick();
  window.dispatchEvent(
    new MouseEvent('pointermove', { clientX: 100, clientY: toY })
  );
  await nextTick();
  window.dispatchEvent(
    new MouseEvent('pointerup', { clientX: 100, clientY: toY })
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
