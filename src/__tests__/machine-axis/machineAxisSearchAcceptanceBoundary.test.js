import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  createMachineAxisSearchEngine,
  scoreCandidate,
} from '../../machine-axis/machineAxisSearchEngine';
import { createMachineAxisSearchAction } from '../../machine-axis/machineAxisSearchGenerator';
import {
  createSearchResourceThresholdBoundary,
  createVerifiedActionWindowBoundaries,
} from '../../machine-axis/machineAxisSearchState';

const PANGPANG_A3_HIT = '10100703|0|elements|0|-9212100609153088879|14|1';

function cloneFixture({ durationFrames = 1800 } = {}) {
  const axis = structuredClone(fixture);
  axis.scenario.durationFrames = durationFrames;
  axis.actions = [];
  return axis;
}

function actionCandidate(
  axis,
  {
    publicActionId,
    actionKind,
    attackInput = null,
    ownerKind = 'actor',
    slotId = 'slot-1',
    startFrame = 0,
  } = {}
) {
  const ordinal = axis.actions.length + 1;
  return {
    action: createMachineAxisSearchAction({
      id: `search-action-${ordinal}`,
      ownerKind,
      slotId,
      publicActionId,
      actionKind,
      attackInput,
      startFrame,
    }),
    ownerId: `${ownerKind}:${ownerKind === 'actor' ? 101007 : 500001}`,
    ownerKind,
    slotId,
    startFrame,
    label: `${actionKind}-${ordinal}`,
    source: 'test:real-verified-action',
    sourceIdentity: `${publicActionId}`,
  };
}

function createRepeatedActionGenerator({
  publicActionId,
  actionKind,
  attackInput,
}) {
  return {
    generateNextActions({ axis, nextStartFrameByActor }) {
      return [
        actionCandidate(axis, {
          publicActionId,
          actionKind,
          attackInput,
          startFrame: nextStartFrameByActor['actor-101007'] ?? 0,
        }),
      ];
    },
  };
}

function findMechanicsHit(hitIdentity) {
  for (const binding of [
    ...(mechanicsPackage.controlBindings ?? []),
    ...(mechanicsPackage.actionVariantControlBindings ?? []),
  ]) {
    const hit = (binding.hits ?? []).find(
      entry => entry.hitIdentity === hitIdentity
    );
    if (hit) return hit;
  }
  throw new Error(`missing mechanics hit ${hitIdentity}`);
}

