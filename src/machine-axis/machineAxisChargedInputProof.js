import {
  createVerifiedChargedPhysicalInputContract,
  createVerifiedChargedInputScheduling,
  getConservativeChargedInputDelayFrames,
  resolveVerifiedChargedInputAuthority,
} from '../domain/verifiedChargedInputAuthority';
import {
  getInstalledVerifiedCombatMechanicsPackage,
  getVerifiedCombatActionMapping,
} from '../data/verifiedCombatMechanicsPackage';
import { ACTION_TYPES } from '../domain/projectSchema';

const MACHINE_AXIS_CHARGED_INPUT_PROOF_SCHEMA_VERSION = 1;
const MACHINE_AXIS_CHARGED_INPUT_PROOF_CONTRACT =
  'AzPrMachineAxisChargedInputProof';

export function createMachineAxisChargedInputProof(contract = {}) {
  const frameRate = Number(contract?.scenario?.fps) || 60;
  const slotById = new Map(
    (contract?.scenario?.team ?? []).map(slot => [String(slot.slotId), slot])
  );
  const issues = [];
  const schedules = [];
  const inputsBySlot = new Map();
  for (const action of contract?.actions ?? []) {
    const intent = action?.intent;
    if (action?.owner?.kind !== 'actor') continue;
    if (!['public-action', 'switch'].includes(intent?.kind)) continue;
    const slotId = String(action.owner.slotId ?? '');
    const executionFrame = nonNegativeInteger(action?.schedule?.frame);
    if (executionFrame == null || action?.schedule?.mode !== 'absolute') {
      if (intent?.actionKind === 'charged-attack') {
        issues.push(
          issue(
            'charged-input-absolute-execution-frame-required',
            action,
            'Charged input proof requires an absolute execution frame'
          )
        );
      }
      continue;
    }
    const rows = inputsBySlot.get(slotId) ?? [];
    rows.push({ action, executionFrame });
    inputsBySlot.set(slotId, rows);
  }

  for (const [slotId, rows] of inputsBySlot) {
    rows.sort(
      (left, right) =>
        left.executionFrame - right.executionFrame ||
        String(left.action.id).localeCompare(String(right.action.id), 'en')
    );
    let previousInput = null;
    for (const row of rows) {
      const action = row.action;
      const intent = action?.intent;
      if (intent?.actionKind !== 'charged-attack') {
        previousInput = row;
        continue;
      }
      const slot = slotById.get(slotId);
      const { mapping, authority } = resolveChargedActionAuthority({
        action,
        slot,
      });
      if (!authority || authority.applied !== true) {
        issues.push(
          issue(
            authority
              ? 'charged-input-authority-unresolved'
              : 'charged-input-authority-missing',
            action,
            `Charged input authority is not ready for ${slot?.characterId ?? slotId}`,
            {
              ownerId: slot?.characterId ?? null,
              reasons: authority?.reasons ?? [],
              sourceIdentity: authority?.sourceIdentity ?? null,
            }
          )
        );
        previousInput = row;
        continue;
      }
      const currentRelease = resolveCompositeChargingReleaseFrame({
        action,
        executionFrame: row.executionFrame,
        authority,
      });
      const previousBoundary = previousInput
        ? resolvePreviousInputBoundary({
            row: previousInput,
            slot,
          })
        : null;
      const earliestPressFrame = previousBoundary
        ? previousBoundary.releaseFrame + 1
        : 0;
      const derived = createVerifiedChargedInputScheduling({
        executionFrame: row.executionFrame,
        earliestPressFrame,
        frameRate,
      });
      const declared = intent.physicalInput ?? null;
      const schedule = declared
        ? {
            ...derived,
            pressFrame: nonNegativeInteger(declared.pressFrame),
            releaseFrame:
              declared.releaseFrame == null
                ? null
                : nonNegativeInteger(declared.releaseFrame),
            executionFrame: nonNegativeInteger(declared.executionFrame),
            schedulingSource: 'machine-axis-explicit-physical-input',
          }
        : {
            ...derived,
            releaseFrame: previousBoundary?.releaseFrame ?? null,
            schedulingSource: 'canonical-derived-prehold',
          };
      const requiredHoldFrames =
        getConservativeChargedInputDelayFrames(frameRate);
      const declaredHeldFrames =
        schedule.pressFrame == null || schedule.executionFrame == null
          ? null
          : schedule.executionFrame - schedule.pressFrame;
      const invalidReasons = [];
      if (currentRelease.reason) {
        invalidReasons.push(currentRelease.reason);
      }
      if (previousBoundary?.reason) {
        invalidReasons.push(previousBoundary.reason);
      }
      if (schedule.executionFrame !== row.executionFrame) {
        invalidReasons.push('charged-input-execution-frame-mismatch');
      }
      if (
        schedule.pressFrame == null ||
        schedule.pressFrame < earliestPressFrame ||
        declaredHeldFrames == null ||
        declaredHeldFrames < requiredHoldFrames
      ) {
        invalidReasons.push('charged-input-threshold-not-reached');
      }
      if (
        previousBoundary &&
        (schedule.releaseFrame == null ||
          schedule.releaseFrame < previousBoundary.releaseFrame ||
          schedule.pressFrame <= schedule.releaseFrame)
      ) {
        invalidReasons.push('charged-input-release-repress-required');
      }
      if (
        previousBoundary?.gateFrame != null &&
        row.executionFrame < previousBoundary.gateFrame
      ) {
        invalidReasons.push('charged-input-previous-reopen-not-reached');
      }
      schedules.push({
        actionId: action.id,
        slotId,
        ownerId: slot?.characterId ?? null,
        controlSkillId: mapping?.controlSkillId ?? null,
        authorityHash: authority.authorityHash,
        staticReopenFrame: authority.staticReopenFrame,
        nextSameActionFrameInterval: authority.nextSameActionFrameInterval,
        chargingReleaseFrame: currentRelease.absoluteFrame,
        chargingReleaseInputFrame: currentRelease.inputFrame,
        previousInputReleaseFrame: previousBoundary?.releaseFrame ?? null,
        previousInputGateFrame: previousBoundary?.gateFrame ?? null,
        requiredHoldFrames,
        ...schedule,
        valid: invalidReasons.length === 0,
        reasons: invalidReasons,
      });
      for (const reason of invalidReasons) {
        issues.push(
          issue(
            reason,
            action,
            `Charged input schedule is invalid: ${reason}`,
            {
              ownerId: slot?.characterId ?? null,
              absoluteFrame: row.executionFrame,
              requiredValue: requiredHoldFrames,
              currentValue: declaredHeldFrames,
              sourceIdentity: authority.sourceIdentity,
            }
          )
        );
      }
      previousInput = row;
    }
  }

  return Object.freeze({
    schemaVersion: MACHINE_AXIS_CHARGED_INPUT_PROOF_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CHARGED_INPUT_PROOF_CONTRACT,
    status:
      issues.length === 0
        ? 'machine-axis-charged-input-proof-passed'
        : 'machine-axis-charged-input-proof-rejected',
    passed: issues.length === 0,
    finalScoreEligible: issues.length === 0,
    authorityHash:
      schedules[0]?.authorityHash ??
      createVerifiedChargedPhysicalInputContract({ frameRate }).authorityHash,
    measuredClientParity: false,
    clientParityReady: false,
    schedules,
    issues,
  });
}

