import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';

describe('three value mechanism configuration', () => {
  it('compiles selected Workbench instances into explicit mechanism sources', () => {
    const scenario = compileProject(
      createConfiguredProject({ includeInstanceSelection: true }),
      getWorkbenchGameData()
    );

    expect(scenario.mechanismConfiguration).toMatchObject({
      schemaVersion: 1,
      sourceKind: 'workbench-v13-configuration-instances',
      contractName: 'AzPrThreeValueMechanismConfiguration',
      status: 'mechanism-configuration-ready',
      ready: true,
      actors: expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-109001',
          characterId: 109001,
          configurationInstanceId: 'actor-config-burst',
          sourceStatus: 'workbench-actor-configuration-instance-resolved',
          initialSp: 0.5,
          loadout: expect.objectContaining({
            kiboId: 500001,
            soulessenceId: 10001,
            selectedItemCount: 3,
            appliedToCalculators: false,
          }),
          application: {
            stats: {
              status: 'compiled-actor-stats-applied',
              appliedToCalculators: true,
            },
            initialEnergy: {
              status: 'project-initial-sp-applied-to-runtime-baseline',
              appliedToRuntime: true,
            },
            loadout: {
              status: 'project-loadout-effects-unconfirmed-unapplied',
              appliedToCalculators: false,
            },
          },
        }),
      ]),
      enemy: expect.objectContaining({
        targetId: 'enemy-300032',
        enemyId: 300032,
        configurationInstanceId: 'enemy-config-challenge',
        hpMultiplier: 2,
        defenseMultiplier: 1.5,
        toughnessMultiplier: 2,
        initialToughnessRatio: 0.5,
        elementDefense: {
          overrideCount: 1,
          overrides: { FIRE_DEFENSE: 0.25 },
        },
        application: expect.objectContaining({
          hpBaseline: expect.objectContaining({ appliedToRuntime: true }),
          defensePreview: expect.objectContaining({
            appliedToCalculators: true,
          }),
          toughnessBaseline: expect.objectContaining({
            appliedToRuntime: true,
          }),
          level: expect.objectContaining({ appliedToCalculators: false }),
          elementDefense: expect.objectContaining({
            appliedToCalculators: false,
          }),
        }),
      }),
      policy: {
        resolvedProjectValuesOnly: true,
        unconfirmedCultivationEffectsApplied: false,
        calculatorReadsConfigurationLibrary: false,
      },
      summary: {
        actorConfigurationCount: 2,
        actorInstanceBackedCount: 2,
        enemyInstanceBacked: true,
        unappliedLoadoutSelectionCount: 3,
        elementDefenseOverrideCount: 1,
      },
    });
  });

  it('passes the resolved configuration to generation and runtime adapters without changing deltas', () => {
    const configuredScenario = compileProject(
      createConfiguredProject({ includeInstanceSelection: true }),
      getWorkbenchGameData()
    );
    const directScenario = compileProject(
      createConfiguredProject({ includeInstanceSelection: false }),
      getWorkbenchGameData()
    );
    const configured = simulateScenario(configuredScenario);
    const direct = simulateScenario(directScenario);
    const delta = configured.threeValueGenerationLayer.deltas.find(
      item => item.applied
    );
    const runtimeDelta =
      configured.threeValueRuntimeProjection.runtimeAppliedDeltas.find(
        item => item.sourceDeltaId === delta.id
      );

    expect(configured.threeValueRuntimeProjection.summary).toMatchObject({
      enemyHpDelta: direct.threeValueRuntimeProjection.summary.enemyHpDelta,
      enemyToughnessDelta:
        direct.threeValueRuntimeProjection.summary.enemyToughnessDelta,
      selfEnergyDelta:
        direct.threeValueRuntimeProjection.summary.selfEnergyDelta,
      mechanismConfigurationReadyDeltaCount: 1,
      mechanismConfigurationMissingDeltaCount: 0,
      configurationInstanceIds: [
        'actor-config-burst',
        'enemy-config-challenge',
      ],
      runtimeMechanismConfigurationReadyInvocationCount: 1,
      runtimeMechanismConfigurationMissingInvocationCount: 0,
      runtimeConfigurationInstanceIds: [
        'actor-config-burst',
        'enemy-config-challenge',
      ],
    });
    expect(
      configured.threeValueRuntimeProjection.runtimeInput.summary
    ).toMatchObject({
      mechanismConfigurationReadyDeltaCount: 1,
      mechanismConfigurationMissingDeltaCount: 0,
      mechanismConfigurationStatuses: ['mechanism-configuration-context-ready'],
      configurationInstanceIds: [
        'actor-config-burst',
        'enemy-config-challenge',
      ],
    });
    expect(delta).toMatchObject({
      mechanismConfigurationReady: true,
      mechanismConfigurationStatus: 'mechanism-configuration-context-ready',
      mechanismContext: {
        schemaVersion: 2,
        configuration: {
          sourceKind: 'workbench-v13-configuration-instances',
          sourceActor: {
            configurationInstanceId: 'actor-config-burst',
          },
          targetEnemy: {
            configurationInstanceId: 'enemy-config-challenge',
          },
        },
      },
      calculator: {
        version: 3,
        mechanismConfigurationReady: true,
        mechanismConfigurationStatus: 'mechanism-configuration-context-ready',
        configurationInstanceIds: [
          'actor-config-burst',
          'enemy-config-challenge',
        ],
      },
    });
    expect(runtimeDelta.runtimeCalculatorInvocation).toMatchObject({
      schemaVersion: 2,
      input: {
        mechanismConfiguration: {
          sourceActor: {
            configurationInstanceId: 'actor-config-burst',
          },
          targetEnemy: {
            configurationInstanceId: 'enemy-config-challenge',
          },
        },
      },
      validation: {
        mechanismContextPreserved: true,
        mechanismConfigurationPreserved: true,
        valid: true,
      },
    });
    expect(directScenario.mechanismConfiguration).toMatchObject({
      sourceKind: 'project-resolved-mechanism-configuration',
      ready: true,
      summary: {
        actorInstanceBackedCount: 0,
        enemyInstanceBacked: false,
      },
    });
  });
});

function createConfiguredProject({ includeInstanceSelection }) {
  return createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    actorConfigs: [
      {
        characterId: 109001,
        initialSp: 0.5,
        loadout: {
          kiboId: 500001,
          equipment: { weapon: 1010111 },
          soulessenceId: 10001,
        },
      },
      { characterId: 101003 },
    ],
    enemyConfig: {
      level: 95,
      hpMultiplier: 2,
      defenseMultiplier: 1.5,
      toughnessMultiplier: 2,
      initialToughnessRatio: 0.5,
      elementDefenseOverrides: { FIRE_DEFENSE: 0.25 },
    },
    configurationSelection: includeInstanceSelection
      ? {
          schemaVersion: 1,
          actorInstanceIds: [
            { characterId: 109001, instanceId: 'actor-config-burst' },
            { characterId: 101003, instanceId: 'actor-config-support' },
          ],
          enemyInstanceId: 'enemy-config-challenge',
        }
      : null,
  });
}
