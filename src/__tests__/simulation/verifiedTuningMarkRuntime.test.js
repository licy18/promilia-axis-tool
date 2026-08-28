import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { createWorkbenchAttackInputChainDrafts } from '../../domain/workbenchAttackInputChain';
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
import { createVerifiedTuningMarkGeneration } from '../../simulation/mechanics/verifiedTuningMarkGeneration';

const PANGPANG_ID = 101007;
const PANGPANG_NORMAL_SKILL_ID = 10100701;
const PANGPANG_ATTACK_INPUT = mechanicsPackage.actionMappings
  .find(
    mapping =>
      mapping.ownerId === PANGPANG_ID && mapping.actionKind === 'normal-attack'
  )
  .attackInputSegments.find(segment => segment.sequenceIndex === 3);

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified tuning mark runtime', () => {
  it('ships nine verified profiles while keeping unsafe action bindings unresolved', () => {
    const profiles = mechanicsPackage.tuningMechanicsCatalog.profiles;
    const effects = mechanicsPackage.controlBindings.flatMap(
      binding => binding.effects ?? []
    );
    const appliedAcquisitions = effects.filter(
      effect => effect.applied && effect.tuningMark
    );
    const appliedConsumes = effects.filter(
      effect => effect.applied && effect.tuningOverlimit
    );
    const unresolvedConsumes = effects.filter(
      effect => !effect.applied && effect.tuningOverlimit
    );

    expect(profiles).toHaveLength(9);
    expect(new Set(profiles.map(profile => profile.markId)).size).toBe(9);
    expect(
      Object.fromEntries(
        profiles.map(profile => [
          profile.markId,
          profile.markContainer.elementTypes,
        ])
      )
    ).toEqual({
      150: [31, 41, 1001],
      250: [37, 41, 1001],
      350: [35, 41, 1001],
      450: [32, 41, 1001],
      550: [34, 41, 1001],
      650: [33, 41, 1001],
      750: [32, 41, 1001],
      850: [32, 41, 1001],
      950: [38, 41, 1001],
    });
    expect(
      profiles.every(
        profile =>
          profile.markContainer.elementId === profile.markId &&
          profile.markContainer.sourceIdentity.includes(
            'battle-element-assets.jsonl#path_id='
          ) &&
          profile.markContainer.elementTypeSourceIdentity.endsWith('.types')
      )
    ).toBe(true);
    expect(
      profiles.every(
        profile =>
          profile.maxStacks === 5 &&
          profile.layerDurationMs === 20_000 &&
          profile.heldReadyMs === 5_000 &&
          profile.overlimitPacket.sourceIdentity
      )
    ).toBe(true);
    expect(appliedAcquisitions.length).toBeGreaterThan(0);
    expect(appliedConsumes.length).toBeGreaterThan(0);
    expect(unresolvedConsumes.every(effect => effect.reasons.length > 0)).toBe(
      true
    );
  });

  it('preserves ordered priority judgments and candidate packet mappings from source', () => {
    const cases = [
      {
        controlSkillId: 11200113,
        judgmentElementId: 112001260,
        candidates: [
          { priorityIndex: 0, markId: 250, packetElementId: 299 },
          { priorityIndex: 1, markId: 450, packetElementId: 499 },
        ],
      },
      {
        controlSkillId: 11100113,
        judgmentElementId: 111001332,
        candidates: [
          { priorityIndex: 0, markId: 750, packetElementId: 799 },
          { priorityIndex: 1, markId: 250, packetElementId: 299 },
        ],
      },
    ];

    for (const expected of cases) {
      const effects = mechanicsPackage.controlBindings
        .find(binding => binding.controlSkillId === expected.controlSkillId)
        .effects.filter(
          effect =>
            effect.tuningOverlimit?.judgmentElementId ===
            expected.judgmentElementId
        );

      expect(effects).toHaveLength(expected.candidates.length);
      expect(
        effects
          .map(effect => effect.tuningOverlimit)
          .map(contract => ({
            judgmentGroupIdentity: contract.judgmentGroupIdentity,
            runtimeSelectionMode: contract.runtimeSelectionMode,
            priorityDirection: contract.priorityDirection,
            candidates: contract.judgmentCandidates.map(candidate => ({
              priorityIndex: candidate.priorityIndex,
              markId: candidate.markId,
              packetElementId: candidate.packetElementId,
            })),
            consumerMethodRva:
              contract.priorityRuntimeEvidence?.consumerMethodRva,
            injectMethodRva: contract.priorityRuntimeEvidence?.injectMethodRva,
          }))
      ).toEqual(
        expected.candidates.map(() => ({
          judgmentGroupIdentity: expect.stringContaining(
            `:${expected.judgmentElementId}:`
          ),
          runtimeSelectionMode: 'priority-first-sufficient-candidate',
          priorityDirection: 'element-arr-index-ascending',
          candidates: expected.candidates,
          consumerMethodRva: '0x1385260',
          injectMethodRva: '0x1386950',
        }))
      );
    }
  });

  it('selects only the first sufficient candidate from one real multi-mark judgment', () => {
    const result = createDirectJudgmentGeneration({
      controlSkillId: 11200113,
      durationMs: 5_000,
      initialMarks: [
        createInheritedMarkWithCount(250, 2),
        createInheritedMarkWithCount(450, 2),
      ],
    });

    expect(projectConsumeEvents(result)).toEqual([
      { markId: 250, before: 2, after: 0, packetElementId: 299 },
    ]);
    expect(projectFinalMarkCounts(result, [250, 450])).toEqual({
      250: 0,
      450: 2,
    });
    expect(projectConsumeUnresolved(result)).toEqual([]);
  });

  it('falls through an insufficient first candidate and emits one selected packet', () => {
    const result = createDirectJudgmentGeneration({
      controlSkillId: 11200113,
      durationMs: 5_000,
      initialMarks: [
        createInheritedMarkWithCount(250, 1),
        createInheritedMarkWithCount(450, 2),
      ],
    });

    expect(projectConsumeEvents(result)).toEqual([
      { markId: 450, before: 2, after: 0, packetElementId: 499 },
    ]);
    expect(projectFinalMarkCounts(result, [250, 450])).toEqual({
      250: 1,
      450: 0,
    });
    expect(projectConsumeUnresolved(result)).toEqual([]);
  });

  it('reports one group diagnostic when no priority candidate is sufficient', () => {
    const result = createDirectJudgmentGeneration({
      controlSkillId: 11200113,
      durationMs: 5_000,
      initialMarks: [
        createInheritedMarkWithCount(250, 1),
        createInheritedMarkWithCount(450, 1),
      ],
    });

    expect(projectConsumeEvents(result)).toEqual([]);
    expect(projectConsumeUnresolved(result)).toEqual([
      expect.objectContaining({
        kind: 'tuning-consume-no-sufficient-priority-candidate',
        candidates: [
          { priorityIndex: 0, markId: 250, required: 2, current: 1 },
          { priorityIndex: 1, markId: 450, required: 2, current: 1 },
        ],
      }),
    ]);
  });

  it('publishes every direct consume judgment, including insufficient results', () => {
    const projectJudgments = count => {
      const result = createDirectJudgmentGeneration({
        controlSkillId: 10300213,
        durationMs: 5_000,
        initialMarks:
          count > 0 ? [createInheritedMarkWithCount(250, count)] : [],
      });
      return result.consumeJudgmentResults
        .filter(row => row.judgmentElementId === 103002273)
        .map(row => ({
          controlSkillId: row.controlSkillId,
          subSkillIndex: row.subSkillIndex,
          judgmentElementId: row.judgmentElementId,
          triggerFrame: row.triggerFrame,
          behaviorPathId: row.behaviorPathId,
          markCountAtJudgment: row.markCountAtJudgment,
          consumedCount: row.consumedCount,
          applied: row.applied,
          status: row.status,
          sourceIdentity: row.sourceIdentity,
        }));
    };

    expect(projectJudgments(2)).toEqual([
      {
        controlSkillId: 10300213,
        subSkillIndex: 0,
        judgmentElementId: 103002273,
        triggerFrame: 173,
        behaviorPathId: '2818728561424649950',
        markCountAtJudgment: 2,
        consumedCount: 1,
        applied: true,
        status: 'verified-tuning-consume-applied',
        sourceIdentity:
          'battle-effect:10300213:0:-8725062263845393396:2818728561424649950:173',
      },
      {
        controlSkillId: 10300213,
        subSkillIndex: 0,
        judgmentElementId: 103002273,
        triggerFrame: 237,
        behaviorPathId: '8489770418213277406',
        markCountAtJudgment: 1,
        consumedCount: 1,
        applied: true,
        status: 'verified-tuning-consume-applied',
        sourceIdentity:
          'battle-effect:10300213:0:-8725062263845393396:8489770418213277406:237',
      },
    ]);
    expect(projectJudgments(1).map(row => row.status)).toEqual([
      'verified-tuning-consume-applied',
      'verified-tuning-consume-insufficient-marks',
    ]);
    expect(projectJudgments(0).map(row => row.applied)).toEqual([false, false]);
  });

  it('applies the same priority selection to another real [750,250] judgment', () => {
    const result = createDirectJudgmentGeneration({
      controlSkillId: 11100113,
      durationMs: 5_000,
      initialMarks: [
        createInheritedMarkWithCount(750, 3),
        createInheritedMarkWithCount(250, 3),
      ],
    });

    expect(projectConsumeEvents(result)).toEqual([
      { markId: 750, before: 3, after: 0, packetElementId: 799 },
    ]);
    expect(projectFinalMarkCounts(result, [750, 250])).toEqual({
      250: 3,
      750: 0,
    });
  });

  it('selects from the real state after same-frame expiry and acquisition', () => {
    const triggerTimeMs = (191 * 1000) / 60;
    const expiredFirst = createDirectJudgmentGeneration({
      controlSkillId: 11200113,
      durationMs: 5_000,
      initialMarks: [
        {
          ...createInheritedMarkWithCount(250, 2),
          decayRemainingMs: triggerTimeMs,
        },
        createInheritedMarkWithCount(450, 2),
      ],
    });
    const acquiredFirst = createDirectJudgmentGeneration({
      controlSkillId: 11200113,
      durationMs: 5_000,
      initialMarks: [
        createInheritedMarkWithCount(250, 1),
        createInheritedMarkWithCount(450, 2),
      ],
      additionalEffects: [
        createDirectAcquireEffect('same-frame-thunder-acquire', 250, 191, -1),
      ],
    });

    expect(projectConsumeEvents(expiredFirst)).toEqual([
      { markId: 450, before: 2, after: 0, packetElementId: 499 },
    ]);
    expect(projectFinalMarkCounts(expiredFirst, [250, 450])).toEqual({
      250: 1,
      450: 0,
    });
    expect(projectConsumeEvents(acquiredFirst)).toEqual([
      { markId: 250, before: 2, after: 0, packetElementId: 299 },
    ]);
    expect(projectFinalMarkCounts(acquiredFirst, [250, 450])).toEqual({
      250: 0,
      450: 2,
    });
  });

  it('refreshes one shared timer on real acquisitions and then decays one layer every 20 seconds', () => {
    const result = simulateVerifiedProject({
      durationMs: 42_000,
      actions: [
        createWorkbenchActionDraft({
          id: 'han-star-skill',
          type: 'skill',
          actorCharacterId: 101003,
          skillId: 10100312,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 1_400,
        }),
      ],
    });
    const fireChanges = result.verifiedTuningMarkGeneration.events
      .filter(event => event.profileKey === 'fire' && event.delta !== 0)
      .map(event => ({
        kind: event.kind,
        timeMs: event.timeMs,
        before: event.before,
        after: event.after,
      }));

    expect(fireChanges).toEqual([
      { kind: 'acquire', timeMs: 1050, before: 0, after: 1 },
      {
        kind: 'acquire',
        timeMs: 1166.666667,
        before: 1,
        after: 2,
      },
      {
        kind: 'expire',
        timeMs: 21166.666667,
        before: 2,
        after: 1,
      },
      {
        kind: 'expire',
        timeMs: 41166.666667,
        before: 1,
        after: 0,
      },
    ]);
    expect(
      result.verifiedTuningMarkGeneration.events.find(
        event =>
          event.profileKey === 'fire' &&
          event.kind === 'acquire' &&
          event.timeMs === 1166.666667
      ).decayDueAtMs
    ).toBe(21166.666667);
    expect(
      result.effectTimeline.events.some(
        event =>
          event.effectId === 'tuning-mark:150:persistent' &&
          event.appliedToCalculators
      )
    ).toBe(true);
    const persistentCommands =
      result.verifiedTuningMarkGeneration.effectCommands.filter(
        command => command.effectId === 'tuning-mark:150:persistent'
      );
    expect(persistentCommands.length).toBeGreaterThan(1);
    expect(
      persistentCommands.every(command =>
        command.tags.includes('tuning-mark-resource-mirror')
      )
    ).toBe(true);
  });

  it('projects all nine held profiles from one real hit without duplicate input nodes', () => {
    const initialRuntimeState = {
      tuningMarks: mechanicsPackage.tuningMechanicsCatalog.profiles.map(
        profile => createInheritedMark(profile, 20_000)
      ),
    };
    const result = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState,
      actions: [createPangpangAttack('pangpang-hit', 0)],
    });
    const heldCombatEvents =
      result.verifiedTuningMarkGeneration.combatEvents.filter(event =>
        event.kind.startsWith('held-')
      );
    const heldTriggers = result.verifiedTuningMarkGeneration.events.filter(
      event => event.kind === 'held-trigger'
    );
    const tuningDamageEvents = result.verifiedCombatRuntime.damageEvents.filter(
      event => event.type === 'VERIFIED_TUNING_DAMAGE'
    );

    expect(heldCombatEvents).toHaveLength(10);
    expect(heldTriggers).toHaveLength(9);
    expect(new Set(heldTriggers.map(event => event.profileKey)).size).toBe(9);
    expect(tuningDamageEvents).toHaveLength(10);
    expect(
      tuningDamageEvents.filter(event => event.payload.profileKey === 'light')
    ).toHaveLength(2);
    expect(
      Number(
        tuningDamageEvents.find(event => event.payload.profileKey === 'earth')
          .payload.formulaBreakdown.weaknessResult.deducted
      )
    ).toBeGreaterThan(0);
  });

  it('keeps stack-over-limit and real tuning damage independent from finite HP in infinite mode', () => {
    const tuningMarks = mechanicsPackage.tuningMechanicsCatalog.profiles.map(
      profile => createInheritedMark(profile, 20_000)
    );
    const targetPolicy = {
      hpMode: 'infinite',
      toughnessMode: 'disabled',
      breakMode: 'disabled',
      deathTruncation: 'disabled',
    };
    const baseline = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState: { tuningMarks },
      targetPolicy,
      actions: [createPangpangAttack('pangpang-hit', 0)],
    });
    const lowHp = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState: {
        enemy: {
          hp: { currentValue: 1, maxValue: 1 },
          toughness: { currentValue: 1, maxValue: 1 },
        },
        tuningMarks,
      },
      targetPolicy,
      actions: [createPangpangAttack('pangpang-hit', 0)],
    });
    const projectDamage = result =>
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.type === 'VERIFIED_TUNING_DAMAGE')
        .map(event => ({
          profileKey: event.payload.profileKey,
          tuningKind: event.payload.tuningKind,
          rawDamage: event.payload.rawDamage,
          mode: event.payload.formulaBreakdown.verifiedResult.mode,
        }));
    const baselineDamage = projectDamage(baseline);

    expect(new Set(baselineDamage.map(row => row.mode))).toEqual(
      new Set(['stack_over_limit', 'real'])
    );
    expect(projectDamage(lowHp)).toEqual(baselineDamage);
  });

  it('refreshes the shared timer at five layers and ignores stale same-time expiry tasks', () => {
    const fire = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'fire'
    );
    const initialMark = {
      ...createInheritedMark(fire, 1_000),
      layers: Array.from({ length: 5 }, (_, index) => ({
        sourceActionId: `inherited-fire-${index + 1}`,
        sourceActorId: 'actor-direct',
        sourceIdentity: { layer: index + 1 },
      })),
    };
    const result = createDirectTuningGeneration({
      durationMs: 21_000,
      initialMark,
      effects: [
        createDirectAcquireEffect('refresh-full-1', fire.markId, 30, 0),
        createDirectAcquireEffect('refresh-full-2', fire.markId, 30, 1),
      ],
    });
    const fireEvents = result.events.filter(
      event => event.profileKey === 'fire'
    );

    expect(
      fireEvents
        .filter(event => event.kind === 'acquire')
        .map(event => ({
          timeMs: event.timeMs,
          before: event.before,
          delta: event.delta,
          after: event.after,
          decayDueAtMs: event.decayDueAtMs,
        }))
    ).toEqual([
      {
        timeMs: 500,
        before: 5,
        delta: 0,
        after: 5,
        decayDueAtMs: 20_500,
      },
      {
        timeMs: 500,
        before: 5,
        delta: 0,
        after: 5,
        decayDueAtMs: 20_500,
      },
    ]);
    expect(
      fireEvents
        .filter(event => event.kind === 'expire')
        .map(event => ({
          timeMs: event.timeMs,
          before: event.before,
          after: event.after,
        }))
    ).toEqual([{ timeMs: 20_500, before: 5, after: 4 }]);
    expect(result.summary.refreshAtMaximumEventCount).toBe(2);
    expect(
      result.finalState.find(state => state.profileKey === 'fire')
    ).toMatchObject({
      currentValue: 4,
      decayRemainingMs: 19_500,
    });
  });

  it('keeps the shared deadline on partial consumption and invalidates it on full consumption', () => {
    const wind = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'wind'
    );
    const consumeEffect = createDirectConsumeEffect(
      'consume-one-wind',
      wind.markId,
      30,
      1
    );
    const partial = createDirectTuningGeneration({
      durationMs: 1_500,
      initialMark: {
        ...createInheritedMark(wind, 1_000),
        layers: [{ sourceActionId: 'wind-1' }, { sourceActionId: 'wind-2' }],
      },
      effects: [consumeEffect],
    });
    const full = createDirectTuningGeneration({
      durationMs: 1_500,
      initialMark: createInheritedMark(wind, 1_000),
      effects: [consumeEffect],
    });

    expect(
      partial.events
        .filter(event => event.profileKey === 'wind')
        .map(event => ({
          kind: event.kind,
          timeMs: event.timeMs,
          before: event.before,
          after: event.after,
          decayDueAtMs: event.decayDueAtMs,
        }))
    ).toEqual([
      {
        kind: 'consume',
        timeMs: 500,
        before: 2,
        after: 1,
        decayDueAtMs: 1_000,
      },
      {
        kind: 'expire',
        timeMs: 1_000,
        before: 1,
        after: 0,
        decayDueAtMs: null,
      },
    ]);
    expect(
      full.events
        .filter(event => event.profileKey === 'wind')
        .map(event => ({
          kind: event.kind,
          timeMs: event.timeMs,
          before: event.before,
          after: event.after,
          decayDueAtMs: event.decayDueAtMs,
        }))
    ).toEqual([
      {
        kind: 'consume',
        timeMs: 500,
        before: 1,
        after: 0,
        decayDueAtMs: null,
      },
    ]);
  });

  it('applies expiry before a same-time acquisition and starts a fresh shared interval', () => {
    const fire = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'fire'
    );
    const result = createDirectTuningGeneration({
      durationMs: 1_500,
      initialMark: createInheritedMark(fire, 1_000),
      effects: [
        createDirectAcquireEffect(
          'same-time-expiry-and-acquire',
          fire.markId,
          60,
          0
        ),
      ],
    });

    expect(
      result.events
        .filter(event => event.profileKey === 'fire')
        .sort(
          (left, right) =>
            left.runtimeSequenceIndex - right.runtimeSequenceIndex
        )
        .map(event => ({
          kind: event.kind,
          timeMs: event.timeMs,
          before: event.before,
          after: event.after,
          decayDueAtMs: event.decayDueAtMs,
        }))
    ).toEqual([
      {
        kind: 'expire',
        timeMs: 1_000,
        before: 1,
        after: 0,
        decayDueAtMs: null,
      },
      {
        kind: 'acquire',
        timeMs: 1_000,
        before: 0,
        after: 1,
        decayDueAtMs: 21_000,
      },
    ]);
  });

  it('respects the five-second held trigger gate across independent hits', () => {
    const fire = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'fire'
    );
    const result = simulateVerifiedProject({
      durationMs: 8_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMark(fire, 20_000)],
      },
      actions: [
        createPangpangAttack('pangpang-hit-1', 0),
        createPangpangAttack('pangpang-hit-2', 1_000),
        createPangpangAttack('pangpang-hit-3', 6_000),
      ],
    });
    const fireHeld = result.verifiedTuningMarkGeneration.combatEvents.filter(
      event => event.kind === 'held-damage' && event.profile.key === 'fire'
    );

    expect(fireHeld.map(event => event.actionId)).toEqual([
      'pangpang-hit-1',
      'pangpang-hit-3',
    ]);
  });

  it('consumes three inherited wind marks and restores six absolute SP without sharing', () => {
    const wind = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'wind'
    );
    const result = simulateVerifiedProject({
      durationMs: 9_000,
      initialSpByCharacterId: { 109001: 100 },
      initialRuntimeState: {
        tuningMarks: [
          createInheritedMark(wind, 20_000),
          // Normalization merges one row per mark, so put all layers together.
        ].map(mark => ({
          ...mark,
          layers: [
            ...mark.layers,
            ...createInheritedMark(wind, 20_000).layers,
            ...createInheritedMark(wind, 20_000).layers,
          ],
        })),
      },
      actions: [
        createWorkbenchActionDraft({
          id: 'muyin-ultimate',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900113,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 3_600,
        }),
      ],
    });
    const consume = result.verifiedTuningMarkGeneration.events.find(
      event => event.kind === 'consume' && event.profileKey === 'wind'
    );
    const directSp = result.verifiedCombatRuntime.resourceEvents.find(
      event => event.payload.reason === 'tuning-overlimit-direct-sp'
    );
    const overlimitEvents =
      result.verifiedTuningMarkGeneration.combatEvents.filter(
        event =>
          event.kind === 'overlimit-damage' && event.profile.key === 'wind'
      );
    const overlimitTransactions = (
      result.verifiedDamageEventGeneration?.transactions ?? []
    ).filter(
      transaction =>
        transaction.sourceKind === 'tuning-damage' &&
        transaction.tuningEvent?.kind === 'overlimit-damage' &&
        Number(transaction.tuningEvent?.profile?.markId) === Number(wind.markId)
    );
    const passiveCommands =
      result.verifiedActionVariantRuntime.effectCommands.filter(
        command =>
          String(command.id).startsWith('verified-passive|battle-start|') &&
          command.sourceActorId === 'actor-109001'
      );

    expect(consume).toMatchObject({
      timeMs: 3050,
      before: 3,
      delta: -3,
      after: 0,
    });
    expect(overlimitEvents.length).toBeGreaterThan(0);
    expect(
      overlimitEvents.every(event => event.eventContext.propertyTags)
    ).toBe(true);
    expect(overlimitEvents[0].eventContext.propertyTags).toEqual([307]);
    expect(overlimitTransactions.length).toBeGreaterThan(0);
    expect(
      overlimitTransactions[0].beforeEvent.eventContext.propertyTags
    ).toEqual(expect.arrayContaining([307]));
    expect(passiveCommands).toHaveLength(1);
    expect(passiveCommands[0].modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 21,
          valueRaw: 5400,
          propertyTags: [307],
        }),
      ])
    );
    expect(directSp.payload).toMatchObject({
      valueUnit: 'absolute-sp-points',
      change: 6,
      formula: {
        consumedMarks: 3,
        spPerConsumedMark: 2,
        noShare: true,
        noEnhancement: true,
      },
    });
    expect(
      result.verifiedCombatRuntime.damageEvents.some(
        event =>
          event.type === 'VERIFIED_TUNING_DAMAGE' &&
          event.payload.profileKey === 'wind' &&
          event.payload.tuningKind === 'overlimit-damage'
      )
    ).toBe(true);
  });

  it('restores one SP per charged hit only while a thunder mark is present', () => {
    const thunder = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'thunder'
    );
    const withMark = simulateVerifiedProject({
      durationMs: 3_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMark(thunder, 20_000)],
      },
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-charged',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900101,
          actionVariantIndex: 1,
          startMs: 0,
          durationMs: 1_200,
        }),
      ],
    });
    const presenceEvents =
      withMark.verifiedTuningMarkGeneration.combatEvents.filter(
        event => event.kind === 'conditional-direct-sp'
      );
    expect(presenceEvents).toHaveLength(3);
    expect(presenceEvents.map(event => event.timeMs)).toEqual([
      83.333333, 333.333333, 1000,
    ]);
    const spEvents = withMark.verifiedCombatRuntime.resourceEvents.filter(
      event => event.payload.reason === 'tuning-conditional-direct-sp'
    );
    expect(spEvents).toHaveLength(3);
    expect(spEvents.reduce((sum, event) => sum + event.payload.change, 0)).toBe(
      3
    );

    const withoutMark = simulateVerifiedProject({
      durationMs: 3_000,
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-charged',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900101,
          actionVariantIndex: 1,
          startMs: 0,
          durationMs: 1_200,
        }),
      ],
    });
    expect(
      withoutMark.verifiedTuningMarkGeneration.combatEvents.filter(
        event => event.kind === 'conditional-direct-sp'
      )
    ).toHaveLength(0);
  });

  it('gates Moyin A5 acquisition and A4 consumption on the real Brilliant state', () => {
    const thunder = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'thunder'
    );
    const runA5 = brilliant =>
      simulateVerifiedProject({
        durationMs: 7_000,
        actions: [
          ...(brilliant ? [createMoyinBrilliantAction('a5-brilliant', 0)] : []),
          ...createMoyinNormalChain({
            id: brilliant ? 'a5-on' : 'a5-off',
            sequenceIndex: 5,
            chainStartMs: brilliant ? 1_000 : 0,
          }),
        ],
      });
    const a5Off = runA5(false);
    const a5On = runA5(true);
    expect(
      a5Off.verifiedTuningMarkGeneration.events.filter(
        event => event.kind === 'acquire' && event.profileKey === 'thunder'
      )
    ).toEqual([]);
    expect(
      a5Off.verifiedActionVariantRuntime.actionResolutionById.get('a5-off')
        .suppressedEffects
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          elementId: 250,
          reason: 'target-state-activation-condition-not-met',
        }),
      ])
    );
    expect(
      a5On.verifiedTuningMarkGeneration.events.filter(
        event => event.kind === 'acquire' && event.actionId === 'a5-on'
      )
    ).toEqual([expect.objectContaining({ before: 0, after: 2, delta: 2 })]);

    const runA4 = ({ brilliant, markCount }) =>
      simulateVerifiedProject({
        durationMs: 6_000,
        initialRuntimeState:
          markCount > 0
            ? {
                tuningMarks: [
                  createInheritedMarkWithCount(thunder.markId, markCount),
                ],
              }
            : null,
        actions: [
          ...(brilliant ? [createMoyinBrilliantAction('a4-brilliant', 0)] : []),
          ...createMoyinNormalChain({
            id: `a4-${brilliant ? 'on' : 'off'}-mark-${markCount}`,
            sequenceIndex: 4,
            chainStartMs: brilliant ? 1_000 : 0,
          }),
        ],
      });
    const cases = [
      { brilliant: false, markCount: 1, consumed: 0, packets: 0 },
      { brilliant: true, markCount: 0, consumed: 0, packets: 0 },
      { brilliant: true, markCount: 1, consumed: 1, packets: 1 },
      { brilliant: true, markCount: 2, consumed: 1, packets: 1 },
    ];
    for (const expected of cases) {
      const result = runA4(expected);
      const actionId = `a4-${expected.brilliant ? 'on' : 'off'}-mark-${expected.markCount}`;
      const consumes = result.verifiedTuningMarkGeneration.events.filter(
        event => event.kind === 'consume' && event.actionId === actionId
      );
      const packets = result.verifiedTuningMarkGeneration.combatEvents.filter(
        event =>
          event.kind === 'overlimit-damage' && event.actionId === actionId
      );
      expect(consumes).toHaveLength(expected.consumed);
      expect(packets).toHaveLength(expected.packets);
      if (expected.consumed) {
        expect(consumes[0]).toMatchObject({
          delta: -1,
          before: expected.markCount,
          after: expected.markCount - 1,
        });
      }
      expect(
        result.verifiedActionVariantRuntime.targetStateRuntime.events.filter(
          event =>
            event.actionId === actionId && event.payload.operation === 'consume'
        )
      ).toEqual([]);
    }
  });

  it('keeps Brilliant through repeated A4 settlement and the active chase chain', () => {
    const thunder = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'thunder'
    );
    const repeated = simulateVerifiedProject({
      durationMs: 10_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMarkWithCount(thunder.markId, 2)],
      },
      actions: [
        createMoyinBrilliantAction('repeat-brilliant', 0),
        ...createMoyinNormalChain({
          id: 'repeat-a4-1',
          sequenceIndex: 4,
          chainStartMs: 1_000,
        }),
        createMoyinBrilliantAction('repeat-brilliant-refresh', 4_000),
        ...createMoyinNormalChain({
          id: 'repeat-a4-2',
          sequenceIndex: 4,
          chainStartMs: 5_500,
          attackGroupId: 'repeat-a4-chain-2',
        }),
      ],
    });
    expect(
      repeated.verifiedTuningMarkGeneration.events
        .filter(event => event.kind === 'consume')
        .map(event => [event.actionId, event.before, event.after])
    ).toEqual([
      ['repeat-a4-1', 2, 1],
      ['repeat-a4-2', 1, 0],
    ]);
    expect(
      repeated.verifiedTuningMarkGeneration.combatEvents
        .filter(event => event.kind === 'overlimit-damage')
        .map(event => event.actionId)
    ).toEqual(['repeat-a4-1', 'repeat-a4-2']);
    expect(
      repeated.verifiedActionVariantRuntime.targetStateRuntime.events.filter(
        event => event.payload.operation === 'consume'
      )
    ).toEqual([]);
    expect(
      repeated.verifiedActionVariantRuntime.targetStateRuntime.finalState.find(
        state => state.stateIdentity === 'moyin-brilliant'
      )
    ).toMatchObject({ currentValue: 1 });

    const chase = simulateVerifiedProject({
      durationMs: 10_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMarkWithCount(thunder.markId, 2)],
      },
      actions: [
        createMoyinBrilliantAction('moyin-brilliant-before-chase', 0),
        createWorkbenchActionDraft({
          id: 'moyin-star-for-chase',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionKind: 'star-skill',
          actionVariantIndex: 0,
          startMs: 1_000,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-active-chase',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900101,
          actionKind: 'normal-attack',
          actionVariantIndex: 0,
          startMs: 1_750,
          durationMs: 500,
          contextActionId: 'moyin-star-for-chase',
          attackInputExpansionMode: 'single-input',
          attackInputChainSelectionSource: 'user-explicit',
          attackInput: {
            identity:
              'actor|109001|10900101|0|10900101|normal-attack|attack-input-1',
            controlSkillId: 10900101,
            selectedSubSkillIndex: 0,
            sequenceIndex: 1,
            sequenceTotal: 5,
            durationFrames: 60,
            durationStatus: 'applied',
            sourceEvidenceStatus: 'confirmed-structured-data',
          },
        }),
        createMoyinBrilliantAction('moyin-brilliant-after-chase', 4_000),
        ...createMoyinNormalChain({
          id: 'moyin-a4-after-chase',
          sequenceIndex: 4,
          chainStartMs: 5_000,
        }),
      ],
    });
    expect(
      chase.verifiedTuningMarkGeneration.events
        .filter(event => event.kind === 'consume')
        .map(event => [event.actionId, event.before, event.after])
    ).toEqual([
      ['moyin-active-chase', 2, 1],
      ['moyin-a4-after-chase', 1, 0],
    ]);
    expect(
      chase.verifiedActionVariantRuntime.targetStateRuntime.events.filter(
        event => event.payload.operation === 'consume'
      )
    ).toEqual([]);
    expect(
      chase.verifiedActionVariantRuntime.targetStateRuntime.events
        .filter(event => ['gain', 'refresh'].includes(event.payload.operation))
        .map(event => [event.actionId, event.payload.operation])
    ).toEqual([
      ['moyin-brilliant-before-chase', 'gain'],
      ['moyin-active-chase', 'refresh'],
      ['moyin-brilliant-after-chase', 'refresh'],
    ]);
  });

  it('expires Brilliant on the exact eight-second right-open boundary', () => {
    const runA5At = startMs =>
      simulateVerifiedProject({
        durationMs: 10_000,
        actions: [
          createMoyinBrilliantAction('boundary-brilliant', 0),
          ...createMoyinNormalChain({
            id: 'boundary-a5',
            sequenceIndex: 5,
            targetStartMs: startMs,
          }),
        ],
      });
    const inside = runA5At(7_716.666);
    const exact = runA5At(7_733.333334);
    expect(
      inside.verifiedTuningMarkGeneration.events.filter(
        event => event.kind === 'acquire' && event.actionId === 'boundary-a5'
      )
    ).toHaveLength(1);
    expect(
      exact.verifiedTuningMarkGeneration.events.filter(
        event => event.kind === 'acquire' && event.actionId === 'boundary-a5'
      )
    ).toHaveLength(0);
    expect(
      exact.verifiedActionVariantRuntime.targetStateRuntime.events
        .filter(event => ['VERIFIED_TARGET_STATE_CHANGE'].includes(event.type))
        .map(event => [event.payload.operation, event.timeMs])
    ).toEqual([
      ['gain', 516.666667],
      ['expire', 8516.666667],
    ]);
  });

  it('resets exactly one star-skill charge cooldown once when the ultimate is accepted', () => {
    const result = simulateVerifiedProject({
      durationMs: 8_000,
      initialSpByCharacterId: { 109001: 100 },
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-star-1',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-star-2',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 1_000,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-ultimate',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900113,
          actionVariantIndex: 0,
          startMs: 2_000,
          durationMs: 3_600,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-star-3',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 6_000,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-star-4',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 7_000,
          durationMs: 1_000,
        }),
      ],
    });
    const cooldownViolations = (
      result.actionRuleDiagnostics?.diagnostics ?? []
    ).filter(
      diagnostic =>
        diagnostic.code === 'skill-cooldown-active' &&
        diagnostic.actionId === 'moyin-star-3'
    );
    expect(cooldownViolations).toHaveLength(0);
    const readiness =
      result.actionRuleDiagnostics?.readinessTimeline?.actions ?? [];
    const star3Readiness = readiness.find(
      row => row.actionId === 'moyin-star-3'
    );
    expect(star3Readiness?.status).toBe('ready');
    const star4Readiness = readiness.find(
      row => row.actionId === 'moyin-star-4'
    );
    expect(star4Readiness).toMatchObject({
      status: 'blocked',
      executable: false,
      violationCodes: ['skill-cooldown-active'],
      cooldown: {
        availableBefore: 0,
        availableAfter: 0,
        nextReadyAtMs: 17000,
      },
    });
    expect(result.actionRuleDiagnostics?.cooldownReductionTransactions).toEqual(
      [
        expect.objectContaining({
          sourceActionId: 'moyin-ultimate',
          sourceElementId: 109001171,
          timeMs: 2000,
          slot: -1,
          cdRecoveryType: 0,
          targetSkillId: 10900112,
          beforeReadyAtMs: 15000,
          afterReadyAtMs: 2000,
          beforeChargeCount: 0,
          afterChargeCount: 1,
          beforeCoolTimeMs: 13000,
          afterCoolTimeMs: 15000,
          nextReadyAtMs: 17000,
          restoredChargeCount: 1,
          consumed: true,
          appliedToSimulationResults: true,
        }),
      ]
    );
  });

  it('fans a slot-minus-one cooldown recovery out to every active actor cooldown', () => {
    const result = simulateVerifiedProject({
      durationMs: 9_500,
      initialSpByCharacterId: { 109001: 100 },
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-secondary-cooldown',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900121,
          actionKind: 'perfect-parry',
          actionVariantIndex: 3,
          startMs: 0,
          durationMs: 666.666667,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-fanout-star-1',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 2_500,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-fanout-star-2',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 3_500,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-fanout-ultimate',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900113,
          actionVariantIndex: 0,
          startMs: 4_500,
          durationMs: 3_600,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-fanout-star-3',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 8_500,
          durationMs: 1_000,
        }),
      ],
    });
    expect(
      result.actionRuleDiagnostics.readinessTimeline.actions.find(
        row => row.actionId === 'moyin-fanout-star-3'
      )
    ).toMatchObject({ status: 'ready', executable: true });
    expect(
      result.actionRuleDiagnostics.readinessTimeline.actions.find(
        row => row.actionId === 'moyin-secondary-cooldown'
      )
    ).toMatchObject({
      status: 'ready',
      executable: true,
      cooldown: { cooldownMs: 7_000 },
    });
    const transactions = (
      result.actionRuleDiagnostics.cooldownReductionTransactions ?? []
    ).filter(
      transaction => transaction.sourceActionId === 'moyin-fanout-ultimate'
    );
    expect(
      transactions.map(transaction => ({
        targetSkillId: transaction.targetSkillId,
        targetOrdinal: transaction.targetOrdinal,
        targetCount: transaction.targetCount,
        candidateSkillIds: transaction.candidateSkillIds,
        status: transaction.status,
        targetResolutionStatus: transaction.targetResolutionStatus,
        appliedToSimulationResults: transaction.appliedToSimulationResults,
      }))
    ).toEqual([
      {
        targetSkillId: 10900112,
        targetOrdinal: 0,
        targetCount: 2,
        candidateSkillIds: [10900112, 10900121],
        status: 'cooldown-reduction-transaction-applied',
        targetResolutionStatus: 'all-active-cooldowns-at-effect-time-resolved',
        appliedToSimulationResults: true,
      },
      {
        targetSkillId: 10900121,
        targetOrdinal: 1,
        targetCount: 2,
        candidateSkillIds: [10900112, 10900121],
        status: 'cooldown-reduction-transaction-applied',
        targetResolutionStatus: 'all-active-cooldowns-at-effect-time-resolved',
        appliedToSimulationResults: true,
      },
    ]);
  });

  it('does not bank a slot-minus-one cooldown reset when no target is cooling down', () => {
    const result = simulateVerifiedProject({
      durationMs: 8_000,
      initialSpByCharacterId: { 109001: 100 },
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-ultimate-no-cd',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900113,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 3_600,
        }),
        ...[4_000, 5_000, 6_000].map((startMs, index) =>
          createWorkbenchActionDraft({
            id: `moyin-star-after-empty-${index + 1}`,
            type: 'skill',
            actorCharacterId: 109001,
            skillId: 10900112,
            actionVariantIndex: 0,
            startMs,
            durationMs: 1_000,
          })
        ),
      ],
    });
    expect(result.actionRuleDiagnostics.cooldownReductionTransactions).toEqual([
      expect.objectContaining({
        sourceActionId: 'moyin-ultimate-no-cd',
        status: 'cooldown-reduction-transaction-consumed-no-active-target',
        targetResolutionStatus: 'no-active-cooldown-at-effect-time',
        consumed: true,
        appliedToSimulationResults: false,
      }),
    ]);
    expect(
      result.actionRuleDiagnostics.readinessTimeline.actions.find(
        row => row.actionId === 'moyin-star-after-empty-3'
      )
    ).toMatchObject({
      status: 'blocked',
      violationCodes: ['skill-cooldown-active'],
    });
  });

  it('does not materialize a cooldown reset from an SP-blocked ultimate', () => {
    const result = simulateVerifiedProject({
      durationMs: 8_000,
      initialSpByCharacterId: { 109001: 0 },
      actions: [
        ...[0, 1_000].map((startMs, index) =>
          createWorkbenchActionDraft({
            id: `moyin-star-before-blocked-ultimate-${index + 1}`,
            type: 'skill',
            actorCharacterId: 109001,
            skillId: 10900112,
            actionVariantIndex: 0,
            startMs,
            durationMs: 1_000,
          })
        ),
        createWorkbenchActionDraft({
          id: 'moyin-ultimate-sp-blocked',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900113,
          actionVariantIndex: 0,
          startMs: 2_000,
          durationMs: 3_600,
        }),
        createWorkbenchActionDraft({
          id: 'moyin-star-after-blocked-ultimate',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900112,
          actionVariantIndex: 0,
          startMs: 6_000,
          durationMs: 1_000,
        }),
      ],
    });
    expect(
      result.actionExecutionPlan.actions.find(
        row => row.actionId === 'moyin-ultimate-sp-blocked'
      )
    ).toMatchObject({ execute: false });
    expect(result.actionRuleDiagnostics.cooldownReductionTransactions).toEqual(
      []
    );
    expect(
      result.actionRuleDiagnostics.readinessTimeline.actions.find(
        row => row.actionId === 'moyin-star-after-blocked-ultimate'
      )
    ).toMatchObject({
      status: 'blocked',
      violationCodes: ['skill-cooldown-active'],
    });
  });

  it('freezes a shared charge timer at full, consumes each legal reset once, and honors the exact recovery boundary', () => {
    const createActions = boundaryStartMs => [
      createWorkbenchActionDraft({
        id: 'moyin-shared-star-1',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900112,
        actionVariantIndex: 0,
        startMs: 0,
        durationMs: 1_000,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-star-2',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900112,
        actionVariantIndex: 0,
        startMs: 1_000,
        durationMs: 1_000,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-ultimate-1',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900113,
        actionVariantIndex: 0,
        startMs: 2_000,
        durationMs: 3_600,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-sp-refill',
        type: 'resource',
        actorCharacterId: 109001,
        startMs: 6_000,
        resource: 'sp',
        change: 100,
        reason: 'cooldown-reset-second-legal-cast-test',
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-ultimate-2',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900113,
        actionVariantIndex: 0,
        startMs: 12_000,
        durationMs: 3_600,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-ultimate-overlap-blocked',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900113,
        actionVariantIndex: 0,
        startMs: 12_500,
        durationMs: 3_600,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-star-after-full-1',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900112,
        actionVariantIndex: 0,
        startMs: 17_000,
        durationMs: 1_000,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-star-after-full-2',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900112,
        actionVariantIndex: 0,
        startMs: 18_000,
        durationMs: 1_000,
      }),
      createWorkbenchActionDraft({
        id: 'moyin-shared-star-boundary',
        type: 'skill',
        actorCharacterId: 109001,
        skillId: 10900112,
        actionVariantIndex: 0,
        startMs: boundaryStartMs,
        durationMs: 1_000,
      }),
    ];
    const exact = simulateVerifiedProject({
      durationMs: 33_000,
      initialSpByCharacterId: { 109001: 100 },
      actions: createActions(32_000),
    });
    const transactions =
      exact.actionRuleDiagnostics.cooldownReductionTransactions;

    expect(transactions).toHaveLength(2);
    expect(transactions.map(transaction => transaction.sourceActionId)).toEqual(
      ['moyin-shared-ultimate-1', 'moyin-shared-ultimate-2']
    );
    expect(new Set(transactions.map(row => row.eventIdentity)).size).toBe(2);
    expect(
      transactions.every(row => Array.isArray(row.sourceSequencePath))
    ).toBe(true);
    expect(transactions[1]).toMatchObject({
      beforeChargeCount: 1,
      afterChargeCount: 2,
      beforeCoolTimeMs: 5_000,
      afterCoolTimeMs: 15_000,
      beforeSharedTimerRunning: true,
      afterSharedTimerRunning: false,
      nextReadyAtMs: null,
      restoredChargeCount: 1,
      discardedReductionMs: 15_000,
      consumed: true,
      appliedToSimulationResults: true,
    });
    expect(
      exact.actionExecutionPlan.actions.find(
        row => row.actionId === 'moyin-shared-ultimate-overlap-blocked'
      )
    ).toMatchObject({
      execute: false,
      violationCodes: expect.arrayContaining(['action-lane-overlap']),
    });

    const readinessById = new Map(
      exact.actionRuleDiagnostics.readinessTimeline.actions.map(row => [
        row.actionId,
        row,
      ])
    );
    expect(
      readinessById.get('moyin-shared-star-after-full-1').cooldown
    ).toMatchObject({
      availableBefore: 2,
      availableAfter: 1,
      nextReadyAtMs: 32_000,
      chargeStateBefore: {
        currentChargeCount: 2,
        coolTimeMs: 15_000,
        sharedTimerRunning: false,
      },
      chargeStateAfter: {
        currentChargeCount: 1,
        coolTimeMs: 15_000,
        sharedTimerRunning: true,
      },
    });
    expect(
      readinessById.get('moyin-shared-star-after-full-2').cooldown
    ).toMatchObject({
      availableBefore: 1,
      availableAfter: 0,
      nextReadyAtMs: 32_000,
      chargeStateBefore: {
        currentChargeCount: 1,
        coolTimeMs: 14_000,
      },
      chargeStateAfter: {
        currentChargeCount: 0,
        coolTimeMs: 14_000,
      },
    });
    expect(readinessById.get('moyin-shared-star-boundary')).toMatchObject({
      status: 'ready',
      executable: true,
      cooldown: {
        availableBefore: 1,
        availableAfter: 0,
        chargeStateBefore: {
          currentChargeCount: 1,
          coolTimeMs: 15_000,
        },
      },
    });

    const inside = simulateVerifiedProject({
      durationMs: 32_500,
      initialSpByCharacterId: { 109001: 100 },
      actions: createActions(31_983.333333),
    });
    expect(
      inside.actionRuleDiagnostics.readinessTimeline.actions.find(
        row => row.actionId === 'moyin-shared-star-boundary'
      )
    ).toMatchObject({
      status: 'blocked',
      executable: false,
      violationCodes: ['skill-cooldown-active'],
      cooldown: { nextReadyAtMs: 32_000 },
    });
  });

  it('keeps a one-use cooldown transaction stable under action-array reordering', () => {
    const definitions = [
      ['reorder-star-1', 10900112, 0, 1_000],
      ['reorder-star-2', 10900112, 1_000, 1_000],
      ['reorder-ultimate', 10900113, 2_000, 3_600],
      ['reorder-star-3', 10900112, 6_000, 1_000],
      ['reorder-star-4', 10900112, 7_000, 1_000],
    ];
    const actions = definitions.map(
      ([id, skillId, startMs, durationMs], sourceSequenceIndex) =>
        createWorkbenchActionDraft({
          id,
          type: 'skill',
          actorCharacterId: 109001,
          skillId,
          actionVariantIndex: 0,
          startMs,
          durationMs,
          sourceSequenceIndex,
          sourceSequencePath: [sourceSequenceIndex],
          sourceSequenceSource: 'cooldown-reorder-test-fixture',
        })
    );
    const run = sourceActions =>
      simulateVerifiedProject({
        durationMs: 8_000,
        initialSpByCharacterId: { 109001: 100 },
        actions: sourceActions,
      });
    const forward = run(actions);
    const reversed = run([...actions].reverse());
    const project = result => ({
      transactions:
        result.actionRuleDiagnostics.cooldownReductionTransactions.map(row => ({
          eventIdentity: row.eventIdentity,
          sourceActionId: row.sourceActionId,
          sourceSequencePath: row.sourceSequencePath,
          targetSkillId: row.targetSkillId,
          beforeChargeCount: row.beforeChargeCount,
          afterChargeCount: row.afterChargeCount,
          nextReadyAtMs: row.nextReadyAtMs,
        })),
      readiness: result.actionRuleDiagnostics.readinessTimeline.actions
        .map(row => ({
          actionId: row.actionId,
          status: row.status,
          nextReadyAtMs: row.cooldown?.nextReadyAtMs ?? null,
          chargeStateAfter: row.cooldown?.chargeStateAfter ?? null,
        }))
        .sort((left, right) => left.actionId.localeCompare(right.actionId)),
    });

    expect(project(reversed)).toEqual(project(forward));
    expect(
      project(forward).readiness.find(row => row.actionId === 'reorder-star-4')
    ).toMatchObject({ status: 'blocked', nextReadyAtMs: 17_000 });
  });

  it('fires a thunder overlimit on perfect parry when a mark is held', () => {
    const thunder = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'thunder'
    );
    const result = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMark(thunder, 20_000)],
      },
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-perfect-parry',
          type: 'skill',
          actorCharacterId: 109001,
          skillId: 10900121,
          actionVariantIndex: 3,
          startMs: 0,
          durationMs: 1_000,
        }),
      ],
    });
    const parryOverlimit =
      result.verifiedTuningMarkGeneration.combatEvents.filter(
        event =>
          event.kind === 'overlimit-damage' && event.timeMs === 483.333333
      );
    expect(parryOverlimit.length).toBeGreaterThan(0);
    const consume = result.verifiedTuningMarkGeneration.events.find(
      event => event.kind === 'consume' && event.profileKey === 'thunder'
    );
    expect(consume).toMatchObject({ timeMs: 483.333333, before: 1, after: 0 });
  });

  it('expires inherited layers on an empty action axis without synthetic damage', () => {
    const fire = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'fire'
    );
    const result = simulateVerifiedProject({
      durationMs: 2_000,
      initialRuntimeState: {
        tuningMarks: [createInheritedMark(fire, 1_000)],
      },
      actions: [],
    });

    expect(result.verifiedTuningMarkGeneration.events).toEqual([
      expect.objectContaining({
        kind: 'expire',
        timeMs: 1_000,
        profileKey: 'fire',
        before: 1,
        after: 0,
      }),
    ]);
    expect(result.verifiedTuningMarkGeneration.combatEvents).toHaveLength(0);
    expect(
      result.verifiedTuningMarkGeneration.finalState.find(
        state => state.profileKey === 'fire'
      ).currentValue
    ).toBe(0);
  });

  it('publishes ordered BeforeGetElement and AfterGetElement contexts around each applied acquisition', () => {
    const result = createDirectTuningGeneration({
      durationMs: 5_000,
      initialMarks: [createInheritedMarkWithCount(750, 4)],
      effects: [
        createDirectAcquireEffect('wind-acquire-to-cap', 750, 10, 0),
        createDirectAcquireEffect('wind-refresh-at-cap', 750, 10, 1),
      ],
    });
    const events = result.getElementEvents;

    expect(events).toHaveLength(4);
    expect(
      events.map(event => ({
        phase: event.phase,
        eventId: event.eventId,
        elementId: event.eventContext.elementId,
        elementTypes: event.eventContext.elementTypes,
        before: event.eventContext.before,
        delta: event.eventContext.delta,
        after: event.eventContext.after,
        outcome: event.eventContext.outcome,
        applied: event.eventContext.applied,
        success: event.eventContext.success,
      }))
    ).toEqual([
      {
        phase: 'before-mutation',
        eventId: 9,
        elementId: 750,
        elementTypes: [32, 41, 1001],
        before: 4,
        delta: 1,
        after: 5,
        outcome: 'layers-added',
        applied: true,
        success: true,
      },
      {
        phase: 'after-mutation',
        eventId: 10,
        elementId: 750,
        elementTypes: [32, 41, 1001],
        before: 4,
        delta: 1,
        after: 5,
        outcome: 'layers-added',
        applied: true,
        success: true,
      },
      {
        phase: 'before-mutation',
        eventId: 9,
        elementId: 750,
        elementTypes: [32, 41, 1001],
        before: 5,
        delta: 0,
        after: 5,
        outcome: 'refresh-at-cap',
        applied: true,
        success: true,
      },
      {
        phase: 'after-mutation',
        eventId: 10,
        elementId: 750,
        elementTypes: [32, 41, 1001],
        before: 5,
        delta: 0,
        after: 5,
        outcome: 'refresh-at-cap',
        applied: true,
        success: true,
      },
    ]);
    expect(events[0].transactionIdentity).toBe(events[1].transactionIdentity);
    expect(events[2].transactionIdentity).toBe(events[3].transactionIdentity);
    expect(events[0].transactionIdentity).not.toBe(
      events[2].transactionIdentity
    );
    expect(
      events.map(event => event.eventContext.sourceSequencePath.at(-3))
    ).toEqual([19, 21, 19, 21]);
    expect(
      events.map(event => ({
        transactionPath: event.transactionSourceSequencePath,
        phaseSequenceIndex: event.phaseSequenceIndex,
      }))
    ).toEqual([
      {
        transactionPath: events[1].transactionSourceSequencePath,
        phaseSequenceIndex: 0,
      },
      {
        transactionPath: events[0].transactionSourceSequencePath,
        phaseSequenceIndex: 1,
      },
      {
        transactionPath: events[3].transactionSourceSequencePath,
        phaseSequenceIndex: 0,
      },
      {
        transactionPath: events[2].transactionSourceSequencePath,
        phaseSequenceIndex: 1,
      },
    ]);
    expect(result.summary).toMatchObject({
      getElementEventCount: 4,
      getElementTransactionCount: 2,
      zeroDeltaGetElementTransactionCount: 1,
    });
  });

  it('does not synthesize get-element events from inherited state, consume or expiry', () => {
    const inheritedOnly = createDirectTuningGeneration({
      durationMs: 5_000,
      initialMarks: [createInheritedMarkWithCount(150, 1)],
      effects: [],
    });
    const consumed = createDirectTuningGeneration({
      durationMs: 5_000,
      initialMarks: [createInheritedMarkWithCount(150, 1)],
      effects: [createDirectConsumeEffect('fire-consume', 150, 10, 1)],
    });
    const expired = createDirectTuningGeneration({
      durationMs: 2_000,
      initialMarks: [
        {
          ...createInheritedMarkWithCount(150, 1),
          decayRemainingMs: 1_000,
        },
      ],
      effects: [],
    });

    expect(inheritedOnly.getElementEvents).toEqual([]);
    expect(consumed.getElementEvents).toEqual([]);
    expect(expired.getElementEvents).toEqual([]);
  });

  it('keeps source-proven same-frame occurrences while still deduping alias references', () => {
    const sourceProven = createDirectTuningGeneration({
      durationMs: 1_000,
      effects: [
        {
          ...createDirectAcquireEffect('base-arrow', 250, 3, 0),
          tuningMark: {
            applied: true,
            markId: 250,
            stackDelta: 1,
            occurrenceIdentity: 'arrow-occurrence:base',
          },
        },
        {
          ...createDirectAcquireEffect('conditional-arrows', 250, 3, 0),
          tuningMark: {
            applied: true,
            markId: 250,
            stackDelta: 2,
            occurrenceIdentity: 'arrow-occurrence:conditional-pair',
          },
        },
      ],
    });
    const aliasReferences = createDirectTuningGeneration({
      durationMs: 1_000,
      effects: [
        {
          ...createDirectAcquireEffect('elements-alias', 250, 3, 0),
          tuningMark: { applied: true, markId: 250, stackDelta: 1 },
        },
        {
          ...createDirectAcquireEffect('bullet-elements-consumer', 250, 3, 0),
          tuningMark: { applied: true, markId: 250, stackDelta: 2 },
        },
      ],
    });

    expect(
      sourceProven.events
        .filter(event => event.kind === 'acquire')
        .map(event => [event.before, event.delta, event.after])
    ).toEqual([
      [0, 1, 1],
      [1, 2, 3],
    ]);
    expect(
      aliasReferences.events
        .filter(event => event.kind === 'acquire')
        .map(event => [event.before, event.delta, event.after])
    ).toEqual([[0, 2, 2]]);
  });
});

