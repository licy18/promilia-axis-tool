import { describe, expect, it } from 'vitest';
import {
  createThreeValueGenerationBundle,
  validateStandardGenerationEntryContract,
} from '../../simulation/generation/threeValueGenerationBuilder';

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
        standardGenerationEntrySourceKind:
          'azpr-action-hit-three-value-delta-standard-generation-entry',
        standardGenerationEntryStatus:
          'action-hit-three-value-delta-standard-generation-entry-ready',
        generationLayerStatus: 'standard-three-value-generation-layer-ready',
        standardContractStatus: 'action-hit-three-value-delta-contract-ready',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        generationInputSourceKind:
          'azpr-action-hit-three-value-delta-generation-input',
        generationInputStatus: 'three-value-delta-generation-input-ready',
        generationInputPointCount: 3,
        generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
        generationOutputsStatus: 'generation-outputs-ready',
        generationOutputsOutputCount: 9,
        actionCount: 1,
        hitCount: 3,
        deltaCount: 3,
        appliedDeltaCount: 1,
        candidateDeltaCount: 1,
        placeholderDeltaCount: 1,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        standardGenerationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        standardGenerationEntryContractValidationIssueCount: 0,
        standardGenerationEntryAggregateValidationStatus:
          'generation-entry-aggregate-valid',
        standardGenerationEntryAggregateValidationIssueCount: 0,
      },
    });
    expect(bundle.actionHitThreeValueDeltaGeneration).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      summary: {
        topology: ['Action', 'Hit', 'ThreeValueDelta'],
        deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
      },
    });
    expect(bundle.standardContract.valueSourceSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'enemyHpDamage:applied',
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          valueField: 'hpDelta',
          deltaCount: 1,
          runtimeEligible: true,
          replaceable: false,
        }),
        expect.objectContaining({
          key: 'selfEnergyChange:candidate',
          trackKey: 'selfEnergyChange',
          layerKey: 'candidate',
          valueField: 'energyDelta',
          deltaCount: 1,
          runtimeEligible: false,
          replaceable: true,
        }),
      ])
    );
    expect(bundle.deltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trackKey: 'enemyHpDamage',
          layerKey: 'applied',
          valueField: 'hpDelta',
          valueSourceKey: 'enemyHpDamage:applied',
          valueSource: expect.objectContaining({
            sourceKind: 'azpr-three-value-delta-value-source',
            key: 'enemyHpDamage:applied',
            valueField: 'hpDelta',
            runtimeEligible: true,
            replaceable: false,
          }),
        }),
      ])
    );
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
    expect(bundle.generationEntry).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-standard-generation-entry',
      status: 'action-hit-three-value-delta-standard-generation-entry-ready',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      generationEntrySourceKind:
        'azpr-action-hit-three-value-delta-generation-entry',
      generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
      standardContractSourceKind:
        'azpr-action-hit-three-value-delta-standard-contract',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      outputNames: [
        'generationInput',
        'standardContract',
        'actions',
        'hits',
        'deltas',
        'valueSourceSlots',
        'runtimeInputSource',
      ],
      contractValidation: {
        sourceKind:
          'azpr-action-hit-three-value-delta-generation-entry-contract-validation',
        status: 'generation-entry-contract-valid',
        issueCount: 0,
        issueKeys: [],
        aggregateValidation: {
          sourceKind:
            'azpr-action-hit-three-value-delta-generation-entry-aggregate-validation',
          status: 'generation-entry-aggregate-valid',
          issueCount: 0,
          issueKeys: [],
          valid: true,
        },
        valid: true,
      },
      summary: {
        actionCount: 1,
        hitCount: 3,
        deltaCount: 3,
        appliedDeltaCount: 1,
        runtimeDeltaPolicy: 'runtime consumes only deltas with applied=true',
        contractValidationStatus: 'generation-entry-contract-valid',
        contractValidationIssueCount: 0,
        aggregateValidationStatus: 'generation-entry-aggregate-valid',
        aggregateValidationIssueCount: 0,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
      },
    });
    expect(bundle.generationEntry.contractValidation.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'standard-contract-deltas-reference',
          status: 'valid',
          valid: true,
        }),
        expect.objectContaining({
          key: 'deltas-linked-to-hits',
          status: 'valid',
          valid: true,
        }),
        expect.objectContaining({
          key: 'deltas-listed-by-hits',
          status: 'valid',
          valid: true,
        }),
        expect.objectContaining({
          key: 'action-aggregate-layer-fields',
          status: 'valid',
          valid: true,
        }),
        expect.objectContaining({
          key: 'hit-aggregate-layer-fields',
          status: 'valid',
          valid: true,
        }),
      ])
    );
    expect(bundle.generationEntry.standardContract).toBe(
      bundle.standardContract
    );
    expect(bundle.generationEntry.runtimeInputSource).toBe(
      bundle.runtimeInputSource
    );
    expect(bundle.generationEntry.deltas).toBe(bundle.deltas);
    expect(bundle.generationOutputs).toMatchObject({
      sourceKind: 'azpr-three-value-generation-outputs',
      status: 'generation-outputs-ready',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      outputNames: [
        'generationEntry',
        'generationInput',
        'standardContract',
        'actions',
        'hits',
        'deltas',
        'valueSourceSlots',
        'runtimeInputSource',
        'runtimeInput',
      ],
      outputAliases: {
        actionHitThreeValueDeltaGeneration: 'generationEntry',
        runtimeInput: 'runtimeInputSource',
      },
      summary: {
        outputCount: 9,
        actionCount: 1,
        hitCount: 3,
        deltaCount: 3,
        appliedDeltaCount: 1,
        generationInputSourceKind:
          'azpr-action-hit-three-value-delta-generation-input',
        generationInputStatus: 'three-value-delta-generation-input-ready',
        generationInputPointCount: 3,
        generationInputAppliedPointCount: 1,
        generationInputCandidatePointCount: 1,
        generationInputPlaceholderPointCount: 1,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        runtimeInputSourceStatus: 'runtime-input-source-ready',
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationIssueCount: 0,
        generationEntryAggregateValidationStatus:
          'generation-entry-aggregate-valid',
        generationEntryAggregateValidationIssueCount: 0,
      },
      outputSummary: {
        outputCount: 9,
        actionCount: 1,
        hitCount: 3,
        deltaCount: 3,
        appliedDeltaCount: 1,
      },
    });
    expect(bundle.generationOutputs.standardContract).toBe(
      bundle.standardContract
    );
    expect(bundle.generationOutputs.generationEntry).toBe(
      bundle.generationEntry
    );
    expect(bundle.generationOutputs.outputs.generationEntry).toBe(
      bundle.generationEntry
    );
    expect(bundle.generationInput).toBe(
      bundle.actionHitThreeValueDeltaGeneration.generationInput
    );
    expect(bundle.generationOutputs.generationInput).toBe(
      bundle.generationInput
    );
    expect(bundle.generationOutputs.outputs.generationInput).toBe(
      bundle.generationInput
    );
    expect(bundle.generationOutputs.valueSourceSlots).toBe(
      bundle.standardContract.valueSourceSlots
    );
    expect(bundle.generationOutputs.outputs.valueSourceSlots).toBe(
      bundle.standardContract.valueSourceSlots
    );
    expect(bundle.generationOutputs.runtimeInputSource).toBe(
      bundle.runtimeInputSource
    );
    expect(bundle.generationOutputs.outputs.runtimeInput).toBe(
      bundle.runtimeInputSource
    );
    expect(bundle.generationOutputs.deltas).toBe(bundle.deltas);
  });

  it('flags aggregate drift before runtime consumes the generation entry', () => {
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
          },
          toughnessDamage: {
            value: 30,
            applied: true,
            status: 'raw-toughness-projection',
          },
          selfEnergyChange: {
            value: 12,
            applied: true,
            status: 'raw-energy-projection',
          },
        },
      ],
    });
    bundle.generationEntry.hits[0].threeValueDeltaAggregate.layers.applied.hpDelta = 999;

    const validation = validateStandardGenerationEntryContract(
      bundle.generationEntry
    );

    expect(validation).toMatchObject({
      sourceKind:
        'azpr-action-hit-three-value-delta-generation-entry-contract-validation',
      status: 'generation-entry-contract-invalid',
      valid: false,
      issueCount: 1,
      issueKeys: ['hit-aggregate-layer-fields'],
      aggregateValidation: {
        sourceKind:
          'azpr-action-hit-three-value-delta-generation-entry-aggregate-validation',
        status: 'generation-entry-aggregate-invalid',
        issueCount: 1,
        issueKeys: ['hit-aggregate-layer-fields'],
        valid: false,
      },
    });
  });

  it('flags generation entry contract drift before runtime consumes it', () => {
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
          },
        },
      ],
    });
    const driftedEntry = {
      ...bundle.generationEntry,
      deltas: [...bundle.generationEntry.deltas],
    };

    const validation = validateStandardGenerationEntryContract(driftedEntry);

    expect(validation).toMatchObject({
      sourceKind:
        'azpr-action-hit-three-value-delta-generation-entry-contract-validation',
      status: 'generation-entry-contract-invalid',
      valid: false,
      issueCount: 3,
      issueKeys: [
        'standard-contract-deltas-reference',
        'runtime-input-source-deltas-reference',
        'outputs-deltas-reference',
      ],
    });
  });
});
