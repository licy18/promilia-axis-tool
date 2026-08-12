import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = process.cwd();
const runCount = Math.max(
  1,
  Number(process.env.M12_BATCH_COUNT ?? process.argv[2] ?? 32) || 32
);
const jobsVariants = [1, 4, 8];

const mechanicsPackage = JSON.parse(
  await readFile(
    resolve(root, 'src/data/generated/verified-combat-mechanics-package.json'),
    'utf8'
  )
);

const fixture = JSON.parse(
  await readFile(
    resolve(root, 'fixtures/machine-axis/m11-b-three-actor-authority.json'),
    'utf8'
  )
);
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
  const { createMachineAxisBatchEvaluator } = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisBatchEvaluator.js'
  );
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const service = createMachineAxisService();
  const evaluator = createMachineAxisBatchEvaluator({ service });

  const envelope = {
    kind: 'azpr-machine-axis-batch',
    runs: Array.from({ length: runCount }, (_, index) => ({
      label: `run-${index}`,
      axis: structuredClone(fixture),
    })),
  };

  const variants = [];
  let slowestRuns = [];
  for (const jobs of jobsVariants) {
    global.gc?.();
    const wallStart = performance.now();
    const cpuStart = process.cpuUsage();
    const heapStart = process.memoryUsage().heapUsed;
    const report = await evaluator.evaluate(envelope, { jobs });
    const wallMs = performance.now() - wallStart;
    const cpu = process.cpuUsage(cpuStart);
    const heapDeltaBytes = process.memoryUsage().heapUsed - heapStart;
    variants.push({
      jobs,
      runCount,
      okCount: report.summary.okCount,
      failedCount: report.summary.failedCount,
      wallMs: Math.round(wallMs * 100) / 100,
      cpuUserMs: Math.round(cpu.user / 1000),
      cpuSystemMs: Math.round(cpu.system / 1000),
      heapDeltaMiB: Math.round((heapDeltaBytes / 1048576) * 100) / 100,
      perRunExecutionMs: report.summary.perRunExecutionMs,
    });
    if (jobs === 1) {
      slowestRuns = [...report.runs]
        .sort((left, right) => right.executionMs - left.executionMs)
        .slice(0, 10)
        .map(run => ({
          index: run.index,
          label: run.label,
          executionMs: Math.round(run.executionMs * 100) / 100,
          status: run.status,
        }));
    }
    process.stderr.write(
      `jobs=${jobs} wall=${variants[variants.length - 1].wallMs}ms ok=${report.summary.okCount}/${runCount}\n`
    );
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = resolve(root, 'reports', 'm12');
  await mkdir(reportDir, { recursive: true });
  const jsonPath = resolve(
    reportDir,
    `benchmark-machine-axis-batch-${timestamp}.json`
  );
  const markdownPath = resolve(
    reportDir,
    `benchmark-machine-axis-batch-${timestamp}.md`
  );
  const report = {
    kind: 'azpr-m12-batch-benchmark',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      fixture: 'fixtures/machine-axis/m11-b-three-actor-authority.json',
      scenarioDurationMs: 120000,
      runCount,
    },
    variants,
    slowestRuns,
    interpretation:
      'Baseline record only. Throughput targets are decided after reviewing this report; the batch evaluator never trades mechanism precision or legality checks for speed.',
  };
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const variantLines = variants
    .map(
      variant =>
        `| ${variant.jobs} | ${variant.wallMs} | ${variant.cpuUserMs} | ${variant.cpuSystemMs} | ${variant.perRunExecutionMs?.mean ?? '-'} | ${variant.perRunExecutionMs?.p95 ?? '-'} | ${variant.perRunExecutionMs?.max ?? '-'} | ${variant.heapDeltaMiB} |`
    )
    .join('\n');
  const slowestLines = slowestRuns
    .map(
      run =>
        `| ${run.index} | ${run.label} | ${run.executionMs} | ${run.status} |`
    )
    .join('\n');
  await writeFile(
    markdownPath,
    `# M12-A Batch Evaluator Benchmark

- 时间：${new Date().toISOString()}
- 环境：Node ${process.version} / ${process.platform}-${process.arch}
- 场景：\`m11-b-three-actor-authority\`（120s，3 角色 + 3 奇波）重复 ${runCount} 次
- 说明：仅记录真实基线，不据此牺牲机制精度或合法性检查

## 吞吐基线

| jobs | wall ms | cpu user ms | cpu sys ms | per-run mean ms | per-run p95 ms | per-run max ms | heap delta MiB |
| ---: | ------: | ----------: | ---------: | --------------: | --------------: | --------------: | -------------: |
${variantLines}

## jobs=1 最慢 10 条（热点）

| index | label | execution ms | status |
| ----: | ----- | -----------: | ------ |
${slowestLines}

完整数据：\`${jsonPath}\`
`,
    'utf8'
  );
  process.stdout.write(`${markdownPath}\n`);
} finally {
  await vite.close();
}
