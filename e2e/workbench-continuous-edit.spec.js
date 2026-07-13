import { expect, test } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import {
  BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
  createBasicWorkbenchDraftFixture,
} from './helpers/basic-workbench-draft';
import { createRecoverSpRuntimeSampleFixture } from '../src/simulation/fixtures/recoverSpRuntimeSampleFixture';

test.beforeEach(async ({ page }) => {
  await prepareBasicWorkbenchScenario(page);
});

test('routes every primary entry to the real Workbench @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/');
  await expect(page).toHaveURL(/\/#\/workbench$/);
  await expect(page.getByTestId('workbench-flow-panel')).toBeVisible();

  await page.goto('/#/editor');
  await expect(page).toHaveURL(/\/#\/workbench$/);
  await expect(page.getByTestId('workbench-flow-panel')).toBeVisible();

  await page.goto('/#/preset');
  await expect(page).toHaveURL(/\/#\/workbench\?presets=1$/);
  await expect(page.getByTestId('workbench-preset-library')).toBeVisible();

  await page.goto('/#/unknown-legacy-route');
  await expect(page).toHaveURL(/\/#\/workbench$/);
  await expect(page.getByTestId('workbench-flow-panel')).toBeVisible();

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps every auxiliary route usable without global component registration @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/guide');
  await expect(
    page.getByRole('heading', { name: '使用教程', exact: true })
  ).toBeVisible();
  await expect(page.locator('.guide-menu.el-menu')).toBeVisible();

  await page.goto('/#/handbook');
  await expect(
    page.getByRole('heading', { name: '游戏数据图鉴', exact: true })
  ).toBeVisible();
  await expect(page.getByPlaceholder('搜索角色或技能')).toBeVisible();

  await page.goto('/#/data-editor');
  await expect(
    page.getByRole('heading', { name: '数据编辑器', exact: true })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '保存更改' })).toBeVisible();
  await expect(page.locator('.data-editor-tabs .el-tabs')).toBeVisible();

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('edits and reviews an arbitrary action group @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-add-action').click();
  await page.locator('.action-item[data-action-id="action-0003"]').click();
  await page.getByTestId('workbench-start-frame-input').fill('1800');

  const workbench = page.locator('main.workbench');
  const timelineLane = page.getByTestId('workbench-timeline-lane').first();
  const firstTimelineAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
  );
  const secondTimelineAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await firstTimelineAction.scrollIntoViewIfNeeded();
  await page.getByTestId('workbench-timeline-box-select-toggle').click();
  await expect(
    page.getByTestId('workbench-timeline-grid-preview')
  ).toHaveAttribute('data-box-selection-mode', 'true');
  const timelineBox = await timelineLane.boundingBox();
  const firstActionBox = await firstTimelineAction.boundingBox();
  const secondActionBox = await secondTimelineAction.boundingBox();
  expect(timelineBox).toBeTruthy();
  expect(firstActionBox).toBeTruthy();
  expect(secondActionBox).toBeTruthy();
  const selectionStartX = Math.max(
    timelineBox.x + 1,
    Math.min(firstActionBox.x, secondActionBox.x) - 4
  );
  const selectionStartY = Math.max(
    timelineBox.y + 1,
    Math.min(firstActionBox.y, secondActionBox.y) - 6
  );
  const selectionEndX = Math.min(
    timelineBox.x + timelineBox.width - 1,
    Math.max(
      firstActionBox.x + firstActionBox.width,
      secondActionBox.x + secondActionBox.width
    ) + 4
  );
  const selectionEndY = Math.min(
    timelineBox.y + timelineBox.height - 1,
    Math.max(
      firstActionBox.y + firstActionBox.height,
      secondActionBox.y + secondActionBox.height
    ) + 4
  );
  await page.mouse.move(selectionStartX, selectionStartY);
  await page.mouse.down();
  await page.mouse.move(selectionEndX, selectionEndY);
  await page.mouse.up();

  await expect(workbench).toHaveAttribute('data-selected-action-count', '2');
  await expect(
    page.locator('.action-item[data-action-id="action-0001"]')
  ).toHaveAttribute('data-selected', 'true');
  await expect(
    page.locator('.action-item[data-action-id="action-0002"]')
  ).toHaveAttribute('data-selected', 'true');
  await expect(
    page.locator('.action-item[data-action-id="action-0003"]')
  ).toHaveAttribute('data-selected', 'false');
  await page.getByTestId('workbench-timeline-box-select-toggle').click();
  await page.getByTestId('workbench-timeline-create-relations').click();
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await expect(
    page.locator(
      '[data-testid="workbench-action-relation"][data-relation-id="relation-0001"]'
    )
  ).toBeVisible();

  const sourceStarts = await Promise.all(
    ['action-0001', 'action-0002'].map(actionId =>
      page
        .locator(
          `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
        )
        .getAttribute('data-start-ms')
        .then(Number)
    )
  );
  await page.keyboard.press('Control+C');
  await timelineLane.scrollIntoViewIfNeeded();
  const pasteTimelineBox = await timelineLane.boundingBox();
  expect(pasteTimelineBox).toBeTruthy();
  await page.mouse.click(
    pasteTimelineBox.x + pasteTimelineBox.width * 0.7,
    pasteTimelineBox.y + 20,
    { button: 'right' }
  );
  await expect(page.getByTestId('workbench-action-context-menu')).toBeVisible();
  await page.getByTestId('workbench-action-context-paste').click();

  await expect(page.locator('.action-item')).toHaveCount(5);
  await expect(workbench).toHaveAttribute('data-selected-action-count', '2');
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');
  await expect(
    page.locator('.action-item[data-action-id="action-0004"]')
  ).toHaveAttribute('data-selected', 'true');
  await expect(
    page.locator('.action-item[data-action-id="action-0005"]')
  ).toHaveAttribute('data-selected', 'true');
  const pastedStarts = await Promise.all(
    ['action-0004', 'action-0005'].map(actionId =>
      page
        .locator(
          `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
        )
        .getAttribute('data-start-ms')
        .then(Number)
    )
  );
  expect(pastedStarts[0]).toBeGreaterThan(10000);
  expect(pastedStarts[1] - pastedStarts[0]).toBeCloseTo(
    sourceStarts[1] - sourceStarts[0],
    4
  );

  const draggedAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
  );
  await draggedAction.scrollIntoViewIfNeeded();
  const draggedActionBox = await draggedAction.boundingBox();
  expect(draggedActionBox).toBeTruthy();
  await page.mouse.move(
    draggedActionBox.x + Math.min(12, draggedActionBox.width / 2),
    draggedActionBox.y + draggedActionBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    draggedActionBox.x + Math.min(12, draggedActionBox.width / 2) + 24,
    draggedActionBox.y + draggedActionBox.height / 2
  );
  await page.mouse.up();
  const shiftedStarts = await Promise.all(
    ['action-0004', 'action-0005'].map(actionId =>
      page
        .locator(
          `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
        )
        .getAttribute('data-start-ms')
        .then(Number)
    )
  );
  expect(shiftedStarts[0]).toBeGreaterThan(pastedStarts[0]);
  expect(shiftedStarts[1] - shiftedStarts[0]).toBeCloseTo(
    pastedStarts[1] - pastedStarts[0],
    4
  );
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');

  const pastedRelation = page.locator(
    '[data-testid="workbench-action-relation"][data-relation-id="relation-0002"]'
  );
  await pastedRelation.dispatchEvent('contextmenu', {
    clientX: timelineBox.x + 240,
    clientY: timelineBox.y + 80,
  });
  await expect(page.getByTestId('workbench-action-context-menu')).toBeVisible();
  await page.getByTestId('workbench-action-context-delete-relation').click();
  await expect(page.locator('.action-item')).toHaveCount(5);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await page.keyboard.press('Control+Z');
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');

  await page.locator('.action-item[data-action-id="action-0005"]').click();
  await page
    .locator('.action-item[data-action-id="action-0004"]')
    .click({ modifiers: ['Control'] });
  await expect(workbench).toHaveAttribute('data-selected-action-count', '2');

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0004'
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toContainText('action-0004');

  await page.keyboard.press('Delete');
  await expect(page.locator('.action-item')).toHaveCount(3);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await page.keyboard.press('Control+Z');
  await expect(page.locator('.action-item')).toHaveCount(5);
  await expect(workbench).toHaveAttribute('data-selected-action-count', '2');
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const exportedProject = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(exportedProject.schemaVersion).toBe(16);
  expect(exportedProject.actionDrafts).toHaveLength(5);
  expect(exportedProject.actionRelations).toEqual([
    expect.objectContaining({
      id: 'relation-0001',
      fromActionId: 'action-0001',
      toActionId: 'action-0002',
    }),
    expect.objectContaining({
      id: 'relation-0002',
      fromActionId: 'action-0004',
      toActionId: 'action-0005',
    }),
  ]);

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await expect(page.locator('.action-item')).toHaveCount(1);
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

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps setup, edit return, and result selection synced', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);

  await page
    .locator('.action-item[data-action-id="action-0003"]')
    .getByTestId('workbench-action-list-edit-result-action')
    .click();
  await expectRuntimeFocusInEditor(page);
  const { returnedState: refreshedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0003',
      frameValue: '186',
      msValue: '3100',
      originStatePointId: copiedState.statePointId,
      navigationCount: '3',
      navigationIndex: '2',
      selected: false,
    });

  const firstActionResultRow = page.locator(
    '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
  );
  await expect(firstActionResultRow).toHaveAttribute(
    'data-result-location-status',
    'available'
  );
  const firstActionStatePointId = await firstActionResultRow.getAttribute(
    'data-runtime-state-point-id'
  );
  expect(firstActionStatePointId).toContain('action-0001');

  await firstActionResultRow.click();
  const firstActionState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(firstActionState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '3',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(firstActionState, firstActionStatePointId);
  await expect(firstActionResultRow).toHaveAttribute(
    'data-result-location-status',
    'selected-result'
  );
  await expect(firstActionResultRow).toHaveAttribute(
    'data-selected-state-point-id',
    firstActionStatePointId
  );

  await page.locator('.action-item[data-action-id="action-0003"]').click();
  const actionListJumpState = await waitForRuntimeAction(page, 'action-0003');
  expectRuntimeReviewState(actionListJumpState, {
    phase: 'edit-result-review',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  expect(actionListJumpState.statePointId).toContain('action-0003');
  expectRuntimeStatePointSynced(
    actionListJumpState,
    actionListJumpState.statePointId
  );
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0003"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    actionListJumpState.statePointId
  );

  await page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .click();
  const timelineJumpState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(timelineJumpState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expect(timelineJumpState.statePointId).toContain('action-0002');
  expectRuntimeStatePointSynced(
    timelineJumpState,
    timelineJumpState.statePointId
  );
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    timelineJumpState.statePointId
  );
  expect(refreshedState.statePointId).toContain('action-0003');

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('runs the visible curve-log-detail edit loop end to end @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-runtime-diagnostics-status',
    'idle'
  );

  const reviewEntry = page.getByTestId(
    'workbench-runtime-review-primary-operation'
  );
  await expect(reviewEntry).toHaveAttribute(
    'data-operation-kind',
    'open-runtime-results'
  );
  await expect(reviewEntry).toHaveText('运行模拟');
  await reviewEntry.click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-runtime-diagnostics-status',
    'ready'
  );
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-runtime-diagnostics-revision',
    '1'
  );
  await expect(
    page.getByTestId('workbench-main-flow-workspace')
  ).toHaveAttribute('data-main-flow-dispatch-source', 'runtime-review-primary');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expectRuntimeHitReviewMode(page);

  const curvePoint = page
    .locator(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first();
  await curvePoint.click();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'resource-runtime-curve');
  await expectCurveAndLogSelection(page, openedState.statePointId);
  await expectRuntimeThreeValueStateDetail(page, openedState.statePointId);
  await expectRuntimeSelectedHitTransaction(page, openedState.statePointId);

  await page
    .locator(
      '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="delta"]'
    )
    .click();
  await expect(page.getByTestId('workbench-event-log-panel')).toHaveAttribute(
    'data-runtime-log-review-mode',
    'delta'
  );
  await expect(
    page
      .locator(
        `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedState.statePointId}"]`
      )
      .first()
  ).toHaveAttribute('data-review-unit', 'delta');
  await page
    .locator(
      '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="hit"]'
    )
    .click();
  await expectRuntimeHitReviewMode(page);

  const logRow = page
    .locator(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first();
  await clickRuntimeLogRow(page, logRow);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'event-log-runtime-row');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source-kind', 'log');
  await expectCurveAndLogSelection(page, openedState.statePointId);
  await expectRuntimeSimLogHitAggregateContributions(page);
  await expectRuntimeThreeValueStateDetail(page, openedState.statePointId);
  await expectRuntimeSelectedHitTransaction(page, openedState.statePointId);

  await page
    .locator(
      '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="selfEnergyChange"]'
    )
    .click();
  await expect(
    page.getByTestId('workbench-runtime-sim-log-selection-filtered')
  ).toBeVisible();
  await expect(
    page.getByTestId('workbench-runtime-sim-log-navigation')
  ).toHaveAttribute('data-state-point-id', openedState.statePointId);
  await page.getByTestId('workbench-runtime-sim-log-show-selected').click();
  await expectCurveAndLogSelection(page, openedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expectRuntimeSimLogHitAggregateContributions(page);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '24',
    msValue: '400',
    originStatePointId: openedState.statePointId,
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
    preNudgeStartFrame: true,
    returnButtonTestId:
      'workbench-runtime-resource-chart-selection-return-result',
  });

  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeSimLogHitAggregateContributions(page);
  await expectRuntimeThreeValueStateDetail(page, returnedState.statePointId);
  await expectRuntimeSelectedHitTransaction(page, returnedState.statePointId);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('returns refreshed results from the runtime detail panel @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute('data-flow-phase', 'action-edit');

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);

  const logRow = page
    .locator(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first();
  await expect(logRow).toBeVisible();
  await clickRuntimeLogRow(page, logRow);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'event-log-runtime-row');
  await expectCurveAndLogSelection(page, openedState.statePointId);

  await focusRuntimeDetailAction(page);
  const { editState, returnedState } = await editCurrentActionFrameAndReturn(
    page,
    {
      actionId: 'action-0001',
      frameValue: '30',
      msValue: '500',
      originStatePointId: openedState.statePointId,
      navigationCount: '1',
      navigationIndex: '0',
      selected: true,
      returnButtonTestId: 'workbench-runtime-selected-detail-return-result',
    }
  );

  expect(returnedState.statePointId).toBe(editState.feedbackStatePointId);
  await expectCurveAndLogSelection(page, editState.feedbackStatePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    editState.feedbackStatePointId
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('runs the Workbench flow panel edit-result loop end to end @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute('data-flow-phase', 'action-edit');

  const openRuntimeButton = page.getByTestId('workbench-flow-open-runtime');
  await expect(openRuntimeButton).toBeEnabled();
  await expect(openRuntimeButton).toContainText('运行模拟');
  await openRuntimeButton.click();

  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  const curvePoint = page
    .locator(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first();
  await expect(curvePoint).toBeVisible();
  await curvePoint.click();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'resource-runtime-curve');
  await expectCurveAndLogSelection(page, openedState.statePointId);

  const logRow = page
    .locator(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first();
  await expect(logRow).toBeVisible();
  await clickRuntimeLogRow(page, logRow);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'event-log-runtime-row');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source-kind', 'log');
  await expectCurveAndLogSelection(page, openedState.statePointId);

  const flowEditButton = page.getByTestId('workbench-flow-edit-runtime-action');
  await expect(flowEditButton).toBeEnabled();
  await expect(flowEditButton).toHaveAttribute(
    'data-state-point-id',
    openedState.statePointId
  );
  await flowEditButton.click();
  await expectRuntimeFocusInEditor(page);

  await page.getByTestId('workbench-start-frame-input').fill('36');
  await expect(flowPanel).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  const editState = await readEditState(
    page,
    'workbench-flow-return-edit-result'
  );
  expect(editState).toMatchObject({
    actionId: 'action-0001',
    phase: 'edit-result-ready',
    resultFocused: 'false',
    startFrameValue: '36',
    startMsValue: '600',
    returnButtonText: '查看刷新结果',
    pageOverflowX: 0,
  });
  expect(editState.feedbackOriginStatePointId).toBe(openedState.statePointId);
  expect(editState.feedbackStatePointId).toContain('action-0001');
  expect(editState.feedbackStatePointId).not.toBe(openedState.statePointId);

  const returnResultButton = page.getByTestId(
    'workbench-flow-return-edit-result'
  );
  await expect(returnResultButton).toBeEnabled();
  await expect(returnResultButton).toHaveText('查看刷新结果');
  await returnResultButton.click();

  await expect(flowPanel).toHaveAttribute(
    'data-flow-phase',
    'edit-result-review'
  );
  const returnedState = await readWorkbenchState(page);
  expectRuntimeReviewState(returnedState, {
    phase: 'edit-result-review',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(returnedState, editState.feedbackStatePointId);
  await expectCurveAndLogSelection(page, editState.feedbackStatePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    editState.feedbackStatePointId
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps the complete visible Workbench loop demonstrable @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute('data-flow-phase', 'action-edit');

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  await page
    .locator(
      `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first()
    .click();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'resource-runtime-curve');
  await expectCurveAndLogSelection(page, openedState.statePointId);

  await clickRuntimeLogRow(
    page,
    page
      .locator(
        `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedState.statePointId}"]`
      )
      .first()
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'event-log-runtime-row');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toContainText(openedState.statePointId);
  await expectRuntimeSimLogHitAggregateContributions(page);

  const editButton = page.getByTestId('workbench-flow-edit-runtime-action');
  await expect(editButton).toHaveAttribute(
    'data-state-point-id',
    openedState.statePointId
  );
  await editButton.click();
  await expectRuntimeFocusInEditor(page);

  const { editState, returnedState } = await editCurrentActionFrameAndReturn(
    page,
    {
      actionId: 'action-0001',
      frameValue: '60',
      msValue: '1000',
      originStatePointId: openedState.statePointId,
      navigationCount: '1',
      navigationIndex: '0',
      selected: true,
    }
  );

  expect(returnedState.statePointId).toBe(editState.feedbackStatePointId);
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toContainText(returnedState.statePointId);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', returnedState.statePointId);
  await expect(flowPanel).toHaveAttribute(
    'data-flow-phase',
    'edit-result-review'
  );
  await expect(editButton).toHaveText('继续修改动作');
  await expect(editButton).toHaveAttribute(
    'data-state-point-id',
    returnedState.statePointId
  );
  await editButton.click();
  await expectRuntimeFocusInEditor(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps refreshed runtime results editable for another visible loop @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute('data-flow-phase', 'action-edit');

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);
  await expectCurveAndLogSelection(page, openedState.statePointId);

  await page.getByTestId('workbench-flow-edit-runtime-action').click();
  await expectRuntimeFocusInEditor(page);
  const { returnedState: firstReturnedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0001',
      frameValue: '36',
      msValue: '600',
      originStatePointId: openedState.statePointId,
      navigationCount: '1',
      navigationIndex: '0',
      selected: true,
    });
  await expectCurveAndLogSelection(page, firstReturnedState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-resource-chart-selection-action-focus')
  ).toHaveText('继续修改动作');
  await expect(
    page.getByTestId('workbench-runtime-sim-log-action-focus')
  ).toHaveText('继续修改动作');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-action-focus')
  ).toHaveText('继续修改动作');
  const flowContinueButton = flowPanel.getByTestId(
    'workbench-flow-edit-runtime-action'
  );
  await expect(flowContinueButton).toHaveText('继续修改动作');
  await expect(flowContinueButton).toHaveAttribute(
    'data-state-point-id',
    firstReturnedState.statePointId
  );
  await expect(flowContinueButton).toHaveAttribute(
    'data-primary-action',
    'true'
  );

  const primaryOperation = page.getByTestId(
    'workbench-runtime-review-primary-operation'
  );
  await expect(primaryOperation).toHaveAttribute(
    'data-operation-kind',
    'focus-runtime-action'
  );
  await expect(primaryOperation).toHaveAttribute(
    'data-state-point-id',
    firstReturnedState.statePointId
  );
  await expect(primaryOperation).toHaveText('继续修改动作');
  await flowContinueButton.click();
  await expectRuntimeFocusInEditor(page);

  const { returnedState: secondReturnedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0001',
      frameValue: '48',
      msValue: '800',
      originStatePointId: firstReturnedState.statePointId,
      navigationCount: '1',
      navigationIndex: '0',
      selected: true,
    });
  expect(secondReturnedState.statePointId).not.toBe(
    firstReturnedState.statePointId
  );
  await expectCurveAndLogSelection(page, secondReturnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    secondReturnedState.statePointId
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps the Workbench flow panel contribution loop usable @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute('data-flow-phase', 'action-edit');

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  const contributionButton = page.getByTestId(
    'workbench-flow-open-contribution'
  );
  await expect(contributionButton).toBeEnabled();
  await expect(contributionButton).toHaveAttribute(
    'data-state-point-id',
    openedState.statePointId
  );
  await contributionButton.click();

  const contributionState = await readWorkbenchState(page);
  expectRuntimeReviewState(contributionState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(contributionState, openedState.statePointId);
  await expectCurveAndLogSelection(page, openedState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'action-contribution');
  await expect(
    page.getByTestId('workbench-runtime-sim-log-filter-summary')
  ).toContainText('贡献定位');
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-flow-state-point-id', openedState.statePointId);
  await expect(
    page
      .locator(
        `[data-testid="workbench-action-contribution-row"][data-state-point-id="${openedState.statePointId}"]`
      )
      .first()
  ).toHaveAttribute('data-active', 'true');

  const contributionEditButton = page.getByTestId(
    'workbench-action-contribution-edit-action'
  );
  await expect(contributionEditButton).toHaveAttribute(
    'data-state-point-id',
    openedState.statePointId
  );
  await contributionEditButton.click();
  await expectRuntimeFocusInEditor(page);

  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '42',
    msValue: '700',
    originStatePointId: openedState.statePointId,
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
    returnButtonTestId: 'workbench-action-contribution-return-result',
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-flow-state-point-id', returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps runtime detail navigation tied to edit return', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });

  const detailNavigation = page.getByTestId(
    'workbench-runtime-selected-detail-navigation'
  );
  await expect(detailNavigation).toHaveAttribute('data-navigation-count', '3');
  await expect(detailNavigation).toHaveAttribute('data-navigation-index', '2');

  const previousDetailResult = page.getByTestId(
    'workbench-runtime-selected-detail-navigation-prev'
  );
  await expect(previousDetailResult).toHaveAttribute(
    'data-state-point-id',
    /action-0002/
  );
  await previousDetailResult.click();

  const previousState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(previousState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(previousState, previousState.statePointId);
  await expectCurveAndLogSelection(page, previousState.statePointId);

  const nextDetailResult = page.getByTestId(
    'workbench-runtime-selected-detail-navigation-next'
  );
  await expect(nextDetailResult).toHaveAttribute(
    'data-state-point-id',
    /action-0003/
  );
  await nextDetailResult.click();

  const nextState = await waitForRuntimeAction(page, 'action-0003');
  expectRuntimeReviewState(nextState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  expectRuntimeStatePointSynced(nextState, nextState.statePointId);
  await expectCurveAndLogSelection(page, nextState.statePointId);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0003',
    frameValue: '192',
    msValue: '3200',
    originStatePointId: nextState.statePointId,
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps runtime log navigation tied to result review @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });
  await expectCurveAndLogSelection(page, copiedState.statePointId);

  const previousLogResult = page.getByTestId(
    'workbench-runtime-sim-log-navigation-prev'
  );
  await expect(previousLogResult).toHaveAttribute(
    'data-state-point-id',
    /action-0002/
  );
  await previousLogResult.click();

  const previousState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(previousState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(previousState, previousState.statePointId);
  await expectCurveAndLogSelection(page, previousState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute(
    'data-runtime-review-source',
    'event-log-runtime-navigation'
  );

  const nextLogResult = page.getByTestId(
    'workbench-runtime-sim-log-navigation-next'
  );
  await expect(nextLogResult).toHaveAttribute(
    'data-state-point-id',
    /action-0003/
  );
  await nextLogResult.click();

  const nextState = await waitForRuntimeAction(page, 'action-0003');
  expectRuntimeReviewState(nextState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  expectRuntimeStatePointSynced(nextState, nextState.statePointId);
  await expectCurveAndLogSelection(page, nextState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps multi-action resource chart navigation tied to middle edit return @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });
  await expectRuntimeOutputConsistent(page);

  const previousCurveResult = page.getByTestId(
    'workbench-runtime-resource-chart-selection-prev'
  );
  await expect(previousCurveResult).toHaveAttribute(
    'data-state-point-id',
    /action-0002/
  );
  await previousCurveResult.click();

  const middleState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(middleState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(middleState, middleState.statePointId);
  await expectCurveAndLogSelection(page, middleState.statePointId);

  const nextCurveResult = page.getByTestId(
    'workbench-runtime-resource-chart-selection-next'
  );
  await expect(nextCurveResult).toHaveAttribute(
    'data-state-point-id',
    /action-0003/
  );
  await nextCurveResult.click();

  const finalState = await waitForRuntimeAction(page, 'action-0003');
  expectRuntimeReviewState(finalState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  expectRuntimeStatePointSynced(finalState, finalState.statePointId);
  await expectCurveAndLogSelection(page, finalState.statePointId);

  await page
    .getByTestId('workbench-runtime-resource-chart-selection-prev')
    .click();
  const selectedMiddleState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeStatePointSynced(
    selectedMiddleState,
    selectedMiddleState.statePointId
  );

  const curveEditButton = page.getByTestId(
    'workbench-runtime-resource-chart-selection-action-focus'
  );
  await expect(curveEditButton).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await expect(curveEditButton).toHaveAttribute(
    'data-state-point-id',
    selectedMiddleState.statePointId
  );
  await curveEditButton.click();
  await expectRuntimeFocusInEditor(page);

  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '108',
    msValue: '1800',
    originStatePointId: selectedMiddleState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
    returnButtonTestId:
      'workbench-runtime-resource-chart-selection-return-result',
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('recovers filtered multi-action logs before returning edited results @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });
  await expectRuntimeOutputConsistent(page);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await readPageOverflowX(page)).toBe(0);

  const previousCurveResult = page.getByTestId(
    'workbench-runtime-resource-chart-selection-prev'
  );
  await expect(previousCurveResult).toHaveAttribute(
    'data-state-point-id',
    /action-0002/
  );
  await previousCurveResult.click();

  const middleState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(middleState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(middleState, middleState.statePointId);
  await expectCurveAndLogSelection(page, middleState.statePointId);

  await page
    .getByTestId('workbench-runtime-sim-log-action-filter')
    .selectOption('action-0003');
  await expect(
    page.getByTestId('workbench-runtime-sim-log-selection-filtered')
  ).toBeVisible();
  await expect(
    page.getByTestId('workbench-runtime-sim-log-navigation')
  ).toHaveAttribute('data-navigation-status', 'filtered-out');
  await expect(
    page.getByTestId('workbench-runtime-sim-log-navigation')
  ).toHaveAttribute('data-state-point-id', middleState.statePointId);

  await page.getByTestId('workbench-runtime-sim-log-show-selected').click();
  await expectCurveAndLogSelection(page, middleState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-sim-log-action-filter')
  ).toHaveValue('action-0002');

  const logEditButton = page.getByTestId(
    'workbench-runtime-sim-log-action-focus'
  );
  await expect(logEditButton).toHaveAttribute('data-action-id', 'action-0002');
  await expect(logEditButton).toHaveAttribute(
    'data-state-point-id',
    middleState.statePointId
  );
  await logEditButton.click();
  await expectRuntimeFocusInEditor(page);
  expect(await readPageOverflowX(page)).toBe(0);

  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '108',
    msValue: '1800',
    originStatePointId: middleState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
    returnButtonTestId: 'workbench-runtime-sim-log-return-result',
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  expect(await readPageOverflowX(page)).toBe(0);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps contribution navigation tied to multi-action edit return @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });

  await selectHpContributionAndExpectResultFocus(page, copiedState);
  await expect(
    page.getByTestId('workbench-action-contribution-navigation')
  ).toHaveAttribute('data-navigation-count', '3');
  await expect(
    page.getByTestId('workbench-action-contribution-navigation')
  ).toHaveAttribute('data-navigation-index', '2');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-index')
  ).toHaveText('3/3');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-prev')
  ).toHaveAttribute('data-action-id', 'action-0002');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-next')
  ).toBeDisabled();

  await page.getByTestId('workbench-action-contribution-nav-prev').click();
  const middleState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(middleState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(middleState, middleState.statePointId);
  await expectCurveAndLogSelection(page, middleState.statePointId);
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0002');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-index')
  ).toHaveText('2/3');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-next')
  ).toHaveAttribute('data-action-id', 'action-0003');
  await expectRuntimeOutputConsistent(page);

  const contributionEditButton = page.getByTestId(
    'workbench-action-contribution-edit-action'
  );
  await expect(contributionEditButton).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await expect(contributionEditButton).toHaveAttribute(
    'data-state-point-id',
    middleState.statePointId
  );
  await contributionEditButton.click();
  await expectRuntimeFocusInEditor(page);

  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '114',
    msValue: '1900',
    originStatePointId: middleState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
    returnButtonTestId: 'workbench-action-contribution-return-result',
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0002');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-index')
  ).toHaveText('2/3');

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps result review entrances interchangeable before edit return @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  await createThreeActionRuntime(page);

  const firstActionResultRow = page.locator(
    '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
  );
  await firstActionResultRow.click();
  const resultListState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(resultListState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '3',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(resultListState, resultListState.statePointId);
  await expectCurveAndLogSelection(page, resultListState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'analysis-action-result');
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0001');
  await expect(
    page.getByTestId('workbench-action-contribution-nav-index')
  ).toHaveText('1/3');

  await page.getByTestId('workbench-action-contribution-nav-next').click();
  const contributionNavState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(contributionNavState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    contributionNavState,
    contributionNavState.statePointId
  );
  await expectCurveAndLogSelection(page, contributionNavState.statePointId);
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0002');
  await selectHpContributionAndExpectResultFocus(page, contributionNavState);

  await page
    .getByTestId('workbench-runtime-resource-chart-selection-next')
    .click();
  const curveState = await waitForRuntimeAction(page, 'action-0003');
  expectRuntimeReviewState(curveState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  expectRuntimeStatePointSynced(curveState, curveState.statePointId);
  await expectCurveAndLogSelection(page, curveState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'resource-runtime-curve');
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0003');

  await page
    .getByTestId('workbench-runtime-selected-detail-navigation-prev')
    .click();
  const detailState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(detailState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(detailState, detailState.statePointId);
  await expectCurveAndLogSelection(page, detailState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'runtime-detail-navigation');
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0002');
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', detailState.statePointId);
  await expectRuntimeOutputConsistent(page);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '108',
    msValue: '1800',
    originStatePointId: detailState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.getByTestId('workbench-action-contribution-panel')
  ).toHaveAttribute('data-action-id', 'action-0002');
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps timeline state curve marker selection tied to edit return', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { insertedState } = await createThreeActionRuntime(page);

  await page
    .locator(
      '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="all"]'
    )
    .click();

  const timelineStateMarker = page
    .locator(
      `[data-testid="workbench-timeline-state-curve-marker"][data-state-point-id="${insertedState.statePointId}"]`
    )
    .first();
  await expect(timelineStateMarker).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await timelineStateMarker.click();

  const timelineMarkerState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(timelineMarkerState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    timelineMarkerState,
    insertedState.statePointId
  );
  await expectCurveAndLogSelection(page, insertedState.statePointId);
  await expect(timelineStateMarker).toHaveClass(/selected/);
  await expect(timelineStateMarker).toHaveAttribute(
    'data-runtime-focus-source',
    'state-curve-point'
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'state-curve-point');

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '150',
    msValue: '2500',
    originStatePointId: insertedState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps analysis state curve point selection tied to edit return', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { insertedState } = await createThreeActionRuntime(page);

  await page.getByTestId('workbench-state-curve-focus-all').click();

  const analysisStatePoint = page
    .locator(
      `[data-testid="workbench-state-curve-point"][data-state-point-id="${insertedState.statePointId}"]`
    )
    .first();
  await expect(analysisStatePoint).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await analysisStatePoint.click();

  const analysisPointState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(analysisPointState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(analysisPointState, insertedState.statePointId);
  await expectCurveAndLogSelection(page, insertedState.statePointId);
  await expect(analysisStatePoint).toHaveClass(/selected/);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'analysis-state-curve');

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '156',
    msValue: '2600',
    originStatePointId: insertedState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps analysis state curve navigation tied to edit return', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { insertedState, copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });

  await page.getByTestId('workbench-state-curve-focus-all').click();
  await expect(
    page.getByTestId('workbench-state-curve-nav-position')
  ).toHaveText('3/3');

  const previousAnalysisPoint = page.getByTestId(
    'workbench-state-curve-nav-prev'
  );
  await expect(previousAnalysisPoint).not.toBeDisabled();
  await previousAnalysisPoint.click();

  const navigatedState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(navigatedState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(navigatedState, insertedState.statePointId);
  await expectCurveAndLogSelection(page, insertedState.statePointId);
  await expect(
    page.getByTestId('workbench-state-curve-nav-position')
  ).toHaveText('2/3');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'analysis-state-curve-nav');

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '162',
    msValue: '2700',
    originStatePointId: insertedState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps analysis state curve frame group tied to timeline candidate values', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );

  await page.getByTestId('workbench-state-curve-focus-all').click();
  const candidateHpPoint = page
    .locator(
      '[data-testid="workbench-state-curve-point"][data-layer-key="candidate"][data-track-key="enemyHpDamage"]'
    )
    .first();
  await expect(candidateHpPoint).toBeVisible();
  const hpStatePointId = await candidateHpPoint.getAttribute(
    'data-state-point-id'
  );
  expect(hpStatePointId).toBeTruthy();
  await candidateHpPoint.click();

  const focusSelectedButton = page.getByTestId(
    'workbench-state-curve-focus-selected'
  );
  await expect(focusSelectedButton).not.toBeDisabled();
  await focusSelectedButton.click();
  await expect(focusSelectedButton).toHaveClass(/active/);
  await expect(
    page.locator(
      `[data-testid="workbench-state-curve-frame-group-option"][data-state-point-id="${hpStatePointId}"]`
    )
  ).toHaveClass(/active/);

  const selectedFrameSummary = page.getByTestId(
    'workbench-candidate-value-frame-summary'
  );
  await expect(selectedFrameSummary).toBeVisible();
  const selectedFrameLabel =
    await selectedFrameSummary.getAttribute('data-frame-label');
  const selectedHitIndex =
    await selectedFrameSummary.getAttribute('data-hit-index');
  expect(selectedFrameLabel).toBeTruthy();
  expect(selectedHitIndex).toBeTruthy();
  await expect(
    page.locator(
      '[data-testid="workbench-candidate-value-scope-option"][data-scope-key="selected-frame"]'
    )
  ).toHaveClass(/active/);
  await expect(
    page.locator(
      '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
    )
  ).toHaveAttribute('data-state-track-key', 'enemyHpDamage');

  const toughnessFrameGroupOption = page
    .locator(
      '[data-testid="workbench-state-curve-frame-group-option"][data-track-key="enemyToughnessDamage"]'
    )
    .first();
  await expect(toughnessFrameGroupOption).toBeVisible();
  const toughnessStatePointId = await toughnessFrameGroupOption.getAttribute(
    'data-state-point-id'
  );
  expect(toughnessStatePointId).toBeTruthy();
  await toughnessFrameGroupOption.click();

  await expect(toughnessFrameGroupOption).toHaveClass(/active/);
  await expect(
    page.locator(
      `[data-testid="workbench-state-curve-point"][data-state-point-id="${toughnessStatePointId}"]`
    )
  ).toHaveClass(/selected/);
  await expect(selectedFrameSummary).toHaveAttribute(
    'data-frame-label',
    selectedFrameLabel
  );
  await expect(selectedFrameSummary).toHaveAttribute(
    'data-hit-index',
    selectedHitIndex
  );
  await expect(
    page.locator(
      '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
    )
  ).toHaveAttribute('data-state-track-key', 'enemyToughnessDamage');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-candidate-value-marker"][data-track-focused="true"]'
    )
  ).toHaveAttribute('data-state-track-key', 'enemyToughnessDamage');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="toughnessDamageCandidate"]'
    )
  ).toHaveAttribute('data-track-focused', 'true');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-candidate-value-curve"][data-series-key="hpDamageFormulaParamCandidate"]'
    )
  ).toHaveAttribute('data-track-focused', 'false');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-candidate-value-frame-hotspot"].selected'
    )
  ).toHaveAttribute('data-frame-label', selectedFrameLabel);

  const hpFrameGroupOption = page
    .locator(
      '[data-testid="workbench-state-curve-frame-group-option"][data-track-key="enemyHpDamage"]'
    )
    .first();
  await hpFrameGroupOption.click();
  await expect(hpFrameGroupOption).toHaveClass(/active/);
  await expect(
    page.locator(
      `[data-testid="workbench-state-curve-point"][data-state-point-id="${hpStatePointId}"]`
    )
  ).toHaveClass(/selected/);
  await expect(
    page.locator(
      '[data-testid="workbench-candidate-value-frame-detail-row"][data-track-focused="true"]'
    )
  ).toHaveAttribute('data-state-track-key', 'enemyHpDamage');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-candidate-value-marker"][data-track-focused="true"]'
    )
  ).toHaveAttribute('data-state-track-key', 'enemyHpDamage');

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps direct, log, and contribution edit returns synced', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  await createThreeActionRuntime(page);

  await page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .click();
  const timelineJumpState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(timelineJumpState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    timelineJumpState,
    timelineJumpState.statePointId
  );

  const timelineEditButton = page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .getByTestId('workbench-timeline-edit-result-action');
  await expect(timelineEditButton).toHaveAttribute(
    'data-state-point-id',
    timelineJumpState.statePointId
  );
  await timelineEditButton.click();
  await expectRuntimeFocusInEditor(page);
  const { returnedState: selectedActionReturnedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0002',
      frameValue: '126',
      msValue: '2100',
      originStatePointId: timelineJumpState.statePointId,
      navigationCount: '3',
      navigationIndex: '1',
      selected: true,
    });

  await page.getByTestId('workbench-runtime-sim-log-action-focus').click();
  await expectRuntimeFocusInEditor(page);
  const { returnedState: logEditedActionState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0002',
      frameValue: '132',
      msValue: '2200',
      originStatePointId: selectedActionReturnedState.statePointId,
      navigationCount: '3',
      navigationIndex: '1',
      selected: true,
    });

  await selectHpContributionAndExpectResultFocus(page, logEditedActionState);

  const contributionEditButton = page.getByTestId(
    'workbench-action-contribution-edit-action'
  );
  await expect(contributionEditButton).toHaveAttribute(
    'data-state-point-id',
    logEditedActionState.statePointId
  );
  await contributionEditButton.click();
  await expectRuntimeFocusInEditor(page);
  await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '138',
    msValue: '2300',
    originStatePointId: logEditedActionState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
    returnButtonTestId: 'workbench-action-contribution-return-result',
  });

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps action list, timeline nudge, frame step, and result return in one loop @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  await createThreeActionRuntime(page);

  const actionListItem = page.locator(
    '.action-item[data-action-id="action-0002"]'
  );
  await actionListItem.click();
  const actionListState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(actionListState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(actionListState, actionListState.statePointId);

  const timelineEditButton = page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .getByTestId('workbench-timeline-edit-result-action');
  await expect(timelineEditButton).toHaveAttribute(
    'data-state-point-id',
    actionListState.statePointId
  );
  await timelineEditButton.click();
  await expectRuntimeFocusInEditor(page);

  await nudgeTimelineAction(page, 'action-0002');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  const timelineNudgeEditState = await readEditState(
    page,
    'workbench-flow-return-edit-result'
  );
  expect(timelineNudgeEditState).toMatchObject({
    actionId: 'action-0002',
    phase: 'edit-result-ready',
    feedbackOriginStatePointId: actionListState.statePointId,
    resultFocused: 'false',
    returnButtonText: '查看刷新结果',
  });
  expect(Number(timelineNudgeEditState.startFrameValue)).toBeGreaterThan(60);
  expect(timelineNudgeEditState.feedbackStatePointId).toContain('action-0002');

  await page
    .locator(
      '[data-testid="workbench-start-frame-step"][data-step-direction="decrease"]'
    )
    .click();
  const steppedEditState = await readEditState(
    page,
    'workbench-flow-return-edit-result'
  );
  expect(steppedEditState).toMatchObject({
    actionId: 'action-0002',
    phase: 'edit-result-ready',
    feedbackOriginStatePointId: actionListState.statePointId,
    resultFocused: 'false',
    returnButtonText: '查看刷新结果',
  });
  expect(Number(steppedEditState.startFrameValue)).toBe(
    Number(timelineNudgeEditState.startFrameValue) - 1
  );
  expect(steppedEditState.feedbackStatePointId).toContain('action-0002');
  expect(steppedEditState.feedbackStatePointId).not.toBe(
    actionListState.statePointId
  );

  await page.getByTestId('workbench-flow-return-edit-result').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-review'
  );
  const returnedState = await readWorkbenchState(page);
  expectRuntimeReviewState(returnedState, {
    phase: 'edit-result-review',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    returnedState,
    steppedEditState.feedbackStatePointId
  );
  await expectCurveAndLogSelection(page, steppedEditState.feedbackStatePointId);
  await expectRuntimeOutputConsistent(page);
  expect(returnedState.selectedActionListId).toBe('action-0002');
  expect(returnedState.selectedTimelineActionId).toBe('action-0002');
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    steppedEditState.feedbackStatePointId
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps inserted action result usable in the runtime edit loop @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });

  await page.getByTestId('workbench-add-action').click();
  const insertedState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(insertedState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  expect(insertedState.statePointId).toContain('action-0002');
  expect(insertedState.statePointId).not.toBe(openedState.statePointId);
  expectRuntimeStatePointSynced(insertedState, insertedState.statePointId);
  await expectCurveAndLogSelection(page, insertedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', insertedState.statePointId);
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '84',
    msValue: '1400',
    originStatePointId: insertedState.statePointId,
    navigationCount: '2',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('inserts a follow-up action from the visible main flow bar @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });

  const insertButton = page.getByTestId('workbench-flow-insert-next-action');
  await expect(insertButton).toHaveText('插入后续动作');
  await expect(insertButton).toHaveAttribute('data-action-id', 'action-0001');
  await insertButton.click();

  const insertedState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(insertedState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  expect(insertedState.statePointId).toContain('action-0002');
  expect(insertedState.statePointId).not.toBe(openedState.statePointId);
  expectRuntimeStatePointSynced(insertedState, insertedState.statePointId);
  await expectCurveAndLogSelection(page, insertedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(insertButton).toHaveAttribute('data-action-id', 'action-0002');
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', insertedState.statePointId);
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '90',
    msValue: '1500',
    originStatePointId: insertedState.statePointId,
    navigationCount: '2',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('exports and imports a Workbench JSON project @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await openSelectedActionInspector(page);

  const secondaryTeamSlotSelect = page.getByTestId(
    'workbench-secondary-character-select'
  );
  const replacementSecondaryCharacterId = await secondaryTeamSlotSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  expect(replacementSecondaryCharacterId).toBeTruthy();
  await secondaryTeamSlotSelect.selectOption(replacementSecondaryCharacterId);
  await expect(
    page.locator(
      `[data-testid="workbench-actor-loadout"][data-team-slot-id="team-slot-2"][data-character-id="${replacementSecondaryCharacterId}"]`
    )
  ).toHaveCount(1);

  const enemySelect = page.getByTestId('workbench-enemy-select');
  const importedEnemyId = await enemySelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  expect(importedEnemyId).toBeTruthy();
  await enemySelect.selectOption(importedEnemyId);
  await page.getByTestId('workbench-enemy-level-input').fill('91');
  await page.getByTestId('workbench-enemy-hp-multiplier-input').fill('2.5');
  await page
    .getByTestId('workbench-enemy-toughness-multiplier-input')
    .fill('2');
  await page.getByTestId('workbench-enemy-initial-toughness-input').fill('50');
  await page
    .getByTestId('workbench-enemy-element-defense-input-FIRE_DEFENSE')
    .fill('25');
  await expect(
    page.getByTestId('workbench-enemy-element-defense-FIRE_DEFENSE')
  ).toHaveAttribute('data-source-status', 'user-override');
  await expect(
    page.getByTestId('workbench-enemy-toughness-stat')
  ).toContainText('10,000 / 20,000');
  await expect(
    page.getByTestId('workbench-runtime-enemy-toughness-state')
  ).toHaveText('剩余 10,000 / 20,000');
  const kiboSelect = page
    .locator(
      '[data-testid="workbench-actor-kibo-select"][data-character-id="109001"]'
    )
    .first();
  const weaponSelect = page
    .locator(
      '[data-testid="workbench-actor-equipment-select"][data-character-id="109001"][data-loadout-key="weapon"]'
    )
    .first();
  const soulessenceSelect = page
    .locator(
      '[data-testid="workbench-actor-soulessence-select"][data-character-id="109001"]'
    )
    .first();
  const kiboId = await kiboSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  const weaponId = await weaponSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  const soulessenceId = await soulessenceSelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  expect(kiboId).toBeTruthy();
  expect(weaponId).toBeTruthy();
  expect(soulessenceId).toBeTruthy();
  await kiboSelect.selectOption(kiboId);
  await weaponSelect.selectOption(weaponId);
  await soulessenceSelect.selectOption(soulessenceId);
  const initialSpInput = page
    .locator(
      '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
    )
    .first();
  await initialSpInput.fill('0.5');

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  await page.getByTestId('workbench-flow-insert-next-action').click();
  const insertedState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(insertedState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/promilia-workbench-.*\.json$/);
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const exportedProject = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(exportedProject).toMatchObject({
    schemaVersion: 16,
    game: 'azur-promilia',
    type: 'workbench-project',
    selectedActionId: 'action-0002',
    teamSlots: [
      { slotId: 'team-slot-1', position: 0, characterId: 109001 },
      {
        slotId: 'team-slot-2',
        position: 1,
        characterId: Number(replacementSecondaryCharacterId),
      },
      { slotId: 'team-slot-3', position: 2, characterId: 101003 },
    ],
    enemyConfig: {
      level: 91,
      hpMultiplier: 2.5,
      toughnessMultiplier: 2,
      initialToughnessRatio: 0.5,
      elementDefenseOverrides: {
        FIRE_DEFENSE: 0.25,
      },
    },
    actorConfigs: [
      {
        characterId: 109001,
        initialSp: 0.5,
        loadout: {
          kiboId: Number(kiboId),
          equipment: {
            weapon: Number(weaponId),
          },
          soulessenceId: Number(soulessenceId),
        },
      },
      {
        characterId: Number(replacementSecondaryCharacterId),
      },
      {
        characterId: 101003,
      },
    ],
  });
  expect(exportedProject.actionDrafts).toHaveLength(2);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导出项目'
  );

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await openSelectedActionInspector(page);
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '1 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '80'
  );
  await expect(
    page.getByTestId('workbench-enemy-toughness-multiplier-input')
  ).toHaveValue('1');
  await expect(
    page.getByTestId('workbench-enemy-initial-toughness-input')
  ).toHaveValue('100');
  await expect(secondaryTeamSlotSelect).toHaveValue('101003');
  await expect(
    page.getByTestId('workbench-enemy-element-defense-input-FIRE_DEFENSE')
  ).toHaveValue('');
  await expect(kiboSelect).toHaveValue('');
  await expect(weaponSelect).toHaveValue('');
  await expect(soulessenceSelect).toHaveValue('');
  await expect(initialSpInput).toHaveValue('');

  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);

  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  await expect(enemySelect).toHaveValue(importedEnemyId);
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '91'
  );
  await expect(
    page.getByTestId('workbench-enemy-hp-multiplier-input')
  ).toHaveValue('2.5');
  await expect(
    page.getByTestId('workbench-enemy-toughness-multiplier-input')
  ).toHaveValue('2');
  await expect(
    page.getByTestId('workbench-enemy-initial-toughness-input')
  ).toHaveValue('50');
  await expect(
    page.getByTestId('workbench-enemy-element-defense-input-FIRE_DEFENSE')
  ).toHaveValue('25');
  await expect(
    page.getByTestId('workbench-enemy-element-defense-FIRE_DEFENSE')
  ).toHaveAttribute('data-source-status', 'user-override');
  await expect(secondaryTeamSlotSelect).toHaveValue(
    replacementSecondaryCharacterId
  );
  await expect(
    page.getByTestId('workbench-runtime-enemy-toughness-state')
  ).toHaveText('剩余 10,000 / 20,000');
  await expect(kiboSelect).toHaveValue(kiboId);
  await expect(weaponSelect).toHaveValue(weaponId);
  await expect(soulessenceSelect).toHaveValue(soulessenceId);
  await expect(initialSpInput).toHaveValue('0.5');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  const importedState = await readWorkbenchState(page);
  expect(importedState).toMatchObject({
    phase: 'action-edit',
    actionId: 'action-0002',
    selectedActionListId: 'action-0002',
    selectedTimelineActionId: 'action-0002',
  });

  await page.getByTestId('workbench-flow-open-runtime').click();
  const importedRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(importedRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  await expectCurveAndLogSelection(page, importedRuntimeState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('saves, finds, copies, and reloads a Workbench preset @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/preset');
  await expect(page).toHaveURL(/#\/workbench\?presets=1$/);
  await expect(page.getByTestId('workbench-preset-library')).toBeVisible();
  await page.getByTestId('workbench-preset-close').click();

  await openSelectedActionInspector(page);
  await page.getByTestId('workbench-level-input').fill('2');
  await page.getByTestId('workbench-level-input').press('Tab');
  await expect(page.getByTestId('workbench-level-input')).toHaveValue('2');

  await clickProjectMenuCommand(page, 'workbench-open-presets');
  await page
    .getByTestId('workbench-preset-name-input')
    .fill('末音循环可回载预设');
  await page.getByTestId('workbench-preset-tags-input').fill('末音, 训练');
  await page
    .getByTestId('workbench-preset-description-input')
    .fill('保存当前动作与角色配置');
  await page.getByTestId('workbench-preset-save').click();

  await expect(page.getByTestId('workbench-preset-count')).toHaveText('1 / 1');
  await expect(page.getByTestId('workbench-preset-row')).toContainText(
    '末音循环可回载预设'
  );
  await page.getByTestId('workbench-preset-search-input').fill('训练');
  await page.getByTestId('workbench-preset-tag-filter').selectOption('末音');
  await expect(page.getByTestId('workbench-preset-count')).toHaveText('1 / 1');

  await page.getByTestId('workbench-preset-duplicate').click();
  await expect(page.getByTestId('workbench-preset-count')).toHaveText('2 / 2');
  await expect(page.getByTestId('workbench-preset-library')).toContainText(
    '末音循环可回载预设 副本'
  );
  await page.getByTestId('workbench-preset-close').click();

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await openSelectedActionInspector(page);
  await expect(page.getByTestId('workbench-level-input')).toHaveValue('1');

  await clickProjectMenuCommand(page, 'workbench-open-presets');
  const originalPresetRow = page.getByTestId('workbench-preset-row').filter({
    has: page.locator('strong').filter({
      hasText: /^末音循环可回载预设$/,
    }),
  });
  await originalPresetRow.getByTestId('workbench-preset-load').click();

  await expect(page.getByTestId('workbench-preset-library')).toBeHidden();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已加载预设：末音循环可回载预设'
  );
  await expect(page.getByTestId('workbench-level-input')).toHaveValue('2');
  await expectRuntimeOutputConsistent(page);

  await clickProjectMenuCommand(page, 'workbench-open-presets');
  await page.getByTestId('workbench-preset-search-input').fill('副本');
  await page.getByTestId('workbench-preset-delete').click();
  await expect(page.getByTestId('workbench-preset-empty')).toContainText(
    '没有匹配的预设'
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('imports a runtime capture and preserves its applied curve through project JSON @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const capture = createRecoverSpRuntimeSampleFixture({
    captureSessionId: 'e2e-recover-sp-capture-1',
    actionId: 'captured-action-77',
    actorId: 'captured-actor-77',
  });
  const captureFile = [
    JSON.stringify({
      recordType: 'capture-session',
      captureSessionId: capture.captureSessionId,
      clientRegion: 'TW',
      clientBuild: 'e2e-controlled-build',
      source: capture.source,
    }),
    ...capture.events.map(event =>
      JSON.stringify({ recordType: 'event', ...event })
    ),
  ].join('\n');

  await page.goto('/#/workbench');
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: 'azpr-runtime-capture.jsonl',
    mimeType: 'application/x-ndjson',
    buffer: Buffer.from(captureFile),
  });

  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入实测 1 组'
  );
  await expect(
    page.getByTestId('workbench-three-value-runtime-projection-summary')
  ).toContainText('能量 0.3375 · 日志 2');
  await expect(
    page.getByTestId('workbench-runtime-energy-actor-row').first()
  ).toContainText('SP +0.3375');
  await expect(page.getByTestId('workbench-runtime-sim-log-count')).toHaveText(
    '2 日志'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(
    page.getByTestId('workbench-runtime-sim-log-row').filter({
      hasText: 'SP +0.3375',
    })
  ).toHaveCount(1);

  await page.getByTestId('workbench-undo-edit').click();
  await expect(
    page.getByTestId('workbench-three-value-runtime-projection-summary')
  ).toContainText('能量 0 · 日志 1');
  await page.getByTestId('workbench-redo-edit').click();
  await expect(
    page.getByTestId('workbench-three-value-runtime-projection-summary')
  ).toContainText('能量 0.3375 · 日志 2');

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const exportedProject = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(exportedProject).toMatchObject({
    schemaVersion: 16,
    runtimeSampleCaptures: [
      {
        captureSessionId: 'e2e-recover-sp-capture-1',
        actionId: 'action-0001',
        workbenchBinding: {
          status: 'bound-to-workbench-project',
          actionId: 'action-0001',
          actorId: 'actor-109001',
          targetId: 'enemy-300032',
          sourceActionIds: ['captured-action-77'],
          sourceSkillIds: [10900101],
        },
      },
    ],
  });

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await expect(
    page.getByTestId('workbench-three-value-runtime-projection-summary')
  ).toContainText('能量 0 · 日志 1');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  await expect(
    page.getByTestId('workbench-three-value-runtime-projection-summary')
  ).toContainText('能量 0.3375 · 日志 2');
  await expect(
    page.getByTestId('workbench-runtime-energy-actor-row').first()
  ).toContainText('SP +0.3375');

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('exports a visible PNG project and restores it from embedded metadata @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await page.getByTestId('workbench-enemy-level-input').fill('93');
  const initialSpInput = page
    .locator(
      '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
    )
    .first();
  await initialSpInput.fill('0.75');

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project-png');
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /promilia-workbench-.*-2actions\.png$/
  );
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const pngBytes = await readFile(downloadPath);
  expect([...pngBytes.subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(pngBytes.readUInt32BE(16)).toBeGreaterThanOrEqual(1200);
  expect(pngBytes.readUInt32BE(20)).toBeGreaterThanOrEqual(600);
  expect(pngBytes.includes(Buffer.from('PromiliaAxisToolData'))).toBe(true);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导出 PNG 项目'
  );

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await openSelectedActionInspector(page);
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '1 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '80'
  );
  await expect(initialSpInput).toHaveValue('');

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
  await expect(initialSpInput).toHaveValue('0.75');
  const importedState = await readWorkbenchState(page);
  expect(importedState).toMatchObject({
    phase: 'action-edit',
    actionId: 'action-0002',
    selectedActionListId: 'action-0002',
    selectedTimelineActionId: 'action-0002',
  });

  await page.getByTestId('workbench-flow-open-runtime').click();
  const runtimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(runtimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  await expectCurveAndLogSelection(page, runtimeState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('drags JSON and PNG projects into a recoverable Workbench @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-project-drop-host')).toHaveCount(1);
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('94');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  const jsonDownloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).toBeTruthy();
  const jsonBuffer = await readFile(jsonPath);

  const pngDownloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project-png');
  const pngDownload = await pngDownloadPromise;
  const pngPath = await pngDownload.path();
  expect(pngPath).toBeTruthy();
  const pngBuffer = await readFile(pngPath);

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await dragWorkbenchFile(page, {
    name: 'dragged-axis.promilia-workbench.json',
    mimeType: 'application/json',
    buffer: jsonBuffer,
  });
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已从拖放恢复 JSON 项目'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '94'
  );

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await dragWorkbenchFile(page, {
    name: 'dragged-axis.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
  });
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已从拖放恢复 PNG 项目'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '94'
  );

  await dragWorkbenchFile(page, {
    name: 'not-a-project.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not a Workbench project'),
  });
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '仅支持 JSON 分析/项目文件或 PNG 项目'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '94'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  await waitForRuntimeAction(page, 'action-0002');
  await expectRuntimeOutputConsistent(page);
  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('shares and imports a Workbench project URL @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await openSelectedActionInspector(page);

  const enemySelect = page.getByTestId('workbench-enemy-select');
  const sharedEnemyId = await enemySelect
    .locator('option')
    .nth(1)
    .getAttribute('value');
  expect(sharedEnemyId).toBeTruthy();
  await enemySelect.selectOption(sharedEnemyId);
  await page.getByTestId('workbench-enemy-level-input').fill('92');
  await page.getByTestId('workbench-enemy-hp-multiplier-input').fill('2.75');

  await page.getByTestId('workbench-flow-open-runtime').click();
  await waitForRuntimeAction(page, 'action-0001');
  await page.getByTestId('workbench-flow-insert-next-action').click();
  await waitForRuntimeAction(page, 'action-0002');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  const shareButton = page.getByTestId('workbench-share-project');
  await clickProjectMenuCommand(page, 'workbench-share-project');
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已生成分享链接'
  );
  const shareUrl = await shareButton.getAttribute('data-share-url');
  expect(shareUrl).toContain('/#/workbench?workbenchProject=');

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '1 action'
  );

  await page.goto(shareUrl);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入分享项目'
  );
  await expect(enemySelect).toHaveValue(sharedEnemyId);
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '92'
  );
  await expect(
    page.getByTestId('workbench-enemy-hp-multiplier-input')
  ).toHaveValue('2.75');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );

  const sharedState = await readWorkbenchState(page);
  expect(sharedState).toMatchObject({
    phase: 'action-edit',
    actionId: 'action-0002',
    selectedActionListId: 'action-0002',
    selectedTimelineActionId: 'action-0002',
  });

  await page.getByTestId('workbench-flow-open-runtime').click();
  const sharedRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(sharedRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  await expectCurveAndLogSelection(page, sharedRuntimeState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('configures, reviews, and shares a tracking-only effect @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await openSelectedActionInspector(page);
  await page.getByTestId('workbench-effect-add').click();
  await expect(page.getByTestId('workbench-effect-command-row')).toHaveCount(1);

  const effectIdInput = page.getByTestId('workbench-effect-id-input');
  const effectNameInput = page.getByTestId('workbench-effect-name-input');
  await effectIdInput.fill('demo-effect');
  await effectIdInput.press('Tab');
  await effectNameInput.fill('演示增益');
  await effectNameInput.press('Tab');
  await page
    .getByTestId('workbench-effect-stack-mode-select')
    .selectOption('stack');
  await page.getByTestId('workbench-effect-max-stacks-input').fill('3');
  await page.getByTestId('workbench-effect-max-stacks-input').press('Tab');
  await page.getByTestId('workbench-effect-duration-frame-input').fill('120');
  await page.getByTestId('workbench-effect-duration-frame-input').press('Tab');

  await page.getByTestId('workbench-flow-open-runtime').click();
  await waitForRuntimeAction(page, 'action-0001');
  const effectPanel = page.getByTestId('workbench-effect-timeline-panel');
  const workbench = page.locator('main.workbench');
  await expect(effectPanel).toHaveAttribute('data-effect-event-count', '2');
  await expect(page.getByTestId('workbench-effect-event-row')).toHaveCount(2);
  await expect(
    page.getByTestId('workbench-effect-event-row').first()
  ).toContainText('演示增益');

  const timelineEffectInterval = page.getByTestId(
    'workbench-timeline-effect-interval'
  );
  await expect(timelineEffectInterval).toHaveCount(1);
  await expect(timelineEffectInterval).toHaveAttribute(
    'data-target-kind',
    'actor'
  );
  await expect(timelineEffectInterval).toHaveAttribute(
    'data-lifecycle-event-count',
    '2'
  );
  expect(
    Number(await timelineEffectInterval.getAttribute('data-end-ms'))
  ).toBeCloseTo(2000, 4);
  await timelineEffectInterval.click();
  await expect(workbench).not.toHaveAttribute(
    'data-selected-effect-interval-id',
    ''
  );
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('演示增益');
  await expect(
    page.getByTestId('workbench-effect-interval-lifecycle-event')
  ).toHaveCount(2);
  await page
    .getByTestId('workbench-effect-interval-lifecycle-event')
    .first()
    .click();
  await expect(effectPanel).toHaveAttribute('data-active-effect-count', '1');
  await expect(page.getByTestId('workbench-effect-active-row')).toContainText(
    '演示增益'
  );
  await expect(page.getByTestId('workbench-effect-active-row')).toContainText(
    '1/3 层'
  );
  await page.getByTestId('workbench-effect-edit-source-action').click();
  await expect(workbench).toHaveAttribute(
    'data-selected-effect-interval-id',
    ''
  );
  await page.getByTestId('workbench-effect-duration-frame-input').fill('180');
  await page.getByTestId('workbench-effect-duration-frame-input').press('Tab');
  expect(
    Number(await timelineEffectInterval.getAttribute('data-end-ms'))
  ).toBeCloseTo(3000, 4);
  await timelineEffectInterval.click();
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('0F-180F');

  const shareButton = page.getByTestId('workbench-share-project');
  await clickProjectMenuCommand(page, 'workbench-share-project');
  const shareUrl = await shareButton.getAttribute('data-share-url');
  expect(shareUrl).toContain('/#/workbench?workbenchProject=');

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await expect(page.getByTestId('workbench-effect-command-row')).toHaveCount(0);
  await page.goto(shareUrl);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入分享项目'
  );
  await expect(page.getByTestId('workbench-effect-command-row')).toHaveCount(1);
  await expect(effectIdInput).toHaveValue('demo-effect');
  await expect(effectNameInput).toHaveValue('演示增益');
  await expect(
    page.getByTestId('workbench-effect-max-stacks-input')
  ).toHaveValue('3');
  await expect(
    page.getByTestId('workbench-effect-duration-frame-input')
  ).toHaveValue('180');
  await expect(effectPanel).toHaveAttribute('data-effect-event-count', '2');
  await expect(timelineEffectInterval).toHaveCount(1);
  expect(
    Number(await timelineEffectInterval.getAttribute('data-end-ms'))
  ).toBeCloseTo(3000, 4);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('locates and fixes a confirmed cooldown rule before runtime review @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  const rulePanel = page.getByTestId('workbench-action-rule-panel');
  await expect(rulePanel).toHaveAttribute('data-violation-count', '0');

  const addCooldownSkill = async () => {
    await page
      .locator(
        '[data-testid="workbench-skill-entry"][data-skill-id="10900112"]'
      )
      .first()
      .click();
  };
  await addCooldownSkill();
  await addCooldownSkill();
  await addCooldownSkill();

  const cooldownRule = page.locator(
    '[data-testid="workbench-action-rule-row"][data-rule-code="skill-cooldown-active"]'
  );
  await expect(rulePanel).toHaveAttribute('data-executable', 'false');
  await expect(rulePanel).toHaveAttribute('data-violation-count', '1');
  await expect(cooldownRule).toHaveAttribute('data-action-id', 'action-0004');
  await expect(cooldownRule).toContainText('技能冷却');
  const blockedAction = page.locator(
    '.action-item[data-action-id="action-0004"]'
  );
  const blockedTimelineAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
  );
  await expect(blockedAction).toHaveAttribute(
    'data-readiness-status',
    'blocked'
  );
  await expect(blockedAction).toHaveAttribute(
    'data-readiness-executable',
    'false'
  );
  await expect(blockedTimelineAction).toHaveAttribute(
    'data-readiness-status',
    'blocked'
  );
  await expect(
    page.getByTestId('workbench-timeline-cooldown-window')
  ).toHaveCount(2);
  await expect(page.getByTestId('scenario-action-count')).toHaveAttribute(
    'data-executed-action-count',
    '3'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveAttribute(
    'data-skipped-action-count',
    '1'
  );
  await expect(page.getByTestId('scenario-action-count')).toContainText(
    '3/4 action'
  );
  await expect(
    page.getByTestId('workbench-action-result-source-row')
  ).toHaveCount(3);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0004"]'
    )
  ).toHaveCount(0);

  await page.locator('.action-item[data-action-id="action-0001"]').click();
  await cooldownRule.getByTestId('workbench-action-rule-locate').click();
  await expect(
    page.locator('.action-item[data-action-id="action-0004"]')
  ).toHaveClass(/selected/);

  const applySuggestedStart = cooldownRule.getByTestId(
    'workbench-action-rule-apply-start'
  );
  const suggestedStartMs = await applySuggestedStart.getAttribute(
    'data-suggested-start-ms'
  );
  expect(suggestedStartMs).toBeTruthy();
  await applySuggestedStart.click();

  await expect(rulePanel).toHaveAttribute('data-executable', 'true');
  await expect(rulePanel).toHaveAttribute('data-violation-count', '0');
  await expect(page.getByTestId('workbench-start-input')).toHaveValue(
    suggestedStartMs
  );
  await expect(blockedAction).toHaveAttribute('data-readiness-status', 'ready');
  await expect(blockedAction).toHaveAttribute(
    'data-readiness-executable',
    'true'
  );
  await expect(blockedTimelineAction).toHaveAttribute(
    'data-readiness-status',
    'ready'
  );
  await expect(
    page.getByTestId('workbench-timeline-cooldown-window')
  ).toHaveCount(3);
  await expect(page.getByTestId('scenario-action-count')).toHaveAttribute(
    'data-executed-action-count',
    '4'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveAttribute(
    'data-skipped-action-count',
    '0'
  );
  await expect(page.getByTestId('scenario-action-count')).toContainText(
    '4 action'
  );
  await expect(
    page.getByTestId('workbench-action-result-source-row')
  ).toHaveCount(4);

  await page.getByTestId('workbench-flow-open-runtime').click();
  const runtimeState = await waitForRuntimeAction(page, 'action-0004');
  expectRuntimeReviewState(runtimeState, {
    phase: 'edit-result-review',
    actionId: 'action-0004',
    navigationCount: '4',
    navigationIndex: '3',
    selected: false,
  });
  await expectCurveAndLogSelection(page, runtimeState.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-readiness')
  ).toHaveAttribute('data-readiness-status', 'ready');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-readiness')
  ).toContainText('1 -> 0 / 2');
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps undo and redo tied to refreshed runtime results @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-undo-edit')).toBeDisabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeDisabled();

  await page.getByTestId('workbench-runtime-review-primary-operation').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });

  await focusRuntimeDetailAction(page);
  await expectRuntimeFocusInEditor(page);
  await page
    .locator(
      '[data-testid="workbench-start-frame-step"][data-step-direction="increase"]'
    )
    .click();

  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  await expect(page.getByTestId('workbench-start-frame-input')).toHaveValue(
    '1'
  );
  await expect(page.getByTestId('workbench-undo-edit')).toBeEnabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeDisabled();
  const editedState = await readEditState(
    page,
    'workbench-flow-return-edit-result'
  );
  expect(editedState.feedbackOriginStatePointId).toBe(openedState.statePointId);
  expect(editedState.feedbackStatePointId).not.toBe(openedState.statePointId);

  await page.getByTestId('workbench-undo-edit').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已撤销编辑'
  );
  await expect(page.getByTestId('workbench-start-frame-input')).toHaveValue(
    '0'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'runtime-result'
  );
  await expect(page.getByTestId('workbench-undo-edit')).toBeDisabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeEnabled();

  await page.getByTestId('workbench-redo-edit').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已重做编辑'
  );
  await expect(page.getByTestId('workbench-start-frame-input')).toHaveValue(
    '1'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  const redoState = await readEditState(
    page,
    'workbench-flow-return-edit-result'
  );
  expect(redoState.feedbackStatePointId).toBe(editedState.feedbackStatePointId);

  await page.getByTestId('workbench-flow-return-edit-result').click();
  const returnedState = await readWorkbenchState(page);
  expectRuntimeReviewState(returnedState, {
    phase: 'edit-result-review',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(returnedState, redoState.feedbackStatePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps keyboard edit shortcuts tied to runtime review flow @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.goto('/#/workbench');
  await expect(page.locator('.action-item')).toHaveCount(1);
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0001'
  );

  await page.keyboard.press('Control+D');
  await expect(page.locator('.action-item')).toHaveCount(2);
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await expect(page.getByTestId('workbench-undo-edit')).toBeEnabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeDisabled();

  await page.keyboard.press('Control+Z');
  await expect(page.locator('.action-item')).toHaveCount(1);
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0001'
  );
  await expect(page.getByTestId('workbench-undo-edit')).toBeDisabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeEnabled();

  await page.keyboard.press('Control+Y');
  await expect(page.locator('.action-item')).toHaveCount(2);
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );

  await page.getByTestId('workbench-level-input').focus();
  await page.keyboard.press('Control+D');
  await expect(page.locator('.action-item')).toHaveCount(2);

  await page.getByTestId('workbench-flow-open-runtime').click();
  const copiedRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(copiedRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    copiedRuntimeState,
    copiedRuntimeState.statePointId
  );

  await page.keyboard.down('Alt');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.up('Alt');
  const previousRuntimeState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(previousRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '2',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    previousRuntimeState,
    previousRuntimeState.statePointId
  );
  await expectCurveAndLogSelection(page, previousRuntimeState.statePointId);

  await page.keyboard.down('Alt');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Alt');
  const nextRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(nextRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    nextRuntimeState,
    nextRuntimeState.statePointId
  );
  await expectCurveAndLogSelection(page, nextRuntimeState.statePointId);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps skill level and action variant edits tied to refreshed results', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  await createThreeActionRuntime(page);

  await page.locator('.action-item[data-action-id="action-0002"]').click();
  const actionListState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(actionListState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });

  await page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .getByTestId('workbench-timeline-edit-result-action')
    .click();
  await expectRuntimeFocusInEditor(page);

  await page.getByTestId('workbench-level-input').fill('2');
  const levelEditState = await ensureActionContentEditResultSynced(page, {
    actionId: 'action-0002',
    fieldKey: 'level',
    originStatePointId: actionListState.statePointId,
  });

  await page.getByTestId('workbench-damage-segment-select').selectOption('1');
  await ensureActionContentEditResultSynced(page, {
    actionId: 'action-0002',
    fieldKey: 'actionVariantIndex',
    originStatePointId: levelEditState.feedbackStatePointId,
  });

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps saved draft restore tied to runtime edit return @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  await createThreeActionRuntime(page);

  await page.locator('.action-item[data-action-id="action-0002"]').click();
  const actionListState = await waitForRuntimeAction(page, 'action-0002');
  await page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .getByTestId('workbench-timeline-edit-result-action')
    .click();
  await expectRuntimeFocusInEditor(page);

  await page.getByTestId('workbench-level-input').fill('2');
  const levelEditState = await ensureActionContentEditResultSynced(page, {
    actionId: 'action-0002',
    fieldKey: 'level',
    originStatePointId: actionListState.statePointId,
  });
  await page.getByTestId('workbench-damage-segment-select').selectOption('1');
  await ensureActionContentEditResultSynced(page, {
    actionId: 'action-0002',
    fieldKey: 'actionVariantIndex',
    originStatePointId: levelEditState.feedbackStatePointId,
  });

  await page.getByTestId('workbench-save-draft').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已保存草稿'
  );
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-draft-status', 'saved');

  const savedDraft = await readStoredWorkbenchDraft(page);
  expect(savedDraft).toMatchObject({
    selectedActionId: 'action-0002',
    enemyConfig: {
      level: 80,
    },
  });
  expect(savedDraft.actionDrafts).toHaveLength(3);
  expect(
    savedDraft.actionDrafts.find(action => action.id === 'action-0002')
  ).toMatchObject({
    level: 2,
    actionVariantIndex: 1,
    damageSegmentIndex: 1,
  });

  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '3 action'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await expect(page.getByTestId('workbench-level-input')).toHaveValue('2');
  await expect(page.getByTestId('workbench-damage-segment-select')).toHaveValue(
    '1'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  const restoredRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(restoredRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    restoredRuntimeState,
    restoredRuntimeState.statePointId
  );
  await expectRuntimeOutputConsistent(page);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '72',
    msValue: '1200',
    originStatePointId: restoredRuntimeState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(returnedState, returnedState.statePointId);
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '有未保存改动'
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps reset draft usable for a fresh runtime edit loop @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  await createThreeActionRuntime(page);

  await page.locator('.action-item[data-action-id="action-0002"]').click();
  await page.getByTestId('workbench-save-draft').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已保存草稿'
  );

  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '3 action'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await openSelectedActionInspector(page);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已重置草稿'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '1 action'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-action-id',
    'action-0001'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await expect(page.getByTestId('workbench-level-input')).toHaveValue('1');
  await expect(page.getByTestId('workbench-damage-segment-select')).toHaveValue(
    '0'
  );
  expect(await readStoredWorkbenchDraft(page)).toBeNull();

  await page.getByTestId('workbench-flow-open-runtime').click();
  const resetRuntimeState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(resetRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: false,
  });
  expectRuntimeStatePointSynced(
    resetRuntimeState,
    resetRuntimeState.statePointId
  );

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '12',
    msValue: '200',
    originStatePointId: resetRuntimeState.statePointId,
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(returnedState, returnedState.statePointId);
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '有未保存改动'
  );
  expect(await readStoredWorkbenchDraft(page)).toBeNull();

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps result rows stable across multi-action edits', async ({ page }) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);

  await focusRuntimeDetailAction(page);
  const { returnedState: actionThreeFirstReturnedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0003',
      frameValue: '186',
      msValue: '3100',
      originStatePointId: copiedState.statePointId,
      navigationCount: '3',
      navigationIndex: '2',
      selected: false,
    });

  await page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
    .click();
  const actionTwoRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  const { returnedState: actionTwoReturnedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0002',
      frameValue: '138',
      msValue: '2300',
      originStatePointId: actionTwoRuntimeState.statePointId,
      navigationCount: '3',
      navigationIndex: '1',
      selected: true,
    });

  const actionThreeResultRow = page.locator(
    '[data-testid="workbench-action-result-source-row"][data-action-id="action-0003"]'
  );
  await expect(actionThreeResultRow).toHaveAttribute(
    'data-runtime-state-point-id',
    actionThreeFirstReturnedState.statePointId
  );
  await actionThreeResultRow.click();
  const actionThreeReturnState = await waitForRuntimeAction(
    page,
    'action-0003'
  );
  expectRuntimeReviewState(actionThreeReturnState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    actionThreeReturnState,
    actionThreeFirstReturnedState.statePointId
  );

  await focusRuntimeDetailAction(page);
  await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0003',
    frameValue: '204',
    msValue: '3400',
    originStatePointId: actionThreeReturnState.statePointId,
    navigationCount: '3',
    navigationIndex: '2',
    selected: true,
  });
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute(
    'data-runtime-state-point-id',
    actionTwoReturnedState.statePointId
  );

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps runtime result flow usable after deleting the focused action @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);
  const { copiedState } = await createThreeActionRuntime(page);
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });

  await page
    .locator('.action-item[data-action-id="action-0003"]')
    .getByTestId('workbench-delete-action')
    .click();

  const fallbackState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(fallbackState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: true,
  });
  expect(fallbackState.statePointId).toContain('action-0002');
  expect(fallbackState.statePointId).not.toBe(copiedState.statePointId);
  expectRuntimeStatePointSynced(fallbackState, fallbackState.statePointId);
  await expectCurveAndLogSelection(page, fallbackState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator('.action-item[data-action-id="action-0003"]')
  ).toHaveCount(0);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '144',
    msValue: '2400',
    originStatePointId: fallbackState.statePointId,
    navigationCount: '2',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps runtime result flow usable after copying a generated action batch @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await seedGeneratedActionBatchDraft(page);
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('1');

  const batchResultButton = page.getByTestId(
    'workbench-summary-view-action-batch-result'
  );
  await expect(batchResultButton).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await expect(batchResultButton).toHaveAttribute(
    'data-state-point-id',
    /action-0002/
  );
  await batchResultButton.click();
  const batchRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(batchRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expect(batchRuntimeState.statePointId).toContain('action-0002');
  expectRuntimeStatePointSynced(
    batchRuntimeState,
    batchRuntimeState.statePointId
  );

  await page.getByTestId('workbench-summary-copy-action-batch').click();
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('2');
  await expect(
    page.locator('.action-item[data-action-id="action-0004"]')
  ).toHaveAttribute('data-batch-id', 'segment-batch-0002');
  await expect(
    page.locator(
      '[data-testid="workbench-action-batch-summary"][data-batch-id="segment-batch-0002"]'
    )
  ).toHaveAttribute('data-first-action-id', 'action-0004');

  const copiedBatchState = await waitForRuntimeAction(page, 'action-0004');
  expectRuntimeReviewState(copiedBatchState, {
    phase: 'runtime-result',
    actionId: 'action-0004',
    navigationCount: '5',
    navigationIndex: '3',
    selected: true,
  });
  expect(copiedBatchState.statePointId).toContain('action-0004');
  expect(copiedBatchState.statePointId).not.toBe(
    batchRuntimeState.statePointId
  );
  expectRuntimeStatePointSynced(
    copiedBatchState,
    copiedBatchState.statePointId
  );
  await expectCurveAndLogSelection(page, copiedBatchState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(page.getByTestId('workbench-undo-edit')).toBeEnabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeDisabled();

  await page.getByTestId('workbench-undo-edit').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已撤销编辑'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('1');
  await expect(
    page.locator('.action-item[data-action-id="action-0004"]')
  ).toHaveCount(0);
  const restoredOriginalBatchState = await waitForRuntimeAction(
    page,
    'action-0002'
  );
  expectRuntimeReviewState(restoredOriginalBatchState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    restoredOriginalBatchState,
    batchRuntimeState.statePointId
  );
  await expectCurveAndLogSelection(page, batchRuntimeState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(page.getByTestId('workbench-undo-edit')).toBeDisabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeEnabled();

  await page.getByTestId('workbench-redo-edit').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已重做编辑'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('2');
  await expect(
    page.locator('.action-item[data-action-id="action-0004"]')
  ).toHaveAttribute('data-batch-id', 'segment-batch-0002');
  const redoneCopiedBatchState = await waitForRuntimeAction(
    page,
    'action-0004'
  );
  expectRuntimeReviewState(redoneCopiedBatchState, {
    phase: 'runtime-result',
    actionId: 'action-0004',
    navigationCount: '5',
    navigationIndex: '3',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    redoneCopiedBatchState,
    copiedBatchState.statePointId
  );
  await expectCurveAndLogSelection(page, copiedBatchState.statePointId);
  await expectRuntimeOutputConsistent(page);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0004',
    frameValue: '210',
    msValue: '3500',
    originStatePointId: redoneCopiedBatchState.statePointId,
    navigationCount: '5',
    navigationIndex: '3',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps runtime result flow usable after shifting a generated action batch @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await seedGeneratedActionBatchDraft(page);
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('1');

  await page.getByTestId('workbench-summary-view-action-batch-result').click();
  const batchRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(batchRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    batchRuntimeState,
    batchRuntimeState.statePointId
  );
  await expectRuntimeOutputConsistent(page);

  await page.getByTestId('workbench-summary-shift-action-batch-later').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '有未保存改动'
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).not.toHaveText(batchRuntimeState.statePointId);

  const shiftedBatchState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(shiftedBatchState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expect(shiftedBatchState.statePointId).toContain('action-0002');
  expect(shiftedBatchState.statePointId).not.toBe(
    batchRuntimeState.statePointId
  );
  expectRuntimeStatePointSynced(
    shiftedBatchState,
    shiftedBatchState.statePointId
  );
  await expectCurveAndLogSelection(page, shiftedBatchState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute(
    'data-selected-state-point-id',
    shiftedBatchState.statePointId
  );

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0002',
    frameValue: '84',
    msValue: '1400',
    originStatePointId: shiftedBatchState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps runtime result flow usable after deleting a generated action batch @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await seedGeneratedActionBatchDraft(page);
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('1');

  const batchResultButton = page.getByTestId(
    'workbench-summary-view-action-batch-result'
  );
  await expect(batchResultButton).toHaveAttribute(
    'data-action-id',
    'action-0002'
  );
  await expect(batchResultButton).toHaveAttribute(
    'data-state-point-id',
    /action-0002/
  );
  await batchResultButton.click();
  const batchRuntimeState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(batchRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expect(batchRuntimeState.statePointId).toContain('action-0002');
  expectRuntimeStatePointSynced(
    batchRuntimeState,
    batchRuntimeState.statePointId
  );
  await expect(
    page.getByTestId('workbench-main-flow-workspace')
  ).toHaveAttribute(
    'data-main-flow-dispatch-source',
    'action-batch-summary-result'
  );

  await page.getByTestId('workbench-summary-delete-action-batch').click();
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('0');
  await expect(
    page.locator('.action-item[data-batch-id="segment-batch-0001"]')
  ).toHaveCount(0);

  const fallbackState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(fallbackState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  expect(fallbackState.statePointId).toContain('action-0001');
  expect(fallbackState.statePointId).not.toBe(batchRuntimeState.statePointId);
  expectRuntimeStatePointSynced(fallbackState, fallbackState.statePointId);
  await expectRuntimeOutputConsistent(page);
  await expect(page.getByTestId('workbench-undo-edit')).toBeEnabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeDisabled();

  await page.getByTestId('workbench-undo-edit').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已撤销编辑'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('1');
  await expect(
    page.locator('.action-item[data-batch-id="segment-batch-0001"]')
  ).toHaveCount(2);
  const restoredBatchState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(restoredBatchState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    restoredBatchState,
    batchRuntimeState.statePointId
  );
  await expectRuntimeOutputConsistent(page);
  await expect(page.getByTestId('workbench-undo-edit')).toBeDisabled();
  await expect(page.getByTestId('workbench-redo-edit')).toBeEnabled();

  await page.getByTestId('workbench-redo-edit').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已重做编辑'
  );
  await expect(
    page.getByTestId('workbench-action-batch-summary-count')
  ).toHaveText('0');
  await expect(
    page.locator('.action-item[data-batch-id="segment-batch-0001"]')
  ).toHaveCount(0);
  const redoneFallbackState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(redoneFallbackState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  expectRuntimeStatePointSynced(
    redoneFallbackState,
    fallbackState.statePointId
  );
  await expectRuntimeOutputConsistent(page);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '18',
    msValue: '300',
    originStatePointId: redoneFallbackState.statePointId,
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('persists cycle boundaries and reviews section contributions @workbench-main-flow', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.locator('.action-item[data-action-id="action-0001"]').click();
  await page.getByTestId('workbench-effect-add').click();
  await page.getByTestId('workbench-effect-name-input').fill('跨段星流');
  await page.getByTestId('workbench-effect-duration-frame-input').fill('120');
  await page.getByTestId('workbench-effect-duration-frame-input').press('Tab');

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
  await expect(workbench).toHaveAttribute(
    'data-selected-cycle-section-id',
    'cycle-section-02'
  );
  const contributionPanel = page.getByTestId(
    'workbench-cycle-section-panel'
  );
  await expect(contributionPanel).toHaveAttribute(
    'data-selected-window-id',
    'cycle-section-02'
  );
  await expect(page.getByTestId('workbench-cycle-section-tab')).toHaveCount(2);
  await page.getByTestId('workbench-contribution-window-axis').click();
  await expect(contributionPanel).toHaveAttribute(
    'data-selected-window-id',
    'full-axis'
  );
  await expect(
    contributionPanel.getByTestId('workbench-cycle-section-actor-row')
  ).toHaveCount(3);
  await page
    .locator(
      '[data-testid="workbench-cycle-section-tab"][data-section-id="cycle-section-02"]'
    )
    .click();
  await expect(contributionPanel).toHaveAttribute(
    'data-selected-window-id',
    'cycle-section-02'
  );
  const effectCoverageText = await page
    .getByTestId('workbench-cycle-section-panel')
    .locator('[data-metric-key="effectCoverageMs"] strong')
    .textContent();
  const effectCoverageFrames = Number.parseFloat(effectCoverageText);
  expect(effectCoverageFrames).toBeGreaterThan(0);
  expect(effectCoverageFrames).toBeLessThan(120);
  const secondAction = page.locator(
    '[data-testid="workbench-cycle-section-action-row"][data-action-id="action-0002"]'
  );
  await expect(secondAction).toBeVisible();
  const locateContribution = secondAction.getByTestId(
    'workbench-cycle-section-locate-action'
  );
  const expectedStatePointId = await locateContribution.getAttribute(
    'data-state-point-id'
  );
  expect(expectedStatePointId).toBeTruthy();
  await locateContribution.click();
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-source', 'contribution-window');
  await expect
    .poll(async () => (await readWorkbenchState(page)).statePointId)
    .toBe(expectedStatePointId);
  const contributionState = await readWorkbenchState(page);
  expect(contributionState.selectedTimelineActionId).toBe('action-0002');
  expect(contributionState.selectedActionListId).toBe('action-0002');

  const boundary = page.getByTestId('workbench-cycle-boundary');
  const initialBoundaryTimeMs = await boundary.getAttribute('data-time-ms');
  await boundary.evaluate(element =>
    element.scrollIntoView({ block: 'center', inline: 'nearest' })
  );
  const boundaryBox = await boundary.boundingBox();
  expect(boundaryBox).toBeTruthy();
  await page.mouse.move(boundaryBox.x, boundaryBox.y + 50);
  await page.mouse.down();
  await page.mouse.move(boundaryBox.x + laneBox.width / 60, boundaryBox.y + 50);
  await page.mouse.up();
  await expect(boundary).not.toHaveAttribute(
    'data-time-ms',
    initialBoundaryTimeMs
  );

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const exportedProject = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(exportedProject.schemaVersion).toBe(16);
  expect(exportedProject.cycleBoundaries).toEqual([
    expect.objectContaining({ id: 'cycle-boundary-0001' }),
  ]);

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await expect(workbench).toHaveAttribute('data-cycle-boundary-count', '0');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(workbench).toHaveAttribute('data-cycle-boundary-count', '1');
  await expect(page.getByTestId('workbench-cycle-section-panel')).toBeVisible();
});

test('creates an inherited scenario with continued runtime state @workbench-main-flow', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.locator('.action-item[data-action-id="action-0001"]').click();
  await page.getByTestId('workbench-effect-add').click();
  await page.getByTestId('workbench-effect-name-input').fill('继承星流');
  await page.getByTestId('workbench-effect-duration-frame-input').fill('120');
  await page.getByTestId('workbench-effect-duration-frame-input').press('Tab');

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
  await expect(
    page.locator('[data-effect-event-type="EFFECT_INHERITED"]')
  ).toBeVisible();
  await expect(page.getByTestId('workbench-draft-status')).toContainText(
    '已从循环边界创建继承方案'
  );

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project).toMatchObject({
    schemaVersion: 16,
    initialRuntimeState: {
      source: {
        sourceScenarioId: 'scenario-0001',
        boundaryId: 'cycle-boundary-0001',
        boundaryTimeMs,
      },
      enemy: {
        hp: { currentValue: expect.any(Number) },
        toughness: { currentValue: expect.any(Number) },
      },
      activeEffects: [
        {
          effectName: '继承星流',
          remainingDurationMs: expect.any(Number),
        },
      ],
    },
  });
});

test('manages, compares, and restores multiple workspace scenarios @workbench-main-flow', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '1');

  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-scenario-rename').click();
  await page.getByTestId('workbench-scenario-rename-input').fill('爆发轴');
  await page.getByTestId('workbench-scenario-rename-input').press('Enter');
  await expect(page.getByTestId('workbench-scenario-name')).toHaveText(
    '爆发轴'
  );

  await page.getByTestId('workbench-scenario-duplicate').click();
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0002'
  );
  await expect(page.locator('.action-item')).toHaveCount(2);
  await page.getByTestId('workbench-add-action').click();
  await expect(page.locator('.action-item')).toHaveCount(3);

  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0001"]'
    )
    .click();
  await expect(page.locator('.action-item')).toHaveCount(2);
  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0002"]'
    )
    .click();
  await expect(page.locator('.action-item')).toHaveCount(3);

  await clickProjectMenuCommand(page, 'workbench-open-comparison');
  await page
    .getByTestId('workbench-comparison-workspace-scenario')
    .selectOption('scenario-0001');
  await expect(
    page.getByTestId('workbench-comparison-baseline-source')
  ).toContainText('爆发轴');
  await expect(page.getByTestId('workbench-comparison-action-row')).toHaveCount(
    3
  );
  await page.getByTestId('workbench-comparison-close').click();

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const exportedProject = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(exportedProject).toMatchObject({
    schemaVersion: 16,
    scenarioWorkspace: {
      activeScenarioId: 'scenario-0002',
      scenarios: [
        {
          id: 'scenario-0001',
          name: '爆发轴',
          draft: { actionDrafts: expect.any(Array) },
        },
        {
          id: 'scenario-0002',
          name: '爆发轴 副本',
          draft: { actionDrafts: expect.any(Array) },
        },
      ],
    },
  });
  expect(
    exportedProject.scenarioWorkspace.scenarios[0].draft.actionDrafts
  ).toHaveLength(2);
  expect(
    exportedProject.scenarioWorkspace.scenarios[1].draft.actionDrafts
  ).toHaveLength(3);

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '1');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0002'
  );
  await expect(page.locator('.action-item')).toHaveCount(3);

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId('workbench-scenario-delete').click();
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '1');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0001'
  );
  await expect(page.locator('.action-item')).toHaveCount(2);
});

