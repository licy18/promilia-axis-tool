# promilia-axis-tool 项目手册

最后更新：2026-08-07

当前策略是以 Endaxis 为架构和交互参考，对 `promilia-axis-tool` 进行从头重构。真实 Workbench 已成为唯一生产排轴入口，旧页面、旧 editor/timeline 组件、旧项目 store 和旧计算工具已经按引用审计退役。完整任务拆解见 `DEVELOPMENT_PLAN.md`，本文件保留最终目标、阶段目标、项目状态和当前事实。

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

- 已退役页面不得恢复为平行入口；旧 store、组件、工具函数和 `gamedata.json` 只作为迁移来源，不作为新架构的硬约束。
- 先完成真实数据管线和核心运行时最小闭环，再扩展复杂 UI。
- 每个阶段都要留下可验证产物，避免只做大范围代码搬迁。

## 2. 当前项目状态

当前项目已经形成可供本地用户试用的 Workbench production demo，并已接入 verified 公式包与首批真实动作三值链；完整动作覆盖、首份非 fixture 真实战斗采样和远程部署仍未完成，不能视为最终版本。

已完成的主线能力：

- 根路径、旧编辑器路径和预设路径统一进入真实 Workbench。
- 真实 AzPr 生成数据、版本化项目模型和无 UI 模拟运行时。
- 60fps 的 3 角色主轴、3 奇波子轴和敌人轴，以及动作属性编辑、批次操作、撤销重做和草稿恢复。
- 队伍、敌人、装备、奇波、灵子和初始资源配置，以及按方案绑定的可复用配置实例。
- `Action -> Hit -> ThreeValueDelta` 生成合同、统一可注册 mechanics adapter，以及 HP、韧性、3 条角色 SP 和 3 条奇波 SP 曲线、日志、详情和贡献分析。verified 来源完整的角色/奇波动作进入 applied；旧观测和来源不足项继续 `tracking-only / unapplied`。
- 冷却/执行计划、效果命令和运行时复盘联动。
- JSON、PNG 元数据、分享链接、runtime capture 和本地预设轴库。
- 受控 runtime capture manifest、规范化、production audit 和显式 PID host。
- 动作关系、效果区间、方案 A/B 对比，以及按 60fps 循环边界切分的区间统计与动作回定位。

当前验证基线：

- `npm run test:trial-release`：候选发布完整守门一次通过。
- `npm run test -- --run`：103 个测试文件、566 条测试通过。
- `npm run test:e2e:production-preview`：46/46 条 production preview 与 41/41 项必需能力通过，报告结论为 `trial-ready`。
- 生产引用、生产数据、verified 公式包、applied source 和包体审计通过；总 JavaScript 为 738,031B gzip，初始入口为 89,225B，Workbench 主块为 352,701B，均低于各自发布硬门槛；总量高于 735,000B 预警线。

## 3. 目录速览

```text
src/
  data/                  AzPr 生成数据和访问层
  domain/                项目、草稿、预设和采样合同
  simulation/            compiler / engine / generation / mechanics / runtime / projection
  features/workbench/    Workbench 功能组件和流程控制器
  views/Workbench.vue    唯一生产排轴工作台
  store/gamedata.js      Handbook 仍使用的辅助数据 store
  utils/pngMetadata.js   PNG 项目元数据工具
```

关键文件：

- `src/views/Workbench.vue`：生产页面编排和项目交换入口。
- `src/domain/projectSchema.js`：标准项目、角色、敌人、动作和动作关系模型。
- `src/domain/workbenchDraftStorage.js`：v16 草稿、项目 JSON 和分享合同。
- `src/domain/workbenchConfigurationLibrary.js`：角色/敌人配置实例与方案绑定合同。
- `src/domain/workbenchScenarioWorkspace.js`：项目内多方案快照、迁移和管理合同。
- `src/simulation/`：无 UI 编译、执行、三值生成、机制和结果投影。
- `src/features/workbench/`：动作轴、配置、曲线、日志、详情和主流程交互。
- `src/data/azprGenerated.js`：生成数据访问入口。

## 4. 当前数据流

游戏数据：

```text
C:\PC2\Codex\AzPr
  -> scripts/generate-azpr-data.mjs
  -> src/data/generated/
  -> src/data/azprGenerated.js
  -> domain / simulation / Workbench
```

项目数据：

```text
Workbench draft
  -> createWorkbenchProject()
  -> Project v1
  -> compileProject()
  -> simulateScenario()
  -> runtimeOutputs / Workbench 投影
```

排轴动作：

```text
动作库或属性编辑
  -> actionDrafts
  -> Project.actions
  -> ActionExecutionPlan
  -> Action / Hit / ThreeValueDelta
  -> simLog / stateCurves / summary
```

生产源码已统一使用 `project.actions`，引用审计未发现 `project.skillBlocks` 读取。旧模型只可能存在于历史文档或外部旧项目输入中，不得重新接回主链。

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
| P2     | Markdown 报告导出未完成                          | 可读文本报告仍缺失                         | 后续发布增强按需补全                     |
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
- 数据/机制边界：已建立 `Action -> Hit -> ThreeValueDelta` 生成层、运行时层和 Workbench 消费层的标准入口；经完整前后值校验的真实削韧/角色能量采样可以进入 runtime，候选字段和未验证样本仍不参与结果。

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

- JSON 导入/导出、URL 分享链接和带项目元数据的 PNG 导出/反导入均已完成。
- 旧 `.promilia` 兼容和 Markdown 报告仍可作为后续发布增强，不阻塞真实机制 adapter。

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

P6：项目交换与发布能力。

- P6-A 已完成：Workbench 可以导出包含真实时间轴快照和标准项目载荷的 PNG，并从同一文件恢复完整项目。

P7：蓝原真实机制适配。

- P7-A 已完成：标准生成层会把验证通过的 RecoverSP 与削韧 runtime sample 晋级为已应用 delta，并按真实采样帧进入角色资源曲线、敌人韧性曲线、sim log 和 summary。
- 仅有 `recoverSP / weakBreakDamageRate` 静态候选、归属缺失或前后值不一致的样本仍保持未应用；默认项目三值结果没有变化。
- P7-B 已完成：Workbench 统一导入入口可以识别实测 capture JSON，完成动作/角色/敌人绑定、项目持久化和运行结果刷新；JSON、分享链接与 PNG 都保留采样。
- P7-C 采集工具链已就绪：TC IL2CPP 静态证据可以生成来源锁定的 hook manifest；显式 Frida host/agent 可以在人工确认后按 PID 采集 JSONL，再由 production audit 和 Workbench 消费。
- P7-C 尚未完成真实数据验收：本机当前没有运行中的游戏进程或非 fixture 战斗 capture；仓库不会自动启动客户端、不会在缺少确认标志时附加，也不提供反作弊绕过。
- 下一阶段继续 P7-C：在明确授权的受控客户端会话中产出第一份真实 JSONL，并通过生产来源审计、P7-A adapter、曲线和日志全链路验收。

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
- `skillsub_logic.spCost > 0` 当时只作为未决前置条件进入合同；M6-R2 后续已由客户端路径确认其单位为绝对 SP 点，原始 `100` 表示需要并扣除 `100/100`。
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

### P6-A PNG 项目快照与元数据回导（2026-07-10）

已完成能力：

- Workbench 新增“导出 PNG”，使用与 Endaxis 相同的 `snapdom` 路线渲染独立 1600px 时间轴快照，包含项目标题、执行动作数、敌人、日期、角色轨、动作、三值曲线和图例。
- PNG 使用标准 `tEXt` chunk 写入 `PromiliaAxisToolData`；元数据封装继续承载现有 Workbench 项目分享载荷，因此角色、队伍、培养配置、敌人、动作、效果和选中状态只维护一套项目格式。
- PNG 读取会检查签名、chunk 边界、IEND 和 CRC；缺失、类型错误、载荷损坏或 CRC 损坏的文件不会被部分导入。
- “导入项目”统一接受 JSON 和 PNG；即使文件名或 MIME 丢失，也会通过 PNG 文件头识别。成功回导继续走现有项目规范化、草稿保存和 transient state 清理入口。
- JSON、URL 分享和 PNG 三条交换路径可以互相独立使用；Workbench draft schema 仍为 v7，没有为图片另建项目状态。

已完成验证：

- 单元测试覆盖 PNG `tEXt` 写入/读取、CRC 拒绝、元数据封装、完整项目 round-trip、文件名和无效载荷。
- `npm run test -- --run`：通过，50 个测试文件、348 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，28 条 Workbench 浏览器主流程；新增路径验证 1600×600 以上非空 PNG、元数据关键字、下载文件反导入、配置/动作恢复和运行复盘。
- 临时导出图已完成视觉检查：标题、摘要、双角色轨、动作块、曲线点和图例均正常，无空白画布、裁切或面板重叠。

### P7-A 蓝原真实削韧/充能机制 adapter（2026-07-10）

已完成能力：

- 新增统一 `ValidatedRuntimeSample -> ThreeValueDelta` adapter；只有身份、来源、时间和最终状态变化都完整的 runtime sample 才能晋级为已应用结果。
- RecoverSP 复用既有离线验证链，要求 `baseDelta / delta / petDelta / interval / final-sp-curve` 全部通过，并再次核对角色实体、`AttackRecoverySp` tag 和 `spAfter - spBefore = spDeltaApplied`。
- 削韧采样使用独立 `toughness-damage-applied` 合同，要求动作、角色、敌人实例、DamageElement 或 PathID、真实帧以及 `toughnessBefore - toughnessAfter = toughnessDeltaApplied` 完整一致。
- 验证通过的采样进入 Generation applied layer，并保留原始帧、元素、capture session、calculator 和状态前后值；runtime 自动生成敌人韧性曲线、每角色能量曲线、状态快照、日志和汇总。
- 已晋级事件不会在 Generation sampled layer 重复计数；验证失败的削韧事件仍保留为可替换诊断点。静态 `weakBreakDamageRate / recoverSP` 候选不自动晋级，也没有新增猜测公式。
- 本阶段只打通 runtime 消费能力；真实 capture 目前仍需由项目 metadata 或测试 fixture 提供，Workbench 独立采样文件入口留给 P7-B。

已完成验证：

- 集成测试覆盖 RecoverSP 完整验证后进入角色资源曲线、削韧完整采样进入敌人韧性曲线、错误前后值拒绝应用，以及默认项目结果不变。
- `npm run test -- --run`：通过，50 个测试文件、350 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，28 条 Workbench 浏览器主流程。

下一阶段目标：P7-B 实测采样文件导入闭环。Workbench 应能直接导入标准 capture JSON，完成动作、角色和敌人映射，保存到项目交换格式，并在导入后立即看到经 P7-A adapter 验证后的曲线与日志；不扩展真实倍率推断或候选文案。

### P7-B 实测采样文件导入闭环（2026-07-10）

已完成能力：

- 现有“导入项目”文件入口会依次识别 PNG 项目、Workbench JSON 项目和 runtime capture JSON，没有增加新的顶栏按钮或平行状态系统。
- 新增标准 `runtime-sample-captures` 文件 envelope，同时兼容单 capture、capture 数组和 `runtimeSampleCaptures[]` 包装；缺少 session、事件或 `eventType` 时整份文件拒绝，不做部分导入。
- capture 按整体绑定到当前 Workbench 动作；当前项目中已有的 action ID 可直接使用，单个外部 action ID 会映射到所选动作。多个未知 action ID、跨多个 Workbench 动作或技能 ID 不匹配时拒绝绑定。
- 绑定后的每个事件保留原始 action/actor/target ID，并写入当前动作、角色和敌人实例 ID；重复导入相同 `captureSessionId` 时替换旧 session，不重复累计。
- Workbench draft schema 升级为 v8，新增 `runtimeSampleCaptures[]`。本地草稿、撤销/重做、JSON、分享链接和 PNG 元数据共享同一字段；v1-v7 项目继续导入并迁移为空采样状态。
- 导入成功后 simulation 响应式重建，P7-A adapter 立即更新资源曲线、状态快照、命中日志和 summary；实测 SP 小数在摘要、详情和日志中保留最多 6 位精度。
- 本阶段没有把 runtime sample 反推成通用公式，也没有放宽 P7-A 的验证门槛；测试 fixture 只证明文件与 UI 闭环。

已完成验证：

- 单元测试覆盖 capture 解析、严格拒绝、动作/实体绑定、技能冲突拒绝、session 替换、v8 项目持久化和 Workbench runtime 投影。
- `npm run test -- --run`：通过，51 个测试文件、357 条测试。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，29 条 Workbench 浏览器主流程；新增路径覆盖外部 capture 导入、`+0.3375 SP` 曲线/日志、JSON 导出、重置和回导恢复。

下一阶段目标：P7-C 真实 capture 产出链。接入实际 hook 或 AzPr Extractor 输出的 JSON/JSONL，保留客户端区域、build、session 和关联键，生成标准 envelope，并至少用一份非 fixture capture 验证导入、adapter、曲线和日志全链路；不继续补零散导入提示或测试期倍率。

### P7-C 受控真实采集工具链（工具链就绪，2026-07-10）

已完成能力：

- 新增来源可追溯的 hook manifest 生成器，从 TC `dump.cs` 流式提取 RecoverSP 修正属性读取、SP/韧性最终状态应用、SPSystem 和弱点/削韧入口的 9 个方法地址、27 个字段偏移，并同时固定 `dump.cs` 与 `GameAssembly.dll` SHA-256；客户端更新后必须重新生成。
- 定义 `capture-session + event` JSONL 会话格式；解析器可按 `captureSessionId` 归并多条事件，并继续复用 P7-B 的动作/角色/敌人绑定、项目持久化和 P7-A 三值 adapter。
- 新增 capture 规范化 CLI，输出标准 `runtime-sample-captures` envelope、输入文件大小/SHA-256 和 production audit。`--require-production` 会拒绝 fixture、synthetic、manual、元数据缺失、来源身份缺失或 RecoverSP 事件错序的输入。
- 新增显式受控 Frida host/agent：必须传入 PID、动作/角色/敌人绑定和 `--confirm-controlled-session`；安装 hook 前核对进程内 `GameAssembly.dll` 文件哈希，覆盖 BaseElement 来源身份、SPGETUP/SPGETUP_ATK、RecoverSPArgs、SP 前后值和韧性前后值。
- RecoverSP 顺序按真实调用调整为“修正属性读取 -> args 构造 -> OnTransmit -> SP 应用 -> 分享回传”；旧 fixture 同步迁移，三值结果不变。
- Workbench 现有“导入项目”入口新增 `.jsonl/.ndjson` 支持，没有增加平行按钮或状态系统；既有 JSON/PNG/分享项目行为不变。
- 采集说明固定受控边界：不自动启动游戏、不在缺少确认时附加进程、不关闭或绕过反作弊。当前 manifest 和 host 只证明采集端可执行，不代表真实战斗 capture 已取得。

已完成验证：

- `npm run data:generate-runtime-capture-manifest`：通过，提取 9 个方法、27 个字段；`dump.cs` SHA-256 为 `0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a`，`GameAssembly.dll` SHA-256 为 `c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`。
- `npm run runtime-capture:self-test`：通过；host 显式附加到自行启动的 Python 测试进程，Frida agent 捕获 4 次 native `Sleep` 调用并写入 JSONL，且 self-test 文件被 production audit 拒绝。
- `npm run test -- --run`：通过，54 个测试文件、363 条测试；覆盖 manifest、JSONL 归并、生产来源拒绝、真实事件顺序、显式确认门、Frida transport 和规范化 CLI。
- `npm run build`：通过；仅保留既有 Sass `@import` 弃用警告和大 chunk 警告。
- `npm run test:e2e:workbench-flow`：通过，29 条 Workbench 浏览器主流程；capture 路径已改为 JSONL，并验证导入、三值曲线、项目 JSON 保存与回导。

当前未完成：仓库和 `C:\Codex\AzPr Extractor\captures` 均没有非 fixture 真实战斗 capture，当前也没有运行中的蓝色星原进程，因此没有对游戏安装 hook。P7-C 仍处于进行中，不能宣称已经确认新的通用公式或真实动作数值。

下一阶段目标：继续 P7-C 真实会话验收。在明确授权且人工控制的客户端采集环境中按 manifest 产出首份非 fixture JSONL，使其通过 `runtime-capture:normalize --require-production`，再验证 P7-A adapter、Workbench HP/韧性/角色能量曲线、sim log 和项目回导；不扩展碎片 UI 或猜测倍率。

### P6-B Workbench 本地预设轴库（2026-07-10）

本阶段属于 P1 导入导出/分享闭环。Workbench 现在可以把当前完整项目保存到版本化本地预设库，按名称、角色、敌人或标签搜索，按标签筛选，并完成加载副本、复制和删除。预设直接封装既有 v8 项目快照，角色/敌人/培养配置、动作、效果和 runtime capture 使用同一合同；加载继续走现有项目规范化、草稿持久化和运行时刷新入口。

旧 `/preset` 入口已改为打开 Workbench 真实预设库，旧演示页面不再位于主流程。v1-v7 可解析项目会迁移为当前 v8 快照并标记“已迁移”，未知结构保留元数据但禁用加载和复制；本阶段没有修改伤害、削韧、充能公式或三值结果。

已完成验证：`npm run test -- --run` 通过 56 个测试文件、368 条测试；`npm run build` 通过；`npm run test:e2e:workbench-flow` 通过 30 条主流程，覆盖入口、保存、搜索、标签筛选、复制、重置、回载、运行时一致性和删除。预设库另在 1440×960 与 390×844 视口完成可见性检查，没有发现遮挡或横向溢出。

下一阶段目标：阶段 7-A 旧原型退役与发布前验收。盘点并收束 Home、Editor、Preset 等旧演示入口，使真实 Workbench 成为统一用户主线；移除不再可达的假数据和无效交互，更新用户文档，并完成长轴、构建体积、性能和基础移动端试用检查。P7-C 首份真实战斗 capture 仍作为需要人工启动获准客户端后完成的并行验收项，不以等待采集阻塞产品收口。

### 阶段 7-A 生产入口统一与旧页面退役（2026-07-10）

Workbench 现在是唯一生产排轴入口。根路径和旧 `/editor` 路径统一重定向到 `/workbench`，旧 `/preset` 路径直接打开 Workbench 预设轴库，未知旧路由也安全回到 Workbench。旧 `Home.vue`、`Editor.vue`、`Preset.vue` 页面已删除，首页假预设、旧项目列表和旧编辑器不再进入生产构建；Workbench 顶栏同步移除无效“返回首页”入口。

旧页面删除后同步移除了无源码引用的 `vuedraggable` 依赖。README 与 ARCHITECTURE 已重写为当前数据、domain、simulation、Workbench 和项目交换主链；AGENTS 只新增“不得恢复平行旧编辑器”的长期边界。旧 store、editor/timeline 组件和工具函数仍按引用边界保留，没有在本阶段盲目删除。

已完成验证：`npm run test -- --run` 通过 56 个测试文件、368 条测试；`npm run build` 通过，转换模块由上一阶段的 2333 降为 1727，Home/Editor/Preset 独立 chunk 全部消失；`npm run test:e2e:workbench-flow` 通过 31 条主流程，新增验证根路径、旧编辑器、预设和未知旧路由都进入真实 Workbench，且无浏览器错误。

下一阶段目标：阶段 7-B 遗留引用审计与发布性能验收。建立生产入口引用清单，区分仍被 Handbook/DataEditor/测试使用的模块与真正孤儿代码，分批移除旧 store、editor/timeline 组件和工具函数；同时建立长轴模拟/渲染基准，量化 Workbench 大 chunk、长动作轴和窄屏交互的成本，再按证据做代码拆分或渲染优化。该阶段不新增碎片 UI，也不修改三值公式；P7-C 真实 capture 继续作为需人工客户端会话的并行验收项。

### 阶段 7-B 生产引用清理与长轴性能守门（2026-07-10）

新增可重复的生产 import 审计，从 `src/main.js` 和全部测试/E2E 入口解析 JS、TS、Vue SFC 的静态与字符串动态 import。清理前 110 个源码模块中有 19 个完全无引用、7 个意外仅测试可达旧模块；现已删除 26 个旧 editor/timeline 组件、project/history/setting store、旧计算/迁移工具和 Setting 页面，并删除 6 个只验证这些退役模块的测试文件。

清理后 `reports/production-import-audit.json` 固定为 84 个源码模块：80 个生产可达，4 个允许的领域/runtime fixture 或无 UI API，0 个意外 test-only，0 个无引用。`npm run audit:production-imports:check` 会在后两项重新出现时失败；生产源码也已不存在 `project.skillBlocks` 读取。

新增两层长轴守门。`benchmark:long-axis:check` 使用 180 个真实技能动作验证 Project、Scenario、执行计划、ActionResult、HitTransaction、StateCurve 和 SimLog 均为 180；本机最终 5 次测量的编译 p95 为 11.217ms，完整 runtime/projection p95 为 170.341ms，总 p95 为 181.558ms，峰值 heap 202.17MiB，均低于 250ms/1500ms 预算。`benchmark:long-axis:browser` 加载 120 动作 v8 草稿，验证 120 个动作列表项、时间轴块、动作结果与运行导航，并实际渲染 1920 个曲线点；最终首屏就绪 1905ms，低于 15 秒预算。

已完成验证：`npm run test -- --run` 通过 50 个测试文件、331 条测试；`npm run build` 通过，仍为 1727 个转换模块；`npm run test:e2e:workbench-flow` 通过 31 条主流程；生产引用审计、180 动作运行时基准和 120 动作浏览器基准全部通过。单元测试数量减少只来自退役模块专属测试，Workbench 主流程测试没有减少。

下一阶段目标：阶段 7-C 构建组成审计与按证据拆包。当前长轴模拟和浏览器交互满足预算，但生产构建仍提示大 chunk：Workbench 约 6477kB（gzip 654kB），全局 index 约 1237kB（gzip 399kB）。下一阶段先生成模块级 bundle composition，再针对全局 Element Plus/图标注册、生成数据与重型诊断面板实施可验证的懒加载或 chunk 划分，并保持首屏、项目交换和 31 条主流程不回归；不以隐藏警告或放宽阈值代替优化。

### 阶段 7-C 构建组成审计与首屏依赖拆分（2026-07-10）

新增可重复的 Vite bundle composition 审计，逐 chunk 记录 gzip 体积、模块构成、仓库相对路径和第三方 package 聚合，并建立首屏入口 120KB、Workbench 640KB、全部 JavaScript 950KB 的发布预算。`npm run audit:bundle:check` 在入口缺失或任一预算超限时失败，预算没有通过提高 Vite 警告阈值规避。

应用入口不再全量安装 Element Plus 或注册全部图标；教程、图鉴和数据编辑器只在各自异步页面加载实际使用的组件。PNG 截图库改为点击“导出 PNG”后才加载，项目导出格式和元数据行为不变。相较阶段开始时，首屏入口由 398,998B gzip 降至 92,634B，Workbench 由 653,526B 降至 610,346B，全部 JavaScript 由 1,061,602B gzip 降至 889,795B，分别下降约 76.8%、6.6% 和 16.2%。

已完成验证：`audit:bundle:check` 三项预算通过；`npm run test -- --run` 通过 50 个测试文件、331 条测试；`npm run build` 通过；`npm run test:e2e:workbench-flow` 通过 32 条主流程；生产引用审计保持 0 个意外 test-only 和 0 个孤儿模块；180 动作总耗时 p95 为 130.489ms，120 动作浏览器就绪时间为 2001ms。辅助页面守门同时验证教程菜单、图鉴筛选和数据编辑组件无需全局注册仍可使用，并补齐既有 `dataEditor.validateData` 中英文语言键。

下一阶段目标：阶段 7-D Workbench 生产数据投影。当前 610KB gzip 主包中，`skill-asset-evidence.json`、`enemies.json`、技能逻辑/等级交叉验证和 Workbench seed 是主要来源；下一阶段在生成器中建立面向角色/动作/敌人选择与标准模拟合同的精简投影，让生产主流程不再同步携带完整诊断证据和冗余原始行，同时保持来源追溯、数据编辑器、三值结果、项目交换和长轴行为不变。该阶段不通过手工删生成文件或简单 manual chunk 分组制造表面优化，也不新增公式与碎片 UI。

### 阶段 7-D Workbench 生产数据投影（2026-07-10）

`workbench-seed.json` 升级为 v2 生产目录合同，由 AzPr 生成器统一投影 20 个角色、120 个技能、208 个敌人、10 个元素、137 件装备、122 个奇波和 62 个魂灵，并记录每类目录的本地来源路径。敌人保留 HP、攻击、双防、韧性上限和 10 类元素防御；配置目录只保留选择、校验和项目记录需要的字段。Workbench 工厂现在只消费该合同，不再把完整敌人、装备、奇波和魂灵表同步带入生产主包；完整目录仍由数据访问层保留用于审计。

新增投影一致性守门，逐类核对数量、ID、配置字段和默认敌人战斗属性与完整生成目录一致。项目模型、v8 项目交换、loadout、Scenario、`Action -> Hit -> ThreeValueDelta` 和三值结果没有改变。Workbench 由 610,346B gzip 降至 483,742B，全部 JavaScript 由 889,795B 降至 763,190B，分别下降约 20.7% 和 14.2%；发布预算相应收紧为 Workbench 520KB、全部 JavaScript 820KB，旧状态无法通过。

已完成验证：`npm run test -- --run` 通过 50 个测试文件、333 条测试；`npm run build` 通过；`npm run test:e2e:workbench-flow` 通过 32 条主流程；生产引用审计保持 0 个意外 test-only 和 0 个孤儿模块；180 动作总耗时 p95 为 150.464ms，120 动作浏览器就绪时间为 2013ms；bundle 三项预算通过。

下一阶段目标：阶段 7-E 技能运行证据生产投影。当前主包剩余最大来源是 `skill-asset-evidence.json`、`skill-logic-index.json` 和 `skill-level-crosscheck.json`；下一阶段由生成器输出 project/runtime 实际消费的技能逻辑、等级交叉校验、DamageElement 映射、外部对象、召唤目标和命中时序精简合同，完整审计文件继续保留但退出主流程。验收必须比较默认、多角色、多动作和长轴模拟结果等价，并继续收紧 bundle 预算；不删除来源追溯、不改公式、不做碎片 UI。

### 阶段 7-E 技能运行证据生产投影（2026-07-10）

新增 `workbench-skill-runtime.json` v1，由 AzPr 生成器把 120 个技能逻辑项、120 个等级交叉校验项、2 个 valueParam、120 个当前技能控制状态、15 个 DamageElement 映射技能、18 个外部对象技能和 2 个召唤目标投影为生产合同。domain 与 projection 层统一消费该文件，四份完整技能审计 JSON 继续保留来源和诊断，但不再进入 Workbench 主包；公式、calculator、三值 delta 和项目 v8 schema 均未变化。

新增 `audit:workbench-data:check`，从完整目录/证据重新计算 v2 目录投影和 v1 技能运行投影并做逐字段深比较，同时核对 manifest。完整游戏目录到 seed 的文件体积减少 77.12%，四份完整技能证据到运行投影减少 33.83%；bundle 守门同步禁止九张完整目录/证据表回流。Workbench 由 483,742B gzip 降至 408,497B，全部 JavaScript 由 763,190B 降至 687,934B，分别下降约 15.6% 和 9.9%；预算收紧为 Workbench 440KB、全部 JavaScript 740KB。

已完成验证：`npm run test -- --run` 通过 50 个测试文件、333 条测试；`npm run build` 通过，1728 个模块；`npm run test:e2e:workbench-flow` 通过 32 条主流程；生产引用、生产数据和 bundle 审计全部通过；180 动作总耗时 p95 为 160.589ms，120 动作浏览器就绪时间为 2464ms。默认、多角色、多动作、项目交换、实测 capture、命中/三值详情和长轴路径均保持既有结果。

下一阶段目标：阶段 7-F 运行核心与诊断证据边界。当前 Workbench 仍有 3.36MB minified chunk，其中技能运行投影约 2.06MB；下一阶段把首轮模拟必需的动作逻辑、已应用 delta、曲线和日志与仅在详情复盘时需要的候选证据拆成稳定合同，让核心模拟先完成、诊断证据按需加载，并以真实交互验证详情打开后信息完整。不得只做 manual chunk 分组隐藏警告，也不得删减来源追溯、修改公式或新增碎片 UI。

### 阶段 7-F 运行核心与诊断证据边界（2026-07-10）

技能生产合同已拆为 `workbench-skill-core.json` 与 `workbench-skill-diagnostics.json`：首轮编辑和模拟只加载 1,745,045B 的核心逻辑/等级/valueParam，2,483,839B 的 Skill Control、DamageElement、外部对象和召唤目标候选证据在首次运行复盘或实测采样恢复时按需加载。原始 JSONL 采样会先取得诊断证据再绑定；包含采样的 JSON、PNG、分享、预设和本地草稿也会在恢复后自动补载。已应用 HP、韧性、角色能量、状态快照和日志数值在诊断安装前后保持一致，本阶段没有修改公式或项目 v8 schema。

生产数据审计升级为 v2，分别深比较核心与诊断投影并核对 manifest；bundle 守门同时要求诊断文件形成独立动态 chunk。Workbench 首轮包由 408,497B gzip 降至 346,066B，诊断按需包为 63,418B gzip，全部 JavaScript 为 688,932B gzip；Workbench 预算收紧为 370KB。

已完成验证：`npm run test -- --run` 通过 51 个测试文件、334 条测试；`npm run build` 通过，1730 个模块；生产引用、生产数据和 bundle 审计全部通过；`npm run test:e2e:workbench-flow` 通过 32 条主流程并覆盖诊断从 idle 到 ready 及 runtime capture 导入；180 动作总耗时 p95 为 102.458ms，120 动作浏览器就绪时间为 1365ms。

下一阶段目标：阶段 7-G 生产预览与试用发布验收。基于真实 `vite build` 产物启动本地 production preview，验证根路径、Workbench 直达/刷新、辅助路由、静态资源、诊断动态包、JSON/PNG 项目交换和窄屏主流程均可在生产模式工作；形成短小的试用判定与发布检查报告，并保持现有三值结果和 UI 能力不变。该阶段不继续拆抽象、不新增碎片按钮，也不追真实倍率。

### 阶段 7-G 生产预览与试用发布验收（2026-07-10）

新增独立 production Playwright 配置与统一命令 `npm run test:e2e:production-preview`：命令会先重新构建 `dist`，再用独立端口启动 Vite preview，避免把开发服务器结果当成发布结果。五项必需能力覆盖根路径/Workbench 刷新与辅助路由的哈希资源加载、诊断证据独立动态包、JSON 项目导出回导、PNG 元数据导出回导，以及 390x844 视口中的“运行复盘 -> 回到动作编辑 -> 查看刷新结果”闭环。

新增 `reports/production-preview-acceptance.json` v1；任一必需能力失败或缺失都会输出 `blocked`。本次 5/5 能力、5/5 测试通过，报告结论为 `trial-ready`，因此当前版本已达到“可给用户试用的本地 Workbench production demo”。该结论不包含远程托管/CDN、最终蓝原公式或首份非 fixture 真实 capture。

下一阶段目标：阶段 8-A 用户试用反馈与问题分级。使用当前 production preview 完成一轮真实操作试用，按“阻断主流程 / 数据或结果错误 / 性能与兼容 / 体验增强”归类问题，只对可复现且影响完整任务的问题进入开发；与此同时保留 P7-C 真实客户端采样为需人工启动获准会话的独立验收项。下一阶段不预设新增按钮或继续抽内部层，先以用户实际卡点决定进入 UI 主流程还是 P3 运行时适配。

### 阶段 8-A Endaxis 式多动作编辑闭环（2026-07-10）

试用缺口检查确认 Workbench 只能编辑单个动作，而 Endaxis 已具备任意多选、动作剪贴板、整组移动/删除和上下文菜单。现已在动作列表与时间轴统一普通点击、Ctrl/Cmd 切换和 Shift 连续范围选择，并保留一个主动作承担属性编辑与运行结果定位。用户可以用 Ctrl/Cmd+C、Ctrl/Cmd+V、方向键、Delete/Backspace 或右键菜单操作任意动作组；右键时间轴空白区域会把粘贴组落到对应帧。

粘贴保持动作组的相对帧差和角色轨道，靠近时间轴末端时整组回退而不是逐个截断；新动作和效果命令重建 ID，并主动脱离旧 `insertion` 与 `generationBatch`。整组拖拽只在浏览器内预览，松手后才形成一条历史记录和一次响应式模拟刷新；撤销/重做同时恢复动作与多选，进入曲线/日志/三值复盘后也不会把动作组折叠为单选。剪贴板和多选是 Workbench transient state，不进入 v8 JSON、分享链接、PNG、预设或本地草稿，三值公式与结果合同未改变。

已完成验证：`npm run test -- --run` 通过 52 个测试文件、339 条测试；`npm run test:e2e:workbench-flow` 通过 33 条主流程，新增路径覆盖非连续多选、右键定帧粘贴、整组拖拽、运行复盘、批量删除和撤销恢复；`npm run test:e2e:production-preview` 通过 6/6 项能力，报告继续为 `trial-ready`。生产引用、生产数据和 bundle 审计全部通过；Workbench gzip 为 349,876B，全部 JavaScript gzip 为 692,836B，未突破 370KB/740KB 预算。180 动作完整运行 p95 为 28.780ms，120 动作浏览器首屏就绪为 1325ms，长轴两层预算均通过。

下一阶段目标：阶段 8-B 长轴编排效率与动作关系闭环。对齐 Endaxis 的框选和动作连接能力，使用户能在密集多轨时间轴上框选一组动作、建立可视化前后关系，并让关系随复制、粘贴、移动、删除、撤销/重做和项目交换保持一致；先定义关系对排轴时序的最小语义，不把连线直接解释成未经确认的蓝原伤害或资源公式。该阶段是编辑器大能力块，不拆成新增单个按钮、提示或标签的小阶段。

### 阶段 8-B 长轴编排效率与动作关系闭环（2026-07-10）

Workbench 时间轴新增可切换框选模式，用户可以跨轨拖出选择区域，并让选中动作继续进入既有复制、粘贴、整组移动、删除、撤销/重做和运行结果定位主流程。两个或更多动作可以按时间顺序建立 `source.end -> target.start` 前后关系；关系会直接绘制在时间轴上，可以单独选中或删除，并禁止自连、重复边和有向环。

动作关系已经进入标准 Project 与 WorkbenchProjectFile v9。移动动作或修改时长会重新计算帧对齐间隔，删除端点会清理关联边，动作组复制只携带组内完整关系；本地草稿、JSON、分享链接、PNG 元数据、预设和撤销/重做共享同一 `actionRelations[]`。v1-v8 文件继续导入并迁移为空关系状态。关系只表达编辑器编排语义，不改变 execution plan、generation、calculator 或现有 HP/韧性/角色能量结果。

已完成验证：`npm run test -- --run` 通过 53 个测试文件、346 条测试；`npm run test:e2e:workbench-flow` 通过 33 条主流程，覆盖框选、建立关系、组内关系复制、整组移动、单独删除关系、端点删除、撤销恢复、JSON 导出回导和继续运行复盘；`npm run test:e2e:production-preview` 通过 7/7 项能力并输出 `trial-ready`。生产引用和数据投影审计通过，Workbench gzip 为 353,989B，全部 JavaScript gzip 为 697,202B；180 动作完整运行 p95 为 33.172ms，120 动作浏览器首屏就绪为 1465ms。桌面和 390px 窄屏已检查关系层、动作层和工具区，没有发现横向溢出或内容遮挡。

下一阶段目标：阶段 8-C 状态效果时间线与运行复盘闭环。对齐 Endaxis 的效果区间可视化能力，把现有 effect command、runtime lifecycle 和 active effect snapshot 投影为角色/敌人轨上的可见区间；用户应能从区间查看施加、刷新、叠层、移除和到期过程，定位来源动作，修改后返回刷新结果。继续复用现有 P4 合同与 Workbench 主流程，不增加平行效果模型，不让尚未确认的 Buff/异常数值进入三值 calculator，也不把该阶段拆成零散按钮或状态提示。

### 阶段 8-C 状态效果时间线与运行复盘闭环（2026-07-10）

新增标准 `AzPrEffectIntervalProjection`，把现有 runtime 的施加、刷新/叠层、移除和到期事件归并为稳定持续区间，保留角色或敌人目标、来源动作、完整生命周期、帧范围、峰值层数和场景结束状态。时间轴现在为角色效果分配对应角色子轨；出现敌人效果时建立独立敌人效果轨。重叠区间自动分层，并把命中、候选值和状态曲线向下推移，避免与动作或效果条重叠。

用户可以直接选择时间轴效果区间，在状态效果面板查看该窗口的施加、刷新、叠层、移除/到期节点，同时继续查看该时点全局 active effect snapshot；任一生命周期节点都可以定位来源动作。修改效果名称、目标、偏移、持续帧或叠层配置后，现有 simulation 响应链会重建区间和事件，用户可再次选择刷新后的窗口。PNG 时间轴也消费同一投影。本阶段没有新增项目字段或迁移，effect command、runtime event 与 `appliedToCalculators = false` 边界保持不变，三值结果未修改。

已完成验证：`npm run test -- --run` 通过 54 个测试文件、349 条测试；`npm run test:e2e:workbench-flow` 通过 33 条主流程，覆盖配置效果、选择区间、生命周期详情、来源动作回改、持续帧刷新和分享项目恢复；`npm run test:e2e:production-preview` 通过 8/8 项能力并输出 `trial-ready`。生产引用和数据投影审计通过，Workbench gzip 为 357,386B，全部 JavaScript gzip 为 700,597B；180 动作完整运行 p95 为 27.864ms，120 动作浏览器首屏就绪为 1479ms。桌面和 390px 窄屏已用角色增益与敌人标记检查：2 个区间、1 条敌人效果轨、动作/效果重叠数为 0，页面无横向溢出。

下一阶段目标：阶段 8-D 排轴方案对比与分析闭环。对齐 Endaxis 的伤害分析和方案复盘层级，让用户能把当前轴与一个已保存预设或导入项目作为 A/B 方案运行，在同一视图比较总 HP 伤害、削韧、各角色能量、持续时间、动作贡献和效果覆盖，并从差异项定位对应动作继续修改。比较只消费两个独立 runtime output，不建立第二套公式或 UI 临时计算，也不把阶段拆成单个统计标签；当前测试期数值继续明确沿用各方案自身的来源状态。

### 阶段 8-D 排轴方案对比与分析闭环（2026-07-11）

Workbench 新增可直接使用的“方案对比”主流程。用户可以从本地预设、JSON/PNG 项目或当前编辑快照建立基准；当前方案与基准方案分别经过完整 Project、Scenario 和 simulation 链，再在同一窗口比较敌人 HP 伤害、韧性削减、各角色自身能量、排轴时长、动作贡献和效果覆盖。导入基准不会覆盖当前动作、队伍、敌人或撤销记录，关闭窗口后仍可继续编辑当前轴。

新增标准 `AzPrWorkbenchScenarioComparison` 只读取两套 `runtimeOutputs`、Scenario 动作和 `AzPrEffectIntervalProjection`，不重新计算伤害、削韧或充能。动作差异行可以定位当前动作的起始帧属性；修改后再次打开对比会自动使用刷新后的当前 simulation。比较窗口按需加载，基准和比较结果均为编辑会话临时态，不写入 WorkbenchProjectFile v9，也没有新增项目迁移或改变三值结果。

