import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  createDefaultWorkbenchDraftState,
  createWorkbenchDraftSnapshot,
  createWorkbenchProjectShareCode,
  loadWorkbenchDraft,
  parseWorkbenchProjectFile,
  parseWorkbenchProjectShareCode,
  saveWorkbenchDraft,
  serializeWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { getWorkbenchGameDataCompatibilityReport } from '../../domain/workbenchGameDataCatalog';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../../domain/workbenchPngProject';
import { duplicateWorkbenchScenario } from '../../domain/workbenchScenarioWorkspace';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const EXPORTED_AT = '2026-07-14T12:00:00.000Z';
const ACTION_ID = 'm3-real-action-status';
const DERIVED_ACTION_ID = `${ACTION_ID}--on-exit--actor-101003--star-carry`;

describe('generated action status project replay', () => {
  beforeEach(() => installVerifiedCombatMechanicsPackage(mechanicsPackage));
  afterEach(() => clearInstalledVerifiedCombatMechanicsPackage());

  it('replays one catalog-generated lifecycle identically through all five project carriers', async () => {
    const source = createStatusReplaySource();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    expect(duplicated.changed).toBe(true);

    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const localDraft = loadWorkbenchDraft(storage);
    const jsonDraft = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const shareDraft = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);

    const carrierSignatures = [
      localDraft,
      jsonDraft,
      shareDraft,
      pngDraft,
      duplicated.scenario.draft,
    ].map(draft =>
      createStatusReplaySignature(draft, source.configurationLibrary)
    );
    const baseline = carrierSignatures[0];

    expect(baseline).toMatchObject({
      statusGeneration: {
        contractName: 'AzPrActionStatusGeneration',
        status: 'action-status-generation-ready-with-lifecycle',
        skillId: 10100322,
        actionVariantIndex: 0,
        summary: {
          generatedEffectCount: 1,
          trackingOnlyEffectCount: 0,
          calculatorAppliedEffectCount: 0,
        },
      },
      generatedCommands: [
        {
          commandId: `${DERIVED_ACTION_ID}-generated-status-buff-101003141-57-0`,
          effectId: 'buff-101003141',
          offsetMs: 950,
          durationMs: 8000,
          trackingStatus: 'unapplied',
          appliedToCalculators: false,
        },
      ],
      execution: {
        execute: true,
        status: 'scheduled',
      },
      cooldownWindows: [
        {
          startMs: 2000,
          endMs: 26000,
          confidence: 'confirmed-structured-data',
          trackingStatus: 'applied-to-readiness',
        },
      ],
      lifecycleEvents: [
        {
          type: 'EFFECT_APPLIED',
          timeMs: 2950,
          frameIndex: 177,
          trackingStatus: 'unapplied',
          appliedToCalculators: false,
        },
        {
          type: 'EFFECT_EXPIRED',
          timeMs: 10950,
          frameIndex: 657,
          trackingStatus: 'unapplied',
          appliedToCalculators: false,
        },
      ],
      relationEdges: [
        {
          status: 'satisfied',
          targetTimeMs: 2950,
          trackingStatus: 'unapplied',
        },
      ],
      calculatorAppliedEffectCount: 0,
    });
    for (const signature of carrierSignatures.slice(1)) {
      expect(signature).toEqual(baseline);
    }
  });
});

function createStatusReplaySource() {
  const state = createDefaultWorkbenchDraftState();
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 101007 },
    { slotId: 'team-slot-3', position: 2, characterId: 109001 },
  ];
  const selection = {
    ...state.selection,
    characterId: 101003,
    secondaryCharacterId: 101007,
    tertiaryCharacterId: 109001,
  };
  return createWorkbenchDraftSnapshot(
    {
      ...state,
      selection,
      teamSlots,
      actorConfigs: normalizeWorkbenchActorConfigs([], selection, teamSlots),
      actionDrafts: [
        createWorkbenchActionDraft({
          id: ACTION_ID,
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 101007,
          startMs: 2000,
          durationMs: 0,
        }),
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
      },
      selectedActionId: ACTION_ID,
    },
    EXPORTED_AT
  );
}

function createStatusReplaySignature(draft, configurationLibrary) {
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
  const scenario = compileProject(project, getWorkbenchGameData());
  const result = simulateScenario(scenario);
  const action = scenario.actions.find(item => item.id === DERIVED_ACTION_ID);
  const execution = result.actionExecutionPlan.actions.find(
    item => item.actionId === DERIVED_ACTION_ID
  );

  return {
    statusGeneration: action.statusGeneration,
    generatedCommands: action.effectCommands.map(command => ({
      commandId: command.id,
      effectId: command.effectId,
      offsetMs: command.offsetMs,
      durationMs: command.durationMs,
      trackingStatus: command.trackingStatus,
      appliedToCalculators: command.appliedToCalculators,
    })),
    execution: {
      execute: execution.execute,
      status: execution.status,
    },
    cooldownWindows:
      result.actionRuleDiagnostics.readinessTimeline.cooldownWindows
        .filter(window => window.actionId === DERIVED_ACTION_ID)
        .map(window => ({
          startMs: window.startMs,
          endMs: window.endMs,
          confidence: window.confidence,
          trackingStatus: window.trackingStatus,
        })),
    lifecycleEvents: result.effectTimeline.events
      .filter(event => event.actionId === DERIVED_ACTION_ID)
      .map(event => ({
        type: event.type,
        timeMs: event.timeMs,
        frameIndex: event.frameIndex,
        trackingStatus: event.trackingStatus,
        appliedToCalculators: event.appliedToCalculators,
      })),
    relationEdges: result.actionEffectRelationGraph.edges
      .filter(edge => edge.commandActionId === DERIVED_ACTION_ID)
      .map(edge => ({
        status: edge.status,
        targetTimeMs: edge.targetTimeMs,
        trackingStatus: edge.trackingStatus,
      })),
    calculatorAppliedEffectCount:
      result.effectTimeline.summary.calculatorAppliedEffectCount,
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
