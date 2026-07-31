import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import {
  collectCriticalStateEffectHitIdentities,
  computeBurstWindow,
  computeIdle,
  computeResourceSurplus,
  createContributions,
  createMachineAxisBatchEvaluator,
  guardCriticalStateEffectPolicy,
  normalizeBatchEnvelope,
} from '../../machine-axis/machineAxisBatchEvaluator';

function cloneFixture() {
  return structuredClone(fixture);
}

function createEnvelope(runs) {
  return { kind: 'azpr-machine-axis-batch', runs };
}

describe('Machine Axis batch evaluator', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it('evaluates a single-run batch with complete metrics', async () => {
    const service = createMachineAxisService();
    const evaluator = createMachineAxisBatchEvaluator({ service });
    const envelope = createEnvelope([
      { label: 'axis-a', axis: cloneFixture() },
    ]);
    const report = await evaluator.evaluate(envelope);
    expect(report).toMatchObject({
      kind: 'azpr-machine-axis-batch-evaluation',
      valid: true,
      status: 'ok',
      summary: { runCount: 1, okCount: 1, failedCount: 0 },
    });
    const row = report.runs[0];
    expect(row).toMatchObject({
      index: 0,
      label: 'axis-a',
      mode: 'single',
      status: 'ok',
    });
    expect(row.hashes.input).toMatch(/^[0-9a-f]{16}$/);
    expect(row.hashes.trace).toMatch(/^[0-9a-f]{16}$/);
    expect(row.scenario).toMatchObject({
      projectId: 'm11-b-three-actor-120s',
      durationMs: 120000,
    });

    const direct = service.simulate(cloneFixture());
    const totals = direct.evaluation.totals;
    expect(row.metrics.hpDamage).toBe(totals.hpDamage);
    expect(row.metrics.dps).toBeCloseTo(totals.hpDamage / 120, 8);
    expect(row.metrics.toughnessDamage).toBe(totals.toughnessDamage);
    expect(row.metrics.combatHitCount).toBe(totals.combatHitCount);
    expect(row.metrics.unresolvedActionCount).toBe(2);
    expect(row.metrics.nonExecutableActions).toEqual([]);

    expect(row.metrics.burst).toMatchObject({
      windowMs: 10000,
      hpDamage: expect.any(Number),
      hitCount: expect.any(Number),
      startMs: expect.any(Number),
      endMs: expect.any(Number),
    });
    expect(row.metrics.burst.hpDamage).toBeGreaterThan(0);
    expect(row.metrics.burst.endMs).toBeLessThanOrEqual(120000);
    expect(Object.keys(row.metrics.burst.byActor).length).toBeGreaterThan(0);

    expect(row.metrics.resourceSurplus.actors).toHaveLength(3);
    expect(row.metrics.resourceSurplus.actors[0]).toMatchObject({
      actorId: 'actor-101007',
      resource: 'sp',
      max: 100,
    });
    expect(row.metrics.resourceSurplus.kibos).toHaveLength(3);
    expect(row.metrics.resourceSurplus.selfEnergyDelta).toBe(
      totals.selfEnergyDelta
    );

    expect(row.metrics.idle.durationMs).toBe(120000);
    expect(row.metrics.idle.idleMs).toBeGreaterThan(0);
    expect(row.metrics.idle.byActor).toHaveLength(3);
    expect(
      row.metrics.idle.byActor.reduce((sum, entry) => sum + entry.idleMs, 0)
    ).toBeGreaterThan(0);

    const hitHpSum = row.contributions.byHit.reduce(
      (sum, entry) => sum + entry.hpDamage,
      0
    );
    expect(hitHpSum).toBeCloseTo(totals.hpDamage, 6);
    expect(row.contributions.byAction.length).toBe(
      direct.evaluation.byAction.length
    );
    expect(row.contributions.byActor).toHaveLength(3);
  }, 30_000);

  it('preserves input order and supports expected policy override deterministically', async () => {
    const service = createMachineAxisService();
    const evaluator = createMachineAxisBatchEvaluator({ service });
    const envelope = createEnvelope([
      {
        label: 'first',
        axis: cloneFixture(),
        options: { criticalPolicy: 'expected' },
      },
      {
        label: 'second',
        axis: cloneFixture(),
        options: { criticalPolicy: 'sampled', seeds: ['batch-seed'] },
      },
    ]);
    const report = await evaluator.evaluate(envelope);
    expect(report.status).toBe('ok');
    expect(report.runs.map(run => run.label)).toEqual(['first', 'second']);
    expect(report.runs[0].mode).toBe('single');
    expect(report.runs[1].mode).toBe('sampled');
    expect(report.runs[0].critical.policy).toBe('expected');
    expect(report.runs[1].samples[0].critical.policy).toBe('sampled');
    expect(report.runs[0].hashes.input).not.toBe(
      report.runs[1].samples[0].hashes.input
    );

    const repeated = await evaluator.evaluate(envelope);
    expect(repeated.runs[0].metrics.hpDamage).toBe(
      report.runs[0].metrics.hpDamage
    );
    expect(repeated.runs[1].samples[0].metrics.hpDamage).toBe(
      report.runs[1].samples[0].metrics.hpDamage
    );
  }, 30_000);

  it('aggregates sampled seeds with mean, variance and quantiles', async () => {
    const service = createMachineAxisService();
    const evaluator = createMachineAxisBatchEvaluator({ service, jobs: 2 });
    const seeds = ['seed-1', 'seed-2', 'seed-3'];
    const envelope = createEnvelope([
      { label: 'sampled-axis', axis: cloneFixture(), seeds },
    ]);
    const report = await evaluator.evaluate(envelope);
    const row = report.runs[0];
    expect(row.mode).toBe('sampled');
    expect(row.status).toBe('ok');
    expect(row.seeds).toEqual(seeds);
    expect(row.samples).toHaveLength(3);
    expect(row.samples.map(sample => sample.seed)).toEqual(seeds);
    expect(row.samples.every(sample => sample.status === 'ok')).toBe(true);
    expect(new Set(row.samples.map(sample => sample.hashes.input)).size).toBe(
      3
    );
    const hpDamage = row.sampling.metrics.hpDamage;
    expect(hpDamage).toMatchObject({
      count: 3,
      variance: expect.any(Number),
      stdDev: expect.any(Number),
      min: expect.any(Number),
      max: expect.any(Number),
      quantiles: {
        p5: expect.any(Number),
        p50: expect.any(Number),
        p95: expect.any(Number),
      },
    });
    expect(hpDamage.mean).toBeGreaterThan(0);
    expect(hpDamage.quantiles.p50).toBeGreaterThan(0);
    expect(row.sampling.metrics.burstHpDamage.count).toBe(3);
    expect(row.sampling.metrics.dps.mean).toBeGreaterThan(0);
  }, 30_000);

  it('reports invalid envelopes and per-run validation failures', async () => {
    const service = createMachineAxisService();
    const evaluator = createMachineAxisBatchEvaluator({ service });
    const invalid = await evaluator.evaluate(createEnvelope([]));
    expect(invalid.valid).toBe(false);
    expect(invalid.status).toBe('invalid');
    expect(
      invalid.issues.some(issue => issue.code === 'batch-runs-required')
    ).toBe(true);

    const failedRun = await evaluator.evaluate(
      createEnvelope([
        { label: 'bad-axis', axis: {} },
        {
          label: 'sampled-without-seeds',
          axis: cloneFixture(),
          criticalPolicy: 'sampled',
        },
      ])
    );
    expect(failedRun.valid).toBe(true);
    expect(failedRun.status).toBe('failed');
    expect(failedRun.summary.validationFailedCount).toBe(2);
    expect(failedRun.runs[0].status).toBe('validation-failed');
    expect(failedRun.runs[1].status).toBe('validation-failed');
    expect(
      failedRun.runs[1].errors.some(
        issue => issue.code === 'batch-sampled-seeds-required'
      )
    ).toBe(true);
  }, 30_000);

  it('computes burst windows and idle time from synthetic traces', () => {
    const burst = computeBurstWindow(
      [
        { timeMs: 0, rawDamage: 10, actorId: 'a' },
        { timeMs: 5000, rawDamage: 20, actorId: 'a' },
        { timeMs: 9000, rawDamage: 30, actorId: 'b' },
        { timeMs: 15000, rawDamage: 40, actorId: 'a' },
      ],
      10000
    );
    expect(burst.hpDamage).toBe(70);
    expect(burst.hitCount).toBe(2);
    expect(burst.startMs).toBe(9000);
    expect(burst.byActor).toEqual({ a: 40, b: 30 });

    const run = {
      trace: {
        actions: [
          { id: 'a1', actorId: 'actor-1' },
          { id: 'a2', actorId: 'actor-1' },
        ],
        executionPlan: {
          actions: [
            { actionId: 'a1', execute: true, startMs: 0, durationMs: 1000 },
            {
              actionId: 'a2',
              execute: true,
              startMs: 500,
              durationMs: 2000,
            },
          ],
        },
      },
    };
    const idle = computeIdle(run, 10000);
    expect(idle).toMatchObject({
      durationMs: 10000,
      busyMs: 2500,
      idleMs: 7500,
    });
    expect(idle.idleRatio).toBeCloseTo(0.75, 8);
    expect(idle.byActor[0]).toMatchObject({
      actorId: 'actor-1',
      busyMs: 2500,
      idleMs: 7500,
      executedActionCount: 2,
    });
  });

  it('computes resource surplus from final state and initial contract values', () => {
    const run = {
      trace: {
        state: {
          final: {
            actorEnergy: [
              { actorId: 'actor-101', currentValue: 80, maxValue: 100 },
            ],
            kiboEnergy: [
              {
                actorId: 'actor-101',
                kiboId: 9001,
                currentValue: 55,
                maxValue: 100,
              },
            ],
          },
        },
      },
      evaluation: { totals: { selfEnergyDelta: 45 } },
    };
    const contract = {
      scenario: {
        team: [{ characterId: 101, initialSp: 35 }],
        initialRuntimeState: {
          kiboEnergyBySlot: [
            { actorId: 'actor-101', kiboId: 9001, currentValue: 20 },
          ],
        },
      },
    };
    const surplus = computeResourceSurplus(run, contract);
    expect(surplus.actors).toEqual([
      {
        actorId: 'actor-101',
        resource: 'sp',
        valueUnit: 'absolute-sp-points',
        initial: 35,
        final: 80,
        max: 100,
        delta: 45,
      },
    ]);
    expect(surplus.kibos).toEqual([
      {
        actorId: 'actor-101',
        kiboId: 9001,
        resource: 'kibo-energy',
        valueUnit: 'absolute-sp-points',
        initial: 20,
        final: 55,
        max: 100,
        delta: 35,
      },
    ]);
    expect(surplus.selfEnergyDelta).toBe(45);
  });

  it('guards forced critical policies for hits with state effects', () => {
    const stateEffectHits = ['hit-state-1'];
    for (const policy of ['critical', 'non-critical', 'expected']) {
      const issues = guardCriticalStateEffectPolicy({
        policy,
        hitIdentities: stateEffectHits,
      });
      expect(issues).toHaveLength(1);
      expect(issues[0].code).toBe(
        'machine-axis-batch-critical-state-effect-policy'
      );
    }
    expect(
      guardCriticalStateEffectPolicy({
        policy: 'sampled',
        hitIdentities: stateEffectHits,
      })
    ).toEqual([]);
    expect(
      guardCriticalStateEffectPolicy({
        policy: 'critical',
        hitIdentities: [],
      })
    ).toEqual([]);
  });

  it('finds no critical state-effect hits in the installed fixture package', async () => {
    const service = createMachineAxisService();
    const run = service.simulate(cloneFixture());
    expect(collectCriticalStateEffectHitIdentities(run.trace)).toEqual([]);
    expect(run.trace.critical.policy).toBe('sampled');
  }, 30_000);

  it('exposes evaluateBatch on the machine axis service', async () => {
    const service = createMachineAxisService();
    const report = await service.evaluateBatch(
      createEnvelope([{ label: 'svc-run', axis: cloneFixture() }])
    );
    expect(report.status).toBe('ok');
    expect(report.runs[0].label).toBe('svc-run');
    expect(report.summary.okCount).toBe(1);
  }, 30_000);

  it('normalizes batch envelopes and rejects malformed options', () => {
    expect(normalizeBatchEnvelope(null).valid).toBe(false);
    expect(normalizeBatchEnvelope({ runs: [fixture] }).valid).toBe(true);
    const badPolicy = normalizeBatchEnvelope({
      runs: [{ axis: fixture, options: { criticalPolicy: 'always' } }],
    });
    expect(badPolicy.valid).toBe(false);
    expect(
      badPolicy.issues.some(
        issue => issue.code === 'batch-critical-policy-unsupported'
      )
    ).toBe(true);
    const badSeeds = normalizeBatchEnvelope({
      runs: [{ axis: fixture, seeds: [] }],
    });
    expect(badSeeds.valid).toBe(false);
    expect(
      badSeeds.issues.some(issue => issue.code === 'batch-seeds-invalid')
    ).toBe(true);
  });

  it('creates per-hit contribution rows from damage events', () => {
    const run = {
      evaluation: {
        byActor: [{ identity: 'actor-1', hpDamage: 10 }],
        byAction: [{ identity: 'a1', hpDamage: 10 }],
      },
      trace: {
        damage: [
          {
            actionId: 'a1',
            actorId: 'actor-1',
            hitIdentity: 'h1',
            rawDamage: 4,
            toughnessDamage: 2,
            timeMs: 100,
          },
          {
            actionId: 'a1',
            actorId: 'actor-1',
            hitIdentity: 'h1',
            rawDamage: 6,
            toughnessDamage: 3,
            timeMs: 250,
          },
          {
            actionId: 'a2',
            actorId: 'actor-1',
            hitIdentity: 'h2',
            rawDamage: 7,
            toughnessDamage: 1,
            timeMs: 300,
            stateEventKind: 'recovery',
          },
        ],
      },
    };
    const contributions = createContributions(run);
    expect(contributions.byHit).toEqual([
      {
        identity: 'a1|h1',
        actionId: 'a1',
        actorId: 'actor-1',
        hitIdentity: 'h1',
        hitCount: 2,
        hpDamage: 10,
        toughnessDamage: 5,
        stateEventCount: 0,
        firstTimeMs: 100,
        lastTimeMs: 250,
      },
      {
        identity: 'a2|h2',
        actionId: 'a2',
        actorId: 'actor-1',
        hitIdentity: 'h2',
        hitCount: 1,
        hpDamage: 7,
        toughnessDamage: 1,
        stateEventCount: 1,
        firstTimeMs: 300,
        lastTimeMs: 300,
      },
    ]);
  });
});
