import { describe, expect, it } from 'vitest';
import {
  createFirstVerticalSliceProject,
  getFirstVerticalSliceGameData,
} from '../../domain/fixtures/firstVerticalSlice';
import { createWorkbenchProject, getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import { compileProject, CompileProjectError, runSimulation } from '../../simulation';

describe('first vertical slice simulation', () => {
  it('compiles the real-data fixture into a scenario', () => {
    const project = createFirstVerticalSliceProject();
    const scenario = compileProject(project, getFirstVerticalSliceGameData());

    expect(scenario.sourceProject.id).toBe('fixture-first-vertical-slice');
    expect(scenario.actors).toHaveLength(1);
    expect(scenario.actions).toHaveLength(1);
    expect(scenario.enemy.name).toBe('迅狼');
    expect(scenario.actions[0].actor.name).toBe('末音');
    expect(scenario.actions[0].selectedDamageSegment.label).toBe('普攻');
    expect(scenario.actions[0].selectedDamageSegment.multiplier).toBeCloseTo(6.49);
    expect(scenario.actions[0].damageModel).toMatchObject({
      source: 'azpr-local-hero-module-skill-level',
      sourceKind: 'azpr-local-hero-module-skill-level',
      skillId: 10900101,
      characterId: 109001,
      fieldPaths: {
        labels: 'skillSystem.10900101.skillLevel.name',
        values: 'skillSystem.10900101.skillLevel.values[0]',
      },
      crossCheck: {
        sourceKind: 'azpr-newtable-skill-level-crosscheck',
        status: 'matched',
        rowId: 1657,
        labels: ['普攻', '重击', '闪击', '跃击'],
        values: ['649%', '190%', '40%', '136%'],
      },
    });
    expect(scenario.actions[0].damageModel.sourcePath).toContain('109001.hero-module.local.json');
    expect(scenario.actions[0].selectedDamageSegment.source).toMatchObject({
      kind: 'azpr-local-hero-module-skill-level',
      skillId: 10900101,
      characterId: 109001,
      valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
      crossCheck: {
        kind: 'azpr-newtable-skill-level-crosscheck',
        status: 'matched',
        rowId: 1657,
        valueId: '7116760813824',
      },
    });
    expect(scenario.diagnostics.missingTimingActionIds).toEqual(['action-0001']);
  });

  it('runs the minimal engine and projects raw damage with limitations marked', () => {
    const project = createFirstVerticalSliceProject();
    const gameData = getFirstVerticalSliceGameData();
    const result = runSimulation(project, gameData);
    const eventTypes = result.eventLog.map((event) => event.type);

    expect(eventTypes).toContain('SCENARIO_START');
    expect(eventTypes).toContain('ACTION_START');
    expect(eventTypes).toContain('TIMING_DATA_MISSING');
    expect(eventTypes).toContain('DAMAGE_PROJECTED');
    expect(eventTypes).toContain('SCENARIO_END');

    expect(result.damageTimeline).toHaveLength(1);
    expect(result.damageTimeline[0]).toMatchObject({
      actionId: 'action-0001',
      segmentLabel: '普攻',
      confidence: 'low',
      precision: 'raw-pre-mitigation',
      timingAccuracy: 'placeholder',
      segment: {
        source: {
          kind: 'azpr-local-hero-module-skill-level',
          valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
          crossCheck: {
            kind: 'azpr-newtable-skill-level-crosscheck',
            rowId: 1657,
            valueId: '7116760813824',
          },
        },
      },
    });
    expect(result.damageTimeline[0].rawDamage).toBeGreaterThan(0);
    expect(result.summary).toMatchObject({
      projectedHitCount: 1,
      actionCount: 1,
      confidence: 'low',
      timingMissingActionCount: 1,
      timingMissingActionIds: ['action-0001'],
    });
    expect(result.diagnostics.limitations.join('\n')).toContain('Raw damage projection only');
  });

  it('rejects invalid projects before simulation', () => {
    const project = createFirstVerticalSliceProject();
    project.actions[0] = {
      ...project.actions[0],
      skillId: 999999999,
    };

    expect(() => compileProject(project, getFirstVerticalSliceGameData())).toThrow(CompileProjectError);
  });

  it('sorts multiple actions and summarizes projected damage', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          { id: 'action-late', skillId: 10900101, startMs: 2000, level: 1 },
          { id: 'action-early', skillId: 10900101, startMs: 500, level: 2 },
        ],
      },
    );
    const gameData = getWorkbenchGameData();
    const scenario = compileProject(project, gameData);
    const result = runSimulation(project, gameData);

    expect(scenario.actions.map((action) => action.id)).toEqual(['action-early', 'action-late']);
    expect(result.damageTimeline).toHaveLength(2);
    expect(result.damageTimeline.map((entry) => entry.actionId)).toEqual(['action-early', 'action-late']);
    expect(result.summary.projectedHitCount).toBe(2);
    expect(result.summary.actionCount).toBe(2);
    expect(result.summary.totalRawDamage).toBe(
      result.damageTimeline.reduce((sum, entry) => sum + entry.rawDamage, 0),
    );
  });

  it('uses the selected skill damage segment for projection', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-heavy',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
            damageSegmentIndex: 1,
          },
        ],
      },
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());

    expect(scenario.actions[0].damageSegmentIndex).toBe(1);
    expect(scenario.actions[0].selectedDamageSegment).toMatchObject({
      index: 1,
      label: '重击',
      rawValue: '190%',
      multiplier: 1.9,
    });
    expect(result.damageTimeline[0]).toMatchObject({
      actionId: 'action-heavy',
      segmentLabel: '重击',
      multiplier: 1.9,
    });
  });

  it('projects generated skill segment actions as separate damage entries', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [0, 1, 2, 3].map((damageSegmentIndex) => ({
          id: `action-segment-${damageSegmentIndex}`,
          type: 'skill',
          skillId: 10900101,
          startMs: damageSegmentIndex * 1000,
          level: 1,
          damageSegmentIndex,
        })),
      },
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());

    expect(scenario.actions.map((action) => action.selectedDamageSegment.label)).toEqual([
      '普攻',
      '重击',
      '闪击',
      '跃击',
    ]);
    expect(result.damageTimeline.map((entry) => [entry.actionId, entry.segmentLabel, entry.multiplier])).toEqual([
      ['action-segment-0', '普攻', 6.49],
      ['action-segment-1', '重击', 1.9],
      ['action-segment-2', '闪击', 0.4],
      ['action-segment-3', '跃击', 1.36],
    ]);
    expect(result.summary.projectedHitCount).toBe(4);
  });

  it('preserves generated skill segment batch metadata through compilation', () => {
    const generationBatch = {
      batchId: 'segment-batch-test',
      source: 'skill-segment-split',
      skillId: 10900101,
      actorCharacterId: 109001,
      level: 1,
      segmentCount: 2,
      createdAt: '2026-07-07T00:00:00.000Z',
    };
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-segment-batch',
            type: 'skill',
            skillId: 10900101,
            startMs: 1000,
            level: 1,
            damageSegmentIndex: 1,
            generationBatch,
          },
        ],
      },
    );
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(project.actions[0].generationBatch).toEqual(generationBatch);
    expect(scenario.actions[0].generationBatch).toEqual(generationBatch);
    expect(scenario.actions[0].selectedDamageSegment.label).toBe('重击');
  });

  it('keeps wait and annotation actions in the event log without projecting damage', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          { id: 'action-skill', type: 'skill', skillId: 10900101, startMs: 0, level: 1 },
          { id: 'action-wait', type: 'wait', startMs: 1000, durationMs: 1500, note: '等技能冷却' },
          { id: 'action-note', type: 'annotation', startMs: 3000, note: '准备爆发' },
        ],
      },
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const waitEvent = result.eventLog.find((event) => event.type === 'WAIT');
    const annotationEvent = result.eventLog.find((event) => event.type === 'ANNOTATION');

    expect(result.summary.actionCount).toBe(3);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(result.damageTimeline).toHaveLength(1);
    expect(result.eventLog.map((event) => event.type)).not.toContain('DAMAGE_SKIPPED');
    expect(waitEvent).toMatchObject({
      actionId: 'action-wait',
      payload: {
        durationMs: 1500,
        note: '等技能冷却',
      },
    });
    expect(annotationEvent).toMatchObject({
      actionId: 'action-note',
      payload: {
        note: '准备爆发',
      },
    });
  });

  it('projects workbench enemy config and resource events from the simulation result', () => {
    const gameData = getWorkbenchGameData();
    const spSkill = gameData.skills.find((skill) => Number(skill.spCost) > 0);
    const project = createWorkbenchProject(
      {
        characterId: spSkill.characterId,
        skillId: spSkill.id,
      },
      {
        enemyConfig: {
          level: 95,
          hpMultiplier: 2,
          defenseMultiplier: 1.5,
        },
        actions: [
          {
            id: 'action-sp',
            type: 'skill',
            skillId: spSkill.id,
            startMs: 700,
            level: 1,
          },
        ],
      },
    );
    const scenario = compileProject(project, gameData);
    const result = runSimulation(project, gameData);

    expect(scenario.enemy).toMatchObject({
      level: 95,
      hpMultiplier: 2,
      defenseMultiplier: 1.5,
    });
    expect(result.scenario).toMatchObject({
      enemyLevel: 95,
      enemyHpMultiplier: 2,
      enemyDefenseMultiplier: 1.5,
    });
    expect(result.summary.resourceEventCount).toBe(1);
    expect(result.resourceTimeline).toEqual([
      expect.objectContaining({
        timeMs: 700,
        actionId: 'action-sp',
        resource: 'sp',
        change: -Number(spSkill.spCost),
        reason: 'skill-cost',
      }),
    ]);
    expect(result.eventLog.map((event) => event.type)).toContain('RESOURCE_CHANGE');
  });

  it('keeps manual resource and enemy event actions as non-damage timeline events', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          { id: 'action-skill', type: 'skill', skillId: 10900101, startMs: 0, level: 1 },
          {
            id: 'action-resource',
            type: 'resource',
            startMs: 1200,
            resource: 'sp',
            change: -35,
            reason: 'manual-test',
            note: '扣除测试资源',
          },
          {
            id: 'action-enemy',
            type: 'enemyEvent',
            startMs: 1800,
            eventType: 'phase-2',
            note: '进入二阶段',
          },
        ],
      },
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const resourceEvent = result.eventLog.find(
      (event) => event.actionId === 'action-resource' && event.type === 'RESOURCE_CHANGE',
    );
    const enemyEvent = result.eventLog.find(
      (event) => event.actionId === 'action-enemy' && event.type === 'ENEMY_EVENT',
    );

    expect(result.summary.actionCount).toBe(3);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(result.summary.resourceEventCount).toBe(1);
    expect(result.resourceTimeline).toEqual([
      expect.objectContaining({
        actionId: 'action-resource',
        resource: 'sp',
        change: -35,
        reason: 'manual-test',
      }),
    ]);
    expect(resourceEvent).toMatchObject({
      type: 'RESOURCE_CHANGE',
      payload: {
        confidence: 'manual',
        note: '扣除测试资源',
      },
    });
    expect(enemyEvent).toMatchObject({
      type: 'ENEMY_EVENT',
      payload: {
        eventType: 'phase-2',
        note: '进入二阶段',
      },
    });
    expect(result.eventLog.map((event) => event.type)).not.toContain('DAMAGE_SKIPPED');
  });

  it('compiles a secondary actor and keeps switch actions as non-damage events', () => {
    const project = createWorkbenchProject(
      {
        secondaryCharacterId: 101003,
      },
      {
        actions: [
          { id: 'action-skill', type: 'skill', skillId: 10900101, startMs: 0, level: 1 },
          {
            id: 'action-switch',
            type: 'switch',
            startMs: 1600,
            targetCharacterId: 101003,
            note: '切换至寒悠悠',
          },
        ],
      },
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());
    const switchEvent = result.eventLog.find((event) => event.type === 'SWITCH');

    expect(project.actors.map((actor) => actor.characterId)).toEqual([109001, 101003]);
    expect(scenario.actors).toHaveLength(2);
    expect(scenario.actions.find((action) => action.id === 'action-switch')).toMatchObject({
      actor: {
        name: '末音',
      },
      targetActor: {
        name: '寒悠悠',
      },
    });
    expect(result.summary.actionCount).toBe(2);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(switchEvent).toMatchObject({
      actionId: 'action-switch',
      payload: {
        fromActorName: '末音',
        targetActorName: '寒悠悠',
        note: '切换至寒悠悠',
      },
    });
    expect(result.eventLog.map((event) => event.type)).not.toContain('DAMAGE_SKIPPED');
  });
});