test('reuses named actor and enemy configurations across workspace scenarios @workbench-main-flow', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await openSelectedActionInspector(page);
  const actorSelect = page.locator(
    '[data-testid="workbench-actor-configuration-select"][data-character-id="109001"]'
  );
  const actorName = page.locator(
    '[data-testid="workbench-actor-configuration-name"][data-character-id="109001"]'
  );
  const initialSpInput = page.locator(
    '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
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
  expect(burstActorInstanceId).not.toBe(originalActorInstanceId);
  await actorName.fill('末音爆发配置');
  await initialSpInput.fill('0.75');

  await page.getByTestId('workbench-enemy-configuration-duplicate').click();
  const challengeEnemyInstanceId = await enemySelect.inputValue();
  expect(challengeEnemyInstanceId).not.toBe(originalEnemyInstanceId);
  await page
    .getByTestId('workbench-enemy-configuration-name')
    .fill('高压敌人配置');
  await page.getByTestId('workbench-enemy-level-input').fill('95');

  await page.getByTestId('workbench-scenario-duplicate').click();
  await actorSelect.selectOption(originalActorInstanceId);
  await enemySelect.selectOption(originalEnemyInstanceId);
  await expect(initialSpInput).toHaveValue('');
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '80'
  );

  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0001"]'
    )
    .click();
  await expect(actorSelect).toHaveValue(burstActorInstanceId);
  await expect(actorName).toHaveValue('末音爆发配置');
  await expect(initialSpInput).toHaveValue('0.75');
  await expect(enemySelect).toHaveValue(challengeEnemyInstanceId);
  await expect(
    page.getByTestId('workbench-enemy-configuration-name')
  ).toHaveValue('高压敌人配置');
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '95'
  );

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project.schemaVersion).toBe(16);
  expect(
    project.configurationLibrary.actorInstances.find(
      instance => instance.id === burstActorInstanceId
    )
  ).toMatchObject({
    name: '末音爆发配置',
    actorConfig: { initialSp: 0.75 },
  });
  expect(
    project.configurationLibrary.enemyInstances.find(
      instance => instance.id === challengeEnemyInstanceId
    )
  ).toMatchObject({
    name: '高压敌人配置',
    enemyConfig: { level: 95 },
  });

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await openSelectedActionInspector(page);
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(actorSelect).toHaveValue(burstActorInstanceId);
  await expect(actorName).toHaveValue('末音爆发配置');
  await expect(initialSpInput).toHaveValue('0.75');
  await expect(enemySelect).toHaveValue(challengeEnemyInstanceId);
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '95'
  );
});

