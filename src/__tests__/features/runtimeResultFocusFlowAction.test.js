import { describe, expect, it } from 'vitest';
import {
  createRuntimeResultFocusFlowAction,
  createRuntimeStatePointFocusFlowAction,
} from '../../features/workbench/runtimeResultFocusFlowAction';

describe('runtime result focus flow action', () => {
  it('creates a runtime state point focus action from curve or log detail', () => {
    const action = createRuntimeStatePointFocusFlowAction({
      source: 'resource-runtime-curve',
      detail: {
        actionId: 'action-0001',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
        trackKey: 'enemyHpDamage',
      },
    });

    expect(action).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'resource-runtime-curve',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      canRun: true,
      payload: {
        actionId: 'action-0001',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
        trackKey: 'enemyHpDamage',
      },
    });
  });

  it('uses explicit state point ids for runtime log rows', () => {
    const row = {
      actionId: 'action-0002',
      sourceDeltaId: 'self-energy-delta',
      trackKey: 'selfEnergyChange',
    };
    const action = createRuntimeStatePointFocusFlowAction({
      source: 'event-log-runtime-row',
      detail: row,
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
    });

    expect(action).toMatchObject({
      kind: 'select-runtime-state-point',
      source: 'event-log-runtime-row',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: true,
      payload: row,
    });
  });

  it('creates a runtime result focus action from analysis feedback', () => {
    const action = createRuntimeResultFocusFlowAction({
      source: 'analysis-edit-result',
      detail: {
        actionId: 'action-0003',
        runtimeStatePointId: 'enemyToughnessDamage|applied|action-0003|42|0',
      },
      enabled: false,
      disabledReason: 'runtime-result-already-focused',
    });

    expect(action).toMatchObject({
      kind: 'select-runtime-result',
      source: 'analysis-edit-result',
      actionId: 'action-0003',
      statePointId: 'enemyToughnessDamage|applied|action-0003|42|0',
      canRun: false,
      disabledReason: 'runtime-result-already-focused',
    });
  });
});
