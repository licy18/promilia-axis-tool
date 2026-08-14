import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  createWorkbenchProject,
  getWorkbenchInjectedGameData,
  setWorkbenchInjectedGameData,
} from '../../domain/workbenchProjectFactory';

function loadDatabaseGameData() {
  const root = process.cwd();
  const read = name =>
    JSON.parse(
      fs.readFileSync(root + '/src/data/database/' + name + '.json', 'utf8')
    );
  return {
    characters: read('characters').items,
    skills: read('skills').items,
    kibos: read('kibos').items,
    enemies: read('enemies').items,
    elements: read('elements').items,
    equipment: read('equipment').items,
    soulessences: read('soulessences').items,
  };
}

afterEach(() => {
  setWorkbenchInjectedGameData(null);
});

describe('workbench injected gameData (P1-2)', () => {
  it('injected database gameData drives project creation', () => {
    const dbGameData = loadDatabaseGameData();
    const injected = structuredClone(dbGameData);
    const firstCharacter = injected.characters[0];
    const originalName = firstCharacter.name;
    firstCharacter.name = 'INJECTED_HERO_' + originalName;

    setWorkbenchInjectedGameData(injected);
    expect(getWorkbenchInjectedGameData()).toBe(injected);

    const project = createWorkbenchProject(
      {
        characterId: firstCharacter.id,
        secondaryCharacterId: injected.characters[1]?.id,
        enemyId: injected.enemies[0]?.id,
      },
      { durationMs: 30000 }
    );

    // 项目角色名来自注入的数据库（而非静态 seed）
    const projectCharacterNames = project.actors
      .map(actor => actor.name)
      .filter(Boolean);
    expect(projectCharacterNames).toContain('INJECTED_HERO_' + originalName);

    // 未注入时恢复 seed 行为
    setWorkbenchInjectedGameData(null);
    const seedProject = createWorkbenchProject(
      {
        characterId: firstCharacter.id,
        secondaryCharacterId: injected.characters[1]?.id,
        enemyId: injected.enemies[0]?.id,
      },
      { durationMs: 30000 }
    );
    const seedNames = seedProject.actors
      .map(actor => actor.name)
      .filter(Boolean);
    expect(seedNames).not.toContain('INJECTED_HERO_' + originalName);
  });

  it('injected enemy MAXHP drives the project enemy (P2-5)', () => {
    const dbGameData = loadDatabaseGameData();
    const injected = structuredClone(dbGameData);
    const enemy = injected.enemies[0];
    const maxHp = enemy.property.baseAttributes.find(
      attr => attr.key === 'MAXHP'
    );
    maxHp.value = 987654321;

    setWorkbenchInjectedGameData(injected);
    const project = createWorkbenchProject(
      {
        characterId: injected.characters[0].id,
        secondaryCharacterId: injected.characters[1]?.id,
        enemyId: enemy.id,
      },
      { durationMs: 30000 }
    );

    const enemyMaxHp = project.enemy?.baseAttributes?.find(
      attr => attr.key === 'MAXHP'
    );
    expect(enemyMaxHp?.value).toBe(987654321);
  });

  it('injected equipment id is accepted by loadout normalization (P2-5)', () => {
    const dbGameData = loadDatabaseGameData();
    const injected = structuredClone(dbGameData);
    const equipment = injected.equipment.find(item => item.type === '武器');
    expect(equipment).toBeDefined();

    setWorkbenchInjectedGameData(injected);
    const project = createWorkbenchProject(
      {
        characterId: injected.characters[0].id,
        secondaryCharacterId: injected.characters[1]?.id,
        enemyId: injected.enemies[0]?.id,
      },
      {
        durationMs: 30000,
        teamSlots: [
          {
            slotId: 'team-slot-1',
            position: 0,
            characterId: injected.characters[0].id,
          },
        ],
        actorConfigs: [
          {
            characterId: injected.characters[0].id,
            loadout: {
              equipment: { weapon: equipment.id },
            },
          },
        ],
      }
    );

    const firstActor = project.actors[0];
    expect(firstActor.loadout.equipment.weapon).toBe(equipment.id);
  });
});
