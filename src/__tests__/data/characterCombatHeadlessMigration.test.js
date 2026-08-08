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
      'ccc6d42eb2dfe9281a158971d5c2044a2cd5cb9e551a8d84654d795420228cf0',
    summaryHash:
      '5732addb14644c9ab8872074987fc3e416159335153ebd624900c43d128d7426',
    inputHash: '8ebc66d991ea2de9',
    dataHash: '90297386319c28cc',
    traceHash: 'c07de9f8c5ed6e2c',
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 129,
    replayHash:
      'b491d74a89a3b2e47a0f9de215567506862608cf80559420ccb74af4e5761afc',
    summaryHash:
      '7230de690cf96352c554b0d07a27258d60fa059bcfa9f8406556aad1da457407',
    inputHash: '2ead74cda9823599',
    dataHash: '501f7ecc584383b8',
    traceHash: '47cece9ea6d70f54',
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 76,
    replayHash:
      '5a3f70cf2007b04e2958330330ffd2404b30ef783b20a89e256728ed95d7c5bd',
    summaryHash:
      'd2bbede6c86e81440b6fd16ed758f3d65b06751360580f44d5a360bd902a16f9',
    inputHash: '89236436344ccfdf',
    dataHash: '7c0206aab6793197',
    traceHash: 'e6c4bb0ab0ca3a20',
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
    replayHash:
      'b02b27541d2bd5fdab0361e3f6be8bd149e55a24e388217f20d007b4d7fffae4',
    summaryHash:
      'e37062e6cd73cfac6e81ff6140a403d9062fe6ed24d7722261e82665d9e8626a',
    inputHash: '1b0eef273f6c366c',
    dataHash: '4b8f8d251533f911',
    traceHash: '98933017cf441958',
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
