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

  it('renders, selects, and creates persisted action relations', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        selectedActionIds: ['action-a', 'action-b'],
        selectedActionRelationId: 'relation-0001',
        actionRelations: [
          {
            id: 'relation-0001',
            kind: 'sequence',
            fromActionId: 'action-a',
            toActionId: 'action-b',
            sourceAnchor: 'end',
            targetAnchor: 'start',
            gapMs: 100,
          },
        ],
      }),
    });

    const relation = wrapper.get(
      '[data-testid="workbench-action-relation"][data-relation-id="relation-0001"]'
    );
    expect(
      wrapper.get('[data-testid="workbench-action-relation-layer"]').exists()
    ).toBe(true);
    expect(relation.element.parentElement.classList).toContain('selected');

    await relation.trigger('click');
    expect(wrapper.emitted('select-action-relation')?.at(-1)?.[0]).toEqual({
      relationId: 'relation-0001',
    });
    await relation.trigger('contextmenu', { clientX: 120, clientY: 80 });
    expect(
      wrapper.emitted('open-action-relation-context-menu')?.at(-1)?.[0]
    ).toMatchObject({
      relationId: 'relation-0001',
      x: 120,
      y: 80,
    });

    await wrapper
      .get('[data-testid="workbench-timeline-create-relations"]')
      .trigger('click');
    expect(wrapper.emitted('create-action-relations')).toHaveLength(1);
  });

  it('renders selectable actor and enemy effect intervals on dedicated rows', async () => {
    const actorInterval = createEffectInterval({
      intervalId: 'actor|actor-a|focus|interval-1',
      effectId: 'focus',
      effectName: '专注',
      targetKind: 'actor',
      targetId: 'actor-a',
      targetName: '末音',
      startMs: 0,
      endMs: 2000,
      lifecycleEvents: [
        { eventId: 'focus-apply', type: 'EFFECT_APPLIED', timeMs: 0 },
        { eventId: 'focus-refresh', type: 'EFFECT_REFRESHED', timeMs: 1000 },
        { eventId: 'focus-expire', type: 'EFFECT_EXPIRED', timeMs: 2000 },
      ],
      selectionEventId: 'focus-expire',
      peakStacks: 2,
      maxStacks: 3,
    });
    const enemyInterval = createEffectInterval({
      intervalId: 'enemy|enemy-a|mark|interval-1',
      effectId: 'mark',
      effectName: '标记',
      targetKind: 'enemy',
      targetId: 'enemy-a',
      targetName: '训练假人',
      startMs: 500,
      endMs: 2500,
      lifecycleEvents: [
        { eventId: 'mark-apply', type: 'EFFECT_APPLIED', timeMs: 500 },
        { eventId: 'mark-remove', type: 'EFFECT_REMOVED', timeMs: 2500 },
      ],
      selectionEventId: 'mark-remove',
    });
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        enemy: { id: 'enemy-a', name: '训练假人' },
        effectIntervals: [actorInterval, enemyInterval],
        selectedEffectIntervalId: actorInterval.intervalId,
      }),
    });

    const timeline = wrapper.get(
      '[data-testid="workbench-timeline-grid-preview"]'
    );
    expect(timeline.attributes()).toMatchObject({
      'data-effect-interval-count': '2',
      'data-selected-effect-interval-id': actorInterval.intervalId,
    });
    const intervals = wrapper.findAll(
      '[data-testid="workbench-timeline-effect-interval"]'
    );
    expect(intervals).toHaveLength(2);
    expect(intervals[0].classes()).toContain('selected');
    expect(intervals[0].attributes()).toMatchObject({
      'data-effect-id': 'focus',
      'data-target-kind': 'actor',
      'data-target-id': 'actor-a',
      'data-lifecycle-event-count': '3',
    });
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-row"]')
    ).toHaveLength(3);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-row"][data-lane-id="enemy-effects"]'
        )
        .find('[data-testid="workbench-timeline-effect-interval"]')
        .attributes('data-effect-id')
    ).toBe('mark');
    expect(wrapper.text()).toContain('训练假人');
    expect(wrapper.findAll('.effect-lifecycle-marker')).toHaveLength(3);

    await intervals[1].trigger('click');
    expect(wrapper.emitted('select-effect-interval')?.at(-1)?.[0]).toEqual({
      intervalId: enemyInterval.intervalId,
      eventId: 'mark-remove',
      actionId: 'action-a',
      timeMs: 2500,
    });
  });

  it('selects intersecting actions with the frame box tool', async () => {
    const wrapper = mount(TimelineGridPreview, {
      attachTo: document.body,
      props: createTimelineProps({
        boxSelectionMode: true,
      }),
    });
    const lane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    lane.element.getBoundingClientRect = () => createRect(0, 0, 600, 240);
    const [firstAction, secondAction] = wrapper.findAll(
      '[data-testid="workbench-timeline-action"]'
    );
    firstAction.element.getBoundingClientRect = () =>
      createRect(20, 15, 120, 42);
    secondAction.element.getBoundingClientRect = () =>
      createRect(220, 125, 120, 42);

    lane.element.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 5,
        clientY: 5,
      })
    );
    window.dispatchEvent(
      new MouseEvent('pointermove', { clientX: 160, clientY: 90 })
    );
    await nextTick();
    expect(
      wrapper.find('[data-testid="workbench-timeline-box-selection"]').exists()
    ).toBe(true);
    window.dispatchEvent(
      new MouseEvent('pointerup', { clientX: 160, clientY: 90 })
    );
    await nextTick();

    expect(wrapper.emitted('select-action-group')?.at(-1)?.[0]).toEqual({
      actionIds: ['action-a'],
      primaryActionId: 'action-a',
      mode: 'replace',
    });
    wrapper.unmount();
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

function createEffectInterval(overrides) {
  return {
    intervalId: 'actor|actor-a|effect|interval-1',
    instanceKey: 'actor|actor-a|effect',
    effectId: 'effect',
    effectName: '状态效果',
    targetKind: 'actor',
    targetId: 'actor-a',
    targetName: '末音',
    startMs: 0,
    endMs: 1000,
    durationMs: 1000,
    startFrame: 0,
    endFrame: 60,
    sourceActionId: 'action-a',
    sourceActionIds: ['action-a'],
    lifecycleEventIds: [],
    lifecycleEvents: [],
    selectionEventId: '',
    terminationType: 'EFFECT_EXPIRED',
    activeAtScenarioEnd: false,
    persistent: false,
    initialStacks: 1,
    finalStacks: 0,
    peakStacks: 1,
    maxStacks: 1,
    refreshCount: 0,
    appliedToCalculators: false,
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

function createRect(left, top, width, height) {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}
