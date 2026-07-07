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

  it('selects a skill damage segment and saves the projection choice', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const segmentSelect = wrapper.find('[data-testid="workbench-damage-segment-select"]');
    const segmentOptions = Array.from(segmentSelect.element.options).map((option) => option.textContent);

    expect(segmentSelect.element.value).toBe('0');
    expect(segmentOptions).toEqual(expect.arrayContaining(['普攻 / 649%', '重击 / 190%']));

    await segmentSelect.setValue('1');

    expect(wrapper.find('[data-testid="workbench-damage-segment-select"]').element.value).toBe('1');
    expect(wrapper.find('.selection-note').text()).toContain('190%');
    expect(wrapper.find('.damage-row').text()).toContain('重击');
    expect(wrapper.find('.action-item[data-action-id="action-0001"]').text()).toContain('190%');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      id: 'action-0001',
      skillId: workbenchSeed.defaults.skillId,
      damageSegmentIndex: 1,
    });
  });

  it('splits a skill into per-segment draft actions from the action library', async () => {
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
    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');

    const splitButton = findActionLibrarySkillSplitButton(wrapper, workbenchSeed.defaults.skillId);
    expect(splitButton.text()).toBe('拆段 4');
    expect(splitButton.attributes('disabled')).toBeUndefined();

    await splitButton.trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(wrapper.find('[data-testid="workbench-segment-split-preview"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="workbench-segment-preview-generated-count"]').text()).toBe('4');
    expect(wrapper.find('[data-testid="workbench-segment-preview-skipped-count"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="workbench-segment-preview-delay-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-segment-preview-base"]').text()).toContain('起点 2000ms');
    expect(wrapper.find('[data-testid="workbench-segment-preview-item"][data-segment-index="0"]').text()).toContain(
      '2000ms -> 4000ms',
    );

    await wrapper.find('[data-testid="workbench-segment-preview-confirm"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('6 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('6');
    expect(wrapper.find('[data-testid="workbench-segment-split-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('2000ms -> 4000ms');
    expect(wrapper.find('.action-item[data-action-id="action-0004"]').text()).toContain('重击 / 190%');
    expect(wrapper.find('.action-item[data-action-id="action-0004"]').text()).toContain('segment-batch-0001');
    expect(wrapper.findAll('[data-testid="workbench-action-batch-note"]')).toHaveLength(4);
    expect(wrapper.findAll('[data-testid="workbench-delete-action-batch"]')).toHaveLength(4);

    const damageLabels = wrapper.findAll('.damage-row').map((row) => row.find('span').text());
    expect(damageLabels).toEqual(expect.arrayContaining(['普攻', '重击', '闪击', '跃击']));

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    const generatedActions = savedDraft.actionDrafts.slice(2);

    expect(savedDraft.actionDrafts.map((action) => action.id)).toEqual([
      'action-0001',
      'action-0002',
      'action-0003',
      'action-0004',
      'action-0005',
      'action-0006',
    ]);
    expect(generatedActions.map((action) => action.damageSegmentIndex)).toEqual([0, 1, 2, 3]);
    expect(generatedActions.map((action) => action.startMs)).toEqual([4000, 6000, 8000, 10000]);
    expect(generatedActions.map((action) => action.generationBatch?.batchId)).toEqual([
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
    ]);
    expect(generatedActions[0].generationBatch).toMatchObject({
      source: 'skill-segment-split',
      skillId: workbenchSeed.defaults.skillId,
      actorCharacterId: workbenchSeed.defaults.characterId,
      level: 1,
      segmentCount: 4,
    });
    expect(generatedActions[0].generationBatch.createdAt).toEqual(expect.any(String));
    expect(generatedActions[0]).toMatchObject({
      skillId: workbenchSeed.defaults.skillId,
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 4000,
        conflictActionIds: ['action-0002'],
      },
    });
    expect(generatedActions.slice(1).map((action) => action.insertion)).toEqual([null, null, null]);
    expect(generatedActions[1].note).toContain('倍率段拆分：重击 / 190%');
    expect(generatedActions[1].note).toContain('非真实命中帧');
  });

  it('saves, restores, and deletes a generated skill segment batch', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await findActionLibrarySkillSplitButton(wrapper, workbenchSeed.defaults.skillId).trigger('click');
    await wrapper.find('[data-testid="workbench-segment-preview-confirm"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('5 action');
    expect(wrapper.findAll('[data-testid="workbench-action-batch-note"]')).toHaveLength(4);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.slice(1).map((action) => action.generationBatch?.batchId)).toEqual([
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
    ]);

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
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe('5 action');
    expect(restored.findAll('[data-testid="workbench-action-batch-note"]')).toHaveLength(4);

    await restored.find('[data-testid="workbench-delete-action-batch"]').trigger('click');

    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe('1 action');
    expect(restored.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(restored.findAll('[data-testid="workbench-action-batch-note"]')).toHaveLength(0);
    expect(restored.find('[data-testid="workbench-start-input"]').element.value).toBe('0');
    expect(restored.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');

    await restored.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedAfterDelete = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedAfterDelete.actionDrafts).toHaveLength(1);
    expect(savedAfterDelete.actionDrafts[0].generationBatch).toBeNull();
  });

  it('shifts a generated skill segment batch while preserving relative spacing', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await findActionLibrarySkillSplitButton(wrapper, workbenchSeed.defaults.skillId).trigger('click');
    await wrapper.find('[data-testid="workbench-segment-preview-confirm"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('0');

    await wrapper.find('[data-testid="workbench-shift-action-batch-earlier"]').trigger('click');
    await wrapper.find('[data-testid="workbench-shift-action-batch-earlier"]').trigger('click');
    await wrapper.find('[data-testid="workbench-shift-action-batch-earlier"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-overlap-item"]').text()).toContain('500-1000ms');
    expect(wrapper.find('.action-item[data-action-id="action-0002"]').text()).toContain('500ms');
    expect(wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')).toHaveLength(2);

    await wrapper.find('[data-testid="workbench-shift-action-batch-later"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('0');
    expect(wrapper.find('.action-item[data-action-id="action-0002"]').text()).toContain('1000ms');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.map((action) => action.startMs)).toEqual([0, 1000, 3000, 5000, 7000]);
    expect(savedDraft.actionDrafts.slice(1).map((action) => action.generationBatch?.batchId)).toEqual([
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
    ]);

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
    expect(restored.find('[data-testid="workbench-overlap-count"]').text()).toBe('0');
    expect(restored.find('.action-item[data-action-id="action-0002"]').text()).toContain('1000ms');
    expect(restored.findAll('[data-testid="workbench-action-batch-note"]')).toHaveLength(4);
  });

  it('applies arbitrary batch shift input and clamps to timeline bounds', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await findActionLibrarySkillSplitButton(wrapper, workbenchSeed.defaults.skillId).trigger('click');
    await wrapper.find('[data-testid="workbench-segment-preview-confirm"]').trigger('click');

    await wrapper.find('[data-testid="workbench-batch-shift-offset-input"]').setValue('-5000');
    await wrapper.find('[data-testid="workbench-apply-action-batch-shift"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-batch-shift-offset-input"]').element.value).toBe('0');
    expect(wrapper.find('.action-item[data-action-id="action-0002"]').text()).toContain('0ms');
    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-overlap-item"]').text()).toContain('0-1000ms');

    await wrapper.find('[data-testid="workbench-batch-shift-offset-input"]').setValue('40000');
    await wrapper.find('[data-testid="workbench-apply-action-batch-shift"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('0');
    expect(wrapper.find('.action-item[data-action-id="action-0005"]').text()).toContain('30000ms');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.map((action) => action.startMs)).toEqual([0, 24000, 26000, 28000, 30000]);
    expect(savedDraft.actionDrafts.slice(1).map((action) => action.generationBatch?.batchId)).toEqual([
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
      'segment-batch-0001',
    ]);
  });

  it('cancels a skill segment split preview without writing actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await findActionLibrarySkillSplitButton(wrapper, workbenchSeed.defaults.skillId).trigger('click');

    expect(wrapper.find('[data-testid="workbench-segment-split-preview"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="workbench-segment-preview-generated-count"]').text()).toBe('4');

    await wrapper.find('[data-testid="workbench-segment-preview-cancel"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-segment-split-preview"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('1 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('未保存草稿');
  });

  it('applies and restores segment split placement options', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="workbench-segment-split-interval-input"]').element.value).toBe('2000');
    expect(wrapper.find('[data-testid="workbench-segment-split-start-after-checkbox"]').element.checked).toBe(false);
    expect(wrapper.find('[data-testid="workbench-segment-split-skip-existing-checkbox"]').element.checked).toBe(false);

    await wrapper.find('[data-testid="workbench-segment-split-interval-input"]').setValue('1500');
    await wrapper.find('[data-testid="workbench-segment-split-start-after-checkbox"]').setValue(true);
    await wrapper.find('[data-testid="workbench-segment-split-skip-existing-checkbox"]').setValue(true);
    await findActionLibrarySkillSplitButton(wrapper, workbenchSeed.defaults.skillId).trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('1 action');
    expect(wrapper.find('[data-testid="workbench-segment-preview-generated-count"]').text()).toBe('3');
    expect(wrapper.find('[data-testid="workbench-segment-preview-skipped-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-segment-preview-delay-count"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="workbench-segment-preview-base"]').text()).toContain('起点 1000ms');
    expect(wrapper.find('[data-testid="workbench-segment-preview-item"][data-segment-index="1"]').text()).toContain(
      '1000ms',
    );

    await wrapper.find('[data-testid="workbench-segment-preview-confirm"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('4 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('4');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="workbench-segment-split-preview"]').exists()).toBe(false);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.segmentSplitOptions).toEqual({
      intervalMs: 1500,
      startAfterSelectedAction: true,
      skipExistingSegments: true,
    });
    expect(savedDraft.actionDrafts.map((action) => action.damageSegmentIndex)).toEqual([0, 1, 2, 3]);
    expect(savedDraft.actionDrafts.map((action) => action.startMs)).toEqual([0, 1000, 2500, 4000]);

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
    expect(restored.find('[data-testid="scenario-action-count"]').text()).toBe('4 action');
    expect(restored.find('[data-testid="workbench-segment-split-interval-input"]').element.value).toBe('1500');
    expect(restored.find('[data-testid="workbench-segment-split-start-after-checkbox"]').element.checked).toBe(true);
    expect(restored.find('[data-testid="workbench-segment-split-skip-existing-checkbox"]').element.checked).toBe(true);
    expect(restored.find('[data-testid="workbench-start-input"]').element.value).toBe('4000');
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

  it('adds a switch action targeting a secondary actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain('2 actor');
    expect(wrapper.find('[data-testid="workbench-secondary-character-select"]').element.value).toBe('101003');

    await wrapper.find('[data-testid="workbench-add-switch-action"]').trigger('click');

    expect(wrapper.find('[data-testid="scenario-action-count"]').text()).toBe('2 action');
    expect(wrapper.find('[data-testid="scenario-hit-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-action-type"]').element.value).toBe('切人动作');
    expect(wrapper.find('[data-testid="workbench-switch-target-select"]').element.value).toBe('101003');
    expect(wrapper.text()).toContain('SWITCH');
    expect(wrapper.text()).toContain('末音 -> 寒悠悠');
    expect(wrapper.text()).not.toContain('DAMAGE_SKIPPED');

    const nextSecondary = workbenchSeed.gameData.characters.find(
      (character) => character.id !== workbenchSeed.defaults.characterId && character.id !== 101003,
    );
    await wrapper.find('[data-testid="workbench-secondary-character-select"]').setValue(String(nextSecondary.id));

    expect(wrapper.find('[data-testid="workbench-switch-target-select"]').element.value).toBe(String(nextSecondary.id));
    expect(wrapper.text()).toContain(`末音 -> ${nextSecondary.name}`);
  });

  it('renders actor lanes and keeps system events on a system lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.findAll('[data-testid="workbench-timeline-lane-label"]').map((lane) => lane.text())).toEqual([
      '末音猛攻',
      '寒悠悠增幅',
    ]);
    expect(wrapper.find('[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0001"]')
        .attributes('data-lane-id'),
    ).toBe('actor-109001');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-damage-marker"][data-action-id="action-0001"]')
        .attributes('data-lane-id'),
    ).toBe('actor-109001');

    await wrapper.find('[data-testid="workbench-add-switch-action"]').trigger('click');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0002"]')
        .attributes('data-lane-id'),
    ).toBe('actor-109001');
    expect(wrapper.text()).toContain('切人 -> 寒悠悠');

    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-timeline-row"][data-lane-id="system"]').exists()).toBe(true);
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('system');
    expect(wrapper.findAll('[data-testid="workbench-timeline-lane-label"]').map((lane) => lane.text())).toContain(
      '系统事件轨',
    );
  });

  it('flags overlapping actions on the same timeline lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('0');
    expect(wrapper.find('[data-testid="workbench-overlap-empty"]').text()).toBe('暂无轨道重叠');

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    expect(wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')).toHaveLength(0);

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('500');

    expect(wrapper.find('[data-testid="workbench-overlap-count"]').text()).toBe('1');
    expect(wrapper.findAll('[data-testid="workbench-action-overlap-warning"]')).toHaveLength(2);
    expect(wrapper.find('[data-testid="workbench-overlap-item"]').text()).toContain('末音');
    expect(wrapper.find('[data-testid="workbench-overlap-item"]').text()).toContain('哈库茵剑舞 / 哈库茵剑舞');
    expect(wrapper.find('[data-testid="workbench-overlap-item"]').text()).toContain('500-1000ms');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');
  });

  it('drags actor-bound actions between actor lanes without moving system events', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    stubTimelineGeometry(wrapper);

    await wrapper.find('[data-testid="workbench-add-resource-action"]').trigger('click');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0002"]')
        .attributes('data-lane-id'),
    ).toBe('actor-109001');

    await dragTimelineAction(wrapper, 'action-0002', {
      fromY: 20,
      toY: 110,
    });

    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0002"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: 101003,
    });

    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');
    stubTimelineGeometry(wrapper);
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('system');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromY: 200,
      toY: 110,
    });

    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('system');
  });

  it('edits action ownership from the properties panel and filters skill choices by actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      (skill) => Number(skill.characterId) === secondaryCharacterId,
    );

    expect(wrapper.find('[data-testid="workbench-action-actor-select"]').element.value).toBe('109001');

    await wrapper.find('[data-testid="workbench-action-actor-select"]').setValue(String(secondaryCharacterId));

    expect(wrapper.find('[data-testid="workbench-action-actor-select"]').element.value).toBe(
      String(secondaryCharacterId),
    );
    expect(wrapper.find('[data-testid="workbench-skill-select"]').element.value).toBe(String(secondarySkills[0].id));
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0001"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-damage-marker"][data-action-id="action-0001"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');

    const optionValues = Array.from(wrapper.find('[data-testid="workbench-skill-select"]').element.options).map(
      (option) => Number(option.value),
    );
    expect(optionValues).toEqual(secondarySkills.map((skill) => skill.id));

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts[0]).toMatchObject({
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });

    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-action-actor-readonly"]').element.value).toBe('系统 / 事件轨');
  });

  it('uses the action library actor context for new and copied actions', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      (skill) => Number(skill.characterId) === secondaryCharacterId,
    );

    expect(findActionLibraryActorButton(wrapper, 109001).attributes('data-active')).toBe('true');

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger('click');
    expect(findActionLibraryActorButton(wrapper, secondaryCharacterId).attributes('data-active')).toBe('true');

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0002"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');
    expect(wrapper.find('[data-testid="workbench-skill-select"]').element.value).toBe(String(secondarySkills[0].id));

    await wrapper.findAll('[data-testid="workbench-copy-action"]')[1].trigger('click');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');
    expect(findActionLibraryActorButton(wrapper, secondaryCharacterId).attributes('data-active')).toBe('true');

    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
    expect(findActionLibraryActorButton(wrapper, 109001).attributes('data-active')).toBe('true');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0003',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkills[0].id,
    });
  });

  it('adds a selected skill from the action library for the active actor', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const primarySkills = workbenchSeed.gameData.skills.filter(
      (skill) => Number(skill.characterId) === workbenchSeed.defaults.characterId,
    );
    const secondaryCharacterId = 101003;
    const secondarySkills = workbenchSeed.gameData.skills.filter(
      (skill) => Number(skill.characterId) === secondaryCharacterId,
    );
    const selectedSecondarySkill =
      secondarySkills.find((skill) => Number(skill.spCost) > 0) ?? secondarySkills[secondarySkills.length - 1];

    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-entry"]')
        .map((entry) => Number(entry.attributes('data-skill-id'))),
    ).toEqual(primarySkills.map((skill) => skill.id));

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger('click');

    expect(
      wrapper
        .findAll('[data-testid="workbench-skill-entry"]')
        .map((entry) => Number(entry.attributes('data-skill-id'))),
    ).toEqual(secondarySkills.map((skill) => skill.id));
    expect(findActionLibrarySkillEntry(wrapper, selectedSecondarySkill.id).exists()).toBe(true);

    await findActionLibrarySkillEntry(wrapper, selectedSecondarySkill.id).trigger('click');

    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0002"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');
    expect(wrapper.find('[data-testid="workbench-skill-select"]').element.value).toBe(
      String(selectedSecondarySkill.id),
    );
    expect(wrapper.find('[data-testid="workbench-level-input"]').element.value).toBe('1');
    expect(wrapper.text()).toContain(selectedSecondarySkill.name);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: selectedSecondarySkill.id,
      level: 1,
    });
  });

  it('inserts new actions after the selected action instead of the global tail', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkill = workbenchSeed.gameData.skills.find(
      (skill) => Number(skill.characterId) === secondaryCharacterId,
    );

    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger('click');
    await findActionLibrarySkillEntry(wrapper, secondarySkill.id).trigger('click');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0002"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');

    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('2000');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('system');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.map((action) => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
    ]);
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0003',
      type: 'annotation',
      startMs: 2000,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0002',
      actorCharacterId: secondaryCharacterId,
      skillId: secondarySkill.id,
      startMs: 2000,
    });
  });

  it('pushes actor actions to the next same-lane slot while allowing cross-lane time sharing', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });
    const secondaryCharacterId = 101003;
    const secondarySkill = workbenchSeed.gameData.skills.find(
      (skill) => Number(skill.characterId) === secondaryCharacterId,
    );

    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('2000');

    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
    await findActionLibraryActorButton(wrapper, secondaryCharacterId).trigger('click');
    await findActionLibrarySkillEntry(wrapper, secondarySkill.id).trigger('click');

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('2000');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('0');
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');

    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
    await findActionLibraryActorButton(wrapper, workbenchSeed.defaults.characterId).trigger('click');
    await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('4000');
    expect(wrapper.find('[data-testid="workbench-note-input"]').element.value).toContain(
      '自动推迟：同轨已有动作占用，已从 2000ms 调整到 4000ms。',
    );
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0004"]')
        .attributes('data-lane-id'),
    ).toBe('actor-109001');
    expect(wrapper.findAll('[data-testid="workbench-action-insert-delay-badge"]')).toHaveLength(1);
    expect(wrapper.find('[data-testid="workbench-action-insert-delay-note"]').text()).toContain(
      '自动推迟 2000ms -> 4000ms',
    );
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('末音');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('哈库茵剑舞');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('2000ms -> 4000ms');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.map((action) => action.id)).toEqual([
      'action-0001',
      'action-0003',
      'action-0002',
      'action-0004',
    ]);
    expect(savedDraft.actionDrafts.find((action) => action.id === 'action-0003')).toMatchObject({
      actorCharacterId: secondaryCharacterId,
      startMs: 2000,
      insertion: null,
    });
    expect(savedDraft.actionDrafts.find((action) => action.id === 'action-0004')).toMatchObject({
      actorCharacterId: workbenchSeed.defaults.characterId,
      startMs: 4000,
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 4000,
        delayedByMs: 2000,
        laneId: 'actor-109001',
        reason: 'same-lane-conflict',
        conflictActionIds: ['action-0002'],
      },
    });
  });

  it('pushes system events to the next system-lane slot', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');
    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('2000');

    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
    await wrapper.find('[data-testid="workbench-add-enemy-event-action"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('3600');
    expect(wrapper.find('[data-testid="workbench-note-input"]').element.value).toContain(
      '自动推迟：同轨已有动作占用，已从 2000ms 调整到 3600ms。',
    );
    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('system');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('系统');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('敌人事件');
    expect(wrapper.find('[data-testid="workbench-insert-delay-item"]').text()).toContain('2000ms -> 3600ms');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.map((action) => action.id)).toEqual(['action-0001', 'action-0002', 'action-0003']);
    expect(savedDraft.actionDrafts[1]).toMatchObject({
      id: 'action-0002',
      type: 'annotation',
      startMs: 2000,
    });
    expect(savedDraft.actionDrafts[2]).toMatchObject({
      id: 'action-0003',
      type: 'enemyEvent',
      startMs: 3600,
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 3600,
        delayedByMs: 1600,
        laneId: 'system',
        reason: 'same-lane-conflict',
        conflictActionIds: ['action-0002'],
      },
    });
  });

  it('cleans the auto-delay note line when the note is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');

    await wrapper
      .find('[data-testid="workbench-note-input"]')
      .setValue('手写备注\n自动推迟：同轨已有动作占用，已从 2000ms 调整到 4000ms。');

    expect(wrapper.find('[data-testid="workbench-note-input"]').element.value).toBe('手写备注');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.find((action) => action.id === 'action-0003')).toMatchObject({
      note: '手写备注',
      insertion: {
        autoDelayed: true,
        requestedStartMs: 2000,
        resolvedStartMs: 4000,
      },
    });
  });

  it('clears stale auto-delay metadata when the delayed start time is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');

    await wrapper.find('[data-testid="workbench-start-input"]').setValue('4500');

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('4500');
    expect(wrapper.find('[data-testid="workbench-note-input"]').element.value).not.toContain('自动推迟');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('0');
    expect(wrapper.findAll('[data-testid="workbench-action-insert-delay-badge"]')).toHaveLength(0);
    expect(wrapper.find('[data-testid="workbench-action-insert-delay-note"]').exists()).toBe(false);

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.find((action) => action.id === 'action-0003')).toMatchObject({
      startMs: 4500,
      note: '',
      insertion: null,
    });
  });

  it('clears stale auto-delay metadata when the delayed duration is edited manually', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await wrapper.find('[data-testid="workbench-add-annotation-action"]').trigger('click');
    await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
    await wrapper.find('[data-testid="workbench-add-wait-action"]').trigger('click');

    expect(wrapper.find('[data-testid="workbench-start-input"]').element.value).toBe('3600');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');

    await wrapper.find('[data-testid="workbench-duration-input"]').setValue('1200');

    expect(wrapper.find('[data-testid="workbench-duration-input"]').element.value).toBe('1200');
    expect(wrapper.find('[data-testid="workbench-note-input"]').element.value).not.toContain('自动推迟');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.find((action) => action.id === 'action-0003')).toMatchObject({
      type: 'wait',
      durationMs: 1200,
      note: '等待窗口',
      insertion: null,
    });
  });

  it('clears stale auto-delay metadata when the delayed action is dragged to another lane', async () => {
    const wrapper = mount(Workbench, {
      global: {
        stubs: {
          RouterLink: {
            template: '<a><slot /></a>',
          },
        },
      },
    });

    await createAutoDelayedPrimarySkillAction(wrapper);
    stubTimelineGeometry(wrapper);
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('1');

    await dragTimelineAction(wrapper, 'action-0003', {
      fromY: 20,
      toY: 110,
    });

    expect(
      wrapper
        .find('[data-testid="workbench-timeline-action"][data-action-id="action-0003"]')
        .attributes('data-lane-id'),
    ).toBe('actor-101003');
    expect(wrapper.find('[data-testid="workbench-note-input"]').element.value).not.toContain('自动推迟');
    expect(wrapper.find('[data-testid="workbench-insert-delay-count"]').text()).toBe('0');

    await wrapper.find('[data-testid="workbench-save-draft"]').trigger('click');
    const savedDraft = JSON.parse(window.localStorage.getItem(WORKBENCH_DRAFT_STORAGE_KEY));
    expect(savedDraft.actionDrafts.find((action) => action.id === 'action-0003')).toMatchObject({
      actorCharacterId: 101003,
      note: '',
      insertion: null,
    });
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

  it('zooms the timeline and resizes an action duration from the timeline', async () => {
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

    await wrapper.find('[data-testid="workbench-timeline-zoom-input"]').setValue('2');
    expect(wrapper.find('[data-testid="workbench-timeline-zoom-value"]').text()).toBe('2x');
    expect(wrapper.find('[data-testid="workbench-timeline-lane"]').attributes('style')).toContain('width: 200%');
    expect(wrapper.find('[data-testid="workbench-timeline-scale-track"]').attributes('style')).toContain('width: 200%');

    await wrapper.find('[data-testid="workbench-add-wait-action"]').trigger('click');
    const handle = wrapper.find(
      '[data-testid="workbench-action-duration-handle"][data-action-id="action-0002"]',
    ).element;
    const pointerDown = new MouseEvent('pointerdown', {
      bubbles: true,
      button: 0,
      clientX: 100,
    });
    Object.defineProperty(pointerDown, 'pointerId', { value: 2 });
    handle.dispatchEvent(pointerDown);
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 140 }));
    await nextTick();
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: 140 }));
    await nextTick();

    expect(wrapper.find('[data-testid="workbench-action-type"]').element.value).toBe('等待动作');
    expect(wrapper.find('[data-testid="workbench-duration-input"]').element.value).toBe('3000');
    expect(wrapper.find('[data-testid="workbench-draft-status"]').text()).toBe('有未保存改动');
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

