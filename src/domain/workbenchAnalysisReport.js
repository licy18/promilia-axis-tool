import { createWorkbenchScenarioDraftSnapshot } from './workbenchDraftStorage';

export const WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION = 1;
export const WORKBENCH_ANALYSIS_REPORT_TYPE = 'workbench-analysis-report';
export const WORKBENCH_ANALYSIS_REPORT_FILE_EXTENSION =
  'promilia-analysis.json';
export const WORKBENCH_ANALYSIS_KINDS = Object.freeze({
  CONTRIBUTION_WINDOW: 'contribution-window',
  SCENARIO_COMPARISON: 'scenario-comparison',
});

const REPORT_BOUNDARY = Object.freeze({
  sourceKind: 'applied-runtime-outputs',
  readsRuntimeOutputsOnly: true,
  appliedToCalculators: false,
  excludedSourceKinds: Object.freeze(['candidate', 'unapplied']),
});

export function createWorkbenchContributionAnalysisReport({
  project = null,
  source = null,
  contributionProjection = null,
  runtimeOutputs = null,
  windowId = 'full-axis',
  exportedAt = new Date().toISOString(),
} = {}) {
  const window = resolveContributionWindow(contributionProjection, windowId);
  if (!window || !source?.draft) {
    throw new Error(
      'Contribution analysis report requires a window and source'
    );
  }
  return createReportEnvelope({
    analysisKind: WORKBENCH_ANALYSIS_KINDS.CONTRIBUTION_WINDOW,
    title: `${source.label ?? project?.name ?? '当前方案'} · ${window.label}`,
    project,
    exportedAt,
    analysis: {
      schemaVersion: 1,
      sourceKind: 'azpr-contribution-window-report-snapshot',
      window: cloneSerializable(window),
    },
    sources: [
      createReportSource({
        ...source,
        role: 'current',
        project,
        window,
      }),
    ],
    appliedSourceBindings: [
      createAppliedSourceBinding({
        role: 'current',
        runtimeOutputs,
        window,
        projectDurationMs: project?.time?.durationMs,
      }),
    ],
  });
}

export function createWorkbenchScenarioComparisonAnalysisReport({
  project = null,
  comparison = null,
  currentSource = null,
  baselineSource = null,
  currentRuntimeOutputs = null,
  baselineRuntimeOutputs = null,
  exportedAt = new Date().toISOString(),
} = {}) {
  if (
    comparison?.status !== 'scenario-comparison-ready' ||
    !currentSource?.draft ||
    !baselineSource?.draft
  ) {
    throw new Error('Scenario comparison report requires two ready sources');
  }
  const currentWindow = comparison.current?.window;
  const baselineWindow = comparison.baseline?.window;
  return createReportEnvelope({
    analysisKind: WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON,
    title: `${comparison.current.label} / ${comparison.baseline.label} · ${currentWindow?.label ?? '全轴'}`,
    project,
    exportedAt,
    analysis: {
      schemaVersion: 1,
      sourceKind: 'azpr-scenario-comparison-report-snapshot',
      comparison: cloneSerializable(comparison),
    },
    sources: [
      createReportSource({
        ...currentSource,
        role: 'current',
        project,
        window: currentWindow,
      }),
      createReportSource({
        ...baselineSource,
        role: 'baseline',
        project,
        window: baselineWindow,
      }),
    ],
    appliedSourceBindings: [
      createAppliedSourceBinding({
        role: 'current',
        runtimeOutputs: currentRuntimeOutputs,
        window: currentWindow,
        projectDurationMs: project?.time?.durationMs,
      }),
      createAppliedSourceBinding({
        role: 'baseline',
        runtimeOutputs: baselineRuntimeOutputs,
        window: baselineWindow,
        projectDurationMs: project?.time?.durationMs,
      }),
    ],
  });
}

export function parseWorkbenchAnalysisReport(rawReport) {
  return validateWorkbenchAnalysisReport(rawReport)?.report ?? null;
}

