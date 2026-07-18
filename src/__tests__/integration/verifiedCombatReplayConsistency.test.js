import { Buffer } from 'node:buffer';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
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
} from '../../domain/workbenchProjectFactory';
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
const EXPORTED_AT = '2026-07-18T08:00:00.000Z';

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified combat project replay consistency', () => {
  it('rebuilds the same verified eight-curve result from scenario copy, local draft, JSON, share link and PNG', async () => {
    const source = createVerifiedReplayDraft();
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
      createVerifiedReplaySignature(duplicated.scenario.draft),
      createVerifiedReplaySignature(local),
      createVerifiedReplaySignature(json),
      createVerifiedReplaySignature(share),
      createVerifiedReplaySignature(pngDraft),
    ];

    expect(duplicated.changed).toBe(true);
    expect(signatures[0]).toMatchObject({
      profileId: 'azpr-three-value-verified-tc-20260718',
      topology: {
        actorActionLaneCount: 3,
        kiboLaneCount: 3,
        stateCurveCount: 8,
      },
      bindingIdentities: [
        'actor|101007|10100701|0|10100703',
        'kibo|500469|50046903|0|50046903',
      ],
      hitEventCount: 6,
      breakTriggerCount: 1,
      breakExitCount: 1,
      actorCurveCount: 3,
      kiboCurveCount: 3,
      appliedKiboIds: [500469],
    });
    expect(signatures[0].damageEventCount).toBeGreaterThan(6);
    expect(signatures[0].stateEventKinds).toEqual(
      expect.arrayContaining([
        'break-linear-recovery',
        'break-end-wait',
        'break-exit',
      ])
    );
    for (const signature of signatures.slice(1)) {
      expect(signature).toEqual(signatures[0]);
    }
  });
});

function createVerifiedReplayDraft() {
  const base = createDefaultWorkbenchDraftState();
  const actorConfigs = base.actorConfigs.map(config =>
    Number(config.characterId) === 101007
      ? {
          ...config,
          initialSp: 0,
          loadout: { ...config.loadout, kiboId: 500469 },
        }
      : { ...config, initialSp: 0 }
  );
  return createWorkbenchDraftSnapshot(
    {
      ...base,
      actorConfigs,
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
      actionDrafts: [
        createWorkbenchActionDraft({
          id: 'verified-replay-pangpang',
          type: 'skill',
          actorCharacterId: 101007,
          skillId: 10100701,
          actionVariantIndex: 0,
          startMs: 0,
          durationMs: 600,
        }),
        createWorkbenchActionDraft({
          id: 'verified-replay-kibo',
          type: 'kiboEvent',
          actorCharacterId: 101007,
          skillId: 50046903,
          startMs: 1000,
          durationMs: 2600,
          eventType: 'signature',
        }),
      ],
      initialRuntimeState: {
        enemy: {
          enemyId: String(base.selection.enemyId),
          hp: { currentValue: 8628, maxValue: 8628 },
          toughness: { currentValue: 1, maxValue: 6667 },
        },
      },
      runtimeSampleCaptures: [],
      selectedActionId: 'verified-replay-pangpang',
    },
    EXPORTED_AT
  );
}

function createVerifiedReplaySignature(draft) {
  const project = createWorkbenchProject(draft.selection, {
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
  const resources = result.runtimeOutputs.resourceCurves;
  return {
    profileId: scenario.mechanicsProfile.profileId,
    topology: scenario.sourceProject.metadata.timelineTopology.summary,
    bindingIdentities: result.verifiedCombatRuntime.actionResolutions
      .filter(resolution => resolution.ready)
      .map(resolution => resolution.actionBinding.identity)
      .sort(),
    damageEventCount: result.verifiedCombatRuntime.damageEvents.length,
    hitEventCount: result.verifiedCombatRuntime.summary.hitEventCount,
    breakTriggerCount: result.verifiedCombatRuntime.summary.breakTriggerCount,
    breakExitCount: result.verifiedCombatRuntime.summary.breakExitCount,
    stateEventKinds: [
      ...new Set(
        result.verifiedCombatRuntime.damageEvents
          .map(event => event.payload.stateEventKind)
          .filter(Boolean)
      ),
    ],
    damageSignature: result.verifiedCombatRuntime.damageEvents.map(event => [
      event.actionId,
      event.timeMs,
      event.payload.elementId,
      event.payload.rawDamage,
      event.payload.toughnessDamage,
    ]),
    finalState: result.verifiedCombatRuntime.finalState,
    actorCurveCount: resources.curvesByActor.length,
    kiboCurveCount: resources.curvesByKibo.length,
    actorCurveSignature: resources.curvesByActor.map(curve => [
      curve.actorId,
      curve.stateMetric.currentValue,
      curve.pointCount,
    ]),
    kiboCurveSignature: resources.curvesByKibo.map(curve => [
      curve.slotId,
      curve.kiboId,
      curve.stateMetric.currentValue,
      curve.pointCount,
      curve.appliedToCalculators,
    ]),
    appliedKiboIds: resources.curvesByKibo
      .filter(curve => curve.appliedToCalculators)
      .map(curve => curve.kiboId),
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
