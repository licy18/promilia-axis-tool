import { Buffer } from 'node:buffer';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
  createBasicWorkbenchDraftFixture,
} from './helpers/basic-workbench-draft';

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.title.includes('[m1d-demo-milestone]')) {
    return;
  }
  await prepareBasicWorkbenchScenario(page);
});

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

test('[stage-9a-timeline-topology] renders three actor groups and eight state curves on desktop and narrow screens', async ({
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
  ).toHaveCount(8);
  await expect(
    timeline.locator('[data-testid="workbench-timeline-state-curve-line"]')
  ).toHaveCount(8);
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
  ).toHaveCount(8);
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

  await closeInspectorIfVisible(page);
  await page
    .locator('.action-item[data-action-id="action-0003"]')
    .getByTestId('workbench-delete-action')
    .click();
  await expect(breakpoints('energy-actor-101003')).toHaveCount(1);
  await closeInspectorIfVisible(page);
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

test('[m1a-timeline-identity] keeps the complete team topology in the timeline-first workspace', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const reviewWorkspace = page.getByTestId('workbench-review-workspace');
  const actionLibrary = page.locator('.action-library');
  const inspector = page.getByTestId('workbench-side-inspector');
  const actorIdentities = page.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"]'
  );
  await expect(timeline).toBeVisible();
  await expect(reviewWorkspace).toBeVisible();
  await expect(inspector).toBeHidden();
  await expect(actorIdentities).toHaveCount(3);
  await expect(actorIdentities.nth(0)).toContainText('末音');
  await expect(actorIdentities.nth(1)).toContainText('寒悠悠');
  await expect(actorIdentities.nth(2)).toContainText('芃芃');
  await expect(actorIdentities.locator('img')).toHaveCount(3);

  const desktopLayout = await readTimelineFirstLayout(page);
  expect(desktopLayout.laneCount).toBe(15);
  expect(desktopLayout.timeline.width).toBeGreaterThanOrEqual(1100);
  expect(desktopLayout.timeline.bottom).toBeLessThanOrEqual(900);
  expect(desktopLayout.lastLane.bottom).toBeLessThanOrEqual(900);
  expect(desktopLayout.review.top).toBeGreaterThanOrEqual(
    desktopLayout.timeline.bottom
  );
  expect(desktopLayout.actions.top).toBeLessThanOrEqual(
    desktopLayout.timeline.top + 1
  );
  expect(desktopLayout.actions.right).toBeLessThanOrEqual(
    desktopLayout.timeline.left
  );
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({ path: 'reports/m1a-workbench-desktop.png' });

  const timelineBoxBeforeInspector = await timeline.boundingBox();
  await actorIdentities.nth(0).click();
  await expect(inspector).toBeVisible();
  await expect(inspector).toContainText('末音');
  const timelineBoxWithInspector = await timeline.boundingBox();
  expect(timelineBoxWithInspector?.width).toBe(
    timelineBoxBeforeInspector?.width
  );
  await page.getByTestId('workbench-close-side-inspector').click();
  await expect(inspector).toBeHidden();

  const projectMenu = page.getByTestId('workbench-project-menu');
  await projectMenu.locator('summary').click();
  await expect(page.getByTestId('workbench-export-project')).toBeVisible();
  await expect(page.getByTestId('workbench-export-project-png')).toBeVisible();
  await expect(page.getByTestId('workbench-import-project')).toBeVisible();
  await expect(page.getByTestId('workbench-share-project')).toBeVisible();
  await projectMenu.locator('summary').click();

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(timeline).toBeVisible();
  await expect(actionLibrary).toBeVisible();
  await expect(inspector).toBeHidden();
  const narrowLayout = await readM1ANarrowLayout(page);
  expect(narrowLayout).toMatchObject({
    laneCount: 15,
    actorIdentityCount: 3,
    rowsSeparated: true,
    labelsAligned: true,
  });
  expect(narrowLayout.timelineWidth).toBeLessThanOrEqual(390);
  expect(narrowLayout.labelWidths).toEqual(Array(15).fill(132));
  expect(narrowLayout.timelineScrollWidth).toBeGreaterThan(
    narrowLayout.timelineClientWidth
  );
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1a-workbench-narrow.png' });
});

