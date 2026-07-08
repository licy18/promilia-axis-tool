export const WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS = Object.freeze({
  RUNTIME_ACTION_FOCUS: 'runtime-action-focus',
  EDIT_SOURCE_FOCUS: 'edit-source-focus',
});

export function createRuntimeActionEditFocusPlan({
  actionId = '',
  fieldKey = 'startMs',
  frameLabel = '',
  statePointId = '',
  trackKey = '',
  sequence = 0,
} = {}) {
  const normalizedActionId = actionId ?? '';
  return createActionEditFlowPlan({
    kind: WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS.RUNTIME_ACTION_FOCUS,
    canApply: Boolean(normalizedActionId),
    actionId: normalizedActionId,
    requiresExistingAction: true,
    actionEditFocus: {
      actionId: normalizedActionId,
      fieldKey: fieldKey || 'startMs',
      label: '结果定位',
      previousValue: '',
      nextValue: '',
      changeSummary: formatRuntimeActionFocusSummary({
        frameLabel,
        trackKey,
      }),
      editOrigin: 'runtime-focus',
      originStatePointId: statePointId ?? '',
      originTrackKey: trackKey ?? '',
      originFrameLabel: frameLabel ?? '',
      sequence: Number(sequence) + 1,
    },
  });
}

export function createEditSourceActionEditFocusPlan({
  source = {},
  sequence = 0,
} = {}) {
  const actionId = source?.actionId ?? '';
  const fieldKey = source?.fieldKey ?? '';
  return createActionEditFlowPlan({
    kind: WORKBENCH_ACTION_EDIT_FLOW_PLAN_KINDS.EDIT_SOURCE_FOCUS,
    canApply: Boolean(actionId && fieldKey),
    actionId,
    requiresExistingAction: false,
    actionEditFocus: {
      actionId,
      fieldKey,
      label: source?.label ?? '',
      previousValue: source?.previousValue ?? '',
      nextValue: source?.nextValue ?? '',
      changeSummary: source?.changeSummary ?? '',
      sequence: Number(sequence) + 1,
    },
  });
}

function createActionEditFlowPlan({
  kind,
  canApply,
  actionId = '',
  requiresExistingAction = false,
  actionEditFocus = {},
} = {}) {
  return {
    kind,
    canApply: Boolean(canApply),
    actionId: actionId ?? '',
    requiresExistingAction: Boolean(requiresExistingAction),
    actionEditFocus,
  };
}

function formatRuntimeActionFocusSummary({ frameLabel = '', trackKey = '' }) {
  const parts = [
    frameLabel ? `三值点 ${frameLabel}` : '三值点',
    formatRuntimeActionFocusTrack(trackKey),
  ].filter(Boolean);
  return parts.join(' · ');
}

function formatRuntimeActionFocusTrack(trackKey) {
  if (trackKey === 'enemyHpDamage') {
    return '敌人 HP';
  }
  if (trackKey === 'enemyToughnessDamage') {
    return '敌人韧性';
  }
  if (trackKey === 'selfEnergyChange') {
    return '自身能量';
  }
  return '';
}
