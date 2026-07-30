import { describe, expect, it } from 'vitest';
import { normalizeInitialRuntimeState } from '../../domain/initialRuntimeState';

describe('initial runtime state', () => {
  it('normalizes inherited enemy, actor energy, and active effect state', () => {
    const state = normalizeInitialRuntimeState({
      source: {
        sourceScenarioId: 'scenario-0001',
        sourceScenarioName: '方案 1',
        boundaryId: 'cycle-boundary-0001',
        boundaryTimeMs: 1000,
      },
      controlledActor: {
        actorId: 'actor-1',
        characterId: 101,
        actorName: '末音',
      },
      enemy: {
        enemyId: 'enemy-1',
        hp: { currentValue: 850, maxValue: 1000 },
        toughness: { currentValue: 60, maxValue: 100 },
        inBreak: true,
        breakElapsedMs: 450,
        lastToughnessSourceActionId: 'action-break',
        lastToughnessSourceActorId: 'actor-1',
        lastToughnessBindingIdentity: 'actor|101|1001|0|1003',
        profileSourceIdentity: 'enemy-profile-1',
        valueShields: [{ value: 120, outputTypes: [1], elementTypes: [3] }],
        hitCountShields: [{ count: 2, outputTypes: [-1] }],
      },
      selfEnergyByActor: [
        {
          actorId: 'actor-1',
          characterId: 101,
          actorName: '末音',
          currentValue: 35,
          maxValue: 100,
        },
      ],
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-1',
          characterId: 101,
          kiboId: 500469,
          kiboName: '重岩蹄',
          currentValue: 0.75,
          maxValue: 1,
        },
      ],
      actorVitalsByActor: [
        {
          actorId: 'actor-1',
          characterId: 101,
          actorName: '末音',
          currentHp: 750,
          maximumHp: 1000,
          valueShields: [{ value: 50 }],
        },
      ],
      kiboVitalsBySlot: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-1',
          characterId: 101,
          kiboId: 500469,
          kiboName: '重岩蹄',
          currentHp: 300,
          maximumHp: 500,
        },
      ],
      activeEffects: [
        {
          instanceKey: 'actor|actor-1|focus',
          effectId: 'focus',
          effectName: '专注',
          targetKind: 'actor',
          targetId: 'actor-1',
          remainingDurationMs: 750,
          stacks: 2,
          maxStacks: 3,
          tags: ['buff', 'buff'],
          modifiers: [{ key: 'attack', value: 10 }],
          icon: 'focus.png',
          confidence: 'medium',
          trackingStatus: 'unapplied',
          sourceStatus: 'generated-from-action-status-catalog',
          sourceIdentity: { skillId: 10100322, elementConfigId: 101003141 },
        },
      ],
      specialResourcesByActor: [
        {
          actorId: 'actor-1',
          characterId: 101010,
          actorName: '涂山小玉',
          resourceIdentity: 'actor:101010:element:101010115',
          resourceName: '爆发状态叠层',
          currentValue: 32,
          maxValue: 100,
          inputStep: 1,
          scenarioConfigurable: true,
          baselineStatus: 'scenario-configurable-initial-state',
          activeStates: [
            {
              elementId: 101010129,
              name: '爆发状态buff',
              remainingDurationMs: 6400,
              sourceActionId: 'jade-ultimate',
              sourceIdentity: 'battle-element:101010129',
            },
          ],
        },
      ],
    });

    expect(state).toMatchObject({
      schemaVersion: 7,
      contractName: 'AzPrInitialRuntimeState',
      status: 'initial-runtime-state-inherited',
      source: {
        sourceScenarioId: 'scenario-0001',
        boundaryId: 'cycle-boundary-0001',
        boundaryTimeMs: 1000,
      },
      controlledActor: {
        actorId: 'actor-1',
        characterId: 101,
        actorName: '末音',
        baselineStatus: 'baseline-inherited-from-cycle-boundary',
      },
      enemy: {
        hp: {
          currentValue: 850,
          baselineStatus: 'baseline-inherited-from-cycle-boundary',
        },
        toughness: { currentValue: 60 },
        inBreak: true,
        breakElapsedMs: 450,
        recoveryDelayRemainingMs: 0,
        lastToughnessSourceActionId: 'action-break',
        profileSourceIdentity: 'enemy-profile-1',
        valueShields: [{ value: 120 }],
        hitCountShields: [{ count: 2 }],
      },
      selfEnergyByActor: [
        { actorId: 'actor-1', characterId: 101, currentValue: 35 },
      ],
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-1',
          kiboId: 500469,
          currentValue: 0.75,
        },
      ],
      actorVitalsByActor: [
        {
          actorId: 'actor-1',
          characterId: 101,
          currentValue: 750,
          maxValue: 1000,
          valueUnit: 'hp',
          valueShields: [{ value: 50 }],
        },
      ],
      kiboVitalsBySlot: [
        {
          slotId: 'team-slot-1',
          actorId: 'actor-1',
          kiboId: 500469,
          currentValue: 300,
          maxValue: 500,
          valueUnit: 'hp',
        },
      ],
      activeEffects: [
        {
          instanceKey: 'actor|actor-1|focus',
          remainingDurationMs: 750,
          stacks: 2,
          tags: ['buff'],
          icon: 'focus.png',
          confidence: 'medium',
          trackingStatus: 'unapplied',
          originSourceStatus: 'generated-from-action-status-catalog',
          sourceIdentity: { skillId: 10100322, elementConfigId: 101003141 },
          appliedToCalculators: false,
        },
      ],
      specialResourcesByActor: [
        {
          actorId: 'actor-1',
          characterId: 101010,
          resourceIdentity: 'actor:101010:element:101010115',
          currentValue: 32,
          maxValue: 100,
          inputStep: 1,
          scenarioConfigurable: true,
          activeStates: [
            {
              elementId: 101010129,
              remainingDurationMs: 6400,
              sourceActionId: 'jade-ultimate',
            },
          ],
          baselineStatus: 'scenario-configurable-initial-state',
        },
      ],
      applied: true,
    });
  });

  it('creates an explicit project initial controlled actor without three-value state', () => {
    expect(
      normalizeInitialRuntimeState(null, {
        controlledActor: {
          actorId: 'actor-2',
          characterId: 102,
          actorName: '寒悠悠',
        },
      })
    ).toMatchObject({
      schemaVersion: 7,
      status: 'initial-runtime-state-ready',
      controlledActor: {
        actorId: 'actor-2',
        characterId: 102,
        actorName: '寒悠悠',
        baselineStatus: 'baseline-project-initial-controlled-actor',
      },
      enemy: null,
      selfEnergyByActor: [],
      kiboEnergyBySlot: [],
      actorVitalsByActor: [],
      kiboVitalsBySlot: [],
      activeEffects: [],
      specialResourcesByActor: [],
    });
  });

  it('rejects empty state and effects with no remaining duration', () => {
    expect(normalizeInitialRuntimeState({})).toBeNull();
    expect(
      normalizeInitialRuntimeState({
        activeEffects: [
          {
            instanceKey: 'actor|actor-1|expired',
            effectId: 'expired',
            targetId: 'actor-1',
            remainingDurationMs: 0,
          },
        ],
      })
    ).toBeNull();
  });

  it('drops non-positive optional vital maximum snapshots', () => {
    const state = normalizeInitialRuntimeState({
      actorVitalsByActor: [
        { actorId: 'actor-1', currentValue: 10, maxValue: 0 },
      ],
      kiboVitalsBySlot: [
        {
          slotId: 'team-slot-1',
          kiboId: 500469,
          currentValue: 20,
          maximumHp: -1,
        },
      ],
    });

    expect(state.actorVitalsByActor[0]).toMatchObject({
      currentValue: 10,
      maxValue: null,
    });
    expect(state.kiboVitalsBySlot[0]).toMatchObject({
      currentValue: 20,
      maxValue: null,
    });
  });

  it('normalizes one shared tuning decay timer and migrates legacy layer timers', () => {
    const shared = normalizeInitialRuntimeState({
      tuningMarks: [
        {
          markId: 150,
          profileKey: 'fire',
          decayRemainingMs: 12_345,
          heldReadyRemainingMs: 500,
          layers: [{ sourceActionId: 'fire-1' }, { sourceActionId: 'fire-2' }],
        },
      ],
    });
    const legacy = normalizeInitialRuntimeState({
      tuningMarks: [
        {
          markId: 750,
          profileKey: 'wind',
          layers: [
            { remainingDurationMs: 1_000, sourceActionId: 'wind-1' },
            { remainingDurationMs: 1_500, sourceActionId: 'wind-2' },
            { remainingDurationMs: 0, sourceActionId: 'expired' },
          ],
        },
      ],
    });

    expect(shared.tuningMarks).toEqual([
      expect.objectContaining({
        markId: 150,
        decayRemainingMs: 12_345,
        heldReadyRemainingMs: 500,
        layers: [
          expect.objectContaining({ sourceActionId: 'fire-1' }),
          expect.objectContaining({ sourceActionId: 'fire-2' }),
        ],
      }),
    ]);
    expect(shared.tuningMarks[0].layers[0]).not.toHaveProperty(
      'remainingDurationMs'
    );
    expect(legacy.tuningMarks).toEqual([
      expect.objectContaining({
        markId: 750,
        decayRemainingMs: 1_500,
        layers: [
          expect.objectContaining({ sourceActionId: 'wind-1' }),
          expect.objectContaining({ sourceActionId: 'wind-2' }),
        ],
      }),
    ]);
  });
});
