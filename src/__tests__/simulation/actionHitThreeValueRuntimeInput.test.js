import { describe, expect, it } from 'vitest';
import { createActionHitThreeValueDeltaGeneration } from '../../simulation/generation/actionHitThreeValueDeltaGeneration';
import { createThreeValueGenerationBundle } from '../../simulation/generation/threeValueGenerationBuilder';
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
        actionThreeValueDeltaAggregate: expect.objectContaining({
          sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
          deltaCount: 3,
          layerKeys: ['applied', 'placeholder'],
          layers: {
            applied: expect.objectContaining({
              hpDelta: 1200,
              toughnessDelta: 0,
              energyDelta: 0,
            }),
            placeholder: expect.objectContaining({
              hpDelta: 0,
              toughnessDelta: 0,
              energyDelta: 0,
            }),
          },
        }),
        hitThreeValueDeltaAggregate: expect.objectContaining({
          sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
          deltaCount: 1,
          layerKeys: ['applied'],
          layers: {
            applied: expect.objectContaining({
              hpDelta: 1200,
              toughnessDelta: 0,
              energyDelta: 0,
            }),
          },
        }),
        applied: true,
      }),
    ]);
  });

  it('accepts generation outputs as the runtime input entry', () => {
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
      generationOutputs: bundle.generationOutputs,
    });

    expect(runtimeInput).toMatchObject({
      sourceKind: 'azpr-runtime-input-from-generation-builder-source',
      status: 'runtime-input-ready-with-applied-deltas',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      appliedDeltaSource: ACTION_HIT_THREE_VALUE_RUNTIME_INPUT_SOURCE,
      generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
      generationOutputsStatus: 'generation-outputs-ready',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      runtimeInputSourceStatus: 'runtime-input-source-ready',
      standardGenerationEntrySourceKind:
        'azpr-action-hit-three-value-delta-standard-generation-entry',
      standardGenerationEntryStatus:
        'action-hit-three-value-delta-standard-generation-entry-ready',
      generationEntryContractValidationStatus:
        'generation-entry-contract-valid',
      generationEntryContractValidationIssueCount: 0,
      generationEntryContractValidationValid: true,
      generationReadSources: {
        sourceKind:
          'azpr-action-hit-three-value-runtime-input-generation-read-sources',
        status: 'runtime-input-generation-read-sources-ready',
        standardOutputNames: [
          'generationEntry',
          'runtimeInputSource',
          'standardContract',
          'deltas',
          'contractValidation',
        ],
        standardOutputCount: 5,
        fallbackInputNames: [],
        usesLegacyGenerationFallback: false,
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationIssueCount: 0,
        generationEntryContractValidationValid: true,
        standardGenerationBoundaryReady: true,
        inputs: {
          generationEntry: {
            sourceKey: 'outputs.generationEntry',
            sourcePath: 'generationOutputs.outputs.generationEntry',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
            standardOutputPresent: true,
          },
          runtimeInputSource: {
            sourceKey: 'outputs.generationEntry.runtimeInputSource',
            sourcePath:
              'generationOutputs.outputs.generationEntry.runtimeInputSource',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
            standardOutputPresent: true,
          },
          standardContract: {
            sourceKey: 'outputs.generationEntry.standardContract',
            sourcePath:
              'generationOutputs.outputs.generationEntry.standardContract',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
            standardOutputPresent: true,
          },
          deltas: {
            sourceKey: 'outputs.generationEntry.deltas',
            sourcePath: 'generationOutputs.outputs.generationEntry.deltas',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
            standardOutputPresent: true,
          },
          contractValidation: {
            sourceKey: 'outputs.generationEntry.contractValidation',
            sourcePath:
              'generationOutputs.outputs.generationEntry.contractValidation',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
            standardOutputPresent: true,
          },
        },
      },
      summary: {
        generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
        generationOutputsStatus: 'generation-outputs-ready',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationIssueCount: 0,
        generationEntryContractValidationValid: true,
        inputDeltaCount: 3,
        appliedDeltaCount: 1,
        ignoredDeltaCount: 2,
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
        applied: true,
      }),
    ]);
  });

  it('prefers standard generation outputs over legacy generation fields', () => {
    const standardDelta = createRuntimeInputDelta({
      sourceDeltaId: 'standard-output-delta',
      actionId: 'action-standard',
      delta: 420,
    });
    const directDelta = createRuntimeInputDelta({
      sourceDeltaId: 'direct-generation-output-delta',
      actionId: 'action-direct',
      delta: 900,
    });
    const runtimeSourceDelta = createRuntimeInputDelta({
      sourceDeltaId: 'runtime-input-source-delta',
      actionId: 'action-runtime-source',
      delta: 777,
    });
    const standardContract = createRuntimeInputContract({
      sourceKind: 'standard-contract-from-outputs',
      delta: standardDelta,
    });
    const directContract = createRuntimeInputContract({
      sourceKind: 'direct-generation-output-contract',
      delta: directDelta,
    });
    const runtimeSourceContract = createRuntimeInputContract({
      sourceKind: 'runtime-input-source-contract',
      delta: runtimeSourceDelta,
    });
    const generationOutputs = {
      sourceKind: 'azpr-three-value-generation-outputs',
      status: 'generation-outputs-ready',
      outputs: {
        generationEntry: {
          sourceKind:
            'azpr-action-hit-three-value-delta-standard-generation-entry',
          status:
            'action-hit-three-value-delta-standard-generation-entry-ready',
          contractValidation: createGenerationEntryContractValidation({
            valid: true,
          }),
          runtimeInputSource: {
            sourceKind: 'azpr-runtime-input-source-from-generation-builder',
            status: 'runtime-input-source-ready',
            generationEntrySourceKind:
              'azpr-action-hit-three-value-delta-generation-entry',
            generationEntryStatus:
              'action-hit-three-value-delta-generation-ready',
            generationLayerSourceKind:
              'azpr-standard-three-value-generation-layer',
            generationLayerStatus:
              'standard-three-value-generation-layer-ready',
            standardContract: runtimeSourceContract,
            deltas: [runtimeSourceDelta],
          },
          standardContract,
          deltas: [standardDelta],
        },
        runtimeInputSource: {
          sourceKind: 'azpr-runtime-input-source-from-generation-builder',
          status: 'runtime-input-source-ready',
          generationEntrySourceKind:
            'azpr-action-hit-three-value-delta-generation-entry',
          generationEntryStatus:
            'action-hit-three-value-delta-generation-ready',
          generationLayerSourceKind:
            'azpr-standard-three-value-generation-layer',
          generationLayerStatus: 'standard-three-value-generation-layer-ready',
          standardContract: runtimeSourceContract,
          deltas: [runtimeSourceDelta],
        },
        standardContract,
        deltas: [standardDelta],
      },
      runtimeInputSource: {
        sourceKind: 'legacy-runtime-input-source',
        status: 'legacy-runtime-input-source-ready',
        standardContract: runtimeSourceContract,
        deltas: [runtimeSourceDelta],
      },
      standardContract: directContract,
      deltas: [directDelta],
    };

    const runtimeInput = createActionHitThreeValueRuntimeInput({
      generationOutputs,
    });

    expect(runtimeInput).toMatchObject({
      sourceKind: 'azpr-runtime-input-from-generation-builder-source',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      standardContractSourceKind: 'standard-contract-from-outputs',
      inputSourceKind: 'standard-contract-from-outputs',
      generationReadSources: {
        inputs: {
          generationEntry: {
            sourceKey: 'outputs.generationEntry',
            sourcePath: 'generationOutputs.outputs.generationEntry',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
          },
          runtimeInputSource: {
            sourceKey: 'outputs.generationEntry.runtimeInputSource',
            sourcePath:
              'generationOutputs.outputs.generationEntry.runtimeInputSource',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
          },
          standardContract: {
            sourceKey: 'outputs.generationEntry.standardContract',
            sourcePath:
              'generationOutputs.outputs.generationEntry.standardContract',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
          },
          deltas: {
            sourceKey: 'outputs.generationEntry.deltas',
            sourcePath: 'generationOutputs.outputs.generationEntry.deltas',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
          },
          contractValidation: {
            sourceKey: 'outputs.generationEntry.contractValidation',
            sourcePath:
              'generationOutputs.outputs.generationEntry.contractValidation',
            sourceTier: 'standard-output',
            containerKey: 'generationEntry',
            fallback: false,
          },
        },
        standardOutputNames: [
          'generationEntry',
          'runtimeInputSource',
          'standardContract',
          'deltas',
          'contractValidation',
        ],
        standardOutputCount: 5,
        fallbackInputNames: [],
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationValid: true,
        standardGenerationBoundaryReady: true,
        usesLegacyGenerationFallback: false,
      },
      summary: {
        standardContractSourceKind: 'standard-contract-from-outputs',
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationValid: true,
        inputDeltaCount: 1,
        appliedDeltaCount: 1,
      },
    });
    expect(runtimeInput.appliedDeltas).toEqual([
      expect.objectContaining({
        sourceDeltaId: 'standard-output-delta',
        actionId: 'action-standard',
        delta: 420,
        hpDelta: 420,
        runtimeSequenceIndex: 0,
      }),
    ]);
  });

  it('marks the runtime input boundary invalid when generation entry validation fails', () => {
    const standardDelta = createRuntimeInputDelta({
      sourceDeltaId: 'standard-output-delta',
      actionId: 'action-standard',
      delta: 420,
    });
    const standardContract = createRuntimeInputContract({
      sourceKind: 'standard-contract-from-outputs',
      delta: standardDelta,
    });
    const generationOutputs = {
      sourceKind: 'azpr-three-value-generation-outputs',
      status: 'generation-outputs-ready',
      outputs: {
        generationEntry: {
          sourceKind:
            'azpr-action-hit-three-value-delta-standard-generation-entry',
          status:
            'action-hit-three-value-delta-standard-generation-entry-contract-invalid',
          contractValidation: createGenerationEntryContractValidation({
            valid: false,
            issueKeys: ['standard-contract-deltas-reference'],
          }),
          runtimeInputSource: {
            sourceKind: 'azpr-runtime-input-source-from-generation-builder',
            status: 'runtime-input-source-ready',
            standardContract,
            deltas: [standardDelta],
          },
          standardContract,
          deltas: [standardDelta],
        },
      },
    };

    const runtimeInput = createActionHitThreeValueRuntimeInput({
      generationOutputs,
    });

    expect(runtimeInput).toMatchObject({
      status: 'runtime-input-invalid-generation-entry-contract',
      generationEntryContractValidationStatus:
        'generation-entry-contract-invalid',
      generationEntryContractValidationIssueCount: 1,
      generationEntryContractValidationValid: false,
      generationReadSources: {
        standardOutputCount: 5,
        generationEntryContractValidationStatus:
          'generation-entry-contract-invalid',
        generationEntryContractValidationIssueCount: 1,
        generationEntryContractValidationValid: false,
        standardGenerationBoundaryReady: false,
        usesLegacyGenerationFallback: false,
      },
      summary: {
        generationEntryContractValidationStatus:
          'generation-entry-contract-invalid',
        generationEntryContractValidationIssueCount: 1,
        generationEntryContractValidationValid: false,
        inputDeltaCount: 1,
        appliedDeltaCount: 1,
      },
    });
  });
});

