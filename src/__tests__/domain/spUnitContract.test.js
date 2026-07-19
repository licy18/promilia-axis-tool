import { describe, expect, it } from 'vitest';
import {
  AZPR_SP_UNIT_CONTRACT,
  applyActorSpResourceProfile,
  createActorSpResourceProfile,
  resolveKiboEffectiveMaxSp,
  scaleLegacyNormalizedSpValue,
} from '../../domain/spUnitContract';

describe('AzPr SP unit contract', () => {
  it('derives actor and kibo effective MAXSP from the verified growth chain', () => {
    const rawAttributes = [{ id: 6, key: 'MAXSP', value: 1 }];
    const actorProfile = createActorSpResourceProfile(rawAttributes);

    expect(AZPR_SP_UNIT_CONTRACT).toMatchObject({
      valueUnit: 'absolute-sp-points',
      actor: {
        maxSpGrowthTemplateId: 1001001,
        maxSpGrowthMultiplier: 100,
      },
      kibo: {
        petGrowthBaseId: 5001000,
        maxSpGrowthTemplateId: 5001001,
        maxSpGrowthMultiplier: 100,
      },
    });
    expect(actorProfile).toMatchObject({
      maxSpBase: 1,
      maxSpGrowthTemplateId: 1001001,
      maxSpGrowthMultiplier: 100,
      effectiveMaxSp: 100,
      valueUnit: 'absolute-sp-points',
    });
    expect(applyActorSpResourceProfile(rawAttributes, actorProfile)).toEqual([
      expect.objectContaining({
        key: 'MAXSP',
        value: 100,
        baseValue: 1,
        growthMultiplier: 100,
        valueUnit: 'absolute-sp-points',
      }),
    ]);
    expect(resolveKiboEffectiveMaxSp(1)).toBe(100);
  });

  it('scales only legacy normalized values during carrier migration', () => {
    expect(scaleLegacyNormalizedSpValue(0, 100)).toBe(0);
    expect(scaleLegacyNormalizedSpValue(0.72, 100)).toBe(72);
    expect(scaleLegacyNormalizedSpValue(1, 100)).toBe(100);
    expect(scaleLegacyNormalizedSpValue(72, 100)).toBe(72);
  });
});