export function validateWorkbenchAnalysisReport(rawReport) {
  const payload = parsePayload(rawReport);
  if (!isReportEnvelope(payload)) return null;

  const expectedRoles =
    payload.analysisKind === WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON
      ? ['current', 'baseline']
      : ['current'];
  if (
    !hasExactRoles(payload.sources, expectedRoles) ||
    !hasExactRoles(payload.appliedSourceBindings, expectedRoles) ||
    !hasExpectedAnalysisShape(payload)
  ) {
    return null;
  }
  const sources = expectedRoles.map(role =>
    normalizeImportedSource(
      payload.sources.find(source => source?.role === role)
    )
  );
  if (sources.some(source => !source)) return null;

  const sourceByRole = new Map(sources.map(source => [source.role, source]));
  const actionReferences = collectAnalysisActionReferences(payload);
  const bindings = expectedRoles.map(role =>
    normalizeAppliedSourceBinding(
      payload.appliedSourceBindings?.find(binding => binding?.role === role)
    )
  );
  if (
    bindings.some(binding => !binding) ||
    bindings.some(binding => !hasUniqueAppliedSourceIdentities(binding)) ||
    !referencesExistInSources(actionReferences, sourceByRole) ||
    !bindingsExistInSources(bindings, sourceByRole)
  ) {
    return null;
  }

  const report = {
    schemaVersion: WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_ANALYSIS_REPORT_TYPE,
    exportedAt: normalizeText(payload.exportedAt),
    title: normalizeText(payload.title) || 'Workbench 分析报告',
    analysisKind: payload.analysisKind,
    project: cloneSerializable(payload.project ?? {}),
    calculationBoundary: cloneSerializable(REPORT_BOUNDARY),
    sources,
    appliedSourceBindings: bindings,
    analysis: cloneSerializable(payload.analysis),
    summary: createReportSummary({
      sources,
      bindings,
      actionReferences,
    }),
  };
  return {
    report,
    validation: {
      status: 'valid',
      schemaVersion: report.schemaVersion,
      sourceCount: sources.length,
      actionReferenceCount: actionReferences.length,
      appliedTransactionCount: report.summary.appliedTransactionCount,
      appliedSourceDeltaCount: report.summary.appliedSourceDeltaCount,
      sourceDraftsValid: true,
      actionReferencesValid: true,
      appliedSourceBindingsValid: true,
    },
  };
}

export function createWorkbenchAnalysisReportFileName(
  report,
  now = new Date()
) {
  const dateText =
    normalizeText(report?.exportedAt)?.slice(0, 10) ||
    now.toISOString().slice(0, 10);
  const kind =
    report?.analysisKind === WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON
      ? 'comparison'
      : 'contribution';
  const actionCount = Number(report?.summary?.actionReferenceCount) || 0;
  return `promilia-analysis-${kind}-${dateText}-${actionCount}actions.${WORKBENCH_ANALYSIS_REPORT_FILE_EXTENSION}`;
}

function createReportEnvelope({
  analysisKind,
  title,
  project,
  exportedAt,
  analysis,
  sources,
  appliedSourceBindings,
}) {
  const actionReferences = collectAnalysisActionReferences({
    analysisKind,
    analysis,
  });
  return {
    schemaVersion: WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_ANALYSIS_REPORT_TYPE,
    exportedAt,
    title,
    analysisKind,
    project: {
      schemaVersion: project?.schemaVersion ?? null,
      id: project?.id ?? null,
      name: project?.name ?? null,
      fps: project?.time?.fps ?? 60,
      durationMs: project?.time?.durationMs ?? 0,
    },
    calculationBoundary: cloneSerializable(REPORT_BOUNDARY),
    sources,
    appliedSourceBindings,
    analysis,
    summary: createReportSummary({
      sources,
      bindings: appliedSourceBindings,
      actionReferences,
    }),
  };
}

