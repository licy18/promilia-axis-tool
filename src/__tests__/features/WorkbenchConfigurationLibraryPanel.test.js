import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchConfigurationLibraryPanel from '../../features/workbench/WorkbenchConfigurationLibraryPanel.vue';

describe('WorkbenchConfigurationLibraryPanel', () => {
  it('selects, duplicates, renames, and deletes active configuration instances', async () => {
    const wrapper = mount(WorkbenchConfigurationLibraryPanel, {
      props: {
        library: {
          schemaVersion: 1,
          actorInstances: [
            createActorInstance('actor-config-0001', '末音配置 1'),
            createActorInstance('actor-config-0002', '末音配置 2'),
            createActorInstance('actor-config-0003', '寒悠悠配置', 101003),
          ],
          enemyInstances: [
            createEnemyInstance('enemy-config-0001', '迅狼配置 1'),
            createEnemyInstance('enemy-config-0002', '迅狼配置 2'),
          ],
        },
        selection: {
          schemaVersion: 1,
          actorInstanceIds: [
            { characterId: 109001, instanceId: 'actor-config-0001' },
            { characterId: 101003, instanceId: 'actor-config-0003' },
          ],
          enemyInstanceId: 'enemy-config-0001',
        },
        actors: [
          { id: 'actor-109001', characterId: 109001, name: '末音' },
          { id: 'actor-101003', characterId: 101003, name: '寒悠悠' },
        ],
        enemy: { id: 300032, name: '迅狼' },
        enemyId: 300032,
      },
    });

    await wrapper
      .find(
        '[data-testid="workbench-actor-configuration-select"][data-character-id="109001"]'
      )
      .setValue('actor-config-0002');
    await wrapper
      .find(
        '[data-testid="workbench-actor-configuration-name"][data-character-id="109001"]'
      )
      .setValue('末音爆发配置');
    await wrapper
      .find(
        '[data-testid="workbench-actor-configuration-duplicate"][data-character-id="109001"]'
      )
      .trigger('click');
    await wrapper
      .find(
        '[data-testid="workbench-actor-configuration-delete"][data-character-id="109001"]'
      )
      .trigger('click');
    await wrapper
      .get('[data-testid="workbench-enemy-configuration-duplicate"]')
      .trigger('click');

    expect(wrapper.emitted('command')).toEqual([
      [
        {
          kind: 'actor',
          action: 'select',
          characterId: 109001,
          instanceId: 'actor-config-0002',
        },
      ],
      [
        {
          kind: 'actor',
          action: 'rename',
          characterId: 109001,
          name: '末音爆发配置',
        },
      ],
      [{ kind: 'actor', action: 'duplicate', characterId: 109001 }],
      [{ kind: 'actor', action: 'delete', characterId: 109001 }],
      [{ kind: 'enemy', action: 'duplicate', enemyId: 300032 }],
    ]);
    expect(
      wrapper
        .find(
          '[data-testid="workbench-actor-configuration-delete"][data-character-id="101003"]'
        )
        .attributes('disabled')
    ).toBeDefined();
  });
});

function createActorInstance(id, name, characterId = 109001) {
  return {
    id,
    name,
    characterId,
    actorConfig: {
      characterId,
      level: 30,
      initialSp: null,
      loadout: { kiboId: null, equipment: {}, soulessenceId: null },
    },
  };
}

function createEnemyInstance(id, name) {
  return {
    id,
    name,
    enemyId: 300032,
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
