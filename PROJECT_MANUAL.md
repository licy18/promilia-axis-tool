# promilia-axis-tool 项目手册

最后更新：2026-07-10

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
- `npm run test -- --run`：通过；41 个测试文件、312 条测试通过。
- `npm run test:e2e:workbench-flow`：通过；25 条 Workbench 浏览器主流程通过。

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

本节从 2026-07-10 起改为高层阶段总结，不再记录每个小按钮、小标签、小测试或内部抽象阶段。详细字段结构变化继续放在 `DATA_STRUCTURE_CHANGES.md`；长期协作规则继续放在 `AGENTS.md`。

### 当前高层状态：Workbench 主流程 demo 可试用

截至 2026-07-10，Workbench 已具备一条可演示、可测试的主流程闭环：

- 排轴动作编辑：动作列表、动作库、时间轴、属性面板和 60fps 帧输入可编辑当前动作。
- 运行模拟：当前动作轴可编译为 runtime outputs，并输出 sim log、state curves、resource curves 和 summary。
- 结果复核：资源曲线、日志、三值详情、贡献拆分和动作结果来源行可以互相定位。
- 回改刷新：从结果点回到动作编辑后，修改帧/时间/动作内容可生成刷新结果，并返回新结果定位。
- 连续排轴：支持插入后续动作、复制/删除动作、批次复制/位移/删除、撤销/重做、键盘快捷操作、窄屏主流程守门。
- 数据/机制边界：已建立 `Action -> Hit -> ThreeValueDelta` 生成层、运行时层和 Workbench 消费层的标准入口与边界摘要；真实公式、倍率和平衡仍不作为当前主目标。

P0 验证结论：当前状态可以作为“Workbench 主流程 demo”给用户试用，但仍不是完整 Endaxis 对标版本。主要缺口在项目导入/导出/分享闭环、角色/敌人/装备配置闭环，以及后续 AzPr 真实机制 adapter。

### P0 收口验证（2026-07-10）

已完成验证：

- `npm run test -- --run`：通过，39 个测试文件、289 条测试。
- `npm run build`：通过；仅保留 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，23 条 `@workbench-main-flow` 浏览器主流程回归。

当前已知 P0 备注：

- `PROJECT_MANUAL.md` 已从小阶段流水改为高层摘要；后续阶段只记录能力块、验证结果和下一步。
- 不再继续以“补一个 Workbench 小按钮/小状态/小提示”为阶段目标。
- 下一个产品能力块优先进入 P1：项目级 JSON 导入/导出闭环。

### P1-A JSON 导入/导出闭环（2026-07-10）

已完成能力：

- Workbench 可以把当前排轴项目导出为版本化 JSON 文件，文件类型为 `workbench-project`。
- 导出的 JSON 复用版本化 Workbench 草稿主体结构，包含选择、敌人配置、动作轴、当前选中动作和批次/动作字段。
- Workbench 可以从 JSON 文件导入项目，恢复选择、敌人配置、动作轴和当前选中动作，并写回当前草稿。
- 导入后可以重新运行模拟，恢复曲线、日志、三值详情和 runtime summary。

已完成验证：

- `npm run test -- src/__tests__/domain/workbenchDraftStorage.test.js`：通过，4 条测试。
- `npm run test:e2e:workbench-flow -- --grep "exports and imports"`：通过，真实浏览器导出/导入闭环。

### P1-B 项目分享链接闭环（2026-07-10）

已完成能力：

- Workbench 可以把当前项目生成 URL 分享链接，链接内携带同一份 `workbench-project` 快照。
- 打开分享链接会恢复选择、敌人配置、动作轴和当前选中动作，并写回当前草稿。
- 从分享链接恢复后可以继续进入运行模拟，查看曲线、日志、三值详情和 runtime summary。

已完成验证：

- `npm run test -- src/__tests__/domain/workbenchDraftStorage.test.js`：通过，6 条测试，覆盖分享码 round-trip 和非法分享码拒绝。
- `npm run test:e2e:workbench-flow -- --grep "shares and imports"`：通过，真实浏览器生成分享链接、重置、从 URL 恢复项目并重新运行模拟。
- `npm run test -- --run`：通过，40 个测试文件、295 条测试。
- `npm run build`：通过；仅保留 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 `@workbench-main-flow` 浏览器主流程回归。

### P2-A 参战角色与培养配置闭环（2026-07-10）

已完成能力：

