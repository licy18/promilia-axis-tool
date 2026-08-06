import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
  resolveVerifiedCombatActionMechanics,
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
import { createWorkbenchAttackInputChainDrafts } from '../../domain/workbenchAttackInputChain';
import { compileProject } from '../../simulation/compiler/compileProject';
import { createActionExecutionPlan } from '../../simulation/engine/actionExecutionPlan';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createActionRuleDiagnostics } from '../../simulation/runtime/actionRuleDiagnostics';
import { createControlledActorTimeline } from '../../simulation/runtime/controlledActorTimeline';
import { createDeterministicCriticalRandomSource } from '../../simulation/runtime/criticalRandomSource';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';
import {
  calculateAutoSp,
  calculateRealDamage,
  calculateWeaknessDamage,
  qFromFloat,
} from '../../simulation/mechanics/verifiedCombatFormulaRuntime';

const PANGPANG_CHARACTER_ID = 101007;
const PANGPANG_SKILL_ID = 10100701;
const PANGPANG_ULTIMATE_SKILL_ID = 10100713;
const MUYIN_ULTIMATE_SKILL_ID = 10900113;
const HEAVY_ROCK_HOOF_ID = 500469;
const HEAVY_ROCK_HOOF_SKILL_ID = 50046903;
const PANGPANG_NORMAL_MAPPING =
  verifiedCombatMechanicsPackage.actionMappings.find(
    mapping =>
      mapping.ownerId === PANGPANG_CHARACTER_ID &&
      mapping.actionKind === 'normal-attack'
  );
const PANGPANG_ATTACK_INPUT = PANGPANG_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 3
);
const HAN_YOUYOU_CHARACTER_ID = 101003;
const HAN_YOUYOU_NORMAL_MAPPING =
  verifiedCombatMechanicsPackage.actionMappings.find(
    mapping =>
      mapping.ownerId === HAN_YOUYOU_CHARACTER_ID &&
      mapping.actionKind === 'normal-attack'
  );
const HAN_YOUYOU_PROJECTILE_INPUT =
  HAN_YOUYOU_NORMAL_MAPPING.attackInputSegments.find(
    segment => segment.controlSkillId === 10100303
  );
const XIAOYU_CHARACTER_ID = 101010;
const XIAOYU_NORMAL_SKILL_ID = 10101001;
const XIAOYU_TRIGGER_SKILL_ID = 10101021;
const XIAOYU_KIBO_ID = 500003;
const XIAOYU_NORMAL_MAPPING =
  verifiedCombatMechanicsPackage.actionMappings.find(
    mapping =>
      mapping.ownerId === XIAOYU_CHARACTER_ID &&
      mapping.actionKind === 'normal-attack'
  );
const XIAOYU_A3_INPUT = XIAOYU_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 3
);
const XIAOYU_A4_INPUT = XIAOYU_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 4
);
const XIAOYU_WIND_MARK =
  verifiedCombatMechanicsPackage.tuningMechanicsCatalog.profiles.find(
    profile => profile.key === 'wind'
  );
