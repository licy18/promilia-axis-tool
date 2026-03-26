// 伤害计算引擎

/**
 * 计算基础伤害
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} options 计算选项
 * @returns {number} 基础伤害值
 */
export function calculateBaseDamage(character, skill, options = {}) {
  // 基础倍率区：技能倍率 × 角色基础攻击力
  const baseAttack = character.stats.attack || 1000;
  const skillMultiplier = getSkillMultiplier(skill);

  // 攻击力区：基础攻击力 × (1 + 百分比攻击力加成) + 固定攻击力加成
  const attackPercentBonus = character.stats.attackPercentBonus || 0;
  const attackFlatBonus = character.stats.attackFlatBonus || 0;
  const finalAttack = baseAttack * (1 + attackPercentBonus) + attackFlatBonus;

  // 基础伤害 = 最终攻击力 × 技能倍率
  let baseDamage = finalAttack * skillMultiplier;

  // 处理技能等级加成
  const levelBonus = calculateLevelBonus(skill);
  baseDamage *= levelBonus;

  // 处理印记加成
  if (options.imprints) {
    baseDamage = applyImprintBonus(baseDamage, options.imprints, skill);
  }

  // 处理等级压制区
  if (options.enemyLevel && character.level) {
    baseDamage = applyLevelSuppression(
      baseDamage,
      character.level,
      options.enemyLevel
    );
  }

  // 处理条件伤害
  const conditionalDamage = calculateConditionalDamage(character, skill, options.enemy, options);
  baseDamage += conditionalDamage;

  return baseDamage;
}

/**
 * 应用等级压制效果
 * @param {number} baseDamage 基础伤害
 * @param {number} characterLevel 角色等级
 * @param {number} enemyLevel 敌人等级
 * @returns {number} 应用等级压制后的伤害
 */
function applyLevelSuppression(baseDamage, characterLevel, enemyLevel) {
  const levelDiff = characterLevel - enemyLevel;
  if (levelDiff > 0) {
    // 角色等级高于敌人，有伤害加成
    return baseDamage * (1 + levelDiff * 0.02);
  } else if (levelDiff < 0) {
    // 角色等级低于敌人，有伤害减免
    return baseDamage * Math.max(0.5, 1 + levelDiff * 0.02);
  }
  return baseDamage;
}

/**
 * 应用印记加成
 * @param {number} baseDamage 基础伤害
 * @param {object} imprints 印记数据
 * @param {object} skill 技能数据
 * @returns {number} 应用印记加成后的伤害
 */
function applyImprintBonus(baseDamage, imprints, skill) {
  let bonusDamage = baseDamage;

  // 遍历所有印记
  Object.keys(imprints).forEach(imprintType => {
    const imprint = imprints[imprintType];
    if (imprint && imprint.stack > 0) {
      // 检查技能是否能触发该印记
      if (skill.triggersImprint?.includes(imprintType)) {
        // 根据印记类型和层数计算加成
        switch (imprintType) {
          case 'burn':
            // 燃烧印记：每层增加10%伤害
            bonusDamage *= 1 + 0.1 * imprint.stack;
            break;
          case 'freeze':
            // 冻结印记：每层增加15%伤害
            bonusDamage *= 1 + 0.15 * imprint.stack;
            break;
          case 'poison':
            // 中毒印记：每层增加8%伤害
            bonusDamage *= 1 + 0.08 * imprint.stack;
            break;
          case 'shock':
            // 感电印记：每层增加12%伤害
            bonusDamage *= 1 + 0.12 * imprint.stack;
            break;
          case 'bleed':
            // 流血印记：每层增加6%伤害
            bonusDamage *= 1 + 0.06 * imprint.stack;
            break;
          case 'petrify':
            // 石化印记：每层增加20%伤害
            bonusDamage *= 1 + 0.2 * imprint.stack;
            break;
          case 'confuse':
            // 混乱印记：每层增加5%伤害
            bonusDamage *= 1 + 0.05 * imprint.stack;
            break;
          default:
            // 其他印记类型
            break;
        }
      }
    }
  });

  return bonusDamage;
}

/**
 * 计算印记伤害
 * @param {object} character 角色数据
 * @param {object} imprint 印记数据
 * @param {object} enemy 敌人数据
 * @param {object} buffs buffs数据
 * @returns {number} 印记伤害
 */
export function calculateImprintDamage(character, imprint, enemy, buffs = {}) {
  const baseAttack = character.stats.attack || 1000;
  const attackPercentBonus = character.stats.attackPercentBonus || 0;
  const attackFlatBonus = character.stats.attackFlatBonus || 0;
  const finalAttack = baseAttack * (1 + attackPercentBonus) + attackFlatBonus;

  let imprintDamage = 0;

  // 根据印记类型计算伤害
  switch (imprint.type) {
    case 'burn':
      // 燃烧：每秒造成攻击力15%的伤害
      imprintDamage = finalAttack * 0.15 * imprint.stack;
      break;
    case 'freeze':
      // 冻结：触发时造成攻击力20%的伤害
      imprintDamage = finalAttack * 0.2 * imprint.stack;
      break;
    case 'poison':
      // 中毒：每秒造成攻击力12%的伤害
      imprintDamage = finalAttack * 0.12 * imprint.stack;
      break;
    case 'shock':
      // 感电：触发时造成攻击力18%的伤害
      imprintDamage = finalAttack * 0.18 * imprint.stack;
      break;
    default:
      break;
  }

  // 应用增伤区
  const damageBonus = calculateDamageBonus(
    character,
    { element: imprint.element || 'physical' },
    buffs
  );
  // 应用抗性区
  const resistanceBonus = calculateResistanceBonus(
    enemy,
    { element: imprint.element || 'physical' },
    buffs
  );

  return Math.round(imprintDamage * damageBonus * resistanceBonus);
}

