# 蓝色星原战斗排轴编辑器 - 项目架构文档

## 1. 项目概述

### 1.1 项目简介
蓝色星原战斗排轴编辑器是一个用于规划和分析游戏战斗策略的工具，支持技能排轴、伤害计算、循环验证等功能。

### 1.2 技术栈
- **前端框架**: Vue 3 (Composition API)
- **构建工具**: Vite
- **状态管理**: Pinia
- **UI 组件库**: Element Plus
- **图表库**: ECharts
- **国际化**: Vue I18n
- **路由**: Vue Router
- **拖拽功能**: VueDraggable
- **样式预处理器**: SCSS

## 2. 目录结构

```
src/
├── components/          # 组件目录
│   ├── editor/          # 编辑器相关组件
│   │   ├── GuideTour.vue        # 新手引导组件
│   │   ├── SkillEditPanel.vue   # 技能编辑面板
│   │   ├── SkillLibrary.vue     # 技能库组件
│   │   ├── StatPanel.vue        # 统计面板组件
│   │   └── ValidatePanel.vue    # 验证面板组件
│   ├── datamanage/      # 数据管理组件（预留）
│   └── timeline/        # 时间轴相关组件
│       ├── BuffBlock.vue        # Buff块组件
│       ├── Keyframe.vue         # 关键帧组件
│       ├── LinkLine.vue         # 技能连携线组件
│       ├── ResourceBlock.vue    # 资源变化块组件
│       ├── ResourceCurve.vue    # 资源曲线组件
│       └── SkillBlock.vue       # 技能块组件
├── i18n/               # 国际化文件
│   ├── locales/         # 语言包
│   │   ├── en-US.json   # 英文语言包
│   │   └── zh-CN.json   # 中文语言包
│   └── index.js         # 国际化配置
├── router/             # 路由配置
│   └── index.js         # 路由定义
├── store/              # Pinia 状态管理
│   ├── gamedata.js      # 游戏数据存储
│   ├── history.js       # 历史记录存储
│   ├── project.js       # 项目数据存储
│   └── setting.js       # 全局设置存储
├── styles/             # 样式文件
│   ├── index.scss       # 主样式文件
│   ├── reset.scss       # 重置样式
│   └── theme.scss       # 主题样式
├── utils/              # 工具函数
│   ├── common.js        # 通用工具函数
│   ├── constants.js     # 常量定义
│   ├── damageCalc.js    # 伤害计算引擎
│   ├── statCalc.js      # 统计计算工具
│   └── validate.js      # 循环验证工具
├── views/              # 页面组件
│   ├── DataEditor.vue   # 数据编辑器页面
│   ├── Editor.vue       # 主编辑器页面
│   ├── Guide.vue        # 使用教程页面
│   ├── Handbook.vue     # 游戏图鉴页面
│   ├── Home.vue         # 首页
│   ├── Preset.vue       # 预设轴库页面
│   └── Setting.vue      # 设置页面
├── App.vue             # 根组件
└── main.js             # 入口文件

public/
├── gamedata/           # 游戏数据
│   └── gamedata.json    # 游戏数据配置文件
└── avatars/            # 角色头像
```

## 3. 核心模块设计

### 3.1 编辑器核心 (Editor.vue)
- **功能**: 主编辑器页面，集成所有核心功能
- **职责**:
  - 时间轴渲染与交互
  - 技能库管理
  - 统计面板显示
  - 验证面板显示
  - 快捷键处理
  - 撤销/重做功能

### 3.2 伤害计算引擎 (damageCalc.js)
- **功能**: 计算技能伤害和相关属性
- **核心函数**:
  - `calcBaseDamage()`: 计算基础伤害
  - `calcAttack()`: 计算攻击力区
  - `calcDamageBonus()`: 计算增伤区
  - `calcCritDamage()`: 计算暴击区
  - `calcResistance()`: 计算抗性区
  - `calcLevelPenalty()`: 计算等级压制区
  - `calcToughnessCrit()`: 计算韧性暴击区
  - `calculateSkillDamage()`: 计算技能总伤害

