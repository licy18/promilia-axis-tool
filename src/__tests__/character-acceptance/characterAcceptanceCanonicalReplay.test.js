import xiaoyuFixture from '../../../fixtures/character-acceptance/101010-visual.json';
import rubyFixture from '../../../fixtures/character-acceptance/103002-visual.json';
import hanFixture from '../../../fixtures/character-acceptance/101003-visual.json';
import moyinFixture from '../../../fixtures/character-acceptance/109001-visual.json';
import mitiFixture from '../../../fixtures/character-acceptance/108003-visual.json';
import misaFixture from '../../../fixtures/character-acceptance/107002-visual.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';
import { createCanonicalTraceViewIndex } from '../../features/workbench/canonicalTraceViewIndex';
import { createMachineAxisService } from '../../machine-axis/machineAxisService';
import { createWorkbenchMachineAxisAdapter } from '../../machine-axis/workbenchMachineAxisAdapter';

const cases = [
  {
    ownerId: 101010,
    fixture: xiaoyuFixture,
    hashes: {
      input: '4eff2ba18c8ae0ce',
      data: 'ac061593f2df062e',
      trace: '02d02392f8c3f731',
      evaluation: '204c04b2ab3f5fb4',
    },
  },
  {
    ownerId: 103002,
    fixture: rubyFixture,
    hashes: {
      input: '73e7970ab177b4f9',
      data: '0b1abd6249b310f8',
      trace: '0682c3e6c84edb94',
      evaluation: '208849308c4ec837',
    },
  },
  {
    ownerId: 101003,
    fixture: hanFixture,
    hashes: {
      input: 'b41d527f81ffc7c5',
      data: '1bda6b2d8b2ae1aa',
      trace: 'ef8ae49f3575f873',
      evaluation: '53eb57b729f3a7e6',
    },
  },
  {
    ownerId: 109001,
    fixture: moyinFixture,
    hashes: {
      input: 'f12e0fa80af271ba',
      data: 'aea5f24e5281c37a',
      trace: '413ff7733e747c50',
      evaluation: '855dd5b0926bf110',
    },
  },
  {
    ownerId: 108003,
    fixture: mitiFixture,
    hashes: {
      input: '9f718baee33657d3',
      data: '1ad44128a8a5bd20',
      trace: 'a75ad5e2bff422a3',
      evaluation: '3c2fb1d6fda5e7b9',
    },
  },
  {
    ownerId: 107002,
    fixture: misaFixture,
    hashes: {
      input: '04a3403fb285d620',
      data: '0aded1e3190664b4',
      trace: '5855a8ab4fb3d5ba',
      evaluation: '620d8da34c9edd60',
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
    ({ fixture, hashes }) => {
      const service = createMachineAxisService();
      const adapter = createWorkbenchMachineAxisAdapter({ service });
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
    const service = createMachineAxisService();
    const xiaoyu = service.simulate(xiaoyuFixture);
    const ruby = service.simulate(rubyFixture);
    const han = service.simulate(hanFixture);

    expect(findSelection(xiaoyu, 'xiaoyu-burst-a1')).toMatchObject({
      controlSkillId: 10101001,
      subSkillIndex: 1,
    });
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
  }, 60_000);
});
