import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  GATE_DEFINITIONS,
  GATE_DEPENDENCY_MAP_VERSION,
  GATE_FINGERPRINT_SCHEMA_VERSION,
  GATE_SYSTEM_FILES,
} from './gate-definitions.mjs';
import { normalizeRepositoryPath } from './git-change-classifier.mjs';

const execFileAsync = promisify(execFile);
const MAX_GIT_BUFFER = 64 * 1024 * 1024;

export function canonicalStringify(value) {
  return stringifyCanonical(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function globMatches(filePath, pattern) {
  const normalizedPath = normalizeRepositoryPath(filePath);
  const normalizedPattern = normalizeRepositoryPath(pattern);
  return globToRegExp(normalizedPattern).test(normalizedPath);
}

export function matchesAnyPattern(filePath, patterns = []) {
  return patterns.some(pattern => globMatches(filePath, pattern));
}

export async function createRepositorySnapshot({
  repositoryRoot,
  base = null,
  definitions = GATE_DEFINITIONS,
  simulatedChanges = [],
} = {}) {
  const root = path.resolve(repositoryRoot);
  const normalizedSimulatedChanges = [
    ...new Set(simulatedChanges.map(normalizeRepositoryPath)),
  ]
    .filter(Boolean)
    .sort(comparePaths);
  const includePatterns = [
    ...new Set([
      ...definitions.flatMap(gate => gate.dependencies),
      ...GATE_SYSTEM_FILES,
    ]),
  ];
  const gitState = await readGitState({ repositoryRoot: root, base });
  const inventory = await collectRepositoryInventory({
    repositoryRoot: root,
    includePatterns,
    untrackedSummaryPaths: gitState.untrackedSummaryPaths,
  });
  const relevantUntrackedFiles = inventory.entries
    .filter(entry => entry.state === 'untracked')
    .map(entry => entry.path);
  const untrackedPlaceholders = gitState.untrackedSummaryPaths.filter(
    entry =>
      !relevantUntrackedFiles.some(
        file => file === entry || file.startsWith(`${entry}/`)
      )
  );
  const changedFiles = normalizedSimulatedChanges.length
    ? normalizedSimulatedChanges
    : [
        ...new Set([
          ...gitState.comparisonChangedFiles,
          ...relevantUntrackedFiles,
          ...untrackedPlaceholders,
        ]),
      ].sort(comparePaths);
  const simulatedDigests = new Map(
    normalizedSimulatedChanges.map(file => [
      file,
      sha256(`azpr-simulated-change-v1\0${file}`),
    ])
  );
  const workingTreeFingerprint = await computeWorkingTreeFingerprint({
    repositoryRoot: root,
    changedFiles,
    inventory,
    simulatedDigests,
  });
  const authority = computeGateSystemAuthority({ inventory, definitions });
  return {
    repositoryRoot: root,
    ...gitState,
    changedFiles,
    simulatedChanges: normalizedSimulatedChanges,
    simulatedDigests,
    inventory,
    workingTreeFingerprint,
    authority,
  };
}

export async function readGitState({ repositoryRoot, base = null }) {
  const root = path.resolve(repositoryRoot);
  const head = (await runGit(root, ['rev-parse', 'HEAD'])).trim();
  const parent = await runGitOptional(root, ['rev-parse', 'HEAD^']);
  const verifiedBase = base
    ? (await runGit(root, ['rev-parse', '--verify', `${base}^{commit}`])).trim()
    : head;
  const trackedDirtyFiles = uniqueSorted([
    ...parseNullList(
      await runGit(root, ['diff', '--name-only', '-z', 'HEAD', '--'])
    ),
    ...parseNullList(
      await runGit(root, [
        'diff',
        '--cached',
        '--name-only',
        '-z',
        'HEAD',
        '--',
      ])
    ),
  ]);
  const comparisonChangedFiles = base
    ? uniqueSorted(
        parseNullList(
          await runGit(root, [
            'diff',
            '--name-only',
            '--diff-filter=ACMRDTUXB',
            '-z',
            verifiedBase,
            '--',
          ])
        )
      )
    : trackedDirtyFiles;
  const statusBytes = await runGit(root, [
    'status',
    '--porcelain=v1',
    '-z',
    '--untracked-files=normal',
  ]);
  const untrackedSummaryPaths = parseUntrackedStatus(statusBytes);
  const stashLine = (
    await runGitOptional(root, ['stash', 'list', '-1', '--format=%gd|%H|%s'])
  ).trim();
  return {
    head,
    parent: parent.trim() || null,
    base: verifiedBase,
    requestedBase: base,
    trackedDirtyFiles,
    trackedClean: trackedDirtyFiles.length === 0,
    untrackedSummaryPaths,
    untrackedEvidencePresent: untrackedSummaryPaths.length > 0,
    comparisonChangedFiles,
    stashTop: stashLine || null,
  };
}

export async function collectRepositoryInventory({
  repositoryRoot,
  includePatterns,
  untrackedSummaryPaths = [],
}) {
  const root = path.resolve(repositoryRoot);
  const trackedPaths = parseNullList(
    await runGit(root, ['ls-files', '-z', '--cached'])
  );
  const selectedTracked = trackedPaths.filter(file =>
    matchesAnyPattern(file, includePatterns)
  );
  const untrackedPaths = await expandRelevantUntrackedPaths({
    repositoryRoot: root,
    summaryPaths: untrackedSummaryPaths,
    includePatterns,
  });
  const rows = uniqueSorted([...selectedTracked, ...untrackedPaths]);
  const untrackedSet = new Set(untrackedPaths);
  const entries = await mapLimit(rows, 12, async file => {
    const absolutePath = path.join(root, ...file.split('/'));
    try {
      const bytes = await readFile(absolutePath);
      return {
        path: file,
        sha256: sha256(bytes),
        bytes: bytes.byteLength,
        state: untrackedSet.has(file) ? 'untracked' : 'working-tree',
      };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {
          path: file,
          sha256: sha256(`azpr-missing-file-v1\0${file}`),
          bytes: null,
          state: 'missing',
        };
      }
      throw error;
    }
  });
  return {
    entries: entries.sort((left, right) => comparePaths(left.path, right.path)),
    byPath: new Map(entries.map(entry => [entry.path, entry])),
  };
}

export function computeGateSystemAuthority({
  inventory,
  definitions = GATE_DEFINITIONS,
  dependencyMapVersion = GATE_DEPENDENCY_MAP_VERSION,
  fingerprintSchemaVersion = GATE_FINGERPRINT_SCHEMA_VERSION,
}) {
  const mapPayload = definitions.map(normalizeDefinitionForHash);
  const dependencyMapHash = sha256(canonicalStringify(mapPayload));
  const runnerEntries = GATE_SYSTEM_FILES.map(file => {
    const entry = inventory.byPath.get(file);
    return entry
      ? { path: file, sha256: entry.sha256 }
      : {
          path: file,
          sha256: sha256(`azpr-missing-runner-v1\0${file}`),
          missing: true,
        };
  });
  const runnerHash = sha256(canonicalStringify(runnerEntries));
  return {
    fingerprintSchemaVersion,
    dependencyMapVersion,
    dependencyMapHash,
    runnerHash,
  };
}

export function computeGateFingerprint({
  definition,
  inventory,
  authority,
  environment = process.env,
  simulatedDigests = new Map(),
  runtime = process,
}) {
  const dependencies = inventory.entries
    .filter(entry => matchesAnyPattern(entry.path, definition.dependencies))
    .map(entry => ({
      path: entry.path,
      sha256: simulatedDigests.get(entry.path) ?? entry.sha256,
      state: simulatedDigests.has(entry.path) ? 'simulated' : entry.state,
    }));
  for (const [file, digest] of simulatedDigests) {
    if (
      matchesAnyPattern(file, definition.dependencies) &&
      !dependencies.some(entry => entry.path === file)
    ) {
      dependencies.push({ path: file, sha256: digest, state: 'simulated' });
    }
  }
  dependencies.sort((left, right) => comparePaths(left.path, right.path));
  const config = normalizeDefinitionForHash(definition);
  const configHash = sha256(canonicalStringify(config));
  const environmentContract = {
    node: runtime.versions?.node ?? process.versions.node,
    platform: runtime.platform ?? process.platform,
    arch: runtime.arch ?? process.arch,
    values: Object.fromEntries(
      [...(definition.environmentKeys ?? [])]
        .sort(comparePaths)
        .map(key => [key, environment[key] ?? null])
    ),
  };
  const canonicalInput = {
    gate: definition.name,
    gateVersion: definition.version,
    schemaVersion: authority.fingerprintSchemaVersion,
    dependencyMapVersion: authority.dependencyMapVersion,
    dependencyMapHash: authority.dependencyMapHash,
    configHash,
    runnerHash: authority.runnerHash,
    environmentContract,
    dependencies,
  };
  return {
    gate: definition.name,
    dependencyFingerprint: sha256(canonicalStringify(canonicalInput)),
    canonicalInput,
    configHash,
    dependencyCount: dependencies.length,
  };
}

export function computeAllGateFingerprints({
  definitions = GATE_DEFINITIONS,
  inventory,
  authority,
  environment = process.env,
  simulatedDigests = new Map(),
  runtime = process,
}) {
  return new Map(
    definitions.map(definition => [
      definition.name,
      computeGateFingerprint({
        definition,
        inventory,
        authority,
        environment,
        simulatedDigests,
        runtime,
      }),
    ])
  );
}

export async function computeWorkingTreeFingerprint({
  repositoryRoot,
  changedFiles,
  inventory,
  simulatedDigests = new Map(),
}) {
  const rows = await mapLimit(changedFiles, 12, async file => {
    if (simulatedDigests.has(file)) {
      return {
        path: file,
        sha256: simulatedDigests.get(file),
        state: 'simulated',
      };
    }
    const existing = inventory.byPath.get(file);
    if (existing) {
      return { path: file, sha256: existing.sha256, state: existing.state };
    }
    if (file.endsWith('/')) {
      return {
        path: file,
        sha256: sha256(`azpr-untracked-directory-v1\0${file}`),
        state: 'untracked-directory',
      };
    }
    const absolutePath = path.join(repositoryRoot, ...file.split('/'));
    try {
      const stats = await lstat(absolutePath);
      if (stats.isDirectory()) {
        return {
          path: file,
          sha256: sha256(`azpr-untracked-directory-v1\0${file}`),
          state: 'untracked-directory',
        };
      }
      const bytes = await readFile(absolutePath);
      return { path: file, sha256: sha256(bytes), state: 'working-tree' };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        return {
          path: file,
          sha256: sha256(`azpr-missing-file-v1\0${file}`),
          state: 'missing',
        };
      }
      throw error;
    }
  });
  return sha256(
    canonicalStringify(
      rows.sort((left, right) => comparePaths(left.path, right.path))
    )
  );
}

