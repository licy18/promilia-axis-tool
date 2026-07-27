import { describe, expect, it } from 'vitest';
import goldenTrace from '../../../reports/m10/103002/golden-trace.json';
import reachableGraph from '../../../reports/m10/103002/reachable-graph.json';
import runtimeCapturePlan from '../../../reports/m10/103002/runtime-capture-plan.json';
import runtimeCoverage from '../../../reports/m10/103002/runtime-coverage.json';
import sourceManifest from '../../../reports/m10/103002/source-manifest.json';
import unresolvedLedger from '../../../reports/m10/103002/unresolved-ledger.json';
import { validateCharacterCombatGoldenRuntime } from '../../../scripts/character-combat/character-combat-golden-validation.mjs';
import catalog from '../../data/generated/character-combat-profile-catalog.json';
import ownerContract from '../../data/generated/character-combat-owner-contracts/103002.json';
import profile from '../../data/generated/character-combat-profiles/103002.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';

const RUBY_ID = 103002;
const RUBY_RESOURCE_IDENTITY = 'actor:103002:element:103002047';

describe('M10-B1 Ruby character combat profile', () => {
  it('publishes the honest public-action and reachable-control denominator', () => {
    expect(profile).toMatchObject({
      owner: {
        ownerId: RUBY_ID,
        ownerName: '红宝石',
      },
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
      completionState: 'runtime-applied',
      denominator: {
        publicActionCount: 10,
        reachableControlCount: 28,
        executionFormCount: 24,
        hitCount: 212,
        semanticEffectCount: 67,
        excludedControlCount: 6,
      },
      validation: {
        status: 'character-combat-profile-valid',
        issues: [],
      },
    });
    expect(
      catalog.profiles.find(item => Number(item.ownerId) === RUBY_ID)
    ).toMatchObject({
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
      runtimeContractHash: profile.runtimeCompilation.contractHash,
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
    });
    expect(profile.runtimeCompilation.sourceCompilation.ownerContractHash).toBe(
      ownerContract.contractHash
    );
    expect(ownerContract.contracts.publicActions).toHaveLength(10);
    expect(
      ownerContract.contracts.publicActions.filter(action => action.runtimeReady)
    ).toHaveLength(8);
    expect(
      ownerContract.contracts.publicActions
        .filter(action => !action.runtimeReady)
        .map(action => action.actionKind)
        .sort()
    ).toEqual(['perfect-parry', 'star-skill']);
    expect(ownerContract.contracts.actionForms).toHaveLength(24);
    expect(
      ownerContract.contracts.actionForms.filter(form => form.applied)
    ).toHaveLength(22);
    expect(
      ownerContract.contracts.actionForms
        .filter(form => !form.applied)
        .map(form => form.publicActionKind)
        .sort()
    ).toEqual(['perfect-parry', 'star-skill']);
    expect(runtimeCoverage.summary).toMatchObject({
      actionCount: 10,
      runtimeReadyActionCount: 8,
      executionFormCount: 24,
      controlCount: 28,
      hitCount: 212,
      resourceProfileCount: 1,
      resourceTransactionCount: 41,
      passiveCount: 1,
      switchTriggerCount: 1,
    });
    expect(sourceManifest.ownerId).toBe(RUBY_ID);
    expect(sourceManifest.summary.identityCount).toBeGreaterThan(1000);
    expect(reachableGraph.summary).toMatchObject({
      controlCount: 28,
      exclusionCount: 6,
      nodeKindCounts: {
        'public-action': 10,
        'action-form': 24,
        hit: 212,
        'personal-resource': 1,
        'passive-listener': 1,
        'switch-trigger': 1,
      },
    });
  });

  it('compiles the 12-shot resource and both automatic attack chains', () => {
    expect(ownerContract.contracts.resourceProfiles).toEqual([
      expect.objectContaining({
        ownerId: RUBY_ID,
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        elementId: 103002047,
        name: '子弹',
        capacity: 12,
        initialValue: 0,
        status: 'verified-special-resource-profile-ready',
        applied: true,
      }),
    ]);
    expect(
      countBy(ownerContract.contracts.resourceTransactions, transaction =>
        transaction.applied
          ? 'applied'
          : transaction.status === 'not-applicable'
            ? 'not-applicable'
            : 'unresolved'
      )
    ).toEqual({
      applied: 20,
      'not-applicable': 20,
      unresolved: 1,
    });

    const empty = ownerContract.contracts.attackInputChains.find(
      chain => chain.chainIdentity === 'ruby-normal-default-three-inputs'
    );
    const loaded = ownerContract.contracts.attackInputChains.find(
      chain => chain.chainIdentity === 'ruby-enhanced-twelve-inputs'
    );
    expect(empty).toMatchObject({
      stateCondition: {
        kind: 'resource-below',
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        value: 1,
      },
    });
    expect(
      empty.segments.map(segment => [
        segment.controlSkillId,
        segment.subSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [10300201, 0, 15],
      [10300202, 0, 23],
      [10300203, 0, 34],
    ]);
    expect(loaded).toMatchObject({
      stateCondition: {
        kind: 'resource-at-least',
        resourceIdentity: RUBY_RESOURCE_IDENTITY,
        value: 1,
      },
    });
    expect(
      loaded.segments.map(segment => [
        segment.controlSkillId,
        segment.subSkillIndex,
        segment.durationFrames,
      ])
    ).toEqual([
      [10300201, 1, 24],
      [10300201, 2, 24],
      [10300201, 3, 32],
      [10300202, 1, 24],
      [10300202, 2, 24],
      [10300202, 3, 32],
      [10300203, 1, 18],
      [10300203, 2, 18],
      [10300203, 3, 28],
      [10300204, 0, 18],
      [10300204, 1, 37],
      [10300204, 2, 57],
    ]);
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.controlSkillId === 10300210 &&
          transaction.subSkillIndex === 0 &&
          transaction.operation === 'gain'
      )
    ).toMatchObject({
      triggerFrame: 24,
      amountByLevel: { 1: 6 },
      applied: true,
    });
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.controlSkillId === 10300213 &&
          transaction.operation === 'gain' &&
          transaction.applied
      )
    ).toMatchObject({
      triggerFrame: 113,
      amountByLevel: { 1: 12 },
      applied: true,
    });
    expect(
      ownerContract.contracts.resourceTransactions.find(
        transaction =>
          transaction.controlSkillId === 10300212 &&
          transaction.operation === 'gain' &&
          transaction.status === 'unresolved-special-resource-operation'
      )
    ).toMatchObject({
      status: 'unresolved-special-resource-operation',
      applied: false,
      reasons: expect.arrayContaining([
        'effect-trigger-frame-static-evidence-gap',
      ]),
    });
  });

  it('applies the verified passive branch and keeps the remaining gaps explicit', () => {
    expect(ownerContract.contracts.passives).toEqual([
      expect.objectContaining({
        passiveIdentity: 'actor:103002:passive:10300261',
        skillId: 10300261,
        name: '以心燃焰',
        durationMs: 15000,
        maxStacks: 6,
        runtimeGenerationMode: 'semantic-effect-catalog',
        status: 'verified-semantic-passive-effect-profile-ready',
        applied: true,
        triggerBindings: expect.arrayContaining([
          expect.objectContaining({
            controlSkillId: 10300201,
            subSkillIndex: 1,
            triggerFrame: 0,
            applied: true,
          }),
        ]),
        modifiers: [
          expect.objectContaining({
            attributeId: 229,
            bucket: 'dynamicExtra',
            valueRaw: 20,
          }),
        ],
      }),
    ]);
    expect(ownerContract.contracts.passives[0].triggerBindings).toHaveLength(14);
    expect(
      unresolvedLedger.records.some(
        record =>
          record.sourceKind === 'passive-trigger' &&
          record.reasons.includes(
            'passive-listener-closure-static-evidence-gap'
          )
      )
    ).toBe(true);
    expect(unresolvedLedger.summary).toMatchObject({
      semanticRecordCount: 438,
      rawRecordCount: 609,
      semanticStatusCounts: {
        'not-applicable': 20,
        'runtime-evidence-required': 5,
        'static-evidence-gap': 413,
      },
      impactClassificationCounts: {
        'gameplay-impacting': 271,
        'not-applicable': 20,
        'wrapper-or-duplicate': 147,
      },
    });
    expect(runtimeCapturePlan).toMatchObject({
      ownerId: RUBY_ID,
      status: 'runtime-evidence-required',
      summary: { captureCount: 5 },
    });
  });

  it('replays the authoritative 120-second combat trace and rejects tampering', () => {
    expect(goldenTrace).toMatchObject({
      kind: 'azpr-character-combat-authoritative-golden-runtime',
      status: 'authoritative-golden-runtime-verified',
      ownerId: RUBY_ID,
      durationMs: 120000,
      compilerPath: 'src/simulation/compiler/compileProject.js',
      simulatorPath: 'src/simulation/engine/simulateScenario.js',
      validation: {
        status: 'authoritative-golden-runtime-expectation-passed',
        passed: true,
        assertionCount: 102,
        failedCount: 0,
      },
    });
    expect(goldenTrace.actual).toMatchObject({
      project: {
        durationMs: 120000,
        actionCount: 15,
        teamCharacterIds: [103002, 101010, 101003],
      },
      actions: {
        blockedActionIds: ['ruby-insufficient-shot'],
      },
      combat: {
        ownerDamageEventCount: 96,
        ownerHitEventCount: 96,
        ownerTotalHpDamage: 8156,
        ownerTotalToughnessDamage: 5582,
        enemy: {
          initialHp: 862800,
          finalHp: 851035,
        },
      },
      effects: {
        passiveMaxStacks: 6,
        firstPassiveMaxStackFrame: 430,
      },
      comparison: {
        primaryDamage: 441,
        baselineDamage: 189,
        damageDelta: 252,
      },
    });
    expect(
      goldenTrace.actual.resources.specialResourceTrace.map(event => [
        event.actionId,
        event.frame,
        event.beforeValue,
        event.change,
        event.afterValue,
      ])
    ).toEqual(
      expect.arrayContaining([
        ['ruby-reload', 24, 0, 6, 6],
        ['ruby-enhanced-shot-1', 200, 6, -1, 5],
        ['ruby-enhanced-shot-6', 1350, 1, -1, 0],
        ['ruby-ultimate', 2313, 0, 12, 12],
        ['ruby-post-ultimate-shot', 2720, 12, -1, 11],
        ['ruby-limit-counter', 3015, 11, 1, 12],
      ])
    );
    expect(
      goldenTrace.actual.resources.actorSpByActorId['actor-103002']
    ).toMatchObject({
      initialValue: 100,
      currentValue: 17.469559,
      autoRecovery: [
        {
          reason: 'verified-auto-sp-background',
          totalChange: 0.5203,
        },
        {
          reason: 'verified-auto-sp-foreground',
          totalChange: 16.329152,
        },
      ],
    });
    expect(
      goldenTrace.actual.resources.kiboSpBySlotId['team-slot-1']
    ).toMatchObject({
      kiboId: 500039,
      initialValue: 100,
      currentValue: 13.559189,
    });
    expect(goldenTrace.actual.dynamicProperties.ownerSources[0]).toMatchObject({
      attributeId: 229,
      dynamicExtraRaw: 120,
    });
    expect(goldenTrace.replayHash).toMatch(/^[a-f0-9]{64}$/);

    const expected = structuredClone(goldenTrace.expected);
    expected.exact['resources.specialResourceTrace.0.afterValue'] = 7;
    const validation = validateCharacterCombatGoldenRuntime({
      actual: goldenTrace.actual,
      expected,
    });
    expect(validation).toMatchObject({
      passed: false,
      failedCount: 1,
    });
    expect(validation.assertions.find(assertion => !assertion.passed)).toMatchObject(
      {
        jsonPath: 'resources.specialResourceTrace.0.afterValue',
        expected: 7,
        actual: 6,
      }
    );
  });

  it('publishes the same owner contract through the verified mechanics package', () => {
    const metadata = mechanicsPackage.characterCombatProfileCatalog.profiles.find(
      item => Number(item.ownerId) === RUBY_ID
    );
    expect(metadata).toMatchObject({
      profileIdentity: profile.profileIdentity,
      profileHash: profile.profileHash,
      runtimeContractHash: profile.runtimeCompilation.contractHash,
      pipelineMaturity: 'runtime-applied',
      combatCoverageState: 'partial',
      characterComplete: false,
    });
    expect(
      mechanicsPackage.actionMappings.filter(
        mapping =>
          mapping.ownerKind === 'actor' && Number(mapping.ownerId) === RUBY_ID
      )
    ).toHaveLength(10);
    expect(
      mechanicsPackage.specialResourceCatalog.profiles.find(
        resource => resource.resourceIdentity === RUBY_RESOURCE_IDENTITY
      )
    ).toMatchObject({
      capacity: 12,
      applied: true,
    });
  });
});

function countBy(values, selector) {
  return values.reduce((counts, value) => {
    const key = selector(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
