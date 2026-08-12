import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FORMAL_SEARCH_ADMISSION_CHECK_IDS,
  validateFormalSearchAdmissionRecord,
} from '../../../../scripts/gates/formal-search-admission.mjs';

function createReadyAdmission() {
  return {
    status: 'ready',
    ready: true,
    blockers: [],
    checks: FORMAL_SEARCH_ADMISSION_CHECK_IDS.map(id => ({
      id,
      passed: true,
    })),
    clientParity: {
      ready: false,
      status: 'pending',
    },
  };
}

test('current authoritative admission record passes without a duplicated count', () => {
  assert.ok(
    FORMAL_SEARCH_ADMISSION_CHECK_IDS.includes('normal-attack-combo-authority')
  );
  const admission = createReadyAdmission();
  const validation = validateFormalSearchAdmissionRecord(admission);

  assert.equal(validation.valid, true);
  assert.deepEqual(validation.issues, []);
  assert.deepEqual(
    validation.actualCheckIds,
    FORMAL_SEARCH_ADMISSION_CHECK_IDS
  );
});

test('stale admission record without normal-attack authority fails closed', () => {
  const admission = createReadyAdmission();
  admission.checks = admission.checks.filter(
    check => check.id !== 'normal-attack-combo-authority'
  );

  const validation = validateFormalSearchAdmissionRecord(admission);

  assert.equal(validation.valid, false);
  assert.ok(
    validation.issues.includes(
      'formal-search-admission-check-authority-mismatch'
    )
  );
});

test('same-size forged or unpassed admission records fail closed', () => {
  const forged = createReadyAdmission();
  forged.checks[0] = { id: 'forged-release-authority', passed: true };
  assert.equal(validateFormalSearchAdmissionRecord(forged).valid, false);

  const unpassed = createReadyAdmission();
  unpassed.checks[0].passed = false;
  assert.equal(validateFormalSearchAdmissionRecord(unpassed).valid, false);
});
