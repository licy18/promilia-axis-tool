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

// 重生成器：依赖 C:\PC2\Codex\AzPr 等本地源，耗时很长，仅 --full 时执行。
const FULL_COMMANDS = Object.freeze([
  'node scripts/sync-verified-combat-mechanics.mjs --write',
  'node scripts/sync-character-combat-profile.mjs --write',
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

const args = process.argv.slice(2);
if (args.includes('--list')) {
  console.log('LIGHT:');
  for (const c of LIGHT_COMMANDS) console.log('  ' + c);
  console.log('FULL:');
  for (const c of FULL_COMMANDS) console.log('  ' + c);
  process.exit(0);
}
const commands = args.includes('--full')
  ? [...LIGHT_COMMANDS, ...FULL_COMMANDS]
  : [...LIGHT_COMMANDS];
process.stdout.write('Refreshing derived reports...\n');
const failed = run(commands);
process.stdout.write(
  failed ? `\nDone with ${failed} failures\n` : '\nAll refreshed\n'
);
process.exitCode = failed ? 1 : 0;
