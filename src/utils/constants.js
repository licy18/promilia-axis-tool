/**
 * 项目常量定义
 * 包含时间轴配置、伤害计算配置、资源配置等
 */

// 时间轴配置
export const TIMELINE_CONFIG = {
  // 时间轴刻度间隔（秒）
  INTERVAL: 1,
  // 时间轴默认长度（秒）
  DEFAULT_DURATION: 60,
  // 时间轴最大长度（秒）
  MAX_DURATION: 300,
  // 时间轴最小长度（秒）
  MIN_DURATION: 10,
  // 时间轴缩放比例
  ZOOM_LEVELS: [0.5, 1, 2, 5],
  // 默认缩放级别索引
  DEFAULT_ZOOM_INDEX: 1,
};

// 伤害计算配置
export const DAMAGE_CALC_CONFIG = {
  // 伤害类型
  DAMAGE_TYPES: {
    PHYSICAL: 'physical',
    MAGICAL: 'magical',
    TRUE: 'true',
  },
  // 伤害公式系数
  FORMULA_COEFFICIENTS: {
    // 物理伤害系数
    PHYSICAL: 1.0,
    // 魔法伤害系数
    MAGICAL: 1.0,
    // 真实伤害系数
    TRUE: 1.0,
  },
  // 暴击倍数
  CRIT_MULTIPLIER: 1.5,
  // 暴击率上限
  CRIT_RATE_CAP: 1.0,
  // 伤害减免上限
  DAMAGE_REDUCTION_CAP: 0.9,
};

// 资源配置
export const RESOURCE_CONFIG = {
  // 资源类型
  RESOURCE_TYPES: {
    HP: 'hp',
    MP: 'mp',
    STAMINA: 'stamina',
    ENERGY: 'energy',
  },
  // 资源恢复速率（每秒）
  REGEN_RATES: {
    HP: 0.5,
    MP: 1.0,
    STAMINA: 0.2,
    ENERGY: 0.1,
  },
  // 初始资源值
  INITIAL_VALUES: {
    HP: 1000,
    MP: 500,
    STAMINA: 100,
    ENERGY: 200,
  },
};

// 技能配置
export const SKILL_CONFIG = {
  // 技能类型
  SKILL_TYPES: {
    NORMAL: 'normal',
    SKILL: 'skill',
    ULTIMATE: 'ultimate',
    PASSIVE: 'passive',
  },
  // 技能冷却时间单位（秒）
  COOLDOWN_UNIT: 1,
  // 最大技能等级
  MAX_SKILL_LEVEL: 10,
};

// 敌人配置
export const ENEMY_CONFIG = {
  // 敌人类型
  ENEMY_TYPES: {
    NORMAL: 'normal',
    ELITE: 'elite',
    BOSS: 'boss',
  },
  // 敌人弱点
  WEAKNESSES: {
    FIRE: 'fire',
    ICE: 'ice',
    LIGHTNING: 'lightning',
    POISON: 'poison',
    HOLY: 'holy',
    SHADOW: 'shadow',
  },
  // 敌人抗性
  RESISTANCES: {
    PHYSICAL: 'physical',
    MAGICAL: 'magical',
    FIRE: 'fire',
    ICE: 'ice',
    LIGHTNING: 'lightning',
  },
};

// 界面配置
export const UI_CONFIG = {
  // 主题颜色
  THEME_COLORS: {
    PRIMARY: '#4CAF50',
    SECONDARY: '#2196F3',
    ACCENT: '#FF9800',
    ERROR: '#F44336',
    WARNING: '#FFC107',
    INFO: '#00BCD4',
    SUCCESS: '#4CAF50',
  },
  // 动画持续时间（毫秒）
  ANIMATION_DURATION: {
    SHORT: 200,
    MEDIUM: 300,
    LONG: 500,
  },
  // 响应式断点
  BREAKPOINTS: {
    SMALL: 600,
    MEDIUM: 960,
    LARGE: 1280,
    XLARGE: 1920,
  },
};

// 存储配置
export const STORAGE_CONFIG = {
  // 本地存储键名
  STORAGE_KEYS: {
    SETTINGS: 'promilia_axis_tool_settings',
    SAVED_BUILDS: 'promilia_axis_tool_saved_builds',
    RECENT_TIMELINES: 'promilia_axis_tool_recent_timelines',
  },
  // 存储版本
  STORAGE_VERSION: '1.0.0',
  // 最大存储条目数
  MAX_STORAGE_ITEMS: 50,
};

// 网络配置
export const NETWORK_CONFIG = {
  // API 基础 URL
  API_BASE_URL: '/api',
  // 请求超时时间（毫秒）
  REQUEST_TIMEOUT: 10000,
  // 重试次数
  RETRY_COUNT: 3,
  // 重试间隔（毫秒）
  RETRY_INTERVAL: 1000,
};

// 导出默认值
export default {
  TIMELINE_CONFIG,
  DAMAGE_CALC_CONFIG,
  RESOURCE_CONFIG,
  SKILL_CONFIG,
  ENEMY_CONFIG,
  UI_CONFIG,
  STORAGE_CONFIG,
  NETWORK_CONFIG,
};
