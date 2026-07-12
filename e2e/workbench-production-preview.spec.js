import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('[routes-and-assets] serves production routes and hashed assets', async ({
  page,
}) => {
  const productionAssets = collectProductionAssetResponses(page);

  await page.goto('/');
  await expect(page).toHaveURL(/\/#\/workbench$/);
  await expect(page.getByTestId('workbench-flow-panel')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('workbench-flow-panel')).toBeVisible();

  await page.goto('/#/guide');
  await expect(
    page.getByRole('heading', { name: '使用教程', exact: true })
  ).toBeVisible();
  await page.goto('/#/handbook');
  await expect(
    page.getByRole('heading', { name: '游戏数据图鉴', exact: true })
  ).toBeVisible();
  await page.goto('/#/data-editor');
  await expect(
    page.getByRole('heading', { name: '数据编辑器', exact: true })
  ).toBeVisible();
  await page.goto('/#/unknown-production-route');
  await expect(page).toHaveURL(/\/#\/workbench$/);

  expect(productionAssets.some(asset => asset.type === 'script')).toBe(true);
  expect(productionAssets.some(asset => asset.type === 'stylesheet')).toBe(
    true
  );
  expect(productionAssets.filter(asset => !asset.ok)).toEqual([]);
});

test('[diagnostics-lazy-load] loads runtime diagnostics from a production chunk', async ({
  page,
}) => {
  const diagnosticResponses = [];
  page.on('response', response => {
    if (response.url().includes('workbenchSkillDiagnosticsLoader-')) {
      diagnosticResponses.push({
        url: response.url(),
        status: response.status(),
      });
    }
  });

  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute(
    'data-runtime-diagnostics-status',
    'idle'
  );
  expect(diagnosticResponses).toEqual([]);

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(workbench).toHaveAttribute(
    'data-runtime-diagnostics-status',
    'ready'
  );
  await expect(workbench).toHaveAttribute(
    'data-runtime-diagnostics-revision',
    '1'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'runtime-result'
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toContainText('enemyHpDamage');
  await expect.poll(() => diagnosticResponses.length).toBe(1);
  expect(diagnosticResponses[0]).toMatchObject({ status: 200 });
});

test('[json-project-exchange] restores an exported production JSON project', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('91');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  expect(download.suggestedFilename()).toMatch(/promilia-workbench-.*\.json$/);
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project).toMatchObject({
    schemaVersion: 14,
    game: 'azur-promilia',
    type: 'workbench-project',
    enemyConfig: { level: 91 },
  });
  expect(project.actionDrafts).toHaveLength(2);

  await page.getByTestId('workbench-reset-draft').click();
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '1 action'
  );
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '91'
  );
});

test('[profile-compatibility-gate] rejects an unavailable profile without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('91');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  const unavailableSelection = {
    schemaVersion: 1,
    contractName: 'AzPrWorkbenchMechanicsProfileSelection',
    profileId: 'unavailable-production-profile',
    profileVersion: 7,
  };
  project.mechanicsProfileSelection = unavailableSelection;
  project.scenarioWorkspace.scenarios.forEach(scenario => {
    scenario.draft.mechanicsProfileSelection = unavailableSelection;
  });
  const incompatiblePath = testInfo.outputPath(
    'incompatible-profile.promilia-workbench.json'
  );
  await writeFile(incompatiblePath, JSON.stringify(project));

  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(incompatiblePath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '项目机制配置不兼容'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '91'
  );
});

