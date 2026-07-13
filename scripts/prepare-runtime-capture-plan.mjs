import { spawnSync } from 'node:child_process';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createRuntimeSampleCaptureProductionAudit,
  parseWorkbenchRuntimeSampleCaptureFile,
} from '../src/domain/workbenchRuntimeSampleCapture.js';

export const SIX_RESOURCE_CAPTURE_PLAN_SCHEMA_VERSION = 1;
export const SIX_RESOURCE_CAPTURE_PLAN_TYPE =
  'six-resource-runtime-capture-plan';

const REQUIRED_SLOT_IDS = ['team-slot-1', 'team-slot-2', 'team-slot-3'];
const CAPTURE_KINDS = ['role-sp', 'kibo-energy'];
const TEMPLATE_MARKER_PATTERN = /(?:replace|example|template|placeholder)/iu;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseSixResourceCapturePlan(rawPlan, planPath = '.') {
  const source = parseJson(rawPlan);
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('Capture plan must be a JSON object');
  }
  if (
    Number(source.schemaVersion) !== SIX_RESOURCE_CAPTURE_PLAN_SCHEMA_VERSION
  ) {
    throw new Error(
      `Unsupported capture plan schemaVersion: ${source.schemaVersion}`
    );
  }
  if (source.game !== 'azur-promilia') {
    throw new Error('Capture plan game must be azur-promilia');
  }
  if (source.type !== SIX_RESOURCE_CAPTURE_PLAN_TYPE) {
    throw new Error(
      `Capture plan type must be ${SIX_RESOURCE_CAPTURE_PLAN_TYPE}`
    );
  }

  const template = source.template === true;
  const planId = requiredString(source.planId, 'planId');
  const targetId = requiredString(source.targetId, 'targetId');
  const durationSeconds = finiteNumberOrDefault(source.durationSeconds, 30);
  if (durationSeconds < 0) {
    throw new Error('durationSeconds must be zero or positive');
  }
  const planDirectory = dirname(resolve(planPath));
  const outputDirectoryInput = requiredString(
    source.outputDirectory,
    'outputDirectory'
  );
  const outputDirectory = isAbsolute(outputDirectoryInput)
    ? resolve(outputDirectoryInput)
    : resolve(planDirectory, outputDirectoryInput);
  if (!Array.isArray(source.sessions) || source.sessions.length !== 6) {
    throw new Error('Capture plan must contain exactly 6 sessions');
  }

  const sessions = source.sessions.map((session, index) =>
    normalizeSession(session, index, {
      targetId,
      durationSeconds,
      outputDirectory,
    })
  );
  assertUnique(
    sessions,
    session => session.captureSessionId,
    'captureSessionId'
  );
  assertUnique(sessions, session => session.actionId, 'actionId');
  assertUnique(sessions, session => session.outputPath, 'outputFile');

  const sessionsByKind = Object.fromEntries(
    CAPTURE_KINDS.map(captureKind => [
      captureKind,
      sessions.filter(session => session.captureKind === captureKind),
    ])
  );
  for (const captureKind of CAPTURE_KINDS) {
    if (sessionsByKind[captureKind].length !== 3) {
      throw new Error(
        `Capture plan must contain exactly 3 ${captureKind} sessions`
      );
    }
    assertRequiredSlots(sessionsByKind[captureKind], captureKind);
  }
  assertUnique(
    sessionsByKind['role-sp'],
    session => session.actorId,
    'role-sp actorId'
  );
  assertUnique(
    sessionsByKind['kibo-energy'],
    session => session.kiboId,
    'kibo-energy kiboId'
  );

  for (const slotId of REQUIRED_SLOT_IDS) {
    const roleSession = sessionsByKind['role-sp'].find(
      session => session.slotId === slotId
    );
    const kiboSession = sessionsByKind['kibo-energy'].find(
      session => session.slotId === slotId
    );
    if (roleSession.actorId !== kiboSession.actorId) {
      throw new Error(
        `${slotId} owner mismatch: role-sp=${roleSession.actorId}, kibo-energy=${kiboSession.actorId}`
      );
    }
  }

  if (
    !template &&
    [
      planId,
      targetId,
      ...sessions.flatMap(session => [
        session.captureSessionId,
        session.actionId,
        session.actorId,
      ]),
    ].some(value => TEMPLATE_MARKER_PATTERN.test(value))
  ) {
    throw new Error(
      'Non-template capture plan still contains a template marker'
    );
  }

  return {
    schemaVersion: SIX_RESOURCE_CAPTURE_PLAN_SCHEMA_VERSION,
    game: 'azur-promilia',
    type: SIX_RESOURCE_CAPTURE_PLAN_TYPE,
    template,
    planId,
    targetId,
    durationSeconds,
    outputDirectory,
    sessions,
    summary: {
      slotCount: REQUIRED_SLOT_IDS.length,
      roleEnergyOwnerCount: sessionsByKind['role-sp'].length,
      kiboEnergyOwnerCount: sessionsByKind['kibo-energy'].length,
      energyOwnerCount: sessions.length,
    },
  };
}

