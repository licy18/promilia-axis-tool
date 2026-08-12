import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import authorityFixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import mitiFixture from '../../../fixtures/character-acceptance/108003-visual.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import rubyOwnerContract from '../../data/generated/character-combat-owner-contracts/103002.json';
import kiboActionCatalog from '../../data/generated/workbench-kibo-action-catalog.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  createMachineAxisService,
  MachineAxisValidationError,
} from '../../machine-axis/machineAxisService';
import { createMachineAxisObjectiveContract } from '../../machine-axis/machineAxisObjectiveContract';
import { createSearchStateSnapshot } from '../../machine-axis/machineAxisSearchState';

const PANGPANG_PLUNGING_HIT = '10100711|0|elements|0|-6537565703316603243|35|1';

function createMitiProjectileFixture() {
  const axis = structuredClone(mitiFixture);
  // The visual-acceptance fixture predates the verified normal-input authority.
  // Keep it as historical evidence, but isolate this projectile test from its
  // legacy repeated-A1 and switch-tail actions instead of treating that axis as
  // a current replay authority.
  axis.actions = axis.actions.filter(
    action =>
      action.intent?.actionKind !== 'normal-attack' &&
      action.intent?.kind !== 'switch' &&
      !['miti-star-combo-active', 'miti-star-combo-kibo-break'].includes(
        action.id
      )
  );
  return axis;
}

function createVerifiedThreeActorFixture() {
  return structuredClone(authorityFixture);
}

function createAxis({
  critical = { policy: 'non-critical', seed: null },
  hitOverrides = {},
  actions = null,
} = {}) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxis',
    dataIdentity: {
      verifiedMechanicsPackageId: mechanicsPackage.packageId,
      verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
      mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
      mechanicsProfileVersion: 1,
    },
    scenario: {
      id: 'machine-axis-service-test',
      name: 'Machine Axis Service Test',
      fps: 60,
      durationFrames: 7200,
      team: [
        {
          slotId: 'slot-1',
          characterId: 101007,
          initialSp: 50,
          loadout: {},
        },
        {
          slotId: 'slot-2',
          characterId: 101010,
          initialSp: 50,
          loadout: {},
        },
        {
          slotId: 'slot-3',
          characterId: 103002,
          initialSp: 50,
          loadout: {},
        },
      ],
      enemy: { enemyId: 300032 },
      initialRuntimeState: {},
      critical,
      projectile: {
        targetDistance: 0,
        defaultWillHit: true,
      },
    },
    actions: actions ?? [
      {
        id: 'pangpang-plunging',
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 10100701,
          actionKind: 'plunging-attack',
        },
        schedule: { mode: 'absolute', frame: 60 },
        hitOverrides,
      },
    ],
  };
}

function createMoyinNormalAction({
  id,
  sequenceIndex,
  frame,
  groupId,
  contextActionId = null,
}) {
  return {
    id,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: 11200101,
      actionKind: 'normal-attack',
      attackInput: {
        sequenceIndex,
        groupId,
        ...(contextActionId == null ? {} : { contextActionId }),
      },
    },
    schedule: { mode: 'absolute', frame },
  };
}

function createMoyinContinuationAxis(actions) {
  const axis = createAxis({ actions });
  axis.scenario.team[0] = {
    ...axis.scenario.team[0],
    characterId: 112001,
    loadout: {},
  };
  return axis;
}

function createOwnerNormalAttackAxis(ownerId, segmentCount) {
  const mapping = mechanicsPackage.actionMappings.find(
    candidate =>
      Number(candidate.ownerId) === Number(ownerId) &&
      candidate.actionKind === 'normal-attack'
  );
  const actions = [];
  let frame = 0;
  for (
    let sequenceIndex = 1;
    sequenceIndex <= segmentCount;
    sequenceIndex += 1
  ) {
    const previous = actions.at(-1);
    actions.push({
      id: `owner-${ownerId}-a${sequenceIndex}`,
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: Number(mapping.sourceSkillId),
        actionKind: 'normal-attack',
        attackInput: {
          sequenceIndex,
          groupId: `owner-${ownerId}-chain`,
          ...(previous ? { contextActionId: previous.id } : {}),
        },
      },
      schedule: { mode: 'absolute', frame },
    });
    const segment = mapping.attackInputSegments.find(
      candidate => Number(candidate.sequenceIndex) === sequenceIndex
    );
    if (sequenceIndex < segmentCount) {
      frame += Number(segment.linkWindow.startFrame);
    }
  }
  const axis = createAxis({ actions });
  axis.scenario.team[0] = {
    ...axis.scenario.team[0],
    characterId: Number(ownerId),
    loadout: {},
  };
  return axis;
}

function createStarbornContextContinuationAxis({ ownerId, sourceKind }) {
  const sourceActionId = `starborn-${ownerId}-${sourceKind}-source`;
  const sourceFrame = 0;
  const thrustFrame = sourceKind === 'charged-attack' ? 73 : 65;
  const continuationGroupId = `starborn-${ownerId}-${sourceKind}-context-form`;
  const sourceAction = {
    id: sourceActionId,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId:
        sourceKind === 'charged-attack'
          ? ownerId * 100 + 1
          : ownerId * 100 + 12,
      actionKind: sourceKind,
      ...(sourceKind === 'charged-attack'
        ? {
            semanticVariant: {
              selectorIdentity: `starborn-${ownerId}-derived-charged`,
              publicVariantIndex: 1,
            },
          }
        : {}),
    },
    schedule: { mode: 'absolute', frame: sourceFrame },
  };
  const thrust = {
    id: `starborn-${ownerId}-${sourceKind}-thrust`,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: ownerId * 100 + 1,
      actionKind: 'normal-attack',
      attackInput: {
        sequenceIndex: 1,
        groupId: continuationGroupId,
        contextActionId: sourceActionId,
      },
    },
    schedule: { mode: 'absolute', frame: thrustFrame },
  };
  const a3 = {
    id: `starborn-${ownerId}-${sourceKind}-a3`,
    owner: { kind: 'actor', slotId: 'slot-1' },
    intent: {
      kind: 'public-action',
      publicActionId: ownerId * 100 + 1,
      actionKind: 'normal-attack',
      attackInput: {
        sequenceIndex: 3,
        groupId: continuationGroupId,
        contextActionId: thrust.id,
      },
    },
    schedule: { mode: 'absolute', frame: thrustFrame + 32 },
  };
  const axis = createAxis({ actions: [sourceAction, thrust, a3] });
  axis.scenario.team[0] = {
    ...axis.scenario.team[0],
    characterId: Number(ownerId),
    loadout: {},
  };
  return axis;
}

