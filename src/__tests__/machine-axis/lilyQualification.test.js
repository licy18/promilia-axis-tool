import { describe, expect, it } from 'vitest';
import goldenTrace from '../../../reports/m10/102001/golden-trace.json';
import runtimeCoverage from '../../../reports/m10/102001/runtime-coverage.json';
import ownerContract from '../../data/generated/character-combat-owner-contracts/102001.json';
import lilyProfile from '../../data/generated/character-combat-profiles/102001.json';
import { applyVerifiedTargetStateRuntime } from '../../simulation/mechanics/verifiedTargetStateRuntime';

const OWNER_ID = 102001;
const STAR_CONTROL_ID = 10200112;
const ULTIMATE_CONTROL_ID = 10200113;
const STAR_CARRY_CONTROL_ID = 10200122;

describe('Lily M12-B3 active-surface qualification', () => {
  it('keeps the complete active inventory and source-retained frozen surface auditable', () => {
    expect(ownerContract).toMatchObject({
      compilerVersion: 8,
      ownerId: OWNER_ID,
      ownerName: '莉莉',
      status: 'character-combat-owner-contracts-compiled',
    });
    expect(ownerContract.reachableControlSkillIds).toEqual(
      expect.arrayContaining([
        10200101,
        10200102,
        10200103,
        10200104,
        10200105,
        10200110,
        STAR_CONTROL_ID,
        ULTIMATE_CONTROL_ID,
        STAR_CARRY_CONTROL_ID,
        10200126,
        48012201,
        48012202,
      ])
    );

    const normalSegments = lilyProfile.contracts.attackInputChains[0].segments;
    expect(
      normalSegments.map(segment => [
        segment.controlSkillId,
        segment.durationFrames,
        segment.executionTiming.hits.map(hit => hit.frame),
      ])
    ).toEqual([
      [10200101, 19, [6, 11, 16]],
      [10200102, 32, [8, 11, 15, 24]],
      [10200103, 40, [4, 8, 12, 16, 20, 30]],
      [10200104, 42, [13, 18, 23, 29, 34]],
      [10200105, 56, [20, 24, 28, 32, 36]],
    ]);
    expect(getHitFrames(10200110)).toEqual([5, 22, 26, 30, 34]);
    expect(getHitFrames(STAR_CONTROL_ID)).toEqual([32, 37, 42, 48, 54]);
    expect(getHitFrames(ULTIMATE_CONTROL_ID)).toEqual([
      150, 172, 182, 193, 206, 211, 216, 220, 226, 230, 236, 241,
    ]);

    expect(getControl(STAR_CONTROL_ID).logic).toMatchObject({
      spCost: 0,
      cooldownMs: 24000,
    });
    expect(getControl(ULTIMATE_CONTROL_ID).logic).toMatchObject({
      spCost: 100,
    });
    expect(getControl(STAR_CARRY_CONTROL_ID)).toMatchObject({
      frameCounts: [{ key: 0, frameCount: 81 }],
      logic: { spCost: 0, cooldownMs: 24000 },
      hits: [],
    });

    const starPassive = lilyProfile.contracts.passives.find(
      passive => passive.skillId === 10200162
    );
    expect(starPassive).toMatchObject({
      passiveIdentity: 'actor:102001:passive:10200162',
      runtimeGenerationMode: 'landed-hit-runtime',
      status: 'verified-landed-hit-runtime-passive-profile-ready',
      applied: true,
    });
    expect(starPassive.modifiers).toEqual([
      expect.objectContaining({
        kind: 'direct-sp',
        value: 0.5,
        sourceSkillId: 10200162,
      }),
    ]);

    const starCarryCoverage = runtimeCoverage.actionRows.find(
      row => row.actionKind === 'star-carry'
    );
    expect(starCarryCoverage).toMatchObject({
      sourceSkillId: STAR_CARRY_CONTROL_ID,
      rawRuntimeReady: true,
      runtimeReady: true,
      hitCount: 0,
      requiresDamageSettlement: false,
      settlementStatus: 'not-required',
    });
    expect(starCarryCoverage.publicFormSettlements[0]).toMatchObject({
      status: 'not-applicable',
      reasons: expect.arrayContaining([
        'received-damage-mitigation-is-runtime-effect-not-outgoing-damage-settlement',
        'source-control-summons-guard-without-direct-hit',
      ]),
    });

    expect(
      lilyProfile.unresolvedRecords.some(
        record =>
          record.status === 'not-applicable' &&
          record.sourceIdentity.includes('ast_480122005.asset') &&
          record.sourceIdentity.includes('skill_control_48012202.asset')
      )
    ).toBe(true);
  });

  it('grants star-skill attack and SP only for each exact landed hit', () => {
    const starHits = getControlHits(STAR_CONTROL_ID);
    const actionIds = ['all-land', 'last-only', 'all-miss', 'interrupted'];
    const actionResolutionById = new Map(
      actionIds.map(actionId => [
        actionId,
        createResolution(STAR_CONTROL_ID, starHits),
      ])
    );
    const actions = [
      createAction('all-land', 0, 0),
      createAction('last-only', 1000, 1, {
        hitOverrides: createMissOverrides(starHits.slice(0, 4)),
      }),
      createAction('all-miss', 2000, 2, {
        hitOverrides: createMissOverrides(starHits),
      }),
      createAction('interrupted', 3000, 3, {
        contextualEffectiveEndMs: 3000 + (44 / 60) * 1000,
      }),
    ];
    const result = applyVerifiedTargetStateRuntime({
      scenario: createScenario(actions),
      actionResolutionById,
      mechanicsPackage: createMechanicsPackage({
        runtimeEffectBindings:
          lilyProfile.contracts.runtimeEffectBindings.filter(
            binding => binding.controlSkillId === STAR_CONTROL_ID
          ),
      }),
    });

    expect(countByAction(result.directSpEvents)).toEqual({
      'all-land': 5,
      'last-only': 1,
      interrupted: 3,
    });
    expect(
      countByAction(
        result.effectCommands.filter(
          command => command.effectId === 'battle-element:102001119'
        ),
        'sourceActionId'
      )
    ).toEqual({
      'all-land': 5,
      'last-only': 1,
      interrupted: 3,
    });
    expect(result.directSpEvents.every(event => event.value === 0.5)).toBe(
      true
    );
    expect(
      result.directSpEvents.every(
        event =>
          event.sourceSequencePath[1] === event.triggerHitIndex &&
          event.sourceSequencePath.slice(-3).join(',') === '30,1,0'
      )
    ).toBe(true);
    expect(
      result.events
        .filter(
          event =>
            event.type ===
              'VERIFIED_RUNTIME_EFFECT_LANDED_HIT_CONDITION_NOT_MET' &&
            event.payload.bindingIdentity ===
              'lily-star-skill-per-landed-hit-sp'
        )
        .filter(event => event.actionId === 'interrupted')
        .map(event => [
          event.payload.triggerFrame,
          event.payload.withinOccupancy,
        ])
    ).toEqual([
      [48, false],
      [54, false],
    ]);

    const nonCapDirectSp = goldenTrace.actual.resources.actorSp
      .find(resource => resource.actorId === 'actor-102001')
      .actionTransactions.filter(
        transaction =>
          transaction.actionId === 'lily-star-skill' &&
          transaction.reason === 'verified-direct-sp'
      );
    const atCapDirectSp = goldenTrace.actual.resources.actorSp
      .find(resource => resource.actorId === 'actor-102001')
      .actionTransactions.filter(
        transaction =>
          transaction.actionId === 'lily-star-skill-at-cap' &&
          transaction.reason === 'verified-direct-sp'
      );
    expect(nonCapDirectSp.map(transaction => transaction.change)).toEqual([
      0.5, 0.5, 0.5, 0.5, 0.5,
    ]);
    expect(atCapDirectSp).toEqual([]);
  });

  it('creates at most three wind marks from the three exact wall hits', () => {
    const ultimateHits = getControlHits(ULTIMATE_CONTROL_ID);
    const markBindings = lilyProfile.contracts.actionEffectBindings.filter(
      binding => binding.bindingIdentity.startsWith('lily-ultimate-wind-mark-')
    );
    expect(
      markBindings.map(binding => [
        binding.triggerFrame,
        binding.landedHitActivationCondition.hitIdentity,
        binding.landedHitActivationCondition.behaviorPathId,
      ])
    ).toEqual([
      [
        211,
        '10200113|0|elements|6|8236903294079356132|211|6',
        '5790785966890863275',
      ],
      [
        216,
        '10200113|0|elements|6|8236903294079356132|216|7',
        '1384799686497127083',
      ],
      [
        220,
        '10200113|0|elements|6|8236903294079356132|220|8',
        '-6639102421339288917',
      ],
    ]);

    const markHits = markBindings.map(
      binding => binding.landedHitActivationCondition
    );
    const actionResolutionById = new Map([
      [
        'all-land',
        createResolution(
          ULTIMATE_CONTROL_ID,
          ultimateHits,
          createConditionalEffects(markBindings)
        ),
      ],
      [
        'last-only',
        createResolution(
          ULTIMATE_CONTROL_ID,
          ultimateHits,
          createConditionalEffects(markBindings)
        ),
      ],
      [
        'all-miss',
        createResolution(
          ULTIMATE_CONTROL_ID,
          ultimateHits,
          createConditionalEffects(markBindings)
        ),
      ],
      [
        'interrupted',
        createResolution(
          ULTIMATE_CONTROL_ID,
          ultimateHits,
          createConditionalEffects(markBindings)
        ),
      ],
    ]);
    const result = applyVerifiedTargetStateRuntime({
      scenario: createScenario([
        createAction('all-land', 0, 0),
        createAction('last-only', 5000, 1, {
          hitOverrides: createMissOverrides(markHits.slice(0, 2)),
        }),
        createAction('all-miss', 10000, 2, {
          hitOverrides: createMissOverrides(markHits),
        }),
        createAction('interrupted', 15000, 3, {
          contextualEffectiveEndMs: 15000 + (218 / 60) * 1000,
        }),
      ]),
      actionResolutionById,
      mechanicsPackage: createMechanicsPackage(),
    });

    expect(
      Object.fromEntries(
        [...actionResolutionById].map(([actionId, resolution]) => [
          actionId,
          resolution.effects.length,
        ])
      )
    ).toEqual({
      'all-land': 3,
      'last-only': 1,
      'all-miss': 0,
      interrupted: 2,
    });
    expect(
      result.actionHitActivationResults
        .filter(resultEntry => resultEntry.actionId === 'interrupted')
        .map(resultEntry => [resultEntry.applied, resultEntry.reason])
    ).toEqual([
      [true, 'same-action-hit-landed'],
      [true, 'same-action-hit-landed'],
      [false, 'same-action-hit-outside-effective-occupancy'],
    ]);
  });

  it('keeps Will active for seven seconds while enemy-driven branches stay N/A', () => {
    expect(lilyProfile.contracts.targetStateProfiles).toEqual([
      expect.objectContaining({
        stateIdentity: 'lily-will',
        elementId: 102001135,
        durationMs: 7000,
        maxStacks: 1,
        atCapacityPolicy: 'refresh-oldest',
        runtimeOwnerScope: 'scenario-roster',
      }),
    ]);
    expect(
      lilyProfile.contracts.targetStateTransactions.map(transaction => [
        transaction.transactionIdentity,
        transaction.controlSkillId,
        transaction.triggerFrame,
        transaction.durationMs,
      ])
    ).toEqual([
      ['lily-will-star-skill', STAR_CONTROL_ID, 1, 7000],
      ['lily-will-ultimate', ULTIMATE_CONTROL_ID, 243, 7000],
    ]);
    expect(
      goldenTrace.actual.trace.targetStates
        .filter(event => event.stateIdentity === 'lily-will')
        .map(event => [event.actionId, event.frame, event.operation])
    ).toEqual([
      ['lily-star-skill-at-cap', 1, 'gain'],
      [null, 421, 'expire'],
      ['lily-ultimate', 443, 'gain'],
      [null, 863, 'expire'],
      ['lily-star-skill', 1801, 'gain'],
      [null, 2221, 'expire'],
    ]);

    const notApplicable = lilyProfile.unresolvedRecords.filter(
      record => record.status === 'not-applicable'
    );
    expect(
      notApplicable.some(record =>
        record.reasons.includes(
          'enemy-hit-driven-perfect-defense-branch-not-applicable-in-passive-boss-scenario'
        )
      )
    ).toBe(true);
    expect(
      notApplicable.some(record =>
        record.reasons.includes(
          'perfect-defense-state-required-not-applicable-in-passive-boss-scenario'
        )
      )
    ).toBe(true);
    expect(
      notApplicable.some(record =>
        record.reasons.includes('hero-rank-unimplemented-dead-configuration')
      )
    ).toBe(true);
  });

  it('locks golden hit ordering, cooldown/resource gates, and active buffs', () => {
    const markEvents = goldenTrace.actual.trace.tuningMarks.filter(
      event =>
        event.actionId === 'lily-ultimate' &&
        event.markId === 750 &&
        event.kind === 'acquire'
    );
    expect(
      markEvents.map(event => [event.frame, event.before, event.after])
    ).toEqual([
      [411, 0, 1],
      [416, 1, 2],
      [420, 2, 3],
    ]);
    expect(
      goldenTrace.actual.trace.tuningMarks
        .filter(event => event.frame === 411 && event.markId === 750)
        .map(event => event.kind)
    ).toEqual(['acquire', 'held-trigger']);

    const markSelectors = lilyProfile.contracts.actionEffectBindings
      .filter(binding =>
        binding.bindingIdentity.startsWith('lily-ultimate-wind-mark-')
      )
      .map(binding => binding.landedHitActivationCondition.hitIdentity);
    expect(
      goldenTrace.actual.trace.damage
        .filter(
          event =>
            event.actionId === 'lily-ultimate' &&
            markSelectors.includes(event.hitIdentity)
        )
        .map(event => [
          event.frame,
          event.hitIdentity,
          event.sourceSequencePath,
        ])
    ).toEqual([
      [411, markSelectors[0], [3, 6, 0]],
      [416, markSelectors[1], [3, 7, 0]],
      [420, markSelectors[2], [3, 8, 0]],
    ]);

    expect(
      goldenTrace.actual.actions.blockedActionDetails.map(detail => [
        detail.actionId,
        detail.violationCodes,
      ])
    ).toEqual([
      ['lily-star-skill-cd-blocked', ['skill-cooldown-active']],
      ['lily-ultimate-cd-blocked', ['skill-cooldown-active']],
      [
        'lily-ultimate-resource-blocked',
        ['verified-resource-cost-unavailable'],
      ],
    ]);

    const attackBuffEvents = goldenTrace.actual.trace.effects.filter(
      event => event.effectId === 'battle-element:102001119'
    );
    expect(
      attackBuffEvents.map(event => [
        event.actionId,
        event.frame,
        event.operation,
        event.modifiers[0].attributeId,
        event.modifiers[0].valueRaw,
      ])
    ).toEqual([
      ['lily-star-skill-at-cap', 32, 'apply', 1, 400],
      ['lily-star-skill-at-cap', 37, 'apply', 1, 400],
      ['lily-star-skill-at-cap', 42, 'apply', 1, 400],
      ['lily-star-skill-at-cap', 48, 'apply', 1, 400],
      ['lily-star-skill-at-cap', 54, 'apply', 1, 400],
      ['lily-star-skill-at-cap', 414, 'expire', 1, 400],
      ['lily-star-skill', 1832, 'apply', 1, 400],
      ['lily-star-skill', 1837, 'apply', 1, 400],
      ['lily-star-skill', 1842, 'apply', 1, 400],
      ['lily-star-skill', 1848, 'apply', 1, 400],
      ['lily-star-skill', 1854, 'apply', 1, 400],
      ['lily-star-skill', 2214, 'expire', 1, 400],
    ]);

    expect(
      goldenTrace.actual.trace.effects
        .filter(event => event.effectId === 'battle-element:480122004')
        .map(event => [
          event.actionId,
          event.frame,
          event.operation,
          event.targetId,
          event.modifiers[0].attributeId,
          event.modifiers[0].valueRaw,
        ])
    ).toEqual([
      [
        'switch-to-xiaoyu--on-exit--actor-102001--star-carry',
        2051,
        'apply',
        'actor-101010',
        22,
        1900,
      ],
      [
        'switch-to-xiaoyu--on-exit--actor-102001--star-carry',
        2411,
        'expire',
        'actor-101010',
        22,
        1900,
      ],
    ]);
  });

  it('scales Guard by skill level and isolates declarative runtime ownership', () => {
    const guardBinding = lilyProfile.contracts.runtimeEffectBindings.find(
      binding => binding.bindingIdentity === 'lily-star-carry-guard'
    );
    const actions = [
      createAction('guard-level-1', 0, 0, { level: 1 }),
      createAction('guard-level-12', 1000, 1, { level: 12 }),
    ];
    const result = applyVerifiedTargetStateRuntime({
      scenario: createScenario(actions, [
        createActor('actor-102001', OWNER_ID),
        createActor('actor-101010', 101010),
      ]),
      actionResolutionById: new Map(
        actions.map(action => [
          action.id,
          createResolution(STAR_CARRY_CONTROL_ID, []),
        ])
      ),
      mechanicsPackage: createMechanicsPackage({
        runtimeEffectBindings: [guardBinding],
      }),
      controlledActorTimeline: createControlledActorTimeline(),
    });

    expect(
      result.effectCommands.map(command => [
        command.sourceActionId,
        command.targetId,
        command.durationMs,
        command.modifiers[0].valueRaw,
      ])
    ).toEqual([
      ['guard-level-1', 'actor-101010', 6000, 1900],
      ['guard-level-12', 'actor-101010', 6000, 3000],
    ]);

    const unrelatedAction = createAction('unrelated-owner', 0, 0, {
      actorId: 'actor-999999',
      characterId: 999999,
    });
    const unrelated = applyVerifiedTargetStateRuntime({
      scenario: createScenario(
        [unrelatedAction],
        [createActor('actor-999999', 999999)]
      ),
      actionResolutionById: new Map([
        [unrelatedAction.id, createResolution(STAR_CARRY_CONTROL_ID, [])],
      ]),
      mechanicsPackage: createMechanicsPackage({
        runtimeEffectBindings: [guardBinding],
      }),
      controlledActorTimeline: createControlledActorTimeline(
        'actor-999999',
        999999
      ),
    });
    expect(unrelated.effectCommands).toEqual([]);
  });
});