export function normalizeDefinitionForHash(definition) {
  return {
    name: definition.name,
    version: definition.version,
    kind: definition.kind,
    dependencies: [...definition.dependencies].sort(comparePaths),
    smartTriggers: [...definition.smartTriggers].sort(comparePaths),
    environmentKeys: [...(definition.environmentKeys ?? [])].sort(comparePaths),
    integrationGate: definition.integrationGate === true,
    formalCoverage: definition.formalCoverage ?? null,
    covers: [...(definition.covers ?? [])].sort(comparePaths),
    command: definition.command
      ? {
          timeoutMs: definition.command.timeoutMs,
          steps: definition.command.steps.map(step => ({
            file: step.file,
            args: [...step.args],
          })),
        }
      : null,
  };
}

async function expandRelevantUntrackedPaths({
  repositoryRoot,
  summaryPaths,
  includePatterns,
}) {
  const files = [];
  for (const summaryPath of summaryPaths) {
    const normalized = normalizeRepositoryPath(summaryPath);
    if (!normalized) continue;
    const absolutePath = path.join(repositoryRoot, ...normalized.split('/'));
    let stats;
    try {
      stats = await lstat(absolutePath);
    } catch (error) {
      if (error?.code === 'ENOENT') continue;
      throw error;
    }
    if (stats.isFile() || stats.isSymbolicLink()) {
      if (matchesAnyPattern(normalized, includePatterns))
        files.push(normalized);
      continue;
    }
    if (
      !stats.isDirectory() ||
      !couldContainMatchingPath(normalized, includePatterns)
    ) {
      continue;
    }
    const descendants = await walkFiles(absolutePath, normalized);
    for (const file of descendants) {
      if (matchesAnyPattern(file, includePatterns)) files.push(file);
    }
  }
  return uniqueSorted(files);
}

