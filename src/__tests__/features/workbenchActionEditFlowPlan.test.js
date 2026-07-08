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
      source: 'runtime-detail',
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
        focusSource: 'runtime-detail',
        originStatePointId: 'enemyHpDamage|applied|action-0001|12|0',
        originTrackKey: 'enemyHpDamage',
        originTrackLabel: '',
        originFrameLabel: '12f',
        sequence: 8,
      },
    });
  });

  it('keeps runtime result focus readable when only a track label is available', () => {
    const plan = createRuntimeActionEditFocusPlan({
      actionId: 'action-0002',
      frameLabel: '30f',
      statePointId: 'selfEnergyChange|applied|action-0002|30|1',
      trackLabel: '自身能量',
      source: 'runtime-detail',
    });

    expect(plan).toMatchObject({
      canApply: true,
      actionEditFocus: {
        actionId: 'action-0002',
        changeSummary: '三值点 30f · 自身能量',
        originTrackKey: '',
        originTrackLabel: '自身能量',
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
        focusSource: '',
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
