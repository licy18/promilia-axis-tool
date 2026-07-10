import {
  createWorkbenchProjectFileSnapshot,
  createWorkbenchProjectShareCode,
  parseWorkbenchProjectShareCode,
} from './workbenchDraftStorage';
import { addPngTextMetadata, readPngTextMetadata } from '../utils/pngMetadata';

export const WORKBENCH_PNG_METADATA_KEY = 'PromiliaAxisToolData';
export const WORKBENCH_PNG_METADATA_TYPE = 'workbench-project-png';
export const WORKBENCH_PNG_METADATA_SCHEMA_VERSION = 1;
export const WORKBENCH_PNG_PAYLOAD_ENCODING = 'base64url-json';

export function createWorkbenchProjectPngMetadata(
  state,
  exportedAt = new Date().toISOString()
) {
  const projectSnapshot = createWorkbenchProjectFileSnapshot(state, exportedAt);
  return {
    schemaVersion: WORKBENCH_PNG_METADATA_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: WORKBENCH_PNG_METADATA_TYPE,
    exportedAt,
    projectSchemaVersion: projectSnapshot.schemaVersion,
    actionCount: projectSnapshot.actionDrafts.length,
    payloadEncoding: WORKBENCH_PNG_PAYLOAD_ENCODING,
    payload: createWorkbenchProjectShareCode(state, exportedAt),
  };
}

export function serializeWorkbenchProjectPngMetadata(metadata) {
  if (!isWorkbenchProjectPngMetadata(metadata)) {
    throw new Error('Invalid Workbench PNG metadata');
  }
  return JSON.stringify(metadata);
}

export async function embedWorkbenchProjectInPng(pngSource, metadata) {
  return addPngTextMetadata(
    pngSource,
    WORKBENCH_PNG_METADATA_KEY,
    serializeWorkbenchProjectPngMetadata(metadata)
  );
}

export async function parseWorkbenchProjectPng(pngSource) {
  try {
    const rawMetadata = await readPngTextMetadata(
      pngSource,
      WORKBENCH_PNG_METADATA_KEY
    );
    if (!rawMetadata) {
      return null;
    }

    const metadata = JSON.parse(rawMetadata);
    if (!isWorkbenchProjectPngMetadata(metadata)) {
      return null;
    }
    return parseWorkbenchProjectShareCode(metadata.payload);
  } catch {
    return null;
  }
}

export function createWorkbenchProjectPngFileName(metadata, now = new Date()) {
  const dateText =
    String(metadata?.exportedAt ?? '').slice(0, 10) ||
    now.toISOString().slice(0, 10);
  const actionCount = Math.max(0, Number(metadata?.actionCount) || 0);
  return `promilia-workbench-${dateText}-${actionCount}actions.png`;
}

function isWorkbenchProjectPngMetadata(metadata) {
  return (
    metadata?.schemaVersion === WORKBENCH_PNG_METADATA_SCHEMA_VERSION &&
    metadata?.game === 'azur-promilia' &&
    metadata?.type === WORKBENCH_PNG_METADATA_TYPE &&
    metadata?.payloadEncoding === WORKBENCH_PNG_PAYLOAD_ENCODING &&
    typeof metadata?.payload === 'string' &&
    metadata.payload.length > 0
  );
}
