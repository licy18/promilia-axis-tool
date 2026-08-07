import { describe, expect, it } from 'vitest';
import generatedPassiveCatalog from '../../../src/data/generated/kibo-passive-mechanics.json';
import generatedCensus from '../../../reports/kibo-headless/kibo-mechanics-census.json';
import generatedMaturityMatrix from '../../../reports/kibo-headless/kibo-maturity-matrix.json';
import {
  classifyTriggerCounterLifetime,
  createKiboHeadlessCensus,
} from '../../../scripts/generate-kibo-headless-census.mjs';

describe('kibo headless census', () => {
  it('classifies trigger counters without passive identity special cases', () => {
    expect(classifyTriggerCounterLifetime(-1)).toMatchObject({
      configuredTriggerCounter: -1,
      triggerLifetime: 'unlimited',
      maxTriggerCount: null,
    });
    expect(classifyTriggerCounterLifetime(9_999_999)).toMatchObject({
      configuredTriggerCounter: 9_999_999,
      triggerLifetime: 'unlimited',
      maxTriggerCount: null,
      triggerLifetimeBasis:
        'current-client-practical-unlimited-sentinel-9999999',
    });
    expect(classifyTriggerCounterLifetime(1)).toMatchObject({
      configuredTriggerCounter: 1,
      triggerLifetime: 'finite',
      maxTriggerCount: 1,
    });
    expect(classifyTriggerCounterLifetime(0)).toMatchObject({
      configuredTriggerCounter: 0,
      triggerLifetime: 'evidence-open',
      maxTriggerCount: null,
    });
  });

  it('locks every Workbench kibo, public action, fixed skill and explicit gap', async () => {
    const outputs = await createKiboHeadlessCensus();

    expect(outputs.census.denominators).toEqual({
      kiboCount: 122,
      publicActionCount: 366,
      fixedSkillUniqueCount: 172,
      pvePassiveOccurrenceCount: 133,
      pvePassiveUniqueCount: 44,
      pvpPassiveOccurrenceCount: 122,
      pvpPassiveUniqueCount: 122,
    });
    expect(outputs.census.summary).toMatchObject({
      fixedSkillClassification: {
        evidenceClosed: 172,
        scenarioAssumed: 0,
        unresolved: 0,
      },
      pvePassiveMechanics: {
        evidenceClosed: 44,
        scenarioAssumed: 0,
        unresolved: 0,
      },
      pvpPassiveClassification: {
        evidenceClosed: 122,
        scenarioAssumed: 0,
        unresolved: 0,
      },
      publicActionClosure: {
        evidenceClosed: 366,
        scenarioAssumed: 0,
        unresolved: 0,
      },
    });
    expect(outputs.mechanicsCatalog.summary.triggerLifetime).toEqual({
      unlimited: 18,
      finite: 1,
      'evidence-open': 0,
    });
    expect(
      outputs.census.fixedSkills
        .filter(row => row.closureClass === 'unresolved')
        .every(row => row.unresolvedReasons.length > 0)
    ).toBe(true);
    expect(
      outputs.census.fixedSkills.filter(
        row => row.closureClass === 'unresolved'
      )
    ).toHaveLength(0);
    expect(
      outputs.census.fixedSkills
        .filter(row => row.slots.some(slot => [505, 506, 602, 603, 50206].includes(slot)))
        .every(row => row.scopeClass === 'non-combat-capability')
    ).toBe(true);
    expect(
      outputs.census.pvePassiveSkills
        .filter(row => row.closureClass === 'unresolved')
        .every(row => row.unresolvedReasons.length > 0)
    ).toBe(true);
    expect(
      outputs.census.publicActions
        .filter(row => row.closureClass === 'unresolved')
        .every(
          row =>
            row.reasons.length > 0 ||
            row.runtimeStatus !== 'runnable' ||
            row.scenarioRuntimeStatus !== 'source-verified'
        )
    ).toBe(true);
    expect(outputs.maturityMatrix.rows).toHaveLength(122);
    expect(
      outputs.maturityMatrix.rows.every(
        row => row.actions.signature && row.actions.active && row.actions.break
      )
    ).toBe(true);
    expect(outputs.maturityMatrix.summary.machineOptimizationReadyCount).toBe(
      122
    );
    expect(
      outputs.maturityMatrix.rows.filter(row => row.remainingGaps.length === 0)
    ).toHaveLength(122);

    expect(outputs.census).toEqual(generatedCensus);
    expect(outputs.mechanicsCatalog).toEqual(generatedPassiveCatalog);
    expect(outputs.maturityMatrix).toEqual(generatedMaturityMatrix);
  }, 30_000);

  it('keeps fixed skills separate from actual PVE and PVP property skills', () => {
    expect(
      generatedCensus.fixedSkills.find(row => row.skillId === 50000103)
    ).toMatchObject({
      scopeClass: 'pve-combat-action-support',
      closureClass: 'evidence-closed',
      slots: [205],
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520084)
    ).toMatchObject({
      scopeClass: 'pve-combat-talent-passive',
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      kiboIds: [500001],
      mechanic: {
        mechanismFamily: 'on-kibo-damage-enemy-property-effect',
        trigger: {
          event: 'damage-dealt',
          internalCooldownMs: 0,
          activationOrder: 'after-triggering-hit',
        },
        effect: {
          target: 'enemy',
          durationMs: null,
          stackMode: 'stack',
          maxStacks: 5,
          modifiers: [
            {
              kind: 'battle-property',
              attributeId: 3,
              bucket: 'dynamicPercent',
              valueRaw: -500,
              sourceElementId: 520084003,
              sourcePathId: '3042572917603638817',
            },
            {
              kind: 'battle-property',
              attributeId: 4,
              bucket: 'dynamicPercent',
              valueRaw: -500,
              sourceElementId: 520084004,
              sourcePathId: '-4244650508239806949',
            },
          ],
        },
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520014)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      kiboIds: [500025, 500057, 500231],
      mechanic: {
        mechanismFamily: 'equipped-kibo-self-property-effect',
        trigger: {
          event: 'scenario-start',
          target: 'equipped-kibo',
        },
        effect: {
          target: 'equipped-kibo',
          durationMs: null,
          modifiers: [
            expect.objectContaining({
              attributeId: 3,
              bucket: 'dynamicPercent',
              valueRaw: 6000,
            }),
            expect.objectContaining({
              attributeId: 4,
              bucket: 'dynamicPercent',
              valueRaw: 6000,
            }),
          ],
        },
        ownership: {
          source: 'equipped-kibo',
          effectTarget: 'equipped-kibo',
          directInjectTargetType: 0,
          directInjectTargetName: 'Self',
        },
        scenarioAssumptions: [],
        evidenceStatus: 'source-verified',
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.filter(
        row =>
          row.mechanic?.mechanismFamily === 'equipped-kibo-self-property-effect'
      )
    ).toHaveLength(17);
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520080)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      kiboIds: [500042, 500082, 500467, 500468],
      mechanic: {
        mechanismFamily: 'equipped-kibo-self-property-effect',
        effects: [
          {
            sourceElementId: 520080001,
            durationMs: 10000,
            modifiers: [
              expect.objectContaining({
                attributeId: 1,
                bucket: 'dynamicPercent',
                valueRaw: 6000,
              }),
            ],
          },
          {
            sourceElementId: 520080002,
            durationMs: 10000,
            modifiers: [
              expect.objectContaining({
                attributeId: 22,
                bucket: 'dynamicExtra',
                valueRaw: -2000,
              }),
            ],
          },
        ],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520055)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      kiboIds: [500220],
      mechanic: {
        mechanismFamily: 'equipped-kibo-owner-property-effect',
        trigger: {
          event: 'scenario-start',
          target: 'pet-owner',
        },
        effect: {
          target: 'pet-owner',
          modifiers: [
            expect.objectContaining({
              attributeId: 105,
              bucket: 'dynamicExtra',
              valueRaw: 3000,
            }),
          ],
        },
        targets: [
          {
            target: 'pet-owner',
            runtimeTargetKind: 'actor',
            directInjectTargetType: 7,
            directInjectTargetName: 'PetOwner',
          },
        ],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520062)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      mechanic: {
        mechanismFamily: 'equipped-kibo-and-owner-property-effect',
        effect: {
          targets: ['equipped-kibo', 'pet-owner'],
          modifiers: [
            expect.objectContaining({
              attributeId: 55,
              bucket: 'dynamicExtra',
              valueRaw: 1200,
            }),
          ],
        },
        targets: [
          expect.objectContaining({
            runtimeTargetKind: 'kibo',
            directInjectTargetType: 0,
          }),
          expect.objectContaining({
            runtimeTargetKind: 'actor',
            directInjectTargetType: 7,
          }),
        ],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520002)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      sourceDescription: '奇波和搭档角色移动速度增加10%。',
      mechanic: {
        mechanismFamily: 'equipped-kibo-and-owner-property-effect',
        effect: {
          targets: ['equipped-kibo', 'pet-owner'],
          durationMs: null,
          modifiers: [
            expect.objectContaining({
              attributeId: 45,
              bucket: 'dynamicExtra',
              valueRaw: 1000,
              sourceElementId: 520002005,
            }),
          ],
        },
        targets: [
          expect.objectContaining({
            runtimeTargetKind: 'kibo',
            directInjectTargetType: 0,
          }),
          expect.objectContaining({
            runtimeTargetKind: 'actor',
            directInjectTargetType: 7,
          }),
        ],
        sourceGraph: {
          controlRootElementIds: [520002005],
          reachableElementIds: [520002005],
          reachableElementDescriptions: ['移动速度增加15%'],
          unreachableAssetElements: [
            520002000, 520002001, 520002002, 520002003, 520002004,
          ].map(sourceElementId =>
            expect.objectContaining({
              sourceElementId,
              reason: 'not-referenced-by-control-resource-map',
            })
          ),
        },
        sourceTextDifferences: [
          {
            field: 'effect.modifiers.valueRaw',
            sourceTextClaim: '奇波和搭档角色移动速度增加10%。',
            runtimeAssetTextClaims: ['移动速度增加15%'],
            runtimeNumericEvidence: [
              {
                attributeId: 45,
                bucket: 'dynamicExtra',
                valueRaw: 1000,
                sourceElementId: 520002005,
              },
            ],
            selectedRuntimeContract: 'numeric-element-config',
            resolution:
              'numeric-runtime-config-authoritative-text-difference-retained',
          },
        ],
      },
    });
    expect(
      generatedPassiveCatalog.definitions.find(row => row.skillId === 520026)
    ).toMatchObject({
      mechanismFamily: 'equipped-kibo-self-property-effect',
      effect: {
        sourceElementId: 520026004,
        modifiers: [
          expect.objectContaining({
            attributeId: 225,
            bucket: 'dynamicExtra',
            valueRaw: 1600,
            sourceElementId: 520026005,
          }),
        ],
      },
      sourceGraph: {
        reachableElementIds: [520026004, 520026005],
        unreachableAssetElements: expect.arrayContaining([
          expect.objectContaining({ sourceElementId: 520026001 }),
          expect.objectContaining({ sourceElementId: 520026002 }),
          expect.objectContaining({ sourceElementId: 520026003 }),
          expect.objectContaining({ sourceElementId: 520026006 }),
        ]),
      },
      sourceTextDifferences: [
        expect.objectContaining({
          sourceTextClaim: '增加16%闪避率。',
          selectedRuntimeContract: 'numeric-element-config',
        }),
      ],
    });
    expect(
      generatedPassiveCatalog.definitions.find(row => row.skillId === 520067)
    ).toMatchObject({
      mechanismFamily: 'equipped-kibo-self-property-effect',
      effects: [
        expect.objectContaining({ sourceElementId: 520067000 }),
        expect.objectContaining({ sourceElementId: 520067004 }),
        expect.objectContaining({ sourceElementId: 520067005 }),
      ],
      sourceGraph: {
        reachableElementIds: [
          520067000, 520067002, 520067003, 520067004, 520067005,
        ],
        unreachableAssetElements: [
          expect.objectContaining({
            sourceElementId: 520067001,
            reason: 'not-referenced-by-control-resource-map',
          }),
        ],
      },
    });
    expect(
      generatedPassiveCatalog.definitions.find(row => row.skillId === 520086)
    ).toMatchObject({
      mechanismFamily: 'equipped-kibo-self-property-effect',
      effect: {
        sourceElementId: 520086000,
        modifiers: [
          expect.objectContaining({
            attributeId: 7,
            bucket: 'dynamicExtra',
            valueRaw: 2000,
          }),
          expect.objectContaining({
            attributeId: 60,
            bucket: 'dynamicExtra',
            valueRaw: 2000,
          }),
        ],
      },
      sourceGraph: {
        reachableElementIds: [520086000, 520086002, 520086003],
        unreachableAssetElements: [
          expect.objectContaining({
            sourceElementId: 520086001,
            reason: 'not-referenced-by-control-resource-map',
          }),
        ],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520054)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      mechanic: {
        mechanismFamily: 'equipped-kibo-player-team-property-effect',
        targetProjection: {
          container: 'player',
          directInjectTargetType: 15,
          directInjectTargetName: 'Player',
          teamElementTag: 1000,
          teamElementTagName: 'PlayerAllEntity',
          scope: 'local-player-all-entities',
          runtimeTargetKinds: ['actor', 'kibo'],
        },
        effect: {
          sourceElementId: 520054001,
          durationMs: null,
          stackMode: 'replace',
          maxStacks: 1,
          refreshRule: 'same-effect-replacement-at-scenario-start',
          modifiers: [
            expect.objectContaining({
              attributeId: 45,
              bucket: 'dynamicExtra',
              valueRaw: 500,
            }),
          ],
        },
        sourceGraph: {
          reachableElementIds: [520054001],
          unreachableAssetElements: [
            expect.objectContaining({
              sourceElementId: 520054002,
              reason: 'not-referenced-by-control-resource-map',
            }),
          ],
        },
      },
    });
    expect(
      generatedCensus.pvePassiveSkills
        .find(row => row.skillId === 520054)
        ?.provenance.some(value =>
          value.includes('ElementProperty.HasTargetElementType')
        )
    ).toBe(false);
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520070)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      mechanic: {
        mechanismFamily: 'equipped-kibo-player-team-property-effect',
        targetProjection: {
          container: 'player',
          teamElementTag: 1000,
          filter: {
            kind: 'entity-elemental-type-mask',
            operator: 'bitwise-overlap-nonzero',
            conditionType: 1,
            checkType: 0,
            targetType: 1,
            evaluationEntity: 'team-copy-execute-entity',
            elementalTypeMask: 128,
            elementalTypeName: 'Thunder',
            ignoredConfigFields: {
              subConditionType_Element: 0,
              maxChangeCount: 5,
              reason:
                'condition-type-1-native-branch-does-not-read-sub-condition-or-max-change-count',
            },
          },
        },
        effect: {
          sourceElementId: 520070002,
          durationMs: null,
          stackMode: 'replace',
          maxStacks: 1,
          refreshRule: 'same-effect-replacement-at-scenario-start',
          modifiers: [
            expect.objectContaining({
              attributeId: 58,
              bucket: 'dynamicExtra',
              valueRaw: 1300,
            }),
          ],
        },
        sourceGraph: {
          reachableElementIds: [520070002],
          unreachableAssetElements: [
            expect.objectContaining({
              sourceElementId: 520070001,
              reason: 'not-referenced-by-control-resource-map',
            }),
          ],
        },
      },
      unresolvedReasons: [],
      provenance: expect.arrayContaining([
        expect.stringContaining('AliveElementSystem.AfterTeamElement'),
        expect.stringContaining('ElementProperty.HasTargetElementType'),
      ]),
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520066)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'equipped-kibo-player-team-periodic-heal',
        trigger: {
          event: 'time-loop',
          intervalMs: 5000,
          firstTriggerPolicy: 'first-positive-delta-update',
          laterTriggerThreshold: 'strict-elapsed-greater-than-ordinal-interval',
          conditionFailureConsumesPeriod: true,
        },
        rootEffect: {
          sourceElementId: 520066001,
          stackMode: 'replace',
          maxStacks: 1,
          combineTypeName: 'Cover',
          refreshRule:
            'same-root-cover-preserves-first-root-attacker-source-and-trigger-phase',
        },
        heal: {
          sourceElementId: 520066002,
          formula: {
            baseFunctionId: 104,
            coefficientRaw: 210,
            maxHpEvaluationEntity: 'inject-to-own-gameplay-kibo-root-attacker',
            configuredPostFunctionId: 201,
            configuredPostRuntimeStatus:
              'configured-but-unread-by-damage-element-parse-and-get-output-heal',
          },
          healModifierAttributes: {
            sourceAttributeId: 23,
            sourceEvaluationEntity: 'inject-to-own-gameplay-kibo-root-attacker',
            targetAttributeId: 24,
            targetEvaluationEntity: 'team-copy-executor-holder',
          },
        },
        ownership: {
          rootAttacker: 'inject-to-own-gameplay-kibo-entity',
          rootSource: 'inject-to-own-gameplay-kibo-entity',
          rootAttackerRuntimeEntityStatus:
            'native-inject-to-own-start-and-team-copy-verified',
          rootOwnershipPropagation:
            'after-team-element-copy-preserves-attacker-source-and-rebinds-executor-only',
          multiSourceAttribution:
            'first-native-cover-survivor-source-order-unresolved',
        },
        scenarioAssumptions: [],
        evidenceStatus: 'source-verified',
        sourceTextDifferences: [
          expect.objectContaining({
            field: 'heal.formula.coefficientRaw',
            selectedRuntimeContract: 'numeric-element-config',
          }),
        ],
      },
      provenance: expect.arrayContaining([
        expect.stringContaining('InjectToOwnElementBehavior.Start'),
        expect.stringContaining('DamageElement.BeforeExecute'),
      ]),
    });
    expect(
      generatedCensus.pvpPassiveSkills.find(row => row.skillId === 51020001)
    ).toMatchObject({
      scopeClass: 'pvp-kibo-versus',
      closureClass: 'evidence-closed',
      runtimeStatus: 'out-of-pve-runtime-scope',
      kiboIds: [500001],
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520008)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'on-kibo-damage-enemy-property-effect',
        trigger: {
          event: 'damage-dealt',
          internalCooldownMs: 15000,
          condition: {
            kind: 'target-entity-type',
            logic: 'or',
            fixedConditionType: 2,
            fixedConditionName: 'TargetEntityType',
            targetEntityTypes: [14, 24],
            targetEntityTypeNames: ['Monster', 'KiBo'],
          },
        },
        effect: {
          target: 'enemy',
          durationMs: 8000,
          stackMode: 'refresh',
          modifiers: [
            expect.objectContaining({
              attributeId: 45,
              bucket: 'dynamicExtra',
              valueRaw: -2000,
            }),
          ],
        },
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520040)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      mechanic: {
        trigger: {
          internalCooldownMs: 500,
          condition: {
            targetEntityTypes: [14, 24],
          },
        },
        effect: {
          stackMode: 'stack',
          maxStacks: 6,
        },
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520083)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      unresolvedReasons: [],
      mechanic: {
        trigger: {
          event: 'damage-dealt',
          internalCooldownMs: 0,
          configuredTriggerCounter: 1,
          triggerLifetime: 'finite',
          maxTriggerCount: 1,
          triggerLimitScope: 'passive-element-lifetime',
          condition: {
            kind: 'skill-tag',
            logic: 'and',
            fixedConditionType: 11,
            fixedConditionName: 'CheckSkillType',
            requiredSkillTags: [14],
            requiredSkillTagNames: ['PetUltraSkill'],
          },
        },
        effect: {
          durationMs: 40000,
          stackMode: 'refresh',
          maxStacks: 1,
          modifiers: [
            expect.objectContaining({
              attributeId: 45,
              bucket: 'dynamicExtra',
              valueRaw: -1000,
            }),
            expect.objectContaining({
              attributeId: 3,
              bucket: 'dynamicPercent',
              valueRaw: -600,
            }),
            expect.objectContaining({
              attributeId: 4,
              bucket: 'dynamicPercent',
              valueRaw: -600,
            }),
          ],
        },
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520087)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'before-kibo-skill-property-effect',
        trigger: {
          event: 'skill-before',
          activationOrder: 'before-action',
          configuredTriggerCounter: 9999999,
          triggerLifetime: 'unlimited',
          maxTriggerCount: null,
          condition: {
            kind: 'skill-tag',
            logic: 'or',
            requiredSkillTags: [14],
            requiredSkillTagNames: ['PetUltraSkill'],
          },
        },
        effect: {
          targets: ['equipped-kibo', 'pet-owner'],
          durationMs: 30000,
          stackMode: 'stack',
          maxStacks: 6,
          modifiers: [
            expect.objectContaining({
              attributeId: 1,
              bucket: 'dynamicPercent',
              valueRaw: 200,
            }),
          ],
        },
        targets: [
          expect.objectContaining({
            runtimeTargetKind: 'kibo',
            triggerEffectTargetType: 0,
            triggerEffectTargetName: 'Self',
          }),
          expect.objectContaining({
            runtimeTargetKind: 'actor',
            triggerEffectTargetType: 8,
            triggerEffectTargetName: 'PetOwner',
          }),
        ],
        sourceTextDifferences: [
          expect.objectContaining({
            field: 'trigger.activationOrder',
            runtimeEvidence: 'EElementTriggerEventType.BeforeSkill=5',
            selectedRuntimeContract: 'before-action',
          }),
        ],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520051)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'on-kibo-damage-enemy-property-effect',
        trigger: {
          event: 'damage-dealt',
          activationOrder: 'after-triggering-hit',
          internalCooldownMs: 0,
        },
        effects: [
          {
            sourceElementId: 520051002,
            durationMs: null,
            expiration: 'battle-exit',
            stackMode: 'stack',
            maxStacks: 5,
            modifiers: [
              expect.objectContaining({
                attributeId: 3,
                bucket: 'dynamicPercent',
                valueRaw: -160,
              }),
              expect.objectContaining({
                attributeId: 4,
                bucket: 'dynamicPercent',
                valueRaw: -160,
              }),
            ],
          },
          {
            sourceElementId: 520051005,
            durationMs: null,
            expiration: 'battle-exit',
            stackMode: 'stack',
            maxStacks: 5,
            modifiers: [
              expect.objectContaining({
                attributeId: 66,
                bucket: 'dynamicExtra',
                valueRaw: -60,
              }),
            ],
          },
        ],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520082)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      unresolvedReasons: [],
      kiboIds: [500261, 500262, 500263],
      mechanic: {
        mechanismFamily:
          'equipped-kibo-self-and-on-damage-enemy-property-effect',
        scenarioStartTrigger: {
          event: 'scenario-start',
          target: 'equipped-kibo',
          sourceElementId: 520082000,
        },
        scenarioStartEffects: [
          {
            target: 'equipped-kibo',
            durationMs: null,
            sourceElementId: 520082003,
            modifiers: [
              expect.objectContaining({
                attributeId: 67,
                bucket: 'dynamicExtra',
                valueRaw: 800,
              }),
            ],
          },
        ],
        trigger: {
          event: 'damage-dealt',
          activationOrder: 'after-triggering-hit',
          configuredTriggerCounter: 9999999,
          triggerLifetime: 'unlimited',
          maxTriggerCount: null,
          condition: {
            kind: 'target-entity-type',
            logic: 'or',
            targetEntityTypes: [14, 24],
          },
        },
        effects: [
          {
            target: 'enemy',
            durationMs: 20000,
            stackMode: 'refresh',
            maxStacks: 1,
            sourceElementId: 520082004,
            modifiers: [
              expect.objectContaining({
                attributeId: 67,
                bucket: 'dynamicExtra',
                valueRaw: -1000,
              }),
            ],
          },
        ],
        sourceGraph: {
          controlRootElementId: 520082000,
          reachableElementIds: [520082000, 520082003, 520082001, 520082004],
          unreachableAssetElements: [
            expect.objectContaining({
              sourceElementId: 520082002,
              reason: 'not-referenced-by-control-resource-map',
            }),
          ],
        },
        scenarioAssumptions: [],
        evidenceStatus: 'source-verified',
      },
    });
    expect(
      generatedPassiveCatalog.definitions.find(row => row.skillId === 520090)
    ).toMatchObject({
      kiboIds: [500469, 500470],
      mechanismFamily: 'on-kibo-damage-self-property-effect',
      trigger: {
        event: 'damage-dealt',
        target: 'equipped-kibo',
        internalCooldownMs: 0,
        activationOrder: 'after-triggering-hit',
        activationDelayMs: 0.001,
        sourceElementId: 520090001,
        condition: {
          kind: 'target-entity-type',
          logic: 'or',
          targetEntityTypes: [6, 14, 24, 26, 27],
          targetEntityTypeNames: [
            'Item',
            'Monster',
            'KiBo',
            'DefenseTower',
            'BaseTower',
          ],
        },
      },
      effect: {
        target: 'equipped-kibo',
        runtimeTargetKind: 'kibo',
        triggerEffectTargetType: 0,
        triggerEffectTargetName: 'Self',
        durationMs: 20000,
        expiration: 'duration',
        stackMode: 'stack',
        stackDelta: 1,
        maxStacks: 10,
        refreshRule: 'stack-and-refresh-duration',
        sourceElementId: 520090002,
        modifiers: [
          expect.objectContaining({
            attributeId: 1,
            bucket: 'dynamicPercent',
            valueRaw: 400,
          }),
        ],
      },
      sourceGraph: {
        controlRootElementId: 520090001,
        reachableElementIds: [520090001, 520090002],
        unreachableAssetElements: [
          expect.objectContaining({
            sourceElementId: 520090003,
            reason: 'not-referenced-by-control-resource-map',
          }),
          expect.objectContaining({
            sourceElementId: 520090004,
            reason: 'not-referenced-by-control-resource-map',
          }),
          expect.objectContaining({
            sourceElementId: 520090005,
            reason: 'not-referenced-by-control-resource-map',
          }),
          expect.objectContaining({
            sourceElementId: 520090006,
            reason: 'not-referenced-by-control-resource-map',
          }),
        ],
      },
      ownership: {
        source: 'equipped-kibo',
        triggeredEffectTarget: 'equipped-kibo',
        effectAdder: 'equipped-kibo',
      },
      scenarioAssumptions: [],
      evidenceStatus: 'source-verified',
    });
    expect(
      generatedPassiveCatalog.definitions.find(row => row.skillId === 520041)
    ).toMatchObject({
      kiboIds: [500058],
      mechanismFamily: 'on-kibo-damage-derived-damage',
      trigger: {
        event: 'damage-dealt',
        internalCooldownMs: 2000,
        activationOrder: 'after-triggering-hit',
        activationDelayMs: 0.001,
        sourceElementId: 520041001,
        configuredTriggerCounter: -1,
        sustainElementId: 500109099,
        sustainElementRuntimeStatus:
          'config-field-not-read-by-trigger-element-parse',
        condition: {
          kind: 'target-entity-type',
          logic: 'or',
          targetEntityTypes: [14, 24],
          targetEntityTypeNames: ['Monster', 'KiBo'],
        },
      },
      derivedDamage: {
        target: 'enemy',
        source: 'equipped-kibo',
        sourceAttribute: {
          entityRole: 'element-source-equipped-kibo',
          attributeId: 1,
          attributeName: 'ATK',
        },
        sourceElementId: 520041002,
        formula: {
          commonFunctionId: 1,
          commonExpression: 'G/10000',
          baseFunctionId: 4,
          baseExpression: 'source.ATK[0]*A/10000',
          coefficientRaw: 3000,
          ratiosByLevel: expect.objectContaining({ 1: 3000, 12: 3000 }),
        },
        damage: {
          damageSourceType: 0,
          damageSourceTypeName: 'Attacker',
          damageType: 1,
          damageTypeName: 'MeleePhysical',
          elementalType: 1,
          elementalTypeName: 'Fire',
          weakBreakDamageRateBasisPoints: 2000,
          physicalPenetrationBasisPoints: -1,
          magicPenetrationBasisPoints: 10000,
          elementCalculationFactorBasisPoints: 10000,
          physicalRatioBasisPoints: 10000,
          magicRatioBasisPoints: 0,
          recoverSp: 0,
          petRecoverSp: 0,
        },
        eventPolicy: {
          ignoreDamageEvent: true,
          emitsDamageTriggerEvents: false,
          recursivePassiveTrigger: false,
        },
        criticalPolicy: 'scenario-policy-with-derived-hit-override',
      },
      ownership: {
        source: 'equipped-kibo',
        formulaSource: 'equipped-kibo',
        effectAdder: 'equipped-kibo',
        target: 'hit-enemy',
      },
      scenarioAssumptions: [],
      evidenceStatus: 'source-verified',
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520018)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'after-kibo-receive-damage-self-property-effect',
        trigger: {
          event: 'damage-received',
          eventType: 4,
          eventName: 'AfterReceiveDamage',
          target: 'damaged-kibo',
        },
        effect: {
          target: 'damaged-kibo',
          durationMs: 8000,
          sourceElementId: 520018002,
          modifiers: [
            {
              kind: 'battle-property',
              attributeId: 66,
              bucket: 'dynamicExtra',
              valueRaw: -500,
            },
          ],
        },
        runtimeGaps: [],
      },
    });
    expect(
      generatedPassiveCatalog.unresolved.some(
        row => row.skillId === 520018
      )
    ).toBe(false);
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520013)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      mechanic: {
        mechanismFamily: 'after-kibo-receive-damage-self-property-effect',
        trigger: {
          event: 'damage-received',
          eventName: 'AfterReceiveDamage',
          target: 'equipped-kibo',
        },
        effect: {
          target: 'equipped-kibo',
          durationMs: 5000,
          sourceElementId: 520013002,
          modifiers: [
            {
              kind: 'battle-property',
              attributeId: 1,
              bucket: 'dynamicPercent',
              valueRaw: 3000,
            },
          ],
        },
        runtimeGaps: [],
      },
    });
    expect(
      generatedCensus.pvePassiveSkills.find(row => row.skillId === 520015)
    ).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      mechanic: {
        mechanismFamily: 'equipped-kibo-self-property-effect',
        trigger: {
          event: 'scenario-start',
        },
      },
    });
  });

  it('parses PetOwner water or light damage into a five-stack SPGETUP effect without reviving the orphan heal', async () => {
    const liveOutputs = await createKiboHeadlessCensus();
    const current = liveOutputs.census.pvePassiveSkills.find(
      row => row.skillId === 520019
    );

    expect(current).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      confidence: 'high',
      kiboIds: [500023, 500024],
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'on-pet-owner-damage-source-property-effect',
        controlInjection: {
          target: 'pet-owner',
          directInjectTargetType: 7,
          directInjectTargetName: 'PetOwner',
          activationFrame: 0,
          frameCount: 1,
          removeElementOnEnd: false,
          rootElementId: 520019001,
        },
        trigger: {
          event: 'damage-dealt',
          eventType: 2,
          eventName: 'AfterDamage',
          sourceScope: 'pet-owner',
          target: 'damage-event-source',
          triggerEffectTargetType: 2,
          triggerEffectTargetName: 'Source',
          internalCooldownMs: 0,
          configuredTriggerCounter: -1,
          triggerLifetime: 'unlimited',
          maxTriggerCount: null,
          condition: {
            kind: 'damage-type-and-elemental-type',
            logic: 'or',
            fixedConditionType: 4,
            fixedConditionName: 'CheckDamageType',
            damageTypes: [9],
            damageTypeNames: ['All'],
            elementalTypes: [6, 8],
            elementalTypeNames: ['Aqua', 'Lumiere'],
            clauses: [
              {
                damageType: 9,
                damageTypeName: 'All',
                elementalType: 6,
                elementalTypeName: 'Aqua',
              },
              {
                damageType: 9,
                damageTypeName: 'All',
                elementalType: 8,
                elementalTypeName: 'Lumiere',
              },
            ],
          },
        },
        effect: {
          target: 'pet-owner',
          runtimeTargetKind: 'actor',
          durationMs: null,
          expiration: 'target-exit-battlefield-or-battle-exit',
          stackMode: 'stack',
          stackDelta: 1,
          maxStacks: 5,
          refreshRule: 'stack-until-clear',
          combineType: 4,
          combineNumber: 5,
          exitBattleClear: true,
          clearType: 80,
          clearTypeFlags: ['executorExitBattleFieldClear', 'ExitBattleClear'],
          sourceElementId: 520019003,
          modifiers: [
            expect.objectContaining({
              attributeId: 105,
              attributeName: 'SPGETUP',
              bucket: 'dynamicExtra',
              valueRaw: 400,
              sourceElementId: 520019003,
            }),
          ],
        },
        sourceGraph: {
          reachableElementIds: [520019001, 520019003],
          controlResourceCoverage: 'exact',
          unreachableAssetElements: [
            expect.objectContaining({
              sourceElementId: 520019002,
              description: '恢复100%生命',
              reason: 'not-referenced-by-control-resource-map',
            }),
          ],
        },
        ownership: {
          source: 'equipped-kibo',
          controlInjectionTarget: 'pet-owner',
          triggerElementOwner: 'pet-owner',
          triggerEventSource: 'pet-owner-damage-source',
          triggeredEffectTarget: 'pet-owner-damage-source',
        },
        scenarioAssumptions: [],
        evidenceStatus: 'source-verified',
      },
      provenance: expect.arrayContaining([
        expect.stringContaining('EDirectInjectTargetType.PetOwner=7'),
        expect.stringContaining('ETriggerEffectTargetType.Source=2'),
        expect.stringContaining('EBattlePropertyType.SPGETUP=105'),
      ]),
    });
    expect(current).not.toHaveProperty('unresolvedEvidence');
    const publishedDefinition = liveOutputs.mechanicsCatalog.definitions.find(
      row => row.skillId === 520019
    );
    expect(publishedDefinition).toMatchObject({
      mechanismFamily: 'on-pet-owner-damage-source-property-effect',
    });
    expect(publishedDefinition).not.toHaveProperty('runtimeGaps');
    expect(
      liveOutputs.mechanicsCatalog.unresolved.some(
        row => row.skillId === 520019
      )
    ).toBe(false);
  });

  it('parses BeforeSkill composite graphs without treating unreachable wrappers or cooldown gaps as defaults', async () => {
    const liveOutputs = await createKiboHeadlessCensus();
    const recoil = liveOutputs.census.pvePassiveSkills.find(
      row => row.skillId === 520044
    );
    expect(recoil).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'equipped-kibo-before-skill-composite-effect',
        controlInjection: {
          directInjectTargetType: 0,
          rootElementIds: [520044002, 520044003],
        },
        conditionalPropertyEffects: [
          {
            target: 'equipped-kibo',
            condition: {
              kind: 'battle-property-default-skill-tag',
              checkType: 1,
              checkTypeName: 'Away',
              evaluation: 'continuous-condition-check',
              requiredSkillTags: [14],
              conditions: [
                expect.objectContaining({
                  conditionType: 5,
                  conditionTypeName: 'CurSkillTag',
                  targetType: 0,
                  skillTag: 14,
                  maxChangeCount: 5,
                  maxChangeCountSemantics: 'opaque-not-used-as-trigger-limit',
                }),
              ],
            },
            modifiers: [
              expect.objectContaining({
                attributeId: 21,
                attributeName: 'SHOOT_DMGUP',
                bucket: 'dynamicExtra',
                valueRaw: 7000,
              }),
            ],
          },
        ],
        beforeSkillTriggers: [
          {
            trigger: {
              event: 'skill-before',
              activationOrder: 'after-resource-and-cooldown-before-skill-start',
              condition: {
                logic: 'and',
                requiredSkillTags: [14],
              },
            },
            effectTargets: [
              expect.objectContaining({
                target: 'equipped-kibo',
                triggerEffectTargetType: 11,
                triggerEffectTargetName: 'ElementOwner',
              }),
            ],
            vitalChanges: [
              expect.objectContaining({
                kind: 'damage',
                target: 'equipped-kibo',
                formula: expect.objectContaining({
                  baseFunctionId: 103,
                  baseExpression: '(self.CURRENT_HEALTH*A)/10000',
                  coefficientRaw: 2000,
                }),
                damage: expect.objectContaining({
                  damageType: 6,
                  damageTypeName: 'Real',
                  physicalRatioBasisPoints: 0,
                  magicRatioBasisPoints: 0,
                }),
                eventPolicy: {
                  ignoreDamageEvent: true,
                  emitsDamageTriggerEvents: false,
                  recursivePassiveTrigger: false,
                  attackerSideBeforeAfterAttackEvents: 'suppressed',
                  receiveSideFlagPolicy:
                    'not-suppressed-by-ignore-damage-event',
                  receiveSideEvents:
                    'dispatch-depends-on-main-control-status-unresolved',
                },
                integerization: {
                  mode: 'q16-round-to-nearest-ties-to-even',
                  expression:
                    'roundToEven(max(1,current-health*coefficient/10000))',
                },
                auxiliaryFormula: {
                  function3: 201,
                  runtimeRead: false,
                  policy: 'ignored-by-damage-element-real-output-path',
                },
                shieldPolicy: 'bypass',
                restraintPolicy: 'bypass',
              }),
            ],
          },
        ],
        sourceGraph: {
          reachableElementIds: [520044002, 520044003, 520044004],
          unreachableAssetElements: [
            expect.objectContaining({
              sourceElementId: 520044001,
              reason: 'not-referenced-by-control-resource-map',
            }),
          ],
        },
        nativeEvidenceContract: {
          formula103: {
            blockedFormulaIds: [
              103, 104, 106, 107, 108, 109, 40011001, 40011002,
            ],
            formulaIdIsBlocked: true,
          },
          elementOwnerTarget: {
            triggerEffectTargetType: 11,
            sourceEntityRole: 'element-attacker-source-equipped-kibo',
            targetEntityRole: 'trigger-data-self-element-owner-equipped-kibo',
          },
          skillCastOrder: [
            'resource-cost-committed',
            'cooldown-cast-committed',
            'current-skill-slot-written',
            'before-skill-trigger',
            'current-skill-id-written',
            'skill-start-event',
            'skill-player-start',
          ],
          lethalBoundary: {
            canReduceEquippedKiboToZero: true,
            synchronousSkillPlayerStartContinues: true,
            futureHitAfterDeathUpdateStatus:
              'unresolved-runtime-diagnostic-required',
          },
        },
        sourceTextDifferences: [
          expect.objectContaining({
            field: 'trigger.activationOrder',
            sourceTextClaim: '释放特技后',
            runtimeEvidence: 'EElementTriggerEventType.BeforeSkill=5',
            selectedRuntimeContract:
              'after-resource-and-cooldown-before-skill-start',
          }),
        ],
        scenarioAssumptions: [],
        evidenceStatus: 'source-verified',
      },
    });
    expect(
      liveOutputs.mechanicsCatalog.definitions.find(
        row => row.skillId === 520044
      )
    ).toMatchObject({
      mechanismFamily: 'equipped-kibo-before-skill-composite-effect',
    });

    const current = liveOutputs.census.pvePassiveSkills.find(
      row => row.skillId === 520046
    );
    expect(current).toMatchObject({
      closureClass: 'evidence-closed',
      runtimeStatus: 'runtime-ready',
      unresolvedReasons: [],
      mechanic: {
        mechanismFamily: 'equipped-kibo-before-skill-composite-effect',
        compositeWrapper: {
          sourceElementId: 520046001,
          expiration: 'battle-exit',
          combineType: 3,
          combineNumber: 1,
          exitBattleClear: true,
        },
        staticPropertyEffects: [
          {
            sourceElementId: 520046002,
            parentElementId: 520046001,
            expiration: 'parent-element-lifetime',
            modifiers: [
              expect.objectContaining({
                attributeId: 57,
                attributeName: 'WATER_SHOOTDMGUP',
                bucket: 'dynamicExtra',
                valueRaw: 2000,
              }),
            ],
          },
        ],
        beforeSkillTriggers: [
          {
            trigger: {
              event: 'skill-before',
              acceptanceGate: 'accepted-skill-start',
              activationOrder:
                'after-accepted-skill-resolution-and-optional-cooldown-cast-before-skill-start',
              currentActionCooldownStackSnapshot: 'pre-trigger',
              condition: {
                logic: 'or',
                requiredSkillTags: [14, 15],
              },
            },
            cooldownPropertyEffects: [
              {
                sourceElementId: 520046004,
                stackMode: 'stack',
                maxStacks: 4,
                modifiers: [
                  expect.objectContaining({
                    attributeId: 115,
                    attributeName: 'CD_SKILL',
                    bucket: 'dynamicPercent',
                    valueRaw: -500,
                  }),
                ],
              },
            ],
          },
        ],
        nativeEvidenceContract: {
          cooldownAttribute: {
            attributeId: 115,
            attributeName: 'CD_SKILL',
            calculateType: 2,
            calculateTypeName: 'Percentage',
            configuredBucket: 'dynamicPercent',
            elementFormulaId: 3,
            elementFormulaExpression: 'A/10000',
            valueRawPerStack: -500,
            percentBasisPointsPerStack: -500,
            maxStacks: 4,
          },
          stacking: {
            combineType: 4,
            combineNumber: 4,
            stackDeltaPerAcceptedSkillStart: 1,
            expiration: 'battle-exit',
          },
          cooldownFormula: {
            expression:
              'max(baseCooldown*(1+(allSkillCdPercent+slotCdPercent)/10000),baseCooldown*skillMinCdPer/10000)',
            percentDenominator: 10000,
            clampFunction: 'Mathf.Max',
          },
          minimumCooldown: {
            configKey: 'SKILL_MIN_CD_PER',
            configuredValuesRaw: '2500|2500|2500',
            petMinimumBasisPoints: 2500,
            kiboMinimumBasisPoints: 2500,
            minimumMultiplier: 0.25,
            fourStackMultiplierBasisPoints: 8000,
            fourStackHitsMinimumClamp: false,
          },
          debugOverride: {
            field: 'Macro.DEBUG_AllSkillCDMultiValue',
            defaultValue: 0,
            activeOnlyWhenPositive: true,
            normalPveFormulaContribution: 0,
          },
          acceptedSkillStart: {
            contract: 'accepted-skill-start',
            transmitType: 11,
            transmitTypeName: 'SkillStart',
            rejectedUnknownSkillTriggersBeforeSkill: false,
            rejectedResourceOrActionRuleRequestAddsStack: false,
            triggerEventType: 5,
          },
          currentVsSubsequentCooldownOrder: {
            currentAcceptedActionUses: 'pre-trigger-stack-count',
            newStackAppliesTo: 'subsequent-accepted-action-cooldown',
            acceptedActionCurrentMultipliersBasisPoints: [
              10000, 9500, 9000, 8500, 8000,
            ],
            acceptedActionPostTriggerStacks: [1, 2, 3, 4, 4],
          },
          publicKiboEntrypoints: {
            petUltra: {
              skillTag: 14,
              setCdDefault: true,
              entersAcceptedSkillStart: true,
            },
            petJointStrike: {
              skillTag: 15,
              kiboSkillSlot: 601,
              setCdDefault: true,
              entersAcceptedSkillStart: true,
            },
          },
          genericSetCdFalseCaveat: {
            setCd: false,
            cooldownCastExecuted: false,
            beforeSkillStillTriggers: true,
            acceptedSkillStartStillRequired: true,
          },
          rvas: {
            coolDownGet: '0x12D0670',
            coolDownGetMinimum: '0x12D0A80',
            alivePropertyChangeProperty: '0x12A6A00',
            changePropertyElementCombine: '0x137A120',
            aliveSkillSystemOnTransmit: '0x13EAA20',
            castPetUltimateActionCastSkill: '0x13C3B80',
            skillUtilityCastJointStrikeSkill: '0x18B1EB0',
            jointStrikeSkillCastSkillActionOnEnter: '0x19B6990',
            macroStaticConstructor: '0x1225B10',
            skillUtilityGetMinimumCooldownPercent: '0x18B5350',
            skillPlayerGetMinimumCooldownPercent: '0x13E91A0',
          },
        },
        scenarioAssumptions: [],
        evidenceStatus: 'source-verified',
      },
      provenance: expect.arrayContaining([
        expect.stringContaining('CoolDown.get_coolDown@RVA0x12D0670'),
        expect.stringContaining(
          'AliveSkillSystem.ITransmit.OnTransmit@RVA0x13EAA20'
        ),
        expect.stringContaining('SKILL_MIN_CD_PER=2500|2500|2500'),
        expect.stringContaining('SkillUtility.GetMicCdPer@RVA0x18B5350'),
      ]),
    });
    expect(current.mechanic).not.toHaveProperty('runtimeGaps');
    expect(current).not.toHaveProperty('unresolvedEvidence');
    expect(
      liveOutputs.mechanicsCatalog.definitions.find(
        row => row.skillId === 520046
      )
    ).toMatchObject({
      mechanismFamily: 'equipped-kibo-before-skill-composite-effect',
      scenarioAssumptions: [],
      evidenceStatus: 'source-verified',
    });
    expect(
      liveOutputs.mechanicsCatalog.unresolved.some(
        row => row.skillId === 520046
      )
    ).toBe(false);
  }, 15_000);
});
