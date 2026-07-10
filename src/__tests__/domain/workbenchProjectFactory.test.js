import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getWorkbenchGameData,
  normalizeWorkbenchActorConfigs,
} from '../../domain/workbenchProjectFactory';
import { validateProject } from '../../domain/projectSchema';
import { compileProject } from '../../simulation/compiler/compileProject';

describe('workbench project actor configuration', () => {
  it('projects real AzPr loadout selections into actors and project loadouts', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      actorConfigs: [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          level: 80,
          loadout: {
            kiboId: 500001,
            equipment: {
              weapon: 1010111,
              top: 1020111,
              bottom: 1030111,
              earring: 1040111,
              ring: 1050111,
            },
            soulessenceId: 10001,
          },
        },
      ],
    });

    expect(project.actors[0]).toMatchObject({
      characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
      level: 80,
      loadout: {
        actorId: `actor-${DEFAULT_WORKBENCH_SELECTION.characterId}`,
        characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
        kiboId: 500001,
        equipment: {
          weapon: 1010111,
          top: 1020111,
          bottom: 1030111,
          earring: 1040111,
          ring: 1050111,
        },
        soulessenceId: 10001,
      },
    });
    expect(project.loadouts).toEqual(
      project.actors.map(actor => actor.loadout)
    );
    expect(project.metadata.loadoutCalculationStatus).toBe(
      'project-config-only'
    );
    expect(validateProject(project, getWorkbenchGameData()).valid).toBe(true);
  });

  it('keeps one normalized actor configuration for each selected team member', () => {
    const normalized = normalizeWorkbenchActorConfigs(
      [
        {
          characterId: DEFAULT_WORKBENCH_SELECTION.characterId,
          loadout: {
            kiboId: 999999999,
            equipment: {
              weapon: 1020111,
            },
            soulessenceId: 999999999,
          },
        },
      ],
      DEFAULT_WORKBENCH_SELECTION
    );

    expect(normalized.map(config => config.characterId)).toEqual([
      DEFAULT_WORKBENCH_SELECTION.characterId,
      DEFAULT_WORKBENCH_SELECTION.secondaryCharacterId,
    ]);
    expect(normalized[0].loadout).toMatchObject({
      kiboId: null,
      equipment: {
        weapon: null,
      },
      soulessenceId: null,
    });
  });

  it('rejects an equipment item placed in the wrong project slot', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION);
    project.actors[0].loadout.equipment.weapon = 1020111;
    project.loadouts[0].equipment.weapon = 1020111;

    const result = validateProject(project, getWorkbenchGameData());

    expect(result.valid).toBe(false);
    expect(result.errors.map(error => error.code)).toContain(
      'actor.loadout.equipmentType.mismatch'
    );
  });

  it('compiles enemy WEAKNESS_POINT_MAX with project toughness settings', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      enemyConfig: {
        toughnessMultiplier: 2,
        initialToughnessRatio: 0.25,
      },
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(scenario.enemy).toMatchObject({
      toughnessMultiplier: 2,
      initialToughnessRatio: 0.25,
      stats: {
        maxToughness: 13334,
        initialToughness: 3333.5,
      },
      toughness: {
        sourceKind: 'azpr-enemy-WEAKNESS_POINT_MAX',
        sourceStatus: 'toughness-config-derived-from-enemy-base-attribute',
        baseMax: 6667,
        maxMultiplier: 2,
        initialRatio: 0.25,
        maxValue: 13334,
        initialValue: 3333.5,
        applied: true,
      },
    });
  });
});
