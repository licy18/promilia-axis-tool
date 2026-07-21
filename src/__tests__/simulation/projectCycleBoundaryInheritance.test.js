import { describe, expect, it } from 'vitest';
import {
  createInitialRuntimeStateAtBoundary,
  projectCycleBoundaryInheritance,
} from '../../simulation/projection/projectCycleBoundaryInheritance';

describe('cycle boundary inheritance projection', () => {
  it('shifts downstream actions and inherits runtime state before the boundary', () => {
    const projection = projectCycleBoundaryInheritance({
      draft: createDraft(),
      scenario: createScenario(),
      runtimeOutputs: createRuntimeOutputs(),
      boundaryId: 'boundary-1',
      sourceScenarioId: 'scenario-0001',
      sourceScenarioName: '爆发轴',
    });

    expect(projection).toMatchObject({
      contractName: 'AzPrCycleBoundaryInheritanceProjection',
      status: 'cycle-boundary-inheritance-ready',
      summary: {
        retainedActionCount: 2,
        retainedRelationCount: 1,
        shiftedBoundaryCount: 1,
        inheritedEnergyActorCount: 1,
        inheritedKiboEnergyCount: 1,
        inheritedControlledActorId: 'actor-2',
        inheritedEffectCount: 1,
        inheritedTuningMarkLayerCount: 2,
        inheritedSpecialResourceCount: 1,
        clearedRuntimeSampleCaptureCount: 1,
      },
      applied: true,
    });
    expect(
      projection.draft.actionDrafts.map(action => [action.id, action.startMs])
    ).toEqual([
      ['action-boundary', 0],
      ['action-after', 1000],
    ]);
    expect(projection.draft.actionRelations).toHaveLength(1);
    expect(projection.draft.cycleBoundaries).toEqual([
      { id: 'boundary-2', timeMs: 1500 },
    ]);
    expect(projection.draft.runtimeSampleCaptures).toEqual([]);
    expect(projection.draft.selectedActionId).toBe('action-boundary');
    expect(projection.draft.actorConfigs[0].initialSp).toBe(25);
    expect(projection.initialRuntimeState).toMatchObject({
      source: {
        sourceScenarioId: 'scenario-0001',
        boundaryId: 'boundary-1',
        boundaryTimeMs: 1000,
      },
      enemy: {
        hp: { currentValue: 900, maxValue: 1000 },
        toughness: { currentValue: 40, maxValue: 100 },
        inBreak: true,
        breakElapsedMs: 500,
        recoveryDelayRemainingMs: 0,
        valueShields: [{ value: 25 }],
        lastToughnessSourceActionId: 'action-before',
        lastToughnessBindingIdentity: 'actor|101|1001|0|1003',
      },
      selfEnergyByActor: [{ actorId: 'actor-1', currentValue: 25 }],
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          kiboId: 500469,
          currentValue: 0.5,
          maxValue: 1,
        },
      ],
      controlledActor: { actorId: 'actor-2', characterId: 102 },
      activeEffects: [
        {
          effectId: 'focus',
          remainingDurationMs: 500,
          stacks: 2,
        },
      ],
      tuningMarks: [
        {
          markId: 150,
          profileKey: 'fire',
          heldReadyRemainingMs: 4700,
          layers: [
            { remainingDurationMs: 19000 },
            { remainingDurationMs: 19500 },
          ],
        },
      ],
      specialResourcesByActor: [
        {
          actorId: 'actor-1',
          characterId: 101,
          resourceIdentity: 'actor:101:element:100047',
          resourceName: '角色资源',
          currentValue: 6,
          maxValue: 12,
          activeStates: [
            {
              elementId: 100129,
              remainingDurationMs: 1600,
              sourceActionId: 'action-before',
            },
          ],
        },
      ],
    });
  });

  it('keeps events on the boundary in the new section while applying boundary expiry', () => {
    const state = createInitialRuntimeStateAtBoundary({
      scenario: createScenario(),
      runtimeOutputs: createRuntimeOutputs(),
      boundary: { id: 'boundary-1', timeMs: 1000 },
    });

    expect(state.enemy.hp.currentValue).toBe(900);
    expect(state.enemy.toughness.currentValue).toBe(40);
    expect(state.enemy.breakElapsedMs).toBe(500);
    expect(state.selfEnergyByActor[0].currentValue).toBe(25);
    expect(state.kiboEnergyBySlot[0].currentValue).toBe(0.5);
    expect(state.activeEffects.map(effect => effect.effectId)).toEqual([
      'focus',
    ]);
  });

  it('does not create an empty scenario after the last action', () => {
    const result = projectCycleBoundaryInheritance({
      draft: createDraft(),
      scenario: {
        ...createScenario(),
        cycleBoundaries: [{ id: 'boundary-last', timeMs: 4000 }],
      },
      runtimeOutputs: createRuntimeOutputs(),
      boundaryId: 'boundary-last',
    });

    expect(result.status).toBe(
      'cycle-boundary-inheritance-no-downstream-actions'
    );
    expect(result.draft).toBeNull();
    expect(result.applied).toBe(false);
  });
});

