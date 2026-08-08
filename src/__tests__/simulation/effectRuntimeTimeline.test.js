import { describe, expect, it } from 'vitest';
import {
  EFFECT_OPERATIONS,
  EFFECT_STACK_MODES,
  EFFECT_TARGET_KINDS,
  createEffectCommand,
  createEnemyEventAction,
  createProject,
  validateProject,
} from '../../domain/projectSchema';
import { runSimulation } from '../../simulation';
import {
  createActionEffectRuntimeInput,
  createEffectRuntimeTimeline,
  resolveActiveEffectsAt,
} from '../../simulation/runtime/effectRuntimeTimeline';
import { createThreeValueRuntimeOutputConsumerView } from '../../simulation/runtime/threeValueRuntimeOutputConsumer';

describe('effect runtime timeline', () => {
  it('transfers inheritable controlled-actor effects without refreshing their lifetime', () => {
    const scenario = {
      time: { durationMs: 1200, fps: 60 },
      actors: [
        { id: 'actor-source', name: '来源角色' },
        { id: 'actor-next', name: '下一角色' },
        { id: 'actor-third', name: '第三角色' },
      ],
      actions: [],
      initialRuntimeState: { activeEffects: [] },
    };
    const controlledActorTimeline = {
      initialActor: {
        actorId: 'actor-source',
        actorName: '来源角色',
      },
      transitions: [
        createControlledActorTransition({
          id: 'switch-next',
          timeMs: 200,
          beforeActorId: 'actor-source',
          afterActorId: 'actor-next',
        }),
        createControlledActorTransition({
          id: 'switch-third',
          timeMs: 300,
          beforeActorId: 'actor-next',
          afterActorId: 'actor-third',
        }),
        createControlledActorTransition({
          id: 'switch-after-expiry',
          timeMs: 700,
          beforeActorId: 'actor-third',
          afterActorId: 'actor-source',
        }),
      ],
    };
    const timeline = createEffectRuntimeTimeline({
      scenario,
      controlledActorTimeline,
      generatedCommands: [
        createVerifiedGeneratedEffectCommand({
          id: 'source-inherited-buff',
          effectId: 'effect-source-inherited',
          semanticTargetKind: 'controlled-actor',
          targetId: 'actor-source',
          timeMs: 100,
          durationMs: 500,
          inheritType: 'source',
        }),
        createVerifiedGeneratedEffectCommand({
          id: 'self-inherited-buff',
          effectId: 'effect-self-inherited',
          semanticTargetKind: 'controlled-actor',
          targetId: 'actor-source',
          timeMs: 100,
          durationMs: 500,
          inheritType: 'self',
        }),
        createVerifiedGeneratedEffectCommand({
          id: 'team-buff-copy',
          effectId: 'effect-team',
          semanticTargetKind: 'team-actors',
          targetId: 'actor-source',
          timeMs: 100,
          durationMs: 500,
          inheritType: null,
          inheritOnControlledActorSwitch: false,
        }),
      ],
    });

    expect(timeline.summary).toMatchObject({
      transferredEventCount: 4,
      expiredEventCount: 3,
    });
    expect(
      timeline.events
        .filter(event => event.type === 'EFFECT_TRANSFERRED')
        .map(event => [
          event.effectId,
          event.frameIndex,
          event.before.targetId,
          event.after.targetId,
          event.after.appliedAtMs,
          event.after.expiresAtMs,
          event.after.formulaSourceActorId,
          event.after.effectAdderActorId,
        ])
    ).toEqual([
      [
        'effect-self-inherited',
        12,
        'actor-source',
        'actor-next',
        100,
        600,
        'actor-source',
        'actor-next',
      ],
      [
        'effect-source-inherited',
        12,
        'actor-source',
        'actor-next',
        100,
        600,
        'actor-source',
        'actor-source',
      ],
      [
        'effect-self-inherited',
        18,
        'actor-next',
        'actor-third',
        100,
        600,
        'actor-source',
        'actor-third',
      ],
      [
        'effect-source-inherited',
        18,
        'actor-next',
        'actor-third',
        100,
        600,
        'actor-source',
        'actor-source',
      ],
    ]);
    expect(
      timeline.events.filter(
        event =>
          event.type === 'EFFECT_TRANSFERRED' &&
          event.effectId === 'effect-team'
      )
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, 250).map(effect => [
        effect.effectId,
        effect.targetId,
      ])
    ).toEqual([
      ['effect-self-inherited', 'actor-next'],
      ['effect-source-inherited', 'actor-next'],
      ['effect-team', 'actor-source'],
    ]);
    expect(resolveActiveEffectsAt(timeline, 700)).toEqual([]);
  });

  it('applies same-frame commands before the exact switch transfer', () => {
    const scenario = {
      time: { durationMs: 1000, fps: 60 },
      actors: [{ id: 'actor-source' }, { id: 'actor-next' }],
      actions: [],
      initialRuntimeState: { activeEffects: [] },
    };
    const timeline = createEffectRuntimeTimeline({
      scenario,
      controlledActorTimeline: {
        initialActor: { actorId: 'actor-source' },
        transitions: [
          createControlledActorTransition({
            id: 'same-frame-switch',
            timeMs: 200,
            beforeActorId: 'actor-source',
            afterActorId: 'actor-next',
          }),
        ],
      },
      generatedCommands: [
        createVerifiedGeneratedEffectCommand({
          id: 'same-frame-source-buff',
          effectId: 'same-frame-source-buff',
          semanticTargetKind: 'controlled-actor',
          targetId: 'actor-source',
          timeMs: 200,
          durationMs: 500,
          inheritType: 'source',
        }),
      ],
    });

    expect(
      timeline.events.map(event => [
        event.type,
        event.timeMs,
        event.before?.targetId ?? null,
        event.after?.targetId ?? null,
      ])
    ).toEqual([
      ['EFFECT_APPLIED', 200, null, 'actor-source'],
      ['EFFECT_TRANSFERRED', 200, 'actor-source', 'actor-next'],
      ['EFFECT_EXPIRED', 700, 'actor-next', null],
    ]);
  });

  it('distinguishes numeric source-exit and carrier-exit clear flags across targets', () => {
    const scenario = {
      time: { durationMs: 1000, fps: 60 },
      actors: [
        { id: 'actor-source' },
        { id: 'actor-next' },
        { id: 'actor-third' },
      ],
      actions: [],
      initialRuntimeState: { activeEffects: [] },
    };
    const timeline = createEffectRuntimeTimeline({
      scenario,
      controlledActorTimeline: {
        initialActor: { actorId: 'actor-source' },
        transitions: [
          createControlledActorTransition({
            id: 'source-exits',
            timeMs: 200,
            beforeActorId: 'actor-source',
            afterActorId: 'actor-next',
          }),
          createControlledActorTransition({
            id: 'carrier-exits',
            timeMs: 300,
            beforeActorId: 'actor-next',
            afterActorId: 'actor-third',
          }),
        ],
      },
      generatedCommands: [
        createVerifiedGeneratedEffectCommand({
          id: 'source-exit-effect',
          effectId: 'source-exit-effect',
          semanticTargetKind: 'actor',
          targetId: 'actor-next',
          timeMs: 100,
          durationMs: null,
          inheritType: null,
          inheritOnControlledActorSwitch: false,
          clearType: 8,
        }),
        createVerifiedGeneratedEffectCommand({
          id: 'carrier-exit-effect',
          effectId: 'carrier-exit-effect',
          semanticTargetKind: 'actor',
          targetId: 'actor-next',
          timeMs: 100,
          durationMs: null,
          inheritType: null,
          inheritOnControlledActorSwitch: false,
          clearType: 16,
        }),
      ],
    });

    expect(
      resolveActiveEffectsAt(timeline, 250).map(effect => effect.effectId)
    ).toEqual(['carrier-exit-effect']);
    expect(
      timeline.events
        .filter(event => event.type === 'EFFECT_REMOVED')
        .map(event => ({
          effectId: event.effectId,
          timeMs: event.timeMs,
          operation: event.operation,
          transition: event.controlledActorTransitionActionId,
          clearType: event.before.clearType,
          sourceActorId: event.before.sourceActorId,
          clearCarrierActorId: event.before.clearCarrierActorId,
        }))
    ).toEqual([
      {
        effectId: 'source-exit-effect',
        timeMs: 200,
        operation: 'remove',
        transition: 'source-exits',
        clearType: 8,
        sourceActorId: 'actor-source',
        clearCarrierActorId: 'actor-next',
      },
      {
        effectId: 'carrier-exit-effect',
        timeMs: 300,
        operation: 'remove',
        transition: 'carrier-exits',
        clearType: 16,
        sourceActorId: 'actor-source',
        clearCarrierActorId: 'actor-next',
      },
    ]);
    expect(resolveActiveEffectsAt(timeline, 300)).toEqual([]);
  });

  it('keeps corrupt source names auditable without publishing them as effect labels', () => {
    const timeline = createEffectRuntimeTimeline({
      scenario: {
        time: { durationMs: 2000, fps: 60 },
        actors: [{ id: 'actor-001' }],
        actions: [],
        initialRuntimeState: {
          activeEffects: [
            {
              instanceKey: 'actor|actor-001|effect-corrupt',
              effectId: 'effect-corrupt',
              effectName: '\uFFFD\uFFFD buff',
              targetKind: 'actor',
              targetId: 'actor-001',
              remainingDurationMs: 750,
              stacks: 1,
              maxStacks: 1,
            },
          ],
        },
      },
    });

    expect(timeline.events[0]).toMatchObject({
      effectName: '状态效果 1',
      after: {
        effectName: '状态效果 1',
        rawSourceName: '\uFFFD\uFFFD buff',
        sourceNameStatus: 'corrupt-source-encoding',
      },
    });
    expect(JSON.stringify(timeline.activeEffects)).not.toContain(
      '"effectName":"\uFFFD'
    );
  });

  it('starts from inherited active effects and expires them by remaining duration', () => {
    const timeline = createEffectRuntimeTimeline({
      scenario: {
        time: { durationMs: 2000, fps: 60 },
        actors: [{ id: 'actor-001' }],
        actions: [],
        initialRuntimeState: {
          activeEffects: [
            {
              instanceKey: 'actor|actor-001|effect-focus',
              effectId: 'effect-focus',
              effectName: '专注',
              sourceActorId: 'actor-001',
              targetKind: 'actor',
              targetId: 'actor-001',
              remainingDurationMs: 750,
              stacks: 2,
              maxStacks: 3,
              refreshCount: 1,
              revision: 2,
              tags: ['buff'],
              modifiers: [],
            },
          ],
        },
      },
    });

    expect(timeline.events.map(event => [event.type, event.timeMs])).toEqual([
      ['EFFECT_INHERITED', 0],
      ['EFFECT_EXPIRED', 750],
    ]);
    expect(timeline.events[0]).toMatchObject({
      status: 'effect-runtime-inherited',
      operation: 'inherit',
      after: {
        appliedAtMs: 0,
        expiresAtMs: 750,
        stacks: 2,
        sourceStatus: 'effect-inherited-from-cycle-boundary',
      },
    });
    expect(timeline.summary).toMatchObject({
      inheritedEventCount: 1,
      expiredEventCount: 1,
      activeEffectCount: 0,
      peakActiveEffectCount: 1,
      calculatorAppliedEffectCount: 0,
    });
  });

  it('tracks apply, stack, refresh, remove, and expiry with stable ownership', () => {
    const scenario = createEffectScenario();
    const input = createActionEffectRuntimeInput({ scenario });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      effectInput: input,
    });

    expect(input).toMatchObject({
      sourceKind: 'azpr-action-effect-runtime-input',
      contractName: 'AzPrActionEffectCommand',
      status: 'action-effect-runtime-input-ready',
      validation: {
        valid: true,
        issueCount: 0,
      },
      summary: {
        commandCount: 5,
        actionCount: 5,
        effectCount: 2,
        targetCount: 2,
        calculatorAppliedCommandCount: 0,
      },
    });
    expect(input.summary.operationCounts).toEqual([
      { key: 'apply', count: 3 },
      { key: 'refresh', count: 1 },
      { key: 'remove', count: 1 },
    ]);
    expect(input.commands.map(command => command.timeMs)).toEqual([
      0, 500, 1000, 1200, 2000,
    ]);
    expect(input.commands[0]).toMatchObject({
      targetKind: 'actor',
      targetId: 'actor-001',
      instanceKey: 'actor|actor-001|effect-focus',
      frameIndex: 0,
      appliedToCalculators: false,
    });

    expect(timeline).toMatchObject({
      sourceKind: 'azpr-effect-runtime-timeline',
      contractName: 'AzPrEffectRuntimeTimeline',
      status: 'effect-runtime-timeline-ready',
      summary: {
        commandCount: 5,
        eventCount: 6,
        appliedEventCount: 2,
        refreshedEventCount: 2,
        removedEventCount: 1,
        expiredEventCount: 1,
        stackedRefreshEventCount: 1,
        activeEffectCount: 0,
        peakActiveEffectCount: 2,
        calculatorAppliedEffectCount: 0,
      },
    });
    expect(timeline.events.map(event => [event.type, event.timeMs])).toEqual([
      ['EFFECT_APPLIED', 0],
      ['EFFECT_REFRESHED', 500],
      ['EFFECT_REFRESHED', 1000],
      ['EFFECT_APPLIED', 1200],
      ['EFFECT_REMOVED', 2000],
      ['EFFECT_EXPIRED', 3000],
    ]);
    expect(timeline.events[1]).toMatchObject({
      effectId: 'effect-focus',
      targetKind: 'actor',
      targetId: 'actor-001',
      stackBefore: 1,
      stackAfter: 2,
      stackChange: 1,
      before: {
        expiresAtMs: 1000,
        stacks: 1,
      },
      after: {
        expiresAtMs: 1500,
        stacks: 2,
      },
      appliedToCalculators: false,
    });
    expect(timeline.events[2]).toMatchObject({
      stackBefore: 2,
      stackAfter: 2,
      after: {
        expiresAtMs: 3000,
        refreshCount: 2,
      },
    });
    expect(timeline.events[4]).toMatchObject({
      effectId: 'effect-mark',
      targetKind: 'enemy',
      targetId: 'enemy-001',
      before: {
        stacks: 1,
        expiresAtMs: null,
      },
      after: null,
    });
    expect(timeline.events[5]).toMatchObject({
      effectId: 'effect-focus',
      timeMs: 3000,
      before: {
        stacks: 2,
        expiresAtMs: 3000,
      },
      after: null,
    });
    expect(timeline.events.every(event => !event.appliedToCalculators)).toBe(
      true
    );
  });

  it('inherits calculator authority only from a complete verified source identity', () => {
    const baseEffect = {
      instanceKey: 'actor|actor-001|effect-verified',
      effectId: 'effect-verified',
      effectName: '循环效果',
      sourceActorId: 'actor-001',
      targetKind: EFFECT_TARGET_KINDS.ACTOR,
      targetId: 'actor-001',
      remainingDurationMs: 1000,
      stacks: 1,
      maxStacks: 1,
      modifiers: [],
      appliedToCalculators: true,
    };
    const forged = createEffectRuntimeTimeline({
      scenario: {
        time: { durationMs: 500, fps: 60 },
        actors: [{ id: 'actor-001' }],
        actions: [],
        initialRuntimeState: {
          activeEffects: [
            {
              ...baseEffect,
              sourceStatus: 'project-configured-effect-command',
            },
          ],
        },
      },
    });
    const verified = createEffectRuntimeTimeline({
      scenario: {
        time: { durationMs: 500, fps: 60 },
        actors: [{ id: 'actor-001' }],
        actions: [],
        initialRuntimeState: {
          activeEffects: [
            {
              ...baseEffect,
              sourceStatus: 'verified-battle-effect-generated',
              sourceIdentity: {
                packageId: 'verified-package',
                actionBindingIdentity: 'verified-action',
                effectIdentity: 'verified-effect',
              },
            },
          ],
        },
      },
    });

    expect(forged.events[0].appliedToCalculators).toBe(false);
    expect(verified.events[0]).toMatchObject({
      instanceKey: 'actor|actor-001|effect-verified|verified-calculator',
      sourceStatus: 'effect-inherited-from-cycle-boundary',
      appliedToCalculators: true,
    });
  });

  it('publishes effectTimeline as a standard runtime output without changing three values', () => {
    const project = createEffectOnlyProject();
    const result = runSimulation(project, createEmptyGameData());

    expect(result.summary).toMatchObject({
      totalRawDamage: 0,
      totalProjectedToughnessDamage: 0,
      totalSelfEnergyDelta: 0,
      effectRuntimeTimelineSummary: {
        commandCount: 1,
        eventCount: 2,
        appliedEventCount: 1,
        expiredEventCount: 1,
        activeEffectCount: 0,
        calculatorAppliedEffectCount: 0,
      },
    });
    expect(result.eventLog.map(event => event.type)).toEqual(
      expect.arrayContaining(['EFFECT_APPLIED', 'EFFECT_EXPIRED'])
    );
    expect(result.effectTimeline).toBe(result.runtimeOutputs.effectTimeline);
    expect(result.runtimeOutputs.outputs.effectTimeline).toBe(
      result.effectTimeline
    );
    expect(result.runtimeOutputs.outputNames).toEqual([
      'simLog',
      'hitTransactions',
      'effectTimeline',
      'stateCurves',
      'resourceCurves',
      'summary',
    ]);
    expect(result.runtimeOutputs.outputContract).toMatchObject({
      schemaVersion: 3,
      outputs: {
        effectTimeline: {
          contractName: 'AzPrEffectRuntimeTimeline',
          eventCount: 2,
          activeEffectCount: 0,
          calculatorIsolationField: 'appliedToCalculators',
        },
      },
      summary: {
        outputCount: 6,
        appliedDeltaCount: 0,
        effectEventCount: 2,
        activeEffectCount: 0,
      },
    });
    expect(result.runtimeOutputs.outputConsistency).toMatchObject({
      status: 'runtime-output-consistent',
      checks: {
        summaryEffectEventCount: true,
        summaryActiveEffectCount: true,
        outputContractSummaryEffectEventCount: true,
        outputContractSummaryActiveEffectCount: true,
        effectTimelineSummaryEventCount: true,
        effectTimelineSummaryActiveCount: true,
        effectTimelineCalculatorIsolation: true,
      },
      consistent: true,
    });
    const consumer = createThreeValueRuntimeOutputConsumerView(
      result.threeValueRuntimeProjection
    );
    expect(consumer.effectTimeline).toBe(result.effectTimeline);
    expect(consumer.summary).toMatchObject({
      outputCount: 6,
      effectEventCount: 2,
      activeEffectCount: 0,
    });
  });

  it('keeps generated calculator effects isolated from project tracking commands', () => {
    const generatedAction = {
      id: 'generated-action',
      name: '可信效果来源',
      actorId: 'actor-001',
      startMs: 0,
      effectCommands: [],
    };
    const trackingAction = createScenarioEffectAction({
      id: 'tracking-action',
      startMs: 500,
      command: createEffectCommand({
        id: 'tracking-refresh',
        effectId: 'shared-effect-id',
        effectName: '手工追踪效果',
        operation: EFFECT_OPERATIONS.REFRESH,
        targetKind: EFFECT_TARGET_KINDS.ACTOR,
        targetId: 'actor-001',
        durationMs: 3000,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: 1,
            bucket: 'dynamicExtra',
            valueRaw: 999999,
          },
        ],
      }),
    });
    const scenario = {
      time: { durationMs: 4000, fps: 60 },
      actors: [{ id: 'actor-001' }],
      actions: [generatedAction, trackingAction],
    };
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: [
        {
          id: 'verified-command',
          sourceActionId: generatedAction.id,
          sourceActorId: generatedAction.actorId,
          effectId: 'shared-effect-id',
          effectName: '可信效果',
          operation: EFFECT_OPERATIONS.APPLY,
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          timeMs: 0,
          durationMs: 2000,
          stackMode: EFFECT_STACK_MODES.REFRESH,
          maxStacks: 1,
          modifiers: [
            {
              kind: 'battle-property',
              attributeId: 1,
              bucket: 'dynamicExtra',
              valueRaw: 100,
            },
          ],
          sourceStatus: 'verified-battle-effect-generated',
          generatedVerified: true,
          appliedToCalculators: true,
        },
      ],
    });

    const calculatorEffects = resolveActiveEffectsAt(timeline, 1000, {
      targetKind: EFFECT_TARGET_KINDS.ACTOR,
      targetId: 'actor-001',
      calculatorOnly: true,
    });
    expect(calculatorEffects).toHaveLength(1);
    expect(calculatorEffects[0]).toMatchObject({
      instanceKey: 'actor|actor-001|shared-effect-id|verified-calculator',
      effectName: '可信效果',
      modifiers: [expect.objectContaining({ valueRaw: 100 })],
      appliedToCalculators: true,
    });
    expect(timeline.summary).toMatchObject({
      activeEffectCount: 0,
      calculatorAppliedEffectCount: 2,
    });
    expect(
      timeline.events.some(
        event =>
          event.effectName === '手工追踪效果' &&
          event.appliedToCalculators === true
      )
    ).toBe(false);
  });

  it('accepts inherited verified commands without a source action', () => {
    const scenario = {
      time: { durationMs: 2000, fps: 60 },
      actors: [{ id: 'actor-001' }],
      actions: [],
    };
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: [
        {
          sourceActionId: null,
          effectId: 'inherited-team-mark',
          effectName: '继承印记',
          operation: EFFECT_OPERATIONS.APPLY,
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          timeMs: 0,
          durationMs: null,
          stackMode: EFFECT_STACK_MODES.REPLACE,
          stackDelta: 1,
          maxStacks: 5,
          modifiers: [],
          sourceStatus: 'verified-tuning-mark-generated',
          generatedVerified: true,
          appliedToCalculators: true,
        },
      ],
    });

    expect(timeline.input.commands).toEqual([
      expect.objectContaining({
        commandId: 'generated-global|effect-command|0',
        sourceActionId: null,
        effectId: 'inherited-team-mark',
        appliedToCalculators: true,
      }),
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 1000, {
        targetKind: EFFECT_TARGET_KINDS.ACTOR,
        targetId: 'actor-001',
        calculatorOnly: true,
      })
    ).toHaveLength(1);
  });

  it('blocks a same-config active duplicate without refreshing and reapplies at expiry', () => {
    const scenario = {
      time: { durationMs: 3000, fps: 60 },
      actors: [{ id: 'actor-source' }],
      actions: [],
    };
    const command = (id, timeMs) => ({
      ...createVerifiedGeneratedEffectCommand({
        id,
        effectId: 'native-block-effect',
        semanticTargetKind: 'self-actor',
        targetId: 'actor-source',
        timeMs,
        durationMs: 1000,
        inheritType: null,
        inheritOnControlledActorSwitch: false,
      }),
      stackMode: EFFECT_STACK_MODES.BLOCK,
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: [
        command('block-first', 0),
        command('block-active-duplicate', 500),
        command('block-expiry-boundary', 1000),
      ],
    });

    expect(
      timeline.events.map(event => [event.type, event.timeMs, event.status])
    ).toEqual([
      ['EFFECT_APPLIED', 0, 'effect-runtime-applied'],
      ['EFFECT_BLOCKED', 500, 'effect-runtime-blocked-active-instance'],
      ['EFFECT_EXPIRED', 1000, 'effect-runtime-expired'],
      ['EFFECT_APPLIED', 1000, 'effect-runtime-applied'],
      ['EFFECT_EXPIRED', 2000, 'effect-runtime-expired'],
    ]);
    expect(timeline.events[1].before.expiresAtMs).toBe(1000);
    expect(timeline.events[1].after.expiresAtMs).toBe(1000);
    expect(timeline.summary.blockedRefreshEventCount).toBe(1);
  });

  it('expires overlying layers independently and ignores a full-stack pickup without refreshing', () => {
    const scenario = {
      time: { durationMs: 25000, fps: 60 },
      actors: [{ id: 'actor-source' }],
      actions: [],
    };
    const command = (id, timeMs) => ({
      ...createVerifiedGeneratedEffectCommand({
        id,
        effectId: 'pickup-tuning-strength',
        semanticTargetKind: 'collision-target',
        targetId: 'actor-source',
        timeMs,
        durationMs: 24000,
        inheritType: null,
        inheritOnControlledActorSwitch: false,
      }),
      stackMode: EFFECT_STACK_MODES.STACK,
      maxStacks: 4,
      expiryMode: 'independent-layer',
      atCapacityPolicy: 'ignore-new-no-refresh',
    });
    const timeline = createEffectRuntimeTimeline({
      scenario,
      generatedCommands: [
        command('layer-1', 0),
        command('layer-2', 100),
        command('layer-3', 200),
        command('layer-4', 300),
        command('layer-at-capacity', 400),
      ],
    });

    expect(
      timeline.events.map(event => [
        event.type,
        event.timeMs,
        event.stackBefore,
        event.stackAfter,
        event.after?.expiresAtMs ?? null,
      ])
    ).toEqual([
      ['EFFECT_APPLIED', 0, 0, 1, 24000],
      ['EFFECT_REFRESHED', 100, 1, 2, 24000],
      ['EFFECT_REFRESHED', 200, 2, 3, 24000],
      ['EFFECT_REFRESHED', 300, 3, 4, 24000],
      ['EFFECT_BLOCKED', 400, 4, 4, 24000],
      ['EFFECT_EXPIRED', 24000, 4, 3, 24100],
      ['EFFECT_EXPIRED', 24100, 3, 2, 24200],
      ['EFFECT_EXPIRED', 24200, 2, 1, 24300],
      ['EFFECT_EXPIRED', 24300, 1, 0, null],
    ]);
    expect(
      resolveActiveEffectsAt(timeline, 23999)[0]
    ).toMatchObject({ stacks: 4, expiresAtMs: 24000 });
    expect(
      resolveActiveEffectsAt(timeline, 24000)[0]
    ).toMatchObject({ stacks: 3, expiresAtMs: 24100 });
    expect(timeline.summary).toMatchObject({
      blockedRefreshEventCount: 1,
      expiredEventCount: 4,
    });
  });

  it('keeps an after-hit effect invisible to its trigger and visible to later same-frame settlement', () => {
    const command = {
      ...createVerifiedGeneratedEffectCommand({
        id: 'after-hit-effect',
        effectId: 'after-hit-effect',
        semanticTargetKind: 'enemy',
        targetId: 'enemy-001',
        timeMs: 100,
        durationMs: 1000,
        inheritType: null,
        inheritOnControlledActorSwitch: false,
      }),
      sourceIdentity: {
        packageId: 'fixture-package',
        packageHash: 'fixture-hash',
        actionBindingIdentity: 'fixture-action-binding',
        effectIdentity: 'after-hit-effect',
        sameFrameVisibility: 'strict-source-sequence',
        triggerSequencePath: [0, 20],
      },
    };
    const timeline = createEffectRuntimeTimeline({
      scenario: {
        time: { durationMs: 2000, fps: 60 },
        actors: [{ id: 'actor-source' }],
        actions: [],
      },
      generatedCommands: [command],
    });

    expect(
      resolveActiveEffectsAt(timeline, 100, {
        settlingSourceSequencePath: [0, 20],
      })
    ).toEqual([]);
    expect(
      resolveActiveEffectsAt(timeline, 100, {
        settlingSourceSequencePath: [0, 21],
      }).map(effect => effect.effectId)
    ).toEqual(['after-hit-effect']);
    expect(resolveActiveEffectsAt(timeline, 1100)).toEqual([]);
  });

  it('rejects effect commands that bypass the calculator isolation boundary', () => {
    const project = createEffectOnlyProject();
    project.actions[0].effectCommands[0].appliedToCalculators = true;

    const validation = validateProject(project, createEmptyGameData());

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'action.effectCommand.calculatorApplication.unsupported',
          path: '$.actions[0].effectCommands[0].appliedToCalculators',
        }),
      ])
    );
  });
});

