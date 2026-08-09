import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyProductVisualEvidenceFiles } from '../../../scripts/character-acceptance/visual-evidence-verification.mjs';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..'
);
const temporaryRoots = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map(root => fs.rm(root, { recursive: true, force: true }))
  );
});

describe('character acceptance visual evidence verification', () => {
  it('accepts the committed 107001 Playwright screenshot with exact fixture and image bytes', async () => {
    const recipe = JSON.parse(
      await fs.readFile(
        path.join(
          REPO_ROOT,
          'scripts',
          'character-acceptance',
          'acceptance-recipes',
          '107001.json'
        ),
        'utf8'
      )
    );

    await expect(
      verifyProductVisualEvidenceFiles(recipe, { projectRoot: REPO_ROOT })
    ).resolves.toBeUndefined();
  });

  it('fails closed when a visual record supplies only a machine trace hash', async () => {
    const root = await createTemporaryRoot();
    const recipe = createRecipe({
      evidenceKind: 'machine-axis-trace',
      status: 'automated-machine-axis-passed',
      traceSha256: '0'.repeat(64),
    });
    const before = await snapshotTree(root);

    await expect(
      verifyProductVisualEvidenceFiles(recipe, { projectRoot: root })
    ).rejects.toThrow('evidence-kind-must-be-screenshot');
    expect(await snapshotTree(root)).toEqual(before);
  });

  it.each([
    ['missing', false],
    ['tampered', true],
  ])(
    'rejects a %s screenshot before assert-clean output work and leaves files untouched',
    async (_label, createScreenshot) => {
      const root = await createTemporaryRoot();
      const screenshotPath = path.join(root, 'reports', 'visual.png');
      await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
      if (createScreenshot) {
        await fs.writeFile(screenshotPath, Buffer.from('tampered-image'));
      }
      const recipe = createRecipe({
        evidenceKind: 'workbench-playwright-screenshot',
        status: 'automated-workbench-import-passed',
        screenshotPath: 'reports/visual.png',
        screenshotSha256: sha256(Buffer.from('expected-image')),
      });
      const before = await snapshotTree(root);

      await expect(
        verifyProductVisualEvidenceFiles(recipe, { projectRoot: root })
      ).rejects.toThrow(
        createScreenshot
          ? 'screenshot-sha256-mismatch'
          : 'screenshot-file-missing'
      );
      expect(await snapshotTree(root)).toEqual(before);
    }
  );
});

async function createTemporaryRoot() {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'azpr-character-visual-evidence-')
  );
  temporaryRoots.push(root);
  return root;
}

function createRecipe(evidence) {
  return {
    ownerId: 999001,
    productVisualAcceptance: {
      automatedEvidence: [
        {
          scenarioIdentity: 'synthetic-visual-scenario',
          ...evidence,
        },
      ],
    },
  };
}

async function snapshotTree(root) {
  const entries = await fs.readdir(root, { recursive: true });
  const snapshots = [];
  for (const entry of entries.sort()) {
    const absolutePath = path.join(root, entry);
    const stat = await fs.stat(absolutePath);
    snapshots.push({
      entry: entry.replaceAll('\\', '/'),
      kind: stat.isDirectory() ? 'directory' : 'file',
      size: stat.size,
      hash: stat.isFile() ? sha256(await fs.readFile(absolutePath)) : null,
    });
  }
  return snapshots;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
