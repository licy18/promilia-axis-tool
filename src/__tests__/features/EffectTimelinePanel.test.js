import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EffectTimelinePanel from '../../features/workbench/EffectTimelinePanel.vue';

describe('EffectTimelinePanel', () => {
  it('reviews action/effect relations and returns to the command action', async () => {
    const triggerRelation = createRelation({
      edgeId: 'effect-relation:apply-focus',
      kind: 'effect-trigger',
      commandActionId: 'action-a',
      runtimeEventId: 'focus-apply',
      frameIndex: 15,
      status: 'satisfied',
    });
    const consumeRelation = createRelation({
      edgeId: 'effect-relation:remove-focus',
      kind: 'effect-consume',
      commandActionId: 'action-b',
      runtimeEventId: 'focus-remove',
      frameIndex: 75,
      status: 'unsatisfied',
    });
    const wrapper = mount(EffectTimelinePanel, {
      props: {
        effectTimeline: {
          events: [
            {
              eventId: 'focus-apply',
              type: 'EFFECT_APPLIED',
              timeMs: 250,
              frameIndex: 15,
              actionId: 'action-a',
              effectId: 'focus',
              effectName: '专注',
              targetId: 'actor-a',
              targetName: '末音',
              stackBefore: 0,
              stackAfter: 1,
              after: {
                instanceKey: 'actor|actor-a|focus',
                active: true,
                stacks: 1,
                maxStacks: 1,
                tags: [],
                modifiers: [],
              },
            },
          ],
        },
        actionEffectRelationGraph: {
          nodes: [
            {
              endpointKind: 'action',
              actionId: 'action-a',
              label: '普通攻击',
            },
            {
              endpointKind: 'action',
              actionId: 'action-b',
              label: '星鸣技',
            },
          ],
          edges: [triggerRelation, consumeRelation],
        },
        selectedEffectRelation: consumeRelation,
      },
    });

    const relationRows = wrapper.findAll(
      '[data-testid="workbench-effect-relation-row"]'
    );
    expect(relationRows).toHaveLength(2);
    expect(relationRows[0].text()).toContain('普通攻击 -> 专注');
    expect(relationRows[0].text()).toContain('已满足');
    expect(relationRows[1].text()).toContain('专注 -> 星鸣技');
    expect(relationRows[1].text()).toContain('前置缺失');
    expect(relationRows[1].attributes('data-selected')).toBe('true');

    await relationRows[0].trigger('click');
    expect(wrapper.emitted('select-effect-relation')?.at(-1)?.[0]).toBe(
      'effect-relation:apply-focus'
    );
    await wrapper
      .get('[data-testid="workbench-effect-edit-source-action"]')
      .trigger('click');
    expect(wrapper.emitted('edit-source-action')?.at(-1)?.[0]).toBe('action-b');
  });

  it('shows the verified property change of a selected effect interval', () => {
    const wrapper = mount(EffectTimelinePanel, {
      props: {
        effectTimeline: { events: [] },
        selectedEffectInterval: {
          intervalId: 'actor|actor-a|tuning|interval-1',
          effectId: 'battle-element:101003207',
          effectName: '主控角色调谐强度提升',
          targetName: '寒悠悠',
          startFrame: 148,
          endFrame: 1048,
          maxStacks: 1,
          peakStacks: 1,
          activeAtScenarioEnd: false,
          appliedToCalculators: true,
          lifecycleEvents: [
            {
              eventId: 'tuning-apply',
              type: 'EFFECT_APPLIED',
              after: {
                modifiers: [
                  {
                    kind: 'battle-property',
                    attributeId: 229,
                    bucket: 'dynamicExtra',
                    valueRaw: 1019.9066162109375,
                  },
                ],
              },
            },
          ],
        },
      },
    });

    expect(
      wrapper.get('[data-testid="workbench-effect-interval-modifiers"]').text()
    ).toBe('调谐强度 +1,019.91');
    expect(wrapper.text()).not.toContain('精通');
  });
});

function createRelation(overrides) {
  return {
    effectId: 'focus',
    effectName: '专注',
    targetId: 'actor-a',
    ...overrides,
  };
}
