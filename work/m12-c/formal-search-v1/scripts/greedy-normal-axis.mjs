import { sha256Canonical } from './formal-search-artifacts.mjs';

export const GREEDY_NORMAL_SYNTHESIS_ID =
  'azpr-m12c-greedy-normal-axis-synthesis-v1';

export function deriveGreedyNormalCadence(firstAction, secondAction) {
  const first = normalizeNormalAction(firstAction, 1);
  const second = normalizeNormalAction(secondAction, 2);
  const cadenceFrames = second.startFrame - first.startFrame;
  if (!Number.isInteger(cadenceFrames) || cadenceFrames <= 0) {
    throw new Error('Greedy normal cadence must advance by positive frames');
  }
  if (
    first.ownerKind !== second.ownerKind ||
    first.slotId !== second.slotId ||
    first.publicActionId !== second.publicActionId ||
    first.actionKind !== second.actionKind ||
    first.level !== second.level ||
    first.sequenceIndex !== 1 ||
    second.sequenceIndex !== 1
  ) {
    throw new Error('Greedy normal cadence actions are not a stable A1 surface');
  }
  const firstGroup = splitOrdinalSuffix(first.groupId);
  const secondGroup = splitOrdinalSuffix(second.groupId);
  if (
    firstGroup.ordinal !== 1 ||
    secondGroup.ordinal !== 2 ||
    firstGroup.prefix !== secondGroup.prefix
  ) {
    throw new Error('Greedy normal group identity is not ordinal-stable');
  }
  const payload = {
    synthesisId: GREEDY_NORMAL_SYNTHESIS_ID,
    ownerKind: first.ownerKind,
    slotId: first.slotId,
    publicActionId: first.publicActionId,
    actionKind: first.actionKind,
    level: first.level,
    sequenceIndex: 1,
    groupPrefix: firstGroup.prefix,
    firstStartFrame: first.startFrame,
    cadenceFrames,
    firstAction,
    secondAction,
  };
  return {
    ...payload,
    cadenceHash: sha256Canonical(payload),
  };
}

export function synthesizeGreedyNormalAxis({
  baseAxis,
  cadence,
  actionCount,
} = {}) {
  if (!baseAxis || typeof baseAxis !== 'object') {
    throw new Error('Greedy normal synthesis requires a base axis');
  }
  const count = Number(actionCount);
  if (!Number.isInteger(count) || count < 1) {
    throw new Error('Greedy normal synthesis actionCount must be positive');
  }
  if (cadence?.synthesisId !== GREEDY_NORMAL_SYNTHESIS_ID) {
    throw new Error('Greedy normal synthesis cadence contract is invalid');
  }
  const actions = [];
  for (let ordinal = 1; ordinal <= count; ordinal += 1) {
    const template = structuredClone(
      ordinal === 1 ? cadence.firstAction : cadence.secondAction
    );
    template.id = `search-action-${ordinal}`;
    template.schedule = {
      ...(template.schedule ?? {}),
      mode: 'absolute',
      frame:
        Number(cadence.firstStartFrame) +
        (ordinal - 1) * Number(cadence.cadenceFrames),
      offsetFrames: 0,
    };
    template.intent = {
      ...(template.intent ?? {}),
      attackInput: {
        ...(template.intent?.attackInput ?? {}),
        sequenceIndex: 1,
        groupId: `${cadence.groupPrefix}|${ordinal}`,
      },
    };
    delete template.intent.attackInput.contextActionId;
    actions.push(template);
  }
  return {
    ...structuredClone(baseAxis),
    scenario: {
      ...(structuredClone(baseAxis.scenario) ?? {}),
      name: `${String(baseAxis.scenario?.name ?? 'M12-C')} [greedy-normal-v1:${count}]`,
    },
    actions,
  };
}

export function classifyGreedyKillProbe({ proof, error = null } = {}) {
  if (
    proof?.valid === true &&
    proof?.status === 'killed' &&
    proof?.killProof?.feasible === true &&
    proof.formalScore != null &&
    Number.isFinite(Number(proof.formalScore))
  ) {
    return {
      status: 'killed-valid',
      killed: true,
      valid: true,
      formalScore: Number(proof.formalScore),
      issueCodes: [],
    };
  }
  if (error != null || proof?.valid !== true) {
    return {
      status: 'invalid-upper-bound',
      killed: null,
      valid: false,
      formalScore: null,
      issueCodes: normalizeIssueCodes(error ?? proof?.issues ?? []),
    };
  }
  return {
    status: 'valid-not-killed',
    killed: false,
    valid: true,
    formalScore: null,
    issueCodes: [...new Set((proof?.issues ?? []).map(issueCode))]
      .filter(Boolean)
      .sort(compareText),
  };
}

function normalizeNormalAction(action, expectedOrdinal) {
  if (String(action?.id) !== `search-action-${expectedOrdinal}`) {
    throw new Error(
      `Greedy normal action ${expectedOrdinal} has unstable action id`
    );
  }
  if (
    action?.intent?.kind !== 'public-action' ||
    action?.intent?.actionKind !== 'normal-attack'
  ) {
    throw new Error('Greedy normal cadence requires Hero normal attacks');
  }
  return {
    ownerKind: String(action?.owner?.kind ?? ''),
    slotId: String(action?.owner?.slotId ?? ''),
    publicActionId: Number(action.intent.publicActionId),
    actionKind: String(action.intent.actionKind),
    level: Number(action.intent.level ?? 1),
    sequenceIndex: Number(action.intent.attackInput?.sequenceIndex),
    groupId: String(action.intent.attackInput?.groupId ?? ''),
    startFrame: Number(action.schedule?.frame),
  };
}

function splitOrdinalSuffix(value) {
  const match = /^(.*)\|(\d+)$/.exec(String(value));
  if (!match) throw new Error('Greedy normal group identity lacks ordinal');
  return { prefix: match[1], ordinal: Number(match[2]) };
}

function normalizeIssueCodes(error) {
  const issues = Array.isArray(error)
    ? error
    : Array.isArray(error?.issues)
      ? error.issues
      : [error];
  return [...new Set(issues.map(issueCode))].filter(Boolean).sort(compareText);
}

function issueCode(issue) {
  return String(issue?.code ?? issue?.message ?? issue ?? 'unknown');
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}
