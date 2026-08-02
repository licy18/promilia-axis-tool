import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
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
import { compileVerifiedStaticActorProperties } from '../../simulation/mechanics/verifiedCombatStaticProperties';

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
const pangpangNormalMapping = mechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === 101007 && mapping.actionKind === 'normal-attack'
);
const pangpangAttackInput = pangpangNormalMapping.attackInputSegments.find(
  segment => segment.sequenceIndex === 3
);

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
          runtimeEffectStatus: 'effect-set-skill-dynamic-unapplied',
          appliedToCalculators: false,
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
      result.sources.some(source => source.kind === 'accessory-set-skill')
    ).toBe(false);
    expect(
      result.unapplied.filter(source => source.kind === 'accessory-set-skill')
    ).toEqual([
      expect.objectContaining({ setId: 1, pieces: 2, sourceId: 19998106 }),
    ]);
  });

  it('propagates one three-actor loadout change through actor, kibo, and hit results', () => {
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
    expect(equippedActor.verifiedStaticKiboProperties.stats.attack).toBeGreaterThan(
      bareActor.verifiedStaticKiboProperties.stats.attack
    );
    expect(actionDamage(equipped.result, 'loadout-actor-hit')).toBeGreaterThan(
      actionDamage(bare.result, 'loadout-actor-hit')
    );
    expect(actionDamage(equipped.result, 'loadout-kibo-hit')).toBeGreaterThan(
      actionDamage(bare.result, 'loadout-kibo-hit')
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

  it('keeps identities outside the verified collectible set unresolved', () => {
    const result = compileVerifiedStaticActorProperties({
      actor: {
        characterId: 199001,
        level: 80,
        cultivation: {},
        loadout: {},
      },
    });

    expect(result).toMatchObject({
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
});

function simulateLoadoutScenario(loadoutPatch) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const kiboIds = [500002, 500003, 500001];
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map((config, index) => ({
    ...config,
    loadout: {
      ...config.loadout,
      kiboId: kiboIds[index],
      ...(Number(config.characterId) === 101007 ? loadoutPatch : {}),
      kiboConfig: neutralKiboConfig,
    },
  }));
  const actions = [
    createWorkbenchActionDraft({
      id: 'loadout-actor-hit',
      type: 'skill',
      actorCharacterId: 101007,
      skillId: pangpangNormalMapping.sourceSkillId,
      actionVariantIndex: pangpangNormalMapping.actionVariantIndex,
      startMs: 0,
      durationMs: pangpangAttackInput.durationMs,
      attackGroupId: 'loadout-attack-chain',
      attackSequenceIndex: pangpangAttackInput.sequenceIndex,
      attackSequenceTotal: pangpangAttackInput.sequenceTotal,
      attackInput: pangpangAttackInput,
    }),
    createWorkbenchActionDraft({
      id: 'loadout-kibo-hit',
      type: 'kiboEvent',
      actorCharacterId: 101007,
      kiboId: 500001,
      skillId: 504004,
      actionVariantIndex: 0,
      eventType: 'active',
      startMs: 2000,
      durationMs: 3000,
    }),
  ];
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 8000,
    teamSlots,
    actorConfigs,
    actions,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  return { scenario, result: simulateScenario(scenario) };
}

function actionDamage(result, actionId) {
  return result.verifiedCombatRuntime.damageEvents
    .filter(event => event.actionId === actionId)
    .reduce((total, event) => total + event.payload.rawDamage, 0);
}
