import { createMachineAxisService } from './machineAxisService';
import { COMBAT_CRITICAL_POLICIES } from '../domain/combatCriticalPolicy';

export const MACHINE_AXIS_CLI_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_CLI_CONTRACT_NAME = 'AzPrMachineAxisCli';
export const MACHINE_AXIS_CLI_EXIT_CODES = Object.freeze({
  OK: 0,
  USAGE: 2,
  INPUT: 3,
  VALIDATION: 4,
  RUNTIME: 5,
});

const COMMANDS = new Set([
  'catalog',
  'validate',
  'simulate',
  'compare',
  'explain',
  'batch',
]);
const VALUED_OPTIONS = new Set([
  '--input',
  '--output',
  '--left',
  '--right',
  '--format',
  '--critical-policy',
  '--seed',
  '--action',
  '--hit',
  '--effect',
  '--frame',
  '--jobs',
  '--burst-window-ms',
  '--seeds',
]);
const OUTPUT_FORMATS = new Set(['json', 'jsonl']);
const CRITICAL_POLICIES = new Set(Object.values(COMBAT_CRITICAL_POLICIES));

export async function runMachineAxisCli(
  argv,
  {
    service = createMachineAxisService(),
    readFile,
    readStdin,
    writeFile,
    writeStdout,
    writeStderr,
  } = {}
) {
  const io = {
    readFile: readFile ?? missingIo('readFile'),
    readStdin: readStdin ?? missingIo('readStdin'),
    writeFile: writeFile ?? missingIo('writeFile'),
    writeStdout: writeStdout ?? (() => {}),
    writeStderr: writeStderr ?? (() => {}),
  };
  let parsed = { options: { format: 'json', output: null } };
  try {
    parsed = parseCliArguments(argv);
    if (!parsed.valid) {
      const usageError = createCliError(
        'machine-axis-cli-usage',
        parsed.message
      );
      await emitResult(
        io,
        parsed.options,
        usageError
      );
      await io.writeStderr(
        `${usageError.error.code}: ${usageError.error.message}\n`
      );
      return MACHINE_AXIS_CLI_EXIT_CODES.USAGE;
    }
    const result = await executeCommand(parsed, service, io);
    await emitResult(io, parsed.options, result.value);
    return result.exitCode;
  } catch (error) {
    return emitCliFailure({ error, parsed, io });
  }
}