const XIAOYU_CONTROL_BINDING_BY_ID = new Map(
  verifiedCombatMechanicsPackage.controlBindings.map(binding => [
    Number(binding.controlSkillId),
    binding,
  ])
);
const RUBY_CHARACTER_ID = 103002;
const RUBY_STAR_SKILL_ID = 10300212;
const RUBY_KIBO_ID = 500039;
const RUBY_STAR_SKILL_BINDING =
  verifiedCombatMechanicsPackage.controlBindings.find(
    binding => Number(binding.controlSkillId) === RUBY_STAR_SKILL_ID
  );

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified combat mechanics runtime', () => {
  it('uses SPGETUP and SPRET_AUTO in the exact Q16.16 auto recovery order', () => {
    const foreground = calculateAutoSp({
      background: false,
      sprSec: 0.2084,
      sprSecBack: 0.1042,
      spGetUp: 0,
      spRetAuto: 0,
      tickSeconds: 0.1,
      maximumSp: 100,
    });
    const background = calculateAutoSp({
      background: true,
      sprSec: 0.2084,
      sprSecBack: 0.1042,
      spGetUp: 0,
      spRetAuto: 0,
      tickSeconds: 0.1,
      maximumSp: 100,
    });

    expect(foreground).toMatchObject({
      raw: '1365',
      value: 0.0208282470703125,
    });
    expect(background).toMatchObject({
      raw: '682',
      value: 0.010406494140625,
    });
    expect(
      foreground.trace.find(step => step.name === 'auto_sp_bonus')
    ).toEqual(
      expect.objectContaining({
        attributeKeys: ['SPGETUP', 'SPRET_AUTO'],
        legacyAlias: null,
      })
    );
    const actorProfile =
      verifiedCombatMechanicsPackage.ownerProfiles.actor.find(
        profile => profile.characterId === 109001
      );
    expect(actorProfile).toMatchObject({
      maxSpBase: 1,
      maxSpGrowthTemplateId: 1001001,
      maxSpGrowthMultiplier: 100,
      effectiveMaxSp: 100,
      spGetUpBasisPoints: null,
      spRetAutoBasisPoints: 0,
      spGetUpAttackBasisPoints: 0,
    });
    expect(actorProfile).not.toHaveProperty('spGetUpAutoBasisPoints');
  });

  it('resolves the two acceptance source chains without an inferred alias', () => {
    const actorResolution = resolveVerifiedCombatActionMechanics({
      id: 'pangpang-normal',
      type: 'skill',
      skillId: PANGPANG_SKILL_ID,
      actionVariantIndex: 0,
      ...createPangpangAttackInputFields('direct-pangpang-chain'),
      actor: {
        characterId: PANGPANG_CHARACTER_ID,
        loadout: { kiboId: HEAVY_ROCK_HOOF_ID },
      },
    });
    const kiboResolution = resolveVerifiedCombatActionMechanics({
      id: 'heavy-rock-hoof-signature',
      type: 'kiboEvent',
      skillId: HEAVY_ROCK_HOOF_SKILL_ID,
      kiboId: HEAVY_ROCK_HOOF_ID,
      actionVariantIndex: 0,
      actor: {
        characterId: PANGPANG_CHARACTER_ID,
        loadout: { kiboId: HEAVY_ROCK_HOOF_ID },
      },
    });

    expect(actorResolution).toMatchObject({
      ready: true,
      packageId: 'azpr-tc-2026-07-18',
      actionBinding: {
        identity: 'actor|101007|10100701|0|10100703|attack-input-3',
        controlSkillId: 10100703,
      },
    });
    expect(actorResolution.hits).toEqual([
      expect.objectContaining({
        elementId: 101007012,
        hitIndex: 1,
        trigger: expect.objectContaining({ startFrame: 14 }),
      }),
    ]);
    expect(kiboResolution).toMatchObject({
      ready: true,
      actionBinding: {
        identity: 'kibo|500469|50046903|0|50046903',
        controlSkillId: 50046903,
      },
    });
    expect(kiboResolution.hits.map(hit => hit.trigger.startFrame)).toEqual([
      27, 38, 49, 138, 142,
    ]);
  });

  it('drives HP, toughness, three actor SP curves and the bound kibo SP curve at exact hit frames', () => {
    const result = simulateVerifiedAcceptanceScenario();
    const runtime = result.verifiedCombatRuntime;
    const pangpangHit = runtime.damageEvents.find(
      event => event.actionId === 'verified-pangpang-normal'
    );
    const kiboHits = runtime.damageEvents.filter(
      event => event.actionId === 'verified-heavy-rock-hoof'
    );

    expect(runtime).toMatchObject({
      ready: true,
      packageId: 'azpr-tc-2026-07-18',
      summary: {
        readyActionResolutionCount: 2,
        damageEventCount: 6,
      },
    });
    expect(pangpangHit).toMatchObject({
      hitKey: 'verified-hit-1-101007012',
      payload: {
        elementId: 101007012,
        appliedToCalculators: true,
      },
    });
    expect(pangpangHit.timeMs).toBeCloseTo(14 * (1000 / 60), 5);
    expect(
      kiboHits.map(event => Math.round(event.timeMs * 1000) / 1000)
    ).toEqual([1450, 1633.333, 1816.667, 3300, 3366.667]);
    expect(result.damageTimeline).toHaveLength(6);
    expect(result.summary.totalRawDamage).toBeGreaterThan(0);
    expect(result.summary.totalProjectedToughnessDamage).toBeGreaterThan(0);

    const pangpangTransaction =
      result.runtimeOutputs.hitTransactions.transactions.find(
        transaction =>
          transaction.actionId === 'verified-pangpang-normal' &&
          transaction.hitKey === 'verified-hit-1-101007012'
      );
    expect(pangpangTransaction).toMatchObject({
      trackKeys: ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange'],
      changedMetricKeys: ['enemyHp', 'enemyToughness', 'selfEnergy'],
      validation: { valid: true },
    });

    expect(result.runtimeOutputs.resourceCurves).toMatchObject({
      summary: {
        actorCount: 3,
        kiboCount: 3,
        energyCurveCount: 6,
      },
    });
    expect(
      result.runtimeOutputs.resourceCurves.curvesByActor.map(curve =>
        curve.points.some(point => point.timeMs === pangpangHit.timeMs)
      )
    ).toEqual([true, true, true]);
    const kiboCurve = result.runtimeOutputs.resourceCurves.curvesByKibo.find(
      curve => curve.kiboId === HEAVY_ROCK_HOOF_ID
    );
    expect(kiboCurve).toMatchObject({
      trackingOnly: false,
      appliedToCalculators: true,
      semanticResource: 'kibo-sp',
    });
    expect(kiboCurve.points).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'verified-heavy-rock-hoof',
          reason: 'verified-skill-cost',
        }),
      ])
    );
  });

  it('runs generated mappings across actors, action kinds, and a shared kibo skill', () => {
    const result = simulateCrossCatalogScenario();
    const resolutions = [
      'verified-han-star-skill',
      'verified-muyin-charged',
      'verified-wind-kibo-active',
    ].map(actionId =>
      result.verifiedCombatRuntime.actionResolutionById.get(actionId)
    );

    expect(resolutions).toEqual(
      resolutions.map(() =>
        expect.objectContaining({ ready: true, complete: true })
      )
    );
    expect(
      new Set(
        resolutions.map(resolution => resolution.actionBinding.actionKind)
      )
    ).toEqual(new Set(['star-skill', 'charged-attack', 'active']));
    for (const actionId of [
      'verified-han-star-skill',
      'verified-muyin-charged',
      'verified-wind-kibo-active',
    ]) {
      expect(
        result.verifiedCombatRuntime.damageEvents.some(
          event => event.actionId === actionId
        )
      ).toBe(true);
    }
    const damageTotals = Object.fromEntries(
      [
        'verified-han-star-skill',
        'verified-muyin-charged',
        'verified-wind-kibo-active',
      ].map(actionId => {
        const events = result.verifiedCombatRuntime.damageEvents.filter(
          event =>
            event.actionId === actionId && event.type === 'VERIFIED_COMBAT_HIT'
        );
        return [
          actionId,
          {
            hitCount: events.length,
            hp: events.reduce((sum, event) => sum + event.payload.rawDamage, 0),
            toughness: events.reduce(
              (sum, event) => sum + event.payload.toughnessDamage,
              0
            ),
          },
        ];
      })
    );
    expect(damageTotals).toEqual({
      'verified-han-star-skill': { hitCount: 7, hp: 224, toughness: 157 },
      'verified-muyin-charged': { hitCount: 3, hp: 191, toughness: 188 },
    'verified-wind-kibo-active': {
      hitCount: 1,
      hp: 105,
      toughness: 21,
    },
    });
    expect(
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === 'verified-wind-kibo-active')
        .flatMap(event => event.payload.dynamicPropertyTrace.target)
    ).toEqual([]);
    expect(result.verifiedKiboPassiveGeneration.summary).toMatchObject({
      effectCommandCount: 1,
      evidenceClosedDefinitionCount: 44,
      scenarioAssumedDefinitionCount: 0,
      unresolvedDefinitionCount: 0,
    });
    expect(
      result.effectTimeline.activeEffects.find(
        effect => effect.effectId === 'kibo-passive:520084:520084002'
      )
    ).toMatchObject({ stacks: 1, targetKind: 'enemy' });
    expect(
      result.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.actionId === 'verified-han-star-skill' &&
          event.type === 'VERIFIED_TUNING_DAMAGE'
      )?.payload
    ).toMatchObject({
      tuningMechanics: true,
      profileKey: 'fire',
      markCount: 1,
    });
    const hanActorRecovery = result.verifiedCombatRuntime.resourceEvents.filter(
      event =>
        event.actionId === 'verified-han-star-skill' &&
        event.payload.reason.includes('hit-sp')
    );
    expect(
      hanActorRecovery.slice(0, 3).map(event => event.payload.change)
    ).toEqual([0.479889, 0.239944, 0.239944]);
    expect(
      result.verifiedCombatRuntime.kiboResourceEvents.find(
        event =>
          event.actionId === 'verified-han-star-skill' &&
          event.payload.reason === 'verified-hit-pet-sp-shared-recovery'
      )?.payload
    ).toMatchObject({
      kiboId: 500001,
      change: 1.859985,
    });
    expect(result.verifiedCombatRuntime.finalState.enemy.hp).toBeLessThan(
      result.verifiedCombatRuntime.initialState.enemy.hp
    );
    expect(
      result.verifiedCombatRuntime.finalState.enemy.toughness
    ).toBeLessThan(result.verifiedCombatRuntime.initialState.enemy.toughness);
  });

  it('removes only the disabled zero-distance projectile hit and its three-value nodes', () => {
    const baseline = simulateHanProjectileInput();
    const baselineRuntime = baseline.verifiedCombatRuntime;
    const resolution = baselineRuntime.actionResolutionById.get(
      'verified-han-projectile-a3'
    );
    const baselineHits = baselineRuntime.damageEvents.filter(
      event => event.actionId === 'verified-han-projectile-a3'
    );
    expect(
      baselineHits.map(event => Math.round(event.timeMs * 1000) / 1000)
    ).toEqual([216.667, 266.667, 316.667]);
    expect(
      baselineHits.every(
        event =>
          event.payload.rawDamage > 0 && event.payload.toughnessDamage > 0
      )
    ).toBe(true);

    for (const [index, hit] of resolution.allHits.entries()) {
      const result = simulateHanProjectileInput({
        [hit.hitIdentity]: { willHit: false },
      });
      const runtime = result.verifiedCombatRuntime;
      const remainingHits = runtime.damageEvents.filter(
        event => event.actionId === 'verified-han-projectile-a3'
      );
      expect(remainingHits).toHaveLength(2);
      expect(remainingHits.map(event => event.timeMs)).toEqual(
        baselineHits
          .filter((_, hitIndex) => hitIndex !== index)
          .map(event => event.timeMs)
      );
      expect(
        runtime.actionResolutionById.get('verified-han-projectile-a3')
          .disabledHitIdentities
      ).toEqual([hit.hitIdentity]);
    }
  });

  it('settles all seven Ruby Star Skill hits and removes only a disabled hit', () => {
    const baseline = simulateRubyStarSkill();
    const baselineRuntime = baseline.verifiedCombatRuntime;
    const resolution = baselineRuntime.actionResolutionById.get(
      'verified-ruby-star-skill'
    );
    const baselineHits = baselineRuntime.damageEvents.filter(
      event =>
        event.actionId === 'verified-ruby-star-skill' &&
        event.type === 'VERIFIED_COMBAT_HIT'
    );

    expect(resolution.allHits).toHaveLength(7);
    expect(
      baselineHits.map(event => Math.round((event.timeMs * 60) / 1000))
    ).toEqual([37, 44, 49, 54, 59, 64, 69]);
    expect(
      baselineHits.every(
        event =>
          event.payload.rawDamage > 0 && event.payload.toughnessDamage > 0
      )
    ).toBe(true);
    expect(
      baselineRuntime.resourceEvents.filter(
        event =>
          event.actionId === 'verified-ruby-star-skill' &&
          event.payload.reason.includes('hit-sp')
      ).length
    ).toBeGreaterThan(0);
    expect(
      baselineRuntime.kiboResourceEvents.filter(
        event =>
          event.actionId === 'verified-ruby-star-skill' &&
          event.payload.reason.includes('hit-pet-sp')
      ).length
    ).toBeGreaterThan(0);

    const disabledHit = resolution.allHits[0];
    const disabled = simulateRubyStarSkill({
      [disabledHit.hitIdentity]: { willHit: false },
    });
    const disabledRuntime = disabled.verifiedCombatRuntime;
    const remainingHits = disabledRuntime.damageEvents.filter(
      event =>
        event.actionId === 'verified-ruby-star-skill' &&
        event.type === 'VERIFIED_COMBAT_HIT'
    );
    expect(
      remainingHits.map(event => Math.round((event.timeMs * 60) / 1000))
    ).toEqual([44, 49, 54, 59, 64, 69]);
    expect(
      disabledRuntime.actionResolutionById.get('verified-ruby-star-skill')
        .disabledHitIdentities
    ).toEqual([disabledHit.hitIdentity]);
    expect(disabledRuntime.finalState.enemy.hp).toBeGreaterThan(
      baselineRuntime.finalState.enemy.hp
    );
    expect(disabledRuntime.finalState.enemy.toughness).toBeGreaterThan(
      baselineRuntime.finalState.enemy.toughness
    );
    expect(
      disabled.verifiedCombatRuntime.specialResourceRuntime.resourceEvents.find(
        event => event.actionId === 'verified-ruby-star-skill'
      )
    ).toMatchObject({
      timeMs: 0,
      payload: { beforeValue: 0, afterValue: 12 },
    });
    expect(
      disabled.verifiedTuningMarkGeneration.events.find(
        event =>
          event.actionId === 'verified-ruby-star-skill' &&
          event.kind === 'acquire'
      )
    ).toMatchObject({ timeMs: 0, profileKey: 'fire', before: 0, after: 1 });

    expect(
      simulateRubyStarSkill(
        {},
        6
      ).verifiedCombatRuntime.specialResourceRuntime.resourceEvents.find(
        event => event.actionId === 'verified-ruby-star-skill'
      )
    ).toMatchObject({
      timeMs: 0,
      payload: { beforeValue: 6, afterValue: 12 },
    });
  });

  it('settles Xiaoyu normal A3 and A4 from their own projectile chains', () => {
    expect(
      XIAOYU_CONTROL_BINDING_BY_ID.get(10101003).hits.map(hit => ({
        elementId: hit.elementId,
        frame: hit.trigger.impactFrame,
        weakBreak: hit.damage.weakBreakDamageRateBasisPoints,
        recoverSp: hit.energy.recoverSp,
        petRecoverSp: hit.energy.petRecoverSp,
      }))
    ).toEqual([
      {
        elementId: 101010091,
        frame: 18,
        weakBreak: 7000,
        recoverSp: 1599,
        petRecoverSp: 6100,
      },
    ]);
    expect(
      XIAOYU_CONTROL_BINDING_BY_ID.get(10101004)
        .hits.filter(hit => hit.mapIndex === 0)
        .map(hit => ({
          elementId: hit.elementId,
          frame: hit.trigger.impactFrame,
          weakBreak: hit.damage.weakBreakDamageRateBasisPoints,
          recoverSp: hit.energy.recoverSp,
          petRecoverSp: hit.energy.petRecoverSp,
        }))
    ).toEqual(
      [10, 14, 18, 22].map(frame => ({
        elementId: 101010107,
        frame,
        weakBreak: 7000,
        recoverSp: 2500,
        petRecoverSp: 9800,
      }))
    );
    expect(
      XIAOYU_CONTROL_BINDING_BY_ID.get(10101004).hits.filter(
        hit => hit.mapIndex === 1
      )
    ).toHaveLength(12);

    const baseline = simulateXiaoyuRepairScenario({
      actions: [
        createXiaoyuAttackInputAction('xiaoyu-normal-a3', XIAOYU_A3_INPUT, 0),
        createXiaoyuAttackInputAction(
          'xiaoyu-normal-a4',
          XIAOYU_A4_INPUT,
          frameTimeMs(60)
        ),
      ],
    });
    expectXiaoyuHitSettlement(baseline, 'xiaoyu-normal-a3', {
      frames: [18],
      actorRecovery: [0.159897],
      kiboRecovery: [0.609985],
    });
    expectXiaoyuHitSettlement(baseline, 'xiaoyu-normal-a4', {
      frames: [70, 74, 78, 82],
      actorRecovery: [0.25, 0.25, 0.25, 0.25],
      kiboRecovery: [0.979996, 0.979996, 0.979996, 0.979996],
    });

    const disabledIdentity = XIAOYU_CONTROL_BINDING_BY_ID.get(
      10101004
    ).hits.find(
      hit => hit.mapIndex === 0 && hit.trigger.impactFrame === 18
    ).hitIdentity;
    const disabled = simulateXiaoyuRepairScenario({
      actions: [
        createXiaoyuAttackInputAction(
          'xiaoyu-normal-a4-disabled',
          XIAOYU_A4_INPUT,
          0,
          { [disabledIdentity]: { willHit: false } }
        ),
      ],
    });
    expectXiaoyuHitSettlement(disabled, 'xiaoyu-normal-a4-disabled', {
      frames: [10, 14, 22],
      actorRecovery: [0.25, 0.25, 0.25],
      kiboRecovery: [0.979996, 0.979996, 0.979996],
    });
  });

  it('keeps Xiaoyu star-carry occupancy at 95F while its terminal hit settles at 109F', () => {
    const baseline = simulateXiaoyuStarCarry();
    const actionId = xiaoyuStarCarryActionId('switch-to-xiaoyu');
    const derivedAction =
      baseline.effectiveActionTimeline.scenario.actions.find(
        action => action.id === actionId
      );
    expect(derivedAction).toMatchObject({
      durationFrames: 95,
      parentActionId: 'switch-to-xiaoyu',
      readOnly: true,
    });
    expectXiaoyuHitSettlement(baseline, actionId, {
      frames: [115, 169],
      actorRecovery: [],
      kiboRecovery: [],
    });
    expect(
      baseline.actionExecutionPlan.actions.find(
        item => item.actionId === 'xiaoyu-after-star-carry'
      )?.execute
    ).toBe(true);
    expect(
      baseline.verifiedTuningMarkGeneration.events.filter(
        event => event.actionId === actionId && event.kind === 'consume'
      )
    ).toHaveLength(1);
    expect(
      baseline.effectTimeline.events.filter(
        event =>
          event.actionId === actionId &&
          event.effectId === 'battle-element:101010206' &&
          event.after
      )
    ).toHaveLength(1);

    const [firstHit, terminalHit] =
      XIAOYU_CONTROL_BINDING_BY_ID.get(10101021).hits;
    const withoutTerminal = simulateXiaoyuStarCarry({
      [terminalHit.hitIdentity]: { willHit: false },
    });
    expectXiaoyuHitSettlement(withoutTerminal, actionId, {
      frames: [115],
      actorRecovery: [],
      kiboRecovery: [],
    });
    expect(
      withoutTerminal.verifiedTuningMarkGeneration.events.filter(
        event => event.actionId === actionId && event.kind === 'consume'
      )
    ).toEqual([]);

    const withoutFirst = simulateXiaoyuStarCarry({
      [firstHit.hitIdentity]: { willHit: false },
    });
    expectXiaoyuHitSettlement(withoutFirst, actionId, {
      frames: [169],
      actorRecovery: [],
      kiboRecovery: [],
    });
    expect(
      withoutFirst.verifiedTuningMarkGeneration.events.filter(
        event => event.actionId === actionId && event.kind === 'consume'
      )
    ).toHaveLength(1);
  });

  it('requires a successful-parry event before Xiaoyu perfect-parry can settle', () => {
    const accepted = simulateXiaoyuPerfectParry({ includePrerequisite: true });
    expectXiaoyuHitSettlement(accepted, 'xiaoyu-perfect-parry', {
      frames: [91, 156],
      actorRecovery: [0.179474, 0.169998],
      kiboRecovery: [0.686127, 0.649887],
    });
    expect(
      accepted.verifiedTuningMarkGeneration.events.filter(
        event =>
          event.actionId === 'xiaoyu-perfect-parry' && event.kind === 'consume'
      )
    ).toHaveLength(1);
    expect(
      accepted.effectTimeline.events.filter(
        event =>
          event.actionId === 'xiaoyu-perfect-parry' &&
          event.effectId === 'battle-element:101010206' &&
          event.after
      )
    ).toHaveLength(1);

    const rejected = simulateXiaoyuPerfectParry({
      includePrerequisite: false,
    });
    expect(
      rejected.verifiedCombatRuntime.damageEvents.filter(
        event => event.actionId === 'xiaoyu-perfect-parry'
      )
    ).toEqual([]);
    expect(
      rejected.actionExecutionPlan.actions.find(
        item => item.actionId === 'xiaoyu-perfect-parry'
      )
    ).toEqual(
      expect.objectContaining({
        execute: false,
      })
    );
    expect(rejected.verifiedCombatRuntime.executionBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'xiaoyu-perfect-parry',
          reason: 'verified-action-execution-prerequisite-missing',
        }),
      ])
    );
  });

  it('grants exactly two wind marks in the same 95 to 100 threshold transaction after replay', () => {
    const action = createWorkbenchActionDraft({
      id: 'xiaoyu-threshold-charged',
      type: 'skill',
      actorCharacterId: XIAOYU_CHARACTER_ID,
      skillId: XIAOYU_NORMAL_SKILL_ID,
      actionVariantIndex: 2,
      startMs: 0,
      durationMs: frameTimeMs(75),
      durationFrames: 75,
    });
    const project = createXiaoyuRepairProject({
      actions: [action],
      specialResourceValue: 95,
    });
    const simulations = [
      simulateScenario(compileProject(project, getWorkbenchGameData())),
      simulateScenario(
        compileProject(
          JSON.parse(JSON.stringify(project)),
          getWorkbenchGameData()
        )
      ),
    ];

    for (const result of simulations) {
      const thresholdFrameMs = frameTimeMs(43);
      expect(
        result.verifiedActionVariantRuntime.resourceEvents
          .filter(event => Math.round(event.timeMs * 60 * 0.001) === 43)
          .map(event => [
            event.payload.operation,
            event.payload.beforeValue,
            event.payload.afterValue,
          ])
      ).toEqual([
        ['gain', 95, 100],
        ['threshold-clear', 100, 0],
        ['transform', 0, 0],
      ]);
      const windAcquire = result.verifiedTuningMarkGeneration.events.filter(
        event =>
          event.actionId === action.id &&
          event.kind === 'acquire' &&
          event.profileKey === 'wind'
      );
      expect(windAcquire).toHaveLength(1);
      expect(windAcquire[0]).toMatchObject({
        before: 0,
        delta: 2,
        after: 2,
      });
      expect(windAcquire[0].timeMs).toBeCloseTo(thresholdFrameMs, 5);
    }
  });

  it('moves and removes only the selected normal attack input and its hit nodes', () => {
    const mapping = verifiedCombatMechanicsPackage.actionMappings.find(
      item => item.ownerId === 102001 && item.actionKind === 'normal-attack'
    );
    let idIndex = 0;
    const chain = createWorkbenchAttackInputChainDrafts({
      entry: mapping,
      actorCharacterId: 102001,
      skillId: mapping.sourceSkillId,
      level: 1,
      startMs: 0,
      createActionId: () => `lili-a${++idIndex}`,
    }).slice(0, 3);
    const baseline = simulateAttackInputChain(chain);
    const baselineTimes = damageTimesByAction(baseline, chain);

    expect(baselineTimes['lili-a1']).toHaveLength(3);
    expect(baselineTimes['lili-a2']).toHaveLength(4);
    expect(baselineTimes['lili-a3']).toHaveLength(6);

    const movedStartMs = chain[2].startMs + chain[2].durationMs + 1000;
    const moved = simulateAttackInputChain(
      chain.map(action =>
        action.id === 'lili-a2' ? { ...action, startMs: movedStartMs } : action
      )
    );
    const movedTimes = damageTimesByAction(moved, chain);
    expect(movedTimes['lili-a1']).toEqual(baselineTimes['lili-a1']);
    expect(movedTimes['lili-a3']).toEqual(baselineTimes['lili-a3']);
    expect(movedTimes['lili-a2']).not.toEqual(baselineTimes['lili-a2']);

    const deleted = simulateAttackInputChain(
      chain.filter(action => action.id !== 'lili-a3')
    );
    const deletedTimes = damageTimesByAction(deleted, chain);
    expect(deletedTimes['lili-a1']).toEqual(baselineTimes['lili-a1']);
    expect(deletedTimes['lili-a2']).toEqual(baselineTimes['lili-a2']);
    expect(deletedTimes['lili-a3']).toEqual([]);
  });

  it('does not emit verified damage or resource state for a cooldown-blocked action', () => {
    const result = simulateVerifiedAcceptanceScenario({
      includeBlockedRepeat: true,
    });
    const blocked = result.actionExecutionPlan.actions.find(
      action => action.actionId === 'verified-heavy-rock-hoof-blocked'
    );

    expect(blocked?.execute).toBe(false);
    expect(
      result.verifiedCombatRuntime.eventLog.some(
        event => event.actionId === 'verified-heavy-rock-hoof-blocked'
      )
    ).toBe(false);
    expect(
      result.runtimeOutputs.simLog.some(
        event => event.actionId === 'verified-heavy-rock-hoof-blocked'
      )
    ).toBe(false);
  });

  it('uses fixed 0.1 second foreground/background recovery and enforces hit recovery intervals', () => {
    const result = simulateVerifiedAcceptanceScenario({
      includeSecondPangpang: true,
    });
    const firstTick = result.verifiedCombatRuntime.resourceEvents.filter(
      event => event.timeMs === 100
    );
    const secondHitRecovery =
      result.verifiedCombatRuntime.resourceEvents.filter(
        event => event.actionId === 'verified-pangpang-normal-second'
      );

    expect(firstTick).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-109001',
          payload: expect.objectContaining({
            reason: 'verified-auto-sp-foreground',
            change: 0.020828,
          }),
        }),
        expect.objectContaining({
          actorId: 'actor-101003',
          payload: expect.objectContaining({
            reason: 'verified-auto-sp-background',
            change: 0.010406,
          }),
        }),
      ])
    );
    expect(
      result.verifiedCombatRuntime.damageEvents.filter(event =>
        event.actionId?.startsWith('verified-pangpang-normal')
      )
    ).toHaveLength(2);
    expect(secondHitRecovery).toEqual([]);
    expect(
      result.verifiedCombatRuntime.kiboResourceEvents.filter(
        event => event.actionId === 'verified-pangpang-normal-second'
      )
    ).toEqual([]);
  });

  it('integrates exact 0.1 second ticks, switches foreground at the boundary, and clamps at full', () => {
    const oneSecond = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: false,
      durationMs: 1000,
    });
    expect(oneSecond.verifiedCombatRuntime.finalState.actorEnergy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-109001',
          currentValue: 0.208282,
          maxValue: 100,
          valueUnit: 'absolute-sp-points',
        }),
        expect.objectContaining({
          actorId: 'actor-101003',
          currentValue: 0.104065,
        }),
      ])
    );

    const thirtySeconds = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: false,
      durationMs: 30000,
    });
    expect(
      thirtySeconds.verifiedCombatRuntime.finalState.actorEnergy.find(
        entry => entry.actorId === 'actor-109001'
      )
    ).toMatchObject({
      currentValue: 6.248474,
      maxValue: 100,
      valueUnit: 'absolute-sp-points',
    });

    const switched = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: false,
      durationMs: 1000,
      switchAtMs: 500,
    });
    const eventsAtBoundary =
      switched.verifiedCombatRuntime.resourceEvents.filter(
        event => event.timeMs === 500
      );
    expect(eventsAtBoundary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-109001',
          payload: expect.objectContaining({
            reason: 'verified-auto-sp-background',
            change: 0.010406,
          }),
        }),
        expect.objectContaining({
          actorId: 'actor-101003',
          payload: expect.objectContaining({
            reason: 'verified-auto-sp-foreground',
            change: 0.020828,
          }),
        }),
      ])
    );
    expect(switched.verifiedCombatRuntime.finalState.actorEnergy).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-109001',
          currentValue: 0.145752,
        }),
        expect.objectContaining({
          actorId: 'actor-101003',
          currentValue: 0.166595,
        }),
      ])
    );

    const filled = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: false,
      durationMs: 200,
      initialSpByCharacterId: { 109001: 99.99 },
    });
    const fullEvent = filled.verifiedCombatRuntime.resourceEvents.find(
      event => event.actorId === 'actor-109001' && event.timeMs === 100
    );
    expect(fullEvent?.payload).toMatchObject({
      beforeValue: 99.99,
      change: 0.01,
      afterValue: 100,
      currentValue: 100,
      maxValue: 100,
      valueUnit: 'absolute-sp-points',
    });
    expect(
      filled.verifiedCombatRuntime.resourceEvents.some(
        event => event.actorId === 'actor-109001' && event.timeMs === 200
      )
    ).toBe(false);
  });

  it('uses source SP attributes and one DamageElement interval for Pangpang hit recovery', () => {
    const result = simulateVerifiedAcceptanceScenario({ includeKibo: false });
    const hitEvents = result.verifiedCombatRuntime.resourceEvents.filter(
      event =>
        event.actionId === 'verified-pangpang-normal' &&
        event.payload.reason.includes('verified-hit-sp')
    );

    expect(hitEvents).toHaveLength(3);
    expect(hitEvents.find(event => event.actorId === 'actor-101007')).toEqual(
      expect.objectContaining({
        hitKey: 'verified-hit-1-101007012',
        payload: expect.objectContaining({
          beforeValue: 0.020813,
          change: 1.069992,
          afterValue: 1.090805,
          maxValue: 100,
          recoverIntervalIdentity: 'damage-element:-9212100609153088879',
          share: 1,
          resourceOwnerSourceIdentity: expect.stringContaining(
            'verified-static-actor:101007'
          ),
          formula: expect.objectContaining({
            raw: '70123',
            value: 1.0699920654296875,
          }),
        }),
      })
    );
    expect(
      hitEvents
        .filter(event => event.actorId !== 'actor-101007')
        .every(event => event.payload.share === 0.5)
    ).toBe(true);
    const kiboHitEvents =
      result.verifiedCombatRuntime.kiboResourceEvents.filter(
        event => event.actionId === 'verified-pangpang-normal'
      );
    expect(kiboHitEvents).toHaveLength(1);
    expect(
      kiboHitEvents.find(event => event.payload.slotId === 'team-slot-3')
    ).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          beforeValue: 0.041656,
          change: 4.159897,
          afterValue: 4.201553,
          maxValue: 100,
          share: 1,
          recoverIntervalIdentity: 'damage-element:-9212100609153088879',
          formula: expect.objectContaining({
            raw: '272623',
            value: 4.1598968505859375,
            trace: expect.arrayContaining([
              expect.objectContaining({
                name: 'pet_recover_sp',
                raw: '272623',
                configValue: 41599,
              }),
            ]),
          }),
        }),
      })
    );
  });

  it('deducts Heavy Rock Hoof from 100 to 0 before same-frame recovery and blocks 99 SP execution', () => {
    const full = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: true,
      durationMs: 1000,
      kiboStartMs: 100,
      initialRuntimeState: {
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-3',
            kiboId: HEAVY_ROCK_HOOF_ID,
            currentValue: 100,
            maxValue: 100,
          },
        ],
      },
    });
    const sameFrame = full.verifiedCombatRuntime.kiboResourceEvents.filter(
      event => event.payload.slotId === 'team-slot-3' && event.timeMs === 100
    );
    expect(sameFrame[0]).toMatchObject({
      actionId: 'verified-heavy-rock-hoof',
      hitKey: 'action-cost',
      payload: {
        reason: 'verified-skill-cost',
        beforeValue: 100,
        change: -100,
        afterValue: 0,
        currentValue: 0,
        maxValue: 100,
        valueUnit: 'absolute-sp-points',
      },
    });
    expect(sameFrame[1]).toMatchObject({
      actionId: null,
      payload: {
        reason: 'verified-auto-sp-background',
        beforeValue: 0,
      },
    });
    expect(sameFrame[0].runtimeSequenceIndex).toBeLessThan(
      sameFrame[1].runtimeSequenceIndex
    );
    const curvePoints = full.runtimeOutputs.resourceCurves.curvesByKibo
      .find(curve => curve.slotId === 'team-slot-3')
      .points.filter(point => point.timeMs === 100);
    expect(curvePoints.map(point => point.reason)).toEqual([
      'verified-skill-cost',
      'verified-auto-sp-background',
    ]);
    expect(curvePoints[0].stateSnapshot).toMatchObject({
      before: { kiboEnergy: { currentValue: 100 } },
      after: { kiboEnergy: { currentValue: 0 } },
    });

    const insufficient = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: true,
      durationMs: 1000,
      kiboStartMs: 100,
      initialRuntimeState: {
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-3',
            kiboId: HEAVY_ROCK_HOOF_ID,
            currentValue: 99,
            maxValue: 100,
          },
        ],
      },
    });
    expect(
      insufficient.actionExecutionPlan.actions.find(
        action => action.actionId === 'verified-heavy-rock-hoof'
      )
    ).toMatchObject({
      execute: false,
      violationCodes: ['verified-resource-cost-unavailable'],
    });
    expect(insufficient.verifiedCombatRuntime.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: 'verified-heavy-rock-hoof',
        reason: 'verified-kibo-resource-insufficient',
        requiredValue: 100,
        currentValue: 99,
        maxValue: 100,
        valueUnit: 'absolute-sp-points',
      }),
    ]);
    expect(
      insufficient.verifiedCombatRuntime.damageEvents.some(
        event => event.actionId === 'verified-heavy-rock-hoof'
      )
    ).toBe(false);
    expect(
      insufficient.actionRuleDiagnostics.readinessTimeline.cooldownWindows.some(
        window => window.actionId === 'verified-heavy-rock-hoof'
      )
    ).toBe(false);
    expect(
      insufficient.effectTimeline.events.some(
        event => event.actionId === 'verified-heavy-rock-hoof'
      )
    ).toBe(false);
  });

  it('uses a configured 50 SP kibo baseline for recovery and cost readiness', () => {
    const initialRuntimeState = {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-3',
          kiboId: HEAVY_ROCK_HOOF_ID,
          currentValue: 50,
          maxValue: 100,
        },
      ],
    };
    const recovery = simulateVerifiedAcceptanceScenario({
      includeActor: true,
      includeKibo: false,
      durationMs: 1000,
      initialRuntimeState,
    });
    expect(
      recovery.verifiedCombatRuntime.initialState.kiboEnergy.find(
        state => state.slotId === 'team-slot-3'
      )
    ).toMatchObject({
      currentValue: 50,
      maxValue: 100,
    });
    expect(
      recovery.verifiedCombatRuntime.kiboResourceEvents.find(
        event => event.actionId === 'verified-pangpang-normal'
      )
    ).toMatchObject({
      payload: {
        beforeValue: 50.041656,
        change: 4.159897,
        afterValue: 54.201553,
        maxValue: 100,
      },
    });

    const blockedCost = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: true,
      durationMs: 1000,
      kiboStartMs: 100,
      initialRuntimeState,
    });
    expect(blockedCost.verifiedCombatRuntime.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: 'verified-heavy-rock-hoof',
        reason: 'verified-kibo-resource-insufficient',
        requiredValue: 100,
        currentValue: 50,
        maxValue: 100,
      }),
    ]);
    expect(
      blockedCost.verifiedCombatRuntime.kiboResourceEvents.some(
        event =>
          event.actionId === 'verified-heavy-rock-hoof' &&
          event.payload.reason === 'verified-skill-cost'
      )
    ).toBe(false);
  });

  it('uses the same 100-point contract for actor ultimate readiness and diagnostics', () => {
    const full = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeActorUltimate: true,
      includeKibo: false,
      durationMs: 500,
      initialSpByCharacterId: { 109001: 100 },
    });
    const cost = full.verifiedCombatRuntime.resourceEvents.find(
      event =>
        event.actionId === 'verified-muyin-ultimate' &&
        event.payload.reason === 'verified-skill-cost'
    );
    expect(cost?.payload).toMatchObject({
      beforeValue: 100,
      change: -100,
      afterValue: 0,
      maxValue: 100,
      valueUnit: 'absolute-sp-points',
    });
    expect(
      full.actionRuleDiagnostics.diagnostics.some(
        diagnostic => diagnostic.code === 'skill-sp-precondition-unresolved'
      )
    ).toBe(false);
    expect(JSON.stringify(full.actionRuleDiagnostics)).not.toContain('0-1');

    const insufficient = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeActorUltimate: true,
      includeKibo: false,
      durationMs: 500,
      initialSpByCharacterId: { 109001: 99 },
    });
    expect(insufficient.verifiedCombatRuntime.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: 'verified-muyin-ultimate',
        ownerKind: 'actor',
        requiredValue: 100,
        currentValue: 99,
        maxValue: 100,
      }),
    ]);
    expect(insufficient.actionRuleDiagnostics.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'verified-resource-cost-unavailable',
          message: '星决技 需要 SP 100，当前 99/100，动作未执行',
        }),
      ])
    );
  });

  it('keeps auto and landed-hit recovery in the non-damage execution projection without sampling or damage', () => {
    const autoFunded = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeActorUltimate: true,
      includeKibo: false,
      durationMs: 1000,
      actorUltimateStartMs: 200,
      initialSpByCharacterId: { 109001: 99.99 },
    });
    const autoProjection = createNonDamageExecutionProjection(autoFunded);
    expect(
      autoProjection.resourceEvents.find(
        event =>
          event.actionId === 'verified-muyin-ultimate' &&
          event.payload.reason === 'verified-skill-cost'
      )?.payload
    ).toMatchObject({ beforeValue: 100, change: -100, afterValue: 0 });
    expect(
      autoProjection.resourceEvents.some(
        event => event.payload.reason === 'verified-auto-sp-background'
      )
    ).toBe(true);

    const hitFunded = simulateVerifiedAcceptanceScenario({
      includeActor: true,
      includeActorUltimate: true,
      includeKibo: false,
      durationMs: 1200,
      actorUltimateStartMs: 300,
      initialSpByCharacterId: { 109001: 99.45 },
    });
    let randomSampleCount = 0;
    const sampledProjectionScenario = structuredClone(
      hitFunded.effectiveActionTimeline.scenario
    );
    sampledProjectionScenario.combatScenario = {
      ...(sampledProjectionScenario.combatScenario ?? {}),
      critical: {
        policy: 'sampled',
        seed: 'projection-must-not-consume',
      },
    };
    const hitProjection = createNonDamageExecutionProjection(hitFunded, {
      scenario: sampledProjectionScenario,
      criticalRandomSource: {
        algorithm: 'test-counting-source',
        seed: 'projection-must-not-consume',
        nextSample() {
          randomSampleCount += 1;
          return { value: 0, streamIndex: randomSampleCount - 1 };
        },
      },
    });
    expect(
      hitProjection.resourceEvents.some(
        event =>
          event.actionId === 'verified-pangpang-normal' &&
          event.actorId === 'actor-109001' &&
          event.payload.reason === 'verified-hit-sp-shared-recovery'
      )
    ).toBe(true);
    expect(
      hitProjection.resourceEvents.find(
        event =>
          event.actionId === 'verified-muyin-ultimate' &&
          event.payload.reason === 'verified-skill-cost'
      )?.payload.afterValue
    ).toBeCloseTo(0, 6);
    expect(hitProjection.damageEvents).toEqual([]);
    expect(randomSampleCount).toBe(0);

    const kiboFunded = simulateVerifiedAcceptanceScenario({
      includeActor: true,
      includeKibo: true,
      durationMs: 3800,
      kiboStartMs: 300,
      initialRuntimeState: {
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-3',
            kiboId: HEAVY_ROCK_HOOF_ID,
            currentValue: 96,
            maxValue: 100,
          },
        ],
      },
    });
    const kiboProjection = createNonDamageExecutionProjection(kiboFunded);
    expect(
      kiboProjection.kiboResourceEvents.some(
        event =>
          event.actionId === 'verified-pangpang-normal' &&
          event.payload.reason === 'verified-hit-pet-sp-shared-recovery'
      )
    ).toBe(true);
    expect(
      kiboProjection.kiboResourceEvents.find(
        event =>
          event.actionId === 'verified-heavy-rock-hoof' &&
          event.payload.reason === 'verified-skill-cost'
      )?.payload.afterValue
    ).toBeCloseTo(0, 6);
    expect(kiboProjection.damageEvents).toEqual([]);
  });

  it('settles a verified landed-hit recovery in both runtimes when damage inputs are unresolved', () => {
    const prepared = simulatePangpangHitRecoveryParityScenario();
    const scenario = structuredClone(prepared.effectiveActionTimeline.scenario);
    scenario.enemy = {
      ...scenario.enemy,
      id: 999999999,
      enemyId: 999999999,
    };
    const ultimateAction = scenario.actions.find(
      action => action.id === 'pangpang-recovery-parity-ultimate'
    );
    const ultimateResolution =
      prepared.verifiedActionVariantRuntime.actionResolutionById.get(
        ultimateAction.id
      );
    const commonArguments = {
      scenario,
      actionExecutionPlan: prepared.actionExecutionPlan,
      controlledActorTimeline: prepared.controlledActorTimeline,
      effectGeneration: {
        ...prepared.verifiedBattleEffectGeneration,
        directHpEvents: [
          createProjectionVitalFixture({
            action: ultimateAction,
            resolution: ultimateResolution,
            timeMs: 1100,
          }),
        ],
      },
      tuningGeneration: prepared.verifiedTuningMarkGeneration,
      damageEventGeneration: prepared.verifiedDamageEventGeneration,
      effectTimeline: prepared.effectTimeline,
      actionVariantRuntime: prepared.verifiedActionVariantRuntime,
      kiboPassiveGeneration: prepared.verifiedKiboPassiveGeneration,
    };
    const full = createVerifiedCombatRuntime(commonArguments);
    const projection = createVerifiedCombatRuntime({
      ...commonArguments,
      runtimeMode: 'non-damage-event-projection',
    });

    for (const runtime of [full, projection]) {
      const recovery = runtime.resourceEvents.find(
          event =>
            event.actionId === 'pangpang-recovery-parity-normal' &&
            event.actorId === `actor-${PANGPANG_CHARACTER_ID}` &&
            event.payload.reason === 'verified-hit-sp-recovery'
        )?.payload;
      expect(recovery).toMatchObject({ afterValue: 100 });
      expect(recovery.beforeValue).toBeGreaterThanOrEqual(99);
      expect(recovery.beforeValue).toBeLessThan(100);
      expect(
        runtime.resourceEvents.find(
          event =>
            event.actionId === ultimateAction.id &&
            event.payload.reason === 'verified-skill-cost'
        )?.payload
      ).toMatchObject({ beforeValue: 100, change: -100, afterValue: 0 });
      expect(runtime.executionBlocks).toEqual([]);
      expect(
        runtime.vitalEvents.filter(
          event => event.actionId === ultimateAction.id
        )
      ).toHaveLength(1);
    }
    expect(full.eventLog).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'VERIFIED_COMBAT_HIT_UNRESOLVED',
          actionId: 'pangpang-recovery-parity-normal',
          payload: expect.objectContaining({
            ready: false,
            applied: false,
            reason: 'verified-enemy-break-profile-missing',
          }),
        }),
      ])
    );
    expect(
      full.damageEvents.some(
        event =>
          event.type === 'VERIFIED_COMBAT_HIT' &&
          event.actionId === 'pangpang-recovery-parity-normal'
      )
    ).toBe(false);
    expect(
      full.resourceEvents.find(
        event =>
          event.actionId === 'pangpang-recovery-parity-normal' &&
          event.actorId === `actor-${PANGPANG_CHARACTER_ID}` &&
          event.payload.reason === 'verified-hit-sp-recovery'
      )?.payload
    ).toMatchObject({
      resourceSettlement: {
        status: 'applied',
        basis: 'verified-landed-hit-recovery-transaction',
      },
      damageSettlement: {
        status: 'unresolved',
        reason: 'verified-enemy-break-profile-missing',
      },
    });
    expect(
      projection.resourceEvents.find(
        event =>
          event.actionId === 'pangpang-recovery-parity-normal' &&
          event.actorId === `actor-${PANGPANG_CHARACTER_ID}` &&
          event.payload.reason === 'verified-hit-sp-recovery'
      )?.payload.damageSettlement
    ).toEqual({
      status: 'not-evaluated-in-non-damage-projection',
      reason: null,
    });
    expect(projection.damageEvents).toEqual([]);
  });

  it('keeps hit-recovery eligibility identical across unresolved inputs and fail-closed boundaries', () => {
    const cases = [
      {
        label: 'actor damage source missing',
        expectRecovery: true,
        expectedDamageReason: 'verified-actor-panel-attack-missing',
        mutateScenario(scenario) {
          const stripAttack = actor => {
            actor.verifiedStaticProperties = {
              ready: false,
              status: 'fixture-static-source-missing',
              attributes: [],
            };
            actor.baseAttributes = (actor.baseAttributes ?? []).filter(
              attribute => attribute.key !== 'ATK'
            );
            actor.stats = { ...(actor.stats ?? {}), attack: null };
          };
          stripAttack(
            scenario.actors.find(
              actor => Number(actor.characterId) === PANGPANG_CHARACTER_ID
            )
          );
          stripAttack(
            scenario.actions.find(
              action => action.id === 'pangpang-recovery-parity-normal'
            ).actor
          );
        },
      },
      {
        label: 'hit ratio missing',
        expectRecovery: true,
        expectedDamageReason: 'verified-hit-ratio-missing',
        mutateResolution(resolution) {
          resolution.hits[0].formula = {
            ...resolution.hits[0].formula,
            ratiosByLevel: {},
          };
        },
      },
      {
        label: 'enemy defense missing',
        expectRecovery: true,
        expectedDamageReason: 'verified-enemy-defense-inputs-missing',
        mutateScenario(scenario) {
          scenario.enemy.stats = {
            ...scenario.enemy.stats,
            physicalDefense: null,
            magicalDefense: null,
          };
        },
      },
      {
        label: 'kibo damage source missing',
        expectRecovery: false,
        expectedDamageReason: 'verified-kibo-base-attack-missing',
        mutateScenario(scenario) {
          const action = scenario.actions.find(
            entry => entry.id === 'pangpang-recovery-parity-normal'
          );
          action.kiboId = 999999999;
          action.actor.loadout = {
            ...(action.actor.loadout ?? {}),
            kiboId: 999999999,
          };
        },
        mutateResolution(resolution) {
          resolution.actionBinding = {
            ...resolution.actionBinding,
            ownerKind: 'kibo',
          };
          resolution.hits[0].energy = {
            ...resolution.hits[0].energy,
            recoverSp: 0,
          };
        },
      },
      {
        label: 'recovery source fields unresolved',
        expectRecovery: false,
        mutateResolution(resolution) {
          resolution.hits[0].energy = {
            ...resolution.hits[0].energy,
            recoverIntervalMs: null,
          };
        },
      },
      {
        label: 'landed transaction identity drift',
        expectRecovery: false,
        mutateDamageEventGeneration(generation) {
          generation.transactions[0].transactionIdentity =
            'damage|hit|drifted-action|drifted-hit';
        },
      },
      {
        label: 'missed hit transaction absent',
        expectRecovery: false,
        mutateDamageEventGeneration(generation) {
          generation.transactions = [];
        },
      },
      {
        label: 'source action execute false',
        expectRecovery: false,
        mutateExecutionPlan(plan) {
          plan.actions.find(
            entry => entry.actionId === 'pangpang-recovery-parity-normal'
          ).execute = false;
        },
      },
      {
        label: 'source action runtime blocked',
        expectRecovery: false,
        mutateActionVariantRuntime(runtime) {
          runtime.executionBlocks = [
            ...(runtime.executionBlocks ?? []),
            {
              actionId: 'pangpang-recovery-parity-normal',
              reason: 'fixture-runtime-blocked',
            },
          ];
        },
      },
    ];

    for (const entry of cases) {
      const { full, projection } = createPangpangHitRecoveryParityPair(entry);
      const fullRecovery = findPangpangParityRecovery(full);
      const projectionRecovery = findPangpangParityRecovery(projection);
      expect(Boolean(fullRecovery), entry.label).toBe(entry.expectRecovery);
      expect(Boolean(projectionRecovery), entry.label).toBe(
        entry.expectRecovery
      );
      expect(
        hasPangpangParityUltimateCost(full),
        `${entry.label}: full cost`
      ).toBe(entry.expectRecovery);
      expect(
        hasPangpangParityUltimateCost(projection),
        `${entry.label}: projection cost`
      ).toBe(entry.expectRecovery);
      expect(
        full.vitalEvents.some(
          event => event.actionId === 'pangpang-recovery-parity-ultimate'
        ),
        `${entry.label}: full vital`
      ).toBe(entry.expectRecovery);
      expect(
        projection.vitalEvents.some(
          event => event.actionId === 'pangpang-recovery-parity-ultimate'
        ),
        `${entry.label}: projection vital`
      ).toBe(entry.expectRecovery);
      expect(
        full.finalState.actorEnergy.find(
          actor => actor.actorId === `actor-${PANGPANG_CHARACTER_ID}`
        )?.currentValue,
        `${entry.label}: final actor energy`
      ).toBe(
        projection.finalState.actorEnergy.find(
          actor => actor.actorId === `actor-${PANGPANG_CHARACTER_ID}`
        )?.currentValue
      );
      if (entry.expectedDamageReason) {
        expect(
          full.eventLog.find(
            event =>
              event.type === 'VERIFIED_COMBAT_HIT_UNRESOLVED' &&
              event.actionId === 'pangpang-recovery-parity-normal'
          )?.payload.reason,
          `${entry.label}: damage diagnostic`
        ).toBe(entry.expectedDamageReason);
      }
    }
  });

  it('does not reinterpret the active actor timeline as native network authority', () => {
    const { full, projection } = createPangpangHitRecoveryParityPair({
      mutateControlledActorTimeline(timeline) {
        timeline.transitions = [
          {
            transitionId: 'fixture-switch-before-delayed-hit',
            actionId: 'fixture-switch-before-delayed-hit',
            timeMs: 1,
            frameIndex: 1,
            applied: true,
            beforeActor: timeline.initialActor,
            afterActor: {
              actorId: 'actor-101010',
              characterId: 101010,
              name: '涂山小玉',
            },
          },
        ];
      },
    });

    for (const runtime of [full, projection]) {
      expect(findPangpangParityRecovery(runtime)).toMatchObject({
        payload: {
          reason: 'verified-hit-sp-recovery',
          afterValue: 100,
        },
      });
    }
  });

  it('uses the same DamageElement recover interval in full and projected runtimes', () => {
    const prepared = simulateVerifiedAcceptanceScenario({
      includeActor: true,
      includeSecondPangpang: true,
      includeKibo: false,
      durationMs: 2500,
    });
    const full = prepared.verifiedCombatRuntime;
    const projection = createNonDamageExecutionProjection(prepared);
    const actorRecoveryActions = runtime =>
      runtime.resourceEvents
        .filter(
          event =>
            event.actorId === `actor-${PANGPANG_CHARACTER_ID}` &&
            event.payload.reason === 'verified-hit-sp-recovery'
        )
        .map(event => event.actionId);
    const kiboRecoveryActions = runtime =>
      runtime.kiboResourceEvents
        .filter(
          event =>
            event.payload.reason === 'verified-hit-pet-sp-shared-recovery'
        )
        .map(event => event.actionId);

    expect(actorRecoveryActions(full)).toEqual(['verified-pangpang-normal']);
    expect(actorRecoveryActions(projection)).toEqual(
      actorRecoveryActions(full)
    );
    expect(kiboRecoveryActions(projection)).toEqual(kiboRecoveryActions(full));
  });

  it('keeps direct and tuning SP transactions that fund later action costs in the projection', () => {
    const prepared = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeActorUltimate: true,
      includeKibo: false,
      durationMs: 2200,
      actorUltimateStartMs: 1000,
      initialSpByCharacterId: { 109001: 100 },
    });
    const scenario = structuredClone(prepared.effectiveActionTimeline.scenario);
    const sourceActor = scenario.actors.find(
      actor => Number(actor.characterId) === 109001
    );
    sourceActor.initialSp = 0;
    const action = scenario.actions.find(
      entry => entry.id === 'verified-muyin-ultimate'
    );
    const resolution =
      prepared.verifiedActionVariantRuntime.actionResolutionById.get(action.id);
    const commonArguments = {
      scenario,
      actionExecutionPlan: prepared.actionExecutionPlan,
      controlledActorTimeline: prepared.controlledActorTimeline,
      damageEventGeneration: prepared.verifiedDamageEventGeneration,
      effectTimeline: prepared.effectTimeline,
      actionVariantRuntime: prepared.verifiedActionVariantRuntime,
      kiboPassiveGeneration: prepared.verifiedKiboPassiveGeneration,
      runtimeMode: 'non-damage-event-projection',
    };
    const directProjection = createVerifiedCombatRuntime({
      ...commonArguments,
      effectGeneration: {
        ...prepared.verifiedBattleEffectGeneration,
        directSpEvents: [
          {
            eventIdentity: 'fixture:projection-direct-sp',
            timeMs: 500,
            action,
            actionId: action.id,
            actorId: sourceActor.id,
            target: { kind: 'actor', id: sourceActor.id },
            value: 100,
            effect: {
              elementId: 1,
              directSp: {
                enhanceable: false,
                shareType: 0,
                petShareType: 0,
                mainPetShareType: 0,
              },
            },
            resolution,
            sourceIdentity: 'fixture:projection-direct-sp',
            sourceSequencePath: createFixtureDirectEffectSourceSequencePath(
              action,
              500,
              0
            ),
            sourceSequenceStatus:
              'verified-direct-effect-source-sequence-ready',
            applied: true,
          },
        ],
      },
      tuningGeneration: prepared.verifiedTuningMarkGeneration,
    });
    expect(
      directProjection.resourceEvents.map(event => event.payload.reason)
    ).toEqual(
      expect.arrayContaining(['verified-direct-sp', 'verified-skill-cost'])
    );
    expect(directProjection.executionBlocks).toEqual([]);

    const tuningProjection = createVerifiedCombatRuntime({
      ...commonArguments,
      effectGeneration: {
        ...prepared.verifiedBattleEffectGeneration,
        directSpEvents: [],
      },
      tuningGeneration: {
        ...prepared.verifiedTuningMarkGeneration,
        combatEvents: [
          {
            kind: 'overlimit-direct-sp',
            eventIdentity: 'fixture:projection-overlimit-direct-sp',
            timeMs: 500,
            actorId: sourceActor.id,
            actionId: action.id,
            action,
            markCount: 1,
            template: { valuePerMark: 100 },
            eventContext: { landed: true },
            sourceIdentity: 'fixture:projection-overlimit-direct-sp',
          },
        ],
      },
    });
    expect(
      tuningProjection.resourceEvents.map(event => event.payload.reason)
    ).toEqual(
      expect.arrayContaining([
        'tuning-overlimit-direct-sp',
        'verified-skill-cost',
      ])
    );
    expect(tuningProjection.executionBlocks).toEqual([]);
    expect(tuningProjection.damageEvents).toEqual([]);
  });

  it('suppresses projected actor and kibo vital settlements when resources remain insufficient', () => {
    const actorPrepared = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeActorUltimate: true,
      includeKibo: false,
      durationMs: 1000,
      actorUltimateStartMs: 100,
      initialSpByCharacterId: { 109001: 100 },
    });
    const actorScenario = structuredClone(
      actorPrepared.effectiveActionTimeline.scenario
    );
    const actor = actorScenario.actors.find(
      entry => Number(entry.characterId) === 109001
    );
    actor.initialSp = 0;
    const actorAction = actorScenario.actions.find(
      entry => entry.id === 'verified-muyin-ultimate'
    );
    const actorProjection = createVerifiedCombatRuntime({
      scenario: actorScenario,
      actionExecutionPlan: actorPrepared.actionExecutionPlan,
      controlledActorTimeline: actorPrepared.controlledActorTimeline,
      effectGeneration: {
        ...actorPrepared.verifiedBattleEffectGeneration,
        directHpEvents: [
          createProjectionVitalFixture({
            action: actorAction,
            resolution:
              actorPrepared.verifiedActionVariantRuntime.actionResolutionById.get(
                actorAction.id
              ),
            timeMs: 200,
          }),
        ],
      },
      tuningGeneration: actorPrepared.verifiedTuningMarkGeneration,
      damageEventGeneration: actorPrepared.verifiedDamageEventGeneration,
      effectTimeline: actorPrepared.effectTimeline,
      actionVariantRuntime: actorPrepared.verifiedActionVariantRuntime,
      kiboPassiveGeneration: actorPrepared.verifiedKiboPassiveGeneration,
      runtimeMode: 'non-damage-event-projection',
    });
    expect(actorProjection.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: actorAction.id,
        reason: 'verified-actor-resource-insufficient',
        currentValue: 0,
        requiredValue: 100,
      }),
    ]);
    expect(actorProjection.vitalEvents).toEqual([]);

    const kiboPrepared = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: true,
      durationMs: 1200,
      kiboStartMs: 100,
      initialRuntimeState: {
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-3',
            kiboId: HEAVY_ROCK_HOOF_ID,
            currentValue: 100,
            maxValue: 100,
          },
        ],
      },
    });
    const kiboScenario = structuredClone(
      kiboPrepared.effectiveActionTimeline.scenario
    );
    kiboScenario.initialRuntimeState.kiboEnergyBySlot[0].currentValue = 99;
    const kiboAction = kiboScenario.actions.find(
      entry => entry.id === 'verified-heavy-rock-hoof'
    );
    const kiboProjection = createVerifiedCombatRuntime({
      scenario: kiboScenario,
      actionExecutionPlan: kiboPrepared.actionExecutionPlan,
      controlledActorTimeline: kiboPrepared.controlledActorTimeline,
      effectGeneration: {
        ...kiboPrepared.verifiedBattleEffectGeneration,
        directHpEvents: [
          createProjectionVitalFixture({
            action: kiboAction,
            resolution:
              kiboPrepared.verifiedActionVariantRuntime.actionResolutionById.get(
                kiboAction.id
              ),
            timeMs: 200,
          }),
        ],
      },
      tuningGeneration: kiboPrepared.verifiedTuningMarkGeneration,
      damageEventGeneration: kiboPrepared.verifiedDamageEventGeneration,
      effectTimeline: kiboPrepared.effectTimeline,
      actionVariantRuntime: kiboPrepared.verifiedActionVariantRuntime,
      kiboPassiveGeneration: kiboPrepared.verifiedKiboPassiveGeneration,
      runtimeMode: 'non-damage-event-projection',
    });
    expect(kiboProjection.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: kiboAction.id,
        reason: 'verified-kibo-resource-insufficient',
        currentValue: 99,
        requiredValue: 100,
      }),
    ]);
    expect(kiboProjection.vitalEvents).toEqual([]);
  });

  it('applies matching shields and enters Break without enabling useOneBreak', () => {
    const shielded = simulateVerifiedAcceptanceScenario({
      includeKibo: false,
      initialRuntimeState: {
        enemy: {
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 1, maxValue: 6667 },
          hitCountShields: [{ count: 1, outputTypes: [-1] }],
        },
      },
    });
    const hit = shielded.verifiedCombatRuntime.damageEvents[0];

    expect(hit.payload.rawDamage).toBe(0);
    expect(hit.payload.shieldState).toMatchObject({
      hitCountBlocked: true,
      remainingHitCountShieldCount: 0,
    });
    expect(hit.payload.toughnessDamage).toBe(1);
    expect(hit.payload.breakState).toMatchObject({
      after: 0,
      triggered: true,
      inBreak: true,
    });
    expect(shielded.verifiedCombatRuntime.finalState.enemy).toMatchObject({
      hp: 8628,
      inBreak: true,
    });
    expect(
      shielded.verifiedCombatRuntime.finalState.enemy.toughness
    ).toBeCloseTo(2888.938385, 5);
    expect(
      shielded.verifiedCombatRuntime.damageEvents.filter(
        event => event.payload.stateEventKind === 'break-linear-recovery'
      )
    ).not.toHaveLength(0);
    expect(
      shielded.verifiedCombatRuntime.damageEvents.some(event =>
        event.payload.formulaBreakdown?.unappliedLayerKeys?.includes(
          'useOneBreak'
        )
      )
    ).toBe(true);

    const valueShielded = simulateVerifiedAcceptanceScenario({
      includeKibo: false,
      initialRuntimeState: {
        enemy: {
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 6667, maxValue: 6667 },
          valueShields: [{ value: 999, outputTypes: [-1] }],
        },
      },
    });
    expect(
      valueShielded.verifiedCombatRuntime.damageEvents[0].payload.shieldState
        .absorbed
    ).toBeGreaterThan(0);
    expect(() =>
      JSON.stringify(valueShielded.verifiedCombatRuntime.finalState)
    ).not.toThrow();
  });

  it('runs the verified Break linear recovery, end wait and exit lifecycle', () => {
    const result = simulateVerifiedAcceptanceScenario({
      includeKibo: false,
      durationMs: 13000,
      initialRuntimeState: {
        enemy: {
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 1, maxValue: 6667 },
        },
      },
    });
    const stateEvents = result.verifiedCombatRuntime.damageEvents.filter(
      event => event.type === 'VERIFIED_TOUGHNESS_STATE_CHANGE'
    );

    expect(stateEvents.map(event => event.payload.stateEventKind)).toEqual(
      expect.arrayContaining([
        'break-linear-recovery',
        'break-end-wait',
        'break-exit',
      ])
    );
    expect(
      stateEvents.find(event => event.payload.stateEventKind === 'break-exit')
        ?.timeMs
    ).toBe(12300);
    expect(result.verifiedCombatRuntime.finalState.enemy).toMatchObject({
      toughness: 6667,
      inBreak: false,
      breakElapsedMs: 0,
    });
    expect(
      result.runtimeOutputs.stateCurves.enemy.points
        .filter(point => point.trackKey === 'enemyToughnessDamage')
        .at(-1).stateSnapshot.after.enemyToughness.currentValue
    ).toBe(6667);
  });

  it('resumes normal toughness recovery after the inherited verified delay', () => {
    const result = simulateVerifiedAcceptanceScenario({
      includeActor: false,
      includeKibo: false,
      durationMs: 500,
      initialRuntimeState: {
        enemy: {
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 6000, maxValue: 6667 },
          recoveryDelayRemainingMs: 100,
        },
      },
    });
    const recoveryEvents = result.verifiedCombatRuntime.damageEvents.filter(
      event => event.payload.stateEventKind === 'normal-toughness-recovery'
    );

    expect(recoveryEvents).toHaveLength(5);
    expect(recoveryEvents[0]).toMatchObject({
      timeMs: 100,
      actionId: null,
      payload: {
        toughnessDamage: expect.any(Number),
        appliedToCalculators: true,
      },
    });
    expect(recoveryEvents[0].payload.toughnessDamage).toBeLessThan(0);
    expect(
      result.verifiedCombatRuntime.finalState.enemy.toughness
    ).toBeGreaterThan(6000);
    expect(
      result.actionResultTimeline.some(
        row =>
          row.verifiedMechanicsStatus ===
          'verified-weakness-state-runtime-event'
      )
    ).toBe(true);
    const toughnessPoints =
      result.runtimeOutputs.stateCurves.enemy.points.filter(
        point => point.trackKey === 'enemyToughnessDamage'
      );
    expect(toughnessPoints).toHaveLength(5);
    expect(
      toughnessPoints.at(-1).stateSnapshot.after.enemyToughness.currentValue
    ).toBe(result.verifiedCombatRuntime.finalState.enemy.toughness);
  });

  it('keeps real damage shield-bypassing and pure Weakness on the verified Q16.16 path', () => {
    const real = calculateRealDamage({
      attack: 100,
      ratioBasisPoints: 10000,
      currentHp: 1000,
      minimumRemainingHp: 0,
      valueShields: [{ value: 999 }],
    });
    const pureWeakness = calculateWeaknessDamage({
      pure: true,
      attack: 100,
      ratioBasisPoints: 10000,
      typeMultiplier: 1,
      elementMultiplier: 1,
      weakBreakDamageRateBasisPoints: 5000,
      worldEventConflictPer: 1,
    });

    expect(real).toMatchObject({
      mode: 'real',
      value: 100,
      shieldsBypassed: true,
    });
    expect(pureWeakness).toMatchObject({
      mode: 'pure_weakness',
      deducted: '50',
    });
  });

  it('reads dynamic enemy CRI_DEFENSE at the verified hit frame', () => {
    const scenario = createPangpangCriticalScenario();
    const baseline = runVerifiedRuntimeWithEnemyCriticalDefense(scenario, []);
    const defended = runVerifiedRuntimeWithEnemyCriticalDefense(scenario, [
      {
        sourceActionId: null,
        effectId: 'fixture:enemy-critical-defense',
        effectName: '敌方暴击抵抗',
        operation: 'apply',
        targetKind: 'enemy',
        targetId: scenario.enemy.id,
        timeMs: 500,
        durationMs: 2000,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: 102,
            bucket: 'dynamicExtra',
            valueRaw: 1250,
            sourceIdentity: {
              packageId: 'fixture-package',
              effectIdentity: 'fixture:enemy-critical-defense',
              actionBindingIdentity: 'fixture:enemy-critical-defense-source',
            },
          },
        ],
        sourceIdentity: {
          packageId: 'fixture-package',
          effectIdentity: 'fixture:enemy-critical-defense',
          actionBindingIdentity: 'fixture:enemy-critical-defense-source',
        },
        sourceStatus: 'verified-battle-effect-generated',
        generatedVerified: true,
        appliedToCalculators: true,
      },
    ]);
    const baselineEvent = baseline.damageEvents[0];
    const defendedEvent = defended.damageEvents[0];
    const baselineBranch = baselineEvent.payload.formulaBreakdown.randomBranch;
    const defendedBranch = defendedEvent.payload.formulaBreakdown.randomBranch;

    expect(defendedBranch.criticalRoll).toBe(baselineBranch.criticalRoll);
    expect(defendedBranch).toMatchObject({
      sourceCriticalRate: baselineBranch.sourceCriticalRate,
      targetCriticalRateDefense: 0.125,
      targetCriticalRateDefenseBasisPoints: 1250,
      criticalThreshold: Math.max(0, baselineBranch.criticalThreshold - 1250),
    });
    expect(defendedEvent.payload.dynamicPropertyTrace.target).toContainEqual(
      expect.objectContaining({
        attributeId: 102,
        dynamicExtraRaw: 1250,
        value: 1250,
      })
    );
  });
  it('keeps the verified weakness multiplier and clamp order with independent loss percentages', () => {
    const vector = calculateWeaknessDamage({
      outputDamageRaw: qFromFloat(123.456),
      typeMultiplier: 1.2,
      elementMultiplier: 0.8,
      weaknessSkillDamageUp: 1.1,
      weakBreakDamageRateBasisPoints: 7500,
      maximum: 100,
      minimum: 10,
    });
    expect(vector).toMatchObject({
      raw: '6407709',
      value: 97.77388000488281,
      deducted: '98',
    });
    expect(vector.trace.map(step => step.name)).toEqual([
      'hp_damage_before_shield',
      'weakness_type',
      'weakness_element',
      'weakness_base_applied',
      'weakness_skill_tag',
      'weak_break_rate',
      'weakness_maximum',
      'weakness_minimum',
    ]);

    const hit = simulateVerifiedAcceptanceScenario({ includeKibo: false })
      .verifiedCombatRuntime.damageEvents[0];
    expect(hit.payload.formulaBreakdown.weaknessInput).toMatchObject({
      preShieldHpDamageRaw: expect.any(String),
      weakBreakDamageRateBasisPoints: 10000,
      maximumWeakness: 6667,
    });
    expect(hit.payload.hpLossPercent).toBe(
      Number((hit.payload.rawDamage / 8628).toFixed(6))
    );
    expect(hit.payload.toughnessLossPercent).toBe(
      Number((hit.payload.toughnessDamage / 6667).toFixed(6))
    );
    expect(hit.payload.toughnessLossPercent).toBeGreaterThan(
      hit.payload.hpLossPercent
    );
  });
});

