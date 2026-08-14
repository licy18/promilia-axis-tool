#!/usr/bin/env node

import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createMachineAxisLocalCandidates,
  createMachineAxisLocalSearchShards,
  normalizeMachineAxisCoarsePlan,
} from '../src/machine-axis/machineAxisCoarsePlan.js';
import { createMachineAxisLocalSearchAggregate } from '../src/machine-axis/machineAxisLocalSearchResult.js';
import { hashCanonicalValue } from '../src/simulation/headless/canonicalSerialization.js';
import {
  createSearchFingerprint,
  verifyArtifactFingerprint,
} from './search-fingerprint.mjs';
import {
  validateFingerprintUnchanged,
  validateResumeContinuation,
  validateShardResultEnvelope,
  validateWallTimeLedger,
} from './search-resume-validation.mjs';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const workRoot = path.join(projectRoot, 'work');
const planPath = resolveProjectPath(readRequiredArgument('--plan'));
const outputRoot = resolveWorkOutput(readRequiredArgument('--output'));
const resume = process.argv.includes('--resume');
const workerScript = path.join(
  scriptDirectory,
  'run-ai-local-search-worker.mjs'
);
const pollutedInputs = new Set(
  [
    'work/m12-c/guidance.m12c4.round1.cycle-no-toughness.json',
    'work/m12-c/m12c4-search-template.json',
  ].map(relativePath => path.resolve(projectRoot, relativePath).toLowerCase())
);

if (pollutedInputs.has(planPath.toLowerCase())) {
  throw new Error('refusing known polluted M12-C search input');
}

// 第十二轮：resume preflight 全部只读并前移到任何 mkdir/copy/write 之前——
// 指纹/plan/预算账本任一校验失败都不得留下被改写的续跑证据。
const existingFrozenDir = path.join(outputRoot, 'frozen-database');
let priorLedger = null;
// 第十三轮：preflight 验证过的快照提升到外层——后续写入只复用这些值，禁止校验后再次读取可变输入（TOCTOU）。
let validatedPlan = null;
let validatedFingerprint = null;
if (resume) {
  // P1-2/P1-3：缺失指纹、指纹不匹配、planHash 不匹配均拒绝（单一实现见 search-resume-validation.mjs）。
  // 第八轮：所有存在产物（checkpoint/progress/plan）的指纹逐一独立认证——
  // 任何产物缺失或不一致都拒绝，不能用首个有效值掩盖其余产物。
  const priorArtifacts = await readPriorRunFingerprints(outputRoot);
  if (priorArtifacts.length === 0) {
    throw new Error(
      'resume requested but no prior run artifacts found; use a fresh outputRoot/runId'
    );
  }
  const hasExistingFrozen = await fs
    .access(existingFrozenDir)
    .then(() => true)
    .catch(() => false);
  const currentForCheck = createSearchFingerprint({
    databaseDir: hasExistingFrozen ? existingFrozenDir : undefined,
  });
  for (const { artifact, fingerprint, corrupt } of priorArtifacts) {
    if (corrupt) {
      throw new Error(
        `resume rejected: ${artifact} is corrupt; use a fresh outputRoot/runId`
      );
    }
    if (!fingerprint) {
      throw new Error(
        `resume rejected: ${artifact} missing inputFingerprint; use a fresh outputRoot/runId`
      );
    }
    const artifactCheck = verifyArtifactFingerprint(
      fingerprint,
      currentForCheck
    );
    if (!artifactCheck.valid) {
      throw new Error(
        `resume rejected: ${artifact} fingerprint mismatch (${artifactCheck.mismatches.join(', ')}); use a fresh outputRoot/runId`
      );
    }
  }
  // 第七轮：旧 plan 必须存在且经 canonical 重算（篡改正文保留旧 planHash 会被 normalize 拒绝）。
  const priorPlan = await readPriorNormalizedPlan(outputRoot);
  const newPlan = normalizeMachineAxisCoarsePlan(
    JSON.parse(await fs.readFile(planPath, 'utf8'))
  );
  const continuationCheck = validateResumeContinuation({
    priorFingerprint: priorArtifacts[0].fingerprint,
    priorPlan,
    newPlan,
    currentFingerprint: currentForCheck,
    verifyFingerprint: verifyArtifactFingerprint,
    requiredPlan: true,
  });
  if (!continuationCheck.valid) {
    throw new Error(
      `resume rejected (${continuationCheck.errors.join(', ')}) — use a fresh outputRoot/runId`
    );
  }
  if (!hasExistingFrozen) {
    throw new Error(
      'resume requested but no frozen database exists; use a fresh outputRoot/runId'
    );
  }
  // 第十一轮：resume 不重置总预算——累计墙钟持久化于 checkpoint；第十二轮：账本校验纳入只读 preflight，
  // 在 prepareOutputRoot/冻结/写 plan/manifests/shard 之前执行，损坏或超预算 checkpoint 拒绝时不留污染。
  priorLedger = await readPriorWallTimeLedger(
    outputRoot,
    Number(newPlan.budget.maxWallTimeMs)
  );
  // 第十三轮：只记录 preflight 已验证的 plan 与指纹；后续任何写入都不得重新读取 planPath/数据库。
  validatedPlan = newPlan;
  validatedFingerprint = currentForCheck;
  // 第十五轮：resume 在 prepareOutputRoot 的 mkdir 之前就复验指纹——任何写操作（含 mkdir）前拒绝漂移。
  await assertFingerprintUnchanged(
    validatedFingerprint,
    existingFrozenDir,
    'preflight-write'
  );
}

