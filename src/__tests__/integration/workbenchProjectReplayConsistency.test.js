import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchDraftSnapshot,
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
import { duplicateWorkbenchScenario } from '../../domain/workbenchScenarioWorkspace';
import { getWorkbenchGameDataCompatibilityReport } from '../../domain/workbenchGameDataCatalog';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../../domain/workbenchPngProject';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';
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
    const sourceState = createWorkbenchDraftSnapshot(
      createReplaySourceState(),
      EXPORTED_AT
    );
    const duplicated = duplicateWorkbenchScenario(
      sourceState.scenarioWorkspace,
      sourceState.scenarioWorkspace.activeScenarioId,
      sourceState
    );
    expect(duplicated.changed).toBe(true);
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
    const duplicatedScenarioReplay = createScenarioReplaySignature(
      duplicated.scenario.draft,
      sourceState.configurationLibrary
    );
    const activeScenarioReplay = createScenarioReplaySignature(
      localDraft,
      localDraft.configurationLibrary
    );

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
      configurationRuntimeBindingReadyInvocationCount: 5,
      configurationRuntimeBindingMissingInvocationCount: 0,
      operandSourceBindingRequiredInvocationCount: 5,
      operandSourceBindingReadyInvocationCount: 5,
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
      selfEnergyDelta: 1.5,
    });
    expect(baseline.appliedSourceBindings).toHaveLength(5);
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
    expect(baseline.runtimeOutputs.actionEffectRelationGraph).toMatchObject({
      contractName: 'AzPrActionEffectRelationGraph',
      summary: {
        sequenceEdgeCount: 1,
        triggerEdgeCount: 1,
        consumeEdgeCount: 1,
        satisfiedEdgeCount: 3,
      },
      edges: expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'effect-relation:replay-effect-apply',
          kind: 'effect-trigger',
          status: 'satisfied',
        }),
        expect.objectContaining({
          edgeId: 'effect-relation:replay-effect-remove',
          kind: 'effect-consume',
          status: 'satisfied',
        }),
      ]),
    });
    expect(baseline.timelineTopology.summary).toMatchObject({
      actorEnergyCurveCount: 3,
      kiboEnergyCurveCount: 3,
      energyCurveCount: 6,
      stateCurveCount: 8,
    });
    expect(
      baseline.configurationSourceContract.actors.map(
        source => source.resolvedConfig.loadout
      )
    ).toEqual(sourceState.actorConfigs.map(config => config.loadout));
    expect(
      baseline.timelineTopology.actorGroups.map(group => [
        group.characterId,
        group.kiboEnergyCurve.kiboId,
      ])
    ).toEqual([
      [sourceState.teamSlots[0].characterId, 500001],
      [sourceState.teamSlots[1].characterId, 500002],
      [sourceState.teamSlots[2].characterId, 500003],
    ]);
    expect(baseline.runtimeOutputs.resources.curvesByKibo).toEqual([
      expect.objectContaining({
        slotId: 'team-slot-1',
        kiboId: 500001,
        pointCount: 1,
        trackingOnly: true,
        appliedToCalculators: false,
        stateMetric: expect.objectContaining({
          initialValue: 0,
          currentValue: 0,
          maxValue: 20,
        }),
      }),
      expect.objectContaining({
        slotId: 'team-slot-2',
        kiboId: 500002,
        pointCount: 1,
        trackingOnly: true,
        appliedToCalculators: false,
        stateMetric: expect.objectContaining({
          initialValue: 0,
          currentValue: 9,
          maxValue: 18,
        }),
      }),
      expect.objectContaining({
        slotId: 'team-slot-3',
        kiboId: 500003,
        pointCount: 1,
        trackingOnly: true,
        appliedToCalculators: false,
        stateMetric: expect.objectContaining({
          initialValue: 0,
          currentValue: 16,
          maxValue: 16,
        }),
      }),
    ]);
    expect(baseline.runtimeOutputs.resources.curvesByActor).toEqual(
      sourceState.teamSlots.map((slot, index) =>
        expect.objectContaining({
          actorId: `actor-${slot.characterId}`,
          pointCount: 1,
          delta: [0.25, 0.5, 0.75][index],
        })
      )
    );
    expect(baseline.runtimeObservationSignature).toHaveLength(6);
    expect(baseline.runtimeObservationSignature).toEqual(
      expect.arrayContaining([
        ...sourceState.teamSlots.map((slot, index) =>
          expect.objectContaining({
            eventType: 'recover-sp-applied',
            actorId: `actor-${slot.characterId}`,
            roleEntityId: `runtime-role-${slot.characterId}`,
            frameIndex: 60 * (index + 1),
          })
        ),
        ...sourceState.teamSlots.map((slot, index) =>
          expect.objectContaining({
            eventType: 'pet-ultimate-cooldown-observed',
            actorId: `actor-${slot.characterId}`,
            slotId: slot.slotId,
            kiboId: 500001 + index,
            frameIndex: 180 * index,
          })
        ),
      ])
    );
    expect(baseline.runtimeOutputs.controlledActorTimeline).toMatchObject({
      initialActor: {
        characterId: sourceState.teamSlots[0].characterId,
      },
      finalActor: {
        characterId: sourceState.teamSlots[1].characterId,
      },
      summary: {
        transitionCount: 1,
        appliedTransitionCount: 1,
        intervalCount: 2,
      },
    });
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
    expect(duplicatedScenarioReplay).toEqual(activeScenarioReplay);
  }, 15000);
});