function createPangpangAttack(id, startMs) {
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId: PANGPANG_ID,
    skillId: PANGPANG_NORMAL_SKILL_ID,
    actionVariantIndex: 0,
    startMs,
    durationMs: PANGPANG_ATTACK_INPUT.durationMs,
    attackGroupId: `${id}-group`,
    attackSequenceIndex: PANGPANG_ATTACK_INPUT.sequenceIndex,
    attackSequenceTotal: PANGPANG_ATTACK_INPUT.sequenceTotal,
    attackInput: PANGPANG_ATTACK_INPUT,
  });
}

function createInheritedMark(profile, remainingDurationMs) {
  return {
    markId: profile.markId,
    profileKey: profile.key,
    elementName: profile.element,
    decayRemainingMs: remainingDurationMs,
    heldReadyRemainingMs: 0,
    layers: [
      {
        sourceActionId: `inherited-${profile.key}`,
        sourceActorId: 'actor-3',
        sourceIdentity: { profile: profile.sourceIdentity },
      },
    ],
  };
}

function createDirectAcquireEffect(
  effectIdentity,
  markId,
  startFrame,
  mapIndex
) {
  return {
    effectIdentity,
    classification: 'applied',
    mapIndex,
    trigger: { startFrame },
    sourceIdentity: `test-source:${effectIdentity}`,
    tuningMark: { applied: true, markId },
  };
}