function createReportSource({
  role,
  label,
  sourceKind,
  sourceId,
  projectId,
  projectName,
  project,
  window,
  draft,
}) {
  return {
    role,
    label:
      normalizeText(label) || (role === 'baseline' ? '基准方案' : '当前方案'),
    sourceKind: normalizeText(sourceKind) || role,
    sourceId: normalizeText(sourceId),
    projectId: projectId ?? project?.id ?? null,
    projectName: projectName ?? project?.name ?? null,
    windowId: window?.windowId ?? window?.sectionId ?? 'full-axis',
    scenarioDraft: createWorkbenchScenarioDraftSnapshot(draft),
  };
}

function createAppliedSourceBinding({
  role,
  runtimeOutputs,
  window,
  projectDurationMs,
}) {
  const transactions = (runtimeOutputs?.hitTransactions?.transactions ?? [])
    .filter(transaction =>
      isTransactionInsideWindow(transaction, window, projectDurationMs)
    )
    .map(transaction => ({
      transactionId: normalizeText(transaction.transactionId),
      actionId: normalizeText(transaction.actionId),
      hitId: normalizeText(transaction.hitId),
      actorId: normalizeText(transaction.actorId),
      energyOwnerActorId: normalizeText(transaction.energyOwnerActorId),
      frameIndex: finiteNumberOrNull(transaction.frameIndex),
      timeMs: finiteNumberOrNull(transaction.timeMs),
      sourceDeltaIds: [...(transaction.sourceDeltaIds ?? [])]
        .map(normalizeText)
        .filter(Boolean),
      delta: {
        enemyHp: numberOrZero(transaction.delta?.enemyHp),
        enemyToughness: numberOrZero(transaction.delta?.enemyToughness),
        selfEnergy: numberOrZero(transaction.delta?.selfEnergy),
      },
    }));
  return { role, transactions };
}

function isTransactionInsideWindow(transaction, window, projectDurationMs) {
  const timeMs = Number(transaction?.timeMs);
  const startMs = numberOrZero(window?.startMs);
  const endMs = numberOrZero(window?.endMs);
  const includesEnd =
    window?.kind === 'axis' || endMs >= numberOrZero(projectDurationMs);
  return (
    Number.isFinite(timeMs) &&
    timeMs >= startMs &&
    (timeMs < endMs || (includesEnd && timeMs <= endMs))
  );
}

function resolveContributionWindow(projection, windowId) {
  return (
    projection?.windows?.find(window => window.windowId === windowId) ??
    projection?.fullAxis ??
    null
  );
}

function collectAnalysisActionReferences(payload) {
  if (payload?.analysisKind === WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON) {
    return (payload.analysis?.comparison?.actions ?? []).flatMap(action => [
      ...(action.currentActionId
        ? [{ role: 'current', actionId: action.currentActionId }]
        : []),
      ...(action.baselineActionId
        ? [{ role: 'baseline', actionId: action.baselineActionId }]
        : []),
    ]);
  }
  return (payload?.analysis?.window?.actions ?? []).map(action => ({
    role: 'current',
    actionId: action.actionId,
  }));
}

function normalizeImportedSource(source) {
  if (!source?.role || !Array.isArray(source?.scenarioDraft?.actionDrafts)) {
    return null;
  }
  return {
    role: source.role,
    label: normalizeText(source.label) || source.role,
    sourceKind: normalizeText(source.sourceKind) || source.role,
    sourceId: normalizeText(source.sourceId),
    projectId: source.projectId ?? null,
    projectName: source.projectName ?? null,
    windowId: normalizeText(source.windowId) || 'full-axis',
    scenarioDraft: createWorkbenchScenarioDraftSnapshot(source.scenarioDraft),
  };
}

