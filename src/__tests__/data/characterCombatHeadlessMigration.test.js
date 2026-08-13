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
      'e368436a1a3e14edf6e2f1abf8d0bddbf9fd930e28fd3c29db6f48c248934aba',
    summaryHash:
      'd77383d4f3df485a2b2ff3a1dd60958a8ad5f104074c21cf961f94e7f85e70bc',
    inputHash: '160b76c02e4130a4',
    dataHash: '96d41678c0af4aae',
    traceHash: '4a0fc926d239eb60',
    buildHash: '255047384ecaabac',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      'f2080bfd5877760628ee678a104ec544c9b999c4a8b756742c3d86e10cea8395',
    summaryHash:
      '5adf5248d1dfb31fef569d7be00782070cb85be11e54c65e0d99d29cfddcabe8',
    inputHash: 'fa49817b2171532e',
    dataHash: 'cc435872064bf403',
    traceHash: '33bf4c0426d6b26c',
    buildHash: 'c6a439fcfed6de41',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 79,
    replayHash:
      'ed5dd56bee71b05622c2f52b51e5844a7a468bff5dc00078fd089122babd507c',
    summaryHash:
      '137a834ffd2962fda13490990c7c3c89fd0668c62ebc33d4727d04f9f88b7bf6',
    inputHash: '5775907477155e9b',
    dataHash: 'bf95296e70356830',
    traceHash: '60c01c9d23a39f9c',
    buildHash: 'f331b6e77a40c8ca',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      '66bf4893e52cd56ef1899cf831a9d15ed17276d442a99d2cbdb7e30592a88bc2',
    summaryHash:
      'e9ecef3cacaa2bd6482ab5309542b9e84f7d8513f3e170be7a311656bae0cde9',
    inputHash: '52ffdee53626427a',
    dataHash: '484ac661a9136747',
    traceHash: '6193918349efd4ee',
    buildHash: '6073bef5edc2d5be',
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
      buildHash,
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
        buildHash,
        headlessAssumptionContracts: [],
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
