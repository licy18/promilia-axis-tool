import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_ANALYSIS_KINDS,
  createWorkbenchAnalysisReportFileName,
  createWorkbenchContributionAnalysisReport,
  createWorkbenchScenarioComparisonAnalysisReport,
  parseWorkbenchAnalysisReport,
  validateWorkbenchAnalysisReport,
} from '../../domain/workbenchAnalysisReport';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchScenarioDraftSnapshot,
} from '../../domain/workbenchDraftStorage';

describe('Workbench analysis report', () => {
  it('round-trips an applied contribution window with source identities', () => {
    const draft = createDefaultWorkbenchDraftState();
    const actionId = draft.actionDrafts[0].id;
    const report = createWorkbenchContributionAnalysisReport({
      project: createProject(),
      source: createSource('current', draft),
      contributionProjection: createContributionProjection(actionId),
      runtimeOutputs: createRuntimeOutputs(actionId, 'current'),
      exportedAt: '2026-07-12T12:00:00.000Z',
    });
    const validation = validateWorkbenchAnalysisReport(JSON.stringify(report));

    expect(report).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'workbench-analysis-report',
      analysisKind: WORKBENCH_ANALYSIS_KINDS.CONTRIBUTION_WINDOW,
      calculationBoundary: {
        sourceKind: 'applied-runtime-outputs',
        readsRuntimeOutputsOnly: true,
        appliedToCalculators: false,
        excludedSourceKinds: ['candidate', 'unapplied'],
      },
      summary: {
        sourceCount: 1,
        actionReferenceCount: 1,
        appliedTransactionCount: 1,
        appliedSourceDeltaCount: 3,
      },
    });
    expect(validation).toMatchObject({
      validation: {
        status: 'valid',
        sourceDraftsValid: true,
        actionReferencesValid: true,
        appliedSourceBindingsValid: true,
      },
    });
    expect(validation.report.sources[0].scenarioDraft.actionDrafts[0].id).toBe(
      actionId
    );
    expect(
      validation.report.appliedSourceBindings[0].transactions[0]
    ).toMatchObject({
      transactionId: 'current-transaction',
      actionId,
      sourceDeltaIds: ['current-hp', 'current-toughness', 'current-energy'],
    });
    expect(createWorkbenchAnalysisReportFileName(report)).toBe(
      'promilia-analysis-contribution-2026-07-12-1actions.promilia-analysis.json'
    );
  });

  it('round-trips both source drafts in a scenario comparison report', () => {
    const currentDraft = createDefaultWorkbenchDraftState();
    const baselineDraft = createDefaultWorkbenchDraftState();
    const actionId = currentDraft.actionDrafts[0].id;
    baselineDraft.actionDrafts[0].level = 2;
    const report = createWorkbenchScenarioComparisonAnalysisReport({
      project: createProject(),
      comparison: createComparison(actionId),
      currentSource: createSource('current', currentDraft),
      baselineSource: createSource('baseline', baselineDraft),
      currentRuntimeOutputs: createRuntimeOutputs(actionId, 'current'),
      baselineRuntimeOutputs: createRuntimeOutputs(actionId, 'baseline'),
      exportedAt: '2026-07-12T12:00:00.000Z',
    });
    const parsed = parseWorkbenchAnalysisReport(report);

    expect(parsed.analysisKind).toBe(
      WORKBENCH_ANALYSIS_KINDS.SCENARIO_COMPARISON
    );
    expect(parsed.sources.map(source => source.role)).toEqual([
      'current',
      'baseline',
    ]);
    expect(parsed.sources[1].scenarioDraft.actionDrafts[0].level).toBe(2);
    expect(parsed.summary).toMatchObject({
      sourceCount: 2,
      actionReferenceCount: 2,
      appliedTransactionCount: 2,
      appliedSourceDeltaCount: 6,
    });
    expect(createWorkbenchAnalysisReportFileName(report)).toBe(
      'promilia-analysis-comparison-2026-07-12-2actions.promilia-analysis.json'
    );
  });

  it('rejects drifted action and applied source references', () => {
    const draft = createDefaultWorkbenchDraftState();
    const actionId = draft.actionDrafts[0].id;
    const report = createWorkbenchContributionAnalysisReport({
      project: createProject(),
      source: createSource('current', draft),
      contributionProjection: createContributionProjection(actionId),
      runtimeOutputs: createRuntimeOutputs(actionId, 'current'),
    });

    report.analysis.window.actions[0].actionId = 'missing-action';
    expect(parseWorkbenchAnalysisReport(report)).toBeNull();
    report.analysis.window.actions[0].actionId = actionId;
    report.appliedSourceBindings[0].transactions[0].sourceDeltaIds = [];
    expect(parseWorkbenchAnalysisReport(report)).toBeNull();

    const duplicateSource = createWorkbenchContributionAnalysisReport({
      project: createProject(),
      source: createSource('current', draft),
      contributionProjection: createContributionProjection(actionId),
      runtimeOutputs: createRuntimeOutputs(actionId, 'current'),
    });
    duplicateSource.sources.push(duplicateSource.sources[0]);
    expect(parseWorkbenchAnalysisReport(duplicateSource)).toBeNull();
  });
});

