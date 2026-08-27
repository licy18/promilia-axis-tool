import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import xiaoyuActionOccupancyAudit from '../../../reports/m9-r3-r2-xiaoyu-action-occupancy-audit.json';
import xiaoyuHiddenInputAudit from '../../../reports/m9-r3-r2-r2-xiaoyu-hidden-input-audit.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { NORMAL_ATTACK_INPUT_RESOLUTION_MODE } from '../../domain/normalAttackInputResolution';
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
  ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
  attachVerifiedSwitchExitTailPolicies,
  createVerifiedRuntimeSwitchExitTailAssessment,
} from '../../simulation/generation/verifiedSwitchExitTailPolicy';
import {
  ACTION_RULE_CODES,
  createActionRuleDiagnostics,
} from '../../simulation/runtime/actionRuleDiagnostics';
import { createEffectRuntimeTimeline } from '../../simulation/runtime/effectRuntimeTimeline';

const RUBY_ID = 103002;
const JADE_ID = 101010;
const CHARGED_INPUT_OWNER_ID = 107003;
const MELANIA_ID = 112001;
const SIFLIYA_ID = 107001;
const MISA_ID = 107002;
const MOYIN_ID = 109001;
const MITI_ID = 108003;
const STARBORN_IDS = [199001, 199002];
const createVerifiedContextEdgeIdentity = edge =>
  [
    `actor:${Number(edge.ownerId)}`,
    `control:${Number(edge.sourceControlSkillId)}`,
    `sub:${Number(edge.sourceSubSkillIndex)}`,
    `context:${Number(edge.inputWindow.startFrame)}-${Number(
      edge.inputWindow.endFrame
    )}`,
    `public-control:${Number(edge.targetControlSkillId)}`,
    `execution-control:${Number(edge.executionControlSkillId)}`,
    `sub:${Number(edge.targetSubSkillIndex)}`,
  ].join('|');
const RUBY_NORMAL_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === RUBY_ID && mapping.actionKind === 'normal-attack'
);
const RUBY_A1 = RUBY_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 1
);
const RUBY_A2 = RUBY_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 2
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
const MELANIA_NORMAL_MAPPING = mechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === MELANIA_ID && mapping.actionKind === 'normal-attack'
);
const MELANIA_A1 = MELANIA_NORMAL_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 1
);

