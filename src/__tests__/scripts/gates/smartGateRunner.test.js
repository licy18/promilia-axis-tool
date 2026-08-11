import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeSmartGatePlan } from '../../../../scripts/gates/gate-runner.mjs';
import { record } from './gateTestHelpers';

const temporaryDirectories = [];

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('smart gate runner', () => {
  it('executes required gates and records explicit reuse separately', async () => {
    const root = await temporaryRoot();
    const sourceRecord = record({
      gate: 'bundle',
      dependencyFingerprint: 'bundle',
    });
    const plan = {
      integration: false,
      decisions: [
        decision('runtime-targeted', 'run'),
        {
          ...decision('bundle', 'reuse'),
          reusable: sourceRecord,
          reasons: ['matching pass'],
        },
      ],
    };
    const gateRunner = vi.fn(async ({ definition }) => ({
      gate: definition.name,
      status: 'pass',
      exitCode: 0,
      durationMs: 10,
      stdoutComplete: true,
      output: '',
      summary: null,
      record: record({
        gate: definition.name,
        dependencyFingerprint: definition.name,
      }),
    }));
    const result = await executeSmartGatePlan({
      repositoryRoot: root,
      plan,
      fingerprints: fingerprintMap(['runtime-targeted', 'bundle']),
      snapshot: snapshot(),
      tee: false,
      gateRunner,
    });
    expect(result.status).toBe('pass');
    expect(gateRunner).toHaveBeenCalledTimes(1);
    expect(result.results.map(entry => entry.mode)).toEqual([
      'executed',
      'reused',
    ]);
    expect(result.results[1].record).toMatchObject({
      gate: 'bundle',
      status: 'pass',
      mode: 'reused',
      reusedFromRecordId: sourceRecord.recordId,
      exitCode: null,
    });
  });

  it('stops after the first mandatory gate failure', async () => {
    const root = await temporaryRoot();
    const plan = {
      integration: false,
      decisions: [decision('first', 'run'), decision('second', 'run')],
    };
    const gateRunner = vi.fn(async ({ definition }) => ({
      gate: definition.name,
      status: 'fail',
      exitCode: 7,
      durationMs: 1,
      record: record({
        gate: definition.name,
        dependencyFingerprint: definition.name,
        status: 'fail',
      }),
    }));
    const result = await executeSmartGatePlan({
      repositoryRoot: root,
      plan,
      fingerprints: fingerprintMap(['first', 'second']),
      snapshot: snapshot(),
      tee: false,
      gateRunner,
    });
    expect(result).toMatchObject({
      status: 'fail',
      exitCode: 7,
      failedGate: 'first',
    });
    expect(gateRunner).toHaveBeenCalledTimes(1);
  });
});

function decision(name, action) {
  return {
    gate: name,
    decision: action,
    dependencyFingerprint: name,
    reasons: [],
    definition: {
      name,
      version: 1,
      covers: [],
      command: { timeoutMs: 1000, steps: [{ file: 'node', args: [] }] },
    },
  };
}

function fingerprintMap(names) {
  return new Map(
    names.map(name => [name, { gate: name, dependencyFingerprint: name }])
  );
}

function snapshot() {
  return {
    head: 'head',
    workingTreeFingerprint: 'tree',
  };
}

async function temporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azpr-smart-runner-'));
  temporaryDirectories.push(root);
  return root;
}
