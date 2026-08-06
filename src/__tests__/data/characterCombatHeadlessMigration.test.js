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
      '37c292db7e86bfdf7cd0b1c93ee766de241e1d9b9a0d48ee3268e9d024071837',
    summaryHash:
      '71b6a34ea01b0afaffc8ce2f6b61e1bda464a3d5cda9ec010c4f2cc49327fbad',
    inputHash: 'd1493015efa460d2',
    dataHash: 'e1f85057a47b1ef0',
    traceHash: '2d7614acbc5cd514',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      'f1aa2b155e4eec77ad102b0959e3b85042ac52bcc258276d7af96196c24fd99f',
    summaryHash:
      '27925aca23a0a7822ac181d5eabd39192b04872f27c1c7eb7feacfdc1e7027de',
    inputHash: '0013eef28378f7fe',
    dataHash: '7ba2a69b7822818b',
    traceHash: '5a45e684b2180093',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      'a55e51cf1114f97b012cce0fee723351118518f2019024a608cb788eb687b635',
    summaryHash:
      '1540b7df01fbf8d82964e333e91fedef129479a3c6d6466ddd29faa9fdcf1744',
    inputHash: 'bba0d250463250c0',
    dataHash: '390068a9fba67716',
    traceHash: '90b447c55f43d828',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      '624a48308aafea9cedb9d81db624377ce1620fbc0795ecadc99da8113571cdf6',
    summaryHash:
      '5b6de79f7b816c6749f8bc7cbc5d394db8a43ae030ae7febf4647f59c0c5dc14',
    inputHash: '666afc0b987fb548',
    dataHash: '6ffb95600e8d115b',
    traceHash: 'f26c72177387a917',
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