/**
 * 计算DOT持续伤害
 * @param {object} dot DOT效果数据
 * @param {object} character 角色数据
 * @param {object} enemy 敌人数据
 * @param {object} buffs buffs数据
 * @returns {number} 单次DOT伤害
 */
export function calculateDotDamage(dot, character, enemy, buffs = {}) {
  let dotDamage = 0;

  switch (dot.type) {
    case 'burn':
      // 燃烧DOT：基于攻击力的持续伤害
      dotDamage = (character.stats.attack || 1000) * (dot.multiplier || 0.1);
      break;
    case 'poison':
      // 中毒DOT：基于攻击力的持续伤害
      dotDamage = (character.stats.attack || 1000) * (dot.multiplier || 0.08);
      break;
    case 'bleed':
      // 流血DOT：基于攻击力的持续伤害
      dotDamage = (character.stats.attack || 1000) * (dot.multiplier || 0.06);
      break;
    case 'shock':
      // 感电DOT：基于攻击力的持续伤害
      dotDamage = (character.stats.attack || 1000) * (dot.multiplier || 0.09);
      break;
    default:
      // 其他DOT类型
      dotDamage = (character.stats.attack || 1000) * (dot.multiplier || 0.05);
  }

  // 应用增伤区
  const damageBonus = calculateDamageBonus(
    character,
    { element: dot.element || 'physical' },
    buffs
  );
  // 应用抗性区
  const resistanceBonus = calculateResistanceBonus(
    enemy,
    { element: dot.element || 'physical' },
    buffs
  );

  return Math.round(dotDamage * damageBonus * resistanceBonus * dot.stack);
}

/**
 * 处理DOT效果的更新
 * @param {array} dots 当前DOT效果列表
 * @param {number} deltaTime 时间增量（秒）
 * @returns {array} 更新后的DOT效果列表
 */
export function updateDotEffects(dots, deltaTime) {
  return dots
    .map(dot => ({
      ...dot,
      duration: dot.duration - deltaTime,
      timeSinceLastTick: (dot.timeSinceLastTick || 0) + deltaTime,
    }))
    .filter(dot => dot.duration > 0);
}

/**
 * 检查是否需要触发DOT伤害
 * @param {object} dot DOT效果数据
 * @returns {boolean} 是否需要触发伤害
 */
export function shouldTriggerDotDamage(dot) {
  return dot.timeSinceLastTick >= (dot.tickInterval || 1);
}

/**
 * 重置DOT伤害触发时间
 * @param {object} dot DOT效果数据
 * @returns {object} 重置后的DOT效果数据
 */
export function resetDotTickTime(dot) {
  return {
    ...dot,
    timeSinceLastTick: 0,
  };
}

/**
 * 更新印记状态
 * @param {object} imprints 当前印记状态
 * @param {object} skill 技能数据
 * @returns {object} 更新后的印记状态
 */
export function updateImprints(imprints, skill) {
  const newImprints = { ...imprints };

  // 处理技能添加的印记（旧结构）
  if (skill.addImprint) {
    const { type, stack, duration } = skill.addImprint;
    if (!newImprints[type]) {
      newImprints[type] = {
        stack: 0,
        duration: 0,
        element: skill.element || 'physical',
      };
    }
    newImprints[type].stack = Math.min(
      newImprints[type].stack + stack,
      skill.maxImprintStack || 10
    );
    newImprints[type].duration = duration;
  }

  // 处理技能添加的印记（新结构）
  if (skill.marks && skill.marks.add && Array.isArray(skill.marks.add)) {
    skill.marks.add.forEach(mark => {
      const { type, stack, duration, element } = mark;
      if (!newImprints[type]) {
        newImprints[type] = {
          stack: 0,
          duration: 0,
          element: element || skill.element || 'physical',
        };
      }
      newImprints[type].stack = Math.min(
        newImprints[type].stack + stack,
        mark.maxStack || 10
      );
      newImprints[type].duration = duration;
    });
  }

  // 处理技能消耗的印记（旧结构）
  if (skill.consumeImprint) {
    const { type, stack } = skill.consumeImprint;
    if (newImprints[type] && newImprints[type].stack >= stack) {
      newImprints[type].stack -= stack;
      if (newImprints[type].stack <= 0) {
        delete newImprints[type];
      }
    }
  }

  // 处理技能消耗的印记（新结构）
  if (skill.marks && skill.marks.consume && Array.isArray(skill.marks.consume)) {
    skill.marks.consume.forEach(mark => {
      const { type, stack } = mark;
      if (newImprints[type] && newImprints[type].stack >= stack) {
        newImprints[type].stack -= stack;
        if (newImprints[type].stack <= 0) {
          delete newImprints[type];
        }
      }
    });
  }

  return newImprints;
}

