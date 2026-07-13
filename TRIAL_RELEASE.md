# M1 试用候选指南

本文档用于复现 `promilia-axis-tool` 当前 M1 候选基线，以及收集能直接定位到方案、轨道和准确帧的试用反馈。

## 启动

环境要求：Node.js 20 或更高版本，npm 10 或更高版本。

```powershell
npm ci
npm run test:trial-release
npm run preview -- --host 127.0.0.1 --port 4173
```

打开 `http://127.0.0.1:4173/#/workbench`。`test:trial-release` 会生成最新 `dist` 和 `reports/production-preview-acceptance.json`；只有全部必需能力通过时，报告才会记录 `decision.status = trial-ready`。

## 核心拓扑

- 3 个角色槽，每个角色有动作主轴、所属奇波子轴、角色能量轴和奇波能量轴。
- 1 个敌人组，包含敌人事件轴、HP 曲线和韧性曲线。
- 合计 7 条可编排轴和 8 条状态曲线；其中 3 条角色能量与 3 条奇波能量互不合并。
- 动作、命中/资源节点、曲线断点、日志和帧游标共用 60fps 时间坐标。

## 必试流程

### 1. 示例方案复盘

1. 从“示例方案 · 预览数据”打开 Workbench。
2. 确认 3 个角色、3 只奇波、敌人和 8 条曲线在同一时间轴上可辨识。
3. 点击命中或资源节点，确认帧游标、三值详情与源动作一致。
4. 修改动作开始帧，返回刷新后确认节点、曲线与日志同步移动。
5. 使用本地草稿、JSON、分享链接或 PNG 恢复方案。

### 2. 空方案从零编排

1. 新建方案，确认零动作且 8 条曲线均为全长初始平线。
2. 更换 3 个角色，分别绑定 1 只奇波，再选择敌人。
3. 从动作库拖入角色技能、角色资源动作、奇波动作和敌人事件。
4. 确认资源动作只改变所属角色能量，奇波能量和敌人 HP/韧性不串线。
5. 移动、复制或删除动作，确认节点和曲线同步；删除全部动作后应回到初始平线。
6. 保存并重载，再导出/导入 JSON，确认队伍、奇波、敌人、轨道和曲线恢复一致。

### 3. 六资源采样批次导入与回放

1. 准备 3 个角色 SP 会话和 3 个奇波 `PetUltimateCdTime` 观测会话；每份文件必须使用不同的 `captureSessionId`。
2. 使用同一条命令把六份 JSON/JSONL 按顺序打包：

```powershell
npm run runtime-capture:normalize -- `
  --input C:\path\role-1.jsonl `
  --input C:\path\role-2.jsonl `
  --input C:\path\role-3.jsonl `
  --input C:\path\kibo-1.jsonl `
  --input C:\path\kibo-2.jsonl `
  --input C:\path\kibo-3.jsonl `
  --output C:\path\six-resource-captures.json
```

3. 在 Workbench 配置与采样一致的 3 个角色、各自奇波和六个来源动作，再从“项目/更多”导入批次文件。
4. 确认状态显示“已导入实测 6 组”，六份 capture 分别绑定到正确角色或奇波 owner；任一 owner 漂移或动作歧义都应拒绝整批导入。
5. 导出项目 JSON，重置后回载，确认 3 条角色能量轴、3 条奇波能量轴及各自采样身份没有串线。

`test:trial-release` 会用确定性夹具自动执行“六文件打包 -> production preview 导入 -> 六 owner 绑定 -> JSON 回放”。仓库目前不内置非 fixture 游戏会话，因此该自动验收证明工作流与隔离合同，不证明已经取得真实战斗数值。

## 当前边界

- 技能、HP、韧性和角色能量只展示当前已绑定 `applied` 或明确标记为 preview 的结果，不代表测试期最终平衡数值。
- 奇波动作名称、图标和已确认时长可编排；未确认效果与奇波能量变化继续为 `tracking-only / unapplied`。
- 装备、奇波、灵子、防御、抗性、等级和培养效果中未确认的部分只保留配置与来源身份，不进入 calculator。
- 受控采样链尚未取得首份非 fixture 真实战斗 capture；仓库与 `C:\PC2\Codex\AzPr` 当前只有 hook manifest、采样工具和 fixture，没有可通过 `--require-production` 的六资源实战批次。
- 六资源 production preview 使用确定性夹具验证打包、owner 绑定和回放；只有已通过 applied source binding 的角色 SP 样本才能改变角色曲线，奇波就绪观测继续是 `tracking-only`，两者都不等同于最终游戏公式。
- 验收覆盖本地 Vite production preview，不覆盖远程 CDN、公网部署、缓存头或服务端可用性。

## 反馈清单

提交问题时请附带：

1. 浏览器、窗口尺寸与是否使用窄屏模式。
2. 从示例方案还是空方案开始。
3. 可复现的最短操作步骤，以及期望结果与实际结果。
4. 问题对应的动作、轨道、帧位和截图。
5. 可重现的 JSON 或带项目元数据的 PNG；如果导入会失败，同时保留原文件。
6. `reports/production-preview-acceptance.json` 中的 `generatedAt`、`decision` 和失败 capability。
