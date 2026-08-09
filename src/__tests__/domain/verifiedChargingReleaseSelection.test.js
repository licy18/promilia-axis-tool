import { describe, expect, it } from 'vitest';

import { normalizeActionVariantInputSelection } from '../../domain/actionVariantInputSelection';
import { resolveVerifiedChargingReleaseWindow } from '../../domain/verifiedChargingReleaseSelection';

describe('verified charging release selection', () => {
  const heavy2 = [
    createWindow('early', 0, 60, 11200141, 0),
    createWindow('full', 59, 239, 11200141, 1),
  ];
  const heavy3 = [
    createWindow('early', 0, 68, 11200141, 2),
    createWindow('full', 67, 134, 11200141, 3),
  ];

  it.each([
    [heavy2, 58, 0, 1],
    [heavy2, 59, 1, 2],
    [heavy2, 60, 1, 1],
    [heavy3, 66, 2, 1],
    [heavy3, 67, 3, 2],
    [heavy3, 68, 3, 1],
  ])(
    'uses greatest-start-frame precedence at release frame %i',
    (windows, releaseFrame, expectedSubSkill, candidateCount) => {
      const result = resolveVerifiedChargingReleaseWindow({
        windows,
        releaseFrame,
        precedence: 'greatest-start-frame',
      });

      expect(result.ready).toBe(true);
      expect(result.selected.executionSubSkillIndex).toBe(expectedSubSkill);
      expect(result.overlappingCandidateCount).toBe(candidateCount);
    }
  );

  it('keeps right-open end frames excluded', () => {
    const result = resolveVerifiedChargingReleaseWindow({
      windows: [createWindow('only', 0, 60, 11200141, 0)],
      releaseFrame: 60,
      precedence: 'greatest-start-frame',
    });

    expect(result.ready).toBe(false);
    expect(result.reasons).toEqual(['charging-release-window-missing']);
  });

  it('fails closed when equal start frames have different semantics', () => {
    const result = resolveVerifiedChargingReleaseWindow({
      windows: [
        createWindow('left', 59, 120, 11200141, 0),
        createWindow('right', 59, 120, 11200141, 1),
      ],
      releaseFrame: 59,
      precedence: 'greatest-start-frame',
    });

    expect(result.ready).toBe(false);
    expect(result.reasons).toEqual([
      'charging-release-same-threshold-semantic-conflict',
    ]);
  });

  it('uses source identity only for equivalent equal-start candidates', () => {
    const result = resolveVerifiedChargingReleaseWindow({
      windows: [
        createWindow('z-source', 59, 120, 11200141, 1, 'same'),
        createWindow('a-source', 59, 121, 11200141, 1, 'same'),
      ],
      releaseFrame: 59,
      precedence: 'greatest-start-frame',
    });

    expect(result.ready).toBe(true);
    expect(result.selected.sourceIdentity).toBe('a-source');
    expect(result.tieBreak).toBe(
      'stable-source-identity-equivalent-semantics'
    );
  });

  it('normalizes a release-frame input without a public selector identity', () => {
    expect(
      normalizeActionVariantInputSelection({ mode: 'release', releaseFrame: 67 })
    ).toMatchObject({
      selectorIdentity: null,
      mode: 'release',
      inputFrame: 67,
    });
  });
});

function createWindow(
  sourceIdentity,
  startFrame,
  endFrame,
  executionControlSkillId,
  executionSubSkillIndex,
  semanticIdentity = sourceIdentity
) {
  return {
    windowIdentity: `${sourceIdentity}:${startFrame}`,
    sourceIdentity,
    startFrame,
    endFrame,
    executionControlSkillId,
    executionSubSkillIndex,
    semanticIdentity,
  };
}
