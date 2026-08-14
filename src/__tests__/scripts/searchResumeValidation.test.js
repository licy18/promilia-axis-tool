import { describe, expect, it } from 'vitest';
import {
  validateResumeContinuation,
  validateShardResultEnvelope,
  validateWallTimeLedger,
} from '../../../scripts/search-resume-validation.mjs';
import {
  createSearchFingerprint,
  verifyArtifactFingerprint,
} from '../../../scripts/search-fingerprint.mjs';

function okFingerprint() {
  return createSearchFingerprint();
}

describe('search resume validation (sixth-round review)', () => {
  it('rejects resume when prior fingerprint is missing', () => {
    const result = validateResumeContinuation({
      priorFingerprint: null,
      priorPlan: { planHash: 'a' },
      newPlan: { planHash: 'a' },
      currentFingerprint: okFingerprint(),
      verifyFingerprint: verifyArtifactFingerprint,
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('missing-prior-fingerprint');
  });

  it('rejects resume on fingerprint mismatch', () => {
    const result = validateResumeContinuation({
      priorFingerprint: { ...okFingerprint(), authorityHead: '0'.repeat(40) },
      priorPlan: { planHash: 'a' },
      newPlan: { planHash: 'a' },
      currentFingerprint: okFingerprint(),
      verifyFingerprint: verifyArtifactFingerprint,
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors[0]).toContain('fingerprint-mismatch');
  });

  it('rejects resume on planHash mismatch', () => {
    const result = validateResumeContinuation({
      priorFingerprint: okFingerprint(),
      priorPlan: { planHash: 'prior-plan' },
      newPlan: { planHash: 'new-plan' },
      currentFingerprint: okFingerprint(),
      verifyFingerprint: verifyArtifactFingerprint,
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('plan-mismatch');
  });

  it('accepts resume when fingerprint and plan match', () => {
    const fp = okFingerprint();
    const result = validateResumeContinuation({
      priorFingerprint: fp,
      priorPlan: { planHash: 'same' },
      newPlan: { planHash: 'same' },
      currentFingerprint: fp,
      verifyFingerprint: verifyArtifactFingerprint,
    });
    expect(result).toMatchObject({ valid: true, errors: [] });
  });

  it('rejects shard envelope with invalid status', () => {
    const result = validateShardResultEnvelope({
      status: 'bogus',
      summary: {
        assignedCandidateCount: 1,
        evaluatedCandidateCount: 1,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 0,
      },
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors[0]).toContain('invalid-status');
  });

  it('rejects shard envelope with non-closed counts', () => {
    const result = validateShardResultEnvelope({
      status: 'complete',
      summary: {
        assignedCandidateCount: 10,
        evaluatedCandidateCount: 5,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 2,
      },
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('count-mismatch');
  });

  it('accepts a valid shard envelope', () => {
    const result = validateShardResultEnvelope({
      status: 'complete',
      summary: {
        assignedCandidateCount: 10,
        evaluatedCandidateCount: 8,
        rejectedCandidateCount: 1,
        unevaluatedCandidateCount: 1,
      },
      results: new Array(8).fill({}),
      rejections: new Array(1).fill({}),
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('complete-unevaluated-nonzero');

    const closed = validateShardResultEnvelope({
      status: 'complete',
      summary: {
        assignedCandidateCount: 9,
        evaluatedCandidateCount: 8,
        rejectedCandidateCount: 1,
        unevaluatedCandidateCount: 0,
      },
      results: new Array(8).fill({}),
      rejections: new Array(1).fill({}),
    });
    expect(closed).toMatchObject({ valid: true, errors: [] });
  });

  it('accepts a legal truncated shard envelope (seventh-round review)', () => {
    const result = validateShardResultEnvelope({
      status: 'truncated',
      summary: {
        assignedCandidateCount: 8,
        evaluatedCandidateCount: 5,
        rejectedCandidateCount: 1,
        unevaluatedCandidateCount: 2,
      },
      results: new Array(5).fill({}),
      rejections: new Array(1).fill({}),
      stopReason: 'shard-wall-time-budget-exhausted',
    });
    expect(result).toMatchObject({ valid: true, errors: [] });
  });

  it('rejects resume when prior plan is missing (requiredPlan)', () => {
    const result = validateResumeContinuation({
      priorFingerprint: okFingerprint(),
      priorPlan: null,
      newPlan: { planHash: 'x' },
      currentFingerprint: okFingerprint(),
      verifyFingerprint: verifyArtifactFingerprint,
      requiredPlan: true,
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('missing-prior-plan');
  });

  it('rejects shard envelope when assigned does not match expected shard size', () => {
    const result = validateShardResultEnvelope(
      {
        status: 'complete',
        summary: {
          assignedCandidateCount: 0,
          evaluatedCandidateCount: 0,
          rejectedCandidateCount: 0,
          unevaluatedCandidateCount: 0,
        },
        results: [],
        rejections: [],
      },
      { expectedAssignedCandidateCount: 8 }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('assigned-mismatch:0!=8');
  });

  it('rejects shard envelope with zero results on complete status', () => {
    const result = validateShardResultEnvelope({
      status: 'complete',
      summary: {
        assignedCandidateCount: 8,
        evaluatedCandidateCount: 8,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 0,
      },
      results: [],
      rejections: [],
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('results-count-mismatch');
  });

  it('rejects truncated shard claiming evaluated rows without results (eighth-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'truncated',
      summary: {
        assignedCandidateCount: 8,
        evaluatedCandidateCount: 8,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 0,
      },
      results: [],
      rejections: [],
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('results-count-mismatch');
  });

  it('rejects complete shard with unevaluated candidates remaining (eighth-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'complete',
      summary: {
        assignedCandidateCount: 8,
        evaluatedCandidateCount: 0,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 8,
      },
      results: [],
      rejections: [],
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('complete-unevaluated-nonzero');
  });

  it('rejects truncated shard with unevaluated candidates (eighth-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'truncated',
      summary: {
        assignedCandidateCount: 8,
        evaluatedCandidateCount: 3,
        rejectedCandidateCount: 1,
        unevaluatedCandidateCount: 4,
      },
      results: new Array(3).fill({}),
      rejections: new Array(1).fill({}),
      stopReason: 'shard-wall-time-budget-exhausted',
    });
    expect(result).toMatchObject({ valid: true, errors: [] });
  });

  it('rejects truncated shard without a stop reason (ninth-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'truncated',
      summary: {
        assignedCandidateCount: 8,
        evaluatedCandidateCount: 3,
        rejectedCandidateCount: 1,
        unevaluatedCandidateCount: 4,
      },
      results: new Array(3).fill({}),
      rejections: new Array(1).fill({}),
      stopReason: null,
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('truncated-missing-stop-reason');
  });

  it('rejects complete shard with an unexpected stop reason (ninth-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'complete',
      summary: {
        assignedCandidateCount: 2,
        evaluatedCandidateCount: 2,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 0,
      },
      results: [{ candidateId: 'a' }, { candidateId: 'b' }],
      rejections: [],
      stopReason: 'should-not-be-set',
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('complete-unexpected-stop-reason');
  });

  it('rejects unknown candidate ids in a complete shard (ninth-round)', () => {
    const result = validateShardResultEnvelope(
      {
        status: 'complete',
        summary: {
          assignedCandidateCount: 2,
          evaluatedCandidateCount: 1,
          rejectedCandidateCount: 1,
          unevaluatedCandidateCount: 0,
        },
        results: [{ candidateId: 'a' }, { candidateId: 'foreign-x' }],
        rejections: [{ candidateId: 'b' }],
      },
      { expectedCandidateIds: ['a', 'b'] }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('unknown-candidate-id:foreign-x');
  });

  it('rejects duplicate candidate ids in a complete shard (ninth-round)', () => {
    const result = validateShardResultEnvelope(
      {
        status: 'complete',
        summary: {
          assignedCandidateCount: 2,
          evaluatedCandidateCount: 2,
          rejectedCandidateCount: 0,
          unevaluatedCandidateCount: 0,
        },
        results: [{ candidateId: 'a' }, { candidateId: 'a' }],
        rejections: [],
      },
      { expectedCandidateIds: ['a', 'b'] }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('duplicate-candidate-id:a');
  });

  it('rejects incomplete candidate coverage in a complete shard (ninth-round)', () => {
    const result = validateShardResultEnvelope(
      {
        status: 'complete',
        summary: {
          assignedCandidateCount: 2,
          evaluatedCandidateCount: 1,
          rejectedCandidateCount: 0,
          unevaluatedCandidateCount: 1,
        },
        results: [{ candidateId: 'a' }],
        rejections: [],
      },
      { expectedCandidateIds: ['a', 'b'] }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('incomplete-coverage:b');
  });

  it('rejects truncated result row without candidateId (tenth-round)', () => {
    const result = validateShardResultEnvelope(
      {
        status: 'truncated',
        summary: {
          assignedCandidateCount: 1,
          evaluatedCandidateCount: 1,
          rejectedCandidateCount: 0,
          unevaluatedCandidateCount: 0,
        },
        results: [{}],
        rejections: [],
        stopReason: 'shard-wall-time-budget-exhausted',
      },
      { expectedCandidateIds: ['a'] }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('missing-result-candidate-id');
  });

  it('rejects truncated stopReason outside published codes (tenth-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'truncated',
      summary: {
        assignedCandidateCount: 1,
        evaluatedCandidateCount: 1,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 0,
      },
      results: [{ candidateId: 'a' }],
      rejections: [],
      stopReason: 'banana',
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors[0]).toContain('truncated-invalid-stop-reason');
  });

  it('accepts truncated with published stopReason and full identities (tenth-round)', () => {
    const result = validateShardResultEnvelope(
      {
        status: 'truncated',
        summary: {
          assignedCandidateCount: 1,
          evaluatedCandidateCount: 1,
          rejectedCandidateCount: 0,
          unevaluatedCandidateCount: 0,
        },
        results: [{ candidateId: 'a' }],
        rejections: [],
        stopReason: 'shard-simulation-budget-exhausted',
      },
      { expectedCandidateIds: ['a'] }
    );
    expect(result).toMatchObject({ valid: true, errors: [] });
  });

  it('rejects null cumulative wall time in ledger (eleventh-round)', () => {
    const result = validateWallTimeLedger(
      {
        cumulativeWallTimeMs: null,
        lastCheckpointAtMs: 1000,
        complete: false,
        checkpointHash: 'x',
      },
      { totalBudgetMs: 10000, nowMs: 2000, hashFn: () => 'x' }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('invalid-cumulative-wall-time');
  });

  it('rejects empty-string cumulative wall time in ledger (eleventh-round)', () => {
    const result = validateWallTimeLedger(
      {
        cumulativeWallTimeMs: '',
        lastCheckpointAtMs: 1000,
        complete: false,
        checkpointHash: 'x',
      },
      { totalBudgetMs: 10000, nowMs: 2000, hashFn: () => 'x' }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('invalid-cumulative-wall-time');
  });

  it('rejects false cumulative wall time in ledger (eleventh-round)', () => {
    const result = validateWallTimeLedger(
      {
        cumulativeWallTimeMs: false,
        lastCheckpointAtMs: 1000,
        complete: false,
        checkpointHash: 'x',
      },
      { totalBudgetMs: 10000, nowMs: 2000, hashFn: () => 'x' }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('invalid-cumulative-wall-time');
  });

  it('rejects tampered ledger via checkpoint hash (eleventh-round)', () => {
    const result = validateWallTimeLedger(
      {
        cumulativeWallTimeMs: 500,
        lastCheckpointAtMs: 1000,
        complete: false,
        checkpointHash: 'tampered',
      },
      { totalBudgetMs: 10000, nowMs: 2000, hashFn: () => 'expected-hash' }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors).toContain('checkpoint-hash-mismatch');
  });

  it('counts tail wall time since last checkpoint on incomplete run (eleventh-round)', () => {
    const result = validateWallTimeLedger(
      {
        cumulativeWallTimeMs: 1000,
        lastCheckpointAtMs: 1000,
        complete: false,
        checkpointHash: 'x',
      },
      { totalBudgetMs: 10000, nowMs: 4000, hashFn: () => 'x' }
    );
    expect(result).toMatchObject({ valid: true, effective: 4000 });
  });

  it('rejects ledger exceeding total budget (eleventh-round)', () => {
    const result = validateWallTimeLedger(
      {
        cumulativeWallTimeMs: 9000,
        lastCheckpointAtMs: 1000,
        complete: false,
        checkpointHash: 'x',
      },
      { totalBudgetMs: 10000, nowMs: 4000, hashFn: () => 'x' }
    );
    expect(result).toMatchObject({ valid: false });
    expect(result.errors[0]).toContain('cumulative-exceeds-budget');
  });

  it('rejects parent-shard stop reason as truncated (eleventh-round)', () => {
    const result = validateShardResultEnvelope({
      status: 'truncated',
      summary: {
        assignedCandidateCount: 1,
        evaluatedCandidateCount: 1,
        rejectedCandidateCount: 0,
        unevaluatedCandidateCount: 0,
      },
      results: [{ candidateId: 'a' }],
      rejections: [],
      stopReason: 'parent-shard-wall-time-budget-exhausted',
    });
    expect(result).toMatchObject({ valid: false });
    expect(result.errors[0]).toContain('truncated-invalid-stop-reason');
  });
});
