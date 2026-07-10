import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_DUMP_CS =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';
const DEFAULT_OUTPUT = resolve(
  PROJECT_ROOT,
  'src/data/generated/runtime-capture-hook-manifest.json'
);

const TARGET_METHODS = [
  {
    key: 'AliveProperty.GetBattlePropertyCurrentValue',
    className: 'AliveProperty',
    methodName: 'GetBattlePropertyCurrentValue',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['recover-sp-modifier-property-read'],
    captureWhen: { argumentName: 'id', values: [105, 228] },
  },
  {
    key: 'SnapshotPropertyManager.GetBattlePropertyCurrentValue',
    className: 'SnapshotPropertyManager',
    methodName: 'GetBattlePropertyCurrentValue',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['recover-sp-modifier-property-read'],
    captureWhen: { argumentName: 'id', values: [105, 228] },
  },
  {
    key: 'DamageElement.RecoverSP',
    className: 'DamageElement',
    methodName: 'RecoverSP',
    hookMoments: ['entry'],
    eventTypes: ['recover-sp-source-read'],
  },
  {
    key: 'SPSystem.OnTransmit',
    className: 'SPSystem',
    methodName: 'OnTransmit',
    hookMoments: ['entry'],
    eventTypes: [
      'recover-sp-args-built',
      'recover-sp-ontransmit-12f',
      'recover-sp-share-rebroadcast',
    ],
  },
  {
    key: 'SPSystem.RecoverSP',
    className: 'SPSystem',
    methodName: 'RecoverSP',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['recover-sp-applied'],
  },
  {
    key: 'FormulaUtility.GetOutputWeaknessDamage',
    className: 'FormulaUtility',
    methodName: 'GetOutputWeaknessDamage',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-output-calculated'],
  },
  {
    key: 'FormulaUtility.WeaknessPointChange',
    className: 'FormulaUtility',
    methodName: 'WeaknessPointChange',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-damage-applied'],
  },
];

const TARGET_FIELDS = [
  {
    className: 'DamageElement',
    fieldNames: ['m_recoverSP', 'm_petRecoverSP', 'm_recoverInterval'],
  },
  {
    className: 'RecoverSPArgs',
    fieldNames: [
      'id',
      'baseDelta',
      'delta',
      'interval',
      'tagType',
      'skillId',
      'sharePercent',
      'petSharePercent',
      'petDelta',
      'isAddition',
      'additionId',
      'mainPetSharePercent',
    ],
  },
  {
    className: 'SPSystem',
    fieldNames: ['m_entityHandle', 'm_recoverTimerMap'],
  },
];