test('persists resizable editing and review workspace layouts @workbench-main-flow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  const actionLibrary = page.locator('.action-library');
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(page.getByTestId('workbench-layout-bar')).toBeVisible();

  await page
    .locator('[data-testid="workbench-layout-mode"][data-layout-mode="edit"]')
    .click();
  await expect(workbench).toHaveAttribute('data-workbench-layout-mode', 'edit');
  await expect(workbench).toHaveAttribute(
    'data-workbench-right-panel-collapsed',
    'true'
  );
  await expect(actionLibrary).toBeVisible();
  await expect(inspector).toBeHidden();

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
  const leftResizer = page.getByTestId('workbench-left-resizer');
  await leftResizer.evaluate(element =>
    element.scrollIntoView({ block: 'start', inline: 'nearest' })
  );
  const leftResizerBox = await leftResizer.boundingBox();
  expect(leftResizerBox).toBeTruthy();
  await page.mouse.move(
    leftResizerBox.x + leftResizerBox.width / 2,
    leftResizerBox.y + 100
  );
  await page.mouse.down();
  await page.mouse.move(
    leftResizerBox.x + leftResizerBox.width / 2 + 64,
    leftResizerBox.y + 100
  );
  await page.mouse.up();
  await expect(workbench).toHaveAttribute(
    'data-workbench-left-panel-width',
    '324'
  );

  await page.reload();
  await expect(workbench).toHaveAttribute(
    'data-workbench-left-panel-width',
    '324'
  );
  const storedLayout = await page.evaluate(() =>
    JSON.parse(
      window.localStorage.getItem('promilia-axis-tool:workbench-layout:v1')
    )
  );
  expect(storedLayout).toMatchObject({
    schemaVersion: 1,
    mode: 'balanced',
    leftPanelWidth: 324,
    rightPanelWidth: 300,
  });

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(project.workbenchLayout).toBeUndefined();
  expect(project.workspaceLayout).toBeUndefined();

  await page
    .locator('[data-testid="workbench-layout-mode"][data-layout-mode="review"]')
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByTestId('workbench-layout-bar')).toBeHidden();
  await expect(actionLibrary).toBeVisible();
  await expect(inspector).toBeVisible();
  expect(await readPageOverflowX(page)).toBe(0);
});

