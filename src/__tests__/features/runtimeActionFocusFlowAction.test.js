import { describe, expect, it } from 'vitest';
import { createRuntimeActionFocusFlowAction } from '../../features/workbench/runtimeActionFocusFlowAction';

describe('runtime action focus flow action', () => {
  it('creates a focus-runtime-action with the shared payload contract', () => {
    const action = createRuntimeActionFocusFlowAction({
      source: 'runtime-detail',
      detail: {
        actionId: 'action-0001',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
        frameLabel: '0s12f',
        trackKey: 'enemyHpDamage',
      },
    });

    expect(action).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'runtime-detail',
      actionId: 'action-0001',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      canRun: true,
      payload: {
        actionId: 'action-0001',
        fieldKey: 'startMs',
        frameLabel: '0s12f',
        statePointId: 'enemyHpDamage|applied|action-0001|12|0',
        trackKey: 'enemyHpDamage',
      },
    });
  });

  it('falls back to timeMs for the frame label and respects explicit enabled state', () => {
    const action = createRuntimeActionFocusFlowAction({
      source: 'workbench-flow-panel',
      detail: {
        actionId: 'action-0002',
        statePointId: 'selfEnergyChange|applied|action-0002|30|1',
        timeMs: 500,
        trackKey: 'selfEnergyChange',
      },
      enabled: false,
    });

    expect(action).toMatchObject({
      kind: 'focus-runtime-action',
      source: 'workbench-flow-panel',
      actionId: 'action-0002',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      canRun: false,
      disabledReason: 'missing-runtime-action',
      payload: {
        frameLabel: '500ms',
        fieldKey: 'startMs',
      },
    });
  });
});
