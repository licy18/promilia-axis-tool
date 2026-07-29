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
    assertionCount: 117,
    replayHash:
      '92b28770851aa03ecfbcb9440c20105fdbe60630a4d3b3890a1661ba05d20501',
    summaryHash:
      '4ee14faf60a5cfa997576480923dffc2ead27719b3a455986bce94941e4f7a75',
    inputHash: '37d5925dba605913',
    dataHash: 'ea74fc131e869f82',
    traceHash: 'f10783643a130f2e',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 123,
    replayHash:
      '60648d22a0152c6fe05829fa26fa1f98d1c66601e68f5799b5f471186d689713',
    summaryHash:
      '8c29b166f87a1800144f39b31ecb7ab8996835bd9ff5a471ca5908b1ddadf69f',
    inputHash: 'b76350f58ed5d7dd',
    dataHash: '1cbe890a97bd40fd',
    traceHash: 'ad73d92c22ba9435',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      '6ba16a71ad199b8151a9584bcd83e6d89ad88ab90a3f101c529e2fbaeb11c089',
    summaryHash:
      '87881cbd0060650f7d353d04884602cb38e52fe83fdf24b196dfbec6bca7ca2b',
    inputHash: 'b06fe21d3dea1aa0',
    dataHash: '5d9cc9a253adf8e0',
    traceHash: '16192a3792515bf5',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      '53a7d025597e6d6762e3c1530a8df5813255b738a89942fc092f7e29c9777232',
    summaryHash:
      '4ffdfc6ed2f971060b420a77369b3550ac65070071b08169a6fdb9eb3a4b670e',
    inputHash: '58e5e0ef389d8f0d',
    dataHash: 'fed3617f028f9e00',
    traceHash: 'd30279443d8e4b3f',
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
