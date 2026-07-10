import { describe, expect, it } from 'vitest';
import {
  getAzprCharacterById,
  getAzprEnemyById,
  getAzprSkillById,
} from '../../data/azprGenerated';
import {
  FIRST_SLICE_CHARACTER_ID,
  FIRST_SLICE_ENEMY_ID,
  FIRST_SLICE_SKILL_ID,
  createFirstVerticalSliceProject,
  getFirstVerticalSliceGameData,
} from '../../domain/fixtures/firstVerticalSlice';
import {
  PROJECT_SCHEMA_VERSION,
  PROJECT_TIME_UNIT,
  validateProject,
} from '../../domain/projectSchema';

describe('project domain schema', () => {
  it('creates a valid first vertical slice project from real AzPr data', () => {
    const project = createFirstVerticalSliceProject();
    const result = validateProject(project, getFirstVerticalSliceGameData());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(project.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
    expect(project.time.unit).toBe(PROJECT_TIME_UNIT);
    expect(project.actors).toHaveLength(1);
    expect(project.actions).toHaveLength(1);
    expect(project).not.toHaveProperty('skillBlocks');

    expect(getAzprCharacterById(FIRST_SLICE_CHARACTER_ID)?.name).toBe('末音');
    expect(getAzprSkillById(FIRST_SLICE_SKILL_ID)?.characterId).toBe(
      FIRST_SLICE_CHARACTER_ID
    );
    expect(getAzprEnemyById(FIRST_SLICE_ENEMY_ID)?.property.exists).toBe(true);
  });

  it('keeps missing authoritative skill timing visible on the action', () => {
    const project = createFirstVerticalSliceProject();
    const result = validateProject(project, getFirstVerticalSliceGameData());
    const timingWarning = result.warnings.find(
      warning => warning.code === 'action.timing.missing'
    );

    expect(project.actions[0].timing.needsTimingData).toBe(true);
    expect(project.actions[0].timing.source).toBe(
      'missing-skill-asset-or-runtime-capture'
    );
    expect(timingWarning).toBeTruthy();
  });

  it('round-trips through JSON without losing schema validity', () => {
    const project = createFirstVerticalSliceProject();
    const parsed = JSON.parse(JSON.stringify(project));
    const result = validateProject(parsed, getFirstVerticalSliceGameData());

    expect(result.valid).toBe(true);
    expect(parsed.metadata.fixturePurpose).toBe(
      'stage-2-domain-schema-and-stage-3-simulation-seed'
    );
  });

  it('rejects unknown actor and skill references', () => {
    const project = createFirstVerticalSliceProject();
    project.actions[0] = {
      ...project.actions[0],
      actorId: 'actor-missing',
      skillId: 999999999,
    };

    const result = validateProject(project, getFirstVerticalSliceGameData());
    const codes = result.errors.map(error => error.code);

    expect(result.valid).toBe(false);
    expect(codes).toContain('action.actorId.unknown');
    expect(codes).toContain('action.skillId.unknown');
  });

  it('validates enemy toughness project settings', () => {
    const project = createFirstVerticalSliceProject();
    project.enemy.toughnessMultiplier = 0;
    project.enemy.initialToughnessRatio = 1.5;

    const result = validateProject(project, getFirstVerticalSliceGameData());
    const codes = result.errors.map(error => error.code);

    expect(result.valid).toBe(false);
    expect(codes).toContain('enemy.toughnessMultiplier.invalid');
    expect(codes).toContain('enemy.initialToughnessRatio.invalid');
  });

  it('validates enemy element defense override keys and values', () => {
    const project = createFirstVerticalSliceProject();
    project.enemy.elementDefenseOverrides = {
      FIRE_DEFENSE: Number.NaN,
      UNKNOWN_DEFENSE: 0.25,
    };

    const result = validateProject(project, getFirstVerticalSliceGameData());
    const codes = result.errors.map(error => error.code);

    expect(result.valid).toBe(false);
    expect(codes).toContain('enemy.elementDefenseOverrides.value.invalid');
    expect(codes).toContain('enemy.elementDefenseOverrides.key.invalid');
  });
});
