import { Buffer } from 'node:buffer';
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '@playwright/test';
import {
  BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
  createBasicWorkbenchDraftFixture,
} from './helpers/basic-workbench-draft';
import { createSixResourceCaptureBatchFixture } from './helpers/six-resource-capture-fixture';

const execFileAsync = promisify(execFile);
const frameToMs = frame => Number(((Number(frame) * 1000) / 60).toFixed(6));
const M2_LOADOUT_CONFIGS = [
  {
    kiboId: '500001',
    soulessenceId: '10001',
    equipment: {
      weapon: '1010111',
      top: '1020111',
      bottom: '1030111',
      earring: '1040111',
      ring: '1050111',
    },
  },
  {
    kiboId: '500002',
    soulessenceId: '10002',
    equipment: {
      weapon: '1010211',
      top: '1020211',
      bottom: '1030211',
      earring: '1040211',
      ring: '1050211',
    },
  },
  {
    kiboId: '500003',
    soulessenceId: '10008',
    equipment: {
      weapon: '1010311',
      top: '1020311',
      bottom: '1030311',
      earring: '1040311',
      ring: '1050311',
    },
  },
];
const M8D_TUNING_MARK_PROFILES = [
  { markId: 150, profileKey: 'fire' },
  { markId: 850, profileKey: 'water' },
  { markId: 350, profileKey: 'ice' },
  { markId: 750, profileKey: 'wind' },
  { markId: 550, profileKey: 'wood' },
  { markId: 650, profileKey: 'earth' },
  { markId: 250, profileKey: 'thunder' },
  { markId: 950, profileKey: 'light' },
  { markId: 450, profileKey: 'dark' },
];

test.beforeEach(async ({ page }, testInfo) => {
  if (
    testInfo.title.includes('[m1d-demo-milestone]') ||
    testInfo.title.includes('[m6-verified-combat-workflow]') ||
    testInfo.title.includes('[m7-catalog-runtime-workflow]') ||
    testInfo.title.includes('[m8d-verified-mechanics-ui]') ||
    testInfo.title.includes('[m9-r2-r1-inspector-duration]') ||
    testInfo.title.includes('[m9-r3-xiaoyu-mechanics]') ||
    testInfo.title.includes('[m9-r3-r2-xiaoyu-forms-occupancy]') ||
    testInfo.title.includes('[m9-r3-r2-r1-xiaoyu-burst-chain]') ||
    testInfo.title.includes('[m9-r3-r2-r2-xiaoyu-hidden-inputs]') ||
    testInfo.title.includes('[m9-r3-r2-r3-contextual-edge]') ||
    testInfo.title.includes('[m9-r3-r1-timeline-layout]') ||
    testInfo.title.includes('[m10-b1-ruby-profile-ui]') ||
    testInfo.title.includes('[m10-b1-r2-ruby-replay]') ||
    testInfo.title.includes('[m10-b1-r2-switch-cooldown]') ||
    testInfo.title.includes('[m10-b1-r3-ruby-star-carry-entry]') ||
    testInfo.title.includes('[m10-b2-han-firework-runtime]') ||
    testInfo.title.includes('[m11-c-canonical-trace-workbench]')
  ) {
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
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-special-resource-curve"]'
    )
  ).toHaveCount(0);
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

test('[controlled-actor-timeline] edits, reviews, and restores the active character at exact frames', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const controlledActorReadout = page.getByTestId(
    'workbench-controlled-actor-readout'
  );
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
    )
  ).toHaveCount(3);

  await openActorInspector(page, 109001);
  const initialActorSelect = page.getByTestId(
    'workbench-initial-controlled-actor-select'
  );
  await expect(initialActorSelect).toHaveValue('109001');
  await initialActorSelect.selectOption('101007');
  await expect(controlledActorReadout).toHaveAttribute(
    'data-character-id',
    '101007'
  );
  await closeInspectorIfVisible(page);

  await page.getByTestId('workbench-add-switch-action').click();
  const switchAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await expect(switchAction).toBeVisible();
  await switchAction.click();
  await page.getByTestId('workbench-start-frame-input').fill('120');
  await switchAction.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '120');
  await expect(controlledActorReadout).toHaveAttribute(
    'data-character-id',
    '109001'
  );
  await expect(
    timeline.getByTestId('workbench-controlled-actor-interval')
  ).toHaveCount(2);

  await switchAction.press('ArrowRight');
  await switchAction.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '121');
  await switchAction.press('Delete');
  await expect(switchAction).toHaveCount(0);
  await expect(controlledActorReadout).toHaveAttribute(
    'data-character-id',
    '101007'
  );

  await page.getByTestId('workbench-undo-edit').click();
  await expect(switchAction).toBeVisible();
  await switchAction.click();
  await expect(controlledActorReadout).toHaveAttribute(
    'data-character-id',
    '109001'
  );
  await page.getByTestId('workbench-save-draft').click();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已保存草稿'
  );

  await page.reload();
  await expect(timeline).toBeVisible();
  await expect(switchAction).toBeVisible();
  await switchAction.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '121');
  await expect(controlledActorReadout).toHaveAttribute(
    'data-character-id',
    '109001'
  );
  await page.screenshot({
    path: 'reports/controlled-actor-timeline-desktop.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await expect(timeline).toBeVisible();
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
    )
  ).toHaveCount(3);
  await page.screenshot({
    path: 'reports/controlled-actor-timeline-narrow.png',
    fullPage: true,
  });
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
    curve(laneId).getByTestId('workbench-timeline-state-curve-node');
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
  await closeInspectorIfVisible(page);
  await expect(inspector).toBeHidden();
  await expect(actorIdentities).toHaveCount(3);
  await expect(actorIdentities.nth(0)).toContainText('末音');
  await expect(actorIdentities.nth(1)).toContainText('寒悠悠');
  await expect(actorIdentities.nth(2)).toContainText('芃芃');
  await expect(actorIdentities.locator('img')).toHaveCount(3);

  const desktopLayout = await readTimelineFirstLayout(page);
  expect(desktopLayout.laneCount).toBe(15);
  expect(desktopLayout.timeline.width).toBeGreaterThanOrEqual(1100);
  expect(desktopLayout.timeline.height).toBeGreaterThanOrEqual(660);
  expect(desktopLayout.timeline.bottom).toBeLessThanOrEqual(900);
  expect(desktopLayout.shell.scrollHeight).toBeGreaterThan(
    desktopLayout.shell.clientHeight
  );
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
  await expectTimelineTrackReadability(timeline);
  await expectPageWithoutHorizontalOverflow(page);

  const timelineHeightBeforeZoom = desktopLayout.timeline.height;
  await page.getByTestId('workbench-timeline-zoom-input').fill('2');
  await expect(page.getByTestId('workbench-timeline-zoom-value')).toHaveText(
    '2x'
  );
  const zoomedLayout = await readTimelineFirstLayout(page);
  expect(zoomedLayout.viewport.scrollWidth).toBeGreaterThan(
    zoomedLayout.viewport.clientWidth
  );
  expect(zoomedLayout.timeline.height).toBe(timelineHeightBeforeZoom);
  expect(zoomedLayout.shell.clientHeight).toBe(
    desktopLayout.shell.clientHeight
  );
  await page.getByTestId('workbench-timeline-zoom-input').fill('1');
  await page.screenshot({ path: 'reports/m1a-workbench-desktop.png' });

  const timelineBoxBeforeInspector = await timeline.boundingBox();
  await actorIdentities.nth(0).locator('.lane-identity-command').click();
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
    await openActorInspector(page, binding.characterId);
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
    await selectM2LoadoutOption(
      page,
      binding.characterId,
      'kiboId',
      binding.kiboId
    );
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

  await selectM2Enemy(page, '300071');
  await timeline
    .locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="enemy-hp-curve"]'
    )
    .click();
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(
    inspector.locator('[data-inspector-panel-key="enemy"]')
  ).toHaveAttribute('data-inspector-panel-order', '0');
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
  await expectTimelineTrackReadability(timeline);
  const desktopLayout = await readTimelineFirstLayout(page);
  expect(desktopLayout.timeline.bottom).toBeLessThanOrEqual(900);
  expect(desktopLayout.shell.scrollHeight).toBeGreaterThan(
    desktopLayout.shell.clientHeight
  );
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
  await selectM2LoadoutOption(page, 101003, 'kiboId', '500002');
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
  const hpSimulationPointCountBefore = Number(
    await hpCurve.getAttribute('data-simulation-point-count')
  );

  const directSkillSource = getSingleSkillActionEntry(page);
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
    .poll(async () =>
      Number(await hpCurve.getAttribute('data-simulation-point-count'))
    )
    .toBeGreaterThan(hpSimulationPointCountBefore);
  const hpPointCountAfterSkill = Number(
    await hpCurve.getAttribute('data-point-count')
  );
  const skillHpBreakpoint = hpCurve.locator(
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0002"]'
  );
  await expect(skillHpBreakpoint).toHaveCount(1);
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
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0003"]'
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
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0003"]'
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
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0003"]'
  );
  await resourceBreakpoint.click();
  const resourceStatePointId = await resourceBreakpoint.getAttribute(
    'data-state-point-id'
  );
  await openRuntimeReviewTab(page, 'event');
  await closeInspectorIfVisible(page);
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

test('[m2-team-configuration] configures and reloads source-backed loadouts from demo and empty scenarios', async ({
  page,
}) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await setWorkbenchTimelineDuration(page, 30_000);

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expectTimelineActionWidthsMatchDuration(timeline);
  const initialSlot3CharacterId = 101007;
  const demoActorIds = [109001, 101003, 101010];
  await page
    .locator(
      `[data-testid="workbench-action-library-actor"][data-character-id="${initialSlot3CharacterId}"]`
    )
    .click();
  const migratedDemoActions = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-lane-id="actor-${initialSlot3CharacterId}"]`
  );
  const migratedDemoActionCount = await migratedDemoActions.count();
  expect(migratedDemoActionCount).toBeGreaterThan(0);

  const demoSlot3 = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-3"]'
  );
  await demoSlot3.getByTestId('workbench-direct-character-picker').click();
  await expect(page.getByTestId('workbench-loadout-picker')).toBeVisible();
  await page.screenshot({ path: 'reports/m2-direct-picker-desktop.png' });
  await page
    .getByTestId('workbench-loadout-picker')
    .locator(
      '[data-testid="workbench-loadout-option"][data-option-id="101010"]'
    )
    .click();
  await expect(page.getByTestId('workbench-loadout-picker')).toBeHidden();
  const migratedTargetActions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-lane-id="actor-101010"]'
  );
  await expect
    .poll(() => migratedTargetActions.count())
    .toBeGreaterThanOrEqual(migratedDemoActionCount);
  await expect(migratedDemoActions).toHaveCount(0);
  await expect(
    page.locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
  ).toHaveAttribute('data-active', 'true');

  await timeline
    .locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="101010"] [data-testid="workbench-direct-kibo-picker"]'
    )
    .click();
  await expectM2PickerScrollContainment(page, 100);
  await page.screenshot({
    path: 'reports/m2-loadout-picker-scroll-desktop.png',
  });
  await page.getByTestId('workbench-loadout-close').click();
  await expect(page.getByTestId('workbench-loadout-picker')).toBeHidden();

  await configureM2TeamDirectly(page, demoActorIds);
  const demoSoulSlot = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-character-id="101010"] [data-testid="workbench-direct-loadout-slot"][data-loadout-slot="soulessenceId"]'
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(demoSoulSlot).toHaveAttribute('data-selected-id', '');
  await page.getByTestId('workbench-redo-edit').click();
  await expect(demoSoulSlot).toHaveAttribute(
    'data-selected-id',
    M2_LOADOUT_CONFIGS[2].soulessenceId
  );
  await selectM2Enemy(page, '300071');
  await expect(
    (await openEnemyInspector(page)).getByTestId('workbench-enemy-name')
  ).toHaveText('菜鸡');
  await expectLoadedImage(
    timeline.getByTestId('workbench-direct-enemy-picker').locator('img')
  );

  await closeInspectorIfVisible(page);
  const demoActionCount = await timeline
    .getByTestId('workbench-timeline-action')
    .count();
  await dragLocatorTo(
    page,
    getSingleSkillActionEntry(page),
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="actor-${demoActorIds[2]}"]`
    ),
    { targetPosition: { x: 760, y: 24 } }
  );
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    demoActionCount + 1
  );
  await expectTimelineRowsAligned(timeline);
  await expect
    .poll(() =>
      timeline.evaluate(element => element.getBoundingClientRect().bottom)
    )
    .toBeLessThanOrEqual(900);
  await page.screenshot({ path: 'reports/m2-direct-equipped-desktop.png' });
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await hydrateM2LoadoutCatalog(page, demoActorIds[0]);
  await expectM2TeamDirect(page, demoActorIds);
  await expect(
    (await openEnemyInspector(page)).getByTestId('workbench-enemy-name')
  ).toHaveText('菜鸡');

  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 120_000);
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    0
  );
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101007"]'
    )
    .click();
  await addSingleSkillAction(page);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-lane-id="actor-101007"]'
    )
  ).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  const emptySlot3 = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-3"]'
  );
  await emptySlot3.getByTestId('workbench-direct-character-picker').click();
  await expect(page.getByTestId('workbench-loadout-picker')).toBeVisible();
  await page.screenshot({ path: 'reports/m2-direct-picker-narrow.png' });
  await page
    .getByTestId('workbench-loadout-picker')
    .locator(
      '[data-testid="workbench-loadout-option"][data-option-id="101010"]'
    )
    .click();
  await expect(page.getByTestId('workbench-loadout-picker')).toBeHidden();
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-lane-id="actor-101010"]'
    )
  ).toHaveCount(1);
  await expect(
    page.locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
  ).toHaveAttribute('data-active', 'true');

  await emptySlot3
    .locator(
      '[data-testid="workbench-direct-loadout-slot"][data-loadout-slot="soulessenceId"]'
    )
    .click();
  await expectM2PickerScrollContainment(page, 50);
  await page.screenshot({
    path: 'reports/m2-loadout-picker-scroll-narrow.png',
  });
  await page.getByTestId('workbench-loadout-close').click();
  await expect(page.getByTestId('workbench-loadout-picker')).toBeHidden();

  const emptyActorIds = [109001, 101003, 101010];
  await closeInspectorIfVisible(page);
  await configureM2TeamDirectly(page, emptyActorIds);
  const emptySoulSlot = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-character-id="101010"] [data-testid="workbench-direct-loadout-slot"][data-loadout-slot="soulessenceId"]'
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(emptySoulSlot).toHaveAttribute('data-selected-id', '');
  await page.getByTestId('workbench-redo-edit').click();
  await expect(emptySoulSlot).toHaveAttribute(
    'data-selected-id',
    M2_LOADOUT_CONFIGS[2].soulessenceId
  );
  await selectM2Enemy(page, '300071');

  await page.setViewportSize({ width: 1440, height: 900 });
  const emptyActionCount = await timeline
    .getByTestId('workbench-timeline-action')
    .count();
  await dragLocatorTo(
    page,
    getSingleSkillActionEntry(page),
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="actor-${emptyActorIds[2]}"]`
    ),
    { targetPosition: { x: 420, y: 24 } }
  );
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    emptyActionCount + 1
  );
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await hydrateM2LoadoutCatalog(page, emptyActorIds[0]);
  await expectM2TeamDirect(page, emptyActorIds);
  await expect(
    (await openEnemyInspector(page)).getByTestId('workbench-enemy-name')
  ).toHaveText('菜鸡');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve')
  ).toHaveCount(9);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-special-resource-curve"]'
    )
  ).toHaveCount(1);

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({ path: 'reports/m2-direct-timeline-narrow.png' });
});

test('[m8a-static-loadout] recompiles actor and kibo panels after direct equipment changes and draft reload', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await openActorInspector(page, 109001);

  const actorLoadout = page.locator(
    '[data-testid="workbench-actor-loadout"][data-character-id="109001"]'
  );
  const actorPanel = actorLoadout.getByTestId(
    'workbench-verified-static-property-panel'
  );
  await expect(actorPanel).toHaveAttribute(
    'data-property-status',
    'verified-static-actor-properties-ready',
    { timeout: 60_000 }
  );
  const actorAttackBefore = await readVerifiedPanelValue(actorPanel, '攻击');
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500001');
  const kiboPanel = actorPanel.getByTestId(
    'workbench-verified-kibo-property-panel'
  );
  await expect(kiboPanel).toBeVisible();
  const kiboAttackBefore = await readVerifiedPanelValue(kiboPanel, '攻击');

  await selectM2LoadoutOption(page, 109001, 'weapon', '1010111');
  await selectM2LoadoutOption(page, 109001, 'top', '1020111');
  await selectM2LoadoutOption(page, 109001, 'soulessenceId', '10001');
  await actorLoadout
    .getByTestId('workbench-actor-star-gift-rank-input')
    .fill('2');
  await actorLoadout.getByTestId('workbench-actor-star-gift-rank-input').blur();
  await actorLoadout.getByTestId('workbench-kibo-intimacy-input').fill('5');
  await actorLoadout.getByTestId('workbench-kibo-intimacy-input').blur();

  await expect
    .poll(() => readVerifiedPanelValue(actorPanel, '攻击'))
    .toBeGreaterThan(actorAttackBefore);
  await expect
    .poll(() => readVerifiedPanelValue(kiboPanel, '攻击'))
    .toBeGreaterThan(kiboAttackBefore);
  const actorAttackAfter = await readVerifiedPanelValue(actorPanel, '攻击');
  const kiboAttackAfter = await readVerifiedPanelValue(kiboPanel, '攻击');
  await expect(actorPanel).toContainText('动态层未应用');
  await actorPanel.scrollIntoViewIfNeeded();
  await expect(actorPanel).toBeVisible();
  await page.screenshot({ path: 'reports/m8a-static-loadout-desktop.png' });

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await openActorInspector(page, 109001);
  const restoredActorLoadout = page.locator(
    '[data-testid="workbench-actor-loadout"][data-character-id="109001"]'
  );
  const restoredActorPanel = restoredActorLoadout.getByTestId(
    'workbench-verified-static-property-panel'
  );
  await expect(restoredActorPanel).toHaveAttribute(
    'data-property-status',
    'verified-static-actor-properties-ready',
    { timeout: 60_000 }
  );
  const restoredKiboPanel = restoredActorPanel.getByTestId(
    'workbench-verified-kibo-property-panel'
  );
  await expect
    .poll(() => readVerifiedPanelValue(restoredActorPanel, '攻击'))
    .toBe(actorAttackAfter);
  await expect
    .poll(() => readVerifiedPanelValue(restoredKiboPanel, '攻击'))
    .toBe(kiboAttackAfter);
  await expect(
    restoredActorLoadout.getByTestId('workbench-actor-star-gift-rank-input')
  ).toHaveValue('2');
  await expect(
    restoredActorLoadout.getByTestId('workbench-kibo-intimacy-input')
  ).toHaveValue('5');
});

test('[m8d-verified-mechanics-ui] reviews real tuning marks and the action mechanics chain on the shared timeline', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const packageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.goto('/#/workbench');
  await packageResponse;
  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await page.getByTestId('workbench-save-draft').click();
  await page.evaluate(
    ({ storageKey, profiles }) => {
      const draft = JSON.parse(window.localStorage.getItem(storageKey));
      const tuningMarks = profiles
        .filter(profile => profile.profileKey !== 'fire')
        .map(profile => ({
          ...profile,
          heldReadyRemainingMs: 60_000,
          layers: [
            {
              remainingDurationMs: 25_000,
              sourceIdentity: {
                sourceKind: 'm8d-standard-vector',
                profileKey: profile.profileKey,
              },
            },
          ],
        }));
      const applyToScenarioDrafts = value => {
        if (!value || typeof value !== 'object') return;
        if (
          Array.isArray(value.actorConfigs) &&
          Array.isArray(value.actionDrafts)
        ) {
          value.initialRuntimeState = {
            ...(value.initialRuntimeState ?? {}),
            controlledActor: {
              actorId: 'actor-101003',
              characterId: 101003,
            },
            tuningMarks,
          };
        }
        Object.values(value).forEach(applyToScenarioDrafts);
      };
      applyToScenarioDrafts(draft);
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    },
    {
      storageKey: BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
      profiles: M8D_TUNING_MARK_PROFILES,
    }
  );

  const reloadedPackageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.reload();
  await reloadedPackageResponse;
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await openActorInspector(page, 101003);
  await expect(
    page
      .locator(
        '[data-testid="workbench-actor-loadout"][data-character-id="101003"]'
      )
      .getByTestId('workbench-verified-static-property-panel')
  ).toHaveAttribute(
    'data-property-status',
    'verified-static-actor-properties-ready',
    { timeout: 60_000 }
  );
  await closeInspectorIfVisible(page);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  const source = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100312"][data-action-kind="star-skill"]'
  );
  await expect(source).toBeVisible();
  await dragLocatorTo(
    page,
    source,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
    ),
    { targetPosition: { x: 160, y: 82 } }
  );

  const action = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100312"]'
  );
  await expect(action).toHaveCount(1);
  const actionId = await action.getAttribute('data-action-id');
  expect(actionId).toBeTruthy();
  const tuningLanes = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="tuning-mark-curve"]'
  );
  await expect(timeline).toHaveAttribute('data-tuning-mark-track-count', '9');
  await expect(tuningLanes).toHaveCount(9);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve')
  ).toHaveCount(17);

  const fireLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-150"]'
  );
  const fireAcquisitions = fireLane.locator(
    `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"][data-event-kinds*="acquire"]`
  );
  await expect(fireAcquisitions).toHaveCount(2);
  const firstAcquisition = fireAcquisitions.first();
  await expectTimelineCurveNodeFrameAlignment(timeline, firstAcquisition);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-effect-interval"][data-effect-id="tuning-mark:150:persistent"]'
    )
  ).toHaveCount(0);

  await firstAcquisition.click();
  const acquisitionFrame =
    await firstAcquisition.getAttribute('data-frame-index');
  await expect(timeline).toHaveAttribute(
    'data-flow-selected-action-id',
    actionId
  );
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    acquisitionFrame
  );
  const trace = page.getByTestId('workbench-verified-mechanics-trace');
  await expect(trace).toBeVisible();
  await expect(trace).toHaveAttribute('data-binding-identity', /10100312/u);
  await expect
    .poll(async () =>
      Number(await trace.getAttribute('data-runtime-hit-count'))
    )
    .toBeGreaterThan(0);
  await expect
    .poll(async () =>
      Number(await trace.getAttribute('data-runtime-tuning-count'))
    )
    .toBeGreaterThan(0);
  await expect(
    trace.getByTestId('workbench-verified-mechanics-trace-step')
  ).toHaveCount(6);
  await expect(trace).toContainText('动作数值溯源');
  await expect(trace).toContainText('动作形态');
  await expect(trace).toContainText('属性快照');
  await expect(trace).toContainText('命中结果');
  await expect(trace).toContainText('印记');

  const acquisitionFrameBeforeMove = Number(acquisitionFrame);
  await action.press('ArrowRight');
  await expect
    .poll(async () =>
      Number(await fireAcquisitions.first().getAttribute('data-frame-index'))
    )
    .toBe(acquisitionFrameBeforeMove + 1);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(fireAcquisitions.first()).toHaveAttribute(
    'data-frame-index',
    String(acquisitionFrameBeforeMove)
  );

  await page.getByTestId('workbench-timeline-zoom-input').evaluate(element => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await fireLane.scrollIntoViewIfNeeded();
  await expectTimelineCurveNodeFrameAlignment(timeline, firstAcquisition);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m8d-verified-mechanics-desktop.png',
  });

  await page.getByTestId('workbench-save-draft').click();
  const restoredPackageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.reload();
  await restoredPackageResponse;
  await expect(timeline).toHaveAttribute('data-tuning-mark-track-count', '9');
  await expect(fireAcquisitions).toHaveCount(2);

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await fireLane.scrollIntoViewIfNeeded();
  await expectTimelineCurveNodeFrameAlignment(timeline, firstAcquisition);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m8d-verified-mechanics-narrow.png',
  });
});

test('[six-resource-capture-import] packages, imports, and replays six owner-specific resource captures', async ({
  page,
}, testInfo) => {
  const { draft, actorIds, captures } = createSixResourceCaptureBatchFixture({
    captureSessionPrefix: 'production-preview-six-resource',
  });
  await page.evaluate(
    ({ storageKey, draftState }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(draftState));
    },
    { storageKey: BASIC_WORKBENCH_DRAFT_STORAGE_KEY, draftState: draft }
  );
  await page.reload();
  await expect(page.getByTestId('scenario-action-count')).toHaveText(
    '6 action'
  );

  const captureDirectory = testInfo.outputPath('six-resource-captures');
  await mkdir(captureDirectory, { recursive: true });
  const inputPaths = await Promise.all(
    captures.map(async (capture, index) => {
      const inputPath = resolve(captureDirectory, `capture-${index + 1}.json`);
      await writeFile(inputPath, `${JSON.stringify(capture, null, 2)}\n`);
      return inputPath;
    })
  );
  const normalizedPath = resolve(
    captureDirectory,
    'six-resource-captures.normalized.json'
  );
  const normalizeArguments = inputPaths.flatMap(inputPath => [
    '--input',
    inputPath,
  ]);
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      'scripts/normalize-runtime-capture.mjs',
      ...normalizeArguments,
      '--output',
      normalizedPath,
    ],
    { cwd: process.cwd() }
  );
  expect(JSON.parse(stdout)).toMatchObject({
    inputFileCount: 6,
    captureCount: 6,
    eventCount: 6,
  });
  const normalizedEnvelope = JSON.parse(await readFile(normalizedPath, 'utf8'));
  expect(normalizedEnvelope).toMatchObject({
    normalizedBy: 'promilia-axis-tool/runtime-capture-normalizer-v2',
    sourceFiles: expect.arrayContaining(
      inputPaths.map(path =>
        expect.objectContaining({ path: path.replaceAll('\\', '/') })
      )
    ),
  });
  expect(normalizedEnvelope.captures).toHaveLength(6);

  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(normalizedPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入实测 6 组'
  );
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
    )
  ).toHaveCount(3);
  for (const [index, actorId] of actorIds.entries()) {
    const sampledCurve = timeline.locator(
      `[data-testid="workbench-timeline-state-curve"][data-track-key="kiboEnergyChange"][data-actor-id="${actorId}"]`
    );
    await expect(sampledCurve).toHaveAttribute(
      'data-simulation-point-count',
      '1'
    );
    await expect(sampledCurve).toHaveAttribute(
      'data-point-count',
      index === 0 ? '0' : '1'
    );
  }

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const projectPath = await download.path();
  expect(projectPath).toBeTruthy();
  const exportedProject = JSON.parse(await readFile(projectPath, 'utf8'));
  expect(
    exportedProject.runtimeSampleCaptures.map(capture => [
      capture.workbenchBinding.actionId,
      capture.workbenchBinding.actorId,
      capture.workbenchBinding.resolutionKind,
    ])
  ).toEqual([
    ['role-action-1', actorIds[0], 'resource-owner-action'],
    ['role-action-2', actorIds[1], 'resource-owner-action'],
    ['role-action-3', actorIds[2], 'resource-owner-action'],
    ['kibo-action-1', actorIds[0], 'resource-owner-action'],
    ['kibo-action-2', actorIds[1], 'resource-owner-action'],
    ['kibo-action-3', actorIds[2], 'resource-owner-action'],
  ]);

  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(projectPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  for (const [index, actorId] of actorIds.entries()) {
    const restoredCurve = timeline.locator(
      `[data-testid="workbench-timeline-state-curve"][data-track-key="kiboEnergyChange"][data-actor-id="${actorId}"]`
    );
    await expect(restoredCurve).toHaveAttribute(
      'data-simulation-point-count',
      '1'
    );
    await expect(restoredCurve).toHaveAttribute(
      'data-point-count',
      index === 0 ? '0' : '1'
    );
  }
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
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await setWorkbenchTimelineDuration(page, 30_000);

  await expect(page.getByTestId('workbench-scenario-name')).toHaveText(
    '示例方案 · 预览数据'
  );
  await expectDemoMilestoneState(page, { resourceFrameIndex: 288 });
  const demoActionCount = await page.locator('.action-item').count();
  expect(demoActionCount).toBe(17);
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
  await expect(page.locator('.action-item')).toHaveCount(demoActionCount + 1);
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
    )
  ).toHaveAttribute('data-lane-id', 'actor-101003');
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

