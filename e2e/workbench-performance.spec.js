import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const CAPTURE_ONLY = process.env.PROMILIA_PERF_CAPTURE_ONLY === '1';
const REPORT_PATH = resolve(
  process.env.PROMILIA_PERF_REPORT ??
    'reports/m9-r3-r3-workbench-performance-after.json'
);
const DESKTOP_SCREENSHOT_PATH = resolve(
  process.env.PROMILIA_PERF_DESKTOP_SCREENSHOT ??
    'reports/m9-r3-r3-workbench-performance-desktop.png'
);
const NARROW_SCREENSHOT_PATH = resolve(
  process.env.PROMILIA_PERF_NARROW_SCREENSHOT ??
    'reports/m9-r3-r3-workbench-performance-narrow.png'
);
const WRITE_SCREENSHOTS =
  !CAPTURE_ONLY && process.env.PROMILIA_PERF_SCREENSHOTS !== '0';
const BUILD_FIXTURE = process.env.PROMILIA_PERF_BUILD_FIXTURE === '1';
const FIXTURE_PATH = resolve('e2e/fixtures/m9-r3-r3-workbench-draft.json');
const FIXTURE_EXPORT_PATH = process.env.PROMILIA_PERF_FIXTURE_EXPORT
  ? resolve(process.env.PROMILIA_PERF_FIXTURE_EXPORT)
  : '';

const THRESHOLDS = Object.freeze({
  elementCount: 20_000,
  liveNodeCount: 50_000,
  mountedRowsPerList: 200,
  idleTaskDurationMs: 100,
  interactionP95Ms: 150,
  maximumLongTaskMs: 1_000,
  pointerPreviewEvaluations: 1,
  authoritativeCompilePerCommit: 1,
  authoritativeSimulationPerCommit: 1,
});

