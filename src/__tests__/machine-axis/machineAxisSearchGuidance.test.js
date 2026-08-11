import cycleFixture from '../../../fixtures/machine-axis/m12-cycle-dps-example.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createMachineAxisSearchEngine } from '../../machine-axis/machineAxisSearchEngine';
import {
  applySearchGuidance,
  buildActionFilterFromGuidance,
  createSearchFeedback,
  hashSearchGuidance,
  normalizeSearchGuidance,
} from '../../machine-axis/machineAxisSearchGuidance';
import { describe, expect, it } from 'vitest';

const BASE_GUIDANCE = {
  guidanceVersion: '1.0.0',
  objective: 'cycle-dps-no-toughness',
  layer: 'inner',
  budget: {
    beamWidth: 8,
    topN: 5,
    maxDepth: 24,
    maxActionsPerOwner: 6,
    maxKiboActions: 3,
    maxWaitCandidates: 6,
    maxDamagePerMsBound: 10,
    includeKibo: true,
    includeSwitch: true,
    includeNormalAttacks: true,
    includeWait: true,
  },
  actionFilters: {
    blockedActionKinds: ['dodge-attack'],
  },
  kiboPolicy: {
    blockedKiboIds: [500001],
  },
  provenance: {
    authority: 'ai-agent',
    agentId: 'test-agent',
    rationale: 'unit test guidance',
  },
};

describe('machine axis AI-guided search protocol', () => {
  it('normalizes guidance and produces a stable canonical hash', () => {
    const first = normalizeSearchGuidance(BASE_GUIDANCE);
    const second = normalizeSearchGuidance(
      JSON.parse(JSON.stringify(BASE_GUIDANCE))
    );

    expect(first.valid).toBe(true);
    expect(first.issues).toEqual([]);
    expect(first.guidance.contractName).toBe('AzPrMachineAxisSearchGuidance');
    expect(first.guidanceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(second.guidanceHash).toBe(first.guidanceHash);
    expect(hashSearchGuidance(BASE_GUIDANCE)).toBe(first.guidanceHash);
  });

  it('rejects invalid budget fields and unknown provenance authority', () => {
    const invalid = normalizeSearchGuidance({
      ...BASE_GUIDANCE,
      budget: { ...BASE_GUIDANCE.budget, beamWidth: 0 },
      provenance: { authority: 'human' },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.issues).toEqual(
      expect.arrayContaining([
        'machine-axis-search-guidance-budget-beamWidth-invalid',
        'machine-axis-search-guidance-provenance-authority-invalid',
      ])
    );
  });

  it('applies guidance onto engine options and records applied rules', () => {
    const applied = applySearchGuidance(
      { objective: 'fastest-kill' },
      {
        ...BASE_GUIDANCE,
        objective: 'cycle-dps-no-toughness',
        budget: { beamWidth: 12, topN: 3 },
      }
    );

    expect(applied.options.objective).toBe('cycle-dps-no-toughness');
    expect(applied.options.beamWidth).toBe(12);
    expect(applied.options.topN).toBe(3);
    expect(applied.appliedRules).toEqual(
      expect.arrayContaining([
        'objective=cycle-dps-no-toughness',
        'budget.beamWidth=12',
        'budget.topN=3',
        'actionFilters.applied',
        'kiboPolicy.applied',
      ])
    );
    expect(applied.guidanceHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() =>
      applySearchGuidance({}, { budget: { beamWidth: -1 } })
    ).toThrow(/Invalid machine axis search guidance/);
  });

  it('builds an action filter that honors kinds, ids, per-owner rules, and kibo policy', () => {
    const filter = buildActionFilterFromGuidance({
      ...BASE_GUIDANCE,
      actionFilters: {
        allowedActionKinds: ['normal-attack', 'star-skill'],
        blockedPublicActionIds: [10101012],
        perOwner: {
          101010: { allowedPublicActionIds: [10101001] },
        },
      },
      kiboPolicy: { allowedKiboIds: [500469] },
    });

    expect(
      filter.character(
        { actionKind: 'ultimate', publicActionId: 10101013 },
        101010
      )
    ).toBe(false);
    expect(
      filter.character(
        { actionKind: 'star-skill', publicActionId: 10101012 },
        101010
      )
    ).toBe(false);
    expect(
      filter.character(
        { actionKind: 'normal-attack', publicActionId: 10101001 },
        101010
      )
    ).toBe(true);
    expect(
      filter.character(
        { actionKind: 'normal-attack', publicActionId: 10101001 },
        103002
      )
    ).toBe(true);
    expect(filter.kibo({}, 500001)).toBe(false);
    expect(filter.kibo({}, 500469)).toBe(true);
  });

  it('runs an end-to-end guided search and emits bound feedback', async () => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    const service = createMachineAxisService();
    const engine = createMachineAxisSearchEngine({ service });
    const guidance = {
      ...BASE_GUIDANCE,
      budget: {
        beamWidth: 2,
        topN: 2,
        maxDepth: 2,
        maxActionsPerOwner: 1,
        maxKiboActions: 1,
        maxWaitCandidates: 1,
        maxDamagePerMsBound: 10,
        includeKibo: false,
        includeSwitch: true,
        includeNormalAttacks: true,
        includeWait: false,
      },
    };
    const result = await engine.search({
      contract: cycleFixture.contract,
      options: { guidance },
    });

    expect(result.summary.guidance).toMatchObject({
      guidanceHash: hashSearchGuidance(guidance),
      appliedRules: expect.arrayContaining(['budget.beamWidth=2']),
    });
    expect(result.summary.beamWidth).toBe(2);
    expect(result.summary.topN).toBe(2);

    const applied = applySearchGuidance({ guidance }, guidance);
    const feedback = createSearchFeedback({
      result,
      guidanceApplication: applied,
    });
    expect(feedback.guidanceHash).toBe(hashSearchGuidance(guidance));
    expect(feedback.budgetUsage).toMatchObject({
      beamWidth: 2,
      topN: 2,
      maxDepth: 2,
    });
    expect(feedback.outer).toMatchObject({
      implemented: true,
      searchIntegrationImplemented: false,
      status: 'm12-c1-c2-pool-ready-search-integration-pending',
    });
    expect(Array.isArray(feedback.recommendations)).toBe(true);
  }, 30_000);
});
