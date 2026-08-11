import { randomUUID } from 'node:crypto';
import {
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  unlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { GATE_LEDGER_SCHEMA_VERSION } from './gate-definitions.mjs';
import { canonicalStringify, sha256 } from './gate-fingerprint.mjs';

export const GATE_RECORD_STATUSES = Object.freeze([
  'pass',
  'fail',
  'interrupted',
  'timeout',
  'oom',
  'cancelled',
]);

const DEFAULT_LOCK_STALE_MS = 2 * 60_000;
const DEFAULT_LOCK_WAIT_MS = 15_000;

export function resolveLedgerPaths(repositoryRoot, ledgerPath = null) {
  const root = path.resolve(repositoryRoot);
  const file = ledgerPath
    ? path.resolve(root, ledgerPath)
    : path.join(root, 'work', 'm12-c', 'gates', 'gate-ledger.json');
  const directory = path.dirname(file);
  return {
    file,
    directory,
    lock: path.join(directory, '.gate-ledger.lock'),
    pendingDirectory: path.join(directory, 'pending'),
  };
}

export function createEmptyLedger(now = new Date().toISOString()) {
  return {
    schemaVersion: GATE_LEDGER_SCHEMA_VERSION,
    updatedAt: now,
    records: [],
  };
}

export async function readLedger({
  repositoryRoot,
  ledgerPath = null,
  allowMissing = true,
} = {}) {
  const paths = resolveLedgerPaths(repositoryRoot, ledgerPath);
  let text;
  try {
    text = await readFile(paths.file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' && allowMissing) return createEmptyLedger();
    throw error;
  }
  let ledger;
  try {
    ledger = JSON.parse(text);
  } catch (error) {
    throw new GateLedgerError('gate-ledger-json-invalid', {
      path: paths.file,
      cause: error,
    });
  }
  const validation = validateLedger(ledger);
  if (!validation.valid) {
    throw new GateLedgerError('gate-ledger-schema-invalid', {
      path: paths.file,
      issues: validation.issues,
    });
  }
  return ledger;
}

export function validateLedger(ledger) {
  const issues = [];
  if (ledger?.schemaVersion !== GATE_LEDGER_SCHEMA_VERSION) {
    issues.push(
      `schema-version:${ledger?.schemaVersion ?? 'missing'}!=${GATE_LEDGER_SCHEMA_VERSION}`
    );
  }
  if (!Array.isArray(ledger?.records)) issues.push('records-not-array');
  for (const [index, record] of (ledger?.records ?? []).entries()) {
    if (!record?.recordId) issues.push(`record-${index}-id-missing`);
    if (!record?.gate) issues.push(`record-${index}-gate-missing`);
    if (!GATE_RECORD_STATUSES.includes(record?.status)) {
      issues.push(`record-${index}-status-invalid`);
    }
    if (!['executed', 'reused'].includes(record?.mode)) {
      issues.push(`record-${index}-mode-invalid`);
    }
  }
  return { valid: issues.length === 0, issues };
}

export async function ensureLedger({ repositoryRoot, ledgerPath = null } = {}) {
  const paths = resolveLedgerPaths(repositoryRoot, ledgerPath);
  await mkdir(paths.directory, { recursive: true });
  try {
    return await readLedger({
      repositoryRoot,
      ledgerPath,
      allowMissing: false,
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const ledger = createEmptyLedger();
  await writeLedgerAtomic(paths.file, ledger);
  return ledger;
}

export async function appendLedgerRecord({
  repositoryRoot,
  ledgerPath = null,
  record,
  now = new Date().toISOString(),
} = {}) {
  const [stored] = await appendLedgerRecords({
    repositoryRoot,
    ledgerPath,
    records: [record],
    now,
  });
  return stored;
}

export async function appendLedgerRecords({
  repositoryRoot,
  ledgerPath = null,
  records,
  now = new Date().toISOString(),
} = {}) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new GateLedgerError('gate-record-batch-empty');
  }
  const completeRecords = records.map(prepareLedgerRecord);
  const paths = resolveLedgerPaths(repositoryRoot, ledgerPath);
  return withLedgerLock(paths, async () => {
    const ledger = await ensureLedger({ repositoryRoot, ledgerPath });
    for (const completeRecord of completeRecords) {
      if (
        !ledger.records.some(
          entry => entry.recordId === completeRecord.recordId
        )
      ) {
        ledger.records.push(completeRecord);
      }
    }
    ledger.updatedAt = now;
    await writeLedgerAtomic(paths.file, ledger);
    return completeRecords;
  });
}

export async function beginGateRun({
  repositoryRoot,
  ledgerPath = null,
  gate,
  head,
  workingTreeFingerprint,
  dependencyFingerprint,
  gateDefinitionVersion,
  command,
  context = null,
  startedAt = new Date().toISOString(),
} = {}) {
  const paths = resolveLedgerPaths(repositoryRoot, ledgerPath);
  await mkdir(paths.pendingDirectory, { recursive: true });
  const runId = randomUUID();
  const pending = {
    schemaVersion: 1,
    kind: 'azpr-gate-pending-run',
    runId,
    gate,
    head,
    workingTreeFingerprint,
    dependencyFingerprint,
    gateDefinitionVersion,
    command,
    context,
    status: 'running',
    pid: process.pid,
    hostname: os.hostname(),
    startedAt,
  };
  const file = path.join(paths.pendingDirectory, `${runId}.json`);
  await writeJsonAtomic(file, pending);
  return { ...pending, file };
}

export async function completeGateRun({
  repositoryRoot,
  ledgerPath = null,
  pending,
  status,
  exitCode,
  summary = null,
  stdoutComplete = true,
  reportParseStatus = 'complete',
  details = null,
  finishedAt = new Date().toISOString(),
} = {}) {
  const completion = await completeGateRunWithRecords({
    repositoryRoot,
    ledgerPath,
    pending,
    status,
    exitCode,
    summary,
    stdoutComplete,
    reportParseStatus,
    details,
    finishedAt,
  });
  return completion.record;
}

export async function completeGateRunWithRecords({
  repositoryRoot,
  ledgerPath = null,
  pending,
  status,
  exitCode,
  summary = null,
  stdoutComplete = true,
  reportParseStatus = 'complete',
  details = null,
  finishedAt = new Date().toISOString(),
  relatedRecords = [],
} = {}) {
  const durationMs = Math.max(
    0,
    new Date(finishedAt).getTime() - new Date(pending.startedAt).getTime()
  );
  const record = prepareLedgerRecord({
    runId: pending.runId,
    gate: pending.gate,
    status,
    mode: 'executed',
    head: pending.head,
    workingTreeFingerprint: pending.workingTreeFingerprint,
    dependencyFingerprint: pending.dependencyFingerprint,
    gateDefinitionVersion: pending.gateDefinitionVersion,
    command: pending.command,
    context: pending.context,
    startedAt: pending.startedAt,
    finishedAt,
    durationMs,
    exitCode,
    stdoutComplete,
    reportParseStatus,
    summary,
    details,
  });
  const additional =
    typeof relatedRecords === 'function'
      ? await relatedRecords(record)
      : relatedRecords;
  if (!Array.isArray(additional)) {
    throw new GateLedgerError('gate-related-records-not-array');
  }
  const stored = await appendLedgerRecords({
    repositoryRoot,
    ledgerPath,
    records: [...additional, record],
    now: finishedAt,
  });
  await unlinkIfExists(pending.file);
  return {
    record: stored.at(-1),
    relatedRecords: stored.slice(0, -1),
  };
}

export async function recordGateReuse({
  repositoryRoot,
  ledgerPath = null,
  gate,
  head,
  workingTreeFingerprint,
  dependencyFingerprint,
  gateDefinitionVersion,
  sourceRecord,
  reason,
  now = new Date().toISOString(),
} = {}) {
  return appendLedgerRecord({
    repositoryRoot,
    ledgerPath,
    record: {
      gate,
      status: 'pass',
      mode: 'reused',
      head,
      workingTreeFingerprint,
      dependencyFingerprint,
      gateDefinitionVersion,
      command: sourceRecord.command,
      startedAt: now,
      finishedAt: now,
      durationMs: 0,
      exitCode: null,
      stdoutComplete: true,
      reportParseStatus: sourceRecord.reportParseStatus ?? 'complete',
      summary: sourceRecord.summary ?? null,
      reusedFromRecordId: sourceRecord.recordId,
      reason,
    },
  });
}

export function findReusablePass({
  ledger,
  gate,
  dependencyFingerprint,
  gateDefinitionVersion,
  authority,
}) {
  if (!validateLedger(ledger).valid) return null;
  if (!hasSmartCacheAuthority({ ledger, authority })) return null;
  return (
    [...ledger.records]
      .reverse()
      .find(
        record =>
          record.gate === gate &&
          record.status === 'pass' &&
          record.mode === 'executed' &&
          record.dependencyFingerprint === dependencyFingerprint &&
          record.gateDefinitionVersion === gateDefinitionVersion &&
          record.exitCode === 0 &&
          record.stdoutComplete === true &&
          ['complete', 'unavailable'].includes(record.reportParseStatus) &&
          isReusableExecutionRecord({ ledger, record, authority })
      ) ?? null
  );
}

export function findLatestExecutedRecord(ledger, gate) {
  return (
    [...(ledger?.records ?? [])]
      .reverse()
      .find(record => record.gate === gate && record.mode === 'executed') ??
    null
  );
}

export function hasSmartCacheAuthority({ ledger, authority }) {
  if (!authority) return false;
  return (ledger?.records ?? []).some(record => {
    return (
      record.gate === 'release-verify' &&
      record.status === 'pass' &&
      record.mode === 'executed' &&
      record.exitCode === 0 &&
      record.stdoutComplete === true &&
      record.reportParseStatus === 'complete' &&
      authoritiesMatch(record?.summary?.smartCacheAuthority, authority)
    );
  });
}

export function prepareLedgerRecord(record) {
  assertRecord(record);
  return createCompleteRecord(record);
}

function isReusableExecutionRecord({ ledger, record, authority }) {
  if (record.context === 'release-verify-stage-pass-projection') {
    return isAuthorizedReleaseProjection({ ledger, record, authority });
  }
  if (
    record.context === 'release-extra-formal-gate' ||
    record.context === 'release-trial-release-uncached' ||
    record.context === 'executed-within-test:trial-release'
  ) {
    return false;
  }
  return true;
}

function isAuthorizedReleaseProjection({ ledger, record, authority }) {
  const details = record.details;
  if (details?.evidenceProjection !== 'release-verify-stage-pass-v1') {
    return false;
  }
  const releaseRecord = (ledger.records ?? []).find(
    candidate => candidate.recordId === details.releaseRecordId
  );
  const sourceRecord = (ledger.records ?? []).find(
    candidate => candidate.recordId === details.sourceRecordId
  );
  if (!releaseRecord || !sourceRecord) return false;
  if (
    releaseRecord.gate !== 'release-verify' ||
    releaseRecord.status !== 'pass' ||
    releaseRecord.mode !== 'executed' ||
    releaseRecord.exitCode !== 0 ||
    releaseRecord.stdoutComplete !== true ||
    releaseRecord.reportParseStatus !== 'complete' ||
    !authoritiesMatch(releaseRecord.summary?.smartCacheAuthority, authority)
  ) {
    return false;
  }
  if (
    sourceRecord.gate !== details.sourceGate ||
    sourceRecord.status !== 'pass' ||
    sourceRecord.mode !== 'executed' ||
    sourceRecord.exitCode !== 0 ||
    sourceRecord.stdoutComplete !== true ||
    !['complete', 'unavailable'].includes(sourceRecord.reportParseStatus) ||
    sourceRecord.gateDefinitionVersion !== details.sourceGateDefinitionVersion
  ) {
    return false;
  }
  return (
    record.head === releaseRecord.head &&
    record.head === sourceRecord.head &&
    record.head === details.releaseHead &&
    record.workingTreeFingerprint === releaseRecord.workingTreeFingerprint &&
    record.workingTreeFingerprint === sourceRecord.workingTreeFingerprint &&
    releaseRecord.dependencyFingerprint ===
      details.releaseDependencyFingerprint &&
    sourceRecord.dependencyFingerprint === details.sourceDependencyFingerprint
  );
}

function authoritiesMatch(recorded, authority) {
  return (
    recorded?.fingerprintSchemaVersion ===
      authority?.fingerprintSchemaVersion &&
    recorded?.dependencyMapVersion === authority?.dependencyMapVersion &&
    recorded?.dependencyMapHash === authority?.dependencyMapHash &&
    recorded?.runnerHash === authority?.runnerHash
  );
}

export async function recoverInterruptedRuns({
  repositoryRoot,
  ledgerPath = null,
  staleMs = 24 * 60 * 60_000,
  now = new Date(),
} = {}) {
  const paths = resolveLedgerPaths(repositoryRoot, ledgerPath);
  await mkdir(paths.pendingDirectory, { recursive: true });
  return withLedgerLock(paths, async () => {
    const ledger = await ensureLedger({ repositoryRoot, ledgerPath });
    const pendingFiles = (await readdir(paths.pendingDirectory))
      .filter(file => file.endsWith('.json'))
      .sort();
    const recovered = [];
    for (const name of pendingFiles) {
      const file = path.join(paths.pendingDirectory, name);
      let pending;
      try {
        pending = JSON.parse(await readFile(file, 'utf8'));
      } catch {
        continue;
      }
      if (ledger.records.some(record => record.runId === pending.runId)) {
        await unlinkIfExists(file);
        continue;
      }
      const ageMs = now.getTime() - new Date(pending.startedAt).getTime();
      const sameHost = pending.hostname === os.hostname();
      const alive = sameHost && isProcessAlive(pending.pid);
      if (alive && ageMs <= staleMs) continue;
      const finishedAt = now.toISOString();
      const record = createCompleteRecord({
        runId: pending.runId,
        gate: pending.gate,
        status: 'interrupted',
        mode: 'executed',
        head: pending.head,
        workingTreeFingerprint: pending.workingTreeFingerprint,
        dependencyFingerprint: pending.dependencyFingerprint,
        gateDefinitionVersion: pending.gateDefinitionVersion,
        command: pending.command,
        context: pending.context,
        startedAt: pending.startedAt,
        finishedAt,
        durationMs: Math.max(0, ageMs),
        exitCode: null,
        stdoutComplete: false,
        reportParseStatus: 'invalid',
        summary: null,
        details: {
          recoveredFromPending: true,
          previousPid: pending.pid,
          previousHostname: pending.hostname,
        },
      });
      ledger.records.push(record);
      recovered.push(record);
      await unlinkIfExists(file);
    }
    if (recovered.length) {
      ledger.updatedAt = now.toISOString();
      await writeLedgerAtomic(paths.file, ledger);
    }
    return recovered;
  });
}

export async function writeLedgerAtomic(file, ledger) {
  const validation = validateLedger(ledger);
  if (!validation.valid) {
    throw new GateLedgerError('refusing-to-write-invalid-gate-ledger', {
      path: file,
      issues: validation.issues,
    });
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeJsonAtomic(file, ledger);
}

async function writeJsonAtomic(file, value) {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await rename(temporary, file);
  } catch (error) {
    await unlinkIfExists(temporary);
    throw error;
  }
}

async function withLedgerLock(paths, callback, options = {}) {
  const release = await acquireLedgerLock(paths, options);
  try {
    return await callback();
  } finally {
    await release();
  }
}

async function acquireLedgerLock(
  paths,
  { staleMs = DEFAULT_LOCK_STALE_MS, waitMs = DEFAULT_LOCK_WAIT_MS } = {}
) {
  await mkdir(paths.directory, { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      const handle = await open(paths.lock, 'wx');
      const lock = {
        pid: process.pid,
        hostname: os.hostname(),
        startedAt: new Date().toISOString(),
      };
      await handle.writeFile(`${JSON.stringify(lock)}\n`, 'utf8');
      await handle.close();
      return async () => unlinkIfExists(paths.lock);
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      if (await isStaleLock(paths.lock, staleMs)) {
        await unlinkIfExists(paths.lock);
        continue;
      }
      if (Date.now() - started >= waitMs) {
        throw new GateLedgerError('gate-ledger-lock-timeout', {
          path: paths.lock,
          waitMs,
        });
      }
      await delay(100);
    }
  }
}

async function isStaleLock(file, staleMs) {
  try {
    const lock = JSON.parse(await readFile(file, 'utf8'));
    const ageMs = Date.now() - new Date(lock.startedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs > staleMs) return true;
    if (lock.hostname !== os.hostname()) return false;
    return !isProcessAlive(lock.pid);
  } catch {
    return true;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function createCompleteRecord(record) {
  const recordId =
    record.recordId ??
    sha256(
      canonicalStringify({
        runId: record.runId ?? null,
        gate: record.gate,
        mode: record.mode,
        status: record.status,
        head: record.head,
        dependencyFingerprint: record.dependencyFingerprint,
        startedAt: record.startedAt,
        finishedAt: record.finishedAt,
      })
    );
  return { recordId, ...record };
}

function assertRecord(record) {
  if (!record?.gate) throw new GateLedgerError('gate-record-name-missing');
  if (!GATE_RECORD_STATUSES.includes(record?.status)) {
    throw new GateLedgerError('gate-record-status-invalid', {
      status: record?.status,
    });
  }
  if (!['executed', 'reused'].includes(record?.mode)) {
    throw new GateLedgerError('gate-record-mode-invalid', {
      mode: record?.mode,
    });
  }
}

async function unlinkIfExists(file) {
  try {
    await unlink(file);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export class GateLedgerError extends Error {
  constructor(code, details = {}) {
    super(code, details.cause ? { cause: details.cause } : undefined);
    this.name = 'GateLedgerError';
    this.code = code;
    this.details = details;
  }
}
