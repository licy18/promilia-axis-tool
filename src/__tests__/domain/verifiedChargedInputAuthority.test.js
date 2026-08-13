import { describe, expect, it } from 'vitest';

import {
  createVerifiedChargedInputScheduling,
  getVerifiedChargedInputAuthorityDescriptor,
  resolveVerifiedChargedInputAuthority,
} from '../../domain/verifiedChargedInputAuthority';
import { resolveVerifiedChargingReleaseWindow } from '../../domain/verifiedChargingReleaseSelection';

describe('verified charged input authority', () => {
  it('binds the ten formal owners to static client evidence without claiming parity', () => {
    const descriptor = getVerifiedChargedInputAuthorityDescriptor();
    expect(descriptor.authorityHash).toMatch(/^[a-f0-9]{64}$/);
    expect(descriptor.actions).toHaveLength(10);
    expect(descriptor).toMatchObject({
      measuredClientParity: false,
      clientParityReady: false,
      formalRankingReady: false,
    });
    expect(
      resolveVerifiedChargedInputAuthority({
        ownerId: 107002,
        controlSkillId: 10700210,
      })
    ).toMatchObject({
      staticReopenFrame: 96,
      nextSameActionFrameInterval: [96, 97],
      applied: true,
    });
    expect(
      resolveVerifiedChargedInputAuthority({
        ownerId: 103002,
        controlSkillId: 10300210,
      })
    ).toMatchObject({ staticReopenFrame: 62 });
    expect(
      resolveVerifiedChargedInputAuthority({
        ownerId: 199001,
        controlSkillId: 19900110,
      })
    ).toMatchObject({ staticReopenFrame: 60 });
    expect(
      resolveVerifiedChargedInputAuthority({
        ownerId: 108003,
        controlSkillId: 10800310,
      })
    ).toMatchObject({
      applied: true,
      staticReopenFrame: 25,
      staticReopenFrameOrigin: 'release-execution-start',
      nextSameActionFrameInterval: [25, 26],
      compositeChargingRelease: {
        sourceWrapperFrameDomain: [0, 209],
        precedence: 'source-order-first',
        effectiveTiers: [
          expect.objectContaining({
            tierIdentity: 'miti-light-charge',
            startFrame: 0,
            endFrame: 29,
          }),
          expect.objectContaining({
            tierIdentity: 'miti-medium-charge',
            startFrame: 29,
            endFrame: 67,
          }),
          expect.objectContaining({
            tierIdentity: 'miti-full-charge',
            startFrame: 67,
            endFrame: 209,
          }),
        ],
        markerDecision: {
          decisionFrame: 0,
          durationMs: 10000,
          extraArrowFrame: 3,
          clearFrame: 4,
        },
      },
    });
  });

  it.each([
    [25, 'miti-light-charge'],
    [29, 'miti-medium-charge'],
    [52, 'miti-medium-charge'],
    [67, 'miti-full-charge'],
  ])('selects the client source-order Miti tier at %sF', (frame, identity) => {
    const authority = resolveVerifiedChargedInputAuthority({
      ownerId: 108003,
      controlSkillId: 10800310,
    });
    const selection = resolveVerifiedChargingReleaseWindow({
      windows: authority.compositeChargingRelease.rawWindows,
      releaseFrame: frame,
      precedence: authority.compositeChargingRelease.precedence,
    });
    expect(selection).toMatchObject({
      ready: true,
      selectedWindowIdentity: identity,
    });
  });

  it('uses a threshold interval instead of a fixed 15 animation frames', () => {
    expect(
      createVerifiedChargedInputScheduling({
        executionFrame: 16,
        earliestPressFrame: 0,
        frameRate: 60,
      })
    ).toMatchObject({
      ready: true,
      pressFrame: 0,
      heldFrames: 16,
      physicalInput: {
        thresholdMs: 250,
        nominalThresholdFrameInterval: [14, 16],
        continuingHoldRearmsNextCharge: false,
      },
    });
    expect(
      createVerifiedChargedInputScheduling({
        executionFrame: 15,
        earliestPressFrame: 0,
        frameRate: 60,
      })
    ).toMatchObject({
      ready: false,
      reasons: ['charged-input-threshold-not-reached'],
    });
  });
});
