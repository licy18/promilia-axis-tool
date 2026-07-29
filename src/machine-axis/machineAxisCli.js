import { createMachineAxisService } from './machineAxisService';

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
]);

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
      await emitResult(
        io,
        parsed.options,
        createCliError('machine-axis-cli-usage', parsed.message)
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
    const takeValue = () =>
      inlineValue != null && inlineValue !== '' ? inlineValue : values.shift();
    if (flag === '--input') options.input = takeValue();
    else if (flag === '--output') options.output = takeValue();
    else if (flag === '--left') options.left = takeValue();
    else if (flag === '--right') options.right = takeValue();
    else if (flag === '--format') options.format = takeValue();
    else if (flag === '--critical-policy') {
      options.criticalPolicy = takeValue();
    } else if (flag === '--seed') options.seed = takeValue();
    else if (flag === '--action') options.selector.actionId = takeValue();
    else if (flag === '--hit') options.selector.hitIdentity = takeValue();
    else if (flag === '--effect') options.selector.effectId = takeValue();
    else if (flag === '--frame') options.selector.frame = Number(takeValue());
    else {
      return {
        valid: false,
        command,
        options,
        message: `Unknown option: ${flag}`,
      };
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
  if (!['json', 'jsonl'].includes(options.format)) {
    return {
      valid: false,
      command,
      options,
      message: `Unsupported format: ${options.format}`,
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
