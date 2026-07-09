import { expect, test } from '@playwright/test';

test('keeps the continuous edit result loop synced in the browser', async ({
  page,
}) => {
  const browserIssues = [];
  page.on('console', message => {
    if (['error', 'warning'].includes(message.type())) {
      browserIssues.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'action-edit'
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0001'
  );
  expect(await readWorkbenchState(page)).toMatchObject({
    phase: 'runtime-result',
    actionId: 'action-0001',
    runtimeDetailActionId: 'action-0001',
    contributionActionId: 'action-0001',
    pageOverflowX: 0,
  });

  await page.getByTestId('workbench-add-action').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0002'
  );
  const insertedState = await readWorkbenchState(page);
  expect(insertedState).toMatchObject({
    phase: 'runtime-result',
    actionId: 'action-0002',
    runtimeDetailActionId: 'action-0002',
    contributionActionId: 'action-0002',
    navigationCount: '2',
    navigationIndex: '1',
    pageOverflowX: 0,
  });
  expect(insertedState.statePointId).toContain('action-0002');
  expect(insertedState.curveStatePointId).toBe(insertedState.statePointId);
  expect(insertedState.logStatePointId).toBe(insertedState.statePointId);
  expect(insertedState.hpContributionStatePointId).toBe(
    insertedState.statePointId
  );

  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .getByTestId('workbench-copy-action')
    .click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0003'
  );
  const copiedState = await readWorkbenchState(page);
  expect(copiedState).toMatchObject({
    phase: 'runtime-result',
    actionId: 'action-0003',
    runtimeDetailActionId: 'action-0003',
    contributionActionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    pageOverflowX: 0,
  });
  expect(copiedState.statePointId).toContain('action-0003');
  expect(copiedState.statePointId).not.toBe(insertedState.statePointId);
  expect(copiedState.curveStatePointId).toBe(copiedState.statePointId);
  expect(copiedState.logStatePointId).toBe(copiedState.statePointId);
  expect(copiedState.hpContributionStatePointId).toBe(copiedState.statePointId);

  await page
    .getByTestId('workbench-runtime-selected-detail-action-focus')
    .click();
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-origin', 'runtime-focus');

  await page.getByTestId('workbench-start-frame-input').fill('186');
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-ready'
  );
  const editState = await readEditState(page);
  expect(editState).toMatchObject({
    actionId: 'action-0003',
    phase: 'edit-result-ready',
    resultFocused: 'false',
    startFrameValue: '186',
    startMsValue: '3100',
    returnButtonText: '查看刷新结果',
    pageOverflowX: 0,
  });
  expect(editState.feedbackOriginStatePointId).toBe(copiedState.statePointId);
  expect(editState.feedbackStatePointId).toContain('action-0003');
  expect(editState.feedbackStatePointId).not.toBe(copiedState.statePointId);
  expect(editState.returnButtonStatePointId).toBe(
    editState.feedbackStatePointId
  );

  await page.getByTestId('workbench-flow-return-edit-result').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'edit-result-review'
  );
  const refreshedState = await readWorkbenchState(page);
  expect(refreshedState).toMatchObject({
    phase: 'edit-result-review',
    actionId: 'action-0003',
    runtimeDetailActionId: 'action-0003',
    contributionActionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    hpContributionActive: 'true',
    pageOverflowX: 0,
  });
  expect(refreshedState.statePointId).toBe(editState.feedbackStatePointId);
  expect(refreshedState.curveStatePointId).toBe(editState.feedbackStatePointId);
  expect(refreshedState.logStatePointId).toBe(editState.feedbackStatePointId);
  expect(refreshedState.hpContributionStatePointId).toBe(
    editState.feedbackStatePointId
  );

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
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0001'
  );
  const firstActionState = await readWorkbenchState(page);
  expect(firstActionState).toMatchObject({
    phase: 'runtime-result',
    actionId: 'action-0001',
    runtimeDetailActionId: 'action-0001',
    contributionActionId: 'action-0001',
    navigationCount: '3',
    navigationIndex: '0',
    hpContributionActive: 'true',
    selectedTimelineActionId: 'action-0001',
    pageOverflowX: 0,
  });
  expect(firstActionState.statePointId).toBe(firstActionStatePointId);
  expect(firstActionState.curveStatePointId).toBe(firstActionStatePointId);
  expect(firstActionState.logStatePointId).toBe(firstActionStatePointId);
  expect(firstActionState.hpContributionStatePointId).toBe(
    firstActionStatePointId
  );
  expect(firstActionState.selectedActionListId).toBe('action-0001');
  await expect(firstActionResultRow).toHaveAttribute(
    'data-result-location-status',
    'selected-result'
  );
  await expect(firstActionResultRow).toHaveAttribute(
    'data-selected-state-point-id',
    firstActionStatePointId
  );

  await page.locator('.action-item[data-action-id="action-0003"]').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0003'
  );
  const actionListJumpState = await readWorkbenchState(page);
  expect(actionListJumpState).toMatchObject({
    phase: 'edit-result-review',
    actionId: 'action-0003',
    runtimeDetailActionId: 'action-0003',
    contributionActionId: 'action-0003',
    navigationCount: '3',
    navigationIndex: '2',
    hpContributionActive: 'true',
    selectedActionListId: 'action-0003',
    selectedTimelineActionId: 'action-0003',
    pageOverflowX: 0,
  });
  expect(actionListJumpState.statePointId).toContain('action-0003');
  expect(actionListJumpState.curveStatePointId).toBe(
    actionListJumpState.statePointId
  );
  expect(actionListJumpState.logStatePointId).toBe(
    actionListJumpState.statePointId
  );
  expect(actionListJumpState.hpContributionStatePointId).toBe(
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
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-detail-action-id',
    'action-0002'
  );
  const timelineJumpState = await readWorkbenchState(page);
  expect(timelineJumpState).toMatchObject({
    phase: 'runtime-result',
    actionId: 'action-0002',
    runtimeDetailActionId: 'action-0002',
    contributionActionId: 'action-0002',
    navigationCount: '3',
    navigationIndex: '1',
    hpContributionActive: 'true',
    selectedActionListId: 'action-0002',
    selectedTimelineActionId: 'action-0002',
    pageOverflowX: 0,
  });
  expect(timelineJumpState.statePointId).toContain('action-0002');
  expect(timelineJumpState.curveStatePointId).toBe(
    timelineJumpState.statePointId
  );
  expect(timelineJumpState.logStatePointId).toBe(
    timelineJumpState.statePointId
  );
  expect(timelineJumpState.hpContributionStatePointId).toBe(
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
  expect(browserIssues.filter(issue => !isExpectedBrowserIssue(issue))).toEqual(
    []
  );
});

function isExpectedBrowserIssue(issue) {
  return (
    issue.includes('[intlify] Legacy API mode has been deprecated in v11') ||
    issue.includes(
      'Failed to load resource: the server responded with a status of 404'
    )
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

async function readEditState(page) {
  return await page.evaluate(() => {
    const get = selector => document.querySelector(selector);
    const attr = (selector, name) => get(selector)?.getAttribute(name) ?? '';
    const text = selector => get(selector)?.textContent?.trim() ?? '';
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
      returnButtonText: text(
        '[data-testid="workbench-flow-return-edit-result"]'
      ),
      returnButtonStatePointId: attr(
        '[data-testid="workbench-flow-return-edit-result"]',
        'data-state-point-id'
      ),
      pageOverflowX: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth
      ),
    };
  });
}
