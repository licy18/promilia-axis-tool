import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const generatedRoot = path.resolve(
  readArgument('--generated') ?? path.join(repoRoot, 'src', 'data', 'generated')
);
const sourceRoot = path.resolve(
  readArgument('--source') ??
    process.env.AZPR_MEDIA_ROOT ??
    'C:\\PC2\\Codex\\AzPr\\BWiki\\knowledge\\media\\images'
);
const outputRoot = path.resolve(
  readArgument('--out') ?? path.join(repoRoot, 'public', 'assets', 'loadout')
);

const [catalog, enemies, sourceEntries] = await Promise.all([
  readJson(path.join(generatedRoot, 'workbench-loadout-detail-catalog.json')),
  readJson(path.join(generatedRoot, 'enemies.json')),
  fs.readdir(sourceRoot, { withFileTypes: true }),
]);
const sourceFiles = new Map(
  sourceEntries
    .filter(entry => entry.isFile())
    .map(entry => [entry.name.toLowerCase(), entry.name])
);
const iconNames = uniqueSorted([
  ...(catalog.equipment ?? []).map(item => item.icon),
  ...(catalog.kibos ?? []).map(item => item.icon),
  ...(catalog.soulessences ?? []).map(item => item.icons?.small),
  ...(enemies.items ?? []).map(item => item.icon),
]);

await fs.mkdir(outputRoot, { recursive: true });
const missing = [];
let copied = 0;
for (const iconName of iconNames) {
  const sourceName = sourceFiles.get(iconName.toLowerCase());
  if (!sourceName) {
    missing.push(iconName);
    continue;
  }
  await fs.copyFile(
    path.join(sourceRoot, sourceName),
    path.join(outputRoot, iconName)
  );
  copied += 1;
}

console.log(
  JSON.stringify(
    {
      requested: iconNames.length,
      copied,
      missing,
      outputRoot: outputRoot.replaceAll('\\', '/'),
    },
    null,
    2
  )
);

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function uniqueSorted(values) {
  return [...new Set(values.filter(isSafePngFileName))].sort();
}

function isSafePngFileName(value) {
  const fileName = String(value ?? '').trim();
  return (
    fileName &&
    fileName === path.basename(fileName) &&
    fileName.toLowerCase().endsWith('.png')
  );
}
