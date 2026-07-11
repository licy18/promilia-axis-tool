import { describe, expect, it } from 'vitest';
import {
  createRuntimeAppliedDeltaFromInvocation,
  createThreeValueRuntimeCalculatorInvocation,
  summarizeThreeValueRuntimeCalculatorInvocations,
} from '../../simulation/runtime/threeValueRuntimeCalculatorInvocation';
import { createThreeValueMechanicsAdapterRegistry } from '../../simulation/mechanics/threeValueMechanicsAdapter';

describe('three value runtime calculator invocation', () => {
  it('passes the generation calculator result through by default', () => {
    const delta = createHpDelta();
    const stateBefore = createStateBefore();
    const invocation = createThreeValueRuntimeCalculatorInvocation({
      delta,
      stateBefore,
    });

    expect(invocation).toMatchObject({
      schemaVersion: 7,
      contractName: 'ThreeValueRuntimeCalculatorInvocation',
      status: 'runtime-calculator-invocation-ready-passthrough',
      sourceDeltaId: 'hp-delta-001',
      trackKey: 'enemyHpDamage',
      outputField: 'hpDelta',
      adapter: {
        version: 1,
        sourceKind: 'default-runtime-passthrough-adapter',
        custom: false,
        replaceable: true,
        contractName: 'AzPrThreeValueMechanicsAdapter',
        contractVersion: 5,
        registrationKey: 'built-in',
        evaluationContractName: 'AzPrThreeValueMechanicsEvaluation',
        evaluationContractVersion: 1,
      },
      output: {
        delta: 120,
        hpDelta: 120,
        toughnessDelta: null,
        energyDelta: null,
        status: 'runtime-mechanics-evaluation-ready',
        calculatedFromLayerInputs: true,
      },
      validation: {
        outputFieldKnown: true,
        outputFinite: true,
        mechanismContextPreserved: true,
        mechanismConfigurationPreserved: true,
        generationRequestPreserved: true,
        actionInputPresent: true,
        hitInputPresent: true,
        sourceValueFinite: true,
        mechanicsEvaluationReady: true,
        stateBeforePresent: true,
        adapterOutputAccepted: true,
        valid: true,
      },
      changed: false,
      preservesGeneratedDelta: true,
      fallbackReason: null,
    });
    expect(invocation.input.sourceDelta).toBe(delta);
    expect(invocation.input.stateBefore).toBe(stateBefore);
    expect(invocation.input.mechanismContext).toBe(delta.mechanismContext);
    expect(invocation.input.mechanismConfiguration).toBe(
      delta.mechanismContext.configuration
    );
    expect(invocation.input).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsAdapter',
      action: { actionId: 'action-001', actorId: 'actor-001' },
      hit: { hitKey: 'action-001:hit:0', frameIndex: 12 },
      sourceValue: {
        value: 120,
        hpDelta: 120,
        toughnessDelta: null,
        energyDelta: null,
        operands: {
          contractName: 'AzPrThreeValueMechanicsOperands',
          kind: 'source-value-identity',
          operation: 'identity',
          expectedDelta: 120,
        },
      },
    });
    expect(invocation.mechanicsEvaluation).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsEvaluation',
      contractVersion: 1,
      status: 'three-value-mechanics-evaluation-ready',
      operation: 'identity',
      requiredLayerKeys: [],
      usedLayers: [],
      intermediate: { value: 120 },
      delta: 120,
      matchesExpected: true,
      ready: true,
    });

    const runtimeDelta = createRuntimeAppliedDeltaFromInvocation(
      delta,
      invocation
    );
    expect(runtimeDelta).toMatchObject({
      sourceDeltaId: 'hp-delta-001',
      delta: 120,
      hpDelta: 120,
      runtimeCalculationChanged: false,
    });
    expect(runtimeDelta.runtimeCalculatorInvocation).toBe(invocation);
  });

  it('falls back to the generation delta when a custom adapter returns an invalid value', () => {
    const invocation = createThreeValueRuntimeCalculatorInvocation({
      delta: createHpDelta(),
      stateBefore: createStateBefore(),
      threeValueMechanicsAdapterRegistry: createThreeValueMechanicsAdapterRegistry({
        enemyHpDamage: {
          key: 'invalid-output-adapter',
          calculate() {
            return {
              delta: Number.NaN,
              status: 'invalid-adapter-claimed-success',
              sourceKind: 'invalid-adapter-result',
            };
          },
        },
      }),
    });

    expect(invocation).toMatchObject({
      status: 'runtime-calculator-invocation-ready-with-fallback',
      adapter: {
        key: 'invalid-output-adapter',
        custom: true,
      },
      output: {
        delta: 120,
        hpDelta: 120,
        status: 'runtime-calculator-fallback-generation-result',
        fallbackReason: 'runtime-calculator-output-invalid',
      },
      changed: false,
      fallbackReason: 'runtime-calculator-output-invalid',
      validation: {
        adapterOutputAccepted: false,
        valid: false,
      },
    });
    expect(
      summarizeThreeValueRuntimeCalculatorInvocations([invocation])
    ).toMatchObject({
      invocationCount: 1,
      passthroughInvocationCount: 1,
      replacedInvocationCount: 0,
      fallbackInvocationCount: 1,
      customAdapterInvocationCount: 1,
      mechanismConfigurationReadyInvocationCount: 1,
      mechanismConfigurationMissingInvocationCount: 0,
      mechanismConfigurationStatuses: ['mechanism-configuration-context-ready'],
      configurationInstanceIds: ['actor-config-001', 'enemy-config-001'],
    });
  });

  it('falls back to the generation delta when a custom adapter throws', () => {
    const invocation = createThreeValueRuntimeCalculatorInvocation({
      delta: createHpDelta(),
      stateBefore: createStateBefore(),
      threeValueMechanicsAdapterRegistry: createThreeValueMechanicsAdapterRegistry({
        enemyHpDamage() {
          throw new Error('unit-test-adapter-failure');
        },
      }),
    });

    expect(invocation).toMatchObject({
      status: 'runtime-calculator-invocation-ready-with-fallback',
      output: {
        delta: 120,
        hpDelta: 120,
        fallbackReason: 'runtime-calculator-adapter-threw',
      },
      changed: false,
      preservesGeneratedDelta: true,
      fallbackReason: 'runtime-calculator-adapter-threw',
    });
  });
});