/**
 * 获取技能倍率
 * @param {object} skill 技能数据
 * @returns {number} 技能倍率
 */
function getSkillMultiplier(skill) {
  if (Array.isArray(skill.damageMultiplier)) {
    // 多段伤害取平均值
    return (
      skill.damageMultiplier.reduce((sum, val) => sum + val, 0) /
      skill.damageMultiplier.length
    );
  }
  return skill.damageMultiplier || 1.0;
}

/**
 * 计算技能等级加成
 * @param {object} skill 技能数据
 * @returns {number} 等级加成倍数
 */
function calculateLevelBonus(skill) {
  const level = skill.level || 1;
  // 每级增加5%伤害
  return 1 + (level - 1) * 0.05;
}

/**
 * 计算条件伤害
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} enemy 敌人数据
 * @param {object} options 计算选项
 * @returns {number} 条件伤害总和
 */
function calculateConditionalDamage(character, skill, enemy, options = {}) {
  let conditionalDamage = 0;
  
  if (skill.conditionalDamage && Array.isArray(skill.conditionalDamage)) {
    const baseAttack = character.stats.attack || 1000;
    const attackPercentBonus = character.stats.attackPercentBonus || 0;
    const attackFlatBonus = character.stats.attackFlatBonus || 0;
    const finalAttack = baseAttack * (1 + attackPercentBonus) + attackFlatBonus;
    
    skill.conditionalDamage.forEach(condition => {
      if (condition.condition === 'enemyHasMarks') {
        // 检查敌人是否有足够的印记
        const imprints = options.imprints || {};
        const targetImprints = imprints[condition.element] || { stack: 0 };
        
        if (targetImprints.stack >= condition.minCount) {
          // 计算条件伤害
          const damage = finalAttack * condition.multiplier;
          conditionalDamage += damage;
        }
      }
    });
  }
  
  return conditionalDamage;
}

/**
 * 计算增伤区
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} buffs buffs 数据
 * @returns {number} 增伤倍数
 */
export function calculateDamageBonus(character, skill, buffs = {}) {
  // 增伤区：1 + 元素增伤 + 技能增伤 + 全伤害增伤
  const element = skill.element || 'physical';
  const elementalBonus = character.stats.elementalBonuses?.[element] || 0;
  const skillBonus = buffs.skillBonus || 0;
  const allDamageBonus = buffs.allDamageBonus || 0;

  return 1 + elementalBonus + skillBonus + allDamageBonus;
}

/**
 * 管理Buff效果
 */
export class BuffManager {
  constructor() {
    this.buffs = [];
  }

  /**
   * 添加Buff
   * @param {object} buff Buff数据
   */
  addBuff(buff) {
    // 检查是否已有同类型Buff
    const existingBuffIndex = this.buffs.findIndex(b => b.id === buff.id);

    if (existingBuffIndex >= 0) {
      // 刷新同类型Buff
      this.buffs[existingBuffIndex] = {
        ...buff,
        startTime: Date.now(),
        remainingTime: buff.duration,
      };
    } else {
      // 添加新Buff
      this.buffs.push({
        ...buff,
        startTime: Date.now(),
        remainingTime: buff.duration,
      });
    }
  }

  /**
   * 检查并添加条件Buff
   * @param {object} skill 技能数据
   * @param {object} options 计算选项
   */
  checkAndAddConditionalBuffs(skill, options = {}) {
    if (skill.buffs && Array.isArray(skill.buffs)) {
      skill.buffs.forEach(conditionalBuff => {
        if (conditionalBuff.condition === 'enemyHasMarks') {
          // 检查敌人是否有足够的印记
          const imprints = options.imprints || {};
          const targetImprints = imprints[conditionalBuff.element] || { stack: 0 };
          
          if (targetImprints.stack >= conditionalBuff.minCount) {
            // 添加Buff
            this.addBuff(conditionalBuff.buff);
          }
        }
      });
    }
  }

  /**
   * 更新Buff状态
   * @param {number} deltaTime 时间增量（秒）
   */
  update(deltaTime) {
    this.buffs = this.buffs
      .map(buff => ({
        ...buff,
        remainingTime: buff.remainingTime - deltaTime,
      }))
      .filter(buff => buff.remainingTime > 0);
  }

  /**
   * 获取当前所有Buff的效果
   * @returns {object} Buff效果汇总
   */
  getBuffEffects() {
    const effects = {
      attackPercentBonus: 0,
      skillBonus: 0,
      allDamageBonus: 0,
      criticalRate: 0,
      criticalDamage: 0,
      cooldownReduction: 0,
      energyCostReduction: 0,
      energyGainBonus: 0,
      resistanceReduction: 0,
    };

    this.buffs.forEach(buff => {
      Object.keys(buff.effects || {}).forEach(key => {
        if (effects[key] !== undefined) {
          effects[key] += buff.effects[key];
        }
      });
    });

    return effects;
  }

  /**
   * 检查是否存在特定Buff
   * @param {string} buffId Buff ID
   * @returns {boolean} 是否存在
   */
  hasBuff(buffId) {
    return this.buffs.some(buff => buff.id === buffId);
  }

