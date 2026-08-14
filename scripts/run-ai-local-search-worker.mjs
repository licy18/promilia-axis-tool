#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const inputPath = resolveRequiredPath('--shard-input');
const outputPath = resolveRequiredPath('--shard-output');
const shard = JSON.parse(await fs.readFile(inputPath, 'utf8'));
validateShardEnvelope(shard);
// P1-3：worker 从冻结数据库快照读取评分输入
const databaseDir = readOptionalPath('--database-dir') ??
  path.join(projectRoot, 'src', 'data', 'database');
// P1-4：worker 在读取评分数据前 fail-closed 验证输入指纹与当前 authority/数据库一致
const {
  createSearchFingerprint,
  verifyArtifactFingerprint,
} = await import('./search-fingerprint.mjs');
{
  const fingerprintCheck = verifyArtifactFingerprint(
    shard,
    createSearchFingerprint({ databaseDir })
  );
  if (!fingerprintCheck.valid) {
    throw new Error(
      `shard input fingerprint mismatch: ${fingerprintCheck.mismatches.join(', ')}`
    );
  }
}

const startedAt = new Date().toISOString();
const startedAtMs = Date.now();
const deadlineMs = startedAtMs + Number(shard.budget.maxWallTimeMs);
let simulationCount = 0;
let evaluationAttemptCount = 0;
let evaluatedCandidateCount = 0;
let rejectedCandidateCount = 0;
let stopReason = null;
const results = [];
const rejections = [];
const issues = [];

const mechanicsPackage = JSON.parse(
  await fs.readFile(
    path.join(
      projectRoot,
      'src/data/generated/verified-combat-mechanics-package.json'
    ),
    'utf8'
  )
);
// P1-3b：评分输入使用数据库快照（可编辑数值），覆盖 package 中对应的动作目录/效果/控制绑定。
// 搜索不校验数值正确性，但必须基于当前数据库评分；数据库编辑后即使未重新导出 package 也生效。
const databaseActions = JSON.parse(
  await fs.readFile(path.join(databaseDir, 'actions.json'), 'utf8')
);
const databaseEffects = JSON.parse(
  await fs.readFile(path.join(databaseDir, 'effects.json'), 'utf8')
);
mechanicsPackage.actionMappings = databaseActions.actionMappings;
mechanicsPackage.controlBindings = databaseActions.controlBindings;
mechanicsPackage.actionVariantControlBindings =
  databaseActions.actionVariantControlBindings;
