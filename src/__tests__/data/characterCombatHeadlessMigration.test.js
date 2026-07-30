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
      'ecb91f7ad71fec39d58411ae79ade18493ae88bf5a77ce1b3ea57697f8ef6e51',
    summaryHash:
      '54a32104fb2d405723422a6dd7987864b6e993f7bac4a60ce2d3c54cdbadb810',
    inputHash: '72ca4938941bc6cf',
    dataHash: '4dc4a209fd7e89ec',
    traceHash: '122f72e0abc96fc2',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      'c16d0d7d0f2648b8d83f7219a8ad886e4eb85fbb8dcca7fd1610472ae6ec9f35',
    summaryHash:
      'f9144e8d2724b63653363556774ce8d5f64e33439edd39a684e18f12f3f0e2bd',
    inputHash: '2fe4cbd1ab781ea4',
    dataHash: 'c61cf000dddae67b',
    traceHash: 'a23f07ca343cb657',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      '137be22bc495b21000dc8eed03ba50d16e31a592fe57208c58b0145b7ba07e77',
    summaryHash:
      'd351f50dbe3193e2d64502259f4931a5c1469471381a15e62da13041536a5bf4',
    inputHash: '011ce71e135bc69f',
    dataHash: '7599ed503c1d0c06',
    traceHash: '26f7b53dac7e5b9e',
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
    inputHash: 'f7aac189e3dfee8e',
    dataHash: '75e283bd81aac633',
    traceHash: '0a85e9c33441f5b1',
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
