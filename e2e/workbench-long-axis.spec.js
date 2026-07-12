import { expect, test } from '@playwright/test';

const LONG_AXIS_ACTION_COUNT = 120;
const BROWSER_READY_BUDGET_MS = 15_000;
const WORKBENCH_DRAFT_STORAGE_KEY = 'promilia-axis-tool:workbench-draft:v15';

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

  const metrics = {
    actionCount: LONG_AXIS_ACTION_COUNT,
    stateCurvePointCount,
    readyMs,
    budgetMs: BROWSER_READY_BUDGET_MS,
  };
  await testInfo.attach('long-axis-browser-metrics.json', {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: 'application/json',
  });
  // eslint-disable-next-line no-console
  console.log(`LONG_AXIS_BROWSER_METRICS ${JSON.stringify(metrics)}`);
  expect(readyMs).toBeLessThan(BROWSER_READY_BUDGET_MS);
});

function createLongAxisSnapshot() {
  const frameMs = 1000 / 60;
  const actionDrafts = Array.from(
    { length: LONG_AXIS_ACTION_COUNT },
    (_, index) => ({
      id: `browser-long-axis-action-${String(index + 1).padStart(4, '0')}`,
      type: 'skill',
      skillId: 10900101,
      actorCharacterId: 109001,
      startMs: index * 9 * frameMs,
      durationMs: 6 * frameMs,
      level: 1,
      actionVariantIndex: 0,
      damageSegmentIndex: 0,
      targetCharacterId: 101003,
      resource: 'sp',
      change: 50,
      reason: 'manual-axis-resource',
      eventType: 'phase',
      note: '',
      insertion: null,
      generationBatch: null,
      effectCommands: [],
    })
  );
  return {
    schemaVersion: 15,
    game: 'azur-promilia',
    type: 'workbench-draft',
    savedAt: '2026-07-10T00:00:00.000Z',
    selection: {
      characterId: 109001,
      secondaryCharacterId: 101003,
      skillId: 10900101,
      enemyId: 300032,
    },
    teamSlots: [
      { slotId: 'team-slot-1', position: 0, characterId: 109001 },
      { slotId: 'team-slot-2', position: 1, characterId: 101003 },
    ],
    actorConfigs: [createActorConfig(109001), createActorConfig(101003)],
    enemyConfig: {
      level: 80,
      hpMultiplier: 100,
      defenseMultiplier: 1,
      toughnessMultiplier: 1,
      initialToughnessRatio: 1,
      elementDefenseOverrides: {},
    },
    segmentSplitOptions: {
      intervalMs: 2000,
      startAfterSelectedAction: false,
      skipExistingSegments: false,
    },
    actionDrafts,
    actionRelations: [],
    runtimeSampleCaptures: [],
    selectedActionId: actionDrafts.at(-1).id,
  };
}

function createActorConfig(characterId) {
  return {
    characterId,
    level: 80,
    initialSp: null,
    loadout: {
      kiboId: null,
      equipment: {
        weapon: null,
        top: null,
        bottom: null,
        earring: null,
        ring: null,
      },
      soulessenceId: null,
    },
  };
}
