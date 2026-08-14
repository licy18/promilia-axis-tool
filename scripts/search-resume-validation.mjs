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
    // 第十轮：逐项要求非空、字符串 candidateId——缺失/类型错误直接拒绝（不能静默丢弃）。
    const resultIds = [];
    for (const entry of result?.results ?? []) {
      if (
        typeof entry?.candidateId !== 'string' ||
        entry.candidateId.length === 0
      ) {
        errors.push('missing-result-candidate-id');
      } else {
        resultIds.push(entry.candidateId);
      }
    }
    const rejectionIds = [];
    for (const entry of result?.rejections ?? []) {
      if (
        typeof entry?.candidateId !== 'string' ||
        entry.candidateId.length === 0
      ) {
        errors.push('missing-rejection-candidate-id');
      } else {
        rejectionIds.push(entry.candidateId);
      }
    }
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
  // 第十轮：stopReason 限制为 worker 实际发布的 bounded-stopping code 集合。
  // 第十一轮：仅 worker 实际发布的 shard 级 bounded-stopping 原因（父进程/全局原因不属于 shard 信封）。
  const BOUNDED_STOP_REASONS = [
    'shard-wall-time-budget-exhausted',
    'shard-evaluation-budget-exhausted',
    'shard-simulation-budget-exhausted',
  ];
  if (result?.status === 'truncated' && !result?.stopReason) {
    errors.push('truncated-missing-stop-reason');
  }
  if (
    result?.status === 'truncated' &&
    !BOUNDED_STOP_REASONS.includes(result?.stopReason)
  ) {
    errors.push('truncated-invalid-stop-reason:' + String(result?.stopReason));
  }
  if (result?.status === 'complete' && result?.stopReason != null) {
    errors.push('complete-unexpected-stop-reason');
  }
  return { valid: errors.length === 0, errors };
}

// 第十一轮：预算账本校验（纯函数）——checkpointHash 防篡改；累计严格非负整数；
// 未干净完成时把 lastCheckpointAt → now 的墙钟计入（shard 中途终止无法绕过总预算）。
// 第十二轮：lastCheckpointAtMs 必须是非负整数且不晚于 nowMs——未来时间戳不得免除尾段墙钟。

// 第十四轮：复算当前指纹并比对 preflight 快照（纯函数，fail-closed）——捕获 preflight 后 HEAD/数据库/包漂移。
// expectedFingerprint 为 preflight 时已验证的指纹对象；current 为当前现场重算结果。
export function validateFingerprintUnchanged(expectedFingerprint, current) {
  const errors = [];
  if (!expectedFingerprint || typeof expectedFingerprint !== 'object') {
    errors.push('missing-expected-fingerprint');
    return { valid: false, errors };
  }
  if (!current || typeof current !== 'object') {
    errors.push('missing-current-fingerprint');
    return { valid: false, errors };
  }
  const fields = [
    'authorityHead',
    'databaseContentHash',
    'mechanismHash',
    'dataVersionHash',
    'packageHash',
  ];
  for (const field of fields) {
    if (expectedFingerprint[field] !== current[field]) {
      errors.push('fingerprint-drift:' + field);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function validateWallTimeLedger(
  checkpoint,
  { totalBudgetMs, nowMs, hashFn }
) {
  const errors = [];
  if (
    !checkpoint ||
    typeof checkpoint !== 'object' ||
    Array.isArray(checkpoint)
  ) {
    errors.push('missing-or-corrupt-checkpoint');
    return { valid: false, errors, effective: null };
  }
  const body = { ...checkpoint };
  delete body.checkpointHash;
  if (
    typeof checkpoint?.checkpointHash !== 'string' ||
    checkpoint.checkpointHash !== hashFn(body)
  ) {
    errors.push('checkpoint-hash-mismatch');
  }
  const rawValue = checkpoint?.cumulativeWallTimeMs;
  if (
    typeof rawValue !== 'number' ||
    !Number.isFinite(rawValue) ||
    rawValue < 0 ||
    !Number.isInteger(rawValue)
  ) {
    errors.push('invalid-cumulative-wall-time');
  }
  const lastCheckpointAt = checkpoint?.lastCheckpointAtMs;
  if (
    typeof lastCheckpointAt !== 'number' ||
    !Number.isFinite(lastCheckpointAt) ||
    lastCheckpointAt < 0 ||
    !Number.isInteger(lastCheckpointAt)
  ) {
    errors.push('invalid-last-checkpoint-at');
  }
  if (errors.length > 0) {
    return { valid: false, errors, effective: null };
  }
  // 第十二轮：未来时间戳 fail-closed——不允许 Math.max(0, now-last) 把负尾段豁免成零。
  if (lastCheckpointAt > nowMs) {
    errors.push('last-checkpoint-at-in-future');
    return { valid: false, errors, effective: null };
  }
  const tailMs = checkpoint?.complete === true ? 0 : nowMs - lastCheckpointAt;
  const effective = rawValue + tailMs;
  if (effective > totalBudgetMs) {
    errors.push('cumulative-exceeds-budget:' + effective + '>' + totalBudgetMs);
    return { valid: false, errors, effective };
  }
  return { valid: true, errors: [], effective };
}
