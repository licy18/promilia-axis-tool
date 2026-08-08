import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_DUMP_CS =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs';
const DEFAULT_GAME_ASSEMBLY =
  'C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll';
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
    eventTypes: [
      'recover-sp-modifier-property-read',
      'toughness-break-property-read',
    ],
    captureWhen: { argumentName: 'id', values: [105, 221, 228] },
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
    key: 'AliveProperty.SetSp',
    className: 'AliveProperty',
    methodName: 'SetSp',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['recover-sp-applied'],
  },
  {
    key: 'AliveProperty.SetWeaknessPoint',
    className: 'AliveProperty',
    methodName: 'SetWeaknessPoint',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-damage-applied'],
  },
  {
    key: 'AliveProperty.SetHpByHurt',
    className: 'AliveProperty',
    methodName: 'SetHpByHurt',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-hp-applied'],
  },
  {
    key: 'AliveProperty.get_breakDmgUp',
    className: 'AliveProperty',
    methodName: 'get_breakDmgUp',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-break-property-read'],
  },
  {
    key: 'ControlProperty.get_inWeakState',
    className: 'ControlProperty',
    methodName: 'get_inWeakState',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-weak-state-read'],
  },
  {
    key: 'ControlProperty.GetWeakState',
    className: 'ControlProperty',
    methodName: 'GetWeakState',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-weak-state-read'],
  },
  {
    key: 'ControlProperty.SetWeakState',
    className: 'ControlProperty',
    methodName: 'SetWeakState',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-weak-state-write'],
  },
  {
    key: 'DamageElement.Execute',
    className: 'DamageElement',
    methodName: 'Execute',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-packet-execution'],
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
    key: 'PetEntity.PetUltimateCdTime',
    className: 'PetEntity',
    methodName: 'PetUltimateCdTime',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['pet-ultimate-cooldown-observed'],
  },
  {
    key: 'FormulaUtility.GetOutputDamage',
    className: 'FormulaUtility',
    methodName: 'GetOutputDamage',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-hp-output-calculated'],
  },
  {
    key: 'FormulaUtility.GetOutputRealDamage',
    className: 'FormulaUtility',
    methodName: 'GetOutputRealDamage',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-real-output-calculated'],
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
  {
    key: 'FormulaUtility.ChangeHP',
    className: 'FormulaUtility',
    methodName: 'ChangeHP',
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-hp-change-dispatch'],
  },
  ...[
    'RecoverBreakTimingByBreakData',
    'OnAttributeCacheUpdate',
    'OnBeforeUpdate',
    'OnUpdate_LocalControlled',
    'OnUpdate_RemoteControlled',
    'WeaknessPointUpdate',
    'Lens.Gameplay.Modules.BigWorld.IUpdate.OnUpdateDeltaTime',
    'OnLateUpdate',
    'UpdateWeakState',
    'WeakBreaking',
    'WeakBreakEnding',
    'UpdateWeakBreakEnd',
  ].map(methodName => ({
    key: `WeakBreakSystem.${methodName}`,
    className: 'WeakBreakSystem',
    methodName,
    hookMoments: ['entry', 'exit'],
    eventTypes: ['toughness-state-update'],
  })),
  {
    key: 'UnityEngine.Time.get_frameCount',
    className: 'Time',
    methodName: 'get_frameCount',
    expectedRva: '0x94C28B0',
    hookMoments: [],
    eventTypes: ['toughness-frame-clock'],
  },
  {
    key: 'UnityEngine.Time.get_deltaTime',
    className: 'Time',
    methodName: 'get_deltaTime',
    expectedRva: '0x94C2760',
    hookMoments: [],
    eventTypes: ['toughness-frame-clock'],
  },
];