  /**
   * 移除特定Buff
   * @param {string} buffId Buff ID
   */
  removeBuff(buffId) {
    this.buffs = this.buffs.filter(buff => buff.id !== buffId);
  }

  /**
   * 清空所有Buff
   */
  clear() {
    this.buffs = [];
  }
}

/**
 * 计算Buff联动效果
 * @param {array} buffs 当前Buff列表
 * @param {object} skill 技能数据
 * @returns {object} 联动效果加成
 */
export function calculateBuffSynergy(buffs, skill) {
  let synergyBonus = 1;

  // 检查是否有联动Buff
  const synergyBuffs = buffs.filter(buff => buff.synergies?.includes(skill.id));

  synergyBuffs.forEach(buff => {
    if (buff.synergyMultiplier) {
      synergyBonus *= 1 + buff.synergyMultiplier;
    }
  });

  return synergyBonus;
}

/**
 * 计算元素共鸣效果
 * @param {array} characters 队伍角色列表
 * @returns {object} 元素共鸣加成
 */
export function calculateElementalResonance(characters) {
  // 统计各元素角色数量
  const elementCount = {};
  characters.forEach(character => {
    const element = character.element || 'physical';
    elementCount[element] = (elementCount[element] || 0) + 1;
  });

  const resonanceEffects = {
    damageBonus: 1,
    attackBonus: 0,
    criticalRateBonus: 0,
    criticalDamageBonus: 0,
  };

  // 火元素共鸣：2火 +15%火伤，3火 +25%火伤
  if (elementCount.fire >= 2) {
    resonanceEffects.damageBonus *= 1 + (elementCount.fire >= 3 ? 0.25 : 0.15);
  }

  // 水元素共鸣：2水 +10%生命，3水 +15%生命
  if (elementCount.water >= 2) {
    resonanceEffects.attackBonus += elementCount.water >= 3 ? 0.15 : 0.1;
  }

  // 风元素共鸣：2风 +10%攻速，3风 +15%攻速
  if (elementCount.wind >= 2) {
    resonanceEffects.attackBonus += elementCount.wind >= 3 ? 0.15 : 0.1;
  }

  // 雷元素共鸣：2雷 +10%暴击率，3雷 +15%暴击率
  if (elementCount.thunder >= 2) {
    resonanceEffects.criticalRateBonus +=
      elementCount.thunder >= 3 ? 0.15 : 0.1;
  }

  // 冰元素共鸣：2冰 +15%冰伤，3冰 +25%冰伤
  if (elementCount.ice >= 2) {
    resonanceEffects.damageBonus *= 1 + (elementCount.ice >= 3 ? 0.25 : 0.15);
  }

  // 物理共鸣：2物理 +10%物理伤，3物理 +20%物理伤
  if (elementCount.physical >= 2) {
    resonanceEffects.damageBonus *=
      1 + (elementCount.physical >= 3 ? 0.2 : 0.1);
  }

  return resonanceEffects;
}

/**
 * 应用元素共鸣效果到伤害计算
 * @param {number} damage 原始伤害
 * @param {object} resonanceEffects 元素共鸣效果
 * @returns {number} 应用共鸣效果后的伤害
 */
export function applyElementalResonance(damage, resonanceEffects) {
  return damage * resonanceEffects.damageBonus;
}

/**
 * 计算暴击区
 * @param {object} character 角色数据
 * @param {object} options 计算选项
 * @returns {number} 暴击倍数
 */
export function calculateCriticalBonus(character, options = {}) {
  const criticalRate = character.stats.criticalRate || 0.05;
  const criticalDamage = character.stats.criticalDamage || 0.5;
  const isCritical = options.isCritical;

  if (isCritical !== undefined) {
    // 固定暴击/不暴击模式
    return isCritical ? 1 + criticalDamage : 1;
  } else {
    // 期望模式
    return 1 + criticalRate * criticalDamage;
  }
}

/**
 * 计算抗性区
 * @param {object} enemy 敌人数据
 * @param {object} skill 技能数据
 * @param {object} buffs buffs 数据
 * @param {object} options 计算选项
 * @returns {number} 抗性减免倍数
 */
export function calculateResistanceBonus(
  enemy,
  skill,
  buffs = {},
  options = {}
) {
  // 抗性区：(1 - 抗性削减) × (1 - 目标抗性)
  const element = skill.element || 'physical';
  const enemyResistance = enemy.resistance?.[element] || 0;
  const resistanceReduction = buffs.resistanceReduction || 0;

  // 确保抗性不会为负或超过上限
  let finalResistance = Math.max(0, Math.min(0.9, enemyResistance));

  // 考虑破防状态
  if (options.isBroken) {
    // 破防状态下抗性降低50%
    finalResistance *= 0.5;
  }

  // 考虑防御穿透
  const defensePenetration = buffs.defensePenetration || 0;
  finalResistance = Math.max(0, finalResistance - defensePenetration);

  return (1 - resistanceReduction) * (1 - finalResistance);
}

/**
 * 计算韧性值变化
 * @param {object} enemy 敌人数据
 * @param {object} skill 技能数据
 * @returns {number} 韧性值变化
 */
