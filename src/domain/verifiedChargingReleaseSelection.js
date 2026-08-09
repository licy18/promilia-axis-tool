export const VERIFIED_CHARGING_RELEASE_SELECTION_CONTRACT =
  'AzPrVerifiedChargingReleaseSelection';

/**
 * Resolves a release frame against right-open charging windows.
 *
 * The greatest startFrame wins when windows overlap. Source identity is only
 * a deterministic tie-break for semantically equivalent candidates; a tie
 * with different execution semantics is rejected instead of depending on
 * source array order.
 */
export function resolveVerifiedChargingReleaseWindow({
  windows = [],
  releaseFrame,
  precedence = 'greatest-start-frame',
} = {}) {
  const frame = Number(releaseFrame);
  if (!Number.isInteger(frame) || frame < 0) {
    return createUnresolved('charging-release-frame-invalid', frame, []);
  }
  if (precedence !== 'greatest-start-frame') {
    return createUnresolved(
      'charging-release-precedence-unsupported',
      frame,
      []
    );
  }

  const candidates = (windows ?? [])
    .filter(isValidWindow)
    .filter(
      window =>
        frame >= Number(window.startFrame) && frame < Number(window.endFrame)
    )
    .sort(compareChargingWindows);
  if (candidates.length === 0) {
    return createUnresolved('charging-release-window-missing', frame, []);
  }

  const greatestStartFrame = Math.max(
    ...candidates.map(window => Number(window.startFrame))
  );
  const greatestCandidates = candidates.filter(
    window => Number(window.startFrame) === greatestStartFrame
  );
  const semantics = new Set(
    greatestCandidates.map(createChargingWindowSemanticIdentity)
  );
  if (semantics.size !== 1) {
    return createUnresolved(
      'charging-release-same-threshold-semantic-conflict',
      frame,
      greatestCandidates
    );
  }

  const selected = [...greatestCandidates].sort((left, right) =>
    String(left.sourceIdentity ?? left.windowIdentity ?? '').localeCompare(
      String(right.sourceIdentity ?? right.windowIdentity ?? '')
    )
  )[0];
  return {
    schemaVersion: 1,
    contractName: VERIFIED_CHARGING_RELEASE_SELECTION_CONTRACT,
    status: 'verified-charging-release-window-selected',
    ready: true,
    applied: true,
    releaseFrame: frame,
    precedence,
    selected,
    selectedWindowIdentity: selected.windowIdentity ?? null,
    candidateWindowIdentities: candidates.map(
      candidate => candidate.windowIdentity ?? null
    ),
    overlappingCandidateCount: candidates.length,
    greatestStartFrame,
    tieBreak:
      greatestCandidates.length > 1
        ? 'stable-source-identity-equivalent-semantics'
        : 'not-required',
  };
}

export function createChargingWindowSemanticIdentity(window = {}) {
  return [
    Number(window.executionControlSkillId),
    Number(window.executionSubSkillIndex),
    String(window.semanticIdentity ?? ''),
  ].join('|');
}

function isValidWindow(window) {
  return (
    Number.isInteger(Number(window?.startFrame)) &&
    Number.isInteger(Number(window?.endFrame)) &&
    Number(window.startFrame) >= 0 &&
    Number(window.endFrame) > Number(window.startFrame) &&
    Number.isInteger(Number(window.executionControlSkillId)) &&
    Number.isInteger(Number(window.executionSubSkillIndex))
  );
}

function compareChargingWindows(left, right) {
  return (
    Number(left.startFrame) - Number(right.startFrame) ||
    Number(left.endFrame) - Number(right.endFrame) ||
    createChargingWindowSemanticIdentity(left).localeCompare(
      createChargingWindowSemanticIdentity(right)
    ) ||
    String(left.sourceIdentity ?? left.windowIdentity ?? '').localeCompare(
      String(right.sourceIdentity ?? right.windowIdentity ?? '')
    )
  );
}

function createUnresolved(reason, releaseFrame, candidates) {
  return {
    schemaVersion: 1,
    contractName: VERIFIED_CHARGING_RELEASE_SELECTION_CONTRACT,
    status: reason,
    ready: false,
    applied: false,
    releaseFrame,
    selected: null,
    selectedWindowIdentity: null,
    candidateWindowIdentities: candidates.map(
      candidate => candidate.windowIdentity ?? null
    ),
    reasons: [reason],
  };
}