test('keeps the edit result loop usable at a narrow viewport @workbench-main-flow', async ({
  page,
}) => {
  const browserIssues = collectBrowserIssues(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );
  expect(await readPageOverflowX(page)).toBe(0);

  await page.getByTestId('workbench-flow-open-runtime').click();
  const narrowRuntimeState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(narrowRuntimeState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    selected: true,
  });
  await expectRuntimeOutputConsistent(page);
  await expectCurveAndLogSelection(page, narrowRuntimeState.statePointId);

  const contributionEditButton = page.getByTestId(
    'workbench-action-contribution-edit-action'
  );
  await expect(contributionEditButton).toHaveAttribute(
    'data-state-point-id',
    narrowRuntimeState.statePointId
  );
  await contributionEditButton.click();
  await expectRuntimeFocusInEditor(page);
  expect(await readPageOverflowX(page)).toBe(0);

  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '18',
    msValue: '300',
    originStatePointId: narrowRuntimeState.statePointId,
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  expect(await readPageOverflowX(page)).toBe(0);

  const flowContinueButton = page
    .getByTestId('workbench-flow-panel')
    .getByTestId('workbench-flow-edit-runtime-action');
  await expect(flowContinueButton).toHaveText('继续修改动作');
  await expect(flowContinueButton).toHaveAttribute(
    'data-state-point-id',
    returnedState.statePointId
  );
  await expect(flowContinueButton).toHaveAttribute(
    'data-primary-action',
    'true'
  );
  await flowContinueButton.click();
  await expectRuntimeFocusInEditor(page);
  expect(await readPageOverflowX(page)).toBe(0);

  const { returnedState: secondReturnedState } =
    await editCurrentActionFrameAndReturn(page, {
      actionId: 'action-0001',
      frameValue: '24',
      msValue: '400',
      originStatePointId: returnedState.statePointId,
      selected: true,
    });
  expect(secondReturnedState.statePointId).not.toBe(returnedState.statePointId);
  await expectCurveAndLogSelection(page, secondReturnedState.statePointId);
  await expectRuntimeOutputConsistent(page);
  expect(await readPageOverflowX(page)).toBe(0);

  expectNoUnexpectedBrowserIssues(browserIssues);
});