export function parseCliArguments(argv = []) {
  const values = Array.isArray(argv) ? [...argv] : [];
  const command = values.shift();
  const options = {
    input: null,
    output: null,
    left: null,
    right: null,
    format: 'json',
    criticalPolicy: null,
    seed: null,
    jobs: null,
    burstWindowMs: null,
    seeds: null,
    selector: {},
  };
  const positional = [];
  while (values.length) {
    const token = values.shift();
    if (!String(token).startsWith('--')) {
      positional.push(token);
      continue;
    }
    const [flag, inlineValue] = String(token).split(/=(.*)/s, 2);
    if (!VALUED_OPTIONS.has(flag)) {
      return {
        valid: false,
        command,
        options,
        message: `Unknown option: ${flag}`,
      };
    }
    const parsedValue = takeRequiredOptionValue({
      flag,
      inlineValue,
      values,
    });
    if (!parsedValue.valid) {
      return {
        valid: false,
        command,
        options,
        message: parsedValue.message,
      };
    }
    const value = parsedValue.value;
    if (flag === '--input') options.input = value;
    else if (flag === '--output') options.output = value;
    else if (flag === '--left') options.left = value;
    else if (flag === '--right') options.right = value;
    else if (flag === '--format') options.format = value;
    else if (flag === '--critical-policy') {
      options.criticalPolicy = value;
    } else if (flag === '--seed') options.seed = value;
    else if (flag === '--action') options.selector.actionId = value;
    else if (flag === '--hit') options.selector.hitIdentity = value;
    else if (flag === '--effect') options.selector.effectId = value;
    else if (flag === '--frame') {
      const frame = Number(value);
      if (!Number.isFinite(frame) || !Number.isInteger(frame)) {
        return {
          valid: false,
          command,
          options,
          message: `Invalid value for --frame: ${value}`,
        };
      }
      options.selector.frame = frame;
    } else if (flag === '--jobs') {
      const jobs = Number(value);
      if (!Number.isInteger(jobs) || jobs < 1) {
        return {
          valid: false,
          command,
          options,
          message: `Invalid value for --jobs: ${value}`,
        };
      }
      options.jobs = jobs;
    } else if (flag === '--burst-window-ms') {
      const windowMs = Number(value);
      if (!Number.isFinite(windowMs) || windowMs <= 0) {
        return {
          valid: false,
          command,
          options,
          message: `Invalid value for --burst-window-ms: ${value}`,
        };
      }
      options.burstWindowMs = windowMs;
    } else if (flag === '--seeds') {
      const seeds = parseCsvSeeds(value);
      if (seeds.length === 0) {
        return {
          valid: false,
          command,
          options,
          message: `Invalid value for --seeds: ${value}`,
        };
      }
      options.seeds = seeds;
    }
  }
  if (!COMMANDS.has(command)) {
    return {
      valid: false,
      command,
      options,
      message: `Unknown command: ${command ?? 'missing'}`,
    };
  }
  if (!OUTPUT_FORMATS.has(options.format)) {
    return {
      valid: false,
      command,
      options,
      message: `Unsupported format: ${options.format}`,
    };
  }
  if (command === 'batch' && options.format === 'jsonl') {
    return {
      valid: false,
      command,
      options,
      message: 'batch only supports json output',
    };
  }
  if (
    options.criticalPolicy != null &&
    !CRITICAL_POLICIES.has(options.criticalPolicy)
  ) {
    return {
      valid: false,
      command,
      options,
      message: `Unsupported critical policy: ${options.criticalPolicy}`,
    };
  }
  if (command === 'compare') {
    options.left = options.left ?? positional[0] ?? null;
    options.right = options.right ?? positional[1] ?? null;
    if (!options.left || !options.right) {
      return {
        valid: false,
        command,
        options,
        message: 'compare requires --left and --right inputs',
      };
    }
  } else if (command !== 'catalog') {
    options.input = options.input ?? positional[0] ?? '-';
  }
  return { valid: true, command, options };
}

function takeRequiredOptionValue({ flag, inlineValue, values }) {
  if (inlineValue != null) {
    return inlineValue === ''
      ? { valid: false, message: `Missing value for ${flag}` }
      : { valid: true, value: inlineValue };
  }
  const nextValue = values[0];
  if (
    nextValue == null ||
    String(nextValue).trim() === '' ||
    String(nextValue).startsWith('--')
  ) {
    return { valid: false, message: `Missing value for ${flag}` };
  }
  values.shift();
  return { valid: true, value: nextValue };
}

function parseCsvSeeds(value) {
  return String(value)
    .split(',')
    .map(seed => seed.trim())
    .filter(Boolean);
}

async function executeCommand(parsed, service, io) {
  const { command, options } = parsed;
  if (command === 'catalog') {
    return {
      exitCode: MACHINE_AXIS_CLI_EXIT_CODES.OK,
      value: service.catalog(),
    };
  }
  if (command === 'compare') {
    const [left, right] = await Promise.all([
      readSingleContract(options.left, options, io),
      readSingleContract(options.right, options, io),
    ]);
    return {
      exitCode: MACHINE_AXIS_CLI_EXIT_CODES.OK,
      value: service.compare(
        applyCliOverrides(left, options),
        applyCliOverrides(right, options)
      ),
    };
  }
  if (command === 'batch') {
    const [envelope] = await readContracts(options.input, options, io);
    const value = await service.evaluateBatch(envelope, {
      jobs: options.jobs,
      burstWindowMs: options.burstWindowMs,
      seeds:
        options.seeds ??
        (options.seed != null ? [String(options.seed)] : undefined),
      criticalPolicy: options.criticalPolicy,
    });
    return {
      exitCode:
        value?.valid === false
          ? MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION
          : MACHINE_AXIS_CLI_EXIT_CODES.OK,
      value,
    };
  }
  const inputs = await readContracts(options.input, options, io);
  const results = inputs.map(input => {
    const contract = applyCliOverrides(input, options);
    if (command === 'validate') return service.validate(contract);
    if (command === 'simulate') return service.simulate(contract);
    return service.explain(contract, options.selector);
  });
  const invalid =
    command === 'validate' && results.some(result => result.valid === false);
  return {
    exitCode: invalid
      ? MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION
      : MACHINE_AXIS_CLI_EXIT_CODES.OK,
    value: options.format === 'jsonl' ? results : results[0],
  };
}

