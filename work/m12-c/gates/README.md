# M12-C Gate Ledger

本目录存放 `test:smart` 与 `release:verify` 的派生执行证据。运行时会创建：

- `gate-ledger.json`：机器可读 PASS / FAIL / timeout / interrupted / reused 记录；
- `.gate-ledger.lock`：带 PID、主机名和开始时间的短期并发锁；
- `pending/`：进程崩溃后可恢复为 `interrupted` 的运行中记录；
- `logs/`：真实命令输出；
- `latest-smart-gate.json`、`latest-release-verify.json`：最近一次机器报告。

这些文件被 `.gitignore` 排除，因为它们是 cache / derived evidence，不是 authority source。不得手工修改 ledger 制造 PASS；只有真实命令退出码为 0 时，runner 才能写入 `mode=executed,status=pass`。最终发布永远必须重新执行 `npm run release:verify`，不能由 ledger 拼装。

`repository-hygiene` 对 authored source、test、recipe 与配置执行 changed-file ESLint / Prettier，并始终执行 `git diff --check`。`reports/**` 与 `src/data/generated/**` 属于 generator-owned exact-byte 输出，不交给通用 Prettier 重新序列化；它们仍由对应 generator 的 `--assert-clean`、语义审计、测试、build 与 `git diff --check` fail closed，跳过文件名和数量会写入门禁结果。

`formal-search-admission` 会校验版本化 `m12c-kibo-axis-action-scope-v1`。当前产品范围把奇波普攻/主动技的 71 个 autonomous surface 延后并从排轴、优化和评分中排除，只保留特性技、合击与已验证被动；准入绑定 qualification catalog、Kibo action catalog、scheduler、search generator 与 scope policy hash，并核验 43 只 admitted Kibo 的完整分类。它证明的是“范围已应用”，不是自主 AI/cadence 已实现；hash、分母、覆盖或保留动作面任一漂移时，release 结果与 Formal Search 状态仍分开报告。
