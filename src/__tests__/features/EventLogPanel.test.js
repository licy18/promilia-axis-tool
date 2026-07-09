import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EventLogPanel from '../../features/workbench/EventLogPanel.vue';

describe('EventLogPanel', () => {
  it('navigates adjacent runtime results from the log panel', async () => {
    const firstStatePointId = 'enemyHpDamage|applied|action-001|12|0';
    const secondStatePointId = 'enemyHpDamage|applied|action-002|24|1';
    const wrapper = mount(EventLogPanel, {
      props: {
        eventLog: [],
        selectedStateCurvePointId: secondStatePointId,
        runtimeProjection: {
          simLog: [
            createRuntimeLogRow({
              sourceDeltaId: 'delta-001',
              actionId: 'action-001',
              actionName: '普通攻击',
              frameIndex: 12,
              sequenceIndex: 0,
            }),
            createRuntimeLogRow({
              sourceDeltaId: 'delta-002',
              actionId: 'action-002',
              actionName: '星鸣技',
              frameIndex: 24,
              sequenceIndex: 1,
            }),
          ],
        },
      },
    });

    const previousButton = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation-prev"]'
    );
    const nextButton = wrapper.find(
      '[data-testid="workbench-runtime-sim-log-navigation-next"]'
    );

    expect(previousButton.attributes()).toMatchObject({
      'data-state-point-id': firstStatePointId,
    });
    expect(previousButton.attributes('disabled')).toBeUndefined();
    expect(nextButton.attributes()).toMatchObject({
      'data-state-point-id': '',
    });
    expect(nextButton.attributes('disabled')).toBeDefined();

    await previousButton.trigger('click');

    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-navigation',
      statePointId: firstStatePointId,
      canRun: true,
      payload: {
        sourceDeltaId: 'delta-001',
        actionId: 'action-001',
      },
    });
  });

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

function createRuntimeLogRow({
  sourceDeltaId,
  actionId,
  actionName,
  frameIndex,
  sequenceIndex,
}) {
  return {
    eventType: 'THREE_VALUE_DELTA_APPLIED',
    sourceDeltaId,
    actionId,
    actionName,
    actorId: 'actor-001',
    actorName: '末音',
    hitKey: `hit-${sequenceIndex}`,
    hitIndex: sequenceIndex + 1,
    frameIndex,
    frameLabel: `${frameIndex}f`,
    timeMs: frameIndex * 100,
    sequenceIndex,
    trackKey: 'enemyHpDamage',
    layerKey: 'applied',
    delta: 100,
    hpDelta: 100,
    toughnessDelta: null,
    energyDelta: null,
  };
}

function getLastDispatchedFlowAction(wrapper) {
  const events = wrapper.emitted('dispatch-flow-action') ?? [];
  return events.at(-1)?.[0] ?? null;
}
