import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import Workbench from '../../views/Workbench.vue';

describe('Workbench view', () => {
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
});