test('[configuration-instances] binds reusable simulation configs to scenarios and JSON', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await expect(
    page.getByTestId('workbench-configuration-library-panel')
  ).toBeVisible();
  const actorSelect = page.locator(
    '[data-testid="workbench-actor-configuration-select"][data-character-id="109001"]'
  );
  const enemySelect = page.getByTestId('workbench-enemy-configuration-select');
  const originalActorInstanceId = await actorSelect.inputValue();
  const originalEnemyInstanceId = await enemySelect.inputValue();

  await page
    .locator(
      '[data-testid="workbench-actor-configuration-duplicate"][data-character-id="109001"]'
    )
    .click();
  const burstActorInstanceId = await actorSelect.inputValue();
  await page
    .locator(
      '[data-testid="workbench-actor-configuration-name"][data-character-id="109001"]'
    )
    .fill('生产爆发配置');
  await page
    .locator(
      '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
    )
    .fill('0.5');
  await page.getByTestId('workbench-enemy-configuration-duplicate').click();
  const challengeEnemyInstanceId = await enemySelect.inputValue();
  await page.getByTestId('workbench-enemy-level-input').fill('95');

  await page.getByTestId('workbench-scenario-duplicate').click();
  await actorSelect.selectOption(originalActorInstanceId);
  await enemySelect.selectOption(originalEnemyInstanceId);
  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0001"]'
    )
    .click();
  await expect(actorSelect).toHaveValue(burstActorInstanceId);
  await expect(enemySelect).toHaveValue(challengeEnemyInstanceId);
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '95'
  );

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(project).toMatchObject({
    schemaVersion: 14,
    configurationLibrary: {
      schemaVersion: 1,
      actorInstances: expect.any(Array),
      enemyInstances: expect.any(Array),
    },
    scenarioWorkspace: {
      activeScenarioId: 'scenario-0001',
      scenarios: [{ id: 'scenario-0001' }, { id: 'scenario-0002' }],
    },
  });
  expect(project.configurationLibrary.actorInstances).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: burstActorInstanceId }),
    ])
  );
  expect(project.configurationLibrary.enemyInstances).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: challengeEnemyInstanceId }),
    ])
  );
});

test('[png-project-exchange] restores production PNG metadata and lazy exporter assets', async ({
  page,
}) => {
  const snapdomResponses = [];
  page.on('response', response => {
    if (response.url().includes('/snapdom-')) {
      snapdomResponses.push(response.status());
    }
  });

  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('93');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project-png').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const pngBytes = await readFile(downloadPath);
  expect([...pngBytes.subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(pngBytes.includes(Buffer.from('PromiliaAxisToolData'))).toBe(true);
  await expect.poll(() => snapdomResponses.length).toBe(1);
  expect(snapdomResponses).toEqual([200]);

  await page.getByTestId('workbench-reset-draft').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已从 PNG 导入项目'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '93'
  );
});

test('[project-drop-recovery] restores a production project without replacing it on invalid drop', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-project-drop-host')).toHaveCount(1);
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('95');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const projectBuffer = await readFile(downloadPath);

  await page.getByTestId('workbench-reset-draft').click();
  await dragWorkbenchFile(page, {
    name: 'production-axis.promilia-workbench.json',
    mimeType: 'application/json',
    buffer: projectBuffer,
  });
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已从拖放恢复 JSON 项目'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '95'
  );

  await dragWorkbenchFile(page, {
    name: 'invalid.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('invalid project'),
  });
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '仅支持 JSON 或 PNG 项目文件'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '95'
  );
});

test('[multi-action-editing] copies, pastes, and reviews a selected action group', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-add-action').click();
  await page.locator('.action-item[data-action-id="action-0001"]').click();
  await page
    .locator('.action-item[data-action-id="action-0003"]')
    .click({ modifiers: ['Control'] });
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-selected-action-count',
    '2'
  );

  await page.keyboard.press('Control+C');
  await page.keyboard.press('Control+V');
  await expect(page.locator('.action-item')).toHaveCount(5);
  await expect(
    page.locator('.action-item[data-action-id="action-0004"]')
  ).toHaveAttribute('data-selected', 'true');
  await expect(
    page.locator('.action-item[data-action-id="action-0005"]')
  ).toHaveAttribute('data-selected', 'true');

  await page.keyboard.press('ArrowRight');
  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0004'
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toContainText('action-0004');
});

test('[timeline-relations] preserves action relations through project exchange', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-add-action').click();
  await page.locator('.action-item[data-action-id="action-0001"]').click();
  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .click({ modifiers: ['Control'] });
  await page.getByTestId('workbench-timeline-create-relations').click();

  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await page.keyboard.press('Control+C');
  await page.keyboard.press('Control+V');
  await expect(page.locator('.action-item')).toHaveCount(5);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project.schemaVersion).toBe(14);
  expect(project.actionDrafts).toHaveLength(5);
  expect(project.actionRelations).toEqual([
    expect.objectContaining({
      fromActionId: 'action-0001',
      toActionId: 'action-0002',
    }),
    expect.objectContaining({
      fromActionId: 'action-0004',
      toActionId: 'action-0005',
    }),
  ]);

  await page.getByTestId('workbench-reset-draft').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(page.locator('.action-item')).toHaveCount(5);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');
  await page.locator('.action-item[data-action-id="action-0004"]').click();
  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0004'
  );
});

