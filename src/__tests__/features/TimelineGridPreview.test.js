import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TimelineGridPreview from '../../features/workbench/TimelineGridPreview.vue';

describe('TimelineGridPreview', () => {
  it('prefers main flow selection over legacy selection props', () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        selectedActionId: 'action-a',
        selectedStateCurvePointId: 'legacy-state-point',
        runtimeFocusSource: 'legacy-source',
        flowModel: {
          mainFlowSelection: {
            selectedActionId: 'action-b',
            selectedStateCurvePointId: 'flow-state-point',
            runtimeFocusSource: 'workbench-flow-panel',
          },
        },
      }),
    });

    const timeline = wrapper.find(
      '[data-testid="workbench-timeline-grid-preview"]'
    );
    expect(timeline.attributes()).toMatchObject({
      'data-flow-selected-action-id': 'action-b',
      'data-flow-selected-state-curve-point-id': 'flow-state-point',
      'data-flow-runtime-focus-source': 'workbench-flow-panel',
    });
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-a"]'
        )
        .classes()
    ).not.toContain('selected');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-action"][data-action-id="action-b"]'
        )
        .classes()
    ).toContain('selected');
  });

  it('filters candidate value curves by actor, action, and visible series', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps(),
    });

    expect(findCandidateMarkers(wrapper)).toHaveLength(6);
    expect(
      Array.from(
        wrapper.find('[data-testid="workbench-candidate-value-actor-filter"]')
          .element.options
      ).map(option => option.value)
    ).toEqual(['all', 'actor-a', 'actor-b']);
    expect(
      Array.from(
        wrapper.find('[data-testid="workbench-candidate-value-action-filter"]')
          .element.options
      ).map(option => option.value)
    ).toEqual(['all', 'action-a', 'action-b']);

    await wrapper
      .find('[data-testid="workbench-candidate-value-actor-filter"]')
      .setValue('actor-b');
    await nextTick();
    expect(findCandidateMarkers(wrapper)).toHaveLength(3);
    expect(
      findCandidateMarkers(wrapper).map(marker =>
        marker.attributes('data-action-id')
      )
    ).toEqual(['action-b', 'action-b', 'action-b']);

    await wrapper
      .find('[data-testid="workbench-candidate-value-action-filter"]')
      .setValue('action-a');
    await nextTick();
    expect(findCandidateMarkers(wrapper)).toHaveLength(0);

    await wrapper
      .find('[data-testid="workbench-candidate-value-actor-filter"]')
      .setValue('all');
    await nextTick();
    expect(findCandidateMarkers(wrapper)).toHaveLength(3);
    expect(
      findCandidateMarkers(wrapper).map(marker =>
        marker.attributes('data-action-id')
      )
    ).toEqual(['action-a', 'action-a', 'action-a']);

    await wrapper
      .find(
        '[data-testid="workbench-candidate-value-toggle"][data-series-key="hpDamageFormulaParamCandidate"]'
      )
      .setValue(false);
    await nextTick();

    expect(findCandidateMarkers(wrapper)).toHaveLength(2);
    expect(
      findCandidateMarkers(wrapper).map(marker =>
        marker.attributes('data-series-key')
      )
    ).toEqual(['toughnessDamageCandidate', 'selfEnergyCandidate']);
  });

  it('uses an injected main flow command surface for runtime state markers', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        threeValueCurveFramework: createRuntimeStateCurveFramework(),
        mainFlowCommandSurface: createInjectedMainFlowCommandSurface(),
      }),
    });

    const marker = wrapper.find(
      '[data-testid="workbench-timeline-state-curve-marker"]'
    );
    expect(marker.exists()).toBe(true);

    await marker.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'timeline-surface-test',
      actionId: 'action-a',
      statePointId: 'enemyHpDamage|applied|action-a|0|0',
      canRun: true,
      payload: {
        preserveStateCurveFilters: true,
      },
    });
  });

  it('renders action readiness and legal skill cooldown windows on the timeline', () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actionReadinessTimeline: {
          actions: [
            {
              actionId: 'action-a',
              status: 'ready',
              executable: true,
              violationCodes: [],
              unresolvedCodes: [],
            },
            {
              actionId: 'action-b',
              status: 'blocked',
              executable: false,
              violationCodes: ['skill-cooldown-active'],
              unresolvedCodes: [],
            },
          ],
          cooldownWindows: [
            {
              windowId: 'action-a|cooldown-charge|0',
              actionId: 'action-a',
              actionName: '普通攻击',
              actorId: 'actor-a',
              chargeIndex: 0,
              startMs: 0,
              endMs: 1500,
              durationMs: 1500,
            },
          ],
        },
      }),
    });

    const blockedAction = wrapper.get(
      '[data-testid="workbench-timeline-action"][data-action-id="action-b"]'
    );
    expect(blockedAction.classes()).toContain('readiness-blocked');
    expect(blockedAction.attributes()).toMatchObject({
      'data-readiness-status': 'blocked',
      'data-readiness-executable': 'false',
    });

    const cooldownWindow = wrapper.get(
      '[data-testid="workbench-timeline-cooldown-window"]'
    );
    expect(cooldownWindow.attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-charge-index': '0',
      'data-end-ms': '1500',
      'data-window-id': 'action-a|cooldown-charge|0',
    });
  });
});

