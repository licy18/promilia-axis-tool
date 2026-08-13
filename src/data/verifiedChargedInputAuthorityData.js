const freeze = Object.freeze;

const CLIENT_IDENTITY = freeze({
  gameAssemblySha256:
    'C60D13795629F0851B1399338F375EB378AEF2098515D41841F30CCC3463C22B',
  globalMetadataSha256:
    'C8870E4AF8EEB3C03BE3238BD70064520C11C7ED7141CAD38ABDC7C03E49E17B',
  globalGameManagersSha256:
    '090119217E95997077EDED03A791B98BAED1FE903DBE9B32E180F4AB35A76B4B',
});

const AUDIT_IDENTITY = freeze({
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

const PHYSICAL_INPUT = freeze({
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

const SOURCE_IDENTITY_PREFIX = [
  `installed-client:GameAssembly.dll#sha256=${CLIENT_IDENTITY.gameAssemblySha256}`,
  `charged-timing-matrix#sha256=${AUDIT_IDENTITY.chargedTimingMatrixSha256}`,
  `binary-input-state-machine#sha256=${AUDIT_IDENTITY.binaryInputStateMachineSha256}`,
  `giselle-heavy23-timing-matrix#sha256=${AUDIT_IDENTITY.giselleTimingMatrixSha256}`,
  `miti-charged-release-timing-matrix#sha256=${AUDIT_IDENTITY.mitiTimingMatrixSha256}`,
  `miti-charged-release-binary-logic#sha256=${AUDIT_IDENTITY.mitiBinaryReleaseLogicSha256}`,
].join('|');

const ACTIONS = freeze([
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

export const VERIFIED_CHARGED_INPUT_AUTHORITY_PAYLOAD = freeze({
  schemaVersion: 1,
  contractName: 'AzPrVerifiedChargedInputAuthority',
  kind: 'azpr-verified-charged-input-authority',
  authorityVersion: '1.1.0',
  clientIdentity: CLIENT_IDENTITY,
  auditIdentity: AUDIT_IDENTITY,
  physicalInput: PHYSICAL_INPUT,
  actions: ACTIONS,
  optimizationAliases: freeze({
    STARBORN: freeze({
      ownerIds: freeze([199001, 199002]),
      singleOptimizationObject: true,
      executionTimingInterchangeable: false,
    }),
  }),
  measuredClientParity: false,
  clientParityReady: false,
  formalRankingReady: false,
});

function action(ownerId, controlSkillId, staticReopenFrame, variantStatus) {
  return freeze({
    ownerId,
    controlSkillId,
    actionKind: 'charged-attack',
    status: 'installed-client-static-charged-reopen-ready',
    applied: true,
    staticReopenFrame,
    nextSameActionFrameInterval: freeze([
      staticReopenFrame,
      staticReopenFrame + 1,
    ]),
    variantStatus,
    measuredClientParity: false,
    sourceIdentity: createVerifiedChargedInputAuthoritySourceIdentity(
      `owner:${ownerId}`
    ),
    reasons: freeze([]),
  });
}

function compositeReleaseAction(ownerId, controlSkillId, releaseSelection) {
  return freeze({
    ownerId,
    controlSkillId,
    actionKind: 'charged-attack',
    status: 'installed-client-static-charged-composite-release-ready',
    applied: true,
    staticReopenFrame: releaseSelection.releaseReopenFrame,
    staticReopenFrameOrigin: 'release-execution-start',
    nextSameActionFrameInterval: freeze([
      releaseSelection.releaseReopenFrame,
      releaseSelection.releaseReopenFrame + 1,
    ]),
    variantStatus: 'resolved-three-tier-charging-release',
    compositeChargingRelease: freeze(structuredClone(releaseSelection)),
    measuredClientParity: false,
    sourceIdentity: createVerifiedChargedInputAuthoritySourceIdentity(
      `owner:${ownerId}`
    ),
    reasons: freeze([]),
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
  return freeze({
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
  return freeze({
    tierIdentity,
    semanticName,
    chargeTier,
    startFrame,
    endFrame,
    representativeReleaseFrame,
  });
}

export function createVerifiedChargedInputAuthoritySourceIdentity(suffix) {
  return `${SOURCE_IDENTITY_PREFIX}|${suffix}`;
}
