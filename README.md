# 蓝色星原排轴工具

`promilia-axis-tool` 是面向《蓝色星原》的战斗排轴、模拟与复盘工具。项目以 Endaxis 的成熟架构和操作流程为参考，但游戏数据、动作命名和战斗机制均使用蓝色星原自己的模型。

当前生产入口是 Workbench。访问站点根路径、旧 `/editor` 路径或未知旧路径都会进入 `/#/workbench`；旧 `/preset` 路径会直接打开 Workbench 内的真实预设轴库。

## 当前能力

- 真实 AzPr 数据生成管线：角色、技能、敌人、属性、装备、奇波和灵子数据进入 `src/data/generated/`，Workbench 使用可追溯的 v2 生产投影。
- 60fps 时间轴：动作起始、持续时间、命中候选和状态曲线统一以 1 帧为最小颗粒度。
- Workbench 编辑闭环：动作库、角色/敌人轨、框选与多选、动作前后关系、状态效果区间、批次操作、撤销重做、草稿恢复和规则诊断。
- 配置闭环：双角色、敌人、等级、属性覆盖、装备、奇波、灵子和初始角色资源可保存为命名配置实例；每条工作区方案明确选择实际参与模拟的实例。
- 机制配置来源：当前方案所选配置会编译为标准 mechanics configuration，并随每条三值 delta 进入 generation calculator 与 runtime adapter；未确认培养效果保持不可应用。
- 三值运行时：每个动作追踪敌人 HP、敌人韧性和每名角色自身能量，输出曲线、日志、状态快照和统计摘要。
- 规则与效果：冷却、执行计划、效果命令和运行时复盘共享同一模拟结果。
- 项目交换：版本化 JSON、带项目元数据的 PNG、窗口拖放恢复、分享链接和本地预设轴库。
- 受控采样工具链：runtime capture manifest、JSONL 规范化、production audit 和显式 PID Frida host。

## 精度边界

蓝色星原仍处于测试阶段。项目会区分已应用结果、候选数据、实测采样和待确认占位；没有来源或真实运行时证据的数值不会被冒充为最终公式。

当前受控采样工具链已经通过仓库自检，但尚未取得首份非 fixture 真实战斗 capture。真实游戏采集必须由操作者明确启动获准客户端并确认受控会话；工具不会自动启动游戏或绕过反作弊。

## 本地运行

环境要求：Node.js 20 或更高版本，npm 10 或更高版本。

```powershell
npm install
npm run dev
```

Vite 启动后打开终端显示的本地地址，根路径会直接进入 Workbench。

生产构建：

```powershell
npm run build
npm run preview
```

## 验证

```powershell
npm run test -- --run
npm run build
npm run test:e2e:workbench-flow
npm run audit:production-imports:check
npm run audit:bundle:check
npm run audit:workbench-data:check
npm run benchmark:long-axis:check
npm run benchmark:long-axis:browser
npm run test:e2e:production-preview
git diff --check
```

运行时采集端自检：

```powershell
npm run runtime-capture:self-test
```

## 数据更新

生成器默认从本机 AzPr 数据工作区读取来源文件：

```text
C:\PC2\Codex\AzPr
```

重新生成提交到仓库的访问层数据：

```powershell
npm run data:generate
```

生成结果和来源审计位于 `src/data/generated/manifest.json` 与 `src/data/generated/validation-report.json`。不要手工维护生成文件中可由来源表重新产生的字段。

`src/data/generated/workbench-seed.json` 是面向生产主流程的精简目录，保留全部可选择实体及模拟所需字段；完整原始目录继续由 `src/data/azprGenerated.js` 提供给审计和数据测试。

`src/data/generated/workbench-skill-core.json` 是首轮模拟使用的技能逻辑、等级校验和 valueParam 合同；`workbench-skill-diagnostics.json` 保存 Skill Control、DamageElement 和外部对象等候选证据，只在打开运行复盘或恢复实测采样时加载。`reports/workbench-production-data-audit.json` 会从完整生成表重新计算目录、核心和诊断投影并验证逐字段一致性。

## 核心目录

```text
src/
  data/                  AzPr 生成数据与访问层
  domain/                项目、动作、草稿、预设和采样合同
  simulation/
    compiler/            Project -> Scenario
    engine/              Scenario -> 事件与执行计划
    generation/          Action -> Hit -> ThreeValueDelta
    mechanics/           可替换的蓝原机制 adapter
    runtime/             三值状态、曲线、日志与摘要
    projection/          面向 UI 的模拟结果投影
  features/workbench/    Workbench 功能组件和交互控制器
  views/Workbench.vue    唯一生产排轴工作台
scripts/                 数据生成、采样与规范化工具
runtime-capture/         受控 Frida agent
e2e/                     Workbench 浏览器主流程
```

生产引用审计从 `src/main.js` 和全部测试入口追踪 JS、TS、Vue SFC 的静态/动态 import。当前只保留生产可达模块，以及明确允许的领域/runtime fixture 与无 UI simulation API；旧 editor/timeline 组件、旧 project/history/setting store 和旧计算工具已经删除。

构建组成审计会生成 `reports/bundle-composition.json`，并守住首屏入口、Workbench 主包和全部 JavaScript 的 gzip 预算，同时检查技能诊断数据必须位于独立按需包。Element Plus 组件由各页面按需引用，PNG 截图库只在实际导出时加载。

`npm run test:e2e:production-preview` 会重新构建 `dist`，用独立端口启动 Vite production preview，并检查路由与哈希资源、诊断动态包、JSON/PNG 项目交换、拖放恢复、配置实例、多动作与关系编辑、状态效果区间复盘和 390px 窄屏主流程。最终十五项能力的试用判定写入 `reports/production-preview-acceptance.json`。

三值运行时统一通过 `AzPrThreeValueMechanicsAdapter v4` 调用 HP、韧性和角色能量 adapter；compiler 为 Scenario 绑定 `AzPrMechanicsProfile v1`，generation 以 `AzPrThreeValueMechanicsOperands v1` 和 `AzPrThreeValueMechanicsLayerInputs v1` 固定操作数、角色面板、动作倍率、敌人防御/元素防御、初始能量和培养配置来源，runtime 再绑定该次调用的 `stateBefore`。内置 profile 保持现有结果，`simulateScenario()` 仍可注入替换注册表。

## 项目文档

- `AGENTS.md`：长期协作规则和架构边界。
- `PROJECT_MANUAL.md`：当前能力、阶段进度和下一阶段目标。
- `DEVELOPMENT_PLAN.md`：对标 Endaxis 的完整目标和验收标准。
- `ARCHITECTURE.md`：当前生产架构和数据流。
- `DATA_STRUCTURE_CHANGES.md`：版本化结构与迁移记录。
- `TIMELINE_FEATURES.md`：时间轴能力和交互约定。

## 许可

项目使用 MIT License。游戏数据与资源的使用应遵循相应授权和项目约定。