test('[m9-r3-r3-workbench-performance] bounds production DOM and edit recomputation', async ({
  page,
  browserName,
}) => {
  test.setTimeout(180_000);
  await installLongTaskObserver(page);
  if (!BUILD_FIXTURE) {
    await seedPerformanceFixture(page);
  }
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench?workbench-perf=1');
  await markPerformancePhase(page, 'workbench-loaded');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(timeline).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('main.workbench')
        .getAttribute('data-runtime-diagnostics-revision')
        .then(Number)
    )
    .toBeGreaterThan(0);
  await markPerformancePhase(page, 'runtime-diagnostics-ready');

  if (BUILD_FIXTURE) {
    await markPerformancePhase(page, 'fixture-start');
    await createPerformanceFixture(page, timeline);
    await exportPerformanceFixture(page);
  }
  await markPerformancePhase(page, 'fixture-ready');
  await openWorstCaseReviewSurface(page);
  await waitForWorkbenchToSettle(page);
  await markPerformancePhase(page, 'measurement-ready');

  const fixture = await readFixtureSummary(page, timeline);
  expect(fixture.uniqueActionCount).toBe(7);
  expect(fixture.actorLaneCount).toBe(3);
  expect(fixture.durationMs).toBe(120_000);
  expect(fixture.maximumSimulationPointCount).toBeGreaterThanOrEqual(1_200);

  const openMetrics = await collectPageMetrics(page, cdp);
  const idleMetrics = await measureIdleStability(page, cdp, openMetrics);
  const inspectorClosedMetrics = await closeInspectorAndMeasure(page, cdp);
  const navigation = await measureReviewNavigation(page);
  const dragEvaluation = await measurePointerPreviewAndCommit(page, timeline);

  await restoreScreenshotSurface(page);
  const screenshotMetrics = await collectPageMetrics(page, cdp);
  if (WRITE_SCREENSHOTS) {
    await mkdir(dirname(DESKTOP_SCREENSHOT_PATH), { recursive: true });
    await page.screenshot({
      path: DESKTOP_SCREENSHOT_PATH,
      fullPage: false,
    });
  }

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await timeline.scrollIntoViewIfNeeded();
  const narrowOverflow = await readPageHorizontalOverflow(page);
  if (WRITE_SCREENSHOTS) {
    await page.screenshot({
      path: NARROW_SCREENSHOT_PATH,
      fullPage: false,
    });
  }

  const longTasks = await page.evaluate(
    () => window.__PROMILIA_LONG_TASKS__ ?? []
  );
  const phases = await page.evaluate(
    () => window.__PROMILIA_PERF_PHASES__ ?? []
  );
  const interactionDurations = navigation.interactionDurationsMs;
  const interactionP95Ms = percentile(interactionDurations, 0.95);
  const maximumLongTaskMs = Math.max(
    0,
    ...longTasks.map(entry => Number(entry.duration) || 0)
  );
  const decision = createDecision({
    openMetrics,
    idleMetrics,
    interactionP95Ms,
    maximumLongTaskMs,
    dragEvaluation,
    narrowOverflowPx: narrowOverflow.overflowPx,
  });
  const report = {
    schemaVersion: 1,
    kind: 'm9-r3-r3-workbench-performance',
    capturedAt: new Date().toISOString(),
    source: {
      baselineCommit: 'cb13eef',
      testedRevision:
        process.env.PROMILIA_PERF_COMMIT ?? 'm9-r3-r3-working-tree',
      captureOnly: CAPTURE_ONLY,
    },
    environment: {
      browserName,
      browserVersion: await page.evaluate(() => navigator.userAgent),
      viewport: { width: 1440, height: 900 },
      productionPreview: true,
    },
    fixture,
    thresholds: THRESHOLDS,
    metrics: {
      inspectorOpen: openMetrics,
      inspectorClosed: inspectorClosedMetrics,
      screenshotSurface: screenshotMetrics,
      idle: idleMetrics,
      interactionDurationsMs: interactionDurations,
      interactionP95Ms,
      maximumLongTaskMs,
      longTaskCount: longTasks.length,
      navigationCounters: navigation.counters,
      dragEvaluation,
      longTasks: [...longTasks]
        .sort((left, right) => right.duration - left.duration)
        .slice(0, 20),
      phases,
      narrowOverflow,
    },
    decision,
  };

  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (!CAPTURE_ONLY) {
    expect(decision.failures).toEqual([]);
  }
});

async function createPerformanceFixture(page, timeline) {
  await markPerformancePhase(page, 'scenario-add-start');
  await page.getByTestId('workbench-scenario-add').click();
  await markPerformancePhase(page, 'scenario-add-end');
  await markPerformancePhase(page, 'duration-change-start');
  await timeline
    .getByTestId('workbench-timeline-duration-select')
    .selectOption('120000');
  await expect(timeline).toHaveAttribute('data-duration-ms', '120000');
  await markPerformancePhase(page, 'duration-change-end');
  await markPerformancePhase(page, 'team-change-start');
  await changeTeamSlot(page, 0, 101010);
  await markPerformancePhase(page, 'team-change-end');
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
    .click();

  const actorEnergy = timeline.locator(
    '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101010"]'
  );
  await markPerformancePhase(page, 'initial-energy-change-start');
  await actorEnergy.fill('100');
  await actorEnergy.press('Enter');
  await markPerformancePhase(page, 'initial-energy-change-end');
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
    )
    .click();

  const normalAttack = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101001"][data-action-kind="normal-attack"]'
  );
  const chargedAttack = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101001"][data-action-kind="charged-attack"]'
  );
  const ultimate = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101013"][data-action-kind="ultimate"]'
  );
  const starSkill = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101012"][data-action-kind="star-skill"]'
  );

  await addActionAndWait(page, ultimate, 1, 'ultimate');
  await addActionAndWait(page, normalAttack, 4, 'burst-normal-chain');
  await addActionAndWait(page, chargedAttack, 5, 'burst-derived-charged');
  await addActionAndWait(page, starSkill, 6, 'star-skill');
  await addActionAndWait(page, chargedAttack, 7, 'hidden-derived-charged');

  const actions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-derived-action-kind=""]'
  );
  await expect(actions).toHaveCount(7);
  await actions.last().click();
}