export function calculateToughnessChange(enemy, skill) {
  // 基础韧性伤害
  const baseToughnessDamage = skill.toughnessDamage || 0;

  // 考虑技能类型对韧性的影响
  let typeMultiplier = 1;
  switch (skill.type) {
    case 'normal':
      typeMultiplier = 1;
      break;
    case 'charge':
      typeMultiplier = 1.5;
      break;
    case 'skill':
      typeMultiplier = 2;
      break;
    case 'ultimate':
      typeMultiplier = 3;
      break;
    case 'combo':
      typeMultiplier = 2.5;
      break;
    default:
      typeMultiplier = 1;
  }

  return baseToughnessDamage * typeMultiplier;
}

/**
 * 检查是否破防
 * @param {object} enemy 敌人数据
 * @param {number} currentToughness 当前韧性值
 * @returns {boolean} 是否破防
 */
export function checkBreakState(enemy, currentToughness) {
  const maxToughness = enemy.toughness || 100;
  return currentToughness <= 0;
}

/**
 * 计算破防状态的伤害加成
 * @param {boolean} isBroken 是否破防
 * @returns {number} 伤害加成倍数
 */
export function calculateBreakBonus(isBroken) {
  return isBroken ? 1.5 : 1; // 破防状态下伤害增加50%
}

/**
 * 计算最终伤害
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} enemy 敌人数据
 * @param {object} buffs buffs 数据
 * @param {object} options 计算选项
 * @returns {number} 最终伤害值
 */
export function calculateFinalDamage(
  character,
  skill,
  enemy,
  buffs = {},
  options = {}
) {
  // 基础伤害
  const baseDamage = calculateBaseDamage(character, skill, options);

  // 增伤区
  const damageBonus = calculateDamageBonus(character, skill, buffs);

  // 暴击区
  const criticalBonus = calculateCriticalBonus(character, options);

  // 抗性区
  const resistanceBonus = calculateResistanceBonus(
    enemy,
    skill,
    buffs,
    options
  );

  // 破防加成
  const breakBonus = calculateBreakBonus(options.isBroken);

  // Buff联动效果
  const buffSynergyBonus = calculateBuffSynergy(options.buffList || [], skill);

  // 元素共鸣效果
  let resonanceBonus = 1;
  if (options.resonanceEffects) {
    resonanceBonus = options.resonanceEffects.damageBonus;
  }

  // 最终伤害 = 基础伤害 × 增伤倍数 × 暴击倍数 × 抗性减免倍数 × 破防加成 × Buff联动加成 × 元素共鸣加成
  const finalDamage =
    baseDamage *
    damageBonus *
    criticalBonus *
    resistanceBonus *
    breakBonus *
    buffSynergyBonus *
    resonanceBonus;

  return Math.round(finalDamage);
}

/**
 * 创建技能快照
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} buffs 当前buff状态
 * @returns {object} 技能快照
 */
export function createSkillSnapshot(character, skill, buffs = {}) {
  return {
    timestamp: Date.now(),
    characterStats: {
      ...character.stats,
    },
    skillData: {
      ...skill,
    },
    buffs: {
      ...buffs,
    },
  };
}

/**
 * 使用快照计算技能伤害
 * @param {object} snapshot 技能快照
 * @param {object} enemy 敌人数据
 * @param {object} options 计算选项
 * @returns {object} 技能伤害数据
 */
export function calculateSkillDamageFromSnapshot(
  snapshot,
  enemy,
  options = {}
) {
  const { characterStats, skillData, buffs } = snapshot;

  // 重建角色数据
  const character = {
    stats: characterStats,
  };

  return calculateSkillDamage(character, skillData, enemy, buffs, options);
}

/**
 * 计算技能伤害（支持多段伤害）
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} enemy 敌人数据
 * @param {object} buffs buffs 数据
 * @param {object} options 计算选项
 * @returns {object} 技能伤害数据
 */
