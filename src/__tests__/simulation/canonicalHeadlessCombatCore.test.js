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
import {
  CANONICAL_HEADLESS_COMBAT_COMPILATION_KIND,
  createCanonicalCombatTrace,
  createCanonicalHeadlessCombatCore,
} from '../../simulation/headless/canonicalHeadlessCombatCore';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG } from '../../simulation/mechanics/threeValueMechanicsProfileCatalog';

const MOYIN_CHARACTER_ID = 112001;
const MOYIN_SKILL_ID = 11200101;
const MOYIN_ULTIMATE_SKILL_ID = 11200113;
const MOYIN_MAPPING = verifiedCombatMechanicsPackage.actionMappings.find(
  mapping =>
    mapping.ownerId === MOYIN_CHARACTER_ID &&
    mapping.actionKind === 'normal-attack'
);
const MOYIN_A1 = MOYIN_MAPPING.attackInputSegments.find(
  segment => segment.sequenceIndex === 1
);
const MOYIN_HIT_IDENTITY = MOYIN_A1.selectedHitIdentities[0];

beforeEach(() => {
  installVerifiedCombatMechanicsPackage(verifiedCombatMechanicsPackage);
});

afterEach(() => {
  clearInstalledVerifiedCombatMechanicsPackage();
});

describe('canonical headless combat core', () => {
  it('projects damage-source fields required by optimization diagnostics', () => {
    const trace = createCanonicalCombatTrace({
      compilation: {
        dataIdentity: { packageId: 'synthetic' },
        scenario: {
          time: { fps: 60 },
          actors: [],
          enemy: {},
          actions: [],
          combatScenario: {},
        },
      },
      simulation: {
        scenario: { durationMs: 1000 },
        damageTimeline: [
          {
            timeMs: 500,
            rawDamage: 123,
            effectiveHpDamage: 123,
            elementId: 7,
            elementalType: 7,
            tuningKind: 'overlimit-damage',
            profileKey: 'thunder',
            markId: 250,
            markCount: 2,
            sourceKiboId: 500296,
            passiveSkillId: 50029661,
            battleEffectDot: false,
            kiboPassiveDerivedDot: true,
          },
        ],
      },
    });

    expect(trace.damage[0]).toMatchObject({
      tuningKind: 'overlimit-damage',
      tuningProfileKey: 'thunder',
      tuningMarkId: 250,
      tuningMarkCount: 2,
      elementalType: 7,
      sourceKiboId: 500296,
      passiveSkillId: 50029661,
      battleEffectDot: false,
      kiboPassiveDerivedDot: true,
    });
  });

  it('preserves applied and insufficient tuning judgments in canonical trace state', () => {
    const judgments = [
      {
        eventIdentity: 'judgment-173',
        actionId: 'ruby-ultimate',
        actorId: 'actor-103002',
        timeMs: 2883.333333,
        absoluteFrame: 173,
        controlSkillId: 10300213,
        subSkillIndex: 0,
        effectIdentity: 'battle-element:103002273',
        judgmentElementId: 103002273,
        judgmentPathId: '-8725062263845393396',
        triggerFrame: 173,
        behaviorPathId: '2818728561424649950',
        markId: 250,
        markCountAtJudgment: 1,
        minimumStacks: 1,
        maximumStacks: 1,
        consumedCount: 1,
        executed: true,
        applied: true,
        status: 'verified-tuning-consume-judgment-applied',
        sourceIdentity:
          'battle-effect:10300213:0:-8725062263845393396:2818728561424649950:173',
      },
      {
        eventIdentity: 'judgment-237',
        actionId: 'ruby-ultimate',
        actorId: 'actor-103002',
        timeMs: 3950,
        absoluteFrame: 237,
        controlSkillId: 10300213,
        subSkillIndex: 0,
        effectIdentity: 'battle-element:103002273',
        judgmentElementId: 103002273,
        judgmentPathId: '-8725062263845393396',
        triggerFrame: 237,
        behaviorPathId: '8489770418213277406',
        markId: 250,
        markCountAtJudgment: 0,
        minimumStacks: 1,
        maximumStacks: 1,
        consumedCount: 0,
        executed: true,
        applied: false,
        status: 'verified-tuning-consume-judgment-insufficient-marks',
        sourceIdentity:
          'battle-effect:10300213:0:-8725062263845393396:8489770418213277406:237',
      },
    ];
    const trace = createCanonicalCombatTrace({
      compilation: {
        dataIdentity: { packageId: 'synthetic' },
        scenario: {
          time: { fps: 60 },
          actors: [],
          enemy: {},
          actions: [],
          combatScenario: {},
        },
      },
      simulation: {
        scenario: { durationMs: 5000 },
        verifiedTuningMarkGeneration: {
          consumeJudgmentResults: judgments,
        },
      },
    });

    expect(trace.state.tuningConsumeJudgments).toHaveLength(2);
    expect(trace.state.tuningConsumeJudgments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventIdentity: 'judgment-173',
          controlSkillId: 10300213,
          subSkillIndex: 0,
          judgmentElementId: 103002273,
          triggerFrame: 173,
          behaviorPathId: '2818728561424649950',
          executed: true,
          applied: true,
          consumedCount: 1,
        }),
        expect.objectContaining({
          eventIdentity: 'judgment-237',
          controlSkillId: 10300213,
          subSkillIndex: 0,
          judgmentElementId: 103002273,
          triggerFrame: 237,
          behaviorPathId: '8489770418213277406',
          executed: true,
          applied: false,
          consumedCount: 0,
          status: 'verified-tuning-consume-judgment-insufficient-marks',
        }),
      ])
    );
  });

  it('projects verified normal-input authority evidence from runtime blocks', () => {
    const trace = createCanonicalCombatTrace({
      compilation: {
        dataIdentity: { packageId: 'synthetic' },
        scenario: {
          time: { fps: 60 },
          actors: [],
          enemy: {},
          actions: [],
          combatScenario: {},
        },
      },
      simulation: {
        scenario: { durationMs: 1000 },
        actionRuleDiagnostics: {
          diagnostics: [
            {
              id: 'normal-input-conflict|a1-restart',
              code: 'VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT',
              status: 'violated',
              severity: 'error',
              actionId: 'a1-restart',
              actionIds: ['a1-restart'],
              actorId: 'actor-112001',
              timeMs: 300,
              runtimeBlock: {
                reason: 'verified-normal-attack-input-phase-conflict',
                reasons: ['normal-attack-successor-window-target-conflict'],
                sourceKind: 'verified-normal-attack-direct-successor',
                sourceIdentity: 'verified:112001:a1-a2-window',
                formIdentity: 'normal-attack-form:0123456789abcdef',
                expectedAttackInput: { sequenceIndex: 2 },
                actualAttackInput: { sequenceIndex: 1 },
              },
            },
          ],
          summary: {},
        },
      },
    });

    expect(trace.diagnostics.actionRules.diagnostics).toContainEqual(
      expect.objectContaining({
        code: 'VERIFIED_NORMAL_ATTACK_INPUT_PHASE_CONFLICT',
        reason: 'verified-normal-attack-input-phase-conflict',
        reasons: ['normal-attack-successor-window-target-conflict'],
        sourceKind: 'verified-normal-attack-direct-successor',
        formIdentity: 'normal-attack-form:0123456789abcdef',
        expectedAttackInput: { sequenceIndex: 2 },
        actualAttackInput: { sequenceIndex: 1 },
      })
    );
  });

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
      actionId: 'verified-moyin-a1',
      hitIdentity: MOYIN_HIT_IDENTITY,
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
    expect(compilation.dataIdentity.normalAttackInputAuthority).toMatchObject({
      schemaVersion: expect.any(Number),
      contractName: expect.any(String),
      policyVersion: expect.any(Number),
      contractHash: expect.stringMatching(/^[0-9a-f]{16}$/),
    });
    expect(first.traceHash).toBe(second.traceHash);
    expect(first.hashes.evaluation).toBe(second.hashes.evaluation);
    expect(evaluation).toEqual(first.evaluation);
    expect(explanation).toMatchObject({
      kind: 'azpr-canonical-combat-explanation',
      traceHash: first.traceHash,
      actions: [{ id: 'verified-moyin-a1' }],
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
    timestampOnly.metadata.transport = {
      machineAxis: { schedulesByActionId: { action: { mode: 'absolute' } } },
    };
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

  it('rejects a kind-only forged compilation instead of trusting the marker string', () => {
    const core = createCore();
    const forged = {
      kind: CANONICAL_HEADLESS_COMBAT_COMPILATION_KIND,
      scenario: {},
      hashes: { input: 'forged-input', data: 'forged-data' },
    };

    expect(() => core.compile(forged)).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'canonical-compilation-not-authoritative',
          }),
        ]),
      })
    );
  });

  it('rejects raw Kibo and switch derivation registries from a forged compiler implementation', () => {
    const core = createCanonicalHeadlessCombatCore({
      gameData: getWorkbenchGameData(),
      compileProjectImpl: () => ({
        actors: [],
        actions: [],
        diagnostics: {},
        combatScenario: {},
        kiboAutoCastDerivationRegistry: {
          contractName: 'AzPrVerifiedKiboAutoCastDerivationRegistry',
          registryHash: 'self-signed-registry',
        },
        switchTriggerGeneration: {
          contractName: 'AzPrSwitchTriggeredActionGeneration',
          generationHash: 'self-signed-generation',
        },
      }),
    });

    expect(() => core.compile(createVerifiedProject())).toThrowError(
      expect.objectContaining({
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: 'canonical-kibo-auto-cast-registry-not-authoritative',
          }),
          expect.objectContaining({
            code: 'canonical-switch-trigger-generation-not-authoritative',
          }),
        ]),
      })
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

  it('creates a sampled stream for a real per-hit override under a non-critical scenario', () => {
    const core = createCore();
    const run = core.simulate(
      createVerifiedProject({
        critical: { policy: 'non-critical', seed: 'per-hit-seed' },
        hitOverrides: {
          [MOYIN_HIT_IDENTITY]: {
            willHit: true,
            criticalPolicy: 'sampled',
          },
        },
      })
    );
    const branch = getRandomBranch(run);

    expect(run.validationIssues ?? []).toEqual([]);
    expect(getDamage(run)).toBeGreaterThan(0);
    expect(branch).toMatchObject({
      policy: 'seeded-sampled',
      randomSeed: 'per-hit-seed',
      criticalStreamIndex: 0,
      criticalRoll: expect.any(Number),
      criticalThreshold: expect.any(Number),
    });
  });

  it('rejects a sampled per-hit override without a seed during validate', () => {
    const core = createCore();
    const project = createVerifiedProject({
      critical: { policy: 'non-critical' },
      hitOverrides: {
        [MOYIN_HIT_IDENTITY]: {
          willHit: true,
          criticalPolicy: 'sampled',
        },
      },
    });

    expect(core.validate(project)).toMatchObject({
      valid: false,
      issues: [{ code: 'critical-sampled-seed-required' }],
    });
    expect(() => core.simulate(project)).toThrow(
      'Canonical headless combat input is invalid'
    );
  });

  it('starts the final sampled stream at zero after resource preflight blocks an action', () => {
    const core = createCore();
    const onlyHit = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'preflight-isolation' },
      })
    );
    const withBlockedUltimate = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'preflight-isolation' },
        includeBlockedUltimate: true,
      })
    );
    const onlyBranch = getRandomBranch(onlyHit);
    const blockedBranch = getRandomBranch(withBlockedUltimate);

    expect(
      withBlockedUltimate.simulation.verifiedCombatRuntime.executionBlocks
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'm11-blocked-moyin-ultimate',
        }),
      ])
    );
    expect(blockedBranch.criticalStreamIndex).toBe(0);
    expect(blockedBranch.criticalRoll).toBe(onlyBranch.criticalRoll);
    expect(blockedBranch.critical).toBe(onlyBranch.critical);
    expect(getDamage(withBlockedUltimate)).toBe(getDamage(onlyHit));
    expect(
      withBlockedUltimate.trace.damage.find(
        event => event.actionId === 'verified-moyin-a1'
      )?.formula.randomBranch
    ).toEqual(
      onlyHit.trace.damage.find(event => event.actionId === 'verified-moyin-a1')
        ?.formula.randomBranch
    );
  });

  it('reads enemy CRI_DEFENSE for the real hit and exposes the full threshold trace', () => {
    const core = createCore();
    const baseline = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'defense-seed' },
        targetCriticalDefenseRaw: 0,
      })
    );
    const defended = core.simulate(
      createVerifiedProject({
        critical: { policy: 'sampled', seed: 'defense-seed' },
        targetCriticalDefenseRaw: 1250,
      })
    );
    const baselineBranch = getRandomBranch(baseline);
    const defendedBranch = getRandomBranch(defended);

    expect(baselineBranch).toMatchObject({
      sourceCriticalRate: expect.any(Number),
      targetCriticalRateDefense: 0,
      criticalThreshold: expect.any(Number),
      criticalRoll: expect.any(Number),
    });
    expect(defendedBranch).toMatchObject({
      sourceCriticalRate: baselineBranch.sourceCriticalRate,
      targetCriticalRateDefense: 0.125,
      criticalRoll: baselineBranch.criticalRoll,
    });
    expect(defendedBranch.criticalThreshold).toBe(
      Math.max(0, baselineBranch.criticalThreshold - 1250)
    );
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
          [MOYIN_HIT_IDENTITY]: {
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
      hitIdentity: MOYIN_HIT_IDENTITY,
    });
    expect(getDamage(overridden)).toBe(getDamage(nonCritical));
    expect(getRandomBranch(expected)).toMatchObject({
      policy: 'expected',
      expected: true,
      criticalRoll: null,
      sourceCriticalDamageMultiplier: 1.5,
      sourceCriticalDamageBasisPoints: 15000,
    });
    expect(getFormula(expected)).toMatchObject({
      mode: 'normal-expected-critical',
      expectedCritical: {
        probabilityBasisPoints: expect.any(Number),
        nonCriticalRaw: expect.any(String),
        nonCriticalValue: expect.any(Number),
        criticalRaw: expect.any(String),
        criticalValue: expect.any(Number),
        weightedRaw: expect.any(String),
        weightedValue: expect.any(Number),
        weightedInteger: expect.any(String),
        criticalEventMaterialized: false,
      },
    });
    expect(getFormula(expected).expectedCritical.weightedValue).toBe(
      getDamage(expected)
    );
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

