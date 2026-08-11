import assert from 'node:assert/strict';
import test from 'node:test';

import { materializeFormalInitialState } from './formal-initial-state.mjs';

const sourceConfig = {
  actors: [
    { optimizationObjectId: '103002' },
    { optimizationObjectId: '109001' },
    { optimizationObjectId: '112001' },
  ],
};

function preset(rubyAmmo) {
  return {
    presetId: 'preset',
    actorSp: 'zero',
    kiboSp: 'zero',
    tuningMarks: [],
    rubyAmmo,
  };
}

test('null Ruby ammunition remains absent for cold cycle presets', () => {
  const state = materializeFormalInitialState(preset(null), sourceConfig);
  assert.deepEqual(state.specialResources, []);
});

test('explicit zero and twelve Ruby ammunition remain distinct admitted values', () => {
  const zero = materializeFormalInitialState(preset(0), sourceConfig);
  const twelve = materializeFormalInitialState(preset(12), sourceConfig);
  assert.equal(zero.specialResources[0].currentValue, 0);
  assert.equal(twelve.specialResources[0].currentValue, 12);
});

test('invalid Ruby ammunition fails closed', () => {
  assert.throws(
    () => materializeFormalInitialState(preset(13), sourceConfig),
    /integer from 0 to 12/
  );
});

test('max SP binds only actors present in the source config', () => {
  const state = materializeFormalInitialState(
    { ...preset(12), actorSp: 'max', kiboSp: 'max' },
    sourceConfig
  );
  assert.deepEqual(state.actorSpByOptimizationObjectId, {
    '103002': 100,
    '109001': 100,
    '112001': 100,
  });
  assert.deepEqual(state.kiboSpByOptimizationObjectId, {
    '103002': 100,
    '109001': 100,
    '112001': 100,
  });
});
