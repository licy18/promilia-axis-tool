import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  inspectSixResourceCapturePlan,
  parseSixResourceCapturePlan,
} from '../../../scripts/prepare-runtime-capture-plan.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map(directory => rm(directory, { recursive: true, force: true }))
  );
});

describe('six-resource runtime capture plan', () => {
  it('preflights three role and three kibo owners and renders isolated commands', async () => {
    const directory = await createTemporaryDirectory();
    const planPath = join(directory, 'capture-plan.json');
    const plan = parseSixResourceCapturePlan(createPlan(), planPath);
    const inspection = await inspectSixResourceCapturePlan(plan, { pid: 4321 });

    expect(plan.summary).toEqual({
      slotCount: 3,
      roleEnergyOwnerCount: 3,
      kiboEnergyOwnerCount: 3,
      energyOwnerCount: 6,
    });
    expect(inspection).toMatchObject({
      status: 'six-resource-capture-plan-ready',
      topology: {
        slotCount: 3,
        roleEnergyOwnerCount: 3,
        kiboEnergyOwnerCount: 3,
        energyOwnerCount: 6,
      },
      summary: {
        sessionCount: 6,
        completedCount: 0,
        pendingCount: 6,
        invalidCount: 0,
      },
    });
    expect(inspection.commands).toHaveLength(6);
    expect(inspection.commands[0]).toContain('--capture-kind role-sp');
    expect(inspection.commands[0]).toContain('--pid 4321');
    expect(inspection.commands[0]).not.toContain('--kibo-id');
    expect(inspection.commands[3]).toContain('--capture-kind kibo-energy');
    expect(inspection.commands[3]).toContain('--slot-id');
    expect(inspection.commands[3]).toContain('--kibo-id 500001');
  });

  it('rejects owner drift, duplicate kibo identities, and executable placeholders', () => {
    const ownerDrift = createPlan();
    ownerDrift.sessions[3].actorId = 'actor-101003';
    expect(() =>
      parseSixResourceCapturePlan(ownerDrift, 'capture-plan.json')
    ).toThrow('team-slot-1 owner mismatch');

    const duplicateKibo = createPlan();
    duplicateKibo.sessions[4].kiboId = 500001;
    expect(() =>
      parseSixResourceCapturePlan(duplicateKibo, 'capture-plan.json')
    ).toThrow('Duplicate kibo-energy kiboId: 500001');

    const placeholder = createPlan();
    placeholder.sessions[0].actionId = 'replace-action';
    expect(() =>
      parseSixResourceCapturePlan(placeholder, 'capture-plan.json')
    ).toThrow('Non-template capture plan still contains a template marker');
  });

  it('accepts six production captures and normalizes them as one guarded batch', async () => {
    const directory = await createTemporaryDirectory();
    const planPath = join(directory, 'capture-plan.json');
    const outputPath = join(directory, 'six-resource.normalized.json');
    const sourcePlan = createPlan();
    const plan = parseSixResourceCapturePlan(sourcePlan, planPath);

    await mkdir(plan.outputDirectory, { recursive: true });
    await Promise.all(
      plan.sessions.map(session =>
        writeFile(
          session.outputPath,
          JSON.stringify(createProductionCapture(session)),
          'utf8'
        )
      )
    );
    await writeFile(planPath, JSON.stringify(sourcePlan), 'utf8');

    const inspection = await inspectSixResourceCapturePlan(plan);
    expect(inspection).toMatchObject({
      status: 'six-resource-capture-plan-complete',
      summary: {
        completedCount: 6,
        pendingCount: 0,
        invalidCount: 0,
      },
    });
    expect(inspection.normalizeCommand).toContain('--require-production');

    const driftSession = plan.sessions[3];
    const driftCapture = createProductionCapture(driftSession);
    driftCapture.binding.actorId = 'actor-101003';
    await writeFile(
      driftSession.outputPath,
      JSON.stringify(driftCapture),
      'utf8'
    );
    expect(await inspectSixResourceCapturePlan(plan)).toMatchObject({
      status: 'six-resource-capture-plan-invalid',
      summary: { invalidCount: 1 },
      commands: [],
    });
    await writeFile(
      driftSession.outputPath,
      JSON.stringify(createProductionCapture(driftSession)),
      'utf8'
    );

    const scriptPath = resolve('scripts/prepare-runtime-capture-plan.mjs');
    const normalizedRun = spawnSync(
      process.execPath,
      [scriptPath, '--plan', planPath, '--normalize', '--output', outputPath],
      { encoding: 'utf8' }
    );
    expect(normalizedRun.status).toBe(0);
    expect(JSON.parse(normalizedRun.stdout)).toMatchObject({
      status: 'six-resource-capture-plan-complete',
      normalizer: {
        inputFileCount: 6,
        captureCount: 6,
        realCaptureClaimAllowed: true,
      },
    });
    const normalized = JSON.parse(await readFile(outputPath, 'utf8'));
    expect(normalized.summary.captureCount).toBe(6);
    expect(normalized.provenanceAudit.realCaptureClaimAllowed).toBe(true);
  });
});

