import { sha256Utf8 } from '../domain/headlessAssumptionContract.js';
import { stableStringify } from '../simulation/headless/canonicalSerialization.js';

export const MACHINE_AXIS_SEARCH_GUIDANCE_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_GUIDANCE_CONTRACT =
  'AzPrMachineAxisSearchGuidance';
export const MACHINE_AXIS_SEARCH_GUIDANCE_KIND =
  'azpr-machine-axis-search-guidance';
export const MACHINE_AXIS_SEARCH_GUIDANCE_PROTOCOL_IDENTITY =
  'azpr-ai-guided-search:v1';
export const MACHINE_AXIS_SEARCH_FEEDBACK_CONTRACT =
  'AzPrMachineAxisSearchFeedback';
export const MACHINE_AXIS_SEARCH_FEEDBACK_KIND =
  'azpr-machine-axis-search-feedback';

const BUDGET_FIELDS = Object.freeze([
  'beamWidth',
  'topN',
  'maxDepth',
  'maxActionsPerOwner',
  'maxKiboActions',
  'maxWaitCandidates',
  'maxDamagePerMsBound',
]);

const BOOLEAN_FIELDS = Object.freeze([
  'includeKibo',
  'includeSwitch',
  'includeNormalAttacks',
  'includeWait',
]);

