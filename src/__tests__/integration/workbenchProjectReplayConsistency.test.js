import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchScenarioDraftSnapshot,
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
import { getWorkbenchGameDataCompatibilityReport } from '../../domain/workbenchGameDataCatalog';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../../domain/workbenchPngProject';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createToughnessRuntimeSampleFixture } from '../../simulation/fixtures/toughnessRuntimeSampleFixture';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE } from '../../simulation/mechanics/threeValueMechanicsProfile';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const EXPORTED_AT = '2026-07-11T15:00:00.000Z';
const REPLAY_PROFILE = {
  ...JSON.parse(JSON.stringify(DEFAULT_THREE_VALUE_MECHANICS_PROFILE)),
  profileId: 'azpr-replay-equivalent-v1',
  profileVersion: 3,
  sourceKind: 'integration-replay-equivalent-profile',
};

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
        requestedInstanceCount: 4,
        verifiedInstanceCount: 4,
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
        profileId: 'azpr-replay-equivalent-v1',
        profileVersion: 3,
        replaceable: true,
      },
      gameData: {
        catalogId: 'azpr-workbench-game-data',
        catalogVersion: 1,
        dataVersion: sourceState.gameDataBinding.dataVersion,
        referenceIdentity: baseline.gameDataReferenceContract.referenceIdentity,
        ready: true,
        replaceable: true,
      },
    });
    expect(baseline.gameDataReferenceContract).toMatchObject({
      schemaVersion: 2,
      contractName: 'AzPrWorkbenchGameDataReference',
      contractVersion: 2,
      status: 'workbench-game-data-reference-ready',
      ready: true,
      referenceIdentity: expect.stringMatching(/^azpr-game-data-v1-/u),
      catalog: {
        catalogId: 'azpr-workbench-game-data',
        catalogVersion: 1,
        dataVersion: sourceState.gameDataBinding.dataVersion,
      },
      policy: {
        resolvedCatalogRecordsOnly: true,
        loadoutEffectsAppliedToCalculators: false,
        actionSkillReferencesRequired: true,
      },
      actions: expect.arrayContaining([
        expect.objectContaining({
          actionId: sourceState.actionDrafts[0].id,
          referenceIdentity: expect.stringMatching(/^azpr-action-skill-v1-/u),
          skillVariantReferenceIdentity: expect.stringMatching(
            /^azpr-skill-variant-v1-/u
          ),
          ready: true,
          skill: expect.objectContaining({
            status: 'exact',
            record: expect.objectContaining({
              id: sourceState.actionDrafts[0].skillId,
            }),
            variant: expect.objectContaining({
              index: sourceState.actionDrafts[0].actionVariantIndex,
              multiplier: expect.any(Number),
            }),
          }),
        }),
      ]),
    });
    expect(baseline.gameDataCompatibility).toMatchObject({
      status: 'workbench-game-data-compatibility-exact',
      compatible: true,
      importAllowed: true,
    });
    expect(baseline.runtimeSummary).toMatchObject({
      runtimeConfigurationReplayIdentities: [
        baseline.configurationSourceContract.replayIdentity,
      ],
      configurationRuntimeBindingReadyInvocationCount: 3,
      configurationRuntimeBindingMissingInvocationCount: 0,
      operandSourceBindingRequiredInvocationCount: 3,
      operandSourceBindingReadyInvocationCount: 3,
      operandSourceBindingInvalidInvocationCount: 0,
      operandSourceBindingCompatibleUnboundInvocationCount: 0,
      operandSourceBindingStates: ['bound-ready'],
      operandSourceBindingKinds: [
        'explicit-self-energy-events',
        'hp-skill-variant-operands',
        'validated-runtime-sample',
      ],
      enemyHpDelta: expect.any(Number),
      enemyToughnessDelta: 70,
      selfEnergyDelta: 0.25,
    });
    expect(baseline.appliedSourceBindings).toHaveLength(3);
    expect(baseline.appliedSourceBindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trackKey: 'enemyHpDamage',
          state: 'bound-ready',
          kind: 'hp-skill-variant-operands',
          identity: expect.stringMatching(/^azpr-skill-variant-v1-/u),
        }),
        expect.objectContaining({
          trackKey: 'enemyToughnessDamage',
          state: 'bound-ready',
          kind: 'validated-runtime-sample',
          identity: expect.stringMatching(/^azpr-applied-source-v1-/u),
        }),
        expect.objectContaining({
          trackKey: 'selfEnergyChange',
          state: 'bound-ready',
          kind: 'explicit-self-energy-events',
          identity: expect.stringMatching(/^azpr-applied-source-v1-/u),
        }),
      ])
    );
    expect(baseline.actionRelations).toEqual([
      expect.objectContaining({
        id: 'relation-0001',
        fromActionId: sourceState.actionDrafts[0].id,
        toActionId: 'action-kibo',
      }),
    ]);
    expect(baseline.mechanicsProfileSelection).toMatchObject({
      sourceKind: 'project-persisted-mechanics-profile-selection',
      requestedProfileId: 'azpr-replay-equivalent-v1',
      requestedProfileVersion: 3,
      resolvedProfileId: 'azpr-replay-equivalent-v1',
      resolvedProfileVersion: 3,
      fallback: false,
    });
    expect(
      baseline.workspaceScenarios.map(item => [
        item.scenarioId,
        item.requestedProfileId,
        item.resolvedProfileId,
      ])
    ).toEqual([
      [
        'scenario-0001',
        'azpr-replay-equivalent-v1',
        'azpr-replay-equivalent-v1',
      ],
      [
        'scenario-0002',
        'azpr-three-value-preview-v1',
        'azpr-three-value-preview-v1',
      ],
    ]);
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
  state.actionDrafts.push({
    id: 'action-kibo',
    type: 'kiboEvent',
    actorCharacterId: state.selection.characterId,
    startMs: 1800,
    durationMs: 600,
    eventType: 'activation',
    note: 'replay-kibo-event',
  });
  state.actionRelations = [
    {
      id: 'relation-0001',
      fromActionId: state.actionDrafts[0].id,
      toActionId: 'action-kibo',
    },
  ];
  state.runtimeSampleCaptures = [
    createToughnessRuntimeSampleFixture({
      actionId: state.actionDrafts[0].id,
      toughnessDeltaApplied: 70,
    }),
  ];
  state.mechanicsProfileSelection = {
    schemaVersion: 1,
    contractName: 'AzPrWorkbenchMechanicsProfileSelection',
    profileId: REPLAY_PROFILE.profileId,
    profileVersion: REPLAY_PROFILE.profileVersion,
  };
  state.scenarioWorkspace.scenarios.push({
    id: 'scenario-0002',
    name: '默认机制方案',
    draft: createWorkbenchScenarioDraftSnapshot({
      ...state,
      mechanicsProfileSelection: null,
    }),
  });
  return state;
}

