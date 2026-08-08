import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import baseMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import lilyProfile from '../../data/generated/character-combat-profiles/102001.json';
import {
  installVerifiedCombatMechanicsPackage,
  validateVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { compareCycleBoundaryStates } from '../../machine-axis/machineAxisCycleEvaluator';
import {
  createSearchStateSnapshot,
  hashSearchState,
} from '../../machine-axis/machineAxisSearchState';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

const OWNER_ID = 102001;
const STAR_CARRY_SKILL_ID = 10200122;
const GUARD_EFFECT_ID = 'battle-element:480122004';

describe('Lily formal Machine Axis action-level integration', () => {
  let mechanicsPackage;
  let service;
  let adapter;

  beforeEach(() => {
    mechanicsPackage = createLilyMechanicsPackage();
    expect(
      validateVerifiedCombatMechanicsPackage(mechanicsPackage)
    ).toMatchObject({ valid: true, issues: [] });
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
    adapter = createWorkbenchMachineAxisAdapter({ service });
  });

  afterEach(() => {
    installVerifiedCombatMechanicsPackage(baseMechanicsPackage);
  });

  it('preserves intent.level 1/12 through Workbench and canonical simulation and hashes the active Guard value', () => {
    const levelOne = runLevelCase(1, 1900);
    const levelTwelve = runLevelCase(12, 3000);

    expect(levelOne.run.hashes.input).not.toBe(levelTwelve.run.hashes.input);
    expect(hashSearchState(levelOne.searchState)).not.toBe(
      hashSearchState(levelTwelve.searchState)
    );

    const closure = compareCycleBoundaryStates(
      levelOne.searchState,
      levelTwelve.searchState
    );
    expect(closure.closed).toBe(false);
    expect(closure.issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-cycle-state-not-closed',
        dimension: 'effects',
      })
    );
  });

  it('defaults a missing formal level to 1 and fails closed on invalid or out-of-range formal levels', () => {
    const missing = createAxisContract(undefined);
    const prepared = service.prepare(missing);
    expect(prepared.issues).toEqual([]);
    expect(prepared.valid).toBe(true);
    expect(prepared.contract.actions[0].intent.level).toBeNull();
    expect(prepared.project.actions[0]).toMatchObject({ level: 1 });
    expect(service.prepareValidated(missing).issues).toEqual([]);
    expect(readGuardValue(service.simulate(missing))).toBe(1900);

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

  it.each([
    {
      label: 'not schedulable',
      mutate(mapping) {
        mapping.schedulable = false;
      },
    },
    {
      label: 'missing catalog declaration',
      mutate(mapping) {
        mapping.catalogDeclaration = null;
      },
    },
  ])(
    'does not promote a hidden $label action into the formal surface',
    ({ mutate }) => {
      const rejectedPackage = structuredClone(mechanicsPackage);
      const mapping = rejectedPackage.actionMappings.find(
        candidate =>
          Number(candidate.sourceSkillId) === STAR_CARRY_SKILL_ID &&
          candidate.actionKind === 'star-carry'
      );
      expect(mapping).toBeDefined();
      mutate(mapping);
      installVerifiedCombatMechanicsPackage(rejectedPackage);
      const rejected = createMachineAxisService().prepare(
        createAxisContract(12)
      );
      expect(rejected.valid).toBe(false);
      expect(rejected.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-public-action-kind-missing',
          actionId: 'lily-star-carry',
        })
      );
    }
  );

  function runLevelCase(level, expectedRaw) {
    const contract = createAxisContract(level);
    const jsonContract = JSON.parse(JSON.stringify(contract));
    expect(jsonContract.actions[0].intent.level).toBe(level);
    const prepared = service.prepareValidated(jsonContract);
    expect(prepared.issues).toEqual([]);
    expect(prepared.compilation.project.actions[0]).toMatchObject({ level });
    const serviceRun = service.simulate(jsonContract);
    expect(readGuardValue(serviceRun)).toBe(expectedRaw);

    const imported = adapter.importContract(jsonContract);
    expect(imported.contract.actions[0].intent.level).toBe(level);
    expect(imported.project.actions[0]).toMatchObject({
      skillId: STAR_CARRY_SKILL_ID,
      actionKind: 'star-carry',
      level,
    });
    expect(imported.project.actions[0]).not.toHaveProperty('skillLevel');
    expect(imported.canonicalCompilation.scenario.actions[0].level).toBe(level);
    expect(readGuardValue(imported.canonicalRun)).toBe(expectedRaw);
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
    expect(readGuardValue(restored.canonicalRun)).toBe(expectedRaw);

    const searchState = createSearchStateSnapshot({
      run: imported.canonicalRun,
      contract: imported.contract,
      currentFrame: 120,
    });
    expect(searchState.effects).toContainEqual(
      expect.objectContaining({
        effectId: GUARD_EFFECT_ID,
        modifiers: [
          expect.objectContaining({
            kind: 'battle-property',
            attributeId: 22,
            bucket: 'dynamicExtra',
            valueRaw: expectedRaw,
          }),
        ],
      })
    );
    return { run: imported.canonicalRun, searchState };
  }
});

