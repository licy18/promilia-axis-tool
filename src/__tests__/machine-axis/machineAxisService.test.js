import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mitiFixture from '../../../fixtures/character-acceptance/108003-visual.json';
import integratedBaseline from '../../../reports/m11/m11-headless-integrated-baseline-20260730.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import kiboActionCatalog from '../../data/generated/workbench-kibo-action-catalog.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  createMachineAxisService,
  MachineAxisValidationError,
} from '../../machine-axis/machineAxisService';
import { createSearchStateSnapshot } from '../../machine-axis/machineAxisSearchState';

const PANGPANG_A3_HIT = '10100703|0|elements|0|-9212100609153088879|14|1';

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
        id: 'pangpang-a3',
        owner: { kind: 'actor', slotId: 'slot-1' },
        intent: {
          kind: 'public-action',
          publicActionId: 10100701,
          actionKind: 'normal-attack',
          attackInput: { sequenceIndex: 3 },
        },
        schedule: { mode: 'absolute', frame: 60 },
        hitOverrides,
      },
    ],
  };
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

  it('runs a real public Pangpang A3 through the canonical core', () => {
    const service = createMachineAxisService();
    const run = service.simulate(createAxis());
    const action = run.trace.actions.find(item => item.id === 'pangpang-a3');
    const hit = run.trace.damage.find(item => item.actionId === 'pangpang-a3');

    expect(action).toMatchObject({
      skillId: 10100701,
      controlSkillId: 10100703,
      subSkillIndex: 0,
    });
    expect(hit).toMatchObject({
      hitIdentity: PANGPANG_A3_HIT,
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

  it('gates Miti spawned lightning-orb packets on each landed parent arrow', () => {
    const run = createMachineAxisService().simulate(mitiFixture);
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
    for (const actorId of [
      'actor-108003',
      'actor-101010',
      'actor-103002',
    ]) {
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
    expect(run.hashes).toMatchObject({
      input: '6430e1e6a6873323',
      data: '0054ef276ddc8580',
      trace: '31ef176144e726db',
      evaluation: '3c2fb1d6fda5e7b9',
      build: 'f3562d525bcffba5',
    });
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
    expect(machineActions).toEqual(sourceActions);
    for (const [publicActionId, actionKind] of [
      [50000102, 'signature'],
      [504003, 'normal-attack'],
      [504004, 'active'],
      [50000112, 'break'],
    ]) {
      expect(
        service.prepare(createKiboAxis({ publicActionId, actionKind })).valid
      ).toBe(true);
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
    expect(
      createMachineAxisService().validate(unknownActorAction).issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-public-action-unknown',
        actionId: 'unknown-actor-action',
      })
    );
  });
  it('runs the acceptance fixture as a real three-actor plus kibo axis', () => {
    const run = createMachineAxisService().simulate(fixture);
    const actionsById = new Map(
      run.trace.actions.map(action => [action.id, action])
    );
    const hpDamageByAction = new Map(
      run.evaluation.byAction.map(action => [action.identity, action.hpDamage])
    );
    const enemyState = createSearchStateSnapshot({
      run,
      contract: fixture,
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
      'a3-expected',
      'xiaoyu-charged',
      'ruby-enhanced-e1-intent',
    ]) {
      expect(hpDamageByAction.get(actionId), actionId).toBeGreaterThan(0);
    }
    const lastDamage = run.trace.damage.at(-1);
    expect(lastDamage.absoluteFrame).toBeGreaterThan(6000);
    expect(lastDamage.rawDamage).toBeGreaterThan(0);

    expect(actionsById.get('a3-inherit')).toMatchObject({
      actorId: 'actor-101007',
      controlSkillId: 10100703,
    });
    expect(actionsById.get('xiaoyu-charged')).toMatchObject({
      actorId: 'actor-101010',
      actionKind: 'charged-attack',
    });
    expect(actionsById.get('ruby-enhanced-e1-intent')).toMatchObject({
      actorId: 'actor-103002',
      name: '强化普攻 E1',
      controlSkillId: 10300201,
      subSkillIndex: 1,
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
    expect(run.trace.resources.special).toContainEqual(
      expect.objectContaining({
        actionId: 'ruby-enhanced-e1-intent',
        payload: expect.objectContaining({
          resourceIdentity: 'actor:103002:element:103002047',
          beforeValue: 6,
          afterValue: 5,
          change: -1,
        }),
      })
    );
    expect(run.hashes).toEqual(
      integratedBaseline.machineAxis.canonicalHashes
    );
  });

  it('removes all real hit transactions when landed is miss', () => {
    const service = createMachineAxisService();
    const hit = service.simulate(createAxis());
    const miss = service.simulate(
      createAxis({
        hitOverrides: {
          [PANGPANG_A3_HIT]: {
            landed: 'miss',
            criticalMode: 'inherit',
          },
        },
      })
    );

    expect(
      hit.trace.damage.filter(item => item.actionId === 'pangpang-a3').length
    ).toBeGreaterThan(0);
    expect(
      miss.trace.damage.filter(item => item.actionId === 'pangpang-a3')
    ).toHaveLength(0);
    expect(
      miss.trace.events.filter(
        item =>
          item.actionId === 'pangpang-a3' &&
          ['hp', 'toughness', 'sp'].includes(item.payload?.resource)
      )
    ).toHaveLength(0);
  });

  it('gives a captured critical roll priority over sampled PRNG', () => {
    const service = createMachineAxisService();
    const axis = createAxis({
      critical: { policy: 'non-critical', seed: 'captured-seed' },
      hitOverrides: {
        [PANGPANG_A3_HIT]: {
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
          actionId: 'pangpang-a3',
          hitIdentity: 'stale-hit-identity',
        }),
      ],
    });
    expect(() => service.simulate(invalid)).toThrow(MachineAxisValidationError);
  });

  it('rejects critical overrides for a real non-critical-eligible hit', () => {
    const hit = findMechanicsHit(PANGPANG_A3_HIT);
    const originalDamageType = hit.damage.damageType;
    hit.damage.damageType = 6;
    try {
      const validation = createMachineAxisService().validate(
        createAxis({
          hitOverrides: {
            [PANGPANG_A3_HIT]: {
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
          actionId: 'pangpang-a3',
          hitIdentity: PANGPANG_A3_HIT,
        })
      );
    } finally {
      hit.damage.damageType = originalDamageType;
    }
  });

  it('rejects expected mode when a real hit has critical-only state effects', () => {
    const hit = findMechanicsHit(PANGPANG_A3_HIT);
    const originalIdentities = hit.criticalStateEffectIdentities;
    hit.criticalStateEffectIdentities = ['synthetic:critical-state-effect'];
    try {
      const validation = createMachineAxisService().validate(
        createAxis({
          hitOverrides: {
            [PANGPANG_A3_HIT]: {
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
          actionId: 'pangpang-a3',
          hitIdentity: PANGPANG_A3_HIT,
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
      id: 'pangpang-a3',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: 10100701,
        actionKind: 'normal-attack',
        attackInput: { sequenceIndex: 3 },
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
      run.actionResolutions.find(item => item.actionId === 'pangpang-a3')
    ).toMatchObject({ startFrame: 35 });

    const conflict = service.validate(
      createAxis({
        actions: [
          { ...pangpang, schedule: { mode: 'absolute', frame: 0 } },
          {
            ...pangpang,
            id: 'pangpang-a3-overlap',
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