function getControl(controlSkillId) {
  return lilyProfile.contracts.controls.find(
    control => control.controlSkillId === controlSkillId
  );
}

function getControlHits(controlSkillId, subSkillIndex = 0) {
  return getControl(controlSkillId)
    .hits.filter(hit => hit.trigger.subSkillIndexes.includes(subSkillIndex))
    .sort((left, right) => left.hitIndex - right.hitIndex);
}

function getHitFrames(controlSkillId, subSkillIndex = 0) {
  return getControlHits(controlSkillId, subSkillIndex).map(
    hit => hit.trigger.startFrame
  );
}

function createMechanicsPackage({ runtimeEffectBindings = [] } = {}) {
  return {
    packageId: 'lily-m12-b3-focused-package',
    packageHash: 'lily-m12-b3-focused-hash',
    actionVariantGraph: {
      targetStateProfiles: [],
      targetStateTransactions: [],
      conditionalHitGroups: [],
      runtimeEffectBindings,
    },
  };
}

function createResolution(controlSkillId, hits, effects = []) {
  return {
    ready: true,
    packageId: 'lily-m12-b3-focused-package',
    actionBinding: {
      identity: `lily-focused-action-${controlSkillId}`,
      controlSkillId,
      selectedSubSkillIndex: 0,
    },
    controlBinding: { frameRate: 60 },
    hits: structuredClone(hits),
    effects: structuredClone(effects),
  };
}

