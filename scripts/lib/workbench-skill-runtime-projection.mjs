export function createWorkbenchSkillRuntimeProjection({
  generatedAt,
  skillLogicIndex = {},
  skillLevelCrossCheck = {},
  valueParamIndex = {},
  skillAssetEvidence = {},
} = {}) {
  const projectedSkillLogicIndex = projectSkillLogicIndex(skillLogicIndex);
  const projectedSkillLevelCrossCheck =
    projectSkillLevelCrossCheck(skillLevelCrossCheck);
  const projectedValueParamIndex = projectValueParamIndex(valueParamIndex);
  const projectedSkillAssetEvidence =
    projectSkillAssetEvidence(skillAssetEvidence);

  return {
    schemaVersion: 1,
    kind: 'workbench-skill-runtime-projection',
    generatedAt,
    sourceKind: 'azpr-workbench-skill-runtime-projection',
    sources: {
      skillLogicIndex: 'src/data/generated/skill-logic-index.json',
      skillLevelCrossCheck: 'src/data/generated/skill-level-crosscheck.json',
      valueParamIndex: 'src/data/generated/value-param-index.json',
      skillAssetEvidence: 'src/data/generated/skill-asset-evidence.json',
    },
    counts: {
      skillLogicItems: projectedSkillLogicIndex.items.length,
      skillLevelCrossCheckItems: projectedSkillLevelCrossCheck.items.length,
      valueParams: projectedValueParamIndex.params.length,
      skillControlEvidenceItems:
        projectedSkillAssetEvidence.currentSkillControlEvidence.length,
      damageElementFieldMappingSkills:
        projectedSkillAssetEvidence.damageElementFieldMappingEvidence.skills
          ?.length ?? 0,
      externalElementObjectSkills:
        projectedSkillAssetEvidence.externalElementObjectEvidence.skills
          ?.length ?? 0,
      summonTargetCount:
        projectedSkillAssetEvidence.summonTargetSkillEvidence.targets?.length ??
        0,
    },
    skillLogicIndex: projectedSkillLogicIndex,
    skillLevelCrossCheck: projectedSkillLevelCrossCheck,
    valueParamIndex: projectedValueParamIndex,
    skillAssetEvidence: projectedSkillAssetEvidence,
  };
}

function projectSkillLogicIndex(source) {
  return {
    sourceKind: source.sourceKind,
    source: source.source,
    summary: source.summary,
    items: (source.items ?? []).map(item => ({
      skillId: item.skillId,
      characterId: item.characterId,
      subSkills: (item.subSkills ?? []).map(subSkill => ({
        subSkillId: subSkill.subSkillId,
        logic: subSkill.logic,
        displayPairs: subSkill.displayPairs,
        displayMatchesLogic: subSkill.displayMatchesLogic,
        diagnostics: subSkill.diagnostics,
      })),
      levels: (item.levels ?? []).map(level => ({
        level: level.level,
        levelIndex: level.levelIndex,
        skillLevelRowId: level.skillLevelRowId,
        subSkillId: level.subSkillId,
        display: level.display,
        elementValues: level.elementValues,
        diagnostics: level.diagnostics,
      })),
    })),
  };
}

function projectSkillLevelCrossCheck(source) {
  return {
    sourceKind: source.sourceKind,
    source: source.source,
    summary: source.summary,
    items: (source.items ?? []).map(item => ({
      skillId: item.skillId,
      characterId: item.characterId,
      levels: (item.levels ?? []).map(level => ({
        level: level.level,
        levelIndex: level.levelIndex,
        rowId: level.rowId,
        status: level.status,
        labels: level.labels,
        values: level.values,
        labelIds: level.labelIds,
        valueIds: level.valueIds,
        matches: level.matches,
        diagnostics: level.diagnostics,
      })),
    })),
  };
}

function projectValueParamIndex(source) {
  return {
    sourceKind: source.sourceKind,
    source: source.source,
    summary: source.summary,
    params: (source.params ?? []).map(param => ({
      id: param.id,
      variable: param.variable,
      variableSource: param.variableSource,
      label: param.label,
      semanticStatus: param.semanticStatus,
      category: param.category,
      roleHint: param.roleHint,
      isConstant: param.isConstant,
      rowCount: param.rowCount,
      skillCount: param.skillCount,
      elementCount: param.elementCount,
      minValue: param.minValue,
      maxValue: param.maxValue,
      sampleValues: param.sampleValues,
    })),
  };
}

