import { describe, expect, it } from 'vitest';
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
          externalElementBaseRefCount: 13,
          resourceMapMatchedElementBaseRefCount: 13,
          sampledHpBehaviorChainCount: 5,
          sampledHpLaneCandidateCount: 5,
          sampledResolvedHpBehaviorCount: 5,
          hitFrameStartFrames: [12, 13, 16, 19],
          stateTimingEvidenceStatus:
            'state-timing-evidence-found-action-binding-unconfirmed',
          stateTimingEvidence: expect.objectContaining({
            status: 'state-timing-evidence-found-action-binding-unconfirmed',
            hpStateWindowCount: 5,
            timingControlChainCount: 5,
            animationStateControlCount: 2,
            eventBridgeControlCount: 5,
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
            'runtime-application-entrypoints-found-method-bodies-missing',
          ],
          runtimeApplicationTraceChainCount: 9,
          gapsWithRuntimeApplicationTraceEvidence: 3,
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
                'runtime-application-entrypoints-found-method-bodies-missing',
              ],
              runtimeApplicationTraceChainCount: 3,
              runtimeApplicationTraceEvidence: expect.objectContaining({
                status:
                  'runtime-application-entrypoints-found-method-bodies-missing',
                methodBodyStatus: 'il2cpp-dump-signatures-only',
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
                  applied: false,
                }),
                unresolved: expect.arrayContaining([
                  'il2cpp-method-body-missing',
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
      sourceEvidence: {
        status: 'no-damage-element-field-mapping-for-skill',
        skillId: spSkill.id,
        logicElementIds: [101003118, 101003122],
        candidateCount: 0,
        matchedElementConfigIds: [],
        candidates: [],
      },
      formulaBreakdown: {
        appliedLayerKeys: ['explicitResourceDelta'],
        unappliedLayerKeys: [
          'actionChargeGain',
          'hitEnergyGain',
          'passiveEnergyModifiers',
        ],
        layers: {
          actionChargeGain: expect.objectContaining({
            status: 'formula-unmapped',
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
      109001, 101003,
    ]);
    expect(scenario.actors).toHaveLength(2);
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
        note: '切换至寒悠悠',
      },
    });
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
  });
});