已完成验证：`npm run test -- --run` 通过 55 个测试文件、353 条测试；`npm run test:e2e:workbench-flow` 通过 33 条主流程；`npm run test:e2e:production-preview` 通过 9/9 项能力并输出 `trial-ready`，新增路径覆盖快照基准、当前动作修改、JSON 基准导入、不覆盖当前编辑和差异动作回改。生产引用、生产数据和 bundle 审计通过，Workbench gzip 为 360,000B，全部 JavaScript gzip 为 706,971B；180 动作完整运行 p95 为 54.197ms，120 动作浏览器首屏就绪为 1492ms。1440×1000 与 390×844 实图检查确认核心结果、角色能量和动作贡献无重叠，窄屏可完整滚动查看。

下一阶段目标：阶段 8-E 循环边界与分段统计闭环。对齐 Endaxis 的 cycle boundary 能力，让用户在 60fps 时间轴上添加、移动和删除循环边界，并按边界把同一套 runtime output 切成多个可复盘区段；每段统一统计 HP、韧性、各角色能量、动作贡献和效果覆盖，并能定位区段内动作继续修改。循环边界进入项目交换和撤销/重做，区段统计只切分既有事件与曲线，不复制动作、不自动外推循环次数，也不新增三值公式。

### 阶段 8-E 循环边界与分段统计闭环（2026-07-11）

Workbench 现在可以在 60fps 时间轴空白位置添加循环边界，直接拖动调整帧位，右键删除，并在撤销/重做中恢复。边界写入 `WorkbenchProjectFile v10`，本地草稿、JSON、分享链接、PNG 元数据和预设共用同一 `cycleBoundaries[]`；v1-v9 项目继续导入并迁移为空边界状态。

新增标准 `AzPrCycleSectionProjection`，只按边界切分现有 runtime hit transaction、角色能量、effect lifecycle 和 effect interval，输出每段 HP、韧性、各角色能量、动作贡献与效果覆盖。用户可以在时间轴查看选中区段高亮，在区段统计中切换区段并定位贡献动作继续修改。该投影固定 `readsRuntimeOutputsOnly = true`、`appliedToCalculators = false`，没有复制动作、外推循环轮数或改变既有三值结果。

阶段验收：58 个测试文件、361 条测试，34 条 Workbench 主流程和 10 项 production preview 能力全部通过；180 动作完整运行 p95 为 18.463ms，120 动作浏览器首屏就绪为 1303ms。Workbench 主块 gzip 为 363,626B，仍低于 370,000B 预算；1440×1000 与 390×844 实图检查均无页面横向溢出或控件遮挡。

下一阶段目标：阶段 8-F 多方案工作区闭环。对齐 Endaxis 的方案管理层级，让用户在同一个工作区创建、复制、重命名和切换多条完整排轴方案，每条方案独立保存队伍/敌人配置、动作、关系、效果、循环边界和采样绑定，并可直接选择任意两条方案复用现有 A/B runtime comparison。该阶段应把“预设存档”和“当前编辑方案”组织成清晰的项目级工作流，不继续补单个按钮或状态标签，也不修改三值公式。

### 阶段 8-F 多方案工作区闭环（2026-07-11）

Workbench 现在提供项目级方案栏，最多保存 14 条完整排轴方案。用户可以新建、复制、重命名、切换和删除方案；切换前会把当前队伍/敌人配置、动作、关系、效果命令、循环边界、runtime capture 和选中动作写回活动方案，进入目标方案后清理跨方案临时焦点与历史栈。方案操作会同步本地草稿，至少保留一条方案。

项目文件升级为 `WorkbenchProjectFile v11`，新增 `scenarioWorkspace`。根级草稿字段始终镜像活动方案，现有 Project、Scenario、generation、runtime 和 UI 投影继续只消费这份活动草稿；完整 `scenarios[].draft` 随本地草稿、JSON、分享链接、PNG 元数据和预设一起交换。v1-v10 项目自动迁移成单一“方案 1”，没有建立第二套模拟器或修改三值计算。

现有方案对比窗口新增工作区方案来源：当前活动方案可以直接选择任一其他方案作为基准，两边仍分别通过标准 Project/Scenario/runtime，再由 `AzPrWorkbenchScenarioComparison` 比较。方案切换、项目导出回导和删除均已通过同一主流程验收。

阶段验收：61 个测试文件、370 条测试，35 条 Workbench 主流程和 11 项 production preview 能力全部通过；180 动作完整运行 p95 为 26.000ms，120 动作浏览器首屏就绪为 1313ms。Workbench 主块 gzip 为 365,188B，全部 JavaScript gzip 为 715,845B，仍在 370,000B/740,000B 预算内；1440×1000 与 390×844 实图检查均无页面横向溢出，窄屏方案标签在方案栏内部滚动。

下一阶段目标：阶段 8-G 循环边界继承方案闭环。对齐 Endaxis 从 cycle boundary 创建继承方案的能力，从选中边界读取现有 runtime 状态快照，生成一条新的后续方案：边界后的动作按帧平移到新轴起点，并继承敌人 HP/韧性、各角色自身能量和仍在生效的效果。该阶段应建立明确的 initial runtime state 合同并继续走标准 runtime，不自动外推循环次数、不猜测未确认机制，也不把继承实现成 UI 临时数值覆盖。

### 阶段 8-G 循环边界继承方案闭环（2026-07-11）

Workbench 循环复盘现在可以从所选区段的起始边界创建一条独立后续方案。边界之后的动作统一减去边界时间，动作间留白、组内关系和后续循环边界保持相对位置；边界之前的动作和跨边界关系不进入新方案，原方案不被改写。恰好位于边界帧的动作与三值事件留在新方案结算，runtime capture 不会在缺少绝对帧重映射时被静默复用。

项目文件升级为 `WorkbenchProjectFile v12`，每条方案新增标准 `AzPrInitialRuntimeState`。该合同保存来源方案/边界、敌人当前 HP/韧性、各角色当前自身能量和仍生效效果的剩余时长；Project、Scenario、三值状态快照与效果 runtime 统一消费它。继承效果从新轴 0 帧发出 `EFFECT_INHERITED`，继续进入效果区间、生命周期复盘和时间轴显示；没有新增公式、倍率或 UI 临时数值覆盖。JSON、分享链接、PNG 元数据和预设均可完整交换 v12 继承方案，v1-v11 自动迁移为 `initialRuntimeState = null`。

阶段验收：63 个测试文件、379 条测试，36 条 Workbench 主流程和 12 项 production preview 能力全部通过，生产报告结论为 `trial-ready`。生产引用与数据投影审计均无异常；Workbench 主块 gzip 为 368,529B，全部 JavaScript gzip 为 719,362B，仍低于 370,000B/740,000B 预算。180 动作编译 p95 为 147.146ms、完整 simulation p95 为 283.843ms，均低于既有预算。

下一阶段目标：阶段 8-H Endaxis 式工作区布局闭环。把当前固定 Workbench 整理为可折叠、可调整尺寸并本地持久化的动作库、主时间轴/运行复盘和侧边检查区，提供清晰的专注编辑与专注复盘布局，并保证桌面、窄屏和 PNG 导出不受布局状态污染。该阶段只改变工作区组织和操作效率，不新增公式、项目战斗字段或零散状态标签。

### 阶段 8-H Endaxis 式工作区布局闭环（2026-07-11）

Workbench 现在提供均衡、专注编辑和专注复盘三种桌面布局。动作库与侧边检查区可以独立折叠；两条分隔线支持鼠标拖动、方向键微调、Home 或双击恢复默认宽度。布局偏好使用独立 `WorkbenchLayout v1` 本地保存，刷新页面后恢复，但不进入 WorkbenchProjectFile v12、JSON、分享链接、PNG 元数据、预设或撤销历史。

1180px 以下改为动作库加主流程、检查区下置的两栏结构；760px 以下强制恢复动作库、主流程、检查区的完整纵向顺序，桌面折叠偏好不会隐藏移动端内容。PNG 继续使用固定导出表面，布局状态不改变项目数据、模拟输入或导出构图。本阶段没有新增公式、倍率或战斗字段。

阶段验收：384 条单元/组件测试、37 条 Workbench 主流程和 13 项 production preview 能力全部通过，生产报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块 gzip 为 369,675B，全部 JavaScript gzip 为 722,652B，仍低于 370,000B/740,000B 预算。180 动作编译 p95 为 10.956ms、完整 simulation p95 为 25.174ms，均低于既有预算；桌面与窄屏实图检查没有发现横向溢出或面板遮挡。

下一阶段目标：阶段 8-I 项目级拖放接收与恢复闭环。对齐 Endaxis 的文件接收方式，让用户把 JSON 项目或带元数据的 PNG 直接拖入 Workbench，统一经过现有项目解析、版本迁移、来源校验和恢复入口，并在成功后立即进入可编辑、可运行、可再次导出的完整工作区；错误文件只给出可恢复结果，不覆盖当前方案。该阶段整合已有项目交换能力，不新增平行格式、战斗公式或零散状态标签。

### 阶段 8-I 项目级拖放接收与恢复闭环（2026-07-11）

Workbench 现在可以在页面任意位置接收外部文件拖放。外部文件进入窗口时显示全屏释放遮罩；JSON 项目、带 `PromiliaAxisToolData` 元数据的 PNG 和既有 runtime capture JSON/JSONL 统一经过 `workbenchProjectFileReceiver.js`，再进入原有项目解析、版本迁移、capture 绑定和 `applyImportedProjectDraft()` 恢复链。文件选择、方案对比基准导入和拖放不再各自维护文件判别逻辑。

拖入有效 JSON 或 PNG 后会恢复完整 v12 工作区、活动方案、队伍/敌人配置、动作、关系、循环边界、初始状态和采样绑定，并可立即运行模拟或再次导出。拖入不支持的文件、无项目元数据 PNG、损坏项目或多个文件时不会应用部分结果，也不会覆盖当前方案。文件接收结果和拖放状态都是 transient UI 合同，没有新增 WorkbenchProjectFile 字段或改变三值计算。

阶段验收：390 条单元/组件测试、38 条 Workbench 主流程和 14 项 production preview 能力全部通过，生产报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块 gzip 为 369,695B，全部 JavaScript gzip 为 724,656B，仍低于 370,000B/740,000B 预算。180 动作编译 p95 为 11.495ms、完整 simulation p95 为 29.330ms，120 动作浏览器首屏就绪为 2125ms；1440×1000 实图检查确认拖放遮罩无重叠。

下一阶段目标：阶段 8-J 角色/敌人/培养配置实例闭环。进入 P2 配置能力块，对齐 Endaxis armory/team loadout 的项目层级，把现有角色等级、初始能量、奇波、装备、魂灵和敌人等级、HP/韧性倍率、元素防御整理为可复用、可命名、可复制的配置实例，并让每条工作区方案明确选择实际参与模拟的配置。继续复用现有 `actorConfigs`、`enemyConfig` 和 AzPr 生成数据，不建立平行培养模型，不把资料展示项误接入未确认公式，也不把阶段拆成单个选择框或状态标签。

### 阶段 8-J 角色/敌人/培养配置实例闭环（2026-07-11）

Workbench 现在可以把角色等级、初始能量、奇波、装备、灵子以及敌人等级、HP/防御/韧性倍率、初始韧性和元素防御保存为可命名、复制、选择和删除的配置实例。每条工作区方案独立绑定实际参与模拟的角色与敌人实例；切换方案或实例后，现有队伍/敌人编辑器和运行结果立即使用对应配置。配置操作进入撤销/重做，至少保留每个实体的一条实例。

项目文件升级为 `WorkbenchProjectFile v13`。根级 `configurationLibrary` 保存共享角色/敌人实例，每条方案的 `configurationSelection` 保存绑定；活动实例继续解析为既有 `actorConfigs` / `enemyConfig`，因此 Project、Scenario、generation、runtime 和 calculator 结果链没有分叉。v1-v12 项目从各方案已有配置自动迁移；本地草稿、JSON、分享链接、PNG 元数据和预设继续交换完整工作区。本阶段没有新增真实倍率、培养效果推断或第二套配置模型。

阶段验收：69 个测试文件、395 条单元/组件测试通过；39 条 Workbench 浏览器主流程全部覆盖，其中配置实例路径完成复制、命名、方案分流、JSON 导出、重置和回导恢复；15 项 production preview 能力全部通过，报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块为 369,408B gzip，全部 JavaScript 为 729,603B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 10.985ms、完整 simulation p95 为 28.659ms；120 动作浏览器首屏就绪为 1951ms。

下一阶段目标：阶段 8-K / P3 运行时真实机制适配。把 v13 已选角色/敌人配置解析成标准 `ThreeValueMechanismContext` 的明确来源输入，并让 `Action -> Hit -> ThreeValueDelta` 的 HP、韧性和每角色能量 delta 统一经过可替换 AzPr mechanics adapter。优先确认配置来源、作用对象和时序，不追测试期最终倍率，不继续增加配置小控件，也不恢复证据考古；未确认的装备、奇波和灵子效果继续保持项目配置与来源字段，不自动参与 calculator。

### 阶段 8-K P3 运行时机制配置来源闭环（2026-07-11）

活动方案的 v13 `configurationSelection` 现在会随解析后的 `actorConfigs` / `enemyConfig` 进入 Project metadata；compiler 新增 `AzPrThreeValueMechanismConfiguration`，按 actor/enemy 固定配置实例 ID、来源路径、实际解析值和应用策略。角色面板 stats 与初始 SP、敌人 HP/防御/韧性配置分别标记当前应用位置；奇波、装备、灵子效果、敌人等级公式和元素防御公式明确保持未应用，calculator 不读取配置库或 UI。

`AzPrThreeValueMechanismContext` 升级为 v2，标准 `Action -> Hit -> ThreeValueDelta` 与 `ThreeValueDeltaCalculator` 升级为 v3。每条 generation delta 和 calculator result 都携带配置 readiness、状态和实例 ID；`ThreeValueRuntimeCalculatorInvocation` 升级为 v2，向 runtime adapter 显式提供同一 `mechanismConfiguration` 引用，并在 state snapshot/runtime summary 汇总配置来源。对照测试证明加入或移除实例身份不会改变相同解析配置下的 HP、韧性和自身能量 delta。

为守住既有发布预算，排轴规则和状态效果面板改为按需加载；面板位置、操作和项目合同不变。阶段验收：70 个测试文件、397 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块为 368,272B gzip，全部 JavaScript 为 732,808B gzip，仍在 370,000B/740,000B 预算内。180 动作编译 p95 为 9.579ms、完整 simulation p95 为 22.027ms；120 动作浏览器首屏就绪为 1874ms。

下一阶段目标：阶段 8-L / P3 三轨 mechanics adapter 统一调用。把 HP、韧性和每角色能量三类现有 applied delta 的生成入口收束为同一可注册 adapter 合同，让 adapter 显式消费 action、hit、mechanism configuration、来源值和状态前值，并保持当前输出完全一致；为后续替换真实 AzPr 机制提供单一调用点。该阶段不新增真实倍率、不让未确认培养项参与计算，也不增加 Workbench 提示控件。

### 阶段 8-L P3 三轨 mechanics adapter 统一调用（2026-07-11）

新增 `AzPrThreeValueMechanicsAdapter v1` 与纯注册表 API。`Action -> Hit -> ThreeValueDelta` 升级为 v4：每条 delta 在 generation 绑定 action、hit、mechanism configuration 和完整 source value；runtime state snapshot 再绑定该时点的 `stateBefore`，HP、韧性和每角色能量统一经过同一 invocation 合同。注册表既支持按轨替换，也支持一个 `default` adapter 覆盖三轨；`simulateScenario()` 已提供顶层无 UI 注入入口，旧 `runtimeCalculatorAdapters` 保持兼容。

`ThreeValueRuntimeCalculatorInvocation` 升级为 v3，记录注册键、合同版本、显式输入和引用校验。默认 adapter 仍原样透传 generation delta，自定义 adapter 的无效结果或异常仍安全回退；对照和引擎边界测试证明默认 HP、韧性、角色能量、曲线与日志结果不变。未确认的装备、奇波、灵子、敌人等级与元素防御效果没有进入 calculator，Workbench 也没有新增提示或控件。

阶段验收：71 个测试文件、399 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块为 369,888B gzip，全部 JavaScript 为 734,423B gzip，仍在 370,000B/740,000B 预算内。180 动作编译 p95 为 10.652ms、完整 simulation p95 为 27.816ms；120 动作浏览器首屏就绪为 1721ms。

下一阶段目标：阶段 8-M / P3 机制 operands 与内置 adapter 迁移。为三轨 source value 增加可计算的结构化 operands，并把当前已经应用的 HP raw preview、显式角色能量变化和已验证 runtime sample 取值迁入内置 mechanics adapter，实现从来源操作数到 delta 的单一计算边界，同时保持现有结果完全一致。韧性在没有已验证来源时继续保持当前结果；该阶段不新增或猜测真实倍率，不启用未确认培养效果，也不增加碎片 UI。

### 阶段 8-M P3 机制 operands 与内置 adapter 迁移（2026-07-11）

新增 `AzPrThreeValueMechanicsOperands v1`，把现有已应用值拆回可计算来源：HP raw preview 保存角色攻击与动作倍率，显式角色能量保存资源事件 delta 列表，已验证削韧和能量采样保存 before/after/reported delta。`Action -> Hit -> ThreeValueDelta` 升级为 v5，每条 source value 都携带 operands、期望 delta 和来源状态；identity 仅保留给兼容及非应用诊断层。

`AzPrThreeValueMechanicsAdapter` 升级为 v2，内置 adapter 现在从 operands 重算 HP、显式能量和已验证采样，不再直接返回 generation 的最终值；`ThreeValueRuntimeCalculatorInvocation` 升级为 v4，记录重算值、ready、missing、mismatch 和 operand kind。generation delta 仍作为来源审计与失败回退，对照测试证明曲线、日志、命中事务和 summary 数值不变。未验证削韧、能量候选、装备、奇波、灵子、敌人等级和元素防御仍不参与计算。

为保持发布预算，非首屏的预设库对话框改为按需加载；保存、搜索、复制和回载预设的完整浏览器路径通过。阶段验收：71 个测试文件、400 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块为 369,379B gzip，全部 JavaScript 为 736,287B gzip，仍在 370,000B/740,000B 预算内。180 动作编译 p95 为 8.704ms、完整 simulation p95 为 22.002ms；120 动作浏览器首屏就绪为 1492ms。

下一阶段目标：阶段 8-N / P3 版本化 mechanics profile。把当前内置 adapter 中对 operand kind 的硬编码分派整理为可选择、可追踪的 `AzPrMechanicsProfile`，由 Scenario 明确绑定 profile ID、版本、支持的 operand kinds 和各机制层 applied/unapplied 状态，并让 runtime summary 记录实际 profile。当前 profile 继续保持现有结果；后续已确认的防御、抗性或培养机制通过新增 profile 层接入，不修改 Workbench，也不猜测尚未确认公式。

### 阶段 8-N P3 版本化 mechanics profile（2026-07-11）

新增纯数据 `AzPrMechanicsProfile v1`。compiler 默认把 `azpr-three-value-preview-v1` 绑定到 Scenario，并记录 requested/resolved profile、版本和 fallback；profile 明确列出五种 operand kind 的 operation/可用轨道，以及 HP、韧性、角色能量各机制层的 applied/unapplied 状态。`compileProject()` 支持选择其他合法 profile，不需要修改 Workbench 或把函数写进项目文件。

`AzPrThreeValueMechanismContext` 升级为 v3，`Action -> Hit -> ThreeValueDelta` 升级为 v6，`AzPrThreeValueMechanicsAdapter` 升级为 v3，`ThreeValueRuntimeCalculatorInvocation` 升级为 v5。generation request 与 runtime input 保持同一 profile 引用；operands evaluator 先解析 profile capability，再按 operation 计算。自定义 profile 缺少 HP capability 的测试证明 runtime 会记录 unsupported、回退 generation delta 并保持结果，不会偷偷套用默认 profile。

为保持发布预算，纯同步的 profile 与 adapter 固定为单个 `azpr-mechanics-runtime` 构建 chunk；源码、测试和 runtime 调用语义不异步化，总 JavaScript 预算继续守门。阶段验收：72 个测试文件、402 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，报告结论为 `trial-ready`。生产引用与数据投影审计无异常；Workbench 主块为 368,608B gzip，全部 JavaScript 为 739,259B gzip，仍在 370,000B/740,000B 预算内。180 动作编译 p95 为 9.016ms、完整 simulation p95 为 26.970ms；120 动作浏览器首屏就绪为 1611ms。

下一阶段目标：阶段 8-O / P3 profile 机制层输入闭环。把 profile 的 `appliedLayers / unappliedLayers` 映射为每次 invocation 的版本化 layer inputs，统一携带角色面板、动作倍率、敌人防御与元素防御、状态前值、初始能量和培养配置的实际值、来源及 readiness；runtime 校验 applied 层具备输入，unapplied 层继续只追踪不计算。该阶段不启用未确认公式，也不新增 Workbench 小控件。

### 阶段 8-O P3 profile 机制层输入闭环（2026-07-11）

新增 `AzPrThreeValueMechanicsLayerInputs v1`。profile 的每个 operand capability 现在声明本次真正需要的 `layerKeys`；generation 把 applied/unapplied/required 层映射到共享输入表，统一携带角色面板、动作倍率、敌人双防与元素防御、初始能量、培养配置和 operands 的实际值、来源及 readiness。runtime 在同一合同上绑定当前 `stateBefore`，并校验 required applied 层无输入缺口；unapplied 层仍只追踪、不计算。

`Action -> Hit -> ThreeValueDelta` 升级为 v7，`AzPrThreeValueMechanicsAdapter` 升级为 v4，`ThreeValueRuntimeCalculatorInvocation` 升级为 v6。默认 adapter 仍按既有 profile operation 与 operands 计算，缺失 capability 继续回退 generation delta；HP、韧性、角色能量、曲线、日志和 summary 数值不变，没有启用敌人防御、元素防御、暴击、培养或等级公式。同步机制包继续作为 `azpr-mechanics-runtime` chunk。

阶段验收：72 个测试文件、402 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，生产报告结论为 `trial-ready`。生产引用审计为 108 个源码、104 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 368,687B gzip，全部 JavaScript 为 739,932B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 14.818ms、完整 simulation p95 为 28.209ms；120 动作浏览器首屏就绪为 1843ms。

下一阶段目标：阶段 8-P / P3 layer input 驱动计算结果边界。新增版本化 mechanics evaluation，让内置 adapter 从 `mechanicsLayerInputs` 的 required applied 输入执行当前已确认 operation，输出实际使用层、输入 readiness、中间结果和最终 delta；operands 保留为来源与失败回退，不再成为平行主计算入口。开始前先通过证据化代码收束为总 JS 留出可靠余量，不提高预算；仍不启用未确认公式，也不新增 Workbench 小控件。

### 阶段 8-P P3 layer input 驱动计算结果边界（2026-07-11）

新增 `AzPrThreeValueMechanicsEvaluation v1`。内置 adapter 现在只从 `mechanicsLayerInputs` 的 required applied 层和共享输入表执行 profile operation，并输出实际使用层、输入键、来源、readiness、intermediate、operation 和最终 delta。HP 使用角色面板 attack 与动作倍率层；显式能量、已验证削韧/能量样本和兼容 identity 均通过同一 evaluation 边界。required 输入缺失或 capability 不支持时，evaluation 明确无效并回退 generation delta。

`Action -> Hit -> ThreeValueDelta` 升级为 v8，`AzPrThreeValueMechanicsAdapter` 升级为 v5，`ThreeValueRuntimeCalculatorInvocation` 升级为 v7。runtime 删除 `operandsCalculation`、`calculatedFromOperands` 及其跨层汇总，operands 只保留 generation 来源和 fallback；旧 `runtimeCalculatorAdapters` 参数也已退役，替换 adapter 统一使用 `threeValueMechanicsAdapterRegistry`。默认 HP、韧性、角色能量、曲线、日志和 summary 数值不变，未确认机制层仍不计算。

阶段验收：72 个测试文件、403 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，生产报告结论为 `trial-ready`。生产引用审计为 108 个源码、104 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 368,267B gzip，全部 JavaScript 为 739,699B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 18.438ms、完整 simulation p95 为 33.194ms；120 动作浏览器首屏就绪为 1960ms。

下一阶段目标：阶段 8-Q / P3 profile 机制步骤执行链。把 evaluation 的单个 operation 扩展为 profile 声明的有序 step 合同，并提供无 UI operation handler registry；当前已确认 base attack、动作倍率、显式资源和 validated sample 迁入内置 steps，未来确认的防御、元素防御或培养层可以新增 step 而不改 runtime 主链。该阶段必须继续保持默认三值等价、缺口回退和 bundle 守门，不启用任何未确认公式。

### 阶段 8-Q P3 profile 机制步骤执行链（2026-07-11）

`AzPrMechanicsProfile` 的 capability 已从单 operation 改为有序 `steps[]`。`AzPrThreeValueMechanicsEvaluation v2` 逐步执行 operation handler，记录每步 key、operation、使用层、delta 和状态，并把前一步 delta 传给后续步骤；默认 product、sum、before/after 和 identity 五种操作均已迁入内置步骤。自定义 profile 可以注册后续纯函数 step，handler 缺失、异常或 required layer 缺口会停止步骤链并回退 generation delta。

`Action -> Hit -> ThreeValueDelta` 升级为 v9，`AzPrThreeValueMechanicsAdapter` 升级为 v6，`ThreeValueRuntimeCalculatorInvocation` 升级为 v8。operands 不再重复声明 operation，runtime summary 从实际 step results 汇总操作；默认 HP、韧性、角色能量、曲线和日志结果保持不变，没有启用敌人防御、元素防御、培养或其他未确认公式。

阶段验收：72 个测试文件、404 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，生产报告结论为 `trial-ready`。生产引用审计为 108 个源码、104 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 368,271B gzip，全部 JavaScript 为 739,930B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 9.693ms、完整 simulation p95 为 32.666ms；120 动作浏览器首屏就绪为 1742ms。

下一阶段目标：阶段 8-R / P3 机制步骤状态作用合同。让 profile step 在纯计算 delta 之外声明明确的读取状态、作用对象和写入轨道，由 runtime 只应用通过验证的标准 state effect proposal；优先打通 HP、韧性和每角色能量的统一目标/时序边界，为后续确认机制增加步骤提供稳定入口。该阶段仍不追最终倍率，不启用未确认培养效果，也不增加碎片 UI。

### 阶段 8-R P3 机制步骤状态作用合同（2026-07-11）

`AzPrMechanicsProfile v2` 现在为三轨声明标准状态读写：HP 与韧性读取并写入目标敌人状态，角色能量读取并写入 energy owner；每个 step 通过 `stateEffectTrackKeys[]` 声明负责的轨道。`AzPrThreeValueMechanicsEvaluation v3` 继续只计算 delta，同时给出实际负责状态作用的 step key。

新增 `AzPrThreeValueStateEffectProposal v1`。runtime invocation v9 把最终 delta、目标 ID、读写指标、作用模式和命中帧收束成 proposal；runtime state snapshot v2 不再直接按三个旧 delta 字段改状态，只应用验证通过的 proposal。未知轨道、缺失目标、缺失读取状态或无效 delta 会保留审计结果但不修改状态。默认 HP、韧性、各角色能量、曲线和日志结果不变，本阶段没有新增真实公式或 UI。

阶段验收：72 个测试文件、406 条单元/组件测试，39 条 Workbench 主流程和 15 项 production preview 全部通过，生产报告结论为 `trial-ready`。生产引用审计为 108 个源码、104 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 368,729B gzip，全部 JavaScript 为 737,874B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 9.427ms、完整 simulation p95 为 25.120ms；120 动作浏览器首屏就绪为 1435ms。

### P3 机制能力盘点 / P2-P3 桥接检查点

- 正式计算输入：HP raw preview 的角色 attack 与动作倍率；显式角色能量事件 delta；已验证 runtime sample 的韧性/能量 before-after；每次 invocation 的 action、hit、stateBefore、目标敌人与 energy owner。
- 正式状态基线：已选角色配置的初始能量、敌人 HP/韧性配置和继承方案的 initial runtime state；这些进入 runtime accumulator，但不等同于新增倍率公式。
- 仅追踪/来源字段：敌人双防、元素防御、角色培养配置、装备、奇波、灵子、暴击、增伤、敌人等级、候选动作削韧和候选充能字段；它们可随 mechanism configuration/layer inputs 追溯，但当前 calculator 不读取。
- 证据依赖：敌人防御/等级换算、元素防御或抗性、动作真实削韧、命中充能、被动资源修正及培养项效果，必须取得稳定 AzPr 数据源或可复现实战证据后才能逐层接入。
- 暂不处理：测试期最终倍率、未确认防御/抗性/装备/奇波/灵子效果，以及平衡性数值细抠。

下一阶段目标：阶段 8-S / P2-P3 配置来源合同与项目回放一致性。盘点 v13 配置实例到 `AzPrThreeValueMechanismConfiguration` / profile / runtime 的字段覆盖，建立可替换来源合同，并验证同一项目经本地草稿、JSON、分享链接和 PNG 回导后产生一致的配置选择、proposal、三值曲线与日志。该阶段先补配置来源和回放边界，不接入新的公式层，也不增加碎片 UI。

### 阶段 8-S P2-P3 配置来源合同与项目回放一致性（2026-07-11）

新增 `AzPrWorkbenchConfigurationSource v1`。Workbench 构建 Project 时会把活动方案选择与共享配置库实例逐项核对，并比较实例配置和实际解析配置 fingerprint；只有实体、实例 ID 和配置值一致的来源才成为正式 instance-backed 输入。合同用实际参与模拟的配置生成稳定 `replayIdentity`，配置名称和导出时间不影响身份，缺失或错配实例只保留诊断状态。

`AzPrThreeValueMechanismConfiguration` 升级为 v2，并新增 `AzPrThreeValueConfigurationRuntimeBinding v1`，把来源合同、replay identity、实际 mechanics profile 和 runtime consumer 固定在同一可替换边界。runtime summary 传播 identity 与 binding readiness。本地草稿、JSON、分享链接和 PNG 四条独立回导路径已通过同一项目的 compile/simulate 等价测试，配置选择、profile binding、三值 proposal、完整曲线与日志一致；本阶段没有新增公式或 UI。

阶段验收：73 个测试文件、408 条单元/组件测试通过；39 条 Workbench 主流程和 15 项 production preview 全部通过，生产报告结论为 `trial-ready`。生产引用审计为 109 个源码、105 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 367,774B gzip，全部 JavaScript 为 739,605B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 9.622ms、完整 simulation p95 为 28.330ms；120 动作浏览器首屏就绪为 1353ms。

下一阶段目标：阶段 8-T / P2-P3 可回放 mechanics profile 选择合同。开始前先从既有构建归组或重复代码中收出稳定包体余量，不提高预算；随后把当前仅由 `compileProject()` 参数选择的 profile 改为每条方案可持久化的纯数据 ID/版本选择，并通过受控 registry 解析。默认 profile 和三值结果保持不变，项目本地草稿、JSON、分享链接、PNG 与多方案回放必须恢复同一 profile binding。该阶段只建立未来真实机制 profile 的项目边界，不接入新公式，也不增加碎片 UI。

### 阶段 8-T P2-P3 可回放 mechanics profile 选择合同（2026-07-12）

WorkbenchProjectFile 升级为 v14，每条方案新增 `AzPrWorkbenchMechanicsProfileSelection v1`，以纯数据保存 profile ID/版本。根级活动方案、本地草稿、JSON、分享链接、PNG、预设、方案复制与撤销/重做共用同一字段；v1-v13 项目和旧方案自动迁移到默认 preview profile。compiler 通过受控 `threeValueMechanicsProfiles` registry 精确解析，项目不能携带可执行 profile 逻辑。

Scenario 与 `AzPrThreeValueConfigurationRuntimeBinding v1` 现在同时记录 requested/resolved ID/版本、选择来源、fallback 和原因。未注册版本明确回退默认 profile；合法注册 profile 继续通过既有 operation handler 执行。集成测试让活动方案使用注册的等价 profile、第二方案使用默认 profile，并证明本地草稿、JSON、分享链接和 PNG 回导后，两条方案各自的 binding、三值 proposal、完整曲线与日志一致。本阶段没有接入新公式或 UI。

为恢复发布余量，skill core 生产投影不再为已匹配的 1200 个等级重复保存 labels/values，读取端从现有角色技能表恢复同值；不匹配行仍保留差异和 diagnostics。辅助 Workbench 同步依赖也归回已有 secondary chunk。阶段验收：73 个测试文件、410 条单元/组件测试通过；39 条 Workbench 主流程和 15 项 production preview 全部通过，生产报告结论为 `trial-ready`。生产引用审计为 110 个源码、106 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 354,940B gzip，全部 JavaScript 为 726,388B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 11.350ms、完整 simulation p95 为 28.531ms；120 动作浏览器首屏就绪为 1779ms。

下一阶段目标：阶段 8-U / P3 生产 profile catalog 与项目兼容性门禁。把 Workbench、批量方案回放和导入校验统一接到一个只包含受信任 profile 的生产 catalog，输出项目级 compatibility report，区分 exact、fallback、missing 和 invalid；导入项目不能静默改变 profile binding。默认 profile 与三值结果继续不变，不接入未确认公式，也不增加碎片 UI。

### 阶段 8-U P3 生产 profile catalog 与项目兼容性门禁（2026-07-12）

新增 `AzPrThreeValueMechanicsProfileCatalog v1`。生产 catalog 只收录通过既有 profile 校验的纯数据项，重复、无效或缺失默认项会让 catalog 失效；项目文件仍只引用 ID/版本，不能注入 profile 对象、operation handler 或函数。compiler、Scenario 和 runtime binding 使用同一 catalog，并记录 catalog ID/版本、requested/resolved profile、exact/fallback 与兼容性状态。

新增 `AzPrWorkbenchProfileCompatibilityReport v1`，逐方案区分 exact、missing、invalid 以及实际 exact/fallback 解析。只有所有方案 exact 且 catalog ready 时才允许导入。本地草稿恢复、分享链接、JSON/PNG、预设和对比基准都在替换当前工作区前执行该门禁；生产浏览器测试证明引用未知 profile 的项目会被拒绝，当前动作轴和敌人配置保持不变。该门禁已加入 production preview 必需能力清单。

阶段验收：74 个测试文件、416 条单元/组件测试通过；39 条 Workbench 主流程和 16 项 production preview 必需能力全部通过，生产报告结论为 `trial-ready`。生产引用审计为 111 个源码、107 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 355,356B gzip，全部 JavaScript 为 727,845B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 14.934ms、完整 simulation p95 为 45.352ms；120 动作浏览器首屏就绪为 1517ms。

下一阶段目标：阶段 8-V / P2-P3 游戏数据引用与配置兼容性闭环。把角色、敌人、装备、奇波和灵子 ID 统一解析为带数据版本与来源的受信任 catalog 引用，扩展项目 compatibility report，防止游戏数据更新后导入项目静默丢失或替换配置；mechanism configuration 获取实际记录但培养效果继续 unapplied。该阶段不猜装备/培养公式，也不增加碎片 UI。

### 阶段 8-V P2-P3 游戏数据引用与配置兼容性闭环（2026-07-12）

新增 `AzPrWorkbenchGameDataCatalog v1`、`AzPrWorkbenchGameDataBinding v1`、`AzPrWorkbenchGameDataCompatibilityReport v1` 与 `AzPrWorkbenchGameDataReference v1`。角色、敌人、装备、奇波和灵子现在由同一生产 catalog 按 ID 精确解析，并携带 catalog ID/版本、生成数据版本和本地来源。兼容性检查覆盖全部方案与共享配置实例，在既有 normalizer 丢弃未知 ID 之前保留原始缺口；缺失引用、错误装备槽位、catalog 身份变化或数据版本漂移都会拒绝替换当前工作区。v1-v14 项目仅在全部引用仍可解析时迁移。

WorkbenchProjectFile 升级为 v15；本地草稿、JSON、分享链接、PNG、预设和对比基准共用数据门禁。`AzPrThreeValueMechanismConfiguration v3` 与 `AzPrThreeValueConfigurationRuntimeBinding v2` 获取活动角色、敌人和 loadout 的实际 catalog 记录及稳定 reference identity，四种项目载体回放保持同一数据 binding、配置 binding 和三值输出。装备、奇波和灵子效果仍明确不参与 calculator，本阶段没有新增倍率、时序或培养公式。

阶段验收：75 个测试文件、422 条单元/组件测试通过；39 条 Workbench 主流程和 17 项 production preview 必需能力全部通过，生产报告结论为 `trial-ready`。生产引用审计为 112 个源码、108 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 358,889B gzip，全部 JavaScript 为 731,634B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 11.017ms、完整 simulation p95 为 27.286ms；120 动作浏览器首屏就绪为 2022ms。

下一阶段目标：阶段 8-W / P2-P3 动作与技能数据引用兼容性闭环。把动作草稿中的 skill ID、角色归属和动作变体索引接入同一版本化数据门禁，并让 generation 合同消费已解析技能记录；项目数据更新后不能静默换技能、回退动作或丢失分段选择。该阶段保持现有倍率、动作时长和命中帧不变，不做技能证据考古，也不增加碎片 UI。

### 阶段 8-W P2-P3 动作与技能数据引用兼容性闭环（2026-07-12）

`AzPrWorkbenchGameDataCatalog v1` 现在同时收录 120 条生产技能记录。项目兼容性报告在 action normalizer 之前逐方案校验每条技能动作的 skill ID、施放角色、队伍成员身份和动作变体索引；技能缺失、技能与角色错配、角色不在队伍或变体越界都会拒绝导入，避免项目看似恢复成功却已自动换成默认技能或第一个动作。生产浏览器验收已用根级原始 skill ID 缺口证明当前动作轴和敌人配置不会被覆盖。

活动 Project 的 `AzPrWorkbenchGameDataReference v1` 新增 actions 引用，记录实际技能 record、具体 variant、来源和 failure reason，并把动作引用纳入稳定 reference identity。compiler 使用同一 record 生成 Scenario action；`AzPrThreeValueMechanismContext` 升级为 v4，标准 generation contract 升级为 v7，Action、Hit、ThreeValueDelta 和 mechanics adapter request 都传播相同技能/变体引用。现有三值结果、倍率、动作时长和命中帧未改变。

阶段验收：75 个测试文件、424 条单元/组件测试通过；39 条 Workbench 主流程和 18 项 production preview 必需能力全部通过，生产报告结论为 `trial-ready`。生产引用审计为 112 个源码、108 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 360,059B gzip，全部 JavaScript 为 732,809B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 12.393ms、完整 simulation p95 为 27.843ms；120 动作浏览器首屏就绪为 1841ms。

下一阶段目标：阶段 8-X / P3 技能变体到 HP operands 的可信来源闭环。让当前已应用的角色攻击与动作倍率 operands 显式绑定 8-W 的 skill/variant reference identity，并在 compiler、generation 与 adapter evaluation 之间校验倍率值和来源路径一致；不一致时保留诊断而不能静默换来源。该阶段保持现有 HP 计算结果不变，不接入防御、抗性、暴击、装备或培养公式，也不补动作帧细节。

### 阶段 8-X P3 技能变体到 HP operands 的可信来源闭环（2026-07-12）

`AzPrWorkbenchGameDataReference v2` 为每个技能动作生成独立 action reference identity 和 skill/variant reference identity，并在 variant 中固定倍率原始值、解析倍率与来源字段。compiler 使用同一动作引用生成 `AzPrHpOperandSourceBinding v1`，绑定角色面板攻击、已选动作倍率、角色/技能/变体身份和来源路径；generation 的 `AzPrThreeValueMechanicsOperands v2` 与 adapter evaluation v4 逐层复核 identity、倍率、来源和乘积结果。

