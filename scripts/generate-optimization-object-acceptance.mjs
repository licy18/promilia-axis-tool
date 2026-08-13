import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOptimizationObjectAliasAcceptanceBundle } from '../src/character-acceptance/optimizationObjectAliasProtocol.js';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const objectId = readArgument('--object');
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');

if (!objectId || !/^[A-Za-z0-9_-]+$/.test(objectId)) {
  throw new Error('Optimization object id is required: --object <id>');
}

const recipePath = path.join(
  projectRoot,
  'scripts',
  'character-acceptance',
  'optimization-object-recipes',
  objectId + '.json'
);
const recipe = await readJson(recipePath);
const sources = await Promise.all(
  recipe.sourceAliases.map(async alias => ({
    sourceCharacterId: Number(alias.sourceCharacterId),
    profile: await readProjectJson(alias.profilePath),
    fixture: await readProjectJson(alias.fixturePath),
    manifest: await readProjectJson(alias.acceptanceManifestPath),
    scenarioCases: await readProjectJson(alias.scenarioCasesPath),
  }))
);
const validation = validateOptimizationObjectAliasAcceptanceBundle({
  recipe,
  sources,
});
const requestedProductAcceptance = recipe.productVisualAcceptance ?? {};
const explicitlyPendingFailClosed =
  requestedProductAcceptance.status === 'pending' &&
  requestedProductAcceptance.formalAdmission === false &&
  requestedProductAcceptance.optimizationReady === false &&
  requestedProductAcceptance.acceptanceCommit == null &&
  requestedProductAcceptance.recordIdentity == null &&
  requestedProductAcceptance.acceptanceSubjectHash == null;
if (!validation.valid && !explicitlyPendingFailClosed) {
  throw new Error(
    'Optimization object alias acceptance invalid: ' +
      JSON.stringify(validation.issues)
  );
}

const outputPath = path.resolve(projectRoot, recipe.outputPath);
const output = JSON.stringify(validation.bundle, null, 2) + '\n';
if (writeMode) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, output, 'utf8');
}
if (assertClean) {
  let existing = null;
  try {
    existing = await fs.readFile(outputPath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing !== output) {
    throw new Error(
      'Optimization object acceptance output is stale: ' + recipe.outputPath
    );
  }
}

console.log(
  JSON.stringify(
    {
      optimizationObjectId: validation.bundle.optimizationObjectId,
      status: validation.bundle.status,
      ...validation.bundle.summary,
      bundleHash: validation.bundle.bundleHash,
      productVisualAcceptance: validation.bundle.productVisualAcceptance,
      optimizationReady: validation.bundle.optimizationReady,
      validationIssueCount: validation.issues.length,
      failClosedPendingBundle: !validation.valid && explicitlyPendingFailClosed,
    },
    null,
    2
  )
);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? (process.argv[index + 1] ?? null) : null;
}

async function readProjectJson(relativePath) {
  return readJson(path.resolve(projectRoot, relativePath));
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}
