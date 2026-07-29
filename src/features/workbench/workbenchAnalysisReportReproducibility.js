import {
  WORKBENCH_ANALYSIS_KINDS,
  createWorkbenchContributionAnalysisReport,
  createWorkbenchScenarioComparisonAnalysisReport,
  validateWorkbenchAnalysisReport,
} from '../../domain/workbenchAnalysisReport';
import { createWorkbenchGameDataCompatibilityReport } from '../../domain/workbenchGameDataCatalog';
import { createWorkbenchProject } from '../../domain/workbenchProjectFactory';
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  createWorkbenchProfileCompatibilityReport,
} from '../../simulation/mechanics/threeValueMechanicsProfileCatalog';
import { projectCycleSections } from '../../simulation/projection/projectCycleSections';
import { projectEffectRuntimeIntervals } from '../../simulation/projection/projectEffectIntervals';
import { projectWorkbenchScenarioComparison } from '../../simulation/projection/projectScenarioComparison';
import { createRuntimeStatePointContexts } from './runtimeProjectionPoints';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from './workbenchHeadlessCombatCore';

export const WORKBENCH_ANALYSIS_REPRODUCIBILITY_CONTRACT_NAME =
  'AzPrWorkbenchAnalysisReportReproducibilityAudit';
export const WORKBENCH_ANALYSIS_REPRODUCIBILITY_SCHEMA_VERSION = 1;
export const WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES = Object.freeze({
  EXACT: 'exact',
  DRIFT: 'drift',
  INCOMPATIBLE: 'incompatible',
});

const MAX_REPORTED_DIFFERENCES = 12;

export function auditWorkbenchAnalysisReportReproducibility(rawReport) {
  const validated = validateWorkbenchAnalysisReport(rawReport);
  if (!validated) {
    return createIncompatibleAudit({
      reasonCode: 'analysis-report-invalid',
      reason: '分析报告未通过合同验证',
    });
  }

  const report = validated.report;
  try {
    const replayedSources = report.sources.map(source =>
      replayWorkbenchAnalysisReportSource(source, {
        durationMs: report.project?.durationMs,
      })
    );
    const replayedReport = createReplayedReport(report, replayedSources);
    const comparison = compareFrozenReportOutputs(report, replayedReport);
    const status = comparison.differenceCount
      ? WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.DRIFT
      : WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.EXACT;

    return {
      schemaVersion: WORKBENCH_ANALYSIS_REPRODUCIBILITY_SCHEMA_VERSION,
      contractName: WORKBENCH_ANALYSIS_REPRODUCIBILITY_CONTRACT_NAME,
      status,
      analysisKind: report.analysisKind,
      reportSchemaVersion: report.schemaVersion,
      reasonCode: status === 'exact' ? 'replay-exact' : 'replay-output-drift',
      reason:
        status === 'exact'
          ? '当前数据与运行时可精确复现冻结报告'
          : `当前数据与运行时产生 ${comparison.differenceCount} 处冻结输出差异`,
      sources: replayedSources.map(createReplaySourceSummary),
      differences: comparison.differences,
      summary: {
        sourceCount: replayedSources.length,
        differenceCount: comparison.differenceCount,
        reportedDifferenceCount: comparison.differences.length,
        omittedDifferenceCount: Math.max(
          0,
          comparison.differenceCount - comparison.differences.length
        ),
        frozenAppliedTransactionCount: report.summary.appliedTransactionCount,
        replayedAppliedTransactionCount:
          replayedReport.summary.appliedTransactionCount,
      },
      calculationBoundary: createAuditBoundary(),
    };
  } catch (error) {
    return createIncompatibleAudit({
      report,
      reasonCode: error?.reasonCode ?? 'replay-failed',
      reason: error?.message ?? '当前版本无法重放报告来源',
      failedRole: error?.failedRole ?? null,
    });
  }
}

