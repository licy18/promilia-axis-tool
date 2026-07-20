import { describe, expect, it } from 'vitest';
import { createWorkbenchActionDraft } from '../../domain/workbenchProjectFactory';
import {
  createWorkbenchActionRelationChain,
  normalizeWorkbenchActionRelations,
  removeWorkbenchActionRelationsForActions,
  synchronizeWorkbenchActionRelationGaps,
  wouldCreateRelationCycle,
} from '../../domain/workbenchActionRelations';
import { frameToMs } from '../../domain/timebase';

function createActions() {
  return [
    createWorkbenchActionDraft({
      id: 'action-0001',
      startMs: frameToMs(0),
      durationMs: frameToMs(30),
    }),
    createWorkbenchActionDraft({
      id: 'action-0002',
      startMs: frameToMs(60),
      durationMs: frameToMs(30),
    }),
    createWorkbenchActionDraft({
      id: 'action-0003',
      startMs: frameToMs(120),
      durationMs: frameToMs(30),
    }),
  ];
}

describe('workbench action relations', () => {
  it('normalizes sequence anchors, gaps, ids, and invalid edges', () => {
    const actions = createActions();
    const relations = normalizeWorkbenchActionRelations(
      [
        {
          id: 'relation-0001',
          kind: 'unknown',
          fromActionId: 'action-0001',
          toActionId: 'action-0002',
          gapMs: 999,
        },
        {
          id: 'relation-0001',
          fromActionId: 'action-0002',
          toActionId: 'action-0003',
        },
        {
          id: 'dangling',
          fromActionId: 'action-0003',
          toActionId: 'missing',
        },
        {
          id: 'duplicate-edge',
          fromActionId: 'action-0001',
          toActionId: 'action-0002',
        },
        {
          id: 'cycle',
          fromActionId: 'action-0003',
          toActionId: 'action-0001',
        },
      ],
      actions
    );

    expect(relations).toEqual([
      {
        id: 'relation-0001',
        kind: 'sequence',
        fromActionId: 'action-0001',
        toActionId: 'action-0002',
        sourceAnchor: 'end',
        targetAnchor: 'start',
        gapMs: frameToMs(30),
      },
      {
        id: 'relation-0002',
        kind: 'sequence',
        fromActionId: 'action-0002',
        toActionId: 'action-0003',
        sourceAnchor: 'end',
        targetAnchor: 'start',
        gapMs: frameToMs(30),
      },
    ]);
  });

  it('creates a chronological acyclic chain for selected actions', () => {
    const actions = createActions();
    const result = createWorkbenchActionRelationChain([], actions, [
      'action-0003',
      'action-0001',
      'action-0002',
    ]);

    expect(result.createdRelations).toHaveLength(2);
    expect(
      result.createdRelations.map(relation => [
        relation.fromActionId,
        relation.toActionId,
      ])
    ).toEqual([
      ['action-0001', 'action-0002'],
      ['action-0002', 'action-0003'],
    ]);
    expect(
      wouldCreateRelationCycle(result.relations, 'action-0003', 'action-0001')
    ).toBe(true);
  });

  it('preserves simultaneous start anchors without converting them to a sequence gap', () => {
    const actions = createActions()
      .slice(0, 2)
      .map(action => ({
        ...action,
        startMs: frameToMs(60),
      }));
    expect(
      normalizeWorkbenchActionRelations(
        [
          {
            id: 'joint-relation',
            kind: 'simultaneous',
            fromActionId: 'action-0001',
            toActionId: 'action-0002',
            gapMs: 999,
          },
        ],
        actions
      )
    ).toEqual([
      {
        id: 'joint-relation',
        kind: 'simultaneous',
        fromActionId: 'action-0001',
        toActionId: 'action-0002',
        sourceAnchor: 'start',
        targetAnchor: 'start',
        gapMs: 0,
      },
    ]);
  });

  it('synchronizes gaps after movement and removes touched edges', () => {
    const actions = createActions();
    const relation = createWorkbenchActionRelationChain([], actions, [
      'action-0001',
      'action-0002',
    ]).relations;
    const movedActions = actions.map(action =>
      action.id === 'action-0002'
        ? { ...action, startMs: frameToMs(75) }
        : action
    );

    expect(
      synchronizeWorkbenchActionRelationGaps(relation, movedActions)[0].gapMs
    ).toBe(frameToMs(45));
    expect(
      removeWorkbenchActionRelationsForActions(relation, ['action-0002'])
    ).toEqual([]);
  });
});
