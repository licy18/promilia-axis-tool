import { describe, expect, it } from 'vitest';
import {
  ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME,
  ACTION_COOLDOWN_EVALUATION_CONTRACT_NAME,
  createActionCooldownEvaluation,
} from '../../simulation/runtime/actionCooldownEvaluation';

describe('action cooldown evaluation contract', () => {
  it('keeps source cooldown as base and effective values without an adapter', () => {
    const evaluation = createActionCooldownEvaluation({
      action: { id: 'skill-1', skillId: 1001, startMs: 6000 },
      ownerKind: 'actor',
      ownerId: 'actor-1',
      baseCooldown: createBaseCooldown(20000),
    });

    expect(evaluation).toMatchObject({
      contractName: ACTION_COOLDOWN_EVALUATION_CONTRACT_NAME,
      status: 'cooldown-evaluation-base-only',
      actionId: 'skill-1',
      ownerKind: 'actor',
      ownerId: 'actor-1',
      evaluatedAtMs: 6000,
      base: { durationMs: 20000, chargeCount: 1 },
      effective: { durationMs: 20000, chargeCount: 1 },
      modifiers: [],
      appliedModifierCount: 0,
      adapterIdentity: null,
    });
  });

  it('lets a synchronous adapter resolve effective cooldown without prescribing modifier math', () => {
    let request = null;
    const evaluation = createActionCooldownEvaluation({
      action: { id: 'kibo-1', skillId: 50000302, startMs: 12000 },
      ownerKind: 'kibo',
      ownerId: 500003,
      baseCooldown: createBaseCooldown(24000),
      scenario: { id: 'scenario-1' },
      priorCooldownWindows: [{ actionId: 'earlier-action' }],
      adapter: {
        contractName: ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME,
        contractVersion: 1,
        adapterId: 'test-cooldown-adapter',
        evaluate(value) {
          request = value;
          return {
            effectiveDurationMs: 12000,
            effectiveChargeCount: 2,
            modifiers: [
              {
                sourceKind: 'test-only-buff',
                sourceId: 'buff-1',
              },
            ],
            sourceStatus: 'test-only-adapter-result',
          };
        },
      },
    });

    expect(request).toMatchObject({
      contractName: ACTION_COOLDOWN_EVALUATION_ADAPTER_CONTRACT_NAME,
      actionId: 'kibo-1',
      owner: { kind: 'kibo', id: 500003 },
      baseCooldown: { durationMs: 24000, chargeCount: 1 },
      context: {
        scenario: { id: 'scenario-1' },
        processedActionIds: ['earlier-action'],
        runtimeEffectState: null,
        runtimeEffectStateStatus: 'not-bound-currently',
      },
    });
    expect(evaluation).toMatchObject({
      status: 'cooldown-evaluation-adapted',
      base: { durationMs: 24000, chargeCount: 1 },
      effective: { durationMs: 12000, chargeCount: 2 },
      modifiers: [
        {
          sourceKind: 'test-only-buff',
          sourceId: 'buff-1',
        },
      ],
      appliedModifierCount: 1,
      adapterIdentity: {
        adapterId: 'test-cooldown-adapter',
        sourceStatus: 'test-only-adapter-result',
      },
    });
  });

  it('falls back to base cooldown when a future adapter fails', () => {
    const evaluation = createActionCooldownEvaluation({
      action: { id: 'skill-1', skillId: 1001, startMs: 0 },
      ownerKind: 'actor',
      ownerId: 'actor-1',
      baseCooldown: createBaseCooldown(20000),
      adapter() {
        throw new Error('test adapter failure');
      },
    });

    expect(evaluation).toMatchObject({
      status: 'cooldown-evaluation-adapter-fallback',
      base: { durationMs: 20000 },
      effective: { durationMs: 20000 },
      adapterFallbackReason: 'adapter-threw',
    });
  });
});

function createBaseCooldown(cooldownMs) {
  return {
    cooldownMs,
    cooldownCount: 1,
    source: { sourceKind: 'test-source' },
    sourceIdentity: { sourceKind: 'test-source', subSkillId: 1001 },
    confidence: 'confirmed-structured-data',
  };
}
