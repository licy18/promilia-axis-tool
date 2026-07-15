import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import kiboActionCatalog from '../../data/generated/workbench-kibo-action-catalog.json';
import workbenchSeed from '../../data/generated/workbench-seed.json';
import { loadWorkbenchKiboActionCatalog } from '../../data/workbenchKiboActionCatalog';
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

  it('publishes a positive standard-battle cooldown for every kibo action', () => {
    const kiboActions = kiboActionCatalog.items.flatMap(item =>
      item.actions.map(action => ({ kiboId: item.kiboId, ...action }))
    );

    expect(kiboActionCatalog).toMatchObject({
      schemaVersion: 2,
      sources: {
        cooldown: expect.stringContaining('skillsub_logic.json'),
      },
    });
    expect(kiboActions).toHaveLength(366);
    expect(kiboActions.every(action => action.cooldownMs > 0)).toBe(true);
    expect(
      kiboActions.find(
        action => action.kiboId === 500001 && action.skillId === 50000102
      )
    ).toMatchObject({
      cooldownMs: 18000,
      cooldownCount: 1,
      kiboVersusCooldownMs: 24000,
    });
  });

  it('loads the current kibo action catalog schema through the lazy boundary', async () => {
    const catalog = await loadWorkbenchKiboActionCatalog(async () => ({
      ok: true,
      json: async () => kiboActionCatalog,
    }));

    expect(catalog.schemaVersion).toBe(2);
    expect(catalog.items).toHaveLength(kiboActionCatalog.items.length);
  });
});

function actionIconExists(icon) {
  return existsSync(
    path.join(process.cwd(), 'public', 'assets', 'actions', icon)
  );
}
