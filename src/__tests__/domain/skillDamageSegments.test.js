import { describe, expect, it } from 'vitest';
import { getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import {
  SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
  createSkillDamageModel,
  resolveSkillDamageSegments,
} from '../../domain/skillDamageSegments';

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
    expect(model.diagnostics).toEqual([]);
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
        code: 'skill-damage-multiplier-unparseable',
        severity: 'warning',
        index: 0,
        rawValue: 'bad',
      }),
    ]);
  });
});
