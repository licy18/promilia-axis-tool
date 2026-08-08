import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization';

export const MACHINE_AXIS_ENEMY_SETTLEMENT_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_NAME =
  'AzPrMachineAxisEnemySettlementTiming';
export const MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_ID =
  'm12-enemy-settlement-runtime-v1';
export const MACHINE_AXIS_ENEMY_SETTLEMENT_BLOCKER_CODE =
  'machine-axis-enemy-settlement-client-order-open';

const CONTRACT_PAYLOAD = deepFreeze({
  schemaVersion: MACHINE_AXIS_ENEMY_SETTLEMENT_SCHEMA_VERSION,
  contractName: MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_NAME,
  contractId: MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_ID,
  semantics: {
    breakingPacketHpDamagePhase: 'pre-break',
    breakActivation: 'after-breaking-packet-toughness-settlement',
    subsequentSameFramePacket: 'post-break-by-canonical-source-sequence',
    breakIntervalEnd: 'right-open',
    sameFrameStateOrder: 'weakness-state-tick-before-combat-hit',
    toughnessAdvanceResolution: 'fixed-100ms-runtime-tick',
    finiteDeathTruncation:
      'stop-enemy-hp-and-toughness-settlement-after-first-lethal-packet',
  },
  evidence: {
    evidenceStatus: 'client-static-partial-controlled-capture-required',
    formalReady: false,
    blockerCode: MACHINE_AXIS_ENEMY_SETTLEMENT_BLOCKER_CODE,
    clientStaticFindings: {
      breakingPacketHpMultiplierRead: 'pre-break-state',
      packetInternalSettlementOrder:
        'weakness-point-change-dispatch-before-change-hp',
      breakDamageUpSource:
        'authoritative-profile-battle-property-221-wp-break-dmgup',
      ordinaryAndRealDamageBreakMultiplier: 'profile-property-applied',
      pureToughnessBreakMultiplier: 'not-applied-and-gated-while-broken',
      localControlledTimerAdvance: 'per-update-delta-time',
      localControlledBreakEnd: 'right-open-greater-than-or-equal-transition',
      remoteControlledUpdate: 'performance-mirroring-only',
    },
    leavesOpen: [
      'same-frame-damage-element-queue-order-and-immediate-weak-state-visibility',
      'break-end-state-update-versus-hit-order-in-the-same-client-frame',
      'finite-hp-lethal-packet-and-post-death-tail-packet-disposition',
      'authoritative-local-versus-remote-network-path-for-the-zero-distance-passive-boss-scenario',
    ],
    sources: [
      {
        kind: 'client-static-evidence-report',
        identity:
          'reports/m12/m12-b3-enemy-toughness-settlement-evidence-20260808.json',
        bytes: 19027,
        sha256:
          'd771cc427b9b4a3d4b41e4a916d91ffbb14c3d61d867dd88385ea072d878ccfd',
        reportHash:
          'ace9c36b6b51b9c8dae60cc2edb412729c75799054f9fb069df2aeb3763bfe21',
        closes: [
          'single-packet-break-multiplier-order',
          'break-damage-up-property-source-and-route-scope',
          'local-controlled-timer-state-machine',
          'remote-controlled-performance-only-path',
        ],
      },
      {
        kind: 'controlled-capture-manifest',
        identity: 'src/data/generated/runtime-capture-hook-manifest.json',
        manifestId: 'azpr-tc-20260709-three-value-runtime-capture-v3',
        bytes: 30088,
        sha256:
          '3724588d3c94f620095820181ddf008f10896963d9663590d9818b92d8587ea4',
        captureStatus: 'not-captured',
      },
      {
        kind: 'runtime-implementation',
        identity:
          'src/simulation/mechanics/verifiedCombatRuntime.js#applyHitDescriptor',
        closes: [
          'breaking-packet-pre-break-runtime-behavior',
          'same-frame-source-sequence-runtime-behavior',
        ],
      },
      {
        kind: 'runtime-implementation',
        identity:
          'src/simulation/mechanics/verifiedCombatRuntime.js#applyWeaknessStateDescriptor',
        closes: [
          'right-open-break-end-runtime-behavior',
          'state-tick-before-hit-runtime-behavior',
        ],
      },
      {
        kind: 'reverse-engineered-profile-values',
        identity:
          'reports/verified-combat-mechanics-audit.json#combat-enemy-break-profiles',
        closes: [
          'recovery-delay-value',
          'recovery-rate-value',
          'break-time-value',
          'break-end-time-value',
          'break-damage-up-value',
        ],
        leavesOpen: [
          'native-breaking-packet-hp-multiplier-order',
          'native-break-end-frame-order',
        ],
      },
    ],
  },
});

export function getMachineAxisEnemySettlementContract() {
  const payload = structuredClone(CONTRACT_PAYLOAD);
  return deepFreeze({
    ...payload,
    contractHash: hashCanonicalValue(payload),
  });
}

export function getMachineAxisEnemySettlementFormalReadiness() {
  const contract = getMachineAxisEnemySettlementContract();
  return deepFreeze({
    formalReady: contract.evidence.formalReady,
    evidenceStatus: contract.evidence.evidenceStatus,
    issues: contract.evidence.formalReady
      ? []
      : [
          {
            code: contract.evidence.blockerCode,
            path: 'runtime.enemySettlementTiming',
            message:
              'Native static evidence closes single-packet and local timer semantics, but controlled client capture is still required for cross-packet/frame, lethal-tail, and authoritative execution-path ordering',
            contractId: contract.contractId,
            contractHash: contract.contractHash,
          },
        ],
  });
}

function deepFreeze(value) {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}