正常项目继续使用原 `round(baseAttack * actionMultiplier)`，HP、韧性和角色能量结果均未改变。人为篡改 skill/variant identity 时，runtime 仍保留原 generation delta，但 evaluation、invocation validation 和 summary 会明确记录 drift issue，不会静默切换到另一技能或倍率来源。本地草稿、JSON、分享链接和 PNG 四种载体继续恢复同一游戏数据引用与运行结果。本阶段没有接入防御、抗性、暴击、装备、奇波、灵子或动作帧公式。

阶段验收：75 个测试文件、425 条单元/组件测试通过；39 条 Workbench 主流程和 18 项 production preview 必需能力全部通过，生产报告结论为 `trial-ready`。生产引用审计为 113 个源码、109 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 360,769B gzip，全部 JavaScript 为 735,101B gzip，均在 370,000B/740,000B 预算内。180 动作编译 p95 为 18.063ms、完整 simulation p95 为 37.912ms；120 动作浏览器首屏就绪为 1872ms。

下一阶段目标：阶段 8-Y / P3 三轨 applied source identity 统一闭环。把 HP 已建立的可信来源模式扩展到当前已应用的显式角色能量事件和 validated toughness/self-energy sample，使每条 applied delta 都能区分正式来源绑定、兼容未绑定和来源漂移，并在 generation、runtime 与项目回放中保持一致。该阶段只绑定现有事件、capture 和 before/after 证据，不新增公式、不追测试期倍率，也不启用未确认培养效果。

### 阶段 8-Y P3 三轨 applied source identity 统一闭环（2026-07-12）

新增 `AzPrThreeValueAppliedSourceBinding v1`。显式角色能量变化现在固定动作、角色、时间、资源、变化值与原因；validated 韧性/能量 sample 固定 capture session、event、作用实体、Element/path、帧位和 before/after。它与 8-X 的 HP skill/variant binding 共用 `AzPrThreeValueMechanicsOperands v3` 来源字段，并贯通 generation、adapter evaluation、runtime invocation、state snapshot 和 projection summary。

每条 applied delta 现在明确分类为 `bound-ready / compatible-unbound / bound-drift`。正式 binding 的事件、capture、作用对象或数值发生漂移时，runtime 保留原 generation delta 并输出 issue code，不静默换来源；旧 first-vertical fixture 没有 8-W 身份时归入兼容未绑定，不冒充正式 binding，也不误报数据漂移。同一 Workbench 项目经本地草稿、JSON、分享链接和 PNG 回导后，三类来源 identity、proposal、三值曲线和日志保持一致。本阶段没有新增倍率、战斗公式、培养效果或 UI。

阶段验收：75 个测试文件、426 条单元/组件测试通过；39 条 Workbench 主流程和 18 项 production preview 必需能力全部通过，生产报告结论为 `trial-ready`。生产引用审计为 114 个源码、110 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 361,270B gzip，全部 JavaScript 为 737,474B gzip，仍在 370,000B/740,000B 预算内。180 动作编译 p95 为 13.433ms、完整 simulation p95 为 32.756ms；120 动作浏览器首屏就绪为 1694ms。

### 8-M 至 8-Y P2/P3 基线检查点（2026-07-12）

结论：8-M 至 8-Y 已形成可作为下一轮开发基线的运行时与项目回放链，但该基线表示合同稳定和来源可审计，不表示蓝色星原真实战斗机制已经完整复刻。mechanics profile、layer inputs、evaluation、有序 steps、state effect proposal、配置来源合同、profile catalog、game data catalog、技能/动作引用、HP operand binding 和三轨 applied source binding 已贯通 generation、runtime 与项目载体。

- 正式计算输入：角色面板 attack、已选动作倍率、显式角色能量事件、已验证韧性/能量 before-after sample；runtime 还正式读取 `stateBefore`、目标敌人和 energy owner，并只写入通过 proposal 验证的 HP、韧性和角色能量轨道。
- 来源/追踪/兼容诊断：配置和游戏数据 identity、profile 选择与 fallback、`bound-ready / compatible-unbound / bound-drift`、`source-value-identity` 兼容回退及 evidence/candidate 字段只负责追溯、门禁或旧项目兼容，不构成新公式输入。
- 明确未应用：敌人防御与抗性、等级换算、暴击与增伤、装备、奇波、灵子及其他培养效果、未验证动作削韧/命中充能和被动资源修正；这些层继续保持 `unapplied` 或 `appliedToCalculators = false`，取得稳定 AzPr 数据或可复现实战证据前不得接入。

与 Endaxis 的功能层级相比，当前项目已经具备多方案工作区、本地草稿、JSON、分享链接、PNG 四载体交换、回放一致性门禁，以及曲线、日志、三值详情、区段和方案对比。主要差距不在项目载体，而在配置与机制广度及复盘成熟度：Endaxis 已把角色、武器、装备、敌人和队伍配置连接到更完整的状态/效果模拟，并提供更成熟的伤害分析、命中详情、资源监控和战斗日志；本项目目前仍以三轨 preview 合同和未应用培养配置为主。

风险检查：四载体集成测试仍比较相同的配置/数据/profile identity、proposal、三轨来源 binding、曲线和日志，回放链可作为基线；未应用机制边界也由 profile policy、game data reference policy 和测试共同守住。当前高风险是全部 JavaScript gzip 为 737,474B，距离 740,000B 预算仅余 2,526B；同时 HP/applied source binding 及 catalog 周边已出现重复的 hash、number/text normalization、identity 和 diagnostics 组装，继续叠加合同会放大漂移与包体风险。

后续路线已调整：先用一个限时 8-Z 完成 production guard、applied source binding 审计、重复 identity/normalization/diagnostics 合并，并把全部 JavaScript gzip 恢复到不高于 733,000B；随后不插入其他 P2/P3 小阶段，直接进入 Stage 9 的 Endaxis 风格多轨时间轴与团队拓扑重构。

Stage 9 分为三个整块交付：9-A 固定 3 角色槽位，建立每角色动作主轴、奇波子轴、角色能量曲线、奇波能量曲线和敌人事件/HP/韧性组；9-B 让动作、命中节点和 8 条状态曲线共用同一时间坐标、缩放与横向滚动；9-C 收束为时间轴优先的紧凑工作台，配置和复盘进入侧栏。奇波及其他未确认培养效果继续 `unapplied`，Stage 9 不恢复公式考古或测试期倍率研究。

### 阶段 8-Z P0-P3 生产守门与余量恢复（2026-07-12）

新增独立 applied source binding 审计，并把它接入 production preview 前置守门与必需能力清单。审计构造同时覆盖 HP、韧性和角色能量的生产场景，要求三轨完整、`bound-drift = 0`，且所有 `compatible-unbound` 都具备明确兼容状态或诊断；当前结果为 3 条 `bound-ready`、0 条 drift、0 条 compatible-unbound。

共享 `contractValues` 收束来源合同重复的稳定 hash/serialize、数字与文本 normalization、skill variant source identity 和 code diagnostics。skill core 生产投影把连续的 label/value 来源 ID 数组无损压缩为起始 ID 与数量，读取端恢复原数组，完整来源文件和运行时 source identity 不变。三值公式、delta、曲线、日志和未应用机制边界均未修改。

阶段验收：75 个测试文件、426 条单元/组件测试，39 条 Workbench 主流程和 19 项 production preview 必需能力全部通过，生产报告继续为 `trial-ready`。生产引用审计为 115 个源码、111 个生产可达、4 个允许 test-only、0 个孤儿；数据投影审计全部一致。Workbench 主块为 352,439B gzip，全部 JavaScript 为 728,258B gzip，较 8-Y 减少 9,216B，达到 Stage 9 的预留目标。

下一阶段目标：Stage 9-A / Endaxis 风格时间轴数据与布局骨架。固定 3 个角色槽位，为每个角色建立动作主轴、关联奇波子轴、角色能量曲线和奇波能量曲线，另建敌人事件/状态轴、HP 曲线与韧性曲线；先交付 3 角色主轴 + 3 奇波子轴 + 1 敌人轴、6 条能量轴和敌人 HP/韧性共 8 条状态曲线的可见骨架，奇波效果继续 `unapplied`。

### Stage 9-A Endaxis 风格时间轴数据与布局骨架（2026-07-12）

Workbench 项目现固定为 3 个唯一角色槽位，并从同一项目元数据派生 3 个角色动作主轴、3 个角色关联奇波子轴、3 条独立角色能量曲线，以及敌人事件轴、HP 曲线和韧性曲线。奇波轨已连接角色配置但明确不进入 calculator；敌人事件与系统注释从插入、重叠诊断到显示均使用独立轨道。空曲线会从 0 到 30 秒轴末显示各自初始状态，角色能量、敌人 HP 和敌人韧性不再共用一条汇总轨。

三角色拓扑已进入默认草稿、配置实例和项目构建，五载体集成测试比较同一 `timelineTopology`，本地草稿、JSON、分享链接和 PNG 回导保持一致。现行生产预览在 1440px 桌面和 390px 窄屏验证 15 行标签/内容像素对齐、8 条全长曲线可见且无纵向重叠，并生成 `reports/m1b-six-energy-desktop.png` 与 `reports/m1b-six-energy-narrow.png`。

阶段验收：76 个测试文件、428 条单元/组件测试全部通过；20 项 production preview 通过，applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound；生产引用审计为 116 个源码、112 个生产可达、4 个允许 test-only、0 个孤儿，数据投影审计全部一致。Workbench 主块为 354,452B gzip，全部 JavaScript 为 730,287B gzip，低于 Stage 9 的 733,000B 目标线。

下一阶段目标：Stage 9-B / 曲线与动作统一时间坐标。把八条轨内基线升级为消费 runtime state curve points 的阶跃折线，动作、命中、状态点和折线共享同一缩放与横向滚动坐标；移动、复制或删除动作时只更新对应角色/奇波能量或敌人 HP/韧性断点，并用 30 秒长轴验证像素对齐。奇波效果继续 `unapplied`，不新增公式或恢复数值考古。

### Stage 9-B 曲线与动作统一时间坐标（2026-07-12）

八条轨内状态曲线现在直接消费标准 `runtimeOutputs.stateCurves`，不再用候选值或 UI 临时汇总重算状态。每条曲线从 runtime baseline 开始，按 applied delta 的 `timeMs / frameIndex` 和 state snapshot after 值生成水平保持、事件点垂直变化的阶跃折线；3 条角色能量按 `actorId`、3 条奇波能量按 `slotId / kiboId` 独立读取，敌人 HP 与韧性按 `trackKey` 分轨，未命中的轨道保持到轴末的完整水平线。固定轨道标签持续显示当前值与最大值，不随横向滚动离开视口。

动作块、伤害/状态点、阶跃断点和时间网格共用同一个百分比坐标及 track width。时间刻度栏与轨道 viewport 已双向同步 `scrollLeft`；在 30 秒轴和 2x 缩放下，资源动作从角色 1 切到角色 2 时只迁移角色 2 能量点，修改到 600F 后断点与动作起点保持 1px 内对齐，复制增加对应断点，删除后断点消失并恢复全长水平线。桌面与 760px 窄屏截图保存在 `reports/stage-9b-step-curves-desktop.png` 和 `reports/stage-9b-step-curves-narrow.png`。

阶段验收：76 个测试文件、430 条单元/组件测试及 39 条 Workbench 主流程全部通过；production preview 新增 9-B 的角色隔离、HP/韧性分轨、移动/复制/删除、缩放滚动和像素对齐场景。applied source 审计仍为 3 条 bound-ready、0 drift、0 compatible-unbound；生产引用审计 116 个源码、112 个生产可达、4 个允许 test-only、0 个孤儿，数据投影一致。Workbench 主块为 355,379B gzip，全部 JavaScript 为 731,219B gzip，继续低于 733,000B 目标线。

下一阶段目标：Stage 9-C / 时间轴优先的整页结构。以 Endaxis 的紧凑工作台信息层级为参照，让方案栏、三角色/奇波/敌人多轨时间轴和八条曲线成为桌面首屏主舞台；属性、配置、日志和复盘详情进入可切换侧栏或检查区，减少纵向卡片堆叠和重复摘要。该阶段先完成整页结构与响应式布局，再统一视觉细节，不新增公式或拆成碎片 UI 阶段。

### Stage 9-C 时间轴优先的整页结构（2026-07-12）

Workbench 现以时间轴为全宽首行，方案与主流程命令保持在其上方，动作库、运行复盘、属性和配置检查区统一退到二级区域。15 条轨道的默认高度和面板间距已收紧，存在重叠动作、效果区间或事件节点时仍按内容动态增高；运行结果阶段不再把复盘卡片提到时间轴之前。桌面 1440x900 可识别完整轨道归属；390px 窄屏保持固定身份列，时间内容在轴内滚动且无页面横向溢出。

生产预览新增 `stage-9c-timeline-first-workspace` 必需能力，验证桌面首屏、运行结果阶段顺序、窄屏区块分离和 12 行像素对齐；截图保存在 `reports/stage-9c-workbench-desktop.png` 与 `reports/stage-9c-workbench-narrow.png`。阶段验收为 76 个测试文件、430 条单元/组件测试、39 条 Workbench 主流程和 22 项 production preview 全部通过，报告为 `trial-ready`；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound，生产引用和数据投影审计均通过。Workbench 主块为 355,434B gzip，全部 JavaScript 为 731,274B gzip，继续低于 733,000B 目标线。

下一阶段目标：Stage 10-A / 多轨编排实际编辑闭环。让角色动作轨、关联奇波轨和敌人事件轨通过同一编排入口完成合法拖入、移动、复制、删除、框选和撤销/重做，并让项目交换、runtime 重算和八条曲线同步更新。奇波及敌人事件仍只使用已确认来源，未确认效果继续 `unapplied`；阶段交付必须是完整编排能力，不拆成小按钮或样式任务。

### Stage 10-A 多轨编排实际编辑闭环（2026-07-12）

时间轴现提供统一编排入口，角色技能/切人/资源动作、奇波事件和敌人事件分别只能进入合法的角色动作轨、角色关联奇波轨和敌人事件轨。动作可在同类角色或奇波轨之间拖动并重绑归属，复制、删除、撤销/重做会立即重建 runtime；奇波事件是正式 tracking-only 动作，记录角色与当前奇波来源但不进入 calculator，不改变六条能量轴或敌人 HP/韧性。项目 schema 升级为 v16，本地草稿、JSON、分享链接和 PNG 均能恢复相同动作拓扑与模拟结果。

生产预览在 1440px 桌面和 760px 窄屏完成实际拖放、奇波跨角色重绑、敌人事件、撤销/重做、项目导出及轨道完整性检查，截图为 `reports/stage-10a-multitrack-desktop.png` 和 `reports/stage-10a-multitrack-narrow.png`。阶段验收为 77 个测试文件、435 条单元/组件测试、39 条 Workbench 主流程和 23 项 production preview 全部通过；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound，生产引用审计为 117 个源码、113 个生产可达、4 个允许 test-only、0 个孤儿。Workbench 主块为 358,224B gzip，全部 JavaScript 为 734,059B gzip，低于 740,000B 生产硬上限。

下一阶段目标：Stage 10-B / 跨轨批量编排与长轴操作闭环。让跨角色动作轨、奇波轨和敌人轨的框选、批量移动/复制/删除、关系保持与撤销/重做成为一条完整工作流，并在 30 秒及更长轴、缩放滚动和五载体回放下保持动作、曲线与状态点一致；不新增公式或奇波效果。

### Stage 10-B 跨轨批量编排与长轴操作闭环（2026-07-12）

时间轴框选现可跨角色动作、奇波和敌人轨建立混合选择。同一角色拥有的动作与奇波事件可以作为一个原子批次同时平移并重绑到另一角色，角色技能会解析目标角色的合法技能，奇波事件进入目标角色关联奇波轨；包含敌人事件或多个来源角色的混合组不会被误换轨，但仍可整体平移、复制和删除。一次拖动只写入一个历史快照，组内动作关系与相对间隔保持，撤销/重做同步恢复全部轨道、时间和 runtime 曲线。

生产预览覆盖跨轨框选、角色动作与奇波整组换轨、混合敌人事件复制/删除、HP 曲线节点增减、关系复制、单次撤销/重做、30 秒轴 4x 缩放和滚动同步；桌面与窄屏截图为 `reports/stage-10b-batch-desktop.png` 和 `reports/stage-10b-batch-narrow.png`。方案复制、本地草稿、JSON、分享链接和 PNG 回放签名现同时比较动作拓扑、奇波来源、动作关系与 runtime outputs。阶段验收为 77 个测试文件、438 条单元/组件测试、39 条 Workbench 主流程和 24 项 production preview 全部通过；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound，生产引用审计为 117 个源码、113 个生产可达、4 个允许 test-only、0 个孤儿。Workbench 主块为 358,826B gzip，全部 JavaScript 为 734,674B gzip，低于 740,000B 生产硬上限。

下一阶段目标：Stage 10-C / 统一帧游标与多轨状态复盘。让时间网格、动作/命中、八条状态曲线和日志共享一个 60fps 帧游标，在任意帧读取 3 个角色、3 个奇波的能量、敌人 HP/韧性和当前动作；缩放滚动、结果定位与编辑后刷新继续使用同一坐标，不接入新公式。

### Stage 10-C 统一帧游标与多轨状态复盘（2026-07-12）

时间网格、动作块、八条状态曲线断点和 runtime 日志现使用同一个 60fps 帧游标。点击空白网格可自由逐帧检查并清除过期结果焦点；点击动作定位动作起始帧，点击曲线断点或三值日志定位准确 runtime event 帧。轨道标签和八个曲线游标点同步显示该帧的 3 个角色、3 个奇波能量及敌人 HP/韧性，编辑动作起始帧后，游标位置保持不变而该帧状态响应式重算。顶部把手支持拖动和方向键逐帧移动，全高线不会遮挡同帧动作或断点；4x 缩放会自动滚动到所选帧并保持刻度、轨道、断点与游标对齐。

生产预览覆盖角色 2 独立能量阶跃、动作编辑前后同帧状态刷新、日志反向定位、敌人 HP 定位、游标拖动、4x 缩放滚动同步和窄屏无溢出；桌面与窄屏截图为 `reports/stage-10c-cursor-desktop.png` 和 `reports/stage-10c-cursor-narrow.png`。阶段验收为 77 个测试文件、440 条单元/组件测试、39 条 Workbench 主流程和 25 项 production preview 全部通过；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound，生产引用审计为 117 个源码、113 个生产可达、4 个允许 test-only、0 个孤儿。Workbench 主块为 360,466B gzip，全部 JavaScript 为 736,281B gzip，低于 740,000B 生产硬上限。

下一阶段目标：Stage 10-D / 播放控制与区段复盘。基于统一帧游标补齐播放/暂停、逐帧移动、速度与 cycle 区段循环，让动作、八条状态曲线和日志随时间连续复盘；播放状态保持瞬态，不改项目 schema，不新增公式或未确认机制。

### Stage 10-D 播放控制与区段复盘（2026-07-12）

统一 60fps 帧游标现具备完整播放控制：可播放/暂停、前后逐帧、切换 0.5x/1x/2x 速度，并在全轴与当前 cycle 区段之间切换。全轴播放抵达轴末会停在末帧；区段模式使用选中 section 的 `[startFrame, endFrame)` 范围，向前/向后逐帧和连续播放都会在首尾稳定回绕。播放时动作块当前态、三角色能量、敌人 HP/韧性及事件/runtime 日志的当前帧高亮同步移动；手动点击动作、网格、曲线或日志会立即暂停并接管游标。

播放时钟使用 `requestAnimationFrame` 按项目 fps 与速度累计整帧，暂停、项目切换、重置和组件卸载都会取消待执行帧。播放速率、范围模式和运行状态全部是瞬态视图状态，不写入本地草稿、JSON、分享链接或 PNG，cycle boundary 本身仍沿用既有 v16 项目合同。生产预览覆盖全轴播放/暂停、2x 速度、日志随帧高亮、区段首尾逐帧与连续循环；桌面与窄屏截图为 `reports/stage-10d-playback-desktop.png` 和 `reports/stage-10d-playback-narrow.png`。

阶段验收为 77 个测试文件、443 条单元/组件测试、39 条 Workbench 主流程和 26 项 production preview 全部通过；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound，生产引用审计为 117 个源码、113 个生产可达、4 个允许 test-only、0 个孤儿。Workbench 主块为 362,328B gzip，全部 JavaScript 为 738,352B gzip，仍低于 740,000B 硬上限，但仅余 1,648B。

下一阶段目标：Stage 10-E / 生产余量与长轴播放性能收口。优先把总 JS gzip 恢复到 735,000B 以下，并为长轴连续播放、缩放滚动、暂停和卸载清理补性能守门；不新增公式、机制或碎片 UI，完成后再进入下一块 Endaxis 功能差距。

### Stage 10-E 生产余量与长轴播放性能收口（2026-07-12）

生产 `workbench-skill-core.json` 升级为内部 schema v2。生成投影不再为 1,000 个规范等级行重复保存 `level/levelIndex`，单一 subSkill 技能不再逐等级重复 `subSkillId`；交叉校验默认 `matched + labels/values true` 由读取层恢复，只有 2 条真实 mismatch 继续显式保存。完整 `skill-logic-index.json`、`skill-level-crosscheck.json` 和来源证据均未删减，数据投影审计继续逐字段比较生成结果，等级 1/12、逻辑差异和 mismatch 测试证明解析结果不变。

core 文件从 1,355,407B 降至 1,080,871B，Workbench 主块从 362,328B gzip 降至 356,816B，总 JavaScript 从 738,352B 降至 732,840B，恢复 7,160B 余量。生产硬门槛同步从 740,000B 收紧为 735,000B，后续不能重新吃掉本阶段余量。

长轴守门现同时覆盖运行时和浏览器。180 动作本机 5 次测量的 compile p95 为 14.484ms、simulation p95 为 32.007ms、总 p95 为 44.779ms，峰值 heap 158.26MiB。120 动作浏览器首屏为 1769ms；在 4x 缩放、2x 速度下游标从 711F 推进到 811F，轨道自动滚动 198px，刻度保持同步；暂停后帧位稳定，离开 Workbench 后 rAF 审计为 requested 83、canceled 2、active 0。报告为 `reports/long-axis-benchmark.json`、`reports/long-axis-browser-benchmark.json` 和 `reports/bundle-composition.json`。

阶段验收为 77 个测试文件、443 条单元/组件测试、39 条 Workbench 主流程和 26 项 production preview 全部通过；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound，生产数据投影、生产引用与新 735KB 包体门禁全部通过。本阶段没有改项目 schema、三值公式、曲线结果或用户可见机制。

下一阶段目标：Stage 11-A / 时间窗口与角色贡献分析闭环。基于全轴或当前 cycle 区段的 applied runtime transactions，按角色、动作和 HP/韧性/能量聚合，并允许从贡献项定位动作/事件回到编辑；不建立第二套公式，不混入候选值或未应用培养效果，也不把阶段拆成统计标签小修补。

### Stage 11-A 时间窗口与角色贡献分析闭环（2026-07-12）

循环复盘已升级为始终可用的时间窗口贡献分析。无 cycle boundary 时可直接查看全轴；存在边界时可在全轴和各循环区段之间切换。同一批 `runtimeOutputs.hitTransactions.transactions` 按角色与动作聚合敌人 HP、韧性和各角色独立能量，角色归属遵循动作 actor 与 energy owner，不重新计算 delta，也不读取 candidate、装备、奇波或灵子等未应用来源。

每个动作贡献保留首个 applied transaction 的 state point 与帧锚点。点击定位会同步选中时间轴动作、runtime 曲线点和日志，将统一帧游标移动到准确事件帧，并把属性区聚焦到该动作继续修改。桌面时间轴仍是首屏主舞台；390px 窄屏下角色五列表无裁切，动作明细使用局部横向滚动。视觉证据为 `reports/stage-11a-contribution-desktop.png` 与 `reports/stage-11a-contribution-narrow.png`。

阶段验收：77 个测试文件、443 条单元/组件测试，39 条 Workbench 主流程和 27 项 production preview 全部通过，生产报告为 `trial-ready`。120 动作浏览器首屏为 1867ms，2x 播放推进 113F、自动滚动 327px，卸载后活动 rAF 为 0；180 动作 compile/simulation p95 分别为 24.542ms/50.65ms。applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound；总 JavaScript 为 733,513B gzip，低于 735,000B 硬门槛。

下一阶段目标：Stage 11-B / 时间窗口方案对比与差异定位。复用现有双方案 runtime outputs 和 Stage 11-A 窗口聚合，在全轴或同一 cycle 区段比较角色、动作及三值贡献，并从差异项定位回当前或基准方案来源；不建立第二套公式，不接入未确认机制，也不拆成碎片统计 UI。

### Stage 11-B 时间窗口方案对比与差异定位（2026-07-12）

方案对比已改为直接消费当前与基准两侧的 `AzPrContributionWindowProjection`。用户可在全轴或双方共有的同序 cycle 区段切换，比较总体指标、三角色 HP/韧性/独立能量贡献、动作贡献和效果覆盖。比较层不再维护一套平行的动作/角色统计；所有差值均由两份 applied runtime window 结果相减，窗口只筛选交易，不重新生成 delta。无 boundary 时只显示全轴；任一侧缺失的区段会标记为不可比较，不会回退后伪装成目标区段。

动作差异同时携带两侧的 state point 与 frame。当前侧可直接关闭对话框并定位原轴的动作、曲线、日志和属性编辑；工作区基准侧会切换到对应方案后定位。快照、预设或导入项目基准没有活动工作区时，会以独立方案加入当前工作区再定位，原方案不被覆盖。桌面和 390px 窄屏视觉证据为 `reports/stage-11b-comparison-desktop.png` 与 `reports/stage-11b-comparison-narrow.png`；窄屏窗口栏完整同屏，长指标改为单列且无文本重叠，动作表保留局部横向滚动。

阶段验收：77 个测试文件、447 条单元/组件测试，39 条 Workbench 主流程和 28 项 production preview 全部通过，生产报告为 `trial-ready`。120 动作浏览器首屏为 2127ms，2x 播放推进 106F、自动滚动 332px，卸载后活动 rAF 为 0；180 动作 compile/simulation p95 分别为 18.663ms/39.441ms。生产引用审计仍为 117 个源码、113 个生产可达、4 个允许 test-only、0 个孤儿；applied source 审计保持 3 条 bound-ready、0 drift、0 compatible-unbound。总 JavaScript 为 734,625B gzip，低于 735,000B 硬门槛，但仅余 375B。

下一阶段目标：Stage 11-C / 多维复盘生产余量与长轴比较收口。把总 JS gzip 恢复到约 733,000B，并为双 120 动作方案的窗口切换、贡献聚合和来源定位建立浏览器性能守门；优先收束重复投影字段和按需计算边界，不放宽预算、不新增公式或碎片 UI。

### Stage 11-C 多维复盘生产余量与长轴比较收口（2026-07-12）

生产 `workbench-skill-core.json` 升级为内部 schema v3：80 个 12 级技能的 label/value ID 等差范围改由技能级序列描述，等级行只保留例外计数；读取层仍恢复与完整 `skill-level-crosscheck.json` 一致的每级 ID 和交叉校验结果。core 文件从 1,080,871B 降至 921,175B，总 JavaScript gzip 从 734,625B 降至 721,642B，在 735,000B 硬门槛下恢复 13,358B 余量。项目仍为 v16，runtime、calculator、三值结果和用户交互均未改变。

新增双 120 动作方案浏览器守门：初次就绪 2142ms、打开比较 418ms、全轴 120 条和 cycle 60 条动作贡献、窗口切换 246ms、基准动作来源定位 2093ms，全部满足既定预算；离开 Workbench 后比较与对话框均清理。阶段验收为 77 个测试文件、447 条单元/组件测试，39 条 Workbench 主流程和 28 项 production preview 全部通过；180 动作 compile/simulation p95 为 16.901ms/40.680ms。生产数据、生产引用、bundle 和 applied source 审计全部通过，applied source 保持 3 条 bound-ready、0 drift、0 compatible-unbound。

下一阶段目标：Stage 12-A / 分析快照与报告导出闭环。把当前或 A/B 贡献窗口输出为版本化 JSON 分析快照，保留项目、方案、窗口、动作、角色、三值指标与 applied source identity，并支持回读校验和来源定位；不建立第二套计算、不接入未应用机制，也不继续补碎片 UI。

### Stage 12-A 分析快照与报告导出闭环（2026-07-12）

时间窗口贡献与 A/B 方案比较现可导出 `workbench-analysis-report` v1 JSON。报告冻结当前 `AzPrContributionWindowProjection` 或 `AzPrWorkbenchScenarioComparison`，同时记录项目/方案/窗口 identity、动作 `statePointId/frameIndex`，以及每条 applied hit transaction 的 `transactionId/actionId/sourceDeltaIds` 和三值 delta；对应方案草稿随来源一起保存。报告明确声明只读取 applied runtime outputs，不进入 calculator，candidate 与 unapplied 来源不会被提升为分析输入。

统一导入/拖放入口会在项目与 runtime capture 分流之外识别分析报告，验证 schema、计算边界、来源草稿、动作引用和 applied source binding 后打开独立报告视图，不覆盖当前工作区。用户可查看冻结指标与动作差异，也可把当前或基准来源恢复为新的独立方案，并定位到报告记录的动作、runtime state point 和帧。桌面与 390px 窄屏证据为 `reports/stage-12a-analysis-report-desktop.png` 和 `reports/stage-12a-analysis-report-narrow.png`。

阶段验收为 79 个测试文件、452 条单元/组件测试，39 条 Workbench 主流程和 29/29 项必需 production preview 能力全部通过，报告继续为 `trial-ready`。生产引用审计为 119 个源码、115 个生产可达、4 个允许 test-only、0 个孤儿；applied source 保持 3 条 bound-ready、0 drift、0 compatible-unbound。总 JavaScript 为 727,325B gzip，报告视图独立异步 chunk 为 2,705B gzip；180 动作 compile/simulation p95 为 15.229ms/36.416ms，120 动作首屏 1765ms，双 120 动作比较打开 543ms、窗口切换 352ms、来源定位 2481ms，均在既定预算内。

下一阶段目标：Stage 12-B / 分析报告 PNG 与元数据回导闭环。把同一版本化报告渲染为可交付 PNG 并嵌入元数据，支持从 PNG 回读、验证和来源定位；复用 Stage 12-A 与既有 PNG 工具，不新增计算、不改变项目 v16 或三值边界。

### Stage 12-B 分析报告 PNG 与元数据回导闭环（2026-07-12）

分析报告现使用统一查看与导出面板：当前贡献窗口或 A/B 比较先生成并验证同一份 `workbench-analysis-report` v1，再由用户选择 JSON 或 PNG。PNG 导出复用 `snapdom` 懒加载和既有 PNG tEXt/CRC 工具，捕获完整报告元素而非当前视口；导出模式固定 1120px 内容宽度并隐藏 JSON/PNG、关闭、打开来源和动作定位控件，因此成品只保留标题、验证摘要、来源、窗口指标与动作数据。

新增 `workbench-analysis-report-png` v1 元数据。完整报告经共享 UTF-8 base64url 编码写入独立 `PromiliaAxisAnalysisReport` tEXt chunk；统一文件接收器会先识别项目 PNG，再识别报告 PNG，二者不会互相误导入。报告 PNG 回读后再次执行 Stage 12-A 的 schema、来源、动作和 applied source identity 校验，再打开报告并允许恢复来源方案和 runtime 定位。视觉证据为 `reports/stage-12b-analysis-report.png`、`reports/stage-12b-analysis-report-dialog-desktop.png` 与 `reports/stage-12b-analysis-report-dialog-narrow.png`。

阶段验收为 80 个测试文件、455 条单元/组件测试，39 条 Workbench 主流程和 30/30 项必需 production preview 能力全部通过，报告继续为 `trial-ready`。生产引用审计为 121 个源码、117 个生产可达、4 个允许 test-only、0 个孤儿；applied source 保持 3 条 bound-ready、0 drift、0 compatible-unbound。总 JavaScript 为 728,193B gzip，报告视图异步 chunk 为 2,999B gzip；180 动作 compile/simulation p95 为 20.028ms/40.299ms，120 动作首屏 2040ms，双 120 动作比较打开 548ms、窗口切换 326ms、来源定位 2403ms，均满足预算。

下一阶段目标：Stage 12-C / 分析报告可复现性审计。使用当前游戏数据、profile 和标准 runtime 重放报告来源，对冻结窗口或比较输出给出 exact、drift、incompatible 结论及最小差异定位；不覆盖原报告、不新增公式，也不把审计结果当作 calculator 输入。

### Stage 12-C 分析报告可复现性审计（2026-07-13）

分析报告现在会自动执行只读可复现性审计。审计从已验证报告内取出每个 `scenarioDraft`，经当前生产 `createWorkbenchProject -> compileProject -> simulateScenario` 链重放，再复用 `projectCycleSections` 或 `projectWorkbenchScenarioComparison` 重建报告指定窗口；没有平行模拟器或报告专用公式。profile 与游戏数据兼容性、来源数量和窗口可用性先作为门禁，失败时返回 `incompatible`，不会使用 fallback 结果伪装可比较。

新增 `AzPrWorkbenchAnalysisReportReproducibilityAudit v1`。审计逐字段比较冻结 `analysis`、`appliedSourceBindings` 与 `summary`：完全一致为 `exact`；可重放但输出变化为 `drift`，并返回总差异数及最多 12 条字段路径、冻结值和当前值；无法精确解析来源则为 `incompatible` 并记录原因和失败角色。报告查看器直接展示结论与差异，但审计声明 `writesProjectState: false`、`overwritesFrozenReport: false`、`appliedToCalculators: false`，导入报告不会替换当前工作区。

桌面与 390px 窄屏视觉证据为 `reports/stage-12c-analysis-reproducibility-desktop.png` 和 `reports/stage-12c-analysis-reproducibility-narrow.png`。阶段验收为 81 个测试文件、459 条单元/组件测试，39 条 Workbench 主流程和 31/31 项必需 production preview 能力全部通过，报告继续为 `trial-ready`。生产引用审计为 122 个源码、118 个生产可达、4 个允许 test-only、0 个孤儿；applied source 保持 3 条 bound-ready、0 drift、0 compatible-unbound。总 JavaScript 为 731,359B gzip，低于 733,000B 阶段硬目标；180 动作 compile/simulation p95 为 20.028ms/40.299ms，120 动作首屏 2040ms，双 120 动作比较打开 548ms、窗口切换 326ms、来源定位 2403ms，均满足预算。

原定 Stage 13-A 实测校准不再继续；其当前 WIP 已完整封存在本地分支 `deferred/stage-13a-calibration`（提交 `db50c52`），M1 完成前不合并。主线改为 **M1 / Endaxis 级核心排轴体验**：首先完成 M1-A 时间轴信息架构与视觉身份，随后完成 3 人/奇波/敌人配置、拖入动作到 6 条能量与敌人 HP/韧性共 8 条曲线变化、可展示默认方案与完整回放验收。Stage 11/12 分析、比较和报告保留为二级高级能力，不再占用首屏主路径；M1 不新增公式、数值考古、校准或报告合同。

### M1-A 时间轴信息架构与视觉身份（2026-07-13）

Workbench 首屏现以同轴多轨时间轴为主：顶栏只保留高频命令，项目交换与高级能力进入二级菜单；3 个角色身份、3 条奇波子轨、6 条能量曲线及敌人事件/HP/韧性在 1440x900 内完整可读，检查器默认收起并以覆盖层打开。390x900 下身份列保持固定，30 秒时间内容在时间轴内部滚动，页面本身无横向溢出。Promilia 与 Endaxis 对照图保存在 `reports/m1a-workbench-desktop.png`、`reports/m1a-workbench-narrow.png` 和 `reports/m1a-endaxis-reference.png`。阶段验证为 81 个测试文件、460 条测试、M1-A 桌面/窄屏 Playwright、生产构建与引用审计全部通过；Workbench 主块 352,377B gzip，总 JavaScript 734,033B gzip，低于 735,000B 预警线和 740,000B 硬门槛。

下一阶段目标：M1-B / 3 人队与奇波配置闭环。让三个唯一角色槽、各自奇波和敌人选择真正驱动头像、动作库、轨道身份、初始 HP/韧性及配置实例，并保持方案复制、本地草稿、JSON、分享链接和 PNG 回放一致；未确认效果继续 `unapplied`，不研究测试期最终倍率。

### M1-B 3 人队、奇波与六能量轴配置闭环（2026-07-13）

Workbench 现把 3 个角色槽、各自奇波和敌人选择直接连接到时间轴身份与运行时状态。每个角色拥有独立角色能量轴，每只绑定奇波拥有独立奇波能量轴，总计 6 条能量轴；加上敌人 HP 与韧性后，首屏共显示 8 条同轴状态曲线。点击任意角色、奇波或所属能量轴会打开对应配置，点击敌人组会打开敌人选择与初始状态配置；动作库同步显示当前角色绑定的奇波。

奇波能量当前使用 tracking-only 基线：每个槽位独立、初始值为 0、全长保持平线、`appliedToCalculators = false`。本阶段没有新增奇波公式或伪造能量事件。拓扑和 runtime outputs 已进入方案复制、本地草稿、JSON、分享链接与 PNG 的一致性比较；桌面和窄屏证据为 `reports/m1b-six-energy-desktop.png` 与 `reports/m1b-six-energy-narrow.png`。

阶段验收为 81 个测试文件、460 条单元/组件测试和 32/32 项 production preview 全部通过；生产引用审计为 123 个源码、119 个生产可达、4 个允许 test-only、0 个孤立，applied source 保持 3 条、0 drift、0 compatible-unbound。Workbench 主块为 354,059B gzip，总 JavaScript 为 735,885B gzip：超过 735,000B 预警 885B，但仍低于 370,000B/740,000B 发布硬门槛。M1 期间不为该预警单独拆出包体阶段。

下一阶段目标：M1-C / 拖入动作到曲线变化的核心闭环。让角色、奇波和敌人动作从动作库进入合法轨道后响应式编译，并在准确帧更新所属角色能量、已确认的奇波能量或敌人 HP/韧性；未确认奇波效果继续保持平线，不接入新公式。

### M1-C 动作库到运行时曲线核心闭环（2026-07-13）

Workbench 桌面现把动作库与多轨时间轴并排显示。用户可从当前角色动作库直接拖入技能或资源动作，也可拖入已绑定奇波事件和敌人事件；拖放会校验合法轨道、按 60fps 帧吸附，并进入既有标准插入、编译和模拟路径。移动、合法跨轨、复制、删除、撤销/重做后，动作块、命中/状态点、运行日志和曲线断点会同步刷新。

3 条角色能量轴和 3 条奇波能量轴保持六个独立所有者。验收场景中，角色 2 的资源动作只改变角色 2 能量；移到角色 3 后断点只迁移到角色 3。已应用技能同步改变敌人 HP；奇波事件和敌人事件可以编排，但未确认的奇波能量、敌人 HP/韧性效果仍保持 tracking-only 或 unapplied，不伪造曲线变化。JSON 导出、重置和回导恢复相同轨道归属及运行时结果。

