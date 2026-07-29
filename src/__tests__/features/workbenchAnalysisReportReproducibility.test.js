import { describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { createWorkbenchActionDraft } from '../../domain/workbenchProjectFactory';
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

const PANGPANG_CHARACTER_ID = 101007;
const PANGPANG_SKILL_ID = 10100701;
const PANGPANG_MAPPING = verifiedCombatMechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === PANGPANG_CHARACTER_ID &&
    mapping.actionKind === 'normal-attack'
);
const PANGPANG_A3 = PANGPANG_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 3
);
const PANGPANG_HIT_IDENTITY = PANGPANG_A3.selectedHitIdentities[0];
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

  it('replays sampled policy, seed, hit overrides, events, rolls, and canonical hash through the same core', () => {
    installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
    try {
      const source = createSource('current', draft => {
        draft.mechanicsProfileSelection =
          createVerifiedWorkbenchMechanicsProfileSelection();
        draft.combatScenario = {
          projectile: { targetDistance: 0, defaultWillHit: true },
          critical: {
            policy: 'sampled',
            seed: 'analysis-report-seed',
          },
        };
        draft.actionDrafts = [
          createWorkbenchActionDraft({
            id: 'analysis-pangpang-a3',
            type: 'skill',
            actorCharacterId: PANGPANG_CHARACTER_ID,
            skillId: PANGPANG_SKILL_ID,
            actionVariantIndex: 0,
            startMs: 0,
            durationMs: (PANGPANG_A3.durationFrames * 1000) / 60,
            durationFrames: PANGPANG_A3.durationFrames,
            attackGroupId: 'analysis-pangpang-chain',
            attackSequenceIndex: PANGPANG_A3.sequenceIndex,
            attackSequenceTotal: PANGPANG_A3.sequenceTotal,
            attackInput: PANGPANG_A3,
            actionScheduling: PANGPANG_A3.actionScheduling,
            hitOverrides: {
              [PANGPANG_HIT_IDENTITY]: {
                willHit: true,
                criticalPolicy: 'sampled',
              },
            },
          }),
        ];
        draft.selectedActionId = 'analysis-pangpang-a3';
      });
      const original = replayWorkbenchAnalysisReportSource(source, {
        durationMs: 30000,
      });
      const report = createWorkbenchContributionAnalysisReport({
        project: original.project,
        source: createReportSourceInput(source),
        contributionProjection: original.contributionProjection,
        runtimeOutputs: original.runtimeOutputs,
        exportedAt: '2026-07-29T00:00:00.000Z',
      });
      const replayed = replayWorkbenchAnalysisReportSource(report.sources[0], {
        durationMs: 30000,
      });
      const audit = auditWorkbenchAnalysisReportReproducibility(report);
      const originalBranch =
        original.canonicalRun.trace.damage[0].formula.randomBranch;
      const replayedBranch =
        replayed.canonicalRun.trace.damage[0].formula.randomBranch;

      expect(original.scenario.combatScenario.critical).toMatchObject({
        policy: 'sampled',
        seed: 'analysis-report-seed',
      });
      expect(replayed.scenario.combatScenario.critical).toEqual(
        original.scenario.combatScenario.critical
      );
      expect(replayedBranch).toEqual(originalBranch);
      expect(replayed.canonicalRun.trace).toEqual(original.canonicalRun.trace);
      expect(replayed.canonicalRun.traceHash).toBe(
        original.canonicalRun.traceHash
      );
      expect(audit).toMatchObject({
        status: WORKBENCH_ANALYSIS_REPRODUCIBILITY_STATUSES.EXACT,
        sources: [
          {
            role: 'current',
            canonicalInputHash: original.canonicalRun.inputHash,
            canonicalTraceHash: original.canonicalRun.traceHash,
            criticalPolicy: 'sampled',
            criticalSeed: 'analysis-report-seed',
          },
        ],
      });
    } finally {
      clearInstalledVerifiedCombatMechanicsPackage();
    }
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
