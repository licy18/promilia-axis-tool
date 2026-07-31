import { mount } from '@vue/test-utils';
import CanonicalTraceInspectorPanel from '../../features/workbench/CanonicalTraceInspectorPanel.vue';

function createIndex() {
  const action = {
    identity: 'action-1',
    actionId: 'action-1',
    name: 'A3',
    requested: {
      intent: {
        kind: 'public-action',
        publicActionId: 10100701,
        actionKind: 'normal-attack',
      },
    },
    resolved: {
      semanticName: 'A3',
      controlSkillId: 10100703,
      subSkillIndex: 0,
      sourceEvidenceStatus: 'applied',
      scenarioRuntimeStatus: 'source-verified',
      sourceIdentity: 'source-action',
    },
    schedule: {
      startMs: 1000,
      endMs: 1500,
      durationMs: 500,
    },
    readiness: { status: 'ready' },
    diagnostics: [],
    hits: [
      {
        identity: 'hit-1',
        factIdentity: 'action-1|hit|hit-1',
        label: '命中 1',
        frame: 74,
        timeMs: 1233.333333,
        landed: 'hit',
        criticalMode: 'expected',
        stale: false,
        contribution: { hpDamage: 6.2, toughnessDamage: 5 },
        critical: {
          sourceCriticalRateBasisPoints: 500,
          targetCriticalDefenseBasisPoints: 100,
          effectiveThresholdBasisPoints: 400,
          sourceCriticalDamageMultiplier: 1.5,
          sourceCriticalDamageBasisPoints: 15000,
          roll: null,
          critical: false,
          expected: true,
          expectedProbabilityBasisPoints: 400,
          expectedResult: {
            probabilityBasisPoints: 400,
            nonCriticalRaw: '393216',
            nonCriticalValue: 6,
            criticalRaw: '655360',
            criticalValue: 10,
            weightedRaw: '403701',
            weightedValue: 6.1599884033203125,
            weightedInteger: '6',
            criticalEventMaterialized: false,
          },
          eventMaterialized: false,
        },
      },
      {
        identity: 'stale-hit',
        label: 'stale hit',
        frame: null,
        timeMs: null,
        landed: 'miss',
        criticalMode: 'critical',
        stale: true,
        contribution: { hpDamage: 0, toughnessDamage: 0 },
        critical: null,
      },
    ],
    effectEvents: [
      {
        identity: 'effect-a',
        name: '全队调谐强度提升',
        operation: 'apply',
        targetId: 'team',
        timeMs: 2000,
        before: null,
        after: { stacks: 2 },
        modifiers: [{ attributeId: 229, valueRaw: 36 }],
        sourceIdentity: 'source-a',
      },
      {
        identity: 'effect-b',
        name: '主控角色调谐强度提升',
        operation: 'apply',
        targetId: 'actor-1',
        timeMs: 2000,
        before: null,
        after: { stacks: 1 },
        modifiers: [{ attributeId: 229, valueRaw: 10 }],
        sourceIdentity: 'source-b',
      },
    ],
    effectIntervals: [],
    resourceTransactions: [
      {
        identity: 'resource-1',
        resourceIdentity: 'actor-sp:actor-1',
        operation: 'gain',
        before: 10,
        after: 12,
        maxValue: 100,
        timeMs: 2100,
      },
    ],
    toughnessFacts: [
      { kind: 'toughness-recovery', amount: 12, signedChange: -12 },
    ],
  };
  return {
    traceHash: 'trace-hash',
    actionsById: new Map([[action.actionId, action]]),
  };
}

