import { readdir } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import {
  appendLedgerRecord,
  beginGateRun,
  completeGateRunWithRecords,
  createEmptyLedger,
  findReusablePass,
  readLedger,
  recoverInterruptedRuns,
  resolveLedgerPaths,
  validateLedger,
} from '../../../../scripts/gates/gate-ledger.mjs';
import { TEST_AUTHORITY, record } from './gateTestHelpers';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('gate ledger', () => {
  it('writes valid records atomically without leaving a temporary file', async () => {
    const root = await temporaryRoot();
    const stored = await appendLedgerRecord({
      repositoryRoot: root,
      record: record({ gate: 'bundle', dependencyFingerprint: 'bundle-v1' }),
    });
    const ledger = await readLedger({ repositoryRoot: root });
    expect(ledger.records).toContainEqual(stored);
    const files = await readdir(resolveLedgerPaths(root).directory);
    expect(files.some(file => file.endsWith('.tmp'))).toBe(false);
    expect(files).not.toContain('.gate-ledger.lock');
  });

  it('reuses only executed PASS with exact fingerprint and valid authority', () => {
    const ledger = createEmptyLedger();
    const rejected = [
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-fail',
        status: 'fail',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-interrupted',
        status: 'interrupted',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-timeout',
        status: 'timeout',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-oom',
        status: 'oom',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-cancelled',
        status: 'cancelled',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-reused',
        mode: 'reused',
        exitCode: 0,
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-nonzero',
        exitCode: 9,
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-incomplete',
        stdoutComplete: false,
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-unparsed',
        reportParseStatus: 'invalid',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-version',
        gateDefinitionVersion: 2,
      }),
    ];
    ledger.records.push(
      record({
        gate: 'release-verify',
        dependencyFingerprint: 'release',
        summary: { smartCacheAuthority: TEST_AUTHORITY },
      }),
      record({ gate: 'bundle', dependencyFingerprint: 'bundle-v1' }),
      ...rejected
    );
    expect(
      findReusablePass({
        ledger,
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        gateDefinitionVersion: 1,
        authority: TEST_AUTHORITY,
      })?.status
    ).toBe('pass');
    for (const fingerprint of [
      ...rejected.map(entry => entry.dependencyFingerprint),
      'mismatch',
    ]) {
      expect(
        findReusablePass({
          ledger,
          gate: 'bundle',
          dependencyFingerprint: fingerprint,
          gateDefinitionVersion: 1,
          authority: TEST_AUTHORITY,
        })
      ).toBeNull();
    }
  });

  it('reuses a release projection only with its exact successful same-HEAD release and source', () => {
    const ledger = createEmptyLedger();
    const release = record({
      gate: 'release-verify',
      dependencyFingerprint: 'release-v1',
      summary: { smartCacheAuthority: TEST_AUTHORITY },
      recordId: 'release-pass',
    });
    const source = record({
      gate: 'trial-release',
      dependencyFingerprint: 'trial-v1',
      gateDefinitionVersion: 3,
      recordId: 'trial-pass',
      context: 'release-trial-release-uncached',
    });
    const projection = record({
      gate: 'bundle',
      dependencyFingerprint: 'bundle-v1',
      recordId: 'bundle-projection',
      context: 'release-verify-stage-pass-projection',
      details: {
        evidenceProjection: 'release-verify-stage-pass-v1',
        releaseRecordId: release.recordId,
        releaseHead: release.head,
        releaseDependencyFingerprint: release.dependencyFingerprint,
        sourceGate: source.gate,
        sourceRecordId: source.recordId,
        sourceDependencyFingerprint: source.dependencyFingerprint,
        sourceGateDefinitionVersion: source.gateDefinitionVersion,
      },
    });
    ledger.records.push(release, source, projection);
    expect(
      findReusablePass({
        ledger,
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        gateDefinitionVersion: 1,
        authority: TEST_AUTHORITY,
      })?.recordId
    ).toBe('bundle-projection');

    const interruptedSource = structuredClone(ledger);
    interruptedSource.records.find(
      entry => entry.recordId === source.recordId
    ).status = 'interrupted';
    expect(
      findReusablePass({
        ledger: interruptedSource,
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        gateDefinitionVersion: 1,
        authority: TEST_AUTHORITY,
      })
    ).toBeNull();

    const staleSource = structuredClone(ledger);
    staleSource.records.find(entry => entry.recordId === source.recordId).head =
      'different-head';
    expect(
      findReusablePass({
        ledger: staleSource,
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        gateDefinitionVersion: 1,
        authority: TEST_AUTHORITY,
      })
    ).toBeNull();
  });

  it('never reuses provisional release-stage PASS records directly', () => {
    const ledger = createEmptyLedger();
    ledger.records.push(
      record({
        gate: 'release-verify',
        dependencyFingerprint: 'release',
        summary: { smartCacheAuthority: TEST_AUTHORITY },
      }),
      record({
        gate: 'binding',
        dependencyFingerprint: 'binding-v1',
        context: 'release-extra-formal-gate',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        context: 'executed-within-test:trial-release',
      })
    );
    for (const [gate, dependencyFingerprint] of [
      ['binding', 'binding-v1'],
      ['bundle', 'bundle-v1'],
    ]) {
      expect(
        findReusablePass({
          ledger,
          gate,
          dependencyFingerprint,
          gateDefinitionVersion: 1,
          authority: TEST_AUTHORITY,
        })
      ).toBeNull();
    }
  });

  it('rejects a ledger schema version mismatch', () => {
    const ledger = createEmptyLedger();
    ledger.schemaVersion = 999;
    expect(validateLedger(ledger).valid).toBe(false);
    expect(
      findReusablePass({
        ledger,
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        gateDefinitionVersion: 1,
        authority: TEST_AUTHORITY,
      })
    ).toBeNull();
  });

  it('does not write a primary PASS when an atomic related record is invalid', async () => {
    const root = await temporaryRoot();
    const pending = await beginGateRun({
      repositoryRoot: root,
      gate: 'release-verify',
      head: 'head',
      workingTreeFingerprint: 'tree',
      dependencyFingerprint: 'release-v1',
      gateDefinitionVersion: 1,
      command: 'npm run release:verify',
    });
    await expect(
      completeGateRunWithRecords({
        repositoryRoot: root,
        pending,
        status: 'pass',
        exitCode: 0,
        relatedRecords: [
          record({
            gate: 'bundle',
            dependencyFingerprint: 'bundle-v1',
            status: 'running',
          }),
        ],
      })
    ).rejects.toMatchObject({ code: 'gate-record-status-invalid' });
    expect((await readLedger({ repositoryRoot: root })).records).toEqual([]);
  });

  it('recovers an abandoned pending run as interrupted, never PASS', async () => {
    const root = await temporaryRoot();
    const pending = await beginGateRun({
      repositoryRoot: root,
      gate: 'test-full',
      head: 'head',
      workingTreeFingerprint: 'tree',
      dependencyFingerprint: 'full-v1',
      gateDefinitionVersion: 3,
      command: 'npm run test:full',
      startedAt: '2026-08-11T00:00:00.000Z',
    });
    expect(pending.status).toBe('running');
    const recovered = await recoverInterruptedRuns({
      repositoryRoot: root,
      staleMs: 0,
      now: new Date('2026-08-11T00:01:00.000Z'),
    });
    expect(recovered).toHaveLength(1);
    expect(recovered[0]).toMatchObject({
      gate: 'test-full',
      status: 'interrupted',
      mode: 'executed',
      stdoutComplete: false,
    });
    const ledger = await readLedger({ repositoryRoot: root });
    expect(ledger.records.some(entry => entry.status === 'pass')).toBe(false);
  });
});

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azpr-ledger-'));
  temporaryDirectories.push(root);
  return root;
}
