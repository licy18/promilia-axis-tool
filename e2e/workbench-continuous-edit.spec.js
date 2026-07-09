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
  await expectRuntimeSimLogHitAggregateContributions(page);

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
  });

  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeSimLogHitAggregateContributions(page);
  await expect(
    page.locator(
      '[data-testid="workbench-action-result-source-row"][data-action-id="action-0001"]'
    )
  ).toHaveAttribute('data-selected-state-point-id', returnedState.statePointId);

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

test('keeps multi-action resource chart navigation tied to middle edit return', async ({
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
    frameValue: '168',
    msValue: '2800',
    originStatePointId: selectedMiddleState.statePointId,
    navigationCount: '3',
    navigationIndex: '1',
    selected: true,
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

test('keeps contribution navigation tied to multi-action edit return', async ({
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
    frameValue: '174',
    msValue: '2900',
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

test('keeps result review entrances interchangeable before edit return', async ({
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
    frameValue: '180',
    msValue: '3000',
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

test('keeps action list, timeline nudge, frame step, and result return in one loop', async ({
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
      '[data-testid="workbench-start-frame-step"][data-step-direction="increase"]'
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
    Number(timelineNudgeEditState.startFrameValue) + 1
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

test('keeps saved draft restore tied to runtime result selection', async ({
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

  expectNoUnexpectedBrowserIssues(browserIssues);
});

test('keeps reset draft usable for a fresh runtime edit loop', async ({
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

  await page.getByTestId('workbench-reset-draft').click();
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

test('keeps runtime result flow usable after deleting a generated action batch', async ({
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

  await page.getByTestId('workbench-flow-open-runtime').click();
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

  await focusRuntimeDetailAction(page);
  const { returnedState } = await editCurrentActionFrameAndReturn(page, {
    actionId: 'action-0001',
    frameValue: '18',
    msValue: '300',
    originStatePointId: fallbackState.statePointId,
    navigationCount: '1',
    navigationIndex: '0',
    selected: true,
  });
  await expectCurveAndLogSelection(page, returnedState.statePointId);
  await expectRuntimeOutputConsistent(page);

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
  await expectRuntimeOutputConsistent(page);

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
  await action.press('ArrowRight');
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
    const rawDraft = window.localStorage.getItem(
      'promilia-axis-tool:workbench-draft:v1'
    );
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
      'hit-aggregate'
    );
    await expect(row).toContainText(expectedRow.label);
    if (expectedRow.positive) {
      const value = Number(await row.getAttribute('data-value'));
      expect(value).toBeGreaterThan(0);
    }
  }
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
