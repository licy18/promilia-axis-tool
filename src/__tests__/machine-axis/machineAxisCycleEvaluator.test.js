import cycleFixture from '../../../fixtures/machine-axis/m12-cycle-dps-example.json';
import acceptanceReport from '../../../reports/m12/m12-b2-cycle-dps-example-20260801.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  collectCycleDamageContributions,
  compareCycleBoundaryStates,
  createCycleReplayStabilityProof,
  validateMachineAxisCycleEnvelope,
} from '../../machine-axis/machineAxisCycleEvaluator';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createMachineAxisEnemyProfile } from '../../machine-axis/machineAxisEnemyProfileContract';

function createNormalAttackCycleEnvelope() {
  return structuredClone(cycleFixture);
}

function createResolvedCycleEnemyProfile(
  defense,
  {
    maxToughness = 6667,
    recoveryDelayMs = 100,
    recoveryRateBasisPoints = 1000,
    breakTimeMs = 10000,
    breakEndTimeMs = 2000,
  } = {}
) {
  return createMachineAxisEnemyProfile({
    profileId: `enemy:300032:level:1:defense:${defense}`,
    enemyId: 300032,
    level: 1,
    source: {
      status: 'authoritative-resolved',
      kind: 'enemy-level-pipeline',
      identity: `feature/m12-b3-enemy-level#enemy:300032:level:1:defense:${defense}`,
      hash: `enemy-level-output-${defense}`,
    },
    attributes: {
      maxHp: 8628,
      physicalDefense: defense,
      magicalDefense: defense,
      maxToughness,
      elementDefenses: {},
    },
    breakRules: {
      recoveryDelayMs,
      recoveryRateBasisPoints,
      breakTimeMs,
      breakEndTimeMs,
      breakDamageUpBasisPoints: 10000,
      weaknessDamageMaximum: maxToughness,
      weaknessDamageMinimum: 1,
      typeMultipliersBasisPoints: {},
      elementMultipliersBasisPoints: {},
    },
  });
}

function createStarSkillCooldownEnvelope() {
  const envelope = createNormalAttackCycleEnvelope();
  const rubySlot = envelope.contract.scenario.team[0];
  const pangpangSlot = envelope.contract.scenario.team[2];
  envelope.contract.scenario.team[0] = { ...pangpangSlot, slotId: 'slot-1' };
  envelope.contract.scenario.team[2] = { ...rubySlot, slotId: 'slot-3' };
  envelope.contract.actions = [
    {
      id: 'cycle-pangpang-star-skill',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10100712,
        actionKind: 'star-skill',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 60 },
    },
  ];
  envelope.contract.scenario.durationFrames = 1500;
  envelope.loop = { startFrame: 60, endFrame: 660 };
  return envelope;
}

function createRubyAmmoDeficitEnvelope() {
  const envelope = createNormalAttackCycleEnvelope();
  envelope.contract.actions.push({
    id: 'cycle-ruby-enhanced-e1',
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: 10300201,
      actionKind: 'normal-attack',
      attackInput: { sequenceIndex: 1, groupId: 'cycle-ruby-enhanced' },
      level: 1,
    },
    schedule: { mode: 'after-previous-end', offsetFrames: 0 },
  });
  return envelope;
}

function createOneTimeWarmupBuffEnvelope() {
  const envelope = createNormalAttackCycleEnvelope();
  envelope.contract.scenario.team[0] = {
    slotId: 'slot-1',
    characterId: 101003,
    level: 1,
    initialSp: 100,
    loadout: { kiboId: 500003 },
    cultivation: {},
  };
  envelope.contract.scenario.initialRuntimeState.kiboEnergyBySlot[0] = {
    slotId: 'slot-1',
    actorId: 'actor-101003',
    characterId: 101003,
    kiboId: 500003,
    kiboName: '水灵偶',
    currentValue: 60,
    maxValue: 100,
  };
  envelope.contract.scenario.initialRuntimeState.specialResourcesByActor = [];
  envelope.contract.scenario.durationFrames = 3600;
  envelope.contract.actions = [
    {
      id: 'warmup-han-ultimate',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10100313,
        actionKind: 'ultimate',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
    {
      id: 'cycle-han-a1',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10100301,
        actionKind: 'normal-attack',
        attackInput: { sequenceIndex: 1, groupId: 'cycle-han' },
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 600 },
    },
  ];
  envelope.loop = { startFrame: 600, endFrame: 1800 };
  return envelope;
}

