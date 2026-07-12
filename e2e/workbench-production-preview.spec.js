import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('[applied-source-binding-guard] accepts the production three-track source audit', async () => {
  const report = JSON.parse(
    await readFile('reports/applied-source-binding-audit.json', 'utf8')
  );
  expect(report.decision).toMatchObject({ status: 'passed', passed: true });
  expect(report.summary).toMatchObject({
    boundDriftCount: 0,
    unexplainedCompatibleUnboundCount: 0,
    missingTrackCount: 0,
  });
});

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

test('[stage-9a-timeline-topology] renders three actor groups and five state curves on desktop and narrow screens', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(timeline).toBeVisible();
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-action"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-kibo"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="enemy-event"]'
    )
  ).toHaveCount(1);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve')
  ).toHaveCount(5);
  await expect(
    timeline.locator('[data-testid="workbench-timeline-state-curve-line"]')
  ).toHaveCount(5);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-101007"]'
    )
  ).toBeVisible();
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-toughness-curve"]'
    )
  ).toBeVisible();
  await expectTimelineRowsAligned(timeline);
  await timeline.screenshot({ path: 'reports/stage-9a-timeline-desktop.png' });

  await page.setViewportSize({ width: 760, height: 900 });
  await expect(timeline).toBeVisible();
  await expectTimelineRowsAligned(timeline);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve')
  ).toHaveCount(5);
  await timeline.screenshot({ path: 'reports/stage-9a-timeline-narrow.png' });
});

test('[stage-9b-runtime-step-curves] keeps actor resources and enemy states aligned through edit operations', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  const curve = laneId =>
    page.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve"]`
    );
  const breakpoints = laneId =>
    curve(laneId).getByTestId('workbench-timeline-state-curve-breakpoint');
  await expect(breakpoints('enemy-hp-curve')).toHaveCount(1);
  await expect(breakpoints('enemy-toughness-curve')).toHaveCount(0);

  await page.getByTestId('workbench-add-resource-action').click();
  await expect(breakpoints('energy-actor-109001')).toHaveCount(1);
  await expect(breakpoints('energy-actor-101003')).toHaveCount(0);
  await page
    .getByTestId('workbench-action-actor-select')
    .selectOption('101003');
  await expect(breakpoints('energy-actor-109001')).toHaveCount(0);
  await expect(breakpoints('energy-actor-101003')).toHaveCount(1);

  await page.getByTestId('workbench-start-frame-input').fill('600');
  const movedPoint = breakpoints('energy-actor-101003').first();
  await expect(movedPoint).toHaveAttribute('data-time-ms', '10000');
  await expectActionAndCurvePointAligned(page, 'action-0002', movedPoint);

  await page.getByTestId('workbench-timeline-zoom-input').fill('2');
  await expect(page.getByTestId('workbench-timeline-zoom-value')).toHaveText(
    '2x'
  );
  const timelineViewport = page.getByTestId('workbench-timeline-viewport');
  await timelineViewport.evaluate(element => {
    element.scrollLeft = 240;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect
    .poll(async () =>
      page
        .getByTestId('workbench-timeline-scale-viewport')
        .evaluate(element => element.scrollLeft)
    )
    .toBe(240);
  await expectActionAndCurvePointAligned(page, 'action-0002', movedPoint);

  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .getByTestId('workbench-copy-action')
    .click();
  await expect(breakpoints('energy-actor-101003')).toHaveCount(2);
  await expect
    .poll(() =>
      breakpoints('energy-actor-101003').evaluateAll(points =>
        points.map(point => point.getAttribute('data-action-id'))
      )
    )
    .toEqual(['action-0002', 'action-0003']);
  await page
    .getByTestId('workbench-timeline-grid-preview')
    .screenshot({ path: 'reports/stage-9b-step-curves-desktop.png' });

  await page.setViewportSize({ width: 760, height: 900 });
  await expectActionAndCurvePointAligned(page, 'action-0002', movedPoint);
  await page
    .getByTestId('workbench-timeline-grid-preview')
    .screenshot({ path: 'reports/stage-9b-step-curves-narrow.png' });

  await page
    .locator('.action-item[data-action-id="action-0003"]')
    .getByTestId('workbench-delete-action')
    .click();
  await expect(breakpoints('energy-actor-101003')).toHaveCount(1);
  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .getByTestId('workbench-delete-action')
    .click();
  await expect(breakpoints('energy-actor-101003')).toHaveCount(0);
  await expect(curve('energy-actor-101003')).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(
    curve('energy-actor-101003').getByTestId(
      'workbench-timeline-state-curve-line'
    )
  ).toHaveAttribute('points', '0,100 100,100');
});