function collectBrowserIssues(page) {
  const browserIssues = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) {
      browserIssues.push(`${message.type()}: ${message.text()}`);
    }
  });
  return browserIssues;
}

async function createThreeActionRuntime(page) {
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  const openedState = await waitForRuntimeAction(page, 'action-0001');
  expectRuntimeReviewState(openedState, {
    phase: 'runtime-result',
    actionId: 'action-0001',
    selected: false,
  });

  await page.getByTestId('workbench-add-action').click();
  const insertedState = await waitForRuntimeAction(page, 'action-0002');
  expectRuntimeReviewState(insertedState, {
    phase: 'runtime-result',
    actionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    selected: false,
  });
  expect(insertedState.statePointId).toContain('action-0002');
  expectRuntimeStatePointSynced(insertedState, insertedState.statePointId);

  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .getByTestId('workbench-copy-action')
    .click();
  const copiedState = await waitForRuntimeAction(page, 'action-0003');
  expectRuntimeReviewState(copiedState, {
    phase: 'runtime-result',
    actionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    selected: false,
  });
  expect(copiedState.statePointId).toContain('action-0003');
  expect(copiedState.statePointId).not.toBe(insertedState.statePointId);
  expectRuntimeStatePointSynced(copiedState, copiedState.statePointId);

  return {
    openedState,
    insertedState,
    copiedState,
  };
}