- 两名参战角色可以分别配置真实 AzPr 奇波、武器、上装、下装、耳环、戒指和魂灵；角色、敌人和当前数值面板继续作为模拟输入。
- 培养配置进入 `actors[].loadout`、`project.loadouts`、草稿、JSON 项目和分享链接，并随保存、导入、重置、撤销/重做恢复。
- Workbench 明确区分“模拟生效”与“项目记录（待接公式）”；本阶段不改变 HP、韧性、自身能量公式和结果。
- Workbench 草稿升级为 v2，并兼容迁移 v1 本地草稿、项目文件和分享快照。

已完成验证：

- `npm run test -- --run`：通过，41 个测试文件、299 条测试，覆盖真实培养项投影、槽位校验、v1 迁移和保存恢复。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条浏览器主流程；其中 JSON 项目路径覆盖培养配置导出、重置、导入恢复和重新运行模拟。

### P2-B 敌人真实韧性基线闭环（2026-07-10）

已完成能力：

- Workbench 敌人数据源切到完整生成表；默认从 `WEAKNESS_POINT_MAX` 读取蓝色星原敌人韧性上限。
- 用户可以配置韧性倍率与初始韧性百分比；配置进入项目、草稿、JSON 和分享快照，并实际决定运行时韧性曲线的初始值、上限和剩余值。
- 草稿升级为 v3，继续迁移 v1/v2；缺少 `WEAKNESS_POINT_MAX` 的敌人保持“韧性基线缺失”，不会伪造默认数值。
- 本阶段只确认敌人韧性状态基线，不改变当前削韧 delta 公式及其证据边界。

已完成验证：

- 领域、编译器、运行时、草稿和 Workbench 针对性测试通过，覆盖真实表值、倍率/初始比例、剩余韧性、v1/v2 迁移和保存恢复。
- JSON 浏览器主流程通过，覆盖切换敌人、修改韧性配置、导出、重置、导入恢复和重新运行模拟。
- `npm run test -- --run`：通过，41 个测试文件、304 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程。

### P2-C 敌人元素伤害减免配置闭环（2026-07-10）

已完成能力：

- Workbench 把完整敌人表的无、火、风、地、木、冰、水、雷、光、暗 10 项 `*_DEFENSE` 映射为项目配置；198 个敌人具有完整字段，另外 10 个敌人保持表值缺失。
- 敌人面板同时显示实际表值与项目覆盖值；覆盖值进入项目模型、草稿、JSON 项目和分享链接，并可在重置后通过导入恢复。
- 编译后的敌人数据保留 `baseValue`、`overrideValue`、`effectiveValue` 和来源状态，供后续 P3 机制 adapter 消费。
- 草稿升级为 v4 并迁移 v1/v2/v3；当前导出的实际表值全部为 `0`，本阶段不推断额外抗性，也不让覆盖值参与现有伤害公式。

已完成验证：

- `npm run test -- --run`：通过，41 个测试文件、308 条测试，覆盖字段/值校验、表值与覆盖值编译、v3 到 v4 迁移和 Workbench 保存。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程；JSON 项目路径覆盖抗性覆盖值的导出、重置和导入恢复。

### P2-D 项目队伍槽位闭环（2026-07-10）

已完成能力：

- Workbench 建立两个稳定的项目队伍槽位 `team-slot-1` / `team-slot-2`，可从 20 名真实 AzPr 角色中选择参战角色；旧“主角色/副角色”只保留为兼容镜像。
- 角色替换会重建对应 actor、清理不适用于新角色的培养配置，并把技能、资源和切换动作重绑定到该槽位的新角色；选择另一槽位已有角色时会交换两个槽位。
- 项目模型输出 `project.team.slots`，编译场景输出带 `actorId` / `actorName` 的 `scenario.team.slots`，队伍不再只存在于 UI selection。
- 草稿升级为 v5；队伍槽位、角色配置和动作归属随草稿、JSON、分享链接、撤销/重做和重置流程保持一致，并兼容迁移 v1-v4。

已完成验证：

- `npm run test -- --run`：通过，41 个测试文件、312 条测试，覆盖槽位规范化、项目/场景投影、动作归属、v4 到 v5 迁移和分享 round-trip。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程；JSON 项目路径覆盖替换队员、导出、重置、导入恢复和继续模拟。

### P3-A 标准 Hit 机制上下文合同（2026-07-10）

已完成能力：