test('[stage-9c-timeline-first-workspace] keeps the complete timeline topology in the primary workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const reviewWorkspace = page.getByTestId('workbench-review-workspace');
  const actionLibrary = page.locator('.action-library');
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(timeline).toBeVisible();
  await expect(reviewWorkspace).toBeVisible();

  const desktopLayout = await readTimelineFirstLayout(page);
  expect(desktopLayout.laneCount).toBe(12);
  expect(desktopLayout.timeline.width).toBeGreaterThanOrEqual(1390);
  expect(desktopLayout.timeline.bottom).toBeLessThanOrEqual(1000);
  expect(desktopLayout.lastLane.bottom).toBeLessThanOrEqual(1000);
  expect(desktopLayout.review.top).toBeGreaterThanOrEqual(
    desktopLayout.timeline.bottom
  );
  expect(desktopLayout.actions.top).toBeGreaterThanOrEqual(
    desktopLayout.timeline.bottom
  );
  expect(desktopLayout.inspector.top).toBeGreaterThanOrEqual(
    desktopLayout.timeline.bottom
  );
  await expectTimelineRowsAligned(timeline);
  await page.screenshot({ path: 'reports/stage-9c-workbench-desktop.png' });

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(page.getByTestId('workbench-flow-panel')).toHaveAttribute(
    'data-flow-phase',
    'runtime-result'
  );
  const reviewLayout = await readTimelineFirstLayout(page);
  expect(reviewLayout.timeline.top).toBeLessThan(reviewLayout.review.top);

  await page.setViewportSize({ width: 760, height: 1280 });
  await expect(timeline).toBeVisible();
  await expect(actionLibrary).toBeVisible();
  await expect(inspector).toBeVisible();
  const narrowLayout = await readTimelineFirstLayout(page);
  expect(narrowLayout.laneCount).toBe(12);
  expect(narrowLayout.lastLane.bottom).toBeLessThanOrEqual(
    narrowLayout.timeline.bottom
  );
  expect(narrowLayout.sections).toEqual([
    'primary-flow',
    'review-workspace',
    'action-library',
    'side-stack',
  ]);
  expect(narrowLayout.sectionsSeparated).toBe(true);
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-9c-workbench-narrow.png' });
});

