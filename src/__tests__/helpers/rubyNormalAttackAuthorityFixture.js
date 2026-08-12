import rubyOwnerContract from '../../data/generated/character-combat-owner-contracts/103002.json';
import mechanicsPackage from '../../data/generated/verified-combat-mechanics-package.json';
import { installVerifiedCombatMechanicsPackage } from '../../data/verifiedCombatMechanicsPackage';

export function installRubyNormalAttackProfileOverlay() {
  const runtimePackage = structuredClone(mechanicsPackage);
  const mapping = runtimePackage.actionMappings.find(
    candidate =>
      Number(candidate.ownerId) === 103002 &&
      candidate.actionKind === 'normal-attack'
  );
  const chains = rubyOwnerContract.contracts.attackInputChains ?? [];
  mapping.profileAttackInputSegments = chains.flatMap(chain =>
    (chain.segments ?? []).map(segment => {
      const selectedSubSkillIndex = Number(segment.subSkillIndex ?? 0);
      const selectedHitIdentities = (segment.executionTiming?.hits ?? [])
        .map(hit => hit.hitIdentity)
        .filter(Boolean);
      return {
        ...structuredClone(segment),
        identity: `${chain.chainIdentity}:segment:${segment.sequenceIndex}`,
        attackInputChainIdentity: chain.chainIdentity,
        chainSequenceIndex: segment.sequenceIndex,
        sequenceTotal: segment.sequenceTotal ?? chain.segments.length,
        selectedSubSkillIndex,
        effectiveDurationFrames: segment.durationFrames,
        durationStatus: 'applied',
        effectiveDurationStatus: 'applied',
        durationSourceIdentity: segment.sourceIdentity,
        sourceEvidenceStatus: 'applied',
        scenarioRuntimeStatus: 'scenario-assumed-zero-distance',
        runtimeReady: true,
        schedulable: true,
        selectedHitIdentities,
        hitCount: selectedHitIdentities.length,
        actionScheduling: {
          status: 'exact',
          kind: 'exact-selected-variant-occupancy',
          durationFrames: segment.durationFrames,
          planningDurationFrames: null,
          selectedSubSkillIndex,
          sourceIdentity: segment.sourceIdentity,
          sourceStatus: 'verified-input-occupancy',
          variantModelStatus: 'resolved',
          reasons: [],
        },
      };
    })
  );
  mapping.profileVariantWindowBindings = structuredClone(
    rubyOwnerContract.contracts.variantWindowBindings ?? []
  );
  installVerifiedCombatMechanicsPackage(runtimePackage);
}

export function restoreVerifiedCombatMechanicsPackage() {
  installVerifiedCombatMechanicsPackage(mechanicsPackage);
}

export function createRubyEnhancedContextAxis(baseFixture, options = {}) {
  const ultimateFrame = Number(options.ultimateFrame ?? 5700);
  const inputFrame = Number(options.inputFrame ?? ultimateFrame + 329);
  const contract = structuredClone(baseFixture);
  contract.actions = contract.actions.filter(
    action => action.id !== 'ruby-plunging'
  );
  contract.scenario.team.find(slot => slot.slotId === 'slot-3').initialSp = 100;
  contract.actions.push(
    {
      id: 'ruby-ultimate-context',
      owner: { kind: 'actor', slotId: 'slot-3' },
      intent: {
        kind: 'public-action',
        publicActionId: 10300213,
        actionKind: 'ultimate',
      },
      schedule: { mode: 'absolute', frame: ultimateFrame },
    },
    {
      id: 'ruby-enhanced-context',
      owner: { kind: 'actor', slotId: 'slot-3' },
      intent: {
        kind: 'public-action',
        publicActionId: 10300201,
        actionKind: 'normal-attack',
        attackInput: {
          sequenceIndex: 1,
          chainIdentity: 'ruby-enhanced-twelve-inputs',
          contextActionId: 'ruby-ultimate-context',
        },
      },
      schedule: { mode: 'absolute', frame: inputFrame },
    }
  );
  return contract;
}
