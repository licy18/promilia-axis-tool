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
      '01fb85c9b3309dab076a7e222dc4f490beb6e4168e2ea50302df65db7de697e9',
    summaryHash:
      '6fa24e7026a9372b1eb57c094b5b3c726bf012953b92cc965359f8072b350cb3',
    inputHash: 'd06f95049d890d66',
    dataHash: '2152b959f23227e3',
    traceHash: '23c301eb7b6d9e8f',
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
    inputHash: '6c9ff10a10bf1a99',
    dataHash: '92b789c56ea4d314',
    traceHash: '3aae9355bcf3230f',
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
    inputHash: 'bdb1c3d123b791a2',
    dataHash: '2b9a3af2d4170de9',
    traceHash: '3f2eb9c062a3201b',
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
    inputHash: '4cabc725c2ed7eda',
    dataHash: 'b1105b9a085035ff',
    traceHash: 'a9e1ac0fe202f573',
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
