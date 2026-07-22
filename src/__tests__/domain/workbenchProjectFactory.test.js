import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import workbenchSkillDiagnostics from '../../data/generated/workbench-skill-diagnostics.json';
import {
  DEFAULT_WORKBENCH_SELECTION,
  DEFAULT_WORKBENCH_TEAM_SLOTS,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
  getWorkbenchLoadoutOptions,
  getWorkbenchSeed,
  normalizeWorkbenchActionDrafts,
  normalizeWorkbenchActorConfigs,
  normalizeWorkbenchTeamSlots,
} from '../../domain/workbenchProjectFactory';
import { ACTION_TYPES, validateProject } from '../../domain/projectSchema';
import { compileProject } from '../../simulation/compiler/compileProject';
import { simulateScenario } from '../../simulation/engine/simulateScenario';
import { createToughnessRuntimeSampleFixture } from '../../simulation/fixtures/toughnessRuntimeSampleFixture';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';
import { bindWorkbenchRuntimeSampleCaptures } from '../../domain/workbenchRuntimeSampleCapture';
import {
  installProjectSimulationSkillDiagnostics,
  resetProjectSimulationSkillDiagnostics,
} from '../../simulation/projection/projectSimulationResult';

beforeAll(() => {
  installProjectSimulationSkillDiagnostics(workbenchSkillDiagnostics);
});

afterAll(() => {
  resetProjectSimulationSkillDiagnostics();
});

