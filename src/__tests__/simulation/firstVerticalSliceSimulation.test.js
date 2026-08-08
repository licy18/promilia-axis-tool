import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import workbenchSkillDiagnostics from '../../data/generated/workbench-skill-diagnostics.json';
import {
  createFirstVerticalSliceProject,
  getFirstVerticalSliceGameData,
} from '../../domain/fixtures/firstVerticalSlice';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import {
  compileProject,
  CompileProjectError,
  runSimulation,
} from '../../simulation';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';
import { createToughnessRuntimeSampleFixture } from '../../simulation/fixtures/toughnessRuntimeSampleFixture';
import {
  installProjectSimulationSkillDiagnostics,
  resetProjectSimulationSkillDiagnostics,
} from '../../simulation/projection/projectSimulationResult';

beforeAll(() => {
  installProjectSimulationSkillDiagnostics(workbenchSkillDiagnostics);
});

afterAll(() => {
  resetProjectSimulationSkillDiagnostics();
});

describe('first vertical slice simulation', () => {
  it('compiles the real-data fixture into a scenario', () => {
    const project = createFirstVerticalSliceProject();
    const scenario = compileProject(project, getFirstVerticalSliceGameData());

    expect(scenario.sourceProject.id).toBe('fixture-first-vertical-slice');
    expect(scenario.actors).toHaveLength(1);
    expect(scenario.actions).toHaveLength(1);
    expect(scenario.enemy.name).toBe('迅狼');
    expect(scenario.actors[0].attributePanel.core.attack).toMatchObject({
      displayText: '1920',
      effectiveValue: 1920,
    });
    expect(scenario.actors[0].stats).toMatchObject({
      attack: 1920,
      maxHp: 10748,
      source: 'character-attribute-panel-current-rank',
    });
    expect(scenario.actions[0].actor.name).toBe('末音');
    expect(scenario.actions[0].selectedDamageSegment.label).toBe('普攻');
    expect(scenario.actions[0].selectedDamageSegment.multiplier).toBeCloseTo(
      6.49
    );
    expect(scenario.actions[0].selectedActionVariant).toBe(
      scenario.actions[0].selectedDamageSegment
    );
    expect(scenario.actions[0].selectedDamageSegment.hitModel).toMatchObject({
      hitCount: 5,
      distributionStatus: 'total-only',
    });
    expect(scenario.actions[0].damageModel).toMatchObject({
      source: 'azpr-local-hero-module-skill-level-action-variant',
      sourceKind: 'azpr-local-hero-module-skill-level-action-variant',
      skillId: 10900101,
      characterId: 109001,
      fieldPaths: {
        labels: 'skillSystem.10900101.skillLevel.name',
        values: 'skillSystem.10900101.skillLevel.values[0]',
      },
      crossCheck: {
        sourceKind: 'azpr-newtable-skill-level-crosscheck',
        status: 'matched',
        rowId: 1657,
        labels: ['普攻', '重击', '闪击', '跃击'],
        values: ['649%', '190%', '40%', '136%'],
      },
    });
    expect(scenario.actions[0].damageModel.sourcePath).toContain(
      '109001.hero-module.local.json'
    );
    expect(scenario.actions[0].logicModel).toMatchObject({
      sourceKind: 'azpr-newtable-skill-logic-index',
      status: 'mapped',
      skillId: 10900101,
      subSkillId: 10900101,
      skillLevelRowId: 1657,
      display: {
        sourceKind: 'azpr-newtable-skill-level-display',
        cooldownMs: 0,
        spCost: 0,
      },
      logic: {
        cooldownMs: 0,
        spCost: 0,
        selfCooldownMs: 0,
        gcdMs: 0,
        displayMatchesLogic: true,
      },
      elementValues: [
        {
          rowId: 973,
          elementId: 109001081,
          valueParam: '1#1600|7#10000',
        },
        {
          rowId: 985,
          elementId: 109001306,
          valueParam: '1#1600|7#10000',
        },
      ],
      valueParamSummary: {
        uniqueParamIds: [1, 7],
        directMatchCount: 0,
        unmatchedSegmentCount: 4,
      },
    });
    expect(
      scenario.actions[0].logicModel.damageParameterLinks[0]
    ).toMatchObject({
      segmentIndex: 0,
      label: '普攻',
      rawValue: '649%',
      status: 'unmatched',
      unmatchedParamIds: [1, 7],
    });
    expect(scenario.actions[0].selectedDamageSegment.source).toMatchObject({
      kind: 'azpr-local-hero-module-skill-level-action-variant',
      skillId: 10900101,
      characterId: 109001,
      valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
      crossCheck: {
        kind: 'azpr-newtable-skill-level-crosscheck',
        status: 'matched',
        rowId: 1657,
        valueId: '7116760813824',
      },
      valueParamLink: {
        segmentIndex: 0,
        rawValue: '649%',
        status: 'unmatched',
        unmatchedParamIds: [1, 7],
      },
    });
    expect(scenario.diagnostics.missingTimingActionIds).toEqual([
      'action-0001',
    ]);
  });

  it('runs the minimal engine and projects raw damage with limitations marked', () => {
    const project = createFirstVerticalSliceProject();
    const gameData = getFirstVerticalSliceGameData();
    const result = runSimulation(project, gameData);
    const eventTypes = result.eventLog.map(event => event.type);

    expect(eventTypes).toContain('SCENARIO_START');
    expect(eventTypes).toContain('ACTION_START');
    expect(eventTypes).toContain('TIMING_DATA_MISSING');
    expect(eventTypes).toContain('DAMAGE_PROJECTED');
    expect(eventTypes).toContain('SCENARIO_END');
    expect(result.actionRuleDiagnostics).toMatchObject({
      contractName: 'AzPrActionRuleDiagnostics',
      status: 'action-rules-ready',
      executable: true,
      diagnostics: [],
      summary: {
        violationCount: 0,
        unresolvedCount: 0,
        appliedToSimulationResults: false,
      },
    });
    expect(result.diagnostics.actionRules).toBe(result.actionRuleDiagnostics);
    expect(result.summary.actionRuleDiagnosticsSummary).toBe(
      result.actionRuleDiagnostics.summary
    );
    expect(result.actionReadinessTimeline).toBe(
      result.actionRuleDiagnostics.readinessTimeline
    );
    expect(result.actionReadinessTimeline).toMatchObject({
      contractName: 'AzPrActionReadinessTimeline',
      status: 'action-readiness-timeline-ready',
      summary: {
        actionCount: 1,
        readyActionCount: 1,
        blockedActionCount: 0,
        cooldownWindowCount: 0,
      },
      actions: [
        {
          actionId: 'action-0001',
          status: 'ready',
          executable: true,
        },
      ],
    });
    expect(result.summary.actionReadinessTimelineSummary).toBe(
      result.actionReadinessTimeline.summary
    );

    expect(result.damageTimeline).toHaveLength(1);
    expect(result.damageTimeline[0]).toMatchObject({
      actionId: 'action-0001',
      attack: 1920,
      attackSource: 'character-attribute-panel-current-rank',
      rawDamage: 12461,
      formulaVersion: 'stage5-damage-layer-breakdown-v1',
      formulaBreakdown: {
        status: 'partial',
        expression: 'round(baseAttack.value * actionMultiplier.value)',
        result: 12461,
        appliedLayerKeys: ['baseAttack', 'actionMultiplier'],
        unappliedLayerKeys: [
          'enemyDefense',
          'enemyResistance',
          'critical',
          'damageBonus',
        ],
        layers: {
          baseAttack: {
            value: 1920,
            source: 'character-attribute-panel-current-rank',
            applied: true,
          },
          actionMultiplier: {
            value: 6.49,
            rawValue: '649%',
            actionVariantIndex: 0,
            applied: true,
          },
          enemyDefense: {
            applied: false,
            status: 'evidence-found-formula-unmapped',
            defenseMultiplier: 1,
            source: {
              kind: 'azpr-combat-formula-evidence-index',
              file: 'src/data/generated/combat-formula-evidence.json',
              status: 'enemy-property-attributes-found',
              relationStatus: 'no-direct-elementId-to-element_formula-id-match',
              sourceChain:
                'enemy.propertyId -> unit_property.baseAttributeId -> template_value.baseAttribute -> battle_info.attrVal',
              propertyId: 300032,
              baseAttributeId: 300032,
              attributeValues: expect.arrayContaining([
                expect.objectContaining({ key: 'DEF', value: 9000 }),
                expect.objectContaining({ key: 'MDEF', value: 9000 }),
              ]),
            },
          },
          enemyResistance: {
            applied: false,
            status: 'evidence-found-formula-unmapped',
            source: {
              kind: 'azpr-combat-formula-evidence-index',
              file: 'src/data/generated/combat-formula-evidence.json',
              elementValueStatus:
                'element-values-have-params-but-no-direct-formula-id-link',
              actionElementId: 4,
              attributeValues: expect.arrayContaining([
                expect.objectContaining({
                  key: 'NORMAL_DEFENSE',
                  value: 0,
                }),
                expect.objectContaining({ key: 'FIRE_DEFENSE', value: 0 }),
              ]),
            },
          },
          critical: {
            applied: false,
            status: 'placeholder',
          },
          damageBonus: {
            applied: false,
            status: 'placeholder',
          },
        },
      },
      segmentLabel: '普攻',
      confidence: 'low',
      precision: 'raw-pre-mitigation',
      timingAccuracy: 'placeholder',
      segment: {
        source: {
          kind: 'azpr-local-hero-module-skill-level-action-variant',
          valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
          crossCheck: {
            kind: 'azpr-newtable-skill-level-crosscheck',
            rowId: 1657,
            valueId: '7116760813824',
          },
          valueParamLink: {
            segmentIndex: 0,
            rawValue: '649%',
            status: 'unmatched',
            unmatchedParamIds: [1, 7],
          },
        },
      },
    });
    expect(result.damageTimeline[0].rawDamage).toBeGreaterThan(0);
    expect(result.actionResultTimeline).toHaveLength(1);
    expect(result.actionResultTimeline[0]).toMatchObject({
      actionId: 'action-0001',
      hpDamage: {
        value: 12461,
        applied: true,
        status: 'raw-hp-projection',
        sourceEvidence: {
          status: 'candidate-fields-found',
          skillId: 10900101,
          actionVariantIndex: 0,
          actionVariantLabel: '普攻',
          logicElementIds: [109001081, 109001306],
          matchedElementConfigIds: [109001081, 109001306],
          unbridgedElementConfigIds: [109001251],
          candidateCount: 2,
          bridgeMatchedLevelRows: 24,
          formulaSlotAlignmentSummary: [
            expect.objectContaining({
              id: 1,
              variable: 'A',
              relationStatus: 'level-scaling-override-candidate',
              formulaParamValue: 1000,
              firstLevelValue: 1600,
              lastLevelValue: 3360,
              progression: {
                status: 'arithmetic-progression',
                step: 160,
                isArithmetic: true,
              },
              candidateCount: 2,
            }),
            expect.objectContaining({
              id: 7,
              variable: 'G',
              relationStatus: 'constant-direct-slot-match',
              formulaParamValue: 10000,
              firstLevelValue: 10000,
              lastLevelValue: 10000,
              candidateCount: 2,
            }),
          ],
          formulaFunctionSummary: [
            expect.objectContaining({
              field: 'function_1',
              functionId: 1,
              status: 'element_formula-row-found',
              relationStatus:
                'function-id-matches-element_formula-id-candidate',
              functionOutput: 'G/10000',
              variables: ['G'],
              candidateElementConfigIds: [109001081, 109001306],
              candidateCount: 2,
              applied: false,
              variableInputs: [
                {
                  variable: 'G',
                  paramId: 7,
                  formulaParamSlot: 7,
                  formulaParamValue: 10000,
                  slotStatus: 'formula-param-slot-found',
                  candidateCount: 2,
                },
              ],
            }),
            expect.objectContaining({
              field: 'function_2',
              functionId: 2,
              status: 'element_formula-row-found',
              relationStatus:
                'function-id-matches-element_formula-id-candidate',
              functionOutput: '(self.ATK[0]*A)/10000',
              variables: ['A'],
              candidateElementConfigIds: [109001081, 109001306],
              candidateCount: 2,
              applied: false,
              variableInputs: [
                {
                  variable: 'A',
                  paramId: 1,
                  formulaParamSlot: 1,
                  formulaParamValue: 1000,
                  slotStatus: 'formula-param-slot-found',
                  candidateCount: 2,
                },
              ],
            }),
          ],
          formulaCandidatePreview: {
            status: 'candidate-preview-computed-combination-unconfirmed',
            applied: false,
            baseAttack: {
              key: 'self.ATK[0]',
              value: 1920,
              source: 'character-attribute-panel-current-rank',
            },
            rawProjection: {
              value: 12461,
              expression: 'round(baseAttack.value * actionMultiplier.value)',
              actionMultiplier: 6.49,
              rawMultiplier: '649%',
              source: 'current-skill-level-description-raw-projection',
            },
            functionPreviews: expect.arrayContaining([
              expect.objectContaining({
                elementConfigId: 109001081,
                field: 'function_1',
                functionId: 1,
                functionOutput: 'G/10000',
                status: 'preview-computed',
                applied: false,
                formulaParamPreview: expect.objectContaining({
                  inputSource: 'TDamageElementParams.formulaParamValues',
                  value: 1,
                  roundedValue: 1,
                  status: 'computed',
                }),
                currentLevelPreview: expect.objectContaining({
                  inputSource: 'skill_logic.currentLevel.valueParam',
                  valueParam: '1#1600|7#10000',
                  rowId: 973,
                  value: 1,
                  roundedValue: 1,
                  status: 'computed',
                }),
                comparison: {
                  status: 'not-compared-scalar-candidate',
                  reason: 'formula-output-does-not-reference-self-attack',
                },
              }),
              expect.objectContaining({
                elementConfigId: 109001081,
                field: 'function_2',
                functionId: 2,
                functionOutput: '(self.ATK[0]*A)/10000',
                status: 'preview-computed',
                applied: false,
                formulaParamPreview: expect.objectContaining({
                  inputSource: 'TDamageElementParams.formulaParamValues',
                  value: 192,
                  roundedValue: 192,
                  status: 'computed',
                }),
                currentLevelPreview: expect.objectContaining({
                  inputSource: 'skill_logic.currentLevel.valueParam',
                  valueParam: '1#1600|7#10000',
                  rowId: 973,
                  value: 307.2,
                  roundedValue: 307,
                  status: 'computed',
                  inputs: expect.arrayContaining([
                    expect.objectContaining({
                      key: 'A',
                      paramId: 1,
                      value: 1600,
                      source: 'skill_logic.currentLevel.valueParam',
                      formulaParamValue: 1000,
                      currentLevelValue: 1600,
                    }),
                  ]),
                }),
                comparison: expect.objectContaining({
                  status: 'compared-to-raw-projection',
                  rawProjectionValue: 12461,
                  previewRoundedValue: 307,
                  delta: -12154,
                  differenceStatus: 'large-difference',
                }),
              }),
            ]),
            combinationPreviews: expect.arrayContaining([
              expect.objectContaining({
                elementConfigId: 109001081,
                strategy: 'function_2-current-level-value-param',
                expression: 'function_2',
                inputSource: 'skill_logic.currentLevel.valueParam',
                functionValues: {
                  function_2: 307.2,
                },
                value: 307.2,
                roundedValue: 307,
                hitCount: 5,
                comparison: expect.objectContaining({
                  status: 'compared-to-raw-projection',
                  rawProjectionValue: 12461,
                  previewRoundedValue: 307,
                  delta: -12154,
                  differenceStatus: 'large-difference',
                }),
                status: 'combination-preview-computed',
                applied: false,
              }),
              expect.objectContaining({
                elementConfigId: 109001081,
                strategy:
                  'function_1-plus-function_2-current-level-value-param',
                expression: 'function_1 + function_2',
                value: 308.2,
                roundedValue: 308,
                hitCount: 5,
                comparison: expect.objectContaining({
                  status: 'compared-to-raw-projection',
                  differenceStatus: 'large-difference',
                }),
                applied: false,
              }),
            ]),
            diagnostics: {
              comparablePreviewCount: 2,
              largeDifferenceCount: 2,
              combinationPreviewCount: 12,
              combinationLargeDifferenceCount: 12,
              statuses: ['not-compared-scalar-candidate', 'large-difference'],
              note: 'Preview values are evidence diagnostics only. They do not define DamageElement function combination order or final damage.',
            },
          },
          formulaExecutionEvidenceMatrix: {
            status: 'evidence-matrix-built-execution-unconfirmed',
            actionId: 'action-0001',
            actionName: '普通攻击',
            skillId: 10900101,
            actionVariantIndex: 0,
            actionVariantLabel: '普攻',
            hitCount: 5,
            elementCount: 2,
            rowCount: 2,
            preferredStrategy: 'function_2-current-level-value-param',
            diagnostics: expect.objectContaining({
              functionCombinationOrderStatus: 'unconfirmed',
              levelOverrideApplicationStatus: 'unconfirmed',
              perHitMultiplierAllocationStatus: 'unconfirmed',
              rowsWithLargeDifference: 2,
              rowsWithSlotOverrideCandidates: 2,
              rowsWithHitBindings: 2,
            }),
            unresolved: expect.arrayContaining([
              'function-combination-order-unconfirmed',
              'level-override-application-point-unconfirmed',
              'per-hit-multiplier-allocation-unconfirmed',
            ]),
            rows: expect.arrayContaining([
              expect.objectContaining({
                elementConfigId: 109001081,
                hitIndexes: [1],
                hitBindingStatus: 'per-hit-candidate-bound',
                preferredFunctionOrderCandidate: expect.objectContaining({
                  strategy: 'function_2-current-level-value-param',
                  expression: 'function_2',
                  inputSource: 'skill_logic.currentLevel.valueParam',
                  roundedValue: 307,
                  comparisonStatus: 'compared-to-raw-projection',
                  rawProjectionValue: 12461,
                  previewRoundedValue: 307,
                  differenceStatus: 'large-difference',
                  status: 'combination-preview-computed',
                  applied: false,
                }),
                functionOrderCandidates: expect.arrayContaining([
                  expect.objectContaining({
                    strategy:
                      'function_1-plus-function_2-current-level-value-param',
                    expression: 'function_1 + function_2',
                    roundedValue: 308,
                    comparisonStatus: 'compared-to-raw-projection',
                  }),
                ]),
                slotOverrideCandidates: expect.arrayContaining([
                  expect.objectContaining({
                    id: 1,
                    variable: 'A',
                    relationStatus: 'level-scaling-override-candidate',
                    formulaParamValue: 1000,
                    firstLevelValue: 1600,
                    lastLevelValue: 3360,
                    applied: false,
                  }),
                ]),
                directSlotMatches: expect.arrayContaining([
                  expect.objectContaining({
                    id: 7,
                    variable: 'G',
                    relationStatus: 'constant-direct-slot-match',
                    formulaParamValue: 10000,
                    firstLevelValue: 10000,
                    lastLevelValue: 10000,
                    applied: false,
                  }),
                ]),
                perHitScaleGap: expect.objectContaining({
                  status: 'requires-runtime-scale-or-hit-allocation',
                  rawProjectionValue: 12461,
                  previewRoundedValue: 307,
                  hitCount: 5,
                  boundHitCount: 1,
                  differenceStatus: 'large-difference',
                  applied: false,
                }),
                unresolved: expect.arrayContaining([
                  'function-combination-order-unconfirmed',
                  'level-override-application-point-unconfirmed',
                  'per-hit-multiplier-allocation-unconfirmed',
                ]),
                applied: false,
              }),
            ]),
            applied: false,
          },
          candidates: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 109001081,
              fieldCandidate: expect.objectContaining({
                formulaFunctionEvidence: expect.objectContaining({
                  status: 'direct-element-formula-id-candidates-found',
                  relationStatus:
                    'function-id-matches-element_formula-id-candidate',
                  applied: false,
                  functionRefs: expect.arrayContaining([
                    expect.objectContaining({
                      field: 'function_1',
                      functionId: 1,
                      elementFormulaRow: {
                        id: 1,
                        functionOutput: 'G/10000',
                        variables: ['G'],
                      },
                    }),
                    expect.objectContaining({
                      field: 'function_2',
                      functionId: 2,
                      elementFormulaRow: {
                        id: 2,
                        functionOutput: '(self.ATK[0]*A)/10000',
                        variables: ['A'],
                      },
                    }),
                  ]),
                }),
                formulaSlotCandidates: expect.arrayContaining([
                  expect.objectContaining({
                    slot: 2,
                    rawValue: 1900,
                  }),
                ]),
              }),
              skillLevelBridge: expect.objectContaining({
                status: 'skillsub-element-level-bridge-found',
                levelRows: 12,
                formulaSlotAlignment: expect.objectContaining({
                  conclusion: 'slot-override-candidate-unconfirmed',
                  directSlotMatchParamIds: [7],
                  overrideCandidateParamIds: [1],
                  parameterSummaries: expect.arrayContaining([
                    expect.objectContaining({
                      id: 1,
                      variable: 'A',
                      relationStatus: 'level-scaling-override-candidate',
                    }),
                    expect.objectContaining({
                      id: 7,
                      variable: 'G',
                      relationStatus: 'constant-direct-slot-match',
                    }),
                  ]),
                }),
              }),
            }),
          ]),
        },
        formulaBreakdown: {
          unappliedLayerKeys: expect.arrayContaining(['damageElementFields']),
          layers: {
            damageElementFields: expect.objectContaining({
              applied: false,
              status: 'candidate-fields-found-formula-unmapped',
            }),
          },
        },
      },
      toughnessDamage: {
        value: 0,
        applied: false,
        status: 'candidate-fields-found-formula-unmapped',
        sourceEvidence: {
          status: 'candidate-fields-found',
          candidateCount: 2,
          matchedElementConfigIds: [109001081, 109001306],
          candidates: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 109001081,
              fieldCandidate: expect.objectContaining({
                weakBreakDamageRate: 7000,
                hitType: 1,
                knockBackId: 1,
                knockBackForce: 1,
              }),
            }),
          ]),
        },
        formulaBreakdown: {
          status: 'candidate-fields-found-formula-unmapped',
          unappliedLayerKeys: [
            'actionToughnessValue',
            'enemyToughnessState',
            'weaknessOrBreakModifier',
          ],
          layers: {
            actionToughnessValue: expect.objectContaining({
              applied: false,
              status: 'candidate-fields-found-formula-unmapped',
            }),
          },
        },
      },
      selfEnergyChange: {
        value: 0,
        applied: false,
        status: 'candidate-fields-found-charge-formula-unmapped',
        sourceEvidence: {
          status: 'candidate-fields-found',
          candidateCount: 2,
          matchedElementConfigIds: [109001081, 109001306],
          selfEnergyRuntimeFormulaProbe: expect.objectContaining({
            status: 'recover-sp-runtime-probe-built-unapplied',
            candidateCount: 2,
            gateOpenCount: 2,
            recoverSPValues: [2700],
            perTenThousandRecoverSPValues: [0.27],
            sourceToArgsProbe: expect.objectContaining({
              status: 'source-to-args-subprobe-built-unapplied',
              sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
              argsResetFunction: 'RecoverSPArgs.OnReset@0x1254070',
              candidateCount: 2,
              gateOpenCount: 2,
              confirmedRuntimeRules: expect.objectContaining({
                status:
                  'damage-element-recover-sp-source-to-args-partially-confirmed',
                transmitType: '0x12F',
                nativeScaleFacts: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'DamageElement.m_recoverSP@0x240',
                    argsField: 'RecoverSPArgs.baseDelta@0x1C',
                    nativeDivisorAddress: '0x189956FB0',
                    nativeDivisorValue: 10000,
                    status: 'source-to-base-delta-divisor-confirmed',
                  }),
                  expect.objectContaining({
                    sourceField: 'DamageElement.m_recoverSP@0x240',
                    argsField: 'RecoverSPArgs.delta@0x20',
                    status:
                      'source-to-delta-derived-with-runtime-modifiers-confirmed',
                  }),
                  expect.objectContaining({
                    sourceField: 'DamageElement.m_recoverInterval@0x248',
                    argsField: 'RecoverSPArgs.interval@0x24',
                    nativeDivisorAddress: '0x189956D8C',
                    nativeDivisorValue: 1000,
                    status: 'source-to-interval-confirmed-divisor-confirmed',
                  }),
                ]),
                nativeConstantReadEvidence: expect.objectContaining({
                  status: 'gameassembly-rdata-float32-values-read',
                  constants: expect.arrayContaining([
                    expect.objectContaining({
                      key: 'recover-sp-modifier-base',
                      float32: 1,
                      fileOffset: '0x9954708',
                    }),
                    expect.objectContaining({
                      key: 'recover-interval-divisor',
                      float32: 1000,
                      fileOffset: '0x995498C',
                    }),
                    expect.objectContaining({
                      key: 'recover-sp-per-ten-thousand-divisor',
                      float32: 10000,
                      fileOffset: '0x9954BB0',
                    }),
                  ]),
                }),
                enumEvidence: expect.objectContaining({
                  recoverTagType: expect.arrayContaining([
                    expect.objectContaining({
                      name: 'AttackRecoverySp',
                      value: 0,
                    }),
                  ]),
                }),
              }),
            }),
            runtimeModifierProbe: expect.objectContaining({
              status: 'runtime-modifier-subprobe-built-unapplied',
              sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
              candidateCount: 2,
              gateOpenCount: 2,
              modifierPropertyIds: [105, 228],
              confirmedRuntimeRules: expect.objectContaining({
                status:
                  'damage-element-recover-sp-runtime-modifiers-partially-confirmed',
                deltaFormulaShape: expect.objectContaining({
                  nativeConstantAddress: '0x189956B08',
                  nativeConstantValue: 1,
                  status:
                    'modifier-base-constant-confirmed-values-runtime-unapplied',
                }),
                modifierSources: expect.arrayContaining([
                  expect.objectContaining({
                    propertyId: 105,
                    propertyName: 'SPGETUP',
                    alivePropertyFunction:
                      'AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0',
                    conversionFunction: 'MyFloat.op_Implicit(float)@0x11B2AE0',
                  }),
                  expect.objectContaining({
                    propertyId: 228,
                    propertyName: 'SPGETUP_ATK',
                    snapshotPropertyFunction:
                      'SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240',
                  }),
                ]),
                intervalScale: expect.objectContaining({
                  nativeDivisorAddress: '0x189956D8C',
                  nativeDivisorValue: 1000,
                }),
                shareConfigSources: expect.arrayContaining([
                  expect.objectContaining({
                    sourceField: 'BattleConfigData.shareEnergyPercent@0x108',
                  }),
                  expect.objectContaining({
                    sourceField: 'BattleConfigData.petShareEnergyPercent@0x10C',
                  }),
                ]),
              }),
            }),
            ownerShareIntervalProbe: expect.objectContaining({
              status: 'owner-share-interval-subprobe-built-unapplied',
              sourceFunction: 'SPSystem.OnTransmit@0x14837F0',
              candidateCount: 2,
              gateOpenCount: 2,
              confirmedRuntimeRules: expect.objectContaining({
                transmitType: expect.objectContaining({
                  hex: '0x12F',
                  status: 'recover-sp-args-transmit-branch-confirmed',
                }),
                directRecoverCall: expect.objectContaining({
                  recoverTagTypeField: 'tagType@0x28',
                  baseDeltaField: 'baseDelta@0x1C',
                  deltaField: 'delta@0x20',
                }),
                intervalThrottle: expect.objectContaining({
                  idField: 'id@0x18',
                  intervalField: 'interval@0x24',
                  timerMapField: 'SPSystem.m_recoverTimerMap@0x20',
                }),
                shareRebroadcast: expect.arrayContaining([
                  expect.objectContaining({ path: 'background-entity-share' }),
                  expect.objectContaining({ path: 'pet-share' }),
                  expect.objectContaining({ path: 'main-pet-share' }),
                ]),
              }),
            }),
            runtimeSamplingProbe: expect.objectContaining({
              status: 'runtime-sampling-schema-built-awaiting-capture',
              sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
              candidateCount: 2,
              gateOpenCount: 2,
              importedRuntimeSampleCount: 0,
              importStatus: 'runtime-samples-not-imported',
              requiredEventTypes: expect.arrayContaining([
                'recover-sp-args-built',
                'recover-sp-modifier-property-read',
                'recover-sp-ontransmit-12f',
                'recover-sp-applied',
                'recover-sp-share-rebroadcast',
              ]),
              sampleSchema: expect.objectContaining({
                status: 'runtime-sample-schema-ready-awaiting-capture',
                hookPoints: expect.arrayContaining([
                  expect.objectContaining({
                    key: 'damage-element-recover-sp-args-built',
                    functionKey: 'DamageElement.RecoverSP@0x138EEE0',
                  }),
                  expect.objectContaining({
                    key: 'sp-system-ontransmit-12f',
                    functionKey: 'SPSystem.OnTransmit@0x14837F0',
                  }),
                  expect.objectContaining({
                    key: 'sp-system-recover-sp-applied',
                    functionKey: 'SPSystem.RecoverSP@0x1483F40',
                  }),
                ]),
                validationChecks: expect.arrayContaining([
                  expect.objectContaining({
                    key: 'delta-scale-and-modifier',
                  }),
                  expect.objectContaining({
                    key: 'final-sp-curve',
                    status: 'runtime-sample-required',
                  }),
                ]),
              }),
              sampleExpectations: expect.arrayContaining([
                expect.objectContaining({
                  elementConfigId: 109001081,
                  expectedRecoverSpArgs: expect.objectContaining({
                    baseDelta: 0.27,
                    deltaFormula:
                      'recoverSP / 10000 * (1 + SPGETUP + SPGETUP_ATK)',
                    intervalSecondsCandidate: 9.999,
                  }),
                  requiredRuntimeValues: expect.arrayContaining([
                    expect.objectContaining({
                      propertyId: 105,
                      propertyName: 'SPGETUP',
                    }),
                    expect.objectContaining({
                      propertyId: 228,
                      propertyName: 'SPGETUP_ATK',
                    }),
                  ]),
                }),
              ]),
            }),
          }),
          candidates: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 109001081,
              fieldCandidate: expect.objectContaining({
                recoverSP: 2700,
                petRecoverSP: 10399,
                recoverInterval: 9999,
              }),
            }),
          ]),
        },
        runtimeFormulaProbe: expect.objectContaining({
          status: 'recover-sp-runtime-probe-built-unapplied',
          candidateCount: 2,
          gateOpenCount: 2,
          runtimeFieldMap: expect.arrayContaining([
            expect.objectContaining({
              field: 'recoverSP',
              paramOffset: '0x12C',
              runtimeOffset: '0x240',
            }),
          ]),
          recoverSpArgsFieldMap: expect.arrayContaining([
            expect.objectContaining({
              field: 'baseDelta',
              offset: '0x1C',
            }),
            expect.objectContaining({
              field: 'delta',
              offset: '0x20',
            }),
            expect.objectContaining({
              field: 'interval',
              offset: '0x24',
            }),
            expect.objectContaining({
              field: 'sharePercent',
              offset: '0x30',
            }),
            expect.objectContaining({
              field: 'petSharePercent',
              offset: '0x34',
            }),
            expect.objectContaining({
              field: 'mainPetSharePercent',
              offset: '0x44',
            }),
          ]),
          ownerShareIntervalProbe: expect.objectContaining({
            status: 'owner-share-interval-subprobe-built-unapplied',
            sourceFunction: 'SPSystem.OnTransmit@0x14837F0',
            candidateCount: 2,
            gateOpenCount: 2,
            samples: expect.arrayContaining([
              expect.objectContaining({
                elementConfigId: 109001081,
                recoverSpArgsCandidates: expect.objectContaining({
                  interval: expect.objectContaining({
                    rawField: 9999,
                    nativeDivisorAddress: '0x189956D8C',
                    nativeDivisorValue: 1000,
                    intervalSecondsCandidate: 9.999,
                  }),
                }),
              }),
            ]),
          }),
          sourceToArgsProbe: expect.objectContaining({
            status: 'source-to-args-subprobe-built-unapplied',
            sourceFunction: 'DamageElement.RecoverSP@0x138EEE0',
            argsResetFunction: 'RecoverSPArgs.OnReset@0x1254070',
            candidateMappings: expect.objectContaining({
              recoverSP: expect.objectContaining({
                recoverSpArgsFields: expect.arrayContaining([
                  'baseDelta@0x1C',
                  'delta@0x20-derived-with-runtime-modifiers',
                ]),
                status: 'source-to-baseDelta-confirmed-delta-derived-unapplied',
              }),
              recoverInterval: expect.objectContaining({
                recoverSpArgsFields: ['interval@0x24'],
                status: 'source-to-interval-confirmed-divisor-confirmed',
              }),
            }),
            samples: expect.arrayContaining([
              expect.objectContaining({
                elementConfigId: 109001081,
                argsConstructionCandidates: expect.objectContaining({
                  baseDelta: expect.objectContaining({
                    sourceField: 2700,
                    nativeDivisorValue: 10000,
                    perTenThousandCandidate: 0.27,
                  }),
                  tagType: expect.objectContaining({
                    value: 0,
                    name: 'AttackRecoverySp',
                  }),
                }),
              }),
            ]),
          }),
          runtimeChainSteps: expect.arrayContaining([
            expect.objectContaining({
              method: 'DamageElement.Parse',
              status: 'field-copy-confirmed',
            }),
            expect.objectContaining({
              method: 'SPSystem.RecoverSP',
              status: 'delta-update-path-confirmed-scale-unconfirmed',
            }),
          ]),
          samples: expect.arrayContaining([
            expect.objectContaining({
              elementConfigId: 109001081,
              recoverSP: 2700,
              gateOpen: true,
              scaledCandidates: expect.objectContaining({
                perTenThousand: expect.objectContaining({
                  recoverSP: 0.27,
                  recoverInterval: 0.9999,
                }),
              }),
            }),
          ]),
          applied: false,
        }),
        formulaBreakdown: {
          status: 'candidate-fields-found-charge-formula-unmapped',
          unappliedLayerKeys: [
            'actionChargeGain',
            'hitEnergyGain',
            'passiveEnergyModifiers',
          ],
          layers: {
            actionChargeGain: expect.objectContaining({
              applied: false,
              status: 'candidate-fields-found-formula-unmapped',
            }),
          },
        },
      },
    });
    const actionResult = result.actionResultTimeline[0];
    expect(actionResult.hitCandidateSummary).toMatchObject({
      status: 'all-hit-candidates-have-damage-element-fields',
      hitCandidateCount: 5,
      mappedHitCandidateCount: 5,
      damageElementFieldMappingCount: 12,
      frameRate: 60,
      primaryFrames: [12, 6, 12, 7, 4],
      absolutePrimaryFrames: [12, 22, 63, 123, 184],
      sequenceChainStartFrames: [0, 16, 51, 116, 180],
      sequenceTimingStatus:
        'normal-attack-sequence-absolute-frame-candidates-found',
      sequenceTimingSourceKind: 'azpr-normal-attack-sequence-timing-candidate',
      sequenceTimingTransitionCount: 4,
      sequenceTimingResolvedTransitionCount: 4,
      sequenceTimingAbsoluteFrameStatus:
        'absolute-hit-frames-strictly-increasing',
      sequenceTimingTransitions: [
        expect.objectContaining({
          fromSkillId: 10900101,
          toSkillId: 10900102,
          bridgeStartFrame: 16,
          chainStartFrame: 16,
        }),
        expect.objectContaining({
          fromSkillId: 10900102,
          toSkillId: 10900103,
          bridgeStartFrame: 35,
          chainStartFrame: 51,
        }),
        expect.objectContaining({
          fromSkillId: 10900103,
          toSkillId: 10900104,
          bridgeStartFrame: 65,
          chainStartFrame: 116,
        }),
        expect.objectContaining({
          fromSkillId: 10900104,
          toSkillId: 10900105,
          bridgeStartFrame: 64,
          chainStartFrame: 180,
        }),
      ],
      applied: false,
    });
    expect(actionResult.hitCandidateSummary.candidateElementConfigIds).toEqual([
      109001018, 109001021, 109001081, 109001117, 109001134, 109001135,
      109001137, 109001280, 109001285, 109001306, 109001313, 109001328,
    ]);
    expect(actionResult.hitCandidates).toHaveLength(5);
    expect(actionResult.hitCandidates[0]).toMatchObject({
      sourceKind: 'azpr-normal-attack-per-hit-damage-element-candidate',
      actionId: 'action-0001',
      actionVariantLabel: '普攻',
      expectedHitCount: 5,
      hitIndex: 1,
      hitSkillId: 10900101,
      animationStateNames: ['Skill0_1'],
      frameRate: 60,
      frameStartFrames: [12, 13],
      primaryFrame: 12,
      localCandidateTimeMs: 200,
      chainStartFrame: 0,
      absolutePrimaryFrame: 12,
      absoluteFrameStartFrames: [12, 13],
      absoluteCandidateTimeMs: 200,
      sequenceTimingStatus: 'absolute-hit-frame-candidate-found',
      sequenceTimingSourceStatus:
        'normal-attack-sequence-absolute-frame-candidates-found',
      candidateTimeMs: 200,
      damageElementFieldMappingCount: 2,
      actionLevelElementMatchCount: 2,
      actionLevelElementMatchStatus:
        'some-hit-elements-bridge-to-action-element-values',
      damageElementElementConfigIds: [109001081, 109001306],
      hpDamage: expect.objectContaining({
        status: 'candidate-fields-found-formula-unmapped',
        candidateCount: 2,
        formulaFunctionIds: [1, 2],
        formulaFunctionMatchedIds: [1, 2],
        applied: false,
      }),
      toughnessDamage: expect.objectContaining({
        status: 'candidate-fields-found-formula-unmapped',
        candidateCount: 2,
        weakBreakDamageRates: [7000],
        applied: false,
      }),
      selfEnergyChange: expect.objectContaining({
        status: 'candidate-fields-found-formula-unmapped',
        candidateCount: 2,
        recoverSPValues: [2700],
        runtimeFormulaProbe: expect.objectContaining({
          status: 'recover-sp-runtime-probe-built-unapplied',
          candidateCount: 2,
          gateOpenCount: 2,
          perTenThousandRecoverSPValues: [0.27],
          sourceToArgsProbe: expect.objectContaining({
            status: 'source-to-args-subprobe-built-unapplied',
            candidateCount: 2,
            gateOpenCount: 2,
          }),
          ownerShareIntervalProbe: expect.objectContaining({
            status: 'owner-share-interval-subprobe-built-unapplied',
            candidateCount: 2,
            gateOpenCount: 2,
          }),
        }),
        applied: false,
      }),
      status: 'per-hit-candidate-fields-found-formula-unapplied',
      applied: false,
    });
    expect(actionResult.hitCandidates[1]).toMatchObject({
      hitIndex: 2,
      hitSkillId: 10900102,
      animationStateNames: ['Skill0_2'],
      frameStartFrames: [6, 10, 14, 26],
      primaryFrame: 6,
      localCandidateTimeMs: 100,
      chainStartFrame: 16,
      absolutePrimaryFrame: 22,
      absoluteFrameStartFrames: [22, 26, 30, 42],
      absoluteCandidateTimeMs: 366.666667,
      sequenceTimingStatus: 'absolute-hit-frame-candidate-found',
      sequenceTimingSourceStatus:
        'normal-attack-sequence-absolute-frame-candidates-found',
      candidateTimeMs: 366.666667,
      damageElementFieldMappingCount: 2,
      actionLevelElementMatchCount: 0,
      damageElementElementConfigIds: [109001018, 109001137],
      hpDamage: expect.objectContaining({
        formulaFunctionIds: [1, 2],
      }),
      toughnessDamage: expect.objectContaining({
        weakBreakDamageRates: [7000],
      }),
    });
    expect(result.candidateValueSeries).toMatchObject({
      status: 'candidate-value-series-found-unapplied',
      frameRate: 60,
      summary: {
        seriesCount: 3,
        pointCount: 15,
        hitCandidateCount: 5,
        actionCount: 1,
        applied: false,
      },
      applied: false,
    });
    expect(result.candidateValueSeries.chart).toMatchObject({
      status: 'candidate-chart-found-unapplied',
      durationMs: 30000,
      frameRate: 60,
      frameMs: 16.666667,
      frameCount: 1800,
      summary: {
        seriesCount: 3,
        pointCount: 15,
        displayFrameAdjustmentCount: 0,
        timeOrderStatus: 'source-times-monotonic',
        applied: false,
      },
      applied: false,
    });
    const hpCandidateSeries = result.candidateValueSeries.series.find(
      series => series.key === 'hpDamageFormulaParamCandidate'
    );
    expect(hpCandidateSeries).toMatchObject({
      label: 'HP参数候选',
      valueKind: 'TDamageElementParams.formulaParamValues',
      unit: 'raw-param',
      pointCount: 5,
      valueMin: 2500,
      valueMax: 13000,
      applied: false,
    });
    const hpChartSeries = result.candidateValueSeries.chart.series.find(
      series => series.key === 'hpDamageFormulaParamCandidate'
    );
    expect(hpChartSeries).toMatchObject({
      label: 'HP参数候选',
      pointCount: 5,
      frameMin: 12,
      frameMax: 184,
      displayFrameAdjustmentCount: 0,
      timeOrderStatus: 'source-times-monotonic',
      applied: false,
    });
    expect(
      hpChartSeries.points.map(point => [
        point.hitIndex,
        point.sourceFrameIndex,
        point.displayFrameIndex,
        point.displayFrameLabel,
        point.timeAdjustmentStatus,
        point.localFrameIndex,
        point.chainStartFrame,
      ])
    ).toEqual([
      [1, 12, 12, '0s12f', 'event-bridge-absolute-time-kept', 12, 0],
      [2, 22, 22, '0s22f', 'event-bridge-absolute-time-kept', 6, 16],
      [3, 63, 63, '1s3f', 'event-bridge-absolute-time-kept', 12, 51],
      [4, 123, 123, '2s3f', 'event-bridge-absolute-time-kept', 7, 116],
      [5, 184, 184, '3s4f', 'event-bridge-absolute-time-kept', 4, 180],
    ]);
    expect(hpChartSeries.points.map(point => point.xPercent)).toEqual([
      0.6667, 1.2222, 3.5, 6.8333, 10.2222,
    ]);
    expect(hpChartSeries.points[0].elementDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementConfigId: 109001306,
          hpDamage: expect.objectContaining({
            rawFormulaParamValues: [1000, 1800, 2500],
            formulaFunctionIds: [1, 2],
            formulaFunctionRefs: expect.arrayContaining([
              expect.objectContaining({
                field: 'function_1',
                functionId: 1,
                functionOutput: 'G/10000',
              }),
              expect.objectContaining({
                field: 'function_2',
                functionId: 2,
                functionOutput: '(self.ATK[0]*A)/10000',
              }),
            ]),
          }),
          skillLevelBridge: expect.objectContaining({
            levelRows: 12,
            formulaSlotAlignment: expect.objectContaining({
              directSlotMatchParamIds: [7],
              overrideCandidateParamIds: [1],
              parameterSummaries: expect.arrayContaining([
                expect.objectContaining({
                  id: 1,
                  variable: 'A',
                  relationStatus: 'level-scaling-override-candidate',
                  firstLevelValue: 1600,
                  lastLevelValue: 3360,
                }),
                expect.objectContaining({
                  id: 7,
                  variable: 'G',
                  relationStatus: 'constant-direct-slot-match',
                  formulaParamValue: 10000,
                }),
              ]),
            }),
          }),
          toughnessDamage: expect.objectContaining({
            weakBreakDamageRate: 7000,
          }),
          selfEnergyChange: expect.objectContaining({
            recoverSP: 2700,
            petRecoverSP: 10399,
            recoverInterval: 9999,
          }),
          applied: false,
        }),
        expect.objectContaining({
          elementConfigId: 109001081,
          hpDamage: expect.objectContaining({
            rawFormulaParamValues: [1000, 1900, 2500],
          }),
          toughnessDamage: expect.objectContaining({
            weakBreakDamageRate: 7000,
          }),
          selfEnergyChange: expect.objectContaining({
            recoverSP: 2700,
          }),
        }),
      ])
    );
    expect(
      hpCandidateSeries.points.map(point => [
        point.hitIndex,
        point.value,
        point.valueMin,
        point.valueMax,
      ])
    ).toEqual([
      [1, 2500, 1000, 2500],
      [2, 4800, 1000, 4800],
      [3, 3000, 1000, 3000],
      [4, 5400, 1000, 5400],
      [5, 13000, 1000, 13000],
    ]);
    const toughnessCandidateSeries = result.candidateValueSeries.series.find(
      series => series.key === 'toughnessDamageCandidate'
    );
    expect(toughnessCandidateSeries).toMatchObject({
      label: '削韧候选',
      valueKind: 'TDamageElementParams.weakBreakDamageRate',
      unit: 'raw-field',
      pointCount: 5,
      valueMin: 7000,
      valueMax: 7000,
      applied: false,
    });
    expect(toughnessCandidateSeries.points.map(point => point.value)).toEqual([
      7000, 7000, 7000, 7000, 7000,
    ]);
    const toughnessChartSeries = result.candidateValueSeries.chart.series.find(
      series => series.key === 'toughnessDamageCandidate'
    );
    expect(toughnessChartSeries.points.map(point => point.yPercent)).toEqual([
      50, 50, 50, 50, 50,
    ]);
    const selfEnergyCandidateSeries = result.candidateValueSeries.series.find(
      series => series.key === 'selfEnergyCandidate'
    );
    expect(selfEnergyCandidateSeries).toMatchObject({
      label: '能量候选',
      valueKind: 'TDamageElementParams.recoverSP',
      unit: 'raw-field',
      pointCount: 5,
      valueMin: 2399,
      valueMax: 3000,
      applied: false,
    });
    expect(selfEnergyCandidateSeries.points.map(point => point.value)).toEqual([
      2700, 2599, 2399, 3000, 2599,
    ]);
    expect(result.summary.candidateValueSeriesSummary).toMatchObject({
      seriesCount: 3,
      pointCount: 15,
      hitCandidateCount: 5,
      chartPointCount: 15,
      displayFrameAdjustmentCount: 0,
      timeOrderStatus: 'source-times-monotonic',
      applied: false,
    });
    expect(result.threeValueCurveFramework).toMatchObject({
      status: 'three-value-curve-framework-ready-details-deferred',
      developmentFocus: 'framework-first-before-frame-perfecting',
      frameRate: 60,
      timebase: {
        granularity: 'one-frame',
        frameRate: 60,
      },
      summary: {
        trackCount: 3,
        candidateTrackCount: 3,
        candidatePointCount: 15,
        chartPointCount: 15,
        stateCurvePointCount: 16,
        appliedStatePointCount: 1,
        candidateStatePointCount: 15,
        placeholderStatePointCount: 0,
        actionResultCount: 1,
        detailsDeferred: true,
        applied: false,
      },
      applied: false,
    });
    expect(result.summary.threeValueCurveFrameworkSummary).toMatchObject({
      trackCount: 3,
      candidateTrackCount: 3,
      chartPointCount: 15,
      stateCurvePointCount: 16,
      appliedStatePointCount: 1,
      candidateStatePointCount: 15,
      detailsDeferred: true,
      applied: false,
    });
    expect(result.threeValueGenerationLayer).toMatchObject({
      status: 'standard-three-value-generation-layer-ready',
      contract: {
        name: 'Action -> Hit -> ThreeValueDelta',
        version: 10,
        frameRate: 60,
        deltaFields: ['hpDelta', 'toughnessDelta', 'energyDelta'],
        calculatorContract: {
          name: 'ThreeValueDeltaCalculator',
          version: 3,
          requiredInputs: ['trackKey', 'delta', 'mechanismContext'],
          requiredOutputs: [
            'delta',
            'status',
            'sourceIds',
            'confidence',
            'replaceable',
            'mechanismContextStatus',
            'mechanismConfigurationStatus',
          ],
          calculatorKeys: [
            'azpr-hp-delta-calculator',
            'azpr-toughness-delta-calculator',
            'azpr-self-energy-delta-calculator',
          ],
        },
      },
      summary: {
        actionCount: 1,
        hitCount: 6,
        deltaCount: 16,
        trackCount: 3,
        appliedDeltaCount: 1,
        candidateDeltaCount: 15,
        sampledDeltaCount: 0,
        placeholderDeltaCount: 0,
        replaceableDeltaCount: 15,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        calculatorCount: 3,
        calculatorKeys: [
          'azpr-hp-delta-calculator',
          'azpr-toughness-delta-calculator',
          'azpr-self-energy-delta-calculator',
        ],
        calculatorReplaceableDeltaCount: 16,
        mechanismContextReadyDeltaCount: 16,
        mechanismContextMissingDeltaCount: 0,
        calculatorSummary: expect.objectContaining({
          outputCount: 16,
          mechanismContextReadyCount: 16,
          mechanismContextMissingCount: 0,
          calculatorKeyCounts: expect.arrayContaining([
            expect.objectContaining({
              key: 'azpr-hp-delta-calculator',
              count: 6,
              replaceableCount: 6,
            }),
            expect.objectContaining({
              key: 'azpr-toughness-delta-calculator',
              count: 5,
            }),
            expect.objectContaining({
              key: 'azpr-self-energy-delta-calculator',
              count: 5,
            }),
          ]),
          statusCounts: expect.arrayContaining([
            expect.objectContaining({
              status: 'per-hit-candidate-fields-found-formula-unapplied',
              count: 15,
            }),
            expect.objectContaining({ status: 'raw-hp-projection', count: 1 }),
          ]),
          unresolvedItemCounts: expect.arrayContaining([
            expect.objectContaining({
              item: 'final-azpr-formula-confirmation',
              count: 16,
            }),
            expect.objectContaining({
              item: 'hit-to-damage-element-binding',
              count: 6,
            }),
          ]),
        }),
        frameMin: 0,
        frameMax: 184,
        applied: false,
      },
      applied: false,
    });
    expect(result.summary.threeValueGenerationLayerSummary).toMatchObject({
      contractName: 'Action -> Hit -> ThreeValueDelta',
      actionCount: 1,
      hitCount: 6,
      deltaCount: 16,
      candidateDeltaCount: 15,
      appliedDeltaCount: 1,
      calculatorCount: 3,
      calculatorReplaceableDeltaCount: 16,
      mechanismContextReadyDeltaCount: 16,
      mechanismContextMissingDeltaCount: 0,
      valueSourceSlotCount: 12,
      runtimeValueSourceSlotCount: 3,
      replaceableValueSourceSlotCount: 9,
      applied: false,
    });
    expect(result.threeValueGenerationBundle).toMatchObject({
      sourceKind: 'azpr-three-value-generation-builder-bundle',
      status: 'three-value-generation-builder-ready',
      contractName: 'Action -> Hit -> ThreeValueDelta',
      summary: {
        generationLayerStatus: 'standard-three-value-generation-layer-ready',
        standardContractStatus: 'action-hit-three-value-delta-contract-ready',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        generationInputSourceKind:
          'azpr-action-hit-three-value-delta-generation-input',
        generationInputStatus: 'three-value-delta-generation-input-ready',
        generationInputPointCount: 16,
        generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
        generationOutputsStatus: 'generation-outputs-ready',
        generationOutputsOutputCount: 9,
        generationOutputBoundaryStatus: 'generation-output-boundary-ready',
        generationOutputBoundaryReady: true,
        generationOutputBoundaryIssueCount: 0,
        standardGenerationEntrySourceKind:
          'azpr-action-hit-three-value-delta-standard-generation-entry',
        standardGenerationEntryStatus:
          'action-hit-three-value-delta-standard-generation-entry-ready',
        actionCount: 1,
        hitCount: 6,
        deltaCount: 16,
        appliedDeltaCount: 1,
        candidateDeltaCount: 15,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
      },
    });
    expect(result.threeValueGenerationBundle.threeValueGenerationLayer).toBe(
      result.threeValueGenerationLayer
    );
    expect(result.threeValueGenerationBundle.standardContract).toBe(
      result.threeValueGenerationLayer.standardContract
    );
    expect(result.generationOutputs).toBe(
      result.threeValueGenerationBundle.generationOutputs
    );
    expect(result.generationOutputs).toMatchObject({
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
      runtimeInputSource: {
        sourceKind: 'azpr-runtime-input-source-from-generation-builder',
        status: 'runtime-input-source-ready',
      },
      standardOutputBoundary: {
        sourceKind: 'azpr-action-hit-three-value-generation-output-boundary',
        status: 'generation-output-boundary-ready',
        entryPath: 'generationOutputs.outputs.generationEntry',
        runtimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        standardContractPath:
          'generationOutputs.outputs.generationEntry.standardContract',
        deltasPath: 'generationOutputs.outputs.generationEntry.deltas',
        valueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        contractValidationPath:
          'generationOutputs.outputs.generationEntry.contractValidation',
        standardOutputCount: 6,
        issueCount: 0,
        ready: true,
        usesLegacyFallback: false,
      },
      generationEntry: {
        sourceKind:
          'azpr-action-hit-three-value-delta-standard-generation-entry',
        status: 'action-hit-three-value-delta-standard-generation-entry-ready',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        summary: {
          actionCount: 1,
          hitCount: 6,
          deltaCount: 16,
          appliedDeltaCount: 1,
          valueSourceSlotCount: 12,
          runtimeValueSourceSlotCount: 3,
          replaceableValueSourceSlotCount: 9,
        },
      },
      summary: {
        outputCount: 9,
        actionCount: 1,
        hitCount: 6,
        deltaCount: 16,
        appliedDeltaCount: 1,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        generationInputSourceKind:
          'azpr-action-hit-three-value-delta-generation-input',
        generationInputStatus: 'three-value-delta-generation-input-ready',
        generationInputPointCount: 16,
      },
    });
    expect(result.generationOutputs.runtimeInputSource).toBe(
      result.threeValueGenerationBundle.runtimeInputSource
    );
    expect(result.generationOutputs.generationEntry).toBe(
      result.threeValueGenerationBundle.generationEntry
    );
    expect(result.generationOutputs.outputs.generationEntry).toBe(
      result.threeValueGenerationBundle.generationEntry
    );
    expect(result.generationOutputs.generationInput).toBe(
      result.threeValueGenerationBundle.generationInput
    );
    expect(result.generationOutputs.standardContract).toBe(
      result.threeValueGenerationLayer.standardContract
    );
    expect(result.generationOutputs.valueSourceSlots).toBe(
      result.threeValueGenerationLayer.standardContract.valueSourceSlots
    );
    expect(result.generationOutputs.outputs.valueSourceSlots).toBe(
      result.threeValueGenerationLayer.standardContract.valueSourceSlots
    );
    expect(result.summary.threeValueGenerationBundleSummary).toMatchObject({
      contractName: 'Action -> Hit -> ThreeValueDelta',
      actionCount: 1,
      hitCount: 6,
      deltaCount: 16,
      appliedDeltaCount: 1,
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      generationInputSourceKind:
        'azpr-action-hit-three-value-delta-generation-input',
      generationInputStatus: 'three-value-delta-generation-input-ready',
      generationInputPointCount: 16,
      generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
      generationOutputsStatus: 'generation-outputs-ready',
      generationOutputBoundaryStatus: 'generation-output-boundary-ready',
      generationOutputBoundaryReady: true,
      generationOutputBoundaryIssueCount: 0,
      valueSourceSlotCount: 12,
      runtimeValueSourceSlotCount: 3,
      replaceableValueSourceSlotCount: 9,
      applied: false,
    });
    expect(result.summary.threeValueGenerationOutputsSummary).toMatchObject({
      outputCount: 9,
      actionCount: 1,
      hitCount: 6,
      deltaCount: 16,
      appliedDeltaCount: 1,
      valueSourceSlotCount: 12,
      runtimeValueSourceSlotCount: 3,
      replaceableValueSourceSlotCount: 9,
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
      generationInputSourceKind:
        'azpr-action-hit-three-value-delta-generation-input',
      generationInputStatus: 'three-value-delta-generation-input-ready',
      generationInputPointCount: 16,
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      applied: false,
    });
    expect(result.threeValueGenerationLayer.standardContract).toMatchObject({
      sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
      status: 'action-hit-three-value-delta-contract-ready',
      name: 'Action -> Hit -> ThreeValueDelta',
      topology: ['Action', 'Hit', 'ThreeValueDelta'],
      summary: {
        actionCount: 1,
        hitCount: 6,
        deltaCount: 16,
        appliedDeltaCount: 1,
        candidateDeltaCount: 15,
      },
    });
    expect(result.threeValueGenerationLayer.hits).toHaveLength(6);
    expect(result.threeValueRuntimeProjection.runtimeInput).toMatchObject({
      sourceKind: 'azpr-runtime-input-from-generation-builder-source',
      inputSourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
      inputStatus: 'action-hit-three-value-delta-contract-ready',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      runtimeInputSourceStatus: 'runtime-input-source-ready',
      generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
      generationOutputsStatus: 'generation-outputs-ready',
      generationLayerSourceKind: 'azpr-standard-three-value-generation-layer',
      generationReadSources: {
        status: 'runtime-input-generation-read-sources-ready',
        standardOutputCount: 6,
        fallbackInputCount: 0,
        usesLegacyGenerationFallback: false,
        standardGenerationBoundaryReady: true,
        standardGenerationAggregateBoundaryReady: true,
        generationEntryAggregateValidationStatus:
          'generation-entry-aggregate-valid',
        generationEntryAggregateValidationIssueCount: 0,
        generationEntryAggregateValidationValid: true,
        inputs: {
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
          },
        },
      },
      summary: {
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        runtimeInputSourceStatus: 'runtime-input-source-ready',
        generationOutputsSourceKind: 'azpr-three-value-generation-outputs',
        generationOutputsStatus: 'generation-outputs-ready',
        generationEntryAggregateValidationStatus:
          'generation-entry-aggregate-valid',
        generationEntryAggregateValidationIssueCount: 0,
        generationEntryAggregateValidationValid: true,
        standardContractActionCount: 1,
        standardContractHitCount: 6,
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        runtimeInputGenerationValueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
        runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
        inputDeltaCount: 16,
        appliedDeltaCount: 1,
        mechanismContextReadyDeltaCount: 1,
        mechanismContextMissingDeltaCount: 0,
      },
    });
    const appliedGenerationDelta = result.threeValueGenerationLayer.deltas.find(
      delta => delta.applied
    );
    expect(appliedGenerationDelta).toMatchObject({
      trackKey: 'enemyHpDamage',
      layerKey: 'applied',
      calculatorKey: 'azpr-hp-delta-calculator',
      calculationKind: 'raw-result-preview',
      calculationStatus: 'raw-hp-projection',
      calculationReplaceable: true,
      mechanismContextStatus: 'mechanism-context-ready',
      mechanismContextReady: true,
      mechanismContext: expect.objectContaining({
        contractName: 'AzPrThreeValueMechanismContext',
        status: 'mechanism-context-ready',
        ready: true,
        formulaStatus: 'context-ready-formula-unconfirmed',
        action: expect.objectContaining({
          actionId: 'action-0001',
          actorId: 'actor-109001',
          targetId: 'enemy-300032',
        }),
        timing: expect.objectContaining({
          needsTimingData: true,
          accuracy: 'placeholder',
        }),
        sourceActor: expect.objectContaining({
          actorId: 'actor-109001',
          characterId: 109001,
          stats: expect.objectContaining({
            attack: 1920,
            maxSp: 100,
          }),
          energy: expect.objectContaining({
            resource: 'sp',
            maxValue: 100,
            status: 'initial-current-sp-baseline-pending',
          }),
        }),
        targetEnemy: expect.objectContaining({
          targetId: 'enemy-300032',
          enemyId: 300032,
          stats: expect.objectContaining({
            physicalDefense: 810,
            magicalDefense: 810,
            maxToughness: 26822.0077,
            initialToughness: 26822.0077,
          }),
          toughness: expect.objectContaining({
            baseMax: 26822.0077,
            maxValue: 26822.0077,
            initialValue: 26822.0077,
          }),
          elementDefenses: expect.arrayContaining([
            expect.objectContaining({
              attributeKey: 'FIRE_DEFENSE',
              baseValue: 0,
              effectiveValue: 0,
              appliedToDamage: false,
            }),
          ]),
        }),
        ownership: {
          valueTargetKind: 'target-enemy',
          valueTargetId: 'enemy-300032',
          energyOwnerActorId: 'actor-109001',
          targetEnemyId: 'enemy-300032',
        },
      }),
      calculator: expect.objectContaining({
        key: 'azpr-hp-delta-calculator',
        version: 3,
        outputField: 'hpDelta',
        delta: 12461,
        sourceIds: expect.objectContaining({
          skillIds: [10900101],
          elementConfigIds: [109001081, 109001306],
        }),
        confidence: 'low',
        mechanismContextStatus: 'mechanism-context-ready',
        mechanismContextReady: true,
        replaceable: true,
        appliedToRuntime: true,
      }),
    });
    expect(appliedGenerationDelta.calculator.mechanismContext).toBe(
      appliedGenerationDelta.mechanismContext
    );
    const toughnessContextDelta = result.threeValueGenerationLayer.deltas.find(
      delta => delta.trackKey === 'enemyToughnessDamage'
    );
    const energyContextDelta = result.threeValueGenerationLayer.deltas.find(
      delta => delta.trackKey === 'selfEnergyChange'
    );
    expect(toughnessContextDelta.mechanismContext.ownership).toMatchObject({
      valueTargetKind: 'target-enemy',
      valueTargetId: 'enemy-300032',
      energyOwnerActorId: 'actor-109001',
    });
    expect(energyContextDelta.mechanismContext.ownership).toMatchObject({
      valueTargetKind: 'source-actor',
      valueTargetId: 'actor-109001',
      energyOwnerActorId: 'actor-109001',
    });
    expect(result.threeValueRuntimeProjection).toMatchObject({
      sourceKind: 'azpr-runtime-projection-from-runtime-input-source',
      status: 'runtime-projection-ready-from-runtime-input-source',
      inputContractName: 'Action -> Hit -> ThreeValueDelta',
      appliedOnly: true,
      outputContract: {
        sourceKind: 'azpr-three-value-runtime-output-contract',
        status: 'runtime-output-contract-ready',
        inputSourceKind: 'azpr-runtime-input-from-generation-builder-source',
        runtimeInputSourceKind:
          'azpr-runtime-input-source-from-generation-builder',
        outputNames: [
          'simLog',
          'hitTransactions',
          'effectTimeline',
          'stateCurves',
          'resourceCurves',
          'summary',
        ],
        outputs: {
          simLog: {
            sourceKind: 'azpr-runtime-sim-log-output',
            status: 'runtime-sim-log-ready',
            rowCount: 1,
            eventType: 'THREE_VALUE_DELTA_APPLIED',
          },
          stateCurves: {
            sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
            enemy: {
              pointCount: 1,
              stateMetricKeys: ['hp', 'toughness'],
            },
            resources: {
              actorCount: 1,
              pointCount: 0,
              resourceKind: 'selfEnergy',
            },
          },
          resourceCurves: {
            sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
            actorCount: 1,
            pointCount: 0,
          },
          summary: {
            sourceKind: 'azpr-runtime-summary-output',
            source: 'threeValueRuntimeInput.appliedDeltas',
          },
        },
        summary: {
          outputCount: 6,
          appliedDeltaCount: 1,
          simLogCount: 1,
          enemyStatePointCount: 1,
          resourceCurveActorCount: 1,
          resourceCurvePointCount: 0,
          enemyHpDelta: 12461,
          selfEnergyDelta: 0,
          runtimeInputGenerationReadSourcesStatus:
            'runtime-input-generation-read-sources-ready',
          runtimeInputGenerationReadStandardOutputCount: 6,
          runtimeInputGenerationReadFallbackInputCount: 0,
          runtimeInputGenerationReadUsesLegacyFallback: false,
          runtimeInputGenerationRuntimeInputSourcePath:
            'generationOutputs.outputs.generationEntry.runtimeInputSource',
          runtimeInputGenerationStandardContractPath:
            'generationOutputs.outputs.generationEntry.standardContract',
          runtimeInputGenerationDeltasPath:
            'generationOutputs.outputs.generationEntry.deltas',
          valueSourceSlotCount: 12,
          runtimeValueSourceSlotCount: 3,
          replaceableValueSourceSlotCount: 9,
          runtimeInputGenerationValueSourceSlotsPath:
            'generationOutputs.outputs.generationEntry.valueSourceSlots',
          runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
          runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
        },
      },
      enemyStateCurve: {
        pointCount: 1,
        hpDelta: 12461,
        toughnessDelta: 0,
        baseline: {
          hp: {
            initialValue: 86778.6984,
            baseValue: 86778.6984,
            multiplier: 1,
            sourceStatus: 'baseline-derived-from-scenario-enemy-max-hp',
          },
          toughness: {
            initialValue: 26822.0077,
            maxValue: 26822.0077,
            baseValue: 26822.0077,
            multiplier: 1,
            sourceStatus:
              'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX',
          },
        },
        stateMetrics: {
          hp: {
            initialValue: 86778.6984,
            delta: 12461,
            currentValue: 74317.6984,
            overrunValue: 0,
            stateLabel: '剩余',
            baselineConfirmed: true,
          },
          toughness: {
            initialValue: 26822.0077,
            maxValue: 26822.0077,
            currentValue: 26822.0077,
            stateLabel: '剩余',
            baselineConfirmed: true,
          },
        },
        applied: true,
      },
      summary: {
        inputDeltaCount: 16,
        runtimeInputSourceKind:
          'azpr-runtime-input-from-generation-builder-source',
        runtimeInputSourceInputKind:
          'azpr-runtime-input-source-from-generation-builder',
        runtimeInputSourceInputStatus: 'runtime-input-source-ready',
        runtimeGenerationLayerSourceKind:
          'azpr-standard-three-value-generation-layer',
        runtimeInputGenerationReadSourcesStatus:
          'runtime-input-generation-read-sources-ready',
        runtimeInputGenerationReadStandardOutputCount: 6,
        runtimeInputGenerationReadFallbackInputCount: 0,
        runtimeInputGenerationReadUsesLegacyFallback: false,
        runtimeInputGenerationRuntimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        runtimeInputGenerationStandardContractPath:
          'generationOutputs.outputs.generationEntry.standardContract',
        runtimeInputGenerationDeltasPath:
          'generationOutputs.outputs.generationEntry.deltas',
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        runtimeInputGenerationValueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
        runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
        appliedDeltaCount: 1,
        enemyHpDelta: 12461,
        enemyToughnessDelta: 0,
        selfEnergyDelta: 0,
        enemyStatePointCount: 1,
        stateCurvePointCount: 1,
        selfEnergyPointCount: 0,
        enemyHpInitial: 86778.6984,
        enemyHpRemaining: 74317.6984,
        enemyHpBaselineStatus: 'baseline-derived-from-scenario-enemy-max-hp',
        enemyToughnessInitial: 26822.0077,
        enemyToughnessRemaining: 26822.0077,
        enemyToughnessBaselineStatus:
          'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX',
        simLogCount: 1,
        calculatorCount: 1,
        calculatorKeys: ['azpr-hp-delta-calculator'],
        calculatorReplaceableDeltaCount: 1,
        calculatorStatuses: ['raw-hp-projection'],
        mechanismContextReadyDeltaCount: 1,
        mechanismContextMissingDeltaCount: 0,
        mechanismContextStatuses: ['mechanism-context-ready'],
        calculatorSummary: {
          contractName: 'ThreeValueDeltaCalculator',
          contractVersion: 3,
          outputCount: 1,
          mechanismContextReadyCount: 1,
          mechanismContextMissingCount: 0,
          unresolvedItemCounts: expect.arrayContaining([
            expect.objectContaining({
              item: 'final-azpr-formula-confirmation',
              count: 1,
            }),
          ]),
          appliedToRuntimeCount: 1,
        },
        source: 'threeValueRuntimeInput.appliedDeltas',
        runtimeOutputContractSourceKind:
          'azpr-three-value-runtime-output-contract',
        runtimeOutputContractStatus: 'runtime-output-contract-ready',
        runtimeOutputContractOutputCount: 6,
        applied: true,
      },
      applied: true,
    });
    expect(result.threeValueRuntimeProjection.simLog[0]).toMatchObject({
      eventType: 'THREE_VALUE_DELTA_APPLIED',
      sourceDeltaId: expect.stringContaining(
        'action-0001|applied-frame-0-point-0'
      ),
      actionId: 'action-0001',
      trackKey: 'enemyHpDamage',
      layerKey: 'applied',
      hpDelta: 12461,
      toughnessDelta: null,
      energyDelta: null,
      calculatorKey: 'azpr-hp-delta-calculator',
      calculationKind: 'raw-result-preview',
      calculationStatus: 'raw-hp-projection',
      calculationReplaceable: true,
      applied: true,
    });
    expect(result.runtimeOutputs).toMatchObject({
      sourceKind: 'azpr-three-value-runtime-outputs',
      status: 'runtime-outputs-ready',
      inputContractName: 'Action -> Hit -> ThreeValueDelta',
      inputSourceKind: 'azpr-runtime-input-from-generation-builder-source',
      runtimeInputSourceKind:
        'azpr-runtime-input-source-from-generation-builder',
      outputNames: [
        'simLog',
        'hitTransactions',
        'effectTimeline',
        'stateCurves',
        'resourceCurves',
        'summary',
      ],
      outputAliases: {
        resources: 'resourceCurves',
      },
      outputContract: {
        sourceKind: 'azpr-three-value-runtime-output-contract',
        status: 'runtime-output-contract-ready',
      },
      simLog: [
        expect.objectContaining({
          eventType: 'THREE_VALUE_DELTA_APPLIED',
          actionId: 'action-0001',
          trackKey: 'enemyHpDamage',
          hpDelta: 12461,
        }),
      ],
      stateCurves: {
        sourceKind: 'azpr-runtime-state-curves-from-standard-deltas',
        summary: {
          enemyPointCount: 1,
          enemyHpDelta: 12461,
          enemyToughnessDelta: 0,
          stateCurvePointCount: 1,
          resourcePointCount: 0,
          selfEnergyDelta: 0,
        },
      },
      resources: {
        sourceKind: 'azpr-runtime-resource-curves-from-standard-deltas',
        resourceKind: 'selfEnergy',
        summary: {
          actorCount: 1,
          activeActorCount: 0,
          pointCount: 0,
          selfEnergyDelta: 0,
        },
      },
      summary: {
        enemyHpDelta: 12461,
        enemyToughnessDelta: 0,
        selfEnergyDelta: 0,
        stateCurvePointCount: 1,
        simLogCount: 1,
      },
      outputConsistency: {
        sourceKind: 'azpr-runtime-output-consistency',
        status: 'runtime-output-consistent',
        simLogCount: 1,
        enemyStatePointCount: 1,
        resourceCurvePointCount: 0,
        stateCurvePointCount: 1,
        resourceActorPointCount: 0,
        consistent: true,
      },
      outputSummary: {
        outputCount: 6,
        appliedDeltaCount: 1,
        simLogCount: 1,
        enemyStatePointCount: 1,
        stateCurvePointCount: 1,
        resourceCurveActorCount: 1,
        resourceCurvePointCount: 0,
        enemyHpDelta: 12461,
        enemyToughnessDelta: 0,
        selfEnergyDelta: 0,
        runtimeInputGenerationReadSourcesStatus:
          'runtime-input-generation-read-sources-ready',
        runtimeInputGenerationReadStandardOutputCount: 6,
        runtimeInputGenerationReadFallbackInputCount: 0,
        runtimeInputGenerationReadUsesLegacyFallback: false,
        runtimeInputGenerationRuntimeInputSourcePath:
          'generationOutputs.outputs.generationEntry.runtimeInputSource',
        runtimeInputGenerationStandardContractPath:
          'generationOutputs.outputs.generationEntry.standardContract',
        runtimeInputGenerationDeltasPath:
          'generationOutputs.outputs.generationEntry.deltas',
        valueSourceSlotCount: 12,
        runtimeValueSourceSlotCount: 3,
        replaceableValueSourceSlotCount: 9,
        runtimeInputGenerationValueSourceSlotsPath:
          'generationOutputs.outputs.generationEntry.valueSourceSlots',
        runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
        runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
        outputConsistencyStatus: 'runtime-output-consistent',
        outputConsistent: true,
        applied: true,
      },
      applied: true,
    });
    expect(result.runtimeOutputs).toBe(
      result.threeValueRuntimeProjection.runtimeOutputs
    );
    expect(result.runtimeOutputs.simLog).toBe(
      result.threeValueRuntimeProjection.simLog
    );
    expect(result.runtimeOutputs.stateCurves).toBe(
      result.threeValueRuntimeProjection.stateCurves
    );
    expect(result.runtimeOutputs.resources).toBe(
      result.threeValueRuntimeProjection.resourceCurves
    );
    expect(result.runtimeOutputs.outputs.resources).toBe(
      result.threeValueRuntimeProjection.resourceCurves
    );
    expect(result.summary.threeValueRuntimeProjectionSummary).toBe(
      result.runtimeOutputs.summary
    );
    expect(result.summary.runtimeOutputsSummary).toBe(
      result.runtimeOutputs.outputSummary
    );
    expect(result.summary.totalRawDamage).toBe(
      result.runtimeOutputs.summary.enemyHpDelta
    );
    expect(result.summary.totalProjectedToughnessDamage).toBe(
      result.runtimeOutputs.summary.enemyToughnessDelta
    );
    expect(result.summary.totalSelfEnergyDelta).toBe(
      result.runtimeOutputs.summary.selfEnergyDelta
    );
    expect(result.summary.threeValueRuntimeProjectionSummary).toMatchObject({
      inputContractName: 'Action -> Hit -> ThreeValueDelta',
      inputDeltaCount: 16,
      appliedDeltaCount: 1,
      enemyHpDelta: 12461,
      enemyToughnessDelta: 0,
      selfEnergyDelta: 0,
      stateCurvePointCount: 1,
      simLogCount: 1,
      enemyHpInitial: 86778.6984,
      enemyHpRemaining: 74317.6984,
      enemyToughnessInitial: 26822.0077,
      enemyToughnessRemaining: 26822.0077,
      enemyToughnessBaselineStatus:
        'baseline-derived-from-scenario-enemy-WEAKNESS_POINT_MAX',
      calculatorCount: 1,
      calculatorKeys: ['azpr-hp-delta-calculator'],
      calculatorReplaceableDeltaCount: 1,
      calculatorStatuses: ['raw-hp-projection'],
      runtimeInputGenerationReadSourcesStatus:
        'runtime-input-generation-read-sources-ready',
      runtimeInputGenerationReadStandardOutputCount: 6,
      runtimeInputGenerationReadFallbackInputCount: 0,
      runtimeInputGenerationReadUsesLegacyFallback: false,
      runtimeInputGenerationRuntimeInputSourcePath:
        'generationOutputs.outputs.generationEntry.runtimeInputSource',
      runtimeInputGenerationStandardContractPath:
        'generationOutputs.outputs.generationEntry.standardContract',
      runtimeInputGenerationDeltasPath:
        'generationOutputs.outputs.generationEntry.deltas',
      valueSourceSlotCount: 12,
      runtimeValueSourceSlotCount: 3,
      replaceableValueSourceSlotCount: 9,
      runtimeInputGenerationValueSourceSlotsPath:
        'generationOutputs.outputs.generationEntry.valueSourceSlots',
      runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
      runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
      applied: true,
    });
    expect(result.summary.runtimeOutputsSummary).toMatchObject({
      outputCount: 6,
      appliedDeltaCount: 1,
      simLogCount: 1,
      enemyStatePointCount: 1,
      stateCurvePointCount: 1,
      resourceCurvePointCount: 0,
      enemyHpDelta: 12461,
      enemyToughnessDelta: 0,
      selfEnergyDelta: 0,
      runtimeInputGenerationReadSourcesStatus:
        'runtime-input-generation-read-sources-ready',
      runtimeInputGenerationReadStandardOutputCount: 6,
      runtimeInputGenerationReadFallbackInputCount: 0,
      runtimeInputGenerationReadUsesLegacyFallback: false,
      runtimeInputGenerationRuntimeInputSourcePath:
        'generationOutputs.outputs.generationEntry.runtimeInputSource',
      runtimeInputGenerationStandardContractPath:
        'generationOutputs.outputs.generationEntry.standardContract',
      runtimeInputGenerationDeltasPath:
        'generationOutputs.outputs.generationEntry.deltas',
      valueSourceSlotCount: 12,
      runtimeValueSourceSlotCount: 3,
      replaceableValueSourceSlotCount: 9,
      runtimeInputGenerationValueSourceSlotsPath:
        'generationOutputs.outputs.generationEntry.valueSourceSlots',
      runtimeInputGenerationValueSourceSlotsSourceTier: 'standard-output',
      runtimeInputGenerationValueSourceSlotsStandardOutputPresent: true,
      outputConsistencyStatus: 'runtime-output-consistent',
      outputConsistent: true,
      applied: true,
    });
    const generationAction = result.threeValueGenerationLayer.actions[0];
    expect(generationAction).toMatchObject({
      actionId: 'action-0001',
      actionName: '普通攻击',
      actorId: 'actor-109001',
      hitCount: 6,
      deltaCount: 16,
    });
    const generationHit1 = generationAction.hits.find(
      hit => hit.hitKey === 'hit-1'
    );
    expect(generationHit1).toMatchObject({
      hitIndex: 1,
      frameIndex: 12,
      frameLabel: '0s12f',
      deltaCount: 3,
      layerKeys: ['candidate'],
      trackKeys: ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange'],
    });
    expect(
      generationHit1.deltas.map(delta => [
        delta.trackKey,
        delta.layerKey,
        delta.delta,
        delta.hpDelta,
        delta.toughnessDelta,
        delta.energyDelta,
        delta.sourceKind,
        delta.confidence,
        delta.calculatorKey,
        delta.calculationKind,
        delta.calculationReplaceable,
      ])
    ).toEqual([
      [
        'enemyHpDamage',
        'candidate',
        2500,
        2500,
        null,
        null,
        'candidate-chart-point',
        'candidate',
        'azpr-hp-delta-calculator',
        'damage-element-candidate-preview',
        true,
      ],
      [
        'enemyToughnessDamage',
        'candidate',
        7000,
        null,
        7000,
        null,
        'candidate-chart-point',
        'candidate',
        'azpr-toughness-delta-calculator',
        'weak-break-field-candidate-preview',
        true,
      ],
      [
        'selfEnergyChange',
        'candidate',
        2700,
        null,
        null,
        2700,
        'candidate-chart-point',
        'candidate',
        'azpr-self-energy-delta-calculator',
        'recover-sp-candidate-preview',
        true,
      ],
    ]);
    expect(generationHit1.deltas[0].sourceIds.elementConfigIds).toEqual([
      109001081, 109001306,
    ]);
    expect(
      result.threeValueCurveFramework.tracks.map(track => [
        track.key,
        track.status,
        track.candidatePointCount,
      ])
    ).toEqual([
      ['enemyHpDamage', 'track-ready-with-candidate-points', 5],
      ['enemyToughnessDamage', 'track-ready-with-candidate-points', 5],
      ['selfEnergyChange', 'track-ready-with-candidate-points', 5],
    ]);
    expect(result.threeValueCurveFramework.stateCurves).toMatchObject({
      status: 'state-curves-built-with-delta-cumulative-layers',
      layerKeys: ['applied', 'candidate', 'sampled', 'placeholder'],
      summary: {
        trackCount: 3,
        layerCount: 12,
        pointCount: 16,
        appliedPointCount: 1,
        candidatePointCount: 15,
        sampledPointCount: 0,
        placeholderPointCount: 0,
        cumulativeLayerCount: 4,
        applied: false,
      },
      applied: false,
    });
    const hpStateTrack =
      result.threeValueCurveFramework.stateCurves.tracks.find(
        track => track.trackKey === 'enemyHpDamage'
      );
    const hpAppliedLayer = hpStateTrack.layers.find(
      layer => layer.key === 'applied'
    );
    expect(hpAppliedLayer).toMatchObject({
      status: 'delta-cumulative-points-built',
      pointCount: 1,
      finalCumulative: 12461,
      applied: true,
    });
    expect(hpAppliedLayer.points[0]).toMatchObject({
      sourceKind: 'action-result-applied-value',
      frameIndex: 0,
      frameLabel: '0s0f',
      delta: 12461,
      cumulative: 12461,
      applied: true,
    });
    const hpCandidateLayer = hpStateTrack.layers.find(
      layer => layer.key === 'candidate'
    );
    expect(hpCandidateLayer).toMatchObject({
      status: 'delta-cumulative-points-built',
      valueUnit: 'raw-param',
      pointCount: 5,
      finalCumulative: 28700,
      applied: false,
    });
    expect(
      hpCandidateLayer.points.map(point => [
        point.frameIndex,
        point.delta,
        point.cumulative,
      ])
    ).toEqual([
      [12, 2500, 2500],
      [22, 4800, 7300],
      [63, 3000, 10300],
      [123, 5400, 15700],
      [184, 13000, 28700],
    ]);
    const combinationPreview =
      result.actionResultTimeline[0].hpDamage.sourceEvidence.formulaCandidatePreview.combinationPreviews.find(
        item =>
          item.elementConfigId === 109001081 &&
          item.strategy === 'function_2-current-level-value-param'
      );
    expect(combinationPreview.comparison.requiredScaleToRaw).toBeCloseTo(
      40.59,
      2
    );
    expect(combinationPreview.comparison.requiredPerHitScaleToRaw).toBeCloseTo(
      8.12,
      2
    );
    expect(result.summary.formulaCandidatePatternSummary).toMatchObject({
      status: 'single-formula-candidate-pattern',
      actionCount: 1,
      comparableActionCount: 1,
      preferredStrategy: 'function_2-current-level-value-param',
      scaleSpreadStatus: 'single-sample',
      previewValueStatus: 'same-preview-across-actions',
      behaviorCorrelationStatus:
        'skill-level-behavior-candidates-found-action-binding-unresolved',
      missingRuntimeScaleStatus: 'needs-more-action-samples',
      applied: false,
      skillControlBehaviorCorrelations: [
        expect.objectContaining({
          status: 'skill-level-hp-behavior-candidates-found',
          scope: 'skill-level-not-action-variant-bound',
          skillId: 10900101,
          hpLaneCandidateCount: 5,
          resolvedHpBehaviorRefCount: 5,
          externalElementBaseRefCount: 14,
          resourceMapMatchedElementBaseRefCount: 14,
          sampledHpBehaviorChainCount: 5,
          sampledHpLaneCandidateCount: 5,
          sampledResolvedHpBehaviorCount: 5,
          hitFrameStartFrames: [12, 13, 16, 19],
          stateTimingEvidenceStatus:
            'state-timing-evidence-found-action-binding-unconfirmed',
          stateTimingEvidence: expect.objectContaining({
            status: 'state-timing-evidence-found-action-binding-unconfirmed',
            hpStateWindowCount: 5,
            timingControlChainCount: 8,
            animationStateControlCount: 2,
            eventBridgeControlCount: 6,
            hpStateNames: ['Skill0_1', 'Skill0_6'],
            animationStateNames: ['Skill0_1', 'Skill0_6'],
            eventBridgeSkillIds: [0, 80102, 10900102],
            eventBridgeTargetSkillControlEvidence: expect.objectContaining({
              status: 'event-bridge-target-skill-controls-indexed',
              directTargetSkillIds: [80102, 10900102],
              targetSkillIds: [80102, 10900102, 10900103, 10900104, 10900105],
              foundTargetSkillControlCount: 4,
              missingTargetSkillControlCount: 1,
              childSkillTargetIds: [10900102, 10900103, 10900104, 10900105],
              chainDepthMax: 4,
              targetAnimationStateNames: [
                'Skill0_2',
                'Skill0_3',
                'Skill0_4',
                'Skill0_5',
              ],
              normalAttackChainCandidate: expect.objectContaining({
                chainSkillIds: [10900102, 10900103, 10900104, 10900105],
                chainLength: 4,
                hpTimelineCandidateCount: 30,
              }),
              normalAttackHitChainCandidate: expect.objectContaining({
                expectedHitCount: 5,
                candidateHitGroupCount: 5,
                coverageStatus: 'matches-description-hit-count',
                hpTimelineCandidateCount: 32,
                damageElementFieldMappingStatus:
                  'all-hit-groups-have-damage-element-field-mappings',
                damageElementMappedHitGroupCount: 5,
                damageElementFieldMappingCount: 12,
                hitGroups: [
                  expect.objectContaining({
                    hitIndex: 1,
                    skillId: 10900101,
                    animationStateNames: ['Skill0_1'],
                    hpTimelineCandidateCount: 2,
                    hpFrameStartFrames: [12, 13],
                    behaviorChainCandidateCount: 2,
                    resolvedBehaviorCount: 2,
                    resourceMapMatchedElementBaseRefCount: 4,
                    damageElementFieldMappingCount: 2,
                    damageElementElementConfigIds: [109001081, 109001306],
                  }),
                  expect.objectContaining({
                    hitIndex: 2,
                    skillId: 10900102,
                    animationStateNames: ['Skill0_2'],
                    hpTimelineCandidateCount: 4,
                    behaviorChainCandidateCount: 4,
                    damageElementFieldMappingCount: 2,
                  }),
                  expect.objectContaining({
                    hitIndex: 3,
                    skillId: 10900103,
                    animationStateNames: ['Skill0_3'],
                    hpTimelineCandidateCount: 9,
                    behaviorChainCandidateCount: 9,
                    damageElementFieldMappingCount: 2,
                  }),
                  expect.objectContaining({
                    hitIndex: 4,
                    skillId: 10900104,
                    animationStateNames: ['Skill0_4'],
                    hpTimelineCandidateCount: 7,
                    behaviorChainCandidateCount: 7,
                    damageElementFieldMappingCount: 3,
                  }),
                  expect.objectContaining({
                    hitIndex: 5,
                    skillId: 10900105,
                    animationStateNames: ['Skill0_5'],
                    hpTimelineCandidateCount: 10,
                    behaviorChainCandidateCount: 10,
                    damageElementFieldMappingCount: 3,
                  }),
                ],
              }),
              targetSkillControls: [
                expect.objectContaining({
                  skillId: 10900102,
                  status: 'found',
                  relationToSourceSkill: 'child-skill-of-source',
                  discoveryDepth: 1,
                  animationStateNames: ['Skill0_2'],
                  hpTimelineCandidateCount: 4,
                }),
                expect.objectContaining({
                  skillId: 10900103,
                  status: 'found',
                  relationToSourceSkill: 'child-skill-of-source',
                  discoveryDepth: 2,
                  animationStateNames: ['Skill0_3'],
                  hpTimelineCandidateCount: 9,
                }),
                expect.objectContaining({
                  skillId: 10900104,
                  status: 'found',
                  relationToSourceSkill: 'child-skill-of-source',
                  discoveryDepth: 3,
                  animationStateNames: ['Skill0_4'],
                  hpTimelineCandidateCount: 7,
                }),
                expect.objectContaining({
                  skillId: 10900105,
                  status: 'found',
                  relationToSourceSkill: 'child-skill-of-source',
                  discoveryDepth: 4,
                  animationStateNames: ['Skill0_5'],
                  hpTimelineCandidateCount: 10,
                }),
                expect.objectContaining({
                  skillId: 80102,
                  status: 'missing-skill-control-directory',
                }),
              ],
            }),
            stateFindings: [
              expect.objectContaining({
                stateName: 'Skill0_1',
                status: 'hp-state-has-animation-control-candidate',
                hpWindowCount: 2,
                hpStartFrames: [12, 13],
                animationControlCount: 1,
              }),
              expect.objectContaining({
                stateName: 'Skill0_6',
                status: 'hp-state-has-animation-control-candidate',
                hpWindowCount: 3,
                hpStartFrames: [13, 16, 19],
                animationControlCount: 1,
              }),
            ],
          }),
          actionVariantBindingStatus:
            'action-variant-binding-candidates-generated-unconfirmed',
          actionVariantBindingSummary: {
            actionVariantCount: 1,
            boundCandidateCount: 1,
            confidenceLevels: ['medium'],
            statuses: ['action-variant-binding-candidates-found'],
          },
          actionVariantBindingCandidates: [
            expect.objectContaining({
              actionId: 'action-0001',
              actionVariantLabel: '普攻',
              confidence: 'medium',
              candidateCount: 5,
              candidates: expect.arrayContaining([
                expect.objectContaining({
                  sourceName: '普通-攻击碰撞',
                  sourceStartFrame: 12,
                  stateNames: ['Skill0_1'],
                  subSkillIds: [10900101],
                  hitEffects: ['11_109001_116'],
                  bindingStatus:
                    'normal-action-name-state-candidate-unconfirmed',
                  confidence: 'medium',
                }),
              ]),
            }),
          ],
          resourceBindings: expect.objectContaining({
            subSkillIds: [10900101, 109001011],
            stateNames: ['Skill0_6', 'Skill0_1'],
            hitEffects: ['11_109001_133', '11_109001_005', '11_109001_116'],
          }),
          correlationStatus:
            'skill-level-only-action-variant-binding-unresolved',
          applied: false,
        }),
      ],
      actionSummaries: [
        expect.objectContaining({
          actionId: 'action-0001',
          actionVariantLabel: '普攻',
          rawMultiplier: '649%',
          previewRoundedValue: 307,
          damageFields: expect.objectContaining({
            amp: 6553,
            physicalRatio: 10000,
            elementCalFactor: 10000,
          }),
          skillControlBehaviorCorrelation: expect.objectContaining({
            hpLaneCandidateCount: 5,
            sampledHpBehaviorChainCount: 5,
            hitFrameStartFrames: [12, 13, 16, 19],
            stateNames: ['Skill0_6', 'Skill0_1'],
            correlationStatus:
              'skill-level-only-action-variant-binding-unresolved',
            actionVariantBindingStatus:
              'action-variant-binding-candidates-generated-unconfirmed',
            stateTimingEvidenceStatus:
              'state-timing-evidence-found-action-binding-unconfirmed',
            stateTimingFindings: [
              expect.objectContaining({
                stateName: 'Skill0_1',
                status: 'hp-state-has-animation-control-candidate',
                hpWindowCount: 2,
                animationControlCount: 1,
              }),
            ],
            actionVariantBindingCandidate: expect.objectContaining({
              confidence: 'medium',
              candidateCount: 5,
              candidates: expect.arrayContaining([
                expect.objectContaining({
                  sourceName: '普通-攻击碰撞',
                  sourceStartFrame: 12,
                  stateNames: ['Skill0_1'],
                  bindingStatus:
                    'normal-action-name-state-candidate-unconfirmed',
                }),
              ]),
            }),
          }),
        }),
      ],
    });
    expect(
      result.summary.formulaCandidatePatternSummary.requiredScaleMin
    ).toBeCloseTo(40.59, 2);
    expect(
      result.summary.formulaCandidatePatternSummary.requiredScaleMax
    ).toBeCloseTo(40.59, 2);
    expect(result.summary.formulaExecutionMatrixSummary).toMatchObject({
      status: 'single-formula-execution-matrix',
      actionCount: 1,
      matrixActionCount: 1,
      actionVariantLabels: ['普攻'],
      rowCount: 2,
      elementCount: 2,
      preferredStrategy: 'function_2-current-level-value-param',
      scaleSpreadStatus: 'stable-across-action-variants',
      hitBindingCoverageStatus: 'all-rows-have-hit-bindings',
      slotOverrideCoverageStatus: 'all-rows-have-slot-override-candidates',
      rowsWithLargeDifference: 2,
      rowsWithSlotOverrideCandidates: 2,
      rowsWithDirectSlotMatches: 2,
      rowsWithHitBindings: 2,
      hitBindingGapSummary: {
        status: 'all-actions-have-hit-bindings',
        actionCount: 1,
        missingActionCount: 0,
        missingRowCount: 0,
        actionsWithBindingCandidates: 0,
        externalElementBindingSummary: {
          status: 'no-hit-binding-gaps',
          gapCount: 0,
          gapsWithExternalElementCandidates: 0,
          gapsWithDamageElementCandidates: 0,
          damageElementCandidateCount: 0,
          applied: false,
        },
        elementSourceAlignmentSummary: {
          status: 'no-hit-binding-gaps',
          gapCount: 0,
          alignedGapCount: 0,
          divergentGapCount: 0,
          overlappingGapCount: 0,
          missingGapCount: 0,
          applied: false,
        },
        gaps: [],
        applied: false,
      },
      diagnostics: expect.objectContaining({
        functionCombinationOrderStatus: 'unconfirmed',
        levelOverrideApplicationStatus: 'unconfirmed',
        perHitMultiplierAllocationStatus: 'unconfirmed',
        crossActionMatrixStatus: 'needs-more-action-samples',
        hitBindingGapStatus: 'all-actions-have-hit-bindings',
      }),
      actionSummaries: [
        expect.objectContaining({
          actionId: 'action-0001',
          actionVariantLabel: '普攻',
          rowCount: 2,
          rowsWithHitBindings: 2,
          hitBindingCoverageStatus: 'all-rows-have-hit-bindings',
          hitBindingGap: expect.objectContaining({
            status: 'hit-bindings-complete',
            missingRowCount: 0,
          }),
        }),
      ],
      elementSummaries: expect.arrayContaining([
        expect.objectContaining({
          elementConfigId: 109001081,
          actionCount: 1,
          actionVariantLabels: ['普攻'],
          hitIndexes: [1],
          rowCount: 1,
          rowsWithHitBindings: 1,
          hitBindingCoverageStatus: 'all-rows-have-hit-bindings',
        }),
      ]),
      applied: false,
    });
    expect(
      result.summary.formulaExecutionMatrixSummary.requiredScaleMin
    ).toBeCloseTo(40.59, 2);
    expect(
      result.summary.formulaExecutionMatrixSummary.requiredPerHitScaleMin
    ).toBeCloseTo(8.12, 2);
    expect(result.summary).toMatchObject({
      projectedHitCount: 1,
      actionResultCount: 1,
      totalRawDamage: 12461,
      totalProjectedToughnessDamage: 0,
      totalSelfEnergyDelta: 0,
      selfEnergyDeltaByActor: [
        {
          actorId: 'actor-109001',
          actorName: '末音',
          resource: 'sp',
          delta: 0,
        },
      ],
      actionCount: 1,
      formulaVersion: 'stage5-damage-layer-breakdown-v1',
      confidence: 'low',
      timingMissingActionCount: 1,
      timingMissingActionIds: ['action-0001'],
    });
    expect(result.diagnostics.limitations.join('\n')).toContain(
      'Raw damage projection only'
    );
    expect(result.diagnostics.limitations.join('\n')).toContain(
      'Formula breakdown exposes unapplied layers'
    );
    expect(result.diagnostics.limitations.join('\n')).toContain(
      'Every action result tracks HP damage, toughness damage, and self energy delta'
    );
  });

  it('surfaces Hanyouyou summon target damage element candidates per hit', () => {
    const project = createWorkbenchProject(
      {
        characterId: 101003,
        secondaryCharacterId: 109001,
        skillId: 10100301,
      },
      {
        actions: [
          {
            id: 'action-hanyouyou-normal',
            type: 'skill',
            skillId: 10100301,
            actorCharacterId: 101003,
            level: 1,
            actionVariantIndex: 0,
            durationMs: 5000,
          },
        ],
      }
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const actionResult = result.actionResultTimeline[0];

    expect(actionResult.hitCandidateSummary).toMatchObject({
      hitCandidateCount: 4,
      mappedHitCandidateCount: 4,
      damageElementFieldMappingCount: 6,
      summonTargetMappedHitCandidateCount: 2,
      summonTargetDamageElementFieldMappingCount: 4,
      summonTargetDamageElementConfigIds: [
        101003156, 101003157, 101003179, 101003182,
      ],
      summonTargetSkillIds: [48005901, 48006001],
      summonUnitIds: [480059, 480060],
      summonTargetTriggerTimingStatuses: [
        'summon-target-trigger-frame-candidates-found-unconfirmed',
      ],
      summonTargetTriggerFrameCandidates: [0, 1, 4, 5, 20, 25, 29, 34, 38, 43],
      applied: false,
    });

    const hit4 = actionResult.hitCandidates.find(
      candidate => candidate.hitIndex === 4
    );
    expect(hit4).toMatchObject({
      hitSkillId: 10100304,
      status:
        'per-hit-summon-target-candidate-fields-found-trigger-unconfirmed',
      damageElementFieldMappingCount: 2,
      directDamageElementFieldMappingCount: 0,
      summonTargetDamageElementFieldMappingCount: 2,
      damageElementElementConfigIds: [101003156, 101003182],
      summonTargetEvidenceSummary: expect.objectContaining({
        summonUnitIds: [480059],
        targetSkillIds: [48005901],
        damageElementConfigIds: [101003156, 101003182],
        triggerTimingStatus:
          'summon-target-trigger-frame-candidates-found-unconfirmed',
        triggerFrameCandidates: [0, 1, 4, 25, 34, 43],
        hitCountStatus: 'summon-target-hit-count-unconfirmed',
        runtimeOwnershipStatus: 'summon-target-runtime-ownership-unconfirmed',
        applied: false,
      }),
      hpDamage: expect.objectContaining({
        status: 'candidate-fields-found-formula-unmapped',
        candidateCount: 2,
        formulaFunctionIds: [1, 2],
      }),
      toughnessDamage: expect.objectContaining({
        candidateCount: 2,
        weakBreakDamageRates: [7000],
      }),
      selfEnergyChange: expect.objectContaining({
        candidateCount: 2,
        recoverSPValues: [4300],
      }),
      applied: false,
    });
    expect(hit4.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'azpr-summon-target-damage-element-candidate',
          elementConfigId: 101003156,
          summonTarget: expect.objectContaining({
            summonUnitId: 480059,
            targetSkillId: 48005901,
            triggerTimingStatus:
              'summon-target-trigger-frame-candidates-found-unconfirmed',
            triggerFrameCandidates: [0, 1, 4, 25, 34, 43],
            skillControlStatus: 'skill-control-json-readable',
          }),
          skillLevelBridge: expect.objectContaining({
            source: 'summon-target-skill-element-values',
            levelRows: 12,
            formulaSlotAlignment: expect.objectContaining({
              overrideCandidateParamIds: [1],
              parameterSummaries: expect.arrayContaining([
                expect.objectContaining({
                  id: 1,
                  relationStatus: 'level-scaling-override-candidate',
                  firstLevelValue: 3500,
                  lastLevelValue: 7350,
                }),
                expect.objectContaining({
                  id: 7,
                  relationStatus: 'constant-direct-slot-match',
                  firstLevelValue: 10000,
                  lastLevelValue: 10000,
                }),
              ]),
            }),
          }),
        }),
      ])
    );

    const hit5 = actionResult.hitCandidates.find(
      candidate => candidate.hitIndex === 5
    );
    expect(hit5).toMatchObject({
      hitSkillId: 10100305,
      damageElementElementConfigIds: [101003157, 101003179],
      summonTargetEvidenceSummary: expect.objectContaining({
        summonUnitIds: [480060],
        targetSkillIds: [48006001],
        damageElementConfigIds: [101003157, 101003179],
      }),
      selfEnergyChange: expect.objectContaining({
        recoverSPValues: [7099],
      }),
    });

    expect(result.candidateValueSeries.summary).toMatchObject({
      seriesCount: 3,
      pointCount: 12,
      hitCandidateCount: 4,
      actionCount: 1,
      applied: false,
    });
    expect(result.threeValueCurveFramework.summary).toMatchObject({
      trackCount: 3,
      candidateTrackCount: 3,
      candidatePointCount: 12,
      chartPointCount: 12,
      stateCurvePointCount: 13,
      appliedStatePointCount: 1,
      candidateStatePointCount: 12,
      detailsDeferred: true,
      applied: false,
    });
    expect(result.threeValueCurveFramework.stateCurves.summary).toMatchObject({
      pointCount: 13,
      appliedPointCount: 1,
      candidatePointCount: 12,
      placeholderPointCount: 0,
      cumulativeLayerCount: 4,
      applied: false,
    });
    expect(result.threeValueGenerationLayer.summary).toMatchObject({
      actionCount: 1,
      hitCount: 5,
      deltaCount: 13,
      appliedDeltaCount: 1,
      candidateDeltaCount: 12,
      sampledDeltaCount: 0,
      placeholderDeltaCount: 0,
      applied: false,
    });
    expect(
      result.threeValueGenerationLayer.actions[0].hits
        .filter(
          hit => hit.hitIndex != null && Number.isFinite(Number(hit.hitIndex))
        )
        .map(hit => [hit.hitIndex, hit.deltaCount, hit.trackKeys])
    ).toEqual([
      [2, 3, ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange']],
      [3, 3, ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange']],
      [4, 3, ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange']],
      [5, 3, ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange']],
    ]);
    const hpSeries = result.candidateValueSeries.series.find(
      series => series.key === 'hpDamageFormulaParamCandidate'
    );
    const hpHit4Point = hpSeries.points.find(point => point.hitIndex === 4);
    expect(hpHit4Point).toMatchObject({
      hitSkillId: 10100304,
      elementConfigIds: [101003156, 101003182],
      summonTargetEvidenceSummary: expect.objectContaining({
        summonUnitIds: [480059],
        targetSkillIds: [48005901],
      }),
      triggerTimingStatus:
        'summon-target-trigger-frame-candidates-found-unconfirmed',
    });
    expect(hpHit4Point.elementDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceKind: 'azpr-summon-target-damage-element-candidate',
          elementConfigId: 101003156,
          summonTarget: expect.objectContaining({
            summonUnitId: 480059,
            targetSkillId: 48005901,
          }),
        }),
      ])
    );
  });

  it('imports offline RecoverSP runtime sample fixtures for validation', () => {
    const project = createFirstVerticalSliceProject();
    project.metadata = {
      ...project.metadata,
      runtimeSampleCaptures: [createRecoverSpRuntimeSampleFixture()],
    };

    const scenario = compileProject(project, getFirstVerticalSliceGameData());
    expect(scenario.runtimeSampleCaptures).toHaveLength(1);
    expect(scenario.sourceProject.metadata.runtimeSampleCaptures).toHaveLength(
      1
    );

    const result = runSimulation(project, getFirstVerticalSliceGameData());
    const probe =
      result.actionResultTimeline[0].selfEnergyChange.runtimeFormulaProbe
        .runtimeSamplingProbe;
    const matchedSample = probe.sampleExpectations.find(
      sample => sample.elementConfigId === 109001081
    );
    const missingSample = probe.sampleExpectations.find(
      sample => sample.elementConfigId === 109001306
    );

    expect(probe).toMatchObject({
      status: 'runtime-sampling-offline-samples-partially-validated',
      importedRuntimeSampleCount: 6,
      importStatus: 'offline-runtime-samples-validated',
      sampleImportSummary: expect.objectContaining({
        status: 'runtime-sample-import-partial',
        captureCount: 1,
        importedRuntimeSampleCount: 6,
        matchedSampleCount: 1,
        validatedSampleCount: 1,
        missingSampleCount: 1,
      }),
    });
    expect(probe.sampleImportSummary.importedEventTypes).toEqual(
      expect.arrayContaining([
        'recover-sp-args-built',
        'recover-sp-modifier-property-read',
        'recover-sp-ontransmit-12f',
        'recover-sp-applied',
        'recover-sp-share-rebroadcast',
      ])
    );
    expect(matchedSample).toMatchObject({
      status: 'offline-runtime-sample-validated',
      runtimeSampleMatch: expect.objectContaining({
        validationStatus: 'offline-runtime-sample-validated',
        matchedEventCount: 6,
        eventTypeCounts: expect.objectContaining({
          'recover-sp-args-built': 1,
          'recover-sp-modifier-property-read': 2,
          'recover-sp-ontransmit-12f': 1,
          'recover-sp-applied': 1,
          'recover-sp-share-rebroadcast': 1,
        }),
        modifierValues: {
          SPGETUP: 0.2,
          SPGETUP_ATK: 0.05,
          multiplier: 1.25,
        },
        expectedRuntimeArgs: {
          baseDelta: 0.27,
          delta: 0.3375,
          petDelta: 1.299875,
          interval: 9.999,
        },
        observedRuntimeArgs: expect.objectContaining({
          baseDelta: 0.27,
          delta: 0.3375,
          petDelta: 1.299875,
          interval: 9.999,
          tagType: 0,
        }),
        onTransmit: expect.objectContaining({
          timerMapHit: false,
          directRecoverCalled: true,
          receiverEntityId: 'runtime-role-109001',
        }),
        finalSpCurve: expect.objectContaining({
          roleEntityId: 'runtime-role-109001',
          spBefore: 10,
          spAfter: 10.3375,
          spDeltaApplied: 0.3375,
        }),
      }),
    });
    expect(result.summary.threeValueCurveFrameworkSummary).toMatchObject({
      stateCurvePointCount: 17,
      appliedStatePointCount: 1,
      candidateStatePointCount: 15,
      sampledStatePointCount: 1,
      placeholderStatePointCount: 0,
      applied: false,
    });
    expect(result.threeValueCurveFramework.stateCurves.summary).toMatchObject({
      pointCount: 17,
      appliedPointCount: 1,
      candidatePointCount: 15,
      sampledPointCount: 1,
      placeholderPointCount: 0,
      cumulativeLayerCount: 5,
      applied: false,
    });
    const selfEnergyStateTrack =
      result.threeValueCurveFramework.stateCurves.tracks.find(
        track => track.trackKey === 'selfEnergyChange'
      );
    const sampledLayer = selfEnergyStateTrack.layers.find(
      layer => layer.key === 'sampled'
    );
    expect(sampledLayer).toMatchObject({
      status: 'delta-cumulative-points-built',
      mappingStatus: 'runtime-samples-mapped-to-state-curve',
      runtimeSampleCount: 1,
      importedRuntimeSampleCount: 6,
      pointCount: 1,
      finalCumulative: 0.3375,
      applied: false,
    });
    expect(sampledLayer.points[0]).toMatchObject({
      sourceKind: 'runtime-recover-sp-applied-sample',
      captureSessionId: 'fixture-recover-sp-109001081-v1',
      eventType: 'recover-sp-applied',
      actionId: 'action-0001',
      actorId: 'actor-109001',
      sourceElementConfigId: 109001081,
      frameIndex: 12,
      frameLabel: '0s12f',
      delta: 0.3375,
      cumulative: 0.3375,
      spBefore: 10,
      spAfter: 10.3375,
      recoverTagType: 0,
      applied: false,
    });
    expect(result.threeValueGenerationLayer.summary).toMatchObject({
      deltaCount: 17,
      appliedDeltaCount: 2,
      candidateDeltaCount: 15,
      sampledDeltaCount: 0,
      placeholderDeltaCount: 0,
      replaceableDeltaCount: 15,
      appliedSourceBindingRequiredDeltaCount: 1,
      appliedSourceBindingReadyDeltaCount: 1,
      appliedSourceBindingInvalidDeltaCount: 0,
      appliedSourceBindingCompatibleUnboundDeltaCount: 1,
      appliedSourceBindingKinds: expect.arrayContaining([
        'hp-skill-variant-operands',
        'validated-runtime-sample',
      ]),
      applied: false,
    });
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      inputDeltaCount: 17,
      appliedDeltaCount: 2,
      enemyHpDelta: 12461,
      selfEnergyDelta: 0.3375,
      selfEnergyPointCount: 1,
      simLogCount: 2,
      calculatorCount: 2,
      calculatorKeys: [
        'azpr-hp-delta-calculator',
        'azpr-self-energy-delta-calculator',
      ],
      calculatorReplaceableDeltaCount: 1,
      applied: true,
    });
    const appliedRuntimeSampleDelta =
      result.threeValueGenerationLayer.deltas.find(
        delta => delta.sourceKind === 'azpr-validated-runtime-mechanism-sample'
      );
    expect(appliedRuntimeSampleDelta).toMatchObject({
      actionId: 'action-0001',
      hitKey: 'event-recover-sp-applied-4',
      trackKey: 'selfEnergyChange',
      layerKey: 'applied',
      sourceKind: 'azpr-validated-runtime-mechanism-sample',
      confidence: 'runtime-sample-validated',
      frameIndex: 12,
      energyDelta: 0.3375,
      hpDelta: null,
      toughnessDelta: null,
      calculatorKey: 'azpr-self-energy-delta-calculator',
      calculationKind: 'recover-sp-runtime-sample-confirmed',
      calculationStatus: 'runtime-final-confirmed-recover-sp-sample',
      calculationReplaceable: false,
      appliedSourceBindingState: 'bound-ready',
      appliedSourceBindingKind: 'validated-runtime-sample',
      appliedSourceBindingIdentity: expect.stringMatching(
        /^azpr-applied-source-v1-/u
      ),
      applied: true,
      replaceable: false,
      calculator: {
        outputField: 'energyDelta',
        delta: 0.3375,
        confidence: 'runtime-sample-validated',
        replaceable: false,
        unresolved: [],
      },
      sourceIds: {
        elementConfigIds: [109001081],
        captureSessionIds: ['fixture-recover-sp-109001081-v1'],
      },
      mechanicsAdapterRequest: {
        sourceValue: {
          operands: expect.objectContaining({
            contractName: 'AzPrThreeValueMechanicsOperands',
            contractVersion: 3,
            kind: 'validated-self-energy-before-after',
            expectedDelta: 0.3375,
            sourceBindingRequired: true,
            sourceBindingReady: true,
            sourceBindingKind: 'validated-runtime-sample',
            sourceBindingIdentity: expect.stringMatching(
              /^azpr-applied-source-v1-/u
            ),
            sourceBinding: expect.objectContaining({
              contractName: 'AzPrThreeValueAppliedSourceBinding',
              kind: 'validated-runtime-sample',
              ready: true,
            }),
            ready: true,
          }),
        },
      },
    });
    expect(
      result.threeValueRuntimeProjection.runtimeAppliedDeltas.find(
        delta => delta.sourceDeltaId === appliedRuntimeSampleDelta.id
      ).runtimeCalculatorInvocation
    ).toMatchObject({
      output: { delta: 0.3375, calculatedFromLayerInputs: true },
      input: {
        sourceValue: {
          operands: { kind: 'validated-self-energy-before-after' },
        },
      },
      mechanicsEvaluation: {
        contractVersion: 5,
        operandSourceBindingState: 'bound-ready',
        operandSourceBindingRequired: true,
        operandSourceBindingReady: true,
        stepResults: [
          expect.objectContaining({ operation: 'after-minus-before' }),
        ],
        ready: true,
      },
    });
    expect(
      result.threeValueRuntimeProjection.selfEnergyCurveByActor[0]
    ).toMatchObject({
      actorId: 'actor-109001',
      delta: 0.3375,
      pointCount: 1,
      points: [
        expect.objectContaining({
          actionId: 'action-0001',
          frameIndex: 12,
          energyDelta: 0.3375,
          calculationStatus: 'runtime-final-confirmed-recover-sp-sample',
          applied: true,
        }),
      ],
    });
    expect(
      result.threeValueGenerationLayer.deltas.find(
        delta => delta.layerKey === 'sampled'
      )
    ).toBeUndefined();
    expect(matchedSample.runtimeSampleMatch.validationResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'base-delta-scale',
          status: 'passed',
        }),
        expect.objectContaining({
          key: 'delta-scale-and-modifier',
          status: 'passed',
        }),
        expect.objectContaining({
          key: 'pet-delta-scale-and-modifier',
          status: 'passed',
        }),
        expect.objectContaining({
          key: 'interval-scale',
          status: 'passed',
        }),
        expect.objectContaining({
          key: 'final-sp-curve',
          status: 'passed',
        }),
      ])
    );
    expect(missingSample).toMatchObject({
      status: 'offline-runtime-sample-missing',
      runtimeSampleMatch: expect.objectContaining({
        validationStatus: 'offline-runtime-sample-missing',
        matchedEventCount: 0,
      }),
    });
  });

  it('promotes a complete toughness runtime sample into the applied runtime curve', () => {
    const project = createFirstVerticalSliceProject();
    project.metadata = {
      ...project.metadata,
      runtimeSampleCaptures: [createToughnessRuntimeSampleFixture()],
    };

    const result = runSimulation(project, getFirstVerticalSliceGameData());
    const toughnessDelta = result.threeValueGenerationLayer.deltas.find(
      delta =>
        delta.trackKey === 'enemyToughnessDamage' && delta.applied === true
    );

    expect(toughnessDelta).toMatchObject({
      actionId: 'action-0001',
      trackKey: 'enemyToughnessDamage',
      layerKey: 'applied',
      sourceKind: 'azpr-validated-runtime-mechanism-sample',
      frameIndex: 12,
      toughnessDelta: 70,
      calculationKind: 'toughness-runtime-sample-confirmed',
      calculationStatus: 'runtime-final-confirmed-toughness-sample',
      calculationReplaceable: false,
      appliedSourceBindingState: 'bound-ready',
      appliedSourceBindingKind: 'validated-runtime-sample',
      appliedSourceBindingIdentity: expect.stringMatching(
        /^azpr-applied-source-v1-/u
      ),
      applied: true,
      replaceable: false,
      mechanicsAdapterRequest: {
        sourceValue: {
          operands: expect.objectContaining({
            contractName: 'AzPrThreeValueMechanicsOperands',
            contractVersion: 3,
            kind: 'validated-toughness-before-after',
            expectedDelta: 70,
            sourceBindingRequired: true,
            sourceBindingReady: true,
            sourceBindingKind: 'validated-runtime-sample',
            sourceBinding: expect.objectContaining({
              contractName: 'AzPrThreeValueAppliedSourceBinding',
              kind: 'validated-runtime-sample',
              ready: true,
            }),
            ready: true,
          }),
        },
      },
    });
    expect(
      result.threeValueRuntimeProjection.runtimeAppliedDeltas.find(
        delta => delta.sourceDeltaId === toughnessDelta.id
      ).runtimeCalculatorInvocation
    ).toMatchObject({
      output: { delta: 70, calculatedFromLayerInputs: true },
      input: {
        sourceValue: {
          operands: { kind: 'validated-toughness-before-after' },
        },
      },
      mechanicsEvaluation: {
        contractVersion: 5,
        operandSourceBindingState: 'bound-ready',
        operandSourceBindingRequired: true,
        operandSourceBindingReady: true,
        stepResults: [
          expect.objectContaining({ operation: 'before-minus-after' }),
        ],
        ready: true,
      },
    });
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      appliedDeltaCount: 2,
      enemyHpDelta: 12461,
      enemyToughnessDelta: 70,
      enemyStatePointCount: 2,
      simLogCount: 2,
      operandSourceBindingRequiredInvocationCount: 1,
      operandSourceBindingReadyInvocationCount: 1,
      operandSourceBindingInvalidInvocationCount: 0,
      operandSourceBindingCompatibleUnboundInvocationCount: 1,
    });
    expect(result.threeValueRuntimeProjection.enemyStateCurve).toMatchObject({
      toughnessDelta: 70,
      toughnessInitial: 26822.0077,
      toughnessRemaining: 26752.0077,
      pointCount: 2,
    });
  });

  it('keeps inconsistent toughness runtime samples out of applied results', () => {
    const project = createFirstVerticalSliceProject();
    const capture = createToughnessRuntimeSampleFixture();
    capture.events[0].toughnessAfter = 6600;
    project.metadata = {
      ...project.metadata,
      runtimeSampleCaptures: [capture],
    };

    const result = runSimulation(project, getFirstVerticalSliceGameData());

    expect(
      result.threeValueGenerationLayer.deltas.filter(
        delta => delta.trackKey === 'enemyToughnessDamage' && delta.applied
      )
    ).toHaveLength(0);
    expect(
      result.threeValueGenerationLayer.deltas.find(
        delta =>
          delta.trackKey === 'enemyToughnessDamage' &&
          delta.layerKey === 'sampled'
      )
    ).toMatchObject({
      sourceKind: 'runtime-toughness-damage-applied-sample',
      toughnessDelta: 70,
      calculationKind: 'toughness-runtime-sample',
      calculationStatus: 'toughness-runtime-sample-unapplied',
      applied: false,
      replaceable: true,
    });
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      appliedDeltaCount: 1,
      enemyToughnessDelta: 0,
    });
  });

  it('rejects invalid projects before simulation', () => {
    const project = createFirstVerticalSliceProject();
    project.actions[0] = {
      ...project.actions[0],
      skillId: 999999999,
    };

    expect(() =>
      compileProject(project, getFirstVerticalSliceGameData())
    ).toThrow(CompileProjectError);
  });

  it('sorts multiple actions and summarizes projected damage', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          { id: 'action-late', skillId: 10900101, startMs: 2000, level: 1 },
          { id: 'action-early', skillId: 10900101, startMs: 500, level: 2 },
        ],
      }
    );
    const gameData = getWorkbenchGameData();
    const scenario = compileProject(project, gameData);
    const result = runSimulation(project, gameData);

    expect(scenario.actions.map(action => action.id)).toEqual([
      'action-early',
      'action-late',
    ]);
    expect(result.damageTimeline).toHaveLength(2);
    expect(result.damageTimeline.map(entry => entry.actionId)).toEqual([
      'action-early',
      'action-late',
    ]);
    expect(result.summary.projectedHitCount).toBe(2);
    expect(result.summary.actionCount).toBe(2);
    expect(result.summary.totalRawDamage).toBe(
      result.damageTimeline.reduce((sum, entry) => sum + entry.rawDamage, 0)
    );
  });

  it('uses the selected skill damage segment for projection', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-heavy',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
            damageSegmentIndex: 1,
          },
        ],
      }
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());

    expect(scenario.actions[0].damageSegmentIndex).toBe(1);
    expect(scenario.actions[0].selectedDamageSegment).toMatchObject({
      index: 1,
      label: '重击',
      rawValue: '190%',
      multiplier: 1.9,
    });
    expect(result.damageTimeline[0]).toMatchObject({
      actionId: 'action-heavy',
      segmentLabel: '重击',
      multiplier: 1.9,
    });
  });

  it('projects generated skill segment actions as separate damage entries', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [0, 1, 2, 3].map(damageSegmentIndex => ({
          id: `action-segment-${damageSegmentIndex}`,
          type: 'skill',
          skillId: 10900101,
          startMs: damageSegmentIndex * 1000,
          level: 1,
          damageSegmentIndex,
        })),
      }
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());

    expect(
      scenario.actions.map(action => action.selectedDamageSegment.label)
    ).toEqual(['普攻', '重击', '闪击', '跃击']);
    expect(
      result.damageTimeline.map(entry => [
        entry.actionId,
        entry.segmentLabel,
        entry.multiplier,
      ])
    ).toEqual([
      ['action-segment-0', '普攻', 6.49],
      ['action-segment-1', '重击', 1.9],
      ['action-segment-2', '闪击', 0.4],
      ['action-segment-3', '跃击', 1.36],
    ]);
    expect(result.summary.projectedHitCount).toBe(4);
    expect(result.summary.formulaCandidatePatternSummary).toMatchObject({
      status: 'formula-candidate-patterns-found',
      actionCount: 4,
      comparableActionCount: 4,
      preferredStrategy: 'function_2-current-level-value-param',
      scaleSpreadStatus: 'varies-by-action-variant',
      previewValueStatus: 'same-preview-across-actions',
      behaviorCorrelationStatus:
        'skill-level-behavior-candidates-found-action-binding-unresolved',
      missingRuntimeScaleStatus:
        'tracks-description-multiplier-before-runtime-hit-mapping',
      skillControlBehaviorCorrelations: [
        expect.objectContaining({
          status: 'skill-level-hp-behavior-candidates-found',
          hpLaneCandidateCount: 5,
          resolvedHpBehaviorRefCount: 5,
          sampledHpBehaviorChainCount: 5,
          sampledHpLaneCandidateCount: 5,
          hitFrameStartFrames: [12, 13, 16, 19],
          stateTimingEvidenceStatus:
            'state-timing-evidence-found-action-binding-unconfirmed',
          stateTimingEvidence: expect.objectContaining({
            animationStateNames: ['Skill0_1', 'Skill0_6'],
            eventBridgeSkillIds: [0, 80102, 10900102],
            eventBridgeTargetSkillControlEvidence: expect.objectContaining({
              targetAnimationStateNames: [
                'Skill0_2',
                'Skill0_3',
                'Skill0_4',
                'Skill0_5',
              ],
              normalAttackChainCandidate: expect.objectContaining({
                chainSkillIds: [10900102, 10900103, 10900104, 10900105],
                chainLength: 4,
              }),
              normalAttackHitChainCandidate: expect.objectContaining({
                expectedHitCount: 5,
                candidateHitGroupCount: 5,
                coverageStatus: 'matches-description-hit-count',
                hpTimelineCandidateCount: 32,
                damageElementFieldMappingStatus:
                  'all-hit-groups-have-damage-element-field-mappings',
                damageElementMappedHitGroupCount: 5,
                damageElementFieldMappingCount: 12,
              }),
              targetSkillControls: [
                expect.objectContaining({
                  skillId: 10900102,
                  status: 'found',
                  animationStateNames: ['Skill0_2'],
                }),
                expect.objectContaining({
                  skillId: 10900103,
                  status: 'found',
                  animationStateNames: ['Skill0_3'],
                }),
                expect.objectContaining({
                  skillId: 10900104,
                  status: 'found',
                  animationStateNames: ['Skill0_4'],
                }),
                expect.objectContaining({
                  skillId: 10900105,
                  status: 'found',
                  animationStateNames: ['Skill0_5'],
                }),
                expect.objectContaining({
                  skillId: 80102,
                  status: 'missing-skill-control-directory',
                }),
              ],
            }),
            stateFindings: [
              expect.objectContaining({
                stateName: 'Skill0_1',
                status: 'hp-state-has-animation-control-candidate',
              }),
              expect.objectContaining({
                stateName: 'Skill0_6',
                status: 'hp-state-has-animation-control-candidate',
              }),
            ],
          }),
          actionVariantBindingStatus:
            'action-variant-binding-candidates-generated-unconfirmed',
          actionVariantBindingSummary: {
            actionVariantCount: 4,
            boundCandidateCount: 4,
            confidenceLevels: ['medium', 'low'],
            statuses: ['action-variant-binding-candidates-found'],
          },
          correlationStatus:
            'skill-level-only-action-variant-binding-unresolved',
        }),
      ],
      previewRoundedValues: [307],
      applied: false,
    });
    expect(result.summary.formulaExecutionMatrixSummary).toMatchObject({
      status: 'formula-execution-matrices-found',
      actionCount: 4,
      matrixActionCount: 4,
      actionVariantCount: 4,
      actionVariantLabels: ['普攻', '重击', '闪击', '跃击'],
      rowCount: 8,
      elementCount: 2,
      preferredStrategy: 'function_2-current-level-value-param',
      scaleSpreadStatus: 'varies-by-action-variant',
      perHitScaleSpreadStatus: 'varies-by-action-variant',
      hitBindingCoverageStatus: 'some-rows-missing-hit-bindings',
      slotOverrideCoverageStatus: 'all-rows-have-slot-override-candidates',
      rowsWithLargeDifference: 8,
      rowsWithSlotOverrideCandidates: 8,
      rowsWithDirectSlotMatches: 8,
      rowsWithHitBindings: 2,
      hitBindingGapSummary: expect.objectContaining({
        status: 'all-missing-hit-actions-have-skill-control-candidates',
        actionCount: 4,
        missingActionCount: 3,
        missingRowCount: 6,
        actionsWithBindingCandidates: 3,
        actionVariantLabels: ['重击', '闪击', '跃击'],
        candidateSourceNames: ['攻击碰撞'],
        candidateStateNames: ['Skill0_6'],
        bindingStatuses: ['shared-action-family-candidate-unconfirmed'],
        externalElementBindingSummary: expect.objectContaining({
          status: 'all-candidate-gaps-have-damage-element-field-candidates',
          gapCount: 3,
          gapsWithExternalElementCandidates: 3,
          gapsWithDamageElementCandidates: 3,
          damageElementCandidateCount: 1,
          damageElementConfigIds: [109001251],
          damageElementPathIds: ['-5633710717881758712'],
          sourceStartFrames: [13, 16, 19],
          stateNames: ['Skill0_6'],
          hitEffects: ['11_109001_133', '11_109001_005'],
          subSkillIds: [109001011],
          scriptClassNames: [
            'TDamageElementParams',
            'TFreezeFrameElementParams',
            'TFxElementParams',
          ],
          hpFormulaFunctionIds: [1, 2],
          weakBreakDamageRates: [7000],
          recoverSPValues: [5899],
          skillLevelBridgeStatuses: ['skillsub-element-level-bridge-missing'],
          relatedSkillLevelBridgeStatuses: [
            'related-slot-skill-element-level-bridge-found',
          ],
          relatedSkillLevelBridgePrimarySkillIds: [10900125],
          relatedSkillLevelBridgeLevelRows: 36,
          relatedSkillLevelBridgeInheritanceStatuses: [
            'related-skill-level-inheritance-unconfirmed',
          ],
          gapsWithRelatedSkillLevelBridges: 3,
          runtimeParameterSourceStatuses: [
            'runtime-parameter-source-candidates-found-application-unconfirmed',
          ],
          runtimeParameterSourceCandidateCount: 3,
          runtimeParameterSourceSkillIds: [10900125],
          gapsWithRuntimeParameterSourceCandidates: 3,
          runtimeApplicationTraceStatuses: [
            'runtime-application-entrypoints-found-native-disassembly-snippets',
          ],
          runtimeApplicationTraceChainCount: 9,
          gapsWithRuntimeApplicationTraceEvidence: 3,
          runtimeMethodBodyStatuses: [
            'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
          ],
          runtimeNativeMethodSymbolStatuses: [
            'native-addresses-and-signatures-found-method-bodies-not-extracted',
          ],
          runtimeNativeMethodSymbolCount: 27,
          gapsWithRuntimeNativeMethodSymbols: 3,
          runtimeNativeDisassemblyStatuses: [
            'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
          ],
          runtimeNativeDisassemblyFunctionCount: 9,
          gapsWithRuntimeNativeDisassembly: 3,
          runtimeSelfEnergyFormulaProbeStatuses: [
            'recover-sp-runtime-probe-built-unapplied',
          ],
          runtimeSelfEnergyFormulaProbeCandidateCount: 3,
          runtimeSelfEnergyFormulaProbeGateOpenCount: 3,
          gapsWithRuntimeSelfEnergyFormulaProbe: 3,
          runtimeSelfEnergySourceToArgsProbeStatuses: [
            'source-to-args-subprobe-built-unapplied',
          ],
          runtimeSelfEnergySourceToArgsProbeCandidateCount: 3,
          runtimeSelfEnergySourceToArgsProbeGateOpenCount: 3,
          gapsWithRuntimeSelfEnergySourceToArgsProbe: 3,
          runtimeSelfEnergyModifierProbeStatuses: [
            'runtime-modifier-subprobe-built-unapplied',
          ],
          runtimeSelfEnergyModifierProbeCandidateCount: 3,
          runtimeSelfEnergyModifierProbeGateOpenCount: 3,
          gapsWithRuntimeSelfEnergyModifierProbe: 3,
          runtimeSelfEnergyOwnerShareIntervalProbeStatuses: [
            'owner-share-interval-subprobe-built-unapplied',
          ],
          runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount: 3,
          runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount: 3,
          gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe: 3,
          runtimeSelfEnergySamplingProbeStatuses: [
            'runtime-sampling-schema-built-awaiting-capture',
          ],
          runtimeSelfEnergySamplingProbeCandidateCount: 3,
          runtimeSelfEnergySamplingProbeGateOpenCount: 3,
          gapsWithRuntimeSelfEnergySamplingProbe: 3,
          applied: false,
        }),
        elementSourceAlignmentSummary: expect.objectContaining({
          status:
            'all-candidate-gaps-have-action-level-external-element-divergence',
          gapCount: 3,
          alignedGapCount: 3,
          divergentGapCount: 3,
          overlappingGapCount: 0,
          actionLevelElementConfigIds: [109001081, 109001306],
          matrixElementConfigIds: [109001081, 109001306],
          externalDamageElementConfigIds: [109001251],
          overlapElementConfigIds: [],
          actionLevelOnlyElementConfigIds: [109001081, 109001306],
          externalOnlyElementConfigIds: [109001251],
          actionLevelSubSkillIds: [10900101],
          externalSubSkillIds: [109001011],
          externalStateNames: ['Skill0_6'],
          externalHitEffects: ['11_109001_133', '11_109001_005'],
          externalSkillLevelBridgeStatuses: [
            'skillsub-element-level-bridge-missing',
          ],
          findings: [
            'skill-control-subskill-damage-element-not-in-action-level-values',
          ],
          applied: false,
        }),
        gaps: expect.arrayContaining([
          expect.objectContaining({
            actionId: 'action-segment-1',
            actionVariantLabel: '重击',
            status:
              'skill-control-binding-candidate-found-hit-elements-unresolved',
            missingRowCount: 2,
            behaviorBindingCandidateCount: 5,
            behaviorBindingConfidence: 'low',
            sourceNames: ['攻击碰撞'],
            stateNames: ['Skill0_6'],
            bindingStatuses: ['shared-action-family-candidate-unconfirmed'],
            externalElementBinding: expect.objectContaining({
              status:
                'damage-element-field-candidates-found-hit-binding-unconfirmed',
              sourceCandidateCount: 3,
              elementBaseRefCount: 9,
              resolvedElementRefCount: 9,
              uniqueExternalElementObjectCount: 3,
              damageElementRefCount: 3,
              damageElementCandidateCount: 1,
              sourceNames: ['攻击碰撞'],
              sourceStartFrames: [13, 16, 19],
              stateNames: ['Skill0_6'],
              hitEffects: ['11_109001_133', '11_109001_005'],
              subSkillIds: [109001011],
              damageElementPathIds: ['-5633710717881758712'],
              damageElementConfigIds: [109001251],
              damageElementNames: ['ast_109001251'],
              hpFormulaFunctionIds: [1, 2],
              hpFormulaFunctionOutputs: ['G/10000', '(self.ATK[0]*A)/10000'],
              weakBreakDamageRates: [7000],
              recoverSPValues: [5899],
              petRecoverSPValues: [22999],
              skillLevelBridgeStatuses: [
                'skillsub-element-level-bridge-missing',
              ],
              relatedSkillLevelBridgeStatuses: [
                'related-slot-skill-element-level-bridge-found',
              ],
              relatedSkillLevelBridgePrimarySkillIds: [10900125],
              relatedSkillLevelBridgeLevelRows: 12,
              relatedSkillLevelBridgeInheritanceStatuses: [
                'related-skill-level-inheritance-unconfirmed',
              ],
              runtimeParameterSourceStatuses: [
                'runtime-parameter-source-candidates-found-application-unconfirmed',
              ],
              runtimeParameterSourceCandidateCount: 1,
              runtimeParameterSourceSkillIds: [10900125],
              runtimeParameterSourceEvidence: expect.objectContaining({
                status:
                  'runtime-parameter-source-candidates-found-application-unconfirmed',
                sourceSkillId: 10900101,
                sourceStateNames: ['Skill0_6'],
                sourceSubSkillIds: [109001011],
                sourceHitEffects: ['11_109001_133', '11_109001_005'],
                damageElementConfigIds: [109001251],
                relatedSkillIds: [10900125],
                derivedSkillIds: [10900125],
                characterSlotRefs: [
                  {
                    characterId: 109001,
                    characterName: '末音',
                    group: 'ground',
                    slot: 207,
                  },
                ],
                candidateCount: 1,
                relationFindings: expect.arrayContaining([
                  'skill-control-source-subskill-uses-external-damage-element',
                  'skill-control-hit-effect-links-external-damage-element',
                  'element-config-id-derived-related-skill-id',
                  'related-bridge-primary-skill-matches-derived-skill-id',
                  'related-skill-present-in-character-slot',
                  'il2cpp-damage-element-parse-receives-skill-id',
                  'il2cpp-skill-element-injector-executes-damage-element',
                ]),
                evidenceRows: expect.arrayContaining([
                  expect.objectContaining({
                    elementConfigId: 109001251,
                    pathId: '-5633710717881758712',
                    primarySkillId: 10900125,
                    primaryRelationStatus: 'element-id-derived-skill-id',
                    levelRows: 12,
                    parameterIds: [1, 7],
                    varyingParameterIds: [1],
                    formulaSlotConclusion:
                      'slot-override-candidate-unconfirmed',
                    inheritanceStatus:
                      'related-skill-level-inheritance-unconfirmed',
                  }),
                ]),
                applied: false,
              }),
              runtimeApplicationTraceStatuses: [
                'runtime-application-entrypoints-found-native-disassembly-snippets',
              ],
              runtimeApplicationTraceChainCount: 3,
              runtimeNativeDisassemblyStatuses: [
                'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
              ],
              runtimeNativeDisassemblyFunctionCount: 9,
              runtimeNativeDisassemblyFunctionKeys: expect.arrayContaining([
                'FormulaUtility.GetOutputDamage@0x187F360',
                'DamageElement.Parse@0x138E5E0',
                'RecoverSPArgs.OnReset@0x1254070',
                'SPSystem.OnTransmit@0x14837F0',
                'SPSystem.RecoverSP@0x1483F40',
                'WeakBreakSystem.OnTransmit@0x14C05A0',
              ]),
              runtimeSelfEnergyFormulaProbeStatuses: [
                'recover-sp-runtime-probe-built-unapplied',
              ],
              runtimeSelfEnergyFormulaProbeCandidateCount: 1,
              runtimeSelfEnergyFormulaProbeGateOpenCount: 1,
              runtimeSelfEnergySourceToArgsProbeStatuses: [
                'source-to-args-subprobe-built-unapplied',
              ],
              runtimeSelfEnergySourceToArgsProbeCandidateCount: 1,
              runtimeSelfEnergySourceToArgsProbeGateOpenCount: 1,
              runtimeSelfEnergyModifierProbeStatuses: [
                'runtime-modifier-subprobe-built-unapplied',
              ],
              runtimeSelfEnergyModifierProbeCandidateCount: 1,
              runtimeSelfEnergyModifierProbeGateOpenCount: 1,
              runtimeSelfEnergyOwnerShareIntervalProbeStatuses: [
                'owner-share-interval-subprobe-built-unapplied',
              ],
              runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount: 1,
              runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount: 1,
              runtimeSelfEnergySamplingProbeStatuses: [
                'runtime-sampling-schema-built-awaiting-capture',
              ],
              runtimeSelfEnergySamplingProbeCandidateCount: 1,
              runtimeSelfEnergySamplingProbeGateOpenCount: 1,
              runtimeSelfEnergyFormulaProbe: expect.objectContaining({
                status: 'recover-sp-runtime-probe-built-unapplied',
                sourceStatus: 'external-damage-element-candidates',
                candidateCount: 1,
                gateOpenCount: 1,
                recoverSPValues: [5899],
                petRecoverSPValues: [22999],
                recoverIntervals: [9999],
                perTenThousandRecoverSPValues: [0.5899],
                perTenThousandPetRecoverSPValues: [2.2999],
                perTenThousandRecoverIntervals: [0.9999],
                sourceToArgsProbe: expect.objectContaining({
                  status: 'source-to-args-subprobe-built-unapplied',
                  candidateCount: 1,
                  gateOpenCount: 1,
                  samples: expect.arrayContaining([
                    expect.objectContaining({
                      elementConfigId: 109001251,
                      argsConstructionCandidates: expect.objectContaining({
                        baseDelta: expect.objectContaining({
                          sourceField: 5899,
                          perTenThousandCandidate: 0.5899,
                        }),
                        petDelta: expect.objectContaining({
                          sourceField: 22999,
                          basePetDeltaCandidate: 2.2999,
                        }),
                      }),
                    }),
                  ]),
                }),
                runtimeModifierProbe: expect.objectContaining({
                  status: 'runtime-modifier-subprobe-built-unapplied',
                  candidateCount: 1,
                  gateOpenCount: 1,
                  modifierPropertyIds: [105, 228],
                  samples: expect.arrayContaining([
                    expect.objectContaining({
                      elementConfigId: 109001251,
                      deltaFormulaPreview: expect.objectContaining({
                        baseDeltaCandidate: 0.5899,
                        petBaseDeltaCandidate: 2.2999,
                        modifierPropertyIds: [105, 228],
                        nativeConstantAddress: '0x189956B08',
                        nativeConstantValue: 1,
                      }),
                      intervalScaleCandidate: expect.objectContaining({
                        sourceField: 9999,
                        nativeDivisorAddress: '0x189956D8C',
                        nativeDivisorValue: 1000,
                        intervalSecondsCandidate: 9.999,
                      }),
                    }),
                  ]),
                }),
                ownerShareIntervalProbe: expect.objectContaining({
                  status: 'owner-share-interval-subprobe-built-unapplied',
                  candidateCount: 1,
                  gateOpenCount: 1,
                  samples: expect.arrayContaining([
                    expect.objectContaining({
                      elementConfigId: 109001251,
                      recoverSpArgsCandidates: expect.objectContaining({
                        petDelta: expect.objectContaining({
                          rawField: 22999,
                          perTenThousand: 2.2999,
                        }),
                      }),
                    }),
                  ]),
                }),
                runtimeSamplingProbe: expect.objectContaining({
                  status: 'runtime-sampling-schema-built-awaiting-capture',
                  candidateCount: 1,
                  gateOpenCount: 1,
                  sampleExpectations: expect.arrayContaining([
                    expect.objectContaining({
                      elementConfigId: 109001251,
                      expectedRecoverSpArgs: expect.objectContaining({
                        baseDelta: 0.5899,
                        intervalSecondsCandidate: 9.999,
                      }),
                      correlationKeys: expect.arrayContaining([
                        'captureSessionId',
                        'frameIndex',
                        'sourceElementConfigId',
                        'args.id',
                        'roleEntityId',
                      ]),
                    }),
                  ]),
                }),
                samples: expect.arrayContaining([
                  expect.objectContaining({
                    elementConfigId: 109001251,
                    recoverSP: 5899,
                    gateOpen: true,
                  }),
                ]),
                applied: false,
              }),
              runtimeApplicationTraceEvidence: expect.objectContaining({
                status:
                  'runtime-application-entrypoints-found-native-disassembly-snippets',
                methodBodyStatus:
                  'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
                methodBodyAvailabilityStatus:
                  'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
                runtimeNativeMethodSymbolCount: 27,
                runtimeNativeMethodSymbolKeys: expect.arrayContaining([
                  'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutputDamage@0x187F360',
                  'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnTransmit@0x14C05A0',
                  'Lens.Gameplay.Modules.BigWorld.SPSystem$$RecoverSP@0x1483F40',
                ]),
                runtimeNativeDisassemblyFunctionCount: 9,
                runtimeNativeDisassemblyFunctionKeys: expect.arrayContaining([
                  'FormulaUtility.GetOutputDamage@0x187F360',
                  'DamageElement.RecoverSP@0x138EEE0',
                  'RecoverSPArgs.OnReset@0x1254070',
                  'SPSystem.OnTransmit@0x14837F0',
                  'WeakBreakSystem.OnTransmit@0x14C05A0',
                ]),
                nativeMethodSymbolEvidence: expect.objectContaining({
                  status:
                    'native-addresses-and-signatures-found-method-bodies-not-extracted',
                  sourceKind: 'azpr-il2cpp-native-method-symbol-evidence',
                  methodCount: 27,
                  sourceFiles: expect.arrayContaining([
                    expect.objectContaining({
                      kind: 'il2cpp-script-method-addresses',
                      status: 'available-native-addresses-and-signatures',
                    }),
                    expect.objectContaining({
                      kind: 'dummy-assembly',
                      status: 'available-metadata-stubs-no-managed-bodies',
                    }),
                  ]),
                  missingEvidence: expect.arrayContaining([
                    'managed C# method bodies',
                    'full IDA/Ghidra/C++ pseudocode and call target map for target RVAs',
                    'runtime hook trace confirming call order and units',
                  ]),
                  chainMethodCounts: expect.arrayContaining([
                    { chain: 'hpDamage', methodCount: 13 },
                    { chain: 'toughnessDamage', methodCount: 11 },
                    { chain: 'selfEnergyChange', methodCount: 4 },
                  ]),
                  targetMethods: expect.arrayContaining([
                    expect.objectContaining({
                      qualifiedName:
                        'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutputDamage',
                      rva: '0x187F360',
                    }),
                    expect.objectContaining({
                      qualifiedName:
                        'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$WeaknessPointUpdate',
                      rva: '0x14C39D0',
                    }),
                    expect.objectContaining({
                      qualifiedName:
                        'Lens.Gameplay.Modules.BigWorld.SPSystem$$RecoverSP',
                      rva: '0x1483F40',
                    }),
                  ]),
                  fieldLayoutEvidence: expect.arrayContaining([
                    expect.objectContaining({
                      className: 'DamageElement',
                      fields: expect.arrayContaining([
                        'm_recoverSP',
                        'm_petRecoverSP',
                        '_outputDamageData_k__BackingField',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'WeakBreakSystem',
                      fields: expect.arrayContaining([
                        'm_weakState',
                        'm_weakElement',
                      ]),
                    }),
                  ]),
                  nativeDisassemblyEvidence: expect.objectContaining({
                    status:
                      'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
                    functionCount: 9,
                  }),
                  applied: false,
                }),
                nativeDisassemblyEvidence: expect.objectContaining({
                  status:
                    'native-disassembly-snippets-extracted-formula-semantics-unconfirmed',
                  primaryBinary: expect.objectContaining({
                    path: 'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll',
                    status: 'matched-to-current-extractor-metadata',
                    metadataLength: 39907788,
                    extractorMetadataLength: 39907788,
                  }),
                  managedDecompilerAudit: expect.objectContaining({
                    status:
                      'dummy-assembly-decompiles-to-address-attributes-and-empty-stubs',
                  }),
                  targetFunctions: expect.arrayContaining([
                    expect.objectContaining({
                      className: 'DamageElement',
                      method: 'Parse',
                      confirmed: expect.arrayContaining([
                        'recover-sp-fields-copied-during-damage-element-parse',
                        'damage-element-runtime-field-materialization-confirmed',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'SPSystem',
                      method: 'OnTransmit',
                      confirmed: expect.arrayContaining([
                        'recover-sp-transmit-type-0x12f-branch-confirmed',
                        'recover-sp-share-rebroadcast-fields-confirmed',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'DamageElement',
                      method: 'RecoverSP',
                      confirmed: expect.arrayContaining([
                        'recover-sp-field-gates-energy-recovery-path',
                        'recover-sp-source-to-base-delta-confirmed',
                        'recover-sp-base-delta-divisor-10000-confirmed',
                        'recover-sp-delta-modifier-base-1-confirmed',
                        'recover-sp-delta-modifier-properties-spgetup-spgetup-atk-confirmed',
                        'pet-recover-sp-source-to-pet-delta-confirmed',
                        'recover-interval-source-to-args-interval-confirmed',
                        'recover-interval-divisor-1000-confirmed',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'RecoverSPArgs',
                      method: 'OnReset',
                      confirmed: expect.arrayContaining([
                        'recover-sp-args-reset-fields-confirmed',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'SPSystem',
                      method: 'RecoverSP',
                      confirmed: expect.arrayContaining([
                        'delta-parameter-participates-in-resource-update-path',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'WeakBreakSystem',
                      method: 'OnTransmit',
                      confirmed: expect.arrayContaining([
                        'weak-break-system-transmit-type-branching-present',
                      ]),
                    }),
                  ]),
                }),
                parameterOverrideStatus:
                  'related-skill-level-candidate-found-execution-override-order-unconfirmed',
                trackedValueChainCount: 3,
                hpDamage: expect.objectContaining({
                  status:
                    'formula-output-entrypoints-found-application-order-unconfirmed',
                  formulaFunctionIds: [1, 2],
                  runtimeEntryPoints: expect.arrayContaining([
                    expect.objectContaining({
                      className: 'FormulaUtility',
                      methods: expect.arrayContaining([
                        'GetOutput',
                        'GetOutputDamage',
                        'Calculate',
                        'GetFunctionParams',
                      ]),
                    }),
                  ]),
                  nativeMethodSymbols: expect.arrayContaining([
                    expect.objectContaining({
                      qualifiedName:
                        'Lens.Gameplay.Modules.BigWorld.FormulaUtility$$GetOutputDamage',
                      rva: '0x187F360',
                    }),
                  ]),
                  applied: false,
                }),
                toughnessDamage: expect.objectContaining({
                  status: 'weak-break-entrypoints-found-unit-scale-unconfirmed',
                  weakBreakDamageRates: [7000],
                  runtimeEntryPoints: expect.arrayContaining([
                    expect.objectContaining({
                      className: 'WeakBreakSystem',
                      methods: expect.arrayContaining([
                        'OnTransmit',
                        'WeaknessPointUpdate',
                        'WeakBreaking',
                      ]),
                    }),
                  ]),
                  nativeMethodSymbols: expect.arrayContaining([
                    expect.objectContaining({
                      qualifiedName:
                        'Lens.Gameplay.Modules.BigWorld.WeakBreakSystem$$OnTransmit',
                      rva: '0x14C05A0',
                    }),
                  ]),
                  applied: false,
                }),
                selfEnergyChange: expect.objectContaining({
                  status:
                    'recover-sp-entrypoints-found-owner-share-unconfirmed',
                  recoverSPValues: [5899],
                  petRecoverSPValues: [22999],
                  recoverIntervals: [9999],
                  runtimeEntryPoints: expect.arrayContaining([
                    expect.objectContaining({
                      className: 'SPSystem',
                      methods: expect.arrayContaining([
                        'OnTransmit',
                        'RecoverSP',
                      ]),
                    }),
                    expect.objectContaining({
                      className: 'RecoverSPArgs',
                      fields: expect.arrayContaining([
                        'skillId',
                        'sharePercent',
                        'petDelta',
                      ]),
                    }),
                  ]),
                  nativeMethodSymbols: expect.arrayContaining([
                    expect.objectContaining({
                      qualifiedName:
                        'Lens.Gameplay.Modules.BigWorld.SPSystem$$RecoverSP',
                      rva: '0x1483F40',
                    }),
                  ]),
                  applied: false,
                }),
                unresolved: expect.arrayContaining([
                  'native-disassembly-semantics-unconfirmed',
                  'runtime-call-target-mapping-unconfirmed',
                  'runtime-parameter-override-order-unconfirmed',
                  'hp-toughness-energy-application-points-unconfirmed',
                ]),
                applied: false,
              }),
              candidates: expect.arrayContaining([
                expect.objectContaining({
                  sourceName: '攻击碰撞',
                  sourceStartFrame: 13,
                  damageElementRefCount: 1,
                  damageElementConfigIds: [109001251],
                  status: 'damage-element-field-candidate-found',
                  elementRefs: expect.arrayContaining([
                    expect.objectContaining({
                      pathId: '-5633710717881758712',
                      elementConfigId: 109001251,
                      scriptClassName: 'TDamageElementParams',
                      isDamageElement: true,
                      damageElementFieldMapping: expect.objectContaining({
                        hpDamage: expect.objectContaining({
                          formulaFunctionIds: {
                            function_1: 1,
                            function_2: 2,
                          },
                        }),
                        toughnessDamage: expect.objectContaining({
                          weakBreakDamageRate: 7000,
                        }),
                        selfEnergyChange: expect.objectContaining({
                          recoverSP: 5899,
                        }),
                        skillLevelBridge: expect.objectContaining({
                          status: 'skillsub-element-level-bridge-missing',
                          relatedElementLevelBridge: expect.objectContaining({
                            status:
                              'related-slot-skill-element-level-bridge-found',
                            source:
                              'skillsub_ele_value.json.allRowsByElementId',
                            sourceSkillId: 10900101,
                            derivedSkillId: 10900125,
                            primarySkillId: 10900125,
                            primaryRelationStatus:
                              'element-id-derived-skill-id',
                            levelRows: 12,
                            parameterIds: [1, 7],
                            varyingParameterIds: [1],
                            inheritanceStatus:
                              'related-skill-level-inheritance-unconfirmed',
                            firstLevel: expect.objectContaining({
                              level: 1,
                              valueParam: '1#4500|7#10000',
                            }),
                            lastLevel: expect.objectContaining({
                              level: 12,
                              valueParam: '1#9450|7#10000',
                            }),
                            formulaSlotAlignment: expect.objectContaining({
                              conclusion: 'slot-override-candidate-unconfirmed',
                              overrideCandidateParamIds: [1],
                              directSlotMatchParamIds: [7],
                            }),
                            candidates: expect.arrayContaining([
                              expect.objectContaining({
                                skillId: 10900125,
                                relationStatus: 'element-id-derived-skill-id',
                                derivedFromElementId: true,
                                parentSkillId: 10900121,
                                characterSlotRefs: [
                                  {
                                    characterId: 109001,
                                    characterName: '末音',
                                    group: 'ground',
                                    slot: 207,
                                  },
                                ],
                                skillLevelRowCount: 1,
                                skillLevelLevels: [1],
                                levelRows: 12,
                              }),
                            ]),
                          }),
                        }),
                      }),
                    }),
                  ]),
                  applied: false,
                }),
              ]),
              applied: false,
            }),
            elementSourceAlignment: expect.objectContaining({
              status:
                'external-damage-elements-diverge-from-action-level-elements',
              actionLevelSourceKind: 'skill_logic.currentLevel.elementValues',
              actionLevelSourceTable:
                'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/skillsub_ele_value.json',
              actionLevelSkillId: 10900101,
              actionLevelSubSkillId: 10900101,
              actionLevel: 1,
              actionLevelSkillLevelRowId: 1657,
              actionLevelElementConfigIds: [109001081, 109001306],
              actionLevelRows: [
                expect.objectContaining({
                  rowId: 973,
                  elementConfigId: 109001081,
                  valueParam: '1#1600|7#10000',
                }),
                expect.objectContaining({
                  rowId: 985,
                  elementConfigId: 109001306,
                  valueParam: '1#1600|7#10000',
                }),
              ],
              matrixElementConfigIds: [109001081, 109001306],
              externalElementSourceKind: 'skill_control.elementBaseDatas',
              externalStateNames: ['Skill0_6'],
              externalSubSkillIds: [109001011],
              externalHitEffects: ['11_109001_133', '11_109001_005'],
              externalDamageElementConfigIds: [109001251],
              overlapElementConfigIds: [],
              actionLevelOnlyElementConfigIds: [109001081, 109001306],
              externalOnlyElementConfigIds: [109001251],
              matrixMatchesActionLevel: true,
              externalSkillLevelBridgeStatuses: [
                'skillsub-element-level-bridge-missing',
              ],
              finding:
                'skill-control-subskill-damage-element-not-in-action-level-values',
              unresolved: expect.arrayContaining([
                'action-variant-element-selection-unconfirmed',
                'skill-control-subskill-to-skill-level-bridge-unconfirmed',
                'external-damage-element-level-bridge-missing',
              ]),
              applied: false,
            }),
            unresolved: expect.arrayContaining([
              'hit-damage-element-binding-unresolved',
              'external-damage-element-hit-binding-unconfirmed',
              'action-level-and-skill-control-element-source-divergence',
            ]),
            applied: false,
          }),
        ]),
        applied: false,
      }),
      diagnostics: expect.objectContaining({
        functionCombinationOrderStatus: 'unconfirmed',
        levelOverrideApplicationStatus: 'unconfirmed',
        perHitMultiplierAllocationStatus: 'unconfirmed',
        crossActionMatrixStatus: 'cross-action-matrix-summary-built',
        scaleSpreadStatus: 'varies-by-action-variant',
        hitBindingCoverageStatus: 'some-rows-missing-hit-bindings',
        hitBindingGapStatus:
          'all-missing-hit-actions-have-skill-control-candidates',
      }),
      actionSummaries: expect.arrayContaining([
        expect.objectContaining({
          actionId: 'action-segment-0',
          actionVariantLabel: '普攻',
          rawMultiplier: '649%',
          rowCount: 2,
          rowsWithHitBindings: 2,
          hitBindingCoverageStatus: 'all-rows-have-hit-bindings',
        }),
        expect.objectContaining({
          actionId: 'action-segment-1',
          actionVariantLabel: '重击',
          rawMultiplier: '190%',
          rowCount: 2,
          rowsWithHitBindings: 0,
          hitBindingCoverageStatus: 'no-rows-have-hit-bindings',
          hitBindingGap: expect.objectContaining({
            status:
              'skill-control-binding-candidate-found-hit-elements-unresolved',
            missingRowCount: 2,
            behaviorBindingCandidateCount: 5,
            sourceNames: ['攻击碰撞'],
            stateNames: ['Skill0_6'],
          }),
        }),
      ]),
      elementSummaries: expect.arrayContaining([
        expect.objectContaining({
          elementConfigId: 109001081,
          actionCount: 4,
          actionVariantLabels: ['普攻', '重击', '闪击', '跃击'],
          hitIndexes: [1],
          rowCount: 4,
          rowsWithHitBindings: 1,
          hitBindingCoverageStatus: 'some-rows-missing-hit-bindings',
          slotOverrideCandidateVariables: ['A'],
          directSlotMatchVariables: ['G'],
        }),
      ]),
      applied: false,
    });
    expect(
      result.summary.formulaExecutionMatrixSummary.requiredScaleMin
    ).toBeCloseTo(2.5, 1);
    expect(
      result.summary.formulaExecutionMatrixSummary.requiredScaleMax
    ).toBeCloseTo(40.59, 2);
    expect(
      result.summary.formulaExecutionMatrixSummary.requiredPerHitScaleMin
    ).toBeCloseTo(2.5, 1);
    expect(
      result.summary.formulaExecutionMatrixSummary.requiredPerHitScaleMax
    ).toBeCloseTo(11.88, 2);
    expect(
      result.summary.formulaCandidatePatternSummary.actionSummaries.map(
        item => [
          item.actionVariantLabel,
          item.rawMultiplier,
          item.previewRoundedValue,
        ]
      )
    ).toEqual([
      ['普攻', '649%', 307],
      ['重击', '190%', 307],
      ['闪击', '40%', 307],
      ['跃击', '136%', 307],
    ]);
    expect(
      result.summary.formulaCandidatePatternSummary.requiredScaleMin
    ).toBeCloseTo(2.5, 1);
    expect(
      result.summary.formulaCandidatePatternSummary.requiredScaleMax
    ).toBeCloseTo(40.59, 2);
    expect(
      result.summary.formulaCandidatePatternSummary.actionSummaries.find(
        item => item.actionVariantLabel === '重击'
      ).requiredScaleToRaw
    ).toBeCloseTo(11.88, 2);
    expect(
      result.summary.formulaCandidatePatternSummary.actionSummaries.find(
        item => item.actionVariantLabel === '普攻'
      ).skillControlBehaviorCorrelation.actionVariantBindingCandidate
    ).toMatchObject({
      confidence: 'medium',
      candidates: expect.arrayContaining([
        expect.objectContaining({
          sourceName: '普通-攻击碰撞',
          stateNames: ['Skill0_1'],
          bindingStatus: 'normal-action-name-state-candidate-unconfirmed',
        }),
      ]),
    });
    expect(
      result.summary.formulaCandidatePatternSummary.actionSummaries.find(
        item => item.actionVariantLabel === '重击'
      ).skillControlBehaviorCorrelation.actionVariantBindingCandidate
    ).toMatchObject({
      confidence: 'low',
      candidates: expect.arrayContaining([
        expect.objectContaining({
          sourceName: '攻击碰撞',
          stateNames: ['Skill0_6'],
          bindingStatus: 'shared-action-family-candidate-unconfirmed',
        }),
      ]),
    });
    expect(
      result.summary.formulaCandidatePatternSummary.actionSummaries.find(
        item => item.actionVariantLabel === '普攻'
      ).skillControlBehaviorCorrelation.stateTimingFindings
    ).toEqual([
      expect.objectContaining({
        stateName: 'Skill0_1',
        status: 'hp-state-has-animation-control-candidate',
      }),
    ]);
    expect(
      result.summary.formulaCandidatePatternSummary.actionSummaries.find(
        item => item.actionVariantLabel === '重击'
      ).skillControlBehaviorCorrelation.stateTimingFindings
    ).toEqual([
      expect.objectContaining({
        stateName: 'Skill0_6',
        status: 'hp-state-has-animation-control-candidate',
        animationControlCount: 1,
      }),
    ]);
  });

  it('preserves generated skill segment batch metadata through compilation', () => {
    const generationBatch = {
      batchId: 'segment-batch-test',
      source: 'skill-action-variant-split',
      skillId: 10900101,
      actorCharacterId: 109001,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-07T00:00:00.000Z',
    };
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-segment-batch',
            type: 'skill',
            skillId: 10900101,
            startMs: 1000,
            level: 1,
            damageSegmentIndex: 1,
            generationBatch,
          },
        ],
      }
    );
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(project.actions[0].generationBatch).toEqual(generationBatch);
    expect(scenario.actions[0].generationBatch).toEqual(generationBatch);
    expect(scenario.actions[0].selectedDamageSegment.label).toBe('重击');
  });

  it('keeps wait and annotation actions in the event log without projecting damage', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-skill',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
          },
          {
            id: 'action-wait',
            type: 'wait',
            startMs: 1000,
            durationMs: 1500,
            note: '等技能冷却',
          },
          {
            id: 'action-note',
            type: 'annotation',
            startMs: 3000,
            note: '准备爆发',
          },
        ],
      }
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const waitEvent = result.eventLog.find(event => event.type === 'WAIT');
    const annotationEvent = result.eventLog.find(
      event => event.type === 'ANNOTATION'
    );

    expect(result.summary.actionCount).toBe(3);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(result.damageTimeline).toHaveLength(1);
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
    expect(waitEvent).toMatchObject({
      actionId: 'action-wait',
      payload: {
        durationMs: 1500,
        note: '等技能冷却',
      },
    });
    expect(annotationEvent).toMatchObject({
      actionId: 'action-note',
      payload: {
        note: '准备爆发',
      },
    });
  });

  it('projects workbench enemy config and resource events from the simulation result', () => {
    const gameData = getWorkbenchGameData();
    const spSkill = gameData.skills.find(skill => Number(skill.spCost) > 0);
    const project = createWorkbenchProject(
      {
        characterId: spSkill.characterId,
        skillId: spSkill.id,
      },
      {
        enemyConfig: {
          level: 95,
          hpMultiplier: 2,
          defenseMultiplier: 1.5,
        },
        actions: [
          {
            id: 'action-sp',
            type: 'skill',
            skillId: spSkill.id,
            startMs: 700,
            level: 1,
          },
        ],
      }
    );
    const scenario = compileProject(project, gameData);
    const result = runSimulation(project, gameData);

    expect(scenario.enemy).toMatchObject({
      level: 95,
      hpMultiplier: 2,
      defenseMultiplier: 1.5,
    });
    expect(result.scenario).toMatchObject({
      enemyLevel: 95,
      enemyHpMultiplier: 2,
      enemyDefenseMultiplier: 1.5,
    });
    expect(
      result.damageTimeline[0].formulaBreakdown.layers.enemyDefense
    ).toMatchObject({
      applied: false,
      status: 'evidence-found-formula-unmapped',
      defenseMultiplier: 1.5,
      source: {
        kind: 'azpr-combat-formula-evidence-index',
        status: 'enemy-property-attributes-found',
      },
    });
    expect(result.summary.resourceEventCount).toBe(1);
    expect(result.summary.totalSelfEnergyDelta).toBe(-Number(spSkill.spCost));
    expect(result.summary.totalSelfEnergyDelta).toBe(
      result.runtimeOutputs.summary.selfEnergyDelta
    );
    expect(result.runtimeOutputs.resourceCurves.curvesByActor).toBe(
      result.threeValueRuntimeProjection.selfEnergyCurveByActor
    );
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      appliedDeltaCount: 2,
      enemyHpDelta: result.summary.totalRawDamage,
      enemyToughnessDelta: 0,
      selfEnergyDelta: -Number(spSkill.spCost),
      enemyStatePointCount: 1,
      selfEnergyPointCount: 1,
      simLogCount: 2,
      calculatorCount: 2,
      calculatorKeys: expect.arrayContaining([
        'azpr-hp-delta-calculator',
        'azpr-self-energy-delta-calculator',
      ]),
      calculatorReplaceableDeltaCount: 2,
      operandSourceBindingRequiredInvocationCount: 2,
      operandSourceBindingReadyInvocationCount: 2,
      operandSourceBindingInvalidInvocationCount: 0,
      operandSourceBindingCompatibleUnboundInvocationCount: 0,
      calculatorStatuses: expect.arrayContaining([
        'raw-hp-projection',
        'explicit-cost-applied-charge-formula-unmapped',
      ]),
      calculatorSummary: expect.objectContaining({
        contractName: 'ThreeValueDeltaCalculator',
        appliedToRuntimeCount: 2,
      }),
      applied: true,
    });
    const appliedHpDelta = result.threeValueGenerationLayer.deltas.find(
      delta => delta.trackKey === 'enemyHpDamage' && delta.applied
    );
    const appliedEnergyDelta = result.threeValueGenerationLayer.deltas.find(
      delta => delta.trackKey === 'selfEnergyChange' && delta.applied
    );
    expect(
      appliedHpDelta.mechanicsAdapterRequest.sourceValue.operands
    ).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsOperands',
      contractVersion: 3,
      kind: 'hp-raw-preview-product',
      expectedDelta: result.summary.totalRawDamage,
      sourceBindingRequired: true,
      sourceBindingReady: true,
      sourceBindingValidation: {
        ready: true,
        issueCodes: [],
      },
      ready: true,
    });
    expect(
      appliedEnergyDelta.mechanicsAdapterRequest.sourceValue.operands
    ).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsOperands',
      contractVersion: 3,
      kind: 'explicit-self-energy-event-sum',
      expectedDelta: -Number(spSkill.spCost),
      inputs: { eventDeltas: [-Number(spSkill.spCost)] },
      sourceBindingRequired: true,
      sourceBindingReady: true,
      sourceBindingStatus: 'applied-source-binding-valid',
      sourceBindingKind: 'explicit-self-energy-events',
      sourceBindingIdentity: expect.stringMatching(/^azpr-applied-source-v1-/u),
      sourceBinding: expect.objectContaining({
        contractName: 'AzPrThreeValueAppliedSourceBinding',
        kind: 'explicit-self-energy-events',
        ready: true,
      }),
      ready: true,
    });
    expect(appliedEnergyDelta).toMatchObject({
      appliedSourceBindingState: 'bound-ready',
      appliedSourceBindingKind: 'explicit-self-energy-events',
      appliedSourceBindingIdentity: expect.stringMatching(
        /^azpr-applied-source-v1-/u
      ),
    });
    expect(
      result.threeValueRuntimeProjection.runtimeAppliedDeltas.map(
        delta => delta.runtimeCalculatorInvocation
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          output: expect.objectContaining({ calculatedFromLayerInputs: true }),
          input: expect.objectContaining({
            sourceValue: expect.objectContaining({
              operands: expect.objectContaining({
                kind: 'hp-raw-preview-product',
              }),
            }),
          }),
          mechanicsEvaluation: expect.objectContaining({
            contractVersion: 5,
            ready: true,
            operandSourceBindingRequired: true,
            operandSourceBindingReady: true,
          }),
        }),
        expect.objectContaining({
          output: expect.objectContaining({ calculatedFromLayerInputs: true }),
          input: expect.objectContaining({
            sourceValue: expect.objectContaining({
              operands: expect.objectContaining({
                kind: 'explicit-self-energy-event-sum',
              }),
            }),
          }),
          mechanicsEvaluation: expect.objectContaining({
            contractVersion: 5,
            ready: true,
            operandSourceBindingState: 'bound-ready',
            operandSourceBindingRequired: true,
            operandSourceBindingReady: true,
          }),
        }),
      ])
    );
    expect(result.threeValueRuntimeProjection.selfEnergyCurveByActor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-101003',
          actorName: '寒悠悠',
          delta: -Number(spSkill.spCost),
          stateMetric: expect.objectContaining({
            initialValue: null,
            currentValue: null,
            delta: -Number(spSkill.spCost),
            stateLabel: '当前',
            baselineStatus: 'baseline-pending-azpr-initial-self-energy',
            baselineConfirmed: false,
          }),
          pointCount: 1,
          points: [
            expect.objectContaining({
              actionId: 'action-sp',
              trackKey: 'selfEnergyChange',
              energyDelta: -Number(spSkill.spCost),
              calculatorKey: 'azpr-self-energy-delta-calculator',
              calculationKind: 'explicit-resource-event-or-cost-preview',
              calculationStatus:
                'explicit-cost-applied-charge-formula-unmapped',
              calculationReplaceable: true,
              calculator: expect.objectContaining({
                outputField: 'energyDelta',
                delta: -Number(spSkill.spCost),
                replaceable: true,
                appliedToRuntime: true,
              }),
              applied: true,
            }),
          ],
        }),
        expect.objectContaining({
          actorId: 'actor-101007',
          actorName: '芃芃',
          delta: 0,
          stateMetric: expect.objectContaining({
            initialValue: null,
            currentValue: null,
            delta: 0,
            stateLabel: '当前',
            baselineStatus: 'baseline-pending-azpr-initial-self-energy',
          }),
          pointCount: 0,
        }),
      ])
    );
    expect(result.summary.selfEnergyDeltaByActor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-101003',
          actorName: '寒悠悠',
          delta: -Number(spSkill.spCost),
        }),
        expect.objectContaining({
          actorId: 'actor-101007',
          actorName: '芃芃',
          delta: 0,
        }),
      ])
    );
    expect(
      result.summary.selfEnergyDeltaByActor.map(actor => ({
        actorId: actor.actorId,
        delta: actor.delta,
      }))
    ).toEqual(
      result.runtimeOutputs.resourceCurves.curvesByActor.map(actor => ({
        actorId: actor.actorId,
        delta: actor.delta,
      }))
    );
    expect(result.resourceTimeline).toEqual([
      expect.objectContaining({
        timeMs: 700,
        actionId: 'action-sp',
        resource: 'sp',
        change: -Number(spSkill.spCost),
        reason: 'skill-cost',
      }),
    ]);
    expect(result.actionResultTimeline[0].selfEnergyChange).toMatchObject({
      value: -Number(spSkill.spCost),
      applied: true,
      status: 'explicit-cost-applied-charge-formula-unmapped',
      sourceEvidence: expect.objectContaining({
        status: 'candidate-fields-found',
        skillId: spSkill.id,
        logicElementIds: [101003118, 101003122],
        candidateCount: 2,
        matchedElementConfigIds: [101003118, 101003122],
        candidates: expect.arrayContaining([
          expect.objectContaining({
            elementConfigId: 101003118,
            fieldCandidate: expect.objectContaining({
              recoverSP: 0,
              petRecoverSP: 0,
              recoverInterval: 9999,
            }),
          }),
          expect.objectContaining({
            elementConfigId: 101003122,
            fieldCandidate: expect.objectContaining({
              recoverSP: 0,
              petRecoverSP: 0,
              recoverInterval: 9999,
            }),
          }),
        ]),
      }),
      formulaBreakdown: {
        appliedLayerKeys: ['explicitResourceDelta'],
        unappliedLayerKeys: [
          'actionChargeGain',
          'hitEnergyGain',
          'passiveEnergyModifiers',
        ],
        layers: {
          actionChargeGain: expect.objectContaining({
            status: 'candidate-fields-found-formula-unmapped',
            applied: false,
          }),
        },
      },
    });
    expect(result.eventLog.map(event => event.type)).toContain(
      'RESOURCE_CHANGE'
    );
  });

  it('keeps manual resource and enemy event actions as non-damage timeline events', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-skill',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
          },
          {
            id: 'action-resource',
            type: 'resource',
            startMs: 1200,
            resource: 'sp',
            change: -35,
            reason: 'manual-test',
            note: '扣除测试资源',
          },
          {
            id: 'action-enemy',
            type: 'enemyEvent',
            startMs: 1800,
            eventType: 'phase-2',
            note: '进入二阶段',
          },
        ],
      }
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const resourceEvent = result.eventLog.find(
      event =>
        event.actionId === 'action-resource' && event.type === 'RESOURCE_CHANGE'
    );
    const enemyEvent = result.eventLog.find(
      event => event.actionId === 'action-enemy' && event.type === 'ENEMY_EVENT'
    );

    expect(result.summary.actionCount).toBe(3);
    expect(result.summary.actionResultCount).toBe(3);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(result.summary.resourceEventCount).toBe(1);
    expect(result.resourceTimeline).toEqual([
      expect.objectContaining({
        actionId: 'action-resource',
        resource: 'sp',
        change: -35,
        reason: 'manual-test',
      }),
    ]);
    expect(resourceEvent).toMatchObject({
      type: 'RESOURCE_CHANGE',
      payload: {
        confidence: 'manual',
        note: '扣除测试资源',
      },
    });
    expect(
      result.actionResultTimeline.map(entry => [
        entry.actionId,
        entry.hpDamage.value,
        entry.toughnessDamage.value,
        entry.selfEnergyChange.value,
      ])
    ).toEqual([
      ['action-skill', 12461, 0, 0],
      ['action-resource', 0, 0, -35],
      ['action-enemy', 0, 0, 0],
    ]);
    expect(result.threeValueCurveFramework.stateCurves.summary).toMatchObject({
      pointCount: 22,
      appliedPointCount: 2,
      candidatePointCount: 15,
      sampledPointCount: 0,
      placeholderPointCount: 5,
      applied: false,
    });
    const hpStateTrack =
      result.threeValueCurveFramework.stateCurves.tracks.find(
        track => track.trackKey === 'enemyHpDamage'
      );
    const hpPlaceholderLayer = hpStateTrack.layers.find(
      layer => layer.key === 'placeholder'
    );
    expect(hpPlaceholderLayer).toMatchObject({
      status: 'delta-cumulative-points-built',
      pointCount: 2,
      finalCumulative: 0,
      applied: false,
    });
    expect(hpPlaceholderLayer.points.map(point => point.actionId)).toEqual([
      'action-resource',
      'action-enemy',
    ]);
    expect(enemyEvent).toMatchObject({
      type: 'ENEMY_EVENT',
      payload: {
        eventType: 'phase-2',
        note: '进入二阶段',
      },
    });
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
  });

  it('compiles a secondary actor and keeps switch actions as non-damage events', () => {
    const project = createWorkbenchProject(
      {
        secondaryCharacterId: 101003,
      },
      {
        actions: [
          {
            id: 'action-skill',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
          },
          {
            id: 'action-switch',
            type: 'switch',
            startMs: 1600,
            targetCharacterId: 101003,
            note: '切换至寒悠悠',
          },
        ],
      }
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());
    const switchEvent = result.eventLog.find(event => event.type === 'SWITCH');

    expect(project.actors.map(actor => actor.characterId)).toEqual([
      109001, 101003, 101007,
    ]);
    expect(scenario.actors).toHaveLength(3);
    expect(
      scenario.actions.find(action => action.id === 'action-switch')
    ).toMatchObject({
      actor: {
        name: '末音',
      },
      targetActor: {
        name: '寒悠悠',
      },
    });
    expect(result.summary.actionCount).toBe(2);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(switchEvent).toMatchObject({
      actionId: 'action-switch',
      payload: {
        fromActorName: '末音',
        targetActorName: '寒悠悠',
        afterActorName: '寒悠悠',
        transitionStatus: 'controlled-actor-switch-applied',
        transitionApplied: true,
        note: '切换至寒悠悠',
      },
    });
    expect(result.runtimeOutputs.controlledActorTimeline).toMatchObject({
      initialActor: { characterId: 109001, actorName: '末音' },
      finalActor: { characterId: 101003, actorName: '寒悠悠' },
      summary: {
        transitionCount: 1,
        appliedTransitionCount: 1,
        intervalCount: 2,
      },
    });
    expect(
      result.runtimeOutputs.controlledActorTimeline.intervals.map(interval => [
        interval.characterId,
        interval.startFrameIndex,
        interval.endFrameIndex,
      ])
    ).toEqual([
      [109001, 0, 96],
      [101003, 96, 7200],
    ]);
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
  });
});
