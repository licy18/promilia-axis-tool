import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedActionVariantRuntime } from '../../simulation/mechanics/verifiedActionVariantRuntime';

const RUBY_ID = 103002;
const JADE_ID = 101010;
const CHARGED_INPUT_OWNER_ID = 107003;
const RUBY_NORMAL_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === RUBY_ID && mapping.actionKind === 'normal-attack'
);
const RUBY_A5 = RUBY_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 5
);

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('verified action variant and special resource runtime', () => {
  it('resolves a semantic charge-tier selection without using array order', () => {
    const action = createActorAction({
      id: 'charge-tier-three',
      characterId: CHARGED_INPUT_OWNER_ID,
      skillId: 10700301,
      actionVariantIndex: 1,
      startMs: 0,
      variantInputSelection: {
        schemaVersion: 1,
        selectorIdentity: 'actor:107003|control:10700310|public-variant:3',
        selectorKind: 'charge-tier',
        publicVariantIndex: 3,
        chargeTier: 3,
        mode: 'hold',
      },
    });
    const runtime = runVariantRuntime({
      actors: [action.actor],
      actions: [action],
      durationMs: 10_000,
    });

    expect(runtime.selectionByActionId.get(action.id)).toMatchObject({
      ownerId: CHARGED_INPUT_OWNER_ID,
      controlSkillId: 10700310,
      selectedSubSkillIndex: 2,
      selectedInputIdentity: 'actor:107003|control:10700310|public-variant:3',
      sourceKind: 'workbench-semantic-input-variant',
      actualDurationFrames: 416,
      status: 'verified-action-variant-selection-ready',
    });
    expect(runtime.actionResolutionById.get(action.id)).toMatchObject({
      ready: true,
      actionBinding: {
        selectedSubSkillIndex: 2,
        actualDurationFrames: 416,
        variantSelection: {
          selectedSubSkillIndex: 2,
          sourceKind: 'workbench-semantic-input-variant',
        },
      },
    });
  });

  it('uses Ruby source frames for gains and blocks a consuming input before execution', () => {
    const ultimate = createActorAction({
      id: 'ruby-ultimate',
      characterId: RUBY_ID,
      skillId: 10300213,
      startMs: 0,
    });
    const gainRuntime = runVariantRuntime({
      actors: [ultimate.actor],
      actions: [ultimate],
      durationMs: 3000,
    });

    expect(gainRuntime.resourceEvents).toHaveLength(1);
    expect(gainRuntime.resourceEvents[0]).toMatchObject({
      actionId: 'ruby-ultimate',
      payload: {
        resourceIdentity: 'actor:103002:element:103002047',
        resourceName: '子弹',
        operation: 'gain',
        beforeValue: 0,
        change: 12,
        afterValue: 12,
        maxValue: 12,
        appliedToActionVariantRuntime: true,
        appliedToCalculators: false,
      },
    });
    expect(gainRuntime.resourceEvents[0].timeMs).toBeCloseTo(frameTime(113), 8);
    expect(gainRuntime.curves[0]).toMatchObject({
      characterId: RUBY_ID,
      initialValue: 0,
      currentValue: 12,
      maxValue: 12,
      pointCount: 1,
    });

    const attack = createActorAction({
      id: 'ruby-a5',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: 0,
      attackInput: RUBY_A5,
    });
    const blocked = runVariantRuntime({
      actors: [attack.actor],
      actions: [attack],
      durationMs: 1000,
    });

    expect(blocked.executionBlocks).toEqual([
      expect.objectContaining({
        code: 'VERIFIED_SPECIAL_RESOURCE_INSUFFICIENT',
        actionId: 'ruby-a5',
        controlSkillId: 10300205,
        selectedSubSkillIndex: 0,
        resourceIdentity: 'actor:103002:element:103002047',
        requiredValue: 1,
        currentValue: 0,
        maxValue: 12,
      }),
    ]);
    expect(blocked.resourceEvents).toEqual([]);

    const allowed = runVariantRuntime({
      actors: [attack.actor],
      actions: [attack],
      durationMs: 1000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: attack.actorId,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 1,
          },
        ],
      },
    });
    expect(allowed.executionBlocks).toEqual([]);
    expect(allowed.resourceEvents[0]).toMatchObject({
      timeMs: 0,
      actionId: 'ruby-a5',
      payload: {
        operation: 'consume',
        beforeValue: 1,
        change: -1,
        afterValue: 0,
      },
    });
  });

  it('projects Jade gains, transformation, and the selected charged variant at exact frames', () => {
    const limitCounter = createActorAction({
      id: 'jade-limit-counter',
      characterId: JADE_ID,
      skillId: 10101021,
      actionVariantIndex: 1,
      startMs: 0,
    });
    const ultimate = createActorAction({
      id: 'jade-ultimate',
      characterId: JADE_ID,
      skillId: 10101013,
      startMs: 5000,
    });
    const charged = createActorAction({
      id: 'jade-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: 10000,
    });
    const genericActor = {
      id: 'actor-101007',
      characterId: 101007,
      name: '芃芃',
    };
    const runtime = runVariantRuntime({
      actors: [limitCounter.actor, genericActor],
      actions: [limitCounter, ultimate, charged],
      durationMs: 21000,
    });

    const gains = runtime.resourceEvents.filter(
      event => event.payload.operation === 'gain'
    );
    expect(gains).toHaveLength(8);
    expect(gains.map(event => event.timeMs)).toEqual(
      [15, 21, 27, 33, 39, 45, 51, 57].map(frameTime)
    );
    expect(gains.map(event => event.payload.afterValue)).toEqual([
      4, 8, 12, 16, 20, 24, 28, 32,
    ]);

    expect(
      runtime.resourceEvents.find(
        event =>
          event.actionId === 'jade-ultimate' &&
          event.payload.operation === 'clear'
      )
    ).toMatchObject({
      timeMs: 9400,
      payload: { beforeValue: 32, change: -32, afterValue: 0 },
    });
    expect(
      runtime.stateEvents.find(
        event =>
          event.actionId === 'jade-ultimate' &&
          event.payload.operation === 'transform'
      )
    ).toMatchObject({
      timeMs: 5000 + frameTime(272),
      payload: {
        stateElementId: 101010129,
        stateDurationMs: 10000,
      },
    });
    expect(runtime.selectionByActionId.get('jade-charged')).toMatchObject({
      controlSkillId: 10101010,
      selectedSubSkillIndex: 2,
      sourceKind: 'verified-active-switch-skill-index-window',
      status: 'verified-action-variant-selection-ready',
    });
    expect(
      runtime.actionResolutionById.get('jade-charged')?.variantSelection
    ).toMatchObject({
      selectedSubSkillIndex: 2,
      changed: true,
      status: 'verified-action-variant-selected',
    });
    expect(runtime.curves).toHaveLength(1);
    expect(runtime.curves[0]).toMatchObject({
      actorId: 'actor-101010',
      characterId: JADE_ID,
      initialValue: 0,
      currentValue: 0,
      maxValue: 100,
    });
    expect(runtime.summary.changedVariantCount).toBe(1);
  });

  it('rebuilds inherited state windows and expires them without adding empty generic lanes', () => {
    const jade = {
      id: 'actor-101010',
      characterId: JADE_ID,
      name: '涂山小玉',
    };
    const generic = {
      id: 'actor-101007',
      characterId: 101007,
      name: '芃芃',
    };
    const charged = createActorAction({
      id: 'inherited-jade-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: 500,
    });
    const initialRuntimeState = {
      specialResourcesByActor: [
        {
          actorId: jade.id,
          resourceIdentity: 'actor:101010:element:101010115',
          currentValue: 24,
          activeStates: [
            {
              elementId: 101010129,
              name: '爆发状态buff',
              remainingDurationMs: 1000,
              sourceActionId: 'previous-cycle-ultimate',
              sourceIdentity: 'battle-element:101010129',
            },
          ],
        },
      ],
    };
    const selected = runVariantRuntime({
      actors: [jade, generic],
      actions: [charged],
      durationMs: 2000,
      initialRuntimeState,
    });

    expect(selected.curves).toHaveLength(1);
    expect(selected.selectionByActionId.get(charged.id)).toMatchObject({
      selectedSubSkillIndex: 2,
      sourceKind: 'verified-active-switch-skill-index-window',
    });

    const expired = runVariantRuntime({
      actors: [jade, generic],
      actions: [],
      durationMs: 2000,
      initialRuntimeState,
    });
    expect(expired.curves).toHaveLength(1);
    expect(expired.stateEvents).toEqual([
      expect.objectContaining({
        type: 'VERIFIED_SPECIAL_RESOURCE_STATE_EXPIRED',
        timeMs: 1000,
        actorId: jade.id,
        payload: expect.objectContaining({
          operation: 'expire',
          stateElementId: 101010129,
        }),
      }),
    ]);
    expect(expired.finalState[0].activeStates).toEqual([]);
  });

  it('drives the compiled combat runtime and projected curve from the selected variant', () => {
    const teamSlots = [
      { slotId: 'team-slot-1', position: 0, characterId: JADE_ID },
      { slotId: 'team-slot-2', position: 1, characterId: 101007 },
      { slotId: 'team-slot-3', position: 2, characterId: 101003 },
    ];
    const selection = {
      ...DEFAULT_WORKBENCH_SELECTION,
      characterId: JADE_ID,
      secondaryCharacterId: 101007,
    };
    const actorConfigs = normalizeWorkbenchActorConfigs(
      [],
      selection,
      teamSlots
    );
    const action = createWorkbenchActionDraft({
      id: 'compiled-jade-charged',
      type: 'skill',
      actorCharacterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: 0,
      durationMs: 1000,
    });
    const project = createWorkbenchProject(selection, {
      durationMs: 4000,
      teamSlots,
      actorConfigs,
      actions: [action],
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: `actor-${JADE_ID}`,
            resourceIdentity: 'actor:101010:element:101010115',
            currentValue: 24,
            activeStates: [
              {
                elementId: 101010129,
                name: '爆发状态buff',
                remainingDurationMs: 3000,
                sourceActionId: 'previous-cycle-ultimate',
                sourceIdentity: 'battle-element:101010129',
              },
            ],
          },
        ],
      },
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    });
    const result = simulateScenario(
      compileProject(project, getWorkbenchGameData())
    );

    expect(result.actionExecutionPlan.executedActionIds).toContain(action.id);
    expect(
      result.verifiedCombatRuntime.actionResolutionById.get(action.id)
    ).toMatchObject({
      ready: true,
      variantSelection: {
        selectedSubSkillIndex: 2,
        changed: true,
      },
    });
    expect(
      result.verifiedCombatRuntime.specialResourceRuntime.resourceEvents[0]
    ).toMatchObject({
      timeMs: 0,
      actionId: action.id,
      payload: {
        operation: 'clear',
        beforeValue: 24,
        afterValue: 0,
      },
    });
    expect(
      result.verifiedCombatRuntime.damageEvents.filter(
        event => event.actionId === action.id
      ).length
    ).toBeGreaterThan(0);
    expect(
      result.runtimeOutputs.stateCurves.resources.curvesBySpecialResource
    ).toEqual([
      expect.objectContaining({
        actorId: `actor-${JADE_ID}`,
        characterId: JADE_ID,
        initialValue: 24,
        currentValue: 0,
        maxValue: 100,
      }),
    ]);
    expect(result.runtimeOutputs.resources).toBe(
      result.runtimeOutputs.resourceCurves
    );
    expect(result.runtimeOutputs.resources.curvesBySpecialResource).toBe(
      result.runtimeOutputs.stateCurves.resources.curvesBySpecialResource
    );
  });
});

