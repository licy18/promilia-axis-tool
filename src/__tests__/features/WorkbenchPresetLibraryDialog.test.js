import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchPresetLibraryDialog from '../../features/workbench/WorkbenchPresetLibraryDialog.vue';

describe('WorkbenchPresetLibraryDialog', () => {
  it('saves the current project and filters ready presets', async () => {
    const wrapper = createWrapper();

    await wrapper
      .find('[data-testid="workbench-preset-name-input"]')
      .setValue('末音双人循环');
    await wrapper
      .find('[data-testid="workbench-preset-tags-input"]')
      .setValue('输出, 双人');
    await wrapper
      .find('[data-testid="workbench-preset-description-input"]')
      .setValue('训练目标轴');
    await wrapper.find('form').trigger('submit');

    expect(wrapper.emitted('save-preset')).toEqual([
      [
        {
          name: '末音双人循环',
          tags: '输出, 双人',
          description: '训练目标轴',
        },
      ],
    ]);

    await wrapper
      .find('[data-testid="workbench-preset-search-input"]')
      .setValue('寒悠悠');
    expect(
      wrapper.findAll('[data-testid="workbench-preset-row"]')
    ).toHaveLength(1);
    expect(
      wrapper.find('[data-testid="workbench-preset-row"]').text()
    ).toContain('末音双人循环');

    await wrapper
      .find('[data-testid="workbench-preset-tag-filter"]')
      .setValue('输出');
    expect(wrapper.find('[data-testid="workbench-preset-count"]').text()).toBe(
      '1 / 2'
    );
  });

  it('loads, duplicates, and deletes ready presets while disabling incompatible ones', async () => {
    const wrapper = createWrapper();
    const readyRow = wrapper.find('[data-preset-id="preset-ready"]');

    await readyRow
      .find('[data-testid="workbench-preset-load"]')
      .trigger('click');
    await readyRow
      .find('[data-testid="workbench-preset-duplicate"]')
      .trigger('click');
    await readyRow
      .find('[data-testid="workbench-preset-delete"]')
      .trigger('click');

    expect(wrapper.emitted('load-preset')).toEqual([['preset-ready']]);
    expect(wrapper.emitted('duplicate-preset')).toEqual([['preset-ready']]);
    expect(wrapper.emitted('delete-preset')).toEqual([['preset-ready']]);

    const incompatibleRow = wrapper.find(
      '[data-preset-id="preset-incompatible"]'
    );
    expect(incompatibleRow.attributes('data-compatibility')).toBe(
      'incompatible-project-schema'
    );
    expect(
      incompatibleRow
        .find('[data-testid="workbench-preset-load"]')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      incompatibleRow
        .find('[data-testid="workbench-preset-duplicate"]')
        .attributes('disabled')
    ).toBeDefined();
  });
});

function createWrapper() {
  return mount(WorkbenchPresetLibraryDialog, {
    props: {
      visible: true,
      defaultName: '当前工作台项目',
      currentSummary: {
        actionCount: 2,
        actorNames: ['末音', '寒悠悠'],
        enemyName: '训练目标',
      },
      presets: [
        {
          id: 'preset-ready',
          name: '末音双人循环',
          description: '训练目标轴',
          tags: ['输出', '双人'],
          updatedAt: '2026-07-10T12:00:00.000Z',
          compatibilityStatus: 'ready',
          summary: {
            actionCount: 2,
            actorNames: ['末音', '寒悠悠'],
            characterIds: [109001, 101003],
            enemyName: '训练目标',
          },
        },
        {
          id: 'preset-incompatible',
          name: '旧版未知结构',
          description: '',
          tags: ['旧版'],
          updatedAt: '2026-07-09T12:00:00.000Z',
          compatibilityStatus: 'incompatible-project-schema',
          summary: {
            actionCount: 0,
            actorNames: [],
            characterIds: [],
            enemyName: '',
          },
        },
      ],
    },
    global: {
      stubs: { Teleport: true },
    },
  });
}
