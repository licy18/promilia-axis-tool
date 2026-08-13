import { sha256Utf8 } from './headlessAssumptionContract.js';
import { stableStringify } from '../simulation/headless/canonicalSerialization.js';
import { VERIFIED_CHARGED_INPUT_AUTHORITY_PAYLOAD } from '../data/verifiedChargedInputAuthorityData.js';

export const VERIFIED_CHARGED_INPUT_AUTHORITY_SCHEMA_VERSION = 1;
export const VERIFIED_CHARGED_INPUT_AUTHORITY_CONTRACT =
  'AzPrVerifiedChargedInputAuthority';
export const VERIFIED_CHARGED_INPUT_AUTHORITY_KIND =
  'azpr-verified-charged-input-authority';

const AUTHORITY_PAYLOAD = VERIFIED_CHARGED_INPUT_AUTHORITY_PAYLOAD;
const CLIENT_IDENTITY = AUTHORITY_PAYLOAD.clientIdentity;
const AUDIT_IDENTITY = AUTHORITY_PAYLOAD.auditIdentity;
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
    sourceIdentity: createAuthoritySourceIdentity('physical-input'),
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

function createAuthoritySourceIdentity(suffix) {
  return [
    `installed-client:GameAssembly.dll#sha256=${CLIENT_IDENTITY.gameAssemblySha256}`,
    `charged-timing-matrix#sha256=${AUDIT_IDENTITY.chargedTimingMatrixSha256}`,
    `binary-input-state-machine#sha256=${AUDIT_IDENTITY.binaryInputStateMachineSha256}`,
    `giselle-heavy23-timing-matrix#sha256=${AUDIT_IDENTITY.giselleTimingMatrixSha256}`,
    `miti-charged-release-timing-matrix#sha256=${AUDIT_IDENTITY.mitiTimingMatrixSha256}`,
    `miti-charged-release-binary-logic#sha256=${AUDIT_IDENTITY.mitiBinaryReleaseLogicSha256}`,
    suffix,
  ].join('|');
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