function projectSkillAssetEvidence(source) {
  return {
    sourceKind: source.sourceKind,
    externalElementObjectEvidence: source.externalElementObjectEvidence ?? {},
    summonTargetSkillEvidence: source.summonTargetSkillEvidence ?? {},
    damageElementFieldMappingEvidence:
      source.damageElementFieldMappingEvidence ?? {},
    currentSkillControlEvidence: (source.currentSkillControlEvidence ?? []).map(
      projectCurrentSkillControlEvidence
    ),
  };
}

function projectCurrentSkillControlEvidence(source) {
  const hpLaneCandidates =
    source.effectLaneCandidatesByLane?.hpDamage ??
    (source.effectLaneCandidates ?? []).filter(candidate =>
      (candidate.laneHints ?? []).includes('hpDamage')
    );
  const hpBehaviorChains = (
    source.effectLaneBehaviorChainsByLane?.hpDamage ??
    source.effectLaneBehaviorChains ??
    []
  ).filter(chain => (chain.laneHints ?? []).includes('hpDamage'));

  return {
    skillId: source.skillId,
    characterId: source.characterId,
    skillName: source.skillName,
    status: source.status,
    expectedDirectory: source.expectedDirectory,
    effectLaneCandidateSummary: {
      hpDamage: source.effectLaneCandidateSummary?.hpDamage ?? { count: 0 },
    },
    effectLaneCandidatesByLane: {
      hpDamage: hpLaneCandidates,
    },
    effectLaneBehaviorChainsByLane: {
      hpDamage: hpBehaviorChains,
    },
    behaviorReferenceSummary: projectBehaviorReferenceSummary(
      source.behaviorReferenceSummary
    ),
    stateTimingEvidence: projectStateTimingEvidence(source.stateTimingEvidence),
  };
}

function projectBehaviorReferenceSummary(source = {}) {
  return {
    behaviorListRefs: source.behaviorListRefs,
    resolvedBehaviorListRefs: source.resolvedBehaviorListRefs,
    resolvedBehaviorRefsByLane: {
      hpDamage: source.resolvedBehaviorRefsByLane?.hpDamage,
    },
    scriptTypeCandidateBehaviorRefs: source.scriptTypeCandidateBehaviorRefs,
    externalElementBaseRefs: source.externalElementBaseRefs,
    resourceMapMatchedElementBaseRefs: source.resourceMapMatchedElementBaseRefs,
    resourceMapUnmatchedElementBaseRefs:
      source.resourceMapUnmatchedElementBaseRefs,
  };
}

function projectStateTimingEvidence(source) {
  if (!source) {
    return null;
  }
  return {
    status: source.status,
    scope: source.scope,
    bindingStatus: source.bindingStatus,
    hpStateWindowCount: source.hpStateWindowCount,
    timingControlChainCount: source.timingControlChainCount,
    animationStateControlCount: source.animationStateControlCount,
    eventBridgeControlCount: source.eventBridgeControlCount,
    hpStateNames: source.hpStateNames,
    animationStateNames: source.animationStateNames,
    eventBridgeSkillIds: source.eventBridgeSkillIds,
    eventBridgeTypes: source.eventBridgeTypes,
    eventBridgeValues: source.eventBridgeValues,
    stateFindings: (source.stateFindings ?? []).slice(0, 6).map(item => ({
      stateName: item.stateName,
      status: item.status,
      hpWindowCount: item.hpWindowCount,
      hpStartFrames: item.hpStartFrames,
      subSkillIds: item.subSkillIds,
      hitEffects: item.hitEffects,
      animationControlCount: item.animationControlCount,
      animationFrameWindows: (item.animationFrameWindows ?? [])
        .slice(0, 3)
        .map(projectAnimationFrameWindow),
      overlappingEventBridgeCount: item.overlappingEventBridgeCount,
      overlappingEventBridgeNames: item.overlappingEventBridgeNames,
    })),
    animationStateControls: (source.animationStateControls ?? []).map(
      projectAnimationStateControl
    ),
    eventBridgeControls: (source.eventBridgeControls ?? []).map(
      projectEventBridgeControl
    ),
    eventBridgeTargetSkillControlEvidence:
      projectEventBridgeTargetSkillControlEvidence(
        source.eventBridgeTargetSkillControlEvidence
      ),
  };
}

