import { describe, expect, it } from 'vitest';
import { validateRightOpenLifecycleMatches } from '../../../scripts/character-acceptance/effect-lifecycle-acceptance.mjs';

describe('character acceptance right-open lifecycle evidence', () => {
  it('requires every declared expiry interval to satisfy the boundary', () => {
    expect(
      validateRightOpenLifecycleMatches([{ passed: true }, { passed: true }], {
        required: true,
      })
    ).toBe(true);
    expect(
      validateRightOpenLifecycleMatches([{ passed: true }, { passed: false }], {
        required: true,
      })
    ).toBe(false);
  });

  it('fails closed when required evidence is empty and stays inert otherwise', () => {
    expect(validateRightOpenLifecycleMatches([], { required: true })).toBe(
      false
    );
    expect(validateRightOpenLifecycleMatches([], { required: false })).toBe(
      true
    );
  });
});
