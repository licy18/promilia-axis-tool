import { describe, expect, it } from 'vitest';
import {
  createFirstVerticalSliceProject,
  getFirstVerticalSliceGameData,
} from '../../domain/fixtures/firstVerticalSlice';
import {
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import {
  compileProject,
  CompileProjectError,
  runSimulation,
} from '../../simulation';

describe('first vertical slice simulation', () => {
  it('compiles the real-data fixture into a scenario', () => {
    const project = createFirstVerticalSliceProject();
    const scenario = compileProject(project, getFirstVerticalSliceGameData());

    expect(scenario.sourceProject.id).toBe('fixture-first-vertical-slice');
    expect(scenario.actors).toHaveLength(1);
    expect(scenario.actions).toHaveLength(1);
    expect(scenario.enemy.name).toBe('迅狼');
    expect(scenario.actors[0].attributePanel.core.attack).toMatchObject({
      displayText: '1920',
      effectiveValue: 1920,
    });
    expect(scenario.actors[0].stats).toMatchObject({
      attack: 1920,
      maxHp: 10748,
      source: 'character-attribute-panel-current-rank',
    });
    expect(scenario.actions[0].actor.name).toBe('末音');
    expect(scenario.actions[0].selectedDamageSegment.label).toBe('普攻');
    expect(scenario.actions[0].selectedDamageSegment.multiplier).toBeCloseTo(
      6.49
    );
    expect(scenario.actions[0].selectedActionVariant).toBe(
      scenario.actions[0].selectedDamageSegment
    );
    expect(scenario.actions[0].selectedDamageSegment.hitModel).toMatchObject({
      hitCount: 5,
      distributionStatus: 'total-only',
    });
    expect(scenario.actions[0].damageModel).toMatchObject({
      source: 'azpr-local-hero-module-skill-level-action-variant',
      sourceKind: 'azpr-local-hero-module-skill-level-action-variant',
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
    expect(scenario.actions[0].damageModel.sourcePath).toContain(
      '109001.hero-module.local.json'
    );
    expect(scenario.actions[0].logicModel).toMatchObject({
      sourceKind: 'azpr-newtable-skill-logic-index',
      status: 'mapped',
      skillId: 10900101,
      subSkillId: 10900101,
      skillLevelRowId: 1657,
      display: {
        sourceKind: 'azpr-newtable-skill-level-display',
        cooldownMs: 0,
        spCost: 0,
      },
      logic: {
        cooldownMs: 0,
        spCost: 0,
        selfCooldownMs: 0,
        gcdMs: 0,
        displayMatchesLogic: true,
      },
      elementValues: [
        {
          rowId: 973,
          elementId: 109001081,
          valueParam: '1#1600|7#10000',
        },
        {
          rowId: 985,
          elementId: 109001306,
          valueParam: '1#1600|7#10000',
        },
      ],
      valueParamSummary: {
        uniqueParamIds: [1, 7],
        directMatchCount: 0,
        unmatchedSegmentCount: 4,
      },
    });
    expect(
      scenario.actions[0].logicModel.damageParameterLinks[0]
    ).toMatchObject({
      segmentIndex: 0,
      label: '普攻',
      rawValue: '649%',
      status: 'unmatched',
      unmatchedParamIds: [1, 7],
    });
    expect(scenario.actions[0].selectedDamageSegment.source).toMatchObject({
      kind: 'azpr-local-hero-module-skill-level-action-variant',
      skillId: 10900101,
      characterId: 109001,
      valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
      crossCheck: {
        kind: 'azpr-newtable-skill-level-crosscheck',
        status: 'matched',
        rowId: 1657,
        valueId: '7116760813824',
      },
      valueParamLink: {
        segmentIndex: 0,
        rawValue: '649%',
          status: 'unmatched',
        unmatchedParamIds: [1, 7],
      },
    });
    expect(scenario.diagnostics.missingTimingActionIds).toEqual([
      'action-0001',
    ]);
  });

  it('runs the minimal engine and projects raw damage with limitations marked', () => {
    const project = createFirstVerticalSliceProject();
    const gameData = getFirstVerticalSliceGameData();
    const result = runSimulation(project, gameData);
    const eventTypes = result.eventLog.map(event => event.type);

    expect(eventTypes).toContain('SCENARIO_START');
    expect(eventTypes).toContain('ACTION_START');
    expect(eventTypes).toContain('TIMING_DATA_MISSING');
    expect(eventTypes).toContain('DAMAGE_PROJECTED');
    expect(eventTypes).toContain('SCENARIO_END');

    expect(result.damageTimeline).toHaveLength(1);
    expect(result.damageTimeline[0]).toMatchObject({
      actionId: 'action-0001',
      attack: 1920,
      attackSource: 'character-attribute-panel-current-rank',
      rawDamage: 12461,
      formulaVersion: 'stage5-damage-layer-breakdown-v1',
      formulaBreakdown: {
        status: 'partial',
        expression: 'round(baseAttack.value * actionMultiplier.value)',
        result: 12461,
        appliedLayerKeys: ['baseAttack', 'actionMultiplier'],
        unappliedLayerKeys: [
          'enemyDefense',
          'enemyResistance',
          'critical',
          'damageBonus',
        ],
        layers: {
          baseAttack: {
            value: 1920,
            source: 'character-attribute-panel-current-rank',
            applied: true,
          },
          actionMultiplier: {
            value: 6.49,
            rawValue: '649%',
            actionVariantIndex: 0,
            applied: true,
          },
          enemyDefense: {
            applied: false,
            status: 'evidence-found-formula-unmapped',
            defenseMultiplier: 1,
            source: {
              kind: 'azpr-combat-formula-evidence-index',
              file: 'src/data/generated/combat-formula-evidence.json',
              status: 'enemy-property-attributes-found',
              relationStatus:
                'no-direct-elementId-to-element_formula-id-match',
              sourceChain:
                'enemy.propertyId -> unit_property.baseAttributeId -> template_value.baseAttribute -> battle_info.attrVal',
              propertyId: 300032,
              baseAttributeId: 300032,
              attributeValues: expect.arrayContaining([
                expect.objectContaining({ key: 'DEF', value: 9000 }),
                expect.objectContaining({ key: 'MDEF', value: 9000 }),
              ]),
            },
          },
          enemyResistance: {
            applied: false,
            status: 'evidence-found-formula-unmapped',
            source: {
              kind: 'azpr-combat-formula-evidence-index',
              file: 'src/data/generated/combat-formula-evidence.json',
              elementValueStatus:
                'element-values-have-params-but-no-direct-formula-id-link',
              actionElementId: 4,
              attributeValues: expect.arrayContaining([
                expect.objectContaining({
                  key: 'NORMAL_DEFENSE',
                  value: 0,
                }),
                expect.objectContaining({ key: 'FIRE_DEFENSE', value: 0 }),
              ]),
            },
          },
          critical: {
            applied: false,
            status: 'placeholder',
          },
          damageBonus: {
            applied: false,
            status: 'placeholder',
          },
        },
      },
      segmentLabel: '普攻',
      confidence: 'low',
      precision: 'raw-pre-mitigation',
      timingAccuracy: 'placeholder',
      segment: {
        source: {
          kind: 'azpr-local-hero-module-skill-level-action-variant',
          valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
          crossCheck: {
            kind: 'azpr-newtable-skill-level-crosscheck',
            rowId: 1657,
            valueId: '7116760813824',
          },
          valueParamLink: {
            segmentIndex: 0,
            rawValue: '649%',
            status: 'unmatched',
            unmatchedParamIds: [1, 7],
          },
        },
      },
    });
    expect(result.damageTimeline[0].rawDamage).toBeGreaterThan(0);
    expect(result.actionResultTimeline).toHaveLength(1);
    expect(result.actionResultTimeline[0]).toMatchObject({
      actionId: 'action-0001',
      hpDamage: {
        value: 12461,
        applied: true,
        status: 'raw-hp-projection',
      },
      toughnessDamage: {
        value: 0,
        applied: false,
        status: 'formula-unmapped',
        formulaBreakdown: {
          unappliedLayerKeys: [
            'actionToughnessValue',
            'enemyToughnessState',
            'weaknessOrBreakModifier',
          ],
        },
      },
      selfEnergyChange: {
        value: 0,
        applied: false,
        status: 'charge-formula-unmapped',
        formulaBreakdown: {
          unappliedLayerKeys: [
            'actionChargeGain',
            'hitEnergyGain',
            'passiveEnergyModifiers',
          ],
        },
      },
    });
    expect(result.summary).toMatchObject({
      projectedHitCount: 1,
      actionResultCount: 1,
      totalProjectedToughnessDamage: 0,
      totalSelfEnergyDelta: 0,
      selfEnergyDeltaByActor: [
        {
          actorId: 'actor-109001',
          actorName: '末音',
          resource: 'sp',
          delta: 0,
        },
      ],
      actionCount: 1,
      formulaVersion: 'stage5-damage-layer-breakdown-v1',
      confidence: 'low',
      timingMissingActionCount: 1,
      timingMissingActionIds: ['action-0001'],
    });
    expect(result.diagnostics.limitations.join('\n')).toContain(
      'Raw damage projection only'
    );
    expect(result.diagnostics.limitations.join('\n')).toContain(
      'Formula breakdown exposes unapplied layers'
    );
    expect(result.diagnostics.limitations.join('\n')).toContain(
      'Every action result tracks HP damage, toughness damage, and self energy delta'
    );
  });

  it('rejects invalid projects before simulation', () => {
    const project = createFirstVerticalSliceProject();
    project.actions[0] = {
      ...project.actions[0],
      skillId: 999999999,
    };

    expect(() =>
      compileProject(project, getFirstVerticalSliceGameData())
    ).toThrow(CompileProjectError);
  });

  it('sorts multiple actions and summarizes projected damage', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          { id: 'action-late', skillId: 10900101, startMs: 2000, level: 1 },
          { id: 'action-early', skillId: 10900101, startMs: 500, level: 2 },
        ],
      }
    );
    const gameData = getWorkbenchGameData();
    const scenario = compileProject(project, gameData);
    const result = runSimulation(project, gameData);

    expect(scenario.actions.map(action => action.id)).toEqual([
      'action-early',
      'action-late',
    ]);
    expect(result.damageTimeline).toHaveLength(2);
    expect(result.damageTimeline.map(entry => entry.actionId)).toEqual([
      'action-early',
      'action-late',
    ]);
    expect(result.summary.projectedHitCount).toBe(2);
    expect(result.summary.actionCount).toBe(2);
    expect(result.summary.totalRawDamage).toBe(
      result.damageTimeline.reduce((sum, entry) => sum + entry.rawDamage, 0)
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
      }
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
        actions: [0, 1, 2, 3].map(damageSegmentIndex => ({
          id: `action-segment-${damageSegmentIndex}`,
          type: 'skill',
          skillId: 10900101,
          startMs: damageSegmentIndex * 1000,
          level: 1,
          damageSegmentIndex,
        })),
      }
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());

    expect(
      scenario.actions.map(action => action.selectedDamageSegment.label)
    ).toEqual(['普攻', '重击', '闪击', '跃击']);
    expect(
      result.damageTimeline.map(entry => [
        entry.actionId,
        entry.segmentLabel,
        entry.multiplier,
      ])
    ).toEqual([
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
      source: 'skill-action-variant-split',
      skillId: 10900101,
      actorCharacterId: 109001,
      level: 1,
      variantCount: 2,
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
      }
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
          {
            id: 'action-skill',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
          },
          {
            id: 'action-wait',
            type: 'wait',
            startMs: 1000,
            durationMs: 1500,
            note: '等技能冷却',
          },
          {
            id: 'action-note',
            type: 'annotation',
            startMs: 3000,
            note: '准备爆发',
          },
        ],
      }
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const waitEvent = result.eventLog.find(event => event.type === 'WAIT');
    const annotationEvent = result.eventLog.find(
      event => event.type === 'ANNOTATION'
    );

    expect(result.summary.actionCount).toBe(3);
    expect(result.summary.projectedHitCount).toBe(1);
    expect(result.damageTimeline).toHaveLength(1);
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
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
    const spSkill = gameData.skills.find(skill => Number(skill.spCost) > 0);
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
      }
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
    expect(result.damageTimeline[0].formulaBreakdown.layers.enemyDefense).toMatchObject({
      applied: false,
      status: 'evidence-found-formula-unmapped',
      defenseMultiplier: 1.5,
      source: {
        kind: 'azpr-combat-formula-evidence-index',
        status: 'enemy-property-attributes-found',
      },
    });
    expect(result.summary.resourceEventCount).toBe(1);
    expect(result.summary.totalSelfEnergyDelta).toBe(-Number(spSkill.spCost));
    expect(result.summary.selfEnergyDeltaByActor).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: 'actor-101003',
          actorName: '寒悠悠',
          delta: -Number(spSkill.spCost),
        }),
        expect.objectContaining({
          actorId: 'actor-101007',
          actorName: '芃芃',
          delta: 0,
        }),
      ])
    );
    expect(result.resourceTimeline).toEqual([
      expect.objectContaining({
        timeMs: 700,
        actionId: 'action-sp',
        resource: 'sp',
        change: -Number(spSkill.spCost),
        reason: 'skill-cost',
      }),
    ]);
    expect(result.actionResultTimeline[0].selfEnergyChange).toMatchObject({
      value: -Number(spSkill.spCost),
      applied: true,
      status: 'explicit-cost-applied-charge-formula-unmapped',
      formulaBreakdown: {
        appliedLayerKeys: ['explicitResourceDelta'],
        unappliedLayerKeys: [
          'actionChargeGain',
          'hitEnergyGain',
          'passiveEnergyModifiers',
        ],
      },
    });
    expect(result.eventLog.map(event => event.type)).toContain(
      'RESOURCE_CHANGE'
    );
  });

  it('keeps manual resource and enemy event actions as non-damage timeline events', () => {
    const project = createWorkbenchProject(
      {},
      {
        actions: [
          {
            id: 'action-skill',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
          },
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
      }
    );
    const result = runSimulation(project, getWorkbenchGameData());
    const resourceEvent = result.eventLog.find(
      event =>
        event.actionId === 'action-resource' && event.type === 'RESOURCE_CHANGE'
    );
    const enemyEvent = result.eventLog.find(
      event => event.actionId === 'action-enemy' && event.type === 'ENEMY_EVENT'
    );

    expect(result.summary.actionCount).toBe(3);
    expect(result.summary.actionResultCount).toBe(3);
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
    expect(
      result.actionResultTimeline.map(entry => [
        entry.actionId,
        entry.hpDamage.value,
        entry.toughnessDamage.value,
        entry.selfEnergyChange.value,
      ])
    ).toEqual([
      ['action-skill', 12461, 0, 0],
      ['action-resource', 0, 0, -35],
      ['action-enemy', 0, 0, 0],
    ]);
    expect(enemyEvent).toMatchObject({
      type: 'ENEMY_EVENT',
      payload: {
        eventType: 'phase-2',
        note: '进入二阶段',
      },
    });
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
  });

  it('compiles a secondary actor and keeps switch actions as non-damage events', () => {
    const project = createWorkbenchProject(
      {
        secondaryCharacterId: 101003,
      },
      {
        actions: [
          {
            id: 'action-skill',
            type: 'skill',
            skillId: 10900101,
            startMs: 0,
            level: 1,
          },
          {
            id: 'action-switch',
            type: 'switch',
            startMs: 1600,
            targetCharacterId: 101003,
            note: '切换至寒悠悠',
          },
        ],
      }
    );
    const scenario = compileProject(project, getWorkbenchGameData());
    const result = runSimulation(project, getWorkbenchGameData());
    const switchEvent = result.eventLog.find(event => event.type === 'SWITCH');

    expect(project.actors.map(actor => actor.characterId)).toEqual([
      109001, 101003,
    ]);
    expect(scenario.actors).toHaveLength(2);
    expect(
      scenario.actions.find(action => action.id === 'action-switch')
    ).toMatchObject({
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
    expect(result.eventLog.map(event => event.type)).not.toContain(
      'DAMAGE_SKIPPED'
    );
  });
});