function projectAnimationFrameWindow(source) {
  return {
    sourceName: source.sourceName,
    sourceStartFrame: source.sourceStartFrame,
    sourceEndFrame: source.sourceEndFrame,
    aniStartFrame: source.aniStartFrame,
    aniEndFrame: source.aniEndFrame,
    aniLength: source.aniLength,
  };
}

function projectAnimationStateControl(source) {
  return {
    sourceName: source.sourceName,
    sourceStartFrame: source.sourceStartFrame,
    sourceEndFrame: source.sourceEndFrame,
    selectedStateName: source.selectedStateName,
    behaviorStartFrame: source.behaviorStartFrame,
    behaviorFrameCount: source.behaviorFrameCount,
    timelineGroupIndex: source.timelineGroupIndex,
    aniLength: source.aniLength,
    aniStartFrame: source.aniStartFrame,
    aniEndFrame: source.aniEndFrame,
  };
}

function projectEventBridgeControl(source) {
  return {
    sourceName: source.sourceName,
    sourceStartFrame: source.sourceStartFrame,
    sourceEndFrame: source.sourceEndFrame,
    behaviorStartFrame: source.behaviorStartFrame,
    behaviorFrameCount: source.behaviorFrameCount,
    skillId: source.skillId,
    bridge: source.bridge,
    type: source.type,
    frameIndex: source.frameIndex,
    allowAttack: source.allowAttack,
    allowMove: source.allowMove,
    allowJump: source.allowJump,
    allowDodge: source.allowDodge,
    allowedInputs: source.allowedInputs,
  };
}

function projectEventBridgeTargetSkillControlEvidence(source) {
  if (!source) {
    return null;
  }
  return {
    status: source.status,
    directTargetSkillIds: source.directTargetSkillIds,
    targetSkillIds: source.targetSkillIds,
    targetSkillControlCount: source.targetSkillControlCount,
    foundTargetSkillControlCount: source.foundTargetSkillControlCount,
    missingTargetSkillControlCount: source.missingTargetSkillControlCount,
    childSkillTargetIds: source.childSkillTargetIds,
    chainDepthMax: source.chainDepthMax,
    targetAnimationStateNames: source.targetAnimationStateNames,
    targetHpTrackNames: source.targetHpTrackNames,
    normalAttackChainCandidate: source.normalAttackChainCandidate
      ? {
          status: source.normalAttackChainCandidate.status,
          chainSkillIds: source.normalAttackChainCandidate.chainSkillIds,
          chainLength: source.normalAttackChainCandidate.chainLength,
          animationStateNames:
            source.normalAttackChainCandidate.animationStateNames,
          hpTimelineCandidateCount:
            source.normalAttackChainCandidate.hpTimelineCandidateCount,
          hpTrackNames: source.normalAttackChainCandidate.hpTrackNames,
          bridgeTargetSkillIds:
            source.normalAttackChainCandidate.bridgeTargetSkillIds,
        }
      : null,
    normalAttackHitChainCandidate: source.normalAttackHitChainCandidate ?? null,
    targetSkillControls: (source.targetSkillControls ?? []).map(target => ({
      skillId: target.skillId,
      status: target.status,
      skillTableStatus: target.skillTableStatus,
      parentSkill: target.parentSkill,
      relationToSourceSkill: target.relationToSourceSkill,
      discoveryDepth: target.discoveryDepth,
      discoveredFromSkillId: target.discoveredFromSkillId,
      animationStateControlCount: target.animationStateControlCount,
      animationStateNames: target.animationStateNames,
      animationStateControls: (target.animationStateControls ?? []).map(
        projectAnimationStateControl
      ),
      eventBridgeControls: (target.eventBridgeControls ?? []).map(
        projectEventBridgeControl
      ),
      hpTimelineCandidateCount: target.hpTimelineCandidateCount,
      hpTimelineCandidates: (target.hpTimelineCandidates ?? [])
        .slice(0, 4)
        .map(candidate => ({
          name: candidate.name,
          trackName: candidate.trackName,
          startFrame: candidate.startFrame,
          endFrame: candidate.endFrame,
        })),
      eventBridgeSkillIds: target.eventBridgeSkillIds,
    })),
  };
}
