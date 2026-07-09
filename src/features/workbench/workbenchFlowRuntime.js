import { createWorkbenchFlowRuntimePointSelectionState } from './workbenchFlowRuntimePointSelection';
import { createWorkbenchFlowRuntimeScopeState } from './workbenchFlowRuntimeScope';
import {
  createWorkbenchCalculatorScopeViewPatch,
  createWorkbenchRuntimeFlowViewPatch,
  createWorkbenchRuntimePointSelectionViewPatch,
} from './workbenchRuntimeViewState';

export function createWorkbenchFlowRuntime({
  actionExists = () => false,
  selectAction = () => {},
  setActionEditFocus = () => {},
  applyActionSelectionState = null,
  applyActionEditState = null,
  applyActionMutationRuntimeSyncState = null,
  setCalculatorScope = () => {},
  getFirstRuntimeStatePointId = () => '',
  isRuntimeOverviewActive = () => false,
  isRuntimeStatePointSelected = () => false,
  getCurrentRuntimeLogFocus = () => null,
  applyRuntimeViewPatch = null,
  applyCalculatorScopeState = null,
  applyRuntimePointSelectionState = null,
  applyRuntimeViewState = null,
  selectRuntimeStatePoint = () => {},
  clearRuntimeSelection = () => {},
  setStateCurveLayerFilters = () => {},
  setStateCurveTrackFilters = () => {},
  focusRuntimeLog = () => {},
} = {}) {
  function createActionSelectionState(actionId = '') {
    const requestedActionId = actionId ?? '';
    const shouldSelectAction = Boolean(
      requestedActionId && actionExists(requestedActionId)
    );
    return {
      requestedActionId,
      actionId: shouldSelectAction ? requestedActionId : '',
      shouldSelectAction,
      syncRuntimeResult: false,
    };
  }

  function applyActionSelectionStateForAction(actionId = '') {
    const selectionState = createActionSelectionState(actionId);
    if (!selectionState.shouldSelectAction) {
      return selectionState;
    }
    if (typeof applyActionSelectionState === 'function') {
      applyActionSelectionState(selectionState);
    } else {
      selectAction(selectionState.actionId, {
        syncRuntimeResult: selectionState.syncRuntimeResult,
      });
    }
    return selectionState;
  }

  function createActionEditState(flowPlan = {}) {
    const actionSelection = createActionSelectionState(flowPlan.actionId);
    return {
      actionId: flowPlan.actionId ?? '',
      actionSelection,
      actionEditFocus: { ...(flowPlan.actionEditFocus ?? {}) },
    };
  }

  function applyActionEditStateForPlan(flowPlan = {}) {
    const editState = createActionEditState(flowPlan);
    if (typeof applyActionEditState === 'function') {
      applyActionEditState(editState);
    } else {
      if (editState.actionSelection.shouldSelectAction) {
        selectAction(editState.actionSelection.actionId, {
          syncRuntimeResult: editState.actionSelection.syncRuntimeResult,
        });
      }
      setActionEditFocus({ ...editState.actionEditFocus });
    }
    return editState;
  }

  function createActionMutationRuntimeSyncState({
    actionId = '',
    shouldSyncRuntimeResult = null,
    mutationSelectedAction = false,
    mutationTouchedRuntimeAction = false,
    force = false,
  } = {}) {
    const requestedActionId = actionId ?? '';
    const actionAvailable = Boolean(
      requestedActionId && actionExists(requestedActionId)
    );
    const resolvedShouldSyncRuntimeResult = Boolean(
      force ||
        (typeof shouldSyncRuntimeResult === 'boolean'
          ? shouldSyncRuntimeResult
          : isRuntimeOverviewActive() || isRuntimeStatePointSelected())
    );
    const mutationAffectsCurrentReview = Boolean(
      force || mutationSelectedAction || mutationTouchedRuntimeAction
    );
    const shouldSyncAction = Boolean(
      resolvedShouldSyncRuntimeResult &&
        mutationAffectsCurrentReview &&
        actionAvailable
    );
    return {
      requestedActionId,
      actionId: shouldSyncAction ? requestedActionId : '',
      actionAvailable,
      shouldSyncRuntimeResult: resolvedShouldSyncRuntimeResult,
      mutationSelectedAction: Boolean(mutationSelectedAction),
      mutationTouchedRuntimeAction: Boolean(mutationTouchedRuntimeAction),
      force: Boolean(force),
    };
  }

  function applyActionMutationRuntimeSyncStateForMutation(mutation = {}) {
    const syncState = createActionMutationRuntimeSyncState(mutation);
    if (
      syncState.actionId &&
      typeof applyActionMutationRuntimeSyncState === 'function'
    ) {
      applyActionMutationRuntimeSyncState(syncState);
    }
    return syncState;
  }

  function applyRuntimePointSelectionStateForPoint(statePointId = '') {
    const selectionState = createWorkbenchFlowRuntimePointSelectionState({
      statePointId,
    });
    if (typeof applyRuntimeViewPatch === 'function') {
      applyRuntimeViewPatch(
        createWorkbenchRuntimePointSelectionViewPatch(
          selectionState,
          createRuntimeViewPatchOptions()
        )
      );
      return selectionState;
    }
    if (typeof applyRuntimePointSelectionState === 'function') {
      applyRuntimePointSelectionState(selectionState);
    } else {
      selectRuntimeStatePoint(selectionState.statePointId);
    }
    return selectionState;
  }

  function applyCalculatorScopeStateForScope(
    scope = '',
    { selectFirstRuntimePoint = true } = {}
  ) {
    const firstRuntimeStatePointId = selectFirstRuntimePoint
      ? getFirstRuntimeStatePointId()
      : '';
    const scopeState = createWorkbenchFlowRuntimeScopeState({
      scope,
      firstRuntimeStatePointId,
    });
    if (typeof applyRuntimeViewPatch === 'function') {
      applyRuntimeViewPatch(
        createWorkbenchCalculatorScopeViewPatch(
          scopeState,
          createRuntimeViewPatchOptions()
        )
      );
      return scopeState;
    }
    if (typeof applyCalculatorScopeState === 'function') {
      applyCalculatorScopeState(scopeState);
    } else {
      setCalculatorScope(scopeState.calculatorScope);
    }
    return scopeState;
  }

  function applyRuntimeViewStateForPlan(flowPlan = {}) {
    const viewState = createRuntimeViewState(flowPlan);
    if (!hasRuntimeViewStateChanges(viewState)) {
      return viewState;
    }
    if (typeof applyRuntimeViewPatch === 'function') {
      applyRuntimeViewPatch(
        createWorkbenchRuntimeFlowViewPatch(
          viewState,
          createRuntimeViewPatchOptions()
        )
      );
      return viewState;
    }
    if (typeof applyRuntimeViewState === 'function') {
      applyRuntimeViewState(viewState);
      return viewState;
    }
    if (viewState.clearRuntimeSelection) {
      clearRuntimeSelection({
        stateCurveFocusMode: viewState.stateCurveFocusMode,
      });
    }
    if (viewState.stateCurveLayerFilters) {
      setStateCurveLayerFilters({ ...viewState.stateCurveLayerFilters });
    }
    if (viewState.stateCurveTrackFilters) {
      setStateCurveTrackFilters({ ...viewState.stateCurveTrackFilters });
    }
    if (viewState.runtimeLogFocus.statePointId) {
      focusRuntimeLog({ ...viewState.runtimeLogFocus });
    }
    return viewState;
  }

  function createRuntimeViewPatchOptions() {
    return {
      currentRuntimeLogFocus: getCurrentRuntimeLogFocus(),
    };
  }

  return {
    applyCalculatorScope({
      scope = '',
      selectFirstRuntimePoint = true,
    } = {}) {
      applyCalculatorScopeStateForScope(scope, { selectFirstRuntimePoint });
      return createFlowRuntimeResult({
        applied: true,
        kind: 'calculator-scope-selection',
      });
    },

    applyRuntimePointSelection({ statePointId = '' } = {}) {
      applyRuntimePointSelectionStateForPoint(statePointId);
      return createFlowRuntimeResult({
        applied: true,
        kind: 'runtime-point-selection',
      });
    },

    applyActionMutationRuntimeSync(mutation = {}) {
      const syncState =
        applyActionMutationRuntimeSyncStateForMutation(mutation);
      return createFlowRuntimeResult({
        applied: Boolean(syncState.actionId),
        kind: 'action-mutation-runtime-sync',
        reason: getActionMutationRuntimeSyncReason(syncState),
      });
    },

    applyActionEditFlowPlan(plan = {}) {
      const flowPlan = plan ?? {};
      if (!flowPlan.canApply) {
        return createFlowRuntimeResult({
          applied: false,
          kind: flowPlan.kind,
          reason: 'disabled-action-edit-flow-plan',
        });
      }
      const actionSelection = createActionSelectionState(flowPlan.actionId);
      if (!actionSelection.shouldSelectAction && flowPlan.requiresExistingAction) {
        return createFlowRuntimeResult({
          applied: false,
          kind: flowPlan.kind,
          reason: 'missing-action-draft',
        });
      }

      applyActionEditStateForPlan(flowPlan);
      return createFlowRuntimeResult({
        applied: true,
        kind: flowPlan.kind,
      });
    },

    applyRuntimeFlowPlan(plan = {}) {
      const flowPlan = plan ?? {};
      if (flowPlan.selectActionId) {
        applyActionSelectionStateForAction(flowPlan.selectActionId);
      }

      if (flowPlan.calculatorScope) {
        if (flowPlan.pulseCalculatorFocus) {
          applyCalculatorScopeStateForScope(flowPlan.calculatorScope, {
            selectFirstRuntimePoint: flowPlan.selectFirstRuntimePoint,
          });
        } else {
          setCalculatorScope(flowPlan.calculatorScope);
        }
      }

      if (flowPlan.selectRuntimeStatePoint) {
        applyRuntimePointSelectionStateForPoint(flowPlan.statePointId);
      }
      applyRuntimeViewStateForPlan(flowPlan);

      return createFlowRuntimeResult({
        applied: true,
        kind: flowPlan.kind,
      });
    },
  };
}