function createPangpangCriticalScenario() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({ ...config, initialSp: 0 }));
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 3000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'verified-pangpang-critical-defense',
        type: 'skill',
        actorCharacterId: PANGPANG_CHARACTER_ID,
        skillId: PANGPANG_SKILL_ID,
        actionVariantIndex: 0,
        startMs: 1000,
        durationMs: 600,
        ...createPangpangAttackInputFields('pangpang-critical-defense-chain'),
        hitOverrides: {
          [PANGPANG_ATTACK_INPUT.selectedHitIdentities[0]]: {
            willHit: true,
            criticalPolicy: 'sampled',
          },
        },
      }),
    ],
    combatScenario: {
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'non-critical', seed: 'dynamic-defense-seed' },
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return compileProject(project, getWorkbenchGameData());
}

function runVerifiedRuntimeWithEnemyCriticalDefense(
  scenario,
  generatedCommands
) {
  const actionRuleDiagnostics = createActionRuleDiagnostics({ scenario });
  const actionExecutionPlan = createActionExecutionPlan({
    scenario,
    actionRuleDiagnostics,
  });
  const controlledActorTimeline = createControlledActorTimeline({
    scenario,
    actionExecutionPlan,
  });
  const effectTimeline = createEffectRuntimeTimeline({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    generatedCommands,
  });
  return createVerifiedCombatRuntime({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    effectTimeline,
    criticalRandomSource: createDeterministicCriticalRandomSource({
      seed: 'dynamic-defense-seed',
    }),
  });
}
function frameTimeMs(frame) {
  return frame * (1000 / 60);
}