describe('M12-B-R1 search acceptance boundaries', () => {
  let service;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    service = createMachineAxisService();
  });

  it('keeps depth 8 and 24 real-core searches non-empty with repeated semantic actions and unique IDs', async () => {
    const generator = createRepeatedActionGenerator({
      publicActionId: 10100701,
      actionKind: 'normal-attack',
      attackInput: { sequenceIndex: 3, groupId: 'search-repeat-a3' },
    });
    const engine = createMachineAxisSearchEngine({ service, generator });
    for (const maxDepth of [8, 24]) {
      const result = await engine.search({
        contract: cloneFixture(),
        options: {
          objective: 'damage',
          beamWidth: 1,
          topN: 1,
          maxDepth,
          includeKibo: false,
          includeSwitch: false,
        },
      });
      expect(result.results).toHaveLength(1);
      const actions = result.results[0].axis.actions;
      expect(actions.length).toBeGreaterThanOrEqual(maxDepth);
      expect(new Set(actions.map(action => action.id)).size).toBe(
        actions.length
      );
      expect(
        actions.filter(action => action.intent?.publicActionId === 10100701)
          .length
      ).toBeGreaterThan(1);
      const nodeFrame = Math.max(
        ...result.results[0].run.actionResolutions.map(
          resolution => resolution.startFrame + resolution.durationFrames
        )
      );
      expect(result.results[0].state.currentFrame).toBe(nodeFrame);
      expect(result.results[0].state.remainingFrames).toBe(1800 - nodeFrame);
    }
  }, 300_000);

  it('places a Ruby derived E1 from the resolved A3 duration instead of a public template fallback', async () => {
    const axis = cloneFixture();
    axis.scenario.team = [
      { ...axis.scenario.team[2], slotId: 'slot-1' },
      axis.scenario.team[1],
      { ...axis.scenario.team[0], slotId: 'slot-3' },
    ];
    axis.scenario.initialRuntimeState.kiboEnergyBySlot =
      axis.scenario.initialRuntimeState.kiboEnergyBySlot.map(entry => {
        if (entry.characterId === 103002) return { ...entry, slotId: 'slot-1' };
        if (entry.characterId === 101007) return { ...entry, slotId: 'slot-3' };
        return entry;
      });
    const generator = {
      generateNextActions({ axis: current, nextStartFrameByActor }) {
        const ordinal = current.actions.length + 1;
        const sequenceIndex = ordinal <= 3 ? ordinal : 1;
        return [
          {
            action: createMachineAxisSearchAction({
              id: `search-action-${ordinal}`,
              ownerKind: 'actor',
              slotId: 'slot-1',
              publicActionId: 10300201,
              actionKind: 'normal-attack',
              attackInput: {
                sequenceIndex,
                groupId: `ruby-search-${ordinal}`,
              },
              startFrame: nextStartFrameByActor['actor-103002'] ?? 0,
            }),
            ownerId: 'actor:103002',
            ownerKind: 'actor',
            slotId: 'slot-1',
            label: `ruby-input-${ordinal}`,
            source: 'test:real-ruby-input-state',
          },
        ];
      },
    };
    const result = await createMachineAxisSearchEngine({
      service,
      generator,
    }).search({
      contract: axis,
      options: {
        objective: 'damage',
        beamWidth: 1,
        topN: 1,
        maxDepth: 4,
        includeWait: false,
        includeKibo: false,
        includeSwitch: false,
      },
    });
    const best = result.results[0];
    expect(best.axis.actions).toHaveLength(4);
    const resolutions = best.run.actionResolutions;
    const a3 = resolutions.find(entry => entry.actionId === 'search-action-3');
    const e1 = resolutions.find(entry => entry.actionId === 'search-action-4');
    expect(a3).toMatchObject({ resolvedControlSkillId: 10300203 });
    expect(e1).toMatchObject({
      resolvedControlSkillId: 10300201,
      resolvedSubSkillIndex: 1,
      durationFrames: 24,
    });
    expect(e1.startFrame).toBe(a3.startFrame + a3.durationFrames);
    const verifiedWindows = createVerifiedActionWindowBoundaries({
      run: best.run,
      graph: mechanicsPackage.actionVariantGraph,
    });
    expect(verifiedWindows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actionId: 'search-action-3',
          frame: a3.startFrame + 34,
          boundaryRole: 'start',
          source: 'verified-attack-chain-transition',
          targetChainIdentity: 'ruby-enhanced-twelve-inputs',
        }),
        expect.objectContaining({
          actionId: 'search-action-3',
          frame: a3.startFrame + 79,
          boundaryRole: 'end',
          source: 'verified-attack-chain-transition',
          targetChainIdentity: 'ruby-enhanced-twelve-inputs',
        }),
      ])
    );
  }, 180_000);

  it('preserves the last legal frontier when the next repeated action is a real-core dead end', async () => {
    const generator = createRepeatedActionGenerator({
      publicActionId: 50000102,
      actionKind: 'signature',
    });
    generator.generateNextActions = ({ axis, nextStartFrameByActor }) => [
      actionCandidate(axis, {
        publicActionId: 50000102,
        actionKind: 'signature',
        ownerKind: 'kibo',
        startFrame: nextStartFrameByActor['actor-101007'] ?? 0,
      }),
    ];
    const engine = createMachineAxisSearchEngine({ service, generator });
    const result = await engine.search({
      contract: cloneFixture(),
      options: {
        objective: 'damage',
        beamWidth: 1,
        topN: 1,
        maxDepth: 4,
      },
    });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].axis.actions).toHaveLength(1);
    expect(result.summary.invalidCandidates).toBeGreaterThan(0);
  }, 120_000);

  it('returns a structured failure instead of a successful schema-invalid empty report when no action is legal', async () => {
    const axis = cloneFixture({ durationFrames: 1 });
    await expect(
      service.search(
        {
          contract: axis,
          options: {
            objective: 'damage',
            beamWidth: 1,
            topN: 1,
            maxDepth: 1,
            includeWait: false,
            includeKibo: false,
            includeSwitch: false,
          },
        },
        {}
      )
    ).rejects.toMatchObject({
      issues: [
        expect.objectContaining({
          code: 'machine-axis-search-no-solution',
        }),
      ],
    });
  }, 120_000);

  it('consumes a cooldown boundary through an explicit wait before repeating a real skill', async () => {
    const generator = createRepeatedActionGenerator({
      publicActionId: 10100712,
      actionKind: 'star-skill',
    });
    const engine = createMachineAxisSearchEngine({ service, generator });
    const result = await engine.search({
      contract: cloneFixture({ durationFrames: 3600 }),
      options: {
        objective: 'damage',
        beamWidth: 6,
        topN: 6,
        maxDepth: 3,
        includeKibo: false,
        includeSwitch: false,
      },
    });
    const repeated = result.results.find(
      entry =>
        entry.axis.actions.some(action => action.intent?.kind === 'wait') &&
        entry.axis.actions.filter(
          action => action.intent?.publicActionId === 10100712
        ).length === 2
    );
    expect(repeated).toBeDefined();
    expect(
      repeated.axis.actions.filter(
        action => action.intent?.publicActionId === 10100712
      )
    ).toHaveLength(2);
    expect(repeated.boundariesConsumed).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'cd-ready' })])
    );
  }, 180_000);

  it('waits directly from 90 SP to the actionable 100 SP threshold before releasing the ultimate', async () => {
    const axis = cloneFixture({ durationFrames: 3600 });
    axis.scenario.team[0].initialSp = 90;
    const generator = createRepeatedActionGenerator({
      publicActionId: 10100713,
      actionKind: 'ultimate',
    });
    const engine = createMachineAxisSearchEngine({ service, generator });
    const result = await engine.search({
      contract: axis,
      options: {
        objective: 'damage',
        beamWidth: 8,
        topN: 8,
        maxDepth: 2,
        includeKibo: false,
        includeSwitch: false,
      },
    });
    const released = result.results.find(entry =>
      entry.axis.actions.some(
        action => action.intent?.publicActionId === 10100713
      )
    );
    expect(released).toBeDefined();
    expect(released.axis.actions[0].intent.kind).toBe('wait');
    expect(released.boundariesConsumed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'resource-threshold',
          resourceIdentity: 'actor:101007:sp',
          currentValue: 90,
          requiredValue: 100,
          frame: 2886,
          resumeFrame: 2887,
        }),
      ])
    );
    expect(released.axis.actions[1].schedule.frame).toBe(2887);
    expect(
      released.run.trace.executionPlan.actions.find(
        entry => entry.actionId === released.axis.actions[1].id
      )?.execute
    ).toBe(true);
  }, 180_000);

  it('uses real Kibo growth for a resource threshold and never invents special-resource growth', async () => {
    const axis = cloneFixture({ durationFrames: 1200 });
    axis.scenario.initialRuntimeState.kiboEnergyBySlot =
      axis.scenario.initialRuntimeState.kiboEnergyBySlot.map(entry =>
        Number(entry.kiboId) === 500001 ? { ...entry, currentValue: 99 } : entry
      );
    const generator = {
      generateNextActions({ axis: current, nextStartFrameByActor }) {
        return [
          actionCandidate(current, {
            publicActionId: 50000102,
            actionKind: 'signature',
            ownerKind: 'kibo',
            startFrame: nextStartFrameByActor['actor-101007'] ?? 0,
          }),
        ];
      },
    };
    const result = await createMachineAxisSearchEngine({
      service,
      generator,
    }).search({
      contract: axis,
      options: {
        objective: 'damage',
        beamWidth: 8,
        topN: 8,
        maxDepth: 2,
        includeKibo: true,
        includeSwitch: false,
      },
    });
    const released = result.results.find(entry =>
      entry.axis.actions.some(
        action => action.intent?.publicActionId === 50000102
      )
    );
    expect(released).toBeDefined();
    expect(released.boundariesConsumed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'resource-threshold',
          resourceIdentity: 'kibo:500001:sp',
          currentValue: 99,
          requiredValue: 100,
          frame: 294,
          resumeFrame: 295,
        }),
      ])
    );
    expect(
      released.axis.actions.find(
        action => action.intent?.publicActionId === 50000102
      )?.schedule.frame
    ).toBe(295);

    const specialRun = {
      trace: {
        scenario: { durationMs: 2000, frameRate: 60 },
        resources: {
          actors: [],
          kibos: [],
          special: [
            {
              timeMs: 1000,
              payload: {
                resourceIdentity: 'actor:103002:element:103002047',
                beforeValue: 0,
                afterValue: 0,
              },
            },
          ],
        },
      },
    };
    const growingSpecialRun = structuredClone(specialRun);
    growingSpecialRun.trace.resources.special[0].payload.afterValue = 6;
    growingSpecialRun.trace.resources.special[0].payload.sourceIdentity =
      'battle-element:ruby-reload';
    expect(
      createSearchResourceThresholdBoundary({
        runs: [growingSpecialRun],
        resourceIdentity: 'actor:103002:element:103002047',
        currentValue: 0,
        requiredValue: 5,
        currentFrame: 0,
        durationFrames: 120,
      })
    ).toEqual(
      expect.objectContaining({
        kind: 'resource-threshold',
        frame: 60,
        resumeFrame: 61,
        currentValue: 0,
        requiredValue: 5,
        reachedValues: [6],
      })
    );
    expect(
      createSearchResourceThresholdBoundary({
        runs: [specialRun],
        resourceIdentity: 'actor:103002:element:103002047',
        currentValue: 0,
        requiredValue: 1,
        currentFrame: 0,
        durationFrames: 120,
      })
    ).toBeNull();
  }, 180_000);

  it('uses the requested one-second burst window for score, ordering and report metrics', async () => {
    const report = await service.search(
      {
        contract: cloneFixture(),
        options: {
          beamWidth: 1,
          topN: 1,
          maxDepth: 2,
          maxActionsPerOwner: 2,
          maxKiboActions: 1,
          includeSwitch: false,
          objective: 'burst',
          burstWindowMs: 1000,
        },
      },
      {}
    );
    expect(report.results[0].score).toBe(
      report.results[0].metrics.burst.hpDamage
    );
    expect(report.results[0].metrics.burst.windowMs).toBe(1000);
    expect(
      scoreCandidate(service.simulate(report.results[0].axis), 'burst', 1000)
    ).toBe(report.results[0].score);
  }, 180_000);

  it('reuses the M12-A state-effect guard and evaluates explicit sampled seed sets', async () => {
    const hit = findMechanicsHit(PANGPANG_A3_HIT);
    const originalIdentities = hit.criticalStateEffectIdentities;
    hit.criticalStateEffectIdentities = ['synthetic:critical-state-effect'];
    try {
      const generator = createRepeatedActionGenerator({
        publicActionId: 10100701,
        actionKind: 'normal-attack',
        attackInput: { sequenceIndex: 3, groupId: 'critical-state-a3' },
      });
      const engine = createMachineAxisSearchEngine({ service, generator });
      const unsafe = await engine.search({
        contract: {
          ...cloneFixture(),
          scenario: {
            ...cloneFixture().scenario,
            critical: { policy: 'non-critical', seed: null },
          },
        },
        options: {
          objective: 'damage',
          beamWidth: 1,
          topN: 1,
          maxDepth: 1,
          includeWait: false,
        },
      });
      expect(unsafe.results).toEqual([]);
      expect(unsafe.issues).toContainEqual(
        expect.objectContaining({
          code: 'machine-axis-batch-critical-state-effect-policy',
        })
      );

      const sampled = await engine.search({
        contract: cloneFixture(),
        options: {
          objective: 'damage',
          beamWidth: 1,
          topN: 1,
          maxDepth: 1,
          includeWait: false,
          seeds: ['search-seed-a', 'search-seed-b'],
        },
      });
      expect(sampled.results).toHaveLength(1);
      expect(sampled.results[0].sampling).toMatchObject({
        seeds: ['search-seed-a', 'search-seed-b'],
        sampleCount: 2,
      });
      expect(
        Object.values(sampled.results[0].metrics.burst.byActor).reduce(
          (sum, value) => sum + value,
          0
        )
      ).toBeCloseTo(sampled.results[0].metrics.burst.hpDamage, 8);
    } finally {
      if (originalIdentities === undefined) {
        delete hit.criticalStateEffectIdentities;
      } else {
        hit.criticalStateEffectIdentities = originalIdentities;
      }
    }
  }, 180_000);

  it('keeps multi-seed actor, action and hit contributions equal to the averaged metric', async () => {
    const report = await service.search({
      contract: cloneFixture({ durationFrames: 7200 }),
      options: {
        beamWidth: 2,
        topN: 1,
        maxDepth: 2,
        maxActionsPerOwner: 2,
        maxKiboActions: 1,
        includeSwitch: false,
        objective: 'burst',
        burstWindowMs: 1000,
        seeds: ['r1-a', 'r1-b'],
      },
    });
    const result = report.results[0];
    expect(result.sampling.samples.map(sample => sample.score)).toEqual([
      190, 200,
    ]);
    expect(result.score).toBe(195);
    expect(result.metrics.hpDamage).toBe(195);
    expect(result.metrics.burst.hpDamage).toBe(195);
    for (const dimension of ['byActor', 'byAction', 'byHit']) {
      const hpDamage = result.contributions[dimension].reduce(
        (sum, entry) => sum + Number(entry.hpDamage ?? 0),
        0
      );
      expect(hpDamage).toBeCloseTo(195, 8);
    }
    expect(result.sampling.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          hashes: expect.objectContaining({ trace: expect.any(String) }),
          contributions: expect.objectContaining({
            byActor: expect.any(Array),
            byAction: expect.any(Array),
            byHit: expect.any(Array),
          }),
        }),
      ])
    );
  }, 180_000);

  it('enumerates candidate teams outside the inner search and ranks one cross-team Top-N', async () => {
    const base = cloneFixture();
    const swappedTeam = [
      { ...base.scenario.team[1], slotId: 'slot-1' },
      { ...base.scenario.team[0], slotId: 'slot-2' },
      base.scenario.team[2],
    ];
    const swappedInitial = structuredClone(base.scenario.initialRuntimeState);
    swappedInitial.kiboEnergyBySlot = swappedInitial.kiboEnergyBySlot.map(
      entry => {
        if (entry.slotId === 'slot-1') return { ...entry, slotId: 'slot-2' };
        if (entry.slotId === 'slot-2') return { ...entry, slotId: 'slot-1' };
        return entry;
      }
    );
    const report = await service.search({
      contract: base,
      teamCandidates: [
        {
          id: 'pangpang-first',
          team: base.scenario.team,
          initialRuntimeState: base.scenario.initialRuntimeState,
        },
        {
          id: 'xiaoyu-first',
          team: swappedTeam,
          initialRuntimeState: swappedInitial,
        },
      ],
      options: {
        objective: 'damage',
        beamWidth: 1,
        topN: 2,
        maxDepth: 1,
        maxActionsPerOwner: 1,
        includeKibo: false,
        includeSwitch: false,
        includeWait: false,
      },
    });
    expect(report.summary.teamCandidatesEvaluated).toBe(2);
    expect(report.summary.teamCandidateSuccessCount).toBe(2);
    expect(report.summary.teamCandidateFailureCount).toBe(0);
    expect(
      new Set(report.results.map(result => result.teamCandidateId))
    ).toEqual(new Set(['pangpang-first', 'xiaoyu-first']));
    expect(report.results.map(result => result.score)).toEqual(
      [...report.results.map(result => result.score)].sort((a, b) => b - a)
    );
  }, 180_000);
});
