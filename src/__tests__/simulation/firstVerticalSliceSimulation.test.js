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
});
