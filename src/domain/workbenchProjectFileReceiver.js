import { parseWorkbenchProjectFile } from './workbenchDraftStorage';
import { parseWorkbenchProjectPng } from './workbenchPngProject';
import { parseWorkbenchRuntimeSampleCaptureFile } from './workbenchRuntimeSampleCapture';
import { validateWorkbenchAnalysisReport } from './workbenchAnalysisReport';
import { isPngSource } from '../utils/pngMetadata';

export const WORKBENCH_PROJECT_FILE_RESULT_KINDS = Object.freeze({
  PROJECT: 'project',
  ANALYSIS_REPORT: 'analysis-report',
  RUNTIME_CAPTURE: 'runtime-capture',
  INVALID: 'invalid',
});

export const WORKBENCH_PROJECT_FILE_SOURCE_KINDS = Object.freeze({
  JSON: 'json',
  PNG: 'png',
});

export async function receiveWorkbenchProjectFile(
  file,
  { allowRuntimeCapture = true, source = 'picker' } = {}
) {
  if (!file || typeof file.text !== 'function') {
    return createInvalidResult('missing-file');
  }

  const fileName = String(file.name ?? '');
  const png = await isWorkbenchProjectPngFile(file);
  if (png) {
    const draft = await parseWorkbenchProjectPng(file);
    return draft
      ? {
          kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.PROJECT,
          sourceKind: WORKBENCH_PROJECT_FILE_SOURCE_KINDS.PNG,
          fileName,
          draft,
          statusText:
            source === 'drop' ? '已从拖放恢复 PNG 项目' : '已从 PNG 导入项目',
        }
      : createInvalidResult('png-metadata-missing', fileName);
  }

  if (source !== 'picker' && !isWorkbenchProjectTextFile(file)) {
    return createInvalidResult('unsupported-file', fileName);
  }

  const rawFile = await file.text();
  const draft = parseWorkbenchProjectFile(rawFile);
  if (draft) {
    return {
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.PROJECT,
      sourceKind: WORKBENCH_PROJECT_FILE_SOURCE_KINDS.JSON,
      fileName,
      draft,
      statusText: source === 'drop' ? '已从拖放恢复 JSON 项目' : '已导入项目',
    };
  }

  const analysisReport = validateWorkbenchAnalysisReport(rawFile);
  if (analysisReport) {
    return {
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.ANALYSIS_REPORT,
      sourceKind: WORKBENCH_PROJECT_FILE_SOURCE_KINDS.JSON,
      fileName,
      ...analysisReport,
      statusText: source === 'drop' ? '已从拖放打开分析报告' : '已打开分析报告',
    };
  }

  if (allowRuntimeCapture) {
    const runtimeSampleFile = parseWorkbenchRuntimeSampleCaptureFile(rawFile);
    if (runtimeSampleFile) {
      return {
        kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.RUNTIME_CAPTURE,
        sourceKind: WORKBENCH_PROJECT_FILE_SOURCE_KINDS.JSON,
        fileName,
        captures: runtimeSampleFile.captures,
      };
    }
  }

  return createInvalidResult('invalid-project', fileName);
}

export async function processWorkbenchProjectFile(
  file,
  {
    source = 'picker',
    onProject = () => {},
    onAnalysisReport = () => {},
    onRuntimeCapture = () => {},
    onStatus = () => {},
  } = {}
) {
  try {
    const result = await receiveWorkbenchProjectFile(file, { source });
    if (result.kind === WORKBENCH_PROJECT_FILE_RESULT_KINDS.PROJECT) {
      const accepted = await onProject(result.draft, result.statusText);
      return accepted !== false;
    }
    if (result.kind === WORKBENCH_PROJECT_FILE_RESULT_KINDS.ANALYSIS_REPORT) {
      const accepted = await onAnalysisReport(
        result.report,
        result.validation,
        result.statusText
      );
      return accepted !== false;
    }
    if (result.kind === WORKBENCH_PROJECT_FILE_RESULT_KINDS.RUNTIME_CAPTURE) {
      await onRuntimeCapture(result.captures);
      return true;
    }
    onStatus(result.statusText);
  } catch {
    onStatus('导入失败');
  }
  return false;
}

export function isWorkbenchProjectTextFile(file) {
  const fileName = String(file?.name ?? '').toLowerCase();
  const mimeType = String(file?.type ?? '').toLowerCase();
  return (
    fileName.endsWith('.json') ||
    fileName.endsWith('.jsonl') ||
    fileName.endsWith('.ndjson') ||
    mimeType === 'application/json' ||
    mimeType === 'application/x-ndjson' ||
    mimeType === 'application/ndjson'
  );
}

export function createWorkbenchProjectDropController({
  target = globalThis.window,
  onActiveChange = () => {},
  onFiles = () => {},
} = {}) {
  let dragDepth = 0;
  let mounted = false;

  function setActive(active) {
    onActiveChange(Boolean(active));
  }

  function reset() {
    dragDepth = 0;
    setActive(false);
  }

  function hasFiles(event) {
    return Array.from(event?.dataTransfer?.types ?? []).includes('Files');
  }

  function onDragEnter(event) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
    setActive(true);
  }

  function onDragLeave(event) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setActive(false);
  }

  function onDragOver(event) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }

  function onDrop(event) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    reset();
    void onFiles(files);
  }

  function mount() {
    if (mounted || !target?.addEventListener) return;
    mounted = true;
    target.addEventListener('dragenter', onDragEnter);
    target.addEventListener('dragleave', onDragLeave);
    target.addEventListener('dragover', onDragOver);
    target.addEventListener('drop', onDrop);
    target.addEventListener('blur', reset);
  }

  function unmount() {
    if (!mounted || !target?.removeEventListener) return;
    mounted = false;
    target.removeEventListener('dragenter', onDragEnter);
    target.removeEventListener('dragleave', onDragLeave);
    target.removeEventListener('dragover', onDragOver);
    target.removeEventListener('drop', onDrop);
    target.removeEventListener('blur', reset);
    reset();
  }

  return { mount, unmount, reset };
}

async function isWorkbenchProjectPngFile(file) {
  const fileName = String(file?.name ?? '').toLowerCase();
  const mimeType = String(file?.type ?? '').toLowerCase();
  return (
    mimeType === 'image/png' ||
    fileName.endsWith('.png') ||
    (await isPngSource(file))
  );
}

function createInvalidResult(reason, fileName = '') {
  return {
    kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.INVALID,
    reason,
    fileName,
    statusText:
      reason === 'png-metadata-missing'
        ? 'PNG 中没有有效项目'
        : reason === 'unsupported-file'
          ? '仅支持 JSON 分析/项目文件或 PNG 项目'
          : '导入失败',
  };
}
