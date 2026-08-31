import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import {
  clearInstalledVerifiedCombatMechanicsPackage,
  installVerifiedCombatMechanicsPackage,
} from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createM12cBuildSearchContract,
  createM12cCultivationProfileFromBuild,
  createM12cOuterSearchService,
  createM12cSearchVariantKey,
} from '../../machine-axis/m12cOuterSearchService';
import { createM12cOuterBuildService } from '../../machine-axis/m12cOuterBuildService';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('M12-C outer search integration', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  afterEach(() => {
    clearInstalledVerifiedCombatMechanicsPackage();
  });

  it('binds one authoritative build into a formal axis for every initial front', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const { build } = createSingleBuild(outerBuildService);
    const service = createM12cOuterSearchService({
      machineAxisService: createMachineAxisService(),
      outerBuildService,
    });
    const bindings = [];

    for (const actor of build.actors) {
      bindings.push(
        await service.bind({
          contract: createTemplate(),
          build,
          objective: 'cycle-dps-no-toughness',
          initialFrontOptimizationObjectId: actor.optimizationObjectId,
          initialState: { presetId: 'm12c-outer-cold-start-v1' },
        })
      );
    }

    expect(bindings).toHaveLength(3);
    expect(new Set(bindings.map(binding => binding.variantKey)).size).toBe(3);
    expect(
      new Set(
        bindings.map(
          binding => binding.contract.scenario.initialStatePreset.presetHash
        )
      ).size
    ).toBe(1);
    for (const binding of bindings) {
      expect(binding.valid).toBe(true);
      expect(binding.contract).toMatchObject({
        kind: 'azpr-machine-axis',
        scenario: {
          fps: 60,
          enemy: { enemyId: 310054, level: 80 },
          optimizationQualification: { mode: 'formal' },
          objectiveContract: {
            objectiveId: 'cycle-dps-no-toughness',
          },
          initialRuntimeState: {
            controlledActor: {
              characterId: binding.initialFront.sourceCharacterId,
            },
            kiboEnergyBySlot: expect.arrayContaining([
              expect.objectContaining({ currentValue: 0, maxValue: 100 }),
            ]),
          },
          cultivationProfile: {
            contractName: 'AzPrOptimizationCultivationProfile',
            actors: expect.arrayContaining([
              expect.objectContaining({
                character: expect.objectContaining({
                  level: 80,
                  starGiftRank: 7,
                }),
                kibo: expect.objectContaining({
                  level: 80,
                  bondLevel: 1,
                  dnaFactors: [],
                }),
                soulEssence: expect.objectContaining({
                  level: 80,
                  rank: 6,
                  star: 1,
                }),
              }),
            ]),
          },
        },
        metadata: {
          m12c: {
            buildHash: build.buildHash,
            initialFront: binding.initialFront,
          },
        },
      });
      expect(binding.contract.scenario.team).toHaveLength(3);
      expect(binding.contract.scenario.cultivationProfile.actors).toHaveLength(
        3
      );
      expect(binding.contract.actions).toEqual([]);
    }
  }, 120_000);

  it('runs three front variants, aggregates one global Top-N, and embeds the full build', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const { buildConstraints, sourceConfig } =
      createSingleBuild(outerBuildService);
    const searchCalls = [];
    const createSearchEngine = vi.fn(() => ({
      search: vi.fn(async ({ contract, options }) => {
        searchCalls.push({ contract, options });
        const front = contract.metadata.m12c.initialFront.sourceCharacterId;
        return createFakeInnerResult(contract, front);
      }),
    }));
    const fakeMachineAxisService = {
      prepare: contract => ({ valid: true, issues: [], contract }),
      simulate: vi.fn(),
      validate: () => ({
        valid: true,
        issues: [],
        warnings: [],
        classification: null,
      }),
    };
    const service = createM12cOuterSearchService({
      machineAxisService: fakeMachineAxisService,
      outerBuildService,
      createSearchEngine,
      createSearchReport: createFakeSearchReport,
    });

    const report = await service.search({
      schemaVersion: 1,
      contractName: 'AzPrM12COuterSearchRequest',
      kind: 'azpr-m12c-outer-search',
      contract: createTemplate({ withEnemyProfile: true }),
      options: {
        objective: 'cycle-dps-no-toughness',
        topN: 2,
        beamWidth: 1,
        maxDepth: 1,
      },
      outer: {
        sourceConfigIdentities: [sourceConfig.sourceConfigIdentity],
        maxSourceConfigs: 1,
        maxBuildsPerSourceConfig: 1,
        maxBuildsTotal: 1,
        maxVariantSearches: 3,
      },
      buildConstraints,
      initialState: {
        actorSpByOptimizationObjectId: { 109001: 100 },
      },
    });

    expect(searchCalls).toHaveLength(3);
    expect(
      new Set(
        searchCalls.map(
          call => call.contract.metadata.m12c.initialFront.optimizationObjectId
        )
      ).size
    ).toBe(3);
    expect(report).toMatchObject({
      valid: true,
      kind: 'azpr-m12c-outer-search-report',
      objective: 'cycle-dps-no-toughness',
      summary: {
        buildCount: 1,
        variantSearchCount: 3,
        candidateResultCount: 3,
        topResultCount: 2,
        failureCount: 0,
        enumerationComplete: true,
        fullPoolEnumerationComplete: false,
        formalRankingReady: false,
        rankingStatus: 'bounded-domain-top-n-ready-not-full-pool',
        outerSearchIntegration: {
          implemented: true,
          buildContractBound: true,
          allInitialFrontsBound: true,
          globalTopNBound: true,
        },
      },
      pool: { poolHash: expect.any(String) },
      executionLedger: {
        processedVariantKeys: expect.arrayContaining([
          expect.stringMatching(/^m12c-variant:/),
        ]),
      },
    });
    expect(report.results).toHaveLength(2);
    expect(report.results[0].score).toBeGreaterThanOrEqual(
      report.results[1].score
    );
    expect(report.results[0].m12c).toMatchObject({
      buildHash: expect.any(String),
      sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      fixedCultivationProfile: expect.any(Object),
      build: expect.objectContaining({
        buildHash: expect.any(String),
        actors: expect.any(Array),
      }),
    });
    expect(report.results[0].m12c.build.buildHash).toBe(
      report.results[0].m12c.buildHash
    );
  }, 60_000);

  it('routes the real inner engine without autonomous Kibo actions or cadence blockers', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const { buildConstraints, sourceConfig } =
      createSingleBuild(outerBuildService);
    const service = createM12cOuterSearchService({
      machineAxisService: createMachineAxisService(),
      outerBuildService,
    });

    const report = await service.search({
      contract: createTemplate(),
      options: {
        objective: 'cycle-dps-no-toughness',
        beamWidth: 1,
        topN: 1,
        maxDepth: 1,
        maxActionsPerOwner: 1,
        maxKiboActions: 1,
        includeKibo: false,
        includeSwitch: false,
        includeNormalAttacks: true,
        includeWait: false,
      },
      outer: {
        sourceConfigIdentities: [sourceConfig.sourceConfigIdentity],
        maxSourceConfigs: 1,
        maxBuildsPerSourceConfig: 1,
        maxBuildsTotal: 1,
        maxVariantSearches: 3,
      },
      buildConstraints,
    });

    expect(report.valid).toBe(true);
    expect(report.results).toHaveLength(1);
    expect(report.results[0]).toMatchObject({
      score: expect.any(Number),
      m12c: {
        buildHash: expect.any(String),
        sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
      },
    });
    expect(report.failures).toEqual([
      expect.objectContaining({
        stage: 'inner-search-empty',
        issues: expect.arrayContaining([
          'machine-axis-cycle-action-form-not-closed',
        ]),
      }),
    ]);
    expect(report.failures[0].issues).not.toContain(
      'kibo-auto-cast-schedule-unresolved'
    );
    expect(report.summary).toMatchObject({
      buildCount: 1,
      variantSearchCount: 3,
      candidateResultCount: 2,
      failureCount: 1,
      enumerationComplete: true,
      formalRankingReady: false,
    });
    expect(report.executionLedger).toMatchObject({
      processedVariantKeyCount: 3,
      processedVariantKeys: expect.arrayContaining([
        expect.stringMatching(/^m12c-variant:/),
      ]),
      processedVariantKeysTruncated: false,
    });
  }, 120_000);

  it('applies outer guidance budgets without leaking an outer-only inner budget', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const { buildConstraints, sourceConfig } =
      createSingleBuild(outerBuildService);
    const searchCalls = [];
    const service = createM12cOuterSearchService({
      machineAxisService: {
        prepare: contract => ({ valid: true, issues: [], contract }),
        simulate: vi.fn(),
        validate: () => ({ valid: true, issues: [], warnings: [] }),
      },
      outerBuildService,
      createSearchEngine: () => ({
        search: async ({ contract, options }) => {
          searchCalls.push(options);
          return createFakeInnerResult(
            contract,
            contract.metadata.m12c.initialFront.sourceCharacterId
          );
        },
      }),
      createSearchReport: createFakeSearchReport,
    });

    const report = await service.search({
      contract: createTemplate({ withEnemyProfile: true }),
      options: {
        objective: 'cycle-dps-no-toughness',
        beamWidth: 7,
        topN: 1,
        maxDepth: 1,
      },
      guidance: {
        layer: 'outer',
        budget: { beamWidth: 99 },
        outer: {
          sourceConfigIdentities: [sourceConfig.sourceConfigIdentity],
          maxSourceConfigs: 1,
          maxBuildsPerSourceConfig: 1,
          maxBuildsTotal: 1,
          maxVariantSearches: 3,
        },
      },
      buildConstraints,
    });

    expect(report.guidance).toMatchObject({ layer: 'outer' });
    expect(searchCalls).toHaveLength(3);
    expect(searchCalls.every(options => options.beamWidth === 7)).toBe(true);
    expect(searchCalls.every(options => options.guidance == null)).toBe(true);
  }, 60_000);

  it('keeps each three-front build atomic when the variant budget is too small', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const { buildConstraints, sourceConfig } =
      createSingleBuild(outerBuildService);
    const search = vi.fn();
    const service = createM12cOuterSearchService({
      machineAxisService: {
        prepare: contract => ({ valid: true, issues: [], contract }),
        simulate: vi.fn(),
        validate: () => ({ valid: true, issues: [], warnings: [] }),
      },
      outerBuildService,
      createSearchEngine: () => ({ search }),
      createSearchReport: createFakeSearchReport,
    });

    const report = await service.search({
      contract: createTemplate({ withEnemyProfile: true }),
      options: {
        objective: 'cycle-dps-no-toughness',
        beamWidth: 1,
        topN: 1,
        maxDepth: 1,
      },
      outer: {
        sourceConfigIdentities: [sourceConfig.sourceConfigIdentity],
        maxSourceConfigs: 1,
        maxBuildsPerSourceConfig: 1,
        maxBuildsTotal: 1,
        maxVariantSearches: 2,
      },
      buildConstraints,
    });

    expect(search).not.toHaveBeenCalled();
    expect(report.summary).toMatchObject({
      buildCount: 0,
      variantSearchCount: 0,
      variantBudgetExhausted: true,
      enumerationComplete: false,
      formalRankingReady: false,
    });
    expect(report.executionLedger).toMatchObject({
      processedVariantKeyCount: 0,
      processedVariantKeys: [],
      processedVariantKeysTruncated: false,
    });
  });

  it('covers all 35 source configs while keeping a constrained build sample non-formal', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const pool = outerBuildService.pool();
    const buildConstraints = createBuildConstraintsForDomains(
      pool.domains.actorLoadoutDomains
    );
    let searchCount = 0;
    const service = createM12cOuterSearchService({
      machineAxisService: {
        prepare: contract => ({ valid: true, issues: [], contract }),
        simulate: vi.fn(),
        validate: () => ({ valid: true, issues: [], warnings: [] }),
      },
      outerBuildService,
      createSearchEngine: () => ({
        search: async ({ contract }) => {
          searchCount += 1;
          return createFakeInnerResult(contract, searchCount);
        },
      }),
      createSearchReport: createFakeSearchReport,
    });

    const report = await service.search({
      contract: createTemplate({ withEnemyProfile: true }),
      options: {
        objective: 'cycle-dps-no-toughness',
        beamWidth: 1,
        topN: 5,
        maxDepth: 1,
      },
      outer: {
        maxSourceConfigs: 35,
        maxBuildsPerSourceConfig: 1,
        maxBuildsTotal: 35,
        maxVariantSearches: 105,
      },
      buildConstraints,
    });

    expect(searchCount).toBe(105);
    expect(report.results).toHaveLength(5);
    expect(report.summary).toMatchObject({
      requestedSourceConfigCount: 35,
      selectedSourceConfigCount: 35,
      plannedSourceConfigCount: 35,
      buildCount: 35,
      variantSearchCount: 105,
      enumerationComplete: true,
      fullPoolSourceConfigCoverage: true,
      fullPoolEnumerationComplete: false,
      buildConstraintsApplied: true,
      dynamicOuterPruningApplied: false,
      formalRankingReady: false,
      rankingStatus: 'bounded-domain-top-n-ready-not-full-pool',
    });
    expect(report.executionLedger.processedVariantKeys).toHaveLength(105);
    expect(report.executionLedger.processedVariantKeyCount).toBe(105);
  }, 120_000);

  it('fails closed on a non-roster front, stale package, out-of-team state, or forbidden kill marks', async () => {
    const outerBuildService = createM12cOuterBuildService();
    const { build } = createSingleBuild(outerBuildService);
    const cultivation = createM12cCultivationProfileFromBuild(build);

    expect(cultivation.actors).toHaveLength(3);
    expect(() =>
      createM12cBuildSearchContract({
        contractTemplate: createTemplate(),
        build,
        objective: 'cycle-dps-no-toughness',
        initialFrontOptimizationObjectId: 'not-in-team',
        mechanicsPackage,
        qualificationCatalogHash: build.authority.qualificationCatalogHash,
      })
    ).toThrow(/initial front/i);

    const staleTemplate = createTemplate();
    staleTemplate.dataIdentity.verifiedMechanicsPackageHash = '0'.repeat(64);
    const service = createM12cOuterSearchService({
      machineAxisService: createMachineAxisService(),
      outerBuildService,
    });
    await expect(
      service.search({
        contract: staleTemplate,
        options: { objective: 'cycle-dps-no-toughness' },
      })
    ).rejects.toMatchObject({
      issues: ['m12c-outer-search-mechanics-package-mismatch'],
    });

    const outOfTeamObjectId = [
      '101010',
      '102001',
      '103002',
      '107001',
      '107002',
      '108003',
      '112001',
      'STARBORN',
    ].find(
      objectId =>
        !build.actors.some(actor => actor.optimizationObjectId === objectId)
    );
    expect(() =>
      createM12cBuildSearchContract({
        contractTemplate: createTemplate(),
        build,
        objective: 'cycle-dps-no-toughness',
        initialFrontOptimizationObjectId: build.actors[0].optimizationObjectId,
        initialState: {
          actorSpByOptimizationObjectId: { [outOfTeamObjectId]: 100 },
        },
        mechanicsPackage,
        qualificationCatalogHash: build.authority.qualificationCatalogHash,
      })
    ).toThrow(/selected build/i);

    const front = build.actors[0];
    expect(() =>
      createM12cBuildSearchContract({
        contractTemplate: createTemplate(),
        build,
        objective: 'fastest-kill',
        initialFrontOptimizationObjectId: front.optimizationObjectId,
        initialState: {
          tuningMarks: [
            {
              markId: 1,
              profileKey: 'forged',
              decayRemainingMs: 1,
              heldReadyRemainingMs: 0,
              layers: [{}],
            },
          ],
        },
        mechanicsPackage,
        qualificationCatalogHash: build.authority.qualificationCatalogHash,
      })
    ).toThrow(/Invalid M12-C initial state/);
    expect(createM12cSearchVariantKey(build, front)).toMatch(
      /^m12c-variant:[a-f0-9]{16}$/
    );
  });
});

