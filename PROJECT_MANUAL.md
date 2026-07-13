# promilia-axis-tool 项目手册

最后更新：2026-07-14

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

当前项目已经形成可供本地用户试用的 Workbench production demo；真实公式覆盖、首份真实战斗采样和远程部署仍未完成，不能视为最终版本。

已完成的主线能力：

- 根路径、旧编辑器路径和预设路径统一进入真实 Workbench。
- 真实 AzPr 生成数据、版本化项目模型和无 UI 模拟运行时。
- 60fps 的 3 角色主轴、3 奇波子轴和敌人轴，以及动作属性编辑、批次操作、撤销重做和草稿恢复。
- 队伍、敌人、装备、奇波、灵子和初始资源配置，以及按方案绑定的可复用配置实例。
- `Action -> Hit -> ThreeValueDelta` 生成合同、统一可注册 mechanics adapter，以及 HP、韧性、3 条角色能量和 3 条奇波能量曲线、日志、详情和贡献分析。奇波能量当前仍为 `tracking-only / unapplied`。
- 冷却/执行计划、效果命令和运行时复盘联动。
- JSON、PNG 元数据、分享链接、runtime capture 和本地预设轴库。
- 受控 runtime capture manifest、规范化、production audit 和显式 PID host。
- 动作关系、效果区间、方案 A/B 对比，以及按 60fps 循环边界切分的区间统计与动作回定位。

当前验证基线：

- `npm run test:trial-release`：候选发布完整守门一次通过。
- `npm run test -- --run`：85 个测试文件、476 条测试通过。
- `npm run test:e2e:production-preview`：40/40 项必需能力通过，报告结论为 `trial-ready`。
- 生产引用、生产数据、applied source 和包体审计通过；总 JavaScript 为 739,969B gzip，低于 740,000B 发布硬门槛。

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

### M2 三人队配置可用性收口（2026-07-14）

Workbench 现在可在时间轴主流程中配置 3 个唯一角色、每人绑定的奇波、5 件装备、灵子与敌人，并展示本地 AzPr 数据源提供的真实名称、图标和静态属性摘要。培养详情由独立 JSON 目录按需加载，不进入首屏主包；装备、奇波、灵子效果、属性叠加和战斗公式继续保持 `unapplied`。默认示例和空方案都已实测“配置三人及培养项 -> 回到时间轴拖入动作 -> 保存并恢复”，动作库、轨道身份、3 条角色能量轴、3 条奇波能量轴和敌人双曲线保持一致，项目复制、本地草稿、JSON、分享链接和 PNG 回放恢复同一配置。

阶段验收为 92 个测试文件、504 条测试和 41/41 项 production preview 全部通过，acceptance 为 `trial-ready`；生产引用、Workbench 数据、applied source 与 `git diff --check` 均通过。Workbench 主块为 334,380B gzip，总 JavaScript 为 739,967B gzip，低于 370,000B/740,000B 硬门槛但仅余 33B；桌面与窄屏验收图分别为 `reports/m2-team-configuration-desktop.png`（1440x900）和 `reports/m2-team-configuration-narrow.png`（390x900）。M2 至此停止，等待用户验收；P3 非 fixture 真实采样继续暂停。

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