test('[stage-10a-multitrack-editing] schedules and rebinds actor, kibo, and enemy entries on legal lanes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page
    .locator(
      '[data-testid="workbench-actor-kibo-select"][data-character-id="109001"]'
    )
    .selectOption('500001');
  const palette = page.getByTestId('workbench-timeline-entry-palette');
  const paletteToggle = page.getByTestId(
    'workbench-timeline-entry-palette-toggle'
  );
  const openPalette = async () => {
    if (!(await palette.isVisible())) {
      await paletteToggle.click();
    }
  };
  await openPalette();
  const kiboSource = page.locator(
    '[data-testid="workbench-timeline-entry-source"][data-entry-type="kiboEvent"]'
  );
  const firstKiboLane = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-1"]'
  );
  await kiboSource.dragTo(firstKiboLane, {
    targetPosition: { x: 950, y: 18 },
  });

  const kiboAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await expect(kiboAction).toHaveAttribute('data-lane-id', 'kibo-team-slot-1');
  await expect(kiboAction).toHaveAttribute('data-action-type', 'kiboEvent');
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-109001"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-point-count', '0');

  await openPalette();
  const enemySource = page.locator(
    '[data-testid="workbench-timeline-entry-source"][data-entry-type="enemyEvent"]'
  );
  const enemyLane = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="enemy-events"]'
  );
  await enemySource.dragTo(enemyLane, {
    targetPosition: { x: 1000, y: 24 },
  });
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
    )
  ).toHaveAttribute('data-lane-id', 'enemy-events');

  await openPalette();
  const skillSource = page.locator(
    '[data-testid="workbench-timeline-entry-source"][data-entry-type="skill"]'
  );
  const secondActorLane = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
  );
  await skillSource.dragTo(secondActorLane, {
    targetPosition: { x: 900, y: 28 },
  });
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
    )
  ).toHaveAttribute('data-lane-id', 'actor-101003');

  const secondKiboLane = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-2"]'
  );
  await kiboAction.dragTo(secondKiboLane, {
    targetPosition: { x: 360, y: 18 },
  });
  await expect(kiboAction).toHaveAttribute('data-lane-id', 'kibo-team-slot-2');

  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .getByTestId('workbench-copy-action')
    .click();
  const copiedKiboAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0005"]'
  );
  await expect(copiedKiboAction).toHaveAttribute(
    'data-lane-id',
    'kibo-team-slot-2'
  );
  await page
    .locator('.action-item[data-action-id="action-0005"]')
    .getByTestId('workbench-delete-action')
    .click();
  await expect(copiedKiboAction).toHaveCount(0);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(copiedKiboAction).toHaveCount(1);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(copiedKiboAction).toHaveCount(0);

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const exported = JSON.parse(
    await readFile(await (await downloadPromise).path(), 'utf8')
  );
  expect(exported).toMatchObject({ schemaVersion: 16 });
  expect(
    exported.actionDrafts.find(action => action.id === 'action-0002')
  ).toMatchObject({
    type: 'kiboEvent',
    actorCharacterId: 101003,
    eventType: 'activation',
  });
  expect(
    exported.actionDrafts.find(action => action.id === 'action-0003')
  ).toMatchObject({ type: 'enemyEvent' });

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-10a-multitrack-desktop.png' });
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
  await page.setViewportSize({ width: 760, height: 1280 });
  await expectTimelineRowsAligned(
    page.getByTestId('workbench-timeline-grid-preview')
  );
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(
    () =>
      new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  await openPalette();
  await expect(palette).toBeVisible();
  await page.evaluate(
    () =>
      new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  await page.screenshot({ path: 'reports/stage-10a-multitrack-narrow.png' });
});

