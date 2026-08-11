import { sha256Canonical } from './formal-search-artifacts.mjs';

export const FIXED_CYCLE_REPLAY_SYNTHESIS_ID =
  'm12c-fixed-incumbent-cycle-replay-v1';

export function createFixedCycleReplayAxis({
  baseAxis,
  templateAxis,
  templateRawIdentityHash,
  templateAggregateHash,
  synthesisId = FIXED_CYCLE_REPLAY_SYNTHESIS_ID,
} = {}) {
  if (!baseAxis?.scenario || !Array.isArray(baseAxis.actions)) {
    throw new TypeError('baseAxis must be a machine axis contract');
  }
  if (!templateAxis?.scenario || !Array.isArray(templateAxis.actions)) {
    throw new TypeError('templateAxis must be a machine axis contract');
  }
  if (templateAxis.actions.length === 0) {
    throw new TypeError('templateAxis must contain actions');
  }
  const durationFrames = Number(baseAxis.scenario.durationFrames);
  if (!(durationFrames > 0)) {
    throw new TypeError('baseAxis durationFrames must be positive');
  }
  const actionIds = new Set();
  let priorFrame = -1;
  for (const action of templateAxis.actions) {
    validateReplayAction(action, { durationFrames, actionIds, priorFrame });
    priorFrame = Number(action.schedule.frame);
    actionIds.add(String(action.id));
  }
  const provenance = {
    synthesisId: String(synthesisId),
    templateRawIdentityHash: String(templateRawIdentityHash ?? ''),
    templateAggregateHash: String(templateAggregateHash ?? ''),
    templateActionHash: sha256Canonical(templateAxis.actions),
    semanticEquivalenceClaimed: false,
    admissibleBoundClaimed: false,
  };
  return {
    ...structuredClone(baseAxis),
    scenario: {
      ...structuredClone(baseAxis.scenario),
      name: `${baseAxis.scenario.name} + ${provenance.synthesisId}`,
    },
    actions: structuredClone(templateAxis.actions),
    metadata: {
      ...structuredClone(baseAxis.metadata ?? {}),
      formalCycleReplay: provenance,
    },
  };
}

export function createFixedCycleReplayCandidate({
  axis,
  simulation,
  proof,
  validation,
  build,
  pool,
  sourceConfig,
  initialFront,
} = {}) {
  const issues = [];
  if (proof?.valid !== true || proof?.status !== 'closed') {
    issues.push('cycle-proof-not-closed');
  }
  if (!Number.isFinite(Number(proof?.formalScore))) {
    issues.push('cycle-formal-score-missing');
  }
  if (proof?.actionLegalityProof?.passed !== true) {
    issues.push('cycle-replay-legality-proof-failed');
  }
  if (
    validation?.valid !== true ||
    validation?.actionLegalityProof?.passed !== true
  ) {
    issues.push('cycle-axis-validation-failed');
  }
  if (issues.length > 0) {
    throw new TypeError(`Fixed cycle replay is invalid: ${issues.join(',')}`);
  }
  const horizon = Number(axis.scenario.durationFrames);
  return {
    score: Number(proof.formalScore),
    scoreDirection: 'maximize',
    finalScoreEligible: true,
    objectiveProof: proof,
    objectiveIssues: [],
    legality: {
      valid: true,
      issues: validation.issues ?? [],
      warnings: validation.warnings ?? [],
      classification: validation.classification ?? null,
      invalidActionCount: 0,
      proof: validation.actionLegalityProof,
    },
    metrics: structuredClone(proof.metrics ?? {}),
    contributions: structuredClone(proof.contributions ?? null),
    criticalPolicy: {
      policy: axis.scenario.critical?.policy ?? null,
      seed: axis.scenario.critical?.seed ?? null,
    },
    boundariesConsumed: [
      {
        frame: horizon,
        resumeFrame: horizon,
        timeMs: (horizon / Number(axis.scenario.fps ?? 60)) * 1000,
        kind: 'horizon',
        description: `scenario horizon at frame ${horizon}`,
      },
    ],
    coverageTrust: {
      rankingClaim: 'AI-guided heuristic Top-N',
      formalRankingReady: false,
      fullPoolEnumerationComplete: false,
      replayedAndEvaluatedPerBuild: true,
    },
    heuristic: {
      strategy: FIXED_CYCLE_REPLAY_SYNTHESIS_ID,
      finalScore: false,
      purpose: 'incumbent-propagation-and-independent-family-evaluation',
      semanticEquivalenceClaimed: false,
      admissibleBoundClaimed: false,
    },
    causalExplanation: {
      actionSequence: axis.actions.map(action => ({
        actionId: action.id,
        label: action.intent?.actionKind ?? action.intent?.kind ?? null,
        frame: action.schedule?.frame ?? null,
        source: 'prior-round-incumbent-replay',
      })),
      note:
        'The prior-round incumbent action schedule was bound and evaluated independently against this raw build identity; no semantic equivalence or admissible bound is claimed.',
    },
    sampling: null,
    hashes: simulation.hashes,
    axis,
    team: {
      teamIdentity: build.teamIdentity,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      actors: build.actors,
    },
    m12c: {
      buildHash: build.buildHash,
      poolHash: pool.poolHash,
      teamIdentity: build.teamIdentity,
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      initialFront,
      fixedCultivationProfile: pool.fixedCultivationProfile ?? null,
      build,
    },
  };
}

function validateReplayAction(action, {
  durationFrames,
  actionIds,
  priorFrame,
}) {
  if (!action?.id || actionIds.has(String(action.id))) {
    throw new TypeError('template action ids must be unique and non-empty');
  }
  const frame = Number(action.schedule?.frame);
  if (!Number.isInteger(frame) || frame < 0 || frame > durationFrames) {
    throw new TypeError(`template action ${action.id} has invalid frame`);
  }
  if (frame < priorFrame) {
    throw new TypeError('template actions must be frame-ordered');
  }
  if (action.intent?.kind === 'wait') {
    if (action.owner?.kind !== 'system') {
      throw new TypeError('wait actions must be system-owned');
    }
    return;
  }
  if (
    action.intent?.kind !== 'public-action' ||
    !['normal-attack', 'star-skill'].includes(action.intent?.actionKind) ||
    action.owner?.kind !== 'actor' ||
    action.owner?.slotId !== 'm12c-slot:112001'
  ) {
    throw new TypeError(
      `template action ${action.id} is outside the frozen Hero normal/star surface`
    );
  }
}
