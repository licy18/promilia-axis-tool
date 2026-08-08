import { createSearchLoopClosureProjection } from './machineAxisSearchState';

export const MACHINE_AXIS_SEARCH_REPORT_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_SEARCH_REPORT_CONTRACT =
  'AzPrMachineAxisSearchReport';
export const MACHINE_AXIS_SEARCH_REPORT_KIND =
  'azpr-machine-axis-search-report';

export function createMachineAxisSearchReport({
  searchResult,
  contract,
  service,
} = {}) {
  const rows = (searchResult?.results ?? []).map((entry, index) =>
    createResultRow({
      entry,
      rank: index + 1,
      contract,
      service,
      searchOptions: searchResult?.options ?? {},
      bestScore: searchResult?.results?.[0]?.score ?? entry.score,
    })
  );
  return {
    schemaVersion: MACHINE_AXIS_SEARCH_REPORT_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_SEARCH_REPORT_CONTRACT,
    kind: MACHINE_AXIS_SEARCH_REPORT_KIND,
    scenario: {
      id: contract.scenario?.id ?? null,
      name: contract.scenario?.name ?? null,
      durationFrames: contract.scenario?.durationFrames ?? null,
      fps: contract.scenario?.fps ?? 60,
      enemy: projectEnemyAssumptions(contract),
      critical: projectCriticalAssumptions(contract),
      initialEnergy: projectInitialEnergy(contract),
      projectile: contract.scenario?.projectile ?? null,
    },
    dataIdentity: contract.dataIdentity ?? null,
    objective: searchResult?.options?.objective ?? 'cycle-dps-no-toughness',
    objectiveContract: searchResult?.options?.objectiveContract ?? null,
    summary: searchResult?.summary ?? null,
    results: rows,
  };
}

function createResultRow({
  entry,
  rank,
  contract,
  service,
  searchOptions,
  bestScore,
}) {
  const axis = entry.axis;
  const validation = service.validate(axis);
  const metrics = entry.metrics;
  const chain = entry.chain.map(item => ({
    actionId: item.action.id,
    label: item.label ?? item.action.intent?.actionKind ?? null,
    frame: item.action.schedule?.frame ?? null,
    source: item.source ?? null,
  }));
  const coverage = deriveCoverageTrust({
    axis,
    validation,
    warnings: entry.warnings,
  });
  const state = entry.state;
  return {
    rank,
    teamCandidateId: entry.teamCandidateId ?? 'fixed-team',
    score: entry.score,
    scoreDirection: entry.scoreDirection ?? 'maximize',
    finalScoreEligible: entry.finalScoreEligible === true,
    heuristic: {
      value: entry.heuristicScore ?? null,
      finalScore: false,
      purpose: 'beam-expansion-only',
    },
    deltaVsRank1: rank === 1 ? 0 : Number(entry.score) - Number(bestScore),
    team: projectTeam(axis),
    axis,
    hashes: entry.run?.hashes ?? null,
    legality: {
      valid: validation.valid,
      issues: validation.issues,
      warnings: validation.warnings,
      classification: validation.classification ?? null,
      invalidActionCount: entry.invalidActionCount ?? 0,
    },
    criticalPolicy: {
      policy:
        axis.scenario?.critical?.policy ??
        contract.scenario?.critical?.policy ??
        null,
      seed:
        axis.scenario?.critical?.seed ??
        contract.scenario?.critical?.seed ??
        null,
    },
    sampling: entry.sampling ?? null,
    objectiveProof: entry.objectiveProof ?? null,
    objectiveIssues: entry.objectiveIssues ?? [],
    boundariesConsumed: entry.boundariesConsumed ?? [],
    coverageTrust: coverage,
    metrics: {
      hpDamage: metrics.hpDamage,
      dps: metrics.dps,
      burst: metrics.burst,
      toughnessDamage: metrics.toughnessDamage,
      netToughnessDamage: metrics.netToughnessDamage,
      healing: metrics.healing,
      resourceSurplus: metrics.resourceSurplus,
      idle: metrics.idle,
      nonExecutableActions: metrics.nonExecutableActions,
      unresolvedActionCount: metrics.unresolvedActionCount,
    },
    contributions: entry.contributions ?? null,
    causalExplanation: {
      actionSequence: chain,
      endState: {
        currentFrame: state.currentFrame,
        remainingFrames: state.remainingFrames,
        activeActorId: state.activeActorId,
        actors: state.actors,
        kibos: state.kibos,
        cooldowns: state.cooldowns,
        effects: state.effects,
        tuningMarks: state.tuningMarks,
        specialResources: state.specialResources,
        pendingEvents: state.pendingEvents,
        enemy: state.enemy,
      },
      loopClosureState: createSearchLoopClosureProjection(state),
      note: `${searchOptions.objective ?? 'cycle-dps-no-toughness'} objective, ${axis.scenario?.name ?? 'axis'}`,
    },
  };
}

