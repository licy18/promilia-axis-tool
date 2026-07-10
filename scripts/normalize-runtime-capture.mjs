import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  createRuntimeSampleCaptureProductionAudit,
  parseWorkbenchRuntimeSampleCaptureFile,
} from '../src/domain/workbenchRuntimeSampleCapture.js';

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (!options.input) {
    throw new Error('--input is required');
  }
  const inputPath = resolve(options.input);
  const outputPath = resolve(
    options.output ?? `${inputPath}.promilia-runtime-capture.json`
  );
  const sourceText = await readFile(inputPath, 'utf8');
  const parsed = parseWorkbenchRuntimeSampleCaptureFile(sourceText);
  if (!parsed) {
    throw new Error('Runtime capture input is invalid');
  }

  const inputStat = await stat(inputPath);
  const provenanceAudit = createRuntimeSampleCaptureProductionAudit(
    parsed.captures
  );
  const normalized = {
    ...parsed,
    normalizedAt: new Date().toISOString(),
    normalizedBy: 'promilia-axis-tool/runtime-capture-normalizer-v1',
    sourceFile: {
      path: normalizePath(inputPath),
      size: inputStat.size,
      sha256: createHash('sha256').update(sourceText).digest('hex'),
    },
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
      captureCount: parsed.summary.captureCount,
      eventCount: parsed.summary.eventCount,
      realCaptureClaimAllowed: provenanceAudit.realCaptureClaimAllowed,
    })}\n`
  );
}

function parseArguments(args) {
  const options = {
    requireProduction: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--input') {
      options.input = args[index + 1];
      index += 1;
    } else if (argument === '--output') {
      options.output = args[index + 1];
      index += 1;
    } else if (argument === '--require-production') {
      options.requireProduction = true;
    } else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/normalize-runtime-capture.mjs --input PATH [--output PATH] [--require-production]\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return options;
}

function normalizePath(value) {
  return String(value).replaceAll('\\', '/');
}

await main();
