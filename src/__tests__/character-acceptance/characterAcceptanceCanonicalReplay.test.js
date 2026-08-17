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
      input: 'f260cbe1765fe13f',
      data: '0cdff5954f47238e',
      trace: 'e9bf7ae0974573c4',
      evaluation: 'f72a5e2c689d161b',
    },
  },
  {
    ownerId: 103002,
    fixture: rubyFixture,
    hashes: {
      input: '349a9511657d3368',
      data: 'd6bfb30c05775c4f',
      trace: 'c6033a7669c568e7',
      evaluation: 'b0acda242f007986',
    },
  },
  {
    ownerId: 101003,
    fixture: hanFixture,
    hashes: {
      input: '25ad5e853e231c83',
      data: '624b48e264e09af9',
      trace: '081aaca35501d09c',
      evaluation: '7cf1957ae8627871',
    },
  },
  {
    ownerId: 109001,
    fixture: moyinFixture,
    hashes: {
      input: '03be53ea7ebffb40',
      data: 'fae2c8c72e8e7742',
      trace: 'a9925dc87757b703',
      evaluation: '94254d19b8dd08e4',
    },
  },
  {
    ownerId: 108003,
    fixture: mitiFixture,
    hashes: {
      input: '19207f7f3c7354d9',
      data: '2a1034a4de087026',
      trace: 'b8de88b26761d6c3',
      evaluation: '536749479f9c27ac',
    },
  },
  {
    ownerId: 107002,
    fixture: misaFixture,
    hashes: {
      input: '5295268176474471',
      data: '9ca34bdf5eeede37',
      trace: '180321b144cef1e0',
      evaluation: '44efb01bcaa13650',
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