test('[m1-trial-release-workflow] keeps a populated slot through configuration, review, edit, and project recovery', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await setWorkbenchTimelineDuration(page, 30_000);

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
  );
  const kiboEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
  );
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);

  await openActorInspector(page, 101007);
  await changeM2TeamSlot(page, 2, 101010);

  const replacementLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101010"]'
  );
  const migratedAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="demo-actor-3-skill"]'
  );
  await expect(replacementLane).toBeVisible();
  await expect(migratedAction).toHaveAttribute('data-lane-id', 'actor-101010');
  await expect(
    page.locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
  ).toHaveAttribute('data-active', 'true');

  await selectM2LoadoutOption(page, 101010, 'kiboId', '500004');
  await expect(page.getByTestId('workbench-action-library-kibo')).toHaveText(
    '奇波 · 汐灵偶'
  );
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-3"]'
    )
  ).toContainText('汐灵偶');

  await closeInspectorIfVisible(page);
  await dragLocatorTo(page, getSingleSkillActionEntry(page), replacementLane, {
    targetPosition: { x: 760, y: 26 },
  });
  const insertedAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  await expect(insertedAction).toHaveAttribute('data-lane-id', 'actor-101010');

  const insertedActionNodes = timeline.locator(
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="action-0002"]'
  );
  await expect(insertedActionNodes.first()).toBeVisible();
  expect(await insertedActionNodes.count()).toBeGreaterThan(0);
  const reviewedEvents = timeline.locator(
    '[data-testid="workbench-timeline-state-curve"]:not([data-track-key^="tuningMark:"]) [data-testid="workbench-timeline-state-curve-node"][data-action-id^="action-0001"]'
  );
  await expect(reviewedEvents.first()).toBeVisible();
  const clickableEventIndex = await reviewedEvents.evaluateAll(nodes =>
    nodes.findIndex(node => {
      const bounds = node.getBoundingClientRect();
      const hitTarget = document.elementFromPoint(
        bounds.left + bounds.width / 2,
        bounds.top + bounds.height / 2
      );
      return hitTarget === node || node.contains(hitTarget);
    })
  );
  expect(clickableEventIndex).toBeGreaterThanOrEqual(0);
  const reviewedEvent = reviewedEvents.nth(clickableEventIndex);
  const reviewedActionId = await reviewedEvent.getAttribute('data-action-id');
  const reviewedFrameIndex = Number(
    await reviewedEvent.getAttribute('data-frame-index')
  );
  expect(reviewedActionId).toMatch(/^action-0001/);
  expect(reviewedFrameIndex).toBeGreaterThanOrEqual(0);
  await reviewedEvent.click();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toBeVisible();
  await closeInspectorIfVisible(page);
  const insertedStartBeforeEdit = Number(
    await insertedAction.getAttribute('data-start-ms')
  );
  await insertedAction.press('ArrowRight');
  await expect
    .poll(async () =>
      Number(await insertedAction.getAttribute('data-start-ms'))
    )
    .toBeGreaterThan(insertedStartBeforeEdit);
  const restoredReviewedEvent = timeline
    .locator(
      `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${reviewedActionId}"][data-frame-index="${reviewedFrameIndex}"]`
    )
    .first();

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await expect(migratedAction).toHaveAttribute('data-lane-id', 'actor-101010');
  await expect(insertedAction).toHaveAttribute('data-lane-id', 'actor-101010');
  await expect(restoredReviewedEvent).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const downloadPath = await (await downloadPromise).path();
  await clickProjectMenuCommand(page, 'workbench-reset-draft');
  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await expect(migratedAction).toHaveAttribute('data-lane-id', 'actor-101010');
  await expect(insertedAction).toHaveAttribute('data-lane-id', 'actor-101010');
  await expect(restoredReviewedEvent).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1-trial-release-desktop.png' });

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1-trial-release-narrow.png' });
});

test('[m1-empty-scenario-workflow] builds and restores a six-energy-axis project from zero actions', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const timelineActions = timeline.getByTestId('workbench-timeline-action');
  const actorEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
  );
  const kiboEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
  );
  const specialResourceRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-special-resource-curve"]'
  );
  const stateCurves = timeline.getByTestId('workbench-timeline-state-curve');
  const expectEmptyTimeline = async (expectedSpecialResourceCount = 0) => {
    await expect(timelineActions).toHaveCount(0);
    await expect(
      timeline.locator(
        '[data-testid="workbench-timeline-state-curve-node"][data-action-id]:not([data-action-id=""])'
      )
    ).toHaveCount(0);
    await expect(actorEnergyRows).toHaveCount(3);
    await expect(kiboEnergyRows).toHaveCount(3);
    await expect(specialResourceRows).toHaveCount(expectedSpecialResourceCount);
    await expect(stateCurves).toHaveCount(8 + expectedSpecialResourceCount);
    expect(
      await timeline
        .locator(
          '[data-testid="workbench-timeline-row"][data-lane-id^="enemy-"] [data-testid="workbench-timeline-state-curve-line"]'
        )
        .evaluateAll(lines =>
          lines.every(line => {
            const points = line
              .getAttribute('points')
              .split(' ')
              .map(point => point.split(',').map(Number));
            return points.length === 2 && points[0][1] === points[1][1];
          })
        )
    ).toBe(true);
  };
  const actorLaneLabel = characterId =>
    timeline.locator(
      `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"]`
    );
  const curve = laneId =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve"]`
    );

  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-active-workspace-scenario-id',
    'scenario-0002'
  );
  await expectEmptyTimeline();
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
    )
    .click();
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-action-placement-mode',
    'assisted'
  );

  await changeM2TeamSlot(page, 2, 101010);
  const kiboBindings = [
    { characterId: 109001, kiboId: '500001', name: '迅狼' },
    { characterId: 101003, kiboId: '500002', name: '水灵仔' },
    { characterId: 101010, kiboId: '500004', name: '汐灵偶' },
  ];
  for (const binding of kiboBindings) {
    await selectM2LoadoutOption(
      page,
      binding.characterId,
      'kiboId',
      binding.kiboId
    );
  }
  await selectM2Enemy(page, '300071');
  await expectEmptyTimeline(1);

  await openActorInspector(page, 101003);
  await closeInspectorIfVisible(page);
  const actorTwoLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
  );
  await dragLocatorTo(page, getSingleSkillActionEntry(page), actorTwoLane, {
    targetPosition: { x: 300, y: 26 },
  });
  await closeInspectorIfVisible(page);
  await dragLocatorTo(
    page,
    page.getByTestId('workbench-add-resource-action'),
    actorTwoLane,
    { targetPosition: { x: 500, y: 26 } }
  );
  await closeInspectorIfVisible(page);
  await page
    .locator(
      '[data-testid="workbench-kibo-action-entry"][data-skill-id="502015"]'
    )
    .click();
  await closeInspectorIfVisible(page);
  await page.getByTestId('workbench-add-enemy-event-action').click();
  await closeInspectorIfVisible(page);

  await expect(timelineActions).toHaveCount(4);
  const resourceAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-type="resource"]'
  );
  const skillAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-type="skill"]'
  );
  const kiboAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-type="kiboEvent"]'
  );
  const skillActionId = await skillAction.getAttribute('data-action-id');
  const resourceActionId = await resourceAction.getAttribute('data-action-id');
  const kiboActionId = await kiboAction.getAttribute('data-action-id');
  expect(skillActionId).toBeTruthy();
  expect(resourceActionId).toBeTruthy();
  expect(kiboActionId).toBeTruthy();
  await expect(resourceAction).toHaveAttribute('data-lane-id', 'actor-101003');
  await expect(kiboAction).toHaveAttribute('data-lane-id', 'kibo-team-slot-2');
  for (let slotIndex = 1; slotIndex <= 3; slotIndex += 1) {
    await expect(curve(`kibo-energy-team-slot-${slotIndex}`)).toHaveAttribute(
      'data-track-key',
      'kiboEnergyChange'
    );
    await expect(
      curve(`kibo-energy-team-slot-${slotIndex}`).locator(
        `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${kiboActionId}"]`
      )
    ).toHaveCount(0);
  }
  for (const laneId of ['enemy-hp-curve', 'enemy-toughness-curve']) {
    const skillNodes = curve(laneId).locator(
      `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${skillActionId}"]`
    );
    await expect(skillNodes.first()).toBeVisible();
    expect(await skillNodes.count()).toBeGreaterThan(0);
  }

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(timelineActions).toHaveCount(4);
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await expect(actorLaneLabel(101010)).toBeVisible();
  for (const [index, binding] of kiboBindings.entries()) {
    await expect(
      timeline.locator(
        `[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-${index + 1}"]`
      )
    ).toContainText(binding.name);
  }
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="enemy-event"]'
    )
  ).toContainText('菜鸡');

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const downloadPath = await (await downloadPromise).path();
  const deleteButtons = page.getByTestId('workbench-delete-action');
  while ((await deleteButtons.count()) > 0) {
    await deleteButtons.first().click();
  }
  await expectEmptyTimeline(1);

  await page
    .getByTestId('workbench-import-project-file')
    .setInputFiles(downloadPath);
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已导入项目'
  );
  await expect(timelineActions).toHaveCount(4);
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await expect(actorLaneLabel(101010)).toBeVisible();
  await expectTimelineRowsAligned(timeline);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1-empty-scenario-desktop.png' });

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await expectTimelineRowsAligned(timeline);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m1-empty-scenario-narrow.png' });
});

test('[m3-real-action-status-workflow] generates and replays sourced cooldown and effect state from real action-library drags', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await openActorInspector(page, 101003);
  await page
    .getByTestId('workbench-initial-controlled-actor-select')
    .selectOption('101003');
  await closeInspectorIfVisible(page);
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
  );
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  const removedManualLifecycleSource = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100322"][data-action-kind="star-carry"]'
  );
  const trackingOnlySource = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100312"][data-action-kind="star-skill"]'
  );
  await expect(removedManualLifecycleSource).toHaveCount(0);
  await expect(trackingOnlySource).toBeVisible();

  await page.getByTestId('workbench-add-switch-action').click();
  let parentSwitchAction = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    )
    .last();
  await expect(parentSwitchAction).toHaveCount(1);
  let lifecycleAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100322"][data-derived-action-kind="switch-triggered-star-carry"][data-readiness-status="ready"]'
  );
  await expect(lifecycleAction).toHaveCount(1);
  await expect(lifecycleAction).toHaveAttribute('data-read-only', 'true');
  await expect(lifecycleAction).toHaveAttribute(
    'data-status-generation-status',
    'action-status-generation-ready-with-lifecycle'
  );
  await expect(lifecycleAction).toHaveAttribute(
    'data-generated-effect-count',
    '1'
  );
  const lifecycleActionId =
    await lifecycleAction.getAttribute('data-action-id');
  let cooldown = timeline.locator(
    `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${lifecycleActionId}"]`
  );
  let interval = timeline.locator(
    `[data-testid="workbench-timeline-effect-interval"][data-source-action-id="${lifecycleActionId}"]`
  );
  await expect(cooldown).toHaveCount(1);
  await expect(cooldown).toContainText('就绪生效');
  await expect(interval).toHaveCount(1);
  await expect(interval).toContainText('防御力降低');
  await expect(interval).toContainText('未应用');
  await expect(interval).toHaveAttribute('data-start-frame-index', /\d+/);
  await expect(interval).toHaveAttribute('data-end-frame-index', /\d+/);
  await expectGeneratedStatusTiming(lifecycleAction, cooldown, interval);

  await interval.click();
  await expect(timeline).toHaveAttribute(
    'data-flow-selected-action-id',
    lifecycleActionId
  );
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    await interval.getAttribute('data-end-frame-index')
  );
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
  await expect(
    page.getByTestId('workbench-switch-trigger-bindings')
  ).toContainText('自动子动作');
  await expect(page.getByTestId('workbench-effect-command-row')).toHaveCount(0);
  const lifecycleEvents = page.getByTestId(
    'workbench-effect-interval-lifecycle-event'
  );
  await expect(lifecycleEvents).toHaveCount(2);
  await lifecycleEvents.first().click();
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    await interval.getAttribute('data-start-frame-index')
  );
  await closeInspectorIfVisible(page);

  const intervalStartBeforeMove = Number(
    await interval.getAttribute('data-start-ms')
  );
  await parentSwitchAction.press('ArrowRight');
  await expect
    .poll(async () => Number(await interval.getAttribute('data-start-ms')))
    .toBeGreaterThan(intervalStartBeforeMove);
  const intervalStartAfterMove = Number(
    await interval.getAttribute('data-start-ms')
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect
    .poll(async () => Number(await interval.getAttribute('data-start-ms')))
    .toBe(intervalStartBeforeMove);
  await page.getByTestId('workbench-redo-edit').click();
  await expect
    .poll(async () => Number(await interval.getAttribute('data-start-ms')))
    .toBe(intervalStartAfterMove);

  await dragLocatorTo(page, trackingOnlySource, actorLane, {
    targetPosition: { x: 320, y: 82 },
  });
  const trackingOnlyAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100312"]'
  );
  await expect(trackingOnlyAction).toHaveCount(1);
  const trackingOnlyActionId =
    await trackingOnlyAction.getAttribute('data-action-id');
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-effect-interval"][data-source-action-id="${trackingOnlyActionId}"]`
    )
  ).toHaveCount(0);

  await parentSwitchAction.press('Delete');
  await expect(parentSwitchAction).toHaveCount(0);
  await expect(lifecycleAction).toHaveCount(0);
  await expect(interval).toHaveCount(0);
  await page.getByTestId('workbench-undo-edit').click();
  parentSwitchAction = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    )
    .last();
  lifecycleAction = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${lifecycleActionId}"]`
  );
  interval = timeline.locator(
    `[data-testid="workbench-timeline-effect-interval"][data-source-action-id="${lifecycleActionId}"]`
  );
  cooldown = timeline.locator(
    `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${lifecycleActionId}"]`
  );
  await expect(interval).toHaveCount(1);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(interval).toHaveCount(0);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(interval).toHaveCount(1);

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(interval).toHaveCount(1);
  await expectGeneratedStatusTiming(lifecycleAction, cooldown, interval);

  await page.getByTestId('workbench-timeline-zoom-input').evaluate(element => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await lifecycleAction.scrollIntoViewIfNeeded();
  await expectGeneratedStatusPixelAlignment(
    timeline,
    lifecycleAction,
    cooldown,
    interval
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m3-action-status-desktop.png' });

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await lifecycleAction.scrollIntoViewIfNeeded();
  await expectGeneratedStatusPixelAlignment(
    timeline,
    lifecycleAction,
    cooldown,
    interval
  );
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m3-action-status-narrow.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('workbench-timeline-zoom-input').evaluate(element => {
    element.value = '1';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    0
  );
  await openActorInspector(page, 101003);
  await page
    .getByTestId('workbench-initial-controlled-actor-select')
    .selectOption('101003');
  await closeInspectorIfVisible(page);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  await page.getByTestId('workbench-add-switch-action').click();
  const emptyScenarioAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100322"][data-derived-action-kind="switch-triggered-star-carry"]'
  );
  await expect(emptyScenarioAction).toHaveCount(1);
  const emptyScenarioActionId =
    await emptyScenarioAction.getAttribute('data-action-id');
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-effect-interval"][data-source-action-id="${emptyScenarioActionId}"]`
    )
  ).toHaveCount(1);
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-effect-interval"][data-source-action-id="${emptyScenarioActionId}"]`
    )
  ).toHaveCount(1);
});

test('[m3-cooldown-sources-and-stacking] reads water kibo and ultimate cooldowns, blocks reuse, and separates rows', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await selectM2LoadoutOption(page, 101007, 'kiboId', '500003');
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101007"]'
    )
    .click();
  const kiboSource = page.locator(
    '[data-testid="workbench-kibo-action-entry"][data-kibo-id="500003"][data-skill-id="50000302"]'
  );
  await expect(kiboSource).toBeVisible();
  await expect(kiboSource).toHaveAttribute('data-cooldown-ms', '24000');
  await expect(kiboSource).toContainText('CD 24s');
  await dragLocatorTo(
    page,
    kiboSource,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-3"]'
    ),
    { targetPosition: { x: 180, y: 36 } }
  );
  const kiboAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-type="kiboEvent"][data-skill-id="50000302"]'
  );
  await expect(kiboAction).toHaveCount(1);
  const kiboActionId = await kiboAction.getAttribute('data-action-id');
  const kiboCooldown = timeline.locator(
    `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${kiboActionId}"]`
  );
  await expect(kiboCooldown).toHaveAttribute('data-owner-kind', 'kibo');
  await expect(kiboCooldown).toHaveAttribute('data-owner-id', '500003');
  await expect(kiboCooldown).toHaveAttribute('data-base-duration-ms', '24000');
  await expect(kiboCooldown).toHaveAttribute(
    'data-effective-duration-ms',
    '24000'
  );
  await expect
    .poll(async () => {
      const startMs = Number(await kiboCooldown.getAttribute('data-start-ms'));
      const endMs = Number(await kiboCooldown.getAttribute('data-end-ms'));
      return Math.round(endMs - startMs);
    })
    .toBe(24000);

  await dragLocatorTo(
    page,
    kiboSource,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-3"]'
    ),
    { targetPosition: { x: 450, y: 36 } }
  );
  await expect(kiboAction).toHaveCount(2);
  const blockedKiboAction = kiboAction.nth(1);
  await expect(blockedKiboAction).toHaveAttribute(
    'data-readiness-status',
    'blocked'
  );
  await expect
    .poll(() =>
      blockedKiboAction.evaluate(element => ({
        redBorder:
          getComputedStyle(element).borderTopColor.includes('245, 108, 108'),
        redBackground:
          getComputedStyle(element).backgroundImage.includes('84, 48, 51'),
      }))
    )
    .toEqual({
      redBorder: true,
      redBackground: true,
    });
  const blockedKiboActionId =
    await blockedKiboAction.getAttribute('data-action-id');
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${blockedKiboActionId}"]`
    )
  ).toHaveCount(0);

  await openActorInspector(page, 101003);
  await page
    .getByTestId('workbench-initial-controlled-actor-select')
    .selectOption('101003');
  await closeInspectorIfVisible(page);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  const secondSkillSource = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100312"][data-action-kind="star-skill"]'
  );
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
  );
  await expect(
    page.locator(
      '[data-testid="workbench-skill-entry"][data-action-kind="star-carry"]'
    )
  ).toHaveCount(0);
  await page.getByTestId('workbench-add-switch-action').click();
  await dragLocatorTo(page, secondSkillSource, actorLane, {
    targetPosition: { x: 380, y: 82 },
  });
  const firstAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100322"][data-derived-action-kind="switch-triggered-star-carry"]'
  );
  const secondAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100312"]'
  );
  const firstCooldown = timeline.locator(
    `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${await firstAction.getAttribute('data-action-id')}"]`
  );
  const secondCooldown = timeline.locator(
    `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${await secondAction.getAttribute('data-action-id')}"]`
  );
  await expect(firstCooldown).toHaveCount(1);
  await expect(secondCooldown).toHaveCount(1);
  await expect
    .poll(async () => [
      await firstCooldown.getAttribute('data-cooldown-slot'),
      await secondCooldown.getAttribute('data-cooldown-slot'),
    ])
    .toEqual(expect.arrayContaining(['0', '1']));
  expect(
    await firstCooldown.evaluate(element => element.getBoundingClientRect().top)
  ).not.toBe(
    await secondCooldown.evaluate(
      element => element.getBoundingClientRect().top
    )
  );

  const unavailableUltimate = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100313"][data-action-kind="ultimate"]'
  );
  await expect(unavailableUltimate).toHaveAttribute('data-cooldown-ms', '');
  await expect(unavailableUltimate).toContainText('CD 未提供');

  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101007"]'
    )
    .click();
  const confirmedUltimate = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100713"][data-action-kind="ultimate"]'
  );
  await expect(confirmedUltimate).toHaveAttribute('data-cooldown-ms', '20000');
  await expect(confirmedUltimate).toContainText('CD 20s');
  await confirmedUltimate.click();
  await page.getByTestId('workbench-add-action').click();
  const ultimateAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100713"]'
  );
  const ultimateCooldown = timeline.locator(
    `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${await ultimateAction.getAttribute('data-action-id')}"]`
  );
  await expect
    .poll(async () => {
      const startMs = Number(
        await ultimateCooldown.getAttribute('data-start-ms')
      );
      const endMs = Number(await ultimateCooldown.getAttribute('data-end-ms'));
      return Math.round(endMs - startMs);
    })
    .toBe(20000);

  await confirmedUltimate.click();
  await page.getByTestId('workbench-add-action').click();
  await expect(ultimateAction).toHaveCount(2);
  const blockedUltimateAction = ultimateAction.nth(1);
  await expect(blockedUltimateAction).toHaveAttribute(
    'data-readiness-status',
    'blocked'
  );
  const blockedUltimateActionId =
    await blockedUltimateAction.getAttribute('data-action-id');
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-cooldown-window"][data-action-id="${blockedUltimateActionId}"]`
    )
  ).toHaveCount(0);

  await closeInspectorIfVisible(page);
  await timeline
    .locator('.timeline-shell')
    .evaluate(element => element.scrollTo({ top: 0 }));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m3-cooldown-stacking-desktop.png' });
  await kiboAction.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'reports/m3-water-kibo-cooldown-desktop.png' });
  await page.setViewportSize({ width: 390, height: 900 });
  await kiboAction.first().scrollIntoViewIfNeeded();
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({ path: 'reports/m3-water-kibo-cooldown-narrow.png' });
  await timeline
    .locator('.timeline-shell')
    .evaluate(element => element.scrollTo({ top: 0 }));
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m3-cooldown-stacking-narrow.png' });
});

test('[m4-constraint-placement] previews, commits, rejects, and restores real pointer scheduling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  const workbench = page.locator('main.workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
  );
  const cooldownSkill = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10900112"][data-action-kind="star-skill"]'
  );
  const timelineActions = timeline.getByTestId('workbench-timeline-action');
  const assistedMode = page.locator(
    '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
  );
  const freeMode = page.locator(
    '[data-testid="workbench-action-placement-mode-option"][data-mode="free"]'
  );

  await assistedMode.click();
  await expect(workbench).toHaveAttribute(
    'data-action-placement-mode',
    'assisted'
  );
  await beginPointerDragTo(page, cooldownSkill, actorLane, {
    targetPosition: { x: 280, y: 82 },
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-preview-active',
    'true'
  );
  await expect(
    timeline.getByTestId('workbench-action-placement-ghost')
  ).toBeVisible();
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(2);
  await expect(workbench).toHaveAttribute(
    'data-action-placement-preview-active',
    'false'
  );

  const firstCooldownAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0002"]'
  );
  const firstCooldownBox = await firstCooldownAction.boundingBox();
  const actorLaneBox = await actorLane.boundingBox();
  expect(firstCooldownBox).toBeTruthy();
  expect(actorLaneBox).toBeTruthy();
  await beginPointerDragTo(page, cooldownSkill, actorLane, {
    targetPosition: {
      x: firstCooldownBox.x - actorLaneBox.x + firstCooldownBox.width / 2,
      y: 82,
    },
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'adjustable'
  );
  await expect(
    timeline.getByTestId('workbench-action-placement-request-guide')
  ).toBeVisible();
  await expect(
    timeline.getByTestId('workbench-action-placement-suggested-guide')
  ).toBeVisible();
  await expect(
    timeline.getByTestId('workbench-action-placement-ghost')
  ).toHaveAttribute('data-placement-status', 'adjustable');
  await page.screenshot({
    path: 'reports/m4-constraint-placement-desktop.png',
  });
  await page.mouse.up();

  const assistedCooldownAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
  );
  await expect(assistedCooldownAction).toHaveAttribute(
    'data-readiness-status',
    'ready'
  );
  const firstStartMs = Number(
    await firstCooldownAction.getAttribute('data-start-ms')
  );
  const assistedStartMs = Number(
    await assistedCooldownAction.getAttribute('data-start-ms')
  );
  expect(assistedStartMs).toBeGreaterThan(firstStartMs);

  await page.getByTestId('workbench-undo-edit').click();
  await expect(timelineActions).toHaveCount(2);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(timelineActions).toHaveCount(3);

  const repeatedCooldownTarget = {
    x: firstCooldownBox.x - actorLaneBox.x + firstCooldownBox.width / 2,
    y: 82,
  };
  await dragLocatorTo(page, cooldownSkill, actorLane, {
    targetPosition: repeatedCooldownTarget,
  });
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-0004"]'
    )
  ).toHaveAttribute('data-readiness-status', 'ready');

  const actionCountBeforeBlockedDrop = await timelineActions.count();
  await beginPointerDragTo(page, cooldownSkill, actorLane, {
    targetPosition: repeatedCooldownTarget,
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-preview-active',
    'true'
  );
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'blocked'
  );
  await expect(
    timeline.getByTestId('workbench-action-placement-ghost')
  ).toHaveAttribute('data-placement-status', 'blocked');
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(actionCountBeforeBlockedDrop);

  await freeMode.click();
  await expect(workbench).toHaveAttribute('data-action-placement-mode', 'free');
  const restoredAssistedAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-0003"]'
  );
  const freeTargetBox = await firstCooldownAction.boundingBox();
  const freeLaneBox = await actorLane.boundingBox();
  await beginPointerDragTo(page, restoredAssistedAction, actorLane, {
    targetPosition: {
      x: freeTargetBox.x - freeLaneBox.x + freeTargetBox.width / 2,
      y: 82,
    },
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'adjustable'
  );
  await page.mouse.up();
  await expect(restoredAssistedAction).toHaveAttribute(
    'data-readiness-status',
    'blocked'
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(restoredAssistedAction).toHaveAttribute(
    'data-readiness-status',
    'ready'
  );

  await assistedMode.click();
  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await restoredAssistedAction.scrollIntoViewIfNeeded();
  const narrowSourceBox = await restoredAssistedAction.boundingBox();
  const narrowLaneBox = await actorLane.boundingBox();
  const narrowViewportBox = await timeline
    .getByTestId('workbench-timeline-viewport')
    .boundingBox();
  expect(narrowSourceBox).toBeTruthy();
  expect(narrowLaneBox).toBeTruthy();
  expect(narrowViewportBox).toBeTruthy();
  const narrowSourceCenterX = narrowSourceBox.x + narrowSourceBox.width / 2;
  const narrowVisibleLeft = Math.max(
    narrowLaneBox.x + 12,
    narrowViewportBox.x + 12
  );
  const narrowVisibleRight = Math.min(
    narrowLaneBox.x + narrowLaneBox.width - 12,
    narrowViewportBox.x + narrowViewportBox.width - 12
  );
  let narrowTargetClientX = Math.min(
    narrowVisibleRight,
    narrowSourceCenterX + 48
  );
  if (Math.abs(narrowTargetClientX - narrowSourceCenterX) < 20) {
    narrowTargetClientX = Math.max(narrowVisibleLeft, narrowSourceCenterX - 48);
  }
  await beginPointerDragTo(page, restoredAssistedAction, actorLane, {
    targetPosition: {
      x: narrowTargetClientX - narrowLaneBox.x,
      y: narrowSourceBox.y - narrowLaneBox.y + narrowSourceBox.height / 2,
    },
    scrollTargetIntoView: false,
  });
  await expect(
    timeline.getByTestId('workbench-action-placement-ghost')
  ).toBeVisible();
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/m4-constraint-placement-narrow.png',
  });
  await page.mouse.up();
  await expect(workbench).toHaveAttribute(
    'data-action-placement-preview-active',
    'false'
  );
});

