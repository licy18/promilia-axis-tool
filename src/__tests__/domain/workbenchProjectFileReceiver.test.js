import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchProjectFileSnapshot,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
} from '../../domain/workbenchPngProject';
import {
  WORKBENCH_PROJECT_FILE_RESULT_KINDS,
  createWorkbenchProjectDropController,
  receiveWorkbenchProjectFile,
} from '../../domain/workbenchProjectFileReceiver';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Workbench project file receiver', () => {
  it('receives a versioned JSON project through the existing parser', async () => {
    const snapshot = createWorkbenchProjectFileSnapshot(
      createDefaultWorkbenchDraftState(),
      '2026-07-11T00:00:00.000Z'
    );
    const result = await receiveWorkbenchProjectFile(
      new File([JSON.stringify(snapshot)], 'axis.promilia-workbench.json', {
        type: 'application/json',
      })
    );

    expect(result).toMatchObject({
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.PROJECT,
      sourceKind: 'json',
      fileName: 'axis.promilia-workbench.json',
      draft: { actionDrafts: snapshot.actionDrafts },
    });
    await expect(
      receiveWorkbenchProjectFile(new File([JSON.stringify(snapshot)], 'tmp'), {
        source: 'picker',
      })
    ).resolves.toMatchObject({
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.PROJECT,
      sourceKind: 'json',
    });
  });

  it('receives a PNG project through embedded metadata', async () => {
    const draft = createDefaultWorkbenchDraftState();
    draft.enemyConfig.level = 93;
    const png = await embedWorkbenchProjectInPng(
      createOnePixelPng(),
      createWorkbenchProjectPngMetadata(draft, '2026-07-11T00:00:00.000Z')
    );
    const result = await receiveWorkbenchProjectFile(
      new File([png], 'axis.png', { type: 'image/png' })
    );

    expect(result).toMatchObject({
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.PROJECT,
      sourceKind: 'png',
      draft: { enemyConfig: { level: 93 } },
    });
  });

  it('keeps runtime capture JSONL available through the same receiver', async () => {
    const capture = createRecoverSpRuntimeSampleFixture();
    const result = await receiveWorkbenchProjectFile(
      new File(
        [
          JSON.stringify({
            schemaVersion: 1,
            game: 'azur-promilia',
            type: 'runtime-sample-captures',
            captures: [capture],
          }),
        ],
        'capture.jsonl',
        { type: 'application/x-ndjson' }
      )
    );

    expect(result.kind).toBe(
      WORKBENCH_PROJECT_FILE_RESULT_KINDS.RUNTIME_CAPTURE
    );
    expect(result.captures).toHaveLength(1);
  });

  it('rejects unsupported or invalid files without producing a draft', async () => {
    await expect(
      receiveWorkbenchProjectFile(
        new File(['not a project'], 'notes.txt', { type: 'text/plain' }),
        { source: 'drop' }
      )
    ).resolves.toMatchObject({
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.INVALID,
      reason: 'unsupported-file',
    });
    await expect(
      receiveWorkbenchProjectFile(
        new File(['{}'], 'empty.json', { type: 'application/json' })
      )
    ).resolves.toMatchObject({
      kind: WORKBENCH_PROJECT_FILE_RESULT_KINDS.INVALID,
      reason: 'invalid-project',
    });
  });

  it('tracks external file drag depth and forwards dropped files once', () => {
    const target = createEventTarget();
    const activeStates = [];
    const drops = [];
    const file = new File(['{}'], 'axis.json', { type: 'application/json' });
    const controller = createWorkbenchProjectDropController({
      target,
      onActiveChange: active => activeStates.push(active),
      onFiles: files => drops.push(files),
    });
    const dataTransfer = { types: ['Files'], files: [file], dropEffect: 'none' };

    controller.mount();
    target.dispatch('dragenter', createDragEvent(dataTransfer));
    target.dispatch('dragenter', createDragEvent(dataTransfer));
    target.dispatch('dragleave', createDragEvent(dataTransfer));
    expect(activeStates.at(-1)).toBe(true);
    target.dispatch('dragover', createDragEvent(dataTransfer));
    expect(dataTransfer.dropEffect).toBe('copy');
    target.dispatch('drop', createDragEvent(dataTransfer));

    expect(activeStates.at(-1)).toBe(false);
    expect(drops).toEqual([[file]]);
    controller.unmount();
    expect(target.listenerCount()).toBe(0);
  });
});

function createOnePixelPng() {
  return new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));
}

function createEventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type, event) {
      listeners.get(type)?.(event);
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

function createDragEvent(dataTransfer) {
  return { dataTransfer, preventDefault() {} };
}
