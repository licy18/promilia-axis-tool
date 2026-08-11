import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeRepositoryPath } from './git-change-classifier.mjs';
import { resolveCommandInvocation } from './node-package-invocation.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..', '..');
const base = process.env.AZPR_GATE_BASE || 'HEAD';
const changedFiles = await readChangedFiles();
const existingFiles = [];
for (const relativePath of changedFiles) {
  const absolutePath = path.join(repositoryRoot, ...relativePath.split('/'));
  try {
    await access(absolutePath);
    existingFiles.push(relativePath);
  } catch {
    // Deleted paths are still covered by git diff --check.
  }
}

const eslintFiles = existingFiles.filter(file =>
  /\.(cjs|js|jsx|mjs|vue)$/u.test(file)
);
const prettierFiles = existingFiles.filter(file =>
  /\.(cjs|css|html|js|json|jsx|md|mjs|scss|ts|tsx|vue|ya?ml)$/u.test(file)
);
const commands = [
  {
    name: 'git-diff-check',
    file: 'git',
    args: ['diff', '--check', base, '--'],
  },
  ...fileCommands('eslint-changed-files', ['eslint'], eslintFiles),
  ...fileCommands(
    'prettier-check-changed-files',
    ['prettier', '--check'],
    prettierFiles
  ),
];

const results = [];
for (const command of commands) {
  const startedAt = Date.now();
  const exitCode = await run(command.file, command.args);
  results.push({
    name: command.name,
    command: [command.file, ...command.args].join(' '),
    exitCode,
    durationMs: Date.now() - startedAt,
  });
  if (exitCode !== 0) break;
}

const passed = results.every(result => result.exitCode === 0);
process.stdout.write(
  `${JSON.stringify(
    {
      kind: 'azpr-repository-hygiene',
      base,
      changedFileCount: changedFiles.length,
      eslintFileCount: eslintFiles.length,
      prettierFileCount: prettierFiles.length,
      results,
      passed,
    },
    null,
    2
  )}\n`
);
if (!passed) process.exitCode = 1;

async function readChangedFiles() {
  const serialized = process.env.AZPR_GATE_CHANGED_FILES;
  if (serialized) {
    const parsed = JSON.parse(serialized);
    if (!Array.isArray(parsed)) {
      throw new Error('AZPR_GATE_CHANGED_FILES must be a JSON array');
    }
    return uniquePaths(parsed);
  }
  const output = await capture('git', [
    'diff',
    '--name-only',
    '-z',
    base,
    '--',
  ]);
  return uniquePaths(output.split('\0'));
}

function uniquePaths(values) {
  return [...new Set(values.map(normalizeRepositoryPath))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, 'en'));
}

function fileCommands(name, prefixArgs, files, chunkSize = 50) {
  const total = Math.ceil(files.length / chunkSize);
  const commands = [];
  for (let index = 0; index < files.length; index += chunkSize) {
    const chunk = files.slice(index, index + chunkSize);
    commands.push({
      name: total > 1 ? `${name}-${commands.length + 1}-of-${total}` : name,
      file: 'npx',
      args: [...prefixArgs, ...chunk],
    });
  }
  return commands;
}

function run(file, args) {
  return new Promise((resolve, reject) => {
    const invocation = resolveCommandInvocation(file, args);
    const child = spawn(invocation.file, invocation.args, {
      cwd: repositoryRoot,
      shell: false,
      windowsHide: true,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('close', exitCode => resolve(exitCode ?? 1));
  });
}

function capture(file, args) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const invocation = resolveCommandInvocation(file, args);
    const child = spawn(invocation.file, invocation.args, {
      cwd: repositoryRoot,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout.on('data', chunk => chunks.push(chunk));
    child.on('error', reject);
    child.on('close', exitCode => {
      if (exitCode === 0) resolve(Buffer.concat(chunks).toString('utf8'));
      else reject(new Error(`${file} exited with ${exitCode}`));
    });
  });
}