function createReplaySignature(draft) {
  const active = createScenarioReplaySignature(
    draft,
    draft.configurationLibrary
  );
  return {
    ...active,
    workspaceScenarios: draft.scenarioWorkspace.scenarios.map(scenario => {
      const replay = createScenarioReplaySignature(
        scenario.draft,
        draft.configurationLibrary
      );
      return {
        scenarioId: scenario.id,
        requestedProfileId: replay.mechanicsProfileSelection.requestedProfileId,
        resolvedProfileId: replay.mechanicsProfileSelection.resolvedProfileId,
        runtimeBinding: replay.runtimeBinding,
        runtimeOutputs: replay.runtimeOutputs,
      };
    }),
  };
}

function createScenarioReplaySignature(draft, configurationLibrary) {
  const project = createWorkbenchProject(draft.selection, {
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding,
    gameDataCompatibilityReport: getWorkbenchGameDataCompatibilityReport(draft),
    mechanicsProfileSelection: draft.mechanicsProfileSelection,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
  const scenario = compileProject(project, getWorkbenchGameData(), {
    threeValueMechanicsProfiles: [REPLAY_PROFILE],
  });
  const result = simulateScenario(scenario);
  const runtimeProjection = result.threeValueRuntimeProjection;
  return {
    timelineTopology: scenario.sourceProject.metadata.timelineTopology,
    actionTopology: scenario.actions.map(action => ({
      actionId: action.id,
      type: action.type,
      actorId: action.actorId ?? null,
      kiboId: action.kiboId ?? null,
      startMs: action.startMs,
      durationMs: action.durationMs,
    })),
    actionRelations: project.actionRelations,
    kiboEvents: scenario.actions
      .filter(action => action.type === 'kiboEvent')
      .map(action => ({
        actionId: action.id,
        actorId: action.actorId,
        kiboId: action.kiboId,
        eventType: action.eventType,
        appliedToCalculators: action.appliedToCalculators,
      })),
    kiboSimLog: result.eventLog
      .filter(event => event.type === 'KIBO_EVENT')
      .map(event => ({
        actionId: event.actionId,
        actorId: event.actorId,
        timeMs: event.timeMs,
        payload: event.payload,
      })),
    configurationSourceContract:
      scenario.sourceProject.metadata.configurationSourceContract,
    gameDataReferenceContract:
      scenario.sourceProject.metadata.gameDataReferenceContract,
    gameDataCompatibility: scenario.gameDataCompatibility,
    mechanismConfiguration: scenario.mechanismConfiguration,
    runtimeBinding: scenario.mechanismConfiguration.runtimeBinding,
    mechanicsProfile: scenario.mechanicsProfile,
    mechanicsProfileSelection: scenario.mechanicsProfileSelection,
    stateEffectProposals: runtimeProjection.runtimeAppliedDeltas.map(
      delta => delta.stateEffectProposal
    ),
    appliedSourceBindings: result.threeValueGenerationLayer.deltas
      .filter(delta => delta.applied)
      .map(delta => ({
        sourceDeltaId: delta.id,
        trackKey: delta.trackKey,
        state: delta.appliedSourceBindingState,
        kind: delta.appliedSourceBindingKind,
        identity: delta.appliedSourceBindingIdentity,
        status: delta.appliedSourceBindingStatus,
      })),
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
