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
      '6116403b716199f9b835627f3d707a7bacf54ad29b4b7549400dde64f52e2a8a',
    summaryHash:
      '7734c54cbff4b765cf248e776162f7ad93c2e5f6f296bdca529646c7d32c8067',
    inputHash: '061a4b8d630f2664',
    dataHash: '3f0a82005e5147ee',
    traceHash: '31429341f1f3f9bd',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      '69b7953d865d593c5310d0dc08e3d5e9e3c73cfa9c8040f13f9fd9d07e451afa',
    summaryHash:
      'b73ba11734f9f39ae6ada33624eb3786d3e27c60336588fd35977f2124b260d7',
    inputHash: 'f06ad3fbef760e0e',
    dataHash: 'b04cbb475d9cbe36',
    traceHash: 'eb0474efb2bd750a',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      'fc391def671c55dc5c271c801942268821d5eacfdab7f1267a737621d616f808',
    summaryHash:
      '92b9880ed461f4554911fc08fdb4cdc2415e8bef7d346cad9c92aa839cad3741',
    inputHash: '2cbc479ba36a0538',
    dataHash: '9ee79f5feb60cf73',
    traceHash: '9deb543b1483e6fc',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      'dc1f99b2cef185c7a214b7cf4fcfbe1294df7aacf39b82c7e09ae204fbd67665',
    summaryHash:
      'e0a83f2a3d0b9fed9e86f1910a365bf46e7f26eb6f7eaa39a1ab5009c0cf5803',
    inputHash: '43d0ddef9d826fcc',
    dataHash: 'ca1b6e00aea3ac82',
    traceHash: '30a0035a57cfab2b',
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
