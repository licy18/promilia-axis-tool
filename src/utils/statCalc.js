// 统计指标计算引擎

/**
 * 计算总时长
 * @param {object} project 项目数据
 * @returns {number} 总时长（秒）
 */
export function calculateTotalTime(project) {
  if (!project || !project.duration) {
    return 0;
  }
  return project.duration / 60; // 转换为秒
}

/**
 * 计算总伤害
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @returns {number} 总伤害值
 */
export function calculateTotalDamage(project, gamedata) {
  if (!project || !project.skillBlocks || project.skillBlocks.length === 0) {
    return 0;
  }

  let totalDamage = 0;

  // 计算每个技能块的伤害
  project.skillBlocks.forEach(skillBlock => {
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
      totalDamage += damageData.totalDamage;
    }
  });

  return totalDamage;
}

/**
 * 计算平均DPS
 * @param {number} totalDamage 总伤害
 * @param {number} totalTime 总时长（秒）
 * @returns {number} 平均DPS
 */
export function calculateAverageDPS(totalDamage, totalTime) {
  return totalTime > 0 ? Math.round(totalDamage / totalTime) : 0;
}

/**
 * 计算爆发峰值DPS
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @param {number} windowSize 计算窗口大小（秒），默认3秒
 * @returns {number} 爆发峰值DPS
 */
export function calculatePeakDPS(project, gamedata, windowSize = 3) {
  if (!project || !project.skillBlocks || project.skillBlocks.length === 0) {
    return 0;
  }

  const frameRate = 60;
  const windowFrames = windowSize * frameRate;
  const sortedSkillBlocks = [...project.skillBlocks].sort(
    (a, b) => a.startFrame - b.startFrame
  );

  let peakDPS = 0;

  // 遍历每个可能的窗口
  for (
    let startFrame = 0;
    startFrame <= project.duration - windowFrames;
    startFrame++
  ) {
    const endFrame = startFrame + windowFrames;
    let windowDamage = 0;

    // 计算窗口内的伤害
    sortedSkillBlocks.forEach(skillBlock => {
      if (
        skillBlock.startFrame >= startFrame &&
        skillBlock.startFrame < endFrame
      ) {
        const character = gamedata.characters.find(
          c => c.id === skillBlock.characterId
        );
        const skill = findSkillById(gamedata, skillBlock.skillId);
        const enemy = gamedata.enemies.find(e => e.id === project.enemy);

        if (character && skill && enemy) {
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
            enemy
          );
          windowDamage += damageData.totalDamage;
        }
      }
    });

    const windowDPS = windowDamage / windowSize;
    if (windowDPS > peakDPS) {
      peakDPS = windowDPS;
    }
  }

  return Math.round(peakDPS);
}

/**
 * 计算总削韧值
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @returns {number} 总削韧值
 */
export function calculateTotalToughnessDamage(project, gamedata) {
  if (!project || !project.skillBlocks || project.skillBlocks.length === 0) {
    return 0;
  }

  let totalToughnessDamage = 0;

  // 计算每个技能的削韧值
  project.skillBlocks.forEach(skillBlock => {
    const skill = findSkillById(gamedata, skillBlock.skillId);
    const enemy = gamedata.enemies.find(e => e.id === project.enemy);

    if (skill && enemy) {
      // 应用技能倍率修正
      const modifiedSkill = {
        ...skill,
        toughnessDamage:
          (skill.toughnessDamage || 0) * (skillBlock.damageMultiplier || 1),
      };

      totalToughnessDamage += calculateToughnessChange(enemy, modifiedSkill);
    }
  });

  return totalToughnessDamage;
}

/**
 * 计算Buff覆盖率
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @param {string} buffId Buff ID
 * @returns {number} Buff覆盖率（0-1）
 */
