import { describe, expect, it } from 'vitest';
import { unresolvedRecordPolicyMatches } from '../../../scripts/character-combat/character-combat-profile-pipeline.mjs';

describe('character combat unresolved-record source matching', () => {
  const policy = {
    policyIdentity: 'synthetic-element-path-policy',
    sourceIdentity: 'fixture:synthetic-policy',
    reasonIncludes: ['unresolved'],
    elementPathIds: ['3663436943335475859'],
    controlVariants: [{ controlSkillId: 10300201, subSkillIndex: 1 }],
  };

  it('matches the declared element path inside the same control variant', () => {
    expect(
      unresolvedRecordPolicyMatches(policy, {
        recordIdentity:
          'effect:10300201|1|elements|0|3663436943335475859|element:3663436943335475859|0|0',
        reasons: ['unresolved'],
      })
    ).toBe(true);
  });

  it('does not leak across sibling element paths or control variants', () => {
    expect(
      unresolvedRecordPolicyMatches(policy, {
        recordIdentity:
          'effect:10300201|1|elements|0|6226025878936021619|element:6226025878936021619|0|0',
        reasons: ['unresolved'],
      })
    ).toBe(false);
    expect(
      unresolvedRecordPolicyMatches(policy, {
        recordIdentity:
          'effect:10300201|2|elements|0|3663436943335475859|element:3663436943335475859|0|0',
        reasons: ['unresolved'],
      })
    ).toBe(false);
  });

  it('reads battle-effect paths from raw identities while preserving source gates', () => {
    const gatedPolicy = {
      ...policy,
      sourceKinds: ['effect'],
      statuses: ['gap'],
    };
    const record = {
      recordIdentity:
        'effect:10300201|1|elements|0|unresolved-container|element:0|0|0',
      rawRecordIdentities: [
        'battle-effect:10300201:1:3663436943335475859:99:0',
      ],
      sourceKind: 'effect',
      status: 'gap',
      reasons: ['unresolved'],
    };

    expect(unresolvedRecordPolicyMatches(gatedPolicy, record)).toBe(true);
    expect(
      unresolvedRecordPolicyMatches(gatedPolicy, {
        ...record,
        sourceKind: 'hit',
      })
    ).toBe(false);
    expect(
      unresolvedRecordPolicyMatches(gatedPolicy, {
        ...record,
        status: 'applied',
      })
    ).toBe(false);
  });
});
