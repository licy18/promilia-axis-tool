import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import xiaoyuActionOccupancyAudit from '../../../reports/m9-r3-r2-xiaoyu-action-occupancy-audit.json';
import xiaoyuHiddenInputAudit from '../../../reports/m9-r3-r2-r2-xiaoyu-hidden-input-audit.json';
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
import { projectVerifiedAttackInputChainSegment } from '../../domain/verifiedActionContextScheduling';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createVerifiedActionVariantRuntime } from '../../simulation/mechanics/verifiedActionVariantRuntime';
import { projectScenarioEffectiveActionTimeline } from '../../simulation/mechanics/actionEffectiveTimeline';
import {
  ACTION_RULE_CODES,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';

const RUBY_ID = 103002;
const JADE_ID = 101010;
const CHARGED_INPUT_OWNER_ID = 107003;
const RUBY_NORMAL_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === RUBY_ID && mapping.actionKind === 'normal-attack'
);
const RUBY_A1 = RUBY_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 1
);
const JADE_NORMAL_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === JADE_ID && mapping.actionKind === 'normal-attack'
);
const JADE_A1 = JADE_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 1
);
const JADE_A5 = JADE_NORMAL_MAPPING.attackInputSegments.find(
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

  it('uses Ruby source frames and selects the ammo-aware attack chain', () => {
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
      id: 'ruby-a1',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: 0,
      attackInput: RUBY_A1,
    });
    const emptyAmmo = runVariantRuntime({
      actors: [attack.actor],
      actions: [attack],
      durationMs: 1000,
    });

    expect(emptyAmmo.executionBlocks).toEqual([]);
    expect(emptyAmmo.resourceEvents).toEqual([]);
    expect(emptyAmmo.selectionByActionId.get(attack.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      semanticName: '普通攻击 A1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 0,
    });

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
    expect(allowed.selectionByActionId.get(attack.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      semanticName: '强化普攻 A1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 1,
    });
    expect(allowed.resourceEvents[0]).toMatchObject({
      timeMs: 0,
      actionId: 'ruby-a1',
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
      controlSkillId: 10101042,
      publicControlSkillId: 10101010,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 1,
      semanticName: '强化特殊重击',
      sourceKind: 'verified-input-context-variant',
      contextActionId: 'jade-ultimate',
      status: 'verified-action-variant-selection-ready',
    });
    expect(
      runtime.actionResolutionById.get('jade-charged')?.variantSelection
    ).toMatchObject({
      selectedSubSkillIndex: 1,
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

  it('uses the sourced A5 occupancy and selects the derived charged variant only inside its input window', () => {
    const a5 = createActorAction({
      id: 'jade-a5-default',
      characterId: JADE_ID,
      skillId: 10101001,
      startMs: 0,
      attackInput: JADE_A5,
    });
    const inside = createActorAction({
      id: 'jade-special-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: Number(frameTime(37).toFixed(6)),
    });
    const selected = runVariantRuntime({
      actors: [a5.actor],
      actions: [a5, inside],
      durationMs: 8000,
    });

    expect(selected.selectionByActionId.get(a5.id)).toMatchObject({
      controlSkillId: 10101005,
      selectedSubSkillIndex: 0,
      actualDurationFrames: 80,
    });
    expect(selected.selectionByActionId.get(inside.id)).toMatchObject({
      publicControlSkillId: 10101010,
      controlSkillId: 10101042,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 0,
      semanticName: '特殊重击',
      sourceKind: 'verified-input-context-variant',
      contextActionId: a5.id,
      animationDurationFrames: 280,
      actualDurationFrames: 90,
    });
    expect(
      selected.actionResolutionById.get(inside.id)?.actionBinding
        ?.selectedHitIdentities
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('101010130'),
        expect.stringContaining('101010157'),
      ])
    );

    const outside = createActorAction({
      id: 'jade-default-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(249),
    });
    const notDerived = runVariantRuntime({
      actors: [a5.actor],
      actions: [a5, outside],
      durationMs: 8000,
    });
    expect(notDerived.selectionByActionId.get(outside.id)).toMatchObject({
      controlSkillId: 10101010,
      selectedSubSkillIndex: 0,
      semanticName: '普通重击',
      sourceKind: 'verified-client-default-subskill-index',
      animationDurationFrames: 310,
      actualDurationFrames: 75,
    });

    const burstA5 = createActorAction({
      id: 'jade-a5-burst',
      characterId: JADE_ID,
      skillId: 10101001,
      startMs: 0,
      attackInput: JADE_A5,
      attackSequenceIndex: 3,
    });
    const enhanced = createActorAction({
      id: 'jade-enhanced-special-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(40),
    });
    const burst = runVariantRuntime({
      actors: [burstA5.actor],
      actions: [burstA5, enhanced],
      durationMs: 8000,
      initialRuntimeState: createJadeBurstInitialState({
        actorId: burstA5.actorId,
        remainingDurationMs: 7000,
      }),
    });
    expect(burst.selectionByActionId.get(burstA5.id)).toMatchObject({
      controlSkillId: 10101005,
      selectedSubSkillIndex: 1,
      sourceKind: 'verified-active-attack-input-chain',
      attackInputChainIdentity: 'xiaoyu-burst-three-inputs',
      actualDurationFrames: 72,
    });
    expect(burst.selectionByActionId.get(enhanced.id)).toMatchObject({
      publicControlSkillId: 10101010,
      controlSkillId: 10101042,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 1,
      semanticName: '强化特殊重击',
      sourceKind: 'verified-input-context-variant',
      contextActionId: burstA5.id,
      animationDurationFrames: 205,
      actualDurationFrames: 60,
    });
  });

  it('keeps the right-slide continuous charged input distinct from A5-derived special charged attacks', () => {
    const charged = createActorAction({
      id: 'jade-ordinary-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: 0,
    });
    const continuous = createActorAction({
      id: 'jade-continuous-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(75),
    });
    const runtime = runVariantRuntime({
      actors: [charged.actor],
      actions: [charged, continuous],
      durationMs: 8000,
    });

    expect(runtime.selectionByActionId.get(charged.id)).toMatchObject({
      controlSkillId: 10101010,
      selectedSubSkillIndex: 0,
      semanticName: '普通重击',
      actualDurationFrames: 75,
    });
    expect(runtime.selectionByActionId.get(continuous.id)).toMatchObject({
      publicControlSkillId: 10101010,
      controlSkillId: 10101010,
      executionControlSkillId: 10101010,
      selectedSubSkillIndex: 1,
      semanticName: '连续重击',
      sourceKind: 'verified-input-context-variant',
      contextActionId: charged.id,
      animationDurationFrames: 230,
      actualDurationFrames: 75,
    });
  });

  it.each([
    {
      label: '普通重击',
      expectedControlSkillId: 10101010,
      expectedSubSkillIndex: 0,
      expectedOccupancyFrames: 75,
      createCase() {
        const charged = createActorAction({
          id: 'jade-boundary-ordinary',
          characterId: JADE_ID,
          skillId: 10101001,
          actionVariantIndex: 2,
          startMs: 0,
        });
        return { actors: [charged.actor], actions: [charged], focus: charged };
      },
    },
    {
      label: '强化重击',
      expectedControlSkillId: 10101010,
      expectedSubSkillIndex: 2,
      expectedOccupancyFrames: 64,
      createCase() {
        const charged = createActorAction({
          id: 'jade-boundary-enhanced',
          characterId: JADE_ID,
          skillId: 10101001,
          actionVariantIndex: 2,
          startMs: 0,
        });
        return {
          actors: [charged.actor],
          actions: [charged],
          focus: charged,
          initialRuntimeState: createJadeBurstInitialState({
            actorId: charged.actorId,
            remainingDurationMs: 5000,
          }),
        };
      },
    },
    {
      label: '特殊重击',
      expectedControlSkillId: 10101042,
      expectedSubSkillIndex: 0,
      expectedOccupancyFrames: 90,
      createCase() {
        const a5 = createActorAction({
          id: 'jade-boundary-a5',
          characterId: JADE_ID,
          skillId: 10101001,
          startMs: 0,
          attackInput: JADE_A5,
        });
        const charged = createActorAction({
          id: 'jade-boundary-special',
          characterId: JADE_ID,
          skillId: 10101001,
          actionVariantIndex: 2,
          startMs: frameTime(37),
        });
        return {
          actors: [a5.actor],
          actions: [a5, charged],
          focus: charged,
        };
      },
    },
    {
      label: '强化特殊重击',
      expectedControlSkillId: 10101042,
      expectedSubSkillIndex: 1,
      expectedOccupancyFrames: 60,
      createCase() {
        const burstA3 = createActorAction({
          id: 'jade-boundary-burst-a3',
          characterId: JADE_ID,
          skillId: 10101001,
          startMs: 0,
          attackInput: JADE_A5,
          attackSequenceIndex: 3,
        });
        const charged = createActorAction({
          id: 'jade-boundary-enhanced-special',
          characterId: JADE_ID,
          skillId: 10101001,
          actionVariantIndex: 2,
          startMs: frameTime(40),
        });
        return {
          actors: [burstA3.actor],
          actions: [burstA3, charged],
          focus: charged,
          initialRuntimeState: createJadeBurstInitialState({
            actorId: burstA3.actorId,
            remainingDurationMs: 5000,
          }),
        };
      },
    },
  ])(
    'uses $label effective occupancy for the authoritative overlap boundary',
    ({
      label,
      expectedControlSkillId,
      expectedSubSkillIndex,
      expectedOccupancyFrames,
      createCase,
    }) => {
      const setup = createCase();
      const exactFollower = createActorAction({
        id: `${setup.focus.id}-exact-follower`,
        characterId: JADE_ID,
        skillId: 99999901,
        startMs:
          Number(setup.focus.startMs) + frameTime(expectedOccupancyFrames),
      });
      const exactScenario = {
        time: { durationMs: 10_000, fps: 60 },
        actors: setup.actors,
        actions: [...setup.actions, exactFollower],
        initialRuntimeState: setup.initialRuntimeState,
      };
      const exactRuntime = createVerifiedActionVariantRuntime({
        scenario: exactScenario,
      });
      const exactTimeline = projectScenarioEffectiveActionTimeline({
        scenario: exactScenario,
        actionResolutionById: exactRuntime.actionResolutionById,
        actionSelectionById: exactRuntime.selectionByActionId,
      });
      const exactResolution = exactRuntime.selectionByActionId.get(
        setup.focus.id
      );
      const exactDiagnostics = createActionRuleDiagnostics({
        scenario: exactTimeline.scenario,
      });

      expect(exactResolution).toMatchObject({
        semanticName: label,
        executionControlSkillId: expectedControlSkillId,
        selectedSubSkillIndex: expectedSubSkillIndex,
        actualDurationFrames: expectedOccupancyFrames,
      });
      expect(
        exactTimeline.scenario.actions.find(
          action => action.id === setup.focus.id
        )
      ).toMatchObject({
        name: label,
        durationMs: frameTime(expectedOccupancyFrames),
      });
      expect(
        exactDiagnostics.diagnostics.filter(
          item =>
            item.code === ACTION_RULE_CODES.LANE_OVERLAP &&
            item.actionIds.includes(exactFollower.id)
        )
      ).toEqual([]);

      const earlyFollower = {
        ...exactFollower,
        id: `${setup.focus.id}-early-follower`,
        startMs:
          Number(setup.focus.startMs) + frameTime(expectedOccupancyFrames - 1),
      };
      const earlyScenario = {
        ...exactScenario,
        actions: [...setup.actions, earlyFollower],
      };
      const earlyRuntime = createVerifiedActionVariantRuntime({
        scenario: earlyScenario,
      });
      const earlyTimeline = projectScenarioEffectiveActionTimeline({
        scenario: earlyScenario,
        actionResolutionById: earlyRuntime.actionResolutionById,
        actionSelectionById: earlyRuntime.selectionByActionId,
      });
      const earlyDiagnostics = createActionRuleDiagnostics({
        scenario: earlyTimeline.scenario,
      });

      expect(earlyDiagnostics.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: ACTION_RULE_CODES.LANE_OVERLAP,
            actionId: earlyFollower.id,
            blockingActionId: setup.focus.id,
            suggestedStartMs: expect.closeTo(
              Number(setup.focus.startMs) + frameTime(expectedOccupancyFrames),
              6
            ),
          }),
        ])
      );
    }
  );

  it('uses each selected Xiaoyu chain segment occupancy instead of its animation tail', () => {
    const defaultA1 = createActorAction({
      id: 'jade-default-a1',
      characterId: JADE_ID,
      skillId: 10101001,
      startMs: 0,
      attackSequenceIndex: 1,
      attackInput: JADE_A1,
    });
    const defaultRuntime = runVariantRuntime({
      actors: [defaultA1.actor],
      actions: [defaultA1],
      durationMs: 5000,
    });
    expect(defaultRuntime.selectionByActionId.get(defaultA1.id)).toMatchObject({
      selectedSubSkillIndex: 0,
      actualDurationFrames: 20,
      sourceKind: 'verified-active-attack-input-chain',
    });
    expect(
      defaultRuntime.actionResolutionById.get(defaultA1.id)?.actionBinding
    ).toMatchObject({
      effectiveOccupancyFrames: 20,
      actualDurationFrames: 20,
    });

    const burstA1 = createActorAction({
      id: 'jade-burst-a1',
      characterId: JADE_ID,
      skillId: 10101001,
      startMs: 0,
      attackSequenceIndex: 1,
      attackInput: JADE_A1,
    });
    const burstRuntime = runVariantRuntime({
      actors: [burstA1.actor],
      actions: [burstA1],
      durationMs: 5000,
      initialRuntimeState: createJadeBurstInitialState({
        actorId: burstA1.actorId,
        remainingDurationMs: 4000,
      }),
    });
    expect(burstRuntime.selectionByActionId.get(burstA1.id)).toMatchObject({
      selectedSubSkillIndex: 1,
      actualDurationFrames: 72,
      sourceKind: 'verified-active-attack-input-chain',
    });
    expect(
      burstRuntime.actionResolutionById.get(burstA1.id)?.actionBinding
    ).toMatchObject({
      effectiveOccupancyFrames: 72,
      actualDurationFrames: 72,
    });
  });

  it.each([
    {
      label: '星决技',
      createPrelude() {
        return {
          action: createActorAction({
            id: 'jade-burst-from-ultimate',
            characterId: JADE_ID,
            skillId: 10101013,
            startMs: 0,
          }),
          chainStartFrame: 300,
          initialRuntimeState: null,
          expectedStateFrame: 272,
        };
      },
    },
    {
      label: '缘结值达到 100',
      createPrelude() {
        const action = createActorAction({
          id: 'jade-burst-from-threshold',
          characterId: JADE_ID,
          skillId: 10101001,
          actionVariantIndex: 2,
          startMs: 0,
        });
        return {
          action,
          chainStartFrame: 60,
          initialRuntimeState: {
            specialResourcesByActor: [
              {
                actorId: action.actorId,
                resourceIdentity: 'actor:101010:element:101010115',
                currentValue: 95,
              },
            ],
          },
          expectedStateFrame: 43,
        };
      },
    },
  ])(
    'selects the verified burst A1-A3 chain and enhanced special charged form after $label enters burst',
    ({ createPrelude }) => {
      const {
        action: prelude,
        chainStartFrame,
        initialRuntimeState,
        expectedStateFrame,
      } = createPrelude();
      const burstChain = createJadeBurstChainActions({
        startFrame: chainStartFrame,
      });
      const charged = createActorAction({
        id: `${prelude.id}-enhanced-special-charged`,
        characterId: JADE_ID,
        skillId: 10101001,
        actionVariantIndex: 2,
        startMs: frameTime(chainStartFrame + 72 + 75 + 40),
      });
      const runtime = runVariantRuntime({
        actors: [prelude.actor],
        actions: [prelude, ...burstChain, charged],
        durationMs: 20_000,
        initialRuntimeState,
      });

      expect(
        runtime.stateEvents.find(
          event =>
            event.payload.operation === 'transform' &&
            event.payload.stateElementId === 101010129
        )?.timeMs
      ).toBeCloseTo(frameTime(expectedStateFrame), 6);
      expect(
        burstChain.map(action => runtime.selectionByActionId.get(action.id))
      ).toEqual([
        expect.objectContaining({
          controlSkillId: 10101001,
          selectedSubSkillIndex: 1,
          actualDurationFrames: 72,
          attackInputChainIdentity: 'xiaoyu-burst-three-inputs',
        }),
        expect.objectContaining({
          controlSkillId: 10101004,
          selectedSubSkillIndex: 1,
          actualDurationFrames: 75,
          attackInputChainIdentity: 'xiaoyu-burst-three-inputs',
        }),
        expect.objectContaining({
          controlSkillId: 10101005,
          selectedSubSkillIndex: 1,
          actualDurationFrames: 72,
          attackInputChainIdentity: 'xiaoyu-burst-three-inputs',
        }),
      ]);
      expect(runtime.selectionByActionId.get(charged.id)).toMatchObject({
        publicControlSkillId: 10101010,
        controlSkillId: 10101042,
        executionControlSkillId: 10101042,
        selectedSubSkillIndex: 1,
        semanticName: '强化特殊重击',
        sourceKind: 'verified-input-context-variant',
        contextActionId: burstChain[2].id,
        animationDurationFrames: 205,
        actualDurationFrames: 60,
      });
      const effectiveTimeline = projectScenarioEffectiveActionTimeline({
        scenario: {
          time: { durationMs: 20_000, fps: 60 },
          actors: [prelude.actor],
          actions: [prelude, ...burstChain, charged],
          initialRuntimeState,
        },
        actionResolutionById: runtime.actionResolutionById,
        actionSelectionById: runtime.selectionByActionId,
      });
      expect(
        effectiveTimeline.scenario.actions
          .filter(action => burstChain.some(item => item.id === action.id))
          .map(action => ({
            sequenceIndex: action.attackSequenceIndex,
            controlSkillId: action.attackInput?.controlSkillId,
            subSkillIndex: action.attackInput?.selectedSubSkillIndex,
            linkTimingStatus: action.attackInput?.linkTimingStatus,
            linkTargetControlSkillId:
              action.attackInput?.linkWindow?.targetControlSkillId,
          }))
      ).toEqual([
        {
          sequenceIndex: 1,
          controlSkillId: 10101001,
          subSkillIndex: 1,
          linkTimingStatus: 'applied',
          linkTargetControlSkillId: 10101004,
        },
        {
          sequenceIndex: 2,
          controlSkillId: 10101004,
          subSkillIndex: 1,
          linkTimingStatus: 'applied',
          linkTargetControlSkillId: 10101005,
        },
        {
          sequenceIndex: 3,
          controlSkillId: 10101005,
          subSkillIndex: 1,
          linkTimingStatus: 'applied',
          linkTargetControlSkillId: 80102,
        },
      ]);
    }
  );

  it.each([
    { relativeFrame: 19, expectedControlSkillId: 10101042 },
    { relativeFrame: 20, expectedControlSkillId: 10101010 },
    { relativeFrame: 40, expectedControlSkillId: 10101042 },
    { relativeFrame: 71, expectedControlSkillId: 10101042 },
    {
      relativeFrame: 72,
      expectedControlSkillId: 10101042,
      expectedInputFrame: 71,
    },
  ])(
    'keeps burst A3 windows half-open and resolves edge intent at frame $relativeFrame',
    ({ relativeFrame, expectedControlSkillId, expectedInputFrame = null }) => {
      const burstA3 = createActorAction({
        id: `jade-burst-a3-boundary-${relativeFrame}`,
        characterId: JADE_ID,
        skillId: 10101001,
        startMs: 0,
        attackInput: JADE_A5,
        attackSequenceIndex: 3,
      });
      const charged = createActorAction({
        id: `jade-burst-charged-boundary-${relativeFrame}`,
        characterId: JADE_ID,
        skillId: 10101001,
        actionVariantIndex: 2,
        startMs: frameTime(relativeFrame),
      });
      const runtime = runVariantRuntime({
        actors: [burstA3.actor],
        actions: [burstA3, charged],
        durationMs: 8000,
        initialRuntimeState: createJadeBurstInitialState({
          actorId: burstA3.actorId,
          remainingDurationMs: 5000,
        }),
      });

      expect(
        runtime.selectionByActionId.get(charged.id)?.executionControlSkillId
      ).toBe(expectedControlSkillId);
      expect(runtime.selectionByActionId.get(charged.id)).toMatchObject(
        expectedControlSkillId === 10101042
          ? {
              selectedSubSkillIndex: 1,
              semanticName: '强化特殊重击',
              contextActionId: burstA3.id,
            }
          : {
              selectedSubSkillIndex: 2,
              semanticName: '强化重击',
            }
      );
      if (expectedInputFrame != null) {
        expect(
          runtime.selectionByActionId.get(charged.id)
            ?.contextualInputScheduling
        ).toMatchObject({
          resolutionKind: 'edge-intent-contextual-transition',
          inputOffsetFrame: expectedInputFrame,
          executionStartFrame: expectedInputFrame,
          predecessorEffectiveEndFrame: expectedInputFrame,
        });
      }
    }
  );

  it.each([
    {
      label: '星鸣技',
      skillId: 10101012,
      actionVariantIndex: 0,
      boundaries: [
        [85, false],
        [86, true],
        [119, true],
        [120, true, 119],
      ],
      expectedInsideSubSkillIndex: 0,
      expectedInsideSemanticName: '特殊重击',
    },
    {
      label: '星决技',
      skillId: 10101013,
      actionVariantIndex: 0,
      boundaries: [
        [294, false],
        [295, true],
        [328, true],
        [329, true, 328],
      ],
      expectedInsideSubSkillIndex: 1,
      expectedInsideSemanticName: '强化特殊重击',
      entersBurstBeforeWindow: true,
    },
    {
      label: '极限反击',
      skillId: 10101021,
      actionVariantIndex: 1,
      boundaries: [
        [59, false],
        [60, true],
        [95, true],
        [96, false],
      ],
      expectedInsideSubSkillIndex: 0,
      expectedInsideSemanticName: '特殊重击',
    },
  ])(
    'uses the verified $label hidden charged-input window as a half-open interval',
    ({
      label,
      skillId,
      actionVariantIndex,
      boundaries,
      expectedInsideSubSkillIndex,
      expectedInsideSemanticName,
      entersBurstBeforeWindow = false,
    }) => {
      for (const burstActive of [false, true]) {
        for (const [
          relativeFrame,
          inside,
          expectedInputFrame = null,
        ] of boundaries) {
          const source = createActorAction({
            id: `jade-${label}-source-${burstActive}-${relativeFrame}`,
            characterId: JADE_ID,
            skillId,
            actionVariantIndex,
            startMs: 0,
          });
          const charged = createActorAction({
            id: `jade-${label}-charged-${burstActive}-${relativeFrame}`,
            characterId: JADE_ID,
            skillId: 10101001,
            actionVariantIndex: 2,
            startMs: frameTime(relativeFrame),
          });
          const runtime = runVariantRuntime({
            actors: [source.actor],
            actions: [source, charged],
            durationMs: 12_000,
            initialRuntimeState: burstActive
              ? createJadeBurstInitialState({
                  actorId: source.actorId,
                  remainingDurationMs: 10_000,
                })
              : null,
          });
          const selection = runtime.selectionByActionId.get(charged.id);

          expect(selection, `${label} ${relativeFrame}F`).toMatchObject(
            inside
              ? {
                  executionControlSkillId: 10101042,
                  selectedSubSkillIndex: expectedInsideSubSkillIndex,
                  semanticName: expectedInsideSemanticName,
                  sourceKind: 'verified-input-context-variant',
                  contextActionId: source.id,
                }
              : {
                  executionControlSkillId: 10101010,
                  selectedSubSkillIndex:
                    burstActive || entersBurstBeforeWindow ? 2 : 0,
                  semanticName:
                    burstActive || entersBurstBeforeWindow
                      ? '强化重击'
                      : '普通重击',
                }
          );
          if (expectedInputFrame != null) {
            expect(
              selection.contextualInputScheduling,
              `${label} ${relativeFrame}F edge intent`
            ).toMatchObject({
              resolutionKind: 'edge-intent-contextual-transition',
              inputOffsetFrame: expectedInputFrame,
              executionStartFrame: expectedInputFrame,
              predecessorEffectiveEndFrame: expectedInputFrame,
            });
          }
        }
      }
    }
  );

  it('resolves all 21 audited Xiaoyu public execution forms with their authoritative occupancy', () => {
    expect(xiaoyuHiddenInputAudit.publicExecutionForms).toHaveLength(21);
    expect(xiaoyuActionOccupancyAudit.rows).toHaveLength(21);

    for (const form of xiaoyuHiddenInputAudit.publicExecutionForms) {
      const setup = createXiaoyuPublicExecutionFormCase(form);
      const runtime = runVariantRuntime({
        actors: [setup.focus.actor],
        actions: setup.actions,
        durationMs: 12_000,
        initialRuntimeState: setup.initialRuntimeState,
      });
      const selection = runtime.selectionByActionId.get(setup.focus.id);
      const occupancy = xiaoyuActionOccupancyAudit.rows.find(
        row =>
          Number(row.controlSkillId) === Number(form.sourceControlSkillId) &&
          Number(row.subSkillIndex) === Number(form.sourceSubSkillIndex)
      );

      expect(occupancy, `${form.semanticName}: occupancy`).toBeTruthy();
      expect(
        selection?.selectedSubSkillIndex,
        `${form.semanticName}: selected subskill`
      ).toBe(form.sourceSubSkillIndex);
      expect(
        selection?.actualDurationFrames,
        `${form.semanticName}: effective occupancy`
      ).toBe(occupancy.effectiveOccupancyFrames);
      const actionResolution = runtime.actionResolutionById.get(setup.focus.id);
      expect(
        actionResolution?.actionBinding?.schedulable,
        `${form.semanticName}: schedulable`
      ).toBe(true);
      expect(
        actionResolution?.ready,
        `${form.semanticName}: readiness classification`
      ).toBe(actionResolution?.actionBinding?.runtimeReady === true);
      expect(
        Number(selection.executionControlSkillId ?? selection.controlSkillId),
        `${form.semanticName}: execution control`
      ).toBe(form.sourceControlSkillId);
    }
  });

  it('enters burst on the exact threshold transaction and refreshes it from the ultimate source frame', () => {
    const charged = createActorAction({
      id: 'jade-threshold-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: 0,
    });
    const threshold = runVariantRuntime({
      actors: [charged.actor],
      actions: [charged],
      durationMs: 12_000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: charged.actorId,
            resourceIdentity: 'actor:101010:element:101010115',
            currentValue: 95,
          },
        ],
      },
    });
    const thresholdFrameMs = frameTime(43);
    expect(
      threshold.resourceEvents
        .filter(event => event.timeMs === thresholdFrameMs)
        .map(event => [
          event.payload.operation,
          event.payload.beforeValue,
          event.payload.afterValue,
        ])
    ).toEqual([
      ['gain', 95, 100],
      ['threshold-clear', 100, 0],
      ['transform', 0, 0],
    ]);
    expect(
      threshold.resourceEvents.filter(
        event =>
          event.actionId === charged.id && event.payload.operation === 'gain'
      )
    ).toHaveLength(1);
    expect(threshold.stateEvents[0]).toMatchObject({
      timeMs: thresholdFrameMs,
      payload: {
        operation: 'transform',
        stateElementId: 101010129,
        stateDurationMs: 10_000,
      },
    });
    expect(
      threshold.effectCommands.find(
        command => command.effectId === 'battle-element:101010129'
      )
    ).toMatchObject({
      timeMs: thresholdFrameMs,
      durationMs: 10_000,
      sourceStatus: 'verified-action-state-generated',
    });
    const clampedThreshold = runVariantRuntime({
      actors: [charged.actor],
      actions: [charged],
      durationMs: 12_000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: charged.actorId,
            resourceIdentity: 'actor:101010:element:101010115',
            currentValue: 99,
          },
        ],
      },
    });
    expect(
      clampedThreshold.resourceEvents
        .filter(event => event.timeMs === thresholdFrameMs)
        .map(event => [
          event.payload.operation,
          event.payload.beforeValue,
          event.payload.afterValue,
        ])
    ).toEqual([
      ['gain', 99, 100],
      ['threshold-clear', 100, 0],
      ['transform', 0, 0],
    ]);
    expect(
      clampedThreshold.resourceEvents.filter(
        event => event.payload.operation === 'gain'
      )
    ).toHaveLength(1);

    const ultimate = createActorAction({
      id: 'jade-refresh-ultimate',
      characterId: JADE_ID,
      skillId: 10101013,
      startMs: 0,
    });
    const enteredByUltimate = runVariantRuntime({
      actors: [ultimate.actor],
      actions: [ultimate],
      durationMs: 16_000,
    });
    expect(
      enteredByUltimate.stateEvents.find(
        event =>
          event.actionId === ultimate.id &&
          event.payload.operation === 'transform'
      )
    ).toMatchObject({
      timeMs: frameTime(272),
      payload: {
        stateElementId: 101010129,
        stateDurationMs: 10_000,
      },
    });
    const refreshed = runVariantRuntime({
      actors: [ultimate.actor],
      actions: [ultimate],
      durationMs: 16_000,
      initialRuntimeState: createJadeBurstInitialState({
        actorId: ultimate.actorId,
        currentValue: 37,
        remainingDurationMs: 6000,
      }),
    });
    expect(
      refreshed.resourceEvents.find(
        event =>
          event.actionId === ultimate.id && event.payload.operation === 'clear'
      )
    ).toMatchObject({
      timeMs: frameTime(264),
      payload: { beforeValue: 37, afterValue: 0 },
    });
    expect(
      refreshed.stateEvents.find(
        event =>
          event.actionId === ultimate.id &&
          event.payload.operation === 'refresh'
      )
    ).toMatchObject({
      timeMs: frameTime(272),
      payload: {
        stateElementId: 101010129,
        stateDurationMs: 10_000,
      },
    });
    expect(
      refreshed.stateEvents.some(
        event =>
          event.actionId === ultimate.id &&
          event.payload.operation === 'transform-remove'
      )
    ).toBe(false);
  });

  it('generates Jade passive 10101061 as a four-stack calculator effect', () => {
    const actions = Array.from({ length: 5 }, (_, index) =>
      createActorAction({
        id: `jade-passive-trigger-${index + 1}`,
        characterId: JADE_ID,
        skillId: 10101001,
        actionVariantIndex: 2,
        startMs: index * 1000,
      })
    );
    const runtime = runVariantRuntime({
      actors: [actions[0].actor],
      actions,
      durationMs: 13_000,
    });
    const passiveCommands = runtime.effectCommands.filter(
      command => command.effectId === 'battle-element:101010206'
    );
    expect(passiveCommands).toHaveLength(5);
    expect(passiveCommands[0]).toMatchObject({
      effectName: '玉未央',
      timeMs: frameTime(1),
      durationMs: 8000,
      maxStacks: 4,
      sourceStatus: 'verified-passive-effect-generated',
      appliedToCalculators: true,
      modifiers: [
        expect.objectContaining({
          attributeId: 1,
          bucket: 'dynamicPercent',
          valueRaw: 500,
        }),
        expect.objectContaining({
          attributeId: 229,
          bucket: 'dynamicPercent',
          valueRaw: 3200,
        }),
      ],
    });
    const effectTimeline = createEffectRuntimeTimeline({
      scenario: {
        time: { durationMs: 13_000, fps: 60 },
        actors: [actions[0].actor],
        actions,
      },
      actionExecutionPlan: {
        actions: actions.map(action => ({
          actionId: action.id,
          execute: true,
        })),
      },
      generatedCommands: runtime.effectCommands,
    });
    expect(
      effectTimeline.events
        .filter(event => event.effectId === 'battle-element:101010206')
        .filter(event => event.after)
        .map(event => event.after.stacks)
    ).toEqual([1, 2, 3, 4, 4]);
    expect(
      effectTimeline.events.find(
        event =>
          event.effectId === 'battle-element:101010206' &&
          event.type === 'EFFECT_EXPIRED'
      )?.timeMs
    ).toBeCloseTo(4000 + frameTime(1) + 8000, 2);
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
      semanticName: '强化重击',
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
            currentValue: 0,
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
      result.verifiedCombatRuntime.specialResourceRuntime.resourceEvents.some(
        event =>
          event.actionId === action.id &&
          ['clear', 'transform'].includes(event.payload.operation)
      )
    ).toBe(false);
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
        initialValue: 0,
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

  it('executes the A5-derived special charged hits and wind-mark consume exactly once', () => {
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
    const a5 = createWorkbenchActionDraft({
      id: 'compiled-jade-a5',
      type: 'skill',
      actorCharacterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 0,
      startMs: 0,
      durationMs: JADE_A5.durationMs,
      attackGroupId: 'compiled-jade-chain',
      attackSequenceIndex: 5,
      attackSequenceTotal: 5,
      attackInput: JADE_A5,
    });
    const special = createWorkbenchActionDraft({
      id: 'compiled-jade-special-charged',
      type: 'skill',
      actorCharacterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(37),
      durationMs: frameTime(310),
    });
    const wind = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
      profile => profile.key === 'wind'
    );
    const project = createWorkbenchProject(selection, {
      durationMs: 8000,
      teamSlots,
      actorConfigs,
      actions: [a5, special],
      initialRuntimeState: {
        tuningMarks: [
          {
            markId: wind.markId,
            profileKey: wind.key,
            elementName: wind.element,
            heldReadyRemainingMs: 0,
            layers: [
              {
                remainingDurationMs: 7000,
                sourceActionId: 'inherited-wind',
                sourceActorId: `actor-${JADE_ID}`,
                sourceIdentity: wind.sourceIdentity,
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
    expect(
      result.actionRuleDiagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code === ACTION_RULE_CODES.LANE_OVERLAP &&
          diagnostic.actionIds?.includes(special.id)
      )
    ).toEqual([]);
    const resolution = result.verifiedCombatRuntime.actionResolutionById.get(
      special.id
    );
    const consumeEvents = result.verifiedTuningMarkGeneration.events.filter(
      event => event.actionId === special.id && event.kind === 'consume'
    );

    expect(resolution.actionBinding).toMatchObject({
      semanticName: '特殊重击',
      publicControlSkillId: 10101010,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 0,
      animationDurationFrames: 280,
      effectiveOccupancyFrames: 90,
    });
    expect(
      result.verifiedCombatRuntime.damageEvents
        .filter(event => event.actionId === special.id)
        .map(event => event.payload.elementId)
    ).toEqual(expect.arrayContaining([101010130, 101010157]));
    expect(consumeEvents).toHaveLength(1);
    expect(consumeEvents[0]).toMatchObject({
      profileKey: 'wind',
      before: 2,
      delta: -1,
      after: 1,
    });
    expect(consumeEvents[0].timeMs).toBeCloseTo(frameTime(90), 5);
  });

  it('executes an edge-to-edge star-skill derivation on one contextual timeline', () => {
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
    const starSkill = createWorkbenchActionDraft({
      id: 'compiled-jade-star-skill-edge',
      type: 'skill',
      actorCharacterId: JADE_ID,
      skillId: 10101012,
      actionVariantIndex: 0,
      startMs: 0,
      durationMs: frameTime(260),
    });
    const charged = createWorkbenchActionDraft({
      id: 'compiled-jade-special-charged-edge',
      type: 'skill',
      actorCharacterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(120),
      durationMs: frameTime(310),
    });
    const project = createWorkbenchProject(selection, {
      durationMs: 8000,
      teamSlots,
      actorConfigs,
      actions: [starSkill, charged],
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    });
    const result = simulateScenario(
      compileProject(project, getWorkbenchGameData())
    );
    const effectiveById = new Map(
      result.effectiveActionTimeline.scenario.actions.map(action => [
        action.id,
        action,
      ])
    );
    const runtimeSelection =
      result.verifiedCombatRuntime.specialResourceRuntime.selectionByActionId.get(
        charged.id
      );

    expect(runtimeSelection).toMatchObject({
      contextActionId: starSkill.id,
      executionControlSkillId: 10101042,
      selectedSubSkillIndex: 0,
      semanticName: '特殊重击',
      contextualInputScheduling: {
        resolutionKind: 'edge-intent-contextual-transition',
        inputOffsetFrame: 119,
        inputFrame: 119,
        executionStartFrame: 119,
        predecessorEffectiveEndFrame: 119,
      },
    });
    expect(effectiveById.get(starSkill.id)).toMatchObject({ startMs: 0 });
    expect(effectiveById.get(starSkill.id).durationMs).toBeCloseTo(
      frameTime(119),
      5
    );
    expect(
      effectiveById.get(starSkill.id).contextualEffectiveEndMs
    ).toBeCloseTo(frameTime(119), 5);
    expect(effectiveById.get(charged.id)).toMatchObject({
      requestedStartMs: frameTime(120),
      name: '特殊重击',
    });
    expect(effectiveById.get(charged.id).startMs).toBeCloseTo(
      frameTime(119),
      5
    );
    expect(
      result.actionRuleDiagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code === ACTION_RULE_CODES.LANE_OVERLAP &&
          diagnostic.actionIds?.includes(charged.id)
      )
    ).toEqual([]);
    expect(
      result.verifiedCombatRuntime.damageEvents.filter(
        event => event.actionId === charged.id
      ).length
    ).toBeGreaterThan(0);
  });
});

function createActorAction({
  id,
  characterId,
  skillId,
  actionVariantIndex = 0,
  startMs = 0,
  attackInput = null,
  attackSequenceIndex = null,
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
          attackSequenceIndex: attackSequenceIndex ?? attackInput.sequenceIndex,
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

function createJadeBurstInitialState({
  actorId,
  currentValue = 0,
  remainingDurationMs,
}) {
  return {
    specialResourcesByActor: [
      {
        actorId,
        resourceIdentity: 'actor:101010:element:101010115',
        currentValue,
        activeStates: [
          {
            elementId: 101010129,
            name: '爆发状态buff',
            remainingDurationMs,
            sourceActionId: 'previous-cycle-ultimate',
            sourceIdentity: 'battle-element:101010129',
          },
        ],
      },
    ],
  };
}

function createJadeBurstChainActions({ startFrame }) {
  const definitions = [
    { sequenceIndex: 1, controlSkillId: 10101001, startOffsetFrames: 0 },
    { sequenceIndex: 2, controlSkillId: 10101004, startOffsetFrames: 72 },
    {
      sequenceIndex: 3,
      controlSkillId: 10101005,
      startOffsetFrames: 72 + 75,
    },
  ];
  return definitions.map(definition =>
    createActorAction({
      id: `jade-burst-a${definition.sequenceIndex}-${startFrame}`,
      characterId: JADE_ID,
      skillId: 10101001,
      startMs: frameTime(startFrame + definition.startOffsetFrames),
      attackInput: {
        ...JADE_A1,
        controlSkillId: definition.controlSkillId,
        sequenceIndex: definition.sequenceIndex,
      },
      attackSequenceIndex: definition.sequenceIndex,
    })
  );
}

function createXiaoyuPublicExecutionFormCase(form) {
  const common = {
    characterId: JADE_ID,
    skillId: 10101001,
  };
  if (form.actionKind === 'normal-attack') {
    const sequenceIndex = Number(
      String(form.publicActionIdentity).match(/\|A(\d+)$/)?.[1]
    );
    const chainIdentity = String(form.publicActionIdentity).split('|A')[0];
    const chain = mechanicsPackage.actionVariantGraph.attackInputChains.find(
      item => item.chainIdentity === chainIdentity
    );
    if (!chain) {
      throw new Error(`Missing Xiaoyu attack chain ${chainIdentity}`);
    }
    let nextStartFrame = 0;
    const actions = chain.segments
      .filter(segment => Number(segment.sequenceIndex) <= sequenceIndex)
      .map(segment => {
        const sourceSegment =
          JADE_NORMAL_MAPPING.attackInputSegments.find(
            item =>
              Number(item.controlSkillId) === Number(segment.controlSkillId)
          ) ?? JADE_A1;
        const attackInput = projectVerifiedAttackInputChainSegment(
          sourceSegment,
          segment,
          segment.sequenceIndex,
          chain.segments.length
        );
        const action = createActorAction({
          ...common,
          id: `audited-${chainIdentity}-a${segment.sequenceIndex}`,
          startMs: frameTime(nextStartFrame),
          attackInput,
          attackSequenceIndex: segment.sequenceIndex,
        });
        action.attackGroupId = `audited-${chainIdentity}`;
        nextStartFrame += Number(segment.durationFrames);
        return action;
      });
    const focus = actions.at(-1);
    return {
      focus,
      actions,
      initialRuntimeState:
        Number(form.sourceSubSkillIndex) === 1
          ? createJadeBurstInitialState({
              actorId: focus.actorId,
              remainingDurationMs: 10_000,
            })
          : null,
    };
  }

  if (form.actionKind === 'charged-attack') {
    const focus = createActorAction({
      ...common,
      id: `audited-${form.semanticName}`,
      actionVariantIndex: 2,
    });
    if (form.semanticName === '普通重击') {
      return { focus, actions: [focus], initialRuntimeState: null };
    }
    if (form.semanticName === '强化重击') {
      return {
        focus,
        actions: [focus],
        initialRuntimeState: createJadeBurstInitialState({
          actorId: focus.actorId,
          remainingDurationMs: 10_000,
        }),
      };
    }
    if (form.semanticName === '特殊重击') {
      const source = createActorAction({
        ...common,
        id: 'audited-special-source-a5',
        attackInput: JADE_A5,
        attackSequenceIndex: 5,
      });
      focus.startMs = frameTime(37);
      return { focus, actions: [source, focus], initialRuntimeState: null };
    }
    if (form.semanticName === '强化特殊重击') {
      const source = createActorAction({
        ...common,
        id: 'audited-enhanced-special-source-a3',
        attackInput: {
          ...JADE_A5,
          controlSkillId: 10101005,
          selectedSubSkillIndex: 1,
          sequenceIndex: 3,
          sequenceTotal: 3,
        },
        attackSequenceIndex: 3,
      });
      focus.startMs = frameTime(40);
      return {
        focus,
        actions: [source, focus],
        initialRuntimeState: createJadeBurstInitialState({
          actorId: focus.actorId,
          remainingDurationMs: 10_000,
        }),
      };
    }
    const source = createActorAction({
      ...common,
      id: 'audited-continuous-source',
      actionVariantIndex: 2,
    });
    focus.startMs = frameTime(75);
    return { focus, actions: [source, focus], initialRuntimeState: null };
  }

  const mapping = mechanicsPackage.actionMappings.find(
    item =>
      Number(item.ownerId) === JADE_ID &&
      String(item.actionKind) === String(form.actionKind) &&
      Number(item.controlSkillId) === Number(form.sourceControlSkillId)
  );
  if (!mapping) {
    throw new Error(`Missing Xiaoyu public mapping for ${form.semanticName}`);
  }
  const focus = createActorAction({
    characterId: JADE_ID,
    id: `audited-${form.actionKind}`,
    skillId: mapping.sourceSkillId,
    actionVariantIndex: mapping.actionVariantIndex,
  });
  return { focus, actions: [focus], initialRuntimeState: null };
}

function frameTime(frame) {
  return (frame * 1000) / 60;
}
