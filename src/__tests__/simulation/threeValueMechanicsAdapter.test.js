import { describe, expect, it } from 'vitest';
import {
  createThreeValueMechanicsAdapterRegistry,
  createThreeValueMechanicsAdapterRequest,
  createThreeValueMechanicsOperands,
  registerThreeValueMechanicsAdapter,
} from '../../simulation/mechanics/threeValueMechanicsAdapter';
import {
  createThreeValueRuntimeCalculatorInvocation,
  summarizeThreeValueRuntimeCalculatorInvocations,
} from '../../simulation/runtime/threeValueRuntimeCalculatorInvocation';

describe('three value mechanics adapter', () => {
  it('routes all three tracks through one registered contract with explicit inputs', () => {
    const calls = [];
    const emptyRegistry = createThreeValueMechanicsAdapterRegistry();
    const registry = registerThreeValueMechanicsAdapter(
      emptyRegistry,
      'default',
      {
        key: 'unit-test-three-track-mechanics-adapter',
        version: 7,
        sourceKind: 'unit-test-mechanics-adapter',
        calculate(input) {
          calls.push(input);
          return {
            delta: input.sourceValue.value,
            status: 'unit-test-mechanics-value-preserved',
            sourceKind: 'unit-test-mechanics-result',
          };
        },
      }
    );
    const stateBefore = createStateBefore();
    const invocations = [
      createDelta({
        trackKey: 'enemyHpDamage',
        value: 120,
        outputField: 'hpDelta',
      }),
      createDelta({
        trackKey: 'enemyToughnessDamage',
        value: 18,
        outputField: 'toughnessDelta',
      }),
      createDelta({
        trackKey: 'selfEnergyChange',
        value: -25,
        outputField: 'energyDelta',
      }),
    ].map(delta =>
      createThreeValueRuntimeCalculatorInvocation({
        delta,
        stateBefore,
        threeValueMechanicsAdapterRegistry: registry,
      })
    );

    expect(emptyRegistry.registrationKeys).toEqual([]);
    expect(registry.registrationKeys).toEqual(['default']);
    expect(invocations.map(invocation => invocation.output.delta)).toEqual([
      120, 18, -25,
    ]);
    expect(invocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaVersion: 4,
          adapter: expect.objectContaining({
            key: 'unit-test-three-track-mechanics-adapter',
            version: 7,
            contractName: 'AzPrThreeValueMechanicsAdapter',
            contractVersion: 2,
            registrationKey: 'default',
            custom: true,
          }),
          validation: expect.objectContaining({
            actionInputPresent: true,
            hitInputPresent: true,
            sourceValueFinite: true,
            stateBeforePresent: true,
            valid: true,
          }),
        }),
      ])
    );
    expect(calls).toHaveLength(3);
    for (const input of calls) {
      expect(input).toMatchObject({
        contractName: 'AzPrThreeValueMechanicsAdapter',
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
        mechanismConfiguration: {
          status: 'mechanism-configuration-context-ready',
          ready: true,
        },
        bindingStatus: 'mechanics-adapter-input-ready',
      });
      expect(input.stateBefore).toBe(stateBefore);
      expect(input.sourceValue.value).toBe(input.generatedDelta.delta);
    }
    expect(
      summarizeThreeValueRuntimeCalculatorInvocations(invocations)
    ).toMatchObject({
      invocationCount: 3,
      passthroughInvocationCount: 3,
      customAdapterInvocationCount: 3,
      mechanicsAdapterContractName: 'AzPrThreeValueMechanicsAdapter',
      mechanicsAdapterContractVersion: 2,
      registrationKeys: ['default'],
      adapterKeys: ['unit-test-three-track-mechanics-adapter'],
    });
  });

  it('recalculates current applied values from versioned operands', () => {
    const stateBefore = createStateBefore();
    const cases = [
      {
        trackKey: 'enemyHpDamage',
        outputField: 'hpDelta',
        value: 120,
        operands: createThreeValueMechanicsOperands({
          trackKey: 'enemyHpDamage',
          sourceKind: 'action-result-applied-value',
          value: 120,
          formulaBreakdown: {
            layers: {
              baseAttack: { value: 1000 },
              actionMultiplier: { value: 0.12 },
            },
          },
        }),
      },
      {
        trackKey: 'selfEnergyChange',
        outputField: 'energyDelta',
        value: -20,
        operands: createThreeValueMechanicsOperands({
          trackKey: 'selfEnergyChange',
          sourceKind: 'action-result-applied-value',
          value: -20,
          formulaBreakdown: {
            layers: {
              explicitResourceDelta: {
                events: [{ change: -25 }, { change: 5 }],
              },
            },
          },
        }),
      },
      {
        trackKey: 'enemyToughnessDamage',
        outputField: 'toughnessDelta',
        value: 18,
        operands: createThreeValueMechanicsOperands({
          trackKey: 'enemyToughnessDamage',
          sourceKind: 'azpr-validated-runtime-mechanism-sample',
          value: 18,
          sampleValidation: { before: 100, after: 82, delta: 18 },
        }),
      },
      {
        trackKey: 'selfEnergyChange',
        outputField: 'energyDelta',
        value: 0.3375,
        operands: createThreeValueMechanicsOperands({
          trackKey: 'selfEnergyChange',
          sourceKind: 'azpr-validated-runtime-mechanism-sample',
          value: 0.3375,
          sampleValidation: {
            before: 10,
            after: 10.3375,
            delta: 0.3375,
          },
        }),
      },
    ];
    const invocations = cases.map(item =>
      createThreeValueRuntimeCalculatorInvocation({
        delta: createDelta(item),
        stateBefore,
      })
    );

    expect(invocations.map(invocation => invocation.output.delta)).toEqual([
      120, -20, 18, 0.3375,
    ]);
    expect(invocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          output: expect.objectContaining({
            status: 'runtime-mechanics-operands-calculated',
            calculatedFromOperands: true,
            operandsMatchSource: true,
          }),
          validation: expect.objectContaining({
            operandsPresent: true,
            operandsReady: true,
            operandsMatchSource: true,
            valid: true,
          }),
        }),
      ])
    );
    expect(
      summarizeThreeValueRuntimeCalculatorInvocations(invocations)
    ).toMatchObject({
      invocationCount: 4,
      operandsReadyInvocationCount: 4,
      operandsMissingInvocationCount: 0,
      operandsMismatchInvocationCount: 0,
      operandsCalculatedInvocationCount: 4,
      operandsKinds: expect.arrayContaining([
        'hp-raw-preview-product',
        'explicit-self-energy-event-sum',
        'validated-toughness-before-after',
        'validated-self-energy-before-after',
      ]),
    });
  });
});

