import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFixedCycleReplayAxis,
  createFixedCycleReplayCandidate,
} from './cycle-replay-axis.mjs';

function axis(actions = []) {
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxis',
    kind: 'azpr-machine-axis',
    scenario: {
      name: 'base',
      fps: 60,
      durationFrames: 7200,
      critical: { policy: 'expected', seed: null },
    },
    actions,
    metadata: {},
  };
}

const star = {
  id: 'star',
  owner: { kind: 'actor', slotId: 'm12c-slot:112001' },
  schedule: { mode: 'absolute', frame: 0, offsetFrames: 0 },
  intent: {
    kind: 'public-action',
    publicActionId: 11200112,
    actionKind: 'star-skill',
    level: 1,
  },
};
const normal = {
  id: 'normal',
  owner: { kind: 'actor', slotId: 'm12c-slot:112001' },
  schedule: { mode: 'absolute', frame: 271, offsetFrames: 0 },
  intent: {
    kind: 'public-action',
    publicActionId: 11200101,
    actionKind: 'normal-attack',
    level: 1,
  },
};
const wait = {
  id: 'wait',
  owner: { kind: 'system', slotId: null },
  schedule: { mode: 'absolute', frame: 289, offsetFrames: 0 },
  intent: { kind: 'wait', durationFrames: 6911 },
};

test('fixed cycle replay copies only the frozen Hero schedule', () => {
  const replay = createFixedCycleReplayAxis({
    baseAxis: axis(),
    templateAxis: axis([star, normal, wait]),
    templateRawIdentityHash: 'raw',
    templateAggregateHash: 'aggregate',
  });
  assert.deepEqual(replay.actions, [star, normal, wait]);
  assert.equal(
    replay.metadata.formalCycleReplay.semanticEquivalenceClaimed,
    false
  );
  assert.equal(replay.metadata.formalCycleReplay.admissibleBoundClaimed, false);
});

test('fixed cycle replay rejects autonomous Kibo or active actions', () => {
  assert.throws(
    () =>
      createFixedCycleReplayAxis({
        baseAxis: axis(),
        templateAxis: axis([
          {
            ...normal,
            id: 'kibo-active',
            owner: { kind: 'kibo', slotId: 'm12c-slot:112001' },
            intent: { ...normal.intent, actionKind: 'active-skill' },
          },
        ]),
      }),
    /outside the frozen Hero normal\/star surface/
  );
});

test('fixed cycle candidate requires closed proof and both legality checks', () => {
  const replayAxis = createFixedCycleReplayAxis({
    baseAxis: axis(),
    templateAxis: axis([star, normal, wait]),
  });
  const build = {
    buildHash: 'build',
    teamIdentity: 'team',
    actors: [],
  };
  const candidate = createFixedCycleReplayCandidate({
    axis: replayAxis,
    simulation: { hashes: { input: 'input', trace: 'trace' } },
    proof: {
      valid: true,
      status: 'closed',
      formalScore: 123,
      metrics: { hpDamage: 123 },
      actionLegalityProof: { passed: true },
    },
    validation: {
      valid: true,
      issues: [],
      warnings: [],
      actionLegalityProof: { passed: true },
    },
    build,
    pool: { poolHash: 'pool' },
    sourceConfig: { sourceConfigIdentity: 'source' },
    initialFront: { optimizationObjectId: '112001' },
  });
  assert.equal(candidate.score, 123);
  assert.equal(candidate.finalScoreEligible, true);
  assert.equal(candidate.coverageTrust.formalRankingReady, false);
  assert.throws(
    () =>
      createFixedCycleReplayCandidate({
        axis: replayAxis,
        simulation: { hashes: {} },
        proof: {
          valid: true,
          status: 'open',
          formalScore: 123,
          actionLegalityProof: { passed: true },
        },
        validation: {
          valid: true,
          actionLegalityProof: { passed: true },
        },
        build,
        pool: { poolHash: 'pool' },
        sourceConfig: { sourceConfigIdentity: 'source' },
        initialFront: {},
      }),
    /cycle-proof-not-closed/
  );
});
