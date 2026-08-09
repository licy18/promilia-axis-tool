import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  installVerifiedCombatMechanicsPackage,
  validateVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

const OWNER_ID = 102001;
const STAR_SKILL_ID = 10200112;
const STAR_CARRY_SKILL_ID = 10200122;

describe('Lily Machine Axis action-level integration', () => {
  let service;
  let adapter;

  beforeEach(() => {
    expect(
      validateVerifiedCombatMechanicsPackage(mechanicsPackage)
    ).toMatchObject({ valid: true, issues: [] });
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
    adapter = createWorkbenchMachineAxisAdapter({ service });
  });

  afterEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('preserves intent.level 1/12 through Workbench and hashes level-scaled star-skill damage', () => {
    const levelOne = runLevelCase(1, 1887);
    const levelTwelve = runLevelCase(12, 3960);

    expect(levelOne.hashes.input).not.toBe(levelTwelve.hashes.input);
    expect(levelOne.hashes.evaluation).not.toBe(
      levelTwelve.hashes.evaluation
    );
  });

  it('defaults a missing level to 1 and fails closed on invalid or out-of-range levels', () => {
    const missing = createAxisContract(undefined);
    const prepared = service.prepare(missing);
    expect(prepared.issues).toEqual([]);
    expect(prepared.valid).toBe(true);
    expect(prepared.contract.actions[0].intent.level).toBeNull();
    expect(prepared.project.actions[0]).toMatchObject({ level: 1 });
    expect(service.prepareValidated(missing).issues).toEqual([]);
    expect(service.simulate(missing).evaluation.totals.hpDamage).toBe(1887);

    for (const invalidLevel of [0, 'invalid', 13]) {
      const validation = service.validate(createAxisContract(invalidLevel));
      expect(validation.valid).toBe(false);
      expect(validation.issues).toContainEqual(
        expect.objectContaining({ path: 'actions.0.intent.level' })
      );
    }
    expect(service.validate(createAxisContract(13)).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-public-action-level-out-of-range',
        level: 13,
        maximum: 12,
      })
    );
  });

  it('rejects direct manual star-carry input even when its source mapping is present', () => {
    const rejected = service.prepareValidated(
      createManualStarCarryContract(12)
    );

    expect(rejected.valid).toBe(false);
    expect(rejected.issues).toContainEqual(
      expect.objectContaining({
        code: 'star-carry-switch-trigger-required',
        actionId: 'lily-star-carry',
      })
    );
  });

  function runLevelCase(level, expectedHpDamage) {
    const contract = createAxisContract(level);
    const jsonContract = JSON.parse(JSON.stringify(contract));
    expect(jsonContract.actions[0].intent.level).toBe(level);
    const prepared = service.prepareValidated(jsonContract);
    expect(prepared.issues).toEqual([]);
    expect(prepared.compilation.project.actions[0]).toMatchObject({ level });
    const serviceRun = service.simulate(jsonContract);
    expect(serviceRun.evaluation.totals.hpDamage).toBe(expectedHpDamage);
    expect(serviceRun.actionResolutions[0]).toMatchObject({ level });

    const imported = adapter.importContract(jsonContract);
    expect(imported.contract.actions[0].intent.level).toBe(level);
    expect(imported.project.actions[0]).toMatchObject({
      skillId: STAR_SKILL_ID,
      actionKind: 'star-skill',
      level,
    });
    expect(imported.project.actions[0]).not.toHaveProperty('skillLevel');
    expect(imported.canonicalCompilation.scenario.actions[0].level).toBe(level);
    expect(imported.canonicalRun.evaluation.totals.hpDamage).toBe(
      expectedHpDamage
    );
    expect(imported.canonicalRun.hashes.input).toBe(serviceRun.hashes.input);

    const exported = adapter.exportProject(imported.project);
    expect(exported.actions[0].intent.level).toBe(level);
    const restored = adapter.importContract(
      JSON.parse(JSON.stringify(exported))
    );
    expect(restored.project.actions[0].level).toBe(level);
    expect(restored.canonicalCompilation.scenario.actions[0].level).toBe(level);
    expect(restored.canonicalRun.hashes.input).toBe(
      imported.canonicalRun.hashes.input
    );
    expect(restored.canonicalRun.evaluation.totals.hpDamage).toBe(
      expectedHpDamage
    );

    return imported.canonicalRun;
  }
});

function createAxisContract(level) {
  const contract = structuredClone(fixture);
  contract.dataIdentity = {
    verifiedMechanicsPackageId: mechanicsPackage.packageId,
    verifiedMechanicsPackageHash: mechanicsPackage.packageHash,
    mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
    mechanicsProfileVersion: 1,
  };
  contract.scenario = {
    ...contract.scenario,
    id: 'm12-b3-lily-action-level-integration',
    name: 'M12-B3 Lily action-level integration',
    durationFrames: 480,
    team: [
      createTeamSlot('slot-1', OWNER_ID, 100),
      createTeamSlot('slot-2', 101010, 0),
      createTeamSlot('slot-3', 103002, 0),
    ],
    initialRuntimeState: {
      kiboEnergyBySlot: [],
      specialResourcesByActor: [],
    },
    critical: { policy: 'non-critical', seed: null },
    projectile: { targetDistance: 0, defaultWillHit: true },
  };
  contract.actions = [
    {
      id: 'lily-star-skill',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: STAR_SKILL_ID,
        actionKind: 'star-skill',
        ...(level === undefined ? {} : { level }),
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
  ];
  return contract;
}

function createManualStarCarryContract(level) {
  const contract = createAxisContract(level);
  contract.actions = [
    {
      id: 'lily-star-carry',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: STAR_CARRY_SKILL_ID,
        actionKind: 'star-carry',
        level,
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
  ];
  return contract;
}

function createTeamSlot(slotId, characterId, initialSp) {
  return {
    slotId,
    characterId,
    level: 80,
    initialSp,
    loadout: {},
    cultivation: {},
  };
}
