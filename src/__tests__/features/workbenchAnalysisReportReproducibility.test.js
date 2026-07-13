import { describe, expect, it } from 'vitest';
import {
  createWorkbenchContributionAnalysisReport,
  createWorkbenchScenarioComparisonAnalysisReport,
} from '../../domain/workbenchAnalysisReport';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchScenarioDraftSnapshot,
} from '../../domain/workbenchDraftStorage';
import {
  WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES,
  auditWorkbenchAnalysisReportReproducibility,
  replayWorkbenchAnalysisReportSource,
} from '../../features/workbench/workbenchAnalysisReportReproducibility';
import { projectWorkbenchScenarioComparison } from '../../simulation/projection/projectScenarioComparison';

describe('Workbench analysis report reproducibility', () => {
  it('exactly replays a frozen contribution report through current runtime', () => {
    const source = createSource('current');
    const replay = replayWorkbenchAnalysisReportSource(source, {
      durationMs: 30000,
    });
    const report = createWorkbenchContributionAnalysisReport({
      project: replay.project,
      source: createReportSourceInput(source),
      contributionProjection: replay.contributionProjection,
      runtimeOutputs: replay.runtimeOutputs,
      exportedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(auditWorkbenchAnalysisReportReproducibility(report)).toMatchObject({
      status: WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.EXACT,
      reasonCode: 'replay-exact',
      summary: {
        sourceCount: 1,
        differenceCount: 0,
        omittedDifferenceCount: 0,
        frozenAppliedTransactionCount: report.summary.appliedTransactionCount,
        replayedAppliedTransactionCount: report.summary.appliedTransactionCount,
      },
      calculationBoundary: {
        readsEmbeddedSourceDrafts: true,
        readsCurrentRuntimeOutputs: true,
        writesProjectState: false,
        overwritesFrozenReport: false,
        appliedToCalculators: false,
      },
    });
  });

  it('exactly replays both sources of a frozen scenario comparison', () => {
    const current = createSource('current');
    const baseline = createSource('baseline', draft => {
      draft.actionDrafts[0].level = 2;
    });
    const currentReplay = replayWorkbenchAnalysisReportSource(current, {
      durationMs: 30000,
    });
    const baselineReplay = replayWorkbenchAnalysisReportSource(baseline, {
      durationMs: 30000,
    });
    const comparison = projectWorkbenchScenarioComparison({
      windowId: 'full-axis',
      current: createComparisonCandidate(currentReplay, current),
      baseline: createComparisonCandidate(baselineReplay, baseline),
    });
    const report = createWorkbenchScenarioComparisonAnalysisReport({
      project: currentReplay.project,
      comparison,
      currentSource: createReportSourceInput(current),
      baselineSource: createReportSourceInput(baseline),
      currentRuntimeOutputs: currentReplay.runtimeOutputs,
      baselineRuntimeOutputs: baselineReplay.runtimeOutputs,
      exportedAt: '2026-07-13T00:00:00.000Z',
    });

    expect(auditWorkbenchAnalysisReportReproducibility(report)).toMatchObject({
      status: WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.EXACT,
      summary: { sourceCount: 2, differenceCount: 0 },
      sources: [{ role: 'current' }, { role: 'baseline' }],
    });
  });

  it('reports minimal frozen-output drift without mutating the report', () => {
    const source = createSource('current');
    const replay = replayWorkbenchAnalysisReportSource(source, {
      durationMs: 30000,
    });
    const report = createWorkbenchContributionAnalysisReport({
      project: replay.project,
      source: createReportSourceInput(source),
      contributionProjection: replay.contributionProjection,
      runtimeOutputs: replay.runtimeOutputs,
    });
    const originalHp = report.analysis.window.metrics.enemyHpDelta;
    report.analysis.window.metrics.enemyHpDelta = originalHp + 1;
    const frozen = JSON.stringify(report);

    const audit = auditWorkbenchAnalysisReportReproducibility(report);

    expect(audit.status).toBe(
      WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.DRIFT
    );
    expect(audit.summary.differenceCount).toBeGreaterThanOrEqual(1);
    expect(audit.differences).toContainEqual({
      path: '$.analysis.window.metrics.enemyHpDelta',
      kind: 'value-changed',
      expected: originalHp + 1,
      actual: originalHp,
    });
    expect(JSON.stringify(report)).toBe(frozen);
  });

  it('marks unresolved mechanism profiles and invalid reports incompatible', () => {
    const source = createSource('current');
    source.scenarioDraft.mechanicsProfileSelection = {
      schemaVersion: 1,
      contractName: 'AzPrWorkbenchMechanicsProfileSelection',
      profileId: 'removed-profile',
      profileVersion: 99,
    };
    const report = createWorkbenchContributionAnalysisReport({
      project: { time: { fps: 60, durationMs: 30000 } },
      source: createReportSourceInput(source),
      contributionProjection: createMinimalContributionProjection(
        source.scenarioDraft.actionDrafts[0].id
      ),
      runtimeOutputs: createMinimalRuntimeOutputs(
        source.scenarioDraft.actionDrafts[0].id
      ),
    });

    expect(auditWorkbenchAnalysisReportReproducibility(report)).toMatchObject({
      status: WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.INCOMPATIBLE,
      reasonCode: 'mechanics-profile-incompatible',
      failedRole: 'current',
    });
    expect(auditWorkbenchAnalysisReportReproducibility({})).toMatchObject({
      status: WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.INCOMPATIBLE,
      reasonCode: 'analysis-report-invalid',
    });
  });
});

function createSource(role, mutate = () => {}) {
  const draft = createDefaultWorkbenchDraftState();
  mutate(draft);
  return {
    role,
    label: role === 'baseline' ? '基准方案' : '当前方案',
    sourceKind: 'workspace-scenario',
    sourceId: role === 'baseline' ? 'scenario-0002' : 'scenario-0001',
    windowId: 'full-axis',
    scenarioDraft: createWorkbenchScenarioDraftSnapshot(draft),
  };
}

function createReportSourceInput(source) {
  return {
    ...source,
    draft: source.scenarioDraft,
  };
}

function createComparisonCandidate(replay, source) {
  return {
    label: source.label,
    sourceKind: source.sourceKind,
    sourceId: source.sourceId,
    scenario: replay.scenario,
    runtimeOutputs: replay.runtimeOutputs,
    effectIntervals: replay.effectIntervals,
    contributionProjection: replay.contributionProjection,
  };
}

function createMinimalContributionProjection(actionId) {
  const window = {
    windowId: 'full-axis',
    kind: 'axis',
    label: '全轴',
    startMs: 0,
    endMs: 30000,
    durationMs: 30000,
    metrics: {},
    actors: [],
    actions: [{ actionId }],
    effects: [],
    summary: { hitTransactionCount: 1 },
  };
  return { fullAxis: window, windows: [window] };
}

function createMinimalRuntimeOutputs(actionId) {
  return {
    hitTransactions: {
      transactions: [
        {
          transactionId: 'transaction-1',
          actionId,
          frameIndex: 0,
          timeMs: 0,
          sourceDeltaIds: ['delta-1'],
          delta: {},
        },
      ],
    },
  };
}