async function seedPerformanceFixture(page) {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  await page.addInitScript(({ storageKey, draft }) => {
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, fixture);
}

async function exportPerformanceFixture(page) {
  if (!FIXTURE_EXPORT_PATH) return;
  await page.getByTestId('workbench-save-draft').click();
  const fixture = await page.evaluate(() => {
    const storageKey = Object.keys(window.localStorage).find(key =>
      key.startsWith('promilia-axis-tool:workbench-draft:')
    );
    return {
      storageKey,
      draft: storageKey
        ? JSON.parse(window.localStorage.getItem(storageKey))
        : null,
    };
  });
  expect(fixture.storageKey).toBeTruthy();
  expect(fixture.draft).toBeTruthy();
  await mkdir(dirname(FIXTURE_EXPORT_PATH), { recursive: true });
  await writeFile(
    FIXTURE_EXPORT_PATH,
    `${JSON.stringify(fixture, null, 2)}\n`,
    'utf8'
  );
}

async function addActionAndWait(page, entry, expectedCount, phase) {
  await markPerformancePhase(page, `${phase}-start`);
  await entry.click();
  await expect
    .poll(() => readUniqueProjectActionIds(page).then(ids => ids.length))
    .toBe(expectedCount);
  await markPerformancePhase(page, `${phase}-end`);
}

async function changeTeamSlot(page, slotIndex, characterId) {
  const lane = page.locator(
    `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-${slotIndex + 1}"]`
  );
  await lane.getByTestId('workbench-direct-character-picker').click();
  const picker = page.getByTestId('workbench-loadout-picker');
  await expect(picker).toBeVisible();
  await picker
    .locator(
      `[data-testid="workbench-loadout-option"][data-option-id="${characterId}"]`
    )
    .click();
  await expect(picker).toBeHidden();
}

async function openWorstCaseReviewSurface(page) {
  const eventTab = page.locator(
    '[data-testid="workbench-runtime-review-tab"][data-review-tab="event"]'
  );
  if (await eventTab.count()) {
    await eventTab.click();
  }
  const analysisTab = page.locator(
    '[data-testid="workbench-side-inspector-tab"][data-inspector-panel="analysis"]'
  );
  if (await analysisTab.count()) {
    await analysisTab.click();
  }
}

async function restoreScreenshotSurface(page) {
  const lastAction = page
    .locator(
      '[data-testid="workbench-timeline-action"][data-derived-action-kind=""]'
    )
    .last();
  await lastAction.click();
  await openWorstCaseReviewSurface(page);
  await page
    .getByTestId('workbench-timeline-grid-preview')
    .scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await waitForWorkbenchToSettle(page);
}

async function closeInspectorAndMeasure(page, cdp) {
  await closeInspectorIfVisible(page);
  await waitForWorkbenchToSettle(page);
  return collectPageMetrics(page, cdp);
}

async function closeInspectorIfVisible(page) {
  const inspector = page.getByTestId('workbench-side-inspector');
  if (await inspector.isVisible()) {
    await page.getByTestId('workbench-close-side-inspector').click();
    await expect(inspector).toBeHidden();
  }
}

async function measureReviewNavigation(page) {
  const instrumentation = await readPerformanceInstrumentation(page);
  if (!instrumentation) {
    return {
      counters: null,
      interactionDurationsMs: [],
    };
  }
  await page.evaluate(() => window.__PROMILIA_WORKBENCH_PERF__.reset());
  const interactionDurationsMs = [];
  const tabs = [
    page.locator(
      '[data-testid="workbench-runtime-review-tab"][data-review-tab="resource"]'
    ),
    page.locator(
      '[data-testid="workbench-runtime-review-tab"][data-review-tab="event"]'
    ),
    page.locator(
      '[data-testid="workbench-side-inspector-tab"][data-inspector-panel="runtime-detail"]'
    ),
    page.locator(
      '[data-testid="workbench-side-inspector-tab"][data-inspector-panel="analysis"]'
    ),
  ];
  for (const tab of tabs) {
    if (await tab.count()) {
      interactionDurationsMs.push(await clickAndMeasurePaint(page, tab));
    }
  }
  await page.getByTestId('workbench-timeline-viewport').evaluate(element => {
    element.scrollLeft += 240;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await waitForAnimationFrames(page, 2);
  return {
    counters: await readPerformanceInstrumentation(page),
    interactionDurationsMs,
  };
}

async function measurePointerPreviewAndCommit(page, timeline) {
  const instrumentation = await readPerformanceInstrumentation(page);
  if (!instrumentation) {
    return {
      available: false,
      previewCounters: null,
      commitCounters: null,
    };
  }
  const source = page.getByTestId('workbench-add-switch-action');
  const lane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101010"]'
  );
  await source.scrollIntoViewIfNeeded();
  await lane.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const laneBox = await lane.boundingBox();
  expect(sourceBox).toBeTruthy();
  expect(laneBox).toBeTruthy();
  const point = {
    sourceX: sourceBox.x + sourceBox.width / 2,
    sourceY: sourceBox.y + sourceBox.height / 2,
    targetX: Math.min(laneBox.x + laneBox.width - 24, laneBox.x + 520),
    targetY: laneBox.y + laneBox.height / 2,
  };

  await page.evaluate(() => window.__PROMILIA_WORKBENCH_PERF__.reset());
  await source.evaluate((element, coordinates) => {
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 1,
        pointerId: 91,
        clientX: coordinates.sourceX,
        clientY: coordinates.sourceY,
      })
    );
  }, point);
  await page.evaluate(coordinates => {
    for (let index = 0; index < 60; index += 1) {
      window.dispatchEvent(
        new PointerEvent('pointermove', {
          bubbles: true,
          cancelable: true,
          buttons: 1,
          pointerId: 91,
          clientX: coordinates.targetX + (index % 2) * 0.05,
          clientY: coordinates.targetY,
        })
      );
    }
  }, point);
  await waitForAnimationFrames(page, 3);
  const previewCounters = await readPerformanceInstrumentation(page);

  await page.evaluate(coordinates => {
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: 0,
        pointerId: 91,
        clientX: coordinates.targetX,
        clientY: coordinates.targetY,
      })
    );
  }, point);
  await expect
    .poll(() =>
      readPerformanceInstrumentation(page).then(
        counters => counters?.authoritativeCompile ?? 0
      )
    )
    .toBeGreaterThanOrEqual(1);
  const commitCounters = await readPerformanceInstrumentation(page);

  return {
    available: true,
    pointerMoveCount: 60,
    previewCounters,
    commitCounters,
  };
}

