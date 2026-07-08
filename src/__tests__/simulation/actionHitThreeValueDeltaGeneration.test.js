import { describe, expect, it } from 'vitest';
import { createActionHitThreeValueDeltaGeneration } from '../../simulation/generation/actionHitThreeValueDeltaGeneration';

describe('Action -> Hit -> ThreeValueDelta generation entry', () => {
  it('exposes the standard generation contract as the generation entry', () => {
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
            confidence: 'unit-test',
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

    expect(generation).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
      status: 'action-hit-three-value-delta-generation-ready',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      summary: {
        generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
        generationLayerStatus: 'standard-three-value-generation-layer-ready',
        standardContractSourceKind:
          'azpr-action-hit-three-value-delta-standard-contract',
        standardContractStatus: 'action-hit-three-value-delta-contract-ready',
        topology: ['Action', 'Hit', 'ThreeValueDelta'],
        deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
        runtimeDeltaPolicy: 'runtime consumes only deltas with applied=true',
        actionCount: 1,
        deltaCount: 3,
        appliedDeltaCount: 1,
        placeholderDeltaCount: 2,
      },
    });
    expect(generation.standardContract).toBe(
      generation.threeValueGenerationLayer.standardContract
    );
    expect(generation.actions).toBe(generation.standardContract.actions);
    expect(generation.hits).toBe(generation.standardContract.hits);
    expect(generation.deltas).toBe(generation.standardContract.deltas);
    expect(generation.deltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'action-001',
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          hpDelta: 1200,
          toughnessDelta: null,
          energyDelta: null,
          applied: true,
        }),
        expect.objectContaining({
          actionId: 'action-001',
          trackKey: 'enemyToughnessDamage',
          layerKey: 'placeholder',
          toughnessDelta: 0,
          applied: false,
        }),
        expect.objectContaining({
          actionId: 'action-001',
          trackKey: 'selfEnergyChange',
          layerKey: 'placeholder',
          energyDelta: 0,
          applied: false,
        }),
      ])
    );
  });
});
