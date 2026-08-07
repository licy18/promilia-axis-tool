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
      'aab4c3a74b1ae0f27ffd833eecdd584653e3fa5fea3581a0a85ebc4ba5372679',
    summaryHash:
      '89737fcbe41831dcb2f85c0cce77ff1732e19518e025ac7a179327a695f65037',
    inputHash: 'a29f2ecaf7bec75a',
    dataHash: 'aa32636eb0c83348',
    traceHash: '109c6a9ed73ad56b',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      '8aba5762bbcf2326c2049e0ee408887241a1c36baf31074f31efb3aa4942e223',
    summaryHash:
      'a5ae7f54b16b1e4f4d66624dd461004e3096a6045c1d239c98fd06b7a38a5d3e',
    inputHash: 'd1e79d47cb7e17dc',
    dataHash: '416aa3c693807990',
    traceHash: '1dfb240529cc44d9',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      'be986e6648ec38b42af6a4ae86d87c0624939d0693fb60e9fa16303bbee206bc',
    summaryHash:
      'c2358859afc8d8f07927de195502340474056d9bfb0fb2eab709e1712ac2bea1',
    inputHash: '6ee4ea193ceb5f42',
    dataHash: '8ade710a085ff201',
    traceHash: '477ec7bd6ffe16a0',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      'c123b54f01765293871efa8e770e2236996f24914436fb91f44c1ec5f14decca',
    summaryHash:
      'f6c2c3369f3490c81f3b213dc94caf36798bc16af953f9e78a498887ca499aab',
    inputHash: 'b718f9c2fa3293b7',
    dataHash: '7e12e0bdde826807',
    traceHash: '49b59f7b7ad23640',
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
