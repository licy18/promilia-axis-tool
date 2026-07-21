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
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import {
  calculateAutoSp,
  calculateRealDamage,
  calculateWeaknessDamage,
  qFromFloat,
} from '../../simulation/mechanics/verifiedCombatFormulaRuntime';

const PANGPANG_CHARACTER_ID = 101007;
const PANGPANG_SKILL_ID = 10100701;
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
        hitCount: 6,
        hp: 630,
        toughness: 126,
      },
    });
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
        startMs: 100,
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
