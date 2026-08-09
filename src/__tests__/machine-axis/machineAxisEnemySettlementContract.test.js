import { describe, expect, it } from 'vitest';
import { hashCanonicalValue } from '../../simulation/headless/canonicalSerialization';
import {
  MACHINE_AXIS_ENEMY_SETTLEMENT_CLIENT_PARITY_PENDING_CODE,
  MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_NAME,
  getMachineAxisEnemySettlementContract,
  getMachineAxisEnemySettlementFormalReadiness,
} from '../../machine-axis/machineAxisEnemySettlementContract';

describe('Machine Axis enemy settlement timing contract', () => {
  it('hashes the explicit runtime packet and right-open frame semantics', () => {
    const contract = getMachineAxisEnemySettlementContract();
    const { contractHash, ...payload } = contract;

    expect(contract).toMatchObject({
      schemaVersion: 2,
      contractName: MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_NAME,
      contractId: 'm12-enemy-settlement-runtime-v2',
      semantics: {
        breakingPacketHpDamagePhase: 'pre-break',
        breakActivation: 'after-breaking-packet-toughness-settlement',
        subsequentSameFramePacket: 'post-break-by-canonical-source-sequence',
        breakIntervalEnd: 'right-open',
        sameFrameStateOrder: 'weakness-state-tick-before-combat-hit',
        toughnessAdvanceResolution: 'fixed-100ms-runtime-tick',
        finiteDeathTruncation:
          'stop-enemy-hp-and-toughness-settlement-after-first-lethal-packet',
        formalScenarioExecutionPath: 'local-controlled',
        fastestKillScoreBoundary:
          'first-lethal-settlement-cursor-inclusive-tail-non-scoring',
      },
      formalScoring: {
        formalReady: true,
        formalStatus: 'formal-score-ready-runtime-baseline',
        scoreAuthority: 'formal-for-current-runtime-contract',
        scoreBasis: 'product-approved-versioned-headless-runtime-semantics',
        clientParityStatus: 'controlled-capture-pending-nonblocking',
        clientParityRequiredForCurrentFormalScore: false,
      },
      evidence: {
        evidenceStatus: 'client-static-partial-controlled-capture-required',
        clientParityReady: false,
        pendingCode: MACHINE_AXIS_ENEMY_SETTLEMENT_CLIENT_PARITY_PENDING_CODE,
        clientStaticFindings: {
          breakingPacketHpMultiplierRead: 'pre-break-state',
          packetInternalSettlementOrder:
            'weakness-point-change-dispatch-before-change-hp',
          breakDamageUpSource:
            'authoritative-profile-battle-property-221-wp-break-dmgup',
          localControlledTimerAdvance: 'per-update-delta-time',
        },
        leavesOpen: [
          'same-frame-damage-element-queue-order-and-immediate-weak-state-visibility',
          'break-end-state-update-versus-hit-order-in-the-same-client-frame',
          'finite-hp-lethal-packet-and-post-death-tail-packet-disposition',
          'authoritative-local-versus-remote-network-path-for-the-zero-distance-passive-boss-scenario',
        ],
        scoreSensitiveLeavesOpen: [
          'same-frame-damage-element-queue-order-and-immediate-weak-state-visibility',
          'break-end-state-update-versus-hit-order-in-the-same-client-frame',
        ],
        nonBlockingLeavesOpen: [
          'finite-hp-lethal-packet-and-post-death-tail-packet-disposition',
          'authoritative-local-versus-remote-network-path-for-the-zero-distance-passive-boss-scenario',
        ],
      },
    });
    expect(contractHash).toBe(hashCanonicalValue(payload));
    expect(getMachineAxisEnemySettlementContract().contractHash).toBe(
      contractHash
    );
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.semantics)).toBe(true);
  });

  it('releases formal scoring against the current runtime while preserving client-parity warnings', () => {
    const readiness = getMachineAxisEnemySettlementFormalReadiness();

    expect(readiness).toMatchObject({
      formalReady: true,
      formalStatus: 'formal-score-ready-runtime-baseline',
      scoreAuthority: 'formal-for-current-runtime-contract',
      evidenceStatus: 'client-static-partial-controlled-capture-required',
      clientParityReady: false,
      issues: [],
      warnings: [
        {
          code: MACHINE_AXIS_ENEMY_SETTLEMENT_CLIENT_PARITY_PENDING_CODE,
          path: 'runtime.enemySettlementTiming.clientParity',
          contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        },
      ],
    });
  });
});