async function readFixtureSummary(page, timeline) {
  const actionIds = await readUniqueProjectActionIds(page);
  const curveRows = timeline.locator(
    '[data-testid="workbench-timeline-state-curve"]'
  );
  const simulationPointCounts = await curveRows.evaluateAll(elements =>
    elements.map(element =>
      Number(element.getAttribute('data-simulation-point-count') || 0)
    )
  );
  return {
    description:
      '3 actors, Xiaoyu burst chain and hidden derivation, 7 actions, 120 seconds',
    uniqueActionCount: actionIds.length,
    actionIds,
    actorLaneCount: await timeline
      .locator(
        '[data-testid="workbench-timeline-row"][data-lane-kind="actor-action"]'
      )
      .count(),
    durationMs: Number(await timeline.getAttribute('data-duration-ms')),
    curveCount: await curveRows.count(),
    maximumSimulationPointCount: Math.max(0, ...simulationPointCounts),
  };
}

async function readUniqueProjectActionIds(page) {
  return page
    .locator(
      '[data-testid="workbench-timeline-action"][data-derived-action-kind=""]'
    )
    .evaluateAll(elements => [
      ...new Set(
        elements
          .map(element => element.getAttribute('data-action-id'))
          .filter(Boolean)
      ),
    ]);
}

