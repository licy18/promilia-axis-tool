# M12-C Gate Ledger

本目录存放 `test:smart` 与 `release:verify` 的派生执行证据。运行时会创建：

- `gate-ledger.json`：机器可读 PASS / FAIL / timeout / interrupted / reused 记录；
- `.gate-ledger.lock`：带 PID、主机名和开始时间的短期并发锁；
- `pending/`：进程崩溃后可恢复为 `interrupted` 的运行中记录；
- `logs/`：真实命令输出；
- `latest-smart-gate.json`、`latest-release-verify.json`：最近一次机器报告。

这些文件被 `.gitignore` 排除，因为它们是 cache / derived evidence，不是 authority source。不得手工修改 ledger 制造 PASS；只有真实命令退出码为 0 时，runner 才能写入 `mode=executed,status=pass`。最终发布永远必须重新执行 `npm run release:verify`，不能由 ledger 拼装。

`formal-search-admission` 还会查找 `reports/m12/m12-c-kibo-autonomous-readiness.json`。该文件不是 cache，而是未来闭合 Kibo autonomous schedule/trigger 后应生成的 authority proof；它必须绑定当前 qualification catalog、Kibo action catalog、scheduler source、43 只 admitted Kibo 和全部 autonomous surface，并声明 unresolved schedule/trigger 均为 0。文件缺失、JSON 损坏、hash/分母/覆盖不一致或仍有 unresolved 时，最终 release 结果与 Formal Search 状态会分开报告：release 可 PASS，Formal Search 必须 `BLOCKED`。
