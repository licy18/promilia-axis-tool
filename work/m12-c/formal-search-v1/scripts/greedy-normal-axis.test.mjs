import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyGreedyKillProbe,
  deriveGreedyNormalCadence,
  synthesizeGreedyNormalAxis,
} from './greedy-normal-axis.mjs';

test('derives and synthesizes a deterministic right-window normal cadence', () => {
  const first = action(1, 0);
  const second = action(2, 18);
  const cadence = deriveGreedyNormalCadence(first, second);
  const axis = synthesizeGreedyNormalAxis({
    baseAxis: { scenario: { name: 'base' }, actions: [] },
    cadence,
    actionCount: 4,
  });
  assert.deepEqual(
    axis.actions.map(row => row.schedule.frame),
    [0, 18, 36, 54]
  );
  assert.deepEqual(
    axis.actions.map(row => row.intent.attackInput.groupId),
    ['group|1', 'group|2', 'group|3', 'group|4']
  );
  assert.equal(axis.scenario.name, 'base [greedy-normal-v1:4]');
});

test('rejects cadence identities that would require semantic guessing', () => {
  const first = action(1, 0);
  const second = action(2, 18);
  second.intent.attackInput.sequenceIndex = 2;
  assert.throws(
    () => deriveGreedyNormalCadence(first, second),
    /stable A1 surface/
  );
});

test('classifies killed, non-killed, and invalid probes without zero scoring', () => {
  assert.equal(
    classifyGreedyKillProbe({
      proof: {
        valid: true,
        status: 'killed',
        formalScore: 99,
        killProof: { feasible: true },
      },
    })
      .status,
    'killed-valid'
  );
  assert.equal(
    classifyGreedyKillProbe({
      proof: {
        valid: true,
        status: 'not-killed',
        formalScore: null,
        killProof: { feasible: false },
        issues: [],
      },
    }).status,
    'valid-not-killed'
  );
  assert.equal(
    classifyGreedyKillProbe({
      proof: {
        valid: true,
        status: 'not-killed',
        formalScore: null,
        killProof: { feasible: false },
      },
    }).formalScore,
    null
  );
  assert.equal(
    classifyGreedyKillProbe({ error: { issues: [{ code: 'post-death' }] } })
      .status,
    'invalid-upper-bound'
  );
});

function action(ordinal, frame) {
  return {
    id: `search-action-${ordinal}`,
    owner: { kind: 'actor', slotId: 'm12c-slot:112001' },
    schedule: { mode: 'absolute', frame, offsetFrames: 0 },
    intent: {
      kind: 'public-action',
      publicActionId: 11200101,
      actionKind: 'normal-attack',
      level: 1,
      attackInput: { sequenceIndex: 1, groupId: `group|${ordinal}` },
    },
  };
}