async function collectPageMetrics(page, cdp) {
  await collectGarbage(cdp);
  const [domCounters, performanceMetrics, dom] = await Promise.all([
    cdp.send('Memory.getDOMCounters'),
    readCdpPerformanceMetrics(cdp),
    page.evaluate(() => {
      const descendantCount = testId => {
        const element = document.querySelector(`[data-testid="${testId}"]`);
        return element ? element.querySelectorAll('*').length : 0;
      };
      const mountedRows = Array.from(
        document.querySelectorAll('[data-mounted-row-count]')
      ).map(element => ({
        testId: element.getAttribute('data-testid') || '',
        itemCount: Number(element.getAttribute('data-item-count') || 0),
        mountedRowCount: Number(
          element.getAttribute('data-mounted-row-count') || 0
        ),
      }));
      const timelineCurves = Array.from(
        document.querySelectorAll(
          '[data-testid="workbench-timeline-state-curve"]'
        )
      ).map(element => ({
        trackKey: element.getAttribute('data-track-key') || '',
        simulationPointCount: Number(
          element.getAttribute('data-simulation-point-count') || 0
        ),
        displayPointCount: Number(
          element.getAttribute('data-point-count') || 0
        ),
        semanticNodeCount: Number(
          element.getAttribute('data-semantic-node-count') || 0
        ),
      }));
      const resourceCurves = Array.from(
        document.querySelectorAll(
          '[data-testid="workbench-runtime-resource-chart-line"]'
        )
      ).map(element => ({
        trackKey: element.getAttribute('data-track-key') || '',
        sourcePointCount: Number(
          element.getAttribute('data-source-point-count') || 0
        ),
        displayPointCount: Number(
          element.getAttribute('data-display-point-count') || 0
        ),
      }));
      return {
        elementCount: document.querySelectorAll('*').length,
        spanCount: document.querySelectorAll('span').length,
        listItemCount: document.querySelectorAll('li').length,
        buttonCount: document.querySelectorAll('button').length,
        svgCircleCount: document.querySelectorAll('svg circle').length,
        descendants: {
          eventLogPanel: descendantCount('workbench-event-log-panel'),
          sideInspector: descendantCount('workbench-side-inspector'),
          actionResultSources: descendantCount(
            'workbench-action-result-sources'
          ),
          stateCurves: descendantCount('workbench-state-curves'),
          runtimeSimLog: descendantCount('workbench-runtime-sim-log'),
          runtimeResourceMonitor: descendantCount(
            'workbench-runtime-resource-monitor'
          ),
        },
        mountedRows,
        maximumMountedRowCount: Math.max(
          0,
          ...mountedRows.map(row => row.mountedRowCount)
        ),
        timelineCurves,
        resourceCurves,
        playbackRunning:
          document
            .querySelector('main.workbench')
            ?.getAttribute('data-timeline-playback-running') === 'true',
      };
    }),
  ]);
  return {
    ...dom,
    liveNodeCount: Number(domCounters.nodes || 0),
    documentCount: Number(domCounters.documents || 0),
    jsEventListenerCount: Number(domCounters.jsEventListeners || 0),
    taskDurationMs: Number(
      ((performanceMetrics.TaskDuration ?? 0) * 1000).toFixed(3)
    ),
  };
}

