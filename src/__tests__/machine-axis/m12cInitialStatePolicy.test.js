import { describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { validateMachineAxisContract } from '../../machine-axis/machineAxisContract';
import {
  M12C_INITIAL_STATE_POLICY_HASH,
  M12C_RUBY_AMMO_RESOURCE_IDENTITY,
  M12C_SCENARIO_POLICY_ID,
  createM12cInitialStatePresetBinding,
  validateM12cInitialStatePreset,
} from '../../machine-axis/m12cInitialStatePolicy';

const FIRE_MARK = mechanicsPackage.tuningMechanicsCatalog.profiles.find(
  profile => profile.key === 'fire'
);
const RUBY_RESOURCE = mechanicsPackage.specialResourceCatalog.profiles.find(
  profile => profile.resourceIdentity === M12C_RUBY_AMMO_RESOURCE_IDENTITY
);
const XIAOYU_RESOURCE = mechanicsPackage.specialResourceCatalog.profiles.find(
  profile => profile.ownerId === 101010
);

function createTeam() {
  return [
    {
      slotId: 'slot-1',
      characterId: 109001,
      initialSp: 100,
      loadout: { kiboId: 500001 },
    },
    {
      slotId: 'slot-2',
      characterId: 103002,
      initialSp: 75,
      loadout: { kiboId: 500002 },
    },
    {
      slotId: 'slot-3',
      characterId: 101010,
      initialSp: 0,
      loadout: { kiboId: 500003 },
    },
  ];
}

function createCycleState() {
  return {
    controlledActor: {
      actorId: 'actor-109001',
      characterId: 109001,
    },
    kiboEnergyBySlot: [
      {
        slotId: 'slot-1',
        actorId: 'actor-109001',
        characterId: 109001,
        kiboId: 500001,
        currentValue: 100,
        maxValue: 100,
      },
    ],
    tuningMarks: [
      {
        markId: FIRE_MARK.markId,
        profileKey: FIRE_MARK.key,
        decayRemainingMs: FIRE_MARK.layerDurationMs,
        heldReadyRemainingMs: 0,
        layers: [{}, {}],
      },
    ],
    specialResourcesByActor: [
      {
        actorId: 'actor-103002',
        characterId: 103002,
        resourceIdentity: RUBY_RESOURCE.resourceIdentity,
        currentValue: 6,
        maxValue: RUBY_RESOURCE.capacity,
        inputStep: RUBY_RESOURCE.inputStep,
        scenarioConfigurable: true,
        activeStates: [],
      },
      {
        actorId: 'actor-101010',
        characterId: 101010,
        resourceIdentity: XIAOYU_RESOURCE.resourceIdentity,
        currentValue: 50,
        maxValue: XIAOYU_RESOURCE.capacity,
        inputStep: XIAOYU_RESOURCE.inputStep,
        scenarioConfigurable: true,
        activeStates: [],
      },
    ],
  };
}

function createBinding(objectiveId, state = createCycleState()) {
  return createM12cInitialStatePresetBinding({
    presetId: 'm12c-cycle-warm-v1',
    objectiveId,
    team: createTeam(),
    initialRuntimeState: state,
    mechanicsPackage,
  });
}

function validate(binding, objectiveId, state, team = createTeam()) {
  return validateM12cInitialStatePreset({
    binding,
    objectiveId,
    team,
    initialRuntimeState: state,
    mechanicsPackage,
  });
}

describe('M12-C objective-scoped initial state', () => {
  it('binds cycle SP, fresh marks, and scenario-configurable resources', () => {
    const state = createCycleState();
    const binding = createBinding('cycle-dps-no-toughness', state);
    const result = validate(binding, 'cycle-dps-no-toughness', state);

    expect(result.valid).toBe(true);
    expect(binding).toMatchObject({
      policyHash: M12C_INITIAL_STATE_POLICY_HASH,
      objectiveScope: 'cycle',
      mechanicsPackageId: mechanicsPackage.packageId,
      mechanicsPackageHash: mechanicsPackage.packageHash,
      presetHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(result.projection).toMatchObject({
      actorSp: [
        { slotId: 'slot-1', currentValue: 100 },
        { slotId: 'slot-2', currentValue: 75 },
        { slotId: 'slot-3', currentValue: 0 },
      ],
      kiboSp: [{ slotId: 'slot-1', currentValue: 100 }],
      tuningMarks: [{ markId: FIRE_MARK.markId, stackCount: 2 }],
    });
  });

  it('uses one preset hash for both cycle objectives and excludes initial front', () => {
    const state = createCycleState();
    const noToughness = createBinding('cycle-dps-no-toughness', state);
    const withToughness = createBinding('cycle-dps-with-toughness', state);
    const switchedFront = structuredClone(state);
    switchedFront.controlledActor = {
      actorId: 'actor-103002',
      characterId: 103002,
    };
    const switched = createBinding('cycle-dps-no-toughness', switchedFront);

    expect(noToughness.presetHash).toBe(withToughness.presetHash);
    expect(switched.presetHash).toBe(noToughness.presetHash);
    expect(withToughness.objectiveId).not.toBe(noToughness.objectiveId);
  });

  it('allows kill SP and Ruby ammo while fixing marks and other state to zero', () => {
    const state = createCycleState();
    state.tuningMarks = [];
    state.specialResourcesByActor = [state.specialResourcesByActor[0]];
    const binding = createM12cInitialStatePresetBinding({
      presetId: 'm12c-kill-full-sp-ruby-12-v1',
      objectiveId: 'fastest-kill',
      team: createTeam(),
      initialRuntimeState: state,
      mechanicsPackage,
    });

    expect(validate(binding, 'fastest-kill', state)).toMatchObject({
      valid: true,
      projection: {
        objectiveScope: 'kill',
        tuningMarks: [],
        specialResources: [
          expect.objectContaining({
            resourceIdentity: M12C_RUBY_AMMO_RESOURCE_IDENTITY,
            currentValue: 6,
          }),
        ],
      },
    });
  });

  it.each([
    ['enemy', { hp: { currentValue: 1 } }],
    ['activeEffects', [{ instanceKey: 'forged-buff' }]],
    ['selfEnergyByActor', [{ actorId: 'actor-109001', currentValue: 100 }]],
    ['pendingEvents', [{ frame: 1 }]],
  ])('rejects forbidden runtime preset field %s', (field, value) => {
    const clean = createCycleState();
    const binding = createBinding('cycle-dps-no-toughness', clean);
    const drifted = structuredClone(clean);
    drifted[field] = value;

    expect(validate(binding, 'cycle-dps-no-toughness', drifted).valid).toBe(
      false
    );
  });

  it('rejects kill marks, non-Ruby resources, and timed resource states', () => {
    const clean = createCycleState();
    clean.tuningMarks = [];
    clean.specialResourcesByActor = [clean.specialResourcesByActor[0]];
    const binding = createM12cInitialStatePresetBinding({
      presetId: 'kill-clean',
      objectiveId: 'fastest-kill',
      team: createTeam(),
      initialRuntimeState: clean,
      mechanicsPackage,
    });

    const markDrift = structuredClone(clean);
    markDrift.tuningMarks = createCycleState().tuningMarks;
    const resourceDrift = structuredClone(clean);
    resourceDrift.specialResourcesByActor.push(
      createCycleState().specialResourcesByActor[1]
    );
    const stateDrift = structuredClone(clean);
    stateDrift.specialResourcesByActor[0].activeStates = [
      {
        elementId: 1,
        remainingDurationMs: 1000,
        sourceIdentity: 'forged',
      },
    ];

    expect(validate(binding, 'fastest-kill', markDrift).valid).toBe(false);
    expect(validate(binding, 'fastest-kill', resourceDrift).valid).toBe(false);
    expect(validate(binding, 'fastest-kill', stateDrift).valid).toBe(false);
  });

  it('rejects out-of-range SP, stale mark clocks, and forged bindings', () => {
    const clean = createCycleState();
    const binding = createBinding('cycle-dps-no-toughness', clean);
    const badSpTeam = createTeam();
    badSpTeam[0].initialSp = 101;
    const staleMark = structuredClone(clean);
    staleMark.tuningMarks[0].decayRemainingMs -= 1;
    const forged = { ...binding, presetHash: '0'.repeat(64) };

    expect(
      validate(binding, 'cycle-dps-no-toughness', clean, badSpTeam).valid
    ).toBe(false);
    expect(validate(binding, 'cycle-dps-no-toughness', staleMark).valid).toBe(
      false
    );
    expect(validate(forged, 'cycle-dps-no-toughness', clean).valid).toBe(false);
  });

  it('requires the policy binding on formal M12-C contracts', () => {
    const contract = structuredClone(fixture);
    contract.scenario.optimizationQualification = {
      mode: 'formal',
      catalogHash: 'fixture',
    };
    contract.scenario.optimizationScenarioPolicy = {
      policyId: M12C_SCENARIO_POLICY_ID,
      policyHash: 'fixture',
      rosterPolicyId: 'fixture',
      rosterHash: 'fixture',
    };

    expect(validateMachineAxisContract(contract).issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'm12c-initial-state-preset-required',
        }),
      ])
    );
  });
});
