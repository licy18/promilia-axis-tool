export function normalizeRepositoryPath(value) {
  return String(value ?? '')
    .replaceAll('\\', '/')
    .replace(/^\.\//u, '')
    .replace(/^\/+|\/+$/gu, '')
    .normalize('NFC');
}

export function classifyChangedFile(filePath) {
  const path = normalizeRepositoryPath(filePath);
  const lower = path.toLowerCase();
  const domains = new Set();

  if (!path) return result(path, ['unknown']);

  if (isDocumentation(lower)) domains.add('docs');
  if (isConfig(lower)) domains.add('config');
  if (isEvidence(lower)) domains.add('evidence');
  if (isTest(lower)) domains.add('tests');

  if (
    lower.startsWith('scripts/gates/') ||
    lower === 'scripts/run-smart-gates.mjs' ||
    lower === 'scripts/release-verify.mjs' ||
    lower.startsWith('src/__tests__/scripts/gates/')
  ) {
    domains.add('orchestration');
    domains.add('scripts');
    domains.add('config');
  }

  if (lower.startsWith('scripts/')) domains.add('scripts');
  if (
    lower.startsWith('src/simulation/') ||
    lower.startsWith('src/runtime/') ||
    (lower.startsWith('src/domain/') && !lower.includes('workbench')) ||
    lower.startsWith('src/__tests__/simulation/') ||
    lower.includes('verifiedcombatruntime') ||
    lower.includes('initialruntimestate')
  ) {
    domains.add('runtime');
  }

  if (
    lower.startsWith('src/machine-axis/') ||
    lower.startsWith('src/__tests__/machine-axis/') ||
    lower.startsWith('scripts/machine-axis/') ||
    lower.includes('machine-axis') ||
    lower.includes('machineaxis') ||
    lower.startsWith('fixtures/machine-axis/')
  ) {
    domains.add('machine-axis');
  }

  if (lower.includes('kibo') || lower.includes('奇波')) {
    domains.add('kibo');
  }

  if (
    lower === 'src/views/workbench.vue' ||
    lower.startsWith('src/features/workbench/') ||
    lower.startsWith('src/store/') ||
    lower.startsWith('src/__tests__/features/') ||
    lower.startsWith('src/__tests__/views/') ||
    lower.startsWith('src/__tests__/components/') ||
    lower.includes('/workbench') ||
    lower.startsWith('e2e/') ||
    lower.startsWith('src/router/') ||
    lower === 'src/app.vue' ||
    lower === 'src/main.js' ||
    lower.startsWith('src/assets/') ||
    lower.startsWith('src/styles/') ||
    lower.startsWith('public/')
  ) {
    domains.add('workbench');
  }

  if (
    lower.startsWith('acceptance-recipes/') ||
    lower.startsWith('.acceptance/') ||
    lower.includes('character-acceptance') ||
    lower.includes('characteracceptance') ||
    lower.includes('visual-acceptance') ||
    lower.includes('visualacceptance') ||
    lower.startsWith('fixtures/character-acceptance/')
  ) {
    domains.add('acceptance');
  }

  if (
    lower.includes('optimization-qualification') ||
    lower.includes('optimizationqualification')
  ) {
    domains.add('qualification');
  }

  if (lower.includes('binding-matrix') || lower.includes('bindingmatrix')) {
    domains.add('binding');
  }

  if (
    lower.startsWith('src/data/generated/') ||
    isGeneratedAuthorityReport(lower)
  ) {
    domains.add('generated');
  }

  if (
    lower.startsWith('src/data/') &&
    !lower.startsWith('src/data/generated/')
  ) {
    domains.add('runtime');
  }

  if (
    lower.startsWith('src/') &&
    !lower.startsWith('src/__tests__/') &&
    !domains.has('runtime') &&
    !domains.has('machine-axis') &&
    !domains.has('workbench') &&
    !domains.has('acceptance') &&
    !domains.has('generated')
  ) {
    domains.add('runtime');
  }

  if (domains.size === 0) domains.add('unknown');
  return result(path, [...domains].sort());
}

export function classifyChangedFiles(filePaths) {
  const files = [...new Set(filePaths.map(normalizeRepositoryPath))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'));
  const classifications = files.map(classifyChangedFile);
  const domains = [
    ...new Set(classifications.flatMap(entry => entry.domains)),
  ].sort((left, right) => left.localeCompare(right, 'en'));
  const unknownFiles = classifications
    .filter(entry => entry.domains.includes('unknown'))
    .map(entry => entry.path);
  return {
    files,
    classifications,
    domains,
    unknownFiles,
    failClosedEscalation: unknownFiles.length > 0,
  };
}

function result(path, domains) {
  return { path, domains };
}

function isDocumentation(lower) {
  return (
    /(^|\/)(readme[^/]*|agents|development_plan|project_manual|architecture|data_structure_changes|timeline_features|trial_release|machine_axis_cli)\.md$/u.test(
      lower
    ) ||
    (lower.endsWith('.md') &&
      (lower.startsWith('docs/') ||
        lower.startsWith('doc/') ||
        lower.startsWith('work/')))
  );
}

function isConfig(lower) {
  return (
    lower === 'package.json' ||
    lower === 'package-lock.json' ||
    lower === '.gitignore' ||
    lower === '.gitattributes' ||
    lower.startsWith('.github/') ||
    /(^|\/)(vite|vitest|playwright|eslint|prettier)[^/]*\.(js|mjs|cjs|ts|json)$/u.test(
      lower
    )
  );
}

function isTest(lower) {
  return (
    lower.startsWith('src/__tests__/') ||
    lower.startsWith('e2e/') ||
    lower.startsWith('fixtures/') ||
    /\.(test|spec)\.[cm]?[jt]sx?$/u.test(lower)
  );
}

function isEvidence(lower) {
  if (isGeneratedAuthorityReport(lower)) return false;
  return (
    lower.startsWith('work/') ||
    lower.startsWith('outputs/') ||
    lower.startsWith('test-results/') ||
    lower.startsWith('playwright-report/') ||
    lower.startsWith('reports/') ||
    /\.(png|jpe?g|webp|gif|log|txt)$/u.test(lower)
  );
}

function isGeneratedAuthorityReport(lower) {
  return (
    lower.startsWith('reports/m11/character-acceptance/') ||
    lower.startsWith('reports/m12/visual-acceptance/') ||
    /^reports\/m12\/m12-b3-(optimization-qualification|binding-matrix|.*evidence).*\.(json|md)$/u.test(
      lower
    ) ||
    lower === 'reports/verified-combat-mechanics-audit.json' ||
    lower === 'reports/production-import-audit.json' ||
    lower === 'reports/workbench-production-data-audit.json' ||
    lower === 'reports/applied-source-binding-audit.json' ||
    lower === 'reports/bundle-composition.json' ||
    lower === 'reports/production-preview-acceptance.json'
  );
}
