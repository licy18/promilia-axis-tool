import { describe, expect, it } from 'vitest';
import {
  VerifiedActionLevelContractError,
  resolveVerifiedActionLevel,
} from '../../domain/verifiedActionLevel';
import { applyVerifiedTargetStateRuntime } from '../../simulation/mechanics/verifiedTargetStateRuntime';

describe('verified target-state runtime', () => {
  it('matches and offsets the selected execution control inside a charged wrapper', () => {
    const packageFixture = createMechanicsPackage();
    const gain = createResolution({
      controlSkillId: 424201,
      hits: [createHit(9001, 5)],
    });
    const burst = createResolution({
      controlSkillId: 424299,
      hits: [createHit(9002, 68, 'synthetic-firework-burst')],
    });
    burst.chargingRelease = {
      applied: true,
      executionControlSkillId: 424202,
      executionSubSkillIndex: 0,
      releaseFrame: 67,
    };
    burst.actionBinding.actualDurationFrames = 92;

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 5000 },
        actors: [
          {
            id: 'actor-1',
            characterId: 424242,
            name: 'Synthetic Owner',
          },
        ],
        enemy: { id: 'enemy-1', name: 'Synthetic Enemy' },
        actions: [createAction('gain', 0), createAction('burst', 1000)],
      },
      actionResolutionById: new Map([
        ['gain', gain],
        ['burst', burst],
      ]),
      mechanicsPackage: packageFixture,
    });

    expect(result.groupResults).toEqual([
      expect.objectContaining({
        actionId: 'burst',
        controlSkillId: 424202,
        beforeStacks: 1,
        applied: true,
        timeMs: 2116.666667,
      }),
    ]);
    expect(result.directSpEvents).toEqual([
      expect.objectContaining({
        actionId: 'burst',
        timeMs: 2133.333333,
        value: 2,
      }),
    ]);
  });

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
      result.effectCommands.find(
        command =>
          command.sourceActionId === 'gain' &&
          command.effectId === 'battle-element:9000'
      )
    ).toMatchObject({
      sourceStatus: 'verified-target-state-effect-generated',
      appliedToCalculators: true,
      sourceIdentity: {
        packageId: 'synthetic-target-state-package',
        packageHash: 'synthetic-target-state-hash',
        elementId: 9000,
      },
      modifiers: [
        {
          kind: 'battle-property',
          attributeId: 3,
          bucket: 'dynamicPercent',
          valueRaw: -1000,
        },
      ],
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
        command.effectId === 'battle-element:9000' &&
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

  it('emits refresh rather than apply when a capped state refreshes its oldest layer', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateProfiles[0] = {
      ...mechanicsPackage.actionVariantGraph.targetStateProfiles[0],
      maxStacks: 1,
      atCapacityPolicy: 'refresh-oldest',
    };
    const actionResolutionById = new Map(
      ['first', 'second'].map(actionId => [
        actionId,
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ])
    );

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 12000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [createAction('first', 0), createAction('second', 1000)],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(
      result.effectCommands.map(command => [
        command.sourceActionId,
        command.operation,
      ])
    ).toEqual([
      ['first', 'apply'],
      ['second', 'refresh'],
    ]);
  });

  it('does not leak unrelated owner profiles or runtime bindings into the active roster', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateProfiles.push({
      ownerId: 999999,
      stateIdentity: 'enemy:unrelated-owner-state',
      name: 'Unrelated Owner State',
      targetKind: 'enemy',
      durationMs: 10000,
      maxStacks: 1,
      runtimeOwnerScope: 'scenario-roster',
      applied: true,
    });
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings.push({
      ...mechanicsPackage.actionVariantGraph.runtimeEffectBindings[0],
      ownerId: 999999,
      bindingIdentity: 'unrelated-owner-runtime-binding',
      triggerKind: 'action-frame',
      conditionalGroupIdentity: null,
      controlSkillId: 424201,
      subSkillIndex: 0,
      triggerFrame: 5,
      runtimeOwnerScope: 'scenario-roster',
      effectId: 'battle-element:999999',
      sourceIdentity: 'fixture:unrelated-owner-runtime-binding',
    });
    const actionResolutionById = new Map([
      [
        'gain',
        createResolution({
          controlSkillId: 424201,
          hits: [createHit(9001, 5)],
        }),
      ],
    ]);

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 1000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [createAction('gain', 0)],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(result.summary.profileCount).toBe(1);
    expect(
      result.finalState.some(
        state => state.stateIdentity === 'enemy:unrelated-owner-state'
      )
    ).toBe(false);
    expect(
      result.effectCommands.some(
        command => command.effectId === 'battle-element:999999'
      )
    ).toBe(false);
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

  it('emits generic landed-hit direct SP once per landed hit and rejects misses or interrupted hits', () => {
    const mechanicsPackage = createLandedHitMechanicsPackage();
    const actionResolutionById = new Map(
      ['all-land', 'last-only', 'all-miss', 'interrupted'].map(actionId => [
        actionId,
        createResolution({
          controlSkillId: 424204,
          hits: [
            createVerifiedHit('synthetic-hit-1', 9101, 1, 5),
            createVerifiedHit('synthetic-hit-2', 9102, 2, 10),
          ],
        }),
      ])
    );
    const allLand = createAction('all-land', 0, 0);
    const lastOnly = {
      ...createAction('last-only', 1000, 1),
      hitOverrides: {
        'synthetic-hit-1': { willHit: false },
      },
    };
    const allMiss = {
      ...createAction('all-miss', 2000, 2),
      hitOverrides: {
        'synthetic-hit-1': { willHit: false },
        'synthetic-hit-2': { willHit: false },
      },
    };
    const interrupted = {
      ...createAction('interrupted', 3000, 3),
      contextualEffectiveEndMs: 3100,
    };

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 5000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [allLand, lastOnly, allMiss, interrupted],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(
      result.directSpEvents.map(event => [
        event.actionId,
        event.triggerHitIdentity,
        event.value,
        event.sourceSequencePath,
      ])
    ).toEqual([
      ['all-land', 'synthetic-hit-1', 0.5, [0, 1, 30, 0, 0]],
      ['all-land', 'synthetic-hit-2', 0.5, [0, 2, 30, 0, 0]],
      ['last-only', 'synthetic-hit-2', 0.5, [1, 2, 30, 0, 0]],
      ['interrupted', 'synthetic-hit-1', 0.5, [3, 1, 30, 0, 0]],
    ]);
    expect(
      result.events
        .filter(
          event =>
            event.type ===
            'VERIFIED_RUNTIME_EFFECT_LANDED_HIT_CONDITION_NOT_MET'
        )
        .map(event => [
          event.actionId,
          event.payload.hitIdentity,
          event.payload.withinOccupancy,
        ])
    ).toEqual([
      ['last-only', 'synthetic-hit-1', true],
      ['all-miss', 'synthetic-hit-1', true],
      ['all-miss', 'synthetic-hit-2', true],
      ['interrupted', 'synthetic-hit-2', false],
    ]);
    expect(result.summary.directSpEventCount).toBe(4);
  });

  it('gates action effects on the exact same-action landed hit without owner-specific logic', () => {
    const mechanicsPackage = createLandedHitMechanicsPackage();
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings = [];
    const condition = createLandedHitCondition('synthetic-hit-1', 9101, 1, 5);
    const actionResolutionById = new Map(
      ['landed', 'missed', 'interrupted'].map(actionId => [
        actionId,
        createResolution({
          controlSkillId: 424204,
          hits: [createVerifiedHit('synthetic-hit-1', 9101, 1, 5)],
          effects: [createLandedHitConditionedEffect(actionId, condition)],
        }),
      ])
    );
    const landed = createAction('landed', 0, 0);
    const missed = {
      ...createAction('missed', 1000, 1),
      hitOverrides: { 'synthetic-hit-1': { willHit: false } },
    };
    const interrupted = {
      ...createAction('interrupted', 2000, 2),
      contextualEffectiveEndMs: 2050,
    };

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 3000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [landed, missed, interrupted],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(actionResolutionById.get('landed').effects).toHaveLength(1);
    expect(actionResolutionById.get('missed').effects).toEqual([]);
    expect(actionResolutionById.get('interrupted').effects).toEqual([]);
    expect(
      result.actionHitActivationResults.map(entry => [
        entry.actionId,
        entry.applied,
        entry.reason,
      ])
    ).toEqual([
      ['landed', true, 'same-action-hit-landed'],
      ['missed', false, 'same-action-hit-missed'],
      ['interrupted', false, 'same-action-hit-outside-effective-occupancy'],
    ]);
  });

  it('selects a generic runtime property value from the action skill level', () => {
    const mechanicsPackage = createLandedHitMechanicsPackage();
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings = [
      {
        ownerId: 424242,
        bindingIdentity: 'synthetic-level-scaled-property',
        triggerKind: 'action-frame',
        controlSkillId: 424205,
        subSkillIndex: 0,
        triggerFrame: 1,
        frameRate: 60,
        targetKind: 'source-actor',
        effectId: 'battle-element:9120',
        effectName: 'Synthetic Level-scaled Property',
        durationMs: 6000,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: 22,
            bucket: 'dynamicExtra',
            valueRaw: 1900,
            valueRawByLevel: { 1: 1900, 12: 3000 },
            propertyTags: [],
          },
        ],
        directSp: null,
        sourceIdentity: 'fixture:synthetic-level-scaled-property',
        applied: true,
      },
    ];
    const levelOne = {
      ...createAction('level-one', 0, 0),
      level: 1,
    };
    const levelTwelve = {
      ...createAction('level-twelve', 1000, 1),
      level: 12,
    };
    const actionResolutionById = new Map(
      ['level-one', 'level-twelve'].map(actionId => [
        actionId,
        createResolution({ controlSkillId: 424205, hits: [] }),
      ])
    );

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 8000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [levelOne, levelTwelve],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(
      result.effectCommands.map(command => [
        command.sourceActionId,
        command.modifiers[0].valueRaw,
      ])
    ).toEqual([
      ['level-one', 1900],
      ['level-twelve', 3000],
    ]);
  });

  it('evaluates a source-stat property formula from the selected action alias and fails without its stat', () => {
    const mechanicsPackage = createLandedHitMechanicsPackage();
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings = [
      {
        ownerId: 424242,
        bindingIdentity: 'synthetic-source-stat-property',
        triggerKind: 'action-frame',
        controlSkillId: 424206,
        subSkillIndex: 0,
        triggerFrame: 1,
        frameRate: 60,
        targetKind: 'team-allies',
        effectId: 'battle-element:9121',
        effectName: 'Synthetic Source Attack Ratio',
        durationMs: 24000,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
        modifiers: [
          {
            kind: 'battle-property',
            attributeId: 1,
            bucket: 'dynamicExtra',
            valueRaw: 1100,
            valueRawByLevel: { 1: 1100, 12: 2200 },
            sourceStatFormula: {
              formulaId: 2001,
              expression: '(self.ATK[4]*A)/10000',
              sourceStatKey: 'attack',
              divisor: 10000,
            },
            propertyTags: [],
          },
        ],
        directSp: null,
        sourceIdentity: 'fixture:synthetic-source-stat-property',
        applied: true,
      },
    ];
    const levelOne = {
      ...createAction('source-stat-level-one', 0, 0),
      level: 1,
    };
    levelOne.actor.stats = { attack: 1000 };
    const levelTwelve = {
      ...createAction('source-stat-level-twelve', 1000, 1),
      level: 12,
    };
    levelTwelve.actor.stats = { attack: 1000 };
    const actionResolutionById = new Map(
      [levelOne, levelTwelve].map(action => [
        action.id,
        createResolution({ controlSkillId: 424206, hits: [] }),
      ])
    );

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 26000 },
        actors: [
          { id: 'actor-1', characterId: 424242 },
          { id: 'actor-2', characterId: 424244 },
        ],
        enemy: { id: 'enemy-1' },
        actions: [levelOne, levelTwelve],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(
      result.effectCommands.map(command => [
        command.sourceActionId,
        command.targetId,
        command.modifiers[0].valueRaw,
        command.modifiers[0].formulaEvaluation.sourceActorId,
      ])
    ).toEqual([
      ['source-stat-level-one', 'actor-2', 110, 'actor-1'],
      ['source-stat-level-twelve', 'actor-2', 220, 'actor-1'],
    ]);

    const missingStatAction = createAction('source-stat-missing', 0);
    expect(() =>
      applyVerifiedTargetStateRuntime({
        scenario: {
          time: { durationMs: 1000 },
          actors: [
            { id: 'actor-1', characterId: 424242 },
            { id: 'actor-2', characterId: 424244 },
          ],
          enemy: { id: 'enemy-1' },
          actions: [missingStatAction],
        },
        actionResolutionById: new Map([
          [
            missingStatAction.id,
            createResolution({ controlSkillId: 424206, hits: [] }),
          ],
        ]),
        mechanicsPackage,
      })
    ).toThrow(/source-stat formula input missing/);
  });

  it('runs periodic direct effects without target-state profiles and truncates the old interval on refresh', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateProfiles = [];
    mechanicsPackage.actionVariantGraph.targetStateTransactions = [];
    mechanicsPackage.actionVariantGraph.conditionalHitGroups = [];
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings = [
      {
        ownerId: 424242,
        bindingIdentity: 'synthetic-periodic-sp',
        triggerKind: 'action-periodic',
        controlSkillId: 424204,
        subSkillIndex: 0,
        triggerFrame: 0,
        frameRate: 60,
        targetKind: 'source-actor',
        effectId: 'battle-element:9010',
        effectName: 'Synthetic Periodic SP',
        durationMs: 10000,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
        modifiers: [],
        directSp: {
          elementId: 9010,
          value: 2,
          enhanceable: false,
          shareType: 2,
          stopSharing: false,
          sourceIdentity: 'fixture:synthetic-periodic-sp',
        },
        periodic: {
          durationMs: 10000,
          intervalMs: 1000,
          firstTickFrameOffset: 1,
          applied: true,
        },
        sourceIdentity: 'fixture:synthetic-periodic-sp',
        applied: true,
      },
    ];
    const actionResolutionById = new Map([
      [
        'periodic-first',
        createResolution({ controlSkillId: 424204, hits: [] }),
      ],
      [
        'periodic-refresh',
        createResolution({ controlSkillId: 424204, hits: [] }),
      ],
    ]);
    const first = createAction('periodic-first', 0);
    const refresh = createAction('periodic-refresh', 5000);
    first.sourceSequencePath = [0];
    refresh.sourceSequencePath = [1];

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 16000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [first, refresh],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(result.status).toBe('verified-target-state-runtime-ready');
    expect(result.summary.profileCount).toBe(0);
    expect(result.directSpEvents).toHaveLength(15);
    expect(
      result.directSpEvents.map(event => [
        event.actionId,
        event.timeMs,
        event.value,
      ])
    ).toEqual([
      ['periodic-first', 16.666667, 2],
      ['periodic-first', 1016.666667, 2],
      ['periodic-first', 2016.666667, 2],
      ['periodic-first', 3016.666667, 2],
      ['periodic-first', 4016.666667, 2],
      ['periodic-refresh', 5016.666667, 2],
      ['periodic-refresh', 6016.666667, 2],
      ['periodic-refresh', 7016.666667, 2],
      ['periodic-refresh', 8016.666667, 2],
      ['periodic-refresh', 9016.666667, 2],
      ['periodic-refresh', 10016.666667, 2],
      ['periodic-refresh', 11016.666667, 2],
      ['periodic-refresh', 12016.666667, 2],
      ['periodic-refresh', 13016.666667, 2],
      ['periodic-refresh', 14016.666667, 2],
    ]);
    expect(
      new Set(result.directSpEvents.map(event => event.eventIdentity)).size
    ).toBe(15);
    expect(
      result.directSpEvents.every(event => event.appliedToCalculators)
    ).toBe(true);
  });

  it('emits a hit-gated direct effect only for the landed source hit', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateProfiles = [];
    mechanicsPackage.actionVariantGraph.targetStateTransactions = [];
    mechanicsPackage.actionVariantGraph.conditionalHitGroups = [];
    mechanicsPackage.actionVariantGraph.runtimeEffectBindings = [
      {
        ownerId: 424242,
        bindingIdentity: 'synthetic-final-hit-sp',
        triggerKind: 'action-hit-landed',
        controlSkillId: 424205,
        subSkillIndex: 0,
        triggerFrame: 118,
        frameRate: 60,
        targetKind: 'source-actor',
        effectId: 'battle-element:9011',
        effectName: 'Synthetic Final Hit SP',
        durationMs: null,
        stackMode: 'refresh',
        stackDelta: 1,
        maxStacks: 1,
        modifiers: [],
        directSp: {
          elementId: 9011,
          value: 5,
          enhanceable: false,
          shareType: 0,
          stopSharing: true,
          sourceIdentity: 'fixture:synthetic-final-hit-sp',
        },
        requiredHitElementId: 9003,
        requiredHitFrame: 118,
        sourceIdentity: 'fixture:synthetic-final-hit-sp',
        applied: true,
      },
    ];
    const landedHit = {
      ...createHit(9003, 118),
      hitIdentity: 'synthetic-final-hit',
    };
    const actionResolutionById = new Map([
      [
        'landed',
        createResolution({ controlSkillId: 424205, hits: [landedHit] }),
      ],
      [
        'missed',
        createResolution({ controlSkillId: 424205, hits: [landedHit] }),
      ],
    ]);
    const landed = createAction('landed', 0);
    const missed = createAction('missed', 3000);
    landed.sourceSequencePath = [0];
    missed.sourceSequencePath = [1];
    missed.hitOverrides = { 'synthetic-final-hit': { willHit: false } };

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 6000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [landed, missed],
      },
      actionResolutionById,
      mechanicsPackage,
    });

    expect(result.directSpEvents).toEqual([
      expect.objectContaining({
        actionId: 'landed',
        timeMs: 1966.666667,
        value: 5,
        appliedToCalculators: true,
      }),
    ]);
    expect(
      result.events.find(
        event => event.type === 'VERIFIED_RUNTIME_EFFECT_HIT_CONDITION_NOT_MET'
      )
    ).toMatchObject({
      actionId: 'missed',
      payload: {
        requiredHitElementId: 9003,
        requiredHitFrame: 118,
        reason: 'required-source-hit-not-landed',
        applied: false,
      },
    });
  });

  it('uses canonical action.level, documents the legacy fallback, and fails closed on explicit invalid or conflicting levels', () => {
    expect(resolveVerifiedActionLevel({ level: 12 })).toEqual({
      level: 12,
      source: 'action.level',
      legacyFallback: false,
    });
    expect(resolveVerifiedActionLevel({ skillLevel: 12 })).toEqual({
      level: 12,
      source: 'action.skillLevel',
      legacyFallback: true,
    });
    expect(resolveVerifiedActionLevel({})).toEqual({
      level: 1,
      source: 'verified-action-level-default',
      legacyFallback: false,
    });
    expect(resolveVerifiedActionLevel({ level: 12, skillLevel: 12 })).toEqual({
      level: 12,
      source: 'action.level',
      legacyFallback: false,
      legacyLevelStatus: 'consistent',
    });

    for (const [action, code] of [
      [{ level: 12, skillLevel: 1 }, 'verified-action-level-conflict'],
      [{ level: 0 }, 'verified-action-level-invalid'],
      [{ level: 13 }, 'verified-action-level-invalid'],
      [{ level: 'invalid' }, 'verified-action-level-invalid'],
      [{ level: '12' }, 'verified-action-level-invalid'],
      [{ level: '' }, 'verified-action-level-invalid'],
      [{ level: true }, 'verified-action-level-invalid'],
      [{ level: 1.5 }, 'verified-action-level-invalid'],
      [{ level: 0, skillLevel: 12 }, 'verified-action-level-invalid'],
      [{ skillLevel: 0 }, 'verified-action-level-invalid'],
    ]) {
      let failure = null;
      try {
        resolveVerifiedActionLevel(action);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBeInstanceOf(VerifiedActionLevelContractError);
      expect(failure).toMatchObject({ code });
    }
  });

  it('orders a hit-gated calculator state after its triggering hit', () => {
    const mechanicsPackage = createMechanicsPackage();
    mechanicsPackage.actionVariantGraph.targetStateTransactions[0] = {
      ...mechanicsPackage.actionVariantGraph.targetStateTransactions[0],
      hitSettlementOrder: 'after-hit',
    };
    const requiredHit = {
      ...createHit(9001, 5),
      hitIdentity: 'synthetic-ordered-hit',
      hitIndex: 6,
    };
    const resolution = createResolution({
      controlSkillId: 424201,
      hits: [requiredHit],
    });
    resolution.allHits = [requiredHit];
    const action = {
      ...createAction('gain-after-hit', 0),
      sourceSequenceIndex: 4,
      sourceSequencePath: [4],
    };

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 12000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [action],
      },
      actionResolutionById: new Map([['gain-after-hit', resolution]]),
      mechanicsPackage,
    });

    expect(result.effectCommands[0]).toMatchObject({
      sourceSequencePath: [4, 6, 2],
      sourceIdentity: {
        sameFrameVisibility: 'strict-source-sequence',
        triggerSequencePath: [4, 6, 2],
      },
      appliedToCalculators: true,
    });
  });

  it('does not apply or refresh a hit-gated state when the required hit is overridden to miss', () => {
    const requiredHit = {
      ...createHit(9001, 5),
      hitIdentity: 'synthetic-required-hit',
    };
    const resolution = createResolution({
      controlSkillId: 424201,
      hits: [requiredHit],
    });
    resolution.allHits = [requiredHit];
    const action = createAction('gain-missed', 0);
    action.hitOverrides = {
      'synthetic-required-hit': { willHit: false },
    };

    const result = applyVerifiedTargetStateRuntime({
      scenario: {
        time: { durationMs: 12000 },
        actors: [{ id: 'actor-1', characterId: 424242 }],
        enemy: { id: 'enemy-1' },
        actions: [action],
      },
      actionResolutionById: new Map([['gain-missed', resolution]]),
      mechanicsPackage: createMechanicsPackage(),
    });

    expect(result.events).toEqual([]);
    expect(result.effectCommands).toEqual([]);
    expect(result.finalState[0]).toMatchObject({
      stateIdentity: 'enemy:synthetic-firework',
      currentValue: 0,
    });
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
          elementId: 9000,
          durationMs: 10000,
          maxStacks: 3,
          modifiers: [
            {
              kind: 'battle-property',
              attributeId: 3,
              bucket: 'dynamicPercent',
              valueRaw: -1000,
              sourceIdentity: 'fixture:synthetic-target-state-defense',
            },
          ],
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

function createLandedHitMechanicsPackage() {
  return {
    packageId: 'synthetic-landed-hit-package',
    packageHash: 'synthetic-landed-hit-hash',
    actionVariantGraph: {
      targetStateProfiles: [],
      targetStateTransactions: [],
      conditionalHitGroups: [],
      runtimeEffectBindings: [
        {
          ownerId: 424242,
          bindingIdentity: 'synthetic-landed-hit-sp',
          triggerKind: 'landed-hit',
          controlSkillId: 424204,
          subSkillIndex: 0,
          triggerFrame: 5,
          frameRate: 60,
          hitBindings: [
            createLandedHitBinding('synthetic-hit-1', 9101, 1, 5),
            createLandedHitBinding('synthetic-hit-2', 9102, 2, 10),
          ],
          targetKind: 'source-actor',
          effectId: 'skill-value:424262',
          effectName: 'Synthetic Per-hit SP',
          durationMs: null,
          stackMode: 'refresh',
          stackDelta: 1,
          maxStacks: 1,
          modifiers: [],
          directSp: {
            elementId: null,
            value: 0.5,
            enhanceable: false,
            shareType: 0,
            sourceSkillId: 424262,
            sourceIdentity: 'fixture:skill:424262:value:0.5',
          },
          sourceIdentity: 'fixture:synthetic-landed-hit-sp',
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

function createLandedHitConditionedEffect(effectIdentity, condition) {
  return {
    effectIdentity,
    elementId: 9110,
    trigger: { startFrame: 5 },
    landedHitActivationCondition: condition,
    classification: 'applied',
    applied: true,
  };
}

function createLandedHitCondition(hitIdentity, elementId, hitIndex, frame) {
  return {
    kind: 'same-action-hit-landed',
    hitIdentity,
    elementId,
    pathId: `synthetic-path-${hitIndex}`,
    hitIndex,
    triggerFrame: frame,
    behaviorPathId: `synthetic-behavior-${hitIndex}`,
    sourceIdentity: `fixture:${hitIdentity}:landed-condition`,
    applied: true,
  };
}

function createLandedHitBinding(hitIdentity, elementId, hitIndex, frame) {
  return {
    ...createLandedHitCondition(hitIdentity, elementId, hitIndex, frame),
    status: 'verified-runtime-landed-hit-selector-ready',
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

function createVerifiedHit(hitIdentity, elementId, hitIndex, startFrame) {
  return {
    hitIdentity,
    hitIndex,
    elementId,
    pathId: `synthetic-path-${hitIndex}`,
    trigger: {
      startFrame,
      behaviorPathId: `synthetic-behavior-${hitIndex}`,
    },
  };
}

function createAction(id, startMs, sourceSequenceIndex = null) {
  return {
    id,
    name: id,
    startMs,
    ...(sourceSequenceIndex == null
      ? {}
      : {
          sourceSequenceIndex,
          sourceSequencePath: [sourceSequenceIndex],
        }),
    actorId: 'actor-1',
    actor: {
      id: 'actor-1',
      characterId: 424242,
      name: 'Synthetic Owner',
    },
  };
}