function createXiaoyuAttackInputAction(
  id,
  segment,
  startMs,
  hitOverrides = null
) {
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId: XIAOYU_CHARACTER_ID,
    skillId: XIAOYU_NORMAL_SKILL_ID,
    actionVariantIndex: 0,
    startMs,
    durationMs: frameTimeMs(segment.durationFrames),
    durationFrames: segment.durationFrames,
    attackGroupId: `${id}-chain`,
    attackSequenceIndex: segment.sequenceIndex,
    attackSequenceTotal: segment.sequenceTotal,
    attackInput: segment,
    actionScheduling: segment.actionScheduling,
    hitOverrides,
  });
}

function simulateXiaoyuRepairScenario({
  actions,
  initialControlledCharacterId = XIAOYU_CHARACTER_ID,
  tuningMarkLayers = 0,
  specialResourceValue = null,
} = {}) {
  return simulateScenario(
    compileProject(
      createXiaoyuRepairProject({
        actions,
        initialControlledCharacterId,
        tuningMarkLayers,
        specialResourceValue,
      }),
      getWorkbenchGameData()
    )
  );
}

function createXiaoyuRepairProject({
  actions,
  initialControlledCharacterId = XIAOYU_CHARACTER_ID,
  tuningMarkLayers = 0,
  specialResourceValue = null,
} = {}) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: XIAOYU_CHARACTER_ID,
    secondaryCharacterId: 103002,
    skillId: XIAOYU_NORMAL_SKILL_ID,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    config => ({
      ...config,
      initialSp: 0,
      loadout: {
        ...config.loadout,
        ...(Number(config.characterId) === XIAOYU_CHARACTER_ID
          ? { kiboId: XIAOYU_KIBO_ID }
          : {}),
      },
    })
  );
  const controlledActor = teamSlots.find(
    slot => Number(slot.characterId) === Number(initialControlledCharacterId)
  );
  const initialRuntimeState = {
    controlledActor: {
      actorId: `actor-${controlledActor.characterId}`,
      characterId: controlledActor.characterId,
    },
    kiboEnergyBySlot: [
      {
        slotId: 'team-slot-1',
        actorId: `actor-${XIAOYU_CHARACTER_ID}`,
        characterId: XIAOYU_CHARACTER_ID,
        kiboId: XIAOYU_KIBO_ID,
        currentValue: 0,
        maxValue: 100,
      },
    ],
    tuningMarks:
      tuningMarkLayers > 0
        ? [
            {
              markId: XIAOYU_WIND_MARK.markId,
              profileKey: XIAOYU_WIND_MARK.key,
              elementName: XIAOYU_WIND_MARK.element,
              decayRemainingMs: 20_000,
              heldReadyRemainingMs: 0,
              layers: Array.from({ length: tuningMarkLayers }, (_, index) => ({
                remainingDurationMs: 20_000,
                sourceActionId: `initial-wind-${index + 1}`,
                sourceActorId: `actor-${XIAOYU_CHARACTER_ID}`,
                sourceIdentity: {
                  profile: XIAOYU_WIND_MARK.sourceIdentity,
                  layer: index + 1,
                },
              })),
            },
          ]
        : [],
    specialResourcesByActor:
      specialResourceValue == null
        ? []
        : [
            {
              actorId: `actor-${XIAOYU_CHARACTER_ID}`,
              characterId: XIAOYU_CHARACTER_ID,
              resourceIdentity: 'actor:101010:element:101010115',
              currentValue: specialResourceValue,
              maxValue: 100,
            },
          ],
  };
  return createWorkbenchProject(selection, {
    durationMs: 10_000,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
}

function simulateXiaoyuStarCarry(hitOverrides = null) {
  const switchFrame = 60;
  const starCarryEndFrame = switchFrame + 95;
  return simulateXiaoyuRepairScenario({
    initialControlledCharacterId: 103002,
    tuningMarkLayers: 1,
    actions: [
      createWorkbenchActionDraft({
        id: 'switch-to-xiaoyu',
        type: 'switch',
        actorCharacterId: 103002,
        targetCharacterId: XIAOYU_CHARACTER_ID,
        startMs: frameTimeMs(switchFrame),
        durationMs: 0,
        hitOverrides,
      }),
      createXiaoyuAttackInputAction(
        'xiaoyu-after-star-carry',
        XIAOYU_NORMAL_MAPPING.attackInputSegments[0],
        frameTimeMs(starCarryEndFrame)
      ),
    ],
  });
}

function xiaoyuStarCarryActionId(parentActionId) {
  return `${parentActionId}--on-enter--actor-${XIAOYU_CHARACTER_ID}--star-carry`;
}

function simulateXiaoyuPerfectParry({ includePrerequisite }) {
  const startFrame = 60;
  return simulateXiaoyuRepairScenario({
    tuningMarkLayers: 1,
    actions: [
      ...(includePrerequisite
        ? [
            createWorkbenchActionDraft({
              id: 'xiaoyu-perfect-parry-event',
              type: 'enemyEvent',
              actorCharacterId: XIAOYU_CHARACTER_ID,
              skillId: XIAOYU_NORMAL_SKILL_ID,
              eventType: 'successful-parry',
              startMs: frameTimeMs(startFrame),
              durationMs: frameTimeMs(1),
            }),
          ]
        : []),
      createWorkbenchActionDraft({
        id: 'xiaoyu-perfect-parry',
        type: 'skill',
        actorCharacterId: XIAOYU_CHARACTER_ID,
        skillId: XIAOYU_TRIGGER_SKILL_ID,
        actionVariantIndex: 2,
        startMs: frameTimeMs(startFrame),
        durationMs: frameTimeMs(36),
        durationFrames: 36,
      }),
    ],
  });
}

function expectXiaoyuHitSettlement(
  result,
  actionId,
  { frames, actorRecovery, kiboRecovery }
) {
  const hits = result.verifiedCombatRuntime.damageEvents.filter(
    event => event.actionId === actionId && event.type === 'VERIFIED_COMBAT_HIT'
  );
  expect(hits.map(event => Math.round(event.timeMs * 60 * 0.001))).toEqual(
    frames
  );
  expect(
    hits.every(
      event =>
        Number(event.payload.rawDamage) > 0 &&
        Number(event.payload.toughnessDamage) > 0
    )
  ).toBe(true);
  expect(
    result.verifiedCombatRuntime.resourceEvents
      .filter(
        event =>
          event.actionId === actionId &&
          event.actorId === `actor-${XIAOYU_CHARACTER_ID}` &&
          event.payload.reason === 'verified-hit-sp-recovery'
      )
      .map(event => event.payload.change)
  ).toEqual(actorRecovery);
  expect(
    result.verifiedCombatRuntime.kiboResourceEvents
      .filter(
        event =>
          event.actionId === actionId &&
          event.payload.slotId === 'team-slot-1' &&
          event.payload.kiboId === XIAOYU_KIBO_ID &&
          event.payload.reason === 'verified-hit-pet-sp-shared-recovery'
      )
      .map(event => event.payload.change)
  ).toEqual(kiboRecovery);
}

function createPangpangAttackInputFields(attackGroupId) {
  return {
    attackGroupId,
    attackSequenceIndex: PANGPANG_ATTACK_INPUT.sequenceIndex,
    attackSequenceTotal: PANGPANG_ATTACK_INPUT.sequenceTotal,
    attackInput: PANGPANG_ATTACK_INPUT,
  };
}

function simulateAttackInputChain(actions) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: 102001,
    skillId: 10200101,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    config => ({ ...config, initialSp: 0 })
  );
  const project = createWorkbenchProject(selection, {
    durationMs: 30000,
    teamSlots,
    actorConfigs,
    actions,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function damageTimesByAction(result, actions) {
  return Object.fromEntries(
    actions.map(action => [
      action.id,
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === action.id)
        .map(event => event.timeMs),
    ])
  );
}

function simulateVerifiedAcceptanceScenario({
  includeActor = true,
  includeActorUltimate = false,
  includeBlockedRepeat = false,
  includeSecondPangpang = false,
  includeKibo = true,
  initialRuntimeState = null,
  durationMs = 5000,
  kiboStartMs = null,
  switchAtMs = null,
  actorUltimateStartMs = 100,
  initialSpByCharacterId = {},
} = {}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === PANGPANG_CHARACTER_ID
      ? {
          ...config,
          initialSp: initialSpByCharacterId[PANGPANG_CHARACTER_ID] ?? 0,
          loadout: {
            ...config.loadout,
            kiboId: HEAVY_ROCK_HOOF_ID,
          },
        }
      : {
          ...config,
          initialSp: initialSpByCharacterId[Number(config.characterId)] ?? 0,
        }
  );
  const actions = includeActor
    ? [
        createWorkbenchActionDraft({
          id: 'verified-pangpang-normal',
          type: 'skill',
          actorCharacterId: PANGPANG_CHARACTER_ID,
          skillId: PANGPANG_SKILL_ID,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 600,
          ...createPangpangAttackInputFields('pangpang-chain-1'),
        }),
      ]
    : [];
  if (includeSecondPangpang) {
    actions.push(
      createWorkbenchActionDraft({
        id: 'verified-pangpang-normal-second',
        type: 'skill',
        actorCharacterId: PANGPANG_CHARACTER_ID,
        skillId: PANGPANG_SKILL_ID,
        actionVariantIndex: 0,
        startMs: 1000,
        durationMs: 600,
        ...createPangpangAttackInputFields('pangpang-chain-2'),
      })
    );
  }
  if (includeActorUltimate) {
    actions.push(
      createWorkbenchActionDraft({
        id: 'verified-muyin-ultimate',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: MUYIN_ULTIMATE_SKILL_ID,
        actionVariantIndex: 0,
        startMs: actorUltimateStartMs,
        durationMs: 800,
      })
    );
  }
  if (includeKibo) {
    actions.push(
      createWorkbenchActionDraft({
        id: 'verified-heavy-rock-hoof',
        type: 'kiboEvent',
        actorCharacterId: PANGPANG_CHARACTER_ID,
        skillId: HEAVY_ROCK_HOOF_SKILL_ID,
        startMs: kiboStartMs ?? (includeSecondPangpang ? 2000 : 1000),
        durationMs: 2600,
        eventType: 'signature',
      })
    );
  }
  if (includeBlockedRepeat) {
    actions.push(
      createWorkbenchActionDraft({
        id: 'verified-heavy-rock-hoof-blocked',
        type: 'kiboEvent',
        actorCharacterId: PANGPANG_CHARACTER_ID,
        skillId: HEAVY_ROCK_HOOF_SKILL_ID,
        startMs: 2000,
        durationMs: 2600,
        eventType: 'signature',
      })
    );
  }
  if (switchAtMs != null) {
    actions.push(
      createWorkbenchActionDraft({
        id: 'verified-switch-actor-2',
        type: 'switch',
        actorCharacterId: 109001,
        targetCharacterId: 101003,
        startMs: switchAtMs,
        durationMs: 0,
      })
    );
  }
  const resolvedInitialRuntimeState =
    initialRuntimeState ??
    (includeKibo
      ? {
          kiboEnergyBySlot: [
            {
              slotId: 'team-slot-3',
              kiboId: HEAVY_ROCK_HOOF_ID,
              currentValue: 100,
              maxValue: 100,
            },
          ],
        }
      : null);
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState: resolvedInitialRuntimeState,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  return simulateScenario(scenario);
}

