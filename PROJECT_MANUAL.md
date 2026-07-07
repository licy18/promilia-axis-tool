# promilia-axis-tool 项目手册

最后更新：2026-07-07

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
- `npm run test -- --run`：通过；12 个测试文件、104 条测试通过。

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

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
