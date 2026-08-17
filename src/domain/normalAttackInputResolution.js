export const NORMAL_ATTACK_INPUT_RESOLUTION_SCHEMA_VERSION = 1;
export const NORMAL_ATTACK_INPUT_RESOLUTION_CONTRACT_NAME =
  'AzPrNormalAttackInputResolution';
export const NORMAL_ATTACK_INPUT_RESOLUTION_MODE =
  'verified-runtime-unique-form';

const NORMAL_ATTACK_INPUT_RESOLUTION_FIELDS = Object.freeze([
  'sequenceIndex',
  'controlSkillId',
  'subSkillIndex',
  'chainIdentity',
  'contextActionId',
  'groupId',
]);

/**
 * A public normal-attack action is a left-click input intent. Any displayed
 * A-index or chain/context identity is only an expectation; the verified
 * runtime authority chooses the one legal form for the current axis state.
 */
export function isRuntimeResolvedNormalAttackInput(action) {
  return (
    isRuntimeContextNormalAttackInput(action) &&
    action?.attackInputIntent?.normalFormResolution ===
      NORMAL_ATTACK_INPUT_RESOLUTION_MODE
  );
}

export function isRuntimeContextNormalAttackInput(action) {
  return (
    action?.attackInputIntent?.kind === 'public-normal-attack' &&
    action?.attackInputIntent?.selectionMode === 'runtime-context' &&
    action?.attackInputChainSelectionSource !== 'user-explicit'
  );
}

export function createNormalAttackInputDisplayExpectation({
  attackInput = null,
  mapping = null,
} = {}) {
  const requestedSequenceIndex = positiveIntegerOrNull(
    attackInput?.sequenceIndex
  );
  const requestedChainIdentity = textOrNull(attackInput?.chainIdentity);
  const segment = resolveDisplaySegment({
    mapping,
    sequenceIndex: requestedSequenceIndex,
    chainIdentity: requestedChainIdentity,
  });
  return {
    schemaVersion: NORMAL_ATTACK_INPUT_RESOLUTION_SCHEMA_VERSION,
    contractName: NORMAL_ATTACK_INPUT_RESOLUTION_CONTRACT_NAME,
    kind: 'normal-attack-left-click-display-expectation',
    sequenceIndex: requestedSequenceIndex,
    controlSkillId: positiveIntegerOrNull(segment?.controlSkillId),
    subSkillIndex: nonNegativeIntegerOrNull(
      segment?.subSkillIndex ?? segment?.selectedSubSkillIndex
    ),
    chainIdentity: requestedChainIdentity,
    contextActionId: textOrNull(attackInput?.contextActionId),
    groupId: textOrNull(attackInput?.groupId),
  };
}

export function createNormalAttackInputResolution({
  expectation = null,
  selection = null,
} = {}) {
  if (!expectation) return null;
  const actual = {
    sequenceIndex: positiveIntegerOrNull(
      selection?.attackChainSequenceIndex ?? selection?.attackSequenceIndex
    ),
    controlSkillId: positiveIntegerOrNull(
      selection?.executionControlSkillId ?? selection?.controlSkillId
    ),
    subSkillIndex: nonNegativeIntegerOrNull(selection?.selectedSubSkillIndex),
    chainIdentity: textOrNull(selection?.attackInputChainIdentity),
    contextActionId: textOrNull(selection?.contextActionId),
    groupId: textOrNull(selection?.attackGroupId),
    semanticName: textOrNull(selection?.semanticName),
    sourceKind: textOrNull(selection?.sourceKind),
    sourceIdentity: textOrNull(selection?.sourceIdentity),
  };
  const mismatchFields = NORMAL_ATTACK_INPUT_RESOLUTION_FIELDS.filter(field =>
    isDeclaredMismatch(expectation[field], actual[field])
  );
  const resolved =
    actual.sequenceIndex != null &&
    actual.controlSkillId != null &&
    actual.subSkillIndex != null;
  return {
    schemaVersion: NORMAL_ATTACK_INPUT_RESOLUTION_SCHEMA_VERSION,
    contractName: NORMAL_ATTACK_INPUT_RESOLUTION_CONTRACT_NAME,
    kind: 'normal-attack-left-click-resolution',
    status: !resolved
      ? 'unresolved'
      : mismatchFields.length > 0
        ? 'corrected'
        : 'matched',
    requested: { ...expectation },
    actual,
    mismatchFields,
  };
}

function resolveDisplaySegment({ mapping, sequenceIndex, chainIdentity }) {
  if (sequenceIndex == null) return null;
  const sourceSegments = [
    ...(mapping?.attackInputSegments ?? []),
    ...(mapping?.attackInputSourceSegments ?? []),
    ...(mapping?.profileAttackInputSegments ?? []),
  ];
  const matches = sourceSegments.filter(segment => {
    if (Number(segment?.sequenceIndex) !== sequenceIndex) return false;
    if (chainIdentity == null) {
      return (
        segment?.attackInputChainIdentity == null ||
        String(segment.attackInputChainIdentity) ===
          String(mapping?.attackInputChainIdentity ?? '')
      );
    }
    return (
      segment?.attackInputChainIdentity != null &&
      String(segment.attackInputChainIdentity) === chainIdentity
    );
  });
  const unique = [
    ...new Map(
      matches.map(segment => [
        [
          Number(segment.controlSkillId),
          Number(segment.subSkillIndex ?? segment.selectedSubSkillIndex ?? 0),
        ].join('|'),
        segment,
      ])
    ).values(),
  ];
  return unique.length === 1 ? unique[0] : null;
}

function isDeclaredMismatch(requested, actual) {
  if (requested == null) return false;
  return actual == null || String(requested) !== String(actual);
}

function positiveIntegerOrNull(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

function nonNegativeIntegerOrNull(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized >= 0 ? normalized : null;
}

function textOrNull(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
