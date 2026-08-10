import { describe, expect, it } from 'vitest';
import soulEssenceEffectCatalog from '../../data/generated/soulessence-effect-mechanics.json';
import {
  OPTIMIZATION_ROSTER_EXCLUSION_REASON,
  OPTIMIZATION_SCENARIO_POLICY_REASON,
  classifyOptimizationCandidateCharacter,
  classifyOptimizationScenarioActionKind,
  createOptimizationObjectivePolicyBinding,
  createOptimizationScenarioPolicyBinding,
  getOptimizationCandidateRosterPolicy,
  getOptimizationObjectiveContract,
  getOptimizationObjectivePolicy,
  getOptimizationScenarioPolicy,
  validateOptimizationObjectivePolicyBinding,
  validateOptimizationScenarioPolicy,
  validateOptimizationScenarioPolicyBinding,
} from '../../optimization-scenario/optimizationScenarioPolicy.js';
import {
  createOptimizationQualificationIssuesForContract,
  getOptimizationQualificationCatalog,
} from '../../optimization-qualification/optimizationQualificationProtocol.js';
import { createOptimizationScenarioPolicy as createOptimizationScenarioPolicyFromSource } from '../../../scripts/optimization-scenario/optimization-scenario-policy-source.mjs';

describe('frozen M12-C optimization scenario policy', () => {
  it('binds the zero-distance passive-boss assumptions and nine-object roster', () => {
    const policy = getOptimizationScenarioPolicy();
    const roster = getOptimizationCandidateRosterPolicy();

    expect(validateOptimizationScenarioPolicy(policy)).toEqual({
      valid: true,
      issues: [],
    });
    expect(
      validateOptimizationScenarioPolicyBinding(
        createOptimizationScenarioPolicyBinding()
      ).valid
    ).toBe(true);
    expect(policy.assumptions).toMatchObject({
      actorTargetInitialDistance: 0,
      actorTargetDistanceMode: 'fixed-zero',
      projectileImpactPolicy: 'zero-distance-immediate-hit',
      enemyActiveAttacks: false,
      enemyReactionStimuli: false,
      targetPolicy: {
        hpMode: 'infinite',
        toughnessMode: 'disabled',
        breakMode: 'disabled',
        deathTruncation: 'disabled',
      },
    });
    expect(getOptimizationObjectivePolicy()).toMatchObject({
      policyId: 'm12-primary-objectives-v1',
      defaultPrimaryObjectiveId: 'cycle-dps-no-toughness',
      primaryObjectiveIds: [
        'cycle-dps-no-toughness',
        'cycle-dps-with-toughness',
        'fastest-kill',
      ],
      legacyDiagnosticObjectiveIds: ['damage', 'burst', 'toughness'],
    });
    expect(
      validateOptimizationObjectivePolicyBinding(
        createOptimizationObjectivePolicyBinding()
      )
    ).toEqual(
      expect.objectContaining({
        valid: true,
        issues: [],
      })
    );
    expect(roster.formalDenominator).toBe(9);
    expect(roster.formalOptimizationObjectIds).toEqual([
      '101010',
      '103002',
      '109001',
      '102001',
      '107001',
      '107002',
      '108003',
      '112001',
      'STARBORN',
    ]);
    expect(
      roster.markProducerCharacters.find(entry => entry.characterId === 107002)
        .productionEvidence
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          controlSkillId: 10700212,
          markId: 750,
          depth: 0,
          startFrame: 90,
        }),
      ])
    );
  });

  it('keeps the approved roster hash when Sifliya source aliases consolidate', () => {
    const policy = createOptimizationScenarioPolicyFromSource();
    const sifliya = policy.candidateRoster.markProducerCharacters.find(
      entry => entry.characterId === 107001
    );

    expect(policy.candidateRoster.rosterHash).toBe('a690b860f0967e3d');
    expect(sifliya.productionEvidence).toHaveLength(10);
    expect(
      sifliya.productionEvidence.map(entry => entry.effectIdentity)
    ).toEqual(
      expect.arrayContaining([
        '10700112|0|elements|5|1474042154774785480|element:1474042154774785480|10|0',
        '10700112|0|elements|5|1474042154774785480|element:1474042154774785480|10|1',
        '10700112|1|elements|5|1474042154774785480|element:1474042154774785480|10|0',
        '10700112|1|elements|5|1474042154774785480|element:1474042154774785480|10|1',
      ])
    );
  });

  it('indexes all objective target policies without changing the passive scenario', () => {
    expect(
      getOptimizationObjectiveContract('cycle-dps-no-toughness')
    ).toMatchObject({
      classification: 'primary',
      formalEligible: true,
      targetPolicy: {
        hpMode: 'infinite',
        toughnessMode: 'disabled',
        breakMode: 'disabled',
        deathTruncation: 'disabled',
      },
    });
    expect(
      getOptimizationObjectiveContract('cycle-dps-with-toughness')
    ).toMatchObject({
      classification: 'primary',
      formalEligible: true,
      targetPolicy: {
        hpMode: 'infinite',
        toughnessMode: 'enabled',
        breakMode: 'enabled',
        deathTruncation: 'disabled',
      },
    });
    expect(getOptimizationObjectiveContract('fastest-kill')).toMatchObject({
      classification: 'primary',
      formalEligible: true,
      targetPolicy: {
        hpMode: 'finite',
        toughnessMode: 'enabled',
        breakMode: 'enabled',
        deathTruncation: 'enabled',
      },
    });
    expect(getOptimizationObjectiveContract('damage')).toMatchObject({
      classification: 'legacy-diagnostic',
      formalEligible: false,
    });
    expect(getOptimizationObjectiveContract('not-an-objective')).toBeNull();

    const policy = getOptimizationScenarioPolicy();
    expect(policy.assumptions).toMatchObject({
      actorTargetInitialDistance: 0,
      actorTargetDistanceMode: 'fixed-zero',
      projectileImpactPolicy: 'zero-distance-immediate-hit',
      enemyBehavior: 'passive-static-target',
      enemyActiveAttacks: false,
      enemyReactionStimuli: false,
    });
    expect(policy.optimizationSurface.excludedActionKinds).toEqual([
      'dodge-attack',
      'limit-counter',
      'perfect-parry',
      'plunging-attack',
    ]);
  });

  it('rejects objective policy binding field renames and nested hash drift', () => {
    const renamed = createOptimizationObjectivePolicyBinding();
    renamed.objectiveHash = renamed.objectivePolicyHash;
    delete renamed.objectivePolicyHash;
    expect(validateOptimizationObjectivePolicyBinding(renamed).valid).toBe(
      false
    );
    expect(
      validateOptimizationObjectivePolicyBinding(renamed).issues.map(
        issue => issue.code
      )
    ).toContain('optimization-objective-policy-binding-shape-invalid');

    const drifted = structuredClone(getOptimizationScenarioPolicy());
    drifted.objectivePolicy.objectivesById.fastestKill =
      drifted.objectivePolicy.objectivesById['fastest-kill'];
    delete drifted.objectivePolicy.objectivesById['fastest-kill'];
    expect(validateOptimizationScenarioPolicy(drifted).valid).toBe(false);
    expect(validateOptimizationScenarioPolicy(drifted).issues).toEqual(
      expect.arrayContaining([
        'optimization-scenario-machine-axis-objective-field-missing',
        'optimization-scenario-machine-axis-objective-additional-property',
      ])
    );
  });

  it('keeps active mark producers and structurally excludes consumption-only characters', () => {
    expect(classifyOptimizationCandidateCharacter(108003).disposition).toBe(
      'formal-optimization-roster-included'
    );
    expect(classifyOptimizationCandidateCharacter(108001)).toMatchObject({
      disposition: 'product-scenario-excluded',
      reason: OPTIMIZATION_ROSTER_EXCLUSION_REASON,
    });
    expect(classifyOptimizationCandidateCharacter(111001)).toMatchObject({
      disposition: 'product-scenario-excluded',
      reason: OPTIMIZATION_ROSTER_EXCLUSION_REASON,
    });
  });

  it('drives the set-three receive-damage N/A from the same frozen policy binding', () => {
    const definition = soulEssenceEffectCatalog.setSkillDefinitions.find(
      entry => entry.setId === 3 && entry.pieces === 4
    );
    const policyBinding = createOptimizationScenarioPolicyBinding();

    expect(definition.runtimeStatus).toBe('runtime-applied');
    expect(definition.scenarioBoundaries).toEqual([
      expect.objectContaining({
        disposition: 'scenario-out-of-scope',
        reason: OPTIMIZATION_SCENARIO_POLICY_REASON,
        bossAttacks: false,
        ...policyBinding,
        eventName: 'AfterReceiveDamage',
        triggerElementId: 199999022,
        propertyElementId: 199999023,
      }),
    ]);
  });

  it('rejects excluded reactive actions and characters before formal search', () => {
    expect(classifyOptimizationScenarioActionKind('perfect-parry')).toEqual(
      expect.objectContaining({
        disposition: 'scenario-out-of-scope',
        reason: OPTIMIZATION_SCENARIO_POLICY_REASON,
      })
    );
    const catalog = getOptimizationQualificationCatalog();
    const issues = createOptimizationQualificationIssuesForContract(
      {
        scenario: {
          team: [{ characterId: 108001 }],
          projectile: { targetDistance: 0, defaultWillHit: true },
          target: getOptimizationScenarioPolicy().assumptions.targetPolicy,
          optimizationScenarioPolicy: createOptimizationScenarioPolicyBinding(),
          optimizationQualification: {
            mode: 'formal',
            catalogHash: catalog.catalogHash,
          },
        },
        actions: [
          {
            id: 'excluded-perfect-parry',
            intent: { kind: 'public-action', actionKind: 'perfect-parry' },
          },
        ],
      },
      { catalog }
    );

    expect(issues.map(issue => issue.code)).toEqual(
      expect.arrayContaining([
        'machine-axis-formal-character-product-scenario-excluded',
        'machine-axis-formal-action-scenario-out-of-scope',
      ])
    );
  });
});
