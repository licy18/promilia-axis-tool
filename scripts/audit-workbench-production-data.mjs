import assert from 'node:assert/strict';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createWorkbenchSkillCoreProjection,
  createWorkbenchSkillDiagnosticsProjection,
} from './lib/workbench-skill-runtime-projection.mjs';
import { createWorkbenchLoadoutDetailProjection } from './lib/workbench-loadout-detail-projection.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const generatedRoot = path.join(repositoryRoot, 'src', 'data', 'generated');
const ENEMY_ATTRIBUTE_KEYS = new Set([
  'ATK',
  'MAXHP',
  'DEF',
  'MDEF',
  'WEAKNESS_POINT_MAX',
  'NORMAL_DEFENSE',
  'FIRE_DEFENSE',
  'WIND_DEFENSE',
  'EARTH_DEFENSE',
  'WOOD_DEFENSE',
  'ICE_DEFENSE',
  'WATER_DEFENSE',
  'ELEC_DEFENSE',
  'LIGHT_DEFENSE',
  'DARK_DEFENSE',
]);
const outputPath = path.resolve(
  repositoryRoot,
  readStringArgument('--output', 'reports/workbench-production-data-audit.json')
);

const files = await loadGeneratedFiles([
  'characters.json',
  'elements.json',
  'enemies.json',
  'equipment.json',
  'kibos.json',
  'manifest.json',
  'skill-asset-evidence.json',
  'skill-level-crosscheck.json',
  'skill-logic-index.json',
  'skills.json',
  'soulessences.json',
  'value-param-index.json',
  'workbench-kibo-action-catalog.json',
  'workbench-loadout-detail-catalog.json',
  'workbench-seed.json',
  'workbench-skill-core.json',
  'workbench-skill-diagnostics.json',
]);

const expectedSkillCoreProjection = normalizeJsonValue(
  createWorkbenchSkillCoreProjection({
    generatedAt: files['workbench-skill-core.json'].data.generatedAt,
    skillLogicIndex: files['skill-logic-index.json'].data,
    skillLevelCrossCheck: files['skill-level-crosscheck.json'].data,
    valueParamIndex: files['value-param-index.json'].data,
  })
);
const expectedSkillDiagnosticsProjection = normalizeJsonValue(
  createWorkbenchSkillDiagnosticsProjection({
    generatedAt: files['workbench-skill-diagnostics.json'].data.generatedAt,
    skillAssetEvidence: files['skill-asset-evidence.json'].data,
  })
);
const skillCoreProjectionMatches = deepEqual(
  files['workbench-skill-core.json'].data,
  expectedSkillCoreProjection
);
const skillDiagnosticsProjectionMatches = deepEqual(
  files['workbench-skill-diagnostics.json'].data,
  expectedSkillDiagnosticsProjection
);
const seedAudit = auditWorkbenchSeed(files);
const kiboActionCatalogMatches = auditKiboActionCatalog(files);
const loadoutDetailCatalogMatches = auditLoadoutDetailCatalog(files);
const manifestAudit = {
  workbenchSeedRegistered:
    files['manifest.json'].data.files?.workbenchSeed === 'workbench-seed.json',
  workbenchSkillCoreRegistered:
    files['manifest.json'].data.files?.workbenchSkillCore ===
    'workbench-skill-core.json',
  workbenchSkillDiagnosticsRegistered:
    files['manifest.json'].data.files?.workbenchSkillDiagnostics ===
    'workbench-skill-diagnostics.json',
  workbenchKiboActionCatalogRegistered:
    files['manifest.json'].data.files?.workbenchKiboActionCatalog ===
    'workbench-kibo-action-catalog.json',
  workbenchLoadoutDetailCatalogRegistered:
    files['manifest.json'].data.files?.workbenchLoadoutDetailCatalog ===
    'workbench-loadout-detail-catalog.json',
};
const fullGameCatalogBytes = sumFileBytes(files, [
  'characters.json',
  'skills.json',
  'enemies.json',
  'elements.json',
  'equipment.json',
  'kibos.json',
  'soulessences.json',
]);
const fullSkillRuntimeBytes = sumFileBytes(files, [
  'skill-asset-evidence.json',
  'skill-level-crosscheck.json',
  'skill-logic-index.json',
  'value-param-index.json',
]);
const status = {
  seedProjectionMatches: Object.values(seedAudit.checks).every(Boolean),
  kiboActionCatalogMatches,
  loadoutDetailCatalogMatches,
  skillCoreProjectionMatches,
  skillDiagnosticsProjectionMatches,
  manifestMatches: Object.values(manifestAudit).every(Boolean),
};
const report = {
  schemaVersion: 2,
  kind: 'workbench-production-data-audit',
  status,
  seedAudit,
  skillRuntimeAudit: {
    checks: {
      coreProjectionMatchesFullData: skillCoreProjectionMatches,
      diagnosticsProjectionMatchesFullEvidence:
        skillDiagnosticsProjectionMatches,
    },
    counts: {
      ...files['workbench-skill-core.json'].data.counts,
      ...files['workbench-skill-diagnostics.json'].data.counts,
    },
    size: createSizeSummary(
      fullSkillRuntimeBytes,
      files['workbench-skill-core.json'].bytes +
        files['workbench-skill-diagnostics.json'].bytes
    ),
    coreBytes: files['workbench-skill-core.json'].bytes,
    diagnosticsBytes: files['workbench-skill-diagnostics.json'].bytes,
  },
  manifestAudit,
  gameCatalogSize: createSizeSummary(
    fullGameCatalogBytes,
    files['workbench-seed.json'].bytes +
      files['workbench-kibo-action-catalog.json'].bytes
  ),
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      output: toRepositoryPath(outputPath),
      status,
      seedCounts: seedAudit.counts,
      skillRuntimeCounts: report.skillRuntimeAudit.counts,
      gameCatalogSize: report.gameCatalogSize,
      skillRuntimeSize: report.skillRuntimeAudit.size,
    },
    null,
    2
  )
);

