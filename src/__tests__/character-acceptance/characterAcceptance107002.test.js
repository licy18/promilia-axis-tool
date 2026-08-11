import misaFixture from '../../../fixtures/character-acceptance/107002-visual.json';
import misaCoverage from '../../../reports/m11/character-acceptance/107002/coverage.json';
import misaLedger from '../../../reports/m11/character-acceptance/107002/ledger.json';
import misaManifest from '../../../reports/m11/character-acceptance/107002/manifest.json';
import misaMatrix from '../../../reports/m11/character-acceptance/107002/scenario-matrix.json';
import { createCharacterAcceptanceRequirementSources } from '../../../scripts/character-acceptance/character-acceptance-generation.mjs';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import misaProfile from '../../data/generated/character-combat-profiles/107002.json';
import { validateCharacterAcceptanceManifest } from '../../character-acceptance/characterAcceptanceProtocol';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

const criticalHitIdentity = '10700203|0|elements|2|-1404469563182445209|40|1';

function findCriticalHit(run, suffix) {
  return (run.trace?.damage ?? []).find(
    event =>
      event.actionId === `107002-critical-${suffix}` &&
      event.eventType === 'VERIFIED_COMBAT_HIT' &&
      event.hitIdentity === criticalHitIdentity
  );
}

describe('M12-B3-107002 owner acceptance closure', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(createMisaRuntimePackage());
  });

  it('replays the canonical fixture and Workbench roundtrip without hash drift', () => {
    const service = createMachineAxisService();
    const adapter = createWorkbenchMachineAxisAdapter({ service });
    const validation = service.validate(misaFixture);
    const first = service.simulate(misaFixture);
    const second = service.simulate(misaFixture);
    const imported = adapter.importContract(misaFixture);
    const exported = adapter.exportProject(imported.project, {
      metadata: misaFixture.metadata,
    });
    const roundTrip = service.simulate(exported);

    expect(validation.valid).toBe(true);
    expect(first.hashes).toMatchObject({
      input: '30780d8354ecceaf',
      data: '9167d13d5bd46dc0',
      trace: '9d108c00b14b69ae',
      evaluation: '5238bf8119e66446',
    });
    expect(second.hashes).toEqual(first.hashes);
    expect(roundTrip.hashes).toEqual(first.hashes);
    expect(first.contract.scenario.pickups).toEqual({
      policyId: 'm12c-pickup-owner-source-action-absorb-v1',
      policyVersion: 1,
      policyHash: '2d4b4c4977e689bc',
      autoCollect: false,
      movementPolicy: 'no-implicit-movement',
      collectionPolicy: 'owner-source-action-absorb-only',
      sameFrameSpawnPolicy: 'exclude-same-frame-fail-closed',
      sameFrameExpiryPolicy: 'expire-before-absorb',
    });
    expect(exported.scenario.pickups).toEqual(first.contract.scenario.pickups);

    const directHeals = (first.trace?.events ?? []).filter(
      event => event.type === 'VERIFIED_DIRECT_HEAL'
    );
    const a3AbsorbHeals = directHeals.filter(
      event => event.actionId === 'misa-charged'
    );
    expect(a3AbsorbHeals).toHaveLength(6);
    expect(
      a3AbsorbHeals.map(event => [
        event.absoluteFrame,
        event.actorId,
        event.targetId,
        event.payload.effectIdentity,
      ])
    ).toEqual(
      [
        [2740, 55, 1],
        [2746, 56, 1],
        [2752, 57, 1],
        [2758, 58, 1],
        [2764, 59, 1],
        [2770, 60, 1],
      ].map(([spawnFrame, entitySequence, ordinal]) => [
        3370,
        'actor-107002',
        'actor-107002',
        `pickup-reward:pickup|misa-a3-hp-pickup|misa-a3|${spawnFrame}|0|${entitySequence}|${ordinal}`,
      ])
    );
    expect(directHeals.filter(event => event.actionId === 'misa-a3')).toEqual(
      []
    );

    const missAbsorbActionId = 'misa-charged-ultimate-absorb-miss';
    expect(
      (first.trace?.damage ?? []).filter(
        event =>
          event.actionId === missAbsorbActionId &&
          event.eventType === 'VERIFIED_COMBAT_HIT' &&
          Number(event.hitSkillId) === 10700210
      )
    ).toEqual([]);
    const missAbsorbHeals = directHeals.filter(
      event => event.actionId === missAbsorbActionId
    );
    expect(
      missAbsorbHeals.map(event => [
        event.absoluteFrame,
        event.actorId,
        event.targetId,
        event.payload.effectIdentity,
      ])
    ).toEqual(
      [
        [61, 1],
        [62, 2],
        [63, 3],
      ].map(([entitySequence, ordinal]) => [
        4680,
        'actor-107002',
        'actor-107002',
        `pickup-reward:pickup|misa-ultimate-hp-pickup|misa-ultimate|3835|20|${entitySequence}|${ordinal}`,
      ])
    );
    const missAbsorbSp = (first.trace?.events ?? []).filter(
      event =>
        event.actionId === missAbsorbActionId &&
        event.type === 'VERIFIED_RESOURCE_CHANGE' &&
        ['verified-direct-sp', 'verified-direct-sp-shared'].includes(
          event.payload?.reason
        )
    );
    expect(missAbsorbSp).toHaveLength(21);
    expect(
      Object.fromEntries(
        ['actor-107002', 'actor-101010', 'actor-103002'].map(actorId => [
          actorId,
          missAbsorbSp.filter(event => event.actorId === actorId).length,
        ])
      )
    ).toEqual({
      'actor-107002': 7,
      'actor-101010': 7,
      'actor-103002': 7,
    });
    expect(missAbsorbSp.every(event => event.absoluteFrame === 4680)).toBe(
      true
    );
    expect(missAbsorbSp.every(event => event.payload.change === 1)).toBe(true);
    expect(
      (first.trace?.events ?? []).filter(
        event =>
          ['misa-star', 'misa-star-at-cooldown-boundary'].includes(
            event.actionId
          ) &&
          ['VERIFIED_DIRECT_HEAL', 'VERIFIED_RESOURCE_CHANGE'].includes(
            event.type
          ) &&
          ['verified-direct-sp', 'verified-direct-sp-shared'].includes(
            event.payload?.reason
          )
      )
    ).toEqual([]);
  }, 60_000);

  it('settles every critical mode, integer boundary, miss, and non-crittable event', () => {
    const run = createMachineAxisService().simulate(misaFixture);
    const rateZero = findCriticalHit(run, 'rate-zero');
    const rateOneHundred = findCriticalHit(run, 'rate-one-hundred');
    const sampledLow = findCriticalHit(run, 'sampled-low');
    const sampledBoundary = findCriticalHit(run, 'sampled-boundary');
    const expected = findCriticalHit(run, 'expected');
    const forcedCritical = findCriticalHit(run, 'critical');
    const forcedNonCritical = findCriticalHit(run, 'non-critical');
    const miss = findCriticalHit(run, 'miss-critical');
    const nonCrittable = (run.trace?.damage ?? []).find(
      event =>
        event.actionId === '107002-critical-rate-zero' &&
        event.eventType === 'VERIFIED_TUNING_DAMAGE' &&
        Number(event.elementId) === 552
    );

    expect(rateZero.formula.randomBranch).toMatchObject({
      criticalThreshold: 0,
      criticalRoll: 0,
      critical: false,
    });
    expect(rateOneHundred.formula.randomBranch).toMatchObject({
      criticalThreshold: 10000,
      criticalRoll: 9999,
      critical: true,
    });
    expect(sampledLow.formula.randomBranch).toMatchObject({
      mode: 'captured-critical-roll',
      criticalThreshold: 500,
      criticalRoll: 499,
      critical: true,
    });
    expect(sampledBoundary.formula.randomBranch).toMatchObject({
      mode: 'captured-critical-roll',
      criticalThreshold: 500,
      criticalRoll: 500,
      critical: false,
    });
    expect(expected.formula.verifiedResult.expectedCritical).toMatchObject({
      criticalEventMaterialized: false,
      weightedValue: expected.rawDamage,
    });
    expect(forcedCritical.formula.randomBranch.mode).toBe('critical');
    expect(forcedNonCritical.formula.randomBranch.mode).toBe('non-critical');
    expect(miss).toBeUndefined();
    expect(nonCrittable).toMatchObject({
      formula: {
        status: 'verified-tuning-formula-applied',
        randomBranch: null,
      },
    });
    expect(nonCrittable.rawDamage).toBeGreaterThan(0);
    expect(
      rateOneHundred.formula.randomBranch.sourceCriticalRateBasisPoints
    ).toBeGreaterThan(
      rateZero.formula.randomBranch.sourceCriticalRateBasisPoints
    );
    expect(
      rateOneHundred.formula.randomBranch.sourceCriticalDamageBasisPoints
    ).toBeGreaterThan(
      rateZero.formula.randomBranch.sourceCriticalDamageBasisPoints
    );
  }, 60_000);

  it('keeps the focused A4 mechanic interval right-open at frame 103', () => {
    const run = createMachineAxisService().simulate(misaFixture);
    const actionFrame = misaFixture.actions.find(
      action => action.id === 'misa-a4'
    ).schedule.frame;
    const relativeFrames = (run.trace?.damage ?? [])
      .filter(
        event =>
          event.actionId === 'misa-a4' &&
          String(event.hitIdentity ?? '').startsWith('10700204|0|')
      )
      .map(event => event.absoluteFrame - actionFrame);

    expect(relativeFrames).toContain(102);
    expect(relativeFrames.every(frame => frame >= 0 && frame < 103)).toBe(true);
    expect(relativeFrames).not.toContain(103);
  }, 60_000);

  it('publishes a zero-gap owner matrix while keeping sourced sub1 variants N/A', () => {
    expect(
      validateCharacterAcceptanceManifest(misaManifest, {
        checkPublication: false,
      })
    ).toMatchObject({ valid: true, issues: [] });
    expect(misaMatrix.summary).toMatchObject({
      requirementCount: 181,
      requiredCount: 98,
      passedCount: 98,
      blockedCount: 0,
      notApplicableCount: 83,
    });
    expect(misaLedger.summary).toMatchObject({
      uniqueBlockingCount: 0,
      sourceGapCount: 0,
      acceptanceGapCount: 0,
    });
    expect(misaCoverage.summary).toMatchObject({
      coveredRequirementCount: 98,
    });
    expect(misaManifest.maturity.facts).toMatchObject({
      headlessReplayPassed: true,
      canonicalReplayStable: true,
      workbenchImportPassed: true,
      matrixComplete: true,
      blockingLedgerCount: 0,
      functionalFailureCount: 0,
    });
    expect(misaManifest.evidence.productVisualAcceptance).toMatchObject({
      status: 'accepted',
      acceptanceCommit: '5ee914e2f5134d280f2a5da0ea6a28604242957c',
      bindingStatus: 'verified',
    });
    expect(misaManifest.maturity).toMatchObject({
      optimizationReady: true,
      blockers: [],
    });
    expect(
      misaMatrix.requirements.filter(requirement =>
        requirement.reasons.includes('joint-attack-trigger-unresolved')
      )
    ).toHaveLength(13);

    const sourceSubskillBoundaries = misaManifest.requirementInventory.records
      .filter(record =>
        (record.reasons ?? []).includes(
          'source-subskill-has-no-runtime-reachable-public-action-form-in-frozen-product-scenario'
        )
      )
      .map(record => {
        const hitMatch = String(
          record.coverageSelector?.hitIdentity ?? ''
        ).match(/^(\d+)\|(\d+)\|/);
        const windowMatch = String(
          record.coverageSelector?.windowIdentity ?? ''
        ).match(/\|control:(\d+)\|sub:(\d+)\|/);
        const identityMatch = hitMatch ?? windowMatch;
        return {
          dimension: record.dimension,
          controlSkillId: Number(identityMatch?.[1]),
          subSkillIndex: Number(identityMatch?.[2]),
          disposition: record.sourceDisposition,
        };
      });
    expect(sourceSubskillBoundaries).toHaveLength(12);
    expect(
      sourceSubskillBoundaries.every(
        record =>
          record.disposition === 'not-applicable' &&
          record.subSkillIndex === 1 &&
          [10700212, 10700226].includes(record.controlSkillId) &&
          ['control-window', 'hit'].includes(record.dimension)
      )
    ).toBe(true);
  });

  it('rejects any N/A declaration for a runtime-reachable control subskill', () => {
    expect(() =>
      createCharacterAcceptanceRequirementSources({
        profile: misaProfile,
        sourceNotApplicableControlSubskills: [
          {
            identity: 'forged-runtime-reachable-boundary',
            controlSkillId: 10700212,
            subSkillIndex: 0,
            dimensions: ['control-window', 'hit'],
            reason: 'forged-not-applicable-reason',
            sourceIdentity: 'forged-source-identity',
          },
        ],
      })
    ).toThrow(
      'Source not-applicable control boundary is runtime reachable: forged-runtime-reachable-boundary'
    );
  });
});

function createMisaRuntimePackage() {
  const result = structuredClone(mechanicsPackage);
  result.packageHash = misaFixture.dataIdentity.verifiedMechanicsPackageHash;
  const ownerId = Number(misaProfile.owner.ownerId);
  const replaceOwner = (records, additions) => [
    ...(records ?? []).filter(record => Number(record.ownerId) !== ownerId),
    ...structuredClone(additions ?? []),
  ];
  result.actionVariantGraph.pickupProfiles = replaceOwner(
    result.actionVariantGraph.pickupProfiles,
    misaProfile.contracts.pickupProfiles
  );
  result.actionVariantGraph.pickupSpawnBindings = replaceOwner(
    result.actionVariantGraph.pickupSpawnBindings,
    misaProfile.contracts.pickupSpawnBindings
  );
  result.actionVariantGraph.pickupAbsorbBindings = replaceOwner(
    result.actionVariantGraph.pickupAbsorbBindings,
    misaProfile.contracts.pickupAbsorbBindings
  );
  return result;
}
