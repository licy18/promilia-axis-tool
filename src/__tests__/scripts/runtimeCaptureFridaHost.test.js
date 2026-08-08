import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('controlled Frida runtime capture host', () => {
  it('captures a controlled local process and keeps self-test data non-production', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'promilia-frida-host-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'capture.jsonl');
    const hostScript = resolve('scripts/capture-azpr-runtime.py');
    const captureRun = spawnSync(
      'python',
      [hostScript, '--self-test', '--output', outputPath],
      { encoding: 'utf8', timeout: 20_000 }
    );

    expect(captureRun.status).toBe(0);
    expect(captureRun.stdout).toContain('controlled-frida-self-test-passed');
    const records = (await readFile(outputPath, 'utf8'))
      .trim()
      .split(/\r?\n/u)
      .map(line => JSON.parse(line));
    expect(records[0]).toMatchObject({
      recordType: 'capture-session',
      source: 'controlled-frida-self-test',
      captureTool: {
        name: 'promilia-axis-controlled-frida-capture',
        version: '1.2.0',
        fridaVersion: expect.any(String),
      },
    });
    expect(
      records.filter(
        record => record.eventType === 'capture-agent-self-test-probe'
      )
    ).toHaveLength(4);
    expect(records.at(-1)).toMatchObject({
      recordType: 'capture-session-end',
      status: 'capture-complete',
      agentEmittedEventCount: 4,
      hostReceivedEventCount: 4,
      finalCaptureSequence: 4,
      diagnosticCount: 0,
      diagnostics: [],
    });

    const normalizer = resolve('scripts/normalize-runtime-capture.mjs');
    const productionRun = spawnSync(
      process.execPath,
      [normalizer, '--input', outputPath, '--require-production'],
      { encoding: 'utf8' }
    );
    expect(productionRun.status).toBe(2);
    expect(productionRun.stderr).toContain(
      'production-runtime-captures-incomplete'
    );
  }, 15_000);

  it('refuses a PID before attach without explicit controlled-session confirmation', () => {
    const hostScript = resolve('scripts/capture-azpr-runtime.py');
    const captureRun = spawnSync(
      'python',
      [
        hostScript,
        '--pid',
        String(process.pid),
        '--output',
        join(tmpdir(), 'must-not-be-created.jsonl'),
        '--action-id',
        'action-0001',
        '--actor-id',
        'actor-109001',
        '--target-id',
        'enemy-300032',
      ],
      { encoding: 'utf8', timeout: 10_000 }
    );

    expect(captureRun.status).not.toBe(0);
    expect(captureRun.stderr).toContain(
      'Refusing to attach without --confirm-controlled-session'
    );
  });

  it('performs a no-attach client preflight and preserves the formal blocker', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'promilia-preflight-'));
    temporaryDirectories.push(directory);
    const outputPath = join(directory, 'preflight.json');
    const hostScript = resolve('scripts/capture-azpr-runtime.py');
    const preflightRun = spawnSync(
      'python',
      [hostScript, '--preflight', '--output', outputPath],
      { encoding: 'utf8', timeout: 30_000 }
    );

    expect(preflightRun.status).toBe(0);
    const report = JSON.parse(await readFile(outputPath, 'utf8'));
    expect(report).toMatchObject({
      reportName: 'AzPrMachineAxisEnemyToughnessControlledCapturePreflight',
      phase: 'M12-B3-OPT-T3',
      realCaptureClaimAllowed: false,
      attachAttempted: false,
      automaticLaunchAttempted: false,
      antiCheatBypassAttempted: false,
      manifest: {
        manifestId: 'azpr-tc-20260709-three-value-runtime-capture-v3',
      },
      processProbe: {
        kind: 'frida-local-device-full-enumeration-no-attach',
      },
      character112001Probe: {
        status: 'blocked-no-real-controlled-action-executed',
        equivalentCallChainProofRequired: true,
      },
      formalGate: {
        formalReady: false,
        formalScore: null,
        blockerCode: 'machine-axis-enemy-settlement-client-order-open',
      },
    });
    expect(report.clientIdentities).toHaveLength(3);
    expect(report.clientIdentities.every(row => row.matches)).toBe(true);
  }, 30_000);

  it('validates isolated capture scopes before attempting an attach', () => {
    const hostScript = resolve('scripts/capture-azpr-runtime.py');
    const requiredArguments = [
      hostScript,
      '--pid',
      String(process.pid),
      '--output',
      join(tmpdir(), 'must-not-be-created.jsonl'),
      '--action-id',
      'action-0001',
      '--actor-id',
      'actor-109001',
      '--target-id',
      'enemy-300032',
      '--confirm-controlled-session',
    ];

    const missingKiboOwner = spawnSync(
      'python',
      [...requiredArguments, '--capture-kind', 'kibo-energy'],
      { encoding: 'utf8', timeout: 10_000 }
    );
    expect(missingKiboOwner.status).not.toBe(0);
    expect(missingKiboOwner.stderr).toContain(
      '--capture-kind kibo-energy requires --slot-id and --kibo-id'
    );

    const mixedRoleScope = spawnSync(
      'python',
      [
        ...requiredArguments,
        '--capture-kind',
        'role-sp',
        '--slot-id',
        'team-slot-1',
        '--kibo-id',
        '500001',
      ],
      { encoding: 'utf8', timeout: 10_000 }
    );
    expect(mixedRoleScope.status).not.toBe(0);
    expect(mixedRoleScope.stderr).toContain(
      '--slot-id and --kibo-id are not valid for --capture-kind role-sp'
    );
  });
});
