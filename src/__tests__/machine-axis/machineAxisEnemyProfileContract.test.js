import { describe, expect, it } from 'vitest';

import {
  createMachineAxisEnemyProfile,
  validateMachineAxisEnemyProfile,
} from '../../machine-axis/machineAxisEnemyProfileContract';

function createResolvedProfile(overrides = {}) {
  return createMachineAxisEnemyProfile({
    profileId: 'enemy:300032:level:80',
    enemyId: 300032,
    level: 80,
    source: {
      status: 'authoritative-resolved',
      kind: 'enemy-level-pipeline',
      identity: 'feature/m12-b3-enemy-level#enemy:300032:level:80',
      hash: 'enemy-level-output-hash',
    },
    attributes: {
      maxHp: 1000,
      physicalDefense: 250,
      magicalDefense: 300,
      maxToughness: 100,
      elementDefenses: { FIRE_DEFENSE: 500 },
    },
    breakRules: {
      recoveryDelayMs: 100,
      recoveryRateBasisPoints: 1000,
      breakTimeMs: 1000,
      breakEndTimeMs: 200,
      breakDamageUpBasisPoints: 10000,
      weaknessDamageMaximum: 100,
      weaknessDamageMinimum: 1,
      typeMultipliersBasisPoints: { normal: 10000 },
      elementMultipliersBasisPoints: { fire: 10000 },
    },
    ...overrides,
  });
}

describe('Machine Axis enemy profile contract', () => {
  it('creates a deterministic, source-bound, fully resolved profile', () => {
    const first = createResolvedProfile();
    const second = createResolvedProfile();

    expect(first).toEqual(second);
    expect(first.profileHash).toMatch(/^[0-9a-f]{16}$/);
    expect(
      validateMachineAxisEnemyProfile(first, {
        scenarioEnemy: { enemyId: 300032, level: 80 },
      })
    ).toMatchObject({ valid: true, issues: [] });
  });

  it('fail-closes renamed fields, hash drift, and scenario identity drift', () => {
    const profile = createResolvedProfile();
    const renamed = structuredClone(profile);
    renamed.attributes.defense = renamed.attributes.physicalDefense;
    delete renamed.attributes.physicalDefense;
    const renamedResult = validateMachineAxisEnemyProfile(renamed);
    expect(renamedResult.valid).toBe(false);
    expect(renamedResult.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-enemy-profile-additional-property',
          path: 'scenario.enemy.profile.attributes.defense',
        }),
        expect.objectContaining({
          code: 'machine-axis-enemy-profile-property-required',
          path: 'scenario.enemy.profile.attributes.physicalDefense',
        }),
      ])
    );

    const drifted = structuredClone(profile);
    drifted.attributes.maxHp = 2000;
    expect(validateMachineAxisEnemyProfile(drifted).issues).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-enemy-profile-hash-mismatch',
      })
    );
    expect(
      validateMachineAxisEnemyProfile(profile, {
        scenarioEnemy: { enemyId: 300032, level: 81 },
      }).issues
    ).toContainEqual(
      expect.objectContaining({
        code: 'machine-axis-enemy-profile-level-mismatch',
      })
    );
  });

  it('changes the profile hash when actual defense changes', () => {
    const baseline = createResolvedProfile();
    const higherDefense = createResolvedProfile({
      attributes: {
        ...baseline.attributes,
        physicalDefense: 500,
      },
    });

    expect(higherDefense.profileHash).not.toBe(baseline.profileHash);
  });
});
