import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import {
  compileVerifiedStaticActorProperties,
  validatePersistentLoadoutPropertyRoot,
} from '../../simulation/mechanics/verifiedCombatStaticProperties';
import { frameToMs } from '../../domain/timebase';

const neutralKiboConfig = {
  level: 80,
  hobbyId: 1,
  intimacyLevel: 5,
  comprehensionByAttribute: {
    1: 100,
    3: 100,
    4: 100,
    5: 100,
  },
};
const PERSISTENT_SET_CASES = [
  {
    setId: 1,
    equipment: { weapon: 1210421, top: 1220221 },
    sourceId: '1:2:199999034',
    attribute: { id: 1001, value: 620 },
  },
  {
    setId: 2,
    equipment: { weapon: 1210321, top: 1220231 },
    sourceId: '2:2:199999030',
    attribute: { id: 8, value: 1780 },
  },
  {
    setId: 3,
    equipment: { weapon: 1210121, top: 1220121 },
    sourceId: '3:2:199999032',
    attribute: { id: 1005, value: 620 },
  },
  {
    setId: 4,
    equipment: { weapon: 1210221, top: 1220131 },
    sourceId: '4:2:199999028',
    attribute: { id: 1001, value: 620 },
  },
  {
    setId: 5,
    equipment: { weapon: 1210521, top: 1220311 },
    sourceId: '5:2:199999060',
    attribute: { id: 23, value: 1500 },
  },
  {
    setId: 6,
    equipment: { weapon: 1210611, top: 1220321 },
    sourceId: '6:2:199999067',
    attribute: { id: 222, value: 2000 },
  },
];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified static combat properties', () => {
  it('compiles the verified actor level template without old panel fallback', () => {
    const result = compileVerifiedStaticActorProperties({
      actor: {
        characterId: 101007,
        level: 80,
        cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
        loadout: {},
      },
    });

    expect(result).toMatchObject({
      status: 'verified-static-actor-properties-ready',
      characterId: 101007,
      level: 80,
      complete: true,
      ready: true,
      stats: {
        attack: 1005,
      },
      resourceProfile: {
        effectiveMaxSp: 100,
        sprSecBasisPoints: 2084,
        sprSecBackBasisPoints: 1042,
      },
    });
    expect(result.core.ATK).toMatchObject({
      externalBase: 1005,
      externalPercentRaw: 0,
      externalExtra: 0,
      effectiveValue: 1005,
      displayValue: 1005,
    });
    expect(result.stats.attack).not.toBe(10078);
  });

  it('rebuilds actor and inherited kibo values from the selected loadout', () => {
    const baseActor = {
      characterId: 101007,
      level: 80,
      cultivation: { starGiftRank: 2, favorabilityLevel: 5 },
      loadout: {
        kiboId: 500001,
        kiboConfig: neutralKiboConfig,
      },
    };
    const before = compileVerifiedStaticActorProperties({ actor: baseActor });
    const after = compileVerifiedStaticActorProperties({
      actor: {
        ...baseActor,
        loadout: {
          ...baseActor.loadout,
          soulessenceId: 10001,
          equipment: {
            weapon: 1010111,
            top: 1020111,
            bottom: 1030111,
            earring: 1040111,
            ring: 1050111,
          },
        },
      },
    });
    const repeated = compileVerifiedStaticActorProperties({
      actor: {
        ...baseActor,
        loadout: {
          ...baseActor.loadout,
          soulessenceId: 10001,
          equipment: {
            weapon: 1010111,
            top: 1020111,
            bottom: 1030111,
            earring: 1040111,
            ring: 1050111,
          },
        },
      },
    });

    expect(before.ready).toBe(true);
    expect(after.ready).toBe(true);
    expect(after.stats.attack).toBeGreaterThan(before.stats.attack);
    expect(after.stats.maxHp).toBeGreaterThan(before.stats.maxHp);
    expect(after.kibo.stats.attack).toBeGreaterThan(before.kibo.stats.attack);
    expect(after.kibo.inheritance.core.ATK).toMatchObject({
      inheritedBase: expect.any(Number),
      inheritedAdd: expect.any(Number),
    });
    expect(after.sources.map(source => source.kind)).toEqual(
      expect.arrayContaining([
        'actor-level-template',
        'star-gift-rank',
        'favorability',
        'soulessence-level',
        'soulessence-rank',
        'equipment-main',
        'equipment-sub',
      ])
    );
    expect(after.unapplied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'soulessence-effect-skill',
          appliedToStaticPanel: false,
        }),
      ])
    );
    expect(repeated).toEqual(after);
  });

  it('projects set-piece thresholds separately from unapplied runtime effects', () => {
    const result = compileVerifiedStaticActorProperties({
      actor: {
        characterId: 101007,
        level: 80,
        cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
        loadout: {
          equipment: {
            weapon: 1210421,
            top: 1220221,
            bottom: 1230221,
          },
        },
      },
    });

    expect(result.setSkillActivations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          setId: 1,
          pieces: 2,
          selectedPieceCount: 3,
          thresholdMet: true,
          thresholdStatus: 'set-skill-piece-threshold-met',
          runtimeEffectStatus: 'runtime-applied',
          appliedToCalculators: true,
        }),
        expect.objectContaining({
          setId: 1,
          pieces: 4,
          selectedPieceCount: 3,
          thresholdMet: false,
          thresholdStatus: 'set-skill-piece-threshold-not-met',
          appliedToCalculators: false,
        }),
      ])
    );
    expect(
      result.sources.filter(
        source => source.kind === 'accessory-set-persistent-property'
      )
    ).toHaveLength(1);
    expect(
      result.unapplied.filter(source => source.kind === 'accessory-set-skill')
    ).toEqual([]);
  });

  it('applies an equipped persistent soul root once and preserves every 10133 leaf', () => {
    const createActor = (soulessenceId, runtimeStatus = 'runtime-applied') => ({
      characterId: 101007,
      level: 80,
      cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
      loadout: {
        soulessenceId,
        soulessenceLevel: 80,
        soulessenceRank: 6,
        soulessenceStar: 1,
        kiboId: 500001,
        kiboConfig: neutralKiboConfig,
        soulessenceCultivation: {
          effectSkill: {
            skillId: soulessenceId === 10133 ? 1900440 : 1900360,
            star: 1,
            skillLevel: 1,
            runtimeStatus,
            sourceIdentity: `fixture:soul:${soulessenceId}`,
          },
        },
      },
    });
    const disabled = compileVerifiedStaticActorProperties({
      actor: createActor(10033, 'source-indexed-runtime-unapplied'),
    });
    const enabled = compileVerifiedStaticActorProperties({
      actor: createActor(10033),
    });
    const dualLeaf = compileVerifiedStaticActorProperties({
      actor: createActor(10133),
    });
    const dualLeafDisabled = compileVerifiedStaticActorProperties({
      actor: createActor(10133, 'source-indexed-runtime-unapplied'),
    });

    expect(enabled.core.MAXHP.externalPercentRaw).toBe(
      disabled.core.MAXHP.externalPercentRaw + 1460
    );
    expect(
      enabled.sources.filter(
        source => source.kind === 'soulessence-persistent-property'
      )
    ).toEqual([
      expect.objectContaining({
        sourceId: '10033:19003602:star-1',
        attributes: [{ id: 1005, value: 1460 }],
        sourceSequencePath: [
          0, 101007, 1, 10033, 0, 1900360, 0, 0, 0, 0, 0, 19003602,
        ],
        sourceSequenceStatus:
          'verified-persistent-loadout-property-source-sequence-ready',
      }),
    ]);
    expect(
      dualLeaf.sources
        .filter(source => source.kind === 'soulessence-persistent-property')
        .map(source => source.sourceId)
        .sort()
    ).toEqual(['10133:19004401:star-1', '10133:19004403:star-1']);
    expect(attributeValue(dualLeaf, 23)).toBeGreaterThan(
      attributeValue(dualLeafDisabled, 23)
    );
    expect(attributeValue(dualLeaf, 105)).toBeGreaterThan(
      attributeValue(dualLeafDisabled, 105)
    );
    expect(enabled.kibo.stats.maxHp).toBeGreaterThan(disabled.kibo.stats.maxHp);
    expect(
      dualLeaf.sources
        .filter(source => source.kind === 'soulessence-persistent-property')
        .map(source => source.sourceSequencePath.at(-1))
        .sort((left, right) => left - right)
    ).toEqual([19004401, 19004403]);
    expect(
      enabled.unapplied.some(
        source => source.kind === 'soulessence-effect-skill'
      )
    ).toBe(false);
  });

  it('keeps soulessence stat growth while gating the effect skill by profession', () => {
    const createActor = () => ({
      characterId: 101007,
      level: 80,
      cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
      loadout: {
        soulessenceId: 10095,
        soulessenceLevel: 80,
        soulessenceRank: 6,
        soulessenceStar: 1,
        soulessenceCultivation: {
          effectSkill: {
            skillId: 1900320,
            star: 1,
            skillLevel: 1,
            runtimeStatus: 'runtime-applied',
            sourceIdentity: 'fixture:soul:10095',
          },
        },
      },
    });
    const mismatched = compileVerifiedStaticActorProperties({
      actor: createActor(),
      position: '爆发',
    });
    const matched = compileVerifiedStaticActorProperties({
      actor: createActor(),
      position: '增幅',
    });

    for (const result of [mismatched, matched]) {
      expect(result.sources.map(source => source.kind)).toEqual(
        expect.arrayContaining(['soulessence-level', 'soulessence-rank'])
      );
      expect(result.stats.attack).toBeGreaterThan(0);
    }
    expect(mismatched.unapplied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'soulessence-effect-skill',
          reason: 'soulessence-profession-mismatch',
          requiredProfession: '增幅',
          actorPosition: '爆发',
          appliedToStaticPanel: false,
        }),
      ])
    );
    expect(
      matched.unapplied.some(
        source =>
          source.kind === 'soulessence-effect-skill' &&
          source.reason === 'soulessence-profession-mismatch'
      )
    ).toBe(false);
  });

  it('applies all six two-piece roots from legal equipment sets with stable provenance', () => {
    for (const fixture of PERSISTENT_SET_CASES) {
      const result = compileVerifiedStaticActorProperties({
        actor: {
          characterId: 101007,
          level: 80,
          cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
          loadout: { equipment: fixture.equipment },
        },
      });
      const sources = result.sources.filter(
        source => source.kind === 'accessory-set-persistent-property'
      );

      expect(sources).toEqual([
        expect.objectContaining({
          sourceId: fixture.sourceId,
          attributes: [fixture.attribute],
          sourceSequenceStatus:
            'verified-persistent-loadout-property-source-sequence-ready',
        }),
      ]);
      expect(sources[0].sourceSequencePath.slice(0, 7)).toEqual([
        0,
        101007,
        2,
        fixture.setId,
        2,
        expect.any(Number),
        0,
      ]);
    }
  });

  it('applies set three four-piece MAXHP +2% once while leaving its receive-damage branch scenario-excluded', () => {
    const compileWithEquipment = equipment =>
      compileVerifiedStaticActorProperties({
        actor: {
          characterId: 101007,
          level: 80,
          cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
          loadout: { equipment },
        },
      });
    const threePieces = compileWithEquipment({
      weapon: 1210121,
      top: 1220121,
      bottom: 1230121,
    });
    const fourPieces = compileWithEquipment({
      weapon: 1210121,
      top: 1220121,
      bottom: 1230121,
      earring: 1240121,
    });
    const fivePieces = compileWithEquipment({
      weapon: 1210121,
      top: 1220121,
      bottom: 1230121,
      earring: 1240121,
      ring: 1250121,
    });
    const setSources = result =>
      result.sources.filter(
        source => source.kind === 'accessory-set-persistent-property'
      );

    expect(setSources(fourPieces)).toEqual([
      expect.objectContaining({
        sourceId: '3:2:199999032',
        attributes: [{ id: 1005, value: 620 }],
      }),
      expect.objectContaining({
        sourceId: '3:4:199999086',
        attributes: [{ id: 1005, value: 200 }],
      }),
    ]);
    expect(setSources(fivePieces)).toEqual(setSources(fourPieces));
    expect(
      fourPieces.setSkillActivations.find(
        activation => activation.setId === 3 && activation.pieces === 4
      )
    ).toMatchObject({
      selectedPieceCount: 4,
      thresholdMet: true,
      runtimeEffectStatus: 'runtime-applied',
      appliedToCalculators: true,
      appliedToRuntimeEffect: false,
    });
    expect(
      fourPieces.unapplied.some(
        source => source.kind === 'accessory-set-skill' && source.setId === 3
      )
    ).toBe(false);
  });

  it('fails closed when a persistent root loses formula, target, unload, graph path, or a 10133 leaf', () => {
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => entry.soulEssenceId === 10133
    );
    const validate = root =>
      validatePersistentLoadoutPropertyRoot(root, {
        requiresStarValues: true,
        expectedPropertyElementIds: definition.sourceClosure.propertyElementIds,
      });
    const mutations = [
      root => {
        root.installation.sourceSequencePath = [];
      },
      root => {
        root.effects[0].formula.baseFunctionId = null;
      },
      root => {
        root.effects[0].executeTargetType = 15;
      },
      root => {
        root.effects[0].combineNumber = 1;
      },
      root => {
        root.unload.removalPaths = [];
      },
      root => {
        root.effects.pop();
      },
    ];

    expect(validate(structuredClone(definition.persistentRoot))).toEqual({
      valid: true,
      issueCodes: [],
    });
    const nativeCoverZero = structuredClone(definition.persistentRoot);
    nativeCoverZero.effects[0].combineNumber = 0;
    expect(validate(nativeCoverZero)).toEqual({
      valid: true,
      issueCodes: [],
    });
    for (const mutate of mutations) {
      const root = structuredClone(definition.persistentRoot);
      mutate(root);
      expect(validate(root).valid).toBe(false);
    }
  });

  it('applies a two-piece persistent set property exactly once at two, three, or four pieces', () => {
    const compileWithEquipment = equipment =>
      compileVerifiedStaticActorProperties({
        actor: {
          characterId: 101007,
          level: 80,
          cultivation: { starGiftRank: 0, favorabilityLevel: 0 },
          loadout: { equipment },
        },
      });
    const onePiece = compileWithEquipment({ weapon: 1210421 });
    const twoPieces = compileWithEquipment({
      weapon: 1210421,
      top: 1220221,
    });
    const threePieces = compileWithEquipment({
      weapon: 1210421,
      top: 1220221,
      bottom: 1230221,
    });
    const fourPieces = compileWithEquipment({
      weapon: 1210421,
      top: 1220221,
      bottom: 1230221,
      earring: 1240221,
    });
    const fivePieces = compileWithEquipment({
      weapon: 1210421,
      top: 1220221,
      bottom: 1230221,
      earring: 1240221,
      ring: 1250221,
    });
    const setSources = result =>
      result.sources.filter(
        source => source.kind === 'accessory-set-persistent-property'
      );

    expect(setSources(onePiece)).toHaveLength(0);
    expect(setSources(twoPieces)).toEqual([
      expect.objectContaining({
        sourceId: '1:2:199999034',
        attributes: [{ id: 1001, value: 620 }],
      }),
    ]);
    expect(setSources(threePieces)).toEqual(setSources(twoPieces));
    expect(setSources(fourPieces)).toEqual(setSources(twoPieces));
    expect(
      twoPieces.setSkillActivations.find(
        activation => activation.setId === 1 && activation.pieces === 2
      )
    ).toMatchObject({
      thresholdMet: true,
      runtimeEffectStatus: 'runtime-applied',
      appliedToCalculators: true,
    });
    expect(
      fourPieces.setSkillActivations.find(
        activation => activation.setId === 1 && activation.pieces === 4
      )
    ).toMatchObject({
      skillId: 19998006,
      thresholdMet: true,
      runtimeEffectStatus: 'runtime-applied',
      appliedToRuntimeEffect: true,
    });
    expect(
      fourPieces.unapplied.some(
        source => source.kind === 'accessory-set-skill' && source.pieces === 4
      )
    ).toBe(false);
    expect(
      fivePieces.setSkillActivations.filter(
        activation => activation.setId === 1 && activation.pieces === 4
      )
    ).toEqual([
      expect.objectContaining({
        selectedPieceCount: 5,
        thresholdMet: true,
        appliedToRuntimeEffect: true,
      }),
    ]);
  });

  it('propagates a loadout through actor, Kibo, and legal foreground hit results', () => {
    const bare = simulateLoadoutScenario({});
    const equipped = simulateLoadoutScenario({
      soulessenceId: 10001,
      equipment: {
        weapon: 1010111,
        top: 1020111,
        bottom: 1030111,
        earring: 1040111,
        ring: 1050111,
      },
    });
    const bareActor = bare.scenario.actors.find(
      actor => actor.characterId === 101007
    );
    const equippedActor = equipped.scenario.actors.find(
      actor => actor.characterId === 101007
    );

    expect(bare.scenario.actors).toHaveLength(3);
    expect(
      bare.scenario.actors.every(
        actor => actor.verifiedStaticKiboProperties?.ready === true
      )
    ).toBe(true);
    expect(equippedActor.stats.attack).toBeGreaterThan(bareActor.stats.attack);
    expect(
      equippedActor.verifiedStaticKiboProperties.stats.attack
    ).toBeGreaterThan(bareActor.verifiedStaticKiboProperties.stats.attack);
    expect(actionDamage(equipped.result, 'loadout-actor-hit')).toBeGreaterThan(
      actionDamage(bare.result, 'loadout-actor-hit')
    );
    expect(
      bare.scenario.actions.filter(action => action.type === 'kiboEvent')
    ).toEqual([]);
    expect(
      equipped.scenario.kiboAutoCastDerivationRegistry.scheduleExclusions
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ownerCharacterId: 101007,
          kiboId: 500001,
          code: 'kibo-auto-cast-schedule-unresolved',
        }),
      ])
    );
    expect(equippedActor.verifiedStaticProperties.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'soulessence-level' }),
        expect.objectContaining({ kind: 'equipment-main' }),
      ])
    );
    expect(equippedActor.verifiedStaticProperties.unapplied).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'soulessence-effect-skill',
          appliedToStaticPanel: false,
        }),
      ])
    );
    expect(
      equipped.scenario.mechanismConfiguration.actors.find(
        source => source.characterId === 101007
      )?.application.loadout
    ).toMatchObject({
      status:
        'verified-static-loadout-properties-applied-dynamic-effects-unapplied',
      appliedToCalculators: true,
      staticPropertiesAppliedToCalculators: true,
      dynamicEffectsAppliedToCalculators: false,
    });
  });

  it('propagates a persistent elemental soul into real damage without leaking to teammates', () => {
    const disabled = simulateActorLoadoutScenario({
      characterId: 101010,
      actionKind: 'normal-attack',
      attackSequenceIndex: 1,
      loadoutPatch: createPersistentSoulLoadout(
        10056,
        1900820,
        'source-indexed-runtime-unapplied'
      ),
    });
    const enabled = simulateActorLoadoutScenario({
      characterId: 101010,
      actionKind: 'normal-attack',
      attackSequenceIndex: 1,
      loadoutPatch: createPersistentSoulLoadout(10056, 1900820),
    });
    const repeated = simulateActorLoadoutScenario({
      characterId: 101010,
      actionKind: 'normal-attack',
      attackSequenceIndex: 1,
      loadoutPatch: createPersistentSoulLoadout(10056, 1900820),
      repeatActorAction: true,
    });
    const owner = enabled.scenario.actors.find(
      actor => Number(actor.characterId) === 101010
    );
    const teammates = enabled.scenario.actors.filter(
      actor => Number(actor.characterId) !== 101010
    );

    expect(actionDamage(enabled.result, 'loadout-actor-hit')).toBeGreaterThan(
      actionDamage(disabled.result, 'loadout-actor-hit')
    );
    expect(actionDamage(repeated.result, 'loadout-actor-hit')).toBe(
      actionDamage(enabled.result, 'loadout-actor-hit')
    );
    expect(actionDamage(repeated.result, 'loadout-actor-hit-cycle-2')).toBe(
      actionDamage(repeated.result, 'loadout-actor-hit')
    );
    expect(
      owner.verifiedStaticProperties.sources.filter(
        source => source.kind === 'soulessence-persistent-property'
      )
    ).toHaveLength(1);
    expect(
      teammates.every(actor =>
        actor.verifiedStaticProperties.sources.every(
          source => source.kind !== 'soulessence-persistent-property'
        )
      )
    ).toBe(true);
  });

  it('applies the 10133 healing leaf to a real direct heal and removes it with the loadout', () => {
    const initialRuntimeState = {
      actorVitalsByActor: [
        {
          actorId: 'actor-107002',
          characterId: 107002,
          currentValue: 1000,
          maxValue: 100000,
          valueShields: [],
        },
      ],
    };
    const disabled = simulateActorLoadoutScenario({
      characterId: 107002,
      actionKind: 'normal-attack',
      attackSequenceIndex: 3,
      initialRuntimeState,
      loadoutPatch: createPersistentSoulLoadout(
        10133,
        1900440,
        'source-indexed-runtime-unapplied'
      ),
    });
    const enabled = simulateActorLoadoutScenario({
      characterId: 107002,
      actionKind: 'normal-attack',
      attackSequenceIndex: 3,
      initialRuntimeState,
      loadoutPatch: createPersistentSoulLoadout(10133, 1900440),
    });
    const disabledHeal = settleDirectHeal(disabled);
    const enabledHeal = settleDirectHeal(enabled);

    expect(disabledHeal.payload).toMatchObject({
      requestedChange: 100,
      sourceShootHealUpRaw: 0,
    });
    expect(enabledHeal.payload).toMatchObject({
      requestedChange: 116,
      sourceShootHealUpRaw: 1560,
    });
    expect(
      enabled.scenario.actors
        .find(actor => Number(actor.characterId) === 107002)
        .verifiedStaticProperties.sources.filter(
          source => source.kind === 'soulessence-persistent-property'
        )
    ).toHaveLength(2);
  });

  it('settles the two-piece heavy-attack property through real toughness damage', () => {
    const onePiece = simulateActorLoadoutScenario({
      characterId: 101007,
      actionKind: 'charged-attack',
      loadoutPatch: { equipment: { weapon: 1210611 } },
    });
    const twoPieces = simulateActorLoadoutScenario({
      characterId: 101007,
      actionKind: 'charged-attack',
      loadoutPatch: {
        equipment: { weapon: 1210611, top: 1220321 },
      },
    });
    const oneActor = onePiece.scenario.actors.find(
      actor => Number(actor.characterId) === 101007
    );
    const twoActor = twoPieces.scenario.actors.find(
      actor => Number(actor.characterId) === 101007
    );

    expect(attributeValue(twoActor.verifiedStaticProperties, 222)).toBe(
      attributeValue(oneActor.verifiedStaticProperties, 222) + 2000
    );
    expect(
      actionToughnessDamage(twoPieces.result, 'loadout-actor-hit')
    ).toBeGreaterThan(
      actionToughnessDamage(onePiece.result, 'loadout-actor-hit')
    );
  });

  it('binds explicit optimization-object source aliases without admitting unrelated identities', () => {
    const aliasResults = [199001, 199002].map(characterId =>
      compileVerifiedStaticActorProperties({
        actor: {
          characterId,
          level: 80,
          cultivation: {},
          loadout: {},
        },
      })
    );

    for (const result of aliasResults) {
      expect(result).toMatchObject({
        status: 'verified-static-actor-properties-ready',
        ready: true,
        applied: true,
        unresolved: [],
        stats: {
          attack: expect.any(Number),
          critRate: expect.any(Number),
          critDamage: expect.any(Number),
        },
      });
      expect(result.stats.attack).toBeGreaterThan(0);
    }
    expect(aliasResults[0].stats).toEqual(aliasResults[1].stats);
    expect(aliasResults[0].sources[0].sourceIdentity).toContain(
      'src/data/generated/characters.json#items[id=199001]'
    );
    expect(aliasResults[0].sources[0].sourceIdentity).not.toContain(
      'src/data/generated/characters.json#items[id=199002]'
    );
    expect(aliasResults[1].sources[0].sourceIdentity).toContain(
      'src/data/generated/characters.json#items[id=199002]'
    );
    expect(aliasResults[1].sources[0].sourceIdentity).not.toContain(
      'src/data/generated/characters.json#items[id=199001]'
    );

    const unrelated = compileVerifiedStaticActorProperties({
      actor: {
        characterId: 199003,
        level: 80,
        cultivation: {},
        loadout: {},
      },
    });
    expect(unrelated).toMatchObject({
      status: 'verified-static-actor-profile-unresolved',
      ready: false,
      applied: false,
      attributes: [],
      unresolved: [
        expect.objectContaining({
          identityClassification: 'non-current-public-directory',
        }),
      ],
    });
  });

  it('fails closed when an optimization-object alias profile is missing or cross-bound', () => {
    const missingAliasPackage = structuredClone(mechanicsPackage);
    missingAliasPackage.staticPropertyCatalog.actor.profiles =
      missingAliasPackage.staticPropertyCatalog.actor.profiles.filter(
        profile => Number(profile.characterId) !== 199001
      );
    const missing = compileVerifiedStaticActorProperties({
      actor: {
        characterId: 199001,
        level: 80,
        cultivation: {},
        loadout: {},
      },
      mechanicsPackage: missingAliasPackage,
    });
    expect(missing).toMatchObject({
      status: 'verified-static-actor-profile-unresolved',
      ready: false,
      applied: false,
    });

    const crossBoundPackage = structuredClone(mechanicsPackage);
    const profiles = crossBoundPackage.staticPropertyCatalog.actor.profiles;
    const femaleIndex = profiles.findIndex(
      profile => Number(profile.characterId) === 199001
    );
    const maleProfile = profiles.find(
      profile => Number(profile.characterId) === 199002
    );
    profiles[femaleIndex] = {
      ...structuredClone(maleProfile),
      characterId: 199001,
    };
    const crossBound = compileVerifiedStaticActorProperties({
      actor: {
        characterId: 199001,
        level: 80,
        cultivation: {},
        loadout: {},
      },
      mechanicsPackage: crossBoundPackage,
    });
    expect(crossBound).toMatchObject({
      status: 'verified-static-actor-source-alias-binding-invalid',
      ready: false,
      applied: false,
      unresolved: [
        expect.objectContaining({
          sourceAliasIdentity: 'STARBORN:source-alias:199002',
        }),
      ],
    });
  });
});

