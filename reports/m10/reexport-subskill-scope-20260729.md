# 小玉 / 红宝石 SubSkill 重导出接入审计

结论：通过。上游重导出恢复了 65 个容器、1,377 个对象；当前问题域共有 1,487 个完整对象、0 个 stub，773/773 条外部 gameplay track 和 281/281 条 FileID=3 引用完整。目录摘要为 `b247d4f921799a8c6620556c4166e1ebe7fc83ea70e1cf54592c5402a1cfca05`。

## 修复口径

旧生成器按共享 Element PathID 聚合 behavior track，随后把这些 track 复制给同一 control 的全部 subskill。完整重导出让该问题同时影响红宝石其他技能与小玉重击形态，而不只是红宝石星鸣技。

现在 `behaviorTriggerScope=skill-player` 会先按 gameplay graph 的 `subSkillIndex` 过滤命中、运行时效果和语义效果；control 级共享只允许显式声明。owner 的默认策略由通用 production orchestrator 应用于全部 required controls，不在 UI 或运行时按角色 ID 特判。

## 结果

- 小玉：10/10 公开动作可运行，21 个执行形态、107 个 hit、121 条语义效果；117 条 authoritative golden 断言通过。
- 红宝石：10/10 公开动作可运行，24 个执行形态、124 个 hit、59 条语义效果；159 个原始窗口归一为 37/37 条 applied 语义转移，玩法缺口为 0；123 条 authoritative golden 断言通过。此前的 53/53 分母包含跨 subskill 重复边，现已纠正。
- 受影响的主要 control 为小玉 `10101010/10101042`，以及红宝石 `10300201/02/03/04/10/14/24/25/44/49`。去除的是跨 subskill 重复归属，不是删除真实命中。
- `10300253` 仅作为已重导出但当前 SkillList 不可达的容器保留，不进入运行时。
- verified profile 首次插入动作会等待真实机制包后再解析时长与形态；普通 preview profile 保留规划回退。

## 验证

聚焦数据测试 5 文件/46 用例、Workbench 107 用例、完整 Vitest 141 文件/873 用例以及 5 条受影响真实场景均通过；完整 production preview 为 62/62、必需能力 41/41。character/verified 漂移、生产引用、Workbench 数据、动作状态和 applied-source 守门均 clean，production build 通过。

包体仍是既有发布风险：Workbench gzip `370,771B`，总 JavaScript gzip `761,316B`；本阶段按范围只记录，不进行包体优化。
