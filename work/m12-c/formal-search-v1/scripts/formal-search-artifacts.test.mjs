import assert from 'node:assert/strict';
import test from 'node:test';
import {
  aggregateRoundAggregates,
  aggregateShardResults,
  sha256Canonical,
  stableJson,
  validateFinalCandidate,
} from './formal-search-artifacts.mjs';

const objective = 'cycle-dps-no-toughness';
const normalAttackInputAuthority = {
  schemaVersion: 1,
  contractName: 'AzPrVerifiedNormalAttackInputAuthority',
  policyVersion: '1.0.0',
  contractHash: '0123456789abcdef',
};

test('stable hashing ignores object insertion order', () => {
  assert.equal(stableJson({ b: 2, a: 1 }), stableJson({ a: 1, b: 2 }));
  assert.equal(
    sha256Canonical({ b: 2, a: 1 }),
    sha256Canonical({ a: 1, b: 2 })
  );
});

test('aggregation keeps failures separate and never converts them to zero', () => {
  const good = createResult({ score: 42, inputHash: 'input-a' });
  const aggregate = aggregateShardResults({
    runId: 'run-1',
    roundId: 'round-1',
    objective,
    topN: 5,
    baseline: { head: 'a'.repeat(40) },
    expectedSourceConfigIdentities: ['source-a', 'source-b', 'source-c'],
    shardArtifacts: [
      createShard('source-a', [good]),
      {
        checkpoint: {
          status: 'failed',
          shardId: 'shard-b',
          coverage: { sourceConfigIdentity: 'source-b' },
        },
      },
    ],
  });
  assert.equal(aggregate.results.length, 1);
  assert.equal(aggregate.results[0].score, 42);
  assert.deepEqual(aggregate.coverage.failedSourceConfigIdentities, [
    'source-b',
  ]);
  assert.deepEqual(aggregate.coverage.missingSourceConfigIdentities, [
    'source-c',
  ]);
  assert.equal(aggregate.summary.topNReady, false);
});

test('old checkpoints and candidates without combo authority fail closed', () => {
  const candidate = createResult({ score: 42, inputHash: 'legacy' });
  delete candidate.legality.proof.normalAttackInputAuthority;
  delete candidate.objectiveProof.normalAttackInputProof
    .normalAttackInputAuthority;
  assert.ok(
    validateFinalCandidate(candidate, objective).issues.includes(
      'candidate-normal-attack-input-authority-missing'
    )
  );

  const legacyShard = createShard('legacy-source', [
    createResult({ score: 42, inputHash: 'legacy-shard' }),
  ]);
  delete legacyShard.checkpoint.normalAttackInputAuthority;
  delete legacyShard.result.normalAttackInputAuthority;
  const aggregate = aggregateShardResults({
    runId: 'run-legacy',
    roundId: 'round-legacy',
    objective,
    topN: 1,
    baseline: { head: 'a'.repeat(40) },
    normalAttackInputAuthority,
    expectedSourceConfigIdentities: ['legacy-source'],
    shardArtifacts: [legacyShard],
  });
  assert.deepEqual(aggregate.results, []);
  assert.deepEqual(aggregate.coverage.failedSourceConfigIdentities, [
    'legacy-source',
  ]);
  assert.ok(
    aggregate.invalidArtifacts.some(entry =>
      entry.issues.includes('checkpoint-normal-attack-input-authority-missing')
    )
  );
});