function createKiboAxis({
  publicActionId = 50000102,
  actionKind = 'signature',
  currentValue = 100,
} = {}) {
  const axis = createAxis({
    actions: [
      {
        id: `kibo-${actionKind}`,
        owner: { kind: 'kibo', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId,
          actionKind,
          level: 1,
        },
        schedule: { mode: 'absolute', frame: 0 },
      },
    ],
  });
  axis.scenario.team[0].loadout = { kiboId: 500001 };
  axis.scenario.initialRuntimeState = {
    kiboEnergyBySlot: [
      {
        slotId: 'slot-1',
        actorId: 'actor-101007',
        characterId: 101007,
        kiboId: 500001,
        kiboName: '迅狼',
        currentValue,
        maxValue: 100,
      },
    ],
  };
  return axis;
}

describe('Machine Axis service', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('runs a real public Pangpang plunging attack through the canonical core', () => {
    const service = createMachineAxisService();
    const run = service.simulate(createAxis());
    const action = run.trace.actions.find(
      item => item.id === 'pangpang-plunging'
    );
    const hit = run.trace.damage.find(
      item => item.actionId === 'pangpang-plunging'
    );

    expect(action).toMatchObject({
      skillId: 10100701,
      actionKind: 'plunging-attack',
      subSkillIndex: 0,
    });
    expect(hit).toMatchObject({
      hitIdentity: PANGPANG_PLUNGING_HIT,
      rawDamage: expect.any(Number),
      toughnessDamage: expect.any(Number),
    });
    expect(run.hashes).toMatchObject({
      input: expect.any(String),
      data: expect.any(String),
      trace: expect.any(String),
      evaluation: expect.any(String),
    });
  }, 30_000);

  it('enforces Moyin normal-input continuation and recovery boundaries before scoring', () => {
    const service = createMachineAxisService();
    const opener = createMoyinNormalAction({
      id: 'moyin-a1',
      sequenceIndex: 1,
      frame: 0,
      groupId: 'moyin-chain',
    });
    const createPair = secondAction =>
      createMoyinContinuationAxis([opener, secondAction]);
    const createSuccessor = frame =>
      createMoyinNormalAction({
        id: `moyin-a2-${frame}`,
        sequenceIndex: 2,
        frame,
        groupId: 'moyin-chain',
        contextActionId: opener.id,
      });

    for (const frame of [18, 72]) {
      const prepared = service.prepareValidated(
        createPair(createSuccessor(frame))
      );
      expect(prepared.valid, `A2@${frame}`).toBe(true);
      expect(
        prepared.run.trace.actions.find(
          action => action.id === `moyin-a2-${frame}`
        )
      ).toMatchObject({
        controlSkillId: 11200102,
      });
    }

    const invalidCases = [
      {
        label: 'early-a2',
        action: createSuccessor(17),
        reason: 'normal-attack-successor-window-not-open',
      },
      {
        label: 'fresh-a1-in-successor-window',
        action: createMoyinNormalAction({
          id: 'moyin-illegal-a1-18',
          sequenceIndex: 1,
          frame: 18,
          groupId: 'fresh-chain-at-18',
        }),
        reason: 'normal-attack-successor-window-target-conflict',
      },
      {
        label: 'a1-during-recovery',
        action: createMoyinNormalAction({
          id: 'moyin-illegal-a1-73',
          sequenceIndex: 1,
          frame: 73,
          groupId: 'fresh-chain-at-73',
        }),
        reason: 'normal-attack-recovery-not-complete',
      },
      {
        label: 'a1-before-recovery-end',
        action: createMoyinNormalAction({
          id: 'moyin-illegal-a1-229',
          sequenceIndex: 1,
          frame: 229,
          groupId: 'fresh-chain-at-229',
        }),
        reason: 'normal-attack-recovery-not-complete',
      },
    ];
    for (const { label, action, reason } of invalidCases) {
      const prepared = service.prepareValidated(createPair(action));
      expect(prepared.valid, label).toBe(false);
      expect(prepared.issues, label).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-action-not-executable',
          actionId: action.id,
          reason: 'verified-normal-attack-input-phase-conflict',
          reasons: expect.arrayContaining([reason]),
          formIdentity: expect.stringMatching(/^normal-attack-form:/),
          expectedAttackInput: expect.any(Object),
          actualAttackInput: expect.objectContaining({
            sequenceIndex: action.intent.attackInput.sequenceIndex,
          }),
        })
      );
      expect(
        prepared.run.trace.executionPlan.actions.find(
          row => row.actionId === action.id
        )
      ).toMatchObject({ execute: false });
      expect(
        prepared.run.trace.damage.some(event => event.actionId === action.id)
      ).toBe(false);
      expect(prepared.actionLegalityProof).toMatchObject({
        passed: false,
        finalScoreEligible: false,
      });
    }

    const reopened = service.prepareValidated(
      createPair(
        createMoyinNormalAction({
          id: 'moyin-a1-230',
          sequenceIndex: 1,
          frame: 230,
          groupId: 'fresh-chain-at-230',
        })
      )
    );
    expect(reopened.valid).toBe(true);
    expect(reopened.actionLegalityProof).toMatchObject({
      passed: true,
      finalScoreEligible: true,
    });
  }, 30_000);

  it.each([
    [109001, 5, 10900105],
    [199001, 5, 19900105],
    [199002, 5, 19900205],
  ])(
    'keeps owner %s structural normal inputs executable across %s segments',
    (ownerId, segmentCount, finalControlSkillId) => {
      const prepared = createMachineAxisService().prepareValidated(
        createOwnerNormalAttackAxis(ownerId, segmentCount)
      );

      expect(prepared.valid, JSON.stringify(prepared.issues)).toBe(true);
      expect(prepared.actionLegalityProof).toMatchObject({
        passed: true,
        finalScoreEligible: true,
      });
      expect(
        prepared.run.trace.actions.find(
          action => action.id === `owner-${ownerId}-a${segmentCount}`
        )
      ).toMatchObject({ controlSkillId: finalControlSkillId });
      expect(
        prepared.compilation.actionResolutions.map(resolution => ({
          actionId: resolution.actionId,
          variantResolutionStatus: resolution.variantResolutionStatus,
        }))
      ).toEqual(
        Array.from({ length: segmentCount }, (_, index) => ({
          actionId: `owner-${ownerId}-a${index + 1}`,
          variantResolutionStatus: 'verified-action-variant-selection-ready',
        }))
      );
      if (ownerId === 199001 || ownerId === 199002) {
        expect(
          prepared.run.trace.events.some(
            event =>
              event.type === 'DAMAGE_SKIPPED' &&
              event.actionId === `owner-${ownerId}-a1`
          )
        ).toBe(false);
      }
    },
    30_000
  );

  it.each([
    [199001, 'charged-attack'],
    [199001, 'star-skill'],
    [199002, 'charged-attack'],
    [199002, 'star-skill'],
  ])(
    'materializes STARBORN %s %s context thrust before the default normal chain',
    (ownerId, sourceKind) => {
      const prepared = createMachineAxisService().prepareValidated(
        createStarbornContextContinuationAxis({ ownerId, sourceKind })
      );
      const thrustId = `starborn-${ownerId}-${sourceKind}-thrust`;
      const a3Id = `starborn-${ownerId}-${sourceKind}-a3`;

      expect(prepared.valid, JSON.stringify(prepared.issues)).toBe(true);
      expect(prepared.actionLegalityProof).toMatchObject({
        passed: true,
        finalScoreEligible: true,
      });
      expect(
        prepared.run.trace.actions.find(action => action.id === thrustId)
      ).toMatchObject({
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 1,
      });
      expect(
        prepared.run.trace.actions.find(action => action.id === a3Id)
      ).toMatchObject({
        controlSkillId: ownerId * 100 + 3,
        subSkillIndex: 0,
      });
      expect(
        prepared.compilation.actionResolutions.find(
          resolution => resolution.actionId === thrustId
        )
      ).toMatchObject({
        resolvedControlSkillId: ownerId * 100 + 1,
        resolvedSubSkillIndex: 1,
        variantResolutionStatus: 'verified-action-variant-selection-ready',
      });
    },
    30_000
  );

  it.each([199001, 199002])(
    'fails STARBORN %s contextual normal forms closed for missing owner, group, and sequence authority',
    ownerId => {
      const service = createMachineAxisService();
      const createChargedAxis = () =>
        createStarbornContextContinuationAxis({
          ownerId,
          sourceKind: 'charged-attack',
        });

      const missing = createChargedAxis();
      missing.actions[1].intent.attackInput.contextActionId = 'missing-source';
      expect(service.validate(missing).issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-normal-attack-context-action-missing',
          actionId: missing.actions[1].id,
        })
      );

      const crossActor = createChargedAxis();
      crossActor.actions[0].owner = { kind: 'actor', slotId: 'slot-2' };
      expect(service.validate(crossActor).issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-normal-attack-context-owner-conflict',
          actionId: crossActor.actions[1].id,
        })
      );

      const wrongGroup = createChargedAxis();
      wrongGroup.actions[2].intent.attackInput.groupId = 'forged-other-group';
      expect(service.validate(wrongGroup).issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-normal-attack-context-group-conflict',
          actionId: wrongGroup.actions[2].id,
        })
      );

      const wrongSequence = createChargedAxis();
      wrongSequence.actions[1].intent.attackInput.sequenceIndex = 2;
      expect(service.validate(wrongSequence).issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-normal-attack-context-window-conflict',
          actionId: wrongSequence.actions[1].id,
        })
      );
    },
    30_000
  );

  it('materializes the verified Misa A1-to-A4 prefix with source-backed projectile impacts', () => {
    const prepared = createMachineAxisService().prepareValidated(
      createOwnerNormalAttackAxis(107002, 4)
    );

    expect(prepared.valid).toBe(true);
    expect(prepared.actionLegalityProof).toMatchObject({
      status: 'axis-action-legality-passed',
      passed: true,
      finalScoreEligible: true,
      scoreExclusionCodes: [],
    });
    expect(
      prepared.compilation.actionResolutions.map(resolution => ({
        actionId: resolution.actionId,
        controlSkillId: resolution.resolvedControlSkillId,
        variantResolutionStatus: resolution.variantResolutionStatus,
      }))
    ).toEqual([
      {
        actionId: 'owner-107002-a1',
        controlSkillId: 10700201,
        variantResolutionStatus: 'verified-action-variant-selection-ready',
      },
      {
        actionId: 'owner-107002-a2',
        controlSkillId: 10700202,
        variantResolutionStatus: 'verified-action-variant-selection-ready',
      },
      {
        actionId: 'owner-107002-a3',
        controlSkillId: 10700203,
        variantResolutionStatus: 'verified-action-variant-selection-ready',
      },
      {
        actionId: 'owner-107002-a4',
        controlSkillId: 10700204,
        variantResolutionStatus: 'verified-action-variant-selection-ready',
      },
    ]);
    expect(
      prepared.issues.filter(issue =>
        ['owner-107002-a2', 'owner-107002-a3', 'owner-107002-a4'].includes(
          issue.actionId
        )
      )
    ).not.toContainEqual(
      expect.objectContaining({
        reason: 'verified-normal-attack-input-phase-conflict',
      })
    );
    expect(
      prepared.warnings.some(warning =>
        [
          'machine-axis-variant-resolution-open',
          'machine-axis-damage-skipped',
        ].includes(warning.code)
      )
    ).toBe(false);
    expect(
      prepared.run.trace.events.filter(
        event =>
          event.type === 'DAMAGE_SKIPPED' &&
          ['owner-107002-a1', 'owner-107002-a2'].includes(event.actionId)
      )
    ).toEqual([]);
    expect(
      Object.fromEntries(
        ['owner-107002-a1', 'owner-107002-a2'].map(actionId => [
          actionId,
          prepared.run.trace.damage.filter(event => event.actionId === actionId)
            .length,
        ])
      )
    ).toEqual({
      'owner-107002-a1': 2,
      'owner-107002-a2': 8,
    });

    const formalAxis = createOwnerNormalAttackAxis(107002, 4);
    formalAxis.scenario.objectiveContract = createMachineAxisObjectiveContract(
      'cycle-dps-no-toughness'
    );
    const formalPrepared =
      createMachineAxisService().prepareValidated(formalAxis);
    expect(formalPrepared.valid).toBe(true);
    expect(formalPrepared.actionLegalityProof).toMatchObject({
      passed: true,
      finalScoreEligible: true,
    });
  }, 30_000);

  it('rejects a fresh Sifliya A1 at frame 19 with the exact normal-input violation', () => {
    const axis = createOwnerNormalAttackAxis(107001, 1);
    axis.actions.push({
      id: 'owner-107001-fresh-a1-19',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10700101,
        actionKind: 'normal-attack',
        attackInput: {
          sequenceIndex: 1,
          groupId: 'owner-107001-fresh-chain',
          contextActionId: 'owner-107001-a1',
        },
      },
      schedule: { mode: 'absolute', frame: 19 },
    });
    const prepared = createMachineAxisService().prepareValidated(axis);

    expect(prepared.valid).toBe(false);
    expect(prepared.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-action-not-executable',
        actionId: 'owner-107001-fresh-a1-19',
        reason: 'verified-normal-attack-input-phase-conflict',
        reasons: ['normal-attack-successor-window-not-open'],
        violationCodes: ['VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT'],
      })
    );
  }, 30_000);

  it('gates Miti spawned lightning-orb packets on each landed parent arrow', () => {
    const axis = createMitiProjectileFixture();
    const run = createMachineAxisService().simulate(axis);
    const damageCounts = actionId =>
      run.trace.damage
        .filter(event => event.actionId === actionId)
        .reduce((counts, event) => {
          const elementId = Number(event.elementId);
          counts[elementId] = (counts[elementId] ?? 0) + 1;
          return counts;
        }, {});

    expect(damageCounts('miti-short-charge-state-on')).toMatchObject({
      108003125: 1,
      108003127: 6,
    });
    expect(damageCounts('miti-full-charge-expiry-boundary')).toMatchObject({
      108003126: 1,
      108003129: 12,
    });
    expect(damageCounts('miti-full-charge-state-on')).toMatchObject({
      108003126: 3,
      108003129: 36,
    });
    expect(damageCounts('miti-short-charge-all-miss')).toEqual({});
    expect(damageCounts('miti-full-charge-state-on-all-miss')).toEqual({});
    expect(damageCounts('miti-ultimate-all-miss')).toEqual({});

    const secondStarPeriodic = run.trace.resources.actors.filter(
      event =>
        event.actionId === 'miti-star-2-exact-cooldown' &&
        Number(event.elementId) === 108003164
    );
    expect(secondStarPeriodic).toHaveLength(30);
    for (const actorId of ['actor-108003', 'actor-101010', 'actor-103002']) {
      expect(
        secondStarPeriodic
          .filter(event => event.actorId === actorId)
          .map(event => [event.absoluteFrame, event.change, event.reason])
      ).toEqual(
        Array.from({ length: 10 }, (_, index) => [
          3391 + index * 60,
          2,
          actorId === 'actor-108003'
            ? 'verified-direct-sp'
            : 'verified-direct-sp-shared',
        ])
      );
    }

    const finalHitSp = run.trace.resources.actors.filter(
      event => Number(event.elementId) === 108003147
    );
    expect(
      finalHitSp.map(event => [
        event.actionId,
        event.actorId,
        event.absoluteFrame,
        event.change,
      ])
    ).toEqual([
      ['miti-star-1', 'actor-108003', 2068, 5],
      ['miti-star-2-exact-cooldown', 'actor-108003', 3508, 5],
    ]);
    expect(
      finalHitSp.some(event => event.actionId === 'miti-star-3-final-miss')
    ).toBe(false);

    const attackBuffEvents = run.trace.effects.events.filter(
      event => event.effectId === 'battle-element:108003143'
    );
    expect(
      attackBuffEvents
        .filter(
          event =>
            event.actionId === 'miti-star-2-exact-cooldown' &&
            event.operation === 'apply'
        )
        .map(event => event.targetId)
        .sort()
    ).toEqual(['actor-101010', 'actor-103002', 'actor-108003']);
    expect(
      attackBuffEvents
        .filter(event => event.timeMs === 56516.667)
        .map(event => [event.actionId, event.operation])
        .sort()
    ).toEqual([
      ['miti-star-1', 'expire'],
      ['miti-star-1', 'expire'],
      ['miti-star-1', 'expire'],
      ['miti-star-2-exact-cooldown', 'apply'],
      ['miti-star-2-exact-cooldown', 'apply'],
      ['miti-star-2-exact-cooldown', 'apply'],
    ]);
    const replay = createMachineAxisService().simulate(axis);
    expect(replay.hashes).toEqual(run.hashes);
    expect(replay.actionLegalityProof.proofHash).toBe(
      run.actionLegalityProof.proofHash
    );
  }, 30_000);

  it('publishes and resolves the complete generated kibo action census', () => {
    const service = createMachineAxisService();
    const catalog = service.catalog();
    const sourceActions = kiboActionCatalog.items.flatMap(item =>
      item.actions.map(action => ({
        kiboId: Number(item.kiboId),
        publicActionId: Number(action.skillId),
        actionKind: action.kind,
      }))
    );
    const machineActions = catalog.kibos.flatMap(kibo =>
      kibo.actions.map(action => ({
        kiboId: Number(kibo.id),
        publicActionId: Number(action.publicActionId),
        actionKind: action.actionKind,
      }))
    );

    expect(catalog.summary).toMatchObject({
      kiboCount: 122,
      kiboActionCount: 448,
      kiboActionCountByKind: {
        signature: 122,
        active: 82,
        break: 122,
        'normal-attack': 122,
      },
    });
    expect(catalog.dataIdentity.normalAttackInputAuthority).toMatchObject({
      schemaVersion: expect.any(Number),
      contractName: expect.any(String),
      policyVersion: expect.any(Number),
      contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    const moyinNormalAttack = catalog.publicActions.find(
      action =>
        Number(action.ownerId) === 112001 &&
        action.actionKind === 'normal-attack'
    );
    expect(moyinNormalAttack).toBeDefined();
    expect(moyinNormalAttack.attackInputs[0]).toMatchObject({
      identity: expect.any(String),
      sequenceIndex: 1,
      sequenceTotal: 5,
      controlSkillId: 11200101,
      subSkillIndex: 0,
      animationDurationFrames: 230,
      linkWindow: {
        kind: 'control-transition-window',
        startFrame: 18,
        endFrame: 73,
        targetControlSkillId: 11200102,
        targetSubSkillIndex: 0,
      },
    });
    expect(catalog.kiboAxisActionScope).toMatchObject({
      policyId: 'm12c-kibo-axis-action-scope-v1',
      includedAxisActionKinds: ['signature', 'break'],
      deferredAutonomousActionKinds: ['normal-attack', 'active'],
      retainedCalculationSurfaces: ['signature', 'joint-attack', 'passive'],
    });
    expect(machineActions).toEqual(sourceActions);
    for (const [publicActionId, actionKind] of [
      [50000102, 'signature'],
      [50000112, 'break'],
    ]) {
      expect(
        service.prepare(createKiboAxis({ publicActionId, actionKind })).valid
      ).toBe(true);
    }
    for (const [publicActionId, actionKind] of [
      [504003, 'normal-attack'],
      [504004, 'active'],
    ]) {
      const prepared = service.prepare(
        createKiboAxis({ publicActionId, actionKind })
      );
      expect(prepared.valid).toBe(false);
      expect(prepared.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-kibo-action-product-deferred',
          publicActionId,
          actionKind,
          disposition: 'product-deferred-autonomous-action',
          calculationStatus: 'not-generated-not-scheduled-not-scored',
        })
      );
    }
  });

  it('executes a real kibo signature with enough SP and rejects shortage precisely', () => {
    const service = createMachineAxisService();
    const run = service.simulate(createKiboAxis({ currentValue: 100 }));
    expect(run.trace.actions).toContainEqual(
      expect.objectContaining({
        id: 'kibo-signature',
        skillId: 50000102,
      })
    );
    expect(
      run.trace.executionPlan.actions.find(
        action => action.actionId === 'kibo-signature'
      )
    ).toMatchObject({ execute: true });
    expect(
      run.trace.actions.filter(
        action => action.derivation?.kind === 'kibo-autonomous-cast'
      )
    ).toEqual([]);
    expect(run.trace.scenario.kiboAutoCastDerivationAuthority).toBeUndefined();

    const shortageAxis = createKiboAxis({ currentValue: 99 });
    const shortage = service.validate(shortageAxis);
    expect(shortage.valid).toBe(false);
    expect(shortage.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-action-resource-insufficient',
        actionId: 'kibo-signature',
        resourceOwnerKind: 'kibo',
        resourceOwnerId: 500001,
        resourceIdentity: 'kibo:500001:sp',
        currentValue: 99,
        requiredValue: 100,
        reason: 'verified-kibo-resource-insufficient',
      })
    );
    expect(() => service.simulate(shortageAxis)).toThrow(
      MachineAxisValidationError
    );
  }, 30_000);

  it('reports concrete actor resource shortage without a failed action block', () => {
    const axis = createAxis({
      actions: [
        {
          id: 'pangpang-ultimate',
          owner: { kind: 'actor', slotId: 'slot-1' },
          intent: {
            kind: 'public-action',
            publicActionId: 10100713,
            actionKind: 'ultimate',
            level: 1,
          },
          schedule: { mode: 'absolute', frame: 0 },
        },
      ],
    });
    axis.scenario.team[0].initialSp = 0;
    const validation = createMachineAxisService().validate(axis);

    expect(validation.valid).toBe(false);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-action-resource-insufficient',
        actionId: 'pangpang-ultimate',
        resourceOwnerKind: 'actor',
        resourceOwnerId: 101007,
        resourceIdentity: 'actor:101007:sp',
        currentValue: 0,
        requiredValue: 100,
        reason: 'verified-actor-resource-insufficient',
      })
    );
    expect(() => createMachineAxisService().simulate(axis)).toThrow(
      MachineAxisValidationError
    );
  });

  it('rejects unsupported FPS and unknown public actions before compilation', () => {
    const service = createMachineAxisService();
    const unsupportedFps = createAxis();
    unsupportedFps.scenario.fps = 30;
    expect(service.validate(unsupportedFps).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-fps-unsupported',
        path: 'scenario.fps',
      })
    );

    const unknownAction = createKiboAxis({
      publicActionId: 59999999,
      actionKind: 'signature',
    });
    expect(service.validate(unknownAction).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-kibo-action-unknown',
        actionId: 'kibo-signature',
      })
    );
  });

  it('rejects an unknown actor public action with its stable identity', () => {
    const unknownActorAction = createAxis({
      actions: [
        {
          id: 'unknown-actor-action',
          owner: { kind: 'actor', slotId: 'slot-1' },
          intent: {
            kind: 'public-action',
            publicActionId: 19999999,
            actionKind: 'star-skill',
          },
          schedule: { mode: 'absolute', frame: 0 },
        },
      ],
    });
    const validation = createMachineAxisService().validate(unknownActorAction);
    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-public-action-unknown',
        actionId: 'unknown-actor-action',
      })
    );
    expect(validation.actionLegalityProof).toMatchObject({
      passed: false,
      finalScoreEligible: false,
      rejectionCodes: ['machine-axis-public-action-unknown'],
    });
  });
  it('runs a verified real three-actor plus kibo axis', () => {
    const axis = createVerifiedThreeActorFixture();
    const run = createMachineAxisService().simulate(axis);
    const actionsById = new Map(
      run.trace.actions.map(action => [action.id, action])
    );
    const hpDamageByAction = new Map(
      run.evaluation.byAction.map(action => [action.identity, action.hpDamage])
    );
    const enemyState = createSearchStateSnapshot({
      run,
      contract: axis,
    }).enemy;

    expect(run.contract.scenario.target).toEqual({
      hpMode: 'infinite',
      toughnessMode: 'disabled',
      breakMode: 'disabled',
      deathTruncation: 'disabled',
    });
    expect(run.contract.scenario.enemy).toMatchObject({
      enemyId: 300032,
      level: 1,
      hpMultiplier: 1,
    });
    expect(run.trace.state.initial.enemy.maxHp).toBeCloseTo(690.24, 6);
    expect(run.trace.state.final.enemy.maxHp).toBeCloseTo(690.24, 6);
    expect(enemyState).toMatchObject({
      hp: 690.24,
      maxHp: 690.24,
      defeated: false,
    });
    for (const actionId of [
      'xunlang-signature',
      'plunging-inherit',
      'xiaoyu-charged',
      'ruby-plunging',
    ]) {
      expect(hpDamageByAction.get(actionId), actionId).toBeGreaterThan(0);
    }
    const lastDamage = run.trace.damage.at(-1);
    expect(lastDamage.rawDamage).toBeGreaterThan(0);
    const autonomousKiboActions = run.trace.actions.filter(
      action => action.derivation?.kind === 'kibo-autonomous-cast'
    );
    expect(autonomousKiboActions).toEqual([]);
    expect(run.trace.scenario.kiboAutoCastDerivationAuthority).toBeUndefined();
    expect(run.actionLegalityProof.rejectionCodes).not.toContain(
      'kibo-auto-cast-schedule-unresolved'
    );
    expect(run.actionLegalityProof.rejectionCodes).not.toContain(
      'kibo-auto-cast-trigger-unresolved'
    );

    expect(actionsById.get('plunging-inherit')).toMatchObject({
      actorId: 'actor-101007',
      skillId: 10100701,
      actionKind: 'plunging-attack',
    });
    expect(actionsById.get('xiaoyu-charged')).toMatchObject({
      actorId: 'actor-101010',
      actionKind: 'charged-attack',
    });
    expect(actionsById.get('ruby-plunging')).toMatchObject({
      actorId: 'actor-103002',
      skillId: 10300201,
      actionKind: 'plunging-attack',
    });
    expect(actionsById.get('xunlang-signature')).toMatchObject({
      skillId: 50000102,
    });
    expect(run.trace.resources.kibos).toContainEqual(
      expect.objectContaining({
        actionId: 'xunlang-signature',
        kiboId: 500001,
        beforeValue: 100,
        afterValue: 0,
        change: -100,
      })
    );
    const replay = createMachineAxisService().simulate(axis);
    expect(replay.hashes).toEqual(run.hashes);
    expect(replay.actionLegalityProof.proofHash).toBe(
      run.actionLegalityProof.proofHash
    );
  }, 15_000);

  it('rejects the legacy M11-B direct-A3 fixture under the normal-input authority', () => {
    const prepared = createMachineAxisService().prepareValidated(fixture);

    expect(prepared.valid).toBe(false);
    expect(prepared.actionLegalityProof).toMatchObject({
      passed: false,
      finalScoreEligible: false,
      normalAttackInputAuthority: expect.objectContaining({
        contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
      }),
    });
    expect(prepared.issues).toContainEqual(
      expect.objectContaining({
        actionId: 'a3-inherit',
        reason: 'verified-normal-attack-input-phase-conflict',
      })
    );
  }, 15_000);

  it('removes all real hit transactions when landed is miss', () => {
    const service = createMachineAxisService();
    const hit = service.simulate(createAxis());
    const miss = service.simulate(
      createAxis({
        hitOverrides: {
          [PANGPANG_PLUNGING_HIT]: {
            landed: 'miss',
            criticalMode: 'inherit',
          },
        },
      })
    );

    expect(
      hit.trace.damage.filter(item => item.actionId === 'pangpang-plunging')
        .length
    ).toBeGreaterThan(0);
    expect(
      miss.trace.damage.filter(item => item.actionId === 'pangpang-plunging')
    ).toHaveLength(0);
    expect(
      miss.trace.events.filter(
        item =>
          item.actionId === 'pangpang-plunging' &&
          ['hp', 'toughness', 'sp'].includes(item.payload?.resource)
      )
    ).toHaveLength(0);
  });

  it('keeps blocked distinct in the contract while suppressing hit transactions', () => {
    const service = createMachineAxisService();
    const blocked = service.simulate(
      createAxis({
        hitOverrides: {
          [PANGPANG_PLUNGING_HIT]: {
            landed: 'blocked',
            criticalMode: 'inherit',
          },
        },
      })
    );

    expect(
      blocked.trace.damage.filter(item => item.actionId === 'pangpang-plunging')
    ).toHaveLength(0);
    expect(
      blocked.trace.events.filter(
        item =>
          item.actionId === 'pangpang-plunging' &&
          ['hp', 'toughness', 'sp'].includes(item.payload?.resource)
      )
    ).toHaveLength(0);
  });

  it('gives a captured critical roll priority over sampled PRNG', () => {
    const service = createMachineAxisService();
    const axis = createAxis({
      critical: { policy: 'non-critical', seed: 'captured-seed' },
      hitOverrides: {
        [PANGPANG_PLUNGING_HIT]: {
          landed: 'hit',
          criticalMode: 'sampled',
          criticalRoll: 1234,
        },
      },
    });
    const first = service.simulate(axis);
    const repeated = service.simulate(axis);
    const branch = first.trace.damage[0].formula.randomBranch;

    expect(branch).toMatchObject({
      policy: 'captured-critical-roll',
      criticalRoll: 1234,
    });
    expect(branch.criticalStreamIndex).toBeUndefined();
    expect(repeated.hashes.trace).toBe(first.hashes.trace);
    expect(repeated.trace.damage[0].formula.randomBranch).toEqual(branch);
  });

  it('rejects stale hit identities before materializing a run', () => {
    const service = createMachineAxisService();
    const invalid = createAxis({
      hitOverrides: {
        'stale-hit-identity': {
          landed: 'miss',
          criticalMode: 'inherit',
        },
      },
    });
    const validation = service.validate(invalid);

    expect(validation).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'machine-axis-hit-identity-stale',
          actionId: 'pangpang-plunging',
          hitIdentity: 'stale-hit-identity',
        }),
      ],
    });
    expect(() => service.simulate(invalid)).toThrow(MachineAxisValidationError);
  });

  it('rejects critical overrides for a real non-critical-eligible hit', () => {
    const hit = findMechanicsHit(PANGPANG_PLUNGING_HIT);
    const originalDamageType = hit.damage.damageType;
    hit.damage.damageType = 6;
    try {
      const validation = createMachineAxisService().validate(
        createAxis({
          hitOverrides: {
            [PANGPANG_PLUNGING_HIT]: {
              landed: 'hit',
              criticalMode: 'critical',
            },
          },
        })
      );

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-hit-critical-override-unsupported',
          actionId: 'pangpang-plunging',
          hitIdentity: PANGPANG_PLUNGING_HIT,
        })
      );
    } finally {
      hit.damage.damageType = originalDamageType;
    }
  });

  it('rejects expected mode when a real hit has critical-only state effects', () => {
    const hit = findMechanicsHit(PANGPANG_PLUNGING_HIT);
    const originalIdentities = hit.criticalStateEffectIdentities;
    hit.criticalStateEffectIdentities = ['synthetic:critical-state-effect'];
    try {
      const validation = createMachineAxisService().validate(
        createAxis({
          hitOverrides: {
            [PANGPANG_PLUNGING_HIT]: {
              landed: 'hit',
              criticalMode: 'expected',
            },
          },
        })
      );

      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-hit-expected-state-branch-unsupported',
          actionId: 'pangpang-plunging',
          hitIdentity: PANGPANG_PLUNGING_HIT,
        })
      );
    } finally {
      if (originalIdentities === undefined) {
        delete hit.criticalStateEffectIdentities;
      } else {
        hit.criticalStateEffectIdentities = originalIdentities;
      }
    }
  });
  it('resolves relative schedules and rejects conflicting actions', () => {
    const service = createMachineAxisService();
    const pangpang = {
      id: 'pangpang-plunging',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10100701,
        actionKind: 'plunging-attack',
      },
      schedule: { mode: 'after-previous-end', offsetFrames: 5 },
    };
    const actions = [
      {
        id: 'wait',
        owner: { kind: 'system', slotId: null },
        intent: { kind: 'wait', durationFrames: 30 },
        schedule: { mode: 'absolute', frame: 0 },
      },
      pangpang,
    ];
    const run = service.simulate(createAxis({ actions }));
    expect(
      run.actionResolutions.find(item => item.actionId === 'pangpang-plunging')
    ).toMatchObject({ startFrame: 35 });

    const conflict = service.validate(
      createAxis({
        actions: [
          { ...pangpang, schedule: { mode: 'absolute', frame: 0 } },
          {
            ...pangpang,
            id: 'pangpang-plunging-overlap',
            schedule: { mode: 'absolute', frame: 0 },
          },
        ],
      })
    );
    expect(conflict.valid).toBe(false);
    expect(conflict.issues).toContainEqual(
      expect.objectContaining({ code: 'machine-axis-action-not-executable' })
    );
  }, 15_000);

  it('fails closed when an explicit attack chain conflicts with a contextual window', () => {
    installRubyProfileOverlay();
    const createRubyAxis = chainIdentity => {
      const axis = createAxis({
        actions: [
          {
            id: 'ruby-ultimate-context',
            owner: { kind: 'actor', slotId: 'slot-3' },
            intent: {
              kind: 'public-action',
              publicActionId: 10300213,
              actionKind: 'ultimate',
            },
            schedule: { mode: 'absolute', frame: 0 },
          },
          {
            id: 'ruby-explicit-chain-a1',
            owner: { kind: 'actor', slotId: 'slot-3' },
            intent: {
              kind: 'public-action',
              publicActionId: 10300201,
              actionKind: 'normal-attack',
              attackInput: {
                sequenceIndex: 1,
                chainIdentity,
                contextActionId: 'ruby-ultimate-context',
              },
            },
            schedule: { mode: 'absolute', frame: 329 },
          },
        ],
      });
      axis.scenario.team[2].initialSp = 100;
      return axis;
    };

    const conflict = createMachineAxisService().validate(
      createRubyAxis('ruby-normal-default-three-inputs')
    );
    expect(conflict.valid).toBe(false);
    expect(conflict.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-normal-attack-chain-context-conflict',
        actionId: 'ruby-explicit-chain-a1',
        requestedChainIdentity: 'ruby-normal-default-three-inputs',
        contextualChainIdentity: 'ruby-enhanced-twelve-inputs',
      })
    );

    const matching = createMachineAxisService().prepare(
      createRubyAxis('ruby-enhanced-twelve-inputs')
    );
    expect(matching.issues).toEqual([]);
    expect(
      matching.project.actions.find(
        action => action.id === 'ruby-explicit-chain-a1'
      )
    ).toMatchObject({
      attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
      attackInputChainSelectionSource: 'user-explicit',
      controlSubSkillIndex: 1,
      attackInput: {
        attackInputChainIdentity: 'ruby-enhanced-twelve-inputs',
        controlSkillId: 10300201,
        selectedSubSkillIndex: 1,
      },
    });
  });

  it('rejects illegal loadouts and stale semantic variant identities', () => {
    const service = createMachineAxisService();
    const illegalLoadout = createAxis();
    illegalLoadout.scenario.team[0].loadout = { kiboId: 999999999 };
    expect(service.validate(illegalLoadout).issues).toContainEqual(
      expect.objectContaining({ code: 'machine-axis-loadout-kibo-unknown' })
    );

    const staleVariant = createAxis({
      actions: [
        {
          id: 'xiaoyu-stale-variant',
          owner: { kind: 'actor', slotId: 'slot-2' },
          intent: {
            kind: 'public-action',
            publicActionId: 10101001,
            actionKind: 'charged-attack',
            semanticVariant: {
              selectorIdentity: 'removed-variant-identity',
              publicVariantIndex: 2,
              mode: 'hold',
            },
          },
          schedule: { mode: 'absolute', frame: 60 },
        },
      ],
    });
    expect(service.validate(staleVariant).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-semantic-variant-stale',
        actionId: 'xiaoyu-stale-variant',
      })
    );
  });

  it('rejects an off-field player input before settlement and exposes the same legality proof to manual callers', () => {
    const axis = createAxis({
      actions: [
        {
          id: 'off-field-a1',
          owner: { kind: 'actor', slotId: 'slot-2' },
          intent: {
            kind: 'public-action',
            publicActionId: 10101001,
            actionKind: 'normal-attack',
            attackInput: { sequenceIndex: 1 },
          },
          schedule: { mode: 'absolute', frame: 30 },
        },
      ],
    });
    const service = createMachineAxisService();
    const validation = service.validate(axis);
    expect(validation.valid).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'controlled-actor-action-unavailable',
          actionId: 'off-field-a1',
        }),
      ])
    );
    expect(validation.actionLegalityProof).toMatchObject({
      passed: false,
      finalScoreEligible: false,
      rejectionCounts: {
        'controlled-actor-action-unavailable': 1,
      },
    });

    const prepared = service.prepareValidated(axis);
    expect(prepared.valid).toBe(false);
    expect(
      prepared.run.trace.executionPlan.actions.find(
        action => action.actionId === 'off-field-a1'
      )
    ).toMatchObject({ execute: false });
    expect(prepared.run.evaluation.totals.hpDamage).toBe(0);
    expect(
      prepared.run.trace.damage.some(event => event.actionId === 'off-field-a1')
    ).toBe(false);
    expect(
      prepared.run.trace.effects.events.some(
        event => event.actionId === 'off-field-a1'
      )
    ).toBe(false);
    expect(
      prepared.run.trace.resources.actors.some(
        event => event.actionId === 'off-field-a1'
      )
    ).toBe(false);
    expect(() => service.simulate(axis)).toThrow(MachineAxisValidationError);
  });
});
function findMechanicsHit(hitIdentity) {
  for (const binding of [
    ...(mechanicsPackage.controlBindings ?? []),
    ...(mechanicsPackage.actionVariantControlBindings ?? []),
  ]) {
    const hit = (binding.hits ?? []).find(
      candidate => candidate.hitIdentity === hitIdentity
    );
    if (hit) return hit;
  }
  throw new Error(`Missing verified hit: ${hitIdentity}`);
}

