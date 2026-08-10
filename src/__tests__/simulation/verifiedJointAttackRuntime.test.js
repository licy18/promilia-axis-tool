import { beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import qualificationCatalog from '../../data/generated/optimization-qualification-catalog.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { createVerifiedJointAttackRuntimeBinding } from '../../domain/verifiedJointAttackRuntimeContract';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedCombatRuntime } from '../../simulation/mechanics/verifiedCombatRuntime';
import { createVerifiedDamageEventGeneration } from '../../simulation/mechanics/verifiedDamageEventGeneration';
import { createDeterministicCriticalRandomSource } from '../../simulation/runtime/criticalRandomSource';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../../features/workbench/workbenchHeadlessCombatCore';
import { createMachineAxisActionLegalityProof } from '../../machine-axis/machineAxisActionLegality';
import { compareCycleBoundaryStates } from '../../machine-axis/machineAxisCycleEvaluator';
import { createMachineAxisEnemyProfile } from '../../machine-axis/machineAxisEnemyProfileContract';
import { createFastestKillProof } from '../../machine-axis/machineAxisKillEvaluator';
import { createMachineAxisObjectiveContract } from '../../machine-axis/machineAxisObjectiveContract';

const KIBO_ID = 500001;
const KIBO_JOINT_SKILL_ID = 50000112;
const BREAKABLE_ENEMY_ID = 300082;

describe('verified joint attack runtime', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('derives the anchor from catalog hit identities instead of a global F40 constant', () => {
    const formalKiboIds = new Set(
      qualificationCatalog.records
        .filter(
          record =>
            record.objectKind === 'kibo' && record.optimizationReady === true
        )
        .map(record => Number(record.objectId))
    );
    const breakMappings = mechanicsPackage.actionMappings.filter(
      mapping =>
        mapping.ownerKind === 'kibo' &&
        mapping.actionKind === 'break' &&
        String(mapping.controlVariantSourceIdentity).includes('breakSkillList')
    );
    const formalMappings = breakMappings.filter(mapping =>
      formalKiboIds.has(Number(mapping.ownerId))
    );
    const formalFrames = new Set(
      formalMappings.flatMap(mapping =>
        mapping.actionTiming.hits.map(hit => Number(hit.frame))
      )
    );
    const fullCatalogFrames = new Set(
      breakMappings.flatMap(mapping =>
        mapping.actionTiming.hits.map(hit => Number(hit.frame))
      )
    );

    expect(formalKiboIds.size).toBe(43);
    expect(formalMappings).toHaveLength(43);
    expect([...formalFrames]).toEqual([40]);
    expect(breakMappings).toHaveLength(122);
    expect([...fullCatalogFrames].sort((left, right) => left - right)).toEqual([
      0, 35, 37, 39, 40, 44, 45,
    ]);
  });

  it('settles the standard F40 actor/Kibo packets pre-break, then clears toughness once', () => {
    const result = simulateJointPair({
      actorCharacterId: 103002,
      actorSkillId: 10300212,
      actorVariantIndex: 1,
      actorDurationFrames: 57,
    });
    const runtime = result.verifiedCombatRuntime;
    const pairHits = runtime.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' &&
        ['joint-actor', 'joint-kibo'].includes(event.actionId)
    );
    const clearEvents = runtime.damageEvents.filter(
      event => event.type === 'VERIFIED_JOINT_ATTACK_ATTACHED_TOUGHNESS_CLEAR'
    );

    expect(pairHits).toHaveLength(2);
    expect(pairHits.map(event => event.absoluteFrame)).toEqual([40, 40]);
    expect(
      pairHits.map(event => [
        event.actionId,
        event.payload.inBreakForHpDamage,
        event.payload.hpDamageMultiplier,
        event.payload.jointAttackAnchorFrame,
      ])
    ).toEqual([
      ['joint-actor', false, 1, true],
      ['joint-kibo', false, 1, true],
    ]);
    expect(clearEvents).toHaveLength(1);
    expect(clearEvents[0]).toMatchObject({
      absoluteFrame: 40,
      payload: {
        mappingIdentity: 'kibo|500001|50000112|0|50000112|break',
        hitIdentity: '50000112|0|elements|0|-448652140726148484|40|1',
        anchorRelativeFrame: 40,
        anchorAbsoluteFrame: 40,
        toughnessAfter: 0,
        breakTriggered: true,
        settlementOrder: [
          'anchor-frame-pair-hp-packets-settled',
          'attached-toughness-cleared',
          'break-state-transitioned',
        ],
      },
    });
    expect(clearEvents[0].runtimeSequenceIndex).toBeGreaterThan(
      Math.max(...pairHits.map(event => event.runtimeSequenceIndex))
    );
    expect(runtime.summary).toMatchObject({
      jointAttackAdmissionCount: 1,
      jointAttackAttachedToughnessClearCount: 1,
      breakTriggerCount: 1,
    });
  });

  it('derives Misa F40 from the Kibo mapping and lets F74-F114 actor packets observe Break', () => {
    const result = simulateJointPair({
      actorCharacterId: 107002,
      actorSkillId: 10700212,
      actorVariantIndex: 1,
      actorDurationFrames: 218,
    });
    const runtime = result.verifiedCombatRuntime;
    const kiboHit = runtime.damageEvents.find(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === 'joint-kibo'
    );
    const actorHits = runtime.damageEvents.filter(
      event =>
        event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === 'joint-actor'
    );
    const clear = runtime.damageEvents.find(
      event => event.type === 'VERIFIED_JOINT_ATTACK_ATTACHED_TOUGHNESS_CLEAR'
    );

    expect(kiboHit).toMatchObject({
      absoluteFrame: 40,
      payload: {
        inBreakForHpDamage: false,
        hpDamageMultiplier: 1,
        jointAttackKiboAnchorHit: true,
      },
    });
    expect(clear).toMatchObject({
      absoluteFrame: 40,
      payload: { breakTriggered: true, anchorRelativeFrame: 40 },
    });
    expect(actorHits.map(event => event.absoluteFrame)).toEqual([
      74, 82, 90, 99, 107, 114,
    ]);
    expect(
      actorHits.every(
        event =>
          event.payload.inBreakForHpDamage === true &&
          event.payload.hpDamageMultiplier === 2
      )
    ).toBe(true);
    expect(actorHits[0].runtimeSequenceIndex).toBeGreaterThan(
      clear.runtimeSequenceIndex
    );
  });

  it('orders same-frame before, pair damage, attached clear, and after packets without retroactive Break', () => {
    const runtime = rerunJointWithSameFramePackets();
    const before = findHit(runtime, 'same-frame-before');
    const actor = findHit(runtime, 'joint-actor');
    const kibo = findHit(runtime, 'joint-kibo');
    const clear = runtime.damageEvents.find(
      event => event.type === 'VERIFIED_JOINT_ATTACK_ATTACHED_TOUGHNESS_CLEAR'
    );
    const after = findHit(runtime, 'same-frame-after');

    expect(
      [before, actor, kibo, clear, after].map(event => event.absoluteFrame)
    ).toEqual([40, 40, 40, 40, 40]);
    expect(
      [before, actor, kibo].map(event => [
        event.actionId,
        event.payload.inBreakForHpDamage,
        event.payload.hpDamageMultiplier,
      ])
    ).toEqual([
      ['same-frame-before', false, 1],
      ['joint-actor', false, 1],
      ['joint-kibo', false, 1],
    ]);
    expect(clear.payload).toMatchObject({
      breakTriggered: true,
      mappingIdentity: 'kibo|500001|50000112|0|50000112|break',
      hitIdentity: '50000112|0|elements|0|-448652140726148484|40|1',
      stateTransaction: {
        before: expect.objectContaining({ inBreak: false }),
        after: expect.objectContaining({ inBreak: true, toughness: 0 }),
      },
    });
    expect(after.payload).toMatchObject({
      inBreakForHpDamage: true,
      hpDamageMultiplier: 2,
    });
    expect(
      [before, actor, kibo, clear, after].map(
        event => event.runtimeSequenceIndex
      )
    ).toEqual(
      [...[before, actor, kibo, clear, after]]
        .sort(
          (left, right) =>
            left.runtimeSequenceIndex - right.runtimeSequenceIndex
        )
        .map(event => event.runtimeSequenceIndex)
    );
  });

  it('admits only an input cursor after a same-frame packet crosses the strict threshold', () => {
    const afterCrossing = rerunJointWithSameFramePackets({
      jointStartFrame: 40,
      initialToughnessRatio: 0.30005,
      surroundingWeakBreakDamageRateBasisPoints: 1000,
    });
    const crossing = findHit(afterCrossing, 'same-frame-before');
    const admitted = afterCrossing.eventLog.find(
      event => event.type === 'VERIFIED_JOINT_ATTACK_ADMITTED'
    );
    expect(crossing.payload.toughnessDamage).toBeGreaterThan(0);
    expect(crossing.payload.toughnessAfter).toBeLessThan(
      admitted.payload.threshold
    );
    expect(crossing.runtimeSequenceIndex).toBeLessThan(
      admitted.runtimeSequenceIndex
    );
    expect(
      afterCrossing.damageEvents.filter(
        event => event.type === 'VERIFIED_JOINT_ATTACK_ATTACHED_TOUGHNESS_CLEAR'
      )
    ).toHaveLength(1);

    const beforeCrossing = rerunJointWithSameFramePackets({
      pairBeforeSurroundingPackets: true,
      jointStartFrame: 40,
      initialToughnessRatio: 0.30005,
      surroundingWeakBreakDamageRateBasisPoints: 1000,
    });
    expect(
      beforeCrossing.eventLog.some(
        event => event.type === 'VERIFIED_JOINT_ATTACK_ADMITTED'
      )
    ).toBe(false);
    expect(beforeCrossing.executionBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'joint-actor',
          reason: 'joint-attack-threshold-not-reached',
        }),
        expect.objectContaining({
          actionId: 'joint-kibo',
          reason: 'joint-attack-threshold-not-reached',
        }),
      ])
    );
    expect(
      beforeCrossing.damageEvents.some(
        event => event.type === 'VERIFIED_JOINT_ATTACK_ATTACHED_TOUGHNESS_CLEAR'
      )
    ).toBe(false);
    expect(findHit(beforeCrossing, 'same-frame-before')).toBeTruthy();
  });

  it('fails the strict threshold edge without damage, cost, or toughness side effects', () => {
    const blocked = simulateJointPair({
      actorCharacterId: 103002,
      actorSkillId: 10300212,
      actorVariantIndex: 1,
      actorDurationFrames: 57,
      initialToughnessRatio: 0.3,
    });
    const runtime = blocked.verifiedCombatRuntime;

    expect(runtime.executionBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'joint-actor',
          reason: 'joint-attack-threshold-not-reached',
        }),
        expect.objectContaining({
          actionId: 'joint-kibo',
          reason: 'joint-attack-threshold-not-reached',
        }),
      ])
    );
    expect(
      runtime.damageEvents.some(event =>
        ['joint-actor', 'joint-kibo'].includes(event.actionId)
      )
    ).toBe(false);
    expect(runtime.summary.jointAttackAttachedToughnessClearCount).toBe(0);
    expect(
      [...runtime.resourceEvents, ...runtime.kiboResourceEvents].some(event =>
        ['joint-actor', 'joint-kibo'].includes(event.actionId)
      )
    ).toBe(false);
    expect(runtime.finalState.enemy).toMatchObject({
      inBreak: false,
      toughness: runtime.initialState.enemy.toughness,
    });
    expect(
      blocked.actionExecutionPlan.actions
        .filter(action =>
          ['joint-actor', 'joint-kibo'].includes(action.actionId)
        )
        .every(action => action.execute === false)
    ).toBe(true);
    expect(
      blocked.actionReadinessTimeline.cooldownWindows.some(window =>
        ['joint-actor', 'joint-kibo'].includes(window.actionId)
      )
    ).toBe(false);
    expect(
      blocked.effectTimeline.events.some(event =>
        ['joint-actor', 'joint-kibo'].includes(event.actionId)
      )
    ).toBe(false);

    const canonical = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(
      blocked.sourceProject
    );
    for (const objectiveId of [
      'cycle-dps-no-toughness',
      'cycle-dps-with-toughness',
      'fastest-kill',
    ]) {
      expect(
        createMachineAxisActionLegalityProof(canonical, { objectiveId })
      ).toMatchObject({
        passed: false,
        finalScoreEligible: false,
        rejectionCodes: expect.arrayContaining([
          'joint-attack-threshold-not-reached',
        ]),
      });
    }
  });

  it('rolls back both halves when the verified Kibo anchor misses or an explicit service gate rejects', () => {
    const missedResult = simulateJointPair({
      actorCharacterId: 103002,
      actorSkillId: 10300212,
      actorVariantIndex: 1,
      actorDurationFrames: 57,
      kiboHitOverrides: {
        '50000112|0|elements|0|-448652140726148484|40|1': {
          willHit: false,
        },
      },
    });
    const missed = missedResult.verifiedCombatRuntime;
    expect(missed.executionBlocks).toEqual(
      expect.arrayContaining(
        ['joint-actor', 'joint-kibo'].map(actionId =>
          expect.objectContaining({
            actionId,
            reason: 'joint-attack-kibo-landed-hit-required',
          })
        )
      )
    );
    expectJointPairHasNoSettlement(missed);
    expectJointPairHasNoExecutionSideEffects(missedResult);

    const excludedResult = simulateJointPair({
      actorCharacterId: 103002,
      actorSkillId: 10300212,
      actorVariantIndex: 1,
      actorDurationFrames: 57,
      runtimeInputs: { cannotBeJointStrike: true },
    });
    const excluded = excludedResult.verifiedCombatRuntime;
    expect(excluded.executionBlocks).toEqual(
      expect.arrayContaining(
        ['joint-actor', 'joint-kibo'].map(actionId =>
          expect.objectContaining({
            actionId,
            reason: 'joint-attack-service-excluded',
          })
        )
      )
    );
    expectJointPairHasNoSettlement(excluded);
    expectJointPairHasNoExecutionSideEffects(excludedResult);
  });

  it('reads later-packet Break multipliers from the enemy profile instead of hardcoding two times', () => {
    const afterHit = breakDamageUpBasisPoints =>
      findHit(
        rerunJointWithSameFramePackets({ breakDamageUpBasisPoints }),
        'same-frame-after'
      );
    const zero = afterHit(0);
    const fiftyPercent = afterHit(5000);

    expect(zero.payload).toMatchObject({
      inBreakForHpDamage: true,
      hpDamageMultiplier: 1,
    });
    expect(fiftyPercent.payload).toMatchObject({
      inBreakForHpDamage: true,
      hpDamageMultiplier: 1.5,
    });
    expect(
      BigInt(fiftyPercent.payload.formulaBreakdown.verifiedResult.preShieldRaw)
    ).toBe(
      (BigInt(zero.payload.formulaBreakdown.verifiedResult.preShieldRaw) * 3n) /
        2n
    );
  });

  it('projects pair, mapping, hit anchor, and clear order into deterministic canonical hashes', () => {
    const prepared = simulateJointPair({
      actorCharacterId: 103002,
      actorSkillId: 10300212,
      actorVariantIndex: 1,
      actorDurationFrames: 57,
    });
    const first = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(
      prepared.sourceProject
    );
    const replay = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(
      prepared.sourceProject
    );
    const clear = first.trace.damage.find(
      event => event.stateEventKind === 'joint-attack-attached-toughness-clear'
    );

    expect(replay.hashes).toEqual(first.hashes);
    expect(clear).toMatchObject({
      pairIdentity: expect.stringMatching(/^joint-pair:/),
      mappingIdentity: 'kibo|500001|50000112|0|50000112|break',
      hitIdentity: '50000112|0|elements|0|-448652140726148484|40|1',
      anchorRelativeFrame: 40,
      anchorAbsoluteFrame: 40,
      runtimeContractId: 'm12-joint-attack-runtime-v1',
      stateTransaction: {
        before: expect.objectContaining({ inBreak: false }),
        after: expect.objectContaining({ inBreak: true, toughness: 0 }),
      },
      settlementOrder: [
        'anchor-frame-pair-hp-packets-settled',
        'attached-toughness-cleared',
        'break-state-transitioned',
      ],
    });
    for (const dimension of ['input', 'data', 'trace', 'build']) {
      expect(first.hashes[dimension]).toMatch(/^[0-9a-f]{16}$/);
    }
  });

  it('feeds the attached Break state into cycle closure and the exact fastest-kill cursor', () => {
    const infinite = simulateJointPair({
      actorCharacterId: 107002,
      actorSkillId: 10700212,
      actorVariantIndex: 1,
      actorDurationFrames: 218,
    });
    const kiboDamage = Number(
      findHit(infinite.verifiedCombatRuntime, 'joint-kibo').payload
        .effectiveHpDamage
    );
    const firstActorDamage = Number(
      infinite.verifiedCombatRuntime.damageEvents.find(
        event =>
          event.type === 'VERIFIED_COMBAT_HIT' &&
          event.actionId === 'joint-actor' &&
          event.absoluteFrame === 74
      ).payload.effectiveHpDamage
    );
    const finiteHp = kiboDamage + Math.max(1, Math.floor(firstActorDamage / 2));
    const finite = simulateJointPair({
      actorCharacterId: 107002,
      actorSkillId: 10700212,
      actorVariantIndex: 1,
      actorDurationFrames: 218,
      targetPolicy: {
        hpMode: 'finite',
        toughnessMode: 'enabled',
        breakMode: 'enabled',
        deathTruncation: 'enabled',
      },
      initialEnemyHp: finiteHp,
    });
    const lethal = finite.damageTimeline.find(
      event => event.deathTriggered === true
    );
    expect(lethal).toMatchObject({
      absoluteFrame: 74,
      actionId: 'joint-actor',
      inBreakForHpDamage: true,
      hpDamageMultiplier: 2,
    });

    const boundaryBase = {
      actors: [],
      kibos: [],
      tuningMarks: [],
      specialResources: [],
      actorVitals: [],
      kiboVitals: [],
      activeActorId: 'actor-107002',
    };
    const closure = compareCycleBoundaryStates(
      {
        ...boundaryBase,
        enemy: infinite.verifiedCombatRuntime.initialState.enemy,
      },
      {
        ...boundaryBase,
        enemy: infinite.verifiedCombatRuntime.finalState.enemy,
      }
    );
    expect(closure).toMatchObject({
      closed: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cycle-state-not-closed',
          path: 'state.enemy',
        }),
      ]),
    });

    const enemyProfile = createMachineAxisEnemyProfile({
      profileId: `enemy:${BREAKABLE_ENEMY_ID}:joint-kill:${finiteHp}`,
      enemyId: BREAKABLE_ENEMY_ID,
      level: 80,
      source: {
        status: 'authoritative-resolved',
        kind: 'enemy-level-pipeline',
        identity: `joint-runtime-test:${BREAKABLE_ENEMY_ID}:${finiteHp}`,
        hash: `joint-runtime-test-${finiteHp}`,
      },
      attributes: {
        maxHp: finiteHp,
        physicalDefense: 9500,
        magicalDefense: 9500,
        maxToughness:
          finite.verifiedCombatRuntime.initialState.enemy.maxToughness,
        elementDefenses: {},
      },
      breakRules: {
        recoveryDelayMs: 100,
        recoveryRateBasisPoints: 1000,
        breakTimeMs: 11000,
        breakEndTimeMs: 1000,
        breakDamageUpBasisPoints: 10000,
        weaknessDamageMaximum: 1000000,
        weaknessDamageMinimum: 1,
        typeMultipliersBasisPoints: { normal: 10000 },
        elementMultipliersBasisPoints: {},
      },
    });
    const objectiveContract =
      createMachineAxisObjectiveContract('fastest-kill');
    const killProof = createFastestKillProof(
      {
        trace: {
          scenario: { durationMs: 2500, frameRate: 60 },
          damage: finite.damageTimeline,
          events: [],
        },
        hashes: {
          input: '0000000000000001',
          data: '0000000000000002',
          trace: '0000000000000003',
          evaluation: '0000000000000004',
          build: '0000000000000005',
        },
      },
      {
        scenario: {
          fps: 60,
          durationMs: 2500,
          enemy: {
            enemyId: BREAKABLE_ENEMY_ID,
            level: 80,
            profile: enemyProfile,
          },
        },
      },
      { objectiveContract }
    );
    expect(killProof).toMatchObject({
      valid: true,
      status: 'killed',
      formalScore: lethal.timeMs,
      killProof: {
        firstLethal: {
          frame: 74,
          timeMs: lethal.timeMs,
          actionId: 'joint-actor',
        },
      },
    });
  });
});

