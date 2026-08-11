import assert from 'node:assert/strict';
import test from 'node:test';

import { sha256Canonical } from './formal-search-artifacts.mjs';
import { finalizeObjectiveArtifacts } from './formal-search-finalization.mjs';

const baseline = { head: 'baseline-head' };

test('finalization fixes shard-local ranks, deduplicates raw identities, and preserves ties', () => {
  const objective = 'cycle-dps-no-toughness';
  const first = candidate({ objective, score: 30, suffix: 'a', oldRank: 1 });
  const duplicate = structuredClone(first);
  duplicate.rank = 4;
  const rows = [
    first,
    candidate({ objective, score: 20, suffix: 'b', oldRank: 1 }),
    candidate({ objective, score: 10, suffix: 'c', oldRank: 1 }),
    candidate({ objective, score: 10, suffix: 'd', oldRank: 1 }),
    candidate({ objective, score: 10, suffix: 'e', oldRank: 1 }),
    candidate({ objective, score: 10, suffix: 'f', oldRank: 1 }),
  ];
  const finalized = finalizeObjectiveArtifacts({
    runId: 'run',
    objective,
    baseline,
    rounds: [
      round({ roundId: 'round1', objective, rows }),
      round({ roundId: 'round2', objective, rows: [duplicate] }),
    ],
  });
  assert.equal(finalized.validity.valid, true);
  assert.deepEqual(
    finalized.results.map(row => row.rank),
    [1, 2, 3, 4, 5]
  );
  assert.deepEqual(
    finalized.results.map(row => row.score),
    [30, 20, 10, 10, 10]
  );
  assert.equal(finalized.summary.exploredValidDistinctCandidateCount, 6);
  assert.equal(finalized.summary.cutoffTieCount, 1);
  assert.equal(finalized.cutoffTies[0].score, 10);
});

test('fastest-kill ranks lower killed-frame scores first', () => {
  const objective = 'fastest-kill';
  const finalized = finalizeObjectiveArtifacts({
    runId: 'run',
    objective,
    baseline,
    rounds: [
      round({
        roundId: 'round1',
        objective,
        rows: [50, 10, 40, 20, 30].map((score, index) =>
          candidate({ objective, score, suffix: String(index), oldRank: 1 })
        ),
      }),
    ],
  });
  assert.equal(finalized.validity.valid, true);
  assert.deepEqual(
    finalized.results.map(row => row.score),
    [10, 20, 30, 40, 50]
  );
});

test('incomplete or failed coverage fails closed without inventing candidates', () => {
  const objective = 'cycle-dps-with-toughness';
  const fixture = round({
    roundId: 'round1',
    objective,
    rows: [candidate({ objective, score: 1, suffix: 'a', oldRank: 1 })],
  });
  fixture.aggregate.coverage.failedSourceConfigIdentities = ['failed-source'];
  const finalized = finalizeObjectiveArtifacts({
    runId: 'run',
    objective,
    baseline,
    rounds: [fixture],
  });
  assert.equal(finalized.validity.valid, false);
  assert.equal(finalized.summary.topNReady, false);
  assert.ok(finalized.validity.issues.some(issue => issue.startsWith('round-failed-shards')));
});

test('declared terminal rounds rank only terminal raw identities while retaining all-round evidence', () => {
  const objective = 'cycle-dps-no-toughness';
  const finalized = finalizeObjectiveArtifacts({
    runId: 'run',
    objective,
    baseline,
    rankingRoundIds: ['round2'],
    rounds: [
      round({
        roundId: 'round1',
        objective,
        rows: [100, 99, 98, 97, 96].map((score, index) =>
          candidate({ objective, score, suffix: `old-${index}`, oldRank: 1 })
        ),
      }),
      round({
        roundId: 'round2',
        objective,
        rows: [50, 40, 30, 20, 10].map((score, index) =>
          candidate({ objective, score, suffix: `terminal-${index}`, oldRank: 1 })
        ),
      }),
    ],
  });
  assert.equal(finalized.validity.valid, true);
  assert.deepEqual(
    finalized.results.map(row => row.score),
    [50, 40, 30, 20, 10]
  );
  assert.equal(finalized.coverage.roundCount, 2);
  assert.equal(finalized.coverage.completedShardCount, 2);
  assert.equal(finalized.budgetUsage.candidatesEvaluated, 10);
  assert.deepEqual(finalized.rankingEvidence.roundIds, ['round2']);
  assert.equal(finalized.rankingEvidence.semanticEquivalenceApplied, false);
});

test('missing declared terminal round fails closed', () => {
  const objective = 'cycle-dps-no-toughness';
  const finalized = finalizeObjectiveArtifacts({
    runId: 'run',
    objective,
    baseline,
    rankingRoundIds: ['round-missing'],
    rounds: [
      round({
        roundId: 'round1',
        objective,
        rows: [candidate({ objective, score: 1, suffix: 'a', oldRank: 1 })],
      }),
    ],
  });
  assert.equal(finalized.validity.valid, false);
  assert.equal(finalized.summary.topNReady, false);
  assert.ok(
    finalized.validity.issues.includes('ranking-round-not-found:round-missing')
  );
});