// 第十二轮：全部 resume preflight 通过后才允许写操作。
await prepareOutputRoot(outputRoot, resume);
// P1-3：resume 复用原冻结快照（不重新复制现场数据库）；新 run 才冻结。
const frozenDatabaseDir = resume
  ? existingFrozenDir
  : await freezeDatabase(outputRoot);
// P1-2：本 run 的输入指纹（基于冻结快照），嵌入 plan/shard/result/checkpoint，resume 时 fail-closed 比对。
// 第十三轮：resume 直接复用 preflight 已验证的指纹与 plan（同一快照）；仅 fresh run 在此读取一次可变输入。
const inputFingerprint = resume
  ? validatedFingerprint
  : createSearchFingerprint({ databaseDir: frozenDatabaseDir });
const plan = resume
  ? validatedPlan
  : normalizeMachineAxisCoarsePlan(
      JSON.parse(await fs.readFile(planPath, 'utf8'))
    );
const candidateSet = createMachineAxisLocalCandidates(plan);
const shardSet = createMachineAxisLocalSearchShards(plan, candidateSet);
const inputDirectory = path.join(outputRoot, 'shards', 'input');
const resultDirectory = path.join(outputRoot, 'shards', 'result');
// 第十四轮：任何写操作（含 mkdir）之前复算当前指纹并比对快照；第十五轮：无条件执行——fresh run 也
// 必须在 shard 写入前确认现场指纹仍等于本 run 输入指纹（worker 只启动时检查一次，父进程负责兜底）。
await assertFingerprintUnchanged(
  inputFingerprint,
  frozenDatabaseDir,
  'shard-write'
);
await fs.mkdir(inputDirectory, { recursive: true });
await fs.mkdir(resultDirectory, { recursive: true });
await writeJsonAtomically(path.join(outputRoot, 'plan.normalized.json'), {
  ...plan,
  inputFingerprint,
});
await writeJsonAtomically(path.join(outputRoot, 'candidates.manifest.json'), {
  ...candidateSet,
  inputFingerprint,
});
await writeJsonAtomically(path.join(outputRoot, 'shards.manifest.json'), {
  ...shardSet,
  inputFingerprint,
});

for (const shard of shardSet.shards) {
  await writeJsonAtomically(
    path.join(inputDirectory, `${shard.shardId}.json`),
    { ...shard, inputFingerprint }
  );
}

const startedAt = new Date().toISOString();
const startedAtMs = Date.now();
// 第九轮：resume 不重置总预算——累计已用墙钟持久化于 checkpoint，只给续跑剩余预算。
// 第十二轮：账本已在只读 preflight 校验（priorLedger），此处直接消费有效累计值。
const priorCumulativeMs = priorLedger?.effective ?? 0;
const remainingBudgetMs = Math.max(
  0,
  Number(plan.budget.maxWallTimeMs) - priorCumulativeMs
);
const globalDeadlineMs = startedAtMs + remainingBudgetMs;
const configuredWorkerCount = Math.max(
  1,
  Math.min(
    plan.parallelism.workers,
    Math.max(1, os.availableParallelism() - 1),
    shardSet.shardCount || 1
  )
);
const completedByShardId = new Map();
const pendingShards = [];

