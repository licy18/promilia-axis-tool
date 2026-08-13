export const VERIFIED_CHARGING_RELEASE_SELECTION_CONTRACT =
  'AzPrVerifiedChargingReleaseSelection';

/**
 * Resolves a release frame against right-open charging windows.
 *
 * Installed-client evidence supports two explicit precedence contracts:
 * `greatest-start-frame` for the legacy product assumption and
 * `source-order-first` for controls whose event registration/dispatch order
 * is proven. Unknown precedence modes fail closed.
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
  if (!['greatest-start-frame', 'source-order-first'].includes(precedence)) {
    return createUnresolved(
      'charging-release-precedence-unsupported',
      frame,
      []
    );
  }

  const candidates = (windows ?? [])
    .map((window, sourceOrderIndex) => ({ window, sourceOrderIndex }))
    .filter(entry => isValidWindow(entry.window))
    .filter(
      entry =>
        frame >= Number(entry.window.startFrame) &&
        frame < Number(entry.window.endFrame)
    );
  if (candidates.length === 0) {
    return createUnresolved('charging-release-window-missing', frame, []);
  }

  if (precedence === 'source-order-first') {
    const selectedEntry = candidates[0];
    const selected = selectedEntry.window;
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
        candidate => candidate.window.windowIdentity ?? null
      ),
      overlappingCandidateCount: candidates.length,
      sourceOrderIndex: selectedEntry.sourceOrderIndex,
      greatestStartFrame: null,
      tieBreak: 'client-proven-source-registration-order',
    };
  }

  const sortedCandidates = candidates
    .map(entry => entry.window)
    .sort(compareChargingWindows);

  const greatestStartFrame = Math.max(
    ...sortedCandidates.map(window => Number(window.startFrame))
  );
  const greatestCandidates = sortedCandidates.filter(
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
    candidateWindowIdentities: sortedCandidates.map(
      candidate => candidate.windowIdentity ?? null
    ),
    overlappingCandidateCount: sortedCandidates.length,
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