function createNonDamageExecutionProjection(result, overrides = {}) {
  return createVerifiedCombatRuntime({
    scenario: result.effectiveActionTimeline.scenario,
    actionExecutionPlan: result.actionExecutionPlan,
    controlledActorTimeline: result.controlledActorTimeline,
    effectGeneration: result.verifiedBattleEffectGeneration,
    tuningGeneration: result.verifiedTuningMarkGeneration,
    damageEventGeneration: result.verifiedDamageEventGeneration,
    effectTimeline: result.effectTimeline,
    actionVariantRuntime: result.verifiedActionVariantRuntime,
    kiboPassiveGeneration: result.verifiedKiboPassiveGeneration,
    runtimeMode: 'non-damage-event-projection',
    ...overrides,
  });
}

function simulatePangpangHitRecoveryParityScenario() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({
    ...config,
    initialSp:
      Number(config.characterId) === PANGPANG_CHARACTER_ID ? 99 : 0,
  }));
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 2200,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'pangpang-recovery-parity-normal',
        type: 'skill',
        actorCharacterId: PANGPANG_CHARACTER_ID,
        skillId: PANGPANG_SKILL_ID,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 600,
        ...createPangpangAttackInputFields('pangpang-recovery-parity-chain'),
      }),
      createWorkbenchActionDraft({
        id: 'pangpang-recovery-parity-ultimate',
        type: 'skill',
        actorCharacterId: PANGPANG_CHARACTER_ID,
        skillId: PANGPANG_ULTIMATE_SKILL_ID,
        actionVariantIndex: 0,
        startMs: 1000,
        durationMs: 1000,
      }),
    ],
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function createPangpangHitRecoveryParityPair({
  mutateScenario = null,
  mutateResolution = null,
  mutateDamageEventGeneration = null,
  mutateExecutionPlan = null,
  mutateActionVariantRuntime = null,
  mutateControlledActorTimeline = null,
} = {}) {
  const prepared = simulatePangpangHitRecoveryParityScenario();
  const scenario = structuredClone(prepared.effectiveActionTimeline.scenario);
  mutateScenario?.(scenario);

  const actionExecutionPlan = structuredClone(prepared.actionExecutionPlan);
  mutateExecutionPlan?.(actionExecutionPlan);
  const actionResolutionById = new Map(
    prepared.verifiedActionVariantRuntime.actionResolutionById
  );
  const normalResolution = structuredClone(
    actionResolutionById.get('pangpang-recovery-parity-normal')
  );
  mutateResolution?.(normalResolution);
  actionResolutionById.set(
    'pangpang-recovery-parity-normal',
    normalResolution
  );
  const actionVariantRuntime = {
    ...prepared.verifiedActionVariantRuntime,
    actionResolutionById,
    executionBlocks: structuredClone(
      prepared.verifiedActionVariantRuntime.executionBlocks ?? []
    ),
  };
  mutateActionVariantRuntime?.(actionVariantRuntime);
  const damageEventGeneration = structuredClone(
    prepared.verifiedDamageEventGeneration
  );
  mutateDamageEventGeneration?.(damageEventGeneration);
  const controlledActorTimeline = structuredClone(
    prepared.controlledActorTimeline
  );
  mutateControlledActorTimeline?.(controlledActorTimeline);
  const ultimateAction = scenario.actions.find(
    action => action.id === 'pangpang-recovery-parity-ultimate'
  );
  const ultimateResolution = actionResolutionById.get(ultimateAction.id);
  const commonArguments = {
    scenario,
    actionExecutionPlan,
    controlledActorTimeline,
    effectGeneration: {
      ...prepared.verifiedBattleEffectGeneration,
      directHpEvents: [
        createProjectionVitalFixture({
          action: ultimateAction,
          resolution: ultimateResolution,
          timeMs: 1100,
        }),
      ],
    },
    tuningGeneration: prepared.verifiedTuningMarkGeneration,
    damageEventGeneration,
    effectTimeline: prepared.effectTimeline,
    actionVariantRuntime,
    kiboPassiveGeneration: prepared.verifiedKiboPassiveGeneration,
  };
  return {
    full: createVerifiedCombatRuntime(commonArguments),
    projection: createVerifiedCombatRuntime({
      ...commonArguments,
      runtimeMode: 'non-damage-event-projection',
    }),
  };
}

