import { describe, expect, it } from 'vitest';
import { getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import {
  SKILL_LEVEL_DISPLAY_SOURCE_KIND,
  SKILL_LOGIC_SOURCE_KIND,
  createSkillLogicModel,
  getSkillLogicIndexSummary,
  resolveSkillLogic,
} from '../../domain/skillLogicModel';

describe('skill logic model adapter', () => {
  it('resolves skill_level, skillsub_logic, and skillsub_ele_value sources for a skill action level', () => {
    const skill = getWorkbenchGameData().skills.find((item) => item.id === 10900101);
    const model = createSkillLogicModel(skill, 1);

    expect(model).toMatchObject({
      sourceKind: SKILL_LOGIC_SOURCE_KIND,
      status: 'mapped',
      skillId: 10900101,
      characterId: 109001,
      level: 1,
      levelIndex: 0,
      subSkillId: 10900101,
      skillLevelRowId: 1657,
      display: {
        sourceKind: SKILL_LEVEL_DISPLAY_SOURCE_KIND,
        cooldownMs: 0,
        spCost: 0,
        fieldPaths: {
          cooldownMs: 'skill_level.rows[id=1657].coolDown',
          spCost: 'skill_level.rows[id=1657].spCost',
          subSkillId: 'skill_level.rows[id=1657].subSkillId',
        },
      },
      logic: {
        sourceKind: SKILL_LOGIC_SOURCE_KIND,
        subSkillId: 10900101,
        cooldownMs: 0,
        spCost: 0,
        selfCooldownMs: 0,
        publicCooldownMs: 0,
        gcdMs: 0,
        displayMatchesLogic: true,
        fieldPaths: {
          cooldownMs: 'skillsub_logic.rows[skillId=10900101].coolDown',
          spCost: 'skillsub_logic.rows[skillId=10900101].spCost',
          selfCooldownMs: 'skillsub_logic.rows[skillId=10900101].selfCD',
          gcdMs: 'skillsub_logic.rows[skillId=10900101].GCD',
        },
      },
    });
    expect(model.elementValues[0]).toMatchObject({
      rowId: 973,
      elementId: 109001081,
      valueParam: '1#1600|7#10000',
      params: [
        { id: 1, value: 1600 },
        { id: 7, value: 10000 },
      ],
      fieldPaths: {
        valueParam: 'skillsub_ele_value.rows[id=973].valueParam',
      },
    });
    expect(model.diagnostics).toEqual([]);
  });

  it('keeps display cooldown separate from logic cooldown when source tables disagree', () => {
    const summary = getSkillLogicIndexSummary();
    const skill = getWorkbenchGameData().skills.find((item) => item.id === 10100712);
    const model = resolveSkillLogic(skill, 1);

    expect(summary).toMatchObject({
      mappedSkills: 76,
      mismatchedSkills: 44,
      displayLogicMismatchSubSkills: 44,
    });
    expect(model).toMatchObject({
      status: 'mismatch',
      skillId: 10100712,
      subSkillId: 10100712,
      display: {
        cooldownMs: 13000,
        spCost: 0,
      },
      logic: {
        cooldownMs: 20000,
        spCost: 0,
        displayMatchesLogic: false,
      },
    });
    expect(model.diagnostics).toEqual([
      expect.objectContaining({
        code: 'skill-display-logic-timing-mismatch',
        severity: 'info',
        sourceKind: SKILL_LOGIC_SOURCE_KIND,
        displayPairs: [
          {
            cooldownMs: 13000,
            spCost: 0,
          },
        ],
        logicPair: {
          cooldownMs: 20000,
          spCost: 0,
        },
      }),
    ]);
  });

  it('clamps requested level to the available skill_level rows', () => {
    const skill = getWorkbenchGameData().skills.find((item) => item.id === 10900101);
    const model = createSkillLogicModel(skill, 99);

    expect(model).toMatchObject({
      level: 12,
      levelIndex: 11,
      skillLevelRowId: 1668,
      subSkillId: 10900101,
    });
    expect(model.elementValues.map((row) => row.rowId)).toEqual([984, 996]);
  });
});
