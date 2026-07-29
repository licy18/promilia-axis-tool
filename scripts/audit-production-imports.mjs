import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { init, parse as parseImports } from 'es-module-lexer';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourceRoot = path.join(repositoryRoot, 'src');
const codeExtensions = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.vue',
]);
const resolvableExtensions = [...codeExtensions, '.json'];
const outputArgumentIndex = process.argv.indexOf('--output');
const outputPath = path.resolve(
  repositoryRoot,
  outputArgumentIndex >= 0 && process.argv[outputArgumentIndex + 1]
    ? process.argv[outputArgumentIndex + 1]
    : 'reports/production-import-audit.json'
);

await init;

const sourceCodeFiles = (await collectFiles(sourceRoot)).filter(filePath => {
  const relativePath = toRepositoryPath(filePath);
  return (
    codeExtensions.has(path.extname(filePath)) &&
    !relativePath.startsWith('src/__tests__/')
  );
});
const testEntryFiles = [
  ...(await collectFiles(path.join(sourceRoot, '__tests__'))),
  ...(await collectFiles(path.join(repositoryRoot, 'e2e'))),
].filter(filePath => codeExtensions.has(path.extname(filePath)));
const productionEntryFiles = [
  path.join(sourceRoot, 'main.js'),
  path.join(repositoryRoot, 'scripts', 'machine-axis-cli-entry.mjs'),
  path.join(sourceRoot, 'machine-axis', 'workbenchMachineAxisAdapter.js'),
];

const productionTrace = await traceImports(productionEntryFiles);
const testTrace = await traceImports(testEntryFiles);
const productionFiles = sourceCodeFiles
  .filter(filePath => productionTrace.has(filePath))
  .map(toRepositoryPath)
  .sort();
const testOnlyFiles = sourceCodeFiles
  .filter(filePath => !productionTrace.has(filePath) && testTrace.has(filePath))
  .map(toRepositoryPath)
  .sort();
const unreferencedFiles = sourceCodeFiles
  .filter(
    filePath => !productionTrace.has(filePath) && !testTrace.has(filePath)
  )
  .map(toRepositoryPath)
  .sort();
const allowedTestOnlyFiles = testOnlyFiles.filter(isAllowedTestOnlyFile);
const unexpectedTestOnlyFiles = testOnlyFiles.filter(
  filePath => !isAllowedTestOnlyFile(filePath)
);

const report = {
  schemaVersion: 1,
  kind: 'production-import-audit',
  entrypoints: {
    production: productionEntryFiles.map(toRepositoryPath).sort(),
    tests: testEntryFiles.map(toRepositoryPath).sort(),
  },
  summary: {
    sourceCodeFileCount: sourceCodeFiles.length,
    productionReachableCount: productionFiles.length,
    testOnlyCount: testOnlyFiles.length,
    allowedTestOnlyCount: allowedTestOnlyFiles.length,
    unexpectedTestOnlyCount: unexpectedTestOnlyFiles.length,
    unreferencedCount: unreferencedFiles.length,
    productionReachableByArea: countByArea(productionFiles),
    testOnlyByArea: countByArea(testOnlyFiles),
    unreferencedByArea: countByArea(unreferencedFiles),
  },
  productionReachableFiles: productionFiles,
  testOnlyFiles,
  allowedTestOnlyFiles,
  unexpectedTestOnlyFiles,
  unreferencedFiles,
  limitations: [
    'Only relative imports and @/ aliases with static string specifiers are followed.',
    'Runtime-computed module paths and globally registered components are not inferred.',
    'Generated JSON and style assets are resolved as leaves but excluded from code counts.',
  ],
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

// eslint-disable-next-line no-console
console.log(
  JSON.stringify(
    {
      output: toRepositoryPath(outputPath),
      ...report.summary,
    },
    null,
    2
  )
);

if (
  process.argv.includes('--assert-clean') &&
  (unreferencedFiles.length || unexpectedTestOnlyFiles.length)
) {
  process.exitCode = 1;
}

async function traceImports(entryFiles) {
  const visited = new Set();
  const pending = entryFiles.map(filePath => path.resolve(filePath));

  while (pending.length) {
    const filePath = pending.pop();
    if (visited.has(filePath) || !(await fileExists(filePath))) {
      continue;
    }
    visited.add(filePath);
    if (!codeExtensions.has(path.extname(filePath))) {
      continue;
    }

    const source = await readModuleSource(filePath);
    const [imports] = parseImports(source);
    for (const importRecord of imports) {
      const specifier = importRecord.n;
      if (!specifier) {
        continue;
      }
      const resolvedImport = await resolveLocalImport(filePath, specifier);
      if (resolvedImport && !visited.has(resolvedImport)) {
        pending.push(resolvedImport);
      }
    }
  }

  return visited;
}

async function readModuleSource(filePath) {
  const source = await readFile(filePath, 'utf8');
  if (path.extname(filePath) !== '.vue') {
    return source;
  }

  const { descriptor, errors } = parseSfc(source, { filename: filePath });
  if (errors.length) {
    throw new Error(`Unable to parse ${toRepositoryPath(filePath)}`);
  }
  return [descriptor.script?.content, descriptor.scriptSetup?.content]
    .filter(Boolean)
    .join('\n');
}

async function resolveLocalImport(importerPath, specifier) {
  let unresolvedPath;
  if (specifier.startsWith('@/')) {
    unresolvedPath = path.join(sourceRoot, specifier.slice(2));
  } else if (specifier.startsWith('.')) {
    unresolvedPath = path.resolve(path.dirname(importerPath), specifier);
  } else {
    return null;
  }

  const candidates = path.extname(unresolvedPath)
    ? [unresolvedPath]
    : [
        ...resolvableExtensions.map(
          extension => `${unresolvedPath}${extension}`
        ),
        ...resolvableExtensions.map(extension =>
          path.join(unresolvedPath, `index${extension}`)
        ),
      ];
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return path.resolve(candidate);
    }
  }
  return null;
}

async function collectFiles(directoryPath) {
  if (!(await fileExists(directoryPath))) {
    return [];
  }
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(entry => {
      const entryPath = path.join(directoryPath, entry.name);
      return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
    })
  );
  return files.flat();
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function countByArea(filePaths) {
  return Object.fromEntries(
    [
      ...filePaths.reduce((counts, filePath) => {
        const segments = filePath.split('/');
        const area = segments
          .slice(0, Math.min(3, segments.length - 1))
          .join('/');
        counts.set(area, (counts.get(area) ?? 0) + 1);
        return counts;
      }, new Map()),
    ].sort(([left], [right]) => left.localeCompare(right))
  );
}

function isAllowedTestOnlyFile(filePath) {
  return (
    filePath.startsWith('src/domain/fixtures/') ||
    filePath.startsWith('src/simulation/fixtures/') ||
    filePath === 'src/simulation/index.js'
  );
}

function toRepositoryPath(filePath) {
  return path.relative(repositoryRoot, filePath).split(path.sep).join('/');
}
