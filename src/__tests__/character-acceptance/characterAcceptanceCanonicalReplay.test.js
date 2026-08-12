import xiaoyuFixture from '../../../fixtures/character-acceptance/101010-visual.json';
import rubyFixture from '../../../fixtures/character-acceptance/103002-visual.json';
import hanFixture from '../../../fixtures/character-acceptance/101003-visual.json';
import moyinFixture from '../../../fixtures/character-acceptance/109001-visual.json';
import mitiFixture from '../../../fixtures/character-acceptance/108003-active-surface-closure.json';
import misaFixture from '../../../fixtures/character-acceptance/107002-visual.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createCanonicalTraceViewIndex } from '../../features/workbench/canonicalTraceViewIndex';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';
import {
  installRubyNormalAttackProfileOverlay,
  restoreVerifiedCombatMechanicsPackage,
} from '../helpers/rubyNormalAttackAuthorityFixture';

const cases = [
  {
    ownerId: 101010,
    fixture: xiaoyuFixture,
    hashes: {
      input: 'b8f9391bf6c8d0ed',
      data: '48497e3ca2309f8a',
      trace: '1771ed0580495bd5',
      evaluation: 'a753f6788d66964d',
    },
  },
  {
    ownerId: 103002,
    fixture: rubyFixture,
    hashes: {
      input: '0c12e71e18e218c2',
      data: '4b4e77c78408e1ef',
      trace: '6214b892da466fb4',
      evaluation: 'b0acda242f007986',
    },
  },
  {
    ownerId: 101003,
    fixture: hanFixture,
    hashes: {
      input: 'f0dbd89b720fc7aa',
      data: 'e32f2d5837588cad',
      trace: '834e6f82d1a23767',
      evaluation: 'afb7809d5ed9ff1a',
    },
  },
  {
    ownerId: 109001,
    fixture: moyinFixture,
    hashes: {
      input: '745619ae689b6945',
      data: '2c2db383e560bf64',
      trace: 'ff78b9d9ff0d2b93',
      evaluation: 'e181489404062a9a',
    },
  },
  {
    ownerId: 108003,
    fixture: mitiFixture,
    hashes: {
      input: '1ce25e86403c140c',
      data: 'b3cd81ccfb54ca10',
      trace: 'ceb231f9f9812e1b',
      evaluation: 'e755244f73842807',
    },
  },
  {
    ownerId: 107002,
    fixture: misaFixture,
    hashes: {
      input: 'fa89b0ef62c0e6be',
      data: '0a19ba6d4b57c996',
      trace: '1910eb5fa24efb76',
      evaluation: '6538894b2964b7e7',
    },
  },
];

function findSelection(run, actionId) {
  return (run.trace?.variants?.selections ?? []).find(
    selection => selection.actionId === actionId
  );
}

function findResourceEvent(run, actionId, resourceIdentity) {
  return (run.trace?.variants?.resourceEvents ?? []).find(
    event =>
      event.actionId === actionId &&
      event.payload?.resourceIdentity === resourceIdentity
  );
}

