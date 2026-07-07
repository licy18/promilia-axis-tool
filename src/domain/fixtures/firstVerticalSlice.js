import firstVerticalSlice from '../../data/generated/first-vertical-slice.json';
import {
  createActorFromCharacter,
  createEnemyFromData,
  createProject,
  createSkillAction,
} from '../projectSchema';

export const FIRST_SLICE_CHARACTER_ID = 109001;
export const FIRST_SLICE_SKILL_ID = 10900101;
export const FIRST_SLICE_ENEMY_ID = 300032;

export function createFirstVerticalSliceProject() {
  const { character, skill, enemy } = getFirstVerticalSliceSources();

  const actor = createActorFromCharacter(character, {
    actorId: `actor-${character.id}`,
    level: 80,
    skillLevels: {
      [skill.id]: 1,
    },
  });
  const enemyInstance = createEnemyFromData(enemy, {
    enemyInstanceId: `enemy-${enemy.id}`,
    level: 80,
  });

  return createProject({
    id: 'fixture-first-vertical-slice',
    name: '首条垂直切片：末音普攻对迅狼',
    durationMs: 30000,
    actors: [actor],
    enemy: enemyInstance,
    actions: [
      createSkillAction({
        id: 'action-0001',
        actorId: actor.id,
        skill,
        targetId: enemyInstance.id,
        startMs: 0,
        level: 1,
        note: '真实 AzPr 数据最小动作；精确命中帧等待 asset 或运行时捕获补充。',
      }),
    ],
    metadata: {
      fixture: true,
      fixturePurpose: 'stage-2-domain-schema-and-stage-3-simulation-seed',
      sourceCharacterId: character.id,
      sourceSkillId: skill.id,
      sourceEnemyId: enemy.id,
    },
  });
}

export function getFirstVerticalSliceGameData() {
  return firstVerticalSlice.gameData;
}

function getFirstVerticalSliceSources() {
  const character =
    firstVerticalSlice.gameData.characters.find((item) => item.id === FIRST_SLICE_CHARACTER_ID) ??
    firstVerticalSlice.gameData.characters[0];
  const skill =
    firstVerticalSlice.gameData.skills.find((item) => item.id === FIRST_SLICE_SKILL_ID) ??
    firstVerticalSlice.gameData.skills[0];
  const enemy =
    firstVerticalSlice.gameData.enemies.find((item) => item.id === FIRST_SLICE_ENEMY_ID) ??
    firstVerticalSlice.gameData.enemies[0];

  if (!character || !skill || !enemy) {
    throw new Error('First vertical slice generated data is incomplete');
  }

  return { character, skill, enemy };
}
