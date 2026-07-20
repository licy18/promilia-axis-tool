import { afterEach, describe, expect, it, vi } from 'vitest';
import workbenchSkillDiagnostics from '../../data/generated/workbench-skill-diagnostics.json';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { runSimulation } from '../../simulation';
import {
  getProjectSimulationSkillDiagnosticsStatus,
  installProjectSimulationSkillDiagnostics,
  resetProjectSimulationSkillDiagnostics,
} from '../../simulation/projection/projectSimulationResult';
import { getWorkbenchSkillDiagnostics } from '../../simulation/projection/workbenchSkillDiagnosticsLoader';

afterEach(() => {
  resetProjectSimulationSkillDiagnostics();
});

function selectAppliedRuntimeValues(result) {
  return {
    summary: {
      enemyHpDelta: result.runtimeOutputs.summary.enemyHpDelta,
      enemyToughnessDelta: result.runtimeOutputs.summary.enemyToughnessDelta,
      selfEnergyDelta: result.runtimeOutputs.summary.selfEnergyDelta,
      enemyHpRemaining: result.runtimeOutputs.summary.enemyHpRemaining,
      enemyToughnessRemaining:
        result.runtimeOutputs.summary.enemyToughnessRemaining,
    },
    stateSnapshots: result.runtimeOutputs.stateSnapshots.snapshots.map(
      snapshot => ({
        actionId: snapshot.actionId,
        frameIndex: snapshot.frameIndex,
        delta: snapshot.delta,
        enemyHp: snapshot.after.enemyHp.currentValue,
        enemyToughness: snapshot.after.enemyToughness.currentValue,
        selfEnergy: snapshot.after.selfEnergy.currentValue,
      })
    ),
    simLog: result.runtimeOutputs.simLog.map(row => ({
      eventType: row.eventType,
      actionId: row.actionId,
      frameIndex: row.frameIndex,
      trackKey: row.trackKey,
      hpDelta: row.hpDelta,
      toughnessDelta: row.toughnessDelta,
      energyDelta: row.energyDelta,
    })),
  };
}

describe('skill diagnostics lazy boundary', () => {
  it('fetches and caches the diagnostics JSON outside the JavaScript bundle', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => workbenchSkillDiagnostics,
    });

    await expect(getWorkbenchSkillDiagnostics(fetchImpl)).resolves.toBe(
      workbenchSkillDiagnostics
    );
    await getWorkbenchSkillDiagnostics(fetchImpl);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('keeps applied runtime state stable when optional evidence is installed', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    resetProjectSimulationSkillDiagnostics();

    const coreResult = runSimulation(project, getWorkbenchGameData());
    expect(getProjectSimulationSkillDiagnosticsStatus()).toMatchObject({
      loaded: false,
      skillControlCount: 0,
    });
    expect(coreResult.actionResultTimeline[0].hitCandidates).toEqual([]);

    const installed = installProjectSimulationSkillDiagnostics(
      workbenchSkillDiagnostics
    );
    const diagnosticResult = runSimulation(project, getWorkbenchGameData());

    expect(installed).toMatchObject({
      loaded: true,
      skillControlCount: 120,
    });
    expect(
      diagnosticResult.actionResultTimeline[0].hitCandidates.length
    ).toBeGreaterThan(0);
    expect(diagnosticResult.actionResultTimeline[0].hpDamage.value).toBe(
      coreResult.actionResultTimeline[0].hpDamage.value
    );
    expect(diagnosticResult.actionResultTimeline[0].hpDamage.applied).toBe(
      coreResult.actionResultTimeline[0].hpDamage.applied
    );
    expect(selectAppliedRuntimeValues(diagnosticResult)).toEqual(
      selectAppliedRuntimeValues(coreResult)
    );
  });
});