- 每个标准 `ThreeValueDelta` 都通过统一 `AzPrThreeValueMechanismContext` 接收来源角色、目标敌人、队伍归属、命中时点和时序来源，不再要求 calculator 回读 UI 或证据临时结构。
- 来源角色上下文包含实际数值面板与独立 SP 所有权；目标敌人上下文包含物理/魔法防御、10 项元素减免配置和真实韧性基线。
- 同一份机制上下文沿 `generation -> calculator adapter -> runtime input -> runtime projection` 传递；标准合同升级为 v2，并校验 delta 与 calculator 消费的是同一上下文对象。
- 本阶段没有改动 HP、韧性或自身能量 delta 的计算公式与结果；未确认公式继续标记为可替换预览。

已完成验证：

- P3-A 定向测试：通过，6 个测试文件、32 条测试，覆盖完整/缺失上下文、合同校验、所有权和 runtime 传递。
- `npm run test -- --run`：通过，41 个测试文件、312 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程。

### P3-B 运行时三值状态快照（2026-07-10）

已完成能力：

- runtime 按标准 delta 顺序推进敌人 HP、敌人韧性和所属角色 SP；每条实际应用 delta 都输出同一合同下的 `before -> delta -> after` 状态快照。
- 两名队伍角色的 SP 状态分别初始化和累计，能量所有权优先使用 P3-A 的机制上下文；敌人 HP/韧性继续使用项目场景中的真实 baseline。
- `stateCurves.snapshots` 成为共享运行时事实，sim log、敌人曲线点和角色资源曲线点引用同一快照对象，summary 同步输出快照数量与 baseline 状态。
- 已确认 baseline 输出绝对前后值；尚未确认的角色初始 SP 保持 `null` 和 pending，同时继续记录累计 delta，不伪造初始能量，也不改变现有三值计算结果。

已完成验证：

- `npm run test -- --run`：通过，41 个测试文件、313 条测试，覆盖逐 delta 状态推进、多角色独立 SP、pending baseline 和日志/曲线共享引用。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程。

### P3-C 运行时 calculator invocation 边界（2026-07-10）

已完成能力：

- 每条 generation applied delta 在改变运行时状态前都会建立 `ThreeValueRuntimeCalculatorInvocation`，统一输入 generation delta、P3-A 机制上下文、P3-B `stateSnapshot.before` 和原 calculator result。
- 默认 runtime adapter 原样透传 generation calculator 的三值结果；runtime 使用独立 `runtimeAppliedDeltas` 推进状态，不回写或污染 generation 合同。
- 可按 HP、韧性、自身能量 track 注入状态感知 adapter；替换后的结果会统一进入状态快照、日志、曲线和 summary。
- adapter 抛错或返回非法数值时自动回退到 generation delta，并在 invocation 与 summary 中记录 fallback；默认项目数值结果保持不变。

已完成验证：

- `npm run test -- --run`：通过，42 个测试文件、317 条测试，覆盖默认透传、状态感知替换、非法输出回退和异常回退。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程。

### P3-D 角色独立初始 SP 配置闭环（2026-07-10）

已完成能力：

- Workbench 每个队伍角色都可以独立配置初始 SP；未配置时继续保持 pending，不推断蓝色星原默认值。
- `actorConfigs[].initialSp` 进入 project actor、compiled scenario、P3-A 机制上下文和 P3-B runtime baseline；配置后运行时可输出角色 SP 的绝对初始值与最终值。
- 初始 SP 按角色实际 `MAXSP` 规范化和校验；手写项目中的负值、非有限值或越界值会被 project schema 拒绝。
- 草稿升级为 v6；初始 SP 随草稿、JSON 项目、分享链接、撤销/重做、重置和导入恢复，并兼容迁移 v1-v5。

已完成验证：

- `npm run test -- --run`：通过，42 个测试文件、320 条测试，覆盖规范化、schema 校验、project/scenario/runtime 投影、v5 迁移、分享和 Workbench 历史。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程；JSON 项目路径覆盖初始 SP 编辑、导出、重置、导入恢复和继续模拟。

### UI-A 三值状态详情可见闭环（2026-07-10）

已完成能力：

- 用户从资源曲线或运行日志选择结果点后，可以在同一详情中查看敌人 HP、敌人韧性和所属角色自身能量的“变更前 / 变化 / 变更后”。
- 三值详情直接消费 P3-B 的标准 `stateSnapshot`；HP/韧性的变化按状态减少方向显示，角色能量保留自身正负方向，未确认 baseline 继续显示“待确认”。
- 曲线、日志和详情继续绑定同一状态点；用户可以从详情定位原动作，修改后返回刷新结果，并查看新结果点对应的三值状态。
- 本阶段没有新增公式或修改运行时数值，只补齐标准 runtime 输出到 Workbench 复盘界面的可见闭环。

