import { describe, expect, it, vi } from 'vitest';
import {
  executeMandatoryReleaseStages,
  validateReleasePostflight,
  validateReleaseScriptIntegrity,
} from '../../../../scripts/release-verify.mjs';

describe('release verify orchestration', () => {
  it('rejects a cached trial-release PASS and still invokes the real stage once', async () => {
    const runTrialRelease = vi.fn(async () => trialResult('pass', 'reused'));
    const result = await executeMandatoryReleaseStages({
      extraGateNames: [],
      runExtraGate: vi.fn(),
      runTrialRelease,
      validateTrialRelease: () => ({ valid: true, issues: [] }),
      readPostflight: vi.fn(),
      validatePostflight: vi.fn(),
      loadAdmission: vi.fn(),
    });
    expect(runTrialRelease).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      status: 'fail',
      failureStage: 'trial-release-cache-rejected',
    });
  });

  it('executes formal extras then one real trial release before admission', async () => {
    const calls = [];
    const result = await executeMandatoryReleaseStages({
      extraGateNames: ['binding', 'kibo-headless'],
      runExtraGate: vi.fn(async gate => {
        calls.push(gate);
        return { gate, status: 'pass', exitCode: 0 };
      }),
      runTrialRelease: vi.fn(async () => {
        calls.push('trial-release');
        return trialResult('pass', 'executed');
      }),
      validateTrialRelease: () => ({ valid: true, issues: [] }),
      readPostflight: async () => ({ head: 'head', trackedClean: true }),
      validatePostflight: () => ({ valid: true, issues: [] }),
      loadAdmission: async () => {
        calls.push('admission');
        return { ready: true, status: 'ready', blockers: [] };
      },
    });
    expect(result.status).toBe('pass');
    expect(calls).toEqual([
      'binding',
      'kibo-headless',
      'trial-release',
      'admission',
    ]);
  });

  it('propagates a non-zero trial release without evaluating admission', async () => {
    const loadAdmission = vi.fn();
    const result = await executeMandatoryReleaseStages({
      extraGateNames: [],
      runExtraGate: vi.fn(),
      runTrialRelease: async () => trialResult('fail', 'executed', 9),
      validateTrialRelease: () => ({ valid: true, issues: [] }),
      readPostflight: vi.fn(),
      validatePostflight: vi.fn(),
      loadAdmission,
    });
    expect(result.status).toBe('fail');
    expect(result.result.exitCode).toBe(9);
    expect(loadAdmission).not.toHaveBeenCalled();
  });

  it('keeps original full and trial-release strength in the package contract', () => {
    const scripts = {
      'test:full': 'vitest run',
      'test:trial-release':
        'npm run test -- --run && npm run audit:production-imports:check && npm run audit:workbench-data:check && npm run audit:action-status:check && npm run audit:verified-combat && npm run audit:optimization-scenario-policy && npm run audit:character-acceptance && npm run audit:optimization-qualification && npm run audit:bundle:check && npm run test:e2e:production-preview && git diff --check',
    };
    expect(validateReleaseScriptIntegrity(scripts)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it('fails postflight if HEAD, tracked state or stash changes', () => {
    const result = validateReleasePostflight({
      preflight: { head: 'a', stashTop: 'stash-a' },
      postflight: {
        head: 'b',
        stashTop: 'stash-b',
        trackedClean: false,
        trackedDirtyFiles: ['reports/bundle-composition.json'],
      },
    });
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual([
      'head-changed-during-release',
      'tracked-drift:reports/bundle-composition.json',
      'stash-top-changed',
    ]);
  });
});

function trialResult(status, mode, exitCode = status === 'pass' ? 0 : 1) {
  return {
    gate: 'trial-release',
    status,
    exitCode,
    stdoutComplete: true,
    summary: { stageTimeline: [] },
    record: {
      mode,
      startedAt: '2026-08-11T00:00:00.000Z',
      finishedAt: '2026-08-11T00:01:00.000Z',
    },
  };
}
