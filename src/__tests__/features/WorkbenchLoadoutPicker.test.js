import { flushPromises, mount } from '@vue/test-utils';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import WorkbenchLoadoutPicker from '../../features/workbench/WorkbenchLoadoutPicker.vue';

const detailCatalog = {
  equipment: [
    {
      id: 1010111,
      name: '木制棍棒',
      type: '武器',
      icon: 'weapon.png',
      summary: '攻击 74',
    },
    {
      id: 1010201,
      name: '布制上装',
      type: '上装',
      icon: 'top.png',
      summary: '生命 120',
    },
  ],
  kibos: [],
  soulessences: [
    {
      id: 10095,
      name: '甜点时光',
      profession: '增幅',
      icons: {},
      summary: 'SR · 增幅',
    },
    {
      id: 10001,
      name: '汁石就是力量',
      profession: '破坏',
      icons: {},
      summary: 'SR · 破坏',
    },
  ],
};

beforeAll(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => detailCatalog,
    })
  );
});

describe('WorkbenchLoadoutPicker', () => {
  it('loads once, filters by slot, searches by name, and selects a card', async () => {
    const wrapper = mount(WorkbenchLoadoutPicker, {
      props: {
        request: {
          kind: 'equipment',
          actorName: '末音',
          characterId: 109001,
          slotKey: 'weapon',
          slotLabel: '武器',
          selectedId: null,
        },
      },
      global: { stubs: { teleport: true } },
    });
    await flushPromises();

    const options = wrapper.findAll('[data-testid="workbench-loadout-option"]');
    expect(options).toHaveLength(1);
    expect(options[0].text()).toContain('木制棍棒');
    expect(wrapper.emitted('catalog-loaded')).toHaveLength(1);

    await wrapper
      .get('[data-testid="workbench-loadout-search"]')
      .setValue('不存在');
    expect(wrapper.text()).toContain('没有匹配的资料');
    await wrapper
      .get('[data-testid="workbench-loadout-search"]')
      .setValue('木制');
    await wrapper
      .get('[data-testid="workbench-loadout-option"]')
      .trigger('click');
    expect(wrapper.emitted('select')?.at(-1)).toEqual([1010111]);
    wrapper.unmount();
  });

  it('marks characters already assigned to the three fixed slots', async () => {
    const wrapper = mount(WorkbenchLoadoutPicker, {
      props: {
        request: {
          kind: 'character',
          slotId: 'team-slot-3',
          selectedId: 101007,
        },
        characters: [
          { id: 109001, name: '末音' },
          { id: 101003, name: '寒悠悠' },
          { id: 101007, name: '芃芃' },
          { id: 101010, name: '涂山小玉' },
        ],
        teamSlots: [
          { slotId: 'team-slot-1', characterId: 109001 },
          { slotId: 'team-slot-2', characterId: 101003 },
          { slotId: 'team-slot-3', characterId: 101007 },
        ],
      },
      global: { stubs: { teleport: true } },
    });
    await flushPromises();

    expect(wrapper.text()).toContain('队伍槽位 3');
    expect(wrapper.text()).toContain('当前槽位');
    expect(wrapper.text()).not.toContain('NaN');
    wrapper.unmount();
  });

  it('locks background scrolling while the modal is mounted', async () => {
    document.body.style.overflow = 'auto';
    const wrapper = mount(WorkbenchLoadoutPicker, {
      props: {
        request: {
          kind: 'soulessence',
          selectedId: null,
        },
      },
      global: { stubs: { teleport: true } },
    });
    await flushPromises();

    expect(document.body.style.overflow).toBe('hidden');
    wrapper.unmount();
    expect(document.body.style.overflow).toBe('auto');
    document.body.style.overflow = '';
  });

  it('marks soulessence profession mismatch while keeping the option selectable', async () => {
    const mismatchedWrapper = mount(WorkbenchLoadoutPicker, {
      props: {
        request: {
          kind: 'soulessence',
          characterId: 109001,
          selectedId: null,
        },
        characters: [
          { id: 109001, name: '末音', position: { name: '猛攻' } },
        ],
      },
      global: { stubs: { teleport: true } },
    });
    await flushPromises();

    const options = mismatchedWrapper.findAll(
      '[data-testid="workbench-loadout-option"]'
    );
    const mismatched = options.find(option => option.text().includes('甜点时光'));
    expect(mismatched.classes()).toContain('mismatch');
    expect(mismatched.text()).toContain(
      '职业不匹配：增幅 仅数值加成，技能不激活'
    );
    await mismatched.trigger('click');
    expect(mismatchedWrapper.emitted('select')?.at(-1)).toEqual([10095]);
    mismatchedWrapper.unmount();

    const matchedWrapper = mount(WorkbenchLoadoutPicker, {
      props: {
        request: {
          kind: 'soulessence',
          characterId: 102001,
          selectedId: null,
        },
        characters: [
          { id: 102001, name: '涂山小玉', position: { name: '增幅' } },
        ],
      },
      global: { stubs: { teleport: true } },
    });
    await flushPromises();
    const matched = matchedWrapper
      .findAll('[data-testid="workbench-loadout-option"]')
      .find(option => option.text().includes('甜点时光'));
    expect(matched.classes()).not.toContain('mismatch');
    expect(matched.text()).not.toContain('职业不匹配');
    matchedWrapper.unmount();
  });
});