function createHpDelta() {
  return {
    id: 'hp-delta-001',
    trackKey: 'enemyHpDamage',
    delta: 120,
    hpDelta: 120,
    toughnessDelta: null,
    energyDelta: null,
    mechanismContext: {
      contractName: 'AzPrThreeValueMechanismContext',
      action: {
        actionId: 'action-001',
        actorId: 'actor-001',
        targetId: 'enemy-001',
      },
      hit: {
        hitKey: 'action-001:hit:0',
        frameIndex: 12,
        timeMs: 200,
      },
      configuration: {
        status: 'mechanism-configuration-context-ready',
        ready: true,
        sourceActor: { configurationInstanceId: 'actor-config-001' },
        targetEnemy: { configurationInstanceId: 'enemy-config-001' },
      },
      ownership: {
        energyOwnerActorId: 'actor-001',
        targetEnemyId: 'enemy-001',
      },
    },
    calculator: {
      key: 'azpr-hp-delta-calculator',
      status: 'raw-hp-projection',
      delta: 120,
    },
    calculationStatus: 'raw-hp-projection',
    applied: true,
  };
}

function createStateBefore() {
  return {
    enemyHp: {
      initialValue: 1000,
      currentValue: 1000,
      baselineConfirmed: true,
    },
    enemyToughness: {
      initialValue: 100,
      currentValue: 100,
      baselineConfirmed: true,
    },
    selfEnergy: {
      actorId: 'actor-001',
      initialValue: 0,
      currentValue: 0,
      baselineConfirmed: true,
    },
  };
}
