# 蓝色星原三值运行时采集

本目录描述 `promilia-axis-tool` 的受控 runtime capture 产出链。当前仓库已经具备 hook 目标清单、JSON/JSONL 规范化、生产来源审计和 Workbench 导入；尚未取得可作为游戏证据的真实战斗 capture。

## 当前边界

- 不自动启动游戏。
- 不自动附加进程。
- 不绕过或关闭反作弊。
- fixture、synthetic、template、manual 来源只能验证工具，不能声明为真实游戏采样。
- 真实采样必须来自明确控制的客户端会话，并通过 production audit 与 Workbench adapter 双重校验。

## Hook manifest

生成命令：

```powershell
npm run data:generate-runtime-capture-manifest
```

默认读取：

```text
C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs
```

输出：

```text
src/data/generated/runtime-capture-hook-manifest.json
```

manifest 固定客户端来源 SHA-256、`GameAssembly.dll` RVA/VA、RecoverSP 修正属性读取、充能/削韧方法和字段偏移。客户端更新后必须重新生成，不能沿用旧 RVA。

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
    "hookManifestId": "azpr-tc-20260709-three-value-runtime-capture-v1"
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
recover-sp-args-built
recover-sp-modifier-property-read
recover-sp-ontransmit-12f
recover-sp-applied
recover-sp-share-rebroadcast
```

削韧采样必须包含 `toughness-damage-applied`，并满足 `toughnessBefore - toughnessAfter = toughnessDeltaApplied`。

## 规范化

```powershell
npm run runtime-capture:normalize -- --input C:\path\capture.jsonl --output C:\path\capture.normalized.json
```

要求生产来源时：

```powershell
npm run runtime-capture:normalize -- --input C:\path\capture.jsonl --require-production
```

production audit 要求：

- 非 fixture/synthetic/template/manual 的 runtime 来源。
- `clientRegion`、`clientBuild` 与采集工具元数据完整。
- hook manifest 标识存在。
- 所需事件序列完整，RecoverSP 事件保持调用先后顺序。
- 每个事件有帧或毫秒时间以及 DamageElement/PathID 来源。

规范化成功后可直接使用 Workbench 的“导入项目”入口导入 `.json`、`.jsonl` 或 `.ndjson`。

## 下一步

在获准的受控客户端会话中按 manifest 实施采集，生成第一份非 fixture JSONL。只有该文件通过 `--require-production`、P7-A adapter 和 Workbench 曲线/日志验证后，P7-C 才算完成。
