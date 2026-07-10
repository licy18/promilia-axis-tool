import { describe, expect, it } from 'vitest';
import {
  MAX_WORKBENCH_SCENARIOS,
  addWorkbenchScenario,
  createDefaultWorkbenchScenarioWorkspace,
  deleteWorkbenchScenario,
  duplicateWorkbenchScenario,
  normalizeWorkbenchScenarioWorkspace,
  renameWorkbenchScenario,
  switchWorkbenchScenario,
} from '../../domain/workbenchScenarioWorkspace';

describe('workbench scenario workspace', () => {
  it('normalizes records and keeps the root draft authoritative for the active scenario', () => {
    const workspace = normalizeWorkbenchScenarioWorkspace(
      {
        activeScenarioId: 'scenario-b',
        scenarios: [
          { id: 'scenario-a', name: '  方案 A  ', draft: draft('action-a') },
          { id: 'scenario-b', name: '方案 B', draft: draft('stale-action') },
          { id: 'scenario-b', name: '', draft: draft('action-c') },
        ],
      },
      draft('active-action')
    );

    expect(workspace).toMatchObject({
      schemaVersion: 1,
      activeScenarioId: 'scenario-b',
      scenarios: [
        { id: 'scenario-a', name: '方案 A' },
        { id: 'scenario-b', name: '方案 B' },
        { id: 'scenario-0001', name: '方案 3' },
      ],
    });
    expect(workspace.scenarios[1].draft.actionDrafts[0].id).toBe(
      'active-action'
    );
  });

  it('adds, duplicates, renames, switches, and deletes complete scenario drafts', () => {
    const original = createDefaultWorkbenchScenarioWorkspace(
      draft('action-original')
    );
    const added = addWorkbenchScenario(
      original,
      draft('action-edited'),
      draft('action-empty')
    );
    expect(added).toMatchObject({
      changed: true,
      scenario: { id: 'scenario-0002', name: '方案 2' },
      workspace: { activeScenarioId: 'scenario-0002' },
    });
    expect(added.workspace.scenarios[0].draft.actionDrafts[0].id).toBe(
      'action-edited'
    );

    const renamed = renameWorkbenchScenario(
      added.workspace,
      'scenario-0002',
      '爆发轴'
    );
    expect(renamed.scenario.name).toBe('爆发轴');

    const duplicated = duplicateWorkbenchScenario(
      renamed.workspace,
      'scenario-0002',
      draft('action-empty-updated')
    );
    expect(duplicated).toMatchObject({
      changed: true,
      scenario: { id: 'scenario-0003', name: '爆发轴 副本' },
      workspace: { activeScenarioId: 'scenario-0003' },
    });
    expect(duplicated.scenario.draft.actionDrafts[0].id).toBe(
      'action-empty-updated'
    );

    const switched = switchWorkbenchScenario(
      duplicated.workspace,
      'scenario-0001',
      draft('action-copy-edited')
    );
    expect(switched.workspace.activeScenarioId).toBe('scenario-0001');
    expect(switched.workspace.scenarios[2].draft.actionDrafts[0].id).toBe(
      'action-copy-edited'
    );

    const deleted = deleteWorkbenchScenario(
      switched.workspace,
      'scenario-0001',
      draft('action-first-edited')
    );
    expect(deleted).toMatchObject({
      changed: true,
      workspace: {
        activeScenarioId: 'scenario-0002',
        scenarios: [{ id: 'scenario-0002' }, { id: 'scenario-0003' }],
      },
      scenario: { id: 'scenario-0002' },
    });
  });

  it('keeps one scenario and enforces the Endaxis-aligned workspace limit', () => {
    let workspace = createDefaultWorkbenchScenarioWorkspace(draft('action-1'));
    for (let index = 1; index < MAX_WORKBENCH_SCENARIOS; index += 1) {
      workspace = addWorkbenchScenario(
        workspace,
        draft(`action-${index}`),
        draft(`action-${index + 1}`)
      ).workspace;
    }

    const rejectedAdd = addWorkbenchScenario(
      workspace,
      draft('action-14-edited'),
      draft('action-15')
    );
    expect(rejectedAdd).toMatchObject({
      changed: false,
      reason: 'scenario-limit-reached',
    });
    expect(rejectedAdd.workspace.scenarios).toHaveLength(
      MAX_WORKBENCH_SCENARIOS
    );

    const single = createDefaultWorkbenchScenarioWorkspace(draft('only'));
    expect(
      deleteWorkbenchScenario(single, 'scenario-0001', draft('only-edited'))
    ).toMatchObject({ changed: false, reason: 'last-scenario' });
  });
});

function draft(actionId) {
  return {
    selection: { characterId: 109001 },
    actionDrafts: [{ id: actionId }],
    selectedActionId: actionId,
  };
}