function createDirectConsumeEffect(
  effectIdentity,
  markId,
  startFrame,
  maximumStacks
) {
  return {
    effectIdentity,
    classification: 'applied',
    mapIndex: 0,
    trigger: { startFrame },
    sourceIdentity: `test-source:${effectIdentity}`,
    tuningOverlimit: {
      markId,
      minimumStacks: 1,
      maximumStacks,
    },
  };
}

function createDirectTuningGeneration({
  durationMs,
  initialMark,
  initialMarks,
  effects,
  controlBinding = { frameRate: 60 },
}) {
  const action = {
    id: 'direct-tuning-action',
    type: 'skill',
    actorId: 'actor-direct',
    startMs: 0,
    durationMs,
  };
  return createVerifiedTuningMarkGeneration({
    scenario: {
      time: { durationMs },
      actors: [],
      enemy: { id: 'enemy-direct' },
      initialRuntimeState: {
        tuningMarks: initialMarks ?? (initialMark ? [initialMark] : []),
      },
      actions: [action],
    },
    effectGeneration: {
      actionResolutionById: new Map([
        [
          action.id,
          {
            ready: true,
            actionBinding: {
              controlSkillId: controlBinding.controlSkillId ?? null,
              selectedSubSkillIndex: controlBinding.selectedSubSkillIndex ?? 0,
            },
            controlBinding,
            effects,
            hits: [],
          },
        ],
      ]),
    },
  });
}