test('aggregation is deterministic, deduplicates raw identity, and preserves cutoff ties', () => {
  const rows = [50, 40, 30, 20, 10, 10, 5].map((score, index) =>
    createResult({ score, inputHash: `input-${index}` })
  );
  const duplicate = structuredClone(rows[0]);
  const first = aggregateShardResults({
    runId: 'run-2',
    roundId: 'round-1',
    objective,
    topN: 5,
    baseline: { head: 'b'.repeat(40) },
    expectedSourceConfigIdentities: ['source-a', 'source-b'],
    shardArtifacts: [
      createShard('source-b', [rows[3], rows[4], rows[5], rows[6]]),
      createShard('source-a', [rows[0], duplicate, rows[1], rows[2]]),
    ],
  });
  const second = aggregateShardResults({
    runId: 'run-2',
    roundId: 'round-1',
    objective,
    topN: 5,
    baseline: { head: 'b'.repeat(40) },
    expectedSourceConfigIdentities: ['source-b', 'source-a'],
    shardArtifacts: [
      createShard('source-a', [rows[2], rows[1], duplicate, rows[0]], 9999),
      createShard('source-b', [rows[6], rows[5], rows[4], rows[3]], 8888),
    ],
  });
  assert.equal(first.aggregateHash, second.aggregateHash);
  assert.deepEqual(
    first.results.map(row => row.score),
    [50, 40, 30, 20, 10]
  );
  assert.equal(first.cutoffTies.length, 1);
  assert.equal(first.cutoffTies[0].score, 10);
});

test('fastest-kill sorts finite formal times ascending', () => {
  const aggregate = aggregateShardResults({
    runId: 'run-3',
    roundId: 'round-1',
    objective: 'fastest-kill',
    topN: 2,
    baseline: { head: 'c'.repeat(40) },
    expectedSourceConfigIdentities: ['source-a'],
    shardArtifacts: [
      createShard('source-a', [
        createResult({
          objectiveId: 'fastest-kill',
          score: 2000,
          inputHash: 'kill-slow',
        }),
        createResult({
          objectiveId: 'fastest-kill',
          score: 1000,
          inputHash: 'kill-fast',
        }),
      ]),
    ],
  });
  assert.deepEqual(
    aggregate.results.map(row => row.score),
    [1000, 2000]
  );
});

test('combined objective aggregation keeps unique candidates across rounds', () => {
  const round1 = aggregateShardResults({
    runId: 'run-4',
    roundId: 'round-1',
    objective,
    topN: 5,
    baseline: { head: 'd'.repeat(40) },
    expectedSourceConfigIdentities: ['source-a'],
    shardArtifacts: [
      createShard('source-a', [createResult({ score: 10, inputHash: 'same' })]),
    ],
  });
  const round2 = aggregateShardResults({
    runId: 'run-4',
    roundId: 'round-2',
    objective,
    topN: 5,
    baseline: { head: 'd'.repeat(40) },
    expectedSourceConfigIdentities: ['source-a'],
    shardArtifacts: [
      createShard('source-a', [
        createResult({ score: 10, inputHash: 'same' }),
        createResult({ score: 12, inputHash: 'new' }),
      ]),
    ],
  });
  const combined = aggregateRoundAggregates({
    runId: 'run-4',
    objective,
    topN: 5,
    baseline: { head: 'd'.repeat(40) },
    roundAggregates: [round2, round1],
  });
  assert.deepEqual(
    combined.results.map(row => row.score),
    [12, 10]
  );
  assert.deepEqual(combined.roundIds, ['round-1', 'round-2']);
});

test('strict final validation rejects a zero-value Ruby resource in a cold cycle preset', () => {
  const result = createResult({ score: 10, inputHash: 'cold-ruby-zero' });
  result.axis.scenario.initialRuntimeState.specialResourcesByActor = [
    {
      actorId: 'actor-103002',
      characterId: 103002,
      resourceIdentity: 'actor:103002:element:103002047',
      currentValue: 0,
      maxValue: 12,
      inputStep: 1,
      scenarioConfigurable: true,
      activeStates: [],
    },
  ];
  assert.deepEqual(validateFinalCandidate(result, objective), {
    valid: false,
    issues: ['candidate-cycle-special-resources-not-empty'],
  });
});

