import { describe, expect, it } from 'vitest';
import {
  WORKBENCH_ACTION_PLACEMENT_CONTRACT_NAME,
  WORKBENCH_ACTION_PLACEMENT_STATUSES,
  createWorkbenchActionPlacementProposal,
  expandWorkbenchPlacementActionIds,
} from '../../domain/workbenchActionPlacement';

function action(id, startMs, durationMs = 1000, extra = {}) {
  return { id, startMs, durationMs, ...extra };
}

function evaluateWithRules(candidateActions) {
  const diagnostics = [];
  const sorted = [...candidateActions].sort(
    (left, right) => left.startMs - right.startMs
  );
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (
      previous.actorId === current.actorId &&
      current.startMs < previous.startMs + previous.durationMs
    ) {
      diagnostics.push({
        id: 'overlap-' + current.id,
        code: 'action-lane-overlap',
        status: 'violated',
        actionId: current.id,
        actionIds: [previous.id, current.id],
        blockingActionId: previous.id,
        suggestedStartMs: previous.startMs + previous.durationMs,
        source: { sourceKind: 'project-action-timing' },
      });
    }
  }
  return {
    actionRuleDiagnostics: {
      sourceKind: 'azpr-scenario-action-rule-diagnostics',
      diagnostics,
    },
  };
}

describe('workbenchActionPlacement', () => {
  it('returns a valid proposal without duplicating rule evaluation', () => {
    const requested = action('new', 2000, 1000, { actorId: 'actor-1' });
    const proposal = createWorkbenchActionPlacementProposal({
      currentActions: [action('existing', 0, 1000, { actorId: 'actor-1' })],
      requestedActions: [requested],
      timelineDurationMs: 10000,
      evaluateCandidate: evaluateWithRules,
    });

    expect(proposal).toMatchObject({
      contractName: WORKBENCH_ACTION_PLACEMENT_CONTRACT_NAME,
      status: WORKBENCH_ACTION_PLACEMENT_STATUSES.VALID,
      committable: true,
      requestedStartMs: 2000,
      suggestedStartMs: 2000,
      appliedOffsetMs: 0,
    });
  });

  it('moves an overlapping action group as one unit to the earliest evaluated position', () => {
    const proposal = createWorkbenchActionPlacementProposal({
      currentActions: [action('existing', 1000, 1500, { actorId: 'actor-1' })],
      requestedActions: [
        action('group-a', 1500, 500, { actorId: 'actor-1' }),
        action('group-b', 3000, 500, { actorId: 'actor-2' }),
      ],
      actionRelations: [
        { id: 'relation-1', fromActionId: 'group-a', toActionId: 'group-b' },
      ],
      timelineDurationMs: 10000,
      evaluateCandidate: evaluateWithRules,
    });

    expect(proposal.status).toBe(
      WORKBENCH_ACTION_PLACEMENT_STATUSES.ADJUSTABLE
    );
    expect(proposal.appliedOffsetMs).toBe(1000);
    expect(proposal.relationIds).toEqual(['relation-1']);
    expect(proposal.proposedActions.map(item => item.startMs)).toEqual([
      2500, 4000,
    ]);
  });

  it('uses existing cooldown diagnostics as an adjustment source', () => {
    const proposal = createWorkbenchActionPlacementProposal({
      currentActions: [action('first', 0, 500)],
      requestedActions: [action('second', 1000, 500)],
      timelineDurationMs: 10000,
      evaluateCandidate(candidateActions) {
        const second = candidateActions.find(item => item.id === 'second');
        return {
          diagnostics:
            second.startMs < 4000
              ? [
                  {
                    id: 'cooldown-second',
                    code: 'skill-cooldown-active',
                    status: 'violated',
                    actionId: 'second',
                    actionIds: ['first', 'second'],
                    blockingActionId: 'first',
                    suggestedStartMs: 4000,
                    source: {
                      sourceKind: 'azpr-skill-cooldown-window',
                    },
                  },
                ]
              : [],
        };
      },
    });

    expect(proposal.status).toBe(
      WORKBENCH_ACTION_PLACEMENT_STATUSES.ADJUSTABLE
    );
    expect(proposal.suggestedStartMs).toBe(4000);
    expect(proposal.ruleSources).toContain('azpr-skill-cooldown-window');
  });

  it('blocks an internal group conflict that translation cannot resolve', () => {
    const proposal = createWorkbenchActionPlacementProposal({
      requestedActions: [
        action('group-a', 0, 1500, { actorId: 'actor-1' }),
        action('group-b', 1000, 500, { actorId: 'actor-1' }),
      ],
      timelineDurationMs: 10000,
      evaluateCandidate: evaluateWithRules,
    });

    expect(proposal.status).toBe(WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED);
    expect(proposal.committable).toBe(false);
    expect(proposal.conflicts[0].code).toBe('action-lane-overlap');
  });

  it('keeps unresolved mechanics advisory and committable without moving', () => {
    const proposal = createWorkbenchActionPlacementProposal({
      requestedActions: [action('skill', 1000)],
      timelineDurationMs: 10000,
      evaluateCandidate() {
        return {
          diagnostics: [
            {
              id: 'sp-skill',
              code: 'skill-sp-precondition-unresolved',
              status: 'unresolved',
              actionId: 'skill',
              actionIds: ['skill'],
              source: { sourceKind: 'azpr-newtable-skill-logic-index' },
            },
          ],
        };
      },
    });

    expect(proposal).toMatchObject({
      status: WORKBENCH_ACTION_PLACEMENT_STATUSES.UNRESOLVED,
      committable: true,
      suggestedStartMs: 1000,
      appliedOffsetMs: 0,
    });
    expect(proposal.unresolved).toHaveLength(1);
  });

  it('blocks the whole group at the timeline end instead of truncating it', () => {
    const proposal = createWorkbenchActionPlacementProposal({
      requestedActions: [
        action('group-a', 9000, 1000),
        action('group-b', 9500, 1000),
      ],
      timelineDurationMs: 10000,
      evaluateCandidate: evaluateWithRules,
    });

    expect(proposal.status).toBe(WORKBENCH_ACTION_PLACEMENT_STATUSES.BLOCKED);
    expect(proposal.conflicts.at(-1).code).toBe(
      'placement-group-exceeds-timeline-end'
    );
  });

  it('expands an assisted selection across connected relations', () => {
    const actions = [action('a', 0), action('b', 1000), action('c', 2000)];
    expect(
      expandWorkbenchPlacementActionIds({
        actions,
        actionIds: ['b'],
        actionRelations: [
          { fromActionId: 'a', toActionId: 'b' },
          { fromActionId: 'b', toActionId: 'c' },
        ],
      })
    ).toEqual(['a', 'b', 'c']);
  });

  it('can expand only simultaneous relations for atomic free placement', () => {
    const actions = [action('a', 0), action('b', 0), action('c', 2000)];
    expect(
      expandWorkbenchPlacementActionIds({
        actions,
        actionIds: ['a'],
        actionRelations: [
          { kind: 'simultaneous', fromActionId: 'a', toActionId: 'b' },
          { kind: 'sequence', fromActionId: 'b', toActionId: 'c' },
        ],
        relationKinds: ['simultaneous'],
      })
    ).toEqual(['a', 'b']);
  });
});
