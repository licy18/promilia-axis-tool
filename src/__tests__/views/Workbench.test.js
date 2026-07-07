import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { beforeEach, describe, expect, it } from 'vitest';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import { WORKBENCH_DRAFT_STORAGE_KEY } from '../../domain/workbenchDraftStorage';
import Workbench from '../../views/Workbench.vue';

describe('Workbench view', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the first real-data simulation slice', () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    const text = wrapper.text();

    expect(text).toContain('工作台：末音 / 哈库茵剑舞 / 迅狼');
    expect(text).toContain('末音');
    expect(text).toContain('迅狼');
    expect(text).toContain('哈库茵剑舞');
    expect(text).toContain('DAMAGE_PROJECTED');
    expect(text).toContain('stage3-raw-attack-multiplier-v1');
    expect(text).toContain('low');
  });

  it('updates simulation output when editable controls change', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondEnemy = workbenchSeed.gameData.enemies.find((enemy) => enemy.id !== workbenchSeed.defaults.enemyId);

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    expect(wrapper.text()).toContain('714%');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('1200');
    expect(wrapper.text()).toContain('1200ms');

    await wrapper.find('[data-testid="workbench-enemy-select"]').setValue(String(secondEnemy.id));
    expect(wrapper.text()).toContain(secondEnemy.name);
  });

  it('rebuilds the workbench project when the selected character changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const nextCharacter = workbenchSeed.gameData.characters.find(
      (character) => character.id !== workbenchSeed.defaults.characterId,
    );
    const nextSkill = workbenchSeed.gameData.skills.find((skill) => skill.characterId === nextCharacter.id);

    await wrapper.find('[data-testid="workbench-character-select"]').setValue(String(nextCharacter.id));

    expect(wrapper.text()).toContain(`工作台：${nextCharacter.name} / ${nextSkill.name}`);
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
  });

  it('adds, selects, edits, and deletes timeline actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('2');
    expect(wrapper.findAll('[data-testid="workbench-delete-action"]')).toHaveLength(2);

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('2400');
    expect(wrapper.text()).toContain('2400ms');

    await wrapper.findAll('[data-testid="workbench-delete-action"]')[1].trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('1 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
  });

  it('copies the selected action and tracks unsaved draft changes', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('未保存草稿');

    await wrapper.find('[data-testid="workbench-copy-action"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('1000');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('已保存草稿');

    await wrapper.find('[data-testid="workbench-level-input"]').setValue('2');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');
  });

  it('nudges and deletes timeline actions with keyboard shortcuts', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-copy-action"]').trigger('click');
    let timelineActions = wrapper.findAll('[data-testid="workbench-timeline-action"]');

    await timelineActions[1].trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('1500');

    timelineActions = wrapper.findAll('[data-testid="workbench-timeline-action"]');
    await timelineActions[1].trigger('keydown', { key: 'ArrowLeft', shiftKey: true });
    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('0');

    timelineActions = wrapper.findAll('[data-testid="workbench-timeline-action"]');
    await timelineActions[1].trigger('keydown', { key: 'Delete' });

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('1 action');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');
  });

  it('adds wait and annotation actions without projecting extra damage', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-wait-action"]').trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-action-type"]').element.value).toBe('等待动作');
    expect(wrapper.find('[data-testid="workbench-duration-input"]').element.value).toBe('1000');

    await wrapper.find('[data-testid="workbench-duration-input"]').setValue('1500');
    await wrapper.find('[data-testid="workbench-note-input"]').setValue('等技能冷却');
    expect(wrapper.text()).toContain('WAIT');
    expect(wrapper.text()).toContain('1500ms / 等技能冷却');

    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('3 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-action-type"]').element.value).toBe('注释动作');

    await wrapper.find('[data-testid="workbench-note-input"]').setValue('准备爆发');
    expect(wrapper.text()).toContain('ANNOTATION');
    expect(wrapper.text()).toContain('准备爆发');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
  });

  it('edits enemy parameters and reads resource events from simulation', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const spSkill = workbenchSeed.gameData.skills.find((skill) => Number(skill.spCost) > 0);

    expect(wrapper.find('[data-testid="workbench-enemy-level"]').text()).toBe('Lv.80');
    expect(wrapper.find('[data-testid="workbench-resource-event-count"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="workbench-resource-empty"]').text()).toBe('暂无资源事件');

    await wrapper.find('[data-testid="workbench-enemy-level-input"]').setValue('95');
    await wrapper.find('[data-testid="workbench-enemy-hp-multiplier-input"]').setValue('2');
    await wrapper.find('[data-testid="workbench-enemy-defense-multiplier-input"]').setValue('1.5');

    expect(wrapper.find('[data-testid="workbench-enemy-level"]').text()).toBe('Lv.95');
    expect(wrapper.text()).toContain('2x / 1.5x');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');

    await wrapper.find('[data-testid="workbench-character-select"]').setValue(String(spSkill.characterId));
    await nextTick();
    await wrapper.find('[data-testid="workbench-skill-select"]').setValue(String(spSkill.id));

    expect(wrapper.find('[data-testid="workbench-resource-event-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-resource-sp-total"]').text()).toBe(`-${spSkill.spCost}`);
    expect(wrapper.text()).toContain('RESOURCE_CHANGE');
  });

  it('adds resource and enemy event actions without projecting extra damage', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-resource-action"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-action-type"]').element.value).toBe('资源动作');
    expect(wrapper.find('[data-testid="workbench-resource-change-input"]').element.value).toBe('50');

    await wrapper.find('[data-testid="workbench-resource-change-input"]').setValue('-35');
    await wrapper.find('[data-testid="workbench-resource-reason-input"]').setValue('manual-test');
    await wrapper.find('[data-testid="workbench-note-input"]').setValue('扣除测试资源');

    expect(wrapper.find('[data-testid="workbench-resource-event-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-resource-sp-total"]').text()).toBe('-35');
    expect(wrapper.text()).toContain('RESOURCE_CHANGE');
    expect(wrapper.text()).toContain('SP -35 / manual-test');

    await wrapper.find('[data-testid="workbench-add-enemy-event-action"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('3 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-action-type"]').element.value).toBe('敌人事件');

    await wrapper.find('[data-testid="workbench-enemy-event-type-input"]').setValue('phase-2');
    await wrapper.find('[data-testid="workbench-note-input"]').setValue('进入二阶段');

    expect(wrapper.text()).toContain('ENEMY_EVENT');
    expect(wrapper.text()).toContain('phase-2 / 进入二阶段');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');
  });

  it('keeps generated action ids unique after deleting the first action', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    await wrapper.findAll('[data-testid="workbench-delete-action"]')[0].trigger('click');
    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    const actionIds = wrapper.findAll('.action-item').map((action) => action.attributes('data-action-id'));
    expect(actionIds).toEqual(['action-0002', 'action-0003']);
    expect(new Set(actionIds).size).toBe(actionIds.length);
  });

  it('drags a timeline action and snaps its start time', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const lane = wrapper.find('[data-testid="workbench-timeline-lane"]').element;
    lane.getBoundingClientRect = () => ({
      width: 600,
      height: 210,
      left: 0,
      right: 600,
      top: 0,
      bottom: 210,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 1 });
    wrapper.find('[data-testid="workbench-timeline-action"]').element.dispatchEvent(pointerDown);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 169 }));
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 169 }));
    await nextTick();

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('3500');
    expect(wrapper.text()).toContain('3500ms');
    expect(wrapper.text()).toContain('DAMAGE_PROJECTED');
  });

  it('saves, restores, and resets a versioned workbench draft', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    await wrapper.find('[data-testid="workbench-start-input"]').setValue('2400');
    await wrapper.find('[data-testid="workbench-enemy-level-input"]').setValue('95');
    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');

    const rawDraft = window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY);
    const draft = JSON.parse(rawDraft);
    expect(rawDraft).not.toContain('skillBlocks');
    expect(draft).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'workbench-draft',
      enemyConfig: {
        level: 95,
      },
      selectedActionId: 'action-0002',
    });
    expect(draft.actionDrafts).toHaveLength(2);
    expect(draft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      startMs: 2400,
    });
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('已保存草稿');
    wrapper.unmount();

    const restored = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    await nextTick();

    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe('已恢复草稿');
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(restored.find('[data-testid="workbench-start-input"]').element.value).toBe('2400');
    expect(restored.find('[data-testid="workbench-enemy-level"]').text()).toBe('Lv.95');

    await restored.find('[data-testid="workbench-reset-draft"]').trigger('click');

    expect(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY)).toBeNull();
    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe('已重置草稿');
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe('1 action');
    expect(restored.find('[data-testid="workbench-start-input"]').element.value).toBe('0');
    expect(restored.find('[data-testid="workbench-enemy-level"]').text()).toBe('Lv.80');
  });
});