function attributeValue(result, attributeId) {
  return Number(
    result.attributes.find(attribute => attribute.id === attributeId)
      ?.rawValue ?? 0
  );
}

function simulateLoadoutScenario(loadoutPatch) {
  return simulateActorLoadoutScenario({
    characterId: 101007,
    actionKind: 'normal-attack',
    attackSequenceIndex: 3,
    loadoutPatch,
  });
}

function simulateActorLoadoutScenario({
  characterId,
  actionKind,
  attackSequenceIndex = null,
  loadoutPatch,
  initialRuntimeState = undefined,
  repeatActorAction = false,
  position = null,
}) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const kiboIds = [500002, 500003];
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    (config, index) => ({
      ...config,
      loadout: {
        ...config.loadout,
        kiboId:
          Number(config.characterId) === Number(characterId)
            ? 500001
            : kiboIds.shift(),
        ...(Number(config.characterId) === Number(characterId)
          ? loadoutPatch
          : {}),
        kiboConfig: neutralKiboConfig,
      },
    })
  );
  const mapping = mechanicsPackage.actionMappings.find(
    entry =>
      Number(entry.ownerId) === Number(characterId) &&
      entry.actionKind === actionKind
  );
  const attackInput = mapping.attackInputSegments?.find(
    segment => Number(segment.sequenceIndex) === Number(attackSequenceIndex)
  );
  const durationFrames =
    mapping.actionTiming?.occupancy?.durationFrames ??
    mapping.actionScheduling?.durationFrames ??
    mapping.actionScheduling?.planningDurationFrames ??
    120;
  const createActorAction = (id, startMs) =>
    createWorkbenchActionDraft({
      id,
      type: 'skill',
      actorCharacterId: characterId,
      skillId: mapping.sourceSkillId,
      actionVariantIndex: mapping.actionVariantIndex,
      startMs,
      durationMs: attackInput?.durationMs ?? frameToMs(durationFrames),
      ...(attackInput
        ? {
            attackGroupId: 'loadout-attack-chain',
            attackSequenceIndex: attackInput.sequenceIndex,
            attackSequenceTotal: attackInput.sequenceTotal,
            attackInput,
          }
        : {}),
    });
  const actions = [
    createActorAction('loadout-actor-hit', 0),
    ...(repeatActorAction
      ? [createActorAction('loadout-actor-hit-cycle-2', 3000)]
      : []),
  ];
  const project = createWorkbenchProject(selection, {
    durationMs: repeatActorAction ? 10000 : 8000,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  const ownerActor = scenario.actors.find(
    actor => Number(actor.characterId) === Number(characterId)
  );
  if (ownerActor) {
    const soulId = Number(loadoutPatch?.soulessenceId);
    const definition = soulEssenceEffectCatalog.definitions.find(
      entry => Number(entry.soulEssenceId) === soulId
    );
    ownerActor.position =
      position ??
      (definition?.profession ? String(definition.profession) : null);
  }
  return { scenario, result: simulateScenario(scenario) };
}

function createPersistentSoulLoadout(
  soulessenceId,
  skillId,
  runtimeStatus = 'runtime-applied'
) {
  return {
    soulessenceId,
    soulessenceLevel: 80,
    soulessenceRank: 6,
    soulessenceStar: 1,
    soulessenceCultivation: {
      effectSkill: {
        skillId,
        star: 1,
        skillLevel: 1,
        runtimeStatus,
        sourceIdentity: `fixture:persistent-soul:${soulessenceId}`,
      },
    },
  };
}

function settleDirectHeal({ scenario, result }) {
  const action = scenario.actions.find(
    entry => entry.id === 'loadout-actor-hit'
  );
  const directHpEvents = [
    ...(result.verifiedBattleEffectGeneration?.directHpEvents ?? []),
    {
      eventIdentity: `fixture:persistent-direct-heal:${action.id}`,
      timeMs: frameToMs(30),
      action,
      actionId: action.id,
      actorId: action.actorId,
      target: { kind: 'actor', id: action.actorId },
      value: 100,
      effect: { effectIdentity: 'fixture:persistent-direct-heal-effect' },
      resolution: result.verifiedActionVariantRuntime.actionResolutionById.get(
        action.id
      ),
      sourceIdentity: 'fixture:persistent-direct-heal-settlement',
      sourceSequencePath: [
        ...(action.sourceSequencePath ?? [action.sourceSequenceIndex ?? 0]),
        90,
        30,
        0,
      ],
      sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
      applied: true,
    },
  ];
  const runtime = createVerifiedCombatRuntime({
    scenario,
    actionExecutionPlan: result.actionExecutionPlan,
    controlledActorTimeline: result.controlledActorTimeline,
    effectGeneration: {
      ...result.verifiedBattleEffectGeneration,
      directHpEvents,
    },
    tuningGeneration: result.verifiedTuningMarkGeneration,
    damageEventGeneration: result.verifiedDamageEventGeneration,
    effectTimeline: result.effectTimeline,
    actionVariantRuntime: result.verifiedActionVariantRuntime,
    kiboPassiveGeneration: result.verifiedKiboPassiveGeneration,
  });
  return runtime.vitalEvents.find(
    event =>
      event.type === 'VERIFIED_DIRECT_HEAL' &&
      event.payload.sourceEventIdentity ===
        `fixture:persistent-direct-heal:${action.id}`
  );
}

function actionDamage(result, actionId) {
  return result.verifiedCombatRuntime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((total, event) => total + event.payload.rawDamage, 0);
}

function actionToughnessDamage(result, actionId) {
  return result.verifiedCombatRuntime.damageEvents
    .filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === actionId
    )
    .reduce(
      (total, event) => total + Number(event.payload.toughnessDamage ?? 0),
      0
    );
}
