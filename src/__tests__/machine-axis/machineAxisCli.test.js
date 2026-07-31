import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  MACHINE_AXIS_CLI_EXIT_CODES,
  runMachineAxisCli,
} from '../../machine-axis/machineAxisCli';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';

function createHarness({ stdin = '', files = {} } = {}) {
  const output = { stdout: '', stderr: '', files: {} };
  return {
    output,
    io: {
      service: createMachineAxisService(),
      readFile: async path => {
        if (!(path in files)) throw new Error(`missing fixture file: ${path}`);
        return files[path];
      },
      readStdin: async () => stdin,
      writeFile: async (path, value) => {
        output.files[path] = value;
      },
      writeStdout: value => {
        output.stdout += value;
      },
      writeStderr: value => {
        output.stderr += value;
      },
    },
  };
}

function parseJson(text) {
  return JSON.parse(text);
}

function cloneFixture() {
  return structuredClone(fixture);
}

describe('Machine Axis CLI', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('emits a clean catalog and validates file/stdin input', async () => {
    const fileText = JSON.stringify(fixture);
    const harness = createHarness({
      stdin: fileText,
      files: { 'axis.json': fileText },
    });
    const catalogExit = await runMachineAxisCli(['catalog'], harness.io);
    const catalog = parseJson(harness.output.stdout);
    expect(catalogExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(catalog).toMatchObject({
      kind: 'azpr-machine-axis-catalog',
      catalogHash: expect.any(String),
    });
    expect(harness.output.stderr).toBe('');

    harness.output.stdout = '';
    const fileExit = await runMachineAxisCli(
      ['validate', 'axis.json'],
      harness.io
    );
    const fileResult = parseJson(harness.output.stdout);
    expect(fileExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(fileResult).toMatchObject({ valid: true });

    harness.output.stdout = '';
    const stdinExit = await runMachineAxisCli(['validate', '-'], harness.io);
    expect(stdinExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(parseJson(harness.output.stdout).hashes).toEqual(fileResult.hashes);
  }, 30_000);

  it('simulates, explains, compares, and writes structured output files', async () => {
    const text = JSON.stringify(fixture);
    const harness = createHarness({ files: { left: text, right: text } });
    const simulateExit = await runMachineAxisCli(
      ['simulate', 'left', '--output', 'run.json'],
      harness.io
    );
    const run = parseJson(harness.output.files['run.json']);
    expect(simulateExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(harness.output.stdout).toBe('');
    expect(run).toMatchObject({
      kind: 'azpr-machine-axis-run',
      trace: expect.any(Object),
      evaluation: expect.any(Object),
      hashes: {
        input: expect.any(String),
        data: expect.any(String),
        trace: expect.any(String),
        evaluation: expect.any(String),
      },
    });
    expect(run.canonical).toBeUndefined();

    const explainHarness = createHarness({ files: { axis: text } });
    const explainExit = await runMachineAxisCli(
      ['explain', 'axis', '--action', 'a3-sampled'],
      explainHarness.io
    );
    const explanation = parseJson(explainHarness.output.stdout);
    expect(explainExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(explanation).toMatchObject({
      kind: 'azpr-machine-axis-explanation',
      hashes: run.hashes,
      selector: { actionId: 'a3-sampled' },
    });

    const compareHarness = createHarness({
      files: { left: text, right: text },
    });
    const compareExit = await runMachineAxisCli(
      ['compare', '--left', 'left', '--right', 'right'],
      compareHarness.io
    );
    const comparison = parseJson(compareHarness.output.stdout);
    expect(compareExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(comparison).toMatchObject({
      kind: 'azpr-machine-axis-comparison',
      delta: expect.objectContaining({ hpDamage: 0 }),
    });
  }, 30_000);

  it('supports JSONL and explicit critical overrides in the input hash', async () => {
    const input = `${JSON.stringify(fixture)}\n${JSON.stringify(fixture)}\n`;
    const harness = createHarness({ stdin: input });
    const exitCode = await runMachineAxisCli(
      ['validate', '-', '--format', 'jsonl'],
      harness.io
    );
    const rows = harness.output.stdout.trim().split('\n').map(parseJson);
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(rows).toHaveLength(2);
    expect(rows[0].hashes).toEqual(rows[1].hashes);

    const overrideHarness = createHarness({
      stdin: JSON.stringify(fixture),
    });
    await runMachineAxisCli(
      [
        'validate',
        '-',
        '--critical-policy',
        'critical',
        '--seed',
        'cli-override-seed',
      ],
      overrideHarness.io
    );
    expect(parseJson(overrideHarness.output.stdout).hashes.input).not.toBe(
      rows[0].hashes.input
    );
  }, 30_000);

  it('returns stable nonzero errors for parse and validation failures', async () => {
    const parseHarness = createHarness({ stdin: '{bad json' });
    const parseExit = await runMachineAxisCli(
      ['validate', '-'],
      parseHarness.io
    );
    expect(parseExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.INPUT);
    expect(parseJson(parseHarness.output.stdout)).toMatchObject({
      kind: 'azpr-machine-axis-cli-error',
      error: { code: 'machine-axis-cli-input-invalid' },
    });
    expect(parseHarness.output.stderr).toContain(
      'machine-axis-cli-input-invalid'
    );

    const invalid = cloneFixture();
    invalid.scenario.critical = { policy: 'sampled', seed: null };
    const validationHarness = createHarness({
      stdin: JSON.stringify(invalid),
    });
    const validationExit = await runMachineAxisCli(
      ['validate', '-'],
      validationHarness.io
    );
    expect(validationExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION);
    expect(parseJson(validationHarness.output.stdout).issues).toContainEqual(
      expect.objectContaining({ code: 'machine-axis-sampled-seed-required' })
    );
  });

  it('runs batch evaluation envelopes and reports aggregate summary', async () => {
    const envelope = {
      kind: 'azpr-machine-axis-batch',
      runs: [
        { label: 'first', axis: cloneFixture() },
        {
          label: 'second',
          axis: cloneFixture(),
          options: { criticalPolicy: 'expected' },
        },
      ],
    };
    const harness = createHarness({ stdin: JSON.stringify(envelope) });
    const exitCode = await runMachineAxisCli(['batch', '-'], harness.io);
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    const report = parseJson(harness.output.stdout);
    expect(report).toMatchObject({
      kind: 'azpr-machine-axis-batch-evaluation',
      valid: true,
      status: 'ok',
      summary: {
        runCount: 2,
        okCount: 2,
        failedCount: 0,
        jobs: 4,
      },
    });
    expect(report.runs.map(run => run.label)).toEqual(['first', 'second']);
    expect(report.runs[1].critical.policy).toBe('expected');
    expect(harness.output.stderr).toBe('');
  }, 30_000);

  it('applies CLI jobs, burst window and seeds overrides to a batch', async () => {
    const envelope = {
      kind: 'azpr-machine-axis-batch',
      runs: [{ label: 'sampled', axis: cloneFixture() }],
    };
    const harness = createHarness({ stdin: JSON.stringify(envelope) });
    const exitCode = await runMachineAxisCli(
      [
        'batch',
        '-',
        '--jobs',
        '2',
        '--burst-window-ms',
        '5000',
        '--seeds',
        'seed-a,seed-b',
      ],
      harness.io
    );
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    const report = parseJson(harness.output.stdout);
    expect(report.summary.jobs).toBe(2);
    expect(report.runs[0]).toMatchObject({
      mode: 'sampled',
      seeds: ['seed-a', 'seed-b'],
      status: 'ok',
    });
    expect(report.runs[0].samples).toHaveLength(2);
    expect(report.runs[0].metrics).toBeUndefined();
    expect(report.runs[0].sampling.count).toBe(2);
    expect(report.runs[0].sampling.metrics.hpDamage.count).toBe(2);
  }, 30_000);

  it('returns validation exit code for malformed batch envelopes', async () => {
    const harness = createHarness({
      stdin: JSON.stringify({ kind: 'azpr-machine-axis-batch', runs: [] }),
    });
    const exitCode = await runMachineAxisCli(['batch', '-'], harness.io);
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION);
    const report = parseJson(harness.output.stdout);
    expect(report).toMatchObject({
      kind: 'azpr-machine-axis-batch-evaluation',
      valid: false,
      status: 'invalid',
    });
    expect(
      report.issues.some(issue => issue.code === 'batch-runs-required')
    ).toBe(true);
  }, 30_000);

  it('reads batch envelopes from files and writes structured output', async () => {
    const envelope = {
      kind: 'azpr-machine-axis-batch',
      runs: [{ label: 'file-run', axis: cloneFixture() }],
    };
    const harness = createHarness({
      files: { 'batch.json': JSON.stringify(envelope) },
    });
    const exitCode = await runMachineAxisCli(
      ['batch', 'batch.json', '--output', 'batch-report.json'],
      harness.io
    );
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(harness.output.stdout).toBe('');
    const report = parseJson(harness.output.files['batch-report.json']);
    expect(report.runs[0].label).toBe('file-run');
    expect(report.summary.okCount).toBe(1);
  }, 30_000);

  it.each([
    ['catalog', '--output'],
    ['catalog', '--output', '--format', 'json'],
    ['validate', '--critical-policy'],
    ['validate', '--input'],
    ['explain', 'axis.json', '--frame', 'nope'],
    ['batch', '--jobs'],
    ['batch', '--jobs', '0'],
    ['batch', '--jobs', 'x'],
    ['batch', '--burst-window-ms'],
    ['batch', '--burst-window-ms', '-5'],
    ['batch', '--seeds'],
    ['batch', '--seeds', ','],
    ['batch', '-', '--format', 'jsonl'],
  ])(
    'rejects valued-option usage before reading input or calling the service',
    async (...args) => {
      let readCount = 0;
      let serviceCallCount = 0;
      let stdout = '';
      const exitCode = await runMachineAxisCli(args, {
        service: new Proxy(
          {},
          {
            get() {
              return () => {
                serviceCallCount += 1;
                throw new Error('service must not execute');
              };
            },
          }
        ),
        readFile: async () => {
          readCount += 1;
          throw new Error('input must not be read');
        },
        readStdin: async () => {
          readCount += 1;
          throw new Error('stdin must not be read');
        },
        writeFile: async () => {
          throw new Error('usage errors must not write a requested file');
        },
        writeStdout: value => {
          stdout += value;
        },
        writeStderr: () => {},
      });

      expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.USAGE);
      expect(readCount).toBe(0);
      expect(serviceCallCount).toBe(0);
      expect(parseJson(stdout)).toMatchObject({
        kind: 'azpr-machine-axis-cli-error',
        error: { code: 'machine-axis-cli-usage' },
      });
    }
  );
});
