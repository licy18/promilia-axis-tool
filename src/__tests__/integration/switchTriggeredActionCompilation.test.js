import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import { projectVerifiedAttackInputChainSegment } from '../../domain/verifiedActionContextScheduling';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';

describe('switch triggered action compilation', () => {
  beforeEach(() => installVerifiedCombatMechanicsPackage(mechanicsPackage));
  afterEach(() => clearInstalledVerifiedCombatMechanicsPackage());

  it('persists one switch and compiles deterministic read-only star-carry children', () => {
    const scenario = compileProject(
      createSwitchProject({ startMs: 1000 }),
      getWorkbenchGameData()
    );
    const parent = scenario.actions.find(action => action.id === 'switch-1');
    const children = scenario.actions.filter(
      action => action.parentActionId === 'switch-1'
    );
    expect(parent).toMatchObject({
      type: 'switch',
      durationMs: 0,
      switchTriggerBindings: [
        expect.objectContaining({ triggerPhase: 'on-exit', applied: true }),
        expect.objectContaining({ triggerPhase: 'on-enter', applied: true }),
      ],
    });
    expect(children).toHaveLength(2);
    expect(children.map(action => action.skillId).sort()).toEqual([
      10100322, 10100721,
    ]);
    expect(children.every(action => action.readOnly)).toBe(true);
    expect(scenario.switchTriggerGeneration.summary).toMatchObject({
      switchEventCount: 1,
      derivedActionCount: 2,
    });
  });

  it('moves or deletes the parent without persisting orphan children', () => {
    const moved = compileProject(
      createSwitchProject({ startMs: 2000 }),
      getWorkbenchGameData()
    );
    expect(
      moved.actions
        .filter(action => action.parentActionId === 'switch-1')
        .map(action => action.startMs)
    ).toEqual([2000, 2000]);

    const deleted = compileProject(
      createSwitchProject({ includeSwitch: false }),
      getWorkbenchGameData()
    );
    expect(deleted.actions.some(action => action.parentActionId)).toBe(false);
  });

  it('blocks a legacy standalone star-carry but still applies its parent switch', () => {
    const project = createSwitchProject({ startMs: 1000 });
    const starCarrySkill = getWorkbenchGameData().skills.find(
      skill => Number(skill.id) === 10100322
    );
    project.actions.push({
      id: 'legacy-star-carry',
      type: 'skill',
      actorId: 'actor-101003',
      skillId: starCarrySkill.id,
      actionKind: 'star-carry',
      name: starCarrySkill.name,
      startMs: 5000,
      durationMs: 1000,
      targetId: project.enemy.id,
      level: 1,
      damageSegmentIndex: 0,
      actionVariantIndex: 0,
      effectCommands: [],
    });
    const result = simulateScenario(
      compileProject(project, getWorkbenchGameData())
    );
    expect(result.actionExecutionPlan.skippedActionIds).toContain(
      'legacy-star-carry'
    );
    expect(result.actionExecutionPlan.executedActionIds).toContain('switch-1');
    expect(
      result.actionRuleDiagnostics.diagnostics.find(
        item => item.actionId === 'legacy-star-carry'
      )?.code
    ).toBe('star-carry-switch-trigger-required');
  });

  it('keeps a manual action executable after a cooldown-suppressed switch trigger', () => {
    const project = createCooldownSwitchProject();
    const scenario = compileProject(project, getWorkbenchGameData());
    expect(
      scenario.actions.filter(
        action => action.parentActionId === 'switch-during-cooldown'
      )
    ).toEqual([]);
    expect(
      scenario.actions.find(action => action.id === 'switch-during-cooldown')
        ?.switchTriggerBindings
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resolutionStatus: 'suppressed-cooldown-active',
          materializationStatus: 'not-materialized',
          applied: false,
        }),
      ])
    );

    const result = simulateScenario(scenario);
    expect(result.actionExecutionPlan.executedActionIds).toContain(
      'manual-after-suppressed-trigger'
    );
    expect(
      result.actionRuleDiagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.actionIds?.includes('manual-after-suppressed-trigger') &&
          diagnostic.code === 'lane-overlap'
      )
    ).toEqual([]);
  });

  it('replays a materialized Ruby Star Carry into thunder mark and public E1', () => {
    const project = createRubyStarCarryProject();
    const scenario = compileProject(project, getWorkbenchGameData());
    const starCarry = scenario.actions.find(
      action =>
        action.parentActionId === 'switch-to-ruby' &&
        Number(action.skillId) === 10300221
    );
    expect(starCarry).toMatchObject({
      actorId: 'actor-103002',
      durationFrames: 93,
      startMs: 1000,
      readOnly: true,
    });

    const result = simulateScenario(scenario);
    const publicAttack =
      result.verifiedActionVariantRuntime.selectionByActionId.get(
        'ruby-public-normal-after-star-carry'
      );
    expect(publicAttack).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      attackChainSequenceIndex: 1,
      semanticName: '强化普攻 E1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 1,
    });
    expect(
      result.verifiedActionVariantRuntime.resourceEvents.find(
        event =>
          event.actionId === 'ruby-public-normal-after-star-carry'
      )
    ).toMatchObject({
      payload: {
        resourceIdentity: 'actor:103002:element:103002047',
        operation: 'consume',
        beforeValue: 6,
        change: -1,
        afterValue: 5,
      },
    });
    expect(
      result.verifiedTuningMarkGeneration.events.find(
        event =>
          event.actionId === starCarry.id &&
          event.profileKey === 'thunder' &&
          event.kind === 'acquire'
      )
    ).toMatchObject({
      timeMs: 1900,
      markId: 250,
      before: 0,
      delta: 1,
      after: 1,
    });
    expect(
      result.actionRuleDiagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code === 'lane-overlap' &&
          diagnostic.actionIds?.includes(
            'ruby-public-normal-after-star-carry'
          )
      )
    ).toEqual([]);
  });

  it('suppresses Ruby Star Carry effects and quick entry while its cooldown is active', () => {
    const project = createRubyCooldownSwitchProject();
    const scenario = compileProject(project, getWorkbenchGameData());
    const firstStarCarry = scenario.actions.find(
      action =>
        action.parentActionId === 'switch-to-ruby-first' &&
        Number(action.skillId) === 10300221
    );
    expect(firstStarCarry).toBeTruthy();
    expect(
      scenario.actions.filter(
        action =>
          action.parentActionId === 'switch-to-ruby-during-cooldown' &&
          Number(action.skillId) === 10300221
      )
    ).toEqual([]);
    expect(
      scenario.actions.find(
        action => action.id === 'switch-to-ruby-during-cooldown'
      )?.switchTriggerBindings
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          starCarryActionIdentity: expect.stringContaining('10300221'),
          resolutionStatus: 'suppressed-cooldown-active',
          materializationStatus: 'not-materialized',
          applied: false,
        }),
      ])
    );

    const result = simulateScenario(scenario);
    expect(
      result.verifiedActionVariantRuntime.selectionByActionId.get(
        'ruby-public-normal-after-suppressed-switch'
      )
    ).toMatchObject({
      attackInputChainIdentity: 'ruby-normal-default-three-inputs',
      attackChainSequenceIndex: 1,
      semanticName: '普通攻击 A1',
      executionControlSkillId: 10300201,
      selectedSubSkillIndex: 0,
    });
    expect(
      result.verifiedTuningMarkGeneration.events.filter(
        event => event.profileKey === 'thunder' && event.kind === 'acquire'
      )
    ).toEqual([
      expect.objectContaining({
        actionId: firstStarCarry.id,
        markId: 250,
      }),
    ]);
    expect(
      result.verifiedActionVariantRuntime.activeSwitchWindows.filter(
        window => Number(window.sourceControlSkillId) === 10300221
      )
    ).toHaveLength(1);
    expect(result.actionExecutionPlan.executedActionIds).toContain(
      'ruby-public-normal-after-suppressed-switch'
    );
    expect(
      result.actionRuleDiagnostics.diagnostics.filter(
        diagnostic =>
          diagnostic.code === 'lane-overlap' &&
          diagnostic.actionIds?.includes(
            'ruby-public-normal-after-suppressed-switch'
          )
      )
    ).toEqual([]);
  });

  it('settles Ruby E1-E12 ammo, Red Heat, and every-third-input fire overlimit exactly once', () => {
    const scenario = compileProject(
      createRubyEnhancedChainProject(),
      getWorkbenchGameData()
    );
    const result = simulateScenario(scenario);
    const ammoEvents =
      result.verifiedActionVariantRuntime.resourceEvents.filter(
        event =>
          event.payload.resourceIdentity ===
            'actor:103002:element:103002047' &&
          event.payload.operation === 'consume'
      );
    expect(ammoEvents).toHaveLength(12);
    expect(
      ammoEvents.map(event => [
        event.actionId,
        event.payload.beforeValue,
        event.payload.afterValue,
      ])
    ).toEqual(
      Array.from({ length: 12 }, (_, index) => [
        `ruby-enhanced-e${index + 1}`,
        12 - index,
        11 - index,
      ])
    );

    const redHeatCommands =
      result.verifiedActionVariantRuntime.effectCommands.filter(
        command =>
          command.effectId === 'battle-element:103002275' &&
          command.stackDelta === 1
      );
    expect(redHeatCommands).toHaveLength(12);
    expect(redHeatCommands.map(command => command.sourceActionId)).toEqual(
      Array.from({ length: 12 }, (_, index) => `ruby-enhanced-e${index + 1}`)
    );

    const fireConsumes = result.verifiedTuningMarkGeneration.events.filter(
      event => event.profileKey === 'fire' && event.kind === 'consume'
    );
    expect(
      fireConsumes.map(event => [
        event.actionId,
        event.before,
        event.delta,
        event.after,
      ])
    ).toEqual([
      ['ruby-enhanced-e3', 4, -1, 3],
      ['ruby-enhanced-e6', 3, -1, 2],
      ['ruby-enhanced-e9', 2, -1, 1],
      ['ruby-enhanced-e12', 1, -1, 0],
    ]);
    expect(
      result.verifiedTuningMarkGeneration.combatEvents
        .filter(
          event =>
            event.kind === 'overlimit-damage' &&
            event.profile?.key === 'fire'
        )
        .map(event => event.actionId)
    ).toEqual([
      'ruby-enhanced-e3',
      'ruby-enhanced-e6',
      'ruby-enhanced-e9',
      'ruby-enhanced-e12',
    ]);
  });
});