export function normalizeSearchGuidance(input = {}) {
  const issues = [];
  if (
    input.schemaVersion != null &&
    Number(input.schemaVersion) !== MACHINE_AXIS_SEARCH_GUIDANCE_SCHEMA_VERSION
  ) {
    issues.push('machine-axis-search-guidance-schema-version-invalid');
  }
  if (
    input.contractName != null &&
    input.contractName !== MACHINE_AXIS_SEARCH_GUIDANCE_CONTRACT
  ) {
    issues.push('machine-axis-search-guidance-contract-name-invalid');
  }
  if (input.kind != null && input.kind !== MACHINE_AXIS_SEARCH_GUIDANCE_KIND) {
    issues.push('machine-axis-search-guidance-kind-invalid');
  }
  if (
    input.layer != null &&
    !['inner', 'outer', 'both'].includes(input.layer)
  ) {
    issues.push('machine-axis-search-guidance-layer-invalid');
  }
  const budget = input.budget ?? {};
  for (const field of BUDGET_FIELDS) {
    if (budget[field] != null) {
      const value = Number(budget[field]);
      if (!Number.isFinite(value) || value <= 0) {
        issues.push(`machine-axis-search-guidance-budget-${field}-invalid`);
      }
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    if (budget[field] != null && typeof budget[field] !== 'boolean') {
      issues.push(`machine-axis-search-guidance-budget-${field}-invalid`);
    }
  }
  const actionFilters = input.actionFilters ?? {};
  for (const key of [
    'allowedActionKinds',
    'blockedActionKinds',
    'allowedPublicActionIds',
    'blockedPublicActionIds',
  ]) {
    if (actionFilters[key] != null && !Array.isArray(actionFilters[key])) {
      issues.push(`machine-axis-search-guidance-action-filters-${key}-invalid`);
    }
  }
  if (
    actionFilters.perOwner != null &&
    (typeof actionFilters.perOwner !== 'object' ||
      Array.isArray(actionFilters.perOwner))
  ) {
    issues.push(
      'machine-axis-search-guidance-action-filters-per-owner-invalid'
    );
  }
  const provenance = input.provenance ?? {};
  if (provenance.authority != null && provenance.authority !== 'ai-agent') {
    issues.push('machine-axis-search-guidance-provenance-authority-invalid');
  }
  const guidance = {
    schemaVersion: MACHINE_AXIS_SEARCH_GUIDANCE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_GUIDANCE_CONTRACT,
    kind: MACHINE_AXIS_SEARCH_GUIDANCE_KIND,
    protocolIdentity: MACHINE_AXIS_SEARCH_GUIDANCE_PROTOCOL_IDENTITY,
    guidanceVersion: String(input.guidanceVersion ?? '1.0.0'),
    objective: input.objective ?? null,
    layer: input.layer ?? 'both',
    budget: Object.fromEntries(
      [...BUDGET_FIELDS, ...BOOLEAN_FIELDS]
        .filter(field => budget[field] != null)
        .map(field => [field, budget[field]])
    ),
    actionFilters: {
      allowedActionKinds: actionFilters.allowedActionKinds ?? [],
      blockedActionKinds: actionFilters.blockedActionKinds ?? [],
      allowedPublicActionIds: actionFilters.allowedPublicActionIds ?? [],
      blockedPublicActionIds: actionFilters.blockedPublicActionIds ?? [],
      perOwner: actionFilters.perOwner ?? {},
    },
    kiboPolicy: {
      allowedKiboIds: input.kiboPolicy?.allowedKiboIds ?? [],
      blockedKiboIds: input.kiboPolicy?.blockedKiboIds ?? [],
    },
    switchPolicy: {
      includeSwitch: input.switchPolicy?.includeSwitch ?? null,
    },
    waitPolicy: {
      includeWait: input.waitPolicy?.includeWait ?? null,
      maxWaitFrames: input.waitPolicy?.maxWaitFrames ?? null,
    },
    pruning: {
      earlyTerminationScore: input.pruning?.earlyTerminationScore ?? null,
      aggressive: input.pruning?.aggressive ?? null,
    },
    heuristic: {
      criticalPolicy: input.heuristic?.criticalPolicy ?? null,
      seeds: input.heuristic?.seeds ?? null,
    },
    outer: input.outer ?? null,
    provenance: {
      authority: 'ai-agent',
      agentId: provenance.agentId ?? null,
      sessionId: provenance.sessionId ?? null,
      iteration: provenance.iteration ?? null,
      rationale: provenance.rationale ?? null,
    },
  };
  return {
    valid: issues.length === 0,
    issues,
    guidance,
    guidanceHash: sha256Utf8(stableStringify(guidance)),
  };
}

export function hashSearchGuidance(input = {}) {
  const normalized = normalizeSearchGuidance(input);
  return normalized.guidanceHash;
}

export function applySearchGuidance(options = {}, inputGuidance = {}) {
  const normalized = normalizeSearchGuidance(inputGuidance);
  if (!normalized.valid) {
    throw new Error(
      'Invalid machine axis search guidance: ' + normalized.issues.join(', ')
    );
  }
  const guidance = normalized.guidance;
  const merged = { ...options };
  const appliedRules = [];
  if (guidance.objective) {
    merged.objective = guidance.objective;
    appliedRules.push(`objective=${guidance.objective}`);
  }
  for (const field of BUDGET_FIELDS) {
    if (guidance.budget[field] != null) {
      merged[field] = guidance.budget[field];
      appliedRules.push(`budget.${field}=${guidance.budget[field]}`);
    }
  }
  for (const field of BOOLEAN_FIELDS) {
    if (guidance.budget[field] != null) {
      merged[field] = guidance.budget[field];
      appliedRules.push(`budget.${field}=${guidance.budget[field]}`);
    }
  }
  if (guidance.switchPolicy.includeSwitch != null) {
    merged.includeSwitch = guidance.switchPolicy.includeSwitch;
    appliedRules.push(
      `switchPolicy.includeSwitch=${guidance.switchPolicy.includeSwitch}`
    );
  }
  if (guidance.waitPolicy.includeWait != null) {
    merged.includeWait = guidance.waitPolicy.includeWait;
    appliedRules.push(
      `waitPolicy.includeWait=${guidance.waitPolicy.includeWait}`
    );
  }
  if (guidance.waitPolicy.maxWaitFrames != null) {
    merged.maxWaitFrames = guidance.waitPolicy.maxWaitFrames;
    appliedRules.push(
      `waitPolicy.maxWaitFrames=${guidance.waitPolicy.maxWaitFrames} (reserved)`
    );
  }
  if (guidance.heuristic.criticalPolicy != null) {
    merged.criticalPolicy = guidance.heuristic.criticalPolicy;
    appliedRules.push(
      `heuristic.criticalPolicy=${JSON.stringify(guidance.heuristic.criticalPolicy)}`
    );
  }
  if (guidance.heuristic.seeds != null) {
    merged.seeds = guidance.heuristic.seeds;
    appliedRules.push(`heuristic.seeds=${guidance.heuristic.seeds.length}`);
  }
  if (guidance.pruning.earlyTerminationScore != null) {
    merged.earlyTerminationScore = guidance.pruning.earlyTerminationScore;
    appliedRules.push(
      `pruning.earlyTerminationScore=${guidance.pruning.earlyTerminationScore}`
    );
  }
  const hasActionFilters =
    guidance.actionFilters.allowedActionKinds.length > 0 ||
    guidance.actionFilters.blockedActionKinds.length > 0 ||
    guidance.actionFilters.allowedPublicActionIds.length > 0 ||
    guidance.actionFilters.blockedPublicActionIds.length > 0 ||
    Object.keys(guidance.actionFilters.perOwner).length > 0;
  if (hasActionFilters) {
    appliedRules.push('actionFilters.applied');
  }
  const hasKiboPolicy =
    guidance.kiboPolicy.allowedKiboIds.length > 0 ||
    guidance.kiboPolicy.blockedKiboIds.length > 0;
  if (hasKiboPolicy) {
    appliedRules.push('kiboPolicy.applied');
  }
  return {
    options: merged,
    guidance,
    guidanceHash: normalized.guidanceHash,
    guidanceVersion: guidance.guidanceVersion,
    appliedRules,
    layer: guidance.layer,
  };
}

export function buildActionFilterFromGuidance(inputGuidance = {}) {
  const normalized = normalizeSearchGuidance(inputGuidance);
  if (!normalized.valid) return null;
  const filters = normalized.guidance.actionFilters;
  const allowedKinds = new Set(filters.allowedActionKinds.map(String));
  const blockedKinds = new Set(filters.blockedActionKinds.map(String));
  const allowedIds = new Set(
    filters.allowedPublicActionIds.map(value => Number(value))
  );
  const blockedIds = new Set(
    filters.blockedPublicActionIds.map(value => Number(value))
  );
  const perOwner = Object.fromEntries(
    Object.entries(filters.perOwner).map(([characterId, rule]) => [
      String(characterId),
      {
        allowed: new Set((rule?.allowedPublicActionIds ?? []).map(Number)),
        blocked: new Set((rule?.blockedPublicActionIds ?? []).map(Number)),
      },
    ])
  );
  const allowedKibos = new Set(
    (normalized.guidance.kiboPolicy.allowedKiboIds ?? []).map(Number)
  );
  const blockedKibos = new Set(
    (normalized.guidance.kiboPolicy.blockedKiboIds ?? []).map(Number)
  );
  const hasCharacterRule = (characterId, entry) => {
    const rule = perOwner[String(characterId)];
    if (!rule) return true;
    const publicActionId = Number(entry.publicActionId);
    if (rule.blocked.has(publicActionId)) return false;
    if (rule.allowed.size > 0 && !rule.allowed.has(publicActionId))
      return false;
    return true;
  };
  return {
    character: (entry, characterId) => {
      const kind = String(entry.actionKind);
      if (blockedKinds.has(kind)) return false;
      if (allowedKinds.size > 0 && !allowedKinds.has(kind)) return false;
      const publicActionId = Number(entry.publicActionId);
      if (blockedIds.has(publicActionId)) return false;
      if (allowedIds.size > 0 && !allowedIds.has(publicActionId)) return false;
      return hasCharacterRule(characterId, entry);
    },
    kibo: (entry, kiboId) => {
      const id = Number(kiboId);
      if (blockedKibos.has(id)) return false;
      if (allowedKibos.size > 0 && !allowedKibos.has(id)) return false;
      return true;
    },
    active: true,
  };
}

export function createSearchFeedback({
  result = {},
  guidanceApplication = null,
}) {
  const summary = result.summary ?? {};
  const rejectionEntries = Object.entries(summary.rejectionCounts ?? {})
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([code, count]) => ({ code, count }));
  return {
    schemaVersion: MACHINE_AXIS_SEARCH_GUIDANCE_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_FEEDBACK_CONTRACT,
    kind: MACHINE_AXIS_SEARCH_FEEDBACK_KIND,
    protocolIdentity: MACHINE_AXIS_SEARCH_GUIDANCE_PROTOCOL_IDENTITY,
    generatedAt: new Date().toISOString(),
    guidanceHash: guidanceApplication?.guidanceHash ?? null,
    guidanceVersion: guidanceApplication?.guidanceVersion ?? null,
    objective: result.options?.objective ?? null,
    budgetUsage: {
      beamWidth: result.options?.beamWidth ?? null,
      topN: result.options?.topN ?? null,
      maxDepth: result.options?.maxDepth ?? null,
      steps: summary.steps ?? null,
      wallTimeMs: summary.wallTimeMs ?? null,
      candidatesEvaluated: summary.candidatesEvaluated ?? null,
      prunedCandidates: summary.prunedCandidates ?? null,
      mergedCandidates: summary.mergedCandidates ?? null,
      invalidCandidates: summary.invalidCandidates ?? null,
      completedCandidates: summary.completedCandidates ?? null,
      formalSurfaceRejectedCandidates:
        summary.formalSurfaceRejectedCandidates ?? null,
    },
    rejectionBreakdown: rejectionEntries,
    topResults: (result.results ?? []).map(entry => ({
      chainLength: entry.chain?.length ?? null,
      score: entry.score ?? entry.formalScore ?? null,
      heuristicScore: entry.heuristicScore ?? null,
      hashes: entry.hashes ?? null,
    })),
    outer: {
      implemented: true,
      searchIntegrationImplemented: false,
      status: 'm12-c1-c2-pool-ready-search-integration-pending',
      guidanceReserved:
        guidanceApplication?.layer === 'outer' ||
        guidanceApplication?.layer === 'both',
      note: 'The authoritative M12-C team/loadout pool, build planner, and lazy iterator are available through the Machine Axis service. Outer guidance remains reserved until M12-C4 binds each build to inner axis search.',
    },
    recommendations: [],
  };
}
