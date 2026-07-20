import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import TimelineOperationAxis from '../../features/workbench/TimelineOperationAxis.vue';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('TimelineOperationAxis', () => {
  it('renders semantic key caps and selects the source action', async () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const wrapper = mount(TimelineOperationAxis, {
      props: {
        actions: [
          {
            id: 'normal-a1',
            type: 'skill',
            actorId: 'actor-lilly',
            skillId: 10100301,
            actionKind: 'normal-attack',
            attackSequenceIndex: 1,
            name: 'A1',
            startMs: 500,
          },
          {
            id: 'skill-e',
            type: 'skill',
            actorId: 'actor-lilly',
            actionKind: 'star-skill',
            name: '星鸣技',
            startMs: 1000,
          },
        ],
        actors: [
          {
            id: 'actor-lilly',
            characterId: 101003,
            name: '莉莉',
          },
        ],
        durationMs: 3000,
        selectedActionId: 'normal-a1',
      },
    });
    const markers = wrapper.findAll(
      '[data-testid="workbench-timeline-operation-marker"]'
    );

    expect(markers).toHaveLength(2);
    expect(markers.map(marker => marker.text())).toEqual(['LMB', 'E']);
    expect(markers[0].classes()).toContain('selected');
    expect(markers[0].attributes('title')).toContain('A1｜LMB｜短按｜500 ms');

    await markers[1].trigger('click');
    expect(wrapper.emitted('select-action')?.at(-1)?.[0]).toBe('skill-e');
  });
});
