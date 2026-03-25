import { defineStore } from 'pinia';

// 项目存储键名
const STORAGE_KEY = 'promilia_axis_projects';
const AUTO_SAVE_INTERVAL = 30000; // 30秒自动保存

// 生成唯一ID
const generateId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// 从本地存储加载项目
const loadProjectsFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    // console.error('Failed to load projects from storage:', error)
    return [];
  }
};

// 保存项目到本地存储
const saveProjectsToStorage = projects => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // console.error('Failed to save projects to storage:', error)
  }
};

export const useProjectStore = defineStore('project', {
  state: () => ({
    projects: loadProjectsFromStorage(),
    currentProjectId: null,
    autoSaveTimer: null,
  }),
  getters: {
    // 获取当前项目
    currentProject: state => {
      if (!state.currentProjectId) return null;
      return state.projects.find(p => p.id === state.currentProjectId);
    },
    // 获取项目列表
    projectList: state => {
      return state.projects.map(project => ({
        id: project.id,
        name: project.name,
        characters: project.characters,
        duration: project.duration,
        createdTime: project.createdTime,
        updatedTime: project.updatedTime,
      }));
    },
    // 获取项目数量
    projectCount: state => state.projects.length,
  },
  actions: {
    // 创建新项目
    createProject(options = {}) {
      const newProject = {
        id: generateId(),
        name: options.name || '未命名项目',
        characters: options.characters || [],
        enemy: options.enemy || '',
        fps: options.fps || 60,
        duration: options.duration || 1200,
        skillBlocks: [],
        buffBlocks: [],
        resourceBlocks: [],
        keyframes: [],
        skillDependencies: [],
        createdTime: new Date().toISOString(),
        updatedTime: new Date().toISOString(),
      };

      this.projects.push(newProject);
      this.currentProjectId = newProject.id;
      this.saveProjects();
      this.startAutoSave();

      return newProject;
    },
    // 加载项目
    loadProject(projectId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        this.currentProjectId = projectId;
        this.startAutoSave();
        return project;
      }
      return null;
    },
    // 获取项目通过ID
    getProjectById(projectId) {
      return this.projects.find(p => p.id === projectId);
    },
    // 更新项目
    updateProject(projectId, updates) {
      const index = this.projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        this.projects[index] = {
          ...this.projects[index],
          ...updates,
          updatedTime: new Date().toISOString(),
        };
        this.saveProjects();
        return this.projects[index];
      }
      return null;
    },
    // 更新技能块
    updateSkillBlock(projectId, updatedBlock) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const index = project.skillBlocks.findIndex(
          block => block.id === updatedBlock.id
        );
        if (index !== -1) {
          project.skillBlocks[index] = updatedBlock;
          project.updatedTime = new Date().toISOString();
          this.saveProjects();
        }
      }
    },
    // 添加技能块
    addSkillBlock(projectId, skillBlock) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const newBlock = {
          ...skillBlock,
          id: generateId(),
          createdTime: new Date().toISOString(),
        };
        project.skillBlocks.push(newBlock);
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return newBlock;
      }
      return null;
    },
    // 删除技能块
    removeSkillBlock(projectId, skillBlockId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.skillBlocks = project.skillBlocks.filter(
          block => block.id !== skillBlockId
        );
        // 同时删除相关的依赖关系
        project.skillDependencies = project.skillDependencies.filter(
          dep =>
            dep.sourceBlockId !== skillBlockId &&
            dep.targetBlockId !== skillBlockId
        );
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
      }
    },

    // 添加Buff块
    addBuffBlock(projectId, buffBlock) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const newBlock = {
          ...buffBlock,
          id: generateId(),
          createdTime: new Date().toISOString(),
        };
        project.buffBlocks.push(newBlock);
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return newBlock;
      }
      return null;
    },

    // 更新Buff块
    updateBuffBlock(projectId, updatedBlock) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const index = project.buffBlocks.findIndex(
          block => block.id === updatedBlock.id
        );
        if (index !== -1) {
          project.buffBlocks[index] = updatedBlock;
          project.updatedTime = new Date().toISOString();
          this.saveProjects();
        }
      }
    },

    // 删除Buff块
    removeBuffBlock(projectId, buffBlockId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.buffBlocks = project.buffBlocks.filter(
          block => block.id !== buffBlockId
        );
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
      }
    },

    // 添加资源变化块
    addResourceBlock(projectId, resourceBlock) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const newBlock = {
          ...resourceBlock,
          id: generateId(),
          createdTime: new Date().toISOString(),
        };
        project.resourceBlocks.push(newBlock);
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return newBlock;
      }
      return null;
    },

    // 更新资源变化块
    updateResourceBlock(projectId, updatedBlock) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const index = project.resourceBlocks.findIndex(
          block => block.id === updatedBlock.id
        );
        if (index !== -1) {
          project.resourceBlocks[index] = updatedBlock;
          project.updatedTime = new Date().toISOString();
          this.saveProjects();
        }
      }
    },

    // 删除资源变化块
    removeResourceBlock(projectId, resourceBlockId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.resourceBlocks = project.resourceBlocks.filter(
          block => block.id !== resourceBlockId
        );
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
      }
    },

    // 添加关键时间点
    addKeyframe(projectId, keyframe) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const newKeyframe = {
          ...keyframe,
          id: generateId(),
          createdTime: new Date().toISOString(),
        };
        project.keyframes.push(newKeyframe);
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return newKeyframe;
      }
      return null;
    },

    // 更新关键时间点
    updateKeyframe(projectId, updatedKeyframe) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const index = project.keyframes.findIndex(
          keyframe => keyframe.id === updatedKeyframe.id
        );
        if (index !== -1) {
          project.keyframes[index] = updatedKeyframe;
          project.updatedTime = new Date().toISOString();
          this.saveProjects();
        }
      }
    },

    // 删除关键时间点
    removeKeyframe(projectId, keyframeId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.keyframes = project.keyframes.filter(
          keyframe => keyframe.id !== keyframeId
        );
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
      }
    },

    // 添加技能依赖关系
    addSkillDependency(projectId, sourceBlockId, targetBlockId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        // 检查是否已存在相同的依赖关系
        const existingDependency = project.skillDependencies.find(
          dep =>
            dep.sourceBlockId === sourceBlockId &&
            dep.targetBlockId === targetBlockId
        );

        if (!existingDependency) {
          const newDependency = {
            id: generateId(),
            sourceBlockId,
            targetBlockId,
          };
          project.skillDependencies.push(newDependency);
          project.updatedTime = new Date().toISOString();
          this.saveProjects();
          return newDependency;
        }
      }
      return null;
    },

    // 删除技能依赖关系
    removeSkillDependency(projectId, dependencyId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.skillDependencies = project.skillDependencies.filter(
          dep => dep.id !== dependencyId
        );
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return true;
      }
      return false;
    },

    // 删除指定技能块之间的依赖关系
    removeSkillDependencyByBlocks(projectId, sourceBlockId, targetBlockId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.skillDependencies = project.skillDependencies.filter(
          dep =>
            !(
              dep.sourceBlockId === sourceBlockId &&
              dep.targetBlockId === targetBlockId
            )
        );
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return true;
      }
      return false;
    },
    // 保存项目
    saveProject(projectId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        project.updatedTime = new Date().toISOString();
        this.saveProjects();
        return true;
      }
      return false;
    },
    // 保存所有项目到本地存储
    saveProjects() {
      saveProjectsToStorage(this.projects);
    },
    // 删除项目
    deleteProject(projectId) {
      const index = this.projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        this.projects.splice(index, 1);
        if (this.currentProjectId === projectId) {
          this.currentProjectId = null;
          this.stopAutoSave();
        }
        this.saveProjects();
        return true;
      }
      return false;
    },
    // 导出项目
    exportProject(projectId) {
      const project = this.projects.find(p => p.id === projectId);
      if (project) {
        const exportData = {
          version: '1.0.0',
          project: project,
          exportTime: new Date().toISOString(),
        };
        return JSON.stringify(exportData, null, 2);
      }
      return null;
    },
    // 导入项目
    importProject(exportData) {
      try {
        const data =
          typeof exportData === 'string' ? JSON.parse(exportData) : exportData;

        // 验证导入数据
        if (!data.project) {
          throw new Error('Invalid project data');
        }

        // 生成新ID避免冲突
        const importedProject = {
          ...data.project,
          id: generateId(),
          importedTime: new Date().toISOString(),
          updatedTime: new Date().toISOString(),
        };

        this.projects.push(importedProject);
        this.currentProjectId = importedProject.id;
        this.saveProjects();
        this.startAutoSave();

        return importedProject;
      } catch (error) {
        // console.error('Failed to import project:', error);
        throw error;
      }
    },
    // 开始自动保存
    startAutoSave() {
      // 清除之前的定时器
      this.stopAutoSave();

      // 设置新的自动保存定时器
      this.autoSaveTimer = setInterval(() => {
        if (this.currentProjectId) {
          this.saveProject(this.currentProjectId);
        }
      }, AUTO_SAVE_INTERVAL);
    },
    // 停止自动保存
    stopAutoSave() {
      if (this.autoSaveTimer) {
        clearInterval(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
    },
  },
});