async function seedGeneratedActionBatchDraft(page) {
  await page.addInitScript(() => {
    const generationBatch = {
      batchId: 'segment-batch-0001',
      source: 'skill-action-variant-split',
      skillId: 10900101,
      actorCharacterId: 109001,
      level: 1,
      variantCount: 2,
      segmentCount: 2,
      createdAt: '2026-07-09T00:00:00.000Z',
    };
    window.localStorage.removeItem(
      'promilia-axis-tool:workbench-draft:v16'
    );
    window.localStorage.setItem(
      'promilia-axis-tool:workbench-draft:v1',
      JSON.stringify({
        schemaVersion: 1,
        game: 'azur-promilia',
        type: 'workbench-draft',
        savedAt: '2026-07-09T00:00:00.000Z',
        selection: {
          characterId: 109001,
          secondaryCharacterId: 101003,
          skillId: 10900101,
          enemyId: 300032,
        },
        enemyConfig: {
          level: 80,
          hpMultiplier: 1,
          defenseMultiplier: 1,
        },
        segmentSplitOptions: {
          intervalMs: 2000,
          startAfterSelectedAction: false,
          skipExistingSegments: false,
        },
        actionDrafts: [
          {
            id: 'action-0001',
            type: 'skill',
            skillId: 10900101,
            actorCharacterId: 109001,
            startMs: 0,
            durationMs: 1000,
            level: 1,
            actionVariantIndex: 0,
            damageSegmentIndex: 0,
          },
          {
            id: 'action-0002',
            type: 'skill',
            skillId: 10900101,
            actorCharacterId: 109001,
            startMs: 1000,
            durationMs: 1000,
            level: 1,
            actionVariantIndex: 1,
            damageSegmentIndex: 1,
            generationBatch,
          },
          {
            id: 'action-0003',
            type: 'skill',
            skillId: 10900101,
            actorCharacterId: 109001,
            startMs: 2000,
            durationMs: 1000,
            level: 1,
            actionVariantIndex: 2,
            damageSegmentIndex: 2,
            generationBatch,
          },
        ],
        selectedActionId: 'action-0002',
      })
    );
  });
  await page.reload();
}

