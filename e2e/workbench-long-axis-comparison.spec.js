import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import {
  LONG_AXIS_ACTION_COUNT,
  WORKBENCH_DRAFT_STORAGE_KEY,
  createLongAxisComparisonSnapshot,
} from './helpers/workbench-long-axis-fixture';

const INITIAL_READY_BUDGET_MS = 15_000;
const COMPARISON_OPEN_BUDGET_MS = 8_000;
const WINDOW_SWITCH_BUDGET_MS = 3_000;
const BASELINE_LOCATE_BUDGET_MS = 3_000;

test('compares two 120-action cycle windows and opens the baseline @workbench-comparison-long-axis', async ({
  page,
}, testInfo) => {
  const snapshot = createLongAxisComparisonSnapshot();
  await page.addInitScript(
    ({ storageKey, storageValue }) => {
      localStorage.setItem(storageKey, storageValue);
    },
    {
      storageKey: WORKBENCH_DRAFT_STORAGE_KEY,
      storageValue: JSON.stringify(snapshot),
    }
  );

  const initialStartedAt = Date.now();
  await page.goto('/#/workbench');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    `${LONG_AXIS_ACTION_COUNT} action`
  );
  const initialReadyMs = Date.now() - initialStartedAt;
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0002'
  );

  const comparisonStartedAt = Date.now();
  await page.getByTestId('workbench-open-comparison').click();
  await page
    .getByTestId('workbench-comparison-workspace-scenario')
    .selectOption('scenario-0001');
  const comparison = page.getByTestId('workbench-scenario-comparison');
  const actionRows = comparison.getByTestId('workbench-comparison-action-row');
  await expect(actionRows).toHaveCount(LONG_AXIS_ACTION_COUNT);
  const comparisonOpenMs = Date.now() - comparisonStartedAt;
  await expect(
    comparison.getByTestId('workbench-comparison-window')
  ).toHaveCount(3);
  await expect(
    comparison.getByTestId('workbench-comparison-actor-row')
  ).toHaveCount(3);

  const windowStartedAt = Date.now();
  const secondWindow = comparison.locator(
    '[data-testid="workbench-comparison-window"][data-window-id="cycle-section-02"]'
  );
  await secondWindow.click();
  await expect(secondWindow).toHaveClass(/active/);
  await expect(actionRows).toHaveCount(60);
  const windowSwitchMs = Date.now() - windowStartedAt;

  const baselineActionId = 'browser-long-axis-action-0080';
  const baselineAction = comparison.locator(
    `[data-testid="workbench-comparison-action-row"][data-baseline-action-id="${baselineActionId}"]`
  );
  const locateBaseline = baselineAction.getByTestId(
    'workbench-comparison-locate-baseline-action'
  );
  const baselineStatePointId = await locateBaseline.getAttribute(
    'data-state-point-id'
  );
  expect(baselineStatePointId).toBeTruthy();
  const locateStartedAt = Date.now();
  await locateBaseline.click();
  await expect(comparison).toBeHidden();
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0001'
  );
  await expect(
    page.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${baselineActionId}"]`
    )
  ).toHaveClass(/selected/);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(baselineStatePointId);
  const baselineLocateMs = Date.now() - locateStartedAt;

  await page.evaluate(() => {
    window.location.hash = '#/guide';
  });
  await expect(page.locator('main.workbench')).toHaveCount(0);
  await expect(page.getByTestId('workbench-scenario-comparison')).toHaveCount(
    0
  );

  const metrics = {
    actionCountPerScenario: LONG_AXIS_ACTION_COUNT,
    scenarioCount: 2,
    initialReadyMs,
    comparisonOpenMs,
    fullAxisActionRowCount: LONG_AXIS_ACTION_COUNT,
    cycleWindowActionRowCount: 60,
    windowSwitchMs,
    baselineLocateMs,
    budgets: {
      initialReadyMs: INITIAL_READY_BUDGET_MS,
      comparisonOpenMs: COMPARISON_OPEN_BUDGET_MS,
      windowSwitchMs: WINDOW_SWITCH_BUDGET_MS,
      baselineLocateMs: BASELINE_LOCATE_BUDGET_MS,
    },
  };
  const report = {
    schemaVersion: 1,
    kind: 'workbench-long-axis-comparison-browser-benchmark',
    generatedAt: new Date().toISOString(),
    environment: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    })),
    metrics,
    status: {
      initialReadyWithinBudget: initialReadyMs < INITIAL_READY_BUDGET_MS,
      comparisonOpenWithinBudget: comparisonOpenMs < COMPARISON_OPEN_BUDGET_MS,
      windowSwitchWithinBudget: windowSwitchMs < WINDOW_SWITCH_BUDGET_MS,
      baselineLocateWithinBudget: baselineLocateMs < BASELINE_LOCATE_BUDGET_MS,
      cleanedUp: true,
    },
  };
  await writeFile(
    new URL(
      '../reports/long-axis-comparison-browser-benchmark.json',
      import.meta.url
    ),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await testInfo.attach('long-axis-comparison-browser-metrics.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  // eslint-disable-next-line no-console
  console.log(`LONG_AXIS_COMPARISON_METRICS ${JSON.stringify(metrics)}`);

  expect(initialReadyMs).toBeLessThan(INITIAL_READY_BUDGET_MS);
  expect(comparisonOpenMs).toBeLessThan(COMPARISON_OPEN_BUDGET_MS);
  expect(windowSwitchMs).toBeLessThan(WINDOW_SWITCH_BUDGET_MS);
  expect(baselineLocateMs).toBeLessThan(BASELINE_LOCATE_BUDGET_MS);
});