const TARGET_FIELDS = [
  {
    className: 'BaseData',
    fieldNames: ['<entityId>k__BackingField', '<configId>k__BackingField'],
  },
  {
    className: 'PetEntity',
    fieldNames: ['data'],
  },
  {
    className: 'BaseElement',
    fieldNames: [
      'p_sourceID',
      'p_attackerEntityID',
      'p_executeEntityID',
      'p_sourceEntityID',
      'm_uniqueId',
      '<elementId>k__BackingField',
      '<skillId>k__BackingField',
      'UUID',
    ],
  },
  {
    className: 'AliveProperty',
    fieldNames: ['m_hp', 'm_sp', 'm_weaknessPoint'],
  },
  {
    className: 'ControlProperty',
    fieldNames: ['m_weakState'],
  },
  {
    className: 'WeakBreakSystem',
    fieldNames: [
      'm_entityHandle',
      'm_lastDamageTime',
      'm_weakTime',
      'm_curWeakTime',
      'm_weakEndTime',
      'm_curWeakEndTime',
      'm_weakState',
    ],
  },
  {
    className: 'FormulaUtility.OutputDamageData',
    fieldNames: ['outputDamage', 'realDamage', 'isCritical', 'isShield'],
  },
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
  const modulePath = resolve(options.gameAssembly ?? DEFAULT_GAME_ASSEMBLY);
  const outputPath = resolve(options.output ?? DEFAULT_OUTPUT);
  const [sourceStat, moduleStat] = await Promise.all([
    stat(sourcePath),
    stat(modulePath),
  ]);
  const extracted = await extractTargets(sourcePath);
  assertCompleteExtraction(extracted);
  const [sourceSha256, moduleSha256] = await Promise.all([
    hashFile(sourcePath),
    hashFile(modulePath),
  ]);
  const generatedAt = sourceStat.mtime.toISOString();
  const manifest = createManifest({
    sourcePath,
    sourceStat,
    sourceSha256,
    modulePath,
    moduleStat,
    moduleSha256,
    generatedAt,
    extracted,
  });

  const serializedManifest = `${JSON.stringify(manifest, null, 2)}\n`;
  if (options.assertClean) {
    const current = await readFile(outputPath, 'utf8').catch(() => null);
    if (current !== serializedManifest) {
      throw new Error(
        `Runtime capture hook manifest is stale: ${normalizePath(outputPath)}`
      );
    }
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, serializedManifest, 'utf8');
  }
  process.stdout.write(
    `${JSON.stringify({
      outputPath,
      methodCount: manifest.summary.methodCount,
      fieldCount: manifest.summary.fieldCount,
      sourceSha256,
      moduleSha256,
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
      /^(?:public|private|internal|protected)\s+(?:(?:static|abstract|sealed|readonly)\s+)?(?:class|struct)\s+([A-Za-z0-9_.]+)/u
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
        (!candidate.expectedRva ||
          candidate.expectedRva === pendingMethodAddress.rva) &&
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
      /^(?:public|private|internal|protected)\s+(?:readonly\s+)?(.+?)\s+([^\s;]+);$/u
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
  modulePath,
  moduleStat,
  moduleSha256,
  generatedAt,
  extracted,
}) {
  return {
    schemaVersion: 1,
    game: 'azur-promilia',
    kind: 'runtime-capture-hook-manifest',
    manifestId: 'azpr-tc-20260709-three-value-runtime-capture-v3',
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
      module: {
        path: normalizePath(modulePath),
        size: moduleStat.size,
        lastWriteTime: moduleStat.mtime.toISOString(),
        sha256: moduleSha256,
      },
    },
    summary: {
      methodCount: extracted.methods.length,
      fieldCount: extracted.fields.length,
      energyMethodCount: extracted.methods.filter(method =>
        method.eventTypes.some(
          eventType =>
            eventType.startsWith('recover-sp-') ||
            eventType.startsWith('pet-ultimate-')
        )
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
          'recover-sp-modifier-property-read',
          'recover-sp-args-built',
          'recover-sp-ontransmit-12f',
          'recover-sp-applied',
          'recover-sp-share-rebroadcast',
        ],
        hookTargets: [
          'AliveProperty.GetBattlePropertyCurrentValue',
          'SnapshotPropertyManager.GetBattlePropertyCurrentValue',
          'AliveProperty.SetSp',
          'DamageElement.RecoverSP',
          'SPSystem.OnTransmit',
          'SPSystem.RecoverSP',
        ],
      },
      {
        key: 'pet-ultimate-readiness-observation',
        requiredEventTypes: ['pet-ultimate-cooldown-observed'],
        hookTargets: ['PetEntity.PetUltimateCdTime'],
        ownerIdentityFields: ['slotId', 'actorId', 'kiboId', 'petEntityId'],
        observedValueFields: ['cdTime', 'totalTime', 'ready'],
      },
      {
        key: 'toughness-runtime-sequence',
        requiredEventTypes: [
          'toughness-packet-execution',
          'toughness-weak-state-read',
          'toughness-break-property-read',
          'toughness-hp-output-calculated',
          'toughness-damage-applied',
          'toughness-weak-state-write',
          'toughness-hp-change-dispatch',
          'toughness-hp-applied',
          'toughness-state-update',
        ],
        diagnosticEventTypes: [
          'toughness-real-output-calculated',
          'toughness-output-calculated',
          'toughness-frame-clock',
        ],
        hookTargets: [
          'DamageElement.Execute',
          'FormulaUtility.GetOutputDamage',
          'FormulaUtility.GetOutputRealDamage',
          'FormulaUtility.GetOutputWeaknessDamage',
          'FormulaUtility.WeaknessPointChange',
          'FormulaUtility.ChangeHP',
          'AliveProperty.SetWeaknessPoint',
          'AliveProperty.SetHpByHurt',
          'AliveProperty.GetBattlePropertyCurrentValue',
          'AliveProperty.get_breakDmgUp',
          'ControlProperty.get_inWeakState',
          'ControlProperty.GetWeakState',
          'ControlProperty.SetWeakState',
          'WeakBreakSystem.RecoverBreakTimingByBreakData',
          'WeakBreakSystem.OnAttributeCacheUpdate',
          'WeakBreakSystem.OnBeforeUpdate',
          'WeakBreakSystem.OnUpdate_LocalControlled',
          'WeakBreakSystem.OnUpdate_RemoteControlled',
          'WeakBreakSystem.WeaknessPointUpdate',
          'WeakBreakSystem.Lens.Gameplay.Modules.BigWorld.IUpdate.OnUpdateDeltaTime',
          'WeakBreakSystem.OnLateUpdate',
          'WeakBreakSystem.UpdateWeakState',
          'WeakBreakSystem.WeakBreaking',
          'WeakBreakSystem.WeakBreakEnding',
          'WeakBreakSystem.UpdateWeakBreakEnd',
        ],
        orderingFields: [
          'captureSequence',
          'clientFrameCount',
          'clientDeltaTimeSeconds',
          'threadId',
        ],
        settlementStateFields: [
          'hpBefore',
          'hpAfter',
          'weaknessPointBefore',
          'weaknessPointAfter',
          'weakStateBefore',
          'weakStateAfter',
          'outputDamage',
          'realDamage',
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
      captureToolStatus: 'controlled-frida-host-ready',
      captureHost: 'scripts/capture-azpr-runtime.py',
      explicitConfirmationRequired: true,
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
    } else if (argument === '--game-assembly') {
      options.gameAssembly = args[index + 1];
      index += 1;
    } else if (argument === '--output') {
      options.output = args[index + 1];
      index += 1;
    } else if (argument === '--assert-clean') {
      options.assertClean = true;
    } else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/generate-runtime-capture-hook-manifest.mjs [--dump-cs PATH] [--game-assembly PATH] [--output PATH] [--assert-clean]\n'
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
