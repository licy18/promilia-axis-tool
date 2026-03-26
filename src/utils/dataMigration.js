/**
 * 数据迁移工具
 * 用于将旧版本的技能数据结构转换为新版本
 */

/**
 * 迁移技能数据结构
 * @param {Object} skill - 旧版本技能数据
 * @returns {Object} 迁移后的技能数据
 */
export function migrateSkillData(skill) {
  // 复制原始数据
  const migratedSkill = { ...skill };
  
  // 1. 迁移伤害判定帧
  if (!migratedSkill.damageTicks && migratedSkill.judgmentPoints) {
    // 将旧的judgmentPoints转换为新的damageTicks
    migratedSkill.damageTicks = migratedSkill.judgmentPoints.map(point => ({
      offset: point.time,
      multiplier: point.multiplier,
      element: point.element,
      hitType: point.hitType,
      description: point.description
    }));
    // 保留旧字段以确保兼容性
  }
  
  // 2. 迁移buff数据
  if (!migratedSkill.buffs && migratedSkill.buff) {
    // 将旧的单个buff转换为新的buffs数组
    migratedSkill.buffs = [{
      name: migratedSkill.buff.name,
      type: migratedSkill.buff.type,
      value: migratedSkill.buff.value,
      duration: migratedSkill.buff.duration,
      trigger: 'onCast',
      target: 'self'
    }];
    // 保留旧字段以确保兼容性
  }
  
  // 3. 迁移debuff数据
  if (!migratedSkill.debuffs && migratedSkill.debuff) {
    // 将旧的单个debuff转换为新的debuffs数组
    migratedSkill.debuffs = [{
      name: migratedSkill.debuff.name,
      type: migratedSkill.debuff.type,
      value: migratedSkill.debuff.value,
      duration: migratedSkill.debuff.duration,
      trigger: 'onHit',
      target: 'enemy'
    }];
    // 保留旧字段以确保兼容性
  }
  
  // 4. 为没有damageTicks的技能添加默认值
  if (!migratedSkill.damageTicks) {
    // 根据技能类型和伤害乘数生成默认的伤害判定帧
    if (Array.isArray(migratedSkill.damageMultiplier)) {
      // 对于多段伤害的技能
      migratedSkill.damageTicks = migratedSkill.damageMultiplier.map((multiplier, index) => ({
        offset: Math.round((migratedSkill.frames?.end || 60) * (index + 1) / migratedSkill.damageMultiplier.length),
        multiplier,
        element: migratedSkill.element || 'physical',
        hitType: migratedSkill.type || 'normal'
      }));
    } else if (migratedSkill.damageMultiplier) {
      // 对于单段伤害的技能
      migratedSkill.damageTicks = [{
        offset: Math.round((migratedSkill.frames?.end || 60) / 2),
        multiplier: migratedSkill.damageMultiplier,
        element: migratedSkill.element || 'physical',
        hitType: migratedSkill.type || 'normal'
      }];
    }
  }
  
  return migratedSkill;
}

/**
 * 迁移角色数据结构
 * @param {Object} character - 旧版本角色数据
 * @returns {Object} 迁移后的角色数据
 */
export function migrateCharacterData(character) {
  // 复制原始数据
  const migratedCharacter = { ...character };
  
  // 迁移每个技能
  if (migratedCharacter.skills) {
    migratedCharacter.skills = migratedCharacter.skills.map(skill => migrateSkillData(skill));
  }
  
  return migratedCharacter;
}

/**
 * 迁移整个游戏数据结构
 * @param {Object} gameData - 旧版本游戏数据
 * @returns {Object} 迁移后的游戏数据
 */
export function migrateGameData(gameData) {
  // 复制原始数据
  const migratedGameData = { ...gameData };
  
  // 更新版本号
  migratedGameData.version = '1.1.0';
  migratedGameData.updateTime = new Date().toISOString().split('T')[0];
  
  // 迁移每个角色
  if (migratedGameData.characters) {
    migratedGameData.characters = migratedGameData.characters.map(character => 
      migrateCharacterData(character)
    );
  }
  
  return migratedGameData;
}

/**
 * 检查数据是否需要迁移
 * @param {Object} gameData - 游戏数据
 * @returns {boolean} 是否需要迁移
 */
export function needsMigration(gameData) {
  const currentVersion = gameData.version || '1.0.0';
  const requiredVersion = '1.1.0';
  
  // 比较版本号
  const currentParts = currentVersion.split('.').map(Number);
  const requiredParts = requiredVersion.split('.').map(Number);
  
  for (let i = 0; i < requiredParts.length; i++) {
    if (currentParts[i] < requiredParts[i]) {
      return true;
    } else if (currentParts[i] > requiredParts[i]) {
      return false;
    }
  }
  
  return false;
}

/**
 * 执行数据迁移
 * @param {Object} gameData - 原始游戏数据
 * @returns {Object} 迁移后的游戏数据
 */
export function executeMigration(gameData) {
  if (needsMigration(gameData)) {
    console.log('执行数据迁移...');
    const migratedData = migrateGameData(gameData);
    console.log('数据迁移完成');
    return migratedData;
  }
  return gameData;
}
