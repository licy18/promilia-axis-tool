import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createWorkbenchDraftSnapshot } from '../../domain/workbenchDraftStorage';
import { createWorkbenchProject } from '../../domain/workbenchProjectFactory';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../../features/workbench/workbenchHeadlessCombatCore';
import { runMachineAxisCli } from '../../machine-axis/machineAxisCli';
import { createMachineAxisEnemyProfile } from '../../machine-axis/machineAxisEnemyProfileContract';
import {
  MachineAxisValidationError,
  createMachineAxisService,
} from '../../machine-axis/machineAxisService';
import { createMachineAxisObjectiveContract } from '../../machine-axis/machineAxisObjectiveContract';
import {
  createWorkbenchDraftFromMachineAxisImport,
  createWorkbenchMachineAxisAdapter,
} from '../../machine-axis/workbenchMachineAxisAdapter';
import { resolveWorkbenchMachineAxisConfigurationProjection } from '../../machine-axis/workbenchMachineAxisProjectProjection';

const PANGPANG_A3_HIT = '10100703|0|elements|0|-9212100609153088879|14|1';

describe('Workbench Machine Axis adapter', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('gives API, CLI, and Workbench the same canonical result', async () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const apiRun = service.simulate(fixture);
    const workbenchRun = adapter.simulate(fixture);
    const cliOutput = { stdout: '', stderr: '' };
    const cliExit = await runMachineAxisCli(['simulate', '-'], {
      service,
      readStdin: async () => JSON.stringify(fixture),
      readFile: async () => '',
      writeFile: async () => {},
      writeStdout: value => {
        cliOutput.stdout += value;
      },
      writeStderr: value => {
        cliOutput.stderr += value;
      },
    });
    const cliRun = JSON.parse(cliOutput.stdout);

    expect(cliExit).toBe(0);
    expect(cliOutput.stderr).toBe('');
    expect(workbenchRun.hashes).toEqual(apiRun.hashes);
    expect(cliRun.hashes).toEqual(apiRun.hashes);
    expect(workbenchRun.trace).toEqual(apiRun.trace);
    expect(cliRun.trace).toEqual(apiRun.trace);
    expect(workbenchRun.evaluation).toEqual(apiRun.evaluation);
    expect(cliRun.evaluation).toEqual(apiRun.evaluation);
  }, 30_000);

  it('round-trips project semantics, resources, variants, and hit overrides', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const imported = adapter.importContract(fixture);
    const exported = adapter.exportProject(imported.project);
    const jsonRoundTrip = JSON.parse(JSON.stringify(exported));
    const restored = adapter.importContract(jsonRoundTrip);
    const originalRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(
      imported.project
    );
    const restoredRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(
      restored.project
    );
    const originalStarts = Object.fromEntries(
      imported.actionResolutions.map(action => [
        action.actionId,
        action.startFrame,
      ])
    );

    expect(exported.scenario).toMatchObject({
      fps: 60,
      durationFrames: 7200,
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'sampled', seed: 'm11-b-fixture-seed' },
      initialRuntimeState: {
        kiboEnergyBySlot: [
          expect.objectContaining({
            slotId: 'slot-1',
            kiboId: 500001,
            currentValue: 100,
            maxValue: 100,
          }),
          expect.any(Object),
          expect.any(Object),
        ],
        specialResourcesByActor: [
          expect.objectContaining({
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 6,
            maxValue: 12,
          }),
        ],
      },
    });
    expect(exported.actions.map(action => action.id)).toEqual(
      fixture.actions.map(action => action.id)
    );
    expect(exported.actions.map(action => action.owner)).toEqual(
      fixture.actions.map(action => ({
        kind: action.owner.kind,
        slotId: action.owner.slotId ?? null,
      }))
    );
    expect(exported.actions.map(action => action.schedule)).toEqual(
      fixture.actions.map(action => ({
        mode: action.schedule.mode,
        frame: action.schedule.frame ?? null,
        actionId: action.schedule.actionId ?? null,
        offsetFrames: action.schedule.offsetFrames ?? 0,
      }))
    );
    expect(
      Object.fromEntries(
        service
          .prepare(exported)
          .actionResolutions.map(action => [action.actionId, action.startFrame])
      )
    ).toEqual(originalStarts);
    expect(
      exported.actions.find(action => action.id === 'xiaoyu-charged').intent
        .semanticVariant
    ).toMatchObject({
      selectorIdentity: 'actor:101010|control:10101010|public-variant:2',
      publicVariantIndex: 2,
      chargeTier: 1,
      mode: 'hold',
    });
    expect(
      exported.actions.find(action => action.id === 'a3-sampled').hitOverrides[
        PANGPANG_A3_HIT
      ]
    ).toEqual({
      landed: 'hit',
      criticalMode: 'sampled',
      criticalRoll: 2345,
    });
    expect(
      exported.actions.find(action => action.id === 'a3-miss').hitOverrides[
        PANGPANG_A3_HIT
      ]
    ).toMatchObject({ landed: 'miss', criticalMode: 'inherit' });
    expect(restoredRun.hashes).toEqual(originalRun.hashes);
    expect(restoredRun.trace).toEqual(originalRun.trace);
  }, 30_000);

  it('round-trips the formal objective and structured enemy profile without defaulting', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const contract = structuredClone(fixture);
    const objectiveContract = createMachineAxisObjectiveContract(
      'cycle-dps-no-toughness'
    );
    const enemyProfile = createMachineAxisEnemyProfile({
      profileId: 'enemy:300032:level:1:workbench-round-trip',
      enemyId: 300032,
      level: 1,
      source: {
        status: 'authoritative-resolved',
        kind: 'enemy-level-pipeline',
        identity: 'feature/m12-b3-enemy-level#enemy:300032:level:1',
        hash: 'workbench-enemy-level-source-hash',
      },
      attributes: {
        maxHp: 8628,
        physicalDefense: 101,
        magicalDefense: 101,
        maxToughness: 6667,
        elementDefenses: {},
      },
      breakRules: {
        recoveryDelayMs: 1000,
        recoveryRateBasisPoints: 1000,
        breakTimeMs: 10000,
        breakEndTimeMs: 2000,
        breakDamageUpBasisPoints: 10000,
        weaknessDamageMaximum: 100,
        weaknessDamageMinimum: 1,
        typeMultipliersBasisPoints: {},
        elementMultipliersBasisPoints: {},
      },
    });
    contract.scenario.objectiveContract = objectiveContract;
    contract.scenario.target = structuredClone(objectiveContract.targetPolicy);
    contract.scenario.enemy.profile = enemyProfile;

    const imported = adapter.importContract(contract);
    const exported = adapter.exportProject(imported.project);
    const restored = adapter.importContract(
      JSON.parse(JSON.stringify(exported))
    );

    expect(imported.project.combatScenario.objectiveContract).toEqual(
      objectiveContract
    );
    expect(imported.project.enemy.profile).toEqual(enemyProfile);
    expect(exported.scenario.objectiveContract).toEqual(objectiveContract);
    expect(exported.scenario.enemy.profile).toEqual(enemyProfile);
    expect(restored.project.combatScenario.objectiveContract).toEqual(
      objectiveContract
    );
    expect(restored.project.enemy.profile).toEqual(enemyProfile);
  }, 30_000);

  it('rejects non-60 FPS on import and export', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const unsupportedContract = structuredClone(fixture);
    unsupportedContract.scenario.fps = 30;
    expect(() => adapter.importContract(unsupportedContract)).toThrow(
      MachineAxisValidationError
    );

    const imported = adapter.importContract(fixture);
    const unsupportedProject = structuredClone(imported.project);
    unsupportedProject.time.fps = 30;
    expect(() => adapter.exportProject(unsupportedProject)).toThrow(
      MachineAxisValidationError
    );
    try {
      adapter.exportProject(unsupportedProject);
    } catch (error) {
      expect(error.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-fps-unsupported',
          actualFps: 30,
          supportedFps: 60,
        })
      );
    }
  });
  it('rebuilds an imported contract through a persisted Workbench draft', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const imported = adapter.importContract(fixture);
    const persistedDraft = JSON.parse(
      JSON.stringify(
        createWorkbenchDraftSnapshot(
          createWorkbenchDraftFromMachineAxisImport(imported),
          null
        )
      )
    );
    const rebuilt = createWorkbenchProject(persistedDraft.selection, {
      ...persistedDraft,
      ...resolveWorkbenchMachineAxisConfigurationProjection({
        configurationLibrary: persistedDraft.configurationLibrary,
        configurationSelection: persistedDraft.configurationSelection,
        projectTransport: persistedDraft.projectTransport,
      }),
      actions: persistedDraft.actionDrafts,
    });
    const exported = adapter.exportProject(rebuilt);
    const originalRun = adapter.simulate(fixture);
    const rebuiltRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(rebuilt);

    expect(
      persistedDraft.actionDrafts.find(action => action.id === 'a3-sampled')
    ).toMatchObject({ attackInputExpansionMode: 'single-input' });
    expect(
      rebuilt.actions.find(action => action.id === 'a3-sampled')
    ).not.toHaveProperty('attackInputExpansionMode');
    expect(rebuilt.id).toBe(fixture.scenario.id);
    expect(rebuilt.name).toBe(fixture.scenario.name);
    expect(exported.actions.map(action => action.schedule)).toEqual(
      fixture.actions.map(action => ({
        mode: action.schedule.mode,
        frame: action.schedule.frame ?? null,
        actionId: action.schedule.actionId ?? null,
        offsetFrames: action.schedule.offsetFrames ?? 0,
      }))
    );
    expect(rebuiltRun.hashes).toEqual(originalRun.hashes);
  }, 30_000);
  it('projects Workbench edits and rejects unsupported project actions', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const imported = adapter.importContract(fixture);
    const edited = structuredClone(imported.project);
    const action = edited.actions.find(item => item.id === 'a3-sampled');
    action.startMs += 1000;
    action.startFrame = null;
    const exported = adapter.exportProject(edited);
    expect(
      exported.actions.every(item => item.schedule.mode === 'absolute')
    ).toBe(true);
    expect(
      exported.actions.find(item => item.id === 'a3-sampled').schedule
    ).toEqual({
      mode: 'absolute',
      frame:
        imported.actionResolutions.find(item => item.actionId === 'a3-sampled')
          .startFrame + 60,
      actionId: null,
      offsetFrames: 0,
    });

    edited.actions.push({
      id: 'unsupported-enemy-event',
      type: 'enemyEvent',
      startMs: 5000,
    });
    expect(() => adapter.exportProject(edited)).toThrow(
      MachineAxisValidationError
    );
    try {
      adapter.exportProject(edited);
    } catch (error) {
      expect(error.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-workbench-action-unsupported',
          actionId: 'unsupported-enemy-event',
        })
      );
    }
  }, 30_000);
});
