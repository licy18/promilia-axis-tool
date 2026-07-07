import { describe, expect, it } from 'vitest';
import {
  getAzprCharacters,
  getAzprElements,
  getAzprEnemies,
  getAzprEquipment,
  getAzprGeneratedManifest,
  getAzprKibos,
  getAzprSkillLogicIndex,
  getAzprSkillLevelCrossCheck,
  getAzprSkills,
  getAzprSoulessences,
  getAzprValidationReport,
} from '../../data/azprGenerated';

describe('generated AzPr data', () => {
  it('loads real local AzPr datasets instead of prototype placeholders', () => {
    const characters = getAzprCharacters();
    const elements = getAzprElements();
    const skills = getAzprSkills();

    expect(characters).toHaveLength(20);
    expect(elements).toHaveLength(10);
    expect(skills.length).toBeGreaterThanOrEqual(100);
    expect(getAzprEnemies().length).toBeGreaterThanOrEqual(200);
    expect(getAzprKibos()).toHaveLength(122);
    expect(getAzprEquipment()).toHaveLength(137);
    expect(getAzprSoulessences()).toHaveLength(62);

    const names = characters.map((character) => character.name);
    expect(names).toContain('末音');
    expect(names).not.toContain('钟离');
    expect(names).not.toContain('甘雨');
  });

  it('marks skill timing as missing until authoritative runtime data exists', () => {
    const skills = getAzprSkills();

    expect(skills.every((skill) => skill.needsTimingData)).toBe(true);
    expect(new Set(skills.map((skill) => skill.timingSource))).toEqual(
      new Set(['missing-skill-asset-or-runtime-capture']),
    );
  });

  it('keeps validation findings explicit for the next reconstruction stage', () => {
    const report = getAzprValidationReport();
    const timingWarning = report.warnings.find((warning) => warning.code === 'skill-timing-missing');
    const crossCheckWarning = report.warnings.find((warning) => warning.code === 'skill-level-crosscheck-mismatch');
    const logicMismatchInfo = report.warnings.find(
      (warning) => warning.code === 'skill-display-logic-timing-mismatch',
    );
    const placeholderWarning = report.warnings.find(
      (warning) => warning.code === 'non-azpr-placeholder-character',
    );

    expect(report.counts.characters).toBe(20);
    expect(report.counts.skillLevelCrossCheck).toBe(120);
    expect(report.counts.skillLogicIndex).toBe(120);
    expect(timingWarning.count).toBe(report.counts.skills);
    expect(crossCheckWarning).toMatchObject({
      severity: 'warning',
      count: 4,
      summary: {
        matchedSkills: 118,
        missingSkills: 0,
        mismatchedSkills: 2,
        matchedLevels: 998,
        missingLevels: 0,
        mismatchedLevels: 2,
      },
    });
    expect(logicMismatchInfo).toMatchObject({
      severity: 'info',
      count: 44,
      summary: {
        mappedSkills: 76,
        missingSkills: 0,
        mismatchedSkills: 44,
        subSkillIds: 120,
        missingLogicRows: 0,
        displayLogicMismatchSubSkills: 44,
        levelRows: 1000,
        elementValueRows: 2808,
        levelsMissingElementValues: 100,
        logicRowsWithNonZeroTiming: 60,
      },
    });
    expect(placeholderWarning.severity).toBe('ok');
  });

  it('cross-checks generated skill multipliers against NewTable skill_level rows', () => {
    const manifest = getAzprGeneratedManifest();
    const crossCheck = getAzprSkillLevelCrossCheck();
    const mayoiAttack = crossCheck.items.find((item) => item.skillId === 10900101);
    const mismatches = crossCheck.items.filter((item) => item.status !== 'matched');

    expect(manifest.files.skillLevelCrossCheck).toBe('skill-level-crosscheck.json');
    expect(crossCheck.count).toBe(120);
    expect(crossCheck.summary).toMatchObject({
      matchedSkills: 118,
      missingSkills: 0,
      mismatchedSkills: 2,
      matchedLevels: 998,
      missingLevels: 0,
      mismatchedLevels: 2,
    });
    expect(mayoiAttack.levels[0]).toMatchObject({
      rowId: 1657,
      status: 'matched',
      labels: ['普攻', '重击', '闪击', '跃击'],
      values: ['649%', '190%', '40%', '136%'],
      labelIds: ['7116760813568', '7116760813569', '7116760813570', '7116760813571'],
      valueIds: ['7116760813824', '7116760813825', '7116760813826', '7116760813827'],
      matches: {
        labels: true,
        values: true,
      },
    });
    expect(mismatches.map((item) => item.skillId)).toEqual([10800562, 19900361]);
  });

  it('maps skill_level subSkillId rows to skillsub_logic and skillsub_ele_value', () => {
    const manifest = getAzprGeneratedManifest();
    const logicIndex = getAzprSkillLogicIndex();
    const mayoiAttack = logicIndex.items.find((item) => item.skillId === 10900101);
    const timingMismatch = logicIndex.items.find((item) => item.skillId === 10100712);

    expect(manifest.files.skillLogicIndex).toBe('skill-logic-index.json');
    expect(logicIndex.count).toBe(120);
    expect(logicIndex.summary).toMatchObject({
      mappedSkills: 76,
      missingSkills: 0,
      mismatchedSkills: 44,
      subSkillIds: 120,
      missingLogicRows: 0,
      displayLogicMismatchSubSkills: 44,
      levelRows: 1000,
      elementValueRows: 2808,
      levelsMissingElementValues: 100,
      logicRowsWithNonZeroTiming: 60,
    });
    expect(mayoiAttack).toMatchObject({
      status: 'mapped',
      subSkillIds: [10900101],
      subSkills: [
        {
          subSkillId: 10900101,
          logic: {
            cooldownMs: 0,
            spCost: 0,
            selfCooldownMs: 0,
            gcdMs: 0,
          },
          displayMatchesLogic: true,
        },
      ],
    });
    expect(mayoiAttack.levels[0]).toMatchObject({
      skillLevelRowId: 1657,
      subSkillId: 10900101,
      display: {
        cooldownMs: 0,
        spCost: 0,
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
    });
    expect(timingMismatch.subSkills[0]).toMatchObject({
      subSkillId: 10100712,
      logic: {
        cooldownMs: 20000,
        spCost: 0,
      },
      displayPairs: [
        {
          cooldownMs: 13000,
          spCost: 0,
        },
      ],
      displayMatchesLogic: false,
    });
  });
});