export function replayWorkbenchAnalysisReportSource(
  source,
  { durationMs = 0 } = {}
) {
  const draft = source?.scenarioDraft;
  if (!draft) {
    throw createReplayError(
      'source-draft-missing',
      '报告来源缺少可重放草稿',
      source?.role
    );
  }

  const profileCompatibility = createWorkbenchProfileCompatibilityReport(
    draft,
    DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG
  );
  if (!profileCompatibility.importAllowed) {
    throw createReplayError(
      'mechanics-profile-incompatible',
      '报告使用的机制 profile 已无法精确解析',
      source.role
    );
  }
  const gameDataCompatibility =
    createWorkbenchGameDataCompatibilityReport(draft);
  if (!gameDataCompatibility.importAllowed) {
    throw createReplayError(
      'game-data-incompatible',
      '报告来源与当前游戏数据目录不兼容',
      source.role
    );
  }

  const project = createWorkbenchProject(draft.selection, {
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary: draft.configurationLibrary,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding,
    gameDataCompatibilityReport: gameDataCompatibility,
    mechanicsProfileSelection: draft.mechanicsProfileSelection,
    mechanicsProfileCompatibilityReport: profileCompatibility,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
    combatScenario: draft.combatScenario,
    durationMs: positiveNumberOrNull(durationMs) ?? undefined,
  });
  const canonicalRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate({
    schemaVersion: 1,
    project,
  });
  const scenario = canonicalRun.compilation.scenario;
  const simulationResult = canonicalRun.simulation;
  const runtimeOutputs = simulationResult.runtimeOutputs;
  const effectIntervals = projectEffectRuntimeIntervals({
    effectTimeline: runtimeOutputs.effectTimeline,
    durationMs: scenario.time.durationMs,
    frameRate: scenario.time.fps,
  });
  const statePointContexts = createRuntimeStatePointContexts(runtimeOutputs);
  const contributionProjection = projectCycleSections({
    scenario,
    runtimeOutputs,
    effectIntervals,
    statePointContexts,
  });

  if (
    !contributionProjection.windows.some(
      window => window.windowId === source.windowId
    )
  ) {
    throw createReplayError(
      'analysis-window-unavailable',
      `当前版本无法重建窗口 ${source.windowId}`,
      source.role
    );
  }

  return {
    source,
    canonicalRun,
    project,
    scenario,
    simulationResult,
    runtimeOutputs,
    effectIntervals,
    statePointContexts,
    contributionProjection,
    profileCompatibility,
    gameDataCompatibility,
  };
}

function createReplayedReport(report, replayedSources) {
  const replayByRole = new Map(
    replayedSources.map(replay => [replay.source.role, replay])
  );
  if (report.analysisKind === WORKBENCH_ANALYSIS_KINDS.CONTRIBUTION_WINDOW) {
    const current = replayByRole.get('current');
    return createWorkbenchContributionAnalysisReport({
      project: current.project,
      source: createReportSourceInput(current.source),
      contributionProjection: current.contributionProjection,
      runtimeOutputs: current.runtimeOutputs,
      windowId: current.source.windowId,
      exportedAt: report.exportedAt,
    });
  }

  const current = replayByRole.get('current');
  const baseline = replayByRole.get('baseline');
  if (!current || !baseline) {
    throw createReplayError(
      'comparison-source-missing',
      '方案比较缺少当前或基准来源'
    );
  }
  const frozenComparison = report.analysis.comparison;
  const comparison = projectWorkbenchScenarioComparison({
    windowId: frozenComparison.windowId,
    current: createComparisonCandidate(
      current,
      frozenComparison.current,
      'current'
    ),
    baseline: createComparisonCandidate(
      baseline,
      frozenComparison.baseline,
      'baseline'
    ),
  });
  if (
    comparison.status !== 'scenario-comparison-ready' ||
    comparison.windowId !== frozenComparison.windowId
  ) {
    throw createReplayError(
      'comparison-window-unavailable',
      `当前版本无法重建比较窗口 ${frozenComparison.windowId}`
    );
  }
  return createWorkbenchScenarioComparisonAnalysisReport({
    project: current.project,
    comparison,
    currentSource: createReportSourceInput(current.source),
    baselineSource: createReportSourceInput(baseline.source),
    currentRuntimeOutputs: current.runtimeOutputs,
    baselineRuntimeOutputs: baseline.runtimeOutputs,
    exportedAt: report.exportedAt,
  });
}

function createComparisonCandidate(replay, frozenCandidate, role) {
  return {
    label:
      frozenCandidate?.label ??
      replay.source.label ??
      (role === 'baseline' ? '基准方案' : '当前方案'),
    sourceKind: frozenCandidate?.sourceKind ?? replay.source.sourceKind ?? role,
    sourceId: frozenCandidate?.sourceId ?? replay.source.sourceId,
    scenario: replay.scenario,
    runtimeOutputs: replay.runtimeOutputs,
    effectIntervals: replay.effectIntervals,
    contributionProjection: replay.contributionProjection,
  };
}

function createReportSourceInput(source) {
  return {
    role: source.role,
    label: source.label,
    sourceKind: source.sourceKind,
    sourceId: source.sourceId,
    projectId: source.projectId,
    projectName: source.projectName,
    draft: source.scenarioDraft,
  };
}

function compareFrozenReportOutputs(frozenReport, replayedReport) {
  const differences = [];
  const state = { differenceCount: 0 };
  compareValues(
    {
      analysis: frozenReport.analysis,
      appliedSourceBindings: frozenReport.appliedSourceBindings,
      summary: frozenReport.summary,
    },
    {
      analysis: replayedReport.analysis,
      appliedSourceBindings: replayedReport.appliedSourceBindings,
      summary: replayedReport.summary,
    },
    '$',
    differences,
    state
  );
  return { differences, differenceCount: state.differenceCount };
}