function createDirectJudgmentGeneration({
  controlSkillId,
  durationMs,
  initialMarks,
  additionalEffects = [],
}) {
  const binding = mechanicsPackage.controlBindings.find(
    candidate => candidate.controlSkillId === controlSkillId
  );
  const effects = [
    ...additionalEffects,
    ...binding.effects.filter(effect => effect.tuningOverlimit),
  ];
  return createDirectTuningGeneration({
    durationMs,
    initialMarks,
    effects,
    controlBinding: {
      controlSkillId,
      selectedSubSkillIndex: 0,
      frameRate: binding.frameRate ?? 60,
      logic: binding.logic,
    },
  });
}

function createInheritedMarkWithCount(markId, count) {
  const profile = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
    candidate => candidate.markId === markId
  );
  return {
    ...createInheritedMark(profile, 20_000),
    layers: Array.from({ length: count }, (_, index) => ({
      sourceActionId: `inherited-${markId}-${index + 1}`,
      sourceActorId: 'actor-direct',
      sourceIdentity: { markId, layer: index + 1 },
    })),
  };
}

function projectConsumeEvents(result) {
  return result.events
    .filter(event => event.kind === 'consume')
    .map(event => {
      const packet = result.combatEvents.find(
        candidate =>
          candidate.kind === 'overlimit-damage' &&
          candidate.profile.markId === event.markId &&
          candidate.timeMs === event.timeMs
      );
      return {
        markId: event.markId,
        before: event.before,
        after: event.after,
        packetElementId: packet?.profile?.overlimitPacket?.elementId ?? null,
      };
    });
}

