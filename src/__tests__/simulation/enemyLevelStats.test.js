import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import {
  calculateDefenseFactor,
  calculateLevelPressureFactor,
} from '../../simulation/mechanics/verifiedCombatFormulaRuntime';
import { resolveEnemyLevelStats } from '../../simulation/mechanics/enemyLevelStats';

const DEFAULT_ENEMY_ID = 300032;

describe('AzPr client enemy level stats', () => {
  const gameData = getWorkbenchGameData();
  const sourceEnemy = gameData.enemies.find(
    enemy => enemy.id === DEFAULT_ENEMY_ID
  );

  it('resolves Lv1, Lv80, and the last client row without interpolation', () => {
    const lv1 = resolve(DEFAULT_ENEMY_ID, 1);
    const lv80 = resolve(DEFAULT_ENEMY_ID, 80);
    const lv110 = resolve(DEFAULT_ENEMY_ID, 110);

    expect(lv1).toMatchObject({
      status: 'ready',
      stats: {
        attack: 997.458,
        maxHp: 690.24,
        physicalDefense: 454.5,
        magicalDefense: 454.5,
        maxToughness: 213.344,
      },
      source: { templateId: 1, templateValueId: 3001001 },
    });
    expect(lv80).toMatchObject({
      status: 'ready',
      stats: {
        attack: 14970.4044,
        maxHp: 86778.6984,
        physicalDefense: 810,
        magicalDefense: 810,
        maxToughness: 26822.0077,
      },
      source: { templateId: 1, templateValueId: 3001080 },
    });
    expect(lv110).toMatchObject({
      status: 'ready',
      source: { templateValueId: 3001110 },
    });
    expect(lv80.stats.maxHp).not.toBe(sourceAttribute('MAXHP').value);
  });

  it('fails closed when the requested level row or default enemy pack is absent', () => {
    expect(resolve(DEFAULT_ENEMY_ID, 111)).toMatchObject({
      status: 'missing-enemy-level-row',
      applied: false,
      stats: {
        attack: null,
        maxHp: null,
        physicalDefense: null,
        magicalDefense: null,
        maxToughness: null,
      },
      rawTemplateStats: { maxHp: 8628 },
    });

    const enemyWithoutDefaultPack = gameData.enemies.find(
      enemy => enemy.levelProfile?.status === 'missing-default-enemy-pack'
    );
    expect(resolve(enemyWithoutDefaultPack.id, 80)).toMatchObject({
      status: 'missing-default-enemy-pack',
      applied: false,
    });
  });

  it('recomputes from the selected enemy pack template and applies final multipliers last', () => {
    const defaultScenario = compile(DEFAULT_ENEMY_ID, 80, {
      hpMultiplier: 2,
      defenseMultiplier: 1.5,
      toughnessMultiplier: 3,
      initialToughnessRatio: 0.25,
    });
    const eliteScenario = compile(300082, 80);

    expect(defaultScenario.enemy).toMatchObject({
      stats: {
        maxHp: 86778.6984,
        physicalDefense: 810,
        magicalDefense: 810,
        maxToughness: 80466.0231,
        initialToughness: 20116.505775,
      },
      effectiveStats: {
        maxHp: 173557.3968,
        physicalDefense: 1215,
        magicalDefense: 1215,
        maxToughness: 80466.0231,
      },
      levelScaling: {
        status: 'ready',
        source: { templateId: 1, templateValueId: 3001080 },
      },
    });
    expect(eliteScenario.enemy.levelScaling.source).toMatchObject({
      templateId: 2,
      templateValueId: 3002080,
    });
    expect(eliteScenario.enemy.stats.maxHp).not.toBe(
      defaultScenario.enemy.stats.maxHp
    );
  });

  it('uses the generated enemy catalog as the base template source', () => {
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      enemyConfig: { level: 80 },
    });
    project.enemy = {
      ...project.enemy,
      baseAttributes: project.enemy.baseAttributes.map(attribute =>
        attribute.key === 'MAXHP' ? { ...attribute, value: 1 } : attribute
      ),
    };

    expect(compileProject(project, gameData).enemy).toMatchObject({
      stats: { maxHp: 86778.6984 },
      levelScaling: {
        rawTemplateStats: { maxHp: 8628 },
        source: {
          targetLevelAppliedToStats: false,
          sceneAttributeScaleApplied: false,
        },
      },
    });
  });

  it('keeps targetLevel damage factors separate from level-grown panel resolution', () => {
    const fixedDefense = {
      targetDefense: 810,
      targetMagicDefense: 810,
    };
    const lv1DefenseFactor = calculateDefenseFactor({
      ...fixedDefense,
      targetLevel: 1,
    });
    const lv80DefenseFactor = calculateDefenseFactor({
      ...fixedDefense,
      targetLevel: 80,
    });

    expect(lv1DefenseFactor.value).not.toBe(lv80DefenseFactor.value);
    expect(
      calculateLevelPressureFactor({
        attackerLevel: 70,
        targetLevel: 80,
        enemyPackLevelPressureType: 1,
        table: { 1010: 0.75 },
      })
    ).toEqual({ applies: true, tableId: 1010, factor: 0.75 });
    expect(resolve(DEFAULT_ENEMY_ID, 80).source).toMatchObject({
      targetLevelFormulaStatus: 'separate-damage-formula-input',
    });
  });

  it('leaves element defenses unchanged when the client coefficient is one', () => {
    const levelStats = resolve(DEFAULT_ENEMY_ID, 80);
    expect(levelStats.attributes.FIRE_DEFENSE).toMatchObject({
      value: 0,
      coefficient: 1,
      divisor: 1,
      effectiveValue: 0,
      status: 'client-level-growth-applied',
    });
  });

  function resolve(enemyId, level) {
    const selected = gameData.enemies.find(enemy => enemy.id === enemyId);
    return resolveEnemyLevelStats({
      enemy: {
        enemyId,
        level,
        baseAttributes: selected.property.baseAttributes,
      },
      sourceEnemy: selected,
      profiles: gameData.enemyLevelProfiles,
    });
  }

  function compile(enemyId, level, enemyConfig = {}) {
    const project = createWorkbenchProject(
      { ...DEFAULT_WORKBENCH_SELECTION, enemyId },
      { enemyConfig: { level, ...enemyConfig } }
    );
    return compileProject(project, gameData);
  }

  function sourceAttribute(key) {
    return sourceEnemy.property.baseAttributes.find(
      attribute => attribute.key === key
    );
  }
});