阶段验收：82 个测试文件、463 条单元/组件测试全部通过；33/33 项 production preview 必需能力全部通过，报告为 `trial-ready`。生产引用审计为 123 个源码、119 个生产可达、4 个允许 test-only、0 个孤立；生产数据和 applied source 审计通过，applied source 为 3 条、0 drift、0 compatible-unbound。Workbench 主块为 354,995B gzip，总 JavaScript 为 736,813B gzip，低于 370,000B/740,000B 硬门槛但高于 735,000B 预警线。桌面和窄屏证据为 `reports/m1c-library-runtime-desktop.png` 与 `reports/m1c-library-runtime-narrow.png`。

下一阶段目标：M1-D / 可展示默认方案与里程碑验收。提供明确标注的 3 人示例方案，包含多角色动作、至少一个奇波动作/事件、敌人事件和当前正式 applied 或明确 preview 的可见阶跃；随后完成五载体主流程、桌面/窄屏视觉和包体验收并停止，不自动创建 M2 或新校准阶段。

### M1-D 可展示默认方案与里程碑验收（2026-07-13）

首次打开 Workbench 现在直接进入“示例方案 · 预览数据”：3 个角色均有动作，角色 2 有独立资源阶跃，同时包含奇波事件、敌人事件、当前 raw preview 的 HP 变化和明确标注为 preview 的韧性变化。每个角色和每只奇波分别拥有自己的能量轴，共 6 条能量轴；加上敌人 HP 与韧性，时间轴同屏显示 8 条状态曲线。未确认奇波效果继续 `tracking-only / unapplied`，没有新增公式或把示例数值冒充正式机制。

示例已覆盖移动、复制、删除、方案复制、本地草稿、JSON、分享链接与 PNG 回放。验收结果为 83 个测试文件、464 条单元/组件测试，39/39 条 Workbench 主流程和 34/34 项 production preview 必需能力通过；生产引用、数据投影和 applied source 审计通过。Workbench 主块为 355,856B gzip，总 JavaScript 为 737,679B gzip：低于 370,000B/740,000B 硬门槛，但高于 735,000B 预警线。桌面、窄屏首屏和窄屏完整时间轴证据为 `reports/m1d-demo-desktop.png`、`reports/m1d-demo-narrow.png` 与 `reports/m1d-demo-narrow-timeline.png`。

下一阶段目标：按产品指令停在 M1 结束点，等待新的主线定义；不自动创建 M2、Stage 14、校准、报告或公式研究阶段。若后续继续，包体预警是首个工程风险，但只有超过 740,000B 发布硬门槛时才需要专门优化。

### M1 六能量轴运行时一致性收口（2026-07-13）

六条能量轴现由同一标准 `runtimeOutputs.resourceCurves` 合同完整审计：角色与奇波分别记录曲线数和事件点数，一致性检查按两类所有者的合计点数验证 summary、output contract 与 consumer，并把奇波状态点纳入统一运行时引用检查。当前奇波仍是 `tracking-only / unapplied` 零点曲线，本次没有新增能量公式或改变任何三值结果。

验收覆盖 83 个测试文件、464 条单元/组件测试；全套首轮有 2 条 Workbench 用例因 5 秒上限超时，单独重跑均通过且无断言差异。生产构建、applied source 审计和 34/34 项 production preview 通过；Workbench 主块 356,117B gzip，总 JavaScript 737,936B gzip，仍低于 370,000B/740,000B 发布硬门槛。

下一阶段目标保持不变：停在 M1 产品决策点；后续主线需在真实蓝原机制接入、动作/时序内容完整性或试用发布之间明确选择，不自动恢复校准或公式考古。

### M1 六能量轴资源语义收口（2026-07-13）

3 条角色能量轴继续跟踪各角色自身 SP；3 条奇波能量轴现明确跟踪各自绑定奇波的终极技能就绪进度，六个资源所有者互不合并。AzPr Lua 战斗界面通过 `PetUltimateCdTime()` 读取 `cdTime / totalTime`，并在 `cdTime <= 0` 时判定奇波技能可用；定向导出的 `skill_control_500001*` 和 `Element/Pet/500001` 证明动作与 Element 资源可完整读取，但尚未提供可稳定映射到每只奇波的 `totalTime` 来源。

`AzPrKiboEnergyRuntimeCurves` 升级为 v2，在既有曲线上记录 `pet-ultimate-readiness` 语义、观测 API、字段单位和来源状态。当前 0 基线与平线结果完全不变，仍为 `tracking-only / unapplied`，不会进入三值 calculator。Extractor 证据报告位于 `C:\Codex\AzPr Extractor\outputs\axis-pet-500001-skill-control-export-report.json` 与 `axis-pet-500001-element-export-report.json`。

阶段验收：83 个测试文件、464 条单元/组件测试一次通过，34/34 项 production preview 通过；生产引用、数据投影与 applied source 审计均通过，applied source 仍为 3 条、0 drift、0 compatible-unbound。Workbench 主块为 356,481B gzip，总 JavaScript 为 738,311B gzip，低于 370,000B/740,000B 硬门槛但仍高于 735,000B 预警线。

下一阶段目标：优先补齐奇波动作库的数据完整性，把 `pet.json` 的 signature/break/fixed skill 与已导出的 Skill Control 时长、行为节点稳定映射到可编排动作；奇波资源变化只有在找到可复现的 `totalTime` 或正式 runtime 输入后才接入，继续禁止猜测冷却数值。

### M1 奇波动作库真实数据收口（2026-07-14）

Workbench 现为全部 122 只奇波提供 3 个可编排动作，共 366 个动作槽、306 个唯一展示技能：特性技来自 `signatureSkillList`，主动技来自展示用 `skillList`，合击技来自 `breakSkillList`；内部 `fixedSkillList` 只保留为来源追踪，不冒充用户动作。动作库显示真实技能 ID、名称与经源帧率换算到 Workbench 60fps 时间坐标的持续帧数，并可直接拖入所属奇波轨。

完整来源与时序保存在 `kibos.json`；生产 Workbench 按需加载精简的 `workbench-kibo-action-catalog.json`。真实奇波动作进入项目后会在动作块、compiler、sim log 和五载体回放中保留 `skillId / name / eventType / duration / timingSource`。效果边界不变：所有奇波动作仍为 `tracking-only / unapplied`，3 条奇波能量轴保持独立零值平线，不会误写 3 条角色能量轴或敌人 HP/韧性。

阶段验收为 83 个测试文件、465 条单元/组件测试和 34/34 项 production preview 全部通过；生产引用审计为 124 个源码、120 个生产可达、4 个允许 test-only、0 个孤立，生产数据与 applied source 审计通过。Workbench 主块为 357,654B gzip，总 JavaScript 为 739,470B gzip，仍低于 370,000B/740,000B 发布硬门槛，但仅余 530B；新增奇波目录作为静态资源按需读取，没有进入主 JS 包。桌面与窄屏证据为 `reports/m1c-library-runtime-desktop.png` 与 `reports/m1c-library-runtime-narrow.png`。

下一阶段目标：M1 核心动作身份可视化。把角色与奇波动作的真实图标、动作类型、名称和已确认时长统一贯通动作库、时间轴块、检查器与项目回放，让 3 人/3 奇波编排在首屏更接近 Endaxis 的可读层级；继续保持 6 条能量轴独立，不接入未确认奇波效果、冷却值或测试期公式。

### M1 核心动作身份可视化（2026-07-14）

角色与奇波动作现在使用同一套可视身份：动作库显示官方技能图标、名称、类型和已确认 60fps 时长；拖入后，时间轴块与检查器继续显示同一身份；复制、本地草稿、JSON、分享链接和 PNG 回放后仍能恢复。资源同步脚本从 AzPr Extractor 的官方技能图标目录发布 226 个唯一图标，覆盖全部可编排角色动作和 366 个奇波动作；5 个未找到图标的原始记录均为不可编排的被动/测试技能，不形成用户动作缺口。

本阶段没有改变运行时数值：3 个角色与 3 个奇波仍各自拥有独立能量轴，六条能量轴不合并；未确认奇波效果、冷却值、装备效果和公式继续 `unapplied`。验收为 85 个测试文件、469 条单元/组件测试与 34/34 项 production preview 全部通过；生产数据、生产引用和 applied source binding 审计通过，applied source 保持 3 条、0 drift、0 compatible-unbound。Workbench 主块为 358,102B gzip，总 JavaScript 为 739,928B gzip，低于 370,000B/740,000B 发布硬门槛。桌面和窄屏证据为 `reports/m1c-library-runtime-desktop.png` 与 `reports/m1c-library-runtime-narrow.png`。

下一阶段目标：M1 动作事件定位与复盘可读闭环。让动作块、命中节点、资源节点和曲线断点共享动作身份与准确帧定位，用户从任一节点都能查看对应三值详情、返回动作修改并看到响应式刷新；继续保持六条能量轴独立，不新增公式、校准或碎片提示阶段。

### M1 动作事件定位与复盘可读闭环（2026-07-14）

时间轴现直接把标准 `runtimeStatePointContexts` 按动作和准确帧聚合为命中或资源事件节点。用户点击节点即可把统一帧游标移动到对应 60fps 帧，并在既有检查器查看该事件关联的 HP、韧性和能量变化；从详情回到源动作修改起始帧后，事件节点、曲线断点、日志、帧游标和详情会同步刷新。旧的 projection 圆点及分析面板逐段原始伤害列表已移除，避免同一运行时结果出现两套定位入口。

本阶段没有改变计算结果、项目载体或机制边界。3 个角色和 3 个奇波仍各自拥有独立能量轴，共 6 条能量轴；奇波能量继续保持 `tracking-only / unapplied`。验收为 85 个测试文件、470 条单元/组件测试、34/34 项必需 production preview 能力和 35/35 条 Playwright 测试全部通过；applied source 为 3 条、0 drift、0 compatible-unbound。Workbench 主块为 357,977B gzip，总 JavaScript 为 739,780B gzip，低于 370,000B/740,000B 发布硬门槛。桌面与窄屏证据为 `reports/m1-runtime-event-timeline-desktop.png`、`reports/m1-runtime-event-timeline-narrow.png`、`reports/m1-runtime-event-review-desktop.png` 与 `reports/m1-runtime-event-review-narrow.png`。

下一阶段目标：M1 试用工作流 checkpoint。按真实用户视角完整走查默认方案、事件定位、三值复盘、回源编辑和五载体恢复，只选择一个最影响试用的完整流程阻塞项继续处理；不新增公式、校准、报告载体或碎片 UI。

### M1 试用工作流 checkpoint：相邻事件准确定位（2026-07-14）

真实桌面走查发现默认 30 秒示例中，同一动作的 `0F` 与 `36F` 命中节点在默认缩放下发生像素重叠，用户点击早帧节点会实际落到后绘制的晚帧节点。时间轴现按事件间距和当前缩放为同轨相邻节点自动分层；放大后有足够横向空间时可重新共用层级，因此不会永久增加轨道高度。实际浏览器已验证 `36F -> 0F` 往返点击分别定位到 `0s36f` 与 `0s0f`，帧游标、选中态和三值详情一致。

本阶段没有新增 runtime、项目或数值合同，3 个角色与 3 个奇波仍保留 6 条独立能量轴。验收为 85 个测试文件、471 条单元/组件测试、34/34 项必需 production preview 能力和 35/35 条 Playwright 测试全部通过；生产引用、数据投影及 applied source 审计通过，applied source 仍为 3 条、0 drift、0 compatible-unbound。Workbench 主块为 358,023B gzip，总 JavaScript 为 739,826B gzip，仍低于发布硬门槛。

下一阶段目标：M1 同屏复盘不离轴闭环。点击时间轴事件后应在侧边检查器查看准确帧和三值详情，同时保持时间轴在当前视口，不再自动跳到下方旧分析区；回源编辑和返回刷新结果也应保留时间轴上下文。该阶段只处理主流程定位，不新增公式、校准或分析合同。

### M1 同屏复盘不离轴闭环（2026-07-14）

时间轴事件、侧边三值详情、源动作编辑和刷新结果现可在同一轴视口内往返。事件日志同步只滚动日志容器，侧边详情只重置检查器自身滚动位置，不再调用会拖动整个文档的定位行为。实际桌面浏览器验证 `事件 0F -> 编辑到 24F -> 返回刷新结果` 全程保持页面滚动位置不变，帧游标、事件节点和三值详情同步定位到刷新后的 `24F`。

本阶段没有新增项目、runtime 或 calculator 合同。3 个角色与 3 个奇波继续分别拥有自己的能量轴，共 6 条独立能量轴；奇波能量继续保持 `tracking-only / unapplied`。验收为 85 个测试文件、471 条单元/组件测试和 35/35 项 production preview 全部通过；生产引用、数据投影和 applied source 审计通过。Workbench 主块为 358,148B gzip，总 JavaScript 为 739,949B gzip，低于 370,000B/740,000B 发布硬门槛，但已超过 735,000B 预警线且仅余 51B。

下一阶段目标：M1 试用发布主流程验收。使用默认示例在真实浏览器完成“换人/绑奇波/选敌人 -> 拖入动作 -> 同轴复盘 -> 回源编辑 -> 保存与项目恢复”，只选择仍会阻断完整用户任务的问题处理；不新增公式、校准、报告合同或碎片 UI。

### M1 试用发布主流程验收（2026-07-14）

真实生产浏览器从默认示例完成了换人、绑定新奇波、拖入新动作、点击同轴事件复盘、回源修改帧、保存重载和 JSON 恢复。走查发现槽位 3 已有动作在角色替换后会被旧的双角色兼容逻辑回退到角色 1 轨；现已按 `team-slot-1/2/3` 的固定位置统一迁移动作所有者、切人目标和当前动作库身份，角色技能也继续由既有 normalization 为新角色选择合法动作。

本阶段没有升级 Workbench v16、runtime 或 calculator 合同。3 个角色与 3 个奇波继续分别拥有自己的能量轴，共 6 条独立能量轴；换人、绑奇波、拖入、保存重载和 JSON 回导后数量与所有者一致。桌面与 390px 窄屏证据为 `reports/m1-trial-release-desktop.png` 和 `reports/m1-trial-release-narrow.png`。验收为 85 个测试文件、472 条单元/组件测试和 36/36 项 production preview 全部通过；生产引用、数据投影与 applied source 审计通过。Workbench 主块为 358,146B gzip，总 JavaScript 为 739,946B gzip，低于 370,000B/740,000B 硬门槛但仍高于 735,000B 预警线。

下一阶段目标：M1 空方案从零编排验收。从新建空方案配置 3 个角色、各自奇波和敌人，拖入角色/奇波/敌人动作，在同轴查看 6 条能量与敌人 HP/韧性并完成保存恢复；只处理完整任务的实际阻塞，不新增公式、校准、报告合同或碎片 UI。

### M1 空方案从零编排验收（2026-07-14）

新建方案现在保留显式零动作状态，八条状态曲线完整显示从 0 到轴末的初始平线。空方案不再依赖“已有选中动作”才能编排：用户可更换三个角色、绑定三只奇波、选择敌人，再直接拖入角色技能、资源动作、奇波动作和敌人事件。删除最后一个动作后会回到合法空项目，本地草稿和 JSON 恢复保持相同队伍、轨道与运行时结果。

3 个角色和 3 只奇波仍各自拥有独立能量轴，共 6 条能量轴；角色 2 资源动作只改变角色 2，三条奇波能量继续保持 `tracking-only / unapplied` 平线，敌人 HP 与韧性也不串线。桌面与 390px 证据为 `reports/m1-empty-scenario-desktop.png` 和 `reports/m1-empty-scenario-narrow.png`。

阶段验收为 85 个测试文件、476 条单元/组件测试与 37/37 项 production preview 全部通过；生产构建、数据投影、生产引用和 applied source 审计通过。Workbench 主块为 358,175B gzip，总 JavaScript 为 739,969B gzip，低于 370,000B/740,000B 发布硬门槛。

下一阶段目标：M1 试用候选发布 checkpoint。冻结示例方案和空方案的两条核心流程，整理可试用入口、已知限制与真实用户反馈通道；只处理会阻断完整排轴任务的问题，不新增公式、校准、报告合同或碎片 UI。

### M1 试用候选发布 checkpoint（2026-07-14）

候选发布现有单一可复现入口：`npm run test:trial-release`。该命令串行执行单元/组件测试、生产引用审计、Workbench 数据投影审计、包体守门、applied source 审计、生产构建、完整 production Playwright 和 `git diff --check`。生产 reporter 已把示例方案主流程、空方案从零编排与六能量轴事件复盘列为必需能力，不再出现“测试运行但不影响 trial-ready”的弱守门。

`README.md` 已从旧的双角色/v15 描述更新为当前 3 角色、3 奇波、6 条独立能量轴和 Workbench v16。新的 `TRIAL_RELEASE.md` 固定启动步骤、示例/空方案两条必试流程、当前 `applied / preview / tracking-only / unapplied` 边界，以及浏览器、方案载体、动作/轨道/帧位和验收报告的反馈材料清单。

完整候选守门一次通过：85 个测试文件、476 条单元/组件测试；生产引用 125/121/4/0；数据投影全部一致；applied source 为 3 条、0 drift、0 compatible-unbound；37/37 项必需 production capability 全部通过，`reports/production-preview-acceptance.json` 记录为 `trial-ready`。Workbench 主块为 358,175B gzip，总 JavaScript 为 739,969B gzip，仍低于 370,000B/740,000B 发布硬门槛。

本阶段没有修改 UI、Workbench v16、runtime、calculator 或六能量轴结果。当前结论是“核心排轴工作流可试用”，不是“已精确复刻蓝原最终战斗公式”。

下一阶段目标：M1 对标完成度审计。按 Endaxis 核心功能层级和 `DEVELOPMENT_PLAN.md` 逐项检查工作区、队伍/轨道拓扑、编辑、运行时、项目回放和复盘证据，明确已完成、已延期与仍缺失的大能力；审计本身不新增 UI、公式、校准或报告合同。

### M1 对标完成度审计（2026-07-14）

`M1_COMPLETION_AUDIT.md` 已以 promilia `1c625ef`、37/37 项 production capability、桌面/窄屏截图和 Endaxis `c39bd6b` 源码为基线完成逐项核对。M1 的工作区、3 角色/3 奇波/敌人拓扑、6 条独立能量轴、动作编辑、同轴复盘、默认/空方案和五载体回放均有直接证据，可以关闭 M1 核心里程碑；当前总目标仍不能标记完成。

剩余大缺口分为三类：现有 `switch` 动作没有形成按帧变化的受控角色状态；动作关系只支持 `sequence`，尚未覆盖动作/效果触发与消耗语义；装备、奇波、灵子、防御、抗性等真实机制仍需稳定 AzPr 数据或 runtime evidence 后接入。本轮只修正审计与架构文档，没有修改 UI、Workbench v16、runtime、calculator 或六条能量轴结果。

阶段验证：promilia 85 个测试文件、476 条测试与生产构建通过；Endaxis 对照基线 15 个测试文件、230 条测试与生产构建通过；`git diff --check` 通过。

下一阶段目标：受控角色与切人编排闭环。项目显式记录初始受控角色，切人动作在准确帧生成受控角色区间；移动、复制、删除、撤销/重做、循环继承、本地草稿、JSON、分享链接和 PNG 必须恢复同一控制状态，并继续保持 3 条角色能量与 3 条奇波能量互不合并。该阶段不新增伤害公式或分析报告。

### 受控角色与切人编排闭环（2026-07-14）

用户现在可以从三人队中选择初始前台，并用 `switch` 动作在准确 60fps 帧改变当前受控角色。时间轴以区间显示前台归属，帧游标读出当前角色，切人日志记录实际切换前后身份；移动、删除、撤销/重做后控制区间立即重算。循环边界继承边界前一刻的前台，边界上的切人仍留给下游方案执行；方案复制、本地草稿、JSON、分享链接和 PNG 回放保持相同结果。

本阶段没有新增伤害、削韧或能量公式。3 条角色能量轴与 3 条奇波能量轴继续互相独立，切人本身不产生三值 delta；候选值来源仍在二级分析区可追溯，但已从主时间轴移除重复叠层。桌面与 390px 证据为 `reports/controlled-actor-timeline-desktop.png` 和 `reports/controlled-actor-timeline-narrow.png`。

阶段验收为 86 个测试文件、479 条单元/组件测试与 38/38 项 production preview 全部通过；生产引用、数据投影和 applied source 审计通过，applied source 为 3 条、0 drift、0 compatible-unbound。Workbench 主块为 354,877B gzip，总 JavaScript 为 736,801B gzip，低于 370,000B/740,000B 发布硬门槛。

下一阶段目标：动作/效果关系语义闭环。补齐动作触发、效果创建/刷新/消耗和来源回溯的统一关系合同，使编辑、runtime 与项目回放共享同一语义；只接已有确认数据，不新增测试期公式、倍率或碎片 UI。

### 动作/效果关系语义闭环（2026-07-14）

动作后续、效果创建、刷新和消耗现统一投影为 `AzPrActionEffectRelationGraph`。关系图由项目的 `actionRelations` 与动作 `effectCommands` 确定性重建，runtime 事件负责确认实际满足状态；时间轴绘制动作到效果或效果到动作的连线，效果复盘区显示关系与准确帧，事件日志保留同一 relation identity。点击任一关系会同步动作、效果区间、事件和帧游标；移动动作、删除效果及撤销后关系会随 runtime 重建。

本阶段没有新增公式、倍率或项目 schema。关系图明确 `appliedToCalculators = false`；3 条角色能量轴与 3 条奇波能量轴仍是 6 个独立资源所有者，关系编辑和五载体回放不会合并或串写。桌面与 390px 实图复核 `reports/m1b-six-energy-desktop.png` 与 `reports/m1b-six-energy-narrow.png`，可清楚识别每个角色组内的角色/奇波双能量轴。

阶段验收：88 个测试文件、484 条单元/组件测试和 39/39 项 production preview 全部通过；生产引用为 127 个源码、123 个生产可达、4 个允许 test-only、0 个孤立，数据投影一致，applied source 为 3 条、0 drift、0 compatible-unbound。Workbench 主块为 332,935B gzip，总 JavaScript 为 739,955B gzip，低于 370,000B/740,000B 发布硬门槛。

下一阶段目标：P3 六资源所有者机制输入检查点。盘点角色 SP 与奇波终极技能就绪进度中已有稳定 AzPr runtime 来源的事件，只把确认输入绑定到对应角色或奇波能量轴；没有稳定来源的奇波能量继续 `tracking-only / unapplied`，不猜测 `totalTime`、倍率或平衡数值。

### P3 六资源所有者机制输入检查点（2026-07-14）

角色 SP 的正式输入保持为已验证 `recover-sp-applied`。奇波侧确认 `PetUltimateCdTime()` 读取 `PetUltraBlink(205)` 与 `PetUltra(206)` 技能槽冷却，而 `RecoverSPArgs.petDelta` 只在 `SPSystem.OnTransmit(0x12F)` 中向奇波实体转发恢复量；两者不能直接等同。受控采集 manifest 已升级为 v2，新增 `PetEntity.PetUltimateCdTime` hook，并读取实际 `PetEntity.data -> BaseData.configId/entityId`。只有实际奇波实体、固定槽位、角色和奇波 ID 全部匹配且 `cdTime/totalTime/ready` 自洽的观测，才写入对应奇波轴。

奇波曲线合同升级为 v3：以 `totalTime - clamp(cdTime, 0, totalTime)` 展示已观测的终极技就绪值，保留原始冷却、总时长、实体和采样身份。该曲线仍为 `tracking-only` 且不进入 calculator；未观测区间、测试期倍率与 `petDelta` 均不伪造状态变化。现有角色 SP、敌人 HP 和韧性结果未改变。

阶段验收为 89 个测试文件、488 条单元/组件测试与 39/39 项 production Playwright；生产引用、Workbench 数据投影和 applied source 审计通过，applied source 仍为 3 条、0 drift、0 compatible-unbound。四个项目/分析二级入口合并为按需 `workbench-project-tools` 块后，Workbench 主块为 333,512B gzip，总 JavaScript 为 738,369B gzip，低于 370,000B/740,000B 发布硬门槛。

下一阶段目标：P3 六资源观测回放一致性。验证方案复制、本地草稿、JSON、分享链接和 PNG 恢复相同角色 SP/奇波就绪所有者、准确帧和曲线结果，并拒绝所有者漂移或不完整生产采样；不新增公式、倍率、校准或碎片 UI。

### P3 六资源观测回放一致性（2026-07-14）

项目级回放守门已从“六轴拓扑存在、奇波零点”升级为真实非零六轴场景：3 个角色分别产生独立 SP 变化，3 个奇波分别携带 `PetUltimateCdTime` 就绪观测。方案复制、本地草稿、JSON、分享链接和 PNG 会恢复相同的 capture 身份、角色/槽位/奇波所有者、帧点、原始值和 runtime 曲线；角色变化不串轴，奇波三轴各保留一个独立观测点。

采样导入新增奇波 owner-lock：`bindWorkbenchRuntimeSampleCaptures()` 在动作重绑定前核对项目时间轴拓扑中的 `slotId / actorId / kiboId`。缺少拓扑、槽位不存在、角色漂移、奇波漂移或所选动作不属于该资源所有者时，整份 capture 以明确原因拒绝，不再通过重写 `actorId` 掩盖错误；旧角色 SP 外部样本的兼容绑定保持不变。

阶段验收为 89 个测试文件、489 条测试全部通过；生产构建、生产引用、Workbench 数据与 applied source 审计通过，定向 Playwright 验证“导入 runtime capture -> 曲线变化 -> JSON 导出并回载”1/1 通过。Workbench 主块为 333,932B gzip，总 JavaScript 为 738,788B gzip，仍低于 370,000B/740,000B 发布硬门槛。

下一阶段目标：P3 六资源采样导入闭环。支持同一批次的 3 角色 SP 与 3 奇波观测按准确动作和资源所有者批量绑定，并通过一次导入稳定生成完整六轴结果；不新增未确认公式、倍率或奇波效果。

### P3 六资源采样导入闭环（2026-07-14）

Workbench 现在可以从一个 `runtime-sample-captures` 文件一次导入 6 组独立采样。动作绑定顺序固定为：精确来源动作 ID、当前队伍内唯一 owner 动作、旧外部 owner 的选中动作兼容回退。owner 自动绑定会结合角色 ID 与技能 ID；纯奇波观测会结合角色、槽位、奇波 ID 和奇波动作。多 owner、无可用动作、多个候选动作或奇波 owner drift 均会拒绝，UI 不会保存部分成功的批次。

`runtime-capture:normalize` 升级为 v2，可重复传入 `--input` 将多个 JSON/JSONL 会话按顺序打包为一个文件，并记录 `sourceFiles[]`；跨文件重复 `captureSessionId` 会中止。单输入继续保留旧 `sourceFile` 字段。浏览器主流程已实测“三角色/三奇波方案 -> 一次导入 6 组 -> 三条奇波曲线各出现独立断点 -> JSON 导出 -> 重置并回载”。绑定成功不等于机制确认：只有原本已验证的角色 SP 样本会进入 applied 角色曲线，未验证 SP 与未知奇波效果仍不会被推断。

阶段验收为 89 个测试文件、491 条测试全部通过；旧单角色 SP 与新六资源批次 Playwright 2/2 通过，生产构建、生产引用、Workbench 数据与 applied source 审计通过。Workbench 主块为 334,371B gzip，总 JavaScript 为 739,228B gzip，低于 370,000B/740,000B 发布硬门槛。

下一阶段目标：P0/P3 六资源生产试用检查点。把六资源批次打包、一次导入和 JSON 回放列入候选发布必需能力，运行完整 `test:trial-release`，更新试用手册，并重新确认真实生产样本与未应用机制边界；不新增公式、倍率或碎片 UI。

### P0/P3 六资源生产试用检查点（2026-07-14）

候选发布新增 `six-resource-capture-import` 必需能力，并与开发态主流程共享同一套三角色、三奇波和六 capture 夹具。production preview 会实际调用 `runtime-capture-normalizer-v2` 把六个独立 JSON 输入打成批次，再通过 Workbench 一次导入、核对 6 个 `resource-owner-action` 绑定、导出项目 JSON、重置并回载，确认三条奇波观测曲线和六轴 owner 身份保持一致。该流程没有新增 UI、公式或数据合同。

真实样本盘点覆盖当前仓库和 `C:\PC2\Codex\AzPr`：只发现 runtime capture hook manifest、Frida host/agent、normalizer 与 fixture，没有非 fixture 战斗 JSON/JSONL，也没有可通过 `--require-production` 的完整六资源批次。因此 production capability 只证明采样文件工作流、owner 隔离和项目回放；只有既有 validated 角色 SP source binding 可进入 applied 角色曲线，奇波 `PetUltimateCdTime` 仍为 tracking-only，未知装备、奇波、灵子、防御、抗性、等级与培养效果继续 unapplied。

阶段验收为 89 个测试文件、491 条测试和 40/40 项 production preview 全部通过，acceptance 判定为 `trial-ready`；生产引用为 123 个可达源码、4 个允许 test-only、0 个孤儿，Workbench 数据投影和 3 条 applied source binding 审计均通过。Workbench 主块为 334,371B gzip，总 JavaScript 为 739,228B gzip，低于 370,000B/740,000B 发布硬门槛，但已进入 735,000B 预警区。

下一阶段目标：P3 首份非 fixture 六资源受控采样验收。由操作者明确启动获准客户端，先取得至少一份角色 SP 与一份奇波就绪会话并通过 `--require-production`、owner 绑定和 JSON 回放，再扩展到完整 3+3；真实证据到位前不新增公式、倍率或奇波能量推断。

### P3 六资源受控采样范围隔离（2026-07-14）

受控 Frida host 现要求每份正式资源会话显式选择 `--capture-kind role-sp | kibo-energy | toughness`；旧调用继续默认 `all`。agent 会分别只安装 6 个 RecoverSP hooks、1 个 `PetUltimateCdTime` hook 或 2 个 WeaknessPoint hooks，不再让奇波采样因同场触发 SP/韧性事件而改变动作绑定语义。`kibo-energy` 必须同时给出 `slotId / kiboId`，其他单一范围会拒绝奇波参数，所有错误均在 attach 前终止。

JSONL 会话首行新增可选 `captureKind` 与 `binding` 来源字段，完整记录采集时的动作、角色、目标、槽位、奇波和 Element 身份；normalizer 与旧 capture 继续兼容，这些字段只做追溯，不进入 calculator。新版 `--require-production` 会额外要求单一范围、完整 binding 与事件族一致，旧 `all`、范围缺失或跨资源污染只能导入查看，不能声明为真实生产证据。采集工具版本升级为 `1.1.0`，仍保留显式 PID、`--confirm-controlled-session`、GameAssembly 哈希核对、不自动启动客户端和不绕过反作弊的边界。

阶段验收为 90 个测试文件、498 条测试和 40/40 项 production preview 全部通过，覆盖 host 参数门、agent 四种范围安装数、production scope audit 和 normalizer 来源字段兼容；真实 Frida self-test transport 捕获 4 个探针事件。Workbench 主块保持 334,371B gzip，总 JavaScript 保持 739,228B gzip。静态 TC 客户端 `GameAssembly.dll` 仍为 222,485,544B，SHA-256 `c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b`，与 hook manifest 完全一致。当前没有蓝色星原客户端进程，因此本阶段没有附加游戏，也没有生成或声称首份真实战斗 capture。

下一阶段目标：P3 首份非 fixture 六资源受控采样验收。由操作者明确启动获准客户端后，分别以 `role-sp` 和 `kibo-energy` 取得首份真实会话，通过 `--require-production`、owner 绑定和项目回放，再扩展到完整 3+3；不提前推断公式。

### P3 六资源采样计划与离线预检（2026-07-14）

新增 `six-resource-runtime-capture-plan` v1 与 `runtime-capture:plan`：一个计划固定 3 个角色 SP owner 和同槽 3 个奇波能量 owner，共 6 条独立能量轴的来源会话。预检强制同槽角色一致、三个奇波唯一、六个会话/动作/输出唯一，并在客户端未运行时生成六条待执行受控命令；已有文件必须同时通过 production audit 与计划 binding 才计为完成，owner 漂移会阻断整批规范化。该工具不启动或附加客户端，也不新增公式。

验收覆盖空计划命令生成、owner/kibo 重复拒绝、错误已有文件拒绝，以及六份 production 会话从同一计划通过 `--require-production` 规范化。全量 91 个测试文件、501 条测试通过；生产构建、引用/数据/applied source/包体审计和 Frida self-test 均通过，self-test 捕获 4 个事件。Workbench 主块仍为 334,371B gzip，总 JavaScript 仍为 739,228B gzip。六轴 UI、runtime 与 calculator 结果未改变。

下一阶段目标：P3 首份非 fixture 六资源受控采样验收。操作者启动获准客户端后，先采集同一槽位的一份角色 SP 与一份奇波就绪会话，完成 production audit、owner binding 和 Workbench 回放；通过后再按同一计划扩展到完整 3+3，不推断未知公式或倍率。

### P3 Workbench 项目到六资源计划桥接（2026-07-14）

`runtime-capture:plan --from-project` 现可从 Workbench project/draft v1-v16 自动生成同一 `six-resource-runtime-capture-plan`：三个固定槽位、角色 owner、绑定奇波、敌人和六个来源动作直接来自项目 JSON，计划同时记录 `projectBinding`。角色侧优先选择 skill、无 skill 时选择 resource；奇波侧只接受所属 `kiboEvent`。唯一候选自动锁定，多候选必须使用按槽 action override，缺奇波或 owner/kibo 不兼容则在写计划前拒绝。

该桥接不启动客户端、不附加进程、不修改 Workbench 项目或六轴结果。生成后的计划继续走已有文件 production audit、六 owner binding 和批次 normalizer，不存在第二套采样格式。

阶段验收为 91 个测试文件、502 条测试和 40/40 项 production preview 全部通过；生产引用、Workbench 数据、applied source 与包体审计通过，Frida self-test 捕获 4 个事件。Workbench 主块保持 334,371B gzip，总 JavaScript 保持 739,228B gzip。当前仍无客户端进程，因此没有生成或声称真实 capture。

下一阶段目标：P3 首份非 fixture 六资源受控采样验收。操作者启动获准客户端后，从生成计划执行同槽的一份角色 SP 与一份奇波就绪会话，完成 production audit、Workbench 导入和六轴定位，再扩展完整 3+3；不推断未知公式或倍率。

### M2 三人队配置与时间轴可读性整改已通过产品验收（2026-07-14）

时间轴身份区继续作为基础换人与装配主入口：三名角色可直接点击头像换人，每个角色只保留武器、上装、下装、耳环、戒指和灵子 6 个槽位，并以 2 行 3 列显示；奇波选择只放在所属奇波子轨，敌人身份继续直达同一可视选择器。长列表隐藏原生滚动条，只保留一条可拖动的常驻滚动轨，滚轮、触控和滚动链均限制在面板内。

时间轴现占满首屏剩余高度并在内部纵向浏览，角色轨提高到足以显示接近正方形的六格装配，8 条能量/敌人曲线也从工程细线提高到可辨识高度。动作块按轨道类型居中，上方保留 Buff 区、下方保留 CD 和运行时节点区；缩放或长轴触发横向滚动条时，固定外框高度保持不变，不再推挤页面。桌面与窄屏生产预览已覆盖轨道对齐、装配格比例、动作上下留白、曲线高度和滚动条稳定性；P3 非 fixture 真实采样继续暂停。

动作块取消 8% 展示宽度下限，块宽与关系布局均按真实 `durationMs / axisDurationMs` 计算；内部内容改为不参与宽度撑开，短动作自动收起持续时间手柄并保留整块拖拽热区。真实默认/空方案装配、撤销/重做、拖入动作与保存回载继续纳入浏览器守门，M2 路径覆盖单滚动轨、内部滚动、后台锁定、动作像素宽度、轨道可读尺寸和时间轴外框高度稳定性。M2 已通过产品验收；93 个测试文件、508 条单元/组件测试和 41/41 production preview 全部通过，生产引用、数据、bundle 与 applied-source 审计通过，总 JavaScript gzip 为 719,860B，Workbench 主块为 329,042B。

下一阶段目标：M3 真实动作状态生成闭环。先审计真实动作目录中可信的 CD 与效果生命周期来源，再复用现有 generation、execution plan、readiness timeline、effect runtime 和同轴投影，使从动作库拖入的真实动作自动形成有来源的 Buff/状态区间、CD 条和生命周期节点，并在编辑、循环与五载体回放后保持一致。缺少可靠来源时保持空区或平线，未知效果继续 `tracking-only / unapplied`；不启动 P3 非 fixture 真实采样，不接入测试期倍率、培养公式、防御或抗性。M3 完成后停止等待产品验收。

### M3 真实动作状态生成闭环已完成并通过产品验收（2026-07-16）

真实目录审计现确认 120 个角色技能中 52 个具有结构化 CD，其中 40 个来自 `skillsub_logic.coolDown`，12 个星决技在逻辑 CD 为 0 时使用正值 `skill_level.coolDown`；源表均为 0 时保持“未提供”。366 个奇波动作全部读取标准战斗 CD，奇波对战 CD 仅保留为诊断来源。6 个 Buff 候选中仍只有寒悠悠 `10100322` 具备可直接绑定的 57F 触发与 8000ms 生命周期，其余保持 tracking-only，未确认奇波效果不生成状态。动作草稿、Project、compiler、readiness、effect runtime、区间与关系图共享同一来源 identity；同 owner 重叠 Buff 与不同技能 CD 独立占行，奇波 CD 固定进入所属奇波子轨。水灵偶 `灵偶涟漪` 已按精确奇波/技能身份显示结构化 `24000ms` CD，同技能窗口内复用和可确认星决技复用均会被统一冲突链阻塞。冷却保留来源基础值与 adapter 计算后的有效值，当前没有可信技能/Buff 修正时只透传基础值，不写死未来机制。全部自动效果仍 `appliedToCalculators = false`，不改变 HP、韧性和六条资源曲线。

完整 `test:trial-release` 通过：97 个测试文件、530 条单元/组件测试、43/43 production preview，生产引用、数据、动作状态、bundle 与 applied-source 守门全部通过；总 JavaScript gzip 为 729,806B，Workbench 主块为 338,493B。新增桌面/窄屏证据为 `reports/m3-water-kibo-cooldown-desktop.png` 和 `reports/m3-water-kibo-cooldown-narrow.png`。M3 已通过产品验收。

下一阶段目标：M4 约束感知排轴与自动整理。复用现有同轨占用、CD readiness、受控角色区间、动作关系和时间边界规则，为动作库拖入、已有动作移动、复制粘贴和跨轨批量编辑提供统一放置提议，并在时间轴中显示合法、可调整、确定阻塞或条件未决的 ghost 与帧位引导。自由模式继续允许保留冲突用于诊断；约束辅助只在用户明确选择时把动作或动作组事务式提交到不早于请求帧的最早合法位置。未知机制不自动推断，M4 不新增公式、真实采样、培养效果或分析报告；完成后停止等待产品验收。

### M4 约束感知排轴与自动整理已完成并通过产品验收（2026-07-16）

时间轴现提供显式“自由 / 辅助”模式。自由模式允许用户保留冲突并继续由既有 diagnostics 解释；辅助模式在任何历史写入前统一评估动作库拖入、移动、复制粘贴、关系组、跨轨和批量平移，只对有确定来源的同轨占用、CD 与边界规则采用不早于请求帧的最早建议位置，确定阻塞时整组不落盘，未知条件仍原位提交并标为未决。同轴 ghost、请求帧和建议帧引导与动作、Buff/CD、八条曲线共用坐标，结束后立即清理；没有修改 HP、韧性、六资源曲线或未确认机制。

