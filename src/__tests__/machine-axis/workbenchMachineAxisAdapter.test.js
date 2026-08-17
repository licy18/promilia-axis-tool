import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import moyinWindow39Fixture from '../../../fixtures/character-acceptance/109001-window-39.json';
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
import { createVerifiedJointAttackRuntimeBinding } from '../../domain/verifiedJointAttackRuntimeContract';
import {
  createWorkbenchDraftFromMachineAxisImport,
  createWorkbenchMachineAxisAdapter,
} from '../../machine-axis/workbenchMachineAxisAdapter';
import { resolveWorkbenchMachineAxisConfigurationProjection } from '../../machine-axis/workbenchMachineAxisProjectProjection';
import {
  createRubyEnhancedContextAxis,
  installRubyNormalAttackProfileOverlay,
  restoreVerifiedCombatMechanicsPackage,
} from '../helpers/rubyNormalAttackAuthorityFixture';

const PANGPANG_PLUNGING_HIT = '10100711|0|elements|0|-6537565703316603243|35|1';

function createMoyinChaseInputAxis() {
  const contract = structuredClone(moyinWindow39Fixture);
  contract.scenario.durationFrames = 400;
  contract.actions = contract.actions.slice(0, 2);
  contract.actions[1].schedule.frame = 40;
  return contract;
}

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

    expect(imported.contract.scenario.enemy.profile).toMatchObject({
      enemyId: 300032,
      level: 1,
      source: {
        status: 'authoritative-resolved',
        kind: 'enemy-level-and-break-profile-pipeline',
      },
      attributes: {
        maxHp: 690.24,
        physicalDefense: 454.5,
        magicalDefense: 454.5,
        maxToughness: 213.344,
      },
    });
    expect(imported.project.enemy.profile).toEqual(
      imported.contract.scenario.enemy.profile
    );

    expect(exported.scenario).toMatchObject({
      fps: 60,
      durationFrames: 7200,
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'sampled', seed: 'm11-b-authority-fixture-seed' },
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
      exported.actions.find(action => action.id === 'plunging-sampled')
        .hitOverrides[PANGPANG_PLUNGING_HIT]
    ).toEqual({
      landed: 'hit',
      criticalMode: 'sampled',
      criticalRoll: 2345,
    });
    expect(
      exported.actions.find(action => action.id === 'plunging-miss')
        .hitOverrides[PANGPANG_PLUNGING_HIT]
    ).toMatchObject({ landed: 'miss', criticalMode: 'inherit' });
    expect(restoredRun.hashes).toEqual(originalRun.hashes);
    expect(restoredRun.trace).toEqual(originalRun.trace);
  }, 30_000);

  it('round-trips a blocked hit outcome without collapsing it into miss', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const contract = structuredClone(fixture);
    const action = contract.actions.find(item => item.id === 'plunging-miss');
    action.hitOverrides[PANGPANG_PLUNGING_HIT].landed = 'blocked';

    const imported = adapter.importContract(contract);
    const exported = adapter.exportProject(imported.project);
    const restored = adapter.importContract(
      JSON.parse(JSON.stringify(exported))
    );

    expect(
      exported.actions.find(item => item.id === 'plunging-miss').hitOverrides[
        PANGPANG_PLUNGING_HIT
      ]
    ).toMatchObject({ landed: 'blocked', criticalMode: 'inherit' });
    expect(
      restored.contract.actions.find(item => item.id === 'plunging-miss')
        .hitOverrides[PANGPANG_PLUNGING_HIT]
    ).toMatchObject({ landed: 'blocked', criticalMode: 'inherit' });
  }, 30_000);

  it('does not turn a runtime-resolved normal chain into an explicit chain selection', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const contract = createMoyinChaseInputAxis();
    const imported = adapter.importContract(contract);
    const preparedAction = imported.project.actions.find(
      action => action.id === 'window-offset-39-a1'
    );
    const exported = adapter.exportProject(imported.project);
    const exportedAction = exported.actions.find(
      action => action.id === 'window-offset-39-a1'
    );

    expect(preparedAction).toMatchObject({
      attackInputChainSelectionSource: 'runtime-projected',
      attackInputChainIdentity: null,
    });
    expect(exportedAction.intent.attackInput).toEqual(
      imported.contract.actions.find(
        action => action.id === 'window-offset-39-a1'
      ).intent.attackInput
    );
    expect(exportedAction.intent.attackInput.chainIdentity).toBeNull();
  }, 30_000);

  it('warns and round-trips normal-attack display metadata without treating it as authority', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const contract = createMoyinChaseInputAxis();
    const actionId = 'window-offset-39-a1';
    const sourceAction = contract.actions.find(
      action => action.id === actionId
    );
    sourceAction.intent.attackInput = {
      sequenceIndex: 5,
      groupId: 'display-only-group',
      contextActionId: 'display-only-context',
      chainIdentity: 'display-only-chain',
    };
    const imported = adapter.importContract(contract);
    const resolution = imported.actionResolutions.find(
      candidate => candidate.actionId === actionId
    );
    const exported = adapter.exportProject(imported.project);
    const exportedInput = exported.actions.find(
      action => action.id === actionId
    ).intent.attackInput;

    expect(resolution.normalAttackInputResolution).toMatchObject({
      status: 'corrected',
      requested: expect.objectContaining(sourceAction.intent.attackInput),
      mismatchFields: expect.arrayContaining([
        'sequenceIndex',
        'contextActionId',
        'chainIdentity',
      ]),
    });
    expect(exportedInput).toEqual(sourceAction.intent.attackInput);
    expect(() => adapter.importContract(exported)).not.toThrow();
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

    // Isolate the objective/profile transport boundary from autonomous Kibo
    // scheduling and action-tail diagnostics.
    contract.actions = [];
    contract.scenario.team = contract.scenario.team.map(slot => {
      const projected = structuredClone(slot);
      delete projected.loadout?.kiboId;
      return projected;
    });

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

  it('round-trips the joint runtime assumption and binds it into all canonical hashes', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const contract = structuredClone(fixture);
    contract.scenario.durationFrames = 60;
    contract.actions = [];
    contract.scenario.team = contract.scenario.team.map(slot => {
      const projected = structuredClone(slot);
      delete projected.loadout?.kiboId;
      return projected;
    });
    contract.scenario.initialRuntimeState.kiboEnergyBySlot = [];
    contract.scenario.jointAttackRuntime =
      createVerifiedJointAttackRuntimeBinding();

    const imported = adapter.importContract(contract);
    const exported = adapter.exportProject(imported.project);
    const restored = adapter.importContract(
      JSON.parse(JSON.stringify(exported))
    );
    const first = service.simulate(exported);
    const replay = service.simulate(restored.contract);

    expect(imported.project.combatScenario.jointAttackRuntime).toEqual(
      contract.scenario.jointAttackRuntime
    );
    expect(exported.scenario.jointAttackRuntime).toEqual(
      contract.scenario.jointAttackRuntime
    );
    expect(restored.project.combatScenario.jointAttackRuntime).toEqual(
      contract.scenario.jointAttackRuntime
    );
    expect(replay.hashes).toEqual(first.hashes);

    const changed = structuredClone(exported);
    changed.scenario.jointAttackRuntime =
      createVerifiedJointAttackRuntimeBinding({
        cannotBeJointStrike: true,
      });
    const changedRun = service.simulate(changed);
    for (const dimension of ['input', 'data', 'trace', 'build']) {
      expect(changedRun.hashes[dimension]).not.toBe(first.hashes[dimension]);
    }

    const tampered = structuredClone(exported);
    tampered.scenario.jointAttackRuntime.bindingHash = '0000000000000000';
    expect(() => adapter.importContract(tampered)).toThrow(
      MachineAxisValidationError
    );
    try {
      adapter.importContract(tampered);
    } catch (error) {
      expect(error.issues).toContainEqual(
        expect.objectContaining({
          code: 'joint-attack-runtime-binding-hash-mismatch',
          path: 'scenario.jointAttackRuntime.bindingHash',
        })
      );
    }
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
      persistedDraft.actionDrafts.find(
        action => action.id === 'plunging-sampled'
      )
    ).not.toHaveProperty('attackInputExpansionMode');
    expect(
      rebuilt.actions.find(action => action.id === 'plunging-sampled')
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

  it('preserves a verified single-input normal attack through draft persistence and rebuild', () => {
    installRubyNormalAttackProfileOverlay();
    try {
      const service = createMachineAxisService();
      const adapter = createWorkbenchMachineAxisAdapter({ service });
      const contract = createRubyEnhancedContextAxis(fixture);
      const imported = adapter.importContract(contract);
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
      const originalRun = adapter.simulate(contract);
      const rebuiltRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(rebuilt);

      expect(
        persistedDraft.actionDrafts.find(
          action => action.id === 'ruby-enhanced-context'
        )
      ).toMatchObject({ attackInputExpansionMode: 'single-input' });
      expect(
        rebuilt.actions.find(action => action.id === 'ruby-enhanced-context')
      ).not.toHaveProperty('attackInputExpansionMode');
      expect(
        exported.actions.find(action => action.id === 'ruby-enhanced-context')
          .intent.attackInput
      ).toMatchObject(
        contract.actions.find(action => action.id === 'ruby-enhanced-context')
          .intent.attackInput
      );
      expect(
        exported.actions.find(action => action.id === 'ruby-enhanced-context')
          .intent.attackInput.groupId
      ).toBe('machine-axis-ruby-enhanced-context');
      expect(rebuiltRun.hashes).toEqual(originalRun.hashes);
    } finally {
      restoreVerifiedCombatMechanicsPackage();
    }
  }, 30_000);

  it('projects Workbench edits and rejects unsupported project actions', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const isolated = structuredClone(fixture);
    isolated.actions = isolated.actions.filter(
      item => item.id === 'plunging-inherit'
    );
    const imported = adapter.importContract(isolated);
    const edited = structuredClone(imported.project);
    const action = edited.actions.find(item => item.id === 'plunging-inherit');
    action.startMs += 1000 / 60;
    action.startFrame = null;
    const exported = adapter.exportProject(edited);
    expect(
      exported.actions.every(item => item.schedule.mode === 'absolute')
    ).toBe(true);
    expect(
      exported.actions.find(item => item.id === 'plunging-inherit').schedule
    ).toEqual({
      mode: 'absolute',
      frame:
        imported.actionResolutions.find(
          item => item.actionId === 'plunging-inherit'
        ).startFrame + 1,
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

  it('uses the same foreground-input proof for contract import and Workbench export', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const invalidContract = structuredClone(fixture);
    const offFieldAction = invalidContract.actions.find(
      action => action.id === 'xiaoyu-charged'
    );
    offFieldAction.schedule = {
      mode: 'absolute',
      frame: 1,
      actionId: null,
      offsetFrames: 0,
    };

    for (const invoke of [
      () => adapter.importContract(invalidContract),
      () => {
        const imported = adapter.importContract(fixture);
        const projectAction = imported.project.actions.find(
          action => action.id === 'xiaoyu-charged'
        );
        projectAction.startMs = 1000 / 60;
        projectAction.startFrame = 1;
        return adapter.exportProject(imported.project);
      },
    ]) {
      expect(invoke).toThrow(MachineAxisValidationError);
      try {
        invoke();
      } catch (error) {
        expect(error.issues).toContainEqual(
          expect.objectContaining({
            code: 'controlled-actor-action-unavailable',
            actionId: 'xiaoyu-charged',
          })
        );
        expect(error.actionLegalityProof).toMatchObject({
          passed: false,
          finalScoreEligible: false,
          rejectionCodes: expect.arrayContaining([
            'controlled-actor-action-unavailable',
          ]),
        });
      }
    }
  }, 30_000);
});