function findPangpangParityRecovery(runtime) {
  return runtime.resourceEvents.find(
    event =>
      event.actionId === 'pangpang-recovery-parity-normal' &&
      event.actorId === `actor-${PANGPANG_CHARACTER_ID}` &&
      event.payload.reason === 'verified-hit-sp-recovery'
  );
}

function hasPangpangParityUltimateCost(runtime) {
  return runtime.resourceEvents.some(
    event =>
      event.actionId === 'pangpang-recovery-parity-ultimate' &&
      event.payload.reason === 'verified-skill-cost'
  );
}

function createProjectionVitalFixture({ action, resolution, timeMs }) {
  return {
    eventIdentity: `fixture:projection-vital:${action.id}`,
    timeMs,
    action,
    actionId: action.id,
    actorId: action.actorId,
    target: { kind: 'actor', id: action.actorId },
    value: 100,
    effect: {
      effectIdentity: `fixture:projection-vital-effect:${action.id}`,
    },
    resolution,
    sourceIdentity: `fixture:projection-vital:${action.id}`,
    sourceSequencePath: createFixtureDirectEffectSourceSequencePath(
      action,
      timeMs,
      0
    ),
    sourceSequenceStatus: 'verified-direct-effect-source-sequence-ready',
    applied: true,
  };
}

