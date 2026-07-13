import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('runtime capture normalize CLI', () => {
  it('normalizes JSONL and refuses fixture provenance in production mode', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'promilia-capture-cli-'));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, 'capture.jsonl');
    const outputPath = join(directory, 'capture.normalized.json');
    const capture = createRecoverSpRuntimeSampleFixture();
    const jsonl = [
      JSON.stringify({
        recordType: 'capture-session',
        captureSessionId: capture.captureSessionId,
        clientRegion: 'TW',
        clientBuild: 'fixture-build',
        source: capture.source,
        captureKind: 'role-sp',
        binding: {
          actionId: 'action-0001',
          actorId: 'actor-109001',
          targetId: 'enemy-300032',
          slotId: null,
          kiboId: null,
          sourceElementConfigId: 109001081,
        },
      }),
      ...capture.events.map(event =>
        JSON.stringify({ recordType: 'event', ...event })
      ),
    ].join('\n');
    await writeFile(inputPath, jsonl, 'utf8');

    const scriptPath = resolve('scripts/normalize-runtime-capture.mjs');
    const normalizedRun = spawnSync(
      process.execPath,
      [scriptPath, '--input', inputPath, '--output', outputPath],
      { encoding: 'utf8' }
    );
    expect(normalizedRun.status).toBe(0);
    const output = JSON.parse(await readFile(outputPath, 'utf8'));
    expect(output).toMatchObject({
      type: 'runtime-sample-captures',
      summary: { captureCount: 1, eventCount: 6 },
      provenanceAudit: {
        status: 'production-runtime-captures-incomplete',
        realCaptureClaimAllowed: false,
      },
      captures: [
        expect.objectContaining({
          captureKind: 'role-sp',
          binding: expect.objectContaining({
            actionId: 'action-0001',
            actorId: 'actor-109001',
            sourceElementConfigId: 109001081,
          }),
        }),
      ],
    });

    const productionRun = spawnSync(
      process.execPath,
      [scriptPath, '--input', inputPath, '--require-production'],
      { encoding: 'utf8' }
    );
    expect(productionRun.status).toBe(2);
    expect(productionRun.stderr).toContain(
      'production-runtime-captures-incomplete'
    );
  });

  it('packs repeated inputs into one capture batch and rejects session collisions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'promilia-capture-batch-'));
    temporaryDirectories.push(directory);
    const firstInputPath = join(directory, 'role-capture.json');
    const secondInputPath = join(directory, 'kibo-capture.json');
    const outputPath = join(directory, 'six-resource-batch.json');
    const firstCapture = createRecoverSpRuntimeSampleFixture({
      captureSessionId: 'batch-role-capture-1',
    });
    const secondCapture = createRecoverSpRuntimeSampleFixture({
      captureSessionId: 'batch-role-capture-2',
      actorId: 'actor-101003',
      roleEntityId: 'runtime-role-101003',
    });
    await writeFile(firstInputPath, JSON.stringify(firstCapture), 'utf8');
    await writeFile(secondInputPath, JSON.stringify(secondCapture), 'utf8');

    const scriptPath = resolve('scripts/normalize-runtime-capture.mjs');
    const batchRun = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--input',
        firstInputPath,
        '--input',
        secondInputPath,
        '--output',
        outputPath,
      ],
      { encoding: 'utf8' }
    );
    expect(batchRun.status).toBe(0);
    expect(JSON.parse(batchRun.stdout)).toMatchObject({
      inputFileCount: 2,
      captureCount: 2,
      eventCount: 12,
    });
    const output = JSON.parse(await readFile(outputPath, 'utf8'));
    expect(output).toMatchObject({
      type: 'runtime-sample-captures',
      normalizedBy: 'promilia-axis-tool/runtime-capture-normalizer-v2',
      summary: {
        captureCount: 2,
        eventCount: 12,
        captureSessionIds: ['batch-role-capture-1', 'batch-role-capture-2'],
      },
      sourceFiles: [
        expect.objectContaining({
          path: expect.stringContaining('role-capture.json'),
        }),
        expect.objectContaining({
          path: expect.stringContaining('kibo-capture.json'),
        }),
      ],
    });
    expect(output.sourceFile).toBeUndefined();

    const collisionRun = spawnSync(
      process.execPath,
      [scriptPath, '--input', firstInputPath, '--input', firstInputPath],
      { encoding: 'utf8' }
    );
    expect(collisionRun.status).toBe(1);
    expect(collisionRun.stderr).toContain(
      'Duplicate captureSessionId across inputs: batch-role-capture-1'
    );
  });

  it('requires an isolated scope and complete binding for production output', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'promilia-capture-scope-'));
    temporaryDirectories.push(directory);
    const inputPath = join(directory, 'kibo-capture.json');
    const outputPath = join(directory, 'kibo-capture.normalized.json');
    const capture = {
      schemaVersion: 1,
      captureSessionId: 'controlled-kibo-scope-1',
      source: 'source-game-runtime-frida-controlled-session',
      clientRegion: 'TW',
      clientBuild: 'controlled-build-20260714',
      captureKind: 'kibo-energy',
      binding: {
        actionId: 'kibo-action-1',
        actorId: 'actor-109001',
        targetId: 'enemy-300032',
        slotId: 'team-slot-1',
        kiboId: 500001,
        sourceElementConfigId: null,
      },
      captureTool: {
        name: 'promilia-axis-controlled-frida-capture',
        version: '1.1.0',
        hookManifestId: 'azpr-tc-20260709-three-value-runtime-capture-v2',
      },
      events: [
        {
          captureSessionId: 'controlled-kibo-scope-1',
          eventType: 'pet-ultimate-cooldown-observed',
          timeMs: 100,
          actionId: 'kibo-action-1',
          actorId: 'actor-109001',
          targetId: 'enemy-300032',
          slotId: 'team-slot-1',
          kiboId: 500001,
          petEntityId: 70001,
          petEntityPointer: '0x12345678',
          api: 'PetUltimateCdTime',
          cdTime: 12,
          totalTime: 20,
          ready: false,
        },
      ],
    };
    await writeFile(inputPath, JSON.stringify(capture), 'utf8');

    const scriptPath = resolve('scripts/normalize-runtime-capture.mjs');
    const productionRun = spawnSync(
      process.execPath,
      [
        scriptPath,
        '--input',
        inputPath,
        '--output',
        outputPath,
        '--require-production',
      ],
      { encoding: 'utf8' }
    );
    expect(productionRun.status).toBe(0);
    expect(JSON.parse(productionRun.stdout)).toMatchObject({
      realCaptureClaimAllowed: true,
    });

    await writeFile(
      inputPath,
      JSON.stringify({ ...capture, captureKind: 'all' }),
      'utf8'
    );
    const legacyAllRun = spawnSync(
      process.execPath,
      [scriptPath, '--input', inputPath, '--require-production'],
      { encoding: 'utf8' }
    );
    expect(legacyAllRun.status).toBe(2);
    expect(legacyAllRun.stderr).toContain(
      'production-runtime-captures-incomplete'
    );
  });
});
