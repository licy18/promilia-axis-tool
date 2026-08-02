import { describe, expect, it } from 'vitest';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import { createVerifiedNonDamageEventGeneration } from '../../simulation/mechanics/verifiedNonDamageEventGeneration';
import { createVerifiedSoulEssenceEffectGeneration } from '../../simulation/mechanics/verifiedSoulEssenceEffectGeneration';

describe('verified non-damage event generation', () => {
  it('projects real switch, heal and shield settlements once with native source and target semantics', () => {
    const scenario = createScenario();
    const generation = createVerifiedNonDamageEventGeneration({
      scenario,
      actionExecutionPlan: {
        actions: scenario.actions.map(action => ({
          actionId: action.id,
          execute: true,
        })),
      },
      controlledActorTimeline: {
        transitions: [
          createSwitchTransition({
            actionId: 'switch-to-owner',
            beforeActorId: 'actor-a',
            afterActorId: 'actor-b',
            applied: true,
          }),
          createSwitchTransition({
            actionId: 'switch-noop',
            beforeActorId: 'actor-b',
            afterActorId: 'actor-b',
            applied: false,
          }),
        ],
      },
      actionResolutionById: createActionResolutionById(),
      verifiedCombatRuntime: {
        vitalEvents: [
          createVitalEvent({
            type: 'VERIFIED_DIRECT_HEAL',
            actionId: 'ultimate-heal',
            actorId: 'actor-b',
            targetId: 'actor-c',
            sourceEventIdentity: 'direct-heal|ultimate-heal|190014-heal|actor:actor-c',
            before: 1000,
            requestedChange: 200,
            change: 0,
            after: 1000,
          }),
          createVitalEvent({
            type: 'VERIFIED_DIRECT_SHIELD',
            actionId: 'shield-action',
            actorId: 'actor-a',
            targetId: 'actor-b',
            sourceEventIdentity: 'direct-shield|shield-action|190075-shield|actor:actor-b',
            before: 0,
            requestedChange: 300,
            change: 300,
            after: 300,
          }),
          createVitalEvent({
            type: 'VERIFIED_DIRECT_SHIELD',
            actionId: 'zero-shield',
            actorId: 'actor-a',
            targetId: 'actor-b',
            sourceEventIdentity: 'direct-shield|zero-shield|zero|actor:actor-b',
            before: 0,
            requestedChange: 0,
            change: 0,
            after: 0,
          }),
        ],
      },
    });

    expect(generation.events).toHaveLength(3);
    expect(generation.events.map(event => event.kind)).toEqual([
      'switch-enter',
      'heal-after-settlement',
      'shield-after-acquire',
    ]);
    expect(generation.events[0].eventContext).toMatchObject({
      eventId: 34,
      sourceActionId: 'switch-to-owner',
      triggerSubjectActorId: 'actor-b',
      eventTargetActorId: null,
      applied: true,
    });
    expect(generation.events[1].eventContext).toMatchObject({
      eventId: 44,
      sourceActionId: 'ultimate-heal',
      sourceActorId: 'actor-b',
      triggerSubjectActorId: 'actor-b',
      eventTargetActorId: 'actor-c',
      requestedChange: 200,
      actualChange: 0,
      before: 1000,
      after: 1000,
      skillSlotIds: [4],
      skillTagIds: [4],
      applied: true,
    });
    expect(generation.events[2].eventContext).toMatchObject({
      eventId: 40,
      sourceActionId: 'shield-action',
      sourceActorId: 'actor-a',
      triggerSubjectActorId: 'actor-b',
      eventTargetActorId: 'actor-b',
      requestedChange: 300,
      actualChange: 300,
      applied: true,
    });
    expect(generation.summary).toMatchObject({
      switchEnterEventCount: 1,
      afterHealEventCount: 1,
      onGotShieldEventCount: 1,
      rejectedEventCount: 1,
    });
  });

  it('rejects blocked, inherited, enemy and duplicate projections before soul triggers', () => {
    const scenario = createScenario();
    const duplicate = createVitalEvent({
      type: 'VERIFIED_DIRECT_HEAL',
      actionId: 'ultimate-heal',
      actorId: 'actor-b',
      targetId: 'actor-c',
      sourceEventIdentity: 'heal-duplicate-identity',
      before: 100,
      requestedChange: 20,
      change: 20,
      after: 120,
    });
    const generation = createVerifiedNonDamageEventGeneration({
      scenario,
      actionExecutionPlan: {
        actions: [
          { actionId: 'switch-to-owner', execute: false },
          { actionId: 'ultimate-heal', execute: true },
          { actionId: 'shield-action', execute: true },
        ],
      },
      controlledActorTimeline: {
        transitions: [
          createSwitchTransition({
            actionId: 'switch-to-owner',
            beforeActorId: 'actor-a',
            afterActorId: 'actor-b',
            applied: false,
          }),
        ],
      },
      actionResolutionById: createActionResolutionById(),
      verifiedCombatRuntime: {
        vitalEvents: [
          duplicate,
          structuredClone(duplicate),
          {
            ...createVitalEvent({
              type: 'VERIFIED_DIRECT_HEAL',
              actionId: 'ultimate-heal',
              actorId: 'actor-b',
              targetId: 'enemy',
              sourceEventIdentity: 'enemy-heal',
              before: 10,
              requestedChange: 5,
              change: 5,
              after: 15,
            }),
            payload: {
              ...createVitalEvent({
                type: 'VERIFIED_DIRECT_HEAL',
                actionId: 'ultimate-heal',
                actorId: 'actor-b',
                targetId: 'enemy',
                sourceEventIdentity: 'enemy-heal',
                before: 10,
                requestedChange: 5,
                change: 5,
                after: 15,
              }).payload,
              targetKind: 'enemy',
            },
          },
          {
            ...createVitalEvent({
              type: 'VERIFIED_DIRECT_SHIELD',
              actionId: 'shield-action',
              actorId: 'actor-a',
              targetId: 'actor-b',
              sourceEventIdentity: 'inherited-shield',
              before: 0,
              requestedChange: 100,
              change: 100,
              after: 100,
            }),
            payload: {
              ...createVitalEvent({
                type: 'VERIFIED_DIRECT_SHIELD',
                actionId: 'shield-action',
                actorId: 'actor-a',
                targetId: 'actor-b',
                sourceEventIdentity: 'inherited-shield',
                before: 0,
                requestedChange: 100,
                change: 100,
                after: 100,
              }).payload,
              initialState: true,
            },
          },
          createVitalEvent({
            type: 'VERIFIED_DIRECT_HEAL',
            actionId: 'zero-shield',
            actorId: 'actor-a',
            targetId: 'actor-b',
            sourceEventIdentity: 'unexecuted-direct-heal',
            before: 10,
            requestedChange: 5,
            change: 5,
            after: 15,
          }),
        ],
      },
    });

    expect(generation.events).toHaveLength(1);
    expect(generation.events[0].transactionIdentity).toBe(
      'non-damage|heal-duplicate-identity'
    );
    expect(generation.suppressions.map(row => row.reason)).toEqual(
      expect.arrayContaining([
        'non-damage-event-duplicate',
        'non-damage-event-target-not-friendly-actor',
        'non-damage-event-initial-state-not-dispatched',
        'non-damage-event-source-action-not-executed',
      ])
    );
  });

  it('dispatches periodic AfterHeal without borrowing the originating action skill provenance', () => {
    const scenario = createScenario();
    const periodicHeal = {
      ...createVitalEvent({
        type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
        actionId: 'ultimate-heal',
        actorId: 'actor-b',
        targetId: 'actor-c',
        sourceEventIdentity: 'periodic-heal-at-full-hp',
        before: 1000,
        requestedChange: 200,
        change: 0,
        after: 1000,
      }),
      payload: {
        ...createVitalEvent({
          type: 'VERIFIED_KIBO_PASSIVE_PERIODIC_HEAL_SUPPRESSED',
          actionId: 'ultimate-heal',
          actorId: 'actor-b',
          targetId: 'actor-c',
          sourceEventIdentity: 'periodic-heal-at-full-hp',
          before: 1000,
          requestedChange: 200,
          change: 0,
          after: 1000,
        }).payload,
        applied: false,
        afterHealDispatchEligible: true,
        actionProvenanceAvailable: false,
        reason: 'periodic-heal-no-positive-effective-change',
      },
    };
    const actionExecutionPlan = {
      actions: scenario.actions.map(action => ({
        actionId: action.id,
        execute: true,
      })),
    };
    const nonDamageEventGeneration = createVerifiedNonDamageEventGeneration({
      scenario,
      actionExecutionPlan,
      controlledActorTimeline: { transitions: [] },
      actionResolutionById: createActionResolutionById(),
      verifiedCombatRuntime: { vitalEvents: [periodicHeal] },
    });

    expect(nonDamageEventGeneration.events).toEqual([
      expect.objectContaining({
        kind: 'heal-after-settlement',
        eventContext: expect.objectContaining({
          actionProvenanceAvailable: false,
          skillSlotIds: [],
          skillTagIds: [],
          actualChange: 0,
          outcome: 'heal-executed-zero-effective-change',
        }),
      }),
    ]);

    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario: equipSoul(scenario, {
        actorId: 'actor-b',
        soulEssenceId: 10175,
        effectSkillId: 1900140,
      }),
      actionExecutionPlan,
      actionResolutionById: createActionResolutionById(),
      nonDamageEventGeneration,
    });
    expect(generation.effectCommands).toEqual([]);
    expect(generation.suppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'ultimate-heal',
          reason: 'soulessence-effect-action-kind-condition-not-matched',
          actualSkillSlotIds: [],
          actualSkillTagIds: [],
        }),
      ])
    );
  });

  it('routes Self observation and Target(1) from the canonical event subject', () => {
    const sourceScenario = createScenario();
    const executionPlan = {
      actions: sourceScenario.actions.map(action => ({
        actionId: action.id,
        execute: true,
      })),
    };
    const nonDamageEventGeneration = createVerifiedNonDamageEventGeneration({
      scenario: sourceScenario,
      actionExecutionPlan: executionPlan,
      controlledActorTimeline: { transitions: [] },
      actionResolutionById: createActionResolutionById(),
      verifiedCombatRuntime: {
        vitalEvents: [
          createVitalEvent({
            type: 'VERIFIED_DIRECT_HEAL',
            actionId: 'ultimate-heal',
            actorId: 'actor-b',
            targetId: 'actor-c',
            sourceEventIdentity: 'target-routing-heal',
            before: 1000,
            requestedChange: 200,
            change: 0,
            after: 1000,
          }),
          createVitalEvent({
            type: 'VERIFIED_DIRECT_SHIELD',
            actionId: 'shield-action',
            actorId: 'actor-a',
            targetId: 'actor-b',
            sourceEventIdentity: 'subject-routing-shield',
            before: 0,
            requestedChange: 300,
            change: 300,
            after: 300,
          }),
        ],
      },
    });
    const ultimateScenario = equipSoul(sourceScenario, {
      actorId: 'actor-b',
      soulEssenceId: 10175,
      effectSkillId: 1900140,
    });
    const ultimateGeneration = createVerifiedSoulEssenceEffectGeneration({
      scenario: ultimateScenario,
      actionExecutionPlan: executionPlan,
      actionResolutionById: createActionResolutionById(),
      nonDamageEventGeneration,
    });

    expect(ultimateGeneration.effectCommands).toEqual([
      expect.objectContaining({
        sourceActionId: 'ultimate-heal',
        sourceActorId: 'actor-b',
        sourceSoulEssenceId: 10175,
        sourceNonDamageEventIdentity:
          'non-damage|target-routing-heal:event:44',
        targetId: 'actor-c',
        semanticTargetKind: 'event-target-actor',
        durationMs: 2000,
      }),
    ]);

    const shieldScenario = equipSoul(sourceScenario, {
      actorId: 'actor-b',
      soulEssenceId: 10169,
      effectSkillId: 1900750,
    });
    const shieldGeneration = createVerifiedSoulEssenceEffectGeneration({
      scenario: shieldScenario,
      actionExecutionPlan: executionPlan,
      actionResolutionById: createActionResolutionById(),
      nonDamageEventGeneration,
    });
    expect(shieldGeneration.effectCommands).toEqual([]);
    expect(
      soulEssenceEffectCatalog.definitions.find(
        definition => definition.soulEssenceId === 10169
      )
    ).toMatchObject({
      runtimeStatus: 'source-indexed-runtime-unapplied',
      runtimeGaps: [
        'effect-shield-refresh-replacement-semantics-evidence-gap',
      ],
    });

    const wrongSourceScenario = equipSoul(sourceScenario, {
      actorId: 'actor-a',
      soulEssenceId: 10175,
      effectSkillId: 1900140,
    });
    expect(
      createVerifiedSoulEssenceEffectGeneration({
        scenario: wrongSourceScenario,
        actionExecutionPlan: executionPlan,
        actionResolutionById: createActionResolutionById(),
        nonDamageEventGeneration,
      }).effectCommands
    ).toEqual([]);
  });

  it('applies triggerInv as a millisecond interval once per native transaction', () => {
    const scenario = equipSoul(
      {
        ...createScenario(),
        actions: [
          {
            id: 'switch-enter-first',
            type: 'switch',
            actorId: 'actor-a',
            startMs: 1000,
            sourceSequenceIndex: 0,
            sourceSequencePath: [0],
          },
          {
            id: 'switch-enter-within-interval',
            type: 'switch',
            actorId: 'actor-a',
            startMs: 1005,
            sourceSequenceIndex: 1,
            sourceSequencePath: [1],
          },
        ],
      },
      {
        actorId: 'actor-b',
        soulEssenceId: 10048,
        effectSkillId: 1900920,
      }
    );
    const actionExecutionPlan = {
      actions: scenario.actions.map(action => ({
        actionId: action.id,
        execute: true,
      })),
    };
    const nonDamageEventGeneration = {
      events: scenario.actions.map((action, index) =>
        createCanonicalSwitchEvent(action, index)
      ),
    };
    const generation = createVerifiedSoulEssenceEffectGeneration({
      scenario,
      actionExecutionPlan,
      nonDamageEventGeneration,
      catalog: soulEssenceEffectCatalog,
    });

    expect(generation.effectCommands).toHaveLength(3);
    expect(
      generation.effectCommands.every(
        command => command.sourceActionId === 'switch-enter-first'
      )
    ).toBe(true);
    expect(generation.suppressions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'switch-enter-within-interval',
          intervalMs: 10,
          reason: 'soulessence-effect-trigger-interval-active',
        }),
      ])
    );
  });
});