已完成验证：

- 详情模型与面板定向测试通过，覆盖三值快照投影、所属角色、状态方向和 pending baseline。
- `npm run test -- --run`：通过，42 个测试文件、321 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程；主流程测试覆盖曲线选择、日志选择、三值前后状态、返回动作修改和刷新结果复盘。

### P3-E 运行时命中事务（2026-07-10）

已完成能力：

- runtime 按 `actionId + hitKey + frameIndex + timeMs` 把同一命中的 HP、韧性和自身能量 delta 汇成稳定的 `AzPrThreeValueRuntimeHitTransaction`。
- 每个事务统一输出命中级 `before -> delta -> stateChange -> after`、来源 delta、状态快照、calculator invocation、来源角色、能量所有者和目标敌人。
- sim log、敌人状态曲线点和角色资源曲线点引用同一命中事务；逐 delta 日志、曲线和 P3-B 快照继续保留。
- runtime output contract 升级为 v2，标准输出从 4 类扩展为 5 类；consumer 仍兼容没有 `hitTransactions` 的旧四输出合同。
- 非连续 delta、快照缺失、多能量所有者或多目标会进入 transaction validation，不会被静默包装成可信命中结果。
- 本阶段没有改动 generation delta、calculator 或默认三值结果。

已完成验证：

- 命中事务专门测试覆盖三轨合并、首尾状态、所有权、共享引用、JSON 序列化和非连续输入校验。
- `npm run test -- --run`：通过，43 个测试文件、323 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程。

### UI-B Workbench 命中级复盘（2026-07-10）

已完成能力：

- Workbench 模拟日志默认以 P3-E `hitTransaction` 为复盘单位；同一命中的 HP、韧性和所属角色能量变化合并为一条紧凑记录。
- “命中 / 明细”分段模式允许用户在命中级复盘和逐 delta 诊断之间切换；角色、动作和三值筛选在两种模式下继续可用。
- 选择事务内任意曲线点都会定位同一命中记录和事务级详情；详情一次显示三值的变更前、实际变化和变更后。
- 从命中日志或详情定位动作、修改并返回刷新结果时，事务 ID、日志行、曲线点和三值详情同步更新。
- 命中日志显示状态实际变化，原始 HP/削韧/能量应用值继续保留在贡献明细；transaction review status 与原 delta calculator status 分开保存。
- 本阶段没有新增公式、改变 calculator 或修改 runtime 数值。

已完成验证：

- 命中复盘模型、EventLog、事务详情和详情面板测试覆盖三轨合并、事务内任意状态点选择、命中/明细切换和逐 delta 兼容。
- `npm run test -- --run`：通过，44 个测试文件、327 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程；主流程覆盖命中模式、明细模式、曲线/日志/事务详情同步以及回改刷新。

### 下一阶段优先级

P1：核心导入/导出与分享闭环已完成。

- JSON 导入/导出和 URL 分享链接第一段已完成。
- PNG 元数据反导入、旧 `.promilia` 兼容等增强留到后续发布能力块，不阻塞当前 P2/P3。

P2：项目级角色、培养项和敌人配置闭环已完成。

- 当前队伍槽位、两名参战角色、培养配置、敌人选择、真实韧性基线和元素伤害减免配置均已进入项目闭环。
- 培养项对三值公式的真实作用放在 P3 adapter 中处理，不在 P2 猜测数值效果。

P3：运行时层真实机制适配。

- P3-A 已完成：标准 Hit 已接入统一来源、目标、所有权与时序上下文，calculator adapter 和 runtime 使用同一合同。
- P3-B 已完成：运行时按 delta 顺序输出三值变更前后状态，日志、曲线和 summary 已共享同一快照合同。
- P3-C 已完成：runtime calculator 已具备状态感知调用合同、默认透传、可替换 adapter 与安全回退，现有结果保持不变。
- P3-D 已完成：每名角色的初始 SP 已进入项目、持久化和 runtime 绝对状态闭环，未配置状态仍保持 pending。
- P3-E 已完成：runtime 已建立命中级三值事务，逐 delta 输出与命中级输出可以并存并共享状态事实。
- UI-A 已完成：曲线点、日志和三值详情已共享 runtime snapshot，用户可以复盘三值前后状态并返回动作修改。
- UI-B 已完成：Workbench 默认按命中复盘完整三值，并保留逐 delta 明细模式和原 calculator 诊断。
- calculator 保持可替换；不追测试期最终倍率和平衡。
- 优先跑通 HP、韧性、自身能量的来源、时序和作用对象。

