import { describe, expect, it } from 'vitest';
import { createWorkbenchFlowContractContext } from '../../features/workbench/workbenchFlowContractContext';

describe('workbench flow contract context', () => {
  it('summarizes generation entry, runtime input, and runtime outputs', () => {
    const context = createWorkbenchFlowContractContext({
      generationBundle: {
        contractName: 'Action -> Hit -> ThreeValueDelta',
        generationOutputs: {
          sourceKind: 'azpr-three-value-generation-outputs',
          status: 'generation-outputs-ready',
          generationInput: {
            sourceKind: 'azpr-action-hit-three-value-delta-generation-input',
            status: 'three-value-delta-generation-input-ready',
            summary: {
              pointCount: 4,
              appliedPointCount: 1,
              candidatePointCount: 2,
              sampledPointCount: 1,
              placeholderPointCount: 0,
            },
          },
          outputSummary: {
            actionCount: 1,
            hitCount: 2,
            deltaCount: 3,
            appliedDeltaCount: 1,
          },
          standardContract: {
            sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
            status: 'action-hit-three-value-delta-contract-ready',
            name: 'Action -> Hit -> ThreeValueDelta',
            summary: {
              actionCount: 1,
              hitCount: 2,
              deltaCount: 3,
              appliedDeltaCount: 1,
            },
          },
        },
        actionHitThreeValueDeltaGeneration: {
          sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
          status: 'action-hit-three-value-delta-generation-ready',
          summary: {
            actionCount: 1,
            hitCount: 2,
            deltaCount: 3,
            appliedDeltaCount: 1,
          },
        },
        standardContract: {
          sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
          status: 'action-hit-three-value-delta-contract-ready',
          name: 'Action -> Hit -> ThreeValueDelta',
          summary: {
            actionCount: 1,
            hitCount: 2,
            deltaCount: 3,
            appliedDeltaCount: 1,
          },
        },
      },
      runtimeProjection: {
        runtimeInput: {
          sourceKind:
            'azpr-runtime-input-from-action-hit-three-value-delta-generation',
          status: 'runtime-input-ready-with-applied-deltas',
          runtimeInputSourceKind:
            'azpr-runtime-input-source-from-generation-builder',
          generationEntrySourceKind:
            'azpr-action-hit-three-value-delta-generation-entry',
          appliedDeltaSource: 'threeValueRuntimeInput.appliedDeltas',
          ignoredDeltaCount: 2,
          appliedOnly: true,
          summary: {
            inputDeltaCount: 3,
            appliedDeltaCount: 1,
            ignoredDeltaCount: 2,
          },
        },
      },
      runtimeOutputs: {
        sourceKind: 'azpr-three-value-runtime-outputs',
        status: 'runtime-outputs-ready',
        outputAliases: {
          resources: 'resourceCurves',
        },
        outputContract: {
          sourceKind: 'azpr-three-value-runtime-output-contract',
          status: 'runtime-output-contract-ready',
          outputs: {
            simLog: {
              inputSource: 'threeValueRuntimeInput.appliedDeltas',
            },
            stateCurves: {
              sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
            },
            resourceCurves: {
              sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
            },
          },
          summary: {
            outputCount: 4,
            simLogCount: 99,
          },
        },
        outputSummary: {
          outputCount: 4,
          simLogCount: 1,
          enemyStatePointCount: 1,
          stateCurvePointCount: 2,
          resourceCurvePointCount: 1,
          outputConsistencyStatus: 'runtime-output-consistent',
          outputConsistent: true,
        },
        outputConsistency: {
          status: 'runtime-output-consistent',
          consistent: true,
        },
      },
    });

    expect(context).toEqual({
      contractName: 'Action -> Hit -> ThreeValueDelta',
      generationEntry: {
        sourceKind: 'azpr-three-value-generation-outputs',
        status: 'generation-outputs-ready',
        actionCount: 1,
        hitCount: 2,
        deltaCount: 3,
        appliedDeltaCount: 1,
        ready: true,
        generationInputSourceKind:
          'azpr-action-hit-three-value-delta-generation-input',
        generationInputStatus: 'three-value-delta-generation-input-ready',
        generationInputPointCount: 4,
        generationInputAppliedPointCount: 1,
        generationInputCandidatePointCount: 2,
        generationInputSampledPointCount: 1,
        generationInputPlaceholderPointCount: 0,
      },
      standardContract: {
        sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
        status: 'action-hit-three-value-delta-contract-ready',
        actionCount: 1,
        hitCount: 2,
        deltaCount: 3,
        appliedDeltaCount: 1,
        ready: true,
      },
      runtimeInput: {
        sourceKind:
          'azpr-runtime-input-from-action-hit-three-value-delta-generation',
        status: 'runtime-input-ready-with-applied-deltas',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        generationEntrySourceKind:
          'azpr-action-hit-three-value-delta-generation-entry',
        appliedDeltaSource: 'threeValueRuntimeInput.appliedDeltas',
        inputDeltaCount: 3,
        appliedDeltaCount: 1,
        ignoredDeltaCount: 2,
        appliedOnly: true,
        ready: true,
      },
      runtimeOutput: {
        sourceKind: 'azpr-three-value-runtime-output-contract',
        status: 'runtime-output-contract-ready',
        runtimeOutputsSourceKind: 'azpr-three-value-runtime-outputs',
        runtimeOutputsStatus: 'runtime-outputs-ready',
        resourcesAlias: 'resourceCurves',
        simLogInputSource: 'threeValueRuntimeInput.appliedDeltas',
        stateCurvesSourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
        resourceCurvesSourceKind:
          'azpr-runtime-resource-curves-from-standard-deltas',
        outputCount: 4,
        simLogCount: 1,
        enemyStatePointCount: 1,
        stateCurvePointCount: 2,
        resourceCurvePointCount: 1,
        outputConsistencyStatus: 'runtime-output-consistent',
        outputConsistent: true,
        ready: true,
      },
    });
  });

  it('falls back to the legacy generation entry when generation outputs are absent', () => {
    const context = createWorkbenchFlowContractContext({
      generationBundle: {
        contractName: 'Action -> Hit -> ThreeValueDelta',
        actionHitThreeValueDeltaGeneration: {
          sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
          status: 'action-hit-three-value-delta-generation-ready',
          summary: {
            actionCount: 1,
            hitCount: 1,
            deltaCount: 1,
            appliedDeltaCount: 1,
          },
        },
      },
    });

    expect(context.generationEntry).toEqual({
      sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
      status: 'action-hit-three-value-delta-generation-ready',
      actionCount: 1,
      hitCount: 1,
      deltaCount: 1,
      appliedDeltaCount: 1,
      ready: true,
      generationInputSourceKind: '',
      generationInputStatus: '',
      generationInputPointCount: 0,
      generationInputAppliedPointCount: 0,
      generationInputCandidatePointCount: 0,
      generationInputSampledPointCount: 0,
      generationInputPlaceholderPointCount: 0,
    });
  });
});
