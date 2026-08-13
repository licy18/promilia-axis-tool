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
await prepareOutputRoot(outputRoot, resume);

const rawPlan = JSON.parse(await fs.readFile(planPath, 'utf8'));
const plan = normalizeMachineAxisCoarsePlan(rawPlan);
const candidateSet = createMachineAxisLocalCandidates(plan);
const shardSet = createMachineAxisLocalSearchShards(plan, candidateSet);
const inputDirectory = path.join(outputRoot, 'shards', 'input');
const resultDirectory = path.join(outputRoot, 'shards', 'result');
await fs.mkdir(inputDirectory, { recursive: true });
await fs.mkdir(resultDirectory, { recursive: true });
await writeJsonAtomically(path.join(outputRoot, 'plan.normalized.json'), plan);
await writeJsonAtomically(
  path.join(outputRoot, 'candidates.manifest.json'),
  candidateSet
);
await writeJsonAtomically(
  path.join(outputRoot, 'shards.manifest.json'),
  shardSet
);

for (const shard of shardSet.shards) {
  await writeJsonAtomically(
    path.join(inputDirectory, `${shard.shardId}.json`),
    shard
  );
}

const startedAt = new Date().toISOString();
const startedAtMs = Date.now();
const globalDeadlineMs = startedAtMs + plan.budget.maxWallTimeMs;
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
await writeJsonAtomically(path.join(outputRoot, 'result.json'), aggregate);
await writeJsonAtomically(path.join(outputRoot, 'checkpoint.json'), {
  schemaVersion: 1,
  contractName: 'AzPrMachineAxisLocalSearchCheckpoint',
  kind: 'azpr-machine-axis-local-search-checkpoint',
  planId: plan.planId,
  planHash: plan.planHash,
  completedShardResults: shardResults.map(shard => ({
    shardId: shard.shardId,
    status: shard.status,
    resultHash: shard.resultHash ?? null,
  })),
  aggregateHash: aggregate.aggregateHash,
  complete: true,
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
      if (
        result.shardId === shard.shardId &&
        result.planHash === plan.planHash
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

async function readExistingShardResult(shard) {
  const filePath = path.join(resultDirectory, `${shard.shardId}.json`);
  try {
    const result = JSON.parse(await fs.readFile(filePath, 'utf8'));
    const payload = structuredClone(result);
    const declaredResultHash = payload.resultHash;
    delete payload.resultHash;
    if (
      result.shardId === shard.shardId &&
      result.planHash === plan.planHash &&
      result.status === 'complete' &&
      Number(result.summary?.assignedCandidateCount) ===
        shard.candidates.length &&
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
    await writeJsonAtomically(path.join(outputRoot, 'checkpoint.json'), {
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisLocalSearchCheckpoint',
      kind: 'azpr-machine-axis-local-search-checkpoint',
      planId: plan.planId,
      planHash: plan.planHash,
      completedShardResults: completed.map(result => ({
        shardId: result.shardId,
        status: result.status,
        resultHash: result.resultHash ?? null,
      })),
      complete: false,
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
