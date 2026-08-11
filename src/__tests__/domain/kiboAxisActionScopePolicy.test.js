import { describe, expect, it } from 'vitest';
import {
  KIBO_AXIS_ACTION_SCOPE_POLICY_HASH,
  classifyKiboAxisActionKind,
  createKiboAxisActionScopeBinding,
  getKiboAxisActionScopePolicy,
  isKiboAutonomousActionKindDeferred,
  isKiboAxisActionKindIncluded,
  validateKiboAxisActionScopePolicy,
} from '../../domain/kiboAxisActionScopePolicy';

describe('Kibo axis action scope policy', () => {
  it('retains signature, joint attack, and passive while deferring autonomous actions', () => {
    const policy = getKiboAxisActionScopePolicy();

    expect(validateKiboAxisActionScopePolicy(policy)).toEqual({
      valid: true,
      issues: [],
    });
    expect(policy).toMatchObject({
      policyId: 'm12c-kibo-axis-action-scope-v1',
      policyHash: KIBO_AXIS_ACTION_SCOPE_POLICY_HASH,
      includedAxisActionKinds: ['signature', 'break'],
      deferredAutonomousActionKinds: ['normal-attack', 'active'],
      retainedCalculationSurfaces: ['signature', 'joint-attack', 'passive'],
      deferredCalculationStatus: 'not-generated-not-scheduled-not-scored',
    });
    expect(createKiboAxisActionScopeBinding()).toEqual({
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      policyHash: policy.policyHash,
    });
  });

  it('classifies every supported catalog kind without treating evidence as execution', () => {
    for (const kind of ['signature', 'break']) {
      expect(isKiboAxisActionKindIncluded(kind)).toBe(true);
      expect(classifyKiboAxisActionKind(kind)).toMatchObject({
        disposition: 'axis-and-optimization-included',
        calculationStatus: 'calculated',
      });
    }
    for (const kind of ['normal-attack', 'active']) {
      expect(isKiboAutonomousActionKindDeferred(kind)).toBe(true);
      expect(classifyKiboAxisActionKind(kind)).toMatchObject({
        disposition: 'product-deferred-autonomous-action',
        calculationStatus: 'not-generated-not-scheduled-not-scored',
      });
    }
  });

  it('fails closed when the versioned policy drifts', () => {
    const drifted = structuredClone(getKiboAxisActionScopePolicy());
    drifted.includedAxisActionKinds.push('active');
    drifted.passiveCalculationStatus = 'disabled';
    expect(validateKiboAxisActionScopePolicy(drifted)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        'kibo-axis-action-scope-included-kinds-invalid',
        'kibo-axis-action-scope-passive-status-invalid',
        'kibo-axis-action-scope-policy-hash-invalid',
      ]),
    });
  });
});
