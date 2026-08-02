import { describe, expect, it } from 'vitest';
import census from '../../data/generated/dynamic-loadout-effect-mechanics.json';
import soulCatalog from '../../data/generated/soulessence-effect-mechanics.json';

describe('M12-B3-C dynamic loadout effect census', () => {
  it('indexes the complete 62 soul and 12 set-skill denominators from source closures', () => {
    expect(census.summary).toMatchObject({
      soulEssenceCount: 62,
      setSkillCount: 12,
      runtimeAppliedCount: 9,
      runtimeUnappliedCount: 65,
    });
    expect(soulCatalog.sourceSnapshot.setSkillControlClosure).toMatchObject({
      skillCount: 12,
      fileCount: 108,
      sha256:
        '8985e7ce5fa74b703caf39430e29aa3a4db212348df6653b1529f58cf4b7c18d',
    });
    expect(soulCatalog.setSkillDefinitions).toHaveLength(12);
    expect(
      soulCatalog.setSkillDefinitions.every(
        definition =>
          definition.sourceClosure.missingPathIds.length === 0 &&
          definition.sourceClosure.reachablePathIds.length > 0 &&
          definition.mechanicsHash &&
          definition.sourceIdentity
      )
    ).toBe(true);
  });

  it('keeps threshold activation distinct from set-effect runtime qualification', () => {
    expect(
      soulCatalog.setSkillDefinitions.every(
        definition =>
          definition.thresholdActivation.status === 'source-indexed' &&
          definition.thresholdActivation.appliedToRuntimeEffect === false &&
          definition.runtimeStatus === 'source-indexed-runtime-unapplied' &&
          definition.runtimeGaps.includes(
            'set-skill-runtime-operator-not-implemented'
          )
      )
    ).toBe(true);
    expect(soulCatalog.summary).toMatchObject({
      setSkillThresholdIndexedCount: 12,
      setSkillRuntimeAppliedCount: 0,
    });
  });

  it('records auditable trigger, target, lifecycle and persistence dimensions', () => {
    for (const record of census.records) {
      expect(record).toEqual(
        expect.objectContaining({
          objectKind: expect.stringMatching(/^(soul-essence|set-skill)$/),
          objectId: expect.any(String),
          effectSkillId: expect.any(Number),
          mechanismFamily: expect.any(String),
          sourceTarget: expect.any(Object),
          resourceTransactions: expect.any(Array),
          vitalChanges: expect.any(Array),
          delayedEvents: expect.any(Array),
          loopPersistence: expect.any(Object),
          evidenceStatus: expect.any(String),
          runtimeStatus: expect.any(String),
          runtimeGaps: expect.any(Array),
          sourceIdentity: expect.any(String),
        })
      );
    }
    expect(
      census.records.find(
        record =>
          record.objectKind === 'soul-essence' && record.objectId === '10098'
      )
    ).toMatchObject({
      mechanismFamily: 'equipped-actor-skill-tag-property-after-damage',
      evidenceStatus: 'runtime-applied',
      runtimeStatus: 'runtime-applied',
    });
    expect(
      census.records.find(
        record =>
          record.objectKind === 'soul-essence' && record.objectId === '10018'
      )
    ).toMatchObject({
      evidenceStatus: 'source-indexed-runtime-unapplied',
      runtimeGaps: expect.arrayContaining([
        'effect-activation-condition-operator-unsupported',
      ]),
    });
    expect(
      census.records.find(
        record =>
          record.objectKind === 'set-skill' && record.objectId === '1:4'
      )
    ).toMatchObject({
      resourceTransactions: [
        expect.objectContaining({ elementId: 199999026, valueRaw: 16 }),
      ],
      vitalChanges: [
        expect.objectContaining({
          elementId: 199999085,
          damageType: 5,
        }),
      ],
      runtimeStatus: 'source-indexed-runtime-unapplied',
    });
  });

  it('preserves source property tags and the verified skill-tag binding contract', () => {
    expect(soulCatalog.propertyTagContract).toMatchObject({
      sourceKind: 'il2cpp-battle-property-tag-contract',
      matchSemantics: {
        emptyModifierTags: 'unscoped',
        singleModifierTag: 'exact-membership',
        multipleModifierTags: 'evidence-open-runtime-blocked',
      },
      bindings: [
        expect.objectContaining({
          skillTagId: 1,
          skillTagName: 'NormalAttack',
          actionKind: 'normal-attack',
          propertyTag: 300,
          propertyTagName: 'NormalAttack',
          status: 'applied',
        }),
        expect.objectContaining({
          skillTagId: 2,
          skillTagName: 'WhackAttack',
          actionKind: 'charged-attack',
          propertyTag: 301,
          propertyTagName: 'Skill1',
          status: 'applied',
        }),
      ],
    });
    expect(census.propertyTagContract).toEqual(
      soulCatalog.propertyTagContract
    );

    const expectedTagsBySoulEssenceId = new Map([
      [10001, []],
      [10002, []],
      [10037, []],
      [10060, [300]],
      [10094, [301]],
      [10098, [301]],
      [10125, []],
      [10154, []],
      [10155, []],
    ]);
    const appliedDefinitions = soulCatalog.definitions.filter(
      definition => definition.runtimeStatus === 'runtime-applied'
    );

    expect(
      appliedDefinitions.map(definition => definition.soulEssenceId).sort()
    ).toEqual([...expectedTagsBySoulEssenceId.keys()].sort());
    for (const definition of appliedDefinitions) {
      const soulEssenceId = definition.soulEssenceId;
      const expectedTags = expectedTagsBySoulEssenceId.get(soulEssenceId);
      const censusRecord = census.records.find(
        row =>
          row.objectKind === 'soul-essence' &&
          row.objectId === String(soulEssenceId)
      );

      expect(definition).toMatchObject({
        runtimeStatus: 'runtime-applied',
        effect: {
          propertyTags: expectedTags,
          propertyTagMatchMode:
            expectedTags.length === 0 ? 'unscoped' : 'single-exact',
          propertyTagSourceIdentity: expect.stringContaining(
            `elementId=${definition.effect.elementId}`
          ),
        },
        runtimeGaps: [],
      });
      expect(censusRecord).toMatchObject({
        effectPropertyTags: expectedTags,
        effectPropertyTagMatchMode:
          expectedTags.length === 0 ? 'unscoped' : 'single-exact',
        effectPropertyTagSourceIdentity:
          definition.effect.propertyTagSourceIdentity,
      });
    }

    expect(
      soulCatalog.definitions
        .filter(definition => definition.runtimeStatus === 'runtime-applied')
        .every(definition => Array.isArray(definition.effect.propertyTags))
    ).toBe(true);
  });
});