async function measureIdleStability(page, cdp, before) {
  await page.waitForTimeout(5_000);
  const after = await collectPageMetrics(page, cdp);
  return {
    durationMs: 5_000,
    beforeElementCount: before.elementCount,
    afterElementCount: after.elementCount,
    elementGrowth: after.elementCount - before.elementCount,
    beforeLiveNodeCount: before.liveNodeCount,
    afterLiveNodeCount: after.liveNodeCount,
    liveNodeGrowth: after.liveNodeCount - before.liveNodeCount,
    taskDurationDeltaMs: Number(
      (after.taskDurationMs - before.taskDurationMs).toFixed(3)
    ),
    playbackRunning: after.playbackRunning,
  };
}

async function readCdpPerformanceMetrics(cdp) {
  const response = await cdp.send('Performance.getMetrics');
  return Object.fromEntries(
    response.metrics.map(metric => [metric.name, metric.value])
  );
}

async function collectGarbage(cdp) {
  try {
    await cdp.send('HeapProfiler.collectGarbage');
  } catch {
    // Browser channel may omit HeapProfiler; DOM counters remain usable.
  }
}

async function readPerformanceInstrumentation(page) {
  return page.evaluate(
    () => window.__PROMILIA_WORKBENCH_PERF__?.snapshot?.() ?? null
  );
}

async function clickAndMeasurePaint(page, locator) {
  const marker = `m9-r3-r3-${Math.random().toString(36).slice(2)}`;
  return locator.evaluate(
    (element, name) =>
      new Promise(resolve => {
        performance.mark(`${name}-start`);
        element.click();
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const start = performance.getEntriesByName(`${name}-start`).at(-1);
            resolve(Number((performance.now() - start.startTime).toFixed(3)));
          });
        });
      }),
    marker
  );
}

async function waitForWorkbenchToSettle(page) {
  await waitForAnimationFrames(page, 3);
  await page.waitForTimeout(100);
}

async function waitForAnimationFrames(page, count) {
  await page.evaluate(
    frameCount =>
      new Promise(resolve => {
        const next = remaining => {
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => next(remaining - 1));
        };
        next(frameCount);
      }),
    count
  );
}

async function installLongTaskObserver(page) {
  await page.addInitScript(() => {
    window.__PROMILIA_LONG_TASKS__ = [];
    window.__PROMILIA_PERF_PHASES__ = [];
    if (typeof PerformanceObserver !== 'function') return;
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          window.__PROMILIA_LONG_TASKS__.push({
            startTime: Number(entry.startTime.toFixed(3)),
            duration: Number(entry.duration.toFixed(3)),
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch {
      // Long-task entries are optional on some browser channels.
    }
  });
}

async function readPageHorizontalOverflow(page) {
  return page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const overflowPx = Math.max(
      0,
      document.documentElement.scrollWidth - viewportWidth
    );
    const isClippedByScrollAncestor = element => {
      let ancestor = element.parentElement;
      const elementRect = element.getBoundingClientRect();
      while (
        ancestor &&
        ancestor !== document.body &&
        ancestor !== document.documentElement
      ) {
        const style = getComputedStyle(ancestor);
        if (/(?:auto|scroll|hidden|clip)/.test(style.overflowX)) {
          const ancestorRect = ancestor.getBoundingClientRect();
          if (
            elementRect.left < ancestorRect.left - 0.5 ||
            elementRect.right > ancestorRect.right + 0.5
          ) {
            return true;
          }
        }
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const offenders = Array.from(document.querySelectorAll('body *'))
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          clipped: isClippedByScrollAncestor(element),
          tag: element.tagName.toLowerCase(),
          className:
            typeof element.className === 'string' ? element.className : '',
          testId: element.getAttribute('data-testid') || '',
          text: (element.textContent || '').trim().slice(0, 160),
          ancestors: Array.from(
            {
              length: 5,
            },
            (_, index) => {
              let ancestor = element.parentElement;
              for (let depth = 0; depth < index && ancestor; depth += 1) {
                ancestor = ancestor.parentElement;
              }
              return ancestor
                ? {
                    tag: ancestor.tagName.toLowerCase(),
                    className:
                      typeof ancestor.className === 'string'
                        ? ancestor.className
                        : '',
                    testId: ancestor.getAttribute('data-testid') || '',
                  }
                : null;
            }
          ).filter(Boolean),
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
        };
      })
      .filter(
        entry =>
          !entry.clipped &&
          entry.width > 0 &&
          (entry.right > viewportWidth + 0.5 || entry.left < -0.5)
      )
      .sort(
        (left, right) =>
          Math.max(right.right - viewportWidth, -right.left) -
          Math.max(left.right - viewportWidth, -left.left)
      )
      .slice(0, 20);
    const rootGeometry = [
      document.documentElement,
      document.body,
      document.querySelector('main.workbench'),
      document.querySelector('.workbench-grid'),
      document.querySelector('[data-testid="workbench-timeline-grid-preview"]'),
      document.querySelector('[data-testid="workbench-timeline-viewport"]'),
    ]
      .filter(Boolean)
      .map(element => {
        const rect = element.getBoundingClientRect();
        return {
          tag: element.tagName.toLowerCase(),
          className:
            typeof element.className === 'string' ? element.className : '',
          testId: element.getAttribute('data-testid') || '',
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          overflowX: getComputedStyle(element).overflowX,
        };
      });
    return { overflowPx, offenders, rootGeometry };
  });
}