function equipSoul(scenario, { actorId, soulEssenceId, effectSkillId }) {
  return {
    ...scenario,
    actors: scenario.actors.map(actor =>
      actor.id === actorId
        ? {
            ...actor,
            loadout: {
              soulessenceId: soulEssenceId,
              soulessenceCultivation: {
                effectSkill: {
                  skillId: effectSkillId,
                  star: 1,
                  runtimeStatus: 'runtime-applied',
                  sourceIdentity: 'fixture:strict-soulessence-star-1',
                },
              },
            },
          }
        : actor
    ),
  };
}

function createCanonicalSwitchEvent(action, index) {
  const transactionIdentity = `non-damage|switch-enter|${action.id}`;
  const eventIdentity = `${transactionIdentity}:event:34`;
  const sourceSequencePath = [index, 34, 0];
  return {
    eventIdentity,
    transactionIdentity,
    eventId: 34,
    kind: 'switch-enter',
    timeMs: action.startMs,
    absoluteFrame: Math.round((action.startMs * 60) / 1000),
    sourceSequencePath,
    actionId: action.id,
    actorId: 'actor-b',
    applied: true,
    eventContext: {
      eventIdentity,
      transactionIdentity,
      eventId: 34,
      eventKind: 'switch-enter',
      sourceSequencePath,
      sourceActionId: action.id,
      sourceActorId: 'actor-b',
      triggerSubjectActorId: 'actor-b',
      eventTargetActorId: null,
      skillSlotIds: [],
      skillTagIds: [],
      applied: true,
      success: true,
      initialState: false,
    },
  };
}