test('[m1b-team-kibo-energy] keeps three actor and three kibo energy owners synchronized with configuration', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
  );
  const kiboEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
  );
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve')
  ).toHaveCount(8);

  const bindings = [
    { characterId: 109001, kiboId: '500001', kiboName: '迅狼' },
    { characterId: 101003, kiboId: '500002', kiboName: '水灵仔' },
    { characterId: 101007, kiboId: '500003', kiboName: '水灵偶' },
  ];
  for (const binding of bindings) {
    await page
      .locator(
        `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${binding.characterId}"]`
      )
      .click();
    const inspector = page.getByTestId('workbench-side-inspector');
    await expect(inspector).toBeVisible();
    await expect(
      inspector.locator('[data-inspector-panel-key="team-loadout"]')
    ).toHaveAttribute('data-inspector-panel-order', '0');
    await expect(
      inspector.locator(
        `[data-testid="workbench-actor-loadout"][data-character-id="${binding.characterId}"]`
      )
    ).toHaveAttribute('data-focused', 'true');
    await inspector
      .locator(
        `[data-testid="workbench-actor-kibo-select"][data-character-id="${binding.characterId}"]`
      )
      .selectOption(binding.kiboId);
    await expect(page.getByTestId('workbench-action-library-kibo')).toHaveText(
      `奇波 · ${binding.kiboName}`
    );
  }

  for (const [index, binding] of bindings.entries()) {
    const row = timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="kibo-energy-team-slot-${index + 1}"]`
    );
    await expect(
      timeline.locator(
        `[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-${index + 1}"]`
      )
    ).toContainText(binding.kiboName);
    await expect(
      row.getByTestId('workbench-timeline-state-curve')
    ).toHaveAttribute('data-point-count', '0');
    await expect(
      row.getByTestId('workbench-timeline-state-curve-line')
    ).toHaveAttribute('points', '0,100 100,100');
  }

  await timeline
    .locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="enemy-event"]'
    )
    .click();
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(
    inspector.locator('[data-inspector-panel-key="enemy"]')
  ).toHaveAttribute('data-inspector-panel-order', '0');
  await inspector
    .getByTestId('workbench-enemy-config-select')
    .selectOption('300071');
  await expect(inspector.getByTestId('workbench-enemy-name')).toHaveText(
    '菜鸡'
  );
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="enemy-event"]'
    )
  ).toContainText('菜鸡');

  await page.getByTestId('workbench-close-side-inspector').click();
  await expect(inspector).toBeHidden();
  await expectTimelineRowsAligned(timeline);
  const desktopLayout = await readTimelineFirstLayout(page);
  expect(desktopLayout.lastLane.bottom).toBeLessThanOrEqual(900);
  await page.screenshot({ path: 'reports/m1b-six-energy-desktop.png' });

  await page.setViewportSize({ width: 390, height: 900 });
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1b-six-energy-narrow.png' });
});

