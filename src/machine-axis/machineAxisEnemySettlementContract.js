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
    evidenceStatus: 'runtime-implemented-client-order-open',
    formalReady: false,
    blockerCode: MACHINE_AXIS_ENEMY_SETTLEMENT_BLOCKER_CODE,
    sources: [
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
              'Enemy settlement timing is runtime-defined but native client packet/frame order remains open',
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
