import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GREEDY_NORMAL_RETIREMENT_CODE,
  assertGreedyNormalSynthesisAvailable,
  classifyGreedyKillProbe,
  deriveGreedyNormalCadence,
  synthesizeGreedyNormalAxis,
} from './greedy-normal-axis.mjs';

test('retires fixed-cadence synthesis instead of repeating A1', () => {
  const first = action(1, 0);
  const second = action(2, 18);
  assert.throws(
    () => deriveGreedyNormalCadence(first, second),
    error => error.code === GREEDY_NORMAL_RETIREMENT_CODE
  );
  assert.throws(
    () =>
      synthesizeGreedyNormalAxis({
        baseAxis: { scenario: { name: 'base' }, actions: [] },
        cadence: {},
        actionCount: 4,
      }),
    error => error.code === GREEDY_NORMAL_RETIREMENT_CODE
  );
  assert.throws(
    () => assertGreedyNormalSynthesisAvailable(),
    error => error.code === GREEDY_NORMAL_RETIREMENT_CODE
  );
});

test('rejects even a superficially plausible A1-to-A2 cadence because later phases are not periodic', () => {
  const first = action(1, 0);
  const second = action(2, 18);
  second.intent.attackInput.sequenceIndex = 2;
  assert.throws(
    () => deriveGreedyNormalCadence(first, second),
    /fixed-cadence normal synthesis cannot represent verified successor/
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
    }).status,
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