function createDraft() {
  return {
    selection: { characterId: 101 },
    actorConfigs: [{ characterId: 101, initialSp: 0 }],
    actionDrafts: [
      { id: 'action-before', startMs: 500 },
      { id: 'action-boundary', startMs: 1000 },
      { id: 'action-after', startMs: 2000 },
    ],
    actionRelations: [
      {
        id: 'relation-before',
        fromActionId: 'action-before',
        toActionId: 'action-boundary',
      },
      {
        id: 'relation-after',
        fromActionId: 'action-boundary',
        toActionId: 'action-after',
      },
    ],
    cycleBoundaries: [
      { id: 'boundary-1', timeMs: 1000 },
      { id: 'boundary-2', timeMs: 2500 },
    ],
    runtimeSampleCaptures: [{ id: 'capture-1' }],
    selectedActionId: 'action-before',
  };
}

function createScenario() {
  return {
    time: { durationMs: 5000, fps: 60 },
    enemy: { id: 'enemy-1' },
    actors: [
      { id: 'actor-1', characterId: 101, name: '末音' },
      { id: 'actor-2', characterId: 102, name: '寒悠悠' },
    ],
    cycleBoundaries: [
      { id: 'boundary-1', timeMs: 1000 },
      { id: 'boundary-2', timeMs: 2500 },
    ],
  };
}

