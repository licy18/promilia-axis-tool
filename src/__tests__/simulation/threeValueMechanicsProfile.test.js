import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE,
  validateThreeValueMechanicsProfile,
} from '../../simulation/mechanics/threeValueMechanicsProfile';

describe('three value mechanics profile', () => {
  it('rejects a profile that reroutes a track to another state metric', () => {
    const profile = JSON.parse(
      JSON.stringify(DEFAULT_THREE_VALUE_MECHANICS_PROFILE)
    );
    profile.tracks.enemyHpDamage.stateEffect.writeMetric = 'selfEnergy';

    expect(validateThreeValueMechanicsProfile(profile)).toMatchObject({
      valid: false,
      status: 'mechanics-profile-invalid',
      issues: expect.arrayContaining([
        'operand-state-effect-invalid:hp-raw-preview-product:enemyHpDamage',
      ]),
    });
  });

  it('binds the default versioned profile from Scenario through runtime', () => {
    const scenario = compileProject(
      createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION),
      getWorkbenchGameData()
    );
    const result = simulateScenario(scenario);
    const generatedDelta = result.threeValueGenerationLayer.deltas.find(
      delta => delta.applied
    );
    const runtimeDelta =
      result.threeValueRuntimeProjection.runtimeAppliedDeltas.find(
        delta => delta.sourceDeltaId === generatedDelta.id
      );

    expect(
      validateThreeValueMechanicsProfile(scenario.mechanicsProfile)
    ).toEqual({
      valid: true,
      status: 'mechanics-profile-valid',
      issues: [],
    });
    expect(scenario.mechanicsProfile).toMatchObject({
      contractName: 'AzPrMechanicsProfile',
      contractVersion: 2,
      profileId: 'azpr-three-value-preview-v1',
      profileVersion: 1,
      ready: true,
      supportedOperandKinds: expect.arrayContaining([
        'hp-raw-preview-product',
        'explicit-self-energy-event-sum',
        'validated-toughness-before-after',
        'validated-self-energy-before-after',
      ]),
      operandKinds: {
        'hp-raw-preview-product': expect.objectContaining({
          steps: [
            expect.objectContaining({
              stateEffectTrackKeys: ['enemyHpDamage'],
            }),
          ],
        }),
      },
      tracks: {
        enemyHpDamage: expect.objectContaining({
          stateEffect: {
            readMetric: 'enemyHp',
            writeMetric: 'enemyHp',
            target: 'targetEnemy',
            applyMode: 'decrease',
          },
        }),
      },
      policy: {
        unconfirmedFormulaLayersApplied: false,
        unconfirmedCultivationEffectsApplied: false,
        runtimeSamplesRequireValidation: true,
        unsupportedOperandsFallbackToGenerationDelta: true,
      },
    });
    expect(scenario.mechanicsProfileSelection).toMatchObject({
      sourceKind: 'project-persisted-mechanics-profile-selection',
      status: 'mechanics-profile-selection-ready',
      requestedProfileId: 'azpr-three-value-preview-v1',
      requestedProfileVersion: 1,
      resolvedProfileId: 'azpr-three-value-preview-v1',
      fallback: false,
    });
    expect(generatedDelta.mechanicsAdapterRequest.mechanicsProfile).toBe(
      scenario.mechanicsProfile
    );
    expect(
      runtimeDelta.runtimeCalculatorInvocation.input.mechanicsProfile
    ).toBe(scenario.mechanicsProfile);
    expect(
      generatedDelta.mechanicsAdapterRequest.mechanicsLayerInputs
    ).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsLayerInputs',
      contractVersion: 1,
      inputs: {
        stateBefore: { ready: false },
        initialEnergy: { ready: false },
        cultivationConfiguration: { ready: true },
      },
      missingRequiredCount: 0,
    });
    expect(
      generatedDelta.mechanicsAdapterRequest.mechanicsLayerInputs
    ).toMatchObject({
      layers: {
        applied: ['baseAttack', 'actionMultiplier'],
        required: ['baseAttack', 'actionMultiplier'],
        unapplied: expect.arrayContaining(['enemyDefense', 'loadout']),
        inputKeys: expect.objectContaining({
          baseAttack: 'actorStats',
          actionMultiplier: 'actionMultiplier',
          enemyDefense: 'enemyDefense',
          enemyResistance: 'enemyElementDefense',
          loadout: 'cultivationConfiguration',
        }),
      },
      inputs: {
        actorStats: expect.objectContaining({
          ready: true,
          value: expect.objectContaining({
            attack: generatedDelta.mechanismContext.sourceActor.stats.attack,
          }),
        }),
        actionMultiplier: expect.objectContaining({
          ready: true,
        }),
        enemyDefense: expect.objectContaining({
          ready: true,
        }),
        cultivationConfiguration: expect.objectContaining({
          ready: true,
        }),
      },
    });
    expect(
      runtimeDelta.runtimeCalculatorInvocation.input.mechanicsLayerInputs
    ).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsLayerInputs',
      inputs: {
        stateBefore: {
          ready: true,
          value: runtimeDelta.runtimeCalculatorInvocation.input.stateBefore,
        },
      },
      missingRequiredCount: 0,
    });
    expect(runtimeDelta.runtimeCalculatorInvocation.validation).toMatchObject({
      mechanicsLayerInputsAppliedReady: true,
    });
    expect(
      runtimeDelta.runtimeCalculatorInvocation.mechanicsEvaluation
    ).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsEvaluation',
      contractVersion: 3,
      stepResults: [
        expect.objectContaining({
          key: 'raw-product',
          operation: 'round-clamped-product',
          usedLayers: [
            {
              layerKey: 'baseAttack',
              inputKey: 'actorStats',
              source: 'actor',
              ready: true,
            },
            {
              layerKey: 'actionMultiplier',
              inputKey: 'actionMultiplier',
              source: 'operands',
              ready: true,
            },
          ],
          delta: generatedDelta.delta,
          ready: true,
        }),
      ],
      delta: generatedDelta.delta,
      stateEffectStepKey: 'raw-product',
      ready: true,
    });
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      mechanicsProfileIds: ['azpr-three-value-preview-v1'],
      mechanicsProfileVersions: [1],
      mechanicsProfileFallbackInvocationCount: 0,
      mechanicsProfileCapabilityReadyInvocationCount: 1,
      mechanicsProfileCapabilityMissingInvocationCount: 0,
    });
    expect(
      result.threeValueRuntimeProjection.runtimeStateSnapshots
        .calculatorInvocationSummary
    ).toMatchObject({
      mechanicsEvaluationReadyInvocationCount: 1,
      mechanicsEvaluationMissingInvocationCount: 0,
      mechanicsEvaluationOperations: ['round-clamped-product'],
      stateEffectProposalReadyInvocationCount: 1,
      stateEffectProposalMissingInvocationCount: 0,
    });
  });

  it('falls back to the generation delta when the selected profile omits a capability', () => {
    const unsupportedProfile = JSON.parse(
      JSON.stringify(DEFAULT_THREE_VALUE_MECHANICS_PROFILE)
    );
    unsupportedProfile.profileId = 'unit-test-no-hp-profile';
    unsupportedProfile.profileVersion = 2;
    delete unsupportedProfile.operandKinds['hp-raw-preview-product'];
    unsupportedProfile.supportedOperandKinds = Object.keys(
      unsupportedProfile.operandKinds
    );
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      mechanicsProfileSelection: {
        profileId: unsupportedProfile.profileId,
        profileVersion: unsupportedProfile.profileVersion,
      },
    });
    const gameData = getWorkbenchGameData();
    const baseline = simulateScenario(compileProject(project, gameData));
    const scenario = compileProject(project, gameData, {
      threeValueMechanicsProfiles: [unsupportedProfile],
    });
    const result = simulateScenario(scenario);
    const invocation =
      result.threeValueRuntimeProjection.runtimeAppliedDeltas[0]
        .runtimeCalculatorInvocation;

    expect(scenario.mechanicsProfile).toBe(unsupportedProfile);
    expect(scenario.mechanicsProfileSelection).toMatchObject({
      sourceKind: 'project-persisted-mechanics-profile-selection',
      status: 'mechanics-profile-selection-ready',
      requestedProfileId: 'unit-test-no-hp-profile',
      resolvedProfileId: 'unit-test-no-hp-profile',
      resolvedProfileVersion: 2,
      fallback: false,
    });
    expect(result.threeValueRuntimeProjection.summary.enemyHpDelta).toBe(
      baseline.threeValueRuntimeProjection.summary.enemyHpDelta
    );
    expect(invocation).toMatchObject({
      status: 'runtime-calculator-invocation-ready-with-fallback',
      fallbackReason: 'runtime-calculator-output-invalid',
      mechanicsEvaluation: {
        contractName: 'AzPrThreeValueMechanicsEvaluation',
        contractVersion: 3,
        ready: false,
        capabilityReady: false,
      },
    });
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      runtimeCalculatorFallbackInvocationCount: 1,
      mechanicsProfileIds: ['unit-test-no-hp-profile'],
      mechanicsProfileFallbackInvocationCount: 0,
      mechanicsProfileCapabilityReadyInvocationCount: 0,
      mechanicsProfileCapabilityMissingInvocationCount: 1,
    });
    expect(
      result.threeValueRuntimeProjection.runtimeStateSnapshots
        .calculatorInvocationSummary
    ).toMatchObject({
      mechanicsEvaluationReadyInvocationCount: 0,
      mechanicsEvaluationMissingInvocationCount: 1,
    });
  });

  it('falls back explicitly when a persisted profile version is not registered', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      mechanicsProfileSelection: {
        profileId: 'azpr-unregistered-profile',
        profileVersion: 9,
      },
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(scenario.mechanicsProfile).toBe(
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE
    );
    expect(scenario.mechanicsProfileSelection).toMatchObject({
      sourceKind: 'project-persisted-mechanics-profile-selection',
      status: 'mechanics-profile-selection-ready-with-fallback',
      requestedProfileId: 'azpr-unregistered-profile',
      requestedProfileVersion: 9,
      resolvedProfileId: 'azpr-three-value-preview-v1',
      resolvedProfileVersion: 1,
      fallback: true,
      fallbackReason: 'mechanics-profile-not-registered',
    });
  });
});