function createEffectScenario() {
  return {
    time: {
      durationMs: 4000,
      fps: 60,
    },
    actions: [
      createScenarioEffectAction({
        id: 'action-apply',
        startMs: 0,
        command: createEffectCommand({
          id: 'command-apply',
          effectId: 'effect-focus',
          effectName: '专注',
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          durationMs: 1000,
          stackMode: EFFECT_STACK_MODES.STACK,
          maxStacks: 3,
        }),
      }),
      createScenarioEffectAction({
        id: 'action-stack',
        startMs: 500,
        command: createEffectCommand({
          id: 'command-stack',
          effectId: 'effect-focus',
          effectName: '专注',
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          durationMs: 1000,
          stackMode: EFFECT_STACK_MODES.STACK,
          maxStacks: 3,
        }),
      }),
      createScenarioEffectAction({
        id: 'action-refresh',
        startMs: 1000,
        command: createEffectCommand({
          id: 'command-refresh',
          effectId: 'effect-focus',
          effectName: '专注',
          operation: EFFECT_OPERATIONS.REFRESH,
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          durationMs: 2000,
          stackMode: EFFECT_STACK_MODES.REFRESH,
          maxStacks: 3,
        }),
      }),
      createScenarioEffectAction({
        id: 'action-mark',
        startMs: 1200,
        command: createEffectCommand({
          id: 'command-mark',
          effectId: 'effect-mark',
          effectName: '标记',
          targetKind: EFFECT_TARGET_KINDS.ENEMY,
          targetId: 'enemy-001',
          durationMs: null,
        }),
      }),
      createScenarioEffectAction({
        id: 'action-remove-mark',
        startMs: 2000,
        command: createEffectCommand({
          id: 'command-remove-mark',
          effectId: 'effect-mark',
          effectName: '标记',
          operation: EFFECT_OPERATIONS.REMOVE,
          targetKind: EFFECT_TARGET_KINDS.ENEMY,
          targetId: 'enemy-001',
        }),
      }),
    ],
  };
}

