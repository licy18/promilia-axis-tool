import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';
import { getVerifiedNormalAttackInputAuthorityDescriptor } from '../domain/verifiedNormalAttackInputAuthority';

export const MACHINE_AXIS_ACTION_LEGALITY_SCHEMA_VERSION = 3;
export const MACHINE_AXIS_ACTION_LEGALITY_CONTRACT =
  'AzPrMachineAxisActionLegalityProof';

const GENERIC_BLOCK_CODES = new Set([
  'machine-axis-action-not-executable',
  'machine-axis-action-rule-blocked',
]);
const GENERIC_UNRESOLVED_CODES = new Set([
  'machine-axis-action-conditions-unresolved',
]);
const ACTION_LEGALITY_WARNING_CODES = new Set([
  'machine-axis-action-conditions-unresolved',
  'machine-axis-same-frame-order-unresolved',
  'joint-attack-trigger-unresolved',
]);

export function createMachineAxisActionLegalityProof(
  run = {},
  {
    objectiveId = null,
    preflightIssues = [],
    additionalIssues = [],
    chargedInputProof = null,
  } = {}
) {
  const issues = [];
  const addIssue = issue => {
    if (!issue) return;
    const identity = createLegalityIssueIdentity(issue);
    const existingIndex = issues.findIndex(
      entry => createLegalityIssueIdentity(entry) === identity
    );
    if (existingIndex >= 0) {
      issues[existingIndex] = mergeLegalityIssues(issues[existingIndex], issue);
      return;
    }
    issues.push(issue);
  };
  const externalIssues = [
    ...(preflightIssues ?? []),
    ...(additionalIssues ?? []),
    ...(run?.validation?.issues ?? []),
    ...(run?.validation?.warnings ?? []),
  ];
  for (const [index, issue] of externalIssues.entries()) {
    for (const normalized of normalizePreflightLegalityIssues(issue, index)) {
      addIssue(normalized);
    }
  }

  const plan = run?.trace?.executionPlan ?? {};
  for (const [index, entry] of (plan.actions ?? []).entries()) {
    if (entry.execute === false) {
      const ruleCodes = uniqueSorted(entry.violationCodes);
      for (const code of ruleCodes.length
        ? ruleCodes
        : ['machine-axis-action-rule-blocked']) {
        addIssue(
          legalityIssue({
            code,
            category: classifyLegalityIssue({ code }),
            path: `executionPlan.actions.${index}`,
            message: `Action ${entry.actionId} is skipped by a hard action rule: ${code}`,
            actionId: entry.actionId ?? null,
            actionIds: [entry.actionId].filter(Boolean),
            status: entry.status ?? 'blocked',
            ruleCodes,
            unresolvedCodes: uniqueSorted(entry.unresolvedCodes),
            sourceSequencePath: entry.sourceSequencePath ?? null,
          })
        );
      }
      continue;
    }
    if (
      entry.status === 'scheduled-with-unresolved-conditions' ||
      (entry.unresolvedCodes ?? []).length > 0
    ) {
      const unresolvedCodes = uniqueSorted(entry.unresolvedCodes);
      for (const code of unresolvedCodes.length
        ? unresolvedCodes
        : ['machine-axis-action-conditions-unresolved']) {
        addIssue(
          legalityIssue({
            code,
            category: classifyLegalityIssue({ code }),
            path: `executionPlan.actions.${index}`,
            message: `Action ${entry.actionId} has unresolved execution condition: ${code}`,
            actionId: entry.actionId ?? null,
            actionIds: [entry.actionId].filter(Boolean),
            status: entry.status ?? 'unresolved',
            unresolvedCodes,
            sourceSequencePath: entry.sourceSequencePath ?? null,
          })
        );
      }
    }
  }
  for (const [index, diagnostic] of (
    run?.trace?.diagnostics?.actionRules?.diagnostics ?? []
  ).entries()) {
    if (!['violated', 'unresolved'].includes(diagnostic.status)) continue;
    addIssue(
      legalityIssue({
        code:
          diagnostic.code ??
          (diagnostic.status === 'unresolved'
            ? 'machine-axis-action-conditions-unresolved'
            : 'machine-axis-action-rule-blocked'),
        category: classifyLegalityIssue(diagnostic),
        path: `trace.diagnostics.actionRules.${index}`,
        message:
          diagnostic.message ??
          `Action ${diagnostic.actionId} ${diagnostic.status}`,
        actionId: diagnostic.actionId ?? null,
        actionIds: uniqueSorted(diagnostic.actionIds),
        actorId: diagnostic.actorId ?? null,
        status: diagnostic.status,
        ruleCodes:
          diagnostic.status === 'violated'
            ? [diagnostic.code].filter(Boolean)
            : [],
        unresolvedCodes:
          diagnostic.status === 'unresolved'
            ? [diagnostic.code].filter(Boolean)
            : [],
        ...projectLegalityIdentityFields(diagnostic),
      })
    );
  }
  issues.sort(compareLegalityIssues);
  const scoreExclusions = collectScoreExclusions(run);

  const rejectionCodes = uniqueSorted(issues.map(issue => issue.code));
  const scoreExclusionCodes = uniqueSorted(
    scoreExclusions.map(issue => issue.code)
  );
  const categories = uniqueSorted(issues.map(issue => issue.category));
  const value = {
    schemaVersion: MACHINE_AXIS_ACTION_LEGALITY_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_ACTION_LEGALITY_CONTRACT,
    status:
      issues.length === 0
        ? scoreExclusions.length === 0
          ? 'axis-action-legality-passed'
          : 'axis-action-legality-passed-score-ineligible'
        : 'axis-action-legality-rejected',
    passed: issues.length === 0,
    finalScoreEligible: issues.length === 0 && scoreExclusions.length === 0,
    objectiveId,
    normalAttackInputAuthority:
      getVerifiedNormalAttackInputAuthorityDescriptor(),
    chargedInputProof,
    actionCount: (plan.actions ?? []).length,
    skippedActionCount: (plan.actions ?? []).filter(
      entry => entry.execute === false
    ).length,
    unresolvedActionCount: (plan.actions ?? []).filter(
      entry =>
        entry.status === 'scheduled-with-unresolved-conditions' ||
        (entry.unresolvedCodes ?? []).length > 0
    ).length,
    rejectionCodes,
    rejectionCounts: Object.fromEntries(
      rejectionCodes.map(code => [
        code,
        issues.filter(issue => issue.code === code).length,
      ])
    ),
    rejectionCountsByCategory: Object.fromEntries(
      categories.map(category => [
        category,
        issues.filter(issue => issue.category === category).length,
      ])
    ),
    issues,
    scoreExclusionCodes,
    scoreExclusionCounts: Object.fromEntries(
      scoreExclusionCodes.map(code => [
        code,
        scoreExclusions.filter(issue => issue.code === code).length,
      ])
    ),
    scoreExclusions,
    minimalCounterexamples: issues.slice(0, 8).map(projectCounterexample),
    hashBindings: {
      input: run?.hashes?.input ?? null,
      data: run?.hashes?.data ?? null,
      trace: run?.hashes?.trace ?? null,
      build: run?.hashes?.build ?? null,
    },
  };
  return Object.freeze({
    ...value,
    proofHash: hashCanonicalValue(value),
  });
}