function createFixtureDirectEffectSourceSequencePath(action, ...suffix) {
  return [
    ...(action.sourceSequencePath ?? [Number(action.sourceSequenceIndex ?? 0)]),
    90,
    ...suffix.map(value => Number(value)),
  ];
}

function simulateRubyStarSkill(hitOverrides = {}, initialAmmo = 0) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: RUBY_CHARACTER_ID,
    secondaryCharacterId: XIAOYU_CHARACTER_ID,
    skillId: RUBY_STAR_SKILL_ID,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const rubySlot = teamSlots.find(
    slot => Number(slot.characterId) === RUBY_CHARACTER_ID
  );
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    config => ({
      ...config,
      initialSp: 0,
      loadout: {
        ...config.loadout,
        ...(Number(config.characterId) === RUBY_CHARACTER_ID
          ? { kiboId: RUBY_KIBO_ID }
          : {}),
      },
    })
  );
  const project = createWorkbenchProject(selection, {
    durationMs: 3000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'verified-ruby-star-skill',
        type: 'skill',
        actorCharacterId: RUBY_CHARACTER_ID,
        skillId: RUBY_STAR_SKILL_ID,
        actionKind: 'star-skill',
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: frameTimeMs(204),
        durationFrames: 204,
        hitOverrides,
      }),
    ],
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${RUBY_CHARACTER_ID}`,
        characterId: RUBY_CHARACTER_ID,
      },
      kiboEnergyBySlot: [
        {
          slotId: rubySlot.slotId,
          actorId: `actor-${RUBY_CHARACTER_ID}`,
          characterId: RUBY_CHARACTER_ID,
          kiboId: RUBY_KIBO_ID,
          currentValue: 0,
          maxValue: 100,
        },
      ],
      specialResourcesByActor: [
        {
          actorId: `actor-${RUBY_CHARACTER_ID}`,
          characterId: RUBY_CHARACTER_ID,
          resourceIdentity: 'actor:103002:element:103002047',
          currentValue: initialAmmo,
          maxValue: 12,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function simulateHanProjectileInput(hitOverrides = {}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({ ...config, initialSp: 0 }));
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 2000,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'verified-han-projectile-a3',
        type: 'skill',
        actorCharacterId: HAN_YOUYOU_CHARACTER_ID,
        skillId: HAN_YOUYOU_NORMAL_MAPPING.sourceSkillId,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 1000,
        attackGroupId: 'han-projectile-chain',
        attackSequenceIndex: HAN_YOUYOU_PROJECTILE_INPUT.sequenceIndex,
        attackSequenceTotal: HAN_YOUYOU_PROJECTILE_INPUT.sequenceTotal,
        attackInput: HAN_YOUYOU_PROJECTILE_INPUT,
        actionScheduling: HAN_YOUYOU_PROJECTILE_INPUT.actionScheduling,
        hitOverrides,
      }),
    ],
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

function simulateCrossCatalogScenario() {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({
    ...config,
    initialSp: 0,
    loadout:
      Number(config.characterId) === PANGPANG_CHARACTER_ID
        ? { ...config.loadout, kiboId: 500001 }
        : config.loadout,
  }));
  const actions = [
    createWorkbenchActionDraft({
      id: 'verified-han-star-skill',
      type: 'skill',
      actorCharacterId: 101003,
      skillId: 10100312,
      actionVariantIndex: 0,
      startMs: 0,
      durationMs: 1400,
    }),
    createWorkbenchActionDraft({
      id: 'verified-muyin-charged',
      type: 'skill',
      actorCharacterId: 109001,
      skillId: 10900101,
      actionVariantIndex: 1,
      startMs: 1800,
      durationMs: 1000,
    }),
    createWorkbenchActionDraft({
      id: 'verified-wind-kibo-active',
      type: 'kiboEvent',
      actorCharacterId: PANGPANG_CHARACTER_ID,
      skillId: 504004,
      kiboId: 500001,
      actionVariantIndex: 0,
      startMs: 3200,
      durationMs: 3000,
      eventType: 'active',
    }),
  ];
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 8000,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState: {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-3',
          kiboId: 500001,
          currentValue: 0,
          maxValue: 100,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}