function createRuntimeOutputs() {
  const focusState = {
    active: true,
    instanceKey: 'actor|actor-1|focus',
    effectId: 'focus',
    effectName: '专注',
    targetKind: 'actor',
    targetId: 'actor-1',
    expiresAtMs: 1500,
    stacks: 2,
    maxStacks: 3,
    refreshCount: 1,
    revision: 2,
    tags: [],
    modifiers: [],
  };
  const expiredState = {
    ...focusState,
    instanceKey: 'actor|actor-1|expired',
    effectId: 'expired',
    expiresAtMs: 1000,
  };
  const boundaryAppliedState = {
    ...focusState,
    instanceKey: 'actor|actor-1|boundary',
    effectId: 'boundary',
    expiresAtMs: 2000,
  };
  return {
    controlledActorTimeline: {
      initialActor: {
        actorId: 'actor-1',
        characterId: 101,
        actorName: '末音',
      },
      transitions: [
        {
          transitionId: 'controlled-actor-transition-switch-1',
          actionId: 'switch-1',
          timeMs: 750,
          applied: true,
          afterActor: {
            actorId: 'actor-2',
            characterId: 102,
            actorName: '寒悠悠',
          },
        },
      ],
    },
    stateSnapshots: {
      baseline: {
        enemy: {
          hp: { initialValue: 1000, maxValue: 1000 },
          toughness: { initialValue: 100, maxValue: 100 },
        },
        selfEnergyByActor: [
          {
            actorId: 'actor-1',
            baseline: { initialValue: 10, maxValue: 100 },
          },
        ],
      },
      snapshots: [
        {
          timeMs: 500,
          runtimeSequenceIndex: 0,
          energyOwnerActorId: 'actor-1',
          after: {
            enemyHp: { currentValue: 900, maxValue: 1000 },
            enemyToughness: { currentValue: 80, maxValue: 100 },
            selfEnergy: { currentValue: 25, maxValue: 100 },
          },
        },
        {
          timeMs: 1000,
          runtimeSequenceIndex: 1,
          energyOwnerActorId: 'actor-1',
          after: {
            enemyHp: { currentValue: 700, maxValue: 1000 },
            enemyToughness: { currentValue: 50, maxValue: 100 },
            selfEnergy: { currentValue: 40, maxValue: 100 },
          },
        },
      ],
    },
    resourceCurves: {
      curvesByKibo: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-1',
          characterId: 101,
          kiboId: 500469,
          kiboName: '重岩蹄',
          baseline: { initialValue: 0, maxValue: 1 },
          points: [
            {
              timeMs: 500,
              stateSnapshot: {
                after: { kiboEnergy: { currentValue: 0.5, maxValue: 1 } },
              },
            },
            {
              timeMs: 1000,
              stateSnapshot: {
                after: { kiboEnergy: { currentValue: 0.75, maxValue: 1 } },
              },
            },
          ],
        },
      ],
    },
    effectTimeline: {
      events: [
        {
          type: 'EFFECT_APPLIED',
          timeMs: 100,
          runtimeSequenceIndex: 0,
          instanceKey: focusState.instanceKey,
          after: focusState,
        },
        {
          type: 'EFFECT_APPLIED',
          timeMs: 200,
          runtimeSequenceIndex: 1,
          instanceKey: expiredState.instanceKey,
          after: expiredState,
        },
        {
          type: 'EFFECT_EXPIRED',
          timeMs: 1000,
          runtimeSequenceIndex: 2,
          instanceKey: expiredState.instanceKey,
          after: null,
        },
        {
          type: 'EFFECT_APPLIED',
          timeMs: 1000,
          runtimeSequenceIndex: 3,
          instanceKey: boundaryAppliedState.instanceKey,
          after: boundaryAppliedState,
        },
      ],
    },
    verifiedCombatRuntime: {
      ready: true,
      initialState: {
        enemy: {
          enemyId: 300032,
          hp: 1000,
          maxHp: 1000,
          toughness: 100,
          maxToughness: 100,
          inBreak: false,
          breakElapsedMs: 0,
          recoveryDelayRemainingMs: 0,
          valueShields: [{ value: 50 }],
          hitCountShields: [],
          profileSourceIdentity: 'enemy-profile-1',
        },
      },
      damageEvents: [
        {
          timeMs: 500,
          hitKey: 'break-hit',
          payload: {
            enemyProfileSourceIdentity: 'enemy-profile-1',
            stateTransaction: {
              after: {
                hp: 900,
                toughness: 0,
                inBreak: true,
                breakStartedAtMs: 500,
                normalRecoveryEligibleAtMs: null,
                lastToughnessSourceActionId: 'action-before',
                lastToughnessSourceActorId: 'actor-1',
                lastToughnessBindingIdentity: 'actor|101|1001|0|1003',
                valueShields: [{ value: 25 }],
                hitCountShields: [],
              },
            },
          },
        },
        {
          timeMs: 900,
          hitKey: 'break-recovery',
          payload: {
            enemyProfileSourceIdentity: 'enemy-profile-1',
            stateTransaction: {
              after: {
                hp: 900,
                toughness: 40,
                inBreak: true,
                breakStartedAtMs: 500,
                normalRecoveryEligibleAtMs: null,
                lastToughnessSourceActionId: 'action-before',
                lastToughnessSourceActorId: 'actor-1',
                lastToughnessBindingIdentity: 'actor|101|1001|0|1003',
                valueShields: [{ value: 25 }],
                hitCountShields: [],
              },
            },
          },
        },
        {
          timeMs: 1000,
          hitKey: 'boundary-event',
          payload: {
            stateTransaction: {
              after: {
                hp: 700,
                toughness: 100,
                inBreak: false,
              },
            },
          },
        },
      ],
      tuningMarkRuntime: {
        initialState: [
          {
            markId: 150,
            profileKey: 'fire',
            elementName: '火',
            heldReadyRemainingMs: 0,
            layers: [
              {
                remainingDurationMs: 20000,
                sourceActionId: 'initial-fire',
                sourceActorId: 'actor-1',
                sourceIdentity: { source: 'initial-fire' },
              },
            ],
          },
        ],
        events: [
          {
            kind: 'acquire',
            timeMs: 500,
            markId: 150,
            actionId: 'action-before',
            actorId: 'actor-1',
            layerIds: ['fire-layer-2'],
            sourceIdentity: { source: 'action-before' },
          },
          {
            kind: 'held-trigger',
            timeMs: 700,
            markId: 150,
            heldReadyAtMs: 5700,
            layerIds: [],
          },
        ],
      },
      specialResourceRuntime: {
        ready: true,
        curves: [
          {
            actorId: 'actor-1',
            characterId: 101,
            actorName: '末音',
            resourceIdentity: 'actor:101:element:100047',
            resourceName: '角色资源',
            initialValue: 0,
            maxValue: 12,
            points: [
              { timeMs: 500, afterValue: 6 },
              { timeMs: 1000, afterValue: 12 },
            ],
          },
        ],
        stateEvents: [
          {
            timeMs: 600,
            runtimeSequenceIndex: 0,
            actorId: 'actor-1',
            actionId: 'action-before',
            payload: {
              operation: 'transform',
              stateElementId: 100129,
              stateName: '强化状态',
              stateDurationMs: 2000,
              sourceIdentity: 'battle-element:100129',
            },
          },
        ],
      },
    },
  };
}