test('[m1c-library-to-runtime] drags actor, kibo, and enemy entries into owner-isolated runtime curves', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await openActorInspector(page, 101003);
  await page
    .locator(
      '[data-testid="workbench-actor-kibo-select"][data-character-id="101003"]'
    )
    .selectOption('500002');
  await expect(page.getByTestId('workbench-action-library-kibo')).toHaveText(
    '奇波 · 水灵仔'
  );
  await closeInspectorIfVisible(page);

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorTwoLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
  );
  const actorThreeLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101007"]'
  );
  const actorEnergyCurve = characterId =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-${characterId}"] [data-testid="workbench-timeline-state-curve"]`
    );
  const kiboEnergyCurve = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="kibo-energy-team-slot-2"] [data-testid="workbench-timeline-state-curve"]'
  );
  const hpCurve = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve"]'
  );
  const toughnessCurve = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="enemy-toughness-curve"] [data-testid="workbench-timeline-state-curve"]'
  );
  const hpPointCountBefore = Number(
    await hpCurve.getAttribute('data-point-count')
  );

  const directSkillSource = page.getByTestId('workbench-skill-entry').first();
  await expectImageLoaded(directSkillSource.locator('img'));
  await dragLocatorTo(page, directSkillSource, actorTwoLane, {
    targetPosition: { x: 280, y: 26 },
  });
  const skillAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await expect(skillAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await expectImageLoaded(skillAction.locator('img.action-image-icon'));
  await expect
    .poll(async () => Number(await hpCurve.getAttribute('data-point-count')))
    .toBeGreaterThan(hpPointCountBefore);
  const hpPointCountAfterSkill = Number(
    await hpCurve.getAttribute('data-point-count')
  );
  const skillHpBreakpoint = hpCurve.locator(
    '[data-testid="workbench-timeline-state-curve-breakpoint"][data-action-id="action-0002"]'
  );
  await expect(skillHpBreakpoint).toHaveCount(1);
  await expectActionAndCurvePointAligned(
    page,
    'action-0002',
    skillHpBreakpoint
  );
  await closeInspectorIfVisible(page);

  await dragLocatorTo(
    page,
    page.getByTestId('workbench-add-resource-action'),
    actorTwoLane,
    { targetPosition: { x: 500, y: 26 } }
  );
  const resourceAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
  );
  await expect(resourceAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await expect(actorEnergyCurve(109001)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  let resourceBreakpoint = actorEnergyCurve(101003).locator(
    '[data-testid="workbench-timeline-state-curve-breakpoint"][data-action-id="action-0003"]'
  );
  await expectActionAndCurvePointAligned(
    page,
    'action-0003',
    resourceBreakpoint
  );
  await closeInspectorIfVisible(page);

  const kiboActionEntries = page.getByTestId('workbench-kibo-action-entry');
  await expect(kiboActionEntries).toHaveCount(3);
  await expect(kiboActionEntries.locator('img')).toHaveCount(3);
  await expect(kiboActionEntries).toContainText([
    '水灵涟漪',
    '水弹连射',
    '水灵仔-合击',
  ]);
  await dragLocatorTo(
    page,
    page.locator(
      '[data-testid="workbench-kibo-action-entry"][data-skill-id="502015"]'
    ),
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-2"]'
    ),
    { targetPosition: { x: 680, y: 18 } }
  );
  const kiboTimelineAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
  );
  await expect(kiboTimelineAction).toHaveAttribute(
    'data-lane-id',
    'kibo-team-slot-2'
  );
  await expect(kiboTimelineAction).toHaveAttribute('data-skill-id', '502015');
  await expect(kiboTimelineAction).toHaveAttribute(
    'data-duration-ms',
    '833.333333'
  );
  await expect(kiboTimelineAction).toContainText('水弹连射');
  await expectImageLoaded(kiboTimelineAction.locator('img.action-image-icon'));
  const kiboActionIdentity = page.getByTestId('workbench-action-identity');
  await expect(kiboActionIdentity).toContainText('水弹连射');
  await expect(kiboActionIdentity).toContainText('主动技 · 50F');
  await expectImageLoaded(kiboActionIdentity.locator('img'));
  await expect(kiboEnergyCurve).toHaveAttribute('data-point-count', '0');
  await expect(
    kiboEnergyCurve.getByTestId('workbench-timeline-state-curve-line')
  ).toHaveAttribute('points', '0,100 100,100');
  await closeInspectorIfVisible(page);

  await dragLocatorTo(
    page,
    page.getByTestId('workbench-add-enemy-event-action'),
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-events"]'
    ),
    { targetPosition: { x: 780, y: 24 } }
  );
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0005"]'
    )
  ).toHaveAttribute('data-lane-id', 'enemy-events');
  await expect(hpCurve).toHaveAttribute(
    'data-point-count',
    String(hpPointCountAfterSkill)
  );
  await expect(toughnessCurve).toHaveAttribute('data-point-count', '0');
  await closeInspectorIfVisible(page);

  await resourceAction.dragTo(actorThreeLane, {
    targetPosition: { x: 560, y: 26 },
  });
  await expect(resourceAction).toHaveAttribute('data-lane-id', 'actor-101007');
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  resourceBreakpoint = actorEnergyCurve(101007).locator(
    '[data-testid="workbench-timeline-state-curve-breakpoint"][data-action-id="action-0003"]'
  );
  await expectActionAndCurvePointAligned(
    page,
    'action-0003',
    resourceBreakpoint
  );

  await page.getByTestId('workbench-undo-edit').click();
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await page.getByTestId('workbench-redo-edit').click();
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '1'
  );

  await closeInspectorIfVisible(page);
  await page
    .locator('.action-item[data-action-id="action-0003"]')
    .getByTestId('workbench-copy-action')
    .click();
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '2'
  );
  await closeInspectorIfVisible(page);
  await page
    .locator('.action-item[data-action-id="action-0006"]')
    .getByTestId('workbench-delete-action')
    .click();
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '2'
  );
  await page.getByTestId('workbench-redo-edit').click();
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '1'
  );

  await closeInspectorIfVisible(page);
  await resourceAction.dragTo(actorTwoLane, {
    targetPosition: { x: 520, y: 26 },
  });
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  resourceBreakpoint = actorEnergyCurve(101003).locator(
    '[data-testid="workbench-timeline-state-curve-breakpoint"][data-action-id="action-0003"]'
  );
  await resourceBreakpoint.click();
  const resourceStatePointId = await resourceBreakpoint.getAttribute(
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
  await expect(resourceLogRow).toHaveAttribute(
    'data-frame-index',
    await resourceBreakpoint.getAttribute('data-frame-index')
  );
  await closeInspectorIfVisible(page);

  await expectTimelineRowsAligned(timeline);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1c-library-runtime-desktop.png' });

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(resourceAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  await expect(skillHpBreakpoint).toHaveCount(1);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
    )
  ).toHaveAttribute('data-skill-id', '502015');
  await expectImageLoaded(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0004"] img.action-image-icon'
    )
  );
  await expect(kiboEnergyCurve).toHaveAttribute('data-point-count', '0');

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1c-library-runtime-narrow.png' });
});

async function expectImageLoaded(locator) {
  await expect(locator).toBeVisible();
  await expect
    .poll(() =>
      locator.evaluate(image => image.complete && image.naturalWidth > 0)
    )
    .toBe(true);
}