function resolveChargedActionAuthority({ action, slot }) {
  const intent = action?.intent;
  const packageMapping = (
    getInstalledVerifiedCombatMechanicsPackage()?.actionMappings ?? []
  ).find(
    candidate =>
      Number(candidate.ownerId) === Number(slot?.characterId) &&
      Number(candidate.sourceSkillId) === Number(intent?.publicActionId) &&
      candidate.actionKind === 'charged-attack'
  );
  const mapping =
    packageMapping ??
    getVerifiedCombatActionMapping({
      type: ACTION_TYPES.SKILL,
      skillId: intent?.publicActionId,
      actionKind: 'charged-attack',
      actionVariantIndex: intent?.semanticVariant?.publicVariantIndex,
      actor: { characterId: slot?.characterId },
    });
  return {
    mapping,
    authority: resolveVerifiedChargedInputAuthority({
      ownerId: slot?.characterId,
      controlSkillId: mapping?.controlSkillId,
    }),
  };
}

function resolveCompositeChargingReleaseFrame({
  action,
  executionFrame,
  authority,
}) {
  const composite = authority?.compositeChargingRelease;
  if (!composite) return chargingRelease();
  const semanticVariant = action?.intent?.semanticVariant;
  const inputFrame = nonNegativeInteger(semanticVariant?.inputFrame);
  const [startFrame, endFrame] = composite.sourceWrapperFrameDomain ?? [];
  if (semanticVariant?.mode !== 'release' || inputFrame == null) {
    return chargingRelease(
      inputFrame,
      null,
      'charged-input-release-frame-required'
    );
  }
  if (inputFrame < Number(startFrame) || inputFrame >= Number(endFrame)) {
    return chargingRelease(
      inputFrame,
      null,
      'charged-input-release-frame-out-of-domain'
    );
  }
  return chargingRelease(inputFrame, Number(executionFrame) + inputFrame);
}

function chargingRelease(
  inputFrame = null,
  absoluteFrame = null,
  reason = null
) {
  return {
    inputFrame,
    absoluteFrame,
    reason,
  };
}

function resolvePreviousInputBoundary({ row, slot }) {
  const defaultBoundary = {
    releaseFrame: row.executionFrame + 1,
    gateFrame: null,
    reason: null,
  };
  if (row.action?.intent?.actionKind !== 'charged-attack') {
    return defaultBoundary;
  }
  const { authority } = resolveChargedActionAuthority({
    action: row.action,
    slot,
  });
  if (!authority || authority.applied !== true) {
    return {
      ...defaultBoundary,
      reason: 'charged-input-previous-authority-unresolved',
    };
  }
  const compositeRelease = resolveCompositeChargingReleaseFrame({
    action: row.action,
    executionFrame: row.executionFrame,
    authority,
  });
  if (compositeRelease.reason) {
    return {
      ...defaultBoundary,
      reason: 'charged-input-previous-release-frame-unresolved',
    };
  }
  if (compositeRelease.absoluteFrame != null) {
    return {
      releaseFrame: compositeRelease.absoluteFrame,
      gateFrame:
        compositeRelease.absoluteFrame + Number(authority.staticReopenFrame),
      reason: null,
    };
  }
  return {
    ...defaultBoundary,
    gateFrame: row.executionFrame + Number(authority.staticReopenFrame),
  };
}

function issue(code, action, message, details = {}) {
  return {
    severity: 'error',
    status: 'violated',
    finalScoreEligible: false,
    code,
    path: `actions.${String(action?.id ?? 'unknown')}.intent.physicalInput`,
    message,
    actionId: action?.id ?? null,
    actionIds: [action?.id].filter(Boolean),
    sourceKind: 'verified-charged-physical-input',
    ...details,
  };
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}
