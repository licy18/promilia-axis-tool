import { execFile } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import { normalizeRepositoryPath } from './git-change-classifier.mjs';

const execFileAsync = promisify(execFile);

export const RELEASE_RUNNER_OUTPUT_POLICY = 'release-runner-output-v1';
export const PRODUCTION_PREVIEW_REPORT_PATH =
  'reports/production-preview-acceptance.json';

export function isReleaseRunnerOutputPath(file) {
  const normalized = normalizeRepositoryPath(file);
  return (
    normalized === PRODUCTION_PREVIEW_REPORT_PATH ||
    /^reports\/[^/]+\.png$/u.test(normalized)
  );
}

export async function snapshotReleaseRunnerOutputs({ repositoryRoot }) {
  const root = path.resolve(repositoryRoot);
  const paths = await readTrackedRunnerOutputPaths(root);
  const bytesByPath = new Map();
  for (const relativePath of paths) {
    bytesByPath.set(
      relativePath,
      await readFile(resolvePath(root, relativePath))
    );
  }
  return {
    policy: RELEASE_RUNNER_OUTPUT_POLICY,
    paths,
    bytesByPath,
  };
}

export async function restoreReleaseRunnerOutputs({
  repositoryRoot,
  snapshot,
}) {
  if (snapshot?.policy !== RELEASE_RUNNER_OUTPUT_POLICY) {
    throw new Error('Invalid release runner output snapshot policy');
  }
  const root = path.resolve(repositoryRoot);
  const restoredPaths = [];
  const capturedTextByPath = {};
  for (const relativePath of snapshot.paths) {
    const baseline = snapshot.bytesByPath.get(relativePath);
    if (!Buffer.isBuffer(baseline)) {
      throw new Error(`Missing runner output snapshot bytes: ${relativePath}`);
    }
    const target = resolvePath(root, relativePath);
    const current = await readOptional(target);
    if (current && current.equals(baseline)) continue;
    if (current && relativePath === PRODUCTION_PREVIEW_REPORT_PATH) {
      capturedTextByPath[relativePath] = current.toString('utf8');
    }
    await writeFile(target, baseline);
    restoredPaths.push(relativePath);
  }
  const remainingTrackedDriftPaths = await readTrackedDirtyPaths(root);
  return {
    policy: RELEASE_RUNNER_OUTPUT_POLICY,
    snapshottedPathCount: snapshot.paths.length,
    restoredCount: restoredPaths.length,
    restoredPaths,
    capturedTextPaths: Object.keys(capturedTextByPath).sort(comparePaths),
    capturedTextByPath,
    remainingTrackedDriftPaths,
    nonRunnerTrackedDriftPaths: remainingTrackedDriftPaths.filter(
      file => !isReleaseRunnerOutputPath(file)
    ),
  };
}

async function readTrackedRunnerOutputPaths(root) {
  const output = await runGit(root, [
    'ls-files',
    '-z',
    '--',
    PRODUCTION_PREVIEW_REPORT_PATH,
    ':(glob)reports/*.png',
  ]);
  return uniquePaths(output.split('\0')).filter(isReleaseRunnerOutputPath);
}

async function readTrackedDirtyPaths(root) {
  const output = await runGit(root, [
    'diff',
    '--name-only',
    '-z',
    'HEAD',
    '--',
  ]);
  return uniquePaths(output.split('\0'));
}

async function runGit(root, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout;
}

async function readOptional(file) {
  try {
    return await readFile(file);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function resolvePath(root, relativePath) {
  return path.join(root, ...relativePath.split('/'));
}

function uniquePaths(values) {
  return [...new Set(values.map(normalizeRepositoryPath))]
    .filter(Boolean)
    .sort(comparePaths);
}

function comparePaths(left, right) {
  return left.localeCompare(right, 'en');
}
