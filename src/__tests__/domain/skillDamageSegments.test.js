import { describe, expect, it } from 'vitest';
import { getWorkbenchGameData } from '../../domain/workbenchProjectFactory';
import {
  SKILL_ACTION_VARIANT_SOURCE_KIND,
  SKILL_DAMAGE_SEGMENT_SOURCE_KIND,
  createSkillDamageModel,
  resolveSkillActionVariants,
  resolveSkillDamageSegments,
} from '../../domain/skillDamageSegments';
import {
  SKILL_LEVEL_CROSSCHECK_SOURCE_KIND,
  getSkillLevelCrossCheckSummary,
  resolveSkillLevelCrossCheck,
} from '../../domain/skillLevelCrossCheck';

describe('skill action variant adapter', () => {
  it('resolves AzPr hero-module skill level values as action variants with source metadata', () => {
    const skill = getWorkbenchGameData().skills.find(
      item => item.id === 10900101
    );
    const resolved = resolveSkillActionVariants(skill, 1);

    expect(SKILL_DAMAGE_SEGMENT_SOURCE_KIND).toBe(
      SKILL_ACTION_VARIANT_SOURCE_KIND
    );
    expect(resolved.sourceKind).toBe(SKILL_ACTION_VARIANT_SOURCE_KIND);
    expect(resolved.sourcePath).toContain(
      'BWiki/data/hero-modules/local-all/109001.hero-module.local.json'
    );
    expect(resolved.fieldPaths).toMatchObject({
      labels: 'skillSystem.10900101.skillLevel.name',
      values: 'skillSystem.10900101.skillLevel.values[0]',
      description: 'skillSystem.10900101.skillDescribe',
    });
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.segments).toBe(resolved.variants);
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
      labelIds: [
        '7116760813568',
        '7116760813569',
        '7116760813570',
        '7116760813571',
      ],
      valueIds: [
        '7116760813824',
        '7116760813825',
        '7116760813826',
        '7116760813827',
      ],
      matches: {
        labels: true,
        values: true,
      },
    });
    expect(
      resolved.variants.map(variant => [
        variant.kind,
        variant.label,
        variant.rawValue,
        variant.multiplier,
      ])
    ).toEqual([
      ['normal-attack', '普攻', '649%', 6.49],
      ['charged-attack', '重击', '190%', 1.9],
      ['dodge-attack', '闪击', '40%', 0.4],
      ['plunging-attack', '跃击', '136%', 1.36],
    ]);
    expect(resolved.variants[0]).toMatchObject({
      displayLabel: '普通攻击',
      descriptionSection: {
        title: '普通攻击',
      },
      hitModel: {
        kind: 'normal-attack',
        source: 'description',
        hitCount: 5,
        totalRawValue: '649%',
        totalMultiplier: 6.49,
        distributionStatus: 'total-only',
      },
    });
    expect(resolved.variants[0].hitSegments).toHaveLength(5);
    expect(resolved.variants[0].hitSegments[0]).toMatchObject({
      label: '普攻 1段',
      rawValue: null,
      multiplier: null,
      totalRawValue: '649%',
      sourceStatus: 'description-hit-count-only',
    });
    expect(resolved.variants[0].source).toMatchObject({
      kind: SKILL_ACTION_VARIANT_SOURCE_KIND,
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
    const skill = getWorkbenchGameData().skills.find(
      item => item.id === 10900101
    );
    const model = createSkillDamageModel(skill, 99);

    expect(model).toMatchObject({
      source: SKILL_ACTION_VARIANT_SOURCE_KIND,
      sourceKind: SKILL_ACTION_VARIANT_SOURCE_KIND,
      skillId: 10900101,
      characterId: 109001,
      level: 12,
      levelIndex: 11,
    });
    expect(model.sourcePath).toContain('109001.hero-module.local.json');
    expect(model.values).toEqual(['1363%', '399%', '84%', '286%']);
    expect(model.variants.map(variant => variant.rawValue)).toEqual(
      model.values
    );
    expect(model.actionVariants).toBe(model.variants);
    expect(model.segments).toBe(model.variants);
    expect(model.crossCheck).toMatchObject({
      status: 'matched',
      rowId: 1668,
      level: 12,
      values: ['1363%', '399%', '84%', '286%'],
      labelIds: [
        '7164005453824',
        '7164005453825',
        '7164005453826',
        '7164005453827',
      ],
      valueIds: [
        '7164005454080',
        '7164005454081',
        '7164005454082',
        '7164005454083',
      ],
    });
    expect(model.diagnostics).toEqual([]);
  });

  it('keeps generated cross-check mismatches explicit', () => {
    const summary = getSkillLevelCrossCheckSummary();
    const skill = getWorkbenchGameData().skills.find(
      item => item.id === 10800562
    );
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
    expect(resolved.diagnostics.map(diagnostic => diagnostic.code)).toEqual([
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
          heroModule:
            'C:/PC2/Codex/AzPr/BWiki/data/hero-modules/local-all/mock.hero-module.local.json',
        },
      },
      1
    );

    expect(resolved.variants).toHaveLength(1);
    expect(resolved.variants[0]).toMatchObject({
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
