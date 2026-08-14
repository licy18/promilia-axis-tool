import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSearchFingerprint } from './search-fingerprint.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

async function freezeDatabase() {
  const frozenDir = path.join(
    projectRoot,
    'work',
    'm12-c',
    `frozen-database-${process.pid}-${Date.now()}`
  );
  await fs.mkdir(frozenDir, { recursive: true });
  const sourceDir = path.join(projectRoot, 'src', 'data', 'database');
  for (const file of await fs.readdir(sourceDir)) {
    if (file.endsWith('.json')) {
      await fs.copyFile(path.join(sourceDir, file), path.join(frozenDir, file));
    }
  }
  await fs.writeFile(
    path.join(frozenDir, 'frozen-database.descriptor.json'),
    `${JSON.stringify({ kind: 'azpr-guided-frozen-database', pid: process.pid, createdAt: new Date().toISOString(), source: 'src/data/database' }, null, 2)}
`,
    'utf8'
  );
  return frozenDir;
}

// P1-1：readJson 识别绝对路径（冻结目录已是绝对路径，避免 path.join 拼出无效双盘符路径）。
const readJson = async file =>
  JSON.parse(
    await fs.readFile(
      path.isAbsolute(file) ? file : path.join(projectRoot, file),
      'utf8'
    )
  );

function readArgument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function hasArgument(name) {
  return process.argv.includes(name);
}

const contractPath = readArgument('--contract');
const objective = readArgument('--objective');
const guidanceJson = readArgument('--guidance');
const guidanceFile = readArgument('--guidance-file');
const optionsJson = readArgument('--options');
const feedbackOutput = readArgument('--feedback-output');
const outerOptionsJson = readArgument('--outer-options');
const initialStateJson = readArgument('--initial-state');
const runOuterSearch = hasArgument('--outer');

if (!contractPath) {
  throw new Error('--contract <path> is required');
}

const loadedContract = await readJson(contractPath);
const hasEmbeddedContract = Boolean(
  loadedContract?.contract ?? loadedContract?.contractTemplate
);
const contract =
  loadedContract?.contract ??
  loadedContract?.contractTemplate ??
  loadedContract;
const guidance = guidanceJson
  ? JSON.parse(guidanceJson)
  : guidanceFile
    ? await readJson(guidanceFile)
    : null;
const options = {
  ...(hasEmbeddedContract && loadedContract?.options
    ? loadedContract.options
    : {}),
  ...(optionsJson ? JSON.parse(optionsJson) : {}),
};
if (objective) options.objective = objective;
if (guidance) options.guidance = guidance;
const effectiveGuidance =
  guidance ?? loadedContract?.guidance ?? options.guidance ?? null;
const outerOptions = outerOptionsJson ? JSON.parse(outerOptionsJson) : null;
const initialState = initialStateJson ? JSON.parse(initialStateJson) : null;

// P1-2：启动前冻结数据库快照——评分与最终输出只消费该冻结目录，运行中数据库变化不影响结果与指纹。
const frozenDatabaseDir = await freezeDatabase();
const inputFingerprint = createSearchFingerprint({
  databaseDir: frozenDatabaseDir,
});

const mechanicsPackage = await readJson(
  'src/data/generated/verified-combat-mechanics-package.json'
);
// P1-3b：评分输入使用冻结数据库快照（可编辑数值），覆盖 package 中对应的动作目录/效果/控制绑定。
const databaseActions = await readJson(
  path.join(frozenDatabaseDir, 'actions.json')
);
const databaseEffects = await readJson(
  path.join(frozenDatabaseDir, 'effects.json')
);
mechanicsPackage.actionMappings = databaseActions.actionMappings;
mechanicsPackage.controlBindings = databaseActions.controlBindings;
mechanicsPackage.actionVariantControlBindings =
  databaseActions.actionVariantControlBindings;
mechanicsPackage.semanticEffectCatalog = {
  ...mechanicsPackage.semanticEffectCatalog,
  formulas: databaseEffects.formulas,
  semanticEffects: databaseEffects.semanticEffects,
};
// P1-2：构造完整数据库 gameData（角色/技能/奇波/敌人/元素/装备/魂精），供评分 project/loadout 消费。
const readFrozen = name =>
  readJson(path.join(frozenDatabaseDir, `${name}.json`));