function couldContainMatchingPath(directory, patterns) {
  const prefix = `${normalizeRepositoryPath(directory)}/`;
  return patterns.some(pattern => {
    const literal = literalPatternPrefix(pattern);
    return literal.startsWith(prefix) || prefix.startsWith(literal);
  });
}

function literalPatternPrefix(pattern) {
  const normalized = normalizeRepositoryPath(pattern);
  const wildcardIndex = normalized.search(/[?*]/u);
  const prefix =
    wildcardIndex < 0 ? normalized : normalized.slice(0, wildcardIndex);
  const slashIndex = prefix.lastIndexOf('/');
  return slashIndex < 0 ? '' : prefix.slice(0, slashIndex + 1);
}

async function walkFiles(absoluteDirectory, repositoryDirectory) {
  const output = [];
  const queue = [[absoluteDirectory, repositoryDirectory]];
  while (queue.length) {
    const [absolute, relative] = queue.pop();
    const entries = await readdir(absolute, { withFileTypes: true });
    for (const entry of entries) {
      const childAbsolute = path.join(absolute, entry.name);
      const childRelative = normalizeRepositoryPath(
        `${relative}/${entry.name}`
      );
      if (entry.isDirectory()) queue.push([childAbsolute, childRelative]);
      else if (entry.isFile() || entry.isSymbolicLink())
        output.push(childRelative);
      if (output.length > 100_000) {
        throw new Error(
          `Untracked file expansion exceeded safety limit under ${relative}`
        );
      }
    }
  }
  return output;
}

