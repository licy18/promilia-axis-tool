#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  M10_PUBLIC_CHARACTER_ORDER,
  createCharacterCombatOutputRecords,
  createCharacterCombatPipelineArtifacts,
} from './character-combat/character-combat-profile-pipeline.mjs';
import { createCharacterCombatGoldenRuntime } from './character-combat/character-combat-golden-runtime.mjs';
import {
  createCharacterCombatPublicationPlan,
  detectCharacterCombatPublicationDrift,
  selectCharacterCombatPublicationRecords,
  writeCharacterCombatOutputsAtomically,
} from './character-combat/character-combat-publication.mjs';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');
const GENERATED_ROOT = path.join(REPO_ROOT, 'src', 'data', 'generated');
const options = parseArgs(process.argv.slice(2));

const mechanicsPackage = readJson(
  path.join(GENERATED_ROOT, 'verified-combat-mechanics-package.json')
);
const characterCatalog = readJson(path.join(GENERATED_ROOT, 'characters.json'));
const workbenchSeed = readJson(
  path.join(GENERATED_ROOT, 'workbench-seed.json')
);
const recipePaths = fs
  .readdirSync(path.join(SCRIPT_ROOT, 'character-combat', 'profile-recipes'))
  .filter(fileName => fileName.endsWith('.json'))
  .map(fileName =>
    path.join(SCRIPT_ROOT, 'character-combat', 'profile-recipes', fileName)
  );
const allRecipes = recipePaths.map(readJson);
const recipes =
  options.ownerId == null
    ? allRecipes
    : allRecipes.filter(recipe => Number(recipe.ownerId) === options.ownerId);
if (options.ownerId != null && recipes.length !== 1) {
  throw new Error(`character combat recipe missing: ${options.ownerId}`);
}
const compiledOwnerContracts = recipes.map(recipe =>
  readJson(
    path.join(
      GENERATED_ROOT,
      'character-combat-owner-contracts',
      `${Number(recipe.ownerId)}.json`
    )
  )
);
const goldenRuntimeByOwner = new Map(
  await Promise.all(
    recipes.map(async recipe => [
      Number(recipe.ownerId),
      await createCharacterCombatGoldenRuntime({
        repositoryRoot: REPO_ROOT,
        mechanicsPackage,
        recipe,
      }),
    ])
  )
);

const reportsByOwner = new Map();
for (const recipe of recipes) {
  const ownerId = Number(recipe.ownerId);
  reportsByOwner.set(ownerId, {
    actionOccupancy: readOptionalArtifact(
      recipe.evidenceArtifacts?.occupancyAudit
    ),
    hiddenInputDerivation: readOptionalArtifact(
      recipe.evidenceArtifacts?.hiddenInputAudit
    ),
  });
}

const artifacts = createCharacterCombatPipelineArtifacts({
  mechanicsPackage,
  characterCatalog,
  skills: workbenchSeed.gameData?.skills ?? [],
  recipes,
  compiledOwnerContracts,
  goldenRuntimeByOwner,
  reportsByOwner,
});
const publicationRecords = selectCharacterCombatPublicationRecords({
  records: createCharacterCombatOutputRecords(artifacts),
  ownerId: options.ownerId,
});
const outputRoot =
  options.outputRoot ??
  (options.ownerId == null || options.assertClean
    ? REPO_ROOT
    : path.join(
        REPO_ROOT,
        'work',
        'character-combat-staging',
        String(options.ownerId)
      ));
const outputs = createCharacterCombatPublicationPlan({
  records: publicationRecords,
  outputRoot,
});
const drift = detectCharacterCombatPublicationDrift(outputs);

if (options.assertClean && drift.length > 0) {
  console.error(
    `character combat profile drift: ${drift
      .map(([filePath]) => path.relative(REPO_ROOT, filePath))
      .join(', ')}`
  );
  process.exitCode = 1;
} else if (options.write) {
  writeCharacterCombatOutputsAtomically(outputs);
}

console.log(
  JSON.stringify(
    {
      status: drift.length ? (options.write ? 'written' : 'drift') : 'clean',
      mode: options.ownerId == null ? 'all' : 'owner',
      ownerId: options.ownerId,
      compiledProfileCount: artifacts.profiles.length,
      publicCharacterCount: artifacts.coverageManifest.summary.characterCount,
      outputs: outputs.map(([filePath]) =>
        path.relative(REPO_ROOT, filePath).replaceAll('\\', '/')
      ),
    },
    null,
    2
  )
);

function readOptionalArtifact(relativePath) {
  if (!relativePath) return null;
  const filePath = path.resolve(REPO_ROOT, relativePath);
  if (!filePath.startsWith(`${REPO_ROOT}${path.sep}`)) {
    throw new Error(
      `character combat evidence path escapes repository: ${relativePath}`
    );
  }
  return readJson(filePath);
}

function parseArgs(argv) {
  const parsed = {
    ownerId: null,
    write: false,
    assertClean: false,
    outputRoot: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--owner') {
      const ownerId = Number(argv[index + 1]);
      if (!M10_PUBLIC_CHARACTER_ORDER.includes(ownerId)) {
        throw new Error(`invalid public character owner: ${argv[index + 1]}`);
      }
      parsed.ownerId = ownerId;
      index += 1;
    } else if (arg === '--all') {
      parsed.ownerId = null;
    } else if (arg === '--write') {
      parsed.write = true;
    } else if (arg === '--assert-clean') {
      parsed.assertClean = true;
    } else if (arg === '--output-root') {
      parsed.outputRoot = path.resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  if (!parsed.write && !parsed.assertClean) parsed.write = true;
  if (parsed.write && parsed.assertClean) {
    throw new Error('--write and --assert-clean are mutually exclusive');
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