for (const shard of shardSet.shards) {
  const existing = resume ? await readExistingShardResult(shard) : null;
  if (existing) {
    completedByShardId.set(shard.shardId, existing);
  } else {
    pendingShards.push(shard);
  }
}
const reusedShardCount = completedByShardId.size;
const workerCount = Math.min(configuredWorkerCount, pendingShards.length);

let nextShardIndex = 0;
let progressWrite = Promise.resolve();
await queueProgressWrite();

await Promise.all(
  Array.from({ length: workerCount }, (_, workerIndex) =>
    runWorkerLane(workerIndex + 1)
  )
);

for (const shard of pendingShards.slice(nextShardIndex)) {
  if (completedByShardId.has(shard.shardId)) continue;
  const record = createSkippedShardResult(
    shard,
    'global-wall-time-budget-exhausted'
  );
  completedByShardId.set(shard.shardId, record);
  await writeJsonAtomically(
    path.join(resultDirectory, `${shard.shardId}.json`),
    record
  );
}
await progressWrite;
await queueProgressWrite();
await progressWrite;

const endedAt = new Date().toISOString();
const shardResults = shardSet.shards.map(shard =>
  completedByShardId.get(shard.shardId)
);
const aggregate = createMachineAxisLocalSearchAggregate({
  plan,
  candidateSet,
  shardSet,
  shardResults,
  startedAt,
  endedAt,
});
// 第十四轮：最终聚合前再次复算指纹；第十五轮：无条件执行——fresh/resume 都要在写出 result/checkpoint 前
// 确认现场指纹未漂移（worker 只启动时检查一次；无待执行 shard 时此处是唯一防线）。
await assertFingerprintUnchanged(
  inputFingerprint,
  frozenDatabaseDir,
  'final-aggregation'
);
const hardFailure = shardResults.some(shard =>
  ['failed', 'timed-out'].includes(shard.status)
);
const orchestrationStatus = hardFailure
  ? 'failed'
  : aggregate.coverage.evaluatedCandidateCount === 0
    ? 'no-valid-candidates'
    : aggregate.authority.truncated
      ? 'bounded-truncated'
      : 'bounded-complete';
await writeJsonAtomically(path.join(outputRoot, 'result.json'), {
  ...aggregate,
  inputFingerprint,
});
const checkpointAtMs = Date.now();
const finalCheckpointBody = {
  schemaVersion: 1,
  contractName: 'AzPrMachineAxisLocalSearchCheckpoint',
  kind: 'azpr-machine-axis-local-search-checkpoint',
  inputFingerprint,
  planId: plan.planId,
  planHash: plan.planHash,
  completedShardResults: shardResults.map(shard => ({
    shardId: shard.shardId,
    status: shard.status,
    resultHash: shard.resultHash ?? null,
  })),
  aggregateHash: aggregate.aggregateHash,
  complete: true,
  cumulativeWallTimeMs: priorCumulativeMs + (checkpointAtMs - startedAtMs),
  lastCheckpointAtMs: checkpointAtMs,
};
await writeJsonAtomically(path.join(outputRoot, 'checkpoint.json'), {
  ...finalCheckpointBody,
  checkpointHash: hashCanonicalValue(finalCheckpointBody),
});

process.stdout.write(
  `${JSON.stringify(
    {
      status: orchestrationStatus,
      planId: plan.planId,
      planHash: plan.planHash,
      output: path.relative(projectRoot, outputRoot).replaceAll('\\', '/'),
      workerCount,
      configuredWorkerCount,
      reusedShardCount,
      wallTimeMs: Date.now() - startedAtMs,
      coverage: aggregate.coverage,
      formalRankingReady: false,
      clientParityReady: false,
      aggregateHash: aggregate.aggregateHash,
    },
    null,
    2
  )}\n`
);
if (hardFailure || aggregate.coverage.evaluatedCandidateCount === 0) {
  process.exitCode = 1;
}

async function runWorkerLane(workerIndex) {
  while (nextShardIndex < pendingShards.length) {
    if (Date.now() >= globalDeadlineMs) return;
    const shardIndex = nextShardIndex;
    nextShardIndex += 1;
    const shard = pendingShards[shardIndex];
    const result = await runShardProcess(shard, workerIndex);
    completedByShardId.set(shard.shardId, result);
    await queueProgressWrite();
  }
}

