import { describe, expect, it } from 'vitest';
import {
  createDefaultWorkbenchDraftState,
  parseWorkbenchProjectFile,
} from '../../domain/workbenchDraftStorage';
import { reconcileWorkbenchConfigurationState } from '../../domain/workbenchConfigurationLibrary';
import {
  createWorkbenchGameDataCompatibilityReport,
  createWorkbenchGameDataReferenceContract,
  DEFAULT_WORKBENCH_GAME_DATA_CATALOG,
  getWorkbenchGameDataCompatibilityReport,
} from '../../domain/workbenchGameDataCatalog';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
  getWorkbenchLoadoutOptions,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';

describe('Workbench game data catalog', () => {
  it('exposes the generated AzPr tables as one trusted versioned catalog', () => {
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG).toMatchObject({
      contractName: 'AzPrWorkbenchGameDataCatalog',
      contractVersion: 1,
      catalogId: 'azpr-workbench-game-data',
      catalogVersion: 1,
      dataVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
      status: 'workbench-game-data-catalog-ready',
      ready: true,
      summary: {
        recordCount: 549,
        counts: {
          characters: 20,
          enemies: 208,
          equipment: 137,
          kibos: 122,
          soulessences: 62,
        },
        issueCount: 0,
      },
    });
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG.sources.characters).toContain(
      'hero-modules'
    );
    expect(DEFAULT_WORKBENCH_GAME_DATA_CATALOG.sources.enemies).toContain(
      'enemy.json'
    );
  });

  it('resolves active character, enemy, equipment, kibo, and soulessence records', () => {
    const state = createConfiguredState();
    const report = createWorkbenchGameDataCompatibilityReport(state);
    const reference = createWorkbenchGameDataReferenceContract(state);

    expect(report).toMatchObject({
      status: 'workbench-game-data-compatibility-exact',
      importAllowed: true,
      binding: { status: 'exact', compatible: true },
      summary: { missingCount: 0, invalidCount: 0 },
    });
    expect(reference).toMatchObject({
      contractName: 'AzPrWorkbenchGameDataReference',
      status: 'workbench-game-data-reference-ready',
      ready: true,
      referenceIdentity: expect.stringMatching(/^azpr-game-data-v1-/u),
      actors: expect.arrayContaining([
        expect.objectContaining({
          character: expect.objectContaining({
            status: 'exact',
            source: expect.stringContaining('hero-modules'),
            record: expect.objectContaining({
              id: state.actorConfigs[0].characterId,
            }),
          }),
          loadout: expect.objectContaining({
            ready: true,
            appliedToCalculators: false,
            references: expect.objectContaining({
              kibo: expect.objectContaining({
                status: 'exact',
                record: expect.objectContaining({ name: expect.any(String) }),
              }),
              weapon: expect.objectContaining({
                status: 'exact',
                expectedType: '武器',
                record: expect.objectContaining({ type: '武器' }),
              }),
              soulessence: expect.objectContaining({
                status: 'exact',
                record: expect.objectContaining({ rarity: expect.any(String) }),
              }),
            }),
          }),
        }),
      ]),
      enemy: expect.objectContaining({
        status: 'exact',
        source: expect.stringContaining('enemy.json'),
        record: expect.objectContaining({ id: state.selection.enemyId }),
      }),
      policy: {
        resolvedCatalogRecordsOnly: true,
        loadoutEffectsAppliedToCalculators: false,
      },
    });
  });

  it('rejects missing references and wrong equipment slot types across scenarios', () => {
    const state = createConfiguredState();
    const incompatibleScenario = JSON.parse(
      JSON.stringify(state.scenarioWorkspace.scenarios[0])
    );
    incompatibleScenario.id = 'scenario-incompatible';
    incompatibleScenario.name = '数据缺口方案';
    incompatibleScenario.draft.actorConfigs[0].loadout.kiboId = 999999999;
    incompatibleScenario.draft.actorConfigs[0].loadout.equipment.top =
      getWorkbenchLoadoutOptions().equipment.weapon[0].id;
    state.scenarioWorkspace.scenarios.push(incompatibleScenario);
    const report = createWorkbenchGameDataCompatibilityReport(state);

    expect(report).toMatchObject({
      status: 'workbench-game-data-compatibility-invalid',
      importAllowed: false,
      scenarios: expect.arrayContaining([
        expect.objectContaining({
          status: 'invalid',
          compatible: false,
          summary: expect.objectContaining({
            missingCount: 1,
            invalidCount: 1,
          }),
        }),
      ]),
    });
    const incompatibleReport = report.scenarios.find(
      scenario => scenario.scenarioId === 'scenario-incompatible'
    );
    expect(incompatibleReport.references).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'actorConfigs[0].loadout.kiboId',
          status: 'missing',
          requestedId: 999999999,
        }),
        expect.objectContaining({
          path: 'actorConfigs[0].loadout.equipment.top',
          status: 'invalid',
          expectedType: '上装',
          resolvedType: '武器',
        }),
      ])
    );
  });

  it('allows a resolvable legacy project but rejects a stale persisted data version', () => {
    const legacy = createDefaultWorkbenchDraftState();
    delete legacy.gameDataBinding;
    const stale = createDefaultWorkbenchDraftState();
    stale.gameDataBinding.dataVersion = '2026-01-01T00:00:00.000Z';

    expect(createWorkbenchGameDataCompatibilityReport(legacy)).toMatchObject({
      status: 'workbench-game-data-compatibility-legacy',
      importAllowed: true,
      binding: {
        status: 'legacy',
        reason: 'legacy-project-without-game-data-binding',
      },
    });
    expect(createWorkbenchGameDataCompatibilityReport(stale)).toMatchObject({
      status: 'workbench-game-data-compatibility-stale',
      importAllowed: false,
      binding: {
        status: 'stale',
        reason: 'game-data-version-changed',
      },
    });
  });

  it('retains raw import incompatibility after normalizers remove an unknown loadout id', () => {
    const raw = JSON.parse(JSON.stringify(createDefaultWorkbenchDraftState()));
    raw.actorConfigs[0].loadout.kiboId = 999999999;
    const parsed = parseWorkbenchProjectFile(raw);

    expect(parsed.actorConfigs[0].loadout.kiboId).toBeNull();
    expect(getWorkbenchGameDataCompatibilityReport(parsed)).toMatchObject({
      status: 'workbench-game-data-compatibility-missing',
      importAllowed: false,
      summary: { missingCount: 1 },
    });
    parsed.actorConfigs[0].loadout.kiboId = 888888888;
    expect(
      getWorkbenchGameDataCompatibilityReport(parsed).scenarios[0].references
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestedId: 888888888,
          status: 'missing',
        }),
      ])
    );
  });

  it('carries resolved records into compiler and runtime binding without applying loadout effects', () => {
    const state = createConfiguredState();
    const compatibility = createWorkbenchGameDataCompatibilityReport(state);
    const project = createWorkbenchProject(state.selection, {
      ...state,
      actions: state.actionDrafts,
      gameDataCompatibilityReport: compatibility,
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const actorSource = scenario.mechanismConfiguration.actors[0];

    expect(scenario).toMatchObject({
      gameDataCatalog: {
        catalogId: 'azpr-workbench-game-data',
        dataVersion: state.gameDataBinding.dataVersion,
        status: 'workbench-game-data-reference-ready',
        referenceIdentity: expect.stringMatching(/^azpr-game-data-v1-/u),
      },
      gameDataCompatibility: {
        status: 'workbench-game-data-compatibility-exact',
        compatible: true,
        importAllowed: true,
      },
      mechanismConfiguration: {
        schemaVersion: 3,
        ready: true,
        gameDataReferenceContract: {
          ready: true,
          policy: { loadoutEffectsAppliedToCalculators: false },
        },
        runtimeBinding: {
          schemaVersion: 2,
          gameData: {
            catalogId: 'azpr-workbench-game-data',
            dataVersion: state.gameDataBinding.dataVersion,
            ready: true,
            replaceable: true,
          },
        },
      },
    });
    expect(actorSource.gameDataReference.record.id).toBe(
      state.actorConfigs[0].characterId
    );
    expect(actorSource.loadout.gameDataReferences.kibo.record.id).toBe(
      state.actorConfigs[0].loadout.kiboId
    );
    expect(actorSource.application.loadout.appliedToCalculators).toBe(false);
    expect(
      scenario.mechanismConfiguration.enemy.gameDataReference.record.id
    ).toBe(state.selection.enemyId);
  });
});

function createConfiguredState() {
  const state = createDefaultWorkbenchDraftState();
  const options = getWorkbenchLoadoutOptions();
  state.actorConfigs[0].loadout = {
    kiboId: options.kibos[0].id,
    equipment: {
      weapon: options.equipment.weapon[0].id,
      top: options.equipment.top[0].id,
      bottom: options.equipment.bottom[0].id,
      earring: options.equipment.earring[0].id,
      ring: options.equipment.ring[0].id,
    },
    soulessenceId: options.soulessences[0].id,
  };
  state.scenarioWorkspace.scenarios[0].draft.actorConfigs = JSON.parse(
    JSON.stringify(state.actorConfigs)
  );
  const configuration = reconcileWorkbenchConfigurationState({
    ...state,
    syncSelectedValues: true,
  });
  state.configurationLibrary = configuration.configurationLibrary;
  state.configurationSelection = configuration.configurationSelection;
  state.actorConfigs = configuration.actorConfigs;
  state.enemyConfig = configuration.enemyConfig;
  state.scenarioWorkspace.scenarios[0].draft.actorConfigs = JSON.parse(
    JSON.stringify(state.actorConfigs)
  );
  return state;
}