function createScenario() {
  return {
    time: { fps: 60, durationMs: 10_000 },
    actors: [
      { id: 'actor-a', characterId: 101010, name: 'A' },
      { id: 'actor-b', characterId: 103002, name: 'B' },
      { id: 'actor-c', characterId: 101003, name: 'C' },
    ],
    actions: [
      {
        id: 'switch-to-owner',
        type: 'switch',
        actorId: 'actor-a',
        targetActorId: 'actor-b',
        startMs: 1000,
        sourceSequenceIndex: 0,
        sourceSequencePath: [0],
      },
      {
        id: 'switch-noop',
        type: 'switch',
        actorId: 'actor-b',
        targetActorId: 'actor-b',
        startMs: 1100,
        sourceSequenceIndex: 1,
        sourceSequencePath: [1],
      },
      {
        id: 'ultimate-heal',
        type: 'skill',
        actorId: 'actor-b',
        startMs: 2000,
        sourceSequenceIndex: 2,
        sourceSequencePath: [2],
      },
      {
        id: 'shield-action',
        type: 'skill',
        actorId: 'actor-a',
        startMs: 3000,
        sourceSequenceIndex: 3,
        sourceSequencePath: [3],
      },
      {
        id: 'zero-shield',
        type: 'skill',
        actorId: 'actor-a',
        startMs: 3100,
        sourceSequenceIndex: 4,
        sourceSequencePath: [4],
      },
    ],
  };
}

