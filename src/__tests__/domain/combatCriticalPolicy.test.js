import { describe, expect, it } from 'vitest';
import { normalizeActionHitOverrides } from '../../domain/actionHitOverrides';
import {
  COMBAT_CRITICAL_POLICIES,
  COMBAT_CRITICAL_SCENARIO_CONTRACT,
  COMBAT_CRITICAL_SCENARIO_SCHEMA_VERSION,
  normalizeCombatCriticalScenario,
  resolveActionHitCriticalPolicy,
  validateCombatCriticalScenario,
} from '../../domain/combatCriticalPolicy';

describe('combat critical policy', () => {
  it('migrates an absent policy to the versioned non-critical contract', () => {
    expect(normalizeCombatCriticalScenario()).toEqual({
      schemaVersion: COMBAT_CRITICAL_SCENARIO_SCHEMA_VERSION,
      contractName: COMBAT_CRITICAL_SCENARIO_CONTRACT,
      policy: COMBAT_CRITICAL_POLICIES.NON_CRITICAL,
      seed: null,
      randomAlgorithm: 'seeded-xorshift32-stream-v1',
    });
  });

  it('requires an explicit seed only for sampled simulation', () => {
    expect(validateCombatCriticalScenario({ policy: 'sampled' })).toMatchObject(
      {
        valid: false,
        issues: [{ code: 'critical-sampled-seed-required' }],
      }
    );
    expect(
      validateCombatCriticalScenario({ policy: 'sampled', seed: 'run-7' })
    ).toMatchObject({
      valid: true,
      normalized: {
        policy: 'sampled',
        seed: 'run-7',
      },
    });
  });

  it('rejects unsupported versioned contract values instead of falling back', () => {
    expect(
      validateCombatCriticalScenario({
        schemaVersion: 2,
        contractName: 'UnknownCriticalContract',
        policy: 'sometimes',
        randomAlgorithm: 'ambient-random',
      })
    ).toMatchObject({
      valid: false,
      issues: [
        { code: 'critical-policy-unsupported' },
        { code: 'critical-schema-version-unsupported' },
        { code: 'critical-contract-name-unsupported' },
        { code: 'critical-random-algorithm-unsupported' },
      ],
    });
  });

  it('preserves legacy hit overrides while allowing a per-hit policy', () => {
    const overrides = normalizeActionHitOverrides({
      first: { willHit: false },
      second: { willHit: true, criticalPolicy: 'critical' },
    });

    expect(overrides).toEqual({
      first: { willHit: false },
      second: { willHit: true, criticalPolicy: 'critical' },
    });
    expect(
      resolveActionHitCriticalPolicy({ hitOverrides: overrides }, 'first')
    ).toBe('non-critical');
    expect(
      resolveActionHitCriticalPolicy(
        { hitOverrides: overrides },
        'second',
        'expected'
      )
    ).toBe('critical');
  });
});