完整 `test:trial-release` 通过：98 个测试文件、544 条单元/组件测试、44/44 production preview，41 项必需能力判定为 `trial-ready`；生产引用、游戏数据、动作状态、applied-source 与 bundle 守门全部通过。总 JavaScript gzip 为 735,830B，Workbench 主块为 344,517B，低于 740,000B/370,000B 硬门槛。桌面与窄屏证据为 `reports/m4-constraint-placement-desktop.png` 和 `reports/m4-constraint-placement-narrow.png`。M4 已通过产品验收。

下一阶段目标：M5 可复用编排片段与动作组模板。把当前多选动作或完整关系组保存为局部片段，在现有动作库中拖回任意身份兼容的方案；片段只保留来源 identity、固定队伍槽兼容要求、相对帧差、轨道和关系，插入时重新经过 M4 放置提议并重建 M3 generation/runtime。M5 不做自动最优循环、数值评分、真实采样、公式研究或社区模板平台，包体只在阶段末统一检查。

### M5 可复用编排片段与动作组模板已完成并通过产品验收（2026-07-17）

Workbench 现可把当前多选动作或完整关系组保存为独立版本化片段，并在“动作 / 片段”库中搜索、复制、删除、导入导出及拖回兼容方案。片段保留来源 identity、固定队伍槽、角色/奇波要求、相对帧差、轨道和关系，不携带旧 CD、Buff、曲线或日志；插入时整组复用 M4 放置提议和单次历史事务，再由 M3 generation/runtime 重建状态。真实角色/奇波关系组已覆盖辅助避让、自由冲突、轴末整体阻塞、身份不兼容、撤销/重做、项目回载及 390px 拖拽，无未知 owner 猜测或部分落盘。

完整 `test:trial-release` 通过 100 个测试文件、553 条单元/组件测试、45/45 production preview 和 41/41 必需能力，验收报告判定为 `trial-ready`；生产引用、数据、动作状态、applied-source 和 bundle 守门全部通过。总 JavaScript gzip 为 723,205B，初始入口为 89,229B，Workbench 主块为 338,124B；视觉证据为 `reports/m5-timeline-fragment-desktop.png` 与 `reports/m5-timeline-fragment-narrow.png`。M5 已通过产品验收。

下一阶段目标：M6 真实三值机制接入与同轴演算。权威来源为 AzPr 知识库 2026-07-18 的 verified 战斗公式包：Q16.16 数值运行时、普通/失序爆发/真实伤害、护盾、削韧与 Break、前后台自动回能以及角色/奇波命中回能均已复原，并有 18/18 复算验证、机器证据和真实技能样例。M6 先把这些产物同步成仓库内版本化公式与动作元素包，再通过现有 generation、mechanics adapter 和 hit transaction 驱动三角色 SP、三奇波能量、敌人 HP 与韧性/Break 八条同轴曲线。输入或来源不完整时继续明确 `unresolved / unapplied`；不重新研究公式，不接入未确认装备、灵子、培养效果、特殊开关、吸血、反伤或事件回调。

### M6-R 数值链与稀疏曲线整改已完成，等待产品复验（2026-07-18）

仓库现有单一受控同步/审计入口，可把知识库复算器、证据、真实样例和完整 Battle 来源生成可发布的 verified 公式包。当前包通过 18/18 向量验证，覆盖 619 个候选动作、224 个 applied 动作绑定和 1763 个 applied hit 绑定；208 个敌人韧性 profile 中 204 个通过原表交叉校验并可应用，4 个保持 unresolved。新建方案默认使用 verified profile，旧载体保留原 profile，来源或输入不完整的动作与敌人不会静默回退到预览计算。

现有 generation、mechanics adapter、hit transaction 与 runtime projection 继续消费同一 verified runtime。M6-R 将属性 227 统一为 `SPRET_AUTO`，按各角色/奇波 owner 读取命中回复属性并按 DamageElement identity 限流；其最初记录的 `1 -> 0` 消耗结论已由 M6-R2 推翻，最终语义为 `100 -> 0`，不足 `100` 会阻止伤害、CD 和效果。HP 与削韧保持知识库 Q16.16 顺序，并分别按自身 max 归一化。

曲线新增独立显示投影：100ms 自动回能与韧性恢复压缩为斜率边界、回满点和终点，离散变化保留 before/after 阶跃；同一动作密集命中聚合，不同动作保留独立来源。逐 tick 白点、动作下方 Lightning 队列、重复菱形和 glow/filter 已移除。该结果继续作为 M6-R2 的显示基线。

### M6-R2 SP 单位契约修正已完成，等待产品复验（2026-07-19）

角色与奇波现统一使用 `0..100` 绝对 SP 点：基础 `MAXSP=1` 通过各自成长模板倍率 `100` 得到最终上限，`spCost=100` 不再除以 `100`。自动回复 1 秒为 `0.208282`、30 秒为 `6.248474`；芃芃 `101007012` 单次有效命中回复角色 `1.069992`、奇波 `4.161102`，重岩蹄 `50046903` 满值在施放帧 `100 -> 0`，`99/100` 阻止执行。v1-v16 载体在统一入口迁移，新写出使用 schema v17 和绝对点语义；空奇波槽也显示 `0/100`。

105 个测试文件共 582 条单元/组件/集成测试及 46 条 production preview 已纳入最终守门；总 JavaScript gzip 为 739,933B，Workbench 主块为 354,623B。桌面与窄屏证据为 `reports/m6r2-sp-units-desktop.png` 和 `reports/m6r2-sp-units-narrow.png`。当前停在 M6-R2 等待产品复验，不进入 M7。

### M7 全角色、全技能三值映射与运行时覆盖已完成，等待产品验收（2026-07-19）

当前客户端 20 个角色、122 个奇波的 562 个顶层公开动作已全部进入可审计分类：318 个可运行，244 个因投射物命中时点、触发帧、control variant 或基础函数输入不足保持 `unresolved`，没有把缺源写成零。生成包审计 1,174 个来源命中节点并发布 1,028 个完整动作命中绑定；667 个非零回能元素全部关联或进入结构化 unresolved 报告。通用 verified runtime 已按选定 control/subskill 驱动八条曲线，寒悠悠星鸣技、末音重击和 500001 奇波主动技的逐段 HP、韧性及共享回能通过跨 owner 精确断言，五种项目载体恢复同一结果；动作库会明确标出未完整项及原因。

完整 `test:trial-release` 通过 105 个测试文件、586 条测试和 47/47 production preview，所有生产数据、来源与映射审计通过。总 JavaScript gzip 为 739,564B，Workbench 主块为 365,560B；视觉证据为 `reports/m7-catalog-runtime-desktop.png` 与 `reports/m7-catalog-runtime-narrow.png`。当前停在 M7 等待产品验收，不自动进入下一里程碑。

### M7-R1 普攻输入链拆分已完成，等待产品复验（2026-07-20）

动作库仍只显示一个“普攻”入口，但一次拖入现按客户端 control 边界生成可独立编辑的 `A1..An` 兄弟动作。当前 20 名角色共生成 20 条链、95 个输入段（49 个完整绑定、46 个明确 unresolved），覆盖数据驱动的 5/4/3 段链；单次输入内多 hit 只归属对应 A 块。逐段移动、删除和编辑只重算自身节点，整链插入保持单次撤销事务，旧聚合普攻仅在可唯一解析时迁移，五种项目载体保持块 ID、顺序和三值结果。

完整 `test:trial-release` 通过 106 个测试文件、597 条测试和 48/48 production preview；总 JavaScript gzip 为 680,130B，Workbench 主块为 368,851B。桌面与窄屏证据为 `reports/m7r1-attack-input-chain-desktop.png` 和 `reports/m7r1-attack-input-chain-narrow.png`。当前停在 M7-R1 等待产品复验，不进入 M8。

### M7-R2 普攻连段时序修正已完成，等待产品复验（2026-07-20）

普攻输入段现把完整动画、末次命中、EventBridge 输入窗口和有效占轴时长分开记录。当前 95 段中 63 段有可靠时序，32 段保持 `unresolved`；莉莉 A1-A5 已从错误的完整动画 `155/221/282/192/293F` 改为真实有效占轴 `19/32/40/42/56F`，完整动画只保留为来源证据。旧版未编辑连段会自动紧凑迁移，单段编辑保持独立，窗口外自由排轴只产生可操作诊断。

发布守门通过 106 个测试文件、599 条测试和 48/48 production preview；五载体保持采用的输入窗口、有效时长和逐段运行时结果。总 JavaScript gzip 为 681,539B，Workbench 主块为 369,983B；桌面与窄屏证据为 `reports/m7r2-attack-input-timing-desktop.png` 和 `reports/m7r2-attack-input-timing-narrow.png`。当前停在 M7-R2 等待产品复验，不进入 M8。

### M7-R3 按键操作轴与合击约束已完成，等待产品复验（2026-07-20）

时间刻度上方现有一条与动作共享缩放、滚动和帧坐标的按键操作轴。中央蓝色星原 PC profile 统一解析 LMB、E、R、Q、F 与 1/2/3 换人；奇波只有 verified control 的 `spCost > 0` 才显示 Q。角色星结合击必须与当前已装备奇波的合击在同一 60fps 帧发动，合法配对只显示一个关联双方 action 的 F；无奇波、缺少配对或错帧都会阻止双方运行时执行。多 hit、自动事件、CD 和 Buff 不重复生成输入；纯投影不新增载体字段。

合击排轴现不再要求手工拼接：拖入角色星结合击或奇波合击任一侧，系统都会在一次事务中自动补齐另一侧并吸附到同一帧；任一侧移动、复制或删除时整对同步，撤销/重做和五载体回载保持关系。无已装备奇波、缺少可靠对应动作或身份不匹配时整次拒绝，不留下半套动作。

完整发布守门通过 109 个测试文件、613 条测试、48/48 production preview 和 41/41 必需能力；总 JavaScript gzip 为 688,924B，初始入口 89,228B，Workbench 主块 369,906B。桌面、窄屏、技能/长按和合击配对证据保存在 `reports/m7r3-operation-axis-*.png` 与 `reports/m7-catalog-runtime-*.png`。产品已于 2026-07-21 确认 M7-R3 验收通过，M8 以该版本为基线。

### M8 产品目标确认与里程碑定义（2026-07-21）

产品方确认下一里程碑目标：在队伍印记资源轴、技能动作与 buff/印记绑定之外，把灵子和饰品装备对角色属性、角色属性对奇波属性，以及这些属性和动态效果对实际动作结果的影响一起接入，形成实际战斗数值机制的完整闭环。

可行性已核对：`BWiki/data/combat-formula-knowledge.json` 提供 30 条统一机制条目；报告构建脚本直接读取属性、SP、调谐、公式、系数和敌人韧性结构化快照，完整 Battle 导出和 NewTable 可生成技能级效果图。知识库覆盖角色 EB/EP/EE 静态链、灵子/饰品装备/星赐/好感度、147 个战斗奇波的底值与角色继承、1173 条动态 PropertyChange 引用、568 条直接 SP 元素、九元素印记和 verified Q16.16 结算。DOCX 只作为人读报告，不进入产品数据链。

M8 拆分为 M8-A（机器证据包与静态属性编译）、M8-B（全动作 Battle 效果绑定与动态属性运行时）、M8-C（队伍印记与九属性调谐运行时）、M8-D（同轴 UI、数值溯源与全量验收）。数据边界不变：只消费机器快照和原始配置，不从技能描述文本推断数值；缺源保持 `unresolved`，吸血、反伤、未解释事件回调与 `useOneBreak` 不伪造。各子阶段按顺序提交，包体只在阶段发布守门超限时处理，不以压缩工作替代功能推进。

### M8-A 机器证据包与静态属性编译已完成（2026-07-21）

统一 verified-combat 包现保存知识索引、6 份机器事实报告及静态 NewTable 输入的来源 identity、SHA256 和验证状态；唯一静态编译器按客户端顺序计算角色等级、星赐、好感度、灵子、五件装备以及奇波物种、成长、爱好、悟性和亲密度继承。装配变化会从同一编译结果更新角色面板、奇波继承与下游动作结果，动态灵子/套装效果保持 `unapplied`，未知身份保持 `unresolved`。20/17 角色和 122/147 奇波的集合差异已经显式分类，没有删项或伪造 profile。

完整发布守门通过 110 个测试文件、618 条测试和 49/49 production preview；总 JavaScript gzip 696,976B，Workbench 主块 369,521B。下一步为 M8-B：从完整 Battle 配置生成全动作效果图，并让已验证动态属性生命周期改变后续动作结算。

### M8-B 全动作效果与动态属性运行时已完成（2026-07-21）

唯一同步入口现递归生成完整 Battle 效果图，并将 562 个公开动作关联到 3,202 条动作级效果绑定。逐维审计覆盖 Damage、PropertyChange、Sp、Heal、Shield、Inject、Pack、Judgment、Stack 及印记容器；50 条来源完整的动态属性绑定正式计算，其余均以 `verified-zero / unresolved` 和结构化原因保留。统一 generation、effect runtime 与 verified combat runtime 已接通真实生命周期和后续命中重算，阻塞动作、手工追踪效果及来源不完整的循环状态不能越过 calculator 边界。

发布守门通过 111 个测试文件、622 条测试和 49/49 production preview；总 JavaScript gzip 702,741B，Workbench 主块 362,616B。下一步为 M8-C：以现有效果图驱动队伍印记获取、逐层到期、消费和九属性调谐，不扩展未闭环回调。

### M8-C 队伍印记与九属性调谐运行时已完成（2026-07-21）

verified 包 v9 已将九种印记的容器、持有模板、超限包和属性来源纳入唯一同步入口；真实动作帧驱动团队池逐层获取、20 秒到期与实际消费，九属性持有/超限结算复用现有 Q16.16 runtime 和 effect timeline。初始状态 schema v4 与循环边界保留逐层剩余时间、5 秒就绪及来源，五载体回放签名覆盖印记事件与最终状态；歧义分支和未闭环雷链目标继续 `unresolved`。全量单测通过 112 个测试文件、628 条测试，下一步为 M8-D 同轴印记资源、装配/动作数值溯源和完整发布验收。

### M8-D 同轴 UI 与数值溯源已完成并通过产品验收（2026-07-21）

时间轴现按实际涉及元素显示稀疏的 0-5 队伍印记曲线及获取、消费、到期节点，并与操作轴、动作、效果区间和八条战斗曲线共享同一帧坐标。节点可回到来源动作，检查器展示动作、效果、属性快照、命中与状态/印记的统一因果链；五载体从 runtime 重建相同结果，不保存第二份 UI 数值真相。未闭环机制继续 `unresolved`。

完整发布守门通过 115 个测试文件、635 条测试、50/50 production preview 和 41/41 必需能力；总 JavaScript gzip 713,608B，Workbench 主块 369,696B。桌面与窄屏证据为 `reports/m8d-verified-mechanics-desktop.png` 和 `reports/m8d-verified-mechanics-narrow.png`。M8 当前等待产品验收，不自动进入下一里程碑。

产品复验发现队伍印记的逐角色 calculator 目标副本被效果轴重复绘制。现已明确区分“运行时计算实例”和“时间轴显示事实”：逐角色副本继续参与计算与审计，但由唯一队伍印记资源轴负责可视化；真实独立 Buff、减益和持有效果区间不受影响。整改后完整发布守门通过 115 个测试文件、636 条测试和 50/50 production preview；总 JavaScript gzip 713,761B，Workbench 主块 369,839B。

独立验收再次执行完整 `npm run test:trial-release`，115 个测试文件、636 条测试、50/50 production preview、41/41 必需能力以及 verified-combat、生产引用、数据、动作状态、applied-source 和包体守门均通过。M8 产品验收通过。

### M9 全动作时序、派生与角色资源机制收口计划（2026-07-21 修订）

M8 已建立全链基础，但动作覆盖仍把一部分“时长未解析”压成一帧：当前普攻输入链的 95 个动作段中有 29 个 `durationFrames=1`，且这些项本身仍标为 `unresolved`；红宝石 A1-A5 和涂山小玉 A1/A2/A4/A5 均受影响。非普攻动作也尚未做同口径的完整时长审计。与此同时，普攻、重击和技能存在由输入窗口、前置动作或角色特殊资源决定的派生形态，不能只把基础 action 的数值效果绑定上去。

M9 因此调整为 M9-A（全动作时长与输入占轴审计）、M9-B（派生动作与角色特殊资源状态机）、M9-C（效果语义、目标/触发与公式收口）、M9-D（公开动作可运行覆盖与真实队伍验收）。角色特殊资源使用通用 owner/resource 合同与独立阶梯轴，红宝石和涂山小玉只作为真实验收实例；资源在准确帧获取、消耗、到期并决定同一输入的实际派生形态。描述仅用于发现和命名候选，时间、条件和数值必须回到 `skillsub_logic`、control/resourceMap、EventBridge、Battle 配置与知识库机器证据。

已经开始的效果目标枚举分流和语义效果投影作为 M9-C 前置成果保留，但不得越过动作时长与实际变体直接进入数值运行时。目标不是追求好看的覆盖率数字，而是让每个从 `unresolved` 转为 `applied` 的时长、派生、资源和效果都能回到唯一 Battle identity、决策帧和复算步骤；运行时碰撞、选敌及知识库未闭环回调继续明确保留。

M9-A 已完成：562 个公开动作中 527 个占轴时长可应用、35 个保持未解析；95 个普攻输入段中 64 个可应用、31 个保持未解析，一帧兜底清零。输入、占轴、动画、命中、连段窗口与 CD 已拆为独立来源合同，未解析动作不再进入运行时。完整发布守门通过 115 个测试文件、640 条测试与 50/50 production preview；Workbench 主块为 368,934B gzip，总 JavaScript 为 715,233B gzip。

M9-B 已完成：同步包和唯一运行时现从客户端关系生成实际动作变体与角色特殊资源状态。红宝石、涂山小玉的已确认资源在准确帧获取、消耗、转化和到期，并在输入前决定实际 subskill；无对应 profile 的角色不显示空资源轴。循环与五载体回放保持相同资源状态和变体选择，未确认包装关系、投射物时点及第三个无静态 identity 的 charging module 继续 unresolved。完整发布守门通过 116 个测试文件、647 条测试与 50/50 production preview；Workbench 主块为 367,155B gzip，总 JavaScript 为 720,691B gzip。下一阶段转入 M9-C 效果语义、目标/触发与公式收口。

M9-C 已完成：完整 Battle 图归一为 3,122 条可复现语义效果，最终玩法效果、结构 wrapper、静态证据缺口与运行时依赖已分开审计。304 条来源完整的字面属性效果通过唯一 Q16.16 注册表进入 effect runtime，既有调谐机制继续复用 M8 状态机；其余函数、条件与运行时碰撞不猜值。3,648 组等级值等价校验、117 个测试文件、651 条测试和 50/50 production preview 全部通过，总 JavaScript gzip 721,772B。下一阶段进入 M9-D 固定产品分母与真实队伍连续因果链验收。

### M9-D 公开动作运行时覆盖已完成，等待产品验收（2026-07-21）

M9-D 现以 562 个公开动作、20 名角色和 122 只奇波为固定产品分母；373 个动作可运行，189 个未解析动作全部按运行时依赖或静态证据缺口解释，没有静默遗漏。667 个非零回能元素已拆为 153 个当前动作已应用、38 个当前动作未解、76 个未选 control 变体和 400 个目录外元素。寒悠悠、红宝石、涂山小玉与三只奇波的真实方案已贯通印记、角色资源、状态变体、动态效果及后续 HP/韧性结算，无特殊资源角色保持八曲线基础拓扑；五载体继续确定性重建。

完整 `test:trial-release` 通过 119 个测试文件、655 条测试和 50/50 production preview；Workbench 主块 367,785B gzip，总 JavaScript 721,816B gzip。M9 已完成并停在产品验收点，不自动创建下一里程碑。

### M9-R1 可编排动作与零距离投射物场景整改已完成，等待产品验收（2026-07-22）

产品验收确认排轴不需要复现真实空间距离：默认角色与目标距离为 0，投射物在可靠发射帧立即命中；每个独立 hit 默认命中，但可在动作检查器单独关闭。关闭某 hit 只移除该 hit 的伤害、削韧、命中回能及命中触发效果，施法消耗和其他 hit 保持不变。该规则属于明确的排轴场景假设，覆盖报告继续保留客户端投射物碰撞的 runtime-dependent 来源状态，并用独立 `scenario-assumed-zero-distance` 标记场景结算。

同一整改还将“可加入时间轴”与“静态证据完整”拆开：公开动作可以规划，未知时长只使用可编辑规划占轴且不伪造命中；有可靠发射帧、公式和目标的投射物则按零距离场景进入 HP、韧性、角色/奇波 SP、印记和效果运行时。命中选择随编辑、撤销/重做、循环和五载体确定性回放，曲线上不新增逐 hit 控制点。

完成结果：562 个公开动作中 455 个在当前场景可运行，62 个由零距离投射物假设补齐；657 条排轴记录中 630 条使用精确所选变体占轴、26 条使用来源动画规划时长，仅米砂 A5 因 control identity 仍缺失使用通用 30F。22 个重点多变体 control 已区分为部分解析、尚未建模和静态证据缺口，不再统称“无法解析”。逐 hit 开关与场景合同已进入历史和五载体回放；120 个测试文件、664 条测试及 50/50 production preview 全部通过，当前停在 M9-R1 等待产品验收。

### M9-R2 全角色派生控制与零时长换人事件已完成，等待产品验收（2026-07-22）

产品要求剩余多变体动作不再统一选择一个 subskill。蓄力长度、松开时机、方向和可选追击属于输入控制，由用户在动作检查器显式选择；资源量、资源消耗、形态、Buff、架势与前置动作属于运行时条件，在输入帧自动选择。组合派生先按资源/状态筛选，再应用用户输入并生成无输入后续；生成层和覆盖报告必须保存控制源、决策帧、条件、所选分支、来源 identity 与解析状态。

切人从当前 600ms 普通动作改为零时长精确帧事件，时间轴显示目标角色头像和向下指针，不占轨道区间，也不直接结算三值。星携技逐角色解析为入场、退场或条件触发，并作为切人事件的确定性子动作生成；子动作保留真实偏移、时长、命中和效果。移动或删除切人事件同步处理子动作，初始前台不自动触发，只有证据支持手动释放的星携技继续留在动作库。五载体、循环、历史和视觉验收必须重建同一派生选择与换人关系。

M9-R2 已完成全角色派生控制、输入选择、零时长切人和星携技触发闭环：20 名角色的 136 个候选 control 均有来源合同，63 个多变体 control 无静默遗漏；已确认的蓄力档位由用户选择，资源/状态分支由输入帧运行时决定。切人只在精确帧改变受控角色，不占普通动作区间、不自行生成三值或状态；旧 600ms 事件迁移后保持原始帧和后续动作位置。

切人触发目录覆盖 20 名角色，17 条绑定可按真实入场/退场关系生成星携技，3 条因动作映射缺失保持静态证据缺口；所有子动作保留自己的真实时长、命中、CD、状态和来源，并由父切人事件确定性移动、删除和回放。星携技已从普通动作库移除，检查器可查看触发阶段、角色归属、条件和来源；同公开技能根的其他变体按自身 control CD identity 结算。完整 `test:trial-release` 通过 125 个测试文件、691 条测试、51/51 production preview 和 41/41 必需能力；Workbench 主块 354,059B gzip、总 JavaScript 735,571B gzip，低于发布硬门槛。桌面与窄屏证据为 `reports/m9-r2d-switch-trigger-desktop.png` 和 `reports/m9-r2d-switch-trigger-narrow.png`。当前停止并等待产品验收。

### M9-R2-R1 检查器、来源文本与长轴验收修复已完成，等待产品复验（2026-07-22）

检查器关闭按钮与 Escape 已通过真实页面交互，关闭后保留动作选中并释放时间轴；Battle 可见文本统一经过安全守门，损坏 raw 来源保留审计身份并回退为语义标签。默认与旧隐式草稿时长统一为 120 秒，并提供 30/60/90/120/180 秒选择、截断守门、稳定内部横向滚动及项目载体回放。127 个测试文件、701 条单测与关键桌面/390px 生产路径通过；上游编码修复后已增量重同步并通过真实中文名称、生成包及 verified-combat 漂移复验，前台无 U+FFFD 的防线继续保留。

### M9-R2-R2 时间轴初始能量直接编辑已完成，等待产品验收（2026-07-23）

三名角色与已配置奇波可在各自能量轨直接修改初始 SP，分别写回角色配置和 `slotId + kiboId` 奇波初始运行状态，并由同一第 0 帧状态驱动曲线、回复、消耗、历史及项目回放；未配置奇波仍保持 `0 / 1` 空槽占位且不显示输入。聚焦 181 条测试、生产构建、引用/包体守门和桌面/390px production preview 均通过，证据为 `reports/m9-r2-r2-initial-energy-desktop.png` 与 `reports/m9-r2-r2-initial-energy-narrow.png`。

### M9-R3 涂山小玉真实机制修正已完成，等待产品验收（2026-07-23）

小玉默认普攻现按 `20/35/47/30/80F` 的输入占轴生成，A5 去除 `240F` 收招尾长；爆发状态切换为 `72/75/72F` 三段链。A5 上下文窗口会在输入帧选择特殊或强化特殊重击，缘结值跨 100 与星决技 `272F` 会进入或刷新 10 秒统一状态，并共同驱动资源轴、Buff 区间与动作形态。被动 `10101061` 已按 8 秒、最多 4 层接入动态属性和后续结算；`10101062` 按当前客户端未实装处理，不注册效果。128 个测试文件、714 条测试、54 条生产预览路径及来源/包体守门均有通过证据；桌面和窄屏证据为 `reports/m9-r3-xiaoyu-mechanics-desktop.png` 与 `reports/m9-r3-xiaoyu-mechanics-narrow.png`。当前停止并等待产品验收。

M9-R3-R1 已将队伍共享印记组整体前置到角色组上方，并用不参与 lane 几何的 `20px` 成对尾槽隔离底部水平滚动条；桌面、390px、120/180 秒长轴及 PNG 导出边界均完成聚焦验收，等待产品复验。

### M9-R3-R2 小玉动作形态与实际占轴收口已完成，等待产品验收（2026-07-24）

小玉普通/强化/特殊/强化特殊重击现分别执行 `10101010/sub0`、`10101010/sub2`、`10101042/sub0`、`10101042/sub1`，`10101010/sub1` 保留为独立连续重击；最终形态由爆发状态、上一动作和派生窗口确定。21/21 个公开动作/形态已分离完整动画与有效占轴，统一 effective timeline 驱动动作宽度、辅助放置、重叠诊断和执行边界。129 个测试文件、723 条测试、真实 Workbench 聚焦流程、来源漂移、applied-source、构建与 `739,861B` 总 JS gzip 守门通过；桌面/窄屏证据为 `reports/m9-r3-r2-xiaoyu-forms-occupancy-desktop.png` 和 `reports/m9-r3-r2-xiaoyu-forms-occupancy-narrow.png`。`10101062` 继续按未实装处理。

### M9-R3-R2-R1 小玉爆发普攻链回归已修复，等待产品复验（2026-07-24）

爆发 A1/A2/A3 的已确认接续窗口现贯通动作草稿、readiness、实际落轴与运行时，星决技和缘结值跨 100 均选择 `10101001/04/05 sub1` 三段链且不再显示“条件待确认”。A3 后重击按 `[0,20)`、`[40,72)` 来源窗口稳定切换 `10101042/sub1` 与 `10101010/sub2`；真实动作库点击、指针拖拽、撤销/重做及保存重载均已复验。129 个测试文件、733 条测试、聚焦 production preview、构建和 verified-combat 漂移审计通过，证据为 `reports/m9-r3-r2-r1-xiaoyu-burst-chain-desktop.png` 与 `reports/m9-r3-r2-r1-xiaoyu-burst-chain-narrow.png`。总 JS gzip `740,444B`，超发布硬门槛 `444B`；本轮按范围不做包体优化，保留为发布前风险。

### M9-R3-R2-R2 小玉全动作隐藏输入派生已接入，等待产品复验（2026-07-25）

小玉 21/21 个公开执行形态及可达包装 control 已完成统一 EventBridge 审计，7 条有直接证据的指定输入派生现共同驱动生成、运行时与 Workbench 的点击、拖拽、跨窗移动和回放。星携技真实入场执行 `10101021/sub0`，当前客户端未发现其派生特殊重击；`10101041` 已确认属于闪避至极限反击包装链，不生成传闻边。129 个测试文件、741 条完整单测、真实 UI production preview、构建与来源漂移守门通过；总 JS gzip `740,445B`，超硬门槛 `445B`，按阶段边界只记录风险并停在产品复验点。

### M9-R3-R3 Workbench 性能收口已完成，等待产品复验（2026-07-26）

Workbench 在保留完整模拟数据与小玉机制结果的前提下，将曲线、日志、来源列表和检查面改为语义投影、窗口化及按需挂载，并对拖拽候选求值做帧合并与 revision 缓存。120 秒、7 动作 fixture 的 DOM element 从 `92,463` 降至 `1,883`，live nodes 从 `590,432` 降至 `11,212`；132 个测试文件、750 条测试、专用 production 性能 E2E、构建及来源守门通过。Workbench gzip `361,550B` 通过主块门槛，总 JS gzip `744,280B` 超发布硬门槛 `4,280B`，按阶段边界只记录风险并停止等待验收。

### M9-R3-R2-R3 派生输入窗口与贴边接续已修复，等待产品复验（2026-07-26）

上下文派生现分别追踪玩家输入帧、后续动作执行起点和前动作关系结束帧，保持 EventBridge 原始半开窗口，并让星鸣技、星决技、爆发 A3、极限反击与普通 A5 在动作块零像素贴边时按确证语义完成派生。审计覆盖 `1,154` 个公开时序来源、`1,342` 条窗口及小玉 `21/21` 个形态、`86/86` 条窗口；132 个测试文件、768 条测试、真实拖拽 production preview、性能 fixture、构建与来源守门通过。总 JS gzip `746,434B` 超发布硬门槛 `6,434B`，依阶段边界只记录风险并停在产品复验点。

### M10-A-R1 单角色战斗解析流水线整改实现完成，等待产品复验（2026-07-26）

角色流水线现按“声明式 recipe -> 通用编译器 -> owner contracts -> verified package -> runtime/UI”单向生成，并由守门派生成熟度和战斗覆盖；小玉当前诚实停在 `runtime-applied / partial`，410 条 raw 缺口归一为 225 条语义记录，其中 99 条仍可能影响玩法结果，不计为 `ui-verified` 或角色完成。120 秒三人队 golden 已改为真实 project compile + simulation，69 条数值断言覆盖三值/SP、缘结与爆发、被动、动态属性和装配传播；owner-scoped 原子发布、双 recipe 保留、失败零写入与重复零漂移均通过。完整 134 文件/779 测试、57/57 production preview 和 41/41 必需能力通过；总 JS gzip `746,821B` 较整改基线净增 `133B`，仍超硬门槛 `6,821B`，按本轮边界仅记录既有发布风险。M10-B 未启动，当前停在产品复验点。

### M10-A-R2 生产多 owner 编排与 owner 自愈已通过产品验收（2026-07-27）

生产同步现自动发现全部角色 recipe，以同一通用编译中间结果合并 owner contracts、verified package、runtime、golden 与 profile/catalog；小玉即时投射物策略已改为声明式 control policy，共享生产生成不再以角色或技能 ID 决定合同。owner 命令会从原始证据重新编译并只写隔离 staging，删除或篡改旧合同仍可重建同 hash，只有 `--all` 发布全局产物。独立复验确认双 owner 生产编排、135 文件/781 测试、57/57 production preview、41/41 必需能力及 character/verified、build、production imports、Workbench data、action status、applied-source 守门全部通过；小玉保持 `runtime-applied / partial`，117 条语义效果、7 条动态属性依赖和 69 条 golden 结果未变。总 JS gzip 超既定硬门槛的状态继续作为已知发布风险保留；M10-A 正式关闭，当前停在阶段边界，M10-B/红宝石未启动。

### M10-B1-R1 红宝石普攻阶段与星鸣技资源事务已完成，等待产品复验（2026-07-27）

普通普攻现只生成 A1-A3，强化 E1-E12 仅在 A3 后有弹或星鸣技等已验证快速入口有效时生成，并逐次耗弹至 0；星鸣技在来源动作第 40F 同帧补弹至 12、增加 1 枚队伍火属性调谐印记并开启 4 秒快速入口。真实 Workbench 拖拽、撤销/重做和回载已通过，authoritative golden 为 114 条断言，完整单测 136 文件/795 条、production preview 58/58；角色继续诚实保持 `runtime-applied / partial`，总 JS gzip 超门槛 `8,362B` 作为已知发布风险保留，当前不启动下一个角色。

### M10-B1-R2 红宝石输入重放与切人派生门控已完成，等待产品复验（2026-07-27）

公开普攻现持久化为输入意图，并由动作开始帧的弹药、快速入口、前序实际形态和 A3 转段窗重放解析 E1/A1；移动、删除、撤销/重做和重载会得到一致结果。E1-E12 默认按实际占轴逐段紧贴，手动间隔仍保留。所有切人附带派生动作共用 CD 物化门，CD 中只留下非占轴诊断，不创建失败星携技块或连锁重叠。完整 136 文件/800 测试、60/60 production preview 及 character/verified、生产引用、Workbench 数据、动作状态和 applied-source 守门通过；Workbench gzip `364,475B`，总 JS gzip `751,445B` 超硬门槛 `11,445B`。当前停在 M10-B1-R2 产品复验点，不启动下一角色。

### M10-B1-R3 红宝石衔接与派生闭包已通过产品验收（2026-07-28）

红宝石当前按完整重导出审计 10 个公开动作、159 条原始窗口，去除跨 subskill 重复边后归一为 37/37 条全部接入的语义转移，19 条仅索引非玩法窗口独立保留，玩法相关衔接缺口仍为 0；A3、换弹、星鸣技、星决技结束和入场星携技均通过统一状态重放开放 E1，强化闪击保持连段序号，空弹、E12、超时、切出和中断统一退出。独立复验确认真实切人会物化 `10300221`，自身第 54F令雷印记 `0 -> 1`，紧贴星携技结束处拖入公开普攻生成 E1-E12；跨窗回退、CD 抑制、撤销和回载均正确。136 文件/818 测试、61/61 production preview 及全部漂移/生产数据守门通过，M10-B1-R3 衔接/派生闭包正式验收通过。该结论不等于红宝石全量战斗机制完成：角色仍为 `runtime-applied / partial`、`characterComplete=false`，保留 5 个 runtime capture 需求和数值/效果静态缺口。Workbench gzip `364,491B`，总 JS gzip `752,607B` 超硬门槛 `12,607B`，风险继续单独保留；当前停在阶段边界，不启动下一角色或包体优化。

### M8-C 调谐印记衰减机制勘误与运行时修复（2026-07-28）

新一轮客户端配置、IL2CPP 类型和本机代码交叉核查推翻了 M8-C 历史记录中的“逐层独立剩余时间”模型。每种属性实际只有一个容器级衰减计时：同属性印记每次增加都会刷新计时，已达 5 层时重施也刷新；20 秒无新增后只减少 1 层，剩余层再开始下一段 20 秒。部分主动消费不重置计时，全部消费使旧到期任务失效。完整证据、二进制哈希、状态机和 `rank-01-末音-米砂-米蒂.json` 的具体违规时点记录在 `reports/tuning-mark-shared-decay-audit-20260728.md`。

项目运行时已改为印记级 `decayDueAtMs + decayRevision`，满层刷新保留零增量审计事件，自然衰减按周期只移除一层；初始状态升级为 v6 的 `decayRemainingMs`，旧逐层状态以最近一次获得对应的最大正剩余时间兼容迁移；周期边界可精确继承共享截止时刻，并在边界恰逢衰减时只落实一层减少。依赖旧驻留时间计算的 DPS 排名必须重算，不能沿用 M8-C 历史验收作为 verified 依据。

### M8-C 小玉与红宝石旧轴回查（2026-07-28）

101010 与 103002 两条 120 秒权威金标已按共享衰减规则逐事件复核。小玉轴的三层火印在 23.45 秒完成最后刷新，31 秒段消费最早两层，剩余层仍在 43.45 秒衰减；雷印单层满 20 秒衰减，风印在 1.7 秒内全消费。红宝石轴的单层火印在 9.9 秒内全消费，单层雷印满 20 秒衰减。两轴均无满 5 层重施，故旧模型与正确模型在这些特定事件排列下恰好同轨，伤害和动态属性期望无需修改。完整时点、旧新对照和回归范围见 `reports/tuning-mark-legacy-axis-recheck-101010-103002-20260728.md`；该结论不豁免其他长间隔或满层轴的重算。

### M10-B2 寒悠悠首轮实现完成，产品复验未通过（2026-07-28）

寒悠悠 10 个公开动作、30 个可达 control、14 个执行形态已进入声明式角色编译链；五段普攻、两段蓄力重击、焰火目标状态、条件爆炸、命名第一被动、动态属性、直接 SP、火印记和三值结果由同一运行时驱动。首轮守门未证明完整因果链，因此角色继续标记为 `runtime-applied / partial`、`characterComplete=false`；无名第二被动不属于当前客户端已实装机制。

### M10-B2-R1 已通过功能验收并关闭（2026-07-29）

M10-B2-R1 已通过功能验收并关闭。真实公共入口现锁定 `E 的7次真实 hit -> 焰火 0 -> 7 -> 重击消费至1 -> 5次条件爆炸 -> Buff/SP -> 后续属性与三值`；关闭一段 E hit 后为 `6 -> 0`，移走 E、撤销和保存回载均由同一重放链重算。引爆后的主控攻击力 `+10% / 24s`、全队调谐强度 `+18/层 / 24s / 最多2层` 和寒悠悠 SP `+2` 均可追溯；星决技 148F 的全队 `2层 / 24s / +36` 与主控 `1层 / 15s / 寒悠悠基础调谐强度10%` 作为不同来源、目标和生命周期并存。

通用效果合同现以 `inheritType` 为唯一切人迁移判据，团队元素布尔值独立保存；寒悠悠两个主控 Buff 会在切人帧迁移且保留绝对到期与寒悠悠公式来源，全队 Buff 不复制，小玉与红宝石自身 Buff 均不迁移。20 名角色的无名第二被动统一归为 N/A。红宝石弹药初值由 `initialRuntimeState.specialResourcesByActor` 通用配置，零距离模拟已完整，真实客户端投射物证据仍独立未完成。

当前寒悠悠 120 秒 golden 保持 76 条精确断言；隐藏大招爆炸按当前客户端未删净废案归为 `not-applicable / legacy-unreachable`，capture 由 11 降至 10、零距离阻断由 1 降至 0。小玉、红宝石与寒悠悠 replay/summary hash 均无漂移，M10 功能验收通过并关闭。角色仍诚实保持 `runtime-applied / partial`；包体超限只作为对外发布风险，当前直接进入 M11-A，不启动第四角色。

R1 后主线不再直接按角色队列扩张，而是按以下顺序推进：