async function focusRuntimeDetailAction(page) {
  await page
    .getByTestId('workbench-runtime-selected-detail-action-focus')
    .click();
  await expectRuntimeFocusInEditor(page);
}

async function expectRuntimeFocusInEditor(page) {
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-origin', 'runtime-focus');
}

async function nudgeTimelineAction(page, actionId) {
  const action = page
    .locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
    )
    .first();
  await expect(action).toBeVisible();
  await action.focus();
  await action.press('ArrowLeft');
}

async function ensureActionContentEditResultSynced(
  page,
  { actionId, fieldKey, originStatePointId }
) {
  const feedback = page.getByTestId('workbench-action-edit-feedback');
  await expect(feedback).toHaveAttribute('data-action-id', actionId);
  await expect(feedback).toHaveAttribute('data-edit-source-field', fieldKey);
  await expect(feedback).toHaveAttribute(
    'data-origin-state-point-id',
    originStatePointId
  );

  let editState = await readEditState(
    page,
    'workbench-flow-return-edit-result'
  );
  expect(editState.feedbackStatePointId).toContain(actionId);

  const resultFocusButton = page.getByTestId(
    'workbench-action-edit-feedback-result-focus'
  );
  const resultFocusStatus = await resultFocusButton.getAttribute(
    'data-result-focus-status'
  );
  if (resultFocusStatus === 'available') {
    await resultFocusButton.click();
    await expect(resultFocusButton).toHaveAttribute(
      'data-result-focus-status',
      'focused'
    );
    editState = await readEditState(page, 'workbench-flow-return-edit-result');
  } else {
    expect(resultFocusStatus).toBe('focused');
  }

  const refreshedStatePointId = editState.feedbackStatePointId;
  const returnedState = await readWorkbenchState(page);
  expectRuntimeReviewState(returnedState, {
    phase: 'edit-result-review',
    actionId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
  });
  expectRuntimeStatePointSynced(returnedState, refreshedStatePointId);
  expect(returnedState.selectedActionListId).toBe(actionId);
  expect(returnedState.selectedTimelineActionId).toBe(actionId);
  await expect(feedback).toHaveAttribute('data-result-focused', 'true');
  await expect(feedback).toHaveAttribute('data-result-focus-status', 'focused');

  return editState;
}