test('[m5-reusable-timeline-fragments] saves, reuses, constrains, and restores a real actor-kibo relation group', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');

  const workbench = page.locator('main.workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const timelineActions = timeline.getByTestId('workbench-timeline-action');
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
  );
  const kiboLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-1"]'
  );
  const assistedMode = page.locator(
    '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
  );
  const freeMode = page.locator(
    '[data-testid="workbench-action-placement-mode-option"][data-mode="free"]'
  );

  await selectM2LoadoutOption(page, 109001, 'kiboId', '500003');
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="109001"]'
    )
    .click();
  const actorSource = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10900112"][data-action-kind="star-skill"]'
  );
  const kiboSource = page.locator(
    '[data-testid="workbench-kibo-action-entry"][data-kibo-id="500003"][data-skill-id="502019"]'
  );
  await dragLocatorTo(page, actorSource, actorLane, {
    targetPosition: { x: 120, y: 82 },
  });
  await dragLocatorTo(page, kiboSource, kiboLane, {
    targetPosition: { x: 120, y: 36 },
  });
  const sourceActorAction = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10900112"]'
    )
    .last();
  const sourceKiboAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="502019"]'
  );
  const sourceActionIds = [
    await sourceActorAction.getAttribute('data-action-id'),
    await sourceKiboAction.getAttribute('data-action-id'),
  ];
  expect(sourceActionIds.every(Boolean)).toBe(true);
  await boxSelectTimelineActions(page, sourceActionIds);
  await page.getByTestId('workbench-timeline-create-relations').click();
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');

  const fragmentLibrary = await openTimelineFragmentLibrary(page);
  await fragmentLibrary
    .getByTestId('workbench-fragment-name-input')
    .fill('末音与水灵偶连携');
  await fragmentLibrary
    .getByTestId('workbench-fragment-tags-input')
    .fill('连携, 起手');
  await fragmentLibrary.getByTestId('workbench-save-timeline-fragment').click();
  const fragmentCard = fragmentLibrary.getByTestId(
    'workbench-timeline-fragment'
  );
  await expect(fragmentCard).toHaveCount(1);
  await expect(fragmentCard).toHaveAttribute(
    'data-compatibility-status',
    'valid'
  );
  await expect(fragmentCard).toContainText('2 动作');
  await expect(fragmentCard).toContainText('角色 / 奇波');

  const fragmentExportPromise = page.waitForEvent('download');
  await fragmentLibrary
    .getByTestId('workbench-export-fragment-library')
    .click();
  const fragmentExport = await fragmentExportPromise;
  const fragmentExportPath = await fragmentExport.path();
  expect(fragmentExportPath).toBeTruthy();
  const exportedFragmentLibrary = JSON.parse(
    await readFile(fragmentExportPath, 'utf8')
  );
  expect(exportedFragmentLibrary.summary).toMatchObject({
    fragmentCount: 1,
    actionCount: 2,
  });

  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await expect(timelineActions).toHaveCount(0);
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500003');
  await assistedMode.click();
  const emptyFragmentLibrary = await openTimelineFragmentLibrary(page);
  const fragmentInsert = emptyFragmentLibrary.getByTestId(
    'workbench-insert-timeline-fragment'
  );
  await expect(fragmentInsert).toBeEnabled();
  await dragLocatorTo(page, fragmentInsert, actorLane, {
    targetPosition: { x: 120, y: 82 },
  });
  await expect(timelineActions).toHaveCount(2);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  const insertedActorActions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10900112"]'
  );
  const insertedKiboActions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="502019"]'
  );
  await expect(insertedActorActions).toHaveCount(1);
  await expect(insertedKiboActions).toHaveCount(1);
  await expect(insertedActorActions).toHaveAttribute(
    'data-lane-id',
    'actor-109001'
  );
  await expect(insertedKiboActions).toHaveAttribute(
    'data-lane-id',
    'kibo-team-slot-1'
  );
  for (const action of [insertedActorActions, insertedKiboActions]) {
    const actionId = await action.getAttribute('data-action-id');
    await expect(
      timeline.locator(
        '[data-testid="workbench-timeline-cooldown-window"][data-action-id="' +
          actionId +
          '"]'
      )
    ).toHaveCount(1);
  }
  await closeInspectorIfVisible(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m5-timeline-fragment-desktop.png',
  });

  await page.getByTestId('workbench-undo-edit').click();
  await expect(timelineActions).toHaveCount(0);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '0');
  await page.getByTestId('workbench-redo-edit').click();
  await expect(timelineActions).toHaveCount(2);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');

  const restoredActorAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10900112"]'
  );
  const actorActionBox = await restoredActorAction.boundingBox();
  const actorLaneBox = await actorLane.boundingBox();
  expect(actorActionBox).toBeTruthy();
  expect(actorLaneBox).toBeTruthy();
  const overlappingTarget = {
    x: actorActionBox.x - actorLaneBox.x + 2,
    y: 82,
  };
  const originalActorStartMs = Number(
    await restoredActorAction.getAttribute('data-start-ms')
  );

  await beginPointerDragTo(page, fragmentInsert, actorLane, {
    targetPosition: overlappingTarget,
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'adjustable'
  );
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(4);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '2');
  await expect(insertedActorActions).toHaveCount(2);
  const assistedActorStartMs = Number(
    await insertedActorActions.nth(1).getAttribute('data-start-ms')
  );
  expect(assistedActorStartMs).toBeGreaterThan(originalActorStartMs);
  await beginPointerDragTo(page, fragmentInsert, actorLane, {
    targetPosition: overlappingTarget,
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'adjustable'
  );
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(6);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '3');
  await beginPointerDragTo(page, fragmentInsert, actorLane, {
    targetPosition: overlappingTarget,
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'adjustable'
  );
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(8);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '4');
  let assistedActionCount = 8;
  let reachedTimelineLimit = false;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await beginPointerDragTo(page, fragmentInsert, actorLane, {
      targetPosition: overlappingTarget,
    });
    const placementStatus = await workbench.getAttribute(
      'data-action-placement-status'
    );
    await page.mouse.up();
    if (placementStatus === 'blocked') {
      reachedTimelineLimit = true;
      break;
    }
    expect(placementStatus).toBe('adjustable');
    assistedActionCount += 2;
    await expect(timelineActions).toHaveCount(assistedActionCount);
    await expect(workbench).toHaveAttribute(
      'data-action-relation-count',
      String(assistedActionCount / 2)
    );
  }
  expect(reachedTimelineLimit).toBe(true);
  await expect(timelineActions).toHaveCount(assistedActionCount);
  while (assistedActionCount > 2) {
    await page.getByTestId('workbench-undo-edit').click();
    assistedActionCount -= 2;
    await expect(timelineActions).toHaveCount(assistedActionCount);
  }

  await freeMode.click();
  await beginPointerDragTo(page, fragmentInsert, actorLane, {
    targetPosition: overlappingTarget,
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-status',
    'adjustable'
  );
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(4);
  await expect(insertedActorActions).toHaveCount(2);
  const freeActorStartMs = Number(
    await insertedActorActions.nth(1).getAttribute('data-start-ms')
  );
  expect(Math.abs(freeActorStartMs - originalActorStartMs)).toBeLessThanOrEqual(
    100
  );
  expect(freeActorStartMs).toBeLessThan(assistedActorStartMs);
  await expect(insertedActorActions.nth(1)).toHaveAttribute(
    'data-readiness-status',
    'blocked'
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(timelineActions).toHaveCount(2);

  await changeM2TeamSlot(page, 0, 101010);
  const incompatibleFragmentLibrary = await openTimelineFragmentLibrary(page);
  const incompatibleFragment = incompatibleFragmentLibrary.getByTestId(
    'workbench-timeline-fragment'
  );
  await expect(incompatibleFragment).toHaveAttribute(
    'data-compatibility-status',
    'blocked'
  );
  await expect(
    incompatibleFragmentLibrary.getByTestId(
      'workbench-insert-timeline-fragment'
    )
  ).toBeDisabled();
  await expect(timelineActions).toHaveCount(2);

  await changeM2TeamSlot(page, 0, 109001);
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500003');
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(timelineActions).toHaveCount(2);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="109001"] [data-testid="workbench-direct-kibo-picker"]'
    )
  ).toHaveAttribute('data-selected-id', '500003');

  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await expect(timelineActions).toHaveCount(0);
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500003');
  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await openTimelineFragmentLibrary(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  const narrowFragmentInsert = page.getByTestId(
    'workbench-insert-timeline-fragment'
  );
  await beginPointerDragTo(page, narrowFragmentInsert, actorLane, {
    targetPosition: { x: 76, y: 82 },
    scrollTargetIntoView: false,
  });
  await expect(workbench).toHaveAttribute(
    'data-action-placement-preview-active',
    'true'
  );
  await page.mouse.up();
  await expect(timelineActions).toHaveCount(2);
  await expect(workbench).toHaveAttribute('data-action-relation-count', '1');
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m5-timeline-fragment-narrow.png',
  });
});

test('[m6-verified-combat-workflow] drives eight curves from verified Pangpang and Heavy Rock Hoof actions', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const verifiedPackageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.goto('/#/workbench');
  await verifiedPackageResponse;

  const workbench = page.locator('main.workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(workbench).toHaveAttribute('data-energy-curve-count', '6');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-state-curve"]:not([data-track-key^="tuningMark:"])'
    )
  ).toHaveCount(8);

  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    0
  );
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500001');
  await selectM2LoadoutOption(page, 101003, 'kiboId', '500002');
  await selectM2LoadoutOption(page, 101007, 'kiboId', '500469');
  await timeline
    .locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-id="enemy-toughness-curve"]'
    )
    .press('Enter');
  await expect(
    page.getByTestId('workbench-enemy-initial-toughness-input')
  ).toBeVisible();
  await page
    .getByTestId('workbench-enemy-initial-toughness-input')
    .fill('0.01');
  await closeInspectorIfVisible(page);
  const verifiedMechanicsPackage = JSON.parse(
    await readFile(
      'src/data/generated/verified-combat-mechanics-package.json',
      'utf8'
    )
  );
  const pangAttackInput = verifiedMechanicsPackage.actionMappings
    .find(
      mapping =>
        mapping.ownerKind === 'actor' &&
        mapping.ownerId === 101007 &&
        mapping.actionKind === 'normal-attack'
    )
    .attackInputSegments.find(segment => segment.sequenceIndex === 3);
  expect(pangAttackInput).toMatchObject({
    controlSkillId: 10100703,
    durationStatus: 'applied',
    durationFrames: 31,
  });
  const pangActionDraft = {
    id: 'm6-pang-a3',
    type: 'skill',
    skillId: 10100701,
    actorCharacterId: 101007,
    level: 1,
    actionVariantIndex: 0,
    damageSegmentIndex: 0,
    startMs: frameToMs(60),
    durationMs: frameToMs(pangAttackInput.durationFrames),
    attackGroupId: 'm6-pang-a3',
    attackSequenceIndex: pangAttackInput.sequenceIndex,
    attackSequenceTotal: pangAttackInput.sequenceTotal,
    attackInput: pangAttackInput,
    note: 'M6 回归：已确认的芃芃 A3 独立输入段。',
  };
  await page.getByTestId('workbench-save-draft').click();
  await page.evaluate(pangAction => {
    const storageKey = 'promilia-axis-tool:workbench-draft:v17';
    const draft = JSON.parse(window.localStorage.getItem(storageKey));
    const initialRuntimeState = {
      kiboEnergyBySlot: [
        {
          slotId: 'team-slot-3',
          actorId: 'actor-101007',
          characterId: 101007,
          kiboId: 500469,
          currentValue: 100,
          maxValue: 100,
          valueUnit: 'absolute-sp-points',
        },
      ],
    };
    const applyToScenarioDrafts = value => {
      if (!value || typeof value !== 'object') return;
      if (
        Array.isArray(value.actorConfigs) &&
        Array.isArray(value.actionDrafts)
      ) {
        value.initialRuntimeState = initialRuntimeState;
        if (!value.actionDrafts.some(action => action.id === pangAction.id)) {
          value.actionDrafts.push(pangAction);
        }
      }
      Object.values(value).forEach(applyToScenarioDrafts);
    };
    applyToScenarioDrafts(draft);
    window.localStorage.setItem(storageKey, JSON.stringify(draft));
  }, pangActionDraft);
  const reloadedPackageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.reload();
  await reloadedPackageResponse;
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101007"]'
    )
    .click();

  const pangSource = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100701"][data-action-kind="normal-attack"]'
  );
  const heavySource = page.locator(
    '[data-testid="workbench-kibo-action-entry"][data-kibo-id="500469"][data-skill-id="50046903"]'
  );
  await expect(pangSource).toBeVisible();
  await expect(pangSource).toHaveAttribute('data-timing-status', 'unresolved');
  await expect(pangSource).toHaveAttribute(
    'data-scheduling-status',
    'planning'
  );
  await expect(pangSource).toBeEnabled();
  await expect(pangSource).toHaveAttribute('title', /可排轴/);
  await expect(heavySource).toBeVisible();

  await dragLocatorTo(
    page,
    heavySource,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-3"]'
    ),
    { targetPosition: { x: 650, y: 36 } }
  );

  const pangActions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100701"]'
  );
  const pangAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100701"][data-attack-sequence-index="3"]'
  );
  const pangBreakAction = pangAction;
  const heavyAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="50046903"]'
  );
  await expect(pangActions).toHaveCount(1);
  await expect(pangBreakAction).toHaveCount(1);
  await expect(pangAction).toHaveCount(1);
  await expect(heavyAction).toHaveCount(1);
  const pangBreakActionId =
    await pangBreakAction.getAttribute('data-action-id');
  const pangActionId = await pangAction.getAttribute('data-action-id');
  const heavyActionId = await heavyAction.getAttribute('data-action-id');
  expect(pangBreakActionId).toBeTruthy();
  expect(pangActionId).toBeTruthy();
  expect(heavyActionId).toBeTruthy();

  const curve = laneId =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve"]`
    );
  const actionBreakpoints = (laneId, actionId) =>
    curve(laneId).locator(
      `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"]`
    );
  const actionHitBreakpoints = (laneId, actionId) =>
    curve(laneId).locator(
      `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"][data-hit-key^="verified-hit-"]`
    );
  const pangHpPoints = actionHitBreakpoints('enemy-hp-curve', pangActionId);
  const pangBreakToughnessPoints = actionHitBreakpoints(
    'enemy-toughness-curve',
    pangBreakActionId
  );
  const heavyHpPoints = actionHitBreakpoints('enemy-hp-curve', heavyActionId);
  const heavyToughnessPoints = actionHitBreakpoints(
    'enemy-toughness-curve',
    heavyActionId
  );
  const breakRecoveryPoints = curve('enemy-toughness-curve').locator(
    `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${pangBreakActionId}"][data-hit-key^="verified-break-linear-recovery-"]`
  );
  const breakExitPoint = curve('enemy-toughness-curve').locator(
    `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${pangBreakActionId}"][data-hit-key^="verified-break-exit-"]`
  );

  await expect(pangHpPoints).toHaveCount(1);
  await expect(pangBreakToughnessPoints).toHaveCount(1);
  await expect(heavyHpPoints).toHaveCount(4);
  await expect(heavyToughnessPoints).toHaveCount(4);
  await expect(breakRecoveryPoints).toHaveCount(0);
  await expect(breakExitPoint).toHaveCount(1);
  await expect(
    timeline.getByTestId('workbench-timeline-runtime-event-marker')
  ).toHaveCount(0);
  await expect(
    timeline.getByTestId('workbench-timeline-state-curve-marker')
  ).toHaveCount(0);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-state-curve"] svg circle:not(.timeline-state-curve-cursor)'
    )
  ).toHaveCount(0);
  const curveLineStyle = await curve('enemy-hp-curve')
    .getByTestId('workbench-timeline-state-curve-line')
    .evaluate(element => {
      const style = getComputedStyle(element);
      return { filter: style.filter, strokeWidth: style.strokeWidth };
    });
  expect(curveLineStyle.filter).toBe('none');
  expect(Number.parseFloat(curveLineStyle.strokeWidth)).toBe(2);
  const breakExitFrame = await breakExitPoint.getAttribute('data-frame-index');
  await breakExitPoint.click();
  await expect(timeline).toHaveAttribute(
    'data-flow-selected-action-id',
    pangBreakActionId
  );
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    breakExitFrame
  );
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
  await closeInspectorIfVisible(page);
  const pangStartFrame = Math.round(
    (Number(await pangAction.getAttribute('data-start-ms')) * 60) / 1000
  );
  const heavyStartFrame = Math.round(
    (Number(await heavyAction.getAttribute('data-start-ms')) * 60) / 1000
  );
  await expect(pangHpPoints).toHaveAttribute(
    'data-frame-index',
    String(pangStartFrame + 14)
  );
  for (const [index, offset] of [27, 38, 49, 142].entries()) {
    await expect(heavyHpPoints.nth(index)).toHaveAttribute(
      'data-frame-index',
      String(heavyStartFrame + offset)
    );
  }

  for (const characterId of [109001, 101003, 101007]) {
    await expect(
      actionBreakpoints(`energy-actor-${characterId}`, pangActionId)
    ).toHaveCount(1);
  }
  for (const slotIndex of [1, 2]) {
    await expect(
      actionBreakpoints(`kibo-energy-team-slot-${slotIndex}`, pangActionId)
    ).toHaveCount(1);
  }
  await expect(
    actionBreakpoints('kibo-energy-team-slot-3', pangActionId)
  ).toHaveCount(0);
  await expect(
    actionBreakpoints('kibo-energy-team-slot-3', heavyActionId)
  ).toHaveCount(1);
  await expect(
    actionBreakpoints('kibo-energy-team-slot-3', heavyActionId)
  ).toHaveAttribute('title', /100 -> 0/u);
  await expect(curve('kibo-energy-team-slot-3')).toHaveAttribute(
    'data-max-value',
    '100'
  );
  for (const characterId of [109001, 101003, 101007]) {
    await expect(curve(`energy-actor-${characterId}`)).toHaveAttribute(
      'data-max-value',
      '100'
    );
  }
  expect(
    Number(
      await curve('energy-actor-109001').getAttribute('data-current-value')
    )
  ).toBeLessThan(10);
  await expect(page.locator('body')).not.toContainText('0-1 能量单位');
  await expect(page.locator('body')).not.toContainText(
    '原始消耗 100 · MAXSP 1'
  );
  await expect(
    actionBreakpoints('kibo-energy-team-slot-1', heavyActionId)
  ).toHaveCount(0);
  await expect(
    actionBreakpoints('kibo-energy-team-slot-2', heavyActionId)
  ).toHaveCount(0);

  await pangHpPoints.click();
  await expect(timeline).toHaveAttribute(
    'data-flow-selected-action-id',
    pangActionId
  );
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
  await expect(
    page.getByTestId('workbench-runtime-selected-detail')
  ).toContainText('101007012');
  await closeInspectorIfVisible(page);

  const pangFrameBeforeMove = Number(
    await pangHpPoints.getAttribute('data-frame-index')
  );
  await pangAction.press('ArrowRight');
  await expect
    .poll(async () =>
      Number(await pangHpPoints.getAttribute('data-frame-index'))
    )
    .toBe(pangFrameBeforeMove + 1);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(pangHpPoints).toHaveAttribute(
    'data-frame-index',
    String(pangFrameBeforeMove)
  );
  await page.getByTestId('workbench-redo-edit').click();
  await expect(pangHpPoints).toHaveAttribute(
    'data-frame-index',
    String(pangFrameBeforeMove + 1)
  );

  await heavyAction.press('Delete');
  await expect(heavyHpPoints).toHaveCount(0);
  await expect(heavyToughnessPoints).toHaveCount(0);
  await expect(
    actionBreakpoints('kibo-energy-team-slot-3', heavyActionId)
  ).toHaveCount(0);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(heavyHpPoints).toHaveCount(4);
  await expect(heavyToughnessPoints).toHaveCount(4);

  await page.getByTestId('workbench-timeline-zoom-input').evaluate(element => {
    element.value = '2';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await heavyAction.scrollIntoViewIfNeeded();
  await expectVerifiedCombatPointAlignment(
    timeline,
    heavyAction,
    heavyHpPoints.last(),
    142
  );
  const heavyActionOffsetLeft = await heavyAction.evaluate(
    element => element.offsetLeft
  );
  await timeline
    .getByTestId('workbench-timeline-viewport')
    .evaluate((element, actionOffsetLeft) => {
      element.scrollLeft = Math.max(0, Number(actionOffsetLeft) - 220);
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, heavyActionOffsetLeft);
  await closeInspectorIfVisible(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m6r2-sp-units-desktop.png' });

  await page.setViewportSize({ width: 390, height: 900 });
  await heavyAction.scrollIntoViewIfNeeded();
  await expectVerifiedCombatPointAlignment(
    timeline,
    heavyAction,
    heavyHpPoints.last(),
    142
  );
  await timeline
    .getByTestId('workbench-timeline-viewport')
    .evaluate((element, actionOffsetLeft) => {
      element.scrollLeft = Math.max(0, Number(actionOffsetLeft) - 220);
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, heavyActionOffsetLeft);
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m6r2-sp-units-narrow.png' });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(pangHpPoints).toHaveCount(1);
  await expect(heavyHpPoints).toHaveCount(4);
  await expect(
    actionBreakpoints('kibo-energy-team-slot-3', heavyActionId)
  ).toHaveCount(1);
});

test('[m7-catalog-runtime-workflow][m7-r3-operation-axis-skills] runs mapped actor and kibo actions while exposing unresolved catalog entries', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const verifiedPackageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.goto('/#/workbench');
  await verifiedPackageResponse;
  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await selectM2LoadoutOption(page, 101007, 'kiboId', '500001');

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const selectActorLibrary = characterId =>
    page.locator(
      `[data-testid="workbench-action-library-actor"][data-character-id="${characterId}"]`
    );
  const curveNodesForAction = (laneId, actionId) =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"]`
    );

  await selectActorLibrary(101003).click();
  const hanNormal = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100301"][data-action-kind="normal-attack"]'
  );
  const hanStar = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100312"][data-action-kind="star-skill"]'
  );
  await expect(hanNormal).toHaveAttribute(
    'data-mechanics-classification',
    'applied'
  );
  await expect(hanNormal).toHaveAttribute('data-timing-status', 'applied');
  await expect(hanNormal).toHaveAttribute('data-attack-input-count', '5');
  await expect(hanNormal).toBeEnabled();
  await expect(hanStar).toHaveAttribute(
    'data-mechanics-classification',
    'applied'
  );
  await dragLocatorTo(
    page,
    hanStar,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
    ),
    { targetPosition: { x: 110, y: 82 } }
  );
  await selectActorLibrary(109001).click();
  const muyinCharged = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10900101"][data-action-kind="charged-attack"]'
  );
  await expect(muyinCharged).toHaveAttribute(
    'data-mechanics-classification',
    'applied'
  );
  await dragLocatorTo(
    page,
    muyinCharged,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
    ),
    { targetPosition: { x: 310, y: 82 } }
  );

  await selectActorLibrary(101007).click();
  const pangCombo = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100712"][data-action-kind="star-combo"]'
  );
  const windKiboEnergySkill = page.locator(
    '[data-testid="workbench-kibo-action-entry"][data-kibo-id="500001"][data-skill-id="50000102"]'
  );
  const windKiboActive = page.locator(
    '[data-testid="workbench-kibo-action-entry"][data-kibo-id="500001"][data-skill-id="504004"]'
  );
  const windKiboCombo = page.locator(
    '[data-testid="workbench-kibo-action-entry"][data-kibo-id="500001"][data-skill-id="50000112"]'
  );
  await expect(windKiboActive).toHaveAttribute(
    'data-mechanics-classification',
    'applied'
  );
  await expect(windKiboCombo).toHaveCount(1);
  await dragLocatorTo(
    page,
    pangCombo,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="actor-101007"]'
    ),
    { targetPosition: { x: 220, y: 82 } }
  );
  await dragLocatorTo(
    page,
    windKiboEnergySkill,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-3"]'
    ),
    { targetPosition: { x: 440, y: 36 } }
  );
  await dragLocatorTo(
    page,
    windKiboActive,
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-3"]'
    ),
    { targetPosition: { x: 560, y: 36 } }
  );
  const hanActions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100312"]'
  );
  const hanAction = hanActions.filter({ hasText: '星鸣技' });
  const pangComboAction = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10100712"]'
    )
    .filter({ hasText: '星结合击' });
  const muyinAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10900101"]'
  );
  const kiboEnergyAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="50000102"]'
  );
  const kiboActiveAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="504004"]'
  );
  const kiboComboAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="50000112"]'
  );
  await expect(hanAction).toHaveCount(1);
  await expect(pangComboAction).toHaveCount(1);
  await expect(muyinAction).toHaveCount(1);
  await expect(kiboEnergyAction).toHaveCount(1);
  await expect(kiboActiveAction).toHaveCount(1);
  await expect(kiboComboAction).toHaveCount(1);
  const initialJointStartMs = Number(
    await pangComboAction.getAttribute('data-start-ms')
  );
  expect(Number(await kiboComboAction.getAttribute('data-start-ms'))).toBe(
    initialJointStartMs
  );
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-action-relation-count',
    '1'
  );
  const actionIds = {
    han: await hanAction.getAttribute('data-action-id'),
    pangCombo: await pangComboAction.getAttribute('data-action-id'),
    muyin: await muyinAction.getAttribute('data-action-id'),
    kiboEnergy: await kiboEnergyAction.getAttribute('data-action-id'),
    kiboActive: await kiboActiveAction.getAttribute('data-action-id'),
    kiboCombo: await kiboComboAction.getAttribute('data-action-id'),
  };
  for (const actionId of Object.values(actionIds))
    expect(actionId).toBeTruthy();
  const operationAxis = timeline.getByTestId(
    'workbench-timeline-operation-axis'
  );
  const operationMarkerFor = actionId =>
    operationAxis.locator(
      `[data-testid="workbench-timeline-operation-marker"][data-action-id="${actionId}"]`
    );
  const hanOperation = operationMarkerFor(actionIds.han);
  const pangComboOperation = operationMarkerFor(actionIds.pangCombo);
  const muyinOperation = operationMarkerFor(actionIds.muyin);
  const kiboEnergyOperation = operationMarkerFor(actionIds.kiboEnergy);
  const kiboActiveOperation = operationMarkerFor(actionIds.kiboActive);
  const kiboComboOperation = operationMarkerFor(actionIds.kiboCombo);
  await expect(hanOperation).toHaveText('E');
  await expect(hanOperation).toHaveAttribute('data-mode', 'press');
  await expect(pangComboOperation).toHaveText('F');
  await expect(pangComboOperation).toHaveAttribute('data-mode', 'press');
  await expect(pangComboOperation).toHaveAttribute(
    'data-related-action-ids',
    `${actionIds.pangCombo},${actionIds.kiboCombo}`
  );
  await expect(muyinOperation).toHaveText('LMB (Hold)');
  await expect(muyinOperation).toHaveAttribute('data-mode', 'hold');
  await expect
    .poll(async () => {
      const startMs = Number(
        await muyinOperation.getAttribute('data-start-ms')
      );
      const endMs = Number(await muyinOperation.getAttribute('data-end-ms'));
      return endMs - startMs;
    })
    .toBe(250);
  await expect(kiboEnergyOperation).toHaveText('Q');
  await expect(kiboEnergyOperation).toHaveAttribute('data-mode', 'press');
  await expect(kiboActiveOperation).toHaveCount(0);
  await expect(kiboComboOperation).toHaveCount(0);
  for (const actionId of [
    actionIds.han,
    actionIds.pangCombo,
    actionIds.muyin,
    actionIds.kiboActive,
    actionIds.kiboCombo,
  ]) {
    await expect
      .poll(() => curveNodesForAction('enemy-hp-curve', actionId).count())
      .toBeGreaterThan(0);
    await expect
      .poll(() =>
        curveNodesForAction('enemy-toughness-curve', actionId).count()
      )
      .toBeGreaterThan(0);
  }

  await pangComboAction.press('ArrowRight');
  await expect
    .poll(async () =>
      Number(await pangComboAction.getAttribute('data-start-ms'))
    )
    .toBeCloseTo(initialJointStartMs + frameToMs(1), 3);
  await expect
    .poll(async () =>
      Number(await kiboComboAction.getAttribute('data-start-ms'))
    )
    .toBeCloseTo(initialJointStartMs + frameToMs(1), 3);
  await kiboComboAction.press('Delete');
  await expect(pangComboAction).toHaveCount(0);
  await expect(kiboComboAction).toHaveCount(0);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(pangComboAction).toHaveCount(1);
  await expect(kiboComboAction).toHaveCount(1);

  const hanNode = curveNodesForAction('enemy-hp-curve', actionIds.han).first();
  const frameBeforeMove = Number(
    await hanNode.getAttribute('data-frame-index')
  );
  const operationStartBeforeMove = Number(
    await hanOperation.getAttribute('data-start-ms')
  );
  await hanAction.press('ArrowRight');
  await expect
    .poll(async () => Number(await hanNode.getAttribute('data-frame-index')))
    .toBe(frameBeforeMove + 1);
  await expect
    .poll(async () => Number(await hanOperation.getAttribute('data-start-ms')))
    .toBeCloseTo(operationStartBeforeMove + frameToMs(1), 3);

  await closeInspectorIfVisible(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m7-catalog-runtime-desktop.png' });
  await timeline.screenshot({
    path: 'reports/m7r3-operation-axis-skills-desktop.png',
  });
  await page.setViewportSize({ width: 390, height: 900 });
  await kiboComboAction.scrollIntoViewIfNeeded();
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'reports/m7-catalog-runtime-narrow.png' });
  await timeline.screenshot({
    path: 'reports/m7r3-operation-axis-skills-narrow.png',
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(hanAction).toHaveCount(1);
  await expect(pangComboAction).toHaveCount(1);
  await expect(muyinAction).toHaveCount(1);
  await expect(kiboEnergyAction).toHaveCount(1);
  await expect(kiboActiveAction).toHaveCount(1);
  await expect(kiboComboAction).toHaveCount(1);
  for (const actionId of [
    actionIds.han,
    actionIds.pangCombo,
    actionIds.muyin,
    actionIds.kiboActive,
    actionIds.kiboCombo,
  ]) {
    await expect
      .poll(() => curveNodesForAction('enemy-hp-curve', actionId).count())
      .toBeGreaterThan(0);
  }
});

