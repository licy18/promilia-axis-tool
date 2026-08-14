import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';
import {
  GATE_DEFINITIONS,
  GATE_SYSTEM_FILES,
  getGateDefinition,
} from '../../../../scripts/gates/gate-definitions.mjs';
import {
  canonicalStringify,
  computeAllGateFingerprints,
  computeGateFingerprint,
  computeGateSystemAuthority,
  createRepositorySnapshot,
  globMatches,
  sha256,
} from '../../../../scripts/gates/gate-fingerprint.mjs';
import { createInventory } from './gateTestHelpers';

const execFileAsync = promisify(execFile);
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('gate dependency fingerprint', () => {
  it('canonicalizes object keys and dependency enumeration order', () => {
    expect(canonicalStringify({ z: 1, a: { y: 2, b: 3 } })).toBe(
      canonicalStringify({ a: { b: 3, y: 2 }, z: 1 })
    );
    const first = syntheticFingerprint([
      entry('vite.config.js', 'vite'),
      entry('src/views/Workbench.vue', 'workbench'),
    ]);
    const second = syntheticFingerprint([
      entry('src/views/Workbench.vue', 'workbench'),
      entry('vite.config.js', 'vite'),
    ]);
    expect(first.dependencyFingerprint).toBe(second.dependencyFingerprint);
  });

  it('keeps identical bytes stable and changes for any dependency bytes', () => {
    const base = syntheticFingerprint([entry('vite.config.js', 'same')]);
    const same = syntheticFingerprint([entry('vite.config.js', 'same')]);
    const changed = syntheticFingerprint([entry('vite.config.js', 'changed')]);
    expect(base.dependencyFingerprint).toBe(same.dependencyFingerprint);
    expect(changed.dependencyFingerprint).not.toBe(base.dependencyFingerprint);
  });

  it('does not invalidate bundle for README but does for Vite config', () => {
    const base = syntheticFingerprint([entry('vite.config.js', 'vite')]);
    const readme = syntheticFingerprint([
      entry('vite.config.js', 'vite'),
      entry('README.md', 'docs'),
    ]);
    const vite = syntheticFingerprint([entry('vite.config.js', 'vite-2')]);
    expect(readme.dependencyFingerprint).toBe(base.dependencyFingerprint);
    expect(vite.dependencyFingerprint).not.toBe(base.dependencyFingerprint);
  });

  it('changes when the dependency map version changes', () => {
    const inventory = withSystemEntries([entry('vite.config.js', 'vite')]);
    const authorityV2 = computeGateSystemAuthority({
      inventory,
      dependencyMapVersion: 2,
    });
    const authorityV3 = computeGateSystemAuthority({
      inventory,
      dependencyMapVersion: 3,
    });
    const definition = getGateDefinition('bundle');
    const v2 = computeGateFingerprint({
      definition,
      inventory,
      authority: authorityV2,
    });
    const v3 = computeGateFingerprint({
      definition,
      inventory,
      authority: authorityV3,
    });
    expect(v3.dependencyFingerprint).not.toBe(v2.dependencyFingerprint);
  });

  it('binds the Node heap contract into executable gate fingerprints', () => {
    const inventory = withSystemEntries([entry('vite.config.js', 'vite')]);
    const authority = computeGateSystemAuthority({ inventory });
    const definition = getGateDefinition('test-full');
    const defaultHeap = computeGateFingerprint({
      definition,
      inventory,
      authority,
      environment: {},
    });
    const raisedHeap = computeGateFingerprint({
      definition,
      inventory,
      authority,
      environment: { NODE_OPTIONS: '--max-old-space-size=8192' },
    });

    expect(raisedHeap.dependencyFingerprint).not.toBe(
      defaultHeap.dependencyFingerprint
    );
  });

  it('uses current dirty tracked bytes even when HEAD does not change', async () => {
    const repository = await createTemporaryRepository({
      'vite.config.js': 'export default { build: 1 };\n',
      'package.json': '{"type":"module"}\n',
    });
    const before = await createRepositorySnapshot({
      repositoryRoot: repository,
      definitions: GATE_DEFINITIONS,
    });
    const beforeFingerprint = computeAllGateFingerprints({
      inventory: before.inventory,
      authority: before.authority,
    }).get('bundle').dependencyFingerprint;
    await writeFile(
      path.join(repository, 'vite.config.js'),
      'export default { build: 2 };\n',
      'utf8'
    );
    const after = await createRepositorySnapshot({
      repositoryRoot: repository,
      definitions: GATE_DEFINITIONS,
    });
    const afterFingerprint = computeAllGateFingerprints({
      inventory: after.inventory,
      authority: after.authority,
    }).get('bundle').dependencyFingerprint;
    expect(after.head).toBe(before.head);
    expect(after.trackedDirtyFiles).toContain('vite.config.js');
    expect(afterFingerprint).not.toBe(beforeFingerprint);
  });

  it('keeps an untracked unmapped file visible for fail-closed classification', async () => {
    const repository = await createTemporaryRepository({
      'package.json': '{"type":"module"}\n',
    });
    await writeFile(
      path.join(repository, 'mystery.extension'),
      'unclassified\n',
      'utf8'
    );

    const snapshot = await createRepositorySnapshot({
      repositoryRoot: repository,
      definitions: GATE_DEFINITIONS,
    });

    expect(snapshot.changedFiles).toContain('mystery.extension');
  });

  it('canonicalizes Windows and POSIX path separators', () => {
    expect(
      globMatches('src\\views\\Workbench.vue', 'src/**/Workbench.vue')
    ).toBe(true);
  });
});

function syntheticFingerprint(entries) {
  const inventory = withSystemEntries(entries);
  const authority = computeGateSystemAuthority({ inventory });
  return computeGateFingerprint({
    definition: getGateDefinition('bundle'),
    inventory,
    authority,
    environment: {},
    runtime: { versions: { node: '24.16.0' }, platform: 'win32', arch: 'x64' },
  });
}

function withSystemEntries(entries) {
  return createInventory([
    ...entries,
    ...GATE_SYSTEM_FILES.map(file => entry(file, `runner:${file}`)),
  ]);
}

function entry(file, content) {
  return { path: file, sha256: sha256(content), bytes: content.length };
}

async function createTemporaryRepository(files) {
  const repository = await mkdtemp(path.join(os.tmpdir(), 'azpr-gates-'));
  temporaryDirectories.push(repository);
  for (const [relativePath, content] of Object.entries(files)) {
    const file = path.join(repository, ...relativePath.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
  }
  await git(repository, ['init', '--initial-branch=main']);
  await git(repository, ['config', 'user.email', 'gates@example.invalid']);
  await git(repository, ['config', 'user.name', 'Gate Tests']);
  await git(repository, ['add', '.']);
  await git(repository, ['commit', '-m', 'baseline']);
  return repository;
}

async function git(repository, args) {
  await execFileAsync('git', args, {
    cwd: repository,
    windowsHide: true,
    encoding: 'utf8',
  });
}