function normalizeAppliedSourceBinding(binding) {
  if (!binding?.role || !Array.isArray(binding.transactions)) return null;
  const transactions = binding.transactions.map(transaction => ({
    transactionId: normalizeText(transaction?.transactionId),
    actionId: normalizeText(transaction?.actionId),
    hitId: normalizeText(transaction?.hitId),
    actorId: normalizeText(transaction?.actorId),
    energyOwnerActorId: normalizeText(transaction?.energyOwnerActorId),
    frameIndex: finiteNumberOrNull(transaction?.frameIndex),
    timeMs: finiteNumberOrNull(transaction?.timeMs),
    sourceDeltaIds: [...(transaction?.sourceDeltaIds ?? [])]
      .map(normalizeText)
      .filter(Boolean),
    delta: {
      enemyHp: numberOrZero(transaction?.delta?.enemyHp),
      enemyToughness: numberOrZero(transaction?.delta?.enemyToughness),
      selfEnergy: numberOrZero(transaction?.delta?.selfEnergy),
    },
  }));
  if (
    transactions.some(
      transaction =>
        !transaction.transactionId ||
        !transaction.actionId ||
        transaction.sourceDeltaIds.length === 0
    )
  ) {
    return null;
  }
  return { role: binding.role, transactions };
}

function referencesExistInSources(references, sourceByRole) {
  return references.every(reference =>
    sourceByRole
      .get(reference.role)
      ?.scenarioDraft.actionDrafts.some(
        action => action.id === reference.actionId
      )
  );
}

function bindingsExistInSources(bindings, sourceByRole) {
  return bindings.every(binding =>
    binding.transactions.every(transaction =>
      sourceByRole
        .get(binding.role)
        ?.scenarioDraft.actionDrafts.some(
          action => action.id === transaction.actionId
        )
    )
  );
}

function createReportSummary({ sources, bindings, actionReferences }) {
  const transactions = bindings.flatMap(binding => binding.transactions);
  return {
    sourceCount: sources.length,
    actionReferenceCount: actionReferences.length,
    appliedTransactionCount: transactions.length,
    appliedSourceDeltaCount: transactions.reduce(
      (sum, transaction) => sum + transaction.sourceDeltaIds.length,
      0
    ),
    readsRuntimeOutputsOnly: true,
    appliedToCalculators: false,
  };
}

function isReportEnvelope(payload) {
  return (
    payload?.schemaVersion === WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION &&
    payload?.game === 'azur-promilia' &&
    payload?.type === WORKBENCH_ANALYSIS_REPORT_TYPE &&
    Object.values(WORKBENCH_ANALYSIS_KINDS).includes(payload?.analysisKind) &&
    payload?.calculationBoundary?.sourceKind === REPORT_BOUNDARY.sourceKind &&
    payload?.calculationBoundary?.readsRuntimeOutputsOnly === true &&
    payload?.calculationBoundary?.appliedToCalculators === false &&
    REPORT_BOUNDARY.excludedSourceKinds.every(kind =>
      payload?.calculationBoundary?.excludedSourceKinds?.includes(kind)
    ) &&
    Array.isArray(payload?.sources) &&
    Array.isArray(payload?.appliedSourceBindings) &&
    payload?.analysis
  );
}

function hasExactRoles(items, expectedRoles) {
  if (!Array.isArray(items) || items.length !== expectedRoles.length) {
    return false;
  }
  const roles = items.map(item => item?.role);
  return expectedRoles.every(
    role => roles.filter(candidate => candidate === role).length === 1
  );
}

function hasExpectedAnalysisShape(payload) {
  return payload.analysisKind === WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON
    ? payload.analysis?.comparison?.status === 'scenario-comparison-ready'
    : Boolean(payload.analysis?.window?.windowId);
}

function hasUniqueAppliedSourceIdentities(binding) {
  const transactionIds = binding.transactions.map(
    transaction => transaction.transactionId
  );
  const sourceDeltaIds = binding.transactions.flatMap(
    transaction => transaction.sourceDeltaIds
  );
  return (
    new Set(transactionIds).size === transactionIds.length &&
    new Set(sourceDeltaIds).size === sourceDeltaIds.length
  );
}

function parsePayload(rawPayload) {
  if (!rawPayload) return null;
  try {
    return typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
  } catch {
    return null;
  }
}

function cloneSerializable(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function finiteNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
