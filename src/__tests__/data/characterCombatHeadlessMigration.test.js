import { describe, expect, it } from 'vitest';
import hanGolden from '../../../reports/m10/101003/golden-trace.json';
import hanSwitchGolden from '../../../reports/m10/101003/ultimate-controlled-buff-switch-golden.json';
import xiaoyuGolden from '../../../reports/m10/101010/golden-trace.json';
import rubyGolden from '../../../reports/m10/103002/golden-trace.json';

const GOLDENS = [
  {
    identity: 'xiaoyu-main',
    ownerId: 101010,
    report: xiaoyuGolden,
    assertionCount: 118,
    replayHash:
      'a93a6fc484a07a8fc7308e919d21d42349002d5edb6f9f37bc2f6e991c57357e',
    summaryHash:
      '218265744ae9831643b21e7f23f1f633454740d39816e908a299d9ec8234ec4f',
    inputHash: '78229fe9fcc09bc6',
    dataHash: 'a0c79e6186237c74',
    traceHash: '6659ca917b4975df',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      '749b28bb496c557e16d3c5cbcad1d5ee81a1c975f798a20629f42fa95c938587',
    summaryHash:
      '849fbb4800dac387a62401deffd2d036083ad814bce336e610a730244b166dfe',
    inputHash: '50d82857ea5057b8',
    dataHash: 'af6aad6a8d5c1c7c',
    traceHash: 'bf0b0698dc1c470d',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      '308f972eb6e16124c712c663ee3b26bcb448722467833516b81ed1496926b0b7',
    summaryHash:
      'd1171da7888048910469a601262574c52d46b7c177bfc1ec4214d8ae7b88c7fc',
    inputHash: '66560a440ff7fd22',
    dataHash: 'e3375c5da6a419c1',
    traceHash: 'f6f4fb965829ff88',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      '19f06f106c919426e96c7accf63333acd3f070c44bafd66533b067de82ba1a60',
    summaryHash:
      'b157daed14cee85aced15c3508218daaddd93f794f255ef237c96341fa299175',
    inputHash: '96a68d867401148e',
    dataHash: 'c3a1513f9f29f478',
    traceHash: 'b2440f363e9bbdb3',
  },
];

describe('M10 golden migration to the canonical headless core', () => {
  it.each(GOLDENS)(
    'keeps $identity semantics and canonical hashes',
    ({
      report,
      assertionCount,
      replayHash,
      summaryHash,
      inputHash,
      dataHash,
      traceHash,
    }) => {
      expect(report.compilerPath).toContain(
        'canonicalHeadlessCombatCore.js#compile'
      );
      expect(report.simulatorPath).toContain(
        'canonicalHeadlessCombatCore.js#simulate'
      );
      expect(report.headlessCore).toEqual({
        schemaVersion: 1,
        inputHash,
        traceHash,
        dataHash,
        criticalPolicy: 'non-critical',
      });
      expect(report.validation).toMatchObject({
        passed: true,
        assertionCount,
        failedCount: 0,
      });
      expect(report.replayHash).toBe(replayHash);
      expect(report.actual.summaryHash).toBe(summaryHash);
    }
  );
});