function parseUntrackedStatus(value) {
  const fields = String(value).split('\0');
  const output = [];
  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    if (!field) continue;
    const status = field.slice(0, 2);
    const file = normalizeRepositoryPath(field.slice(3));
    if (status === '??' && file) output.push(file);
    if ((status.includes('R') || status.includes('C')) && fields[index + 1]) {
      index += 1;
    }
  }
  return uniqueSorted(output);
}

function parseNullList(value) {
  return String(value).split('\0').map(normalizeRepositoryPath).filter(Boolean);
}

async function runGit(repositoryRoot, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: MAX_GIT_BUFFER,
    windowsHide: true,
  });
  return stdout;
}

async function runGitOptional(repositoryRoot, args) {
  try {
    return await runGit(repositoryRoot, args);
  } catch {
    return '';
  }
}

function globToRegExp(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      const next = pattern[index + 1];
      if (next === '*') {
        const after = pattern[index + 2];
        if (after === '/') {
          source += '(?:.*/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += escapeRegExp(character);
    }
  }
  return new RegExp(`${source}$`, 'u');
}

function escapeRegExp(value) {
  return /[\\^$.*+?()[\]{}|]/u.test(value) ? `\\${value}` : value;
}

function stringifyCanonical(value) {
  if (value === null || typeof value !== 'object') {
    if (value === undefined) return 'null';
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(entry => stringifyCanonical(entry)).join(',')}]`;
  }
  return `{${Object.keys(value)
    .filter(key => value[key] !== undefined)
    .sort(comparePaths)
    .map(key => `${JSON.stringify(key)}:${stringifyCanonical(value[key])}`)
    .join(',')}}`;
}

function uniqueSorted(values) {
  return [...new Set(values.map(normalizeRepositoryPath))]
    .filter(Boolean)
    .sort(comparePaths);
}

function comparePaths(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

async function mapLimit(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(values.length, 1)) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}