function findCandidateMarkers(wrapper) {
  return wrapper.findAll(
    '[data-testid="workbench-timeline-candidate-value-marker"]'
  );
}

function createTimelineProps(overrides = {}) {
  const actions = [
    createAction({
      id: 'action-a',
      name: '普通攻击',
      actorId: 'actor-a',
      startMs: 0,
    }),
    createAction({
      id: 'action-b',
      name: '重击',
      actorId: 'actor-b',
      startMs: 1000,
    }),
  ];

  return {
    actors: [
      {
        id: 'actor-a',
        name: '末音',
        role: '主输出',
      },
      {
        id: 'actor-b',
        name: '寒悠悠',
        role: '副输出',
      },
    ],
    actions,
    damageTimeline: [],
    threeValueCurveFramework: {
      stateCurves: {
        tracks: [],
      },
    },
    candidateValueChart: {
      series: [
        createCandidateSeries({
          key: 'hpDamageFormulaParamCandidate',
          label: 'HP参数候选',
          valueKind: 'hp',
          unit: 'raw-param',
          yPercent: 18,
        }),
        createCandidateSeries({
          key: 'toughnessDamageCandidate',
          label: '削韧候选',
          valueKind: 'toughness',
          unit: 'raw-field',
          yPercent: 50,
        }),
        createCandidateSeries({
          key: 'selfEnergyCandidate',
          label: '能量候选',
          valueKind: 'energy',
          unit: 'raw-field',
          yPercent: 82,
        }),
      ],
      summary: {
        pointCount: 6,
      },
    },
    durationMs: 3000,
    selectedActionId: 'action-a',
    timelineDiagnostics: {
      overlapActionIds: [],
      overlaps: [],
      overlapCount: 0,
    },
    ...overrides,
  };
}

function createRuntimeStateCurveFramework() {
  return {
    stateCurves: {
      tracks: [
        {
          trackKey: 'enemyHpDamage',
          label: '敌人HP伤害',
          layers: [
            {
              key: 'applied',
              pointCount: 1,
              points: [
                {
                  actionId: 'action-a',
                  actionName: '普通攻击',
                  frameIndex: 0,
                  frameLabel: '0s0f',
                  delta: 100,
                  cumulative: 100,
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function createInjectedMainFlowCommandSurface() {
  return {
    createRuntimeStatePointFlowAction(options = {}) {
      return {
        kind: 'select-runtime-state-point',
        source: 'timeline-surface-test',
        actionId: options.actionId ?? options.detail?.actionId ?? '',
        statePointId:
          options.statePointId ?? options.detail?.statePointId ?? '',
        payload: options.payload ?? null,
        canRun: Boolean(options.statePointId ?? options.detail?.statePointId),
      };
    },
  };
}

function getLastDispatchedFlowAction(wrapper) {
  const events = wrapper.emitted('dispatch-flow-action') ?? [];
  return events.at(-1)?.[0] ?? null;
}

function createAction({ id, name, actorId, startMs }) {
  return {
    id,
    name,
    type: 'skill',
    actorId,
    actor: {
      id: actorId,
      name,
    },
    startMs,
    durationMs: 900,
  };
}

function createCandidateSeries({ key, label, valueKind, unit, yPercent }) {
  const points = [
    createCandidatePoint({
      actionId: 'action-a',
      actionName: '普通攻击',
      hitIndex: 1,
      displayTimeMs: 500,
      displayFrameIndex: 30,
      displayFrameLabel: '0s30f',
      value: 1000,
      xPercent: 16,
      yPercent,
    }),
    createCandidatePoint({
      actionId: 'action-b',
      actionName: '重击',
      hitIndex: 1,
      displayTimeMs: 1500,
      displayFrameIndex: 90,
      displayFrameLabel: '1s30f',
      value: 2000,
      xPercent: 50,
      yPercent,
    }),
  ];

  return {
    key,
    label,
    valueKind,
    unit,
    pointCount: points.length,
    points,
    applied: false,
  };
}

function createCandidatePoint({
  actionId,
  actionName,
  hitIndex,
  displayTimeMs,
  displayFrameIndex,
  displayFrameLabel,
  value,
  xPercent,
  yPercent,
}) {
  return {
    actionId,
    actionName,
    hitIndex,
    sourceTimeMs: displayTimeMs,
    displayTimeMs,
    sourceFrameIndex: displayFrameIndex,
    displayFrameIndex,
    displayFrameLabel,
    value,
    valueMin: value,
    valueMax: value,
    valueSamples: [value],
    candidateCount: 1,
    xPercent,
    yPercent,
    elementConfigIds: [109001081],
    elementDetails: [],
    sourceStatus: 'fixture',
    timeAdjustmentStatus: 'fixture',
    applied: false,
  };
}
