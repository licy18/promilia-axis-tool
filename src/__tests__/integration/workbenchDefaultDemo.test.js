import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKBENCH_DEMO_SCENARIO_NAME,
  createDefaultWorkbenchDemoDraftState,
} from '../../domain/workbenchDraftStorage';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { createRuntimeSampleCaptureProductionAudit } from '../../domain/workbenchRuntimeSampleCapture';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';

describe('Workbench default demo', () => {
  it('opens a three-person preview with six independent energy owners', () => {
    const draft = createDefaultWorkbenchDemoDraftState();
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
    const actorIds = draft.teamSlots.map(slot => `actor-${slot.characterId}`);
    const activeActorId = actorIds[1];

    expect(draft.scenarioWorkspace.scenarios[0].name).toBe(
      DEFAULT_WORKBENCH_DEMO_SCENARIO_NAME
    );
    expect(draft.teamSlots).toHaveLength(3);
    expect(draft.actorConfigs.map(config => config.loadout.kiboId)).toEqual([
      500001, 500002, 500003,
    ]);
    expect(draft.actionDrafts.map(action => action.type)).toEqual(
      expect.arrayContaining(['skill', 'resource', 'kiboEvent', 'enemyEvent'])
    );
    expect(
      new Set(draft.actionDrafts.map(action => action.actorCharacterId))
    ).toEqual(new Set(draft.teamSlots.map(slot => slot.characterId)));
    expect(
      createRuntimeSampleCaptureProductionAudit(draft.runtimeSampleCaptures)
    ).toMatchObject({
      captureCount: 1,
      productionEligibleCaptureCount: 0,
      realCaptureClaimAllowed: false,
    });

    expect(project.metadata.timelineTopology.summary).toMatchObject({
      actorEnergyCurveCount: 3,
      kiboEnergyCurveCount: 3,
      energyCurveCount: 6,
      stateCurveCount: 8,
    });
    expect(resources.summary).toMatchObject({
      actorCount: 3,
      kiboCount: 3,
      energyCurveCount: 6,
      activeActorCount: 1,
      activeKiboCount: 0,
    });
    expect(resources.curvesByActor).toHaveLength(3);
    expect(resources.curvesByKibo).toHaveLength(3);
    expect(
      resources.curvesByActor.find(curve => curve.actorId === activeActorId)
    ).toMatchObject({
      actorId: activeActorId,
      pointCount: 1,
      delta: 50,
    });
    expect(
      resources.curvesByActor
        .filter(curve => curve.actorId !== activeActorId)
        .map(curve => curve.pointCount)
    ).toEqual([0, 0]);
    expect(
      resources.curvesByKibo.map(curve => ({
        pointCount: curve.pointCount,
        trackingOnly: curve.trackingOnly,
        appliedToCalculators: curve.appliedToCalculators,
      }))
    ).toEqual([
      { pointCount: 0, trackingOnly: true, appliedToCalculators: false },
      { pointCount: 0, trackingOnly: true, appliedToCalculators: false },
      { pointCount: 0, trackingOnly: true, appliedToCalculators: false },
    ]);
    expect(result.threeValueRuntimeProjection.enemyStateCurve).toMatchObject({
      hpDelta: expect.any(Number),
      toughnessDelta: 70,
    });
  });
});
