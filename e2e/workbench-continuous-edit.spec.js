import { expect, test } from '@playwright/test';

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

test('runs the visible curve-log-detail edit loop end to end', async ({
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
  expectRuntimeStatePointSynced(openedState, openedState.statePointId);

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

  const logRow = page
    .locator(
      `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${openedState.statePointId}"]`
    )
    .first();
  await logRow.click();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source', 'event-log-runtime-row');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toHaveAttribute('data-runtime-review-source-kind', 'log');
  await expectCurveAndLogSelection(page, openedState.statePointId);

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '24',
    msValue: '400',
    originStatePointId: openedState.statePointId,
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });

  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', returnedState.statePointId);

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

test('keeps runtime result flow usable after deleting the focused action', async ({
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

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps the edit result loop usable at a narrow viewport', async ({
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

  await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '18',
    msValue: '300',
    originStatePointId: narrowRuntimeState.statePointId,
    selected: true,
  });

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
  }
) {
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