function simulateJointPair({
  actorCharacterId,
  actorSkillId,
  actorVariantIndex,
  actorDurationFrames,
  initialToughnessRatio = 0.01,
  runtimeInputs = {},
  kiboHitOverrides = null,
  targetPolicy = null,
  initialEnemyHp = null,
} = {}) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: actorCharacterId,
    secondaryCharacterId: actorCharacterId === 101010 ? 101007 : 101010,
    enemyId: BREAKABLE_ENEMY_ID,
    skillId: actorSkillId,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    config => ({
      ...config,
      initialSp: 100,
      loadout:
        Number(config.characterId) === Number(actorCharacterId)
          ? { ...config.loadout, kiboId: KIBO_ID }
          : config.loadout,
    })
  );
  const actorSlot = teamSlots.find(
    slot => Number(slot.characterId) === Number(actorCharacterId)
  );
  const project = createWorkbenchProject(selection, {
    durationMs: 2500,
    initialToughnessRatio,
    teamSlots,
    actorConfigs,
    actions: [
      createWorkbenchActionDraft({
        id: 'joint-actor',
        type: 'skill',
        actorCharacterId,
        skillId: actorSkillId,
        actionKind: 'star-combo',
        actionVariantIndex: actorVariantIndex,
        startMs: 0,
        durationFrames: actorDurationFrames,
        durationMs: (actorDurationFrames * 1000) / 60,
      }),
      createWorkbenchActionDraft({
        id: 'joint-kibo',
        type: 'kiboEvent',
        actorCharacterId,
        kiboId: KIBO_ID,
        skillId: KIBO_JOINT_SKILL_ID,
        actionKind: 'break',
        eventType: 'break',
        actionVariantIndex: 0,
        startMs: 0,
        durationFrames: 90,
        durationMs: 1500,
        hitOverrides: kiboHitOverrides,
      }),
    ],
    combatScenario: {
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'non-critical', seed: 'joint-runtime-test' },
      target: {
        ...(targetPolicy ?? {
          hpMode: 'infinite',
          toughnessMode: 'enabled',
          breakMode: 'enabled',
          deathTruncation: 'disabled',
        }),
      },
      jointAttackRuntime:
        createVerifiedJointAttackRuntimeBinding(runtimeInputs),
    },
    initialRuntimeState: {
      ...(initialEnemyHp == null
        ? {}
        : {
            enemy: {
              hp: {
                currentValue: initialEnemyHp,
                maxValue: initialEnemyHp,
              },
            },
          }),
      controlledActor: {
        actorId: `actor-${actorCharacterId}`,
        characterId: actorCharacterId,
      },
      kiboEnergyBySlot: [
        {
          slotId: actorSlot.slotId,
          actorId: `actor-${actorCharacterId}`,
          characterId: actorCharacterId,
          kiboId: KIBO_ID,
          currentValue: 100,
          maxValue: 100,
        },
      ],
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return {
    ...simulateScenario(compileProject(project, getWorkbenchGameData())),
    sourceProject: project,
  };
}

function rerunJointWithSameFramePackets({
  pairBeforeSurroundingPackets = false,
  jointStartFrame = 0,
  initialToughnessRatio = 0.01,
  surroundingWeakBreakDamageRateBasisPoints = 0,
  breakDamageUpBasisPoints = null,
} = {}) {
  const prepared = simulateJointPair({
    actorCharacterId: 103002,
    actorSkillId: 10300212,
    actorVariantIndex: 1,
    actorDurationFrames: 57,
    initialToughnessRatio: 0.01,
  });
  const scenario = structuredClone(prepared.effectiveActionTimeline.scenario);
  const maxToughness = Number(
    prepared.verifiedCombatRuntime.initialState.enemy.maxToughness
  );
  if (breakDamageUpBasisPoints != null) {
    scenario.enemy.profile = {
      enemyId: BREAKABLE_ENEMY_ID,
      profileId: `joint-break-damage-up-${breakDamageUpBasisPoints}`,
      profileHash: `joint-break-damage-up-${breakDamageUpBasisPoints}-hash`,
      source: { identity: 'joint-runtime-regression', hash: 'test' },
      attributes: { maxToughness },
      breakRules: {
        recoveryDelayMs: 60000,
        recoveryRateBasisPoints: 1000,
        breakTimeMs: 11000,
        breakEndTimeMs: 1000,
        breakDamageUpBasisPoints,
        weaknessDamageMaximum: null,
        weaknessDamageMinimum: null,
        typeMultipliersBasisPoints: {
          physical: 10000,
          magic: 10000,
          heal: 10000,
        },
        elementMultipliersBasisPoints: Object.fromEntries(
          Array.from({ length: 10 }, (_, index) => [index, 10000])
        ),
      },
    };
  }
  scenario.initialRuntimeState = {
    ...(scenario.initialRuntimeState ?? {}),
    enemy: {
      ...(scenario.initialRuntimeState?.enemy ?? {}),
      toughness: {
        currentValue: maxToughness * initialToughnessRatio,
        maxValue: maxToughness,
      },
      inBreak: false,
      breakElapsedMs: 0,
      recoveryDelayRemainingMs: null,
    },
  };
  const originalActor = scenario.actions.find(
    action => action.id === 'joint-actor'
  );
  const originalKibo = scenario.actions.find(
    action => action.id === 'joint-kibo'
  );
  const beforeAction = {
    ...structuredClone(originalActor),
    id: 'same-frame-before',
    name: 'same-frame-before',
    actionKind: 'star-skill',
  };
  const actorAction = {
    ...originalActor,
    startMs: (jointStartFrame * 1000) / 60,
  };
  const kiboAction = {
    ...originalKibo,
    startMs: (jointStartFrame * 1000) / 60,
  };
  const afterAction = {
    ...structuredClone(originalActor),
    id: 'same-frame-after',
    name: 'same-frame-after',
    actionKind: 'star-skill',
  };
  scenario.actions = pairBeforeSurroundingPackets
    ? [actorAction, kiboAction, beforeAction, afterAction]
    : [beforeAction, actorAction, kiboAction, afterAction];
  scenario.actions = scenario.actions.map((action, index) => ({
    ...action,
    sourceSequencePath: [index],
  }));

  const originalActorResolution =
    prepared.verifiedActionVariantRuntime.actionResolutionById.get(
      'joint-actor'
    );
  const originalKiboResolution =
    prepared.verifiedActionVariantRuntime.actionResolutionById.get(
      'joint-kibo'
    );
  const createSurroundingResolution = actionId => {
    const resolution = structuredClone(originalActorResolution);
    resolution.actionId = actionId;
    resolution.hits = [
      {
        ...structuredClone(originalActorResolution.hits[0]),
        hitIndex: 1,
        trigger: {
          ...structuredClone(originalActorResolution.hits[0].trigger),
          startFrame: 40,
          impactFrame: 40,
        },
        damage: {
          ...structuredClone(originalActorResolution.hits[0].damage),
          weakBreakDamageRateBasisPoints:
            surroundingWeakBreakDamageRateBasisPoints,
        },
      },
    ];
    return resolution;
  };
  const actionResolutionById = new Map([
    ['same-frame-before', createSurroundingResolution('same-frame-before')],
    ['joint-actor', structuredClone(originalActorResolution)],
    ['joint-kibo', structuredClone(originalKiboResolution)],
    ['same-frame-after', createSurroundingResolution('same-frame-after')],
  ]);
  const originalPlanById = new Map(
    prepared.actionExecutionPlan.actions.map(entry => [entry.actionId, entry])
  );
  const actorPlan = originalPlanById.get('joint-actor');
  const kiboPlan = originalPlanById.get('joint-kibo');
  const actionExecutionPlan = {
    ...structuredClone(prepared.actionExecutionPlan),
    actions: scenario.actions.map((action, index) => ({
      ...structuredClone(action.id === 'joint-kibo' ? kiboPlan : actorPlan),
      actionId: action.id,
      execute: true,
      status: 'accepted',
      sourceSequenceIndex: index,
      violationCodes: [],
      unresolvedCodes: [],
    })),
  };
  const actionVariantRuntime = {
    ...prepared.verifiedActionVariantRuntime,
    actionResolutionById,
    actionResolutions: [...actionResolutionById.values()],
    executionBlocks: [],
    eventLog: [],
  };
  const damageEventGeneration = createVerifiedDamageEventGeneration({
    scenario,
    actionExecutionPlan,
    actionResolutionById,
    tuningGeneration: null,
  });
  return createVerifiedCombatRuntime({
    scenario,
    actionExecutionPlan,
    controlledActorTimeline: prepared.controlledActorTimeline,
    effectGeneration: prepared.verifiedBattleEffectGeneration,
    tuningGeneration: null,
    damageEventGeneration,
    effectTimeline: prepared.effectTimeline,
    actionVariantRuntime,
    kiboPassiveGeneration: null,
    criticalRandomSource: createDeterministicCriticalRandomSource({
      seed: 'joint-same-frame-four-stage',
    }),
  });
}

function findHit(runtime, actionId) {
  return runtime.damageEvents.find(
    event => event.type === 'VERIFIED_COMBAT_HIT' && event.actionId === actionId
  );
}

function expectJointPairHasNoSettlement(runtime) {
  expect(
    runtime.eventLog.some(
      event => event.type === 'VERIFIED_JOINT_ATTACK_ADMITTED'
    )
  ).toBe(false);
  expect(
    runtime.damageEvents.some(
      event =>
        ['joint-actor', 'joint-kibo'].includes(event.actionId) ||
        event.type === 'VERIFIED_JOINT_ATTACK_ATTACHED_TOUGHNESS_CLEAR'
    )
  ).toBe(false);
  expect(
    [...runtime.resourceEvents, ...runtime.kiboResourceEvents].some(event =>
      ['joint-actor', 'joint-kibo'].includes(event.actionId)
    )
  ).toBe(false);
  expect(runtime.finalState.enemy).toMatchObject({
    inBreak: false,
    toughness: runtime.initialState.enemy.toughness,
  });
}

function expectJointPairHasNoExecutionSideEffects(result) {
  expect(
    result.actionExecutionPlan.actions
      .filter(action => ['joint-actor', 'joint-kibo'].includes(action.actionId))
      .every(action => action.execute === false)
  ).toBe(true);
  expect(
    result.actionReadinessTimeline.cooldownWindows.some(window =>
      ['joint-actor', 'joint-kibo'].includes(window.actionId)
    )
  ).toBe(false);
  expect(
    result.effectTimeline.events.some(event =>
      ['joint-actor', 'joint-kibo'].includes(event.actionId)
    )
  ).toBe(false);
}
