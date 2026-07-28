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
      actionResolutionById
        .get('burst-applied')
        .hits.map(hit => hit.elementId)
    ).toEqual([9002, 9003]);
    expect(
      actionResolutionById
        .get('burst-skipped')
        .hits.map(hit => hit.elementId)
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

function createResolution({ controlSkillId, hits }) {
  return {
    ready: true,
    packageId: 'synthetic-target-state-package',
    actionBinding: {
      identity: `synthetic-action-${controlSkillId}`,
      controlSkillId,
      selectedSubSkillIndex: 0,
    },
    hits,
    effects: [],
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
