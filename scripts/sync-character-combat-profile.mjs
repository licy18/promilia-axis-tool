#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  M10_PUBLIC_CHARACTER_ORDER,
  createCharacterCombatOutputRecords,
} from './character-combat/character-combat-profile-pipeline.mjs';
import {
  createCharacterCombatPublicationPlan,
  detectCharacterCombatPublicationDrift,
  selectCharacterCombatPublicationRecords,
  writeCharacterCombatOutputsAtomically,
} from './character-combat/character-combat-publication.mjs';
import { createVerifiedCombatMechanicsBuild } from './sync-verified-combat-mechanics.mjs';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');
const options = parseArgs(process.argv.slice(2));

const build = await createVerifiedCombatMechanicsBuild();
const recipes = build.recipes;
if (
  options.ownerId != null &&
  !recipes.some(recipe => Number(recipe.ownerId) === options.ownerId)
) {
  throw new Error(`character combat recipe missing: ${options.ownerId}`);
}
const artifacts = build.pipelineArtifacts;
const allPublicationRecords = [
  ...createCharacterCombatOutputRecords(artifacts),
  {
    relativePath:
      'src/data/generated/verified-combat-mechanics-package.json',
    content: `${JSON.stringify(build.mechanicsPackage, null, 2)}\n`,
  },
];
const publicationRecords = selectCharacterCombatPublicationRecords({
  records: allPublicationRecords,
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
      compiledProfileCount:
        options.ownerId == null
          ? artifacts.profiles.length
          : artifacts.profiles.filter(
              profile => Number(profile.owner.ownerId) === options.ownerId
            ).length,
      publicCharacterCount: artifacts.coverageManifest.summary.characterCount,
      outputs: outputs.map(([filePath]) =>
        path.relative(REPO_ROOT, filePath).replaceAll('\\', '/')
      ),
    },
    null,
    2
  )
);

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
