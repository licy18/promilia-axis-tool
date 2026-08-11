import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import {
  PRODUCTION_PREVIEW_REPORT_PATH,
  isReleaseRunnerOutputPath,
  restoreReleaseRunnerOutputs,
  snapshotReleaseRunnerOutputs,
} from '../../../../scripts/gates/release-runner-output.mjs';

const execFileAsync = promisify(execFile);
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map(root => rm(root, { recursive: true, force: true }))
  );
});

describe('release runner output policy', () => {
  it.each([
    PRODUCTION_PREVIEW_REPORT_PATH,
    'reports/stage-9a-timeline-desktop.png',
    'reports\\m11-d-character-acceptance-101010-desktop.png',
  ])('allows the narrow tracked runner output %s', file => {
    expect(isReleaseRunnerOutputPath(file)).toBe(true);
  });

  it.each([
    'reports/bundle-composition.json',
    'reports/m12/visual-acceptance/overview.png',
    'reports/preview.jpg',
    'src/views/Workbench.vue',
  ])('does not allow unrelated tracked drift %s', file => {
    expect(isReleaseRunnerOutputPath(file)).toBe(false);
  });

  it('restores only tracked allowlisted outputs and reports remaining drift', async () => {
    const root = await createRepository();
    const snapshot = await snapshotReleaseRunnerOutputs({
      repositoryRoot: root,
    });

    await writeFile(
      path.join(root, ...PRODUCTION_PREVIEW_REPORT_PATH.split('/')),
      '{"run":"current"}\n',
      'utf8'
    );
    await writeFile(
      path.join(root, 'reports', 'preview.png'),
      Buffer.from([9])
    );
    await writeFile(
      path.join(root, 'reports', 'nested', 'protected.png'),
      Buffer.from([8])
    );
    await writeFile(
      path.join(root, 'src', 'protected.js'),
      'changed\n',
      'utf8'
    );
    await writeFile(
      path.join(root, 'reports', 'untracked.png'),
      Buffer.from([7])
    );

    const result = await restoreReleaseRunnerOutputs({
      repositoryRoot: root,
      snapshot,
    });

    expect(result).toMatchObject({
      restoredCount: 2,
      restoredPaths: ['reports/preview.png', PRODUCTION_PREVIEW_REPORT_PATH],
      capturedTextPaths: [PRODUCTION_PREVIEW_REPORT_PATH],
      remainingTrackedDriftPaths: [
        'reports/nested/protected.png',
        'src/protected.js',
      ],
      nonRunnerTrackedDriftPaths: [
        'reports/nested/protected.png',
        'src/protected.js',
      ],
    });
    expect(result.capturedTextByPath[PRODUCTION_PREVIEW_REPORT_PATH]).toBe(
      '{"run":"current"}\n'
    );
    expect(await readFile(path.join(root, 'reports', 'preview.png'))).toEqual(
      Buffer.from([1, 2, 3])
    );
    expect(
      await readFile(
        path.join(root, ...PRODUCTION_PREVIEW_REPORT_PATH.split('/')),
        'utf8'
      )
    ).toBe('{"run":"baseline"}\n');
    expect(
      await readFile(path.join(root, 'reports', 'nested', 'protected.png'))
    ).toEqual(Buffer.from([8]));
    expect(await readFile(path.join(root, 'src', 'protected.js'), 'utf8')).toBe(
      'changed\n'
    );
    expect(await readFile(path.join(root, 'reports', 'untracked.png'))).toEqual(
      Buffer.from([7])
    );
  });

  it('does not hide allowlisted drift that existed before the trial', async () => {
    const root = await createRepository();
    const reportPath = path.join(
      root,
      ...PRODUCTION_PREVIEW_REPORT_PATH.split('/')
    );
    await writeFile(reportPath, '{"run":"pre-trial-dirty"}\n', 'utf8');
    const snapshot = await snapshotReleaseRunnerOutputs({
      repositoryRoot: root,
    });
    await writeFile(reportPath, '{"run":"trial"}\n', 'utf8');

    const result = await restoreReleaseRunnerOutputs({
      repositoryRoot: root,
      snapshot,
    });

    expect(await readFile(reportPath, 'utf8')).toBe(
      '{"run":"pre-trial-dirty"}\n'
    );
    expect(result.restoredPaths).toEqual([PRODUCTION_PREVIEW_REPORT_PATH]);
    expect(result.remainingTrackedDriftPaths).toEqual([
      PRODUCTION_PREVIEW_REPORT_PATH,
    ]);
    expect(result.nonRunnerTrackedDriftPaths).toEqual([]);
  });
});

async function createRepository() {
  const root = await mkdtemp(path.join(tmpdir(), 'azpr-release-output-'));
  temporaryRoots.push(root);
  await mkdir(path.join(root, 'reports', 'nested'), { recursive: true });
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(
    path.join(root, ...PRODUCTION_PREVIEW_REPORT_PATH.split('/')),
    '{"run":"baseline"}\n',
    'utf8'
  );
  await writeFile(
    path.join(root, 'reports', 'preview.png'),
    Buffer.from([1, 2, 3])
  );
  await writeFile(
    path.join(root, 'reports', 'nested', 'protected.png'),
    Buffer.from([4])
  );
  await writeFile(path.join(root, 'src', 'protected.js'), 'baseline\n', 'utf8');
  await runGit(root, ['init']);
  await runGit(root, ['config', 'user.email', 'gate-test@example.invalid']);
  await runGit(root, ['config', 'user.name', 'Gate Test']);
  await runGit(root, ['add', '--', '.']);
  await runGit(root, ['commit', '-m', 'baseline']);
  return root;
}

async function runGit(root, args) {
  await execFileAsync('git', args, {
    cwd: root,
    windowsHide: true,
  });
}