describe('workbench project actor configuration', () => {
  it('compiles legacy switch durations as zero-duration exact-frame events', () => {
    const sourceCharacterId = DEFAULT_WORKBENCH_TEAM_SLOTS[0].characterId;
    const targetCharacterId = DEFAULT_WORKBENCH_TEAM_SLOTS[1].characterId;
    const draft = createWorkbenchActionDraft({
      id: 'switch-exact-frame',
      type: ACTION_TYPES.SWITCH,
      actorCharacterId: sourceCharacterId,
      targetCharacterId,
      startMs: 1000,
      durationMs: 600,
      effectCommands: [
        {
          id: 'legacy-switch-effect',
          effectId: 'legacy-switch-effect',
          effectName: '旧切人效果',
        },
      ],
    });
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actions: [draft],
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(draft).toMatchObject({
      startMs: 1000,
      startFrame: 60,
      endFrame: 60,
      durationMs: 0,
      durationFrames: 0,
      effectCommands: [],
    });
    expect(project.actions[0]).toMatchObject({
      type: ACTION_TYPES.SWITCH,
      startMs: 1000,
      startFrame: 60,
      endFrame: 60,
      durationMs: 0,
      durationFrames: 0,
    });
    expect(project.actions[0].effectCommands ?? []).toEqual([]);
    expect(scenario.actions[0]).toMatchObject(project.actions[0]);
    expect(scenario.actions[0].effectCommands ?? []).toEqual([]);
    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
  });

  it('preserves verified timing identity from a catalog draft through compilation', () => {
    const draft = createWorkbenchActionDraft({
      id: 'verified-timing-action',
      skillId: 10900112,
      actorCharacterId: 109001,
      durationMs: 1416.6666666666667,
      durationFrames: 85,
      timingSource: 'skill-control-player-resource-map',
      timingStatus: 'applied',
      timingReasons: ['verified-action-occupancy'],
      timingSourceIdentity: 'skill-control:10900112:player:1:occupancy',
      needsTimingData: false,
    });
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actions: [draft],
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(draft).toMatchObject({
      durationFrames: 85,
      timingStatus: 'applied',
      timingSourceIdentity: 'skill-control:10900112:player:1:occupancy',
      needsTimingData: false,
    });
    expect(project.actions[0].timing).toMatchObject({
      durationFrames: 85,
      source: 'skill-control-player-resource-map',
      status: 'applied',
      reasons: ['verified-action-occupancy'],
      sourceIdentity: 'skill-control:10900112:player:1:occupancy',
      needsTimingData: false,
    });
    expect(scenario.actions[0].timing).toEqual(project.actions[0].timing);
  });

  it('preserves the planning, projectile scenario, and per-hit override contracts through compilation', () => {
    const draft = createWorkbenchActionDraft({
      id: 'scenario-hit-action',
      skillId: 10900112,
      actorCharacterId: 109001,
      durationMs: 2_850,
      durationFrames: null,
      timingStatus: 'unresolved',
      needsTimingData: true,
      controlSubSkillIndex: 0,
      variantInputSelection: {
        selectorIdentity: 'actor:109001|control:10900112|public-variant:0',
        selectorKind: 'charge-tier',
        publicVariantIndex: 0,
        chargeTier: 1,
        mode: 'hold',
      },
      actionScheduling: {
        status: 'planning',
        kind: 'source-animation-planning-duration',
        planningDurationFrames: 171,
        selectedSubSkillIndex: 0,
        sourceIdentity: 'skill-control:10900112:animation:0',
        sourceStatus: 'verified-animation-duration',
        variantModelStatus: 'variant-condition-not-yet-modeled',
      },
      sourceEvidenceStatus: 'runtime-dependent',
      scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
      hitOverrides: {
        'control:10900112|hit:2': { willHit: false },
      },
    });
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actions: [draft],
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(project.combatScenario).toEqual({
      projectile: { targetDistance: 0, defaultWillHit: true },
    });
    expect(project.actions[0]).toMatchObject({
      controlSubSkillIndex: 0,
      variantInputSelection: {
        schemaVersion: 1,
        selectorIdentity: 'actor:109001|control:10900112|public-variant:0',
        selectorKind: 'charge-tier',
        publicVariantIndex: 0,
        chargeTier: 1,
        mode: 'hold',
      },
      actionScheduling: {
        kind: 'source-animation-planning-duration',
        planningDurationFrames: 171,
      },
      sourceEvidenceStatus: 'runtime-dependent',
      scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
      hitOverrides: {
        'control:10900112|hit:2': { willHit: false },
      },
    });
    expect(scenario.combatScenario).toEqual(project.combatScenario);
    expect(scenario.actions[0].hitOverrides).toEqual(
      project.actions[0].hitOverrides
    );
    expect(scenario.actions[0].variantInputSelection).toEqual(
      project.actions[0].variantInputSelection
    );
  });

  it('keeps the action kind when a team-slot remap changes the owner', () => {
    const [action] = normalizeWorkbenchActionDrafts(
      [
        {
          id: 'remapped-star-skill',
          type: 'skill',
          skillId: 10900112,
          actorCharacterId: 101010,
          actionVariantIndex: 0,
          durationMs: 1500,
        },
      ],
      101010
    );

    expect(action).toMatchObject({
      id: 'remapped-star-skill',
      actorCharacterId: 101010,
      skillId: 10101012,
      actionVariantIndex: 0,
    });
  });

  it('compiles and simulates an explicit empty action list', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actions: [],
    });
    const validation = validateProject(project, getWorkbenchGameData());
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = simulateScenario(scenario);

    expect(project.name).toContain('空方案');
    expect(project.enemy.icon).toBe(
      getWorkbenchGameData().enemies.find(
        enemy => enemy.id === DEFAULT_WORKBENCH_SELECTION.enemyId
      )?.icon
    );
    expect(project.actions).toEqual([]);
    expect(validation.valid).toBe(true);
    expect(result.scenario.actionCount).toBe(0);
    expect(result.actionResultTimeline).toEqual([]);
  });

  it('consumes the generated Workbench production data projection', () => {
    const seed = getWorkbenchSeed();
    const gameData = getWorkbenchGameData();
    const loadoutOptions = getWorkbenchLoadoutOptions();

    expect(seed).toMatchObject({
      schemaVersion: 3,
      purpose: 'workbench-production-data-projection',
      counts: {
        characters: 20,
        skills: 120,
        enemies: 208,
        elements: 10,
        equipment: 137,
        kibos: 122,
        soulessences: 62,
      },
    });
    expect(gameData).toBe(seed.gameData);
    expect(gameData.enemies).toHaveLength(seed.counts.enemies);
    expect(gameData.elements).toHaveLength(seed.counts.elements);
    expect(loadoutOptions.kibos).toBe(gameData.kibos);
    expect(loadoutOptions.soulessences).toBe(gameData.soulessences);
    expect(
      gameData.enemies
        .find(enemy => enemy.id === DEFAULT_WORKBENCH_SELECTION.enemyId)
        .property.baseAttributes.map(attribute => attribute.key)
    ).toEqual(
      expect.arrayContaining([
        'MAXHP',
        'DEF',
        'MDEF',
        'WEAKNESS_POINT_MAX',
        'WIND_DEFENSE',
      ])
    );
    expect(Object.keys(gameData.equipment[0]).sort()).toEqual([
      'id',
      'name',
      'rarity',
      'type',
    ]);
    expect(Object.keys(gameData.kibos[0]).sort()).toEqual([
      'element',
      'id',
      'name',
      'stage',
    ]);
    expect(Object.keys(gameData.soulessences[0]).sort()).toEqual([
      'id',
      'name',
      'rarity',
    ]);
  });

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

  it('projects persisted action relations without changing simulation output', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actions: [
        { id: 'action-0001', startMs: 0, durationMs: 1000 },
        { id: 'action-0002', startMs: 2000, durationMs: 1000 },
      ],
      actionRelations: [
        {
          id: 'relation-0001',
          fromActionId: 'action-0001',
          toActionId: 'action-0002',
        },
      ],
    });
    const validation = validateProject(project, getWorkbenchGameData());
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = simulateScenario(scenario);

    expect(validation.valid).toBe(true);
    expect(project.actionRelations).toEqual([
      expect.objectContaining({
        id: 'relation-0001',
        fromActionId: 'action-0001',
        toActionId: 'action-0002',
        gapMs: 1000,
      }),
    ]);
    expect(result.scenario.actionCount).toBe(2);
    expect(result.actionResultTimeline).toHaveLength(2);
  });

  it('projects persisted cycle boundaries without changing simulation output', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      cycleBoundaries: [
        { id: 'cycle-boundary-0002', timeMs: 2000 },
        { id: 'cycle-boundary-0001', timeMs: 1000 },
      ],
    });
    const validation = validateProject(project, getWorkbenchGameData());
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = simulateScenario(scenario);

    expect(validation.valid).toBe(true);
    expect(project.cycleBoundaries).toEqual([
      { id: 'cycle-boundary-0001', timeMs: 1000 },
      { id: 'cycle-boundary-0002', timeMs: 2000 },
    ]);
    expect(scenario.cycleBoundaries).toEqual(project.cycleBoundaries);
    expect(result.actionResultTimeline).toHaveLength(1);
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
      'verified-static-properties-applied-dynamic-effects-unapplied'
    );
    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
  });

  it('tracks configured kibo events without applying them to calculators', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actorConfigs: [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          loadout: { kiboId: 500001 },
        },
      ],
      actions: [
        {
          id: 'action-kibo-0001',
          type: 'kiboEvent',
          actorCharacterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          startMs: 1200,
          durationMs: 600,
          eventType: 'activation',
          note: '奇波入轴',
        },
      ],
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = simulateScenario(scenario);
    const kiboEvent = result.eventLog.find(
      event => event.type === 'KIBO_EVENT'
    );

    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
    expect(scenario.actions[0]).toMatchObject({
      id: 'action-kibo-0001',
      type: 'kiboEvent',
      actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.characterId}`,
      kiboId: 500001,
      appliedToCalculators: false,
      source: {
        kind: 'configured-kibo-tracking-event',
        kiboId: 500001,
        appliedToCalculators: false,
      },
    });
    expect(kiboEvent).toMatchObject({
      timeMs: 1200,
      actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.characterId}`,
      payload: {
        kiboId: 500001,
        eventType: 'activation',
        appliedToCalculators: false,
      },
    });
    expect(result.damageTimeline).toHaveLength(0);
    expect(result.resourceTimeline).toHaveLength(0);
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
      DEFAULT_WORKBENCH_TEAM_SLOTS[2].characterId,
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
          initialSp: 25,
        },
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
          initialSp: 75,
        },
      ],
    });
    const scenario = compileProject(project, getWorkbenchGameData());
    const simulation = simulateScenario(scenario);

    expect(project.actors.map(actor => actor.initialSp)).toEqual([
      25,
      75,
      null,
    ]);
    expect(scenario.actors.map(actor => actor.initialSp)).toEqual([
      25,
      75,
      null,
    ]);
    expect(
      simulation.runtimeOutputs.stateSnapshots.summary.selfEnergyFinalByActor
    ).toEqual([
      expect.objectContaining({
        actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.characterId}`,
        initialValue: 25,
        currentValue: 25,
        baselineStatus: 'baseline-derived-from-scenario-actor-self-energy',
      }),
      expect.objectContaining({
        actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId}`,
        initialValue: 75,
        currentValue: 75,
        baselineStatus: 'baseline-derived-from-scenario-actor-self-energy',
      }),
      expect.objectContaining({
        actorId: `actor-${DEFAULT_WORKBENCH_TEAM_SLOTS[2].characterId}`,
        initialValue: null,
        currentValue: null,
        baselineStatus: 'baseline-pending-azpr-initial-self-energy',
      }),
    ]);
    expect(
      simulation.threeValueGenerationLayer.deltas.find(delta => delta.applied)
        ?.mechanismContext?.sourceActor?.energy
    ).toMatchObject({
      initialValue: 25,
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
          initialSp: 109,
        },
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
          initialSp: 'invalid',
        },
      ],
      DEFAULT_WORKBENCH_SELECTION
    );
    expect(normalized.map(config => config.initialSp)).toEqual([
      100,
      null,
      null,
    ]);

    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    expect(project.actors[0]).toMatchObject({
      spResourceProfile: {
        maxSpBase: 1,
        maxSpGrowthMultiplier: 100,
        effectiveMaxSp: 100,
      },
      baseAttributes: expect.arrayContaining([
        expect.objectContaining({
          key: 'MAXSP',
          value: 100,
          baseValue: 1,
          growthMultiplier: 100,
          valueUnit: 'absolute-sp-points',
        }),
      ]),
    });
    project.actors[0].initialSp = 101;
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
      { slotId: 'team-slot-3', position: 2, characterId: 101003 },
    ];
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      teamSlots,
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(project.team.slots).toEqual(teamSlots);
    expect(project.actors.map(actor => actor.characterId)).toEqual([
      101007, 101010, 101003,
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
      {
        ...teamSlots[2],
        actorId: 'actor-101003',
        actorName: '寒悠悠',
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

    expect(normalized).toHaveLength(3);
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
    expect(new Set(normalized.map(slot => slot.characterId)).size).toBe(3);
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
