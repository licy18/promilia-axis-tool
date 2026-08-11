import { describe, expect, it, vi } from 'vitest';
import {
  RELEASE_EXTRA_GATE_NAMES,
  TRIAL_RELEASE_COMPONENTS,
  getGateDefinition,
} from '../../../../scripts/gates/gate-definitions.mjs';
import {
  createReleaseEvidenceProjectionRecords,
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

  it('projects only real same-HEAD stage PASS evidence from the final release', () => {
    const fixture = projectionFixture();
    const records = createReleaseEvidenceProjectionRecords(fixture);
    expect(records).toHaveLength(
      TRIAL_RELEASE_COMPONENTS.length + RELEASE_EXTRA_GATE_NAMES.length
    );
    expect(
      records.every(
        record =>
          record.status === 'pass' &&
          record.mode === 'executed' &&
          record.head === fixture.snapshot.head &&
          record.details.releaseRecordId === fixture.releaseRecord.recordId &&
          record.context === 'release-verify-stage-pass-projection'
      )
    ).toBe(true);
    expect(records.find(record => record.gate === 'bundle')).toMatchObject({
      dependencyFingerprint: 'fingerprint:bundle',
      details: {
        sourceGate: 'trial-release',
        sourceRecordId: 'source:trial-release',
      },
    });
    expect(records.find(record => record.gate === 'binding')).toMatchObject({
      details: {
        sourceGate: 'binding',
        sourceRecordId: 'source:binding',
      },
    });
  });

  it('refuses failed, interrupted or stale release projection sources', () => {
    const failed = projectionFixture();
    failed.stages.extraResults[0].status = 'fail';
    failed.stages.extraResults[0].record.status = 'fail';
    expect(() => createReleaseEvidenceProjectionRecords(failed)).toThrow(
      `release-projection-source-invalid:${RELEASE_EXTRA_GATE_NAMES[0]}`
    );

    const interrupted = projectionFixture();
    interrupted.stages.trialResult.status = 'interrupted';
    interrupted.stages.trialResult.record.status = 'interrupted';
    expect(() => createReleaseEvidenceProjectionRecords(interrupted)).toThrow(
      'release-projection-source-invalid:trial-release'
    );

    const stale = projectionFixture();
    stale.stages.extraResults[0].record.head = 'stale-head';
    expect(() => createReleaseEvidenceProjectionRecords(stale)).toThrow(
      `release-projection-source-invalid:${RELEASE_EXTRA_GATE_NAMES[0]}`
    );
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

function projectionFixture() {
  const authority = {
    fingerprintSchemaVersion: 2,
    dependencyMapVersion: 2,
    dependencyMapHash: 'map-hash',
    runnerHash: 'runner-hash',
  };
  const snapshot = {
    head: '0123456789abcdef',
    workingTreeFingerprint: 'working-tree',
    authority,
  };
  const gateNames = new Set([
    'release-verify',
    'trial-release',
    ...RELEASE_EXTRA_GATE_NAMES,
    ...TRIAL_RELEASE_COMPONENTS.map(component => component.gate),
  ]);
  const fingerprints = new Map(
    [...gateNames].map(gate => [
      gate,
      { gate, dependencyFingerprint: `fingerprint:${gate}` },
    ])
  );
  const scripts = [
    ...new Set(TRIAL_RELEASE_COMPONENTS.map(entry => entry.script)),
  ];
  const trial = executedResult({
    gate: 'trial-release',
    context: 'release-trial-release-uncached',
    snapshot,
    fingerprints,
  });
  trial.summary = {
    observedScripts: scripts,
    stageTimeline: scripts.map((script, index) => ({
      script,
      startedAt: `2026-08-11T00:00:${String(index).padStart(2, '0')}.000Z`,
      finishedAt: `2026-08-11T00:00:${String(index + 1).padStart(2, '0')}.000Z`,
      durationMs: 1000,
    })),
    testFull: { filesPassed: 1, filesTotal: 1, testsPassed: 1, testsTotal: 1 },
    productionPreview: { testsPassed: 1, testsTotal: 1 },
    productionBuild: { modulesTransformed: 1 },
  };
  trial.record.summary = trial.summary;
  const extraResults = RELEASE_EXTRA_GATE_NAMES.map(gate =>
    executedResult({
      gate,
      context: 'release-extra-formal-gate',
      snapshot,
      fingerprints,
    })
  );
  const stages = {
    status: 'pass',
    trialValidation: { valid: true, issues: [] },
    postflightValidation: { valid: true, issues: [] },
    trialResult: trial,
    extraResults,
  };
  const releaseDefinition = getGateDefinition('release-verify');
  const releaseRecord = {
    recordId: 'release-pass',
    gate: 'release-verify',
    status: 'pass',
    mode: 'executed',
    head: snapshot.head,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    dependencyFingerprint:
      fingerprints.get('release-verify').dependencyFingerprint,
    gateDefinitionVersion: releaseDefinition.version,
    command: 'npm run release:verify',
    context: 'final-release-authority-uncached',
    startedAt: '2026-08-11T00:00:00.000Z',
    finishedAt: '2026-08-11T00:01:00.000Z',
    durationMs: 60_000,
    exitCode: 0,
    stdoutComplete: true,
    reportParseStatus: 'complete',
    summary: { smartCacheAuthority: authority },
  };
  return {
    snapshot,
    fingerprints,
    stages,
    runtimeReports: {},
    releaseRecord,
  };
}

function executedResult({ gate, context, snapshot, fingerprints }) {
  const definition = getGateDefinition(gate);
  const record = {
    recordId: `source:${gate}`,
    gate,
    status: 'pass',
    mode: 'executed',
    head: snapshot.head,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    dependencyFingerprint: fingerprints.get(gate).dependencyFingerprint,
    gateDefinitionVersion: definition.version,
    command: `run ${gate}`,
    context,
    startedAt: '2026-08-11T00:00:00.000Z',
    finishedAt: '2026-08-11T00:01:00.000Z',
    durationMs: 60_000,
    exitCode: 0,
    stdoutComplete: true,
    reportParseStatus: 'complete',
    summary: {},
  };
  return {
    gate,
    status: 'pass',
    exitCode: 0,
    durationMs: 60_000,
    summary: {},
    record,
    reportParseStatus: 'complete',
    stdoutComplete: true,
  };
}
