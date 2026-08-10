import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import femaleContract from '../../data/generated/character-combat-owner-contracts/199001.json';
import maleContract from '../../data/generated/character-combat-owner-contracts/199002.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedTuningMarkGeneration } from '../../simulation/mechanics/verifiedTuningMarkGeneration';

const MARKS = [
  { markId: 150, profileKey: 'fire' },
  { markId: 250, profileKey: 'thunder' },
  { markId: 350, profileKey: 'ice' },
  { markId: 450, profileKey: 'dark' },
  { markId: 550, profileKey: 'wood' },
  { markId: 650, profileKey: 'earth' },
  { markId: 750, profileKey: 'wind' },
  { markId: 850, profileKey: 'water' },
  { markId: 950, profileKey: 'light' },
];
const MIXED_COUNTS = { fire: 2, wind: 4, dark: 1 };
const ALIASES = [
  {
    ownerId: 199001,
    contract: femaleContract,
    ultimateControlSkillId: 19900113,
    starCarryControlSkillId: 19900122,
    ultimateWrapperStart: 199001250,
    starCarryWrapperStart: 199001096,
  },
  {
    ownerId: 199002,
    contract: maleContract,
    ultimateControlSkillId: 19900213,
    starCarryControlSkillId: 19900222,
    ultimateWrapperStart: 199002363,
    starCarryWrapperStart: 199002071,
  },
];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('STARBORN existing tuning mark product semantics', () => {
  it('compiles nine source-backed pre-action conditions for both alias contracts', () => {
    for (const alias of ALIASES) {
      const ultimateBindings = selectBindings(
        alias,
        alias.ultimateControlSkillId
      );
      const starCarryBindings = selectBindings(
        alias,
        alias.starCarryControlSkillId
      );

      expect(projectBindingSemantics(ultimateBindings)).toEqual(
        MARKS.map((mark, index) => ({
          ...mark,
          stackDelta: 1,
          sourceElementId: alias.ultimateWrapperStart + index,
          commonFunctionId: 1007,
          snapshotTiming: 'action-start-before-effects',
        }))
      );
      expect(projectBindingSemantics(starCarryBindings)).toEqual(
        MARKS.map((mark, index) => ({
          ...mark,
          stackDelta: 1,
          sourceElementId: alias.starCarryWrapperStart + index,
          commonFunctionId: 1007,
          snapshotTiming: 'action-start-before-effects',
        }))
      );
    }
  });

  it.each(ALIASES)(
    'keeps all nine absent marks at zero for alias $ownerId',
    alias => {
      const ultimate = runAliasAction({ alias, actionKind: 'ultimate' });
      const starCarry = runAliasAction({ alias, actionKind: 'star-carry' });

      expect(projectOutcome(ultimate)).toEqual(
        desiredOutcome({}, 1, { acquireAtCap: true })
      );
      expect(projectOutcome(starCarry)).toEqual(
        desiredOutcome({}, 1, { acquireAtCap: true })
      );
    }
  );

  it.each(ALIASES)(
    'adds 1 on ultimate and 1 on star-carry only to present marks for alias $ownerId',
    alias => {
      const ultimate = runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: MIXED_COUNTS,
      });
      const starCarry = runAliasAction({
        alias,
        actionKind: 'star-carry',
        counts: MIXED_COUNTS,
      });

      expect(projectOutcome(ultimate)).toEqual(
        desiredOutcome(MIXED_COUNTS, 1, { acquireAtCap: true })
      );
      expect(projectOutcome(starCarry)).toEqual(
        desiredOutcome(MIXED_COUNTS, 1, { acquireAtCap: true })
      );
    }
  );

  it.each(ALIASES)(
    'caps at five with explicit zero delta refreshes for alias $ownerId',
    alias => {
      const fourToFive = runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: { fire: 4 },
      });
      const ultimateAtFive = runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: { fire: 5 },
      });
      const starCarryAtFive = runAliasAction({
        alias,
        actionKind: 'star-carry',
        counts: { fire: 5 },
      });

      expect(projectOutcome(fourToFive)).toEqual(
        desiredOutcome({ fire: 4 }, 1, { acquireAtCap: true })
      );
      expect(projectOutcome(ultimateAtFive)).toEqual(
        desiredOutcome({ fire: 5 }, 1, { acquireAtCap: true })
      );
      expect(projectOutcome(starCarryAtFive)).toEqual(
        desiredOutcome({ fire: 5 }, 1, { acquireAtCap: true })
      );
    }
  );

  it.each(ALIASES)(
    'snapshots eligibility before earlier same-action child writes for alias $ownerId',
    alias => {
      const result = runAliasAction({
        alias,
        actionKind: 'ultimate',
        additionalEffects: [createUnconditionalAcquireEffect(150, 0)],
      });
      const projected = projectOutcome(result);

      expect(projected.finalCounts.fire).toBe(1);
      expect(projected.acquisitions).toEqual([
        { markId: 150, before: 0, after: 1, delta: 1 },
      ]);
      expect(
        projected.gates.find(gate => gate.profileKey === 'fire')
      ).toMatchObject({ passed: false, candidateCount: 0 });
    }
  );

  it.each(ALIASES)(
    'uses the right-open state after exact action-start expiry for alias $ownerId',
    alias => {
      const result = runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: { fire: 1 },
        actionStartMs: 1_000,
        decayRemainingMs: 1_000,
      });

      expect(projectOutcome(result)).toEqual(
        desiredOutcome({}, 1)
      );
      expect(result.events[0]).toMatchObject({
        kind: 'expire',
        markId: 150,
        before: 1,
        after: 0,
      });
    }
  );

  it.each(ALIASES)(
    'does not settle the mark child when interrupted before its trigger for alias $ownerId',
    alias => {
      const result = runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: MIXED_COUNTS,
        actionDurationMs: 1_000,
      });

      expect(result.events.filter(event => event.kind === 'acquire')).toEqual(
        []
      );
      expect(result.acquisitionGateResults).toEqual([]);
    }
  );

  it('makes every historical wrong oracle fail the independent product rule', () => {
    for (const alias of ALIASES) {
      const noParentCondition = runAliasAction({
        alias,
        actionKind: 'ultimate',
        mutateEffects: effects =>
          effects.map(effect => ({
            ...effect,
            tuningMarkActivationCondition: null,
          })),
      });
      const oldPlusTwo = runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: MIXED_COUNTS,
        mutateEffects: effects =>
          effects.map(effect => ({
            ...effect,
            tuningMark: { ...effect.tuningMark, stackDelta: 2 },
          })),
      });
      const oneAbsentBecomesPresent = runAliasAction({
        alias,
        actionKind: 'ultimate',
        mutateEffects: effects =>
          effects.map(effect =>
            Number(effect.tuningMark.markId) === 150
              ? { ...effect, tuningMarkActivationCondition: null }
              : effect
          ),
      });

      expect(matchesDesired(noParentCondition, {}, 1)).toBe(false);
      expect(matchesDesired(oldPlusTwo, MIXED_COUNTS, 1)).toBe(false);
      expect(matchesDesired(oneAbsentBecomesPresent, {}, 1)).toBe(false);
    }

    const oneAliasUnfixed = ALIASES.map(alias =>
      runAliasAction({
        alias,
        actionKind: 'ultimate',
        counts: MIXED_COUNTS,
        mutateEffects:
          alias.ownerId === 199002
            ? effects =>
                effects.map(effect => ({
                  ...effect,
                  tuningMark: { ...effect.tuningMark, stackDelta: 2 },
                }))
            : effects => effects,
      })
    );
    expect(
      oneAliasUnfixed.every(result => matchesDesired(result, MIXED_COUNTS, 1))
    ).toBe(false);
  });
});

