#!/usr/bin/env node

// AzPr M12-C 分层改造 Step 1：机制结构 / 数值数据 双层 hash
//
// 目标：把 verified-combat-mechanics-package.json 的验证语义拆成两个独立 hash——
//   - mechanismHash   ：只覆盖机制结构（结算顺序、formula 注册表、authority 版本、
//                       actionVariantGraph 拓扑、验证策略、SP 单位契约、动作映射/绑定骨架）。
//                       游戏数值/客户端数据更新时保持稳定。
//   - dataVersionHash ：只覆盖数值数据（倍率、帧值、参数表、sourceFiles、owner 档案、
//                       绑定数组的 hits/effects 内容等）。数值更新时变化。
// 原则：数值更新不触发机制 authority 失效 / owner 重签 / 搜索 admission 失效；
//       机制变更触发 mechanismHash 变化（灵敏度后续可细化，见 DECOMPOSITION_PLAN.md）。
// 产物：src/data/generated/verified-combat-mechanics-layer-hashes.json（独立小文件，
//       不改动 114.9MB 主包，避免 packageHash 级联漂移）。

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_ROOT, '..');
const PACKAGE_PATH = path.join(
  REPO_ROOT,
  'src',
  'data',
  'generated',
  'verified-combat-mechanics-package.json'
);
const LAYER_HASH_OUTPUT = path.join(
  REPO_ROOT,
  'src',
  'data',
  'generated',
  'verified-combat-mechanics-layer-hashes.json'
);

export const LAYER_HASH_SCHEMA_VERSION = 1;
export const LAYER_HASH_KIND = 'azpr-verified-mechanics-layer-hashes';

// ---------------------------------------------------------------------------
// 字段清单：机制结构 vs 数值数据
// ---------------------------------------------------------------------------

// 顶层 key：整体属于机制结构（全量纳入 mechanismHash）。
export const MECHANISM_TOP_KEYS = Object.freeze([
  'schemaVersion',
  'kind',
  'packageId',
  'packageVersion',
  'numericRuntime',
  'policy',
  'spUnitContract',
  'mechanismEvidence',
  'verifiedFindingIds',
  'knownGaps',
  'excludedDeadBranches',
  'excludedDeadVariants',
  'actionVariantGraph',
  'switchTriggerCatalog',
  'battleEffectCatalog',
  'tuningMechanicsCatalog',
  'specialResourceCatalog',
  'characterCombatProductBoundaries',
]);

// 顶层 key：整体属于数值数据/取证元数据（全量纳入 dataVersionHash）。
export const DATA_TOP_KEYS = Object.freeze([
  'status',
  'region',
  'clientBuild',
  'evidenceDate',
  'validation',
  'sourceFiles',
  'staticPropertyCatalog',
  'ownerProfiles',
  'summary',
  'characterCombatProfileCatalog',
]);

// semanticEffectCatalog：公式族/目标类型契约属于机制；semanticEffects 记录属于数据。
export const SEMANTIC_CATALOG_MECHANISM_FIELDS = Object.freeze([
  'schemaVersion',
  'kind',
  'status',
  'targetTypeContract',
  'formulas',
]);
export const SEMANTIC_CATALOG_DATA_FIELDS = Object.freeze([
  'semanticEffects',
  'summary',
]);

