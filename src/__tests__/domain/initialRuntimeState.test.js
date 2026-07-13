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
        },
      ],
    });

    expect(state).toMatchObject({
      schemaVersion: 2,
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
      },
      selfEnergyByActor: [
        { actorId: 'actor-1', characterId: 101, currentValue: 35 },
      ],
      activeEffects: [
        {
          instanceKey: 'actor|actor-1|focus',
          remainingDurationMs: 750,
          stacks: 2,
          tags: ['buff'],
          appliedToCalculators: false,
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
      schemaVersion: 2,
      status: 'initial-runtime-state-ready',
      controlledActor: {
        actorId: 'actor-2',
        characterId: 102,
        actorName: '寒悠悠',
        baselineStatus: 'baseline-project-initial-controlled-actor',
      },
      enemy: null,
      selfEnergyByActor: [],
      activeEffects: [],
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
});
