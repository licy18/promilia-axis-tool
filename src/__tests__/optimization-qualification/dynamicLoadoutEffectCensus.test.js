import { describe, expect, it } from 'vitest';
import census from '../../data/generated/dynamic-loadout-effect-mechanics.json';
import soulCatalog from '../../data/generated/soulessence-effect-mechanics.json';

describe('M12-B3-C dynamic loadout effect census', () => {
  it('compiles only evidence-closed persistent property roots and keeps conditional wrappers blocked', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );
    const persistentSoulIds = [
      10033, 10034, 10047, 10050, 10056, 10057, 10058, 10059, 10061,
      10062, 10133, 10156,
    ];

    for (const soulEssenceId of persistentSoulIds) {
      expect(definitions.get(soulEssenceId)).toMatchObject({
        runtimeStatus: 'runtime-applied',
        mechanismFamily: 'equipped-actor-persistent-property-root',
        trigger: null,
        persistentRoot: {
          status: 'runtime-applied',
          installation: {
            frame: 0,
            targetKind: 'self-actor',
            sourceSequencePath: expect.any(Array),
          },
          lifecycle: {
            durationMode: 'until-loadout-uninstall',
            leafDurationMs: -1,
          },
          unload: {
            eventId: 36,
            sourceIdentity: expect.any(String),
          },
          effects: expect.any(Array),
        },
        runtimeGaps: [],
      });
    }
    expect(definitions.get(10133).persistentRoot.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ elementId: 19004401, attributeId: 105 }),
        expect.objectContaining({ elementId: 19004403, attributeId: 23 }),
      ])
    );
    expect(definitions.get(10133).persistentRoot.effects).toHaveLength(2);

    for (const soulEssenceId of [10078, 10084, 10152, 10197]) {
      expect(definitions.get(soulEssenceId)).toMatchObject({
        runtimeStatus: 'source-indexed-runtime-unapplied',
        runtimeGaps: expect.arrayContaining([
          'effect-persistent-root-conditional-wrapper-unsupported',
        ]),
      });
    }
  });

  it('compiles six two-piece roots and the source-closed four-piece dynamic families', () => {
    const definitions = new Map(
      soulCatalog.setSkillDefinitions.map(definition => [
        `${definition.setId}:${definition.pieces}`,
        definition,
      ])
    );

    for (let setId = 1; setId <= 6; setId += 1) {
      expect(definitions.get(`${setId}:2`)).toMatchObject({
        runtimeStatus: 'runtime-applied',
        mechanismFamily: 'set-skill-persistent-property',
        thresholdActivation: {
          selectedPieceCountRequired: 2,
          appliedToRuntimeEffect: true,
        },
        persistentRoot: {
          status: 'runtime-applied',
          installation: {
            frame: 0,
            targetKind: 'self-actor',
            sourceSequencePath: expect.any(Array),
          },
          effects: [expect.objectContaining({ durationMs: -1 })],
        },
        runtimeGaps: [],
      });
    }

    expect(definitions.get('2:4')).toMatchObject({
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'set-skill-before-damage-stacking-property',
      thresholdActivation: {
        selectedPieceCountRequired: 4,
        appliedToRuntimeEffect: true,
      },
      trigger: {
        eventId: 1,
        frameAnchor: 'hit-before-damage',
        condition: { kind: 'always', status: 'applied' },
        target: { kind: 'self-actor' },
      },
      effect: {
        elementId: 199999021,
        attributeId: 7,
        bucket: 'dynamicExtra',
        durationMs: 6000,
        stackMode: 'stack',
        stackDelta: 1,
        maxStacks: 5,
      },
      runtimeGaps: [],
    });
    expect(definitions.get('4:4')).toMatchObject({
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'set-skill-before-damage-stacking-property',
      thresholdActivation: {
        selectedPieceCountRequired: 4,
        appliedToRuntimeEffect: true,
      },
      trigger: {
        eventId: 1,
        frameAnchor: 'hit-before-damage',
        condition: {
          kind: 'skill-tag',
          skillTagId: 1,
          status: 'applied',
        },
        target: { kind: 'self-actor' },
      },
      effect: {
        elementId: 199999019,
        attributeId: 1,
        bucket: 'dynamicPercent',
        durationMs: 24000,
        stackMode: 'stack',
        stackDelta: 1,
        maxStacks: 7,
      },
      runtimeGaps: [],
    });
    expect(definitions.get('5:4')).toMatchObject({
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'set-skill-after-heal-source-to-target-property',
      thresholdActivation: {
        selectedPieceCountRequired: 4,
        appliedToRuntimeEffect: true,
      },
      trigger: {
        eventId: 44,
        frameAnchor: 'heal-after-settlement',
        condition: { kind: 'always', logic: 'or', status: 'applied' },
        triggerTarget: {
          kind: 'event-source-actor-events',
          triggerTargetType: 2,
        },
        target: { kind: 'event-target-actor', effectTargetType: 1 },
      },
      effect: {
        elementId: 199999057,
        attributeId: 1,
        bucket: 'dynamicPercent',
        sourceRawA: 700,
        durationMs: 6000,
        stackMode: 'refresh',
        maxStacks: 1,
        formula: {
          commonFunctionId: 1,
          baseFunctionId: 3,
          baseExpression: 'A/10000',
        },
      },
      runtimeGaps: [],
    });
    for (const setId of [1, 3, 6]) {
      expect(definitions.get(`${setId}:4`)).toMatchObject({
        runtimeStatus: 'source-indexed-runtime-unapplied',
        thresholdActivation: { appliedToRuntimeEffect: false },
      });
    }
  });

  it('indexes the complete 62 soul and 12 set-skill denominators from source closures', () => {
    expect(census.summary).toMatchObject({
      soulEssenceCount: 62,
      setSkillCount: 12,
      runtimeAppliedCount: 48,
      runtimeUnappliedCount: 26,
    });
    expect(soulCatalog.sourceSnapshot.setSkillControlClosure).toMatchObject({
      skillCount: 12,
      fileCount: 108,
      sha256:
        '8985e7ce5fa74b703caf39430e29aa3a4db212348df6653b1529f58cf4b7c18d',
    });
    expect(soulCatalog.setSkillDefinitions).toHaveLength(12);
    expect(
      soulCatalog.setSkillDefinitions.every(
        definition =>
          definition.sourceClosure.missingPathIds.length === 0 &&
          definition.sourceClosure.reachablePathIds.length > 0 &&
          definition.mechanicsHash &&
          definition.sourceIdentity
      )
    ).toBe(true);
  });

  it('compiles source-bound BeforeDamage element predicates and consumer ordering', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );

    expect(soulCatalog.triggerContract.beforeDamageRuntime).toMatchObject({
      status: 'applied',
      contractName: 'AzPrSoulEssenceBeforeDamageRuntimeEvidence',
      beforeDamageEventId: 1,
      afterDamageEventId: 2,
      beforeDamagePrecedesSettlement: true,
      afterDamageFollowsSettlement: true,
      consumer: {
        identity:
          'Lens.Gameplay.Modules.BigWorld.AliveElementSystem.OnExecuteDamageElement',
        beforeAttack: expect.objectContaining({
          eventId: 1,
          callRva: '0x1319276',
        }),
        damageSettlement: expect.objectContaining({ callRva: '0x131935A' }),
        afterAttack: expect.objectContaining({
          eventId: 2,
          callRva: '0x13193C7',
        }),
      },
      sourceIdentity: expect.stringContaining(
        'AliveElementSystem.OnExecuteDamageElement@0x1318800'
      ),
    });

    for (const soulEssenceId of [10044, 10123, 10130, 10150]) {
      expect(definitions.get(soulEssenceId)).toMatchObject({
        runtimeStatus: 'runtime-applied',
        trigger: {
          eventId: 1,
          event: 'BeforeDamage',
          frameAnchor: 'hit-before-damage',
          triggerTarget: expect.objectContaining({
            kind: 'equipped-actor-source-events',
          }),
          target: expect.objectContaining({ kind: 'self-actor' }),
        },
        runtimeGaps: [],
      });
    }

    expect(definitions.get(10044).trigger.condition).toMatchObject({
      logic: 'or',
      conditions: [
        expect.objectContaining({
          kind: 'event-element-id',
          conditionValue: 196,
          tuningProfiles: [
            expect.objectContaining({
              profileKey: 'fire',
              damageElementId: 196,
            }),
          ],
        }),
        expect.objectContaining({
          kind: 'event-element-id',
          conditionValue: 796,
          tuningProfiles: [
            expect.objectContaining({
              profileKey: 'wind',
              damageElementId: 796,
            }),
          ],
        }),
      ],
    });
    expect(definitions.get(10123)).toMatchObject({
      effect: {
        attributeId: 21,
        propertyTags: [301],
        durationMs: 8000,
        stackMode: 'refresh',
        valuesByStar: expect.arrayContaining([
          expect.objectContaining({ star: 1, valueRaw: 1130 }),
          expect.objectContaining({ star: 4, valueRaw: 2250 }),
        ]),
      },
    });
    expect(definitions.get(10130).trigger.condition).toMatchObject({
      logic: 'and',
      conditions: [
        expect.objectContaining({
          kind: 'event-element-type',
          conditionValue: 37,
          tuningProfiles: [
            expect.objectContaining({
              profileKey: 'thunder',
              elementTypes: expect.arrayContaining([37]),
            }),
          ],
        }),
      ],
    });
    expect(definitions.get(10150)).toMatchObject({
      effect: {
        attributeId: 21,
        propertyTags: [301],
        durationMs: 8000,
        stackMode: 'stack',
        maxStacks: 5,
        valuesByStar: expect.arrayContaining([
          expect.objectContaining({ star: 1, valueRaw: 230 }),
          expect.objectContaining({ star: 4, valueRaw: 450 }),
        ]),
      },
    });

    expect(definitions.get(10018)).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
      runtimeGaps: ['effect-activation-condition-operator-unsupported'],
    });
  });

  it('compiles source-bound non-damage event transactions and event-target propagation', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );

    expect(soulCatalog.triggerContract.nonDamageRuntime).toMatchObject({
      status: 'applied',
      contractName: 'AzPrSoulEssenceNonDamageRuntimeEvidence',
      switchEnter: expect.objectContaining({
        eventId: 34,
        frameAnchor: 'switch-enter',
        sourceActorSemantic: 'entered-actor',
        minimumIntervalUnit: 'milliseconds',
      }),
      onGotShield: expect.objectContaining({
        eventId: 40,
        frameAnchor: 'shield-after-acquire',
        triggerSubjectSemantic: 'shield-recipient',
        zeroValueDispatch: false,
        inheritedStateDispatch: false,
      }),
      afterHeal: expect.objectContaining({
        eventId: 44,
        frameAnchor: 'heal-after-settlement',
        triggerSubjectSemantic: 'heal-source-actor',
        effectTargetSemantic: 'healed-actor',
        zeroEffectiveChangeDispatch: true,
      }),
      consumer: expect.objectContaining({
        switchEnter: expect.objectContaining({
          rva: '0x1596740',
        }),
        onGotShield: expect.objectContaining({
          rva: '0x13A2040',
        }),
        afterHeal: expect.objectContaining({
          rva: '0x1872130',
        }),
      }),
      sourceIdentity: expect.stringContaining('TriggerSwitchEnter@0x1596740'),
    });
    expect(
      soulCatalog.triggerContract.nonDamageRuntime.onGotShield
    ).toMatchObject({
      eventId: 40,
      frameAnchor: 'shield-after-acquire',
      refreshReplacementSemantics: 'evidence-insufficient',
    });
    expect(soulCatalog.triggerContract.nonDamageRuntime).toMatchObject({
      emptyConditionEvents: expect.arrayContaining([44]),
      sourceObserver: {
        triggerTargetType: 2,
        runtimeSourceKind: 'event-source-actor-events',
      },
      combineSemantics: {
        block: {
          combineType: 5,
          runtimeMode: 'block-while-active-same-config',
        },
      },
    });

    expect(definitions.get(10048)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'equipped-actor-switch-enter-team-property',
      trigger: {
        eventId: 34,
        event: 'SwitchEnter',
        frameAnchor: 'switch-enter',
        intervalMs: 10,
        condition: expect.objectContaining({
          kind: 'always',
          status: 'applied',
        }),
        target: expect.objectContaining({ kind: 'team-actors' }),
      },
      runtimeGaps: [],
    });
    expect(definitions.get(10169)).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
      mechanismFamily: 'equipped-actor-shield-acquire-team-property',
      trigger: {
        eventId: 40,
        event: 'OnGotShield',
        frameAnchor: 'shield-after-acquire',
        condition: expect.objectContaining({
          kind: 'always',
          status: 'applied',
        }),
        target: expect.objectContaining({ kind: 'team-actors' }),
      },
      runtimeGaps: ['effect-shield-refresh-replacement-semantics-evidence-gap'],
    });
    expect(definitions.get(10175)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      mechanismFamily: 'equipped-actor-heal-event-target-property',
      trigger: {
        eventId: 44,
        event: 'AfterHeal',
        frameAnchor: 'heal-after-settlement',
        condition: expect.objectContaining({
          kind: 'skill-slot',
          skillSlotId: 4,
        }),
        target: expect.objectContaining({
          kind: 'event-target-actor',
          effectTargetType: 1,
        }),
      },
      runtimeGaps: [],
    });
    expect(definitions.get(10176)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        eventId: 44,
        event: 'AfterHeal',
        frameAnchor: 'heal-after-settlement',
        target: expect.objectContaining({ kind: 'event-target-actor' }),
      },
      effect: {
        stackMode: 'block',
        combineType: 5,
        maxStacks: 1,
        attributeId: 5,
        bucket: 'dynamicPercent',
        durationMs: 15000,
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 1460 }),
          expect.objectContaining({ star: 2, valueRaw: 1940 }),
          expect.objectContaining({ star: 3, valueRaw: 2430 }),
          expect.objectContaining({ star: 4, valueRaw: 2910 }),
        ],
      },
      runtimeGaps: [],
    });
  });

  it('compiles the ultimate OR selectors, AllHero target and point-valued formula family', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );

    for (const soulEssenceId of [10055, 10093]) {
      expect(definitions.get(soulEssenceId)).toMatchObject({
        runtimeStatus: 'runtime-applied',
        trigger: {
          condition: {
            logic: 'or',
            logicValue: 1,
            conditions: [
              expect.objectContaining({
                kind: 'skill-slot',
                conditionType: 6,
                skillSlotId: 4,
              }),
              expect.objectContaining({
                kind: 'skill-tag',
                conditionType: 11,
                skillTagId: 4,
              }),
            ],
          },
          target: expect.objectContaining({
            kind: 'team-actors',
            effectTargetType: 15,
          }),
        },
        runtimeGaps: [],
      });
    }
    expect(definitions.get(10093)).toMatchObject({
      effect: {
        bucket: 'dynamicExtra',
        formula: {
          baseFunctionId: 3,
          baseExpression: 'A/10000',
          family: 'basis-point-property-a-with-common-ratio',
        },
      },
    });
    expect(definitions.get(10097)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        condition: {
          logic: 'and',
          conditions: [
            expect.objectContaining({
              kind: 'skill-tag',
              skillTagId: 11,
            }),
          ],
        },
        target: expect.objectContaining({
          kind: 'self-actor',
          effectTargetType: 0,
        }),
      },
      runtimeGaps: [],
    });
    expect(soulCatalog.triggerContract).toMatchObject({
      sourceKind: 'il2cpp-soulessence-trigger-contract',
      logicBindings: expect.arrayContaining([
        expect.objectContaining({
          enumName: 'OR',
          value: 1,
          runtimeLogic: 'or',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerConditionType.OR=1'
          ),
        }),
      ]),
      conditionTypeBindings: expect.arrayContaining([
        expect.objectContaining({
          enumName: 'CheckSkillSlot',
          value: 6,
          selectorKind: 'skill-slot',
        }),
        expect.objectContaining({
          enumName: 'CheckSkillType',
          value: 11,
          selectorKind: 'skill-tag',
        }),
      ]),
      targetBindings: expect.arrayContaining([
        expect.objectContaining({
          enumName: 'AllHero',
          value: 15,
          targetKind: 'team-actors',
          sourceIdentity: expect.stringContaining(
            'ETriggerEffectTargetType.AllHero=15'
          ),
        }),
      ]),
    });
    expect(census.triggerContract).toEqual(soulCatalog.triggerContract);
  });

  it('compiles EntrySkill 22 and preserves direct versus BuffElement-wrapped lifecycles', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );

    expect(soulCatalog.triggerContract.skillTagBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enumName: 'EntrySkill',
          value: 22,
          actionKinds: ['star-carry'],
          status: 'applied',
          sourceIdentity: expect.stringContaining(
            'ESkillTagType.EntrySkill=22'
          ),
        }),
      ])
    );
    expect(definitions.get(10147)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        elementId: 19001101,
        condition: {
          conditions: [
            expect.objectContaining({
              kind: 'skill-tag',
              skillTagId: 22,
              skillTagName: 'EntrySkill',
            }),
          ],
          status: 'applied',
        },
        target: expect.objectContaining({
          kind: 'self-actor',
          targetElementPathId: expect.any(Number),
        }),
      },
      effect: {
        elementId: 19001002,
        attributeId: 222,
        durationMs: 6000,
        leafDurationMs: -1,
        propertyTags: [301],
        lifecycle: {
          sourceKind: 'battle-buff-element-wrapper',
          durationMs: 6000,
          wrapper: expect.objectContaining({
            elementId: 19001001,
            durationMs: 6000,
            injectedElementIds: [19001002],
            sourceIdentity: expect.stringContaining('elementId=19001001'),
          }),
          removalPaths: expect.arrayContaining([
            expect.objectContaining({
              triggerElementId: 19001105,
              removerElementId: 19001106,
            }),
          ]),
        },
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 8930 }),
          expect.objectContaining({ star: 2, valueRaw: 11910 }),
          expect.objectContaining({ star: 3, valueRaw: 14880 }),
          expect.objectContaining({ star: 4, valueRaw: 17860 }),
        ],
      },
      runtimeGaps: [],
      sourceIdentity: expect.stringMatching(
        /elementId=19001101.*elementId=19001001.*elementId=19001002/u
      ),
    });
    expect(definitions.get(10151)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        elementId: 19001301,
        condition: {
          conditions: [
            expect.objectContaining({
              skillTagId: 22,
              skillTagName: 'EntrySkill',
            }),
          ],
        },
        target: expect.objectContaining({ kind: 'self-actor' }),
      },
      effect: {
        elementId: 19001302,
        attributeId: 222,
        durationMs: 10000,
        leafDurationMs: 10000,
        propertyTags: [],
        lifecycle: {
          sourceKind: 'property-leaf-duration',
          durationMs: 10000,
          wrapper: null,
        },
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 3720 }),
          expect.objectContaining({ star: 2, valueRaw: 4960 }),
          expect.objectContaining({ star: 3, valueRaw: 6200 }),
          expect.objectContaining({ star: 4, valueRaw: 7440 }),
        ],
      },
      runtimeGaps: [],
    });
  });

  it('compiles tuning-mark and overlimit predicates from fixed-condition source evidence', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );

    expect(soulCatalog.triggerContract.conditionTypeBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          enumName: 'CheckElementType',
          value: 8,
          selectorKind: 'event-element-type',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerFixedConditionType.CheckElementType=8'
          ),
        }),
        expect.objectContaining({
          enumName: 'HasElementId',
          value: 10,
          selectorKind: 'held-element-id',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerFixedConditionType.HasElementId=10'
          ),
        }),
        expect.objectContaining({
          enumName: 'CheckTargetElementId',
          value: 12,
          selectorKind: 'target-element-id',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerFixedConditionType.CheckTargetElementId=12'
          ),
        }),
      ])
    );

    expect(definitions.get(10124)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        event: 'BeforeSkill',
        frameAnchor: 'action-start',
        condition: {
          logic: 'and',
          actionKinds: ['ultimate'],
          conditions: [
            expect.objectContaining({ kind: 'skill-tag', skillTagId: 4 }),
            expect.objectContaining({
              kind: 'held-element-id',
              conditionValue: 250,
              tuningProfiles: [
                expect.objectContaining({
                  profileKey: 'thunder',
                  markId: 250,
                }),
              ],
            }),
          ],
        },
        target: expect.objectContaining({ kind: 'team-actors' }),
      },
      effect: expect.objectContaining({
        attributeId: 8,
        durationMs: 20000,
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 2150 }),
          expect.objectContaining({ star: 2, valueRaw: 2870 }),
          expect.objectContaining({ star: 3, valueRaw: 3590 }),
          expect.objectContaining({ star: 4, valueRaw: 4310 }),
        ],
      }),
      runtimeGaps: [],
    });

    expect(definitions.get(10131)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        event: 'AfterDamage',
        frameAnchor: 'hit-after-damage',
        condition: {
          logic: 'or',
          conditions: [
            expect.objectContaining({
              kind: 'target-element-id',
              conditionValue: 299,
              tuningProfiles: [
                expect.objectContaining({
                  profileKey: 'thunder',
                  overlimitPacketElementId: 299,
                }),
              ],
            }),
            expect.objectContaining({
              kind: 'target-element-id',
              conditionValue: 499,
              tuningProfiles: [
                expect.objectContaining({
                  profileKey: 'dark',
                  overlimitPacketElementId: 499,
                }),
              ],
            }),
          ],
        },
      },
      effect: expect.objectContaining({
        attributeId: 222,
        durationMs: 3000,
        valuesByStar: expect.arrayContaining([
          expect.objectContaining({ star: 1, valueRaw: 4460 }),
          expect.objectContaining({ star: 4, valueRaw: 8930 }),
        ]),
      }),
      runtimeGaps: [],
    });

    expect(definitions.get(10136)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        event: 'AfterDamage',
        frameAnchor: 'hit-after-damage',
        condition: {
          logic: 'and',
          actionKinds: ['normal-attack'],
          conditions: [
            expect.objectContaining({
              kind: 'event-element-type',
              conditionValue: 43,
              tuningProfiles: expect.arrayContaining([
                expect.objectContaining({
                  profileKey: 'wind',
                  damageElementId: 796,
                  elementTypes: [22, 32, 43, 307],
                }),
              ]),
            }),
            expect.objectContaining({ kind: 'skill-tag', skillTagId: 1 }),
            expect.objectContaining({
              kind: 'event-element-type',
              conditionValue: 32,
              tuningProfiles: [
                expect.objectContaining({
                  profileKey: 'wind',
                  damageElementId: 796,
                  elementTypes: [22, 32, 43, 307],
                }),
              ],
            }),
          ],
        },
      },
      effect: expect.objectContaining({
        attributeId: 222,
        durationMs: 8000,
        valuesByStar: expect.arrayContaining([
          expect.objectContaining({ star: 1, valueRaw: 3720 }),
          expect.objectContaining({ star: 4, valueRaw: 7440 }),
        ]),
      }),
      runtimeGaps: [],
    });
  });

  it('compiles get-element phases and event element predicates from source evidence', () => {
    const definitions = new Map(
      soulCatalog.definitions.map(definition => [
        definition.soulEssenceId,
        definition,
      ])
    );

    expect(soulCatalog.triggerContract).toMatchObject({
      eventBindings: expect.arrayContaining([
        expect.objectContaining({
          value: 9,
          enumName: 'BeforeGetElement',
          frameAnchor: 'element-before-acquire',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerEventType.BeforeGetElement=9'
          ),
        }),
        expect.objectContaining({
          value: 10,
          enumName: 'AfterGetElement',
          frameAnchor: 'element-after-acquire',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerEventType.AfterGetElement=10'
          ),
        }),
      ]),
      conditionTypeBindings: expect.arrayContaining([
        expect.objectContaining({
          value: 13,
          enumName: 'CheckElementId',
          selectorKind: 'event-element-id',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerFixedConditionType.CheckElementId=13'
          ),
        }),
      ]),
      triggerTargetBindings: expect.arrayContaining([
        expect.objectContaining({
          value: 0,
          enumName: 'Self',
          sourceKind: 'equipped-actor-source-events',
          sourceIdentity: expect.stringContaining(
            'EElementTriggerTargetType.Self=0'
          ),
        }),
      ]),
      getElementRuntime: expect.objectContaining({
        status: 'applied',
        beforeMutationEventId: 9,
        afterMutationEventId: 10,
        zeroDeltaRefreshDispatch: 'applied-acquisition-event',
        initialStateDispatch: false,
        elementTypeCondition: expect.objectContaining({
          status: 'applied',
          selector:
            'current-event-element-params-types-contains-condition-value',
          conditionTypeIndex: 8,
          conditionTypeTargetRva: '0x13B6ED6',
        }),
      }),
    });

    expect(definitions.get(10052)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        eventId: 10,
        frameAnchor: 'element-after-acquire',
        triggerTarget: expect.objectContaining({
          kind: 'equipped-actor-source-events',
        }),
        condition: {
          logic: 'and',
          conditions: [
            expect.objectContaining({
              kind: 'event-element-type',
              conditionType: 8,
              conditionValue: 41,
              tuningProfiles: expect.arrayContaining([
                expect.objectContaining({
                  profileKey: 'wind',
                  markId: 750,
                  elementTypes: [32, 41, 1001],
                  elementTypeSourceKind: 'mark-container',
                }),
                expect.objectContaining({
                  profileKey: 'fire',
                  markId: 150,
                  elementTypes: [31, 41, 1001],
                  elementTypeSourceKind: 'mark-container',
                }),
              ]),
            }),
          ],
        },
        target: expect.objectContaining({ kind: 'self-actor' }),
      },
      effect: expect.objectContaining({
        attributeId: 23,
        bucket: 'dynamicExtra',
        durationMs: 10_000,
        stackMode: 'refresh',
        maxStacks: 1,
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 1070 }),
          expect.objectContaining({ star: 2, valueRaw: 1340 }),
          expect.objectContaining({ star: 3, valueRaw: 1600 }),
          expect.objectContaining({ star: 4, valueRaw: 1870 }),
        ],
      }),
      runtimeGaps: [],
    });

    expect(definitions.get(10170)).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
    });
    expect(definitions.get(10170).runtimeGaps.length).toBeGreaterThan(0);

    expect(definitions.get(10043)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        eventId: 9,
        event: 'BeforeGetElement',
        frameAnchor: 'element-before-acquire',
        triggerTarget: expect.objectContaining({
          kind: 'equipped-actor-source-events',
          triggerTargetType: 0,
        }),
        condition: {
          logic: 'and',
          conditions: [
            expect.objectContaining({
              kind: 'event-element-id',
              conditionType: 13,
              conditionValue: 750,
              tuningProfiles: [
                expect.objectContaining({
                  profileKey: 'wind',
                  markId: 750,
                }),
              ],
            }),
          ],
        },
        target: expect.objectContaining({ kind: 'team-actors' }),
      },
      effect: expect.objectContaining({
        attributeId: 229,
        bucket: 'dynamicExtra',
        durationMs: 16000,
        stackMode: 'stack',
        maxStacks: 5,
        formula: expect.objectContaining({
          baseFunctionId: 3,
          baseExpression: 'A/10000',
        }),
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 75000 }),
          expect.objectContaining({ star: 2, valueRaw: 100000 }),
          expect.objectContaining({ star: 3, valueRaw: 125000 }),
          expect.objectContaining({ star: 4, valueRaw: 150000 }),
        ],
      }),
      runtimeGaps: [],
    });

    expect(definitions.get(10149)).toMatchObject({
      runtimeStatus: 'runtime-applied',
      trigger: {
        eventId: 10,
        event: 'AfterGetElement',
        frameAnchor: 'element-after-acquire',
        triggerTarget: expect.objectContaining({
          kind: 'equipped-actor-source-events',
          triggerTargetType: 0,
        }),
        condition: {
          logic: 'and',
          conditions: [
            expect.objectContaining({
              kind: 'event-element-id',
              conditionType: 13,
              conditionValue: 150,
              tuningProfiles: [
                expect.objectContaining({
                  profileKey: 'fire',
                  markId: 150,
                }),
              ],
            }),
          ],
        },
        target: expect.objectContaining({ kind: 'team-actors' }),
      },
      effect: expect.objectContaining({
        attributeId: 229,
        bucket: 'dynamicExtra',
        durationMs: 24000,
        stackMode: 'refresh',
        maxStacks: 1,
        formula: expect.objectContaining({
          baseFunctionId: 5,
          baseExpression: 'A',
        }),
        valuesByStar: [
          expect.objectContaining({ star: 1, valueRaw: 45 }),
          expect.objectContaining({ star: 2, valueRaw: 60 }),
          expect.objectContaining({ star: 3, valueRaw: 75 }),
          expect.objectContaining({ star: 4, valueRaw: 90 }),
        ],
      }),
      runtimeGaps: [],
    });
  });

  it('keeps threshold activation distinct from set-effect runtime qualification', () => {
    const twoPiece = soulCatalog.setSkillDefinitions.filter(
      definition => definition.pieces === 2
    );
    const fourPiece = soulCatalog.setSkillDefinitions.filter(
      definition => definition.pieces === 4
    );
    expect(
      twoPiece.every(
        definition =>
          definition.thresholdActivation.status === 'runtime-applied' &&
          definition.thresholdActivation.appliedToRuntimeEffect === true &&
          definition.runtimeStatus === 'runtime-applied' &&
          definition.runtimeGaps.length === 0
      )
    ).toBe(true);
    expect(
      fourPiece
        .filter(definition => [2, 4, 5].includes(definition.setId))
        .every(
          definition =>
            definition.thresholdActivation.status === 'runtime-applied' &&
            definition.thresholdActivation.appliedToRuntimeEffect === true &&
            definition.runtimeStatus === 'runtime-applied' &&
            definition.runtimeGaps.length === 0
        )
    ).toBe(true);
    expect(
      fourPiece
        .filter(definition => ![2, 4, 5].includes(definition.setId))
        .every(
          definition =>
            definition.thresholdActivation.status === 'source-indexed' &&
            definition.thresholdActivation.appliedToRuntimeEffect === false &&
            definition.runtimeStatus === 'source-indexed-runtime-unapplied' &&
            definition.runtimeGaps.includes(
              'set-skill-runtime-operator-not-implemented'
            )
        )
    ).toBe(true);
    expect(soulCatalog.summary).toMatchObject({
      setSkillThresholdIndexedCount: 12,
      setSkillRuntimeAppliedCount: 9,
    });
  });

  it('records auditable trigger, target, lifecycle and persistence dimensions', () => {
    for (const record of census.records) {
      expect(record).toEqual(
        expect.objectContaining({
          objectKind: expect.stringMatching(/^(soul-essence|set-skill)$/),
          objectId: expect.any(String),
          effectSkillId: expect.any(Number),
          mechanismFamily: expect.any(String),
          sourceTarget: expect.any(Object),
          resourceTransactions: expect.any(Array),
          vitalChanges: expect.any(Array),
          delayedEvents: expect.any(Array),
          loopPersistence: expect.any(Object),
          evidenceStatus: expect.any(String),
          runtimeStatus: expect.any(String),
          runtimeGaps: expect.any(Array),
          sourceIdentity: expect.any(String),
        })
      );
    }
    expect(
      census.records.find(
        record =>
          record.objectKind === 'soul-essence' && record.objectId === '10098'
      )
    ).toMatchObject({
      mechanismFamily: 'equipped-actor-skill-tag-property-after-damage',
      evidenceStatus: 'runtime-applied',
      runtimeStatus: 'runtime-applied',
    });
    expect(
      census.records.find(
        record =>
          record.objectKind === 'soul-essence' && record.objectId === '10018'
      )
    ).toMatchObject({
      evidenceStatus: 'source-indexed-runtime-unapplied',
      runtimeGaps: expect.arrayContaining([
        'effect-activation-condition-operator-unsupported',
      ]),
    });
    expect(
      census.records.find(
        record => record.objectKind === 'set-skill' && record.objectId === '1:4'
      )
    ).toMatchObject({
      resourceTransactions: [
        expect.objectContaining({ elementId: 199999026, valueRaw: 16 }),
      ],
      vitalChanges: [
        expect.objectContaining({
          elementId: 199999085,
          damageType: 5,
        }),
      ],
      runtimeStatus: 'source-indexed-runtime-unapplied',
    });
  });

  it('preserves source property tags and the verified skill-tag binding contract', () => {
    expect(soulCatalog.propertyTagContract).toMatchObject({
      sourceKind: 'il2cpp-battle-property-tag-contract',
      matchSemantics: {
        emptyModifierTags: 'unscoped',
        singleModifierTag: 'exact-membership',
        multipleModifierTags: 'evidence-open-runtime-blocked',
      },
      bindings: [
        expect.objectContaining({
          skillTagId: 1,
          skillTagName: 'NormalAttack',
          actionKind: 'normal-attack',
          propertyTag: 300,
          propertyTagName: 'NormalAttack',
          status: 'applied',
        }),
        expect.objectContaining({
          skillTagId: 2,
          skillTagName: 'WhackAttack',
          actionKind: 'charged-attack',
          propertyTag: 301,
          propertyTagName: 'Skill1',
          status: 'applied',
        }),
      ],
    });
    expect(census.propertyTagContract).toEqual(soulCatalog.propertyTagContract);

    const expectedTagsBySoulEssenceId = new Map([
      [10001, []],
      [10002, []],
      [10037, []],
      [10055, []],
      [10060, [300]],
      [10093, []],
      [10094, [301]],
      [10097, []],
      [10098, [301]],
      [10147, [301]],
      [10151, []],
      [10124, []],
      [10131, []],
      [10136, []],
      [10043, []],
      [10044, []],
      [10048, []],
      [10052, []],
      [10149, []],
      [10123, [301]],
      [10130, [301]],
      [10150, [301]],
      [10125, []],
      [10154, []],
      [10155, []],
      [10175, []],
      [10176, []],
    ]);
    const appliedDefinitions = soulCatalog.definitions.filter(
      definition =>
        definition.runtimeStatus === 'runtime-applied' &&
        definition.effect != null
    );

    expect(
      appliedDefinitions.map(definition => definition.soulEssenceId).sort()
    ).toEqual([...expectedTagsBySoulEssenceId.keys()].sort());
    for (const definition of appliedDefinitions) {
      const soulEssenceId = definition.soulEssenceId;
      const expectedTags = expectedTagsBySoulEssenceId.get(soulEssenceId);
      const censusRecord = census.records.find(
        row =>
          row.objectKind === 'soul-essence' &&
          row.objectId === String(soulEssenceId)
      );

      expect(definition).toMatchObject({
        runtimeStatus: 'runtime-applied',
        effect: {
          propertyTags: expectedTags,
          propertyTagMatchMode:
            expectedTags.length === 0 ? 'unscoped' : 'single-exact',
          propertyTagSourceIdentity: expect.stringContaining(
            `elementId=${definition.effect.elementId}`
          ),
        },
        runtimeGaps: [],
      });
      expect(censusRecord).toMatchObject({
        effectPropertyTags: expectedTags,
        effectPropertyTagMatchMode:
          expectedTags.length === 0 ? 'unscoped' : 'single-exact',
        effectPropertyTagSourceIdentity:
          definition.effect.propertyTagSourceIdentity,
      });
    }

    expect(
      soulCatalog.definitions
        .filter(
          definition =>
            definition.runtimeStatus === 'runtime-applied' &&
            definition.effect != null
        )
        .every(definition => Array.isArray(definition.effect.propertyTags))
    ).toBe(true);
  });
});
