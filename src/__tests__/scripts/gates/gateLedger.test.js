import { readdir } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import {
  appendLedgerRecord,
  beginGateRun,
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
    ledger.records.push(
      record({
        gate: 'release-verify',
        dependencyFingerprint: 'release',
        summary: { smartCacheAuthority: TEST_AUTHORITY },
      }),
      record({ gate: 'bundle', dependencyFingerprint: 'bundle-v1' }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-fail',
        status: 'fail',
      }),
      record({
        gate: 'bundle',
        dependencyFingerprint: 'bundle-timeout',
        status: 'timeout',
      })
    );
    expect(
      findReusablePass({
        ledger,
        gate: 'bundle',
        dependencyFingerprint: 'bundle-v1',
        authority: TEST_AUTHORITY,
      })?.status
    ).toBe('pass');
    for (const fingerprint of ['bundle-fail', 'bundle-timeout', 'mismatch']) {
      expect(
        findReusablePass({
          ledger,
          gate: 'bundle',
          dependencyFingerprint: fingerprint,
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
        authority: TEST_AUTHORITY,
      })
    ).toBeNull();
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
