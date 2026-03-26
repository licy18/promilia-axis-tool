import { describe, it, expect } from 'vitest';
import {
  migrateSkillData,
  migrateCharacterData,
  migrateGameData,
  needsMigration,
  executeMigration
} from '@/utils/dataMigration';

// 测试数据
const mockOldSkill = {
  id: 'skill_test_1',
  name: '测试技能',
  type: 'skill',
  element: 'fire',
  damageMultiplier: 2.5,
  cooldown: 10,
  energyCost: 0,
  animationTime: 1.5,
  frames: {
    start: 0,
    end: 90,
    recovery: 20
  },
  energyGain: 8,
  snapshot: 'start',
  buff: {
    name: '测试 buff',
    type: 'attack',
    value: 0.2,
    duration: 10
  },
  judgmentPoints: [
    {
      time: 45,
      multiplier: 2.5,
      element: 'fire',
      hitType: 'skill',
      description: '测试伤害'
    }
  ]
};

const mockOldCharacter = {
  id: 'character_test',
  name: '测试角色',
  element: 'fire',
  weapon: 'sword',
  rarity: 5,
  position: '主C',
  stats: {
    attack: 1000,
    defense: 500,
    hp: 10000
  },
  skills: [mockOldSkill]
};

const mockOldGameData = {
  version: '1.0.0',
  gameVersion: '最新适配游戏版本',
  updateTime: '2026-03-25',
  characters: [mockOldCharacter]
};

describe('数据迁移工具测试', () => {
  describe('migrateSkillData', () => {
    it('应该将旧的judgmentPoints转换为新的damageTicks', () => {
      const result = migrateSkillData(mockOldSkill);
      expect(result.damageTicks).toBeDefined();
      expect(result.damageTicks.length).toBe(1);
      expect(result.damageTicks[0].offset).toBe(45);
      expect(result.damageTicks[0].multiplier).toBe(2.5);
      expect(result.damageTicks[0].element).toBe('fire');
      expect(result.damageTicks[0].hitType).toBe('skill');
      expect(result.damageTicks[0].description).toBe('测试伤害');
    });

    it('应该将旧的单个buff转换为新的buffs数组', () => {
      const result = migrateSkillData(mockOldSkill);
      expect(result.buffs).toBeDefined();
      expect(result.buffs.length).toBe(1);
      expect(result.buffs[0].name).toBe('测试 buff');
      expect(result.buffs[0].type).toBe('attack');
      expect(result.buffs[0].value).toBe(0.2);
      expect(result.buffs[0].duration).toBe(10);
      expect(result.buffs[0].trigger).toBe('onCast');
      expect(result.buffs[0].target).toBe('self');
    });

    it('应该保留旧字段以确保兼容性', () => {
      const result = migrateSkillData(mockOldSkill);
      expect(result.buff).toBeDefined();
      expect(result.judgmentPoints).toBeDefined();
    });

    it('应该为没有damageTicks的技能添加默认值', () => {
      const skillWithoutTicks = {
        id: 'skill_no_ticks',
        name: '无伤害判定技能',
        type: 'skill',
        element: 'fire',
        damageMultiplier: 2.0,
        frames: {
          start: 0,
          end: 60,
          recovery: 15
        }
      };
      const result = migrateSkillData(skillWithoutTicks);
      expect(result.damageTicks).toBeDefined();
      expect(result.damageTicks.length).toBe(1);
      expect(result.damageTicks[0].offset).toBe(30);
      expect(result.damageTicks[0].multiplier).toBe(2.0);
    });

    it('应该为多段伤害技能生成多个伤害判定帧', () => {
      const multiHitSkill = {
        id: 'skill_multi_hit',
        name: '多段伤害技能',
        type: 'normal',
        element: 'physical',
        damageMultiplier: [0.5, 0.6, 0.7],
        frames: {
          start: 0,
          end: 60,
          recovery: 15
        }
      };
      const result = migrateSkillData(multiHitSkill);
      expect(result.damageTicks).toBeDefined();
      expect(result.damageTicks.length).toBe(3);
      expect(result.damageTicks[0].offset).toBe(20);
      expect(result.damageTicks[1].offset).toBe(40);
      expect(result.damageTicks[2].offset).toBe(60);
    });
  });

  describe('migrateCharacterData', () => {
    it('应该迁移角色的所有技能', () => {
      const result = migrateCharacterData(mockOldCharacter);
      expect(result.skills).toBeDefined();
      expect(result.skills.length).toBe(1);
      expect(result.skills[0].damageTicks).toBeDefined();
      expect(result.skills[0].buffs).toBeDefined();
    });
  });

  describe('migrateGameData', () => {
    it('应该迁移所有角色并更新版本号', () => {
      const result = migrateGameData(mockOldGameData);
      expect(result.version).toBe('1.1.0');
      expect(result.characters).toBeDefined();
      expect(result.characters.length).toBe(1);
      expect(result.characters[0].skills[0].damageTicks).toBeDefined();
      expect(result.characters[0].skills[0].buffs).toBeDefined();
    });
  });

  describe('needsMigration', () => {
    it('应该返回true当版本号低于1.1.0', () => {
      const result = needsMigration({ version: '1.0.0' });
      expect(result).toBe(true);
    });

    it('应该返回false当版本号等于1.1.0', () => {
      const result = needsMigration({ version: '1.1.0' });
      expect(result).toBe(false);
    });

    it('应该返回false当版本号高于1.1.0', () => {
      const result = needsMigration({ version: '1.2.0' });
      expect(result).toBe(false);
    });

    it('应该返回true当没有版本号', () => {
      const result = needsMigration({});
      expect(result).toBe(true);
    });
  });

  describe('executeMigration', () => {
    it('应该执行迁移当需要时', () => {
      const result = executeMigration(mockOldGameData);
      expect(result.version).toBe('1.1.0');
      expect(result.characters[0].skills[0].damageTicks).toBeDefined();
      expect(result.characters[0].skills[0].buffs).toBeDefined();
    });

    it('应该返回原始数据当不需要迁移时', () => {
      const currentData = { ...mockOldGameData, version: '1.1.0' };
      const result = executeMigration(currentData);
      expect(result).toBe(currentData);
    });
  });
});