function createKiboInternalCooldownEnvelope() {
  const envelope = createNormalAttackCycleEnvelope();
  envelope.contract.scenario.id = 'm12-b2-kibo-internal-cooldown';
  envelope.contract.scenario.durationFrames = 1500;
  envelope.contract.scenario.team[0].loadout = { kiboId: 500206 };
  envelope.contract.scenario.initialRuntimeState.kiboEnergyBySlot[0] = {
    slotId: 'slot-1',
    actorId: 'actor-103002',
    characterId: 103002,
    kiboId: 500206,
    kiboName: '驮驮龙',
    currentValue: 100,
    maxValue: 100,
  };
  envelope.contract.actions = [
    {
      id: 'warmup-actor-combo',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10300212,
        actionKind: 'star-combo',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
    {
      id: 'warmup-kibo-break',
      owner: { kind: 'kibo', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 50020604,
        actionKind: 'break',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
    {
      id: 'cycle-actor-combo',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10300212,
        actionKind: 'star-combo',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 540 },
    },
    {
      id: 'cycle-kibo-break',
      owner: { kind: 'kibo', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 50020604,
        actionKind: 'break',
        level: 1,
      },
      schedule: { mode: 'absolute', frame: 540 },
    },
  ];
  envelope.loop = { startFrame: 540, endFrame: 840 };
  envelope.options = { criticalPolicy: 'expected' };
  return envelope;
}

function createKiboPassiveCycleEnvelope({
  kiboId,
  kiboName,
  publicActionId,
  actionKind = 'active',
  warmupFrames = [],
  loopStartFrame = 420,
  loopEndFrame = 780,
}) {
  const envelope = createNormalAttackCycleEnvelope();
  envelope.contract.scenario.id = `m12-b2-kibo-passive-${kiboId}`;
  envelope.contract.scenario.durationFrames = loopEndFrame * 2;
  envelope.contract.scenario.team[0].loadout = { kiboId };
  envelope.contract.scenario.initialRuntimeState.kiboEnergyBySlot[0] = {
    slotId: 'slot-1',
    actorId: 'actor-103002',
    characterId: 103002,
    kiboId,
    kiboName,
    currentValue: 100,
    maxValue: 100,
  };
  const createAction = (id, frame) => ({
    id,
    owner: { kind: 'kibo', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId,
      actionKind,
      level: 1,
    },
    schedule: { mode: 'absolute', frame },
  });
  envelope.contract.actions = [
    ...warmupFrames.map((frame, index) =>
      createAction(`warmup-kibo-active-${index + 1}`, frame)
    ),
    createAction('cycle-kibo-active', loopStartFrame),
  ];
  envelope.loop = { startFrame: loopStartFrame, endFrame: loopEndFrame };
  envelope.options = { criticalPolicy: 'expected' };
  return envelope;
}

function createKiboUnlimitedAfterDamageEnvelope() {
  return createKiboPassiveCycleEnvelope({
    kiboId: 500261,
    kiboName: '河狸仔',
    publicActionId: 502001,
    actionKind: 'normal-attack',
    warmupFrames: [60],
  });
}

function createKiboFiniteTriggerEnvelope() {
  return createKiboPassiveCycleEnvelope({
    kiboId: 500040,
    kiboName: '铁球蜥',
    publicActionId: 50004002,
    actionKind: 'signature',
  });
}

function createTuningMarkBoundary({
  stacks,
  decayRemainingFrames = 0,
  heldReadyRemainingFrames = 0,
}) {
  return {
    activeActorId: 'actor-1',
    actors: [],
    kibos: [],
    specialResources: [],
    cooldowns: [],
    effects: [],
    pendingEvents: [],
    tuningMarks: [
      {
        profileKey: 'fire',
        markId: 4,
        stacks,
        decayRemainingFrames,
        heldReadyRemainingFrames,
      },
    ],
  };
}

function createKiboPassiveBoundary({
  internalCooldownRemainingFrames,
  triggerCount = 1,
  maxTriggerCount = null,
  remainingTriggerCount = null,
  triggerLifetime = maxTriggerCount == null ? 'unlimited' : 'finite',
  kiboId = 500206,
  skillId = 520008,
  effects = [],
}) {
  return {
    activeActorId: 'actor-1',
    actors: [],
    kibos: [],
    specialResources: [],
    cooldowns: [],
    effects,
    pendingEvents: [],
    tuningMarks: [],
    kiboPassiveRuntime: [
      {
        stateIdentity: `kibo-passive-runtime:actor-1|${kiboId}|${skillId}`,
        passiveKey: `actor-1|${kiboId}|${skillId}`,
        actorId: 'actor-1',
        slotId: 'slot-1',
        kiboId,
        skillId,
        internalCooldownRemainingFrames,
        triggerCount,
        triggerLifetime,
        maxTriggerCount,
        remainingTriggerCount,
        triggerLimitScope: 'passive-element-lifetime',
        sourceIdentityHash: 'kibo-passive-source',
      },
    ],
  };
}

describe('Machine Axis sustainable cycle DPS evaluator', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('rejects missing and empty half-open loop intervals', () => {
    const missing = createNormalAttackCycleEnvelope();
    delete missing.loop;
    expect(validateMachineAxisCycleEnvelope(missing)).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({ code: 'machine-axis-cycle-loop-required' }),
      ],
    });

    const empty = createNormalAttackCycleEnvelope();
    empty.loop.endFrame = empty.loop.startFrame;
    expect(validateMachineAxisCycleEnvelope(empty)).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'machine-axis-cycle-loop-empty',
          path: 'loop',
        }),
      ],
    });
  });

  it('rejects a standalone normal-chain successor before cycle scoring', () => {
    const envelope = createNormalAttackCycleEnvelope();
    envelope.contract.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    envelope.contract.actions = [
      {
        id: 'formal-standalone-a2',
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 10300201,
          actionKind: 'normal-attack',
          attackInput: {
            sequenceIndex: 2,
            groupId: 'formal-orphan-chain',
          },
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 60 },
      },
    ];
    envelope.loop = { startFrame: 60, endFrame: 360 };

    const report = createMachineAxisService().evaluateCycle(envelope, {
      allowUnverifiedRuntimeTiming: true,
    });
    expect(report).toMatchObject({
      valid: false,
      status: 'rejected',
      actionLegalityProof: {
        passed: false,
        finalScoreEligible: false,
        rejectionCodes: expect.arrayContaining([
          'attack-input-chain-incomplete',
        ]),
      },
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-action-not-executable',
          actionId: 'formal-standalone-a2',
        }),
      ])
    );
  });

  it('rejects a mapped same-frame joint pair while existPetBreakTarget remains unresolved', () => {
    const envelope = createNormalAttackCycleEnvelope();
    envelope.contract.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    envelope.contract.scenario.team[0].loadout = { kiboId: 500001 };
    envelope.contract.scenario.initialRuntimeState.kiboEnergyBySlot[0] = {
      slotId: 'slot-1',
      actorId: 'actor-103002',
      characterId: 103002,
      kiboId: 500001,
      kiboName: '迅狼',
      currentValue: 100,
      maxValue: 100,
    };
    envelope.contract.actions = [
      {
        id: 'formal-actor-joint',
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 10300212,
          actionKind: 'star-combo',
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 60 },
      },
      {
        id: 'formal-kibo-joint',
        owner: { kind: 'kibo', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 50000112,
          actionKind: 'break',
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 60 },
      },
    ];
    envelope.loop = { startFrame: 60, endFrame: 360 };

    const report = createMachineAxisService().evaluateCycle(envelope, {
      allowUnverifiedRuntimeTiming: true,
    });
    expect(report).toMatchObject({
      valid: false,
      status: 'rejected',
      actionLegalityProof: {
        passed: false,
        finalScoreEligible: false,
        rejectionCodes: expect.arrayContaining([
          'joint-attack-trigger-unresolved',
          'machine-axis-same-frame-order-unresolved',
        ]),
        minimalCounterexamples: expect.arrayContaining([
          expect.objectContaining({
            code: 'joint-attack-trigger-unresolved',
            actionId: 'formal-actor-joint',
          }),
        ]),
      },
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'joint-attack-trigger-unresolved',
          actionId: 'formal-actor-joint',
        }),
      ])
    );
  });

  it('rejects coercible, additional, and schema-invalid cycle fields before normalization', () => {
    const invalid = createNormalAttackCycleEnvelope();
    invalid.loop.startFrame = '60';
    invalid.loop.displayName = 'not-contract-data';
    invalid.options = { criticalPolicy: 'expected', seeds: [1.5] };

    const result = validateMachineAxisCycleEnvelope(invalid);
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cycle-loop-start-invalid',
          path: 'loop.startFrame',
        }),
        expect.objectContaining({
          code: 'machine-axis-cycle-additional-property',
          path: 'loop.displayName',
        }),
        expect.objectContaining({
          code: 'machine-axis-cycle-seeds-invalid',
          path: 'options.seeds',
        }),
      ])
    );

    invalid.options.seeds = [];
    expect(validateMachineAxisCycleEnvelope(invalid).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-cycle-seeds-invalid',
          path: 'options.seeds',
        }),
      ])
    );
  });

  it('rejects every enemy toughness and Break phase drift at a cycle boundary', () => {
    const createBoundary = () => ({
      activeActorId: 'actor-1',
      actors: [],
      kibos: [],
      actorVitals: [],
      kiboVitals: [],
      specialResources: [],
      cooldowns: [],
      effects: [],
      pendingEvents: [],
      tuningMarks: [],
      enemy: {
        hp: 1000,
        maxHp: 1000,
        toughness: 100,
        maxToughness: 100,
        inBreak: false,
        breakPhase: 'normal',
        breakElapsedMs: 0,
        recoveryDelayRemainingMs: 0,
        defeated: false,
        profileSourceIdentity: 'enemy-profile-hash',
      },
    });
    for (const mutate of [
      enemy => {
        enemy.toughness = 99;
      },
      enemy => {
        enemy.inBreak = true;
      },
      enemy => {
        enemy.breakPhase = 'linear_recovery';
      },
      enemy => {
        enemy.breakElapsedMs = 100;
      },
      enemy => {
        enemy.recoveryDelayRemainingMs = 100;
      },
      enemy => {
        enemy.profileSourceIdentity = 'other-enemy-profile-hash';
      },
    ]) {
      const start = createBoundary();
      const end = createBoundary();
      mutate(end.enemy);
      expect(compareCycleBoundaryStates(start, end)).toMatchObject({
        closed: false,
        issues: [
          expect.objectContaining({
            code: 'machine-axis-cycle-state-not-closed',
            dimension: 'enemy',
          }),
        ],
      });
    }
  });

  it('rejects normal-chain phase drift and normalizes replay-local predecessor identities', () => {
    const createBoundary = ({ currentFrame, cycle, remainingFrames = 20 }) => ({
      currentFrame,
      activeActorId: 'actor-1',
      actors: [],
      kibos: [],
      actorVitals: [],
      kiboVitals: [],
      specialResources: [],
      cooldowns: [],
      chargeCooldowns: [],
      effects: [],
      pendingEvents: [],
      tuningMarks: [],
      attackChains: [
        {
          actorId: 'actor-1',
          chainIdentity: 'normal-chain:1001',
          groupId: `cycle-${cycle}:normal-group`,
          sequenceIndex: 1,
          sequenceTotal: 3,
          nextSequenceIndex: 2,
          status: 'successor-window',
          predecessorAcceptedIdentity: `cycle-${cycle}:a1`,
          publicActionId: 1001,
          linkWindowStatus: 'applied',
          linkWindowStartFrame: currentFrame,
          linkWindowEndFrame: currentFrame + remainingFrames,
          linkWindowSourceIdentity: 'client-input-window:a1-a2',
        },
      ],
    });
    const first = createBoundary({ currentFrame: 100, cycle: 1 });
    const replay = createBoundary({ currentFrame: 400, cycle: 2 });
    expect(compareCycleBoundaryStates(first, replay)).toMatchObject({
      closed: true,
      issues: [],
    });

    const drifted = createBoundary({
      currentFrame: 400,
      cycle: 2,
      remainingFrames: 19,
    });
    expect(compareCycleBoundaryStates(first, drifted)).toMatchObject({
      closed: false,
      issues: [
        expect.objectContaining({
          code: 'machine-axis-cycle-state-not-closed',
          dimension: 'attackChains',
        }),
      ],
    });

    expect(
      compareCycleBoundaryStates({ ...first, attackChains: [] }, replay).issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        dimension: 'attackChains',
      })
    );
  });

  it('accepts an exact zero-frame loop boundary without including later frames', () => {
    const envelope = createNormalAttackCycleEnvelope();
    envelope.contract.actions = envelope.contract.actions.filter(
      action => action.id !== 'warmup-wait'
    );
    envelope.contract.actions[0].schedule.frame = 0;
    envelope.loop = { startFrame: 0, endFrame: 300 };

    const report = createMachineAxisService().evaluateCycle(envelope);
    expect(report.valid).toBe(true);
    expect(report.loop).toMatchObject({ startFrame: 0, endFrame: 300 });
    expect(report.warmup).toMatchObject({ durationFrames: 0, actionIds: [] });
    expect(
      report.contributions.byHit.every(
        row => row.firstFrame >= 0 && row.lastFrame < 300
      )
    ).toBe(true);
  }, 30_000);

  it('counts delayed hits by actual frame in a half-open interval exactly once', () => {
    const events = [
      {
        actionId: 'warmup',
        hitIdentity: 'h-before',
        absoluteFrame: 59,
        rawDamage: 2,
      },
      {
        actionId: 'cycle',
        hitIdentity: 'h-start',
        absoluteFrame: 60,
        rawDamage: 3,
      },
      {
        actionId: 'cycle',
        hitIdentity: 'h-last',
        absoluteFrame: 119,
        rawDamage: 5,
      },
      {
        actionId: 'cycle',
        hitIdentity: 'h-end',
        absoluteFrame: 120,
        rawDamage: 7,
      },
    ];
    const first = collectCycleDamageContributions(events, {
      startFrame: 60,
      endFrame: 120,
      fps: 60,
    });
    const second = collectCycleDamageContributions(events, {
      startFrame: 120,
      endFrame: 180,
      fps: 60,
    });

    expect(first).toMatchObject({ hpDamage: 8, combatHitCount: 2 });
    expect(first.byHit.map(row => row.hitIdentity)).toEqual([
      'h-last',
      'h-start',
    ]);
    expect(second).toMatchObject({ hpDamage: 7, combatHitCount: 1 });
    expect(first.hpDamage + second.hpDamage).toBe(15);
  });

  it('rejects a consumable resource deficit even when values remain non-negative', () => {
    const result = compareCycleBoundaryStates(
      {
        activeActorId: 'actor-1',
        actors: [{ actorId: 'actor-1', sp: 100, max: 100 }],
        kibos: [],
        tuningMarks: [],
        specialResources: [],
        cooldowns: [],
        effects: [],
        pendingEvents: [],
      },
      {
        activeActorId: 'actor-1',
        actors: [{ actorId: 'actor-1', sp: 90, max: 100 }],
        kibos: [],
        tuningMarks: [],
        specialResources: [],
        cooldowns: [],
        effects: [],
        pendingEvents: [],
      }
    );

    expect(result.closed).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-resource-deficit',
        resourceIdentity: 'actor:1:sp',
        startValue: 100,
        endValue: 90,
      })
    );
  });

  it('keeps BeforeSkill trigger intervals in the cycle boundary state', () => {
    const createBoundary = remainingFrames => ({
      activeActorId: 'actor-1',
      actors: [{ actorId: 'actor-1', sp: 100, max: 100 }],
      kibos: [],
      tuningMarks: [],
      specialResources: [],
      actorVitals: [],
      kiboVitals: [],
      cooldowns: [],
      effects: [],
      soulTriggerIntervals: [
        {
          bindingKey: 'actor-1|set-skill:1:4|199999024',
          intervalMs: 12000,
          remainingFrames,
          sourceIdentityHash: 'c12-source',
        },
      ],
      kiboPassiveRuntime: [],
      targetStates: [],
      shields: [],
      pendingEvents: [],
    });

    expect(
      compareCycleBoundaryStates(createBoundary(360), createBoundary(360))
    ).toMatchObject({
      closed: true,
      stateDiffs: expect.arrayContaining([
        expect.objectContaining({
          dimension: 'soulTriggerIntervals',
          equal: true,
        }),
      ]),
    });
    expect(
      compareCycleBoundaryStates(createBoundary(360), createBoundary(0)).issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        path: 'state.soulTriggerIntervals',
      })
    );
  });

  it('keeps periodic persistent-root cadence phase in the cycle boundary state', () => {
    const createBoundary = remainingFrames => ({
      activeActorId: 'actor-1',
      actors: [{ actorId: 'actor-1', sp: 100, max: 100 }],
      kibos: [],
      tuningMarks: [],
      specialResources: [],
      actorVitals: [],
      kiboVitals: [],
      cooldowns: [],
      effects: [],
      soulPeriodicRoots: [
        {
          bindingKey: 'actor-1|soulessence:10084|root:19006000',
          actorId: 'actor-1',
          ownerIdentity: 'soulessence:10084',
          rootElementId: 19006000,
          intervalFrames: 60,
          remainingFrames,
          sourceIdentityHash: 'c15-periodic-root-source',
        },
      ],
      kiboPassiveRuntime: [],
      targetStates: [],
      shields: [],
      pendingEvents: [],
    });

    expect(
      compareCycleBoundaryStates(createBoundary(41), createBoundary(41))
    ).toMatchObject({
      closed: true,
      stateDiffs: expect.arrayContaining([
        expect.objectContaining({
          dimension: 'soulPeriodicRoots',
          equal: true,
        }),
      ]),
    });
    expect(
      compareCycleBoundaryStates(createBoundary(41), createBoundary(17)).issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        path: 'state.soulPeriodicRoots',
      })
    );
  });

  it('rejects a loop that consumes a finite loadout trigger lifetime', () => {
    const createBoundary = ({ acceptedCount, remainingTriggerCount }) => ({
      activeActorId: 'actor-1',
      actors: [{ actorId: 'actor-1', sp: 100, max: 100 }],
      kibos: [],
      tuningMarks: [],
      specialResources: [],
      actorVitals: [],
      kiboVitals: [],
      cooldowns: [],
      effects: [],
      soulTriggerCounters: [
        {
          bindingKey: 'actor-1|set-skill:6:4|199999063',
          triggerType: 1,
          configuredTriggerCounter: 999999,
          triggerCounterLimit: 999999,
          acceptedCount,
          remainingTriggerCount,
          exhausted: false,
          sourceIdentityHash: 'c13-source',
        },
      ],
      kiboPassiveRuntime: [],
      targetStates: [],
      shields: [],
      pendingEvents: [],
    });
    const result = compareCycleBoundaryStates(
      createBoundary({ acceptedCount: 4, remainingTriggerCount: 999995 }),
      createBoundary({ acceptedCount: 6, remainingTriggerCount: 999993 })
    );

    expect(result.closed).toBe(false);
    expect(result.stateDiffs).toContainEqual(
      expect.objectContaining({
        dimension: 'soulTriggerCounters',
        equal: false,
      })
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        path: 'state.soulTriggerCounters',
      })
    );
  });

  it('keeps cooldown charge identity in the closure proof', () => {
    const start = {
      activeActorId: 'actor-1',
      actors: [],
      kibos: [],
      tuningMarks: [],
      specialResources: [],
      cooldowns: [
        {
          runtimeOwnerIdentity: 'character-slot:slot-1',
          ownerId: 'actor-1',
          skillId: 1001,
          chargeIndex: 0,
          cooldownCount: 2,
          endMs: 2000,
          status: 'skill-cooldown-window-active',
        },
      ],
      effects: [],
      pendingEvents: [],
      timeMs: 1000,
    };
    const end = structuredClone(start);
    end.timeMs = 2000;
    end.cooldowns[0].endMs = 3000;

    const result = compareCycleBoundaryStates(start, end);
    expect(result.closed).toBe(true);
    expect(result.stateDiffs).toContainEqual(
      expect.objectContaining({
        dimension: 'cooldowns',
        equal: true,
        start: [
          expect.objectContaining({
            runtimeOwnerIdentity: 'character-slot:slot-1',
            chargeIndex: 0,
            cooldownCount: 2,
            remainingFrames: 60,
          }),
        ],
      })
    );
  });

  it('compares shared charge state and normalizes only cycle-local action identities', () => {
    const createBoundary = ({
      coolTimeMs = 12_000,
      actionId = 'moyin-star-2',
      ultimateId = 'moyin-ultimate',
    } = {}) => ({
      activeActorId: 'actor-109001',
      actors: [],
      kibos: [],
      tuningMarks: [],
      specialResources: [],
      cooldowns: [],
      chargeCooldowns: [
        {
          runtimeOwnerIdentity: 'actor:actor-109001',
          ownerId: 'actor-109001',
          skillId: 10900112,
          cooldownIdentity: 10900112,
          fullCooldownMs: 15_000,
          chargeMaxCount: 2,
          currentChargeCount: 0,
          coolTimeMs,
          sharedTimerRunning: true,
          lastSettlementIdentity: `cooldown-charge-cast|${actionId}`,
          lastCooldownReductionTransactionId: `cooldown-reduction|${ultimateId}|109001171|0`,
          missingChargeSourceActionIds: [actionId],
        },
      ],
      effects: [],
      pendingEvents: [],
    });
    const first = createBoundary();
    const replay = createBoundary({
      actionId: 'cycle-2:moyin-star-2',
      ultimateId: 'cycle-2:moyin-ultimate',
    });

    expect(compareCycleBoundaryStates(first, replay)).toMatchObject({
      closed: true,
      stateDiffs: expect.arrayContaining([
        expect.objectContaining({
          dimension: 'chargeCooldowns',
          equal: true,
        }),
      ]),
    });
    expect(
      compareCycleBoundaryStates(first, createBoundary({ coolTimeMs: 11_000 }))
        .issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        path: 'state.chargeCooldowns',
      })
    );
    expect(
      compareCycleBoundaryStates(
        first,
        createBoundary({ actionId: 'different-star-cast' })
      ).closed
    ).toBe(false);
  });

  it('compares Kibo passive internal cooldowns by relative remaining time', () => {
    const start = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 600,
      triggerCount: 1,
    });
    const equalPhase = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 600,
      triggerCount: 2,
    });
    const shiftedPhase = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 300,
      triggerCount: 2,
    });

    expect(compareCycleBoundaryStates(start, equalPhase)).toMatchObject({
      closed: true,
      stateDiffs: expect.arrayContaining([
        expect.objectContaining({
          dimension: 'kiboPassiveRuntime',
          equal: true,
        }),
      ]),
    });
    expect(
      compareCycleBoundaryStates(start, shiftedPhase).issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        dimension: 'kiboPassiveRuntime',
      })
    );
  });

  it('requires finite Kibo passive trigger lifetime to close', () => {
    const start = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 0,
      triggerCount: 1,
      maxTriggerCount: 4,
      remainingTriggerCount: 3,
    });
    const depleted = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 0,
      triggerCount: 2,
      maxTriggerCount: 4,
      remainingTriggerCount: 2,
    });

    expect(compareCycleBoundaryStates(start, depleted).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        dimension: 'kiboPassiveRuntime',
      })
    );
  });

  it('rejects equal tuning-mark stacks with a shorter remaining lifecycle', () => {
    const base = createTuningMarkBoundary({
      stacks: 2,
      decayRemainingFrames: 600,
    });
    const end = structuredClone(base);
    end.tuningMarks[0].decayRemainingFrames = 300;

    const result = compareCycleBoundaryStates(base, end);
    expect(result.closed).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-tuning-mark-decay-regressed',
        markIdentity: 'tuning-mark:fire:4',
      })
    );
  });

  it('accepts equal tuning-mark stacks with equal or longer decay time', () => {
    const start = createTuningMarkBoundary({
      stacks: 2,
      decayRemainingFrames: 600,
      heldReadyRemainingFrames: 120,
    });
    for (const endDecayRemainingFrames of [599, 600, 660]) {
      const end = createTuningMarkBoundary({
        stacks: 2,
        decayRemainingFrames: endDecayRemainingFrames,
        heldReadyRemainingFrames: 120,
      });
      expect(compareCycleBoundaryStates(start, end)).toMatchObject({
        closed: true,
        tuningMarkDiffs: [
          expect.objectContaining({ decayClosed: true, heldReadyClosed: true }),
        ],
      });
    }
  });

  it('ignores tuning-mark timers when both boundaries have zero stacks', () => {
    const start = createTuningMarkBoundary({
      stacks: 0,
      decayRemainingFrames: 600,
      heldReadyRemainingFrames: 120,
    });
    const end = createTuningMarkBoundary({
      stacks: 0,
      decayRemainingFrames: 60,
      heldReadyRemainingFrames: 300,
    });

    expect(compareCycleBoundaryStates(start, end)).toMatchObject({
      closed: true,
      tuningMarkDiffs: [
        expect.objectContaining({
          startDecayRemainingFrames: 0,
          endDecayRemainingFrames: 0,
          startHeldReadyRemainingFrames: 0,
          endHeldReadyRemainingFrames: 0,
          decayClosed: true,
          heldReadyClosed: true,
        }),
      ],
    });
  });

  it('accepts more tuning-mark stacks despite shorter decay when held-ready is unchanged', () => {
    const start = createTuningMarkBoundary({
      stacks: 2,
      decayRemainingFrames: 600,
      heldReadyRemainingFrames: 120,
    });
    const end = createTuningMarkBoundary({
      stacks: 3,
      decayRemainingFrames: 60,
      heldReadyRemainingFrames: 120,
    });

    expect(compareCycleBoundaryStates(start, end)).toMatchObject({
      closed: true,
      tuningMarkDiffs: [
        expect.objectContaining({
          stackDelta: 1,
          decayClosed: true,
          heldReadyClosed: true,
        }),
      ],
    });
  });

  it('rejects fewer tuning-mark stacks as a resource deficit', () => {
    const start = createTuningMarkBoundary({
      stacks: 2,
      decayRemainingFrames: 600,
    });
    const end = createTuningMarkBoundary({
      stacks: 1,
      decayRemainingFrames: 1200,
    });

    expect(compareCycleBoundaryStates(start, end).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-resource-deficit',
        resourceIdentity: 'tuning-mark:fire:4',
        startValue: 2,
        endValue: 1,
      })
    );
  });

  it('requires held-ready wait to stay equal or improve independently', () => {
    const start = createTuningMarkBoundary({
      stacks: 2,
      decayRemainingFrames: 600,
      heldReadyRemainingFrames: 120,
    });
    for (const endHeldReadyRemainingFrames of [120, 60]) {
      const end = createTuningMarkBoundary({
        stacks: 2,
        decayRemainingFrames: 600,
        heldReadyRemainingFrames: endHeldReadyRemainingFrames,
      });
      expect(compareCycleBoundaryStates(start, end).closed).toBe(true);
    }

    const regressed = createTuningMarkBoundary({
      stacks: 3,
      decayRemainingFrames: 1200,
      heldReadyRemainingFrames: 180,
    });
    expect(compareCycleBoundaryStates(start, regressed).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-tuning-mark-held-ready-regressed',
        markIdentity: 'tuning-mark:fire:4',
      })
    );
  });

  it('rejects enemy target-state layers that do not close', () => {
    const base = {
      activeActorId: 'actor-1',
      actors: [],
      kibos: [],
      specialResources: [],
      cooldowns: [],
      effects: [],
      pendingEvents: [],
      tuningMarks: [],
      targetStates: [
        {
          stateIdentity: 'enemy:firework',
          targetKind: 'enemy',
          currentValue: 2,
          maxValue: 15,
          layers: [
            { remainingFrames: 600, sourceIdentityHash: 'source-a' },
            { remainingFrames: 900, sourceIdentityHash: 'source-b' },
          ],
        },
      ],
    };
    const end = structuredClone(base);
    end.targetStates[0].layers.shift();
    end.targetStates[0].currentValue = 1;

    const result = compareCycleBoundaryStates(base, end);
    expect(result.closed).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        dimension: 'targetStates',
      })
    );
  });

  it('rejects a real Ruby enhanced input that consumes non-renewed ammunition', () => {
    const report = createMachineAxisService().evaluateCycle(
      createRubyAmmoDeficitEnvelope()
    );

    expect(report.valid).toBe(false);
    expect(report.status).toBe('rejected');
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-resource-deficit',
        resourceIdentity: 'actor:103002:element:103002047',
        startValue: 6,
        endValue: 5,
        delta: -1,
      })
    );
  }, 30_000);

  it('rejects a one-time warmup benefit when the second cycle damage falls', () => {
    const proof = createCycleReplayStabilityProof({
      firstCycle: { hpDamage: 120, combatHitCount: 2 },
      secondCycle: { hpDamage: 100, combatHitCount: 2 },
      firstClosure: { closed: true, issues: [] },
      secondClosure: { closed: true, issues: [] },
      secondExecution: { runnable: true, issues: [] },
    });

    expect(proof.stable).toBe(false);
    expect(proof.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-damage-not-stable',
        firstHpDamage: 120,
        secondHpDamage: 100,
      })
    );
  });

  it('rejects a real one-time warmup Buff that expires before the next cycle', () => {
    const report = createMachineAxisService().evaluateCycle(
      createOneTimeWarmupBuffEnvelope()
    );

    expect(report.valid).toBe(false);
    expect(report.status).toBe('rejected');
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.stringMatching(
            /^machine-axis-cycle-(?:state-not-closed|damage-not-stable)$/
          ),
        }),
      ])
    );
  }, 30_000);

  it('rejects a real second replay that is still on cooldown', () => {
    const report = createMachineAxisService().evaluateCycle(
      createStarSkillCooldownEnvelope()
    );
    expect(report.valid).toBe(false);
    expect(report.status).toBe('rejected');
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-second-replay-not-runnable',
      })
    );
  }, 30_000);

  it('accepts a real two-cycle normal-attack loop with stable damage and closure', () => {
    const envelope = createNormalAttackCycleEnvelope();
    envelope.contract.dataIdentity.verifiedMechanicsPackageHash =
      mechanicsPackage.packageHash;
    const report = createMachineAxisService().evaluateCycle(envelope);
    expect(report.issues).toEqual([]);
    expect(report).toMatchObject({
      kind: 'azpr-machine-axis-cycle-dps-evaluation',
      valid: true,
      status: 'closed',
      assumptions: {
        enemyHp: 'infinite',
        toughness: 'disabled',
        break: 'disabled',
        deathTruncation: 'disabled',
      },
      loop: {
        interval: '[start,end)',
        startFrame: 60,
        endFrame: 360,
        durationFrames: 300,
        durationSeconds: 5,
        actionIds: ['cycle-ruby-a1', 'cycle-ruby-a2', 'cycle-ruby-a3'],
      },
    });
    expect(report.evidence.evidenceClosed).toBe(false);
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'machine-axis-source-evidence-open' }),
        expect.objectContaining({ code: 'machine-axis-scenario-assumption' }),
      ])
    );
    expect(report.metrics.loopHpDamage).toBeGreaterThan(0);
    expect(report.metrics.cycleDps).toBeCloseTo(
      report.metrics.loopHpDamage / 5,
      8
    );
    expect(report.replayProof.stable).toBe(true);
    expect(report.replayProof.cycles).toHaveLength(2);
    expect(report.replayProof.cycles[1].runnable).toBe(true);
    expect(
      report.replayProof.secondExecution.variantPairs.every(
        pair => pair.equivalent
      )
    ).toBe(true);
    expect(report.samples[0].secondCycle.hpDamage).toBe(
      report.metrics.loopHpDamage
    );
    expect(
      report.samples[0].firstCycle.enemySettlementPackets.every(
        packet =>
          packet.toughnessDamage === 0 &&
          packet.breakTriggered === false &&
          packet.inBreakForHpDamage === false &&
          packet.hpDamageMultiplier === 1
      )
    ).toBe(true);
    expect(report.samples[0].firstCycle.enemyStateTransitions).toEqual([]);
    expect(report.samples[0].loopPlan.replayHorizonFrame).toBe(
      cycleFixture.contract.scenario.durationFrames
    );
    expect(report.warmup.actionIds).toEqual(['warmup-wait']);
    expect(
      report.contributions.byHit.every(
        row => row.firstFrame >= 60 && row.lastFrame < 360
      )
    ).toBe(true);
    expect(report.stateClosure[0].start.enemy.toughness).toBe(
      report.stateClosure[0].firstEnd.enemy.toughness
    );
    expect(report.stateClosure[0].firstEnd.enemy.inBreak).toBe(false);
    expect(
      report.contributions.byActor.reduce((sum, row) => sum + row.hpDamage, 0)
    ).toBeCloseTo(report.metrics.loopHpDamage, 8);
    expect(
      report.contributions.byAction.reduce((sum, row) => sum + row.hpDamage, 0)
    ).toBeCloseTo(report.metrics.loopHpDamage, 8);
    expect(
      report.contributions.byHit.reduce((sum, row) => sum + row.hpDamage, 0)
    ).toBeCloseTo(report.metrics.loopHpDamage, 8);
    expect(report.hashes.input).toMatch(/^[0-9a-f]{16}$/);
    expect(report.hashes.trace).toMatch(/^[0-9a-f]{16}$/);
    expect(report.hashes.cycle).toMatch(/^[0-9a-f]{16}$/);
  }, 30_000);

  it('scores settled post-defense cycle damage while the action packets stay fixed', () => {
    const service = createMachineAxisService();
    const lowDefense = createNormalAttackCycleEnvelope();
    const highDefense = createNormalAttackCycleEnvelope();
    lowDefense.contract.scenario.enemy.profile =
      createResolvedCycleEnemyProfile(0);
    highDefense.contract.scenario.enemy.profile =
      createResolvedCycleEnemyProfile(5000);

    const lowReport = service.evaluateCycle(lowDefense);
    const highReport = service.evaluateCycle(highDefense);

    expect(lowReport.valid).toBe(true);
    expect(highReport.valid).toBe(true);
    expect(highReport.loop).toEqual(lowReport.loop);
    expect(highReport.metrics.loopHpDamage).toBeLessThan(
      lowReport.metrics.loopHpDamage
    );
    expect(highReport.metrics.cycleDps).toBeLessThan(
      lowReport.metrics.cycleDps
    );
    expect(
      highReport.samples[0].firstCycle.enemySettlementPackets.map(
        packet => packet.preDefenseHpDamage
      )
    ).toEqual(
      lowReport.samples[0].firstCycle.enemySettlementPackets.map(
        packet => packet.preDefenseHpDamage
      )
    );
    expect(
      highReport.samples[0].firstCycle.enemySettlementPackets.map(
        packet => packet.effectiveHpDamage
      )
    ).not.toEqual(
      lowReport.samples[0].firstCycle.enemySettlementPackets.map(
        packet => packet.effectiveHpDamage
      )
    );
    expect(highReport.hashes.data).not.toBe(lowReport.hashes.data);
    expect(highReport.hashes.build).not.toBe(lowReport.hashes.build);
  }, 30_000);

  it('scores a closed toughness loop against the versioned runtime baseline', () => {
    const envelope = createNormalAttackCycleEnvelope();
    envelope.options.objective = 'cycle-dps-with-toughness';
    envelope.contract.scenario.enemy.profile = createResolvedCycleEnemyProfile(
      0,
      {
        maxToughness: 1,
        recoveryDelayMs: 0,
        recoveryRateBasisPoints: 10000,
        breakTimeMs: 100,
        breakEndTimeMs: 0,
      }
    );
    const report = createMachineAxisService().evaluateCycle(envelope);
    const highDefenseEnvelope = structuredClone(envelope);
    highDefenseEnvelope.contract.scenario.enemy.profile =
      createResolvedCycleEnemyProfile(5000, {
        maxToughness: 1,
        recoveryDelayMs: 0,
        recoveryRateBasisPoints: 10000,
        breakTimeMs: 100,
        breakEndTimeMs: 0,
      });
    const highDefenseReport =
      createMachineAxisService().evaluateCycle(highDefenseEnvelope);

    expect(report.valid).toBe(true);
    expect(highDefenseReport.valid).toBe(true);
    expect(highDefenseReport.metrics.cycleDps).toBeLessThan(
      report.metrics.cycleDps
    );
    expect(report.formalScore).toBe(report.metrics.cycleDps);
    expect(report.formalStatus).toBe('formal-score-ready-runtime-baseline');
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-enemy-settlement-client-parity-pending',
      })
    );
    expect(report.enemySettlementTiming).toMatchObject({
      semantics: {
        breakingPacketHpDamagePhase: 'pre-break',
        breakIntervalEnd: 'right-open',
      },
      formalScoring: { formalReady: true },
      evidence: { clientParityReady: false },
    });
    const packets = report.samples[0].firstCycle.enemySettlementPackets;
    const breakingPackets = packets.filter(packet => packet.breakTriggered);
    expect(breakingPackets.length).toBeGreaterThanOrEqual(2);
    expect(
      breakingPackets.every(
        packet =>
          packet.inBreakForHpDamage === false &&
          packet.hpDamageMultiplier === 1 &&
          packet.toughnessBefore === 1 &&
          packet.toughnessAfter === 0
      )
    ).toBe(true);
    expect(
      packets.filter(
        packet =>
          packet.inBreakForHpDamage === true && packet.hpDamageMultiplier === 2
      ).length
    ).toBeGreaterThanOrEqual(1);
    const breakExits =
      report.samples[0].firstCycle.enemyStateTransitions.filter(
        event => event.stateEventKind === 'break-exit'
      );
    expect(breakExits).toHaveLength(breakingPackets.length);
    expect(report.stateClosure[0].start.enemy).toEqual(
      report.stateClosure[0].firstEnd.enemy
    );
    expect(report.stateClosure[0].firstEnd.enemy).toEqual(
      report.stateClosure[0].secondEnd.enemy
    );
  }, 30_000);

  it('aggregates explicit sampled seeds without losing contribution conservation', () => {
    const envelope = createNormalAttackCycleEnvelope();
    envelope.options = {
      criticalPolicy: 'sampled',
      seeds: ['cycle-seed-a', 'cycle-seed-b'],
    };
    const report = createMachineAxisService().evaluateCycle(envelope);

    expect(report.valid).toBe(true);
    expect(report.critical).toEqual({
      policy: 'sampled',
      seeds: ['cycle-seed-a', 'cycle-seed-b'],
    });
    expect(report.samples).toHaveLength(2);
    expect(report.samples.map(sample => sample.seed)).toEqual([
      'cycle-seed-a',
      'cycle-seed-b',
    ]);
    for (const sample of report.samples) {
      expect(sample.hashes.trace).toMatch(/^[0-9a-f]{16}$/);
      expect(sample.replayProof.stable).toBe(true);
    }
    for (const rows of [
      report.contributions.byActor,
      report.contributions.byAction,
      report.contributions.byHit,
    ]) {
      expect(rows.reduce((sum, row) => sum + row.hpDamage, 0)).toBeCloseTo(
        report.metrics.loopHpDamage,
        8
      );
    }
    expect(report.metrics.healing).toMatchObject({
      requestedHealing: 0,
      effectiveHealing: 0,
      overhealing: 0,
      effectiveHps: 0,
    });
    expect(report.sampleStatistics.healingContributionConservation).toEqual({
      healingBySourceActor: {
        sampleMean: 0,
        contributionMean: 0,
        difference: 0,
        conserved: true,
      },
      healingBySourceAction: {
        sampleMean: 0,
        contributionMean: 0,
        difference: 0,
        conserved: true,
      },
    });
    expect(report.hashes.input).toMatch(/^[0-9a-f]{16}$/);
    expect(report.hashes.cycle).toMatch(/^[0-9a-f]{16}$/);
  }, 30_000);

  it('accepts pure-damage sampled variance and reports conserved seed statistics', () => {
    const envelope = createNormalAttackCycleEnvelope();
    const seeds = Array.from({ length: 64 }, (_, index) => `seed-${index}`);
    envelope.options = { criticalPolicy: 'sampled', seeds };

    const report = createMachineAxisService().evaluateCycle(envelope);
    const sampleDamages = report.samples.map(
      sample => sample.firstCycle.hpDamage
    );

    expect(report.valid).toBe(true);
    expect(report.issues).not.toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-damage-not-stable',
      })
    );
    expect(new Set(sampleDamages).size).toBeGreaterThan(1);
    expect(report.sampleStatistics).toMatchObject({
      sampleCount: 64,
      loopHpDamage: {
        count: 64,
        mean: 214,
        variance: 158.98412698,
        quantiles: {
          p5: 207,
          p25: 207,
          p50: 207,
          p75: 225,
          p95: 235,
        },
      },
      cycleDps: {
        count: 64,
        mean: 42.8,
        variance: 6.35936508,
        quantiles: {
          p5: 41.4,
          p25: 41.4,
          p50: 41.4,
          p75: 45,
          p95: 47,
        },
      },
      contributionConservation: {
        byActor: {
          sampleMean: 214,
          contributionMean: 214,
          difference: 0,
          conserved: true,
        },
        byAction: {
          sampleMean: 214,
          contributionMean: 214,
          difference: 0,
          conserved: true,
        },
        byHit: {
          sampleMean: 214,
          contributionMean: 214,
          difference: 0,
          conserved: true,
        },
      },
    });
    expect(report.metrics.loopHpDamage).toBe(214);
    expect(report.metrics.cycleDps).toBe(42.8);
    expect(report.hashes).toMatchObject({
      input: 'a3c2307ed28407e8',
      data: 'c19d3749e637f3bd',
      trace: 'ea95b477ee2e3916',
      evaluation: 'f5b33471d4ab338f',
      cycle: '00b5bed60983e4bb',
    });
    expect(report.sampleStatistics.loopHpDamage.variance).toBeGreaterThan(0);
    for (const dimension of ['byActor', 'byAction', 'byHit']) {
      expect(
        report.contributions[dimension].reduce(
          (sum, row) => sum + row.hpDamage,
          0
        )
      ).toBeCloseTo(report.sampleStatistics.loopHpDamage.mean, 8);
    }
    expect(
      report.samples.every(
        sample =>
          sample.replayProof.damageStabilityMode ===
            'cycle-local-common-random-numbers' && sample.replayProof.stable
      )
    ).toBe(true);
  }, 120_000);

  it('does not let sampled common-random proof hide a one-time warmup state leak', () => {
    const envelope = createOneTimeWarmupBuffEnvelope();
    envelope.options = {
      criticalPolicy: 'sampled',
      seeds: ['one-time-buff-a', 'one-time-buff-b'],
    };

    const report = createMachineAxisService().evaluateCycle(envelope);

    expect(report.valid).toBe(false);
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: expect.stringMatching(
            /^machine-axis-cycle-(?:state-not-closed|damage-not-stable)$/
          ),
        }),
      ])
    );
  }, 60_000);

  it('keeps infinite-HP damage and contributions independent from finite initial HP', () => {
    const baseline = createMachineAxisService().evaluateCycle(
      createNormalAttackCycleEnvelope()
    );
    const lowHpEnvelope = createNormalAttackCycleEnvelope();
    lowHpEnvelope.contract.scenario.initialRuntimeState.enemy = {
      hp: { currentValue: 1, maxValue: 1 },
      toughness: { currentValue: 1, maxValue: 1 },
    };
    const report = createMachineAxisService().evaluateCycle(lowHpEnvelope);
    const closure = report.stateClosure[0];

    expect(report.valid).toBe(true);
    expect(report.metrics).toEqual(baseline.metrics);
    expect(report.contributions).toEqual(baseline.contributions);
    expect(report.samples[0].firstCycle).toEqual(
      baseline.samples[0].firstCycle
    );
    expect(report.samples[0].secondCycle).toEqual(
      baseline.samples[0].secondCycle
    );
    expect(closure.start.enemy.hp).toBe(closure.firstEnd.enemy.hp);
    expect(closure.firstEnd.enemy.hp).toBe(closure.secondEnd.enemy.hp);
    expect(closure.start.enemy.toughness).toBe(
      closure.secondEnd.enemy.toughness
    );
    expect(closure.secondEnd.enemy.inBreak).toBe(false);
  }, 30_000);

  it('rejects a loop whose Kibo passive internal cooldown phase does not close', () => {
    const service = createMachineAxisService();
    const envelope = createKiboInternalCooldownEnvelope();
    const report = service.evaluateCycle(envelope);
    const canonicalRun = service.simulate(envelope.contract);

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        dimension: 'kiboPassiveRuntime',
      })
    );
    expect(
      report.samples[0].replayProof.firstClosure.stateDiffs
    ).toContainEqual(
      expect.objectContaining({
        dimension: 'kiboPassiveRuntime',
        equal: false,
      })
    );
    const passiveStateDiff =
      report.samples[0].replayProof.firstClosure.stateDiffs.find(
        row => row.dimension === 'kiboPassiveRuntime'
      );
    expect(
      passiveStateDiff.start[0].internalCooldownRemainingFrames
    ).toBeGreaterThan(passiveStateDiff.end[0].internalCooldownRemainingFrames);
    expect(canonicalRun.trace.state.kiboPassives).toContainEqual(
      expect.objectContaining({
        actorId: 'actor-103002',
        kiboId: 500206,
        skillId: 520008,
        internalCooldownMs: 15000,
        triggerCount: 2,
        maxTriggerCount: null,
        remainingTriggerCount: null,
      })
    );
  }, 30_000);

  it('accepts the real 520082 practical-unlimited trigger cycle', () => {
    const service = createMachineAxisService();
    const envelope = createKiboUnlimitedAfterDamageEnvelope();
    const report = service.evaluateCycle(envelope);
    const run = service.simulate(envelope.contract);
    const passive = run.trace.state.kiboPassives.find(
      row => row.skillId === 520082
    );

    expect(report.valid).toBe(true);
    expect(report.metrics).toMatchObject({
      loopHpDamage: 928.85993958,
      combatHitCount: 6,
    });
    const closure = report.stateClosure[0];
    expect(report.metrics.loopHpDamage).toBeGreaterThan(
      closure.start.enemy.maxHp
    );
    for (const enemyState of [
      closure.start.enemy,
      closure.firstEnd.enemy,
      closure.secondEnd.enemy,
    ]) {
      expect(enemyState).toMatchObject({
        hp: 690.24,
        maxHp: 690.24,
        defeated: false,
      });
    }
    expect(passive).toMatchObject({
      skillId: 520082,
      triggerLifetime: 'unlimited',
      configuredTriggerCounter: 9999999,
      maxTriggerCount: null,
      remainingTriggerCount: null,
    });
    expect(
      report.stateClosure.flatMap(row => [
        ...(row.start.kiboPassiveRuntime ?? []),
        ...(row.firstEnd.kiboPassiveRuntime ?? []),
        ...(row.secondEnd.kiboPassiveRuntime ?? []),
      ])
    ).not.toContainEqual(
      expect.objectContaining({ remainingTriggerCount: expect.any(Number) })
    );
  }, 30_000);

  it('accepts a saturated 520087 refresh boundary with an unlimited trigger lifetime', () => {
    const effects = [
      {
        effectId: 'kibo-passive:520087:520087002',
        ownerId: 'actor-1',
        targetKind: 'actor',
        targetId: 'actor-1',
        stacks: 6,
        remainingFrames: 1440,
        sourceIdentityHash: '520087-source',
      },
      {
        effectId: 'kibo-passive:520087:520087002',
        ownerId: 'actor-1',
        targetKind: 'kibo',
        targetId: 'actor-1',
        stacks: 6,
        remainingFrames: 1440,
        sourceIdentityHash: '520087-source',
      },
    ];
    const start = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 0,
      triggerCount: 6,
      triggerLifetime: 'unlimited',
      kiboId: 500043,
      skillId: 520087,
      effects,
    });
    const end = createKiboPassiveBoundary({
      internalCooldownRemainingFrames: 0,
      triggerCount: 7,
      triggerLifetime: 'unlimited',
      kiboId: 500043,
      skillId: 520087,
      effects,
    });

    expect(compareCycleBoundaryStates(start, end)).toMatchObject({
      closed: true,
      stateDiffs: expect.arrayContaining([
        expect.objectContaining({ dimension: 'effects', equal: true }),
        expect.objectContaining({
          dimension: 'kiboPassiveRuntime',
          equal: true,
        }),
      ]),
    });
  });

  it('keeps a real finite one-trigger Kibo passive outside closed cycles', () => {
    const service = createMachineAxisService();
    const envelope = createKiboFiniteTriggerEnvelope();
    const report = service.evaluateCycle(envelope);
    const run = service.simulate(envelope.contract);
    const passive = run.trace.state.kiboPassives.find(
      row => row.skillId === 520083
    );

    expect(report.valid).toBe(false);
    expect(report.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-second-replay-not-runnable',
      })
    );
    expect(passive).toMatchObject({
      skillId: 520083,
      triggerLifetime: 'finite',
      configuredTriggerCounter: 1,
      maxTriggerCount: 1,
      remainingTriggerCount: 0,
    });
  }, 30_000);

  it('keeps toughness damage independent from the break toggle', () => {
    const contract = structuredClone(cycleFixture.contract);
    contract.scenario.target = {
      hpMode: 'finite',
      toughnessMode: 'enabled',
      breakMode: 'disabled',
      deathTruncation: 'enabled',
    };
    const run = createMachineAxisService().simulate(contract);

    expect(run.trace.state.final.enemy.toughness).toBeLessThan(
      run.trace.state.initial.enemy.toughness
    );
    expect(run.trace.state.final.enemy.inBreak).toBe(false);
  }, 30_000);

  it('keeps the committed cycle acceptance report synchronized', () => {
    const report = createMachineAxisService().evaluateCycle(
      createNormalAttackCycleEnvelope()
    );
    expect(report).toEqual(acceptanceReport);
  }, 30_000);
});