function createSwitchProject({ startMs = 1000, includeSwitch = true } = {}) {
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 101007 },
    { slotId: 'team-slot-3', position: 2, characterId: 103002 },
  ];
  return createWorkbenchProject(
    {
      characterId: 101003,
      secondaryCharacterId: 101007,
      tertiaryCharacterId: 103002,
    },
    {
      teamSlots,
      actions: includeSwitch
        ? [
            {
              id: 'switch-1',
              type: 'switch',
              actorCharacterId: 101003,
              targetCharacterId: 101007,
              startMs,
              durationMs: 0,
              note: '切换至芃芃',
            },
          ]
        : [],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
      },
    }
  );
}

function createCooldownSwitchProject() {
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 101007 },
    { slotId: 'team-slot-3', position: 2, characterId: 103002 },
  ];
  return createWorkbenchProject(
    {
      characterId: 101003,
      secondaryCharacterId: 101007,
      tertiaryCharacterId: 103002,
    },
    {
      teamSlots,
      actions: [
        {
          id: 'switch-first',
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 101007,
          startMs: 1000,
          durationMs: 0,
        },
        {
          id: 'switch-reset',
          type: 'switch',
          actorCharacterId: 101007,
          targetCharacterId: 101003,
          startMs: 8000,
          durationMs: 0,
        },
        {
          id: 'switch-during-cooldown',
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 101007,
          startMs: 9000,
          durationMs: 0,
        },
        {
          id: 'manual-after-suppressed-trigger',
          type: 'skill',
          actorCharacterId: 101007,
          skillId: 10100701,
          startMs: 9100,
          durationMs: 1000,
          level: 1,
          actionVariantIndex: 0,
        },
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
      },
    }
  );
}