function collectScoreExclusions(run) {
  const exclusions = [];
  const seen = new Set();
  const add = exclusion => {
    const identity = createLegalityIssueIdentity(exclusion);
    if (seen.has(identity)) return;
    seen.add(identity);
    exclusions.push(
      legalityIssue({
        category: classifyLegalityIssue(exclusion),
        status: 'score-ineligible',
        ...exclusion,
      })
    );
  };
  for (const [index, warning] of (run?.validation?.warnings ?? []).entries()) {
    if (warning?.code !== 'machine-axis-variant-resolution-open') continue;
    add({
      code: warning.code,
      path: warning.path ?? `validation.warnings.${index}`,
      message:
        warning.message ??
        `Action ${warning.actionId ?? '?'} has unresolved variant mechanics`,
      actionId: warning.actionId ?? null,
      reason: warning.reason ?? warning.variantResolutionStatus ?? null,
      evidenceStatus: warning.variantResolutionStatus ?? null,
    });
  }
  for (const [index, event] of (run?.trace?.events ?? []).entries()) {
    if (event?.type !== 'DAMAGE_SKIPPED') continue;
    add({
      code: 'machine-axis-damage-skipped',
      path: `trace.events.${index}`,
      message: `Action ${event.actionId ?? '?'} has incomplete combat mechanics and cannot be scored`,
      actionId: event.actionId ?? null,
      reason: event.payload?.reason ?? 'verified-action-mechanics-unresolved',
      reasons: event.payload?.reasons ?? [],
      timeMs: event.timeMs ?? null,
    });
  }
  return exclusions.sort(compareLegalityIssues);
}

