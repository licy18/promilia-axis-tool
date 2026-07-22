import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchScenarioDraftSnapshot,
  WORKBENCH_DRAFT_SCHEMA_VERSION,
} from '../../domain/workbenchDraftStorage';
import { createWorkbenchActionDraft } from '../../domain/workbenchProjectFactory';
import {
  WORKBENCH_PNG_METADATA_KEY,
  createWorkbenchProjectPngFileName,
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
  serializeWorkbenchProjectPngMetadata,
} from '../../domain/workbenchPngProject';
import {
  addPngTextMetadata,
  isPngSource,
  readPngTextMetadata,
} from '../../utils/pngMetadata';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Workbench PNG project', () => {
  it('writes and reads a validated PNG tEXt chunk', async () => {
    const source = createOnePixelPng();

    const png = await addPngTextMetadata(source, 'TestData', 'payload-123');

    expect(png.type).toBe('image/png');
    expect(await isPngSource(png)).toBe(true);
    expect(await readPngTextMetadata(png, 'TestData')).toBe('payload-123');
    expect(await readPngTextMetadata(png, 'MissingData')).toBeNull();
  });

  it('round-trips the existing Workbench project contract through PNG metadata', async () => {
    const state = createDefaultWorkbenchDraftState();
    state.actionDrafts.push(
      createWorkbenchActionDraft({
        id: 'action-0002',
        startMs: 2000,
        skillId: 10900112,
      })
    );
    state.selectedActionId = 'action-0002';
    state.actionDrafts[0].hitOverrides = {
      'control:10900101|hit:2': { willHit: false },
    };
    state.initialRuntimeState = createPngInheritedState();
    state.runtimeSampleCaptures = [
      {
        schemaVersion: 1,
        captureSessionId: 'png-runtime-capture-1',
        events: [
          {
            eventType: 'toughness-damage-applied',
            actionId: 'action-0001',
            toughnessDeltaApplied: 10,
          },
        ],
      },
    ];
    state.scenarioWorkspace.scenarios.push({
      id: 'scenario-0002',
      name: 'PNG 对照方案',
      draft: createWorkbenchScenarioDraftSnapshot({
        ...state,
        actionDrafts: [
          createWorkbenchActionDraft({
            id: 'action-png-baseline',
            startMs: 600,
          }),
        ],
        selectedActionId: 'action-png-baseline',
      }),
    });
    const exportedAt = '2026-07-10T10:30:00.000Z';
    const metadata = createWorkbenchProjectPngMetadata(state, exportedAt);

    const png = await embedWorkbenchProjectInPng(createOnePixelPng(), metadata);
    const rawMetadata = await readPngTextMetadata(
      png,
      WORKBENCH_PNG_METADATA_KEY
    );
    const imported = await parseWorkbenchProjectPng(png);

    expect(JSON.parse(rawMetadata)).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'workbench-project-png',
      exportedAt,
      projectSchemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      actionCount: 2,
      payloadEncoding: 'base64url-json',
    });
    expect(imported).toMatchObject({
      schemaVersion: WORKBENCH_DRAFT_SCHEMA_VERSION,
      game: 'azur-promilia',
      type: 'workbench-draft',
      selection: state.selection,
      teamSlots: state.teamSlots,
      enemyConfig: state.enemyConfig,
      selectedActionId: 'action-0002',
      combatScenario: {
        projectile: { targetDistance: 0, defaultWillHit: true },
      },
      initialRuntimeState: {
        source: { sourceScenarioId: 'scenario-png-source' },
        enemy: { hp: { currentValue: 800 } },
      },
      runtimeSampleCaptures: [
        expect.objectContaining({
          captureSessionId: 'png-runtime-capture-1',
        }),
      ],
      scenarioWorkspace: {
        activeScenarioId: 'scenario-0001',
        scenarios: [
          { id: 'scenario-0001' },
          {
            id: 'scenario-0002',
            name: 'PNG 对照方案',
            draft: { selectedActionId: 'action-png-baseline' },
          },
        ],
      },
    });
    expect(imported.actionDrafts.map(action => action.id)).toEqual([
      'action-0001',
      'action-0002',
    ]);
    expect(imported.actionDrafts[0].hitOverrides).toEqual({
      'control:10900101|hit:2': { willHit: false },
    });
    expect(createWorkbenchProjectPngFileName(metadata)).toBe(
      'promilia-workbench-2026-07-10-2actions.png'
    );
  });

  it('rejects PNG files without valid Promilia project metadata', async () => {
    const plainPng = createOnePixelPng();
    const invalidMetadataPng = await addPngTextMetadata(
      plainPng,
      WORKBENCH_PNG_METADATA_KEY,
      '{"schemaVersion":1,"type":"wrong-project"}'
    );

    expect(await parseWorkbenchProjectPng(plainPng)).toBeNull();
    expect(await parseWorkbenchProjectPng(invalidMetadataPng)).toBeNull();
    expect(() =>
      serializeWorkbenchProjectPngMetadata({ schemaVersion: 1 })
    ).toThrow('Invalid Workbench PNG metadata');
  });

  it('rejects corrupted PNG chunk data instead of importing partial metadata', async () => {
    const metadata = createWorkbenchProjectPngMetadata(
      createDefaultWorkbenchDraftState(),
      '2026-07-10T10:30:00.000Z'
    );
    const png = await embedWorkbenchProjectInPng(createOnePixelPng(), metadata);
    const bytes = new Uint8Array(await png.arrayBuffer());
    bytes[bytes.length - 20] ^= 0xff;

    await expect(
      readPngTextMetadata(bytes, WORKBENCH_PNG_METADATA_KEY)
    ).rejects.toThrow(/CRC mismatch/);
    expect(await parseWorkbenchProjectPng(bytes)).toBeNull();
  });
});

function createOnePixelPng() {
  return new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64'));
}

function createPngInheritedState() {
  return {
    source: {
      sourceScenarioId: 'scenario-png-source',
      boundaryId: 'boundary-png-source',
      boundaryTimeMs: 1200,
    },
    enemy: {
      enemyId: 'enemy-300032',
      hp: { currentValue: 800, maxValue: 1000 },
      toughness: { currentValue: 50, maxValue: 100 },
    },
  };
}
