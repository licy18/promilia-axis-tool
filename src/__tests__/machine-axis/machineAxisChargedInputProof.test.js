import { beforeAll, describe, expect, it } from 'vitest';

import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisChargedInputProof } from '../../machine-axis/machineAxisChargedInputProof';

describe('Machine Axis charged input proof', () => {
  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('derives a conservative first prehold and accepts the threshold', () => {
    const proof = createMachineAxisChargedInputProof(
      createContract([chargedAction('charged-1', 16)])
    );
    expect(proof).toMatchObject({
      passed: true,
      finalScoreEligible: true,
      measuredClientParity: false,
      schedules: [
        expect.objectContaining({
          actionId: 'charged-1',
          pressFrame: 0,
          executionFrame: 16,
          requiredHoldFrames: 16,
          valid: true,
        }),
      ],
    });
  });

  it('rejects a charged action that cannot reach the physical threshold', () => {
    const proof = createMachineAxisChargedInputProof(
      createContract([chargedAction('charged-too-early', 15)])
    );
    expect(proof.passed).toBe(false);
    expect(proof.issues.map(issue => issue.code)).toContain(
      'charged-input-threshold-not-reached'
    );
  });

  it('derives release then repress between repeated charged actions', () => {
    const proof = createMachineAxisChargedInputProof(
      createContract([
        chargedAction('charged-1', 16),
        chargedAction('charged-2', 113),
      ])
    );
    expect(proof.passed).toBe(true);
    expect(proof.schedules[1]).toMatchObject({
      releaseFrame: 17,
      pressFrame: 97,
      executionFrame: 113,
    });
  });

  it('rearams Miti from the physical Charging release and waits for the release-control reopen', () => {
    const first = chargedAction('miti-full-1', 16, {
      publicActionId: 10800301,
      releaseInputFrame: 67,
    });
    const second = chargedAction('miti-full-2', 108, {
      publicActionId: 10800301,
      releaseInputFrame: 67,
    });
    const proof = createMachineAxisChargedInputProof(
      createContract([first, second], 108003)
    );
    expect(proof.passed).toBe(true);
    expect(proof.schedules).toMatchObject([
      {
        actionId: 'miti-full-1',
        chargingReleaseInputFrame: 67,
        chargingReleaseFrame: 83,
      },
      {
        actionId: 'miti-full-2',
        releaseFrame: 83,
        previousInputGateFrame: 108,
        executionFrame: 108,
        valid: true,
      },
    ]);
  });

  it('rejects Miti before the selected release-control reopen', () => {
    const proof = createMachineAxisChargedInputProof(
      createContract(
        [
          chargedAction('miti-full-1', 16, {
            publicActionId: 10800301,
            releaseInputFrame: 67,
          }),
          chargedAction('miti-full-too-early', 107, {
            publicActionId: 10800301,
            releaseInputFrame: 67,
          }),
        ],
        108003
      )
    );
    expect(proof.passed).toBe(false);
    expect(proof.issues.map(issue => issue.code)).toContain(
      'charged-input-previous-reopen-not-reached'
    );
  });
});

function createContract(actions, characterId = 107002) {
  return {
    scenario: {
      fps: 60,
      team: [{ slotId: 'slot-1', characterId }],
    },
    actions,
  };
}

function chargedAction(
  id,
  frame,
  { publicActionId = 10700201, releaseInputFrame = null } = {}
) {
  return {
    id,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId,
      actionKind: 'charged-attack',
      level: 1,
      ...(releaseInputFrame == null
        ? {}
        : {
            semanticVariant: {
              selectorIdentity: 'miti-full-charge',
              selectorKind: 'charging-release-frame',
              chargeTier: 3,
              mode: 'release',
              inputFrame: releaseInputFrame,
            },
          }),
    },
    schedule: { mode: 'absolute', frame, offsetFrames: 0 },
  };
}