function selectBindings(alias, controlSkillId) {
  return alias.contract.contracts.actionEffectBindings
    .filter(
      binding =>
        Number(binding.controlSkillId) === Number(controlSkillId) &&
        binding.tuningMarkActivationCondition?.kind ===
          'tuning-mark-existing-at-action-start'
    )
    .sort(
      (left, right) =>
        Number(left.tuningMark.markId) - Number(right.tuningMark.markId)
    );
}

function projectBindingSemantics(bindings) {
  return bindings.map(binding => ({
    markId: Number(binding.tuningMark.markId),
    profileKey: binding.tuningMark.profileKey,
    stackDelta: Number(binding.tuningMark.stackDelta),
    sourceElementId: Number(
      binding.tuningMarkActivationCondition.sourceElementId
    ),
    commonFunctionId: Number(
      binding.tuningMarkActivationCondition.commonFunctionId
    ),
    snapshotTiming: binding.tuningMarkActivationCondition.snapshotTiming,
  }));
}

function runAliasAction({
  alias,
  actionKind,
  counts = {},
  additionalEffects = [],
  mutateEffects = effects => effects,
  actionStartMs = 0,
  actionDurationMs = 5_000,
  decayRemainingMs = 20_000,
}) {
  const controlSkillId =
    actionKind === 'ultimate'
      ? alias.ultimateControlSkillId
      : alias.starCarryControlSkillId;
  const bindings = selectBindings(alias, controlSkillId);
  const effects = mutateEffects([
    ...additionalEffects,
    ...bindings.map(binding => ({
      effectIdentity: binding.bindingIdentity,
      classification: 'applied',
      mapIndex: binding.mapIndex,
      trigger: { startFrame: binding.triggerFrame },
      sourceIdentity: binding.sourceIdentity,
      tuningMark: structuredClone(binding.tuningMark),
      tuningMarkActivationCondition: structuredClone(
        binding.tuningMarkActivationCondition
      ),
    })),
  ]);
  const action = {
    id: `${alias.ownerId}-${actionKind}-desired-semantic`,
    type: 'skill',
    actorId: `actor-${alias.ownerId}`,
    startMs: actionStartMs,
    durationMs: actionDurationMs,
    contextualEffectiveEndMs: actionStartMs + actionDurationMs,
  };
  const scenarioDurationMs = actionStartMs + 5_000;
  return createVerifiedTuningMarkGeneration({
    scenario: {
      time: { durationMs: scenarioDurationMs },
      actors: [],
      enemy: { id: 'enemy-passive-boss' },
      initialRuntimeState: {
        tuningMarks: createInheritedMarks(
          alias.ownerId,
          counts,
          decayRemainingMs
        ),
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
              controlSkillId,
              selectedSubSkillIndex: 0,
            },
            controlBinding: {
              controlSkillId,
              selectedSubSkillIndex: 0,
              frameRate: 60,
            },
            effects,
            hits: [],
          },
        ],
      ]),
    },
  });
}