test('[m1d-demo-milestone] replays the visible three-person demo through every project carrier', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.getByTestId('workbench-scenario-name')).toHaveText(
    '示例方案 · 预览数据'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 288 });
  await expect(page.locator('.action-item')).toHaveCount(6);
  await expect(
    page.locator('.action-item[data-action-id="demo-kibo-2-event"]')
  ).toBeVisible();
  await expect(
    page.locator('.action-item[data-action-id="demo-enemy-event"]')
  ).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1d-demo-desktop.png' });

  await page
    .locator('.action-item[data-action-id="demo-actor-2-energy"]')
    .click();
  await page.getByTestId('workbench-start-frame-input').fill('360');
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });
  await closeInspectorIfVisible(page);
  await page
    .locator('.action-item[data-action-id="demo-actor-2-energy"]')
    .getByTestId('workbench-copy-action')
    .click();
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-101003"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-point-count', '2');
  await closeInspectorIfVisible(page);
  await page
    .locator('.action-item[data-action-id="action-0002"]')
    .getByTestId('workbench-delete-action')
    .click();
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });

  await page.getByTestId('workbench-scenario-duplicate').click();
  await expect(page.getByTestId('workbench-scenario-bar')).toHaveAttribute(
    'data-scenario-count',
    '2'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });

  const shareButton = page.getByTestId('workbench-share-project');
  await clickProjectMenuCommand(page, 'workbench-share-project');
  const shareUrl = await shareButton.getAttribute('data-share-url');
  expect(shareUrl).toContain('/#/workbench?workbenchProject=');

  const jsonDownloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const jsonDownload = await jsonDownloadPromise;
  const jsonPath = await jsonDownload.path();

  const pngDownloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project-png');
  const pngDownload = await pngDownloadPromise;
  const pngPath = await pngDownload.path();

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(jsonPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });

  await page.goto(shareUrl);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入分享项目'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(pngPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已从 PNG 导入项目'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 360 });

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await expectTimelineRowsAligned(
    page.getByTestId('workbench-timeline-grid-preview')
  );
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1d-demo-narrow.png' });
  await page
    .getByTestId('workbench-timeline-grid-preview')
    .screenshot({ path: 'reports/m1d-demo-narrow-timeline.png' });
});

test('[stage-10a-multitrack-editing] schedules and rebinds actor, kibo, and enemy entries on legal lanes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await openActorInspector(page);
  await page
    .locator(
      '[data-testid="workbench-actor-kibo-select"][data-character-id="109001"]'
    )
    .selectOption('500001');
  await closeInspectorIfVisible(page);
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
  await kiboSource.click();
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }

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
  await enemySource.click();
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
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
  await skillSource.click();
  const insertedSkillAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
  );
  await insertedSkillAction.dragTo(secondActorLane, {
    targetPosition: { x: 760, y: 28 },
  });
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
  await expect(insertedSkillAction).toHaveAttribute(
    'data-lane-id',
    'actor-101003'
  );

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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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

  await openActorInspector(page);
  await page
    .locator(
      '[data-testid="workbench-actor-kibo-select"][data-character-id="109001"]'
    )
    .selectOption('500001');
  await closeInspectorIfVisible(page);
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
    .click();
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }

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
    .click();
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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

test('[stage-10c-frame-cursor-review] links timeline frames, eight curve states, actions, and runtime logs', async ({
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
  ).toHaveCount(8);
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
    .click();
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
  const resourceAction = page.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await resourceAction.dragTo(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
    ),
    { targetPosition: { x: 420, y: 26 } }
  );
  await expect(resourceAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await resourceAction.click();
  await page.getByTestId('workbench-start-frame-input').fill('600');

  const actorEnergyCurve = page.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-101003"] [data-testid="workbench-timeline-state-curve"]'
  );
  let energyBreakpoint = actorEnergyCurve.getByTestId(
    'workbench-timeline-state-curve-breakpoint'
  );
  const originalResourceFrame = Number(
    await energyBreakpoint.getAttribute('data-frame-index')
  );
  expect(originalResourceFrame).toBe(600);
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

test('[stage-11a-contribution-windows] aggregates three tracks and returns to the exact runtime point', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page.getByTestId('workbench-add-resource-action').click();
  await page
    .getByTestId('workbench-action-actor-select')
    .selectOption('101003');

  const panel = page.getByTestId('workbench-cycle-section-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute('data-selected-window-id', 'full-axis');
  await expect(
    panel.getByTestId('workbench-cycle-section-actor-row')
  ).toHaveCount(3);
  const actorOne = panel.locator(
    '[data-testid="workbench-cycle-section-actor-row"][data-actor-id="actor-109001"]'
  );
  const actorTwo = panel.locator(
    '[data-testid="workbench-cycle-section-actor-row"][data-actor-id="actor-101003"]'
  );
  expect(
    Number(await actorOne.getAttribute('data-enemy-hp-delta'))
  ).toBeGreaterThan(0);
  expect(
    Number(await actorTwo.getAttribute('data-self-energy-delta'))
  ).not.toBe(0);

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
  await expect(panel).toHaveAttribute(
    'data-selected-window-id',
    'cycle-section-02'
  );
  await page.getByTestId('workbench-contribution-window-axis').click();
  await expect(panel).toHaveAttribute('data-selected-window-id', 'full-axis');
  await panel.screenshot({
    path: 'reports/stage-11a-contribution-desktop.png',
  });

  await page
    .locator(
      '[data-testid="workbench-cycle-section-tab"][data-section-id="cycle-section-02"]'
    )
    .click();
  const actionTwo = panel.locator(
    '[data-testid="workbench-cycle-section-action-row"][data-action-id="action-0002"]'
  );
  const locate = actionTwo.getByTestId('workbench-cycle-section-locate-action');
  const statePointId = await locate.getAttribute('data-state-point-id');
  const frameIndex = await locate.getAttribute('data-frame-index');
  expect(statePointId).toBeTruthy();
  expect(frameIndex).toBeTruthy();
  await locate.click();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(statePointId);
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-timeline-cursor-frame-index',
    frameIndex
  );
  await expect(
    page.locator('.action-item[data-action-id="action-0002"]')
  ).toHaveClass(/selected/);

  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByTestId('workbench-contribution-window-axis').click();
  await expectPageWithoutHorizontalOverflow(page);
  expect(
    await panel
      .getByTestId('workbench-contribution-actor-table')
      .evaluate(element => element.scrollWidth - element.clientWidth)
  ).toBe(0);
  await panel.screenshot({ path: 'reports/stage-11a-contribution-narrow.png' });
});

