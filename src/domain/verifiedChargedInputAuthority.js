import { sha256Utf8 } from './headlessAssumptionContract.js';
import { stableStringify } from '../simulation/headless/canonicalSerialization.js';

export const VERIFIED_CHARGED_INPUT_AUTHORITY_SCHEMA_VERSION = 1;
export const VERIFIED_CHARGED_INPUT_AUTHORITY_CONTRACT =
  'AzPrVerifiedChargedInputAuthority';
export const VERIFIED_CHARGED_INPUT_AUTHORITY_KIND =
  'azpr-verified-charged-input-authority';

const CLIENT_IDENTITY = Object.freeze({
  gameAssemblySha256:
    'C60D13795629F0851B1399338F375EB378AEF2098515D41841F30CCC3463C22B',
  globalMetadataSha256:
    'C8870E4AF8EEB3C03BE3238BD70064520C11C7ED7141CAD38ABDC7C03E49E17B',
  globalGameManagersSha256:
    '090119217E95997077EDED03A791B98BAED1FE903DBE9B32E180F4AB35A76B4B',
});

const AUDIT_IDENTITY = Object.freeze({
  chargedTimingMatrixSha256:
    '85167622A4E5B2A30240F77B4542DEFD0E90659FDE636D933B21FB5935CC4AD4',
  binaryInputStateMachineSha256:
    '3EA47B544AA82B80D3F4C52D610204F1CE392A2CF2774884C160630568C8547E',
  giselleTimingMatrixSha256:
    'D941951120941F3405F4DF32BA543722907BDCD5CB0E02B78D2E99D1ECA26ADA',
  mitiTimingMatrixSha256:
    'CA46430EA50BA3CA8F9A4722122414CFA63796B7312B88A53BE0B50CC66C014B',
  mitiBinaryReleaseLogicSha256:
    'E69739356703C51380951B64E4C41754041BA91D0A088CAD5C9D691BFF5110F7',
});

const PHYSICAL_INPUT = Object.freeze({
  triggerType: 1,
  triggerTypeName: 'Press',
  thresholdMs: 250,
  thresholdComparison: 'greater-than-or-equal',
  accumulation: 'delta-time-per-input-update',
  pressCallbackAttemptsCast: true,
  retryWhilePressedAfterFailedCast: true,
  clearPressedStateAfterSuccessfulCast: true,
  continuingHoldRearmsNextCharge: false,
  nextChargeRequires: 'physical-release-then-new-press',
  preholdAcrossPredecessor: true,
  sharedPreinputReplaysPress: false,
  nominal60HzThresholdIntervalMs: [233.33333333333334, 266.6666666666667],
  upperBoundWhenOtherCastGatesFailMs: null,
  sameFrameCallbackVsUpdateOrder: 'unresolved-retain-one-update-interval',
  measuredClientParity: false,
  evidenceClass: 'installed-client-static-binary-and-asset-evidence',
});

const ACTIONS = Object.freeze([
  action(101010, 10101010, 75, 'partially-resolved-public-variants'),
  action(102001, 10200110, 55, 'unresolved-public-variant-selection'),
  action(103002, 10300210, 62, 'same-skill1-reopen'),
  action(107001, 10700110, 38, 'direction-variants-share-reopen'),
  action(107002, 10700210, 96, 'resolved-single-subskill'),
  compositeReleaseAction(108003, 10800310, {
    sourceSubSkillIndex: 0,
    sourceWrapperFrameDomain: [0, 209],
    releaseReopenFrame: 25,
    releaseEventCode: 4,
    releaseEventName: 'Charging',
    precedence: 'source-order-first',
    boundary: 'right-open',
    rawWindows: [
      releaseWindow('miti-light-charge', 0, 29, 10800310, 1, 1),
      releaseWindow('miti-medium-charge', 25, 67, 10800341, 0, 29),
      releaseWindow('miti-full-charge', 52, 209, 10800342, 0, 67),
    ],
    effectiveTiers: [
      effectiveTier('miti-light-charge', '重击轻蓄力', 1, 0, 29, 0),
      effectiveTier('miti-medium-charge', '重击中蓄力', 2, 29, 67, 29),
      effectiveTier('miti-full-charge', '重击满蓄力', 3, 67, 209, 67),
    ],
    markerDecision: {
      controlSkillId: 10800342,
      subSkillIndex: 0,
      decisionFrame: 0,
      stateElementId: 108003118,
      durationMs: 10000,
      extraArrowFrame: 3,
      clearFrame: 4,
    },
  }),
  action(109001, 10900110, 83, 'resolved-single-subskill'),
  action(112001, 11200110, 96, 'public-sub0-only-contextual-h2-h3-separate'),
  action(199001, 19900110, 60, 'starborn-alias-specific-timing'),
  action(199002, 19900210, 60, 'starborn-alias-specific-timing'),
]);