function projectFinalMarkCounts(result, markIds) {
  return Object.fromEntries(
    markIds
      .map(markId => [
        markId,
        result.finalState.find(state => state.markId === markId).currentValue,
      ])
      .sort(([left], [right]) => left - right)
  );
}

function projectConsumeUnresolved(result) {
  return result.unresolved.filter(row =>
    row.kind.startsWith('tuning-consume-')
  );
}

function createMoyinBrilliantAction(id, startMs) {
  return createWorkbenchActionDraft({
    id,
    type: 'skill',
    actorCharacterId: 109001,
    skillId: 10900121,
    actionKind: 'limit-counter',
    actionVariantIndex: 2,
    startMs,
    durationMs: 600,
  });
}

function createMoyinNormalChain({
  id,
  sequenceIndex,
  chainStartMs = null,
  targetStartMs = null,
  attackGroupId = null,
}) {
  const mapping = mechanicsPackage.actionMappings.find(
    entry => entry.ownerId === 109001 && entry.actionKind === 'normal-attack'
  );
  if (!mapping) throw new Error('missing Moyin normal-attack mapping');
  const prefixFrames = mapping.attackInputSegments
    .filter(segment => Number(segment.sequenceIndex) < Number(sequenceIndex))
    .reduce(
      (sum, segment) =>
        sum +
        Number(segment.effectiveDurationFrames ?? segment.durationFrames) +
        Number(segment.defaultLinkDelayFrames ?? 0),
      0
    );
  const resolvedStartMs =
    targetStartMs == null
      ? Number(chainStartMs ?? 0)
      : Number(targetStartMs) - (prefixFrames * 1000) / 60;
  return createWorkbenchAttackInputChainDrafts({
    entry: mapping,
    actorCharacterId: 109001,
    skillId: mapping.sourceSkillId,
    startMs: resolvedStartMs,
    ...(attackGroupId == null ? {} : { attackGroupId }),
    createActionId: (_segment, index) =>
      index + 1 === Number(sequenceIndex) ? id : `${id}-a${index + 1}`,
  }).slice(0, Number(sequenceIndex));
}