function installRubyProfileOverlay() {
  const runtimePackage = structuredClone(mechanicsPackage);
  const mapping = runtimePackage.actionMappings.find(
    candidate =>
      Number(candidate.ownerId) === 103002 &&
      candidate.actionKind === 'normal-attack'
  );
  const chains = rubyOwnerContract.contracts.attackInputChains ?? [];
  mapping.profileAttackInputSegments = chains.flatMap(chain =>
    (chain.segments ?? []).map(segment => {
      const selectedSubSkillIndex = Number(segment.subSkillIndex ?? 0);
      const selectedHitIdentities = (segment.executionTiming?.hits ?? [])
        .map(hit => hit.hitIdentity)
        .filter(Boolean);
      return {
        ...structuredClone(segment),
        identity: `${chain.chainIdentity}:segment:${segment.sequenceIndex}`,
        attackInputChainIdentity: chain.chainIdentity,
        chainSequenceIndex: segment.sequenceIndex,
        sequenceTotal: segment.sequenceTotal ?? chain.segments.length,
        selectedSubSkillIndex,
        effectiveDurationFrames: segment.durationFrames,
        durationStatus: 'applied',
        effectiveDurationStatus: 'applied',
        durationSourceIdentity: segment.sourceIdentity,
        sourceEvidenceStatus: 'applied',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        runtimeReady: true,
        schedulable: true,
        selectedHitIdentities,
        hitCount: selectedHitIdentities.length,
        actionScheduling: {
          status: 'exact',
          kind: 'exact-selected-variant-occupancy',
          durationFrames: segment.durationFrames,
          planningDurationFrames: null,
          selectedSubSkillIndex,
          sourceIdentity: segment.sourceIdentity,
          sourceStatus: 'verified-input-occupancy',
          variantModelStatus: 'resolved',
          reasons: [],
        },
      };
    })
  );
  mapping.profileVariantWindowBindings = structuredClone(
    rubyOwnerContract.contracts.variantWindowBindings ?? []
  );
  installVerifiedCombatMechanicsPackage(runtimePackage);
}
