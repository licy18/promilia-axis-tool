export const GREEDY_NORMAL_SYNTHESIS_ID =
  'azpr-m12c-greedy-normal-axis-synthesis-retired-v2';

export const GREEDY_NORMAL_RETIREMENT_CODE =
  'm12c-greedy-normal-cadence-retired-combo-authority-required';

export function deriveGreedyNormalCadence(firstAction, secondAction) {
  void firstAction;
  void secondAction;
  throw retiredGreedyNormalError();
}

export function synthesizeGreedyNormalAxis({
  baseAxis,
  cadence,
  actionCount,
} = {}) {
  void baseAxis;
  void cadence;
  void actionCount;
  throw retiredGreedyNormalError();
}

export function assertGreedyNormalSynthesisAvailable() {
  throw retiredGreedyNormalError();
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

function retiredGreedyNormalError() {
  const error = new Error(
    `${GREEDY_NORMAL_RETIREMENT_CODE}: fixed-cadence normal synthesis cannot represent verified successor, recovery, reopen, or special-continuation phases; start a new run with the canonical search generator`
  );
  error.code = GREEDY_NORMAL_RETIREMENT_CODE;
  return error;
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
