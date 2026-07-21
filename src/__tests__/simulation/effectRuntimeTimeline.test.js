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
