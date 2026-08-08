import { describe, expect, it } from 'vitest';
import { hashCanonicalValue } from '../../simulation/headless/canonicalSerialization';
import {
  MACHINE_AXIS_ENEMY_SETTLEMENT_BLOCKER_CODE,
  MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_NAME,
  getMachineAxisEnemySettlementContract,
  getMachineAxisEnemySettlementFormalReadiness,
} from '../../machine-axis/machineAxisEnemySettlementContract';

describe('Machine Axis enemy settlement timing contract', () => {
  it('hashes the explicit runtime packet and right-open frame semantics', () => {
    const contract = getMachineAxisEnemySettlementContract();
    const { contractHash, ...payload } = contract;

    expect(contract).toMatchObject({
      schemaVersion: 1,
      contractName: MACHINE_AXIS_ENEMY_SETTLEMENT_CONTRACT_NAME,
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
      },
    });
    expect(contractHash).toBe(hashCanonicalValue(payload));
    expect(getMachineAxisEnemySettlementContract().contractHash).toBe(
      contractHash
    );
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.semantics)).toBe(true);
  });

  it('fails formal readiness closed while native client ordering is open', () => {
    const readiness = getMachineAxisEnemySettlementFormalReadiness();

    expect(readiness).toMatchObject({
      formalReady: false,
      evidenceStatus: 'runtime-implemented-client-order-open',
      issues: [
        {
          code: MACHINE_AXIS_ENEMY_SETTLEMENT_BLOCKER_CODE,
          path: 'runtime.enemySettlementTiming',
          contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        },
      ],
    });
  });
});
