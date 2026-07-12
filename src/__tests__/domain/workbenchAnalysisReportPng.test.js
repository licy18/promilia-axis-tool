import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { createWorkbenchContributionAnalysisReport } from '../../domain/workbenchAnalysisReport';
import {
  WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY,
  createWorkbenchAnalysisReportPngFileName,
  createWorkbenchAnalysisReportPngMetadata,
  embedWorkbenchAnalysisReportInPng,
  parseWorkbenchAnalysisReportPng,
  serializeWorkbenchAnalysisReportPngMetadata,
} from '../../domain/workbenchAnalysisReportPng';
import { createDefaultWorkbenchDraftState } from '../../domain/workbenchDraftStorage';
import {
  addPngTextMetadata,
  readPngTextMetadata,
} from '../../utils/pngMetadata';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Workbench analysis report PNG', () => {
  it('round-trips a validated report through PNG metadata', async () => {
    const report = createReport();
    const metadata = createWorkbenchAnalysisReportPngMetadata(report);
    const png = await embedWorkbenchAnalysisReportInPng(
      createOnePixelPng(),
      metadata
    );
    const rawMetadata = await readPngTextMetadata(
      png,
      WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY
    );
    const imported = await parseWorkbenchAnalysisReportPng(png);

    expect(JSON.parse(rawMetadata)).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'workbench-analysis-report-png',
      reportSchemaVersion: 1,
      reportType: 'workbench-analysis-report',
      analysisKind: 'contribution-window',
      sourceCount: 1,
      actionReferenceCount: 1,
      payloadEncoding: 'base64url-json',
    });
    expect(imported).toMatchObject({
      report: {
        title: '当前方案 · 全轴',
        analysisKind: 'contribution-window',
      },
      validation: {
        status: 'valid',
        appliedTransactionCount: 1,
      },
      metadata: { actionReferenceCount: 1 },
    });
    expect(createWorkbenchAnalysisReportPngFileName(metadata)).toBe(
      'promilia-analysis-contribution-2026-07-12-1actions.png'
    );
  });

  it('rejects absent, invalid, or drifted report metadata', async () => {
    const plainPng = createOnePixelPng();
    const invalidMetadataPng = await addPngTextMetadata(
      plainPng,
      WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY,
      JSON.stringify({ schemaVersion: 99 })
    );
    const metadata = createWorkbenchAnalysisReportPngMetadata(createReport());
    const driftedMetadataPng = await addPngTextMetadata(
      plainPng,
      WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY,
      JSON.stringify({ ...metadata, payload: 'invalid-payload' })
    );

    expect(await parseWorkbenchAnalysisReportPng(plainPng)).toBeNull();
    expect(
      await parseWorkbenchAnalysisReportPng(invalidMetadataPng)
    ).toBeNull();
    expect(
      await parseWorkbenchAnalysisReportPng(driftedMetadataPng)
    ).toBeNull();
    expect(() =>
      serializeWorkbenchAnalysisReportPngMetadata({ schemaVersion: 99 })
    ).toThrow('Invalid Workbench analysis report PNG metadata');
    expect(() =>
      createWorkbenchAnalysisReportPngMetadata({ type: 'invalid' })
    ).toThrow('Invalid Workbench analysis report');
  });
});

function createReport() {
  const draft = createDefaultWorkbenchDraftState();
  const actionId = draft.actionDrafts[0].id;
  const window = {
    sectionId: 'full-axis',
    windowId: 'full-axis',
    kind: 'axis',
    label: '全轴',
    startMs: 0,
    endMs: 1000,
    durationMs: 1000,
    metrics: {
      enemyHpDelta: 100,
      enemyToughnessDelta: 10,
      selfEnergyDelta: 5,
      effectCoverageMs: 0,
    },
    actors: [],
    actions: [
      {
        actionId,
        name: '普通攻击',
        statePointId: 'state-point-1',
        frameIndex: 0,
      },
    ],
    effects: [],
    summary: { hitTransactionCount: 1 },
  };
  return createWorkbenchContributionAnalysisReport({
    project: {
      schemaVersion: 1,
      id: 'analysis-png-project',
      name: '分析 PNG',
      time: { fps: 60, durationMs: 1000 },
    },
    source: {
      label: '当前方案',
      sourceKind: 'workspace-scenario',
      sourceId: 'scenario-0001',
      draft,
    },
    contributionProjection: { fullAxis: window, windows: [window] },
    runtimeOutputs: {
      hitTransactions: {
        transactions: [
          {
            transactionId: 'transaction-1',
            actionId,
            timeMs: 0,
            frameIndex: 0,
            sourceDeltaIds: ['delta-1'],
            delta: { enemyHp: 100, enemyToughness: 10, selfEnergy: 5 },
          },
        ],
      },
    },
    exportedAt: '2026-07-12T12:00:00.000Z',
  });
}

function createOnePixelPng() {
  return new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));
}
