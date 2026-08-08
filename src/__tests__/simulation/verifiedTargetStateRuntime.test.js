import { describe, expect, it } from 'vitest';
import { applyVerifiedTargetStateRuntime } from '../../simulation/mechanics/verifiedTargetStateRuntime';

describe('verified target-state runtime', () => {
  it('reuses generic target-state contracts for gain, conditional settlement, and skipped hits', () => {
    const actionResolutionById = new Map([
      [
        'gain',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
      [
        'burst-applied',
        createResolution({
          controlSkillId: 424202,
          hits: [
            createHit(9002, 1, 'synthetic-firework-burst'),
            createHit(9003, 2),
          ],
        }),
      ],
      [
        'burst-skipped',
        createResolution({
          controlSkillId: 424202,
          hits: [
            createHit(9002, 1, 'synthetic-firework-burst'),
            createHit(9003, 2),
          ],
        }),
      ],
    ]);
    const scenario = {
      time: { durationMs: 5000 },
      actors: [
        {
          id: 'actor-1',
          characterId: 424242,
          name: 'Synthetic Owner',
        },
      ],
      enemy: {
        id: 'enemy-1',
        name: 'Synthetic Enemy',
      },
      actions: [
        createAction('gain', 0),
        createAction('burst-applied', 1000),
        createAction('burst-skipped', 2000),
      ],
    };

    const result = applyVerifiedTargetStateRuntime({
      scenario,
      actionResolutionById,
      mechanicsPackage: createMechanicsPackage(),
    });

    expect(result).toMatchObject({
      status: 'verified-target-state-runtime-ready',
      summary: {
        profileCount: 1,
        eventCount: 2,
        appliedGroupCount: 1,
        skippedGroupCount: 1,
        directSpEventCount: 1,
      },
      finalState: [
        {
          stateIdentity: 'enemy:synthetic-firework',
          currentValue: 0,
          maxValue: 3,
        },
      ],
    });
    expect(
      result.events.map(event => [
        event.actionId,
        event.payload.operation,
        event.payload.beforeValue,
        event.payload.afterValue,
      ])
    ).toEqual([
      ['gain', 'gain', 0, 1],
      ['burst-applied', 'consume', 1, 0],
    ]);
    expect(result.groupResults).toEqual([
      expect.objectContaining({
        actionId: 'burst-applied',
        beforeStacks: 1,
        consumedStacks: 1,
        afterStacks: 0,
        applied: true,
      }),
      expect.objectContaining({
        actionId: 'burst-skipped',
        beforeStacks: 0,
        consumedStacks: 0,
        afterStacks: 0,
        applied: false,
      }),
    ]);
    expect(
      actionResolutionById.get('burst-applied').hits.map(hit => hit.elementId)
    ).toEqual([9002, 9003]);
    expect(
      actionResolutionById.get('burst-skipped').hits.map(hit => hit.elementId)
    ).toEqual([9003]);
    expect(result.directSpEvents).toHaveLength(1);
    expect(result.directSpEvents[0]).toMatchObject({
      actionId: 'burst-applied',
      target: {
        kind: 'actor',
        id: 'actor-1',
      },
      value: 2,
    });
    expect(
      result.effectCommands.some(
        command =>
          command.effectId === 'battle-element:9004' &&
          command.sourceActionId === 'burst-applied' &&
          command.appliedToCalculators
      )
    ).toBe(true);
  });

  it('keeps same-frame independent layers addressable and accepts both controlled-actor target aliases', () => {
    const actionResolutionById = new Map([
      [
        'gain',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
      [
        'burst-applied',
        createResolution({
          controlSkillId: 424202,
          hits: [createHit(9002, 1, 'synthetic-firework-burst')],
        }),
      ],
    ]);
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateTransactions.push({
      ...mechanicsPackage.actionVariantGraph.targetStateTransactions[0],
      transactionIdentity: 'synthetic-firework-same-frame-passive',
      durationMs: 15000,
      sourceIdentity: 'fixture:synthetic-firework-same-frame-passive',
    });
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings.push(
      {
        ...mechanicsPackage.actionVariantGraph.runtimeEffectBindings[0],
        bindingIdentity: 'synthetic-burst-controlled-alias',
        targetKind: 'controlling-actor',
        effectId: 'battle-element:9006',
        effectName: 'Synthetic Controlled Alias',
        sourceIdentity: 'fixture:synthetic-burst-controlled-alias',
      },
      {
        ...mechanicsPackage.actionVariantGraph.runtimeEffectBindings[0],
        bindingIdentity: 'synthetic-burst-controlled-canonical',
        targetKind: 'controlled-actor',
        effectId: 'battle-element:9007',
        effectName: 'Synthetic Controlled Canonical',
        sourceIdentity: 'fixture:synthetic-burst-controlled-canonical',
      }
    );
    const scenario = {
      time: { durationMs: 5000 },
      actors: [
        {
          id: 'actor-1',
          characterId: 424242,
          name: 'Synthetic Owner',
        },
      ],
      enemy: {
        id: 'enemy-1',
        name: 'Synthetic Enemy',
      },
      actions: [createAction('gain', 0), createAction('burst-applied', 1000)],
    };

    const result = applyVerifiedTargetStateRuntime({
      scenario,
      actionResolutionById,
      mechanicsPackage,
      controlledActorTimeline: {
        initialActor: {
          actorId: 'actor-1',
          characterId: 424242,
          actorName: 'Synthetic Owner',
        },
        transitions: [],
        intervals: [
          {
            startMs: 0,
            endMs: 5000,
            actorId: 'actor-1',
            name: 'Synthetic Owner',
          },
        ],
      },
    });

    const sameFrameCommands = result.effectCommands.filter(
      command =>
        command.effectId === 'battle-element:undefined' &&
        command.timeMs === 83.333333
    );
    expect(sameFrameCommands).toHaveLength(2);
    expect(new Set(sameFrameCommands.map(command => command.id)).size).toBe(2);
    expect(
      result.effectCommands
        .filter(command =>
          ['battle-element:9006', 'battle-element:9007'].includes(
            command.effectId
          )
        )
        .map(command => [
          command.effectId,
          command.targetKind,
          command.targetId,
        ])
    ).toEqual([
      ['battle-element:9006', 'actor', 'actor-1'],
      ['battle-element:9007', 'actor', 'actor-1'],
    ]);
  });

  it('expires layers independently and omits a disabled required hit', () => {
    const mechanicsPackage = createMechanicsPackage();
    const scenario = {
      time: { durationMs: 12000 },
      actors: [
        {
          id: 'actor-1',
          characterId: 424242,
          name: 'Synthetic Owner',
        },
      ],
      enemy: {
        id: 'enemy-1',
        name: 'Synthetic Enemy',
      },
      actions: [
        createAction('gain-first', 0),
        createAction('gain-second', 1000),
        createAction('gain-disabled', 2000),
      ],
    };
    const actionResolutionById = new Map([
      [
        'gain-first',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
      [
        'gain-second',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
      [
        'gain-disabled',
        createResolution({
          controlSkillId: 424201,
          hits: [],
        }),
      ],
    ]);

    const result = applyVerifiedTargetStateRuntime({
      scenario,
      actionResolutionById,
      mechanicsPackage,
    });

    expect(
      result.events.map(event => [
        event.actionId,
        event.payload.operation,
        event.payload.beforeValue,
        event.payload.afterValue,
        event.timeMs,
      ])
    ).toEqual([
      ['gain-first', 'gain', 0, 1, 83.333333],
      ['gain-second', 'gain', 1, 2, 1083.333333],
      [null, 'expire', 2, 1, 10083.333333],
      [null, 'expire', 1, 0, 11083.333333],
    ]);
    expect(
      result.events.some(event => event.actionId === 'gain-disabled')
    ).toBe(false);
    expect(result.finalState[0].currentValue).toBe(0);
  });

  it('executes a generic self layer formula as an effect activation condition', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateProfiles[0] = {
      ...mechanicsPackage.actionVariantGraph.targetStateProfiles[0],
      targetKind: 'self',
      maxStacks: 1,
    };
    const condition = {
      kind: 'element-layer-formula-activation-condition',
      commonFunctionId: 102100,
      expression: 'IF(self.ELEMENT_LAYERS[M]>I,T,F)',
      subjectKind: 'self',
      stateIdentity: 'enemy:synthetic-firework',
      stateElementId: 9001,
      comparison: 'greater-than',
      threshold: 0,
      minimumStacks: 1,
      trueValue: 1,
      falseValue: 0,
      sourceElementId: 9008,
      sourceIdentity: 'fixture:formula:102100',
      applied: true,
    };
    const actionResolutionById = new Map([
      [
        'effect-off',
        createResolution({
          controlSkillId: 424203,
          hits: [],
          effects: [createConditionedEffect('effect-off', condition)],
        }),
      ],
      [
        'gain',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
      [
        'effect-on',
        createResolution({
          controlSkillId: 424203,
          hits: [],
          effects: [createConditionedEffect('effect-on', condition)],
        }),
      ],
    ]);
    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 5000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [
          createAction('effect-off', 0),
          createAction('gain', 1000),
          createAction('effect-on', 2000),
        ],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(actionResolutionById.get('effect-off').effects).toEqual([]);
    expect(actionResolutionById.get('effect-off').suppressedEffects).toEqual([
      expect.objectContaining({
        effectIdentity: 'effect-off',
        reason: 'target-state-activation-condition-not-met',
      }),
    ]);
    expect(actionResolutionById.get('effect-on').effects).toEqual([
      expect.objectContaining({ effectIdentity: 'effect-on' }),
    ]);
    expect(result.actionEffectActivationResults).toEqual([
      expect.objectContaining({ actionId: 'effect-off', applied: false }),
      expect.objectContaining({ actionId: 'effect-on', applied: true }),
    ]);
  });

  it('refreshes a capped state and expires it on the right-open boundary', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateProfiles[0] = {
      ...mechanicsPackage.actionVariantGraph.targetStateProfiles[0],
      maxStacks: 1,
      atCapacityPolicy: 'refresh-oldest',
    };
    const actionResolutionById = new Map([
      [
        'gain-first',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
      [
        'gain-refresh',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
    ]);
    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 12000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [
          createAction('gain-first', 0),
          createAction('gain-refresh', 1000),
        ],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(
      result.events
        .filter(event => event.type === 'VERIFIED_TARGET_STATE_CHANGE')
        .map(event => [
          event.actionId,
          event.payload.operation,
          event.timeMs,
          event.payload.beforeValue,
          event.payload.afterValue,
        ])
    ).toEqual([
      ['gain-first', 'gain', 83.333333, 0, 1],
      ['gain-refresh', 'refresh', 1083.333333, 1, 1],
      [null, 'expire', 11083.333333, 1, 0],
    ]);
  });
});

function createMechanicsPackage() {
  return {
    packageId: 'synthetic-target-state-package',
    packageHash: 'synthetic-target-state-hash',
    actionVariantGraph: {
      targetStateProfiles: [
        {
          ownerId: 424242,
          stateIdentity: 'enemy:synthetic-firework',
          name: 'Synthetic Firework',
          targetKind: 'enemy',
          durationMs: 10000,
          maxStacks: 3,
          applied: true,
        },
      ],
      targetStateTransactions: [
        {
          ownerId: 424242,
          transactionIdentity: 'synthetic-firework-gain',
          stateIdentity: 'enemy:synthetic-firework',
          controlSkillId: 424201,
          subSkillIndex: 0,
          triggerFrame: 5,
          frameRate: 60,
          operation: 'gain',
          amount: 1,
          durationMs: 10000,
          requiresHitElementId: 9001,
          sourceIdentity: 'fixture:synthetic-firework-gain',
          applied: true,
        },
      ],
      conditionalHitGroups: [
        {
          ownerId: 424242,
          groupIdentity: 'synthetic-firework-burst',
          stateIdentity: 'enemy:synthetic-firework',
          controlSkillId: 424202,
          subSkillIndex: 0,
          decisionFrame: 0,
          frameRate: 60,
          minimumStacks: 1,
          consumeBands: [
            {
              minimumStacks: 1,
              amount: 1,
              sourceIdentity: 'fixture:synthetic-firework-consume',
            },
          ],
          fallbackConsumeAll: true,
          sourceIdentity: 'fixture:synthetic-firework-burst',
          applied: true,
        },
      ],
      runtimeEffectBindings: [
        {
          ownerId: 424242,
          bindingIdentity: 'synthetic-burst-property',
          triggerKind: 'conditional-hit-group-applied',
          conditionalGroupIdentity: 'synthetic-firework-burst',
          controlSkillId: 424202,
          subSkillIndex: 0,
          triggerFrame: 1,
          frameRate: 60,
          targetKind: 'source-actor',
          effectId: 'battle-element:9004',
          effectName: 'Synthetic Attack',
          durationMs: 1000,
          stackMode: 'refresh',
          stackDelta: 1,
          maxStacks: 1,
          modifiers: [
            {
              kind: 'battle-property',
              attributeId: 1,
              bucket: 'dynamicPercent',
              valueRaw: 1000,
            },
          ],
          directSp: null,
          sourceIdentity: 'fixture:synthetic-burst-property',
          applied: true,
        },
        {
          ownerId: 424242,
          bindingIdentity: 'synthetic-burst-sp',
          triggerKind: 'conditional-hit-group-applied',
          conditionalGroupIdentity: 'synthetic-firework-burst',
          controlSkillId: 424202,
          subSkillIndex: 0,
          triggerFrame: 1,
          frameRate: 60,
          targetKind: 'source-actor',
          effectId: 'battle-element:9005',
          effectName: 'Synthetic SP',
          durationMs: null,
          stackMode: 'refresh',
          stackDelta: 1,
          maxStacks: 1,
          modifiers: [],
          directSp: {
            elementId: 9005,
            value: 2,
            enhanceable: false,
            shareType: 0,
            sourceIdentity: 'fixture:synthetic-burst-sp',
          },
          sourceIdentity: 'fixture:synthetic-burst-sp',
          applied: true,
        },
      ],
    },
  };
}

function createResolution({ controlSkillId, hits, effects = [] }) {
  return {
    ready: true,
    packageId: 'synthetic-target-state-package',
    actionBinding: {
      identity: `synthetic-action-${controlSkillId}`,
      controlSkillId,
      selectedSubSkillIndex: 0,
    },
    hits,
    effects,
  };
}

function createConditionedEffect(effectIdentity, condition) {
  return {
    effectIdentity,
    elementId: 9009,
    trigger: { startFrame: 0 },
    targetStateActivationCondition: condition,
    classification: 'applied',
    applied: true,
  };
}

function createHit(elementId, startFrame, conditionalGroupIdentity = null) {
  return {
    elementId,
    conditionalGroupIdentity,
    trigger: {
      startFrame,
    },
  };
}

function createAction(id, startMs) {
  return {
    id,
    name: id,
    startMs,
    actorId: 'actor-1',
    actor: {
      id: 'actor-1',
      characterId: 424242,
      name: 'Synthetic Owner',
    },
  };
}