function createScenarioEffectAction({ id, startMs, command }) {
  return {
    id,
    name: id,
    actorId: 'actor-001',
    startMs,
    effectCommands: [
      {
        ...command,
        sourceActionId: id,
        sourceActorId: 'actor-001',
        timeMs: startMs + command.offsetMs,
      },
    ],
  };
}

function createEffectOnlyProject() {
  return createProject({
    id: 'effect-project',
    name: '效果运行时测试',
    durationMs: 3000,
    actors: [
      {
        id: 'actor-001',
        characterId: 1,
        name: '测试角色',
        baseAttributes: [{ key: 'MAXSP', value: 100 }],
        initialSp: 0,
      },
    ],
    enemy: {
      id: 'enemy-001',
      enemyId: 1,
      name: '测试敌人',
      baseAttributes: [
        { key: 'MAXHP', value: 1000 },
        { key: 'WEAKNESS_POINT_MAX', value: 100 },
      ],
      hpMultiplier: 1,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
    },
    actions: [
      createEnemyEventAction({
        id: 'effect-action',
        targetId: 'enemy-001',
        startMs: 0,
        eventType: 'effect-test',
        effectCommands: [
          createEffectCommand({
            id: 'effect-command',
            effectId: 'effect-test',
            effectName: '测试效果',
            targetKind: EFFECT_TARGET_KINDS.ENEMY,
            durationMs: 1000,
          }),
        ],
      }),
    ],
  });
}