### 3.3 循环验证系统 (validate.js)
- **功能**: 验证排轴的合法性
- **核心函数**:
  - `validateCDConflict()`: 验证CD冲突
  - `validateResource()`: 验证资源合法性
  - `validateDependency()`: 验证技能依赖
  - `validateAction()`: 验证动作合法性
  - `validateTimeline()`: 验证整个时间轴

### 3.4 统计计算工具 (statCalc.js)
- **功能**: 计算排轴的统计数据
- **核心函数**:
  - `calculateTotalTime()`: 计算总时长
  - `calculateTotalDamage()`: 计算总伤害
  - `calculateAverageDPS()`: 计算平均DPS
  - `calculatePeakDPS()`: 计算爆发峰值DPS
  - `calculateTotalToughnessDamage()`: 计算总削韧值
  - `calculateBuffUptime()`: 计算Buff覆盖率
  - `calculateCooldownUtilization()`: 计算CD利用率
  - `calculateResourceOverflow()`: 计算资源溢出率
  - `calculateAllStats()`: 计算所有统计指标

### 3.5 状态管理 (store/)
- **project.js**: 项目数据管理
- **gamedata.js**: 游戏数据管理
- **history.js**: 历史记录管理
- **setting.js**: 全局设置管理

## 4. 数据流设计

### 4.1 项目数据流程
1. **项目创建**: Home.vue → projectStore.createProject() → 存储到localStorage
2. **技能添加**: SkillLibrary.vue → Editor.vue → projectStore.addSkillBlock() → 存储到项目数据
3. **伤害计算**: Editor.vue → damageCalc.js → 计算结果 → StatPanel.vue 显示
4. **循环验证**: Editor.vue → validate.js → 验证结果 → ValidatePanel.vue 显示
5. **历史记录**: Editor.vue → historyStore.recordSkillBlockAction() → 存储操作历史
6. **项目保存**: Editor.vue → projectStore.saveProject() → 存储到localStorage

### 4.2 状态管理流程
```
用户操作 → 组件事件 → Store Action → 状态更新 → 组件重新渲染
```

## 5. 组件层次结构

```
App.vue
├── Home.vue
├── Editor.vue
│   ├── SkillLibrary.vue
│   ├── SkillBlock.vue
│   ├── BuffBlock.vue
│   ├── ResourceBlock.vue
│   ├── Keyframe.vue
│   ├── LinkLine.vue
│   ├── ResourceCurve.vue
│   ├── SkillEditPanel.vue
│   ├── StatPanel.vue
│   ├── ValidatePanel.vue
│   └── GuideTour.vue
├── DataEditor.vue
├── Preset.vue
├── Guide.vue
├── Handbook.vue
└── Setting.vue
```

## 6. 核心功能实现

### 6.1 技能排轴
- **实现**: 通过 SkillBlock 组件和拖拽功能
- **流程**: 从技能库拖拽技能到时间轴 → 计算位置和时长 → 添加到项目数据
- **交互**: 支持拖拽移动、调整时长、点击选择

### 6.2 伤害计算
- **实现**: damageCalc.js 中的计算函数
- **流程**: 遍历技能 → 计算每个技能伤害 → 汇总统计数据
- **特点**: 支持全乘区计算、印记体系、韧性机制、DOT伤害

### 6.3 循环验证
- **实现**: validate.js 中的验证函数
- **流程**: 逐帧检查时间轴 → 检测冲突和问题 → 生成验证报告
- **特点**: 支持CD冲突、资源不足、技能依赖、动作冲突验证

### 6.4 统计分析
- **实现**: statCalc.js 中的统计函数
- **流程**: 分析时间轴数据 → 计算各项指标 → 生成统计报告
- **特点**: 支持总伤害、DPS、Buff覆盖率、CD利用率等多维度统计

### 6.5 可视化
- **实现**: ResourceCurve.vue 和 LinkLine.vue
- **流程**: 数据处理 → ECharts 渲染 → 交互处理
- **特点**: 支持资源曲线、技能连携线、实时数据更新