async function runShardProcess(shard, workerIndex) {
  const inputPath = path.join(inputDirectory, `${shard.shardId}.json`);
  const outputPath = path.join(resultDirectory, `${shard.shardId}.json`);
  const remainingGlobalMs = Math.max(1, globalDeadlineMs - Date.now());
  const timeoutMs = Math.min(
    remainingGlobalMs,
    Number(shard.budget.maxWallTimeMs) + 5_000
  );
  const args = [
    `--max-old-space-size=${plan.parallelism.memoryMbPerWorker}`,
    workerScript,
    '--shard-input',
    inputPath,
    '--shard-output',
    outputPath,
    '--database-dir',
    frozenDatabaseDir,
  ];
  const child = spawn(process.execPath, args, {
    cwd: projectRoot,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      AZPR_LOCAL_SEARCH_WORKER_INDEX: String(workerIndex),
    },
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', chunk => {
    stdout = appendBounded(stdout, chunk);
  });
  child.stderr.on('data', chunk => {
    stderr = appendBounded(stderr, chunk);
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, timeoutMs);
  const exit = await new Promise(resolve => {
    child.once('error', error => resolve({ error }));
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  clearTimeout(timeout);
  if (!timedOut && exit.code === 0) {
    try {
      const result = JSON.parse(await fs.readFile(outputPath, 'utf8'));
      const resultFingerprintOk = verifyArtifactFingerprint(
        result,
        inputFingerprint
      ).valid;
      // P1-4：fresh shard 也验证 resultHash（删 resultHash 后重算 canonical hash），与 resume 同一逻辑。
      const resultPayload = structuredClone(result);
      const declaredResultHash = resultPayload.resultHash;
      delete resultPayload.resultHash;
      const resultHashOk =
        typeof declaredResultHash === 'string' &&
        declaredResultHash === hashCanonicalValue(resultPayload);
      // P2-1：envelope 合法（单一实现见 search-resume-validation.mjs）——绑定实际 shard 候选数。
      const envelopeOk = validateShardResultEnvelope(result, {
        expectedAssignedCandidateCount: shard.candidates.length,
        expectedCandidateIds: shard.candidates.map(
          candidate => candidate.candidateId
        ),
      }).valid;
      if (
        result.shardId === shard.shardId &&
        result.planHash === plan.planHash &&
        resultFingerprintOk &&
        resultHashOk &&
        envelopeOk
      ) {
        return result;
      }
    } catch (error) {
      stderr = appendBounded(stderr, String(error?.message ?? error));
    }
  }
  const failure = createFailedShardResult(shard, {
    status: timedOut ? 'timed-out' : 'failed',
    stopReason: timedOut
      ? Date.now() >= globalDeadlineMs
        ? 'global-wall-time-budget-exhausted'
        : 'parent-shard-wall-time-budget-exhausted'
      : 'worker-process-failed',
    exit,
    stdout,
    stderr,
  });
  await writeJsonAtomically(outputPath, failure);
  return failure;
}

// 第十一轮：resume 必须读到合法累计墙钟（checkpointHash 防篡改、严格非负整数、tail 计入）；
// 缺失/无效/超预算都 fail closed（单一实现见 search-resume-validation.mjs 的 validateWallTimeLedger）。
async function readPriorWallTimeLedger(outputRoot, totalBudgetMs) {
  let checkpoint = null;
  try {
    checkpoint = JSON.parse(
      await fs.readFile(path.join(outputRoot, 'checkpoint.json'), 'utf8')
    );
  } catch {
    throw new Error(
      'resume rejected: checkpoint missing or corrupt; use a fresh outputRoot/runId'
    );
  }
  const ledgerCheck = validateWallTimeLedger(checkpoint, {
    totalBudgetMs,
    nowMs: Date.now(),
    hashFn: hashCanonicalValue,
  });
  if (!ledgerCheck.valid) {
    throw new Error(
      `resume rejected: budget ledger invalid (${ledgerCheck.errors.join(', ')}); use a fresh outputRoot/runId`
    );
  }
  return {
    cumulative: Number(checkpoint.cumulativeWallTimeMs),
    tailMs: ledgerCheck.effective - Number(checkpoint.cumulativeWallTimeMs),
    effective: ledgerCheck.effective,
  };
}

// 第十四轮：复算当前指纹并比对 preflight 快照（fail-closed）——捕获 preflight 后 HEAD/数据库/包漂移。
async function assertFingerprintUnchanged(
  expectedFingerprint,
  databaseDir,
  phase
) {
  const current = createSearchFingerprint({ databaseDir });
  const check = validateFingerprintUnchanged(expectedFingerprint, current);
  if (!check.valid) {
    throw new Error(
      `resume rejected: fingerprint drifted at ${phase} (${check.errors.join(', ')}); use a fresh outputRoot/runId`
    );
  }
  return current;
}

async function readPriorNormalizedPlan(outputRoot) {
  const filePath = path.join(outputRoot, 'plan.normalized.json');
  try {
    // 第七轮：canonical 重算并校验声明 planHash——篡改正文会抛错（返回 null → requiredPlan 拒绝）。
    const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
    return normalizeMachineAxisCoarsePlan(parsed);
  } catch {
    return null;
  }
}

// 第八轮：返回所有存在续跑产物的指纹列表（checkpoint/progress/plan 各自独立）——
// 任何产物的指纹缺失或不一致都必须拒绝，不能用首个有效值掩盖其余产物。
async function readPriorRunFingerprints(outputRoot) {
  const fingerprints = [];
  for (const candidate of [
    'checkpoint.json',
    'progress.json',
    'plan.normalized.json',
  ]) {
    const filePath = path.join(outputRoot, candidate);
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
      // 第十轮：已存在但非正确对象信封（null/primitive/数组）→ corrupt，resume 必须拒绝。
      const isProperEnvelope =
        parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
      if (!isProperEnvelope) {
        fingerprints.push({
          artifact: candidate,
          fingerprint: null,
          corrupt: true,
        });
        continue;
      }
      const fingerprint = parsed?.inputFingerprint ?? null;
      if (fingerprint) {
        fingerprints.push({ artifact: candidate, fingerprint });
      } else {
        // 产物存在但无指纹：显式记录为缺失（校验时拒绝）
        fingerprints.push({ artifact: candidate, fingerprint: null });
      }
    } catch (error) {
      // 第九轮：仅 ENOENT（文件不存在）表示缺失；已存在但不可解析/读取错误视为损坏，resume 必须拒绝。
      if (error?.code === 'ENOENT') continue;
      fingerprints.push({
        artifact: candidate,
        fingerprint: null,
        corrupt: true,
      });
    }
  }
  return fingerprints;
}

async function freezeDatabase(outputRoot) {
  const sourceDir = path.join(projectRoot, 'src', 'data', 'database');
  const frozenDir = path.join(outputRoot, 'frozen-database');
  await fs.mkdir(frozenDir, { recursive: true });
  for (const file of await fs.readdir(sourceDir)) {
    if (file.endsWith('.json')) {
      await fs.copyFile(path.join(sourceDir, file), path.join(frozenDir, file));
    }
  }
  return frozenDir;
}

async function readExistingShardResult(shard) {
  const filePath = path.join(resultDirectory, `${shard.shardId}.json`);
  try {
    const result = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const payload = structuredClone(result);
    const declaredResultHash = payload.resultHash;
    delete payload.resultHash;
    // 第九轮：对比冻结数据库指纹（inputFingerprint），而非现场数据库。
    const fingerprintOk = verifyArtifactFingerprint(
      result,
      inputFingerprint
    ).valid;
    // 第八轮：resume 复用旧 shard 走统一信封校验（results/rejections/unevaluated 语义闭合）；
    // 第九轮：绑定候选 identity（expectedCandidateIds）。
    const envelopeOk = validateShardResultEnvelope(result, {
      expectedAssignedCandidateCount: shard.candidates.length,
      expectedCandidateIds: shard.candidates.map(
        candidate => candidate.candidateId
      ),
    }).valid;
    if (
      result.shardId === shard.shardId &&
      result.planHash === plan.planHash &&
      result.status === 'complete' &&
      fingerprintOk &&
      envelopeOk &&
      typeof declaredResultHash === 'string' &&
      declaredResultHash === hashCanonicalValue(payload)
    ) {
      return result;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT' && !(error instanceof SyntaxError)) {
      throw error;
    }
  }
  return null;
}

function queueProgressWrite() {
  progressWrite = progressWrite.then(async () => {
    const completed = [...completedByShardId.values()].sort((left, right) =>
      String(left.shardId).localeCompare(String(right.shardId), 'en')
    );
    const progress = {
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisLocalSearchProgress',
      kind: 'azpr-machine-axis-local-search-progress',
      inputFingerprint,
      planId: plan.planId,
      planHash: plan.planHash,
      updatedAt: new Date().toISOString(),
      workerCount,
      configuredWorkerCount,
      reusedShardCount,
      shardCount: shardSet.shardCount,
      completedShardCount: completed.length,
      remainingShardCount: Math.max(0, shardSet.shardCount - completed.length),
      elapsedMs: Date.now() - startedAtMs,
      hardRunWallTimeMs: plan.budget.maxWallTimeMs,
      shards: completed.map(result => ({
        shardId: result.shardId,
        status: result.status,
        resultHash: result.resultHash ?? null,
        summary: result.summary ?? null,
      })),
    };
    await writeJsonAtomically(path.join(outputRoot, 'progress.json'), progress);
    const checkpointAtMs = Date.now();
    const progressCheckpointBody = {
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisLocalSearchCheckpoint',
      kind: 'azpr-machine-axis-local-search-checkpoint',
      inputFingerprint,
      planId: plan.planId,
      planHash: plan.planHash,
      completedShardResults: completed.map(result => ({
        shardId: result.shardId,
        status: result.status,
        resultHash: result.resultHash ?? null,
      })),
      complete: false,
      // 第十轮：运行中 checkpoint 也写累计墙钟——中断后 resume 不会把已用时间读成 0。
      cumulativeWallTimeMs: priorCumulativeMs + (checkpointAtMs - startedAtMs),
      // 第十一轮：预算账本 heartbeat + 内容哈希（防篡改，resume 可计最后一段墙钟）。
      // 第十二轮：累计值与时间戳取自同一个 checkpointAtMs，避免两拍之间墙钟漂移。
      lastCheckpointAtMs: checkpointAtMs,
    };
    await writeJsonAtomically(path.join(outputRoot, 'checkpoint.json'), {
      ...progressCheckpointBody,
      checkpointHash: hashCanonicalValue(progressCheckpointBody),
    });
  });
  return progressWrite;
}

function createSkippedShardResult(shard, stopReason) {
  return createFailedShardResult(shard, {
    status: 'not-started',
    stopReason,
    exit: null,
    stdout: '',
    stderr: '',
  });
}

function createFailedShardResult(
  shard,
  { status, stopReason, exit, stdout, stderr }
) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisLocalSearchShardResult',
    kind: 'azpr-machine-axis-local-search-shard-result',
    shardId: shard.shardId,
    planId: shard.planId,
    planHash: shard.planHash,
    inputFingerprint: shard.inputFingerprint ?? null,
    status,
    stopReason,
    budget: structuredClone(shard.budget),
    timing: null,
    summary: {
      assignedCandidateCount: shard.candidates.length,
      evaluationAttemptCount: 0,
      evaluatedCandidateCount: 0,
      rejectedCandidateCount: 0,
      unevaluatedCandidateCount: shard.candidates.length,
      simulationCount: 0,
    },
    issues: [
      {
        code: stopReason,
        exit,
        stdout,
        stderr,
      },
    ],
    rejections: [],
    results: [],
    resultHash: null,
  };
}

async function prepareOutputRoot(root, allowResume) {
  try {
    const entries = await fs.readdir(root);
    if (entries.length > 0 && !allowResume) {
      throw new Error(
        'output directory is not empty; use a fresh path or --resume'
      );
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  await fs.mkdir(root, { recursive: true });
}

function resolveProjectPath(value) {
  const resolved = path.resolve(projectRoot, value);
  assertInside(projectRoot, resolved, '--plan');
  return resolved;
}

function resolveWorkOutput(value) {
  const resolved = path.resolve(projectRoot, value);
  assertInside(workRoot, resolved, '--output');
  return resolved;
}

function assertInside(root, target, label) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must resolve inside ${root}`);
  }
}

function readRequiredArgument(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : null;
  if (!value) throw new Error(`${name} <path> is required`);
  return value;
}

function appendBounded(current, value) {
  const next = `${current}${String(value)}`;
  return next.length > 65_536 ? next.slice(-65_536) : next;
}

async function writeJsonAtomically(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
    'utf8'
  );
  await fs.rename(temporaryPath, filePath);
}
