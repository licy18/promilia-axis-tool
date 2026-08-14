import { describe, expect, it } from 'vitest';
import {
  validateResumeContinuation,
  validateShardResultEnvelope,
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
    });
    expect(result).toMatchObject({ valid: true, errors: [] });
  });
});
