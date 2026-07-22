import { frameToMs, msToFrame } from './timebase';

export const WORKBENCH_UNRESOLVED_ACTION_PLANNING_FRAMES = 30;

export const WORKBENCH_ACTION_SCHEDULING_KINDS = Object.freeze({
  EXACT_SELECTED_VARIANT: 'exact-selected-variant-occupancy',
  VERIFIED_ANIMATION_PLANNING: 'source-animation-planning-duration',
  GENERIC_PLANNING: 'generic-planning-duration',
});

export const WORKBENCH_ACTION_VARIANT_MODEL_STATUSES = Object.freeze({
  RESOLVED: 'resolved',
  PARTIALLY_RESOLVED: 'partially-resolved',
  NOT_YET_MODELED: 'variant-condition-not-yet-modeled',
  STATIC_EVIDENCE_GAP: 'static-evidence-gap',
  RUNTIME_DEPENDENT: 'runtime-dependent',
  UNRESOLVED_CONTROL_IDENTITY: 'unresolved-control-identity',
});

export function normalizeWorkbenchActionSchedulingContract(value = null) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const status = value.status === 'exact' ? 'exact' : 'planning';
  const kind = Object.values(WORKBENCH_ACTION_SCHEDULING_KINDS).includes(
    value.kind
  )
    ? value.kind
    : status === 'exact'
      ? WORKBENCH_ACTION_SCHEDULING_KINDS.EXACT_SELECTED_VARIANT
      : WORKBENCH_ACTION_SCHEDULING_KINDS.GENERIC_PLANNING;
  const durationFrames = positiveIntegerOrNull(value.durationFrames);
  const planningDurationFrames = positiveIntegerOrNull(
    value.planningDurationFrames ?? value.durationFrames
  );
  if (status === 'exact' && durationFrames == null) return null;
  if (status === 'planning' && planningDurationFrames == null) return null;
  return {
    status,
    kind,
    durationFrames: status === 'exact' ? durationFrames : null,
    planningDurationFrames:
      status === 'planning' ? planningDurationFrames : null,
    selectedSubSkillIndex:
      nonNegativeIntegerOrNull(value.selectedSubSkillIndex) ?? null,
    sourceIdentity: textOrNull(value.sourceIdentity),
    sourceStatus: textOrNull(value.sourceStatus),
    variantModelStatus:
      textOrNull(value.variantModelStatus) ??
      (status === 'exact'
        ? WORKBENCH_ACTION_VARIANT_MODEL_STATUSES.RESOLVED
        : kind === WORKBENCH_ACTION_SCHEDULING_KINDS.VERIFIED_ANIMATION_PLANNING
          ? WORKBENCH_ACTION_VARIANT_MODEL_STATUSES.STATIC_EVIDENCE_GAP
          : WORKBENCH_ACTION_VARIANT_MODEL_STATUSES.UNRESOLVED_CONTROL_IDENTITY),
    reasons: normalizeTextArray(value.reasons),
  };
}

export function resolveWorkbenchActionScheduling(source = {}) {
  const contract = normalizeWorkbenchActionSchedulingContract(
    source.scheduling ?? source.actionScheduling
  );
  const durationFrames = positiveIntegerOrNull(
    contract?.durationFrames ?? source.durationFrames
  );
  const durationMs = positiveNumberOrNull(source.durationMs);
  if (
    (contract?.status === 'exact' || source.timingStatus === 'applied') &&
    (durationFrames != null || durationMs != null)
  ) {
    const verifiedFrames = durationFrames ?? Math.max(1, msToFrame(durationMs));
    return {
      status: 'verified',
      kind:
        contract?.kind ??
        WORKBENCH_ACTION_SCHEDULING_KINDS.EXACT_SELECTED_VARIANT,
      durationFrames: verifiedFrames,
      durationMs: durationMs ?? frameToMs(verifiedFrames),
      sourceIdentity:
        contract?.sourceIdentity ?? source.timingSourceIdentity ?? null,
      selectedSubSkillIndex:
        nonNegativeIntegerOrNull(contract?.selectedSubSkillIndex) ?? null,
      variantModelStatus: contract?.variantModelStatus ?? 'resolved',
      needsTimingData: false,
      reasons: contract?.reasons ?? [],
    };
  }

  const planningFrames =
    positiveIntegerOrNull(
      contract?.planningDurationFrames ??
        contract?.durationFrames ??
        source.planningDurationFrames
    ) ?? WORKBENCH_UNRESOLVED_ACTION_PLANNING_FRAMES;
  const hasSourceDuration = Boolean(
    contract?.kind ===
      WORKBENCH_ACTION_SCHEDULING_KINDS.VERIFIED_ANIMATION_PLANNING ||
    source.planningSource === 'verified-animation-duration'
  );
  return {
    status: 'planning',
    kind: hasSourceDuration
      ? WORKBENCH_ACTION_SCHEDULING_KINDS.VERIFIED_ANIMATION_PLANNING
      : WORKBENCH_ACTION_SCHEDULING_KINDS.GENERIC_PLANNING,
    durationFrames: null,
    durationMs: frameToMs(planningFrames),
    planningDurationFrames: planningFrames,
    sourceIdentity:
      contract?.sourceIdentity ?? source.timingSourceIdentity ?? null,
    selectedSubSkillIndex:
      nonNegativeIntegerOrNull(contract?.selectedSubSkillIndex) ?? null,
    variantModelStatus:
      contract?.variantModelStatus ??
      (hasSourceDuration
        ? 'static-evidence-gap'
        : 'unresolved-control-identity'),
    needsTimingData: true,
    reasons: contract?.reasons ?? [],
  };
}

function normalizeTextArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(textOrNull).filter(Boolean))]
    : [];
}

function textOrNull(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
