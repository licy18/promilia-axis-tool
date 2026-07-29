import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import verifiedCombatMechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createVerifiedWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createDefaultWorkbenchActorConfigs,
  createDefaultWorkbenchTeamSlots,
  createWorkbenchActionDraft,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { WORKBENCH_HEADLESS_COMBAT_CORE } from '../../features/workbench/workbenchHeadlessCombatCore';
import { createCanonicalHeadlessCombatCore } from '../../simulation/headless/canonicalHeadlessCombatCore';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG } from '../../simulation/mechanics/threeValueMechanicsProfileCatalog';

const PANGPANG_CHARACTER_ID = 101007;
const PANGPANG_SKILL_ID = 10100701;
const PANGPANG_MAPPING = verifiedCombatMechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === PANGPANG_CHARACTER_ID &&
    mapping.actionKind === 'normal-attack'
);
const PANGPANG_A3 = PANGPANG_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 3
);
const PANGPANG_HIT_IDENTITY = PANGPANG_A3.selectedHitIdentities[0];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('canonical headless combat core', () => {
  it('exposes one deterministic catalog/compile/validate/simulate/evaluate/explain contract', () => {
    const core = createCore();
    const project = createVerifiedProject();
    const catalog = core.catalog();
    const validation = core.validate(project);
    const compilation = core.compile(project);
    const first = core.simulate(compilation);
    const second = core.simulate(project);
    const evaluation = core.evaluate(first);
    const explanation = core.explain(first, {
      actionId: 'verified-pangpang-a3',
      hitIdentity: PANGPANG_HIT_IDENTITY,
    });

    expect(catalog).toMatchObject({
      kind: 'azpr-canonical-combat-catalog',
      catalogHash: expect.any(String),
      summary: {
        characterCount: expect.any(Number),
        skillCount: expect.any(Number),
      },
    });
    expect(validation).toMatchObject({
      valid: true,
      inputHash: compilation.hashes.input,
    });
    expect(first.traceHash).toBe(second.traceHash);
    expect(first.hashes.evaluation).toBe(second.hashes.evaluation);
    expect(evaluation).toEqual(first.evaluation);
    expect(explanation).toMatchObject({
      kind: 'azpr-canonical-combat-explanation',
      traceHash: first.traceHash,
      actions: [{ id: 'verified-pangpang-a3' }],
    });
    expect(explanation.damage).toHaveLength(1);
  });

  it('ignores document timestamps but hashes semantic combat changes', () => {
    const core = createCore();
    const first = createVerifiedProject();
    first.metadata.createdAt = '2026-07-29T00:00:00.000Z';
    first.metadata.updatedAt = '2026-07-29T00:00:00.000Z';
    const timestampOnly = structuredClone(first);
    timestampOnly.metadata.createdAt = '2026-07-30T00:00:00.000Z';
    timestampOnly.metadata.updatedAt = '2026-07-30T00:00:00.000Z';
    const changedAction = structuredClone(timestampOnly);
    changedAction.actions[0].startMs = 100;

    expect(core.compile(timestampOnly).hashes.input).toBe(
      core.compile(first).hashes.input
    );
    expect(core.simulate(timestampOnly).traceHash).toBe(
      core.simulate(first).traceHash
    );
    expect(core.compile(changedAction).hashes.input).not.toBe(
      core.compile(first).hashes.input
    );
  });

  it('gives Node and Workbench the same trace for the same semantic project', () => {
    const project = createVerifiedProject();
    const nodeRun = createCore().simulate(project);
    const workbenchRun = WORKBENCH_HEADLESS_COMBAT_CORE.simulate(project);

    expect(workbenchRun.inputHash).toBe(nodeRun.inputHash);
    expect(workbenchRun.dataHash).toBe(nodeRun.dataHash);
    expect(workbenchRun.traceHash).toBe(nodeRun.traceHash);
    expect(workbenchRun.trace).toEqual(nodeRun.trace);
  });

  it('replays sampled critical rolls by seed and records the exact roll', () => {
    const core = createCore();
    const first = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'm11-seed-a' },
      })
    );
    const repeated = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'm11-seed-a' },
      })
    );
    const other = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'm11-seed-b' },
      })
    );
    const firstBranch = getRandomBranch(first);
    const repeatedBranch = getRandomBranch(repeated);
    const otherBranch = getRandomBranch(other);

    expect(first.traceHash).toBe(repeated.traceHash);
    expect(firstBranch).toMatchObject({
      policy: 'seeded-sampled',
      randomSeed: 'm11-seed-a',
      randomAlgorithm: 'seeded-xorshift32-stream-v1',
      criticalStreamIndex: 0,
      criticalRoll: expect.any(Number),
      criticalThreshold: expect.any(Number),
    });
    expect(repeatedBranch.criticalRoll).toBe(firstBranch.criticalRoll);
    expect(otherBranch.criticalRoll).not.toBe(firstBranch.criticalRoll);
    expect(other.traceHash).not.toBe(first.traceHash);
  });

  it('rejects sampled simulation without a seed before compilation', () => {
    const core = createCore();
    const project = createVerifiedProject({
      critical: { policy: 'sampled' },
    });

    expect(core.validate(project)).toMatchObject({
      valid: false,
      issues: [{ code: 'critical-sampled-seed-required' }],
    });
    expect(() => core.compile(project)).toThrow(
      'Canonical headless combat input is invalid'
    );
  });

  it('rejects an unsupported critical policy before normalization', () => {
    const core = createCore();
    const project = createVerifiedProject();
    project.combatScenario.critical = {
      schemaVersion: 1,
      policy: 'typo-critical',
    };

    expect(core.validate(project)).toMatchObject({
      valid: false,
      issues: [{ code: 'critical-policy-unsupported' }],
    });
    expect(() => core.compile(project)).toThrow(
      'Canonical headless combat input is invalid'
    );
  });

  it('supports forced, expected, and per-hit override semantics', () => {
    const core = createCore();
    const nonCritical = core.simulate(
      createVerifiedProject({
        critical: { policy: 'non-critical' },
      })
    );
    const critical = core.simulate(
      createVerifiedProject({
        critical: { policy: 'critical' },
      })
    );
    const expected = core.simulate(
      createVerifiedProject({
        critical: { policy: 'expected' },
      })
    );
    const overridden = core.simulate(
      createVerifiedProject({
        critical: { policy: 'critical' },
        hitOverrides: {
          [PANGPANG_HIT_IDENTITY]: {
            willHit: true,
            criticalPolicy: 'non-critical',
          },
        },
      })
    );

    expect(getDamage(critical)).toBeGreaterThan(getDamage(nonCritical));
    expect(getRandomBranch(critical)).toMatchObject({
      policy: 'forced-critical',
      critical: true,
    });
    expect(getRandomBranch(overridden)).toMatchObject({
      policy: 'deterministic-non-critical-baseline',
      critical: false,
      hitIdentity: PANGPANG_HIT_IDENTITY,
    });
    expect(getDamage(overridden)).toBe(getDamage(nonCritical));
    expect(getRandomBranch(expected)).toMatchObject({
      policy: 'expected',
      expected: true,
      criticalRoll: null,
    });
    expect(getFormula(expected)).toMatchObject({
      mode: 'normal-expected-critical',
      expectedCritical: {
        criticalEventMaterialized: false,
      },
    });
    expect(getDamage(expected)).toBeGreaterThanOrEqual(getDamage(nonCritical));
    expect(getDamage(expected)).toBeLessThanOrEqual(getDamage(critical));
  });
});