async function createTemporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), 'promilia-capture-plan-'));
  temporaryDirectories.push(directory);
  return directory;
}

function createPlan() {
  const actors = ['actor-109001', 'actor-101003', 'actor-101007'];
  return {
    schemaVersion: 1,
    game: 'azur-promilia',
    type: 'six-resource-runtime-capture-plan',
    template: false,
    planId: 'controlled-six-resource-001',
    targetId: 'enemy-300032',
    durationSeconds: 30,
    outputDirectory: './captures',
    sessions: [
      ...actors.map((actorId, index) => ({
        captureSessionId: `controlled-role-${index + 1}`,
        captureKind: 'role-sp',
        slotId: `team-slot-${index + 1}`,
        actionId: `role-action-${index + 1}`,
        actorId,
        sourceElementConfigId:
          Number(actorId.slice('actor-'.length)) * 1000 + 81,
        outputFile: `role-slot-${index + 1}.jsonl`,
      })),
      ...actors.map((actorId, index) => ({
        captureSessionId: `controlled-kibo-${index + 1}`,
        captureKind: 'kibo-energy',
        slotId: `team-slot-${index + 1}`,
        actionId: `kibo-action-${index + 1}`,
        actorId,
        kiboId: 500001 + index,
        outputFile: `kibo-slot-${index + 1}.jsonl`,
      })),
    ],
  };
}

function createProductionCapture(session) {
  const common = {
    schemaVersion: 1,
    captureSessionId: session.captureSessionId,
    source: 'source-game-runtime-frida-controlled-session',
    clientRegion: 'TW',
    clientBuild: 'controlled-build-20260714',
    captureKind: session.captureKind,
    binding: {
      actionId: session.actionId,
      actorId: session.actorId,
      targetId: session.targetId,
      slotId: session.captureKind === 'kibo-energy' ? session.slotId : null,
      kiboId: session.kiboId,
      sourceElementConfigId: session.sourceElementConfigId,
    },
    captureTool: {
      name: 'promilia-axis-controlled-frida-capture',
      version: '1.1.0',
      hookManifestId: 'azpr-tc-20260709-three-value-runtime-capture-v2',
    },
  };
  if (session.captureKind === 'kibo-energy') {
    return {
      ...common,
      events: [
        {
          captureSessionId: session.captureSessionId,
          eventType: 'pet-ultimate-cooldown-observed',
          frameIndex: 60,
          actionId: session.actionId,
          actorId: session.actorId,
          targetId: session.targetId,
          slotId: session.slotId,
          kiboId: session.kiboId,
          petEntityId: 70000 + session.kiboId,
          petEntityPointer: '0x12345678',
          api: 'PetUltimateCdTime',
          cdTime: 10,
          totalTime: 20,
          ready: false,
        },
      ],
    };
  }
  const eventTypes = [
    'recover-sp-modifier-property-read',
    'recover-sp-args-built',
    'recover-sp-ontransmit-12f',
    'recover-sp-applied',
    'recover-sp-share-rebroadcast',
  ];
  return {
    ...common,
    events: eventTypes.map((eventType, index) => ({
      captureSessionId: session.captureSessionId,
      eventType,
      frameIndex: 60 + index,
      actionId: session.actionId,
      actorId: session.actorId,
      targetId: session.targetId,
      sourceElementConfigId: session.sourceElementConfigId,
    })),
  };
}
