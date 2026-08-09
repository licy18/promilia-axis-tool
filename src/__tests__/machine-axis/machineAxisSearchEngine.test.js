import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  computeUpperBound,
  createMachineAxisSearchEngine,
  mergeEquivalentCandidates,
  normalizeSearchOptions,
  scoreCandidate,
  selectTopN,
  shouldPrune,
} from '../../machine-axis/machineAxisSearchEngine';
import { createMachineAxisSearchAction } from '../../machine-axis/machineAxisSearchGenerator';

function cloneFixture() {
  return structuredClone(fixture);
}

function createEntry({ id, score, frame = 0, chainLength = 1, stateHash }) {
  return {
    axis: { scenario: { name: `axis-${id}`, fps: 60, durationFrames: 7200 } },
    run: {},
    state: {},
    stateHash,
    chain: Array.from({ length: chainLength }, (_, index) => ({
      action: { id: `${id}-${index}`, schedule: { frame: 0 } },
    })),
    score,
    currentFrame: frame,
    remainingFrames: 7200 - frame,
    terminal: true,
    mergedCount: 0,
  };
}

describe('Machine Axis search engine', () => {
  let service;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
  });

  it('normalizes search options with defaults and overrides', () => {
    expect(normalizeSearchOptions({})).toMatchObject({
      beamWidth: 8,
      topN: 5,
      maxDepth: 24,
      objective: 'cycle-dps-no-toughness',
      maxDamagePerMsBound: 10,
      includeSwitch: true,
    });
    expect(
      normalizeSearchOptions({
        beamWidth: 3,
        topN: 2,
        objective: 'burst',
        maxDamagePerMsBound: 0.5,
      })
    ).toMatchObject({
      beamWidth: 3,
      topN: 2,
      objective: 'burst',
      maxDamagePerMsBound: 0.5,
    });
  });

  it('scores candidates by objective from canonical runs', () => {
    const run = service.simulate(cloneFixture());
    expect(scoreCandidate(run, 'damage')).toBe(run.evaluation.totals.hpDamage);
    expect(scoreCandidate(run, 'toughness')).toBe(
      run.evaluation.totals.toughnessDamage
    );
    expect(scoreCandidate(run, 'burst')).toBeGreaterThan(0);
  }, 30_000);

  it('computes admissible upper bounds without mis-pruning', () => {
    expect(
      computeUpperBound({
        score: 100,
        remainingFrames: 60,
        maxDamagePerFrame: 0.5,
      })
    ).toBe(130);
    expect(shouldPrune({ kthBest: Number.NEGATIVE_INFINITY })).toBe(false);
    expect(
      shouldPrune({
        score: 100,
        remainingFrames: 60,
        maxDamagePerFrame: 0.5,
        kthBest: 130,
      })
    ).toBe(false);
    expect(
      shouldPrune({
        score: 100,
        remainingFrames: 60,
        maxDamagePerFrame: 0.5,
        kthBest: 130.01,
      })
    ).toBe(true);
  });

  it('merges equivalent states and keeps the better representative', () => {
    const stats = { mergedCandidates: 0 };
    const a = createEntry({
      id: 'a',
      score: 50,
      frame: 100,
      stateHash: 'same',
    });
    const b = createEntry({
      id: 'b',
      score: 80,
      frame: 200,
      stateHash: 'same',
    });
    const c = createEntry({
      id: 'c',
      score: 90,
      frame: 50,
      stateHash: 'other',
    });
    const merged = mergeEquivalentCandidates([a, b, c], stats);
    expect(merged).toHaveLength(2);
    const sameGroup = merged.find(entry => entry.stateHash === 'same');
    expect(sameGroup.axis.scenario.name).toBe('axis-b');
    expect(sameGroup.mergedCount).toBe(1);
    expect(stats.mergedCandidates).toBe(1);
  });

  it('selects Top-N by score with deterministic tie-breaking', () => {
    const entries = [
      createEntry({ id: 'low', score: 10, frame: 100, stateHash: 'h1' }),
      createEntry({ id: 'high', score: 90, frame: 50, stateHash: 'h2' }),
      createEntry({
        id: 'tie-a',
        score: 50,
        frame: 100,
        chainLength: 3,
        stateHash: 'h3',
      }),
      createEntry({
        id: 'tie-b',
        score: 50,
        frame: 100,
        chainLength: 2,
        stateHash: 'h4',
      }),
      createEntry({ id: 'mid', score: 40, frame: 10, stateHash: 'h5' }),
    ];
    const top = selectTopN(entries, 3);
    expect(top.map(entry => entry.axis.scenario.name)).toEqual([
      'axis-high',
      'axis-tie-b',
      'axis-tie-a',
    ]);
  });

  it('searches deterministically with beam expansion over the real core', async () => {
    const engine = createMachineAxisSearchEngine({ service });
    const axis = cloneFixture();
    const options = {
      beamWidth: 2,
      topN: 2,
      maxDepth: 2,
      maxActionsPerOwner: 2,
      maxKiboActions: 1,
      includeSwitch: false,
      objective: 'damage',
    };
    const first = await engine.search({ contract: axis, options });
    expect(first.kind).toBe('azpr-machine-axis-search');
    expect(first.summary.beamWidth).toBe(2);
    expect(first.summary.candidatesEvaluated).toBeGreaterThan(1);
    expect(first.results.length).toBeGreaterThan(0);
    expect(first.results.length).toBeLessThanOrEqual(2);
    for (const result of first.results) {
      expect(result.axis.actions.length).toBeGreaterThan(0);
      expect(service.validate(result.axis).valid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
    const second = await engine.search({ contract: axis, options });
    expect(second.results.map(result => result.axis.actions)).toEqual(
      first.results.map(result => result.axis.actions)
    );
    const { wallTimeMs: firstWallTime, ...firstSummary } = first.summary;
    const { wallTimeMs: secondWallTime, ...secondSummary } = second.summary;
    expect(firstWallTime).toBeGreaterThan(0);
    expect(secondWallTime).toBeGreaterThan(0);
    expect(secondSummary).toEqual(firstSummary);
  }, 180_000);

  it('prunes a primary-objective candidate before scoring when its execution plan skips an action', async () => {
    const fakeService = {
      async simulate(axis) {
        const blocked = (axis.actions ?? []).length > 0;
        return {
          contract: axis,
          hashes: {
            input: blocked ? 'blocked-input' : 'root-input',
            data: 'data',
            trace: blocked ? 'blocked-trace' : 'root-trace',
            build: 'build',
          },
          evaluation: { totals: {} },
          trace: {
            scenario: { durationMs: 1000, frameRate: 60, actorIds: [] },
            state: { initial: {}, final: {} },
            controlledActors: {},
            actions: blocked
              ? [{ id: 'blocked-a2', type: 'skill', startMs: 0 }]
              : [],
            executionPlan: {
              actions: blocked
                ? [
                    {
                      actionId: 'blocked-a2',
                      execute: false,
                      status: 'skipped-rule-blocked',
                      violationCodes: ['attack-input-chain-incomplete'],
                      unresolvedCodes: [],
                    },
                  ]
                : [],
            },
            diagnostics: { actionRules: { diagnostics: [], summary: {} } },
          },
        };
      },
    };
    const generator = {
      generateNextActions({ axis }) {
        if ((axis.actions ?? []).length > 0) return [];
        return [
          {
            action: createMachineAxisSearchAction({
              id: 'blocked-a2',
              ownerKind: 'actor',
              slotId: 'slot-1',
              publicActionId: 10101001,
              actionKind: 'normal-attack',
              attackInput: { sequenceIndex: 2, groupId: 'orphan' },
              startFrame: 0,
            }),
            label: 'standalone-a2',
          },
        ];
      },
    };
    const engine = createMachineAxisSearchEngine({
      service: fakeService,
      generator,
    });
    const result = await engine.search({
      contract: {
        scenario: { durationFrames: 60, fps: 60, team: [] },
        actions: [],
      },
      options: {
        objective: 'cycle-dps-no-toughness',
        maxDepth: 1,
        includeWait: false,
      },
    });
    expect(result.results).toEqual([]);
    expect(result.summary).toMatchObject({
      invalidCandidates: 1,
      rejectionCounts: { 'attack-input-chain-incomplete': 1 },
      rejectionExamples: [
        expect.objectContaining({
          code: 'attack-input-chain-incomplete',
          actionId: 'blocked-a2',
          ruleCodes: ['attack-input-chain-incomplete'],
        }),
      ],
    });
  });

  it('records unresolved joint actions as excluded formal surface evidence', async () => {
    const fakeService = {
      async simulate(axis) {
        return {
          contract: axis,
          hashes: {
            input: 'root-input',
            data: 'data',
            trace: 'root-trace',
            build: 'build',
          },
          evaluation: { totals: {} },
          trace: {
            scenario: { durationMs: 1000, frameRate: 60, actorIds: [] },
            state: { initial: {}, final: {} },
            controlledActors: {},
            actions: [],
            executionPlan: { actions: [] },
            diagnostics: { actionRules: { diagnostics: [], summary: {} } },
          },
        };
      },
    };
    const generator = {
      generateNextActions({ options }) {
        options.onFormalRejection({
          code: 'joint-attack-trigger-unresolved',
          path: 'actions',
          actorId: 'actor-101010',
          publicActionId: 10101012,
        });
        return [];
      },
    };
    const result = await createMachineAxisSearchEngine({
      service: fakeService,
      generator,
    }).search({
      contract: {
        scenario: { durationFrames: 60, fps: 60, team: [] },
        actions: [],
      },
      options: {
        objective: 'cycle-dps-no-toughness',
        maxDepth: 1,
        includeWait: false,
      },
    });
    expect(result.summary).toMatchObject({
      formalSurfaceRejectedCandidates: 1,
      rejectionCounts: { 'joint-attack-trigger-unresolved': 1 },
      rejectionExamples: [
        expect.objectContaining({
          code: 'joint-attack-trigger-unresolved',
          actorId: 'actor-101010',
          publicActionId: 10101012,
        }),
      ],
    });
  });
});