function createDelta({ trackKey, value, outputField, operands }) {
  const action = {
    actionId: 'action-001',
    actionType: 'skill',
    actorId: 'actor-001',
    targetId: 'enemy-001',
  };
  const hit = {
    hitKey: 'action-001:hit:0',
    hitIndex: 0,
    frameIndex: 12,
    timeMs: 200,
  };
  const mechanismConfiguration = {
    status: 'mechanism-configuration-context-ready',
    ready: true,
    sourceActor: { configurationInstanceId: 'actor-config-001' },
    targetEnemy: { configurationInstanceId: 'enemy-config-001' },
  };
  const fields = {
    hpDelta: trackKey === 'enemyHpDamage' ? value : null,
    toughnessDelta: trackKey === 'enemyToughnessDamage' ? value : null,
    energyDelta: trackKey === 'selfEnergyChange' ? value : null,
  };
  const mechanicsAdapterRequest = createThreeValueMechanicsAdapterRequest({
    trackKey,
    outputField,
    action,
    hit,
    mechanismConfiguration,
    sourceValue: {
      value,
      ...fields,
      sourceKind: 'unit-test-source-value',
      status: 'unit-test-source-value-ready',
      operands,
    },
  });

  return {
    id: `${trackKey}-delta-001`,
    actionId: action.actionId,
    hitKey: hit.hitKey,
    trackKey,
    delta: value,
    ...fields,
    mechanicsAdapterRequest,
    mechanismContext: {
      action,
      hit,
      configuration: mechanismConfiguration,
      ownership: {
        energyOwnerActorId: 'actor-001',
        targetEnemyId: 'enemy-001',
      },
    },
    calculator: {
      status: 'unit-test-calculator-result',
    },
    applied: true,
  };
}

function createStateBefore() {
  return {
    enemyHp: { currentValue: 1000, baselineConfirmed: true },
    enemyToughness: { currentValue: 100, baselineConfirmed: true },
    selfEnergy: {
      actorId: 'actor-001',
      currentValue: 50,
      baselineConfirmed: true,
    },
  };
}
