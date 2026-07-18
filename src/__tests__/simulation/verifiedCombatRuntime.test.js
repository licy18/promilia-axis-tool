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
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import {
  calculateRealDamage,
  calculateWeaknessDamage,
} from '../../simulation/mechanics/verifiedCombatFormulaRuntime';

const PANGPANG_CHARACTER_ID = 101007;
const PANGPANG_SKILL_ID = 10100701;
const HEAVY_ROCK_HOOF_ID = 500469;
const HEAVY_ROCK_HOOF_SKILL_ID = 50046903;

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified combat mechanics runtime', () => {
  it('resolves the two acceptance source chains without an inferred alias', () => {
    const actorResolution = resolveVerifiedCombatActionMechanics({
      id: 'pangpang-normal',
      type: 'skill',
      skillId: PANGPANG_SKILL_ID,
      actionVariantIndex: 0,
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
        identity: 'actor|101007|10100701|0|10100703',
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
          actionId: 'verified-pangpang-normal',
          reason: 'verified-hit-pet-sp-shared-recovery',
        }),
        expect.objectContaining({
          actionId: 'verified-heavy-rock-hoof',
          reason: 'verified-skill-cost',
        }),
      ])
    );
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
    expect(shielded.verifiedCombatRuntime.finalState.enemy.toughness).toBeCloseTo(
      2888.938385,
      5
    );
    expect(
      shielded.verifiedCombatRuntime.damageEvents.filter(
        event =>
          event.payload.stateEventKind === 'break-linear-recovery'
      )
    ).not.toHaveLength(0);
    expect(
      shielded.verifiedCombatRuntime.damageEvents.some(
        event => event.payload.formulaBreakdown?.unappliedLayerKeys?.includes('useOneBreak')
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
      event =>
        event.payload.stateEventKind === 'normal-toughness-recovery'
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
    expect(result.verifiedCombatRuntime.finalState.enemy.toughness).toBeGreaterThan(
      6000
    );
    expect(
      result.actionResultTimeline.some(
        row =>
          row.verifiedMechanicsStatus ===
          'verified-weakness-state-runtime-event'
      )
    ).toBe(true);
    const toughnessPoints = result.runtimeOutputs.stateCurves.enemy.points.filter(
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
});

function simulateVerifiedAcceptanceScenario({
  includeActor = true,
  includeBlockedRepeat = false,
  includeSecondPangpang = false,
  includeKibo = true,
  initialRuntimeState = null,
  durationMs = 5000,
} = {}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config =>
    Number(config.characterId) === PANGPANG_CHARACTER_ID
      ? {
          ...config,
          initialSp: 0,
          loadout: {
            ...config.loadout,
            kiboId: HEAVY_ROCK_HOOF_ID,
          },
        }
      : { ...config, initialSp: 0 }
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
        startMs: includeSecondPangpang ? 2000 : 1000,
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
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState,
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  return simulateScenario(scenario);
}
