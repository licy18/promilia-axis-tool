// 时间轴校验工具函数

/**
 * 校验时间轴循环合法性
 * @param {Object} project 项目数据
 * @param {Object} gamedata 游戏数据
 * @returns {Object} 校验结果
 */
export function validateTimeline(project, gamedata) {
  if (!project || !project.skillBlocks || !Array.isArray(project.skillBlocks)) {
    return {
      valid: true,
      errors: [],
    };
  }

  const errors = [];

  // 按角色分组技能块
  const skillBlocksByCharacter = {};
  project.skillBlocks.forEach(block => {
    if (!skillBlocksByCharacter[block.characterId]) {
      skillBlocksByCharacter[block.characterId] = [];
    }
    skillBlocksByCharacter[block.characterId].push(block);
  });

  // 校验每个角色的技能块
  Object.entries(skillBlocksByCharacter).forEach(([characterId, blocks]) => {
    // 排序技能块
    blocks.sort((a, b) => a.startFrame - b.startFrame);

    // 校验CD冲突
    const cdErrors = validateCDConflicts(blocks, characterId, gamedata);
    errors.push(...cdErrors);

    // 校验动作合法性
    const actionErrors = validateActionLegality(blocks, characterId, gamedata);
    errors.push(...actionErrors);
  });

  // 校验资源合法性
  const resourceErrors = validateResourceLegality(project, gamedata);
  errors.push(...resourceErrors);

  // 校验技能依赖
  const dependencyErrors = validateSkillDependencies(project, gamedata);
  errors.push(...dependencyErrors);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 校验CD冲突
 * @param {Array} blocks 技能块数组
 * @param {string} characterId 角色ID
 * @param {Object} gamedata 游戏数据
 * @returns {Array} 错误数组
 */
function validateCDConflicts(blocks, characterId, gamedata) {
  const errors = [];

  for (let i = 0; i < blocks.length; i++) {
    const currentBlock = blocks[i];

    for (let j = i + 1; j < blocks.length; j++) {
      const nextBlock = blocks[j];

      // 检查是否有时间重叠
      if (currentBlock.endFrame > nextBlock.startFrame) {
        errors.push({
          type: 'cd_conflict',
          severity: 'error',
          message: `角色 ${getCharacterName(characterId, gamedata)} 的技能 ${currentBlock.skillName} 和 ${nextBlock.skillName} 存在时间重叠`,
          characterId,
          skillBlocks: [currentBlock.id, nextBlock.id],
          startTime: nextBlock.startFrame,
          endTime: currentBlock.endFrame,
        });
      }

      // 检查CD是否足够
      const cdTime = getSkillCD(currentBlock.skillId, gamedata);
      if (cdTime && nextBlock.startFrame - currentBlock.startFrame < cdTime) {
        errors.push({
          type: 'cd_conflict',
          severity: 'error',
          message: `角色 ${getCharacterName(characterId, gamedata)} 的技能 ${currentBlock.skillName} CD不足`,
          characterId,
          skillBlock: currentBlock.id,
          startTime: currentBlock.startFrame,
          requiredCD: cdTime,
          actualCD: nextBlock.startFrame - currentBlock.startFrame,
        });
      }
    }
  }

  return errors;
}

/**
 * 校验资源合法性
 * @param {Object} project 项目数据
 * @param {Object} gamedata 游戏数据
 * @returns {Array} 错误数组
 */
function validateResourceLegality(project, gamedata) {
  const errors = [];

  // 按角色分组技能块
  const skillBlocksByCharacter = {};
  project.skillBlocks.forEach(block => {
    if (!skillBlocksByCharacter[block.characterId]) {
      skillBlocksByCharacter[block.characterId] = [];
    }
    skillBlocksByCharacter[block.characterId].push(block);
  });

  // 校验每个角色的资源合法性
  Object.entries(skillBlocksByCharacter).forEach(([characterId, blocks]) => {
    // 排序技能块
    blocks.sort((a, b) => a.startFrame - b.startFrame);

    // 初始化角色资源状态
    const resourceState = {
      energy: 0,
      imprints: {},
      cooldowns: {},
    };

    blocks.forEach(block => {
      const character = getCharacterById(characterId, gamedata);
      const skill = getSkillById(block.skillId, gamedata);

      if (!character) {
        errors.push({
          type: 'resource_error',
          severity: 'error',
          message: `角色ID ${characterId} 不存在`,
          characterId,
          skillBlock: block.id,
        });
        return;
      }

      if (!skill) {
        errors.push({
          type: 'resource_error',
          severity: 'error',
          message: `技能ID ${block.skillId} 不存在`,
          skillBlock: block.id,
        });
        return;
      }

      // 检查技能能量消耗
      if (skill.energyCost && skill.energyCost > 0) {
        if (resourceState.energy < skill.energyCost) {
          errors.push({
            type: 'resource_error',
            severity: 'error',
            message: `角色 ${character.name} 的技能 ${skill.name} 能量不足`,
            characterId,
            skillBlock: block.id,
            requiredEnergy: skill.energyCost,
            currentEnergy: resourceState.energy,
            startTime: block.startFrame,
          });
        }
        // 消耗能量
        resourceState.energy -= skill.energyCost;
      }

      // 检查技能CD
      if (skill.cooldown) {
        if (
          resourceState.cooldowns[skill.id] &&
          resourceState.cooldowns[skill.id] > block.startFrame
        ) {
          errors.push({
            type: 'cd_conflict',
            severity: 'error',
            message: `角色 ${character.name} 的技能 ${skill.name} CD未冷却`,
            characterId,
            skillBlock: block.id,
            startTime: block.startFrame,
            cdEndTime: resourceState.cooldowns[skill.id],
          });
        }
        // 更新CD
        resourceState.cooldowns[skill.id] = block.startFrame + skill.cooldown;
      }

      // 检查印记消耗
      if (skill.consumeImprint) {
        const { type, stack } = skill.consumeImprint;
        const currentStack = resourceState.imprints[type] || 0;
        if (currentStack < stack) {
          errors.push({
            type: 'resource_error',
            severity: 'error',
            message: `角色 ${character.name} 的技能 ${skill.name} 印记不足`,
            characterId,
            skillBlock: block.id,
            requiredImprint: `${type} × ${stack}`,
            currentImprint: `${type} × ${currentStack}`,
            startTime: block.startFrame,
          });
        }
        // 消耗印记
        resourceState.imprints[type] = Math.max(0, currentStack - stack);
      }

      // 增加技能能量获取
      if (skill.energyGain) {
        resourceState.energy += skill.energyGain;
      }

      // 增加印记
      if (skill.addImprint) {
        const { type, stack } = skill.addImprint;
        resourceState.imprints[type] =
          (resourceState.imprints[type] || 0) + stack;
      }
    });
  });

  return errors;
}

/**
 * 校验技能依赖
 * @param {Object} project 项目数据
 * @param {Object} gamedata 游戏数据
 * @returns {Array} 错误数组
 */
function validateSkillDependencies(project, gamedata) {
  const errors = [];

  project.skillBlocks.forEach(block => {
    const skill = getSkillById(block.skillId, gamedata);

    if (skill && skill.dependencies && skill.dependencies.length > 0) {
      const dependenciesMet = skill.dependencies.every(dep => {
        return project.skillBlocks.some(otherBlock => {
          return (
            otherBlock.skillId === dep &&
            otherBlock.endFrame <= block.startFrame
          );
        });
      });

      if (!dependenciesMet) {
        errors.push({
          type: 'dependency_error',
          severity: 'error',
          message: `技能 ${skill.name} 的前置依赖未满足`,
          skillBlock: block.id,
          dependencies: skill.dependencies,
        });
      }
    }
  });

  return errors;
}

/**
 * 校验动作合法性
 * @param {Array} blocks 技能块数组
 * @param {string} characterId 角色ID
 * @param {Object} gamedata 游戏数据
 * @returns {Array} 错误数组
 */
function validateActionLegality(blocks, characterId, gamedata) {
  const errors = [];

  blocks.forEach(block => {
    const skill = getSkillById(block.skillId, gamedata);

    if (skill) {
      // 检查技能持续时间是否合理
      const expectedDuration = skill.frames?.end || 0;
      const actualDuration = block.endFrame - block.startFrame;

      if (
        expectedDuration > 0 &&
        Math.abs(actualDuration - expectedDuration) > 5
      ) {
        errors.push({
          type: 'action_error',
          severity: 'warning',
          message: `技能 ${skill.name} 持续时间与预期不符`,
          skillBlock: block.id,
          expectedDuration,
          actualDuration,
        });
      }

      // 检查技能是否在角色的技能列表中
      const character = getCharacterById(characterId, gamedata);
      if (character && !character.skills.some(s => s.id === block.skillId)) {
        errors.push({
          type: 'action_error',
          severity: 'error',
          message: `角色 ${character.name} 不拥有技能 ${skill.name}`,
          characterId,
          skillBlock: block.id,
        });
      }
    }
  });

  return errors;
}

/**
 * 获取角色名称
 * @param {string} characterId 角色ID
 * @param {Object} gamedata 游戏数据
 * @returns {string} 角色名称
 */
function getCharacterName(characterId, gamedata) {
  const character = getCharacterById(characterId, gamedata);
  return character ? character.name : `ID: ${characterId}`;
}

/**
 * 根据ID获取角色
 * @param {string} characterId 角色ID
 * @param {Object} gamedata 游戏数据
 * @returns {Object|null} 角色对象
 */
function getCharacterById(characterId, gamedata) {
  return gamedata?.characters?.find(c => c.id === characterId) || null;
}

/**
 * 根据ID获取技能
 * @param {string} skillId 技能ID
 * @param {Object} gamedata 游戏数据
 * @returns {Object|null} 技能对象
 */
function getSkillById(skillId, gamedata) {
  if (!gamedata?.characters) return null;

  for (const character of gamedata.characters) {
    const skill = character.skills?.find(s => s.id === skillId);
    if (skill) return skill;
  }

  return null;
}

/**
 * 获取技能CD
 * @param {string} skillId 技能ID
 * @param {Object} gamedata 游戏数据
 * @returns {number|null} CD时间（帧）
 */
function getSkillCD(skillId, gamedata) {
  const skill = getSkillById(skillId, gamedata);
  return skill?.cooldown || null;
}

/**
 * 生成校验报告
 * @param {Object} validationResult 校验结果
 * @returns {string} 校验报告
 */
export function generateValidationReport(validationResult) {
  if (validationResult.valid) {
    return '✅ 时间轴校验通过，未发现任何问题';
  }

  let report = `❌ 时间轴校验失败，发现 ${validationResult.errors.length} 个问题：\n\n`;

  const errorGroups = {
    cd_conflict: 'CD冲突',
    resource_error: '资源错误',
    resource_warning: '资源警告',
    dependency_error: '依赖错误',
    action_error: '动作错误',
  };

  Object.entries(errorGroups).forEach(([type, title]) => {
    const errorsOfType = validationResult.errors.filter(e => e.type === type);
    if (errorsOfType.length > 0) {
      report += `## ${title} (${errorsOfType.length})\n`;
      errorsOfType.forEach((error, index) => {
        report += `${index + 1}. ${error.message}\n`;
        if (error.startTime) {
          report += `   时间：${formatFramesToTime(error.startTime)} - ${formatFramesToTime(error.endTime || error.startTime)}\n`;
        }
      });
      report += '\n';
    }
  });

  return report;
}

/**
 * 将帧转换为时间格式
 * @param {number} frames 帧数
 * @returns {string} 时间字符串
 */
function formatFramesToTime(frames) {
  const seconds = Math.floor(frames / 60);
  const remainingFrames = frames % 60;
  return `${seconds}.${remainingFrames.toString().padStart(2, '0')}s`;
}

// 基础校验函数（保留）

/**
 * 校验邮箱格式
 * @param {string} email 邮箱地址
 * @returns {boolean} 是否有效
 */
export function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * 校验手机号格式
 * @param {string} phone 手机号
 * @returns {boolean} 是否有效
 */
export function validatePhone(phone) {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 校验密码强度
 * @param {string} password 密码
 * @returns {object} 密码强度信息
 */
export function validatePassword(password) {
  const strength = {
    score: 0,
    message: '',
    valid: false,
  };

  if (password.length < 6) {
    strength.message = '密码长度至少6位';
    return strength;
  }

  if (password.length >= 8) {
    strength.score += 1;
  }

  if (/[A-Z]/.test(password)) {
    strength.score += 1;
  }

  if (/[a-z]/.test(password)) {
    strength.score += 1;
  }

  if (/\d/.test(password)) {
    strength.score += 1;
  }

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    strength.score += 1;
  }

  if (strength.score >= 4) {
    strength.message = '密码强度强';
    strength.valid = true;
  } else if (strength.score >= 3) {
    strength.message = '密码强度中等';
    strength.valid = true;
  } else {
    strength.message = '密码强度弱';
    strength.valid = false;
  }

  return strength;
}

/**
 * 校验URL格式
 * @param {string} url URL地址
 * @returns {boolean} 是否有效
 */
export function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验身份证号格式
 * @param {string} idCard 身份证号
 * @returns {boolean} 是否有效
 */
export function validateIdCard(idCard) {
  const idCardRegex =
    /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
  return idCardRegex.test(idCard);
}

/**
 * 验证日期格式
 * @param {string} date 日期字符串
 * @returns {boolean} 是否有效
 */
export function validateDate(date) {
  try {
    const dateObj = new Date(date);
    return dateObj instanceof Date && !isNaN(dateObj);
  } catch {
    return false;
  }
}

/**
 * 校验数字范围
 * @param {number} value 数值
 * @param {number} min 最小值
 * @param {number} max 最大值
 * @returns {boolean} 是否在范围内
 */
export function validateNumberRange(value, min, max) {
  return typeof value === 'number' && value >= min && value <= max;
}

/**
 * 校验字符串长度
 * @param {string} value 字符串
 * @param {number} min 最小长度
 * @param {number} max 最大长度
 * @returns {boolean} 是否在范围内
 */
export function validateStringLength(value, min, max) {
  return (
    typeof value === 'string' && value.length >= min && value.length <= max
  );
}

/**
 * 校验是否为整数
 * @param {number} value 数值
 * @returns {boolean} 是否为整数
 */
export function validateInteger(value) {
  return Number.isInteger(value);
}

/**
 * 校验是否为正整数
 * @param {number} value 数值
 * @returns {boolean} 是否为正整数
 */
export function validatePositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

/**
 * 校验是否为非负整数
 * @param {number} value 数值
 * @returns {boolean} 是否为非负整数
 */
export function validateNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

/**
 * 校验是否为浮点数
 * @param {number} value 数值
 * @returns {boolean} 是否为浮点数
 */
export function validateFloat(value) {
  return typeof value === 'number' && !Number.isInteger(value);
}

/**
 * 校验是否为正数
 * @param {number} value 数值
 * @returns {boolean} 是否为正数
 */
export function validatePositiveNumber(value) {
  return typeof value === 'number' && value > 0;
}

/**
 * 校验是否为非负数
 * @param {number} value 数值
 * @returns {boolean} 是否为非负数
 */
export function validateNonNegativeNumber(value) {
  return typeof value === 'number' && value >= 0;
}

/**
 * 校验是否为有效的JSON字符串
 * @param {string} json JSON字符串
 * @returns {boolean} 是否有效
 */
export function validateJson(json) {
  try {
    JSON.parse(json);
    return true;
  } catch {
    return false;
  }
}

/**
 * 校验是否为有效的数组
 * @param {any} value 要校验的值
 * @param {number} minLength 最小长度
 * @returns {boolean} 是否有效
 */
export function validateArray(value, minLength = 0) {
  return Array.isArray(value) && value.length >= minLength;
}

/**
 * 校验是否为有效的对象
 * @param {any} value 要校验的值
 * @returns {boolean} 是否有效
 */
export function validateObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