test('[m7-r2-normal-attack-input-timing][m7-r3-operation-axis] uses real input windows for compact editable A1-A5 siblings', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
  await changeM2TeamSlot(page, 0, 102001);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="102001"]'
    )
    .click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const lane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-102001"]'
  );
  const normalAttack = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10200101"][data-action-kind="normal-attack"]'
  );
  await expect(normalAttack).toHaveAttribute('data-attack-input-count', '5');
  await dragLocatorTo(page, normalAttack, lane, {
    targetPosition: { x: 80, y: 82 },
  });

  const group = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10200101"]'
  );
  await expect(group).toHaveCount(5);
  const groupId = await group.first().getAttribute('data-attack-group-id');
  expect(groupId).toBeTruthy();
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-attack-group-id="${groupId}"]`
    )
  ).toHaveCount(5);
  await expect(
    group.getByTestId('workbench-action-overlap-warning')
  ).toHaveCount(0);
  expect(
    await group.evaluateAll(actions =>
      actions.map(action => ({
        label: action.querySelector('strong')?.textContent?.trim(),
        sequenceIndex: Number(
          action.getAttribute('data-attack-sequence-index')
        ),
        durationMs: Number(action.getAttribute('data-duration-ms')),
      }))
    )
  ).toEqual([
    { label: 'A1', sequenceIndex: 1, durationMs: frameToMs(19) },
    { label: 'A2', sequenceIndex: 2, durationMs: frameToMs(32) },
    { label: 'A3', sequenceIndex: 3, durationMs: frameToMs(40) },
    { label: 'A4', sequenceIndex: 4, durationMs: frameToMs(42) },
    { label: 'A5', sequenceIndex: 5, durationMs: frameToMs(56) },
  ]);
  const compactFrames = await group.evaluateAll(actions =>
    actions.map(action => ({
      startMs: Number(action.getAttribute('data-start-ms')),
      durationMs: Number(action.getAttribute('data-duration-ms')),
    }))
  );
  expect(
    compactFrames
      .slice(1)
      .every(
        (action, index) =>
          Math.abs(
            action.startMs -
              (compactFrames[index].startMs + compactFrames[index].durationMs)
          ) < 0.001
      )
  ).toBe(true);
  await group.nth(2).click();
  await expect(
    page.getByTestId('workbench-attack-input-segment-source')
  ).toContainText(/有效占轴\s*40F/);
  await expect(
    page.getByTestId('workbench-attack-input-segment-source')
  ).toContainText(/动画\s*282F/);
  await closeInspectorIfVisible(page);

  await page.getByTestId('workbench-undo-edit').click();
  await expect(group).toHaveCount(0);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(group).toHaveCount(5);

  const actionBySequence = index =>
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-attack-group-id="${groupId}"][data-attack-sequence-index="${index}"]`
    );
  const actionIds = Object.fromEntries(
    await group.evaluateAll(actions =>
      actions.map(action => [
        Number(action.getAttribute('data-attack-sequence-index')),
        action.getAttribute('data-action-id'),
      ])
    )
  );
  const operationAxis = timeline.getByTestId(
    'workbench-timeline-operation-axis'
  );
  const operationMarkerFor = actionId =>
    operationAxis.locator(
      `[data-testid="workbench-timeline-operation-marker"][data-action-id="${actionId}"]`
    );
  for (const actionId of Object.values(actionIds)) {
    await expect(operationMarkerFor(actionId)).toHaveCount(1);
    await expect(operationMarkerFor(actionId)).toHaveText('LMB');
  }
  await operationMarkerFor(actionIds[1]).click();
  await expect(actionBySequence(1)).toHaveAttribute('data-selected', 'true');
  const firstActionStartMs = Number(
    await actionBySequence(1).getAttribute('data-start-ms')
  );
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    String(Math.round(firstActionStartMs / frameToMs(1)))
  );
  await page.getByTestId('workbench-add-switch-action').click();
  const switchAction = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-type="switch"]'
    )
    .last();
  await expect(switchAction).toHaveCount(1);
  const switchActionId = await switchAction.getAttribute('data-action-id');
  const switchOperation = operationMarkerFor(switchActionId);
  await expect(switchOperation).toHaveAttribute('data-command', 'switch');
  await expect(switchOperation).toHaveText(/^[123]$/);
  await expect
    .poll(async () =>
      Number(await operationAxis.getAttribute('data-row-count'))
    )
    .toBeGreaterThan(1);
  const operationRows = await operationAxis
    .getByTestId('workbench-timeline-operation-marker')
    .evaluateAll(markers =>
      markers.map(marker => ({
        rowIndex: Number(marker.getAttribute('data-row-index')),
        left: marker.getBoundingClientRect().left,
        right: marker.getBoundingClientRect().right,
      }))
    );
  for (const rowIndex of new Set(operationRows.map(row => row.rowIndex))) {
    const row = operationRows
      .filter(item => item.rowIndex === rowIndex)
      .sort((left, right) => left.left - right.left);
    for (let index = 1; index < row.length; index += 1) {
      expect(row[index].left).toBeGreaterThanOrEqual(row[index - 1].right);
    }
  }
  const startsBeforeMove = Object.fromEntries(
    await group.evaluateAll(actions =>
      actions.map(action => [
        action.getAttribute('data-action-id'),
        Number(action.getAttribute('data-start-ms')),
      ])
    )
  );
  const laneBox = await lane.boundingBox();
  await actionBySequence(2).click();
  await dragLocatorTo(page, actionBySequence(2), lane, {
    targetPosition: { x: laneBox.width - 80, y: 82 },
  });
  await expect
    .poll(async () =>
      Number(await actionBySequence(2).getAttribute('data-start-ms'))
    )
    .not.toBe(startsBeforeMove[actionIds[2]]);
  await expect
    .poll(async () =>
      Number(
        await operationMarkerFor(actionIds[2]).getAttribute('data-start-ms')
      )
    )
    .toBe(Number(await actionBySequence(2).getAttribute('data-start-ms')));
  const movedActionBox = await actionBySequence(2).boundingBox();
  const movedOperationBox = await operationMarkerFor(
    actionIds[2]
  ).boundingBox();
  expect(Math.abs(movedActionBox.x - movedOperationBox.x)).toBeLessThanOrEqual(
    1
  );
  const startsAfterMove = Object.fromEntries(
    await group.evaluateAll(actions =>
      actions.map(action => [
        action.getAttribute('data-action-id'),
        Number(action.getAttribute('data-start-ms')),
      ])
    )
  );
  for (const index of [1, 3, 4, 5]) {
    expect(startsAfterMove[actionIds[index]]).toBe(
      startsBeforeMove[actionIds[index]]
    );
  }

  const curveNodesForAction = actionId =>
    timeline.locator(
      `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"]`
    );
  await expect
    .poll(() => curveNodesForAction(actionIds[3]).count())
    .toBeGreaterThan(0);
  await actionBySequence(3).click();
  await page.keyboard.press('Delete');
  await expect(group).toHaveCount(4);
  await expect(operationMarkerFor(actionIds[3])).toHaveCount(0);
  await expect(curveNodesForAction(actionIds[3])).toHaveCount(0);
  await actionBySequence(2).click();
  await openActionInspectorPanel(page, 'action-rules', actionIds[2]);
  await expect(
    page.locator(
      '[data-testid="workbench-action-rule-row"][data-rule-code="attack-input-chain-incomplete"]'
    )
  ).toBeVisible();
  await page.getByTestId('workbench-undo-edit').click();
  await expect(group).toHaveCount(5);
  await expect(operationMarkerFor(actionIds[3])).toHaveCount(1);
  await page.getByTestId('workbench-undo-edit').click();
  await expect
    .poll(async () =>
      Number(await actionBySequence(2).getAttribute('data-start-ms'))
    )
    .toBe(startsBeforeMove[actionIds[2]]);

  await page.getByTestId('workbench-timeline-zoom-in').click();
  await page.getByTestId('workbench-timeline-zoom-in').click();
  await expect(page.getByTestId('workbench-timeline-zoom-value')).toHaveText(
    '1.5x'
  );
  const timelineViewport = timeline.getByTestId('workbench-timeline-viewport');
  const scaleViewport = timeline.getByTestId(
    'workbench-timeline-scale-viewport'
  );
  await timelineViewport.evaluate(element => {
    element.scrollLeft = Math.max(1, element.scrollWidth * 0.2);
    element.dispatchEvent(new Event('scroll'));
  });
  await expect
    .poll(async () => {
      const timelineScroll = await timelineViewport.evaluate(
        element => element.scrollLeft
      );
      const scaleScroll = await scaleViewport.evaluate(
        element => element.scrollLeft
      );
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);
  const zoomedActionLeft = await actionBySequence(5).evaluate(
    element => element.getBoundingClientRect().left
  );
  const zoomedOperationLeft = await operationMarkerFor(actionIds[5]).evaluate(
    element => element.getBoundingClientRect().left
  );
  expect(Math.abs(zoomedActionLeft - zoomedOperationLeft)).toBeLessThanOrEqual(
    1
  );
  await timeline.screenshot({
    path: 'reports/m7r3-operation-axis-zoomed-desktop.png',
  });

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(group).toHaveCount(5);
  await closeInspectorIfVisible(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m7r2-attack-input-timing-desktop.png',
  });
  await timeline.screenshot({
    path: 'reports/m7r3-operation-axis-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await actionBySequence(5).scrollIntoViewIfNeeded();
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m7r2-attack-input-timing-narrow.png',
  });
  await timeline.screenshot({
    path: 'reports/m7r3-operation-axis-narrow.png',
  });
});

test('[stage-10a-multitrack-editing] schedules and rebinds actor, kibo, and enemy entries on legal lanes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/#/workbench');

  await openActorInspector(page);
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500001');
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
  if (await palette.isVisible()) {
    await paletteToggle.click();
  }
  await insertedSkillAction.dragTo(secondActorLane, {
    targetPosition: { x: 760, y: 28 },
  });
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
  const copiedKiboActionCandidate = page
    .getByTestId('workbench-timeline-grid-preview')
    .locator(
      '[data-testid="workbench-timeline-action"][data-action-type="kiboEvent"]'
    )
    .last();
  const copiedKiboActionId =
    await copiedKiboActionCandidate.getAttribute('data-action-id');
  expect(copiedKiboActionId).toBeTruthy();
  const copiedKiboAction = page.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${copiedKiboActionId}"]`
  );
  await expect(copiedKiboAction).toHaveAttribute(
    'data-lane-id',
    'kibo-team-slot-2'
  );
  await page
    .locator(`.action-item[data-action-id="${copiedKiboActionId}"]`)
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
  expect(exported).toMatchObject({ schemaVersion: 17 });
  expect(
    exported.actionDrafts.find(action => action.id === 'action-0002')
  ).toMatchObject({
    type: 'kiboEvent',
    actorCharacterId: 101003,
    eventType: 'signature',
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
  await selectM2LoadoutOption(page, 109001, 'kiboId', '500001');
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
    'workbench-timeline-state-curve-node'
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
  await openActionInspectorPanel(page, 'properties', 'action-0002');
  await page.getByTestId('workbench-start-frame-input').fill('900');
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    String(reviewFrame)
  );
  await expect(actorEnergyCurve).toHaveAttribute('data-cursor-value', '0');
  energyBreakpoint = actorEnergyCurve.getByTestId(
    'workbench-timeline-state-curve-node'
  );
  await expect(energyBreakpoint).toHaveAttribute('data-frame-index', '900');

  await energyBreakpoint.click();
  await expect(timeline).toHaveAttribute('data-cursor-frame-index', '900');
  await expect(actorEnergyCurve).toHaveAttribute('data-cursor-value', '50');
  const resourceStatePointId = await energyBreakpoint.getAttribute(
    'data-state-point-id'
  );
  await openRuntimeReviewTab(page, 'event');
  await closeInspectorIfVisible(page);
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
    .getByTestId('workbench-timeline-state-curve-node')
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
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-hp-curve"] [data-testid="workbench-timeline-state-curve-node"]'
    )
    .first();
  await hpMarker.click();
  const hpFrame = await hpMarker.getAttribute('data-frame-index');
  await openRuntimeReviewTab(page, 'event');
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
    page
      .locator(
        '[data-testid="workbench-event-log-row"][data-cursor-current="true"]'
      )
      .first()
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
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(baselineStatePointId);
  await openActionInspectorPanel(page, 'properties', 'action-0002');
  await expect(page.getByTestId('workbench-resource-change-input')).toHaveValue(
    '50'
  );
  await expect(
    page.locator(
      '[data-testid="workbench-action-edit-control"][data-edit-field="startMs"]'
    )
  ).toHaveAttribute('data-edit-focus-source', 'scenario-comparison-baseline');
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
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-state-point')
  ).toHaveText(baselineStatePointId);
  await openActionInspectorPanel(page, 'properties', 'action-0002');
  await expect(page.getByTestId('workbench-resource-change-input')).toHaveValue(
    '50'
  );
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
  await expect(page.locator('main.workbench')).toHaveAttribute(
    'data-runtime-diagnostics-revision',
    '1',
    { timeout: 60_000 }
  );

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
    if (response.url().includes('workbenchSkillDiagnosticsLoader')) {
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
  const diagnosticsRevisionBeforeLoad = Number(
    await workbench.getAttribute('data-runtime-diagnostics-revision')
  );

  await page.getByTestId('workbench-flow-open-runtime').click();
  await expect(workbench).toHaveAttribute(
    'data-runtime-diagnostics-status',
    'ready'
  );
  await expect
    .poll(async () =>
      Number(await workbench.getAttribute('data-runtime-diagnostics-revision'))
    )
    .toBeGreaterThan(diagnosticsRevisionBeforeLoad);
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
  await addSingleSkillAction(page);
  await setEnemyLevel(page, '91');
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
    schemaVersion: 17,
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
    '5 action'
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
  await expectEnemyLevel(page, '91');
});

test('[profile-compatibility-gate] rejects an unavailable profile without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await addSingleSkillAction(page);
  await setEnemyLevel(page, '91');
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
  await expectEnemyLevel(page, '91');
});

test('[game-data-compatibility-gate] rejects an unavailable AzPr config reference without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await addSingleSkillAction(page);
  await setEnemyLevel(page, '91');
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
  await expectEnemyLevel(page, '91');
});

test('[action-skill-compatibility-gate] rejects an unavailable skill before action fallback without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await addSingleSkillAction(page);
  await setEnemyLevel(page, '91');
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
  await expectEnemyLevel(page, '91');
});

test('[configuration-instances] binds reusable simulation configs to scenarios and JSON', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await openActorInspector(page);
  await openSideInspectorPanel(page, 'configuration');
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
  await openSideInspectorPanel(page, 'team-loadout');
  await page
    .locator(
      '[data-testid="workbench-actor-initial-sp-input"][data-character-id="109001"]'
    )
    .fill('0.5');
  await openSideInspectorPanel(page, 'configuration');
  await page.getByTestId('workbench-enemy-configuration-duplicate').click();
  const challengeEnemyInstanceId = await enemySelect.inputValue();
  await setEnemyLevel(page, '95');
  await openActorInspector(page);
  await openSideInspectorPanel(page, 'configuration');

  await page.getByTestId('workbench-scenario-duplicate').click();
  await openActorInspector(page);
  await openSideInspectorPanel(page, 'configuration');
  await actorSelect.selectOption(originalActorInstanceId);
  await enemySelect.selectOption(originalEnemyInstanceId);
  await page
    .locator(
      '[data-testid="workbench-scenario-tab"][data-scenario-id="scenario-0001"]'
    )
    .click();
  await openActorInspector(page);
  await openSideInspectorPanel(page, 'configuration');
  await expect(actorSelect).toHaveValue(burstActorInstanceId);
  await expect(enemySelect).toHaveValue(challengeEnemyInstanceId);
  await expectEnemyLevel(page, '95');

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const project = JSON.parse(await readFile(await download.path(), 'utf8'));
  expect(project).toMatchObject({
    schemaVersion: 17,
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
  await addSingleSkillAction(page);
  await setEnemyLevel(page, '93');

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
  await expectEnemyLevel(page, '93');
});

test('[project-drop-recovery] restores a production project without replacing it on invalid drop', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await expect(page.getByTestId('workbench-project-drop-host')).toHaveCount(1);
  await addSingleSkillAction(page);
  await setEnemyLevel(page, '95');

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
  await expectEnemyLevel(page, '95');

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
  await expectEnemyLevel(page, '95');
});

test('[multi-action-editing] copies, pastes, and reviews a selected action group', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await addSingleSkillAction(page);
  await addSingleSkillAction(page);
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
  await addSingleSkillAction(page);
  await addSingleSkillAction(page);
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
  expect(project.schemaVersion).toBe(17);
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
  await page.getByTestId('workbench-effect-name-input').dispatchEvent('change');
  await expect(page.getByTestId('workbench-effect-command-row')).toContainText(
    '生产增益'
  );
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

test('[action-effect-relations] keeps action, effect, log, and six energy tracks in one relation flow', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await openActionInspector(page);
  await page.getByTestId('workbench-effect-add').click();
  await page.getByTestId('workbench-effect-name-input').fill('关系测试增益');
  await page.getByTestId('workbench-effect-name-input').dispatchEvent('change');
  await expect(page.getByTestId('workbench-effect-command-row')).toContainText(
    '关系测试增益'
  );
  await openRuntimeReviewTab(page, 'effect');

  const workbench = page.locator('main.workbench');
  await expect(workbench).toHaveAttribute('data-energy-curve-count', '6');
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
    )
  ).toHaveCount(3);
  await expect(
    page.locator(
      '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
    )
  ).toHaveCount(3);

  const relationRow = page.getByTestId('workbench-effect-relation-row');
  await expect(relationRow).toHaveCount(1);
  await expect(relationRow).toHaveAttribute(
    'data-relation-kind',
    'effect-trigger'
  );
  await expect(relationRow).toHaveAttribute(
    'data-relation-status',
    'satisfied'
  );
  const relationId = await relationRow.getAttribute('data-relation-id');
  expect(relationId).toBeTruthy();
  await expect(
    page.locator(
      '[data-testid="workbench-action-relation"][data-relation-kind="effect-trigger"]'
    )
  ).toHaveCount(1);
  await openRuntimeReviewTab(page, 'event');
  await expect(
    page.locator(
      '[data-testid="workbench-event-log-row"][data-effect-relation-kind="effect-trigger"]'
    )
  ).toContainText('触发 关系测试增益');

  await openRuntimeReviewTab(page, 'effect');
  await relationRow.click();
  await expect(relationRow).toHaveAttribute('data-selected', 'true');
  await page.getByTestId('workbench-start-frame-input').fill('30');
  await page.getByTestId('workbench-start-frame-input').press('Tab');
  await expect(relationRow).toContainText('30F');
  await expect(
    page.getByTestId('workbench-timeline-grid-preview')
  ).toHaveAttribute('data-cursor-frame-index', '30');

  await page.getByTestId('workbench-effect-delete').click();
  await expect(page.getByTestId('workbench-effect-relation-row')).toHaveCount(
    0
  );
  await page.getByTestId('workbench-undo-edit').click();
  await expect(page.getByTestId('workbench-effect-relation-row')).toHaveCount(
    1
  );
  await expect(workbench).toHaveAttribute('data-energy-curve-count', '6');
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
  await openActionInspectorPanel(page, 'properties', 'action-0001');
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
  await addSingleSkillAction(page);
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
  expect(project.schemaVersion).toBe(17);
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
  await addSingleSkillAction(page);
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
    schemaVersion: 17,
    initialRuntimeState: {
      contractName: 'AzPrInitialRuntimeState',
      source: {
        sourceScenarioId: 'scenario-0001',
        boundaryId: 'cycle-boundary-0001',
        boundaryTimeMs: expect.any(Number),
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
  expect(project.initialRuntimeState.source.boundaryTimeMs).toBeCloseTo(
    boundaryTimeMs,
    3
  );

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
  await addSingleSkillAction(page);
  await expect(workbench).toHaveAttribute('data-workspace-scenario-count', '2');
  await expect(page.locator('.action-item')).toHaveCount(2);

  const downloadPromise = page.waitForEvent('download');
  await clickProjectMenuCommand(page, 'workbench-export-project');
  const download = await downloadPromise;
  const downloadPath = await download.path();
  const project = JSON.parse(await readFile(downloadPath, 'utf8'));
  expect(project.schemaVersion).toBe(17);
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

  await openActionInspectorPanel(page, 'analysis', 'action-0001');
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

test('[m1-runtime-event-review] links source events, exact frames, and three-value detail across six energy axes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await setWorkbenchTimelineDuration(page, 30_000);
  await expect(page.getByTestId('workbench-scenario-name')).toHaveText(
    '示例方案 · 预览数据'
  );

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-energy-curve"]'
  );
  const kiboEnergyRows = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="kibo-energy-curve"]'
  );
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await timeline.screenshot({
    path: 'reports/m1-runtime-event-timeline-desktop.png',
  });
  const timelinePageScrollY = await page.evaluate(() => window.scrollY);

  await expect(
    timeline.getByTestId('workbench-timeline-runtime-event-marker')
  ).toHaveCount(0);
  const runtimeEvents = timeline.locator(
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id]:not([data-action-id=""])[data-state-point-id]:not([data-state-point-id=""])'
  );
  const runtimeEvent = timeline.locator(
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="demo-actor-2-energy"]'
  );
  await expect(runtimeEvent).toBeVisible();
  const initialRuntimeFrame = Number(
    await runtimeEvent.getAttribute('data-frame-index')
  );
  expect(Number.isInteger(initialRuntimeFrame)).toBe(true);
  await expect(runtimeEvent.locator('..')).toHaveAttribute(
    'data-track-key',
    /enemyHpDamage|enemyToughnessDamage|selfEnergyChange|kiboEnergyChange/
  );

  await runtimeEvent.evaluate(element => element.click());
  await expect(timeline).toHaveAttribute(
    'data-cursor-frame-index',
    String(initialRuntimeFrame)
  );
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-action')
  ).toHaveText('资源事件');
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-frame')
  ).toContainText(formatRuntimeFrameLabel(initialRuntimeFrame));
  await expect(
    page.getByTestId('workbench-runtime-selected-detail-three-value-row')
  ).toHaveCount(3);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBe(timelinePageScrollY);

  await page.screenshot({
    path: 'reports/m1-runtime-event-review-desktop.png',
  });

  if ((await runtimeEvents.count()) > 1) {
    const secondRuntimeEvent = runtimeEvents.nth(1);
    const secondRuntimeFrame = Number(
      await secondRuntimeEvent.getAttribute('data-frame-index')
    );
    await secondRuntimeEvent.evaluate(element => element.click());
    await expect(timeline).toHaveAttribute(
      'data-cursor-frame-index',
      String(secondRuntimeFrame)
    );
    await expect(
      page.getByTestId('workbench-runtime-selected-detail-frame')
    ).toContainText(formatRuntimeFrameLabel(secondRuntimeFrame));
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(actorEnergyRows).toHaveCount(3);
  await expect(kiboEnergyRows).toHaveCount(3);
  await expectPageWithoutHorizontalOverflow(page);
  await page.getByTestId('workbench-close-side-inspector').click();
  await timeline.scrollIntoViewIfNeeded();
  await timeline.screenshot({
    path: 'reports/m1-runtime-event-timeline-narrow.png',
  });
  await page.screenshot({
    path: 'reports/m1-runtime-event-review-narrow.png',
  });
});

test('[m9-r2-switch-triggered-star-carry] derives enter and exit actions from one exact-frame switch', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await openActorInspector(page, 101003);
  await page
    .getByTestId('workbench-initial-controlled-actor-select')
    .selectOption('101003');
  await closeInspectorIfVisible(page);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  await expect(
    page.locator(
      '[data-testid="workbench-skill-entry"][data-action-kind="star-carry"]'
    )
  ).toHaveCount(0);

  await page.getByTestId('workbench-add-switch-action').click();
  let parent = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    )
    .last();
  await expect(parent).toHaveCount(1);
  const parentActionId = await parent.getAttribute('data-action-id');
  const children = () =>
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-parent-action-id="${parentActionId}"][data-derived-action-kind="switch-triggered-star-carry"]`
    );
  await expect(children()).toHaveCount(2);
  await expect(children().filter({ hasText: '退场触发' })).toHaveCount(1);
  await expect(children().filter({ hasText: '入场触发' })).toHaveCount(1);
  await expect(children().nth(0)).toHaveAttribute('data-read-only', 'true');
  await expect(children().nth(1)).toHaveAttribute('data-read-only', 'true');

  const operationAxis = timeline.getByTestId(
    'workbench-timeline-operation-axis'
  );
  await expect(
    operationAxis.locator(
      `[data-testid="workbench-timeline-operation-marker"][data-action-id="${parentActionId}"]`
    )
  ).toHaveCount(1);
  for (let index = 0; index < 2; index += 1) {
    const childId = await children().nth(index).getAttribute('data-action-id');
    await expect(
      operationAxis.locator(
        `[data-testid="workbench-timeline-operation-marker"][data-action-id="${childId}"]`
      )
    ).toHaveCount(0);
  }

  await parent.click();
  const parentBindings = page.getByTestId('workbench-switch-trigger-binding');
  await expect(parentBindings).toHaveCount(2);
  await expect(parentBindings.filter({ hasText: '退场触发' })).toHaveCount(1);
  await expect(parentBindings.filter({ hasText: '入场触发' })).toHaveCount(1);

  await children().filter({ hasText: '退场触发' }).click();
  await expect(
    page.getByTestId('workbench-switch-trigger-bindings')
  ).toContainText('自动子动作');
  await expect(page.getByTestId('workbench-skill-select')).toHaveCount(0);
  await expect(page.getByTestId('workbench-action-frame-controls')).toHaveCount(
    0
  );
  await closeInspectorIfVisible(page);

  const startsBeforeMove = await children().evaluateAll(actions =>
    Object.fromEntries(
      actions.map(action => [
        action.getAttribute('data-action-id'),
        Number(action.getAttribute('data-start-ms')),
      ])
    )
  );
  await parent.press('ArrowRight');
  const startsAfterMove = await children().evaluateAll(actions =>
    Object.fromEntries(
      actions.map(action => [
        action.getAttribute('data-action-id'),
        Number(action.getAttribute('data-start-ms')),
      ])
    )
  );
  for (const [actionId, startMs] of Object.entries(startsBeforeMove)) {
    expect(startsAfterMove[actionId]).toBeCloseTo(startMs + frameToMs(1), 3);
  }
  await page.getByTestId('workbench-undo-edit').click();
  await expect
    .poll(() => children().first().getAttribute('data-start-ms'))
    .toBe(String(Object.values(startsBeforeMove)[0]));
  await page.getByTestId('workbench-redo-edit').click();
  await expect
    .poll(() => children().first().getAttribute('data-start-ms'))
    .toBe(String(Object.values(startsAfterMove)[0]));

  await parent.click();
  await page.screenshot({
    path: 'reports/m9-r2d-switch-trigger-desktop.png',
  });
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  parent = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${parentActionId}"]`
  );
  await expect(parent).toHaveCount(1);
  await expect(children()).toHaveCount(2);
  const startsAfterReload = await children().evaluateAll(actions =>
    Object.fromEntries(
      actions.map(action => [
        action.getAttribute('data-action-id'),
        Number(action.getAttribute('data-start-ms')),
      ])
    )
  );
  expect(startsAfterReload).toEqual(startsAfterMove);

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await timeline.scrollIntoViewIfNeeded();
  await expectPageWithoutHorizontalOverflow(page);
  await expect(parent).toBeVisible();
  await expect(children()).toHaveCount(2);
  await page.screenshot({
    path: 'reports/m9-r2d-switch-trigger-narrow.png',
  });
});

