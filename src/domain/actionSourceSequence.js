export const ACTION_SOURCE_SEQUENCE_CONTRACT_NAME =
  'AzPrActionSourceSequence';

export function attachActionSourceSequence(
  action,
  sourceSequenceIndex,
  sourceKind = 'source-action-array-order'
) {
  const existingPath = normalizeSourceSequencePath(action?.sourceSequencePath);
  const rootIndex = nonNegativeIntegerOrNull(
    existingPath?.[0] ?? action?.sourceSequenceIndex ?? sourceSequenceIndex
  );
  const sourceSequencePath =
    existingPath ??
    (rootIndex == null ? null : [rootIndex]);
  if (!action || rootIndex == null || !sourceSequencePath) return action;
  return {
    ...action,
    sourceSequenceIndex: rootIndex,
    sourceSequencePath,
    sourceSequenceSource:
      action.sourceSequenceSource ?? sourceKind,
  };
}

export function attachDerivedActionSourceSequence(
  action,
  parentAction,
  localSequenceIndex,
  sourceKind = 'derived-parent-local-order'
) {
  const parentPath = getActionSourceSequencePath(parentAction);
  const localIndex = nonNegativeIntegerOrNull(localSequenceIndex);
  if (!action || !parentPath || localIndex == null) return action;
  return {
    ...action,
    sourceSequenceIndex: parentPath[0],
    sourceSequencePath: [...parentPath, localIndex],
    sourceSequenceSource: sourceKind,
    parentSourceSequencePath: [...parentPath],
    localSourceSequenceIndex: localIndex,
  };
}

export function getActionSourceSequencePath(action, fallbackIndex = null) {
  const path = normalizeSourceSequencePath(action?.sourceSequencePath);
  if (path) return path;
  const rootIndex = nonNegativeIntegerOrNull(
    action?.sourceSequenceIndex ?? fallbackIndex
  );
  return rootIndex == null ? null : [rootIndex];
}

export function compareActionSourceSequence(
  left,
  right,
  leftFallbackIndex = null,
  rightFallbackIndex = null
) {
  return compareSourceSequencePaths(
    getActionSourceSequencePath(left, leftFallbackIndex),
    getActionSourceSequencePath(right, rightFallbackIndex)
  );
}

export function compareSourceSequencePaths(left, right) {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

function normalizeSourceSequencePath(value) {
  if (!Array.isArray(value) || value.length === 0) return null;
  const normalized = value.map(nonNegativeIntegerOrNull);
  return normalized.every(item => item != null) ? normalized : null;
}

function nonNegativeIntegerOrNull(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