export function calculateBuffUptime(project, gamedata, buffId) {
  if (!project || !project.duration) {
    return 0;
  }

  const totalFrames = project.duration;
  let buffActiveFrames = 0;

  // 模拟Buff管理
  const buffManager = new BuffManager();
  const sortedSkillBlocks = [...project.skillBlocks].sort(
    (a, b) => a.startFrame - b.startFrame
  );

  let currentFrame = 0;
  let nextSkillIndex = 0;

  // 逐帧模拟
  while (currentFrame <= totalFrames) {
    // 处理技能释放
    while (
      nextSkillIndex < sortedSkillBlocks.length &&
      sortedSkillBlocks[nextSkillIndex].startFrame === currentFrame
    ) {
      const skillBlock = sortedSkillBlocks[nextSkillIndex];
      const skill = findSkillById(gamedata, skillBlock.skillId);

      if (skill && skill.addBuff) {
        buffManager.addBuff(skill.addBuff);
      }

      nextSkillIndex++;
    }

    // 检查Buff是否激活
    if (buffManager.hasBuff(buffId)) {
      buffActiveFrames++;
    }

    // 更新Buff状态
    buffManager.update(1 / 60); // 假设60帧率
    currentFrame++;
  }

  return totalFrames > 0 ? buffActiveFrames / totalFrames : 0;
}

/**
 * 计算CD利用率
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @param {string} characterId 角色ID
 * @returns {number} CD利用率（0-1）
 */
export function calculateCooldownUtilization(project, gamedata, characterId) {
  if (!project || !project.duration) {
    return 0;
  }

  const totalFrames = project.duration;
  const character = gamedata.characters.find(c => c.id === characterId);
  if (!character || !character.skills) {
    return 0;
  }

  // 记录每个技能的冷却时间
  const skillCooldowns = {};
  character.skills.forEach(skill => {
    skillCooldowns[skill.id] = 0;
  });

  let totalCooldownTime = 0;
  let totalSkillUses = 0;

  const sortedSkillBlocks = [...project.skillBlocks]
    .filter(block => block.characterId === characterId)
    .sort((a, b) => a.startFrame - b.startFrame);

  // 计算技能使用情况
  sortedSkillBlocks.forEach((skillBlock, index) => {
    const skill = findSkillById(gamedata, skillBlock.skillId);
    if (skill && skill.cooldown) {
      totalSkillUses++;
      totalCooldownTime += skill.cooldown;
    }
  });

  // CD利用率 = 总冷却时间 / 总时长
  return totalFrames > 0 ? (totalCooldownTime * 60) / totalFrames : 0;
}

/**
 * 计算资源溢出率
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @param {string} characterId 角色ID
 * @returns {number} 资源溢出率（0-1）
 */
export function calculateResourceOverflow(project, gamedata, characterId) {
  if (!project || !project.duration) {
    return 0;
  }

  const character = gamedata.characters.find(c => c.id === characterId);
  if (!character) {
    return 0;
  }

  const maxEnergy = character.maxEnergy || 100;
  let currentEnergy = 0;
  let energyOverflow = 0;

  const sortedSkillBlocks = [...project.skillBlocks]
    .filter(block => block.characterId === characterId)
    .sort((a, b) => a.startFrame - b.startFrame);

  // 模拟能量获取和消耗
  sortedSkillBlocks.forEach((skillBlock, index) => {
    const skill = findSkillById(gamedata, skillBlock.skillId);
    if (skill) {
      // 计算能量获取
      const energyGain = skill.energyGain || 0;
      currentEnergy += energyGain;

      // 检查溢出
      if (currentEnergy > maxEnergy) {
        energyOverflow += currentEnergy - maxEnergy;
        currentEnergy = maxEnergy;
      }

      // 计算能量消耗
      if (skill.energyCost) {
        currentEnergy -= skill.energyCost;
        if (currentEnergy < 0) currentEnergy = 0;
      }
    }
  });

  // 计算总能量获取
  let totalEnergyGain = 0;
  sortedSkillBlocks.forEach(skillBlock => {
    const skill = findSkillById(gamedata, skillBlock.skillId);
    if (skill) {
      totalEnergyGain += skill.energyGain || 0;
    }
  });

  return totalEnergyGain > 0 ? energyOverflow / totalEnergyGain : 0;
}

