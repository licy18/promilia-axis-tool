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
    inputHash: '50e9b000cb6c8d96',
    dataHash: '4ce7bf2672749053',
    traceHash: '64d646fe576c5f5b',
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
    inputHash: 'f9ffca84cea3ba89',
    dataHash: '2116e79e15e36204',
    traceHash: '57d9081f5ebb7033',
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
    inputHash: '71c0dfb5d1fbcaf2',
    dataHash: '2225ab49d757d999',
    traceHash: 'c89f471aba34d155',
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
    inputHash: '1f906a7891b50bf5',
    dataHash: '36af074a9375f5ba',
    traceHash: '84245b266485761a',
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
