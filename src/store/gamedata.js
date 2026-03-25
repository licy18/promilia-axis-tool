import { defineStore } from 'pinia';

export const useGamedataStore = defineStore('gamedata', {
  state: () => ({
    // 游戏数据
    gameData: {
      version: '1.0.0',
      gameVersion: '最新适配游戏版本',
      updateTime: new Date().toISOString(),
      characters: [],
      chippo: [],
      enemies: [],
      buffs: [],
      elements: [],
    },
    // 加载状态
    loading: false,
    // 错误信息
    error: null,
  }),
  getters: {
    // 获取所有角色
    allCharacters: state => state.gameData.characters,
    characters: state => state.gameData.characters,
    // 获取所有奇波
    allChippo: state => state.gameData.chippo,
    // 获取所有敌人
    allEnemies: state => state.gameData.enemies,
    enemies: state => state.gameData.enemies,
    // 获取所有 buffs
    allBuffs: state => state.gameData.buffs,
    // 获取所有元素
    allElements: state => state.gameData.elements,
    elements: state => state.gameData.elements,
  },
  actions: {
    // 加载游戏数据
    async loadGameData() {
      this.loading = true;
      this.error = null;
      try {
        // 从 public/gamedata/gamedata.json 加载数据
        const response = await fetch('/gamedata/gamedata.json');
        if (!response.ok) {
          throw new Error('Failed to load game data');
        }
        const data = await response.json();
        this.gameData = data;
      } catch (error) {
        this.error = error.message;
        // console.error('Error loading game data:', error);
      } finally {
        this.loading = false;
      }
    },
    // 更新游戏数据
    updateGameData(data) {
      this.gameData = { ...this.gameData, ...data };
      this.gameData.updateTime = new Date().toISOString();
    },
    // 添加角色
    addCharacter(character) {
      this.gameData.characters.push(character);
      this.gameData.updateTime = new Date().toISOString();
    },
    // 更新角色
    updateCharacter(id, character) {
      const index = this.gameData.characters.findIndex(c => c.id === id);
      if (index !== -1) {
        this.gameData.characters[index] = {
          ...this.gameData.characters[index],
          ...character,
        };
        this.gameData.updateTime = new Date().toISOString();
      }
    },
    // 删除角色
    deleteCharacter(id) {
      this.gameData.characters = this.gameData.characters.filter(
        c => c.id !== id
      );
      this.gameData.updateTime = new Date().toISOString();
    },
    // 添加奇波
    addChippo(chippo) {
      this.gameData.chippo.push(chippo);
      this.gameData.updateTime = new Date().toISOString();
    },
    // 更新奇波
    updateChippo(id, chippo) {
      const index = this.gameData.chippo.findIndex(c => c.id === id);
      if (index !== -1) {
        this.gameData.chippo[index] = {
          ...this.gameData.chippo[index],
          ...chippo,
        };
        this.gameData.updateTime = new Date().toISOString();
      }
    },
    // 删除奇波
    deleteChippo(id) {
      this.gameData.chippo = this.gameData.chippo.filter(c => c.id !== id);
      this.gameData.updateTime = new Date().toISOString();
    },
    // 添加敌人
    addEnemy(enemy) {
      this.gameData.enemies.push(enemy);
      this.gameData.updateTime = new Date().toISOString();
    },
    // 更新敌人
    updateEnemy(id, enemy) {
      const index = this.gameData.enemies.findIndex(e => e.id === id);
      if (index !== -1) {
        this.gameData.enemies[index] = {
          ...this.gameData.enemies[index],
          ...enemy,
        };
        this.gameData.updateTime = new Date().toISOString();
      }
    },
    // 删除敌人
    deleteEnemy(id) {
      this.gameData.enemies = this.gameData.enemies.filter(e => e.id !== id);
      this.gameData.updateTime = new Date().toISOString();
    },
  },
});