function createInheritedMarks(ownerId, counts, decayRemainingMs) {
  return MARKS.flatMap(mark => {
    const count = Number(counts[mark.profileKey] ?? 0);
    if (count <= 0) return [];
    return [
      {
        markId: mark.markId,
        profileKey: mark.profileKey,
        decayRemainingMs,
        heldReadyRemainingMs: 0,
        layers: Array.from({ length: count }, (_, index) => ({
          sourceActionId: `desired-${mark.profileKey}-${index + 1}`,
          sourceActorId: `actor-${ownerId}`,
          sourceIdentity: {
            semantic: 'independent-product-rule-fixture',
            profileKey: mark.profileKey,
            layer: index + 1,
          },
        })),
      },
    ];
  });
}

function createUnconditionalAcquireEffect(markId, startFrame) {
  return {
    effectIdentity: `independent-unconditional-acquire-${markId}`,
    classification: 'applied',
    mapIndex: 0,
    trigger: { startFrame },
    sourceIdentity: 'independent-product-rule-fixture:same-action-earlier-child',
    tuningMark: {
      applied: true,
      markId,
      profileKey: MARKS.find(mark => mark.markId === markId).profileKey,
      stackDelta: 1,
      occurrenceIdentity: `independent-unconditional-acquire-${markId}`,
    },
  };
}

function desiredOutcome(counts, stackDelta) {
  const present = MARKS.filter(mark => Number(counts[mark.profileKey] ?? 0) > 0);
  return {
    finalCounts: Object.fromEntries(
      MARKS.map(mark => [
        mark.profileKey,
        Number(counts[mark.profileKey] ?? 0) > 0
          ? Math.min(5, Number(counts[mark.profileKey]) + stackDelta)
          : 0,
      ])
    ),
    acquisitions: present.map(mark => {
      const before = Number(counts[mark.profileKey]);
      const after = Math.min(5, before + stackDelta);
      return { markId: mark.markId, before, after, delta: after - before };
    }),
    gates: MARKS.map(mark => {
      const candidateCount = Number(counts[mark.profileKey] ?? 0);
      return {
        profileKey: mark.profileKey,
        candidateCount,
        passed: candidateCount > 0,
      };
    }),
  };
}

function projectOutcome(result) {
  return {
    finalCounts: Object.fromEntries(
      MARKS.map(mark => [
        mark.profileKey,
        result.finalState.find(state => state.markId === mark.markId)
          .currentValue,
      ])
    ),
    acquisitions: result.events
      .filter(event => event.kind === 'acquire')
      .map(event => ({
        markId: event.markId,
        before: event.before,
        after: event.after,
        delta: event.delta,
      }))
      .sort((left, right) => left.markId - right.markId),
    gates: result.acquisitionGateResults
      .filter(
        result =>
          result.gate?.kind === 'existing-tuning-mark-at-action-start'
      )
      .map(result => ({
        profileKey: result.gate.profileKey,
        candidateCount: result.candidateCount,
        passed: result.passed,
      }))
      .sort(
        (left, right) =>
          MARKS.findIndex(mark => mark.profileKey === left.profileKey) -
          MARKS.findIndex(mark => mark.profileKey === right.profileKey)
      ),
  };
}

function matchesDesired(result, counts, stackDelta) {
  return (
    JSON.stringify(projectOutcome(result)) ===
    JSON.stringify(desiredOutcome(counts, stackDelta))
  );
}