async function markPerformancePhase(page, name) {
  await page.evaluate(phaseName => {
    window.__PROMILIA_PERF_PHASES__ ??= [];
    window.__PROMILIA_PERF_PHASES__.push({
      name: phaseName,
      time: Number(performance.now().toFixed(3)),
      counters: window.__PROMILIA_WORKBENCH_PERF__?.snapshot?.() ?? null,
    });
  }, name);
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  );
  return Number(sorted[index].toFixed(3));
}

function createDecision({
  openMetrics,
  idleMetrics,
  interactionP95Ms,
  maximumLongTaskMs,
  dragEvaluation,
  narrowOverflowPx,
}) {
  const failures = [];
  if (openMetrics.elementCount > THRESHOLDS.elementCount) {
    failures.push('element-count-over-budget');
  }
  if (openMetrics.liveNodeCount > THRESHOLDS.liveNodeCount) {
    failures.push('live-node-count-over-budget');
  }
  if (openMetrics.maximumMountedRowCount > THRESHOLDS.mountedRowsPerList) {
    failures.push('mounted-list-window-over-budget');
  }
  if (idleMetrics.elementGrowth !== 0) {
    failures.push('idle-dom-growth');
  }
  if (idleMetrics.taskDurationDeltaMs > THRESHOLDS.idleTaskDurationMs) {
    failures.push('idle-task-duration-over-budget');
  }
  if (idleMetrics.playbackRunning) {
    failures.push('idle-playback-active');
  }
  if (interactionP95Ms > THRESHOLDS.interactionP95Ms) {
    failures.push('interaction-p95-over-budget');
  }
  if (maximumLongTaskMs > THRESHOLDS.maximumLongTaskMs) {
    failures.push('long-task-over-budget');
  }
  if (narrowOverflowPx !== 0) {
    failures.push('narrow-page-horizontal-overflow');
  }
  if (dragEvaluation.available) {
    const preview = dragEvaluation.previewCounters ?? {};
    const commit = dragEvaluation.commitCounters ?? {};
    if (
      Number(preview.placementPreviewEvaluation || 0) >
      THRESHOLDS.pointerPreviewEvaluations
    ) {
      failures.push('pointer-preview-not-coalesced');
    }
    if (
      Number(commit.authoritativeCompile || 0) >
      THRESHOLDS.authoritativeCompilePerCommit
    ) {
      failures.push('commit-compile-count-over-budget');
    }
    if (
      Number(commit.authoritativeSimulation || 0) >
      THRESHOLDS.authoritativeSimulationPerCommit
    ) {
      failures.push('commit-simulation-count-over-budget');
    }
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    passed: failures.length === 0,
    failures,
  };
}