function getActionMutationRuntimeSyncReason(syncState = {}) {
  if (syncState.actionId) {
    return '';
  }
  if (!syncState.shouldSyncRuntimeResult) {
    return 'runtime-review-inactive';
  }
  if (!syncState.actionAvailable) {
    return 'missing-action-draft';
  }
  if (
    !syncState.force &&
    !syncState.mutationSelectedAction &&
    !syncState.mutationTouchedRuntimeAction
  ) {
    return 'unaffected-action-mutation';
  }
  return 'runtime-sync-skipped';
}

function createRuntimeViewState(flowPlan = {}) {
  return {
    clearRuntimeSelection: Boolean(flowPlan.clearRuntimeSelection),
    stateCurveFocusMode: flowPlan.stateCurveFocusMode || 'all',
    stateCurveLayerFilters: flowPlan.stateCurveLayerFilters
      ? { ...flowPlan.stateCurveLayerFilters }
      : null,
    stateCurveTrackFilters: flowPlan.stateCurveTrackFilters
      ? { ...flowPlan.stateCurveTrackFilters }
      : null,
    runtimeLogFocus:
      flowPlan.runtimeLogFocusSource && flowPlan.statePointId
        ? {
            source: flowPlan.runtimeLogFocusSource,
            statePointId: flowPlan.statePointId,
          }
        : {
            source: '',
            statePointId: '',
          },
  };
}

function hasRuntimeViewStateChanges(viewState = {}) {
  return Boolean(
    viewState.clearRuntimeSelection ||
      viewState.stateCurveLayerFilters ||
      viewState.stateCurveTrackFilters ||
      viewState.runtimeLogFocus?.statePointId
  );
}

function createFlowRuntimeResult({ applied, kind = '', reason = '' } = {}) {
  return {
    applied: Boolean(applied),
    kind: kind ?? '',
    reason: applied ? '' : reason,
  };
}
