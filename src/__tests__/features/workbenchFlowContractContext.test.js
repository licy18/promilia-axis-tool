import { describe, expect, it } from 'vitest';
import { createWorkbenchFlowContractContext } from '../../features/workbench/workbenchFlowContractContext';

describe('workbench flow contract context', () => {
  it('summarizes generation entry, runtime input, and runtime outputs', () => {
    const context = createWorkbenchFlowContractContext({
      generationBundle: {
        contractName: 'Action -> Hit -> ThreeValueDelta',
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
            simLogCount: 1,
          },
        },
      },
    });

    expect(context).toEqual({
      contractName: 'Action -> Hit -> ThreeValueDelta',
      generationEntry: {
        sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
        status: 'action-hit-three-value-delta-generation-ready',
        actionCount: 1,
        hitCount: 2,
        deltaCount: 3,
        appliedDeltaCount: 1,
        ready: true,
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
        simLogInputSource: 'threeValueRuntimeInput.appliedDeltas',
        stateCurvesSourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
        resourceCurvesSourceKind:
          'azpr-runtime-resource-curves-from-standard-deltas',
        outputCount: 4,
        simLogCount: 1,
        ready: true,
      },
    });
  });
});
