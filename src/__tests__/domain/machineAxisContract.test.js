import {
  MACHINE_AXIS_CONTRACT_NAME,
  MACHINE_AXIS_SCHEMA_VERSION,
  normalizeMachineAxisContract,
  resolveMachineAxisSchedules,
  validateMachineAxisContract,
} from '../../machine-axis/machineAxisContract';

function createContract(patch = {}) {
  return {
    schemaVersion: MACHINE_AXIS_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_CONTRACT_NAME,
    dataIdentity: {
      verifiedMechanicsPackageId: 'verified-package',
      verifiedMechanicsPackageHash: 'package-hash',
      mechanicsProfileId: 'verified-profile',
    },
    scenario: {
      id: 'contract-test',
      name: 'Contract Test',
      fps: 60,
      durationFrames: 7200,
      team: [
        { slotId: 'slot-1', characterId: 101007 },
        { slotId: 'slot-2', characterId: 101010 },
        { slotId: 'slot-3', characterId: 103002 },
      ],
      enemy: { enemyId: 1001 },
      initialRuntimeState: {},
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical: { policy: 'non-critical', seed: null },
    },
    actions: [],
    ...patch,
  };
}

describe('Machine Axis contract', () => {
  it('normalizes public semantic actions without accepting internal controls', () => {
    const normalized = normalizeMachineAxisContract(
      createContract({
        actions: [
          {
            id: 'pangpang-a3',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: {
              kind: 'public-action',
              publicActionId: 10100701,
              actionKind: 'normal-attack',
              attackInput: { sequenceIndex: 3 },
              controlSkillId: 10100703,
              subSkillIndex: 0,
            },
            schedule: { mode: 'absolute', frame: 60 },
          },
        ],
      })
    );

    expect(normalized.actions[0].intent).toEqual({
      kind: 'public-action',
      publicActionId: 10100701,
      actionKind: 'normal-attack',
      targetSlotId: null,
      durationFrames: null,
      level: null,
      semanticVariant: null,
      attackInput: {
        sequenceIndex: 3,
        groupId: null,
        contextActionId: null,
        chainIdentity: null,
      },
    });
    expect(normalized.actions[0].intent).not.toHaveProperty('controlSkillId');
    expect(normalized.actions[0].intent).not.toHaveProperty('subSkillIndex');
  });

  it('preserves an explicit attack-input chain identity through canonical JSON', () => {
    const contract = createContract({
      actions: [
        {
          id: 'explicit-chain-segment',
          owner: { kind: 'actor', slotId: 'slot-3' },
          intent: {
            kind: 'public-action',
            publicActionId: 10300201,
            actionKind: 'normal-attack',
            attackInput: {
              sequenceIndex: 7,
              groupId: 'ruby-chain',
              contextActionId: 'ruby-chain-root',
              chainIdentity: 'ruby-enhanced-chain',
            },
          },
          schedule: { mode: 'absolute', frame: 60 },
        },
      ],
    });

    const normalized = normalizeMachineAxisContract(contract);
    expect(normalized.actions[0].intent.attackInput).toEqual({
      sequenceIndex: 7,
      groupId: 'ruby-chain',
      contextActionId: 'ruby-chain-root',
      chainIdentity: 'ruby-enhanced-chain',
    });
    expect(JSON.parse(JSON.stringify(normalized))).toEqual(normalized);

    contract.actions[0].intent.attackInput.chainIdentity = 7;
    expect(validateMachineAxisContract(contract)).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'machine-axis-schema-any-of',
          path: 'actions.0.intent.attackInput',
        }),
      ],
    });
  });

  it('keeps landed and critical overrides independent and requires sampled seed', () => {
    const withoutSeed = createContract({
      actions: [
        {
          id: 'sampled-hit',
          owner: { kind: 'actor', slotId: 'slot-1' },
          intent: {
            kind: 'public-action',
            publicActionId: 10100701,
          },
          schedule: { mode: 'absolute', frame: 0 },
          hitOverrides: {
            'verified-hit': {
              landed: 'miss',
              criticalMode: 'sampled',
              criticalRoll: 1234,
            },
          },
        },
      ],
    });
    const rejected = validateMachineAxisContract(withoutSeed);
    expect(rejected.valid).toBe(false);
    expect(rejected.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-sampled-seed-required',
        path: 'scenario.critical.seed',
      })
    );

    withoutSeed.scenario.critical.seed = 'fixture-seed';
    const accepted = validateMachineAxisContract(withoutSeed);
    expect(accepted.valid).toBe(true);
    expect(accepted.normalized.actions[0].hitOverrides['verified-hit']).toEqual(
      {
        landed: 'miss',
        criticalMode: 'sampled',
        criticalRoll: 1234,
      }
    );
  });

  it('preserves blocked as a distinct non-landed hit outcome', () => {
    const contract = createContract({
      actions: [
        {
          id: 'blocked-hit',
          owner: { kind: 'actor', slotId: 'slot-1' },
          intent: {
            kind: 'public-action',
            publicActionId: 10100701,
          },
          schedule: { mode: 'absolute', frame: 0 },
          hitOverrides: {
            'verified-hit': {
              landed: 'blocked',
              criticalMode: 'inherit',
            },
          },
        },
      ],
    });

    const result = validateMachineAxisContract(contract);

    expect(result.valid).toBe(true);
    expect(result.normalized.actions[0].hitOverrides['verified-hit']).toEqual({
      landed: 'blocked',
      criticalMode: 'inherit',
      criticalRoll: null,
    });
  });

  it('preserves an explicit target evaluation policy without changing defaults', () => {
    const baseline = normalizeMachineAxisContract(createContract());
    expect(baseline.scenario).not.toHaveProperty('target');

    const value = createContract();
    value.scenario.target = {
      hpMode: 'infinite',
      toughnessMode: 'disabled',
      breakMode: 'disabled',
      deathTruncation: 'disabled',
    };
    const result = validateMachineAxisContract(value);
    expect(result.valid).toBe(true);
    expect(result.normalized.scenario.target).toEqual(value.scenario.target);

    value.scenario.target.hpMode = 'bottomless';
    expect(validateMachineAxisContract(value)).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: 'machine-axis-schema-enum',
          path: 'scenario.target.hpMode',
        }),
      ],
    });
  });

  it('resolves absolute, previous-end, and named predecessor schedules', () => {
    const actions = normalizeMachineAxisContract(
      createContract({
        actions: [
          {
            id: 'a',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: { kind: 'wait', durationFrames: 30 },
            schedule: { mode: 'absolute', frame: 60 },
          },
          {
            id: 'b',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: { kind: 'wait', durationFrames: 20 },
            schedule: {
              mode: 'after-previous-end',
              offsetFrames: 5,
            },
          },
          {
            id: 'c',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: { kind: 'wait', durationFrames: 10 },
            schedule: {
              mode: 'after-action-end',
              actionId: 'a',
              offsetFrames: -10,
            },
          },
        ],
      })
    ).actions;
    const result = resolveMachineAxisSchedules(actions, {
      resolveDurationFrames: action => action.intent.durationFrames,
    });

    expect(result.valid).toBe(true);
    expect(result.byActionId).toMatchObject({
      a: { startFrame: 60 },
      b: { startFrame: 95 },
      c: { startFrame: 80 },
    });
  });

  it('returns stable diagnostics for duplicate ids and invalid references', () => {
    const result = validateMachineAxisContract(
      createContract({
        actions: [
          {
            id: 'duplicate',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: { kind: 'wait', durationFrames: 1 },
            schedule: {
              mode: 'after-action-end',
              actionId: 'future',
            },
          },
          {
            id: 'duplicate',
            owner: { kind: 'actor', slotId: 'slot-1' },
            intent: { kind: 'wait', durationFrames: 1 },
            schedule: { mode: 'absolute', frame: 0 },
          },
        ],
      })
    );

    expect(result.valid).toBe(false);
    expect(result.issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining([
        'machine-axis-schedule-reference-missing',
        'machine-axis-action-id-duplicate',
      ])
    );
  });
});
