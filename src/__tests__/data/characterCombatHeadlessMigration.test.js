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
    inputHash: 'f57a978c56945d0f',
    dataHash: 'e45ba77f46e6d18c',
    traceHash: 'b3d7589489c8491f',
    buildHash: '2e47b46f77324981',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      '198d3e8ca71f63745d559a39db58d6bcf311f877cf0ebefcd9c58088491edc09',
    summaryHash:
      '584a158a1c13856d3f4adaa4c01f5e0ece2d6dd768b075a5b2c734a78814d61f',
    inputHash: '054646b15271c227',
    dataHash: '81defb9df10a8d00',
    traceHash: '009006900b786a7f',
    buildHash: '65ecbb5d6a053502',
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
    inputHash: 'ef3608e8332e2f7d',
    dataHash: 'd7ada9b396911b3e',
    traceHash: '058b8b09c4d2ed3e',
    buildHash: '4d00ec6cba8f7faf',
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
    inputHash: 'a5247572cdbdc6b2',
    dataHash: '69d3276d6c4950a6',
    traceHash: 'c08af1a97df57662',
    buildHash: 'a6d8592a8bdc47bb',
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