function createVerifiedProject({
  critical = null,
  hitOverrides = null,
  includeBlockedUltimate = false,
  targetCriticalDefenseRaw = null,
} = {}) {
  const selection = {
    ...DEFAULT_WORKBENCH_SELECTION,
    characterId: MOYIN_CHARACTER_ID,
    skillId: MOYIN_SKILL_ID,
  };
  const teamSlots = createDefaultWorkbenchTeamSlots(selection);
  const actorConfigs = createDefaultWorkbenchActorConfigs(selection).map(
    config => ({ ...config, initialSp: 0 })
  );
  const action = createWorkbenchActionDraft({
    id: 'verified-moyin-a1',
    type: 'skill',
    actorCharacterId: MOYIN_CHARACTER_ID,
    skillId: MOYIN_SKILL_ID,
    actionVariantIndex: 0,
    startMs: 0,
    durationMs: (MOYIN_A1.durationFrames * 1000) / 60,
    durationFrames: MOYIN_A1.durationFrames,
    attackGroupId: 'm11-moyin-chain',
    attackSequenceIndex: MOYIN_A1.sequenceIndex,
    attackSequenceTotal: MOYIN_A1.sequenceTotal,
    attackInput: MOYIN_A1,
    actionScheduling: MOYIN_A1.actionScheduling,
    hitOverrides,
  });
  const actions = [action];
  if (includeBlockedUltimate) {
    actions.push(
      createWorkbenchActionDraft({
        id: 'm11-blocked-moyin-ultimate',
        type: 'skill',
        actorCharacterId: MOYIN_CHARACTER_ID,
        skillId: MOYIN_ULTIMATE_SKILL_ID,
        actionVariantIndex: 0,
        startMs: 600,
        durationMs: 800,
      })
    );
  }
  const project = createWorkbenchProject(selection, {
    durationMs: 2000,
    teamSlots,
    actorConfigs,
    actions,
    initialRuntimeState: {
      controlledActor: {
        actorId: `actor-${MOYIN_CHARACTER_ID}`,
        characterId: MOYIN_CHARACTER_ID,
      },
    },
    combatScenario: {
      projectile: { targetDistance: 0, defaultWillHit: true },
      critical,
    },
    mechanicsProfileSelection:
      createVerifiedWorkbenchMechanicsProfileSelection(),
  });
  if (targetCriticalDefenseRaw != null) {
    const existing = project.enemy.baseAttributes.find(
      attribute => attribute.key === 'CRI_DEFENSE'
    );
    if (existing) existing.value = targetCriticalDefenseRaw;
    else {
      project.enemy.baseAttributes.push({
        id: 102,
        key: 'CRI_DEFENSE',
        name: '暴击抵抗',
        value: targetCriticalDefenseRaw,
        isRatio: true,
      });
    }
  }
  return project;
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
