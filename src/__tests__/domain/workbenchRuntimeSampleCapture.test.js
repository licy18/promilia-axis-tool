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
      captureKind: 'role-sp',
      binding: {
        actionId: 'action-0001',
        actorId: 'actor-109001',
        targetId: 'enemy-300032',
        slotId: null,
        kiboId: null,
        sourceElementConfigId: 109001081,
      },
      captureTool: {
        name: 'controlled-il2cpp-capture',
        version: '1.1.0',
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
          checks: expect.objectContaining({
            sourceDeclared: true,
            sourceLooksProduction: true,
            clientRegionDeclared: true,
            clientBuildDeclared: true,
            captureToolDeclared: true,
            captureScopeDeclared: true,
            captureScopeMatchesEvents: true,
            captureBindingComplete: true,
            eventSequenceComplete: true,
            eventTimingComplete: true,
            eventSourceIdentityComplete: true,
            eventValuesComplete: true,
          }),
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

    expect(
      createRuntimeSampleCaptureProductionAudit([
        { ...productionCapture, captureKind: 'all' },
      ])
    ).toMatchObject({
      realCaptureClaimAllowed: false,
      captureAudits: [
        expect.objectContaining({
          captureKind: 'all',
          checks: expect.objectContaining({
            captureScopeDeclared: false,
            captureScopeMatchesEvents: false,
          }),
        }),
      ],
    });
  });

  it('fails toughness production provenance on loss, duplicates, thread switches, missing frames or incomplete session end', () => {
    const capture = createProductionToughnessCapture();
    expect(createRuntimeSampleCaptureProductionAudit([capture])).toMatchObject({
      status: 'production-runtime-captures-ready',
      realCaptureClaimAllowed: true,
      captureAudits: [
        expect.objectContaining({
          productionEligible: true,
          missingEventTypes: [],
          toughnessSequenceAudit: expect.objectContaining({
            captureSequenceComplete: true,
            frameClockComplete: true,
            hookInvocationComplete: true,
            sourceCorrelationComplete: true,
            threadConsistencyComplete: true,
            sessionIntegrityComplete: true,
          }),
        }),
      ],
    });

    const breakEndStateWriteCapture = structuredClone(capture);
    for (const event of breakEndStateWriteCapture.events.filter(
      row => row.eventType === 'toughness-weak-state-write'
    )) {
      event.eventIdentity = `${capture.captureSessionId}|hook-event|${event.hookInvocationIdentity}`;
      event.sourceSequencePath = [];
      event.damagePacketSequence = null;
      event.damageElementPointer = null;
      event.sourceElementConfigId = null;
    }
    expect(
      createRuntimeSampleCaptureProductionAudit([breakEndStateWriteCapture])
    ).toMatchObject({
      realCaptureClaimAllowed: true,
      captureAudits: [
        expect.objectContaining({
          checks: expect.objectContaining({
            toughnessSourceCorrelationComplete: true,
          }),
        }),
      ],
    });

    const cases = [
      {
        name: 'lost capture sequence',
        mutate(value) {
          value.events[4].captureSequence += 1;
        },
        check: 'toughnessCaptureSequenceComplete',
      },
      {
        name: 'duplicate hook row',
        mutate(value) {
          value.events[5] = {
            ...value.events[4],
            captureSequence: value.events[5].captureSequence,
          };
        },
        check: 'toughnessHookInvocationComplete',
      },
      {
        name: 'packet thread switch',
        mutate(value) {
          value.events[8].threadId = 12;
        },
        check: 'toughnessThreadConsistencyComplete',
      },
      {
        name: 'packet source path drift',
        mutate(value) {
          value.events[8].sourceSequencePath = [99];
        },
        check: 'toughnessSourceCorrelationComplete',
      },
      {
        name: 'hook method identity drift',
        mutate(value) {
          value.events[4].hookMethodKey = 'FormulaUtility.GetOutputRealDamage';
        },
        check: 'toughnessHookInvocationComplete',
      },
      {
        name: 'missing client frame',
        mutate(value) {
          value.events[3].clientFrameCount = null;
        },
        check: 'toughnessFrameClockComplete',
      },
      {
        name: 'missing session end',
        mutate(value) {
          delete value.captureIntegrity;
        },
        check: 'toughnessSessionIntegrityComplete',
      },
      {
        name: 'agent diagnostic',
        mutate(value) {
          value.captureIntegrity.diagnosticCount = 1;
          value.captureIntegrity.diagnostics = [
            { kind: 'agent-status', status: 'capture-agent-stack-mismatch' },
          ];
        },
        check: 'toughnessSessionIntegrityComplete',
      },
      {
        name: 'agent damage packet count mismatch',
        mutate(value) {
          value.captureIntegrity.damagePacketCount = 2;
        },
        check: 'toughnessSessionIntegrityComplete',
      },
      {
        name: 'agent hook invocation count underflow',
        mutate(value) {
          value.captureIntegrity.hookInvocationCount = 8;
        },
        check: 'toughnessSessionIntegrityComplete',
      },
    ];

    for (const { name, mutate, check } of cases) {
      const tampered = structuredClone(capture);
      mutate(tampered);
      const audit = createRuntimeSampleCaptureProductionAudit([tampered]);
      expect(audit, name).toMatchObject({
        realCaptureClaimAllowed: false,
        captureAudits: [
          expect.objectContaining({
            productionEligible: false,
            checks: expect.objectContaining({ [check]: false }),
          }),
        ],
      });
    }
  });

  it('accepts an exactly owned kibo readiness observation as a production capture', () => {
    const capture = {
      schemaVersion: 1,
      captureSessionId: 'controlled-kibo-session-1',
      source: 'source-game-runtime-frida-controlled-session',
      clientRegion: 'TW',
      clientBuild: 'controlled-build-20260714',
      captureKind: 'kibo-energy',
      binding: {
        actionId: 'kibo-action-1',
        actorId: 'actor-109001',
        targetId: 'enemy-300032',
        slotId: 'team-slot-1',
        kiboId: 500001,
        sourceElementConfigId: null,
      },
      captureTool: {
        name: 'promilia-axis-controlled-frida-capture',
        version: '1.1.0',
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
      actions: [
        ...baseProject.actions,
        {
          id: 'kibo-action-1',
          type: 'kiboEvent',
          actorId: action.actorId,
          kiboId: 500001,
        },
      ],
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
      summary: {
        boundCaptureCount: 1,
        rejectedCaptureCount: 0,
        actionIds: ['kibo-action-1'],
        bindingKinds: ['resource-owner-action'],
      },
      rejectedCaptures: [],
    });
    expect(exact.captures[0].events[0]).toMatchObject({
      actionId: 'kibo-action-1',
      actorId: action.actorId,
      slotId: 'team-slot-1',
      kiboId: 500001,
      sourceWorkbenchBinding: {
        actionId: 'source-kibo-action',
        actorId: action.actorId,
      },
    });
    expect(exact.captures[0].workbenchBinding).toMatchObject({
      actionId: 'kibo-action-1',
      resolutionKind: 'resource-owner-action',
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

  it('binds a six-resource capture batch to each unique owner action', () => {
    const actorIds = ['actor-1', 'actor-2', 'actor-3'];
    const skillIds = [1001, 1002, 1003];
    const kiboIds = [500001, 500002, 500003];
    const project = {
      actions: actorIds.flatMap((actorId, index) => [
        {
          id: `role-action-${index + 1}`,
          type: 'skill',
          actorId,
          skillId: skillIds[index],
        },
        {
          id: `kibo-action-${index + 1}`,
          type: 'kiboEvent',
          actorId,
          kiboId: kiboIds[index],
        },
      ]),
      enemy: { id: 'enemy-1' },
      metadata: {
        timelineTopology: {
          actorGroups: actorIds.map((actorId, index) => ({
            slotId: `team-slot-${index + 1}`,
            actorId,
            kiboEnergyCurve: { kiboId: kiboIds[index] },
          })),
        },
      },
    };
    const captures = [
      ...actorIds.map((actorId, index) => ({
        captureSessionId: `role-capture-${index + 1}`,
        events: [
          {
            eventType: 'recover-sp-applied',
            actionId: `source-role-action-${index + 1}`,
            actorId,
            roleEntityId: `role-entity-${index + 1}`,
            frameIndex: 60 * (index + 1),
            sourceElementConfigId: 900001 + index,
            spBefore: 10,
            spAfter: 11,
            spDeltaApplied: 1,
            args: { skillId: skillIds[index], delta: 1 },
          },
        ],
      })),
      ...actorIds.map((actorId, index) => ({
        captureSessionId: `kibo-capture-${index + 1}`,
        events: [
          {
            eventType: 'pet-ultimate-cooldown-observed',
            actionId: `source-kibo-action-${index + 1}`,
            actorId,
            slotId: `team-slot-${index + 1}`,
            kiboId: kiboIds[index],
            petEntityId: 70001 + index,
            petEntityPointer: `0x${(0x12345678 + index).toString(16)}`,
            api: 'PetUltimateCdTime',
            frameIndex: 180 * index,
            cdTime: 10 - index * 5,
            totalTime: 20,
            ready: index === 2,
          },
        ],
      })),
    ];

    const binding = bindWorkbenchRuntimeSampleCaptures({
      captures,
      project,
      selectedActionId: 'role-action-1',
    });

    expect(binding).toMatchObject({
      status: 'runtime-sample-binding-ready',
      rejectedCaptures: [],
      summary: {
        inputCaptureCount: 6,
        boundCaptureCount: 6,
        rejectedCaptureCount: 0,
        actorIds,
        bindingKinds: ['resource-owner-action'],
      },
    });
    expect(binding.summary.actionIds).toEqual([
      'role-action-1',
      'role-action-2',
      'role-action-3',
      'kibo-action-1',
      'kibo-action-2',
      'kibo-action-3',
    ]);
    expect(
      binding.captures.map(capture => [
        capture.captureSessionId,
        capture.workbenchBinding.actionId,
        capture.workbenchBinding.actorId,
        capture.workbenchBinding.resolutionKind,
      ])
    ).toEqual([
      ['role-capture-1', 'role-action-1', 'actor-1', 'resource-owner-action'],
      ['role-capture-2', 'role-action-2', 'actor-2', 'resource-owner-action'],
      ['role-capture-3', 'role-action-3', 'actor-3', 'resource-owner-action'],
      ['kibo-capture-1', 'kibo-action-1', 'actor-1', 'resource-owner-action'],
      ['kibo-capture-2', 'kibo-action-2', 'actor-2', 'resource-owner-action'],
      ['kibo-capture-3', 'kibo-action-3', 'actor-3', 'resource-owner-action'],
    ]);

    const drifted = structuredClone(captures);
    drifted[5].events[0].actorId = 'actor-owner-drift';
    expect(
      bindWorkbenchRuntimeSampleCaptures({
        captures: drifted,
        project,
        selectedActionId: 'role-action-1',
      })
    ).toMatchObject({
      status: 'runtime-sample-binding-partial',
      summary: {
        inputCaptureCount: 6,
        boundCaptureCount: 5,
        rejectedCaptureCount: 1,
      },
      rejectedCaptures: [
        expect.objectContaining({
          captureSessionId: 'kibo-capture-3',
          reason: 'runtime-sample-resource-owner-mismatch',
        }),
      ],
    });

    const ambiguousProject = {
      ...project,
      actions: [
        ...project.actions,
        {
          id: 'role-action-2-duplicate',
          type: 'skill',
          actorId: 'actor-2',
          skillId: 1002,
        },
      ],
    };
    expect(
      bindWorkbenchRuntimeSampleCaptures({
        captures: [captures[1]],
        project: ambiguousProject,
        selectedActionId: 'role-action-1',
      })
    ).toMatchObject({
      status: 'runtime-sample-binding-rejected',
      rejectedCaptures: [
        expect.objectContaining({
          reason: 'resource-owner-action-ambiguous',
          resourceOwnerActorIds: ['actor-2'],
          candidateActionIds: ['role-action-2', 'role-action-2-duplicate'],
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

function createProductionToughnessCapture() {
  const captureSessionId = 'controlled-toughness-session-1';
  const packetIdentity = `${captureSessionId}|damage-element|1|9001`;
  const packetBase = {
    captureSessionId,
    timeMs: 100,
    actionId: 'controlled-toughness-probe',
    actorId: 'actor-112001',
    targetId: 'enemy-300032',
    sourceElementConfigId: 112001081,
    damageElementPointer: '0x12345678',
    eventIdentity: packetIdentity,
    sourceSequencePath: [1],
    damagePacketSequence: 1,
    clientFrameCount: 600,
    clientDeltaTimeSeconds: 1 / 60,
    threadId: 11,
  };
  const events = [];
  const addPacketEvent = (
    eventType,
    hookNumber,
    hookMethodKey,
    phase = null,
    extra = {}
  ) => {
    events.push({
      ...packetBase,
      eventType,
      hookInvocationIdentity: `${captureSessionId}|hook|${hookNumber}`,
      hookMethodKey,
      ...(phase ? { phase } : {}),
      ...extra,
    });
  };
  addPacketEvent(
    'toughness-packet-execution',
    1,
    'DamageElement.Execute',
    'entry'
  );
  addPacketEvent(
    'toughness-weak-state-read',
    2,
    'ControlProperty.get_inWeakState',
    null,
    { inWeakState: false }
  );
  addPacketEvent(
    'toughness-break-property-read',
    3,
    'AliveProperty.get_breakDmgUp',
    null,
    { propertyId: 221, floatValue: 1 }
  );
  addPacketEvent(
    'toughness-hp-output-calculated',
    4,
    'FormulaUtility.GetOutputDamage',
    'entry'
  );
  addPacketEvent(
    'toughness-hp-output-calculated',
    4,
    'FormulaUtility.GetOutputDamage',
    'exit',
    { outputDamage: 100 }
  );
  addPacketEvent(
    'toughness-damage-applied',
    5,
    'AliveProperty.SetWeaknessPoint',
    'set-weakness-point-entry',
    { toughnessBefore: 1 }
  );
  addPacketEvent(
    'toughness-damage-applied',
    5,
    'AliveProperty.SetWeaknessPoint',
    'set-weakness-point-exit',
    { toughnessBefore: 1, toughnessAfter: 0, toughnessDeltaApplied: 1 }
  );
  addPacketEvent(
    'toughness-weak-state-write',
    6,
    'ControlProperty.SetWeakState',
    'entry',
    { weakStateBefore: 0, requestedWeakState: 1 }
  );
  addPacketEvent(
    'toughness-weak-state-write',
    6,
    'ControlProperty.SetWeakState',
    'exit',
    { weakStateBefore: 0, weakStateAfter: 1 }
  );
  addPacketEvent(
    'toughness-hp-change-dispatch',
    7,
    'FormulaUtility.ChangeHP',
    'entry',
    { requestedHpChange: -100 }
  );
  addPacketEvent(
    'toughness-hp-change-dispatch',
    7,
    'FormulaUtility.ChangeHP',
    'exit',
    { changed: true, requestedHpChange: -100 }
  );
  addPacketEvent(
    'toughness-hp-applied',
    8,
    'AliveProperty.SetHpByHurt',
    'set-hp-by-hurt-entry',
    { hpBefore: 1000, requestedHpAfter: 900 }
  );
  addPacketEvent(
    'toughness-hp-applied',
    8,
    'AliveProperty.SetHpByHurt',
    'set-hp-by-hurt-exit',
    { hpBefore: 1000, hpAfter: 900, hpDeltaApplied: 100 }
  );
  events.push({
    ...packetBase,
    eventType: 'toughness-state-update',
    methodKey: 'WeakBreakSystem.OnUpdate_LocalControlled',
    phase: 'entry',
    eventIdentity: `${captureSessionId}|state-update|9`,
    sourceSequencePath: [],
    damageElementPointer: null,
    sourceElementConfigId: null,
    hookInvocationIdentity: `${captureSessionId}|hook|9`,
    hookMethodKey: 'WeakBreakSystem.OnUpdate_LocalControlled',
  });
  events.push({
    ...events.at(-1),
    phase: 'exit',
  });
  addPacketEvent(
    'toughness-packet-execution',
    1,
    'DamageElement.Execute',
    'exit'
  );
  events.forEach((event, index) => {
    event.captureSequence = index + 1;
  });

  return {
    schemaVersion: 1,
    captureSessionId,
    source: 'source-game-runtime-frida-controlled-session',
    clientRegion: 'TW',
    clientBuild: 'il2cpp-tc-catch-20260709:c60d13795629',
    captureKind: 'toughness',
    binding: {
      actionId: 'controlled-toughness-probe',
      actorId: 'actor-112001',
      targetId: 'enemy-300032',
      slotId: null,
      kiboId: null,
      sourceElementConfigId: 112001081,
    },
    captureTool: {
      name: 'promilia-axis-controlled-frida-capture',
      version: '1.2.0',
      hookManifestId: 'azpr-tc-20260709-three-value-runtime-capture-v3',
    },
    captureIntegrity: {
      captureSessionId,
      status: 'capture-complete',
      agentEmittedEventCount: events.length,
      hostReceivedEventCount: events.length,
      finalCaptureSequence: events.length,
      damagePacketCount: 1,
      hookInvocationCount: 9,
      openThreadStateCount: 0,
      diagnosticCount: 0,
      diagnostics: [],
      completedAt: '2026-08-09T00:00:00.000Z',
    },
    events,
  };
}
