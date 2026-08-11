import { spawn, spawnSync } from 'node:child_process';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

import {
  parseGateResult,
  createNpmStageTracker,
} from './gate-result-parser.mjs';
import {
  appendLedgerRecord,
  beginGateRun,
  completeGateRun,
  recordGateReuse,
} from './gate-ledger.mjs';
import { resolveCommandInvocation } from './node-package-invocation.mjs';

const CAPTURE_LIMIT = 16 * 1024 * 1024;

export async function runGate({
  repositoryRoot,
  ledgerPath = null,
  definition,
  fingerprint,
  snapshot,
  context = 'smart-gate',
  tee = true,
  commandRunner = runCommandStep,
  logDirectory = null,
} = {}) {
  if (!definition?.command) {
    throw new Error(
      `Gate ${definition?.name ?? '<unknown>'} has no executable command`
    );
  }
  const command = formatCommandSteps(definition.command.steps);
  const pending = await beginGateRun({
    repositoryRoot,
    ledgerPath,
    gate: definition.name,
    head: snapshot.head,
    workingTreeFingerprint: snapshot.workingTreeFingerprint,
    dependencyFingerprint: fingerprint.dependencyFingerprint,
    gateDefinitionVersion: definition.version,
    command,
    context,
  });
  const logFile = logDirectory
    ? path.join(logDirectory, `${pending.runId}-${definition.name}.log`)
    : null;
  if (logFile) await mkdir(path.dirname(logFile), { recursive: true });
  const startedAtMs = Date.now();
  const stepResults = [];
  let finalStatus = 'pass';
  let finalExitCode = 0;
  let stdoutComplete = true;
  let combinedOutput = '';
  try {
    for (const step of definition.command.steps) {
      const result = await commandRunner({
        repositoryRoot,
        step,
        timeoutMs: definition.command.timeoutMs,
        tee,
        logFile,
        environment: {
          AZPR_GATE_BASE: snapshot.base ?? snapshot.head,
          AZPR_GATE_CHANGED_FILES: JSON.stringify(snapshot.changedFiles ?? []),
        },
      });
      stepResults.push(result);
      combinedOutput = appendRing(combinedOutput, result.output, CAPTURE_LIMIT);
      if (result.status !== 'pass') {
        finalStatus = result.status;
        finalExitCode = result.exitCode;
        stdoutComplete = result.stdoutComplete;
        break;
      }
    }
    const parsed = parseGateResult(definition.parser, combinedOutput, {
      stageTimeline: stepResults.flatMap(result => result.stageTimeline ?? []),
    });
    const summary =
      stepResults.length <= 1
        ? parsed.summary
        : {
            aggregate: parsed.summary,
            steps: stepResults.map(result => ({
              command: result.command,
              status: result.status,
              exitCode: result.exitCode,
              durationMs: result.durationMs,
              summary: result.parsed?.summary ?? null,
            })),
          };
    const record = await completeGateRun({
      repositoryRoot,
      ledgerPath,
      pending,
      status: finalStatus,
      exitCode: finalExitCode,
      summary,
      stdoutComplete,
      reportParseStatus: parsed.reportParseStatus,
      details: {
        context,
        commands: stepResults.map(result => result.command),
        failedCommand:
          stepResults.find(result => result.status !== 'pass')?.command ?? null,
        failureTail:
          finalStatus === 'pass' ? null : combinedOutput.slice(-8_000),
      },
    });
    return {
      gate: definition.name,
      status: finalStatus,
      exitCode: finalExitCode,
      durationMs: Date.now() - startedAtMs,
      summary,
      record,
      output: combinedOutput,
      stepResults,
      reportParseStatus: parsed.reportParseStatus,
      stdoutComplete,
    };
  } catch (error) {
    const record = await completeGateRun({
      repositoryRoot,
      ledgerPath,
      pending,
      status: 'interrupted',
      exitCode: null,
      summary: null,
      stdoutComplete: false,
      reportParseStatus: 'invalid',
      details: {
        context,
        error: serializeError(error),
        failureTail: combinedOutput.slice(-8_000),
      },
    });
    return {
      gate: definition.name,
      status: 'interrupted',
      exitCode: null,
      durationMs: Date.now() - startedAtMs,
      summary: null,
      record,
      output: combinedOutput,
      stepResults,
      reportParseStatus: 'invalid',
      stdoutComplete: false,
      error,
    };
  }
}