export function isMachineAxisActionLegalityIssue(issue) {
  const code = String(issue?.code ?? '');
  const path = String(issue?.path ?? '');
  if (!code) return false;
  // Zero-distance is an explicit, hash-bound product scenario policy rather
  // than an unresolved action condition. Keep it visible as a run warning,
  // but do not turn the accepted scenario policy into an action rejection.
  if (code === 'machine-axis-scenario-assumption') return false;
  if (
    GENERIC_BLOCK_CODES.has(code) ||
    GENERIC_UNRESOLVED_CODES.has(code) ||
    ACTION_LEGALITY_WARNING_CODES.has(code)
  ) {
    return true;
  }
  if (String(issue?.status ?? '') === 'unresolved') return true;
  const diagnosticOnlyWarning = issue?.severity === 'warning';
  if (
    !diagnosticOnlyWarning &&
    (issue?.actionId != null || (issue?.actionIds ?? []).length > 0)
  ) {
    return true;
  }
  if (
    !diagnosticOnlyWarning &&
    /^(actions(?:\.|$)|executionPlan\.actions|trace\.diagnostics\.actionRules)/.test(
      path
    )
  ) {
    return true;
  }
  return (
    !diagnosticOnlyWarning &&
    /^scenario\.(enemy|target|projectile|team|optimizationScenarioPolicy)(?:\.|$)/.test(
      path
    )
  );
}

function legalityIssue(value) {
  return {
    severity: 'error',
    finalScoreEligible: false,
    ...value,
  };
}

function normalizePreflightLegalityIssues(issue, index) {
  if (!isMachineAxisActionLegalityIssue(issue)) return [];
  const sourceCode = String(issue?.code ?? 'machine-axis-action-rule-blocked');
  const unresolved =
    GENERIC_UNRESOLVED_CODES.has(sourceCode) ||
    ACTION_LEGALITY_WARNING_CODES.has(sourceCode) ||
    String(issue?.status ?? '') === 'unresolved';
  const nestedCodes = uniqueSorted(
    unresolved
      ? issue?.unresolvedCodes
      : (issue?.violationCodes ?? issue?.ruleCodes)
  );
  const codes =
    (GENERIC_BLOCK_CODES.has(sourceCode) ||
      GENERIC_UNRESOLVED_CODES.has(sourceCode)) &&
    nestedCodes.length > 0
      ? nestedCodes
      : [sourceCode];
  return codes.map(code =>
    legalityIssue({
      code,
      category: classifyLegalityIssue({ ...issue, code }),
      path: issue?.path ?? `preflightIssues.${index}`,
      message:
        issue?.message ??
        (unresolved
          ? `Action has unresolved execution condition: ${code}`
          : `Action is blocked by a hard legality condition: ${code}`),
      actionId: issue?.actionId ?? null,
      actionIds: uniqueSorted(
        issue?.actionIds ?? [issue?.actionId].filter(Boolean)
      ),
      actorId: issue?.actorId ?? null,
      status: unresolved ? 'unresolved' : (issue?.status ?? 'blocked'),
      ruleCodes: unresolved ? [] : nestedCodes,
      unresolvedCodes: unresolved ? nestedCodes : [],
      ...projectLegalityIdentityFields(issue),
    })
  );
}

