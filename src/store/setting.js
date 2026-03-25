import { defineStore } from 'pinia';

export const useSettingStore = defineStore('setting', {
  state: () => ({
    // 语言设置
    language: localStorage.getItem('promilia_axis_locale') || 'zh-CN',
    // 主题设置
    theme: localStorage.getItem('promilia_axis_theme') || 'dark',
    // 编辑器设置
    editor: {
      snapToGrid: true,
      gridSize: 100,
      showTimelineLabels: true,
      autoSave: true,
      autoSaveInterval: 30000,
    },
    // 模拟设置
    simulation: {
      enableAnimation: true,
      animationSpeed: 1,
      showDebugInfo: false,
    },
    // 数据设置
    data: {
      autoLoadGameData: true,
      cacheGameData: true,
    },
  }),
  getters: {
    // 获取当前语言
    currentLanguage: state => state.language,
    // 获取当前主题
    currentTheme: state => state.theme,
    // 获取编辑器设置
    editorSettings: state => state.editor,
    // 获取模拟设置
    simulationSettings: state => state.simulation,
    // 获取数据设置
    dataSettings: state => state.data,
  },
  actions: {
    // 设置语言
    setLanguage(lang) {
      this.language = lang;
      localStorage.setItem('promilia_axis_locale', lang);
    },
    // 设置主题
    setTheme(theme) {
      this.theme = theme;
      localStorage.setItem('promilia_axis_theme', theme);
      // 应用主题到文档
      document.documentElement.setAttribute('data-theme', theme);
    },
    // 切换主题
    toggleTheme() {
      const newTheme = this.theme === 'dark' ? 'light' : 'dark';
      this.setTheme(newTheme);
    },
    // 更新编辑器设置
    updateEditorSettings(settings) {
      this.editor = { ...this.editor, ...settings };
      this.saveSettings();
    },
    // 更新模拟设置
    updateSimulationSettings(settings) {
      this.simulation = { ...this.simulation, ...settings };
      this.saveSettings();
    },
    // 更新数据设置
    updateDataSettings(settings) {
      this.data = { ...this.data, ...settings };
      this.saveSettings();
    },
    // 保存设置到本地存储
    saveSettings() {
      localStorage.setItem(
        'promilia_axis_settings',
        JSON.stringify({
          editor: this.editor,
          simulation: this.simulation,
          data: this.data,
        })
      );
    },
    // 从本地存储加载设置
    loadSettings() {
      try {
        const savedSettings = localStorage.getItem('promilia_axis_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          this.editor = { ...this.editor, ...settings.editor };
          this.simulation = { ...this.simulation, ...settings.simulation };
          this.data = { ...this.data, ...settings.data };
        }
      } catch {
        // console.error('Error loading settings:', error)
      }
    },
    // 重置设置
    resetSettings() {
      this.language = 'zh-CN';
      this.theme = 'dark';
      this.editor = {
        snapToGrid: true,
        gridSize: 100,
        showTimelineLabels: true,
        autoSave: true,
        autoSaveInterval: 30000,
      };
      this.simulation = {
        enableAnimation: true,
        animationSpeed: 1,
        showDebugInfo: false,
      };
      this.data = {
        autoLoadGameData: true,
        cacheGameData: true,
      };
      // 清除本地存储
      localStorage.removeItem('promilia_axis_locale');
      localStorage.removeItem('promilia_axis_theme');
      localStorage.removeItem('promilia_axis_settings');
    },
  },
});
