import { describe, expect, it } from 'vitest';
import { createActionHitThreeValueDeltaGeneration } from '../../simulation/generation/actionHitThreeValueDeltaGeneration';
import {
  ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
  createActionHitThreeValueRuntimeInput,
} from '../../simulation/runtime/actionHitThreeValueRuntimeInput';

describe('Action -> Hit -> ThreeValueDelta runtime input', () => {
  it('normalizes applied standard contract deltas as the runtime input boundary', () => {
    const generation = createActionHitThreeValueDeltaGeneration({
      scenario: {
        actions: [
          {
            id: 'action-001',
            type: 'skill',
            name: '普通攻击',
            actorId: 'actor-001',
            actor: { name: '末音' },
            startMs: 1000,
          },
        ],
      },
      actionResultTimeline: [
        {
          actionId: 'action-001',
          actionName: '普通攻击',
          actionType: 'skill',
          actorId: 'actor-001',
          actorName: '末音',
          skillId: 10900101,
          timeMs: 1000,
          hpDamage: {
            value: 1200,
            applied: true,
            status: 'raw-hp-projection',
          },
          toughnessDamage: {
            value: 0,
            applied: false,
            status: 'placeholder',
          },
          selfEnergyChange: {
            value: 0,
            applied: false,
            status: 'placeholder',
          },
        },
      ],
    });
    const runtimeInput = createActionHitThreeValueRuntimeInput({
      actionHitThreeValueDeltaGeneration: generation,
    });

    expect(runtimeInput).toMatchObject({
      sourceKind:
        'azpr-runtime-input-from-action-hit-three-value-delta-generation',
      status: 'runtime-input-ready-with-applied-deltas',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      appliedDeltaSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
      inputSourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
      inputStatus: 'action-hit-three-value-delta-contract-ready',
      generationEntrySourceKind:
        'azpr-action-hit-three-value-delta-generation-entry',
      generationEntryStatus: 'action-hit-three-value-delta-generation-ready',
      generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
      generationLayerStatus: 'standard-three-value-generation-layer-ready',
      ignoredDeltaCount: 2,
      summary: {
        appliedDeltaSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
        generationEntrySourceKind:
          'azpr-action-hit-three-value-delta-generation-entry',
        generationEntryStatus: 'action-hit-three-value-delta-generation-ready',
        standardContractActionCount: 1,
        standardContractHitCount: 2,
        inputDeltaCount: 3,
        appliedDeltaCount: 1,
        ignoredDeltaCount: 2,
        appliedTrackKeys: ['enemyHpDamage'],
        appliedLayerKeys: ['applied'],
        ignoredLayerCounts: [{ key: 'placeholder', count: 2 }],
        appliedOnly: true,
      },
    });
    expect(runtimeInput.appliedDeltas).toEqual([
      expect.objectContaining({
        actionId: 'action-001',
        trackKey: 'enemyHpDamage',
        layerKey: 'applied',
        runtimeSequenceIndex: 0,
        delta: 1200,
        hpDelta: 1200,
        toughnessDelta: null,
        energyDelta: null,
        applied: true,
      }),
    ]);
  });
});