function createConditionalEffects(bindings) {
  return bindings.map(binding => ({
    effectIdentity: binding.bindingIdentity,
    elementId: binding.elementId,
    trigger: { startFrame: binding.triggerFrame },
    landedHitActivationCondition: binding.landedHitActivationCondition,
    classification: 'applied',
    applied: true,
  }));
}

function createAction(id, startMs, sourceSequenceIndex, overrides = {}) {
  const actorId = overrides.actorId ?? 'actor-102001';
  const characterId = overrides.characterId ?? OWNER_ID;
  const {
    actorId: _actorId,
    characterId: _characterId,
    ...actionOverrides
  } = overrides;
  return {
    id,
    name: id,
    startMs,
    sourceSequenceIndex,
    sourceSequencePath: [sourceSequenceIndex],
    actorId,
    actor: createActor(actorId, characterId),
    ...actionOverrides,
  };
}

function createActor(id, characterId) {
  return {
    id,
    characterId,
    name: `Actor ${characterId}`,
  };
}

function createScenario(
  actions,
  actors = [createActor('actor-102001', OWNER_ID)]
) {
  return {
    time: { durationMs: 30000 },
    policy: { defaultWillHit: true },
    actors,
    enemy: { id: 'enemy-1', name: 'Passive Boss' },
    actions,
  };
}

function createMissOverrides(hitsOrConditions) {
  return Object.fromEntries(
    hitsOrConditions.map(hit => [hit.hitIdentity, { willHit: false }])
  );
}

function countByAction(entries, key = 'actionId') {
  return Object.fromEntries([
    ...entries.reduce((counts, entry) => {
      const actionId = entry[key];
      counts.set(actionId, (counts.get(actionId) ?? 0) + 1);
      return counts;
    }, new Map()),
  ]);
}

function createControlledActorTimeline(
  actorId = 'actor-101010',
  characterId = 101010
) {
  return {
    initialActor: {
      actorId,
      characterId,
      actorName: `Actor ${characterId}`,
    },
    transitions: [],
    intervals: [
      {
        startMs: 0,
        endMs: 30000,
        actorId,
        name: `Actor ${characterId}`,
      },
    ],
  };
}