1. `M11-A`：抽出唯一权威的无 UI 战斗核心，Node 与 Workbench 对同一输入生成相同 trace/hash。
2. `M11-B`：建立版本化 Machine Axis JSON Schema 和 `catalog/validate/simulate/compare/explain` CLI。
3. `M11-C`：将 Workbench 收敛为同一 trace 的可视化验收台，保留动作、曲线、状态、Buff、hit 与因果检查。
4. `M11-D`：建立角色场景矩阵及 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready` 四态门禁。
5. `M12-A/B`：在已验收角色上实现批量评估与可解释搜索器；搜索正确性收口后优先实现带机器闭环证明的 `cycle-dps`。
6. `M12-B2`：优先完成带双循环重放、资源/CD/持续状态闭环证明的可持续循环 DPS。
7. `M12-B3`：将全部带风或雷标签的角色、一个统一星临者优化对象、全部含风或雷标签的单/双属性奇波，以及全部公开灵子和装备逐对象提升到 `optimization-ready`，并完成角色-装配-奇波绑定门禁。
8. `M12-C`：以末音做首个三人配队/装配/输出轴联合优化试点，分别输出无韧循环 DPS、有韧循环 DPS 和最快击杀 Top-N；初始前台属于动作轴而非队伍变体，结果必须回灌 Workbench 人工复验。完整冻结规则见 `work/m12-c/STATE.md`。

机器接口与网页不得维护两套战斗逻辑。AI 不能替代运行时证据和产品验收，未达到 `optimization-ready` 的角色、奇波、灵子或装备不得进入正式最优解。新的视觉特效、非必要响应式适配、拖拽手感细修、包体压缩和全角色盲目批量接入暂缓；包体继续记录，但只在对外发布时作为阻断门。详细阶段目标与验收条件见 `DEVELOPMENT_PLAN.md` 的 M11/M12 章节。

### M12-B-R2 已通过产品验收，进入 M12-B2（2026-08-01）

M12-B-R2 已用候选动作的真实资源条件和 canonical 资源轨迹生成最早可执行阈值等待，避免 SP/奇波能量逐整数事件消耗搜索深度；没有正增长来源的资源不会生成等待。多 seed 报告按稳定 actor/action/hit identity 聚合贡献，同时保留每个样本的 trace/hash，聚合贡献与目标指标守恒。独立验收确认提交 `e3777ecf6ae4564a4164e2fd567ff058aa80b9ac` 通过且无新增 P0-P3，M12-B 正式关闭。当前优先实施可持续循环 DPS；M12-C 继续锁定。

### M12-B2 可持续循环 DPS 已通过产品验收并正式关闭（2026-08-01）

Machine Axis 的 `AzPrMachineAxisCycleDps` v1 与 CLI `cycle` 继续由唯一 canonical core 计算显式半开循环区间。R2 对 sampled 使用 cycle-local 共同随机数证明状态闭环，同时保留每个 seed 的独立伤害样本，并结构化输出样本数、均值、样本方差、分位数及 actor/action/hit 贡献守恒；自然暴击波动不再误判为循环泄漏。奇波触发次数由生成层统一分类：`-1` 与 `9999999` 为 unlimited，小正整数为 finite，未知语义保持 evidence-open；河狸仔 520082 与 520087 稳态刷新可闭环，驮驮龙 15 秒 ICD 和真实一次性触发仍拒绝。权威 expected 示例保持 `22.44996643`、4 hit、`cycleDps=4.48999329`。提交 `76530074f6c2fb1d2b88b4eee1d2fd558d01ce2b` 已通过产品验收，M12-B2 正式关闭且不做 R3；下一阶段为 M12-B3，M12-C 继续锁定。

### M12-B3-C15 已通过产品验收，阶段暂停待命（2026-08-03）

M12-B2 已通过产品验收并关闭，M12-B3-A 现从生成数据重算带来源 hash 的固定资格分母；本阶段只建立 optimization qualification，不执行正式配队、装配或输出轴搜索。计划快照包含 10 名带风或雷标签的角色，加上 1 个统一的 `STARBORN 星临者` 优化对象，共 11 个角色优化对象；底层 `199001/199002` 只作为来源身份和运行时外观别名。奇波按离散属性标签选出 22 只风/雷单属性奇波和 21 只含风/雷双属性奇波，共 43 只。装配门禁另包含全部 62 个灵子、137 件公开装备和 12 条套装技能门槛记录。完整 ID/名称清单、筛选与归一化规则和当前源文件 hash 见 `DEVELOPMENT_PLAN.md` 的 M12-B3 章节。

所有角色优化对象、奇波、灵子和装备都必须分别走完 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready`。现有 62/62 灵子和 137/137 装备的静态 profile 可复用；B3-C10 后灵子效果为 38/62 `runtime-applied`、24/62 `dynamic-unapplied`，套装技能为 8/12 `runtime-applied`、4/12 `dynamic-unapplied`，因此当前仍不能取得优化资格。137 件公开装备的 410 条副属性记录全部是确定值，可变副词条为 0；计划不引入随机词条、roll 或词条预算搜索。Machine Axis 需结构化接收角色等级/星赐/临阶、奇波等级/四维天赋/空 DNA/羁绊、灵子等级/突破阶/升星级和装备稀有度/强化/同调，并把结果传播到角色、奇波和伤害；非法或缺失条件在运行前拒绝。当前版本的 `dnaFactors` 规范值固定为 `[]`，不研究、不应用、不枚举 DNA；省略时 canonical 明示为空，非空输入结构化拒绝，DNA 证据不计入资格缺口。所有其余培养参数都是调用方固定的场景条件，不是优化维度，优化器只枚举角色、奇波、灵子、装备 ID、队伍/套装组合及动作轴。装备仍依据 `accessory_level`、`accessory_customed.score` 与 `EQUIPMENT_SCORE_FORMULA_PARAM` 结算，并按实例上的 `bGoldSide/maxValue` 区分缘星 110 与普通最多 100 的同调上限。固定培养 profile 及其解析值必须进入输入、Top-N、replay、Workbench 导入和 build hash，不能按候选静默取满。星临者只生成一份资格 manifest 和一个优化候选，两个底层身份必须编译为相同机制 hash。

M12-C 首个末音优化场景的输入条件仍固定为：全体候选角色 80 级、星赐当前层为 7，应用 `talent_rank` 已完成的 1..6 层属性并全选第 7 层节点；`hero_rank` 已按未实装（废案）收口——不参与培养状态与数值，优化器输入不要求也不消费 hero_rank，原相邻档捕获合同归档。灵子 80 级且不使用同名灵子升星（初始 `star=1`，达到 80 级所需等级上限突破依法解析为 `rank=6`）；装备统一为四星 `+9 / 同调110` 的合法缘星实例；奇波 80 级，四个核心属性天赋均 10 级并解析为四维值 `120`，`dnaFactors: []`，不进行羁绊培养但使用客户端初始有效羁绊 `favor_lv=1`，按 `pet_favorability.levelEffect=900` 以 9% 系数继承角色属性。非空 DNA 在当前版本拒绝，`favor_lv=0` 是缺失/未初始化占位而非合法等级，严格输入必须拒绝。该输入 profile 以 `22f28f1f4b5b0d90` 冻结；搜索只更换各类 ID、队伍/装配组合和动作轴，不改变任何培养值。

角色-装配-奇波组合还需证明静态和动态属性传播、来源/目标、前后台/切人、同帧顺序、状态隔离、保存重放及连续循环。C9 已在 `bd812d64226a371a55a01981a239e33c318c9e98` 通过产品验收；direct PropertyElement 根的装配初始化与 unload 由版本化二进制证据闭合。C10 以 `four-piece-set-stack-runtime-evidence.json` 约束 `Overlying=4` 的单一聚合层数、combineNumber 上限、共享绝对到期、Self 来源隔离与 BeforeDamage 当前包顺序，并由统一 compiler/runtime 接入 `set-skill:2:4` 和 `set-skill:4:4`。11/11 角色优化对象、43/43 奇波、62/62 灵子、137/137 装备、12/12 套装技能和规定绑定场景未全部通过前，阶段不得部分放行，任何 `dynamic-unapplied` 必须结构化拒绝而非 warning，M12-C 保持锁定；UI 美化、包体和纯性能工作不作为资格阻断项。

B3-A-R1 与 B3-B-R1 已分别在 `f902de10c42c2c4dc750be2316fabe3bc026f8cc`、`f846161c4a71bbc2de2b5bed3f598f03344fc692` 通过；普通/缘星实例、固定培养与 DNA=`[]` 合同保持不变。C10-R1 至 C13 均已按各自基线通过。C14 在 `a5434a1e0b01c2d70db1832064e34f63fb44e279` 通过来源身份核查，正式文本与唯一可达旧图冲突的 `set-skill:3:4` 继续保持 `evidence-insufficient`。C15 通过版本化原生证据闭合持久安装根、周期条件复评、有限 Cover 叶与 cycle 相位，接入 `10084/10152/10197`；`10078` 因 `[302,303]` 多 PropertyTag 匹配语义未闭合而不应用。C15 已在 `aafb6aa6c645b7b7490fdba0f71b8941da311f6e` 通过产品验收。当前为 42/62 灵子、11/12 套装技能 runtime-applied、375 条阻断（354 not-implemented + 21 evidence-insufficient）；五类准入仍为空，整个 B3 尚未完成且 M12-C 锁定。任务现暂停待命，未收到用户明确恢复指令前不启动 C16、正式搜索或任何新机制批次。

### M12-B3-E17 阶段五 sub2a 已完成：additionalHitElementDataList 附加命中子叶继承父触发器（2026-08-06）

用户恢复 B3 推进后按 `E17 -> E18` 顺序执行。阶段五 sub2a 把 `additionalHitElementDataList` 的 depth>0 伤害子叶（如 50002504 的 `500251 雷属性共鸣 5秒伤害`，damageType=10）从 `nested-damage-trigger-lifecycle-not-expanded` 提升为 `applied`：子叶继承父根的行为触发器与目标（父命中时派发附加命中/DoT），并加入 nested-wrapper 允许关系集；同时**不修改 `createControlRuntimeHits` 的既有排序/编号**，避免把附加命中当独立 action hit 结算，因此三角色 golden 数值全部保持稳定（对比上一轮失败尝试：附加命中误入 hit 结算导致 101003 多 2-3 hit 与额外韧性/HP，本轮已回退该路径）。

结果：`appliedEffectBindingCount 1202->1321`、`unresolvedEffectBindingCount 2472->2358`、`semanticAppliedEffectCount 574->688`、battle effect catalog `appliedNodeCount 633->739` / `unresolvedNodeCount 2201->2095`；角色 unresolved ledger 的 gameplay-impacting 与 wrapper-or-duplicate 计数同步下降（101010/103002/101003）。包 hash `cbf1dac3723c6ff4b29b5669599999a3edb5938e87ed4c8a1cc6f0890de96b53`（文件 SHA-256 `b1ec554d35dad9ef310bf5260beb0352bbc70270b4cc045e9604f557f34a1164`）；Machine Axis 标准哈希更新为 `9343ae372587433b / fa9920709e3c0aac / 53ac813d8f879176 / 0b410dc9255d2654`。目标 signature 行数未变（每行仍带 layerInfoList/triggerEffectList/pack 等其他阻断），但 `kibo-passive-static-evidence-gap` 与 520059 资产缺口结论不变。

验证：`data:sync-verified-combat` 三角色 authoritative golden 全过；12 个聚焦文件（migration/canonical replay/trace index/package/census/qualification/visual/before-skill/machine-axis/cycle/Workbench）全部通过；全套 Vitest 1422/1428 通过，5 个 process-heavy 文件单独运行全部通过（其中 characterCombatProfilePipeline 与 rubyCharacterCombatProfile 为真实的 unresolved ledger 计数断言，已按新包更新）；8 项确定性审计、production build 与 `git diff --check` 全 clean。

下一阶段任务：**E17 阶段五 sub2b：triggerEffectList/layerInfoList 子叶的真实层数门控**。不能把这两个关系直接并入 nested-wrapper 允许集——101010 的风/雷共鸣层子叶（attributeId 105 能量回复增幅）一旦无条件 applied 会改变角色 golden SP（已实测 currentValue 35.419->36.065 漂移）。实现路径：① 编译期从父 stack 的 `layerInfoList`（layerCnt 1..5 + elementDataList 引用）为子叶生成 `activationConditions`（stackElementId + minLayerCount）；② 运行时为 stack 效果登记实体层数（复用 part3 的 `elementTagLayers`/`elementIdsHeld` 状态通道），条件评估按目标层数 fail-closed；③ 闭合后可顺次处理 pack-lifecycle、`sp-recover-type-not-direct-sp`（recoverType=3 冷却缩减）、`base-function-unverified` 与 `property-formula-not-literal-function-5` 公式族。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E17 阶段五 sub2b 已完成：triggerEffectList/layerInfoList 子叶层数门控（2026-08-06）

sub2b 按 sub2a 记录的方案实现：`triggerEffectList` 与 `layerInfoList` 加入 nested-wrapper 允许关系；`triggerEffectList` 的 damage 子叶与 additionalHit 一样继承父触发器；`layerInfoList` 子叶在编译期从父 stack 的 `layerInfoList`（layerCnt 1..5）解析 `activationConditions[{conditionType:6, layerElementId, minLayerCount}]`，运行时 `evaluateVerifiedBattleEffectConditions` 新增条件类型 6（stack 层数 fail-closed：层数状态未登记时不应用，因此 101010 风共鸣 SP golden 保持稳定）。新增 3 组条件评估单测（满足/不满足/无层数状态）。

结果：目标 signature 开放行 57→38（本轮闭合 19 行）；`publicActionClosure 292/22/52 -> 315/13/38`，`machineOptimizationReadyCount 53->72`；视觉验收 accepted/optimizationReady `230->238`；资格缺口 `82->66`（kibo maturity-not-ready 23->15、kibo visual-blocked 23->15）；`appliedEffectBindingCount 1321->1509`、`unresolvedEffectBindingCount 2358->2262`、`semanticAppliedEffectCount 688->857`、battle appliedNodeCount `739->765` / unresolvedNodeCount `2095->2069`。包 hash `c0dbd2363c1ceb89864a15848c329f8e3337524a4b3f848d57f2d37602768bbe`（文件 SHA-256 `bc40ab75d837c202fc4efe8643034149a622a322b37127ef9296c1a40537c8a1`）；Machine Axis 标准哈希 `5e78e3428420f167 / 07f50f5077ccb7e0 / 6db8d1578df67e1e / 0b410dc9255d2654`；cycle `0dbf93bf / 76595798 / 40a767cf / 13fc3bf3 / 6c0579df`；资格哈希 sourceSnapshot `0798ddc060d5241f` / roster `02cb8ad34997a0db` / manifests `6cb3c231368fd59e` / ledger `e89c9905f37a51fa` / bindingMatrix `c3c7a9addccc7728` / catalog `cd7032bb0d4b53cd`。

验证：sync 三角色 authoritative golden 全过（层门控 fail-closed 保持 SP 数值不变）；15 个聚焦文件全过；全套 Vitest 1425/1428（3 个已知 process-heavy 并行超时文件单独全过：characterCombatProfilePipeline/machineAxisService/periodicPersistentPropertyEvidence 等）；9 项确定性审计、production build 与 `git diff --check` 全 clean。

下一阶段任务：**E17 阶段五 sub2c：pack-lifecycle 与剩余直连族**。剩余 38 行目标 signature 的主要阻断已转为 `pack-lifecycle-semantics-evidence-gap`（如 500025018 调谐提升 pack、500360302 流血触发器）、`sp-recover-type-not-direct-sp`（500368/500369/500370 recoverType=3 冷却缩减，需新增 cooldown-reduction 契约族）、`tuning-mark-max-mismatch`、`property-formula-not-literal-function-5`（水共鸣攻防减少）与 `base-function-unverified`（500360 等伤害公式输入）。建议顺序：先 pack-lifecycle（sustainElement/notDel 生命周期，可复用 C15 的周期根机制），再 recoverType=3 冷却缩减契约，再公式族。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E17 阶段五 sub2c 已完成：pack-lifecycle 包装闭合 + recoverType=3 冷却缩减契约（2026-08-06）

sub2c 分两族落地：① **pack-lifecycle**：`kind==='pack'` 且有已解析子引用（sustainElement/elementDataList/injectElementDataList/triggerEffectList）时按包装根闭合（与 inject 同语义），无子引用的 pack（如纯特效循环 500164006）保持 `pack-lifecycle-runtime-unimplemented` 诚实未解析；② **recoverType=3 冷却缩减**：500368/500369/500370 的 `专属1-直接减少%冷却时间`（负值 valueByLevel）不再报 `sp-recover-type-not-direct-sp`，编译为 `cooldownReduction` 契约（`directSp` 仅保留 recoverType=0，避免运行时误作 SP 回能），runtime catalog 不含 cooldownReduction 因此 golden SP 稳定。

结果：目标 signature 开放 38→23（pack 12 + cooldown 3 = 15 行闭合）；`publicActionClosure 315/13/38 -> 330/11/25`，`machineOptimizationReadyCount 72->85`；视觉验收 accepted/optimizationReady `238->250`（kibo 28->40）；资格缺口 `66->42`（kibo maturity-not-ready 15->3、kibo visual-blocked 15->3）；`appliedEffectBindingCount 1509->1648`、`unresolvedEffectBindingCount 2262->2125`、`semanticAppliedEffectCount 857->859`、battle appliedNodeCount `765->885` / unresolvedNodeCount `2069->1949`。包 hash `d215cd47acf1f384a17276a9a89a806a2dceacfad63201e424831eef35ef8750`（文件 SHA-256 `a307d3dad3742322df07d0a4d7a90187c44f866dcafddafcb66378cbaa499b6d`）；Machine Axis 标准哈希 `86b2461a6edb588c / 0a5dfb5ebed29089 / 67ebc8ab034ea2c2 / 0b410dc9255d2654`；cycle `c69b0fb8 / ba1d68d3 / 6c287110 / 13fc3bf3 / b945c90c`；资格哈希 sourceSnapshot `fd1e0c09ddd36383` / roster `2af3cc7079e12421` / manifests `7c8d802de216d14a` / ledger `77deb8458534ada3` / bindingMatrix `47857e778be98007` / catalog `cc3acf62861a8c80`。

验证：sync 三角色 authoritative golden 全过（冷却缩减与 pack 均不入运行时结算）；15 个聚焦文件全过；全套 Vitest 1423/1428（5 个已知 process-heavy 并行超时文件单独全过：characterCombatProfilePipeline/setThreeSourceIdentityEvidence/machineAxisService/workbenchMachineAxisAdapter 等）；9 项确定性审计、production build 与 `git diff --check` 全 clean。

下一阶段任务：**E17 阶段五 sub2d：公式族与 tuning-mark 上限核对**。剩余 23 行目标 signature 的阻断集中在 `base-function-unverified`（8）、`hp/toughness:damage-formula-inputs-incomplete`（8）、`heal-formula-not-literal-function-5`（7）、`shield-formula-not-literal-function-5`（4）、`property-formula-not-literal-function-5`（6，水共鸣攻防减少）、`tuning-mark-max-mismatch`（11）与 `trigger-frame-missing`（9，scenario-assumed 行混带其他原因）；另有 pack 2、nested-wrapper 1、property-change-type 1。建议先核对 tuning-mark-max-mismatch（11 行，与 C10 调谐层数/combineNumber 上限证据同源），再补 `base-function-unverified` 的伤害公式输入（500360 等），最后处理 heal/shield/property 非字面公式族。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E17 阶段五 sub2d 已完成：调谐上限、公式族、触发接线与零距离场景触发器扩展（2026-08-06）

sub2d 按计划四连闭：① **tuning-mark-max-mismatch**：印记容量以上限证据（overlimit 机制统一 maxStacks=5）为准，`layerInfoList` 只声明“有额外效果的层数”（新增 `effectLayerCount` 字段），仅当效果层数超过容量时报 mismatch——11 行全消；② **公式族**：heal（damageType=5，base 104/108/122）、shield（base 12）、property（base 120 元素层）按 `element_formula.json` 源公式就绪即闭合，同时 runtime catalog 增加 `formulaRuntime.applied` 门禁（未验证公式不进运行时结算，588→403 是诚实收窄）；治疗/伤害命中元素分类修正：damageType=5 元素 hp applied、toughness 显式归零、非字面公式不再报 base-function-unverified，且**治疗元素不进入 hit 生成器**（避免英雄星决 10700213/22 多出 hit 破坏灵魂调谐结算，已回退并验证 soul 测试通过）；③ **触发接线**：`triggerEffectList/zeroEffectList/finishEffectList` 的 `param1` 元素 ID 引用纳入子引用收集（500026036 等），`zeroEffectList/finishEffectList` 加入允许集，`标记元素` 类无子 pack 叶按 verified-zero 处理；④ **零距离场景触发器扩展**：kibo 零距离策略下，无行为轨且无弹道的伤害/治疗根元素在 frame 0 生成 `zero-distance-skill-execution` 场景触发器（与 bulletElements 同源 `scenario-assumed-zero-distance` 证据标记）。

结果：目标 signature 开放 23→**4**（闭合 19 行）；`publicActionClosure 350/5/11 -> 351/8/7`（evidenceClosed 351，unresolved 7 中 6 条为非目标治疗-only 动作因治疗不再计 hit 而回退，目标行不受影响）；`machineOptimizationReadyCount 87->102`；视觉 accepted/optimizationReady `250->251`；资格缺口 `42->40`（kibo maturity 3->2、kibo visual-blocked 3->2）；`appliedEffectBindingCount 1648->1761`、`unresolvedEffectBindingCount 2125->2032`、`semanticAppliedEffectCount 859->960`、battle appliedNodeCount `885->971` / verifiedZeroNodeCount `861->863` / unresolvedNodeCount `1949->1865`、`appliedHitBindingCount 2737->2739`。包 hash `1a8bc794ec138e471a2dabab1aa45c8a81d8179d7bd721b0007d15936510db02`（文件 SHA-256 `54658adb2803e570c75d7e925a85343187dddd9bda5965436640f9068e7b14c1`）；Machine Axis 标准哈希 `09d4ced23265d1d8 / c2093000e7700efd / 9f1b18aba3382a0e / 0b410dc9255d2654`；cycle `d6cabd4b / be5b2ff7 / 48d098fc / 13fc3bf3 / d732e0a3`；资格哈希 sourceSnapshot `7fbd2d35f3432b62` / roster `737cbf7d852a3962` / manifests `50f3649b490bdb49` / ledger `7617b0e0c5207205` / bindingMatrix `85c9172903c8fac8` / catalog `ffdde0ee0e89287c`。

验证：sync 三角色 authoritative golden 全过；16 个聚焦文件全过（含灵魂 10043 风印记 teammate 调谐回归）；全套 Vitest 1426/1428（2 个已知 process-heavy 并行超时文件单独全过：characterCombatProfilePipeline/setThreeSourceIdentityEvidence）；9 项确定性审计、production build 与 `git diff --check` 全 clean。

下一阶段任务：**E17 阶段五 sub2e：剩余 4 行证据缺口收口 + E18 视觉签收**。剩余目标行：500066/500186（非伤害效果根 `宠物大招无敌`/`布鲁达-水属性攻击增益` 无行为触发器且效果目标未绑定，需运行时捕获或新提取的行为接线）、500213（`540074 全属性抗性下降` changeType=2 的属性变更类型枚举证据，需 dump.cs/GameAssembly 的 ChangePropertyElement.changeType 语义）、500323（零距离策略已覆盖但 census 把空原因 scenario-assumed 行计为未证据闭合，需决定计数规则）。E18：当前视觉 accepted 251/254，剩余 3 只奇波视觉阻断与成熟度 2 行+passive 1 行一致，sub2e 收口后即可签收。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E17 阶段五 sub2e 已完成：场景覆盖计数规则、元素级场景证据与剩余证据缺口定位（2026-08-06）

sub2e 三项推进：① **census 计数规则**：`policyCovered` 不再要求 `reasons.length > 0`，空原因 scenario-assumed 行（500323）按策略覆盖闭合；② **动作级场景证据**：`createActionMapping` 把 `scenarioClassification==='applied'` 的元素计为场景覆盖（`scenarioResolvedElementCount`），scenario-assumed 的 applied 效果（`scenarioResolvedEffectCount`）与场景命中一起决定动作 `scenario-assumed-zero-distance` 状态，`blockingUnresolved` 不再包含场景已覆盖元素——500004/500093/500399 及 6 条非目标治疗-only 动作闭合，`publicActionClosure` 未解析降到 0；③ **500213 证据定位**：dump.cs 确认 `TChangePropertyElementParams.EChangeType` 枚举 `BattleProperty=0 / PlayerProperty=1 / SpacialProperty=2`，540074 的 changeType=2 是**空间属性**而非战斗属性，按产品范围属于需决策项（不能按战斗属性闭合）。

结果：目标 signature 开放 5→**3**（500066/500186/500213）；`publicActionClosure 351/8/7 -> 358/8/0`；`machineOptimizationReadyCount 102->109`；视觉 accepted/optimizationReady `251->252`（kibo 42/43）；资格缺口 `40->38`（kibo maturity 3->1、kibo visual-blocked 3->2）；动作覆盖 `scenarioResolvedActionCount 152->504`，未解析动作全部携带显式原因（消除静默遗漏）。包 hash `9c319770f8ae63dcc9ff24c9263363c648f313b1076aa1a2c714587719067f75`（文件 SHA-256 `8fb766285845e1aff36daac9e00625efc17de055d08671b3947af58a926aeaa3`）；Machine Axis 标准哈希 `1c383b0496821da0 / e50711968e6c9cb5 / 8fd73d143ec97d1a / 0b410dc9255d2654`；cycle `847a0aff / 22def2a0 / 38f15b8e / 13fc3bf3 / 34e4e22f`；资格哈希 sourceSnapshot `3c0af523ecbd6bf7` / roster `3476adc279741fcc` / manifests `bf32fcf1de57c734` / ledger `03281bb971624cef` / bindingMatrix `3ae46ba540b95791` / catalog `9f25946d261d3111`。

验证：sync 三角色 authoritative golden 全过；16 个聚焦文件全过；全套 Vitest 1426/1428（2 个已知 process-heavy 并行超时文件单独全过）；9 项确定性审计、production build 与 `git diff --check` 全 clean。

下一阶段任务：**E18 奇波视觉签收收口（外部证据/产品决策门禁）**。剩余 3 行均无法由代码侧闭合：500066/500186 的非伤害效果根（宠物大招无敌、布鲁达水属性攻击增益）需要运行时捕获或新提取的行为接线证明触发器与效果目标；500213 需要产品决策（SpacialProperty 是否计入奇波战斗资格，或运行时捕获证明其不影响三值结算）。当前视觉 accepted 252/254、machineOptimizationReady 109，E18 签收需这 3 行对应的 2 只视觉阻断奇波 + 1 只成熟度阻断奇波通过上述门禁；一旦外部证据或产品决策到位，重跑 sync → 资格 → 视觉 → 守门即可完成 E18。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E18 sub1 已完成：Pet SubSkill 行为接线证据接入，500066/500186 闭合（2026-08-06）

从原始客户端补导出缺失的 `skill_control_50006601/50018602/50021301` 主控制（`C:\Codex\AzPr Extractor\AzurPromilia_Data` → `ExtractedAssets\Unity\default_package\ResourcesAssets\Config\Battle\SkillList`），确认三份主控制 7 月 18 日已有完整 typetree，但同步管线 `createExternalGameplayObjectFileIndex` 只索引 Hero SubSkill，奇波控制的 `m_FileID=2` 轨道引用无法解析。改动：① 新增 `PET_SUBSKILL_ROOT` 与 `createPetExternalGameplayObjectFileIndex`，`readGameplayObjectReference` 按 `skill_control_5xxxxx.asset` 作用域选择 Pet 索引（Hero 索引行为不变）；② `collectGameplayBehaviorSourceFiles` 按内容哈希去重，排除与主控制字节相同的 `__2.json` 重复副本，避免把主控制自身当作行为源产生无帧无目标伪触发器（该伪触发器曾让 `coveredAsChild` 过滤失效，把 540004 根节点重新推为 unresolved）。结果：**目标 signature 开放 3→1**——50006601（兔耳鳐大招无敌）与 50018602（布鲁达水属性攻击增益）经 Pet 子技能行为接线获得 startFrame/目标（50018602 的 540004 攻击增益经 pack 500186004 frame 22 team-actors 子叶闭合），全部 `evidence-closed`；仅剩 50021301 `property-change-type-not-battle-property`（SpacialProperty，产品决策）。publicActionClosure 358/8/0→**360/6/0**（无 unresolved）；machineOptimizationReadyCount 109；视觉 accepted/optimizationReady 252/254（kibo 42/43）；资格缺口 38 不变（kibo 3 条对象缺口全部收敛到 500185：maturity-not-ready + visual-blocked + passive-static-evidence-gap 同一只）。包 hash `1ec50f54…`（文件 sha `8fb76628…`→`1ec50f54…`；内部 packageHash `3965abec…`），Machine Axis 标准哈希 `6a5ce609 / af6f173c / b1c3c9a8 / 0b410dc9`，cycle `94828dc1 / d599fb2c / c4bb8246 / 13fc3bf3 / 4c02bab7`，资格哈希 `454e65b0 / 4d85f98e / d60244f5 / 2dc0e41c / dc8fbb0a / 4c076abe`。同步更新：FROZEN_B3_SOURCE_HASHES.verifiedMechanics、3 个 character-acceptance fixture、4 个 machine-axis fixture、m11 集成基线、b2 cycle 验收报告、b3 验收报告哈希、迁移/包/覆盖/Workbench/canonical/census/cycle 测试锁定。验证：全套 Vitest 1427/1429（2 个已知 process-heavy 并行超时文件单独全过）、10 项确定性审计 clean、production build 与 `git diff --check` 通过。

下一阶段任务：**E18 sub2 —— 剩余 1 行 + 1 只奇波的外部门禁**。50021301（菇噜噜 540074 全属性抗性下降，changeType=2 SpacialProperty）需产品决策：SpacialProperty 是否计入奇波战斗资格，或提供运行时捕获证明其不影响三值结算；500185（被动证据缺口，E16 已定位 520059 resourceMap 不完整及 520004/005/006/007 触发形状）需从原始客户端补提取完整 resourceMap 或登记精确阻断原因。两者通过后重跑 sync → 资格 → 视觉 → 全套守门，视觉 252/254 签收剩余 2 只并关闭 E18。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E18 sub2 已完成：500185 区域光环被动证据闭合，奇波资格缺口清零（2026-08-06）

新增 `parseAreaAuraPropertyPassive`（`generate-kibo-headless-census.mjs`）：验证行为注入单个区域检测元素（`areaType/Radius/CheckInterval/Duration` + `ElementAddListWithDelete`）且控制 resourceMap 恰为「区域 + 属性」两个元素的形状，输出机制族 `equipped-kibo-area-aura-property-effect`。520059 华丽姿态因此闭合：520059000 区域检测（半径 15m、500ms 检查、Duration -1）→ ElementAddListWithDelete（CampType=1）→ 520059006 攻击减少（ATK -20%，dynamicPercent，time -1）对范围内敌人持续施加；`orphanElements` 明确登记 SwitchEnter 孤儿链 520059001→002/005→003/004（`passive-switch-enter-trigger-chain-not-in-control-resource-map`，当前客户端技能文案只描述光环，该链无任何控制/行为/元素引用边，不声明为激活）。结果：**pvePassiveMechanics 40→41 evidence-closed / 4→3 unresolved；machineOptimizationReadyCount 109→110；500185 成熟度 machineOptimizationReady=true、remainingGaps=[]；视觉 accepted/optimizationReady 252→253/254（kibo 42→43/43）；资格缺口 38→35，kibo byObjectKind 3→0（奇波缺口清零，剩余 33 角色 + 2 套装）**。同步更新：kibo census/maturity/visual/qualification 输出、验收报告哈希（`0ef9bc82 / 92cc0ab6 / 656f4c56 / c4ec8312 / 40247c28 / d497f807`）、census/visual/qualification/运行时被动生成测试锁定。验证：全套 Vitest 1427/1428（仅已知 process-heavy `characterCombatProfilePipeline` 并行超时，单独全过）、11 项确定性审计 clean、production build 与 `git diff --check` 通过。

下一阶段任务：**E18 sub3 —— 500213 SpacialProperty 证据收口（非资格 roster，属 census 目标行）**。二进制确认 `changeType=2` 实际是 `ESpecialPropertyType`（1=ALL_PROPERTY_SHOOTDMGUP 全属性伤害增幅 / 2=ALL_PROPERTY_DEFENSE 全属性受伤减免），540074（specialPropertyType=2，-0.91%，16s）是真实战斗修正而非空间属性；当前运行时未建模该族，需产品决策（是否纳入战斗资格）或实现 all-property damage modifier 机制。500213 不在 43 只资格 roster 内，不阻塞 M12-B3 资格/视觉；若产品同意按“战斗修正但暂不参与三值结算”登记，可在 census 把该行改为精确阻断 `all-property-damage-modifier-runtime-unimplemented` 或实现后闭合。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E18 sub4 已完成：剩余 3 条 PVE 被动全部解析，被动缺口清零（2026-08-07）

为 520004/520005/520006 实现三个严格形状解析器（`generate-kibo-headless-census.mjs`）：① `parsePeriodicBeforeDamageCritPassive`（520004 激运：每 2s 时间环 → BeforeDamage 武装 → 下次攻击 CRI +10000 必暴，资源账目 3 元素）；② `parseAfterReceiveDamagePoisonDotPassive`（520005 剧毒皮肤：受击 30% 概率 → 攻击者中毒 10s/2s tick，30% ATK 水属性 Dot，资源账目 3 元素）；③ `parseAfterReceiveDamageRetaliationWithStaticPropertyPassive`（520006 燃火甲壳：静态 DEF/MDEF +30% + 受击 50% 概率反击 30% ATK 火属性 Dot，资源账目 5 元素）。概率约定由数据+文案互验：`triggerConditionList` 恒为 `10000/200001` 门禁，实际概率 = `(10000 - functionParams[25]) / 10000`，并要求与 `describe` 中“X%概率”一致（520005=30%/fp25=7000、520006=50%/fp25=5000），不一致即拒绝解析。结果：**pvePassiveMechanics 41/3 → 44/0（全部被动 evidence-closed/runtime-ready）；machineOptimizationReadyCount 110→117（500083/084/085/095/096/213/313 七只就绪）；triggerLifetime unlimited 15→18**；资格缺口保持 35（kibo 0）、视觉 253/254（kibo 43/43）。资格哈希 `bd7aaf98 / 5dc5125c / 50c24650 / 898cd99f / e7525531 / a9ee6c54`。验证：全套 Vitest 1427/1428（仅已知 process-heavy `characterCombatProfilePipeline` 并行超时，单独全过）、11 项确定性审计 clean、production build 与 `git diff --check` 通过。**剩余 5 只非 roster 奇波公开动作缺口（500066/500081/500186/500261/500262）**：502001 共享主动（水属性魔法伤害 base function 2，50701320 35% 魔法）需魔法伤害公式验证与运行时 MATK 支持；502004（500066 主动）需嵌套包装公式验证；50008104 的 500081044 永霜诅咒冰抗下降（attr66，-300/20s）在任何控制/行为/元素中无触发边，属诚实证据缺口。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E18 sub5 已完成：502001 共享主动公式回退修正，水弹命中全部结算（2026-08-07）

根因：子弹注入元素 510002017（水弹 12%，damageType 3 / 水属性，baseIntParams=[1,2]、functionParams[0]=1200）的 `formulaParams` 为**空容器**（function_1=0/function_2=0/formulaParamValues=[]），sync 的 `formulaParams?.x ?? baseIntParams?.[x]` 回退因空容器存在而失效，导致 base=0/common=0/level-ratio 缺失 → 每次命中的第二个伤害元素被误判未验证。修复：新增 `resolveElementFormulaInputs(tree)`（formulaParams 全零/空时视为缺失，回退 baseIntParams/functionParams），应用于命中绑定、目录节点构建与持久修正系数读取三处。结果：**502001 水弹 500186/500261/500262 三只 evidence-closed；publicActionClosure 361/5/0→364/2/0；appliedHitBindingCount 2748→2757（每次命中 35% + 12% 双伤害元素全部结算）；machineOptimizationReadyCount 117→120**。520082 practical-unlimited cycle 语义修正：combatHitCount 3→6、loopHpDamage 39.09→93.18（此前每击只结算一个伤害元素）；复合被动测试按“首击第二个元素与减益同帧、减益后结算”修正断言（从第二击起全部受益）。三角色 golden 实际数值不变（仅哈希更新）。包 hash `eaf9690f…`（内部 `ea800e86…`），Machine Axis 标准哈希 `e5b4571d / a0dafe24 / 4d2815aa / 0b410dc9`，cycle `ec65e3d5 / 589634d5 / d32051bd / 13fc3bf3 / baf19955`，资格哈希 `210b854e / 69766b66 / 16692087 / 44f9eb32 / 5621ba67 / 525b2d11`。验证：聚焦 14 文件 282 测试、全套 Vitest 1427/1428（1 个已知 process-heavy 单独全过）、11 项审计 clean、production build 与 `git diff --check` 通过。**剩余 2 只非 roster 奇波公开动作缺口（500066/500081）**：502004（500066 主动，nested-wrapper + 公式验证）与 50008104（碎冰兔 break，500081044 永霜诅咒冰抗下降 attr66 -300/20s 无任何触发边，诚实证据缺口）。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E18 sub6 已完成：502004 公式别名 + sustainElement 嵌套关系，机器就绪 121/122（2026-08-07）

502004（500066 主动毒液弹）剩余两个阻断：① 毒dot伤害元素 50701325 使用 base function 110，而 `SUPPORTED_BASE_FUNCTION_IDS` 缺 110——`element_formula.json` 证据显示 id 110 与已验证的 id 4 表达式相同（`source.ATK[0]*A/10000`），把 110 加入支持集；② 每2秒触发（50701324）经 `sustainElement` 维持 火属性残响（element 103，base 116 层数公式，英雄侧 triggerEffectList 早已 applied）子伤害节点，`sustainElement` 不在嵌套允许集 → `nested-damage-trigger-lifecycle-not-expanded` + `nested-effect-wrapper-semantics-unresolved`；在 `classifyBattleEffectNode` 伤害深度分支与 `createControlRuntimeEffectBinding` 允许关系列表中加入 `sustainElement`。结果：**500066|502004 evidence-closed；publicActionClosure 364/2/0→365/1/0；appliedEffectBindingCount 1751→1801（sustainElement 族广泛闭合，semanticAppliedEffectCount 962→1006、appliedNodeCount 972→997）；machineOptimizationReadyCount 120→121（剩余仅 500081）**。红宝石/角色 profile unresolved ledger 同步修正（sustain 节点从 wrapper 转入 gameplay：ruby raw 438→437、wrapper-or-duplicate 23→22；pipeline raw 302→301、wrapper 32→31），三角色 golden 实际数值不变。包 hash `df13f676…`（内部 `7ba530f6…`），Machine Axis 标准哈希 `33d96fe7 / 6863ed12 / 5a9b3187 / 0b410dc9`，cycle `a656e8ae / 167be8ad / 761f114d / 13fc3bf3 / bd9096b3`，资格哈希 `4d3a49b4 / d6e3249e / 975a21af / 43d8831d / dbfd2277 / 4127198e`。验证：聚焦 14 文件 282 测试、全套 Vitest 1427/1428（1 个已知 process-heavy 单独全过）、11 项审计 clean、production build 与 `git diff --check` 通过。**剩余 1 只非 roster 奇波（500081 碎冰兔）**：50008104 break 的 500081044 永霜诅咒冰抗下降（attr66，-300/20s）在控制/行为/其他元素中均无触发边（battle-element-assets 全量扫描确认仅资源图自引用），属诚实证据缺口，需新提取完整 resourceMap 或产品决策/运行时捕获。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E18 sub7 已完成：500081044 登记死分支，奇波缺口全部清零（2026-08-07）

