import { describe, expect, it } from 'vitest';
import census from '../../data/generated/dynamic-loadout-effect-mechanics.json';
import soulCatalog from '../../data/generated/soulessence-effect-mechanics.json';

describe('M12-B3-C dynamic loadout effect census', () => {
  it('indexes the complete 62 soul and 12 set-skill denominators from source closures', () => {
    expect(census.summary).toMatchObject({
      soulEssenceCount: 62,
      setSkillCount: 12,
      runtimeAppliedCount: 23,
      runtimeUnappliedCount: 51,
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
      }),
    });

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
    expect(
      soulCatalog.setSkillDefinitions.every(
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
      setSkillRuntimeAppliedCount: 0,
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
      [10149, []],
      [10123, [301]],
      [10130, [301]],
      [10150, [301]],
      [10125, []],
      [10154, []],
      [10155, []],
    ]);
    const appliedDefinitions = soulCatalog.definitions.filter(
      definition => definition.runtimeStatus === 'runtime-applied'
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
        .filter(definition => definition.runtimeStatus === 'runtime-applied')
        .every(definition => Array.isArray(definition.effect.propertyTags))
    ).toBe(true);
  });
});
