import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-120s.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createCanonicalTraceViewIndex } from '../../features/workbench/canonicalTraceViewIndex';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';

describe('canonicalTraceViewIndex', () => {
  let run;

  beforeAll(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
    run = createMachineAxisService().simulate(fixture);
  });

  it('memoizes a complete identity index by canonical trace hash', () => {
    const first = createCanonicalTraceViewIndex(run);
    const second = createCanonicalTraceViewIndex(run);

    expect(second).toBe(first);
    expect(first.traceHash).toBe('f3bc577f822959b6');
    expect(first.actionViews).toHaveLength(16);

    const kibo = first.actionsById.get('xunlang-signature');
    expect(kibo.hits).toHaveLength(9);
    expect(kibo.resourceTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceKind: 'kibo-energy',
          before: 100,
          after: 0,
          change: -100,
        }),
      ])
    );

    const ruby = first.actionsById.get('ruby-enhanced-e1-intent');
    expect(ruby.resolved).toMatchObject({
      controlSkillId: 10300201,
      subSkillIndex: 1,
    });
    expect(ruby.resourceTransactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          resourceIdentity: 'actor:103002:element:103002047',
          before: 6,
          after: 5,
        }),
      ])
    );
  });

  it('keeps miss rows editable and exposes each critical contract separately', () => {
    const index = createCanonicalTraceViewIndex(run);
    const hitIdentity = '10100703|0|elements|0|-9212100609153088879|14|1';

    expect(index.actionsById.get('a3-miss').hits).toEqual([
      expect.objectContaining({
        identity: hitIdentity,
        landed: 'miss',
        settlements: [],
      }),
    ]);
    expect(index.actionsById.get('a3-sampled').hits[0]).toMatchObject({
      criticalMode: 'sampled',
      critical: {
        roll: 2345,
        effectiveThresholdBasisPoints: 500,
        sourceCriticalRateBasisPoints: 500,
        targetCriticalDefenseBasisPoints: 0,
        sourceCriticalDamageMultiplier: 1.5,
        sourceCriticalDamageBasisPoints: 15000,
        eventMaterialized: false,
      },
    });
    const expectedHit = index.actionsById.get('a3-expected').hits[0];
    expect(expectedHit).toMatchObject({
      criticalMode: 'expected',
      critical: {
        expected: true,
        expectedProbabilityBasisPoints: 500,
        sourceCriticalDamageMultiplier: 1.5,
        sourceCriticalDamageBasisPoints: 15000,
        expectedResult: {
          probabilityBasisPoints: 500,
          nonCriticalRaw: '524288',
          nonCriticalValue: 8,
          criticalRaw: '851968',
          criticalValue: 13,
          weightedRaw: '540672',
          weightedValue: 8.25,
          weightedInteger: '8',
          criticalEventMaterialized: false,
        },
        eventMaterialized: false,
      },
    });
    expect(expectedHit.critical.sourceCriticalDamageMultiplier).toBeCloseTo(
      1.5,
      4
    );
    expect(index.actionsById.get('a3-critical').hits[0]).toMatchObject({
      criticalMode: 'critical',
      critical: { critical: true, eventMaterialized: true },
    });
    expect(index.actionsById.get('a3-non-critical').hits[0]).toMatchObject({
      criticalMode: 'non-critical',
      critical: { critical: false, eventMaterialized: false },
    });
  });

  it('preserves missing expected materialization evidence as unknown', () => {
    const missingEvidenceRun = structuredClone(run);
    missingEvidenceRun.hashes.trace = 'missing-expected-materialization';
    missingEvidenceRun.traceHash = 'missing-expected-materialization';
    const event = missingEvidenceRun.trace.damage.find(
      item => item.actionId === 'a3-expected'
    );
    delete event.formula.verifiedResult.expectedCritical
      .criticalEventMaterialized;

    const critical =
      createCanonicalTraceViewIndex(missingEvidenceRun).actionsById.get(
        'a3-expected'
      ).hits[0].critical;
    expect(critical.expectedResult.criticalEventMaterialized).toBeNull();
    expect(critical.eventMaterialized).toBeNull();
  });

  it('marks obsolete override identities as stale instead of rebinding them', () => {
    const staleRun = structuredClone(run);
    staleRun.hashes.traceHash = 'stale-hit-fixture';
    staleRun.traceHash = 'stale-hit-fixture';
    staleRun.trace.actions.find(
      action => action.id === 'a3-inherit'
    ).hitOverrides = {
      'obsolete-hit-identity': {
        willHit: false,
        criticalPolicy: 'critical',
      },
    };

    const action =
      createCanonicalTraceViewIndex(staleRun).actionsById.get('a3-inherit');
    expect(action.hits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          identity: 'obsolete-hit-identity',
          stale: true,
          landed: 'miss',
          criticalMode: 'critical',
        }),
      ])
    );
    expect(action.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'machine-axis-hit-override-stale',
          hitIdentity: 'obsolete-hit-identity',
        }),
      ])
    );
  });

  it('derives action-linked intervals from the canonical run effect timeline', () => {
    const appliedState = {
      stacks: 2,
      maxStacks: 2,
      effectName: '全队调谐强度提升',
      targetKind: 'actor',
      targetId: 'actor-1',
      expiresAtMs: 25_000,
    };
    const synthetic = {
      hashes: { traceHash: 'runtime-effect-interval-fixture' },
      simulation: {
        effectTimeline: {
          events: [
            {
              eventId: 'runtime-effect-applied',
              type: 'EFFECT_APPLIED',
              instanceKey: 'actor-1|effect-1',
              actionId: 'action-1',
              effectId: 'effect-1',
              effectName: '全队调谐强度提升',
              targetKind: 'actor',
              targetId: 'actor-1',
              timeMs: 1_000,
              stackAfter: 2,
              after: appliedState,
            },
            {
              eventId: 'runtime-effect-expired',
              type: 'EFFECT_EXPIRED',
              instanceKey: 'actor-1|effect-1',
              actionId: 'action-1',
              effectId: 'effect-1',
              effectName: '全队调谐强度提升',
              targetKind: 'actor',
              targetId: 'actor-1',
              timeMs: 25_000,
              stackBefore: 2,
              before: appliedState,
              after: null,
            },
          ],
        },
      },
      trace: {
        scenario: { durationMs: 30_000, frameRate: 60 },
        actions: [{ id: 'action-1', name: 'Action', hitOverrides: {} }],
        executionPlan: [],
        readiness: [],
        damage: [],
        effects: { events: [], intervals: [] },
        resources: {},
        variants: { selections: [] },
        diagnostics: [],
        state: {},
      },
    };

    const action =
      createCanonicalTraceViewIndex(synthetic).actionsById.get('action-1');
    const index = createCanonicalTraceViewIndex(synthetic);
    expect(index.traceHash).toBe('runtime-effect-interval-fixture');
    expect(index.summary.effectIntervalCount).toBe(1);
    expect(action.effectIntervals).toEqual([
      expect.objectContaining({
        effectId: 'effect-1',
        name: '全队调谐强度提升',
        targetId: 'actor-1',
        startMs: 1_000,
        endMs: 25_000,
        stacks: 2,
      }),
    ]);
  });
  it('keeps same-frame effects distinct and classifies toughness recovery', () => {
    const synthetic = {
      hashes: { traceHash: 'effect-fixture' },
      simulation: {
        effectTimeline: {
          intervals: [
            {
              intervalId: 'interval-a',
              sourceActionId: 'action-1',
            },
            {
              intervalId: 'interval-b',
              sourceActionIds: ['action-1'],
            },
          ],
        },
      },
      trace: {
        actions: [{ id: 'action-1', name: 'Action', hitOverrides: {} }],
        executionPlan: [],
        readiness: [],
        damage: [
          {
            actionId: 'action-1',
            eventType: 'VERIFIED_TOUGHNESS_STATE_CHANGE',
            stateEventKind: 'normal-toughness-recovery',
            timeMs: 1000,
            toughnessDamage: -12,
          },
        ],
        effects: {
          events: [
            {
              eventId: 'effect-a',
              actionId: 'action-1',
              effectId: 'shared-attribute',
              targetId: 'actor-a',
              operation: 'apply',
              timeMs: 1000,
              sourceIdentity: 'source-a',
              modifiers: [{ attributeId: 229, valueRaw: 18 }],
            },
            {
              eventId: 'effect-b',
              actionId: 'action-1',
              effectId: 'shared-attribute',
              targetId: 'actor-b',
              operation: 'apply',
              timeMs: 1000,
              sourceIdentity: 'source-b',
              modifiers: [{ attributeId: 229, valueRaw: 10 }],
            },
          ],
          intervals: [
            {
              intervalId: 'interval-a',
              effectId: 'shared-attribute',
              targetId: 'actor-a',
              startMs: 1000,
              endMs: 25_000,
            },
            {
              intervalId: 'interval-b',
              effectId: 'shared-attribute',
              targetId: 'actor-b',
              startMs: 1000,
              endMs: 16_000,
            },
          ],
        },
        resources: {},
        variants: { selections: [] },
        diagnostics: [],
        state: {},
      },
    };

    const action =
      createCanonicalTraceViewIndex(synthetic).actionsById.get('action-1');
    expect(action.effectEvents).toHaveLength(2);
    expect(action.effectEvents.map(event => event.identity)).toEqual([
      'effect-a',
      'effect-b',
    ]);
    expect(action.effectIntervals).toHaveLength(2);
    expect(action.effectIntervals.map(interval => interval.identity)).toEqual([
      'interval-a',
      'interval-b',
    ]);
    expect(action.toughnessFacts).toEqual([
      expect.objectContaining({
        kind: 'toughness-recovery',
        amount: 12,
        signedChange: -12,
      }),
    ]);
  });
});
