import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import WorkbenchCycleSectionPanel from '../../features/workbench/WorkbenchCycleSectionPanel.vue';

describe('WorkbenchCycleSectionPanel', () => {
  it('reviews a selected section and returns to a contributing action', async () => {
    const wrapper = mount(WorkbenchCycleSectionPanel, {
      props: {
        projection: createProjection(),
        selectedSectionId: 'cycle-section-02',
        canCreateInheritedScenario: true,
      },
    });

    expect(
      wrapper
        .get('[data-testid="workbench-cycle-section-panel"]')
        .attributes('data-selected-section-id')
    ).toBe('cycle-section-02');
    expect(wrapper.text()).toContain('600');
    expect(wrapper.text()).toContain('寒悠悠');
    expect(wrapper.text()).toContain('星鸣技');
    expect(wrapper.text()).toContain('星流');

    await wrapper
      .get(
        '[data-testid="workbench-cycle-section-tab"][data-section-id="cycle-section-01"]'
      )
      .trigger('click');
    expect(wrapper.emitted('select-section')?.at(-1)?.[0]).toBe(
      'cycle-section-01'
    );
    await wrapper
      .get('[data-testid="workbench-cycle-section-locate-action"]')
      .trigger('click');
    expect(wrapper.emitted('locate-action')?.at(-1)?.[0]).toBe('action-2');

    await wrapper.setProps({ selectedSectionId: 'cycle-section-02' });
    await wrapper
      .get('[data-testid="workbench-create-inherited-scenario"]')
      .trigger('click');
    expect(wrapper.emitted('create-inherited-scenario')?.at(-1)?.[0]).toBe(
      'boundary-1'
    );
  });
});

function createProjection() {
  return {
    summary: { boundaryCount: 1 },
    sections: [
      {
        sectionId: 'cycle-section-01',
        label: '循环 1',
        startMs: 0,
        endMs: 1000,
        durationMs: 1000,
        metrics: {
          enemyHpDelta: 100,
          enemyToughnessDelta: 10,
          selfEnergyDelta: 0,
          effectCoverageMs: 0,
        },
        actors: [],
        actions: [],
        effects: [],
      },
      {
        sectionId: 'cycle-section-02',
        label: '循环 2',
        startMs: 1000,
        endMs: 3000,
        startBoundaryId: 'boundary-1',
        durationMs: 2000,
        metrics: {
          enemyHpDelta: 600,
          enemyToughnessDelta: 40,
          selfEnergyDelta: 6,
          effectCoverageMs: 1000,
        },
        actors: [
          {
            actorId: 'actor-2',
            name: '寒悠悠',
            selfEnergyDelta: 6,
            transactionCount: 1,
          },
        ],
        actions: [
          {
            actionId: 'action-2',
            name: '星鸣技',
            actorName: '寒悠悠',
            enemyHpDelta: 600,
            enemyToughnessDelta: 40,
            selfEnergyDelta: 6,
            hitCount: 1,
            effectEventCount: 1,
          },
        ],
        effects: [
          {
            key: 'enemy|enemy-1|star-flow',
            name: '星流',
            targetName: '迅狼',
            coverageMs: 1000,
          },
        ],
      },
    ],
  };
}