test('[effect-interval-review] reviews an effect interval and refreshes it from the source action', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-effect-add').click();
  await page.getByTestId('workbench-effect-name-input').fill('生产增益');
  await page.getByTestId('workbench-effect-name-input').press('Tab');
  await page.getByTestId('workbench-effect-duration-frame-input').fill('120');
  await page.getByTestId('workbench-effect-duration-frame-input').press('Tab');

  const interval = page.getByTestId('workbench-timeline-effect-interval');
  await expect(interval).toHaveCount(1);
  await interval.click();
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('生产增益');
  await expect(
    page.getByTestId('workbench-effect-interval-lifecycle-event')
  ).toHaveCount(2);

  await page.getByTestId('workbench-effect-edit-source-action').click();
  await page.getByTestId('workbench-effect-duration-frame-input').fill('180');
  await page.getByTestId('workbench-effect-duration-frame-input').press('Tab');
  expect(Number(await interval.getAttribute('data-end-ms'))).toBeCloseTo(
    3000,
    4
  );
  await interval.click();
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('0F-180F');
  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0001'
  );
});

test('[scenario-comparison] compares an edited axis with a snapshot and returns to the changed action', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const baselineDownload = await downloadPromise;
  const baselinePath = await baselineDownload.path();
  expect(baselinePath).toBeTruthy();

  await page.getByTestId('workbench-open-comparison').click();
  const comparison = page.getByTestId('workbench-scenario-comparison');
  await expect(comparison).toBeVisible();
  await page.getByTestId('workbench-comparison-capture-current').click();
  await expect(
    page.getByTestId('workbench-comparison-baseline-source')
  ).toContainText('当前快照');
  await page.getByTestId('workbench-comparison-close').click();

  await page.getByTestId('workbench-start-frame-input').fill('36');
  await page.getByTestId('workbench-start-frame-input').press('Tab');
  await page.getByTestId('workbench-open-comparison').click();
  const changedAction = page.locator(
    '[data-testid="workbench-comparison-action-row"][data-current-action-id="action-0001"]'
  );
  await expect(changedAction).toHaveAttribute('data-changed', 'true');
  await expect(
    page
      .getByTestId('workbench-comparison-metric')
      .filter({ hasText: '排轴时长' })
  ).toContainText('+600 ms');
  await page
    .getByTestId('workbench-comparison-import-baseline-file')
    .setInputFiles(baselinePath);
  await expect(
    page.getByTestId('workbench-comparison-baseline-source')
  ).not.toContainText('当前快照');
  await expect(page.getByTestId('workbench-start-frame-input')).toHaveValue(
    '36'
  );
  await expect(changedAction).toHaveAttribute('data-changed', 'true');

  await changedAction.getByTestId('workbench-comparison-locate-action').click();
  await expect(comparison).toBeHidden();
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-source', 'scenario-comparison');
  await expect(page.getByTestId('workbench-start-frame-input')).toHaveValue(
    '36'
  );
});

test('[cycle-sections] creates, reviews, and restores a production cycle boundary', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  const lane = page.getByTestId('workbench-timeline-lane');
  const laneBox = await lane.boundingBox();
  expect(laneBox).toBeTruthy();
  await lane.evaluate(
    (element, position) =>
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: position.clientX,
          clientY: position.clientY,
        })
      ),
    {
      clientX: laneBox.x + laneBox.width / 30,
      clientY: laneBox.y + 80,
    }
  );
  const addCycleBoundary = page.getByTestId(
    'workbench-action-context-add-cycle-boundary'
  );
  await expect(addCycleBoundary).toBeEnabled();
  await addCycleBoundary.click();
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute('data-cycle-boundary-count', '1');
  await expect(page.getByTestId('workbench-cycle-section-panel')).toBeVisible();
  await expect(page.getByTestId('workbench-cycle-section-tab')).toHaveCount(2);
  const secondAction = page.locator(
    '[data-testid="workbench-cycle-section-action-row"][data-action-id="action-0002"]'
  );
  await secondAction
    .getByTestId('workbench-cycle-section-locate-action')
    .click();
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-source', 'cycle-section');

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project.schemaVersion).toBe(14);
  expect(project.cycleBoundaries).toEqual([
    expect.objectContaining({
      id: 'cycle-boundary-0001',
      timeMs: expect.any(Number),
    }),
  ]);
  await page.getByTestId('workbench-reset-draft').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(workbench).toHaveAttribute('data-cycle-boundary-count', '1');
});