function createRubyStarCarryProject() {
  const rubyA1 = mechanicsPackage.actionMappings
    .find(
      mapping =>
        Number(mapping.ownerId) === 103002 &&
        mapping.actionKind === 'normal-attack'
    )
    .attackInputSegments.find(segment => segment.sequenceIndex === 1);
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 103002 },
    { slotId: 'team-slot-3', position: 2, characterId: 101010 },
  ];
  return createWorkbenchProject(
    {
      characterId: 101003,
      secondaryCharacterId: 103002,
      tertiaryCharacterId: 101010,
    },
    {
      teamSlots,
      actions: [
        {
          id: 'switch-to-ruby',
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 103002,
          startMs: 1000,
          durationMs: 0,
        },
        {
          id: 'ruby-public-normal-after-star-carry',
          type: 'skill',
          actorCharacterId: 103002,
          skillId: 10300201,
          actionKind: 'normal-attack',
          actionVariantIndex: 0,
          startMs: 2550,
          durationMs: 250,
          level: 1,
          attackGroupId: 'ruby-public-normal-after-star-carry-group',
          attackSequenceIndex: 1,
          attackSequenceTotal: 1,
          attackInput: rubyA1,
          attackInputIntent: {
            schemaVersion: 1,
            contractName: 'AzPrWorkbenchAttackInputIntent',
            kind: 'public-normal-attack',
            selectionMode: 'runtime-context',
            sourceSkillId: 10300201,
            sourceIdentity:
              'switch-triggered-star-carry-integration-test',
          },
        },
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
        specialResourcesByActor: [
          {
            actorId: 'actor-103002',
            characterId: 103002,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 6,
            maxValue: 12,
          },
        ],
      },
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    }
  );
}