function createReplaySourceState() {
  const state = createDefaultWorkbenchDraftState();
  state.durationMs = 180_000;
  const replayEffectTargetId = `enemy-${state.selection.enemyId}`;
  state.actionDrafts[0].effectCommands = [
    {
      id: 'replay-effect-apply',
      effectId: 'replay-mark',
      effectName: '回放标记',
      operation: 'apply',
      targetKind: 'enemy',
      targetId: replayEffectTargetId,
      offsetMs: 0,
      durationMs: 5000,
      stackMode: 'stack',
      stackDelta: 1,
      maxStacks: 1,
    },
  ];
  state.actorConfigs[0].initialSp = 0.35;
  state.actorConfigs[0].loadout.kiboId = 500001;
  state.actorConfigs[1].initialSp = 0.6;
  state.actorConfigs[1].loadout.kiboId = 500002;
  state.actorConfigs[2].loadout.kiboId = 500003;
  const equipmentByActor = [
    {
      weapon: 1010111,
      top: 1020111,
      bottom: 1030111,
      earring: 1040111,
      ring: 1050111,
    },
    {
      weapon: 1010211,
      top: 1020211,
      bottom: 1030211,
      earring: 1040211,
      ring: 1050211,
    },
    {
      weapon: 1010311,
      top: 1020311,
      bottom: 1030311,
      earring: 1040311,
      ring: 1050311,
    },
  ];
  state.actorConfigs.forEach((config, index) => {
    config.loadout.equipment = equipmentByActor[index];
    config.loadout.soulessenceId = [10001, 10002, 10008][index];
  });
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
    id: 'action-resource-actor-2',
    type: 'resource',
    actorCharacterId: state.teamSlots[1].characterId,
    startMs: 1400,
    durationMs: 1,
    resource: 'sp',
    change: 0.5,
    reason: 'replay-consistency',
  });
  state.actionDrafts.push({
    id: 'action-resource-actor-3',
    type: 'resource',
    actorCharacterId: state.teamSlots[2].characterId,
    startMs: 1600,
    durationMs: 1,
    resource: 'sp',
    change: 0.75,
    reason: 'replay-consistency',
  });
  state.actionDrafts.push({
    id: 'action-kibo',
    type: 'kiboEvent',
    skillId: 50000102,
    actorCharacterId: state.selection.characterId,
    startMs: 1800,
    durationMs: 1416.666667,
    eventType: 'signature',
    name: '迅风刃',
    timingSource: 'azpr-unity-skill-control-root',
    needsTimingData: false,
    note: 'replay-kibo-event',
    effectCommands: [
      {
        id: 'replay-effect-remove',
        effectId: 'replay-mark',
        effectName: '回放标记',
        operation: 'remove',
        targetKind: 'enemy',
        targetId: replayEffectTargetId,
        offsetMs: 0,
        durationMs: null,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
      },
    ],
  });
  state.actionDrafts.push({
    id: 'action-switch',
    type: 'switch',
    actorCharacterId: state.teamSlots[0].characterId,
    targetCharacterId: state.teamSlots[1].characterId,
    startMs: 2500,
    durationMs: 600,
    note: 'replay-controlled-actor-switch',
  });
  state.actionDrafts.push(
    createReplayKiboAction(state, 1, 3600),
    createReplayKiboAction(state, 2, 5400)
  );
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
    ...state.teamSlots.map((slot, index) =>
      createRecoverSpRuntimeSampleFixture({
        captureSessionId: `replay-role-sp-${index + 1}`,
        actionId: `capture-only-role-${index + 1}`,
        actorId: `actor-${slot.characterId}`,
        ownerEntityId: `runtime-owner-${slot.characterId}`,
        roleEntityId: `runtime-role-${slot.characterId}`,
        frameIndex: 60 * (index + 1),
        timeMs: 1000 * (index + 1),
        spBefore: 10 * (index + 1),
      })
    ),
    ...state.teamSlots.map((slot, index) =>
      createReplayKiboObservationCapture({
        slot,
        index,
        actorId: `actor-${slot.characterId}`,
        kiboId: 500001 + index,
        actionId: index === 0 ? 'action-kibo' : `action-kibo-${index + 1}`,
      })
    ),
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

