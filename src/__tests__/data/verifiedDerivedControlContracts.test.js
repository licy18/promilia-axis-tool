import { describe, expect, it } from 'vitest';
import coverage from '../../../reports/verified-derived-control-coverage.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';

describe('verified derived action control contracts', () => {
  it('covers every public actor multi-variant control without a silent omission', () => {
    expect(coverage.sourceDenominator).toEqual({
      kind: 'current-client-public-actor-derived-control-candidates',
      actorOwnerCount: 20,
      publicActionCount: 155,
      controlCount: 138,
      multiVariantControlCount: 64,
      controlPlayerVariantCount: 261,
    });
    expect(coverage.summary.silentOmissionCount).toBe(0);
    expect(coverage.omittedMultiVariantCandidates).toEqual([]);

    const identities = new Set(
      coverage.controls.map(contract => contract.contractIdentity)
    );
    const actorDiscoveries =
      mechanicsPackage.actionVariantGraph.conditionDiscoveries.filter(
        discovery => discovery.ownerKind === 'actor'
      );
    expect(actorDiscoveries).toHaveLength(64);
    for (const discovery of actorDiscoveries) {
      expect(
        identities.has(
          `actor:${discovery.ownerId}|control:${discovery.controlSkillId}|derived-control`
        )
      ).toBe(true);
    }
  });

  it('keeps source defaults separate from an action-instance decision', () => {
    for (const contract of coverage.controls) {
      expect(contract).toEqual(
        expect.objectContaining({
          controlSource: expect.any(String),
          decisionFrame: 0,
          selectedSubSkillIndex: null,
          sourceIdentity: expect.arrayContaining([expect.any(String)]),
          resolutionStatus: expect.stringMatching(
            /^(applied|partially-resolved|not-yet-modeled|static-evidence-gap|runtime-dependent)$/
          ),
        })
      );
    }

    const jadeCharged = findContract(101010, 10101010);
    expect(jadeCharged.defaultSelection).toMatchObject({
      subSkillIndex: 0,
      status: 'verified-default-subskill-selection-ready',
    });
    expect(jadeCharged.selectedSubSkillIndex).toBeNull();
  });

  it('publishes explicit charge-tier options only when client arrays map completely', () => {
    const charged = findContract(107003, 10700310);
    expect(charged).toMatchObject({
      controlSource: 'input-controlled',
      resolutionStatus: 'applied',
      inputSelector: {
        kind: 'charge-tier',
        mode: 'hold',
        resolutionStatus: 'applied',
        holdRange: {
          minimumHoldMs: 250,
          maximumHoldMs: null,
          resolutionStatus: 'partially-resolved',
        },
      },
    });
    expect(
      charged.inputSelector.options.map(option => [
        option.label,
        option.subSkillIndex,
        option.durationFrames,
      ])
    ).toEqual([
      ['重击1', 0, 160],
      ['重击2', 1, 237],
      ['重击3一段', 2, 416],
      ['重击3二段', 3, 240],
      ['重击3三段', 4, 313],
    ]);

    const unresolvedSelector = findContract(101010, 10101010).inputSelector;
    expect(unresolvedSelector.resolutionStatus).toBe('not-yet-modeled');
    expect(
      unresolvedSelector.options.every(
        option =>
          option.subSkillIndex == null &&
          option.durationFrames == null &&
          option.resolutionStatus === 'not-yet-modeled'
      )
    ).toBe(true);
  });

  it('classifies resource, state, and input-link evidence without inventing automatic follow-ups', () => {
    const rubyA1 = findContract(103002, 10300201);
    expect(rubyA1.candidateControlSources).toEqual(
      expect.arrayContaining(['input-controlled', 'resource-controlled'])
    );
    expect(rubyA1.resourceCondition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'resource-at-least',
          resourceIdentity: 'actor:103002:element:103002047',
          value: 1,
        }),
      ])
    );

    const jadeCharged = findContract(101010, 10101010);
    expect(jadeCharged.candidateControlSources).toEqual(
      expect.arrayContaining(['input-controlled', 'state-controlled'])
    );
    expect(jadeCharged.stateCondition.length).toBeGreaterThan(0);

    const inputLink = findContract(107001, 10700101);
    expect(inputLink.inputRelations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          targetControlSkillId: 10700102,
          targetSubSkillIndex: 4,
          baseOnInput: true,
          inputToIndex: true,
          startFrame: 20,
          endFrame: 72,
        }),
      ])
    );
    expect(coverage.summary.automaticFollowUpCount).toBe(0);
    expect(
      coverage.controls.every(contract => contract.automaticFollowUps.length === 0)
    ).toBe(true);
  });
});

function findContract(ownerId, controlSkillId) {
  const contract = coverage.controls.find(
    item =>
      item.ownerId === ownerId && item.controlSkillId === controlSkillId
  );
  expect(contract).toBeTruthy();
  return contract;
}
