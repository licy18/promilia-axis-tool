import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const OWNER_CASES = {
  101010: {
    fixturePath: 'fixtures/character-acceptance/101010-visual.json',
    actionId: 'xiaoyu-enhanced-charged',
    controlSkillId: 10101010,
    subSkillIndex: 2,
  },
  102001: {
    fixturePath: 'fixtures/character-acceptance/102001-visual.json',
    actionId: 'lily-ultimate-all-land',
    controlSkillId: 10200113,
    subSkillIndex: 0,
  },
  103002: {
    fixturePath: 'fixtures/character-acceptance/103002-visual.json',
    actionId: 'ruby-chain-e1',
    controlSkillId: 10300201,
    subSkillIndex: 1,
  },
  107001: {
    fixturePath:
      'fixtures/character-acceptance/107001-active-surface-closure.json',
    actionId: 'sifliya-a3-cycle-1',
    controlSkillId: 10700103,
    subSkillIndex: 4,
  },
  107002: {
    fixturePath: 'fixtures/character-acceptance/107002-visual.json',
    actionId: 'misa-a3',
    controlSkillId: 10700203,
    subSkillIndex: 0,
  },
  108003: {
    fixturePath:
      'fixtures/character-acceptance/108003-active-surface-closure.json',
    actionId: 'miti-full-charge-state-on',
    controlSkillId: 10800342,
    subSkillIndex: 0,
  },
  109001: {
    fixturePath: 'fixtures/character-acceptance/109001-visual.json',
    actionId: 'moyin-thunder-preseed-signature',
    controlSkillId: 50005701,
    subSkillIndex: 0,
  },
  112001: {
    fixturePath: 'fixtures/character-acceptance/112001-visual.json',
    actionId: 'gisele-heavy3-threshold67',
    controlSkillId: 11200141,
    subSkillIndex: 2,
  },
  199001: {
    fixturePath: 'fixtures/character-acceptance/199001-starborn-visual.json',
    actionId: 'starborn-f-thrust-a3',
    controlSkillId: 19900103,
    subSkillIndex: 0,
    optimizationObjectId: 'STARBORN',
  },
  199002: {
    fixturePath: 'fixtures/character-acceptance/199002-starborn-visual.json',
    actionId: 'starborn-m-thrust-a3',
    controlSkillId: 19900203,
    subSkillIndex: 0,
    optimizationObjectId: 'STARBORN',
  },
};

const ownerId = Number(process.env.M12C_VISUAL_OWNER);
const ownerCase = OWNER_CASES[ownerId];
const runtimePackagePath =
  process.env.M12C_VISUAL_RUNTIME_PACKAGE ??
  'work/m12-c/product-review/runtime-package-current.json';
// 输出目录与 basename 前缀可由调用方覆盖（真实签收必须在新证据目录下
// 捕获，不能复用旧日期/旧 HEAD 前缀）；默认保留历史签收目录行为。
const outputDirectory =
  process.env.M12C_VISUAL_OUTPUT_DIR ??
  'work/m12-c/product-review/visual-evidence/2026-08-12';
const basenamePrefix =
  process.env.M12C_VISUAL_BASENAME_PREFIX ?? '20260812-bda6696e';

test.skip(!ownerCase, 'Set M12C_VISUAL_OWNER to a supported owner id');

