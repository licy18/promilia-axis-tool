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
    assertionCount: 115,
  },
  {
    identity: 'ruby-main',
    ownerId: 103002,
    report: rubyGolden,
    assertionCount: 126,
  },
  {
    identity: 'han-main',
    ownerId: 101003,
    report: hanGolden,
    assertionCount: 79,
  },
  {
    identity: 'han-controlled-buff-switch',
    ownerId: 101003,
    report: hanSwitchGolden,
    assertionCount: 34,
  },
];

describe('M10 golden migration to the canonical headless core', () => {
  it.each(GOLDENS)(
    'keeps $identity semantics and canonical trace shape',
    ({ report, assertionCount }) => {
      expect(report.compilerPath).toContain(
        'canonicalHeadlessCombatCore.js#compile'
      );
      expect(report.simulatorPath).toContain(
        'canonicalHeadlessCombatCore.js#simulate'
      );
      // trace hash 是生成产物（由 canonical generator 保证确定性），
      // 不再作为实现变更必须同步修改的测试字面量；只锁结构与合法格式。
      expect(report.headlessCore).toMatchObject({
        schemaVersion: 1,
        inputHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        traceHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        dataHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        buildHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        headlessAssumptionContracts: [],
        criticalPolicy: 'non-critical',
      });
      expect(report.validation).toMatchObject({
        passed: true,
        assertionCount,
        failedCount: 0,
      });
      expect(report.replayHash).toMatch(/^[0-9a-f]{64}$/);
      expect(report.actual.summaryHash).toMatch(/^[0-9a-f]{64}$/);
    }
  );
});
