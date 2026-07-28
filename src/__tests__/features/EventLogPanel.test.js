import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import EventLogPanel from '../../features/workbench/EventLogPanel.vue';
import { createRuntimeStatePointContexts } from '../../features/workbench/runtimeProjectionPoints';

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

  it('reviews one hit as one row and keeps per-delta diagnostics available', async () => {
    const transaction = createRuntimeHitTransaction();
    const runtimeProjection = {
      simLog: transaction.sourceDeltaIds.map((sourceDeltaId, index) =>
        createTransactionRuntimeLogRow({
          sourceDeltaId,
          index,
          transaction,
        })
      ),
      hitTransactions: {
        transactions: [transaction],
      },
    };
    const selectedStatePointId =
      createRuntimeStatePointContexts(runtimeProjection)[1].statePointId;
    const wrapper = mount(EventLogPanel, {
      props: {
        eventLog: [],
        runtimeProjection,
        selectedStateCurvePointId: selectedStatePointId,
      },
    });

    expect(wrapper.attributes('data-runtime-log-review-mode')).toBe('hit');
    const hitRows = wrapper.findAll(
      '[data-testid="workbench-runtime-sim-log-row"]'
    );
    expect(hitRows).toHaveLength(1);
    expect(hitRows[0].attributes()).toMatchObject({
      'data-review-unit': 'hit-transaction',
      'data-selected': 'true',
      'data-source-delta-count': '3',
      'data-state-point-id': selectedStatePointId,
      'data-transaction-id': transaction.transactionId,
    });
    expect(hitRows[0].text()).toContain('普通攻击');
    expect(hitRows[0].text()).toContain('HP -100');
    expect(hitRows[0].text()).toContain('韧性 -20');
    expect(hitRows[0].text()).toContain('SP +15');

    await hitRows[0].trigger('click');
    expect(getLastDispatchedFlowAction(wrapper)).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-row',
      statePointId: selectedStatePointId,
      canRun: true,
      payload: {
        transactionId: transaction.transactionId,
        actionId: 'action-001',
      },
    });

    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="delta"]'
      )
      .trigger('click');
    expect(wrapper.attributes('data-runtime-log-review-mode')).toBe('delta');
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]')
    ).toHaveLength(3);

    await wrapper
      .find(
        '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="hit"]'
      )
      .trigger('click');
    expect(wrapper.attributes('data-runtime-log-review-mode')).toBe('hit');
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]')
    ).toHaveLength(1);
  });

  it('marks event and runtime rows that match the playback cursor frame', async () => {
    const wrapper = mount(EventLogPanel, {
      props: {
        cursorFrameIndex: 12,
        eventLog: [
          {
            type: 'ACTION_START',
            timeMs: 200,
            actionId: 'action-001',
            payload: {
              actorName: '末音',
              actionName: '普通攻击',
            },
          },
        ],
        runtimeProjection: {
          simLog: [
            createRuntimeLogRow({
              sourceDeltaId: 'delta-001',
              actionId: 'action-001',
              actionName: '普通攻击',
              frameIndex: 12,
              sequenceIndex: 0,
            }),
          ],
        },
      },
    });

    expect(wrapper.attributes('data-cursor-frame-index')).toBe('12');
    expect(
      wrapper.get('[data-testid="workbench-event-log-row"]').attributes()
    ).toMatchObject({
      'data-frame-index': '12',
      'data-cursor-current': 'true',
    });
    expect(
      wrapper.get('[data-testid="workbench-runtime-sim-log-row"]').attributes()
    ).toMatchObject({
      'data-frame-index': '12',
      'data-cursor-current': 'true',
    });

    await wrapper.setProps({ cursorFrameIndex: 13 });
    expect(
      wrapper
        .get('[data-testid="workbench-event-log-row"]')
        .attributes('data-cursor-current')
    ).toBe('false');
    expect(
      wrapper
        .get('[data-testid="workbench-runtime-sim-log-row"]')
        .attributes('data-cursor-current')
    ).toBe('false');
  });

  it('keeps effect relation identity and operation visible in the event log', () => {
    const wrapper = mount(EventLogPanel, {
      props: {
        eventLog: [
          {
            type: 'EFFECT_REMOVED',
            timeMs: 1250,
            actionId: 'action-b',
            relationId: 'effect-relation:remove-focus',
            relationKind: 'effect-consume',
            effectId: 'focus',
            effectName: '专注',
            targetId: 'actor-a',
            stackBefore: 1,
            stackAfter: 0,
            payload: { effectName: '专注', targetId: 'actor-a' },
          },
        ],
      },
    });

    const row = wrapper.get('[data-testid="workbench-event-log-row"]');
    expect(row.attributes()).toMatchObject({
      'data-effect-relation-id': 'effect-relation:remove-focus',
      'data-effect-relation-kind': 'effect-consume',
    });
    expect(row.text()).toContain('消耗 专注 -> actor-a / 1 层');
  });

  it('shows target-state gain and consume transactions as stack causality', () => {
    const wrapper = mount(EventLogPanel, {
      props: {
        eventLog: [
          {
            type: 'VERIFIED_TARGET_STATE_CHANGE',
            timeMs: 1000,
            actionId: 'han-star-skill',
            payload: {
              stateIdentity: 'enemy:firework',
              stateName: '焰火',
              operation: 'gain',
              beforeValue: 7,
              change: 1,
              afterValue: 8,
            },
          },
          {
            type: 'VERIFIED_TARGET_STATE_CHANGE',
            timeMs: 2000,
            actionId: 'han-charged-stage-one',
            payload: {
              stateIdentity: 'enemy:firework',
              stateName: '焰火',
              operation: 'consume',
              beforeValue: 8,
              change: -6,
              afterValue: 2,
            },
          },
        ],
      },
    });

    expect(
      wrapper
        .findAll('[data-testid="workbench-event-log-row"]')
        .map(row => row.text())
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('焰火 7 -> 8 层（获得+1）'),
        expect.stringContaining('焰火 8 -> 2 层（消耗-6）'),
      ])
    );
  });

  it('windows large event and runtime logs while keeping an offscreen selection reachable', async () => {
    const eventLog = Array.from({ length: 1000 }, (_, index) => ({
      type: 'ACTION_START',
      timeMs: index * 100,
      actionId: `event-action-${index}`,
      payload: {
        actorName: '末音',
        actionName: `动作 ${index}`,
      },
    }));
    const runtimeRows = Array.from({ length: 1000 }, (_, index) =>
      createRuntimeLogRow({
        sourceDeltaId: `delta-${index}`,
        actionId: `action-${index}`,
        actionName: `动作 ${index}`,
        frameIndex: index,
        sequenceIndex: index,
      })
    );
    const selectedStatePointId = createRuntimeStatePointContexts({
      simLog: runtimeRows,
    }).at(-1).statePointId;
    const wrapper = mount(EventLogPanel, {
      props: {
        eventLog,
        runtimeProjection: { simLog: runtimeRows },
        selectedStateCurvePointId: selectedStatePointId,
        flowModel: {
          phase: 'runtime-result',
        },
      },
      attachTo: document.body,
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(
      wrapper.findAll('[data-testid="workbench-event-log-row"]').length
    ).toBeGreaterThan(0);
    expect(
      wrapper.findAll('[data-testid="workbench-event-log-row"]').length
    ).toBeLessThanOrEqual(200);
    expect(
      wrapper.findAll('[data-testid="workbench-runtime-sim-log-row"]').length
    ).toBeLessThanOrEqual(200);
    expect(
      wrapper
        .find(
          `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${selectedStatePointId}"]`
        )
        .exists()
    ).toBe(true);

    wrapper.unmount();
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

function createRuntimeHitTransaction() {
  return {
    transactionId: 'action-001|hit-1|12|200',
    actionId: 'action-001',
    actionName: '普通攻击',
    actionType: 'skill',
    actorId: 'actor-001',
    actorName: '末音',
    energyOwnerActorId: 'actor-001',
    targetEnemyId: 'enemy-001',
    hitKey: 'hit-1',
    hitIndex: 1,
    frameIndex: 12,
    frameLabel: '0s12f',
    timeMs: 200,
    runtimeSequenceStart: 0,
    runtimeSequenceEnd: 2,
    deltaCount: 3,
    sourceDeltaIds: ['delta-hp', 'delta-toughness', 'delta-energy'],
    trackKeys: ['enemyHpDamage', 'enemyToughnessDamage', 'selfEnergyChange'],
    delta: {
      enemyHp: 100,
      enemyToughness: 20,
      selfEnergy: 15,
    },
    stateChange: {
      enemyHp: -100,
      enemyToughness: -20,
      selfEnergy: 15,
    },
    changedMetricKeys: ['enemyHp', 'enemyToughness', 'selfEnergy'],
    status: 'runtime-hit-transaction-ready',
  };
}

function createTransactionRuntimeLogRow({ sourceDeltaId, index, transaction }) {
  const trackKeys = transaction.trackKeys;
  const values = [100, 20, 15];
  const deltaFields = ['hpDelta', 'toughnessDelta', 'energyDelta'];
  return {
    eventType: 'THREE_VALUE_DELTA_APPLIED',
    sourceDeltaId,
    actionId: transaction.actionId,
    actionName: transaction.actionName,
    actorId: transaction.actorId,
    actorName: transaction.actorName,
    hitKey: transaction.hitKey,
    hitIndex: transaction.hitIndex,
    frameIndex: transaction.frameIndex,
    frameLabel: transaction.frameLabel,
    timeMs: transaction.timeMs,
    sequenceIndex: index,
    runtimeSequenceIndex: index,
    trackKey: trackKeys[index],
    layerKey: 'applied',
    delta: values[index],
    hpDelta: null,
    toughnessDelta: null,
    energyDelta: null,
    [deltaFields[index]]: values[index],
    hitTransaction: transaction,
  };
}

function getLastDispatchedFlowAction(wrapper) {
  const events = wrapper.emitted('dispatch-flow-action') ?? [];
  return events.at(-1)?.[0] ?? null;
}
