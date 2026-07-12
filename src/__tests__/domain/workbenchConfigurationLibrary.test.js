import { describe, expect, it } from 'vitest';
import {
  applyWorkbenchConfigurationInstanceCommand,
  normalizeWorkbenchConfigurationWorkspace,
  reconcileWorkbenchConfigurationState,
  updateSelectedWorkbenchConfigurationInstance,
} from '../../domain/workbenchConfigurationLibrary';
import {
  DEFAULT_WORKBENCH_SELECTION,
  DEFAULT_WORKBENCH_TEAM_SLOTS,
  createDefaultWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';

describe('Workbench configuration library', () => {
  it('creates selected actor and enemy instances from the current simulation configs', () => {
    const state = createConfigurationState();
    const reconciled = reconcileWorkbenchConfigurationState(state);

    expect(reconciled.configurationLibrary).toMatchObject({
      schemaVersion: 1,
      actorInstances: [
        {
          id: 'actor-config-0001',
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
        },
        {
          id: 'actor-config-0002',
          characterId: DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
        },
        {
          id: 'actor-config-0003',
          characterId: DEFAULT_WORKBENCH_TEAM_SLOTS[2].characterId,
        },
      ],
      enemyInstances: [
        {
          id: 'enemy-config-0001',
          enemyId: DEFAULT_WORKBENCH_SELECTION.enemyId,
        },
      ],
    });
    expect(reconciled.configurationSelection).toEqual({
      schemaVersion: 1,
      actorInstanceIds: [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          instanceId: 'actor-config-0001',
        },
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
          instanceId: 'actor-config-0002',
        },
        {
          characterId: DEFAULT_WORKBENCH_TEAM_SLOTS[2].characterId,
          instanceId: 'actor-config-0003',
        },
      ],
      enemyInstanceId: 'enemy-config-0001',
    });
  });

  it('duplicates, renames, selects, updates, and deletes reusable instances', () => {
    const initial = createConfigurationState();
    const characterId = DEFAULT_WORKBENCH_SELECTION.characterId;
    const duplicated = applyWorkbenchConfigurationInstanceCommand(initial, {
      kind: 'actor',
      action: 'duplicate',
      characterId,
    });
    expect(duplicated).toMatchObject({
      changed: true,
      instance: {
        id: 'actor-config-0004',
        name: '角色配置 1 副本',
        characterId,
      },
      configurationSelection: {
        actorInstanceIds: expect.arrayContaining([
          { characterId, instanceId: 'actor-config-0004' },
        ]),
      },
    });

    const renamed = applyWorkbenchConfigurationInstanceCommand(duplicated, {
      kind: 'actor',
      action: 'rename',
      characterId,
      name: '末音爆发配置',
    });
    expect(renamed.instance.name).toBe('末音爆发配置');

    const updated = updateSelectedWorkbenchConfigurationInstance(renamed, {
      kind: 'actor',
      characterId,
      config: {
        ...renamed.actorConfigs.find(item => item.characterId === characterId),
        initialSp: 0.75,
      },
    });
    expect(
      updated.configurationLibrary.actorInstances.find(
        item => item.id === 'actor-config-0004'
      ).actorConfig.initialSp
    ).toBe(0.75);
    expect(
      updated.actorConfigs.find(item => item.characterId === characterId)
        .initialSp
    ).toBe(0.75);

    const selectedOriginal = applyWorkbenchConfigurationInstanceCommand(
      updated,
      {
        kind: 'actor',
        action: 'select',
        characterId,
        instanceId: 'actor-config-0001',
      }
    );
    expect(
      selectedOriginal.configurationSelection.actorInstanceIds.find(
        item => item.characterId === characterId
      ).instanceId
    ).toBe('actor-config-0001');

    const deleted = applyWorkbenchConfigurationInstanceCommand(
      selectedOriginal,
      { kind: 'actor', action: 'delete', characterId }
    );
    expect(deleted.changed).toBe(true);
    expect(
      deleted.configurationLibrary.actorInstances.some(
        item => item.id === 'actor-config-0001'
      )
    ).toBe(false);
    expect(
      deleted.configurationSelection.actorInstanceIds.find(
        item => item.characterId === characterId
      ).instanceId
    ).toBe('actor-config-0004');
  });

  it('migrates scenario-local configs into one shared project library', () => {
    const activeDraft = createScenarioDraft({ initialSp: 0.25 });
    const baselineDraft = createScenarioDraft({ initialSp: 0.75 });
    const normalized = normalizeWorkbenchConfigurationWorkspace({
      configurationLibrary: null,
      activeDraft,
      scenarioWorkspace: {
        schemaVersion: 1,
        activeScenarioId: 'scenario-0001',
        scenarios: [
          { id: 'scenario-0001', name: '当前轴', draft: activeDraft },
          { id: 'scenario-0002', name: '基准轴', draft: baselineDraft },
        ],
      },
    });
    const characterId = DEFAULT_WORKBENCH_SELECTION.characterId;
    const actorInstances =
      normalized.configurationLibrary.actorInstances.filter(
        item => item.characterId === characterId
      );

    expect(actorInstances).toHaveLength(2);
    expect(actorInstances.map(item => item.actorConfig.initialSp)).toEqual([
      0.25, 0.75,
    ]);
    expect(
      normalized.scenarioWorkspace.scenarios.map(scenario =>
        scenario.draft.configurationSelection.actorInstanceIds.find(
          item => item.characterId === characterId
        )
      )
    ).toEqual([
      { characterId, instanceId: actorInstances[0].id },
      { characterId, instanceId: actorInstances[1].id },
    ]);
  });
});

function createConfigurationState() {
  return {
    configurationLibrary: null,
    configurationSelection: null,
    selection: { ...DEFAULT_WORKBENCH_SELECTION },
    actorConfigs: createDefaultWorkbenchActorConfigs(
      DEFAULT_WORKBENCH_SELECTION
    ),
    enemyConfig: {
      level: 80,
      hpMultiplier: 1,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
      elementDefenseOverrides: {},
    },
  };
}

function createScenarioDraft({ initialSp }) {
  const state = createConfigurationState();
  return {
    selection: state.selection,
    actorConfigs: state.actorConfigs.map((config, index) => ({
      ...config,
      initialSp: index === 0 ? initialSp : config.initialSp,
    })),
    enemyConfig: state.enemyConfig,
    configurationSelection: null,
  };
}