function createReplayKiboAction(state, slotIndex, startMs) {
  return {
    id: `action-kibo-${slotIndex + 1}`,
    type: 'kiboEvent',
    actorCharacterId: state.teamSlots[slotIndex].characterId,
    startMs,
    durationMs: 600,
    eventType: 'activation',
    name: `奇波 ${slotIndex + 1} 观测`,
    timingSource: null,
    needsTimingData: true,
    note: 'replay-kibo-observation',
  };
}

function createReplayKiboObservationCapture({
  slot,
  index,
  actorId,
  kiboId,
  actionId,
}) {
  const captureSessionId = `replay-kibo-energy-${index + 1}`;
  const frameIndex = 180 * index;
  const totalTime = 20 - index * 2;
  const cdTime = [20, 9, 0][index];
  return {
    schemaVersion: 1,
    captureSessionId,
    clientRegion: 'manual-fixture',
    clientBuild: 'p3-replay-consistency',
    source: 'manual-kibo-runtime-sample-fixture',
    events: [
      {
        captureSessionId,
        eventType: 'pet-ultimate-cooldown-observed',
        actionId,
        actorId,
        slotId: slot.slotId,
        kiboId,
        petEntityId: 70001 + index,
        petEntityPointer: `0x${(0x12345678 + index).toString(16)}`,
        api: 'PetUltimateCdTime',
        frameIndex,
        timeMs: frameIndex * (1000 / 60),
        cdTime,
        totalTime,
        ready: cdTime <= 0,
      },
    ],
  };
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
        durationMs: replay.durationMs,
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
    durationMs: draft.durationMs,
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
    durationMs: project.time.durationMs,
    timelineTopology: scenario.sourceProject.metadata.timelineTopology,
    actionTopology: scenario.actions.map(action => ({
      actionId: action.id,
      type: action.type,
      actorId: action.actorId ?? null,
      kiboId: action.kiboId ?? null,
      skillId: action.skillId ?? null,
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
        skillId: action.skillId,
        name: action.name,
        eventType: action.eventType,
        timing: action.timing,
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
    runtimeObservationSignature: createRuntimeObservationSignature(
      draft.runtimeSampleCaptures
    ),
    runtimeSummary: runtimeProjection.summary,
    runtimeOutputs: result.runtimeOutputs,
  };
}

function createRuntimeObservationSignature(captures = []) {
  return captures.flatMap(capture =>
    capture.events
      .filter(event =>
        ['recover-sp-applied', 'pet-ultimate-cooldown-observed'].includes(
          event.eventType
        )
      )
      .map(event => ({
        captureSessionId: capture.captureSessionId,
        eventType: event.eventType,
        actionId: event.actionId ?? null,
        actorId: event.actorId ?? null,
        slotId: event.slotId ?? null,
        kiboId: event.kiboId ?? null,
        roleEntityId: event.roleEntityId ?? null,
        petEntityId: event.petEntityId ?? null,
        frameIndex: event.frameIndex ?? null,
        timeMs: event.timeMs ?? null,
        spDeltaApplied: event.spDeltaApplied ?? null,
        cdTime: event.cdTime ?? null,
        totalTime: event.totalTime ?? null,
        ready: event.ready ?? null,
      }))
  );
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
