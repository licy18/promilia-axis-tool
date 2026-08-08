import { describe, expect, it } from 'vitest';

import xiaoyuGoldenTrace from '../../../reports/m10/101010/golden-trace.json';
import rubyGoldenTrace from '../../../reports/m10/103002/golden-trace.json';

describe('legacy golden axes under shared tuning-mark decay', () => {
  it('keeps Xiaoyu threshold Wind transactions and the later shared mark deadlines observable', () => {
    expect(xiaoyuGoldenTrace.validation.passed).toBe(true);
    expect(projectActiveTuningEvents(xiaoyuGoldenTrace)).toEqual([
      ['wind', 'acquire', 43, 0, 2, 'threshold-charged'],
      ['wind', 'consume', 324, 2, 1, 'threshold-enhanced-special-charged'],
      ['wind', 'consume', 579, 1, 0, 'ultimate-refresh'],
      ['fire', 'acquire', 1213, 0, 1, 'han-star-skill'],
      ['fire', 'acquire', 1220, 1, 2, 'han-star-skill'],
      [
        'thunder',
        'acquire',
        1404,
        0,
        1,
        'switch-to-ruby--on-enter--actor-103002--star-carry',
      ],
      [
        'fire',
        'acquire',
        1407,
        2,
        3,
        'switch-to-ruby--on-exit--actor-101003--star-carry',
      ],
      ['thunder', 'consume', 1773, 1, 0, 'ruby-ultimate'],
      ['fire', 'consume', 1884, 3, 2, 'ruby-ultimate'],
      ['fire', 'consume', 1900, 2, 1, 'ruby-ultimate'],
      ['wind', 'acquire', 2463, 0, 1, 'normal-a5'],
      ['wind', 'consume', 2565, 1, 0, 'normal-special-charged'],
      [
        'fire',
        'expire',
        2607,
        1,
        0,
        'switch-to-ruby--on-exit--actor-101003--star-carry',
      ],
    ]);
    expect(xiaoyuGoldenTrace.actual.combat).toMatchObject({
      ownerTotalHpDamage: 775993,
      ownerTotalToughnessDamage: 0,
    });
    expect(
      xiaoyuGoldenTrace.actual.dynamicProperties.maxPercentRawByAttributeId
    ).toEqual({ 1: 1500, 229: 9600 });
  });

  it('keeps Ruby observable results because each mark is consumed or expires before another same-attribute gain', () => {
    expect(rubyGoldenTrace.validation.passed).toBe(true);
    expect(projectActiveTuningEvents(rubyGoldenTrace)).toEqual([
      ['fire', 'acquire', 1850, 0, 1, 'ruby-star-skill'],
      ['fire', 'consume', 2484, 1, 0, 'ruby-ultimate'],
      [
        'thunder',
        'acquire',
        3954,
        0,
        1,
        'switch-back-to-ruby--on-enter--actor-103002--star-carry',
      ],
      [
        'thunder',
        'expire',
        5154,
        1,
        0,
        'switch-back-to-ruby--on-enter--actor-103002--star-carry',
      ],
    ]);
    expect(rubyGoldenTrace.actual.combat).toMatchObject({
      ownerTotalHpDamage: 218014,
      ownerTotalToughnessDamage: 6063,
    });
    expect(
      rubyGoldenTrace.actual.dynamicProperties.maxPercentRawByAttributeId
    ).toEqual({ 1: 60, 229: 0 });
  });
});

function projectActiveTuningEvents(goldenTrace) {
  return goldenTrace.actual.resources.tuningMarkTrace
    .filter(event => ['acquire', 'consume', 'expire'].includes(event.kind))
    .map(event => [
      event.profileKey,
      event.kind,
      event.frame,
      event.before,
      event.after,
      event.actionId,
    ]);
}