function createLilyMechanicsPackage() {
  const mechanicsPackage = structuredClone(baseMechanicsPackage);
  const starCarryMapping = lilyProfile.contracts.publicActions.find(
    mapping =>
      Number(mapping.sourceSkillId) === STAR_CARRY_SKILL_ID &&
      mapping.actionKind === 'star-carry'
  );
  const starCarryControl = lilyProfile.contracts.controls.find(
    control => Number(control.controlSkillId) === STAR_CARRY_SKILL_ID
  );
  const guardBinding = lilyProfile.contracts.runtimeEffectBindings.find(
    binding => binding.bindingIdentity === 'lily-star-carry-guard'
  );
  mechanicsPackage.actionMappings.push(structuredClone(starCarryMapping));
  mechanicsPackage.summary.candidateActionCount =
    mechanicsPackage.actionMappings.length;
  mechanicsPackage.controlBindings.push(structuredClone(starCarryControl));
  mechanicsPackage.actionVariantGraph.runtimeEffectBindings.push(
    structuredClone(guardBinding)
  );
  return mechanicsPackage;
}

function createAxisContract(level) {
  const contract = structuredClone(fixture);
  contract.dataIdentity = {
    verifiedMechanicsPackageId: baseMechanicsPackage.packageId,
    verifiedMechanicsPackageHash: baseMechanicsPackage.packageHash,
    mechanicsProfileId: 'azpr-three-value-verified-tc-20260718',
    mechanicsProfileVersion: 1,
  };
  contract.scenario = {
    ...contract.scenario,
    id: 'm12-b3-lily-action-level-integration',
    name: 'M12-B3 Lily action-level integration',
    durationFrames: 480,
    team: [
      createTeamSlot('slot-1', OWNER_ID, 500001, 100),
      createTeamSlot('slot-2', 101010, 500003, 0),
      createTeamSlot('slot-3', 103002, 500039, 0),
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
      id: 'lily-star-carry',
      owner: { kind: 'actor', slotId: 'slot-1' },
      intent: {
        kind: 'public-action',
        publicActionId: STAR_CARRY_SKILL_ID,
        actionKind: 'star-carry',
        ...(level === undefined ? {} : { level }),
      },
      schedule: { mode: 'absolute', frame: 0 },
    },
  ];
  return contract;
}

function createTeamSlot(slotId, characterId, kiboId, initialSp) {
  return {
    slotId,
    characterId,
    level: 80,
    initialSp,
    loadout: { kiboId },
    cultivation: {},
  };
}

function readGuardValue(run) {
  return run.trace.effects.events.find(
    event =>
      event.effectId === GUARD_EFFECT_ID &&
      event.operation !== 'expire' &&
      event.modifiers.length > 0
  )?.modifiers[0]?.valueRaw;
}
