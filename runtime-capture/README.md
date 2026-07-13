# 蓝色星原三值运行时采集

本目录描述 `promilia-axis-tool` 的受控 runtime capture 产出链。当前仓库已经具备 hook 目标清单、显式 Frida 采集端、JSON/JSONL 规范化、生产来源审计和 Workbench 导入；尚未取得可作为游戏证据的真实战斗 capture。

## 当前边界

- 不自动启动游戏。
- 未传入 PID 和 `--confirm-controlled-session` 时拒绝附加；只允许人工确认的受控会话。
- 不绕过或关闭反作弊。
- fixture、synthetic、template、manual、self-test 来源只能验证工具，不能声明为真实游戏采样。
- 真实采样必须来自明确控制的客户端会话，并通过 production audit 与 Workbench adapter 双重校验。

## Hook manifest

生成命令：

```powershell
npm run data:generate-runtime-capture-manifest
```

默认读取：

```text
C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs
C:/AP/AzurPromilia_TC/AzurPromilia_game/GameAssembly.dll
```

输出：

```text
src/data/generated/runtime-capture-hook-manifest.json
```

manifest 同时固定 `dump.cs` 与 `GameAssembly.dll` SHA-256、RVA/VA、BaseElement 来源身份字段、RecoverSP 修正属性读取、SP/韧性前后状态和充能/削韧方法。采集端会在安装 hook 前核对进程内模块文件哈希；客户端更新后必须重新生成，不能沿用旧 RVA。

## 受控采集端

先在本地测试进程验证 Frida transport，不接触游戏：

```powershell
npm run runtime-capture:self-test -- --output C:\path\frida-self-test.jsonl
```

真实会话必须由操作者先启动获准的客户端，再显式提供 PID 和当前 Workbench 动作绑定：

```powershell
npm run runtime-capture:capture -- `
  --pid 12345 `
  --output C:\path\azpr-runtime.jsonl `
  --capture-kind role-sp `
  --action-id action-0001 `
  --actor-id actor-109001 `
  --target-id enemy-300032 `
  --duration 30 `
  --confirm-controlled-session
```

奇波就绪应单独采集，避免同一会话混入角色 SP 或削韧事件：

```powershell
npm run runtime-capture:capture -- `
  --pid 12345 `
  --output C:\path\azpr-kibo-1.jsonl `
  --capture-kind kibo-energy `
  --action-id kibo-action-1 `
  --actor-id actor-109001 `
  --target-id enemy-300032 `
  --slot-id team-slot-1 `
  --kibo-id 500001 `
  --duration 30 `
  --confirm-controlled-session
```

采集端不会寻找、启动或修改客户端，也没有反作弊绕过参数。它在附加后先读取进程内 `GameAssembly.dll` 路径并核对 manifest 的文件大小和 SHA-256；不一致时不会安装 hook。`--duration 0` 表示由操作者按 Ctrl+C 结束，输出每条事件后立即刷新到磁盘。

`--capture-kind` 可选 `role-sp / kibo-energy / toughness / all`，默认 `all` 只用于旧流程兼容。六资源正式采样应为每个角色或奇波分别选择单一范围；`kibo-energy` 强制要求 `--slot-id` 与正整数 `--kibo-id`，`role-sp` 和 `toughness` 会拒绝奇波参数。这样每份会话只有一个预期资源类型，避免无关战斗事件改变动作绑定语义。

## 六资源采样计划与预检

优先从已配置好的 Workbench 项目 JSON 生成计划，避免重复填写敌人、角色和奇波身份。项目中每个槽位需要至少一个角色技能（没有技能时可使用资源动作）和一个所属奇波动作：

```powershell
npm run runtime-capture:plan -- `
  --from-project C:\path\team.promilia-workbench.json `
  --write-plan C:\path\six-resource-plan.json `
  --capture-directory C:\path\captures `
  --plan-id controlled-team-001 `
  --pid 12345
```

生成器从项目 v1-v16 直接锁定三个 `teamSlots`、对应 `actorConfigs[].loadout.kiboId`、敌人和动作 owner。若同槽存在多个角色技能或多个奇波动作，生成器不会按顺序猜测，而会列出候选；使用可重复的显式覆盖后再生成：

```powershell
  --role-action 'team-slot-1=action-role-1' `
  --kibo-action 'team-slot-1=action-kibo-1'
```

生成文件的 `projectBinding` 保留项目类型、schema、保存时间以及选中的 3 个角色、3 只奇波和敌人身份。缺少奇波、重复角色/奇波、动作 owner 不兼容或项目 schema 超出当前支持范围时不会写出计划。`--write-plan` 不覆盖已有文件，重新生成前必须显式选择新的输出路径或人工处理旧计划。

没有项目 JSON 时，也可以复制 `runtime-capture/six-resource-plan.example.json`，把 `template` 改为 `false`，并按当前 Workbench 方案填写敌人、三个槽位的角色/奇波、来源动作和输出目录。计划必须同时包含：

- `team-slot-1/2/3` 各一份 `role-sp`；
- 同三个槽位各一份 `kibo-energy`；
- 同槽角色与奇波会话使用相同 `actorId`；
- 六个会话 ID、动作 ID、输出文件唯一，三个 `kiboId` 唯一。

客户端未启动时也可以离线预检并生成六条独立采集命令：

```powershell
npm run runtime-capture:plan -- `
  --plan C:\path\six-resource-plan.json `
  --pid 12345
```

