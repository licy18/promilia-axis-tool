import { sha256Utf8 } from './headlessAssumptionContract.js';
import { stableStringify } from '../simulation/headless/canonicalSerialization.js';
import {
  VERIFIED_CHARGED_INPUT_AUTHORITY_PAYLOAD,
  createVerifiedChargedInputAuthoritySourceIdentity,
} from '../data/verifiedChargedInputAuthorityData.js';

const VERIFIED_CHARGED_INPUT_AUTHORITY_SCHEMA_VERSION = 1;

const AUTHORITY_PAYLOAD = VERIFIED_CHARGED_INPUT_AUTHORITY_PAYLOAD;
const PHYSICAL_INPUT = AUTHORITY_PAYLOAD.physicalInput;
const ACTIONS = AUTHORITY_PAYLOAD.actions;

const authorityHash = sha256Utf8(stableStringify(AUTHORITY_PAYLOAD));

export function getVerifiedChargedInputAuthorityDescriptor() {
  return Object.freeze({
    ...structuredClone(AUTHORITY_PAYLOAD),
    authorityHash,
  });
}

export function resolveVerifiedChargedInputAuthority({
  ownerId,
  controlSkillId,
} = {}) {
  const row = ACTIONS.find(
    candidate =>
      Number(candidate.ownerId) === Number(ownerId) &&
      Number(candidate.controlSkillId) === Number(controlSkillId)
  );
  return row
    ? Object.freeze({
        ...structuredClone(row),
        authorityHash,
        physicalInput: createVerifiedChargedPhysicalInputContract(),
      })
    : null;
}

export function createVerifiedChargedPhysicalInputContract({
  frameRate = 60,
} = {}) {
  const fps = positiveNumber(frameRate) ?? 60;
  const exactThresholdFrames = (PHYSICAL_INPUT.thresholdMs * fps) / 1000;
  return Object.freeze({
    schemaVersion: VERIFIED_CHARGED_INPUT_AUTHORITY_SCHEMA_VERSION,
    contractName: 'AzPrVerifiedChargedPhysicalInput',
    kind: 'azpr-verified-charged-physical-input',
    ...structuredClone(PHYSICAL_INPUT),
    frameRate: fps,
    nominalThresholdFrameInterval: Object.freeze([
      Math.max(0, Math.floor(exactThresholdFrames) - 1),
      Math.ceil(exactThresholdFrames + 1),
    ]),
    authorityHash,
    sourceIdentity:
      createVerifiedChargedInputAuthoritySourceIdentity('physical-input'),
    status: 'verified-charged-physical-input-static-ready',
    applied: true,
  });
}

export function createVerifiedChargedInputScheduling({
  executionFrame,
  earliestPressFrame = 0,
  frameRate = 60,
} = {}) {
  const physicalInput = createVerifiedChargedPhysicalInputContract({
    frameRate,
  });
  const normalizedExecutionFrame = nonNegativeInteger(executionFrame);
  const normalizedEarliestPressFrame = nonNegativeInteger(earliestPressFrame);
  if (
    normalizedExecutionFrame == null ||
    normalizedEarliestPressFrame == null
  ) {
    return Object.freeze({
      status: 'verified-charged-input-scheduling-invalid',
      ready: false,
      applied: false,
      reasons: ['charged-input-frame-invalid'],
      physicalInput,
    });
  }
  const latestThresholdFrames = physicalInput.nominalThresholdFrameInterval[1];
  const pressFrame = Math.max(
    normalizedEarliestPressFrame,
    normalizedExecutionFrame - latestThresholdFrames
  );
  const heldFrames = normalizedExecutionFrame - pressFrame;
  const ready = heldFrames >= latestThresholdFrames;
  return Object.freeze({
    schemaVersion: VERIFIED_CHARGED_INPUT_AUTHORITY_SCHEMA_VERSION,
    contractName: 'AzPrVerifiedChargedInputScheduling',
    status: ready
      ? 'verified-charged-input-scheduling-ready'
      : 'verified-charged-input-threshold-not-reached',
    ready,
    applied: ready,
    pressFrame,
    executionFrame: normalizedExecutionFrame,
    heldFrames,
    earliestPressFrame: normalizedEarliestPressFrame,
    preheld: pressFrame < normalizedExecutionFrame,
    releaseRequiredBeforePress: normalizedEarliestPressFrame > 0,
    physicalInput,
    reasons: ready ? [] : ['charged-input-threshold-not-reached'],
  });
}

export function getConservativeChargedInputDelayFrames(frameRate = 60) {
  return createVerifiedChargedPhysicalInputContract({ frameRate })
    .nominalThresholdFrameInterval[1];
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