export function calculateSkillDamage(
  character,
  skill,
  enemy,
  buffs = {},
  options = {}
) {
  const damageData = {
    totalDamage: 0,
    segments: [],
    followUpDamage: 0,
    details: {
      baseAttack: character.stats.attack || 1000,
      attackPercentBonus: character.stats.attackPercentBonus || 0,
      attackFlatBonus: character.stats.attackFlatBonus || 0,
      finalAttack: 0,
      skillMultiplier: getSkillMultiplier(skill),
      baseDamage: 0,
      damageBonus: 0,
      criticalBonus: 0,
      resistanceBonus: 0,
      breakBonus: 0,
      buffSynergyBonus: 0,
      resonanceBonus: 0,
      damageBreakdown: {},
    },
  };

  // 计算基础攻击力
  const baseAttack = character.stats.attack || 1000;
  const attackPercentBonus = character.stats.attackPercentBonus || 0;
  const attackFlatBonus = character.stats.attackFlatBonus || 0;
  const finalAttack = baseAttack * (1 + attackPercentBonus) + attackFlatBonus;
  damageData.details.finalAttack = finalAttack;

  // 计算技能倍率
  const skillMultiplier = getSkillMultiplier(skill);

  // 计算基础伤害
  let baseDamage = finalAttack * skillMultiplier;
  if (options.imprints) {
    baseDamage = applyImprintBonus(baseDamage, options.imprints, skill);
  }
  damageData.details.baseDamage = baseDamage;

  // 计算增伤区
  const damageBonus = calculateDamageBonus(character, skill, buffs);
  damageData.details.damageBonus = damageBonus;

  // 计算暴击区
  const criticalBonus = calculateCriticalBonus(character, options);
  damageData.details.criticalBonus = criticalBonus;

  // 计算抗性区
  const resistanceBonus = calculateResistanceBonus(
    enemy,
    skill,
    buffs,
    options
  );
  damageData.details.resistanceBonus = resistanceBonus;

  // 计算破防加成
  const breakBonus = calculateBreakBonus(options.isBroken);
  damageData.details.breakBonus = breakBonus;

  // 计算Buff联动效果
  const buffSynergyBonus = calculateBuffSynergy(options.buffList || [], skill);
  damageData.details.buffSynergyBonus = buffSynergyBonus;

  // 计算元素共鸣效果
  let resonanceBonus = 1;
  if (options.resonanceEffects) {
    resonanceBonus = options.resonanceEffects.damageBonus;
  }
  damageData.details.resonanceBonus = resonanceBonus;

  // 计算伤害构成
  damageData.details.damageBreakdown = {
    base: Math.round(baseDamage),
    damageBonus: Math.round(baseDamage * (damageBonus - 1)),
    critical: Math.round(baseDamage * damageBonus * (criticalBonus - 1)),
    resistance: Math.round(
      baseDamage * damageBonus * criticalBonus * (resistanceBonus - 1)
    ),
    break: Math.round(
      baseDamage *
        damageBonus *
        criticalBonus *
        resistanceBonus *
        (breakBonus - 1)
    ),
    buffSynergy: Math.round(
      baseDamage *
        damageBonus *
        criticalBonus *
        resistanceBonus *
        breakBonus *
        (buffSynergyBonus - 1)
    ),
    resonance: Math.round(
      baseDamage *
        damageBonus *
        criticalBonus *
        resistanceBonus *
        breakBonus *
        buffSynergyBonus *
        (resonanceBonus - 1)
    ),
  };

  if (skill.multiHit && Array.isArray(skill.multiHit)) {
    // 新的多段伤害结构
    skill.multiHit.forEach((hit, index) => {
      const segmentDamage = calculateFinalDamage(
        character,
        { ...skill, damageMultiplier: hit.multiplier, element: hit.element },
        enemy,
        buffs,
        options
      );
      damageData.segments.push({
        segment: index + 1,
        damage: segmentDamage,
        multiplier: hit.multiplier,
        element: hit.element,
        hitType: hit.hitType,
      });
      damageData.totalDamage += segmentDamage;
    });
  } else if (Array.isArray(skill.damageMultiplier)) {
    // 旧的多段伤害结构
    skill.damageMultiplier.forEach((multiplier, index) => {
      const segmentDamage = calculateFinalDamage(
        character,
        { ...skill, damageMultiplier: multiplier },
        enemy,
        buffs,
        options
      );
      damageData.segments.push({
        segment: index + 1,
        damage: segmentDamage,
        multiplier: multiplier,
      });
      damageData.totalDamage += segmentDamage;
    });
  } else {
    // 单段伤害
    const damage = calculateFinalDamage(
      character,
      skill,
      enemy,
      buffs,
      options
    );
    damageData.segments.push({
      segment: 1,
      damage: damage,
      multiplier: skill.damageMultiplier || 1.0,
      element: skill.element,
      hitType: skill.hitType || 'physical',
    });
    damageData.totalDamage = damage;
  }

  // 计算追击伤害
  if (skill.followUp) {
    const followUpDamage = calculateFinalDamage(
      character,
      {
        ...skill,
        damageMultiplier: skill.followUp.damage.multiplier,
        element: skill.followUp.damage.element,
      },
      enemy,
      buffs,
      options
    );
    damageData.followUpDamage = followUpDamage;
    damageData.totalDamage += followUpDamage;
  }

  return damageData;
}

/**
 * 计算排轴总伤害和DPS
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @returns {object} 排轴统计数据
 */
export function calculateTimelineDamage(project, gamedata) {
  if (!project || !project.actions || project.actions.length === 0) {
    return {
      totalDamage: 0,
      dps: 0,
      damageByCharacter: {},
      damageBySkillType: {},
    };
  }

  const stats = {
    totalDamage: 0,
    totalTime: project.duration / 60, // 转换为秒
    damageByCharacter: {},
    damageBySkillType: {},
  };

  // 初始化统计对象
  project.characters.forEach(charId => {
    const character = gamedata.characters.find(c => c.id === charId);
    if (character) {
      stats.damageByCharacter[character.name] = 0;
    }
  });

  // 计算每个技能动作的伤害
  project.actions.forEach(skillBlock => {
    // 跳过被禁用的技能
    if (skillBlock.isDisabled) {
      return;
    }

    const character = gamedata.characters.find(
      c => c.id === skillBlock.characterId
    );
    const skill = findSkillById(gamedata, skillBlock.skillId);
    const enemy = gamedata.enemies.find(e => e.id === project.enemy);

    if (character && skill && enemy) {
      // 应用技能倍率修正
      const modifiedSkill = {
        ...skill,
        damageMultiplier: Array.isArray(skill.damageMultiplier)
          ? skill.damageMultiplier.map(
              m => m * (skillBlock.damageMultiplier || 1)
            )
          : skill.damageMultiplier * (skillBlock.damageMultiplier || 1),
      };

      const damageData = calculateSkillDamage(character, modifiedSkill, enemy);
      const totalDamage = damageData.totalDamage;

      // 累加伤害
      stats.totalDamage += totalDamage;

      // 按角色统计
      if (stats.damageByCharacter[character.name] !== undefined) {
        stats.damageByCharacter[character.name] += totalDamage;
      }

      // 按技能类型统计
      const skillType = getSkillTypeName(skill.type);
      if (!stats.damageBySkillType[skillType]) {
        stats.damageBySkillType[skillType] = 0;
      }
      stats.damageBySkillType[skillType] += totalDamage;
    }
  });

  // 计算DPS
  stats.dps =
    stats.totalTime > 0 ? Math.round(stats.totalDamage / stats.totalTime) : 0;

  return stats;
}

