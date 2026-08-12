import { describe, expect, it } from 'vitest';

import cycleFixture from '../../../fixtures/machine-axis/m12-cycle-dps-example.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisEnemyProfile } from '../../machine-axis/machineAxisEnemyProfileContract';
import {
  compareFastestKillCandidates,
  createMachineAxisKillEvaluator,
  createFastestKillProof,
} from '../../machine-axis/machineAxisKillEvaluator';
import { createMachineAxisObjectiveContract } from '../../machine-axis/machineAxisObjectiveContract';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';

function createResolvedProfile({ maxHp = 1000, defense = 250 } = {}) {
  return createMachineAxisEnemyProfile({
    profileId: `enemy:300032:level:80:hp:${maxHp}:defense:${defense}`,
    enemyId: 300032,
    level: 80,
    source: {
      status: 'authoritative-resolved',
      kind: 'enemy-level-pipeline',
      identity: `feature/m12-b3-enemy-level#enemy:300032:level:80:hp:${maxHp}:defense:${defense}`,
      hash: `enemy-level-output-${maxHp}-${defense}`,
    },
    attributes: {
      maxHp,
      physicalDefense: defense,
      magicalDefense: defense,
      maxToughness: 100,
      elementDefenses: { FIRE_DEFENSE: 500 },
    },
    breakRules: {
      recoveryDelayMs: 100,
      recoveryRateBasisPoints: 1000,
      breakTimeMs: 1000,
      breakEndTimeMs: 200,
      breakDamageUpBasisPoints: 10000,
      weaknessDamageMaximum: 100,
      weaknessDamageMinimum: 1,
      typeMultipliersBasisPoints: { normal: 10000 },
      elementMultipliersBasisPoints: { fire: 10000 },
    },
  });
}

function createContract(profile = createResolvedProfile()) {
  return {
    scenario: {
      fps: 60,
      durationMs: 2000,
      enemy: {
        enemyId: 300032,
        level: 80,
        profile,
      },
    },
  };
}

function damagePacket({
  frame,
  sequence,
  damage,
  requested = damage,
  lethal = false,
  breakTriggered = false,
  actionId = `action-${sequence}`,
}) {
  return {
    absoluteFrame: frame,
    timeMs: (frame * 1000) / 60,
    runtimePhasePriority: 0,
    runtimePriority: 3,
    runtimeSequenceIndex: sequence,
    actorId: 'actor-a',
    actionId,
    hitIdentity: `${actionId}|hit:0`,
    hitKey: 'hit:0',
    hitIndex: 0,
    requestedHpDamage: requested,
    effectiveHpDamage: damage,
    rawDamage: damage,
    overkill: Math.max(0, requested - damage),
    toughnessDamage: 10,
    breakTriggered,
    deathTriggered: lethal,
  };
}

function createRun(damage, events = []) {
  return {
    trace: {
      scenario: { durationMs: 2000, frameRate: 60 },
      damage,
      events,
    },
    evaluation: { totals: { netToughnessDamage: 0 } },
    hashes: {
      input: '0000000000000001',
      data: '0000000000000002',
      trace: '0000000000000003',
      evaluation: '0000000000000004',
      build: '0000000000000005',
    },
  };
}

function prove(run, contract = createContract()) {
  return createFastestKillProof(run, contract, {
    objectiveContract: createMachineAxisObjectiveContract('fastest-kill'),
  });
}