// 绑定数组元素的机制骨架字段（身份/变体/调度/状态/统计）。
// 其余字段（hits/effects 内容、数值参数等）自动归入数据侧。
export const BINDING_SKELETON_FIELDS = Object.freeze({
  actionMappings: [
    'identity',
    'ownerKind',
    'ownerId',
    'ownerName',
    'sourceSkillId',
    'sourceSkillName',
    'actionVariantIndex',
    'actionVariantLabel',
    'actionKind',
    'publicVariants',
    'controlSkillId',
    'bindingKind',
    'bindingSourceIdentity',
    'controlVariantSkillLevel',
    'controlVariantSourceIdentity',
    'controlFrameRate',
    'inputTrigger',
    'schedulable',
    'catalogDeclaration',
    'variantModelStatus',
    'variantConditionDiscovery',
    'selectedSubSkillIndex',
    'controlVariantResolution',
    'linked',
    'runtimeReady',
    'runtimeHitCount',
    'runtimeEffectCount',
    'runtimeResourceTransactionCount',
    'selectedResourceTransactionIdentities',
    'selectedElementCount',
  ],
  actionBindings: [
    'identity',
    'aggregateIdentity',
    'ownerKind',
    'ownerId',
    'ownerName',
    'sourceSkillId',
    'sourceSkillName',
    'actionVariantIndex',
    'actionVariantLabel',
    'actionKind',
    'controlSkillId',
    'selectedSubSkillIndex',
    'bindingKind',
    'bindingSourceIdentity',
    'controlVariantSkillLevel',
    'controlVariantSourceIdentity',
    'controlFrameRate',
    'hitCount',
    'effectCount',
    'selectedEffectIdentities',
    'attackSequenceIndex',
    'attackSequenceTotal',
    'status',
    'confidence',
    'applied',
  ],
  controlBindings: [
    'controlSkillId',
    'runtimePolicy',
    'frameRate',
    'sourcePath',
    'logic',
    'status',
    'confidence',
    'applied',
  ],
  actionVariantControlBindings: [
    'controlSkillId',
    'runtimePolicy',
    'frameRate',
    'sourcePath',
    'logic',
    'status',
    'confidence',
    'applied',
  ],
});

export const BINDING_ARRAY_KEYS = Object.freeze([
  'actionMappings',
  'actionBindings',
  'controlBindings',
  'actionVariantControlBindings',
]);

// ---------------------------------------------------------------------------
// 分区完整性（P1-2 修复）：未知顶层/语义字段必须显式归入机制或数据层，否则 fail-closed。
// ---------------------------------------------------------------------------

const UNPROJECTED_TOP_KEYS = Object.freeze([
  'packageHash',
  'semanticEffectCatalog',
  'actionMappings',
  'actionBindings',
  'controlBindings',
  'actionVariantControlBindings',
]);