if (
  process.argv.includes('--assert-clean') &&
  Object.values(status).some(value => !value)
) {
  process.exitCode = 1;
}

function auditWorkbenchSeed(loadedFiles) {
  const seed = loadedFiles['workbench-seed.json'].data;
  const characters = loadedFiles['characters.json'].data.items ?? [];
  const skills = loadedFiles['skills.json'].data.items ?? [];
  const enemies = loadedFiles['enemies.json'].data.items ?? [];
  const elements = loadedFiles['elements.json'].data.items ?? [];
  const equipment = loadedFiles['equipment.json'].data.items ?? [];
  const kibos = loadedFiles['kibos.json'].data.items ?? [];
  const soulessences = loadedFiles['soulessences.json'].data.items ?? [];
  const expectedEnemies = enemies.map(enemy => ({
    id: enemy.id,
    name: enemy.name,
    elementIds: enemy.elementIds,
    enemyType: enemy.enemyType,
    property: {
      id: enemy.property.id,
      exists: enemy.property.exists,
      baseAttributeId: enemy.property.baseAttributeId,
      baseAttributes: (enemy.property.baseAttributes ?? []).filter(attribute =>
        ENEMY_ATTRIBUTE_KEYS.has(attribute.key)
      ),
    },
    icon: enemy.icon,
  }));
  const expectedElements = elements.map(({ id, name, abbrName, color }) => ({
    id,
    name,
    abbrName,
    color,
  }));
  const expectedEquipment = equipment.map(({ id, name, type, rarity }) => ({
    id,
    name,
    type,
    rarity,
  }));
  const expectedKibos = kibos.map(({ id, name, element, stage }) => ({
    id,
    name,
    element,
    stage,
  }));
  const expectedSoulessences = soulessences.map(({ id, name, rarity }) => ({
    id,
    name,
    rarity,
  }));
  const counts = {
    characters: characters.length,
    skills: skills.length,
    enemies: enemies.length,
    elements: elements.length,
    equipment: equipment.length,
    kibos: kibos.length,
    soulessences: soulessences.length,
  };

  return {
    checks: {
      schemaVersionCurrent: seed.schemaVersion === 3,
      countsMatch: deepEqual(seed.counts, counts),
      characterIdsMatch: deepEqual(
        seed.gameData.characters.map(item => item.id),
        characters.map(item => item.id)
      ),
      skillIdsMatch: deepEqual(
        seed.gameData.skills.map(item => item.id),
        skills.map(item => item.id)
      ),
      enemiesMatch: deepEqual(seed.gameData.enemies, expectedEnemies),
      elementsMatch: deepEqual(seed.gameData.elements, expectedElements),
      equipmentMatches: deepEqual(seed.gameData.equipment, expectedEquipment),
      kibosMatch: deepEqual(seed.gameData.kibos, expectedKibos),
      soulessencesMatch: deepEqual(
        seed.gameData.soulessences,
        expectedSoulessences
      ),
    },
    counts,
  };
}