export async function inspectSixResourceCapturePlan(plan, { pid } = {}) {
  const sessionChecks = [];
  for (const session of plan.sessions) {
    sessionChecks.push(await inspectSessionCapture(session));
  }
  const invalidCount = sessionChecks.filter(
    session => session.status === 'invalid'
  ).length;
  const completedCount = sessionChecks.filter(
    session => session.status === 'complete'
  ).length;
  const pendingCount = sessionChecks.filter(
    session => session.status === 'pending'
  ).length;
  const status = plan.template
    ? 'six-resource-capture-plan-template'
    : invalidCount > 0
      ? 'six-resource-capture-plan-invalid'
      : completedCount === 6
        ? 'six-resource-capture-plan-complete'
        : completedCount > 0
          ? 'six-resource-capture-plan-partial'
          : 'six-resource-capture-plan-ready';
  const commands =
    plan.template || invalidCount > 0
      ? []
      : sessionChecks
          .filter(session => session.status === 'pending')
          .map(session =>
            createCaptureCommand(
              plan.sessions.find(
                item => item.captureSessionId === session.captureSessionId
              ),
              pid
            )
          );

  return {
    schemaVersion: 1,
    status,
    planId: plan.planId,
    targetId: plan.targetId,
    outputDirectory: normalizePath(plan.outputDirectory),
    topology: {
      slotCount: 3,
      roleEnergyOwnerCount: 3,
      kiboEnergyOwnerCount: 3,
      energyOwnerCount: 6,
    },
    summary: {
      sessionCount: sessionChecks.length,
      completedCount,
      pendingCount,
      invalidCount,
    },
    sessions: sessionChecks,
    commands,
    normalizeCommand:
      completedCount === 6 && invalidCount === 0 && !plan.template
        ? createNormalizeCommand(plan)
        : null,
  };
}

function normalizeSession(
  source,
  index,
  { targetId, durationSeconds, outputDirectory }
) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new Error(`sessions[${index}] must be an object`);
  }
  const captureKind = requiredString(
    source.captureKind,
    `sessions[${index}].captureKind`
  );
  if (!CAPTURE_KINDS.includes(captureKind)) {
    throw new Error(
      `sessions[${index}].captureKind must be role-sp or kibo-energy`
    );
  }
  const slotId = requiredString(source.slotId, `sessions[${index}].slotId`);
  const outputFile = requiredString(
    source.outputFile,
    `sessions[${index}].outputFile`
  );
  if (basename(outputFile) !== outputFile || extname(outputFile) !== '.jsonl') {
    throw new Error(
      `sessions[${index}].outputFile must be a plain .jsonl file name`
    );
  }
  const kiboId = positiveIntegerOrNull(source.kiboId);
  if (captureKind === 'kibo-energy' && kiboId == null) {
    throw new Error(`sessions[${index}].kiboId must be a positive integer`);
  }
  if (captureKind === 'role-sp' && source.kiboId != null) {
    throw new Error(`sessions[${index}] role-sp cannot declare kiboId`);
  }
  const sourceElementConfigId = positiveIntegerOrNull(
    source.sourceElementConfigId
  );
  if (source.sourceElementConfigId != null && sourceElementConfigId == null) {
    throw new Error(
      `sessions[${index}].sourceElementConfigId must be a positive integer`
    );
  }
  const sessionDurationSeconds = finiteNumberOrDefault(
    source.durationSeconds,
    durationSeconds
  );
  if (sessionDurationSeconds < 0) {
    throw new Error(
      `sessions[${index}].durationSeconds must be zero or positive`
    );
  }

  return {
    captureSessionId: requiredString(
      source.captureSessionId,
      `sessions[${index}].captureSessionId`
    ),
    captureKind,
    slotId,
    actionId: requiredString(source.actionId, `sessions[${index}].actionId`),
    actorId: requiredString(source.actorId, `sessions[${index}].actorId`),
    targetId,
    kiboId,
    sourceElementConfigId,
    durationSeconds: sessionDurationSeconds,
    outputFile,
    outputPath: resolve(outputDirectory, outputFile),
  };
}

