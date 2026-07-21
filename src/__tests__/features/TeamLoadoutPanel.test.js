import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import TeamLoadoutPanel from '../../features/workbench/TeamLoadoutPanel.vue';

const actor = {
  id: 'actor-101003',
  characterId: 101003,
  name: '寒悠悠',
  level: 80,
  initialSp: 0,
  stats: { maxSp: 100, spValueUnit: 'absolute-sp-points' },
  loadout: {
    kiboId: 500001,
    equipment: {
      weapon: 1010111,
      top: null,
      bottom: null,
      earring: null,
      ring: null,
    },
    soulessenceId: 10001,
  },
};
const detailCatalog = {
  equipment: [
    {
      id: 1010111,
      name: '木制棍棒',
      icon: 'equipment.png',
      summary: '攻击 74 / 攻击 25',
    },
  ],
  kibos: [
    {
      id: 500001,
      name: '迅狼',
      icon: 'kibo.png',
      fallbackIcon: 'kibo-skill.png',
      summary: '风 · 成熟期 · 迅风刃',
    },
  ],
  soulessences: [
    {
      id: 10001,
      name: '汁石就是力量',
      icons: { small: 'soulessence.png' },
      summary: 'SR · 破坏 · 基础攻击 1551 · 攻击 28.6%',
    },
  ],
};

function mountPanel(actorOverrides = {}) {
  const configuredActor = {
    ...actor,
    ...actorOverrides,
    loadout: {
      ...actor.loadout,
      ...(actorOverrides.loadout ?? {}),
    },
  };
  return mount(TeamLoadoutPanel, {
    props: {
      actors: [configuredActor],
      teamSlots: [{ slotId: 'slot-1', characterId: 101003 }],
      loadoutDetailCatalog: detailCatalog,
    },
  });
}

describe('TeamLoadoutPanel', () => {
  it('shows selected source-backed loadout identities and summaries', async () => {
    const wrapper = mountPanel();
    const detail = wrapper.get(
      '[data-testid="workbench-actor-loadout-detail"]'
    );
    expect(detail.text()).toContain('迅狼');
    expect(detail.text()).toContain('木制棍棒');
    expect(detail.text()).toContain('攻击 74 / 攻击 25');
    expect(detail.text()).toContain('汁石就是力量');
    expect(detail.text()).toContain('基础攻击');
    expect(wrapper.get('.actor-avatar').attributes('src')).toBe(
      '/assets/characters/101003.png'
    );
    expect(
      detail.get('[data-loadout-detail-kind="kibo"] img').attributes('src')
    ).toBe('/assets/loadout/kibo.png');
    expect(
      detail.get('[data-loadout-detail-kind="equipment"] img').attributes('src')
    ).toBe('/assets/loadout/equipment.png');
  });

  it('keeps advanced values on the existing actor-config contract', async () => {
    const wrapper = mountPanel();
    await wrapper
      .get('[data-testid="workbench-actor-initial-sp-input"]')
      .setValue('72');

    expect(
      wrapper
        .get('[data-testid="workbench-actor-initial-sp-input"]')
        .attributes()
    ).toMatchObject({ max: '100', step: '1' });

    expect(wrapper.emitted('update-actor-config')?.at(-1)).toEqual([
      {
        characterId: 101003,
        initialSp: 72,
      },
    ]);
  });

  it('shows compiled actor and kibo values and emits source configuration patches', async () => {
    const wrapper = mountPanel({
      cultivation: { starGiftRank: 2, favorabilityLevel: 5 },
      loadout: {
        equipmentLevels: { weapon: 9 },
        soulessenceLevel: 100,
        soulessenceRank: 6,
        kiboConfig: {
          level: 80,
          hobbyId: 1,
          intimacyLevel: 5,
          comprehensionByAttribute: { 1: 100, 3: 100, 4: 100, 5: 100 },
        },
      },
      verifiedStaticProperties: {
        status: 'verified-static-actor-properties-ready',
        ready: true,
        level: 80,
        core: {
          ATK: { displayValue: 2048 },
          MAXHP: { displayValue: 12000 },
          DEF: { displayValue: 420 },
          MDEF: { displayValue: 390 },
        },
        attributes: [
          { id: 7, key: 'CRI', rawScale: 10000, runtimeValue: 0.12 },
          { id: 8, key: 'CRI_DMG', rawScale: 10000, runtimeValue: 1.6 },
        ],
        sources: [
          {
            kind: 'equipment-main',
            sourceId: '1010111:weapon:9',
            sourceIdentity: 'NewTable/accessory_main#1010111@9',
            attributes: [{ id: 7, value: 1200 }],
          },
        ],
        unresolved: [],
        unapplied: [
          {
            kind: 'soulessence-effect-skill',
            sourceId: 800601,
            sourceIdentity: 'NewTable/skill#800601',
          },
        ],
      },
      verifiedStaticKiboProperties: {
        status: 'verified-static-kibo-properties-ready',
        ready: true,
        core: {
          ATK: { displayValue: 1800 },
          MAXHP: { displayValue: 7000 },
          DEF: { displayValue: 180 },
          MDEF: { displayValue: 170 },
        },
        inheritance: {
          rate: 0.13,
          core: {
            ATK: { inheritedBase: 240, inheritedAdd: 26 },
          },
        },
      },
    });

    expect(
      wrapper.get('[data-testid="workbench-verified-static-property-panel"]').text()
    ).toContain('2,048');
    expect(
      wrapper.get('[data-testid="workbench-verified-kibo-property-panel"]').text()
    ).toContain('1,800');
    expect(wrapper.text()).toContain('动态层未应用');

    await wrapper.get('[data-testid="workbench-actor-level-input"]').setValue('90');
    await wrapper
      .get('[data-testid="workbench-actor-star-gift-rank-input"]')
      .setValue('3');
    await wrapper.get('[data-testid="workbench-kibo-level-input"]').setValue('90');
    await wrapper
      .get('[data-testid="workbench-equipment-level-input"]')
      .setValue('6');
    await wrapper
      .get('[data-testid="workbench-soulessence-rank-input"]')
      .setValue('5');

    expect(wrapper.emitted('update-actor-config')).toEqual(
      expect.arrayContaining([
        [{ characterId: 101003, level: 90 }],
        [{ characterId: 101003, cultivation: { starGiftRank: 3 } }],
        [
          {
            characterId: 101003,
            loadout: { kiboConfig: { level: 90 } },
          },
        ],
        [
          {
            characterId: 101003,
            loadout: { equipmentLevels: { weapon: 6 } },
          },
        ],
        [
          {
            characterId: 101003,
            loadout: { soulessenceRank: 5 },
          },
        ],
      ])
    );
  });
});
