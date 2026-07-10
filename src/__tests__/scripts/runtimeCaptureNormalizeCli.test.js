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
});
