import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOptimizationObjectAliasAcceptanceBundle } from '../src/character-acceptance/optimizationObjectAliasProtocol.js';
import { verifyOptimizationObjectSignoffRecord } from './character-acceptance/signoff-record-verification.mjs';

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
// 对象级 signoff 认证（P1-3）：两遍派生。第一遍取当前 acceptanceSubjectHash，
// 用 acceptanceCommit 指向的 git 对象读取并认证不可变 signoff record（要求
// record 的 acceptanceSubjectHash 等于当前派生值——漂移后旧 record 失效）。
const previewValidation = validateOptimizationObjectAliasAcceptanceBundle({
  recipe,
  sources,
  signoffRecordVerified: false,
});
const previewSubjectHash =
  previewValidation.bundle?.productAcceptanceBinding?.acceptanceSubjectHash ??
  null;
const signoffVerification = verifyOptimizationObjectSignoffRecord(recipe, {
  projectRoot,
  derived: { acceptanceSubjectHash: previewSubjectHash },
});
const validation = validateOptimizationObjectAliasAcceptanceBundle({
  recipe,
  sources,
  signoffRecordVerified: signoffVerification.verified,
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
// 把 signoff record authentication 写入输出 bundle（P2：manifest 必须携带
// 可审计的认证结果，不能只靠调用方布尔参数）
const outputBundle = {
  ...validation.bundle,
  ...(signoffVerification.authentication == null
    ? {}
    : {
        signoffRecordAuthentication: {
          status: signoffVerification.authentication.status,
          acceptanceCommit: signoffVerification.authentication.acceptanceCommit,
          signoffRecordPath:
            signoffVerification.authentication.signoffRecordPath,
          recordSha256: signoffVerification.authentication.recordSha256,
          issues: signoffVerification.authentication.issues,
        },
      }),
};
const output = JSON.stringify(outputBundle, null, 2) + '\n';
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
