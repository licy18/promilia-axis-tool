import { describe, expect, it } from 'vitest';
import {
  MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE,
  MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
  MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
  createMachineAxisObjectiveContract,
  createMachineAxisObjectivePolicy,
  getMachineAxisObjectiveContract,
  isMachineAxisLegacyDiagnosticObjective,
  isMachineAxisPrimaryObjective,
  validateMachineAxisObjectiveContract,
  validateMachineAxisObjectivePolicy,
} from '../../machine-axis/machineAxisObjectiveContract.js';
import { hashCanonicalValue } from '../../simulation/headless/canonicalSerialization.js';

describe('Machine Axis objective contract', () => {
  it('defines exactly three primary objectives and defaults to no-toughness cycle DPS', () => {
    expect(MACHINE_AXIS_DEFAULT_PRIMARY_OBJECTIVE).toBe(
      'cycle-dps-no-toughness'
    );
    expect(MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS).toEqual([
      'cycle-dps-no-toughness',
      'cycle-dps-with-toughness',
      'fastest-kill',
    ]);
    expect(createMachineAxisObjectiveContract()).toMatchObject({
      objectiveId: 'cycle-dps-no-toughness',
      classification: 'primary',
      formalEligible: true,
      targetPolicy: {
        hpMode: 'infinite',
        toughnessMode: 'disabled',
        breakMode: 'disabled',
        deathTruncation: 'disabled',
      },
      scoring: {
        metric: 'closed-cycle-hp-dps',
        direction: 'maximize',
        damageBasis: 'settled-post-defense-hp-damage',
        formula: 'loopHpDamage / loopDurationSeconds',
        finalRankingEligibility: 'accepted-loop-proof-only',
      },
    });
  });

  it('binds toughness lifecycle and first-lethal semantics to objective-specific target policies', () => {
    expect(
      createMachineAxisObjectiveContract('cycle-dps-with-toughness')
    ).toMatchObject({
      targetPolicy: {
        hpMode: 'infinite',
        toughnessMode: 'enabled',
        breakMode: 'enabled',
        deathTruncation: 'disabled',
      },
      proofRequirements: {
        enemyBoundary: 'toughness-break-state-and-recovery-phase-closed',
        toughnessSettlement:
          'packet-ordered-toughness-break-double-damage-recovery',
        killRequired: false,
      },
    });
    expect(createMachineAxisObjectiveContract('fastest-kill')).toMatchObject({
      targetPolicy: {
        hpMode: 'finite',
        toughnessMode: 'enabled',
        breakMode: 'enabled',
        deathTruncation: 'enabled',
      },
      scoring: {
        metric: 'first-lethal-settlement-time',
        direction: 'minimize',
        formula: 'firstLethalFrameThenTimeMs',
        finalRankingEligibility: 'real-kill-candidate-only',
      },
      proofRequirements: {
        enemyBoundary: 'first-lethal-settlement-and-post-death-truncation',
        killRequired: true,
        enemyProfile: 'fully-resolved-hp-defense-level-and-toughness-profile',
      },
    });
  });

  it('retains the old objectives only as formal-ineligible diagnostics', () => {
    expect(MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS).toEqual([
      'damage',
      'burst',
      'toughness',
    ]);
    for (const objectiveId of MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS) {
      const contract = createMachineAxisObjectiveContract(objectiveId);
      expect(contract).toMatchObject({
        objectiveId,
        classification: 'legacy-diagnostic',
        formalEligible: false,
        targetPolicy: null,
        scoring: { finalRankingEligibility: 'diagnostic-only' },
      });
      expect(validateMachineAxisObjectiveContract(contract)).toMatchObject({
        valid: true,
        issues: [],
      });
      expect(
        validateMachineAxisObjectiveContract(contract, { formal: true }).issues
      ).toEqual([
        expect.objectContaining({
          code: 'machine-axis-objective-formal-ineligible',
        }),
      ]);
      expect(isMachineAxisLegacyDiagnosticObjective(objectiveId)).toBe(true);
      expect(isMachineAxisPrimaryObjective(objectiveId)).toBe(false);
    }
  });

  it('fails closed for unknown ids, renamed fields, stale hashes, and forged definitions', () => {
    expect(() => createMachineAxisObjectiveContract('unknown')).toThrow(
      'machine-axis-objective-unsupported:unknown'
    );
    expect(getMachineAxisObjectiveContract('unknown')).toBeNull();

    const renamed = createMachineAxisObjectiveContract('fastest-kill');
    renamed.objective = renamed.objectiveId;
    delete renamed.objectiveId;
    resignObjective(renamed);
    expect(issueCodes(validateMachineAxisObjectiveContract(renamed))).toEqual(
      expect.arrayContaining([
        'machine-axis-objective-field-missing',
        'machine-axis-objective-additional-property',
        'machine-axis-objective-unsupported',
      ])
    );

    const staleHash = createMachineAxisObjectiveContract(
      'cycle-dps-with-toughness'
    );
    staleHash.targetPolicy.toughnessMode = 'disabled';
    expect(issueCodes(validateMachineAxisObjectiveContract(staleHash))).toEqual(
      expect.arrayContaining([
        'machine-axis-objective-hash-mismatch',
        'machine-axis-objective-definition-mismatch',
      ])
    );

    const forged = createMachineAxisObjectiveContract('fastest-kill');
    forged.scoring.direction = 'maximize';
    resignObjective(forged);
    expect(issueCodes(validateMachineAxisObjectiveContract(forged))).toContain(
      'machine-axis-objective-definition-mismatch'
    );
  });

  it('publishes a deterministic objective-indexed policy and rejects drift even when rehashed', () => {
    const policy = createMachineAxisObjectivePolicy();
    expect(validateMachineAxisObjectivePolicy(policy)).toMatchObject({
      valid: true,
      issues: [],
    });
    expect(policy.defaultPrimaryObjectiveId).toBe('cycle-dps-no-toughness');
    expect(Object.keys(policy.objectivesById)).toEqual([
      ...MACHINE_AXIS_PRIMARY_OBJECTIVE_IDS,
      ...MACHINE_AXIS_LEGACY_DIAGNOSTIC_OBJECTIVE_IDS,
    ]);

    const forged = structuredClone(policy);
    forged.primaryObjectiveIds[0] = 'renamed-cycle-objective';
    resignPolicy(forged);
    expect(issueCodes(validateMachineAxisObjectivePolicy(forged))).toContain(
      'machine-axis-objective-policy-definition-mismatch'
    );
  });
});

function resignObjective(contract) {
  const hashInput = structuredClone(contract);
  delete hashInput.objectiveHash;
  contract.objectiveHash = hashCanonicalValue(hashInput);
}

function resignPolicy(policy) {
  const hashInput = structuredClone(policy);
  delete hashInput.objectivePolicyHash;
  policy.objectivePolicyHash = hashCanonicalValue(hashInput);
}

function issueCodes(validation) {
  return validation.issues.map(issue => issue.code);
}