/**
 * 计算所有统计指标
 * @param {object} project 项目数据
 * @param {object} gamedata 游戏数据
 * @returns {object} 统计指标汇总
 */
export function calculateAllStats(project, gamedata) {
  const totalTime = calculateTotalTime(project);
  const totalDamage = calculateTotalDamage(project, gamedata);
  const averageDPS = calculateAverageDPS(totalDamage, totalTime);
  const peakDPS = calculatePeakDPS(project, gamedata);
  const totalToughnessDamage = calculateTotalToughnessDamage(project, gamedata);

  // 计算每个角色的统计指标
  const characterStats = {};
  project.characters.forEach(charId => {
    const character = gamedata.characters.find(c => c.id === charId);
    if (character) {
      characterStats[character.name] = {
        cooldownUtilization: calculateCooldownUtilization(
          project,
          gamedata,
          charId
        ),
        resourceOverflow: calculateResourceOverflow(project, gamedata, charId),
      };
    }
  });

  // 计算主要Buff的覆盖率
  const buffUptimes = {};
  const commonBuffs = ['attack_buff', 'damage_buff', 'critical_buff'];
  commonBuffs.forEach(buffId => {
    buffUptimes[buffId] = calculateBuffUptime(project, gamedata, buffId);
  });

  return {
    totalTime,
    totalDamage,
    averageDPS,
    peakDPS,
    totalToughnessDamage,
    characterStats,
    buffUptimes,
  };
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
  };

  if (Array.isArray(skill.damageMultiplier)) {
    // 多段伤害
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
    });
    damageData.totalDamage = damage;
  }

  return damageData;
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

  // 最终伤害 = 基础伤害 × 增伤倍数 × 暴击倍数 × 抗性减免倍数 × 破防加成
  const finalDamage =
    baseDamage * damageBonus * criticalBonus * resistanceBonus * breakBonus;

  return Math.round(finalDamage);
}

/**
 * 计算基础伤害
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} options 计算选项
 * @returns {number} 基础伤害值
 */
export function calculateBaseDamage(character, skill, options = {}) {
  // 基础倍率区：技能倍率 × 角色基础攻击力
  const baseAttack = character.stats?.attack || 1000;
  const skillMultiplier = getSkillMultiplier(skill);

  // 攻击力区：基础攻击力 × (1 + 百分比攻击力加成) + 固定攻击力加成
  const attackPercentBonus = character.stats?.attackPercentBonus || 0;
  const attackFlatBonus = character.stats?.attackFlatBonus || 0;
  const finalAttack = baseAttack * (1 + attackPercentBonus) + attackFlatBonus;

  // 基础伤害 = 最终攻击力 × 技能倍率
  let baseDamage = finalAttack * skillMultiplier;

  return baseDamage;
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
 * 计算增伤区
 * @param {object} character 角色数据
 * @param {object} skill 技能数据
 * @param {object} buffs buffs 数据
 * @returns {number} 增伤倍数
 */
export function calculateDamageBonus(character, skill, buffs = {}) {
  // 增伤区：1 + 元素增伤 + 技能增伤 + 全伤害增伤
  const element = skill.element || 'physical';
  const elementalBonus = character.stats?.elementalBonuses?.[element] || 0;
  const skillBonus = buffs.skillBonus || 0;
  const allDamageBonus = buffs.allDamageBonus || 0;

  return 1 + elementalBonus + skillBonus + allDamageBonus;
}

/**
 * 计算暴击区
 * @param {object} character 角色数据
 * @param {object} options 计算选项
 * @returns {number} 暴击倍数
 */
export function calculateCriticalBonus(character, options = {}) {
  const criticalRate = character.stats?.criticalRate || 0.05;
  const criticalDamage = character.stats?.criticalDamage || 0.5;
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
 * 计算破防状态的伤害加成
 * @param {boolean} isBroken 是否破防
 * @returns {number} 伤害加成倍数
 */
export function calculateBreakBonus(isBroken) {
  return isBroken ? 1.5 : 1; // 破防状态下伤害增加50%
}
