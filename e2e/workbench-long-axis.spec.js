import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import {
  LONG_AXIS_ACTION_COUNT,
  WORKBENCH_DRAFT_STORAGE_KEY,
  createLongAxisSnapshot,
} from './helpers/workbench-long-axis-fixture';

const BROWSER_READY_BUDGET_MS = 15_000;
const PLAYBACK_ADVANCE_BUDGET_MS = 3_000;

test('loads and reviews a 120-action Workbench project @workbench-long-axis', async ({
  page,
}, testInfo) => {
  const snapshot = createLongAxisSnapshot();
  await page.addInitScript(
    ({ storageKey, storageValue }) => {
      localStorage.setItem(storageKey, storageValue);
    },
    {
      storageKey: WORKBENCH_DRAFT_STORAGE_KEY,
      storageValue: JSON.stringify(snapshot),
    }
  );
  await page.addInitScript(() => {
    const originalRequestAnimationFrame =
      window.requestAnimationFrame.bind(window);
    const originalCancelAnimationFrame =
      window.cancelAnimationFrame.bind(window);
    const timelineFrameIds = new Set();
    window.__timelinePlaybackRafAudit = {
      requested: 0,
      canceled: 0,
      active: 0,
    };
    window.requestAnimationFrame = callback => {
      const stack = new Error().stack ?? '';
      const isTimelinePlayback =
        stack.includes('scheduleTimelinePlaybackFrame') ||
        stack.includes('advanceTimelinePlaybackClock');
      let frameId = 0;
      frameId = originalRequestAnimationFrame(timestamp => {
        if (timelineFrameIds.delete(frameId)) {
          window.__timelinePlaybackRafAudit.active -= 1;
        }
        callback(timestamp);
      });
      if (isTimelinePlayback) {
        timelineFrameIds.add(frameId);
        window.__timelinePlaybackRafAudit.requested += 1;
        window.__timelinePlaybackRafAudit.active += 1;
      }
      return frameId;
    };
    window.cancelAnimationFrame = frameId => {
      if (timelineFrameIds.delete(frameId)) {
        window.__timelinePlaybackRafAudit.canceled += 1;
        window.__timelinePlaybackRafAudit.active -= 1;
      }
      return originalCancelAnimationFrame(frameId);
    };
  });

  const startedAt = Date.now();
  await page.goto('/#/workbench');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    `${LONG_AXIS_ACTION_COUNT} action`
  );
  const readyMs = Date.now() - startedAt;

  await expect(page.locator('.action-item')).toHaveCount(
    LONG_AXIS_ACTION_COUNT
  );
  await expect(page.getByTestId('workbench-timeline-action')).toHaveCount(
    LONG_AXIS_ACTION_COUNT
  );
  await expect(
    page.getByTestId('workbench-action-result-source-row')
  ).toHaveCount(LONG_AXIS_ACTION_COUNT);
  const stateCurvePointCount = await page
    .getByTestId('workbench-state-curve-point')
    .count();
  expect(stateCurvePointCount).toBeGreaterThanOrEqual(LONG_AXIS_ACTION_COUNT);

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'runtime-result'
  );
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-runtime-navigation-count',
    String(LONG_AXIS_ACTION_COUNT)
  );

  const workbench = page.locator('main.workbench');
  const timelineViewport = page.getByTestId('workbench-timeline-viewport');
  const scaleViewport = page.getByTestId('workbench-timeline-scale-viewport');
  const zoomInput = page.getByTestId('workbench-timeline-zoom-input');
  await zoomInput.evaluate(element => {
    element.value = '4';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-id="browser-long-axis-action-0080"]'
    )
    .click();
  const playbackStartFrame = Number(
    await workbench.getAttribute('data-timeline-cursor-frame-index')
  );
  const playbackStartScroll = await timelineViewport.evaluate(
    element => element.scrollLeft
  );
  await page.getByTestId('workbench-timeline-playback-rate').selectOption('2');
  await page.getByTestId('workbench-timeline-playback-toggle').click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-playback-running',
    'true'
  );
  await expect
    .poll(
      async () =>
        Number(
          await workbench.getAttribute('data-timeline-cursor-frame-index')
        ),
      { timeout: PLAYBACK_ADVANCE_BUDGET_MS }
    )
    .toBeGreaterThan(playbackStartFrame + 5);
  const playbackEndFrame = Number(
    await workbench.getAttribute('data-timeline-cursor-frame-index')
  );
  await expect
    .poll(async () => timelineViewport.evaluate(element => element.scrollLeft))
    .toBeGreaterThan(playbackStartScroll);
  const playbackEndScroll = await timelineViewport.evaluate(
    element => element.scrollLeft
  );
  await expect
    .poll(async () => {
      const [timelineScroll, scaleScroll] = await Promise.all([
        timelineViewport.evaluate(element => element.scrollLeft),
        scaleViewport.evaluate(element => element.scrollLeft),
      ]);
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);

  await page.getByTestId('workbench-timeline-playback-toggle').click();
  const pausedFrame = await workbench.getAttribute(
    'data-timeline-cursor-frame-index'
  );
  await page.waitForTimeout(150);
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    pausedFrame
  );

  await page.getByTestId('workbench-timeline-playback-toggle').click();
  await expect
    .poll(() => readTimelinePlaybackRafAudit(page))
    .toMatchObject({ active: 1 });
  await page.evaluate(() => {
    window.location.hash = '#/guide';
  });
  await expect(page.locator('main.workbench')).toHaveCount(0);
  await expect
    .poll(() => readTimelinePlaybackRafAudit(page))
    .toMatchObject({ active: 0 });
  const playbackRafAudit = await readTimelinePlaybackRafAudit(page);
  expect(playbackRafAudit.requested).toBeGreaterThan(0);
  expect(playbackRafAudit.canceled).toBeGreaterThan(0);

  const metrics = {
    actionCount: LONG_AXIS_ACTION_COUNT,
    stateCurvePointCount,
    readyMs,
    budgetMs: BROWSER_READY_BUDGET_MS,
    playback: {
      startFrame: playbackStartFrame,
      endFrame: playbackEndFrame,
      advancedFrames: playbackEndFrame - playbackStartFrame,
      startScrollLeft: playbackStartScroll,
      endScrollLeft: playbackEndScroll,
      scrollDelta: playbackEndScroll - playbackStartScroll,
      rate: 2,
      advanceBudgetMs: PLAYBACK_ADVANCE_BUDGET_MS,
      raf: playbackRafAudit,
    },
  };
  const report = {
    schemaVersion: 1,
    kind: 'workbench-long-axis-browser-benchmark',
    generatedAt: new Date().toISOString(),
    environment: await page.evaluate(() => ({
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    })),
    metrics,
    status: {
      readyWithinBudget: readyMs < BROWSER_READY_BUDGET_MS,
      playbackAdvanced: metrics.playback.advancedFrames > 5,
      playbackScrolled: metrics.playback.scrollDelta > 0,
      playbackCleanedUp:
        playbackRafAudit.active === 0 && playbackRafAudit.canceled > 0,
    },
  };
  await writeFile(
    new URL('../reports/long-axis-browser-benchmark.json', import.meta.url),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  await testInfo.attach('long-axis-browser-metrics.json', {
    body: Buffer.from(JSON.stringify(report, null, 2)),
    contentType: 'application/json',
  });
  // eslint-disable-next-line no-console
  console.log(`LONG_AXIS_BROWSER_METRICS ${JSON.stringify(metrics)}`);
  expect(readyMs).toBeLessThan(BROWSER_READY_BUDGET_MS);
});

async function readTimelinePlaybackRafAudit(page) {
  return page.evaluate(() => ({ ...window.__timelinePlaybackRafAudit }));
}
