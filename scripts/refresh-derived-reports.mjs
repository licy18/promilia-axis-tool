#!/usr/bin/env node

// AzPr M12-C 分层改造 Step 2b：一键刷新 untracked 派生镜像
//
// reports/ 已移出 git 跟踪（见 DECOMPOSITION_PLAN.md Step 2b）。本脚本把
// 生成器产生的派生镜像刷新到磁盘，供测试 / audit --assert-clean / release 消费。
//
// 用法：
//   node scripts/refresh-derived-reports.mjs            # 轻量镜像（快，常见场景）
//   node scripts/refresh-derived-reports.mjs --full     # + 重生成器（依赖本地 AzPr 源，很慢）
//   node scripts/refresh-derived-reports.mjs --list     # 只打印命令，不执行
//
// 生成器本身是权威源；本脚本只负责按序执行并报告退出码，不修改任何生成逻辑。

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');

// 轻量镜像：不依赖本地游戏源，可频繁刷新。
const LIGHT_COMMANDS = Object.freeze([
  'node scripts/audit-production-imports.mjs',
  'node scripts/audit-build-bundle.mjs',
  'node scripts/generate-action-status-catalog.mjs --write',
  'node scripts/generate-runtime-capture-hook-manifest.mjs',
  'node scripts/generate-m12-b3-binding-matrix.mjs --write',
  'node scripts/generate-m12-b3-visual-acceptance.mjs --write',
  'node scripts/generate-optimization-scenario-policy.mjs --write',
  'node scripts/generate-optimization-qualification.mjs --write',
  'node scripts/generate-character-acceptance.mjs --write',
  'node scripts/generate-machine-axis-enemy-settlement-evidence.mjs',
]);

// 重生成器：依赖 C:\PC2\Codex\AzPr 等本地源，耗时很长，仅 --full / --ensure（缺失时）执行。
// 顺序要求：底层产物（主包/角色数据/golden）先于依赖它们的轻量审计生成器。
const FULL_COMMANDS = Object.freeze([
  'node scripts/sync-verified-combat-mechanics.mjs --write',
  'node scripts/sync-character-combat-profile.mjs --write',
  'node scripts/generate-kibo-headless-census.mjs --write',
]);

function run(commands) {
  let failed = 0;
  for (const command of commands) {
    const [file, ...args] = command.split(' ');
    process.stdout.write(`\n> ${command}\n`);
    const result = spawnSync(process.execPath, args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      timeout: 60 * 60_000,
    });
    if (result.status === 0) {
      process.stdout.write('  ok\n');
    } else {
      failed += 1;
      process.stderr.write(`  FAILED (exit ${result.status ?? 'signal'})\n`);
      process.stderr.write(
        `  ${(result.stderr || '').split('\n').slice(-5).join('\n')}\n`
      );
    }
  }
  return failed;
}

// 测试静态依赖的关键报告（干净 checkout 缺失时需先生成；本机已生成则快速跳过）
const REQUIRED_REPORTS = Object.freeze([
  'reports/verified-combat-mechanics-audit.json',
  'reports/verified-combat-action-coverage.json',
  'reports/verified-combat-action-timing-coverage.json',
  'reports/verified-combat-effect-coverage.json',
  'reports/verified-action-variant-resource-coverage.json',
  'reports/verified-derived-control-coverage.json',
  'reports/verified-public-runtime-coverage.json',
  'reports/verified-switch-trigger-coverage.json',
  'reports/applied-source-binding-audit.json',
  'reports/m9-r3-r2-xiaoyu-action-occupancy-audit.json',
  'reports/m9-r3-r2-r2-xiaoyu-hidden-input-audit.json',
  'reports/m9-r3-r2-r3-contextual-input-scheduling-audit.json',
  'reports/m10/101010/golden-trace.json',
  'reports/m10/101010/runtime-coverage.json',
  'reports/m10/102001/golden-trace.json',
  'reports/m10/102001/runtime-coverage.json',
  'reports/m10/103002/golden-trace.json',
  'reports/m10/101003/ultimate-controlled-buff-switch-golden.json',
  'reports/m10/101003/golden-trace.json',
  'reports/m11/character-acceptance/101010/manifest.json',
  'reports/m11/character-acceptance/199001/manifest.json',
  'reports/m11/character-acceptance/199001/scenario-cases.json',
  'reports/m11/character-acceptance/199002/manifest.json',
  'reports/m11/character-acceptance/199002/scenario-cases.json',
  'reports/m11/character-acceptance/199002/scenario-matrix.json',
  'reports/m11/character-acceptance/optimization-objects/STARBORN/manifest.json',
  'reports/m12/m12-b3-binding-matrix.json',
  'reports/m12/m12-b3-optimization-qualification-summary.json',
  'reports/m12/visual-acceptance/manifests/equipment/1010111.json',
  'reports/kibo-headless/kibo-maturity-matrix.json',
  'reports/kibo-headless/kibo-mechanics-census.json',
]);

function missingRequiredReports() {
  return REQUIRED_REPORTS.filter(
    file => !fs.existsSync(path.join(REPO_ROOT, file))
  );
}

const args = process.argv.slice(2);
if (args.includes('--list')) {
  console.log('LIGHT:');
  for (const c of LIGHT_COMMANDS) console.log('  ' + c);
  console.log('FULL:');
  for (const c of FULL_COMMANDS) console.log('  ' + c);
  process.exit(0);
}
if (args.includes('--ensure')) {
  const missing = missingRequiredReports();
  if (missing.length === 0) {
    process.stdout.write('All required derived reports present.\n');
    process.exit(0);
  }
  process.stdout.write(
    `Missing derived reports (${missing.length}): ${missing.join(', ')}\n`
  );
  process.stdout.write('Regenerating full derived reports...\n');
  const failed = run([...FULL_COMMANDS, ...LIGHT_COMMANDS]);
  process.exitCode = failed ? 1 : 0;
  process.exit(process.exitCode);
}
const commands = args.includes('--full')
  ? [...FULL_COMMANDS, ...LIGHT_COMMANDS]
  : [...LIGHT_COMMANDS];
process.stdout.write('Refreshing derived reports...\n');
const failed = run(commands);
process.stdout.write(
  failed ? `\nDone with ${failed} failures\n` : '\nAll refreshed\n'
);
process.exitCode = failed ? 1 : 0;