export async function executeSmartGatePlan({
  repositoryRoot,
  ledgerPath = null,
  plan,
  fingerprints,
  snapshot,
  tee = true,
  gateRunner = runGate,
  onDecision = null,
} = {}) {
  const results = [];
  const resultByGate = new Map();
  for (const decision of plan.decisions) {
    onDecision?.(decision);
    if (decision.decision === 'reuse') {
      const record = await recordGateReuse({
        repositoryRoot,
        ledgerPath,
        gate: decision.gate,
        head: snapshot.head,
        workingTreeFingerprint: snapshot.workingTreeFingerprint,
        dependencyFingerprint: decision.dependencyFingerprint,
        gateDefinitionVersion: decision.definition.version,
        sourceRecord: decision.reusable,
        reason: decision.reasons.join('; '),
      });
      const result = {
        gate: decision.gate,
        status: 'pass',
        mode: 'reused',
        record,
      };
      results.push(result);
      resultByGate.set(decision.gate, result);
      continue;
    }
    if (decision.decision !== 'run') continue;
    const result = await gateRunner({
      repositoryRoot,
      ledgerPath,
      definition: decision.definition,
      fingerprint: fingerprints.get(decision.gate),
      snapshot,
      context: plan.integration
        ? 'integration-smart-gate'
        : 'development-smart-gate',
      tee,
      logDirectory: path.join(repositoryRoot, 'work', 'm12-c', 'gates', 'logs'),
    });
    results.push({ ...result, mode: 'executed' });
    resultByGate.set(decision.gate, result);
    if (result.status !== 'pass') {
      return {
        status: 'fail',
        exitCode: result.exitCode ?? 1,
        failedGate: decision.gate,
        results,
      };
    }
    await recordCoveredDecisions({
      repositoryRoot,
      ledgerPath,
      plan,
      parentDecision: decision,
      parentResult: result,
      fingerprints,
      snapshot,
      results,
      resultByGate,
    });
  }
  return { status: 'pass', exitCode: 0, failedGate: null, results };
}

