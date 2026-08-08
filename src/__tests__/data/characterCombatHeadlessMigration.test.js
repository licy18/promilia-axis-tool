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
      '26aaa8a3e5e27460e0620237e3d40b214fdc38aae505f6fcd2d9c64c91363986',
    summaryHash:
      '4abce4c493c62abb438539f1713995bf4a152cec9e7c9fd0c3ef6171cd83aa59',
    inputHash: '5034bcb6d4717107',
    dataHash: '417fabe5ad1fd6a5',
    traceHash: '63ab54e791aeab54',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      'e7997aced40f791548145878f3a0a55d5defd52c2fba76c48d34b73068ae622f',
    summaryHash:
      'cd9f6155e9a6a1a0a5602dfe2d5e1798faa2afdb07cd1a70fae364127dc5d24e',
    inputHash: '2a6fa447c8fd06b3',
    dataHash: 'b706fa0ec241c68d',
    traceHash: 'da1afb199b8417d5',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      'de1d24f62d91b0774d1a73dbc20f96ecfa09edfaaf245408fb9c99939b509edb',
    summaryHash:
      'c263fdd808d0df74a702d0954738c346c1b593f8cc799ac4c1d5e2e04855b02c',
    inputHash: 'cfae9af52953b6e9',
    dataHash: 'cf1c9a13bdaa75f4',
    traceHash: '6dbd3af52001dff3',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      '1cdb4c82ad75b173e11d596dbf76ba76f0187fe4f84a497a52a135596d11c706',
    summaryHash:
      '31344a4cfa21a07ac4d700378ed5cb1745833ce9f9f2675d902c4e5da4a32c41',
    inputHash: 'a1ee7b9ed1e9cb15',
    dataHash: '0651926d20fa7c01',
    traceHash: '0815a3a269b240a1',
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
