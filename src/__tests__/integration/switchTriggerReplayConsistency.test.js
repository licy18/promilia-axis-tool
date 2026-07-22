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
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import {
  createWorkbenchProjectPngMetadata,
  embedWorkbenchProjectInPng,
  parseWorkbenchProjectPng,
} from '../../domain/workbenchPngProject';
import { duplicateWorkbenchScenario } from '../../domain/workbenchScenarioWorkspace';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { projectTimelineOperationInputs } from '../../simulation/projection/projectTimelineOperationInputs';

const ONE_PIXEL_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const EXPORTED_AT = '2026-07-22T06:00:00.000Z';

describe('switch-triggered star-carry replay consistency', () => {
  beforeEach(() => installVerifiedCombatMechanicsPackage(mechanicsPackage));
  afterEach(() => clearInstalledVerifiedCombatMechanicsPackage());

  it('persists one switch and rebuilds the same enter and exit children from all five carriers', async () => {
    const source = createSwitchReplayDraft();
    const duplicated = duplicateWorkbenchScenario(
      source.scenarioWorkspace,
      source.scenarioWorkspace.activeScenarioId,
      source
    );
    const storage = createMemoryStorage();
    saveWorkbenchDraft(storage, source);
    const local = loadWorkbenchDraft(storage);
    const json = parseWorkbenchProjectFile(
      serializeWorkbenchProjectFile(source, EXPORTED_AT)
    );
    const share = parseWorkbenchProjectShareCode(
      createWorkbenchProjectShareCode(source, EXPORTED_AT)
    );
    const png = await embedWorkbenchProjectInPng(
      new Uint8Array(Buffer.from(ONE_PIXEL_PNG_BASE64, 'base64')),
      createWorkbenchProjectPngMetadata(source, EXPORTED_AT)
    );
    const pngDraft = await parseWorkbenchProjectPng(png);
    const signatures = [
      duplicated.scenario.draft,
      local,
      json,
      share,
      pngDraft,
    ].map(createSwitchReplaySignature);

    expect(signatures[0]).toMatchObject({
      persistedActions: [['switch-replay', 'switch', 1500, 0]],
      generationSummary: {
        switchEventCount: 1,
        appliedBindingCount: 2,
        unresolvedBindingCount: 0,
        derivedActionCount: 2,
        onEnterDerivedActionCount: 1,
        onExitDerivedActionCount: 1,
      },
      children: [
        [
          'switch-replay--on-enter--actor-101007--star-carry',
          'switch-replay',
          'on-enter',
          101007,
          10100721,
          1500,
          365,
          true,
        ],
        [
          'switch-replay--on-exit--actor-101003--star-carry',
          'switch-replay',
          'on-exit',
          101003,
          10100322,
          1500,
          140,
          true,
        ],
      ],
      operationInputs: [['switch-replay', 'switch', '2', 1500]],
    });
    expect(signatures[0].executedActionIds).toEqual(
      expect.arrayContaining([
        'switch-replay',
        'switch-replay--on-enter--actor-101007--star-carry',
        'switch-replay--on-exit--actor-101003--star-carry',
      ])
    );
    expect(signatures[0].derivedDamageEventCount).toBeGreaterThan(0);
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  });
});

function createSwitchReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  base.durationMs = 30_000;
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 101007 },
    { slotId: 'team-slot-3', position: 2, characterId: 103002 },
  ];
  const selection = {
    ...base.selection,
    characterId: 101003,
    secondaryCharacterId: 101007,
    tertiaryCharacterId: 103002,
  };
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      selection,
      teamSlots,
      actorConfigs: normalizeWorkbenchActorConfigs([], selection, teamSlots),
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: [
        createWorkbenchActionDraft({
          id: 'switch-replay',
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 101007,
          startMs: 1500,
          durationMs: 0,
          note: '切换至苃苃',
        }),
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
      },
      selectedActionId: 'switch-replay',
    },
    EXPORTED_AT
  );
}

function createSwitchReplaySignature(draft) {
  const project = createWorkbenchProject(draft.selection, {
    durationMs: draft.durationMs,
    teamSlots: draft.teamSlots,
    actorConfigs: draft.actorConfigs,
    enemyConfig: draft.enemyConfig,
    configurationLibrary: draft.configurationLibrary,
    configurationSelection: draft.configurationSelection,
    gameDataBinding: draft.gameDataBinding,
    mechanicsProfileSelection: draft.mechanicsProfileSelection,
    actions: draft.actionDrafts,
    actionRelations: draft.actionRelations,
    cycleBoundaries: draft.cycleBoundaries,
    initialRuntimeState: draft.initialRuntimeState,
    runtimeSampleCaptures: draft.runtimeSampleCaptures,
  });
  const scenario = compileProject(project, getWorkbenchGameData());
  const result = simulateScenario(scenario);
  const actorsById = new Map(
    scenario.actors.map(actor => [String(actor.id), actor])
  );
  const operationInputs = projectTimelineOperationInputs({
    actions: scenario.actions,
    actors: scenario.actors,
    controlledActorTimeline: result.runtimeOutputs.controlledActorTimeline,
    durationMs: scenario.time.durationMs,
  });
  const children = scenario.actions
    .filter(
      action => action.derivedAction?.kind === 'switch-triggered-star-carry'
    )
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const childIds = new Set(children.map(action => action.id));
  return {
    persistedActions: draft.actionDrafts.map(action => [
      action.id,
      action.type,
      action.startMs,
      action.durationMs,
    ]),
    generationSummary: scenario.switchTriggerGeneration.summary,
    children: children.map(action => [
      action.id,
      action.parentActionId,
      action.switchTriggerBinding.triggerPhase,
      actorsById.get(String(action.actorId))?.characterId,
      action.skillId,
      action.startMs,
      action.durationFrames,
      action.readOnly,
    ]),
    bindings: scenario.switchTriggerGeneration.bindings.map(binding => [
      binding.bindingId,
      binding.switchEventId,
      binding.triggerPhase,
      binding.starCarryOwnerCharacterId,
      binding.sourceSkillId,
      binding.resolutionStatus,
      binding.sourceIdentity,
    ]),
    operationInputs: operationInputs.markers.map(marker => [
      marker.actionId,
      marker.command,
      marker.keyLabel,
      marker.startMs,
    ]),
    executedActionIds: result.actionExecutionPlan.executedActionIds.filter(
      actionId => actionId === 'switch-replay' || childIds.has(actionId)
    ),
    derivedDamageEventCount: result.verifiedCombatRuntime.damageEvents.filter(
      event => childIds.has(event.actionId)
    ).length,
    derivedDamageSignature: result.verifiedCombatRuntime.damageEvents
      .filter(event => childIds.has(event.actionId))
      .map(event => [
        event.actionId,
        event.timeMs,
        event.payload.elementId,
        event.payload.rawDamage,
        event.payload.toughnessDamage,
      ]),
  };
}

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}
