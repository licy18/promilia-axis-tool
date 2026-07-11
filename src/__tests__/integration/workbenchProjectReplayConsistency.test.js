import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchProjectShareCode,
  loadWorkbenchDraft,
  parseWorkbenchProjectFile,
  parseWorkbenchProjectShareCode,
  saveWorkbenchDraft,
  serializeWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../../domain/workbenchPngProject';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createToughnessRuntimeSampleFixture } from '../../simulation/fixtures/toughnessRuntimeSampleFixture';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const EXPORTED_AT = '2026-07-11T15:00:00.000Z';

describe('Workbench project replay consistency', () => {
  it('replays the same configuration binding and runtime outputs from every project carrier', async () => {
    const sourceState = createReplaySourceState();
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, sourceState);
    const localDraft = loadWorkbenchDraft(storage);
    const jsonDraft = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(sourceState, EXPORTED_AT)
    );
    const shareDraft = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(sourceState, EXPORTED_AT)
    );
    const pngMetadata = createWorkbenchProjectPngMetadata(
      sourceState,
      EXPORTED_AT
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      pngMetadata
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const replays = [localDraft, jsonDraft, shareDraft, pngDraft].map(
      createReplaySignature
    );
    const baseline = replays[0];

    expect(baseline.configurationSourceContract).toMatchObject({
      contractName: 'AzPrWorkbenchConfigurationSource',
      status: 'configuration-source-contract-ready',
      ready: true,
      replayIdentity: expect.stringMatching(/^azpr-config-v1-/),
      selectionIntegrity: {
        ready: true,
        requestedInstanceCount: 3,
        verifiedInstanceCount: 3,
        issueCount: 0,
      },
    });
    expect(baseline.runtimeBinding).toMatchObject({
      contractName: 'AzPrThreeValueConfigurationRuntimeBinding',
      status: 'configuration-runtime-binding-ready',
      ready: true,
      configurationSource: {
        replayIdentity: baseline.configurationSourceContract.replayIdentity,
        replaceable: true,
      },
      mechanicsProfile: {
        profileId: 'azpr-three-value-preview-v1',
        profileVersion: 1,
        replaceable: true,
      },
    });
    expect(baseline.runtimeSummary).toMatchObject({
      runtimeConfigurationReplayIdentities: [
        baseline.configurationSourceContract.replayIdentity,
      ],
      configurationRuntimeBindingReadyInvocationCount: 3,
      configurationRuntimeBindingMissingInvocationCount: 0,
      enemyHpDelta: expect.any(Number),
      enemyToughnessDelta: 70,
      selfEnergyDelta: 0.25,
    });
    for (const replay of replays.slice(1)) {
      expect(replay).toEqual(baseline);
    }
  });
});

function createReplaySourceState() {
  const state = createDefaultWorkbenchDraftState();
  state.actorConfigs[0].initialSp = 0.35;
  state.actorConfigs[0].loadout.kiboId = 500001;
  state.actorConfigs[1].initialSp = 0.6;
  state.enemyConfig = {
    ...state.enemyConfig,
    level: 95,
    hpMultiplier: 2,
    defenseMultiplier: 1.5,
    toughnessMultiplier: 2,
    initialToughnessRatio: 0.75,
    elementDefenseOverrides: { FIRE_DEFENSE: 0.2 },
  };
  state.actionDrafts.push({
    id: 'action-resource',
    type: 'resource',
    actorCharacterId: state.selection.characterId,
    startMs: 1200,
    durationMs: 1,
    resource: 'sp',
    change: 0.25,
    reason: 'replay-consistency',
  });
  state.runtimeSampleCaptures = [
    createToughnessRuntimeSampleFixture({
      actionId: state.actionDrafts[0].id,
      toughnessDeltaApplied: 70,
    }),
  ];
  return state;
}

function createReplaySignature(draft) {
  const project = createWorkbenchProject(draft.selection, {
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary: draft.configurationLibrary,
    configurationSelection: draft.configurationSelection,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  const result = simulateScenario(scenario);
  const runtimeProjection = result.threeValueRuntimeProjection;
  return {
    configurationSourceContract:
      scenario.sourceProject.metadata.configurationSourceContract,
    mechanismConfiguration: scenario.mechanismConfiguration,
    runtimeBinding: scenario.mechanismConfiguration.runtimeBinding,
    mechanicsProfile: scenario.mechanicsProfile,
    stateEffectProposals: runtimeProjection.runtimeAppliedDeltas.map(
      delta => delta.stateEffectProposal
    ),
    runtimeSummary: runtimeProjection.summary,
    runtimeOutputs: result.runtimeOutputs,
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