function compareValues(expected, actual, path, differences, state) {
  if (Object.is(expected, actual)) return;
  const expectedContainer = isContainer(expected);
  const actualContainer = isContainer(actual);
  if (!expectedContainer || !actualContainer) {
    recordDifference(
      path,
      expected === undefined
        ? 'unexpected-current'
        : actual === undefined
          ? 'missing-current'
          : typeof expected !== typeof actual
            ? 'type-changed'
            : 'value-changed',
      expected,
      actual,
      differences,
      state
    );
    return;
  }
  if (Array.isArray(expected) !== Array.isArray(actual)) {
    recordDifference(
      path,
      'type-changed',
      expected,
      actual,
      differences,
      state
    );
    return;
  }
  if (Array.isArray(expected)) {
    const length = Math.max(expected.length, actual.length);
    for (let index = 0; index < length; index += 1) {
      compareValues(
        expected[index],
        actual[index],
        `${path}[${index}]`,
        differences,
        state
      );
    }
    return;
  }
  const keys = [
    ...new Set([...Object.keys(expected), ...Object.keys(actual)]),
  ].sort((left, right) => left.localeCompare(right));
  for (const key of keys) {
    compareValues(
      expected[key],
      actual[key],
      `${path}.${key}`,
      differences,
      state
    );
  }
}

function recordDifference(path, kind, expected, actual, differences, state) {
  state.differenceCount += 1;
  if (differences.length >= MAX_REPORTED_DIFFERENCES) return;
  differences.push({
    path,
    kind,
    expected: createDiffValue(expected),
    actual: createDiffValue(actual),
  });
}

function createDiffValue(value) {
  if (value === undefined) return { kind: 'absent' };
  if (Array.isArray(value)) return { kind: 'array', length: value.length };
  if (value && typeof value === 'object') {
    return { kind: 'object', keys: Object.keys(value).sort() };
  }
  return value;
}

function createReplaySourceSummary(replay) {
  return {
    role: replay.source.role,
    sourceId: replay.source.sourceId,
    windowId: replay.source.windowId,
    requestedProfileId:
      replay.profileCompatibility.scenarios[0]?.requestedProfileId ?? null,
    resolvedProfileId:
      replay.profileCompatibility.scenarios[0]?.resolvedProfileId ?? null,
    profileStatus: replay.profileCompatibility.status,
    gameDataStatus: replay.gameDataCompatibility.status,
    actionCount: replay.scenario.actions.length,
    appliedTransactionCount:
      replay.runtimeOutputs.hitTransactions?.transactions?.length ?? 0,
    canonicalInputHash: replay.canonicalRun.inputHash,
    canonicalDataHash: replay.canonicalRun.dataHash,
    canonicalTraceHash: replay.canonicalRun.traceHash,
    criticalPolicy: replay.canonicalRun.trace.critical?.policy ?? null,
    criticalSeed: replay.canonicalRun.trace.critical?.seed ?? null,
  };
}

function createIncompatibleAudit({
  report = null,
  reasonCode,
  reason,
  failedRole = null,
}) {
  return {
    schemaVersion: WORKBENCH_ANALYSIS_REPRODUCIBILITY_SCHEMA_VERSION,
    contractName: WORKBENCH_ANALYSIS_REPRODUCIBILITY_CONTRACT_NAME,
    status: WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.INCOMPATIBLE,
    analysisKind: report?.analysisKind ?? null,
    reportSchemaVersion: report?.schemaVersion ?? null,
    reasonCode,
    reason,
    failedRole,
    sources: [],
    differences: [],
    summary: {
      sourceCount: report?.sources?.length ?? 0,
      differenceCount: 0,
      reportedDifferenceCount: 0,
      omittedDifferenceCount: 0,
      frozenAppliedTransactionCount:
        report?.summary?.appliedTransactionCount ?? 0,
      replayedAppliedTransactionCount: 0,
    },
    calculationBoundary: createAuditBoundary(),
  };
}

function createAuditBoundary() {
  return {
    sourceKind: 'frozen-analysis-report-and-current-runtime-replay',
    readsEmbeddedSourceDrafts: true,
    readsCurrentRuntimeOutputs: true,
    writesProjectState: false,
    overwritesFrozenReport: false,
    appliedToCalculators: false,
  };
}

function createReplayError(reasonCode, message, failedRole = null) {
  const error = new Error(message);
  error.reasonCode = reasonCode;
  error.failedRole = failedRole;
  return error;
}

function isContainer(value) {
  return value !== null && typeof value === 'object';
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
