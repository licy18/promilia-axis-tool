import { describe, expect, it } from 'vitest';
import { createFirstVerticalSliceProject } from '../../domain/fixtures/firstVerticalSlice';
import {
  bindWorkbenchRuntimeSampleCaptures,
  createRuntimeSampleCaptureProductionAudit,
  mergeWorkbenchRuntimeSampleCaptures,
  parseWorkbenchRuntimeSampleCaptureFile,
} from '../../domain/workbenchRuntimeSampleCapture';
import { createRecoverSpRuntimeSampleFixture } from '../../simulation/fixtures/recoverSpRuntimeSampleFixture';

describe('workbench runtime sample capture', () => {
  it('parses direct captures and strict capture envelopes', () => {
    const capture = createRecoverSpRuntimeSampleFixture();

    expect(parseWorkbenchRuntimeSampleCaptureFile(capture)).toMatchObject({
      schemaVersion: 1,
      game: 'azur-promilia',
      type: 'runtime-sample-captures',
      captures: [
        expect.objectContaining({
          captureSessionId: 'fixture-recover-sp-109001081-v1',
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: 'recover-sp-applied' }),
          ]),
        }),
      ],
      summary: {
        captureCount: 1,
        eventCount: 6,
        captureSessionIds: ['fixture-recover-sp-109001081-v1'],
        eventTypes: expect.arrayContaining([
          'recover-sp-args-built',
          'recover-sp-applied',
        ]),
      },
    });
    expect(
      parseWorkbenchRuntimeSampleCaptureFile({
        schemaVersion: 1,
        game: 'azur-promilia',
        type: 'runtime-sample-captures',
        captures: [capture],
      })
    ).not.toBeNull();
    expect(
      parseWorkbenchRuntimeSampleCaptureFile({
        game: 'another-game',
        captures: [capture],
      })
    ).toBeNull();
    expect(
      parseWorkbenchRuntimeSampleCaptureFile({
        captures: [{ captureSessionId: 'broken', events: [{}] }],
      })
    ).toBeNull();
  });

  it('groups JSONL session and event records into capture envelopes', () => {
    const capture = createRecoverSpRuntimeSampleFixture();
    const jsonl = [
      JSON.stringify({
        recordType: 'capture-session',
        captureSessionId: capture.captureSessionId,
        clientRegion: 'TW',
        clientBuild: 'controlled-build',
        source: 'source-game-runtime',
      }),
      ...capture.events.map(event =>
        JSON.stringify({ recordType: 'event', ...event })
      ),
    ].join('\n');

    expect(parseWorkbenchRuntimeSampleCaptureFile(jsonl)).toMatchObject({
      captures: [
        {
          captureSessionId: 'fixture-recover-sp-109001081-v1',
          clientRegion: 'TW',
          clientBuild: 'controlled-build',
          source: 'source-game-runtime',
          events: expect.arrayContaining([
            expect.objectContaining({ eventType: 'recover-sp-applied' }),
          ]),
        },
      ],
      summary: {
        captureCount: 1,
        eventCount: 6,
      },
    });
    expect(
      parseWorkbenchRuntimeSampleCaptureFile(
        `${jsonl}\n{"recordType":"unknown"}`
      )
    ).toBeNull();
  });

  it('does not allow fixture or incomplete captures to claim production provenance', () => {
    const fixture = createRecoverSpRuntimeSampleFixture();
    expect(createRuntimeSampleCaptureProductionAudit([fixture])).toMatchObject({
      status: 'production-runtime-captures-incomplete',
      productionEligibleCaptureCount: 0,
      realCaptureClaimAllowed: false,
    });

    const productionCaptureSessionId = 'controlled-session-20260710-001';
    const productionCapture = {
      ...fixture,
      captureSessionId: productionCaptureSessionId,
      source: 'source-game-runtime',
      clientRegion: 'TW',
      clientBuild: 'controlled-build-20260710',
      captureTool: {
        name: 'controlled-il2cpp-capture',
        version: '1.0.0',
        hookManifestId: 'azpr-tc-20260709-three-value-runtime-capture-v2',
      },
      events: fixture.events.map(event => ({
        ...event,
        captureSessionId: productionCaptureSessionId,
      })),
    };
    expect(
      createRuntimeSampleCaptureProductionAudit([productionCapture])
    ).toMatchObject({
      status: 'production-runtime-captures-ready',
      productionEligibleCaptureCount: 1,
      realCaptureClaimAllowed: true,
      captureAudits: [
        expect.objectContaining({
          productionEligible: true,
          missingEventTypes: [],
          checks: {
            sourceDeclared: true,
            sourceLooksProduction: true,
            clientRegionDeclared: true,
            clientBuildDeclared: true,
            captureToolDeclared: true,
            eventSequenceComplete: true,
            eventTimingComplete: true,
            eventSourceIdentityComplete: true,
            eventValuesComplete: true,
          },
        }),
      ],
    });

    const outOfOrderCapture = {
      ...productionCapture,
      events: [...productionCapture.events],
    };
    [outOfOrderCapture.events[3], outOfOrderCapture.events[4]] = [
      outOfOrderCapture.events[4],
      outOfOrderCapture.events[3],
    ];
    expect(
      createRuntimeSampleCaptureProductionAudit([outOfOrderCapture])
    ).toMatchObject({
      realCaptureClaimAllowed: false,
      captureAudits: [
        {
          recoverSpSequenceOrdered: false,
          checks: { eventSequenceComplete: false },
        },
      ],
    });
  });

  it('accepts an exactly owned kibo readiness observation as a production capture', () => {
    const capture = {
      schemaVersion: 1,
      captureSessionId: 'controlled-kibo-session-1',
      source: 'source-game-runtime-frida-controlled-session',
      clientRegion: 'TW',
      clientBuild: 'controlled-build-20260714',
      captureTool: {
        name: 'promilia-axis-controlled-frida-capture',
        version: '1.0.0',
        hookManifestId: 'azpr-tc-20260709-three-value-runtime-capture-v2',
      },
      events: [
        {
          captureSessionId: 'controlled-kibo-session-1',
          eventType: 'pet-ultimate-cooldown-observed',
          timeMs: 100,
          actorId: 'actor-109001',
          slotId: 'team-slot-1',
          kiboId: 500001,
          petEntityId: 70001,
          petEntityPointer: '0x12345678',
          api: 'PetUltimateCdTime',
          cdTime: 12,
          totalTime: 20,
          ready: false,
        },
      ],
    };

    expect(createRuntimeSampleCaptureProductionAudit([capture])).toMatchObject({
      status: 'production-runtime-captures-ready',
      realCaptureClaimAllowed: true,
      captureAudits: [
        expect.objectContaining({
          requiredEventTypes: ['pet-ultimate-cooldown-observed'],
          missingEventTypes: [],
          productionEligible: true,
        }),
      ],
    });

    delete capture.events[0].slotId;
    expect(createRuntimeSampleCaptureProductionAudit([capture])).toMatchObject({
      realCaptureClaimAllowed: false,
      captureAudits: [
        expect.objectContaining({
          checks: expect.objectContaining({
            eventSourceIdentityComplete: false,
          }),
        }),
      ],
    });

    capture.events[0].slotId = 'team-slot-1';
    capture.events[0].ready = true;
    expect(createRuntimeSampleCaptureProductionAudit([capture])).toMatchObject({
      realCaptureClaimAllowed: false,
      captureAudits: [
        expect.objectContaining({
          checks: expect.objectContaining({ eventValuesComplete: false }),
        }),
      ],
    });
  });

  it('binds a foreign capture to the selected Workbench action and entities', () => {
    const project = createFirstVerticalSliceProject();
    const capture = createRecoverSpRuntimeSampleFixture({
      actionId: 'source-action-77',
      actorId: 'source-role-77',
    });
    const binding = bindWorkbenchRuntimeSampleCaptures({
      captures: [capture],
      project,
      selectedActionId: 'action-0001',
    });

    expect(binding).toMatchObject({
      status: 'runtime-sample-binding-ready',
      rejectedCaptures: [],
      summary: {
        inputCaptureCount: 1,
        boundCaptureCount: 1,
        rejectedCaptureCount: 0,
        boundEventCount: 6,
        actionIds: ['action-0001'],
        actorIds: ['actor-109001'],
        targetIds: ['enemy-300032'],
      },
    });
    expect(binding.captures[0]).toMatchObject({
      actionId: 'action-0001',
      workbenchBinding: {
        status: 'bound-to-workbench-project',
        actionId: 'action-0001',
        actorId: 'actor-109001',
        targetId: 'enemy-300032',
        skillId: 10900101,
        sourceActionIds: ['source-action-77'],
        sourceSkillIds: [10900101],
      },
    });
    expect(binding.captures[0].events[0]).toMatchObject({
      actionId: 'action-0001',
      actorId: 'actor-109001',
      targetId: 'enemy-300032',
      sourceWorkbenchBinding: {
        actionId: 'source-action-77',
        actorId: 'source-role-77',
        targetId: null,
      },
    });
  });

  it('owner-locks kibo observations instead of rewriting drifted identities', () => {
    const baseProject = createFirstVerticalSliceProject();
    const action = baseProject.actions[0];
    const project = {
      ...baseProject,
      metadata: {
        ...baseProject.metadata,
        timelineTopology: {
          actorGroups: [
            {
              slotId: 'team-slot-1',
              actorId: action.actorId,
              kiboLane: { kiboId: 500001 },
              kiboEnergyCurve: { kiboId: 500001 },
            },
          ],
        },
      },
    };
    const createCapture = (eventPatch = {}) => ({
      captureSessionId: 'controlled-kibo-binding-session',
      events: [
        {
          eventType: 'pet-ultimate-cooldown-observed',
          actionId: 'source-kibo-action',
          actorId: action.actorId,
          slotId: 'team-slot-1',
          kiboId: 500001,
          petEntityId: 70001,
          petEntityPointer: '0x12345678',
          api: 'PetUltimateCdTime',
          frameIndex: 30,
          cdTime: 10,
          totalTime: 20,
          ready: false,
          ...eventPatch,
        },
      ],
    });

    const exact = bindWorkbenchRuntimeSampleCaptures({
      captures: [createCapture()],
      project,
      selectedActionId: action.id,
    });
    expect(exact).toMatchObject({
      status: 'runtime-sample-binding-ready',
      summary: { boundCaptureCount: 1, rejectedCaptureCount: 0 },
      rejectedCaptures: [],
    });
    expect(exact.captures[0].events[0]).toMatchObject({
      actorId: action.actorId,
      slotId: 'team-slot-1',
      kiboId: 500001,
      sourceWorkbenchBinding: {
        actionId: 'source-kibo-action',
        actorId: action.actorId,
      },
    });

    const drifted = [
      createCapture({ actorId: 'actor-owner-drift' }),
      createCapture({ slotId: 'team-slot-2' }),
      createCapture({ kiboId: 500002 }),
    ];
    for (const capture of drifted) {
      expect(
        bindWorkbenchRuntimeSampleCaptures({
          captures: [capture],
          project,
          selectedActionId: action.id,
        })
      ).toMatchObject({
        status: 'runtime-sample-binding-rejected',
        summary: { boundCaptureCount: 0, rejectedCaptureCount: 1 },
        rejectedCaptures: [
          expect.objectContaining({
            reason: 'runtime-sample-resource-owner-mismatch',
            resourceOwnerIssues: [
              expect.objectContaining({ reason: expect.any(String) }),
            ],
          }),
        ],
      });
    }

    expect(
      bindWorkbenchRuntimeSampleCaptures({
        captures: [createCapture()],
        project: {
          ...project,
          metadata: { ...project.metadata, timelineTopology: null },
        },
        selectedActionId: action.id,
      })
    ).toMatchObject({
      status: 'runtime-sample-binding-rejected',
      rejectedCaptures: [
        expect.objectContaining({
          reason: 'runtime-sample-resource-owner-topology-missing',
        }),
      ],
    });
  });

  it('rejects ambiguous or skill-mismatched capture binding', () => {
    const project = createFirstVerticalSliceProject();
    const ambiguous = createRecoverSpRuntimeSampleFixture({
      actionId: 'source-action-1',
    });
    ambiguous.events[1].actionId = 'source-action-2';
    const mismatched = createRecoverSpRuntimeSampleFixture({
      actionId: 'source-action-3',
    });
    mismatched.events.find(
      event => event.eventType === 'recover-sp-args-built'
    ).args.skillId = 10100301;
    const exactActionMismatch = createRecoverSpRuntimeSampleFixture();
    exactActionMismatch.events.find(
      event => event.eventType === 'recover-sp-args-built'
    ).args.skillId = 10100301;

    expect(
      bindWorkbenchRuntimeSampleCaptures({
        captures: [ambiguous],
        project,
        selectedActionId: 'action-0001',
      }).rejectedCaptures[0]
    ).toMatchObject({
      reason: 'capture-has-ambiguous-source-actions',
    });
    expect(
      bindWorkbenchRuntimeSampleCaptures({
        captures: [mismatched],
        project,
        selectedActionId: 'action-0001',
      }).rejectedCaptures[0]
    ).toMatchObject({
      reason: 'selected-workbench-action-skill-mismatch',
    });
    expect(
      bindWorkbenchRuntimeSampleCaptures({
        captures: [exactActionMismatch],
        project,
        selectedActionId: 'action-0001',
      }).rejectedCaptures[0]
    ).toMatchObject({
      reason: 'workbench-action-skill-mismatch',
    });
  });

  it('preserves original source identities when a bound capture is rebound', () => {
    const project = createFirstVerticalSliceProject();
    const firstBinding = bindWorkbenchRuntimeSampleCaptures({
      captures: [
        createRecoverSpRuntimeSampleFixture({
          actionId: 'source-action-77',
          actorId: 'source-role-77',
        }),
      ],
      project,
      selectedActionId: 'action-0001',
    });
    const rebound = bindWorkbenchRuntimeSampleCaptures({
      captures: firstBinding.captures,
      project,
      selectedActionId: 'action-0001',
    });

    expect(rebound.captures[0]).toMatchObject({
      workbenchBinding: {
        sourceActionIds: ['source-action-77'],
        sourceSkillIds: [10900101],
      },
    });
    expect(rebound.captures[0].events[0]).toMatchObject({
      sourceWorkbenchBinding: {
        actionId: 'source-action-77',
        actorId: 'source-role-77',
        targetId: null,
      },
    });
  });

  it('replaces reimported capture sessions without duplicating them', () => {
    const current = createRecoverSpRuntimeSampleFixture({
      captureSessionId: 'capture-a',
      spBefore: 10,
    });
    const replacement = createRecoverSpRuntimeSampleFixture({
      captureSessionId: 'capture-a',
      spBefore: 20,
    });
    const appended = createRecoverSpRuntimeSampleFixture({
      captureSessionId: 'capture-b',
    });

    const merged = mergeWorkbenchRuntimeSampleCaptures(
      [current],
      [replacement, appended]
    );

    expect(merged).toHaveLength(2);
    expect(merged.map(capture => capture.captureSessionId)).toEqual([
      'capture-a',
      'capture-b',
    ]);
    expect(
      merged[0].events.find(event => event.eventType === 'recover-sp-applied')
        .spBefore
    ).toBe(20);
  });
});
