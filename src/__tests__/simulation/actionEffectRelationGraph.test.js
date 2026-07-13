import { describe, expect, it } from 'vitest';
import {
  ACTION_RELATION_KINDS,
  EFFECT_OPERATIONS,
  EFFECT_TARGET_KINDS,
  createEffectCommand,
} from '../../domain/projectSchema';
import {
  ACTION_EFFECT_RELATION_KINDS,
  createActionEffectRelationGraph,
} from '../../simulation/runtime/actionEffectRelationGraph';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';

describe('action effect relation graph', () => {
  it('unifies sequence, trigger, refresh, and consume edges with runtime diagnostics', () => {
    const scenario = createRelationScenario();
    const effectTimeline = createEffectRuntimeTimeline({ scenario });
    const graph = createActionEffectRelationGraph({ scenario, effectTimeline });

    expect(graph).toMatchObject({
      schemaVersion: 1,
      contractName: 'AzPrActionEffectRelationGraph',
      status: 'action-effect-relation-graph-ready-with-diagnostics',
      summary: {
        actionNodeCount: 4,
        effectNodeCount: 2,
        edgeCount: 5,
        sequenceEdgeCount: 1,
        triggerEdgeCount: 1,
        refreshEdgeCount: 1,
        consumeEdgeCount: 2,
        satisfiedEdgeCount: 4,
        unsatisfiedEdgeCount: 1,
        runtimeEventBoundEdgeCount: 4,
        appliedToCalculators: false,
      },
      diagnostics: {
        valid: true,
        issueCount: 1,
      },
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'sequence-1',
          kind: ACTION_EFFECT_RELATION_KINDS.SEQUENCE,
          status: 'satisfied',
          sourceEndpoint: expect.objectContaining({
            endpointKind: 'action',
            actionId: 'action-apply',
            anchor: 'end',
          }),
          targetEndpoint: expect.objectContaining({
            endpointKind: 'action',
            actionId: 'action-refresh',
            anchor: 'start',
          }),
          expectedGapMs: 400,
          actualGapMs: 400,
        }),
        expect.objectContaining({
          edgeId: 'effect-relation:command-apply',
          kind: ACTION_EFFECT_RELATION_KINDS.TRIGGER,
          status: 'satisfied',
          commandActionId: 'action-apply',
          sourceEndpoint: expect.objectContaining({ endpointKind: 'action' }),
          targetEndpoint: expect.objectContaining({
            endpointKind: 'effect',
            instanceKey: 'actor|actor-001|focus',
          }),
          runtimeEventType: 'EFFECT_APPLIED',
        }),
        expect.objectContaining({
          edgeId: 'effect-relation:command-refresh',
          kind: ACTION_EFFECT_RELATION_KINDS.REFRESH,
          status: 'satisfied',
          runtimeEventType: 'EFFECT_REFRESHED',
        }),
        expect.objectContaining({
          edgeId: 'effect-relation:command-remove',
          kind: ACTION_EFFECT_RELATION_KINDS.CONSUME,
          status: 'satisfied',
          sourceEndpoint: expect.objectContaining({ endpointKind: 'effect' }),
          targetEndpoint: expect.objectContaining({
            endpointKind: 'action',
            actionId: 'action-remove',
          }),
          sourceActionId: 'action-apply',
          targetActionId: 'action-remove',
          runtimeEventType: 'EFFECT_REMOVED',
        }),
        expect.objectContaining({
          edgeId: 'effect-relation:command-remove-missing',
          kind: ACTION_EFFECT_RELATION_KINDS.CONSUME,
          status: 'unsatisfied',
          diagnosticCode: 'effect-consume-active-instance-missing',
        }),
      ])
    );
    expect(graph.diagnostics.issues).toEqual([
      expect.objectContaining({
        edgeId: 'effect-relation:command-remove-missing',
        status: 'unsatisfied',
      }),
    ]);
    expect(effectTimeline.events[0]).toMatchObject({
      commandId: 'command-apply',
      relationId: 'effect-relation:command-apply',
      relationKind: ACTION_EFFECT_RELATION_KINDS.TRIGGER,
    });
  });

  it('marks skipped and invalid effect commands without applying relation behavior', () => {
    const scenario = {
      time: { durationMs: 1000, fps: 60 },
      actions: [
        createAction({
          id: 'action-blocked',
          startMs: 0,
          command: createEffectCommand({
            id: 'command-blocked',
            effectId: 'blocked',
            targetKind: EFFECT_TARGET_KINDS.ACTOR,
            targetId: 'actor-001',
          }),
        }),
        createAction({
          id: 'action-invalid',
          startMs: 100,
          command: createEffectCommand({
            id: 'command-invalid',
            effectId: '',
            targetKind: EFFECT_TARGET_KINDS.ACTOR,
            targetId: 'actor-001',
          }),
        }),
      ],
    };
    const actionExecutionPlan = {
      actions: [
        { actionId: 'action-blocked', execute: false },
        { actionId: 'action-invalid', execute: true },
      ],
    };
    const effectTimeline = createEffectRuntimeTimeline({
      scenario,
      actionExecutionPlan,
    });
    const graph = createActionEffectRelationGraph({
      scenario,
      effectTimeline,
      actionExecutionPlan,
    });

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edgeId: 'effect-relation:command-blocked',
          status: 'blocked',
          diagnosticCode: 'effect-relation-action-blocked',
          runtimeEventId: null,
        }),
        expect.objectContaining({
          edgeId: 'effect-relation:command-invalid',
          status: 'invalid',
          diagnosticCode: 'effect-relation-command-invalid',
          runtimeEventId: null,
        }),
      ])
    );
    expect(effectTimeline.events).toHaveLength(0);
  });
});

function createRelationScenario() {
  return {
    time: { durationMs: 2000, fps: 60 },
    actions: [
      createAction({
        id: 'action-apply',
        startMs: 0,
        durationMs: 100,
        command: createEffectCommand({
          id: 'command-apply',
          effectId: 'focus',
          effectName: 'Focus',
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          durationMs: 1800,
        }),
      }),
      createAction({
        id: 'action-refresh',
        startMs: 500,
        command: createEffectCommand({
          id: 'command-refresh',
          effectId: 'focus',
          effectName: 'Focus',
          operation: EFFECT_OPERATIONS.REFRESH,
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
          durationMs: 1200,
        }),
      }),
      createAction({
        id: 'action-remove',
        startMs: 1000,
        command: createEffectCommand({
          id: 'command-remove',
          effectId: 'focus',
          effectName: 'Focus',
          operation: EFFECT_OPERATIONS.REMOVE,
          targetKind: EFFECT_TARGET_KINDS.ACTOR,
          targetId: 'actor-001',
        }),
      }),
      createAction({
        id: 'action-remove-missing',
        startMs: 1500,
        command: createEffectCommand({
          id: 'command-remove-missing',
          effectId: 'mark',
          effectName: 'Mark',
          operation: EFFECT_OPERATIONS.REMOVE,
          targetKind: EFFECT_TARGET_KINDS.ENEMY,
          targetId: 'enemy-001',
        }),
      }),
    ],
    actionRelations: [
      {
        id: 'sequence-1',
        kind: ACTION_RELATION_KINDS.SEQUENCE,
        fromActionId: 'action-apply',
        toActionId: 'action-refresh',
        gapMs: 400,
      },
    ],
  };
}

function createAction({ id, startMs, durationMs = 100, command }) {
  return {
    id,
    name: id,
    actorId: 'actor-001',
    startMs,
    durationMs,
    effectCommands: [command],
  };
}
