import { describe, expect, it } from 'vitest';
import { getGateDefinition } from '../../../../scripts/gates/gate-definitions.mjs';
import { planSmartGates } from '../../../../scripts/gates/gate-planner.mjs';
import {
  createAuthorityLedger,
  createSyntheticFingerprints,
  record,
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

  it('reuses README-safe evidence projected by the exact successful release run', () => {
    const changedFiles = ['README.md'];
    const ledger = createAuthorityLedger();
    const release = ledger.records.find(
      entry => entry.gate === 'release-verify'
    );
    const trial = record({
      gate: 'trial-release',
      dependencyFingerprint: 'stable:trial-release',
      gateDefinitionVersion: getGateDefinition('trial-release').version,
      recordId: 'trial-release-source',
      context: 'release-trial-release-uncached',
    });
    const projection = record({
      gate: 'bundle',
      dependencyFingerprint: 'stable:bundle',
      gateDefinitionVersion: getGateDefinition('bundle').version,
      recordId: 'bundle-release-projection',
      context: 'release-verify-stage-pass-projection',
      details: {
        evidenceProjection: 'release-verify-stage-pass-v1',
        releaseRecordId: release.recordId,
        releaseHead: release.head,
        releaseDependencyFingerprint: release.dependencyFingerprint,
        sourceGate: trial.gate,
        sourceRecordId: trial.recordId,
        sourceDependencyFingerprint: trial.dependencyFingerprint,
        sourceGateDefinitionVersion: trial.gateDefinitionVersion,
      },
    });
    ledger.records = ledger.records.filter(entry => entry.gate !== 'bundle');
    ledger.records.push(trial, projection);
    const plan = planSmartGates({
      changedFiles,
      fingerprints: createSyntheticFingerprints(changedFiles),
      ledger,
      authority: TEST_AUTHORITY,
    });
    expect(find(plan, 'bundle')).toMatchObject({
      decision: 'reuse',
      reusable: { recordId: 'bundle-release-projection' },
    });
    expect(plan.releaseStatus).toBe('not-evaluated');
    expect(plan.formalSearchStatus).toBe('unchanged-not-authoritative');
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
