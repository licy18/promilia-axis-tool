import { mount } from '@vue/test-utils';
import EnemyPanel from '../../features/workbench/EnemyPanel.vue';

function createEnemy(patch = {}) {
  return {
    id: 'enemy-300032',
    enemyId: 300032,
    name: '迅狼',
    icon: null,
    level: 80,
    hpMultiplier: 2,
    defenseMultiplier: 1.5,
    toughnessMultiplier: 1,
    effectiveStats: {
      attack: 14970.4044,
      maxHp: 173557.3968,
      physicalDefense: 1215,
      magicalDefense: 1215,
      initialToughness: 26822.0077,
      maxToughness: 26822.0077,
    },
    levelScaling: {
      status: 'ready',
      source: {
        enemyPackId: 300032,
        templateId: 1,
        templateValueId: 3001080,
      },
    },
    toughness: {
      sourceStatus: 'toughness-config-derived-from-client-level-growth',
    },
    elementDefenses: [],
    elementDefenseConfig: { formulaStatus: 'project-config-only' },
    ...patch,
  };
}

function mountPanel(enemy) {
  return mount(EnemyPanel, {
    props: {
      enemy,
      enemyConfig: {
        level: enemy.level,
        hpMultiplier: enemy.hpMultiplier,
        defenseMultiplier: enemy.defenseMultiplier,
        toughnessMultiplier: enemy.toughnessMultiplier,
        initialToughnessRatio: 1,
        elementDefenseOverrides: {},
      },
      enemies: [{ id: 300032, name: '迅狼' }],
      enemyId: 300032,
    },
  });
}

describe('EnemyPanel enemy level source status', () => {
  it('shows the effective post-growth and post-multiplier panel', () => {
    const wrapper = mountPanel(createEnemy());

    expect(
      wrapper.get('[data-testid="workbench-enemy-level-source-status"]').text()
    ).toContain('客户端等级属性已应用');
    expect(wrapper.text()).toContain('template_value 3001080');
    expect(wrapper.text()).toContain('173,557');
    expect(wrapper.text()).toContain('1,215');
    expect(wrapper.text()).not.toContain('8,628');
  });

  it('does not label a raw template as an effective panel when evidence is missing', () => {
    const wrapper = mountPanel(
      createEnemy({
        effectiveStats: {
          attack: null,
          maxHp: null,
          physicalDefense: null,
          magicalDefense: null,
          initialToughness: null,
          maxToughness: null,
        },
        levelScaling: { status: 'missing-enemy-level-row' },
      })
    );

    expect(
      wrapper.get('[data-testid="workbench-enemy-level-source-status"]').text()
    ).toContain('等级属性证据不足，已停止投影');
    expect(wrapper.text()).toContain('missing-enemy-level-row');
    expect(wrapper.text()).toContain('暂无有效值');
  });
});