async function inspectSessionCapture(session) {
  let sourceText;
  try {
    sourceText = await readFile(session.outputPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return createSessionCheck(session, 'pending', []);
    }
    throw error;
  }

  const parsed = parseWorkbenchRuntimeSampleCaptureFile(sourceText);
  if (!parsed || parsed.captures.length !== 1) {
    return createSessionCheck(session, 'invalid', [
      'capture-file-must-contain-exactly-one-session',
    ]);
  }
  const capture = parsed.captures[0];
  const binding = capture.binding ?? {};
  const issues = [];
  compareIdentity(
    issues,
    'captureSessionId',
    capture.captureSessionId,
    session.captureSessionId
  );
  compareIdentity(
    issues,
    'captureKind',
    capture.captureKind,
    session.captureKind
  );
  compareIdentity(
    issues,
    'binding.actionId',
    binding.actionId,
    session.actionId
  );
  compareIdentity(issues, 'binding.actorId', binding.actorId, session.actorId);
  compareIdentity(
    issues,
    'binding.targetId',
    binding.targetId,
    session.targetId
  );
  if (session.captureKind === 'kibo-energy') {
    compareIdentity(issues, 'binding.slotId', binding.slotId, session.slotId);
    compareIdentity(
      issues,
      'binding.kiboId',
      Number(binding.kiboId),
      session.kiboId
    );
  }
  if (session.sourceElementConfigId != null) {
    compareIdentity(
      issues,
      'binding.sourceElementConfigId',
      Number(binding.sourceElementConfigId),
      session.sourceElementConfigId
    );
  }
  const productionAudit = createRuntimeSampleCaptureProductionAudit([capture]);
  if (!productionAudit.realCaptureClaimAllowed) {
    issues.push('production-audit-incomplete');
  }
  return {
    ...createSessionCheck(
      session,
      issues.length === 0 ? 'complete' : 'invalid',
      issues
    ),
    productionAudit: productionAudit.captureAudits[0] ?? null,
  };
}

function createSessionCheck(session, status, issues) {
  return {
    captureSessionId: session.captureSessionId,
    captureKind: session.captureKind,
    slotId: session.slotId,
    actorId: session.actorId,
    kiboId: session.kiboId,
    outputPath: normalizePath(session.outputPath),
    status,
    issues,
  };
}

function createCaptureCommand(session, pid) {
  const args = [
    'npm run runtime-capture:capture --',
    `--pid ${pid ?? '<PID>'}`,
    `--output ${quotePowerShell(session.outputPath)}`,
    `--capture-session-id ${quotePowerShell(session.captureSessionId)}`,
    `--capture-kind ${session.captureKind}`,
    `--action-id ${quotePowerShell(session.actionId)}`,
    `--actor-id ${quotePowerShell(session.actorId)}`,
    `--target-id ${quotePowerShell(session.targetId)}`,
  ];
  if (session.captureKind === 'kibo-energy') {
    args.push(`--slot-id ${quotePowerShell(session.slotId)}`);
    args.push(`--kibo-id ${session.kiboId}`);
  }
  if (session.sourceElementConfigId != null) {
    args.push(`--source-element-config-id ${session.sourceElementConfigId}`);
  }
  args.push(`--duration ${session.durationSeconds}`);
  args.push('--confirm-controlled-session');
  return args.join(' ');
}

