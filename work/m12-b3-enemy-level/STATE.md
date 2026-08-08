# M12-B3 敌人等级数值闭环状态

## 目标

- 只在 `feature/m12-b3-enemy-level` / 本工作树完成敌人等级属性证据审计与 fail-closed 闭环。
- 严格区分等级属性成长与伤害公式 `targetLevel`。
- 不进入 M12-C 正式搜索，不修改末音/米蒂机制，不合并主线。

## 完成标准

- 上游 NewTable / Lua / `dump.cs` / GameAssembly 证据链有可复查结论。
- 来源足够则统一生成并消费等级属性 profile；不足则不造公式，并修正原始模板值冒充最终面板的 UI/协议。
- 聚焦测试、核心测试、build、diff/audit 通过；单一高内聚提交；工作树 clean。

## 当前状态

- 2026-08-08：工作树初始 clean；分支 `feature/m12-b3-enemy-level`；HEAD/基线均为 `8ced55eb0135b1edf3fd014bdaf4a2f0b03c79cf`。
- 已确认项目规则：表/字段签名属于结构证据，不能自行升级为运行时语义。
- 客户端运行时构造链已闭合，来源足够实现；未采用导论中的未证实公式。
- 已生成公共 `enemy-level-profiles.json`，compile/headless/Workbench 共用纯解析器。
- Lv111、缺默认 enemy pack、缺 profile 均 fail-closed，不外推。
- 聚焦数值/默认切片/Workbench 工厂 57 项通过；canonical/Machine Axis/草稿 round-trip 53 项通过；cycle 33 项通过；Workbench 110 项已完成接受值同步。
- production build、Machine Axis CLI build 通过；production import、Workbench data、action status、applied source binding 审计 clean。
- 完整 `audit:verified-combat` 已运行到角色 golden：101003 旧期望 HP 伤害 78149，新等级链实际 160349；按隔离要求不修改角色机制/golden，留作上游统一重基线边界。
- bundle 基线原已超预算；本阶段实测 Workbench gzip 533194→564225，总 JS gzip 1064031→1095318，不抬预算。

## 已知反例

- 默认 `enemyId=300032` 迅狼：原始 `unit_property/template_value` 为 `MAXHP=8628`、`DEF=9000`、`MDEF=9000`；Workbench 默认却显示 `Lv.80`。
- 当前 compile 直接投影原始 `baseAttributes`；verified runtime 只在其后乘最终倍率，因此 `Lv.80` 标签不能证明面板已完成 Lv.80 成长。
- 修正后 Lv80 基线：`ATK=14970.4044`、`MAXHP=86778.6984`、`DEF/MDEF=810`、`WEAKNESS_POINT_MAX=26822.0077`；原始值只保留为可审计模板因子。

## 已确认运行时链

1. `EntityLevelUtility.GetLevel` 根据 WorldDifficult/Fix/Dungeon/Task 选出 `CreateMonsterData.lv`。
2. `DataPropertyUtility.InitMonsterData`（RVA `0x16B6880`）读取默认/所属 `TDEnemyPack`；`templateID>0` 时用它，否则退回 `TDEnemy.enemyType`。
3. 等级模板值 ID 为 `(3000 + selector) * 1000 + level`。
4. `FormulaUtility.CalculateAttribute`（RVA `0x187C460`）：基础模板乘等级模板；属性 1/3/4/5/201/229 除 10000，其余除 1。
5. `injectAttrs` 随后覆盖，`attScale/10000` 最后缩放；Workbench 未配置场景缩放，因此明确标为未应用。
6. 伤害公式仍独立读取 `scenario.enemy.level` 为 `targetLevel`。

## 下一步

1. 产品已接受基线 `d1587a8800b23bd848e267ae0baf219ab92fc96a`；完成本次文档 closeout 后停止。
2. 不合并主 B3，不进入 M12-C，不修改敌人等级 runtime/compiler；等待上游独立安排角色 golden 重基线。

## R1 产品复验纠偏（2026-08-08）

- 已复现指定用例 `1 failed / 13 skipped`。
- 原断言为 `expect(integratedBaseline...).toEqual(run.hashes)`；Vitest 的 Expected 来自参数 `run.hashes`，Received 来自 `integratedBaseline`。因此复验文字中的两组身份恰好反向。
- 第一次有限 HP 实跑为 `3cf2c705a5c85929 / 73456783a3dd342d / 3b25577991f6cf3e / 0b59fbf00bcbb53e`，但它在迅狼前四段合计 690 后死亡截断；把 A3 expected 改为 0 的未提交方案已撤回。
- M11 fixture 已补冻结 target policy（无限 HP、禁韧性、禁击破、禁死亡截断），保持 `level=1 / hpMultiplier=1 / maxHp=690.24`、0 距离投射物和无敌方动作。
- service 与强制重建 CLI 最终一致：`74466fb0f55b90c9 / 73456783a3dd342d / b6d899957b7dc240 / 6b1817db45d140ab`；总伤害 `27762.79998779297`，A3 expected 为 `72 / 108 / 73.79998779296875`，6890F 末段仍有 765 伤害。
- R1 门禁改为 `expect(run.hashes).toEqual(integratedBaseline...)`，不删除 hash 断言；另断言 target policy、真实 maxHp、`defeated=false`、迅狼/A3 expected/小玉/红宝石及后段伤害均非零。
- Machine Axis integrated baseline 属 R1 闭合范围；character verified-combat golden（101003：`78149` vs `160349`）继续保留为上游边界。
- 最终聚焦：exact `1/1`（13 skipped）；敌人/Workbench `6 files / 165 tests`；canonical/cycle/adapter/round-trip `7 files / 64 tests`。
- 默认并发 Machine Axis 目录：13 文件/163 项，153 passed、8 因 hook timeout skipped、2 process timeout；数值断言失败 0。单跑 search state `8/8`、CLI process `9/9`、CLI search `1/1`（31 skipped）均通过；按产品调整不再重跑整目录。
- production imports、Workbench data、action status、applied source bindings 四审计 clean；production/CLI build 与 diff check 通过。
- R1 已提交为 `d1587a8800b23bd848e267ae0baf219ab92fc96a`，并在 clean final commit 上生成、验证 M11 外部审计包。

## 产品接受 closeout（2026-08-08）

- 状态：`product-accepted`；接受基线 `d1587a8800b23bd848e267ae0baf219ab92fc96a`。
- 独立复验：工作树 clean，`2d609365..d1587a88` diff check clean；精确 Machine Axis 反例 `1/1 passed`、`13 skipped`、`7.53s`。
- 有限敌人面板栏：迅狼 `300032`、`Lv1`、真实 `maxHp=690.24`、`hpMultiplier=1`；该值继续作为面板、百分比与显示分母。
- 试点执行政策栏：`hpMode=infinite`、`toughnessMode=disabled`、`breakMode=disabled`、`deathTruncation=disabled`；只控制试点结算，不覆盖或放大真实 `maxHp`。
- closeout 仅更新报告、STATE 与手册；runtime/compiler 零改动，不合并主 B3，停在产品复验点。