test('[m9-r2-r1-inspector-duration] closes the real inspector and keeps a readable 120 second axis', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const draft = createM9R2R1WorkbenchDraft();
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

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const viewport = timeline.getByTestId('workbench-timeline-viewport');
  const durationSelect = timeline.getByTestId(
    'workbench-timeline-duration-select'
  );
  await expect(timeline).toHaveAttribute('data-duration-ms', '120000');
  await expect(durationSelect).toHaveValue('120000');
  await expect
    .poll(() =>
      viewport.evaluate(element => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
      }))
    )
    .toMatchObject({
      clientWidth: expect.any(Number),
      scrollWidth: expect.any(Number),
    });
  const initialAxisMetrics = await viewport.evaluate(element => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(initialAxisMetrics.scrollWidth).toBeGreaterThan(
    initialAxisMetrics.clientWidth
  );
  expect(initialAxisMetrics.scrollWidth).toBeGreaterThanOrEqual(2_870);

  const actionAtFiveSeconds = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-at-5s"]'
  );
  await actionAtFiveSeconds.scrollIntoViewIfNeeded();
  await actionAtFiveSeconds.click();
  const inspector = page.getByTestId('workbench-side-inspector');
  const inspectorScroll = page.getByTestId('workbench-side-inspector-scroll');
  await expect(inspector).toBeVisible();
  await inspectorScroll.evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  await expectInspectorCloseButtonReachable(page);
  await expect(page.locator('body')).not.toContainText('\uFFFD');
  await expect(page.locator('body')).not.toContainText('锟斤拷');

  const hitCheckbox = page
    .getByTestId('workbench-hit-override-row')
    .first()
    .locator('input[type="checkbox"]');
  if (await hitCheckbox.count()) {
    await hitCheckbox.click();
    await expect(inspector).toBeVisible();
    await page.getByTestId('workbench-undo-edit').click();
    await expect(inspector).toBeVisible();
  } else {
    await inspectorScroll.click({ position: { x: 16, y: 16 } });
    await expect(inspector).toBeVisible();
  }
  await page.screenshot({
    path: 'reports/m9-r2-r1-inspector-desktop.png',
  });

  await page.getByTestId('workbench-close-side-inspector').click();
  await expect(inspector).toBeHidden();
  await expect(actionAtFiveSeconds).toHaveAttribute('data-selected', 'true');
  await actionAtFiveSeconds.click();
  await expect(inspector).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(inspector).toBeHidden();
  await expect(actionAtFiveSeconds).toHaveAttribute('data-selected', 'true');

  await durationSelect.selectOption('180000');
  await expect(timeline).toHaveAttribute('data-duration-ms', '180000');
  await page.getByTestId('workbench-undo-edit').click();
  await expect(timeline).toHaveAttribute('data-duration-ms', '120000');
  await page.getByTestId('workbench-redo-edit').click();
  await expect(timeline).toHaveAttribute('data-duration-ms', '180000');

  for (const actionId of ['action-at-5s', 'switch-at-60s', 'action-at-119s']) {
    const action = timeline.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
    );
    await action.scrollIntoViewIfNeeded();
    await action.click();
    await expect(action).toHaveAttribute('data-selected', 'true');
  }
  await page.getByTestId('workbench-timeline-playback-toggle').click();
  await expect(timeline).toHaveAttribute('data-playback-running', 'true');
  await page.getByTestId('workbench-timeline-playback-toggle').click();
  await expect(timeline).toHaveAttribute('data-playback-running', 'false');

  await durationSelect.selectOption('60000');
  await expect(timeline).toHaveAttribute('data-duration-ms', '180000');
  await expect(page.getByTestId('workbench-draft-status')).toContainText(
    '无法缩短到 60s'
  );
  await closeInspectorIfVisible(page);
  await page.screenshot({
    path: 'reports/m9-r2-r1-timeline-duration-desktop.png',
  });

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(timeline).toHaveAttribute('data-duration-ms', '180000');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="switch-at-60s"]'
    )
  ).toHaveAttribute('data-duration-ms', '0');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="action-at-119s"]'
    )
  ).toHaveCount(1);

  await page.setViewportSize({ width: 640, height: 900 });
  await actionAtFiveSeconds.scrollIntoViewIfNeeded();
  await actionAtFiveSeconds.click();
  await expectInspectorCloseButtonReachable(page);
  await page.screenshot({
    path: 'reports/m9-r2-r1-inspector-narrow.png',
  });
  await page.getByTestId('workbench-close-side-inspector').click();
  await expect(inspector).toBeHidden();

  await page.setViewportSize({ width: 390, height: 900 });
  const actionAt119Seconds = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-action-id="action-at-119s"]'
  );
  await actionAt119Seconds.scrollIntoViewIfNeeded();
  await actionAt119Seconds.click();
  await expectInspectorCloseButtonReachable(page);
  await page.getByTestId('workbench-close-side-inspector').click();
  await expect(inspector).toBeHidden();
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/m9-r2-r1-timeline-duration-narrow.png',
  });
});

test('[m9-r2-r2-initial-energy] edits actor and configured kibo baselines directly on the timeline', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await timeline.scrollIntoViewIfNeeded();

  const actorInput = timeline.locator(
    '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="109001"]'
  );
  const unconfiguredKiboLane = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-1"]'
  );
  await expect(actorInput).toHaveAttribute('min', '0');
  await expect(actorInput).toHaveAttribute('max', '100');
  await expect(actorInput).toHaveAttribute('step', '0.01');
  await expect(unconfiguredKiboLane).toContainText('槽位 1 · 0 / 1');
  await expect(
    unconfiguredKiboLane.getByTestId('workbench-timeline-initial-energy-input')
  ).toHaveCount(0);

  await actorInput.fill('5.75');
  await actorInput.press('Enter');
  await expect(actorInput).toHaveValue('5.75');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="energy-actor-109001"] [data-testid="workbench-timeline-state-curve"]'
    )
  ).toHaveAttribute('data-initial-value', '5.75');

  await selectM2LoadoutOption(page, 109001, 'kiboId', '500001');
  const kiboInput = timeline.locator(
    '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="kibo"][data-team-slot-id="team-slot-1"][data-kibo-id="500001"]'
  );
  const kiboCurve = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="kibo-energy-team-slot-1"] [data-testid="workbench-timeline-state-curve"]'
  );
  await expect(kiboInput).toBeVisible();
  await expect(kiboInput).toHaveAttribute('max', '100');
  await kiboInput.fill('50');
  await kiboInput.press('Enter');
  await expect(kiboInput).toHaveValue('50');
  await expect(kiboCurve).toHaveAttribute('data-initial-value', '50');
  await expect(kiboCurve).toHaveAttribute('data-max-value', '100');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-id="kibo-energy-team-slot-2"]'
    )
  ).toContainText('槽位 2 · 0 / 1');

  await page.getByTestId('workbench-undo-edit').click();
  await expect(kiboInput).toHaveValue('0');
  await expect(kiboCurve).toHaveAttribute('data-initial-value', '0');
  await expect(actorInput).toHaveValue('5.75');
  await page.getByTestId('workbench-redo-edit').click();
  await expect(kiboInput).toHaveValue('50');
  await expect(kiboCurve).toHaveAttribute('data-initial-value', '50');

  await closeInspectorIfVisible(page);
  await page.screenshot({
    path: 'reports/m9-r2-r2-initial-energy-desktop.png',
  });
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(actorInput).toHaveValue('5.75');
  await expect(kiboInput).toHaveValue('50');
  await expect(kiboCurve).toHaveAttribute('data-initial-value', '50');

  await page.setViewportSize({ width: 390, height: 900 });
  await timeline.scrollIntoViewIfNeeded();
  await expect(actorInput).toBeVisible();
  await expect(kiboInput).toBeVisible();
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/m9-r2-r2-initial-energy-narrow.png',
  });
});

test('[m9-r3-r2-xiaoyu-forms-occupancy] [m9-r3-r2-r1-xiaoyu-burst-chain] resolves every charged form, the real burst drag path, and its effective overlap boundary', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-scenario-add').click();
  await changeM2TeamSlot(page, 0, 101010);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
    .click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101010"]'
  );
  const actorEnergy = timeline.locator(
    '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101010"]'
  );
  await actorEnergy.fill('100');
  await actorEnergy.press('Enter');
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
  const chargedBlocks = () =>
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10101001"][data-attack-group-id=""]'
    );
  const expectChargedForm = async (
    block,
    { name, controlSkillId, subSkillIndex, occupancyFrames }
  ) => {
    await block.click();
    const identity = page.getByTestId('workbench-action-identity');
    const trace = page.getByTestId('workbench-verified-mechanics-trace');
    await expect(identity).toContainText(name);
    await expect(identity).toContainText(`${occupancyFrames}F`);
    await expect(
      trace.locator('[data-trace-step="action-variant"]')
    ).toContainText(name);
    await expect(
      trace.locator('[data-trace-step="action-variant"]')
    ).toContainText(`control ${controlSkillId}/sub${subSkillIndex}`);
    await closeInspectorIfVisible(page);
  };

  await chargedAttack.click();
  await expect(chargedBlocks()).toHaveCount(1);
  const ordinaryCharged = chargedBlocks().nth(0);
  await expectChargedForm(ordinaryCharged, {
    name: '普通重击',
    controlSkillId: 10101010,
    subSkillIndex: 0,
    occupancyFrames: 75,
  });

  await chargedAttack.click();
  await expect(chargedBlocks()).toHaveCount(2);
  const continuousCharged = chargedBlocks().nth(1);
  await expectChargedForm(continuousCharged, {
    name: '连续重击',
    controlSkillId: 10101010,
    subSkillIndex: 1,
    occupancyFrames: 75,
  });

  await expect(normalAttack).toHaveAttribute('data-attack-input-count', '5');
  await normalAttack.click();

  const normalBlocks = () =>
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10101001"][data-attack-group-id]:not([data-attack-group-id=""])'
    );
  await expect(normalBlocks()).toHaveCount(5);
  const defaultGroupId = await normalBlocks()
    .first()
    .getAttribute('data-attack-group-id');
  const defaultA5 = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-attack-group-id="${defaultGroupId}"][data-attack-sequence-index="5"]`
  );
  expect(Number(await defaultA5.getAttribute('data-duration-ms'))).toBeCloseTo(
    frameToMs(80),
    6
  );

  await chargedAttack.click();
  await expect(chargedBlocks()).toHaveCount(3);
  const specialCharged = chargedBlocks().nth(2);
  const a5StartMs = Number(await defaultA5.getAttribute('data-start-ms'));
  const specialStartMs = Number(
    await specialCharged.getAttribute('data-start-ms')
  );
  expect(specialStartMs - a5StartMs).toBeCloseTo(frameToMs(80), 3);
  await expectChargedForm(specialCharged, {
    name: '特殊重击',
    controlSkillId: 10101042,
    subSkillIndex: 0,
    occupancyFrames: 90,
  });

  await ultimate.click();
  const ultimateBlocks = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10101013"]'
  );
  await expect(ultimateBlocks).toHaveCount(1);
  const ultimateBlock = ultimateBlocks.nth(0);

  await chargedAttack.click();
  await expect(chargedBlocks()).toHaveCount(4);
  const enhancedCharged = chargedBlocks().nth(3);
  await expect(chargedBlocks().nth(3)).toContainText('强化特殊重击');
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="free"]'
    )
    .click();
  await dragTimelineActionByFrames(page, enhancedCharged, 2);
  await expectChargedForm(enhancedCharged, {
    name: '强化重击',
    controlSkillId: 10101010,
    subSkillIndex: 2,
    occupancyFrames: 64,
  });
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
    )
    .click();

  await ultimateBlock.scrollIntoViewIfNeeded();
  const ultimateBox = await ultimateBlock.boundingBox();
  const actorLaneBoxForBurstDrop = await actorLane.boundingBox();
  expect(ultimateBox).toBeTruthy();
  expect(actorLaneBoxForBurstDrop).toBeTruthy();
  await dragLocatorTo(page, normalAttack, actorLane, {
    targetPosition: {
      x: ultimateBox.x - actorLaneBoxForBurstDrop.x + ultimateBox.width / 2,
      y: actorLaneBoxForBurstDrop.height / 2,
    },
  });
  await expect(normalBlocks()).toHaveCount(8);
  const groupIds = await normalBlocks().evaluateAll(actions => [
    ...new Set(
      actions.map(action => action.getAttribute('data-attack-group-id'))
    ),
  ]);
  expect(groupIds).toHaveLength(2);
  const burstGroupId = groupIds.find(groupId => groupId !== defaultGroupId);
  const burstGroup = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-attack-group-id="${burstGroupId}"]`
  );
  await expect(burstGroup).toHaveCount(3);
  expect(
    await burstGroup.evaluateAll(actions =>
      actions
        .sort(
          (left, right) =>
            Number(left.getAttribute('data-attack-sequence-index')) -
            Number(right.getAttribute('data-attack-sequence-index'))
        )
        .map(action => ({
          sequenceIndex: Number(
            action.getAttribute('data-attack-sequence-index')
          ),
          durationMs: Number(action.getAttribute('data-duration-ms')),
        }))
    )
  ).toEqual([
    { sequenceIndex: 1, durationMs: frameToMs(72) },
    { sequenceIndex: 2, durationMs: frameToMs(75) },
    { sequenceIndex: 3, durationMs: frameToMs(72) },
  ]);
  for (const [index, durationFrames] of [72, 75, 72].entries()) {
    await expect(burstGroup.nth(index)).toContainText(`${durationFrames}F`);
    await expect(burstGroup.nth(index)).not.toContainText('条件待确认');
    await expect(burstGroup.nth(index)).toHaveAttribute(
      'data-readiness-status',
      'ready'
    );
  }
  await burstGroup.first().click();
  await expect(page.getByTestId('workbench-action-identity')).toContainText(
    '72F'
  );
  await closeInspectorIfVisible(page);

  await chargedAttack.click();
  await expect(chargedBlocks()).toHaveCount(5);
  const enhancedSpecialCharged = chargedBlocks().nth(4);
  const burstA3StartMs = Number(
    await burstGroup.nth(2).getAttribute('data-start-ms')
  );
  const enhancedSpecialStartMs = Number(
    await enhancedSpecialCharged.getAttribute('data-start-ms')
  );
  expect(enhancedSpecialStartMs - burstA3StartMs).toBeCloseTo(frameToMs(71), 3);
  await expectChargedForm(enhancedSpecialCharged, {
    name: '强化特殊重击',
    controlSkillId: 10101042,
    subSkillIndex: 1,
    occupancyFrames: 60,
  });
  await page.getByTestId('workbench-undo-edit').click();
  await expect(chargedBlocks()).toHaveCount(4);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(chargedBlocks()).toHaveCount(5);
  await expect(chargedBlocks().nth(4)).toContainText('强化特殊重击');
  await expect(chargedBlocks().nth(4)).toContainText('60F');

  const burstInterval = timeline.locator(
    '[data-testid="workbench-timeline-effect-interval"][data-effect-id="battle-element:101010129"]'
  );
  const passiveInterval = timeline.locator(
    '[data-testid="workbench-timeline-effect-interval"][data-effect-id="battle-element:101010206"]'
  );
  await expect(burstInterval).toHaveCount(1);
  await expect(passiveInterval).toHaveCount(1);
  await expect(burstInterval).toHaveAttribute(
    'data-applied-to-calculators',
    'false'
  );
  await expect(passiveInterval).toHaveAttribute(
    'data-applied-to-calculators',
    'true'
  );
  const ultimateStartMs = Number(
    await ultimateBlock.getAttribute('data-start-ms')
  );
  expect(
    Number(await burstInterval.getAttribute('data-start-ms')) - ultimateStartMs
  ).toBeCloseTo(frameToMs(272), 3);
  expect(
    Number(await burstInterval.getAttribute('data-end-ms')) -
      Number(await burstInterval.getAttribute('data-start-ms'))
  ).toBeCloseTo(10_000, 3);

  await ultimate.click();
  await expect(ultimateBlocks).toHaveCount(2);
  const overlapFollower = ultimateBlocks.nth(1);
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="free"]'
    )
    .click();
  const enhancedSpecialStartFrame = Math.round(
    (Number(await enhancedSpecialCharged.getAttribute('data-start-ms')) * 60) /
      1000
  );
  const exactBoundaryFrame = enhancedSpecialStartFrame + 60;
  await overlapFollower.click();
  await page
    .getByTestId('workbench-start-frame-input')
    .fill(String(exactBoundaryFrame));
  await expect(overlapFollower).toHaveAttribute(
    'data-start-ms',
    String(frameToMs(exactBoundaryFrame))
  );
  await expect(
    enhancedSpecialCharged.getByTestId('workbench-action-overlap-warning')
  ).toHaveCount(0);
  await page
    .getByTestId('workbench-start-frame-input')
    .fill(String(exactBoundaryFrame - 1));
  await expect(
    enhancedSpecialCharged.getByTestId('workbench-action-overlap-warning')
  ).toBeVisible();
  await expect(
    overlapFollower.getByTestId('workbench-action-overlap-warning')
  ).toBeVisible();

  await enhancedSpecialCharged.click();
  await expect(page.getByTestId('workbench-action-identity')).toContainText(
    '强化特殊重击'
  );
  await actorLane.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'reports/m9-r3-r2-r1-xiaoyu-burst-chain-desktop.png',
  });
  await overlapFollower.click();
  await page
    .getByTestId('workbench-start-frame-input')
    .fill(String(exactBoundaryFrame));
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(normalBlocks()).toHaveCount(8);
  await expect(chargedBlocks()).toHaveCount(5);
  await expect(chargedBlocks().nth(0)).toContainText('普通重击');
  await expect(chargedBlocks().nth(1)).toContainText('连续重击');
  await expect(chargedBlocks().nth(2)).toContainText('特殊重击');
  await expect(chargedBlocks().nth(3)).toContainText('强化重击');
  await expect(chargedBlocks().nth(4)).toContainText('强化特殊重击');
  await expect(burstInterval).toHaveCount(1);
  await expect(passiveInterval).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  const burstOffsetLeft = await burstGroup
    .first()
    .evaluate(element => element.offsetLeft);
  await timeline
    .getByTestId('workbench-timeline-viewport')
    .evaluate((element, actionOffsetLeft) => {
      element.scrollLeft = Math.max(0, Number(actionOffsetLeft) - 80);
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, burstOffsetLeft);
  await actorLane.scrollIntoViewIfNeeded();
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/m9-r3-r2-r1-xiaoyu-burst-chain-narrow.png',
  });
});

test('[m9-r3-r2-r2-xiaoyu-hidden-inputs] resolves verified hidden inputs, crosses a window by pointer, and preserves the result', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-scenario-add').click();
  await changeM2TeamSlot(page, 0, 101010);

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101010"]'
  );
  const actorEnergy = timeline.locator(
    '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101010"]'
  );
  await actorEnergy.fill('100');
  await actorEnergy.press('Enter');

  await openActorInspector(page, 101003);
  await page
    .getByTestId('workbench-initial-controlled-actor-select')
    .selectOption('101003');
  await closeInspectorIfVisible(page);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  await page.getByTestId('workbench-add-switch-action').click();
  const switchParent = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    )
    .last();
  const switchParentId = await switchParent.getAttribute('data-action-id');
  const xiaoyuStarCarry = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-parent-action-id="${switchParentId}"][data-derived-action-kind="switch-triggered-star-carry"][data-skill-id="10101021"]`
  );
  await expect(xiaoyuStarCarry).toHaveCount(1);
  await expect(xiaoyuStarCarry).toContainText('入场触发');
  await xiaoyuStarCarry.click();
  await expect(
    page
      .getByTestId('workbench-verified-mechanics-trace')
      .locator('[data-trace-step="action-variant"]')
  ).toContainText('control 10101021/sub0');
  await closeInspectorIfVisible(page);

  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
    .click();
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
    )
    .click();
  const chargedAttack = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101001"][data-action-kind="charged-attack"]'
  );
  const chargedBlocks = () =>
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10101001"][data-attack-group-id=""]'
    );
  await expect(chargedBlocks()).toHaveCount(0);
  await chargedAttack.click();
  await expect(chargedBlocks()).toHaveCount(1);
  await expect(chargedBlocks().first()).toContainText('普通重击');
  await expect(chargedBlocks().first()).toContainText('control 10101010/sub0');
  await page.getByTestId('workbench-undo-edit').click();
  await expect(chargedBlocks()).toHaveCount(0);

  const hiddenInputCases = [
    {
      kind: 'star-skill',
      skillId: 10101012,
      windowStartFrame: 86,
      windowEndFrame: 120,
      naturalStartFrame: 119,
      semanticName: '特殊重击',
      controlLabel: 'control 10101042/sub0',
    },
    {
      kind: 'ultimate',
      skillId: 10101013,
      windowStartFrame: 295,
      windowEndFrame: 329,
      naturalStartFrame: 328,
      semanticName: '强化特殊重击',
      controlLabel: 'control 10101042/sub1',
    },
    {
      kind: 'limit-counter',
      skillId: 10101021,
      windowStartFrame: 60,
      windowEndFrame: 96,
      naturalStartFrame: 60,
      semanticName: '特殊重击',
      controlLabel: 'control 10101042/sub0',
    },
  ];
  for (const [index, hiddenInput] of hiddenInputCases.entries()) {
    await page
      .locator(
        '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
      )
      .click();
    await page
      .locator(
        '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
      )
      .click();
    await page
      .locator(
        `[data-testid="workbench-skill-entry"][data-skill-id="${hiddenInput.skillId}"][data-action-kind="${hiddenInput.kind}"]`
      )
      .click();
    const source = timeline
      .locator(
        `[data-testid="workbench-timeline-action"][data-skill-id="${hiddenInput.skillId}"][data-derived-action-kind=""]`
      )
      .last();
    await expect(source).toHaveCount(1);
    await chargedAttack.click();
    await expect(chargedBlocks()).toHaveCount(index + 1);
    const charged = chargedBlocks().nth(index);
    await expect(charged).toContainText(hiddenInput.semanticName);
    await expect(charged).toContainText(hiddenInput.controlLabel);
    const sourceStartMs = Number(await source.getAttribute('data-start-ms'));
    const chargedStartMs = Number(await charged.getAttribute('data-start-ms'));
    expect(chargedStartMs - sourceStartMs).toBeCloseTo(
      frameToMs(hiddenInput.naturalStartFrame),
      3
    );

    if (hiddenInput.kind === 'star-skill') {
      await page
        .locator(
          '[data-testid="workbench-action-placement-mode-option"][data-mode="free"]'
        )
        .click();
      await dragTimelineActionByFrames(
        page,
        charged,
        hiddenInput.windowEndFrame - hiddenInput.naturalStartFrame + 1
      );
      await expect
        .poll(async () => {
          const movedStartMs = Number(
            await charged.getAttribute('data-start-ms')
          );
          return Math.round(((movedStartMs - sourceStartMs) * 60) / 1000);
        })
        .toBe(hiddenInput.windowEndFrame + 1);
      await expect(charged).toContainText('普通重击');
      await expect(charged).toContainText('control 10101010/sub0');
      await page.getByTestId('workbench-undo-edit').click();
      await expect(charged).toContainText(hiddenInput.semanticName);
      await expect(charged).toContainText(hiddenInput.controlLabel);
    }
  }

  await chargedBlocks().last().click();
  await expect(page.getByTestId('workbench-action-identity')).toContainText(
    '特殊重击'
  );
  await actorLane.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'reports/m9-r3-r2-r2-xiaoyu-hidden-inputs-desktop.png',
  });
  await closeInspectorIfVisible(page);
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(chargedBlocks()).toHaveCount(3);
  await expect(chargedBlocks().nth(0)).toContainText('特殊重击');
  await expect(chargedBlocks().nth(1)).toContainText('强化特殊重击');
  await expect(chargedBlocks().nth(2)).toContainText('特殊重击');
  await expect(xiaoyuStarCarry).toHaveCount(1);

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await actorLane.scrollIntoViewIfNeeded();
  await expectPageWithoutHorizontalOverflow(page);
  await page.screenshot({
    path: 'reports/m9-r3-r2-r2-xiaoyu-hidden-inputs-narrow.png',
  });
});

test('[m9-r3-r2-r3-contextual-edge] keeps a free-dropped charged action flush with its verified interrupt edge', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.getByTestId('workbench-scenario-add').click();
  await changeM2TeamSlot(page, 0, 101010);
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101010"]'
    )
    .click();
  await page
    .locator(
      '[data-testid="workbench-action-placement-mode-option"][data-mode="free"]'
    )
    .click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101010"]'
  );
  const starSkillEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101012"][data-action-kind="star-skill"]'
  );
  const chargedEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10101001"][data-action-kind="charged-attack"]'
  );
  await dragLocatorTo(page, starSkillEntry, actorLane, {
    targetPosition: { x: 260, y: 58 },
  });
  const starSkill = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10101012"][data-derived-action-kind=""]'
    )
    .last();
  await expect(starSkill).toHaveCount(1);
  const starSkillRight = await starSkill.evaluate(
    element => element.offsetLeft + element.offsetWidth
  );
  await dragLocatorTo(page, chargedEntry, actorLane, {
    targetPosition: { x: starSkillRight, y: 58 },
  });

  const charged = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10101001"][data-attack-group-id=""]'
    )
    .last();
  await expect(charged).toHaveCount(1);
  await expect(charged).toContainText('特殊重击');
  await expect(charged).toContainText('control 10101042/sub0');
  await expect(charged).toHaveAttribute('data-readiness-status', 'ready');
  await expect(starSkill).not.toHaveClass(/overlap/);
  await expect(charged).not.toHaveClass(/overlap/);

  const starStartMs = Number(await starSkill.getAttribute('data-start-ms'));
  const starDurationMs = Number(
    await starSkill.getAttribute('data-duration-ms')
  );
  const chargedStartMs = Number(await charged.getAttribute('data-start-ms'));
  expect(Math.round((starDurationMs * 60) / 1000)).toBe(119);
  expect(Math.round(((chargedStartMs - starStartMs) * 60) / 1000)).toBe(119);
  const flushGeometry = await page.evaluate(
    ({ sourceId, successorId }) => {
      const source = document.querySelector(
        `[data-testid="workbench-timeline-action"][data-action-id="${sourceId}"]`
      );
      const successor = document.querySelector(
        `[data-testid="workbench-timeline-action"][data-action-id="${successorId}"]`
      );
      return {
        gap:
          successor.getBoundingClientRect().left -
          source.getBoundingClientRect().right,
      };
    },
    {
      sourceId: await starSkill.getAttribute('data-action-id'),
      successorId: await charged.getAttribute('data-action-id'),
    }
  );
  expect(Math.abs(flushGeometry.gap)).toBeLessThanOrEqual(1);

  const chargedActionId = await charged.getAttribute('data-action-id');
  const operationMarker = timeline.locator(
    `[data-testid="workbench-timeline-operation-marker"][data-action-id="${chargedActionId}"]`
  );
  await expect(operationMarker).toHaveCount(1);
  expect(
    Math.round(
      ((Number(await operationMarker.getAttribute('data-start-ms')) -
        starStartMs) *
        60) /
        1000
    )
  ).toBe(119);

  await charged.click();
  await page
    .locator(
      '[data-testid="workbench-side-inspector-tab"][data-inspector-panel="properties"]'
    )
    .click();
  const scheduling = page.getByTestId('workbench-context-input-scheduling');
  await expect(scheduling).toContainText('[86, 120)F');
  await expect(scheduling).toContainText('119F');
  await page.screenshot({
    path: 'reports/m9-r3-r2-r3-contextual-edge-desktop.png',
  });

  await page.getByTestId('workbench-save-draft').click();
  const persistedOffsets = await page.evaluate(
    ({ storageKey, sourceId, successorId }) => {
      const draft = JSON.parse(window.localStorage.getItem(storageKey));
      const source = draft.actionDrafts.find(action => action.id === sourceId);
      const successor = draft.actionDrafts.find(
        action => action.id === successorId
      );
      return {
        sourceStartMs: source.startMs,
        successorStartMs: successor.startMs,
      };
    },
    {
      storageKey: BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
      sourceId: await starSkill.getAttribute('data-action-id'),
      successorId: chargedActionId,
    }
  );
  expect(
    Math.round(
      ((persistedOffsets.successorStartMs - persistedOffsets.sourceStartMs) *
        60) /
        1000
    )
  ).toBe(120);

  await closeInspectorIfVisible(page);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${chargedActionId}"]`
    )
  ).toHaveCount(0);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${chargedActionId}"]`
    )
  ).toContainText('特殊重击');
  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${chargedActionId}"]`
    )
  ).toContainText('特殊重击');

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await timeline.scrollIntoViewIfNeeded();
  const restoredStarSkill = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${await starSkill.getAttribute('data-action-id')}"]`
  );
  const restoredStarOffsetLeft = await restoredStarSkill.evaluate(
    element => element.offsetLeft
  );
  await timeline
    .getByTestId('workbench-timeline-viewport')
    .evaluate((element, offsetLeft) => {
      element.scrollLeft = Math.max(0, Number(offsetLeft) - 80);
      element.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, restoredStarOffsetLeft);
  await expect(timeline).toBeVisible();
  await expectPageWithoutHorizontalOverflow(page);
  await page.waitForTimeout(200);
  await page.screenshot({
    path: 'reports/m9-r3-r2-r3-contextual-edge-narrow-timeline.png',
  });
});

