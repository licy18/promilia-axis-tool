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
      'e5554f9784c187379bf116bd61745fc553d73d3cd1ccbec9d77f3ce261b31c8f',
    summaryHash:
      '414b19d2ff6a15b55dd9db8bbfdcf5721ee247818df24f5acb14afefec1d26db',
    inputHash: '72ca4938941bc6cf',
    dataHash: '4dc4a209fd7e89ec',
    traceHash: 'a2aeaae0ffce9b33',
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
    traceHash: 'c6225e30af716e65',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      '959ef025317d708d58aa7a18a1314c59639ad87545e590ef5121306d8fb2b822',
    summaryHash:
      'f0d7a64facfc7226a82d9c1413bc9e56a6b7507b96a5827836cff992ec54d397',
    inputHash: '011ce71e135bc69f',
    dataHash: '7599ed503c1d0c06',
    traceHash: 'a652c3834ff164c1',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      'da81d2d42159e3763872ea6ce885cfb04838c6049da368aae5bb8ea41ac1a62f',
    summaryHash:
      '381b5f437e61be54bc6daccf1a0acdcda88f2f6f5ea2510c88f0bc9e6071193f',
    inputHash: 'f7aac189e3dfee8e',
    dataHash: '75e283bd81aac633',
    traceHash: 'ed7ceee343adc03f',
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
