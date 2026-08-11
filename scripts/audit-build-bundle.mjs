import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const outputPath = path.resolve(
  repositoryRoot,
  readStringArgument('--output', 'reports/bundle-composition.json')
);
const budgets = {
  initialEntryGzipBytes: readPositiveNumberArgument(
    '--initial-entry-gzip-budget',
    120_000
  ),
  workbenchGzipBytes: readPositiveNumberArgument(
    '--workbench-gzip-budget',
    500_000
  ),
  totalJavaScriptGzipBytes: readPositiveNumberArgument(
    '--total-js-gzip-budget',
    920_000
  ),
};
const warningThresholds = {
  totalJavaScriptGzipBytes: readPositiveNumberArgument(
    '--total-js-gzip-warning',
    900_000
  ),
};

let report = null;
await build({
  root: repositoryRoot,
  logLevel: 'warn',
  build: {
    write: false,
  },
  plugins: [createBundleAuditPlugin(result => (report = result))],
});

if (!report) {
  throw new Error('Bundle audit plugin did not receive build output');
}

const initialEntry = report.javaScriptChunks.find(chunk => chunk.isEntry);
const workbenchModuleId = 'src/views/Workbench.vue';
const workbenchChunk = report.javaScriptChunks.find(
  chunk =>
    chunk.facadeModuleId?.endsWith(workbenchModuleId) ||
    chunk.modules.some(moduleRow => moduleRow.id === workbenchModuleId)
);
const workbenchForbiddenModules = [
  'src/data/generated/elements.json',
  'src/data/generated/enemies.json',
  'src/data/generated/equipment.json',
  'src/data/generated/kibos.json',
  'src/data/generated/soulessences.json',
  'src/data/generated/skill-asset-evidence.json',
  'src/data/generated/skill-level-crosscheck.json',
  'src/data/generated/skill-logic-index.json',
  'src/data/generated/value-param-index.json',
  'src/data/generated/workbench-skill-diagnostics.json',
  'src/data/generated/workbench-skill-runtime.json',
];
const workbenchDetectedForbiddenModules = workbenchForbiddenModules.filter(
  moduleId =>
    workbenchChunk?.modules.some(moduleRow => moduleRow.id === moduleId)
);
const skillDiagnosticsChunk = report.javaScriptChunks.find(chunk =>
  chunk.modules.some(
    moduleRow =>
      moduleRow.id === 'src/data/generated/workbench-skill-diagnostics.json'
  )
);
const skillDiagnosticsAsset = report.assets.find(asset =>
  /workbench-skill-diagnostics-.*\.json$/u.test(asset.fileName)
);
const requiredExternalCatalogPrefixes = [
  'character-acceptance-catalog-',
  'character-acceptance-manifest-index-',
  'characters-',
  'combat-formula-evidence-',
  'enemy-level-profiles-',
  'kibo-passive-mechanics-',
  'optimization-qualification-catalog-',
  'soulessence-effect-mechanics-',
  'workbench-action-status-catalog-',
  'workbench-kibo-action-catalog-',
  'workbench-seed-',
  'workbench-skill-core-',
];
const externalCatalogAssets = requiredExternalCatalogPrefixes.map(prefix =>
  report.assets.find(asset => asset.fileName.startsWith(`assets/${prefix}`))
);
const projectionGuard = {
  workbenchUsesProductionDataProjection:
    Boolean(workbenchChunk) && workbenchDetectedForbiddenModules.length === 0,
  skillDiagnosticsLazyChunkPresent:
    Boolean(skillDiagnosticsAsset) ||
    (Boolean(skillDiagnosticsChunk) &&
      skillDiagnosticsChunk.fileName !== workbenchChunk?.fileName),
  largeWorkbenchCatalogsExternalized: externalCatalogAssets.every(Boolean),
  forbiddenModules: workbenchForbiddenModules,
  detectedForbiddenModules: workbenchDetectedForbiddenModules,
  skillDiagnosticsChunk: skillDiagnosticsChunk?.fileName ?? null,
  skillDiagnosticsAsset: skillDiagnosticsAsset?.fileName ?? null,
  externalCatalogAssets: externalCatalogAssets.map(
    asset => asset?.fileName ?? null
  ),
};
const budgetStatus = {
  initialEntryWithinBudget:
    Boolean(initialEntry) &&
    initialEntry.gzipBytes <= budgets.initialEntryGzipBytes,
  workbenchWithinBudget:
    Boolean(workbenchChunk) &&
    workbenchChunk.gzipBytes <= budgets.workbenchGzipBytes,
  totalJavaScriptWithinBudget:
    report.summary.totalJavaScriptGzipBytes <= budgets.totalJavaScriptGzipBytes,
};
const warningStatus = {
  totalJavaScriptWithinWarning:
    report.summary.totalJavaScriptGzipBytes <=
    warningThresholds.totalJavaScriptGzipBytes,
};
const outputReport = {
  schemaVersion: 1,
  kind: 'bundle-composition-audit',
  budgets,
  budgetStatus,
  warningThresholds,
  warningStatus,
  projectionGuard,
  ...report,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify(outputReport, null, 2)}\n`,
  'utf8'
);
// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      output: toRepositoryPath(outputPath),
      budgets,
      budgetStatus,
      warningThresholds,
      warningStatus,
      projectionGuard,
      summary: outputReport.summary,
      javaScriptChunks: outputReport.javaScriptChunks.map(chunk => ({
        fileName: chunk.fileName,
        facadeModuleId: chunk.facadeModuleId,
        bytes: chunk.bytes,
        gzipBytes: chunk.gzipBytes,
        moduleCount: chunk.moduleCount,
        topModules: chunk.modules.slice(0, 8),
      })),
    },
    null,
    2
  )
);

if (
  process.argv.includes('--assert-budget') &&
  (Object.values(budgetStatus).some(status => !status) ||
    !projectionGuard.workbenchUsesProductionDataProjection ||
    !projectionGuard.skillDiagnosticsLazyChunkPresent ||
    !projectionGuard.largeWorkbenchCatalogsExternalized)
) {
  process.exitCode = 1;
}

function createBundleAuditPlugin(onReport) {
  return {
    name: 'promilia-bundle-composition-audit',
    apply: 'build',
    generateBundle(_outputOptions, bundle) {
      const javaScriptChunks = [];
      const assets = [];
      const moduleAggregates = new Map();
      const packageAggregates = new Map();

      for (const output of Object.values(bundle)) {
        if (output.type === 'asset') {
          const source = Buffer.isBuffer(output.source)
            ? output.source
            : Buffer.from(String(output.source));
          assets.push({
            fileName: output.fileName,
            bytes: source.byteLength,
            gzipBytes: gzipSync(source).byteLength,
          });
          continue;
        }

        const modules = Object.entries(output.modules)
          .map(([moduleId, moduleInfo]) => ({
            id: normalizeModuleId(moduleId),
            renderedBytes: moduleInfo.renderedLength,
            originalBytes: moduleInfo.originalLength,
            renderedExports: moduleInfo.renderedExports,
            removedExports: moduleInfo.removedExports,
          }))
          .sort((left, right) => right.renderedBytes - left.renderedBytes);
        const code = Buffer.from(output.code);
        const chunk = {
          fileName: output.fileName,
          name: output.name,
          facadeModuleId: output.facadeModuleId
            ? normalizeModuleId(output.facadeModuleId)
            : null,
          isEntry: output.isEntry,
          isDynamicEntry: output.isDynamicEntry,
          imports: output.imports,
          dynamicImports: output.dynamicImports,
          bytes: code.byteLength,
          gzipBytes: gzipSync(code).byteLength,
          moduleCount: modules.length,
          modules,
        };
        javaScriptChunks.push(chunk);

        for (const moduleRow of modules) {
          const aggregate = moduleAggregates.get(moduleRow.id) ?? {
            id: moduleRow.id,
            renderedBytes: 0,
            chunks: [],
          };
          aggregate.renderedBytes += moduleRow.renderedBytes;
          aggregate.chunks.push(output.fileName);
          moduleAggregates.set(moduleRow.id, aggregate);

          const packageName = getPackageName(moduleRow.id);
          if (!packageName) {
            continue;
          }
          const packageAggregate = packageAggregates.get(packageName) ?? {
            packageName,
            renderedBytes: 0,
            moduleCount: 0,
          };
          packageAggregate.renderedBytes += moduleRow.renderedBytes;
          packageAggregate.moduleCount += 1;
          packageAggregates.set(packageName, packageAggregate);
        }
      }

      javaScriptChunks.sort((left, right) => right.bytes - left.bytes);
      assets.sort((left, right) => right.bytes - left.bytes);
      const topModules = [...moduleAggregates.values()].sort(
        (left, right) => right.renderedBytes - left.renderedBytes
      );
      const packageTotals = [...packageAggregates.values()].sort(
        (left, right) => right.renderedBytes - left.renderedBytes
      );
      onReport({
        summary: {
          javaScriptChunkCount: javaScriptChunks.length,
          assetCount: assets.length,
          totalJavaScriptBytes: sum(javaScriptChunks, 'bytes'),
          totalJavaScriptGzipBytes: sum(javaScriptChunks, 'gzipBytes'),
          totalAssetBytes: sum(assets, 'bytes'),
          totalAssetGzipBytes: sum(assets, 'gzipBytes'),
        },
        javaScriptChunks,
        assets,
        topModules,
        packageTotals,
      });
    },
  };
}

function normalizeModuleId(moduleId) {
  const cleanId = moduleId.split('?')[0].split('\0').join('');
  const absolutePath = path.resolve(cleanId);
  const relativePath = path.relative(repositoryRoot, absolutePath);
  if (
    relativePath !== '..' &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  ) {
    return relativePath.split(path.sep).join('/');
  }
  return cleanId.split(path.sep).join('/');
}

function getPackageName(moduleId) {
  const match = moduleId.match(/(?:^|\/)node_modules\/(.+)$/);
  if (!match) {
    return null;
  }
  const packagePath = match[1];
  const segments = packagePath.split('/');
  return segments[0]?.startsWith('@')
    ? `${segments[0]}/${segments[1]}`
    : segments[0];
}

function sum(items, key) {
  return items.reduce((total, item) => total + item[key], 0);
}

function readPositiveNumberArgument(name, fallback) {
  const value = Number(readStringArgument(name, fallback));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function readStringArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] != null
    ? process.argv[index + 1]
    : fallback;
}

function toRepositoryPath(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join('/');
}
