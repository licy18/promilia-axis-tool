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
    inputHash: 'f80aa6228a03815c',
    dataHash: 'f439ee033dfac8f6',
    traceHash: 'd312438bec648e7c',
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
    inputHash: 'f42d6f3f056268ea',
    dataHash: '49fd17d4c077ca05',
    traceHash: 'da2400565bc4a357',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      'c0ea863d0c558be4998e4f0cb1399aa6998d92539d74ec3127f0d408f221a649',
    summaryHash:
      '69d7c6c48099766121656ba8e52a26b9e1244e1ed33f80fef4b7d0f965fe4c36',
    inputHash: '1394f59e694b7345',
    dataHash: 'cf571171417f4184',
    traceHash: '4e60fc4f616acf35',
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
    inputHash: 'd288657866dad6f9',
    dataHash: '87b139d6db3d185e',
    traceHash: '57c66fdab96734de',
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
