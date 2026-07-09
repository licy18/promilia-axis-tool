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
          generationReadSources: {
            status: 'runtime-input-generation-read-sources-ready',
            standardOutputCount: 6,
            fallbackInputCount: 0,
            usesLegacyGenerationFallback: false,
            generationOutputBoundaryStatus:
              'generation-output-boundary-ready',
            generationOutputBoundaryReady: true,
            generationOutputBoundaryPath:
              'generationOutputs.standardOutputBoundary',
            generationOutputBoundaryEntryPath:
              'generationOutputs.outputs.generationEntry',
            generationOutputBoundaryRuntimeInputSourcePath:
              'generationOutputs.outputs.generationEntry.runtimeInputSource',
            generationOutputBoundaryStandardContractPath:
              'generationOutputs.outputs.generationEntry.standardContract',
            generationOutputBoundaryDeltasPath:
              'generationOutputs.outputs.generationEntry.deltas',
            generationOutputBoundaryValueSourceSlotsPath:
              'generationOutputs.outputs.generationEntry.valueSourceSlots',
            generationOutputBoundaryContractValidationPath:
              'generationOutputs.outputs.generationEntry.contractValidation',
            generationOutputBoundaryStandardOutputCount: 6,
            generationOutputBoundaryIssueCount: 0,
            standardGenerationBoundaryReady: true,
            generationEntryContractValidationStatus:
              'generation-entry-contract-valid',
            generationEntryContractValidationIssueCount: 0,
            generationEntryContractValidationValid: true,
            generationEntryAggregateValidationStatus:
              'generation-entry-aggregate-valid',
            generationEntryAggregateValidationIssueCount: 0,
            generationEntryAggregateValidationValid: true,
            standardGenerationAggregateBoundaryReady: true,
            inputs: {
              generationEntry: {
                sourcePath: 'generationOutputs.outputs.generationEntry',
              },
              runtimeInputSource: {
                sourcePath:
                  'generationOutputs.outputs.generationEntry.runtimeInputSource',
              },
              standardContract: {
                sourcePath:
                  'generationOutputs.outputs.generationEntry.standardContract',
              },
              deltas: {
                sourcePath: 'generationOutputs.outputs.generationEntry.deltas',
              },
              valueSourceSlots: {
                sourcePath:
                  'generationOutputs.outputs.generationEntry.valueSourceSlots',
                sourceTier: 'standard-output',
                standardOutputPresent: true,
              },
              contractValidation: {
                sourcePath:
                  'generationOutputs.outputs.generationEntry.contractValidation',
              },
            },
          },
          summary: {
            inputDeltaCount: 3,
            appliedDeltaCount: 1,
            ignoredDeltaCount: 2,
            valueSourceSlotCount: 12,
            runtimeValueSourceSlotCount: 3,
            replaceableValueSourceSlotCount: 9,
            generationOutputBoundaryStatus:
              'generation-output-boundary-ready',
            generationOutputBoundaryReady: true,
            generationOutputBoundaryPath:
              'generationOutputs.standardOutputBoundary',
            generationOutputBoundaryEntryPath:
              'generationOutputs.outputs.generationEntry',
            generationOutputBoundaryRuntimeInputSourcePath:
              'generationOutputs.outputs.generationEntry.runtimeInputSource',
            generationOutputBoundaryStandardContractPath:
              'generationOutputs.outputs.generationEntry.standardContract',
            generationOutputBoundaryDeltasPath:
              'generationOutputs.outputs.generationEntry.deltas',
            generationOutputBoundaryValueSourceSlotsPath:
              'generationOutputs.outputs.generationEntry.valueSourceSlots',
            generationOutputBoundaryContractValidationPath:
              'generationOutputs.outputs.generationEntry.contractValidation',
            generationOutputBoundaryStandardOutputCount: 6,
            generationOutputBoundaryIssueCount: 0,
            runtimeInputGenerationValueSourceSlotsPath:
              'generationOutputs.outputs.generationEntry.valueSourceSlots',
            runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
            runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
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
        outputConsumerContract: {
          sourceKind: 'azpr-three-value-runtime-output-consumer-contract',
          status: 'runtime-output-consumer-contract-ready',
          summary: {
            outputCount: 4,
            simLogCount: 1,
          },
        },
        outputs: {
          simLog: [
            {
              sourceDeltaId: 'hp-delta',
            },
          ],
          stateCurves: {
            enemy: {
              points: [
                {
                  sourceDeltaId: 'hp-delta',
                },
              ],
            },
          },
          resourceCurves: {
            curvesByActor: [
              {
                actorId: 'actor-001',
                points: [
                  {
                    sourceDeltaId: 'energy-delta',
                  },
                ],
              },
            ],
          },
          summary: {
            outputCount: 4,
            simLogCount: 1,
          },
        },
        outputSummary: {
          outputCount: 4,
          simLogCount: 1,
          enemyStatePointCount: 1,
          stateCurvePointCount: 2,
          resourceCurvePointCount: 1,
          valueSourceSlotCount: 12,
          runtimeValueSourceSlotCount: 3,
          replaceableValueSourceSlotCount: 9,
          runtimeInputGenerationOutputBoundaryStatus:
            'generation-output-boundary-ready',
          runtimeInputGenerationOutputBoundaryReady: true,
          runtimeInputGenerationOutputBoundaryPath:
            'generationOutputs.standardOutputBoundary',
          runtimeInputGenerationOutputBoundaryEntryPath:
            'generationOutputs.outputs.generationEntry',
          runtimeInputGenerationOutputBoundaryRuntimeInputSourcePath:
            'generationOutputs.outputs.generationEntry.runtimeInputSource',
          runtimeInputGenerationOutputBoundaryStandardContractPath:
            'generationOutputs.outputs.generationEntry.standardContract',
          runtimeInputGenerationOutputBoundaryDeltasPath:
            'generationOutputs.outputs.generationEntry.deltas',
          runtimeInputGenerationOutputBoundaryValueSourceSlotsPath:
            'generationOutputs.outputs.generationEntry.valueSourceSlots',
          runtimeInputGenerationOutputBoundaryContractValidationPath:
            'generationOutputs.outputs.generationEntry.contractValidation',
          runtimeInputGenerationOutputBoundaryStandardOutputCount: 6,
          runtimeInputGenerationOutputBoundaryIssueCount: 0,
          runtimeInputGenerationValueSourceSlotsPath:
            'generationOutputs.outputs.generationEntry.valueSourceSlots',
          runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
          runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
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
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        generationReadSourcesStatus:
          'runtime-input-generation-read-sources-ready',
        generationOutputBoundaryStatus: 'generation-output-boundary-ready',
        generationOutputBoundaryReady: true,
        generationOutputBoundaryPath: 'generationOutputs.standardOutputBoundary',
        generationOutputBoundaryEntryPath:
          'generationOutputs.outputs.generationEntry',
        generationOutputBoundaryRuntimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        generationOutputBoundaryStandardContractPath:
          'generationOutputs.outputs.generationEntry.standardContract',
        generationOutputBoundaryDeltasPath:
          'generationOutputs.outputs.generationEntry.deltas',
        generationOutputBoundaryValueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        generationOutputBoundaryContractValidationPath:
          'generationOutputs.outputs.generationEntry.contractValidation',
        generationOutputBoundaryStandardOutputCount: 6,
        generationOutputBoundaryIssueCount: 0,
        generationReadStandardOutputCount: 6,
        generationReadFallbackInputCount: 0,
        generationReadUsesLegacyFallback: false,
        generationStandardBoundaryReady: true,
        generationAggregateBoundaryReady: true,
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationIssueCount: 0,
        generationEntryContractValidationValid: true,
        generationEntryAggregateValidationStatus:
          'generation-entry-aggregate-valid',
        generationEntryAggregateValidationIssueCount: 0,
        generationEntryAggregateValidationValid: true,
        generationEntrySourcePath: 'generationOutputs.outputs.generationEntry',
        generationRuntimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        generationStandardContractSourcePath:
          'generationOutputs.outputs.generationEntry.standardContract',
        generationDeltasSourcePath:
          'generationOutputs.outputs.generationEntry.deltas',
        generationValueSourceSlotsSourcePath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        generationValueSourceSlotsSourceTier: 'standard-output',
        generationValueSourceSlotsStandardOutputPresent: true,
        generationContractValidationSourcePath:
          'generationOutputs.outputs.generationEntry.contractValidation',
        generationAggregateValidationSourcePath:
          'generationOutputs.outputs.generationEntry.contractValidation.aggregateValidation',
        appliedOnly: true,
        ready: true,
      },
      runtimeOutput: {
        sourceKind: 'azpr-three-value-runtime-output-contract',
        status: 'runtime-output-contract-ready',
        consumerContractSourceKind:
          'azpr-three-value-runtime-output-consumer-contract',
        consumerContractStatus: 'runtime-output-consumer-contract-ready',
        runtimeOutputsSourceKind: 'azpr-three-value-runtime-outputs',
        runtimeOutputsStatus: 'runtime-outputs-ready',
        resourcesAlias: 'resourceCurves',
        simLogInputSource: 'threeValueRuntimeInput.appliedDeltas',
        stateCurvesSourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
        resourceCurvesSourceKind:
          'azpr-runtime-resource-curves-from-standard-deltas',
        outputReadSourcesStatus: 'runtime-output-read-sources-ready',
        outputReadStandardOutputCount: 4,
        outputReadFallbackOutputCount: 0,
        outputReadUsesLegacyFallback: false,
        outputConsumerBoundaryStatus:
          'runtime-output-consumer-boundary-standard',
        outputConsumerBoundaryReady: true,
        outputConsumerBoundaryStandardReady: true,
        outputConsumerBoundaryUsesLegacyFallback: false,
        outputConsumerBoundaryStandardOutputCount: 4,
        outputConsumerBoundaryFallbackOutputCount: 0,
        outputReadSimLogSourcePath: 'runtimeOutputs.outputs.simLog',
        outputReadStateCurvesSourcePath: 'runtimeOutputs.outputs.stateCurves',
        outputReadResourceCurvesSourcePath:
          'runtimeOutputs.outputs.resourceCurves',
        outputReadSummarySourcePath:
          'runtimeOutputs.outputConsumerContract.summary',
        outputCount: 4,
        simLogCount: 1,
        enemyStatePointCount: 1,
        stateCurvePointCount: 2,
        resourceCurvePointCount: 1,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        valueSourceSlotsSourcePath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        valueSourceSlotsSourceTier: 'standard-output',
        valueSourceSlotsStandardOutputPresent: true,
        generationOutputBoundaryStatus: 'generation-output-boundary-ready',
        generationOutputBoundaryReady: true,
        generationOutputBoundaryPath: 'generationOutputs.standardOutputBoundary',
        generationOutputBoundaryEntryPath:
          'generationOutputs.outputs.generationEntry',
        generationOutputBoundaryRuntimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        generationOutputBoundaryStandardContractPath:
          'generationOutputs.outputs.generationEntry.standardContract',
        generationOutputBoundaryDeltasPath:
          'generationOutputs.outputs.generationEntry.deltas',
        generationOutputBoundaryValueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        generationOutputBoundaryContractValidationPath:
          'generationOutputs.outputs.generationEntry.contractValidation',
        generationOutputBoundaryStandardOutputCount: 6,
        generationOutputBoundaryIssueCount: 0,
        outputConsistencyStatus: 'runtime-output-consistent',
        outputConsistent: true,
        ready: true,
      },
      runtimeContractBoundary: {
        schemaVersion: 1,
        sourceKind: 'workbench-runtime-contract-boundary',
        status: 'workbench-runtime-contract-boundary-standard',
        ready: true,
        readyState: 'true',
        standardBoundaryReady: true,
        standardBoundaryReadyState: 'true',
        generationStandardReady: true,
        generationStandardReadyState: 'true',
        generationAggregateReady: true,
        generationAggregateReadyState: 'true',
        runtimeOutputStandardReady: true,
        runtimeOutputStandardReadyState: 'true',
        simLogConnectedToAppliedDeltas: true,
        simLogConnectedToAppliedDeltasState: 'true',
        usesLegacyFallback: false,
        usesLegacyFallbackState: 'false',
        fallbackCount: 0,
        generationReadSourcesStatus:
          'runtime-input-generation-read-sources-ready',
        generationOutputBoundaryStatus: 'generation-output-boundary-ready',
        generationOutputBoundaryReady: true,
        generationOutputBoundaryReadyState: 'true',
        generationOutputBoundaryPath: 'generationOutputs.standardOutputBoundary',
        generationOutputBoundaryEntryPath:
          'generationOutputs.outputs.generationEntry',
        generationOutputBoundaryRuntimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        generationOutputBoundaryStandardContractPath:
          'generationOutputs.outputs.generationEntry.standardContract',
        generationOutputBoundaryDeltasPath:
          'generationOutputs.outputs.generationEntry.deltas',
        generationOutputBoundaryValueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        generationOutputBoundaryContractValidationPath:
          'generationOutputs.outputs.generationEntry.contractValidation',
        generationOutputBoundaryStandardOutputCount: 6,
        generationOutputBoundaryIssueCount: 0,
        runtimeOutputReadSourcesStatus: 'runtime-output-read-sources-ready',
        runtimeOutputConsumerBoundaryStatus:
          'runtime-output-consumer-boundary-standard',
        runtimeOutputConsumerBoundaryReady: true,
        runtimeOutputConsumerBoundaryReadyState: 'true',
        runtimeOutputConsumerBoundaryStandardReady: true,
        runtimeOutputConsumerBoundaryStandardReadyState: 'true',
        generationReadStandardOutputCount: 6,
        runtimeOutputReadStandardOutputCount: 4,
        generationReadFallbackInputCount: 0,
        runtimeOutputReadFallbackOutputCount: 0,
        runtimeOutputConsumerBoundaryStandardOutputCount: 4,
        runtimeOutputConsumerBoundaryFallbackOutputCount: 0,
        generationEntryContractValidationStatus:
          'generation-entry-contract-valid',
        generationEntryContractValidationIssueCount: 0,
        generationEntryContractValidationValid: true,
        generationEntryContractValidationValidState: 'true',
        generationEntryAggregateValidationStatus:
          'generation-entry-aggregate-valid',
        generationEntryAggregateValidationIssueCount: 0,
        generationEntryAggregateValidationValid: true,
        generationEntryAggregateValidationValidState: 'true',
        generationEntrySourcePath: 'generationOutputs.outputs.generationEntry',
        generationDeltasSourcePath:
          'generationOutputs.outputs.generationEntry.deltas',
        generationValueSourceSlotsSourcePath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        generationValueSourceSlotsSourceTier: 'standard-output',
        generationValueSourceSlotsStandardOutputPresent: true,
        generationContractValidationSourcePath:
          'generationOutputs.outputs.generationEntry.contractValidation',
        generationAggregateValidationSourcePath:
          'generationOutputs.outputs.generationEntry.contractValidation.aggregateValidation',
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        valueSourceSlotsSourcePath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        valueSourceSlotsSourceTier: 'standard-output',
        valueSourceSlotsStandardOutputPresent: true,
        runtimeSimLogSourcePath: 'runtimeOutputs.outputs.simLog',
        runtimeSummarySourcePath:
          'runtimeOutputs.outputConsumerContract.summary',
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
    expect(context.runtimeOutput).toMatchObject({
      sourceKind: '',
      status: '',
      consumerContractSourceKind:
        'azpr-three-value-runtime-output-consumer-contract',
      consumerContractStatus:
        'runtime-output-consumer-contract-ready-no-applied-deltas',
      runtimeOutputsSourceKind: '',
      runtimeOutputsStatus: '',
      simLogCount: 0,
      stateCurvePointCount: 0,
      outputConsistent: false,
      ready: false,
    });
    expect(context.runtimeContractBoundary).toMatchObject({
      status: 'workbench-runtime-contract-boundary-incomplete',
      ready: false,
      standardBoundaryReady: false,
    });
  });
});