test(`[m12-c-owner-visual-review] ${ownerId}`, async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();

  const runtimePackageBytes = await readFile(runtimePackagePath);
  const runtimePackage = JSON.parse(runtimePackageBytes.toString('utf8'));
  const fixtureBytes = await readFile(ownerCase.fixturePath);
  const fixture = JSON.parse(fixtureBytes.toString('utf8'));
  expect(runtimePackage.packageHash).toBe(
    fixture.dataIdentity.verifiedMechanicsPackageHash
  );

  await page.evaluate(
    async ({ packageUrl, expectedOwnerId }) => {
      const response = await fetch(packageUrl, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`Runtime package fetch failed: ${response.status}`);
      }
      const selectedPackage = await response.json();
      const profileOwnerIds = new Set(
        (selectedPackage.actionMappings ?? []).map(mapping =>
          Number(mapping.ownerId)
        )
      );
      if (!profileOwnerIds.has(expectedOwnerId)) {
        throw new Error(
          `Runtime package does not contain owner ${expectedOwnerId}`
        );
      }
      const packageModule =
        await import('/src/data/verifiedCombatMechanicsPackage.js');
      const validation =
        packageModule.validateVerifiedCombatMechanicsPackage(selectedPackage);
      if (!validation.valid) {
        throw new Error(
          `Runtime package validation failed: ${validation.issues.join(', ')}`
        );
      }
      packageModule.installVerifiedCombatMechanicsPackage(selectedPackage);
    },
    {
      packageUrl: `/${runtimePackagePath}?owner=${ownerId}`,
      expectedOwnerId: ownerId,
    }
  );

  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: `${ownerId}-m12-c-visual-review.json`,
    mimeType: 'application/json',
    buffer: fixtureBytes,
  });

  const dialog = page.getByTestId('workbench-machine-axis-dialog');
  await expect(dialog).toBeVisible();
  const status = dialog.getByTestId('machine-axis-status');
  await expect(status).toContainText('已导入 Machine Axis', {
    timeout: 45_000,
  });
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute(
    'data-machine-axis-import-active',
    'true'
  );
  const importStatusText = (await status.innerText()).trim();
  const canonicalTraceHash = await workbench.getAttribute(
    'data-canonical-trace-hash'
  );
  expect(canonicalTraceHash).toMatch(/^[0-9a-f]{16}$/);

  await mkdir(outputDirectory, { recursive: true });
  const basename = `${basenamePrefix}-${ownerId}`;
  const importScreenshotPath = path.join(
    outputDirectory,
    `${basename}-import-dialog.png`
  );
  const traceScreenshotPath = path.join(
    outputDirectory,
    `${basename}-canonical-trace.png`
  );
  const reviewRecordPath = path.join(
    outputDirectory,
    `${basename}-review.json`
  );
  const importScreenshot = await page.screenshot({ animations: 'disabled' });
  await writeFile(importScreenshotPath, importScreenshot);

  await dialog.getByTestId('workbench-close-machine-axis').click();
  const action = page
    .getByTestId('workbench-timeline-grid-preview')
    .locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${ownerCase.actionId}"]`
    );
  await expect(action).toHaveCount(1);
  await action.scrollIntoViewIfNeeded();
  await action.click();

  const sideInspector = page.getByTestId('workbench-side-inspector');
  await expect(sideInspector).toBeVisible();
  const canonicalTraceTab = sideInspector.locator(
    '[data-testid="workbench-side-inspector-tab"][data-inspector-panel="canonical-trace"]'
  );
  await expect(canonicalTraceTab).toBeVisible();
  await canonicalTraceTab.click();
  const canonicalTraceInspector = sideInspector.getByTestId(
    'workbench-canonical-trace-inspector'
  );
  await expect(canonicalTraceInspector).toContainText(
    `control ${ownerCase.controlSkillId} / sub ${ownerCase.subSkillIndex}`
  );
  await expect(
    canonicalTraceInspector.getByTestId('canonical-trace-hit-row').first()
  ).toBeVisible();
  const inspectorText = await canonicalTraceInspector.innerText();

  await page.evaluate(() => window.scrollTo(0, 0));
  const traceScreenshot = await page.screenshot({ animations: 'disabled' });
  await writeFile(traceScreenshotPath, traceScreenshot);

  const repositoryHead = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim();
  const reviewRecord = {
    schemaVersion: 1,
    contractName: 'M12COwnerWorkbenchVisualReview',
    status: 'pending-explicit-user-signoff',
    ownerId,
    optimizationObjectId: ownerCase.optimizationObjectId ?? null,
    repositoryHead,
    fixturePath: ownerCase.fixturePath.replaceAll('\\', '/'),
    fixtureSha256: sha256(fixtureBytes),
    runtimePackageGenerator: 'scripts/generate-character-acceptance.mjs',
    runtimePackageSourceProfilePath: `src/data/generated/character-combat-profiles/${ownerId}.json`,
    runtimePackageSha256: sha256(runtimePackageBytes),
    runtimePackageId: runtimePackage.packageId,
    runtimePackageHash: runtimePackage.packageHash,
    canonicalTraceHash,
    selectedAction: {
      actionId: ownerCase.actionId,
      controlSkillId: ownerCase.controlSkillId,
      subSkillIndex: ownerCase.subSkillIndex,
    },
    automatedEvidence: {
      importStatus: importStatusText,
      importScreenshotPath: importScreenshotPath.replaceAll('\\', '/'),
      importScreenshotSha256: sha256(importScreenshot),
      traceScreenshotPath: traceScreenshotPath.replaceAll('\\', '/'),
      traceScreenshotSha256: sha256(traceScreenshot),
      canonicalTraceInspectorText: inspectorText,
      viewport: { width: 1440, height: 900 },
    },
  };
  await writeFile(
    reviewRecordPath,
    `${JSON.stringify(reviewRecord, null, 2)}\n`,
    'utf8'
  );
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}
