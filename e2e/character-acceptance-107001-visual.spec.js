import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const FIXTURE_PATH = 'fixtures/character-acceptance/107001-visual.json';
const FIXTURE_SHA256 =
  '9ce8ed82e0bf73b3632009c52229b1aa3307591603b194cbcbf71aded821a801';
const TRACE_HASH = 'b0da221b401d90ce';
const SCREENSHOT_PATH = 'reports/m12-b3-107001-workbench-visual-evidence.png';
const SCREENSHOT_SHA256 =
  'cd96f58561aa39af7a7469467d08e3c2b8e1ad70846eeb192b38cbab740ee260';

test('[m12-b3-107001-visual-evidence] imports the bound Sifliya fixture and captures the canonical Workbench trace', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();

  const ownerContract = await readJson(
    'src/data/generated/character-combat-owner-contracts/107001.json'
  );
  await installOwnerRuntimePackage(page, ownerContract, 107001);

  const fixtureBytes = await readFile(FIXTURE_PATH);
  expect(createHash('sha256').update(fixtureBytes).digest('hex')).toBe(
    FIXTURE_SHA256
  );
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: '107001-m12-b3-acceptance.json',
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

  const actionId = 'sifliya-ultimate-three-marks';
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
    'control 10700113 / sub 0'
  );
  await expect(
    canonicalTraceInspector.getByTestId('canonical-trace-hit-row').first()
  ).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const currentCapture = await page.screenshot({
    animations: 'disabled',
  });
  await testInfo.attach('107001-current-workbench-capture', {
    body: currentCapture,
    contentType: 'image/png',
  });
  if (process.env.UPDATE_107001_VISUAL_EVIDENCE === '1') {
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
        ...structuredClone(additions ?? []),
      ];
      const controlSkillIds = new Set(
        (contracts.controls ?? []).map(control =>
          Number(control.controlSkillId)
        )
      );
      result.actionMappings = replaceOwner(
        result.actionMappings,
        contracts.publicActions
      );
      result.actionVariantControlBindings = [
        ...(result.actionVariantControlBindings ?? []).filter(
          control => !controlSkillIds.has(Number(control.controlSkillId))
        ),
        ...structuredClone(contracts.controls ?? []),
      ];
      result.actionVariantGraph.publicActionForms = replaceOwner(
        result.actionVariantGraph.publicActionForms,
        contracts.actionForms
      );
      result.actionVariantGraph.contextEdges = replaceOwner(
        result.actionVariantGraph.contextEdges,
        contracts.timingInputEdges
      );
      result.actionVariantGraph.edges = replaceOwner(
        result.actionVariantGraph.edges,
        contracts.variantEdges
      );
      result.actionVariantGraph.attackInputChains = replaceOwner(
        result.actionVariantGraph.attackInputChains,
        contracts.attackInputChains
      );
      result.actionVariantGraph.attackInputMechanicWindows = replaceOwner(
        result.actionVariantGraph.attackInputMechanicWindows,
        contracts.attackInputMechanicWindows
      );
      result.actionVariantGraph.tuningMarkConditionalDamageGroups =
        replaceOwner(
          result.actionVariantGraph.tuningMarkConditionalDamageGroups,
          contracts.tuningMarkConditionalDamageGroups
        );
      result.actionVariantGraph.runtimeEffectBindings = replaceOwner(
        result.actionVariantGraph.runtimeEffectBindings,
        contracts.runtimeEffectBindings
      );
      result.actionVariantGraph.targetStateProfiles = replaceOwner(
        result.actionVariantGraph.targetStateProfiles,
        contracts.targetStateProfiles
      );
      result.actionVariantGraph.targetStateTransactions = replaceOwner(
        result.actionVariantGraph.targetStateTransactions,
        contracts.targetStateTransactions
      );
      result.actionVariantGraph.conditionalHitGroups = replaceOwner(
        result.actionVariantGraph.conditionalHitGroups,
        contracts.conditionalHitGroups
      );
      result.specialResourceCatalog.profiles = replaceOwner(
        result.specialResourceCatalog.profiles,
        contracts.resourceProfiles
      );
      result.specialResourceCatalog.operationBindings = replaceOwner(
        result.specialResourceCatalog.operationBindings,
        contracts.resourceTransactions
      );
      result.specialResourceCatalog.thresholdTransitions = replaceOwner(
        result.specialResourceCatalog.thresholdTransitions,
        contracts.stateMachines
      );
      result.specialResourceCatalog.passiveEffects = replaceOwner(
        result.specialResourceCatalog.passiveEffects,
        contracts.passives
      );
      result.switchTriggerCatalog.profiles = replaceOwner(
        result.switchTriggerCatalog.profiles,
        contracts.switchTriggers
      );
      packageModule.installVerifiedCombatMechanicsPackage(result);
    },
    { contract: compiledOwnerContract, selectedOwnerId: ownerId }
  );
}