describe('M11-D canonical character scenario batch', () => {
  beforeEach(() => {
    installVerifiedCombatMechanicsPackage(mechanicsPackage);
  });

  it.each(cases)(
    'replays owner $ownerId through Machine Axis and Workbench without hash drift',
    ({ ownerId, fixture, hashes }) => {
      if (ownerId === 103002) installRubyNormalAttackProfileOverlay();
      const service = createMachineAxisService();
      const adapter = createWorkbenchMachineAxisAdapter({ service });
      expect(service.prepare(fixture).issues).toEqual([]);
      const first = service.simulate(fixture);
      const second = service.simulate(fixture);
      const imported = adapter.importContract(fixture);
      const exported = adapter.exportProject(imported.project, {
        metadata: fixture.metadata,
      });
      const roundTrip = service.simulate(exported);
      const index = createCanonicalTraceViewIndex(imported.canonicalRun);

      expect(first.hashes).toMatchObject(hashes);
      expect(second.hashes).toEqual(first.hashes);
      expect(roundTrip.hashes).toEqual(first.hashes);
      expect(index.traceHash).toBe(hashes.trace);
      expect(index.actionViews.length).toBeGreaterThan(0);
      expect(index.hitsByIdentity.size).toBeGreaterThan(0);
      expect(index.summary.actionCount).toBe(index.actionViews.length);
      expect(index.summary.hitCount).toBeGreaterThan(0);
      restoreVerifiedCombatMechanicsPackage();
    },
    60_000
  );

  it('locks critical boundary, expected, forced, and miss semantics on stable hit identities', () => {
    const run = createMachineAxisService().simulate(xiaoyuFixture);
    const hitFor = suffix =>
      (run.trace?.damage ?? []).find(
        event =>
          event.actionId === '101010-critical-' + suffix &&
          event.eventType === 'VERIFIED_COMBAT_HIT'
      );
    const sampledLow = hitFor('sampled-low');
    const sampledBoundary = hitFor('sampled-boundary');
    const expected = hitFor('expected');

    expect(sampledLow.formula.randomBranch).toMatchObject({
      mode: 'captured-critical-roll',
      criticalRoll: 499,
      criticalThreshold: 500,
      critical: true,
    });
    expect(sampledBoundary.formula.randomBranch).toMatchObject({
      mode: 'captured-critical-roll',
      criticalRoll: 500,
      criticalThreshold: 500,
      critical: false,
    });
    expect(expected.formula.verifiedResult.expectedCritical).toMatchObject({
      probabilityBasisPoints: 500,
      criticalEventMaterialized: false,
    });
    expect(expected.formula.verifiedResult.expectedCritical.weightedValue).toBe(
      expected.rawDamage
    );
    expect(hitFor('critical').formula.randomBranch.mode).toBe('critical');
    expect(hitFor('non-critical').formula.randomBranch.mode).toBe(
      'non-critical'
    );
    expect(hitFor('miss-critical')).toBeUndefined();
  }, 60_000);

  it('locks the Xiaoyu, Ruby, and Han owner-specific causal probes', () => {
    installRubyNormalAttackProfileOverlay();
    const service = createMachineAxisService();
    const xiaoyu = service.simulate(xiaoyuFixture);
    const ruby = service.simulate(rubyFixture);
    const han = service.simulate(hanFixture);

    expect(
      [
        ['xiaoyu-insufficient-a1', 10101001],
        ['xiaoyu-insufficient-a2', 10101002],
        ['xiaoyu-insufficient-a3', 10101003],
        ['xiaoyu-a4-source-effects', 10101004],
        ['xiaoyu-insufficient-a5-source', 10101005],
      ].map(([actionId, controlSkillId]) => ({
        actionId,
        selection: findSelection(xiaoyu, actionId),
        expectedControlSkillId: controlSkillId,
      }))
    ).toEqual(
      expect.arrayContaining(
        [
          ['xiaoyu-insufficient-a1', 10101001],
          ['xiaoyu-insufficient-a2', 10101002],
          ['xiaoyu-insufficient-a3', 10101003],
          ['xiaoyu-a4-source-effects', 10101004],
          ['xiaoyu-insufficient-a5-source', 10101005],
        ].map(([actionId, controlSkillId]) => ({
          actionId,
          expectedControlSkillId: controlSkillId,
          selection: expect.objectContaining({
            controlSkillId,
            subSkillIndex: 0,
          }),
        }))
      )
    );
    expect(findSelection(ruby, 'ruby-chain-e1')).toMatchObject({
      controlSkillId: 10300201,
      subSkillIndex: 1,
    });
    expect(
      findResourceEvent(ruby, 'ruby-chain-e1', 'actor:103002:element:103002047')
    ).toMatchObject({
      payload: { beforeValue: 6, afterValue: 5, change: -1 },
    });
    expect(
      (han.trace?.state?.conditionalHitGroups ?? []).find(
        group => group.actionId === 'han-firework-charged'
      )
    ).toMatchObject({
      beforeStacks: 7,
      consumedStacks: 6,
      afterStacks: 1,
      applied: true,
    });
    restoreVerifiedCombatMechanicsPackage();
  }, 60_000);
});