function createActionResolutionById() {
  return new Map([
    [
      'ultimate-heal',
      {
        actionBinding: {
          identity: 'action-binding:ultimate-heal',
          actionKind: 'ultimate',
          skillSlotId: 4,
        },
        controlBinding: {
          controlSkillId: 11200213,
          logic: { skillTag: '4', skillTagId: 4 },
        },
        selection: { subSkillIndex: 0 },
      },
    ],
    [
      'shield-action',
      {
        actionBinding: {
          identity: 'action-binding:shield-action',
          actionKind: 'ultimate',
          skillSlotId: 4,
        },
        controlBinding: {
          controlSkillId: 10800513,
          logic: { skillTag: '4', skillTagId: 4 },
        },
        selection: { subSkillIndex: 0 },
      },
    ],
  ]);
}

function createSwitchTransition({
  actionId,
  beforeActorId,
  afterActorId,
  applied,
}) {
  return {
    transitionId: `transition:${actionId}`,
    actionId,
    timeMs: actionId === 'switch-to-owner' ? 1000 : 1100,
    frameIndex: actionId === 'switch-to-owner' ? 60 : 66,
    beforeActor: { actorId: beforeActorId },
    targetActor: { actorId: afterActorId },
    afterActor: { actorId: afterActorId },
    status: applied
      ? 'controlled-actor-switch-applied'
      : 'controlled-actor-switch-noop',
    applied,
  };
}

function createVitalEvent({
  type,
  actionId,
  actorId,
  targetId,
  sourceEventIdentity,
  before,
  requestedChange,
  change,
  after,
}) {
  const timeMs = type === 'VERIFIED_DIRECT_HEAL' ? 2000 : 3000;
  return {
    type,
    timeMs,
    absoluteFrame: Math.round((timeMs * 60) / 1000),
    actionId,
    actorId,
    targetId,
    runtimeSequenceIndex: 7,
    payload: {
      sourceEventIdentity,
      sourceActorId: actorId,
      targetKind: 'actor',
      before,
      requestedChange,
      change,
      after,
      appliedToCalculators: true,
    },
  };
}