function createNormalizeCommand(plan, outputPath = null) {
  const normalizedOutputPath =
    outputPath ??
    resolve(plan.outputDirectory, `${plan.planId}.normalized.json`);
  return [
    'npm run runtime-capture:normalize --',
    ...plan.sessions.flatMap(session => [
      '--input',
      quotePowerShell(session.outputPath),
    ]),
    '--output',
    quotePowerShell(normalizedOutputPath),
    '--require-production',
  ].join(' ');
}

function assertRequiredSlots(sessions, captureKind) {
  const actual = sessions.map(session => session.slotId).sort();
  if (actual.join('|') !== [...REQUIRED_SLOT_IDS].sort().join('|')) {
    throw new Error(
      `${captureKind} sessions must cover team-slot-1, team-slot-2, and team-slot-3 exactly once`
    );
  }
}

function assertUnique(items, getValue, label) {
  const seen = new Set();
  for (const item of items) {
    const value = getValue(item);
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function compareIdentity(issues, field, actual, expected) {
  if (actual !== expected) {
    issues.push(`${field}-mismatch`);
  }
}

function requiredString(value, field) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new Error(`${field} is required`);
  }
  return text;
}

function finiteNumberOrDefault(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) {
    throw new Error(`Expected a finite number, received: ${value}`);
  }
  return number;
}

function positiveIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseJson(value) {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function quotePowerShell(value) {
  return `'${String(value).replaceAll(/\u0027/gu, '\u0027\u0027')}'`;
}

function normalizePath(value) {
  return String(value).replaceAll('\\', '/');
}

function parseArguments(args) {
  const options = { normalize: false };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--plan') {
      options.plan = args[index + 1];
      index += 1;
    } else if (argument === '--pid') {
      options.pid = Number(args[index + 1]);
      index += 1;
    } else if (argument === '--normalize') {
      options.normalize = true;
    } else if (argument === '--output') {
      options.output = args[index + 1];
      index += 1;
    } else if (argument === '--require-complete') {
      options.requireComplete = true;
    } else if (argument === '--help') {
      process.stdout.write(
        'Usage: node scripts/prepare-runtime-capture-plan.mjs --plan PATH [--pid PID] [--require-complete] [--normalize --output PATH]\n'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.plan) {
    throw new Error('--plan is required');
  }
  if (
    options.pid != null &&
    (!Number.isInteger(options.pid) || options.pid <= 0)
  ) {
    throw new Error('--pid must be a positive integer');
  }
  if (options.normalize && !options.output) {
    throw new Error('--normalize requires --output');
  }
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const planPath = resolve(options.plan);
  const plan = parseSixResourceCapturePlan(
    await readFile(planPath, 'utf8'),
    planPath
  );
  const inspection = await inspectSixResourceCapturePlan(plan, {
    pid: options.pid,
  });

  if (options.normalize) {
    if (inspection.status !== 'six-resource-capture-plan-complete') {
      process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
      process.exitCode = 2;
      return;
    }
    const outputPath = resolve(options.output);
    await mkdir(dirname(outputPath), { recursive: true });
    const normalizerPath = resolve(
      PROJECT_ROOT,
      'scripts/normalize-runtime-capture.mjs'
    );
    const normalizeRun = spawnSync(
      process.execPath,
      [
        normalizerPath,
        ...plan.sessions.flatMap(session => ['--input', session.outputPath]),
        '--output',
        outputPath,
        '--require-production',
      ],
      { encoding: 'utf8' }
    );
    if (normalizeRun.status !== 0) {
      process.stdout.write(normalizeRun.stdout ?? '');
      process.stderr.write(normalizeRun.stderr ?? '');
      process.exitCode = normalizeRun.status ?? 1;
      return;
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          ...inspection,
          normalizedOutputPath: normalizePath(outputPath),
          normalizer: JSON.parse(normalizeRun.stdout),
        },
        null,
        2
      )}\n`
    );
    return;
  }

  process.stdout.write(`${JSON.stringify(inspection, null, 2)}\n`);
  if (
    inspection.status === 'six-resource-capture-plan-template' ||
    inspection.status === 'six-resource-capture-plan-invalid' ||
    (options.requireComplete &&
      inspection.status !== 'six-resource-capture-plan-complete')
  ) {
    process.exitCode = 2;
  }
}

const isDirectRun =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirectRun) {
  await main();
}
