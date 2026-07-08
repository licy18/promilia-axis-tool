import { describe, expect, it } from 'vitest';
import { createThreeValueGenerationBundle } from '../../simulation/generation/threeValueGenerationBuilder';

describe('three value generation builder', () => {
  it('bundles generation layer, standard contract, and runtime input source', () => {
    const bundle = createThreeValueGenerationBundle({
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
            sourceEvidence: {
              status: 'candidate-fields-found',
              matchedElementConfigIds: [109001081],
            },
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
      candidateValueSeries: {
        chart: {
          series: [
            {
              key: 'selfEnergyCandidate',
              unit: 'raw-field',
              points: [
                {
                  actionId: 'action-001',
                  actorId: 'actor-001',
                  actorName: '末音',
                  skillId: 10900101,
                  hitIndex: 1,
                  sequenceIndex: 0,
                  displayFrameIndex: 60,
                  displayTimeMs: 1000,
                  value: 2700,
                  elementConfigIds: [109001081],
                },
              ],
            },
          ],
        },
      },
    });

    expect(bundle).toMatchObject({
      sourceKind: 'azpr-three-value-generation-builder-bundle',
      status: 'three-value-generation-builder-ready',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      summary: {
        generationEntrySourceKind:
          'azpr-action-hit-three-value-delta-generation-entry',
        generationEntryStatus: 'action-hit-three-value-delta-generation-ready',
        generationLayerStatus: 'standard-three-value-generation-layer-ready',
        standardContractStatus: 'action-hit-three-value-delta-contract-ready',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        actionCount: 1,
        hitCount: 3,
        deltaCount: 3,
        appliedDeltaCount: 1,
        candidateDeltaCount: 1,
        placeholderDeltaCount: 1,
      },
    });
    expect(bundle.actionHitThreeValueDeltaGeneration).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      summary: {
        topology: ['Action', 'Hit', 'ThreeValueDelta'],
        deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
      },
    });
    expect(bundle.standardContract).toBe(
      bundle.actionHitThreeValueDeltaGeneration.standardContract
    );
    expect(bundle.standardContract).toBe(
      bundle.threeValueGenerationLayer.standardContract
    );
    expect(bundle.actions).toBe(bundle.standardContract.actions);
    expect(bundle.hits).toBe(bundle.standardContract.hits);
    expect(bundle.deltas).toBe(bundle.standardContract.deltas);
    expect(bundle.runtimeInputSource).toMatchObject({
      sourceKind: 'azpr-runtime-input-source-from-generation-builder',
      status: 'runtime-input-source-ready',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      generationEntrySourceKind:
        'azpr-action-hit-three-value-delta-generation-entry',
      generationEntryStatus: 'action-hit-three-value-delta-generation-ready',
      standardContractSourceKind:
        'azpr-action-hit-three-value-delta-standard-contract',
      summary: {
        actionCount: 1,
        hitCount: 3,
        deltaCount: 3,
        appliedDeltaCount: 1,
        runtimeDeltaPolicy: 'runtime consumes only deltas with applied=true',
      },
    });
    expect(bundle.runtimeInputSource.standardContract).toBe(
      bundle.standardContract
    );
    expect(bundle.runtimeInputSource.deltas).toBe(bundle.deltas);
  });
});