async function readStoredWorkbenchDraft(page) {
  return await page.evaluate(() => {
    const rawDraft =
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v16') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v15') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v12') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v8') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v5') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v4') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v3') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v2') ??
      window.localStorage.getItem('promilia-axis-tool:workbench-draft:v1');
    return rawDraft ? JSON.parse(rawDraft) : null;
  });
}

async function editCurrentActionFrameAndReturn(
  page,
  {
    actionId,
    frameValue,
    msValue,
    originStatePointId,
    navigationCount,
    navigationIndex,
    selected = true,
    returnButtonTestId = 'workbench-flow-return-edit-result',
    preNudgeStartFrame = false,
  }
) {
  if (preNudgeStartFrame) {
    await page
      .locator(
        '[data-testid="workbench-start-frame-step"][data-step-direction="increase"]'
      )
      .click();
    await expect(page.getByTestId('workbench-start-frame-input')).toHaveValue(
      '1'
    );
  }

  await page.getByTestId('workbench-start-frame-input').fill(frameValue);
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  const editState = await readEditState(page, returnButtonTestId);
  expect(editState).toMatchObject({
    actionId,
    phase: 'edit-result-ready',
    resultFocused: 'false',
    startFrameValue: frameValue,
    startMsValue: msValue,
    returnButtonText: '查看刷新结果',
    pageOverflowX: 0,
  });
  expect(editState.feedbackOriginStatePointId).toBe(originStatePointId);
  expect(editState.feedbackStatePointId).toContain(actionId);
  expect(editState.feedbackStatePointId).not.toBe(originStatePointId);
  expect(editState.returnButtonStatePointId).toBe(
    editState.feedbackStatePointId
  );

  await page.getByTestId(returnButtonTestId).click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-review'
  );
  const returnedState = await readWorkbenchState(page);
  expectRuntimeReviewState(returnedState, {
    phase: 'edit-result-review',
    actionId,
    navigationCount,
    navigationIndex,
    selected,
  });
  expectRuntimeStatePointSynced(returnedState, editState.feedbackStatePointId);

  return {
    editState,
    returnedState,
  };
}

async function waitForRuntimeAction(page, actionId) {
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    actionId
  );
  return await readWorkbenchState(page);
}

function expectRuntimeReviewState(
  state,
  { phase, actionId, navigationCount, navigationIndex, selected = true } = {}
) {
  const expected = {
    phase,
    actionId,
    runtimeDetailActionId: actionId,
    contributionActionId: actionId,
    hpContributionActive: 'true',
    pageOverflowX: 0,
  };
  if (navigationCount != null) {
    expected.navigationCount = navigationCount;
  }
  if (navigationIndex != null) {
    expected.navigationIndex = navigationIndex;
  }
  if (selected) {
    expected.selectedActionListId = actionId;
    expected.selectedTimelineActionId = actionId;
  }
  expect(state).toMatchObject(expected);
}

function expectRuntimeStatePointSynced(state, statePointId) {
  expect(state.statePointId).toBe(statePointId);
  expect(state.curveStatePointId).toBe(statePointId);
  expect(state.logStatePointId).toBe(statePointId);
  expect(state.hpContributionStatePointId).toBe(statePointId);
}

async function expectCurveAndLogSelection(page, statePointId) {
  await expect(
    page
      .locator(
        `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${statePointId}"]`
      )
      .first()
  ).toHaveAttribute('data-selected', 'true');
  await expect(
    page
      .locator(
        `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
      )
      .first()
  ).toHaveAttribute('data-selected', 'true');
  await expect(
    page.getByTestId('workbench-runtime-resource-chart-selection')
  ).toHaveAttribute('data-state-point-id', statePointId);
  await expect(
    page.getByTestId('workbench-runtime-sim-log-navigation')
  ).toHaveAttribute('data-state-point-id', statePointId);
}

async function clickRuntimeLogRow(page, logRow) {
  const box = await logRow.boundingBox();
  expect(box).toBeTruthy();
  await logRow.click({
    position: {
      x: Math.min(12, box.width / 2),
      y: box.height / 2,
    },
  });
}

async function openSelectedActionInspector(page) {
  const inspector = page.getByTestId('workbench-side-inspector');
  if (await inspector.isVisible()) {
    return;
  }
  const selectedActionId =
    (await page
      .getByTestId('workbench-flow-panel')
      .getAttribute('data-action-id')) || 'action-0001';
  await page
    .locator(`.action-item[data-action-id="${selectedActionId}"]`)
    .click();
  await expect(inspector).toBeVisible();
}

async function clickProjectMenuCommand(page, testId) {
  const menu = page.getByTestId('workbench-project-menu');
  if ((await menu.getAttribute('open')) == null) {
    await menu.locator('summary').click();
  }
  const command = page.getByTestId(testId);
  await expect(command).toBeVisible();
  await command.click();
  if ((await menu.getAttribute('open')) != null) {
    await menu.evaluate(element => element.removeAttribute('open'));
  }
  return command;
}

async function expectRuntimeOutputConsistent(page) {
  const flowPanel = page.getByTestId('workbench-flow-panel');
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-consistency-status',
    'runtime-output-consistent'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-consistent',
    'true'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-navigation-synced',
    'true'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-consumer-view-source',
    'workbench-runtime-output-consumer-view'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-consumer-ready',
    'true'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-consumer-contract-status',
    /runtime-output-consumer-contract-ready/
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-contract-boundary-status',
    'workbench-runtime-contract-boundary-standard'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-contract-boundary-ready',
    'true'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-contract-standard-boundary-ready',
    'true'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-contract-uses-legacy-fallback',
    'false'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-state-point-context-count',
    /[1-9]\d*/
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-state-point-context-synced',
    'true'
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-projection-point-count',
    /[1-9]\d*/
  );
  await expect(flowPanel).toHaveAttribute(
    'data-runtime-output-projection-synced',
    'true'
  );
}

async function selectHpContributionAndExpectResultFocus(page, state) {
  const contributionRow = page.locator(
    '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]'
  );
  await expect(contributionRow).toHaveAttribute(
    'data-flow-action-kind',
    'select-contribution-point'
  );
  await expect(contributionRow).toHaveAttribute(
    'data-flow-action-state-point-id',
    state.statePointId
  );

  await contributionRow.click();
  await expectCurveAndLogSelection(page, state.statePointId);
  await expect(
    page.getByTestId('workbench-runtime-sim-log-filter-summary')
  ).toContainText('贡献定位');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'action-contribution');
  await expect(
    page
      .locator(
        `[data-testid="workbench-runtime-resource-chart-point"][data-state-point-id="${state.statePointId}"]`
      )
      .first()
  ).toHaveAttribute('data-runtime-focus-source', 'action-contribution');
}

async function expectRuntimeSimLogHitAggregateContributions(page) {
  const contribution = page.getByTestId(
    'workbench-runtime-sim-log-contribution'
  );
  await expect(contribution).toBeVisible();

  const rows = page.getByTestId('workbench-runtime-sim-log-contribution-row');
  await expect(rows).toHaveCount(3);

  const expectedRows = [
    { key: 'hp', label: /敌人 HP/, positive: true },
    { key: 'toughness', label: /敌人韧性/ },
    { key: 'energy', label: /自身能量/ },
  ];
  for (const [index, expectedRow] of expectedRows.entries()) {
    const row = rows.nth(index);
    await expect(row).toHaveAttribute('data-contribution-key', expectedRow.key);
    await expect(row).toHaveAttribute(
      'data-contribution-source',
      'hit-transaction'
    );
    await expect(row).toContainText(expectedRow.label);
    if (expectedRow.positive) {
      const value = Number(await row.getAttribute('data-value'));
      expect(value).toBeGreaterThan(0);
    }
  }
}

async function expectRuntimeHitReviewMode(page) {
  const panel = page.getByTestId('workbench-event-log-panel');
  await expect(panel).toHaveAttribute('data-runtime-log-review-mode', 'hit');
  await expect(
    page.locator(
      '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="hit"]'
    )
  ).toHaveAttribute('data-active', 'true');
  const rows = page.getByTestId('workbench-runtime-sim-log-row');
  expect(await rows.count()).toBeGreaterThan(0);
  for (const row of await rows.all()) {
    await expect(row).toHaveAttribute('data-review-unit', 'hit-transaction');
    await expect(row).toHaveAttribute('data-transaction-id', /.+/);
  }
}

async function expectRuntimeSelectedHitTransaction(page, statePointId) {
  const detail = page.getByTestId('workbench-runtime-selected-detail');
  await expect(detail).toHaveAttribute('data-review-unit', 'hit-transaction');
  const transactionId = await detail.getAttribute('data-transaction-id');
  expect(transactionId).toBeTruthy();
  await expect(
    page
      .locator(
        `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${statePointId}"]`
      )
      .first()
  ).toHaveAttribute('data-transaction-id', transactionId);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-three-value-state')
  ).toHaveAttribute('data-transaction-id', transactionId);
}

async function expectRuntimeThreeValueStateDetail(page, statePointId) {
  const stateTable = page.getByTestId(
    'workbench-runtime-selected-detail-three-value-state'
  );
  await expect(stateTable).toBeVisible();
  await expect(stateTable).toHaveAttribute('data-state-point-id', statePointId);

  const rows = stateTable.getByTestId(
    'workbench-runtime-selected-detail-three-value-row'
  );
  await expect(rows).toHaveCount(3);
  const expectedMetricKeys = ['enemyHp', 'enemyToughness', 'selfEnergy'];
  for (const [index, metricKey] of expectedMetricKeys.entries()) {
    await expect(rows.nth(index)).toHaveAttribute('data-metric-key', metricKey);
  }

  const hpRow = rows.nth(0);
  await expect(hpRow).toHaveAttribute('data-primary', 'true');
  const beforeValue = Number(await hpRow.getAttribute('data-before-value'));
  const stateDelta = Number(await hpRow.getAttribute('data-state-delta'));
  const afterValue = Number(await hpRow.getAttribute('data-after-value'));
  expect(beforeValue).toBeGreaterThan(0);
  expect(stateDelta).toBeLessThan(0);
  expect(afterValue).toBeCloseTo(beforeValue + stateDelta, 3);

  await expect(rows.nth(2)).toHaveAttribute('data-actor-id', /.+/);
}

function expectNoUnexpectedBrowserIssues(browserIssues) {
  expect(browserIssues.filter(issue => !isExpectedBrowserIssue(issue))).toEqual(
    []
  );
}

function isExpectedBrowserIssue(issue) {
  return (
    issue.includes('[intlify] Legacy API mode has been deprecated in v11') ||
    issue.includes(
      'Failed to load resource: the server responded with a status of 404'
    )
  );
}

async function prepareBasicWorkbenchScenario(page) {
  const draft = createBasicWorkbenchDraftFixture();
  await page.addInitScript(
    ({ storageKey, draftState }) => {
      const markerKey = 'promilia-axis-tool:e2e-basic-draft-seeded';
      if (window.sessionStorage.getItem(markerKey) === '1') {
        return;
      }
      window.localStorage.setItem(storageKey, JSON.stringify(draftState));
      window.sessionStorage.setItem(markerKey, '1');
    },
    {
      storageKey: BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
      draftState: draft,
    }
  );
  await page.goto('/#/workbench');
  const scenarioBar = page.getByTestId('workbench-scenario-bar');
  await expect(scenarioBar).toBeVisible();
  await expect(scenarioBar).toHaveAttribute('data-scenario-count', '1');
  await expect(page.getByTestId('workbench-scenario-tab')).toHaveAttribute(
    'data-scenario-id',
    'scenario-0001'
  );
}

async function readWorkbenchState(page) {
  return await page.evaluate(() => {
    const get = selector => document.querySelector(selector);
    const attr = (selector, name) => get(selector)?.getAttribute(name) ?? '';
    const text = selector => get(selector)?.textContent?.trim() ?? '';
    return {
      phase: attr('[data-testid="workbench-flow-panel"]', 'data-flow-phase'),
      actionId: attr('[data-testid="workbench-flow-panel"]', 'data-action-id'),
      runtimeDetailActionId: attr(
        '[data-testid="workbench-flow-panel"]',
        'data-runtime-detail-action-id'
      ),
      navigationCount: attr(
        '[data-testid="workbench-flow-panel"]',
        'data-runtime-navigation-count'
      ),
      navigationIndex: attr(
        '[data-testid="workbench-flow-panel"]',
        'data-runtime-navigation-index'
      ),
      statePointId: text(
        '[data-testid="workbench-runtime-selected-detail-state-point"]'
      ),
      curveStatePointId: attr(
        '[data-testid="workbench-runtime-resource-chart-selection"]',
        'data-state-point-id'
      ),
      logStatePointId: attr(
        '[data-testid="workbench-runtime-sim-log-navigation"]',
        'data-state-point-id'
      ),
      contributionActionId: attr(
        '[data-testid="workbench-action-contribution-panel"]',
        'data-action-id'
      ),
      hpContributionStatePointId: attr(
        '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]',
        'data-state-point-id'
      ),
      hpContributionActive: attr(
        '[data-testid="workbench-action-contribution-row"][data-track-key="enemyHpDamage"]',
        'data-active'
      ),
      selectedTimelineActionId:
        document
          .querySelector('[data-testid="workbench-timeline-action"].selected')
          ?.getAttribute('data-action-id') ?? '',
      selectedActionListId:
        document
          .querySelector('.action-item.selected')
          ?.getAttribute('data-action-id') ?? '',
      pageOverflowX: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth
      ),
    };
  });
}

async function readEditState(page, returnButtonTestId) {
  return await page.evaluate(testId => {
    const get = selector => document.querySelector(selector);
    const attr = (selector, name) => get(selector)?.getAttribute(name) ?? '';
    const text = selector => get(selector)?.textContent?.trim() ?? '';
    const returnButtonSelector = `[data-testid="${testId}"]`;
    return {
      phase: attr('[data-testid="workbench-flow-panel"]', 'data-flow-phase'),
      actionId: attr('[data-testid="workbench-flow-panel"]', 'data-action-id'),
      startFrameValue:
        get('[data-testid="workbench-start-frame-input"]')?.value ?? '',
      startMsValue: get('[data-testid="workbench-start-input"]')?.value ?? '',
      feedbackStatePointId: attr(
        '[data-testid="workbench-action-edit-feedback"]',
        'data-runtime-state-point-id'
      ),
      feedbackOriginStatePointId: attr(
        '[data-testid="workbench-action-edit-feedback"]',
        'data-origin-state-point-id'
      ),
      resultFocused: attr(
        '[data-testid="workbench-action-edit-feedback"]',
        'data-result-focused'
      ),
      returnButtonText: text(returnButtonSelector),
      returnButtonStatePointId: attr(
        returnButtonSelector,
        'data-state-point-id'
      ),
      pageOverflowX: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth
      ),
    };
  }, returnButtonTestId);
}

async function readPageOverflowX(page) {
  return await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
  );
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
