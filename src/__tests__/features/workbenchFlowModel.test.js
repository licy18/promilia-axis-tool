import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_FLOW_ACTION_KINDS,
  WORKBENCH_FLOW_PHASES,
  WORKBENCH_MAIN_FLOW_REGIONS,
  WORKBENCH_FLOW_PRIMARY_ACTION_KEYS,
  WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS,
  WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES,
  createWorkbenchFlowAction,
  createWorkbenchFlowModel,
  createWorkbenchMainFlowStatusView,
  createWorkbenchRuntimeReviewFlowView,
  resolveWorkbenchMainFlowActionEditTarget,
  resolveWorkbenchMainFlowResultReturnTarget,
} from '../../features/workbench/workbenchFlowModel';

describe('workbench flow model', () => {
  it('centralizes runtime navigation, controls, and action-edit phase', () => {
    const runtimeProjection = createRuntimeProjectionFixture();
    const model = createWorkbenchFlowModel({
      selectedAction: { id: 'action-0002', name: '资源动作' },
      generationBundle: createGenerationBundleFixture(),
      runtimeProjection,
    });

    expect(model.phase).toBe(WORKBENCH_FLOW_PHASES.ACTION_EDIT);
    expect(model.selectedActionId).toBe('action-0002');
    expect(model.selectedActionName).toBe('资源动作');
    expect(model.runtimeFocusSource).toBe('');
    expect(model.runtimeSimLogCount).toBe(2);
    expect(model.contractContext).toMatchObject({
      contractName: 'Action -> Hit -> ThreeValueDelta',
      generationEntry: {
        status: 'action-hit-three-value-delta-generation-ready',
        ready: true,
      },
      runtimeInput: {
        appliedDeltaSource: 'threeValueRuntimeInput.appliedDeltas',
        ready: true,
      },
      runtimeOutput: {
        status: 'runtime-output-contract-ready',
        ready: true,
      },
    });
    expect(model.controls).toMatchObject({
      canOpenRuntimeResults: true,
      canFocusRuntimeAction: false,
      canReturnRuntimeResult: false,
    });
    expect(model.primaryAction).toMatchObject({
      key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.OPEN_RUNTIME_RESULTS,
      kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
      label: '查看运行结果',
      actionId: 'action-0002',
      statePointId: '',
      enabled: true,
    });
    expect(model.mainFlowState).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.ACTION_EDIT,
      nextTargetKind: 'runtime-results',
      currentRuntimeStatePointId: '',
      refreshedRuntimeStatePointId: '',
      actionEditStatePointId: '',
      returnStatePointId: '',
      canFocusRuntimeAction: false,
      canReturnRuntimeResult: false,
    });
    expect(model.mainFlowSelection).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.ACTION_EDIT,
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      inspectorMode: 'action-properties',
      selectedActionId: 'action-0002',
      selectedActionName: '资源动作',
      selectedRuntimeStatePointId: '',
      pendingRuntimeStatePointId: '',
      hasRuntimeSelection: false,
      hasPendingRuntimeResult: false,
    });
    expect(model.mainFlowLoopState).toMatchObject({
      step: 'action-edit',
      status: 'ready',
      recoveryNeeded: false,
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      nextActionKind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
      nextTargetKind: 'runtime-results',
      canRunNextAction: true,
      targetActionId: 'action-0002',
      targetStatePointId: '',
    });
    expect(model.runtimeReviewSelection).toMatchObject({
      status: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.EMPTY,
      selectedActionId: '',
      selectedStatePointId: '',
      pendingActionId: '',
      pendingStatePointId: '',
      source: '',
      sourceKind: 'none',
      hasSelection: false,
      hasPendingResult: false,
      overviewActive: false,
      canFocusAction: false,
      canReturnResult: false,
    });
    expect(model.runtimeReviewOperations).toMatchObject({
      primaryOperationKind: '',
      primaryOperationEnabled: false,
      canRunAnyOperation: false,
      selectionStatus: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.EMPTY,
      selectedStatePointId: '',
      pendingStatePointId: '',
      primaryOperation: {
        kind: '',
        enabled: false,
        label: '主操作',
        actionId: '',
        statePointId: '',
        target: null,
      },
      focusAction: {
        kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
        enabled: false,
        disabledReason: 'missing-runtime-action',
      },
      returnResult: {
        kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
        enabled: false,
        disabledReason: 'missing-runtime-result',
      },
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
      flowDispatchState: {
        sequence: 1,
        handled: true,
        kind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
        source: 'analysis-action-result',
        actionId: 'action-0001',
        statePointId: firstPoint.statePointId,
      },
    });

    expect(model.phase).toBe(WORKBENCH_FLOW_PHASES.RUNTIME_RESULT);
    expect(model.runtimeDetail).toMatchObject({
      actionId: 'action-0001',
      statePointId: firstPoint.statePointId,
      label: '12f · 敌人 HP',
      canFocusAction: true,
    });
    expect(model.runtimeActionEditTarget).toMatchObject({
      actionId: 'action-0001',
      fieldKey: 'startMs',
      frameLabel: '12f',
      statePointId: firstPoint.statePointId,
      trackKey: 'enemyHpDamage',
      trackLabel: '敌人 HP',
      canFocusAction: true,
    });
    expect(model.runtimeFocusSource).toBe('action-result');
    expect(model.primaryAction).toMatchObject({
      key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.FOCUS_RUNTIME_ACTION,
      kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
      label: '编辑结果动作',
      actionId: 'action-0001',
      statePointId: firstPoint.statePointId,
      enabled: true,
    });
    expect(model.mainFlowState).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.RUNTIME_RESULT,
      nextTargetKind: 'runtime-action-edit',
      currentRuntimeStatePointId: firstPoint.statePointId,
      actionEditStatePointId: firstPoint.statePointId,
      returnStatePointId: '',
      canFocusRuntimeAction: true,
      canReturnRuntimeResult: false,
    });
    expect(model.mainFlowSelection).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.RUNTIME_RESULT,
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      inspectorMode: 'runtime-detail',
      selectedActionId: 'action-0001',
      selectedStateCurvePointId: firstPoint.statePointId,
      selectedRuntimeStatePointId: firstPoint.statePointId,
      pendingRuntimeStatePointId: '',
      runtimeFocusSource: 'action-result',
      hasRuntimeSelection: true,
      hasPendingRuntimeResult: false,
    });
    expect(model.runtimeReviewSelection).toMatchObject({
      status: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.SELECTED,
      selectedActionId: 'action-0001',
      selectedStatePointId: firstPoint.statePointId,
      pendingStatePointId: '',
      source: 'action-result',
      sourceKind: 'action-result',
      frameLabel: '12f',
      trackKey: 'enemyHpDamage',
      trackLabel: '敌人 HP',
      hasSelection: true,
      hasPendingResult: false,
      overviewActive: false,
      canFocusAction: true,
      canReturnResult: false,
      actionEditTargetActionId: 'action-0001',
      actionEditTargetStatePointId: firstPoint.statePointId,
      resultReturnStatePointId: '',
      lastActionKind: WORKBENCH_FLOW_ACTION_KINDS.SELECT_RUNTIME_RESULT,
      lastActionSource: 'analysis-action-result',
      lastActionHandled: true,
      lastActionStatePointId: firstPoint.statePointId,
    });
    expect(model.runtimeReviewOperations).toMatchObject({
      primaryOperationKind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
      primaryOperationEnabled: true,
      canRunAnyOperation: true,
      selectionStatus: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.SELECTED,
      selectedStatePointId: firstPoint.statePointId,
      primaryOperation: {
        kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
        enabled: true,
        label: '定位动作',
        actionId: 'action-0001',
        statePointId: firstPoint.statePointId,
        sourceKind: 'action-result',
        target: {
          kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
          actionId: 'action-0001',
          statePointId: firstPoint.statePointId,
        },
      },
      focusAction: {
        enabled: true,
        actionId: 'action-0001',
        statePointId: firstPoint.statePointId,
        fieldKey: 'startMs',
        frameLabel: '12f',
        trackKey: 'enemyHpDamage',
        trackLabel: '敌人 HP',
        sourceKind: 'action-result',
      },
      returnResult: {
        enabled: false,
        statePointId: '',
      },
    });
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
    const firstPoint = baseModel.runtimeNavigation.points[0];
    const secondPoint = baseModel.runtimeNavigation.points[1];
    const editResultContext = {
      status: 'refreshed-edit-result',
      actionId: 'action-0002',
      runtimeStatePointId: secondPoint.statePointId,
      originStatePointId: firstPoint.statePointId,
      label: '开始时间',
      changeSummary: '0ms -> 1000ms',
    };
    const actionEditFocus = {
      actionId: 'action-0002',
      fieldKey: 'startMs',
      editOrigin: 'runtime-focus',
      originStatePointId: firstPoint.statePointId,
      changeSummary: '0ms -> 1000ms',
    };

    const readyModel = createWorkbenchFlowModel({
      selectedAction: { id: 'action-0002', name: '资源动作' },
      runtimeProjection,
      actionEditFocus,
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
    expect(readyModel.primaryAction).toMatchObject({
      key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.RETURN_RUNTIME_RESULT,
      kind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
      label: '回到刷新结果',
      actionId: 'action-0002',
      statePointId: secondPoint.statePointId,
      enabled: true,
    });
    expect(readyModel.runtimeResultReturnTarget).toMatchObject({
      status: 'refreshed-edit-result',
      actionId: 'action-0002',
      fieldKey: 'startMs',
      originStatePointId: firstPoint.statePointId,
      statePointId: secondPoint.statePointId,
    });
    expect(readyModel.mainFlowState).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.EDIT_RESULT_READY,
      nextTargetKind: 'runtime-result-return',
      currentRuntimeStatePointId: '',
      refreshedRuntimeStatePointId: secondPoint.statePointId,
      actionEditStatePointId: '',
      returnStatePointId: secondPoint.statePointId,
      canFocusRuntimeAction: false,
      canReturnRuntimeResult: true,
    });
    expect(readyModel.mainFlowSelection).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.EDIT_RESULT_READY,
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      inspectorMode: 'edit-result',
      selectedActionId: 'action-0002',
      selectedRuntimeStatePointId: '',
      pendingRuntimeStatePointId: secondPoint.statePointId,
      refreshedRuntimeStatePointId: secondPoint.statePointId,
      hasRuntimeSelection: false,
      hasPendingRuntimeResult: true,
    });
    expect(readyModel.mainFlowLoopState).toMatchObject({
      step: 'edit-result-ready',
      status: 'ready',
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      nextActionKind: WORKBENCH_FLOW_ACTION_KINDS.RETURN_RUNTIME_RESULT,
      nextTargetKind: 'runtime-result-return',
      canRunNextAction: true,
      targetActionId: 'action-0002',
      targetStatePointId: secondPoint.statePointId,
    });
    expect(readyModel.runtimeReviewSelection).toMatchObject({
      status: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.PENDING_RESULT,
      selectedActionId: '',
      selectedStatePointId: '',
      pendingActionId: 'action-0002',
      pendingStatePointId: secondPoint.statePointId,
      refreshedStatePointId: secondPoint.statePointId,
      hasSelection: false,
      hasPendingResult: true,
      canFocusAction: false,
      canReturnResult: true,
      resultReturnActionId: 'action-0002',
      resultReturnStatePointId: secondPoint.statePointId,
    });
    expect(readyModel.runtimeReviewOperations).toMatchObject({
      primaryOperationKind:
        WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
      primaryOperationEnabled: true,
      canRunAnyOperation: true,
      selectionStatus:
        WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.PENDING_RESULT,
      selectedStatePointId: '',
      pendingStatePointId: secondPoint.statePointId,
      primaryOperation: {
        kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
        enabled: true,
        label: '回到结果点',
        actionId: 'action-0002',
        statePointId: secondPoint.statePointId,
        target: {
          kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
          actionId: 'action-0002',
          statePointId: secondPoint.statePointId,
        },
      },
      focusAction: {
        enabled: false,
        disabledReason: 'missing-runtime-action',
      },
      returnResult: {
        enabled: true,
        actionId: 'action-0002',
        statePointId: secondPoint.statePointId,
        originStatePointId: firstPoint.statePointId,
        status: 'refreshed-edit-result',
      },
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
      actionEditFocus,
      actionEditResultContext: editResultContext,
    });
    expect(reviewModel.phase).toBe(WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW);
    expect(reviewModel.runtimeActionEditTarget).toMatchObject({
      actionId: 'action-0002',
      fieldKey: 'startMs',
      frameLabel: '30f',
      statePointId: secondPoint.statePointId,
      trackLabel: '自身能量',
      canFocusAction: true,
    });
    expect(reviewModel.primaryAction).toMatchObject({
      key: WORKBENCH_FLOW_PRIMARY_ACTION_KEYS.FOCUS_RUNTIME_ACTION,
      kind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
      label: '继续修改动作',
      actionId: 'action-0002',
      statePointId: secondPoint.statePointId,
      enabled: true,
    });
    expect(reviewModel.runtimeResultReturnTarget).toMatchObject({
      status: 'refreshed-edit-result',
      actionId: 'action-0002',
      originStatePointId: firstPoint.statePointId,
      statePointId: secondPoint.statePointId,
    });
    expect(reviewModel.mainFlowState).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW,
      nextTargetKind: 'runtime-action-edit',
      currentRuntimeStatePointId: secondPoint.statePointId,
      refreshedRuntimeStatePointId: secondPoint.statePointId,
      actionEditStatePointId: secondPoint.statePointId,
      returnStatePointId: secondPoint.statePointId,
      canFocusRuntimeAction: true,
      canReturnRuntimeResult: true,
    });
    expect(reviewModel.mainFlowSelection).toMatchObject({
      phase: WORKBENCH_FLOW_PHASES.EDIT_RESULT_REVIEW,
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      inspectorMode: 'runtime-detail',
      selectedRuntimeStatePointId: secondPoint.statePointId,
      pendingRuntimeStatePointId: '',
      refreshedRuntimeStatePointId: secondPoint.statePointId,
      hasRuntimeSelection: true,
      hasPendingRuntimeResult: false,
    });
    expect(reviewModel.mainFlowLoopState).toMatchObject({
      step: 'edit-result-review',
      status: 'ready',
      currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
      nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
      nextActionKind: WORKBENCH_FLOW_ACTION_KINDS.FOCUS_RUNTIME_ACTION,
      nextTargetKind: 'runtime-action-edit',
      canRunNextAction: true,
      targetActionId: 'action-0002',
      targetStatePointId: secondPoint.statePointId,
    });
    expect(reviewModel.runtimeReviewSelection).toMatchObject({
      status: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.SELECTED,
      selectedActionId: 'action-0002',
      selectedStatePointId: secondPoint.statePointId,
      pendingStatePointId: '',
      refreshedStatePointId: secondPoint.statePointId,
      frameLabel: '30f',
      trackLabel: '自身能量',
      hasSelection: true,
      hasPendingResult: false,
      canFocusAction: true,
      canReturnResult: true,
      actionEditTargetStatePointId: secondPoint.statePointId,
      resultReturnStatePointId: secondPoint.statePointId,
    });
    expect(reviewModel.runtimeReviewOperations).toMatchObject({
      primaryOperationKind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
      primaryOperationEnabled: true,
      canRunAnyOperation: true,
      selectionStatus: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.SELECTED,
      selectedStatePointId: secondPoint.statePointId,
      primaryOperation: {
        kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
        enabled: true,
        label: '定位动作',
        actionId: 'action-0002',
        statePointId: secondPoint.statePointId,
        target: {
          kind: WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
          actionId: 'action-0002',
          statePointId: secondPoint.statePointId,
        },
      },
      focusAction: {
        enabled: true,
        actionId: 'action-0002',
        statePointId: secondPoint.statePointId,
        frameLabel: '30f',
        trackLabel: '自身能量',
      },
      returnResult: {
        enabled: true,
        actionId: 'action-0002',
        statePointId: secondPoint.statePointId,
        originStatePointId: firstPoint.statePointId,
      },
    });
    expect(
      resolveWorkbenchMainFlowActionEditTarget({
        flowModel: reviewModel,
        statePointId: secondPoint.statePointId,
      })
    ).toMatchObject({
      actionId: 'action-0002',
      statePointId: secondPoint.statePointId,
    });
    expect(
      resolveWorkbenchMainFlowActionEditTarget({
        flowModel: reviewModel,
        fallbackTarget: {
          actionId: 'action-0001',
          statePointId: firstPoint.statePointId,
        },
        statePointId: firstPoint.statePointId,
      })
    ).toMatchObject({
      actionId: 'action-0001',
      statePointId: firstPoint.statePointId,
    });
    expect(
      resolveWorkbenchMainFlowResultReturnTarget({
        flowModel: readyModel,
      })
    ).toMatchObject({
      actionId: 'action-0002',
      statePointId: secondPoint.statePointId,
      originStatePointId: firstPoint.statePointId,
    });
    expect(
      resolveWorkbenchMainFlowResultReturnTarget({
        flowModel: readyModel,
        fallbackTarget: {
          actionId: 'action-0002',
          statePointId: firstPoint.statePointId,
        },
        statePointId: firstPoint.statePointId,
      })
    ).toMatchObject({
      actionId: 'action-0002',
      statePointId: firstPoint.statePointId,
    });
    expect(
      resolveWorkbenchMainFlowResultReturnTarget({
        flowModel: createWorkbenchFlowModel({ runtimeProjection }),
      })
    ).toBeNull();
  });

  it('normalizes main flow dispatch result state', () => {
    const idleModel = createWorkbenchFlowModel();
    expect(idleModel.mainFlowDispatchResult).toMatchObject({
      sequence: 0,
      status: 'idle',
      handled: false,
      hasResult: false,
      kind: '',
      source: '',
      handlerKey: '',
      reason: '',
    });

    const handledModel = createWorkbenchFlowModel({
      flowDispatchState: {
        sequence: 2,
        handled: true,
        kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
        source: 'workbench-flow-panel',
        handlerKey: 'openRuntimeResults',
        actionId: 'action-0001',
      },
    });
    expect(handledModel.mainFlowDispatchResult).toMatchObject({
      sequence: 2,
      status: 'handled',
      handled: true,
      hasResult: true,
      kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
      source: 'workbench-flow-panel',
      handlerKey: 'openRuntimeResults',
      reason: '',
      actionId: 'action-0001',
    });
    expect(handledModel.mainFlowLoopState).toMatchObject({
      status: 'advanced',
      recoveryNeeded: false,
      lastDispatchStatus: 'handled',
      lastDispatchKind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
      lastDispatchHandled: true,
      lastDispatchReason: '',
    });

    const failedModel = createWorkbenchFlowModel({
      flowDispatchState: {
        sequence: 3,
        handled: false,
        kind: 'unsupported-flow-action',
        source: 'test-flow-source',
        reason: 'unsupported-flow-action-kind',
        statePointId: 'runtime-point-for-failure',
      },
    });
    expect(failedModel.mainFlowDispatchResult).toMatchObject({
      sequence: 3,
      status: 'failed',
      handled: false,
      hasResult: true,
      kind: 'unsupported-flow-action',
      source: 'test-flow-source',
      reason: 'unsupported-flow-action-kind',
      statePointId: 'runtime-point-for-failure',
    });
    expect(failedModel.mainFlowLoopState).toMatchObject({
      status: 'blocked',
      recoveryNeeded: true,
      lastDispatchStatus: 'failed',
      lastDispatchKind: 'unsupported-flow-action',
      lastDispatchHandled: false,
      lastDispatchReason: 'unsupported-flow-action-kind',
    });
  });

  it('creates a main flow status view for dispatch and loop state', () => {
    const handledModel = createWorkbenchFlowModel({
      flowDispatchState: {
        sequence: 2,
        handled: true,
        kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
        source: 'workbench-flow-panel',
        handlerKey: 'openRuntimeResults',
        actionId: 'action-0001',
        statePointId: 'state-point-0001',
      },
    });

    expect(
      createWorkbenchMainFlowStatusView({ flowModel: handledModel })
    ).toMatchObject({
      dispatch: {
        sequence: 2,
        status: 'handled',
        handled: true,
        handledState: 'true',
        hasResult: true,
        hasResultState: 'true',
        kind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
        source: 'workbench-flow-panel',
        handlerKey: 'openRuntimeResults',
        reason: '',
        actionId: 'action-0001',
        statePointId: 'state-point-0001',
      },
      loop: {
        status: 'advanced',
        recoveryNeeded: false,
        recoveryNeededState: 'false',
        nextActionKind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
        nextTargetKind: 'runtime-results',
      },
    });

    expect(
      createWorkbenchMainFlowStatusView({
        mainFlowDispatchResult: {
          sequence: 3,
          status: 'failed',
          handled: false,
          hasResult: true,
          kind: 'unsupported-flow-action',
          source: 'test-flow-source',
          reason: 'unsupported-flow-action-kind',
        },
        mainFlowLoopState: {
          step: 'action-edit',
          status: 'blocked',
          recoveryNeeded: true,
          nextActionKind: WORKBENCH_FLOW_ACTION_KINDS.OPEN_RUNTIME_RESULTS,
          nextTargetKind: 'runtime-results',
          currentRegion: 'action-edit',
          nextRegion: 'runtime-review',
        },
      })
    ).toMatchObject({
      dispatch: {
        sequence: 3,
        status: 'failed',
        handledState: 'false',
        hasResultState: 'true',
        reason: 'unsupported-flow-action-kind',
      },
      loop: {
        step: 'action-edit',
        status: 'blocked',
        recoveryNeededState: 'true',
        currentRegion: 'action-edit',
        nextRegion: 'runtime-review',
      },
    });
  });

  it('creates a runtime review flow view for selected and pending result states', () => {
    const runtimeProjection = createRuntimeProjectionFixture();
    const baseModel = createWorkbenchFlowModel({ runtimeProjection });
    const firstPoint = baseModel.runtimeNavigation.points[0];
    const secondPoint = baseModel.runtimeNavigation.points[1];

    const selectedView = createWorkbenchRuntimeReviewFlowView({
      flowModel: createWorkbenchFlowModel({
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
      }),
    });
    expect(selectedView).toMatchObject({
      region: {
        currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
        nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
        nextTargetKind: 'runtime-action-edit',
        inspectorMode: 'runtime-detail',
        selectedActionId: 'action-0001',
        selectedRuntimeStatePointId: firstPoint.statePointId,
        pendingRuntimeStatePointId: '',
      },
      selection: {
        status: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.SELECTED,
        selectedActionId: 'action-0001',
        selectedStatePointId: firstPoint.statePointId,
        pendingStatePointId: '',
        source: 'action-result',
        sourceKind: 'action-result',
        hasSelection: true,
        hasSelectionState: 'true',
        hasPendingResult: false,
        hasPendingResultState: 'false',
      },
      operations: {
        primaryOperationKind:
          WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.FOCUS_ACTION,
        primaryOperationEnabled: true,
        primaryOperationEnabledState: 'true',
        canRunAnyOperation: true,
        canRunAnyOperationState: 'true',
        primaryActionId: 'action-0001',
        primaryStatePointId: firstPoint.statePointId,
        primaryLabel: '定位动作',
        focusActionEnabledState: 'true',
        returnResultEnabledState: 'false',
      },
    });

    const pendingView = createWorkbenchRuntimeReviewFlowView({
      flowModel: createWorkbenchFlowModel({
        selectedAction: { id: 'action-0002', name: '资源动作' },
        runtimeProjection,
        actionEditFocus: {
          actionId: 'action-0002',
          fieldKey: 'startMs',
          editOrigin: 'runtime-focus',
          originStatePointId: firstPoint.statePointId,
        },
        actionEditResultContext: {
          status: 'refreshed-edit-result',
          actionId: 'action-0002',
          runtimeStatePointId: secondPoint.statePointId,
          originStatePointId: firstPoint.statePointId,
          label: '开始时间',
          changeSummary: '0ms -> 1000ms',
        },
      }),
    });
    expect(pendingView).toMatchObject({
      region: {
        currentRegion: WORKBENCH_MAIN_FLOW_REGIONS.ACTION_EDIT,
        nextRegion: WORKBENCH_MAIN_FLOW_REGIONS.RUNTIME_REVIEW,
        nextTargetKind: 'runtime-result-return',
        selectedActionId: 'action-0002',
        selectedRuntimeStatePointId: '',
        pendingRuntimeStatePointId: secondPoint.statePointId,
        refreshedRuntimeStatePointId: secondPoint.statePointId,
      },
      selection: {
        status: WORKBENCH_RUNTIME_REVIEW_SELECTION_STATUSES.PENDING_RESULT,
        selectedActionId: '',
        selectedStatePointId: '',
        pendingActionId: 'action-0002',
        pendingStatePointId: secondPoint.statePointId,
        refreshedStatePointId: secondPoint.statePointId,
        hasSelectionState: 'false',
        hasPendingResultState: 'true',
      },
      operations: {
        primaryOperationKind:
          WORKBENCH_RUNTIME_REVIEW_OPERATION_KINDS.RETURN_RESULT,
        primaryOperationEnabledState: 'true',
        primaryActionId: 'action-0002',
        primaryStatePointId: secondPoint.statePointId,
        primaryLabel: '回到结果点',
        focusActionEnabledState: 'false',
        returnResultEnabledState: 'true',
      },
    });
  });

  it('describes enabled and disabled workbench flow actions', () => {
    expect(WORKBENCH_FLOW_ACTION_KINDS).toMatchObject({
      OPEN_RUNTIME_RESULTS: 'open-runtime-results',
      SELECT_RUNTIME_RESULT: 'select-runtime-result',
      SELECT_RUNTIME_STATE_POINT: 'select-runtime-state-point',
      SELECT_CONTRIBUTION_POINT: 'select-contribution-point',
      FOCUS_RUNTIME_ACTION: 'focus-runtime-action',
      FOCUS_EDIT_SOURCE: 'focus-edit-source',
      RETURN_RUNTIME_RESULT: 'return-runtime-result',
    });

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
    runtimeInput: {
      sourceKind: 'azpr-runtime-input-from-generation-builder-source',
      status: 'runtime-input-ready-with-applied-deltas',
      appliedDeltaSource: 'threeValueRuntimeInput.appliedDeltas',
      summary: {
        inputDeltaCount: 2,
        appliedDeltaCount: 2,
      },
      appliedOnly: true,
    },
    outputContract: {
      sourceKind: 'azpr-three-value-runtime-output-contract',
      status: 'runtime-output-contract-ready',
      outputs: {
        simLog: {
          inputSource: 'threeValueRuntimeInput.appliedDeltas',
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

function createGenerationBundleFixture() {
  return {
    contractName: 'Action -> Hit -> ThreeValueDelta',
    actionHitThreeValueDeltaGeneration: {
      sourceKind: 'azpr-action-hit-three-value-delta-generation-entry',
      status: 'action-hit-three-value-delta-generation-ready',
      summary: {
        actionCount: 2,
        hitCount: 2,
        deltaCount: 2,
        appliedDeltaCount: 2,
      },
    },
    standardContract: {
      sourceKind: 'azpr-action-hit-three-value-delta-standard-contract',
      status: 'action-hit-three-value-delta-contract-ready',
      name: 'Action -> Hit -> ThreeValueDelta',
      summary: {
        actionCount: 2,
        hitCount: 2,
        deltaCount: 2,
        appliedDeltaCount: 2,
      },
    },
  };
}