function round({ roundId, objective, rows }) {
  const resultArtifact = {
    objective,
    baseline,
    serviceResult: {
      objective,
      summary: { candidatesEvaluated: rows.length },
      results: rows,
    },
  };
  const checkpoint = {
    status: 'completed',
    shardId: `${roundId}-shard`,
    inputHash: `${roundId}-input`,
    guidanceHash: `${roundId}-guidance`,
    coverage: { sourceConfigIdentity: `${roundId}-source` },
    artifacts: { resultCanonicalSha256: sha256Canonical(resultArtifact) },
  };
  return {
    roundId,
    manifest: {
      iteration: Number(roundId.replace(/\D/g, '')) || 1,
      guidanceHash: checkpoint.guidanceHash,
      sourceConfigCount: 1,
    },
    aggregate: {
      objective,
      baseline,
      aggregateHash: `${roundId}-aggregate`,
      coverage: {
        completedSourceConfigIdentities: [checkpoint.coverage.sourceConfigIdentity],
        failedSourceConfigIdentities: [],
        missingSourceConfigIdentities: [],
      },
    },
    feedbackAggregate: { feedbackAggregateHash: `${roundId}-feedback` },
    shards: [{ checkpoint, resultArtifact }],
  };
}

function candidate({ objective, score, suffix, oldRank }) {
  const isKill = objective === 'fastest-kill';
  const initialSp = isKill ? 100 : 0;
  const team = [109001, 112001, 107002].map((characterId, index) => ({
    slotId: `slot-${index + 1}`,
    characterId,
    initialSp,
    loadout: { kiboId: 500001 },
  }));
  const initialRuntimeState = {
    controlledActor: { actorId: 'actor-109001', characterId: 109001 },
    kiboEnergyBySlot: team.map(slot => ({
      slotId: slot.slotId,
      actorId: `actor-${slot.characterId}`,
      characterId: slot.characterId,
      kiboId: slot.loadout.kiboId,
      currentValue: initialSp,
      maxValue: 100,
    })),
    tuningMarks: [],
    specialResourcesByActor: [],
  };
  const presetHash = sha256Canonical({
    policyId: 'm12c-initial-state-v1',
    policyVersion: '1.0.0',
    objectiveScope: isKill ? 'kill' : 'cycle',
    mechanicsPackageId: 'azpr-tc-2026-07-18',
    mechanicsPackageHash:
      'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58',
    actorSp: team.map(slot => ({
      slotId: slot.slotId,
      currentValue: slot.initialSp,
    })),
    kiboSp: initialRuntimeState.kiboEnergyBySlot.map(row => ({
      slotId: row.slotId,
      currentValue: row.currentValue,
    })),
    tuningMarks: [],
    specialResources: [],
  });
  return {
    rank: oldRank,
    score,
    finalScoreEligible: true,
    legality: {
      valid: true,
      invalidActionCount: 0,
      proof: {
        passed: true,
        skippedActionCount: 0,
        unresolvedActionCount: 0,
      },
    },
    objectiveProof: { valid: true, formalScore: score },
    objectiveIssues: [],
    m12c: {
      buildHash: `build-${suffix}`,
      sourceConfigIdentity: `source-${suffix}`,
      teamIdentity: `team-${suffix}`,
      initialFront: {
        actorSlotId: 'slot-1',
        optimizationObjectId: '109001',
        sourceCharacterId: 109001,
      },
      build: {
        actors: [
          {
            actorSlotId: 'slot-1',
            optimizationObjectId: '109001',
            sourceCharacterId: 109001,
          },
          {
            actorSlotId: 'slot-2',
            optimizationObjectId: '112001',
            sourceCharacterId: 112001,
          },
          {
            actorSlotId: 'slot-3',
            optimizationObjectId: '107002',
            sourceCharacterId: 107002,
          },
        ],
        authority: {
          qualificationCatalogHash: 'qualification-catalog',
          qualificationBindingMatrixHash: 'qualification-binding',
        },
      },
    },
    axis: {
      dataIdentity: {
        verifiedMechanicsPackageId: 'azpr-tc-2026-07-18',
        verifiedMechanicsPackageHash:
          'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58',
      },
      scenario: {
        team,
        objectiveContract: { objectiveId: objective },
        enemy: {
          enemyId: 310054,
          level: 80,
          profile: { profileHash: 'cb1edcc277fcda5b' },
        },
        optimizationQualification: {
          mode: 'formal',
          catalogHash: 'qualification-catalog',
        },
        initialRuntimeState,
        initialStatePreset: {
          schemaVersion: 1,
          contractName: 'AzPrM12CInitialStatePreset',
          policyId: 'm12c-initial-state-v1',
          policyVersion: '1.0.0',
          policyHash:
            'd73197058df0f0de30dc6a480a4d768001b674f0ef111b6abd21ec6d540761cf',
          presetId: isKill
            ? 'm12c-kill-full-sp-ruby12-zero-marks-v1'
            : 'm12c-cycle-cold-zero-state-v1',
          objectiveId: objective,
          objectiveScope: isKill ? 'kill' : 'cycle',
          mechanicsPackageId: 'azpr-tc-2026-07-18',
          mechanicsPackageHash:
            'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58',
          presetHash,
        },
        critical: { policy: 'expected', seed: null },
        jointAttackRuntime: { formalReady: true, clientParityReady: false },
        target: isKill
          ? {
              hpMode: 'finite',
              toughnessMode: 'enabled',
              breakMode: 'enabled',
              deathTruncation: 'enabled',
            }
          : objective === 'cycle-dps-no-toughness'
            ? {
                hpMode: 'infinite',
                toughnessMode: 'disabled',
                breakMode: 'disabled',
                deathTruncation: 'disabled',
              }
            : {
                hpMode: 'infinite',
                toughnessMode: 'enabled',
                breakMode: 'enabled',
                deathTruncation: 'disabled',
              },
      },
      actions: [],
    },
    hashes: { input: `input-${suffix}`, trace: `trace-${suffix}` },
  };
}
