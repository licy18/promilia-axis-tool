import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const envelope = JSON.parse(
  await readFile(
    resolve(root, 'fixtures/machine-axis/m12-search-example.json'),
    'utf8'
  )
);
const mechanicsPackage = JSON.parse(
  await readFile(
    resolve(root, 'src/data/generated/verified-combat-mechanics-package.json'),
    'utf8'
  )
);
const variants = process.env.M12_SEARCH_VARIANTS?.split(',')
  .map(variant => variant.trim())
  .filter(Boolean) ?? ['beam2-depth2', 'beam3-depth2'];

const vite = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const { installVerifiedCombatMechanicsPackage } = await vite.ssrLoadModule(
    '/src/data/verifiedCombatMechanicsPackage.js'
  );
  const { createMachineAxisService } = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisService.js'
  );
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = createMachineAxisService();
  const results = [];
  for (const variant of variants) {
    const [beamWidth, maxDepth] = variant
      .match(/beam(\d+)-depth(\d+)/)
      ?.slice(1, 3)
      .map(Number) ?? [2, 2];
    global.gc?.();
    const wallStart = performance.now();
    const cpuStart = process.cpuUsage();
    const heapStart = process.memoryUsage().heapUsed;
    const report = await service.search(
      {
        contract: structuredClone(envelope.contract),
        options: {
          ...(envelope.options ?? {}),
          beamWidth,
          topN: 3,
          maxDepth,
        },
      },
      {}
    );
    const wallMs = performance.now() - wallStart;
    const cpu = process.cpuUsage(cpuStart);
    const heapDeltaBytes = process.memoryUsage().heapUsed - heapStart;
    results.push({
      variant,
      beamWidth,
      maxDepth,
      wallMs: Math.round(wallMs * 100) / 100,
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      heapDeltaMiB: Math.round((heapDeltaBytes / 1048576) * 100) / 100,
      summary: report.summary,
      topScores: report.results.map(result => ({
        rank: result.rank,
        score: result.score,
        actions: result.axis.actions.length,
        traceHash: result.hashes.trace,
      })),
    });
    process.stderr.write(
      `${variant}: wall=${results[results.length - 1].wallMs}ms candidates=${report.summary.candidatesEvaluated} invalid=${report.summary.invalidCandidates} merged=${report.summary.mergedCandidates} pruned=${report.summary.prunedCandidates}\n`
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = resolve(root, 'reports', 'm12');
  await mkdir(reportDir, { recursive: true });
  const jsonPath = resolve(
    reportDir,
    `benchmark-machine-axis-search-${timestamp}.json`
  );
  const markdownPath = resolve(
    reportDir,
    `benchmark-machine-axis-search-${timestamp}.md`
  );
  const benchmark = {
    kind: 'azpr-m12-search-benchmark',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      fixture: 'fixtures/machine-axis/m12-search-example.json',
      horizonFrames: envelope.contract.scenario.durationFrames,
    },
    variants: results,
    workerParallelismAssessment:
      'Candidate simulation is synchronous CPU-bound work (per-run ~0.8-0.9s). In-process async jobs do not add throughput; real parallelism would require worker threads/child processes that re-instantiate the verified mechanics package per worker. Not implemented in M12-B: search correctness and determinism take priority, and current scope (functional validation on 3 runtime-integrated characters) is within single-process time budgets. Revisit before M12-C scale-up.',
    interpretation:
      'Baseline record only. Top-N scores and trace hashes are deterministic per variant; wall time varies with machine load.',
  };
  await writeFile(jsonPath, `${JSON.stringify(benchmark, null, 2)}\n`, 'utf8');

  const variantLines = results
    .map(
      result =>
        `| ${result.variant} | ${result.beamWidth} | ${result.maxDepth} | ${result.wallMs} | ${result.cpuUserMs} | ${result.summary.candidatesEvaluated} | ${result.summary.invalidCandidates} | ${result.summary.mergedCandidates} | ${result.summary.prunedCandidates} | ${result.topScores[0]?.score ?? '-'} |`
    )
    .join('\n');
  await writeFile(
    markdownPath,
    `# M12-B Search Benchmark

- 时间：${new Date().toISOString()}
- 环境：Node ${process.version} / ${process.platform}-${process.arch}
- 场景：\`m12-search-example\`（120s，beam/深度变体，topN=3，maxActionsPerOwner=2，maxKiboActions=1，includeSwitch=false，objective=damage）
- 说明：仅记录真实基线；Top-N 分数与 trace hash 按变体确定，墙钟随负载波动

## 基准

| variant | beam | depth | wall ms | cpu user ms | candidates | invalid | merged | pruned | top1 score |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
${variantLines}

## worker 并行评审

${benchmark.workerParallelismAssessment}

完整数据：\`${jsonPath}\`
`,
    'utf8'
  );
  process.stdout.write(`${markdownPath}\n`);
} finally {
  await vite.close();
}
