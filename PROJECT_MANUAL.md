# promilia-axis-tool 项目手册

最后更新：2026-07-07

当前策略是以 Endaxis 为架构和交互参考，对 `promilia-axis-tool` 进行从头重构；旧实现只保留为功能原型和迁移参考。完整任务拆解见 `DEVELOPMENT_PLAN.md`，本文件保留最终目标、阶段目标、项目状态和当前事实。

## 1. 项目目标

`promilia-axis-tool` 是面向《蓝色星原》的战斗排轴工具。核心目标不是做普通资料站，而是让用户能够把角色、技能、敌人、资源、Buff、异常状态和伤害时点放到同一条时间轴上，形成可编辑、可验证、可分享的战斗轴。

当前目标参考项目是 `Endaxis`，路径为：

```text
C:\Codex\AzPr Axis\Endaxis
```

Endaxis 用于参考成熟排轴工具的架构分层、交互密度、数据访问方式和模拟运行时组织方式。它的数据和游戏机制不应直接作为蓝色星原数据源。

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
- `npm run test -- --run`：通过；10 个测试文件、61 条测试通过。

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

| 数据域 | 可用情况 | 主要来源 |
| --- | --- | --- |
| 角色基础资料 | 有；`hero.json` 有 23 行，其中 20 个可用角色，含女/男星临者和诺诺，另有 3 个不可用测试承载 | `Assets/ResourcesAssets/Config/NewTable/hero.json`、`Assets/ResourcesLang/chs/Table/lang_hero.json` |
| 角色整理模块 | 有；`local-all` 中有 20 个角色模块 JSON，含基础资料、图标、职业/元素解析、`skillSystem`、语音等 | `BWiki/data/hero-modules/local-all` |
| BWiki 角色表单 | 有；19 个表单，星临者合并为一个表单 | `BWiki/data/local-role-forms` |
| 技能文本与倍率 | 有；技能名、图标、描述模板、等级倍率、显示 CD/SP 可取 | `skill.json`、`skill_level.json`、`lang_skill.json`、`lang_skill_level.json`、角色模块 `skillSystem` |
| 元素系统 | 有；10 个元素，含颜色、图标、克制关系 | `BWiki/data/local-element-system/element-system.local.json` |
| 奇波 | 有；122 个主体，含元素、特性、技能描述和技能图标 | `BWiki/data/local-kibo-forms/all.local-kibo-forms.json` |
| 装备 | 有；137 个开放装备，43 个未开放条目；覆盖武器、上装、下装、耳环、戒指 | `BWiki/data/local-accessory-forms/all.local-accessory-forms.json` |
| 灵子 | 有；62 个整理表，含基础属性、技能描述、满星描述、相关角色 | `BWiki/data/local-soulessence-forms/all.local-soulessence-forms.json` |
| 敌人 | 部分有；`enemy.json` 有 208 个可用敌人，含名称、元素、技能列表、单位/属性 ID | `enemy.json`、`lang_enemy.json`、`unit_property.json`、`template_value.json` |
| 属性枚举与基础属性 | 有，但需要写映射器；属性 ID 可通过 `battle_info.json` 解释，具体值在 `template_value.json` 等表中 | `battle_info.json`、`template_value.json`、`template_hero.json`、`template_herolevel.json` |
| 图片资源 | 有相当一部分；BWiki 知识库媒体目录已发现技能、元素、奇波、装备图标样例，共约 3060 个图片文件 | `BWiki/knowledge/media/images` |

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

| 优先级 | 问题 | 影响 | 建议处理 |
| --- | --- | --- | --- |
| P0 | `actions` 与 `skillBlocks` 并存 | 统计、验证、显示可能不一致 | 建立统一 adapter 或迁移到 `actions` |
| P0 | 当前 `gamedata.json` 仍是原型/占位数据 | 角色、敌人、奇波、装备无法支撑真实排轴 | 建立本地 AzPr 数据生成器 |
| P0 | 旧实现质量不足以作为最终架构地基 | 继续修补会放大模型分叉和 UI/逻辑耦合 | 新架构优先，旧实现仅作功能迁移参考 |
| P0 | 精确技能帧数据缺失 | 无法直接实现真实命中帧、动作时长、取消窗口 | 另找技能 asset、运行捕获或建立人工标注层 |
| P1 | Boss 事件 store action 缺失 | 相关 UI 操作会报错 | 补齐 store 方法 |
| P1 | `ResourceMonitor.vue` 错把角色 ID 数组当对象数组 | 资源图显示不可靠 | 从 gamedata 按 ID 解析 |
| P1 | 数据层仍集中在单个 JSON | 维护复杂、难以测试 | 引入数据访问层 |
| P2 | 图片/Markdown 导出未完成 | 分享体验不足 | 阶段 6 补全 |
| P2 | 组件和工具函数存在重复计算逻辑 | 后续机制扩展风险高 | 拆 runtime 后收敛 |

## 9. 阶段进度记录

### 2026-07-07：阶段 1 最小数据管线落地

本轮完成：

- 新增 `scripts/generate-azpr-data.mjs`，默认从 `C:\PC2\Codex\AzPr` 读取本地 AzPr 数据。
- 新增 `npm run data:generate`。
- 新增生成输出目录 `src/data/generated/`。
- 新增访问层 `src/data/azprGenerated.js`。
- 新增数据测试 `src/__tests__/data/azprGenerated.test.js`。

已生成数据：

| 数据域 | 数量 | 输出文件 |
| --- | ---: | --- |
| 属性枚举 | 184 | `src/data/generated/attributes.json` |
| 元素 | 10 | `src/data/generated/elements.json` |
| 角色 | 20 | `src/data/generated/characters.json` |
| 技能 | 120 | `src/data/generated/skills.json` |
| 敌人 | 208 | `src/data/generated/enemies.json` |
| 奇波 | 122 | `src/data/generated/kibos.json` |
| 装备 | 137 | `src/data/generated/equipment.json` |
| 灵子 | 62 | `src/data/generated/soulessences.json` |
| 图片索引 | 3059 | `src/data/generated/media-index.json` |
| 首条垂直切片快照 | 1 | `src/data/generated/first-vertical-slice.json` |
| 工作台轻量数据 | 20 角色 / 120 技能 / 199 敌人 | `src/data/generated/workbench-seed.json` |

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
- 当前伤害为“原始攻击 * 技能倍率”的低置信度投影，只用于打通运行时结构，不代表最终 AzPr 精确公式。
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

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
