import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../../features/workbench/workbenchHeadlessCombatCore';
import { runMachineAxisCli } from '../../machine-axis/machineAxisCli';
import {
  MachineAxisValidationError,
  createMachineAxisService,
} from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

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
  });
});