function createRubyCooldownSwitchProject() {
  const rubyA1 = mechanicsPackage.actionMappings
    .find(
      mapping =>
        Number(mapping.ownerId) === 103002 &&
        mapping.actionKind === 'normal-attack'
    )
    .attackInputSegments.find(segment => segment.sequenceIndex === 1);
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 101003 },
    { slotId: 'team-slot-2', position: 1, characterId: 103002 },
    { slotId: 'team-slot-3', position: 2, characterId: 101010 },
  ];
  return createWorkbenchProject(
    {
      characterId: 101003,
      secondaryCharacterId: 103002,
      tertiaryCharacterId: 101010,
    },
    {
      teamSlots,
      actions: [
        {
          id: 'switch-to-ruby-first',
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 103002,
          startMs: 1000,
          durationMs: 0,
        },
        {
          id: 'switch-away-from-ruby',
          type: 'switch',
          actorCharacterId: 103002,
          targetCharacterId: 101003,
          startMs: 4000,
          durationMs: 0,
        },
        {
          id: 'switch-to-ruby-during-cooldown',
          type: 'switch',
          actorCharacterId: 101003,
          targetCharacterId: 103002,
          startMs: 5000,
          durationMs: 0,
        },
        {
          id: 'ruby-public-normal-after-suppressed-switch',
          type: 'skill',
          actorCharacterId: 103002,
          skillId: 10300201,
          actionKind: 'normal-attack',
          actionVariantIndex: 0,
          startMs: 5100,
          durationMs: 250,
          level: 1,
          attackGroupId: 'ruby-public-normal-after-suppressed-switch-group',
          attackSequenceIndex: 1,
          attackSequenceTotal: 1,
          attackInput: rubyA1,
          attackInputIntent: {
            schemaVersion: 1,
            contractName: 'AzPrWorkbenchAttackInputIntent',
            kind: 'public-normal-attack',
            selectionMode: 'runtime-context',
            sourceSkillId: 10300201,
            sourceIdentity: 'ruby-cooldown-suppression-integration-test',
          },
        },
      ],
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-101003',
          characterId: 101003,
        },
        specialResourcesByActor: [
          {
            actorId: 'actor-103002',
            characterId: 103002,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 6,
            maxValue: 12,
          },
        ],
      },
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    }
  );
}