P4：状态效果运行时框架。

- P4-A 已完成：动作可以通过标准 effect command 生成施加、刷新、叠层、移除和到期事件，runtime 已输出角色/敌人 active effect 时间线和 summary。
- P4-B 已完成：Workbench 可以为动作配置追踪型效果，草稿、撤销/重做、JSON 和分享链接可以恢复 effect command，运行结果可以按事件或三值状态点复盘 active effects。
- P4-B 只编辑和复盘 effect contract；效果仍不修改三值 calculator，不推断未确认的蓝色星原 Buff、异常或数值。
- 后续确认的增伤、减防、资源修正和异常机制通过可替换 effect adapter 接入，不让 UI 或证据层直接改写 runtime 状态。

P5：排轴规则与运行诊断闭环。

- P5-A 已完成：模拟层输出统一排轴规则合同，覆盖同角色轨动作占用、`skillsub_logic.coolDown` 冷却冲突和 SP 前置条件单位缺口。
- Workbench 可以从结构化诊断定位来源动作，对有确定最早时间的冲突直接应用建议时间，修正后重新运行并继续曲线/日志/详情复盘。
- P5-B 已完成：逐动作 readiness、充能快照和合法施放冷却窗口已经成为标准合同；动作库、时间轴和运行详情共享同一可执行事实。
- P5-C 已完成：确定阻塞动作会从动作事件、效果命令、ActionResult、Generation 和 Runtime 中统一排除；待确认动作仍进入执行计划。
- 下一阶段进入 P6-A PNG 项目快照与元数据回导：在现有 JSON/分享链接之上补齐可预览、可交换、可反导入的项目文件闭环，继续对齐 Endaxis 发布能力。

### P4-A 标准状态效果运行时合同（2026-07-10）

已完成能力：

- 任意项目动作可以携带可选 `effectCommands[]`，统一描述效果 ID、施加/刷新/移除操作、角色或敌人目标、动作内偏移、持续时间、叠层模式和上限。
- 编译器解析效果来源动作、来源角色、目标实体和绝对时间；runtime 生成 `EFFECT_APPLIED / EFFECT_REFRESHED / EFFECT_REMOVED / EFFECT_EXPIRED` 标准事件。
- runtime 会按时间推进 active effects，处理叠层上限、刷新续时、同帧到期优先级、显式移除和场景结束时仍存续的永久效果。
- `effectTimeline` 成为第六类标准 runtime output，并进入 eventLog、consumer、summary 和 output consistency；v1 四输出和 v2 五输出继续兼容。
- 效果 command、event 和 active state 都固定 `appliedToCalculators = false`；项目校验拒绝绕过隔离边界直接修改 calculator。
- 空 `effectCommands` 不改变旧 project action 结构；现有三值结果保持不变。

已完成验证：

- P4-A 专门测试覆盖施加、叠层、刷新、移除、自动到期、角色/敌人所有权、effect-only 项目和 calculator 隔离拒绝。
- `npm run test -- --run`：通过，45 个测试文件、330 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，25 条 Workbench 浏览器主流程。

### P4-B 效果配置与复盘闭环（2026-07-10）

已完成能力：

- Workbench 动作属性区可以新增、删除和编辑追踪型效果，覆盖效果键、名称、施加/刷新/移除、角色/敌人目标、帧偏移、持续帧和叠层规则。
- 动作草稿保留 `effectCommands[]`，并进入撤销/重做、本地草稿、JSON 项目和分享链接闭环；草稿 schema 升级为 v7，v1-v6 继续兼容导入。
- 项目生成会把 Workbench 目标解析为当前角色或敌人实例；队伍或敌人变化后不会把失效实例 ID 带入标准项目。
- 运行结果新增状态效果复盘区，展示效果事件时间线，并可按效果事件或当前三值状态点重放当时的 active effects、层数和到期时间。
- 效果事件可以定位来源动作，修改后 runtime 会随现有响应式模拟链刷新；全部效果继续固定 `appliedToCalculators = false`。

已完成验证：

- 单元测试覆盖 Workbench 项目投影、草稿/JSON/分享恢复、按时点重放 active effects 和可见配置/复盘组件。
- `npm run test -- --run`：通过，46 个测试文件、334 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，26 条 Workbench 浏览器主流程；新增路径覆盖配置效果、运行复盘、分享重载和配置恢复。

