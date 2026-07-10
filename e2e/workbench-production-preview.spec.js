import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
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
    schemaVersion: 9,
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
  expect(project.schemaVersion).toBe(9);
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
