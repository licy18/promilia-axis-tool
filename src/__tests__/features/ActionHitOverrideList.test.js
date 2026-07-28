import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ActionHitOverrideList from '../../features/workbench/ActionHitOverrideList.vue';

describe('ActionHitOverrideList', () => {
  it('exposes stable hit identity, timing, and scenario state', async () => {
    const wrapper = mount(ActionHitOverrideList, {
      props: {
        hitBindings: [
          {
            identity: 'control:10100312:hit:4',
            label: '花照夜·命中 4',
            frame: 94,
            willHit: true,
            sourceKind: 'direct',
            scenarioRuntimeStatus: 'source-verified',
          },
        ],
      },
    });

    const row = wrapper.get('[data-testid="workbench-hit-override-row"]');
    expect(row.attributes()).toMatchObject({
      'data-hit-identity': 'control:10100312:hit:4',
      'data-hit-label': '花照夜·命中 4',
      'data-hit-frame': '94',
      'data-will-hit': 'true',
      'data-source-kind': 'direct',
      'data-scenario-runtime-status': 'source-verified',
    });

    await row.get('input').setValue(false);
    expect(wrapper.emitted('change')?.[0]).toEqual([
      'control:10100312:hit:4',
      false,
    ]);
  });
});