test('[cycle-inheritance] creates and restores a production scenario from a runtime boundary', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  await page.getByTestId('workbench-add-action').click();
  const downstreamAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  const originalStartMs = Number(
    await downstreamAction.getAttribute('data-start-ms')
  );
  const lane = page.getByTestId('workbench-timeline-lane');
  const laneBox = await lane.boundingBox();
  expect(laneBox).toBeTruthy();
  await lane.evaluate(
    (element, position) =>
      element.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: position.clientX,
          clientY: position.clientY,
        })
      ),
    {
      clientX: laneBox.x + laneBox.width / 30,
      clientY: laneBox.y + 80,
    }
  );
  await page.getByTestId('workbench-action-context-add-cycle-boundary').click();
  const boundaryTimeMs = Number(
    await page
      .getByTestId('workbench-cycle-boundary')
      .getAttribute('data-time-ms')
  );
  await page.getByTestId('workbench-create-inherited-scenario').click();

  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0002'
  );
  await expect(workbench).toHaveAttribute('data-cycle-boundary-count', '0');
  await expect(page.locator('.action-item')).toHaveCount(1);
  await expect(downstreamAction).toHaveAttribute(
    'data-start-ms',
    String(originalStartMs - boundaryTimeMs)
  );

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project).toMatchObject({
    schemaVersion: 14,
    initialRuntimeState: {
      contractName: 'AzPrInitialRuntimeState',
      source: {
        sourceScenarioId: 'scenario-0001',
        boundaryId: 'cycle-boundary-0001',
        boundaryTimeMs,
      },
      enemy: {
        hp: { currentValue: expect.any(Number) },
        toughness: { currentValue: expect.any(Number) },
      },
    },
    scenarioWorkspace: {
      activeScenarioId: 'scenario-0002',
      scenarios: [
        { id: 'scenario-0001' },
        {
          id: 'scenario-0002',
          draft: {
            initialRuntimeState: {
              source: { boundaryId: 'cycle-boundary-0001' },
            },
          },
        },
      ],
    },
  });

  await page.getByTestId('workbench-reset-draft').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0002'
  );
  await expect(page.locator('.action-item')).toHaveCount(1);
});

test('[workspace-scenarios] switches, compares, and restores independent production scenarios', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  await page.getByTestId('workbench-scenario-rename').click();
  await page.getByTestId('workbench-scenario-rename-input').fill('生产方案');
  await page.getByTestId('workbench-scenario-rename-input').press('Enter');
  await page.getByTestId('workbench-scenario-duplicate').click();
  await page.getByTestId('workbench-add-action').click();
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(page.locator('.action-item')).toHaveCount(2);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project.schemaVersion).toBe(14);
  expect(project.scenarioWorkspace).toMatchObject({
    activeScenarioId: 'scenario-0002',
    scenarios: [
      { id: 'scenario-0001', name: '生产方案' },
      { id: 'scenario-0002', name: '生产方案 副本' },
    ],
  });

  await page.getByTestId('workbench-reset-draft').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(page.locator('.action-item')).toHaveCount(2);
  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0001"]'
    )
    .click();
  await expect(page.locator('.action-item')).toHaveCount(1);

  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0002"]'
    )
    .click();
  await page.getByTestId('workbench-open-comparison').click();
  await page
    .getByTestId('workbench-comparison-workspace-scenario')
    .selectOption('scenario-0001');
  await expect(
    page.getByTestId('workbench-comparison-baseline-source')
  ).toContainText('生产方案');
  await expect(page.getByTestId('workbench-comparison-action-row')).toHaveCount(
    2
  );
});