function createTemplate({ withEnemyProfile = false } = {}) {
  const contract = structuredClone(fixture);
  contract.scenario.durationFrames = 120;
  contract.scenario.enemy = {
    enemyId: 310054,
    level: 80,
    ...(withEnemyProfile
      ? {
          profile: {
            enemyId: 310054,
            level: 80,
            source: { status: 'authoritative-resolved' },
          },
        }
      : {}),
  };
  contract.scenario.critical = { policy: 'expected', seed: null };
  contract.actions = [];
  return contract;
}

function createSingleBuild(outerBuildService) {
  const pool = outerBuildService.pool();
  const sourceConfig = pool.teamCatalog.sourceConfigs.find(
    config => !config.optimizationObjectIds.includes('STARBORN')
  );
  const buildConstraints = createBuildConstraintsForDomains(
    sourceConfig.actors.map(actor =>
      pool.domains.actorLoadoutDomains.find(
        row => row.optimizationObjectId === actor.optimizationObjectId
      )
    )
  );
  const planned = outerBuildService.plan({
    sourceConfigIdentity: sourceConfig.sourceConfigIdentity,
    constraints: { perActor: buildConstraints },
  });
  const [build] = [
    ...outerBuildService.iterate(planned.plan, { maxCandidates: 1 }),
  ];
  return { pool, sourceConfig, buildConstraints, build };
}

