import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const extractorRoot = path.resolve(
  readArgument('--extractor') ??
    process.env.AZPR_EXTRACTOR_ROOT ??
    'C:\\Codex\\AzPr Extractor'
);
const generatedRoot = path.resolve(
  readArgument('--generated') ?? path.join(repoRoot, 'src', 'data', 'generated')
);
const outputRoot = path.resolve(
  readArgument('--out') ?? path.join(repoRoot, 'public', 'assets', 'actions')
);
const sourceRoot = path.join(
  extractorRoot,
  'ExtractedAssets',
  'Unity',
  'default_package',
  'Arts',
  'UI',
  'Icon',
  'SkillIcon'
);

const [seed, kibos, sourceEntries] = await Promise.all([
  readJson(path.join(generatedRoot, 'workbench-seed.json')),
  readJson(path.join(generatedRoot, 'kibos.json')),
  fs.readdir(sourceRoot, { withFileTypes: true }),
]);
const sourceDirectories = new Map(
  sourceEntries
    .filter(entry => entry.isDirectory())
    .map(entry => [entry.name, entry.name])
);
const iconNames = [
  ...(seed.gameData?.skills ?? []).map(skill => skill.icon),
  ...(kibos.items ?? []).flatMap(kibo =>
    (kibo.skills ?? []).map(skill => skill.icon)
  ),
]
  .filter(isSafePngFileName)
  .filter((icon, index, icons) => icons.indexOf(icon) === index)
  .sort();

await fs.mkdir(outputRoot, { recursive: true });
const missing = [];
let copied = 0;
for (const iconName of iconNames) {
  const sourceDirectory = sourceDirectories.get(iconName);
  if (!sourceDirectory) {
    missing.push(iconName);
    continue;
  }
  const textureRoot = path.join(sourceRoot, sourceDirectory, 'Texture2D');
  const textureFiles = (await fs.readdir(textureRoot)).filter(fileName =>
    fileName.toLowerCase().endsWith('.png')
  );
  if (textureFiles.length === 0) {
    missing.push(iconName);
    continue;
  }
  await fs.copyFile(
    path.join(textureRoot, textureFiles.sort()[0]),
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

function isSafePngFileName(value) {
  const fileName = String(value ?? '').trim();
  return (
    fileName &&
    fileName === path.basename(fileName) &&
    fileName.toLowerCase().endsWith('.png')
  );
}
