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
    const passiveCommands = result.verifiedActionVariantRuntime.effectCommands.filter(
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
    expect(overlimitEvents.every(event => event.eventContext.propertyTags)).toBe(
      true
    );
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
      83.333333,
      333.333333,
      1000,
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

  it('resets one star-skill charge cooldown when the ultimate is cast', () => {
    const result = simulateVerifiedProject({
      durationMs: 6_000,
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
    const readiness = result.actionRuleDiagnostics?.readinessTimeline
      ?.actions ?? [];
    const star3Readiness = readiness.find(
      row => row.actionId === 'moyin-star-3'
    );
    expect(star3Readiness?.status).toBe('ready');
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
  const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState,
    ...(targetPolicy ? { combatScenario: { target: targetPolicy } } : {}),
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  return simulateScenario(compileProject(project, getWorkbenchGameData()));
}
