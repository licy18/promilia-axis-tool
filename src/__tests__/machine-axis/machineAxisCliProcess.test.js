import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';

const ROOT = process.cwd();
const CLI = resolve(ROOT, 'scripts/run-machine-axis-cli.mjs');
let tempRoot;

function runCli(args, { input = '', env = {} } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    env: { ...process.env, ...env },
    timeout: 120_000,
  });
}

function parseMachineJson(text) {
  expect(text.trim()).not.toBe('');
  return JSON.parse(text);
}

describe('Machine Axis CLI real process I/O', () => {
  beforeAll(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'azpr-machine-axis-cli-'));
    const build = runCli(['catalog'], {
      env: { AZPR_MACHINE_AXIS_REBUILD: '1' },
    });
    expect(build.status).toBe(0);
    expect(parseMachineJson(build.stdout)).toMatchObject({
      kind: 'azpr-machine-axis-catalog',
    });
  }, 180_000);

  afterAll(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  });

  it('classifies missing and malformed input as INPUT=3', () => {
    const missing = runCli([
      'validate',
      resolve(tempRoot, 'missing-axis.json'),
    ]);
    expect(missing.status).toBe(3);
    expect(parseMachineJson(missing.stdout)).toMatchObject({
      kind: 'azpr-machine-axis-cli-error',
      error: { code: 'machine-axis-cli-input-invalid' },
    });
    expect(missing.stderr).toContain('machine-axis-cli-input-invalid');
    expect(missing.stderr).not.toContain(' at ');

    const malformedPath = resolve(tempRoot, 'malformed-axis.json');
    writeFileSync(malformedPath, '{bad json', 'utf8');
    const malformed = runCli(['validate', malformedPath]);
    expect(malformed.status).toBe(3);
    expect(parseMachineJson(malformed.stdout).error.code).toBe(
      'machine-axis-cli-input-invalid'
    );
  });

  it('awaits output writes and falls back to stdout on write failure', () => {
    const outputPath = resolve(
      tempRoot,
      'missing-parent',
      'catalog-output.json'
    );
    const failed = runCli(['catalog', '--output', outputPath]);

    expect(failed.status).toBe(5);
    expect(parseMachineJson(failed.stdout)).toMatchObject({
      kind: 'azpr-machine-axis-cli-error',
      error: { code: 'machine-axis-cli-runtime-failed' },
    });
    expect(failed.stderr).toContain('machine-axis-cli-runtime-failed');
    expect(failed.stderr).not.toContain('node:internal');
    expect(failed.stderr).not.toContain(' at ');
  });

  it('keeps stdin/stdout clean and writes a requested file deterministically', () => {
    const stdin = runCli(['validate', '-'], {
      input: JSON.stringify(fixture),
    });
    expect(stdin.status).toBe(0);
    expect(stdin.stderr).toBe('');
    expect(parseMachineJson(stdin.stdout)).toMatchObject({ valid: true });

    const outputPath = resolve(tempRoot, 'nested', 'validation.json');
    mkdirSync(resolve(tempRoot, 'nested'));
    const file = runCli(['validate', '-', '--output', outputPath], {
      input: JSON.stringify(fixture),
    });
    expect(file.status).toBe(0);
    expect(file.stdout).toBe('');
    expect(file.stderr).toBe('');
    expect(JSON.parse(readFileSync(outputPath, 'utf8'))).toMatchObject({
      valid: true,
    });
  }, 30_000);
});