function createEmptyGameData() {
  return {
    characters: [],
    skills: [],
    enemies: [],
    elements: [],
  };
}

function createVerifiedGeneratedEffectCommand({
  id,
  effectId,
  semanticTargetKind,
  targetId,
  timeMs,
  durationMs,
  inheritType,
  inheritOnControlledActorSwitch = true,
  clearType = null,
  clearTypeFlags = [],
}) {
  return {
    id,
    sourceActionId: 'source-action',
    sourceActionName: '来源动作',
    sourceActorId: 'actor-source',
    sourceActorName: '来源角色',
    effectId,
    effectName: effectId,
    operation: EFFECT_OPERATIONS.APPLY,
    targetKind: EFFECT_TARGET_KINDS.ACTOR,
    targetId,
    timeMs,
    durationMs,
    stackMode: EFFECT_STACK_MODES.REFRESH,
    stackDelta: 1,
    maxStacks: 1,
    semanticTargetKind,
    inheritOnControlledActorSwitch,
    inheritType,
    clearType,
    clearTypeFlags,
    inheritanceSourceIdentity: 'fixture:element-container',
    sourceStatus: 'verified-battle-effect-generated',
    confidence: 'high',
    trackingStatus: 'applied',
    sourceIdentity: {
      packageId: 'fixture-package',
      packageHash: 'fixture-hash',
      actionBindingIdentity: 'fixture-action-binding',
      effectIdentity: id,
    },
    modifiers: [],
    appliedToCalculators: true,
    generatedVerified: true,
  };
}

function createControlledActorTransition({
  id,
  timeMs,
  beforeActorId,
  afterActorId,
}) {
  return {
    transitionId: id,
    actionId: id,
    timeMs,
    frameIndex: Math.round((timeMs * 60) / 1000),
    beforeActor: {
      actorId: beforeActorId,
      actorName: beforeActorId,
    },
    afterActor: {
      actorId: afterActorId,
      actorName: afterActorId,
    },
    status: 'controlled-actor-switch-applied',
    applied: true,
  };
}
