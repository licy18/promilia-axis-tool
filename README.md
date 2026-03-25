# 蓝色星原战斗排轴编辑器

## 项目介绍

蓝色星原战斗排轴编辑器（Promilia Battle Axis Editor）是一个为《蓝色星原：旅谣》游戏打造的专业战斗排轴工具，旨在帮助玩家优化战斗策略，提高游戏体验。

## 技术栈

- **核心框架**：Vue 3 (Composition API)
- **构建工具**：Vite
- **状态管理**：Pinia
- **UI组件库**：Element Plus
- **拖拽核心库**：Vue.Draggable (vuedraggable@next)
- **国际化**：vue-i18n
- **图表库**：ECharts
- **代码规范**：ESLint + Prettier
- **包管理器**：npm

## 本地启动步骤

1. **克隆项目**
   ```bash
   git clone <repository-url> promilia-axis-tool
   cd promilia-axis-tool
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm run dev
   ```

4. **构建生产版本**
   ```bash
   npm run build
   ```

5. **预览生产构建**
   ```bash
   npm run preview
   ```

## 目录结构

```
Promilia-axis-tool/
├── public/                          # 静态资源目录（不可编译资源）
│   ├── gamedata/                    # 游戏数据目录
│   │   └── gamedata.json            # 核心游戏数据主文件
│   ├── assets/                       # 静态资源
│   │   ├── images/                   # 图片、图标、角色立绘占位
│   │   └── styles/                   # 全局静态样式
│   └── favicon.ico                   # 项目图标
├── src/                              # 项目源码主目录
│   ├── components/                   # 公共组件目录
│   │   ├── common/                   # 通用UI组件（按钮、弹窗、卡片等）
│   │   ├── layout/                   # 全局布局组件
│   │   ├── editor/                   # 排轴编辑器核心组件（预留占位）
│   │   ├── timeline/                 # 时间轴核心组件（预留占位）
│   │   └── datamanage/               # 数据管理组件（预留占位）
│   ├── i18n/                         # 国际化配置目录
│   │   ├── index.js                  # i18n入口配置文件
│   │   └── locales/                  # 翻译文件目录
│   │       ├── zh-CN.json            # 简体中文翻译文件
│   │       └── en-US.json            # 英文翻译文件（预留占位）
│   ├── router/                       # 路由配置目录
│   │   └── index.js                  # 全局路由配置文件
│   ├── store/                        # Pinia状态管理目录
│   │   ├── project.js                # 排轴项目状态store
│   │   ├── gamedata.js               # 游戏数据状态store
│   │   └── setting.js                # 全局设置状态store
│   ├── utils/                        # 工具函数目录
│   │   ├── common.js                 # 通用工具函数
│   │   ├── validate.js               # 校验工具函数（预留占位）
│   │   └── damageCalc.js             # 伤害计算引擎（预留占位）
│   ├── views/                        # 页面组件目录
│   │   ├── Home.vue                  # 首页
│   │   ├── Editor.vue                # 排轴编辑器核心页
│   │   ├── Preset.vue                # 预设轴库页
│   │   ├── Handbook.vue              # 游戏数据图鉴页
│   │   ├── Guide.vue                 # 使用教程页
│   │   └── DataEditor.vue            # 内置数据编辑器页
│   ├── styles/                       # 全局样式目录
│   │   ├── index.scss                # 全局样式入口
│   │   ├── theme.scss                # 主题定制样式
│   │   └── reset.scss                # 样式重置文件
│   ├── App.vue                       # 项目根组件
│   └── main.js                       # 项目入口文件
├── .gitignore                        # Git忽略配置文件
├── .eslintrc.cjs                     # ESLint配置文件
├── .prettierrc                       # Prettier配置文件
├── jsconfig.json                     # JS配置文件
├── vite.config.js                    # Vite配置文件
├── package.json                      # 项目依赖配置文件
├── README.md                         # 项目说明文档
└── LICENSE                           # 开源协议文件（MIT协议）
```

## 核心功能

1. **排轴编辑器**：直观的时间轴编辑界面，支持拖拽操作，轻松编排角色技能释放顺序
2. **预设轴库**：灵活的预设轴管理，支持保存、加载、分享排轴方案
3. **游戏数据图鉴**：内置丰富的游戏数据，包括角色技能、敌人属性、奇波效果等
4. **伤害计算**：详细的伤害计算，帮助你优化输出循环，最大化队伍伤害
5. **数据编辑器**：内置数据编辑器，方便用户自定义游戏数据
6. **国际化支持**：支持简体中文和英文，语言配置持久化
7. **主题定制**：支持深色和浅色主题，适配不同使用场景

## 开源协议

本项目采用 MIT 开源协议，详见 [LICENSE](LICENSE) 文件。

## 注意事项

- 本项目为非盈利粉丝向开源工具，无任何商业用途
- 本项目无账号/付费/后端接口依赖，纯前端实现
- 项目数据基于《蓝色星原：旅谣》游戏，如有变动请及时更新游戏数据
- 如有问题或建议，欢迎提交 Issue 或 Pull Request

## 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

---

**享受排轴的乐趣！** 🎮