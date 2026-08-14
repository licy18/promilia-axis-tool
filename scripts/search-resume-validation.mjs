// 搜索 resume / shard 信封校验（第六轮审查：可测纯函数）
// run-ai-local-search.mjs 使用；单元测试覆盖 missing/mismatch/plan-mismatch/envelope。

export const SHARD_RESULT_ALLOWED_STATUSES = Object.freeze([
  'complete',
  'failed',
  'timed-out',
  'not-started',
]);

// P1-2/P1-3：resume 续接校验——缺失指纹、指纹不匹配、planHash 不匹配均拒绝。
export function validateResumeContinuation({
  priorFingerprint,
  priorPlan,
  newPlan,
  currentFingerprint,
  verifyFingerprint,
}) {
  const errors = [];
  if (!priorFingerprint) {
    errors.push('missing-prior-fingerprint');
  } else {
    const check = verifyFingerprint(priorFingerprint, currentFingerprint);
    if (!check.valid) {
      errors.push('fingerprint-mismatch:' + check.mismatches.join(','));
    }
  }
  if (
    priorPlan &&
    newPlan &&
    String(priorPlan.planHash) !== String(newPlan.planHash)
  ) {
    errors.push('plan-mismatch');
  }
  return { valid: errors.length === 0, errors };
}

// P2-1：fresh shard envelope——status 属于允许集合 + assigned/evaluated/rejected/unevaluated 数量闭合。
export function validateShardResultEnvelope(result) {
  const errors = [];
  if (!SHARD_RESULT_ALLOWED_STATUSES.includes(result?.status)) {
    errors.push('invalid-status:' + String(result?.status));
  }
  const summary = result?.summary ?? {};
  const counts = [
    summary.assignedCandidateCount,
    summary.evaluatedCandidateCount,
    summary.rejectedCandidateCount,
    summary.unevaluatedCandidateCount,
  ];
  if (!counts.every(value => typeof value === 'number')) {
    errors.push('missing-count-fields');
  } else if (
    summary.assignedCandidateCount !==
    summary.evaluatedCandidateCount +
      summary.rejectedCandidateCount +
      summary.unevaluatedCandidateCount
  ) {
    errors.push('count-mismatch');
  }
  return { valid: errors.length === 0, errors };
}
