import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { createSearchFingerprint } from './search-fingerprint.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');

const readJson = async file =>
  JSON.parse(await fs.readFile(path.join(projectRoot, file), 'utf8'));

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

const mechanicsPackage = await readJson(
  'src/data/generated/verified-combat-mechanics-package.json'
);
// P1-3b：评分输入使用数据库快照（可编辑数值），覆盖 package 中对应的动作目录/效果/控制绑定。
const databaseActions = await readJson('src/data/database/actions.json');
const databaseEffects = await readJson('src/data/database/effects.json');
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
const dbGameData = {
  characters: (await readJson('src/data/database/characters.json')).items,
  skills: (await readJson('src/data/database/skills.json')).items,
  kibos: (await readJson('src/data/database/kibos.json')).items,
  enemies: (await readJson('src/data/database/enemies.json')).items,
  elements: (await readJson('src/data/database/elements.json')).items,
  equipment: (await readJson('src/data/database/equipment.json')).items,
  soulessences: (await readJson('src/data/database/soulessences.json')).items,
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
  const inputFingerprint = createSearchFingerprint();
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