function simulateVerifiedProject({
  durationMs,
  actions,
  initialRuntimeState = null,
  initialSpByCharacterId = {},
  targetPolicy = null,
}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({
    ...config,
    initialSp:
      initialSpByCharacterId[Number(config.characterId)] ?? config.initialSp,
  }));
  const initialControlledCharacterId = Number(
    initialRuntimeState?.controlledActor?.characterId ??
      actions.find(action => action.actorCharacterId != null)
        ?.actorCharacterId ??
      DEFAULT_WORKBENCH_SELECTION.characterId
  );
  const resolvedInitialRuntimeState = {
    ...(initialRuntimeState ?? {}),
    controlledActor: {
      actorId: `actor-${initialControlledCharacterId}`,
      characterId: initialControlledCharacterId,
    },
  };
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState: resolvedInitialRuntimeState,
    ...(targetPolicy ? { combatScenario: { target: targetPolicy } } : {}),
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}

describe('kibo ultimate percentage cooldown reduction', () => {
  const KIBO_ID = 500368;
  const KIBO_SKILL_ID = 50036801;
  const MOYIN_ID = 109001;
  const MOYIN_STAR_SKILL_ID = 10900112;

  it('applies cdRecoveryType=1 from a KIBO_EVENT ultimate to the owner active cooldown', () => {
    const teamSlots = createDefaultWorkbenchTeamSlots();
    const actorConfigs = createDefaultWorkbenchActorConfigs(
      DEFAULT_WORKBENCH_SELECTION
    ).map(config => ({
      ...config,
      initialSp: Number(config.characterId) === MOYIN_ID ? 100 : 0,
      loadout:
        Number(config.characterId) === MOYIN_ID
          ? { ...config.loadout, kiboId: KIBO_ID }
          : config.loadout,
    }));
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      durationMs: 9_000,
      teamSlots,
      actorConfigs,
      actions: [
        createWorkbenchActionDraft({
          id: 'moyin-star-cd',
          type: 'skill',
          actorCharacterId: MOYIN_ID,
          skillId: MOYIN_STAR_SKILL_ID,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 1_000,
        }),
        createWorkbenchActionDraft({
          id: 'kibo-500368-ult',
          type: 'kiboEvent',
          actorCharacterId: MOYIN_ID,
          skillId: KIBO_SKILL_ID,
          kiboId: KIBO_ID,
          actionVariantIndex: 0,
          startMs: 2_000,
          durationMs: 3_900,
          eventType: 'signature',
        }),
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: `actor-${MOYIN_ID}`,
          characterId: MOYIN_ID,
        },
        kiboEnergyBySlot: [
          {
            slotId: 'team-slot-1',
            kiboId: KIBO_ID,
            currentValue: 100,
            maxValue: 100,
          },
        ],
      },
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    });
    const result = simulateScenario(
      compileProject(project, getWorkbenchGameData())
    );
    const transactions =
      result.actionRuleDiagnostics?.cooldownReductionTransactions ?? [];
    const applied = transactions.find(
      transaction =>
        Number(transaction.sourceSkillId) === KIBO_SKILL_ID &&
        transaction.cdRecoveryType === 1 &&
        transaction.status === 'cooldown-reduction-transaction-applied'
    );
    // 回归：500368 大招（cdRecoveryType=1，-4.3%）此前因 KIBO_EVENT 被
    // enqueueAcceptedCooldownReductionTransactions 拒绝、且百分比模式被
    // unsupported-mode 拒绝，冷却缩减完全缺失。
    expect(applied).toBeTruthy();
    expect(applied).toMatchObject({
      sourceActionId: 'kibo-500368-ult',
      sourceSkillId: KIBO_SKILL_ID,
      cdRecoveryType: 1,
      targetSkillId: MOYIN_STAR_SKILL_ID,
      appliedToSimulationResults: true,
    });
    expect(Number(applied.afterReadyAtMs)).toBeLessThan(
      Number(applied.beforeReadyAtMs)
    );
    // 精确数值：Lv1 rawValue=-430（-4.3%），百分比按目标冷却剩余时间折算
    expect(Number(applied.rawValue)).toBe(-430);
    const remainingBeforeMs = Math.max(
      0,
      Number(applied.beforeReadyAtMs) - Number(applied.timeMs)
    );
    expect(Number(applied.appliedReductionMs)).toBeCloseTo(
      remainingBeforeMs * 0.043,
      1
    );
    // 回能：500368 直接回能给在场英雄 +3.1 SP（不是给奇波充能）
    const spEvents =
      result.verifiedBattleEffectGeneration?.directSpEvents ?? [];
    const recover = spEvents.find(event => event.kind === 'direct-sp');
    expect(recover).toBeTruthy();
    expect(Number(recover.value)).toBeCloseTo(3.1, 1);
    expect(recover.target).toMatchObject({
      kind: 'actor',
      id: `actor-${MOYIN_ID}`,
    });
  });

  it.each([
    {
      name: '乐乐蛙',
      kiboId: 500369,
      skillId: 50036901,
      durationMs: 8000,
      triggerFrames: [34, 94, 154, 214, 274, 334, 426],
    },
    {
      name: '音霸蛙',
      kiboId: 500370,
      skillId: 50037001,
      durationMs: 7000,
      triggerFrames: [14, 74, 134, 194, 254, 336],
    },
  ])(
    'expands $name periodic cooldown reduction through its final packet',
    ({ kiboId, skillId, durationMs, triggerFrames }) => {
      const teamSlots = createDefaultWorkbenchTeamSlots();
      const actorConfigs = createDefaultWorkbenchActorConfigs(
        DEFAULT_WORKBENCH_SELECTION
      ).map(config => ({
        ...config,
        initialSp: Number(config.characterId) === MOYIN_ID ? 100 : 0,
        loadout:
          Number(config.characterId) === MOYIN_ID
            ? { ...config.loadout, kiboId }
            : config.loadout,
      }));
      const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
        durationMs: 12_000,
        teamSlots,
        actorConfigs,
        actions: [
          createWorkbenchActionDraft({
            id: `moyin-star-cd-${kiboId}`,
            type: 'skill',
            actorCharacterId: MOYIN_ID,
            skillId: MOYIN_STAR_SKILL_ID,
            actionVariantIndex: 0,
            startMs: 0,
            durationMs: 1000,
          }),
          createWorkbenchActionDraft({
            id: `kibo-${kiboId}-ult`,
            type: 'kiboEvent',
            actorCharacterId: MOYIN_ID,
            skillId,
            kiboId,
            actionVariantIndex: 0,
            startMs: 2000,
            durationMs,
            eventType: 'signature',
          }),
        ],
        initialRuntimeState: {
          controlledActor: {
            actorId: `actor-${MOYIN_ID}`,
            characterId: MOYIN_ID,
          },
          kiboEnergyBySlot: [
            {
              slotId: 'team-slot-1',
              kiboId,
              currentValue: 100,
              maxValue: 100,
            },
          ],
        },
        mechanicsProfileSelection:
          createVerifiedWorkbenchMechanicsProfileSelection(),
      });
      const result = simulateScenario(
        compileProject(project, getWorkbenchGameData())
      );
      const transactions = (
        result.actionRuleDiagnostics?.cooldownReductionTransactions ?? []
      ).filter(transaction => Number(transaction.sourceSkillId) === skillId);

      expect(transactions.map(transaction => transaction.triggerFrame)).toEqual(
        triggerFrames
      );
      expect(
        transactions.filter(
          transaction => transaction.triggerIntervalMs === 1000
        )
      ).toHaveLength(triggerFrames.length - 1);
      expect(transactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            status: 'cooldown-reduction-transaction-applied',
            cdRecoveryType: 1,
            appliedToSimulationResults: true,
          }),
        ])
      );
    }
  );
});
