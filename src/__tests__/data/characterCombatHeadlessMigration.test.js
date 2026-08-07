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
    inputHash: 'bf50f4c62ea335b1',
    dataHash: '0853068dfff5bca5',
    traceHash: '6c27749e420f99cb',
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
    inputHash: '77d721cd50cf0333',
    dataHash: '7d94e0dca51d0b4d',
    traceHash: '31444252f1968667',
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
    inputHash: '9549d0ee4ad0ae95',
    dataHash: '75e5328fb5440d30',
    traceHash: 'efe307c0684f2fc2',
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
    inputHash: 'c0b112f5a2ad6309',
    dataHash: '285b5be3ef41864d',
    traceHash: '3a6be5e58d4cf2b6',
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
