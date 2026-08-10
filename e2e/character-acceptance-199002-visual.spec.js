import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const FIXTURE_PATH = 'fixtures/character-acceptance/199002-starborn-visual.json';
const FIXTURE_SHA256 =
  '8eeef8400f6000b416b353439cb21929a8a0769a2855d8d9dbd4b772bef52ebc';
const TRACE_HASH = '48a24120e2121c6c';
const SCREENSHOT_PATH = 'reports/m12-b3-199002-workbench-visual-evidence.png';
const SCREENSHOT_SHA256 =
  '236f6964b1e9c4c7d91895bdcc2cdcd4086dc5d3d3cee12f7da39e7e7528d415';

test('[m12-b3-199002-visual-evidence] imports the bound STARBORN male fixture and captures the canonical Workbench trace', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();

  const ownerContract = await readJson(
    'src/data/generated/character-combat-owner-contracts/199002.json'
  );
  await installOwnerRuntimePackage(page, ownerContract, 199002);

  const fixtureBytes = await readFile(FIXTURE_PATH);
  expect(createHash('sha256').update(fixtureBytes).digest('hex')).toBe(
    FIXTURE_SHA256
  );
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: '199002-m12-b3-acceptance.json',
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

  const actionId = 'starborn-m-thrust-a3';
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
    'control 19900203 / sub 0'
  );
  await expect(
    canonicalTraceInspector.getByTestId('canonical-trace-hit-row').first()
  ).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  const currentCapture = await page.screenshot({
    animations: 'disabled',
  });
  await testInfo.attach('199002-current-workbench-capture', {
    body: currentCapture,
    contentType: 'image/png',
  });
  if (process.env.UPDATE_199002_VISUAL_EVIDENCE === '1') {
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
      const profileAttackInputSegments = (contracts.attackInputChains ?? [])
        .flatMap(chain =>
          (chain.segments ?? []).map(segment => ({
            ...structuredClone(segment),
            identity:
              segment.identity ??
              `${String(chain.chainIdentity)}:segment:${Number(segment.sequenceIndex)}`,
            sourceSkillId: Number(chain.sourceSkillId),
            attackInputChainIdentity: String(chain.chainIdentity),
            chainSequenceIndex: Number(segment.sequenceIndex),
            sequenceTotal: Number(
              segment.sequenceTotal ?? chain.segments.length
            ),
          }))
        )
        .concat(
          (contracts.actionForms ?? [])
            .filter(
              form =>
                form.publicActionKind === 'normal-attack' &&
                form.selectionKind === 'input-context-derived' &&
                form.executionTiming?.occupancy?.status === 'applied'
            )
            .map(form => {
              const publicAction = (contracts.publicActions ?? []).find(
                action => action.actionKind === form.publicActionKind
              );
              const durationFrames = Number(
                form.executionTiming.occupancy.durationFrames
              );
              const selectedSubSkillIndex = Number(
                form.executionSubSkillIndex ?? 0
              );
              const selectedHitIdentities = (
                form.executionTiming?.hits ?? []
              )
                .map(hit => hit.hitIdentity)
                .filter(Boolean);
              return {
                identity: `${String(form.formIdentity)}:context-segment`,
                sourceSkillId: Number(publicAction?.sourceSkillId),
                attackInputChainIdentity: `context-form:${String(form.formIdentity)}`,
                chainSequenceIndex: 1,
                sequenceIndex: 1,
                sequenceTotal: 1,
                controlSkillId: Number(
                  form.publicControlSkillId ??
                    form.executionControlSkillId
                ),
                executionControlSkillId: Number(
                  form.executionControlSkillId
                ),
                subSkillIndex: selectedSubSkillIndex,
                selectedSubSkillIndex,
                durationFrames,
                effectiveDurationFrames: durationFrames,
                durationStatus: 'applied',
                effectiveDurationStatus: 'applied',
                durationSourceIdentity: form.sourceIdentity,
                sourceIdentity: form.sourceIdentity,
                sourceEvidenceStatus: 'applied',
                scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
                runtimeReady: true,
                schedulable: true,
                selectedHitIdentities,
                hitCount: selectedHitIdentities.length,
                executionTiming: structuredClone(form.executionTiming),
                actionScheduling: {
                  status: 'exact',
                  kind: 'exact-selected-variant-occupancy',
                  durationFrames,
                  planningDurationFrames: null,
                  selectedSubSkillIndex,
                  sourceIdentity: form.sourceIdentity,
                  sourceStatus: 'verified-input-occupancy',
                  variantModelStatus: 'resolved',
                  reasons: [],
                },
              };
            })
        );
      result.actionMappings = result.actionMappings.map(mapping => {
        if (
          mapping.actionKind !== 'normal-attack' ||
          Number(mapping.ownerId) !== selectedOwnerId
        ) {
          return mapping;
        }
        const chainSegments = profileAttackInputSegments
          .filter(
            segment =>
              Number(segment.sourceSkillId) === Number(mapping.sourceSkillId)
          )
          .map(segment => {
            const durationFrames = Number(segment.durationFrames);
            const selectedSubSkillIndex = Number(
              segment.subSkillIndex ?? 0
            );
            const selectedHitIdentities = (
              segment.executionTiming?.hits ?? []
            )
              .map(hit => hit.hitIdentity)
              .filter(Boolean);
            return {
              ...segment,
              selectedSubSkillIndex,
              effectiveDurationFrames: durationFrames,
              durationStatus: 'applied',
              effectiveDurationStatus: 'applied',
              durationSourceIdentity: segment.sourceIdentity,
              sourceEvidenceStatus: 'applied',
              scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
              runtimeReady: true,
              schedulable: true,
              selectedHitIdentities,
              hitCount: selectedHitIdentities.length,
              actionScheduling: {
                status: 'exact',
                kind: 'exact-selected-variant-occupancy',
                durationFrames,
                planningDurationFrames: null,
                selectedSubSkillIndex,
                sourceIdentity: segment.sourceIdentity,
                sourceStatus: 'verified-input-occupancy',
                variantModelStatus: 'resolved',
                reasons: [],
              },
            };
          });
        return { ...mapping, profileAttackInputSegments: chainSegments };
      });
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
