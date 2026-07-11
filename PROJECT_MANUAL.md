# promilia-axis-tool 项目手册

最后更新：2026-07-11

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
- 60fps 多角色动作轴、动作属性编辑、批次操作、撤销重做和草稿恢复。
- 队伍、敌人、装备、奇波、灵子和初始资源配置，以及按方案绑定的可复用配置实例。
- `Action -> Hit -> ThreeValueDelta` 生成合同，以及 HP、韧性、每角色能量曲线、日志、详情和贡献分析。
- 冷却/执行计划、效果命令和运行时复盘联动。
- JSON、PNG 元数据、分享链接、runtime capture 和本地预设轴库。
- 受控 runtime capture manifest、规范化、production audit 和显式 PID host。
- 动作关系、效果区间、方案 A/B 对比，以及按 60fps 循环边界切分的区间统计与动作回定位。

当前验证基线：

- `npm run build`：通过。
- `npm run test -- --run`：通过；69 个测试文件、395 条测试通过。
- `npm run test:e2e:workbench-flow`：通过；39 条 Workbench 浏览器主流程通过。
- `npm run test:e2e:production-preview`：通过；15 项真实 `dist` 验收全部通过，报告结论为 `trial-ready`。

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
- `src/domain/workbenchDraftStorage.js`：v13 草稿、项目 JSON 和分享合同。
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

## 10. 文档维护规则

- `AGENTS.md` 记录协作规则、约束和对后续 Codex 的提醒。
- `PROJECT_MANUAL.md` 记录阶段进度、已知问题和路线图。
- `ARCHITECTURE.md` 保留架构说明，可在架构实质变化后更新。
- `DATA_STRUCTURE_CHANGES.md` 记录数据字段变化和迁移策略。
- `TIMELINE_FEATURES.md` 记录时间轴功能细节。

每完成一个阶段或改变核心数据模型，都应更新本手册。

详细任务拆解、里程碑和验收标准维护在 `DEVELOPMENT_PLAN.md`。