function createProject() {
  return {
    schemaVersion: 1,
    id: 'project-analysis-test',
    name: '分析测试轴',
    time: { fps: 60, durationMs: 3000 },
  };
}

function createSource(role, draft) {
  return {
    role,
    label: role === 'baseline' ? '基准方案' : '当前方案',
    sourceKind: 'workspace-scenario',
    sourceId: role === 'baseline' ? 'scenario-0002' : 'scenario-0001',
    draft: createWorkbenchScenarioDraftSnapshot(draft),
  };
}

function createContributionProjection(actionId) {
  const window = createWindow(actionId);
  return { fullAxis: window, windows: [window] };
}

function createWindow(actionId) {
  return {
    windowId: 'full-axis',
    sectionId: 'full-axis',
    kind: 'axis',
    label: '全轴',
    startMs: 0,
    endMs: 3000,
    durationMs: 3000,
    metrics: {
      enemyHpDelta: 100,
      enemyToughnessDelta: 20,
      selfEnergyDelta: 5,
      effectCoverageMs: 0,
    },
    actors: [],
    actions: [
      {
        actionId,
        name: '普通攻击',
        actorName: '末音',
        enemyHpDelta: 100,
        enemyToughnessDelta: 20,
        selfEnergyDelta: 5,
        hitCount: 1,
        effectEventCount: 0,
        statePointId: 'state-point-1',
        frameIndex: 60,
        timeMs: 1000,
      },
    ],
    effects: [],
    summary: { hitTransactionCount: 1 },
  };
}

function createComparison(actionId) {
  const window = createWindow(actionId);
  return {
    schemaVersion: 2,
    status: 'scenario-comparison-ready',
    windowId: 'full-axis',
    current: {
      label: '当前方案',
      sourceKind: 'current-workbench-project',
      sourceId: 'scenario-0001',
      window,
    },
    baseline: {
      label: '基准方案',
      sourceKind: 'workspace-scenario',
      sourceId: 'scenario-0002',
      window,
    },
    metrics: [],
    actors: [],
    actions: [
      {
        key: actionId,
        currentActionId: actionId,
        baselineActionId: actionId,
        currentName: '普通攻击',
        baselineName: '普通攻击',
        currentStatePointId: 'current-state-point',
        baselineStatePointId: 'baseline-state-point',
        currentFrameIndex: 60,
        baselineFrameIndex: 60,
        metrics: {},
      },
    ],
    effects: [],
    summary: { actionCount: 1 },
  };
}

function createRuntimeOutputs(actionId, prefix) {
  return {
    hitTransactions: {
      transactions: [
        {
          transactionId: `${prefix}-transaction`,
          actionId,
          hitId: 'hit-1',
          actorId: 'actor-109001',
          energyOwnerActorId: 'actor-109001',
          frameIndex: 60,
          timeMs: 1000,
          sourceDeltaIds: [
            `${prefix}-hp`,
            `${prefix}-toughness`,
            `${prefix}-energy`,
          ],
          delta: { enemyHp: 100, enemyToughness: 20, selfEnergy: 5 },
        },
      ],
    },
  };
}
