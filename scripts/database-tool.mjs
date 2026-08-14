#!/usr/bin/env node

// AzPr 可编辑游戏数据库工具（阶段 A）
//
// 把「角色/技能/奇波/敌人/装备/灵子/效果/动作目录」的数值从生成产物
// （src/data/generated/**）导出为可编辑数据库（src/data/database/**），
// 初始默认值由客户端导出，之后可自由编辑。排轴优化只记录 contentHash，
// 不验证数据库正确性（见 DECOMPOSITION_PLAN.md 阶段 A/B/C）。
//
// 子命令：
//   export    从 generated 导出/刷新 database/（建立默认库 + manifest）
//   hash      重算 contentHash（编辑后调用，更新 manifest）
//   validate  只查 schema + 引用完整性（不查数值正确性）

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');
const GENERATED = path.join(REPO_ROOT, 'src', 'data', 'generated');
const DATABASE = path.join(REPO_ROOT, 'src', 'data', 'database');
const MANIFEST_PATH = path.join(DATABASE, 'manifest.json');

const DATABASE_SCHEMA_VERSION = 1;
const DATABASE_KIND = 'azpr-edit-game-database';

// 数据文件清单（contentHash 覆盖，不含 manifest 自身）
const DATA_FILES = Object.freeze([
  'characters.json',
  'skills.json',
  'kibos.json',
  'enemies.json',
  'equipment.json',
  'soulessences.json',
  'effects.json',
  'actions.json',
]);

// 导出时递归剥离的溯源字段（绝对路径 / evidence 噪声），保留语义字段
const SOURCE_FIELD_NAMES = new Set([
  'source',
  'sourceIdentity',
  'sourceIdentities',
  'bindingSourceIdentity',
  'controlVariantSourceIdentity',
  'sourcePath',
  'sourceAssetPath',
]);

function sha256Utf8(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stable(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stable);
  const out = {};
  for (const key of Object.keys(value).sort()) out[key] = stable(value[key]);
  return out;
}

function stableStringify(value) {
  return JSON.stringify(stable(value));
}

function stripSource(value) {
  if (Array.isArray(value)) return value.map(stripSource);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (SOURCE_FIELD_NAMES.has(key)) continue;
      out[key] = stripSource(child);
    }
    return out;
  }
  return value;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readDatabaseContent() {
  const content = {};
  for (const name of DATA_FILES) {
    const filePath = path.join(DATABASE, name);
    if (!fs.existsSync(filePath)) {
      throw new Error(`database file missing: ${name} (run export first)`);
    }
    content[name.replace(/\.json$/, '')] = readJson(filePath);
  }
  return content;
}

export function computeContentHash() {
  return sha256Utf8(stableStringify(readDatabaseContent()));
}

// ---------------------------------------------------------------------------
// export：从 generated 投影出可编辑数据库
// ---------------------------------------------------------------------------

export function exportFromGenerated() {
  const simple = [
    'characters',
    'skills',
    'kibos',
    'enemies',
    'equipment',
    'soulessences',
  ];
  for (const name of simple) {
    const source = readJson(path.join(GENERATED, `${name}.json`));
    const items = stripSource(source.items ?? source.entries ?? []);
    writeJson(path.join(DATABASE, `${name}.json`), {
      schemaVersion: DATABASE_SCHEMA_VERSION,
      kind: `azpr-edit-database-${name}`,
      count: Array.isArray(items) ? items.length : Object.keys(items).length,
      items,
    });
  }

  // effects.json + actions.json 来自 verified-combat-mechanics-package
  const pkg = readJson(
    path.join(GENERATED, 'verified-combat-mechanics-package.json')
  );
  const semantic = pkg.semanticEffectCatalog ?? {};
  const effects = {
    schemaVersion: DATABASE_SCHEMA_VERSION,
    kind: 'azpr-edit-database-effects',
    targetTypeContract: stripSource(semantic.targetTypeContract ?? null),
    formulas: stripSource(semantic.formulas ?? []),
    semanticEffects: stripSource(semantic.semanticEffects ?? []),
  };
  writeJson(path.join(DATABASE, 'effects.json'), effects);

  const actions = {
    schemaVersion: DATABASE_SCHEMA_VERSION,
    kind: 'azpr-edit-database-actions',
    actionMappings: stripSource(pkg.actionMappings ?? []),
    summary: {
      actionMappingCount: pkg.actionMappings?.length ?? 0,
    },
  };
  writeJson(path.join(DATABASE, 'actions.json'), actions);

  const clientBuild = pkg.clientBuild ?? 'unknown';
  const contentHash = computeContentHash();
  writeJson(MANIFEST_PATH, {
    schemaVersion: DATABASE_SCHEMA_VERSION,
    kind: DATABASE_KIND,
    contentHash,
    exportedFromClientBuild: clientBuild,
    exportedFromPackageId: pkg.packageId ?? null,
    exportedAt: new Date().toISOString(),
    edited: false,
  });
  return {
    contentHash,
    clientBuild,
    exportedFiles: [...simple, 'effects', 'actions'],
  };
}

