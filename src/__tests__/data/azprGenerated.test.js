import { describe, expect, it } from 'vitest';
import {
  getAzprCharacters,
  getAzprElements,
  getAzprEnemies,
  getAzprEquipment,
  getAzprKibos,
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
    const placeholderWarning = report.warnings.find(
      (warning) => warning.code === 'non-azpr-placeholder-character',
    );

    expect(report.counts.characters).toBe(20);
    expect(timingWarning.count).toBe(report.counts.skills);
    expect(placeholderWarning.severity).toBe('ok');
  });
});
