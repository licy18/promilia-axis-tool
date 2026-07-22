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
