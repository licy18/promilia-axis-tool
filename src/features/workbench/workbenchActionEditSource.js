import { formatFrameTime } from '../../domain/timebase';
import { findFirstRuntimeStatePointForAction } from './runtimeProjectionPoints';

export const WORKBENCH_ACTION_EDIT_SOURCE_LABELS = Object.freeze({
  startMs: '开始时间变更',
  level: '等级变更',
  actionVariantIndex: '动作形态变更',
  damageSegmentIndex: '动作形态变更',
  durationMs: '时长变更',
  actorCharacterId: '动作归属变更',
  skillId: '技能变更',
  laneId: '轨道变更',
  change: '资源变化变更',
  eventType: '敌人事件变更',
  targetCharacterId: '切换目标变更',
  resource: '资源类型变更',
  reason: '资源原因变更',
  note: '备注变更',
});

export const WORKBENCH_ACTION_EDIT_SOURCE_PRIORITY = Object.freeze([
  'startMs',
  'level',
  'actionVariantIndex',
  'damageSegmentIndex',
  'durationMs',
  'actorCharacterId',
  'skillId',
  'laneId',
  'change',
  'eventType',
  'targetCharacterId',
  'resource',
  'reason',
  'note',
]);

export function createEmptyWorkbenchActionEditSource(sequence = 0) {
  return {
    actionId: '',
    fieldKey: '',
    label: '',
    previousValue: '',
    nextValue: '',
    changeSummary: '',
    editOrigin: '',
    focusSource: '',
    originLabel: '',
    originStatePointId: '',
    originTrackKey: '',
    originFrameLabel: '',
    sequence,
  };
}

export function createEmptyWorkbenchActionEditFocus(sequence = 0) {
  return {
    actionId: '',
    fieldKey: '',
    label: '',
    previousValue: '',
    nextValue: '',
    changeSummary: '',
    editOrigin: '',
    focusSource: '',
    originStatePointId: '',
    originTrackKey: '',
    originFrameLabel: '',
    sequence,
  };
}

export function createWorkbenchActionEditSource({
  actionId = '',
  patch = {},
  previousAction = null,
  nextAction = null,
  previousSource = null,
  focus = null,
  resolveSkillName = defaultValueNameResolver,
  resolveCharacterName = defaultValueNameResolver,
} = {}) {
  const fieldKey = resolveWorkbenchActionEditSourceField(patch);
  if (!actionId || !fieldKey) {
    return null;
  }

  return {
    actionId,
    fieldKey,
    label:
      WORKBENCH_ACTION_EDIT_SOURCE_LABELS[fieldKey] ?? `${fieldKey}变更`,
    ...createWorkbenchActionEditSourceChange({
      fieldKey,
      previousAction,
      nextAction,
      resolveSkillName,
      resolveCharacterName,
    }),
    ...createWorkbenchActionEditOrigin({
      actionId,
      focus,
    }),
    sequence: Number(previousSource?.sequence ?? 0) + 1,
  };
}

export function createWorkbenchActionEditOrigin({
  actionId = '',
  focus = null,
} = {}) {
  if (
    !actionId ||
    !focus?.actionId ||
    focus.actionId !== actionId ||
    focus.editOrigin !== 'runtime-focus'
  ) {
    return {
      editOrigin: '',
      focusSource: '',
      originLabel: '',
      originStatePointId: '',
      originTrackKey: '',
      originFrameLabel: '',
    };
  }

  return {
    editOrigin: focus.editOrigin,
    focusSource: focus.focusSource ?? '',
    originLabel: '来自结果定位',
    originStatePointId: focus.originStatePointId ?? '',
    originTrackKey: focus.originTrackKey ?? '',
    originFrameLabel: focus.originFrameLabel ?? '',
  };
}

export function createWorkbenchActionEditResultContext({
  source = {},
  runtimeProjection = null,
} = {}) {
  if (!source?.actionId) {
    return null;
  }

  const resultPoint = findFirstRuntimeStatePointForAction(
    runtimeProjection,
    source.actionId,
    {
      preferredTrackKey: source.originTrackKey ?? '',
    }
  );
  if (!resultPoint?.statePointId) {
    return null;
  }

  return {
    status: 'refreshed-edit-result',
    actionId: source.actionId,
    fieldKey: source.fieldKey ?? '',
    label: source.label ?? '',
    changeSummary: source.changeSummary ?? '',
    originStatePointId: source.originStatePointId ?? '',
    focusSource: source.focusSource ?? '',
    originTrackKey: source.originTrackKey ?? '',
    originFrameLabel: source.originFrameLabel ?? '',
    runtimeStatePointId: resultPoint.statePointId,
    runtimeTrackKey:
      resultPoint.row?.trackKey ?? resultPoint.point?.trackKey ?? '',
  };
}

export function resolveWorkbenchActionEditSourceField(patch = {}) {
  return WORKBENCH_ACTION_EDIT_SOURCE_PRIORITY.find(fieldKey =>
    Object.prototype.hasOwnProperty.call(patch, fieldKey)
  );
}

export function createWorkbenchActionEditSourceChange({
  fieldKey,
  previousAction = null,
  nextAction = null,
  resolveSkillName = defaultValueNameResolver,
  resolveCharacterName = defaultValueNameResolver,
} = {}) {
  const previousValue = formatWorkbenchActionEditSourceValue(
    fieldKey,
    getWorkbenchActionEditSourceRawValue(previousAction, fieldKey),
    {
      resolveSkillName,
      resolveCharacterName,
    }
  );
  const nextValue = formatWorkbenchActionEditSourceValue(
    fieldKey,
    getWorkbenchActionEditSourceRawValue(nextAction, fieldKey),
    {
      resolveSkillName,
      resolveCharacterName,
    }
  );
  return {
    previousValue,
    nextValue,
    changeSummary: formatWorkbenchActionEditSourceChangeSummary(
      previousValue,
      nextValue
    ),
  };
}

export function getWorkbenchActionEditSourceRawValue(action, fieldKey) {
  if (!action) {
    return null;
  }
  if (fieldKey === 'laneId') {
    return action.actorCharacterId;
  }
  if (fieldKey === 'damageSegmentIndex') {
    return action.actionVariantIndex ?? action.damageSegmentIndex;
  }
  return action[fieldKey];
}

export function formatWorkbenchActionEditSourceValue(
  fieldKey,
  value,
  {
    resolveSkillName = defaultValueNameResolver,
    resolveCharacterName = defaultValueNameResolver,
  } = {}
) {
  if (value == null || value === '') {
    return '空';
  }
  if (fieldKey === 'startMs' || fieldKey === 'durationMs') {
    return formatFrameTime(value);
  }
  if (fieldKey === 'skillId') {
    return resolveSkillName(value);
  }
  if (
    fieldKey === 'actorCharacterId' ||
    fieldKey === 'laneId' ||
    fieldKey === 'targetCharacterId'
  ) {
    return resolveCharacterName(value);
  }
  if (fieldKey === 'change') {
    return formatSignedNumber(value);
  }
  return String(value);
}

export function formatWorkbenchActionEditSourceChangeSummary(
  previousValue,
  nextValue
) {
  if (!previousValue && !nextValue) {
    return '';
  }
  if (previousValue === nextValue) {
    return previousValue;
  }
  return `${previousValue || '空'} -> ${nextValue || '空'}`;
}

function formatSignedNumber(value) {
  const number = Number(value) || 0;
  return `${number > 0 ? '+' : ''}${number}`;
}

function defaultValueNameResolver(value) {
  return String(value);
}