用户产品决策：把 500081044（碎冰兔 break 50008104 的永霜诅咒-冰抗下降，attr66，-300/20s）登记为死分支。按 10095 既有模式实现：sync 新增 `PRODUCT_CONFIRMED_DEAD_BRANCHES` 注册表（controlSkillId/elementId/pathId/decision/decisionSource，pathId 用字符串避免 JS number 精度丢失）与 `resolveProductConfirmedDeadBranch`；`createControlRuntimeEffectBinding` 对死分支元素过滤 trigger/target 缺失原因、强制 `verified-zero`（不参与三值结算）、绑定挂 `deadBranch` 决策记录；包顶层新增 `excludedDeadBranches` 决策清单。结果：**50008104 evidence-closed；publicActionClosure 365/1/0→366/0/0（全部证据闭合）；machineOptimizationReadyCount 121→122/122（全部奇波就绪）；verifiedZeroEffectBindingCount 9→12、dynamicProperty verified-zero 2647→2650**；资格缺口保持 35（kibo 0）、视觉 253/254（kibo 43/43）。包 hash `a501f5cd…`（内部 `09409efa…`），Machine Axis 标准哈希 `03352d8a / c55e9aa6 / 1b9f5ece / 0b410dc9`，cycle `5bd15ea1 / 9ae64ae9 / fb5236f1 / 13fc3bf3 / 53638229`，资格哈希 `9db681b8 / b0deeb53 / 67c797e2 / 1ec02a75 / 986e84a9 / ca8e3fd4`。验证：聚焦 14 文件 282 测试、全套 Vitest 1427/1428（1 个已知 process-heavy 单独全过）、11 项审计 clean、production build 与 `git diff --check` 通过。**奇波侧收口完成：资格 kibo 0、视觉 kibo 43/43、census 目标 signature 0、被动 44/0、publicActionClosure 366/0/0、machineOptimizationReady 122/122。剩余非奇波项：set-skill:3:4（C14 来源冲突，产品决策/新证据）与 33 角色资格阻断（既有范围外）。**每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E19 sub1 已完成：奇波动作重分类（槽1=普攻、槽2=主动），公开动作 366→448（2026-08-07）

用户确认奇波槽位语义：**pet.json `skillList` 槽 1 全部是普攻（normal-attack），槽 2 才是主动技（active）**，且两者都是自动释放技能。此前目录把单技能奇波（40 只）的槽 1 技能误标为 active，双技能奇波（82 只）的槽 1 普攻被丢弃，动作库只有 signature/active/break 366 个。本轮完成数据重分类与全链路基线：

- `generate-azpr-data.mjs`：`createKiboActionSpecs` 改为 `[signature, normal(slot1), active(slot2), break]`（slot2 不存在时为 null）；wiki 表单映射改为「技能2=槽1普攻（双技能时）、技能1=槽2主动、单技能时技能1=普攻」，122/122 与 pet 表精确互验（技能名/图标 0 失配）；`sourceSkills` 新增 `normalSkillId`，`activeSkillId` 仅槽 2 存在时非空；目录动作新增 `selfCooldownMs/selfCooldownGroup/gcdMs/petSkillLogicTag/aiToken`（skillsub_logic 源，GCD 字段名为大写 `GCD`）。
- `workbench-kibo-action-catalog.json`：122 只 ×（1 普攻 + 0/1 主动 + 1 大招 + 1 合击）= **448 个动作**，78 个普攻/主动技能全部有 skill_control 时长资产；schema 白名单加入 `normal-attack`。
- `sync-verified-combat-mechanics.mjs`：M9 分母 563→**645**（角色 197 + 奇波 448）；kibo 门禁改为按目录逐只校验必需动作种类（全量普攻/大招/合击 + 有槽 2 才要求主动）；`resolveKiboControlVariantSource` 按槽位选择；候选去重与绑定身份加入 `actionKind` 尾段（500066 槽1/槽2 同为 502004 的歧义由此消解，运行时可经 `eventType/actionKind` 消歧；`getVerifiedCombatActionMapping` 前缀仍兼容旧格式）。
- kibo 普攻走**标准 timing 路径**而非英雄普攻输入链（sync 编译、`resolveActionBinding`、`resolveAttackInputChainAction`、`resolveActionControlSkillId`、`getVerifiedDerivedControlContractForAction`、attack-input-chain 统计与 actionBindings 均按 `ownerKind !== 'kibo'` 分流）；`hasValidAttackInputChains` 只校验角色普攻。
- census：`publicActionClosure 366/0/0 → 448/0/0`，`machineOptimizationReadyCount 122/122`，`active` 就绪 82 只（40 只单技能奇波无主动不再被误判）；资格缺口保持 35（kibo 0），视觉 253/254（kibo 43/43）。
- 基线更新：fixtures/报告包哈希（内部 `ea9c9048…`、文件 SHA-256 `9eba8df1…`）、Machine Axis 标准哈希 `4e1aeb54 / fffb2c53 / 9076ad82 / 0b410dc9`、cycle `fb7026c9 / a4e25bc2 / c4013a2f / 4ba71bd3 / 13fc3bf3`、资格哈希 `5f8c6621 / 22d0c76f / 451433c8 / 930fb89c / caed3995 / 6226d601`；角色/奇波 golden 与 skill-asset 证据计数（外部元素 151 技能、伤害字段 412 对象等）同步。
- 验证：全套 Vitest 1428 通过（仅已知 process-heavy 并行超时文件单独全过：characterCombatProfilePipeline/setThreeSourceIdentityEvidence/machineAxisService/Workbench 等）、11 项确定性审计 clean、production build 与 `git diff --check` 通过。

下一阶段任务：**E19 sub2：排轴器/计算核心自动补齐奇波普攻+主动技时间轴**。用户要求拖入大招/合击等奇波动作后，按知识库 `blue-origin-mechanics-review/pet-skill-release-mechanics.md` 的自动释放规则（无条件 tag=0 走 AI 行为树、事件类 tag=80/10|7、冷却/selfCD/GCD、大招合击占用互斥）自动生成普攻与主动技释放时间，用户与优化器都不再指定这两个动作；搜索候选将只保留 signature/break（已生效），当前 search 边界断言 20/21 为无自动补齐时的中间值，sub2 完成后将按自动补齐后的结果修订。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E19 sub2 已完成：排轴器自动补齐奇波普攻+主动技时间轴（2026-08-07）

新增 `src/machine-axis/kiboAutoCastScheduler.js`：`machineAxisService.prepare()` 在 normalize 之后、模板/排程之前，对**每只拖入了特性技/合击技的槽位奇波**自动生成普攻与主动技动作（未拖奇波动作的槽不生成，用户与优化器都不再指定这两个动作）：

- 规则（来源 `blue-origin-mechanics-review/pet-skill-release-mechanics.md`）：主冷却 `coolDown`、同 `selfCDGroup` 互锁 `selfCD`、全局 `GCD`、技能占用；大招/合击占用窗口（PetUltimate/JointStrikeSkill，行为树停止）内不自动释放，且自动施放不得与用户动作重叠；`petSkillLogicTag=0` 无条件就绪即放，事件类（80/10|7/10/5#2）以 `autoCastRule.evidenceStatus='planner-simplified'` 显式登记（不冒充实机事件）；优先级 active 先于 normal。
- 生成动作带 `autoCast: true` + `autoCastRule`，id 含 slotId（`kibo-<id>-<slotId>-auto-<kind>-<seq>`，同名奇波多角色不冲突）；draft/项目动作保留标记（`createWorkbenchActionDraft`/`normalizeWorkbenchActionDrafts`/`createKiboEventAction` 链路补全），**导出/持久化时剥离自动动作**（`workbenchMachineAxisAdapter.createContractFromProject` 过滤 `autoCast`），重新导入时确定性再生成，保证 round-trip hash 一致。
- 搜索候选已只枚举 signature/break（sub1 生效）；`m11-b-three-actor-120s` fixture 现为 14 用户 + 28 自动 = 42 输入动作、44 执行（含 2 个切换），Machine Axis 标准哈希 `db654c65 / fffb2c53 / 2f10dd81 / 6e8efc26`，Workbench trace `0d2c57b1`；cycle 默认轴哈希 `4e03ec02 / 86ddc298 / aaa72349 / 81a497e0 / 41260534`（纯角色 cycle 指标不变：22.44996643 / 4.48999329）；search 边界最优仍为 20.5（最优轴不含奇波动作，不受自动补齐影响）；500206 被动循环因自动普攻触发次数 1→2，断言已按新行为更新。
- UI：动作库 kibo 区只保留特性技/合击技可拖入，新增「奇波普攻与主动技为自动释放」提示与普攻标签；Workbench 摘要显示「机器输入 42 / 实际执行 44」。
- 验证：全套 Vitest 1431 通过（仅已知 process-heavy `characterCombatProfilePipeline` 并行超时，单独全过）、11 项确定性审计 clean、production build 与 `git diff --check` 通过。

### M12-C 奇波自主动作产品范围修订（2026-08-11，覆盖 E19 sub2 当前行为）

用户决定延后奇波自主 AI 实现。当前排轴器、Workbench 与优化器不再生成、拖入或评分奇波普攻（`normal-attack`）和主动技（`active`）；只计算奇波特性技/大招（`signature`）、合击（`break`/joint attack）与已验证被动。E19 sub2 上述自动补齐记录保留为历史实现说明，但不再描述当前产品行为。

- `src/domain/kiboAxisActionScopePolicy.js` 冻结 `m12c-kibo-axis-action-scope-v1`：自主动作状态为 `not-generated-not-scheduled-not-scored`，恢复时必须升级版本并闭合 NodeCanvas、优先级、初始延迟、重施 cadence 与触发 authority。
- 完整 Kibo action catalog 和 mechanics evidence 不删除；Machine Axis catalog 发布顶层 scope policy，并按 action kind 确定性分类。旧项目或手工合同显式输入自主动作时返回 `machine-axis-kibo-action-product-deferred`，不会把来源存在误报为可执行。
- 搜索器与 Workbench 共享同一 classifier，只暴露 `signature` 和 `break`。编译阶段不物化 auto-cast action 或 derivation registry，因此三目标不会再被 cadence-open 诊断阻断。
- 正式准入对 43 只 admitted Kibo 做 71 个 deferred autonomous surface（43 普攻、28 主动技）及 43 signature/43 break 的全量普查，并绑定 qualification、catalog、scheduler、search generator 和 scope policy hash。该检查只证明产品范围一致，不声称自主 AI 已实现。
- 该修订会改变部分既有验收轴的 canonical 编译身份，即使伤害评价未变；自动化只更新代码回归常量，不自动续签产品记录。首轮运行时比较确认 103002、107001、107002、108003、112001 受影响；随后完整同步 M10/verified golden 又使 101010、102001、103002、107002、108003、109001 的 qualification subject 更新。用户明确要求先完成角色签收，最终 101010、102001、103002、107001、107002、108003、109001、112001 均绑定实现基线 `be60e68d1c1bcf77a962426ddb0af37fc384c4da`；199001、199002 未漂移，101003 保持 pending。原场景身份与截图 SHA 均未更换。

下一阶段任务（重排后的 M12-C 前路线图，E20 起按依赖顺序推进）：

1. **E20 角色管线打通（33 个角色缺口）**
   - E20-1 严格培养运行时基线：11 个优化对象全部接入严格培养合同（星赐 7 层 + 第 7 层节点全选 + talent_rank 1..6 层属性 + 固定 profile `22f28f1f4b5b0d90`，不再含 hero_rank）。E20-1a 已把星赐节点技能等级（`skillUpgrade`）接入 canonical 核心技能等级通道并进入 applied 账本；hero_rank 已由 E20-1c 按未实装（废案）收口，属性/技能可用性不再要求捕获。
   - E20-2 按正式 9 人 roster 推进角色验收：109001 末音已完成机制收口并停在产品视觉签收；随后只做 102001 莉莉、107001 西芙莉雅、107002 米砂、108003 米蒂、112001 姬瑟贝露。101010/103002 保留既有基线，108001/111001 已按产品场景排除，STARBORN 由 E20-3 单独归一化。每个对象分别走 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready` 并独立签收。
   - E20-3 STARBORN 统一对象：199001/199002 别名归一化、`actor-static-profile-missing` 清零、机制 hash 一致。
2. **E21 套装技能收口（已完成）**：`set-skill:3:4` 已按产品裁决以唯一可达执行图为权威来源；正式本地化中的“普攻叠攻击”判定为旧文本。12/12 套装技能现均为 `runtime-applied`、视觉签收并达到 `optimization-ready`。
3. **E22 绑定矩阵与正式准入（依赖 E20）**：角色-装配-奇波绑定矩阵全绿（装配→角色、角色→奇波继承、来源/目标、前后台/切人、同名奇波跨 owner 隔离、同帧顺序、保存重放、连续循环），9/9+43/43+62/62+137/137+12/12 全绿且 hash 一致，`m12cLocked` 解锁。
4. **E23 M12-C 末音试点（解锁后）**：末音必选，从其余正式对象选择两人；在固定培养与合法装配池上，分别搜索无韧循环 DPS、有韧循环 DPS、最快击杀三个独立 Top-N，并自动回灌 Workbench 人工复验。初始前台属于轴；循环初始资源与击杀轴 SP/红宝石弹药白名单按 `work/m12-c/STATE.md` 执行。

依赖与并行：E21 已关闭，E22 只依赖 E20 角色收口；kibo/灵子/装备/套装侧无需新增机制工作，只等绑定矩阵放行。E20 内各角色可并行推进（末音与候选队友优先），hero_rank 已收口不再占用并行捕获资源。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-1 已执行：严格培养运行时基线 + hero_rank 相邻档捕获合同（2026-08-07）

目标是把 11 个角色优化对象的严格培养合同（星赐 7 层 + 第 7 层节点全选 + talent_rank 1..6 层属性 + hero_rank 80 级合法突破档 3 + 固定 profile `c432bd0a`）接入并逐对象验证，先清掉 11 条 `strict-character-cultivation-runtime-partial`。本轮完成可静态闭合部分：

- **hero_rank 相邻档捕获合同**：`hero-rank-runtime-evidence.json` 新增 `adjacentRankCapture.expectedDeltas`——按 12 个来源身份（10 名角色 + STARBORN 199001/199002）从 `hero_rank.attribute` 计算 80 级空装配 rank3−rank2 的预期差分（如 101010/103002/107002/108001/112001/199001/199002=`1001#810`，107001/108003=`7#750`，109001=`58#830`，111001=`53#830`，102001=`1003#1040`）；捕获到达后由 `validateHeroRankAdjacentRankCaptureComparisons` 自动按预期差分校验放行。
- **静态上游路径边界**：反汇编确认 PlayerModule.HeroData/HeroStore 面板构建方法为混淆分发桩（static class-init guard + `[rax+0x60]` 虚派发），`rankTableLookupObserved=false`，无法静态证明服务端 `HeroAttrInfo` 面板是否已含 hero_rank.attribute；结论新增 `staticClosureBoundary`，明确该维度必须实机相邻档捕获，不伪造放行。证据文件新增 RefreshHeroSkill 观察（RVA 0x2458F50），并保持原 Populate/RefreshAttributes/Populate(HeroItemInfo) 观察与调用边断言。
- **验证器**：`assertHeroRankExpectedDeltaCoverage`（12 条、80 级、rank2/3、空装配、非空差分）与 `validateHeroRankAdjacentRankCaptureComparisons`（captured 时必须逐源匹配预期差分，否则拒绝）接入 `readHeroRankRuntimeEvidenceSource`。
- **11 对象基线测试**：新增 `heroRankAdjacentRankEvidence.test.js`，为 11 个优化对象逐个构造严格 profile（星赐 7 层全节点、四维天赋 10 级、羁绊 1、灵子 80/6/1、五部位 4 星 +9/同调110 缘星实例）并 resolve+project：`character.level/starGiftRank/starGiftNodeAttributes/completedStarGiftAttributes/levelBreakthroughLegality`、kibo、soul、equipment 全部 `appliedDimensions`；`unresolvedDimensions` 精确锁定为三个证据族：`character.starGiftNodeSkillLevels`（星赐节点技能等级运行时，232/420 节点带升级，属后续 E20-1a 运行时实现）、`character.levelBreakthroughAttributes`、`character.levelBreakthroughSkillUnlocks`（hero_rank 捕获/来源核对）。
- 冻结哈希：`heroRankRuntimeEvidence` 重基线为 `3e38b30f…`；资格摘要哈希 `9b04428d / e1b776a3 / 796977fe / b97033f3 / cfd5a025 / a36f4cc4`；资格缺口仍 35（11 条 strict-cultivation 与 24 条其余角色/套装阻断不变），`m12cLocked` 保持 true。
- 验证：新增 3 测试 + 全套 qualification 目录 101 测试 + machineAxisService 14 测试全过；optimization-qualification/visual/kibo-headless 审计 clean。

**E20-1 剩余依赖**：hero_rank 属性/技能可用性的客户端语义结论 + 实机相邻档最终面板捕获（捕获后按已建合同自动校验放行）；`level-breakthrough-skill-unlock-source-mismatch`（112001）来源核对与 E20-2 角色验收并行推进；每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-1b 已执行：hero_rank 客户端语义结论（2026-08-07）

用户要求先明确 hero_rank 在客户端的具体语义再放行后两个证据族。结论已写入知识库 `C:\PC2\Codex\AzPr\work\blue-origin-mechanics-review\hero-rank-client-semantics.md`，要点：

- **最终面板属性完全由服务端下发**：`HeroAttrInfo`（proto TypeDefIndex 21301）只有 `hero_guid/hero_conf_id/type/modules`，`modules[].subModules[].attrs=FightAttr`；`AttrModuleInfo` 由它构造，`RefreshAttributes` 只做面板→战斗属性转换。客户端 Lua 与二进制均无 `hero_rank` 表补属性路径，`HeroData.heroRank` 只随存档保存。
- **技能可用性同样服务端驱动**：`HeroAttrSubModuleInfo.skills=List<UnitSkillInfo>` 随面板下发，`RefreshHeroSkill` 只写 `skillInfoDic`；客户端不存在按 `hero_rank.skill` 自行解锁的逻辑。`hero_rank.skill` 是服务端应解锁的源表契约；已知被动（如 10101061）运行时已 applied 与客户端一致。
- **放行条件因此收窄**：`character.levelBreakthroughAttributes` 的唯一闭环 = 相邻档最终面板差分捕获（面板(rank3)−面板(rank2) 等于 `hero_rank.attribute(rank3)` 则服务端已含、我们应加；等于 0 则不加）；`character.levelBreakthroughSkillUnlocks` 可由同一捕获读取 `UnitSkillInfo` 闭合；112001 的 `hero_rank.skill` 前缀错误（10300261/10300262）保持来源冲突，等产品决策或新证据。
- 证据文件 `hero-rank-runtime-evidence.json` 的 `conclusion.clientSemantics` 已落库并冻结哈希 `d565e1e3…`；资格缺口仍 35，`m12cLocked` 保持锁定。

**E20-1 剩余依赖（更新）**：实机相邻档最终面板捕获与 112001 来源冲突均已由 E20-1c 按未实装（废案）收口关闭；随后进入 E20-2 角色验收。

### M12-B3-E20-1c 已执行：hero_rank 按未实装（废案）收口（2026-08-07）

用户决策：hero_rank（等级上限突破 0..5）在当前客户端未实装，按废案直接收口；**角色培养状态和数值不受 hero_rank 影响，优化器不需要指定 hero_rank**。

决策依据（客户端侧证据）：

- C# 方法表 `TDHeroRank` 只有表结构 getter 与通用表框架，无玩法消费；Lua 侧 `heroRankTpl` 未注册且无调用，`hero_rank_shell` 无消费。
- `MsgGenCode` 无角色突破请求（仅 6018 星赐合成 / 6019 临阶度奖励 / 6049 灵子突破 / 6510 宠物突破）；`ErrCodeHeroRank*`（10790-10804）实际文案全部是星赐/临阶，说明 “HeroRank” 命名实为临阶系统。
- 无系统开放项（`lang_system_unlock` 只有灵子突破/星赐），`guide_group` 引用的 `behavior_ce4_hero_rank_up.json` 不存在；hero_rank 全表消耗道具 `10#2#1` 指向不存在的 `common_item id=2`；112001 行技能前缀错误。

实施内容：

- 资格模型：`character.levelBreakthrough` 改为 `not-applicable-unimplemented-dead-config`，`attributeApplicationStatus/skillUnlockMode` 均为 `not-applicable`；`levelBreakthroughRanks` 保留为来源审计，行状态统一 `not-applicable-unimplemented-dead-config`。
- 计算核心：`resolveCharacterCultivation` 不再选择任何 level-breakthrough 源（即使旧输入携带该字段也按空处理）；`appliedDimensions` 移除 `character.levelBreakthroughLegality`，`unresolvedDimensions` 移除两个 hero_rank 证据族；application 状态在无 unresolved 时变为 `fully-applied`。
- 公共 schema：`levelBreakthroughRank` 从 `required` 移除（仍容忍旧字段，但不产生任何效果）；`ascensionRank` 依旧被拒绝。
- 证据：`hero-rank-runtime-evidence.json` 新增 `productDecision`，`conclusion` 全部改为 `not-applicable`，原相邻档捕获合同保留为归档证据（`adjacentRankCaptureRequired=false`）；生成器校验决策与结论一致性。
- 验收报告 `m12-b3-c-dynamic-loadout-effect-acceptance.json` 的 qualification/hashes 同步新基线。
- 星携技槽位映射修复（E20-1c-R1）：`resolveStarGiftSkillIndexToSkillId` 的 `skillIndex=3` 由固定 `ground/203` 改为数据驱动回退 `203 -> 201`（客户端 203=入场星携技、201=退场星携技，displayType=5，每角色二选一）。此前 102001/107002/108003/199001/199002 的星携技星赐升级被丢弃（如星临者 19900122 应有 +7 级却只显示 1 级）；修复后 199001/199002 星携技=8 级、102001/107002=6 级、108003=4 级。新增全 roster 校验测试（每个角色的 skillIndex=3 必须落到 displayType=5 的 201/203 槽位）。

验证与结果：

- 资格缺口 35 → 23（not-implemented 22 + evidence-insufficient 1，仅剩 `set-skill:3:4`）；11 条 `strict-character-cultivation-runtime-partial` 清零，112001 `level-breakthrough-skill-unlock-source-mismatch` 关闭；`m12cLocked` 保持 true。
- 全套 Vitest 1437 条（2 条已知 process-heavy 并行超时，单独全过）；optimization-qualification 16 文件 90 条全过；production-import / workbench-data / action-status / verified-combat / character-acceptance / applied-source-bindings / kibo-headless / bundle 审计全 clean；production build 通过。
- 冻结哈希：`heroRankRuntimeEvidence` 重基线 `15b104602e833d29e35c8a452c0ee3b3b6b9fe6d0b8cc1dd55f32c37883c88c8`；fixed profile `22f28f1f4b5b0d90`；资格摘要 `sourceSnapshot 2918bf3db501b2de / roster 33fad35f82aa31ed / manifests a5b8e21e33950c05 / ledger e66027078cbdf482 / binding 39af1ce5d230bdc3 / catalog 60141ce9481ff6f8`。

### M12-B3-E20-2-109001 已执行：末音进入验收管线（2026-08-07）

**E20 验收规则（2026-08-07 用户确认）**：E20 阶段每个角色都必须把该角色的**全部机制完全拆解并还原**后才能验收（runtime-integrated/visually-accepted/optimization-ready 任一签收均以此为前提），不允许只做基础动作/命中闭合后放行。用户明确“只是随便举了几个例子”，后续需自行补齐所有机制，包括但不限于：璀璨状态及其普攻变体、二段星鸣追击、大招重置星鸣充能冷却、大招消耗印记造成超限伤害、印记/残响注入与消耗、星决蓄能、被动联动等。当前 109001 仅为基础闭合（`runtime-integrated` 为中间状态），**不得作为验收结论**，必须完成机制拆解还原后再走产品签收。

首个 E20-2 角色：109001 末音。目标四段 `extracted -> runtime-integrated -> visually-accepted -> optimization-ready`，当前完成到 **runtime-integrated**（视觉签收 pending，优化就绪待后续时序/账本闭合）。

实施内容：

- 新增 `scripts/character-combat/profile-recipes/109001.json`：mechanicsDiscovery（普攻 10900101、重击 10900110、星鸣 10900112、星决 10900113、星携 10900121、极限反击 10900125、完美招架 10900127、被动 10900161/10900162）、reachable controls（29 个）、120s 三演员 golden（星鸣+普攻）、`timingPolicy=verified-input-reopen`；publicActionForms 保持空，由自动候选保留原有动作映射与时序（手写 form 曾错误覆盖星鸣技占位为 60f，已回退）。
- 编译产物：`character-combat-profiles/109001.json`（valid / runtime-applied / partial）、owner contract、`reports/m10/109001/*`（10 个公开动作、23 个 reachable control、74 命中、36 语义效果、0 阻断账本、golden 通过）。
- 验收：新增 `acceptance-recipes/109001.json` + `fixtures/character-acceptance/109001-visual.json`（星鸣技 + 6 个临界矩阵动作，用单命中闪A 10900115 做临界/期望/落空覆盖）；截图 `m11-d-character-acceptance-109001-desktop.png` 已生成；manifest 达到 `runtime-integrated`（canonical golden + headless 稳定 + workbench 往返通过），产品可视签收 `pending`。
- 资格：109001 记录 `extracted -> runtime-integrated`；`character-acceptance-not-published` 9→8；资格缺口 23→22；`m12cLocked` 保持 true。
- 包哈希重基线：新增 owner 后 verified 包 hash `79f8e8df…`（`FROZEN_B3_SOURCE_HASHES.verifiedMechanics=9b44e1f9…`）；四个验收 fixture、四个 machine-axis fixture、integrated baseline、cycle 验收报告、golden 迁移断言、Workbench/CLI/搜索测试中的 hash 全部同步新包。

验证：全套 Vitest 1430 条（并行负载下 7 条超时/worker 崩溃，单独全部通过，含两个已知 process-heavy 用例）；optimization-qualification / character-acceptance / verified-combat / workbench-data / action-status / applied-source-bindings / kibo-headless / bundle 审计 clean；production build 通过。

109001 剩余阻断（记录在案，不伪造放行；E20 规则下属必做项）：

- Workbench 动作时序：星鸣技当前为未验证占位（2000ms 兜底/60f 输入窗口），charged/dodge 等动作显示“真实动作帧等待 asset 或运行时捕获补充”——需后续按 103002 模式逐窗验证（`optimization-ready` 前必须闭合）。
- 验收矩阵 210 项当前通过 4 项、source gap 294、blocking ledger 需清零后才到 `optimization-ready`。
- 产品可视签收（截图人工复验）→ `visually-accepted`。

### M12-B3-E20-1a 已完成：星赐节点技能等级接入 canonical 核心（2026-08-07）

星赐节点（`talent_rune.runeSkill = skillIndex#level`）的等级加成此前只登记为 `star-gift-node-skill-level-runtime-unapplied`，本轮实现运行时通道：

- **skillIndex 语义确认**（BWiki 星赐属性描述与 runeSkill 互验）：0=普通攻击（`characterId*100+1`）、1=星鸣技（ground slot 3）、2=星决技（ground slot 4）、3=星携技（ground slot 203）。
- `resolveCharacterCultivation`：`staticSources.starGiftNodeSources[].skillUpgrade` 透出，新增 `starGiftNodeSkillLevels` applied 清单（每节点 skillIndex/level/sourceIdentity）；`unappliedSkillSources` 只保留 hero_rank 解锁技能族。
- `projectResolvedOptimizationCultivationActor`：`character.starGiftNodeSkillLevels` 进入 `appliedDimensions`，`unresolvedDimensions` 移除该族；`actorConfigPatch.cultivation.starGiftNodeSkillLevels` 透出（`normalizeWorkbenchCultivation` 同步保留）。
- Machine Axis：`prepare()` 按队伍槽把星赐加成解析为 skillId→level bonus（用完整 `characters.json.skillSlots` 映射，seed 投影无槽位信息），在 actionDraft 构建时 `level = intent.level + bonus`（如 109001 普攻 +7、星鸣技 +5、星决技 +4、星携技 +3；101010 普攻 +7）。仅带 cultivation profile 的正式路径生效，既有 fixture（无培养合同）哈希不变。
- 验证：`heroRankAdjacentRankEvidence.test.js` 新增映射与 Machine Axis 等级断言（109001 星鸣技 10900112 level=1+5）；qualification 目录 103 测试 + machineAxisService 全过；全套 Vitest 1435/1436（仅已知 process-heavy 并行超时，单独全过）；production-import 审计 clean。资格缺口仍 35（`strict-character-cultivation-runtime-partial` 11 条剩余全部来自 hero_rank 两族证据边界），`m12cLocked` 保持锁定。

### M12-B3-E20-2-109001 R3 已完成：被动1 持久化 + Overdrive tag 307 运行时闭合（2026-08-07）

在 E20 全量机制矩阵 v1（`work/m12-b3/e20-2-109001/STATE.md`）基础上，先闭合两个易项：

- **被动1（10900161 哈库茵之耀）**：新增 `persistent-property-runtime` 被动编译模式，被动控制 10900161@0F 直接注入的元素 109001316 编译为 attr21 +5400（defaultPropertyTags[307] = Overdrive，超限伤害+54%）；hero-module 等级文案 + ast_109001296 补暴击率+3%（attr7 +300）。variant runtime 战前（timeMs=0）生成持久效果命令（`verified-passive|battle-start|…`）。
- **Overdrive 命中 tag 307**：`verifiedTuningMarkGeneration` 为 overlimit-\* 事件写入 `propertyTags=[307]`；`verifiedDamageEventGeneration` 取“事件 tags ∪ 技能 tag”并集（保留 302/303 等技能 tag，避免破坏 10123/10150 灵魂加成）；超限结算按 tags 应用被动乘区。
- **109001 暴击阈值 500→800 适配**：被动暴击使临界矩阵 boundary 变化，fixture sampled roll 改 799/800，`inspectCriticalMatrix` 按 owner 边界校验。
- **哈希/期望全量重基线**：包 hash `c87fb71b…`、FROZEN `e7b18d90…`；9 个 fixture、m11 integrated baseline、cycle/dynamic-loadout acceptance report、migration/pipeline/ruby/han/tuning/coverage/package/workbench/canonicalTraceView 单测期望同步。
- 验证：新增 2 组单测（战前被动命令、超限 tag 307 并集）；全套 Vitest 1443/1445（仅已知 process-heavy 并行超时，单独通过）；11 项审计 clean；109001 保持 `runtime-integrated`（4/4），资格缺口 22，`m12cLocked` true。

下一阶段任务（按依赖顺序）：星决蓄能资源+被动2（璀璨下普攻3/5/重击+1）→ 重击检测回能 → 大招减CD+星鸣 2 充能 → E技能/入场检测条件门控 → 璀璨普攻变体/残响曲线 → golden 全覆盖。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-2-109001 R4 已完成：被动2 + 重击回能（SP 门控）闭合（2026-08-08）

- **被动2（10900162）**：新增 `action-frame-with-state` runtimeEffectBinding 触发类型；璀璨下普攻3/5/重击各 +1 SP（109001300），条件不满足时显式记录不触发。
- **重击回能（M7）**：sync 编译器新增 `directSpPresence` 契约（判断门控 direct-SP，markId=250）；tuningGeneration 按印记层数在重击 5/20/60F 门控，combat runtime 结算 `tuning-conditional-direct-sp` +1 SP/击。
- **10900162 状态**：由“无名第二被动 N/A”转为“已实现”（product-boundary 新增 implementedPassiveSkillIds）；验收清单以 3 条 scenario-coverage 阻断登记，待场景覆盖后放行。
- 验证：新增 2 组单测；全套 Vitest 1445/1447（仅 2 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过；109001 保持 runtime-integrated（4/4）；包 hash `a47d98f5…`。

下一阶段任务：大招减CD + 星鸣 2 充能 → E技能/入场/招架检测门控 → 璀璨普攻变体/残响曲线 → golden/验收场景覆盖全部机制。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-2-109001 R5 已完成：大招减CD + 星鸣充能重置闭合（2026-08-08）

- `actionRuleDiagnostics` 新增冷却缩减事件收集与应用：从动作 resolution effects 读取 `cooldownReduction`（109001171 value=-20 → 20000ms），把同角色星鸣技最远未就绪的充能提前（clamp ≥0）；星鸣技 cooldownCount=2 双充能独立就绪。
- 新增单测：3 次星鸣 + 1 次星决后第三次星鸣立即可用（无 skill-cooldown-active，readiness=ready）。
- 验证：全套 Vitest 1446/1448（仅 2 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过。

下一阶段任务：E技能/入场/招架检测门控（3 雷印记、3 风残响、1 雷印记）→ 璀璨普攻变体/残响曲线 → golden/验收场景覆盖全部机制。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-2-109001 R7 已完成：M18 完美招架弹反链闭合（2026-08-08）

- sync 构建新增 `applyHeroParryRuntimeChainMerge`：10900149/sub1 弹反链（109001362 消耗1雷判断）并入完美招架公开控制 10900127/sub0；完美招架 action 现在携带弹反超限链。
- 新增单测：完美招架 + 1 雷印记 → 29F 消耗印记并触发雷 overlimit；全套 Vitest 1447/1449（仅 2 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过；包 hash `44ddb7ef…`。
- 已知细化项：弹反链“璀璨”门控当前未与 A4 条件组统一（consume 仅检查雷印记），已记录不阻塞。

下一阶段任务：璀璨普攻变体（10900101 sub1）选择语义 → 残响注入/曲线 → golden/验收场景覆盖全部机制。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-2-109001 R9 已完成：golden 机制覆盖 + 消耗语义修正（2026-08-08）

- 109001 golden 扩为 8 动作机制覆盖：星决→星鸣→A5→极限反击→重击→完美招架→星鸣×2；断言第三次星鸣不被充能阻断（M12）、完美招架消耗 1 雷印记（M18）、重击 SP 总变化 >3（M7/M21）、总伤害>0。
- golden runtime 新增 `initialTuningMarks` 播种、`tuningMarkConsumeByActionId` 投影、normal-attack 分段时长回退。
- 消耗语义修正：`applyMarkConsumption` 缺省只消耗 `consumeLayerNum`（109001362 类判断不再误耗全部层）。
- 包 hash `b9a2b9a4…`；功能阻断 1204→1197；全套 Vitest 1445/1449（仅 4 条已知 process-heavy 并行超时，单独通过）；11 项审计 clean；build 通过。

下一阶段任务：M6 璀璨普攻变体语义（待产品确认）→ 残响登记 → M12-C 前置验收。每完成一个子阶段即更新本手册并单独提交。

### M12-B3-E20-2-109001 R11 已完成：被动2 按无名第二被动未实装回退（2026-08-08）

用户质疑 10900162（被动2）是否有实际引用，并提示项目既有口径「所有无名的被动技能都是未实装」。核对后确认用户正确，R4 对被动2 的接入被回退：

- 10900162 与 10101062/10300262 相同：本地化 name/displayName 均为空，只有描述文本；所属元素（109001299/300/301）在全部 109001 控制资源图中无引用边，`10900162.asset` 的 `skillResourceMaps` 为空。
- 回退：删除 recipe 中三条 `moyin-passive2-*` runtimeEffectBindings（A3/A5/重击 +1 SP）、恢复 `unnamedSecondaryPassiveSkillId: 10900162`、删除被动2 单测、移除 109001 `implemented: true`；通用设施（`action-frame-with-state`、`directSpPresence`、冷却缩减收集）保留，M7 重击回能不受影响。
- 边界自动恢复 `unnamed-secondary-passive-not-implemented-current-client`；功能阻断 1197→1194（3 条 scenario-coverage 随绑定移除）；M21 从已实现移入未实装 N/A，机制矩阵为：已实现 M1-M5/M7/M9/M12-M14/M17-M20/M22/M24-M25；孤儿 M8/M10/M11/M15/M16/M23；待产品确认 M6。
- 包 hash `8f21567a…`（文件 sha `efb13246…`），FROZEN verifiedMechanics 同步；8 个 fixture、m11 integrated baseline、b2 cycle 验收报告、dynamic-loadout acceptance report（6 项资格哈希 + canonical hashes）全部重基线。
- 验证：全套 Vitest 1446/1448（仅 2 条已知 process-heavy 并行超时，单独全过）；10 项审计 clean（m11-headless 包审计在提交后复跑）；production build 与 `git diff --check` 通过。

下一阶段任务：提交回退后复跑 m11-headless 包审计；M6 璀璨普攻变体语义（待产品确认）→ M12-C 前置验收（视觉签收/optimization-ready，待用户）。

### M12-B3-E20-2-109001 R12 已完成：M6 晶石普攻形态按客户端未接线收口（2026-08-08）

按用户要求「普攻在璀璨状态下的变体自己全补明白」，对 10900101 sub1（playerSkillId 109001011，动画 Skill0_6，230F）完成全量拆解，确认其客户端未接线，不建模为产品行为：

- sub1 0F 注入璀璨 109001270，13/16/19F 命中 109001251（极限反击hit1~3），无输出桥（终态）；两个 元素 轨仅为滞空/移动行为。
- 无选择条件：skillsub_logic 无 subskill selector、public labels 仅「普攻」、battle-switch/resource-state 均 0 边、input-hold-chain 中 sub1 targetControlSkillIds=[]。
- 无外部引用：全部 109001 控制资产仅 10900101 自身引用 109001011；无控制以 10900101+skillIndex=1 为桥接目标（极限反击/追击的连击桥接均为 skillId=0 回落默认攻击）。
- 文本不支持：10900101 文案只描述璀璨下 A4 超限（M5）与 A5 印记（M4，均已接入），无 A1 晶石变体描述。
- 数值归属：109001251 的 skillsub_ele_value 主技能为 10900125（极限反击），sub1 命中即极限反击伤害；晶石攻击元素族（109001122-124/318/325）在全部 109001 控制资源图中 0 引用。
- 管线影响：sub1 仅 1 条 m10 static-evidence-gap 记录（璀璨注入），不进验收阻断账本；109001 保持 runtime-integrated（4/4），功能阻断/资格缺口不变。
- 机制矩阵 25 项全部收口：已实现 M1-M5/M7/M9/M12-M14/M17-M20/M22/M24-M25；N/A M21；客户端孤儿 M6/M8/M10/M11/M15/M16/M23；待产品确认 0。证据见 `work/m12-b3/e20-2-109001/m6-sub1-orphan-evidence.md`。

下一阶段任务：M12-C 前置验收（视觉签收/optimization-ready）待用户参与。

### M12-B3-E20-2-109001 S1 已完成：源头账本清零 + 被动1 暴击回退（2026-08-08）

按“先实现功能、验收通过后再统一跑测试/审计”的节奏（用户指令），完成 M12-C 前置工程第一阶段：

- sync 级：hero 控制不再为“无触发帧且已被同 map 其他根作为子元素覆盖”的根生成运行时效果绑定（原仅奇波零距离策略生效；根保留，Ruby 弹药 42 条资源操作计数不变）；新增 `PRODUCT_CONFIRMED_DEAD_VARIANTS`（10900101/sub1），命中与效果绑定从包中移除并写入 `excludedDeadVariants`。
- pipeline 级：`recipe.unresolvedRecords` 可按 recordIdentity 把具体 effect 记录强制 N/A（仅限 status=not-applicable 条目）。
- 109001 源头账本 gameplay-impacting 16→0；验收源头缺口 16→0；阻断账本 185→166（剩余全部为 acceptance 场景缺口：97 coverage-missing + 69 selector-unavailable）。
- 被动1 暴击增加（M20）按用户口径回退：109001296-298 全 109001 控制图 0 引用、文案只描述超限伤害；recipe 移除 attr7+300，仅保留 109001316 超限（attr21+5400 tags[307]）；109001 暴击阈值边界恢复 500（fixture 499/500，`inspectCriticalMatrix` 移除特例）。
- 包 hash `546e2ae1…`（文件 sha `ca829d76…`）；fixture/FROZEN/验收报告已同步；测试与审计按用户指令延后到最终验收通过后统一重基线。

