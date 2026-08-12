import fixture from '../../../fixtures/machine-axis/m11-b-three-actor-authority.json';
import rubyOwnerContract from '../../data/generated/character-combat-owner-contracts/103002.json';
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
    expect(first.traceHash).toBe(run.hashes.trace);
    expect(first.actionViews).toHaveLength(run.trace.actions.length);

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

    const ruby = first.actionsById.get('ruby-plunging');
    expect(ruby.hits.length).toBeGreaterThan(0);
  });

  it('projects a legal Ruby enhanced continuation and its ammunition transaction', () => {
    installRubyProfileOverlay();
    try {
      const contract = structuredClone(fixture);
      contract.actions = contract.actions.filter(
        action => action.id !== 'ruby-plunging'
      );
      contract.scenario.team.find(slot => slot.slotId === 'slot-3').initialSp =
        100;
      contract.actions.push(
        {
          id: 'ruby-ultimate-context',
          owner: { kind: 'actor', slotId: 'slot-3' },
          intent: {
            kind: 'public-action',
            publicActionId: 10300213,
            actionKind: 'ultimate',
          },
          schedule: { mode: 'absolute', frame: 5700 },
        },
        {
          id: 'ruby-enhanced-context',
          owner: { kind: 'actor', slotId: 'slot-3' },
          intent: {
            kind: 'public-action',
            publicActionId: 10300201,
            actionKind: 'normal-attack',
            attackInput: {
              sequenceIndex: 1,
              chainIdentity: 'ruby-enhanced-twelve-inputs',
              contextActionId: 'ruby-ultimate-context',
            },
          },
          schedule: { mode: 'absolute', frame: 6029 },
        }
      );

      const ruby = createCanonicalTraceViewIndex(
        createMachineAxisService().simulate(contract)
      ).actionsById.get('ruby-enhanced-context');
      expect(ruby.resolved).toMatchObject({
        controlSkillId: 10300201,
        subSkillIndex: 1,
      });
      expect(ruby.resourceTransactions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            resourceIdentity: 'actor:103002:element:103002047',
            before: 12,
            after: 11,
            change: -1,
          }),
        ])
      );
    } finally {
      installVerifiedCombatMechanicsPackage(mechanicsPackage);
    }
  });

  it('keeps miss rows editable and exposes each critical contract separately', () => {
    const index = createCanonicalTraceViewIndex(run);
    const hitIdentity = '10100711|0|elements|0|-6537565703316603243|35|1';

    expect(index.actionsById.get('plunging-miss').hits).toEqual([
      expect.objectContaining({
        identity: hitIdentity,
        landed: 'miss',
        settlements: [],
      }),
    ]);
    expect(index.actionsById.get('plunging-sampled').hits[0]).toMatchObject({
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
    const expectedHit = index.actionsById.get('plunging-expected').hits[0];
    expect(expectedHit).toMatchObject({
      criticalMode: 'expected',
      critical: {
        expected: true,
        expectedProbabilityBasisPoints: 500,
        sourceCriticalDamageMultiplier: 1.5,
        sourceCriticalDamageBasisPoints: 15000,
        expectedResult: {
          probabilityBasisPoints: 500,
          nonCriticalRaw: '7864320',
          nonCriticalValue: 120,
          criticalRaw: '11796480',
          criticalValue: 180,
          weightedRaw: '8060928',
          weightedValue: 123,
          weightedInteger: '123',
          criticalEventMaterialized: false,
        },
        eventMaterialized: false,
      },
    });
    expect(expectedHit.critical.sourceCriticalDamageMultiplier).toBeCloseTo(
      1.5,
      4
    );
    expect(index.actionsById.get('plunging-critical').hits[0]).toMatchObject({
      criticalMode: 'critical',
      critical: { critical: true, eventMaterialized: true },
    });
    expect(
      index.actionsById.get('plunging-non-critical').hits[0]
    ).toMatchObject({
      criticalMode: 'non-critical',
      critical: { critical: false, eventMaterialized: false },
    });
  });

  it('preserves missing expected materialization evidence as unknown', () => {
    const missingEvidenceRun = structuredClone(run);
    missingEvidenceRun.hashes.trace = 'missing-expected-materialization';
    missingEvidenceRun.traceHash = 'missing-expected-materialization';
    const event = missingEvidenceRun.trace.damage.find(
      item => item.actionId === 'plunging-expected'
    );
    delete event.formula.verifiedResult.expectedCritical
      .criticalEventMaterialized;

    const critical =
      createCanonicalTraceViewIndex(missingEvidenceRun).actionsById.get(
        'plunging-expected'
      ).hits[0].critical;
    expect(critical.expectedResult.criticalEventMaterialized).toBeNull();
    expect(critical.eventMaterialized).toBeNull();
  });

  it('marks obsolete override identities as stale instead of rebinding them', () => {
    const staleRun = structuredClone(run);
    staleRun.hashes.traceHash = 'stale-hit-fixture';
    staleRun.traceHash = 'stale-hit-fixture';
    staleRun.trace.actions.find(
      action => action.id === 'plunging-inherit'
    ).hitOverrides = {
      'obsolete-hit-identity': {
        willHit: false,
        criticalPolicy: 'critical',
      },
    };

    const action =
      createCanonicalTraceViewIndex(staleRun).actionsById.get(
        'plunging-inherit'
      );
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

function installRubyProfileOverlay() {
  const runtimePackage = structuredClone(mechanicsPackage);
  const mapping = runtimePackage.actionMappings.find(
    candidate =>
      Number(candidate.ownerId) === 103002 &&
      candidate.actionKind === 'normal-attack'
  );
  const chains = rubyOwnerContract.contracts.attackInputChains ?? [];
  mapping.profileAttackInputSegments = chains.flatMap(chain =>
    (chain.segments ?? []).map(segment => {
      const selectedSubSkillIndex = Number(segment.subSkillIndex ?? 0);
      const selectedHitIdentities = (segment.executionTiming?.hits ?? [])
        .map(hit => hit.hitIdentity)
        .filter(Boolean);
      return {
        ...structuredClone(segment),
        identity: `${chain.chainIdentity}:segment:${segment.sequenceIndex}`,
        attackInputChainIdentity: chain.chainIdentity,
        chainSequenceIndex: segment.sequenceIndex,
        sequenceTotal: segment.sequenceTotal ?? chain.segments.length,
        selectedSubSkillIndex,
        effectiveDurationFrames: segment.durationFrames,
        durationStatus: 'applied',
        effectiveDurationStatus: 'applied',
        durationSourceIdentity: segment.sourceIdentity,
        sourceEvidenceStatus: 'applied',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        runtimeReady: true,
        schedulable: true,
        selectedHitIdentities,
        hitCount: selectedHitIdentities.length,
        actionScheduling: {
          status: 'exact',
          kind: 'exact-selected-variant-occupancy',
          durationFrames: segment.durationFrames,
          planningDurationFrames: null,
          selectedSubSkillIndex,
          sourceIdentity: segment.sourceIdentity,
          sourceStatus: 'verified-input-occupancy',
          variantModelStatus: 'resolved',
          reasons: [],
        },
      };
    })
  );
  mapping.profileVariantWindowBindings = structuredClone(
    rubyOwnerContract.contracts.variantWindowBindings ?? []
  );
  installVerifiedCombatMechanicsPackage(runtimePackage);
}
