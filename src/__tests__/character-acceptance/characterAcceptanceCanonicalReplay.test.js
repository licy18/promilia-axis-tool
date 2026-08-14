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
      input: '6d6ef75d3a8d90cd',
      data: '25be5c0a8fa43ad0',
      trace: '29b1a5cf197fd4f6',
      evaluation: 'a753f6788d66964d',
    },
  },
  {
    ownerId: 103002,
    fixture: rubyFixture,
    hashes: {
      input: '0657838366cfd35a',
      data: '66a63cfbd3b5b7a0',
      trace: '0925f2d1732c9700',
      evaluation: 'b0acda242f007986',
    },
  },
  {
    ownerId: 101003,
    fixture: hanFixture,
    hashes: {
      input: 'cbef83de60bc52be',
      data: '69332b15aaa18102',
      trace: '0b38651860faa9bf',
      evaluation: 'afb7809d5ed9ff1a',
    },
  },
  {
    ownerId: 109001,
    fixture: moyinFixture,
    hashes: {
      input: '7113dda5d446cd7b',
      data: 'a27e398f3ad3e875',
      trace: '68ccfb659f8eb692',
      evaluation: '019157378a4bf202',
    },
  },
  {
    ownerId: 108003,
    fixture: mitiFixture,
    hashes: {
      input: 'c366c268aaafca16',
      data: '964f7f4431171711',
      trace: '6b0763f7a68abaef',
      evaluation: '0f204a248dc578b9',
    },
  },
  {
    ownerId: 107002,
    fixture: misaFixture,
    hashes: {
      input: '8a82ef9e87458e27',
      data: '74f991d439e64485',
      trace: 'f589ce53d905f26b',
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
