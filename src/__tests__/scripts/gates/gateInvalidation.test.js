import { describe, expect, it } from 'vitest';
import { planSmartGates } from '../../../../scripts/gates/gate-planner.mjs';
import {
  createAuthorityLedger,
  createSyntheticFingerprints,
  TEST_AUTHORITY,
} from './gateTestHelpers';

describe('gate invalidation matrix', () => {
  it('keeps release component fingerprints reusable for README-only changes', () => {
    const plan = scenario(['README.md']);
    for (const gate of [
      'test-full',
      'determinism',
      'bundle',
      'production-preview',
      'qualification',
      'binding',
    ]) {
      expect(decision(plan, gate).decision).toBe('reuse');
    }
  });

  it('runs runtime and determinism gates while deferring invalidated full and preview', () => {
    const plan = scenario(['src/simulation/engine.js']);
    expect(decision(plan, 'runtime-targeted').decision).toBe('run');
    expect(decision(plan, 'determinism').decision).toBe('run');
    expect(decision(plan, 'test-full').decision).toBe('invalidated');
    expect(decision(plan, 'production-preview').decision).toBe('invalidated');
    expect(decision(plan, 'workbench-targeted').decision).not.toBe('run');
  });

  it('requires Vite config build/import/bundle/preview gates without duplicate build', () => {
    const plan = scenario(['vite.config.js']);
    expect(decision(plan, 'production-imports').decision).toBe('run');
    expect(decision(plan, 'bundle').decision).toBe('run');
    expect(decision(plan, 'production-preview').decision).toBe('run');
    expect(decision(plan, 'production-build')).toMatchObject({
      decision: 'covered',
      coveredBy: 'production-preview',
    });
    expect(decision(plan, 'test-full').decision).toBe('invalidated');
  });

  it('requires acceptance, qualification and binding gates for recipe changes', () => {
    const plan = scenario(['acceptance-recipes/109001.json']);
    expect(decision(plan, 'acceptance-targeted').decision).toBe('run');
    expect(decision(plan, 'character-acceptance').decision).toBe('run');
    expect(decision(plan, 'qualification').decision).toBe('run');
    expect(decision(plan, 'binding').decision).toBe('run');
    expect(decision(plan, 'test-full').decision).toBe('invalidated');
  });

  it('invalidates production preview for its shared helper', () => {
    const plan = scenario(['e2e/helpers/workbench.js']);
    expect(decision(plan, 'production-preview').decision).toBe('run');
  });

  it('treats the real singular store directory as Workbench production code', () => {
    const plan = scenario(['src/store/projectStore.js']);
    expect(decision(plan, 'workbench-targeted').decision).toBe('run');
    expect(decision(plan, 'production-preview').decision).toBe('run');
  });

  it('invalidates formal gates for generated authority changes', () => {
    const plan = scenario([
      'src/data/generated/verified-combat-mechanics-package.json',
    ]);
    expect(decision(plan, 'verified-mechanics').decision).toBe('run');
    expect(decision(plan, 'qualification').decision).toBe('run');
    expect(decision(plan, 'binding').decision).toBe('run');
    expect(decision(plan, 'determinism').decision).toBe('run');
  });

  it('does not invalidate bundle or preview for a headless-only test change', () => {
    const plan = scenario(['src/__tests__/simulation/engine.test.js']);
    expect(decision(plan, 'runtime-targeted').decision).toBe('run');
    expect(decision(plan, 'test-full').decision).toBe('invalidated');
    expect(decision(plan, 'bundle').decision).toBe('reuse');
    expect(decision(plan, 'production-preview').decision).toBe('reuse');
  });
});

function scenario(changedFiles) {
  return planSmartGates({
    changedFiles,
    fingerprints: createSyntheticFingerprints(changedFiles),
    ledger: createAuthorityLedger(),
    authority: TEST_AUTHORITY,
  });
}

function decision(plan, gate) {
  return plan.decisions.find(entry => entry.gate === gate);
}
