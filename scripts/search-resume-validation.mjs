// 搜索 resume / shard 信封校验（第六轮审查：可测纯函数）
// run-ai-local-search.mjs 使用；单元测试覆盖 missing/mismatch/plan-mismatch/envelope。

export const SHARD_RESULT_ALLOWED_STATUSES = Object.freeze([
  'complete',
  'failed',
  'timed-out',
  'not-started',
  'truncated',
]);

// P1-2/P1-3：resume 续接校验——缺失指纹、指纹不匹配、planHash 不匹配均拒绝。
export function validateResumeContinuation({
  priorFingerprint,
  priorPlan,
  newPlan,
  currentFingerprint,
  verifyFingerprint,
  requiredPlan = false,
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
  // 第七轮：resume 必须无条件要求旧 normalized plan 存在且可解析。
  if (requiredPlan && !priorPlan) {
    errors.push('missing-prior-plan');
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
export function validateShardResultEnvelope(result, options = {}) {
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
  if (!counts.every(value => Number.isInteger(value) && value >= 0)) {
    errors.push('invalid-count-fields');
  } else {
    if (
      summary.assignedCandidateCount !==
      summary.evaluatedCandidateCount +
        summary.rejectedCandidateCount +
        summary.unevaluatedCandidateCount
    ) {
      errors.push('count-mismatch');
    }
    const expected = options.expectedAssignedCandidateCount;
    if (expected != null && summary.assignedCandidateCount !== expected) {
      errors.push(
        'assigned-mismatch:' + summary.assignedCandidateCount + '!=' + expected
      );
    }
  }
  if (result?.status === 'complete') {
    const resultCount = Array.isArray(result.results)
      ? result.results.length
      : 0;
    const rejectionCount = Array.isArray(result.rejections)
      ? result.rejections.length
      : 0;
    if (resultCount !== summary.evaluatedCandidateCount) {
      errors.push('results-count-mismatch');
    }
    if (rejectionCount !== summary.rejectedCandidateCount) {
      errors.push('rejections-count-mismatch');
    }
  }
  return { valid: errors.length === 0, errors };
}