test('[workspace-layout] restores desktop focus modes and keeps narrow content available', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  const actionLibrary = page.locator('.action-library');
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(page.getByTestId('workbench-layout-bar')).toBeVisible();

  await page
    .locator('[data-testid="workbench-layout-mode"][data-layout-mode="review"]')
    .click();
  await expect(workbench).toHaveAttribute(
    'data-workbench-layout-mode',
    'review'
  );
  await expect(actionLibrary).toBeHidden();
  await expect(inspector).toBeVisible();

  await page.getByTestId('workbench-reset-layout').click();
  const resizer = page.getByTestId('workbench-left-resizer');
  const box = await resizer.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box.x + box.width / 2, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 48, box.y + 80);
  await page.mouse.up();
  await expect(workbench).toHaveAttribute(
    'data-workbench-left-panel-width',
    '308'
  );

  await page.reload();
  await expect(workbench).toHaveAttribute(
    'data-workbench-left-panel-width',
    '308'
  );
  await page
    .locator('[data-testid="workbench-layout-mode"][data-layout-mode="review"]')
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('workbench-layout-bar')).toBeHidden();
  await expect(actionLibrary).toBeVisible();
  await expect(inspector).toBeVisible();
  await expectPageWithoutHorizontalOverflow(page);
});

test('[narrow-main-flow] completes runtime review, edit, and refresh without overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/workbench');
  await expectPageWithoutHorizontalOverflow(page);

  await page.getByTestId('workbench-flow-open-runtime').click();
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0001'
  );
  const originStatePointId = await page
    .getByTestId('workbench-runtime-selected-detail-state-point')
    .textContent();
  expect(originStatePointId).toContain('action-0001');
  await expectPageWithoutHorizontalOverflow(page);

  await page.getByTestId('workbench-action-contribution-edit-action').click();
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-origin', 'runtime-focus');
  await page.getByTestId('workbench-start-frame-input').fill('18');
  await expect(flowPanel).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  await expectPageWithoutHorizontalOverflow(page);

  await page.getByTestId('workbench-flow-return-edit-result').click();
  await expect(flowPanel).toHaveAttribute(
    'data-flow-phase',
    'edit-result-review'
  );
  const refreshedStatePointId = await page
    .getByTestId('workbench-runtime-selected-detail-state-point')
    .textContent();
  expect(refreshedStatePointId).toContain('action-0001');
  expect(refreshedStatePointId).not.toBe(originStatePointId);
  await expectPageWithoutHorizontalOverflow(page);
});

function collectProductionAssetResponses(page) {
  const assets = [];
  page.on('response', response => {
    const request = response.request();
    if (!['script', 'stylesheet'].includes(request.resourceType())) {
      return;
    }
    assets.push({
      type: request.resourceType(),
      url: response.url(),
      status: response.status(),
      ok: response.status() >= 200 && response.status() < 400,
    });
  });
  return assets;
}

async function expectPageWithoutHorizontalOverflow(page) {
  await expect
    .poll(() =>
      page.evaluate(() =>
        Math.max(
          0,
          document.documentElement.scrollWidth -
            document.documentElement.clientWidth
        )
      )
    )
    .toBe(0);
}

async function dragWorkbenchFile(page, { name, mimeType, buffer }) {
  const payload = {
    name,
    mimeType,
    base64: Buffer.from(buffer).toString('base64'),
  };
  await page.evaluate(filePayload => {
    const bytes = Uint8Array.from(atob(filePayload.base64), character =>
      character.charCodeAt(0)
    );
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([bytes], filePayload.name, { type: filePayload.mimeType })
    );
    window.dispatchEvent(
      new DragEvent('dragenter', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, payload);
  await expect(
    page.getByTestId('workbench-project-drop-overlay')
  ).toBeVisible();
  await page.evaluate(filePayload => {
    const bytes = Uint8Array.from(atob(filePayload.base64), character =>
      character.charCodeAt(0)
    );
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(
      new File([bytes], filePayload.name, { type: filePayload.mimeType })
    );
    window.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      })
    );
  }, payload);
  await expect(page.getByTestId('workbench-project-drop-overlay')).toHaveCount(
    0
  );
}
