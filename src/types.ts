// 技能类型定义
export type ActionType =
  | "execution" // 处决
  | "skill" // 技能
  | "link" // 连携
  | "ultimate" // 终结技
  | "attack"; // 重击

// 伤害 tick 结构
export interface DamageTick {
  offset: number;
  sp: number;
  stagger: number;
  boundEffects?: string[];
}

// 异常状态结构
export interface Anomaly {
  _id: string;
  offset: number;
  duration: number;
  type: string;
  sp?: number;
  stagger?: number;
  stacks: number | string; // numeric string
}

// 技能动作结构
export interface Action {
  id: string;
  instanceId: string;
  type: ActionType;
  name: string;
  startTime: number;
  logicalStartTime: number;
  cooldown: number;
  spCost: number;
  spGain?: number;
  element: string;
  librarySource?: string;
  icon?: string;
  gaugeCost: number;
  gaugeGain: number;
  teamGaugeGain: number;
  enhancementTime?: number;
  duration: number;
  triggerWindow?: number;
  animationTime?: number;
  isDisabled?: boolean;
  weaponId?: string | null;
  sourceWeaponId?: string | null;
  allowedTypes: string[];
  damageTicks: DamageTick[];
  physicalAnomaly: Anomaly[][];
  isLocked?: boolean;
  customBars?: any[];
  customColor?: string | null;
}