async function readContracts(location, options, io) {
  let text;
  try {
    text =
      !location || location === '-'
        ? await io.readStdin()
        : await io.readFile(location);
  } catch (error) {
    const wrapped = new Error(
      `Unable to read Machine Axis input: ${error.message}`
    );
    wrapped.cliExitCode = MACHINE_AXIS_CLI_EXIT_CODES.INPUT;
    throw wrapped;
  }
  try {
    if (options.format === 'jsonl') {
      return String(text)
        .split(/\r?\n/)
        .filter(line => line.trim())
        .map(line => JSON.parse(line));
    }
    return [JSON.parse(String(text))];
  } catch (error) {
    const wrapped = new Error(
      `Unable to parse Machine Axis input: ${error.message}`
    );
    wrapped.cliExitCode = MACHINE_AXIS_CLI_EXIT_CODES.INPUT;
    throw wrapped;
  }
}

async function readSingleContract(location, options, io) {
  const values = await readContracts(
    location,
    { ...options, format: 'json' },
    io
  );
  return values[0];
}

function applyCliOverrides(value, options) {
  if (!options.criticalPolicy && options.seed == null) return value;
  return {
    ...value,
    scenario: {
      ...(value.scenario ?? {}),
      critical: {
        ...(value.scenario?.critical ?? {}),
        ...(options.criticalPolicy ? { policy: options.criticalPolicy } : {}),
        ...(options.seed != null ? { seed: options.seed } : {}),
      },
    },
  };
}

async function emitResult(io, options, value) {
  const text = serializeResult(options, value);
  if (options.output && options.output !== '-') {
    try {
      await io.writeFile(options.output, text);
      return;
    } catch (error) {
      const wrapped = new Error(
        `Unable to write Machine Axis output: ${error.message}`
      );
      wrapped.cliExitCode = MACHINE_AXIS_CLI_EXIT_CODES.RUNTIME;
      wrapped.outputWriteFailed = true;
      throw wrapped;
    }
  }
  await io.writeStdout(text);
}

function serializeResult(options, value) {
  const values =
    options.format === 'jsonl' && Array.isArray(value) ? value : [value];
  return options.format === 'jsonl'
    ? `${values.map(item => JSON.stringify(item)).join('\n')}\n`
    : `${JSON.stringify(value, null, 2)}\n`;
}

async function emitCliFailure({ error, parsed, io }) {
  const exitCode =
    error?.cliExitCode ??
    (error?.issues?.length
      ? MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION
      : MACHINE_AXIS_CLI_EXIT_CODES.RUNTIME);
  const code =
    exitCode === MACHINE_AXIS_CLI_EXIT_CODES.INPUT
      ? 'machine-axis-cli-input-invalid'
      : exitCode === MACHINE_AXIS_CLI_EXIT_CODES.VALIDATION
        ? 'machine-axis-cli-validation-failed'
        : 'machine-axis-cli-runtime-failed';
  const value = createCliError(
    code,
    error?.message ?? String(error),
    error?.issues ?? []
  );
  const fallbackToStdout = async () => {
    await io.writeStdout(serializeResult(parsed.options, value));
  };
  try {
    if (error?.outputWriteFailed) {
      await fallbackToStdout();
    } else {
      await emitResult(io, parsed.options, value);
    }
  } catch {
    await fallbackToStdout();
  }
  await io.writeStderr(`${value.error.code}: ${value.error.message}\n`);
  return exitCode;
}

function createCliError(code, message, issues = []) {
  return {
    schemaVersion: MACHINE_AXIS_CLI_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CLI_CONTRACT_NAME,
    kind: 'azpr-machine-axis-cli-error',
    error: { code, message, issues },
  };
}

function missingIo(name) {
  return () => {
    throw new Error(`Machine Axis CLI ${name} is not configured`);
  };
}