function createCore() {
  return createCanonicalHeadlessCombatCore({
    gameData: getWorkbenchGameData(),
    compileOptions: {
      threeValueMechanicsProfileCatalog:
        DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
    },
  });
}

function createVerifiedProject({ critical = null, hitOverrides = null } = {}) {
  const teamSlots = createDefaultWorkbenchTeamSlots();
  const actorConfigs = createDefaultWorkbenchActorConfigs(
    DEFAULT_WORKBENCH_SELECTION
  ).map(config => ({ ...config, initialSp: 0 }));
  const action = createWorkbenchActionDraft({
    id: 'verified-pangpang-a3',
    type: 'skill',
    actorCharacterId: PANGPANG_CHARACTER_ID,
    skillId: PANGPANG_SKILL_ID,
    actionVariantIndex: 0,
    startMs: 0,
    durationMs: (PANGPANG_A3.durationFrames * 1000) / 60,
    durationFrames: PANGPANG_A3.durationFrames,
    attackGroupId: 'm11-pangpang-chain',
    attackSequenceIndex: PANGPANG_A3.sequenceIndex,
    attackSequenceTotal: PANGPANG_A3.sequenceTotal,
    attackInput: PANGPANG_A3,
    actionScheduling: PANGPANG_A3.actionScheduling,
    hitOverrides,
  });
  return createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
    durationMs: 2000,
    teamSlots,
    actorConfigs,
    actions: [action],
    combatScenario: {
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical,
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
}

function getDamage(run) {
  return run.simulation.verifiedCombatRuntime.damageEvents[0].payload.rawDamage;
}

function getFormula(run) {
  return run.simulation.verifiedCombatRuntime.damageEvents[0].payload
    .formulaBreakdown.verifiedResult;
}

function getRandomBranch(run) {
  return run.simulation.verifiedCombatRuntime.damageEvents[0].payload
    .formulaBreakdown.randomBranch;
}