test('strict final validation rejects disguised cold-cycle resource fields', () => {
  const result = createResult({ score: 10, inputHash: 'cold-disguised-ruby' });
  result.axis.scenario.initialRuntimeState.rubyAmmo = 0;
  assert.ok(
    validateFinalCandidate(result, objective).issues.includes(
      'candidate-initial-runtime-state-field-forbidden'
    )
  );
});

test('fastest-kill admits only full actor/Kibo SP, Ruby 12, and zero marks', () => {
  const valid = createKillRubyResult(12);
  assert.deepEqual(validateFinalCandidate(valid, 'fastest-kill'), {
    valid: true,
    issues: [],
  });

  const zeroRuby = createKillRubyResult(0);
  assert.ok(
    validateFinalCandidate(zeroRuby, 'fastest-kill').issues.includes(
      'candidate-kill-ruby-ammunition-preset-mismatch'
    )
  );

  const marked = createKillRubyResult(12);
  marked.axis.scenario.initialRuntimeState.tuningMarks = [{ markId: 1 }];
  assert.ok(
    validateFinalCandidate(marked, 'fastest-kill').issues.includes(
      'candidate-initial-tuning-marks-not-zero'
    )
  );

  const disguised = createKillRubyResult(12);
  disguised.axis.scenario.initialRuntimeState.specialResourcesByActor[0].alias =
    'ruby';
  assert.ok(
    validateFinalCandidate(disguised, 'fastest-kill').issues.includes(
      'candidate-kill-ruby-ammunition-preset-mismatch'
    )
  );
});

function createShard(sourceConfigIdentity, results, wallTimeMs = 10) {
  return {
    checkpoint: {
      status: 'completed',
      shardId: `shard-${sourceConfigIdentity}`,
      normalAttackInputAuthority,
      coverage: { sourceConfigIdentity },
    },
    result: {
      objective:
        results[0]?.axis?.scenario?.objectiveContract?.objectiveId ?? objective,
      normalAttackInputAuthority,
      summary: { candidatesEvaluated: results.length, wallTimeMs },
      results,
    },
  };
}

