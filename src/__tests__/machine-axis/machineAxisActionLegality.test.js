import { describe, expect, it } from 'vitest';
import { createMachineAxisActionLegalityProof } from '../../machine-axis/machineAxisActionLegality';

function createRun(actions) {
  return {
    trace: {
      executionPlan: { actions },
      diagnostics: { actionRules: { diagnostics: [] } },
    },
    hashes: {
      input: 'input-hash',
      data: 'data-hash',
      trace: 'trace-hash',
      build: 'build-hash',
    },
  };
}

describe('Machine Axis action legality proof', () => {
  it('accepts only fully scheduled actions', () => {
    const proof = createMachineAxisActionLegalityProof(
      createRun([
        {
          actionId: 'a1',
          status: 'scheduled',
          execute: true,
          violationCodes: [],
          unresolvedCodes: [],
        },
      ]),
      { objectiveId: 'cycle-dps-no-toughness' }
    );
    expect(proof).toMatchObject({
      passed: true,
      finalScoreEligible: true,
      rejectionCodes: [],
      normalAttackInputAuthority: {
        schemaVersion: expect.any(Number),
        contractName: expect.any(String),
        policyVersion: expect.any(Number),
        contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
      },
      proofHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
  });

  it('rejects skipped and unresolved actions before formal scoring', () => {
    const proof = createMachineAxisActionLegalityProof(
      createRun([
        {
          actionId: 'orphan-a2',
          status: 'skipped-rule-blocked',
          execute: false,
          violationCodes: ['attack-input-chain-incomplete'],
          unresolvedCodes: [],
        },
        {
          actionId: 'unresolved-window',
          status: 'scheduled-with-unresolved-conditions',
          execute: true,
          violationCodes: [],
          unresolvedCodes: ['attack-input-link-timing-unresolved'],
        },
      ]),
      { objectiveId: 'fastest-kill' }
    );
    expect(proof).toMatchObject({
      passed: false,
      finalScoreEligible: false,
      skippedActionCount: 1,
      unresolvedActionCount: 1,
      rejectionCounts: {
        'attack-input-chain-incomplete': 1,
        'attack-input-link-timing-unresolved': 1,
      },
    });
  });

  it('normalizes readiness, every resource owner, owner/target preflight and same-frame warnings into one proof', () => {
    const run = createRun([]);
    run.validation = {
      warnings: [
        {
          code: 'machine-axis-same-frame-order-unresolved',
          path: 'actions',
          actionIds: ['actor-hit', 'kibo-hit'],
          absoluteFrame: 120,
        },
      ],
    };
    const proof = createMachineAxisActionLegalityProof(run, {
      objectiveId: 'cycle-dps-with-toughness',
      preflightIssues: [
        {
          code: 'machine-axis-action-resource-insufficient',
          path: 'executionPlan.actions.0',
          actionId: 'kibo-skill',
          resourceOwnerKind: 'kibo',
          resourceOwnerId: 500001,
          resourceKind: 'kibo-energy',
          resourceIdentity: 'kibo:500001:sp',
          currentValue: 40,
          requiredValue: 60,
        },
        {
          code: 'machine-axis-action-resource-insufficient',
          path: 'executionPlan.actions.1',
          actionId: 'special-skill',
          resourceOwnerKind: 'actor',
          resourceOwnerId: 101007,
          resourceKind: 'special-resource',
          resourceIdentity: 'actor:101007:crystal',
          currentValue: 1,
          requiredValue: 2,
        },
        {
          code: 'machine-axis-owner-slot-missing',
          path: 'actions.2.owner.slotId',
          actionId: 'wrong-owner',
        },
        {
          code: 'machine-axis-enemy-required',
          path: 'scenario.enemy.enemyId',
        },
      ],
    });

    expect(proof).toMatchObject({
      passed: false,
      finalScoreEligible: false,
      rejectionCodes: [
        'machine-axis-action-resource-insufficient',
        'machine-axis-enemy-required',
        'machine-axis-owner-slot-missing',
        'machine-axis-same-frame-order-unresolved',
      ],
      rejectionCountsByCategory: {
        'owner-target-scenario': 2,
        readiness: 1,
        resource: 2,
      },
    });
    expect(proof.minimalCounterexamples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'special-skill',
          resourceIdentity: 'actor:101007:crystal',
          resourceKind: 'special-resource',
        }),
        expect.objectContaining({
          code: 'machine-axis-same-frame-order-unresolved',
          actionIds: ['actor-hit', 'kibo-hit'],
          absoluteFrame: 120,
        }),
      ])
    );
  });

  it('keeps the hash-bound zero-distance scenario policy diagnostic without rejecting action legality', () => {
    const run = createRun([
      {
        actionId: 'front-input',
        status: 'scheduled',
        execute: true,
        violationCodes: [],
        unresolvedCodes: [],
      },
    ]);
    run.validation = {
      issues: [],
      warnings: [
        {
          code: 'machine-axis-scenario-assumption',
          path: 'actions.0',
          actionId: 'front-input',
          reason: 'scenario-assumed-zero-distance',
        },
      ],
    };

    expect(
      createMachineAxisActionLegalityProof(run, {
        objectiveId: 'cycle-dps-no-toughness',
      })
    ).toMatchObject({
      passed: true,
      finalScoreEligible: true,
      rejectionCodes: [],
    });
  });

  it('preserves the joint trigger rejection code as a stable formal boundary', () => {
    const proof = createMachineAxisActionLegalityProof(
      createRun([
        {
          actionId: 'joint-pair',
          status: 'scheduled-with-unresolved-conditions',
          execute: true,
          violationCodes: [],
          unresolvedCodes: ['joint-attack-trigger-unresolved'],
        },
      ]),
      { objectiveId: 'cycle-dps-with-toughness' }
    );
    expect(proof.rejectionCodes).toEqual(['joint-attack-trigger-unresolved']);
    expect(proof.minimalCounterexamples).toEqual([
      expect.objectContaining({
        code: 'joint-attack-trigger-unresolved',
        actionId: 'joint-pair',
      }),
    ]);
  });

  it('preserves the normal-input authority counterexample in the formal proof', () => {
    const run = createRun([
      {
        actionId: 'illegal-fresh-a1',
        status: 'skipped-rule-blocked',
        execute: false,
        violationCodes: ['VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT'],
        unresolvedCodes: [],
      },
    ]);
    run.trace.diagnostics.actionRules.diagnostics = [
      {
        code: 'VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT',
        status: 'violated',
        actionId: 'illegal-fresh-a1',
        actorId: 'actor-112001',
        reason: 'verified-normal-attack-input-phase-conflict',
        reasons: ['normal-attack-successor-window-target-conflict'],
        sourceKind: 'verified-normal-attack-direct-successor',
        sourceIdentity: 'verified:112001:a1-a2-window',
        formIdentity: 'normal-attack-form:0123456789abcdef',
        expectedAttackInput: {
          sequenceIndex: 2,
          controlSkillId: 11200102,
          subSkillIndex: 0,
        },
        actualAttackInput: {
          sequenceIndex: 1,
          controlSkillId: 11200101,
          subSkillIndex: 0,
        },
      },
    ];

    const proof = createMachineAxisActionLegalityProof(run, {
      objectiveId: 'fastest-kill',
    });
    expect(proof).toMatchObject({
      passed: false,
      finalScoreEligible: false,
      rejectionCounts: {
        VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT: 1,
      },
    });
    expect(proof.minimalCounterexamples).toContainEqual(
      expect.objectContaining({
        actionId: 'illegal-fresh-a1',
        category: 'chain',
        formIdentity: 'normal-attack-form:0123456789abcdef',
        reasons: ['normal-attack-successor-window-target-conflict'],
        expectedAttackInput: expect.objectContaining({ sequenceIndex: 2 }),
        actualAttackInput: expect.objectContaining({ sequenceIndex: 1 }),
      })
    );
  });

  it.each([
    'cycle-dps-no-toughness',
    'cycle-dps-with-toughness',
    'fastest-kill',
  ])('uses the same foreground-input gate for %s', objectiveId => {
    const run = createRun([
      {
        actionId: 'off-field-input',
        status: 'skipped-rule-blocked',
        execute: false,
        violationCodes: ['controlled-actor-action-unavailable'],
        unresolvedCodes: [],
        sourceSequencePath: [2],
      },
    ]);
    const proof = createMachineAxisActionLegalityProof(run, { objectiveId });
    expect(proof).toMatchObject({
      objectiveId,
      passed: false,
      finalScoreEligible: false,
      rejectionCounts: { 'controlled-actor-action-unavailable': 1 },
    });
  });
});