describe('Machine Axis fastest-kill proof', () => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);

  it('publishes a formal score from the current runtime while client parity remains pending', () => {
    const lethal = damagePacket({
      frame: 60,
      sequence: 1,
      damage: 100,
      requested: 120,
      lethal: true,
    });
    const report = createFastestKillProof(
      createRun([lethal]),
      createContract(),
      {
        objectiveContract: createMachineAxisObjectiveContract('fastest-kill'),
      }
    );
    expect(report).toMatchObject({
      valid: true,
      status: 'killed',
      formalScore: 1000,
      formalStatus: 'formal-score-ready-runtime-baseline',
      formalScorePolicy: {
        scoreAuthority: 'formal-for-current-runtime-contract',
        clientParityStatus: 'controlled-capture-pending-nonblocking',
      },
      warnings: [
        expect.objectContaining({
          code: 'machine-axis-enemy-settlement-client-parity-pending',
        }),
      ],
    });
  });

  it('reports exact first lethal packet, high overkill, and same-packet break', () => {
    const prior = damagePacket({ frame: 60, sequence: 1, damage: 900 });
    const lethal = damagePacket({
      frame: 60,
      sequence: 2,
      damage: 100,
      requested: 350,
      lethal: true,
      breakTriggered: true,
      actionId: 'lethal-action',
    });
    const report = prove(createRun([lethal, prior]));

    expect(report.killProof).toMatchObject({
      feasible: true,
      firstLethal: {
        frame: 60,
        actionId: 'lethal-action',
        effectiveHpDamage: 100,
        requestedHpDamage: 350,
        overkill: 250,
        breakTriggered: true,
        deathTriggered: true,
        cursor: { runtimeSequenceIndex: 2 },
      },
      stopAfterDeath: {
        verified: true,
        postLethalSettlementCount: 0,
      },
    });
  });

  it('keeps post-lethal tail packets diagnostic without changing first-lethal score', () => {
    const lethal = damagePacket({
      frame: 30,
      sequence: 1,
      damage: 100,
      lethal: true,
    });
    const afterDeath = damagePacket({
      frame: 31,
      sequence: 2,
      damage: 0,
    });
    afterDeath.toughnessDamage = 1;

    expect(prove(createRun([lethal, afterDeath]))).toMatchObject({
      valid: true,
      status: 'killed',
      formalScore: 500,
      warnings: [
        expect.objectContaining({
          code: 'machine-axis-enemy-settlement-client-parity-pending',
        }),
        expect.objectContaining({
          code: 'machine-axis-fastest-kill-post-death-settlement-ignored',
        }),
      ],
      killProof: {
        firstLethal: { frame: 30 },
        stopAfterDeath: {
          verified: false,
          postLethalSettlementCount: 1,
          scoreImpact: 'none-after-first-lethal-cursor',
        },
      },
    });
  });

  it('rejects a newly scheduled action after the first lethal cursor while keeping same-action tail packets diagnostic', () => {
    const lethal = damagePacket({
      frame: 30,
      sequence: 1,
      damage: 1000,
      lethal: true,
      actionId: 'lethal-action',
    });
    lethal.sourceSequencePath = [0, 10, 0];
    const run = createRun([lethal]);
    run.trace.actions = [
      {
        id: 'lethal-action',
        type: 'skill',
        actorId: 'actor-a',
        startMs: 0,
        sourceSequencePath: [0],
      },
      {
        id: 'post-death-action',
        type: 'skill',
        actorId: 'actor-a',
        startMs: (31 * 1000) / 60,
        targetId: 'enemy-300032',
        sourceSequencePath: [1],
      },
    ];
    run.trace.executionPlan = {
      actions: run.trace.actions.map(action => ({
        actionId: action.id,
        status: 'scheduled',
        execute: true,
        violationCodes: [],
        unresolvedCodes: [],
      })),
    };

    const report = prove(run);
    expect(report).toMatchObject({
      valid: false,
      status: 'rejected',
      formalScore: null,
      actionLegalityProof: {
        passed: false,
        rejectionCodes: ['machine-axis-action-target-dead'],
      },
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-action-target-dead',
          actionId: 'post-death-action',
          lethalActionId: 'lethal-action',
        }),
      ])
    );
  });

  it('keeps an un-killed axis infeasible and ranks real earlier kills first', () => {
    const unKilled = prove(
      createRun([damagePacket({ frame: 60, sequence: 1, damage: 999 })])
    );
    const later = prove(
      createRun([
        damagePacket({
          frame: 61,
          sequence: 1,
          damage: 1000,
          lethal: true,
        }),
      ])
    );
    const earlier = prove(
      createRun([
        damagePacket({
          frame: 60,
          sequence: 5,
          damage: 1000,
          lethal: true,
        }),
      ])
    );

    expect(unKilled).toMatchObject({
      valid: true,
      status: 'not-killed',
      formalScore: null,
      killProof: { feasible: false, firstLethal: null },
    });
    expect(
      [unKilled, later, earlier].sort(compareFastestKillCandidates)
    ).toEqual([earlier, later, unKilled]);
  });

  it('rejects a skipped or unresolved action before fastest-kill scoring', () => {
    const run = createRun([
      damagePacket({
        frame: 30,
        sequence: 1,
        damage: 1000,
        lethal: true,
        actionId: 'illegal-lethal-action',
      }),
    ]);
    run.trace.executionPlan = {
      actions: [
        {
          actionId: 'illegal-lethal-action',
          execute: false,
          status: 'skipped-rule-blocked',
          violationCodes: ['attack-input-chain-incomplete'],
          unresolvedCodes: [],
        },
      ],
    };
    const report = prove(run);
    expect(report).toMatchObject({
      valid: false,
      status: 'rejected',
      formalScore: null,
      killProof: null,
      actionLegalityProof: {
        passed: false,
        finalScoreEligible: false,
        rejectionCodes: ['attack-input-chain-incomplete'],
      },
    });
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'attack-input-chain-incomplete',
          actionId: 'illegal-lethal-action',
        }),
      ])
    );
  });

  it('rejects a structurally scheduled DAMAGE_SKIPPED carrier before fastest-kill scoring', () => {
    const run = createRun(
      [
        damagePacket({
          frame: 30,
          sequence: 1,
          damage: 1000,
          lethal: true,
          actionId: 'resolved-lethal-after-carrier',
        }),
      ],
      [
        {
          type: 'DAMAGE_SKIPPED',
          actionId: 'misa-a1-carrier',
          timeMs: 0,
          payload: {
            reason: 'verified-action-binding-unresolved',
            reasons: ['projectile-impact-frame-runtime-dependent'],
          },
        },
      ]
    );
    run.trace.executionPlan = {
      actions: [
        {
          actionId: 'misa-a1-carrier',
          execute: true,
          status: 'scheduled',
          violationCodes: [],
          unresolvedCodes: [],
        },
        {
          actionId: 'resolved-lethal-after-carrier',
          execute: true,
          status: 'scheduled',
          violationCodes: [],
          unresolvedCodes: [],
        },
      ],
    };

    expect(prove(run)).toMatchObject({
      valid: false,
      status: 'rejected',
      formalScore: null,
      actionLegalityProof: {
        passed: true,
        finalScoreEligible: false,
        scoreExclusionCodes: ['machine-axis-damage-skipped'],
      },
      issues: [
        expect.objectContaining({
          code: 'machine-axis-damage-skipped',
          actionId: 'misa-a1-carrier',
        }),
      ],
    });
  });

  it('rejects repeated A1 inputs before fastest-kill scoring', () => {
    const run = createRun([
      damagePacket({
        frame: 18,
        sequence: 1,
        damage: 1000,
        lethal: true,
        actionId: 'melania-a1-2',
      }),
    ]);
    run.trace.actions = [0, 18].map((frame, index) => ({
      id: `melania-a1-${index + 1}`,
      type: 'skill',
      actorId: 'actor-112001',
      actionKind: 'normal-attack',
      skillId: 11200101,
      startMs: (frame * 1000) / 60,
      attackGroupId: `melania-chain-${index + 1}`,
      attackSequenceIndex: 1,
      attackSequenceTotal: 5,
    }));
    run.trace.executionPlan = {
      actions: run.trace.actions.map((action, index) => ({
        actionId: action.id,
        execute: true,
        status: 'scheduled',
        violationCodes: [],
        unresolvedCodes: [],
        sourceSequenceIndex: index,
        startMs: action.startMs,
      })),
    };
    run.trace.variants = {
      selections: run.trace.actions.map(action => ({
        actionId: action.id,
        controlSkillId: 11200101,
        subSkillIndex: 0,
        attackGroupId: action.attackGroupId,
        attackSequenceIndex: 1,
        attackSequenceTotal: 5,
      })),
    };

    expect(prove(run)).toMatchObject({
      valid: false,
      status: 'rejected',
      formalScore: null,
      normalAttackInputProof: {
        passed: false,
        normalAttackInputAuthority: {
          contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        },
        issues: [
          expect.objectContaining({
            code: 'machine-axis-normal-attack-input-authority-rejected',
            actionId: 'melania-a1-2',
            phase: 'successor-window',
          }),
        ],
      },
    });
  });

  it('projects preflight action-rule rejection into a fastest-kill legality proof', () => {
    const evaluator = createMachineAxisKillEvaluator({
      service: {
        simulate() {
          const error = new Error('invalid axis');
          error.issues = [
            {
              code: 'machine-axis-action-not-executable',
              path: 'executionPlan.actions.0',
              actionId: 'formal-standalone-a2',
              violationCodes: ['attack-input-chain-incomplete'],
            },
          ];
          throw error;
        },
      },
    });
    const objectiveContract =
      createMachineAxisObjectiveContract('fastest-kill');
    const report = evaluator.evaluate(
      {
        contract: {
          scenario: {
            fps: 60,
            enemy: {
              enemyId: 300032,
              level: 80,
              profile: createResolvedProfile(),
            },
          },
        },
        objectiveContract,
      },
      { objectiveContract }
    );
    expect(report).toMatchObject({
      valid: false,
      formalScore: null,
      actionLegalityProof: {
        passed: false,
        finalScoreEligible: false,
        rejectionCodes: ['attack-input-chain-incomplete'],
        minimalCounterexamples: [
          expect.objectContaining({
            actionId: 'formal-standalone-a2',
            ruleCodes: ['attack-input-chain-incomplete'],
          }),
        ],
      },
    });
  });

  it('cuts healing at the exact lethal cursor within the same frame', () => {
    const lethal = damagePacket({
      frame: 60,
      sequence: 5,
      damage: 1000,
      lethal: true,
    });
    const before = {
      type: 'VERIFIED_DIRECT_HEAL',
      absoluteFrame: 60,
      timeMs: 1000,
      runtimePhasePriority: 0,
      runtimePriority: 2,
      runtimeSequenceIndex: 4,
      actorId: 'healer',
      actionId: 'heal-before',
      payload: { requestedChange: 50, change: 40, overheal: 10 },
    };
    const after = {
      type: 'VERIFIED_TUNING_PERIODIC_HEAL',
      absoluteFrame: 60,
      timeMs: 1000,
      runtimePhasePriority: 0,
      runtimePriority: 4,
      runtimeSequenceIndex: 6,
      actorId: 'healer',
      actionId: 'heal-after',
      payload: { requestedChange: 70, change: 70 },
    };
    const report = prove(createRun([lethal], [after, before]));

    expect(report.healing).toMatchObject({
      requestedHealing: 50,
      effectiveHealing: 40,
      overhealing: 10,
      bySourceActor: [
        expect.objectContaining({
          sourceActorId: 'healer',
          effectiveHealing: 40,
        }),
      ],
      bySourceAction: [
        expect.objectContaining({
          sourceActionId: 'heal-before',
          effectiveHealing: 40,
        }),
      ],
    });
  });

  it('fail-closes missing or renamed enemy profile inputs before scoring', () => {
    const lethal = damagePacket({
      frame: 60,
      sequence: 1,
      damage: 1000,
      lethal: true,
    });
    const missing = createContract(null);
    const renamedProfile = structuredClone(createResolvedProfile());
    renamedProfile.attributes.defense =
      renamedProfile.attributes.physicalDefense;
    delete renamedProfile.attributes.physicalDefense;

    expect(prove(createRun([lethal]), missing).valid).toBe(false);
    expect(
      prove(createRun([lethal]), createContract(renamedProfile)).issues
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-enemy-profile-property-required',
          path: 'scenario.enemy.profile.attributes.physicalDefense',
        }),
      ])
    );
  });

  it('changes real kill feasibility and exact TTK when only actual defense changes', () => {
    const objectiveContract =
      createMachineAxisObjectiveContract('fastest-kill');
    const createEnvelope = defense => {
      const contract = structuredClone(cycleFixture.contract);
      contract.dataIdentity.verifiedMechanicsPackageHash =
        mechanicsPackage.packageHash;
      contract.actions = contract.actions.filter(
        action => action.id === 'cycle-ruby-a1'
      );
      for (const slot of contract.scenario.team) {
        delete slot.loadout.kiboId;
      }
      contract.scenario.initialRuntimeState.kiboEnergyBySlot = [];
      contract.scenario.enemy.level = 80;
      contract.scenario.enemy.profile = createResolvedProfile({
        maxHp: 20,
        defense,
      });
      return {
        schemaVersion: 1,
        contractName: 'AzPrMachineAxisFastestKill',
        kind: 'azpr-machine-axis-fastest-kill',
        contract,
        objectiveContract,
      };
    };
    const service = createMachineAxisService();
    const lowDefense = service.evaluateKill(createEnvelope(0));
    const highDefense = service.evaluateKill(createEnvelope(1_000_000));

    expect(lowDefense.issues).toEqual([]);
    expect(lowDefense).toMatchObject({
      valid: true,
      status: 'killed',
      killProof: { feasible: true },
    });
    expect(highDefense).toMatchObject({
      valid: true,
      status: 'not-killed',
      killProof: { feasible: false },
    });
    expect(lowDefense.hashes.data).not.toBe(highDefense.hashes.data);
    expect(lowDefense.hashes.build).not.toBe(highDefense.hashes.build);
  }, 30_000);
});