test('[stage-11b-window-comparison] compares one cycle and opens the baseline contribution', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page.getByTestId('workbench-add-resource-action').click();
  await page
    .getByTestId('workbench-action-actor-select')
    .selectOption('101003');
  await page.getByTestId('workbench-start-frame-input').fill('120');
  await page.getByTestId('workbench-start-frame-input').press('Tab');
  await page.getByTestId('workbench-resource-change-input').fill('50');
  await page.getByTestId('workbench-resource-change-input').press('Tab');

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
  await page.getByTestId('workbench-scenario-duplicate').click();
  await page.locator('.action-item[data-action-id="action-0002"]').click();
  await page.getByTestId('workbench-resource-change-input').fill('80');
  await page.getByTestId('workbench-resource-change-input').press('Tab');

  await clickProjectMenuCommand(page, 'workbench-open-comparison');
  await page
    .getByTestId('workbench-comparison-workspace-scenario')
    .selectOption('scenario-0001');
  const comparison = page.getByTestId('workbench-scenario-comparison');
  await expect(
    comparison.getByTestId('workbench-comparison-window')
  ).toHaveCount(3);
  await comparison
    .locator(
      '[data-testid="workbench-comparison-window"][data-window-id="cycle-section-02"]'
    )
    .click();
  const actorTwo = comparison.locator(
    '[data-testid="workbench-comparison-actor-row"][data-current-actor-id="actor-101003"]'
  );
  await expect(actorTwo).toHaveAttribute('data-energy-delta', '30');
  const actionTwo = comparison.locator(
    '[data-testid="workbench-comparison-action-row"][data-current-action-id="action-0002"]'
  );
  await expect(actionTwo).toHaveAttribute(
    'data-baseline-action-id',
    'action-0002'
  );
  await comparison
    .locator('.comparison-dialog')
    .screenshot({ path: 'reports/stage-11b-comparison-desktop.png' });

  await page.setViewportSize({ width: 390, height: 900 });
  await expectPageWithoutHorizontalOverflow(page);
  await comparison.locator('.comparison-content').evaluate(element => {
    element.scrollTop = 0;
  });
  await page.screenshot({ path: 'reports/stage-11b-comparison-narrow.png' });

  const locateBaseline = actionTwo.getByTestId(
    'workbench-comparison-locate-baseline-action'
  );
  const baselineStatePointId = await locateBaseline.getAttribute(
    'data-state-point-id'
  );
  await locateBaseline.click();
  await expect(comparison).toBeHidden();
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0001'
  );
  await expect(
    page.locator('.action-item[data-action-id="action-0002"]')
  ).toHaveClass(/selected/);
  await expect(page.getByTestId('workbench-resource-change-input')).toHaveValue(
    '50'
  );
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-source', 'scenario-comparison-baseline');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(baselineStatePointId);
});

