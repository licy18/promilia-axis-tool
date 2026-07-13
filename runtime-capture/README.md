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
  --action-id action-0001 `
  --actor-id actor-109001 `
  --target-id enemy-300032 `
  --slot-id team-slot-1 `
  --kibo-id 500001 `
  --duration 30 `
  --confirm-controlled-session
```

采集端不会寻找、启动或修改客户端，也没有反作弊绕过参数。它在附加后先读取进程内 `GameAssembly.dll` 路径并核对 manifest 的文件大小和 SHA-256；不一致时不会安装 hook。`--duration 0` 表示由操作者按 Ctrl+C 结束，输出每条事件后立即刷新到磁盘。

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

要求生产来源时：

```powershell
npm run runtime-capture:normalize -- --input C:\path\capture.jsonl --require-production
```

production audit 要求：

- 非 fixture/synthetic/template/manual/self-test 的 runtime 来源。
- `clientRegion`、`clientBuild` 与采集工具元数据完整。
- hook manifest 标识存在。
- 所需事件序列完整，RecoverSP 事件保持调用先后顺序。
- 每个事件有帧或毫秒时间以及 DamageElement/PathID 来源。

规范化成功后可直接使用 Workbench 的“导入项目”入口导入 `.json`、`.jsonl` 或 `.ndjson`。

## 下一步

在获准的受控客户端会话中按 manifest 实施采集，生成第一份包含角色 SP、奇波就绪或韧性的非 fixture JSONL。只有该文件通过 `--require-production`、所有者核对和 Workbench 曲线/日志验证后，生产采样闭环才算完成。