const dbGameData = {
  characters: (await readFrozen('characters')).items,
  skills: (await readFrozen('skills')).items,
  kibos: (await readFrozen('kibos')).items,
  enemies: (await readFrozen('enemies')).items,
  elements: (await readFrozen('elements')).items,
  equipment: (await readFrozen('equipment')).items,
  soulessences: (await readFrozen('soulessences')).items,
};
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const packageModule = await vite.ssrLoadModule(
    '/src/data/verifiedCombatMechanicsPackage.js'
  );
  const serviceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisService.js'
  );
  const engineModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisSearchEngine.js'
  );
  const guidanceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisSearchGuidance.js'
  );
  const outerBuildModule = await vite.ssrLoadModule(
    '/src/machine-axis/m12cOuterBuildService.js'
  );
  const outerSearchModule = await vite.ssrLoadModule(
    '/src/machine-axis/m12cOuterSearchService.js'
  );

  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const factoryModule = await vite.ssrLoadModule(
    '/src/domain/workbenchProjectFactory.js'
  );
  factoryModule.setWorkbenchInjectedGameData(dbGameData);
  const service = serviceModule.createMachineAxisService({
    gameData: dbGameData,
  });
  const isOuterRequest =
    runOuterSearch ||
    loadedContract?.kind === 'azpr-m12c-outer-search' ||
    loadedContract?.contractName === 'AzPrM12COuterSearchRequest';
  let result;
  if (isOuterRequest) {
    const outerBuildService = outerBuildModule.createM12cOuterBuildService();
    const outerSearchService = outerSearchModule.createM12cOuterSearchService({
      machineAxisService: service,
      outerBuildService,
    });
    result = await outerSearchService.search({
      ...(hasEmbeddedContract ? loadedContract : {}),
      contract,
      options,
      ...(effectiveGuidance == null ? {} : { guidance: effectiveGuidance }),
      ...(outerOptions == null
        ? {}
        : {
            outer: {
              ...(loadedContract?.outer ?? {}),
              ...outerOptions,
            },
          }),
      ...(initialState == null ? {} : { initialState }),
    });
  } else {
    const engine = engineModule.createMachineAxisSearchEngine({ service });
    result = await engine.search({ contract, options });
  }

  const guidanceApplication =
    effectiveGuidance == null
      ? null
      : guidanceModule.applySearchGuidance(options, effectiveGuidance);
  const feedback = guidanceModule.createSearchFeedback({
    result,
    guidanceApplication,
  });
  // 问题 1：每次搜索输出携带 5 指纹，供 plan/checkpoint/shard/Top-N 内嵌与启动/resume/聚合/replay 比对。
  // P1-2：inputFingerprint 已在启动冻结时基于冻结快照计算，此处复用。
  const fingerprintedFeedback = feedback
    ? { ...feedback, inputFingerprint }
    : { inputFingerprint };
  if (feedbackOutput) {
    await fs.writeFile(
      path.join(projectRoot, feedbackOutput),
      `${JSON.stringify(fingerprintedFeedback, null, 2)}\n`,
      'utf8'
    );
  }
  process.stdout.write(
    `${JSON.stringify(
      {
        inputFingerprint,
        objective: result.summary?.objective,
        guidanceHash: result.summary?.guidance?.guidanceHash ?? null,
        appliedRules: result.summary?.guidance?.appliedRules ?? [],
        summary: result.summary,
        outerSearch: isOuterRequest,
        formalRankingReady: result.summary?.formalRankingReady ?? null,
        topResultCount: result.results?.length ?? 0,
        topScores: (result.results ?? []).map(
          entry => entry.score ?? entry.formalScore ?? null
        ),
        issueCount: result.issues?.length ?? 0,
        feedbackOutput: feedbackOutput ?? null,
      },
      null,
      2
    )}\n`
  );
} finally {
  await vite.close();
}