test('[stage-12a-analysis-report] exports, validates, and reopens frozen analysis sources', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page.getByTestId('workbench-add-resource-action').click();
  await page
    .getByTestId('workbench-action-actor-select')
    .selectOption('101003');
  await page.getByTestId('workbench-start-frame-input').fill('120');
  await page.getByTestId('workbench-start-frame-input').press('Tab');
  await page.getByTestId('workbench-resource-change-input').fill('50');
  await page.getByTestId('workbench-resource-change-input').press('Tab');
  await page.getByTestId('workbench-scenario-duplicate').click();
  await page.locator('.action-item[data-action-id="action-0002"]').click();
  await page.getByTestId('workbench-resource-change-input').fill('80');
  await page.getByTestId('workbench-resource-change-input').press('Tab');

  await clickProjectMenuCommand(page, 'workbench-open-comparison');
  await page
    .getByTestId('workbench-comparison-workspace-scenario')
    .selectOption('scenario-0001');
  const comparison = page.getByTestId('workbench-scenario-comparison');
  await expect(
    comparison.getByTestId('workbench-comparison-action-row')
  ).toHaveCount(2);
  await page.getByTestId('workbench-export-comparison-report').click();
  const reportDialog = page.getByTestId('workbench-analysis-report');
  await expect(comparison).toBeHidden();
  await expect(reportDialog).toBeVisible();
  const comparisonDownloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-analysis-report-export-json').click();
  const comparisonDownload = await comparisonDownloadPromise;
  const comparisonDownloadPath = await comparisonDownload.path();
  expect(comparisonDownloadPath).toBeTruthy();
  expect(comparisonDownload.suggestedFilename()).toMatch(
    /promilia-analysis-comparison-.*\.promilia-analysis\.json$/
  );
  const comparisonReport = JSON.parse(
    await readFile(comparisonDownloadPath, 'utf8')
  );
  expect(comparisonReport).toMatchObject({
    schemaVersion: 1,
    game: 'azur-promilia',
    type: 'workbench-analysis-report',
    analysisKind: 'scenario-comparison',
    calculationBoundary: {
      sourceKind: 'applied-runtime-outputs',
      readsRuntimeOutputsOnly: true,
      appliedToCalculators: false,
    },
    summary: {
      sourceCount: 2,
      actionReferenceCount: 4,
    },
  });
  expect(comparisonReport.sources).toHaveLength(2);
  expect(
    comparisonReport.appliedSourceBindings.every(binding =>
      binding.transactions.every(
        transaction => transaction.sourceDeltaIds.length > 0
      )
    )
  ).toBe(true);

  await page.getByTestId('workbench-analysis-report-close').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(comparisonDownloadPath);
  await expect(reportDialog).toBeVisible();
  await expect(
    reportDialog.getByTestId('workbench-analysis-report-validation')
  ).toHaveAttribute('data-validation-status', 'valid');
  await expect(
    reportDialog.getByTestId('workbench-analysis-report-source')
  ).toHaveCount(2);
  await expect(
    reportDialog.getByTestId('workbench-analysis-report-action')
  ).toHaveCount(2);
  await reportDialog.locator('.report-dialog').screenshot({
    path: 'reports/stage-12a-analysis-report-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/stage-12a-analysis-report-narrow.png',
  });

  const reportAction = reportDialog.locator(
    '[data-testid="workbench-analysis-report-action"][data-baseline-action-id="action-0002"]'
  );
  const locateBaseline = reportAction.getByTestId(
    'workbench-analysis-report-locate-baseline'
  );
  const baselineStatePointId =
    comparisonReport.analysis.comparison.actions.find(
      action => action.baselineActionId === 'action-0002'
    ).baselineStatePointId;
  await locateBaseline.click();
  await expect(reportDialog).toBeHidden();
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '3');
  await expect(workbench).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0003'
  );
  await expect(
    page.locator('.action-item[data-action-id="action-0002"]')
  ).toHaveClass(/selected/);
  await expect(page.getByTestId('workbench-resource-change-input')).toHaveValue(
    '50'
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(baselineStatePointId);
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-source', 'analysis-report');

  await page.getByTestId('workbench-export-contribution-report').click();
  await expect(reportDialog).toBeVisible();
  const contributionDownloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-analysis-report-export-json').click();
  const contributionDownload = await contributionDownloadPromise;
  const contributionReport = JSON.parse(
    await readFile(await contributionDownload.path(), 'utf8')
  );
  expect(contributionReport).toMatchObject({
    type: 'workbench-analysis-report',
    analysisKind: 'contribution-window',
    summary: { sourceCount: 1 },
  });
});

test('[stage-12b-analysis-report-png] exports and reopens a visual report with embedded metadata', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page.getByTestId('workbench-export-contribution-report').click();
  const reportDialog = page.getByTestId('workbench-analysis-report');
  await expect(reportDialog).toBeVisible();
  await expect(reportDialog).toHaveAttribute(
    'data-report-kind',
    'contribution-window'
  );
  const pngDownloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-analysis-report-export-png').click();
  const pngDownload = await pngDownloadPromise;
  const pngDownloadPath = await pngDownload.path();
  expect(pngDownloadPath).toBeTruthy();
  expect(pngDownload.suggestedFilename()).toMatch(
    /promilia-analysis-contribution-.*\.png$/
  );
  const reportPngPath = resolve('reports/stage-12b-analysis-report.png');
  await pngDownload.saveAs(reportPngPath);
  const pngBytes = await readFile(reportPngPath);
  expect([...pngBytes.subarray(0, 8)]).toEqual([
    137, 80, 78, 71, 13, 10, 26, 10,
  ]);
  expect(pngBytes.length).toBeGreaterThan(20_000);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导出分析报告 PNG'
  );

  await page.getByTestId('workbench-analysis-report-close').click();
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(reportPngPath);
  await expect(reportDialog).toBeVisible();
  await expect(
    reportDialog.getByTestId('workbench-analysis-report-validation')
  ).toHaveAttribute('data-validation-status', 'valid');
  await expect(
    reportDialog.getByTestId('workbench-analysis-report-source')
  ).toHaveCount(1);
  await expect(
    reportDialog.getByTestId('workbench-analysis-report-action')
  ).toHaveCount(1);
  await reportDialog.locator('.report-dialog').screenshot({
    path: 'reports/stage-12b-analysis-report-dialog-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/stage-12b-analysis-report-dialog-narrow.png',
  });

  const locate = reportDialog.getByTestId(
    'workbench-analysis-report-locate-current'
  );
  const statePointId = await locate.getAttribute('data-state-point-id');
  await locate.click();
  await expect(reportDialog).toBeHidden();
  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(
    page.locator('.action-item[data-action-id="action-0001"]')
  ).toHaveClass(/selected/);
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(statePointId);
});

