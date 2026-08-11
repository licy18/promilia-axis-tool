import { describe, expect, it } from 'vitest';
import { planSmartGates } from '../../../../scripts/gates/gate-planner.mjs';
import {
  createAuthorityLedger,
  createSyntheticFingerprints,
  TEST_AUTHORITY,
} from './gateTestHelpers';

describe('smart gate planner', () => {
  it('forces test:full for an unknown file even when an old fingerprint matches', () => {
    const changedFiles = ['unmapped/new-contract.bin'];
    const plan = planSmartGates({
      changedFiles,
      fingerprints: createSyntheticFingerprints(changedFiles),
      ledger: createAuthorityLedger(),
      authority: TEST_AUTHORITY,
    });
    expect(plan.unknownEscalation).toBe(true);
    expect(find(plan, 'test-full').decision).toBe('run');
    expect(find(plan, 'determinism').decision).toBe('run');
    expect(find(plan, 'production-imports').decision).toBe('run');
  });

  it('disables all reuse until an executed release establishes cache authority', () => {
    const changedFiles = ['README.md'];
    const ledger = createAuthorityLedger();
    ledger.records = ledger.records.filter(
      record => record.gate !== 'release-verify'
    );
    const plan = planSmartGates({
      changedFiles,
      fingerprints: createSyntheticFingerprints(changedFiles),
      ledger,
      authority: TEST_AUTHORITY,
    });
    expect(plan.cacheAuthorityReady).toBe(false);
    expect(find(plan, 'bundle').decision).not.toBe('reuse');
  });

  it('makes test:full an integration checkpoint only when requested', () => {
    const changedFiles = ['src/simulation/engine.js'];
    const common = {
      changedFiles,
      fingerprints: createSyntheticFingerprints(changedFiles),
      ledger: createAuthorityLedger(),
      authority: TEST_AUTHORITY,
    };
    expect(find(planSmartGates(common), 'test-full').decision).toBe(
      'invalidated'
    );
    expect(
      find(planSmartGates({ ...common, integration: true }), 'test-full')
        .decision
    ).toBe('run');
  });
});

function find(plan, gate) {
  return plan.decisions.find(entry => entry.gate === gate);
}
