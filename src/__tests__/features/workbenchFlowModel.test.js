import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_FLOW_ACTION_KINDS,
  WORKBENCH_FLOW_PHASES,
  createWorkbenchFlowAction,
  createWorkbenchFlowModel,
} from '../../features/workbench/workbenchFlowModel';

describe('workbench flow model', () => {
  it('centralizes runtime navigation, controls, and action-edit phase', () => {
    const runtimeProjection = createRuntimeProjectionFixture();
    const model = createWorkbenchFlowModel({
      selectedAction: { id: 'action-0002', name: '资源动作' },
      runtimeProjection,
    });

    expect(model.phase).toBe(WORKBENCH_FLOW_PHASES.ACTION_EDIT);
    expect(model.selectedActionId).toBe('action-0002');
    expect(model.selectedActionName).toBe('资源动作');
    expect(model.runtimeFocusSource).toBe('');
    expect(model.runtimeSimLogCount).toBe(2);
    expect(model.controls).toMatchObject({
      canOpenRuntimeResults: true,
      canFocusRuntimeAction: false,
      canReturnRuntimeResult: false,
    });
    expect(model.runtimeNavigation.count).toBe(2);
    expect(model.runtimeNavigation.index).toBe(-1);
    expect(model.runtimeNavigation.label).toBe('-/2');
  });

  it('tracks the selected runtime result and adjacent runtime points', () => {
    const runtimeProjection = createRuntimeProjectionFixture();
    const baseModel = createWorkbenchFlowModel({ runtimeProjection });
    const firstPoint = baseModel.runtimeNavigation.points[0];
    const secondPoint = baseModel.runtimeNavigation.points[1];

    const model = createWorkbenchFlowModel({
      selectedAction: { id: 'action-0001', name: '普通攻击' },
      runtimeProjection,
      selectedStateCurvePointId: firstPoint.statePointId,
      runtimeFocusSource: 'action-result',
      runtimeSelectedDetail: {
        actionId: 'action-0001',
        statePointId: firstPoint.statePointId,
        frameLabel: '12f',
        trackLabel: '敌人 HP',
        trackKey: 'enemyHpDamage',
      },
    });

    expect(model.phase).toBe(WORKBENCH_FLOW_PHASES.RUNTIME_RESULT);
    expect(model.runtimeDetail).toMatchObject({
      actionId: 'action-0001',
      statePointId: firstPoint.statePointId,
      label: '12f · 敌人 HP',
      canFocusAction: true,
    });
    expect(model.runtimeFocusSource).toBe('action-result');
    expect(model.runtimeNavigation.index).toBe(0);
    expect(model.runtimeNavigation.label).toBe('1/2');
    expect(model.runtimeNavigation.previous).toBeNull();
    expect(model.runtimeNavigation.next?.statePointId).toBe(
      secondPoint.statePointId
    );
  });

  it('separates refreshed-result readiness from refreshed-result review', () => {
    const runtimeProjection = createRuntimeProjectionFixture();
    const baseModel = createWorkbenchFlowModel({ runtimeProjection });
    const secondPoint = baseModel.runtimeNavigation.points[1];
    const editResultContext = {
      status: 'refreshed-edit-result',
      actionId: 'action-0002',
      runtimeStatePointId: secondPoint.statePointId,
      label: '开始时间',
      changeSummary: '0ms -> 1000ms',
    };

    const readyModel = createWorkbenchFlowModel({
      runtimeProjection,
      actionEditResultContext: editResultContext,
    });
    expect(readyModel.phase).toBe(WORKBENCH_FLOW_PHASES.EDIT_RESULT_READY);
    expect(readyModel.editResult).toMatchObject({
      actionId: 'action-0002',
      statePointId: secondPoint.statePointId,
      runtimeStatePointId: secondPoint.statePointId,
      label: '开始时间 0ms -> 1000ms',
      changeSummary: '0ms -> 1000ms',
      canReturn: true,
    });

    const reviewModel = createWorkbenchFlowModel({
      runtimeProjection,
      selectedStateCurvePointId: secondPoint.statePointId,
      runtimeSelectedDetail: {
        actionId: 'action-0002',
        statePointId: secondPoint.statePointId,
        frameLabel: '30f',
        trackLabel: '自身能量',
      },
      actionEditResultContext: editResultContext,
    });
    expect(reviewModel.phase).toBe(WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW);
  });

  it('describes enabled and disabled workbench flow actions', () => {
    const enabledAction = createWorkbenchFlowAction({
      kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
      source: 'analysis-action-result',
      actionId: 'action-0001',
      statePointId: 'state-point-001',
    });

    expect(enabledAction).toMatchObject({
      kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
      source: 'analysis-action-result',
      actionId: 'action-0001',
      statePointId: 'state-point-001',
      canRun: true,
      disabledReason: '',
    });

    const disabledAction = createWorkbenchFlowAction({
      kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT,
      source: 'analysis-action-contribution',
      enabled: false,
      disabledReason: 'missing-contribution-state-point',
    });

    expect(disabledAction).toMatchObject({
      kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_CONTRIBUTION_POINT,
      source: 'analysis-action-contribution',
      canRun: false,
      disabledReason: 'missing-contribution-state-point',
    });
  });
});

function createRuntimeProjectionFixture() {
  return {
    outputContract: {
      outputs: {
        simLog: {
          rowCount: 2,
        },
      },
      summary: {
        simLogCount: 2,
      },
    },
    summary: {
      simLogCount: 2,
    },
    simLog: [
      {
        sourceDeltaId: 'hp-delta',
        actionId: 'action-0001',
        frameIndex: 12,
        sequenceIndex: 0,
        stateCurveSequenceIndex: 0,
        trackKey: 'enemyHpDamage',
        layerKey: 'applied',
      },
      {
        sourceDeltaId: 'energy-delta',
        actionId: 'action-0002',
        frameIndex: 30,
        sequenceIndex: 1,
        stateCurveSequenceIndex: 1,
        trackKey: 'selfEnergyChange',
        layerKey: 'applied',
      },
    ],
    stateCurves: {
      enemy: {
        points: [
          {
            sourceDeltaId: 'hp-delta',
            actionId: 'action-0001',
            frameIndex: 12,
            sequenceIndex: 0,
            stateCurveSequenceIndex: 0,
            trackKey: 'enemyHpDamage',
            layerKey: 'applied',
          },
        ],
      },
    },
    resourceCurves: {
      curvesByActor: [
        {
          actorId: 'actor-001',
          actorName: '末音',
          points: [
            {
              sourceDeltaId: 'energy-delta',
              actionId: 'action-0002',
              frameIndex: 30,
              sequenceIndex: 1,
              stateCurveSequenceIndex: 1,
              trackKey: 'selfEnergyChange',
              layerKey: 'applied',
            },
          ],
        },
      ],
    },
  };
}