const TARGET_CLASS_NAMES = new Set([
  ...TARGET_METHODS.map(target => target.className),
  ...TARGET_FIELDS.map(target => target.className),
]);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const sourcePath = resolve(options.dumpCs ?? DEFAULT_DUMP_CS);
  const outputPath = resolve(options.output ?? DEFAULT_OUTPUT);
  const sourceStat = await stat(sourcePath);
  const extracted = await extractTargets(sourcePath);
  assertCompleteExtraction(extracted);
  const sourceSha256 = await hashFile(sourcePath);
  const generatedAt = new Date().toISOString();
  const manifest = createManifest({
    sourcePath,
    sourceStat,
    sourceSha256,
    generatedAt,
    extracted,
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      methodCount: manifest.summary.methodCount,
      fieldCount: manifest.summary.fieldCount,
      sourceSha256,
    })}\n`
  );
}

async function extractTargets(sourcePath) {
  const methods = new Map();
  const fields = new Map();
  const input = createReadStream(sourcePath, { encoding: 'utf8' });
  const lines = createInterface({ input, crlfDelay: Infinity });
  let currentClassName = null;
  let pendingMethodAddress = null;

  for await (const line of lines) {
    const classMatch = line.match(
      /^(?:public|private|internal|protected)\s+(?:static\s+)?class\s+([A-Za-z0-9_]+)/u
    );
    if (classMatch) {
      currentClassName = TARGET_CLASS_NAMES.has(classMatch[1])
        ? classMatch[1]
        : null;
      pendingMethodAddress = null;
      continue;
    }
    if (!currentClassName) {
      continue;
    }

    const addressMatch = line.match(
      /^\s*\/\/ RVA: (0x[0-9A-F]+) Offset: (0x[0-9A-F]+) VA: (0x[0-9A-F]+)/u
    );
    if (addressMatch) {
      pendingMethodAddress = {
        rva: addressMatch[1],
        offset: addressMatch[2],
        va: addressMatch[3],
      };
      continue;
    }

    collectTargetField({ line, currentClassName, fields });
    if (!pendingMethodAddress || !line.includes('(')) {
      continue;
    }

    const target = TARGET_METHODS.find(
      candidate =>
        candidate.className === currentClassName &&
        new RegExp(`\\b${candidate.methodName}\\s*\\(`, 'u').test(line)
    );
    if (target) {
      methods.set(target.key, {
        ...target,
        ...pendingMethodAddress,
        signature: line.trim(),
      });
    }
    pendingMethodAddress = null;
  }

  return {
    methods: [...methods.values()],
    fields: [...fields.values()],
  };
}

function collectTargetField({ line, currentClassName, fields }) {
  const target = TARGET_FIELDS.find(
    item => item.className === currentClassName
  );
  if (!target) {
    return;
  }
  for (const fieldName of target.fieldNames) {
    if (!line.includes(` ${fieldName};`)) {
      continue;
    }
    const offsetMatch = line.match(/\/\/ (0x[0-9A-F]+)\s*$/u);
    if (!offsetMatch) {
      continue;
    }
    const declaration = line.trim().replace(/\s*\/\/.*$/u, '');
    const typeAndName = declaration.match(
      /^(?:public|private|internal|protected)\s+(?:readonly\s+)?(.+?)\s+([A-Za-z0-9_]+);$/u
    );
    fields.set(`${currentClassName}.${fieldName}`, {
      key: `${currentClassName}.${fieldName}`,
      className: currentClassName,
      fieldName,
      fieldType: typeAndName?.[1] ?? null,
      offset: offsetMatch[1],
      declaration,
    });
  }
}

function assertCompleteExtraction(extracted) {
  const methodKeys = new Set(extracted.methods.map(method => method.key));
  const fieldKeys = new Set(extracted.fields.map(field => field.key));
  const missingMethods = TARGET_METHODS.map(method => method.key).filter(
    key => !methodKeys.has(key)
  );
  const missingFields = TARGET_FIELDS.flatMap(target =>
    target.fieldNames.map(fieldName => `${target.className}.${fieldName}`)
  ).filter(key => !fieldKeys.has(key));
  if (missingMethods.length > 0 || missingFields.length > 0) {
    throw new Error(
      `Runtime capture manifest extraction incomplete: methods=${missingMethods.join(',')}; fields=${missingFields.join(',')}`
    );
  }
}

function createManifest({
  sourcePath,
  sourceStat,
  sourceSha256,
  generatedAt,
  extracted,
}) {
  return {
    schemaVersion: 1,
    game: 'azur-promilia',
    kind: 'runtime-capture-hook-manifest',
    manifestId: 'azpr-tc-20260709-three-value-runtime-capture-v1',
    generatedAt,
    source: {
      kind: 'il2cpp-dump-cs',
      path: normalizePath(sourcePath),
      size: sourceStat.size,
      lastWriteTime: sourceStat.mtime.toISOString(),
      sha256: sourceSha256,
      clientRegion: 'TW',
      clientSnapshot: 'il2cpp-tc-catch-20260709',
      moduleName: 'GameAssembly.dll',
      imageBase: '0x180000000',
    },
    summary: {
      methodCount: extracted.methods.length,
      fieldCount: extracted.fields.length,
      energyMethodCount: extracted.methods.filter(method =>
        method.eventTypes.some(eventType => eventType.startsWith('recover-sp-'))
      ).length,
      toughnessMethodCount: extracted.methods.filter(method =>
        method.eventTypes.some(eventType => eventType.startsWith('toughness-'))
      ).length,
      realRuntimeCaptureAvailable: false,
      status: 'source-backed-hook-targets-ready-awaiting-controlled-capture',
    },
    methods: extracted.methods,
    fields: extracted.fields,
    eventContracts: [
      {
        key: 'recover-sp-runtime-sequence',
        requiredEventTypes: [
          'recover-sp-args-built',
          'recover-sp-modifier-property-read',
          'recover-sp-ontransmit-12f',
          'recover-sp-applied',
          'recover-sp-share-rebroadcast',
        ],
        hookTargets: [
          'AliveProperty.GetBattlePropertyCurrentValue',
          'SnapshotPropertyManager.GetBattlePropertyCurrentValue',
          'DamageElement.RecoverSP',
          'SPSystem.OnTransmit',
          'SPSystem.RecoverSP',
        ],
      },
      {
        key: 'toughness-runtime-sequence',
        requiredEventTypes: ['toughness-damage-applied'],
        diagnosticEventTypes: ['toughness-output-calculated'],
        hookTargets: [
          'FormulaUtility.GetOutputWeaknessDamage',
          'FormulaUtility.WeaknessPointChange',
        ],
      },
    ],
    runtimeRequirements: {
      attachPolicy: 'explicit-controlled-session-only',
      automaticLaunchAllowed: false,
      automaticAttachAllowed: false,
      antiCheatBypassAllowed: false,
      sourceGameProcessRequired: true,
      captureToolRequired: true,
      captureToolStatus: 'not-installed-or-configured',
      realCaptureAcceptance:
        'capture must pass production provenance audit and Workbench adapter validation',
    },
  };
}

async function hashFile(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--dump-cs') {
      options.dumpCs = args[index + 1];
      index += 1;
    } else if (argument === '--output') {
      options.output = args[index + 1];
      index += 1;
    } else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/generate-runtime-capture-hook-manifest.mjs [--dump-cs PATH] [--output PATH]\n'
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
