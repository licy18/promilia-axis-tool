import {
  calculateVerifiedJointAttackThreshold,
  createVerifiedJointAttackRuntimeBinding,
  evaluateVerifiedJointAttackRuntimeEligibility,
  getVerifiedJointAttackRuntimeContract,
  validateVerifiedJointAttackRuntimeBinding,
} from '../../domain/verifiedJointAttackRuntimeContract';

describe('verified joint attack runtime product assumption', () => {
  it('binds the versioned product fallback without claiming client parity', () => {
    const contract = getVerifiedJointAttackRuntimeContract();
    const binding = createVerifiedJointAttackRuntimeBinding();

    expect(contract).toMatchObject({
      schemaVersion: 1,
      contractName: 'AzPrVerifiedJointAttackRuntimeAssumption',
      contractId: 'm12-joint-attack-runtime-v1',
      formalReady: true,
      clientParityReady: false,
      semantics: {
        thresholdBoundary: 'current-weakness-point-strictly-less-than-threshold',
        attachedToughnessAnchor:
          'first-source-ordered-verified-kibo-joint-strike-landed-hit-derived-from-mapping-and-hit-identity',
        jointDamageBreakState:
          'pair-hp-packets-at-kibo-anchor-frame-settle-before-attached-clear-then-later-packets-read-canonical-state',
        attachedToughnessEffect:
          'after-anchor-frame-pair-hp-packets-clear-current-toughness-once',
      },
      thresholdInputs: {
        enemyWpBreakToughBasisPoints: 10000,
        sourceStatus: 'verified-current-client-catalog-invariant',
      },
    });
    expect(validateVerifiedJointAttackRuntimeBinding(binding)).toMatchObject({
      valid: true,
      issues: [],
    });
    expect(binding.contractHash).toBe(contract.contractHash);
    expect(binding.bindingHash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('fail-closes missing, stale, semantically changed, and re-signed bindings', () => {
    expect(validateVerifiedJointAttackRuntimeBinding(null).valid).toBe(false);

    const binding = createVerifiedJointAttackRuntimeBinding();
    expect(
      validateVerifiedJointAttackRuntimeBinding({
        ...binding,
        contractId: 'm12-joint-attack-runtime-v0',
      }).valid
    ).toBe(false);
    expect(
      validateVerifiedJointAttackRuntimeBinding({
        ...binding,
        thresholdInputs: {
          ...binding.thresholdInputs,
          enemyWpBreakToughBasisPoints: 9999,
        },
      }).valid
    ).toBe(false);
    expect(
      validateVerifiedJointAttackRuntimeBinding({
        ...binding,
        semantics: {
          ...binding.semantics,
          thresholdBoundary: 'less-than-or-equal',
        },
        contractHash: binding.contractHash,
        bindingHash: binding.bindingHash,
      }).valid
    ).toBe(false);
    expect(
      validateVerifiedJointAttackRuntimeBinding({
        ...binding,
        runtimeInputs: {
          ...binding.runtimeInputs,
          forgedGate: true,
        },
      }).valid
    ).toBe(false);
  });

  it('uses authoritative basis-point inputs and the strict threshold edge', () => {
    const threshold = calculateVerifiedJointAttackThreshold({
      maxWeaknessPoint: 1000,
      enemyWpBreakToughBasisPoints: 10000,
      kiboWpBreakPercentBasisPoints: 3000,
    });
    expect(threshold).toBe(300);

    const binding = createVerifiedJointAttackRuntimeBinding();
    const common = {
      binding,
      enemy: {
        hp: 1000,
        toughness: 300,
        maxToughness: 1000,
        inBreak: false,
        targetPolicy: { toughnessMode: 'enabled', breakMode: 'enabled' },
      },
      enemyWpBreakToughBasisPoints: 10000,
      kiboWpBreakPercentBasisPoints: 3000,
      actorAlive: true,
      kiboAlive: true,
      actorId: 'actor-a',
      controlledActorId: 'actor-a',
      targetId: 'enemy-a',
      expectedTargetId: 'enemy-a',
    };
    expect(evaluateVerifiedJointAttackRuntimeEligibility(common)).toMatchObject({
      eligible: false,
      code: 'joint-attack-threshold-not-reached',
      threshold: 300,
    });
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        enemy: { ...common.enemy, toughness: 299 },
      })
    ).toMatchObject({ eligible: true, threshold: 300 });
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        enemyWpBreakToughBasisPoints: 9999,
      })
    ).toMatchObject({
      eligible: false,
      code: 'joint-attack-enemy-threshold-source-mismatch',
    });
  });

  it('applies only the two documented unknown-gate fallbacks and respects explicit negatives', () => {
    const common = {
      enemy: {
        hp: 1000,
        toughness: 1,
        maxToughness: 1000,
        inBreak: false,
        targetPolicy: { toughnessMode: 'enabled', breakMode: 'enabled' },
      },
      enemyWpBreakToughBasisPoints: 10000,
      kiboWpBreakPercentBasisPoints: 3000,
      actorAlive: true,
      kiboAlive: true,
      actorId: 'actor-a',
      controlledActorId: 'actor-a',
      targetId: 'enemy-a',
      expectedTargetId: 'enemy-a',
    };
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        binding: createVerifiedJointAttackRuntimeBinding(),
      }).eligible
    ).toBe(true);
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        binding: createVerifiedJointAttackRuntimeBinding({
          cannotBeJointStrike: true,
        }),
      })
    ).toMatchObject({
      eligible: false,
      code: 'joint-attack-service-excluded',
    });
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        binding: createVerifiedJointAttackRuntimeBinding({
          controlledEntityGate: false,
        }),
      })
    ).toMatchObject({
      eligible: false,
      code: 'joint-attack-controlled-entity-gate-closed',
    });
  });

  it.each([
    [
      'a target without a breakable toughness slot',
      {
        enemy: {
          targetPolicy: { toughnessMode: 'disabled', breakMode: 'disabled' },
        },
      },
      'joint-attack-breakable-toughness-required',
    ],
    [
      'a dead target',
      { enemy: { hp: 0 } },
      'joint-attack-target-dead',
    ],
    [
      'an already broken target',
      { enemy: { inBreak: true } },
      'joint-attack-target-already-broken',
    ],
    [
      'rage',
      { runtimeInputs: { enemyRage: true } },
      'joint-attack-target-rage-active',
    ],
    [
      'distance failure',
      { runtimeInputs: { distanceEligible: false } },
      'joint-attack-distance-gate-failed',
    ],
    [
      'height failure',
      { runtimeInputs: { heightEligible: false } },
      'joint-attack-height-gate-failed',
    ],
    [
      'connectivity failure',
      { runtimeInputs: { connectivityEligible: false } },
      'joint-attack-connectivity-gate-failed',
    ],
    [
      'an actor FSM conflict',
      { runtimeInputs: { actorConflict: true } },
      'joint-attack-fsm-conflict',
    ],
    [
      'a Kibo FSM conflict',
      { runtimeInputs: { kiboConflict: true } },
      'joint-attack-fsm-conflict',
    ],
    [
      'a dead actor',
      { actorAlive: false },
      'joint-attack-actor-not-alive',
    ],
    [
      'a dead Kibo',
      { kiboAlive: false },
      'joint-attack-kibo-not-alive',
    ],
    [
      'a background actor',
      { controlledActorId: 'actor-b' },
      'joint-attack-actor-not-controlled',
    ],
    [
      'a different target',
      { expectedTargetId: 'enemy-b' },
      'joint-attack-target-mismatch',
    ],
  ])('rejects %s before pair admission', (_label, override, code) => {
    const common = createEligibleRuntimeInput();
    const enemy = {
      ...common.enemy,
      ...(override.enemy ?? {}),
      targetPolicy: {
        ...common.enemy.targetPolicy,
        ...(override.enemy?.targetPolicy ?? {}),
      },
    };
    const binding = createVerifiedJointAttackRuntimeBinding(
      override.runtimeInputs ?? {}
    );
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        ...override,
        enemy,
        binding,
      })
    ).toMatchObject({ eligible: false, code });
  });

  it('allows forceBreak but fail-closes zero, missing, and illegal Kibo threshold inputs', () => {
    const common = createEligibleRuntimeInput();
    expect(
      evaluateVerifiedJointAttackRuntimeEligibility({
        ...common,
        enemy: { ...common.enemy, toughness: common.enemy.maxToughness },
        binding: createVerifiedJointAttackRuntimeBinding({ forceBreak: true }),
      })
    ).toMatchObject({ eligible: true, forceBreak: true });

    for (const kiboWpBreakPercentBasisPoints of [null, 0, -1, NaN]) {
      expect(
        evaluateVerifiedJointAttackRuntimeEligibility({
          ...common,
          kiboWpBreakPercentBasisPoints,
          binding: createVerifiedJointAttackRuntimeBinding(),
        })
      ).toMatchObject({
        eligible: false,
        code: 'joint-attack-threshold-inputs-unresolved',
      });
    }
  });
});

function createEligibleRuntimeInput() {
  return {
    binding: createVerifiedJointAttackRuntimeBinding(),
    enemy: {
      hp: 1000,
      toughness: 1,
      maxToughness: 1000,
      inBreak: false,
      targetPolicy: { toughnessMode: 'enabled', breakMode: 'enabled' },
    },
    enemyWpBreakToughBasisPoints: 10000,
    kiboWpBreakPercentBasisPoints: 3000,
    actorAlive: true,
    kiboAlive: true,
    actorId: 'actor-a',
    controlledActorId: 'actor-a',
    targetId: 'enemy-a',
    expectedTargetId: 'enemy-a',
  };
}
