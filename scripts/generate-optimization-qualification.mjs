import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createOptimizationQualificationArtifacts } from './optimization-qualification/optimization-qualification-generation.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');

const artifacts = await createOptimizationQualificationArtifacts({
  projectRoot,
});
const outputs = new Map([
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-soulessence-effect-coverage.json'
    ),
    jsonText(artifacts.soulEssenceEffects),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-soulessence-effect-coverage.md'
    ),
    createSoulEssenceMarkdown(artifacts.soulEssenceEffects),
  ],
  [
    path.join(
      projectRoot,
      'src',
      'data',
      'generated',
      'soulessence-effect-mechanics.json'
    ),
    jsonText(artifacts.soulEssenceEffects),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-dynamic-loadout-effect-census.json'
    ),
    jsonText(artifacts.dynamicLoadoutEffectCensus),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-dynamic-loadout-effect-census.md'
    ),
    createDynamicLoadoutMarkdown(artifacts.dynamicLoadoutEffectCensus),
  ],
  [
    path.join(
      projectRoot,
      'src',
      'data',
      'generated',
      'dynamic-loadout-effect-mechanics.json'
    ),
    jsonText(artifacts.dynamicLoadoutEffectCensus),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-optimization-qualification-roster.json'
    ),
    jsonText(artifacts.roster),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-optimization-qualification-manifests.json'
    ),
    jsonText(artifacts.manifests),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-optimization-qualification-gaps.json'
    ),
    jsonText(artifacts.gaps),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-optimization-qualification-binding-matrix.json'
    ),
    jsonText(artifacts.bindingMatrix),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-optimization-qualification-summary.json'
    ),
    jsonText(artifacts.summary),
  ],
  [
    path.join(
      projectRoot,
      'reports',
      'm12',
      'm12-b3-optimization-qualification-summary.md'
    ),
    artifacts.markdown,
  ],
  [
    path.join(
      projectRoot,
      'src',
      'data',
      'generated',
      'optimization-qualification-catalog.json'
    ),
    jsonText(artifacts.catalog),
  ],
]);

if (writeMode) await writeOutputs(outputs);
if (assertClean) await assertOutputsClean(outputs);
process.stdout.write(`${JSON.stringify(artifacts.summary, null, 2)}\n`);

async function writeOutputs(entries) {
  for (const [outputPath, content] of entries) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, content, 'utf8');
  }
}

async function assertOutputsClean(entries) {
  const drift = [];
  for (const [outputPath, expected] of entries) {
    let actual = null;
    try {
      actual = await fs.readFile(outputPath, 'utf8');
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    if (actual !== expected) {
      drift.push(path.relative(projectRoot, outputPath).replaceAll('\\', '/'));
    }
  }
  if (drift.length) {
    throw new Error(`optimization-qualification-output-drift:${drift.join(',')}`);
  }
}

function jsonText(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function createSoulEssenceMarkdown(catalog) {
  const applied = catalog.definitions.filter(
    definition => definition.runtimeStatus === 'runtime-applied'
  );
  return '# M12-B3 Soul Essence Effect Coverage\n\n' +
    `- Catalog: \`${catalog.catalogHash}\`\n` +
    `- Source closure: ${catalog.summary.controlClosureCount}/62 controls, ${catalog.summary.resourceReferenceCount} resource references, ${catalog.summary.missingResourceReferenceCount} missing\n` +
    `- Runtime applied: ${catalog.summary.runtimeAppliedCount}/62\n` +
    `- Runtime unresolved: ${catalog.summary.unresolvedCount}/62\n` +
    `- Applied identities: ${applied.map(definition => `${definition.soulEssenceId}:${definition.effectSkillId}`).join(', ') || 'none'}\n` +
    '- Policy: only source-closed trigger, condition, target, formula, lifecycle, and star values are applied; descriptions do not provide numeric runtime values.\n';
}

function createDynamicLoadoutMarkdown(census) {
  const families = Object.entries(census.summary.byMechanismFamily)
    .map(([family, count]) => {
      const objects = census.records
        .filter(record => record.mechanismFamily === family)
        .map(record => `${record.objectKind}:${record.objectId}`)
        .join(', ');
      return `- ${family} (${count}): ${objects}`;
    })
    .join('\n');
  const applied = census.records.filter(
    record => record.runtimeStatus === 'runtime-applied'
  );
  return '# M12-B3-C Dynamic Loadout Effect Census\n\n' +
    `- Census: \`${census.censusHash}\`\n` +
    `- Soul essences: ${census.summary.soulEssenceCount}\n` +
    `- Set skills: ${census.summary.setSkillCount}\n` +
    `- Runtime applied: ${census.summary.runtimeAppliedCount}\n` +
    `- Runtime unapplied: ${census.summary.runtimeUnappliedCount}\n` +
    `- Applied objects: ${applied.map(record => `${record.objectKind}:${record.objectId}`).join(', ') || 'none'}\n\n` +
    `## Mechanism Families\n\n${families}\n\n` +
    'Set-piece threshold activation is indexed separately from runtime effect application. Meeting a threshold never makes an unapplied set effect executable.\n';
}