test('[stage-12c-analysis-report-reproducibility] audits exact, drifted, and incompatible frozen outputs', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await page.getByTestId('workbench-export-contribution-report').click();
  const reportDialog = page.getByTestId('workbench-analysis-report');
  const reproducibility = page.getByTestId(
    'workbench-analysis-report-reproducibility'
  );
  await expect(reportDialog).toHaveAttribute(
    'data-reproducibility-status',
    'exact'
  );
  await expect(reproducibility).toHaveAttribute(
    'data-reproducibility-status',
    'exact'
  );

  const jsonDownloadPromise = page.waitForEvent('download');
  await page.getByTestId('workbench-analysis-report-export-json').click();
  const jsonDownload = await jsonDownloadPromise;
  const originalReport = JSON.parse(
    await readFile(await jsonDownload.path(), 'utf8')
  );
  await page.getByTestId('workbench-analysis-report-close').click();

  const driftedReport = structuredClone(originalReport);
  driftedReport.analysis.window.metrics.enemyHpDelta += 1;
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: 'drifted.promilia-analysis.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(driftedReport)),
  });
  await expect(reportDialog).toHaveAttribute(
    'data-reproducibility-status',
    'drift'
  );
  await expect(reproducibility).toHaveAttribute(
    'data-reproducibility-status',
    'drift'
  );
  const difference = page.getByTestId('workbench-analysis-report-difference');
  await expect(difference).toHaveCount(1);
  await expect(difference).toHaveAttribute(
    'data-difference-path',
    '$.analysis.window.metrics.enemyHpDelta'
  );
  await reportDialog.locator('.report-dialog').screenshot({
    path: 'reports/stage-12c-analysis-reproducibility-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/stage-12c-analysis-reproducibility-narrow.png',
  });
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-workspace-scenario-count',
    '1'
  );
  await page.getByTestId('workbench-analysis-report-close').click();

  const incompatibleReport = structuredClone(originalReport);
  incompatibleReport.sources[0].scenarioDraft.mechanicsProfileSelection = {
    schemaVersion: 1,
    contractName: 'AzPrWorkbenchMechanicsProfileSelection',
    profileId: 'removed-profile',
    profileVersion: 99,
  };
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: 'incompatible.promilia-analysis.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(incompatibleReport)),
  });
  await expect(reportDialog).toHaveAttribute(
    'data-reproducibility-status',
    'incompatible'
  );
  await expect(reproducibility).toHaveAttribute(
    'data-reproducibility-status',
    'incompatible'
  );
  await expect(reproducibility).toContainText('机制 profile 已无法精确解析');
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-workspace-scenario-count',
    '1'
  );
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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
  await openActorInspector(page);
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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
  await clickProjectMenuCommand(page, 'workbench-export-project-png');
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

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();
  const projectBuffer = await readFile(downloadPath);

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
    '仅支持 JSON 分析/项目文件或 PNG 项目'
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
  await openActionInspector(page);
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const baselineDownload = await downloadPromise;
  const baselinePath = await baselineDownload.path();
  expect(baselinePath).toBeTruthy();

  await clickProjectMenuCommand(page, 'workbench-open-comparison');
  const comparison = page.getByTestId('workbench-scenario-comparison');
  await expect(comparison).toBeVisible();
  await page.getByTestId('workbench-comparison-capture-current').click();
  await expect(
    page.getByTestId('workbench-comparison-baseline-source')
  ).toContainText('当前快照');
  await page.getByTestId('workbench-comparison-close').click();

  await openActionInspector(page);
  await page.getByTestId('workbench-start-frame-input').fill('36');
  await page.getByTestId('workbench-start-frame-input').press('Tab');
  await clickProjectMenuCommand(page, 'workbench-open-comparison');
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
  ).toHaveAttribute('data-edit-focus-source', 'contribution-window');

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
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
  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
  await clickProjectMenuCommand(page, 'workbench-export-project');
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

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
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
  await clickProjectMenuCommand(page, 'workbench-open-comparison');
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
    rowCount: 15,
    labelCount: 15,
    rowsSeparated: true,
    labelsAligned: true,
  });
}

