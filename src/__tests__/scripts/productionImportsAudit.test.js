import { spawnSync } from 'node:child_process';
import {
  access,
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const scriptPath = resolve('scripts/audit-production-imports.mjs');
const committedReportPath = resolve('reports/production-import-audit.json');
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('production imports audit CLI', () => {
  it('writes only changed canonical output in generation mode', async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(
      directory,
      'nested',
      'production-import-audit.json'
    );

    const generated = runAudit(['--output', outputPath]);
    expect(generated.status).toBe(0);
    expect(JSON.parse(generated.stdout)).toMatchObject({
      reportMatches: true,
      outputChanged: true,
    });
    const canonicalBytes = await readFile(outputPath);

    const frozenTime = new Date('2001-01-01T00:00:00.000Z');
    await utimes(outputPath, frozenTime, frozenTime);
    const before = await stat(outputPath);
    const repeated = runAudit(['--output', outputPath]);
    const after = await stat(outputPath);

    expect(repeated.status).toBe(0);
    expect(JSON.parse(repeated.stdout)).toMatchObject({
      reportMatches: true,
      outputChanged: false,
    });
    expect(await readFile(outputPath)).toEqual(canonicalBytes);
    expect(after.mtimeMs).toBe(before.mtimeMs);
  }, 30_000);

  it('rejects stale, tampered, or missing assert-clean output without writing', async () => {
    const directory = await createTemporaryDirectory();
    const outputPath = join(directory, 'production-import-audit.json');
    expect(runAudit(['--output', outputPath]).status).toBe(0);
    const canonicalBytes = await readFile(outputPath);

    const cleanTime = new Date('2002-02-02T00:00:00.000Z');
    await utimes(outputPath, cleanTime, cleanTime);
    const cleanBefore = await stat(outputPath);
    const clean = runAudit(['--assert-clean', '--output', outputPath]);
    const cleanAfter = await stat(outputPath);
    expect(clean.status).toBe(0);
    expect(JSON.parse(clean.stdout)).toMatchObject({
      reportMatches: true,
      outputChanged: false,
    });
    expect(await readFile(outputPath)).toEqual(canonicalBytes);
    expect(cleanAfter.mtimeMs).toBe(cleanBefore.mtimeMs);

    const tamperedBytes = Buffer.concat([
      canonicalBytes,
      Buffer.from('tampered-without-changing-the-source-graph\n'),
    ]);
    await writeFile(outputPath, tamperedBytes);
    const tamperedTime = new Date('2003-03-03T00:00:00.000Z');
    await utimes(outputPath, tamperedTime, tamperedTime);
    const tamperedBefore = await stat(outputPath);
    const tampered = runAudit(['--assert-clean', '--output', outputPath]);
    const tamperedAfter = await stat(outputPath);
    expect(tampered.status).toBe(1);
    expect(tampered.stderr).toContain('production-import-audit-report-drift');
    expect(tampered.stderr).toContain(
      'production-import-audit-report-bytes-mismatch'
    );
    expect(tampered.stderr).toContain('"assertCleanReadOnly": true');
    expect(await readFile(outputPath)).toEqual(tamperedBytes);
    expect(tamperedAfter.mtimeMs).toBe(tamperedBefore.mtimeMs);

    const missingPath = join(directory, 'missing', 'audit.json');
    const missing = runAudit(['--assert-clean', '--output', missingPath]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('production-import-audit-report-missing');
    await expect(access(missingPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(access(dirname(missingPath))).rejects.toMatchObject({
      code: 'ENOENT',
    });

    const missingOutputValue = runAudit(['--output', '--assert-clean']);
    expect(missingOutputValue.status).toBe(1);
    expect(missingOutputValue.stderr).toContain('Missing value for --output');
  });

  it('keeps the committed default report canonical and read-only', async () => {
    const beforeBytes = await readFile(committedReportPath);
    const before = await stat(committedReportPath);

    const checked = runAudit(['--assert-clean']);

    expect(checked.status).toBe(0);
    expect(JSON.parse(checked.stdout)).toMatchObject({
      output: 'reports/production-import-audit.json',
      reportMatches: true,
      outputChanged: false,
    });
    expect(await readFile(committedReportPath)).toEqual(beforeBytes);
    expect((await stat(committedReportPath)).mtimeMs).toBe(before.mtimeMs);
  });
});

function runAudit(argumentsList) {
  return spawnSync(process.execPath, [scriptPath, ...argumentsList], {
    cwd: process.cwd(),
    encoding: 'utf8',
  });
}

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'production-import-audit-'));
  temporaryDirectories.push(directory);
  return directory;
}