mechanicsPackage.semanticEffectCatalog = {
  ...mechanicsPackage.semanticEffectCatalog,
  formulas: databaseEffects.formulas,
  semanticEffects: databaseEffects.semanticEffects,
};
const vite = await createServer({
  root: projectRoot,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

try {
  const packageModule = await vite.ssrLoadModule(
    '/src/data/verifiedCombatMechanicsPackage.js'
  );
  const serviceModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisService.js'
  );
  const engineModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisSearchEngine.js'
  );
  const resultModule = await vite.ssrLoadModule(
    '/src/machine-axis/machineAxisLocalSearchResult.js'
  );
  const canonicalModule = await vite.ssrLoadModule(
    '/src/simulation/headless/canonicalSerialization.js'
  );

  packageModule.installVerifiedCombatMechanicsPackage(mechanicsPackage);
  const rawService = serviceModule.createMachineAxisService();
  const meteredService = createMeteredService(rawService);
  const engine = engineModule.createMachineAxisSearchEngine({
    service: meteredService,
  });

  for (const candidate of shard.candidates) {
    if (Date.now() >= deadlineMs) {
      stopReason = 'shard-wall-time-budget-exhausted';
      break;
    }
    if (evaluationAttemptCount >= Number(shard.budget.maxEvaluations)) {
      stopReason = 'shard-evaluation-budget-exhausted';
      break;
    }
    evaluationAttemptCount += 1;
    try {
      const entry = await engine.evaluateAxis({
        axis: candidate.axis,
        options: shard.searchOptions,
      });
      results.push(
        resultModule.projectMachineAxisLocalEvaluation(candidate, entry)
      );
      evaluatedCandidateCount += 1;
    } catch (error) {
      const normalized = normalizeError(error, candidate.candidateId);
      if (error?.name === 'LocalSearchBudgetError') {
        stopReason = error.code;
        issues.push(normalized);
        break;
      }
      rejectedCandidateCount += 1;
      rejections.push(normalized);
    }
  }

  const endedAt = new Date().toISOString();
  const completedCandidateCount =
    evaluatedCandidateCount + rejectedCandidateCount;
  const body = {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisLocalSearchShardResult',
    kind: 'azpr-machine-axis-local-search-shard-result',
    shardId: shard.shardId,
    planId: shard.planId,
    planHash: shard.planHash,
    status:
      stopReason == null && completedCandidateCount === shard.candidates.length
        ? 'complete'
        : 'truncated',
    stopReason,
    budget: structuredClone(shard.budget),
    timing: {
      startedAt,
      endedAt,
      wallTimeMs: Date.now() - startedAtMs,
    },
    summary: {
      assignedCandidateCount: shard.candidates.length,
      evaluationAttemptCount,
      evaluatedCandidateCount,
      rejectedCandidateCount,
      unevaluatedCandidateCount: Math.max(
        0,
        shard.candidates.length - completedCandidateCount
      ),
      simulationCount,
    },
    issues,
    rejections,
    results,
  };
  // P1-4：resultHash 必须覆盖完整 payload（含 inputFingerprint），否则 resume 端重算必然不匹配。
  const outputBody = {
    ...body,
    // P1-2：shard result 继承 shard 输入指纹（供 resume/聚合 fail-closed 比对）
    inputFingerprint: shard.inputFingerprint ?? null,
  };
  const output = {
    ...outputBody,
    resultHash: canonicalModule.hashCanonicalValue(outputBody),
  };
  await writeJsonAtomically(outputPath, output);
  process.stdout.write(
    `${JSON.stringify({
      shardId: shard.shardId,
      status: output.status,
      summary: output.summary,
      resultHash: output.resultHash,
    })}\n`
  );
} finally {
  await vite.close();
}

function createMeteredService(rawService) {
  const service = Object.fromEntries(
    Reflect.ownKeys(rawService).map(property => {
      const value = rawService[property];
      return [
        property,
        typeof value === 'function' ? value.bind(rawService) : value,
      ];
    })
  );
  service.simulate = async (...args) => {
    assertBudgetBeforeSimulation();
    simulationCount += 1;
    const result = await rawService.simulate(...args);
    if (Date.now() >= deadlineMs) {
      throw new LocalSearchBudgetError('shard-wall-time-budget-exhausted');
    }
    return result;
  };
  return Object.freeze(service);
}

function assertBudgetBeforeSimulation() {
  if (Date.now() >= deadlineMs) {
    throw new LocalSearchBudgetError('shard-wall-time-budget-exhausted');
  }
  if (simulationCount >= Number(shard.budget.maxSimulations)) {
    throw new LocalSearchBudgetError('shard-simulation-budget-exhausted');
  }
}

class LocalSearchBudgetError extends Error {
  constructor(code) {
    super(code);
    this.name = 'LocalSearchBudgetError';
    this.code = code;
  }
}

function normalizeError(error, candidateId) {
  return {
    candidateId,
    code: error?.code ?? error?.name ?? 'local-search-candidate-rejected',
    message: String(error?.message ?? error),
    issues: structuredClone(error?.issues ?? []),
  };
}

function validateShardEnvelope(value) {
  if (
    value?.contractName !== 'AzPrMachineAxisLocalSearchShard' ||
    !Array.isArray(value?.candidates) ||
    !value?.budget
  ) {
    throw new Error('invalid local-search shard envelope');
  }
  if (value.candidates.length > Number(value.budget.maxCandidates)) {
    throw new Error('local-search shard candidate budget exceeded');
  }
}

function readOptionalPath(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function resolveRequiredPath(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value) throw new Error(`${name} <path> is required`);
  return path.resolve(value);
}

async function writeJsonAtomically(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
  await fs.rename(temporaryPath, filePath);
}
