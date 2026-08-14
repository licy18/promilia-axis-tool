#!/usr/bin/env node

// AzPr M12-C 搜索 run 指纹契约（问题 1 修复）
//
// 搜索 run 的每个产物（plan / checkpoint / shard result / 最终 Top-N）必须内嵌
// 5 个输入指纹：authorityHead + databaseContentHash + mechanismHash + dataVersionHash + packageHash。
// 启动 / resume / 聚合 / replay 时必须 fail-closed 比对：任一指纹与当前仓库不一致即拒绝。
//
// 用法：
//   node scripts/search-fingerprint.mjs verify <artifact.json>   # 校验产物指纹，不一致 exit 1
//   node scripts/search-fingerprint.mjs current                  # 打印当前 5 指纹
//
// 产物内嵌形状（二选一）：
//   { inputFingerprint: { authorityHead, databaseContentHash, mechanismHash, dataVersionHash, packageHash } }
//   或顶层直接含上述 5 字段。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRunIdentity } from './database-tool.mjs';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');

export const SEARCH_FINGERPRINT_FIELDS = Object.freeze([
  'authorityHead',
  'databaseContentHash',
  'mechanismHash',
  'dataVersionHash',
  'packageHash',
]);

export function createSearchFingerprint({ databaseDir } = {}) {
  const identity = createRunIdentity({ databaseDir });
  return {
    authorityHead: identity.authorityHead,
    databaseContentHash: identity.databaseContentHash,
    mechanismHash: identity.mechanismHash,
    dataVersionHash: identity.dataVersionHash,
    packageHash: identity.verifiedMechanicsPackageHash,
  };
}

// 从任意产物形状提取内嵌指纹（兼容 inputFingerprint 嵌套与顶层字段）
export function extractEmbeddedFingerprint(artifact) {
  if (!artifact || typeof artifact !== 'object') return null;
  const isTopLevelShape =
    artifact.authorityHead != null || artifact.databaseContentHash != null;
  const source =
    artifact.inputFingerprint ??
    artifact.searchFingerprint ??
    (isTopLevelShape ? artifact : null);
  if (!source) return null;
  return {
    authorityHead: source?.authorityHead ?? null,
    databaseContentHash: source?.databaseContentHash ?? null,
    mechanismHash: source?.mechanismHash ?? null,
    dataVersionHash: source?.dataVersionHash ?? null,
    packageHash:
      source?.packageHash ?? source?.verifiedMechanicsPackageHash ?? null,
  };
}

// fail-closed 比对：任一指纹缺失或与当前不一致即返回不匹配列表
export function verifyArtifactFingerprint(
  artifact,
  current = createSearchFingerprint()
) {
  const embedded = extractEmbeddedFingerprint(artifact);
  if (!embedded) {
    return { valid: false, mismatches: ['no-embedded-fingerprint'] };
  }
  const mismatches = [];
  for (const field of SEARCH_FINGERPRINT_FIELDS) {
    if (!embedded[field]) {
      mismatches.push(`missing:${field}`);
    } else if (embedded[field] !== current[field]) {
      mismatches.push(
        `${field} (${String(embedded[field]).slice(0, 12)}... != ${String(current[field]).slice(0, 12)}...)`
      );
    }
  }
  return { valid: mismatches.length === 0, mismatches };
}

function runCli() {
  const command = process.argv[2];
  if (command === 'current') {
    console.log(JSON.stringify(createSearchFingerprint(), null, 2));
    process.exit(0);
  }
  if (command === 'verify') {
    const filePath = process.argv[3];
    if (!filePath) {
      console.error(
        'usage: node scripts/search-fingerprint.mjs verify <artifact.json>'
      );
      process.exitCode = 1;
      return;
    }
    const artifact = JSON.parse(
      fs.readFileSync(path.resolve(REPO_ROOT, filePath), 'utf8')
    );
    const result = verifyArtifactFingerprint(artifact);
    console.log(JSON.stringify(result, null, 2));
    if (!result.valid) process.exitCode = 1;
    return;
  }
  console.error(
    'usage: node scripts/search-fingerprint.mjs (current|verify <file>)'
  );
  process.exitCode = 1;
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return (
    path.resolve(process.argv[1]).toLowerCase() ===
    fileURLToPath(import.meta.url).toLowerCase()
  );
}

if (isDirectExecution()) {
  runCli();
}