下一阶段任务：S2/S3 消除 109001 的 166 条 acceptance 场景缺口（扩展 golden/验收场景与选择器）→ 矩阵全绿 → 统一测试/审计/提交。

### M12-B3-E20-2-109001 S2 已完成：追击/弹反链运行时接通，验收阻断 166→12（2026-08-08）

- **M2 追击全链路接通**（此前编译未执行）：contextActionId 贯通 + 派生控制窗口重定向 + immediate-interrupt 上下文调度（源动作输入帧提前结束、追击从该帧执行）+ always 条件修复 + always 窗口去状态依赖 + 追击 230F timing 构造。星鸣/星携追击输入现解析为 10900143，6 次命中、璀璨注入、超限消耗、追击后自动接普攻4 全部落地。
- **M18 弹反链命中接通**：merge 改为运行时附加 10900149/sub1 的 7 次命中（并扩占轴到 53F），完美招架打出完整反击 + 璀璨超限。
- 伤害事件补 hitIdentity（golden 命中投影 0→77）；A4 璀璨超限命中补齐；control-window 等 6 类选择器与场景投影补齐；内部控制脚手架/死变体窗口登记 N/A。
- golden 场景扩到 24 动作（含追击输入、双切换星携、星结合击+奇波、直发星携负例、二次招架）。
- 阻断账本 185→12（源头 0），验收矩阵通过 29→166、N/A 17；包 hash `2c0b5dde…`。
- 剩余 12：印记共鸣（251/252/253 真实子效果，运行时未应用）、GP派生伤害（102001093）、799 孤儿、7 条协议场景（buff 刷新、4 条 critical 探针、窗口边界、资源精确/不足事实）。

下一阶段任务：S3 处理剩余 12 条（共鸣效果实现 → GP派生伤害 → 799 N/A → 协议探针场景）→ 矩阵全绿 → 统一测试/审计/提交。

### M12-B3-E18 sub3 已完成：500213 SpacialProperty 按战斗属性闭合，目标 signature 行清零（2026-08-07）

二进制/数据证据链：dump.cs `ESpecialPropertyType`（1=ALL_PROPERTY_SHOOTDMGUP 全属性伤害增幅 / 2=ALL_PROPERTY_DEFENSE 全属性受伤减免）；changeType=2 全库仅 5 个元素（520012001/540074/53201902/53201903/53110406），均携带战斗 attributeID（26=PHYSICAL_SUFFERDMGDOWN、62=FIRE_DEFENSE）与 specialPropertyType；census 被动侧 520012 神圣之躯（changeType=2、attr26、+20%）早已按战斗属性解析为 `equipped-kibo-self-property-effect` 并进入运行时被动生成。据此修正 sync `classifyBattleEffectNode`：changeType=2 且 specialPropertyType ∈ {1,2} 不再推 `property-change-type-not-battle-property`，`propertyChange` 契约携带 `specialPropertyType`/`specialPropertyTypeName`（changeType=1 玩家属性仍保持非战斗门禁）。540074（全元素抗性下降 -0.91%/16s）因此从 unresolved 转 applied。结果：**50021301 菇噜噜 signature 行 evidence-closed，目标 signature 开放 1→0；publicActionClosure 360/6/0→361/5/0；appliedNodeCount 971→972 / unresolvedNodeCount 1865→1864；semanticAppliedEffectCount 961→962**；资格缺口保持 35（kibo 0）、视觉 253/254（kibo 43/43）不变。包 hash `1478862f…`（内部 packageHash `807f0104…`），Machine Axis 标准哈希 `5585c6fb / 3284ab09 / 08c9cc8c / 0b410dc9`，cycle `c44ef286 / c0c07d89 / ed68ea5f / 13fc3bf3 / 1f2e8b1e`，资格哈希 `d53c8c1b / 9cc0bdd8 / f4e8a71e / fe44f482 / 63a4de45 / cbbf175e`。同步更新：FROZEN_B3_SOURCE_HASHES.verifiedMechanics、7 个 fixture、m11 集成基线、cycle/资格/验收报告、迁移/回放/包/覆盖/Workbench/canonical/census/cycle 测试锁定。验证：全套 Vitest 1427/1428（仅已知 process-heavy `characterCombatProfilePipeline` 并行超时，单独全过）、11 项确定性审计 clean、production build 与 `git diff --check` 通过。**奇波侧缺口全部清零（资格 byObjectKind kibo=0、视觉 kibo 43/43、census 目标 signature 0、被动 520059 已闭合）；剩余为非奇波/非 roster 项：set-skill:3:4 视觉阻断（C14 来源冲突，需产品决策或新证据）与 3 条非 roster 被动（520004/520005/520006）**。每完成一个子阶段即更新本手册并单独提交。

### M10-A 小玉闭环缺口修复已通过独立机制验收（2026-07-28）

普通 A3 与普通 A4 现分别按 `18F` 和 `10/14/18/22F` 的真实投射物链结算，A4 四次 hit 与爆发 A2 十二段保持独立。入场星携技保持 `95F` 占轴但允许 `55F/109F` 命中在块外继续结算，逐 hit 选择统一写回父切人事件；完美招架反击由 `successful-parry` 场景前置驱动 `10101049/sub1` 的两次命中。缘结阈值事务会同时清空资源、进入爆发并获得 2 层风印记；极限反击本体不再因仅开放派生窗口而误触发玉未央。

小玉 golden 与生成报告已按逐动作、逐命中和逐资源事务重建；星决技刷新是否再次给予风印记继续保留为 `runtime-evidence-needed`，无名第二被动和 legacy 元素边界不变。141 个测试文件、867 条用例、62/62 production preview、两道生成漂移、生产数据/来源守门和 production build 通过。独立机制验收确认玩法结果通过；Workbench gzip `370,692B`、总 JS gzip `761,260B` 的既有发布风险继续单列，本轮不压包。

### M10 小玉与红宝石 SubSkill 重导出接入已完成，等待产品复验（2026-07-29）

上游完整重导出恢复 65 个容器、1,377 个对象，并确认问题域 1,487 个完整对象、0 个 stub。Axis 同步器现按 skill-player/subskill 归属 behavior track，修复共享 Element PathID 导致的跨形态重复命中和效果；范围覆盖红宝石星鸣技及其他受影响 control，也覆盖小玉重击与派生控制。红宝石当前 24 个执行形态/124 个 hit，小玉 21 个执行形态/107 个 hit，公开动作均为 10/10 runtime-ready；两个角色仍保持 `runtime-applied / partial`，未用重导出掩盖既有实机证据缺口。

生成包、owner profile 与 golden 已从同一轮完整数据确定性重建；小玉 117 条、红宝石 123 条 authoritative golden 断言通过。完整 Vitest 为 141 文件/873 用例，5 条受影响真实 Workbench 场景及完整 production preview 62/62、41/41 必需能力通过，两道生成漂移及全部生产数据/来源守门均 clean。详细范围与去重前后数据见 `reports/m10/reexport-subskill-scope-20260729.md`。Workbench gzip `370,771B`、总 JS gzip `761,316B` 的既有发布风险继续单列，本轮不做包体优化，也不启动下一角色或 M11。

### M11 暴击采样上游结论与计划修订（2026-07-29）

当前客户端已确认在每个符合条件的 `DamageElement` 执行前以 `RandomUtility.Range(0, 10000)` 生成并保存独立 `criticalRandom`，再按 roll 与有效暴击阈值比较；该构建的整数 Range 正常路径调用 `UnityEngine.Random.Range`。因此正式语义是逐 hit 的运行时伪随机采样，不是固定暴击序列或自动期望值。工具的游戏采样模式会使用显式 seed 保持可复现，但只承诺复原分布与判定尺度，不承诺从轴输入还原客户端可能被其他系统消费的全局 RNG 序列。

M11 输入合同相应增加场景级 `sampled / expected / critical / non-critical` 暴击策略和 seed；每个稳定 hit identity 分开保存命中覆盖及 `inherit / sampled / expected / critical / non-critical` 暴击覆盖。Workbench 检查面必须能逐 hit 选择是否命中、强制暴击、强制不暴击、随机或期望值，并展示实际暴击率、roll/阈值或期望贡献。期望模式不得伪造暴击事件；遇到会改变 Buff、资源或派生的暴击副作用时，必须带权分支或显式阻断。证据、RVA 与验收边界见 `reports/m11/critical-sampling-evidence-20260729.md`。

### M11-A-R1 Canonical Headless Combat Core 已通过产品验收（2026-07-29）

唯一无头核心继续提供 `catalog / compile / validate / simulate / evaluate / explain` 六个纯接口。R1 统一了场景级与逐 hit `sampled` 的 seed/随机源门禁，隔离资源预检与最终随机序列，按命中时目标属性 102 应用 `CRI_DEFENSE`，并让 Workbench 分析报告复现只调用 canonical core。小玉、红宝石、寒悠悠及寒悠悠主控 Buff 切人 golden 的 replay/summary hash 无漂移；canonical trace hash 已按新增暴击追踪字段更新。完整 146 文件/901 测试、62/62 production preview、41/41 必需能力和全部来源/漂移守门通过。Workbench gzip `375,287B`、总 JS gzip `768,160B` 继续作为对外发布风险单列；独立复验在 `80c5f35` 通过，随后进入 M11-B。

### M11-B-R2 Machine Axis Contract 与 CLI 已通过产品验收（2026-07-29）

Machine Axis v1 继续通过唯一 canonical core 提供版本化 Schema、语义排程、逐 hit 命中/暴击覆盖、captured roll 和五命令 CLI。R1 补齐正式奇波目录的 122 只奇波/366 个公开动作，合同固定 60 FPS，文件读取失败稳定返回 INPUT=3，异步写出失败稳定返回 RUNTIME=5 并将版本化错误回退到 stdout；资源不足诊断保留 owner、identity、current/required 且不生成失败占轴块。120 秒 fixture 现含三名角色实际切入、红宝石弹药交易和真实奇波动作，API/CLI/Workbench 的 canonical hash 一致。R2 为真实子进程 I/O 用例设置 30 秒测试边界，并由正式夹具测试直接守住验收报告 canonical hash，防止并发负载抖动和陈旧报告再次漏过。聚焦 7 文件/43 测试、隔离完整 151 文件/931 测试、62/62 production preview、41/41 必需能力及六道审计通过，四份 M10 golden 无漂移。M11-B-R2 已在 `8da52fb9daa8d849c14b1d737d0d723e9ab077d5` 通过产品验收；Workbench gzip `375,306B`、总 JS gzip `768,501B` 继续作为对外发布风险。

### M11-C Visual Verification Workbench 已通过产品验收（2026-07-30）

Workbench 已按 canonical trace hash 建立 memoized action/hit/effect/resource/state 索引，并接通 Machine Axis v1 的冷启动导入、精确导出、无效输入保护与逐 hit 命中/暴击编辑。暴伤、expected 两分支/概率/核心加权值和事件物化状态均直接消费 canonical settlement；标准轴显示 `150%` 与 `6.2 / 6 / 10 / 5% / false`，缺字段显示未知。M11-C 已在 `308dd07fbbb8fe0759062e9dcc02c65b0fd46115` 通过产品验收并进入 M11-D；包体超限和纯性能抖动继续只记录为发布风险。

### M11-D 角色机制验收协议实现已完成（2026-07-30）

R1 将来源 requirement、可执行 scenario case、结构化 trace、精确 coverage edge、去重 ledger 与成熟度改为同一条可重算派生链，并用 committed manifest index 绑定 manifest、catalog 与 canonical core 资格门禁。`899edea0c5a1f718153ebe86712ecd8c31aabf7d` 的角色单边产品签收未带入最终合并外审基线；181 个 source gap 与 706 个 acceptance gap 仍构成 887 个唯一功能阻断。当前三角色保持 `runtime-integrated`，`visuallyAcceptedCount=0`、`optimizationReadyCount=0`；视觉资格需按最终合并基线重新验收，M12 明确未启动。

### M11 无头核心外部审计已通过并关闭（2026-07-31）

M11-01..08 已由前轮外部复审关闭。R2 基线 `6601ebd1d53748fc4eaeea3ecf3dec9fc891cce6` 将 Machine Axis 原始数组顺序在 compile 前固化为 source sequence，并贯穿派生、诊断和 runtime；action ID 不再决定同帧 Break、伤害或资源。CLI 取值参数统一在 I/O 前校验，warning path 使用 canonical plan 真实索引。不同角色可携带同名奇波，CD 与资源按 `actorId+kiboId` 隔离。

最终外部短复核在 `64603640bda82d6ab3d869e98d70696f73caeef7` 通过且无新增 P0-P3：M11-09 关闭，ID 重命名反例为 `468 / 468`；CLI 参数边界 `7/7` 在 I/O 前以 exit 2 拒绝非法输入；warning path 指向 `executionPlan.actions.1` 与 `.15`；官方完整性校验和五命令 smoke 均通过。既有审计包与 SHA 不变。该通过只关闭 M11 无头核心外审，不代表角色/奇波已经视觉验收或优化就绪；当前两项计数均为 0，M12 继续锁定。

### M11-R3 基线清理（2026-07-31，已通过）

Workbench 草稿快照与项目重建路径持久化并恢复 Machine Axis source sequence，持久化重建后 input/trace hash 与权威基线 `c91f9da64e02ef84 / d10c45fb73dc7c6f` 一致；空 draft 不再被误标为根序列 0。陈旧测试期望已同步到已提交权威 golden 报告（旧 trace hash `017c87…`、expected 临界分支、assertionCount、调谐印记伤害），M11-01 边界用例超时放宽至 15s。全量回归 165 文件 / 1100 测试通过。

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。

### M12-B3-E20-2-109001-S3-R1 无头 parity 修复（2026-08-08，等待产品复验）

- S3 的机制账本清零结论保留，但产品验收以两个真实反例打回：A5 在璀璨关闭时错误获得雷印记，A4 先合成印记再消费且错误消耗璀璨；同批又确认星决重置事件可被后续 readiness 无限复用，且 Charge 技能被近似成并行 `readyAtMs` 槽。R1 统一修复这四类无头核心错误，不启动 108003。
- 全局 policy 继续是 `m12c-zero-distance-passive-boss-v1 / 967b0667f315db5b`，roster 是 `m12c-wind-thunder-mark-producer-roster-v1 / a690b860f0967e3d`。正式 9 人为 `101010/103002/109001/102001/107001/107002/108003/112001/STARBORN`；末音后待做 5 人为 `102001/107001/107002/108003/112001`；`108001/111001` 保持 `product-scenario-excluded`。Kibo DNA 固定 `[]`。
- 编译器以来源驱动的 `element_formula 102100 = IF(self.ELEMENT_LAYERS[M] > I,T,F)` 生成 activation-only wrapper，适用于 inject/judgment，不写 109001 ID 特判。A5 只在璀璨存在且动作/命中合法时于 47F 应用恰好 `+2`；A4/追击只把璀璨作为允许条件，实际消费 `element 250`，成功消费后才生成一个 `element 296` 超限 packet，绝不生成临时 `+1`、绝不消费璀璨。Workbench/动作分析只投影已应用事务，条件失败保留结构化 suppression。
- Golden 反例已锁死：旧 frame 547 的 A5 `0→2` 消失；璀璨在 frame 731 获得，frame 847 的 A5 才 `0→2`；frame 1029 的 A4 只执行 `2→1`，璀璨不变，并产生一个 `element 296` packet（raw/HP `110461`，toughness `6123`，`sourceSequencePath=[0,60,49,296,0]`）；璀璨只在右开 8 秒边界 frame 1211 到期。连续 A4 为 `2→1→0`，资源不足的第三次不出 packet；主动 `10900112→10900143` 追击可消费一枚印记但不消费璀璨。
- 冷却核心改为通用一次性 transaction：只有 accepted/executed 的来源动作在真实 effect 时刻物化；`slot=-1` 只解析事件发生时正在冷却的目标，没有目标也立即消费而不预存；每个事件/目标至多结算一次。Fixed `-20s` 对 Charge 的一次 RefreshCoolTime 最多恢复一层，blocked、资源不足、重叠、`execute=false` 均不产生重置。
- Charge 改为原生共享顺序计时器 `chargeMaxCount/currentChargeCount/coolTime`，10900112 使用 `15000ms`。反例 `t0/t1/t2/t6` 为：第一发 `2→1, timer=15000`；第二发 `1→0, timer=14000`；t2 合法星决把当前 timer 归零并仅恢复 `0→1`，重置 timer=15000；t6 消耗该层后仍沿用共享 timer，下一层只在 t17 就绪，不是独立槽近似的 t16。满层冻结、自然 t15/t30 顺序恢复、精确边界、两次独立星决、无 CD 不预存及非法星决负例均进入 canonical/Machine Axis/cycle/search replay hash。
- S3 原 251/252/253、buff 生命周期、四条 critical 与主动输入窗仍是真实机制闭合；`102001093` 和反应动作专属 action/hit/effect/window 继续按 `m12c-zero-distance-passive-boss-out-of-scope` N/A，`799` 继续按 `m23-client-orphan-no-reachable-native-consumer` N/A，均未伪造 runtime。
- 生成器当前给出 requirement `207`、required/pass/N/A/blocked=`138/138/69/0`；ledger source/acceptance/non-blocking=`0/0/13`；2 个场景均执行通过，1097/1098 assertion 通过，唯一未通过 assertion 是产品视觉身份。109001 仍为 `runtime-integrated`，唯一 blocker=`acceptance-product-visual-signoff-pending`。
- 当前 verified package hash `ed65d281dc63732353605142ee3f8ebebd7329618def661d8477b48d266e6e7e`，文件 SHA-256 `1f3ed08b56ebf56c48ecf1f7909dbd537d172918253b0f6871b3048540f44aa0`，109001 golden replay hash `1d6b5ad18b084a625ec571af96ae3252f123b0e56453e2a0b4d6fbb95b4ed724`。资格为 `9/43/62/137/12`，source/roster/manifests/ledger/binding/catalog=`0a4b69e0716de917/a3edc962effdcba0/1cb4029bc8a8c91f/c70e8c978317e184/8d6ae083ad89db3b/4346c39d4d818730`；全局 16 个 blocker 全是角色项，M12-C/formal search 继续锁定。
- 最终串行 Vitest `192/192` 文件、`1472/1472` 用例通过；verified-combat、character-combat、scenario-policy、character-acceptance、visual-acceptance、optimization-qualification、production-imports、Workbench data、action-status、applied-source-bindings 与 Kibo headless 均 deterministic clean，production build 1878 modules 通过。最终仍停在末音产品视觉复验点；未经签收不开始米蒂、E20-3、M12-C 或正式搜索。

### M12-B3 敌人等级数值产品验收与合并（2026-08-08）

- 产品已接受敌人等级基线 `d1587a8800b23bd848e267ae0baf219ab92fc96a`，closeout 为 `ae3be2f04d6e478abf8a52dad5495a81daf969c1`。运行时依据 `enemy_pack.templateID`、等级模板值与 `FormulaUtility.CalculateAttribute`结算 ATK/MAXHP/DEF/MDEF/韧性，缺 pack、template 或精确等级行时 fail closed。
- 迅狼 `300032` Lv80 已由原始 `MAXHP=8628 / DEF=MDEF=9000` 纠正为等级成长后 `MAXHP=86778.6984 / DEF=MDEF=810 / maxToughness=26822.0077`。有限面板数值与试点 `hpMode=infinite`执行政策分层保存，无限 HP 不再通过放大 hpMultiplier 伪造。
- `enemy-level-profiles.json`、`resolveEnemyLevelStats`、compiler、canonical headless、Machine Axis 与 Workbench 共用同一来源链。结构化证据见 `reports/m12/m12-b3-enemy-level-evidence-20260808.json`，任务记录见 `work/m12-b3-enemy-level/STATE.md`。

### M12 优化器三主指标合同重构（2026-08-08）

- 正式目标现为 `cycle-dps-no-toughness`、`cycle-dps-with-toughness` 与 `fastest-kill`；旧 `damage/burst/toughness` 降为诊断项，正式流程在模拟前拒绝 legacy 或漂移的 objective contract。
- 两个循环指标只接受半开区间且连续两轮闭合的循环 proof；最快击杀按首次致死 frame、time 与完整 runtime cursor 排序，并保存致死 action/hit、requested/effective damage 和 overkill。
- 优化器严格消费 enemy-level pipeline 产出的权威敌人档案，不自行计算等级成长。无来源、缺字段或 hash 不一致时 fail closed。
- 破韧发生包、同帧后续包与恢复帧的客户端原生 parity 证据仍 open；当前产品政策允许按版本化无头 runtime 合同产生 formal score，并要求未来客户端证据若有差异则升版、作废并重算受影响结果。
- 治疗统计已加入 batch/search/cycle/kill 报告，包含 requested/effective/overheal/HPS 与 source actor/action 聚合；护盾和 suppressed 事件保持独立。
- 合并不解锁 M12-C 或正式搜索；Kibo DNA 继续固定 `[]`。

### M12-B3-E20-2-108003-S1 米蒂完整缩减动作面闭合（2026-08-09，产品验收通过）

- 本阶段起始基线为 `140eefcd233cd9c1d136728f1c94b91aff632278`。用户对米蒂的下发已由生成器同步成 109001 S3-R1 产品接受记录：末音 `qualificationSubjectHash=c369c5382ad3b812`，required/pass=`138/138`，maturity=`optimization-ready`；该同步绑定 `4a5030a52bd51a118f579957bc449efa0c38cf3b`，未绕过验收合同。
- 米蒂来源清单共 `510` 个 identity（battle-element 25、client-code 3、NewTable 50、other 54、runtime-contract 25、skill-control 353）。完整 requirement=`225`，required/pass/N/A/blocked=`139/139/86/0`，source/acceptance gap=`0/0`，2 个场景及 `1035/1035` assertions 通过。原始 ledger 的剩余行全部为 non-blocking unreachable/not-applicable；反应、位移、空中和 Boss 攻击依赖分支保留来源，按 frozen scenario policy 结构化 N/A。
- 通用 compiler/runtime 新增稳定 `sourceBindingIdentity` 与来源驱动 `hitActivation`。米蒂派生球只在对应父箭 landed 后生成：短蓄 `1` 箭 + `6` pulse，普通满蓄 `1+12`，蓄电满蓄 `3+36`；任一父箭 miss 只抑制自己的流，全 miss 为零。该能力由 canonical、Machine Axis 与 Workbench 共用，没有 108003 ID 特判。
- 星决的 250 根在 142F 只应用一次 `+2`，没有把 `bulletElements/elements` 的同一 PathID 双算；零距离单 Boss golden 实际只有 `5` 个 packet（frame `642/646/653/663/674`），不按文本“最多 18 次”乘算。离场星携 formal 分支为 `11` 击、`12F` cadence，37F 250 根只应用一次；反击/闪避分支保持 N/A。
- 蓄电由星鸣/星决给予并按 10 秒右开刷新/到期；合法重击执行后一次消费，blocked/miss 前置不伪造状态事务。250 印记在 golden 中 `0→2→3→5`，满层重施只刷新，随后按 20 秒共享计时 `5→4→3→2→1→0`。
- 10800361 每次合法星鸣向三名队员各发 10 个 1 秒、每次 `+2 SP` 的事务；第二次星鸣的 30 个事件严格位于 `3391+60*n`。攻击 Buff 对三名 actor 独立维持 24 秒，精确边界先到期旧实例再应用新实例。10800362 只在最后一击 landed 后给 source actor `+5 SP`：frame `2068/3508` 为正例，最后一击 miss 无事务。
- critical 0/100%、整数阈值、不可暴击拒绝、pre-hit 属性变化、miss、主动输入窗和同帧星结合击均使用真实 settlement。星结合击中奇波偏移 1F 会以 `joint-attack-frame-mismatch` 在正式候选校验前拒绝。Workbench 只展示 applied transaction，suppressed 与 policy N/A 单列。
- 108003 当前 package/profile/recipe/golden replay=`72301ce690c866fdcff7fc8df4d375333f810ff22e372c1eecd33a963fe2b287/54a68a920749a851ef5bf7466b8dffad74e861e4fd8f86af08b4a13d628e6b14/91c364d081ed4e4e955db984746e28133c09dfbe40b97c1e91264cd1529faa8f/2b5f91377e4252ff2d451b4a92507eef4712aab918a81f0d7880ec1659b472c1`；qualificationSubject/runtime-scenarioSet/acceptance-scenarioSet/manifest=`c5b361402a77ce3e/f96b380402aee6c1/20afc5b55b18557d/8abf4e3d3794ce24`。
- 中央产品验收接受实现基线 `fdaad80c9839ac8c9768427a9f48b1dcd2138cee`。生成器记录 `character-product-acceptance:108003:fdaad80c9839ac8c9768427a9f48b1dcd2138cee:c5b361402a77ce3e`，binding=`verified`；米蒂现为 `visually-accepted / optimization-ready`，blocker=`[]`。
- 范围分栏是强约束：`reports/m10/108003` 仍为完整通用机制档案，权威状态继续是 `runtime-applied / combatCoverage=partial / runtimeReadyActionCount=7/10 / runtimeCapture=10`；M12 的 `optimization-ready` 只覆盖 `m12c-zero-distance-passive-boss-v1` 缩减动作面（139 required pass + 86 policy N/A）。本次 closeout 没有改写 M10 的全场景事实，二者分母不同且不冲突。
- 全局资格重算为 blocker=`13`（全部 character/not-implemented），分母仍 `9/43/62/137/12`；hashes=`26db4986bce695fe/b3bb274e638433c1/f6aab7de4accdba6/3f1ee6e8e0af5ec4/6cba81d337120c35/b8810086de37175e`，M12-C/formal search 锁定。character acceptance 目录已有 2 个 ready owner，但 formal character kind 在九人全绿前仍为 0。
- 实现期一次 bounded full test 后失败文件均聚焦收口；中央独立验收另验证核心 `11 files/190 tests`、Workbench DOM `108/108`、十项只读 assert-clean、production build `1885 modules` 和双 diff check 全绿。closeout 只同步验收记录/派生报告/文档，不开始 102001/107001/107002/112001/STARBORN、E20-3、M12-C 或正式搜索。

### M12-B3-OPT-T2 有韧敌人客户端结算静态证据与 capture 准备（2026-08-08）

- 证据链固定在 `scripts/machine-axis/evidence/enemy-toughness-settlement-runtime-evidence.json`，重算报告为 `reports/m12/m12-b3-enemy-toughness-settlement-evidence-20260808.json`。它绑定 TC GameAssembly/dump/script 三份来源、精确 RVA/callsites/basic-block bytes+SHA、enum/field 与每项 closes/leavesOpen；`npm run audit:machine-axis-enemy-settlement-evidence` 和 tamper tests fail closed。
- 客户端单包裁决：普通与真实伤害均在削韧前读取 packet 前 weak state 与 property 221，破韧包 HP output 因而为 pre-break；`WeaknessPointChange` 的 setter 调用早于 `ChangeHP`。breakDmgUp 是 profile 属性，不是全敌人固定 2 倍；pure toughness 不套 HP break multiplier。
- local WeakBreakSystem 的计时来自每次 update deltaTime，`WeakBreaking/WeakBreakEnding` 以 `>=` 退出；remote update 仅镜像表现。现 runtime 固定 100ms 与 local 路径的差异已公开登记，需由正式场景真实 capture 先选择 authoritative local/remote/network 路径后再修正。
- runtime-capture manifest v3 与 Frida agent 可记录同帧 `captureSequence/frameCount/deltaTime/threadId`，覆盖 DamageElement、三条 output、HP/韧性 setter、weak state 与 WeakBreakSystem update。当前未运行客户端、未取得真实 capture；工具不自动启动/附加客户端且不提供反作弊绕过。
- 该批当时的 formal gate 继续拒绝 `machine-axis-enemy-settlement-client-order-open`。未闭合的是同帧跨包可见性、结束帧 state update/hit、致死后尾包和 passive boss 执行路径；后续 runtime-baseline 产品政策只改变评分准入，不改写这份静态/捕获证据。

### M12-B3-OPT-T3 controlled capture 操作边界（2026-08-09）

- 先运行 `npm run runtime-capture:preflight -- --output <report.json>`。该命令只重算 manifest、GameAssembly/dump/script 身份并枚举客户端进程；它不会启动、注入或附加客户端。`realCaptureClaimAllowed=false` 的 preflight 报告不是 runtime capture。
- 真实 capture 只能在 operator 已手动启动并登录绑定 TC 客户端、已进入 `m12c-zero-distance-passive-boss-v1` 场景后执行。命令必须给出 PID、`--capture-kind toughness`、action/actor/target identity、独立输出路径与 `--confirm-controlled-session`；禁止自动启动或反作弊绕过。
- 一次可采信会话必须有连续 `captureSequence`、完整 client frame/delta/thread、稳定 event/source/hook identity、无重复 hook/线程漂移，以及唯一 `capture-session-end`。end 中 agent/host event count、final sequence、open stack 和 diagnostic 必须全部一致；任一缺口令 Workbench production audit 拒绝。normalizer v3 逐字节可重复并移除本机 PID、模块绝对路径/加载基址和输入绝对路径，同时对原始 bytes 计算 SHA-256。
- 正式探针至少覆盖：破韧包及同帧后续包、break 结束前/当时/之后与 state update/hit 相位、破韧或致死同包及 post-death 尾包、实际 local/remote/network consumer。112001 还需记录 damage/overlimit 单包、191F wrapper、128F watcher、权威 break cursor 与 observer-active-at-break；等价探针必须附同 consumer/同 phase 调用链证明。
- 当前本机未发现运行中的客户端，因而只提交 blocked preflight 和可复用 capture 门禁。该产物不能被解释为真实记录；后续产品政策可独立批准 runtime-baseline formal score，但仍不得据此宣称 client parity、进入 M12-C 或执行正式搜索。

### M12-B3 runtime-baseline formal-score 政策（2026-08-09）

- 当前评分合同为 `m12-enemy-settlement-runtime-v2`。`formalScoring.formalReady=true` 表示有韧循环与最快击杀可按当前无头核心形成正式分数；`evidence.clientParityReady=false` 和 `machine-axis-enemy-settlement-client-parity-pending` warning 同时保留，二者不可混写。
- 固定评分语义是：breaking packet 以 packet 前 weak state 计算 HP output，随后结算 toughness/break，再结算 HP；同帧后续包按 canonical source sequence 读取新状态；weakness 使用 fixed 100ms tick，break end 右开，state tick 先于同帧 hit。`formalScenarioExecutionPath=local-controlled` 是产品选择，不是已经取得的客户端运行记录。
- fastest-kill 的唯一正式截止点是首次致死完整 cursor。之后的 HP/韧性 settlement 若出现，仅写入 `machine-axis-fastest-kill-post-death-settlement-ignored` 诊断，不再拒绝或改变 TTK；现 runtime 继续执行死亡截断以保持输出整洁。
- `runtime-capture:preflight` 也同步拆为 `formalScoringPolicy` 与 `clientParityGate`：它可报告当前 runtime 合同允许评分，但永远不会把 preflight 冒充一次 score evaluation 或真实 capture。
- 新合同的 score authority 只覆盖当前 runtime 版本。未来 controlled capture 若推翻同帧可见性、break-end 顺序或时钟语义，必须发布新合同，并按 `replacementPolicy` 使旧合同下受影响分数失效重算。
- objective formal admission 不再产生旧 `machine-axis-enemy-settlement-client-order-open` issue；legacy objective、敌人档案、循环闭合、资源/CD/充能、场景政策与 qualification stage gate 仍 fail closed。M12-C 继续锁定，本批不运行正式优化。

### M12-C 产品规则冻结：队伍、装配、三目标与初始状态（2026-08-10）

- 新增权威实施合同 `work/m12-c/STATE.md`。末音固定入队，另外两人从其余 8 个正式优化对象中选择；对象队伍共 28 种。STARBORN 仍只算一个对象，但每条轴只能选择一个来源别名，计入别名后为 35 个来源配置。队伍槽位排列不扩张候选；初始前台在动作轴中搜索并进入 `axisHash`，不进入 `teamIdentity/buildHash`，且 0F 不免费触发星携。
- 装配在固定培养 profile 下联合搜索：每人一只奇波、一个兼容灵子、五个固定部位装备，套装效果只能由装备派生；跨角色同名 `refresh` 效果刷新持续时间，`stack` 共享层池，`block` 拒绝重复且不刷新。合法 build 池生成后才进入动作轴搜索，非法或未闭合候选不评分。
- 三个指标统一使用 80 级标准 `310054 雷冠牦`，并各自输出 Top-N：无韧循环 DPS、有韧循环 DPS、最快击杀。循环轴可用同一版本化 preset 指定角色/奇波 SP、印记和来源允许的角色专属资源，但必须连续闭环；最快击杀的调谐印记固定为 0。
- 击杀轴可带入资源的通用理论定义是“可在非战斗状态持久保留且不会随时间过期”。M12-C v1 以产品范围主动收窄为角色/奇波 SP 与红宝石弹药两类，不继续搜索其他角色资源的客户端持久化证据；其他资源、状态、Buff、召唤物、冷却和 pending event 均固定为 0/未激活。具体初值由整次 run 的 preset 固定并进入 hash，不是候选优化维度。
- 本次只冻结计划，没有解锁正式搜索。五个待签角色、STARBORN 每种既有印记分别 `+1`、合击同帧先伤害后清空架势并进入 Break，以及 objective-scoped 初始状态 validator 全部关闭后，才能进入 M12-C。

### M12-B3-E22 绑定矩阵与正式准入（2026-08-11，已关闭）

- 角色-装配-奇波绑定矩阵全绿：`reports/m12/m12-b3-binding-matrix.json`（+ `.md`），生成器 `scripts/generate-m12-b3-binding-matrix.mjs`，门禁测试 `src/__tests__/optimization-qualification/m12BindingMatrix.test.js`，审计 `npm run audit:binding-matrix`。bindingMatrixHash=`86f1d0af5c870cb6`，22/22 检查全绿。
- 静态门禁：分母 9/43/62/137/12、blocking unique gap=0、`m12cLocked=false`、角色准入 9 个对象（含统一 STARBORN）、静态绑定矩阵全部合格、星临者两来源别名机制 hash 一致、roster/manifests/ledger/binding/catalog 产物 hash 与 summary 一致。
- 八类场景绑定（Machine Axis 严格合同实测）：装配→角色（合法 strict loadout prepare 通过；职业不匹配灵子、装备部位错配均拒绝）；角色→奇波继承（羁绊 1→10 改变 kibo 继承 ATK，角色等级 80→40 改变角色属性）；效果来源/目标（三 actor 场景效应事件携带 source/target）；前后台/切人（107001 switch-star-carry 可执行且双轮重放稳定）；同名奇波跨 owner 隔离（三槽共用 500001 时资源事件按 actor 隔离）；同帧顺序（107001 wind-expiry 双轮 canonical hash 一致）；保存重放（Workbench adapter 与 JSON carrier round-trip hash 一致）；连续循环（cycle-dps 信封 closed 且 cycle/trace hash 稳定）。
- 重锁反例：从合格 catalog 撤销任一对象（112001）后，formal admission 立即回到 `optimization-qualification-stage-locked`，stage gate 不再解锁。
- E22 关闭后进入 M12-C；M12-C 队伍/装配/三目标/初始状态规则按 2026-08-10 冻结合同执行，正式搜索仍待 M12-C 自身门禁放行。

### M12-C AI 引导搜索协议（2026-08-11）

- 搜索空间过大，内外层都不做纯枚举/纯自动搜索；实现保留 AI 介入接口与协议：`AzPrMachineAxisSearchGuidance`（输入）与 `AzPrMachineAxisSearchFeedback`（输出），代码在 `src/machine-axis/machineAxisSearchGuidance.js`。
- Guidance 覆盖预算（beamWidth/topN/maxDepth/每 owner 动作数/奇波动作/等待候选/伤害上界）、动作过滤（全局 kind/ID + perOwner）、奇波白/黑名单、切人/等待策略、启发式（critical/seeds）、pruning 预留与 provenance（必须 `ai-agent`）；归一化后生成 SHA-256 `guidanceHash`，任何字段变更即产生新哈希。
- 引擎集成：`machineAxisSearchEngine.search` 支持 `options.guidance`，结果 `summary.guidance` 回写 `guidanceHash + appliedRules`；生成器消费 `actionFilter`（按 guidance 过滤角色/奇波候选）。
- CLI：`node scripts/run-ai-guided-search.mjs --contract <json> [--guidance|--guidance-file <json>] [--options <json>] [--feedback-output <path>]`（npm：`search:ai-guided`），示例见 `work/m12-c/guidance.sample.json`、`work/m12-c/feedback.sample.json`。
- 外层（队伍/装配 build 池）尚未实现：feedback `outer.implemented=false`，外层字段只校验、不消费；M12-C1 实现时必须消费同一 guidance 合同。
- 通用 Agent skill：`skills/azpr-m12c-ai-guided-search/`（已同步安装到 `~/.codex/skills/azpr-m12c-ai-guided-search`），含 SKILL.md、`references/protocol.md` 与 examples；`quick_validate.py` 通过。

### M12-C 循环评分最终周期语义（2026-08-31）

- `AzPrMachineAxisCycleDps` 不再要求排轴者把 `[startFrame,endFrame)` 人工旋转到单圈 Buff/DoT/韧性完全相等的边界。固定输入自动按 4→8→12 圈扩展，识别并剔除 transient/warmup；合同可显式设置 `maxReplayCycles/maxPeriodCycles/minimumPeriodRepeats`，且预算必须覆盖最大周期的确认次数。
- 正式闭合拆为四层：相同输入始终可执行且 actual form 相同；SP/奇波能量/特殊资源不净亏；逐圈伤害与贡献进入最终周期；完整 score state 在同一周期复现。只有四层同时成立才输出 `status=closed/formalScore`，有限圈暂时可执行或仅数值看似稳定均不能晋升。
- `steadyCycle` 是稳定周期总量除以周期圈数后的正式每圈值；`observedCycles[]` 保留暖机与各周期相位。一次性 Buff 可存在于 transient，但不进入分数；周期 `2/3` 交替时每圈伤害为 `2.5`。伤害来源、元素、超限、能量利用率、印记消费/覆盖等诊断使用相同窗口，比例由周期总分子/总分母计算。
- 周期指标签名只比较 cycle-local semantic identity：同一 phase 的 replay/派生动作去除 `cycle-N:` 实例前缀，held/overlimit synthetic hit 的绝对时间转换为循环内相对帧；来源、相对帧、伤害、韧性与 break 结算仍必须一致。原始绝对 action/hit/time 继续保留在 `observedCycles[]`，不会因规范化丢失审计证据。
- 多圈 replay 发现旧两圈样例中的真实远期反例：一条末音星鸣→追击轴到第 7 圈出现 `skill-cooldown-active` 并连带普攻链失配，现正确 fail closed。一次性韩大招暖机用例则自动在后续稳定伤害周期闭合。
- 本项改变 tracked 生产评分语义和 cycle hash；旧 search authority、旧 cycle result 与查询库的 `cycle-boundary-runtime` source binding 均需在提交后失效并重新建立/审核。它不改变数据库内容，也不构成客户端实测或 `clientParityReady` 声明。