### P5-A 统一排轴规则诊断（2026-07-10）

已完成能力：

- 新增标准 `AzPrActionRuleDiagnostics` 合同；每条诊断统一包含规则代码、严重级别、状态、来源动作、阻塞动作、时间范围、来源字段和可选建议起始时间。
- 同角色轨的技能/切人动作发生占用重叠时标记为确定错误；注释、资源标记等非占用事件不会误判为动作冲突。
- 同角色同技能按 `skillsub_logic.coolDown / cooldownCount` 建立充能队列；可用次数耗尽后再次使用才标记为确定错误，非法施放不会重新开始冷却窗口。
- `skillsub_logic.spCost > 0` 会进入同一合同，但当前只标记为待确认前置条件；不会把原始 `100` 直接当作角色 0-1 能量曲线的扣减值。
- Workbench 新增排轴规则面板，可定位问题动作并把确定冲突移动到建议帧；动作属性和运行结果随现有响应式模拟链刷新。
- 动作库和 `COOLDOWN_START` 事件统一显示/使用逻辑层冷却；规则诊断固定 `appliedToSimulationResults = false`，不修改三值 calculator 或既有伤害结果。

已完成验证：

- 单元测试覆盖重叠、冷却、非法施放不重置冷却、SP 单位缺口、标准模拟结果和 Workbench 定位/修正交互。
- `npm run test -- --run`：通过，48 个测试文件、340 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，27 条 Workbench 浏览器主流程；新增路径覆盖连续排入星鸣技、发现冷却错误、定位动作、应用最早可用帧并进入运行复盘。

### P5-B 动作可执行状态与冷却窗口时间线（2026-07-10）

已完成能力：

- 新增标准 `AzPrActionReadinessTimeline`，逐动作输出 `ready / blocked / ready-with-unresolved-conditions`、可执行性、关联规则和冷却充能快照。
- 同角色同技能的每次合法施放会占用一个明确 charge slot 并生成冷却窗口；被冷却规则阻塞的施放不会占用次数或生成新窗口。
- 动作库和时间轴共享 readiness 状态；时间轴直接绘制每次合法施放的冷却区间，并区分确定阻塞和条件待确认动作。
- 运行详情显示所选动作执行前后的可用次数和下一恢复帧；规则修正后，动作状态、冷却窗口和运行复盘随现有模拟链同步刷新。
- 本阶段只建立规则时间线和可见复盘，固定 `appliedToSimulationResults = false`；没有修改 generation delta、calculator 或现有三值结果。

已完成验证：

- 单元测试覆盖逐动作状态、双充能技能、非法施放不生成窗口、时间轴冷却区间、运行详情和 Workbench 修正前后同步。
- `npm run test -- --run`：通过，48 个测试文件、342 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，27 条 Workbench 浏览器主流程；冷却规则路径新增验证动作库、时间轴、修正后窗口和运行详情使用同一 readiness 事实。

### P5-C 规则驱动执行计划（2026-07-10）

已完成能力：

- 新增标准 `AzPrActionExecutionPlan`，把每个动作编译为正常执行、带待确认条件执行或因确定规则违反而跳过，并保留诊断、顺序和跳过原因。
- 模拟引擎只为计划允许的动作生成 `ACTION_START`、资源、冷却、伤害和效果事件；跳过动作生成结构化 `ACTION_SKIPPED` 记录。
- ActionResult、候选曲线输入、`Action -> Hit -> ThreeValueDelta` 生成层、calculator runtime、状态曲线和资源曲线统一消费执行计划，不再由各层重复判断规则。
- 被阻塞动作携带的 effect command 也会被隔离，并在 effect input summary 中记录；不会留下独立 Buff/异常事件。
- Workbench 在存在阻塞时显示“已执行/总动作”，动作结果区只包含实际进入模拟的动作；修正规则后结果、曲线、日志和导航恢复。
- SP 单位等 unresolved 条件继续允许执行；本阶段没有新增公式或修改单个动作的三值计算结果，只改变非法动作是否进入模拟。

已完成验证：

- 集成测试覆盖执行计划状态、待确认动作继续执行、非法双充能施放从事件/效果/Generation/Runtime 全链路隔离和 output consistency。
- `npm run test -- --run`：通过，49 个测试文件、344 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，27 条 Workbench 浏览器主流程；冷却规则路径验证 `3/4` 动作实际执行、无非法动作结果、修正后恢复 `4` 个结果，并复验既有多动作和批次编辑流程。

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
