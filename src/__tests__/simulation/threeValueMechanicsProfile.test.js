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
      contractVersion: 1,
      profileId: 'azpr-three-value-preview-v1',
      profileVersion: 1,
      ready: true,
      supportedOperandKinds: expect.arrayContaining([
        'hp-raw-preview-product',
        'explicit-self-energy-event-sum',
        'validated-toughness-before-after',
        'validated-self-energy-before-after',
      ]),
      policy: {
        unconfirmedFormulaLayersApplied: false,
        unconfirmedCultivationEffectsApplied: false,
        runtimeSamplesRequireValidation: true,
        unsupportedOperandsFallbackToGenerationDelta: true,
      },
    });
    expect(scenario.mechanicsProfileSelection).toMatchObject({
      status: 'mechanics-profile-selection-ready',
      requestedProfileId: 'azpr-three-value-preview-v1',
      resolvedProfileId: 'azpr-three-value-preview-v1',
      fallback: false,
    });
    expect(generatedDelta.mechanicsAdapterRequest.mechanicsProfile).toBe(
      scenario.mechanicsProfile
    );
    expect(
      runtimeDelta.runtimeCalculatorInvocation.input.mechanicsProfile
    ).toBe(scenario.mechanicsProfile);
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      mechanicsProfileIds: ['azpr-three-value-preview-v1'],
      mechanicsProfileVersions: [1],
      mechanicsProfileFallbackInvocationCount: 0,
      mechanicsProfileCapabilityReadyInvocationCount: 1,
      mechanicsProfileCapabilityMissingInvocationCount: 0,
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
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    const gameData = getWorkbenchGameData();
    const baseline = simulateScenario(compileProject(project, gameData));
    const scenario = compileProject(project, gameData, {
      threeValueMechanicsProfile: unsupportedProfile,
    });
    const result = simulateScenario(scenario);
    const invocation =
      result.threeValueRuntimeProjection.runtimeAppliedDeltas[0]
        .runtimeCalculatorInvocation;

    expect(scenario.mechanicsProfile).toBe(unsupportedProfile);
    expect(scenario.mechanicsProfileSelection).toMatchObject({
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
      operandsCalculation: {
        ready: false,
        profileId: 'unit-test-no-hp-profile',
        profileVersion: 2,
        capabilityStatus: 'mechanics-profile-capability-unsupported',
        capabilityFallbackReason: 'mechanics-profile-operand-kind-unsupported',
      },
      output: {
        mechanicsProfileId: 'unit-test-no-hp-profile',
        mechanicsProfileVersion: 2,
        mechanicsProfileFallback: false,
        mechanicsProfileCapabilityStatus:
          'mechanics-profile-capability-unsupported',
      },
    });
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      runtimeCalculatorFallbackInvocationCount: 1,
      mechanicsProfileIds: ['unit-test-no-hp-profile'],
      mechanicsProfileFallbackInvocationCount: 0,
      mechanicsProfileCapabilityReadyInvocationCount: 0,
      mechanicsProfileCapabilityMissingInvocationCount: 1,
    });
  });
});
