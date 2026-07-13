import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TimelineGridPreview from '../../features/workbench/TimelineGridPreview.vue';
import { serializeWorkbenchTimelineEntry } from '../../domain/workbenchTimelineEntry';

describe('TimelineGridPreview', () => {
  it('accepts action-library entries from the standard text drag payload', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps(),
    });
    const serializedEntry = serializeWorkbenchTimelineEntry({
      type: 'resource',
      label: '资源',
    });
    const dataTransfer = {
      dropEffect: 'none',
      getData(type) {
        return type === 'text/plain' ? serializedEntry : '';
      },
    };
    const actorLane = wrapper.find(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-a"]'
    );

    await actorLane.trigger('dragover', { dataTransfer, clientX: 0 });
    expect(dataTransfer.dropEffect).toBe('copy');
    await actorLane.trigger('drop', { dataTransfer, clientX: 0 });
    expect(wrapper.emitted('insert-timeline-entry')?.at(-1)?.[0]).toMatchObject(
      {
        entry: { type: 'resource', label: '资源' },
        laneId: 'actor-a',
        laneKind: 'actor-action',
        actorId: 'actor-a',
        startMs: 0,
      }
    );
  });

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
    ).toHaveLength(11);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-row"][data-lane-id="enemy-events"]'
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

  it('renders the fixed three-actor topology and eight full-length state curves', () => {
    const actors = [
      { id: 'actor-a', name: '末音', initialSp: 0.1 },
      { id: 'actor-b', name: '寒悠悠', initialSp: 0.2 },
      { id: 'actor-c', name: '芃芃', initialSp: 0.3 },
    ];
    const actorGroups = actors.map((actor, index) => ({
      actorId: actor.id,
      actionLane: { laneId: actor.id },
      kiboLane: {
        laneId: `kibo-team-slot-${index + 1}`,
        kiboId: index === 0 ? 500001 : null,
      },
      energyCurve: { laneId: `energy-${actor.id}`, actorId: actor.id },
      kiboEnergyCurve: {
        laneId: `kibo-energy-team-slot-${index + 1}`,
        slotId: `team-slot-${index + 1}`,
        actorId: actor.id,
        kiboId: index === 0 ? 500001 : null,
      },
    }));
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actors,
        enemy: {
          id: 'enemy-a',
          name: '训练假人',
          stats: { maxHp: 1000, maxToughness: 100 },
        },
        kibos: [{ id: 500001, name: '测试奇波' }],
        timelineTopology: {
          actorGroups,
          enemyGroup: {
            eventLane: { laneId: 'enemy-events' },
            hpCurve: { laneId: 'enemy-hp-curve' },
            toughnessCurve: { laneId: 'enemy-toughness-curve' },
          },
        },
      }),
    });

    expect(wrapper.findAll('[data-lane-kind="actor-action"]')).toHaveLength(6);
    expect(wrapper.findAll('[data-lane-kind="actor-kibo"]')).toHaveLength(6);
    expect(
      wrapper.findAll('[data-lane-kind="actor-energy-curve"]')
    ).toHaveLength(6);
    expect(
      wrapper.findAll('[data-lane-kind="kibo-energy-curve"]')
    ).toHaveLength(6);
    expect(wrapper.findAll('[data-lane-kind="enemy-event"]')).toHaveLength(2);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve"]')
    ).toHaveLength(8);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-team-slot-1"]'
        )
        .text()
    ).toContain('测试奇波');
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-c"]'
        )
        .attributes('data-editable')
    ).toBe('false');
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-row"][data-lane-id="kibo-energy-team-slot-1"] [data-testid="workbench-timeline-state-curve-line"]'
        )
        .attributes('points')
    ).toBe('0,100 100,100');
  });

  it('renders character identity on actor lanes and opens the matching inspector', async () => {
    const actors = [
      {
        id: 'actor-a',
        characterId: 109001,
        name: '末音',
        role: '主输出',
      },
    ];
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actors,
        characters: [
          {
            id: 109001,
            name: '末音',
            position: { name: '星运者' },
            element: { name: '光', color: '#f4c85a' },
          },
        ],
        activeActorCharacterId: 109001,
        timelineTopology: {
          actorGroups: [
            {
              actorId: 'actor-a',
              actionLane: { laneId: 'actor-a' },
              kiboLane: {
                laneId: 'kibo-team-slot-1',
                kiboId: 500001,
              },
              energyCurve: {
                laneId: 'energy-actor-a',
                actorId: 'actor-a',
              },
              kiboEnergyCurve: {
                laneId: 'kibo-energy-team-slot-1',
                slotId: 'team-slot-1',
                actorId: 'actor-a',
                kiboId: 500001,
              },
            },
          ],
          enemyGroup: {
            eventLane: { laneId: 'enemy-events' },
            hpCurve: { laneId: 'enemy-hp-curve' },
            toughnessCurve: { laneId: 'enemy-toughness-curve' },
          },
        },
        kibos: [{ id: 500001, name: '测试奇波' }],
      }),
    });

    const identity = wrapper.get(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"]'
    );
    expect(identity.classes()).toContain('active');
    expect(identity.attributes('data-character-id')).toBe('109001');
    expect(identity.text()).toContain('末音');
    expect(identity.text()).toContain('星运者 · 光');
    expect(identity.get('img').attributes('src')).toBe(
      '/assets/characters/109001.png'
    );

    await identity.trigger('click');
    expect(wrapper.emitted('select-identity')?.at(-1)?.[0]).toEqual({
      kind: 'actor',
      actorId: 'actor-a',
      characterId: 109001,
      enemyId: '',
      kiboId: '',
      label: '末音',
    });

    await wrapper
      .get(
        '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-1"]'
      )
      .trigger('click');
    expect(wrapper.emitted('select-identity')?.at(-1)?.[0]).toEqual({
      kind: 'actor',
      actorId: 'actor-a',
      characterId: 109001,
      enemyId: '',
      kiboId: 500001,
      label: '测试奇波',
    });
  });

  it('routes kibo events to their associated lane and quick insert target', async () => {
    const actors = [
      { id: 'actor-a', name: '末音' },
      { id: 'actor-b', name: '寒悠悠' },
      { id: 'actor-c', name: '芃芃' },
    ];
    const actorGroups = actors.map((actor, index) => ({
      actorId: actor.id,
      actionLane: { laneId: actor.id },
      kiboLane: { laneId: `kibo-team-slot-${index + 1}` },
      energyCurve: { laneId: `energy-${actor.id}`, actorId: actor.id },
    }));
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actors,
        actions: [
          {
            id: 'kibo-action-1',
            type: 'kiboEvent',
            actorId: 'actor-b',
            name: '奇波事件',
            startMs: 1000,
            durationMs: 600,
            eventType: 'activation',
          },
        ],
        timelineEntryCatalog: [
          {
            type: 'kiboEvent',
            eventType: 'activation',
            label: '奇波事件',
          },
        ],
        timelineEntryDefaultActorId: 'actor-c',
        timelineTopology: {
          actorGroups,
          enemyGroup: {
            eventLane: { laneId: 'enemy-events' },
            hpCurve: { laneId: 'enemy-hp-curve' },
            toughnessCurve: { laneId: 'enemy-toughness-curve' },
          },
        },
      }),
    });

    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-action"][data-action-id="kibo-action-1"]'
        )
        .attributes('data-lane-id')
    ).toBe('kibo-team-slot-2');
    expect(
      Number(
        wrapper
          .get(
            '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-2"]'
          )
          .attributes('style')
          .match(/height:\s*(\d+)px/u)?.[1]
      )
    ).toBeGreaterThan(36);

    await wrapper
      .get(
        '[data-testid="workbench-timeline-entry-source"][data-entry-type="kiboEvent"]'
      )
      .trigger('click');
    expect(wrapper.emitted('insert-timeline-entry')?.at(-1)?.[0]).toMatchObject(
      {
        entry: { type: 'kiboEvent', eventType: 'activation' },
        laneId: 'kibo-team-slot-3',
        laneKind: 'actor-kibo',
        actorId: 'actor-c',
        startMs: 0,
      }
    );
  });

  it('draws independent runtime step curves on the shared timeline coordinate', async () => {
    const actors = [
      { id: 'actor-a', name: '末音', initialSp: 0, stats: { maxSp: 1 } },
      { id: 'actor-b', name: '寒悠悠', initialSp: 0, stats: { maxSp: 1 } },
      { id: 'actor-c', name: '芃芃', initialSp: 0, stats: { maxSp: 1 } },
    ];
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actors,
        durationMs: 3000,
        enemy: {
          id: 'enemy-a',
          name: '训练假人',
          stats: { maxHp: 1000, maxToughness: 100 },
        },
        runtimeStateCurves: createRuntimeTimelineStateCurves(),
      }),
    });

    const curve = laneId =>
      wrapper.get(
        `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve"]`
      );
    const breakpoints = laneId =>
      curve(laneId).findAll(
        '[data-testid="workbench-timeline-state-curve-breakpoint"]'
      );

    expect(curve('energy-actor-a').attributes('data-point-count')).toBe('0');
    expect(curve('energy-actor-b').attributes()).toMatchObject({
      'data-initial-value': '0',
      'data-current-value': '0.5',
      'data-point-count': '1',
    });
    expect(breakpoints('energy-actor-b')[0].attributes()).toMatchObject({
      'data-action-id': 'action-b',
      'data-time-ms': '1000',
      'data-frame-index': '60',
      'data-current-value': '0.5',
    });
    expect(
      curve('energy-actor-b')
        .get('[data-testid="workbench-timeline-state-curve-line"]')
        .attributes('points')
    ).toBe('0,100 33.33333333333333,100 33.33333333333333,50 100,50');
    expect(breakpoints('enemy-hp-curve')[0].attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-time-ms': '1200',
      'data-current-value': '900',
    });
    expect(breakpoints('enemy-toughness-curve')[0].attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-time-ms': '1800',
      'data-current-value': '80',
    });

    const movedRuntimeStateCurves = createRuntimeTimelineStateCurves();
    movedRuntimeStateCurves.resources.curvesByActor[1].points[0].timeMs = 1500;
    movedRuntimeStateCurves.resources.curvesByActor[1].points[0].frameIndex = 90;
    movedRuntimeStateCurves.resources.curvesByActor[1].points.push({
      ...movedRuntimeStateCurves.resources.curvesByActor[1].points[0],
      sourceDeltaId: 'energy-copy',
      actionId: 'action-c',
      timeMs: 2400,
      frameIndex: 144,
      energyDelta: -0.25,
      stateSnapshot: {
        after: { selfEnergy: { currentValue: 0.25 } },
      },
    });
    await wrapper.setProps({ runtimeStateCurves: movedRuntimeStateCurves });
    expect(breakpoints('energy-actor-b')).toHaveLength(2);
    expect(
      breakpoints('energy-actor-b').map(point =>
        point.attributes('data-time-ms')
      )
    ).toEqual(['1500', '2400']);

    movedRuntimeStateCurves.resources.curvesByActor[1].points = [];
    movedRuntimeStateCurves.resources.curvesByActor[1].stateMetric.currentValue = 0;
    await wrapper.setProps({
      runtimeStateCurves: JSON.parse(JSON.stringify(movedRuntimeStateCurves)),
    });
    expect(breakpoints('energy-actor-b')).toHaveLength(0);
    expect(
      curve('energy-actor-b')
        .get('[data-testid="workbench-timeline-state-curve-line"]')
        .attributes('points')
    ).toBe('0,100 100,100');
  });

  it('scrubs one 60fps cursor through actions, eight curves, and runtime points', async () => {
    const runtimeStateCurves = createRuntimeTimelineStateCurves();
    const wrapper = mount(TimelineGridPreview, {
      attachTo: document.body,
      props: createTimelineProps({
        actors: [
          { id: 'actor-a', name: '末音', initialSp: 0, stats: { maxSp: 1 } },
          {
            id: 'actor-b',
            name: '寒悠悠',
            initialSp: 0,
            stats: { maxSp: 1 },
          },
          { id: 'actor-c', name: '芃芃', initialSp: 0, stats: { maxSp: 1 } },
        ],
        durationMs: 3000,
        cursorFrameIndex: 0,
        enemy: {
          id: 'enemy-a',
          name: '训练假人',
          stats: { maxHp: 1000, maxToughness: 100 },
        },
        runtimeStateCurves,
        runtimeStatePointContexts: [
          {
            statePointId: 'runtime-energy-b',
            row: { sourceDeltaId: 'energy-b' },
          },
          { statePointId: 'runtime-hp-a', row: { sourceDeltaId: 'hp-a' } },
          {
            statePointId: 'runtime-toughness-a',
            row: { sourceDeltaId: 'toughness-a' },
          },
        ],
        mainFlowCommandSurface: createInjectedMainFlowCommandSurface(),
      }),
    });
    const curve = laneId =>
      wrapper.get(
        `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve"]`
      );

    expect(curve('energy-actor-b').attributes('data-cursor-value')).toBe('0');
    expect(curve('enemy-hp-curve').attributes('data-cursor-value')).toBe(
      '1000'
    );
    expect(curve('enemy-toughness-curve').attributes('data-cursor-value')).toBe(
      '100'
    );

    await wrapper.setProps({ cursorFrameIndex: 90 });
    expect(
      wrapper
        .get('[data-testid="workbench-timeline-frame-cursor"]')
        .attributes()
    ).toMatchObject({
      'data-frame-index': '90',
      'data-time-ms': '1500',
      style: 'left: 50%;',
    });
    expect(
      wrapper
        .get('[data-testid="workbench-timeline-scale-cursor"]')
        .attributes('style')
    ).toBe('left: 50%;');
    expect(curve('energy-actor-b').attributes('data-cursor-value')).toBe('0.5');
    expect(curve('enemy-hp-curve').attributes('data-cursor-value')).toBe('900');
    expect(curve('enemy-toughness-curve').attributes('data-cursor-value')).toBe(
      '100'
    );
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-action"][data-action-id="action-b"]'
        )
        .attributes('data-cursor-active')
    ).toBe('true');

    await curve('enemy-hp-curve')
      .get('[data-testid="workbench-timeline-state-curve-breakpoint"]')
      .trigger('click');
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toEqual({
      frameIndex: 72,
      timeMs: 1200,
      statePointId: 'runtime-hp-a',
      source: 'timeline-runtime-curve',
    });
    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'timeline-surface-test',
      actionId: 'action-a',
      statePointId: 'runtime-hp-a',
      canRun: true,
    });

    const lane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    lane.element.getBoundingClientRect = () => createRect(0, 0, 600, 240);
    lane.element.dispatchEvent(
      new MouseEvent('click', { bubbles: true, clientX: 450, clientY: 120 })
    );
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toEqual({
      frameIndex: 135,
      timeMs: 2250,
      statePointId: '',
      source: 'timeline-grid',
    });
    wrapper.unmount();
  });

  it('keeps the scale and timeline horizontal scroll positions synchronized', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps(),
    });
    const scale = wrapper.get(
      '[data-testid="workbench-timeline-scale-viewport"]'
    );
    const timeline = wrapper.get('[data-testid="workbench-timeline-viewport"]');

    timeline.element.scrollLeft = 160;
    await timeline.trigger('scroll');
    expect(scale.element.scrollLeft).toBe(160);

    scale.element.scrollLeft = 75;
    await scale.trigger('scroll');
    expect(timeline.element.scrollLeft).toBe(75);
  });

  it('exposes frame playback, speed, and cycle-section controls', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        playbackRunning: true,
        playbackRate: 2,
        playbackRangeMode: 'section',
        playbackRange: {
          startFrame: 60,
          endFrame: 120,
        },
        cycleBoundaries: [{ id: 'cycle-boundary-0001', timeMs: 1000 }],
        selectedCycleSection: {
          sectionId: 'cycle-section-02',
          startMs: 1000,
          endMs: 2000,
        },
      }),
    });

    expect(
      wrapper
        .get('[data-testid="workbench-timeline-grid-preview"]')
        .attributes()
    ).toMatchObject({
      'data-playback-running': 'true',
      'data-playback-rate': '2',
      'data-playback-range-mode': 'section',
    });
    expect(
      wrapper
        .get('[data-testid="workbench-timeline-playback-controls"]')
        .attributes()
    ).toMatchObject({
      'data-running': 'true',
      'data-range-start-frame': '60',
      'data-range-end-frame': '120',
    });

    await wrapper
      .get('[data-testid="workbench-timeline-playback-toggle"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-timeline-step-backward"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-timeline-step-forward"]')
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-timeline-playback-rate"]')
      .setValue('0.5');
    await wrapper
      .get(
        '[data-testid="workbench-timeline-playback-range-mode"][data-range-mode="axis"]'
      )
      .trigger('click');

    expect(wrapper.emitted('toggle-timeline-playback')).toHaveLength(1);
    expect(wrapper.emitted('step-timeline-frame')).toEqual([[-1], [1]]);
    expect(wrapper.emitted('update-playback-rate')?.at(-1)?.[0]).toBe('0.5');
    expect(wrapper.emitted('update-playback-range-mode')?.at(-1)?.[0]).toBe(
      'axis'
    );
  });

  it('renders, selects, drags, and opens persisted cycle boundaries', async () => {
    const wrapper = mount(TimelineGridPreview, {
      attachTo: document.body,
      props: createTimelineProps({
        cycleBoundaries: [
          { id: 'cycle-boundary-0001', timeMs: 1000 },
          { id: 'cycle-boundary-0002', timeMs: 2000 },
        ],
        selectedCycleBoundaryId: 'cycle-boundary-0001',
        selectedCycleSection: {
          sectionId: 'cycle-section-02',
          startMs: 1000,
          endMs: 2000,
        },
      }),
    });
    const timeline = wrapper.get(
      '[data-testid="workbench-timeline-grid-preview"]'
    );
    const lane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    lane.element.getBoundingClientRect = () => createRect(0, 0, 600, 240);
    expect(timeline.attributes()).toMatchObject({
      'data-cycle-boundary-count': '2',
      'data-selected-cycle-boundary-id': 'cycle-boundary-0001',
    });
    expect(
      wrapper
        .get('[data-testid="workbench-cycle-section-highlight"]')
        .attributes('data-section-id')
    ).toBe('cycle-section-02');
    const boundary = wrapper.get(
      '[data-testid="workbench-cycle-boundary"][data-boundary-id="cycle-boundary-0001"]'
    );
    expect(boundary.classes()).toContain('selected');
    expect(Number(boundary.attributes('data-time-ms'))).toBe(1000);

    boundary.element.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 200,
      })
    );
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 300 }));
    await nextTick();
    expect(Number(boundary.attributes('data-time-ms'))).toBe(1500);
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 300 }));
    await nextTick();

    expect(wrapper.emitted('select-cycle-boundary')?.at(-1)?.[0]).toBe(
      'cycle-boundary-0001'
    );
    expect(wrapper.emitted('update-cycle-boundary')?.at(-1)?.[0]).toEqual({
      boundaryId: 'cycle-boundary-0001',
      timeMs: 1500,
    });
    await boundary.trigger('contextmenu', { clientX: 120, clientY: 80 });
    expect(
      wrapper.emitted('open-cycle-boundary-context-menu')?.at(-1)?.[0]
    ).toMatchObject({
      boundaryId: 'cycle-boundary-0001',
      x: 120,
      y: 80,
    });
    wrapper.unmount();
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