function createBuildConstraintsForDomains(domains) {
  return Object.fromEntries(
    domains.map(domain => [
      domain.optimizationObjectId,
      {
        kiboIds: [domain.kiboIds[0]],
        soulEssenceIds: [domain.soulEssenceIds[0]],
        equipmentIdsBySlot: Object.fromEntries(
          Object.entries(domain.equipmentIdsBySlot).map(([slot, ids]) => [
            slot,
            [ids[0]],
          ])
        ),
      },
    ])
  );
}

function createFakeInnerResult(contract, score) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisSearch',
    kind: 'azpr-machine-axis-search',
    options: {
      objective: 'cycle-dps-no-toughness',
      topN: 2,
    },
    summary: {
      steps: 1,
      candidatesEvaluated: 1,
      completedCandidates: 1,
      rejectionCounts: {},
    },
    issues: [],
    results: [
      {
        axis: contract,
        run: { hashes: { input: `input-${score}` } },
        state: {},
        metrics: {},
        contributions: {},
        score,
        heuristicScore: score,
        scoreDirection: 'maximize',
        finalScoreEligible: true,
        currentFrame: 1,
        chain: [
          {
            action: { id: `action-${score}`, schedule: { frame: 0 } },
            label: 'fixture',
          },
        ],
      },
    ],
  };
}

function createFakeSearchReport({ searchResult }) {
  return {
    results: searchResult.results.map((entry, index) => ({
      rank: index + 1,
      teamCandidateId: entry.teamCandidateId,
      score: entry.score,
      finalScoreEligible: entry.finalScoreEligible,
      axis: entry.axis,
      hashes: entry.run.hashes,
    })),
  };
}