/**
 * 根据技能ID查找技能
 * @param {object} gamedata 游戏数据
 * @param {string} skillId 技能ID
 * @returns {object|null} 技能数据
 */
function findSkillById(gamedata, skillId) {
  for (const character of gamedata.characters) {
    const skill = character.skills.find(s => s.id === skillId);
    if (skill) return skill;
  }
  return null;
}

/**
 * 获取技能类型名称
 * @param {string} type 技能类型
 * @returns {string} 技能类型名称
 */
function getSkillTypeName(type) {
  const typeMap = {
    normal: '普攻',
    charge: '重击',
    skill: '星鸣技',
    ultimate: '星决技',
    combo: '星携技',
  };
  return typeMap[type] || type;
}

/**
 * 计算技能冷却时间
 * @param {object} skill 技能数据
 * @param {object} buffs buffs 数据
 * @returns {number} 冷却时间（秒）
 */
export function calculateSkillCooldown(skill, buffs = {}) {
  const baseCooldown = skill.cooldown || 0;
  const cooldownReduction = buffs.cooldownReduction || 0;

  return baseCooldown * (1 - cooldownReduction);
}

/**
 * 计算技能能量消耗
 * @param {object} skill 技能数据
 * @param {object} buffs buffs 数据
 * @returns {number} 能量消耗
 */
export function calculateSkillEnergyCost(skill, buffs = {}) {
  const baseEnergyCost = skill.energyCost || 0;
  const energyCostReduction = buffs.energyCostReduction || 0;

  return baseEnergyCost * (1 - energyCostReduction);
}

/**
 * 计算技能能量获取
 * @param {object} skill 技能数据
 * @param {object} buffs buffs 数据
 * @returns {number} 能量获取
 */
export function calculateSkillEnergyGain(skill, buffs = {}) {
  const baseEnergyGain = skill.energyGain || 0;
  const energyGainBonus = buffs.energyGainBonus || 0;

  return baseEnergyGain * (1 + energyGainBonus);
}

/**
 * 计算排轴全周期伤害逐帧计算
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @param {number} frameRate 帧率，默认60
 * @returns {object} 逐帧伤害数据
 */
