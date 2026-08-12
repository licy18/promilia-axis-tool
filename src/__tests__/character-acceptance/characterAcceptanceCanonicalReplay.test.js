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

const cases = [
  {
    ownerId: 101010,
    fixture: xiaoyuFixture,
    hashes: {
      input: '93bb8b09eb5e75e3',
      data: '6af1c735c0f4c47c',
      trace: 'd92d46b043dc203c',
      evaluation: 'fd30dcfbaa6144f0',
    },
  },
  {
    ownerId: 103002,
    fixture: rubyFixture,
    hashes: {
      input: 'e02fdcaf3fecae08',
      data: 'b2c2e1cdfab8d024',
      trace: '212f8d7da88f6786',
      evaluation: '208849308c4ec837',
    },
  },
  {
    ownerId: 101003,
    fixture: hanFixture,
    hashes: {
      input: 'c8b46f828c346f0a',
      data: '7e17791ba49a9ea2',
      trace: 'df58152d6ea369e4',
      evaluation: '53eb57b729f3a7e6',
    },
  },
  {
    ownerId: 109001,
    fixture: moyinFixture,
    hashes: {
      input: '15d080b8fdb34e86',
      data: '8fdf2cf52bd9b30f',
      trace: '953d6fb09f0c8113',
      evaluation: 'e181489404062a9a',
    },
  },
  {
    ownerId: 108003,
    fixture: mitiFixture,
    hashes: {
      input: '76730e9947c44906',
      data: '3176ab37d9834506',
      trace: 'a0a6dcc744f39520',
      evaluation: 'b42113336570ef3e',
    },
  },
  {
    ownerId: 107002,
    fixture: misaFixture,
    hashes: {
      input: '30780d8354ecceaf',
      data: '9167d13d5bd46dc0',
      trace: '9d108c00b14b69ae',
      evaluation: '5238bf8119e66446',
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
  }, 60_000);
});
