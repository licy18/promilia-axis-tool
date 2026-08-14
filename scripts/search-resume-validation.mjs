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
  // 第八轮：complete 与 truncated 都必须绑定 results/rejections 数量（不能声称已评估却不提供评分行）。
  if (result?.status === 'complete' || result?.status === 'truncated') {
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
  // 第八轮：complete 不得残留 unevaluated（否则可能错误形成 bounded-complete）。
  if (
    result?.status === 'complete' &&
    summary.unevaluatedCandidateCount !== 0
  ) {
    errors.push('complete-unevaluated-nonzero');
  }
  // 第九轮：shard 绑定候选 identity——拒绝未知/重复/交叉 ID；complete 精确覆盖全集。
  const { expectedCandidateIds } = options;
  if (Array.isArray(expectedCandidateIds) && expectedCandidateIds.length > 0) {
    const expected = new Set(expectedCandidateIds);
    const resultIds = (result?.results ?? [])
      .map(entry => entry?.candidateId)
      .filter(id => id != null);
    const rejectionIds = (result?.rejections ?? [])
      .map(entry => entry?.candidateId)
      .filter(id => id != null);
    const allIds = [...resultIds, ...rejectionIds];
    const unknown = [...new Set(allIds.filter(id => !expected.has(id)))];
    if (unknown.length > 0)
      errors.push('unknown-candidate-id:' + unknown.join(','));
    const dups = [...new Set(allIds.filter((v, i) => allIds.indexOf(v) !== i))];
    if (dups.length > 0)
      errors.push('duplicate-candidate-id:' + dups.join(','));
    if (result?.status === 'complete') {
      const covered = new Set(allIds);
      const missing = expectedCandidateIds.filter(id => !covered.has(id));
      if (missing.length > 0)
        errors.push('incomplete-coverage:' + missing.join(','));
    }
  }
  // 第九轮：bounded stopping 可审计——truncated 必须携带非空停止原因，complete 必须无停止原因。
  if (result?.status === 'truncated' && !result?.stopReason) {
    errors.push('truncated-missing-stop-reason');
  }
  if (result?.status === 'complete' && result?.stopReason != null) {
    errors.push('complete-unexpected-stop-reason');
  }
  return { valid: errors.length === 0, errors };
  return { valid: errors.length === 0, errors };
}
