import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import {
  createRuntimeSampleCaptureProductionAudit,
  parseWorkbenchRuntimeSampleCaptureFile,
} from '../src/domain/workbenchRuntimeSampleCapture.js';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.inputs.length === 0) {
    throw new Error('At least one --input is required');
  }
  const inputPaths = options.inputs.map(input => resolve(input));
  const outputPath = resolve(
    options.output ??
      `${inputPaths[0]}.${
        inputPaths.length === 1
          ? 'promilia-runtime-capture'
          : 'promilia-runtime-capture-batch'
      }.json`
  );
  const parsedInputs = [];
  const sourceFiles = [];
  for (const inputPath of inputPaths) {
    const sourceBytes = await readFile(inputPath);
    const sourceText = sourceBytes.toString('utf8');
    const parsed = parseWorkbenchRuntimeSampleCaptureFile(sourceText);
    if (!parsed) {
      throw new Error(`Runtime capture input is invalid: ${inputPath}`);
    }
    parsedInputs.push(parsed);
    sourceFiles.push({
      path: basename(inputPath),
      size: sourceBytes.length,
      sha256: createHash('sha256').update(sourceBytes).digest('hex'),
    });
  }

  const captureSessionIds = new Set();
  const captures = parsedInputs
    .flatMap(parsed => parsed.captures)
    .map(redactPortableCaptureMetadata);
  for (const capture of captures) {
    if (captureSessionIds.has(capture.captureSessionId)) {
      throw new Error(
        `Duplicate captureSessionId across inputs: ${capture.captureSessionId}`
      );
    }
    captureSessionIds.add(capture.captureSessionId);
  }
  const parsed = parseWorkbenchRuntimeSampleCaptureFile({
    schemaVersion: 1,
    game: 'azur-promilia',
    type: 'runtime-sample-captures',
    captures,
  });
  const provenanceAudit = createRuntimeSampleCaptureProductionAudit(
    parsed.captures
  );
  const normalized = {
    ...parsed,
    normalizedBy: 'promilia-axis-tool/runtime-capture-normalizer-v3',
    ...(sourceFiles.length === 1 ? { sourceFile: sourceFiles[0] } : {}),
    sourceFiles,
    provenanceAudit,
  };

  if (options.requireProduction && !provenanceAudit.realCaptureClaimAllowed) {
    process.stderr.write(`${JSON.stringify(provenanceAudit, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  await writeFile(
    outputPath,
    `${JSON.stringify(normalized, null, 2)}\n`,
    'utf8'
  );
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      inputFileCount: inputPaths.length,
      captureCount: parsed.summary.captureCount,
      eventCount: parsed.summary.eventCount,
      realCaptureClaimAllowed: provenanceAudit.realCaptureClaimAllowed,
    })}\n`
  );
}

function parseArguments(args) {
  const options = {
    inputs: [],
    requireProduction: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--input') {
      options.inputs.push(args[index + 1]);
      index += 1;
    } else if (argument === '--output') {
      options.output = args[index + 1];
      index += 1;
    } else if (argument === '--require-production') {
      options.requireProduction = true;
    } else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/normalize-runtime-capture.mjs --input PATH [--input PATH ...] [--output PATH] [--require-production]\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function redactPortableCaptureMetadata(capture) {
  const portableCapture = { ...capture };
  const { module } = portableCapture;
  delete portableCapture.processId;
  if (!module || typeof module !== 'object' || Array.isArray(module)) {
    return portableCapture;
  }
  portableCapture.module = { ...module };
  delete portableCapture.module.path;
  delete portableCapture.module.base;
  return portableCapture;
}

await main();