function stubTimelineGeometry(wrapper) {
  const lane = wrapper.find('[data-testid="workbench-timeline-lane"]').element;
  lane.getBoundingClientRect = () => ({
    width: 600,
    height: 240,
    left: 0,
    right: 600,
    top: 0,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON: () => {},
  });

  stubLaneRow(wrapper, 'actor-109001', 0, 72);
  stubLaneRow(wrapper, 'actor-101003', 84, 156);
  stubLaneRow(wrapper, 'system', 168, 240);
}

function stubLaneRow(wrapper, laneId, top, bottom) {
  const row = wrapper.find(`[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"]`);
  if (!row.exists()) {
    return;
  }

  row.element.getBoundingClientRect = () => ({
    width: 600,
    height: bottom - top,
    left: 0,
    right: 600,
    top,
    bottom,
    x: 0,
    y: top,
    toJSON: () => {},
  });
}

async function dragTimelineAction(wrapper, actionId, { fromY, toY }) {
  const action = wrapper.find(`[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`).element;
  const pointerDown = new MouseEvent('pointerdown', {
    bubbles: true,
    button: 0,
    clientX: 100,
    clientY: fromY,
  });
  Object.defineProperty(pointerDown, 'pointerId', { value: Number(actionId.replace(/\D/g, '')) || 1 });
  action.dispatchEvent(pointerDown);
  await nextTick();
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: toY }));
  await nextTick();
  window.dispatchEvent(new MouseEvent('pointerup', { clientX: 100, clientY: toY }));
  await nextTick();
}

async function createAutoDelayedPrimarySkillAction(wrapper) {
  await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
  await wrapper.find('.action-item[data-action-id="action-0001"]').trigger('click');
  await wrapper.find('[data-testid="workbench-add-action"]').trigger('click');
}

function findActionLibraryActorButton(wrapper, characterId) {
  return wrapper.find(
    `[data-testid="workbench-action-library-actor"][data-character-id="${Number(characterId)}"]`,
  );
}

function findActionLibrarySkillEntry(wrapper, skillId) {
  return wrapper.find(`[data-testid="workbench-skill-entry"][data-skill-id="${Number(skillId)}"]`);
}

function findActionLibrarySkillSplitButton(wrapper, skillId) {
  return wrapper.find(`[data-testid="workbench-skill-segment-split"][data-skill-id="${Number(skillId)}"]`);
}
