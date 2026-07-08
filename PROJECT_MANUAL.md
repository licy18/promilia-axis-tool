# promilia-axis-tool 项目手册

最后更新：2026-07-08

当前策略是以 Endaxis 为架构和交互参考，对 `promilia-axis-tool` 进行从头重构；旧实现只保留为功能原型和迁移参考。完整任务拆解见 `DEVELOPMENT_PLAN.md`，本文件保留最终目标、阶段目标、项目状态和当前事实。

## 1. 项目目标

`promilia-axis-tool` 是面向《蓝色星原》的战斗排轴工具。核心目标不是做普通资料站，而是让用户能够把角色、技能、敌人、资源、Buff、异常状态和伤害时点放到同一条时间轴上，形成可编辑、可验证、可分享的战斗轴。

当前目标参考项目是 `Endaxis`，路径为：

```text
C:\Codex\AzPr Axis\Endaxis
```

Endaxis 用于参考成熟排轴工具的架构分层、交互密度、数据访问方式和模拟运行时组织方式。它的数据和游戏机制不应直接作为蓝色星原数据源；但除游戏内容和伤害计算逻辑外，功能设计、操作流程、页面布局和交互习惯应尽量复用 Endaxis 的成熟做法。

### 最终目标

最终版本应成为一个以真实蓝色星原数据和战斗计算为核心的排轴工具，而不是在旧原型上继续堆 UI 功能。

核心目标：

- 数据真实：角色、技能、元素、敌人、奇波、装备、灵子、图片资源等都从 `C:\PC2\Codex\AzPr` 生成或映射，不继续使用非蓝色星原占位数据。
- 运行时优先：建立 `数据 -> 项目模型 -> 编译器 -> 模拟运行时 -> 结果投影 -> UI` 的稳定链路，UI 不直接成为战斗逻辑事实标准。
- 对标 Endaxis 体验：提供动作库、时间轴网格、属性面板、敌人面板、资源监控、分析面板、导入导出、预设轴等完整工作台能力。
- 适配蓝色星原机制：战斗公式、元素/异常、角色资源、技能冷却、Buff、敌人属性、奇波/装备/灵子效果都按 AzPr 数据和机制建模，不照搬 Endaxis 的游戏概念。
- 精度诚实：缺少技能命中帧、动作时长、取消窗口等运行时数据时，必须显式标记 `needsTimingData` / `timingSource`，不得把描述文本解析结果伪装成精确排轴帧。
- 可维护：项目文件、游戏数据、导入导出和运行时结果都应版本化；关键数据转换和模拟逻辑必须有测试。

重构原则：

- 旧版 `Editor.vue`、store、工具函数和 `gamedata.json` 只作为功能清单、交互样例和迁移来源，不作为新架构的硬约束。
- 先完成真实数据管线和核心运行时最小闭环，再扩展复杂 UI。
- 每个阶段都要留下可验证产物，避免只做大范围代码搬迁。

## 2. 当前项目状态

当前项目已经是一个可运行的 Vue 3 前端原型，但代码质量和数据真实性不足以作为最终版本的地基。后续按“新架构重构”为主线推进，旧实现保留为可参考的功能样本。

已完成或已有雏形：

- 首页项目创建与项目列表。
- 主编辑器时间轴。
- 角色技能库与技能拖拽。
- 技能块、伤害判定点、异常/Buff 显示、CD 显示。
- 资源曲线与资源监控组件雏形。
- 项目保存、导入、导出。
- 数据图鉴和内置数据编辑器。
- 基础伤害计算、统计面板和验证面板。
- 中英文 i18n 文件。
- Vitest 测试框架。

当前验证基线：

- `npm run build`：通过。
- `npm run test -- --run`：通过；13 个测试文件、108 条测试通过。

## 3. 目录速览

```text
src/
  components/
    editor/       编辑器侧栏、统计、校验、引导等组件
    timeline/     时间轴技能块、Buff块、资源块、曲线等组件
  i18n/           多语言配置
  router/         页面路由
  store/          Pinia 状态
  styles/         全局样式
  utils/          伤害、统计、验证、迁移、通用工具
  views/          页面级组件
public/
  gamedata/       当前游戏数据入口
```

关键文件：

- `src/views/Editor.vue`：当前主编辑器中枢。
- `src/store/project.js`：项目数据和排轴动作状态。
- `src/store/gamedata.js`：游戏数据加载与维护。
- `src/utils/damageCalc.js`：伤害计算。
- `src/utils/statCalc.js`：统计计算。
- `src/utils/validate.js`：排轴验证。
- `public/gamedata/gamedata.json`：当前游戏数据主文件。

## 4. 当前数据流

游戏数据：

```text
public/gamedata/gamedata.json
  -> src/store/gamedata.js
  -> Home / Editor / Handbook / DataEditor / 计算与验证工具
```

项目数据：

```text
Home.vue 创建项目
  -> projectStore.createProject()
  -> localStorage
  -> Editor.vue 加载和编辑
  -> projectStore 保存 / 导入 / 导出
```

排轴动作：

```text
技能库拖拽或编辑器操作
  -> Editor.vue 组装动作
  -> projectStore 写入 project.actions
  -> 时间轴组件渲染
  -> 统计 / 验证 / 伤害计算读取
```

当前最大问题是旧代码仍有不少地方读取 `project.skillBlocks`，而新项目模型已经偏向 `project.actions`。后续需要先做模型统一，否则统计、验证、资源曲线和编辑器状态会持续分叉。

## 5. Endaxis 对照结论

Endaxis 当前数据和运行结构更成熟：

- `src/data/` 下按 operators、weapons、gearpieces、gearsets、enemies、system 等静态表组织数据。
- `src/data/timeline.ts` 和 `src/data/index.ts` 提供统一数据访问入口。
- 文本与数值分离，文本在 `src/i18n/game-locales/`。
- UI、store、simulation/compiler/optimizer 等职责分层更清晰。
- 核心模拟和数据转换有较多测试覆盖。

对本项目的启发：

- 可以逐步从单个 `gamedata.json` 迁移到“数据表 + 访问层 + 适配器”的结构。
- 时间轴 UI 不应直接承担复杂伤害/资源模拟。
- 需要建立蓝色星原自己的运行时模型，不要让 UI 组件直接成为事实标准。
- 导入导出应通过适配层与内部模型隔离。

## 6. 阶段目标

### 阶段 0：重构准备与边界冻结

目标：确认旧项目只作为参考，冻结新版的技术边界和第一条垂直切片。

主要任务：

- 维护 `AGENTS.md`、`PROJECT_MANUAL.md`、`DEVELOPMENT_PLAN.md` 作为接续入口。
- 清点旧原型可迁移能力：项目创建、时间轴、技能拖拽、保存导入导出、图鉴、数据编辑器、统计/验证。
- 决定新版目录和模块边界：`src/data`、`src/domain`、`src/simulation`、`src/features/editor`、`src/features/handbook` 等。
- 明确第一条垂直切片：一个真实角色、一个真实敌人、一个技能动作、一次无 UI 模拟、一个基础时间轴展示。

完成标准：

- 文档写清最终目标和阶段目标。
- 新架构的目录/模块边界确认。
- 旧实现中哪些功能迁移、哪些丢弃有明确记录。

### 阶段 1：真实 AzPr 数据管线

目标：先把真实游戏数据接进来，让新版本从第一天起脱离占位数据。

主要任务：

- 建立数据生成器，从 `C:\PC2\Codex\AzPr` 读取角色、技能、元素、敌人、奇波、装备、灵子和图片索引。
- 输出新版拆表数据和统一访问入口，避免继续维护单个大 `gamedata.json`。
- 为技能生成基础字段：名称、图标、元素、描述、等级倍率、显示 CD/SP、资源消耗/回复线索。
- 对缺失的命中帧、动作时长、取消窗口统一加 `needsTimingData: true` 和 `timingSource`。
- 增加数据校验报告，列出缺图标、缺本地化、缺属性映射、缺时序数据等问题。

完成标准：

- 新数据层中不再包含非蓝色星原角色占位。
- 至少 20 个本地可用角色、10 个元素、122 个奇波、137 个开放装备、62 个灵子和可用敌人列表可被访问层读取。
- 数据生成和校验可重复执行。

### 阶段 2：核心领域模型与项目格式

目标：定义蓝色星原排轴工具自己的稳定项目模型，避免旧 `actions` / `skillBlocks` 分叉继续扩散。

主要任务：

- 定义版本化 `Project`、`Actor`、`Enemy`、`Action`、`SkillAction`、`Buff`、`Resource`、`TimingProfile`、`Loadout`。
- 明确时间单位：内部统一使用毫秒或帧，UI 再转换显示秒。
- 建立导入导出适配层和迁移策略，兼容旧 localStorage / 旧导出文件时必须经过迁移器。
- 把奇波、装备、灵子、角色技能组和敌人配置纳入项目可选配置。

完成标准：

- 新项目文件带版本号。
- 样例项目可通过 schema/校验器。
- 旧原型项目进入新版前会被迁移或明确拒绝，并给出原因。

### 阶段 3：战斗计算运行时最小闭环

目标：在没有 UI 的情况下，给定真实数据和项目 JSON，可以完成一次最小模拟。

主要任务：

- 建立 `src/simulation/`：编译器、事件队列、状态机、机制计算、结果投影、fixture。
- 先实现最小链路：角色基础属性、敌人基础属性、一次技能命中、基础伤害、冷却、资源变化、模拟日志。
- 再逐步接入 Buff、元素/异常、敌人抗性、奇波/装备/灵子效果。
- 为每个机制准备 fixture 和 golden test。

完成标准：

- 测试或 CLI 可以不启动浏览器，直接输出时间线日志、伤害序列和统计结果。
- UI 统计面板未来只读取运行时投影，不再自己拼战斗结果。

### 阶段 4：新版编辑器骨架

目标：重建接近 Endaxis 工作台形态的编辑器，而不是继续加厚旧 `Editor.vue`。

主要任务：

- 建立动作库：技能、切人、等待、敌人事件、注释。
- 建立时间轴网格：拖拽、吸附、缩放、选择、移动、删除、复制粘贴。
- 建立属性面板：编辑动作时间、目标、等级、参数、备注。
- 建立敌人面板、资源监控、分析面板和顶部工具栏。
- 让编辑器通过项目模型和运行时投影工作，不直接读原始游戏表。

完成标准：

- 用户可以选择真实角色和真实敌人，拖入技能动作，运行模拟，并看到基础伤害/资源投影。
- 新编辑器的主文件只负责页面编排，不堆积主要业务逻辑。

### 阶段 5：机制扩展与精度补强

目标：从“可模拟”走向“可信模拟”。

主要任务：

- 结构化蓝色星原战斗公式、属性、抗性、增伤、暴击、资源、Buff、异常和敌人机制。
- 为代表角色补充 `TimingProfile`，来源可以是 asset、运行时捕获或人工标注。
- 将奇波、装备、灵子文本效果逐步转成可执行规则；无法结构化的效果必须留待办标记。
- 增加角色/技能/敌人覆盖测试和回归样例。

完成标准：

- 代表队伍能完成一条较完整轴的模拟和分析。
- 每个精确时序字段都有来源说明。
- 模拟结果中可区分“精确数据”和“待补时序数据”。

### 阶段 6：导入导出、预设和分享

目标：形成排轴创建、保存、复盘和分享闭环。

主要任务：

- 完成版本化项目 JSON 导入导出。
- 完成 Markdown 导出：队伍、敌人、时间轴步骤、统计摘要、注意事项。
- 完成图片/长图导出：时间轴视图和统计摘要。
- 建立预设轴库、标签、搜索、复制和版本兼容提示。

完成标准：

- 一条真实数据排轴可以创建、保存、重新打开、导出、导入、分享。
- 导入旧版本项目时有清晰迁移提示或失败原因。

### 阶段 7：替换旧版与发布

目标：新架构成为主线，旧原型退出核心开发路径。

主要任务：

- 对照旧原型功能清单，确认已迁移、替代或明确放弃的功能。
- 清理旧占位数据、旧模型读取、临时兼容层和无用组件。
- 完成性能检查、长轴测试、构建体积检查和基础移动端查看体验。
- 更新 README、架构文档、数据说明和用户向说明。

完成标准：

- `npm run build` 通过。
- `npm run test -- --run` 通过。
- 示例轴使用真实 AzPr 数据。
- 旧原型不再作为开发入口。

## 7. 游戏数据盘点

盘点时间：2026-07-07

数据来源根目录：

```text
C:\PC2\Codex\AzPr
```

当前结论：本地 AzPr 工作区已经足够支撑一版真实蓝色星原数据导入，但还不足以直接实现 Endaxis 级别的精确排轴模拟。已有数据覆盖角色、技能文本/倍率、元素、奇波、装备、灵子、敌人和图标资源；主要缺口是技能动作时长、每段命中帧、取消窗口、真实前后摇等运行时/动作帧数据。

### 当前项目内置数据状态

`public/gamedata/gamedata.json` 仍是原型数据：

- 角色：9 个，其中混有云堇、钟离、甘雨、雷电将军、温迪、可莉等非蓝色星原占位；只有“末音”能和本地 AzPr 可用角色直接对上。
- 奇波：1 个示例奇波。
- 敌人：5 个示例敌人。
- 元素：6 个，缺少本地源数据中的木、冰、光、暗、无，以及官方颜色/克制关系。
- 装备、灵子：项目 UI 有相关雏形，但当前 `gamedata.json` 没有真实数据入口。

### 本地 AzPr 可用数据

| 数据域             | 可用情况                                                                                          | 主要来源                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 角色基础资料       | 有；`hero.json` 有 23 行，其中 20 个可用角色，含女/男星临者和诺诺，另有 3 个不可用测试承载        | `Assets/ResourcesAssets/Config/NewTable/hero.json`、`Assets/ResourcesLang/chs/Table/lang_hero.json`  |
| 角色整理模块       | 有；`local-all` 中有 20 个角色模块 JSON，含基础资料、图标、职业/元素解析、`skillSystem`、语音等   | `BWiki/data/hero-modules/local-all`                                                                  |
| BWiki 角色表单     | 有；19 个表单，星临者合并为一个表单                                                               | `BWiki/data/local-role-forms`                                                                        |
| 技能文本与倍率     | 有；技能名、图标、描述模板、等级倍率、显示 CD/SP 可取                                             | `skill.json`、`skill_level.json`、`lang_skill.json`、`lang_skill_level.json`、角色模块 `skillSystem` |
| 元素系统           | 有；10 个元素，含颜色、图标、克制关系                                                             | `BWiki/data/local-element-system/element-system.local.json`                                          |
| 奇波               | 有；122 个主体，含元素、特性、技能描述和技能图标                                                  | `BWiki/data/local-kibo-forms/all.local-kibo-forms.json`                                              |
| 装备               | 有；137 个开放装备，43 个未开放条目；覆盖武器、上装、下装、耳环、戒指                             | `BWiki/data/local-accessory-forms/all.local-accessory-forms.json`                                    |
| 灵子               | 有；62 个整理表，含基础属性、技能描述、满星描述、相关角色                                         | `BWiki/data/local-soulessence-forms/all.local-soulessence-forms.json`                                |
| 敌人               | 部分有；`enemy.json` 有 208 个可用敌人，含名称、元素、技能列表、单位/属性 ID                      | `enemy.json`、`lang_enemy.json`、`unit_property.json`、`template_value.json`                         |
| 属性枚举与基础属性 | 有，但需要写映射器；属性 ID 可通过 `battle_info.json` 解释，具体值在 `template_value.json` 等表中 | `battle_info.json`、`template_value.json`、`template_hero.json`、`template_herolevel.json`           |
| 图片资源           | 有相当一部分；BWiki 知识库媒体目录已发现技能、元素、奇波、装备图标样例，共约 3060 个图片文件      | `BWiki/knowledge/media/images`                                                                       |

### 仍缺或需要二次处理的数据

- 精确排轴帧数据缺失：未在 `C:\PC2\Codex\AzPr` 当前表导出中找到 `Config/Battle/Skill/Hero/*.asset`、`SkillPreload` 等技能资源文件实体；角色表只保留了 `skillBytesPath` 字符串。
- `damageTicks.offset` 不能直接从现有表可靠生成：可以从技能描述解析多段倍率，但不能知道真实命中帧。
- `animationTime`、动作前摇/后摇、取消窗口、可切人窗口缺失。
- 敌人属性需要映射器：208 个敌人可用，但有 9 个敌人的 `propertyId` 暂未在 `unit_property.json` 对上；抗性、弱点、削韧/虚弱窗口需要从属性表和机制表进一步验证。
- 当前装备/奇波/灵子描述多为文本化效果，进入模拟运行时前需要结构化解析或人工规则。

### 数据接入建议

第一步不要手填 `gamedata.json`，应先做生成器：

```text
C:\PC2\Codex\AzPr\BWiki\data\hero-modules\local-all
C:\PC2\Codex\AzPr\BWiki\data\local-kibo-forms
C:\PC2\Codex\AzPr\BWiki\data\local-accessory-forms
C:\PC2\Codex\AzPr\BWiki\data\local-soulessence-forms
C:\PC2\Codex\AzPr\BWiki\data\local-element-system
```

生成到 `promilia-axis-tool` 的新版数据层时，建议给技能加上明确标记：

```json
{
  "needsTimingData": true,
  "timingSource": "missing-skill-asset-or-runtime-capture"
}
```

这样可以先让角色、技能、奇波、装备、元素和敌人进入真实数据状态，同时避免把描述解析出的倍率误认为精确排轴帧数据。

## 8. 当前已知问题清单

| 优先级 | 问题                                             | 影响                                       | 建议处理                                 |
| ------ | ------------------------------------------------ | ------------------------------------------ | ---------------------------------------- |
| P0     | `actions` 与 `skillBlocks` 并存                  | 统计、验证、显示可能不一致                 | 建立统一 adapter 或迁移到 `actions`      |
| P0     | 当前 `gamedata.json` 仍是原型/占位数据           | 角色、敌人、奇波、装备无法支撑真实排轴     | 建立本地 AzPr 数据生成器                 |
| P0     | 旧实现质量不足以作为最终架构地基                 | 继续修补会放大模型分叉和 UI/逻辑耦合       | 新架构优先，旧实现仅作功能迁移参考       |
| P0     | 精确技能帧数据缺失                               | 无法直接实现真实命中帧、动作时长、取消窗口 | 另找技能 asset、运行捕获或建立人工标注层 |
| P1     | Boss 事件 store action 缺失                      | 相关 UI 操作会报错                         | 补齐 store 方法                          |
| P1     | `ResourceMonitor.vue` 错把角色 ID 数组当对象数组 | 资源图显示不可靠                           | 从 gamedata 按 ID 解析                   |
| P1     | 数据层仍集中在单个 JSON                          | 维护复杂、难以测试                         | 引入数据访问层                           |
| P2     | 图片/Markdown 导出未完成                         | 分享体验不足                               | 阶段 6 补全                              |
| P2     | 组件和工具函数存在重复计算逻辑                   | 后续机制扩展风险高                         | 拆 runtime 后收敛                        |

## 9. 阶段进度记录

### 2026-07-07：阶段 1 最小数据管线落地

本轮完成：

- 新增 `scripts/generate-azpr-data.mjs`，默认从 `C:\PC2\Codex\AzPr` 读取本地 AzPr 数据。
- 新增 `npm run data:generate`。
- 新增生成输出目录 `src/data/generated/`。
- 新增访问层 `src/data/azprGenerated.js`。
- 新增数据测试 `src/__tests__/data/azprGenerated.test.js`。

已生成数据：

| 数据域           |                          数量 | 输出文件                                       |
| ---------------- | ----------------------------: | ---------------------------------------------- |
| 属性枚举         |                           184 | `src/data/generated/attributes.json`           |
| 元素             |                            10 | `src/data/generated/elements.json`             |
| 角色             |                            20 | `src/data/generated/characters.json`           |
| 技能             |                           120 | `src/data/generated/skills.json`               |
| 敌人             |                           208 | `src/data/generated/enemies.json`              |
| 奇波             |                           122 | `src/data/generated/kibos.json`                |
| 装备             |                           137 | `src/data/generated/equipment.json`            |
| 灵子             |                            62 | `src/data/generated/soulessences.json`         |
| 图片索引         |                          3059 | `src/data/generated/media-index.json`          |
| 首条垂直切片快照 |                             1 | `src/data/generated/first-vertical-slice.json` |
| 工作台轻量数据   | 20 角色 / 120 技能 / 199 敌人 | `src/data/generated/workbench-seed.json`       |

当前校验结果：

- `skill-timing-missing`：120 个技能全部标记 `needsTimingData: true`，来源为 `missing-skill-asset-or-runtime-capture`。
- `enemy-property-missing`：9 个敌人的战斗 `propertyId` 暂未匹配到 `unit_property.json`。
- `enemy-world-property-missing`：172 个敌人的 `worldPropertyId` 暂未匹配；这是大世界属性映射缺口，不阻塞第一版战斗排轴数据。
- `non-azpr-placeholder-character`：通过，新生成角色不含钟离、甘雨、温迪等旧占位角色。

验收结果：

- `npm run data:generate`：通过。
- `npx vitest run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、3 条测试通过。
- `npm run test -- --run`：通过，7 个测试文件、40 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和 chunk 体积提示，暂不阻塞本阶段。

下一步：

- 阶段 2 目标：固定新版 `Project` / `Action` / `Actor` / `Enemy` schema，并为导入导出预留 `schemaVersion`。
- 阶段 3 前置目标：基于 `src/data/azprGenerated.js` 准备第一条垂直切片 fixture。
- 阶段 3 目标：建立 `src/simulation/` 最小编译与模拟链路，先支持一个真实角色、一个真实敌人、一个技能动作和基础伤害日志。

### 2026-07-07：阶段 2 最小领域模型落地

本轮完成：

- 新增 `src/domain/projectSchema.js`，定义最小新版项目契约：
  - `schemaVersion: 1`
  - `game: azur-promilia`
  - 内部时间单位 `ms`
  - `actors`
  - `enemy`
  - `actions`
  - `loadouts`
  - `metadata`
- 新增 `createProject()`、`createActorFromCharacter()`、`createEnemyFromData()`、`createSkillAction()`、`validateProject()`。
- 新增 `src/domain/fixtures/firstVerticalSlice.js`，用真实数据生成第一条垂直切片：
  - 角色：末音，`characterId = 109001`
  - 技能：哈库茵剑舞，`skillId = 10900101`
  - 敌人：迅狼，`enemyId = 300032`
- 新增 `src/__tests__/domain/projectSchema.test.js`，覆盖：
  - fixture 可通过 schema 校验。
  - 项目 JSON 往返后仍有效。
  - 未知 actor / skill 引用会被拒绝。
  - 技能动作保留 `needsTimingData` 时序缺口 warning。

验收结果：

- `npx vitest run src/__tests__/domain/projectSchema.test.js`：通过，1 个测试文件、4 条测试通过。
- `npm run test -- --run`：通过，8 个测试文件、44 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和 chunk 体积提示，暂不阻塞本阶段。

当前结论：

- 新版项目已经有可测试的最小 schema，不再只依赖旧 `project.actions` / `skillBlocks` 的隐式结构。
- 第一条真实数据垂直切片已经准备好，可作为阶段 3 模拟运行时输入。
- 精确技能时序仍按 `needsTimingData` 暴露，不在 schema 层伪造。

下一步：

- 阶段 3 目标：建立 `src/simulation/` 最小运行时。
- 先实现 `compileProject(project, gameData)`：把领域模型编译成 actor/enemy/action 场景。
- 再实现 `simulateScenario(scenario)`：输出基础事件日志、技能命中占位、冷却/SP 记录和总伤害框架。
- 投影层先输出 `damageTimeline`、`resourceTimeline`、`eventLog`、`summary`，后续再接 UI。

### 2026-07-07：阶段 3 最小模拟运行时落地

本轮完成：

- 新增 `src/simulation/compiler/compileProject.js`：
  - 校验新版 `Project`。
  - 解析 actor / enemy / skill 引用。
  - 将项目编译为运行时 `scenario`。
- 新增 `src/simulation/mechanics/damage.js`：
  - 解析技能等级倍率，例如 `649% -> 6.49`。
  - 读取角色基础攻击等属性。
  - 输出 `stage3-raw-attack-multiplier-v1` 原始伤害投影。
- 新增 `src/simulation/engine/simulateScenario.js`：
  - 输出 `SCENARIO_START`、`ACTION_START`、`TIMING_DATA_MISSING`、`DAMAGE_PROJECTED`、`SCENARIO_END` 等事件。
  - 对仍缺精确时序的技能动作标记 `timingAccuracy: placeholder`。
- 新增 `src/simulation/projection/projectSimulationResult.js`：
  - 输出 `damageTimeline`、`resourceTimeline`、`eventLog`、`summary`、`diagnostics`。
- 新增 `src/simulation/index.js`，提供 `compileProject()`、`simulateScenario()`、`runSimulation()` 单入口。
- 新增 `src/__tests__/simulation/firstVerticalSliceSimulation.test.js`，使用阶段 2 的真实数据 fixture 跑通 `compile -> simulate -> projection`。

验收结果：

- `npx vitest run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、3 条测试通过。
- `npm run test -- --run`：通过，9 个测试文件、47 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和 chunk 体积提示，暂不阻塞本阶段。

当前结论：

- 项目已经具备无 UI 的最小模拟链路。
- 当前伤害为“原始攻击 \* 技能倍率”的低置信度投影，只用于打通运行时结构，不代表最终 AzPr 精确公式。
- 技能命中帧、动作时长、取消窗口、最终防御/抗性/暴击/Buff/奇波/装备/灵子计算仍未完成，已通过 `diagnostics.limitations` 和 `TIMING_DATA_MISSING` 暴露。

下一步：

- 阶段 4 目标：建立新版编辑器骨架的第一屏，不再加厚旧 `Editor.vue`。
- 先新增一个轻量工作台入口，能读取第一条垂直切片并展示角色、敌人、动作、事件日志和 `damageTimeline`。
- 再把 ActionLibrary / TimelineGrid / PropertiesPanel / AnalysisPanel 拆成可替换组件，为后续真实交互打底。

### 2026-07-07：阶段 4 新版工作台第一屏落地

本轮完成：

- 新增路由 `/workbench` 和页面 `src/views/Workbench.vue`。
- 首页新增“新版工作台”入口。
- 新增 `src/features/workbench/` 分区组件：
  - `ScenarioHeader.vue`
  - `ActionLibraryPanel.vue`
  - `TimelineGridPreview.vue`
  - `AnalysisPanel.vue`
  - `EventLogPanel.vue`
- 工作台直接读取第一条真实数据垂直切片，运行 `compileProject()` / `simulateScenario()`，展示：
  - 场景概览。
  - 角色与动作。
  - 时间轴动作块。
  - 伤害投影 marker。
  - 原始伤害 summary。
  - 事件日志。
  - 当前计算限制。
- 数据生成器新增 `src/data/generated/first-vertical-slice.json`，避免工作台路由把全量敌人/角色/装备数据打进页面 chunk。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、1 条测试通过。
- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/domain/projectSchema.test.js`：通过，3 个测试文件、8 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、48 条测试通过。
- `npm run build`：通过；`Workbench` JS chunk 约 42.22 kB / gzip 11.84 kB。仍有旧 `Editor` 和全局包 chunk 体积提示，以及 Sass `@import` 弃用提示。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：页面非空，包含工作台、时间轴、伤害 marker、末音、迅狼、`DAMAGE_PROJECTED`，控制台无 error。

当前结论：

- 新版数据、领域模型、模拟运行时已经有可见工作台入口。
- 第一屏仍是只读垂直切片，不支持用户选择角色、拖拽动作或编辑属性。
- 旧 `Editor.vue` 仍未替换；阶段 4 后续应继续在新工作台内拆交互组件。

下一步：

- 阶段 4-2 目标：把只读工作台推进到最小可编辑。
- 新增可替换的 `PropertiesPanel`，支持编辑动作 `startMs`、`level`、`targetId` 并重新运行 simulation。
- 新增角色/技能/敌人选择入口，先从生成数据中选择真实条目，不回退到旧 `gamedata.json`。
- 时间轴预览增加动作选择状态，为后续拖拽和多动作轴做准备。

### 2026-07-07：阶段 4-2 工作台最小可编辑落地

本轮完成：

- 生成器新增 `src/data/generated/workbench-seed.json`：
  - 20 个真实角色。
  - 120 个真实技能。
  - 199 个带战斗属性的敌人。
  - 只保留工作台/运行时需要的轻量字段，避免首屏加载完整生成数据。
- 新增 `src/domain/workbenchProjectFactory.js`：
  - `createWorkbenchProject()`
  - `getWorkbenchGameData()`
  - `getSkillsForCharacter()`
  - `normalizeWorkbenchSelection()`
- 新增 `src/features/workbench/PropertiesPanel.vue`：
  - 角色选择。
  - 技能选择。
  - 敌人选择。
  - 动作开始时间编辑。
  - 技能等级编辑。
- `ActionLibraryPanel` 和 `TimelineGridPreview` 增加动作选择状态。
- `Workbench.vue` 改为根据当前选择和动作参数实时重建新版 `Project`，并重新运行 `compileProject()` / `simulateScenario()`。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、3 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、50 条测试通过。
- `npm run build`：通过；`Workbench` JS chunk 约 271.99 kB / gzip 30.29 kB。仍有旧 `Editor` 和全局包 chunk 体积提示，以及 Sass `@import` 弃用提示。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 等级改为 2 后倍率从 `649%` 更新到 `714%`。
  - 开始时间改为 `1200ms` / `1500ms` 后动作库和事件投影同步更新。
  - 敌人可切换到真实敌人“菜鸡”。
  - 角色可切换到真实角色“寒悠悠”，技能自动切到“鸢回影”。
  - 页面保留 `DAMAGE_PROJECTED` 和伤害 marker，控制台无 error。

当前结论：

- 新版工作台已经具备最小可编辑能力。
- 当前仍是单角色、单动作、单敌人的垂直切片。
- 属性面板修改会重建项目和模拟结果，但尚未支持在时间轴上拖拽、添加/删除动作、多角色队伍或导入导出新版项目。

下一步：

- 阶段 4-3 目标：让时间轴进入最小交互状态。
- 支持从 ActionLibrary 追加第二个动作。
- 支持删除动作和选择不同动作编辑。
- 支持在 TimelineGridPreview 中通过拖动或输入调整动作时间。
- 为多动作运行时结果增加基础排序和总伤害汇总测试。

### 2026-07-07：阶段 4-3 时间轴最小交互落地

本轮完成：

- `Workbench.vue` 从单动作 `actionPatch` 升级为多动作 `actionDrafts`，支持当前选中动作。
- `ActionLibraryPanel` 支持追加动作、选择动作和删除动作；删除时至少保留 1 个动作。
- `TimelineGridPreview` 支持点击或键盘选择时间轴动作块，并显示选中状态。
- `PropertiesPanel` 改为编辑当前选中动作的技能、开始时间和等级。
- `workbenchProjectFactory` 支持从动作草稿数组生成新版 `Project`，并为 actor 汇总多技能等级。
- 模拟链路增加多动作排序、命中数和总伤害汇总测试。
- `ScenarioHeader` 增加动作数和命中数的稳定测试标记，便于后续交互测试。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、53 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 初始为 1 个动作、1 次命中。
  - 点击“+ 动作”后变为 2 个动作、2 次命中。
  - 选中新增动作后开始时间可改为 `2400ms`，事件投影同步更新。
  - 删除第二个动作后回到 1 个动作、1 次命中。
  - 删除第一个动作后再次新增，动作 ID 保持递增为 `action-0002`、`action-0003`，未出现重复 key。
  - 控制台无 error。

当前结论：

- 新版工作台已从单动作垂直切片推进到多动作最小交互。
- 多动作排序和伤害汇总已经进入运行时测试。
- 当前动作时间仍主要靠数字输入，尚未实现时间轴拖拽、吸附、多轨和新版项目保存。

下一步：

- 阶段 4-4 目标：补齐时间轴编辑的基础手感和草稿持久化。
- 支持在 `TimelineGridPreview` 上拖动动作并按毫秒/网格吸附更新 `startMs`。
- 为动作块提供复制、快速删除和边界 clamp 的测试。
- 建立新版 workbench 项目草稿保存/恢复入口，优先保存到 localStorage，不接旧 `skillBlocks`。
- 继续保持 `compileProject()` / `simulateScenario()` 作为 UI 结果唯一来源。

### 2026-07-07：阶段 4-4A 时间轴拖动与吸附落地

本轮完成：

- `TimelineGridPreview` 增加动作块 pointer 拖动。
- 拖动时按时间轴宽度换算为 `startMs`，默认按 `500ms` 网格吸附。
- 拖动结果通过 `update-action-time` 事件回到 `Workbench.vue`，由动作草稿更新后重新生成新版 `Project` 并重新运行 simulation。
- 动作块增加稳定测试标记和 `data-action-id`，便于后续拖拽、复制、删除和多轨测试。
- 拖动边界按动作时长 clamp，避免动作块拖出当前 30s 时间轴。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、10 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、54 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 真实拖动第一段动作块后，开始时间从 `0` 更新为吸附后的 `3500`。
  - 属性面板、动作库文本和事件投影同步显示 `3500ms`。
  - 页面保留 `DAMAGE_PROJECTED`，控制台无 error。

当前结论：

- 新版工作台已经具备基础时间轴拖动手感。
- 当前拖动只支持水平移动动作起点，尚未支持复制、键盘移动、多轨、缩放、持续时间调整和保存恢复。

下一步：

- 阶段 4-4B 目标：建立新版 workbench 草稿保存/恢复入口。
- 保存字段应使用 `selection`、`actionDrafts`、`selectedActionId` 和版本号，不接旧 `skillBlocks`。
- 增加 localStorage 读写的容错、重置草稿入口和恢复测试。
- 草稿恢复后仍必须通过 `createWorkbenchProject()`、`compileProject()`、`simulateScenario()` 验证。

### 2026-07-07：阶段 4-4B workbench 草稿保存/恢复落地

本轮完成：

- 新增 `src/domain/workbenchDraftStorage.js`，定义新版 workbench 草稿 schema：
  - `schemaVersion: 1`
  - `game: azur-promilia`
  - `type: workbench-draft`
  - `selection`
  - `actionDrafts`
  - `selectedActionId`
  - `savedAt`
- `Workbench.vue` 顶部新增“保存草稿”和“重置”入口。
- 页面挂载时会从 `localStorage` 恢复新版草稿；草稿无效或版本不匹配时保持默认垂直切片。
- 保存内容只包含新版工作台状态，不写入旧 `skillBlocks`。
- 重置会清除草稿并恢复默认 `selection`、单动作草稿和默认选中动作。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、11 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、55 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 新增第二个动作并把开始时间改为 `2400ms` 后可保存草稿。
  - 刷新页面后自动恢复为 2 个动作，当前动作开始时间仍为 `2400`，状态为“已恢复草稿”。
  - 重置后回到 1 个动作、开始时间 `0`，状态为“已重置草稿”。
  - 页面保留 `DAMAGE_PROJECTED`，控制台无 error。

当前结论：

- 新版工作台已经具备“编辑 -> 保存 -> 刷新恢复 -> 重置”的最小项目草稿闭环。
- 草稿仍是 workbench 专用状态，还不是完整项目 JSON 导入导出格式。
- 旧 `Editor.vue` 的 localStorage 项目系统没有接入本阶段，避免把旧模型债务带入新版工作台。

下一步：

- 阶段 4-5 目标：提高时间轴基础编辑效率。
- 支持动作复制、快捷删除和键盘微调开始时间。
- 为保存按钮增加脏状态提示，区分“已保存”和“当前草稿有未保存改动”。
- 继续保持新版工作台只通过 `actionDrafts -> Project -> simulation` 输出结果。

### 2026-07-07：阶段 4-5 时间轴编辑效率落地

本轮完成：

- `ActionLibraryPanel` 增加动作复制按钮。
- 动作库卡片支持 `Delete` / `Backspace` 快捷删除。
- `TimelineGridPreview` 支持方向键微调动作开始时间：
  - 左右方向键按 `500ms` 移动。
  - `Shift + 左/右` 按 `2000ms` 移动。
  - 时间仍按动作边界 clamp，不越出当前时间轴。
- 时间轴动作块支持 `Delete` / `Backspace` 快捷删除。
- `Workbench.vue` 增加草稿脏状态：新增、复制、删除、拖动、键盘微调、属性修改、角色/敌人/技能修改都会显示“有未保存改动”；保存后显示“已保存草稿”。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、13 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、57 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 复制默认动作后得到 `action-0002`，动作数和命中数变为 2，复制动作开始时间为 `1000ms`。
  - 保存后状态为“已保存草稿”。
  - 方向键右移后开始时间变为 `1500ms`，状态变为“有未保存改动”。
  - `Shift + 左` 可大步回退到 `0ms`。
  - `Delete` 删除复制动作后回到 1 个动作、1 次命中。
  - 页面保留 `DAMAGE_PROJECTED`，应用控制台无 error。

当前结论：

- 新版工作台已经具备添加、复制、删除、拖动、键盘微调、属性编辑、保存和恢复的基础编辑闭环。
- 当前仍只有技能动作一种动作类型，尚未支持等待、注释、切人、敌人事件或多轨。
- 草稿脏状态是轻量提示，尚未做未保存离开拦截或自动保存。

下一步：

- 阶段 4-6 目标：扩展工作台动作类型和工具栏雏形。
- 先支持等待动作和注释动作，进入同一 `actionDrafts -> Project -> simulation` 链路。
- 让 ActionLibrary 从“技能动作列表”扩展为“动作工具箱”，为后续切人、敌人事件、资源事件留接口。
- 继续保持非技能动作在 simulation 中有明确事件日志和不伪造伤害。

### 2026-07-07：阶段 4-6 工作台动作类型和工具箱雏形落地

本轮完成：

- `src/domain/projectSchema.js` 增加 `createWaitAction()` 和 `createAnnotationAction()`，等待动作校验 `durationMs`，注释动作校验 `note`。
- `src/domain/workbenchProjectFactory.js` 扩展 `actionDrafts[]`，草稿现在保留 `type`、`durationMs` 和 `note`，并可生成技能、等待、注释三类新版 `Project.actions[]`。
- `ActionLibraryPanel` 从单一“+ 动作”扩展为动作工具箱，提供“+ 技能”“+ 等待”“+ 注释”三个入口。
- `PropertiesPanel` 支持非技能动作的类型展示、持续时间和备注编辑。
- `simulateScenario()` 对等待和注释动作输出 `WAIT` / `ANNOTATION` 事件，并跳过伤害、冷却、资源消耗和 `DAMAGE_SKIPPED`。
- `EventLogPanel` 增加等待和注释事件展示。
- 新增运行时和工作台测试，覆盖等待/注释不产生额外伤害投射。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、15 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、59 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 新增等待动作后动作数为 2，命中数仍为 1。
  - 将等待持续时间改为 `1500ms`、备注改为“等技能冷却”后，事件日志出现 `WAIT 1500ms / 等技能冷却`。
  - 新增注释动作后动作数为 3，命中数仍为 1。
  - 注释备注改为“准备爆发”后，事件日志出现 `ANNOTATION 准备爆发`。
  - 非技能动作没有产生 `DAMAGE_SKIPPED`，应用控制台无 error。
  - 验证结束后已重置 workbench 草稿。

当前结论：

- 新版工作台已具备最小动作工具箱，不再只有技能动作。
- 等待和注释已经进入统一项目模型与模拟事件日志，但不会被误算为伤害动作。
- 仍未支持切人、敌人事件、资源事件、多轨道或资源曲线。

下一步：

- 阶段 4-7 目标：补齐敌人与资源面板雏形。
- 新增 `EnemyPanel`，先展示/编辑敌人等级、生命/防御倍率等最小场景参数，并继续通过 `Project -> simulation` 生效。
- 新增 `ResourceMonitor` 雏形，先读取 `simulationResult.resourceTimeline` 和诊断信息，不在 UI 中自行编造资源计算。
- 为后续资源事件、敌人事件和 Boss 机制动作预留 action 类型入口与测试。

### 2026-07-07：阶段 4-7 敌人与资源面板雏形落地

本轮完成：

- 新增 `src/features/workbench/EnemyPanel.vue`：
  - 展示当前模拟场景中的敌人名称、等级、生命/防御基础值和倍率。
  - 支持编辑敌人等级、生命倍率、防御倍率。
  - 改动通过 `enemyConfig -> createWorkbenchProject() -> compileProject() -> simulateScenario()` 生效。
- 新增 `src/features/workbench/ResourceMonitorPanel.vue`：
  - 只读取 `simulationResult.resourceTimeline`、`summary` 和 `diagnostics`。
  - 展示资源事件数、SP 净变化、命中数和运行限制数量。
  - 无资源事件时显示空状态，不从 UI 侧自行推算资源。
- `src/domain/workbenchProjectFactory.js` 增加 `DEFAULT_WORKBENCH_ENEMY_CONFIG` 和 `normalizeWorkbenchEnemyConfig()`。
- `src/domain/workbenchDraftStorage.js` 将 `enemyConfig` 纳入 workbench 草稿保存/恢复/重置。
- `projectSimulationResult()` 在 `scenario` 中输出敌人等级与倍率，并在 `summary` 中输出 `resourceEventCount`。
- `EventLogPanel` 补齐 `RESOURCE_CHANGE` 日志格式，显示资源、变化量和原因。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、17 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、61 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 敌人等级可改为 `Lv.95`，生命倍率可改为 `2`，防御倍率可改为 `1.5`。
  - 切换到真实 SP 消耗技能“沐星雨”后，资源面板显示 1 个资源事件和 `SP -100`。
  - 事件日志显示 `RESOURCE_CHANGE SP -100 / skill-cost`。
  - 验证结束后已重置 workbench 草稿，应用控制台无 error。

当前结论：

- 新版工作台已经有敌人参数面板和资源投影面板。
- 敌人参数已经进入新版项目模型和模拟场景，不再只是 UI 状态。
- 资源面板当前只展示技能 SP 消耗带来的运行时事件；尚未支持用户手动插入资源事件动作。

下一步：

- 阶段 4-8 目标：接入资源事件和敌人事件动作。
- 先实现 `resource` 动作草稿、项目 action、运行时 `RESOURCE_CHANGE` 事件和属性面板编辑。
- 再实现 `enemyEvent` 动作的最小日志事件，为 Boss 机制/阶段转换/可攻击窗口预留结构。
- 保持事件动作不投射伤害，所有资源变化必须从 simulation 事件进入 `resourceTimeline`。

### 2026-07-07：阶段 4-8 资源事件和敌人事件动作落地

本轮完成：

- `src/domain/projectSchema.js` 增加：
  - `createResourceAction()`：生成 `resource` 动作，字段包含 `resource`、`change`、`reason`、`note`。
  - `createEnemyEventAction()`：生成 `enemyEvent` 动作，字段包含 `eventType`、`note`。
  - schema 校验补齐 `resource`、`change`、`reason`、`eventType`。
- `src/domain/workbenchProjectFactory.js` 让 `actionDrafts[]` 保留并生成 `resource` / `enemyEvent` 新版项目动作。
- `simulateScenario()` 对资源动作输出 `RESOURCE_CHANGE`，并把它纳入 `resourceTimeline`；对敌人动作输出 `ENEMY_EVENT`。
- `ActionLibraryPanel` 工具箱新增“+ 资源”“+ 敌人”。
- `PropertiesPanel` 支持编辑：
  - 资源动作：资源名、变化量、原因、备注。
  - 敌人事件：事件类型、备注。
- `EventLogPanel` 支持 `ENEMY_EVENT` 展示，并保持 `RESOURCE_CHANGE` 显示资源变化详情。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、19 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、63 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 新增资源动作后，资源面板显示 1 个事件和 `SP -35`。
  - 事件日志显示 `RESOURCE_CHANGE SP -35 / manual-test`。
  - 新增敌人事件后，事件日志显示 `ENEMY_EVENT phase-2 / 进入二阶段`。
  - 动作数为 3，命中数仍为 1，没有产生 `DAMAGE_SKIPPED`。
  - 验证结束后已重置 workbench 草稿，应用控制台无 error。

当前结论：

- 新版工作台动作工具箱已覆盖技能、等待、注释、资源事件、敌人事件。
- 资源变化已经由 simulation 事件驱动资源面板，不再需要 UI 侧补算。
- 敌人事件目前是日志型事件，还没有影响敌人状态、可攻击窗口或 Boss 机制。
- `switch` 切人动作仍只是 `ACTION_TYPES` 预留，尚未接入多角色 actor 模型。

下一步：

- 阶段 4-9 目标：建立切人动作和多角色 actor 雏形。
- 先让 workbench 选择第二个真实角色，并在 `createWorkbenchProject()` 中生成多个 actors。
- 接入 `switch` 动作草稿、项目 action、运行时 `SWITCH` 事件和属性面板编辑。
- 切人动作先作为非伤害事件，不直接改变伤害公式；后续再接入当前前台角色、队伍资源和多轨显示。

### 2026-07-07：阶段 4-9 切人动作和多角色 actor 雏形落地

本轮完成：

- `src/domain/projectSchema.js` 增加 `createSwitchAction()`，`switch` 动作字段包含 `actorId`、`targetActorId`、`targetCharacterId`、`durationMs`、`note`，schema 校验会确认来源 actor 和目标 actor 都存在。
- `src/domain/workbenchProjectFactory.js` 支持 `selection.secondaryCharacterId`，默认以末音为主角色、寒悠悠为副角色生成两个真实 actor，并把技能等级按角色归集。
- `actionDrafts[]` 保留 `targetCharacterId`，切人动作会在生成新版 `Project.actions[]` 时解析为 `targetActorId`。
- `compileProject()` 为 `switch` 动作补齐来源 actor 和目标 actor；`simulateScenario()` 输出 `SWITCH` 事件，不投射伤害、不制造 `DAMAGE_SKIPPED`。
- `ActionLibraryPanel` 工具箱新增“+ 切人”。
- `PropertiesPanel` 新增副角色选择和切人目标选择；副角色变化后，当前切人动作目标会同步更新。
- `EventLogPanel` 支持显示 `SWITCH`，格式为 `来源角色 -> 目标角色`。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、21 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、65 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 初始工作台显示 `2 actor`，默认副角色为寒悠悠。
  - 新增切人动作后动作数为 2，命中数仍为 1。
  - 事件日志显示 `SWITCH` 和 `末音 -> 寒悠悠`，没有产生 `DAMAGE_SKIPPED`。
  - 将副角色改为芃芃后，切人目标同步变为芃芃，事件日志显示 `末音 -> 芃芃`。
  - 验证结束后已重置 workbench 草稿，应用控制台无 error。

当前结论：

- 新版工作台已经从单 actor 垂直切片推进到主/副角色双 actor 雏形。
- 切人动作已进入统一 `actionDrafts -> Project -> Scenario -> EventLog` 链路。
- 当前切人仍是日志型非伤害动作，还没有改变当前前台角色、队伍共享资源、Buff 归属或后续技能 actor 归属。
- 时间轴仍是单轨显示，多角色动作只靠动作文本和事件日志区分。

下一步：

- 阶段 4-10 目标：建立多轨道/角色轨道显示雏形。
- 先让 `TimelineGridPreview` 按 actor 或动作归属显示角色轨道，让技能动作、切人动作和事件动作在时间轴上更容易区分。
- 为轨道渲染补充测试，确保多 actor 项目不会退化成不可读的单行堆叠。
- 继续保持切人不直接改变伤害公式；前台角色状态、队伍资源和 Buff 归属放到后续机制阶段处理。

### 2026-07-07：阶段 4-10 多轨道/角色轨道显示雏形落地

本轮完成：

- `TimelineGridPreview` 新增 `actors` 输入，按 `scenario.actors[]` 渲染角色轨道。
- 时间轴动作会按 `action.actor` / `action.actorId` 归入对应 actor 轨道；无 actor 的注释、敌人事件等动作进入 `system` 系统轨。
- 伤害投影 marker 会根据 `damage.actorId` 或对应 action 归入同一角色轨道，不再漂在单独固定行。
- 切人动作在主角色轨显示为 `切人 -> 目标角色`，但仍保持非伤害事件，不改变后续技能归属。
- 时间轴新增稳定测试标记：
  - `workbench-timeline-row`
  - `workbench-timeline-lane-label`
  - `workbench-timeline-action[data-lane-id]`
  - `workbench-timeline-damage-marker[data-lane-id]`
- 轨道视觉样式区分角色轨、系统轨、切人/资源/事件类动作，为后续缩放、持续时间调整和多轨拖拽打底。

验收结果：

- `npm run test -- --run`：通过，10 个测试文件、66 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- 浏览器检查 `http://127.0.0.1:5175/#/workbench`：
  - 初始时间轴显示 `actor-109001` 末音轨和 `actor-101003` 寒悠悠轨。
  - 默认技能动作和伤害 marker 都位于 `actor-109001`。
  - 新增切人动作后，切人块位于 `actor-109001`，文本显示 `切人 -> 寒悠悠`，命中数仍为 1。
  - 新增注释动作后出现 `system` 系统轨，注释动作位于系统轨。
  - 重置后系统轨消失，回到两条角色轨，应用控制台无 error。

当前结论：

- 新版工作台时间轴已经从单行动作堆叠推进到角色轨道雏形。
- 多 actor 项目现在能在时间轴上表达角色归属；无角色事件不会污染角色轨。
- 当前轨道只是显示分层，尚未支持轨道内碰撞规避、跨轨拖拽改变 actor、缩放视口或拖拽调整动作持续时间。

下一步：

- 阶段 4-11 目标：建立时间轴缩放和动作持续时间调整雏形。
- 先增加时间轴缩放/视窗比例状态，让 30s 轴可以从固定全览走向可横向细看。
- 再为可持续动作增加拖拽调整 `durationMs` 的最小手柄，并保持边界 clamp 和测试覆盖。
- 继续只通过 `actionDrafts -> Project -> simulation` 更新结果，不在时间轴组件内直接改业务事实。

### 2026-07-07：阶段 4-11 时间轴缩放和动作持续时间调整雏形落地

本轮完成：

- `TimelineGridPreview` 新增 1x-4x 缩放状态和紧凑缩放控件。
- 时间刻度轨和动作轨共用同一 `timelineTrackStyle`，缩放后宽度同步变化，例如 2x 时轨道宽度为 `200%`。
- 时间轴轨道区域支持横向溢出，为后续局部细看、水平滚动和更长排轴做准备。
- 动作块右侧新增持续时间手柄，可拖拽调整 `durationMs`。
- 新增 `update-action-duration` 事件，由 `Workbench.vue` 回写 `actionDrafts[]`，再重新生成 `Project -> Scenario -> simulation`。
- 持续时间调整按 `snapMs` 吸附，并按 `project.time.durationMs - action.startMs` 做边界 clamp。
- 动作块宽度最大值放开到 100%，避免长持续时间动作被旧 42% 上限截断。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、23 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、67 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。
- 应用内浏览器交互验证尝试执行缩放和持续时间操作时，浏览器控制层连续超时并重置；本阶段未把该工具超时记为页面通过证据。缩放、手柄拖拽、持续时间更新和草稿脏状态已由新增组件测试覆盖。

当前结论：

- 新版工作台时间轴已经具备最小缩放视图和拖拽持续时间能力。
- 缩放和持续时间调整仍是组件内最小实现，尚未持久化到草稿，也没有做横向滚动位置保存。
- 当前仍未做轨道内重叠检测、动作碰撞提示、跨轨拖拽改变 actor 或动作持续时间与真实技能帧数据的关联。

下一步：

- 阶段 4-12 目标：建立轨道内重叠检测和时间轴诊断雏形。
- 在 `scenario.actions[]` 投影层或工作台层计算同一轨道内动作时间范围重叠。
- 在时间轴动作块和分析/诊断区域显示基础重叠告警，避免缩放和持续时间调整后用户看不到冲突。
- 保持诊断是 UI/投影层提示，不先改战斗公式或动作合法性 hard fail。

### 2026-07-07：阶段 4-12 轨道内重叠检测和时间轴诊断雏形落地

本轮完成：

- 新增 `src/features/workbench/timelineDiagnostics.js`，从 `scenario.actors[]` 和 `scenario.actions[]` 生成时间轴诊断投影。
- 诊断投影会按当前角色轨/系统轨解析动作归属，并计算同一轨道内动作时间范围重叠。
- `TimelineGridPreview` 接入 `timelineDiagnostics`，重叠动作块会显示红色重叠态和“重叠”标记。
- `AnalysisPanel` 新增“时间轴诊断”区域，展示轨道重叠数量、轨道名、冲突动作名和重叠区间。
- `Workbench.vue` 继续只负责串联 `Project -> Scenario -> simulation -> timelineDiagnostics`，没有把重叠判定写成战斗合法性 hard fail。
- 新增工作台测试，覆盖同一角色轨两个技能动作从 `500ms` 到 `1000ms` 的重叠告警。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、24 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、68 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。
- 本阶段未使用应用内浏览器交互验证作为通过证据；上一阶段记录的浏览器控制层超时问题仍按工具侧限制看待。

当前结论：

- 新版工作台已经能在用户调整动作开始时间或持续时间后提示同轨道时间冲突。
- 重叠诊断目前是 UI/投影层提示，不阻止保存、模拟或草稿编辑。
- 当前重叠检测只按动作起止区间判断，没有做动作优先级、取消窗口、跨轨拖拽改 actor 或真实技能帧语义。

下一步：

- 阶段 4-13 目标：建立跨轨拖拽改变动作归属的最小闭环。
- 先允许有 `actorId` 的动作在角色轨之间拖拽，并由 `Workbench.vue` 回写动作归属或对应角色选择。
- 对系统轨动作保持只读归属，避免注释/敌人事件被误拖成角色技能。
- 为跨轨拖拽补充测试，并继续保持运行时和战斗公式不因 UI 拖拽而隐式篡改。

### 2026-07-07：阶段 4-13 跨轨拖拽改变动作归属雏形落地

本轮完成：

- `actionDrafts[]` 新增轻量 `actorCharacterId` 字段，用于记录动作归属角色，并进入 workbench 草稿保存/恢复。
- `createWorkbenchProject()` 生成项目动作时会按 `actorCharacterId` 解析来源 actor；技能、切人和资源动作可投射到对应角色轨。
- 切人动作如果被拖到原目标角色轨，会自动选择另一个 actor 作为切人目标，避免来源和目标角色相同。
- `TimelineGridPreview` 支持在拖拽结束时识别落点角色轨，并通过 `update-action-lane` 回传目标轨道。
- 角色轨在拖拽经过时有最小落点高亮；系统轨事件不会被作为可变更归属动作处理。
- `Workbench.vue` 接收跨轨拖拽后只回写技能、切人、资源动作的 `actorCharacterId`；注释、等待、敌人事件仍保持系统/非 actor 归属。
- 新增工作台测试，覆盖资源动作从末音轨拖到寒悠悠轨后保存 `actorCharacterId: 101003`，以及注释动作拖向角色轨后仍留在系统轨。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、25 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、69 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 新版工作台时间轴已经具备最小跨角色轨拖拽归属能力。
- 动作归属现在可以持久化到草稿，不再只由主角色或技能来源隐式决定。
- 当前仍没有在属性面板显式展示/编辑动作归属；技能下拉也仍主要跟随主角色选择，跨轨后的技能来源关系还不够透明。

下一步：

- 阶段 4-14 目标：建立多角色动作归属和技能选择的属性面板雏形。
- 在属性面板显示当前动作归属角色，并允许对可归属动作直接选择归属角色。
- 技能动作的技能选择需要和动作归属角色关系更清晰：先按归属角色过滤或标记跨角色技能状态，避免跨轨拖拽后用户看不出技能/角色来源。
- 继续保持归属变化通过 `actionDrafts -> Project -> Scenario -> simulation` 生效，不在 UI 层硬改战斗公式。

### 2026-07-07：阶段 4-14 多角色动作归属和技能选择属性面板雏形落地

本轮完成：

- `PropertiesPanel` 新增“动作归属”控件：
  - 技能、切人、资源动作可直接选择归属角色。
  - 等待、注释、敌人事件显示只读“系统 / 事件轨”。
- 技能下拉改为按当前动作归属角色过滤，不再只跟随主角色技能列表。
- `Workbench.vue` 在技能动作归属变化时会自动切到目标角色的首个可用技能，并重置等级，避免角色和技能来源不一致。
- 跨轨拖拽改变技能动作归属时，也会同步切换到目标角色技能，保持时间轴、属性面板和模拟投影一致。
- `normalizeWorkbenchActionDrafts()` 改为按每个动作的 `actorCharacterId` 归一化技能，避免副角色归属动作保存/恢复后被主角色技能覆盖。
- 切人动作目标下拉改为显示当前队伍中除来源角色外的角色，为后续多 actor 扩展打底。
- 新增工作台测试，覆盖属性面板切换动作归属、技能下拉过滤、时间轴/伤害 marker 改轨、草稿保存和系统轨只读归属。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、26 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、70 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 多角色动作归属现在既能从时间轴拖拽修改，也能从属性面板直接修改。
- 技能动作的角色/技能来源关系更透明，草稿归一化也能保留副角色动作。
- 当前动作库仍以主角色上下文为主，新增技能动作默认归属策略不够直观；还没有像 Endaxis 那样在动作库中按队伍角色组织技能入口。

下一步：

- 阶段 4-15 目标：建立动作库角色上下文和新增动作归属策略雏形。
- 让动作库能在主/副角色之间切换或显示队伍角色入口，新增技能动作应按当前动作库角色生成归属和技能。
- 复制/新增动作时尽量继承当前选中动作的归属上下文，避免用户跨轨编辑后新增动作又回到主角色。
- 继续保持新增动作进入 `actionDrafts -> Project -> Scenario -> simulation`，不让动作库直接写运行时事实。

### 2026-07-07：阶段 4-15 动作库角色上下文和新增动作归属策略雏形落地

本轮完成：

- `ActionLibraryPanel` 新增队伍角色切换条，当前动作库角色可在末音/寒悠悠等 actor 之间切换。
- 动作库顶部当前角色展示会跟随所选角色上下文，不再固定显示主角色。
- 新增技能动作会按当前动作库角色选择 `actorCharacterId` 和该角色首个可用技能。
- 新增切人和资源动作会按当前动作库角色生成来源 actor；切人目标自动选择队伍中另一个 actor。
- 复制动作会继承源动作归属，并同步动作库角色上下文。
- 从动作库或时间轴选择已有技能/切人/资源动作时，动作库角色上下文会跟随该动作归属；删除当前动作后也会同步到新的选中动作。
- 新增工作台测试，覆盖切换动作库角色、新增副角色技能动作、复制副角色动作、选择主角色动作后上下文回到主角色，以及草稿保存后的归属/技能字段。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、27 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、71 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 新版工作台已经有最小“动作库角色上下文 -> 新增动作归属 -> 草稿保存 -> 时间轴投影”闭环。
- 新增和复制动作不再总是回到主角色，跨角色排轴编辑的摩擦明显降低。
- 当前动作库仍只有通用“+ 技能”按钮，没有展示当前角色的具体技能入口；用户仍需要新增后再到属性面板选择技能。

下一步：

- 阶段 4-16 目标：建立动作库技能入口雏形。
- 在动作库中按当前角色展示真实技能列表，允许直接从某个技能生成动作。
- 新增技能动作应保留所选技能、归属角色、默认等级和合理开始时间，并继续进入 `actionDrafts -> Project -> Scenario -> simulation`。
- 为技能入口补充测试，覆盖不同角色动作库上下文下的技能新增和时间轴归属。

### 2026-07-07：阶段 4-16 动作库技能入口雏形落地

本轮完成：

- `ActionLibraryPanel` 在当前动作库角色下展示真实技能列表，技能入口来自 `workbench-seed.json` 的角色技能数据。
- 每个技能入口显示技能名、冷却和 SP 信息；缺少技能名的真实数据会回退显示 `技能 {id}`，避免空白按钮。
- 新增 `add-skill-action` 事件，允许直接从某个技能生成动作，而不是先点通用“+ 技能”再到属性面板改技能。
- `Workbench.vue` 新增 `actionLibrarySkills` 和 `addSkillAction()`，按当前动作库角色生成指定技能动作，保留 `actorCharacterId`、`skillId`、默认等级和合理开始时间。
- 通用“+ 技能”继续可用，并复用同一套技能新增逻辑。
- 新增工作台测试，覆盖主/副角色技能入口列表、点击副角色指定技能后进入副角色轨、属性面板技能值同步、草稿保存 `actorCharacterId` / `skillId` / `level`。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、28 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、72 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 动作库已经从“按角色新增默认技能”推进到“按角色直接选择具体技能新增动作”。
- 当前技能入口可以把真实技能、动作归属、时间轴轨道、属性面板和草稿保存串成闭环。
- 新增动作的开始时间仍沿用最后一个动作之后固定偏移，尚未根据当前选中动作、轨道冲突或局部插入位置做更细策略。

下一步：

- 阶段 4-17 目标：统一新增动作插入位置策略雏形。
- 基于当前选中动作和动作库角色计算插入时间，优先插入当前动作之后，而不是所有新增动作都依赖全局最后动作。
- 让技能、等待、切人、资源、注释和敌人事件复用同一套插入时间 helper，继续保留边界 clamp 和最小间隔。
- 为插入策略补充测试，覆盖多角色/系统动作混排下新增动作的时间、顺序和轨道归属。

### 2026-07-07：阶段 4-17 统一新增动作插入位置策略雏形落地

本轮完成：

- `Workbench.vue` 新增 `NEW_ACTION_INSERT_GAP_MS`、`addInsertedAction()`、`resolveInsertStartMs()` 和 `resolveInsertIndex()`。
- 新增技能、等待、切人、资源、注释和敌人事件动作统一通过 `addInsertedAction()` 写入 `actionDrafts[]`。
- 新增动作现在插入到当前选中动作之后，不再全部追加到全局最后动作之后。
- 新增动作开始时间改为“插入锚点 `startMs + durationMs + 1000ms`”，并继续按项目总时长做边界 clamp。
- 动作库角色仍决定技能、切人和资源动作的 `actorCharacterId`；插入顺序则跟随当前选中动作，方便在已有排轴中间补动作。
- 新增工作台测试，覆盖副角色技能动作作为全局尾部时，回选第一个动作新增系统注释会插入到第一个动作之后，草稿顺序为 `action-0001 -> action-0003 -> action-0002`，且系统轨和副角色轨归属保持正确。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、29 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、73 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 新增动作已经从“永远追加到最后”推进到“围绕当前选中动作局部插入”。
- 六类新增动作共用同一套插入时间和插入顺序逻辑，后续优化不用逐个按钮重复改。
- 当前插入策略仍只做最小间隔和边界 clamp，不会主动查找同轨空位，也不会自动避开已存在的同轨重叠。

下一步：

- 阶段 4-18 目标：建立插入位置冲突感知和同轨空位推荐雏形。
- 基于当前新增动作的目标轨道，检查候选开始时间是否与同轨动作重叠。
- 在不 hard fail 的前提下，优先把新增动作推到同轨下一个可用空位；如果仍有冲突，则复用时间轴诊断显示告警。
- 为同轨冲突、跨轨同时间允许、系统轨事件插入三类场景补充测试。

### 2026-07-07：阶段 4-18 插入位置冲突感知和同轨空位推荐雏形落地

本轮完成：

- `Workbench.vue` 新增草稿层轨道判断和动作范围计算，用于在新增动作生成前识别目标轨道。
- `addInsertedAction()` 会先生成候选动作，再调用 `resolveInsertPlacement()` 计算推荐开始时间和推荐插入位置。
- 当候选开始时间与同轨已有动作重叠时，会按 `已有动作 endMs + 1000ms` 向后推，并把列表插入位置同步移动到被避开的同轨动作之后。
- 跨轨动作允许共享同一个开始时间，不会因为其他角色轨道存在动作而被推迟。
- 系统轨事件也纳入同轨空位推荐，注释、等待、敌人事件等系统动作会避开已有系统轨动作。
- 新增工作台测试覆盖：
  - 同一角色轨动作冲突时，新技能从 `2000ms` 推到 `4000ms`。
  - 副角色轨动作可与主角色轨动作同在 `2000ms`。
  - 系统轨注释占用 `2000-2600ms` 后，敌人事件会推到 `3600ms`。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、31 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、75 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 新增动作已经具备最小同轨避让能力，不再轻易在同一角色轨或系统轨上直接叠到已有动作上。
- 同轨避让仍是草稿层最小策略：它只基于 `startMs/durationMs` 范围判断，不理解真实技能前后摇、取消窗口、霸体窗口或 Endaxis 那类细粒度动作帧。
- 目前用户只能看到最终动作被放到新的时间点，还看不到“因为同轨冲突而自动推迟”的明确反馈。

下一步：

- 阶段 4-19 目标：建立插入策略反馈和自动推迟提示雏形。
- 当新增动作因同轨冲突被自动推迟时，在动作 note、时间轴提示或分析面板诊断中给出轻量反馈。
- 区分“跨轨同时间允许”和“同轨自动推迟”，避免用户误以为按钮失灵或时间随机变化。
- 为自动推迟提示补充测试，并继续保持提示不成为保存或模拟的 hard fail。

### 2026-07-07：阶段 4-19 插入策略反馈和自动推迟提示雏形落地

本轮完成：

- `actionDrafts[]` 新增结构化 `insertion` 元信息，用于记录自动推迟结果：
  - `autoDelayed`
  - `requestedStartMs`
  - `resolvedStartMs`
  - `delayedByMs`
  - `laneId`
  - `reason`
  - `conflictActionIds`
- `workbenchProjectFactory` 和 `projectSchema` 透传 `insertion`，让草稿、项目动作、编译后的 scenario action 和 UI 使用同一份插入事实。
- 当新增动作因同轨冲突被自动推迟时，会在动作 `note` 中追加中文提示，例如 `自动推迟：同轨已有动作占用，已从 2000ms 调整到 4000ms。`
- `TimelineGridPreview` 为自动推迟动作显示“推迟”徽标，并在图例中新增“自动推迟”说明。
- `ActionLibraryPanel` 在动作卡片中显示自动推迟时间提示，例如 `自动推迟 2000ms -> 4000ms`。
- `AnalysisPanel` 新增“插入提示”诊断区，显示自动推迟数量、动作名、轨道名和时间调整范围。
- 工作台测试补充断言：
  - 跨轨同时间新增保持 `workbench-insert-delay-count = 0`，不会误标为推迟。
  - 同轨技能自动推迟后，备注、时间轴徽标、动作库提示、分析面板和保存草稿中的 `insertion` 元信息一致。
  - 系统轨敌人事件自动推迟后，也会显示系统轨插入提示并保存结构化元信息。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、31 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、75 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 用户现在能明确看到动作是否因同轨冲突被自动推迟，以及从哪个候选时间调整到哪个落点。
- 自动推迟信息已经不只是普通文案，而是可保存、可编译、可被多个 UI 面板读取的结构化元信息。
- 当前自动推迟标记还没有生命周期管理：如果用户之后手动修改开始时间、持续时间或轨道，旧的 `insertion` 提示可能变成过期信息。

下一步：

- 阶段 4-20 目标：建立自动推迟标记生命周期和手动编辑清理雏形。
- 当用户手动改开始时间、持续时间、动作归属或跨轨拖拽时，清理或重算旧的 `insertion` 元信息，避免过期提示误导。
- 保留用户手写备注，尽量只移除系统自动追加的推迟提示行。
- 为手动改时间、改轨道、改备注后的保存结果补充测试。

### 2026-07-07：阶段 4-20 自动推迟标记生命周期和手动编辑清理雏形落地

本轮完成：

- `Workbench.vue` 新增 `applyInsertionLifecyclePatch()`、`clearInsertionForManualEdit()` 和 `stripAutoDelayNote()`。
- 当用户手动修改动作开始时间、持续时间或动作归属时，会清理旧 `insertion` 元信息，避免旧自动推迟提示继续显示。
- 当用户通过时间轴拖动改变开始时间、拖拽持续时间或跨轨拖拽改变归属时，也会清理旧自动推迟标记。
- 手动编辑备注时会移除系统自动追加的 `自动推迟：...` 行，但保留用户手写备注；如果只是改备注，结构化 `insertion` 仍保留，因为动作落点事实未改变。
- 复制带自动推迟标记的动作时，会移除旧自动推迟备注行和 `insertion`，避免复制出的动作继承过期解释。
- 新增工作台测试覆盖：
  - 手动改备注只移除系统自动推迟行，保留用户备注和结构化插入事实。
  - 手动改开始时间后，自动推迟计数、时间轴徽标、动作库提示和保存草稿中的 `insertion` 均清空。
  - 手动改持续时间后，系统轨自动推迟提示被清空，并保留原本的用户/默认备注。
  - 跨轨拖拽被自动推迟的技能动作后，旧 `insertion` 被清空，动作保存到新的 actor 轨道。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、35 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、79 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；命令通道仍偶发 `Import-Clixml` / `InvalidOperation` 噪声，但主命令无 diff check 错误。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 自动推迟提示已经有最小生命周期，不会在用户手动改时间、改时长或改轨道后继续误导。
- 自动推迟系统行和用户备注已经能区分处理，用户手写备注不会被粗暴清空。
- 当前技能动作仍默认使用第一个伤害段，属性面板还不能选择具体倍率段；这会限制真实排轴对技能多段/派生段的表达。

下一步：

- 阶段 4-21 目标：建立技能伤害段/倍率段选择雏形。
- 在技能动作属性面板展示当前技能解析出的 `damageSegments`，允许选择某一段作为本动作的伤害投影来源。
- 将所选伤害段保存到 `actionDrafts`，并继续通过 `Project -> Scenario -> simulation` 影响 `selectedDamageSegment` 和伤害投影。
- 明确该阶段只处理“倍率段选择”，不把描述解析出的段落当成真实命中帧或取消窗口。

### 2026-07-07：阶段 4-21 技能伤害段/倍率段选择雏形落地

本轮完成：

- `Project` 技能动作和 `workbench` 动作草稿新增 `damageSegmentIndex` 字段，默认 `0`。
- `workbenchProjectFactory` 会保存、归一化并透传 `damageSegmentIndex`；索引超出当前技能等级可用段数时会 clamp 到有效范围。
- `compileProject()` 会根据 `damageSegmentIndex` 从 `damageSegments[]` 中选择 `selectedDamageSegment`，模拟投影不再固定使用第一个倍率段。
- `PropertiesPanel` 在技能动作下新增“伤害段”下拉，选项来自当前技能解析出的 `damageSegments`，显示为 `段名 / 倍率`。
- 切换技能或跨轨导致技能来源变化时，`damageSegmentIndex` 会重置为 `0`，避免继承旧技能的无效段索引。
- `selectedActionSummary`、动作库倍率显示和分析面板伤害段会跟随所选倍率段更新。
- `DATA_STRUCTURE_CHANGES.md` 新增 `damageSegmentIndex` 字段说明，明确它只代表倍率段选择，不代表真实命中帧或取消窗口。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、37 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、81 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；命令通道仍偶发 `Import-Clixml` 噪声，但主命令无 diff check 错误。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 技能动作已经可以表达“同一个技能取哪个倍率段”这一层需求，末音 `哈库茵剑舞` 可从默认 `普攻 / 649%` 切到 `重击 / 190%` 并影响模拟结果。
- 该能力仍是低置信度倍率投影，不等价于真实多段命中帧、动作时长、前后摇或取消窗口。
- 多段技能目前仍需要用户手动新增多个动作并逐个选择倍率段，尚未提供“从技能段批量生成动作”的效率入口。

下一步：

- 阶段 4-22 目标：建立技能段动作拆分/多段动作生成雏形。
- 在动作库或属性面板提供从当前技能 `damageSegments[]` 批量生成多个技能动作的入口，每个动作保存对应 `damageSegmentIndex`。
- 生成结果继续使用同轨空位推荐和自动推迟提示，不把描述解析段当作真实命中帧。
- 为多段生成补充测试，覆盖动作数量、段索引、时间排序、草稿保存和模拟投影。

### 2026-07-07：阶段 4-22 技能段动作拆分/多段动作生成雏形落地

本轮完成：

- `workbenchProjectFactory` 新增 `getSkillDamageSegments(skill, level)`，按技能等级表解析可用倍率段，并让 `damageSegmentIndex` clamp 使用同一套可解析段口径。
- `ActionLibraryPanel` 的技能条目拆成“新增技能动作”和“拆段”两个入口；“拆段”会显示当前技能可解析段数，只有多段技能可用。
- `Workbench.vue` 新增 `addSkillSegmentActions()`：按当前动作库角色、可继承等级和当前技能倍率段，批量生成多个技能动作。
- 每个拆分动作会保存对应 `damageSegmentIndex`，并写入 `倍率段拆分：段名 / 倍率；非真实命中帧。` 备注，明确当前仍是倍率投影而非真实 hit frame。
- 批量生成继续复用 `addInsertedAction()`，因此会继承“插入到选中动作后方”、同轨空位推荐、自动推迟提示和结构化 `insertion` 元信息。
- 动作库技能动作详情从单纯显示倍率改为显示 `段名 / 倍率`，拆分后能直接分辨 `普攻 / 重击 / 闪击 / 跃击` 等段落。
- 新增工作台测试覆盖：从动作库拆分 `哈库茵剑舞` 的 4 个倍率段、保留同轨自动推迟、保存 `damageSegmentIndex`、保存时间排序和非真实命中帧备注。
- 新增模拟测试覆盖：多个 `damageSegmentIndex` 技能动作会分别投影为对应的 `damageTimeline` 伤害段。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、39 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、83 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 工作台现在能从同一个技能的等级倍率表一次性生成多条技能动作，并把每条动作绑定到对应倍率段。
- 生成动作已经能吃到现有插入策略：如果目标轨道已有动作占用，第一条拆分动作会自动推迟并保留结构化原因。
- 目前拆段仍使用固定动作时长与现有插入间隔；它提高了编辑效率，但还不是从真实动画帧、命中帧或取消窗口生成的轴。

下一步：

- 阶段 4-23 目标：建立技能段批量生成的间隔/落点策略雏形。
- 为“拆段”生成增加最小配置能力，例如段间间隔、是否从选中动作结束后生成、是否跳过已存在的同段动作。
- 继续复用现有时间轴诊断和自动推迟展示，不引入真实时序假设。
- 为不同间隔、同轨冲突和草稿恢复补充测试。

### 2026-07-07：阶段 4-23 技能段批量生成间隔/落点策略雏形落地

本轮完成：

- `ActionLibraryPanel` 新增“拆段间隔 ms”“从选中结束”“跳过已有段”三个拆段配置控件。
- `workbenchDraftStorage` 新增 `segmentSplitOptions` 草稿配置块，并提供归一化逻辑：
  - `intervalMs` 默认 `2000`，范围 `100-10000`。
  - `startAfterSelectedAction` 默认 `false`，保持上一阶段从推荐插入点开始的行为。
  - `skipExistingSegments` 默认 `false`。
- `Workbench.vue` 会保存、恢复、重置并透传 `segmentSplitOptions`，旧草稿缺少该字段时会自动回落到默认值。
- 拆段生成现在会先计算一次本次生成的基准时间，再按配置间隔生成请求时间。
- 如果前一段因同轨冲突被自动推迟，后续段会按“上一段实际落点 + 间隔”继续排，避免后续段连续撞上刚生成的前一段。
- 开启“从选中结束”时，拆段会从当前选中动作的结束时间开始；未开启时继续使用现有推荐插入点。
- 开启“跳过已有段”时，会跳过当前轴里同角色、同技能、同等级、同 `damageSegmentIndex` 的技能动作。
- 新增工作台测试覆盖：
  - 默认拆段仍保持上一阶段的同轨自动推迟行为。
  - 自定义 1500ms 间隔、从选中动作结束生成、跳过已有段后，只生成剩余段并保存正确时间。
  - 保存草稿后重新挂载工作台，拆段配置和生成动作均可恢复。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、40 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、84 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 拆段生成已经不再是固定节奏，用户可以对最关键的落点策略做最小配置。
- 该策略仍是编辑辅助，不代表真实动作帧；同轨冲突处理仍由现有自动推迟机制承担。
- 当前配置只覆盖动作库拆段入口，尚未形成可复用的“生成预览/确认”流程。

下一步：

- 阶段 4-24 目标：建立拆段生成预览/确认雏形。
- 在真正写入动作前展示将要生成的段数、起始时间、跳过数量和可能的自动推迟风险。
- 允许用户在确认前检查结果，减少一次性生成多条动作后的撤销成本。
- 为预览摘要、确认写入、取消写入和跳过段统计补充测试。

### 2026-07-07：阶段 4-24 拆段生成预览/确认雏形落地

本轮完成：

- `ActionLibraryPanel` 将“拆段”按钮从直接写入改为先发起预览。
- 动作库新增拆段预览面板，展示：
  - 技能名、角色、等级。
  - 将生成段数、跳过段数、可能自动推迟数量。
  - 基准起点、拆段间隔。
  - 每个将生成段的段名、倍率、请求时间和预计落点。
- `Workbench.vue` 新增 `segmentSplitPreview` 临时状态；预览不会写入 `actionDrafts`，也不会标记草稿变更。
- 确认预览后才复用 `addInsertedAction()` 写入动作，继续保留同轨自动推迟和结构化 `insertion` 元信息。
- 取消预览会清空临时状态，不改变动作数、伤害投影数或草稿状态。
- 当用户修改 selection、动作、拆段配置、时间轴拖拽、复制/删除/新增动作或切换动作库角色时，会清理旧预览，避免确认过期结果。
- 预览计算会使用临时动作列表模拟连续插入，因此能提前显示跳过数量和同轨自动推迟风险。
- 新增工作台测试覆盖：
  - 默认拆段先展示预览，确认后才生成 4 条段动作。
  - 预览阶段动作数不变，确认后动作数、伤害投影、自动推迟提示与保存草稿一致。
  - 取消预览不会写入动作，也不会把草稿标成已修改。
  - 开启跳过已有段时，预览显示跳过 1 段、生成 3 段，确认后时间与草稿恢复保持正确。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、41 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、85 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 拆段生成现在有了最小确认流程，不再一键直接污染动作列表。
- 用户可以在写入前看到生成量、跳过量和预计自动推迟风险，适合后续扩展为更完整的批量生成预览。
- 预览仍是 UI 临时态，不进入通用项目模型或草稿持久化。

下一步：

- 阶段 4-25 目标：建立拆段生成批次标记/批量管理雏形。
- 为确认生成的一组段动作记录轻量批次来源，便于后续批量选择、撤销或重排。
- 不引入真实时序假设；批次标记只表达“这些动作由同一次拆段生成”。
- 为批次保存、草稿恢复、批量删除或撤销入口补充测试。

### 2026-07-07：阶段 4-25 拆段生成批次标记/批量管理雏形落地

本轮完成：

- `workbench` 动作草稿新增可选 `generationBatch` 字段，用于标记同一次确认拆段生成的一组动作。
- `generationBatch` 归一化内容包括：
  - `batchId`
  - `source`
  - `skillId`
  - `actorCharacterId`
  - `level`
  - `segmentCount`
  - `createdAt`
- 确认拆段预览时，`Workbench.vue` 会创建 `segment-batch-0001` 形式的批次 ID，并把同一批次写入所有生成动作。
- `generationBatch` 会随 `actionDrafts` 保存、恢复，并透传到 Project skill action 和编译后的 scenario action。
- 复制单个生成动作时会清除 `generationBatch`，避免复制件误入原批次。
- `ActionLibraryPanel` 会在生成动作卡片中显示 `拆段批次 batchId / N 段`。
- 生成动作卡片新增“删批次”入口，可一次性删除同批次生成的所有动作；保留原有非批次动作。
- 新增测试覆盖：
  - 确认拆段后 4 条生成动作共享同一个 `generationBatch.batchId`。
  - 批次元信息会保存到草稿并在重新挂载工作台后恢复。
  - 点击“删批次”只删除同批次动作，不删除原始动作。
  - 删除批次后保存草稿，剩余动作不带 `generationBatch`。
  - Project action 和 scenario action 会保留 `generationBatch`。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、43 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、87 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示和命令通道偶发 `Import-Clixml` 噪声。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 拆段生成结果已经具备最小可追踪性，同一批动作可以被识别和整体删除。
- 批次标记仍是编辑器来源信息，不引入真实连段、真实命中帧或动画时序含义。
- 当前批量管理只覆盖删除，尚未提供批量选择、批量移动、批量重排或撤销栈。

下一步：

- 阶段 4-26 目标：建立拆段批次时间偏移/批量移动雏形。
- 允许对同一 `generationBatch` 的动作整体调整起始时间偏移，保持段间相对间隔。
- 继续复用时间轴同轨重叠诊断，不把批量移动结果当作真实时序。
- 为批量偏移、草稿保存恢复、重叠提示和取消/清理批次状态补充测试。

### 2026-07-07：阶段 4-26 拆段批次时间偏移/批量移动雏形落地

本轮完成：

- `ActionLibraryPanel` 为带 `generationBatch` 的动作新增批次整体 `-500ms` / `+500ms` 偏移入口。
- `Workbench.vue` 新增 `shiftActionBatch()`，按 `generationBatch.batchId` 对同批次动作整体加减时间。
- 批次移动会保持动作间相对间隔，并按场景时间范围夹紧，避免整体移出时间轴。
- 批次移动会清理该批次动作上旧的自动推迟 `insertion` 元信息和系统自动推迟备注，避免过期插入原因继续显示。
- 批次移动后不自动避让同轨动作；如果移动造成重叠，继续由现有时间轴诊断显示。
- 新增工作台测试覆盖：
  - 批次连续前移后保持段间相对间隔。
  - 批次前移到与原动作重叠时，时间轴诊断显示同轨重叠。
  - 批次后移解除重叠后，诊断恢复为 0。
  - 批次偏移后的 `startMs` 和 `generationBatch` 可保存并在重新挂载工作台后恢复。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、88 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 拆段批次已经可以作为一个整体移动，适合快速调整一组由同次拆段生成的动作。
- 该功能仍只调整编辑器时间轴起点，不代表真实技能时序。
- 当前批量移动是固定 500ms 步进，还没有提供任意偏移输入、拖拽整组移动或撤销栈。

下一步：

- 阶段 4-27 目标：建立批次任意偏移/整组编辑输入雏形。
- 为批次动作提供可输入的偏移量或目标起点，减少多次点击固定步进的成本。
- 补充边界测试：负数夹紧、场景尾部夹紧、移动后重叠诊断、保存恢复。

### 2026-07-07：阶段 4-27 批次任意偏移/整组编辑输入雏形落地

本轮完成：

- `ActionLibraryPanel` 为带 `generationBatch` 的动作新增“批次偏移 ms”输入框和“应用偏移”按钮。
- 任意偏移输入复用 `shiftActionBatch()`，与固定 `-500ms` / `+500ms` 使用同一套批次整体移动逻辑。
- 应用任意偏移后会把输入框重置为 `0`，避免重复误操作。
- 批次任意偏移继续保持同批次动作的相对间隔，并按场景时间范围夹紧。
- 偏移造成重叠时不自动避让，继续由时间轴诊断提示。
- 新增工作台测试覆盖：
  - 输入大负数偏移时，批次整体夹紧到时间轴起点。
  - 起点夹紧后与原动作重叠，时间轴诊断显示重叠区间。
  - 输入大正数偏移时，批次整体夹紧到场景尾部。
  - 偏移后保存草稿，`startMs` 和 `generationBatch` 可作为权威状态保留。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、45 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、89 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 批次移动不再只能依赖固定步进，用户可以一次性输入大偏移量完成整组调整。
- 该输入仍是编辑器辅助，不代表真实帧数据；保存后只保留动作新的 `startMs`。
- 当前还没有目标起点输入、整组拖拽或撤销栈。

下一步：

- 阶段 4-28 目标：建立批次目标起点/整组对齐输入雏形。
- 允许用户输入目标起点，让批次第一条动作对齐到指定时间。
- 补充起点对齐、场景边界夹紧、重叠诊断和草稿恢复测试。

### 2026-07-07：阶段 4-28 批次目标起点/整组对齐输入雏形落地

本轮完成：

- `ActionLibraryPanel` 为带 `generationBatch` 的动作新增“批次起点 ms”输入框和“对齐起点”按钮。
- `Workbench.vue` 新增 `alignActionBatch()`，按同批次动作当前最早起点换算整体偏移。
- 目标起点对齐复用 `shiftActionBatch()`，因此保持同批次动作的相对间隔，并继续按场景时间范围夹紧。
- 目标起点输入是 UI 临时值，不保存到草稿；保存后仍只保留动作新的 `startMs`。
- 新增数据结构说明，确认本阶段不新增持久化字段，只补充批次对齐命令语义。
- 新增工作台测试覆盖：
  - 输入目标起点后，批次第一条生成动作对齐到指定时间。
  - 对齐后保存草稿，重新挂载工作台可恢复批次动作时间和批次标记。
  - 输入超出场景尾部的目标起点时，批次整体夹紧到合法时间范围。
  - 对齐流程继续使用既有时间轴重叠诊断。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、46 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、90 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 拆段批次现在既可以按偏移量移动，也可以按目标起点对齐。
- 该功能仍是编辑器辅助，不代表真实技能帧数据；真实来源仍待后续接入 AzPr 动作/战斗计算逻辑。
- 当前批次控制仍分散在每条动作卡片上，缺少统一的批次摘要和集中管理入口。

下一步：

- 阶段 4-29 目标：建立批次摘要/集中管理面板雏形。
- 汇总每个 `generationBatch` 的动作数量、时间范围、来源技能和当前选中状态。
- 在集中入口提供删除、偏移和目标起点对齐，减少每条动作卡重复控件带来的操作噪音。
- 补充批次摘要渲染、集中删除/移动/对齐、草稿恢复和空状态测试。

### 2026-07-07：阶段 4-29 批次摘要/集中管理面板雏形落地

本轮完成：

- `ActionLibraryPanel` 新增批次管理摘要区，按 `generationBatch.batchId` 聚合同批次动作。
- 批次摘要显示来源技能、批次来源、动作数量、当前起点范围和当前选中态。
- 批次删除、固定 `-500ms` / `+500ms` 偏移、任意偏移和目标起点对齐已集中到摘要区。
- 单动作卡移除重复的批次级删除/移动/对齐控件，只保留动作自身复制/删除和批次来源说明，降低左栏噪音。
- 批次摘要是 UI 派生视图，不新增持久化字段；刷新或恢复草稿后由 `actionDrafts[]` 重新计算。
- 新增数据结构说明，记录批次摘要派生字段与当前边界。
- 新增工作台测试覆盖：
  - 无批次时显示空状态和批次数量 0。
  - 确认拆段后显示批次摘要、动作数量、来源技能和时间范围。
  - 选中批次内动作后，摘要显示选中态。
  - 集中入口可完成批次删除、固定偏移、任意偏移和目标起点对齐。
  - 保存草稿并重新挂载后，批次摘要可从草稿动作恢复。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、47 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、91 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 批次现在有了统一管理入口，动作卡不再承担批次级操作。
- 批次摘要仍然只是一层编辑器聚合视图，不改变项目数据结构。
- 当前摘要只展示选中态，还不能点击摘要定位到批次动作，也没有整组高亮或撤销栈。

下一步：

- 阶段 4-30 目标：建立批次摘要定位/时间轴联动雏形。
- 支持点击批次摘要后选中或定位到该批次第一条动作。
- 在动作列表和时间轴中标识同批次动作，形成真正的整组选择反馈。
- 补充摘要定位、批次高亮、草稿恢复后定位和空状态测试。

### 2026-07-07：阶段 4-30 批次摘要定位/时间轴联动雏形落地

本轮完成：

- 批次摘要新增 `firstActionId` 派生值，点击摘要可选中该批次当前最早的一条动作。
- 批次摘要支持键盘回车定位；摘要内删除、偏移和对齐控件会阻止冒泡，避免误触发定位。
- 动作列表新增同批次高亮，当前选中动作所属批次内的动作都会标记为同组。
- `TimelineGridPreview` 从当前选中动作派生 `selectedBatchId`，并在时间轴动作块和对应伤害标记上显示同批次高亮。
- 批次定位和高亮不新增持久化字段，草稿恢复后由既有 `selectedActionId` 与 `generationBatch` 重新派生。
- 新增数据结构说明和时间轴功能说明，记录批次定位/高亮的派生规则和边界。
- 新增/扩展工作台测试覆盖：
  - 批次摘要记录并暴露第一条动作 ID。
  - 点击摘要后选中批次第一条动作。
  - 动作列表、时间轴动作块和伤害标记同步显示同批次高亮。
  - 摘要内批次操作不会误改当前选中动作。
  - 保存恢复后同批次高亮可由草稿状态重新派生。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、47 条测试通过。
- `npm run test -- --run`：通过，10 个测试文件、91 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 批次摘要已经可以定位，动作列表和时间轴也能给出同批次反馈。
- 批次高亮仍是当前选中动作派生状态，不是独立的批次选择模型。
- 工作台拆段批次 UI 已经具备继续承接真实技能段数据的基本编辑反馈。

下一步：

- 阶段 5-1 目标：建立 AzPr 实际技能倍率段数据源适配雏形。
- 从当前已有 `workbench-seed` 和本地 AzPr 数据索引中梳理技能倍率段字段来源，明确字段路径、版本和缺失项。
- 将当前手写/解析倍率段包装成带来源标记的适配层，为后续替换为真实游戏数据和战斗计算逻辑做准备。
- 补充真实数据字段映射、缺失诊断、回退策略和首个技能段来源测试。

### 2026-07-07：阶段 5-1 AzPr 实际技能倍率段数据源适配雏形落地

本轮完成：

- 新增 `src/domain/skillDamageSegments.js` 适配层，将技能倍率段从普通 `labels/values` 升级为带来源、字段路径、等级索引和诊断信息的结构。
- `scripts/generate-azpr-data.mjs` 的 `compactSkill()` 现在保留 `source.heroModule`，`workbench-seed.json` 中的技能可追溯到本地 hero-module 聚合文件。
- `createSkillAction()` 改为通过 `createSkillDamageModel(skill, level)` 生成 `damageModel`，动作草稿从创建时就携带倍率来源。
- 模拟编译的 `selectedDamageSegment` 和投影结果 `damageTimeline[].segment` 保留单段来源，便于从时间轴伤害事件反查倍率字段。
- 新增技能倍率段领域测试，覆盖首个真实技能段来源、等级夹紧、字段路径、解析倍率和异常倍率诊断。
- 扩展首个竖切模拟测试，确认动作创建、模拟编译和投影结果都能保留倍率段来源。
- 新增数据结构说明，记录 `damageModel`、单段 `source`、诊断码和当前边界。

验收结果：

- `npx vitest run src/__tests__/domain/skillDamageSegments.test.js src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、17 条测试通过。
- `npm run test -- --run`：通过，11 个测试文件、94 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前结论：

- 工作台技能倍率段不再是匿名数组，已经能追溯到 `C:\PC2\Codex\AzPr\BWiki\data\hero-modules\local-all\<characterId>.hero-module.local.json`。
- 当前来源仍是 BWiki hero-module 聚合层，尚未与 `Assets/ResourcesAssets/Config/NewTable/skill_level.json` 做字段级交叉校验。
- 本阶段只解决倍率段来源和解析诊断，不代表已经接入真实命中帧、动画帧、取消窗口或完整伤害公式。

下一步：

- 阶段 5-2 目标：建立 `Assets/ResourcesAssets/Config/NewTable/skill_level.json` 字段级交叉校验雏形。
- 对比 hero-module 聚合倍率与 NewTable 原始技能等级表，确认技能 ID、等级行、倍率字段和标签字段之间的映射关系。
- 输出 mismatch/missing 诊断，明确哪些倍率段可直接信任，哪些需要回退到聚合层或人工补齐。
- 补充交叉校验脚本或领域测试，为后续真实战斗计算逻辑接入提供数据可信度基线。

### 2026-07-07：阶段 5-2 NewTable 技能等级交叉校验雏形落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 接入 `Assets/ResourcesAssets/Config/NewTable/skill_level.json` 和 `Assets/ResourcesLang/chs/Table/lang_skill_level.json`。
- 新增 `src/data/generated/skill-level-crosscheck.json`，按 `skillId + level` 记录 NewTable 行号、语言 ID、还原标签、还原倍率、匹配状态和诊断。
- `manifest.json` 和 `validation-report.json` 记录交叉校验文件与汇总统计。
- 新增 `src/domain/skillLevelCrossCheck.js`，提供运行时按技能/等级读取交叉校验结果的领域接口。
- `skillDamageSegments` 的 `damageModel.crossCheck`、`selectedDamageSegment.source.crossCheck` 和 `damageTimeline[].segment.source.crossCheck` 现在会保留 NewTable 来源。
- 新增/扩展数据层、领域层和模拟层测试，覆盖首个匹配技能、真实不一致技能和投影结果来源保留。

数据结论：

- 当前 120 个角色技能全部能在 `skill_level.json` 找到等级行。
- 118 个技能完全匹配；2 个技能存在语言 ID 缺失导致的不一致：`10800562`（卡塔露）和 `19900361`（诺诺）。
- 等级维度上 998 个等级完全匹配，0 个等级缺失，2 个等级不一致。
- 这说明当前工作台主要倍率段可以信任 hero-module 聚合层，同时已有机制标记少量需要回退或人工修复的异常项。

验收结果：

- `npx vitest run src/__tests__/domain/skillDamageSegments.test.js src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、19 条测试通过。
- `npm run test -- --run`：通过，11 个测试文件、96 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和旧 chunk 体积提示，暂不阻塞本阶段。
- `skill-level-crosscheck.json` 瘦身后约 755 KB，避免把重复字段路径和 expected 数组写入生成文件。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前边界：

- 本阶段只校验技能等级显示倍率字段，不代表真实命中帧、动画帧、取消窗口或完整伤害公式已经接入。
- `skill_level.coolDown` / `spCost` 仍视为显示层数据；真实时序和资源消耗需要继续追 `skillsub_logic`、技能 asset 或运行时捕获。

下一步：

- 阶段 5-3 目标：建立 `skillsub_logic` 技能逻辑字段索引与首批技能资源/冷却来源诊断。
- 梳理 `skill_level.subSkillId`、`skillsub_logic.json`、`skillsub_ele_value.json` 与当前技能动作之间的映射关系。
- 把显示层 `coolDown` / `spCost` 与逻辑层 `coolDown` / `spCost` / `selfCD` / `GCD` 区分记录，避免后续排轴误用显示字段。
- 补充首个技能的逻辑字段来源测试，并在手册中标记仍缺少真实命中帧/取消窗口的部分。

### 2026-07-07：阶段 5-3 `skillsub_logic` 技能逻辑字段索引雏形落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 接入 `skillsub_logic.json` 和 `skillsub_ele_value.json`。
- 新增 `src/data/generated/skill-logic-index.json`，按技能记录 `skill_level.subSkillId -> skillsub_logic.skillId -> skillsub_ele_value.skillId + level` 的映射。
- 新增 `src/domain/skillLogicModel.js`，运行时可按技能与等级解析显示层字段、逻辑层字段和元素数值参数。
- `createSkillAction()` 现在会附带 `logicModel`，明确区分 `skill_level` 显示层 `coolDown/spCost` 与 `skillsub_logic` 逻辑层 `coolDown/spCost/selfCD/publicCD/GCD`。
- 首个技能 `10900101` 已能追溯到 `skill_level.rows[id=1657]`、`skillsub_logic.rows[skillId=10900101]` 和 `skillsub_ele_value.rows[id=973/985]`。
- 新增/扩展生成数据、领域层和模拟竖切测试，覆盖逻辑字段来源、显示/逻辑不一致诊断、等级夹紧和 `valueParam` 参数解析。

数据结论：

- 当前 120 个角色技能对应 1000 条 `skill_level` 等级行和 120 个 `subSkillId`。
- 120 个 `subSkillId` 全部能在 `skillsub_logic.json` 找到逻辑行。
- 76 个技能显示层与逻辑层冷却/能量一致；44 个技能存在显示/逻辑不一致，这些被标记为 info 级来源差异。
- 相关 `skillsub_ele_value` 数值参数行共 2808 条；100 个技能等级没有元素值参数行，暂按 info 级诊断记录。
- 60 个逻辑行存在非零冷却、能量、selfCD、publicCD、GCD 或相关时序字段。

验收结果：

- `npx vitest run src/__tests__/domain/skillLogicModel.test.js src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、19 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、100 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 因新增逻辑索引增至约 1199 KB，后续可拆包或懒加载优化。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前边界：

- 本阶段只建立字段来源和显示/逻辑区分，还没有解释 `skillsub_ele_value.valueParam` 中参数 ID 的具体战斗语义。
- `logicModel` 仍不代表真实命中帧、动画帧、取消窗口或完整伤害公式。
- 下一阶段需要把这些来源信息真正暴露到工作台，避免用户在排轴时看不到字段差异。

下一步：

- 阶段 5-4 目标：在 Workbench 中展示技能逻辑来源与显示/逻辑差异诊断。
- 在当前技能动作详情中显示 `skill_level` 显示冷却/能量、`skillsub_logic` 逻辑冷却/能量/selfCD/GCD，以及 `skillsub_ele_value` 当前等级参数行。
- 对 `skill-display-logic-timing-mismatch` 给出清晰的来源提示，避免把显示字段误当作真实排轴字段。
- 补充 UI 测试和模拟投影断言，确保保存/恢复后逻辑来源仍可追溯。

### 2026-07-07：阶段 5-4 Workbench 技能逻辑来源展示落地

本轮完成：

- `PropertiesPanel` 在技能动作详情中新增“技能逻辑来源”区。
- 展示 `skill_level` 显示层 `coolDown/spCost`、`skillsub_logic` 逻辑层 `coolDown/spCost/selfCD/GCD`，以及当前等级 `skillsub_ele_value` 参数行。
- 当动作命中 `skill-display-logic-timing-mismatch` 诊断时，UI 显示“来源差异”，并同时列出显示层与逻辑层的冷却/能量值。
- 该展示完全由 `selectedAction.logicModel` 派生，不写入 `workbench-draft`。
- 新增 Workbench UI 测试，覆盖默认技能逻辑来源展示、差异技能 `10100712` 的显示/逻辑冷却差异，以及保存/恢复后来源差异仍可追溯。
- 新增数据结构说明，确认本阶段不新增持久化字段，只展示派生来源。

验收结果：

- `npx vitest run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、48 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、101 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1201 KB，后续可拆包或懒加载优化。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前边界：

- UI 现在能看到显示层/逻辑层差异，但仍没有解释 `skillsub_ele_value.valueParam` 参数 ID 的具体战斗语义。
- `logicModel` 仍不代表真实命中帧、动画帧、取消窗口或完整伤害公式。
- Workbench chunk 仍偏大，后续需要结合索引拆包或懒加载处理。

下一步：

- 阶段 5-5 目标：建立 `skillsub_ele_value.valueParam` 参数解析与倍率段关联雏形。
- 解析 `valueParam` 中的参数 ID/value 对，梳理它们与技能描述占位、倍率段、元素值参数的对应关系。
- 尝试把当前伤害段的 `rawValue` 与 `skillsub_ele_value` 当前等级参数行建立可诊断关联，为真实战斗计算公式接入做准备。
- 补充首个技能和一个显示/逻辑差异技能的参数映射测试，并继续记录无法解释的参数 ID。

### 2026-07-07：阶段 5-5 `valueParam` 参数解析与倍率段关联诊断雏形落地

本轮完成：

- `createSkillLogicModel()` 支持接收 `damageModel`，并基于当前等级的 `skillsub_ele_value.valueParam` 生成参数摘要。
- 新增 `logicModel.valueParamSummary`，记录参数行数、参数数量、参数 ID、直接匹配数量、未解释参数 ID 和未匹配倍率段数量。
- 新增 `logicModel.damageParameterLinks[]`，按倍率段尝试建立 `rawValue` 与 `valueParam` 参数值的直接数值关联。
- 倍率段候选值目前只做保守枚举：原始数字、倍率、小数转万分比、百分数字转基点；去重后再与 `valueParam` 数值精确/近似匹配。
- 当倍率段无法与 `valueParam` 直接匹配时，输出 info 级诊断 `skill-value-param-damage-segment-unmatched`；无法解析倍率时输出 `skill-value-param-damage-segment-unparseable`。
- 模拟编译后的 `selectedDamageSegment.source.valueParamLink` 与投影结果 `damageTimeline[].segment.source.valueParamLink` 会保留当前段的参数关联诊断。
- Workbench 技能逻辑来源区新增当前倍率段的 `valueParam` 关联状态，保存/恢复后可由动作重新派生。
- 覆盖首个技能 `10900101` 与显示/逻辑差异技能 `10100712`：两者当前都没有发现 `valueParam` 与倍率段的直接数值匹配，因此继续标记为“未解释参数”。

验收结果：

- `npx vitest run src/__tests__/domain/skillLogicModel.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、103 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1205 KB，后续可拆包或懒加载优化。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前边界：

- 本阶段只建立 `valueParam` 与倍率段之间的“直接数值匹配诊断”，并未解释参数 ID 的真实战斗语义。
- 对 `10900101` 和 `10100712` 的结果表明，`valueParam` 当前不能直接当作倍率公式来源使用。
- `logicModel` 仍不代表真实命中帧、动画帧、取消窗口或完整伤害公式。
- Workbench chunk 继续偏大，数据索引拆包仍是后续技术债。

下一步：

- 阶段 5-6 目标：建立 `valueParam` 参数 ID 词典/语义来源调查雏形。
- 从本地 NewTable、脚本和描述占位中追踪 `valueParam` 参数 ID，例如当前反复出现的 `1`、`7`，区分倍率、资源、效果、附着或条件参数。
- 把参数 ID 语义以可诊断词典形式接入 `logicModel`，让 UI 能显示“未知参数/疑似非伤害参数/已解释参数”。
- 补充跨技能统计、首批参数 ID 语义测试，并继续避免把未确认参数写入真实伤害公式。

### 2026-07-07：阶段 5-6 `valueParam` 参数 ID 词典/语义来源调查雏形落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 接入 `element_formula.json`，并新增 `src/data/generated/value-param-index.json`。
- `value-param-index.json` 记录当前技能范围内出现的 `valueParam` 参数 ID、推断公式变量槽位、样例、统计范围和语义状态。
- 当前只观察到参数 ID `1` 与 `7`：
  - `1 -> A`：随技能/等级变化的公式槽位，当前最小 200、最大 408450。
  - `7 -> G`：当前恒为 10000 的公式槽位，疑似比例/默认因子，但战斗语义仍未确认。
- 验证报告新增 `skill-value-param-semantic-unresolved` info 级提示，明确参数词典已建立，但不能直接写入真实伤害公式。
- `logicModel.elementValues[].params[]` 现在带有精简 `descriptor`，包含参数标签、公式变量、语义状态、常量/变量分类和统计范围。
- `logicModel.valueParamSummary` 新增 `semanticStatusCounts`、`unresolvedParamIds`、`constantParamIds`。
- Workbench 技能逻辑来源区新增参数语义提示，例如 `参数 1 / A：公式槽位，语义未确认` 和 `参数 7 / G：恒定公式槽位，语义未确认`。
- 新增/扩展生成数据、领域层和 Workbench 测试，固定首批参数 ID 词典和 UI 展示。

数据结论：

- 当前角色技能索引覆盖 2808 条 `skillsub_ele_value` 元素数值行。
- 共解析 5616 个 `valueParam` 参数对。
- 出现 `valueParam` 的技能数为 75 个。
- `element_formula.json` 共 152 条公式，当前可从公式变量约定推断 `1 -> A`、`7 -> G`，但还缺少 `elementId -> 公式/效果` 的直接映射证据。

验收结果：

- `npx vitest run src/__tests__/data/azprGenerated.test.js src/__tests__/domain/skillLogicModel.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、49 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1210 KB，后续可拆包或懒加载优化。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5175/#/workbench` 本地页面服务返回 200。

当前边界：

- `value-param-index.json` 是公式槽位词典，不是伤害公式词典。
- `semanticStatus` 仍是 `unresolved`，因此参数 `1`、`7` 只能用于诊断和展示，不能参与真实伤害计算。
- 当前仍缺少 `skillsub_ele_value.elementId` 到具体技能 asset、效果节点、公式 ID 或命中段的直接映射。
- 本阶段仍不代表真实命中帧、动画帧、取消窗口或完整伤害公式已经接入。

下一步：

- 阶段 5-7 目标调整：优先建立角色当前数值面板，先把技能倍率要乘的角色攻击、生命、防御、暴击等面板来源固定下来。
- 数据参考来自 `C:\PC2\Codex\AzPr\BWiki\generated\spreadsheets\role-attribute-dynamic-current-rank.xlsx`，生成口径沿用 BWiki 动态角色属性表。
- `elementId -> 技能 asset/公式/效果节点` 来源追踪顺延到数值面板之后。

### 2026-07-07：阶段 5-7 角色当前数值面板落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 接入 `template_hero.json`、`talent_rank.json`、`talent_rune.json`，按 BWiki `role-attribute-dynamic-current-rank.xlsx` 同源口径生成角色当前面板快照。
- 新增 `src/data/generated/character-attribute-panels.json`，覆盖 20 个角色、每角色 29 个展示属性，共 580 条面板属性行。
- 面板默认口径固定为 80 级、当前临阶 7、当前阶星赐全选、突破加成计入至 6 阶。
- `workbench-seed.json` 内嵌压缩后的核心面板字段，保留完整 29 属性在独立 JSON，避免 Workbench chunk 过度膨胀。
- `Actor.attributePanel` 进入新版项目模型，`compileActor().stats` 优先读取面板核心值；当前 raw 投影公式版本升级为 `stage5-current-panel-attack-multiplier-v1`。
- Workbench 右侧 `PropertiesPanel` 新增“角色数值面板”，跟随当前动作归属显示攻击、生命、物防、魔防、调谐、暴击率、暴击伤害、伤害增幅等核心属性。
- 已用 xlsx inspect 产物核对末音面板：攻击 `1920`、生命 `10748`、暴击率 `6.1%`，与 `全角色面板拆分` 工作表一致。

数据结论：

- `character-attribute-panels.json.summary.characters = 20`。
- `attributesPerCharacter = 29`，`panelRows = 580`。
- `starAttributeRows = 2656`。
- 末音当前面板攻击为 `1920`，首条垂直切片的普攻 raw 投影现在使用 `1920 * 649% = 12461`。

验收结果：

- `npx vitest run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、56 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、107 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1243 KB，后续仍需做数据拆包/懒加载。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。
- `http://127.0.0.1:5176/#/workbench` 本地页面服务返回 200。

当前边界：

- 当前仍是“角色面板攻击 × 技能倍率”的 raw 投影，不包含防御、抗性、暴击、增伤、减伤、buff、装备、奇波或灵子公式。
- 面板快照固定为当前排行口径，不等同于可编辑配装/练度系统。
- `valueParam` 与 `elementId` 仍未确认真实战斗语义，不能直接写入最终伤害公式。

下一步：

- 阶段 5-8A 目标：先修正技能动作形态模型，避免把普攻、重击、闪击、跃击误当成同一技能的多段伤害。
- 从技能描述 `【普通攻击】` 中解析普攻段数，只记录段数与总倍率，不编造每段倍率。
- 在 Workbench 中把“伤害段/倍率段”入口改为“动作形态”，保留旧字段兼容草稿。
- 完成后再进入阶段 5-8B：建立真实伤害公式分层雏形。

### 2026-07-07：阶段 5-8A 技能动作形态模型修正落地

本轮完成：

- 修正 `src/domain/skillDamageSegments.js` 语义：`skillLevel.name/value` 现在解析为 `variants/actionVariants`，`segments` 仅作为兼容别名保留。
- `普攻`、`重击`、`闪击`、`跃击` 被视为不同动作形态；其中 `闪击` 归类为闪避攻击形态，`跃击` 归类为下落/空中攻击形态。
- `workbench-seed.json` 补入技能 `description` 和 `skillType`；`scripts/generate-azpr-data.mjs` 的 `compactSkill()` 同步保留这些字段，后续重新生成不会丢失描述。
- 从 `10900101 哈库茵剑舞` 的 `【普通攻击】进行至多五段的普通攻击` 描述中解析出 `hitModel.hitCount = 5`。
- 普攻 `649%` 明确标记为总倍率：`distributionStatus = total-only`，不拆出虚假的每段倍率。
- 新增 `actionVariantIndex`，并继续同步 `damageSegmentIndex` 兼容已有草稿；新批次来源改为 `skill-action-variant-split`，同时保留 `segmentCount` 兼容旧批次逻辑。
- Workbench 右侧属性面板、动作库批量生成、批次说明和 `valueParam` 关联提示都改为“动作形态”口径。
- 编译后的场景新增 `actionVariants` 与 `selectedActionVariant`，同时保留 `damageSegments` 与 `selectedDamageSegment` 兼容既有投影链路。
- 更新领域、模拟和 Workbench 测试，覆盖普攻 5 段描述解析、动作形态生成、草稿保存和旧字段兼容。

验收结果：

- `npm run test -- --run`：通过，12 个测试文件、107 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1352 KB，后续仍需做数据拆包/懒加载。
- `git diff --check`：通过；仅有仓库既有 LF/CRLF 工作区提示。

当前边界：

- 当前仍没有每段普攻的真实倍率、命中帧、动作帧或取消窗口。
- `hitModel` 只说明普攻有多少段，以及当前只有总倍率可用；伤害投影仍按所选动作形态总倍率计算。
- 旧字段名 `damageSegmentIndex`、`selectedDamageSegment`、`damageSegments` 仍保留为兼容层，后续 schema 升级时应逐步迁移。

下一步：

- 阶段 5-8B 目标：按 Endaxis 交互口径修正动作库和时间轴颗粒度。
- 动作库先只列直接战斗动作：普通攻击、重击、闪击、跃击、星鸣技、星结合击、星决技、星携技、极限反击、完美招架。
- 被动技能、属性提升和华丽技能名不作为动作库主项展示。
- 时间轴颗粒度改为 60fps 的 1 帧网格；动作时长、拖动吸附、键盘微调和属性输入都要按帧对齐。

### 2026-07-07：阶段 5-8B Endaxis 风格动作库与 60fps 帧时间轴修正落地

本轮完成：

- 新增 `src/domain/timebase.js`，统一 Workbench 时间基准为 `60fps`，提供 `msToFrame()`、`frameToMs()`、`snapMsToFrame()`、`formatFrameTime()`。
- 新增 `src/domain/skillActionCatalog.js`，把真实技能倍率形态映射成固定动作目录：`普通攻击`、`重击`、`闪击`、`跃击`、`星鸣技`、`星结合击`、`星决技`、`星携技`、`极限反击`、`完美招架`。
- 动作目录只保留可进入时间轴的主动战斗动作；`暴击率`、`攻击力`、`星决蓄能`、`伤害提升` 等被动/属性项不再作为动作库条目出现。
- `ActionLibraryPanel` 改为直接动作库：按钮显示动作名与倍率/帧时长，不再把技能名和“分段生成”作为主入口；工具箱默认追加也改为 `+ 动作`。
- `createSkillAction()` 与 Workbench 新增动作流程改为保存 `actionVariantIndex`，并把时间轴动作名展示为直接动作名，例如 `普通攻击`、`星鸣技`。
- `TimelineGridPreview`、`PropertiesPanel`、动作草稿生成和拖拽吸附都改为 1 帧最小颗粒度；批次快捷偏移改为 `30f`。
- 当前动作时长仍是目录级默认帧长，不是运行时捕获的真实动画长度；文案和备注继续标记真实动作帧待补。
- Workbench 测试从旧“技能分段生成”口径改为直接动作目录口径，锁定动作顺序、被动过滤和帧时间显示。

验收结果：

- `npm run test -- --run`：通过，12 个测试文件、102 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1348 KB。

当前边界：

- 目前只完成动作库交互口径和时间轴帧颗粒度；真实动作长度、命中帧、取消窗口仍缺 asset 或运行时捕获来源。
- 默认动作时长只用于排轴占位和交互手感，不能当作最终战斗时序数据。
- 旧字段名 `damageSegmentIndex`、`selectedDamageSegment`、`damageSegments` 仍作为兼容层保留；新逻辑继续优先 `actionVariantIndex`。

下一步：

- 阶段 5-8C 目标：建立真实伤害公式分层雏形。
- 以 `actionVariantIndex + hitModel + 当前角色面板` 为输入，拆出攻击区、动作形态倍率区、防御/抗性占位、暴击/增伤占位和数据来源标签。
- 用当前面板攻击、动作形态总倍率、敌人防御面板建立第一版可诊断公式链；未确认字段必须输出 limitation，不伪装成最终伤害。
- 随后再回到 `elementId -> asset/公式/效果节点` 追踪，把命中段和公式节点补到技能逻辑模型中。

### 2026-07-07：阶段 5-8C 真实伤害公式分层雏形落地

本轮完成：

- `src/simulation/mechanics/damage.js` 的公式版本升级为 `stage5-damage-layer-breakdown-v1`。
- 新增 `formulaBreakdown` 结构，把当前 raw 投影拆成已应用层和未应用层。
- 已应用层：`baseAttack` 读取编译后的当前角色面板攻击，`actionMultiplier` 读取当前动作形态倍率与 `hitModel`。
- 未应用占位层：`enemyDefense`、`enemyResistance`、`critical`、`damageBonus`，均明确 `applied: false`、`status: "placeholder"`、`multiplier: 1`。
- 敌人防御占位层会保留 Workbench 敌人配置中的 `defenseMultiplier`，但不参与最终伤害计算。
- 编译 actor stats 补入 `damageAmplification`、`damageReduction`，供后续增伤/减伤层接入。
- `damageTimeline[]` 现在保留 `formulaVersion` 和 `formulaBreakdown`，Analysis 面板显示 `攻击 × 倍率 / 防御、抗性、暴击未应用`。
- 诊断 limitation 增加公式分层提示，避免把占位层误解为已实现真实公式。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、102 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1351 KB。

当前边界：

- 当前最终数值仍等于 `round(当前攻击 * 动作形态倍率)`，防御、抗性、暴击、增伤、装备、奇波、灵子都没有真实应用。
- `formulaBreakdown` 是接入位和诊断链，不是已确认的完整蓝色星原公式。
- 敌人防御倍率目前只进入占位层；需要找到真实敌人防御公式和抗性来源后才能从 `applied: false` 改为已应用层。

下一步：

- 阶段 5-8D 目标：追踪敌人防御/抗性与 `elementId -> asset/公式/效果节点` 证据。
- 优先从 `C:\PC2\Codex\AzPr` 的 NewTable、battle/skill asset、Lua 或导出索引中寻找敌人防御、抗性、元素伤害公式和 `elementId` 关联。
- 若找到可验证公式来源，将 `enemyDefense` 或 `enemyResistance` 从占位层升级为可应用层；若找不到，则产出诊断索引和缺口清单。

### 2026-07-07：阶段 5-8D 战斗公式证据索引落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 新增 `combat-formula-evidence.json` 生成。
- `combat-formula-evidence.json` 追踪敌人属性链：`enemy.propertyId -> unit_property.baseAttributeId -> template_value.baseAttribute -> battle_info.attrVal`。
- 当前 208 个可用敌人中，199 个有 `property`，198 个有 `DEF/MDEF`、元素减免属性和弱点伤害倍率属性。
- 样例敌人 `300032 迅狼` 的 `DEF = 9000`、`MDEF = 9000`、各元素减免为 `0`、各元素弱点伤害倍率多为 `10000`。
- 证据索引同时记录 `element_formula.json` 中的攻击/魔法攻击/防御/target 引用公式行，例如 `2: (self.ATK[0]*A)/10000`、`23: (self.DEF[0]*A)/10000`。
- 证据索引确认当前本地表中 `skillsub_ele_value.elementId` 与 `element_formula.id` 没有直接等值匹配：全量 13118 行、1800 个 elementId、152 条 formula 行，直接匹配数为 0。
- `validation-report.json` 新增 `combat-formula-evidence-direct-link-missing` info 级诊断，明确还需要 asset/效果节点追踪。
- `src/data/azprGenerated.js` 新增 `getAzprCombatFormulaEvidence()`，数据测试覆盖 manifest、validation、敌人属性链和公式 direct-link 缺口。

验收结果：

- `npm run data:generate`：通过，生成 `combatFormulaEvidence = 152`。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、8 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、103 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1351 KB。

当前边界：

- 已确认敌人属性和元素减免字段来源，但尚未确认最终防御/抗性伤害公式。
- 已确认 `element_formula` 有可疑公式行，但尚未确认 `elementId -> formulaId` 或 `elementId -> effect node -> formulaId` 的真实关联。
- 本阶段仍不把 `enemyDefense` / `enemyResistance` 从 `applied: false` 升级为已应用层。

下一步：

- 阶段 5-8E 目标：继续追踪 skill asset / effect node，将 `skillsub_ele_value.elementId` 连接到具体公式或效果节点。
- 若仍找不到直接链路，先把 `combat-formula-evidence` 接入 `formulaBreakdown.layers.enemyDefense.source` / `enemyResistance.source`，让 UI 能显示“有属性来源、公式未确认”的更细状态。

### 2026-07-07：阶段 5-8E 公式证据接入伤害分层 source

本轮完成：

- `src/simulation/mechanics/damage.js` 引入 `combat-formula-evidence.json`，把 5-8D 的证据索引接入 `formulaBreakdown`。
- `formulaBreakdown.layers.enemyDefense.status` 从纯 `placeholder` 升级为 `evidence-found-formula-unmapped`。
- `enemyDefense.source` 现在记录证据文件、来源链、`relationStatus`、敌人 `propertyId/baseAttributeId`，以及当前敌人的 `DEF/MDEF` 属性值。
- `formulaBreakdown.layers.enemyResistance.status` 同步升级为 `evidence-found-formula-unmapped`。
- `enemyResistance.source` 现在记录 `elementValueStatus`、动作 `elementId` 和敌人的元素防御字段值，例如 `NORMAL_DEFENSE/FIRE_DEFENSE`。
- 最终伤害表达式仍保持 `round(baseAttack.value * actionMultiplier.value)`；已应用层仍只有 `baseAttack` 与 `actionMultiplier`，防御/抗性没有参与数值计算。
- `firstVerticalSliceSimulation` 测试已覆盖 `300032 迅狼` 的 `DEF/MDEF = 9000` 和元素防御字段证据。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、11 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、103 条测试通过。
- `npm run build`：通过；仍有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1354 KB。

当前边界：

- `source` 对象只是诊断证据，不代表真实防御/抗性公式已确认。
- 仍未找到 `skillsub_ele_value.elementId -> effect node -> element_formula.id` 的完整链路。
- 仍不能把 `enemyDefense` / `enemyResistance` 改为 `applied: true`。
- 动作 `elementId` 已能记录到抗性层，但还不能自动判断应套哪个元素减免字段。

下一步：

- 阶段 5-8F 目标：专门追踪 `skill.skillBytesPath`、`Config/Battle/Skill/*.asset`、效果节点或相邻 battle 表，建立 skill asset / effect node 候选索引。
- 若找到 `skillsub_ele_value.elementId` 到公式节点的链路，生成可验证的关系索引；若仍找不到，记录缺口和候选表字段，避免重复大范围盲搜。

### 2026-07-07：阶段 5-8F 技能资源证据索引落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 新增 `skill-asset-evidence.json` 生成。
- 读取 `skill.json`、`hero.json`、`enemy.json`、`hero_test.json`、`pet.json`、`kibo_duel.json`、`world_item.json`、`world_resource.json`、`battlefield_item.json`，统计 `skillList`、`attackSkill`、`skillSystem` 和 `skillBytesPath`。
- 探测 `C:\PC2\Codex\AzPr\Assets\ResourcesAssets\Config\Battle\Skill`、`SkillPreload`、`SkillList`，当前均不存在实体资源。
- 按项目规则使用 `C:\Codex\AzPr Extractor` 作为 fallback，已索引 `ExtractedAssets\Unity\default_package\ResourcesAssets\Config\Battle\SkillList`。
- Extractor 当前有 4134 个 `skill_control_*.asset` 目录；120 个当前技能中 116 个匹配，4 个缺失：`10101062`、`10700262`、`10800562`、`11200262`。
- `skill-asset-evidence.json` 对 `skill_control` 的 MonoBehaviour JSON 做了候选抽样，记录 `startFrame/endFrame/frameCount/eventType/eventID/elementList` 等字段；末音 `10900101` 的候选帧范围样本为 `0-300` 帧。
- `src/data/azprGenerated.js` 新增 `getAzprSkillAssetEvidence()`。
- `validation-report.json` 新增 `skill-asset-effect-node-unmapped` info 级诊断，明确当前只是候选索引，还没有解析成最终命中帧、效果节点或公式映射。

关键数据：

- `skillTableRows`: 3200
- `currentSkillCount`: 120
- `currentSkillsWithSkillTableRow`: 120
- `currentSkillsWithExtractedSkillControl`: 116
- `currentSkillsMissingExtractedSkillControl`: 4
- `skillBytesPathOwnerRows`: 646
- `uniqueSkillBytesPaths`: 682
- `existingSkillBytesPathsInAzPrAssets`: 0
- `extractedSkillControlDirectories`: 4134
- `relationStatus`: `skill-control-assets-found-in-azpr-extractor`

验收结果：

- `npm run data:generate`：通过，生成 `skill-asset-evidence.json`。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1354 KB。

当前边界：

- `skill_control` 候选帧范围不是最终动作时长。
- MonoBehaviour 节点样本还没有解引用到具体行为对象链。
- 还没有建立 `skillsub_ele_value.elementId -> effect node -> element_formula.id` 的可信映射。
- 不应把 `skill-asset-evidence.json` 直接用于伤害计算，只能用于下一阶段追踪。

下一步：

- 阶段 5-8G 目标：先建立每动作三值结果契约，确保敌人 HP 伤害、敌人韧性削减、自身能量变化三条公式链不会混在一起。
- 随后解析 `skill_control` MonoBehaviour 候选节点，把 `startFrame/endFrame/frameCount/eventType/eventID/elementList` 组织成动作时长、命中帧、效果节点和公式映射候选。

### 2026-07-07：阶段 5-8G 每动作三值结果契约落地

本轮完成：

- `simulationResult` 新增 `actionResultTimeline[]`。
- 每个动作现在固定输出：
  - `hpDamage`：敌人 HP 伤害。
  - `toughnessDamage`：敌人韧性削减。
  - `selfEnergyChange`：自身能量变化。
- `hpDamage` 当前沿用已有 raw 投影：`round(baseAttack.value * actionMultiplier.value)`。
- `toughnessDamage` 当前独立占位，状态为 `formula-unmapped`，明确削韧公式不能从 HP 伤害公式直接推导。
- `selfEnergyChange` 当前会应用显式 `spCost` 或手动资源动作；充能获取公式仍是 `charge-formula-unmapped`。
- `summary` 新增 `actionResultCount`、`totalProjectedToughnessDamage`、`totalSelfEnergyDelta`、`selfEnergyDeltaByActor`。
- `selfEnergyDeltaByActor` 按 actor 单独汇总，自身能量类似 Endaxis 的 SP 追踪方式，但必须分角色记录，不能做成全队单值。

Endaxis 参考边界：

- 可以参考 Endaxis/终末地对 `spRecovery`、`spReturn`、`stagger` 的多指标追踪方式，以及时间轴多条曲线/标签的绘制方式。
- 韧性值可类比终末地的失衡值，用于 UI 表达和曲线组织。
- 蓝色星原的削韧值、韧性状态、充能获取、角色能量上限和消耗机制必须继续从蓝原本地表、`skill_control`、效果节点和运行时证据中找，不能直接套用终末地公式。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、11 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1359 KB。

当前边界：

- `actionResultTimeline[]` 是结果契约，不代表削韧/充能真实公式已确认。
- 当前 `totalProjectedToughnessDamage` 仍为占位汇总。
- 当前 `selfEnergyChange` 只应用显式 delta，例如技能消耗或手动资源动作；普攻/命中充能、被动回能、角色独立能量上限尚未确认。
- UI 仍未绘制三值多曲线；后续应参考 Endaxis 多曲线显示，但使用蓝原数据。

下一步：

- 阶段 5-8H 目标：解析 `skill_control` MonoBehaviour 候选节点，区分 HP 伤害节点、削韧节点、充能节点。
- 优先从 `10900101` 末音普通攻击入手，追踪 MonoBehaviour 引用对象、行为组、节点类型和 `skillsub_ele_value.elementId` 的关系；同时记录是否存在韧性/充能专用字段。

### 2026-07-07：阶段 5-8H skill_control 效果轨道候选分类落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 对 `skill_control_*.asset` 的 MonoBehaviour JSON 样本新增效果轨道候选分类。
- `skill-asset-evidence.json` 的每个当前技能证据项新增 `effectLaneCandidateSummary` 和 `effectLaneCandidates`。
- 分类维度先固定为六类：敌人 HP 伤害、敌人韧性削减、自身能量变化、元素/属性效果、动作/时序控制、表现/音画资源。
- 分类依据来自 JSON 解析后的 `name`、`trackName` 和字符串字段模式匹配；不能用纯文本 `rg` 直接搜中文，因为 Unity JSON 中大量中文字段会转义。
- 全局当前技能样本统计显示：`hpDamage = 1`、`toughnessDamage = 0`、`selfEnergyChange = 1`、`elementEffect = 3`、`timingControl = 4`、`presentation = 4`。
- 末音 `10900101` 已识别到 `攻击碰撞` / `普通-攻击碰撞` 等 HP 伤害候选；其中 `攻击碰撞` 样本帧为 `19-20`，但仍只是候选命中轨道。
- 末音 `10900101` 还识别到 `元素`、`移动打断`、`立即跳转`、`SFX`、`特效` 等候选轨道；本轮样本中没有发现削韧或自身能量候选。
- `validation-report.json` 的 `skill-asset-effect-node-unmapped` 诊断同步输出效果轨道候选摘要，方便后续追踪。

验收结果：

- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1359 KB。

当前边界：

- 本阶段只做候选分类，不代表 HP 伤害、削韧、充能公式已经确认。
- 还没有解引用 `behaviorList`、PathID 或 MonoBehaviour 之间的真实行为对象链。
- 全局统计来自当前每技能抽样文件，不能当作完整技能资源解析覆盖率。
- `effectLaneCandidates[].startFrame/endFrame` 只能作为追踪入口，不能直接当成最终动作时长、真实命中帧或取消窗口。

下一步：

- 阶段 5-8I 目标：从末音 `10900101` 入手解引用 `behaviorList` / PathID / MonoBehaviour 引用链。
- 将 `攻击碰撞`、`普通-攻击碰撞`、`元素` 等轨道连接到实际行为对象、`skillsub_ele_value.elementId` 和可能的公式/效果节点。
- 重点确认削韧字段、自身能量变化字段和 HP 伤害节点是否在行为对象或相邻资源中，而不是只看 timeline control 名称。

### 2026-07-07：阶段 5-8I skill_control 本地行为链解引用落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 为 `skill_control` MonoBehaviour 样本新增 PathID 文件索引，能从 `behaviorList[].m_PathID` 反查同目录目标 MonoBehaviour。
- 因 Unity `m_PathID` 是 64 位整数，JS `JSON.parse` 会丢精度；本轮通过文件名保留精确 PathID 字符串，同时用 rounded PathID 做索引匹配，输出中同时记录 `pathId` 和 `roundedPathId`。
- `skill-asset-evidence.json` 新增 `behaviorReferenceSummary` 和 `effectLaneBehaviorChains`，记录 `timeline control -> behaviorList ref -> target MonoBehaviour` 的链路。
- 全局当前样本统计显示：5 个当前技能已解出本地 behavior 引用，1 个当前技能有 HP 行为链，1 个当前技能出现外部 `elementBaseDatas` 引用。
- 末音 `10900101` 的 36 条 `behaviorList` 引用全部解到本地 MonoBehaviour，未解引用数为 0。
- 末音 `10900101` 的 HP 候选行为链解出 5 条；第一条 `攻击碰撞 19-20f` 指向 `MonoBehaviour_1081335820946113461__1081335820946113461.json`。
- 该目标行为对象字段显示：`scriptPathId = 8289252000250858251`、`startFrame = 19`、`frameCount = 1`、`collisionLayer = 5`、`elementalType = 1023`、`targetType = 1`、`maxTargetCount = 99`，并有 3 条 `m_FileID = 2` 的 `elementBaseDatas` 外部引用。

验收结果：

- `npm run data:generate`：通过，重新生成 `skill-asset-evidence.json`。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1359 KB。

当前边界：

- 已确认的是本地行为对象链路，不是最终伤害公式、削韧公式或充能公式。
- `scriptPathId = 8289252000250858251` 可作为后续识别碰撞/命中行为类型的强线索，但还需要脚本类型名或更多同类样本验证。
- `elementBaseDatas` 指向 `m_FileID = 2` 外部对象，当前 `skill_control_10900101.asset/MonoBehaviour` 目录内没有对应 JSON；下一阶段需要追 bundle 外部对象、Yoo index、typetree 或 Extractor 原始资源。
- 末音样本中削韧和自身能量仍未在 HP 碰撞行为对象里直接出现，不能从 HP 行为链推导它们。

下一步：

- 阶段 5-8J 目标：追踪 `elementBaseDatas` 的 `m_FileID = 2` 外部引用来源。
- 优先从 `skill_control_10900101` 所属 bundle、Extractor 的 Yoo index、stub 元信息和 Unity typetree 输出中查找 `-5633710717881758712`、`7848597992417622553`、`2740651767650299388`、`-4052262175632216603` 等外部对象。
- 若能解析外部对象，继续确认它们是否连接到 `skillsub_ele_value.elementId`、`valueParam`、削韧字段或充能字段；若仍不能解析，则把缺口固化为诊断索引。

### 2026-07-07：阶段 5-8J elementBaseDatas 资源映射证据落地

本轮完成：

- `scripts/generate-azpr-data.mjs` 新增 `skillResourceMapEvidence`，从 `skill_control_*.asset` 根 MonoBehaviour 的 `skillResourceMaps` 提取资源映射。
- `effectLaneBehaviorChains[].resolvedBehaviors[].elementBaseDataRefs` 现在会尝试匹配根 `skillResourceMaps[].elements`，并记录 `resourceMapMatches`。
- 全局当前样本统计显示：1 个当前技能存在外部 `elementBaseDatas` 引用，且这些引用已能匹配到根 `skillResourceMaps`；未匹配技能数为 0。
- 末音 `10900101` 根对象 `skillResourceMaps` 有 2 组资源映射、8 个 element 引用。
- `subSkillId = 10900101 / Skill0_1` 对应 hitEffect `11_109001_116`，包含 `-4052262175632216603` 等 element 引用。
- `subSkillId = 109001011 / Skill0_6` 对应 hitEffects `11_109001_133`、`11_109001_005`，包含 `-5633710717881758712`、`7848597992417622553`、`2740651767650299388` 等 element 引用。
- 末音 `10900101` 的 13 条外部 `elementBaseDatas` 引用全部匹配到根 `skillResourceMaps`，其中 `攻击碰撞 19-20f` 的 3 条 element 引用都归到 `subSkillId = 109001011 / Skill0_6`。

验收结果：

- `npm run data:generate`：通过，重新生成 `skill-asset-evidence.json`。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1359 KB。

当前边界：

- 当前已确认“外部 element 引用属于哪组 `skillResourceMaps` / `subSkillId` / `hitEffects`”，但仍没有解析 `m_FileID = 2` 外部对象本体。
- `skillResourceMaps.effects` / `hitEffects` 是资源名线索，不等同于伤害、削韧或充能公式。
- Yoo index 当前只定位到 `skill_control_10900101` 所在 bundle `ypm6fu6ccxdszvz7zhuinq`，没有直接列出这些 PathID 的对象落点；当前 Unity 导出目录中也没有对应独立 JSON。
- 下一步仍需要从 bundle typetree、Extractor 脚本或 IL2CPP 类型信息中找外部 element 对象结构。

### 2026-07-07：阶段 5-8K 行为脚本类型候选和 element 类型目录落地

本轮完成：

- `skill-asset-evidence.json` 新增顶层 `elementTypeCatalogEvidence`，把 IL2CPP dump 中和后续追踪最相关的 element 类型先固化为候选目录。
- 当前候选目录包含 `TSpElementParams` 和 `DamageElement` 两类证据：前者标注为能量配置参数，后者标注为伤害运行时 element。
- `effectLaneBehaviorChains[].resolvedBehaviors[].scriptTypeCandidate` 会在 `scriptPathId` 和导出字段签名吻合时输出行为脚本候选。
- 末音 `10900101` 的 HP 候选行为对象 `scriptPathId = 8289252000250858251` 已匹配到 `InjectToTargetKeyFrameBehaviorData` 候选，字段签名包含 `collisionLayer`、`elementalType`、`targetType`、`elementBaseDatas`、`toOwnElementBaseDatas`、`damageEffectId`。
- 全局当前样本统计显示：1 个当前技能存在脚本类型候选，element 类型目录候选数为 2。

验收结果：

- `npm run data:generate`：通过，重新生成 `skill-asset-evidence.json`。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1359 KB。

当前边界：

- `InjectToTargetKeyFrameBehaviorData` 是基于 `scriptPathId` 加字段签名的中置信候选，不是直接 MonoScript 资源名解析。
- `TSpElementParams` / `DamageElement` 只是 IL2CPP 类型候选目录，尚未证明 `m_FileID = 2` 的外部 element 对象本体就是这些类型。
- 当前仍没有解析外部 element 对象中的 `elementId`、`valueParam`、削韧、充能或公式 ID，不能把这些候选直接用于计算。

下一步：

- 阶段 5-8L 目标：解析 `skill_control_10900101` 所在 bundle `ypm6fu6ccxdszvz7zhuinq` 的外部 `m_FileID = 2` 对象表。
- 优先定位 `-5633710717881758712`、`7848597992417622553`、`2740651767650299388` 等 element PathID 的对象本体和 typetree。
- 若能解析对象体，继续验证它们是否对应 `TSpElementParams`、`DamageElement`、`skillsub_ele_value.elementId`、`valueParam`、削韧或充能字段；若不能解析，产出 Extractor 侧最小复现和缺失对象类型清单。

### 2026-07-07：阶段 5-8L 外部 element 对象本体解析落地

本轮完成：

- 新增 `scripts/resolve-azpr-element-objects.py`，复用 `C:\Codex\AzPr Extractor` 的 compact manifest 与 UnityPy 配置，从逻辑 bundle 切片中读取 element 对象本体。
- `skill-asset-evidence.json` 新增顶层 `externalElementObjectEvidence`，记录 `skill_control` 的 `m_FileID = 2` 外部 element PathID 到 `battle_element_assets` 对象本体的解析结果。
- 末音 `10900101` 的 `skill_control` 逻辑 bundle 为 `d_assets_resourcesassets_config_battle_skilllist_skill_control_10900101`，位于 pack `ypm6fu6ccxdszvz7zhuinq`，bundleIndex `75402`，offset `4741809`，size `18106`。
- 外部 element 对象本体位于共享池 `d_assets_resourcesassets_config_battle_element_assets`，bundleIndex `74227`，pack `fwtvymrpqatpf4ytyfvwqg`。
- 末音 `10900101` 的 8 个 `m_FileID = 2` preload PathID 已全部解析，未解析数为 0。
- 解析到的脚本类型分布：`TDamageElementParams = 3`、`TFxElementParams = 2`、`TFreezeFrameElementParams = 2`、`TBuffElementParams = 1`。
- 关键 HP element `ast_109001251 / elementConfigId = 109001251` 已解析出 `formulaParams.function_1 = 1`、`function_2 = 2`、`formulaParamValues` 包含 `3000` 和 `8500`，并带有 `weakBreakDamageRate = 7000`、`recoverSP = 5899`、`petRecoverSP = 22999`、`recoverInterval = 9999`、`mediaPackName = 11_109001_133`。

验收结果：

- `python scripts\resolve-azpr-element-objects.py --extractor "C:\Codex\AzPr Extractor" --skill-ids 10900101`：通过，8 个对象全部解析。
- `npm run data:generate`：通过，重新生成 `skill-asset-evidence.json`。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。

当前边界：

- 已确认外部 element 对象本体和字段，不等于已完成最终伤害/削韧/充能公式映射。
- `TDamageElementParams` 同时暴露 HP 参数、弱点/削韧倍率线索和 SP 回复字段，但各字段的单位、缩放和最终公式仍需继续验证。
- `formulaParams.function_1/function_2` 与 `skillsub_ele_value.valueParam`、`element_formula` 的关系尚未闭环，不能直接把 `formulaParamValues` 当成最终倍率。

下一步：

- 阶段 5-8M 目标：把 `externalElementObjectEvidence` 映射到动作三值计算链。
- 优先建立 `TDamageElementParams` 的字段语义表：HP 倍率候选、削韧候选、角色自身能量回复候选分别对应哪些字段、缩放和触发条件。
- 将末音 `10900101` 的 `ast_109001251` 作为第一条公式样本，和 `skill_level` 描述倍率、`skillsub_ele_value`、`element_formula`、角色面板攻击进行交叉校验。

### 2026-07-07：阶段 5-8M TDamageElementParams 三值字段映射落地

本轮完成：

- `skill-asset-evidence.json` 新增顶层 `damageElementFieldMappingEvidence`，把已解析出的 `TDamageElementParams` 对象按三条计算链拆开记录。
- HP 伤害候选链记录 `formulaParams.function_1/function_2`、`formulaParamValues`、`damageElementalType`、`physicalRatio`、`magicRatio`、`elementCalFactor`、`amp` 等字段。
- 敌人韧性削减候选链记录 `weakBreakDamageRate`、`hitType`、`knockBackId`、`knockBackForce`、`interruptPriority`、`useOneBreak` 等字段。
- 自身能量变化候选链记录 `recoverSP`、`petRecoverSP`、`recoverInterval`，并标注归属和共享规则仍待确认。
- `damageElementFieldMappingEvidence` 会尝试把 external element 的 `elementConfigId` 桥接到 `skill-logic-index.json` 的 `skillsub_ele_value.valueParam` 等级值。
- 末音 `10900101` 当前有 3 个 `TDamageElementParams`：`109001081` 与 `109001306` 各命中 12 行等级桥接，`109001251` 暂未在当前技能等级值中找到同 elementId 桥接。
- `109001081` / `109001306` 的桥接显示 `valueParam = 1#1600|7#10000` 到 `1#3360|7#10000`，其中参数 1 随等级变化，参数 7 恒为 10000；与对象内 `formulaParamValues` 的槽位对齐仍标记为未确认。

验收结果：

- `npm run data:generate`：通过，重新生成 `skill-asset-evidence.json` 和相关 generated 数据。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1359 KB。

当前边界：

- 5-8M 已完成字段语义候选映射，不等于最终公式已应用。
- `skillsub_ele_value.valueParam` 已能对部分 elementId 提供等级值桥接，但还不能证明这些值和 `formulaParamValues` 的覆盖、缩放或替换关系。
- HP 伤害仍需接角色面板、敌方防御/抗性/弱点、命中次数和目标状态；削韧仍需确认蓝原的韧性单位和目标规则；充能仍需确认能量归属、共享和 interval 触发。

下一步：

- 阶段 5-8N 目标：把 `damageElementFieldMappingEvidence` 接入动作结果 source 层和 Workbench 展示层。
- 每个动作的 `actionResultTimeline[]` 应能显示候选 HP、削韧、充能来源字段，但仍保持未确认公式为 `applied: false`。
- 优先用末音 `10900101` 的 `109001081` / `109001306` 桥接样本，建立 `skill level valueParam -> element field mapping -> action result source` 的可追溯链路，再继续验证公式缩放。

### 2026-07-08：阶段 5-8N 动作三值 source 层和 Workbench 展示落地

本轮完成：

- `actionResultTimeline[]` 的 `hpDamage`、`toughnessDamage`、`selfEnergyChange` 三槽新增 `sourceEvidence`，统一引用 `skill-asset-evidence.json.damageElementFieldMappingEvidence`。
- projection 层按 `skillId + action.logicModel.elementValues[].elementId` 匹配 damage element 候选；当前末音 `10900101` 的动作能桥接到 `109001081`、`109001306` 两个候选，`109001251` 保持 unbridged 记录。
- HP 槽保留当前 raw 投影已应用状态，同时在 `formulaBreakdown.layers.damageElementFields` 中挂上未应用的 `TDamageElementParams` 候选字段来源。
- 削韧槽在找到候选字段时从纯 `formula-unmapped` 升级为 `candidate-fields-found-formula-unmapped`，但数值仍为 0、`applied: false`。
- 充能槽在找到 `recoverSP/petRecoverSP/recoverInterval` 候选字段时记录 source；若动作有显式 SP 消耗，仍只应用显式 delta，充能获取公式保持未应用。
- Workbench 分析面板新增“三值来源”列表，按动作显示 HP / 削韧 / 充能候选 elementId 和当前动作三值结果。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、11 条测试通过。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、33 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1380 KB。

当前边界：

- 5-8N 只把候选字段接入动作结果 source 层和 UI 展示层，不改变 HP、削韧、充能的最终数值公式。
- 当前动作形态与 damage element 仍只通过同技能等级的 elementId 集合粗桥接，尚未确认“普通攻击/重击/闪击/跃击”等动作形态具体对应哪个 element 或命中帧。
- `skillsub_ele_value.valueParam` 与 `formulaParamValues` 的覆盖、缩放、替换顺序仍未确认。

下一步：

- 阶段 5-8O 目标：验证 `skillsub_ele_value.valueParam` 与 `TDamageElementParams.formulaParamValues` 的缩放/覆盖关系。
- 优先比较末音 `109001081` / `109001306` 的 1-12 级 `valueParam` 与 `formulaParamValues` 槽位，确认参数 1、7 是否覆盖 A/G 槽或另有公式入口。
- 若缩放关系仍不能确认，继续从 `element_formula`、IL2CPP `DamageElement` 运行时字段和 Extractor 侧 typetree 中寻找实际公式执行链。

### 2026-07-08：阶段 5-8O valueParam 与 formulaParamValues 槽位关系诊断落地

本轮完成：

- `damageElementFieldMappingEvidence.summary` 新增 `valueParamFormulaSlotDirectMatchObjects`、`valueParamFormulaSlotOverrideCandidateObjects`、`valueParamFormulaSlotUnresolvedObjects`。
- `skillLevelBridge.formulaParamAlignment` 新增参数级 `parameterSummaries`，记录每个 `valueParam` 参数与同编号 `formulaParamValues` 槽位的关系、等级范围、是否常量、直连等级、错配等级和数值递增规律。
- 末音 `10900101` 的 `109001081` / `109001306` 都得到同样结论：参数 `1 / A` 在 1-12 级从 `1600` 到 `3360`，每级 +160，而对象内 `formulaParamValues[0]` 固定为 `1000`，因此标记为 `level-scaling-override-candidate`。
- 参数 `7 / G` 在 1-12 级恒为 `10000`，与对象内 `formulaParamValues[6] = 10000` 每级直连匹配，因此标记为 `constant-direct-slot-match`。
- `109001251` 仍没有同 elementId 的技能等级桥接，因此 `formulaParamAlignment.conclusion = no-skill-level-bridge-for-formula-param-check`。

验收结果：

- `npm run data:generate`：通过，重新生成 `skill-asset-evidence.json` 和相关 generated 数据。
- `npm run test -- --run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1383 KB。

当前边界：

- `level-scaling-override-candidate` 说明 `valueParam` 很可能覆盖同编号公式槽位，但尚未证明公式执行顺序或最终倍率单位。
- `constant-direct-slot-match` 只证明同编号槽位的数值一致，不代表该槽一定参与最终公式。
- 当前仍未把参数 1/7 的关系接入运行时 `sourceEvidence` 展示，也未生成可读的未应用公式候选表达式。

下一步：

- 阶段 5-8P 目标：把 `formulaParamAlignment.parameterSummaries` 接入 `actionResultTimeline[].sourceEvidence` 和 Workbench 展示层。
- 为 HP 候选增加未应用公式候选视图，例如“槽 A 使用当前等级 valueParam 覆盖候选，槽 G 为常量匹配”，但仍保持 `applied: false`。
- 随后继续追 `formulaParams.function_1/function_2` 与 `element_formula` / IL2CPP `DamageElement` 的实际公式执行链。

### 2026-07-08：阶段 5-8P 公式槽位候选接入动作结果与 Workbench

本轮完成：

- `actionResultTimeline[].*.sourceEvidence.candidates[].skillLevelBridge` 新增 compact `formulaSlotAlignment`，把 `parameterSummaries` 带入运行时结果。
- `sourceEvidence.formulaSlotAlignmentSummary` 汇总当前动作匹配到的参数级槽位关系，避免 UI 直接深挖 generated JSON。
- Workbench 分析面板“三值来源”新增“公式候选”行，当前可显示 `A 覆盖候选 1,600-3,360 / G 常量匹配 10,000`。
- HP 公式候选仍挂在未应用 source 层；当前 `hpDamage.value` 仍是 raw 投影，不使用 A/G 候选计算最终伤害。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、11 条测试通过。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、33 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1385 KB。

当前边界：

- `formulaSlotAlignmentSummary` 只是动作级可见证据，不证明 A/G 槽已经进入最终伤害公式。
- 当前仍没有确认 `formulaParams.function_1/function_2` 的公式入口、变量含义、单位缩放和与 `element_formula` 的关联。
- 动作形态与 element 仍是技能等级 elementId 级桥接，尚未精确到动作段或命中帧。

下一步：

- 阶段 5-8Q 目标：追踪 `TDamageElementParams.formulaParams.function_1/function_2` 到 `element_formula` 或 IL2CPP `DamageElement` 执行链。
- 优先确认 `function_1 = 1`、`function_2 = 2` 是否对应 `element_formula` 行、运行时公式函数或固定计算分支。
- 若仍不能闭环，则建立 `formulaFunctionEvidence` 索引，记录 functionId 的所有本地出现位置、候选源码/IL2CPP 方法和未解析原因。

### 2026-07-08：阶段 5-8Q functionId 到 element_formula 证据索引

本轮完成：

- `scripts/generate-azpr-data.mjs` 将 `element_formula.json` 接入 `damageElementFieldMappingEvidence`。
- `hpDamage.formulaFunctionEvidence` 新增 `functionRefs`，逐条记录 `formulaParams.function_1/function_2` 到 `element_formula.id` 的候选匹配。
- 当前末音 `10900101` 的 3 个 `TDamageElementParams` 均为 `function_1 = 1`、`function_2 = 2`；合计 6 条引用全部命中 `element_formula`。
- `function_1 = 1` 对应 `element_formula[1].functionOutput = G/10000`，变量 `G` 对应 `formulaParamValues[6] = 10000`。
- `function_2 = 2` 对应 `element_formula[2].functionOutput = (self.ATK[0]*A)/10000`，变量 `A` 对应 `formulaParamValues[0] = 1000`；对已桥接的 `109001081 / 109001306`，同变量在 `skillsub_ele_value.valueParam` 中表现为 1-12 级 `1600 -> 3360` 的等级覆盖候选。
- 证据同时记录 IL2CPP 锚点：`FormulaParams.function_1/function_2/formulaParamValues`、`DamageElement.ExecuteEffect/Execute/BaseExecute/Parse`、`SkillElementInjector.ExecuteDamageElement`、`BattleConfigManager.elementFormulaConfig`、`ElementFormulaData` 和 `TDElementFormula`。

验收结果：

- `npm run data:generate`：通过，重新生成 `src/data/generated/*`。
- `npx vitest run src/__tests__/data/azprGenerated.test.js`：通过，1 个测试文件、9 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1394 KB。

当前边界：

- `formulaFunctionEvidence.applied` 固定为 `false`；它只证明 functionId 可以候选匹配到公式行，不证明最终 HP 伤害已经应用这些公式。
- 还未确认 `function_1` 与 `function_2` 的组合顺序、加乘关系、命中次数、目标防御/抗性、元素减免、暴击/增伤和目标状态。
- 还未把公式函数候选显示到动作结果和 Workbench；当前 UI 仍只显示 A/G 槽位关系摘要。

下一步：

- 阶段 5-8R 目标：把 `hpDamage.formulaFunctionEvidence` 接入 `actionResultTimeline[].hpDamage.sourceEvidence` 和 Workbench 三值来源展示。
- UI 只显示未应用公式候选，例如 `f1 G/10000 / f2 self.ATK*A/10000`，并继续保持 raw HP、削韧和充能数值不变。
- 随后再进入公式执行层验证：确认 `DamageElement` 如何组合 `function_1/function_2`、如何使用 `valueParam` 覆盖 A 槽，以及如何叠加敌方防御/抗性。

### 2026-07-08：阶段 5-8R 公式函数候选接入动作结果与 Workbench

本轮完成：

- `src/simulation/projection/projectSimulationResult.js` 在 compact HP 候选中保留 `formulaFunctionEvidence`。
- `actionResultTimeline[].hpDamage.sourceEvidence` 新增 `formulaFunctionSummary`，按当前动作桥接到的 damage element 汇总 `function_1/function_2`。
- 当前末音 `10900101` 的动作 source 可显示：
  - `function_1 = 1`、`G/10000`、变量 `G`、槽位 7、候选值 `10000`、候选 element `109001081 / 109001306`。
  - `function_2 = 2`、`(self.ATK[0]*A)/10000`、变量 `A`、槽位 1、候选值 `1000`、候选 element `109001081 / 109001306`。
- Workbench 分析面板“三值来源”新增公式函数候选行，当前显示 `公式函数候选 f1 G/10000 / f2 self.ATK[0]*A/10000`。
- 该 UI 仍是未应用证据展示；`hpDamage.value` 继续使用现有 raw HP 投影，削韧和充能仍保持独立未映射占位。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `node --check src/simulation/projection/projectSimulationResult.js`：通过。
- `npx eslint src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过；当前 ESLint 配置会忽略 Vue 文件并给出提示。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1397 KB。

当前边界：

- `formulaFunctionSummary` 是动作级轻量摘要，不证明 `DamageElement` 已按该公式计算最终伤害。
- 当前还未确认 `function_1/function_2` 是相乘、相加、主/兜底函数，还是运行时前后处理步骤。
- 当前也未确认 A 槽应使用 `formulaParamValues[0] = 1000`、技能等级 `valueParam` 的 `1600 -> 3360`，还是二者存在覆盖/回退规则。

下一步：

- 阶段 5-8S 目标：建立未应用公式候选数值预览与差异诊断。
- 以 `self.ATK[0]`、A/G 槽候选和当前技能等级 `valueParam` 为输入，生成不参与最终数值的 `formulaCandidatePreview`，对比现有 `skill_level` 描述倍率 raw HP 投影。
- 若候选预览与描述倍率差距明显，继续追 IL2CPP `DamageElement` 对 `function_1/function_2` 的组合顺序、等级覆盖规则和命中段拆分。

### 2026-07-08：阶段 5-8S 未应用公式候选预览与差异诊断

本轮完成：

- `actionResultTimeline[].hpDamage.sourceEvidence` 新增 `formulaCandidatePreview`。
- `formulaCandidatePreview` 会读取当前动作桥接到的 damage element、当前等级 `logicModel.elementValues.valueParam`、`TDamageElementParams.formulaParamValues` 和当前 raw 投影的 `self.ATK[0]`。
- 当前末音 `10900101` 普攻样本：
  - `function_1 = G/10000` 用 `G = 10000` 得到 `1`，标记为标量候选，不与 raw HP 直接比较。
  - `function_2 = (self.ATK[0]*A)/10000` 用 `formulaParamValues.A = 1000` 得到 `192`。
  - 同一公式用当前等级 `valueParam.A = 1600` 得到 `307.2`，四舍五入为 `307`。
  - 当前 `skill_level` 描述倍率 raw HP 投影为 `12461`，因此 f2 等级值预览约为 raw 的 `2.5%`，诊断为 `large-difference`。
- Workbench 三值来源新增候选预览行：`候选预览 f2 等级值 307 vs raw 12,461，约 2.5%`。
- 该 preview 不参与 `hpDamage.value`，也不改变削韧或充能结果。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `node --check src/simulation/projection/projectSimulationResult.js`：通过。
- `npx eslint src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过；当前 ESLint 配置会忽略 Vue 文件并给出提示。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1404 KB。

当前边界：

- `formulaCandidatePreview` 只证明候选公式能被代入求值，并暴露它与描述倍率 raw 投影的差异。
- 当前巨大差异说明 `element_formula` 候选不能直接替换 `skill_level` 描述倍率；仍需确认 function 组合顺序、命中段绑定、每段倍率、是否存在动作总倍率/单段倍率差异，以及 A 槽覆盖规则。
- 还没有将任何 formula candidate 迁入 `appliedLayerKeys`。

下一步：

- 阶段 5-8T 目标：追踪 `DamageElement` 的真实 function 组合顺序、命中段绑定和等级覆盖规则。
- 优先从 IL2CPP `ExecuteDamageElement` / `FormulaUtility.OutputDamageData`、`DamageElement.Parse/BaseExecute`、`skill_control` 行为节点命中帧与 element 绑定入手。
- 若仍无法闭环，则扩大样本到其他角色/动作，比较 `formulaCandidatePreview` 与 `skill_level` 描述倍率的差异模式，判断公式候选是单 hit、子段、额外倍率还是中间量。

### 2026-07-08：阶段 5-8T function 组合诊断矩阵

本轮完成：

- `formulaCandidatePreview` 新增 `combinationPreviews`，按候选 element 计算简单 function 组合：
  - `function_2`
  - `function_1 * function_2`
  - `function_1 + function_2`
- 每种组合分别用 `TDamageElementParams.formulaParamValues` 和当前等级 `skill_logic.currentLevel.valueParam` 两套输入计算，并与 raw HP 投影比较。
- 当前末音 `10900101` 普攻样本：
  - `function_2-current-level-value-param` 仍为 `307`。
  - `function_1 * function_2` 因 `function_1 = G/10000 = 1`，仍为 `307`。
  - `function_1 + function_2` 为 `308`。
  - 要接近 raw HP `12461`，`f2` 等级值还需要约 `×40.6`；按当前描述中的 5 hit 平均，也仍需要每 hit 约 `×8.1`。
- Workbench 三值来源新增组合诊断行：`组合诊断 f2 需 ×40.6 才接近 raw / 每 hit ×8.1`。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run test -- --run`：通过，12 个测试文件、104 条测试通过。
- `node --check src/simulation/projection/projectSimulationResult.js`：通过。
- `npx eslint src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过；当前 ESLint 配置会忽略 Vue 文件并给出提示。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示，Workbench chunk 约 1408 KB。

当前边界：

- 简单的 `function_1/function_2` 加法或乘法不能解释当前 raw HP 投影。
- 这不证明候选公式无效，只说明还缺命中段绑定、动作描述倍率关系、运行时额外缩放或其他 DamageElement 逻辑。
- 仍没有把 formula candidate 加入 `appliedLayerKeys`。

下一步：

- 阶段 5-8U 目标：扩大样本并分析差异模式。
- 至少选择同角色多个动作形态或其他已有 `TDamageElementParams` 技能，生成 `formulaCandidatePreview` / `combinationPreviews` 的跨动作摘要。
- 判断 `requiredScaleToRaw` 是否稳定、是否与 hitCount、描述倍率、`formulaParamValues` 特定槽、`amp`、`physicalRatio`、`elementCalFactor` 或命中行为节点数量相关。

### 2026-07-08：阶段 5-8U 跨动作 formula candidate 差异模式摘要

本轮完成：

- 在仿真 `summary` 中新增 `formulaCandidatePatternSummary`，聚合 `actionResultTimeline[].hpDamage.sourceEvidence.formulaCandidatePreview.combinationPreviews`。
- 默认优先比较 `function_2-current-level-value-param`，并保留每个动作的：
  - 动作名、动作形态、`rawMultiplier`、raw HP 投影值。
  - 候选公式预览值、`requiredScaleToRaw`、`requiredPerHitScaleToRaw`。
  - 候选 `TDamageElementParams.damageFields` 原始字段：`amp`、`physicalRatio`、`elementCalFactor`、`formulaParamsCount`。
- Workbench 分析面板“三值来源”下新增候选模式摘要。单动作默认显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1
```

- 现有四动作样本【普通攻击 / 重击 / 闪击 / 跃击】已纳入测试：
  - 四个动作的 `function_2-current-level-value-param` 候选值均为 `307`。
  - raw 描述倍率分别为 `649% / 190% / 40% / 136%`。
  - `requiredScaleToRaw` 随动作描述倍率变化，当前范围约 `×2.5` 到 `×40.6`。
  - `formulaCandidatePatternSummary.previewValueStatus = same-preview-across-actions`。
  - `formulaCandidatePatternSummary.scaleSpreadStatus = varies-by-action-variant`。
  - `formulaCandidatePatternSummary.missingRuntimeScaleStatus = tracks-description-multiplier-before-runtime-hit-mapping`。

初步判断：

- 当前 `element_formula` f2 预览更像一个尚未绑定动作描述倍率/命中节点的中间值，而不是可直接替代 `skill_level` 描述倍率的最终 HP 公式。
- `amp = 6553`、`physicalRatio = 10000`、`elementCalFactor = 10000` 仍按原始缩放值记录，暂不擅自归一化。
- 四动作样本仍无法解释 `skill_level` 描述倍率和 runtime DamageElement 的真实关系；必须继续追命中行为节点数量、命中帧、element 绑定和额外缩放。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npx eslint src/simulation/projection/projectSimulationResult.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npx prettier --check src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `npm test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npx eslint src/simulation/projection/projectSimulationResult.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npx prettier --check src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `npx eslint . --ext .vue,.js,.jsx,.cjs,.mjs`：未通过，阻塞点是既有 `scripts/generate-azpr-data.mjs` 顶层 `await` 被当前 ESLint 配置解析为 `Cannot use keyword 'await' outside an async function`；本阶段未修改该脚本。

当前边界：

- `formulaCandidatePatternSummary.applied` 必须保持 `false`。
- `formulaCandidatePatternSummary` 只做证据聚合，不改变 HP、削韧、充能数值。
- 不能基于当前差异模式把 f2 或 `amp/physicalRatio/elementCalFactor` 推入最终公式。

下一步：

- 阶段 5-8V 目标：把 `requiredScaleToRaw` 差异模式与 `skill_control` 行为节点命中数量、命中帧和 element 绑定关系关联起来。
- 优先统计末音 `10900101` 的 `InjectToTargetKeyFrameBehaviorData`、`elementBaseDatas`、hitEffects、stateName 与动作形态之间的绑定数量。
- 对四动作样本补充“行为节点候选数 / element 引用数 / 帧窗口”字段，判断 `f2` 候选值是否是单 hit、行为节点中间值、动作总倍率的一部分或额外公式入口。

### 2026-07-08：阶段 5-8V skill_control 行为节点关联摘要

本轮完成：

- `formulaCandidatePatternSummary` 新增 `skillControlBehaviorCorrelations`，从 `skill-asset-evidence.json.currentSkillControlEvidence` 读取当前技能的行为链证据。
- 每个动作的 `actionSummaries[]` 新增精简版 `skillControlBehaviorCorrelation`，用于把 f2 候选差异与当前技能级 HP 行为节点证据放在同一结果里。
- Workbench 候选模式摘要新增行为节点提示，当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 13f/16f/19f · Skill0_6/Skill0_1
```

当前末音 `10900101` 证据：

- `hpLaneCandidateCount = 5`：`skill_control` 中 HP 伤害候选行为节点数。
- `resolvedHpBehaviorRefCount = 5`：HP lane 的行为引用都已解到本地 MonoBehaviour。
- `externalElementBaseRefCount = 13`，`resourceMapMatchedElementBaseRefCount = 13`：外部 element 引用均能匹配到根 `skillResourceMaps`。
- 当前采样到的 HP 行为链帧为 `13f / 16f / 19f`。
- 资源归属包含 `Skill0_6`、`Skill0_1`，hitEffects 包含 `11_109001_133`、`11_109001_005`、`11_109001_116`。

初步判断：

- 现在可以把“f2 候选值固定为 307，但 raw HP 缩放随动作倍率变化”的现象，与“同一技能存在 5 个 HP 行为候选节点、多个命中帧和多个 stateName/hitEffects”放在同一证据层观察。
- 仍不能确认【普通攻击 / 重击 / 闪击 / 跃击】各自动作形态对应哪一条行为节点；因此 `correlationStatus` 明确记录为 `skill-level-only-action-variant-binding-unresolved`。
- 该阶段仍没有把行为节点、f2 候选或 `requiredScaleToRaw` 推入最终 HP、削韧或充能公式。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run lint`：通过，0 error，16 个既有 warning。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。

当前边界：

- `skillControlBehaviorCorrelations.applied` 必须保持 `false`。
- `skillControlBehaviorCorrelations` 是技能级证据，不是动作形态级绑定。
- 当前只消费 `skill-asset-evidence.json` 中已有采样行为链；若要覆盖全部 5 个 HP 行为节点的完整帧/资源绑定，后续需要扩大或调整生成脚本的行为链采样限制。

下一步：

- 阶段 5-8W 目标：把技能级 HP 行为节点继续推进到动作形态级候选绑定。
- 优先尝试用 `stateName`、`subSkillId`、hitEffects、行为节点名称、帧窗口和 `skill_level` 动作标签建立候选映射。
- 若现有 `effectLaneBehaviorChains` 采样不足，则调整 `scripts/generate-azpr-data.mjs` 的行为链摘要或新增专门的动作绑定 evidence，而不是在前端临时猜测。

### 2026-07-08：阶段 5-8W 动作形态级行为绑定候选

本轮完成：

- `scripts/generate-azpr-data.mjs` 新增按 lane 分组保留字段：
  - `effectLaneCandidatesByLane`
  - `effectLaneBehaviorChainsByLane`
- 重新生成 `skill-asset-evidence.json`，末音 `10900101` 当前 HP lane 专用样本完整保留 5 条候选/行为链，不再被表现、时序 lane 的全局采样截断。
- `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[]` 新增：
  - `sampledHpLaneCandidateCount`
  - `actionVariantBindingSummary`
  - `actionVariantBindingCandidates`
  - `actionVariantBindingStatus`
- `actionSummaries[].skillControlBehaviorCorrelation` 新增精简版 `actionVariantBindingCandidate`，让每个动作结果可看到自己的候选绑定。
- Workbench 候选模式摘要新增单动作绑定提示，当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f
```

当前末音 `10900101` HP 行为链完整样本：

- `普通-攻击碰撞 / 12-13f / Skill0_1 / hitEffect 11_109001_116`
- `普通-攻击碰撞 / 13-14f / Skill0_1 / hitEffect 11_109001_116`
- `攻击碰撞 / 13-14f / Skill0_6 / hitEffects 11_109001_133, 11_109001_005`
- `攻击碰撞 / 16-17f / Skill0_6 / hitEffects 11_109001_133, 11_109001_005`
- `攻击碰撞 / 19-20f / Skill0_6 / hitEffects 11_109001_133, 11_109001_005`

动作形态候选绑定：

- 【普通攻击 / 普攻】中置信候选：`普通-攻击碰撞` + `Skill0_1` + `subSkillId = 10900101`。
- 【重击 / 闪击 / 跃击】低置信共享候选：`攻击碰撞` + `Skill0_6` + `subSkillId = 109001011`。
- 这些候选仍只说明“可能对应”，不能当作已确认 runtime 绑定；`bindingStatus` 保持 `*-candidate-unconfirmed`。

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。

当前边界：

- `actionVariantBindingCandidates[].applied` 必须保持 `false`。
- 当前只建立候选绑定，不确认普通攻击 5 段内部每 hit 对应关系。
- `Skill0_6` 同时覆盖重击、闪击、跃击候选，仍需更多证据拆分具体动作形态。

下一步：

- 阶段 5-8X 目标：验证 `Skill0_1` / `Skill0_6` 与【普通攻击 / 重击 / 闪击 / 跃击】的真实对应关系。
- 优先追 `skill_control` 中 `stateName`、动画状态、trackIndex、timelineGroupIndex、combo/timingControl 节点与动作标签之间的关系。
- 若本地 JSON 仍不足，继续沿 Extractor 的 Unity 资源、Yoo index 或 IL2CPP runtime 方法追动作状态切换和 DamageElement 执行入口。

### 2026-07-08：阶段 5-8X-A 状态/时序控制证据索引

本轮完成：

- `scripts/generate-azpr-data.mjs` 新增 `AnimationBehaviorData` 与 `EventBridgeBehaviorData` 脚本类型候选。
- `skill-asset-evidence.json.currentSkillControlEvidence[].stateTimingEvidence` 新增状态/时序证据摘要：
  - HP 状态窗口：5 个。
  - timingControl 行为链：5 个。
  - 动画状态控制：1 个。
  - EventBridge 控制：4 个。
- 仿真投影 `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[]` 接入 `stateTimingEvidence`。
- `actionSummaries[].skillControlBehaviorCorrelation.stateTimingFindings` 会按动作主置信候选过滤对应 state finding。
- Workbench 候选模式摘要新增状态证据提示。

当前末音 `10900101` 状态/时序发现：

- `Skill0_6`：有 `动作 / AnimationBehaviorData`，窗口 `0-230f`，`selectedStateName = Skill0_6`，并有 3 个 HP 命中窗口 `13f / 16f / 19f`。
- `Skill0_1`：有 2 个 HP 命中窗口 `12f / 13f`，但同一 `skill_control_10900101` 中尚未找到动画状态控制；当前状态为 `hp-state-resource-map-only-no-local-animation-control`。
- EventBridge 行为包含：
  - `连击桥接 0-29f`，目标 `skillId = 80102`，`frameIndex = 8`。
  - `立即跳转 16-43f`，目标 `skillId = 10900102`。
  - `移动打断 / 全程打断` 在 `29f` 后开放 attack/move/jump/dodge 等输入。

Workbench 当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 仅资源命中 / Skill0_6 动画+命中
```

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。

当前边界：

- `stateTimingEvidence.applied` 必须保持 `false`。
- `Skill0_6` 的动画+命中证据强于 `Skill0_1`，但仍不能证明重击/闪击/跃击分别对应哪条命中。
- `Skill0_1` 可能由别的 skill_control、动作状态切换、连击桥接或 runtime 状态机引入；当前不能把它直接视为“普通攻击完整动画”。

下一步：

- 阶段 5-8X-B 目标：追 `Skill0_1` 的动画状态来源、`10900102 / 80102` 等 EventBridge 目标技能含义，以及这些跳转/桥接节点与【普通攻击 / 重击 / 闪击 / 跃击】的真实对应关系。
- 优先扫描相关 `skill_control_10900102.asset`、`skill_control_80102.asset`、Yoo index 和 IL2CPP `EventBridgeBehaviorData` / 技能状态切换调用。

### 2026-07-08：阶段 5-8X-B EventBridge 目标技能追踪

本轮完成：

- `stateTimingEvidence` 新增 `eventBridgeTargetSkillControlEvidence`，用于索引 EventBridge 指向的目标技能。
- 目标技能摘要接入 `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[].stateTimingEvidence`。
- Workbench 候选模式摘要新增目标技能提示。

当前末音 `10900101` EventBridge 目标结论：

- `10900102`：存在 `skill_control_10900102.asset`，`skill.json.parentSkill = 10900101`，关系为 `child-skill-of-source`。
- `10900102` 的动画状态为 `Skill0_2`，分 3 段 `AnimationBehaviorData`：`0-17f`、`17-23f`、`23-318f`。
- `10900102` 有 4 个 `普攻-攻击碰撞` HP timeline 候选，帧为 `6-7f`、`10-11f`、`14-15f`、`26-27f`。
- `10900102` 的 EventBridge 继续指向 `10900103`，说明普攻链很可能通过多个子 skill_control 串联。
- `80102`：在 `SkillList/skill_control_80102.asset` 和当前 `skill.json` 中均缺失，暂记为 `missing-skill-control-directory / missing-skill-table-row`，不能当作可用技能控制证据。

Workbench 当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 仅资源命中 / Skill0_6 动画+命中 · 目标技能 10900102->Skill0_2 / 80102缺失
```

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。

当前边界：

- `eventBridgeTargetSkillControlEvidence.applied` 必须保持 `false`。
- `10900102 -> Skill0_2` 证明 EventBridge 目标链能追到普攻相关子 skill_control，但还不能反推 `Skill0_1` 的动画状态来源。
- `80102` 缺失可能代表非技能表 ID、运行时桥接枚举或其他资源 ID，不能直接按技能处理。

下一步：

- 阶段 5-8X-C 目标：沿 `10900102 -> 10900103` 普攻连段链递归索引目标 skill_control，确认 `Skill0_1 / Skill0_2 / ...` 与普通攻击段数、连击桥接和动作形态的对应关系。
- 若递归链能覆盖普攻多段，再把普通攻击候选绑定从单技能级证据升级为“普攻连段链候选”。

### 2026-07-08：阶段 5-8X-C 普攻连段链递归索引

本轮完成：

- `stateTimingEvidence` 合并同一 `skill_control` 内直接挂载的 `AnimationBehaviorData` / `EventBridgeBehaviorData`，时间轴链证据优先保留轨道名和帧窗，直接扫描只补缺口。
- `eventBridgeTargetSkillControlEvidence` 从单跳目标扩展为递归链索引，当前深度上限为 6，记录 `directTargetSkillIds`、`targetSkillIds`、`chainDepthMax`、`discoveryDepth`、`discoveredFromSkillId`。
- 新增 `normalAttackChainCandidate`，把 `child-skill-of-source` 的目标 skill_control 汇总为普攻连段候选。
- 目标 skill_control 摘要改为全量扫描目标目录，避免高文件数目录里后段动画状态被样本上限截断。
- 仿真投影和 Workbench 摘要接入普攻链候选；Workbench 当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 动画+命中 / Skill0_6 动画+命中 · 普攻链 10900102->Skill0_2 / 10900103->Skill0_3 / +2 · 目标缺失 80102
```

当前末音 `10900101` 普攻链证据：

- 主 skill_control：`Skill0_1` 与 `Skill0_6` 均已有动画+命中候选。
- 直接 EventBridge 目标：`80102`、`10900102`。
- 递归普攻链：`10900102 -> 10900103 -> 10900104 -> 10900105`，均为 `parentSkill = 10900101` 的子 skill_control。
- 链路动画状态：`Skill0_2 / Skill0_3 / Skill0_4 / Skill0_5`。
- 链路 HP timeline 候选总数：30。
- 链路 HP 轨道名包含：`普攻-攻击碰撞`、`攻击碰撞1`、`无属性-攻击碰撞2`、`最后1hit-攻击碰撞`、`最后大hit-攻击框`、`左转圈hit -攻击框`、`上挑hit-攻击框`。
- `80102` 仍缺少 `skill_control_80102.asset` 和 `skill.json` 行，继续标记为缺失目标，不能当作已解析技能。

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。

当前边界：

- `normalAttackChainCandidate.applied` 仍为 `false`。
- 当前只证明普攻连段 skill_control 链和状态/HP 候选存在，尚未把 30 个 HP timeline 候选映射到“普通攻击第 1/2/3/4/5 段”的最终每 hit 序列。
- `Skill0_6` 仍是重击/闪击/跃击共享低置信候选，需要继续拆分动作形态。
- `80102` 的含义仍未确认，可能是非技能表 ID、枚举或其他资源 ID。

下一步：

- 阶段 5-8Y 目标：把普攻链候选升级为普通攻击多段/每 hit 绑定候选。
- 优先按 `discoveryDepth`、动画状态名、HP 轨道名、候选帧、`subSkillId`、hitEffect 和技能描述的普攻段数建立 `normalAttackHitChainCandidate`。
- 仍保持所有候选 `applied: false`，直到能用 runtime 行为或更强资源证据确认每 hit 的最终伤害/削韧/充能节点。

### 2026-07-08：阶段 5-8Y 普通攻击多段 / 每 hit 候选

本轮完成：

- `stateTimingEvidence` 新增 `normalAttackDescriptionEvidence`，从技能描述【普通攻击】段落解析普通攻击段数。
- `eventBridgeTargetSkillControlEvidence` 新增 `normalAttackHitChainCandidate`，把主 skill_control 的 `Skill0_1` 与递归子 skill_control 的 `Skill0_2-5` 组织成普通攻击 1-5 段候选。
- 目标 skill_control 的 `hpTimelineCandidates` 样本上限从 8 提高到 `SKILL_EFFECT_LANE_SPECIFIC_SAMPLE_LIMIT`，确保当前 9/10 hit 的子技能不会被摘要截断。
- 仿真投影保留 `normalAttackHitChainCandidate` 的压缩摘要，Workbench 普攻链提示新增命中候选覆盖数。

当前末音 `10900101` 普通攻击命中链候选：

- 描述段数：`expectedHitCount = 5`，来源为 `skill.description.plain` 的【普通攻击】段落。
- 覆盖状态：`candidateHitGroupCount = 5`，`coverageStatus = matches-description-hit-count`。
- 第 1 段：`10900101 / Skill0_1 / 2` 个 HP 候选，帧 `12f / 13f`，`subSkillId = 10900101`，hitEffect `11_109001_116`。
- 第 2 段：`10900102 / Skill0_2 / 4` 个 HP 候选，帧 `6f / 10f / 14f / 26f`。
- 第 3 段：`10900103 / Skill0_3 / 9` 个 HP 候选，帧 `12f / 18f / 24f / 30f / 36f / 42f / 48f / 54f / 60f`。
- 第 4 段：`10900104 / Skill0_4 / 7` 个 HP 候选，帧 `7f / 11f / 15f / 29f / 45f / 49f / 53f`。
- 第 5 段：`10900105 / Skill0_5 / 10` 个 HP 候选，帧 `4f / 8f / 12f / 16f / 20f / 47f / 56f / 61f / 66f / 71f`。
- 总 HP timeline 候选：32 个。

Workbench 当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 动画+命中 / Skill0_6 动画+命中 · 普攻链 10900102->Skill0_2 / 10900103->Skill0_3 / +2 · 命中候选 5/5段 · 目标缺失 80102
```

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。

当前边界：

- `normalAttackHitChainCandidate.applied` 仍为 `false`。
- 当前只把“普通攻击第几段”与 skill_control / 动画状态 / HP timeline 候选组对齐，还没有把每个 HP 候选绑定到最终 `TDamageElementParams`、削韧字段或充能字段。
- 第 2-5 段的 HP timeline 候选目前只有 timeline 名称、轨道名和帧窗，尚未像主 skill_control 的 5 个 HP 行为链一样解析到 `elementBaseDatas` / `TDamageElementParams`。

下一步：

- 阶段 5-8Z 目标：把 `normalAttackHitChainCandidate.hitGroups[]` 继续向下解析到每 hit 的 `behaviorList -> elementBaseDatas -> TDamageElementParams`，为普通攻击每 hit 的 HP、削韧、充能三值公式候选建立可追踪来源。
- 优先从 `10900102-10900105` 的 HP timeline candidate 追本地 behavior 引用和外部 element 对象，而不是直接沿用主 skill_control 的 raw HP 投影。

### 2026-07-08：阶段 5-8Z 普攻每 hit 三值字段候选

本轮完成：

- `eventBridgeTargetSkillControlEvidence.targetSkillControls[]` 的目标 skill_control 摘要新增 `skillResourceMapEvidence`、`behaviorReferenceSummary` 和 `hpBehaviorChains`，第 2-5 段不再只停留在 HP timeline 名称/帧窗。
- `normalAttackHitChainCandidate.hitGroups[]` 新增每段行为链摘要、外部 `elementBaseDataRefs`、`TDamageElementParams` 字段映射摘要。
- `externalElementObjectEvidence` / `damageElementFieldMappingEvidence` 的解析范围从源技能扩展到 EventBridge 普攻子 skill_control。
- `compactEventBridgeTargetSkillControlEvidence()` 保留每段 hit 的行为链/三值字段压缩摘要，Workbench 普攻链提示新增三值候选覆盖数。

当前末音 `10900101` 普通攻击 5 段三值字段候选：

- 覆盖状态：`damageElementFieldMappingStatus = all-hit-groups-have-damage-element-field-mappings`。
- 覆盖段数：`damageElementMappedHitGroupCount = 5 / candidateHitGroupCount = 5`。
- 三值字段映射总数：12 个 `TDamageElementParams`。
- 第 1 段：2 条行为链、4 个外部 element 引用、2 个 damage element：`109001081 / 109001306`。
- 第 2 段：4 条行为链、9 个外部 element 引用、2 个 damage element：`109001018 / 109001137`。
- 第 3 段：9 条行为链、19 个外部 element 引用、2 个 damage element：`109001134 / 109001280`。
- 第 4 段：7 条行为链、16 个外部 element 引用、3 个 damage element：`109001021 / 109001135 / 109001328`。
- 第 5 段：10 条行为链、18 个外部 element 引用、3 个 damage element：`109001117 / 109001285 / 109001313`。

Workbench 当前默认样本显示：

```text
候选模式 1 动作 · f2 缩放 ×40.6 / 每 hit ×8.1 / 行为节点 5 候选 · 帧 12f/13f/16f/19f · Skill0_6/Skill0_1 · 绑定候选 普攻->Skill0_1 12f/13f · 状态证据 Skill0_1 动画+命中 / Skill0_6 动画+命中 · 普攻链 10900102->Skill0_2 / 10900103->Skill0_3 / +2 · 命中候选 5/5段 · 三值候选 5/5段 · 目标缺失 80102
```

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，3 个测试文件、53 条测试通过。

当前边界：

- `normalAttackHitChainCandidate`、`hitGroups[]` 和 `damageElementFieldMappings[]` 仍全部是 `applied: false` 的候选证据。
- 当前只确认“每段 hit 可追到哪些三值字段候选”，尚未确认 DamageElement 执行顺序、同段多候选的组合方式、每 hit 倍率分配、最终伤害/削韧/充能公式和敌人防御/抗性应用顺序。
- `externalElementObjectEvidence` 当前解析到 6 个技能、43 个 external element PathID；这是候选范围扩展，不代表所有技能都已完成公式应用。

下一步：

- 阶段 5-8AA 目标：把普通攻击每段 `damageElementFieldMappings[]` 接入每动作三值曲线的“未应用 per-hit 增量预览”，让 HP、韧性、能量三条曲线能按 60fps 帧点显示候选变化。
- 优先输出 `actionResultTimeline[].hitCandidates[]` 或等价字段，按 hitGroup 保留帧点、elementId、HP 公式函数、削韧字段、充能字段和未确认原因；最终数值仍保持 raw/占位，直到公式组合顺序确认。

### 2026-07-08：阶段 5-8AA 普攻 per-hit 三值增量预览

本轮完成：

- `actionResultTimeline[]` 新增 `hitCandidateSummary` 和 `hitCandidates[]`。
- 普通攻击动作会从 `normalAttackHitChainCandidate.hitGroups[]` 派生每 hit 候选预览；非普攻动作暂返回 `no-per-hit-candidates`。
- 每条 `hitCandidates[]` 保留：
  - 动作 ID、动作形态、原 skillId、hit skillId、hitIndex。
  - 60fps 帧点：`frameStartFrames`、`primaryFrame`、`timeMsCandidates`、`candidateTimeMs`。
  - 该 hit 的 `damageElementElementConfigIds` 和 `damageElementFieldMappingCount`。
  - HP 候选公式函数 ID、削韧 `weakBreakDamageRate` 等字段、自身能量 `recoverSP/petRecoverSP/recoverInterval` 等字段。
  - `unresolved` 列表，显式标记执行顺序、多候选组合、每 hit 权重、防御抗性、能量归属/间隔规则未确认。
- Workbench 三值来源行新增逐 hit 候选摘要。

当前末音 `10900101` 默认普攻动作结果：

- `hitCandidateSummary.status = all-hit-candidates-have-damage-element-fields`。
- `hitCandidateCount = 5`，`mappedHitCandidateCount = 5`。
- `damageElementFieldMappingCount = 12`。
- `primaryFrames = 12f / 6f / 12f / 7f / 4f`，按普通攻击第 1-5 段的本段相对帧记录。
- 第 1 段保留动作级 element 桥接：`actionLevelElementMatchCount = 2`，elementId 为 `109001081 / 109001306`。
- 第 2-5 段暂是 hitGroup 级候选，尚未桥接到当前动作形态的 `skillsub_ele_value` 等级行。

Workbench 当前默认样本显示：

```text
逐hit候选 5/5段 · 三值字段 12 · 帧 12f/6f/12f/7f/4f
```

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- `hitCandidates[]` 是曲线预览来源，不是最终公式输出；所有候选仍为 `applied: false`。
- 当前总伤害仍来自描述倍率 raw 投影，韧性和能量仍不应用候选字段。
- `candidateTimeMs` 当前按动作开始时间加 hitGroup 相对帧点计算，尚未纳入连段子 skill_control 的真实切换时长、取消窗口或输入时机。

下一步：

- 阶段 5-8AB 目标：把 `hitCandidates[]` 聚合成可绘制的 HP / 韧性 / 自身能量候选曲线数据，例如 `candidateValueSeries` 或等价结构。
- Workbench 应在分析/曲线区域展示三条未应用候选曲线或帧点标记，继续明确区分“当前实际投影值”和“候选公式字段预览”。

### 2026-07-08：阶段 5-8AB hitCandidates 候选三曲线聚合

本轮完成：

- `projectSimulationResult()` 新增顶层 `candidateValueSeries`，从 `actionResultTimeline[].hitCandidates[]` 聚合 HP、削韧、自身能量三条候选曲线。
- `summary.candidateValueSeriesSummary` 记录曲线数、点数、hit 候选数和动作数，仍统一标记 `applied: false`。
- Workbench 分析面板新增“候选曲线”区域，显示每条候选曲线的点数、数值范围和未应用小折线。
- 回归测试覆盖模拟输出和 Workbench 展示。

当前末音 `10900101` 默认普攻动作候选曲线：

- `candidateValueSeries.status = candidate-value-series-found-unapplied`。
- `seriesCount = 3`，`pointCount = 15`，`hitCandidateCount = 5`，`actionCount = 1`。
- HP 参数候选：`2500 / 4800 / 3000 / 5400 / 13000`，来源为 `TDamageElementParams.formulaParamValues`，已过滤常量槽 `10000`。
- 削韧候选：`7000 / 7000 / 7000 / 7000 / 7000`，来源为 `TDamageElementParams.weakBreakDamageRate`。
- 能量候选：`2700 / 2599 / 2399 / 3000 / 2599`，来源为 `TDamageElementParams.recoverSP`。

Workbench 当前默认样本显示：

```text
候选曲线 15
HP参数候选 5点 · 2,500-13,000 · raw-param
削韧候选 5点 · 7,000 · raw-field
能量候选 5点 · 2,399-3,000 · raw-field
```

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- `candidateValueSeries` 是未应用候选曲线，不是最终伤害、削韧或充能计算结果。
- HP 曲线当前取每个 hit 的候选参数最大值作为点值，仅用于对比和可视化；真实公式组合顺序、同段多候选处理、敌人防御/抗性和能量间隔规则仍未确认。
- 曲线帧点仍沿用 `hitCandidates[].candidateTimeMs` 的动作相对帧点，尚未把连段子 skill_control 的真实切换时长、取消窗口或输入时机展开成绝对时间轴。

下一步：

- 阶段 5-8AC 目标：把 `candidateValueSeries` 转成时间轴绝对帧点/曲线图数据，让 HP、韧性、能量三条曲线能按 Endaxis 式多曲线轨道显示。
- 同时补 `candidateValueSeries` 到实际曲线图或 marker 层的展示，仍保持候选与当前实际投影分离。

### 2026-07-08：阶段 5-8AC 候选三曲线时间轴图表层

本轮完成：

- `candidateValueSeries` 新增 `chart` 子结构，把三条候选曲线转换成可直接绘图的时间轴点。
- 每个 chart point 保留源帧 `sourceFrameIndex/sourceTimeMs`，并新增用于绘图的 `displayFrameIndex/displayFrameLabel/displayTimeMs/xPercent/yPercent`。
- 对当前普攻第 2-5 段的子 `skill_control` 相对帧回退问题，新增 `timeAdjustmentStatus = sequence-display-frame-adjusted`，按 hit 顺序最小 1 帧递增生成显示帧；这只是可视化 fallback，不覆盖源证据。
- Workbench 分析面板新增“候选时间曲线”区域，用 60fps 多曲线图展示 HP、削韧、能量三条候选线，并显示帧调整数量。

当前末音 `10900101` 默认普攻 chart 结果：

- `candidateValueSeries.chart.status = candidate-chart-found-unapplied`。
- `durationMs = 30000`，`frameRate = 60`，`frameCount = 1800`。
- `summary.pointCount = 15`，`summary.displayFrameAdjustmentCount = 12`。
- `summary.timeOrderStatus = source-times-non-monotonic-display-adjusted`。
- HP 曲线源帧：`12 / 6 / 12 / 7 / 4f`。
- HP 曲线显示帧：`0s12f / 0s13f / 0s14f / 0s15f / 0s16f`。

Workbench 当前默认样本显示：

```text
候选时间曲线 15
60fps · 30s0f · 显示帧调整 12
HP参数候选 0s12f-0s16f · 2,500-13,000 · raw-param
削韧候选 0s12f-0s16f · 7,000 · raw-field
能量候选 0s12f-0s16f · 2,399-3,000 · raw-field
```

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- `candidateValueSeries.chart.applied` 仍为 `false`。
- `displayFrameIndex` 是为可视化生成的显示帧，不是已确认的游戏真实命中绝对帧。
- 当前帧调整来自普攻第 2-5 段子 `skill_control` 的局部帧回退；真实连段切换时长、输入节奏、取消窗口和命中触发时机仍需继续追证。

下一步：

- 阶段 5-8AD 目标：继续追 `10900101 -> 10900102-10900105` 普攻子 `skill_control` 的连段切换时间、EventBridge 触发帧和动画状态长度，尽量把候选曲线的 `displayFrameIndex` 替换为证据更强的真实绝对帧。
- 若真实绝对帧仍不能一次确认，应把候选时间曲线同步到主时间轴 marker 层，保留 `sourceFrameIndex` 与 `displayFrameIndex` 双轨提示。

### 2026-07-08：阶段 5-8AD 普攻连段 EventBridge 绝对帧候选

本轮完成：

- 新增 `normalAttackSequenceTimingEvidence` 投影逻辑：按普攻 hitGroup 顺序，读取上一段 `skill_control` 中指向下一段技能的 `EventBridgeBehaviorData.behaviorStartFrame`，累计为连段起始帧。
- `actionResultTimeline[].hitCandidateSummary` 新增连段时序摘要：`absolutePrimaryFrames`、`sequenceChainStartFrames`、`sequenceTimingTransitions[]`、`sequenceTimingResolvedTransitionCount` 和 `sequenceTimingAbsoluteFrameStatus`。
- `actionResultTimeline[].hitCandidates[]` 新增每 hit 的 `localCandidateTimeMs`、`chainStartFrame`、`absolutePrimaryFrame`、`absoluteCandidateTimeMs`、`absoluteFrameStartFrames` 和 `sequenceTiming`。
- `candidateValueSeries.chart` 改用 EventBridge 绝对帧候选作为图表源帧；默认普攻样本不再需要 5-8AC 的显示帧递增 fallback。
- Workbench `逐hit候选` 摘要新增绝对帧和连段桥接数。

当前末音 `10900101` 默认普攻连段时序候选：

- 连段桥接：`4/4`。
- `10900101 -> 10900102`：桥接帧 `16f`，第 2 段链起点 `16f`。
- `10900102 -> 10900103`：桥接帧 `35f`，第 3 段链起点 `51f`。
- `10900103 -> 10900104`：桥接帧 `65f`，第 4 段链起点 `116f`。
- `10900104 -> 10900105`：桥接帧 `64f`，第 5 段链起点 `180f`。
- 本地命中帧仍为：`12 / 6 / 12 / 7 / 4f`。
- EventBridge 累计绝对帧候选为：`0s12f / 0s22f / 1s3f / 2s3f / 3s4f`。
- `candidateValueSeries.chart.summary.displayFrameAdjustmentCount = 0`。
- `candidateValueSeries.chart.summary.timeOrderStatus = source-times-monotonic`。

Workbench 当前默认样本显示：

```text
逐hit候选 5/5段 · 三值字段 12 · 帧 12f/6f/12f/7f/4f · 绝对帧 0s12f/0s22f/1s3f/2s3f/3s4f · 连段桥 4/4
候选时间曲线 15
60fps · 30s0f
HP参数候选 0s12f-3s4f · 2,500-13,000 · raw-param
削韧候选 0s12f-3s4f · 7,000 · raw-field
能量候选 0s12f-3s4f · 2,399-3,000 · raw-field
```

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 绝对帧仍是 `EventBridgeBehaviorData` 和 HP timeline 候选推导出的中置信候选，`applied` 继续保持 `false`。
- 这些帧还没有验证输入节奏、取消窗口、运行时实际触发条件和命中盒真实生效帧；不能直接作为最终动作 timing profile。
- `candidateValueSeries.chart` 已消除默认样本的显示帧 fallback，但仍未同步到主时间轴 marker 层。

下一步：

- 阶段 5-8AE 目标：把 `candidateValueSeries.chart` 的 HP、削韧、能量候选点同步到主时间轴 marker/曲线轨，让时间轴区域也能看到三值候选变化，而不只在分析面板显示。
- 继续明确区分：真实伤害投影 marker、候选三值 marker、未应用公式字段。

### 2026-07-08：阶段 5-8AE 主时间轴候选三值 marker

本轮完成：

- `TimelineGridPreview` 新增 `candidateValueChart` 输入，读取 `candidateValueSeries.chart`。
- 主时间轴按 action 所在 actor 轨道渲染候选三值 marker，当前三类候选分别为：
  - HP 参数候选：圆点，`hpDamageFormulaParamCandidate`。
  - 削韧候选：方点，`toughnessDamageCandidate`。
  - 能量候选：菱形点，`selfEnergyCandidate`。
- 候选 marker 与真实伤害投影 marker 分开使用 `data-testid` 和图例，不混用语义。
- Workbench 测试覆盖默认样本的 15 个候选三值 marker、actor 轨道归属和首尾 HP marker 帧标签。

当前末音 `10900101` 默认普攻主时间轴显示：

- 真实伤害投影 marker：1 个，仍来自 raw HP 投影。
- 候选三值 marker：15 个，全部位于 `actor-109001` 轨。
- HP 首点：`hitIndex = 1`，`frameLabel = 0s12f`。
- HP 末点：`hitIndex = 5`，`frameLabel = 3s4f`。
- 图例新增：`候选三值`。

验收结果：

- `npm test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、33 条测试通过。

当前边界：

- 主时间轴当前显示的是候选三值 marker 点，还不是连续曲线轨。
- 候选 marker 的数值仍来自 `TDamageElementParams` 字段候选，`applied = false`，不能当作最终伤害/削韧/充能。
- marker 的绝对帧来自 5-8AD 的 EventBridge 候选链，仍需继续验证运行时触发条件。

下一步：

- 阶段 5-8AF 目标：把主时间轴候选 marker 升级为更接近 Endaxis 的多曲线轨/悬浮提示体验，支持同时查看 HP、削韧、能量三个候选值的帧点和来源。
- 同时继续拆分“真实投影曲线”和“候选字段曲线”的视觉层级，避免用户误把候选当最终结果。

### 2026-07-08：阶段 5-8AF 主时间轴候选多曲线轨

本轮完成：

- `TimelineGridPreview` 在每条有候选三值的轨道内新增 `candidate-value-curve-track`，用 SVG polyline 把 HP、削韧、能量候选点连成三条曲线。
- 候选 marker 的纵坐标改为使用 `candidateValueSeries.chart.points[].yPercent`，点位贴合曲线，而不是固定三行摆放。
- 新增按帧聚合的 hover hotspot：同一 hit 帧上的 HP、削韧、能量三个候选值合并成一个提示文本，便于按帧查看。
- Workbench 测试覆盖默认样本的曲线轨、三条曲线、5 个按帧 hotspot 和首帧三值提示。

当前末音 `10900101` 默认普攻主时间轴显示：

- 候选曲线轨：1 条，位于 `actor-109001`。
- 候选曲线：3 条，分别对应 HP 参数候选、削韧候选、能量候选。
- 候选 marker：15 个。
- 按帧 hotspot：5 个。
- 首帧 hotspot 提示：

```text
0s12f hit1: HP参数候选 2,500 raw-param / 削韧候选 7,000 raw-field / 能量候选 2,700 raw-field
```

验收结果：

- `npm test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、33 条测试通过。

当前边界：

- 多曲线轨仍是候选字段可视化，不代表最终应用公式。
- hover hotspot 目前依赖浏览器原生 title/aria-label，不是完整自定义浮层。
- 曲线可见性暂未提供开关；后续长轴和多动作场景可能需要筛选 HP/削韧/能量曲线。

下一步：

- 阶段 5-8AG 目标：给候选多曲线轨增加基础交互控制，例如 HP/削韧/能量曲线显隐、选中帧来源摘要，以及候选/真实投影视觉分层说明。
- 同时开始考虑多动作、多角色和长时间轴时的候选曲线密度控制。

### 2026-07-08：阶段 5-8AG 候选多曲线基础交互控制

本轮完成：

- `TimelineGridPreview` 在时间轴标题区新增 HP / 韧性 / 能量三枚候选曲线显隐开关。
- 曲线显隐会同步影响对应的 curve line、candidate marker 和按帧 hotspot 聚合，不改变 `candidateValueSeries.chart` 原始数据。
- 候选 hotspot 和 marker 可点击或键盘选中，选中后在时间轴下方显示 `candidate-frame-summary`，汇总该帧当前可见的候选值。
- 选中帧来源摘要会显示 `hitSkill`、`elementConfigIds`、候选字段来源状态和时序状态，并继续标记为“未应用候选”。
- Workbench 测试覆盖默认三枚开关、首帧选中摘要，以及关闭 HP 曲线后的 marker / curve 数量变化。

当前末音 `10900101` 默认普攻主时间轴显示：

- 默认可见曲线：HP、韧性、能量 3 条。
- 默认候选 marker：15 个。
- 默认按帧 hotspot：5 个。
- 首帧选中摘要值：

```text
HP 2,500 raw-param / 韧性 7,000 raw-field / 能量 2,700 raw-field
```

- 关闭 HP 开关后：剩余 2 条曲线、10 个 marker；首帧摘要只保留韧性和能量候选。

验收结果：

- `npm test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、33 条测试通过。
- `npm exec eslint -- --no-warn-ignored src/features/workbench/TimelineGridPreview.vue src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过，仍有既有 Sass `@import` deprecation 和 chunk size 警告。
- `npm exec prettier -- --check ...` 与 `git diff --check`：通过。

当前边界：

- 本阶段只增强候选曲线交互，不改变仿真 schema，也不应用 HP、削韧或充能最终公式。
- 选中帧来源摘要仍来自 `candidateValueSeries.chart.points[]` 已暴露字段，不是完整的 per-element 详情面板。
- 长轴、多动作、多角色同时出现候选曲线时，仍需要后续密度控制和来源详情下钻。

下一步：

- 阶段 5-8AH 目标：把选中帧摘要升级为更细的候选来源详情，展示每条可见曲线的 `valueSamples`、`candidateCount`、`sourceFrameIndex/localFrameIndex/chainStartFrame` 和 element 候选来源。
- 同时开始为多动作长时间轴设计候选曲线密度控制，例如按 action、actor、series 或选中帧范围过滤。

### 2026-07-08：阶段 5-8AH 候选来源详情下钻与选中帧密度控制

本轮完成：

- `TimelineGridPreview` 把 `candidateValueSeries.chart.points[]` 的 `valueSamples`、`candidateCount`、`sourceFrameIndex`、`displayFrameIndex`、`localFrameIndex`、`chainStartFrame`、`absoluteFrameIndex` 透传到时间轴候选 marker。
- 选中帧摘要新增逐曲线详情行，按当前可见曲线展示候选值、样本值、候选数、源/显示/局部/连段/绝对帧，以及 element 候选来源。
- 时间轴标题区新增候选范围切换：`全部` / `选中帧`。未选中候选帧时 `选中帧` 不可用；选中后可把主时间轴收缩到当前 hit 帧的候选 marker、curve 和 hotspot。
- Workbench 测试覆盖详情行、首帧 HP 样本值、候选数、帧来源、element 来源，以及 `选中帧` 范围下的 3 marker / 3 curve / 1 hotspot 密度收缩。

当前末音 `10900101` 默认普攻首帧详情：

- HP 参数候选：`2,500 raw-param`。
- HP 样本值：`1,000 / 1,800 / 1,900 / 2,500`，`candidateCount = 4`。
- 帧来源：`src12 / disp12 / local12 / chain0 / abs12`。
- element 来源：`109001081 / 109001306`。
- 切换到 `选中帧` 范围后：主时间轴只保留该帧的 3 个候选 marker、3 条候选 curve 和 1 个 hotspot。

验收结果：

- `npm test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、33 条测试通过。
- `npm exec eslint -- --no-warn-ignored src/features/workbench/TimelineGridPreview.vue src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过，仍有既有 Sass `@import` deprecation 和 chunk size 警告。
- `git diff --check`：通过。

当前边界：

- 本阶段仍只展示候选字段来源，不改变 `candidateValueSeries.chart`、不应用最终 HP / 削韧 / 充能公式。
- `选中帧` 是密度控制的第一步，尚未提供按 actor、action、series 组合过滤，也没有虚拟化长时间轴点位。
- 详情行展示 element ID 和 chart point 字段，尚未下钻到每个 element 的完整 `TDamageElementParams` 原始字段。

下一步：

- 阶段 5-8AI 目标：把候选详情继续下钻到 per-element 原始字段，至少能在选中帧里区分每个 `elementConfigId` 对 HP 参数、削韧和能量字段的贡献。
- 同时补更适合多动作长轴的范围过滤，例如按 action、actor 或可见 series 组合筛选。

### 2026-07-08：阶段 5-8AI per-element 原始字段下钻与组合过滤

本轮完成：

- `candidateValueSeries.series[].points[]` 与 `candidateValueSeries.chart.series[].points[]` 新增 `elementDetails[]`，从 `actionResultTimeline[].hitCandidates[].candidates[]` 保留每个 `elementConfigId` 的候选字段。
- `elementDetails[]` 当前按 element 记录 HP 参数候选、公式函数 ID、削韧字段、自身能量字段、PathID 和 element 名称；仍全部标记 `applied: false`。
- `TimelineGridPreview` 的选中帧详情行改为展示 per-element 贡献，而不只显示 element ID 列表。
- 时间轴候选过滤新增角色和动作下拉；与已有 series 显隐、`全部 / 选中帧` 范围一起构成基础组合过滤。
- 仿真测试覆盖首帧 `elementDetails[]`，Workbench 测试覆盖角色/动作过滤和 per-element 字段文本。

当前末音 `10900101` 默认普攻首帧 per-element 详情：

- `109001306`：HP 参数 `1,000 / 1,800 / 2,500`，削韧 `7,000`，自身能量 `2,700`，petRecoverSP `10,399`，recoverInterval `9,999`。
- `109001081`：HP 参数 `1,000 / 1,900 / 2,500`，削韧 `7,000`，自身能量 `2,700`，petRecoverSP `10,399`，recoverInterval `9,999`。
- 角色过滤：当前样本可选择 `末音 / actor-109001`。
- 动作过滤：当前样本可选择 `普通攻击 / action-0001`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/TimelineGridPreview.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/TimelineGridPreview.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，12 个测试文件、104 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过。

当前边界：

- 本阶段只是把 per-element 原始候选字段带到 chart/UI，不应用最终公式。
- 公式函数、槽位关系、等级覆盖和 per-element 字段已经能在不同证据层看到，但选中帧详情尚未把这些关系折叠成同一张 element 详情表。
- 角色/动作过滤已接入 UI，但默认样本只有一个 actor 和一个 action；多角色多动作的实际收缩效果需要后续样本验证。

下一步：

- 阶段 5-8AJ 目标：把 per-element 详情与 `formulaFunctionIds`、`formulaFunctionMatchedIds`、`formulaParamAlignment` 和 `skillsub_ele_value` 等级槽位关系联动展示。
- 同时准备多动作样本或构造测试 fixture，验证 actor/action/series 组合过滤在非单动作时间轴上的行为。

### 2026-07-08：阶段 5-8AJ per-element 公式槽位联动与多动作过滤 fixture

本轮完成：

- `actionResultTimeline[].hitCandidates[].candidates[]` 会按 `elementConfigId` 合并每 hit 三值字段候选与动作级 `damageElementSource.candidates[]`，避免公式函数和等级槽位证据在 per-hit 摘要里丢失。
- `candidateValueSeries.chart.series[].points[].elementDetails[]` 现在继续保留 `hpDamage.formulaFunctionRefs[]`、`hpDamage.formulaFunctionEvidence` 和 `skillLevelBridge.formulaSlotAlignment`。
- `TimelineGridPreview` 的选中帧详情在每个 element 后展示 `function_1/function_2` 候选公式，以及 `skillsub_ele_value.valueParam` 与 `formulaParamValues` 的 A/G 槽位关系。
- 新增 `TimelineGridPreview` 组件级多动作 fixture，覆盖两个 actor、两个 action、HP/韧性/能量三条 series 下的 actor/action/series 组合过滤。
- 仿真测试覆盖首帧 element 的公式函数和槽位摘要，Workbench 测试覆盖 per-element 公式文本。

当前末音 `10900101` 默认普攻首帧 per-element 公式详情：

- `109001306`：HP `1,000 / 1,800 / 2,500`，函数 `f1:G/10000`、`f2:self.ATK[0]*A/10000`，槽 `A覆盖1,600-3,360 / G直连10,000`，削韧 `7,000`，自身能量 `2,700`。
- `109001081`：HP `1,000 / 1,900 / 2,500`，函数 `f1:G/10000`、`f2:self.ATK[0]*A/10000`，槽 `A覆盖1,600-3,360 / G直连10,000`，削韧 `7,000`，自身能量 `2,700`。
- 多动作过滤 fixture：初始 6 个候选 marker；选择 `actor-b` 后 3 个；再叠加 `action-a` 后 0 个；恢复全部 actor 且保留 `action-a` 后 3 个；关闭 HP series 后 2 个。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过，3 个测试文件、45 条测试通过。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/TimelineGridPreview.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/TimelineGridPreview.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过。

当前边界：

- 本阶段仍只展示未应用公式候选，不改变 raw HP、削韧或充能数值。
- `formulaFunctionRefs` 和 `formulaSlotAlignment` 证明“候选关系可同屏观察”，不证明 `DamageElement` 已按该组合执行最终公式。
- 多动作过滤 fixture 是组件级验证；真实业务样本仍需要继续扩大到更多角色、动作形态和技能。

下一步：

- 阶段 5-8AK 目标：把 per-element 详情整理成更适合比较的候选详情模型/tooltip，支持按 action、hit、element 横向对比 HP 参数、公式函数、A/G 槽位、削韧和能量字段。
- 开始用该详情模型追踪 `DamageElement` 的 function 组合顺序、等级覆盖应用点和每 hit 倍率分配，仍保持最终公式 `applied: false`。

### 2026-07-08：阶段 5-8AK per-element 横向比较详情与 tooltip

本轮完成：

- `TimelineGridPreview` 在选中候选帧下新增 `candidate-element-comparison` 结构化对比区。
- 对比区按 `elementConfigId + pathId` 聚合当前帧可见 series 的 `elementDetails[]`，每行展示 HP 参数、公式函数、A/G 槽位、削韧、能量和验证状态。
- 每行带 `title` tooltip 文本，串联 element、HP、函数、槽位、削韧、能量和未应用状态，作为后续完整 tooltip/详情面板的最小模型。
- 验证状态明确记录 `未应用`、`function组合待验证`、`等级覆盖待验证` 和 `每hit倍率待分配`，避免把候选关系误读为最终公式。
- Workbench 测试覆盖默认首帧两个 element 的对比行、公式函数、槽位关系、削韧、能量和 tooltip 文本。

当前末音 `10900101` 默认普攻首帧对比区：

- `109001306`：HP `1,000/1,800/2,500`；函数 `f1:G/10000 / f2:self.ATK[0]*A/10000`；槽 `A覆盖1,600-3,360 / G直连10,000`；削韧 `7,000`；能量 `2,700 / 宠物10,399 / 间隔9,999`；状态 `未应用 · function组合待验证 · 等级覆盖待验证:1 · 每hit倍率待分配`。
- `109001081`：HP `1,000/1,900/2,500`；函数、槽位、削韧和能量同首帧候选；状态同样保持未应用。

验收结果：

- `npm test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过，2 个测试文件、34 条测试通过。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/features/workbench/TimelineGridPreview.vue src/__tests__/views/Workbench.test.js`：通过。
- `npm exec eslint -- --no-warn-ignored src/features/workbench/TimelineGridPreview.vue src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过。

当前边界：

- 对比区仍是前端结构化展示模型，不改变 `candidateValueSeries.chart` 原始候选数据，也不应用最终公式。
- 当前 tooltip 使用原生 `title`，还不是可交互的完整详情面板。
- `function_1/function_2` 的组合顺序、A 槽等级覆盖实际应用点和每 hit 倍率分配仍未确认。

下一步：

- 阶段 5-8AL 目标：基于 per-element 对比模型整理 `DamageElement` 公式执行证据矩阵，按 element / hit / action 标注 function 组合顺序候选、A 槽覆盖点候选和每 hit 倍率缺口。
- 若仍无法确认执行顺序，则把未确认原因固化为结构化 diagnostics，并继续保持最终 HP、削韧、充能公式 `applied: false`。

### 2026-07-08：阶段 5-8AL DamageElement 公式执行证据矩阵

本轮完成：

- `actionResultTimeline[].hpDamage.sourceEvidence` 新增 `formulaExecutionEvidenceMatrix`，把动作级公式候选、逐 hit element 绑定和 per-element 槽位关系整理成同一张证据矩阵。
- 矩阵按 element 行记录 `functionOrderCandidates`、`preferredFunctionOrderCandidate`、`slotOverrideCandidates`、`directSlotMatches`、`hitIndexes` 和 `perHitScaleGap`。
- `diagnostics` 固化三个仍未确认的问题：function 组合顺序、等级值覆盖应用点、每 hit 倍率/运行时缩放分配。
- `AnalysisPanel` 的三值来源新增 `执行矩阵` 摘要，能直接看到 element 行数、A 覆盖候选数、缩放缺口和大差异行数。
- 仿真测试覆盖矩阵结构；Workbench 测试覆盖页面摘要文本。

当前末音 `10900101` 默认普攻矩阵：

- `rowCount = 2`，覆盖 `109001081` 与 `109001306`。
- 两个 element 当前都绑定到 `hitIndexes = [1]`，说明动作级 `skillsub_ele_value` 证据只桥接到首 hit 的两个 action-level element。
- 首选候选仍为 `function_2-current-level-value-param`，当前等级值预览 `307`，对比 raw HP `12,461`，差距状态为 `large-difference`。
- 需要约 `×40.6` 才接近 raw；若按 5 hit 均分，需要约 `每 hit ×8.1`，因此仍不能应用为最终公式。
- A 槽记录为等级覆盖候选 `1,600-3,360`；G 槽记录为常量直连 `10,000`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过。

当前边界：

- `formulaExecutionEvidenceMatrix` 仍是 evidence-only，所有行保持 `applied: false`。
- raw HP 仍来自当前描述倍率投影；削韧和充能仍只追踪候选字段，不应用最终公式。
- `hitIndexes = [1]` 暴露了动作级 element 值与后续 hit element 的桥接缺口；需要更多动作/skill_control 样本和运行时证据确认是否存在共享倍率、额外缩放或子技能自身等级值。

下一步：

- 阶段 5-8AM 目标：把 `formulaExecutionEvidenceMatrix` 扩展到更多动作形态/技能样本，生成跨动作矩阵摘要，并继续沿 IL2CPP / Extractor 证据追 `DamageElement` 的 function 组合顺序、等级覆盖应用点和每 hit 缩放来源。
- 若本地 AzPr 数据仍不足，按项目规则使用 AzPr Extractor 提取原始资源补齐证据链。

### 2026-07-08：阶段 5-8AM 跨动作公式执行矩阵摘要

本轮完成：

- `simulation.summary` 新增 `formulaExecutionMatrixSummary`，聚合所有动作的 `formulaExecutionEvidenceMatrix`。
- 摘要按 action 生成 `actionSummaries[]`，记录每个动作形态的矩阵行数、element 列表、缩放范围、A/G 槽位候选数、hit 绑定覆盖和未确认项。
- 摘要按 element 生成 `elementSummaries[]`，记录同一 element 在多个动作形态下的缩放范围、hit 绑定覆盖、A 槽覆盖候选和 G 槽直连候选。
- `AnalysisPanel` 新增 `执行矩阵摘要` 行，能在三值来源顶部看到跨动作矩阵规模、缩放范围和 hit 绑定覆盖。
- 仿真测试复用【普通攻击 / 重击 / 闪击 / 跃击】四动作 fixture，覆盖单动作与四动作两种摘要；Workbench 测试覆盖默认页面摘要文本。

当前四动作矩阵摘要：

- `matrixActionCount = 4`，覆盖【普通攻击】【重击】【闪击】【跃击】。
- `rowCount = 8`，每个动作 2 个 element 行，跨动作仍只有 `109001081 / 109001306` 两个 action-level element。
- `scaleSpreadStatus = varies-by-action-variant`，说明 f2 当前等级值预览不随描述倍率变化，而 raw HP 会随动作形态倍率变化。
- 缩放范围约 `×2.5-×40.6`；每 hit 缩放范围约 `×2.5-×11.9`。
- `rowsWithHitBindings = 2/8`：只有【普通攻击】两行能绑定逐 hit 候选，重击/闪击/跃击仍缺 hit 级 DamageElement 绑定证据。
- `slotOverrideCoverageStatus = all-rows-have-slot-override-candidates`：所有矩阵行都有 A 槽等级覆盖候选。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过。

当前边界：

- `formulaExecutionMatrixSummary` 仍是 evidence-only，所有聚合行保持 `applied: false`。
- 四动作样本仍来自同一技能 `10900101` 的动作形态拆分，尚未覆盖更多角色/技能。
- 非普攻动作缺逐 hit 绑定不是失败，而是当前证据链真实缺口；需要从 skill_control/Extractor 或 IL2CPP runtime 继续追重击、闪击、跃击的 DamageElement 绑定。

下一步：

- 阶段 5-8AN 目标：围绕 `formulaExecutionMatrixSummary` 的 hit 绑定缺口，继续追重击/闪击/跃击的 skill_control 行为链和外部 element 对象，优先确认非普攻动作的 hit 级 DamageElement 绑定来源。
- 若本地 AzPr 表和已生成证据不足，则使用 AzPr Extractor 提取原始资源，补齐对应 `skill_control`、`elementBaseDatas`、外部 element 对象和 IL2CPP 执行链锚点。

### 2026-07-08：阶段 5-8AN hit 绑定缺口与 skill_control 候选联动

本轮完成：

- `formulaExecutionMatrixSummary` 新增 `hitBindingGapSummary`，专门汇总矩阵行缺 hit 绑定的动作形态。
- 每个 `actionSummaries[]` 新增 `hitBindingGap`，把该动作的缺口行数与 `formulaCandidatePatternSummary.skillControlBehaviorCorrelations[].actionVariantBindingCandidates[]` 对齐。
- 对缺口动作只聚合最高置信度候选，避免弱置信度的普通攻击窗口污染重击/闪击/跃击摘要；完整候选仍保留在 `behaviorBindingEvidence.candidates[]`。
- `AnalysisPanel` 的 `执行矩阵摘要` 增加 `缺口候选 x/y`，用于提示缺 hit 绑定的动作中有多少已找到 skill_control 行为候选。
- 仿真测试覆盖单动作无缺口、四动作 3 个非普攻缺口，以及重击缺口绑定到 `攻击碰撞 / Skill0_6` 的候选证据。

当前四动作 hit 绑定缺口：

- `hitBindingGapSummary.status = all-missing-hit-actions-have-skill-control-candidates`。
- `missingActionCount = 3`，缺口动作是【重击】【闪击】【跃击】。
- `missingRowCount = 6`，即 3 个动作各缺 2 个 element 行的 hit 级绑定。
- `actionsWithBindingCandidates = 3`，三个缺口动作都已有 skill_control 行为候选。
- 最高置信度候选聚合为 `sourceNames = ["攻击碰撞"]`、`stateNames = ["Skill0_6"]`、`subSkillIds = [109001011]`、`bindingStatus = shared-action-family-candidate-unconfirmed`。
- 重击样例：`action-segment-1` 的 `hitBindingGap` 为 `skill-control-binding-candidate-found-hit-elements-unresolved`，候选数 `5`，最高置信度 `low`，仍未确认外部 element 对象如何绑定到具体 hit。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过。

当前边界：

- `hitBindingGapSummary` 仍是 evidence-only，不证明 `攻击碰撞 / Skill0_6` 就是重击/闪击/跃击的真实 hit 绑定。
- 当前只能确认“缺口动作有 skill_control 行为候选”，还没确认候选行为链里的外部 element 对象与动作矩阵 element 的逐 hit 对应关系。
- 三值最终公式仍全部保持未应用：HP raw 投影、削韧候选和充能候选不能由该缺口摘要直接计算。

下一步：

- 阶段 5-8AO 目标：沿 `hitBindingGap.behaviorBindingEvidence.candidates[]` 的 `elementPathIds` / `elementRoundedPathIds` / `subSkillIds` 继续追非普攻动作的外部 element 对象，把 `攻击碰撞 / Skill0_6` 候选进一步桥接到具体 `TDamageElementParams` 和 hit 级三值字段。
- 若当前生成证据没有足够对象体，使用 AzPr Extractor 从原始资源补齐对应外部 element 对象、typetree 和 IL2CPP `DamageElement` 执行链锚点。

### 2026-07-08：阶段 5-8AO 非普攻缺口外部 DamageElement 候选桥接

本轮完成：

- `hitBindingGap` 新增 `externalElementBinding`，会沿最高置信度 `behaviorBindingEvidence.candidates[]` 的 `elementPathIds`，按 `skillId + PathID` 查 `externalElementObjectEvidence.objects[]` 和 `damageElementFieldMappingEvidence.fieldMappings[]`。
- `hitBindingGapSummary` 新增 `externalElementBindingSummary`，汇总缺口动作中有多少已解析外部对象、有多少进一步命中 `TDamageElementParams` 三值字段候选。
- `AnalysisPanel` 的 `执行矩阵摘要` 追加 `伤害元素候选 x/y`，让工作台能直接显示缺口动作是否已经桥到 DamageElement 候选。
- 仿真测试覆盖四动作样本的重击缺口：`攻击碰撞 / Skill0_6 / subSkill 109001011` 的 3 个最高置信度窗口均解析到同一组外部 element，其中 `-5633710717881758712 -> ast_109001251 / TDamageElementParams`。

当前四动作外部 element 桥接结果：

- `externalElementBindingSummary.status = all-candidate-gaps-have-damage-element-field-candidates`。
- `gapsWithDamageElementCandidates = 3/3`，重击、闪击、跃击都能从缺口候选追到 DamageElement 字段。
- 唯一 DamageElement 候选为 `elementConfigId = 109001251`、`pathId = -5633710717881758712`、`mName = ast_109001251`。
- 同组外部对象还包括 `7848597992417622553 -> TFreezeFrameElementParams / ast_109001252` 与 `2740651767650299388 -> TFxElementParams / ast_109001253`。
- `109001251` 的三值候选字段：`function_1 = 1`、`function_2 = 2`、`formulaParamValues = [1000, 3000, 8500, 10000, 10000...]`、`weakBreakDamageRate = 7000`、`recoverSP = 5899`、`petRecoverSP = 22999`。
- 该对象 `skillLevelBridge.status = skillsub-element-level-bridge-missing`，暂未在当前技能等级 `valueParam` 中找到同 elementId 桥接。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，11 条测试通过。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。

当前边界：

- 这一步证明“非普攻缺口动作的 skill_control 候选能追到外部 `TDamageElementParams` 对象”，但仍不证明该对象已绑定到最终 hit，也不证明 DamageElement 执行公式。
- 新发现的关键差异：缺口行为链落到 `109001251`，而当前动作级 `formulaExecutionEvidenceMatrix` 仍来自 action logic 的 `109001081 / 109001306`。这说明动作级矩阵的 element 选择还没有按动作形态 / subSkill / hitEffect 正确收敛。
- `109001251` 缺少 `skillsub_ele_value` 等级桥接，因此不能把它直接用于最终 HP、削韧或充能计算。

下一步：

- 阶段 5-8AP 目标：对齐非普攻 `109001251` 与动作级矩阵 `109001081 / 109001306` 的来源差异，继续追 `subSkillId = 109001011`、`hitEffects = 11_109001_133 / 11_109001_005`、`skill_logic` / `skillsub_ele_value` 与动作形态的真实绑定关系。
- 若表格侧没有 `109001251` 的等级桥接，继续用 AzPr Extractor / IL2CPP 证据确认该 DamageElement 是否使用固定参数、继承参数、运行时覆盖或另一条等级配置链。

### 2026-07-08：阶段 5-8AP action-level 与 skill_control element 来源差异固化

本轮完成：

- `actionResultTimeline[].hpDamage.sourceEvidence` 新增 `actionLevelElementSource`，记录动作级矩阵来自 `skill_logic.currentLevel.elementValues` / `skillsub_ele_value` 的 element 行。
- `actionSummaries[].hitBindingGap` 新增 `elementSourceAlignment`，把动作级矩阵 element 与 `skill_control.elementBaseDatas` 外部 DamageElement 候选放在同一结构里比较。
- `hitBindingGapSummary` 新增 `elementSourceAlignmentSummary`，跨缺口动作汇总来源差异、重叠关系、subSkill、state、hitEffect 和未解项。
- `AnalysisPanel` 的 `执行矩阵摘要` 追加 `来源差异 x/y`，让工作台能直接看到缺口动作是否存在 action-level 与 skill_control element 分叉。
- 仿真测试覆盖单动作无缺口、四动作 3 个缺口的来源差异摘要，以及重击缺口的 `elementSourceAlignment` 明细；Workbench 测试覆盖重击切换后的 `来源差异 1/1` 展示。

当前四动作来源对齐结果：

- `elementSourceAlignmentSummary.status = all-candidate-gaps-have-action-level-external-element-divergence`。
- `gapCount = 3`，`alignedGapCount = 3`，`divergentGapCount = 3`，缺口动作仍是【重击】【闪击】【跃击】。
- 动作级来源为 `skill_logic.currentLevel.elementValues`，当前等级 `1`、`skillLevelRowId = 1657`、`subSkillId = 10900101`。
- 动作级与矩阵 element 均为 `[109001081, 109001306]`，两行 `valueParam` 均是 `1#1600|7#10000`。
- 外部来源为 `skill_control.elementBaseDatas`，最高置信度候选来自 `Skill0_6`、`subSkillId = 109001011`、`hitEffects = 11_109001_133 / 11_109001_005`。
- 外部 DamageElement 候选为 `[109001251]`，与 action-level element 的 `overlapElementConfigIds = []`。
- 结构化 finding 为 `skill-control-subskill-damage-element-not-in-action-level-values`。
- 当前 unresolved 保留 `action-variant-element-selection-unconfirmed`、`skill-control-subskill-to-skill-level-bridge-unconfirmed`、`external-damage-element-level-bridge-missing`、`runtime-parameter-inheritance-or-override-unconfirmed`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，11 条测试通过。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec eslint -- --no-warn-ignored src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `git diff --check`：通过；仅有本机 CRLF 转换提示。

当前边界：

- 阶段 5-8AP 证明的是“动作级矩阵来源”和“skill_control 外部 DamageElement 来源”确实分叉，不证明运行时最终使用哪一条链。
- 不能把 `109001251` 直接合并进 `109001081 / 109001306` 的矩阵，也不能反向用 action-level `valueParam` 覆盖 `109001251`。
- `109001251` 仍缺等级桥接；HP、削韧、充能三条最终公式继续保持 `applied: false`。

下一步：

- 阶段 5-8AQ 目标：继续追 `109001251` 的运行时参数来源，确认它是固定 `formulaParamValues`、继承 action-level `valueParam`、由运行时覆盖，还是存在另一条等级配置链。
- 优先从 AzPr Extractor / IL2CPP 侧追 `DamageElement`、`SkillElementInjector`、`FormulaParams`、`skillsub_ele_value` 交叉引用，以及 `subSkillId = 109001011` 与动作形态的真实选择规则。

### 2026-07-08：阶段 5-8AQ 关联技能等级链候选固化

本轮完成：

- `generate-azpr-data.mjs` 在 `damageElementFieldMappingEvidence` 中新增 `skillLevelBridge.relatedElementLevelBridge`，当当前技能直连 `skill_logic.currentLevel.elementValues` 找不到同 elementId 时，会继续从全量 `skillsub_ele_value` 按 `elementId` 查关联等级链。
- `109001251` 现在保留双层结论：直连 `skillLevelBridge.status = skillsub-element-level-bridge-missing` 仍成立，但 `relatedElementLevelBridge.status = related-slot-skill-element-level-bridge-found` 已找到关联等级链候选。
- `relatedElementLevelBridge` 记录 `derivedSkillId = 10900125`、`primarySkillId = 10900125`，并确认该技能在末音角色技能槽中为 `ground / slot 207`，`skill.json.parentSkill = 10900121`、`skillModuleTag = 2`。
- `10900125` 的 `skillsub_ele_value` 有 12 行：`valueParam` 从 `1#4500|7#10000` 到 `1#9450|7#10000`，参数 `1 / A` 每级 +450，参数 `7 / G` 恒为 10000。
- 同时记录 `10900125` 的 `skill_level` 只有 level 1 行，但 `skillsub_ele_value` 有 12 行，因此这条链更像动作/派生 skill 的等级参数候选，运行时继承或应用规则仍未确认。
- 投影层把 `relatedElementLevelBridge` 压缩进 DamageElement source、hit 缺口外部 element binding 和 summary；Workbench 的执行矩阵摘要新增 `关联等级链 x/y`。
- 仿真测试新增 `relatedElementLevelBridge` 明细断言，Workbench 测试新增 `关联等级链 1/1` 展示断言。

当前四动作关联等级链结果：

- `externalElementBindingSummary.gapsWithRelatedSkillLevelBridges = 3/3`。
- `relatedSkillLevelBridgeStatuses = ["related-slot-skill-element-level-bridge-found"]`。
- `relatedSkillLevelBridgePrimarySkillIds = [10900125]`。
- 每个非普攻缺口的关联等级链为 12 行；四动作摘要中 3 个缺口合计 `relatedSkillLevelBridgeLevelRows = 36`。
- `relatedSkillLevelBridgeInheritanceStatuses = ["related-skill-level-inheritance-unconfirmed"]`。
- `109001251` 的关联槽位对齐结论为 `slot-override-candidate-unconfirmed`：`A` 是等级覆盖候选，`G` 是常量直连匹配。

验收结果：

- `npm run data:generate`：通过，生成数据 counts 仍为 `skills = 120`，未把 slot 技能误加入工作台主技能列表。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm exec eslint -- --no-warn-ignored scripts/generate-azpr-data.mjs src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过；仅保留生成脚本既有 `console.log` warning。
- `npm exec prettier -- --check AGENTS.md PROJECT_MANUAL.md DEVELOPMENT_PLAN.md ARCHITECTURE.md DATA_STRUCTURE_CHANGES.md scripts/generate-azpr-data.mjs src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。
- `git diff --check`：通过；仅有本机 CRLF 转换提示。

当前边界：

- 阶段 5-8AQ 证明 `109001251` 不是完全无等级数据，而是存在 `skillsub_ele_value.skillId = 10900125` 的关联等级链候选。
- 仍不能确认 runtime 一定把 `10900125` 的 A/G 覆盖到 `Skill0_6 / subSkill 109001011` 的 `TDamageElementParams` 上；`related-skill-level-inheritance-unconfirmed` 必须保留。
- 不能把 `A = 4500-9450` 直接用于最终 HP、削韧或充能公式；这只是参数来源候选。

下一步：

- 阶段 5-8AR 目标：继续追 `Skill0_6 / subSkill 109001011 / element 109001251` 与 `10900125 / slot 207` 的运行时选择关系，确认 `DamageElement` 或 `SkillElementInjector` 如何取用关联技能等级参数。
- 重点检查 `skill_control` 事件桥、`skill.json.parentSkill`、`skillModuleTag`、输入槽位、IL2CPP `DamageElement.Parse/Execute` 和 `SkillElementInjector.ExecuteDamageElement` 是否存在把 `elementConfigId -> floor(elementId / 10)` 或 parent/slot skill 作为参数来源的逻辑。

### 2026-07-08：阶段 5-8AR 运行时参数来源候选固化

本轮完成：

- 投影层在 `hitBindingGap.externalElementBinding` 下新增 `runtimeParameterSourceEvidence`，把缺口行为候选、外部 DamageElement 和关联等级链放到同一条证据里。
- 当前重击/闪击/跃击的缺口链路均能合并为：`Skill0_6 / subSkill 109001011 / hitEffects 11_109001_133, 11_109001_005 -> element 109001251 -> derivedSkillId 10900125 -> 末音 ground slot 207`。
- 证据字段记录 `DamageElement.Parse(TElementParams param, int skillId, ...)` 和 `SkillElementInjector.ExecuteDamageElement(DamageElement element)` 两个 IL2CPP 签名锚点，说明运行时执行链具备 skillId / DamageElement 上下文，但 dump 只有签名，尚不能确认方法体如何覆盖参数。
- `externalElementBindingSummary` 新增 `runtimeParameterSourceStatuses`、`runtimeParameterSourceCandidateCount`、`runtimeParameterSourceSkillIds` 和 `gapsWithRuntimeParameterSourceCandidates`。
- Workbench 执行矩阵摘要新增 `参数来源候选 x/y`，切换到重击动作时可以看到 `参数来源候选 1/1`。
- 仿真测试新增 `runtimeParameterSourceEvidence` 明细断言，Workbench 测试新增 `参数来源候选 1/1` 展示断言。

当前四动作参数来源候选结果：

- `externalElementBindingSummary.gapsWithRuntimeParameterSourceCandidates = 3/3`。
- `runtimeParameterSourceStatuses = ["runtime-parameter-source-candidates-found-application-unconfirmed"]`。
- `runtimeParameterSourceCandidateCount = 3`，每个缺口动作各命中 1 个唯一 DamageElement 参数来源候选。
- `runtimeParameterSourceSkillIds = [10900125]`。
- 单动作候选关系包含：
  - `skill-control-source-subskill-uses-external-damage-element`
  - `skill-control-hit-effect-links-external-damage-element`
  - `element-config-id-derived-related-skill-id`
  - `related-bridge-primary-skill-matches-derived-skill-id`
  - `related-skill-present-in-character-slot`
  - `il2cpp-damage-element-parse-receives-skill-id`
  - `il2cpp-skill-element-injector-executes-damage-element`

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AR 证明的是 `Skill0_6/subSkill 109001011` 的外部 DamageElement、`10900125` 关联等级链和 IL2CPP 执行上下文三者可组成同一条运行时参数来源候选。
- 仍不能确认 runtime 一定使用 `10900125` 的 `A = 4500-9450` 覆盖 `TDamageElementParams.formulaParamValues[1] = 1000`。
- `runtimeParameterSourceEvidence.applied = false`，不能直接改写 HP、削韧或自身能量公式。
- IL2CPP dump 目前只能提供方法签名，下一步必须继续找方法体、运行时日志、反编译产物或可验证的公式执行证据。

下一步：

- 阶段 5-8AS 目标：继续追 `DamageElement.Parse/Execute`、`SkillElementInjector.ExecuteDamageElement`、`FormulaUtility`、`RecoverSP` 和弱点击破相关执行点，确认 `TDamageElementParams.formulaParamValues` 与 `skillsub_ele_value.valueParam` 的覆盖顺序，以及 HP、削韧、自身能量三条曲线各自的真实应用点。
- 如果当前 IL2CPP dump 仍只有签名，优先在 AzPr Extractor 产物中查找反编译方法体、native 符号/字符串交叉引用或可运行时采样的日志证据。

### 2026-07-08：阶段 5-8AS 三值运行时应用入口候选固化

本轮完成：

- 投影层在 `hitBindingGap.externalElementBinding` 下新增 `runtimeApplicationTraceEvidence`，用于按 HP、削韧、自身能量三条曲线记录运行时执行入口。
- `runtimeApplicationTraceEvidence.hpDamage` 记录 `DamageElement.Execute/ExecuteEffect/BaseExecute/Parse`、`FormulaUtility.GetOutput/GetOutputDamage/Calculate/GetFunctionParams/SkillDmgUp/WeaknessPointChange` 和 `FormulaUtility.OutputDamageData` 字段。
- `runtimeApplicationTraceEvidence.toughnessDamage` 记录 `TDamageElementParams.weakBreakDamageRate/useOneBreak`、`FormulaUtility.GetOutputWeaknessDamage/WeaknessPointChange` 和 `WeakBreakSystem` 的状态更新/广播入口。
- `runtimeApplicationTraceEvidence.selfEnergyChange` 记录 `TDamageElementParams.recoverSP/petRecoverSP/recoverInterval`、`DamageElement.RecoverSP`、`RecoverSPArgs` 和 `SPSystem.OnTransmit/RecoverSP`。
- `externalElementBindingSummary` 新增 `runtimeApplicationTraceStatuses`、`runtimeApplicationTraceChainCount` 和 `gapsWithRuntimeApplicationTraceEvidence`。
- Workbench 执行矩阵摘要新增 `应用入口候选 x/y`，切换到重击动作时可以看到 `应用入口候选 1/1`。
- 仿真测试覆盖 HP/韧性/能量三条入口的 class/method/field 证据，Workbench 测试覆盖 `应用入口候选 1/1` 展示。

当前四动作应用入口候选结果：

- `externalElementBindingSummary.gapsWithRuntimeApplicationTraceEvidence = 3/3`。
- `runtimeApplicationTraceStatuses = ["runtime-application-entrypoints-found-method-bodies-missing"]`。
- `runtimeApplicationTraceChainCount = 9`，即 3 个缺口动作各自有 HP、削韧、自身能量 3 条链路入口。
- 单动作 `runtimeApplicationTraceEvidence.trackedValueChainCount = 3`。
- `parameterOverrideStatus = related-skill-level-candidate-found-execution-override-order-unconfirmed`，说明已知关联等级链候选存在，但 `formulaParamValues` 与 `skillsub_ele_value.valueParam` 的覆盖顺序仍未知。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AS 证明的是三条曲线的运行时入口和数据载体已经能在 IL2CPP dump 中对上。
- 当前 dump 仍只有签名/字段，没有方法体；因此不能确认 `FormulaUtility` 的 function 组合顺序，不能确认削韧单位，也不能确认充能归属和共享规则。
- `runtimeApplicationTraceEvidence.applied = false`，不能直接改写 HP、削韧或自身能量最终公式。

下一步：

- 阶段 5-8AT 目标：优先寻找 `DamageElement`、`FormulaUtility`、`SPSystem`、`WeakBreakSystem` 的方法体或等价运行时证据，确认 `formulaParamValues`、`skillsub_ele_value.valueParam`、`weakBreakDamageRate`、`recoverSP/petRecoverSP/recoverInterval` 的实际应用顺序和单位。
- 若 IL2CPP dump 无法提供方法体，改走 AzPr Extractor 里的 native 符号/字符串交叉引用、反编译产物或可插桩运行时日志。

### 2026-07-08：阶段 5-8AT 原生方法符号与方法体缺口固化

本轮完成：

- 已盘点 `C:/Codex/AzPr Extractor/outputs/il2cpp-dump`：当前可用证据包括 `dump.cs` 签名/字段、`script.json` 原生方法地址与签名、`il2cpp.h` 字段布局、`stringliteral.json` 入口字符串，以及 `DummyDll/Assembly-CSharp.dll` 元数据 stub。
- 未发现可直接读取的 C# 方法体、IDA/Ghidra 伪代码或目标函数运行时 hook 日志；因此这一阶段只确认“入口可定位”，不确认公式顺序。
- `runtimeApplicationTraceEvidence.methodBodyStatus` 更新为 `native-addresses-and-signatures-found-method-bodies-not-extracted`。
- `runtimeApplicationTraceEvidence` 新增 `nativeMethodSymbolEvidence`，记录 27 个目标原生方法键、字段布局证据、字符串字面量证据、可用/缺失证据清单。
- HP 链新增 `nativeMethodSymbols`，覆盖 `AliveElementSystem.ExecuteDamageElement`、`DamageElement.Execute/Parse`、`FormulaUtility.GetOutputDamage/Calculate/GetFunctionParams/SkillDmgUp/WeaknessPointChange` 等 13 个入口。
- 削韧链新增 `nativeMethodSymbols`，覆盖 `FormulaUtility.GetOutputWeaknessDamage/WeaknessPointChange`、`WeakBreakSystem.OnTransmit/WeaknessPointUpdate/WeakBreaking/WeakBreakEnd` 等 11 个入口。
- 充能链新增 `nativeMethodSymbols`，覆盖 `DamageElement.RecoverSP`、`RecoverSPArgs..ctor`、`SPSystem.OnTransmit/RecoverSP` 4 个入口。
- `externalElementBindingSummary` 新增 `runtimeMethodBodyStatuses`、`runtimeNativeMethodSymbolStatuses`、`runtimeNativeMethodSymbolCount`、`gapsWithRuntimeNativeMethodSymbols`。
- Workbench 执行矩阵摘要新增 `原生入口 x/y`，切换到重击动作时可以看到 `原生入口 1/1`。

当前四动作原生入口候选结果：

- `externalElementBindingSummary.gapsWithRuntimeNativeMethodSymbols = 3/3`。
- `runtimeNativeMethodSymbolCount = 27`，按 `qualifiedName@rva` 去重。
- 单动作 `runtimeApplicationTraceEvidence.runtimeNativeMethodSymbolCount = 27`。
- 代表性 RVA：`FormulaUtility.GetOutputDamage = 0x187F360`，`FormulaUtility.GetOutputWeaknessDamage = 0x1885FF0`，`WeakBreakSystem.OnTransmit = 0x14C05A0`，`SPSystem.RecoverSP = 0x1483F40`，`DamageElement.RecoverSP = 0x138EEE0`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AT 证明的是三值运行时入口已经可以从 IL2CPP 导出定位到原生地址和字段布局。
- 仍没有方法体/伪代码/运行时调用顺序，不能确认 `formulaParamValues` 与 `skillsub_ele_value.valueParam` 的覆盖点。
- `weakBreakDamageRate = 7000`、`recoverSP = 5899`、`petRecoverSP = 22999`、`recoverInterval = 9999` 仍是字段候选，削韧单位、充能归属、共享比例和冷却/间隔触发都未确认。
- `runtimeApplicationTraceEvidence.applied = false`，不能直接改写 HP、削韧或自身能量最终公式。

下一步：

- 阶段 5-8AU 目标：为 5-8AT 固化的目标 RVA 生成或导入方法体级证据，优先走 Ghidra/IDA 反汇编、Il2CppDumper 脚本交叉引用或运行时 hook 采样。
- 重点验证 `FormulaUtility.GetOutputDamage/GetOutputWeaknessDamage/WeaknessPointChange`、`DamageElement.RecoverSP`、`SPSystem.OnTransmit/RecoverSP` 的调用顺序、单位缩放、参数覆盖点和触发条件。

### 2026-07-08：阶段 5-8AU 原生反汇编片段与充能字段门控证据

本轮完成：

- 已在本机定位客户端二进制：TC `C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll` 与当前 Extractor metadata 长度一致，JP `C:/AP/YostarGames/AZUPRO_JP/GameAssembly.dll` 暂作为非主用参考。
- 已确认 `DummyDll/Assembly-CSharp.dll` 只能通过 `ilspycmd` 得到 `[Address]` 和空方法 stub，不能作为 C# 方法体来源。
- 已用 `dumpbin /disasm:nobytes /range` 为 7 个目标函数建立 `nativeDisassemblyEvidence`：`FormulaUtility.GetOutputDamage`、`GetOutputWeaknessDamage`、`WeaknessPointChange`、`DamageElement.Parse`、`DamageElement.RecoverSP`、`SPSystem.RecoverSP`、`WeakBreakSystem.OnTransmit`。
- `runtimeApplicationTraceEvidence.status` 更新为 `runtime-application-entrypoints-found-native-disassembly-snippets`。
- `runtimeApplicationTraceEvidence.methodBodyStatus` 更新为 `native-disassembly-snippets-extracted-formula-semantics-unconfirmed`，并新增顶层 `nativeDisassemblyEvidence`、`runtimeNativeDisassemblyFunctionCount`、`runtimeNativeDisassemblyFunctionKeys`。
- `externalElementBindingSummary` 新增 `runtimeNativeDisassemblyStatuses`、`runtimeNativeDisassemblyFunctionCount`、`gapsWithRuntimeNativeDisassembly`。
- Workbench 执行矩阵摘要新增 `反汇编片段 x/y`，切换到重击动作时可以看到 `反汇编片段 1/1`。

当前已确认事实：

- `DamageElement.Parse` 中可见 `TDamageElementParams+0x12C/0x130/0x134 -> DamageElement+0x240/0x244/0x248` 的字段复制，对应 `recoverSP/petRecoverSP/recoverInterval` 进入运行时 `DamageElement`。
- `DamageElement.RecoverSP` 会检查 `DamageElement+0x240`，当 `m_recoverSP <= 0` 时提前返回，说明 `recoverSP` 字段确实门控自身能量恢复路径。
- `SPSystem.RecoverSP` 保留 `recoverTagType` 与 `baseDelta/delta` 参数，并能看到 `delta` 参与当前资源值累加与上限比较路径；但 `baseDelta`、共享比例、上限和取整规则仍未确认。
- `WeakBreakSystem.OnTransmit` 已看到对 `0x64 / 0x6F / 0x12B / 0x10C` 等 transmit type 的分支，但哪个分支对应削韧/失衡伤害仍未确认。
- `FormulaUtility.GetOutputDamage/GetOutputWeaknessDamage/WeaknessPointChange` 均确认存在非空原生方法体和字符串交叉引用，但下游间接调用目标、参数覆盖顺序、敌方属性顺序和单位缩放仍未确认。

当前四动作反汇编片段结果：

- `externalElementBindingSummary.gapsWithRuntimeNativeDisassembly = 3/3`。
- `runtimeNativeDisassemblyFunctionCount = 7`，按 `class.method@rva` 去重。
- 单动作 `runtimeApplicationTraceEvidence.runtimeNativeDisassemblyFunctionCount = 7`。
- 代表性 RVA：`FormulaUtility.GetOutputDamage = 0x187F360`，`FormulaUtility.GetOutputWeaknessDamage = 0x1885FF0`，`DamageElement.Parse = 0x138E5E0`，`DamageElement.RecoverSP = 0x138EEE0`，`SPSystem.RecoverSP = 0x1483F40`，`WeakBreakSystem.OnTransmit = 0x14C05A0`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AU 只证明目标原生方法体片段存在，并确认了部分充能字段复制/门控事实。
- `nativeDisassemblyEvidence.applied = false`，不能直接改写 HP、削韧或自身能量最终公式。
- HP 的 `FormulaUtility` 完整公式顺序、削韧 transmit type 映射、`weakBreakDamageRate` 单位、`recoverSP/petRecoverSP/recoverInterval` 的最终共享/冷却规则仍需继续验证。

下一步：

- 阶段 5-8AV 目标：把目标 RVA 的间接调用、关键字段偏移和 transmit enum/type 值继续命名，优先把 `DamageElement.Parse -> RecoverSP -> SPSystem.RecoverSP` 的充能链路拆成可测试的运行时公式探针。
- 若静态反汇编继续卡在间接调用，改走 Ghidra/IDA 伪代码、Capstone 脚本交叉引用或运行时 hook 采样，确认 `formulaParamValues`、`skillsub_ele_value.valueParam`、`weakBreakDamageRate` 和充能字段的实际单位。

### 2026-07-08：阶段 5-8AV 充能运行时公式探针

本轮完成：

- 新增 `selfEnergyRuntimeFormulaProbe` / `runtimeSelfEnergyFormulaProbe`，把阶段 5-8AU 已确认的充能链路转为可测试、未应用的公式探针。
- 探针记录 `TDamageElementParams.recoverSP/petRecoverSP/recoverInterval` 到 `DamageElement.m_recoverSP/m_petRecoverSP/m_recoverInterval` 的偏移映射：`0x12C/0x130/0x134 -> 0x240/0x244/0x248`。
- 探针记录三段运行时链路：`DamageElement.Parse` 字段复制、`DamageElement.RecoverSP` 的 `m_recoverSP > 0` 门控、`SPSystem.RecoverSP` 的 `delta` 资源更新路径。
- 探针为当前 raw 字段值同时给出 `raw-field` 和 `per-ten-thousand` 两种单位假设；这只是对比候选，不参与最终充能值。
- action-level `selfEnergyChange.sourceEvidence`、每 hit `hitCandidates[].selfEnergyChange.runtimeFormulaProbe`、非普攻缺口 `externalElementBinding.runtimeSelfEnergyFormulaProbe` 都已接入同一套探针结构。
- `externalElementBindingSummary` 新增 `runtimeSelfEnergyFormulaProbeStatuses`、`runtimeSelfEnergyFormulaProbeCandidateCount`、`runtimeSelfEnergyFormulaProbeGateOpenCount`、`gapsWithRuntimeSelfEnergyFormulaProbe`。
- Workbench 执行矩阵摘要新增 `充能探针 x/y`，切换到重击动作时可以看到 `充能探针 1/1`。

当前样例结果：

- 默认普通攻击 action-level 探针：`candidateCount = 2`、`gateOpenCount = 2`、`recoverSPValues = [2700]`、`perTenThousandRecoverSPValues = [0.27]`。
- 默认普通攻击每 hit 探针：第 1 段 `candidateCount = 2`、`gateOpenCount = 2`，仍保持 `applied = false`。
- 非普攻外部 DamageElement 探针：`109001251` 的 `recoverSP = 5899`、`petRecoverSP = 22999`、`recoverInterval = 9999`，per-10000 候选为 `0.5899 / 2.2999 / 0.9999`。
- 四动作缺口摘要：`gapsWithRuntimeSelfEnergyFormulaProbe = 3/3`，`runtimeSelfEnergyFormulaProbeCandidateCount = 3`，`runtimeSelfEnergyFormulaProbeGateOpenCount = 3`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run lint`：通过，0 error，16 个既有 warning。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。

当前边界：

- 阶段 5-8AV 只把已确认的字段复制、门控和 `delta` 更新路径结构化为探针，不确认最终充能数值。
- `selfEnergyRuntimeFormulaProbe.applied = false`，`selfEnergyChange.value` 仍只应用显式资源事件，不应用候选充能。
- `baseDelta` 与 `delta` 的构造来源、`petRecoverSP` 分享规则、`recoverInterval` 的时间基准/节流逻辑、`recoverTagType` 枚举和角色/宠物归属仍未确认。

下一步：

- 阶段 5-8AW 目标：继续沿 `SPSystem.RecoverSP`、`SPSystem.OnTransmit`、`RecoverSPArgs` 和 `DamageElement.RecoverSP` 的反汇编追 `baseDelta/delta` 构造、共享比例、recoverInterval 节流和 recoverTagType 枚举。
- 如果静态反汇编继续只给出片段事实，就优先做 runtime hook 采样点设计，把 `RecoverSPArgs` 字段和最终 SP 曲线按角色分别记录。

### 2026-07-08：阶段 5-8AW 归属/共享/间隔充能子探针

本轮完成：

- 已把 `SPSystem.OnTransmit@0x14837F0` 加入 `nativeDisassemblyEvidence`，目标函数总数从 7 个推进到 8 个。
- 已确认 `SPSystem.OnTransmit` 会按 transmit type `0x12F` 进入 `RecoverSPArgs` 分支，并调用 `SPSystem.RecoverSP`。
- 已确认 `RecoverSPArgs` 关键字段布局：`id@0x18`、`baseDelta@0x1C`、`delta@0x20`、`interval@0x24`、`tagType@0x28`、`skillId@0x2C`、`sharePercent@0x30`、`petSharePercent@0x34`、`petDelta@0x38`、`isAddition@0x3C`、`additionId@0x40`、`mainPetSharePercent@0x44`。
- 已确认 `isAddition = false` 时存在 `id + interval` 的节流路径，使用 `SPSystem.m_recoverTimerMap@0x20`；`isAddition = true` 时走直接恢复路径。
- 已确认共享回传路径会改写 `baseDelta/delta/petDelta` 后重新发送 type `0x12F`：`sharePercent` 对普通共享目标缩放 `baseDelta/delta`，`petSharePercent` 与 `mainPetSharePercent` 对宠物相关目标缩放 `petDelta`。
- 新增 `ownerShareIntervalProbe`，挂在 `selfEnergyRuntimeFormulaProbe.ownerShareIntervalProbe` 下；action-level、每 hit 候选和非普攻缺口都能复用同一结构。
- `externalElementBindingSummary` 新增 `runtimeSelfEnergyOwnerShareIntervalProbeStatuses`、`runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount`、`runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount`、`gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe`。
- Workbench 执行矩阵摘要新增 `归属探针 x/y`，切换到重击动作时可以看到 `归属探针 1/1`。

当前样例结果：

- 默认普通攻击 action-level：`ownerShareIntervalProbe.candidateCount = 2`、`gateOpenCount = 2`。
- 默认普通攻击每 hit：第 1 段 `ownerShareIntervalProbe.candidateCount = 2`、`gateOpenCount = 2`。
- 非普攻外部 DamageElement：`109001251` 可生成 1 条归属/共享/间隔子探针样本，`petDelta` 候选来自 `petRecoverSP = 22999`，per-10000 候选为 `2.2999`。
- 四动作缺口摘要：`gapsWithRuntimeSelfEnergyOwnerShareIntervalProbe = 3/3`，`runtimeSelfEnergyOwnerShareIntervalProbeCandidateCount = 3`，`runtimeSelfEnergyOwnerShareIntervalProbeGateOpenCount = 3`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。
- `npm run lint`：通过，0 error，16 个既有 warning。
- `npm test -- --run`：通过，13 个测试文件、105 条测试通过。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。

当前边界：

- 阶段 5-8AW 确认的是 `RecoverSPArgs` 在 `SPSystem.OnTransmit` 里的使用方式，不等于最终充能公式已经可应用。
- `TDamageElementParams.recoverSP/petRecoverSP/recoverInterval` 到 `RecoverSPArgs.baseDelta/delta/petDelta/interval` 的构造来源仍未确认。
- `recoverTagType` 枚举语义、共享目标筛选、recoverInterval 时间基准、角色/宠物归属和 runtime 曲线应用仍未确认。
- `ownerShareIntervalProbe.applied = false`，`selfEnergyChange.value` 仍只应用显式资源事件，不应用候选充能。

下一步：

- 阶段 5-8AX 目标：继续沿 `DamageElement.RecoverSP`、`RecoverSPArgs..ctor` / `OnReset` 和 `SPSystem.OnTransmit` 追 source-to-args 映射，优先确认 `recoverSP -> baseDelta/delta`、`petRecoverSP -> petDelta`、`recoverInterval -> interval` 的构造点。
- 如果静态反汇编仍无法确定构造来源，设计 runtime hook 采样点，按角色分别记录 `RecoverSPArgs` 字段快照、最终 SP 曲线、share rebroadcast 目标和间隔节流命中结果。

### 2026-07-08：阶段 5-8AX RecoverSPArgs 构造子探针

本轮完成：

- 已把 `DamageElement.RecoverSP@0x138EEE0` 的反汇编范围扩展到 `0x18138EEE0-0x18138F609`，覆盖 `RecoverSPArgs` 对象获取、字段写入和 type `0x12F` 发送路径。
- 已把 `RecoverSPArgs.OnReset@0x1254070` 加入 `nativeDisassemblyEvidence`，目标函数总数从 8 个推进到 9 个；`OnReset` 会把 `id` 到 `mainPetSharePercent` 的字段清零，说明 args 复用前会回到默认状态。
- 已确认 `DamageElement.m_recoverSP@0x240` 会转 float 并除以 native 常量后写入 `RecoverSPArgs.baseDelta@0x1C`。
- 已确认 `RecoverSPArgs.delta@0x20` 由 `baseDelta * (nativeConstant + runtimeModifierA + runtimeModifierB)` 推导；两个 runtime modifier 的来源仍未确认。
- 已确认 `DamageElement.m_petRecoverSP@0x244` 走同一 modifier 路径后写入 `RecoverSPArgs.petDelta@0x38`。
- 已确认 `DamageElement.m_recoverInterval@0x248` 会转 float 并除以 native 常量后写入 `RecoverSPArgs.interval@0x24`；该 divisor 的精确单位仍未确认。
- 已确认 `DamageElement.RecoverSP` 路径写入 `RecoverSPArgs.tagType@0x28 = 0`，对应 `TSpElementParams.ERecoverTagType.AttackRecoverySp`；枚举还包括 `AutoRecoverySp = 1`、`Other = 2`。
- 新增 `sourceToArgsProbe`，挂在 `selfEnergyRuntimeFormulaProbe.sourceToArgsProbe` 下；action-level、每 hit 候选和非普攻缺口都能复用同一结构。
- `externalElementBindingSummary` 新增 `runtimeSelfEnergySourceToArgsProbeStatuses`、`runtimeSelfEnergySourceToArgsProbeCandidateCount`、`runtimeSelfEnergySourceToArgsProbeGateOpenCount`、`gapsWithRuntimeSelfEnergySourceToArgsProbe`。
- Workbench 执行矩阵摘要新增 `构造探针 x/y`，切换到重击动作时可以看到 `构造探针 1/1`。

当前样例结果：

- 默认普通攻击 action-level：`sourceToArgsProbe.candidateCount = 2`、`gateOpenCount = 2`，`recoverSP = 2700` 的 `baseDelta` 候选为 `0.27`。
- 默认普通攻击每 hit：第 1 段 `sourceToArgsProbe.candidateCount = 2`、`gateOpenCount = 2`。
- 非普攻外部 DamageElement：`109001251` 的 `recoverSP = 5899` 对应 `baseDelta` 候选 `0.5899`，`petRecoverSP = 22999` 对应 `petDelta` 基础候选 `2.2999`。
- 四动作缺口摘要：`gapsWithRuntimeSelfEnergySourceToArgsProbe = 3/3`，`runtimeSelfEnergySourceToArgsProbeCandidateCount = 3`，`runtimeSelfEnergySourceToArgsProbeGateOpenCount = 3`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AX 证明的是 `DamageElement.RecoverSP` 如何构造并发送 `RecoverSPArgs`，仍不等于最终充能公式可应用。
- `delta` 和 `petDelta` 依赖的两个 runtime modifier 来源仍未确认。
- `recoverInterval` 的 native divisor 和最终时间基准仍未确认。
- `sharePercent/petSharePercent` 的配置来源对象、共享目标筛选、最终 owner 选择和实际 SP 曲线仍未确认。
- `sourceToArgsProbe.applied = false`，`selfEnergyChange.value` 仍只应用显式资源事件，不应用候选充能。

下一步：

- 阶段 5-8AY 目标：继续追 `DamageElement.RecoverSP` 中两个 runtime modifier 调用、`recoverInterval` native divisor、`sharePercent/petSharePercent` 来源配置和最终 owner 选择。
- 如果静态证据仍不足，设计 runtime hook 采样点，按角色记录 `RecoverSPArgs` 字段快照、share rebroadcast 目标、interval 节流命中结果和最终 SP 曲线。

### 2026-07-08：阶段 5-8AY RecoverSP 修正倍率与分享配置探针

本轮完成：

- 已确认 `DamageElement.RecoverSP@0x138EEE0` 的两个 runtime modifier 来源：
  - `propertyId = 105 / 0x69` 对应 `EBattlePropertyType.SPGETUP`，dump 描述为能量回复增幅。
  - `propertyId = 228 / 0xE4` 对应 `EBattlePropertyType.SPGETUP_ATK`，dump 描述为能量攻击回复增幅。
- 已确认两个 modifier 的静态取值链：
  - 常规路径调用 `AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0`，参数 `isRatio = true`、`tags = null`。
  - snapshot/attacker 路径调用 `SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240`。
  - `MyFloat.op_Implicit(float)@0x11B2AE0` 把 `MyFloat` 转为 float 参与公式。
- 已确认 `BattleConfigData.shareEnergyPercent@0x108` 写入 `RecoverSPArgs.sharePercent@0x30`，`BattleConfigData.petShareEnergyPercent@0x10C` 写入 `RecoverSPArgs.petSharePercent@0x34`；`RecoverSPArgs.mainPetSharePercent@0x44` 仍为常量 `1.0`。
- 新增 `runtimeModifierProbe`，挂在 `selfEnergyRuntimeFormulaProbe.runtimeModifierProbe` 下；它记录 `delta/petDelta` 的公式形态、modifier 属性来源、`nativeConstant@0x189956B08`、`recoverInterval` divisor 地址 `0x189956D8C` 和分享配置来源。
- `externalElementBindingSummary` 新增 `runtimeSelfEnergyModifierProbeStatuses`、`runtimeSelfEnergyModifierProbeCandidateCount`、`runtimeSelfEnergyModifierProbeGateOpenCount`、`gapsWithRuntimeSelfEnergyModifierProbe`。
- Workbench 执行矩阵摘要新增 `修正探针 x/y`，切换到重击动作时可以看到 `修正探针 1/1`。

当前样例结果：

- 默认普通攻击 action-level：`runtimeModifierProbe.candidateCount = 2`、`gateOpenCount = 2`，modifier 属性为 `[105, 228]`。
- 非普攻外部 DamageElement：`109001251` 的 `deltaFormulaPreview.baseDeltaCandidate = 0.5899`，`petBaseDeltaCandidate = 2.2999`，公式形态为 `base * (nativeConstant@0x189956B08 + SPGETUP + SPGETUP_ATK)`。
- 四动作缺口摘要：`gapsWithRuntimeSelfEnergyModifierProbe = 3/3`，`runtimeSelfEnergyModifierProbeCandidateCount = 3`，`runtimeSelfEnergyModifierProbeGateOpenCount = 3`。

验收结果：

- `npx prettier --write src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AY 证明的是 modifier 来源和分享配置字段来源，仍不等于最终充能公式可应用。
- `nativeConstant@0x189956B08` 的实际值未读取；它很可能是公式基准常量，但当前只确认地址和参与位置。
- `recoverInterval` divisor `0x189956D8C` 的实际值和时间单位仍未确认。
- `SPGETUP/SPGETUP_ATK` 的实时属性值、owner/share 目标筛选、interval 节流命中和最终每角色 SP 曲线仍未确认。
- `runtimeModifierProbe.applied = false`，`selfEnergyChange.value` 仍只应用显式资源事件，不应用候选充能。

下一步：

- 阶段 5-8AZ 目标：读取或 runtime hook 采样 `nativeConstant@0x189956B08` 与 `recoverInterval` divisor `0x189956D8C` 的实际值，确认 `SPGETUP/SPGETUP_ATK` 的单位和默认值。
- 同步设计按角色采样点：记录 `RecoverSPArgs.id/baseDelta/delta/interval/sharePercent/petSharePercent/petDelta/mainPetSharePercent` 字段快照、share rebroadcast 目标、interval 节流结果和最终自身能量曲线。

### 2026-07-08：阶段 5-8AZ RecoverSP 原生常量读取

本轮完成：

- 已确认原始客户端 `GameAssembly.dll` 路径：`C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll`，文件大小 `222,485,544` 字节，PE imageBase 为 `0x180000000`。
- 已直接解析 PE 节表并从 `.rdata` 读取三处 float32 常量：
  - `0x189956B08 / RVA 0x9956B08 / fileOffset 0x9954708 = 1.0`，用于 `RecoverSPArgs.delta/petDelta` 的 modifier 基准常量。
  - `0x189956D8C / RVA 0x9956D8C / fileOffset 0x995498C = 1000.0`，用于 `DamageElement.m_recoverInterval -> RecoverSPArgs.interval`。
  - `0x189956FB0 / RVA 0x9956FB0 / fileOffset 0x9954BB0 = 10000.0`，用于 `recoverSP/petRecoverSP` 原始字段缩放。
- 新增 `nativeConstantReadEvidence`，挂入 `SELF_ENERGY_SOURCE_TO_ARGS_RULES` 和 `SELF_ENERGY_RUNTIME_MODIFIER_RULES`，记录 source file、imageBase、section、RVA、fileOffset、float32 和 uint32 hex。
- `sourceToArgsProbe` 已升级：
  - `recoverSP -> baseDelta` 记录 `nativeDivisorValue = 10000`。
  - `recoverInterval -> interval` 记录 `nativeDivisorValue = 1000` 和 `intervalSecondsCandidate`。
- `runtimeModifierProbe` 已升级：
  - `deltaFormulaShape.expression = scaledSource * (1 + SPGETUP + SPGETUP_ATK)`。
  - `deltaFormulaPreview.nativeConstantValue = 1`。
  - `intervalScaleCandidate.nativeDivisorValue = 1000`。

当前样例结果：

- 默认普通攻击 action-level：`recoverSP = 2700 -> baseDeltaCandidate = 0.27`，`recoverInterval = 9999 -> intervalSecondsCandidate = 9.999`。
- 非普攻外部 DamageElement：`109001251` 的 `recoverSP = 5899 -> 0.5899`，`petRecoverSP = 22999 -> 2.2999`，`recoverInterval = 9999 -> 9.999`。
- 当前公式形态已经能写为 `base * (1 + SPGETUP + SPGETUP_ATK)`，但 `SPGETUP/SPGETUP_ATK` 实时属性值仍未采样。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8AZ 证明的是原生常量值和静态缩放关系，仍不等于最终充能公式可应用。
- `SPGETUP/SPGETUP_ATK` 的实时属性值、默认值、buff/装备影响和快照路径差异仍未确认。
- `recoverInterval / 1000` 已确认，但 `SPSystem.OnTransmit` 的节流命中时机、timer map key 和 share rebroadcast 顺序仍未通过运行时样本闭环。
- `selfEnergyChange.value` 仍只应用显式资源事件，不应用候选充能。

下一步：

- 阶段 5-8BA 目标：设计或接入 runtime hook 采样点，按角色记录 `RecoverSPArgs` 字段快照、`SPGETUP/SPGETUP_ATK` 实时属性值、owner/share 目标筛选、interval 节流结果和最终自身能量曲线。
- 若暂时无法直接 hook 客户端，先在项目中建立 runtime sample schema 和离线导入入口，确保后续采样能直接驱动 HP/削韧/能量三曲线验证。

### 2026-07-08：阶段 5-8BA RecoverSP runtime 采样契约

本轮完成：

- 新增 `SELF_ENERGY_RUNTIME_SAMPLE_SCHEMA`，把后续 hook / 离线导入需要的 runtime 样本字段固化为证据契约。
- 新增 `runtimeSamplingProbe`，挂在 `selfEnergyRuntimeFormulaProbe.runtimeSamplingProbe` 下；action-level、每 hit 候选和非普攻缺口都能复用同一结构。
- 采样契约覆盖 5 类 hook 点：
  - `DamageElement.RecoverSP@0x138EEE0`：在 `RecoverSPArgs` 字段写完、type `0x12F` 发送前记录字段快照。
  - `AliveProperty.GetBattlePropertyCurrentValue@0x12A7EE0`：采样 `SPGETUP(105)` / `SPGETUP_ATK(228)` 的实时属性值。
  - `SnapshotPropertyManager.GetBattlePropertyCurrentValue@0x181D240`：采样 attacker snapshot 路径的同两项属性值。
  - `SPSystem.OnTransmit@0x14837F0`：采样 `0x12F` 分支、timer map 节流、direct recover 和 share rebroadcast 目标。
  - `SPSystem.RecoverSP@0x1483F40`：采样 `spBefore/spAfter/spDeltaApplied`，用于闭环最终每角色 SP 曲线。
- 采样契约定义离线导入事件类型：`recover-sp-args-built`、`recover-sp-modifier-property-read`、`recover-sp-ontransmit-12f`、`recover-sp-applied`、`recover-sp-share-rebroadcast`。
- Workbench 执行矩阵摘要新增 `采样契约 x/y`，切换到重击动作时可以看到 `采样契约 1/1`。

当前样例结果：

- 默认普通攻击 action-level：`runtimeSamplingProbe.candidateCount = 2`、`gateOpenCount = 2`、`importedRuntimeSampleCount = 0`，状态为 `runtime-sampling-schema-built-awaiting-capture`。
- 非普攻外部 DamageElement：`109001251` 的采样预期包含 `baseDelta = 0.5899`、`intervalSecondsCandidate = 9.999`、`SPGETUP/SPGETUP_ATK` 两项必采实时值和事件关联键。
- 四动作缺口摘要：`gapsWithRuntimeSelfEnergySamplingProbe = 3/3`，`runtimeSelfEnergySamplingProbeCandidateCount = 3`，`runtimeSelfEnergySamplingProbeGateOpenCount = 3`。

验收结果：

- `npx prettier --write src/simulation/projection/projectSimulationResult.js src/features/workbench/AnalysisPanel.vue src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、44 条测试通过。

当前边界：

- 阶段 5-8BA 证明的是 runtime hook / 离线样本导入契约已经建立，仍未导入真实 runtime 样本。
- `runtimeSamplingProbe.importedRuntimeSampleCount = 0`，`importStatus = runtime-samples-not-imported`。
- `SPGETUP/SPGETUP_ATK` 实时属性值、share rebroadcast 目标、timer map 节流命中和最终每角色 SP 曲线仍未确认。
- `selfEnergyChange.value` 仍只应用显式资源事件，不应用候选充能。

下一步：

- 阶段 5-8BB 目标：建立离线 runtime 样本导入/fixture 入口，把真实 hook JSON 或手动整理样本映射为 `recover-sp-args-built`、`recover-sp-ontransmit-12f`、`recover-sp-applied` 等事件。
- 导入后优先验证 4 个闭环：`baseDelta = recoverSP / 10000`、`delta = baseDelta * (1 + SPGETUP + SPGETUP_ATK)`、`interval = recoverInterval / 1000`、`spAfter - spBefore = final applied delta`。

### 2026-07-08：阶段 5-8BB RecoverSP 离线 runtime 样本入口

本轮完成：

- `compileProject()` 现在会保留 `project.metadata.runtimeSampleCaptures`、`recoverSpRuntimeSampleCaptures` 或 `runtimeSamples`，并把它们带入编译后的 `scenario.runtimeSampleCaptures`。
- `projectSimulationResult()` 新增 RecoverSP runtime sample context，把 capture 规范化为统一事件形状：`eventType`、`captureSessionId`、`frameIndex`、`sourceElementConfigId`、`pathId`、`args`、modifier 值、OnTransmit 信息和最终 SP 曲线字段。
- `runtimeSamplingProbe` 已能消费离线样本并生成：
  - `sampleImportSummary`
  - `runtimeSampleCaptures`
  - `sampleExpectations[].runtimeSampleMatch`
  - `validationResults[]`
- 新增手动 fixture：`src/simulation/fixtures/recoverSpRuntimeSampleFixture.js`，用于模拟一条 `109001081` 的 RecoverSP 采样链。
- Workbench 三值来源文本在有导入样本时显示 `样本验证 x/y`。

当前 fixture 覆盖的事件：

- `recover-sp-args-built`
- `recover-sp-modifier-property-read`，覆盖 `SPGETUP(105)` 与 `SPGETUP_ATK(228)`
- `recover-sp-ontransmit-12f`
- `recover-sp-applied`
- `recover-sp-share-rebroadcast`

当前样例结果：

- `109001081` fixture 使用 `recoverSP = 2700`、`petRecoverSP = 10399`、`recoverInterval = 9999`、`SPGETUP = 0.2`、`SPGETUP_ATK = 0.05`。
- 校验结果：
  - `baseDelta = 0.27`
  - `delta = 0.3375`
  - `petDelta = 1.299875`
  - `interval = 9.999`
  - `spAfter - spBefore = 0.3375`
- 默认普通攻击 action-level 当前有 2 个候选 element，fixture 只覆盖 `109001081`，因此 `runtimeSamplingProbe.status = runtime-sampling-offline-samples-partially-validated`，`sampleImportSummary.validatedSampleCount = 1`，`missingSampleCount = 1`。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、12 条测试通过。

当前边界：

- 阶段 5-8BB 证明的是离线样本入口、事件匹配和数值校验器已经落地。
- 当前 fixture 是手动整理样本，不是真实客户端 hook 采样结果。
- `109001306`、非普攻外部 DamageElement `109001251`、share rebroadcast 目标、timer map 节流命中和真实每角色 SP 曲线仍未由真实运行时样本确认。
- `selfEnergyChange.value` 仍不应用候选充能；`runtimeSamplingProbe` 仍为 evidence-only。

下一步：

- 阶段 5-8BC 目标：接入真实 hook JSON 或运行时采样导出的 capture 文件。
- 优先扩大覆盖：默认普攻两个 action-level element、非普攻 `109001251`、share target 列表、interval throttle 命中/未命中两类样本、最终每角色 SP 曲线。

### 2026-07-08：阶段 5-8BC 寒悠悠 skill_control 重导与中文命中轨解析

本轮完成：

- 使用 AzPr Extractor 对 `skill_control_101003*` 做聚焦 manifest-sliced 重导：30 个 bundle、900 个 MonoBehaviour 对象真实导出，错误数 0。
- 确认寒悠悠原先不是缺资源，而是旧导出结果全为 `stubOnly` 壳；重导后项目生成器可以读取 `behaviorlineControl`、`behaviorList`、`skillControlData`、`elementBaseDatas`、`elementDataList`、`elementIdDatas` 等字段。
- `scripts/generate-azpr-data.mjs` 扩展中文轨道识别：
  - `攻击框` / `命中` 归入 HP 伤害候选。
  - `抗击` 归入敌人韧性削减候选。
- 行为对象元素引用不再只读 `elementBaseDatas`，同步读取 `elementDataList`、`elementIdDatas`、`toOwnElementDatas`，并记录 `elementRefSourceCounts`。
- 重新生成 `skill-asset-evidence.json` 后，全局候选从 HP 1 技能 / 韧性 0 技能扩展为 HP 7 技能 / 韧性 7 技能；外部 Element 对象解析从 6 技能 43 引用扩展为 14 技能 89 引用；DamageElement 字段映射从 16 个对象扩展为 31 个对象。

寒悠悠当前结果：

- `10100301 鸢回影`：159 帧，桥接到 `10100302/03/04/05`；已解析 15 条行为引用、1 条外部 element 引用，外部对象包含 `TDamageElementParams 101003087`。
- `10100312 花照夜`：180 帧；已解析 26 条行为引用、14 条外部 element 引用，外部 DamageElement 包含 `101003033 / 101003108`。
- `10100313 沐星雨`：290 帧，存在 `Skill1` 与 `Skill1_Tps` 两条动画状态；已解析 25 条行为引用、6 条外部 element 引用，外部 DamageElement 包含 `101003118 / 101003122`。
- `10100322 缚风烟`：191 帧；已解析 14 条行为引用、6 条外部 element 引用，外部 DamageElement 包含 `101003071 / 101003074`。
- `10100361` / `10100362` 当前仍缺动作轨 timing evidence，只看到资源映射和元素引用壳。

当前边界：

- 本阶段只确认寒悠悠 skill_control 可以被读入并形成 HP/韧性/能量候选字段，不代表最终伤害公式已应用。
- 部分外部 Element 名称仍有原始编码乱码；后续 UI 和报告应优先显示 `elementConfigId`、PathID、脚本类型和字段值。
- `10100301` 的普攻入口已找到连段子技能，但普通攻击每段 hit 到 DamageElement 的精确绑定仍未闭合。
- `selfEnergyChange.value`、`hpDamage.value`、`toughnessDamage.value` 仍不应用候选公式。

下一步：

- 阶段 5-8BD 目标：把寒悠悠 `10100302/03/04/05` 普攻子技能链拆成每段 hit 组，并把 hit 组绑定到 `TDamageElementParams`。
- 之后再接入真实 hook JSON / runtime capture，验证默认普攻、寒悠悠样本、非普攻 `109001251` 的 HP / 韧性 / 能量三曲线。

### 2026-07-08：阶段 5-8BD 末音 skill_control 清理重导与缺口复核

本轮完成：

- 清理 `C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList/skill_control_109001*.asset` 旧目录 27 个，去掉旧导出残留的 `stubOnly` JSON。
- 使用 AzPr Extractor 对 `skill_control_109001*` 重新做 manifest-sliced MonoBehaviour 导出：27 个 bundle、1437 个 MonoBehaviour JSON，错误数 0。
- 重导后确认末音目录为 1437 个真实 JSON、`stubOnly = 0`、不可读 JSON = 0。
- 重新运行 `npm run data:generate`，生成报表基于干净导出目录。

末音当前已解析部分：

- `10900101 哈库茵剑舞`：97 个 JSON，当前解析 80 个；40 条 timeline、80 个行为节点，帧范围 `0-300`；外部 Element 引用 `14/14` 已匹配，DamageElement 包含 `109001251 / 109001306 / 109001081`。
- `10900112 涌雷动之跃`：75 个 JSON，当前解析 75 个；37 条 timeline、75 个行为节点，帧范围 `0-259`；外部 Element 引用 `9/9` 已匹配，DamageElement 包含 `109001033 / 109001121`。
- `10900113 绽华章之舞`：95 个 JSON，当前解析 80 个；40 条 timeline、80 个行为节点，帧范围 `0-999`；外部 Element 引用 `25/25` 已匹配，DamageElement 包含 `796 / 296 / 109001173 / 109001133`。
- `10900121 凝飓风之旋`：104 个 JSON，当前解析 80 个；39 条 timeline、81 个行为节点，帧范围 `0-999`；外部 Element 引用 `1/1` 已匹配，DamageElement 包含 `109001349 / 109001350`。
- `10900161 哈库茵之耀`：3 个 JSON，当前解析 3 个；1 条 timeline、3 个行为节点，帧范围 `0-1`；外部 Element 引用 `1/1` 已匹配，当前只命中自身能量 lane。
- `10900162`：1 个 JSON，当前解析 1 个；没有有效 timeline，外部 Element 引用 0。

实际缺口：

- 末音没有外部 DamageElement 映射缺口：主技能外部引用均为 `resourceMapUnmatchedElementBaseRefs = 0`。
- 仍有生成器抽样上限缺口：`10900101` 余 17 个 JSON 未纳入当前报表、`10900113` 余 15 个、`10900121` 余 24 个。
- `10900101` 当前样本未命中韧性 lane；`10900161` 更像 1 帧能量壳；`10900162` 没有有效时序。
- DamageElement 字段已能看到 HP、削韧、recoverSP / petRecoverSP / recoverInterval 候选，但 `formulaFunctionEvidence.applied = false`，仍未应用为最终 HP / 韧性 / 能量曲线。
- `selfEnergyChange` 对主动作仍缺真实 runtime capture；需要真实 hook 样本确认 SPGETUP、SPGETUP_ATK、interval 节流、share target 和最终每角色能量变化。
- 全局仍缺 4 个当前技能的 `skill_control` 目录：`10101062`、`10700262`、`10800562`、`11200262`；与末音无关。

下一步：

- 阶段 5-8BE 目标：为目标角色开放全量 skill_control 解析，消除 `SKILL_CONTROL_SAMPLE_FILE_LIMIT = 80` 对 `10900101/13/21` 的剩余抽样缺口。
- 同步推进寒悠悠 `10100302/03/04/05` 普攻子技能 hit 绑定，并把末音/寒悠悠的真实 hook capture 接入 HP / 韧性 / 能量三曲线验证。

### 2026-07-08：阶段 5-8BE skill_control 解析上限提高到 200

本轮完成：

- 将 `scripts/generate-azpr-data.mjs` 的 `SKILL_CONTROL_SAMPLE_FILE_LIMIT` 从 80 提高到 200。
- 重新运行 `npm run data:generate`，使 `skill-asset-evidence.json` 基于新的抽样上限生成。
- 总解析覆盖从 5092 / 7170 个 MonoBehaviour JSON 提高到 6694 / 7170，剩余被上限截断的技能从 33 个降到 4 个。
- 末音 `109001*` 已全部覆盖：`10900101` 97/97、`10900112` 75/75、`10900113` 95/95、`10900121` 104/104、`10900161` 3/3、`10900162` 1/1。
- 寒悠悠 `101003*` 已全部覆盖：`10100301` 65/65、`10100312` 137/137、`10100313` 177/177、`10100322` 73/73、`10100361` 5/5、`10100362` 5/5。

新增证据变化：

- 末音 `10900101` 补扫后行为引用从 36 增到 44，timeline 从 40 增到 48，行为节点从 80 增到 99；HP hit 候选仍为 5，外部 Element 引用仍为 14/14 无未匹配。
- 末音 `10900113` 外部 Element 引用从 25/25 增到 29/29，HP lane 从 10 增到 12。
- 末音 `10900121` 外部 Element 引用从 1/1 增到 4/4，HP lane 从 1 增到 4。
- 寒悠悠 `10100313` 行为引用从 25 增到 28，外部 Element 引用从 6/6 增到 7/7，HP lane 从 6 增到 7。

当前仍被 200 上限截断的技能：

- `11100101 疾风投羽`：431 个 JSON，解析 200，剩余 231。
- `10300201 灵感的火花`：351 个 JSON，解析 200，剩余 151。
- `10100712 蛟龙戏珠`：279 个 JSON，解析 200，剩余 79。
- `10700212 浮茵`：215 个 JSON，解析 200，剩余 15。

当前边界：

- 200 上限已足够覆盖当前重点角色末音与寒悠悠，但不是全局全量解析。
- 新增候选仍是 evidence-only；`formulaFunctionEvidence.applied = false`，HP / 韧性 / 能量最终公式仍需真实 runtime capture 验证。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、106 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。

下一步：

- 阶段 5-8BF 目标：如果后续分析涉及 `11100101 / 10300201 / 10100712 / 10700212`，再引入目标技能全量解析或按角色白名单全量解析。
- 继续闭合寒悠悠普攻子技能 hit 绑定，并接入真实 hook JSON / runtime capture。

### 2026-07-08：阶段 5-8BF 寒悠悠普攻 resourceMap 子段绑定

本轮完成：

- `buildExternalElementObjectEvidence()` 开始追踪只有 `skillResourceMapEvidence.elementRefCount > 0` 的 EventBridge 目标技能，避免目标技能行为链未命中时漏掉根级 `skillResourceMaps.elements`。
- `buildChildNormalAttackHitGroup()` 在 HP timeline / behavior chain 不足时补充 `skillResourceMap` fallback 元素引用。
- hit group 的 DamageElement 匹配支持 `roundedPathId`，用于连接 Unity 导出里的大整数 pathId 和当前 JS 侧安全整数近似值。
- Workbench 投影层新增 `resourceMapElementRefCount`、`resourceMapUnmatchedElementBaseRefCount` 与 `per-hit-resource-map-elements-found-fields-missing` 状态，能区分“已找到 resourceMap 元素但未确认 DamageElement 字段”的缺口。
- 重新运行 `npm run data:generate`，外部元素解析范围从 14 个技能 / 89 个引用提高到 18 个技能 / 97 个引用，DamageElement 字段映射从 13 个技能 / 31 个对象提高到 15 个技能 / 33 个对象。

寒悠悠 `10100301` 普攻当前结果：

- 第 1 段仍来自主技能既有 DamageElement `101003087`，可见 `recoverSP = 6000`、`weakBreakDamageRate = 7000`。
- 第 2 段 `10100302` 通过 resourceMap fallback 命中 DamageElement `101003046`，可见 `recoverSP = 6299`、`weakBreakDamageRate = 7000`。
- 第 3 段 `10100303` 通过 resourceMap fallback 命中 DamageElement `101003037`，可见 `recoverSP = 3600`、`weakBreakDamageRate = 7000`。
- 第 4 段 `10100304` 已解析到 `101003076 / TFxElementParams` 与 `101003180 / unknown scriptPathId 5576338162890961044`，但暂未确认 DamageElement 字段。
- 第 5 段 `10100305` 已解析到 `101003101 / TFreezeFrameElementParams`、`101003038 / TFxElementParams` 与 `101003181 / unknown scriptPathId 5576338162890961044`，但暂未确认 DamageElement 字段。

当前边界：

- 第 2/3 段只是静态字段候选闭合，仍未应用最终 HP / 韧性 / 能量公式。
- 第 4/5 段不是外部引用缺失，而是未知 Element 类型缺口；需要识别 `scriptPathId = 5576338162890961044` 对应的 IL2CPP 类型与嵌套引用语义。
- 寒悠悠普攻描述段数仍未完成自动拆分；当前子链候选来自 `10100302/03/04/05` 四个 EventBridge 子技能，加上主技能第 1 段证据。
- 真实 runtime capture 仍是最终确认帧、倍率、削韧和充能公式的必要条件。

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、21 条测试。

下一步：

- 阶段 5-8BG 目标：识别寒悠悠 `10100304/05` 的 unknown Element 脚本类型 `5576338162890961044`，确认它是伤害、生成器还是二级效果桥，并在确认后接入嵌套 Element 解析。
- 如后续分析进入 `11100101 / 10300201 / 10100712 / 10700212`，再引入目标技能全量解析或按角色白名单全量解析。
- 继续接入真实 hook JSON / runtime capture，把静态候选转成可验证的 HP / 韧性 / 能量三曲线。

### 2026-07-08：阶段 5-8BG 寒悠悠普攻第 5 段 buff 引用桥确认

本轮完成：

- `scripts/generate-azpr-data.mjs` 新增 `buff_info.json` 与 `lang_buff_info.json` 输入，用于识别 Element `formulaParams.formulaParamValues` 中直接出现的 buff id。
- 新增 `formulaParamReferenceEvidence`：当 Element 的 formula 参数命中 `buff_info.id` 时，记录 buff 名称、描述、图标、类型、引用槽位和目标 `TBuffElementParams` 对象。
- 新增 `formulaParamBridgeCandidate`：对脚本类型仍未知但 formula 参数引用 buff 的 Element 标记为 `buff-trigger-or-apply-bridge-candidate`。
- hit group 新增 `externalElementObjectReferenceCount`、`externalElementObjectReferences`、`formulaParamBuffReferenceCount`、`formulaParamBuffReferenceIds` 与 `formulaParamBuffReferences`。
- Workbench 投影层新增 `per-hit-buff-reference-found-fields-missing` 状态，用来区分“找到 buff 桥但未找到 DamageElement 字段”和普通 resourceMap 缺字段。
- 为 `lang_buff_info` 的超大语言 ID 增加局部 BigInt 近邻索引，避免 JS 数字精度丢失导致 `433804...` 语言 ID 不能还原为中文。

寒悠悠 `10100301` 普攻新增确认：

- 第 5 段 `10100305` 的 `101003181 / scriptPathId 5576338162890961044` 在 `formulaParams.formulaParamValues` 第 2、13 槽引用 `101003079`。
- `101003079` 在 `buff_info` 中为 `焰火`，描述为 `受到特定伤害时触发爆炸`，类型 `2`，图标 `tex_icon_buff_101003_Skill0.png`。
- 外部 Element 解析中已经找到 `101003079 / TBuffElementParams`，持续时间字段 `time = 10000`、`frequency = 1`。
- 因此第 5 段当前不再是“完全未知外部缺口”，而是“命中时通过 unknown Element 引用焰火 buff 的桥候选”；但它仍不是直接 DamageElement。

当前边界：

- `scriptPathId = 5576338162890961044` 的准确 IL2CPP 类型名仍未解析出来。
- 第 4 段 `10100304 / 101003180` 仍没有 buff id 或 DamageElement 字段，只能标记为 resourceMap 元素已解析但字段未确认。
- `焰火` 的“受到特定伤害时触发爆炸”说明了后续触发语义，但爆炸实际伤害 Element、触发条件、触发帧、削韧和充能仍未闭合。
- 该阶段只增加证据和 UI 状态，不应用 HP / 韧性 / 能量最终公式。

验收结果：

- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、21 条测试。

下一步：

- 阶段 5-8BH 目标：追踪 `焰火 / buff 101003079` 的爆炸触发链，查找它是否通过 buff runtime、子 Element、或 `scriptPathId 5576338162890961044` 派生出真正的 DamageElement。
- 继续尝试从 IL2CPP dump、原生符号或 Extractor typetree 中识别 `5576338162890961044` 的准确类型名。
- 可优先检查 `C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/Element/Hero/109001.asset/MonoBehaviour/` 中同样引用 `m_Script.m_PathID = 5576338162890961044` 的对象，用字段签名辅助反推类型。
- 若能找到爆炸 DamageElement，再把它接入第 5 段 hit group，并保持公式仍为 evidence-only 直到 runtime capture 验证。

### 2026-07-08：阶段 5-8BH TSummonElementParams 召唤桥确认

本轮完成：

- 通过 IL2CPP dump 确认 `scriptPathId = 5576338162890961044` 对应配置类型为 `TSummonElementParams`，来源锚点为 `dump.cs:396216-396258`，标签为 `召唤`。
- 同步确认运行时类型为 `SummonElement : BaseElement`，来源锚点为 `dump.cs:275944-275984`，包含 `BeforeExecute()` / `Execute()` 入口。
- `scripts/resolve-azpr-element-objects.py` 已把该脚本类型加入识别目录，并为外部对象导出 `summonFields`，包括 `summonUnitId`、`summonLifeTime`、`summonCount`、`summonTotalMaxCount`、召唤点和继承字段。
- `scripts/generate-azpr-data.mjs` 已把 `TSummonElementParams` 加入 `elementTypeCatalogEvidence`，并把带 buff formula 参数的召唤对象标记为 `summon-element-buff-trigger-bridge-candidate`。
- 寒悠悠普攻第 4 段 `10100304 / 101003180` 当前确认为召唤 Element：`summonUnitId = 480059`、`summonLifeTime = 2500`、`summonCount = 1`、`summonTotalMaxCount = 5`。该段仍没有 DamageElement 字段或 buff 引用。
- 寒悠悠普攻第 5 段 `10100305 / 101003181` 当前确认为召唤 Element：`summonUnitId = 480060`、`summonLifeTime = 2500`、`summonCount = 1`、`summonTotalMaxCount = 5`，且 `formulaParams.formulaParamValues` 第 2、13 槽继续引用 `101003079 / 焰火`。
- 辅助检查 `Element/Hero/109001.asset` 下同 scriptPathId 对象，确认同类对象也包含 `summonUnitId / summonLifeTime / summonCount / summonTotalMaxCount` 等字段，字段签名与 `TSummonElementParams` 一致。
- BWiki / NewTable 侧额外线索显示 `101003079 / 焰火` 还出现在 `50000702 / 灼焰火环`、`50015702 / 焰火旋风`、`50015704 / 焰火雀-合击` 等技能链中，相关 `skillsub_ele_value` 有可升级的 A/G 槽位；但这些线索尚未直接绑定到寒悠悠普攻第 5 段召唤物。

当前边界：

- `101003180 / 101003181` 现在不再是 unknown Element，而是召唤桥；但它们仍不是直接 `TDamageElementParams`。
- `101003181 -> 101003079 / 焰火` 只证明第 5 段召唤对象引用了 buff；爆炸实际 DamageElement、触发条件、触发帧、削韧和充能仍未闭合。
- `summonUnitId = 480059 / 480060` 的单位、子技能、bullet、buff runtime 或二级效果资源尚未追到。
- 该阶段只增加证据类型、字段导出和候选标注，不应用 HP / 韧性 / 能量最终公式。

验收结果：

- `python -m py_compile scripts/resolve-azpr-element-objects.py`：通过。
- `npm run data:generate`：通过，重新生成 `src/data/generated`。
- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、21 条测试。
- `npm run test -- --run`：通过，13 个测试文件、106 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用提示和大 chunk 提示。

下一步：

- 阶段 5-8BI 目标：沿 `summonFields.summonUnitId = 480059 / 480060` 继续追单位、bullet、技能、buff runtime 或二级效果资源，寻找真正的爆炸 `TDamageElementParams`。
- 同步追踪 `101003079 / 焰火` 与 `50000702 / 灼焰火环`、`50015702 / 焰火旋风`、`50015704 / 焰火雀-合击` 的静态关系，判断它们是否能解释第 5 段召唤物的触发伤害。
- 如果静态资源仍不能闭合，准备把第 5 段召唤物和 `焰火` 触发链纳入 runtime hook / 离线 capture 采样目标。

### 2026-07-08：阶段 5-8BI 召唤目标 item skill 与二级 DamageElement 确认

本轮完成：

- 新增 `summonTargetSkillEvidence`，专门记录 `TSummonElementParams.summonUnitId -> battlefield_item -> item skill -> compact bundle preload -> TDamageElementParams` 的二级静态链路。
- `10100304 / 101003180` 的 `summonUnitId = 480059` 已匹配 `battlefield_item.id = 480059`，其 `skillList = 1#48005901`，`skillBytesPath = Config/Battle/Skill/Item/480059.asset,Config/Battle/SkillPreload/Item/480059.asset`。
- `48005901` 的 skill 表行存在，`parentSkill = 10100301`、`skillModuleTag = 2`；Extractor 中 `skill_control_48005901.asset` 存在但 13 个 MonoBehaviour JSON 全部为 `stubOnly`。
- 直接通过 compact bundle preload 解析 `48005901`，确认其外部 Element 对象为 `101003156 / TDamageElementParams` 与 `101003182 / TDamageElementParams`，两者均带 HP、削韧、充能候选字段。
- `48005901` 的 `skillsub_ele_value` 有 2 个 element 的 12 级倍率行：`101003156` 的 A 槽 `3500 -> 7350`，`101003182` 的 A 槽 `1500 -> 3150`，G 槽均为 `10000`。
- `10100305 / 101003181` 的 `summonUnitId = 480060` 已匹配 `battlefield_item.id = 480060`，其 `skillList = 1#48006001`，`skillBytesPath = Config/Battle/Skill/Item/480060.asset,Config/Battle/SkillPreload/Item/480060.asset`。
- `48006001` 的 skill 表行存在，`parentSkill = 10100301`、`skillModuleTag = 2`；Extractor 中 `skill_control_48006001.asset` 存在但 13 个 MonoBehaviour JSON 全部为 `stubOnly`。
- 直接通过 compact bundle preload 解析 `48006001`，确认其外部 Element 对象为 `101003157 / TDamageElementParams` 与 `101003179 / TDamageElementParams`，两者均带 HP、削韧、充能候选字段。
- `48006001` 的 `skillsub_ele_value` 有 2 个 element 的 12 级倍率行：`101003157` 的 A 槽 `5000 -> 10500`，`101003179` 的 A 槽 `3000 -> 6300`，G 槽均为 `10000`。
- `summonTargetSkillEvidence.damageElementFieldMappingEvidence` 已对 2 个目标 skill、4 个 `TDamageElementParams` 建立三值字段映射和 formula function 证据：`function_1 = 1`、`function_2 = 2` 均能命中 `element_formula`，但仍为 `applied: false`。
- `normalAttackHitChainCandidate.hitGroups[].externalElementObjectReferences[]` 的召唤对象现在带轻量 `summonTargetSkillEvidence`，可在第 4/5 段看到目标 skill 与二级 DamageElement 列表。

当前边界：

- 第 4/5 段已经从“召唤目标 DamageElement 未找到”推进为“召唤目标二级 DamageElement 静态闭合”。
- `skill_control_48005901/48006001` 的落盘 JSON 是 `stubOnly`，所以行为轨、触发帧、命中次数、hit 分组和动画状态仍不能从落盘 JSON 直接确认。
- `summonLifeTime = 2500`、`battlefield_item.param = Delay#4` 和目标 DamageElement 的关系尚未确认；不能把 Delay 或 lifespan 直接当成触发帧。
- `101003181 -> 101003079 / 焰火` 的 buff 触发语义仍未闭合到 runtime 条件；`48006001` 二级 DamageElement 说明目标伤害对象存在，但不证明焰火爆炸触发条件和触发时机。
- 四个二级 DamageElement 的 HP、削韧、充能字段仍是候选来源，不应用最终公式。

验收结果：

- `npm run data:generate`：通过，重新生成 `src/data/generated`。
- `npm test -- --run src/__tests__/data/azprGenerated.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、21 条测试。
- `python -m py_compile scripts/resolve-azpr-element-objects.py`：通过。
- `npm run test -- --run`：通过，13 个测试文件、106 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BJ 目标：把 `summonTargetSkillEvidence` 接入 per-hit 候选详情和 Workbench 展示，让第 4/5 段能显示二级 DamageElement 的 HP / 韧性 / 能量候选，但继续标记为“触发帧未确认、公式未应用”。
- 继续追 `skill_control_48005901/48006001` 的 stub 产生原因，必要时从 compact bundle typetree、Yoo index 或运行时 capture 补触发帧、命中次数和 target ownership。
- 继续追 `101003079 / 焰火` buff runtime，确认它是否只负责触发 `48006001`，还是另有 buff 条件、二次注入或伤害过滤。

### 2026-07-08：阶段 5-8BJ 召唤目标候选接入 Workbench

本轮完成：

- `src/simulation/projection/projectSimulationResult.js` 新增 `summonTargetSkillEvidence` 运行时索引，把 `normalAttackHitChainCandidate.hitGroups[].externalElementObjectReferences[].summonTargetSkillEvidence` 展开为 per-hit 的 nested `TDamageElementParams` 候选。
- 寒悠悠普攻第 4 段现在在模拟结果中显示为 `hitIndex = 4`、`hitSkillId = 10100304`、`summonUnitId = 480059`、`targetSkillId = 48005901`，并带二级 DamageElement `101003156 / 101003182`。
- 寒悠悠普攻第 5 段现在在模拟结果中显示为 `hitIndex = 5`、`hitSkillId = 10100305`、`summonUnitId = 480060`、`targetSkillId = 48006001`，并带二级 DamageElement `101003157 / 101003179`。
- `hitCandidateSummary` 新增召唤目标摘要：寒悠悠当前为 `hitCandidateCount = 4`、`mappedHitCandidateCount = 4`、`damageElementFieldMappingCount = 6`、`summonTargetMappedHitCandidateCount = 2`、`summonTargetDamageElementFieldMappingCount = 4`。
- 二级召唤目标候选进入 `candidateValueSeries`：寒悠悠当前 4 个 hit candidate 形成 3 条候选曲线、12 个曲线点；第 4/5 段的 HP / 削韧 / 充能候选来自目标 item skill 的 DamageElement。
- `TimelineGridPreview` 的选中帧详情和 element 对比表已经能显示 `召唤目标480059->48005901` / `召唤目标480060->48006001`，并在状态中标记 `召唤触发待确认`。
- `AnalysisPanel` 的逐 hit 摘要已经显示 `召唤目标 2/4段/4元素 · 触发未确认`。
- `uniqueStrings()` 已修正，不再把 `undefined` 字面量写入汇总状态。

当前边界：

- 第 4/5 段的二级 DamageElement 已经进入 per-hit 候选和 Workbench 展示，但仍是 `applied: false`。
- 当前曲线点使用来源 hitGroup 的候选帧定位；召唤目标 item skill 自身的真实触发帧、命中次数、owner/target 归属和 runtime 条件仍未确认。
- `skill_control_48005901/48006001` 仍是 `stubOnly`，所以 Workbench 只能展示“二级候选存在”，不能把它当成最终爆炸时机或最终公式。
- `battlefield_item.param = Delay#4` 继续只作为字段展示，不解释为帧、秒或命中延迟。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、47 条测试。
- `npm run data:generate`：通过，生成数量稳定。
- `npm run test -- --run`：通过，13 个测试文件、108 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BK 目标：追 `skill_control_48005901/48006001` 为何只导出 `stubOnly`，优先检查 compact bundle typetree、Yoo index、Extractor stub 保护规则和可安全读取的替代导出路径。
- 若静态导出仍不能打开目标 item skill 行为轨，则把 `10100304/10100305` 的召唤触发和 `101003079 / 焰火` runtime 条件加入真实 hook / capture 采样目标。
- Workbench 侧后续可把召唤目标候选加过滤/徽标，但在触发帧确认前不要把二级 DamageElement 合并进最终 HP / 韧性 / 能量结果。

### 2026-07-08：阶段 5-8BK 召唤目标 item skill_control 重导与触发候选帧

本轮完成：

- 确认 `skill_control_48005901/48006001` 的旧缺口不是寒悠悠个例：现有 Extractor 目录里 89 个 `4800*` item `skill_control` 曾全部是 `stubOnly`，reason 均为旧批次为规避 UnityPy typetree 风险而主动不读。
- 使用 AzPr Extractor 对 `skill_control_48005901/48006001` 做聚焦 manifest-sliced dry-run：2 个逻辑切片、26 个 MonoBehaviour 可读、错误数 0；随后执行真实重导并覆盖目标导出。
- 清理两个目标 `MonoBehaviour` 目录中旧的 `stubOnly` JSON 共 24 个；当前 `48005901` 与 `48006001` 均为 13 个真实 JSON、0 stub。
- `48005901` 当前可确认：6 条 `behaviorlineControl`、13 个行为节点、4 个 `elementBaseDatas` 外部引用，候选起始帧 `0 / 1 / 4 / 25 / 34 / 43f`，frameRange `0-112f`。
- `48006001` 当前可确认：6 条 `behaviorlineControl`、13 个行为节点、4 个 `elementBaseDatas` 外部引用，候选起始帧 `0 / 1 / 5 / 20 / 29 / 38f`，frameRange `0-105f`。
- `scripts/generate-azpr-data.mjs` 的 `summonTargetSkillEvidence.targetSkills[].skillControlDirectory` 新增真实行为轨摘要：`parsedReadableJsonFiles`、`timelineControlSampleCount`、`behaviorNodeSampleCount`、`frameCandidateSampleCount`、`startFrameCandidates`、`triggerFrameCandidateSummary`、`behaviorReferenceSummary`、`hpBehaviorChainCount`。
- `src/simulation/projection/projectSimulationResult.js` 已把目标 item skill 的候选帧透传到 `summonTargetEvidenceSummary`、`hitCandidateSummary` 和每个召唤目标 candidate 的 `summonTarget` 明细。
- Workbench 现在把寒悠悠召唤目标摘要从 `触发未确认` 升级为 `触发候选 0f/1f/4f/5f/20f/25f/29f/34f`，选中第 4 段时可看到 `触发候选帧 0/1/4/25/34/43`。

当前边界：

- 这些帧仍是 item skill_control 内部行为轨候选，不等于第 4/5 段召唤在战斗时间轴上的最终触发帧。
- `hitCountStatus` 仍为 `summon-target-hit-count-unconfirmed`，`runtimeOwnershipStatus` 仍为 `summon-target-runtime-ownership-unconfirmed`。
- `battlefield_item.param = Delay#4` 仍未解释为最终帧延迟、秒延迟或 runtime 调度参数。
- `101003079 / 焰火` buff 已有静态引用桥，但还没有确认它与 `48006001` 的运行时触发条件、触发次数或伤害过滤关系。

验收结果：

- AzPr Extractor dry-run：`outputs/unity-manifest-sliced-skill-control-480059-480060-real-monobehaviour-dryrun.json`，2 个切片、26 个 MonoBehaviour、0 错误。
- AzPr Extractor 真实重导：`outputs/unity-manifest-sliced-skill-control-480059-480060-real-monobehaviour.json`，2 个切片、26 个 MonoBehaviour、0 错误。
- `npm run data:generate`：通过，生成数量稳定。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、47 条测试。
- `npm run test -- --run`：通过，13 个测试文件、108 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BL 目标调整为框架优先：不在当前阶段继续收敛 `48005901/48006001` 的最终触发帧、命中次数或 `Delay#4` 解释。
- 先把 HP / 韧性 / 能量三值变化的状态流、候选曲线、占位曲线和未来 runtime sample 输入契约搭稳；触发帧假设矩阵后移到框架稳定后的 evidence 补充阶段。

### 2026-07-08：阶段 5-8BL 三值曲线框架优先调整

本轮完成：

- 接受阶段方向调整：当前不要求先搞清楚每个角色、每个技能在每一帧的具体动作；细帧、命中次数、owner/target 归属和 buff runtime 条件先作为后续 evidence 层补充。
- `src/simulation/projection/projectSimulationResult.js` 新增 `threeValueCurveFramework` 顶层摘要，固定三条轨道：`enemyHpDamage`、`enemyToughnessDamage`、`selfEnergyChange`。
- `threeValueCurveFramework.timebase` 固定 `60fps / one-frame`，但 `computationContract.unresolvedTimingPolicy` 明确候选帧、来源帧、显示帧分离，避免把候选细帧提前当最终结论。
- `threeValueCurveFramework.tracks[]` 记录每条轨道的 result slot、候选 series、chart point 数、结果状态和公式状态；当前默认末音样本为 3 轨、15 个候选/图表点，寒悠悠样本为 3 轨、12 个候选/图表点。
- `summary.threeValueCurveFrameworkSummary` 接入 Workbench 分析面板，显示 `三值框架 3轨 · 曲线 3条/{n}点 · 细节后补`。
- 现有 `candidateValueSeries`、召唤目标候选帧、per-element 详情和公式矩阵保留，但在当前阶段都作为框架输入或 evidence，不驱动最终数值。

当前边界：

- `threeValueCurveFramework` 是框架契约和状态摘要，不是最终 HP / 韧性 / 能量公式。
- HP 当前仍是 raw projection；削韧仍是字段候选；充能已有 RecoverSP 探针和手动 fixture，但真实 runtime sample 仍未导入。
- 召唤目标 item skill 的候选帧继续保留在 evidence 中，但不再作为当前阶段主线。
- 当前曲线仍偏“候选点展示”，尚未形成统一的 delta / cumulative 状态积分曲线。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、47 条测试。
- `npm run test -- --run`：通过，13 个测试文件、108 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BM 目标：新增三值曲线状态积分/累计曲线框架，把 `actionResultTimeline` 的已应用值、`candidateValueSeries` 的候选点、占位点和未来 `runtimeSampleCaptures` 统一投影为 HP / 韧性 / 能量的 delta 与 cumulative 曲线。
- 明确曲线层级：`applied` 层用于当前可计入结果的值，`candidate` 层用于字段/公式候选，`sampled` 层用于真实采样导入，`placeholder` 层用于尚未填数值的动作骨架。
- 继续保持细帧假设、`Delay#4` 解释和 `焰火` buff runtime 条件为后续 evidence 任务，不阻塞框架建设。

### 2026-07-08：阶段 5-8BM 三值 delta / cumulative 状态曲线

本轮完成：

- `threeValueCurveFramework` 新增 `stateCurves` 子结构，把 HP / 韧性 / 自身能量三条轨道统一拆成 `applied`、`candidate`、`sampled`、`placeholder` 四层。
- 每层曲线点都带 `delta` 与 `cumulative`，并按 60fps 帧排序累加；不同层之间不混算，候选累计值只用于诊断。
- `applied` 层读取 `actionResultTimeline[].hpDamage/toughnessDamage/selfEnergyChange` 中已经 `applied = true` 的结果值；当前默认末音样本有 1 个 applied HP 点，累计 `12,461`。
- `candidate` 层读取 `candidateValueSeries.chart.series[].points[]`；当前默认末音样本有 15 个 candidate state 点，寒悠悠样本有 12 个 candidate state 点。
- `sampled` 层先保留 runtime sample 映射入口；存在 `runtimeSampleCaptures` 但尚未映射到曲线时会显示 mapping pending。
- `placeholder` 层为没有 applied/candidate/sampled 点的动作保留 0 delta 占位，方便后续先搭动作骨架再填真实数值。
- `summary.threeValueCurveFrameworkSummary` 已扩展 state 点数，Workbench 显示 `三值框架 3轨 · 曲线 3条/15点 · 状态 16点 · 细节后补`。

当前边界：

- `stateCurves` 是曲线状态框架，不表示最终公式已经确认。
- `candidate` 层的 HP 参数、削韧字段、能量字段仍是 raw candidate，不能与 applied 层相加。
- `sampled` 层目前只定义入口，尚未把真实 runtime sample 自动转换为曲线点。
- 主时间轴仍显示原 `candidateValueSeries.chart`；`stateCurves` 暂时只在模拟结果和分析摘要中体现。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、47 条测试。
- `npm run test -- --run`：通过，13 个测试文件、108 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BN 目标：把 `threeValueCurveFramework.stateCurves` 接入 Workbench 更明确的展示/过滤层，例如状态曲线摘要、层级开关或按轨道查看 applied/candidate/sample/placeholder 点数。
- 优先保持 UI 信息密度接近 Endaxis，不新增解释型大段文字；用短标签和 tooltip 标明 `applied` / `candidate` / `sampled` / `placeholder`。
- 继续不阻塞在具体技能细帧上；细帧、召唤触发和 buff 条件仍作为后续 evidence 填充。

### 2026-07-08：阶段 5-8BN stateCurves Workbench 层级展示与过滤

本轮完成：

- `Workbench.vue` 已把完整 `simulationResult.threeValueCurveFramework` 传入 `AnalysisPanel`。
- `AnalysisPanel` 新增“状态曲线”区块，读取 `threeValueCurveFramework.stateCurves.tracks[]`。
- 新增四个层级复选框：`已用 / 候选 / 采样 / 占位`，默认显示 `applied + candidate`，隐藏尚未有点的 `sampled + placeholder`。
- 每条三值轨道显示当前可见层数、点数和单位；层级 chip 显示 `点数 / Δ范围 / Σ累计值`。
- 默认末音样本可见 `16` 个状态点：HP applied 1 点、HP/韧性/能量 candidate 共 15 点；关闭候选层后只剩 applied HP 1 点。
- 寒悠悠样本可见 `13` 个状态点，并显示 HP candidate 累计 `44,300`。

当前边界：

- 该区块只展示 state curve 层级和累计，不替代主时间轴 candidate marker。
- `sampled` 与 `placeholder` 层默认隐藏，且当前没有真实 sample 映射点。
- `candidate` 层仍不能进入最终 totals；UI 只展示诊断累计。
- 仍不在当前阶段追逐每个技能的最终触发帧或 buff 条件。

验收结果：

- `npm test -- --run src/__tests__/views/Workbench.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、47 条测试。
- `npm run test -- --run`：通过，13 个测试文件、108 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BO 目标：把 `sampled` / `placeholder` 层推进到更真实的输入和表现。
- 优先处理两条线：其一，让导入的 runtime sample 能形成 `sampled` state curve 点；其二，让没有候选数值的动作也能在 Workbench 中以占位层保持曲线骨架。
- 继续保持三值框架优先，不把 `Delay#4`、召唤触发帧或 `焰火` buff 条件作为当前阻塞项。

### 2026-07-08：阶段 5-8BO RecoverSP sampled 与 placeholder state curve

本轮完成：

- `projectSimulationResult()` 已把 `runtimeSampleContext` 传入 `threeValueCurveFramework.stateCurves` 构造层。
- `selfEnergyChange` 的 `sampled` 层现在会消费 `runtimeSampleCaptures` 中的 `recover-sp-applied` 事件，生成真实采样 state point。
- RecoverSP 手动 fixture 导入时，`selfEnergyChange.sampled` 会出现 1 个 sampled 点：`frameIndex = 12`、`delta = 0.3375`、`cumulative = 0.3375`、`sourceElementConfigId = 109001081`。
- `summary.threeValueCurveFrameworkSummary` 新增 `sampledStatePointCount`，便于顶层识别真实采样点。
- 手动资源/敌人事件等非伤害动作已验证会进入 placeholder 层：示例项目中 `placeholderPointCount = 5`，HP placeholder 覆盖 `action-resource / action-enemy`。

当前边界：

- sampled 层当前只映射 RecoverSP 的 `recover-sp-applied` 事件，也就是自身能量曲线；HP / 韧性 runtime sample 仍未接入。
- sample 点仍为诊断层，不改写 `selfEnergyChange.value` 或最终 totals。
- placeholder 层用于保持动作骨架，不代表实际 0 值机制已经确认。
- Workbench 默认仍隐藏 sampled / placeholder 层；需要后续在 UI 里更自然地提示有采样或占位点。

验收结果：

- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、47 条测试。
- `npm run test -- --run`：通过，13 个测试文件、108 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。
- `git diff --check`：通过；仅有 Windows 行尾转换提示。

下一步：

- 阶段 5-8BP 目标：让 Workbench 对 sampled / placeholder 层有更明确的表现。
- 有 sampled 点时，状态曲线层级控制应能提示采样点存在；有 placeholder 点时，应能快速看出哪些动作只是曲线骨架。
- 继续保持 HP / 韧性最终公式和具体技能细帧为后续 evidence 任务，不阻塞曲线框架建设。

### 2026-07-08：阶段 5-8BP sampled / placeholder 层级计数与空层过滤

本轮完成：

- `AnalysisPanel` 的状态曲线层级控件改为读取汇总后的 `stateCurveLayerOptions`，按钮文案显示各层点数，例如默认末音样本为 `已用 1 / 候选 15 / 采样 0 / 占位 0`。
- 状态曲线入口改为按 `stateCurves.summary.pointCount` 显示；即使默认启用的 applied / candidate 层没有点，只要 sampled / placeholder 有点，用户也能看到开关并展开。
- 状态曲线列表现在过滤空层，只展示当前启用且 `pointCount > 0` 的层，避免采样/占位打开后被大量 `0点` 噪声淹没。
- 状态曲线数值格式新增小数保留：非整数能量采样会保留最多 4 位小数，例如 `0.3375`，不再被四舍五入成 `0`。
- 新增组件级 fixture 覆盖“只有 sampled / placeholder 点、没有 applied / candidate 点”的场景，确认采样和占位层都可发现、可展开。

当前边界：

- 本阶段不新增 `stateCurves` 数据字段，只改变 Workbench 消费和展示规则。
- sampled / placeholder 仍是诊断/骨架层，不代表 HP / 韧性 / 能量的最终公式已经确认。
- 状态曲线点还没有接入主时间轴 marker 或逐点详情弹层，用户当前只能在分析面板按轨道查看层摘要。

验收结果：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、48 条测试。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；保留既有 Sass `@import` 弃用提醒与 chunk 体积提醒。

下一步：

- 阶段 5-8BQ 目标：把状态曲线点变得更可操作。
- 优先考虑在 Workbench 里增加按层/轨道的点级下钻，或把 sampled / placeholder 点以轻量提示接入时间轴，让用户知道某个动作为什么只是一段骨架或真实采样。
- 继续避免在当前阶段追逐每个技能的最终逐帧动作，把精确帧、命中次数、owner/target 和 buff 条件留给后续 evidence 填充。

### 2026-07-08：阶段 5-8BQ 状态曲线点级下钻

本轮完成：

- `AnalysisPanel` 在每条状态曲线轨道下新增点级明细列表，按当前启用层汇总 `layer.points[]` 并按帧/时间排序。
- 每个点显示：帧标签、层级、`Δ`、`Σ`、动作、hit、element、event、SP 前后值、`sourceKind`。
- 已用 / 候选 / 采样 / 占位四层共用同一套点级展示，不新增模拟结果字段。
- 状态曲线数字格式改为“整数千分位、非整数最多 4 位小数”，避免 `spAfter = 10.3375` 被显示为 `10`。
- 默认末音样例中，HP 轨道可看到 1 个 applied 点和 5 个 candidate 点；fixture 中可看到 RecoverSP sampled 点和 placeholder 点的来源明细。

当前边界：

- 下钻仍只在分析面板内显示，主时间轴还没有对应 marker。
- sampled / placeholder 点仍是 evidence / 骨架层，不参与最终 totals。
- 这个阶段没有追逐技能最终帧、命中次数、owner/target 归属或 buff runtime 条件。

验收结果：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、48 条测试。

下一步：

- 阶段 5-8BR 目标：把状态曲线点以轻量 marker 或提示接入主时间轴。
- 优先让 sampled / placeholder 点在时间轴上可被发现，并与分析面板的点级明细互相对应。
- 继续保持框架优先，不把未确认的逐帧技能细节当作阻塞项。

### 2026-07-08：阶段 5-8BR 状态点时间轴 marker

本轮完成：

- `Workbench` 已把 `simulationResult.threeValueCurveFramework` 传给 `TimelineGridPreview`。
- `TimelineGridPreview` 新增 `stateCurveMarkers` lane 数据，读取 `threeValueCurveFramework.stateCurves.tracks[].layers[].points[]`。
- 主时间轴现在渲染 `applied / sampled / placeholder` 三层 state point 的轻量 marker；`candidate` 层继续由原“候选三值”曲线和 marker 负责，避免重复铺点。
- marker tooltip 显示状态点摘要：轨道、层级、帧、`Δ`、`Σ`、动作、hit、element、event、SP 前后值和 `sourceKind`。
- 时间轴图例新增“状态点”。
- 默认末音样例会在 actor-109001 lane 上显示 applied HP 状态点；加入资源/敌人事件后，placeholder 状态点会出现在对应动作的时间轴位置。

当前边界：

- marker 目前只是轻量提示和 tooltip，没有点击选中、筛选或与分析面板点级明细联动。
- 本阶段不渲染 `candidate` state point marker，因为候选层已经由候选曲线覆盖。
- 仍不追逐每个技能的最终逐帧动作、命中次数、归属或 buff 条件。

验收结果：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、48 条测试。

下一步：

- 阶段 5-8BS 目标：补状态点 marker 的筛选或选中联动。
- 优先让时间轴 marker 与分析面板中的点级明细能互相定位，或提供按 state layer / track 的显示控制。
- 保持三值曲线框架优先，具体数值机制仍按采样和公式证据逐步替换。

### 2026-07-08：阶段 5-8BS 状态点 marker / 明细选中联动

本轮完成：

- 新增 `stateCurvePointIdentity.js`，用 `trackKey / layerKey / actionId或eventType / frameIndex或timeMs / sequenceIndex或eventIndex或hitIndex` 生成共享 `stateCurvePointId`。
- `TimelineGridPreview` 的状态点 marker 现在带 `data-state-point-id`，可点击或键盘选中，并把选中 ID 回传给 `Workbench`。
- `AnalysisPanel` 的状态曲线点明细同样带 `data-state-point-id`，可点击或键盘选中。
- `Workbench` 新增 `selectedStateCurvePointId` 状态，统一传给时间轴和分析面板。
- 选中时间轴 applied 状态点后，对应分析面板明细同步高亮；从分析面板选中候选点后，时间轴 marker 会取消 applied 高亮，说明联动 ID 已切换。

当前边界：

- 本阶段只做选中联动，不新增 layer / track 筛选控件。
- 候选层 state point 仍不渲染为时间轴状态 marker；候选点可在分析面板中选中，但不会对应到状态 marker。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构。

验收结果：

- `npm test -- --run src\__tests__\views\Workbench.test.js src\__tests__\simulation\firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、48 条测试。

下一步：

- 阶段 5-8BT 目标：补状态点 layer / track 筛选，或提供只看 selected state point 的焦点模式。
- 优先让用户在时间轴上快速切换“只看采样 / 只看占位 / 只看已用”，避免状态点增多后视觉过载。
- 继续保持框架优先，具体技能逐帧与最终公式仍后补。

### 2026-07-08：阶段 5-8BT 状态点 layer 共享过滤

本轮完成：

- `Workbench` 新增共享 `stateCurveLayerFilters`，默认保持 `applied / candidate` 开启、`sampled / placeholder` 关闭。
- `AnalysisPanel` 的状态曲线 layer 开关改为受控输入，通过 `update-state-curve-layer-filter` 回传变更，不再在组件内部单独保存过滤状态。
- `TimelineGridPreview` 新增状态点 layer 开关，只列出当前时间轴会渲染的 `applied / sampled / placeholder` 层，并按同一套共享过滤条件渲染 marker。
- 时间轴关闭“已用”后，applied 状态点 marker 会消失，分析面板同步取消 applied 层；从分析面板重新打开后，时间轴 marker 同步恢复。
- 资源动作和敌人事件产生的 `placeholder` 状态点默认仍隐藏，用户显式打开“占位”层后才在时间轴显示，避免后续状态点过多时视觉拥挤。

当前边界：

- 本阶段只做 layer 过滤，不做 track 过滤，也不做 selected-only 焦点模式。
- `candidate` 状态点仍由分析面板明细和候选三值曲线承担，时间轴不重复渲染 candidate state marker。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构，也没有把 sampled / placeholder 推进为最终公式。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8BU 目标：补状态点 track 筛选或 selected-only 焦点模式。
- 优先让用户按“敌人HP伤害 / 敌人韧性削减 / 自身能量变化”筛选状态点，或在点明细选中后只聚焦当前 state point。
- 继续保持框架优先，具体技能逐帧、召唤触发和最终公式仍按后续采样证据逐步补齐。

### 2026-07-08：阶段 5-8BU 状态点 track 共享过滤

本轮完成：

- `Workbench` 新增共享 `stateCurveTrackFilters`，默认采用“未显式关闭即显示”的策略，避免新轨道出现时被误隐藏。
- `AnalysisPanel` 的状态曲线区块新增轨道开关，可按“敌人HP伤害 / 敌人韧性削减 / 自身能量变化”过滤状态点明细和层级摘要。
- `TimelineGridPreview` 新增状态点轨道开关，只列出当前时间轴会渲染 marker 的轨道，并按同一套共享 `stateCurveTrackFilters` 过滤 marker。
- 从分析面板关闭“敌人HP伤害”后，HP 状态曲线行隐藏、可见状态点数从 16 降为 10，时间轴 applied HP marker 同步消失；从时间轴重新打开后，分析面板和 marker 同步恢复。

当前边界：

- 本阶段只做 track 过滤，不做 selected-only 焦点模式。
- 时间轴轨道开关只统计 `applied / sampled / placeholder` marker 层；`candidate` 仍由候选三值曲线和分析面板明细负责。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构，也没有新增保存到项目文件的 schema 字段。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8BV 目标：补 selected-only 焦点模式或状态点导航。
- 优先让用户点击一个 state point 后，可以快速只看当前点、跳回全部点，或在同一帧/同一动作附近切换 HP / 韧性 / 能量点。
- 继续保持框架优先，后续再接入真实采样和最终公式细化。

### 2026-07-08：阶段 5-8BV 状态点 selected-only 焦点模式

本轮完成：

- `Workbench` 新增共享 `stateCurveFocusMode`，默认 `all`，可切换到 `selected`。
- `AnalysisPanel` 的状态曲线标题新增“全部 / 选中”分段按钮；未选中 state point 时“选中”不可用。
- 进入“选中”模式后，状态曲线明细只保留当前 `selectedStateCurvePointId` 对应的点，顶部可见点数和轨道摘要同步收窄。
- `TimelineGridPreview` 同样消费 `stateCurveFocusMode`，只渲染当前选中 state point 对应的时间轴 marker。
- 选中默认末音 applied HP marker 后切到“选中”，状态曲线可见点数从 16 降为 1；切回“全部”后恢复 16 点。

当前边界：

- 本阶段只做 selected-only 焦点模式，不做上一点 / 下一点导航。
- 候选层 state point 仍不渲染为时间轴状态 marker；若聚焦候选点，分析面板能只显示该候选点，但时间轴不会额外生成 candidate marker。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构，也没有新增项目保存 schema 字段。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8BW 目标：补状态点邻近导航或同帧三值点切换。
- 优先让用户在同一帧/同一动作附近快速切换 HP / 韧性 / 能量状态点，并保留当前 layer / track / focus 过滤语义。
- 继续保持框架优先，真实公式和技能逐帧细节后续再补。

### 2026-07-08：阶段 5-8BW 状态点邻近导航

本轮完成：

- `AnalysisPanel` 在状态曲线标题新增上一点 / 下一点导航按钮和当前位置计数。
- 导航序列基于当前 `stateCurveLayerFilters` 与 `stateCurveTrackFilters` 后的完整状态点列表，而不是基于 selected-only 焦点后的 1 点列表。
- 状态点排序按帧、时间、轨道、层级和 hit/event 顺序稳定排列，为后续同帧 HP / 韧性 / 能量切换打基础。
- 在 selected-only 模式下点击“下一点”会切换 `selectedStateCurvePointId`，分析面板继续只显示新选中点。
- 从默认 applied HP 点跳到下一个 candidate HP 点后，分析面板聚焦 candidate 点；时间轴状态 marker 变为 0，符合“candidate 仍由候选三值曲线负责，不生成 state marker”的边界。

当前边界：

- 本阶段只做线性上一点 / 下一点导航，不做同帧分组按钮或轨道优先跳转。
- 导航遵守当前 layer / track 过滤；若过滤条件把选中点排除，导航会按当前可见序列禁用。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构，也没有新增项目保存 schema 字段。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8BX 目标：补同帧三值点切换或状态点分组导航。
- 优先在同一帧/同一动作存在多个 HP / 韧性 / 能量点时提供分组跳转，减少用户在长序列里线性翻找。
- 继续保持框架优先，真实采样和最终公式细化后续再接。

### 2026-07-08：阶段 5-8BX 同帧三值点分组切换

本轮完成：

- `AnalysisPanel` 为状态点派生 `frameGroupKey`，按同一动作、同一帧、同一 hit/event 聚合同组点。
- 状态曲线标题新增同帧分组按钮；当前选中点所在组超过 1 个点时显示。
- 分组按钮显示 `HP / 韧性 / 能量`、layer 与 `Δ` 值，可直接切换到同帧的其他三值点。
- 在 selected-only 模式下，从第一条 candidate HP 点可直接切到同帧 candidate 韧性点，再切回 candidate HP 点，保留当前 focus/layer/track 语义。
- 点行新增 `data-track-key`，便于测试和后续调试定位当前选中点所属轨道。

当前边界：

- 分组只基于当前 layer / track 过滤后的导航序列，不会显示已被过滤隐藏的轨道或层。
- 当前只做同组按钮，不做跨帧分组列表、键盘快捷键或候选曲线热点反向联动。
- candidate 点仍不生成时间轴 state marker；同帧分组切到 candidate 韧性/能量时，时间轴状态 marker 仍为空。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构，也没有新增项目保存 schema 字段。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8BY 目标：把状态点导航与候选三值曲线帧热点联动。
- 优先让用户从候选三值曲线帧热点反向定位到同帧 state point 分组，减少分析面板和时间轴之间的认知跳转。
- 继续保持框架优先，真实采样和最终公式细化后续再接。

### 2026-07-08：阶段 5-8BY 候选帧热点联动状态点

本轮完成：

- `createStateCurveFrameGroupKey()` 从 `AnalysisPanel` 内部函数抽到 `stateCurvePointIdentity.js`，让分析面板和时间轴共享同一套同帧分组语义。
- `TimelineGridPreview` 的 candidate frame group 保留 `displayFrameIndex / sourceFrameIndex`，用于精确匹配 candidate state point。
- 点击候选三值曲线 frame hotspot 或 candidate marker 时，除了原有候选帧摘要，也会尝试匹配当前 layer / track 过滤下的同帧 candidate state point。
- 匹配成功后回传 `select-state-curve-point`，分析面板状态点导航位置同步跳到该 candidate 点，并激活同帧 HP / 韧性 / 能量分组按钮。
- 默认末音样例点击 hit1 候选帧热点后，状态点导航位置变为 `2/16`，选中第一条 candidate HP state point。

当前边界：

- 联动只选择 candidate state point，不把 candidate 点渲染为时间轴 state marker。
- 如果用户关闭 candidate layer 或对应 track，热点仍显示候选曲线摘要，但不会强行选择被过滤隐藏的 state point。
- 没有改变 `threeValueCurveFramework.stateCurves` 模拟结果结构，也没有新增项目保存 schema 字段。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8BZ 目标：补候选三值曲线 selected-frame scope 与状态点焦点模式联动。
- 优先让用户从候选帧热点进入“只看该帧/该组”的联动查看，减少在全部点与候选帧摘要之间来回切换。
- 继续保持框架优先，真实采样和最终公式细化后续再接。

### 2026-07-08：阶段 5-8BZ 候选选中帧与状态点焦点联动

本轮完成：

- `TimelineGridPreview` 新增候选范围与状态点焦点同步：当 `stateCurveFocusMode = selected` 且当前状态点属于 `candidate` 层时，候选三值曲线自动切到 `selected-frame`，只保留同帧 HP / 韧性 / 能量三条候选点。
- 状态点焦点切回 `all` 或选中非 candidate 状态点时，候选三值曲线自动回到 `全部`，避免沿用旧候选帧造成误读。
- 候选三值曲线的 `选中帧` 按钮现在会先定位同帧 candidate state point，再回传 `update-state-curve-focus-mode = selected`，让右侧分析面板同步进入只看选中。
- 候选三值曲线的 `全部` 按钮会同步把状态点焦点切回 `all`。
- Workbench 已接通 `TimelineGridPreview -> update-state-curve-focus-mode -> Workbench -> AnalysisPanel` 的事件链。
- 测试覆盖从状态点邻近导航进入 candidate 点时，候选 marker 从 15 个收束到同帧 3 个；也覆盖从候选 `选中帧/全部` 切换时，分析面板状态点数量在 `1 / 16` 之间同步变化。

当前边界：

- 联动只基于当前可见 series / actor / action / state layer / state track 过滤结果，不强行显示用户主动隐藏的候选或状态点。
- 仍不把 candidate state point 渲染为时间轴 state marker；候选层继续由候选曲线、marker、frame hotspot 和详情摘要承担。
- 没有改变 `threeValueCurveFramework.stateCurves`、`candidateValueSeries.chart` 或项目保存 schema。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过，2 个测试文件、36 条测试。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8CA 目标调整为生成层 / 运行时层 / UI 层收束，不再继续沿候选帧详情微交互深挖。
- 优先把现有 evidence、candidateValueSeries、stateCurves 和 runtime sample 折叠成标准生成层输入合同，例如 `Action -> Hit -> ThreeValueDelta`，包含 frame、track、layer、source、confidence 和可替换数值。
- 运行时层应尽量像 Endaxis 一样只消费标准输入并产出 `simLog`、`stateCurves`、资源曲线和统计摘要；UI 层只负责资源监控、模拟日志、详情弹层和编辑器操作，不继续承担证据考古主线。
- 真实采样、最终公式、平衡倍率和复杂 runtime 条件保留为后续 evidence 填充任务，不阻塞当前工具体验。

### 2026-07-08：阶段 5-8BZ2 候选帧三值轨道焦点高亮

本轮完成：

- `TimelineGridPreview` 新增 `enemyHpDamage / enemyToughnessDamage / selfEnergyChange` 与候选 series 的双向映射，让当前选中的 candidate state point 能反查到候选 HP / 韧性 / 能量 series。
- 候选帧详情行新增 `data-state-track-key` 与 `data-track-focused`，当前状态点属于同帧 HP / 韧性 / 能量中的哪条轨道，对应详情行会同步高亮。
- 同一焦点也同步到候选 marker 和候选曲线 polyline，切换同帧分组中的 HP / 韧性 / 能量按钮时，时间轴上的候选点和曲线线段会跟着切换高亮。
- 当状态点焦点回到非 candidate 点或 `all` 模式时，候选详情行不保留旧焦点，避免误以为仍在查看某条候选轨道。
- 测试覆盖默认末音样例中 HP candidate -> 韧性 candidate -> applied 点的焦点切换，确认详情行、marker 和曲线的 `data-track-focused` 状态同步变化。

当前边界：

- 本阶段只补候选帧详情和时间轴候选层的视觉/测试状态，不改变 `candidateValueSeries.chart`、`threeValueCurveFramework.stateCurves` 或保存 schema。
- candidate element 对比区仍只横向列出 HP 参数、函数、槽位、削韧、能量和状态；列级焦点可在后续 UI 阶段继续补。
- `5-8CA` 标准生成层合同路线保持不变，本阶段只是进入该路线前的 BZ 焦点联动收口。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js src/__tests__/features/TimelineGridPreview.test.js`：通过，2 个测试文件、36 条测试。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。

下一步：

- 阶段 5-8CA 目标：定义并落地标准生成层合同的最小版本，覆盖默认末音样例和寒悠悠样例。
- 优先把现有 evidence、candidateValueSeries、stateCurves 和 runtime sample 折叠成 `Action -> Hit -> ThreeValueDelta` 输入。

### 2026-07-08：阶段 5-8CA 路线收束为生成层 / 运行时层 / UI 层

方向调整：

- 蓝色星原仍在测试阶段，技能数值、平衡倍率和公式细节仍可能调整；当前不再把最终数值考据作为主线阻塞项。
- 已有 evidence / candidate / runtime sample 继续保留，但定位从“用户主线展示”降级为“生成层来源与诊断依据”。
- 下一阶段优先交付稳定的生成层标准合同，让运行时和 UI 可以像 Endaxis 一样消费清晰的命中与三值变化输入。

当前三层目标：

- 生成层：从现有 `candidateValueSeries.chart`、`threeValueCurveFramework.stateCurves`、`actionResultTimeline[].sourceEvidence` 和 `metadata.runtimeSampleCaptures` 生成统一的 action / hit / three-value delta 输入。
- 运行时层：围绕标准输入输出 `simLog`、`stateCurves`、资源曲线、敌人状态曲线和统计摘要，不在运行时里继续追公式证据。
- UI 层：优先补 Endaxis 式资源监控、模拟日志、伤害/三值详情弹层、贡献拆分和编辑器工作流。

下一步：

- 阶段 5-8CA 先定义并落地生成层合同的最小版本，覆盖默认末音样例和寒悠悠样例。
- 阶段 5-8CB 再让运行时投影改为消费该合同，并保持现有 Workbench 可视化不倒退。
- 阶段 5-8CC 起优先补资源监控 / 模拟日志 / 详情弹层，而不是继续扩展证据矩阵。

### 2026-07-08：阶段 5-8CA 标准生成层合同最小版

本轮完成：

- `projectSimulationResult()` 顶层新增 `threeValueGenerationLayer`，作为当前标准生成层合同的最小实现。
- 合同名称固定为 `Action -> Hit -> ThreeValueDelta`，当前从 `threeValueCurveFramework.stateCurves` 的 `applied / candidate / sampled / placeholder` 四层生成，不新增项目保存 schema。
- `threeValueGenerationLayer.deltas[]` 是运行时后续可直接消费的扁平 delta 列表，每个 delta 至少包含 `actionId / hitKey / frameIndex / timeMs / trackKey / layerKey / delta / hpDelta / toughnessDelta / energyDelta / sourceKind / sourceIds / confidence / replaceable`。
- `threeValueGenerationLayer.actions[].hits[].deltas[]` 按动作和命中聚合同一帧的 HP / 韧性 / 能量 delta，服务后续 Endaxis 式运行时和详情面板。
- `summary.threeValueGenerationLayerSummary` 接入 Workbench 分析面板，显示 `生成合同 {动作}/{命中} · Delta {数量} · 候选 {数量} · 已用 {数量}`。

当前验证事实：

- 默认末音样例：1 个动作、6 个命中组、16 个 delta，其中 applied 1、candidate 15；hit1 同帧聚合 HP / 韧性 / 能量 3 条 candidate delta。
- 寒悠悠普攻样例：1 个动作、5 个命中组、13 个 delta，其中 applied 1、candidate 12；召唤目标候选同样进入标准合同。
- RecoverSP 离线样本：标准合同 delta 数变为 17，其中 sampled 1；采样 delta 保留 `captureSessionId`、`elementConfigId`、`energyDelta = 0.3375`。

当前边界：

- 运行时仍未改为消费 `threeValueGenerationLayer`，本阶段只先建立标准输入合同。
- `candidate` 和 `placeholder` delta 仍是可替换输入，不代表最终公式已确认。
- 真实公式、倍率、命中次数、owner/target 归属和 runtime 条件仍作为后续 evidence 填充，不阻塞合同落地。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、48 条测试。

下一步：

- 阶段 5-8CB 目标：让运行时投影优先消费 `threeValueGenerationLayer` 的标准合同，并保持现有 `stateCurves`、候选曲线和 Workbench 展示不倒退。
- 优先把 `simLog`、资源曲线和敌人状态曲线的输入来源改到标准合同，而不是直接分散读取 candidate/state/evidence。

### 2026-07-08：阶段 5-8CB 运行时投影消费标准合同

本轮完成：

- `projectSimulationResult()` 顶层新增 `threeValueRuntimeProjection`，作为当前运行时消费层的最小实现。
- `threeValueRuntimeProjection` 只读取 `threeValueGenerationLayer.deltas[]` 中 `applied = true` 的 delta，暂不把 `candidate / sampled / placeholder` 自动混入运行时结果。
- 运行时投影输出 `enemyStateCurve`、`selfEnergyCurveByActor`、`simLog` 和 `summary`，输入合同固定为 `Action -> Hit -> ThreeValueDelta`。
- `summary.totalRawDamage`、`summary.totalProjectedToughnessDamage`、`summary.totalSelfEnergyDelta` 和 `summary.selfEnergyDeltaByActor` 已改为从 `threeValueRuntimeProjection.summary / selfEnergyCurveByActor` 派生。
- Workbench 分析面板新增 `运行投影 HP ... · 韧性 ... · 能量 ... · 日志 ...` 摘要，确认三值已经进入运行时层，而不仅停留在生成合同。

当前验证事实：

- 默认末音样例：`inputDeltaCount = 16`、`appliedDeltaCount = 1`、`enemyHpDelta = 12461`、`enemyToughnessDelta = 0`、`selfEnergyDelta = 0`、`simLogCount = 1`。
- RecoverSP 离线样本：`sampledDeltaCount = 1` 继续保留在生成层，但运行时投影仍只消费 1 条 applied HP delta，避免采样数据在未确认映射前进入最终汇总。
- 寒悠悠 SP 技能样例：运行时投影同时消费 HP applied delta 和 selfEnergy applied delta，`selfEnergyPointCount = 1`，寒悠悠自身能量变化等于技能 SP 消耗，队友保持 0。
- Workbench 默认切片显示 `运行投影 HP 12,461 · 韧性 0 · 能量 0 · 日志 1`。

当前边界：

- `threeValueRuntimeProjection` 仍是 simulation projection 内部字段，不是项目保存 schema。
- `simLog` 当前是一条 applied delta 一条日志的最小版，还没有 Endaxis 式可筛选日志面板。
- `enemyStateCurve` 和 `selfEnergyCurveByActor` 已可作为 UI 输入，但还没有独立资源监控曲线组件。
- `candidate / sampled / placeholder` 仍保留在生成层，只有后续确认公式或采样映射后才可推进到 applied。

验收结果：

- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CC 目标：围绕 `threeValueRuntimeProjection` 补 UI 层消费入口，优先做 Endaxis 式资源监控 / 模拟日志 / 三值详情弹层的最小骨架。
- 资源监控先消费 `enemyStateCurve` 与 `selfEnergyCurveByActor`，模拟日志先消费 `simLog`，不要重新回头直接读 evidence / candidate。
- 保持公式和逐帧行为细节可后补，当前优先让用户能看见三值如何随动作累积变化。

### 2026-07-08：阶段 5-8CC 运行时资源监控与模拟日志入口

本轮完成：

- `Workbench.vue` 将 `simulationResult.threeValueRuntimeProjection` 传入 `ResourceMonitorPanel` 与 `EventLogPanel`，UI 层开始直接消费标准运行时投影。
- `ResourceMonitorPanel` 新增 `运行投影` 区块，读取 `enemyStateCurve` 展示敌人 HP 伤害与韧性变化，读取 `selfEnergyCurveByActor` 展示每个角色自身 SP 变化和点数。
- `EventLogPanel` 新增 `模拟日志` 区块，读取 `threeValueRuntimeProjection.simLog`，每条 applied delta 渲染为一条可选日志。
- 模拟日志选中后显示最小三值详情：动作、命中键、三值变化和 `sourceDeltaId`，为后续详情弹层保留同一选择入口。
- 旧 `eventLog` 和旧 `resourceTimeline` 展示保留，手动资源事件和原始事件日志没有被移除。

当前验证事实：

- 默认末音样例：资源监控显示敌人 HP 伤害 `12,461`、韧性 `0`、`1 日志`，模拟日志显示 `普通攻击 · HP 12,461`。
- 默认末音样例的模拟日志详情能看到 `action-0001|applied-frame-0-point-0`，确认详情来源来自运行时 applied delta。
- 切换到有 SP 消耗的技能后，运行时资源监控显示 `2 日志`，角色能量行与模拟日志都能显示 `SP -{spCost}`。

当前边界：

- 资源监控仍是数值列表和点数摘要，还没有绘制 Endaxis 式多曲线资源图。
- 模拟日志已可选中并显示内嵌详情，但还不是完整弹层，也没有按 track / actor / action 筛选。
- 详情只显示 applied delta 的最小字段，尚未接贡献拆分、候选来源对比或公式层详情。
- `candidate / sampled / placeholder` 仍不进入运行时 UI 主路径，只保留在分析面板的诊断区。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、35 条测试。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `npm run test -- --run`：通过，13 个测试文件、109 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CD 目标：把模拟日志详情升级为 Endaxis 式三值详情弹层或右侧详情面板，支持按 HP / 韧性 / 能量、actor、action 过滤日志。
- 详情面板优先消费 `threeValueRuntimeProjection.simLog` 和 runtime point 的 `sourceDeltaId / sourceIds`，不要直接回退读取 evidence 矩阵。
- 若本阶段继续 UI，优先补日志筛选和贡献拆分骨架；若回运行时，优先补 applied delta 的 source 字段完整性。

### 2026-07-08：阶段 5-8CD 模拟日志筛选与三值详情面板

本轮完成：

- `EventLogPanel` 的 runtime sim log 新增 HP / 韧性 / 能量 segmented 筛选，显示当前筛选数量和总日志数量。
- `EventLogPanel` 新增 actor 与 action 下拉筛选，筛选项来自 `threeValueRuntimeProjection.simLog` 的当前数据，不写入项目保存 schema。
- 模拟日志详情从选中 `simLog.sourceDeltaId` 回查 `enemyStateCurve.points[]` 与 `selfEnergyCurveByActor[].points[]`，显示动作、命中、轨道、角色、状态和来源 delta。
- 详情区新增 `三值贡献` 骨架，分别展示敌人 HP、敌人韧性、自身能量三个槽位，当前只把 selected applied delta 写入对应槽位。
- 详情区新增 `来源标注` 骨架，展示 `skillIds / elementConfigIds / captureSessionIds / pathIds`，来源来自 runtime point 的 `sourceIds`。
- `createAppliedStateCurveLayer()` 为 applied point 补充 `actionType / targetId / targetName / skillId / elementConfigIds / sourceStatus`，让 runtime point 的 `sourceIds` 至少能追到技能和 element 候选。

当前验证事实：

- 默认末音样例：runtime sim log 过滤计数为 `1/1`，筛选按钮为 `全部1 / HP1 / 韧性0 / 能量0`，默认详情贡献为 `敌人 HP 12,461 / 敌人韧性 0 / 自身能量 0`。
- 默认末音样例：来源标注能显示 `Skill 10900101` 和 `Element 109001081` 等 element 候选。
- 切换到有 SP 消耗的技能后：runtime sim log 总数为 `2/2`，点击能量筛选后变为 `1/2`，唯一日志显示 `SP -{spCost}`，贡献槽位显示 `自身能量 -{spCost}`，来源标注包含该技能 ID。

当前边界：

- 详情面板仍是内嵌面板，不是独立弹层；但筛选、选中、详情回查的数据路径已经建立。
- 贡献拆分仍是三值槽位骨架，尚未拆到公式层、buff 层、反应层或来源候选层。
- 筛选状态还没有和时间轴 state marker / 状态点焦点联动。
- 资源监控仍是列表摘要，还没有 Endaxis 式多曲线图。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、35 条测试。

下一步：

- 阶段 5-8CE 目标：把 runtime sim log 选中项与时间轴 / 状态点焦点联动，点击日志后能定位对应帧和三值点。
- 若先补资源监控，则优先用 `enemyStateCurve.points[]` 与 `selfEnergyCurveByActor[].points[]` 绘制 HP / 韧性 / 能量多曲线，而不是继续扩展 evidence 诊断。
- 继续保持 `candidate / sampled / placeholder` 在诊断层，只有 applied delta 进入主运行时 UI。

### 2026-07-08：阶段 5-8CE 模拟日志联动状态点焦点

本轮完成：

- `threeValueGenerationLayer.deltas[]` 新增 `stateCurveSequenceIndex`，保留源状态曲线点使用的序号，避免 runtime log / runtime point 自己的列表序号覆盖定位语义。
- `threeValueRuntimeProjection.simLog[]` 与 runtime point 继承 `stateCurveSequenceIndex`，让运行日志能稳定回到 `threeValueCurveFramework.stateCurves` 的同一个 applied 点。
- `EventLogPanel` 引入共享的 `createStateCurvePointId()`，在选中 runtime sim log 时生成同一个 `stateCurvePointId`，并在详情中显示 `状态点`。
- `EventLogPanel` 新增 `select-runtime-state-point` 事件，点击或键盘选中日志行时把状态点 ID 回传给 `Workbench`。
- `Workbench` 接到 runtime sim log 的状态点 ID 后，复用现有 `selectedStateCurvePointId`，并自动切换到状态曲线“选中”模式。
- 新增 Workbench 页面级测试，确认点击 runtime sim log 后，状态曲线只保留对应点，时间轴 state marker 进入 selected 状态。

当前验证事实：

- 默认末音样例中，runtime sim log 详情显示的 `状态点` 与时间轴 applied state marker 的 `data-state-point-id` 完全一致。
- 点击默认 runtime sim log 行后，分析面板状态曲线从 `16` 个可见点收窄到 `1` 个选中点。
- 点击日志后，时间轴对应的 applied state marker 保留并显示 selected 状态。

当前边界：

- 本阶段只打通日志到状态点/帧定位，没有新增伤害、削韧或充能公式。
- 状态点焦点仍依赖已应用的 applied delta；`candidate / sampled / placeholder` 继续只在诊断路径显示。
- 资源监控仍是数值列表，还没有 Endaxis 式多曲线图。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、36 条测试。
- `npm run test -- --run`：通过，13 个测试文件、110 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CF 目标：把运行时资源监控从摘要列表升级为 Endaxis 式 HP / 韧性 / 自身能量多曲线图。
- 曲线数据只消费 `threeValueRuntimeProjection.enemyStateCurve.points[]` 和 `selfEnergyCurveByActor[].points[]`，不要重新读取 evidence 矩阵。
- 曲线横轴继续使用 60fps 帧时间基准；点击曲线点时优先复用现有 `selectedStateCurvePointId` 联动链路。

### 2026-07-08：阶段 5-8CF 运行时 HP / 韧性 / 能量多曲线图

本轮完成：

- `ResourceMonitorPanel` 新增运行时多曲线图，直接消费 `threeValueRuntimeProjection.enemyStateCurve.points[]` 与 `selfEnergyCurveByActor[].points[]`。
- 曲线序列覆盖三类运行时数值：敌人 HP 累计伤害、敌人韧性累计削减、每个角色自身 SP 累计变化。
- 曲线横轴使用 runtime point 的 `frameIndex / frameLabel`，继续沿用 60fps 帧时间基准。
- 曲线点复用共享的 `createRuntimeStateCurvePointId()`，与 runtime sim log、时间轴 state marker、分析面板状态曲线使用同一个状态点 ID。
- `ResourceMonitorPanel` 新增 `select-runtime-state-point` 事件，点击曲线点后由 `Workbench` 切到对应 `selectedStateCurvePointId` 和“选中”模式。
- `EventLogPanel` 不再本地复制 runtime 状态点 ID 拼接逻辑，改为复用 `stateCurvePointIdentity.js` 中的共享函数。
- Workbench 测试新增：默认 HP 曲线点存在、曲线 legend 覆盖 HP / 韧性 / SP、点击曲线点联动状态曲线和时间轴、SP 消耗技能会生成 `selfEnergyChange` 曲线点。

当前验证事实：

- 默认末音样例中，资源监控曲线存在 1 个 HP 曲线点，其 `data-state-point-id` 与 runtime sim log 详情显示的状态点一致。
- 默认末音样例中，曲线 legend 至少包含 `enemy-hp / enemy-toughness / self-energy-*` 三类序列；韧性和 SP 没有 applied 点时仍以 0 点占位显示。
- 点击默认 HP 曲线点后，分析面板状态曲线收窄到该点，时间轴对应 state marker 进入 selected 状态。
- 切换到有 SP 消耗的技能后，资源监控曲线点中出现 `selfEnergyChange`，点位 `data-delta` 等于该技能的 `-spCost`。

当前边界：

- 曲线现在显示的是累计变化量，不是敌人剩余 HP、敌人剩余韧性或角色当前能量上限约束。
- 多曲线共享一套归一化坐标，适合先看趋势和点位联动；后续可按 Endaxis 风格拆分轨道或增加局部量尺。
- 曲线点的详情仍依赖分析面板和 runtime sim log，资源监控自身还没有独立详情抽屉。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、37 条测试。
- `npm run test -- --run`：通过，13 个测试文件、111 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CG 目标：建立统一的运行时三值选中详情入口，让 runtime sim log、资源曲线点、状态曲线点共享同一份 HP / 韧性 / 能量详情。
- 详情优先展示当前选中点的动作、帧、轨道、delta、累计值、来源 ID、贡献槽位和应用状态。
- 不在此阶段追逐最终公式；继续把公式、韧性和充能细节保留为可替换来源字段。

### 2026-07-08：阶段 5-8CG 统一运行时三值选中详情

本轮完成：

- 新增 `runtimeSelectedDetail.js`，从 `threeValueRuntimeProjection` 和全局 `selectedStateCurvePointId` 派生统一运行时选中详情。
- 统一详情会反查 runtime point 与对应 `simLog` 行，输出动作、角色、命中、帧、轨道、delta、累计值、应用状态、来源 delta、贡献槽位和来源 ID。
- 新增 `RuntimeSelectedDetailPanel.vue`，在 Workbench 右侧展示当前选中三值点详情。
- runtime sim log、运行时资源曲线点、状态曲线 applied point 现在都通过同一个 `selectedStateCurvePointId` 触发同一份详情。
- `RuntimeSelectedDetailPanel` 只展示 applied runtime point；选中 candidate / sampled / placeholder 诊断点时不伪造运行时详情。
- Workbench 测试新增三路覆盖：点击 runtime sim log、点击 runtime resource chart point、点击 applied state curve point 后，都能看到同一个状态点 ID 和统一详情。

当前验证事实：

- 点击默认末音 runtime sim log 后，统一详情显示动作 `普通攻击`、Delta `12,461`、累计 `12,461`、HP 贡献槽激活，并包含来源 element `109001081`。
- 点击默认 HP 资源曲线点后，统一详情状态点 ID 与曲线点 `data-state-point-id` 一致，HP 贡献槽显示 `敌人 HP12,461`。
- 点击分析面板里的 applied state curve point 后，统一详情状态点 ID 与状态曲线点一致，来源 delta 为 `action-0001|applied-frame-0-point-0`，来源包含 Skill `10900101`。

当前边界：

- 统一详情已经集中数据派生，但 `EventLogPanel` 旧内嵌详情仍保留，后续可改为消费统一详情或变成日志行上下文。
- 统一详情当前只覆盖 applied runtime point，不覆盖 candidate / sampled / placeholder。
- 详情中的累计值仍是 UI 对 runtime applied 点的累计变化量，不是敌人/角色真实剩余资源。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CH 目标：把全局 `selectedStateCurvePointId` 反向同步到 runtime sim log，让从资源曲线或状态曲线选中的点也能高亮对应日志行。
- 同步时保持当前筛选可控：如果当前筛选隐藏了目标日志，先显示“选中点不在当前筛选内”的轻量状态，不强行重置用户筛选。
- 后续再把 `EventLogPanel` 的内嵌详情改为消费统一详情，减少重复派生逻辑。

### 2026-07-08：阶段 5-8CH runtime sim log 反向同步选中状态

本轮完成：

- `EventLogPanel` 新增 `selectedStateCurvePointId` 输入，接收 Workbench 全局状态点选中值。
- runtime sim log 行新增 `data-state-point-id`，使用 `createRuntimeStateCurvePointId()` 与资源曲线、时间轴和状态曲线保持同一套 ID。
- 当外部选中点对应的日志行在当前筛选内时，`EventLogPanel` 自动同步 `selectedRuntimeLogIndex` 并高亮该日志行。
- 当外部选中点存在但被当前 HP / 韧性 / 能量、actor、action 筛选隐藏时，日志区显示“选中三值点不在当前日志筛选内”，不重置用户筛选。
- Workbench 把 `selectedStateCurvePointId` 传给 `EventLogPanel`，形成资源曲线 / 状态曲线 / 日志三者的双向焦点链路。

当前验证事实：

- 点击默认 HP 资源曲线点后，对应 runtime sim log 行的 `data-selected` 变为 `true`。
- 点击分析面板中的 applied state curve point 后，对应 runtime sim log 行同样高亮。
- 在有 SP 消耗技能场景中，先把 runtime sim log 筛选为 `selfEnergyChange` 后，再从资源曲线选中 HP 点，日志计数仍保持 `1/2`，并显示“选中三值点不在当前日志筛选内”。
- 从隐藏提示状态切回 `全部` 筛选后，HP 日志行恢复高亮。

当前边界：

- `EventLogPanel` 内嵌详情仍使用本地 `selectedRuntimeLog` 派生；与右侧统一详情存在重复显示。
- 筛选隐藏提示只提示当前选中点被隐藏，不自动提供“一键显示全部”按钮。
- 反向同步只覆盖 runtime applied 点，不覆盖 candidate / sampled / placeholder 诊断点。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CI 目标：让 `EventLogPanel` 的内嵌三值详情消费 `RuntimeSelectedDetail` 派生结果，减少日志详情和右侧详情之间的重复逻辑。
- 保留 runtime sim log 的行级筛选和本地行上下文，但三值贡献、来源标注、状态点 ID 应尽量来自统一详情。
- 若统一详情为空，则继续保留当前日志行的最小详情作为降级显示。

### 2026-07-08：阶段 5-8CI 日志内嵌详情接入统一详情

本轮完成：

- `EventLogPanel` 新增 `runtimeSelectedDetail` 输入，接收 Workbench 已派生好的统一运行时选中详情。
- 日志内嵌详情区新增 `data-detail-source`，区分当前使用 `runtime-selected-detail` 还是 `runtime-log-fallback`。
- 当当前日志行的 `statePointId` 与 `runtimeSelectedDetail.statePointId` 一致时，日志详情的动作、命中、三值、轨道、角色、状态、来源 delta、状态点 ID、贡献槽位和来源标注优先来自统一详情。
- 当尚未建立全局选中点或统一详情为空时，日志详情继续使用当前日志行和 runtime point 作为 fallback，避免初始态空白。
- `Workbench` 将 `runtimeSelectedDetail` 传入 `EventLogPanel`，让日志详情、右侧三值详情、资源曲线和状态曲线共享同一份派生数据。

当前验证事实：

- 默认初始状态下，runtime sim log 详情仍显示 `action-0001|applied-frame-0-point-0`，且 `data-detail-source="runtime-log-fallback"`。
- 点击 runtime sim log 行后，日志详情切换为 `data-detail-source="runtime-selected-detail"`，并继续显示统一详情中的 HP 贡献和来源 element。
- 点击 HP 资源曲线点后，对应日志行高亮，日志详情同样使用 `runtime-selected-detail`。
- 在 SP 技能场景中，先筛选到能量日志，再从资源曲线选中 HP 点并切回 `全部` 后，HP 日志行恢复高亮，日志详情使用统一详情。

当前边界：

- `EventLogPanel` 仍保留一套 fallback 派生函数，用于未选中或统一详情为空的初始态。
- 右侧 `RuntimeSelectedDetailPanel` 和日志内嵌详情仍是两个展示面板，只是数据来源已收束。
- “选中三值点不在当前日志筛选内”提示还只是文字，没有一键显示该日志的操作。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CJ 目标：给 runtime sim log 的“选中点不在当前筛选内”提示增加一键显示当前选中日志的操作。
- 一键显示应只调整日志筛选到能包含当前 `selectedStateCurvePointId` 的最小范围，不改变时间轴或动作选择。
- 同步补充测试：筛选隐藏 HP 点时点击按钮后，日志筛选恢复到可见状态并高亮目标日志。

### 2026-07-08：阶段 5-8CJ runtime sim log 一键显示选中日志

本轮完成：

- `EventLogPanel` 的“选中三值点不在当前日志筛选内”提示新增 `显示日志` 操作。
- `显示日志` 会查找当前 `selectedStateCurvePointId` 对应的 runtime sim log 行，并只调整阻挡该日志显示的筛选项。
- 当前实现保留兼容筛选：若 track / actor / action 已为 `all` 或已匹配目标日志，则不改；若不匹配，则改为目标日志的对应值。
- 点击按钮后不改变时间轴、动作选择或全局状态点，只让日志筛选进入能看到当前选中日志的状态。
- Workbench 测试覆盖：在 SP 技能场景中，日志筛选为 `selfEnergyChange` 时从资源曲线选中 HP 点会显示隐藏提示；点击 `显示日志` 后筛选切到 HP，目标日志高亮，提示消失。

当前验证事实：

- 筛选隐藏 HP 点时，日志计数保持 `1/2` 并显示隐藏提示。
- 点击 `显示日志` 后，日志计数仍为 `1/2`，但 active track filter 从 `selfEnergyChange` 切到 `enemyHpDamage`。
- 点击后目标 HP 日志行 `data-selected="true"`，隐藏提示不存在。

当前边界：

- `显示日志` 只调整现有筛选状态，没有新增“恢复之前筛选”的历史栈。
- 若后续 actor / action 筛选组合更复杂，仍按最小兼容原则调整到目标日志对应值。
- 当前三值曲线和详情仍主要展示累计变化量，尚未建立敌人剩余 HP / 剩余韧性 / 角色当前能量的运行时基线。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CK 目标：补运行时三值状态基线，让 HP / 韧性 / 能量除了累计变化量外，开始具备“剩余/当前状态”字段和 UI 标注。
- 敌人 HP 优先从现有 enemy config / scenario enemy 派生初始值，韧性和角色能量若缺真实初始值则显式标注为待确认基线。
- 不在本阶段硬填未知公式；只补清晰的数据字段、来源状态和 UI 标签，方便后续真实公式/采样结果接入。

### 2026-07-08：阶段 5-8CK 运行时三值状态基线

本轮完成：

- `threeValueRuntimeProjection.enemyStateCurve` 新增 `baseline` 与 `stateMetrics`，把敌人 HP / 韧性从单纯累计 delta 扩展为可描述初始值、当前/剩余值、基线状态和来源路径的运行时字段。
- 敌人 HP 基线先按 `scenario.enemy.stats.maxHp * scenario.enemy.hpMultiplier` 派生；默认迅狼样本为 `8628 * 1 = 8628`。
- 敌人 HP 剩余值按血条语义钳制到 `0`，但仍保留原始累计伤害和 `overrunValue`，避免把临时 raw 公式造成的溢出隐藏掉。
- 敌人韧性基线保持 `baseline-pending-azpr-enemy-toughness-state`，不把未知韧性条误填成 0。
- `selfEnergyCurveByActor[]` 新增 `baseline` 与 `stateMetric`；可读取 `maxSp` 时仅记录上限，不把上限当成战斗初始当前 SP。
- 角色自身能量初始值保持 `baseline-pending-azpr-initial-self-energy`，等待后续采样或真实战斗初始化规则接入。
- `ResourceMonitorPanel` 新增状态文案：HP 显示 `剩余 0`，韧性显示 `剩余待确认`，角色 SP 行显示 `当前待确认`。
- `RuntimeSelectedDetailPanel` 新增选中点后的状态值，当前默认 HP 点显示剩余 `0`；Delta 和累计值仍保留原始变化量。

当前验证事实：

- 默认末音 / 普通攻击样本中，运行时 HP delta 仍为 `12,461`，HP 基线为 `8,628`，状态剩余为 `0`，溢出为 `3,833`。
- 默认韧性曲线 delta 为 `0`，但状态基线仍标记待确认，不再因 `null` 被数值转换为 0 而误判为已确认。
- 寒悠悠 SP 消耗场景中，自身能量 delta 为技能消耗值，`stateMetric.initialValue/currentValue` 仍为 `null`，只记录 `maxSp` 来源。
- 工作台资源面板和右侧三值详情均能展示新增状态值。

当前边界：

- HP 基线只是从当前敌人面板和倍率派生的状态起点，不代表最终敌人等级缩放、抗性、防御、护盾或真实战斗血量公式已经确认。
- 韧性初始值、削韧单位、弱点状态与韧性条上限仍未从 AzPr 运行时机制完全确认。
- 自身能量的初始当前值、共享规则、战斗开始 SP、技能消耗后恢复顺序仍等待采样或更深运行时证据。
- 资源曲线图当前仍绘制累计 delta；新增的剩余/当前状态值只在摘要和详情中显示。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有既有 Windows 换行提示。

下一步：

- 阶段 5-8CL 目标：让 runtime resource chart 支持“累计变化量 / 状态值”两种视图，状态值视图使用本轮新增的 `stateMetrics` 派生曲线。
- 状态值视图中，HP / 韧性采用剩余值语义，自身能量采用当前值语义；基线未知的曲线应明确显示待确认，而不是绘制伪 0 状态线。
- 同步把选中点 tooltip / 详情补上基线来源状态和溢出值提示，为后续接入真实韧性/能量基线留好 UI 位置。

### 2026-07-08：阶段 5-8CL runtime resource chart 状态值视图

本轮完成：

- `ResourceMonitorPanel` 的 runtime resource chart 新增“累计变化 / 状态值”分段切换。
- 默认仍使用“累计变化”模式，保持原有曲线、选中点、日志联动和测试行为不变。
- “状态值”模式使用 `stateMetrics` 派生绘制值：HP / 韧性按剩余值语义，自身能量按当前值语义。
- 状态值模式只绘制基线已确认的点；韧性和角色初始当前 SP 仍显示待确认，不绘制伪 0 曲线。
- 曲线点新增 `data-curve-mode`、`data-cumulative`、`data-state-value`、`data-baseline-status`、`data-overrun`，便于后续联动和测试。
- 曲线 tooltip 在状态值模式显示状态值、delta、累计、基线来源和 HP 溢出值；累计模式也附带状态值或基线待确认提示。
- `RuntimeSelectedDetailPanel` 新增基线来源和溢出值显示：默认 HP 点显示基线 `敌人面板`、溢出 `3,833`。
- `createRuntimeSelectedDetail()` 补充 `rawStateValue` 与 `overrunValue`，让统一详情和图表使用同一套状态派生语义。

当前验证事实：

- 默认模式按钮状态为 `累计变化=true`、`状态值=false`，默认 HP 曲线点 `data-value=12461`。
- 切到状态值模式后，默认 HP 曲线点 `data-value=0`、`data-cumulative=12461`、`data-state-value=0`、`data-overrun=3833`。
- 状态值图例中 HP 行显示 `剩余 0 / 溢出 3,833`。
- 自身能量在缺初始当前 SP 时显示 `当前待确认`，没有被画成 0 状态线。
- 选中默认 HP runtime 点后，三值详情显示状态值 `0`、溢出 `3,833`、基线 `敌人面板`。

当前边界：

- 状态值曲线仍只绘制应用后的离散 runtime point，没有额外插入战斗开始初始值锚点。
- HP 基线来源仍是当前敌人面板与倍率，不代表最终战斗血量公式已经确认。
- 韧性和自身能量当前状态仍等待真实运行时机制或采样补全。
- 曲线模式当前是组件内局部 UI 状态，尚未持久化到项目或用户偏好。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CM 目标：抽出三值运行时公式适配器框架，把 HP / 韧性 / 自身能量 delta 的产生入口整理成可替换 calculator contract。
- 当前 raw HP 预览、韧性 pending、能量 cost / recover-sp evidence 都应通过同一适配器输出 `delta`、`status`、`sourceIds`、`confidence` 和 `replaceable`。
- 本阶段仍不追最终公式数值，只把后续接入真实 AzPr 公式、采样校准和角色/敌人状态参数的位置固定下来。

### 2026-07-08：阶段 5-8CM 三值运行时公式适配器框架

本轮完成：

- `threeValueGenerationLayer.contract` 新增 `calculatorContract`，明确 `ThreeValueDeltaCalculator` 的必要输出：`delta`、`status`、`sourceIds`、`confidence`、`replaceable`。
- 新增三套 calculator 定义：
  - `azpr-hp-delta-calculator`
  - `azpr-toughness-delta-calculator`
  - `azpr-self-energy-delta-calculator`
- `createThreeValueGenerationDelta()` 现在会为每条 delta 生成 `calculator` 对象，并同步扁平字段 `calculatorKey`、`calculatorVersion`、`calculationKind`、`calculationStatus`、`calculationReplaceable`。
- 当前 raw HP、候选 DamageElement HP、候选削韧、候选/采样/显式资源能量变化都通过同一 calculator 输出结构承载。
- `threeValueGenerationLayer.summary` 新增 calculator 统计：`calculatorCount`、`calculatorKeys`、`calculatorReplaceableDeltaCount`、`calculatorStatuses`、`calculatorSummary`。
- `threeValueRuntimeProjection` 的 runtime point 与 sim log 继续携带 calculator 元数据，后续 UI 详情或调试日志可直接显示公式适配器来源。

当前验证事实：

- 默认样本中 `calculatorContract.calculatorKeys` 覆盖 HP、韧性、自身能量三条轨。
- 默认样本 `calculatorCount=3`，`calculatorReplaceableDeltaCount=16`，说明当前 16 条 delta 都仍是可替换适配器输出。
- 默认 applied HP delta 使用 `azpr-hp-delta-calculator`，`calculationKind=raw-result-preview`，`calculationStatus=raw-hp-projection`，`calculationReplaceable=true`。
- 候选 hit-1 的三条 delta 分别使用 HP / toughness / self-energy calculator，且均保留 `sourceIds` 与 `confidence=candidate`。
- recover-sp runtime sample 使用 `azpr-self-energy-delta-calculator`，`calculationKind=recover-sp-runtime-sample`，保留采样 `captureSessionIds`。
- 寒悠悠显式 SP 消耗点使用 `azpr-self-energy-delta-calculator`，`calculationKind=explicit-resource-event-or-cost-preview`，并继续进入 runtime projection。

当前边界：

- calculator contract 已固定，但 HP / 韧性 / 能量的最终 AzPr 公式仍未确认；当前输出仍以 preview / candidate / sampled / explicit event 为主。
- 顶层 `replaceable` 仍表示 state layer 是否可替换；`calculationReplaceable` 表示公式适配器输出是否可被最终公式替换。两者语义不同，后续不要混用。
- UI 尚未展示 calculator 来源；目前只把元数据带到 runtime point 和 sim log。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。
- `git diff --check`：通过；仅有既有 Windows 换行提示。

下一步：

- 阶段 5-8CN 目标：把 calculator 来源接入 Workbench 统一三值详情和 runtime sim log 详情，让用户能直接看到当前 delta 来自哪条适配器、是否可替换、还缺哪些确认项。
- 展示时保留非技术但可追溯的标签，例如“HP预览 / 可替换 / 公式未确认”、“削韧候选 / 基线待确认”、“能量采样 / owner-share待确认”。
- 不在 5-8CN 修改最终公式，只把来源透明度和调试入口补齐。

### 2026-07-08：阶段 5-8CN calculator 来源接入详情

本轮完成：

- `createRuntimeSelectedDetail()` 新增 `calculatorRows`，把 runtime point / sim log 中的 calculator 元数据整理成 UI 可直接展示的行。
- 右侧 `RuntimeSelectedDetailPanel` 新增“公式适配器”区，展示适配器、来源、是否可替换、公式状态、缺口。
- `EventLogPanel` 的 runtime sim log 内嵌详情也新增“公式适配器”区；当统一详情已匹配时复用统一详情的 `calculatorRows`，初始 fallback 状态也能从 runtime point / sim log 生成同样的行。
- 当前 HP applied 点展示为：`HP适配器 / HP预览 / 可替换 / 公式未确认 / 最终公式、防御抗性顺序、命中绑定`。
- calculator 文案保持面向使用者的中文标签，同时保留 `title` 与 `rawValue` 追溯原始 key/status。

当前验证事实：

- 默认 runtime sim log 初始 fallback 详情显示 5 行 calculator 来源：适配器、来源、替换、公式、缺口。
- 点击默认 runtime sim log 行后，右侧三值详情显示同一套 calculator 来源。
- HP applied 点仍保持原有 Delta、累计、状态值、基线与来源 element 显示；本阶段只增加来源透明度。

当前边界：

- calculator 来源已显示在详情里，但还没有独立的全局 calculator 诊断摘要或筛选入口。
- calculator 定义仍位于 `projectSimulationResult.js` 中，后续应拆到更清晰的运行时 adapter 模块。
- UI 文案目前覆盖当前三条轨道的主要来源类型；后续若新增最终公式或新采样类型，需要补映射文案。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CO 目标：把三值 calculator 定义、状态映射和未确认项整理到独立运行时 adapter 模块，减少 `projectSimulationResult.js` 的继续膨胀。
- 同步补 generation/runtime summary 的 calculator 诊断入口，让用户后续能看到每条轨道仍有多少 preview/candidate/sample 输出、哪些缺口最常见。
- 仍不修改最终公式数值；这一阶段先把 adapter 模块边界和诊断摘要铺好。

### 2026-07-08：阶段 5-8CO 三值 calculator adapter 模块化

本轮完成：

- 新增 `src/simulation/threeValueCalculatorAdapters.js`，集中维护 HP / 韧性 / 自身能量三条 calculator 定义、可替换判定、未确认项和中文展示映射。
- `projectSimulationResult.js` 不再内联 calculator 定义和摘要函数，只从 adapter 模块读取 `createThreeValueCalculatorResult()`、`getThreeValueCalculatorKeys()` 和 `summarizeThreeValueCalculators()`。
- `runtimeSelectedDetail.js` 的 calculator rows 改为复用 adapter 模块的 `createThreeValueCalculatorDisplayRows()`，避免运行时详情和日志面板各自维护一份文案映射。
- `threeValueRuntimeProjection.summary` 新增 runtime 侧 calculator 诊断字段：`calculatorCount`、`calculatorKeys`、`calculatorReplaceableDeltaCount`、`calculatorStatuses`、`calculatorSummary`。
- 测试补充 runtime projection summary 断言，锁定默认 HP applied 点、RecoverSP sample 场景和寒悠悠显式 SP 消耗场景的 calculator 统计。

当前验证事实：

- 默认样本 runtime projection 当前只应用 HP delta，因此 runtime 侧 `calculatorCount=1`、`calculatorKeys=[azpr-hp-delta-calculator]`、`calculatorStatuses=[raw-hp-projection]`。
- 默认样本 generation 侧仍保留三条 calculator contract，候选 HP / 韧性 / 自身能量 delta 没有被本次模块化改写。
- recover-sp runtime sample 仍作为 sampled delta 保留在 generation layer，runtime projection 仍只应用 HP delta。
- 寒悠悠显式 SP 消耗场景 runtime 侧同时应用 HP calculator 和 self-energy calculator，`calculatorReplaceableDeltaCount=2`。
- Workbench 详情中的“公式适配器”文案保持不变，来源只是从共享 adapter helper 派生。

当前边界：

- 本阶段只整理 adapter 模块边界和诊断摘要，没有接入最终 AzPr HP / 韧性 / 充能公式。
- `calculatorSummary` 目前是 projection 派生字段，不属于项目保存 schema。
- UI 仍只有详情区展示单点 calculator 来源，还没有全局 calculator 诊断/筛选面板。
- 运行时曲线仍只消费 applied delta；sampled / candidate delta 继续留在 generation layer 与候选曲线中。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CP 目标：建立 Workbench 全局 calculator 诊断入口，把 generation/runtime 两层的 calculator 摘要、状态分布和最常见缺口集中展示出来。
- 诊断入口应服务当前开发阶段：帮助确认三值曲线框架、adapter 状态和缺口分布，而不是继续追逐每个角色每个动作的逐帧细节。
- 仍不修改最终公式；下一阶段优先让用户能看清当前 HP / 韧性 / 能量曲线分别由哪些 preview/candidate/sample/applied 输出构成。

### 2026-07-08：阶段 5-8CP Workbench 全局 calculator 诊断入口

本轮完成：

- `summarizeThreeValueCalculators()` 新增结构化统计：`outputCount`、`calculatorKeyCounts`、`kindCounts`、`statusCounts`、`unresolvedItemCounts`、`layerCounts`、`trackCounts`。
- `threeValueGenerationLayer.summary.calculatorSummary` 和 `threeValueRuntimeProjection.summary.calculatorSummary` 现在都能回答“有多少条输出、来自哪些适配器、是什么来源/状态、最常见缺口是什么”。
- `AnalysisPanel` 的“三值来源”区新增全局 calculator 诊断入口，分别展示 generation 和 runtime 两层的适配器统计。
- 默认样本当前显示：
  - 生成适配器：`3类/16条 · 可替换 16`
  - 运行适配器：`1类/1条 · 可替换 1`
- Workbench 测试新增 DOM 断言，锁定全局诊断行的 scope、摘要和详情文案。

当前验证事实：

- 默认 generation 层 16 条 calculator 输出中，HP 6 条、能量 5 条、削韧 5 条。
- 默认 generation 层 15 条候选 delta 当前统一状态为 `per-hit-candidate-fields-found-formula-unapplied`，UI 汇总为“候选未确认 15”。
- 默认 runtime 层只应用 HP calculator，缺口显示为“最终公式、防御抗性顺序、命中绑定”。
- `unresolvedItemCounts` 同数时按固定缺口优先级排序，保证“最终公式”优先于其他同数缺口。

当前边界：

- 全局诊断入口目前是只读摘要，尚未与三值曲线筛选、日志筛选或详情选中联动。
- 统计来自现有 generation/runtime projection；它不证明最终 AzPr 公式已确认。
- 候选 delta 的状态汇总已经可见，但还没有按状态点击过滤或定位到具体 delta 列表。

验收结果：

- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CQ 目标：把全局 calculator 诊断入口与现有三值曲线/日志筛选轻量联动。
- 优先支持从“生成适配器 / 运行适配器”诊断行切换到对应层级视角：generation 侧聚焦候选/采样来源，runtime 侧聚焦已应用曲线和 sim log。
- 仍保持框架优先，不追逐每个动作的逐帧精细数值；下一阶段重点是让用户能从诊断摘要快速定位三值曲线和日志。

### 2026-07-08：阶段 5-8CQ calculator 诊断联动三值曲线/日志

本轮完成：

- `AnalysisPanel` 的 generation/runtime calculator 诊断行从只读摘要升级为可点击入口，并保留 `data-calculator-scope` / `data-active` 测试入口。
- Workbench 新增 `calculatorDiagnosticScope` 和 `calculatorDiagnosticFocus` 状态，统一承接诊断入口的 scope。
- 点击“生成适配器”会切换到 generation 视角：隐藏 applied 层，显示 candidate / sampled / placeholder 层，清空选中点并回到全部视角。
- 点击“运行适配器”会切换到 runtime 视角：只显示 applied 层，选中第一条 runtime sim log 对应的状态点，并切到选中视角。
- `EventLogPanel` 新增 `calculatorDiagnosticFocus` prop；runtime 诊断触发时会把日志筛选重置到全部轨道、全部角色、全部动作，并回到第一条日志。
- Workbench 端到端测试覆盖了从 generation 诊断聚焦候选层，再从 runtime 诊断恢复 applied 曲线和 sim log 可见的流程。

当前验证事实：

- 默认样本点击“生成适配器”后，状态曲线可见点从 16 切换为 15，`applied` 关闭、`candidate` 保持开启。
- 默认样本把 runtime sim log 手动筛到能量后会显示 `0/1`；随后点击“运行适配器”会恢复为 `1/1`，且日志轨道筛选回到“全部”。
- 点击“运行适配器”后状态曲线切到 selected focus，并选中默认 HP applied 点。

当前边界：

- 联动粒度仍是 generation/runtime 两个 scope，不支持按单个 calculator key、status 或 unresolved item 精准过滤。
- generation 视角目前使用 state curve 层筛选表达，不会自动滚动到候选曲线或 action result 行。
- runtime 视角默认选中第一条 sim log；多条 runtime delta 下尚未按诊断行内的 track/status 分配具体目标点。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CR 目标：把三值曲线和模拟日志的“当前视角”做成更清晰的用户反馈，让 generation/runtime 诊断联动后的层级、选中状态和日志筛选状态一眼可见。
- 优先补 UI 状态标签和空状态解释，不继续扩展公式细节；让框架调试路径更像 Endaxis 的资源/日志联动体验。

### 2026-07-08：阶段 5-8CR 三值曲线/模拟日志视角反馈

本轮完成：

- `AnalysisPanel` 的状态曲线区域新增当前视角摘要，显示 `全部视角 / 生成视角 / 运行视角`、可见点数、当前层级、轨道范围和 focus 模式。
- `EventLogPanel` 的模拟日志区域新增当前筛选摘要，显示 `日志筛选 / 运行视角`、可见日志条数和当前轨道/角色/动作筛选。
- generation calculator 诊断联动后，状态曲线摘要会显示 `生成视角 15/16点 候选/采样/占位 · 全部轨道 · 全部三值点`。
- runtime calculator 诊断联动后，状态曲线摘要会显示 `运行视角 1/16点 已用 · 全部轨道 · 选中三值点`，模拟日志摘要显示 `运行视角 1/1条 全部 · 全部角色 · 全部动作`。
- Workbench 测试补充初始视角、generation 视角、runtime 视角三种标签断言。

当前验证事实：

- 默认初始状态曲线摘要为 `全部视角 16/16点 已用/候选 · 全部轨道 · 全部三值点`。
- 默认初始模拟日志摘要为 `日志筛选 1/1条 全部 · 全部角色 · 全部动作`。
- 手动把 runtime sim log 筛到能量时，摘要会变为 `日志筛选 0/1条 能量 · 全部角色 · 全部动作`。
- 点击 runtime 诊断后，日志摘要恢复为运行视角且筛选全部可见。

当前边界：

- 视角反馈仍是只读标签，不是独立模式管理器。
- generation/runtime scope 之外的精细 calculator key/status/unresolved item 过滤仍未实现。
- 暂未加入自动滚动或跨面板高亮，只保证当前视角和筛选状态可见。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CS 目标：把三值 runtime projection 的 applied 点和 generation candidate/sample 点在 UI 中进一步分层说明，补“当前数值是否参与曲线/日志/最终计算”的清晰标记。
- 优先减少用户误解：candidate/sample 是诊断和候选，不等于已应用结果；runtime applied 才进入当前三值曲线和模拟日志。
- 仍不追逐最终公式或逐帧动作细节。

### 2026-07-08：阶段 5-8CS 三值层级参与范围说明

本轮完成：

- `AnalysisPanel` 的状态曲线层级开关新增参与范围短标签：
  - 已用：`进曲线/日志`
  - 候选：`不进结果`
  - 采样：`不进结果`
  - 占位：`不进结果`
- 状态曲线点新增参与范围说明：
  - applied 点显示 `参与当前三值曲线和模拟日志`
  - candidate 点显示 `候选诊断，不参与当前结果`
  - sampled 点显示 `采样诊断，不参与当前结果`
  - placeholder 点显示 `缺口占位，不参与当前结果`
- 状态点 DOM 新增 `data-participation` 和 `workbench-state-curve-point-participation`，便于测试和后续筛选/说明联动。
- Workbench 测试覆盖默认 applied/candidate 点，以及 sampled/placeholder fixture 的参与范围说明。

当前验证事实：

- 默认样本 applied HP 点带 `data-participation="已应用"`，说明为“参与当前三值曲线和模拟日志”。
- 默认样本首个 HP candidate 点带 `data-participation="候选诊断"`，说明为“候选诊断，不参与当前结果”。
- sampled fixture 的 self-energy 点显示“采样诊断，不参与当前结果”。
- placeholder fixture 的 HP 点显示“缺口占位，不参与当前结果”。

当前边界：

- 参与范围说明只解释当前 UI/运行时语义，不代表最终 AzPr 公式已经确认。
- candidate/sample/placeholder 仍可显示在状态曲线诊断视图里，但不会进入 runtime sim log 或当前应用结果。
- 说明标签尚未接入 tooltip 或帮助文档；目前以列表内短文案为主。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CT 目标：把 runtime applied 三值点与 actionResultTimeline 动作级三值结果进一步对齐，让用户能从动作结果、状态曲线点、模拟日志之间看到同一条 delta 的对应关系。
- 优先做可追踪的 ID/来源显示和轻量交叉高亮，不扩展最终公式或逐帧动作细节。

### 2026-07-08：阶段 5-8CT 动作结果定位 runtime 三值点

本轮完成：

- `AnalysisPanel` 的动作级三值结果行接入 `threeValueRuntimeProjection`，按 `actionId` 汇总 runtime applied delta。
- 动作结果行现在显示可定位的运行结果摘要，例如 `定位 1条运行结果 · HP 12,461 · Delta action-0001|applied-frame-0-point-0`。
- 点击动作结果行会切到 runtime applied 视角，选中对应状态曲线点，并让模拟日志恢复显示同一条 runtime log。
- `EventLogPanel` 新增动作结果定位来源的筛选摘要，显示 `结果定位 1/1条 全部 · 全部角色 · 全部动作`，避免日志被旧筛选隐藏后用户找不到结果。
- Workbench 测试覆盖动作结果行的 trace、状态点 ID、source delta ID，以及日志先被筛掉后点击动作结果恢复可见的闭环。

当前验证事实：

- 默认样本 `action-0001` 的动作结果行能定位到同一个 applied HP 状态点。
- 动作结果、状态曲线点和模拟日志共享 `action-0001|applied-frame-0-point-0` 这条 delta 来源。
- 手动把 runtime sim log 筛到能量导致 `0/1` 后，点击动作结果会恢复为 `1/1` 并选中 HP applied 日志。

当前边界：

- 本阶段只做 UI 定位链路，不改变项目保存 schema，不引入最终公式，也不扩展逐帧动作细节。
- 当前定位粒度是 action 级 runtime applied delta；多条 runtime delta 时先定位该动作下排序最靠前的状态点。
- 尚未做自动滚动、跨面板动画高亮或贡献拆分弹层。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CU 目标：继续推进 Endaxis 式主流程 UI，把结果定位后的“贡献拆分”做成稳定面板入口。
- 优先从已存在的三值贡献行开始，按动作/三值轨道展示 HP、韧性、能量的当前贡献，不追逐最终公式或逐帧命中细节。

### 2026-07-08：阶段 5-8CU 动作级三值贡献拆分入口

本轮完成：

- `AnalysisPanel` 在选中动作级 runtime 结果后显示“动作贡献拆分”面板。
- 面板按动作汇总当前已应用 runtime delta，并固定展示敌人 HP、敌人韧性、自身能量三条贡献。
- 默认样本中，点击 `action-0001` 动作结果后会显示：
  - 敌人 HP：`12,461`，已应用 1 条。
  - 敌人韧性：`0`，暂无已应用结果。
  - 自身能量：`0`，暂无已应用结果。
- 贡献行携带 `data-track-key`、`data-count`、`data-delta`、`data-state-point-id`，后续可继续接入轨道高亮、详情弹层或结果排序。
- Workbench 测试覆盖动作结果定位后贡献面板的三条贡献行。

当前验证事实：

- 贡献面板只在当前选中 runtime applied 点能映射回动作结果时显示。
- 动作贡献拆分复用 `threeValueRuntimeProjection.simLog` 和 runtime state point ID，不改变 simulation 输出结构。
- 当前 HP 贡献行与动作结果、状态曲线点、模拟日志共享同一条 `action-0001|applied-frame-0-point-0` 来源。

当前边界：

- 本阶段是动作级 applied delta 汇总，不拆公式层、Buff 层、反应层或最终伤害归因。
- 没有新增蓝色星原最终公式，也不补逐帧命中细节。
- 当前默认样本只有 HP applied delta，因此韧性/能量贡献行显示 0；后续真实 applied delta 增加后会自然进入同一面板。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CV 目标：把动作贡献拆分进一步接入右侧详情/日志详情，让选中贡献轨道时能稳定定位到对应三值详情，并为后续 Endaxis 式贡献弹层留入口。
- 仍保持框架和 UI 主流程优先，不追最终公式和逐帧动作细节。

### 2026-07-08：阶段 5-8CV 贡献拆分同步三值详情

本轮完成：

- `AnalysisPanel` 的动作贡献行改为发出专门的贡献定位事件。
- `Workbench` 区分动作结果定位和贡献定位，二者都会切到 runtime applied 视角，但 `runtimeLogFocus.source` 分别记录为 `action-result` / `action-contribution`。
- `EventLogPanel` 新增 `贡献定位` 筛选摘要；点击贡献行后，模拟日志恢复到对应 runtime log，并显示 `贡献定位 1/1条 全部 · 全部角色 · 全部动作`。
- 贡献行在当前选中轨道上显示 `详情已同步`，说明右侧三值详情、模拟日志详情和贡献拆分正在看同一个 runtime state point。
- Workbench 测试覆盖点击 HP 贡献行后，右侧三值详情状态点、日志详情状态点和日志详情来源同步为 `runtime-selected-detail`。

当前验证事实：

- 默认样本从动作结果进入贡献拆分后，HP 贡献行能再次定位到同一个 `appliedStatePointId`。
- 点击 HP 贡献行后，`RuntimeSelectedDetailPanel` 与 `EventLogPanel` 都显示同一个状态点。
- 日志详情使用统一详情数据源，而不是 fallback：`data-detail-source="runtime-selected-detail"`。

当前边界：

- 本阶段仍是前端定位和详情收束，不新增最终公式和逐帧命中细节。
- 贡献定位目前只对已有 applied delta 的贡献行可点击；没有 applied delta 的韧性/能量行继续禁用。
- 还没有做弹层、排序、图表贡献高亮或公式层/Buff层拆分。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CW 目标：把动作贡献拆分从“面板入口”推进到更接近 Endaxis 的贡献详情入口，例如在贡献行下方提供统一的来源/适配器摘要，减少用户在多个面板之间跳读。
- 仍不追最终公式；优先打磨主流程信息密度和定位体验。

### 2026-07-08：阶段 5-8CW 贡献详情摘要就地展示

本轮完成：

- `AnalysisPanel` 的动作贡献拆分面板新增“贡献详情”摘要区。
- 当前选中的贡献轨道会就地展示状态点、Delta 来源、Skill/Element 来源、适配器、来源类型、公式状态和缺口。
- 默认 HP 贡献详情显示：
  - 状态点：当前 runtime state point。
  - Delta：`action-0001|applied-frame-0-point-0`。
  - 来源：`Skill 10900101 / Element 109001081`。
  - 适配器：`HP适配器`。
  - 来源类型：`HP预览`。
  - 公式状态：`公式未确认`。
  - 缺口：`最终公式、防御抗性顺序、命中绑定`。
- Workbench 测试覆盖贡献详情区的状态点、Delta、来源、适配器和缺口显示。

当前验证事实：

- 贡献详情复用 runtime applied point / sim log 已有字段，不改变 simulation 输出结构。
- `calculator.unresolved` 已正确进入贡献详情，不会再显示成“缺口无”。
- 贡献详情只在当前选中贡献轨道存在 applied delta 时展示。

当前边界：

- 本阶段仍是 UI 信息整合，不新增最终公式和逐帧动作细节。
- 贡献详情展示的是当前 applied delta 的来源与适配器摘要，不是最终伤害归因。
- 尚未做弹层、贡献排序、图表高亮、Buff/反应层拆分。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CX 目标：把贡献详情入口进一步接到图表/时间轴高亮，点击贡献轨道时除了详情同步，还能让对应 runtime resource curve / timeline marker 处于同一焦点。
- 仍保持 Endaxis 式主流程 UI 优先，不追最终公式。

### 2026-07-08：阶段 5-8CX 贡献焦点联动资源曲线和时间轴

本轮完成：

- `Workbench` 新增 `runtimeFocusSource` 派生状态，用来表达当前 runtime state point 是从动作结果、贡献拆分还是普通交互进入。
- `ResourceMonitorPanel` 的 runtime 资源曲线点新增 `data-runtime-focus-source`。
- `TimelineGridPreview` 的状态曲线 marker 新增 `data-runtime-focus-source`。
- 点击动作贡献行后，资源曲线点和时间轴 marker 除了 `selected` 外，还会标记 `action-contribution` 来源。
- 普通资源曲线/日志交互会清空该来源，避免把后续手动选择误标为贡献定位。
- Workbench 测试覆盖点击 HP 贡献行后，资源曲线点与时间轴 marker 同步选中且来源为 `action-contribution`。

当前验证事实：

- 默认样本 HP 贡献行、右侧三值详情、模拟日志详情、资源曲线点和时间轴 marker 都指向同一个 `appliedStatePointId`。
- `data-runtime-focus-source="action-contribution"` 只作为前端焦点来源提示，不进入 simulation 输出或保存 schema。

当前边界：

- 本阶段只做焦点来源收束，不新增图表动画、自动滚动或弹层。
- 时间轴和资源曲线已有 selected 样式，本阶段先补 DOM/状态来源，后续可继续做更明显的高亮反馈。
- 不涉及最终公式、逐帧动作细节或数值机制推断。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。

下一步：

- 阶段 5-8CY 目标：继续改善 Endaxis 式主流程信息密度，优先把动作结果、贡献拆分、三值详情的布局压缩成更连贯的“结果详情区”，减少用户在分析面板和右侧面板之间来回扫视。
- 仍不追最终公式和逐帧动作细节。

### 2026-07-08：阶段 5-8CY 结果详情区就地收束

本轮完成：

- `Workbench` 将已存在的 `runtimeSelectedDetail` 传入 `AnalysisPanel`，不新增 simulation 输出或保存 schema。
- `AnalysisPanel` 在动作贡献拆分区域内新增“结果详情”摘要区。
- 点击动作结果后，分析面板内可直接看到同一 runtime state point 的动作、帧、轨道、Delta、累计、状态值和状态字段。
- 右侧完整“三值详情”面板继续保留；本阶段只把主流程必看字段前置，减少用户在分析面板和右侧面板之间跳读。
- Workbench 测试覆盖结果详情区的 action/state point/track、Delta、累计、剩余状态和运行时状态字段。

当前验证事实：

- 默认样本点击 `action-0001` 动作结果后，结果详情区、贡献拆分、右侧三值详情、模拟日志详情仍指向同一个 `appliedStatePointId`。
- 新增结果详情区复用 `createRuntimeSelectedDetail()` 产物，没有复制 runtime 计算逻辑。
- 展示字段来自当前运行时投影：默认 HP 样本显示 `Delta 12,461`、`累计 12,461`、`剩余 0`、`raw-hp-projection`。

当前边界：

- 本阶段不新增公式、证据解释、逐帧动作细节或最终归因。
- 结果详情区是紧凑摘要，不替代右侧完整三值详情。
- 尚未做结果详情折叠、自动滚动、批量编辑闭环或 Endaxis 式完整编辑体验。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、38 条测试。
- `npm run test -- --run`：通过，13 个测试文件、112 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8CZ 目标：继续贴近 Endaxis 主流程，优先改善动作结果定位后的编辑闭环，例如让选中结果、当前动作属性和时间轴位置更紧密联动，减少用户定位后还要手动找动作再编辑的步骤。
- 仍保持框架体验优先，不回到最终公式或逐帧技能细节深挖。

### 2026-07-08：阶段 5-8CZ 结果定位同步源动作编辑

本轮完成：

- `AnalysisPanel` 点击动作结果时改为发出 `select-action-result` 事件，携带 `actionId` 和 runtime `statePointId`。
- `Workbench` 新增 `selectActionResult()`，先选中结果来源动作，再沿用既有 `action-result` runtime 聚焦链路。
- 点击 `action-0001` 动作结果后，时间轴动作块、属性面板、结果详情、贡献拆分和模拟日志会进入同一个动作上下文。
- Workbench 测试新增“先选中等待动作，再点击普通攻击结果”的闭环用例，确认属性面板从等待动作回到技能动作，时间轴也同步选中 `action-0001`。

当前验证事实：

- 新增事件只用于动作结果行，不改变资源曲线、时间轴 marker、模拟日志和贡献行原有 state point 选择语义。
- 结果定位后仍会切到 runtime applied 视角、显示 `结果定位` 日志筛选，并保持 5-8CY 的结果详情区展示。
- 本阶段没有新增 simulation 输出、保存 schema 或公式字段。

当前边界：

- 本阶段只打通“结果 -> 源动作 -> 属性面板”的选择链路。
- 尚未做自动滚动到属性面板、结果详情折叠、动作编辑后结果区的差异反馈或批量编辑体验。
- 不涉及最终公式、逐帧动作细节或游戏机制推断。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DA 目标：继续完善 Endaxis 式编辑闭环，优先让动作编辑后的结果区反馈更清楚，例如在结果详情区或动作结果行标记当前编辑动作、草稿变更状态和定位来源。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DA 结果区标记当前编辑动作

本轮完成：

- `Workbench` 将当前 `selectedActionId` 传入 `AnalysisPanel`。
- 动作结果行新增当前编辑动作标记：当 `entry.actionId === selectedActionId` 时，行上写入 `data-current-action="true"` 并显示“正在编辑”标签。
- 结果详情区新增同一状态标记：当详情对应当前编辑动作时，`workbench-action-result-detail-panel` 写入 `data-current-action="true"`，详情标题显示“正在编辑 · Delta ...”。
- Workbench 测试覆盖从等待动作切回 `action-0001` 结果定位后，结果行、结果详情、时间轴和属性面板都指向同一个动作上下文。

当前验证事实：

- 选中等待动作时，`action-0001` 的动作结果行不会误标为当前编辑。
- 点击 `action-0001` 动作结果后，结果行与结果详情都会标记“正在编辑”，属性面板也回到技能动作编辑态。
- 本阶段只复用 `selectedActionId` 前端状态，不新增 simulation 输出、保存 schema 或公式字段。

当前边界：

- 本阶段只补“当前编辑动作”的可见反馈。
- 尚未做草稿变更差异、编辑后结果重算前后对比、自动滚动或批量编辑反馈。
- 不涉及最终公式、逐帧动作细节或游戏机制推断。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DB 目标：继续改善动作编辑后的结果反馈，优先在结果详情或动作结果行展示草稿变更状态，让用户更清楚“当前结果来自当前草稿”还是“刚编辑过需要重新确认”。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DB 结果区展示草稿状态

本轮完成：

- `Workbench` 将既有 `draftStatus` 传入 `AnalysisPanel`，不新增保存字段。
- `AnalysisPanel` 将草稿状态归一为结果区短标签：`草稿已变更`、`草稿已保存`、`草稿已恢复`、`草稿已重置`、`草稿不可用`、`未保存草稿`。
- 当前编辑动作的动作结果行新增草稿状态标签，并写入 `data-draft-status` / `data-draft-dirty`。
- 结果详情区同样写入 `data-draft-status` / `data-draft-dirty`，标题摘要显示 `正在编辑 · 草稿已变更 · Delta ...` 这类状态。
- Workbench 测试覆盖编辑后 dirty 状态、保存后 saved 状态，以及结果行和结果详情区的同步更新。

当前验证事实：

- 新增等待动作后，草稿状态为 dirty，`action-0001` 结果行带 `data-draft-status="dirty"`。
- 点击 `action-0001` 动作结果后，当前编辑结果显示 `草稿已变更`。
- 保存草稿后，同一结果行更新为 `data-draft-status="saved"`，标签显示 `草稿已保存`。
- 本阶段只复用 `draftStatus` 前端状态，不新增 simulation 输出、保存 schema 或公式字段。

当前边界：

- 本阶段不建立独立的 result revision / action revision 模型。
- “草稿已变更”表示工作台草稿未保存，不表示模拟结果过期；当前模拟仍随响应式草稿实时刷新。
- 尚未做编辑字段级差异、编辑前后结果对比或自动定位变更来源。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DC 目标：继续改善动作编辑后的结果反馈，优先让动作字段变更后结果区明确提示“结果已随当前草稿刷新”，并为后续字段级变更来源留入口。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DC 结果区提示已随草稿刷新

本轮完成：

- `AnalysisPanel` 的草稿状态派生新增结果刷新状态：
  - dirty 草稿显示 `结果已随当前草稿刷新`。
  - saved 草稿显示 `结果来自已保存草稿`。
  - restored/reset/unavailable/unsaved 状态也有对应短标签。
- 动作结果行新增 `data-result-refresh-status`，当前编辑动作结果行显示刷新状态标签。
- 结果详情区同样新增 `data-result-refresh-status`，标题摘要现在可显示 `正在编辑 · 草稿已变更 · 结果已随当前草稿刷新 · Delta ...`。
- Workbench 测试覆盖 dirty -> saved 的刷新状态变化。

当前验证事实：

- 新建等待动作后，`action-0001` 结果行带 `data-result-refresh-status="current-draft"`。
- 点击 `action-0001` 动作结果后，当前编辑结果行显示 `结果已随当前草稿刷新`。
- 保存草稿后，同一结果行更新为 `data-result-refresh-status="saved-draft"`，标签显示 `结果来自已保存草稿`。
- 本阶段仍只复用 `draftStatus` 前端状态，不新增 result revision、action revision、simulation 输出或保存 schema。

当前边界：

- 本阶段没有做字段级变更来源或编辑前后数值差异。
- `结果已随当前草稿刷新` 只表达当前响应式模拟已经消费当前草稿，不代表最终公式已确认。
- 尚未做自动定位具体变更字段、结果对比或 undo/redo 反馈。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DD 目标：继续完善编辑反馈链路，优先在当前编辑动作附近提供最小字段变更来源入口，例如标记是开始时间、等级、动作形态或时长改变触发了结果刷新。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DD 结果区展示最近编辑字段来源

本轮完成：

- `Workbench` 新增前端 `actionEditSource` 状态，记录最近一次动作字段编辑来源。
- 属性面板编辑和时间轴编辑会记录最小字段来源，例如 `level -> 等级变更`、`startMs -> 开始时间变更`、`durationMs -> 时长变更`、`actionVariantIndex -> 动作形态变更`。
- `AnalysisPanel` 接入 `actionEditSource`，当前编辑动作的结果行和结果详情区新增字段来源 DOM 状态与标签。
- Workbench 测试覆盖编辑等级后，结果行和结果详情区都显示 `等级变更`。

当前验证事实：

- 选中 `action-0001` 但尚未编辑字段时，结果行 `data-edit-source-field=""`。
- 修改等级后，结果行写入 `data-edit-source-field="level"`、`data-edit-source-label="等级变更"`，并显示 `等级变更` 标签。
- 结果详情区同步 `data-edit-source-field="level"` 并显示 `等级变更`。
- 本阶段只记录最近一次动作字段编辑来源，不新增 result revision、action revision、simulation 输出或保存 schema。

当前边界：

- 本阶段不是完整字段级 diff 历史，只是最近编辑来源提示。
- 来源记录仅覆盖当前动作编辑入口和时间轴动作编辑入口；全局敌人/角色选择等非动作字段暂不纳入动作结果来源。
- 尚未做点击来源后聚焦属性控件、时间轴控件或字段级前后值对比。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DE 目标：继续完善编辑闭环，优先让字段来源标签能够反向定位到对应编辑控件或时间轴入口，减少用户看到来源后还要手动寻找控件的步骤。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DE 字段来源反向定位属性控件

本轮完成：

- `AnalysisPanel` 的最近编辑来源标签现在可点击，并向 Workbench 发出来源字段聚焦事件。
- `Workbench` 新增 `actionEditFocus` 前端状态，点击来源标签会选中来源动作并传递字段聚焦目标。
- `PropertiesPanel` 为技能、开始时间、等级/时长/资源变化/事件类型/目标角色、动作归属、动作形态、资源、原因、备注建立字段落点和高亮状态。
- `laneId` 会归一到动作归属控件，`damageSegmentIndex` 会归一到动作形态控件。
- Workbench 测试覆盖编辑等级后点击 `等级变更`，属性面板等级控件被标记为聚焦。

当前验证事实：

- 修改 `action-0001` 等级后，结果行仍显示 `data-edit-source-field="level"` 和 `等级变更`。
- 点击 `等级变更` 后，属性面板 `data-edit-field="level"` 控件写入 `data-edit-focused="true"` 并带 `edit-focused` 样式。
- 开始时间控件保持 `data-edit-focused="false"`，说明字段定位没有误落到其他控件。
- 本阶段只新增前端聚焦状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- 本阶段聚焦属性面板控件，不处理时间轴入口高亮。
- 仍不是完整字段 diff 历史，也不展示字段编辑前后值。
- 非动作字段，例如敌人配置和角色选择，暂不纳入动作结果来源定位。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DF 目标：继续完善编辑闭环，优先把来源反向定位扩展到时间轴入口高亮，或增加字段级前后值摘要，让结果定位更接近 Endaxis 的完整编辑体验。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DF 字段来源反向定位时间轴入口

本轮完成：

- `TimelineGridPreview` 接入 `actionEditFocus`，动作块现在可响应结果来源定位。
- 点击动作结果的最近编辑来源标签后，来源动作块会写入 `data-edit-focused`、`data-edit-focus-field`、`data-edit-focus-label`。
- 时间轴来源动作块新增 `edit-focused` 视觉状态，与属性面板来源高亮形成同一条定位链。
- Workbench 测试覆盖编辑等级后点击 `等级变更`，时间轴 `action-0001` 动作块同步标记为来源聚焦。

当前验证事实：

- 点击来源标签前，时间轴 `action-0001` 的 `data-edit-focused="false"`。
- 点击 `等级变更` 后，时间轴 `action-0001` 的 `data-edit-focused="true"`、`data-edit-focus-field="level"`、`data-edit-focus-label="等级变更"`。
- 来源动作块仍保持选中状态，同时新增 `edit-focused` 样式。
- 本阶段只新增前端聚焦状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- 本阶段高亮到时间轴动作块，不细分到动作块内的拖拽手柄、持续时间手柄或具体帧点。
- 仍不展示字段编辑前后值，也不做多步编辑历史。
- 非动作字段仍暂不纳入动作结果来源定位。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DG 目标：继续完善编辑闭环，优先为最近编辑来源补字段级前后值摘要，让用户能判断结果刷新来自哪个字段以及改动幅度。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DG 字段来源前后值摘要

本轮完成：

- `Workbench` 的 `actionEditSource` / `actionEditFocus` 新增前端派生摘要：`previousValue`、`nextValue`、`changeSummary`。
- 动作编辑、时间轴拖动、时长调整、跨轨移动现在会在记录最近编辑来源时同时记录字段前后值。
- `AnalysisPanel` 的结果行、来源标签和结果详情区新增 `data-edit-source-summary`，来源标签可显示类似 `等级变更 1 -> 2`。
- `PropertiesPanel` 的字段落点新增 `data-edit-focus-summary`。
- `TimelineGridPreview` 的动作块新增 `data-edit-focus-summary`。
- Workbench 测试覆盖等级从 `1 -> 2` 后，结果区、详情区、属性面板和时间轴动作块都能读到同一个摘要。

当前验证事实：

- 修改 `action-0001` 等级后，结果行写入 `data-edit-source-summary="1 -> 2"`。
- 来源标签显示 `等级变更 1 -> 2`，结果详情区也包含该摘要。
- 点击来源标签后，属性面板等级控件和时间轴来源动作块都写入 `data-edit-focus-summary="1 -> 2"`。
- 本阶段只新增前端派生状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- 本阶段只保留最近一次字段编辑摘要，不保留多步编辑历史。
- 摘要来自动作草稿字段变更，不代表三值公式差异归因。
- 动作形态、技能、角色等字段已能生成摘要，但仍是轻量显示文本，不是独立对比面板。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DH 目标：继续完善 Workbench 主流程编辑体验，优先把最近编辑摘要接入结果定位/对比的小面板或操作反馈区域，减少用户在结果、属性、时间轴之间来回确认的成本。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DH 最近编辑集中反馈条

本轮完成：

- `AnalysisPanel` 在“三值来源”区域顶部新增紧凑的最近编辑反馈条。
- 反馈条显示最近编辑动作、字段标签和前后值摘要，例如 `等级变更 1 -> 2`。
- 反馈条提供 `定位来源` 按钮，复用现有 `focus-action-edit-source` 事件，点击后同步定位属性面板控件和时间轴动作块。
- Workbench 测试覆盖反馈条 DOM 状态、摘要显示和按钮定位链路。

当前验证事实：

- 修改 `action-0001` 等级后，反馈条写入 `data-action-id="action-0001"`、`data-edit-source-field="level"`、`data-edit-source-summary="1 -> 2"`。
- 反馈条文本包含 `最近编辑` 和 `等级变更 1 -> 2`。
- 点击反馈条的 `定位来源` 后，属性面板等级控件和时间轴来源动作块都进入来源聚焦状态。
- 本阶段只新增前端反馈入口，不新增公式、simulation 输出或保存 schema。

当前边界：

- 本阶段不是多步编辑历史，只展示最近一次动作字段编辑。
- 反馈条不计算三值差异贡献，只承接已有动作编辑来源和结果刷新状态。
- 非动作字段仍暂不纳入该反馈条。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DI 目标：继续完善结果定位体验，优先把最近编辑反馈与贡献拆分或曲线选中状态联动，让用户从编辑摘要进一步跳到对应三值结果点。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DI 最近编辑联动三值结果点

本轮完成：

- 最近编辑反馈条新增 `定位结果` 按钮。
- `AnalysisPanel` 从既有 runtime trace 中为最近编辑动作派生首个 runtime state point。
- 点击 `定位结果` 会复用既有 `select-action-result` 链路，选中对应三值结果点，并带起曲线 selected 模式、贡献拆分和运行详情。
- Workbench 测试覆盖反馈条 runtime point DOM 状态、按钮可用性、贡献拆分和运行详情联动。

当前验证事实：

- 修改 `action-0001` 等级后，反馈条写入 `data-runtime-state-point-id` 和 `data-runtime-delta-count="1"`。
- `定位结果` 按钮携带同一个 `data-runtime-state-point-id`，且在有 runtime trace 时可点击。
- 点击 `定位结果` 后，状态曲线切到 selected 模式，动作贡献拆分面板定位到 `action-0001`。
- 运行详情的 state point 与反馈条携带的 runtime state point 一致。
- 本阶段只新增前端结果定位入口，不新增公式、simulation 输出或保存 schema。

当前边界：

- 本阶段使用该动作首个 runtime state point，不细分到每个字段变化对应的具体 delta。
- 不计算字段编辑导致的三值差异，只把最近编辑动作定位到已有三值结果点。
- 缺少 runtime trace 的动作会保留反馈条，但 `定位结果` 按钮不可用。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DJ 目标：继续完善结果定位体验，优先在最近编辑反馈条中标明当前结果定位状态，避免用户重复点击或不清楚是否已经选中对应三值结果点。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DJ 最近编辑结果定位状态

本轮完成：

- 最近编辑反馈条新增结果定位状态标签。
- `AnalysisPanel` 根据反馈条的 runtime state point 和当前 `selectedStateCurvePointId` 派生 `focused / available / unavailable` 三种状态。
- 反馈条新增 `data-result-focused`、`data-result-focus-status` DOM 状态。
- 当最近编辑对应的三值结果点已经被选中时，反馈条显示 `结果已定位`，`定位结果` 按钮变为 `结果已定位` 并禁用。
- Workbench 测试覆盖反馈条已定位状态、按钮禁用状态、贡献拆分和运行详情一致性。

当前验证事实：

- 在已通过动作结果行选中 `action-0001` runtime point 后，修改等级会让反馈条立即显示 `data-result-focused="true"`、`data-result-focus-status="focused"`。
- 状态标签显示 `结果已定位`。
- `定位结果` 按钮显示 `结果已定位`，且处于禁用状态。
- 动作贡献拆分仍定位到 `action-0001`，运行详情 state point 与反馈条 runtime state point 一致。
- 本阶段只新增前端定位状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- `focused` 只表示当前选中的 state point 与反馈条 runtime state point 一致。
- 本阶段不计算字段编辑导致的三值差异，也不追踪多步编辑历史。
- 缺少 runtime trace 的动作仍显示 `无结果点`，结果定位按钮不可用。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DK 目标：继续完善结果定位体验，优先让反馈条在用户选中其他结果点后清楚标记为未定位，并保留一键回到最近编辑结果点的路径。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DK 最近编辑结果回跳路径

本轮完成：

- Workbench 回归测试补齐“最近编辑结果已定位 -> 用户选中其他结果点 -> 反馈条变为未定位 -> 一键回跳最近编辑结果点”的完整路径。
- 通过新增资源动作制造第二个 runtime state point，验证反馈条不会被其他结果选择覆盖。
- 验证 `定位结果` 按钮在未定位状态下重新可用，并能回到最近编辑动作的三值结果点。

当前验证事实：

- 最近编辑反馈条在切到资源曲线的其他 state point 后，写入 `data-result-focused="false"`、`data-result-focus-status="available"`。
- 状态标签显示 `结果未定位`。
- `定位结果` 按钮恢复可用并显示 `定位结果`。
- 点击 `定位结果` 后，运行详情 state point 回到最近编辑反馈条携带的 runtime state point。
- 本阶段不新增产品状态字段，只补强既有前端派生状态的回归覆盖。

当前边界：

- 回跳仍使用最近编辑动作首个 runtime state point。
- 本阶段不新增多步编辑历史或字段到 delta 的精确归因。
- 非动作字段仍不进入最近编辑反馈链路。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DL 目标：继续完善 Workbench 主流程体验，优先减少分析面板里最近编辑反馈、动作结果行、贡献拆分之间的重复信息，并保留必要的定位入口。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DL 最近编辑摘要集中展示

本轮完成：

- `AnalysisPanel` 新增 `shouldShowActionResultEditSource()`，当最近编辑反馈条已经覆盖同一动作时，动作结果行不再重复显示编辑来源小标签。
- 结果详情标题在同一动作已由最近编辑反馈条覆盖时，不再重复拼接 `等级变更 1 -> 2`。
- 动作结果行和结果详情区仍保留 `data-edit-source-*` 状态，便于测试和后续定位逻辑使用。
- Workbench 测试更新为确认最近编辑摘要只由集中反馈条显示，结果行和详情标题不重复展示同一句摘要。

当前验证事实：

- 修改 `action-0001` 等级后，动作结果行仍写入 `data-edit-source-field="level"`、`data-edit-source-summary="1 -> 2"`。
- 同一动作的 `workbench-action-result-edit-source` 小标签不再渲染。
- 结果详情区仍保留 `data-edit-source-summary="1 -> 2"`，但详情标题文本不再重复 `等级变更 1 -> 2`。
- 最近编辑反馈条继续显示 `等级变更 1 -> 2`，并保留定位来源和定位结果入口。

当前边界：

- 本阶段只收敛最近编辑摘要重复展示，不调整三值来源、公式候选、贡献拆分内容。
- 动作结果行仍保留点击结果定位能力。
- 非动作字段仍不进入最近编辑反馈链路。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DM 目标：继续完善 Workbench 主流程体验，优先检查贡献拆分与运行详情之间是否还有可收敛的重复摘要或状态标签。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DM 分析内结果详情压缩

本轮完成：

- `AnalysisPanel` 内的 `workbench-action-result-detail-panel` 从完整详情表格收敛为紧凑定位摘要。
- 紧凑摘要只保留定位、Delta、累计、状态/结果状态四行，避免与独立 `RuntimeSelectedDetailPanel` 重复展示帧、轨道、状态、来源等完整明细。
- 结果详情面板新增 `data-detail-mode="compact"` 和 `data-full-detail-source="workbench-runtime-selected-detail"`，明确完整详情由右侧“三值详情”面板承接。
- Workbench 测试更新为确认紧凑摘要结构、结果点定位、贡献拆分和独立运行详情仍保持一致。

当前验证事实：

- 点击动作结果后，分析面板仍能定位到同一个 `statePointId` 和 `trackKey`。
- 紧凑摘要显示当前结果点的轨道、Delta、累计和状态结果。
- 独立“三值详情”继续展示完整运行明细、贡献行、计算器行和来源行。
- 本阶段只调整前端展示颗粒度，不新增公式、simulation 输出或保存 schema。

当前边界：

- 紧凑摘要不是新的数据来源，只是 `selectedRuntimeResultDetail` 的前端派生展示。
- 完整贡献拆分、calculator 来源和状态点信息仍以独立运行详情和贡献详情为准。
- 本阶段不处理曲线交互增强，也不补完整编辑器体验。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DN 目标：继续从“UI 还没完全对齐 Endaxis 的成品体验”这一阶段推进，优先补 Workbench 主流程里的曲线交互和结果定位细节，让用户从曲线点、运行日志、动作结果和贡献拆分之间更稳定地往返。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DN 资源曲线选中点摘要

本轮完成：

- `ResourceMonitorPanel` 在运行投影曲线下新增 `workbench-runtime-resource-chart-selection`。
- 选中三值曲线点后，资源面板就地展示选中点的定位、动作、Delta、累计和状态值。
- 选中点摘要复用已有 `selectedStateCurvePointId` 和 runtime curve source series，不新增 simulation 输出。
- 摘要区会标明当前定位来源：手动选择、动作结果定位或贡献拆分定位。
- Workbench 测试覆盖手动点击曲线点与动作结果定位两条路径，确认摘要、日志、曲线和独立三值详情使用同一个 state point。

当前验证事实：

- 点击运行资源曲线点后，摘要区写入同一个 `data-state-point-id`、`data-track-key` 和 `data-curve-mode`。
- 手动曲线点选择时，摘要区写入 `data-runtime-focus-source="manual"` 并显示 `手动选择`。
- 通过动作结果定位时，摘要区写入 `data-runtime-focus-source="action-result"` 并显示 `动作结果定位`。
- 摘要行固定为 `point`、`action`、`delta`、`cumulative`、`state`，用于主流程快速确认；完整计算器和来源明细仍在独立“三值详情”和日志详情中。
- 本阶段只调整前端展示和定位反馈，不新增公式、simulation 输出或保存 schema。

当前边界：

- 摘要区不提供编辑入口，只负责确认当前三值结果点。
- 暂未加入曲线点前后跳转或键盘导航增强。
- 暂未补完整编辑体验。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DO 目标：继续从 Workbench 主流程 UI 对齐 Endaxis 成品体验，优先补曲线点前后切换或结果定位的邻近点导航，让用户能在三值点之间快速巡检。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DO 资源曲线邻近点导航

本轮完成：

- `ResourceMonitorPanel` 的选中点摘要新增上一个/下一个三值点按钮。
- 邻近点按运行投影中的三值曲线点帧序排序，覆盖 HP、韧性和自身能量三条轨道。
- 摘要区新增当前巡检位置、总点数、前后 state point DOM 状态，便于测试和后续联动。
- 点击前后导航会复用既有 `select-runtime-state-point` 链路，同步曲线点、运行日志、时间轴 marker 和独立“三值详情”。
- Workbench 测试新增多 runtime point 场景，覆盖下一点和上一点往返巡检。

当前验证事实：

- 新增资源动作制造第二个 runtime point 后，摘要区写入 `data-navigation-count > 1`。
- 默认选中第一个点时，摘要区写入 `data-navigation-index="0"`。
- 点击下一点后，资源曲线选中点、运行日志选中行和独立“三值详情”都切到同一个 next state point。
- 点击上一点后，摘要区回到原 state point。
- 本阶段只新增前端导航和派生 DOM 状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- 邻近点导航暂不循环，首点无上一点，末点无下一点。
- 导航排序按帧、序列和轨道顺序处理，不等同于未来可能的用户自定义巡检顺序。
- 暂未从三值点摘要直接反向定位动作编辑控件。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DP 目标：继续对齐 Workbench 主流程体验，优先补从曲线点/三值详情反向定位对应动作和编辑控件的路径，让结果巡检能自然进入修轴。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DP 三值结果反向定位动作

本轮完成：

- `ResourceMonitorPanel` 的选中点摘要新增 `定位动作` 按钮。
- 按钮会从当前选中三值点提取 `actionId`，并发出 `focus-runtime-action`。
- `Workbench` 新增 `focusRuntimeAction()`，复用现有动作选择和 `actionEditFocus` 机制。
- 点击 `定位动作` 后，会选中对应时间轴动作，并把属性面板的开始时间字段作为修轴入口高亮。
- Workbench 测试覆盖“曲线点巡检 -> 定位动作 -> 时间轴动作选中 -> 属性面板开始时间高亮”的路径。

当前验证事实：

- 选中资源曲线点后，摘要区的 `workbench-runtime-resource-chart-selection-action-focus` 写入对应 `data-action-id` 和 `data-focus-field="startMs"`。
- 点击 `定位动作` 后，目标 `workbench-timeline-action` 进入 `selected` 和 `data-edit-focused="true"`。
- 时间轴动作写入 `data-edit-focus-field="startMs"`、`data-edit-focus-label="结果定位"`。
- 属性面板 `startMs` 控件写入 `data-edit-focused="true"`，摘要包含对应三值点和轨道。
- 本阶段只新增前端定位入口和派生焦点状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- 反向定位默认聚焦开始时间字段，暂未根据命中类型自动选择技能等级、形态或倍率字段。
- 暂未从独立“三值详情”面板单独提供反向定位按钮。
- 暂未做完整编辑器体验收口。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DQ 目标：继续完善 Workbench 主流程编辑体验，优先把反向定位动作后的编辑反馈和结果刷新状态串起来，让“定位动作 -> 修改字段 -> 结果回看”更顺滑。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DQ 结果定位编辑反馈闭环

本轮完成：

- `actionEditFocus` 增加前端派生的 runtime origin 信息，用于标记编辑动作是否来自三值结果定位。
- `recordActionEditSource()` 在编辑发生时会识别当前焦点是否来自 `runtime-focus`，并把原始 state point、轨道和帧写入最近编辑来源。
- `AnalysisPanel` 的最近编辑反馈条新增 `来自结果定位` 标签和 origin DOM 状态。
- 最近编辑反馈条继续保留刷新后 runtime state point，用户可以从改动反馈一键回到刷新后的结果点。
- Workbench 测试覆盖“曲线点巡检 -> 定位动作 -> 修改开始时间 -> 反馈条标记来源 -> 定位刷新后结果”的闭环。

当前验证事实：

- 通过资源曲线点 `定位动作` 后修改 `startMs`，反馈条写入 `data-edit-origin="runtime-focus"`。
- 反馈条写入原始 `data-origin-state-point-id` 和 `data-origin-track-key="enemyHpDamage"`。
- 反馈条显示 `来自结果定位`。
- 修改开始时间后，反馈条的 `data-runtime-state-point-id` 指向刷新后的结果点，且不同于原始 origin state point。
- 点击反馈条 `定位结果` 后，独立“三值详情”切到刷新后的 runtime state point。
- 本阶段只新增前端 origin/反馈状态，不新增公式、simulation 输出或保存 schema。

当前边界：

- 目前只在最近编辑反馈条展示 origin，不保留多步编辑历史。
- 反向定位后默认聚焦 `startMs`，尚未根据结果类型自动选择其他字段。
- 独立“三值详情”面板仍未提供单独编辑入口。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DR 目标：继续完善 Workbench 主流程编辑体验，优先补独立“三值详情”面板中的动作定位/编辑入口，让日志详情和曲线详情都能进入同一条修轴闭环。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DR 三值详情动作定位入口

本轮完成：

- `RuntimeSelectedDetailPanel` 标题区新增 `定位动作` 按钮。
- 按钮从当前 `runtimeSelectedDetail` 提取 `actionId`、`statePointId`、`trackKey` 和帧标签，并发出 `focus-runtime-action`。
- `Workbench` 复用阶段 5-8DP 的 `focusRuntimeAction()`，因此三值详情和资源曲线详情进入同一条修轴闭环。
- 点击三值详情的 `定位动作` 后，会选中对应时间轴动作，并把属性面板 `startMs` 控件作为修轴入口高亮。
- Workbench 测试覆盖“运行日志/三值详情 -> 定位动作 -> 修改开始时间 -> 反馈条标记来自结果定位”的路径。

当前验证事实：

- `workbench-runtime-selected-detail-action-focus` 写入当前 `data-action-id`、`data-state-point-id` 和 `data-focus-field="startMs"`。
- 点击按钮后，目标 `workbench-timeline-action` 进入选中和编辑焦点状态。
- 属性面板 `startMs` 控件进入 `data-edit-focused="true"`。
- 从三值详情入口修改 `startMs` 后，最近编辑反馈条继续写入 `data-edit-origin="runtime-focus"` 和原始 state point。
- 本阶段只新增前端入口和事件复用，不新增公式、simulation 输出或保存 schema。

当前边界：

- 三值详情入口默认聚焦开始时间字段，暂未根据命中类型自动选择其他字段。
- 暂未在事件日志详情块中单独放置动作定位按钮。
- 暂未做完整编辑器布局/批量编辑收口。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、39 条测试。
- `npm run test -- --run`：通过，13 个测试文件、113 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DS 目标：继续完善 Workbench 主流程编辑体验，优先补事件日志详情中的动作定位入口，确保日志、曲线、三值详情三处都能进入同一条修轴闭环。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DS 事件日志动作定位入口

本轮完成：

- `EventLogPanel` 的运行日志详情块新增 `定位动作` 按钮。
- 按钮从当前 `selectedRuntimeLog` / `runtimeSelectedDetail` 派生 `actionId`、`statePointId`、`trackKey` 和帧标签，并发出 `focus-runtime-action`。
- `Workbench` 继续复用 `focusRuntimeAction()`，因此事件日志、资源曲线和独立“三值详情”进入同一条修轴闭环。
- 点击事件日志详情的 `定位动作` 后，会选中对应时间轴动作，并把属性面板 `startMs` 控件作为修轴入口高亮。
- Workbench 测试新增独立用例，覆盖“事件日志详情 -> 定位动作 -> 修改开始时间 -> 反馈条标记来自结果定位”的路径。

当前验证事实：

- `workbench-runtime-sim-log-action-focus` 写入当前 `data-action-id`、`data-state-point-id` 和 `data-focus-field="startMs"`。
- 点击按钮后，目标 `workbench-timeline-action` 进入选中和编辑焦点状态。
- 属性面板 `startMs` 控件进入 `data-edit-focused="true"`。
- 从事件日志入口修改 `startMs` 后，最近编辑反馈条继续写入 `data-edit-origin="runtime-focus"` 和原始 state point。
- 本阶段只新增前端入口和事件复用，不新增公式、simulation 输出或保存 schema。

当前边界：

- 事件日志入口默认聚焦开始时间字段，暂未根据日志类型自动选择其他字段。
- 暂未做完整编辑器布局/批量编辑收口。
- 暂未做键盘快捷巡检。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DT 目标：继续完善 Workbench 主流程编辑体验，优先收敛属性面板内的编辑焦点提示与可操作控件，让修轴入口在视觉上更明确。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DT 属性面板编辑焦点提示

本轮完成：

- `PropertiesPanel` 的所有动作编辑控件新增 `data-edit-focus-label` 和 `data-edit-focus-origin`。
- 被 `actionEditFocus` 命中的控件会通过统一样式显示焦点标签和摘要，例如 `结果定位 · 三值点 0s0f · 敌人 HP`。
- runtime 结果定位来源会通过 `data-edit-focus-origin="runtime-focus"` 使用独立提示色，和普通字段来源聚焦区分。
- Workbench 测试补充三值详情入口和事件日志入口进入修轴后，属性面板 `startMs` 控件携带 `结果定位`、`runtime-focus` 和三值轨道摘要。

当前验证事实：

- 从三值详情 `定位动作` 后，属性面板 `startMs` 控件写入 `data-edit-focus-label="结果定位"`。
- 同一控件写入 `data-edit-focus-origin="runtime-focus"`。
- 同一控件 `data-edit-focus-summary` 包含 `敌人 HP`。
- 从事件日志详情 `定位动作` 后也能得到同一组属性面板焦点状态。
- 本阶段只新增前端 DOM 状态和样式提示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 焦点提示仍只展示最近一次焦点，不保留多步历史。
- 仍未根据日志/结果类型自动选择除 `startMs` 外的字段。
- 暂未做批量编辑或快捷键。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DU 目标：继续完善 Workbench 主流程编辑体验，优先补编辑后的结果回看提示，让用户修改字段后能更明确地区分原始结果点和刷新后结果点。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DU 编辑反馈结果点映射

本轮完成：

- `AnalysisPanel` 的最近编辑反馈条新增结果点映射区。
- 当最近编辑来自 runtime 结果定位时，反馈条显示 `原结果` 和 `刷新后` 两行。
- `原结果` 使用 `originStatePointId`、`originFrameLabel` 和 `originTrackKey`，帮助用户确认修改前来自哪个三值点。
- `刷新后` 使用当前 action 的刷新后 runtime state point 和结果定位状态，帮助用户确认 `定位结果` 按钮会跳到哪个点。
- Workbench 测试覆盖从资源曲线定位动作并修改 `startMs` 后，反馈条同时写入原始 state point 和刷新后 state point，且两者不同。

当前验证事实：

- 修改字段后，`workbench-action-edit-feedback-result-map` 写入 `data-origin-state-point-id` 和 `data-runtime-state-point-id`。
- 原始结果点行显示 `原结果` 和轨道摘要。
- 刷新后结果点行显示 `刷新后` 和当前定位状态。
- 原始结果点与刷新后结果点在 `startMs` 改动后不同。
- 本阶段只新增前端派生展示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 原始结果点只是编辑前来源标记，不保证在当前刷新后的 runtime projection 中仍可选中。
- 暂未增加原结果回放或历史快照。
- 暂未做批量编辑或快捷键。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DV 目标：继续完善 Workbench 主流程编辑体验，优先补刷新后结果点的回看状态在资源曲线选中点摘要中的同步提示。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DV 资源曲线同步刷新后结果状态

本轮完成：

- `Workbench` 新增最近编辑结果回看上下文，把最近一次来自 runtime 结果定位的动作编辑映射到当前刷新后的 runtime state point。
- `ResourceMonitorPanel` 接入该上下文，当资源曲线当前选中点等于刷新后结果点时，选中点摘要显示 `刷新后结果`。
- 资源曲线选中点摘要新增 DOM 状态，记录刷新后结果状态、动作 ID 和原始结果点 ID，方便后续继续联动详情、日志和编辑控件。
- Workbench 测试覆盖从资源曲线定位动作、修改 `startMs`、点击最近编辑反馈条 `定位结果` 后，资源曲线摘要同步切换为刷新后结果状态。

当前验证事实：

- 手动点击资源曲线点时，摘要来源仍显示 `手动选择`。
- 点击最近编辑反馈条 `定位结果` 后，资源曲线摘要写入 `data-result-context-status="refreshed-edit-result"`。
- 同一摘要写入原始 `data-result-context-origin-state-point-id` 和当前刷新后的 `data-state-point-id`。
- 本阶段只新增前端派生状态和 UI 提示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 刷新后结果状态只追踪最近一次来自 runtime 结果定位的动作编辑。
- 原始结果点仍只是来源标记，不保留历史投影快照。
- 暂未增加批量编辑、快捷键或跨面板自动滚动。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DW 目标：继续完善 Workbench 主流程编辑体验，优先压缩结果定位后的编辑路径，让资源曲线、三值详情、模拟日志和动作属性面板之间的当前编辑上下文更紧凑一致。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DW 结果定位编辑焦点同步回显

本轮完成：

- `Workbench` 将当前 `actionEditFocus` 传给三值详情和模拟日志。
- `RuntimeSelectedDetailPanel` 在当前三值点已经把编辑焦点同步到属性面板时，显示 `编辑焦点已同步` 状态。
- `EventLogPanel` 在当前日志详情对应同一编辑焦点时，显示同样的同步状态。
- 两个状态都写入 action ID、state point ID、编辑字段和同步状态，方便后续继续压缩跨面板编辑路径。
- Workbench 测试覆盖从三值详情和模拟日志分别点击 `定位动作` 后，属性面板、详情面板和日志详情共享同一编辑焦点状态。

当前验证事实：

- 点击三值详情 `定位动作` 前，三值详情不会显示编辑焦点同步状态。
- 点击三值详情 `定位动作` 后，三值详情写入 `data-edit-context-status="edit-focus-synced"`。
- 点击模拟日志 `定位动作` 前，日志详情不会显示编辑焦点同步状态。
- 点击模拟日志 `定位动作` 后，日志详情写入 `data-edit-context-status="edit-focus-synced"`。
- 本阶段只新增前端派生状态和 UI 提示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 同步状态只在 `runtime-focus` 来源、action 和 state point 均匹配时显示。
- 暂未增加跨面板自动滚动、批量编辑或快捷键。
- 暂未把该状态持久化为用户偏好或项目字段。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DX 目标：继续完善 Workbench 主流程编辑体验，优先补结果定位后的快捷回到当前编辑动作或当前结果点，让编辑、结果回看和日志定位之间的往返更少。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DX 属性面板结果回看快捷入口

本轮完成：

- `PropertiesPanel` 接入当前 `actionEditResultContext`，在结果定位后的动作编辑区显示 `结果回看` 入口。
- 入口在尚未修改字段时指向来源结果点，显示 `回到来源结果`。
- 入口在字段修改并刷新 runtime projection 后自动指向刷新后结果点，显示 `回到刷新后结果`。
- `Workbench` 新增属性面板回看事件处理，复用现有动作结果定位流程选中目标 runtime state point。
- Workbench 测试覆盖三值详情定位动作、属性面板回看来源结果、修改 `startMs` 后回看刷新后结果，并确认点击后选中刷新后的三值点。

当前验证事实：

- 未进入结果定位编辑时，属性面板不显示 `workbench-action-edit-result-return`。
- 点击三值详情 `定位动作` 后，属性面板显示 `data-return-status="origin-result"`。
- 修改 `startMs` 后，属性面板回看入口切换为 `data-return-status="refreshed-edit-result"`。
- 点击 `回到结果点` 后，三值详情选中刷新后的 runtime state point。
- 本阶段只新增前端派生状态和 UI 捷径，不新增公式、simulation 输出或保存 schema。

当前边界：

- 回看入口只在当前选中动作与 `runtime-focus` 编辑焦点匹配时显示。
- 来源结果点不保留历史快照；编辑后优先回到刷新后的当前 runtime state point。
- 暂未增加键盘快捷键或跨面板自动滚动。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DY 目标：继续完善 Workbench 主流程编辑体验，优先补结果回看后的当前动作/结果区域状态一致性，让用户能更少依赖手动筛选或滚动确认当前位置。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DY 动作结果当前位置同步提示

本轮完成：

- `AnalysisPanel` 的动作结果行新增当前位置同步状态。
- 当当前选中的 runtime state point 属于某条动作结果时，该动作结果行显示 `当前位置已同步`。
- 结果详情区同步写入同一状态，让用户从属性面板 `回到结果点` 后能直接确认结果区域已经对齐。
- Workbench 测试覆盖属性面板回看刷新后结果点后，动作结果行和结果详情区都显示当前位置同步状态。

当前验证事实：

- 回到刷新后结果点后，动作结果行写入 `data-result-location-status="selected-result"`。
- 同一动作结果行写入 `data-selected-state-point-id`，值为刷新后的 runtime state point。
- 结果详情区写入 `data-result-location-status="selected-result"` 和同一个 selected state point。
- 动作结果行与结果详情区都显示 `当前位置已同步`。
- 本阶段只新增前端派生状态和 UI 提示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 同步状态只说明当前选中的 runtime state point 已在结果区域对齐，不代表最终公式已确认。
- 暂未增加自动滚动到结果行或键盘快捷键。
- 暂未修改日志筛选、曲线筛选或项目保存结构。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8DZ 目标：继续完善 Workbench 主流程编辑体验，优先补当前结果定位后的筛选/导航反馈，让用户知道日志、曲线和结果面板是否正在围绕同一 state point 工作。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8DZ 模拟日志筛选导航同步提示

本轮完成：

- `EventLogPanel` 新增日志导航同步条，显示当前选中 runtime state point 与模拟日志筛选的关系。
- 当前 state point 在筛选内时显示 `日志已同步`，并展示当前筛选序号和全量日志序号。
- 当前 state point 被筛选隐藏时显示 `筛选外`，配合既有 `显示日志` 按钮帮助用户恢复定位。
- Workbench 测试覆盖属性面板回看刷新后结果点后的日志同步状态，以及 HP 点被能量筛选隐藏后再显示日志的 `filtered-out -> synced` 状态切换。

当前验证事实：

- 回到刷新后结果点后，模拟日志导航写入 `data-navigation-status="synced"`。
- HP state point 被能量日志筛选隐藏时，导航写入 `data-navigation-status="filtered-out"` 和 `data-navigation-index="-1"`。
- 点击 `显示日志` 后，导航切换为 `data-navigation-status="synced"`，并写入当前筛选 index。
- 本阶段只新增前端派生状态和 UI 提示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 日志导航状态只说明当前 state point 与模拟日志筛选/列表的关系，不代表最终公式已确认。
- 暂未新增自动滚动到日志行或键盘快捷键。
- 暂未修改曲线筛选、结果筛选或项目保存结构。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 阶段 5-8EA 目标：继续完善 Workbench 主流程编辑体验，优先梳理结果定位链路的最终一组紧凑状态，把重复标签压缩为更清楚的主路径提示。
- 仍保持 UI 主流程与框架体验优先，不扩展公式证据或数值推断。

### 2026-07-08：阶段 5-8EA 定位链路主路径摘要

本轮完成：

- `AnalysisPanel` 的最近编辑反馈条新增 `定位链路` 摘要。
- 摘要把当前动作、刷新后结果点、结果详情三个状态压缩成 `N/3已同步`。
- 摘要详情显示 `动作已选中 / 结果已定位 / 详情已同步` 等主路径状态，减少用户在多个标签之间来回判断。
- Workbench 测试覆盖属性面板回看刷新后结果点后，定位链路达到 `3/3已同步`。

当前验证事实：

- 完整回看刷新后结果点后，`workbench-action-edit-feedback-location-chain` 写入 `data-chain-status="synced"`。
- 同一摘要写入 `data-chain-synced-count="3"` 和 `data-chain-total-count="3"`。
- 动作、结果、详情三个同步布尔状态都为 `true`。
- 摘要文字包含 `3/3已同步`、`动作已选中`、`结果已定位`、`详情已同步`。
- 本阶段只新增前端派生状态和 UI 提示，不新增公式、simulation 输出或保存 schema。

当前边界：

- 定位链路摘要只覆盖最近编辑反馈条里的主路径，不替代模拟日志自己的筛选导航条。
- 暂未删除既有状态标签；下一步可继续压缩重复展示。
- 暂未新增键盘快捷键或自动滚动。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、40 条测试。
- `npm run test -- --run`：通过，13 个测试文件、114 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 后续不再继续 `5-8EB / 5-8EC` 这类微型状态标签阶段，改为按生成层、运行时层、UI 主流程三个大能力块推进。
- 下一能力块优先回到生成层和运行时层主干，先保证 `Action -> Hit -> ThreeValueDelta` 标准合同有清晰入口，再推进 runtime 稳定消费。

### 2026-07-08：生成层能力块 - 标准合同入口模块化

本阶段属于：生成层。

完成的可用能力：

- 新增 `src/simulation/generation/threeValueGenerationLayer.js` 作为 `Action -> Hit -> ThreeValueDelta` 标准生成层入口。
- `projectSimulationResult()` 不再在 projection 内部直接生成标准 delta，而是通过 `createThreeValueGenerationLayer()` 接入生成层模块。
- runtime applied delta 排序复用 generation 模块导出的 `compareThreeValueGenerationDeltas()`，为后续运行时层只消费标准合同铺路。
- 生成层模块独立暴露 `THREE_VALUE_DELTA_FIELDS` 和 `THREE_VALUE_DELTA_FIELD_BY_TRACK_KEY`，统一 HP / 韧性 / 自身能量三类 delta 字段。
- `AGENTS.md` 移除当前阶段流水，只保留长期路线边界和规则。

当前验证事实：

- 独立 generation 测试直接输入最小 state curve，生成标准 action、hit、delta 分组。
- 生成出的 delta 固定包含 `actionId`、`hitKey`、`trackKey`、`layerKey`、`delta`、`hpDelta/toughnessDelta/energyDelta`、`sourceIds`、`confidence` 和 calculator 信息。
- 既有 simulation 回归继续证明 runtime projection 的 `inputContractName` 为 `Action -> Hit -> ThreeValueDelta`，并且三值结果保持不变。
- 本阶段不新增保存字段，不追最终公式，不扩写 UI 状态提示。

验收结果：

- `npm run test -- --run src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，2 个测试文件、14 条测试。
- `npm run test -- --run`：通过，14 个测试文件、115 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 运行时层能力块：把 runtime projection 的 enemy curve、self energy curve、simLog 和 summary 进一步收束为只消费 generation layer applied deltas 的稳定模块，减少 projection 文件里的混合职责。
- UI 主流程暂不继续细抠状态标签，等运行时层边界更稳后再做 Endaxis 式完整流程体验。

### 2026-07-08：运行时层能力块 - Runtime Projection 入口模块化

本阶段属于：运行时层。

完成的可用能力：

- 新增 `src/simulation/runtime/threeValueRuntimeProjection.js` 作为 runtime projection 稳定入口。
- `projectSimulationResult()` 不再内联 runtime projection 的 enemy curve、self energy curve、simLog 和 summary 构建逻辑，而是调用 `createThreeValueRuntimeProjection()`。
- runtime 模块只消费 `threeValueGenerationLayer.deltas[]` 中 `applied = true` 的标准 delta。
- `createSelfEnergyDeltaSummaryByActor()` 从 projection 大文件移入 runtime 模块，让顶层 summary 继续从 runtime 输出派生。
- projection 层现在主要负责组装 scenario、actionResultTimeline、generation layer、runtime projection 和最终 summary，减少混合职责。

当前验证事实：

- 独立 runtime 测试直接输入包含 applied 与 candidate 的 generation layer，确认 runtime 只把 applied delta 写入曲线和 simLog。
- runtime 测试确认 enemy HP 剩余值、self energy actor 曲线、simLog、runtime summary 和 `selfEnergyDeltaByActor` 摘要都由标准 delta 派生。
- 既有 simulation 回归继续证明完整结果、generation layer 和 runtime projection 行为保持不变。
- 本阶段不新增保存字段，不追最终公式，不扩写 UI 状态提示。

验收结果：

- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js src/__tests__/simulation/threeValueGenerationLayer.test.js src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，3 个测试文件、15 条测试。
- `npm run test -- --run`：通过，15 个测试文件、116 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块：在现有 runtime/generation 边界稳定后，围绕“排轴动作编辑 -> 运行模拟 -> 资源曲线监控 -> 日志/详情查看 -> 回到动作修改”推进完整可用体验。
- 如果继续做运行时层，优先把 runtime module 的输入/输出边界文档化到架构说明，而不是补新的状态文案。

### 2026-07-08：UI 主流程能力块 - Workbench 主流程控制条

本阶段属于：UI 主流程。

完成的可用能力：

- 新增 `src/features/workbench/WorkbenchFlowPanel.vue`，在场景摘要和工作台网格之间提供主流程控制条。
- 控制条集中承接三条主路径：查看运行结果、编辑当前结果动作、回到最近编辑后的刷新结果。
- `Workbench.vue` 复用既有 `focusThreeValueCalculatorScope('runtime')`、`focusRuntimeAction()` 和 `returnRuntimeResultFromProperties()`，不新增平行状态。
- 主流程条读取 `selectedAction`、`threeValueRuntimeProjection`、`runtimeSelectedDetail` 和 `actionEditResultContext`，把动作编辑、运行结果、结果详情和回到编辑后的刷新点串成同一条链路。

当前验证事实：

- Workbench 初始渲染时，主流程条显示当前动作、runtime 日志数量，并禁用依赖当前结果或刷新结果的操作。
- 点击 `查看运行结果` 后，Workbench 进入 runtime applied 视角并选中首个 runtime state point。
- 点击 `编辑结果动作` 后，当前结果对应动作回到属性面板，编辑焦点来源为 `runtime-focus`。
- 修改动作开始时间后，主流程条能拿到刷新后的 runtime state point，并通过 `回到刷新结果` 回到新的结果点。
- 本阶段不新增保存字段，不改 simulation 输出，不追最终公式。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、41 条测试。
- `npm run test -- --run`：通过，15 个测试文件、117 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先补完整编辑体验的布局与操作闭环，例如把动作列表、时间轴、资源曲线、日志详情的焦点切换整理成更接近 Endaxis 的主工作区节奏。
- 避免回到单个标签、同步提示或文案映射的微阶段。

### 2026-07-08：UI 主流程能力块 - 运行结果前后导航

本阶段属于：UI 主流程。

完成的可用能力：

- `WorkbenchFlowPanel` 新增运行结果前后导航，直接基于 `threeValueRuntimeProjection.simLog` 和 runtime point 生成可浏览的 state point 列表。
- `Workbench.vue` 将 `selectedStateCurvePointId` 传入主流程条，并把 `select-runtime-state-point` 事件接回既有 `selectRuntimeStatePoint()`。
- 主流程条现在可在多个 applied runtime delta 间前后切换，同时保持资源曲线、三值详情和动作结果行使用同一个 runtime state point。
- 该能力复用 `createRuntimeStateCurvePointId()`，不新增平行 ID 规则或保存字段。

当前验证事实：

- 默认单结果场景下，主流程条显示 1 条运行结果，未选中时导航为 `-/1` 且前后按钮禁用。
- 添加资源动作后，runtime applied 结果增加到 2 条；点击主流程条的下一个/上一个按钮会切换 runtime detail 的 state point。
- 切换后的 state point 会继续驱动既有资源曲线和动作结果定位链路。
- 本阶段不新增保存字段，不改 simulation 输出，不追最终公式。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先处理布局节奏和完整编辑体验，例如把主流程条、时间轴、运行详情和属性面板的空间关系进一步整理为更接近 Endaxis 的工作台。
- 避免拆成单个状态提示阶段。

### 2026-07-08：UI 主流程能力块 - 运行结果同步当前动作

本阶段属于：UI 主流程。

完成的可用能力：

- 主流程条进入运行结果时，会把当前动作同步到首条 runtime 结果所属动作。
- 主流程条前后切换运行结果时，`Workbench` 会解析该 state point 对应的 runtime sim log，并同步选中该结果所属动作。
- 普通资源曲线和日志选点仍保留既有选择逻辑；本阶段只收束主流程条的巡检 -> 当前动作编辑上下文。
- 该能力复用既有 `selectedActionId`、`selectedStateCurvePointId` 和 runtime state point ID，不新增保存字段或平行焦点状态。

当前验证事实：

- 添加资源动作后，当前动作先停在新动作；点击主流程条 `查看运行结果` 后，当前动作同步回第一条 runtime 结果所属动作。
- 主流程条点击下一个 runtime 结果后，当前动作同步到第二条结果所属资源动作。
- 主流程条点击上一个 runtime 结果后，当前动作同步回第一条结果所属动作。
- 本阶段不新增公式证据、不改 simulation 输出、不扩写状态提示文案。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先整理工作区布局和完整编辑体验，让主流程条、时间轴、属性面板、资源曲线、日志和三值详情形成稳定的“巡检结果 -> 修改动作 -> 回看结果”操作节奏。
- 避免回到单个状态标签、同步提示或缺口说明阶段。

### 2026-07-08：UI 主流程能力块 - 时间轴下方资源监控区

本阶段属于：UI 主流程。

完成的可用能力：

- `ResourceMonitorPanel` 从右侧详情堆栈移动到时间轴下方的 `resource-area`。
- 工作台主区现在按“动作库 / 时间轴 / 资源曲线 / 日志 / 右侧编辑与详情”组织，资源曲线更接近 Endaxis 的时间轴下方结果监控位置。
- 右侧堆栈保留属性、敌人、三值详情和分析，减少资源曲线与详情面板混在一起的跳读。
- 本阶段不修改三值数据、simulation 输出或保存结构。

当前验证事实：

- 首屏 Workbench 中 `workbench-resource-area` 存在，并包含现有 `workbench-runtime-resource-monitor`。
- 原有运行投影、日志、曲线选点和主流程按钮测试继续通过。
- 本阶段不新增公式证据、不改候选数值、不扩写缺口说明。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先整理日志/详情在右侧和底部区域的工作节奏，让“资源曲线巡检 -> 日志详情 -> 属性修改 -> 回看结果”更接近 Endaxis 的连续操作。
- 避免回到单个状态标签或提示文案阶段。

### 2026-07-08：UI 主流程能力块 - 日志详情回看刷新结果

本阶段属于：UI 主流程。

完成的可用能力：

- `EventLogPanel` 接入 `actionEditResultContext`，事件日志详情能拿到当前动作编辑后的刷新结果点。
- 从日志详情点击 `定位动作`、修改动作后，日志详情直接提供 `回到结果点`，复用 Workbench 既有回看逻辑。
- 点击日志详情的回看入口后，运行详情、日志导航和当前 state point 会切到刷新后的 runtime state point。
- 本阶段不修改三值数据、simulation 输出、公式证据或项目保存结构。

当前验证事实：

- 事件日志详情定位动作后，属性面板编辑焦点仍为 `runtime-focus`。
- 修改开始时间后，日志详情出现刷新结果点回看入口，并携带来源 state point 与刷新后 state point。
- 点击该入口后，右侧三值详情和模拟日志导航都同步到刷新后的 state point。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先把三值详情面板也接入相同的回看闭环，让日志详情、资源曲线和三值详情都能完成“定位动作 -> 修改 -> 回看结果”。
- 避免回到单个状态提示、缺口说明或公式追证阶段。

### 2026-07-08：UI 主流程能力块 - 三值详情回看刷新结果

本阶段属于：UI 主流程。

完成的可用能力：

- `RuntimeSelectedDetailPanel` 接入 `actionEditResultContext`，三值详情面板能直接拿到当前动作编辑后的刷新结果点。
- 从三值详情点击 `定位动作`、修改动作后，三值详情面板直接提供 `回到结果点`，复用 Workbench 既有回看逻辑。
- 当旧 runtime state point 已随动作编辑失效时，三值详情面板保留一个轻量回看入口，不让用户失去从详情回到刷新结果的路径。
- 本阶段不修改三值数据、simulation 输出、公式证据或项目保存结构。

当前验证事实：

- 三值详情定位动作前不显示回看入口。
- 修改开始时间后，三值详情回看入口携带来源 state point 与刷新后 state point。
- 点击该入口后，右侧三值详情、动作结果行和模拟日志导航都同步到刷新后的 state point。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先整理资源曲线、日志详情和三值详情三处入口的共同工作节奏，减少重复但保留完整往返。
- 避免回到单个状态提示、缺口说明或公式追证阶段。

### 2026-07-08：UI 主流程能力块 - 统一回看上下文

本阶段属于：UI 主流程。

完成的可用能力：

- 新增 `runtimeResultReturnContext.js`，统一派生“来源结果 / 刷新后结果”的回看上下文。
- `PropertiesPanel`、`EventLogPanel`、`RuntimeSelectedDetailPanel` 改为复用同一个回看上下文 helper。
- 三处入口继续保留各自 UI，但“是否可回看、回看到哪个 state point、显示来源还是刷新后结果”的判断收束到同一处。
- 本阶段不修改三值数据、simulation 输出、公式证据或项目保存结构。

当前验证事实：

- 属性面板仍能显示来源结果和刷新后结果回看。
- 日志详情与三值详情仍能在动作修改后回到刷新后的 runtime state point。
- 既有 Workbench 主流程测试继续覆盖三处回看路径。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先评估资源曲线选择摘要、日志详情和三值详情是否可以在布局上进一步合并阅读路径，而不是继续增加状态文案。
- 避免回到单个状态提示、缺口说明或公式追证阶段。

### 2026-07-08：UI 主流程能力块 - 日志详情承接三值详情

本阶段属于：UI 主流程。

完成的可用能力：

- `EventLogPanel` 在 `runtime-selected-detail` 模式下不再重复渲染完整贡献、来源和适配器明细。
- 日志详情新增紧凑承接条，指向右侧 `RuntimeSelectedDetailPanel` 作为完整三值明细入口。
- `runtime-log-fallback` 模式仍保留完整日志内贡献、来源和适配器明细，保证未选中 runtime detail 时信息不丢。
- 本阶段不修改三值数据、simulation 输出、公式证据或项目保存结构。

当前验证事实：

- fallback 日志详情不显示承接条，仍保留贡献、来源和适配器行。
- 选中 runtime state point 后，日志详情 `data-detail-source="runtime-selected-detail"`，显示承接条并隐藏重复明细块。
- 右侧三值详情继续显示完整贡献、来源、适配器和回看入口。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，15 个测试文件、118 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 下一阶段转向生成层能力块，优先打通 `Action -> Hit -> ThreeValueDelta` 标准合同和统一生成入口。
- Evidence、公式证据和候选数值仅保留来源追溯与诊断字段，不作为下一阶段主目标。

### 2026-07-08：生成层能力块 - 标准 delta 生成入口

本阶段属于：生成层。

完成的可用能力：

- 新增 `threeValueDeltaGenerationInput.js`，把 `actionResultTimeline`、`candidateValueSeries`、`runtimeSampleContext` 和占位动作统一整理为 `Action -> Hit -> ThreeValueDelta` 的生成输入。
- `createThreeValueGenerationLayer()` 现在优先消费标准 generation input，再生成 `actions / hits / deltas / summary`；旧 `stateCurves` 仅作为兼容回退。
- `projectSimulationResult()` 改为把动作结果、候选值和采样上下文直接交给生成层，`threeValueCurveFramework` 继续作为展示/诊断曲线存在，不再是生成层唯一入口。
- runtime 投影仍只消费 `threeValueGenerationLayer.deltas` 中的 applied delta，本阶段不改变三值结果、不新增公式、不改变保存结构。

当前验证事实：

- 不经过 `stateCurves` 时，生成层也能从动作结果和候选 hit 值生成 applied / candidate / placeholder delta。
- 第一条真实数据垂直切片的三值数量、runtime 汇总和 simLog 继续保持可用。
- runtime projection 单测继续证明 runtime 只消费标准 generation deltas 中的 applied 部分。

验收结果：

- `npm run test -- --run src/__tests__/simulation/threeValueGenerationLayer.test.js`：通过，1 个测试文件、2 条测试。
- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js`：通过，1 个测试文件、13 条测试。
- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js`：通过，1 个测试文件、1 条测试。
- `npm run test -- --run`：通过，15 个测试文件、119 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- 下一阶段转向运行时层能力块，优先整理 runtime 对标准 delta 合同的消费边界，明确 `simLog`、敌人 HP/韧性曲线、自身能量曲线和 summary 的统一输出责任。
- 不继续追真实公式、真实倍率、单帧动作细节或候选数值平衡。

### 2026-07-08：运行时层能力块 - 标准 delta 消费边界

本阶段属于：运行时层。

完成的可用能力：

- 新增 `threeValueRuntimeInput.js`，把 `threeValueGenerationLayer.deltas` 归一化为 runtime 只消费的 applied delta 输入。
- `createThreeValueRuntimeProjection()` 现在从 `runtimeInput.appliedDeltas` 派生 `simLog`、敌人 HP/韧性状态、角色自身能量曲线和 summary。
- runtime 输出新增统一 `stateCurves` 与 `resourceCurves` 外壳，同时保留既有 `enemyStateCurve` 和 `selfEnergyCurveByActor` 字段，保证 Workbench 现有读取路径不被打断。
- 本阶段不修改三值计算公式、不改变 applied 三值结果、不扩大 UI 信息量。

当前验证事实：

- candidate delta 会被 runtime input 记录为 ignored，不进入 `simLog` 和 runtime 曲线。
- `runtimeInput` 记录输入合同、applied/ignored 数量和 applied track/layer。
- `stateCurves` 汇总敌人 HP/韧性与资源曲线，`resourceCurves.curvesByActor` 与既有 `selfEnergyCurveByActor` 保持同源。

验收结果：

- `npm run test -- --run src/__tests__/simulation/threeValueRuntimeProjection.test.js`：通过，1 个测试文件、1 条测试。
- `npm run test -- --run src/__tests__/simulation/firstVerticalSliceSimulation.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、55 条测试。

下一步：

- 下一阶段转向 UI 主流程能力块，优先把 Workbench 的“编辑动作 -> 运行模拟 -> 曲线监控 -> 日志/详情 -> 回到动作修改”串成更完整的 Endaxis 式操作闭环。
- 不再新增单个状态标签、同步提示、缺口说明或公式追证阶段。

### 2026-07-08：UI 主流程能力块 - runtime 点位统一入口

本阶段属于：UI 主流程。

完成的可用能力：

- 新增 `runtimeProjectionPoints.js`，把 Workbench 内部 runtime point 查找统一到 `stateCurves.enemy` 与 `resourceCurves.curvesByActor`，旧 `enemyStateCurve` / `selfEnergyCurveByActor` 只作为回退。
- `WorkbenchFlowPanel`、`ResourceMonitorPanel`、`RuntimeSelectedDetail`、`EventLogPanel`、`AnalysisPanel` 和 Workbench 顶层定位逻辑改为复用同一入口。
- 顶部主流程导航、资源曲线、日志详情、分析追踪和右侧三值详情现在都从 runtime 标准输出寻找同一批 state point。
- 本阶段不修改三值数据、runtime 计算、保存结构或可见 UI 信息量。

当前验证事实：

- helper 单测确认新 `stateCurves/resourceCurves` 优先，旧字段仍可回退。
- Workbench 主流程测试继续覆盖运行结果打开、曲线选点、日志详情、三值详情和回到动作修改。

验收结果：

- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js src/__tests__/views/Workbench.test.js`：通过，2 个测试文件、43 条测试。
- `npm run test -- --run`：通过，16 个测试文件、120 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先评估动作编辑区、运行曲线区、日志区和右侧详情区之间的操作顺序是否还需要进一步收束。
- 不回到单个状态标签、同步提示、缺口说明或公式追证阶段。

### 2026-07-08：UI 主流程能力块 - 当前动作优先打开运行结果

本阶段属于：UI 主流程。

完成的可用能力：

- `WorkbenchFlowPanel` 的 `查看运行结果` 现在优先打开当前选中动作对应的第一个 runtime state point。
- 当前动作没有 runtime 结果时，仍回退到全局第一个 runtime state point，保留原有兜底行为。
- 主流程导航仍可在相邻 runtime 点之间前后切换，并同步选中对应动作。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- 追加资源动作并选中该动作后，点击 `查看运行结果` 会直接定位到资源动作的 runtime 点，而不是跳回第一个动作。
- 从第二个 runtime 点可向前导航到第一个动作结果，再向后返回第二个动作结果。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、42 条测试。
- `npm run test -- --run`：通过，16 个测试文件、120 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先评估“无 runtime 结果动作”的编辑与回看体验是否需要更清晰的主流程承接。
- 不回到单个状态标签、同步提示、缺口说明或公式追证阶段。

### 2026-07-08：UI 主流程能力块 - 无结果动作进入运行总览

本阶段属于：UI 主流程。

完成的可用能力：

- `查看运行结果` 在当前动作没有 runtime state point 时，不再强行跳到其他动作的第一个结果点。
- 当前动作无 runtime 结果时，Workbench 会进入 runtime 视角总览，保留当前动作选择，并清空 runtime detail 选中态。
- 当前动作有 runtime 结果时，仍优先定位该动作的第一个 runtime state point。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- 选中等待动作后点击 `查看运行结果`，时间轴仍保持等待动作选中。
- runtime 导航显示可用结果总数，但当前 runtime detail 为空，不误选其他动作结果。
- 当前动作有结果的主流程测试仍继续通过。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、43 条测试。
- `npm run test -- --run`：通过，16 个测试文件、121 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先评估主流程总览是否需要承接到批量结果巡检，而不是回到单个提示标签。
- 不回到公式追证、候选数值平衡或单帧动作细节阶段。

### 2026-07-08：UI 主流程能力块 - 运行总览结果巡检入口

本阶段属于：UI 主流程。

完成的可用能力：

- `WorkbenchFlowPanel` 新增 runtime 总览态识别，只有进入 runtime 总览且未选中具体结果点时启用总览巡检入口。
- 总览态下，主流程的下一结果按钮可进入第一个 runtime state point，上一结果按钮可进入最后一个 runtime state point。
- 初始未进入 runtime 总览时仍不自动启用巡检按钮，避免打断普通编辑状态。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- 等待动作进入 runtime 总览后保持等待动作选中，且可通过主流程下一结果按钮进入第一条 runtime 结果。
- 进入具体结果后，主流程恢复普通前后导航，并同步选中结果动作。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、43 条测试。
- `npm run test -- --run`：通过，16 个测试文件、121 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先评估结果巡检后的批量编辑路径，而不是继续增加局部提示。
- 不回到公式追证、候选数值平衡或单帧动作细节阶段。

### 2026-07-08：UI 主流程能力块 - 编辑后回到同类运行结果

本阶段属于：UI 主流程。

完成的可用能力：

- 从运行结果进入动作编辑后，刷新结果定位会优先回到来源曲线类型，避免一个动作同时产生 HP、韧性、能量结果时回到错误结果点。
- `Workbench` 的主流程回跳改为复用统一 runtime 点查找规则，资源/能量结果编辑后也能回到刷新后的对应结果。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- 同一动作同时有 HP 和自身能量结果时，带来源曲线偏好的查找会优先返回自身能量结果，偏好不存在时回退到该动作第一个 runtime 点。
- 从资源动作的自身能量结果进入编辑，修改开始时间后可回到刷新后的自身能量结果。

验收结果：

- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js`：通过，1 个测试文件、2 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、44 条测试。
- `npm run test -- --run`：通过，16 个测试文件、123 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先做“结果巡检后的动作修改与再次模拟”完整循环，而不是增加局部状态提示。
- 不回到公式追证、候选数值平衡或单帧动作细节阶段。

### 2026-07-08：UI 主流程能力块 - 再次模拟后巡检顺序刷新

本阶段属于：UI 主流程。

完成的可用能力：

- runtime 结果点上下文抽为统一入口，Workbench 首点选择、结果反查和主流程前后巡检使用同一套按帧序排序的 runtime state point。
- 从运行结果进入动作编辑并修改时间后，模拟结果重新计算，回到刷新结果时会落在新的巡检顺序位置。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- runtime `simLog` 输入即使不是按时间顺序排列，统一入口也会按帧序生成巡检点。
- 两个 runtime 结果中，把第一个动作推迟到第二个动作之后，再回到刷新结果，主流程导航位置会从第 1 项变为第 2 项。

验收结果：

- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js`：通过，1 个测试文件、3 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、45 条测试。
- `npm run test -- --run`：通过，16 个测试文件、125 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先做“资源曲线/日志详情到动作编辑再回到结果”的跨面板闭环统一。
- 不回到公式追证、候选数值平衡或单帧动作细节阶段。

### 2026-07-08：UI 主流程能力块 - 跨面板结果回跳统一

本阶段属于：UI 主流程。

完成的可用能力：

- 日志详情和资源曲线都改为消费统一 runtime state point context，选中点、详情、前后巡检和回到刷新结果使用同一套 `statePointId` 与排序语义。
- 从模拟日志进入动作编辑后，即使再次模拟导致日志顺序变化，日志面板仍能保留回到刷新后结果的主流程入口。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- 从模拟日志第一条结果进入编辑，把动作推迟到第二个结果之后，再回到刷新结果，日志导航和资源曲线导航都会落在新的第 2 项。
- 既有“日志详情定位动作”和“资源曲线点定位详情/动作”链路继续通过。

验收结果：

- `npm run test -- --run src/__tests__/features/runtimeProjectionPoints.test.js`：通过，1 个测试文件、3 条测试。
- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、46 条测试。
- `npm run test -- --run`：通过，16 个测试文件、126 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先把 Action Result / 贡献拆分里的 runtime trace 也收敛到统一 runtime state point context。
- 不回到公式追证、候选数值平衡或单帧动作细节阶段。

### 2026-07-08：UI 主流程能力块 - Action Result trace 统一

本阶段属于：UI 主流程。

完成的可用能力：

- Action Result 行和贡献拆分改为消费统一 runtime state point context，不再在 `AnalysisPanel` 内重复拼接 runtime state point id。
- 最近编辑反馈优先使用 Workbench 的刷新后结果上下文，和主流程、日志、资源曲线指向同一个刷新后结果点。
- 本阶段不修改三值数据、runtime 计算、保存结构或 UI 信息量。

当前验证事实：

- 从模拟日志进入编辑并触发再次模拟后，Action Result 行、贡献拆分行、贡献详情、日志导航、资源曲线和最近编辑反馈都会指向同一个刷新后结果点。
- 既有 Action Result / 贡献拆分定位链路继续通过。

验收结果：

- `npm run test -- --run src/__tests__/views/Workbench.test.js`：通过，1 个测试文件、46 条测试。
- `npm run test -- --run`：通过，16 个测试文件、126 条测试。
- `npm run build`：通过；仍有既有 Sass `@import` 弃用警告和 chunk 体积警告。

下一步：

- UI 主流程能力块继续推进时，优先做主流程编辑体验的完整性检查，确认动作编辑、运行巡检、日志/曲线/贡献详情之间没有剩余本地结果点拼接。
- 不回到公式追证、候选数值平衡或单帧动作细节阶段。

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