工具不会启动客户端、附加进程或执行这些命令。输出中的 `commands[]` 只包含尚未完成的会话；操作者仍需逐条明确执行。已有输出会被解析并通过 production audit、会话身份和 owner binding 核对：错误文件会令计划进入 `six-resource-capture-plan-invalid`，不会被覆盖或静默跳过。

六份文件全部通过后，可用同一计划完成带 `--require-production` 的批次规范化：

```powershell
npm run runtime-capture:plan -- `
  --plan C:\path\six-resource-plan.json `
  --normalize `
  --output C:\path\six-resource-captures.json
```

示例文件带有 `template: true`，只能查看拓扑，不会生成可执行采集命令；必须复制并替换所有 `replace-*` 身份后才能用于真实受控会话。

当前 agent 覆盖：

- `DamageElement.RecoverSP` 与 BaseElement 来源身份。
- `SPGETUP(105)` / `SPGETUP_ATK(228)` 的 MyFloat 返回值。
- `RecoverSPArgs` 构造值、`OnTransmit(0x12F)`、`SPSystem.RecoverSP`。
- `AliveProperty.SetSp` 的 `spBefore/spAfter`。
- 可选的 `PetEntity.PetUltimateCdTime` 观测；只有同时传入 `--slot-id` 与 `--kibo-id` 时安装，并通过 `PetEntity.data -> BaseData.configId/entityId` 核对实际奇波实体后记录 `cdTime/totalTime/ready`。
- `FormulaUtility.WeaknessPointChange` 与 `AliveProperty.SetWeaknessPoint` 的韧性前后值。

`RecoverSPArgs.petDelta` 仍只作为 SP 分享链的来源/诊断字段，不能直接等同于奇波终极技就绪进度。奇波曲线只消费 `pet-ultimate-cooldown-observed`，并要求 `slotId / actorId / kiboId / petEntityId` 与当前项目拓扑完全一致；不提供奇波参数时，现有角色 SP/韧性采集行为不变。

## JSONL 会话

第一行为会话元数据：

```json
{
  "recordType": "capture-session",
  "captureSessionId": "controlled-session-001",
  "clientRegion": "TW",
  "clientBuild": "build-id",
  "source": "source-game-runtime",
  "captureKind": "kibo-energy",
  "binding": {
    "actionId": "kibo-action-1",
    "actorId": "actor-109001",
    "targetId": "enemy-300032",
    "slotId": "team-slot-1",
    "kiboId": 500001,
    "sourceElementConfigId": null
  },
  "captureTool": {
    "name": "controlled-il2cpp-capture",
    "version": "1.0.0",
    "hookManifestId": "azpr-tc-20260709-three-value-runtime-capture-v2"
  }
}
```

后续每行一个事件：

```json
{
  "recordType": "event",
  "captureSessionId": "controlled-session-001",
  "eventType": "recover-sp-applied",
  "frameIndex": 120,
  "actionId": "source-action",
  "actorId": "source-actor",
  "sourceElementConfigId": 109001081,
  "spBefore": 0.25,
  "spAfter": 0.5875,
  "spDeltaApplied": 0.3375
}
```

同一会话的 RecoverSP 采样必须包含：

```text
recover-sp-modifier-property-read
recover-sp-args-built
recover-sp-ontransmit-12f
recover-sp-applied
recover-sp-share-rebroadcast
```

削韧采样必须包含 `toughness-damage-applied`，并满足 `toughnessBefore - toughnessAfter = toughnessDeltaApplied`。

奇波就绪采样必须包含 `pet-ultimate-cooldown-observed`，并同时记录实际 `petEntityId`、`petEntityPointer`、`kiboId`、`slotId`、`actorId`、`cdTime` 与 `totalTime`。运行时以 `totalTime - clamp(cdTime, 0, totalTime)` 作为同轴就绪展示值；这只是对已观测冷却的显示变换，不进入 calculator，也不推断未观测区间。

## 规范化

```powershell
npm run runtime-capture:normalize -- --input C:\path\capture.jsonl --output C:\path\capture.normalized.json
```

可重复传入 `--input`，把三个角色与三个奇波的独立会话打包为一次可导入的批次文件：

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

批次按输入顺序保留 capture；跨文件出现重复 `captureSessionId` 时会拒绝生成，避免静默覆盖。`--require-production` 会对批次内全部 capture 一起守门。

要求生产来源时：

```powershell
npm run runtime-capture:normalize -- --input C:\path\capture.jsonl --require-production
```

production audit 要求：

- 非 fixture/synthetic/template/manual/self-test 的 runtime 来源。
- `clientRegion`、`clientBuild` 与采集工具元数据完整。
- hook manifest 标识存在。
- `captureKind` 必须是单一的 `role-sp / kibo-energy / toughness`，不能使用旧 `all` 声明生产证据。
- 会话 `binding` 必须包含动作、角色和目标；奇波会话还必须包含槽位与奇波 ID。
- 实际事件族必须与 `captureKind` 一致，混入其他资源事件会拒绝整份会话。
- 所需事件序列完整，RecoverSP 事件保持调用先后顺序。
- 每个事件有帧或毫秒时间以及 DamageElement/PathID 来源。

规范化成功后可直接使用 Workbench 的“导入项目”入口导入 `.json`、`.jsonl` 或 `.ndjson`。

## 下一步

在获准的受控客户端会话中按单一 `captureKind` 实施采集，生成第一份角色 SP 和第一份奇波就绪非 fixture JSONL。只有文件分别通过 `--require-production`、所有者核对和 Workbench 曲线/日志验证，再扩展为完整 3+3 批次后，生产采样闭环才算完成。