test('[m9-r3-r1-timeline-layout] keeps team marks above actors and reserves a dedicated scrollbar rail', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const packageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.goto('/#/workbench');
  await packageResponse;
  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 120_000);
  await page.getByTestId('workbench-save-draft').click();
  await page.evaluate(
    ({ storageKey, profiles }) => {
      const draft = JSON.parse(window.localStorage.getItem(storageKey));
      const tuningMarks = profiles
        .filter(profile => profile.profileKey !== 'fire')
        .map(profile => ({
          ...profile,
          heldReadyRemainingMs: 60_000,
          layers: [
            {
              remainingDurationMs: 25_000,
              sourceIdentity: {
                sourceKind: 'm9-r3-r1-layout-fixture',
                profileKey: profile.profileKey,
              },
            },
          ],
        }));
      const applyTimelineState = value => {
        if (!value || typeof value !== 'object') return;
        if (
          Array.isArray(value.actorConfigs) &&
          Array.isArray(value.actionDrafts)
        ) {
          value.durationMs = 120_000;
          value.initialRuntimeState = {
            ...(value.initialRuntimeState ?? {}),
            controlledActor: {
              actorId: 'actor-101003',
              characterId: 101003,
            },
            tuningMarks,
          };
        }
        Object.values(value).forEach(applyTimelineState);
      };
      applyTimelineState(draft);
      window.localStorage.setItem(storageKey, JSON.stringify(draft));
    },
    {
      storageKey: BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
      profiles: M8D_TUNING_MARK_PROFILES,
    }
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  const reloadedPackageResponse = page.waitForResponse(
    response =>
      response.url().includes('verified-combat-mechanics-package') &&
      response.ok()
  );
  await page.reload();
  await reloadedPackageResponse;
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
    .click();
  const source = page.locator(
    '[data-testid="workbench-skill-entry"][data-skill-id="10100312"][data-action-kind="star-skill"]'
  );
  await expect(source).toBeVisible();
  await source.click();
  const viewport = timeline.getByTestId('workbench-timeline-viewport');
  const scaleViewport = timeline.getByTestId(
    'workbench-timeline-scale-viewport'
  );
  const action = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100312"]'
  );
  await expect(action).toHaveCount(1);
  const actionId = await action.getAttribute('data-action-id');
  expect(actionId).toBeTruthy();
  const operationMarker = timeline.locator(
    `[data-testid="workbench-timeline-operation-marker"][data-action-id="${actionId}"]`
  );
  const fireNode = timeline
    .locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-150"] [data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"]`
    )
    .first();

  await expect(timeline).toHaveAttribute('data-duration-ms', '120000');
  await expect(timeline).toHaveAttribute('data-tuning-mark-track-count', '9');
  await expect(operationMarker).toHaveCount(1);
  await expect(fireNode).toBeVisible();
  await expectTimelineScrollbarClearance(timeline);

  await viewport.evaluate(element => {
    element.scrollLeft = Math.max(
      1,
      Math.round((element.scrollWidth - element.clientWidth) * 0.5)
    );
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect
    .poll(async () => {
      const timelineScroll = await viewport.evaluate(
        element => element.scrollLeft
      );
      const scaleScroll = await scaleViewport.evaluate(
        element => element.scrollLeft
      );
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);
  await viewport.evaluate(element => {
    element.scrollLeft = 0;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect
    .poll(async () => {
      const timelineScroll = await viewport.evaluate(
        element => element.scrollLeft
      );
      const scaleScroll = await scaleViewport.evaluate(
        element => element.scrollLeft
      );
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);
  await fireNode.click();
  const alignedGeometry = await timeline.evaluate(
    (element, currentActionId) => {
      const actionElement = element.querySelector(
        `[data-testid="workbench-timeline-action"][data-action-id="${currentActionId}"]`
      );
      const operationElement = element.querySelector(
        `[data-testid="workbench-timeline-operation-marker"][data-action-id="${currentActionId}"]`
      );
      const nodeElement = element.querySelector(
        `[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-150"] [data-testid="workbench-timeline-state-curve-node"][data-action-id="${currentActionId}"]`
      );
      const timelineCursor = element.querySelector(
        '[data-testid="workbench-timeline-frame-cursor"]'
      );
      const scaleCursor = element.querySelector(
        '[data-testid="workbench-timeline-scale-cursor"]'
      );
      const centerX = target => {
        const rect = target.getBoundingClientRect();
        return rect.left + rect.width / 2;
      };
      return {
        actionOperationDelta: Math.abs(
          actionElement.getBoundingClientRect().left -
            operationElement.getBoundingClientRect().left
        ),
        nodeTimelineCursorDelta: Math.abs(
          centerX(nodeElement) - centerX(timelineCursor)
        ),
        timelineScaleCursorDelta: Math.abs(
          centerX(timelineCursor) - centerX(scaleCursor)
        ),
      };
    },
    actionId
  );
  expect(alignedGeometry.actionOperationDelta).toBeLessThanOrEqual(1);
  expect(alignedGeometry.nodeTimelineCursorDelta).toBeLessThanOrEqual(1);
  expect(alignedGeometry.timelineScaleCursorDelta).toBeLessThanOrEqual(1);

  await timeline.getByTestId('workbench-timeline-shell').evaluate(element => {
    element.scrollTop = 0;
  });
  await closeInspectorIfVisible(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m9-r3-r1-timeline-layout-desktop.png',
  });

  await setWorkbenchTimelineDuration(page, 180_000);
  await expectTimelineScrollbarClearance(timeline);
  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await expectTimelineScrollbarClearance(timeline);
  await timeline.getByTestId('workbench-timeline-shell').evaluate(element => {
    element.scrollTop = element.scrollHeight;
  });
  await viewport.evaluate(element => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect
    .poll(async () => {
      const timelineScroll = await viewport.evaluate(
        element => element.scrollLeft
      );
      const scaleScroll = await scaleViewport.evaluate(
        element => element.scrollLeft
      );
      return Math.abs(timelineScroll - scaleScroll);
    })
    .toBeLessThanOrEqual(1);
  await timeline.evaluate(element => {
    const rect = element.getBoundingClientRect();
    window.scrollTo(
      0,
      Math.max(0, window.scrollY + rect.bottom - window.innerHeight)
    );
  });
  await page.screenshot({
    path: 'reports/m9-r3-r1-timeline-layout-narrow.png',
  });
});

test('[m10-b1-ruby-profile-ui] schedules Ruby reload and ammo-aware attacks through the real Workbench', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();
  await page.getByTestId('workbench-scenario-add').click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(timeline).toHaveAttribute('data-duration-ms', '120000');
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    0
  );

  const slotOne = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-1"]'
  );
  await slotOne.getByTestId('workbench-direct-character-picker').click();
  await page
    .getByTestId('workbench-loadout-picker')
    .locator(
      '[data-testid="workbench-loadout-option"][data-option-id="103002"]'
    )
    .click();
  await expect(
    page.locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="103002"]'
    )
  ).toHaveAttribute('data-active', 'true');

  const ammoLaneLabel = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-special-resource-curve"][data-character-id="103002"]'
  );
  const ammoLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-special-resource-curve"]'
  );
  await expect(ammoLaneLabel).toContainText('子弹');
  await expect(ammoLaneLabel).toContainText('初始值');
  await expect(ammoLaneLabel).toContainText('/ 12');
  await expect(ammoLaneLabel).toHaveAttribute('title', /0 \/ 12/);

  const ammoNodes = ammoLane.getByTestId('workbench-timeline-state-curve-node');
  const normalAttackEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="normal-attack"][data-skill-id="10300201"]'
  );
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-103002"]'
  );
  await dragLocatorTo(page, normalAttackEntry, actorLane, {
    targetPosition: { x: 120, y: 72 },
  });
  const normalBlocks = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10300201"]'
  );
  await expect(normalBlocks).toHaveCount(3);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10300201"][data-attack-sequence-index="1"]'
    )
  ).toContainText(/A1.*普通攻击/);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10300201"][data-attack-sequence-index="3"]'
    )
  ).toContainText(/A3.*普通攻击/);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10300201"][data-attack-sequence-index="4"]'
    )
  ).toHaveCount(0);
  await expect(ammoNodes).toHaveCount(0);

  await page.getByTestId('workbench-undo-edit').click();
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    0
  );

  const starSkillEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="star-skill"][data-skill-id="10300212"]'
  );
  await dragLocatorTo(page, starSkillEntry, actorLane, {
    targetPosition: { x: 180, y: 72 },
  });
  const starSkillAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10300212"]'
  );
  await expect(starSkillAction).toHaveCount(1);
  const starSkillActionId =
    await starSkillAction.getAttribute('data-action-id');
  expect(starSkillActionId).toBeTruthy();
  const starAmmoNode = ammoLane.locator(
    `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${starSkillActionId}"]`
  );
  await expect(starAmmoNode).toHaveCount(1);
  await expect(starAmmoNode).toHaveAttribute('title', /子弹 补满 · 0 -> 12/);
  const fireLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-150"]'
  );
  const fireMarkNode = fireLane.locator(
    `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${starSkillActionId}"][data-event-kinds*="acquire"]`
  );
  await expect(fireMarkNode).toHaveCount(1);
  await expect(fireMarkNode).toHaveAttribute('title', /火印记 获取 · 0 -> 1/);

  const stateNodesFor = laneId =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve-node"][data-action-id="${starSkillActionId}"]`
    );
  await expect
    .poll(() => sumTimelineNodeEventCount(stateNodesFor('enemy-hp-curve')))
    .toBe(8);
  await expect
    .poll(() =>
      sumTimelineNodeEventCount(stateNodesFor('enemy-toughness-curve'))
    )
    .toBe(8);
  await expect
    .poll(async () => stateNodesFor('energy-actor-103002').count())
    .toBeGreaterThan(0);

  await starSkillAction.click();
  await openActionInspectorPanel(page, 'properties', starSkillActionId);
  const starSkillHitRows = page.getByTestId('workbench-hit-override-row');
  await expect(starSkillHitRows).toHaveCount(7);
  await expect
    .poll(async () =>
      starSkillHitRows.evaluateAll(rows =>
        rows.map(row => Number(row.dataset.hitFrame))
      )
    )
    .toEqual([37, 44, 49, 54, 59, 64, 69]);
  const firstStarSkillHit = starSkillHitRows
    .first()
    .locator('input[type="checkbox"]');
  await expect(firstStarSkillHit).toBeChecked();
  await firstStarSkillHit.uncheck();
  await expect
    .poll(() => sumTimelineNodeEventCount(stateNodesFor('enemy-hp-curve')))
    .toBe(7);
  await expect
    .poll(() =>
      sumTimelineNodeEventCount(stateNodesFor('enemy-toughness-curve'))
    )
    .toBe(7);
  await expect(starAmmoNode).toHaveAttribute('title', /子弹 补满 · 0 -> 12/);
  await expect(fireMarkNode).toHaveAttribute('title', /火印记 获取 · 0 -> 1/);
  await page.getByTestId('workbench-undo-edit').click();
  await expect
    .poll(() => sumTimelineNodeEventCount(stateNodesFor('enemy-hp-curve')))
    .toBe(8);
  await closeInspectorIfVisible(page);

  const starBox = await starSkillAction.boundingBox();
  const actorLaneBox = await actorLane.boundingBox();
  if (!starBox || !actorLaneBox) {
    throw new Error('Ruby Star Skill placement geometry is unavailable');
  }
  await dragLocatorTo(page, normalAttackEntry, actorLane, {
    targetPosition: {
      x: starBox.x + starBox.width - actorLaneBox.x,
      y: 72,
    },
  });
  await expect(normalBlocks).toHaveCount(12);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10300201"][data-attack-sequence-index="1"]'
    )
  ).toContainText(/E1.*强化普攻/);
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10300201"][data-attack-sequence-index="12"]'
    )
  ).toContainText(/E12.*强化普攻/);
  const enhancedGeometry = await normalBlocks.evaluateAll(actions =>
    actions
      .map(action => {
        const rect = action.getBoundingClientRect();
        return {
          sequenceIndex: Number(
            action.getAttribute('data-attack-sequence-index')
          ),
          startFrame: Math.round(
            (Number(action.getAttribute('data-start-ms')) * 60) / 1000
          ),
          durationFrames: Math.round(
            (Number(action.getAttribute('data-duration-ms')) * 60) / 1000
          ),
          left: rect.left,
          right: rect.right,
        };
      })
      .sort((left, right) => left.sequenceIndex - right.sequenceIndex)
  );
  expect(enhancedGeometry).toHaveLength(12);
  for (let index = 1; index < enhancedGeometry.length; index += 1) {
    const previous = enhancedGeometry[index - 1];
    const current = enhancedGeometry[index];
    expect(current.startFrame).toBe(
      previous.startFrame + previous.durationFrames
    );
    expect(Math.abs(current.left - previous.right)).toBeLessThanOrEqual(1.25);
  }
  await expect(ammoNodes).toHaveCount(13);
  const finalConsume = ammoLane
    .locator(
      '[data-testid="workbench-timeline-state-curve-node"][data-event-kinds*="consume"]'
    )
    .last();
  await expect(finalConsume).toHaveAttribute('title', /1 -> 0/);
  const actionCount = 13;
  const ammoNodeCount = 13;

  await page.getByTestId('workbench-undo-edit').click();
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    1
  );
  await expect(ammoNodes).toHaveCount(1);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    actionCount
  );
  await expect(ammoNodes).toHaveCount(ammoNodeCount);

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(
    page.locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="103002"]'
    )
  ).toHaveAttribute('data-active', 'true');
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    actionCount
  );
  await expect(ammoNodes).toHaveCount(ammoNodeCount);

  await starSkillAction.click();
  await expect(page.getByTestId('workbench-side-inspector')).toContainText(
    '子弹'
  );
  await expect(page.getByTestId('workbench-side-inspector')).toContainText(
    '+12 · 1 个事件'
  );
  await expect(page.getByTestId('workbench-side-inspector')).toContainText(
    '火'
  );
  await page.screenshot({
    path: 'reports/m10-b1-r4-ruby-star-skill-settlement-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await expect(ammoLaneLabel).toContainText('子弹');
  await expect(timeline.getByTestId('workbench-timeline-action')).toHaveCount(
    actionCount
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m10-b1-r4-ruby-star-skill-settlement-narrow.png',
  });
});

test('[m10-b2-han-firework-runtime] replays Han Youyou Firework, charged forms, and three-value changes through the real Workbench', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();
  await page.getByTestId('workbench-scenario-add').click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const slotOne = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-1"]'
  );
  await slotOne.getByTestId('workbench-direct-character-picker').click();
  await page
    .getByTestId('workbench-loadout-picker')
    .locator(
      '[data-testid="workbench-loadout-option"][data-option-id="101003"]'
    )
    .click();
  await expect(
    page.locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="101003"]'
    )
  ).toHaveAttribute('data-active', 'true');
  const actorInitialSp = timeline.locator(
    '[data-testid="workbench-timeline-initial-energy-input"][data-owner-kind="actor"][data-character-id="101003"]'
  );
  await expect(actorInitialSp).toHaveValue('0');
  const addSwitchAtFrame = async ({
    sourceCharacterId,
    targetCharacterId,
    frame,
  }) => {
    await closeInspectorIfVisible(page);
    await page
      .locator(
        `[data-testid="workbench-action-library-actor"][data-character-id="${sourceCharacterId}"]`
      )
      .click();
    const switchActions = timeline.locator(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    );
    const existingSwitchActionIds = new Set(
      await switchActions.evaluateAll(rows =>
        rows.map(row => row.dataset.actionId).filter(Boolean)
      )
    );
    await page.getByTestId('workbench-add-switch-action').click();
    await expect
      .poll(async () => {
        const actionIds = await switchActions.evaluateAll(rows =>
          rows.map(row => row.dataset.actionId).filter(Boolean)
        );
        return actionIds.filter(
          actionId => !existingSwitchActionIds.has(actionId)
        ).length;
      })
      .toBe(1);
    const newSwitchActionId = (
      await switchActions.evaluateAll(rows =>
        rows.map(row => row.dataset.actionId).filter(Boolean)
      )
    ).find(actionId => !existingSwitchActionIds.has(actionId));
    const switchAction = timeline.locator(
      `[data-testid="workbench-timeline-action"][data-switch-event="true"][data-action-id="${newSwitchActionId}"]`
    );
    await expect(switchAction).toHaveCount(1);
    await switchAction.click();
    const switchTarget = page.getByTestId('workbench-switch-target-select');
    const targetOptions = await switchTarget
      .locator('option')
      .evaluateAll(options =>
        options.map(option => String(option.value)).filter(Boolean)
      );
    const resolvedTargetCharacterId = targetOptions.includes(
      String(targetCharacterId)
    )
      ? String(targetCharacterId)
      : targetOptions.find(option => option !== String(sourceCharacterId));
    if (!resolvedTargetCharacterId) {
      throw new Error(
        `No switch target is available for ${sourceCharacterId} at frame ${frame}`
      );
    }
    if ((await switchTarget.inputValue()) !== resolvedTargetCharacterId) {
      await switchTarget.selectOption(resolvedTargetCharacterId);
    }
    const frameInput = page.getByTestId('workbench-start-frame-input');
    await frameInput.fill(String(frame));
    await frameInput.press('Enter');
    await expect(switchAction).toHaveAttribute(
      'data-start-ms',
      String(frameToMs(frame))
    );
    await closeInspectorIfVisible(page);
    return {
      switchAction,
      targetCharacterId: Number(resolvedTargetCharacterId),
    };
  };

  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-101003"]'
  );
  const starSkillEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="star-skill"][data-skill-id="10100312"]'
  );
  const chargedEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="charged-attack"][data-skill-id="10100301"]'
  );
  await dragLocatorTo(page, starSkillEntry, actorLane, {
    targetPosition: { x: 120, y: 72 },
  });
  const starSkillAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100312"]'
  );
  await expect(starSkillAction).toHaveCount(1);
  await setTimelineActionStartFrame(page, starSkillAction, 60);

  await dragLocatorTo(page, chargedEntry, actorLane, {
    targetPosition: { x: 260, y: 72 },
  });
  const chargedActions = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100301"]'
  );
  await expect(chargedActions).toHaveCount(1);
  const stageOneAction = chargedActions.first();
  await expect(stageOneAction).toContainText('重击1段');
  await expect(stageOneAction).toContainText('control 10100310/sub0');
  await setTimelineActionStartFrame(page, stageOneAction, 153);

  const starSkillActionId =
    await starSkillAction.getAttribute('data-action-id');
  const stageOneActionId = await stageOneAction.getAttribute('data-action-id');
  expect(starSkillActionId).toBeTruthy();
  expect(stageOneActionId).toBeTruthy();
  await expect
    .poll(async () =>
      Number(await starSkillAction.getAttribute('data-start-ms'))
    )
    .toBe(frameToMs(60));
  await expect
    .poll(async () =>
      Number(await stageOneAction.getAttribute('data-start-ms'))
    )
    .toBe(frameToMs(153));

  const fireworkIntervals = timeline.locator(
    '[data-testid="workbench-timeline-effect-interval"][data-effect-id="battle-element:101003079"][data-target-kind="enemy"]'
  );
  await expect.poll(async () => fireworkIntervals.count()).toBeGreaterThan(0);
  await expect(fireworkIntervals.first()).toContainText('焰火');
  await expect(fireworkIntervals.first()).toHaveAttribute(
    'data-peak-stacks',
    '7'
  );
  await expect(fireworkIntervals.first()).toHaveAttribute(
    'data-max-stacks',
    '15'
  );
  const fireworkConsume = fireworkIntervals
    .first()
    .locator(
      '[data-testid="workbench-effect-lifecycle-marker"][data-before-stacks="7"][data-after-stacks="1"]'
    );
  await expect(fireworkConsume).toHaveCount(1);

  const stateNodesFor = (laneId, actionId) =>
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve-node"][data-action-id="${actionId}"]`
    );
  await expect
    .poll(async () =>
      stateNodesFor('energy-actor-101003', stageOneActionId).count()
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      sumTimelineNodeEventCount(
        stateNodesFor('enemy-hp-curve', stageOneActionId)
      )
    )
    .toBe(9);
  await expect
    .poll(() =>
      sumTimelineNodeEventCount(
        stateNodesFor('enemy-toughness-curve', stageOneActionId)
      )
    )
    .toBe(9);

  await stageOneAction.click();
  await openActionInspectorPanel(page, 'properties', stageOneActionId);
  const stageOneHitRows = page.getByTestId('workbench-hit-override-row');
  const stageOneExplosionRows = page.locator(
    '[data-testid="workbench-hit-override-row"][data-hit-label*="重击1引爆"]'
  );
  await expect(stageOneHitRows).toHaveCount(9);
  await expect(stageOneExplosionRows).toHaveCount(5);
  await expect
    .poll(async () =>
      stageOneExplosionRows.evaluateAll(rows =>
        rows.map(row => Number(row.dataset.hitFrame))
      )
    )
    .toEqual([31, 55, 58, 62, 65]);

  const controlledAttackBuff = timeline.locator(
    `[data-testid="workbench-timeline-effect-interval"][data-effect-id="battle-element:480124006"][data-target-id="actor-101003"][data-source-action-id="${stageOneActionId}"]`
  );
  const stageOneTeamTuningBuffs = timeline.locator(
    `[data-testid="workbench-timeline-effect-interval"][data-effect-id="battle-element:101003205"][data-source-action-id="${stageOneActionId}"]`
  );
  await expect(controlledAttackBuff).toHaveCount(1);
  await expect(stageOneTeamTuningBuffs).toHaveCount(3);
  const attackBuffAbsoluteEndFrame = await controlledAttackBuff.getAttribute(
    'data-end-frame-index'
  );
  expect(Number(attackBuffAbsoluteEndFrame)).toBeGreaterThan(500);
  const attackBuffSwitch = await addSwitchAtFrame({
    sourceCharacterId: 101003,
    targetCharacterId: 109001,
    frame: 500,
  });
  const attackBuffTargetCharacterId = attackBuffSwitch.targetCharacterId;
  const inheritedAttackBuff = timeline.locator(
    `[data-testid="workbench-timeline-effect-interval"][data-effect-id="battle-element:480124006"][data-target-id="actor-${attackBuffTargetCharacterId}"][data-source-action-id="${stageOneActionId}"]`
  );
  await expect(controlledAttackBuff).toHaveAttribute(
    'data-end-frame-index',
    '500'
  );
  await expect(inheritedAttackBuff).toHaveCount(1);
  await expect(inheritedAttackBuff).toHaveAttribute(
    'data-start-frame-index',
    '500'
  );
  await expect(inheritedAttackBuff).toHaveAttribute(
    'data-end-frame-index',
    attackBuffAbsoluteEndFrame
  );
  await expect(stageOneTeamTuningBuffs).toHaveCount(3);
  await addSwitchAtFrame({
    sourceCharacterId: attackBuffTargetCharacterId,
    targetCharacterId: 101003,
    frame: 1700,
  });
  await expect(inheritedAttackBuff).toHaveCount(1);
  await expect(controlledAttackBuff).toHaveCount(1);
  await expect(stageOneTeamTuningBuffs).toHaveCount(3);
  await controlledAttackBuff.click();
  await openRuntimeReviewTab(page, 'effect');
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('焰火爆炸·主控攻击力提升');
  await expect(
    page.getByTestId('workbench-effect-interval-modifiers')
  ).toHaveText('攻击力 +10%');
  await stageOneTeamTuningBuffs.first().click();
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('焰火爆炸·全队调谐强度提升');
  await expect(
    page.getByTestId('workbench-effect-interval-modifiers')
  ).toHaveText('调谐强度 +18/层');

  await openRuntimeReviewTab(page, 'event');
  await page
    .locator(
      '[data-testid="workbench-runtime-sim-log-mode-option"][data-review-mode="delta"]'
    )
    .click();
  await page
    .locator(
      '[data-testid="workbench-runtime-sim-log-track-filter"][data-track-filter="selfEnergyChange"]'
    )
    .click();
  await page
    .getByTestId('workbench-runtime-sim-log-action-filter')
    .selectOption(stageOneActionId);
  await expect(
    page.getByTestId('workbench-runtime-sim-log-window')
  ).toContainText('SP +2');

  await starSkillAction.click();
  await openActionInspectorPanel(page, 'properties', starSkillActionId);
  const disabledStarHit = page.locator(
    '[data-testid="workbench-hit-override-row"][data-hit-frame="68"] input[type="checkbox"]'
  );
  await expect(disabledStarHit).toBeChecked();
  await disabledStarHit.uncheck();
  await expect(fireworkIntervals.first()).toHaveAttribute(
    'data-peak-stacks',
    '6'
  );
  await expect(
    fireworkIntervals
      .first()
      .locator(
        '[data-testid="workbench-effect-lifecycle-marker"][data-before-stacks="6"][data-after-stacks="0"]'
      )
  ).toHaveCount(1);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(fireworkIntervals.first()).toHaveAttribute(
    'data-peak-stacks',
    '7'
  );

  await setTimelineActionStartFrame(page, starSkillAction, 400);
  await stageOneAction.click();
  await openActionInspectorPanel(page, 'properties', stageOneActionId);
  await expect(stageOneHitRows).toHaveCount(4);
  await expect(stageOneExplosionRows).toHaveCount(0);
  await expect
    .poll(() =>
      sumTimelineNodeEventCount(
        stateNodesFor('enemy-hp-curve', stageOneActionId)
      )
    )
    .toBe(4);
  await expect(controlledAttackBuff).toHaveCount(0);
  await expect(inheritedAttackBuff).toHaveCount(0);
  await expect(stageOneTeamTuningBuffs).toHaveCount(0);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(starSkillAction).toHaveAttribute(
    'data-start-ms',
    String(frameToMs(60))
  );
  await expect(fireworkIntervals.first()).toHaveAttribute(
    'data-peak-stacks',
    '7'
  );
  await expect
    .poll(() =>
      sumTimelineNodeEventCount(
        stateNodesFor('enemy-hp-curve', stageOneActionId)
      )
    )
    .toBe(9);
  await stageOneAction.click();
  await openActionInspectorPanel(page, 'properties', stageOneActionId);
  await expect(stageOneExplosionRows).toHaveCount(5);
  await expect(controlledAttackBuff).toHaveCount(1);
  await expect(inheritedAttackBuff).toHaveCount(1);

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(starSkillAction).toHaveCount(1);
  await expect(chargedActions).toHaveCount(1);
  await expect(stageOneAction).toContainText('重击1段');
  await expect(fireworkIntervals.first()).toContainText('焰火');
  await expect(inheritedAttackBuff).toHaveCount(1);

  await actorInitialSp.fill('100');
  await actorInitialSp.press('Enter');
  await expect(actorInitialSp).toHaveValue('100');
  const ultimateEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="ultimate"][data-skill-id="10100313"]'
  );
  await dragLocatorTo(page, ultimateEntry, actorLane, {
    targetPosition: { x: 620, y: 72 },
  });
  const ultimateAction = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10100313"]'
  );
  await expect(ultimateAction).toHaveCount(1);
  await setTimelineActionStartFrame(page, ultimateAction, 1800);
  await expect(ultimateAction).toHaveAttribute(
    'data-readiness-executable',
    'true'
  );

  const controlledTuningBuffs = timeline.locator(
    '[data-testid="workbench-timeline-effect-interval"][data-source-element-id="101003207"]'
  );
  const controlledTuningBuffBeforeSwitch = timeline.locator(
    '[data-testid="workbench-timeline-effect-interval"][data-source-element-id="101003207"][data-target-id="actor-101003"]'
  );
  const teamTuningBuffs = timeline.locator(
    '[data-testid="workbench-timeline-effect-interval"][data-source-element-id="101003205"]'
  );
  await expect(controlledTuningBuffs).toHaveCount(1);
  await expect(teamTuningBuffs).toHaveCount(3);
  await expect(controlledTuningBuffBeforeSwitch).toContainText(
    '主控角色调谐强度提升'
  );
  await expect(controlledTuningBuffBeforeSwitch).toHaveAttribute(
    'data-target-id',
    'actor-101003'
  );
  await expect(controlledTuningBuffBeforeSwitch).toHaveAttribute(
    'data-start-frame-index',
    '1948'
  );
  await expect(controlledTuningBuffBeforeSwitch).toHaveAttribute(
    'data-end-frame-index',
    '2848'
  );
  await expect(controlledTuningBuffBeforeSwitch).toHaveAttribute(
    'data-peak-stacks',
    '1'
  );
  await expect(teamTuningBuffs.first()).toContainText('全队调谐强度提升');
  await expect(teamTuningBuffs.first()).toHaveAttribute(
    'data-start-frame-index',
    '1948'
  );
  await expect(teamTuningBuffs.first()).toHaveAttribute(
    'data-end-frame-index',
    '3388'
  );
  await expect(teamTuningBuffs.first()).toHaveAttribute(
    'data-peak-stacks',
    '2'
  );

  await controlledTuningBuffBeforeSwitch.scrollIntoViewIfNeeded();
  await controlledTuningBuffBeforeSwitch.click();
  await openRuntimeReviewTab(page, 'effect');
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('主控角色调谐强度提升');
  await expect(
    page.getByTestId('workbench-effect-interval-modifiers')
  ).toHaveText('调谐强度 +1,019.91');
  await teamTuningBuffs.first().click();
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('全队调谐强度提升');
  await expect(
    page.getByTestId('workbench-effect-interval-modifiers')
  ).toHaveText('调谐强度 +18/层');
  await expect(page.locator('body')).not.toContainText('精通加成');

  const tuningBuffSwitch = await addSwitchAtFrame({
    sourceCharacterId: 101003,
    targetCharacterId: attackBuffTargetCharacterId,
    frame: 2100,
  });
  const tuningBuffTargetCharacterId = tuningBuffSwitch.targetCharacterId;
  const controlledTuningBuffNewTarget = timeline.locator(
    `[data-testid="workbench-timeline-effect-interval"][data-source-element-id="101003207"][data-target-id="actor-${tuningBuffTargetCharacterId}"]`
  );
  await expect(controlledTuningBuffs).toHaveCount(2);
  await expect(controlledTuningBuffBeforeSwitch).toHaveCount(1);
  await expect(controlledTuningBuffBeforeSwitch).toHaveAttribute(
    'data-start-frame-index',
    '1948'
  );
  await expect(controlledTuningBuffBeforeSwitch).toHaveAttribute(
    'data-end-frame-index',
    '2100'
  );
  await expect(controlledTuningBuffNewTarget).toHaveCount(1);
  await expect(controlledTuningBuffNewTarget).toHaveAttribute(
    'data-start-frame-index',
    '2100'
  );
  await expect(controlledTuningBuffNewTarget).toHaveAttribute(
    'data-end-frame-index',
    '2848'
  );
  await expect(teamTuningBuffs).toHaveCount(3);
  await controlledTuningBuffNewTarget.click();
  await openRuntimeReviewTab(page, 'effect');
  await expect(
    page.getByTestId('workbench-effect-selected-interval')
  ).toContainText('主控角色调谐强度提升');
  await expect(
    page.getByTestId('workbench-effect-interval-modifiers')
  ).toHaveText('调谐强度 +1,019.91');

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(controlledTuningBuffs).toHaveCount(2);
  await expect(controlledTuningBuffBeforeSwitch).toHaveCount(1);
  await expect(controlledTuningBuffNewTarget).toHaveCount(1);
  await expect(teamTuningBuffs).toHaveCount(3);
  await controlledTuningBuffNewTarget.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: 'reports/m10-b2-r1-han-causal-chain-desktop.png',
  });

  const ultimateActionId = await ultimateAction.getAttribute('data-action-id');
  expect(ultimateActionId).toBeTruthy();
  await ultimateAction.click();
  const hanTraceInspector = await openActionInspectorPanel(
    page,
    'canonical-trace',
    ultimateActionId
  );
  const hanTraceIntervals = hanTraceInspector.getByTestId(
    'canonical-trace-effect-interval'
  );
  const hanTeamTraceIntervals = hanTraceIntervals.filter({
    hasText: '全队调谐强度提升',
  });
  const hanControlledTraceInterval = hanTraceIntervals.filter({
    hasText: '主控角色调谐强度提升',
  });
  await expect(hanTeamTraceIntervals).toHaveCount(3);
  await expect(hanControlledTraceInterval).toHaveCount(2);
  await expect(hanTeamTraceIntervals.first()).toContainText(
    '1948F - 3388F · 2 层'
  );
  await expect(hanControlledTraceInterval.first()).toContainText(
    'actor-101003 · 1948F - 2100F · 1 层'
  );
  await expect(hanControlledTraceInterval.last()).toContainText(
    `actor-${tuningBuffTargetCharacterId} · 2100F - 2848F · 1 层`
  );
  const hanIntervalIdentities = await hanTraceIntervals.evaluateAll(rows =>
    rows.map(row => row.dataset.effectIdentity).filter(Boolean)
  );
  expect(new Set(hanIntervalIdentities).size).toBe(
    hanIntervalIdentities.length
  );

  await closeInspectorIfVisible(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await expect(controlledTuningBuffNewTarget).toContainText(
    '主控角色调谐强度提升'
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m10-b2-r1-han-causal-chain-narrow.png',
  });
});