function createRubyEnhancedChainProject() {
  const chain = mechanicsPackage.actionVariantGraph.attackInputChains.find(
    item => item.chainIdentity === 'ruby-enhanced-twelve-inputs'
  );
  const mapping = mechanicsPackage.actionMappings.find(
    item =>
      Number(item.ownerId) === 103002 &&
      item.actionKind === 'normal-attack'
  );
  let cursorFrame = 60;
  const actions = chain.segments.map((segment, index) => {
    const sourceSegment = mapping.attackInputSourceSegments.find(
      item => Number(item.controlSkillId) === Number(segment.controlSkillId)
    );
    const attackInput = {
      ...projectVerifiedAttackInputChainSegment(
        sourceSegment,
        segment,
        index + 1,
        chain.segments.length,
        chain.chainIdentity
      ),
      attackInputChainIdentity: chain.chainIdentity,
    };
    const action = {
      id: `ruby-enhanced-e${index + 1}`,
      type: 'skill',
      actorCharacterId: 103002,
      skillId: 10300201,
      actionKind: 'normal-attack',
      actionVariantIndex: 0,
      startMs: (cursorFrame * 1000) / 60,
      durationMs: (Number(segment.durationFrames) * 1000) / 60,
      durationFrames: Number(segment.durationFrames),
      level: 1,
      attackGroupId: 'ruby-enhanced-full-chain',
      attackSequenceIndex: index + 1,
      attackSequenceTotal: chain.segments.length,
      attackInputChainIdentity: chain.chainIdentity,
      attackInput,
    };
    cursorFrame += Number(segment.durationFrames);
    return action;
  });
  const fireProfile = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
    profile => profile.key === 'fire'
  );
  const teamSlots = [
    { slotId: 'team-slot-1', position: 0, characterId: 103002 },
    { slotId: 'team-slot-2', position: 1, characterId: 101010 },
    { slotId: 'team-slot-3', position: 2, characterId: 101003 },
  ];
  return createWorkbenchProject(
    {
      characterId: 103002,
      secondaryCharacterId: 101010,
      tertiaryCharacterId: 101003,
    },
    {
      durationMs: 10_000,
      teamSlots,
      actions,
      initialRuntimeState: {
        controlledActor: {
          actorId: 'actor-103002',
          characterId: 103002,
        },
        specialResourcesByActor: [
          {
            actorId: 'actor-103002',
            characterId: 103002,
            resourceIdentity: 'actor:103002:element:103002047',
            currentValue: 12,
            maxValue: 12,
          },
        ],
        tuningMarks: [
          {
            markId: fireProfile.markId,
            profileKey: fireProfile.key,
            elementName: fireProfile.element,
            heldReadyRemainingMs: 0,
            layers: Array.from({ length: 4 }, (_, index) => ({
              remainingDurationMs: 20_000,
              sourceActionId: `inherited-fire-${index + 1}`,
              sourceActorId: 'actor-103002',
              sourceIdentity: {
                profile: fireProfile.sourceIdentity,
                layer: index + 1,
              },
            })),
          },
        ],
      },
      mechanicsProfileSelection:
        createVerifiedWorkbenchMechanicsProfileSelection(),
    }
  );
}