test('[stage-10b-cross-lane-batch-editing] box-selects, rebinds, copies, and restores a mixed timeline group', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page
    .locator(
      '[data-testid="workbench-actor-kibo-select"][data-character-id="109001"]'
    )
    .selectOption('500001');
  const palette = page.getByTestId('workbench-timeline-entry-palette');
  const paletteToggle = page.getByTestId(
    'workbench-timeline-entry-palette-toggle'
  );
  const openPalette = async () => {
    if (!(await palette.isVisible())) {
      await paletteToggle.click();
    }
  };
  await openPalette();
  await page
    .locator(
      '[data-testid="workbench-timeline-entry-source"][data-entry-type="kiboEvent"]'
    )
    .dragTo(
      page.locator(
        '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-1"]'
      ),
      { targetPosition: { x: 560, y: 18 } }
    );

  const workbench = page.locator('main.workbench');
  const firstAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0001"]'
  );
  const kiboAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await boxSelectTimelineActions(page, ['action-0001', 'action-0002']);
  await expect(workbench).toHaveAttribute('data-selected-action-count', '2');
  await page.getByTestId('workbench-timeline-create-relations').click();
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');

  const originalStarts = await readTimelineActionStarts(page, [
    'action-0001',
    'action-0002',
  ]);
  await firstAction.dragTo(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
    ),
    { targetPosition: { x: 560, y: 24 } }
  );
  await expect(firstAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await expect(kiboAction).toHaveAttribute('data-lane-id', 'kibo-team-slot-2');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-101003"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-point-count', '0');
  const enemyHpCurve = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve"]'
  );
  const baseHpPointCount = Number(
    await enemyHpCurve.getAttribute('data-point-count')
  );
  const movedStarts = await readTimelineActionStarts(page, [
    'action-0001',
    'action-0002',
  ]);
  expect(movedStarts['action-0001']).toBeGreaterThan(
    originalStarts['action-0001']
  );
  expect(
    movedStarts['action-0001'] - originalStarts['action-0001']
  ).toBeCloseTo(movedStarts['action-0002'] - originalStarts['action-0002'], 4);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');

  await page.getByTestId('workbench-undo-edit').click();
  await expect(firstAction).toHaveAttribute('data-lane-id', 'actor-109001');
  await expect(kiboAction).toHaveAttribute('data-lane-id', 'kibo-team-slot-1');
  expect(
    await readTimelineActionStarts(page, ['action-0001', 'action-0002'])
  ).toEqual(originalStarts);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(firstAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await expect(kiboAction).toHaveAttribute('data-lane-id', 'kibo-team-slot-2');

  await openPalette();
  await page
    .locator(
      '[data-testid="workbench-timeline-entry-source"][data-entry-type="enemyEvent"]'
    )
    .dragTo(
      page.locator(
        '[data-testid="workbench-timeline-row"][data-lane-id="enemy-events"]'
      ),
      { targetPosition: { x: 920, y: 24 } }
    );
  await boxSelectTimelineActions(page, [
    'action-0001',
    'action-0002',
    'action-0003',
  ]);
  await expect(workbench).toHaveAttribute('data-selected-action-count', '3');
  await page.keyboard.press('Control+C');
  await page.keyboard.press('Control+V');
  await expect(page.getByTestId('workbench-timeline-action')).toHaveCount(6);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');
  const pastedTopology = await page.evaluate(() =>
    ['action-0004', 'action-0005', 'action-0006'].map(actionId => {
      const action = document.querySelector(
        `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
      );
      return {
        type: action?.getAttribute('data-action-type'),
        laneId: action?.getAttribute('data-lane-id'),
      };
    })
  );
  expect(pastedTopology).toEqual(
    expect.arrayContaining([
      { type: 'skill', laneId: 'actor-101003' },
      { type: 'kiboEvent', laneId: 'kibo-team-slot-2' },
      { type: 'enemyEvent', laneId: 'enemy-events' },
    ])
  );
  await expect
    .poll(async () =>
      Number(await enemyHpCurve.getAttribute('data-point-count'))
    )
    .toBeGreaterThan(baseHpPointCount);

  await page.keyboard.press('Delete');
  await expect(page.getByTestId('workbench-timeline-action')).toHaveCount(3);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await expect(enemyHpCurve).toHaveAttribute(
    'data-point-count',
    String(baseHpPointCount)
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(page.getByTestId('workbench-timeline-action')).toHaveCount(6);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');
  await expect
    .poll(async () =>
      Number(await enemyHpCurve.getAttribute('data-point-count'))
    )
    .toBeGreaterThan(baseHpPointCount);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(page.getByTestId('workbench-timeline-action')).toHaveCount(3);
  await expect(enemyHpCurve).toHaveAttribute(
    'data-point-count',
    String(baseHpPointCount)
  );

  const zoomInput = page.getByTestId('workbench-timeline-zoom-input');
  await zoomInput.evaluate(element => {
    element.value = '4';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.getByTestId('workbench-timeline-zoom-value')).toHaveText(
    '4x'
  );
  const timelineViewport = page.getByTestId('workbench-timeline-viewport');
  const scaleViewport = page.getByTestId('workbench-timeline-scale-viewport');
  await timelineViewport.evaluate(element => {
    element.scrollLeft = Math.min(
      900,
      element.scrollWidth - element.clientWidth
    );
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect
    .poll(async () => {
      const [timelineScroll, scaleScroll] = await Promise.all([
        timelineViewport.evaluate(element => element.scrollLeft),
        scaleViewport.evaluate(element => element.scrollLeft),
      ]);
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);
  await expectTimelineRowsAligned(
    page.getByTestId('workbench-timeline-grid-preview')
  );

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const exported = JSON.parse(
    await readFile(await (await downloadPromise).path(), 'utf8')
  );
  expect(exported.actionDrafts).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: 'action-0001',
        actorCharacterId: 101003,
      }),
      expect.objectContaining({
        id: 'action-0002',
        type: 'kiboEvent',
        actorCharacterId: 101003,
      }),
      expect.objectContaining({ id: 'action-0003', type: 'enemyEvent' }),
    ])
  );
  expect(exported.actionRelations).toHaveLength(1);

  await zoomInput.evaluate(element => {
    element.value = '1';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await timelineViewport.evaluate(element => {
    element.scrollLeft = 0;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(
    () =>
      new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      )
  );
  await page.screenshot({ path: 'reports/stage-10b-batch-desktop.png' });
  await page.setViewportSize({ width: 760, height: 1280 });
  await expectTimelineRowsAligned(
    page.getByTestId('workbench-timeline-grid-preview')
  );
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-10b-batch-narrow.png' });
});

test('[stage-10c-frame-cursor-review] links timeline frames, five curve states, actions, and runtime logs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const cursor = page.getByTestId('workbench-timeline-frame-cursor');
  const cursorHandle = page.getByTestId(
    'workbench-timeline-frame-cursor-handle'
  );
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '0');
  await expect(
    page.getByTestId('workbench-timeline-state-curve-cursor')
  ).toHaveCount(5);
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-101003"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-cursor-value', '0');

  const palette = page.getByTestId('workbench-timeline-entry-palette');
  const paletteToggle = page.getByTestId(
    'workbench-timeline-entry-palette-toggle'
  );
  await paletteToggle.click();
  await page
    .locator(
      '[data-testid="workbench-timeline-entry-source"][data-entry-type="resource"]'
    )
    .dragTo(
      page.locator(
        '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
      ),
      { targetPosition: { x: 420, y: 26 } }
    );

  const actorEnergyCurve = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-101003"] [data-testid="workbench-timeline-state-curve"]'
  );
  let energyBreakpoint = actorEnergyCurve.getByTestId(
    'workbench-timeline-state-curve-breakpoint'
  );
  const originalResourceFrame = Number(
    await energyBreakpoint.getAttribute('data-frame-index')
  );
  await energyBreakpoint.click();
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    String(originalResourceFrame)
  );
  await expect(actorEnergyCurve).toHaveAttribute('data-cursor-value', '50');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-109001"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-cursor-value', '0');
  await expectTimelineCursorAligned(cursor, energyBreakpoint);

  const resourceAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await resourceAction.click();
  await selectTimelineFrameAtRatio(page, 0.4);
  const reviewFrame = Number(
    await timeline.getAttribute('data-cursor-frame-index')
  );
  expect(reviewFrame).toBeGreaterThanOrEqual(719);
  expect(reviewFrame).toBeLessThanOrEqual(720);
  await expect(actorEnergyCurve).toHaveAttribute('data-cursor-value', '50');
  await page.getByTestId('workbench-start-frame-input').fill('900');
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    String(reviewFrame)
  );
  await expect(actorEnergyCurve).toHaveAttribute('data-cursor-value', '0');
  energyBreakpoint = actorEnergyCurve.getByTestId(
    'workbench-timeline-state-curve-breakpoint'
  );
  await expect(energyBreakpoint).toHaveAttribute('data-frame-index', '900');

  await energyBreakpoint.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '900');
  await expect(actorEnergyCurve).toHaveAttribute('data-cursor-value', '50');
  const resourceStatePointId = await energyBreakpoint.getAttribute(
    'data-state-point-id'
  );
  await page
    .locator(
      '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="delta"]'
    )
    .click();
  const resourceLogRow = page.locator(
    `[data-testid="workbench-runtime-sim-log-row"][data-state-point-id="${resourceStatePointId}"]`
  );
  await expect(resourceLogRow).toBeVisible();
  await selectTimelineFrameAtRatio(page, 0.1);
  await expect
    .poll(async () =>
      Number(await timeline.getAttribute('data-cursor-frame-index'))
    )
    .toBeGreaterThanOrEqual(179);
  expect(
    Number(await timeline.getAttribute('data-cursor-frame-index'))
  ).toBeLessThanOrEqual(180);
  await resourceLogRow.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '900');
  await expect(resourceLogRow).toHaveAttribute('data-selected', 'true');

  const hpCurve = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve"]'
  );
  const hpBreakpoint = hpCurve
    .getByTestId('workbench-timeline-state-curve-breakpoint')
    .first();
  await hpBreakpoint.click();
  const hpFrame = await hpBreakpoint.getAttribute('data-frame-index');
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', hpFrame);
  await expect(hpCurve).toHaveAttribute(
    'data-cursor-value',
    await hpBreakpoint.getAttribute('data-current-value')
  );
  await expectTimelineCursorAligned(cursor, hpBreakpoint);

  await cursorHandle.evaluate(element => {
    const lane = document.querySelector(
      '[data-testid="workbench-timeline-lane"]'
    );
    const laneRect = lane?.getBoundingClientRect();
    const cursorRect = element.getBoundingClientRect();
    if (!laneRect) return;
    const pointerId = 7;
    const startX = cursorRect.left + cursorRect.width / 2;
    const clientY = cursorRect.top + 8;
    const endX = laneRect.left + laneRect.width * 0.6;
    element.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        pointerId,
        clientX: startX,
        clientY,
      })
    );
    window.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerId,
        clientX: endX,
        clientY,
      })
    );
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        pointerId,
        clientX: endX,
        clientY,
      })
    );
  });
  const draggedFrame = Number(
    await timeline.getAttribute('data-cursor-frame-index')
  );
  expect(draggedFrame).toBeGreaterThanOrEqual(1079);
  expect(draggedFrame).toBeLessThanOrEqual(1080);

  const zoomInput = page.getByTestId('workbench-timeline-zoom-input');
  await zoomInput.evaluate(element => {
    element.value = '4';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await energyBreakpoint.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '900');
  await expectTimelineCursorAligned(cursor, energyBreakpoint);
  const timelineViewport = page.getByTestId('workbench-timeline-viewport');
  const scaleViewport = page.getByTestId('workbench-timeline-scale-viewport');
  await expect
    .poll(async () => {
      const [timelineScroll, scaleScroll] = await Promise.all([
        timelineViewport.evaluate(element => element.scrollLeft),
        scaleViewport.evaluate(element => element.scrollLeft),
      ]);
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);

  await zoomInput.evaluate(element => {
    element.value = '1';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
  await energyBreakpoint.click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-10c-cursor-desktop.png' });
  await page.setViewportSize({ width: 760, height: 1280 });
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await expectTimelineCursorAligned(cursor, energyBreakpoint);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-10c-cursor-narrow.png' });
});

test('[stage-10d-timeline-playback] plays the full axis and loops a selected cycle section', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  const workbench = page.locator('main.workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const playback = page.getByTestId('workbench-timeline-playback-controls');
  const toggle = page.getByTestId('workbench-timeline-playback-toggle');
  const stepForward = page.getByTestId('workbench-timeline-step-forward');
  const stepBackward = page.getByTestId('workbench-timeline-step-backward');
  const rate = page.getByTestId('workbench-timeline-playback-rate');

  await expect(playback).toHaveAttribute('data-range-mode', 'axis');
  await stepForward.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    '1'
  );
  await stepBackward.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    '0'
  );
  await rate.selectOption('2');
  await expect(workbench).toHaveAttribute('data-timeline-playback-rate', '2');

  await toggle.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-playback-running',
    'true'
  );
  await expect
    .poll(async () =>
      Number(await workbench.getAttribute('data-timeline-cursor-frame-index'))
    )
    .toBeGreaterThan(0);
  await toggle.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-playback-running',
    'false'
  );
  const pausedFrame = await workbench.getAttribute(
    'data-timeline-cursor-frame-index'
  );
  await page.waitForTimeout(120);
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    pausedFrame
  );

  const hpMarker = page
    .locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve-marker"]'
    )
    .first();
  await hpMarker.click();
  const hpFrame = await hpMarker.getAttribute('data-frame-index');
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    hpFrame
  );
  await expect(
    page
      .locator(
        `[data-testid="workbench-runtime-sim-log-row"][data-frame-index="${hpFrame}"][data-cursor-current="true"]`
      )
      .first()
  ).toBeVisible();

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
  await page
    .locator(
      '[data-testid="workbench-cycle-section-tab"][data-section-id="cycle-section-01"]'
    )
    .click();
  await page
    .locator(
      '[data-testid="workbench-timeline-playback-range-mode"][data-range-mode="section"]'
    )
    .click();

  await expect(workbench).toHaveAttribute(
    'data-timeline-playback-range-mode',
    'section'
  );
  const sectionStart = Number(
    await workbench.getAttribute('data-timeline-playback-range-start-frame')
  );
  const sectionEnd = Number(
    await workbench.getAttribute('data-timeline-playback-range-end-frame')
  );
  expect(sectionStart).toBe(0);
  expect(sectionEnd).toBeGreaterThan(sectionStart + 1);
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    String(sectionStart)
  );

  await stepBackward.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    String(sectionEnd - 1)
  );
  await stepForward.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    String(sectionStart)
  );
  await expect(
    page.locator('.event-list > li[data-cursor-current="true"]').first()
  ).toBeVisible();

  await stepBackward.click();
  await toggle.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-playback-running',
    'true'
  );
  await expect
    .poll(async () =>
      Number(await workbench.getAttribute('data-timeline-cursor-frame-index'))
    )
    .toBeLessThan(sectionEnd - 1);
  await toggle.click();
  await expect(workbench).toHaveAttribute(
    'data-timeline-playback-running',
    'false'
  );
  await expect(timeline).toHaveAttribute('data-playback-range-mode', 'section');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-10d-playback-desktop.png' });
  await page.setViewportSize({ width: 760, height: 1280 });
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await expect(playback).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/stage-10d-playback-narrow.png' });
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
    schemaVersion: 16,
    game: 'azur-promilia',
    type: 'workbench-project',
    gameDataBinding: {
      contractName: 'AzPrWorkbenchGameDataBinding',
      catalogId: 'azpr-workbench-game-data',
      catalogVersion: 1,
      dataVersion: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
    },
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

test('[game-data-compatibility-gate] rejects an unavailable AzPr config reference without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('91');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  project.actorConfigs[0].loadout.kiboId = 999999999;
  const incompatiblePath = testInfo.outputPath(
    'incompatible-game-data.promilia-workbench.json'
  );
  await writeFile(incompatiblePath, JSON.stringify(project));

  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(incompatiblePath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '项目游戏数据不兼容'
  );
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '2 action'
  );
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '91'
  );
});

test('[action-skill-compatibility-gate] rejects an unavailable skill before action fallback without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-add-action').click();
  await page.getByTestId('workbench-enemy-level-input').fill('91');
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-export-project').click();
  const download = await downloadPromise;
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  project.actionDrafts[0].skillId = 999999999;
  const incompatiblePath = testInfo.outputPath(
    'incompatible-action-skill.promilia-workbench.json'
  );
  await writeFile(incompatiblePath, JSON.stringify(project));

  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(incompatiblePath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '项目游戏数据不兼容'
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
    schemaVersion: 16,
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
  expect(project.schemaVersion).toBe(16);
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
  expect(project.schemaVersion).toBe(16);
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
    schemaVersion: 16,
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
  expect(project.schemaVersion).toBe(16);
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
  await resizer.evaluate(element =>
    element.scrollIntoView({ block: 'start', inline: 'nearest' })
  );
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

async function expectTimelineRowsAligned(timeline) {
  const alignment = await timeline.evaluate(element => {
    const rows = [
      ...element.querySelectorAll('[data-testid="workbench-timeline-row"]'),
    ];
    const labels = [
      ...element.querySelectorAll(
        '[data-testid="workbench-timeline-lane-label"]'
      ),
    ];
    const rowRects = rows.map(row => row.getBoundingClientRect());
    const labelRects = labels.map(label => label.getBoundingClientRect());
    return {
      rowCount: rows.length,
      labelCount: labels.length,
      rowsSeparated: rowRects.every(
        (rect, index) =>
          index === 0 || rect.top >= rowRects[index - 1].bottom - 0.5
      ),
      labelsAligned: rowRects.every(
        (rect, index) => Math.abs(rect.top - labelRects[index]?.top) <= 0.5
      ),
    };
  });
  expect(alignment).toEqual({
    rowCount: 12,
    labelCount: 12,
    rowsSeparated: true,
    labelsAligned: true,
  });
}

async function readTimelineFirstLayout(page) {
  return page.evaluate(() => {
    const readRect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
      };
    };
    const lanes = [
      ...document.querySelectorAll('[data-testid="workbench-timeline-row"]'),
    ];
    const sectionSelectors = [
      ['primary-flow', '.primary-flow'],
      ['review-workspace', '[data-testid="workbench-review-workspace"]'],
      ['action-library', '.action-library'],
      ['side-stack', '.side-stack'],
    ];
    const sectionRects = sectionSelectors.map(([name, selector]) => ({
      name,
      rect: readRect(selector),
    }));
    return {
      timeline: readRect('[data-testid="workbench-timeline-grid-preview"]'),
      review: readRect('[data-testid="workbench-review-workspace"]'),
      actions: readRect('.action-library'),
      inspector: readRect('.side-stack'),
      laneCount: lanes.length,
      lastLane: lanes.length
        ? (() => {
            const rect = lanes[lanes.length - 1].getBoundingClientRect();
            return {
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
            };
          })()
        : null,
      sections: sectionRects.map(section => section.name),
      sectionsSeparated: sectionRects.every(
        (section, index) =>
          index === 0 || section.rect.top >= sectionRects[index - 1].rect.bottom
      ),
    };
  });
}

async function expectActionAndCurvePointAligned(page, actionId, point) {
  const action = page.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
  );
  await expect
    .poll(async () => {
      const [actionBox, pointBox] = await Promise.all([
        action.boundingBox(),
        point.boundingBox(),
      ]);
      if (!actionBox || !pointBox) return Number.POSITIVE_INFINITY;
      return Math.abs(actionBox.x - (pointBox.x + pointBox.width / 2));
    })
    .toBeLessThanOrEqual(1);
}

async function expectTimelineCursorAligned(cursor, target) {
  await expect
    .poll(async () => {
      const [cursorBox, targetBox] = await Promise.all([
        cursor.boundingBox(),
        target.boundingBox(),
      ]);
      if (!cursorBox || !targetBox) return Number.POSITIVE_INFINITY;
      return Math.abs(
        cursorBox.x + cursorBox.width / 2 - (targetBox.x + targetBox.width / 2)
      );
    })
    .toBeLessThanOrEqual(1.5);
}

async function selectTimelineFrameAtRatio(page, ratio) {
  await page.evaluate(value => {
    const lane = document.querySelector(
      '[data-testid="workbench-timeline-lane"]'
    );
    const rect = lane?.getBoundingClientRect();
    if (!lane || !rect) return;
    lane.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        clientX: rect.left + rect.width * value,
        clientY: rect.top + rect.height / 2,
      })
    );
  }, ratio);
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

async function boxSelectTimelineActions(page, actionIds) {
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  if ((await timeline.getAttribute('data-box-selection-mode')) !== 'true') {
    await page.getByTestId('workbench-timeline-box-select-toggle').click();
  }
  const geometry = await page.evaluate(ids => {
    const lane = document.querySelector(
      '[data-testid="workbench-timeline-lane"]'
    );
    const laneRect = lane?.getBoundingClientRect();
    const rects = ids
      .map(id =>
        document
          .querySelector(
            `[data-testid="workbench-timeline-action"][data-action-id="${id}"]`
          )
          ?.getBoundingClientRect()
      )
      .filter(Boolean);
    if (!laneRect || rects.length !== ids.length) return null;
    return {
      startX: Math.min(
        laneRect.right - 2,
        Math.max(...rects.map(rect => rect.right)) + 6
      ),
      startY: Math.max(
        laneRect.top + 2,
        Math.min(...rects.map(rect => rect.top)) - 3
      ),
      endX: Math.max(
        laneRect.left + 2,
        Math.min(...rects.map(rect => rect.left)) - 6
      ),
      endY: Math.min(
        laneRect.bottom - 2,
        Math.max(...rects.map(rect => rect.bottom)) + 3
      ),
    };
  }, actionIds);
  expect(geometry).toBeTruthy();
  await page.mouse.move(geometry.startX, geometry.startY);
  await page.mouse.down();
  await page.mouse.move(geometry.endX, geometry.endY, { steps: 4 });
  await page.mouse.up();
}

async function readTimelineActionStarts(page, actionIds) {
  return page.evaluate(ids => {
    return Object.fromEntries(
      ids.map(id => {
        const action = document.querySelector(
          `[data-testid="workbench-timeline-action"][data-action-id="${id}"]`
        );
        return [id, Number(action?.getAttribute('data-start-ms'))];
      })
    );
  }, actionIds);
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