export function assertPartitionComplete(pkg) {
  const partitioned = new Set([
    ...MECHANISM_TOP_KEYS,
    ...DATA_TOP_KEYS,
    ...UNPROJECTED_TOP_KEYS,
  ]);
  const unknownTopKeys = Object.keys(pkg).filter(key => !partitioned.has(key));
  if (unknownTopKeys.length > 0) {
    throw new Error(
      `Mechanics layer partition incomplete: unclassified top-level keys ${unknownTopKeys.join(', ')}`
    );
  }
  const semantic = pkg.semanticEffectCatalog ?? {};
  const semanticPartitioned = new Set([
    ...SEMANTIC_CATALOG_MECHANISM_FIELDS,
    ...SEMANTIC_CATALOG_DATA_FIELDS,
  ]);
  const unknownSemanticKeys = Object.keys(semantic).filter(
    key => !semanticPartitioned.has(key)
  );
  if (unknownSemanticKeys.length > 0) {
    throw new Error(
      `Mechanics layer partition incomplete: unclassified semanticEffectCatalog keys ${unknownSemanticKeys.join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// 投影
// ---------------------------------------------------------------------------

function pick(value, keys) {
  const result = {};
  for (const key of keys) {
    if (key in value) result[key] = value[key];
  }
  return result;
}

function omit(value, keys) {
  const excluded = new Set(keys);
  const result = {};
  for (const key of Object.keys(value)) {
    if (!excluded.has(key)) result[key] = value[key];
  }
  return result;
}

export function createMechanismProjection(pkg) {
  const mechanism = {};
  for (const key of MECHANISM_TOP_KEYS) {
    if (key in pkg) mechanism[key] = pkg[key];
  }
  const semantic = pkg.semanticEffectCatalog ?? {};
  mechanism.semanticEffectCatalog = pick(
    semantic,
    SEMANTIC_CATALOG_MECHANISM_FIELDS
  );
  for (const arrayKey of BINDING_ARRAY_KEYS) {
    mechanism[arrayKey] = (pkg[arrayKey] ?? []).map(entry =>
      pick(entry, BINDING_SKELETON_FIELDS[arrayKey])
    );
  }
  return mechanism;
}

export function createDataProjection(pkg) {
  const data = {};
  for (const key of DATA_TOP_KEYS) {
    if (key in pkg) data[key] = pkg[key];
  }
  const semantic = pkg.semanticEffectCatalog ?? {};
  data.semanticEffectCatalog = pick(semantic, SEMANTIC_CATALOG_DATA_FIELDS);
  for (const arrayKey of BINDING_ARRAY_KEYS) {
    const skeleton = BINDING_SKELETON_FIELDS[arrayKey];
    data[arrayKey] = (pkg[arrayKey] ?? []).map(entry => omit(entry, skeleton));
  }
  return data;
}

// ---------------------------------------------------------------------------
// hash
// ---------------------------------------------------------------------------

export function sha256Utf8(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

export function computeLayerHashes(pkg) {
  assertPartitionComplete(pkg);
  return {
    mechanismHash: sha256Utf8(JSON.stringify(createMechanismProjection(pkg))),
    dataVersionHash: sha256Utf8(JSON.stringify(createDataProjection(pkg))),
  };
}

export function createLayerHashesRecord(pkg) {
  const { mechanismHash, dataVersionHash } = computeLayerHashes(pkg);
  return {
    schemaVersion: LAYER_HASH_SCHEMA_VERSION,
    kind: LAYER_HASH_KIND,
    packageId: pkg.packageId,
    packageVersion: pkg.packageVersion,
    packageHash: pkg.packageHash,
    mechanismHash,
    dataVersionHash,
    projection: {
      mechanismTopKeys: MECHANISM_TOP_KEYS,
      dataTopKeys: DATA_TOP_KEYS,
      semanticCatalogMechanismFields: SEMANTIC_CATALOG_MECHANISM_FIELDS,
      semanticCatalogDataFields: SEMANTIC_CATALOG_DATA_FIELDS,
      bindingSkeletonFields: BINDING_SKELETON_FIELDS,
    },
  };
}

export function readLayerHashesRecord(filePath = LAYER_HASH_OUTPUT) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function runCli() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const assertClean = args.includes('--assert-clean');
  if (!write && !assertClean) {
    // 默认只打印，不写盘
  }
  const pkg = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8'));
  const record = createLayerHashesRecord(pkg);
  const content = `${JSON.stringify(record, null, 2)}\n`;
  const drift = fs.existsSync(LAYER_HASH_OUTPUT)
    ? fs.readFileSync(LAYER_HASH_OUTPUT, 'utf8') !== content
    : true;
  if (assertClean && drift) {
    console.error('verified mechanics layer hash drift');
    process.exitCode = 1;
    return;
  }
  if (write) {
    fs.mkdirSync(path.dirname(LAYER_HASH_OUTPUT), { recursive: true });
    fs.writeFileSync(LAYER_HASH_OUTPUT, content, 'utf8');
  }
  console.log(
    JSON.stringify(
      {
        status: drift ? (write ? 'written' : 'drift') : 'clean',
        packageId: record.packageId,
        packageVersion: record.packageVersion,
        packageHash: record.packageHash,
        mechanismHash: record.mechanismHash,
        dataVersionHash: record.dataVersionHash,
        mechanismProjectionBytes: JSON.stringify(createMechanismProjection(pkg))
          .length,
        dataProjectionBytes: JSON.stringify(createDataProjection(pkg)).length,
      },
      null,
      2
    )
  );
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