const AUTHORITY_PAYLOAD = Object.freeze({
  schemaVersion: VERIFIED_CHARGED_INPUT_AUTHORITY_SCHEMA_VERSION,
  contractName: VERIFIED_CHARGED_INPUT_AUTHORITY_CONTRACT,
  kind: VERIFIED_CHARGED_INPUT_AUTHORITY_KIND,
  authorityVersion: '1.1.0',
  clientIdentity: CLIENT_IDENTITY,
  auditIdentity: AUDIT_IDENTITY,
  physicalInput: PHYSICAL_INPUT,
  actions: ACTIONS,
  optimizationAliases: Object.freeze({
    STARBORN: Object.freeze({
      ownerIds: Object.freeze([199001, 199002]),
      singleOptimizationObject: true,
      executionTimingInterchangeable: false,
    }),
  }),
  measuredClientParity: false,
  clientParityReady: false,
  formalRankingReady: false,
});

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

function action(ownerId, controlSkillId, staticReopenFrame, variantStatus) {
  return Object.freeze({
    ownerId,
    controlSkillId,
    actionKind: 'charged-attack',
    status: 'installed-client-static-charged-reopen-ready',
    applied: true,
    staticReopenFrame,
    nextSameActionFrameInterval: Object.freeze([
      staticReopenFrame,
      staticReopenFrame + 1,
    ]),
    variantStatus,
    measuredClientParity: false,
    sourceIdentity: createAuthoritySourceIdentity(`owner:${ownerId}`),
    reasons: Object.freeze([]),
  });
}

function compositeReleaseAction(ownerId, controlSkillId, releaseSelection) {
  return Object.freeze({
    ownerId,
    controlSkillId,
    actionKind: 'charged-attack',
    status: 'installed-client-static-charged-composite-release-ready',
    applied: true,
    staticReopenFrame: releaseSelection.releaseReopenFrame,
    staticReopenFrameOrigin: 'release-execution-start',
    nextSameActionFrameInterval: Object.freeze([
      releaseSelection.releaseReopenFrame,
      releaseSelection.releaseReopenFrame + 1,
    ]),
    variantStatus: 'resolved-three-tier-charging-release',
    compositeChargingRelease: Object.freeze(structuredClone(releaseSelection)),
    measuredClientParity: false,
    sourceIdentity: createAuthoritySourceIdentity(`owner:${ownerId}`),
    reasons: Object.freeze([]),
  });
}

function releaseWindow(
  windowIdentity,
  startFrame,
  endFrame,
  executionControlSkillId,
  executionSubSkillIndex,
  representativeReleaseFrame
) {
  return Object.freeze({
    windowIdentity,
    startFrame,
    endFrame,
    executionControlSkillId,
    executionSubSkillIndex,
    representativeReleaseFrame,
  });
}

function effectiveTier(
  tierIdentity,
  semanticName,
  chargeTier,
  startFrame,
  endFrame,
  representativeReleaseFrame
) {
  return Object.freeze({
    tierIdentity,
    semanticName,
    chargeTier,
    startFrame,
    endFrame,
    representativeReleaseFrame,
  });
}

function unresolvedAction(ownerId, controlSkillId, reasons) {
  return Object.freeze({
    ownerId,
    controlSkillId,
    actionKind: 'charged-attack',
    status: 'installed-client-static-charged-reopen-unresolved',
    applied: false,
    staticReopenFrame: null,
    nextSameActionFrameInterval: null,
    variantStatus: 'static-evidence-gap',
    measuredClientParity: false,
    sourceIdentity: createAuthoritySourceIdentity(`owner:${ownerId}`),
    reasons: Object.freeze([...reasons]),
  });
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
