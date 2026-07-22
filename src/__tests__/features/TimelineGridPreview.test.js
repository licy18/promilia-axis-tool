import { flushPromises, mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import TimelineGridPreview from '../../features/workbench/TimelineGridPreview.vue';
import { serializeWorkbenchTimelineEntry } from '../../domain/workbenchTimelineEntry';
import { projectVerifiedTuningMarkCurves } from '../../simulation/projection/projectVerifiedTuningMarkCurves';

function readStyleNumber(style, property) {
  return Number(
    String(style).match(new RegExp(`${property}:\\s*([\\d.]+)`, 'u'))?.[1]
  );
}

describe('TimelineGridPreview', () => {
  it('exposes free and constraint-assisted placement as an explicit mode choice', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actionPlacementMode: 'free',
        actionPlacementProposal: { status: 'valid' },
      }),
    });
    const timeline = wrapper.get(
      '[data-testid="workbench-timeline-grid-preview"]'
    );
    const options = wrapper.findAll(
      '[data-testid="workbench-action-placement-mode-option"]'
    );

    expect(timeline.attributes()).toMatchObject({
      'data-action-placement-mode': 'free',
      'data-action-placement-status': 'valid',
    });
    expect(options.map(option => option.attributes('data-mode'))).toEqual([
      'free',
      'assisted',
    ]);
    expect(options[0].attributes('aria-pressed')).toBe('true');

    await options[1].trigger('click');
    expect(wrapper.emitted('update-action-placement-mode')?.at(-1)?.[0]).toBe(
      'assisted'
    );
  });

  it('renders requested and suggested frame guides with an assisted ghost', () => {
    const requestedAction = {
      ...createAction({
        id: 'action-a',
        name: '普通攻击',
        actorId: 'actor-a',
        startMs: 500,
      }),
      laneId: 'actor-a',
      label: '普通攻击',
    };
    const suggestedAction = {
      ...requestedAction,
      startMs: 1000,
    };
    const proposal = {
      status: 'adjustable',
      committable: true,
      requestedStartMs: 500,
      suggestedStartMs: 1000,
      adjustments: [{ message: '同轨动作占用' }],
    };
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actionPlacementMode: 'assisted',
        actionPlacementProposal: proposal,
        actionPlacementPreview: {
          active: true,
          kind: 'move',
          proposal,
          requestedActions: [requestedAction],
          proposedActions: [suggestedAction],
        },
      }),
    });

    const ghost = wrapper.get(
      '[data-testid="workbench-action-placement-ghost"]'
    );
    expect(
      wrapper
        .get('[data-testid="workbench-action-placement-request-guide"]')
        .text()
    ).toBe('30F');
    expect(
      wrapper
        .get('[data-testid="workbench-action-placement-suggested-guide"]')
        .text()
    ).toBe('60F');
    expect(ghost.attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-lane-id': 'actor-a',
      'data-placement-status': 'adjustable',
      'data-requested-start-ms': '500',
      'data-suggested-start-ms': '1000',
    });
    expect(readStyleNumber(ghost.attributes('style'), 'left')).toBeCloseTo(
      100 / 3,
      4
    );
    expect(ghost.text()).toContain('普通攻击60F');
  });

  it('previews and clears an existing action pointer drag before commit', async () => {
    const wrapper = mount(TimelineGridPreview, {
      attachTo: document.body,
      props: createTimelineProps(),
    });
    const lane = wrapper.get('[data-testid="workbench-timeline-lane"]');
    lane.element.getBoundingClientRect = () => createRect(0, 0, 600, 240);
    const action = wrapper.get(
      '[data-testid="workbench-timeline-action"][data-action-id="action-a"]'
    );

    action.element.dispatchEvent(
      new MouseEvent('pointerdown', {
        bubbles: true,
        button: 0,
        clientX: 0,
        clientY: 20,
      })
    );
    window.dispatchEvent(
      new MouseEvent('pointermove', {
        bubbles: true,
        clientX: 200,
        clientY: 20,
      })
    );
    await nextTick();
    expect(wrapper.emitted('preview-action-placement')?.at(-1)?.[0]).toEqual({
      kind: 'move',
      actionIds: ['action-a'],
      primaryActionId: 'action-a',
      offsetMs: 1000,
      targetLaneId: null,
    });

    window.dispatchEvent(
      new MouseEvent('pointerup', {
        bubbles: true,
        clientX: 200,
        clientY: 20,
      })
    );
    await nextTick();
    expect(wrapper.emitted('move-selected-actions')?.at(-1)?.[0]).toEqual({
      actionIds: ['action-a'],
      primaryActionId: 'action-a',
      offsetMs: 1000,
      targetLaneId: null,
    });
    expect(wrapper.emitted('clear-action-placement-preview')).toHaveLength(1);
    wrapper.unmount();
  });

  it('renders the official icon, action kind, and frame duration on action blocks', () => {
    const action = {
      ...createAction({
        id: 'action-a',
        name: '普通攻击',
        actorId: 'actor-a',
        startMs: 0,
      }),
      actionKind: 'normal-attack',
      durationMs: 1000,
      icon: 'tex_icon_skill_109001_00.png',
    };
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({ actions: [action] }),
    });
    const block = wrapper.get(
      '[data-testid="workbench-timeline-action"][data-action-id="action-a"]'
    );

    expect(block.get('img.action-image-icon').attributes('src')).toBe(
      '/assets/actions/tex_icon_skill_109001_00.png'
    );
    expect(block.text()).toContain('普通攻击 · 60F');
    expect(readStyleNumber(block.attributes('style'), 'width')).toBeCloseTo(
      100 / 3,
      4
    );
  });

  it('renders a zero-duration switch as an exact-frame avatar marker instead of an action block', async () => {
    const actors = [
      { id: 'actor-a', characterId: 109001, name: '末音' },
      { id: 'actor-b', characterId: 101003, name: '寒悠悠' },
    ];
    const switchAction = {
      id: 'switch-b',
      name: '切人',
      type: 'switch',
      actorId: 'actor-a',
      actor: actors[0],
      targetActorId: 'actor-b',
      targetActor: actors[1],
      targetCharacterId: 101003,
      startMs: 1500,
      startFrame: 90,
      endFrame: 90,
      durationMs: 0,
      durationFrames: 0,
    };
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actors,
        actions: [
          createAction({
            id: 'action-a',
            name: '普通攻击',
            actorId: 'actor-a',
            startMs: 0,
          }),
          switchAction,
        ],
        selectedActionId: 'switch-b',
      }),
    });
    await vi.dynamicImportSettled();
    await flushPromises();
    await nextTick();
    const marker = wrapper.get(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    );

    expect(marker.classes()).toContain('switch-event-marker');
    expect(marker.classes()).not.toContain('action-block');
    expect(marker.attributes()).toMatchObject({
      'data-action-id': 'switch-b',
      'data-start-frame': '90',
      'data-duration-ms': '0',
      'data-duration-frames': '0',
      'data-target-character-id': '101003',
    });
    expect(readStyleNumber(marker.attributes('style'), 'left')).toBe(50);
    expect(marker.get('.switch-event-frame-label').text()).toBe('90F');
    expect(marker.get('.switch-event-avatar img').attributes('src')).toBe(
      '/assets/characters/101003.png'
    );
    expect(marker.find('.duration-handle').exists()).toBe(false);
    expect(wrapper.find('.action-block.type-switch').exists()).toBe(false);

    await marker.trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toEqual({
      actionId: 'switch-b',
      mode: 'replace',
    });
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toMatchObject(
      { frameIndex: 90, source: 'timeline-action' }
    );
  });

  it('renders switch-triggered star-carry children as selectable read-only actions', async () => {
    const derivedAction = {
      ...createAction({
        id: 'switch-b-on-enter-actor-b',
        name: '入场星携技',
        actorId: 'actor-b',
        startMs: 1500,
      }),
      durationMs: 1200,
      parentActionId: 'switch-b',
      actionKind: 'star-carry',
      readOnly: true,
      derivedAction: {
        kind: 'switch-triggered-star-carry',
        parentActionId: 'switch-b',
        readOnly: true,
      },
      switchTriggerBinding: {
        contractName: 'AzPrSwitchTriggerBinding',
        bindingId: 'switch-b|on-enter|actor-b',
        switchEventId: 'switch-b',
        triggerPhase: 'on-enter',
        resolutionStatus: 'applied',
      },
    };
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actions: [derivedAction],
        selectedActionId: derivedAction.id,
      }),
    });
    const block = wrapper.get(
      `[data-testid="workbench-timeline-action"][data-action-id="${derivedAction.id}"]`
    );

    expect(block.classes()).toContain('derived-readonly');
    expect(block.attributes()).toMatchObject({
      'data-derived-action-kind': 'switch-triggered-star-carry',
      'data-parent-action-id': 'switch-b',
      'data-read-only': 'true',
    });
    expect(block.text()).toContain('入场触发');
    expect(block.find('.duration-handle').exists()).toBe(false);

    await block.trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toEqual({
      actionId: derivedAction.id,
      mode: 'replace',
    });

    await block.trigger('keydown', { key: 'Delete' });
    await block.trigger('keydown', { key: 'ArrowRight' });
    await block.trigger('contextmenu', { clientX: 20, clientY: 20 });
    expect(wrapper.emitted('delete-selected-actions')).toBeUndefined();
    expect(wrapper.emitted('shift-selected-actions')).toBeUndefined();
    expect(wrapper.emitted('open-action-context-menu')).toBeUndefined();
  });

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

  it('uses an injected main flow command surface for sparse runtime curve nodes', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        runtimeStateCurves: createRuntimeTimelineStateCurves(),
        runtimeStatePointContexts: [
          { statePointId: 'runtime-hp-a', row: { sourceDeltaId: 'hp-a' } },
        ],
        mainFlowCommandSurface: createInjectedMainFlowCommandSurface(),
      }),
    });

    const marker = wrapper.find(
      '[data-testid="workbench-timeline-state-curve-node"][data-state-point-id="runtime-hp-a"]'
    );
    expect(marker.exists()).toBe(true);

    await marker.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'timeline-surface-test',
      actionId: 'action-a',
      statePointId: 'runtime-hp-a',
      canRun: true,
      payload: {
        statePointIds: ['runtime-hp-a'],
        preserveStateCurveFilters: true,
        timelineFrame: {
          frameIndex: 72,
          timeMs: 1200,
          statePointId: 'runtime-hp-a',
          source: 'timeline-runtime-curve',
        },
      },
    });
  });

  it('uses curve nodes as the only exact-frame numeric review targets', async () => {
    const surface = createInjectedMainFlowCommandSurface();
    const runtimeStatePointContexts = [
      createRuntimeEventContext({
        sourceDeltaId: 'hp-a',
        statePointId: 'state-hp',
        actionId: 'action-a',
        trackKey: 'enemyHpDamage',
        frameIndex: 72,
        timeMs: 1200,
        hpDelta: 100,
      }),
      createRuntimeEventContext({
        sourceDeltaId: 'toughness-a',
        statePointId: 'state-toughness',
        actionId: 'action-a',
        trackKey: 'enemyToughnessDamage',
        frameIndex: 108,
        timeMs: 1800,
        toughnessDelta: 20,
      }),
      createRuntimeEventContext({
        sourceDeltaId: 'energy-b',
        statePointId: 'state-resource',
        actionId: 'action-b',
        actorId: 'actor-b',
        actorName: '寒悠悠',
        trackKey: 'selfEnergyChange',
        frameIndex: 90,
        timeMs: 1500,
        energyDelta: 50,
        stateSnapshot: {
          before: { selfEnergy: { currentValue: 0 } },
          after: { selfEnergy: { currentValue: 50 } },
        },
      }),
    ];
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        runtimeStateCurves: createRuntimeTimelineStateCurves(),
        runtimeStatePointContexts,
        mainFlowCommandSurface: surface,
      }),
    });

    expect(
      wrapper.findAll('[data-testid="workbench-timeline-runtime-event-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll('[data-testid="workbench-timeline-state-curve-marker"]')
    ).toHaveLength(0);
    expect(
      wrapper.findAll(
        '[data-testid="workbench-timeline-state-curve-breakpoint"]'
      )
    ).toHaveLength(0);
    const markers = wrapper.findAll(
      '[data-testid="workbench-timeline-state-curve-node"]'
    );
    expect(markers).toHaveLength(3);

    const hpNode = wrapper.get(
      '[data-testid="workbench-timeline-state-curve-node"][data-state-point-id="state-hp"]'
    );
    await hpNode.trigger('click');
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toEqual({
      frameIndex: 72,
      timeMs: 1200,
      statePointId: 'state-hp',
      source: 'timeline-runtime-curve',
    });
    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'timeline-surface-test',
      actionId: 'action-a',
      statePointId: 'state-hp',
      payload: {
        statePointIds: ['state-hp'],
        preserveStateCurveFilters: true,
      },
    });
  });

  it('clusters dense same-action changes into one semantic node without losing ids', async () => {
    const runtimeStateCurves = createRuntimeTimelineStateCurves();
    runtimeStateCurves.enemy.points = [
      {
        sourceDeltaId: 'dense-hp-1',
        actionId: 'action-a',
        trackKey: 'enemyHpDamage',
        frameIndex: 30,
        timeMs: 500,
        hpDelta: 10,
        stateSnapshot: { after: { enemyHp: { currentValue: 990 } } },
      },
      {
        sourceDeltaId: 'dense-hp-2',
        actionId: 'action-a',
        trackKey: 'enemyHpDamage',
        frameIndex: 33,
        timeMs: 550,
        hpDelta: 20,
        stateSnapshot: { after: { enemyHp: { currentValue: 970 } } },
      },
    ];
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        durationMs: 30000,
        runtimeStateCurves,
        runtimeStatePointContexts: [
          createRuntimeEventContext({
            sourceDeltaId: 'dense-hp-1',
            statePointId: 'dense-state-1',
            actionId: 'action-a',
            trackKey: 'enemyHpDamage',
            frameIndex: 30,
            timeMs: 500,
            hpDelta: 10,
          }),
          createRuntimeEventContext({
            sourceDeltaId: 'dense-hp-2',
            statePointId: 'dense-state-2',
            actionId: 'action-a',
            trackKey: 'enemyHpDamage',
            frameIndex: 33,
            timeMs: 550,
            hpDelta: 20,
          }),
        ],
        mainFlowCommandSurface: createInjectedMainFlowCommandSurface(),
      }),
    });

    const markers = wrapper
      .get(
        '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"]'
      )
      .findAll('[data-testid="workbench-timeline-state-curve-node"]');
    expect(markers).toHaveLength(1);
    expect(markers[0].attributes()).toMatchObject({
      'data-event-count': '2',
      'data-state-point-ids': 'dense-state-1,dense-state-2',
    });
    await markers[0].trigger('click');
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toMatchObject(
      {
        frameIndex: 33,
        statePointId: 'dense-state-2',
      }
    );
    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      statePointId: 'dense-state-2',
      payload: {
        statePointIds: ['dense-state-1', 'dense-state-2'],
      },
    });
  });

  it('renders action readiness and legal skill cooldown windows on the timeline', async () => {
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
      'data-start-frame-index': '0',
      'data-end-frame-index': '90',
      'data-end-ms': '1500',
      'data-window-id': 'action-a|cooldown-charge|0',
    });
    expect(cooldownWindow.text()).toContain('普通攻击');
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-action"][data-action-id="action-a"]'
        )
        .attributes('style')
    ).toContain('top: 61px');
    expect(cooldownWindow.attributes('style')).toContain('top: 109px');
    await cooldownWindow.trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toEqual({
      actionId: 'action-a',
      mode: 'replace',
    });
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toEqual({
      frameIndex: 0,
      timeMs: 0,
      statePointId: '',
      source: 'timeline-cooldown-window',
    });
  });

  it('stacks overlapping cooldown and effect bars independently in one actor lane', () => {
    const firstEffect = createEffectInterval({
      intervalId: 'shared-runtime-interval',
      effectId: 'effect-a',
      effectName: '状态 A',
      startMs: 0,
      endMs: 2400,
      sourceActionId: 'action-a',
    });
    const secondEffect = createEffectInterval({
      intervalId: 'shared-runtime-interval',
      effectId: 'effect-b',
      effectName: '状态 B',
      startMs: 500,
      endMs: 2800,
      sourceActionId: 'action-c',
    });
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        actions: [
          createAction({
            id: 'action-a',
            name: '星鸣技',
            actorId: 'actor-a',
            startMs: 0,
          }),
          createAction({
            id: 'action-c',
            name: '星结合击',
            actorId: 'actor-a',
            startMs: 1000,
          }),
        ],
        effectIntervals: [firstEffect, secondEffect],
        actionReadinessTimeline: {
          actions: [],
          cooldownWindows: [
            {
              windowId: 'action-a|cooldown-charge|0',
              actionId: 'action-a',
              actionName: '星鸣技',
              actorId: 'actor-a',
              startMs: 0,
              endMs: 24000,
              durationMs: 24000,
            },
            {
              windowId: 'action-c|cooldown-charge|0',
              actionId: 'action-c',
              actionName: '星结合击',
              actorId: 'actor-a',
              startMs: 1000,
              endMs: 25000,
              durationMs: 24000,
            },
          ],
        },
      }),
    });

    const cooldownWindows = wrapper.findAll(
      '[data-testid="workbench-timeline-cooldown-window"]'
    );
    expect(cooldownWindows).toHaveLength(2);
    expect(
      cooldownWindows.map(item => item.attributes('data-cooldown-slot'))
    ).toEqual(['0', '1']);
    expect(
      cooldownWindows.map(item =>
        readStyleNumber(item.attributes('style'), 'top')
      )
    ).toEqual([109, 128]);

    const effectIntervals = wrapper.findAll(
      '[data-testid="workbench-timeline-effect-interval"]'
    );
    expect(effectIntervals).toHaveLength(2);
    expect(
      effectIntervals.map(item => item.attributes('data-effect-slot'))
    ).toEqual(['0', '1']);
    expect(
      effectIntervals.map(item =>
        readStyleNumber(item.attributes('style'), 'top')
      )
    ).toEqual([8, 27]);
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
        actionEffectRelationGraph: {
          edges: [
            {
              edgeId: 'relation-0001',
              kind: 'sequence',
              status: 'satisfied',
              gapMs: 100,
              sourceEndpoint: {
                endpointKind: 'action',
                actionId: 'action-a',
                anchor: 'end',
              },
              targetEndpoint: {
                endpointKind: 'action',
                actionId: 'action-b',
                anchor: 'start',
              },
            },
          ],
        },
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
      startFrame: 30,
      endFrame: 150,
      lifecycleEvents: [
        { eventId: 'mark-apply', type: 'EFFECT_APPLIED', timeMs: 500 },
        { eventId: 'mark-remove', type: 'EFFECT_REMOVED', timeMs: 2500 },
      ],
      selectionEventId: 'mark-remove',
      confidence: 'medium',
      trackingStatus: 'unapplied',
      sourceStatus: 'generated-from-azpr-action-status-catalog',
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
    expect(intervals[1].attributes()).toMatchObject({
      'data-start-frame-index': '30',
      'data-end-frame-index': '150',
      'data-confidence': 'medium',
      'data-tracking-status': 'unapplied',
      'data-source-status': 'generated-from-azpr-action-status-catalog',
      'data-applied-to-calculators': 'false',
    });
    expect(intervals[1].text()).toContain('未应用');
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

  it('draws and selects trigger and consume relations on effect lifecycle nodes', async () => {
    const effectInterval = createEffectInterval({
      instanceKey: 'actor|actor-a|focus',
      effectId: 'focus',
      effectName: '专注',
      startMs: 250,
      endMs: 1250,
      lifecycleEventIds: ['focus-apply', 'focus-remove'],
      lifecycleEvents: [
        { eventId: 'focus-apply', type: 'EFFECT_APPLIED', timeMs: 250 },
        { eventId: 'focus-remove', type: 'EFFECT_REMOVED', timeMs: 1250 },
      ],
    });
    const graph = {
      summary: { edgeCount: 2 },
      edges: [
        createEffectRelation({
          edgeId: 'effect-relation:apply-focus',
          kind: 'effect-trigger',
          sourceEndpoint: {
            endpointKind: 'action',
            actionId: 'action-a',
            anchor: 'start',
          },
          targetEndpoint: {
            endpointKind: 'effect',
            instanceKey: effectInterval.instanceKey,
          },
          runtimeEventId: 'focus-apply',
          targetTimeMs: 250,
        }),
        createEffectRelation({
          edgeId: 'effect-relation:remove-focus',
          kind: 'effect-consume',
          sourceEndpoint: {
            endpointKind: 'effect',
            instanceKey: effectInterval.instanceKey,
          },
          targetEndpoint: {
            endpointKind: 'action',
            actionId: 'action-b',
            anchor: 'start',
          },
          runtimeEventId: 'focus-remove',
          targetTimeMs: 1250,
        }),
      ],
    };
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        effectIntervals: [effectInterval],
        actionEffectRelationGraph: graph,
        selectedActionEffectRelationId: 'effect-relation:remove-focus',
      }),
    });

    const relations = wrapper.findAll(
      '[data-testid="workbench-action-relation"]'
    );
    expect(relations).toHaveLength(2);
    expect(
      relations.map(relation => relation.attributes('data-relation-kind'))
    ).toEqual(['effect-trigger', 'effect-consume']);
    expect(relations[1].element.parentElement.classList).toContain('selected');

    await relations[0].trigger('click');
    expect(wrapper.emitted('select-action-effect-relation')?.at(-1)?.[0]).toBe(
      'effect-relation:apply-focus'
    );
    await relations[0].trigger('contextmenu', { clientX: 120, clientY: 80 });
    expect(
      wrapper.emitted('open-action-relation-context-menu')
    ).toBeUndefined();
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

  it('renders involved team marks as compact curves on the shared timeline', async () => {
    const initialState = [
      [150, 'fire', '火', 0],
      [850, 'water', '水', 0],
      [350, 'ice', '冰', 0],
      [750, 'wind', '风', 2],
      [550, 'wood', '木', 0],
      [650, 'earth', '地', 0],
      [250, 'thunder', '雷', 0],
      [950, 'light', '光', 0],
      [450, 'dark', '暗', 0],
    ].map(([markId, profileKey, elementName, currentValue]) => ({
      markId,
      profileKey,
      elementName,
      currentValue,
      maxValue: 5,
      valueUnit: 'mark-stacks',
    }));
    const tuningMarkCurveProjection = projectVerifiedTuningMarkCurves({
      durationMs: 30_000,
      tuningMarkRuntime: {
        initialState,
        events: [
          {
            eventIdentity: 'fire-acquire',
            kind: 'acquire',
            markId: 150,
            actionId: 'action-a',
            timeMs: 1_000,
            frameIndex: 60,
            before: 0,
            after: 1,
            sourceIdentity: { path: 'Battle/fire' },
          },
          {
            eventIdentity: 'wind-consume',
            kind: 'consume',
            markId: 750,
            actionId: 'action-b',
            timeMs: 2_000,
            frameIndex: 120,
            before: 2,
            after: 0,
            sourceIdentity: { path: 'Battle/wind' },
          },
        ],
      },
    });
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        durationMs: 30_000,
        tuningMarkCurveProjection,
      }),
    });

    expect(
      wrapper
        .get('[data-testid="workbench-timeline-grid-preview"]')
        .attributes('data-tuning-mark-track-count')
    ).toBe('2');
    expect(
      wrapper.findAll('[data-lane-kind="tuning-mark-curve"]')
    ).toHaveLength(4);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-150"] [data-testid="workbench-timeline-state-curve-line"]'
        )
        .attributes('points')
    ).toBe('0,100 3.3333333333333335,100 3.3333333333333335,80 100,80');

    const fireNode = wrapper.get(
      '[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-150"] [data-testid="workbench-timeline-state-curve-node"]'
    );
    expect(fireNode.attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-mark-id': '150',
      'data-event-kinds': 'acquire',
      'data-frame-index': '60',
    });
    await fireNode.trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toEqual({
      actionId: 'action-a',
      mode: 'replace',
    });
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toMatchObject(
      {
        frameIndex: 60,
        source: 'timeline-tuning-mark-curve',
      }
    );
  });

  it('renders a special resource lane only for the owning actor and locates its source action', async () => {
    const runtimeStateCurves = createRuntimeTimelineStateCurves();
    runtimeStateCurves.resources.curvesBySpecialResource = [
      {
        trackKey: 'specialResource:actor-a:103002047',
        actorId: 'actor-a',
        characterId: 103002,
        resourceIdentity: 'actor:103002:element:103002047',
        resourceName: '子弹',
        elementId: 103002047,
        initialValue: 0,
        currentValue: 6,
        maxValue: 12,
        stateMetric: { initialValue: 0, currentValue: 6, maxValue: 12 },
        points: [
          {
            sourceDeltaId: 'ruby-bullet-gain',
            actionId: 'action-a',
            actorId: 'actor-a',
            trackKey: 'specialResource:actor-a:103002047',
            timeMs: 1000,
            frameIndex: 60,
            beforeValue: 0,
            afterValue: 6,
            delta: 6,
            operation: 'gain',
            semantic: true,
          },
        ],
      },
    ];
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({ runtimeStateCurves }),
    });

    const labels = wrapper.findAll(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-special-resource-curve"]'
    );
    expect(labels).toHaveLength(1);
    expect(labels[0].attributes('data-actor-id')).toBe('actor-a');
    expect(labels[0].text()).toContain('子弹');
    expect(
      wrapper
        .find(
          '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-special-resource-curve"][data-actor-id="actor-b"]'
        )
        .exists()
    ).toBe(false);

    const node = wrapper.get(
      '[data-testid="workbench-timeline-row"][data-lane-id="special-resource-actor-a-103002047"] [data-testid="workbench-timeline-state-curve-node"]'
    );
    expect(node.attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-frame-index': '60',
      'data-event-kinds': 'gain',
    });
    expect(node.attributes('title')).toContain('子弹 获取');
    await node.trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toEqual({
      actionId: 'action-a',
      mode: 'replace',
    });
    expect(wrapper.emitted('select-timeline-frame')?.at(-1)?.[0]).toMatchObject(
      {
        frameIndex: 60,
        source: 'timeline-special-resource-curve',
      }
    );
  });

  it('renders controlled actor intervals and follows the exact-frame cursor state', async () => {
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        cursorFrameIndex: 59,
        controlledActorTimeline: {
          initialActor: { actorId: 'actor-a', actorName: '末音' },
          finalActor: { actorId: 'actor-b', actorName: '寒悠悠' },
          transitions: [
            {
              transitionId: 'controlled-actor-transition-switch-b',
              actionId: 'switch-b',
              timeMs: 1000,
              frameIndex: 60,
              applied: true,
            },
          ],
          intervals: [
            {
              intervalId: 'controlled-actor-interval-a',
              actorId: 'actor-a',
              actor: { actorId: 'actor-a', actorName: '末音' },
              startMs: 0,
              endMs: 1000,
              startFrameIndex: 0,
              endFrameIndex: 60,
            },
            {
              intervalId: 'controlled-actor-interval-b',
              actorId: 'actor-b',
              actor: { actorId: 'actor-b', actorName: '寒悠悠' },
              startMs: 1000,
              endMs: 3000,
              startFrameIndex: 60,
              endFrameIndex: 180,
            },
          ],
        },
      }),
    });

    expect(
      wrapper.findAll('[data-testid="workbench-controlled-actor-interval"]')
    ).toHaveLength(2);
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-lane-label"][data-lane-id="actor-a"]'
        )
        .attributes('data-controlled-actor')
    ).toBe('true');
    expect(
      wrapper.get('[data-testid="workbench-controlled-actor-readout"]').text()
    ).toContain('末音');

    await wrapper.setProps({ cursorFrameIndex: 60 });
    expect(
      wrapper
        .get(
          '[data-testid="workbench-timeline-lane-label"][data-lane-id="actor-b"]'
        )
        .attributes('data-controlled-actor')
    ).toBe('true');
    expect(
      wrapper.get('[data-testid="workbench-controlled-actor-readout"]').text()
    ).toContain('寒悠悠');
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

    const avatarButton = identity.get(
      '[data-testid="workbench-direct-character-picker"]'
    );
    await avatarButton.trigger('click');
    expect(wrapper.emitted('open-loadout-picker')?.at(-1)?.[0]).toMatchObject({
      kind: 'character',
      actorId: 'actor-a',
      characterId: 109001,
      slotId: 'team-slot-1',
      selectedId: 109001,
    });
    expect(
      identity.findAll('[data-testid="workbench-direct-loadout-slot"]')
    ).toHaveLength(6);
    expect(
      identity
        .findAll('[data-testid="workbench-direct-loadout-slot"]')
        .map(slot => slot.attributes('data-loadout-slot'))
    ).toEqual(['weapon', 'top', 'bottom', 'earring', 'ring', 'soulessenceId']);
    expect(readStyleNumber(identity.attributes('style'), 'height')).toBe(164);
    expect(
      readStyleNumber(
        wrapper
          .get(
            '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-a"]'
          )
          .attributes('style'),
        'height'
      )
    ).toBe(44);

    await identity.get('.lane-identity-command').trigger('click');
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
        '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-team-slot-1"] [data-testid="workbench-direct-kibo-picker"]'
      )
      .trigger('click');
    expect(wrapper.emitted('open-loadout-picker')?.at(-1)?.[0]).toMatchObject({
      kind: 'kibo',
      actorId: 'actor-a',
      characterId: 109001,
      selectedId: 500001,
    });
    expect(
      wrapper
        .get('[data-testid="workbench-direct-kibo-picker"]')
        .attributes('data-selected-id')
    ).toBe('500001');

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
    const semanticNodes = laneId =>
      curve(laneId).findAll(
        '[data-testid="workbench-timeline-state-curve-node"]'
      );

    expect(curve('energy-actor-a').attributes('data-point-count')).toBe('0');
    expect(curve('energy-actor-b').attributes()).toMatchObject({
      'data-initial-value': '0',
      'data-current-value': '0.5',
      'data-point-count': '1',
    });
    expect(semanticNodes('energy-actor-b')[0].attributes()).toMatchObject({
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
    expect(semanticNodes('enemy-hp-curve')[0].attributes()).toMatchObject({
      'data-action-id': 'action-a',
      'data-time-ms': '1200',
      'data-current-value': '900',
    });
    expect(
      semanticNodes('enemy-toughness-curve')[0].attributes()
    ).toMatchObject({
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
    expect(semanticNodes('energy-actor-b')).toHaveLength(2);
    expect(
      semanticNodes('energy-actor-b').map(point =>
        point.attributes('data-time-ms')
      )
    ).toEqual(['1500', '2400']);

    movedRuntimeStateCurves.resources.curvesByActor[1].points = [];
    movedRuntimeStateCurves.resources.curvesByActor[1].stateMetric.currentValue = 0;
    await wrapper.setProps({
      runtimeStateCurves: JSON.parse(JSON.stringify(movedRuntimeStateCurves)),
    });
    expect(semanticNodes('energy-actor-b')).toHaveLength(0);
    expect(
      curve('energy-actor-b')
        .get('[data-testid="workbench-timeline-state-curve-line"]')
        .attributes('points')
    ).toBe('0,100 100,100');
  });

  it('keeps 30 second auto recovery ticks out of the visible node count', () => {
    const runtimeStateCurves = createRuntimeTimelineStateCurves();
    runtimeStateCurves.resources.curvesByActor[0] = {
      actorId: 'actor-a',
      stateMetric: { initialValue: 0, currentValue: 6, maxValue: 100 },
      points: Array.from({ length: 300 }, (_, index) => ({
        sourceDeltaId: `auto-${index + 1}`,
        actionId: '',
        actorId: 'actor-a',
        trackKey: 'selfEnergyChange',
        timeMs: (index + 1) * 100,
        frameIndex: (index + 1) * 6,
        energyDelta: 0.02,
        hitKey: `auto-sp-actor-a-${(index + 1) * 6}`,
        stateSnapshot: {
          after: { selfEnergy: { currentValue: (index + 1) * 0.02 } },
        },
      })),
    };
    const wrapper = mount(TimelineGridPreview, {
      props: createTimelineProps({
        durationMs: 30000,
        runtimeStateCurves,
      }),
    });
    const curve = wrapper.get(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-a"] [data-testid="workbench-timeline-state-curve"]'
    );

    expect(curve.attributes()).toMatchObject({
      'data-simulation-point-count': '300',
      'data-semantic-node-count': '0',
      'data-point-count': '0',
    });
    expect(
      curve
        .get('[data-testid="workbench-timeline-state-curve-line"]')
        .attributes('data-point-count')
    ).toBe('2');
    expect(
      curve.findAll('[data-testid="workbench-timeline-state-curve-node"]')
    ).toHaveLength(0);
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
      .get('[data-testid="workbench-timeline-state-curve-node"]')
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

function createEffectRelation(overrides) {
  return {
    status: 'satisfied',
    effectId: 'focus',
    effectName: '专注',
    sourceTimeMs: 0,
    targetTimeMs: 0,
    runtimeEventId: '',
    ...overrides,
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

function createRuntimeEventContext({
  sourceDeltaId,
  statePointId,
  actionId,
  actorId = 'actor-a',
  actorName = '末音',
  trackKey,
  frameIndex = 30,
  timeMs = 500,
  hpDelta = null,
  toughnessDelta = null,
  energyDelta = null,
  stateSnapshot = null,
  hitKey = actionId === 'action-a' ? 'hit-1' : '',
  hitIndex = actionId === 'action-a' ? 1 : null,
}) {
  const row = {
    sourceDeltaId,
    actionId,
    actionName: actionId === 'action-a' ? '普通攻击' : '重击',
    actorId,
    actorName,
    hitKey,
    hitIndex,
    trackKey,
    layerKey: 'applied',
    frameIndex,
    timeMs,
    hpDelta,
    toughnessDelta,
    energyDelta,
    stateSnapshot,
  };
  return { statePointId, row, point: { ...row } };
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