function classifyLegalityIssue(issue) {
  const code = String(issue?.code ?? '')
    .toLowerCase()
    .replaceAll('_', '-');
  if (
    issue?.resourceIdentity != null ||
    code.includes('resource') ||
    code.includes('tuning-mark')
  ) {
    return 'resource';
  }
  if (code.includes('death') || code.includes('dead')) return 'death';
  if (code.includes('joint-attack')) return 'joint';
  if (code.includes('attack-input') || code.includes('chain')) return 'chain';
  if (code.includes('overlap') || code.includes('occupancy')) {
    return 'occupancy';
  }
  if (
    code.includes('cooldown') ||
    code.includes('charge') ||
    code.includes('readiness') ||
    code.includes('same-frame') ||
    code.includes('controlled-actor') ||
    code.includes('switch-frame')
  ) {
    return 'readiness';
  }
  if (
    code.includes('owner') ||
    code.includes('target') ||
    code.includes('enemy') ||
    code.includes('kibo-unknown') ||
    code.includes('loadout') ||
    code.includes('scenario-out-of-scope') ||
    code.includes('range')
  ) {
    return 'owner-target-scenario';
  }
  return 'action-rule';
}

function projectLegalityIdentityFields(source) {
  const result = {};
  for (const key of [
    'absoluteFrame',
    'actualContextActionId',
    'actorId',
    'actorIds',
    'attackGroupId',
    'attackInputChainIdentity',
    'blockingActionId',
    'continuityRuleIdentity',
    'continuitySourceIdentity',
    'controlledActorId',
    'currentValue',
    'expectedContextActionId',
    'lethalActionId',
    'maxValue',
    'ownerId',
    'ownerKind',
    'pairedActionId',
    'predecessorActionId',
    'reason',
    'relativeStartFrame',
    'requiredValue',
    'resourceIdentity',
    'resourceKind',
    'resourceOwnerId',
    'resourceOwnerKind',
    'runtimeOwnerIdentity',
    'derivationIdentity',
    'evidenceStatus',
    'expectedAttackInput',
    'actualAttackInput',
    'formIdentity',
    'frameIndex',
    'reasons',
    'sourceKind',
    'sourceIdentity',
    'sourceSequencePath',
    'sourceSequenceSource',
    'targetId',
    'timeMs',
    'valueUnit',
  ]) {
    if (source?.[key] !== undefined) result[key] = source[key];
  }
  return result;
}

function projectCounterexample(issue) {
  return {
    code: issue.code,
    category: issue.category,
    actionId: issue.actionId ?? null,
    actionIds: issue.actionIds ?? [],
    path: issue.path,
    ruleCodes: issue.ruleCodes ?? [],
    unresolvedCodes: issue.unresolvedCodes ?? [],
    ...projectLegalityIdentityFields(issue),
  };
}

function createLegalityIssueIdentity(issue) {
  return JSON.stringify({
    code: issue.code ?? null,
    actionId: issue.actionId ?? null,
    actionIds: issue.actionId == null ? uniqueSorted(issue.actionIds) : [],
    path: issue.actionId == null ? (issue.path ?? null) : null,
    resourceIdentity: issue.resourceIdentity ?? null,
    targetId: issue.targetId ?? null,
    absoluteFrame: issue.absoluteFrame ?? null,
  });
}

function mergeLegalityIssues(existing, incoming) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming ?? {})) {
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      continue;
    }
    merged[key] = value;
  }
  merged.actionIds = uniqueSorted([
    ...(existing.actionIds ?? []),
    ...(incoming.actionIds ?? []),
  ]);
  merged.ruleCodes = uniqueSorted([
    ...(existing.ruleCodes ?? []),
    ...(incoming.ruleCodes ?? []),
  ]);
  merged.unresolvedCodes = uniqueSorted([
    ...(existing.unresolvedCodes ?? []),
    ...(incoming.unresolvedCodes ?? []),
  ]);
  return merged;
}

function compareLegalityIssues(left, right) {
  return (
    String(left.code).localeCompare(String(right.code), 'en') ||
    String(left.actionId ?? '').localeCompare(
      String(right.actionId ?? ''),
      'en'
    ) ||
    String(left.path ?? '').localeCompare(String(right.path ?? ''), 'en')
  );
}

function uniqueSorted(values) {
  return [...new Set((values ?? []).filter(Boolean).map(String))].sort(
    (left, right) => left.localeCompare(right, 'en')
  );
}
