import { defineStore } from 'pinia';

export const useHistoryStore = defineStore('history', {
  state: () => ({
    history: [],
    historyIndex: -1,
    maxHistory: 50, // 最大历史记录数量
  }),
  getters: {
    canUndo: state => state.historyIndex >= 0,
    canRedo: state => state.historyIndex < state.history.length - 1,
  },
  actions: {
    // 添加操作到历史记录
    addHistory(action) {
      // 清除当前索引之后的历史记录
      if (this.historyIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.historyIndex + 1);
      }

      // 添加新操作
      this.history.push(action);

      // 限制历史记录数量
      if (this.history.length > this.maxHistory) {
        this.history.shift();
      } else {
        this.historyIndex++;
      }
    },

    // 撤销操作
    undo() {
      if (this.canUndo) {
        const action = this.history[this.historyIndex];
        this.historyIndex--;
        return action;
      }
      return null;
    },

    // 重做操作
    redo() {
      if (this.canRedo) {
        this.historyIndex++;
        const action = this.history[this.historyIndex];
        return action;
      }
      return null;
    },

    // 清空历史记录
    clearHistory() {
      this.history = [];
      this.historyIndex = -1;
    },

    // 记录技能块操作
    recordSkillBlockAction(type, skillBlock, oldData = null) {
      this.addHistory({
        type: `skillBlock_${type}`,
        timestamp: Date.now(),
        data: {
          skillBlock,
          oldData,
        },
      });
    },

    // 记录关键帧操作
    recordKeyframeAction(type, keyframe, oldData = null) {
      this.addHistory({
        type: `keyframe_${type}`,
        timestamp: Date.now(),
        data: {
          keyframe,
          oldData,
        },
      });
    },

    // 记录批量操作
    recordBatchAction(type, items, oldData = []) {
      this.addHistory({
        type: `batch_${type}`,
        timestamp: Date.now(),
        data: {
          items,
          oldData,
        },
      });
    },
  },
});