function createRuntimeInputDelta({ sourceDeltaId, actionId, delta }) {
  return {
    id: sourceDeltaId,
    sourceDeltaId,
    actionId,
    actionName: actionId,
    hitKey: `${actionId}|hit-1`,
    hitIndex: 0,
    frameIndex: 12,
    timeMs: 200,
    sequenceIndex: 0,
    trackKey: 'enemyHpDamage',
    layerKey: 'applied',
    delta,
    hpDelta: delta,
    toughnessDelta: 0,
    energyDelta: 0,
    applied: true,
  };
}

function createRuntimeInputContract({ sourceKind, delta }) {
  return {
    schemaVersion: 1,
    sourceKind,
    status: 'action-hit-three-value-delta-contract-ready',
    name: 'Action -> Hit -> ThreeValueDelta',
    actions: [],
    hits: [],
    deltas: [delta],
    summary: {
      actionCount: 1,
      hitCount: 1,
      deltaCount: 1,
      appliedDeltaCount: 1,
      candidateDeltaCount: 0,
      sampledDeltaCount: 0,
      placeholderDeltaCount: 0,
    },
  };
}

function createGenerationEntryContractValidation({
  valid,
  issueKeys = [],
} = {}) {
  const normalizedValid = valid !== false;
  return {
    schemaVersion: 1,
    sourceKind:
      'azpr-action-hit-three-value-delta-generation-entry-contract-validation',
    status: normalizedValid
      ? 'generation-entry-contract-valid'
      : 'generation-entry-contract-invalid',
    issueCount: normalizedValid ? 0 : issueKeys.length,
    issueKeys,
    valid: normalizedValid,
    applied: false,
  };
}
