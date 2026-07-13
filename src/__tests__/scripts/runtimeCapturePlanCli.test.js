import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createSixResourceCapturePlanFromWorkbenchProject,
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

    const missingKibo = createWorkbenchProject();
    missingKibo.actorConfigs[2].loadout.kiboId = null;
    expect(() =>
      createSixResourceCapturePlanFromWorkbenchProject(missingKibo, {
        planId: 'controlled-missing-kibo',
        outputDirectory: './captures',
      })
    ).toThrow('team-slot-3 does not have a bound kibo');

    const mismatchedKiboAction = createWorkbenchProject();
    mismatchedKiboAction.actionDrafts.find(
      action => action.id === 'kibo-action-2'
    ).kiboId = 500099;
    expect(() =>
      createSixResourceCapturePlanFromWorkbenchProject(mismatchedKiboAction, {
        planId: 'controlled-kibo-action-mismatch',
        outputDirectory: './captures',
      })
    ).toThrow(
      'team-slot-2 kibo-energy requires exactly one compatible action; candidates=none'
    );

    const futureProject = createWorkbenchProject();
    futureProject.schemaVersion = 17;
    expect(() =>
      createSixResourceCapturePlanFromWorkbenchProject(futureProject, {
        planId: 'controlled-future-project',
        outputDirectory: './captures',
      })
    ).toThrow('Workbench project identity is invalid or unsupported');
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

  it('creates a six-owner plan from a Workbench project and requires explicit ambiguous actions', async () => {
    const directory = await createTemporaryDirectory();
    const projectPath = join(directory, 'workbench-project.json');
    const planPath = join(directory, 'capture-plan.json');
    const project = createWorkbenchProject();
    project.actionDrafts.push({
      id: 'role-action-1-later',
      type: 'skill',
      skillId: 10900102,
      actorCharacterId: 109001,
      startMs: 9000,
    });
    await writeFile(projectPath, JSON.stringify(project), 'utf8');

    const scriptPath = resolve('scripts/prepare-runtime-capture-plan.mjs');
    const baseArguments = [
      scriptPath,
      '--from-project',
      projectPath,
      '--write-plan',
      planPath,
      '--capture-directory',
      './controlled-captures',
      '--plan-id',
      'controlled-project-six-resource',
      '--pid',
      '4321',
    ];
    const ambiguousRun = spawnSync(process.execPath, baseArguments, {
      encoding: 'utf8',
    });
    expect(ambiguousRun.status).toBe(1);
    expect(ambiguousRun.stderr).toContain(
      'team-slot-1 role-sp requires exactly one compatible action'
    );
    expect(ambiguousRun.stderr).toContain(
      '--role-action team-slot-1=ACTION_ID'
    );

    const createdRun = spawnSync(
      process.execPath,
      [...baseArguments, '--role-action', 'team-slot-1=role-action-1-later'],
      { encoding: 'utf8' }
    );
    expect(createdRun.status).toBe(0);
    expect(JSON.parse(createdRun.stdout)).toMatchObject({
      status: 'six-resource-capture-plan-created-from-project',
      projectBinding: {
        selectedCharacterIds: [109001, 101003, 101007],
        selectedKiboIds: [500001, 500002, 500003],
        selectedEnemyId: 300032,
      },
      inspection: {
        status: 'six-resource-capture-plan-ready',
        topology: { energyOwnerCount: 6 },
        summary: { pendingCount: 6 },
      },
    });
    const plan = JSON.parse(await readFile(planPath, 'utf8'));
    expect(plan).toMatchObject({
      type: 'six-resource-runtime-capture-plan',
      template: false,
      targetId: 'enemy-300032',
      sessions: expect.arrayContaining([
        expect.objectContaining({
          captureKind: 'role-sp',
          slotId: 'team-slot-1',
          actionId: 'role-action-1-later',
          actorId: 'actor-109001',
        }),
        expect.objectContaining({
          captureKind: 'role-sp',
          slotId: 'team-slot-2',
        }),
        expect.objectContaining({
          captureKind: 'role-sp',
          slotId: 'team-slot-3',
        }),
        expect.objectContaining({
          captureKind: 'kibo-energy',
          slotId: 'team-slot-1',
          actorId: 'actor-109001',
          kiboId: 500001,
        }),
      ]),
    });
    expect(plan.sessions).toHaveLength(6);
    expect(
      JSON.parse(createdRun.stdout).inspection.commands.every(command =>
        command.includes('--pid 4321')
      )
    ).toBe(true);

    const overwriteRun = spawnSync(
      process.execPath,
      [...baseArguments, '--role-action', 'team-slot-1=role-action-1-later'],
      { encoding: 'utf8' }
    );
    expect(overwriteRun.status).toBe(1);
    expect(overwriteRun.stderr).toContain('Capture plan output already exists');
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

function createWorkbenchProject() {
  const characters = [109001, 101003, 101007];
  return {
    schemaVersion: 16,
    game: 'azur-promilia',
    type: 'workbench-project',
    exportedAt: '2026-07-14T00:00:00.000Z',
    selection: {
      characterId: characters[0],
      secondaryCharacterId: characters[1],
      enemyId: 300032,
      skillId: 10900101,
    },
    teamSlots: characters.map((characterId, index) => ({
      slotId: `team-slot-${index + 1}`,
      position: index,
      characterId,
    })),
    actorConfigs: characters.map((characterId, index) => ({
      characterId,
      loadout: { kiboId: 500001 + index },
    })),
    actionDrafts: characters.flatMap((characterId, index) => [
      {
        id: `role-action-${index + 1}`,
        type: 'skill',
        skillId: Number(`${characterId}01`),
        actorCharacterId: characterId,
        startMs: index * 1000,
      },
      {
        id: `kibo-action-${index + 1}`,
        type: 'kiboEvent',
        actorCharacterId: characterId,
        startMs: 5000 + index * 1000,
        kiboId: 500001 + index,
      },
    ]),
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