function auditKiboActionCatalog(loadedFiles) {
  const catalog = loadedFiles['workbench-kibo-action-catalog.json'].data;
  const kibos = loadedFiles['kibos.json'].data.items ?? [];
  const projectIdentity = items =>
    (items ?? []).map(kibo => ({
      kiboId: kibo.kiboId ?? kibo.id,
      actions: (kibo.actions ?? kibo.skills ?? []).map(skill => ({
        skillId: skill.skillId,
        kind: skill.kind,
        icon: skill.icon,
        name: skill.name,
        durationFrames: skill.durationFrames,
      })),
    }));
  const actions = (catalog.items ?? []).flatMap(kibo => kibo.actions ?? []);
  const cooldownsValid = actions.every(
    action =>
      Number(action.cooldownMs) > 0 &&
      Number.isInteger(Number(action.cooldownCount)) &&
      Number(action.cooldownCount) >= 1 &&
      Number(action.cooldownDefaultMs) >= 0 &&
      Number(action.kiboVersusCooldownMs) > 0 &&
      Number(action.kiboVersusCooldownDefaultMs) >= 0
  );

  return (
    catalog.schemaVersion === 2 &&
    catalog.kind === 'workbench-kibo-action-catalog' &&
    catalog.source === 'pet-table-and-azpr-unity-skill-control-root' &&
    String(catalog.sources?.cooldown ?? '').includes('skillsub_logic.json') &&
    deepEqual(projectIdentity(catalog.items), projectIdentity(kibos)) &&
    actions.length > 0 &&
    cooldownsValid
  );
}

function auditLoadoutDetailCatalog(loadedFiles) {
  const catalog = loadedFiles['workbench-loadout-detail-catalog.json'].data;
  return deepEqual(
    catalog,
    createWorkbenchLoadoutDetailProjection({
      generatedAt: catalog.generatedAt,
      sources: catalog.sources,
      equipment: loadedFiles['equipment.json'].data.items ?? [],
      kibos: loadedFiles['kibos.json'].data.items ?? [],
      soulessences: loadedFiles['soulessences.json'].data.items ?? [],
    })
  );
}

async function loadGeneratedFiles(fileNames) {
  return Object.fromEntries(
    await Promise.all(
      fileNames.map(async fileName => {
        const filePath = path.join(generatedRoot, fileName);
        const [content, fileStat] = await Promise.all([
          readFile(filePath, 'utf8'),
          stat(filePath),
        ]);
        return [fileName, { data: JSON.parse(content), bytes: fileStat.size }];
      })
    )
  );
}

function deepEqual(left, right) {
  try {
    assert.deepStrictEqual(left, right);
    return true;
  } catch {
    return false;
  }
}

function normalizeJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function sumFileBytes(loadedFiles, fileNames) {
  return fileNames.reduce(
    (total, fileName) => total + loadedFiles[fileName].bytes,
    0
  );
}

function createSizeSummary(fullBytes, projectionBytes) {
  return {
    fullBytes,
    projectionBytes,
    savedBytes: fullBytes - projectionBytes,
    reductionPercent: Number(
      (((fullBytes - projectionBytes) / fullBytes) * 100).toFixed(2)
    ),
  };
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
