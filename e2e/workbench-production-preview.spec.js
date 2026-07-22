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
    testInfo.title.includes('[m9-r2-r1-inspector-duration]')
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
  await expect(page.getByTestId('workbench-enemy-name')).toHaveText('菜鸡');
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
  await expect(page.getByTestId('workbench-enemy-name')).toHaveText('菜鸡');

  await page.getByTestId('workbench-scenario-add').click();
  await setWorkbenchTimelineDuration(page, 30_000);
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
  await expect(page.getByTestId('workbench-enemy-name')).toHaveText('菜鸡');
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
  await dragLocatorTo(
    page,
    page.getByTestId('workbench-kibo-action-entry').first(),
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="kibo-team-slot-2"]'
    ),
    { targetPosition: { x: 680, y: 18 } }
  );
  await closeInspectorIfVisible(page);
  await dragLocatorTo(
    page,
    page.getByTestId('workbench-add-enemy-event-action'),
    timeline.locator(
      '[data-testid="workbench-timeline-row"][data-lane-id="enemy-events"]'
    ),
    { targetPosition: { x: 780, y: 24 } }
  );
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
  await expect(page.getByTestId('workbench-enemy-level-input')).toHaveValue(
    '91'
  );
});

test('[profile-compatibility-gate] rejects an unavailable profile without replacing the current project', async ({
  page,
}, testInfo) => {
  await page.goto('/#/workbench');
  await addSingleSkillAction(page);
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
  await addSingleSkillAction(page);
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
  await addSingleSkillAction(page);
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
  await addSingleSkillAction(page);
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

test('[action-effect-relations] keeps action, effect, log, and six energy tracks in one relation flow', async ({
  page,
}) => {
  await page.goto('/#/workbench');
  await openActionInspector(page);
  await page.getByTestId('workbench-effect-add').click();
  await page.getByTestId('workbench-effect-name-input').fill('关系测试增益');
  await page.getByTestId('workbench-effect-name-input').press('Tab');

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
  await expect(
    page.locator('.event-list > li[data-effect-relation-kind="effect-trigger"]')
  ).toContainText('触发 关系测试增益');

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
