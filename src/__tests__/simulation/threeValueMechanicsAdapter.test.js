import { describe, expect, it } from 'vitest';
import {
  createThreeValueMechanicsAdapterRegistry,
  createThreeValueMechanicsAdapterRequest,
  createThreeValueMechanicsOperands,
  registerThreeValueMechanicsAdapter,
  registerThreeValueMechanicsOperationHandler,
} from '../../simulation/mechanics/threeValueMechanicsAdapter';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE } from '../../simulation/mechanics/threeValueMechanicsProfile';
import { createThreeValueHpOperandSourceBinding } from '../../simulation/mechanics/threeValueHpOperandSourceBinding';
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
    expect(
      invocations.map(invocation => invocation.stateEffectProposal)
    ).toEqual([
      expect.objectContaining({
        writeMetric: 'enemyHp',
        targetKind: 'enemy',
        targetId: 'enemy-001',
        ready: true,
      }),
      expect.objectContaining({
        writeMetric: 'enemyToughness',
        targetKind: 'enemy',
        targetId: 'enemy-001',
        ready: true,
      }),
      expect.objectContaining({
        writeMetric: 'selfEnergy',
        targetKind: 'actor',
        targetId: 'actor-001',
        ready: true,
      }),
    ]);
    expect(invocations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schemaVersion: 10,
          adapter: expect.objectContaining({
            key: 'unit-test-three-track-mechanics-adapter',
            version: 7,
            contractName: 'AzPrThreeValueMechanicsAdapter',
            contractVersion: 8,
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
      mechanicsAdapterContractVersion: 8,
      registrationKeys: ['default'],
      adapterKeys: ['unit-test-three-track-mechanics-adapter'],
      stateEffectProposalReadyInvocationCount: 3,
      stateEffectProposalMissingInvocationCount: 0,
    });
  });

  it('evaluates current applied values from versioned layer inputs', () => {
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
            status: 'runtime-mechanics-evaluation-ready',
            calculatedFromLayerInputs: true,
          }),
          mechanicsEvaluation: expect.objectContaining({
            contractName: 'AzPrThreeValueMechanicsEvaluation',
            contractVersion: 4,
            ready: true,
            stepResults: [expect.objectContaining({ ready: true })],
          }),
          validation: expect.objectContaining({
            mechanicsEvaluationReady: true,
            valid: true,
          }),
        }),
      ])
    );
    expect(
      summarizeThreeValueRuntimeCalculatorInvocations(invocations)
    ).toMatchObject({
      invocationCount: 4,
      mechanicsEvaluationReadyInvocationCount: 4,
      mechanicsEvaluationMissingInvocationCount: 0,
      mechanicsEvaluationOperations: expect.arrayContaining([
        'round-clamped-product',
        'sum',
        'before-minus-after',
        'after-minus-before',
      ]),
    });
  });

  it('falls back when a required applied layer input is missing', () => {
    const operands = createThreeValueMechanicsOperands({
      trackKey: 'enemyHpDamage',
      sourceKind: 'action-result-applied-value',
      value: 120,
      formulaBreakdown: {
        layers: {
          baseAttack: { value: 1000 },
          actionMultiplier: { value: 0.12 },
        },
      },
    });
    const delta = createDelta({
      trackKey: 'enemyHpDamage',
      outputField: 'hpDelta',
      value: 120,
      operands,
    });
    delta.mechanismContext.sourceActor.stats.attack = null;

    const invocation = createThreeValueRuntimeCalculatorInvocation({
      delta,
      stateBefore: createStateBefore(),
    });

    expect(invocation).toMatchObject({
      status: 'runtime-calculator-invocation-ready-with-fallback',
      fallbackReason: 'runtime-calculator-output-invalid',
      mechanicsEvaluation: {
        status: 'three-value-mechanics-evaluation-invalid',
        stepResults: [
          expect.objectContaining({
            key: 'raw-product',
            usedLayers: expect.arrayContaining([
              expect.objectContaining({
                layerKey: 'baseAttack',
                inputKey: 'actorStats',
                ready: false,
              }),
            ]),
            status: 'step-input-missing',
            ready: false,
          }),
        ],
        delta: null,
        ready: false,
      },
      output: {
        delta: 120,
        hpDelta: 120,
        status: 'runtime-calculator-fallback-generation-result',
      },
      validation: {
        mechanicsLayerInputsAppliedReady: false,
        mechanicsEvaluationReady: false,
        adapterOutputAccepted: false,
        valid: false,
      },
    });
  });

  it('executes a registered follow-up profile step without changing runtime', () => {
    const profile = JSON.parse(
      JSON.stringify(DEFAULT_THREE_VALUE_MECHANICS_PROFILE)
    );
    profile.profileId = 'unit-test-two-step-profile';
    profile.profileVersion = 2;
    profile.operandKinds['hp-raw-preview-product'].steps.push({
      key: 'unit-test-add-five',
      operation: 'unit-test-add',
      layerKeys: [],
    });
    const operands = createThreeValueMechanicsOperands({
      trackKey: 'enemyHpDamage',
      sourceKind: 'action-result-applied-value',
      value: 120,
      formulaBreakdown: {
        layers: {
          baseAttack: { value: 1000 },
          actionMultiplier: { value: 0.12 },
        },
      },
    });
    const delta = createDelta({
      trackKey: 'enemyHpDamage',
      outputField: 'hpDelta',
      value: 120,
      operands,
      mechanicsProfile: profile,
    });
    const missingHandlerInvocation =
      createThreeValueRuntimeCalculatorInvocation({
        delta,
        stateBefore: createStateBefore(),
      });
    const registry = registerThreeValueMechanicsOperationHandler(
      createThreeValueMechanicsAdapterRegistry(),
      'unit-test-add',
      ({ previousDelta }) => previousDelta + 5
    );
    const invocation = createThreeValueRuntimeCalculatorInvocation({
      delta,
      stateBefore: createStateBefore(),
      threeValueMechanicsAdapterRegistry: registry,
    });

    expect(missingHandlerInvocation).toMatchObject({
      status: 'runtime-calculator-invocation-ready-with-fallback',
      fallbackReason: 'runtime-calculator-output-invalid',
      output: { delta: 120, hpDelta: 120 },
      mechanicsEvaluation: {
        stepResults: [
          expect.objectContaining({ key: 'raw-product', ready: true }),
          expect.objectContaining({
            key: 'unit-test-add-five',
            status: 'step-handler-missing',
            ready: false,
          }),
        ],
        ready: false,
      },
    });
    expect(registry.operationHandlers).toHaveProperty('unit-test-add');
    expect(invocation).toMatchObject({
      status: 'runtime-calculator-invocation-ready-replaced',
      output: {
        delta: 125,
        hpDelta: 125,
        calculatedFromLayerInputs: true,
      },
      mechanicsEvaluation: {
        stepResults: [
          expect.objectContaining({
            key: 'raw-product',
            delta: 120,
            ready: true,
          }),
          expect.objectContaining({
            key: 'unit-test-add-five',
            delta: 125,
            ready: true,
          }),
        ],
        delta: 125,
        ready: true,
      },
      changed: true,
      fallbackReason: null,
    });
  });

  it('preserves the HP result while exposing skill variant source drift', () => {
    const variantSource = {
      kind: 'azpr-local-hero-module-skill-level-action-variant',
      path: 'unit-test/skill.json',
      skillId: 10100101,
      characterId: 101001,
      level: 1,
      levelIndex: 0,
      labelField: 'level.labels[0]',
      valueField: 'level.values[0][0]',
    };
    const variant = {
      index: 0,
      rawValue: '12%',
      multiplier: 0.12,
      source: variantSource,
    };
    const gameDataReference = {
      ready: true,
      referenceIdentity: 'azpr-action-skill-v1-unit-test',
      skillVariantReferenceIdentity: 'azpr-skill-variant-v1-unit-test',
      variant,
      skill: {
        compatible: true,
        id: 10100101,
        resolvedCharacterId: 101001,
        catalogId: 'azpr-workbench-game-data',
        catalogVersion: 1,
        dataVersion: 'unit-test-data',
        skillVariantReferenceIdentity: 'azpr-skill-variant-v1-unit-test',
        variant,
      },
    };
    const sourceBinding = createThreeValueHpOperandSourceBinding({
      action: {
        id: 'action-001',
        type: 'skill',
        skillId: 10100101,
        actorId: 'actor-001',
        actionVariantIndex: 0,
        gameDataReference,
      },
      actor: {
        id: 'actor-001',
        characterId: 101001,
        stats: { attack: 1000, source: 'unit-test-actor-panel' },
      },
      segment: {
        index: 0,
        actionVariantIndex: 0,
        rawValue: '12%',
        multiplier: 0.12,
        source: variantSource,
      },
      gameDataReference,
    });
    const operands = createThreeValueMechanicsOperands({
      trackKey: 'enemyHpDamage',
      sourceKind: 'action-result-applied-value',
      value: 120,
      formulaBreakdown: {
        operandSourceBinding: sourceBinding,
        layers: {
          baseAttack: { value: 1000 },
          actionMultiplier: { value: 0.12 },
        },
      },
    });
    const driftedDelta = structuredClone(
      createDelta({
        trackKey: 'enemyHpDamage',
        outputField: 'hpDelta',
        value: 120,
        operands,
        gameDataReference,
      })
    );
    driftedDelta.mechanicsAdapterRequest.sourceValue.operands.sourceBinding.skillVariantReference.identity =
      'azpr-skill-variant-v1-drifted';
    const invocation = createThreeValueRuntimeCalculatorInvocation({
      delta: driftedDelta,
      stateBefore: createStateBefore(),
    });

    expect(sourceBinding).toMatchObject({
      status: 'hp-operand-source-binding-ready',
      ready: true,
    });
    expect(operands).toMatchObject({
      contractVersion: 2,
      sourceBindingRequired: true,
      sourceBindingReady: true,
    });
    expect(invocation).toMatchObject({
      output: {
        delta: 120,
        hpDelta: 120,
        status:
          'runtime-mechanics-evaluation-ready-with-operand-source-diagnostics',
      },
      mechanicsEvaluation: {
        contractVersion: 4,
        ready: true,
        operandSourceBindingRequired: true,
        operandSourceBindingReady: false,
        operandSourceBindingValidation: {
          status: 'hp-operand-source-binding-drift-detected',
          issueCodes: ['skill-variant-reference-identity-mismatch'],
        },
      },
      validation: {
        operandSourceBindingReady: false,
        valid: false,
      },
      changed: false,
      preservesGeneratedDelta: true,
    });
    expect(
      summarizeThreeValueRuntimeCalculatorInvocations([invocation])
    ).toMatchObject({
      operandSourceBindingRequiredInvocationCount: 1,
      operandSourceBindingReadyInvocationCount: 0,
      operandSourceBindingInvalidInvocationCount: 1,
      operandSourceBindingIssueCodes: [
        'skill-variant-reference-identity-mismatch',
      ],
    });
  });
});

function createDelta({
  trackKey,
  value,
  outputField,
  operands,
  mechanicsProfile,
  gameDataReference = null,
}) {
  const action = {
    actionId: 'action-001',
    actionType: 'skill',
    actorId: 'actor-001',
    targetId: 'enemy-001',
    skillId: gameDataReference?.skill?.id ?? null,
    actionVariantIndex: gameDataReference?.variant?.index ?? null,
    gameDataReference,
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
  const mechanismContext = {
    action,
    hit,
    sourceActor: {
      stats: { attack: 1000 },
      energy: { initialValue: 0 },
    },
    targetEnemy: {
      level: 1,
      stats: { physicalDefense: 0, magicalDefense: 0 },
      elementDefenses: [],
    },
    configuration: mechanismConfiguration,
    mechanicsProfile,
    ownership: {
      energyOwnerActorId: 'actor-001',
      targetEnemyId: 'enemy-001',
    },
  };
  const mechanicsAdapterRequest = createThreeValueMechanicsAdapterRequest({
    trackKey,
    outputField,
    action,
    hit,
    mechanismConfiguration,
    mechanicsProfile,
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
    mechanismContext,
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
