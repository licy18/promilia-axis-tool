import { flushPromises, mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import TeamLoadoutPanel from '../../features/workbench/TeamLoadoutPanel.vue';

const actor = {
  id: 'actor-101003',
  characterId: 101003,
  name: '寒悠悠',
  level: 80,
  initialSp: 0,
  stats: { maxSp: 1 },
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

function mountPanel() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ json: async () => detailCatalog })
  );
  return mount(TeamLoadoutPanel, {
    props: {
      actors: [actor],
      characters: [
        {
          id: 101003,
          name: '寒悠悠',
          element: { abbrName: '火' },
          position: { name: '增幅' },
        },
      ],
      teamSlots: [{ slotId: 'slot-1', characterId: 101003 }],
      kibos: [{ id: 500001, name: '迅狼', element: '风', stage: '成熟期' }],
      equipment: {
        weapon: [{ id: 1010111, name: '木制棍棒', rarity: '1星' }],
        top: [],
        bottom: [],
        earring: [],
        ring: [],
      },
      soulessences: [{ id: 10001, name: '汁石就是力量', rarity: 'SR' }],
    },
  });
}

describe('TeamLoadoutPanel', () => {
  it('shows selected source-backed loadout identities and summaries', async () => {
    const wrapper = mountPanel();
    await flushPromises();

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

  it('keeps edits on the existing actor-config contract', async () => {
    const wrapper = mountPanel();
    await wrapper.get('[data-loadout-key="weapon"]').setValue('1010111');

    expect(wrapper.emitted('update-actor-config')?.at(-1)).toEqual([
      {
        characterId: 101003,
        loadout: { equipment: { weapon: 1010111 } },
      },
    ]);
  });
});
