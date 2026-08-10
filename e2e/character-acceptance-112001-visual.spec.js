import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const FIXTURE_PATH = 'fixtures/character-acceptance/112001-visual.json';
const FIXTURE_SHA256 =
  'abab0b4b2e508611a2515612de1fd200f83320b8c81a6f47c46a42a3467f725b';
const TRACE_HASH = '7df581ed9bbdabcb';
const SCREENSHOT_PATH = 'reports/m12-b3-112001-workbench-visual-evidence.png';
const SCREENSHOT_SHA256 =
  '15ad47c214c7572d6a16a86777ff16edca18a5606258ba6b8ca5e55420b10d46';

test('[m12-b3-112001-visual-evidence] imports the bound Gisele fixture and captures the canonical Workbench trace', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();

  const ownerContract = await readJson(
    'src/data/generated/character-combat-owner-contracts/112001.json'
  );
  await installOwnerRuntimePackage(page, ownerContract, 112001);

  const fixtureBytes = await readFile(FIXTURE_PATH);
  expect(createHash('sha256').update(fixtureBytes).digest('hex')).toBe(
    FIXTURE_SHA256
  );
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: '112001-m12-b3-acceptance.json',
    mimeType: 'application/json',
    buffer: fixtureBytes,
  });

  const dialog = page.getByTestId('workbench-machine-axis-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('machine-axis-status')).toContainText(
    '已导入 Machine Axis',
    { timeout: 30_000 }
  );
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute(
    'data-canonical-trace-hash',
    TRACE_HASH
  );
  await expect(workbench).toHaveAttribute(
    'data-machine-axis-import-active',
    'true'
  );
  await dialog.getByTestId('workbench-close-machine-axis').click();

  const actionId = 'gisele-heavy2-threshold59';
  const action = page
    .getByTestId('workbench-timeline-grid-preview')
    .locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
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
    'control 11200141 / sub 1'
  );
  await expect(
    canonicalTraceInspector.getByTestId('canonical-trace-hit-row').first()
  ).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const currentCapture = await page.screenshot({
    animations: 'disabled',
  });
  await testInfo.attach('112001-current-workbench-capture', {
    body: currentCapture,
    contentType: 'image/png',
  });
  if (process.env.UPDATE_112001_VISUAL_EVIDENCE === '1') {
    await writeFile(SCREENSHOT_PATH, currentCapture);
  } else {
    const committedScreenshot = await readFile(SCREENSHOT_PATH);
    expect(sha256(committedScreenshot)).toBe(SCREENSHOT_SHA256);
  }
});

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function installOwnerRuntimePackage(
  page,
  compiledOwnerContract,
  ownerId
) {
  await page.evaluate(
    async ({ contract, selectedOwnerId }) => {
      const packageModule =
        await import('/src/data/verifiedCombatMechanicsPackage.js');
      const result = structuredClone(
        await packageModule.loadVerifiedCombatMechanicsPackage()
      );
      const contracts = contract.contracts;
      const replaceOwner = (records, additions) => [
        ...(records ?? []).filter(
          record => Number(record.ownerId) !== selectedOwnerId
        ),
        ...(additions ?? []),
      ];
      result.actionVariantGraph.chargingReleaseBindings = replaceOwner(
        result.actionVariantGraph.chargingReleaseBindings,
        contracts.chargingReleaseBindings
      );
      result.actionVariantGraph.breakTriggerWatchers = replaceOwner(
        result.actionVariantGraph.breakTriggerWatchers,
        contracts.breakTriggerWatchers
      );
      result.specialResourceCatalog.passiveEffects = replaceOwner(
        result.specialResourceCatalog.passiveEffects,
        contracts.passives ?? []
      );
      result.actionVariantControlBindings = replaceOwner(
        result.actionVariantControlBindings,
        contracts.controls
      );
      result.characterCombatProductBoundaries.entries = replaceOwner(
        result.characterCombatProductBoundaries.entries,
        contract.productBoundaries ?? []
      );
      await packageModule.installVerifiedCombatMechanicsPackage(result);
    },
    { contract: compiledOwnerContract, selectedOwnerId: ownerId }
  );
}