### 6.6 导入导出
- **实现**: project.js 中的序列化/反序列化函数
- **流程**: 数据序列化 → 文件下载/上传 → 数据解析
- **特点**: 支持 .promilia 格式、Markdown 报告、JSON 源文件

## 7. 扩展指南

### 7.1 添加新角色
1. 在 `public/gamedata/gamedata.json` 中添加角色数据
2. 确保角色数据包含完整的技能信息
3. 重新启动开发服务器

### 7.2 添加新敌人
1. 在 `public/gamedata/gamedata.json` 中添加敌人数据
2. 包含敌人的抗性、韧性、机制等信息
3. 重新启动开发服务器

### 7.3 添加新功能模块
1. 在 `src/components/` 中创建新组件
2. 在 `src/utils/` 中添加相关工具函数
3. 在 `src/store/` 中添加状态管理
4. 在 `src/views/` 中添加页面组件
5. 在 `src/router/index.js` 中添加路由

### 7.4 扩展伤害计算
1. 在 `src/utils/damageCalc.js` 中添加新的计算函数
2. 更新 `calculateSkillDamage()` 函数以包含新的计算逻辑
3. 确保与现有计算流程兼容

### 7.5 扩展验证规则
1. 在 `src/utils/validate.js` 中添加新的验证函数
2. 更新 `validateTimeline()` 函数以包含新的验证规则
3. 在 `src/components/editor/ValidatePanel.vue` 中添加相应的显示逻辑

## 8. 维护建议

### 8.1 代码规范
- 遵循 ESLint 和 Prettier 规范
- 使用 JSDoc 注释核心函数
- 保持代码风格一致

### 8.2 性能优化
- 使用 Vue 3 的 Composition API
- 合理使用 computed 和 watch
- 避免不必要的重渲染
- 对大型计算使用缓存机制

### 8.3 数据管理
- 所有游戏数据通过 `gamedata.json` 配置
- 避免硬编码游戏数值
- 使用常量管理魔法数字

### 8.4 测试建议
- 测试不同角色的技能组合
- 测试大型排轴的性能
- 测试导入导出功能
- 测试各种边界情况

### 8.5 部署建议
- 使用 `npm run build` 构建生产版本
- 确保 `public/gamedata/gamedata.json` 包含最新数据
- 配置适当的服务器缓存策略

## 9. 常见问题与解决方案

### 9.1 技能库不显示技能
- **原因**: 游戏数据未加载或角色ID不匹配
- **解决方案**: 检查 `gamedata.json` 文件，确保角色数据正确

### 9.2 伤害计算不准确
- **原因**: 技能参数配置错误或计算逻辑问题
- **解决方案**: 检查技能参数，调试 `damageCalc.js` 中的计算逻辑

### 9.3 验证结果错误
- **原因**: 验证逻辑问题或时间轴数据错误
- **解决方案**: 检查 `validate.js` 中的验证逻辑，确保时间轴数据正确

### 9.4 性能问题
- **原因**: 大型排轴或复杂计算
- **解决方案**: 优化计算逻辑，使用缓存，考虑分页加载

### 9.5 导入导出失败
- **原因**: 文件格式错误或数据结构不兼容
- **解决方案**: 检查文件格式，确保数据结构符合要求

## 10. 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| 1.0.0 | 2026-03-25 | 第三阶段完成，添加统计计算、常量管理等功能 |
| 0.2.0 | 2026-03-20 | 第二阶段完成，核心功能实现 |
| 0.1.0 | 2026-03-15 | 第一阶段完成，基础架构搭建 |

## 11. 未来规划

### 11.1 功能扩展
- 支持更多游戏机制
- 添加队伍配置界面
- 实现更复杂的AI分析
- 支持多人协作编辑

### 11.2 技术升级
- 迁移到 TypeScript
- 优化构建流程
- 改进响应式设计
- 添加单元测试

### 11.3 数据管理
- 实现在线数据同步
- 添加用户账号系统
- 支持数据备份和恢复
- 建立社区分享平台

---

**文档版本**: 1.0.0
**最后更新**: 2026-03-25
**维护者**: 开发团队