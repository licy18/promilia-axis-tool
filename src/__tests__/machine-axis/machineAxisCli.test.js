import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  MACHINE_AXIS_CLI_EXIT_CODES,
  runMachineAxisCli,
} from '../../machine-axis/machineAxisCli';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';

function createHarness({
  stdin = '',
  files = {},
  m12cOuterSearchService,
} = {}) {
  const output = { stdout: '', stderr: '', files: {} };
  return {
    output,
    io: {
      service: createMachineAxisService(),
      ...(m12cOuterSearchService == null ? {} : { m12cOuterSearchService }),
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

function createCycleEnvelope() {
  const contract = cloneFixture();
  const first = contract.scenario.team[0];
  const third = contract.scenario.team[2];
  contract.scenario.team[0] = { ...third, slotId: 'slot-1' };
  contract.scenario.team[2] = { ...first, slotId: 'slot-3' };
  contract.scenario.durationFrames = 900;
  contract.scenario.critical = { policy: 'expected', seed: null };
  for (const slot of contract.scenario.team) slot.loadout = {};
  contract.scenario.initialRuntimeState.kiboEnergyBySlot = [];
  contract.actions = [1, 2, 3].map(sequenceIndex => ({
    id: `cycle-ruby-a${sequenceIndex}`,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: 10300201,
      actionKind: 'normal-attack',
      attackInput: { sequenceIndex, groupId: 'cycle-ruby' },
      level: 1,
    },
    schedule:
      sequenceIndex === 1
        ? { mode: 'absolute', frame: 60 }
        : { mode: 'after-previous-end', offsetFrames: 0 },
  }));
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisCycleDps',
    kind: 'azpr-machine-axis-cycle-dps',
    contract,
    loop: { startFrame: 60, endFrame: 360 },
  };
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

  it('exposes the M12-C outer pool and bounded lazy build enumeration', async () => {
    const poolHarness = createHarness();
    const poolExit = await runMachineAxisCli(
      ['m12c-outer-pool'],
      poolHarness.io
    );
    const pool = parseJson(poolHarness.output.stdout);
    expect(poolExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(pool.summary).toMatchObject({
      teamCount: 28,
      sourceConfigCount: 35,
    });

    const sourceConfig = pool.teamCatalog.sourceConfigs.find(
      config => !config.optimizationObjectIds.includes('STARBORN')
    );
    const buildsHarness = createHarness({
      stdin: JSON.stringify({
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      }),
    });
    const buildsExit = await runMachineAxisCli(
      ['m12c-outer-builds', '-', '--max-candidates', '1'],
      buildsHarness.io
    );
    const builds = parseJson(buildsHarness.output.stdout);

    expect(buildsExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(builds).toMatchObject({
      kind: 'azpr-m12c-outer-build-batch',
      valid: true,
      candidateCount: 1,
      candidates: [
        expect.objectContaining({
          buildHash: expect.stringMatching(/^[0-9a-f]{16}$/),
        }),
      ],
    });
  }, 30_000);

  it('routes bounded M12-C outer search through the production CLI command', async () => {
    const calls = [];
    const envelope = {
      schemaVersion: 1,
      contractName: 'AzPrM12COuterSearchRequest',
      kind: 'azpr-m12c-outer-search',
      contract: cloneFixture(),
      options: { objective: 'cycle-dps-no-toughness' },
      outer: { sourceConfigIdentities: ['fixture-source'] },
    };
    const harness = createHarness({
      stdin: JSON.stringify(envelope),
      m12cOuterSearchService: {
        search: async (...args) => {
          calls.push(args);
          return {
            schemaVersion: 1,
            contractName: 'AzPrM12COuterSearchReport',
            kind: 'azpr-m12c-outer-search-report',
            valid: true,
            summary: { formalRankingReady: false },
            results: [{ rank: 1 }],
          };
        },
      },
    });

    const exit = await runMachineAxisCli(
      [
        'm12c-outer-search',
        '-',
        '--objective',
        'cycle-dps-no-toughness',
        '--beam-width',
        '2',
        '--top-n',
        '3',
        '--max-source-configs',
        '1',
        '--max-builds-per-source-config',
        '2',
        '--max-builds-total',
        '2',
        '--max-variant-searches',
        '6',
      ],
      harness.io
    );
    const report = parseJson(harness.output.stdout);

    expect(exit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(report.kind).toBe('azpr-m12c-outer-search-report');
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toMatchObject({
      kind: 'azpr-m12c-outer-search',
      contract: envelope.contract,
    });
    expect(calls[0][1]).toMatchObject({
      objective: 'cycle-dps-no-toughness',
      beamWidth: 2,
      topN: 3,
      outer: {
        maxSourceConfigs: 1,
        maxBuildsPerSourceConfig: 2,
        maxBuildsTotal: 2,
        maxVariantSearches: 6,
      },
    });
  });

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
      ['explain', 'axis', '--action', 'plunging-sampled'],
      explainHarness.io
    );
    const explanation = parseJson(explainHarness.output.stdout);
    expect(explainExit).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(explanation).toMatchObject({
      kind: 'azpr-machine-axis-explanation',
      hashes: run.hashes,
      selector: { actionId: 'plunging-sampled' },
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

  it('runs search envelopes and returns a Top-N report', async () => {
    const envelope = {
      kind: 'azpr-machine-axis-search',
      contract: cloneFixture(),
      options: {
        beamWidth: 2,
        topN: 2,
        maxDepth: 2,
        maxActionsPerOwner: 2,
        maxKiboActions: 1,
        includeSwitch: false,
        objective: 'damage',
      },
    };
    const harness = createHarness({ stdin: JSON.stringify(envelope) });
    const exitCode = await runMachineAxisCli(
      ['search', '-', '--seeds', 'search-seed-a,search-seed-b'],
      harness.io
    );
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    const report = parseJson(harness.output.stdout);
    expect(report).toMatchObject({
      kind: 'azpr-machine-axis-search-report',
      objective: 'damage',
      summary: { beamWidth: 2, topN: 2 },
    });
    expect(report.results.length).toBeGreaterThan(0);
    expect(report.results.length).toBeLessThanOrEqual(2);
    expect(report.results[0].axis.actions.length).toBeGreaterThan(0);
    expect(report.results[0].sampling).toMatchObject({
      mode: 'explicit-seed-set',
      seeds: ['search-seed-a', 'search-seed-b'],
      sampleCount: 2,
    });
    expect(harness.output.stderr).toBe('');
  }, 120_000);

  it('returns validation exit code for malformed search envelopes', async () => {
    const harness = createHarness({
      stdin: JSON.stringify({
        kind: 'azpr-machine-axis-search',
        contract: {},
      }),
    });
    const exitCode = await runMachineAxisCli(['search', '-'], harness.io);
    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION);
    expect(parseJson(harness.output.stdout)).toMatchObject({
      kind: 'azpr-machine-axis-cli-error',
      error: { code: 'machine-axis-cli-validation-failed' },
    });
  }, 30_000);

  it('evaluates a sustainable cycle through the canonical service', async () => {
    const harness = createHarness({
      stdin: JSON.stringify(createCycleEnvelope()),
    });
    const exitCode = await runMachineAxisCli(['cycle', '-'], harness.io);
    const report = parseJson(harness.output.stdout);

    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.OK);
    expect(report).toMatchObject({
      kind: 'azpr-machine-axis-cycle-dps-evaluation',
      valid: true,
      status: 'closed',
      loop: { startFrame: 60, endFrame: 360 },
      metrics: {
        loopHpDamage: expect.any(Number),
        cycleDps: expect.any(Number),
      },
    });
    expect(report.replayProof.stable).toBe(true);
    expect(report.hashes.cycle).toMatch(/^[0-9a-f]{16}$/);
    expect(harness.output.stderr).toBe('');
  }, 30_000);

  it('returns validation exit code for a non-closed cycle', async () => {
    const envelope = createCycleEnvelope();
    envelope.loop.endFrame = envelope.loop.startFrame;
    const harness = createHarness({ stdin: JSON.stringify(envelope) });
    const exitCode = await runMachineAxisCli(['cycle', '-'], harness.io);

    expect(exitCode).toBe(MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION);
    expect(parseJson(harness.output.stdout)).toMatchObject({
      kind: 'azpr-machine-axis-cycle-dps-evaluation',
      valid: false,
      issues: [
        expect.objectContaining({ code: 'machine-axis-cycle-loop-empty' }),
      ],
    });
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
    ['search', '--beam-width'],
    ['search', '--beam-width', '0'],
    ['search', '--top-n', 'x'],
    ['search', '--max-depth', '-1'],
    ['m12c-outer-builds', '--max-candidates'],
    ['m12c-outer-builds', '--max-candidates', '0'],
    ['m12c-outer-search', '--max-source-configs'],
    ['m12c-outer-search', '--max-source-configs', '0'],
    ['m12c-outer-search', '--max-builds-per-source-config', 'x'],
    ['m12c-outer-search', '--max-builds-total', '-1'],
    ['m12c-outer-search', '--max-variant-searches', '0'],
    ['search', '--objective', 'nope'],
    ['cycle', '-', '--objective', 'damage'],
    ['cycle', '-', '--objective', 'fastest-kill'],
    ['kill', '-', '--objective', 'damage'],
    ['kill', '-', '--objective', 'cycle-dps-with-toughness'],
    ['kill', '-', '--objective', 'nope'],
    ['search', '-', '--format', 'jsonl'],
    ['cycle', '-', '--format', 'jsonl'],
    ['kill', '-', '--format', 'jsonl'],
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