describe('CanonicalTraceInspectorPanel', () => {
  it('renders resolved facts without merging same-frame effects', () => {
    const wrapper = mount(CanonicalTraceInspectorPanel, {
      props: {
        traceIndex: createIndex(),
        selectedActionId: 'action-1',
      },
    });

    expect(wrapper.text()).toContain('control 10100703 / sub 0');
    expect(
      wrapper.findAll('[data-testid="canonical-trace-effect-event"]')
    ).toHaveLength(2);
    expect(wrapper.text()).toContain('全队调谐强度提升');
    expect(wrapper.text()).toContain('主控角色调谐强度提升');
    expect(wrapper.text()).toContain('韧性恢复');
    expect(wrapper.text()).not.toContain('负削韧');
    expect(
      wrapper.get('[data-testid="canonical-trace-critical-source-rate"]').text()
    ).toBe('5%');
    expect(
      wrapper
        .get('[data-testid="canonical-trace-critical-target-defense"]')
        .text()
    ).toBe('1%');
    expect(
      wrapper
        .get('[data-testid="canonical-trace-critical-effective-rate"]')
        .text()
    ).toBe('4%');
    expect(
      wrapper.get('[data-testid="canonical-trace-critical-damage"]').text()
    ).toBe('150%');
    expect(
      wrapper
        .get('[data-testid="canonical-trace-expected-weighted-damage"]')
        .text()
    ).toBe('6.16');
    expect(
      wrapper.get('[data-testid="canonical-trace-expected-probability"]').text()
    ).toBe('4%');
    expect(
      wrapper
        .get('[data-testid="canonical-trace-expected-non-critical"]')
        .text()
    ).toBe('6');
    expect(
      wrapper.get('[data-testid="canonical-trace-expected-critical"]').text()
    ).toBe('10');
    expect(
      wrapper
        .get('[data-testid="canonical-trace-critical-event-materialized"]')
        .text()
    ).toBe('不生成暴击事件');
  });

  it('does not invent an expected critical event decision when trace omits it', () => {
    const index = createIndex();
    index.actionsById.get(
      'action-1'
    ).hits[0].critical.expectedResult.criticalEventMaterialized = null;
    const wrapper = mount(CanonicalTraceInspectorPanel, {
      props: {
        traceIndex: index,
        selectedActionId: 'action-1',
      },
    });

    expect(
      wrapper
        .get('[data-testid="canonical-trace-critical-event-materialized"]')
        .text()
    ).toBe('未提供');
  });

  it('emits stable landed and critical overrides from real controls', async () => {
    const wrapper = mount(CanonicalTraceInspectorPanel, {
      props: {
        traceIndex: createIndex(),
        selectedActionId: 'action-1',
      },
    });
    const landed = wrapper.find(
      '[data-testid="canonical-trace-hit-landed"][data-hit-identity="hit-1"]'
    );
    const critical = wrapper.find(
      '[data-testid="canonical-trace-hit-critical-mode"][data-hit-identity="hit-1"]'
    );

    await landed.setValue('miss');
    await critical.setValue('sampled');

    expect(wrapper.emitted('update-hit-override')).toEqual([
      [
        {
          actionId: 'action-1',
          hitIdentity: 'hit-1',
          landed: 'miss',
          criticalMode: 'expected',
        },
      ],
      [
        {
          actionId: 'action-1',
          hitIdentity: 'hit-1',
          landed: 'hit',
          criticalMode: 'sampled',
        },
      ],
    ]);
    expect(
      wrapper
        .find(
          '[data-testid="canonical-trace-hit-landed"][data-hit-identity="stale-hit"]'
        )
        .attributes('disabled')
    ).toBeDefined();
  });

  it('locates a hit using its trace frame', async () => {
    const wrapper = mount(CanonicalTraceInspectorPanel, {
      props: {
        traceIndex: createIndex(),
        selectedActionId: 'action-1',
      },
    });

    await wrapper
      .find('[data-hit-identity="hit-1"] .trace-hit-locate')
      .trigger('click');
    expect(wrapper.emitted('locate-fact')).toEqual([
      [
        {
          actionId: 'action-1',
          identity: 'action-1|hit|hit-1',
          timeMs: 1233.333333,
        },
      ],
    ]);
  });
});
