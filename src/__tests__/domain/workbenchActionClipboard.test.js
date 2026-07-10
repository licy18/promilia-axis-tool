import { describe, expect, it } from 'vitest';
import {
  createWorkbenchActionClipboard,
  createWorkbenchActionSelectionRange,
  normalizeWorkbenchActionSelection,
  pasteWorkbenchActionClipboard,
  shiftWorkbenchActionDrafts,
} from '../../domain/workbenchActionClipboard';
import { createWorkbenchActionDraft } from '../../domain/workbenchProjectFactory';
import { frameToMs } from '../../domain/timebase';

function createActions() {
  return [
    createWorkbenchActionDraft({
      id: 'action-0001',
      actorCharacterId: 1001,
      startMs: frameToMs(30),
      durationMs: frameToMs(30),
    }),
    createWorkbenchActionDraft({
      id: 'action-0002',
      actorCharacterId: 1002,
      startMs: frameToMs(90),
      durationMs: frameToMs(45),
      insertion: { kind: 'after-action', sourceActionId: 'action-0001' },
      generationBatch: {
        batchId: 'generated-1',
        sourceActionId: 'action-0001',
      },
      effectCommands: [
        {
          id: 'source-command',
          effectId: 'shared-effect',
          effectName: '测试效果',
          sourceActionId: 'action-0002',
        },
      ],
    }),
    createWorkbenchActionDraft({
      id: 'action-0003',
      actorCharacterId: 1001,
      startMs: frameToMs(150),
      durationMs: frameToMs(30),
    }),
  ];
}

describe('workbench action clipboard', () => {
  it('normalizes selection and creates an inclusive range in action order', () => {
    const actions = createActions();

    expect(
      normalizeWorkbenchActionSelection(
        actions,
        ['missing', 'action-0003', 'action-0001'],
        'action-0003'
      )
    ).toEqual({
      selectedActionIds: ['action-0001', 'action-0003'],
      primaryActionId: 'action-0003',
    });
    expect(
      createWorkbenchActionSelectionRange(actions, 'action-0001', 'action-0003')
    ).toEqual(['action-0001', 'action-0002', 'action-0003']);
  });

  it('pastes arbitrary actions with relative timing and actor lanes intact', () => {
    const actions = createActions();
    const clipboard = createWorkbenchActionClipboard(
      actions,
      ['action-0001', 'action-0003'],
      [
        {
          id: 'relation-0001',
          fromActionId: 'action-0001',
          toActionId: 'action-0003',
        },
      ]
    );
    let nextId = 4;
    const result = pasteWorkbenchActionClipboard(clipboard, {
      existingActions: actions,
      existingRelations: clipboard.relations,
      timelineDurationMs: frameToMs(300),
      targetStartMs: frameToMs(180),
      createActionId: usedActionIds => {
        let id = `action-${String(nextId++).padStart(4, '0')}`;
        while (usedActionIds.has(id)) {
          id = `action-${String(nextId++).padStart(4, '0')}`;
        }
        return id;
      },
    });

    expect(result.selectedActionIds).toEqual(['action-0004', 'action-0005']);
    expect(result.pastedRelations).toEqual([
      expect.objectContaining({
        id: 'relation-0002',
        fromActionId: 'action-0004',
        toActionId: 'action-0005',
      }),
    ]);
    expect(result.pastedActions.map(action => action.startMs)).toEqual([
      frameToMs(150),
      frameToMs(300 - 30),
    ]);
    expect(result.pastedActions.map(action => action.actorCharacterId)).toEqual(
      [1001, 1001]
    );
    expect(actions.map(action => action.id)).toEqual([
      'action-0001',
      'action-0002',
      'action-0003',
    ]);
  });

  it('rebuilds action-scoped effect command ids and clears generated metadata', () => {
    const actions = createActions();
    const clipboard = createWorkbenchActionClipboard(actions, ['action-0002']);
    const result = pasteWorkbenchActionClipboard(clipboard, {
      existingActions: actions,
      timelineDurationMs: frameToMs(300),
      targetStartMs: 0,
      createActionId: () => 'action-0004',
    });
    const pasted = result.pastedActions[0];

    expect(pasted.insertion).toBeNull();
    expect(pasted.generationBatch).toBeNull();
    expect(pasted.effectCommands[0]).toMatchObject({
      id: 'action-0004-effect-01',
      effectId: 'shared-effect',
    });
  });

  it('moves a selection as one frame-bounded group', () => {
    const actions = createActions();
    const shifted = shiftWorkbenchActionDrafts(
      actions,
      ['action-0001', 'action-0003'],
      frameToMs(200),
      frameToMs(210)
    );

    expect(shifted.appliedOffsetMs).toBe(frameToMs(30));
    expect(shifted.affectedActionIds).toEqual(['action-0001', 'action-0003']);
    expect(shifted.actions.map(action => action.startMs)).toEqual([
      frameToMs(60),
      frameToMs(90),
      frameToMs(180),
    ]);
  });
});
