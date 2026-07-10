import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKBENCH_SELECTION,
  DEFAULT_WORKBENCH_TEAM_SLOTS,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
  normalizeWorkbenchTeamSlots,
} from '../../domain/workbenchProjectFactory';
import { validateProject } from '../../domain/projectSchema';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createToughnessRuntimeSampleFixture } from '../../simulation/fixtures/toughnessRuntimeSampleFixture';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';
import { bindWorkbenchRuntimeSampleCaptures } from '../../domain/workbenchRuntimeSampleCapture';

describe('workbench project actor configuration', () => {
  it('projects persisted runtime sample captures into project metadata', () => {
    const runtimeSampleCapture = createToughnessRuntimeSampleFixture();
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      runtimeSampleCaptures: [runtimeSampleCapture],
    });

    expect(project.metadata.runtimeSampleCaptures).toEqual([
      expect.objectContaining({
        captureSessionId: 'fixture-toughness-109001081-v1',
        events: [
          expect.objectContaining({
            eventType: 'toughness-damage-applied',
            toughnessDeltaApplied: 70,
          }),
        ],
      }),
    ]);
    expect(
      compileProject(project, getWorkbenchGameData()).runtimeSampleCaptures
    ).toHaveLength(1);
  });

  it('applies a bound RecoverSP capture to the Workbench runtime resource curve', () => {
    const baseProject = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    const binding = bindWorkbenchRuntimeSampleCaptures({
      captures: [
        createRecoverSpRuntimeSampleFixture({
          actionId: 'captured-action-77',
          actorId: 'captured-actor-77',
        }),
      ],
      project: baseProject,
      selectedActionId: 'action-0001',
    });
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      runtimeSampleCaptures: binding.captures,
    });
    const result = simulateScenario(
      compileProject(project, getWorkbenchGameData())
    );

    expect(result.actionResultTimeline[0].selfEnergyChange).toMatchObject({
      value: 0,
      applied: false,
      runtimeFormulaProbe: expect.objectContaining({
        runtimeSamplingProbe: expect.objectContaining({
          importStatus: 'offline-runtime-samples-validated',
        }),
      }),
    });
    expect(
      result.threeValueGenerationLayer.deltas.find(
        delta =>
          delta.trackKey === 'selfEnergyChange' && delta.layerKey === 'applied'
      )
    ).toEqual(
      expect.objectContaining({
        layerKey: 'applied',
        energyDelta: 0.3375,
        calculationStatus: 'runtime-final-confirmed-recover-sp-sample',
      })
    );
    expect(result.threeValueRuntimeProjection.summary).toMatchObject({
      selfEnergyDelta: 0.3375,
      selfEnergyPointCount: 1,
      simLogCount: 2,
    });
  });

  it('projects real AzPr loadout selections into actors and project loadouts', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actorConfigs: [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          level: 80,
          loadout: {
            kiboId: 500001,
            equipment: {
              weapon: 1010111,
              top: 1020111,
              bottom: 1030111,
              earring: 1040111,
              ring: 1050111,
            },
            soulessenceId: 10001,
          },
        },
      ],
    });

    expect(project.actors[0]).toMatchObject({
      characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
      level: 80,
      loadout: {
        actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.characterId}`,
        characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
        kiboId: 500001,
        equipment: {
          weapon: 1010111,
          top: 1020111,
          bottom: 1030111,
          earring: 1040111,
          ring: 1050111,
        },
        soulessenceId: 10001,
      },
    });
    expect(project.loadouts).toEqual(
      project.actors.map(actor => actor.loadout)
    );
    expect(project.metadata.loadoutCalculationStatus).toBe(
      'project-config-only'
    );
    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
  });

  it('keeps one normalized actor configuration for each selected team member', () => {
    const normalized = normalizeWorkbenchActorConfigs(
      [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          loadout: {
            kiboId: 999999999,
            equipment: {
              weapon: 1020111,
            },
            soulessenceId: 999999999,
          },
        },
      ],
      DEFAULT_WORKBENCH_SELECTION
    );

    expect(normalized.map(config => config.characterId)).toEqual([
      DEFAULT_WORKBENCH_SELECTION.characterId,
      DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
    ]);
    expect(normalized[0].loadout).toMatchObject({
      kiboId: null,
      equipment: {
        weapon: null,
      },
      soulessenceId: null,
    });
  });

  it('projects independent initial SP into scenario and runtime baselines', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actorConfigs: [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          initialSp: 0.25,
        },
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
          initialSp: 0.75,
        },
      ],
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const simulation = simulateScenario(scenario);

    expect(project.actors.map(actor => actor.initialSp)).toEqual([0.25, 0.75]);
    expect(scenario.actors.map(actor => actor.initialSp)).toEqual([0.25, 0.75]);
    expect(
      simulation.runtimeOutputs.stateSnapshots.summary.selfEnergyFinalByActor
    ).toEqual([
      expect.objectContaining({
        actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.characterId}`,
        initialValue: 0.25,
        currentValue: 0.25,
        baselineStatus: 'baseline-derived-from-scenario-actor-self-energy',
      }),
      expect.objectContaining({
        actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId}`,
        initialValue: 0.75,
        currentValue: 0.75,
        baselineStatus: 'baseline-derived-from-scenario-actor-self-energy',
      }),
    ]);
    expect(
      simulation.threeValueGenerationLayer.deltas.find(delta => delta.applied)
        ?.mechanismContext?.sourceActor?.energy
    ).toMatchObject({
      initialValue: 0.25,
      currentValue: null,
      status: 'initial-sp-project-configured-runtime-current-pending',
    });
    expect(simulation.threeValueRuntimeProjection.summary).toMatchObject({
      selfEnergyBaselineReadyActorCount: 2,
    });
  });

  it('normalizes initial SP by MAXSP and rejects out-of-range raw projects', () => {
    const normalized = normalizeWorkbenchActorConfigs(
      [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          initialSp: 9,
        },
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
          initialSp: 'invalid',
        },
      ],
      DEFAULT_WORKBENCH_SELECTION
    );
    expect(normalized.map(config => config.initialSp)).toEqual([1, null]);

    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    project.actors[0].initialSp = 2;
    const validation = validateProject(project, getWorkbenchGameData());
    expect(validation.valid).toBe(false);
    expect(validation.errors.map(error => error.code)).toContain(
      'actor.initialSp.outOfRange'
    );
  });

  it('projects stable team slots into the project and compiled scenario', () => {
    const teamSlots = [
      { slotId: 'team-slot-1', position: 0, characterId: 101007 },
      { slotId: 'team-slot-2', position: 1, characterId: 101010 },
    ];
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      teamSlots,
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(project.team.slots).toEqual(teamSlots);
    expect(project.actors.map(actor => actor.characterId)).toEqual([
      101007, 101010,
    ]);
    expect(project.actions[0]).toMatchObject({
      actorId: 'actor-101007',
      skillId: 10100701,
    });
    expect(scenario.team.slots).toEqual([
      {
        ...teamSlots[0],
        actorId: 'actor-101007',
        actorName: '芃芃',
      },
      {
        ...teamSlots[1],
        actorId: 'actor-101010',
        actorName: '涂山小玉',
      },
    ]);
    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
  });

  it('normalizes duplicate or invalid team members to unique real characters', () => {
    const normalized = normalizeWorkbenchTeamSlots(
      [
        { ...DEFAULT_WORKBENCH_TEAM_SLOTS[0], characterId: 101007 },
        { ...DEFAULT_WORKBENCH_TEAM_SLOTS[1], characterId: 101007 },
      ],
      DEFAULT_WORKBENCH_SELECTION
    );

    expect(normalized).toHaveLength(2);
    expect(normalized[0]).toMatchObject({
      slotId: 'team-slot-1',
      position: 0,
      characterId: 101007,
    });
    expect(normalized[1].characterId).not.toBe(101007);
    expect(
      getWorkbenchGameData().characters.some(
        character => character.id === normalized[1].characterId
      )
    ).toBe(true);
  });

  it('rejects an equipment item placed in the wrong project slot', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    project.actors[0].loadout.equipment.weapon = 1020111;
    project.loadouts[0].equipment.weapon = 1020111;

    const result = validateProject(project, getWorkbenchGameData());

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.code)).toContain(
      'actor.loadout.equipmentType.mismatch'
    );
  });

  it('compiles enemy WEAKNESS_POINT_MAX with project toughness settings', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      enemyConfig: {
        toughnessMultiplier: 2,
        initialToughnessRatio: 0.25,
      },
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(scenario.enemy).toMatchObject({
      toughnessMultiplier: 2,
      initialToughnessRatio: 0.25,
      stats: {
        maxToughness: 13334,
        initialToughness: 3333.5,
      },
      toughness: {
        sourceKind: 'azpr-enemy-WEAKNESS_POINT_MAX',
        sourceStatus: 'toughness-config-derived-from-enemy-base-attribute',
        baseMax: 6667,
        maxMultiplier: 2,
        initialRatio: 0.25,
        maxValue: 13334,
        initialValue: 3333.5,
        applied: true,
      },
    });
  });

  it('compiles enemy element defense table values and project overrides separately', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      enemyConfig: {
        elementDefenseOverrides: {
          FIRE_DEFENSE: 0.25,
        },
      },
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const fireDefense = scenario.enemy.elementDefenses.find(
      row => row.attributeKey === 'FIRE_DEFENSE'
    );
    const windDefense = scenario.enemy.elementDefenses.find(
      row => row.attributeKey === 'WIND_DEFENSE'
    );

    expect(scenario.enemy.elementDefenseConfig).toMatchObject({
      sourceStatus: 'element-defense-config-derived-from-enemy-base-attributes',
      overrideCount: 1,
      formulaStatus: 'project-config-only',
      appliedToDamage: false,
    });
    expect(fireDefense).toMatchObject({
      elementId: 1,
      elementAbbrName: '火',
      baseValue: 0,
      overrideValue: 0.25,
      effectiveValue: 0.25,
      sourceStatus: 'user-override',
      appliedToDamage: false,
    });
    expect(windDefense).toMatchObject({
      elementId: 2,
      elementAbbrName: '风',
      baseValue: 0,
      overrideValue: null,
      effectiveValue: 0,
      sourceStatus: 'azpr-enemy-base-attribute',
    });
  });

  it('projects Workbench effect commands into the runtime without applying calculators', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actions: [
        {
          id: 'action-0001',
          type: 'skill',
          skillId: DEFAULT_WORKBENCH_SELECTION.skillId,
          actorCharacterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          startMs: 0,
          durationMs: 1000,
          level: 1,
          effectCommands: [
            {
              id: 'action-0001-effect-01',
              effectId: 'enemy-mark',
              effectName: '敌人标记',
              operation: 'apply',
              targetKind: 'enemy',
              targetId: 'stale-enemy-id',
              offsetMs: 1000,
              durationMs: 3000,
              stackMode: 'stack',
              stackDelta: 1,
              maxStacks: 3,
            },
          ],
        },
      ],
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const simulation = simulateScenario(scenario);

    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
    expect(project.actions[0].effectCommands[0]).toMatchObject({
      effectId: 'enemy-mark',
      targetKind: 'enemy',
      targetId: `enemy-${DEFAULT_WORKBENCH_SELECTION.enemyId}`,
      appliedToCalculators: false,
    });
    expect(simulation.runtimeOutputs.effectTimeline).toMatchObject({
      summary: {
        commandCount: 1,
        eventCount: 2,
        calculatorAppliedEffectCount: 0,
      },
      events: [
        {
          type: 'EFFECT_APPLIED',
          effectId: 'enemy-mark',
          targetId: `enemy-${DEFAULT_WORKBENCH_SELECTION.enemyId}`,
        },
        {
          type: 'EFFECT_EXPIRED',
          effectId: 'enemy-mark',
        },
      ],
    });
  });
});