const normalMappingByOwnerId = new Map(
  mechanicsPackage.actionMappings
    .filter(
      mapping =>
        mapping.ownerKind === 'actor' && mapping.actionKind === 'normal-attack'
    )
    .map(mapping => [Number(mapping.ownerId), mapping])
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

  it('emits Moyin persistent passive 1 modifiers at battle start', () => {
    const action = createActorAction({
      id: 'moyin-a1',
      characterId: 109001,
      skillId: 10900101,
      startMs: 0,
    });
    const runtime = runVariantRuntime({
      actors: [action.actor],
      actions: [action],
      durationMs: 1000,
    });
    const passiveCommands = runtime.effectCommands.filter(command =>
      String(command.id).startsWith('verified-passive|battle-start|')
    );
    expect(passiveCommands).toHaveLength(1);
    expect(passiveCommands[0]).toMatchObject({
      effectId: 'battle-element:109001316',
      targetKind: 'actor',
      targetId: 'actor-109001',
      timeMs: 0,
      durationMs: null,
      stackMode: 'refresh',
      sourceStatus: 'verified-passive-effect-generated',
      appliedToCalculators: true,
    });
    expect(passiveCommands[0].modifiers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: 21,
          bucket: 'dynamicExtra',
          valueRaw: 5400,
          propertyTags: [307],
        }),
      ])
    );
  });

  it('uses the canonical action.level for level-scaled special resource gains', () => {
    const scaledPackage = structuredClone(mechanicsPackage);
    const scaledOperations =
      scaledPackage.specialResourceCatalog.operationBindings.filter(
        operation =>
          operation.applied === true &&
          operation.ownerId === JADE_ID &&
          operation.controlSkillId === 10101010 &&
          operation.operation === 'gain' &&
          operation.triggerFrame === 43
      );
    expect(scaledOperations).toHaveLength(2);
    for (const scaledOperation of scaledOperations) {
      scaledOperation.amountByLevel = {
        ...scaledOperation.amountByLevel,
        1: 5,
        12: 11,
      };
    }
    installVerifiedCombatMechanicsPackage(scaledPackage);

    const levelOne = createActorAction({
      id: 'jade-level-one-resource-gain',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      level: 1,
    });
    const levelTwelve = createActorAction({
      id: 'jade-level-twelve-resource-gain',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      level: 12,
    });

    expect(
      readResourceGainAtFrame(
        runVariantRuntime({
          actors: [levelOne.actor],
          actions: [levelOne],
          durationMs: 2000,
        }),
        levelOne.id,
        43
      )
    ).toMatchObject({ beforeValue: 0, change: 5, afterValue: 5 });
    expect(
      readResourceGainAtFrame(
        runVariantRuntime({
          actors: [levelTwelve.actor],
          actions: [levelTwelve],
          durationMs: 2000,
        }),
        levelTwelve.id,
        43
      )
    ).toMatchObject({ beforeValue: 0, change: 11, afterValue: 11 });
  });

  it('uses Ruby source frames and preserves the explicit attack phase', () => {
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
        operation: 'set-to-capacity',
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
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      semanticName: '普通攻击 A1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 0,
    });

    const enhanced = createActorAction({
      id: 'ruby-enhanced-a1',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: 0,
      attackInput: {
        ...RUBY_A1,
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        controlSkillId: 10300201,
        selectedSubSkillIndex: 1,
        sequenceIndex: 1,
        sequenceTotal: 1,
      },
      attackSequenceIndex: 1,
    });
    enhanced.attackInputChainIdentity = 'ruby-enhanced-twelve-inputs';
    const enhancedRuntime = runVariantRuntime({
      actors: [enhanced.actor],
      actions: [enhanced],
      durationMs: 1000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: enhanced.actorId,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 1,
          },
        ],
      },
    });
    expect(enhancedRuntime.selectionByActionId.get(enhanced.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      semanticName: '强化普攻 E1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 1,
    });
    expect(enhancedRuntime.resourceEvents[0]).toMatchObject({
      timeMs: 0,
      actionId: 'ruby-enhanced-a1',
      payload: {
        operation: 'consume',
        beforeValue: 1,
        change: -1,
        afterValue: 0,
      },
    });

    const exhaustedRuntime = runVariantRuntime({
      actors: [enhanced.actor],
      actions: [enhanced],
      durationMs: 1000,
    });
    expect(exhaustedRuntime.resourceEvents).toEqual([]);
    expect(exhaustedRuntime.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: enhanced.id,
        reason: 'verified-attack-input-chain-complete',
        resourceIdentity: 'actor:103002:element:103002047',
        currentValue: 0,
        maxValue: 12,
      }),
    ]);
  });

  it('refills Ruby ammunition to capacity and opens enhanced entry at the Star Skill release frame', () => {
    const starSkill = createActorAction({
      id: 'ruby-star-skill',
      characterId: RUBY_ID,
      skillId: 10300212,
      startMs: 0,
    });
    const runtime = runVariantRuntime({
      actors: [starSkill.actor],
      actions: [starSkill],
      durationMs: 5000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: starSkill.actorId,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 5,
          },
        ],
      },
    });

    expect(runtime.resourceEvents).toEqual([
      expect.objectContaining({
        timeMs: frameTime(0),
        actionId: 'ruby-star-skill',
        payload: expect.objectContaining({
          operation: 'set-to-capacity',
          beforeValue: 5,
          change: 7,
          afterValue: 12,
          maxValue: 12,
        }),
      }),
    ]);
    expect(runtime.activeSwitchWindows).toEqual([
      expect.objectContaining({
        actorId: starSkill.actorId,
        sourceActionId: 'ruby-star-skill',
        targetControlSkillId: 10300201,
        targetSubSkillIndex: 1,
        startsAtMs: frameTime(0),
        endsAtMs: frameTime(0) + 4000,
      }),
    ]);

    const cappedRuntime = runVariantRuntime({
      actors: [starSkill.actor],
      actions: [starSkill],
      durationMs: 5000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: starSkill.actorId,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 12,
          },
        ],
      },
    });
    expect(cappedRuntime.resourceEvents[0]).toMatchObject({
      timeMs: frameTime(0),
      payload: {
        operation: 'set-to-capacity',
        beforeValue: 12,
        change: 0,
        afterValue: 12,
        maxValue: 12,
      },
    });

    const enhancedAfterStar = createActorAction({
      id: 'ruby-star-quick-entry-e1',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(204),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    enhancedAfterStar.attackGroupId = 'ruby-star-enhanced-chain';
    enhancedAfterStar.contextActionId = starSkill.id;
    const enhancedSecondInput = createActorAction({
      id: 'ruby-star-quick-entry-e2',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(204 + 25),
      attackInput: RUBY_A1,
      attackSequenceIndex: 2,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    enhancedSecondInput.attackGroupId = enhancedAfterStar.attackGroupId;
    enhancedSecondInput.contextActionId = enhancedAfterStar.id;
    const quickEntryRuntime = runVariantRuntime({
      actors: [starSkill.actor],
      actions: [starSkill, enhancedAfterStar, enhancedSecondInput],
      durationMs: 5000,
      initialRuntimeState: {
        specialResourcesByActor: [
          {
            actorId: starSkill.actorId,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 5,
          },
        ],
      },
    });
    expect(
      quickEntryRuntime.selectionByActionId.get(enhancedAfterStar.id)
    ).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      semanticName: '强化普攻 E1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 1,
    });
    expect(
      quickEntryRuntime.selectionByActionId.get(enhancedSecondInput.id)
    ).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      attackChainSequenceIndex: 2,
      semanticName: '强化普攻 E2',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 2,
    });
    expect(quickEntryRuntime.resourceEvents).toEqual([
      expect.objectContaining({
        actionId: 'ruby-star-skill',
        payload: expect.objectContaining({
          operation: 'set-to-capacity',
          beforeValue: 5,
          afterValue: 12,
        }),
      }),
      expect.objectContaining({
        actionId: 'ruby-star-quick-entry-e1',
        payload: expect.objectContaining({
          operation: 'consume',
          beforeValue: 12,
          afterValue: 11,
        }),
      }),
      expect.objectContaining({
        actionId: 'ruby-star-quick-entry-e2',
        payload: expect.objectContaining({
          operation: 'consume',
          beforeValue: 11,
          afterValue: 10,
        }),
      }),
    ]);
  });

  it('replays public normal-attack intent into Ruby E1 only inside the sourced A3 transition window', () => {
    const a1 = createActorAction({
      id: 'ruby-public-a1',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: 0,
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    a1.attackGroupId = 'ruby-public-default-chain';
    const a2StartFrame = RUBY_A1.linkWindow.startFrame;
    const a2 = createActorAction({
      id: 'ruby-public-a2',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(a2StartFrame),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    const a3StartFrame = a2StartFrame + RUBY_A2.linkWindow.startFrame;
    const a3 = createActorAction({
      id: 'ruby-public-a3',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(a3StartFrame),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    const inside = createActorAction({
      id: 'ruby-public-after-a3-inside',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(a3StartFrame + 34),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    const insideRuntime = runVariantRuntime({
      actors: [a3.actor],
      actions: [a1, a2, a3, inside],
      durationMs: 3000,
      initialRuntimeState: createRubyAmmoState(a3.actorId, 6),
    });
    expect(insideRuntime.selectionByActionId.get(inside.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      semanticName: '强化普攻 E1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 1,
    });
    expect(
      insideRuntime.resourceEvents.find(event => event.actionId === inside.id)
    ).toMatchObject({
      payload: {
        operation: 'consume',
        beforeValue: 6,
        afterValue: 5,
      },
    });

    const outside = {
      ...inside,
      id: 'ruby-public-after-a3-outside',
      startMs: frameTime(a3StartFrame + 79),
    };
    const outsideRuntime = runVariantRuntime({
      actors: [a3.actor],
      actions: [a1, a2, a3, outside],
      durationMs: 3000,
      initialRuntimeState: createRubyAmmoState(a3.actorId, 6),
    });
    expect(outsideRuntime.selectionByActionId.get(outside.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      semanticName: '普通攻击 A1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 0,
    });
    expect(
      outsideRuntime.resourceEvents.filter(
        event => event.actionId === outside.id
      )
    ).toEqual([]);
  });

  it('replays a materialized Ruby Star Carry window into public E1 at the block end', () => {
    const starCarry = createActorAction({
      id: 'ruby-star-carry-derived',
      characterId: RUBY_ID,
      skillId: 10300221,
      startMs: 0,
    });
    const publicAttack = createActorAction({
      id: 'ruby-public-after-star-carry',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(93),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    const runtime = runVariantRuntime({
      actors: [starCarry.actor],
      actions: [starCarry, publicAttack],
      durationMs: 4000,
      initialRuntimeState: createRubyAmmoState(starCarry.actorId, 6),
    });

    expect(runtime.activeSwitchWindows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceActionId: starCarry.id,
          sourceControlSkillId: 10300221,
          sourceSubSkillIndex: 0,
          targetControlSkillId: 10300201,
          targetSubSkillIndex: 1,
          inputWindow: {
            startFrame: 80,
            endFrame: 112,
            durationFrames: 32,
          },
          startsAtMs: 1333.333333,
          endsAtMs: 1866.666667,
        }),
      ])
    );
    expect(runtime.selectionByActionId.get(publicAttack.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      semanticName: '强化普攻 E1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 1,
    });
    expect(
      runtime.resourceEvents.find(event => event.actionId === publicAttack.id)
    ).toMatchObject({
      payload: {
        operation: 'consume',
        beforeValue: 6,
        afterValue: 5,
      },
    });
  });

  it.each([
    {
      label: 'reload',
      startFrame: 24,
      endFrame: 264,
      initialAmmo: 0,
      createSource: () =>
        createActorAction({
          id: 'ruby-entry-source-reload',
          characterId: RUBY_ID,
          skillId: 10300201,
          actionVariantIndex: 1,
          startMs: 0,
        }),
    },
    {
      label: 'Star Skill',
      startFrame: 60,
      endFrame: 300,
      initialAmmo: 0,
      createSource: () =>
        createActorAction({
          id: 'ruby-entry-source-star-skill',
          characterId: RUBY_ID,
          skillId: 10300212,
          startMs: frameTime(60),
        }),
    },
    {
      label: 'ultimate end',
      startFrame: 329,
      endFrame: 537,
      initialAmmo: 0,
      createSource: () =>
        createActorAction({
          id: 'ruby-entry-source-ultimate',
          characterId: RUBY_ID,
          skillId: 10300213,
          startMs: 0,
        }),
    },
    {
      label: 'Star Carry',
      startFrame: 80,
      endFrame: 112,
      initialAmmo: 6,
      createSource: () =>
        createActorAction({
          id: 'ruby-entry-source-star-carry',
          characterId: RUBY_ID,
          skillId: 10300221,
          startMs: 0,
        }),
    },
  ])(
    'uses the sourced half-open $label quick-entry window',
    ({ startFrame, endFrame, initialAmmo, createSource }) => {
      for (const { frame, enhanced } of [
        { frame: startFrame - 1, enhanced: false },
        { frame: startFrame, enhanced: true },
        { frame: endFrame - 1, enhanced: true },
        { frame: endFrame, enhanced: false },
      ]) {
        const source = createSource();
        const candidate = createActorAction({
          id: `${source.id}-candidate-${frame}`,
          characterId: RUBY_ID,
          skillId: 10300201,
          startMs: frameTime(frame),
          attackInput: RUBY_A1,
          attackSequenceIndex: 1,
          attackInputIntent: createPublicNormalAttackIntent(),
        });
        const runtime = runVariantRuntime({
          actors: [source.actor],
          actions: [source, candidate],
          durationMs: frameTime(endFrame + 120),
          initialRuntimeState: createRubyAmmoState(source.actorId, initialAmmo),
        });
        expect(runtime.selectionByActionId.get(candidate.id)).toMatchObject(
          enhanced
            ? {
                attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
                attackChainSequenceIndex: 1,
                semanticName: '强化普攻 E1',
              }
            : {
                attackInputChainIdentity: 'ruby-normal-default-three-inputs',
                attackChainSequenceIndex: 1,
                semanticName: '普通攻击 A1',
              }
        );
      }
    }
  );

  it('publishes an unconsumed Ruby ultimate quick-entry window for canonical successor generation', () => {
    const ultimate = createActorAction({
      id: 'ruby-prefix-ultimate',
      characterId: RUBY_ID,
      skillId: 10300213,
      startMs: 0,
    });
    const runtime = runVariantRuntime({
      actors: [ultimate.actor],
      actions: [ultimate],
      durationMs: frameTime(537),
      initialRuntimeState: createRubyAmmoState(ultimate.actorId, 0),
    });

    expect(runtime.normalAttackSpecialContinuationCandidates).toEqual([
      expect.objectContaining({
        actorId: ultimate.actorId,
        sourceKind: 'input-derived',
        sourceActionId: ultimate.id,
        targetActionId: null,
        chainIdentity: 'ruby-enhanced-twelve-inputs',
        sequenceIndex: 1,
        controlSkillId: 10300201,
        subSkillIndex: 1,
        groupId: null,
        applied: true,
      }),
    ]);
    const [candidate] = runtime.normalAttackSpecialContinuationCandidates;
    expect(candidate.startsAtMs).toBeCloseTo(frameTime(329), 5);
    expect(candidate.endsAtMs).toBeCloseTo(frameTime(537), 5);
    expect(runtime.summary.normalAttackSpecialContinuationCandidateCount).toBe(
      1
    );
  });

  it('blocks an explicit A1 fallback while a sourced Ruby dodge continuation owns the input', () => {
    const chain = mechanicsPackage.actionVariantGraph.attackInputChains.find(
      item => item.chainIdentity === 'ruby-enhanced-twelve-inputs'
    );
    const segment = chain.segments[0];
    const source = RUBY_NORMAL_MAPPING.attackInputSourceSegments.find(
      item => Number(item.controlSkillId) === Number(segment.controlSkillId)
    );
    const enhanced = createActorAction({
      id: 'ruby-exclusive-e1',
      characterId: RUBY_ID,
      skillId: 10300201,
      attackInput: projectVerifiedAttackInputChainSegment(
        source,
        segment,
        1,
        chain.segments.length,
        chain.chainIdentity
      ),
      attackSequenceIndex: 1,
    });
    enhanced.attackInputChainIdentity = chain.chainIdentity;
    enhanced.attackGroupId = 'ruby-exclusive-chain';
    const dodge = createActorAction({
      id: 'ruby-exclusive-dodge',
      characterId: RUBY_ID,
      skillId: 10300201,
      actionVariantIndex: 2,
      startMs: frameTime(segment.durationFrames),
    });
    const fallback = createActorAction({
      id: 'ruby-illegal-explicit-a1',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(segment.durationFrames + 30),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
    });
    fallback.attackInputChainSelectionSource = 'user-explicit';

    const runtime = runVariantRuntime({
      actors: [enhanced.actor],
      actions: [enhanced, dodge, fallback],
      durationMs: 10_000,
      initialRuntimeState: createRubyAmmoState(enhanced.actorId, 12),
    });

    expect(runtime.executionBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: fallback.id,
          code: 'VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT',
          reason: 'verified-normal-attack-input-phase-conflict',
          reasons: ['normal-attack-successor-window-target-conflict'],
        }),
      ])
    );
    expect(runtime.selectionByActionId.get(fallback.id)).toMatchObject({
      status: 'verified-normal-attack-input-phase-conflict',
    });
  });

  it('materializes the real A2 for one runtime-context input inside a direct successor window', () => {
    const first = createActorAction({
      id: 'ruby-single-input-a1',
      characterId: RUBY_ID,
      skillId: 10300201,
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    first.attackGroupId = 'ruby-single-input-chain';
    const generic = createActorAction({
      id: 'ruby-single-input-next',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(RUBY_A1.linkWindow.startFrame),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });

    const runtime = runVariantRuntime({
      actors: [first.actor],
      actions: [first, generic],
      durationMs: 10_000,
      initialRuntimeState: createRubyAmmoState(first.actorId, 0),
    });

    expect(runtime.executionBlocks).toEqual([]);
    expect(runtime.selectionByActionId.get(generic.id)).toMatchObject({
      attackGroupId: 'ruby-single-input-chain',
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      attackChainSequenceIndex: 2,
      executionControlSkillId: 10300202,
      selectedSubSkillIndex: 0,
      status: 'verified-action-variant-selection-ready',
    });
  });

  it('materializes mapping-backed 112001 A2 without requiring a graph chain or special resource profile', () => {
    const first = createActorAction({
      id: 'melania-mapping-only-a1',
      characterId: MELANIA_ID,
      skillId: 11200101,
      attackInput: MELANIA_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(11200101),
    });
    first.attackGroupId = 'melania-mapping-only-chain';
    const generic = createActorAction({
      id: 'melania-mapping-only-next',
      characterId: MELANIA_ID,
      skillId: 11200101,
      startMs: frameTime(MELANIA_A1.linkWindow.startFrame),
      attackInput: MELANIA_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(11200101),
    });

    const runtime = runVariantRuntime({
      actors: [first.actor],
      actions: [first, generic],
      durationMs: 10_000,
    });

    expect(runtime.executionBlocks).toEqual([]);
    expect(runtime.selectionByActionId.get(generic.id)).toMatchObject({
      attackGroupId: 'melania-mapping-only-chain',
      attackInputChainIdentity: null,
      attackChainSequenceIndex: 2,
      executionControlSkillId: 11200102,
      selectedSubSkillIndex: 0,
      status: 'verified-action-variant-selection-ready',
    });
  });

  it('materializes Misa A1 through A4 from the uniquely linked mapping prefix', () => {
    const actions = createRuntimeContextNormalAttackChain({
      ownerId: MISA_ID,
      segmentCount: 4,
    });
    const runtime = runVariantRuntime({
      actors: [actions[0].actor],
      actions,
      durationMs: frameTime(1000),
    });

    expect(runtime.executionBlocks).toEqual([]);
    expect(
      actions.map(action => runtime.selectionByActionId.get(action.id))
    ).toEqual(
      [10700201, 10700202, 10700203, 10700204].map(
        (executionControlSkillId, index) =>
          expect.objectContaining({
            attackInputChainIdentity: null,
            attackChainSequenceIndex: index + 1,
            executionControlSkillId,
            selectedSubSkillIndex: 0,
            status: 'verified-action-variant-selection-ready',
          })
      )
    );
    expect(runtime.actionResolutionById.get(actions[0].id)).toMatchObject({
      ready: true,
      status: 'verified-combat-action-mechanics-ready',
      hits: [
        expect.objectContaining({
          elementId: 107002137,
          scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        }),
        expect.objectContaining({
          elementId: 107002137,
          scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        }),
      ],
    });
    expect(runtime.actionResolutionById.get(actions[1].id)).toMatchObject({
      ready: true,
      status: 'verified-combat-action-mechanics-ready',
    });
    expect(runtime.actionResolutionById.get(actions[1].id).hits).toHaveLength(
      8
    );
  });

  it('keeps Misa A1 fail closed for wrong subskill evidence', () => {
    const fixture = structuredClone(mechanicsPackage);
    const mapping = fixture.actionMappings.find(
      candidate =>
        candidate.ownerId === MISA_ID &&
        candidate.actionKind === 'normal-attack'
    );
    mapping.attackInputSegments[0].selectedSubSkillIndex = 99;
    installVerifiedCombatMechanicsPackage(fixture);
    const [action] = createRuntimeContextNormalAttackChain({
      ownerId: MISA_ID,
      segmentCount: 1,
    });
    const runtime = runVariantRuntime({
      actors: [action.actor],
      actions: [action],
      durationMs: frameTime(1000),
    });

    expect(runtime.selectionByActionId.get(action.id)).toMatchObject({
      status: 'unresolved-action-variant-selection',
    });
    expect(runtime.actionResolutionById.get(action.id)).toMatchObject({
      ready: false,
      applied: false,
      hits: [],
    });
  });

  it.each([
    [
      'ambiguous segment evidence',
      fixture => {
        const mapping = fixture.actionMappings.find(
          candidate =>
            candidate.ownerId === MISA_ID &&
            candidate.actionKind === 'normal-attack'
        );
        mapping.attackInputSegments.push({
          ...structuredClone(mapping.attackInputSegments[0]),
          identity: `${mapping.attackInputSegments[0].identity}|ambiguous`,
        });
      },
    ],
    [
      'missing control evidence',
      fixture => {
        fixture.controlBindings = fixture.controlBindings.filter(
          control => control.controlSkillId !== 10700201
        );
        fixture.actionVariantControlBindings =
          fixture.actionVariantControlBindings.filter(
            control => control.controlSkillId !== 10700201
          );
      },
    ],
  ])('rejects Misa A1 package installation for %s', (_label, mutateFixture) => {
    const fixture = structuredClone(mechanicsPackage);
    mutateFixture(fixture);

    expect(() => installVerifiedCombatMechanicsPackage(fixture)).toThrow(
      'attack-input-segments-invalid'
    );
  });

  it('rejects a forged Misa context edge whose identity still belongs to another owner', () => {
    const fixture = structuredClone(mechanicsPackage);
    const forgedContext = fixture.actionVariantGraph.contextEdges.find(
      edge => edge.inputCommand === 'charged-attack' && edge.applied === true
    );
    forgedContext.ownerId = MISA_ID;
    forgedContext.sourceControlSkillId = 10700201;
    forgedContext.sourceSubSkillIndex = 0;
    forgedContext.targetControlSkillId = 10700210;
    forgedContext.executionControlSkillId = 10700210;
    forgedContext.targetSubSkillIndex = 0;
    forgedContext.inputWindow = {
      ...forgedContext.inputWindow,
      startFrame: 0,
      endFrame: 100,
    };

    expect(() => installVerifiedCombatMechanicsPackage(fixture)).toThrow(
      'action-variant-graph-invalid'
    );
  });

  it.each(STARBORN_IDS)(
    'keeps verified-empty STARBORN %i A1 structural-only without opening runtime channels',
    ownerId => {
      const fixture = structuredClone(mechanicsPackage);
      const mapping = fixture.actionMappings.find(
        candidate =>
          Number(candidate.ownerId) === ownerId &&
          candidate.actionKind === 'normal-attack'
      );
      const openerSegment = mapping.attackInputSegments.find(
        segment => Number(segment.sequenceIndex) === 1
      );
      const forgedContext = fixture.actionVariantGraph.contextEdges.find(
        edge =>
          Number(edge.ownerId) === ownerId &&
          edge.inputCommand === 'charged-attack' &&
          edge.applied === true
      );
      forgedContext.sourceControlSkillId = Number(openerSegment.controlSkillId);
      forgedContext.sourceSubSkillIndex = Number(
        openerSegment.subSkillIndex ?? 0
      );
      forgedContext.inputWindow = {
        ...forgedContext.inputWindow,
        startFrame: 0,
        endFrame: 100,
      };
      forgedContext.edgeIdentity =
        createVerifiedContextEdgeIdentity(forgedContext);
      installVerifiedCombatMechanicsPackage(fixture);

      const carrier = createRuntimeContextNormalAttackAction({
        ownerId,
        id: `starborn-${ownerId}-verified-empty-a1`,
        startFrame: 0,
        groupId: `starborn-${ownerId}-verified-empty-chain`,
      });
      const charged = createActorAction({
        id: `starborn-${ownerId}-charged-after-empty-a1`,
        characterId: ownerId,
        skillId: Number(mapping.sourceSkillId),
        actionKind: 'charged-attack',
        actionVariantIndex: 1,
        startMs: frameTime(10),
        contextActionId: carrier.id,
      });
      const contextRuntime = runVariantRuntime({
        actors: [carrier.actor],
        actions: [carrier, charged],
        durationMs: frameTime(500),
      });

      expect(contextRuntime.actionResolutionById.get(carrier.id)).toMatchObject(
        {
          ready: true,
          complete: true,
          status: 'verified-combat-action-mechanics-verified-empty-timing-only',
          hits: [],
          effects: [],
        }
      );
      expect(contextRuntime.selectionByActionId.get(charged.id)).toMatchObject({
        edgeIdentity: null,
        contextActionId: null,
      });
      expect(
        contextRuntime.resourceEvents.filter(
          event => event.actionId === carrier.id
        )
      ).toEqual([]);
      expect(
        contextRuntime.effectCommands.filter(
          command =>
            command.actionId === carrier.id ||
            command.sourceActionId === carrier.id
        )
      ).toEqual([]);
      expect(
        contextRuntime.activeSwitchWindows.filter(
          window => window.actionId === carrier.id
        )
      ).toEqual([]);
      expect(
        contextRuntime.companionEvents.filter(
          event => event.actionId === carrier.id
        )
      ).toEqual([]);

      const successor = createRuntimeContextNormalAttackAction({
        ownerId,
        id: `starborn-${ownerId}-authority-a2`,
        startFrame: Number(openerSegment.linkWindow.startFrame),
        groupId: carrier.attackGroupId,
      });
      const chainRuntime = runVariantRuntime({
        actors: [carrier.actor],
        actions: [carrier, successor],
        durationMs: frameTime(500),
      });
      expect(chainRuntime.selectionByActionId.get(successor.id)).toMatchObject({
        attackChainSequenceIndex: 2,
        executionControlSkillId: Number(
          mapping.attackInputSegments.find(
            segment => Number(segment.sequenceIndex) === 2
          ).controlSkillId
        ),
        status: 'verified-action-variant-selection-ready',
      });
    }
  );

  it('keeps Sifliya A1-to-A2 right-open and does not infer the unsourced A3 edge', () => {
    const mapping = normalMappingByOwnerId.get(SIFLIYA_ID);
    const opener = createRuntimeContextNormalAttackAction({
      ownerId: SIFLIYA_ID,
      id: 'sifliya-authority-a1',
      startFrame: 0,
      groupId: 'sifliya-authority-chain',
    });
    const runAt = frame => {
      const successor = createRuntimeContextNormalAttackAction({
        ownerId: SIFLIYA_ID,
        id: `sifliya-authority-next-${frame}`,
        startFrame: frame,
        groupId: 'sifliya-authority-chain',
      });
      return {
        successor,
        runtime: runVariantRuntime({
          actors: [opener.actor],
          actions: [opener, successor],
          durationMs: frameTime(400),
        }),
      };
    };

    for (const frame of [20, 71]) {
      const { runtime, successor } = runAt(frame);
      expect(runtime.selectionByActionId.get(successor.id)).toMatchObject({
        attackInputChainIdentity: 'sifliya-normal-three-inputs',
        attackChainSequenceIndex: 2,
        executionControlSkillId: 10700102,
        selectedSubSkillIndex: 4,
        status: 'verified-action-variant-selection-ready',
      });
    }
    for (const [frame, reason] of [
      [19, 'normal-attack-successor-window-not-open'],
      [72, 'normal-attack-recovery-not-complete'],
    ]) {
      const { runtime, successor } = runAt(frame);
      expect(runtime.selectionByActionId.get(successor.id)).toMatchObject({
        status: 'verified-normal-attack-input-phase-conflict',
      });
      expect(runtime.executionBlocks).toContainEqual(
        expect.objectContaining({
          actionId: successor.id,
          reasons: [reason],
        })
      );
    }
    expect(mapping.attackInputSegments[1].linkWindow).toBeNull();
  });

  it('keeps Moyin A5 executable only after the complete verified mapping chain', () => {
    const actions = createRuntimeContextNormalAttackChain({
      ownerId: MOYIN_ID,
      segmentCount: 5,
    });
    const runtime = runVariantRuntime({
      actors: [actions[0].actor],
      actions,
      durationMs: frameTime(1500),
    });
    const a5 = actions[4];

    expect(runtime.executionBlocks).toEqual([]);
    expect(runtime.selectionByActionId.get(a5.id)).toMatchObject({
      attackInputChainIdentity: 'moyin-normal-five-inputs',
      attackChainSequenceIndex: 5,
      executionControlSkillId: 10900105,
      selectedSubSkillIndex: 0,
      actualDurationFrames: 78,
      status: 'verified-action-variant-selection-ready',
    });
    expect(runtime.actionResolutionById.get(a5.id)).toMatchObject({
      ready: true,
      actionBinding: {
        attackInputSegment: expect.objectContaining({
          controlSkillId: 10900105,
          sequenceIndex: 5,
        }),
      },
    });
  });

  it('cancels only the unresolved Moyin A5 owner tail when switching out', () => {
    const chain = createRuntimeContextNormalAttackChain({
      ownerId: MOYIN_ID,
      segmentCount: 5,
    }).map((action, index) => ({
      ...action,
      sourceSequencePath: [index],
    }));
    const a5 = chain[4];
    const switchAction = {
      id: 'moyin-switch-after-a5',
      type: 'switch',
      actorId: a5.actorId,
      targetActorId: 'actor-103002',
      startMs: a5.startMs + frameTime(64),
      sourceSequencePath: [chain.length],
    };
    const ruby = { id: 'actor-103002', characterId: RUBY_ID, name: '红宝石' };
    const actions = attachVerifiedSwitchExitTailPolicies({
      actions: [...chain, switchAction],
      actors: [a5.actor, ruby],
      team: {
        slots: [
          { slotId: 'moyin', actorId: a5.actorId },
          { slotId: 'ruby', actorId: ruby.id },
        ],
      },
      initialRuntimeState: {
        controlledActor: {
          actorId: a5.actorId,
          characterId: MOYIN_ID,
        },
      },
      time: { fps: 60 },
    });
    const runtime = runVariantRuntime({
      actors: [a5.actor, ruby],
      actions,
      durationMs: frameTime(1500),
    });
    const resolution = runtime.actionResolutionById.get(a5.id);

    expect(runtime.executionBlocks).toEqual([]);
    expect(resolution.hits.map(hit => hit.trigger.startFrame)).toEqual([
      4, 8, 12, 16, 20, 47, 56, 61,
    ]);
    expect(resolution.switchExitTailSettlement).toMatchObject({
      status: 'owner-bound-tail-cancelled-at-switch-boundary',
      cancelledPacketCount: 2,
      retainedHitCount: 8,
    });
    expect(runtime.summary).toMatchObject({
      switchExitCancelledPacketCount: 2,
    });
  });

  it('retains the selected kibo signature tail while switch-exit waits behind the fluent behavior', () => {
    const jade = {
      id: 'actor-101010',
      characterId: JADE_ID,
      name: '涂山小玉',
      loadout: { kiboId: 500001 },
    };
    const ruby = {
      id: 'actor-103002',
      characterId: RUBY_ID,
      name: '红宝石',
    };
    const kiboSignature = {
      id: 'kibo-500001-signature-before-switch',
      type: 'kiboEvent',
      actorId: jade.id,
      actor: jade,
      kiboId: 500001,
      skillId: 50000102,
      actionKind: 'signature',
      eventType: 'signature',
      startMs: 0,
      durationMs: frameTime(85),
      sourceSequencePath: [0],
    };
    const switchAction = {
      id: 'switch-after-kibo-signature-start',
      type: 'switch',
      actorId: jade.id,
      targetActorId: ruby.id,
      startMs: frameTime(21),
      durationMs: 0,
      sourceSequencePath: [1],
    };
    const actions = attachVerifiedSwitchExitTailPolicies({
      actions: [kiboSignature, switchAction],
      actors: [jade, ruby],
      team: {
        slots: [
          { slotId: 'jade', actorId: jade.id },
          { slotId: 'ruby', actorId: ruby.id },
        ],
      },
      initialRuntimeState: {
        controlledActor: {
          actorId: jade.id,
          characterId: JADE_ID,
        },
      },
      time: { fps: 60 },
    });
    const runtime = runVariantRuntime({
      actors: [jade, ruby],
      actions,
      durationMs: frameTime(120),
      initialRuntimeState: {
        controlledActor: {
          actorId: jade.id,
          characterId: JADE_ID,
        },
      },
    });
    const resolution = runtime.actionResolutionById.get(kiboSignature.id);

    expect(runtime.executionBlocks).toEqual([]);
    expect(resolution.hits.map(hit => hit.trigger.startFrame)).toEqual([
      20, 20, 20, 24, 24, 24, 27, 27, 27,
    ]);
    expect(resolution.switchExitTailSettlement).toMatchObject({
      status: 'switch-exit-tail-settlement-closed',
      cancelledPacketCount: 0,
      retainedHitCount: 9,
      retainedEffectCount: 1,
    });
    expect(runtime.summary).toMatchObject({
      switchExitTailSettlementCount: 1,
      switchExitCancelledPacketCount: 0,
    });
    const formalDiagnostics = createActionRuleDiagnostics({
      scenario: {
        formalActionLegality: true,
        time: { durationMs: frameTime(120), fps: 60 },
        actors: [jade, ruby],
        team: {
          slots: [
            { slotId: 'jade', actorId: jade.id },
            { slotId: 'ruby', actorId: ruby.id },
          ],
        },
        actions,
        initialRuntimeState: {
          controlledActor: {
            actorId: jade.id,
            characterId: JADE_ID,
          },
        },
      },
      actionResolutionById: runtime.actionResolutionById,
    });
    expect(formalDiagnostics.diagnostics.map(item => item.code)).not.toContain(
      'kibo-switch-exit-tail-order-unresolved'
    );
  });

  it('retains mapping-only Melania A4 as the source of the verified heavy-3 context', () => {
    const attacks = createRuntimeContextNormalAttackChain({
      ownerId: MELANIA_ID,
      segmentCount: 4,
    });
    const a4 = attacks[3];
    const charged = createActorAction({
      id: 'melania-heavy-3-after-a4',
      characterId: MELANIA_ID,
      skillId: 11200101,
      actionKind: 'charged-attack',
      actionVariantIndex: 1,
      startMs: a4.startMs + frameTime(36),
      contextActionId: a4.id,
      variantInputSelection: {
        mode: 'release',
        inputFrame: 67,
      },
    });
    const runtime = runVariantRuntime({
      actors: [a4.actor],
      actions: [...attacks, charged],
      durationMs: frameTime(1500),
    });

    expect(runtime.selectionByActionId.get(a4.id)).toMatchObject({
      executionControlSkillId: 11200104,
      status: 'verified-action-variant-selection-ready',
    });
    expect(runtime.selectionByActionId.get(charged.id)).toMatchObject({
      executionControlSkillId: 11200141,
      selectedSubSkillIndex: 2,
      sourceKind: 'verified-charging-release-window',
      chargingRelease: {
        bindingIdentity: 'gisele-heavy3-charge-release-sub3',
      },
      status: 'verified-action-variant-selection-ready',
    });
  });

  it.each([
    [25, 10800310, 1, 'miti-charge-light', 50],
    [29, 10800341, 0, 'miti-charge-medium', 54],
    [52, 10800341, 0, 'miti-charge-medium', 77],
    [67, 10800342, 0, 'miti-charge-full', 92],
  ])(
    'uses source-order-first for Miti Charging at %sF',
    (
      inputFrame,
      executionControlSkillId,
      selectedSubSkillIndex,
      selectedWindowIdentity,
      durationFrames
    ) => {
      const charged = createActorAction({
        id: `miti-charged-release-${inputFrame}`,
        characterId: MITI_ID,
        skillId: 10800301,
        actionKind: 'charged-attack',
        actionVariantIndex: 1,
        variantInputSelection: { mode: 'release', inputFrame },
      });
      const runtime = runVariantRuntime({
        actors: [charged.actor],
        actions: [charged],
        durationMs: frameTime(500),
      });

      expect(runtime.executionBlocks).toEqual([]);
      expect(runtime.selectionByActionId.get(charged.id)).toMatchObject({
        executionControlSkillId,
        selectedSubSkillIndex,
        sourceKind: 'verified-charging-release-window',
        chargingRelease: {
          bindingIdentity: 'miti-charge-release-sub0',
          selectedWindowIdentity,
          releaseFrame: inputFrame,
        },
        actualDurationFrames: durationFrames,
        status: 'verified-action-variant-selection-ready',
      });
      expect(runtime.actionResolutionById.get(charged.id)).toMatchObject({
        ready: true,
        chargingRelease: {
          selectedWindowIdentity,
          durationFrames,
        },
      });
    }
  );

  it('retains every Miti full-charge orb pulse after the projectile has materialized', () => {
    const { runtime, resolution, assessment, scenario } =
      runMitiFullChargeWithSwitch(100);
    const strongOrbHits = resolution.hits.filter(
      hit =>
        hit.trigger?.sourceBindingIdentity ===
        'miti-full-charge-strong-orb-twelve-pulses'
    );
    const strongOrbEvidence = assessment.packetEvidence.filter(packet =>
      strongOrbHits.some(hit => hit.hitIdentity === packet.packetIdentity)
    );
    const baseProjectile = resolution.hits.find(hit =>
      String(hit.trigger?.kind ?? '').includes('projectile')
    );
    const unresolvedFrameEffects = resolution.effects.filter(effect =>
      String(effect.effectIdentity).includes('unresolved-frame')
    );

    expect(baseProjectile?.trigger).toMatchObject({
      launchFrame: 70,
      impactFrame: 70,
    });
    expect(unresolvedFrameEffects).toHaveLength(11);
    expect(unresolvedFrameEffects.every(effect => effect.trigger == null)).toBe(
      true
    );
    expect(strongOrbHits).toHaveLength(12);
    expect(strongOrbHits.map(hit => hit.trigger.startFrame)).toEqual([
      70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180,
    ]);
    expect(strongOrbEvidence).toHaveLength(12);
    expect(strongOrbEvidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          materializationFrame: 70,
          materializationKind: 'landed-hit-spawned-projectile',
          disposition: 'detached-packet-retained',
        }),
      ])
    );
    expect(
      strongOrbEvidence
        .filter(packet => packet.settlementFrame >= 100)
        .every(packet => packet.disposition === 'detached-packet-retained')
    ).toBe(true);
    expect(resolution.switchExitTailSettlement).toMatchObject({
      status: 'switch-exit-tail-settlement-closed',
      cancelledPacketCount: 0,
    });
    const formalDiagnostics = createActionRuleDiagnostics({
      scenario: { ...scenario, formalActionLegality: true },
      actionResolutionById: runtime.actionResolutionById,
    });
    expect(formalDiagnostics.diagnostics.map(item => item.code)).not.toContain(
      ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED
    );
  });

  it('cancels Miti full-charge release packets when switching before projectile materialization', () => {
    const { resolution } = runMitiFullChargeWithSwitch(69);

    expect(resolution.switchExitTailSettlement).toMatchObject({
      status: 'owner-bound-tail-cancelled-at-switch-boundary',
      cancelledPacketCount: 42,
    });
    expect(
      resolution.switchExitTailSettlement.cancelledHitIdentities
    ).toHaveLength(39);
    expect(
      resolution.switchExitTailSettlement.cancelledEffectIdentities
    ).toHaveLength(3);
    expect(
      resolution.hits.filter(hit => hit.chargingReleaseFrameOffset === 67)
    ).toEqual([]);
  });

  it('fails Miti full-charge switch order closed on the exact projectile materialization frame', () => {
    const { runtime, resolution, assessment, scenario } =
      runMitiFullChargeWithSwitch(70);

    expect(resolution.switchExitTailSettlement).toBeUndefined();
    expect(assessment).toMatchObject({
      status: ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED,
      evidenceClosed: false,
      packetEvidence: expect.arrayContaining([
        expect.objectContaining({
          materializationFrame: 70,
          materializationBoundaryOrder: 'delayed-packet-order-unresolved',
          disposition: 'future-owner-bound-packet-unresolved',
        }),
      ]),
    });
    const formalDiagnostics = createActionRuleDiagnostics({
      scenario: { ...scenario, formalActionLegality: true },
      actionResolutionById: runtime.actionResolutionById,
    });
    expect(formalDiagnostics.diagnostics.map(item => item.code)).toContain(
      ACTOR_SWITCH_EXIT_TAIL_UNRESOLVED
    );
  });

  it('fails Miti Charging closed at the right-open 209F boundary', () => {
    const charged = createActorAction({
      id: 'miti-charged-release-209',
      characterId: MITI_ID,
      skillId: 10800301,
      actionKind: 'charged-attack',
      actionVariantIndex: 1,
      variantInputSelection: { mode: 'release', inputFrame: 209 },
    });
    const runtime = runVariantRuntime({
      actors: [charged.actor],
      actions: [charged],
      durationMs: frameTime(500),
    });

    expect(runtime.executionBlocks).toContainEqual(
      expect.objectContaining({
        actionId: charged.id,
        code: 'verified-charging-release-selection-unresolved',
        reason: 'charging-release-window-missing',
      })
    );
  });

  it.each([199001, 199002])(
    'uses the chain segment control for STARBORN %s A1 before admitting A2',
    ownerId => {
      const actions = createRuntimeContextNormalAttackChain({
        ownerId,
        segmentCount: 2,
      });
      const runtime = runVariantRuntime({
        actors: [actions[0].actor],
        actions,
        durationMs: frameTime(500),
      });

      expect(runtime.executionBlocks).toEqual([]);
      expect(runtime.selectionByActionId.get(actions[0].id)).toMatchObject({
        publicControlSkillId: ownerId * 100 + 1,
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 0,
        status: 'verified-action-variant-selection-ready',
      });
      expect(runtime.selectionByActionId.get(actions[1].id)).toMatchObject({
        attackChainSequenceIndex: 2,
        executionControlSkillId: ownerId * 100 + 2,
        selectedSubSkillIndex: 0,
        status: 'verified-action-variant-selection-ready',
      });
    }
  );

  it.each([
    [199001, 'charged-attack', 73],
    [199001, 'star-skill', 65],
    [199002, 'charged-attack', 73],
    [199002, 'star-skill', 65],
  ])(
    'prioritizes STARBORN %s %s genuine context thrust over the default normal chain',
    (ownerId, sourceKind, thrustFrame) => {
      const mapping = normalMappingByOwnerId.get(ownerId);
      const groupId = `starborn-${ownerId}-${sourceKind}-context-chain`;
      const source = createStarbornContextSource({ ownerId, sourceKind });
      const thrust = createStarbornContextNormalAction({
        ownerId,
        id: `starborn-${ownerId}-${sourceKind}-thrust`,
        startFrame: thrustFrame,
        contextActionId: source.id,
        sequenceIndex: 1,
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 1,
        sourceSegment: mapping.attackInputSegments[0],
        groupId,
      });
      const a3 = createStarbornContextNormalAction({
        ownerId,
        id: `starborn-${ownerId}-${sourceKind}-a3`,
        startFrame: thrustFrame + 32,
        contextActionId: thrust.id,
        sequenceIndex: 3,
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 0,
        sourceSegment: mapping.attackInputSegments[2],
        groupId,
      });
      const runtime = runVariantRuntime({
        actors: [source.actor],
        actions: [source, thrust, a3],
        durationMs: frameTime(500),
      });

      expect(runtime.executionBlocks).toEqual([]);
      expect(runtime.selectionByActionId.get(source.id)).toMatchObject(
        sourceKind === 'charged-attack'
          ? {
              executionControlSkillId: ownerId * 100 + 10,
              selectedSubSkillIndex: 1,
            }
          : {
              executionControlSkillId: ownerId * 100 + 12,
              selectedSubSkillIndex: 0,
            }
      );
      expect(runtime.selectionByActionId.get(thrust.id)).toMatchObject({
        publicControlSkillId: ownerId * 100 + 3,
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 1,
        sourceKind: 'verified-input-context-variant',
        contextActionId: source.id,
        status: 'verified-action-variant-selection-ready',
      });
      expect(runtime.selectionByActionId.get(a3.id)).toMatchObject({
        publicControlSkillId: ownerId * 100 + 3,
        executionControlSkillId: ownerId * 100 + 3,
        selectedSubSkillIndex: 0,
        sourceKind: 'verified-input-context-variant',
        contextActionId: thrust.id,
        status: 'verified-action-variant-selection-ready',
      });
    }
  );

  it.each(STARBORN_IDS)(
    'keeps STARBORN %i genuine context windows unique and right-open',
    ownerId => {
      const fixture = structuredClone(mechanicsPackage);
      const edge = fixture.actionVariantGraph.contextEdges.find(
        candidate =>
          Number(candidate.ownerId) === ownerId &&
          Number(candidate.sourceControlSkillId) === ownerId * 100 + 12 &&
          candidate.inputCommand === 'normal-attack'
      );
      const source = createStarbornContextSource({
        ownerId,
        sourceKind: 'star-skill',
      });
      const mapping = normalMappingByOwnerId.get(ownerId);
      const runAt = (frame, controlSkillId = ownerId * 100 + 3) => {
        const thrust = createStarbornContextNormalAction({
          ownerId,
          id: `starborn-${ownerId}-boundary-${frame}-${controlSkillId}`,
          startFrame: frame,
          contextActionId: source.id,
          sequenceIndex: 1,
          controlSkillId,
          subSkillIndex: controlSkillId === ownerId * 100 + 3 ? 1 : 0,
          sourceSegment: mapping.attackInputSegments[0],
        });
        return {
          thrust,
          runtime: runVariantRuntime({
            actors: [source.actor],
            actions: [source, thrust],
            durationMs: frameTime(500),
          }),
        };
      };

      const atStart = runAt(Number(edge.inputWindow.startFrame));
      expect(
        atStart.runtime.selectionByActionId.get(atStart.thrust.id)
      ).toMatchObject({
        sourceKind: 'verified-input-context-variant',
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 1,
      });

      const beforeStart = runAt(Number(edge.inputWindow.startFrame) - 1);
      expect(beforeStart.runtime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: beforeStart.thrust.id })
      );
      expect(
        beforeStart.runtime.selectionByActionId.get(beforeStart.thrust.id)
      ).toMatchObject({
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 0,
      });

      const beforeEnd = runAt(Number(edge.inputWindow.endFrame) - 1);
      expect(
        beforeEnd.runtime.selectionByActionId.get(beforeEnd.thrust.id)
      ).toMatchObject({
        sourceKind: 'verified-input-context-variant',
        contextualInputScheduling: {
          resolutionKind: 'direct-input-window',
          inputOffsetFrame: Number(edge.inputWindow.endFrame) - 1,
        },
      });

      const atEnd = runAt(Number(edge.inputWindow.endFrame));
      const edgeIntent = edge.inputScheduling?.edgeIntent;
      if (
        Number(edgeIntent?.predecessorGenericEndFrame) ===
        Number(edge.inputWindow.endFrame)
      ) {
        expect(
          atEnd.runtime.selectionByActionId.get(atEnd.thrust.id)
        ).toMatchObject({
          sourceKind: 'verified-input-context-variant',
          contextualInputScheduling: {
            resolutionKind: 'edge-intent-contextual-transition',
            inputOffsetFrame: Number(edgeIntent.canonicalInputFrame),
            executionStartOffsetFrame: Number(
              edgeIntent.canonicalExecutionStartFrame
            ),
          },
        });
      } else {
        expect(atEnd.runtime.executionBlocks).not.toContainEqual(
          expect.objectContaining({ actionId: atEnd.thrust.id })
        );
        expect(
          atEnd.runtime.selectionByActionId.get(atEnd.thrust.id)
        ).toMatchObject({
          executionControlSkillId: ownerId * 100 + 1,
          selectedSubSkillIndex: 0,
        });
      }

      const outsideWindow = runAt(Number(edge.inputWindow.endFrame) + 1);
      expect(outsideWindow.runtime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: outsideWindow.thrust.id })
      );
      expect(
        outsideWindow.runtime.selectionByActionId.get(outsideWindow.thrust.id)
      ).toMatchObject({
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 0,
      });

      const wrongTarget = runAt(
        Number(edge.inputWindow.startFrame),
        ownerId * 100 + 1
      );
      expect(wrongTarget.runtime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: wrongTarget.thrust.id })
      );
      expect(
        wrongTarget.runtime.selectionByActionId.get(wrongTarget.thrust.id)
      ).toMatchObject({
        sourceKind: 'verified-input-context-variant',
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 1,
      });

      fixture.actionVariantGraph.contextEdges.push({
        ...structuredClone(edge),
      });
      installVerifiedCombatMechanicsPackage(fixture);
      const ambiguous = runAt(Number(edge.inputWindow.startFrame));
      expect(ambiguous.runtime.executionBlocks).toContainEqual(
        expect.objectContaining({
          actionId: ambiguous.thrust.id,
          reason: 'verified-context-window-input-ambiguous',
        })
      );
    }
  );

  it.each(STARBORN_IDS)(
    'resolves STARBORN %i left clicks independently of stale display metadata',
    ownerId => {
      const mapping = normalMappingByOwnerId.get(ownerId);
      const source = createStarbornContextSource({
        ownerId,
        sourceKind: 'charged-attack',
      });
      const createThrust = overrides =>
        createStarbornContextNormalAction({
          ownerId,
          id: `starborn-${ownerId}-${overrides.id}`,
          startFrame: 73,
          contextActionId: source.id,
          sequenceIndex: 1,
          controlSkillId: ownerId * 100 + 3,
          subSkillIndex: 1,
          sourceSegment: mapping.attackInputSegments[0],
          groupId: 'starborn-special-context-group',
          ...overrides,
        });
      const run = (actions, actors = [source.actor]) =>
        runVariantRuntime({ actors, actions, durationMs: frameTime(500) });

      const missing = createThrust({
        id: 'missing-context',
        contextActionId: 'missing-source',
      });
      const missingRuntime = run([missing]);
      expect(missingRuntime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: missing.id })
      );
      expect(missingRuntime.selectionByActionId.get(missing.id)).toMatchObject({
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 0,
      });

      const foreignSource = structuredClone(source);
      foreignSource.actorId = `foreign-${ownerId}`;
      foreignSource.actor.id = foreignSource.actorId;
      const crossActor = createThrust({ id: 'cross-actor' });
      const crossActorRuntime = run(
        [foreignSource, crossActor],
        [foreignSource.actor, crossActor.actor]
      );
      expect(crossActorRuntime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: crossActor.id })
      );
      expect(
        crossActorRuntime.selectionByActionId.get(crossActor.id)
      ).toMatchObject({
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 0,
      });

      const validThrust = createThrust({ id: 'valid-thrust' });
      const wrongGroup = createStarbornContextNormalAction({
        ownerId,
        id: `starborn-${ownerId}-wrong-group-a3`,
        startFrame: 105,
        contextActionId: validThrust.id,
        sequenceIndex: 3,
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 0,
        sourceSegment: mapping.attackInputSegments[2],
        groupId: 'different-context-group',
      });
      const wrongGroupRuntime = run([source, validThrust, wrongGroup]);
      expect(wrongGroupRuntime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: wrongGroup.id })
      );
      expect(
        wrongGroupRuntime.selectionByActionId.get(wrongGroup.id)
      ).toMatchObject({
        executionControlSkillId: ownerId * 100 + 3,
        selectedSubSkillIndex: 0,
      });

      const wrongSequence = createThrust({
        id: 'wrong-sequence',
        sequenceIndex: 2,
        sourceSegment: mapping.attackInputSegments[1],
      });
      const wrongSequenceRuntime = run([source, wrongSequence]);
      expect(wrongSequenceRuntime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: wrongSequence.id })
      );
      expect(
        wrongSequenceRuntime.selectionByActionId.get(wrongSequence.id)
      ).toMatchObject({
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 1,
      });

      const strippedIdentity = createThrust({ id: 'stripped-identity' });
      delete strippedIdentity.attackInput.identity;
      const strippedRuntime = run([source, strippedIdentity]);
      expect(strippedRuntime.executionBlocks).not.toContainEqual(
        expect.objectContaining({ actionId: strippedIdentity.id })
      );
      expect(
        strippedRuntime.selectionByActionId.get(strippedIdentity.id)
      ).toMatchObject({
        executionControlSkillId: ownerId * 100 + 1,
        selectedSubSkillIndex: 1,
      });
    }
  );

  it('rejects an external scenario that forges a verified context continuation proof', () => {
    const melaniaA2 = MELANIA_NORMAL_MAPPING.attackInputSegments.find(
      segment => Number(segment.sequenceIndex) === 2
    );
    const teamSlots = [
      { slotId: 'team-slot-1', position: 0, characterId: MELANIA_ID },
      { slotId: 'team-slot-2', position: 1, characterId: 101007 },
      { slotId: 'team-slot-3', position: 2, characterId: 101003 },
    ];
    const selection = {
      ...DEFAULT_WORKBENCH_SELECTION,
      characterId: MELANIA_ID,
      secondaryCharacterId: 101007,
    };
    const actorConfigs = normalizeWorkbenchActorConfigs(
      [],
      selection,
      teamSlots
    );
    const project = createWorkbenchProject(selection, {
      durationMs: frameTime(500),
      teamSlots,
      actorConfigs,
      actions: [
        createWorkbenchActionDraft({
          id: 'external-forged-a2',
          type: 'skill',
          actorCharacterId: MELANIA_ID,
          skillId: 11200101,
          actionVariantIndex: 0,
          actionKind: 'normal-attack',
          startMs: frameTime(18),
          durationMs: frameTime(melaniaA2.durationFrames),
          attackGroupId: 'external-forged-chain',
          attackSequenceIndex: 2,
          attackSequenceTotal: 5,
          attackInput: melaniaA2,
        }),
      ],
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    scenario.objectiveContract = { classification: 'primary' };
    const forged = scenario.actions.find(
      action => action.id === 'external-forged-a2'
    );
    forged.verifiedContextContinuation = {
      status: 'verified-context-continuation-ready',
      edgeIdentity: 'caller-forged-edge',
      contextActionId: 'caller-forged-source',
    };

    const result = simulateScenario(scenario);

    expect(
      result.actionExecutionPlan.actions.find(
        action => action.actionId === forged.id
      )
    ).toMatchObject({ execute: false });
    expect(result.actionRuleDiagnostics.diagnostics).toContainEqual(
      expect.objectContaining({
        actionId: forged.id,
        code: ACTION_RULE_CODES.ATTACK_INPUT_CHAIN_INCOMPLETE,
      })
    );
  });

  it('blocks an explicit fresh 112001 A1 in the sourced A2 window even when its group changes', () => {
    const first = createActorAction({
      id: 'melania-exclusive-a1',
      characterId: MELANIA_ID,
      skillId: 11200101,
      attackInput: MELANIA_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(11200101),
    });
    first.attackGroupId = 'melania-original-chain';
    const fallback = createActorAction({
      id: 'melania-illegal-fresh-a1',
      characterId: MELANIA_ID,
      skillId: 11200101,
      startMs: frameTime(MELANIA_A1.linkWindow.startFrame),
      attackInput: MELANIA_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(11200101),
    });
    fallback.attackInputChainSelectionSource = 'user-explicit';
    fallback.attackGroupId = 'melania-forged-fresh-group';

    const runtime = runVariantRuntime({
      actors: [first.actor],
      actions: [first, fallback],
      durationMs: 10_000,
    });

    expect(runtime.executionBlocks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: fallback.id,
          code: 'VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT',
          reason: 'verified-normal-attack-input-phase-conflict',
          reasons: ['normal-attack-successor-window-target-conflict'],
        }),
      ])
    );
    expect(runtime.selectionByActionId.get(fallback.id)).toMatchObject({
      status: 'verified-normal-attack-input-phase-conflict',
    });
  });

  it('emits one Red Heat stack per enhanced input through the compiled passive runtime', () => {
    const enhanced = createActorAction({
      id: 'ruby-one-red-heat-stack',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: 0,
      attackInput: {
        ...RUBY_A1,
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        controlSkillId: 10300201,
        selectedSubSkillIndex: 1,
        sequenceIndex: 1,
        sequenceTotal: 12,
      },
      attackSequenceIndex: 1,
    });
    enhanced.attackInputChainIdentity = 'ruby-enhanced-twelve-inputs';
    const runtime = runVariantRuntime({
      actors: [enhanced.actor],
      actions: [enhanced],
      durationMs: 1000,
      initialRuntimeState: createRubyAmmoState(enhanced.actorId, 12),
    });

    expect(runtime.effectCommands).toHaveLength(1);
    expect(runtime.effectCommands[0]).toMatchObject({
      sourceActionId: enhanced.id,
      timeMs: 0,
      stackDelta: 1,
      maxStacks: 6,
    });
  });

  it.each([
    { previousSequence: 1, expectedSequence: 2 },
    { previousSequence: 3, expectedSequence: 4 },
    { previousSequence: 11, expectedSequence: 12 },
  ])(
    'preserves Ruby enhanced sequence E$previousSequence through a sourced dodge continuity window',
    ({ previousSequence, expectedSequence }) => {
      const chain = mechanicsPackage.actionVariantGraph.attackInputChains.find(
        item => item.chainIdentity === 'ruby-enhanced-twelve-inputs'
      );
      const actorId = `actor-${RUBY_ID}`;
      let cursorFrame = 0;
      const enhancedActions = chain.segments
        .slice(0, previousSequence)
        .map((segment, index) => {
          const source = RUBY_NORMAL_MAPPING.attackInputSourceSegments.find(
            item =>
              Number(item.controlSkillId) === Number(segment.controlSkillId)
          );
          const attackInput = projectVerifiedAttackInputChainSegment(
            source,
            segment,
            index + 1,
            previousSequence,
            chain.chainIdentity
          );
          const action = createActorAction({
            id: `ruby-continuity-e${index + 1}`,
            characterId: RUBY_ID,
            skillId: 10300201,
            startMs: frameTime(cursorFrame),
            attackInput,
            attackSequenceIndex: index + 1,
          });
          action.attackInputChainIdentity = chain.chainIdentity;
          action.attackGroupId = 'ruby-continuity-source-group';
          action.attackSequenceTotal = previousSequence;
          cursorFrame += Number(segment.durationFrames);
          return action;
        });
      const dodge = createActorAction({
        id: `ruby-continuity-dodge-after-e${previousSequence}`,
        characterId: RUBY_ID,
        skillId: 10300201,
        actionVariantIndex: 2,
        startMs: frameTime(cursorFrame),
      });
      const resumed = createActorAction({
        id: `ruby-continuity-resume-e${expectedSequence}`,
        characterId: RUBY_ID,
        skillId: 10300201,
        startMs: frameTime(cursorFrame + 30),
        attackInput: RUBY_A1,
        attackSequenceIndex: 1,
        attackInputIntent: createPublicNormalAttackIntent(),
      });
      const runtime = runVariantRuntime({
        actors: [enhancedActions[0].actor],
        actions: [...enhancedActions, dodge, resumed],
        durationMs: 10_000,
        initialRuntimeState: createRubyAmmoState(actorId, 12),
      });

      expect(runtime.selectionByActionId.get(resumed.id)).toMatchObject({
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        attackChainSequenceIndex: expectedSequence,
        semanticName: `强化普攻 E${expectedSequence}`,
      });
      expect(
        runtime.resourceEvents.find(event => event.actionId === resumed.id)
      ).toMatchObject({
        payload: {
          operation: 'consume',
          beforeValue: 12 - previousSequence,
          afterValue: 11 - previousSequence,
        },
      });
    }
  );

  it('resets Ruby enhanced continuity after the sourced dodge window or a switch-out', () => {
    const chain = mechanicsPackage.actionVariantGraph.attackInputChains.find(
      item => item.chainIdentity === 'ruby-enhanced-twelve-inputs'
    );
    const segment = chain.segments[2];
    const source = RUBY_NORMAL_MAPPING.attackInputSourceSegments.find(
      item => Number(item.controlSkillId) === Number(segment.controlSkillId)
    );
    const e3 = createActorAction({
      id: 'ruby-reset-e3',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: 0,
      attackInput: projectVerifiedAttackInputChainSegment(
        source,
        segment,
        3,
        3,
        chain.chainIdentity
      ),
      attackSequenceIndex: 3,
    });
    e3.attackInputChainIdentity = chain.chainIdentity;
    const dodge = createActorAction({
      id: 'ruby-reset-dodge',
      characterId: RUBY_ID,
      skillId: 10300201,
      actionVariantIndex: 2,
      startMs: frameTime(segment.durationFrames),
    });
    const outside = createActorAction({
      id: 'ruby-reset-outside',
      characterId: RUBY_ID,
      skillId: 10300201,
      startMs: frameTime(segment.durationFrames + 246),
      attackInput: RUBY_A1,
      attackSequenceIndex: 1,
      attackInputIntent: createPublicNormalAttackIntent(),
    });
    const switched = {
      id: 'ruby-reset-switch',
      type: 'switch',
      actorId: e3.actorId,
      targetActorId: 'actor-other',
      targetCharacterId: 101003,
      startMs: frameTime(segment.durationFrames + 10),
      durationMs: 0,
    };
    const insideAfterSwitch = {
      ...outside,
      id: 'ruby-reset-after-switch',
      startMs: frameTime(segment.durationFrames + 30),
    };

    const outsideRuntime = runVariantRuntime({
      actors: [e3.actor],
      actions: [e3, dodge, outside],
      durationMs: 10_000,
      initialRuntimeState: createRubyAmmoState(e3.actorId, 12),
    });
    expect(outsideRuntime.selectionByActionId.get(outside.id)).toMatchObject({
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      semanticName: '普通攻击 A1',
    });

    const switchedRuntime = runVariantRuntime({
      actors: [
        e3.actor,
        { id: 'actor-other', characterId: 101003, name: '寒悠悠' },
      ],
      actions: [e3, dodge, switched, insideAfterSwitch],
      durationMs: 10_000,
      initialRuntimeState: createRubyAmmoState(e3.actorId, 12),
    });
    expect(
      switchedRuntime.selectionByActionId.get(insideAfterSwitch.id)
    ).toMatchObject({
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      semanticName: '普通攻击 A1',
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

  it('binds a contextual input to its explicit predecessor across an interleaved action and fails closed without the identity', () => {
    const source = createActorAction({
      id: 'context-source-charged',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: 0,
    });
    const interleaved = createActorAction({
      id: 'context-interleaved-normal',
      characterId: JADE_ID,
      skillId: 10101001,
      startMs: frameTime(80),
      attackInput: JADE_A1,
    });
    const explicit = createActorAction({
      id: 'context-explicit-continuous',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(99),
      contextActionId: source.id,
    });
    const selected = runVariantRuntime({
      actors: [source.actor],
      actions: [source, interleaved, explicit],
      durationMs: 8000,
    });

    expect(selected.selectionByActionId.get(explicit.id)).toMatchObject({
      controlSkillId: 10101010,
      selectedSubSkillIndex: 1,
      semanticName: '连续重击',
      sourceKind: 'verified-input-context-variant',
      contextActionId: source.id,
      contextualInputScheduling: {
        inputOffsetFrame: 99,
      },
    });

    const implicit = createActorAction({
      id: 'context-implicit-default',
      characterId: JADE_ID,
      skillId: 10101001,
      actionVariantIndex: 2,
      startMs: frameTime(99),
    });
    const rejected = runVariantRuntime({
      actors: [source.actor],
      actions: [source, interleaved, implicit],
      durationMs: 8000,
    });
    expect(rejected.selectionByActionId.get(implicit.id)).toMatchObject({
      controlSkillId: 10101010,
      selectedSubSkillIndex: 0,
      semanticName: '普通重击',
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
          runtime.selectionByActionId.get(charged.id)?.contextualInputScheduling
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
    expect(xiaoyuActionOccupancyAudit.rows).toHaveLength(23);

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
    expect(threshold.tuningMarkTransactions).toEqual([
      expect.objectContaining({
        actionId: charged.id,
        timeMs: thresholdFrameMs,
        profileKey: 'wind',
        stackDelta: 2,
        status: 'verified-threshold-tuning-mark-grant-ready',
        applied: true,
      }),
    ]);
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
    expect(enteredByUltimate.tuningMarkTransactions).toEqual([]);
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

  it('requires the verified parry event and never treats a limit-counter input window as a passive trigger', () => {
    const perfectParry = createActorAction({
      id: 'jade-perfect-parry',
      characterId: JADE_ID,
      skillId: 10101021,
      actionVariantIndex: 2,
      startMs: frameTime(60),
    });
    const parryEvent = {
      id: 'jade-perfect-parry-event',
      type: 'enemyEvent',
      eventType: 'successful-parry',
      startMs: frameTime(60),
      durationMs: 0,
    };
    const accepted = runVariantRuntime({
      actors: [perfectParry.actor],
      actions: [parryEvent, perfectParry],
      durationMs: 4000,
    });
    expect(accepted.selectionByActionId.get(perfectParry.id)).toMatchObject({
      semanticName: '完美招架反击',
      executionControlSkillId: 10101049,
      selectedSubSkillIndex: 1,
      actualDurationFrames: 36,
    });
    expect(accepted.executionBlocks).toEqual([]);
    expect(
      accepted.effectCommands.filter(
        command =>
          command.sourceActionId === perfectParry.id &&
          command.effectId === 'battle-element:101010206'
      )
    ).toHaveLength(1);

    const rejected = runVariantRuntime({
      actors: [perfectParry.actor],
      actions: [perfectParry],
      durationMs: 4000,
    });
    expect(rejected.executionBlocks).toEqual([
      expect.objectContaining({
        actionId: perfectParry.id,
        reason: 'verified-action-execution-prerequisite-missing',
      }),
    ]);
    expect(
      rejected.effectCommands.some(
        command => command.sourceActionId === perfectParry.id
      )
    ).toBe(false);

    const limitCounter = createActorAction({
      id: 'jade-limit-counter-only',
      characterId: JADE_ID,
      skillId: 10101021,
      actionVariantIndex: 1,
      startMs: 0,
    });
    const limitRuntime = runVariantRuntime({
      actors: [limitCounter.actor],
      actions: [limitCounter],
      durationMs: 4000,
    });
    expect(
      limitRuntime.effectCommands.some(
        command =>
          command.sourceActionId === limitCounter.id &&
          command.effectId === 'battle-element:101010206'
      )
    ).toBe(false);
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
  level = 1,
  actionVariantIndex = 0,
  startMs = 0,
  attackInput = null,
  attackSequenceIndex = null,
  attackInputIntent = null,
  variantInputSelection = null,
  contextActionId = null,
  actionKind = null,
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
    ...(actionKind ? { actionKind } : {}),
    level,
    actionVariantIndex,
    startMs,
    durationMs: 1000,
    attackInputIntent,
    variantInputSelection,
    ...(contextActionId ? { contextActionId } : {}),
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

function createRuntimeContextNormalAttackChain({ ownerId, segmentCount }) {
  const mapping = normalMappingByOwnerId.get(Number(ownerId));
  const actions = [];
  let startFrame = 0;
  for (
    let sequenceIndex = 1;
    sequenceIndex <= segmentCount;
    sequenceIndex += 1
  ) {
    actions.push(
      createRuntimeContextNormalAttackAction({
        ownerId,
        id: `authority-${ownerId}-a${sequenceIndex}`,
        startFrame,
        groupId: `authority-${ownerId}-chain`,
      })
    );
    const segment = mapping.attackInputSegments.find(
      candidate => Number(candidate.sequenceIndex) === sequenceIndex
    );
    if (sequenceIndex < segmentCount) {
      startFrame += Number(segment.linkWindow.startFrame);
    }
  }
  return actions;
}

function createRuntimeContextNormalAttackAction({
  ownerId,
  id,
  startFrame,
  groupId,
}) {
  const mapping = normalMappingByOwnerId.get(Number(ownerId));
  const opener = mapping.attackInputSegments.find(
    segment => Number(segment.sequenceIndex) === 1
  );
  const action = createActorAction({
    id,
    characterId: Number(ownerId),
    skillId: Number(mapping.sourceSkillId),
    actionKind: 'normal-attack',
    startMs: frameTime(startFrame),
    attackInput: opener,
    attackSequenceIndex: 1,
    attackInputIntent: createPublicNormalAttackIntent(mapping.sourceSkillId),
  });
  action.attackGroupId = groupId;
  return action;
}

function createStarbornContextSource({ ownerId, sourceKind }) {
  return createActorAction({
    id: `starborn-${ownerId}-${sourceKind}-source`,
    characterId: ownerId,
    skillId:
      sourceKind === 'charged-attack' ? ownerId * 100 + 1 : ownerId * 100 + 12,
    actionKind: sourceKind,
    actionVariantIndex: sourceKind === 'charged-attack' ? 1 : 0,
    startMs: 0,
    variantInputSelection:
      sourceKind === 'charged-attack'
        ? {
            selectorIdentity: `starborn-${ownerId}-derived-charged`,
            publicVariantIndex: 1,
          }
        : null,
  });
}

function createStarbornContextNormalAction({
  ownerId,
  id,
  startFrame,
  contextActionId,
  sequenceIndex,
  controlSkillId,
  subSkillIndex,
  sourceSegment,
  groupId = `${id}-group`,
}) {
  const action = createActorAction({
    id,
    characterId: ownerId,
    skillId: ownerId * 100 + 1,
    actionKind: 'normal-attack',
    startMs: frameTime(startFrame),
    contextActionId,
    attackSequenceIndex: sequenceIndex,
    attackInput: {
      ...sourceSegment,
      sequenceIndex,
      controlSkillId,
      subSkillIndex,
      selectedSubSkillIndex: subSkillIndex,
    },
    attackInputIntent: {
      ...createPublicNormalAttackIntent(ownerId * 100 + 1),
      normalFormResolution: NORMAL_ATTACK_INPUT_RESOLUTION_MODE,
    },
  });
  action.attackGroupId = groupId;
  return action;
}

function readResourceGainAtFrame(runtime, actionId, frame) {
  return runtime.resourceEvents.find(
    event =>
      event.actionId === actionId &&
      event.timeMs === frameTime(frame) &&
      event.payload.operation === 'gain'
  )?.payload;
}

function createPublicNormalAttackIntent(sourceSkillId = 10300201) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrWorkbenchAttackInputIntent',
    kind: 'public-normal-attack',
    selectionMode: 'runtime-context',
    sourceSkillId,
    sourceIdentity: 'workbench-public-normal-attack-input',
  };
}

function createRubyAmmoState(actorId, currentValue) {
  return {
    specialResourcesByActor: [
      {
        actorId,
        resourceIdentity: 'actor:103002:element:103002047',
        currentValue,
      },
    ],
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

function runMitiFullChargeWithSwitch(switchFrame) {
  const charged = createActorAction({
    id: `miti-full-charge-before-switch-${switchFrame}`,
    characterId: MITI_ID,
    skillId: 10800301,
    actionKind: 'charged-attack',
    actionVariantIndex: 1,
    variantInputSelection: { mode: 'release', inputFrame: 67 },
  });
  charged.sourceSequencePath = [0];
  const ruby = {
    id: `actor-${RUBY_ID}`,
    characterId: RUBY_ID,
    name: '红宝石',
  };
  const switchAction = {
    id: `miti-switch-at-${switchFrame}`,
    type: 'switch',
    actorId: charged.actorId,
    targetActorId: ruby.id,
    startMs: frameTime(switchFrame),
    durationMs: 0,
    sourceSequencePath: [1],
  };
  const initialRuntimeState = {
    controlledActor: {
      actorId: charged.actorId,
      characterId: MITI_ID,
    },
  };
  const actors = [charged.actor, ruby];
  const team = {
    slots: [
      { slotId: 'miti', actorId: charged.actorId },
      { slotId: 'ruby', actorId: ruby.id },
    ],
  };
  const actions = attachVerifiedSwitchExitTailPolicies({
    actions: [charged, switchAction],
    actors,
    team,
    initialRuntimeState,
    time: { fps: 60 },
  });
  const scenario = {
    time: { durationMs: frameTime(240), fps: 60 },
    actors,
    team,
    actions,
    initialRuntimeState,
  };
  const runtime = runVariantRuntime({
    actors,
    actions,
    durationMs: scenario.time.durationMs,
    initialRuntimeState,
  });
  const resolution = runtime.actionResolutionById.get(charged.id);
  const assessment = createVerifiedRuntimeSwitchExitTailAssessment({
    policy: actions[0].switchExitTailPolicy,
    resolution,
    mechanicsPackage,
  });
  return { runtime, resolution, assessment, scenario };
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

  const publicForm = mechanicsPackage.actionVariantGraph.publicActionForms.find(
    item =>
      item.publicActionIdentity === form.publicActionIdentity ||
      (Number(item.executionControlSkillId) ===
        Number(form.sourceControlSkillId) &&
        Number(item.executionSubSkillIndex) ===
          Number(form.sourceSubSkillIndex) &&
        String(item.publicActionKind) === String(form.actionKind))
  );
  const mapping = mechanicsPackage.actionMappings.find(
    item =>
      Number(item.ownerId) === JADE_ID &&
      String(item.actionKind) === String(form.actionKind) &&
      Number(item.controlSkillId) ===
        Number(publicForm?.publicControlSkillId ?? form.sourceControlSkillId)
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
  const prerequisite =
    publicForm?.executionPrerequisite?.kind === 'scenario-event-at-action-frame'
      ? {
          id: `audited-${form.actionKind}-event`,
          type: 'enemyEvent',
          eventType: publicForm.executionPrerequisite.eventType,
          startMs: focus.startMs,
          durationMs: 0,
        }
      : null;
  return {
    focus,
    actions: prerequisite ? [prerequisite, focus] : [focus],
    initialRuntimeState: null,
  };
}

function frameTime(frame) {
  return (frame * 1000) / 60;
}