test('[m10-b1-r2-ruby-replay] reprojects a public normal attack from the replayed Ruby state', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();
  await page.getByTestId('workbench-scenario-add').click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const slotOne = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-1"]'
  );
  await slotOne.getByTestId('workbench-direct-character-picker').click();
  await page
    .getByTestId('workbench-loadout-picker')
    .locator(
      '[data-testid="workbench-loadout-option"][data-option-id="103002"]'
    )
    .click();
  const rubyInitialAmmo = timeline.locator(
    '[data-testid="workbench-timeline-initial-special-resource-input"][data-character-id="103002"][data-resource-identity="actor:103002:element:103002047"]'
  );
  await expect(rubyInitialAmmo).toHaveValue('0');
  await rubyInitialAmmo.fill('6');
  await rubyInitialAmmo.press('Enter');
  await expect(rubyInitialAmmo).toHaveValue('6');

  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-103002"]'
  );
  const ammoLaneLabel = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-special-resource-curve"][data-character-id="103002"]'
  );
  await expect(ammoLaneLabel).toContainText('子弹');
  await expect(ammoLaneLabel).toContainText('初始值');
  await expect(ammoLaneLabel).toContainText('/ 12');
  await expect(ammoLaneLabel).toHaveAttribute('title', /6 \/ 12/);
  const normalAttackEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="normal-attack"][data-skill-id="10300201"]'
  );
  await dragLocatorTo(page, normalAttackEntry, actorLane, {
    targetPosition: { x: 120, y: 72 },
  });
  const normalBlocks = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10300201"]'
  );
  await expect(normalBlocks).toHaveCount(3);
  const firstGroupId = await normalBlocks
    .filter({ hasText: /A1.*普通攻击/ })
    .getAttribute('data-attack-group-id');
  expect(firstGroupId).toBeTruthy();
  const firstA3 = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-attack-group-id="${firstGroupId}"][data-attack-sequence-index="3"]`
  );
  const firstA3StartMs = Number(await firstA3.getAttribute('data-start-ms'));
  const durationMs = Number(await timeline.getAttribute('data-duration-ms'));
  const actorLaneBox = await actorLane.boundingBox();
  if (!actorLaneBox || !durationMs) {
    throw new Error('Ruby A3 transition geometry is unavailable');
  }
  const transitionStartMs = firstA3StartMs + frameToMs(34);
  await dragLocatorTo(page, normalAttackEntry, actorLane, {
    targetPosition: {
      x: (transitionStartMs / durationMs) * actorLaneBox.width,
      y: 72,
    },
  });
  await expect(normalBlocks).toHaveCount(9);
  const groupIds = await normalBlocks.evaluateAll(actions => [
    ...new Set(
      actions
        .map(action => action.getAttribute('data-attack-group-id'))
        .filter(Boolean)
    ),
  ]);
  const enhancedGroupId = groupIds.find(groupId => groupId !== firstGroupId);
  expect(enhancedGroupId).toBeTruthy();
  const projectedGroup = () =>
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-attack-group-id="${enhancedGroupId}"]`
    );
  await expect(projectedGroup()).toHaveCount(6);
  const projectedFirst = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-attack-group-id="${enhancedGroupId}"][data-attack-sequence-index="1"]`
  );
  await expect(projectedFirst).toContainText(/E1.*强化普攻/);
  const projectedFirstId = await projectedFirst.getAttribute('data-action-id');
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-row"][data-lane-kind="actor-special-resource-curve"] [data-testid="workbench-timeline-state-curve-node"][data-action-id="${projectedFirstId}"]`
    )
  ).toHaveAttribute('title', /6 -> 5/);

  await dragTimelineActionByFrames(page, projectedFirst, 50);
  await expect(projectedGroup()).toHaveCount(3);
  await expect(projectedFirst).toContainText(/A1.*普通攻击/);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(projectedGroup()).toHaveCount(6);
  await expect(projectedFirst).toContainText(/E1.*强化普攻/);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(projectedGroup()).toHaveCount(3);
  await expect(projectedFirst).toContainText(/A1.*普通攻击/);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(projectedGroup()).toHaveCount(6);
  await expect(projectedFirst).toContainText(/E1.*强化普攻/);

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(projectedGroup()).toHaveCount(6);
  await expect(projectedFirst).toContainText(/E1.*强化普攻/);
  await page.screenshot({
    path: 'reports/m10-b1-r2-ruby-replay-desktop.png',
  });
  await page.screenshot({
    path: 'reports/m10-b1-r4-ruby-initial-ammo-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await expect(projectedGroup()).toHaveCount(6);
  await page.screenshot({
    path: 'reports/m10-b1-r2-ruby-replay-narrow.png',
  });
  await page.screenshot({
    path: 'reports/m10-b1-r4-ruby-initial-ammo-narrow.png',
  });
});

test('[m10-b1-r2-switch-cooldown] suppresses cooldown-active switch children before timeline materialization', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const draft = createM10B1R2SwitchCooldownDraft();
  await page.addInitScript(
    ({ storageKey, draftState }) => {
      const markerKey = 'promilia-axis-tool:e2e-m10-b1-r2-switch-seeded';
      if (window.sessionStorage.getItem(markerKey) === '1') return;
      window.localStorage.setItem(storageKey, JSON.stringify(draftState));
      window.sessionStorage.setItem(markerKey, '1');
    },
    {
      storageKey: BASIC_WORKBENCH_DRAFT_STORAGE_KEY,
      draftState: draft,
    }
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(timeline).toHaveAttribute('data-duration-ms', '120000');

  const firstSwitchId = 'm10-b1-r2-switch-first';
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-parent-action-id="${firstSwitchId}"][data-derived-action-kind="switch-triggered-star-carry"]`
    )
  ).toHaveCount(2);
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-parent-action-id="${firstSwitchId}"][data-derived-action-kind="switch-triggered-star-carry"][data-skill-id="10100322"]`
    )
  ).toHaveCount(1);

  const cooldownSwitchId = 'm10-b1-r2-switch-during-cooldown';
  let cooldownSwitch = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${cooldownSwitchId}"]`
  );
  const suppressedRubyChild = () =>
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-parent-action-id="${cooldownSwitchId}"][data-derived-action-kind="switch-triggered-star-carry"][data-skill-id="10100322"]`
    );
  await expect(suppressedRubyChild()).toHaveCount(0);

  const manualActorTab = page.locator(
    '[data-testid="workbench-action-library-actor"][data-character-id="109001"]'
  );
  await manualActorTab.click();
  await expect(manualActorTab).toHaveAttribute('data-active', 'true');
  const manualEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="star-skill"][data-skill-id="10900112"]'
  );
  const manualLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-109001"]'
  );
  await expect(manualEntry).toBeVisible();
  const assistedMode = page.locator(
    '[data-testid="workbench-action-placement-mode-option"][data-mode="assisted"]'
  );
  await assistedMode.click();
  const previousManualIds = new Set(
    await timeline
      .locator(
        '[data-testid="workbench-timeline-action"][data-skill-id="10900112"]'
      )
      .evaluateAll(actions =>
        actions.map(action => action.getAttribute('data-action-id'))
      )
  );
  await beginPointerDragTo(page, manualEntry, manualLane, {
    targetPosition: { x: 280, y: 82 },
  });
  await expect(
    timeline.getByTestId('workbench-action-placement-ghost')
  ).toBeVisible();
  await page.mouse.up();
  const newManualIds = await timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10900112"]'
    )
    .evaluateAll(
      (actions, previousIds) =>
        actions
          .map(action => action.getAttribute('data-action-id'))
          .filter(actionId => !previousIds.includes(actionId)),
      [...previousManualIds]
    );
  expect(newManualIds.length).toBeGreaterThan(0);
  for (const actionId of newManualIds) {
    const action = timeline.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
    );
    await expect(action).not.toHaveClass(/overlap/);
    await expect(action).not.toHaveAttribute(
      'data-readiness-status',
      'blocked'
    );
  }

  await cooldownSwitch.click();
  const frameInput = page.getByTestId('workbench-start-frame-input');
  await frameInput.fill('2100');
  await frameInput.press('Enter');
  await expect(suppressedRubyChild()).toHaveCount(1);
  await page.getByTestId('workbench-undo-edit').click();
  cooldownSwitch = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-action-id="${cooldownSwitchId}"]`
  );
  await expect(suppressedRubyChild()).toHaveCount(0);
  for (const actionId of newManualIds) {
    await expect(
      timeline.locator(
        `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
      )
    ).not.toHaveClass(/overlap/);
  }
  await page.getByTestId('workbench-redo-edit').click();
  await expect(suppressedRubyChild()).toHaveCount(1);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(suppressedRubyChild()).toHaveCount(0);

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(suppressedRubyChild()).toHaveCount(0);
  await page.screenshot({
    path: 'reports/m10-b1-r2-switch-cooldown-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await expect(suppressedRubyChild()).toHaveCount(0);
  await page.screenshot({
    path: 'reports/m10-b1-r2-switch-cooldown-narrow.png',
  });
});

test('[m10-b1-r3-ruby-star-carry-entry] replays a real switch into Ruby thunder mark and a public enhanced attack chain', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();
  await page.getByTestId('workbench-scenario-add').click();

  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const slotTwo = timeline.locator(
    '[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-team-slot-id="team-slot-2"]'
  );
  await slotTwo.getByTestId('workbench-direct-character-picker').click();
  await page
    .getByTestId('workbench-loadout-picker')
    .locator(
      '[data-testid="workbench-loadout-option"][data-option-id="103002"]'
    )
    .click();
  const rubyInitialAmmo = timeline.locator(
    '[data-testid="workbench-timeline-initial-special-resource-input"][data-character-id="103002"][data-resource-identity="actor:103002:element:103002047"]'
  );
  await expect(rubyInitialAmmo).toHaveValue('0');
  await rubyInitialAmmo.fill('12');
  await rubyInitialAmmo.press('Enter');
  await expect(rubyInitialAmmo).toHaveValue('12');

  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="109001"]'
    )
    .click();
  await page.getByTestId('workbench-add-switch-action').click();
  const switchParent = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-switch-event="true"]'
    )
    .last();
  await expect(switchParent).toHaveCount(1);
  await switchParent.click();
  const switchTarget = page.getByTestId('workbench-switch-target-select');
  if ((await switchTarget.inputValue()) !== '103002') {
    await switchTarget.selectOption('103002');
  }
  const frameInput = page.getByTestId('workbench-start-frame-input');
  await frameInput.fill('600');
  await frameInput.press('Enter');

  const switchParentId = await switchParent.getAttribute('data-action-id');
  expect(switchParentId).toBeTruthy();
  const starCarry = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-parent-action-id="${switchParentId}"][data-derived-action-kind="switch-triggered-star-carry"][data-skill-id="10300221"]`
  );
  await expect(starCarry).toHaveCount(1);
  await expect(starCarry).toHaveAttribute('data-read-only', 'true');
  await expect(starCarry).toHaveAttribute('data-duration-ms', '1550');
  const starCarryId = await starCarry.getAttribute('data-action-id');
  expect(starCarryId).toBeTruthy();

  const thunderLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="tuning-mark-250"]'
  );
  const thunderNode = thunderLane.locator(
    `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${starCarryId}"][data-event-kinds*="acquire"]`
  );
  await expect(thunderNode).toHaveCount(1);
  await expect(thunderNode).toHaveAttribute('title', /雷印记 获取 · 0 -> 1/);

  await page
    .locator(
      '[data-testid="workbench-action-library-actor"][data-character-id="103002"]'
    )
    .click();
  const normalAttackEntry = page.locator(
    '[data-testid="workbench-skill-entry"][data-action-kind="normal-attack"][data-skill-id="10300201"]'
  );
  const actorLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-id="actor-103002"]'
  );
  const laneBox = await actorLane.boundingBox();
  const timelineDurationMs = Number(
    await timeline.getAttribute('data-duration-ms')
  );
  const starCarryStartMs = Number(
    await starCarry.getAttribute('data-start-ms')
  );
  const starCarryDurationMs = Number(
    await starCarry.getAttribute('data-duration-ms')
  );
  if (!laneBox || !timelineDurationMs || !starCarryDurationMs) {
    throw new Error('Ruby Star Carry timeline geometry is unavailable');
  }
  await dragLocatorTo(page, normalAttackEntry, actorLane, {
    targetPosition: {
      x:
        ((starCarryStartMs + starCarryDurationMs) / timelineDurationMs) *
        laneBox.width,
      y: 72,
    },
  });

  const enhancedBlocks = timeline.locator(
    '[data-testid="workbench-timeline-action"][data-skill-id="10300201"]'
  );
  await expect(enhancedBlocks).toHaveCount(12);
  const enhancedFirstBlock = timeline
    .locator(
      '[data-testid="workbench-timeline-action"][data-skill-id="10300201"][data-attack-sequence-index="1"]'
    )
    .first();
  const enhancedGroupId = await enhancedFirstBlock.getAttribute(
    'data-attack-group-id'
  );
  expect(enhancedGroupId).toBeTruthy();
  const projectedGroup = () =>
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-attack-group-id="${enhancedGroupId}"]`
    );
  const firstEnhanced = timeline.locator(
    `[data-testid="workbench-timeline-action"][data-attack-group-id="${enhancedGroupId}"][data-attack-sequence-index="1"]`
  );
  await expect(firstEnhanced).toContainText(/E1.*强化普攻/);
  await expect(
    timeline.locator(
      `[data-testid="workbench-timeline-action"][data-attack-group-id="${enhancedGroupId}"][data-attack-sequence-index="12"]`
    )
  ).toContainText(/E12.*强化普攻/);
  const firstEnhancedId = await firstEnhanced.getAttribute('data-action-id');
  const ammoLane = timeline.locator(
    '[data-testid="workbench-timeline-row"][data-lane-kind="actor-special-resource-curve"]'
  );
  await expect(
    ammoLane.locator(
      `[data-testid="workbench-timeline-state-curve-node"][data-action-id="${firstEnhancedId}"]`
    )
  ).toHaveAttribute('title', /12 -> 11/);

  await dragTimelineActionByFrames(page, firstEnhanced, 20);
  await expect(projectedGroup()).toHaveCount(3);
  await expect(firstEnhanced).toContainText(/A1.*普通攻击/);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(projectedGroup()).toHaveCount(12);
  await expect(firstEnhanced).toContainText(/E1.*强化普攻/);
  await page.getByTestId('workbench-redo-edit').click();
  await expect(projectedGroup()).toHaveCount(3);
  await expect(firstEnhanced).toContainText(/A1.*普通攻击/);
  await page.getByTestId('workbench-undo-edit').click();
  await expect(projectedGroup()).toHaveCount(12);
  await expect(firstEnhanced).toContainText(/E1.*强化普攻/);

  await page.getByTestId('workbench-save-draft').click();
  await page.reload();
  await expect(page.getByTestId('workbench-draft-status')).toHaveText(
    '已恢复草稿'
  );
  await expect(starCarry).toHaveCount(1);
  await expect(thunderNode).toHaveCount(1);
  await expect(projectedGroup()).toHaveCount(12);
  await expect(firstEnhanced).toContainText(/E1.*强化普攻/);

  await starCarry.click();
  await expect(page.getByTestId('workbench-side-inspector')).toContainText(
    '星携技'
  );
  await expect(page.getByTestId('workbench-side-inspector')).toContainText(
    'elementConfigId=250'
  );
  await openRuntimeReviewTab(page, 'event');
  await expect(page.getByTestId('workbench-event-log-panel')).toContainText(
    '强化普攻 E1'
  );
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m10-b1-r3-ruby-star-carry-entry-desktop.png',
  });

  await page.setViewportSize({ width: 390, height: 900 });
  await closeInspectorIfVisible(page);
  await expectPageWithoutHorizontalOverflow(page);
  await expect(starCarry).toHaveCount(1);
  await expect(thunderNode).toHaveCount(1);
  await expect(projectedGroup()).toHaveCount(12);
  await timeline
    .getByTestId('workbench-timeline-viewport')
    .evaluate((viewport, actionId) => {
      const action = viewport.querySelector(
        `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
      );
      viewport.scrollLeft = Math.max(
        0,
        Number(action?.offsetLeft ?? 0) - viewport.clientWidth * 0.25
      );
      viewport.dispatchEvent(new Event('scroll', { bubbles: true }));
    }, starCarryId);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m10-b1-r3-ruby-star-carry-entry-narrow.png',
  });
});

