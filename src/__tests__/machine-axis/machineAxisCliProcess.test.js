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
import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import cycleFixture from '../../../fixtures/machine-axis/m12-cycle-dps-example.json';

const ROOT = process.cwd();
const CLI = resolve(ROOT, 'scripts/run-machine-axis-cli.mjs');
let tempRoot;

function runCli(args, { input = '', env = {} } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    env: { ...process.env, ...env },
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
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
  }, 330_000);

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
  }, 30_000);

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
  }, 30_000);

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

  it('rejects raw Schema violations before normalization with exit 4', () => {
    const invalid = structuredClone(fixture);
    delete invalid.scenario.projectile.defaultWillHit;
    invalid.scenario.unpublishedFlag = true;
    invalid.scenario.projectile.targetDistance = '0';

    const result = runCli(['validate', '-'], {
      input: JSON.stringify(invalid),
    });
    const output = parseMachineJson(result.stdout);

    expect(result.status).toBe(4);
    expect(result.stderr).not.toContain('node:internal');
    expect(result.stderr).not.toContain(' at ');
    expect(output).toMatchObject({
      kind: 'azpr-machine-axis-validation',
      valid: false,
      classification: {
        schemaStatus: 'schema-invalid',
        runnabilityStatus: 'not-runnable',
        evidenceStatus: 'not-evaluated',
      },
    });
    expect(output.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-schema-required',
          path: 'scenario.projectile.defaultWillHit',
        }),
        expect.objectContaining({
          code: 'machine-axis-schema-additional-property',
          path: 'scenario.unpublishedFlag',
        }),
        expect.objectContaining({
          code: 'machine-axis-schema-type',
          path: 'scenario.projectile.targetDistance',
        }),
      ])
    );
  }, 30_000);

  it('runs the sustainable cycle fixture through the real CLI process', () => {
    const cyclePath = resolve(tempRoot, 'cycle-axis.json');
    const reportPath = resolve(tempRoot, 'cycle-report.json');
    writeFileSync(cyclePath, JSON.stringify(cycleFixture), 'utf8');

    const result = runCli(['cycle', cyclePath, '--output', reportPath]);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe('');
    expect(JSON.parse(readFileSync(reportPath, 'utf8'))).toMatchObject({
      kind: 'azpr-machine-axis-cycle-dps-evaluation',
      valid: true,
      status: 'closed',
      assumptions: {
        enemyHp: 'infinite',
        toughness: 'disabled',
        break: 'disabled',
        deathTruncation: 'disabled',
      },
      hashes: { cycle: expect.stringMatching(/^[0-9a-f]{16}$/) },
    });
  }, 30_000);

  it.each([
    [['catalog', '--output'], 'Missing value for --output'],
    [['validate', '--critical-policy'], 'Missing value for --critical-policy'],
    [['validate', '--input'], 'Missing value for --input'],
    [
      [
        'explain',
        resolve(tempRoot ?? '', 'unused-axis.json'),
        '--frame',
        'nope',
      ],
      'Invalid value for --frame',
    ],
  ])(
    'rejects missing or invalid valued options before command execution',
    (args, expectedMessage) => {
      const result = runCli(args);
      const output = parseMachineJson(result.stdout);

      expect(result.status).toBe(2);
      expect(output).toMatchObject({
        kind: 'azpr-machine-axis-cli-error',
        error: {
          code: 'machine-axis-cli-usage',
          message: expect.stringContaining(expectedMessage),
        },
      });
      expect(output.kind).not.toBe('azpr-machine-axis-catalog');
      expect(result.stderr).toContain('machine-axis-cli-usage');
      expect(result.stderr).not.toContain('node:internal');
      expect(result.stderr).not.toContain(' at ');
    },
    30_000
  );
});