export async function runCommandStep({
  repositoryRoot,
  step,
  timeoutMs,
  tee = true,
  logFile = null,
  environment = {},
} = {}) {
  const invocation = resolveCommandInvocation(step.file, step.args);
  const command = formatCommand(step);
  const tracker = createNpmStageTracker();
  const startedAt = Date.now();
  let output = '';
  let stdoutComplete = false;
  let timedOut = false;
  let spawnError = null;
  let lineBuffer = '';
  let logWrite = Promise.resolve();
  const child = spawn(invocation.file, invocation.args, {
    cwd: repositoryRoot,
    env: { ...process.env, ...environment },
    shell: false,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const timer = setTimeout(() => {
    timedOut = true;
    terminateChildTree(child);
  }, timeoutMs);
  const consume = (chunk, stream) => {
    const text = chunk.toString('utf8');
    output = appendRing(output, text, CAPTURE_LIMIT);
    if (tee) stream.write(chunk);
    if (logFile) {
      logWrite = logWrite.then(() => appendFile(logFile, chunk));
    }
    lineBuffer += text;
    const lines = lineBuffer.split(/\r?\n/u);
    lineBuffer = lines.pop() ?? '';
    for (const line of lines) tracker.observe(line);
  };
  child.stdout.on('data', chunk => consume(chunk, process.stdout));
  child.stderr.on('data', chunk => consume(chunk, process.stderr));
  child.on('error', error => {
    spawnError = error;
  });
  const close = await new Promise(resolve => {
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  clearTimeout(timer);
  await logWrite;
  if (lineBuffer) tracker.observe(lineBuffer);
  stdoutComplete = spawnError == null;
  const stageTimeline = tracker.finish();
  const status = classifyCommandStatus({
    output,
    exitCode: close.exitCode,
    signal: close.signal,
    timedOut,
    spawnError,
  });
  const parsed = parseGateResult(
    step.args.includes('test:e2e:production-preview')
      ? 'playwright'
      : inferParser(step),
    output,
    { stageTimeline }
  );
  return {
    command,
    status,
    exitCode: close.exitCode,
    signal: close.signal,
    timedOut,
    stdoutComplete,
    durationMs: Date.now() - startedAt,
    output,
    stageTimeline,
    parsed,
    error: spawnError,
  };
}

function classifyCommandStatus({
  output,
  exitCode,
  signal,
  timedOut,
  spawnError,
}) {
  if (timedOut) return 'timeout';
  if (/heap out of memory|allocation failed|javascript heap/iu.test(output)) {
    return 'oom';
  }
  if (spawnError) return 'interrupted';
  if (signal) return 'cancelled';
  return exitCode === 0 ? 'pass' : 'fail';
}

async function recordCoveredDecisions({
  repositoryRoot,
  ledgerPath,
  plan,
  parentDecision,
  parentResult,
  fingerprints,
  snapshot,
  results,
  resultByGate,
}) {
  const covered = plan.decisions.filter(
    decision =>
      decision.decision === 'covered' &&
      decision.coveredBy === parentDecision.gate
  );
  for (const decision of covered) {
    const parsed = parseGateResult(
      decision.definition.parser,
      parentResult.output
    );
    const record = await appendLedgerRecord({
      repositoryRoot,
      ledgerPath,
      record: {
        gate: decision.gate,
        status: 'pass',
        mode: 'executed',
        head: snapshot.head,
        workingTreeFingerprint: snapshot.workingTreeFingerprint,
        dependencyFingerprint: fingerprints.get(decision.gate)
          .dependencyFingerprint,
        gateDefinitionVersion: decision.definition.version,
        command: `${formatCommandSteps(parentDecision.definition.command.steps)} [covers ${decision.gate}]`,
        context: `covered-by:${parentDecision.gate}`,
        startedAt: parentResult.record.startedAt,
        finishedAt: parentResult.record.finishedAt,
        durationMs: parentResult.durationMs,
        exitCode: 0,
        stdoutComplete: parentResult.stdoutComplete,
        reportParseStatus: parsed.reportParseStatus,
        summary: parsed.summary,
        details: { coveredBy: parentDecision.gate },
      },
    });
    const result = {
      gate: decision.gate,
      status: 'pass',
      mode: 'executed-covered',
      coveredBy: parentDecision.gate,
      record,
    };
    results.push(result);
    resultByGate.set(decision.gate, result);
  }
}

export function formatCommandSteps(steps) {
  return steps.map(formatCommand).join(' -> ');
}

export function formatCommand(step) {
  return [step.file, ...step.args].map(quoteArgument).join(' ');
}

function quoteArgument(value) {
  const text = String(value);
  return /[\s"']/u.test(text) ? JSON.stringify(text) : text;
}

function inferParser(step) {
  if (
    step.args.includes('vitest') ||
    step.args.some(arg => arg.startsWith('test:'))
  ) {
    return 'vitest';
  }
  if (step.args.includes('build')) return 'vite-build';
  return 'audit';
}

function terminateChildTree(child) {
  if (child.exitCode != null || child.pid == null) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
  } else {
    child.kill('SIGTERM');
  }
}

function appendRing(existing, next, limit) {
  const combined = `${existing}${next}`;
  return combined.length <= limit ? combined : combined.slice(-limit);
}

function serializeError(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code ?? null,
    stack: error?.stack ?? null,
  };
}
