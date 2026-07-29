import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import {
  createMachineAxisService,
  MachineAxisValidationError,
} from '../../machine-axis/machineAxisService';

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
