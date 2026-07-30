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
      'd79f0985690b9dbc365376f0e7d8e6bf9cb2388c7bb2e084d0675116867947ce',
    summaryHash:
      'f9c492ef3bf54aee60c44520412b954188f8642a504ab2670b5cfc7c7db1dc15',
    inputHash: '705e9b883dbb501f',
    dataHash: '4dc4a209fd7e89ec',
    traceHash: 'a07bdfab5a89b594',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 123,
    replayHash:
      '0b19a52bc1e46f9f7f9eee28a38e054117c5dbd7fecde3c3112b29635c2477d1',
    summaryHash:
      'c469716e1b6641e5e6fd1e35faf8fccde9b8b5d14ef56e401a4c908caa6fdd57',
    inputHash: '28548bd658dd5c95',
    dataHash: 'c61cf000dddae67b',
    traceHash: '3675b4fdbb2691d7',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      '5d3224c71bc82df933b3682824ed556411a881c679810d34497b74d24acf314d',
    summaryHash:
      'ef73489ade8947f53adcef412095625d60fd75aa5465b44848ebecc70f2abb23',
    inputHash: '8c1a4acddf5e3b54',
    dataHash: '7599ed503c1d0c06',
    traceHash: 'a4fa5e43670cd0a1',
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
    inputHash: '2a3d5665405c92b5',
    dataHash: 'ae547d57a9ed29ca',
    traceHash: '602f3db82eea7d87',
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
