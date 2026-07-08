import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS,
  createEditSourceActionEditFocusPlan,
  createRuntimeActionEditFocusPlan,
} from '../../features/workbench/workbenchActionEditFlowPlan';

describe('workbench action edit flow plan', () => {
  it('describes runtime result focus as an action edit focus plan', () => {
    const plan = createRuntimeActionEditFocusPlan({
      actionId: 'action-0001',
      fieldKey: 'startMs',
      frameLabel: '12f',
      statePointId: 'enemyHpDamage|applied|action-0001|12|0',
      trackKey: 'enemyHpDamage',
      sequence: 7,
    });

    expect(plan).toMatchObject({
      kind: WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS.RUNTIME_ACTION_FOCUS,
      canApply: true,
      actionId: 'action-0001',
      requiresExistingAction: true,
      actionEditFocus: {
        actionId: 'action-0001',
        fieldKey: 'startMs',
        label: '结果定位',
        previousValue: '',
        nextValue: '',
        changeSummary: '三值点 12f · 敌人 HP',
        editOrigin: 'runtime-focus',
        originStatePointId: 'enemyHpDamage|applied|action-0001|12|0',
        originTrackKey: 'enemyHpDamage',
        originFrameLabel: '12f',
        sequence: 8,
      },
    });
  });

  it('describes an analysis edit-source focus without requiring an existing action', () => {
    const plan = createEditSourceActionEditFocusPlan({
      source: {
        actionId: 'action-0002',
        fieldKey: 'level',
        label: '等级变更',
        previousValue: '1',
        nextValue: '2',
        changeSummary: '1 -> 2',
      },
      sequence: 3,
    });

    expect(plan).toMatchObject({
      kind: WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS.EDIT_SOURCE_FOCUS,
      canApply: true,
      actionId: 'action-0002',
      requiresExistingAction: false,
      actionEditFocus: {
        actionId: 'action-0002',
        fieldKey: 'level',
        label: '等级变更',
        previousValue: '1',
        nextValue: '2',
        changeSummary: '1 -> 2',
        sequence: 4,
      },
    });
  });

  it('disables incomplete action edit focus plans', () => {
    expect(createRuntimeActionEditFocusPlan()).toMatchObject({
      canApply: false,
      requiresExistingAction: true,
    });
    expect(
      createEditSourceActionEditFocusPlan({
        source: {
          actionId: 'action-0003',
        },
      })
    ).toMatchObject({
      canApply: false,
      requiresExistingAction: false,
    });
  });
});
