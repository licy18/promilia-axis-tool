import { describe, expect, it } from 'vitest';
import { getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import {
  SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
  createSkillDamageModel,
  resolveSkillDamageSegments,
} from '../../domain/skillDamageSegments';
import {
  SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
  getSkillLevelCrossCheckSummary,
  resolveSkillLevelCrossCheck,
} from '../../domain/skillLevelCrossCheck';

describe('skill damage segment adapter', () => {
  it('resolves AzPr hero-module skill level values with source metadata', () => {
    const skill = getWorkbenchGameData().skills.find((item) => item.id === 10900101);
    const resolved = resolveSkillDamageSegments(skill, 1);

    expect(resolved.sourceKind).toBe(SKILL_DAMAGE_SEGMENT_SOURCE_KIND);
    expect(resolved.sourcePath).toContain('BWiki/data/hero-modules/local-all/109001.hero-module.local.json');
    expect(resolved.fieldPaths).toMatchObject({
      labels: 'skillSystem.10900101.skillLevel.name',
      values: 'skillSystem.10900101.skillLevel.values[0]',
      description: 'skillSystem.10900101.skillDescribe',
    });
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.crossCheck).toMatchObject({
      sourceKind: SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
      status: 'matched',
      skillId: 10900101,
      characterId: 109001,
      level: 1,
      levelIndex: 0,
      rowId: 1657,
      fieldPaths: {
        labels: 'skill_level.rows[id=1657].name -> lang_skill_level',
        values: 'skill_level.rows[id=1657].value -> lang_skill_level',
      },
      labelIds: ['7116760813568', '7116760813569', '7116760813570', '7116760813571'],
      valueIds: ['7116760813824', '7116760813825', '7116760813826', '7116760813827'],
      matches: {
        labels: true,
        values: true,
      },
    });
    expect(resolved.segments.map((segment) => [segment.label, segment.rawValue, segment.multiplier])).toEqual([
      ['普攻', '649%', 6.49],
      ['重击', '190%', 1.9],
      ['闪击', '40%', 0.4],
      ['跃击', '136%', 1.36],
    ]);
    expect(resolved.segments[0].source).toMatchObject({
      kind: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
      skillId: 10900101,
      characterId: 109001,
      level: 1,
      labelField: 'skillSystem.10900101.skillLevel.name[0]',
      valueField: 'skillSystem.10900101.skillLevel.values[0][0]',
      crossCheck: {
        kind: SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
        status: 'matched',
        rowId: 1657,
        labelId: '7116760813568',
        valueId: '7116760813824',
      },
    });
  });

  it('creates a compile-ready damage model without losing field provenance', () => {
    const skill = getWorkbenchGameData().skills.find((item) => item.id === 10900101);
    const model = createSkillDamageModel(skill, 99);

    expect(model).toMatchObject({
      source: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
      sourceKind: SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
      skillId: 10900101,
      characterId: 109001,
      level: 12,
      levelIndex: 11,
    });
    expect(model.sourcePath).toContain('109001.hero-module.local.json');
    expect(model.values).toEqual(['1363%', '399%', '84%', '286%']);
    expect(model.crossCheck).toMatchObject({
      status: 'matched',
      rowId: 1668,
      level: 12,
      values: ['1363%', '399%', '84%', '286%'],
    });
    expect(model.diagnostics).toEqual([]);
  });

  it('keeps generated cross-check mismatches explicit', () => {
    const summary = getSkillLevelCrossCheckSummary();
    const skill = getWorkbenchGameData().skills.find((item) => item.id === 10800562);
    const crossCheck = resolveSkillLevelCrossCheck(skill, 1);
    const resolved = resolveSkillDamageSegments(skill, 1);

    expect(summary).toMatchObject({
      matchedSkills: 118,
      mismatchedSkills: 2,
    });
    expect(crossCheck).toMatchObject({
      status: 'mismatch',
      skillId: 10800562,
      rowId: 1656,
      labels: [null],
      values: [null],
      expectedLabels: ['7112465846272'],
      expectedValues: ['7112465846528'],
    });
    expect(resolved.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      'skill-level-crosscheck-lang-missing',
      'skill-level-crosscheck-lang-missing',
      'skill-level-crosscheck-label-mismatch',
      'skill-level-crosscheck-value-mismatch',
    ]);
  });

  it('keeps missing and unparseable multiplier diagnostics explicit', () => {
    const resolved = resolveSkillDamageSegments(
      {
        id: 1,
        characterId: 2,
        level: {
          labels: ['坏值', '可用值'],
          values: [['bad', '250%']],
        },
        source: {
          heroModule: 'C:/PC2/Codex/AzPr/BWiki/data/hero-modules/local-all/mock.hero-module.local.json',
        },
      },
      1,
    );

    expect(resolved.segments).toHaveLength(1);
    expect(resolved.segments[0]).toMatchObject({
      index: 1,
      label: '可用值',
      rawValue: '250%',
      multiplier: 2.5,
    });
    expect(resolved.diagnostics).toEqual([
      expect.objectContaining({
        code: 'skill-level-crosscheck-entry-missing',
        severity: 'warning',
        skillId: 1,
      }),
      expect.objectContaining({
        code: 'skill-damage-multiplier-unparseable',
        severity: 'warning',
        index: 0,
        rawValue: 'bad',
      }),
    ]);
  });
});