function createResult({
  score,
  inputHash,
  objectiveId = objective,
  buildHash = 'build-a',
} = {}) {
  const isKill = objectiveId === 'fastest-kill';
  const expectedSp = isKill ? 100 : 0;
  const team = [
    createTeamSlot('slot-1', 109001, expectedSp),
    createTeamSlot('slot-2', 112001, expectedSp),
    createTeamSlot('slot-3', 107002, expectedSp),
  ];
  const initialRuntimeState = {
    controlledActor: { actorId: 'actor-109001', characterId: 109001 },
    kiboEnergyBySlot: team.map(slot => ({
      slotId: slot.slotId,
      actorId: `actor-${slot.characterId}`,
      characterId: slot.characterId,
      kiboId: slot.loadout.kiboId,
      currentValue: expectedSp,
      maxValue: 100,
    })),
    tuningMarks: [],
    specialResourcesByActor: [],
  };
  const presetHash = createPresetHash({
    scope: isKill ? 'kill' : 'cycle',
    team,
    initialRuntimeState,
  });
  const result = {
    score,
    finalScoreEligible: true,
    hashes: { input: inputHash, trace: `trace-${inputHash}` },
    legality: {
      valid: true,
      invalidActionCount: 0,
      proof: {
        passed: true,
        skippedActionCount: 0,
        unresolvedActionCount: 0,
        normalAttackInputAuthority,
      },
    },
    objectiveProof: {
      valid: true,
      formalScore: score,
      normalAttackInputProof: { normalAttackInputAuthority },
    },
    objectiveIssues: [],
    m12c: {
      buildHash,
      sourceConfigIdentity: 'source-a',
      initialFront: {
        actorSlotId: 'slot-1',
        optimizationObjectId: '109001',
        sourceCharacterId: 109001,
      },
      build: {
        actors: [
          createBuildActor('slot-1', '109001', 109001),
          createBuildActor('slot-2', '112001', 112001),
          createBuildActor('slot-3', '107002', 107002),
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
        enemy: {
          enemyId: 310054,
          level: 80,
          profile: { profileHash: 'cb1edcc277fcda5b' },
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
          objectiveId,
          objectiveScope: isKill ? 'kill' : 'cycle',
          mechanicsPackageId: 'azpr-tc-2026-07-18',
          mechanicsPackageHash:
            'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58',
          presetHash,
        },
        objectiveContract: { objectiveId },
        optimizationQualification: {
          mode: 'formal',
          catalogHash: 'qualification-catalog',
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
          : {
              hpMode: 'infinite',
              toughnessMode:
                objectiveId === 'cycle-dps-no-toughness'
                  ? 'disabled'
                  : 'enabled',
              breakMode:
                objectiveId === 'cycle-dps-no-toughness'
                  ? 'disabled'
                  : 'enabled',
              deathTruncation: 'disabled',
            },
      },
      actions: [],
    },
  };
  result.m12c.sourceConfigIdentity = `source-${inputHash}`;
  return result;
}

function createTeamSlot(slotId, characterId, initialSp) {
  return {
    slotId,
    characterId,
    initialSp,
    loadout: { kiboId: 500001 },
  };
}

function createBuildActor(
  actorSlotId,
  optimizationObjectId,
  sourceCharacterId
) {
  return { actorSlotId, optimizationObjectId, sourceCharacterId };
}

function createPresetHash({ scope, team, initialRuntimeState }) {
  const specialResources = initialRuntimeState.specialResourcesByActor.map(
    row => ({
      actorId: row.actorId,
      characterId: row.characterId,
      resourceIdentity: row.resourceIdentity,
      currentValue: row.currentValue,
      capacity: row.maxValue,
      inputStep: row.inputStep,
      activeStates: row.activeStates,
      sourceIdentity:
        'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#ModuleChargingSkill103002._burstElementId|C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/Element/ast_103002047.asset/MonoBehaviour/ast_103002047__3663436943335475859.json#elementConfigId=103002047',
    })
  );
  return sha256Canonical({
    policyId: 'm12c-initial-state-v1',
    policyVersion: '1.0.0',
    objectiveScope: scope,
    mechanicsPackageId: 'azpr-tc-2026-07-18',
    mechanicsPackageHash:
      'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58',
    actorSp: team
      .map(slot => ({ slotId: slot.slotId, currentValue: slot.initialSp }))
      .sort((left, right) => left.slotId.localeCompare(right.slotId, 'en')),
    kiboSp: initialRuntimeState.kiboEnergyBySlot
      .map(row => ({ slotId: row.slotId, currentValue: row.currentValue }))
      .sort((left, right) => left.slotId.localeCompare(right.slotId, 'en')),
    tuningMarks: [],
    specialResources,
  });
}

function createKillRubyResult(ammo) {
  const result = createResult({
    score: 1000,
    inputHash: `kill-ruby-${ammo}`,
    objectiveId: 'fastest-kill',
  });
  const teamSlot = result.axis.scenario.team[2];
  teamSlot.characterId = 103002;
  const buildActor = result.m12c.build.actors[2];
  buildActor.optimizationObjectId = '103002';
  buildActor.sourceCharacterId = 103002;
  const energy = result.axis.scenario.initialRuntimeState.kiboEnergyBySlot[2];
  energy.actorId = 'actor-103002';
  energy.characterId = 103002;
  result.axis.scenario.initialRuntimeState.specialResourcesByActor = [
    {
      actorId: 'actor-103002',
      characterId: 103002,
      resourceIdentity: 'actor:103002:element:103002047',
      currentValue: ammo,
      maxValue: 12,
      inputStep: 1,
      scenarioConfigurable: true,
      activeStates: [],
    },
  ];
  result.axis.scenario.initialStatePreset.presetHash = createPresetHash({
    scope: 'kill',
    team: result.axis.scenario.team,
    initialRuntimeState: result.axis.scenario.initialRuntimeState,
  });
  return result;
}