function createActorAction({
  id,
  characterId,
  skillId,
  actionVariantIndex = 0,
  startMs = 0,
  attackInput = null,
  variantInputSelection = null,
}) {
  const actor = {
    id: `actor-${characterId}`,
    characterId,
    name: characterId === RUBY_ID ? '红宝石' : '涂山小玉',
  };
  return {
    id,
    type: 'skill',
    name: id,
    actorId: actor.id,
    actor,
    skillId,
    skillLevel: 1,
    actionVariantIndex,
    startMs,
    durationMs: 1000,
    variantInputSelection,
    ...(attackInput
      ? {
          attackGroupId: `${id}-group`,
          attackSequenceIndex: attackInput.sequenceIndex,
          attackSequenceTotal: attackInput.sequenceTotal,
          attackInput,
        }
      : {}),
  };
}

function runVariantRuntime({
  actors,
  actions,
  durationMs,
  initialRuntimeState = null,
}) {
  return createVerifiedActionVariantRuntime({
    scenario: {
      time: { durationMs, fps: 60 },
      actors,
      actions,
      initialRuntimeState,
    },
    actionExecutionPlan: {
      actions: actions.map(action => ({
        actionId: action.id,
        execute: true,
      })),
    },
  });
}

function frameTime(frame) {
  return (frame * 1000) / 60;
}