async function openProjectMenu(page) {
  const menu = page.getByTestId('workbench-project-menu');
  if (!(await menu.evaluate(element => element.open))) {
    await menu.locator('summary').click();
  }
  return menu;
}

async function clickProjectMenuCommand(page, testId) {
  const menu = await openProjectMenu(page);
  await menu.getByTestId(testId).click();
  if (await menu.evaluate(element => element.open)) {
    await menu.evaluate(element => {
      element.open = false;
    });
  }
}

async function openActorInspector(page, characterId = 109001) {
  await page
    .locator(
      `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"]`
    )
    .click();
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
}

async function openActionInspector(page, actionId = 'action-0001') {
  await page
    .locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
    )
    .click();
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
}

async function closeInspectorIfVisible(page) {
  const inspector = page.getByTestId('workbench-side-inspector');
  if (await inspector.isVisible()) {
    await page.getByTestId('workbench-close-side-inspector').click();
  }
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

async function expectDemoMilestoneState(page, { resourceFrameIndex }) {
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorEnergyCurve = characterId =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-${characterId}"] [data-testid="workbench-timeline-state-curve"]`
    );
  const kiboEnergyCurves = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"] [data-testid="workbench-timeline-state-curve"]'
  );
  const resourceBreakpoint = actorEnergyCurve(101003).locator(
    '[data-testid="workbench-timeline-state-curve-breakpoint"][data-action-id="demo-actor-2-energy"]'
  );

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
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(kiboEnergyCurves).toHaveCount(3);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve')
  ).toHaveCount(8);
  await expect(actorEnergyCurve(109001)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(actorEnergyCurve(101003)).toHaveAttribute(
    'data-point-count',
    '1'
  );
  await expect(actorEnergyCurve(101007)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(kiboEnergyCurves.nth(0)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(kiboEnergyCurves.nth(1)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(kiboEnergyCurves.nth(2)).toHaveAttribute(
    'data-point-count',
    '0'
  );
  await expect(resourceBreakpoint).toHaveAttribute(
    'data-frame-index',
    String(resourceFrameIndex)
  );
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-point-count', '3');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-toughness-curve"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-point-count', '1');
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
        left: Math.round(rect.left),
        right: Math.round(rect.right),
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

async function readM1ANarrowLayout(page) {
  return page.evaluate(() => {
    const timeline = document.querySelector(
      '[data-testid="workbench-timeline-grid-preview"]'
    );
    const viewport = document.querySelector(
      '[data-testid="workbench-timeline-viewport"]'
    );
    const rows = [
      ...document.querySelectorAll('[data-testid="workbench-timeline-row"]'),
    ];
    const labels = [
      ...document.querySelectorAll(
        '[data-testid="workbench-timeline-lane-label"]'
      ),
    ];
    const rowRects = rows.map(row => row.getBoundingClientRect());
    const labelRects = labels.map(label => label.getBoundingClientRect());
    return {
      laneCount: rows.length,
      actorIdentityCount: document.querySelectorAll(
        '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"]'
      ).length,
      timelineWidth: Math.round(timeline?.getBoundingClientRect().width ?? 0),
      timelineClientWidth: viewport?.clientWidth ?? 0,
      timelineScrollWidth: viewport?.scrollWidth ?? 0,
      labelWidths: labelRects.map(rect => Math.round(rect.width)),
      rowsSeparated: rowRects.every(
        (rect, index) =>
          index === 0 || rect.top >= rowRects[index - 1].bottom - 0.5
      ),
      labelsAligned: rowRects.every(
        (rect, index) => Math.abs(rect.top - labelRects[index]?.top) <= 0.5
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

async function dragLocatorTo(
  page,
  source,
  target,
  { sourcePosition = null, targetPosition = null } = {}
) {
  await target.scrollIntoViewIfNeeded();
  const scrolledWithinLibrary = await source.evaluate(element => {
    const scrollContainer = element.closest('.action-library');
    if (!scrollContainer) {
      return false;
    }
    const sourceRect = element.getBoundingClientRect();
    const containerRect = scrollContainer.getBoundingClientRect();
    scrollContainer.scrollTop +=
      sourceRect.top -
      containerRect.top -
      Math.max(0, (containerRect.height - sourceRect.height) / 2);
    return true;
  });
  if (!scrolledWithinLibrary) {
    await source.scrollIntoViewIfNeeded();
  }
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('Drag source and target must both be visible');
  }
  const from = {
    x: sourceBox.x + (sourcePosition?.x ?? sourceBox.width / 2),
    y: sourceBox.y + (sourcePosition?.y ?? sourceBox.height / 2),
  };
  const to = {
    x: targetBox.x + (targetPosition?.x ?? targetBox.width / 2),
    y: targetBox.y + (targetPosition?.y ?? targetBox.height / 2),
  };
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 8, from.y + 2, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 16 });
  await page.mouse.up();
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
