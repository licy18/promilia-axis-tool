import {
  WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION,
  WORKBENCH_ANALYSIS_REPORT_TYPE,
  validateWorkbenchAnalysisReport,
} from './workbenchAnalysisReport';
import { decodeBase64Url, encodeBase64Url } from '../utils/base64Url';
import { addPngTextMetadata, readPngTextMetadata } from '../utils/pngMetadata';

export const WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY =
  'PromiliaAxisAnalysisReport';
export const WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_TYPE =
  'workbench-analysis-report-png';
export const WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_SCHEMA_VERSION = 1;
export const WORKBENCH_ANALYSIS_REPORT_PNG_PAYLOAD_ENCODING = 'base64url-json';

export function createWorkbenchAnalysisReportPngMetadata(report) {
  const validated = validateWorkbenchAnalysisReport(report);
  if (!validated) {
    throw new Error('Invalid Workbench analysis report');
  }
  const normalizedReport = validated.report;
  return {
    schemaVersion: WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_TYPE,
    exportedAt: normalizedReport.exportedAt,
    reportSchemaVersion: WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION,
    reportType: WORKBENCH_ANALYSIS_REPORT_TYPE,
    analysisKind: normalizedReport.analysisKind,
    sourceCount: normalizedReport.summary.sourceCount,
    actionReferenceCount: normalizedReport.summary.actionReferenceCount,
    payloadEncoding: WORKBENCH_ANALYSIS_REPORT_PNG_PAYLOAD_ENCODING,
    payload: encodeBase64Url(JSON.stringify(normalizedReport)),
  };
}

export function serializeWorkbenchAnalysisReportPngMetadata(metadata) {
  if (!isWorkbenchAnalysisReportPngMetadata(metadata)) {
    throw new Error('Invalid Workbench analysis report PNG metadata');
  }
  return JSON.stringify(metadata);
}

export async function embedWorkbenchAnalysisReportInPng(pngSource, metadata) {
  return addPngTextMetadata(
    pngSource,
    WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY,
    serializeWorkbenchAnalysisReportPngMetadata(metadata)
  );
}

export async function parseWorkbenchAnalysisReportPng(pngSource) {
  try {
    const rawMetadata = await readPngTextMetadata(
      pngSource,
      WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_KEY
    );
    if (!rawMetadata) return null;
    const metadata = JSON.parse(rawMetadata);
    if (!isWorkbenchAnalysisReportPngMetadata(metadata)) return null;
    const validated = validateWorkbenchAnalysisReport(
      decodeBase64Url(metadata.payload)
    );
    if (!validated) return null;
    return { ...validated, metadata };
  } catch {
    return null;
  }
}

export function createWorkbenchAnalysisReportPngFileName(
  metadata,
  now = new Date()
) {
  const dateText =
    String(metadata?.exportedAt ?? '').slice(0, 10) ||
    now.toISOString().slice(0, 10);
  const kind =
    metadata?.analysisKind === 'scenario-comparison'
      ? 'comparison'
      : 'contribution';
  const actionCount = Math.max(0, Number(metadata?.actionReferenceCount) || 0);
  return `promilia-analysis-${kind}-${dateText}-${actionCount}actions.png`;
}

function isWorkbenchAnalysisReportPngMetadata(metadata) {
  return (
    metadata?.schemaVersion ===
      WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_SCHEMA_VERSION &&
    metadata?.game === 'azur-promilia' &&
    metadata?.type === WORKBENCH_ANALYSIS_REPORT_PNG_METADATA_TYPE &&
    metadata?.reportSchemaVersion ===
      WORKBENCH_ANALYSIS_REPORT_SCHEMA_VERSION &&
    metadata?.reportType === WORKBENCH_ANALYSIS_REPORT_TYPE &&
    metadata?.payloadEncoding ===
      WORKBENCH_ANALYSIS_REPORT_PNG_PAYLOAD_ENCODING &&
    typeof metadata?.payload === 'string' &&
    metadata.payload.length > 0
  );
}