function projectTeam(contract) {
  return (contract.scenario?.team ?? []).map(slot => ({
    slotId: slot.slotId,
    characterId: Number(slot.characterId),
    level: slot.level ?? null,
    initialSp: slot.initialSp ?? null,
    kiboId: Number(slot.loadout?.kiboId) || null,
  }));
}

function projectEnemyAssumptions(contract) {
  const enemy = contract.scenario?.enemy ?? {};
  return {
    enemyId: enemy.enemyId ?? null,
    level: enemy.level ?? null,
    hpMultiplier: enemy.hpMultiplier ?? null,
    defenseMultiplier: enemy.defenseMultiplier ?? null,
    toughnessMultiplier: enemy.toughnessMultiplier ?? null,
    initialToughnessRatio: enemy.initialToughnessRatio ?? null,
    elementDefenseOverrides: enemy.elementDefenseOverrides ?? null,
    profile: enemy.profile ?? null,
  };
}

function projectCriticalAssumptions(contract) {
  return {
    policy: contract.scenario?.critical?.policy ?? null,
    seed: contract.scenario?.critical?.seed ?? null,
  };
}

function projectInitialEnergy(contract) {
  const initial = contract.scenario?.initialRuntimeState ?? {};
  return {
    kiboEnergyBySlot: (initial.kiboEnergyBySlot ?? []).map(entry => ({
      slotId: entry.slotId ?? null,
      kiboId: entry.kiboId ?? null,
      currentValue: entry.currentValue ?? null,
    })),
    specialResourcesByActor: (initial.specialResourcesByActor ?? []).map(
      entry => ({
        actorId: entry.actorId ?? null,
        resourceIdentity: entry.resourceIdentity ?? null,
        currentValue: entry.currentValue ?? null,
      })
    ),
  };
}

function deriveCoverageTrust({ axis, validation, warnings }) {
  const statuses = (axis.actions ?? []).map(action => ({
    actionId: action.id,
    sourceEvidenceStatus: action.intent?.sourceEvidenceStatus ?? null,
    scenarioRuntimeStatus: action.intent?.scenarioRuntimeStatus ?? null,
  }));
  const assumptionCodes = new Set([
    'machine-axis-scenario-assumption',
    'machine-axis-action-conditions-unresolved',
    'machine-axis-same-frame-order-unresolved',
  ]);
  const warningsByCode = (validation.warnings ?? []).reduce(
    (counts, warning) => {
      const code = warning.code ?? 'unknown';
      counts[code] = (counts[code] ?? 0) + 1;
      return counts;
    },
    {}
  );
  const assumptionWarningCount = Object.entries(warningsByCode)
    .filter(([code]) => assumptionCodes.has(code))
    .reduce((sum, [, count]) => sum + count, 0);
  return {
    actionCount: statuses.length,
    warnings: warnings ?? 0,
    assumptionWarningCount,
    warningCodesByCount: warningsByCode,
    note:
      assumptionWarningCount > 0 || warnings > 0
        ? '结果依赖场景假设或存在未解析条件；正式最优结论需在 M12-C 已验收角色上复验'
        : '无场景假设警告',
  };
}
