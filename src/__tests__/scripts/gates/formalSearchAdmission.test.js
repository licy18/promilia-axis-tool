import { beforeAll, describe, expect, it } from 'vitest';
import {
  createKiboAutonomousReadinessEvidence,
  evaluateFormalSearchAdmission,
  loadFormalSearchAdmissionEvidence,
} from '../../../../scripts/gates/formal-search-admission.mjs';
import { getGateDefinition } from '../../../../scripts/gates/gate-definitions.mjs';

let currentEvidence;

beforeAll(async () => {
  currentEvidence = await loadFormalSearchAdmissionEvidence({
    repositoryRoot: process.cwd(),
    releaseProof: {
      status: 'pass',
      mode: 'executed',
      exitCode: 0,
      head: 'test-head',
    },
    deterministicProof: {
      status: 'pass',
      mode: 'executed',
      coverage: getGateDefinition('determinism').formalCoverage,
    },
  });
});

describe('formal search admission', () => {
  it('reads STARBORN as admitted but blocks the current open Kibo runtime surface', () => {
    const result = evaluateFormalSearchAdmission(currentEvidence);
    expect(result.status).toBe('blocked');
    expect(result.blockers).not.toContain('starborn-product-object-acceptance');
    expect(result.blockers).toContain('kibo-autonomous-runtime-ready');
    expect(currentEvidence.kiboAutonomousReadiness).toMatchObject({
      ready: false,
      status: 'kibo-autonomous-search-runtime-blocked',
      proof: { status: 'missing' },
      census: {
        admittedKiboCount: 43,
        autonomousSurfaceCount: 71,
        normalAttackSurfaceCount: 43,
        activeSurfaceCount: 28,
        kiboWithOpenAutonomousSurfaceCount: 43,
      },
    });
    expect(result.clientParity).toMatchObject({
      ready: false,
      blockingForCurrentFormalScore: false,
    });
  });

  it('becomes READY only after executed release and every product contract pass', () => {
    const evidence = structuredClone(currentEvidence);
    evidence.productAcceptance.starborn = {
      ...evidence.productAcceptance.starborn,
      productVisualAcceptance: 'accepted',
      formalAdmission: true,
      optimizationReady: true,
    };
    closeKiboAutonomousReadiness(evidence);
    const ready = evaluateFormalSearchAdmission(evidence);
    expect(ready.blockers).toEqual([]);
    expect(ready.status).toBe('ready');

    evidence.releaseProof = {
      ...evidence.releaseProof,
      status: 'fail',
      exitCode: 1,
    };
    const blocked = evaluateFormalSearchAdmission(evidence);
    expect(blocked.status).toBe('blocked');
    expect(blocked.blockers).toContain('release-verify-executed-pass');
  });

  it('does not confuse clientParityReady=false with qualification readiness', () => {
    const evidence = structuredClone(currentEvidence);
    evidence.productAcceptance.starborn = {
      ...evidence.productAcceptance.starborn,
      productVisualAcceptance: 'accepted',
      formalAdmission: true,
      optimizationReady: true,
    };
    closeKiboAutonomousReadiness(evidence);
    evidence.formalRuntimeBaseline.clientParityReady = false;
    const result = evaluateFormalSearchAdmission(evidence);
    expect(result.ready).toBe(true);
    expect(result.clientParity.status).toBe('pending');
  });

  it('accepts only a zero-unresolved proof bound to every current Kibo surface', () => {
    const fixture = createKiboReadinessFixture();
    const baseline = createKiboAutonomousReadinessEvidence({
      ...fixture,
      readinessProof: { exists: false, value: null, error: null },
    });
    const ready = createKiboAutonomousReadinessEvidence({
      ...fixture,
      readinessProof: {
        exists: true,
        error: null,
        value: {
          schemaVersion: 1,
          contractName: 'AzPrM12CKiboAutonomousReadiness',
          status: 'ready',
          ready: true,
          authority: baseline.authority,
          coverage: {
            admittedKiboIds: [500001],
            autonomousSurfaceKeys: ['500001:normal-attack:504003'],
          },
          summary: {
            admittedKiboCount: 1,
            autonomousSurfaceCount: 1,
            unresolvedScheduleCount: 0,
            unresolvedTriggerCount: 0,
          },
        },
      },
    });
    expect(ready).toMatchObject({
      ready: true,
      status: 'kibo-autonomous-search-runtime-ready',
      proof: { valid: true, status: 'valid' },
    });

    const unresolved = createKiboAutonomousReadinessEvidence({
      ...fixture,
      readinessProof: {
        exists: true,
        error: null,
        value: {
          ...ready.proof,
          schemaVersion: 1,
          contractName: 'AzPrM12CKiboAutonomousReadiness',
          status: 'ready',
          ready: true,
          authority: baseline.authority,
          coverage: {
            admittedKiboIds: [500001],
            autonomousSurfaceKeys: ['500001:normal-attack:504003'],
          },
          summary: {
            admittedKiboCount: 1,
            autonomousSurfaceCount: 1,
            unresolvedScheduleCount: 1,
            unresolvedTriggerCount: 0,
          },
        },
      },
    });
    expect(unresolved.ready).toBe(false);
    expect(unresolved.issues).toContain(
      'kibo-autonomous-readiness-unresolved-surfaces'
    );
  });

  it('fails closed when the Kibo readiness proof is corrupt', () => {
    const result = createKiboAutonomousReadinessEvidence({
      ...createKiboReadinessFixture(),
      readinessProof: {
        exists: true,
        value: null,
        error: 'Unexpected token',
      },
    });
    expect(result).toMatchObject({
      ready: false,
      proof: { valid: false, status: 'corrupt' },
    });
    expect(result.issues).toContain('kibo-autonomous-readiness-proof-corrupt');
  });
});

function closeKiboAutonomousReadiness(evidence) {
  evidence.kiboAutonomousReadiness = {
    ...evidence.kiboAutonomousReadiness,
    ready: true,
    status: 'kibo-autonomous-search-runtime-ready',
    issues: [],
    proof: {
      valid: true,
      status: 'valid',
      issues: [],
      summary: {
        admittedKiboCount: 43,
        autonomousSurfaceCount: 71,
        unresolvedScheduleCount: 0,
        unresolvedTriggerCount: 0,
      },
    },
  };
}

function createKiboReadinessFixture() {
  return {
    qualificationCatalog: {
      catalogHash: 'qualification-hash',
      admission: { kibos: [500001] },
    },
    kiboActionCatalog: {
      items: [
        {
          kiboId: 500001,
          actions: [
            {
              skillId: 504003,
              kind: 'normal-attack',
              petSkillLogicTag: '0',
            },
          ],
        },
      ],
    },
    schedulerSource: Buffer.from('scheduler-v1'),
  };
}
