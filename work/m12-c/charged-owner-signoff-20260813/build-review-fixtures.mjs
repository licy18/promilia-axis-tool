import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..', '..');
const outputRoot = path.join(import.meta.dirname, 'review-fixtures');

const cases = [
  [101010, 'fixtures/character-acceptance/101010-visual.json', 'xiaoyu-enhanced-charged'],
  [102001, 'fixtures/character-acceptance/102001-visual.json', 'lily-charged'],
  [103002, 'fixtures/character-acceptance/103002-window-boundaries.json', 'reload-before-source'],
  [107001, 'fixtures/character-acceptance/107001-visual.json', 'sifliya-charged-with-lumi'],
  [107002, 'fixtures/character-acceptance/107002-visual.json', 'misa-charged'],
  [108003, 'fixtures/character-acceptance/108003-active-surface-closure.json', 'miti-full-charge-state-on'],
  [109001, 'fixtures/character-acceptance/109001-visual.json', 'moyin-charged'],
  [112001, 'fixtures/character-acceptance/112001-visual.json', 'gisele-heavy3-threshold67'],
  [199001, 'fixtures/character-acceptance/199001-starborn-visual.json', 'starborn-f-charged-default'],
  [199002, 'fixtures/character-acceptance/199002-starborn-visual.json', 'starborn-m-charged-default'],
];

function collectContextClosure(actions, targetId) {
  const byId = new Map(actions.map(action => [action.id, action]));
  const selectedIds = new Set();
  const visit = actionId => {
    if (!actionId || selectedIds.has(actionId)) return;
    const action = byId.get(actionId);
    if (!action) {
      throw new Error(`Missing context action ${actionId} for ${targetId}`);
    }
    visit(action.intent?.attackInput?.contextActionId);
    selectedIds.add(actionId);
  };
  visit(targetId);
  return actions.filter(action => selectedIds.has(action.id));
}

await mkdir(outputRoot, { recursive: true });

for (const [ownerId, sourceRelativePath, targetActionId] of cases) {
  const sourcePath = path.join(repositoryRoot, sourceRelativePath);
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const actions = collectContextClosure(source.actions ?? [], targetActionId);
  const fixture = {
    ...source,
    actions,
    metadata: {
      ...(source.metadata ?? {}),
      evidencePurpose: 'm12-c-charged-owner-visual-signoff',
      sourceFixturePath: sourceRelativePath.replaceAll('\\', '/'),
      targetActionId,
      contextClosureActionIds: actions.map(action => action.id),
    },
  };
  await writeFile(
    path.join(outputRoot, `${ownerId}.json`),
    `${JSON.stringify(fixture, null, 2)}\n`,
    'utf8'
  );
}

console.log(`generated ${cases.length} charged review fixtures in ${outputRoot}`);