// ---------------------------------------------------------------------------
// hash：编辑后重算 contentHash
// ---------------------------------------------------------------------------

export function updateHash() {
  const contentHash = computeContentHash();
  const manifest = fs.existsSync(MANIFEST_PATH)
    ? readJson(MANIFEST_PATH)
    : { schemaVersion: DATABASE_SCHEMA_VERSION, kind: DATABASE_KIND };
  const previous = manifest.contentHash ?? null;
  manifest.contentHash = contentHash;
  if (previous && previous !== contentHash) manifest.edited = true;
  writeJson(MANIFEST_PATH, manifest);
  return {
    contentHash,
    changed: previous !== null && previous !== contentHash,
  };
}

// ---------------------------------------------------------------------------
// validate：只查 schema + 引用完整性，不查数值正确性
// ---------------------------------------------------------------------------

export function validate() {
  const issues = [];
  const content = readDatabaseContent();

  const characterIds = new Set(
    (content.characters.items ?? []).map(item => item.id)
  );
  const kiboIds = new Set((content.kibos.items ?? []).map(item => item.id));
  const skillIds = new Set((content.skills.items ?? []).map(item => item.id));
  const enemyIds = new Set((content.enemies.items ?? []).map(item => item.id));

  for (const skill of content.skills.items ?? []) {
    if (skill.characterId != null && !characterIds.has(skill.characterId)) {
      issues.push(
        `skill ${skill.id} references missing character ${skill.characterId}`
      );
    }
  }
  for (const action of content.actions.actionMappings ?? []) {
    const ownerOk =
      action.ownerKind === 'kibo'
        ? kiboIds.has(action.ownerId)
        : characterIds.has(action.ownerId);
    if (!ownerOk) {
      issues.push(
        `action ${action.identity} references missing owner ${action.ownerKind}:${action.ownerId}`
      );
    }
    // sourceSkillId 指向可编辑技能表（skills.json）；controlSkillId 是机制层 skill_control 身份，不在可编辑库范围。
    // 奇波动作的 sourceSkillId 是奇波技能身份（kibos.json 未单列数字 id），阶段 A 跳过，后续扩展奇波技能库时补齐。
    if (
      action.ownerKind !== 'kibo' &&
      action.sourceSkillId != null &&
      !skillIds.has(action.sourceSkillId)
    ) {
      issues.push(
        `action ${action.identity} references missing sourceSkill ${action.sourceSkillId}`
      );
    }
  }

  return {
    valid: issues.length === 0,
    status:
      issues.length === 0
        ? 'azpr-database-schema-valid'
        : 'azpr-database-schema-invalid',
    issues,
    counts: {
      characters: characterIds.size,
      skills: skillIds.size,
      kibos: kiboIds.size,
      enemies: enemyIds.size,
      actions: content.actions.actionMappings?.length ?? 0,
      effects: content.effects.semanticEffects?.length ?? 0,
      formulas: content.effects.formulas?.length ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
// run-identity：搜索 run 的输入指纹集（阶段 C：只记录哈希，不验证正确性）
// ---------------------------------------------------------------------------

export function createRunIdentity() {
  let databaseContentHash = null;
  try {
    databaseContentHash =
      readJson(path.join(DATABASE, 'manifest.json'))?.contentHash ?? null;
  } catch {
    databaseContentHash = null;
  }
  let layerHashes = null;
  try {
    layerHashes = readJson(
      path.join(GENERATED, 'verified-combat-mechanics-layer-hashes.json')
    );
  } catch {
    layerHashes = null;
  }
  let authorityHead = null;
  try {
    authorityHead = execSync('git rev-parse HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
  } catch {
    authorityHead = null;
  }
  return {
    schemaVersion: 1,
    kind: 'azpr-m12c-search-input-identity',
    authorityHead,
    databaseContentHash,
    mechanismHash: layerHashes?.mechanismHash ?? null,
    dataVersionHash: layerHashes?.dataVersionHash ?? null,
    verifiedMechanicsPackageHash: layerHashes?.packageHash ?? null,
    databaseEdited:
      readJson(path.join(DATABASE, 'manifest.json'))?.edited ?? null,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function run() {
  const command = process.argv[2] ?? 'export';
  switch (command) {
    case 'export': {
      const result = exportFromGenerated();
      console.log(JSON.stringify({ status: 'exported', ...result }, null, 2));
      break;
    }
    case 'hash': {
      const result = updateHash();
      console.log(JSON.stringify({ status: 'hashed', ...result }, null, 2));
      break;
    }
    case 'validate': {
      const result = validate();
      console.log(JSON.stringify(result, null, 2));
      if (!result.valid) process.exitCode = 1;
      break;
    }
    case 'run-identity': {
      console.log(JSON.stringify(createRunIdentity(), null, 2));
      break;
    }
    default:
      console.error(
        `unknown command: ${command} (expect export|hash|validate|run-identity)`
      );
      process.exitCode = 1;
  }
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  return (
    path.resolve(process.argv[1]).toLowerCase() ===
    fileURLToPath(import.meta.url).toLowerCase()
  );
}

if (isDirectExecution()) {
  run();
}