function createRuntimeTimelineStateCurves() {
  const actorCurve = (actorId, points = [], currentValue = 0) => ({
    actorId,
    stateMetric: { initialValue: 0, currentValue, maxValue: 1 },
    points,
  });
  const kiboCurve = (slotId, actorId, kiboId) => ({
    slotId,
    actorId,
    kiboId,
    stateMetric: { initialValue: 0, currentValue: 0, maxValue: null },
    points: [],
    trackingOnly: true,
    appliedToCalculators: false,
  });
  return {
    enemy: {
      stateMetrics: {
        hp: { initialValue: 1000, currentValue: 900, maxValue: 1000 },
        toughness: { initialValue: 100, currentValue: 80, maxValue: 100 },
      },
      points: [
        {
          sourceDeltaId: 'hp-a',
          actionId: 'action-a',
          trackKey: 'enemyHpDamage',
          timeMs: 1200,
          frameIndex: 72,
          hpDelta: 100,
          stateSnapshot: { after: { enemyHp: { currentValue: 900 } } },
        },
        {
          sourceDeltaId: 'toughness-a',
          actionId: 'action-a',
          trackKey: 'enemyToughnessDamage',
          timeMs: 1800,
          frameIndex: 108,
          toughnessDelta: 20,
          stateSnapshot: {
            after: { enemyToughness: { currentValue: 80 } },
          },
        },
      ],
    },
    resources: {
      curvesByActor: [
        actorCurve('actor-a'),
        actorCurve(
          'actor-b',
          [
            {
              sourceDeltaId: 'energy-b',
              actionId: 'action-b',
              trackKey: 'selfEnergyChange',
              timeMs: 1000,
              frameIndex: 60,
              energyDelta: 0.5,
              stateSnapshot: {
                after: { selfEnergy: { currentValue: 0.5 } },
              },
            },
          ],
          0.5
        ),
        actorCurve('actor-c'),
      ],
      curvesByKibo: [
        kiboCurve('team-slot-1', 'actor-a', 500001),
        kiboCurve('team-slot-2', 'actor-b', 500002),
        kiboCurve('team-slot-3', 'actor-c', 500003),
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