export function calculateFrameByFrameDamage(project, gamedata, frameRate = 60) {
  if (!project || !project.actions || project.actions.length === 0) {
    return {
      totalDamage: 0,
      frames: [],
      damageByFrame: [],
      damageByCharacter: {},
      damageBySkillType: {},
      damageByElement: {},
    };
  }

  // 初始化统计数据
  const stats = {
    totalDamage: 0,
    frames: [],
    damageByFrame: [],
    damageByCharacter: {},
    damageBySkillType: {},
    damageByElement: {},
  };

  // 初始化角色统计
  project.characters.forEach(charId => {
    const character = gamedata.characters.find(c => c.id === charId);
    if (character) {
      stats.damageByCharacter[character.name] = 0;
    }
  });

  // 准备技能动作，按时间排序
  const sortedSkillBlocks = [...project.actions].sort(
    (a, b) => a.startTime - b.startTime
  );

  // 初始化游戏状态
  const gameState = {
    currentFrame: 0,
    maxFrame: project.duration,
    skillBlocks: sortedSkillBlocks,
    nextSkillIndex: 0,
    characterStates: {},
    enemyState: {
      toughness:
        gamedata.enemies.find(e => e.id === project.enemy)?.toughness || 100,
      isBroken: false,
    },
    buffManager: new BuffManager(),
    imprints: {},
    dotEffects: [],
    resonanceEffects: calculateElementalResonance(
      project.characters
        .map(charId => gamedata.characters.find(c => c.id === charId))
        .filter(Boolean)
    ),
  };

  // 初始化角色状态
  project.characters.forEach(charId => {
    const character = gamedata.characters.find(c => c.id === charId);
    if (character) {
      gameState.characterStates[charId] = {
        energy: 0,
        cooldowns: {},
      };
    }
  });

  // 逐帧计算
  while (gameState.currentFrame <= gameState.maxFrame) {
    const frameData = {
      frame: gameState.currentFrame,
      time: gameState.currentFrame / frameRate,
      damage: 0,
      skillDamage: 0,
      dotDamage: 0,
      imprintDamage: 0,
      characterDamages: {},
      events: [],
    };

    // 处理技能释放
    while (
      gameState.nextSkillIndex < gameState.skillBlocks.length &&
      gameState.skillBlocks[gameState.nextSkillIndex].startTime ===
        gameState.currentFrame
    ) {
      const skillBlock = gameState.skillBlocks[gameState.nextSkillIndex];
      const character = gamedata.characters.find(
        c => c.id === skillBlock.characterId
      );
      const skill = findSkillById(gamedata, skillBlock.skillId);
      const enemy = gamedata.enemies.find(e => e.id === project.enemy);

      if (character && skill && enemy) {
        // 计算技能伤害
        const buffs = gameState.buffManager.getBuffEffects();
        const options = {
          isBroken: gameState.enemyState.isBroken,
          imprints: gameState.imprints,
          buffList: gameState.buffManager.buffs,
          resonanceEffects: gameState.resonanceEffects,
        };

        // 应用技能倍率修正
        const modifiedSkill = {
          ...skill,
          damageMultiplier: Array.isArray(skill.damageMultiplier)
            ? skill.damageMultiplier.map(
                m => m * (skillBlock.damageMultiplier || 1)
              )
            : skill.damageMultiplier * (skillBlock.damageMultiplier || 1),
        };

        const damageData = calculateSkillDamage(
          character,
          modifiedSkill,
          enemy,
          buffs,
          options
        );
        const skillDamage = damageData.totalDamage;

        // 记录伤害
        frameData.skillDamage = skillDamage;
        frameData.damage += skillDamage;
        stats.totalDamage += skillDamage;

        // 按角色统计
        if (stats.damageByCharacter[character.name] !== undefined) {
          stats.damageByCharacter[character.name] += skillDamage;
        }

        // 按技能类型统计
        const skillType = getSkillTypeName(skill.type);
        if (!stats.damageBySkillType[skillType]) {
          stats.damageBySkillType[skillType] = 0;
        }
        stats.damageBySkillType[skillType] += skillDamage;

        // 按元素统计
        const element = skill.element || 'physical';
        if (!stats.damageByElement[element]) {
          stats.damageByElement[element] = 0;
        }
        stats.damageByElement[element] += skillDamage;

        // 记录角色伤害
        if (!frameData.characterDamages[character.name]) {
          frameData.characterDamages[character.name] = 0;
        }
        frameData.characterDamages[character.name] += skillDamage;

        // 记录事件
        frameData.events.push({
          type: 'skill',
          character: character.name,
          skill: skill.name,
          damage: skillDamage,
        });

        // 更新印记状态
        gameState.imprints = updateImprints(gameState.imprints, skill);

        // 计算韧性值变化
        const toughnessChange = calculateToughnessChange(enemy, skill);
        gameState.enemyState.toughness -= toughnessChange;

        // 检查破防状态
        gameState.enemyState.isBroken = checkBreakState(
          enemy,
          gameState.enemyState.toughness
        );

        // 添加DOT效果
        if (skill.addDot) {
          gameState.dotEffects.push({
            ...skill.addDot,
            timeSinceLastTick: 0,
          });
        }

        // 添加Buff
        if (skill.addBuff) {
          gameState.buffManager.addBuff(skill.addBuff);
        }
        
        // 检查并添加条件Buff
        gameState.buffManager.checkAndAddConditionalBuffs(skill, options);
      }

      gameState.nextSkillIndex++;
    }

    // 处理DOT伤害
    let totalDotDamage = 0;
    gameState.dotEffects = gameState.dotEffects.map(dot => {
      if (shouldTriggerDotDamage(dot)) {
        const character = gamedata.characters.find(
          c => c.id === dot.characterId
        );
        const enemy = gamedata.enemies.find(e => e.id === project.enemy);
        if (character && enemy) {
          const buffs = gameState.buffManager.getBuffEffects();
          const dotDamage = calculateDotDamage(dot, character, enemy, buffs);
          totalDotDamage += dotDamage;

          // 记录伤害
          frameData.dotDamage += dotDamage;
          frameData.damage += dotDamage;
          stats.totalDamage += dotDamage;

          // 按角色统计
          if (stats.damageByCharacter[character.name] !== undefined) {
            stats.damageByCharacter[character.name] += dotDamage;
          }

          // 按元素统计
          const element = dot.element || 'physical';
          if (!stats.damageByElement[element]) {
            stats.damageByElement[element] = 0;
          }
          stats.damageByElement[element] += dotDamage;

          // 记录角色伤害
          if (!frameData.characterDamages[character.name]) {
            frameData.characterDamages[character.name] = 0;
          }
          frameData.characterDamages[character.name] += dotDamage;

          // 记录事件
          frameData.events.push({
            type: 'dot',
            character: character.name,
            dotType: dot.type,
            damage: dotDamage,
          });
        }
        return resetDotTickTime(dot);
      }
      return dot;
    });

    // 更新DOT效果
    gameState.dotEffects = updateDotEffects(
      gameState.dotEffects,
      1 / frameRate
    );

    // 更新Buff状态
    gameState.buffManager.update(1 / frameRate);

    // 记录帧数据
    if (frameData.damage > 0) {
      stats.frames.push(frameData);
      stats.damageByFrame.push({
        frame: gameState.currentFrame,
        time: gameState.currentFrame / frameRate,
        damage: frameData.damage,
      });
    }

    gameState.currentFrame++;
  }

  return stats;
}
