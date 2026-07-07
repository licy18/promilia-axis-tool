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
- `npm run test -- --run`：通过；7 个测试文件、40 条测试通过。

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

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
