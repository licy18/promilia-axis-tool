import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import kiboActionCatalog from '../../data/generated/workbench-kibo-action-catalog.json';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import { getSkillActionCatalog } from '../../domain/skillActionCatalog';

describe('workbench action assets', () => {
  it('publishes every icon used by a schedulable role or kibo action', () => {
    const roleActions = workbenchSeed.gameData.characters.flatMap(character =>
      getSkillActionCatalog(
        workbenchSeed.gameData.skills.filter(
          skill => Number(skill.characterId) === Number(character.id)
        )
      )
    );
    const kiboActions = kiboActionCatalog.items.flatMap(item => item.actions);
    const missing = [...roleActions, ...kiboActions]
      .filter(action => !action.icon || !actionIconExists(action.icon))
      .map(action => ({ skillId: action.skillId, icon: action.icon }));

    expect(roleActions.length).toBeGreaterThan(0);
    expect(kiboActions).toHaveLength(366);
    expect(missing).toEqual([]);
  });
});

function actionIconExists(icon) {
  return existsSync(
    path.join(process.cwd(), 'public', 'assets', 'actions', icon)
  );
}
