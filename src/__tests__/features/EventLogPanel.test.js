import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EventLogPanel from '../../features/workbench/EventLogPanel.vue';

describe('EventLogPanel', () => {
  it('shows runtime contribution rows from the hit aggregate', () => {
    const wrapper = mount(EventLogPanel, {
      props: {
        eventLog: [],
        runtimeProjection: {
          simLog: [
            {
              eventType: 'THREE_VALUE_DELTA_APPLIED',
              sequenceIndex: 0,
              sourceDeltaId: 'delta-hp',
              actionId: 'action-001',
              actionName: '普通攻击',
              actorId: 'actor-001',
              actorName: '末音',
              hitKey: 'hit-1',
              hitIndex: 1,
              frameIndex: 12,
              frameLabel: '0s12f',
              timeMs: 200,
              trackKey: 'enemyHpDamage',
              layerKey: 'applied',
              delta: 100,
              hpDelta: 100,
              toughnessDelta: null,
              energyDelta: null,
              hitThreeValueDeltaAggregate: {
                sourceKind: 'azpr-action-hit-three-value-delta-aggregate',
                deltaCount: 3,
                layers: {
                  applied: {
                    hpDelta: 100,
                    toughnessDelta: 25,
                    energyDelta: -10,
                  },
                },
              },
            },
          ],
        },
      },
    });

    const contributionRows = wrapper.findAll(
      '[data-testid="workbench-runtime-sim-log-contribution-row"]'
    );
    expect(
      contributionRows.map(row => [
        row.attributes('data-contribution-key'),
        row.attributes('data-contribution-source'),
        row.attributes('data-value'),
        row.text(),
      ])
    ).toEqual([
      ['hp', 'hit-aggregate', '100', '敌人 HP100'],
      ['toughness', 'hit-aggregate', '25', '敌人韧性25'],
      ['energy', 'hit-aggregate', '-10', '自身能量-10'],
    ]);
  });
});