test('[m11-c-canonical-trace-workbench] imports, inspects, edits, and round-trips one canonical Machine Axis trace', async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();

  await clickProjectMenuCommand(page, 'workbench-open-machine-axis');
  const dialog = page.getByTestId('workbench-machine-axis-dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('workbench-machine-axis-load-fixture').click();
  await expect(dialog.getByTestId('machine-axis-status')).toContainText(
    '已载入 M11-B 120 秒验收轴',
    { timeout: 30_000 }
  );

  const workbench = page.locator('main.workbench');
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await expect(workbench).toHaveAttribute(
    'data-canonical-trace-hash',
    '017c87abc8087efc'
  );
  await expect(workbench).toHaveAttribute(
    'data-canonical-trace-action-count',
    '16'
  );
  await expect(workbench).toHaveAttribute(
    'data-machine-axis-import-active',
    'true'
  );
  await expect(dialog.getByTestId('machine-axis-summary')).toContainText(
    '机器输入 14'
  );
  await expect(dialog.getByTestId('machine-axis-summary')).toContainText(
    '实际执行 16'
  );

  for (const actionId of [
    'xunlang-signature',
    'a3-sampled',
    'switch-to-xiaoyu',
    'xiaoyu-charged',
    'switch-to-ruby',
    'ruby-enhanced-e1-intent',
  ]) {
    await expect(
      timeline.locator(
        `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
      )
    ).toHaveCount(1);
  }
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="switch-to-xiaoyu"][data-switch-event="true"]'
    )
  ).toHaveAttribute('data-duration-ms', '0');
  await expect(
    timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="switch-to-ruby"][data-switch-event="true"]'
    )
  ).toHaveAttribute('data-duration-ms', '0');

  const downloadPromise = page.waitForEvent('download');
  await dialog.getByTestId('workbench-machine-axis-export').click();
  const download = await downloadPromise;
  const exportedPath = await download.path();
  if (!exportedPath) {
    throw new Error('Machine Axis export did not produce a local download');
  }
  const exportedContract = JSON.parse(await readFile(exportedPath, 'utf8'));
  expect(exportedContract.actions).toHaveLength(14);
  const { stdout: exportedRunJson } = await execFileAsync(
    process.execPath,
    ['scripts/run-machine-axis-cli.mjs', 'simulate', exportedPath],
    {
      cwd: process.cwd(),
      maxBuffer: 64 * 1024 * 1024,
      timeout: 120_000,
    }
  );
  const exportedRun = JSON.parse(exportedRunJson);
  expect(exportedRun.hashes).toEqual({
    algorithm: 'fnv1a64-utf8-v1',
    input: '1670cb62718bc08b',
    data: 'c49a239709b43a16',
    trace: '017c87abc8087efc',
    evaluation: '8b144d1df218405e',
  });

  const invalidContract = JSON.parse(
    await readFile('fixtures/machine-axis/m11-b-three-actor-120s.json', 'utf8')
  );
  invalidContract.actions[1].intent.publicActionId = 99999999;
  await page.getByTestId('workbench-import-project-file').setInputFiles({
    name: 'invalid-machine-axis.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(invalidContract)),
  });
  await expect(dialog.getByTestId('machine-axis-status')).toContainText(
    '当前项目保持不变'
  );
  await expect(
    dialog
      .getByTestId('machine-axis-import-diagnostics')
      .locator('[data-diagnostic-code="machine-axis-public-action-unknown"]')
  ).toHaveCount(1);
  await expect(workbench).toHaveAttribute(
    'data-canonical-trace-hash',
    '017c87abc8087efc'
  );
  await expect(workbench).toHaveAttribute(
    'data-canonical-trace-action-count',
    '16'
  );
  await dialog.getByTestId('workbench-close-machine-axis').click();
  await expect(dialog).toHaveCount(0);

  const openTraceAction = async actionId => {
    const action = timeline.locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
    );
    await action.scrollIntoViewIfNeeded();
    await action.click();
    const inspector = await openActionInspectorPanel(
      page,
      'canonical-trace',
      actionId
    );
    return {
      action,
      inspector: inspector.getByTestId('workbench-canonical-trace-inspector'),
    };
  };

  const xunlang = await openTraceAction('xunlang-signature');
  await expect(
    xunlang.inspector.getByTestId('canonical-trace-hit-row')
  ).toHaveCount(9);
  await expect(
    xunlang.inspector.locator(
      '[data-testid="canonical-trace-resource-event"][data-resource-identity*="kibo"]'
    )
  ).toContainText('100 → 0');

  const ruby = await openTraceAction('ruby-enhanced-e1-intent');
  await expect(ruby.inspector).toContainText('control 10300201 / sub 1');
  await expect(
    ruby.inspector.locator(
      '[data-testid="canonical-trace-resource-event"][data-resource-identity="actor:103002:element:103002047"]'
    )
  ).toContainText('6 → 5');

  const criticalCases = [
    ['a3-inherit', 'hit', 'inherit'],
    ['a3-sampled', 'hit', 'sampled'],
    ['a3-expected', 'hit', 'expected'],
    ['a3-critical', 'hit', 'critical'],
    ['a3-non-critical', 'hit', 'non-critical'],
    ['a3-miss', 'miss', 'inherit'],
  ];
  for (const [actionId, landed, criticalMode] of criticalCases) {
    const { inspector } = await openTraceAction(actionId);
    const hit = inspector.getByTestId('canonical-trace-hit-row');
    await expect(hit).toHaveCount(1);
    await expect(hit.getByTestId('canonical-trace-hit-landed')).toHaveValue(
      landed
    );
    await expect(
      hit.getByTestId('canonical-trace-hit-critical-mode')
    ).toHaveValue(criticalMode);
  }

  const sampled = await openTraceAction('a3-sampled');
  const sampledHit = sampled.inspector.getByTestId('canonical-trace-hit-row');
  await expect(sampledHit).toContainText('采样 Roll');
  await expect(
    sampledHit.getByTestId('canonical-trace-critical-source-rate')
  ).toHaveText('5%');
  await expect(
    sampledHit.getByTestId('canonical-trace-critical-target-defense')
  ).toHaveText('0%');
  await expect(
    sampledHit.getByTestId('canonical-trace-critical-effective-rate')
  ).toHaveText('5%');
  await expect(
    sampledHit.getByTestId('canonical-trace-critical-damage')
  ).toHaveText('150%');
  await expect(
    sampledHit.getByTestId('canonical-trace-critical-roll')
  ).toContainText('2345');
  await expect(
    sampledHit.getByTestId('canonical-trace-sampled-result')
  ).toHaveText('未暴击');

  const expected = await openTraceAction('a3-expected');
  const expectedHit = expected.inspector.getByTestId('canonical-trace-hit-row');
  await expect(
    expectedHit.getByTestId('canonical-trace-critical-damage')
  ).toHaveText('150%');
  await expect(
    expectedHit.getByTestId('canonical-trace-expected-weighted-damage')
  ).toHaveText('6.2');
  await expect(
    expectedHit.getByTestId('canonical-trace-expected-probability')
  ).toHaveText('5%');
  await expect(
    expectedHit.getByTestId('canonical-trace-expected-non-critical')
  ).toHaveText('6');
  await expect(
    expectedHit.getByTestId('canonical-trace-expected-critical')
  ).toHaveText('10');
  await expect(
    expectedHit.getByTestId('canonical-trace-critical-event-materialized')
  ).toHaveText('不生成暴击事件');

  await openTraceAction('a3-sampled');
  const originalTraceHash = await workbench.getAttribute(
    'data-canonical-trace-hash'
  );
  await sampledHit
    .getByTestId('canonical-trace-hit-landed')
    .selectOption('miss');
  await expect(workbench).not.toHaveAttribute(
    'data-canonical-trace-hash',
    originalTraceHash
  );
  await expect(
    sampled.inspector.getByTestId('canonical-trace-hit-landed')
  ).toHaveValue('miss');
  await page.getByTestId('workbench-undo-edit').click();
  await expect(workbench).toHaveAttribute(
    'data-canonical-trace-hash',
    originalTraceHash
  );
  await expect(
    sampled.inspector.getByTestId('canonical-trace-hit-landed')
  ).toHaveValue('hit');
  await expect(page.locator('body')).not.toContainText('�');

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'reports/m11-c-canonical-trace-workbench-desktop.png',
  });
  await page.getByTestId('workbench-close-side-inspector').click();
  await expect(page.getByTestId('workbench-side-inspector')).toHaveCount(0);
  await expect(timeline).toBeVisible();
});
test('[m11-d-character-acceptance-visual-import] imports each owner acceptance fixture through the public Workbench file entry', async ({
  page,
}) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/workbench');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByTestId('workbench-scenario-bar')).toBeVisible();

  const cases = [
    {
      ownerId: 101010,
      fixturePath: 'fixtures/character-acceptance/101010-visual.json',
      traceHash: '04a2619176b027ca',
      actionId: 'xiaoyu-burst-a1',
      expectedTraceText: 'control 10101001 / sub 1',
    },
    {
      ownerId: 103002,
      fixturePath: 'fixtures/character-acceptance/103002-visual.json',
      traceHash: '6cc9d01e738ecf23',
      actionId: 'ruby-chain-e1',
      expectedTraceText: 'control 10300201 / sub 1',
      resourceIdentity: 'actor:103002:element:103002047',
      resourceText: '6 → 5',
    },
    {
      ownerId: 101003,
      fixturePath: 'fixtures/character-acceptance/101003-visual.json',
      traceHash: 'ab94789246358651',
      actionId: 'han-firework-charged',
      expectedTraceText: 'control 10100310 / sub 0',
    },
  ];

  for (const entry of cases) {
    const fixtureText = await readFile(entry.fixturePath, 'utf8');
    await page.getByTestId('workbench-import-project-file').setInputFiles({
      name: entry.ownerId + '-m11-d-acceptance.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fixtureText),
    });
    const dialog = page.getByTestId('workbench-machine-axis-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('machine-axis-status')).toContainText(
      '已导入 Machine Axis',
      { timeout: 30_000 }
    );

    const workbench = page.locator('main.workbench');
    const timeline = page.getByTestId('workbench-timeline-grid-preview');
    await expect(workbench).toHaveAttribute(
      'data-canonical-trace-hash',
      entry.traceHash
    );
    await expect(workbench).toHaveAttribute(
      'data-machine-axis-import-active',
      'true'
    );
    await dialog.getByTestId('workbench-close-machine-axis').click();
    await expect(dialog).toHaveCount(0);

    const action = timeline.locator(
      '[data-testid="workbench-timeline-action"][data-action-id="' +
        entry.actionId +
        '"]'
    );
    await expect(action).toHaveCount(1);
    await action.scrollIntoViewIfNeeded();
    await action.click();
    const panel = await openActionInspectorPanel(
      page,
      'canonical-trace',
      entry.actionId
    );
    const inspector = panel.getByTestId('workbench-canonical-trace-inspector');
    await expect(inspector).toContainText(entry.expectedTraceText);
    await expect(
      inspector.getByTestId('canonical-trace-hit-row').first()
    ).toBeVisible();
    if (entry.resourceIdentity) {
      await expect(
        inspector.locator(
          '[data-testid="canonical-trace-resource-event"][data-resource-identity="' +
            entry.resourceIdentity +
            '"]'
        )
      ).toContainText(entry.resourceText);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path:
        'reports/m11-d-character-acceptance-' +
        entry.ownerId +
        '-desktop.png',
    });
    await page.getByTestId('workbench-close-side-inspector').click();
    await expect(page.getByTestId('workbench-side-inspector')).toHaveCount(0);
  }
});

function formatRuntimeFrameLabel(frameIndex) {
  return `${Math.floor(frameIndex / 60)}s${frameIndex % 60}f`;
}

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
    const tuningRowCount = rows.filter(row =>
      String(row.dataset.laneKind ?? '').startsWith('tuning-mark-')
    ).length;
    return {
      rowCount: rows.length,
      labelCount: labels.length,
      baseRowCount: rows.length - tuningRowCount,
      tuningRowCount,
      rowsSeparated: rowRects.every(
        (rect, index) =>
          index === 0 || rect.top >= rowRects[index - 1].bottom - 0.5
      ),
      labelsAligned: rowRects.every(
        (rect, index) => Math.abs(rect.top - labelRects[index]?.top) <= 0.5
      ),
    };
  });
  expect(alignment.baseRowCount).toBeGreaterThanOrEqual(15);
  expect(alignment.labelCount).toBe(alignment.rowCount);
  expect(alignment.rowsSeparated).toBe(true);
  expect(alignment.labelsAligned).toBe(true);
}

async function expectTimelineScrollbarClearance(timeline) {
  const metrics = await timeline.evaluate(element => {
    const labels = [
      ...element.querySelectorAll(
        '[data-testid="workbench-timeline-lane-label"]'
      ),
    ];
    const rows = [
      ...element.querySelectorAll('[data-testid="workbench-timeline-row"]'),
    ];
    const labelIds = labels.map(label => label.dataset.laneId);
    const rowIds = rows.map(row => row.dataset.laneId);
    const tuningRows = rows.filter(
      row => row.dataset.laneKind === 'tuning-mark-curve'
    );
    const firstActorRow = rows.find(
      row => row.dataset.laneKind === 'actor-action'
    );
    const lastRow = rows.at(-1);
    const viewport = element.querySelector(
      '[data-testid="workbench-timeline-viewport"]'
    );
    const labelClearance = element.querySelector(
      '[data-testid="workbench-timeline-label-scrollbar-clearance"]'
    );
    const trackClearance = element.querySelector(
      '[data-testid="workbench-timeline-track-scrollbar-clearance"]'
    );
    const firstTuningRect = tuningRows[0].getBoundingClientRect();
    const lastTuningRect = tuningRows.at(-1).getBoundingClientRect();
    const firstActorRect = firstActorRow.getBoundingClientRect();
    const lastRowRect = lastRow.getBoundingClientRect();
    const viewportRect = viewport.getBoundingClientRect();
    const labelClearanceRect = labelClearance.getBoundingClientRect();
    const trackClearanceRect = trackClearance.getBoundingClientRect();
    const scrollbarHeight = Math.max(
      0,
      viewport.offsetHeight - viewport.clientHeight
    );
    const scrollbarTop = viewportRect.bottom - scrollbarHeight;
    return {
      labelIds,
      rowIds,
      tuningRowCount: tuningRows.length,
      tuningBeforeActor: lastTuningRect.bottom <= firstActorRect.top + 0.5,
      firstTuningVisible:
        firstTuningRect.top >= viewportRect.top - 0.5 &&
        firstTuningRect.bottom <= viewportRect.bottom + 0.5,
      firstActorVisible:
        firstActorRect.top >= viewportRect.top - 0.5 &&
        firstActorRect.top < viewportRect.bottom,
      clearanceHeight: trackClearanceRect.height,
      clearanceTopAlignment: Math.abs(
        trackClearanceRect.top - labelClearanceRect.top
      ),
      clearanceAfterLastLane:
        trackClearanceRect.top >= lastRowRect.bottom + 2.5,
      lastLaneScrollbarSeparation: scrollbarTop - lastRowRect.bottom,
      scrollbarHeight,
      hasHorizontalOverflow: viewport.scrollWidth > viewport.clientWidth,
    };
  });
  expect(metrics.labelIds).toEqual(metrics.rowIds);
  expect(metrics.tuningRowCount).toBeGreaterThan(0);
  expect(metrics.tuningBeforeActor).toBe(true);
  expect(metrics.firstTuningVisible).toBe(true);
  expect(metrics.firstActorVisible).toBe(true);
  expect(metrics.clearanceHeight).toBeGreaterThanOrEqual(18);
  expect(metrics.clearanceHeight).toBeLessThanOrEqual(22);
  expect(metrics.clearanceTopAlignment).toBeLessThanOrEqual(0.5);
  expect(metrics.clearanceAfterLastLane).toBe(true);
  expect(metrics.lastLaneScrollbarSeparation).toBeGreaterThanOrEqual(18);
  expect(metrics.hasHorizontalOverflow).toBe(true);
  expect(metrics.scrollbarHeight).toBeGreaterThanOrEqual(0);
}

async function expectTimelineTrackReadability(timeline) {
  const metrics = await timeline.evaluate(element => {
    const actorRow = element.querySelector(
      '[data-testid="workbench-timeline-row"][data-lane-kind="actor-action"]'
    );
    const actorAction = actorRow?.querySelector(
      '[data-testid="workbench-timeline-action"]'
    );
    const loadoutSlot = element.querySelector(
      '[data-testid="workbench-direct-loadout-slot"]'
    );
    const curveRows = [
      ...element.querySelectorAll(
        '[data-testid="workbench-timeline-row"][data-lane-kind$="curve"]'
      ),
    ];
    const actorRect = actorRow?.getBoundingClientRect();
    const actionRect = actorAction?.getBoundingClientRect();
    const slotRect = loadoutSlot?.getBoundingClientRect();
    return {
      actorHeight: actorRect?.height ?? 0,
      actionTopGap:
        actorRect && actionRect ? actionRect.top - actorRect.top : 0,
      actionBottomGap:
        actorRect && actionRect ? actorRect.bottom - actionRect.bottom : 0,
      slotAspect:
        slotRect?.width && slotRect?.height
          ? slotRect.height / slotRect.width
          : 0,
      curveHeights: curveRows.map(row => row.getBoundingClientRect().height),
    };
  });
  expect(metrics.actorHeight).toBeGreaterThanOrEqual(164);
  expect(metrics.actionTopGap).toBeGreaterThanOrEqual(28);
  expect(metrics.actionBottomGap).toBeGreaterThanOrEqual(28);
  expect(metrics.slotAspect).toBeGreaterThanOrEqual(0.82);
  expect(metrics.slotAspect).toBeLessThanOrEqual(1.15);
  expect(metrics.curveHeights).toHaveLength(8);
  expect(metrics.curveHeights.every(height => height >= 44)).toBe(true);
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
      `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"] .lane-identity-command`
    )
    .click();
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
}

async function openEnemyInspector(page) {
  await page
    .locator(
      '[data-testid="workbench-timeline-lane-label"][data-lane-kind="enemy-hp-curve"]'
    )
    .click();
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(inspector).toBeVisible();
  await openSideInspectorPanel(page, 'enemy');
  return inspector;
}

async function openSideInspectorPanel(page, panelKey) {
  const inspector = page.getByTestId('workbench-side-inspector');
  await expect(inspector).toBeVisible();
  const tab = inspector.locator(
    `[data-testid="workbench-side-inspector-tab"][data-inspector-panel="${panelKey}"]`
  );
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(inspector).toHaveAttribute(
    'data-active-inspector-panel',
    panelKey
  );
  await expect(
    inspector.locator(
      `[data-testid="workbench-side-inspector-panel"][data-inspector-panel-key="${panelKey}"]`
    )
  ).toBeVisible();
  return inspector;
}

async function openActionInspectorPanel(
  page,
  panelKey,
  actionId = 'action-0001'
) {
  const inspector = page.getByTestId('workbench-side-inspector');
  const panelTab = inspector.locator(
    `[data-testid="workbench-side-inspector-tab"][data-inspector-panel="${panelKey}"]`
  );
  if (!(await inspector.isVisible()) || (await panelTab.count()) === 0) {
    await openActionInspector(page, actionId);
  }
  return openSideInspectorPanel(page, panelKey);
}

async function openRuntimeReviewTab(page, tabKey) {
  const tab = page.locator(
    `[data-testid="workbench-runtime-review-tab"][data-review-tab="${tabKey}"]`
  );
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}

async function setTimelineActionStartFrame(page, action, frameIndex) {
  await action.click();
  const actionId = await action.getAttribute('data-action-id');
  await openActionInspectorPanel(page, 'properties', actionId);
  const input = page.getByTestId('workbench-start-frame-input');
  await input.fill(String(frameIndex));
  await input.press('Tab');
  await expect
    .poll(async () => Number(await action.getAttribute('data-start-ms')))
    .toBe(frameToMs(frameIndex));
}

async function sumTimelineNodeEventCount(locator) {
  return locator.evaluateAll(nodes =>
    nodes.reduce(
      (total, node) => total + Number(node.dataset.eventCount || 0),
      0
    )
  );
}

async function setEnemyLevel(page, value) {
  const inspector = await openEnemyInspector(page);
  const input = inspector.getByTestId('workbench-enemy-level-input');
  await input.fill(String(value));
  await input.press('Tab');
}

async function expectEnemyLevel(page, value) {
  const inspector = await openEnemyInspector(page);
  await expect(
    inspector.getByTestId('workbench-enemy-level-input')
  ).toHaveValue(String(value));
}

async function readVerifiedPanelValue(panel, label) {
  const text = await panel
    .locator('.property-value-grid')
    .first()
    .locator('div')
    .filter({ hasText: label })
    .first()
    .locator('strong')
    .textContent();
  return Number(
    String(text ?? '')
      .replaceAll(',', '')
      .trim()
  );
}

async function changeM2TeamSlot(page, slotIndex, characterId) {
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

async function configureM2TeamDirectly(page, actorIds) {
  for (const [index, characterId] of actorIds.entries()) {
    const config = M2_LOADOUT_CONFIGS[index];
    await selectM2LoadoutOption(page, characterId, 'kiboId', config.kiboId);
    for (const [slotKey, equipmentId] of Object.entries(config.equipment)) {
      await selectM2LoadoutOption(page, characterId, slotKey, equipmentId);
    }
    await selectM2LoadoutOption(
      page,
      characterId,
      'soulessenceId',
      config.soulessenceId
    );
    await expectM2ActorLoadoutDirect(page, characterId, config);
  }
}

async function expectM2PickerScrollContainment(page, minimumOptionCount) {
  const picker = page.getByTestId('workbench-loadout-picker');
  const optionGrid = picker.locator('.loadout-option-grid');
  const scrollBar = picker.getByTestId('workbench-loadout-scrollbar');
  const scrollThumb = picker.getByTestId('workbench-loadout-scrollbar-thumb');
  await expect(picker).toBeVisible();
  await expect(optionGrid).toBeVisible();
  await expect(scrollBar).toHaveCount(1);
  await expect
    .poll(() =>
      optionGrid.evaluate(element => getComputedStyle(element).scrollbarWidth)
    )
    .toBe('none');
  expect(
    await picker.getByTestId('workbench-loadout-option').count()
  ).toBeGreaterThan(minimumOptionCount);

  const metrics = await optionGrid.evaluate(element => ({
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
    scrollHeight: element.scrollHeight,
  }));
  expect(metrics.overflowY).toBe('auto');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
  await expect(scrollBar).toBeVisible();
  await expect(scrollThumb).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe('hidden');

  const pageScrollBefore = await page.evaluate(() => ({
    document: document.scrollingElement?.scrollTop ?? 0,
    window: window.scrollY,
  }));
  const thumbTopBefore = await scrollThumb.evaluate(element =>
    Number.parseFloat(element.style.top)
  );
  await optionGrid.hover();
  await page.mouse.wheel(0, 1200);
  await expect
    .poll(() => optionGrid.evaluate(element => element.scrollTop))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      scrollThumb.evaluate(element => Number.parseFloat(element.style.top))
    )
    .toBeGreaterThan(thumbTopBefore);
  await page.mouse.wheel(0, 100_000);
  expect(
    await page.evaluate(() => ({
      document: document.scrollingElement?.scrollTop ?? 0,
      window: window.scrollY,
    }))
  ).toEqual(pageScrollBefore);
}

async function selectM2LoadoutOption(page, characterId, slotKey, selectedId) {
  if (slotKey === 'kiboId') {
    await page
      .locator(
        `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="${characterId}"] [data-testid="workbench-direct-kibo-picker"]`
      )
      .click();
  } else {
    await page
      .locator(
        `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"] [data-testid="workbench-direct-loadout-slot"][data-loadout-slot="${slotKey}"]`
      )
      .click();
  }
  const picker = page.getByTestId('workbench-loadout-picker');
  await expect(picker).toBeVisible();
  await picker
    .locator(
      `[data-testid="workbench-loadout-option"][data-option-id="${selectedId}"]`
    )
    .click();
  await expect(picker).toBeHidden();
}

async function selectM2Enemy(page, enemyId) {
  await page.getByTestId('workbench-direct-enemy-picker').click();
  const picker = page.getByTestId('workbench-loadout-picker');
  await expect(picker).toBeVisible();
  await picker
    .locator(
      `[data-testid="workbench-loadout-option"][data-option-id="${enemyId}"]`
    )
    .click();
  await expect(picker).toBeHidden();
}

async function expectM2TeamDirect(page, actorIds) {
  for (const [index, characterId] of actorIds.entries()) {
    await expectM2ActorLoadoutDirect(
      page,
      characterId,
      M2_LOADOUT_CONFIGS[index]
    );
  }
}

async function hydrateM2LoadoutCatalog(page, characterId) {
  await page
    .locator(
      `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="${characterId}"] [data-testid="workbench-direct-kibo-picker"]`
    )
    .click();
  const picker = page.getByTestId('workbench-loadout-picker');
  await expect(
    picker.getByTestId('workbench-loadout-option').first()
  ).toBeVisible();
  await picker.getByTestId('workbench-loadout-close').click();
  await expect(picker).toBeHidden();
}

async function expectM2ActorLoadoutDirect(page, characterId, config) {
  const actorLane = page.locator(
    `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-action"][data-character-id="${characterId}"]`
  );
  await expect(
    page.locator(
      `[data-testid="workbench-timeline-lane-label"][data-lane-kind="actor-kibo"][data-character-id="${characterId}"] [data-testid="workbench-direct-kibo-picker"]`
    )
  ).toHaveAttribute('data-selected-id', config.kiboId);
  for (const [slotKey, equipmentId] of Object.entries(config.equipment)) {
    await expect(
      actorLane.locator(
        `[data-testid="workbench-direct-loadout-slot"][data-loadout-slot="${slotKey}"]`
      )
    ).toHaveAttribute('data-selected-id', equipmentId);
  }
  await expect(
    actorLane.locator(
      '[data-testid="workbench-direct-loadout-slot"][data-loadout-slot="soulessenceId"]'
    )
  ).toHaveAttribute('data-selected-id', config.soulessenceId);
  await expect(
    actorLane.locator('[data-testid="workbench-direct-loadout-slot"] img')
  ).toHaveCount(6);
  await expect
    .poll(
      () =>
        actorLane
          .locator('[data-testid="workbench-direct-loadout-slot"] img')
          .evaluateAll(images =>
            images.map(image => image.complete && image.naturalWidth > 0)
          ),
      { timeout: 30_000 }
    )
    .toEqual([true, true, true, true, true, true]);
}

function getSingleSkillActionEntry(page) {
  return page
    .locator(
      '[data-testid="workbench-skill-entry"][data-timing-status="applied"]:not([data-action-kind="normal-attack"])'
    )
    .first();
}

async function addSingleSkillAction(page) {
  await getSingleSkillActionEntry(page).click();
}

async function expectTimelineActionWidthsMatchDuration(timeline) {
  const measurements = await timeline.evaluate(root => {
    return [
      ...root.querySelectorAll('[data-testid="workbench-timeline-action"]'),
    ]
      .slice(0, 8)
      .map(action => {
        const containingBlock = action.offsetParent;
        const containingBlockWidth =
          containingBlock?.getBoundingClientRect().width ?? 0;
        return {
          actionId: action.dataset.actionId,
          durationMs: Number(action.dataset.durationMs),
          renderedPercent:
            containingBlockWidth > 0
              ? (action.getBoundingClientRect().width / containingBlockWidth) *
                100
              : 0,
          stylePercent: Number.parseFloat(action.style.width),
        };
      })
      .filter(item => item.durationMs > 0);
  });
  expect(measurements.length).toBeGreaterThan(0);
  const durationMs = Number(await timeline.getAttribute('data-duration-ms'));
  for (const measurement of measurements) {
    const expectedPercent = (measurement.durationMs / durationMs) * 100;
    expect(measurement.stylePercent).toBeCloseTo(expectedPercent, 4);
    expect(measurement.renderedPercent).toBeCloseTo(expectedPercent, 1);
  }
}

async function expectLoadedImage(image) {
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(element => element.complete && element.naturalWidth > 0)
    )
    .toBe(true);
}

async function openActionInspector(page, actionId = 'action-0001') {
  await page
    .locator(
      `[data-testid="workbench-timeline-action"][data-action-id="${actionId}"]`
    )
    .click();
  await expect(page.getByTestId('workbench-side-inspector')).toBeVisible();
}

async function expectInspectorCloseButtonReachable(page) {
  const inspector = page.getByTestId('workbench-side-inspector');
  const closeButton = page.getByTestId('workbench-close-side-inspector');
  await expect(inspector).toBeVisible();
  await expect(closeButton).toBeVisible();
  const bounds = await page.evaluate(() => {
    const inspectorElement = document.querySelector(
      '[data-testid="workbench-side-inspector"]'
    );
    const closeElement = document.querySelector(
      '[data-testid="workbench-close-side-inspector"]'
    );
    const inspectorRect = inspectorElement?.getBoundingClientRect();
    const closeRect = closeElement?.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      inspector: inspectorRect
        ? {
            left: inspectorRect.left,
            top: inspectorRect.top,
            right: inspectorRect.right,
            bottom: inspectorRect.bottom,
          }
        : null,
      close: closeRect
        ? {
            left: closeRect.left,
            top: closeRect.top,
            right: closeRect.right,
            bottom: closeRect.bottom,
          }
        : null,
    };
  });
  expect(bounds.inspector).toBeTruthy();
  expect(bounds.close).toBeTruthy();
  expect(bounds.close.left).toBeGreaterThanOrEqual(bounds.inspector.left);
  expect(bounds.close.top).toBeGreaterThanOrEqual(bounds.inspector.top);
  expect(bounds.close.right).toBeLessThanOrEqual(bounds.inspector.right);
  expect(bounds.close.bottom).toBeLessThanOrEqual(bounds.inspector.bottom);
  expect(bounds.close.left).toBeGreaterThanOrEqual(0);
  expect(bounds.close.top).toBeGreaterThanOrEqual(0);
  expect(bounds.close.right).toBeLessThanOrEqual(bounds.viewportWidth);
  expect(bounds.close.bottom).toBeLessThanOrEqual(bounds.viewportHeight);
}

async function closeInspectorIfVisible(page) {
  const inspector = page.getByTestId('workbench-side-inspector');
  if (await inspector.isVisible()) {
    await page.getByTestId('workbench-close-side-inspector').click();
  }
}

async function openTimelineFragmentLibrary(page) {
  const panel = page.getByTestId('workbench-timeline-fragment-library');
  if (!(await panel.isVisible())) {
    await page.getByTestId('workbench-fragment-library-tab').click();
  }
  await expect(panel).toBeVisible();
  return panel;
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

async function setWorkbenchTimelineDuration(page, durationMs) {
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  await timeline
    .getByTestId('workbench-timeline-duration-select')
    .selectOption(String(durationMs));
  await expect(timeline).toHaveAttribute(
    'data-duration-ms',
    String(durationMs)
  );
}

function createM10B1R2SwitchCooldownDraft() {
  const draft = createBasicWorkbenchDraftFixture();
  const actionDrafts = [
    {
      id: 'm10-b1-r2-switch-first',
      type: 'switch',
      actorCharacterId: 101003,
      targetCharacterId: 109001,
      startMs: frameToMs(600),
      durationMs: 0,
      note: '首次退场触发星携技',
    },
    {
      id: 'm10-b1-r2-switch-reset',
      type: 'switch',
      actorCharacterId: 109001,
      targetCharacterId: 101003,
      startMs: frameToMs(1080),
      durationMs: 0,
      note: '切回寒悠悠',
    },
    {
      id: 'm10-b1-r2-switch-during-cooldown',
      type: 'switch',
      actorCharacterId: 101003,
      targetCharacterId: 109001,
      startMs: frameToMs(1100),
      durationMs: 0,
      note: 'CD 内再次退场',
    },
  ];
  const initialRuntimeState = {
    controlledActor: {
      actorId: 'actor-101003',
      characterId: 101003,
    },
  };
  const applyFixture = value => {
    value.durationMs = 120_000;
    value.actionDrafts = actionDrafts.map(action => ({ ...action }));
    value.actionRelations = [];
    value.cycleBoundaries = [];
    value.initialRuntimeState = structuredClone(initialRuntimeState);
    value.selectedActionId = 'm10-b1-r2-switch-during-cooldown';
  };
  applyFixture(draft);
  for (const scenario of draft.scenarioWorkspace.scenarios) {
    applyFixture(scenario.draft);
  }
  return draft;
}

function createM9R2R1WorkbenchDraft() {
  const draft = createBasicWorkbenchDraftFixture();
  const actionDrafts = [
    {
      ...draft.actionDrafts[0],
      id: 'action-at-5s',
      startMs: 5_000,
    },
    {
      id: 'switch-at-60s',
      type: 'switch',
      actorCharacterId: 109001,
      targetCharacterId: 101003,
      startMs: 60_000,
      durationMs: 0,
      note: '60 秒切换',
    },
    {
      ...draft.actionDrafts[0],
      id: 'action-at-119s',
      startMs: 119_000,
    },
  ];
  draft.actionDrafts = actionDrafts;
  draft.selectedActionId = 'action-at-5s';
  delete draft.durationMs;
  const scenarioDraft = draft.scenarioWorkspace.scenarios[0].draft;
  scenarioDraft.actionDrafts = actionDrafts.map(action => ({ ...action }));
  scenarioDraft.selectedActionId = 'action-at-5s';
  delete scenarioDraft.durationMs;
  return draft;
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
    '[data-testid="workbench-timeline-state-curve-node"][data-action-id="demo-actor-2-energy"]'
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
    timeline.locator(
      '[data-testid="workbench-timeline-state-curve"]:not([data-track-key^="tuningMark:"])'
    )
  ).toHaveCount(8);
  await expect(resourceBreakpoint).toHaveAttribute(
    'data-frame-index',
    String(resourceFrameIndex)
  );
  for (const laneId of ['enemy-hp-curve', 'enemy-toughness-curve']) {
    await expect
      .poll(async () =>
        Number(
          await timeline
            .locator(
              `[data-testid="workbench-timeline-row"][data-lane-id="${laneId}"] [data-testid="workbench-timeline-state-curve"]`
            )
            .getAttribute('data-point-count')
        )
      )
      .toBeGreaterThan(0);
  }
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
        height: Math.round(rect.height),
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
      shell: (() => {
        const element = document.querySelector('.timeline-shell');
        return {
          ...readRect('.timeline-shell'),
          clientHeight: element?.clientHeight ?? 0,
          scrollHeight: element?.scrollHeight ?? 0,
        };
      })(),
      viewport: (() => {
        const element = document.querySelector(
          '[data-testid="workbench-timeline-viewport"]'
        );
        return {
          clientWidth: element?.clientWidth ?? 0,
          scrollWidth: element?.scrollWidth ?? 0,
        };
      })(),
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

async function expectGeneratedStatusTiming(action, cooldown, interval) {
  const actionStartMs = Number(await action.getAttribute('data-start-ms'));
  await expect(cooldown).toHaveAttribute(
    'data-start-ms',
    String(actionStartMs)
  );
  await expect
    .poll(async () => Number(await cooldown.getAttribute('data-end-ms')))
    .toBeCloseTo(actionStartMs + 24000, 3);
  await expect
    .poll(async () => Number(await interval.getAttribute('data-start-ms')))
    .toBeCloseTo(actionStartMs + 950, 3);
  await expect
    .poll(async () => Number(await interval.getAttribute('data-end-ms')))
    .toBeCloseTo(actionStartMs + 8950, 3);
}

async function expectGeneratedStatusPixelAlignment(
  timeline,
  action,
  cooldown,
  interval
) {
  await expect
    .poll(async () => {
      const [actionBox, cooldownBox, intervalBox, laneBox] = await Promise.all([
        action.boundingBox(),
        cooldown.boundingBox(),
        interval.boundingBox(),
        timeline.getByTestId('workbench-timeline-lane').boundingBox(),
      ]);
      const durationMs = Number(
        await timeline.getAttribute('data-duration-ms')
      );
      if (
        !actionBox ||
        !cooldownBox ||
        !intervalBox ||
        !laneBox ||
        !durationMs
      ) {
        return Number.POSITIVE_INFINITY;
      }
      const cooldownOffsetError = Math.abs(cooldownBox.x - actionBox.x);
      const expectedEffectOffset = (laneBox.width * 950) / durationMs;
      const effectOffsetError = Math.abs(
        intervalBox.x - actionBox.x - expectedEffectOffset
      );
      return Math.max(cooldownOffsetError, effectOffsetError);
    })
    .toBeLessThanOrEqual(1.5);
}

async function expectVerifiedCombatPointAlignment(
  timeline,
  action,
  breakpoint,
  hitOffsetFrames
) {
  await expect
    .poll(async () => {
      const [actionBox, pointBox, laneBox] = await Promise.all([
        action.boundingBox(),
        breakpoint.boundingBox(),
        timeline.getByTestId('workbench-timeline-lane').boundingBox(),
      ]);
      const durationMs = Number(
        await timeline.getAttribute('data-duration-ms')
      );
      if (!actionBox || !pointBox || !laneBox || !durationMs) {
        return Number.POSITIVE_INFINITY;
      }
      const expectedOffset =
        (laneBox.width * ((Number(hitOffsetFrames) * 1000) / 60)) / durationMs;
      const pointCenter = pointBox.x + pointBox.width / 2;
      return Math.abs(pointCenter - actionBox.x - expectedOffset);
    })
    .toBeLessThanOrEqual(1.5);
}

async function expectTimelineCurveNodeFrameAlignment(timeline, node) {
  await expect
    .poll(async () => {
      const [nodeBox, laneBox] = await Promise.all([
        node.boundingBox(),
        timeline.getByTestId('workbench-timeline-lane').boundingBox(),
      ]);
      const durationMs = Number(
        await timeline.getAttribute('data-duration-ms')
      );
      const timeMs = Number(await node.getAttribute('data-time-ms'));
      if (!nodeBox || !laneBox || !durationMs || !Number.isFinite(timeMs)) {
        return Number.POSITIVE_INFINITY;
      }
      const expectedCenter = laneBox.x + (laneBox.width * timeMs) / durationMs;
      return Math.abs(nodeBox.x + nodeBox.width / 2 - expectedCenter);
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
  await beginPointerDragTo(page, source, target, {
    sourcePosition,
    targetPosition,
  });
  await page.mouse.up();
}

async function dragTimelineActionByFrames(page, action, frameDelta) {
  await action.scrollIntoViewIfNeeded();
  const timeline = page.getByTestId('workbench-timeline-grid-preview');
  const lane = timeline.getByTestId('workbench-timeline-lane');
  const actionBox = await action.boundingBox();
  const laneBox = await lane.boundingBox();
  const durationMs = Number(await timeline.getAttribute('data-duration-ms'));
  if (!actionBox || !laneBox || !durationMs) {
    throw new Error('Timeline action drag geometry is unavailable');
  }
  const deltaX = (frameToMs(frameDelta) / durationMs) * laneBox.width;
  const start = {
    x: actionBox.x + Math.min(8, actionBox.width / 2),
    y: actionBox.y + actionBox.height / 2,
  };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + deltaX, start.y, { steps: 8 });
  await page.mouse.up();
}

async function beginPointerDragTo(
  page,
  source,
  target,
  {
    sourcePosition = null,
    targetPosition = null,
    scrollTargetIntoView = true,
  } = {}
) {
  if (scrollTargetIntoView) {
    await target.scrollIntoViewIfNeeded();
  }
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
