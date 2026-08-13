import { hashCanonicalValue } from '../simulation/headless/canonicalSerialization.js';

export const MACHINE_AXIS_COARSE_PLAN_SCHEMA_VERSION = 1;
export const MACHINE_AXIS_COARSE_PLAN_CONTRACT_NAME =
  'AzPrMachineAxisCoarsePlan';
export const MACHINE_AXIS_COARSE_PLAN_KIND = 'azpr-machine-axis-coarse-plan';

export const MACHINE_AXIS_LOCAL_SEARCH_LIMITS = Object.freeze({
  maxSeeds: 16,
  maxActionsPerSeed: 128,
  maxVariablesPerSeed: 24,
  maxValuesPerVariable: 9,
  maxMutationDepth: 2,
  maxCandidatesPerSeed: 128,
  maxCandidatesTotal: 512,
  maxCandidatesPerShard: 8,
  maxShards: 64,
  maxWorkers: 8,
  maxMemoryMbPerWorker: 4096,
  maxSimulationsPerShard: 32,
  maxWallTimeMsPerShard: 120_000,
  maxWallTimeMsTotal: 1_800_000,
});

const DEFAULT_BUDGET = Object.freeze({
  maxCandidatesTotal: 512,
  maxShards: 64,
  maxWallTimeMs: 1_800_000,
  perShard: Object.freeze({
    maxCandidates: 8,
    maxEvaluations: 8,
    maxSimulations: 32,
    maxWallTimeMs: 120_000,
  }),
});

const DEFAULT_PARALLELISM = Object.freeze({
  workers: 4,
  memoryMbPerWorker: 3072,
});

const VARIABLE_KINDS = new Set([
  'schedule-frame-offset',
  'charging-release-frame',
  'adjacent-frame-swap',
]);
const OBJECTIVE_IDS = new Set([
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
  'fastest-kill',
  'damage',
  'burst',
  'toughness',
]);

export class MachineAxisCoarsePlanError extends Error {
  constructor(issues) {
    super('Machine Axis coarse plan is invalid');
    this.name = 'MachineAxisCoarsePlanError';
    this.issues = structuredClone(issues ?? []);
  }
}

export function normalizeMachineAxisCoarsePlan(value) {
  const source = isRecord(value) ? value : {};
  const issues = [];
  const contractTemplate = isRecord(source.contractTemplate)
    ? structuredClone(source.contractTemplate)
    : null;
  if (
    Number(source.schemaVersion) !== MACHINE_AXIS_COARSE_PLAN_SCHEMA_VERSION
  ) {
    issues.push(
      issue(
        'coarse-plan-schema-version-unsupported',
        'schemaVersion',
        `schemaVersion must be ${MACHINE_AXIS_COARSE_PLAN_SCHEMA_VERSION}`
      )
    );
  }
  if (source.contractName !== MACHINE_AXIS_COARSE_PLAN_CONTRACT_NAME) {
    issues.push(
      issue(
        'coarse-plan-contract-name-invalid',
        'contractName',
        `contractName must be ${MACHINE_AXIS_COARSE_PLAN_CONTRACT_NAME}`
      )
    );
  }
  if (source.kind !== MACHINE_AXIS_COARSE_PLAN_KIND) {
    issues.push(
      issue(
        'coarse-plan-kind-invalid',
        'kind',
        `kind must be ${MACHINE_AXIS_COARSE_PLAN_KIND}`
      )
    );
  }
  if (!contractTemplate) {
    issues.push(
      issue(
        'coarse-plan-contract-template-required',
        'contractTemplate',
        'contractTemplate is required'
      )
    );
  } else if (
    contractTemplate.contractName !== 'AzPrMachineAxis' ||
    contractTemplate.kind !== 'azpr-machine-axis'
  ) {
    issues.push(
      issue(
        'coarse-plan-contract-template-invalid',
        'contractTemplate',
        'contractTemplate must be an AzPrMachineAxis contract'
      )
    );
  } else if ((contractTemplate.actions ?? []).length > 0) {
    issues.push(
      issue(
        'coarse-plan-contract-template-actions-forbidden',
        'contractTemplate.actions',
        'coarse actions belong in seeds; contractTemplate.actions must be empty'
      )
    );
  }

  const provenance = normalizeProvenance(source.provenance, issues);
  const seeds = normalizeSeeds(source.seeds, issues);
  const budget = normalizeBudget(source.budget, issues);
  const parallelism = normalizeParallelism(source.parallelism, issues);
  const objective = textOrNull(source.objective);
  if (!objective || !OBJECTIVE_IDS.has(objective)) {
    issues.push(
      issue(
        'coarse-plan-objective-required',
        'objective',
        'objective must be a supported Machine Axis objective'
      )
    );
  }
  const topN = boundedOrDefault(source.topN, 1, 50, 5, issues, 'topN');
  const planId = textOrNull(source.planId);
  if (!planId) {
    issues.push(
      issue('coarse-plan-id-required', 'planId', 'planId is required')
    );
  }
  if (
    source.authority?.formalRankingReady === true ||
    source.authority?.clientParityReady === true
  ) {
    issues.push(
      issue(
        'coarse-plan-formal-authority-forbidden',
        'authority',
        'a bounded AI coarse plan cannot claim formal ranking or client parity'
      )
    );
  }

  if (issues.length > 0) throw new MachineAxisCoarsePlanError(issues);

  const normalized = {
    schemaVersion: MACHINE_AXIS_COARSE_PLAN_SCHEMA_VERSION,
    contractName: MACHINE_AXIS_COARSE_PLAN_CONTRACT_NAME,
    kind: MACHINE_AXIS_COARSE_PLAN_KIND,
    planId,
    objective,
    topN,
    provenance,
    contractTemplate: {
      ...contractTemplate,
      actions: [],
    },
    seeds,
    budget,
    parallelism,
    authority: {
      classification: 'bounded-ai-guided-heuristic',
      formalRankingReady: false,
      clientParityReady: false,
      boundedStoppingRequired: true,
    },
  };
  const planHash = hashCanonicalValue(normalized);
  if (source.planHash != null && String(source.planHash) !== planHash) {
    throw new MachineAxisCoarsePlanError([
      issue(
        'coarse-plan-hash-mismatch',
        'planHash',
        'declared planHash does not match canonical plan content',
        { expected: planHash, actual: String(source.planHash) }
      ),
    ]);
  }
  return Object.freeze({ ...normalized, planHash });
}

export function createMachineAxisLocalCandidates(planInput) {
  const plan = normalizeMachineAxisCoarsePlan(planInput);
  const candidates = [];
  const seedSummaries = [];
  let globalTruncated = false;

  for (const seed of plan.seeds) {
    if (candidates.length >= plan.budget.maxCandidatesTotal) {
      globalTruncated = true;
      break;
    }
    const seedCandidates = createSeedCandidates({ plan, seed });
    const remaining = plan.budget.maxCandidatesTotal - candidates.length;
    const accepted = seedCandidates.candidates.slice(0, remaining);
    candidates.push(...accepted);
    seedSummaries.push({
      seedId: seed.seedId,
      plannedSearchSpaceSize: seedCandidates.plannedSearchSpaceSize,
      generatedCandidateCount: accepted.length,
      enumerationTruncated:
        seedCandidates.enumerationTruncated ||
        accepted.length < seedCandidates.candidates.length,
    });
    if (accepted.length < seedCandidates.candidates.length) {
      globalTruncated = true;
      break;
    }
  }

  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisLocalCandidateSet',
    kind: 'azpr-machine-axis-local-candidate-set',
    planId: plan.planId,
    planHash: plan.planHash,
    objective: plan.objective,
    bounded: true,
    formalRankingReady: false,
    candidateCount: candidates.length,
    enumerationTruncated:
      globalTruncated || seedSummaries.some(row => row.enumerationTruncated),
    seedSummaries,
    candidates,
  };
}

export function createMachineAxisLocalSearchShards(
  planInput,
  candidateSetInput
) {
  const plan = normalizeMachineAxisCoarsePlan(planInput);
  const candidateSet =
    candidateSetInput ?? createMachineAxisLocalCandidates(plan);
  const perShard = plan.budget.perShard.maxCandidates;
  const shards = [];
  for (
    let offset = 0;
    offset < candidateSet.candidates.length &&
    shards.length < plan.budget.maxShards;
    offset += perShard
  ) {
    const candidates = candidateSet.candidates.slice(offset, offset + perShard);
    const ordinal = shards.length + 1;
    const shardIdentity = {
      planHash: plan.planHash,
      ordinal,
      candidateIds: candidates.map(candidate => candidate.candidateId),
      budget: plan.budget.perShard,
    };
    shards.push({
      schemaVersion: 1,
      contractName: 'AzPrMachineAxisLocalSearchShard',
      kind: 'azpr-machine-axis-local-search-shard',
      shardId: `shard-${String(ordinal).padStart(4, '0')}-${hashCanonicalValue(
        shardIdentity
      ).slice(0, 12)}`,
      ordinal,
      planId: plan.planId,
      planHash: plan.planHash,
      objective: plan.objective,
      searchOptions: {
        objective: plan.objective,
      },
      budget: structuredClone(plan.budget.perShard),
      candidates,
    });
  }
  const assignedCandidateCount = shards.reduce(
    (sum, shard) => sum + shard.candidates.length,
    0
  );
  return {
    schemaVersion: 1,
    contractName: 'AzPrMachineAxisLocalSearchShardSet',
    kind: 'azpr-machine-axis-local-search-shard-set',
    planId: plan.planId,
    planHash: plan.planHash,
    shardCount: shards.length,
    assignedCandidateCount,
    boundedStopping: {
      maxShards: plan.budget.maxShards,
      maxCandidatesPerShard: perShard,
      unassignedCandidateCount:
        candidateSet.candidates.length - assignedCandidateCount,
      truncated:
        candidateSet.enumerationTruncated ||
        assignedCandidateCount < candidateSet.candidates.length,
    },
    shards,
  };
}

function createSeedCandidates({ plan, seed }) {
  const assignmentSets = [[]];
  const nonBaselineValues = seed.variables.map(variable =>
    variable.values.filter(
      value => !isBaselineValue(variable, value, seed.actions)
    )
  );
  const plannedSearchSpaceSize = countBoundedCombinations(
    nonBaselineValues,
    seed.maxChangedVariables
  );
  let enumerationTruncated = false;

  for (let depth = 1; depth <= seed.maxChangedVariables; depth += 1) {
    enumerateAssignments({
      variables: seed.variables,
      valuesByVariable: nonBaselineValues,
      depth,
      limit: seed.maxCandidates,
      output: assignmentSets,
    });
    if (assignmentSets.length >= seed.maxCandidates) {
      enumerationTruncated =
        BigInt(plannedSearchSpaceSize) > BigInt(assignmentSets.length);
      break;
    }
  }

  const byAxisHash = new Map();
  for (const assignments of assignmentSets.slice(0, seed.maxCandidates)) {
    const axis = applyAssignments({
      contractTemplate: plan.contractTemplate,
      seed,
      assignments,
    });
    const axisHash = hashCanonicalValue(axis);
    if (byAxisHash.has(axisHash)) continue;
    const candidateIdentity = {
      planHash: plan.planHash,
      seedId: seed.seedId,
      assignments,
      axisHash,
    };
    byAxisHash.set(axisHash, {
      candidateId: `${seed.seedId}-${hashCanonicalValue(
        candidateIdentity
      ).slice(0, 16)}`,
      seedId: seed.seedId,
      rationale: seed.rationale,
      assignments: structuredClone(assignments),
      mutationDepth: assignments.length,
      axisHash,
      axis,
    });
  }
  return {
    plannedSearchSpaceSize,
    enumerationTruncated,
    candidates: [...byAxisHash.values()],
  };
}

function enumerateAssignments({
  variables,
  valuesByVariable,
  depth,
  limit,
  output,
}) {
  function visit(variableIndex, remaining, current) {
    if (output.length >= limit) return;
    if (remaining === 0) {
      output.push(structuredClone(current));
      return;
    }
    for (
      let index = variableIndex;
      index <= variables.length - remaining;
      index += 1
    ) {
      for (const value of valuesByVariable[index]) {
        current.push({ variableId: variables[index].variableId, value });
        visit(index + 1, remaining - 1, current);
        current.pop();
        if (output.length >= limit) return;
      }
    }
  }
  visit(0, depth, []);
}

function applyAssignments({ contractTemplate, seed, assignments }) {
  const axis = {
    ...structuredClone(contractTemplate),
    scenario: {
      ...structuredClone(contractTemplate.scenario ?? {}),
      id: `${String(contractTemplate.scenario?.id ?? 'ai-local')}:${seed.seedId}`,
      name: `${String(
        contractTemplate.scenario?.name ?? 'AI local search'
      )} [${seed.seedId}]`,
    },
    actions: structuredClone(seed.actions),
    metadata: {
      ...structuredClone(contractTemplate.metadata ?? {}),
      aiCoarsePlan: {
        seedId: seed.seedId,
        assignments: structuredClone(assignments),
        formalAuthority: false,
      },
    },
  };
  const variableById = new Map(
    seed.variables.map(variable => [variable.variableId, variable])
  );
  for (const assignment of assignments) {
    const variable = variableById.get(assignment.variableId);
    if (!variable) continue;
    if (variable.kind === 'schedule-frame-offset') {
      applyScheduleFrameOffset(axis, variable, assignment.value);
    } else if (variable.kind === 'charging-release-frame') {
      applyChargingReleaseFrame(axis, variable, assignment.value);
    } else if (variable.kind === 'adjacent-frame-swap') {
      applyAdjacentFrameSwap(axis, variable, assignment.value);
    }
  }
  axis.metadata.aiCoarsePlan.assignments = structuredClone(assignments);
  return axis;
}

function applyScheduleFrameOffset(axis, variable, value) {
  const delta = Number(value);
  if (!Number.isInteger(delta) || delta === 0) return;
  const target = findAction(axis.actions, variable.actionId);
  if (!target) return;
  const targetFrame = Number(target.schedule?.frame);
  const affected =
    variable.cascade === 'suffix'
      ? axis.actions.filter(
          action =>
            action.schedule?.mode === 'absolute' &&
            Number(action.schedule?.frame) >= targetFrame
        )
      : [target];
  for (const action of affected) shiftActionFrames(action, delta);
}

function applyChargingReleaseFrame(axis, variable, value) {
  const action = findAction(axis.actions, variable.actionId);
  if (!action) return;
  action.intent ??= {};
  action.intent.semanticVariant ??= {};
  action.intent.semanticVariant.mode = 'release';
  action.intent.semanticVariant.inputFrame = Number(value);
}

function applyAdjacentFrameSwap(axis, variable, value) {
  if (value !== 'swap') return;
  const left = findAction(axis.actions, variable.leftActionId);
  const right = findAction(axis.actions, variable.rightActionId);
  if (!left || !right) return;
  const leftFrame = Number(left.schedule?.frame);
  const rightFrame = Number(right.schedule?.frame);
  shiftActionFrames(left, rightFrame - leftFrame);
  shiftActionFrames(right, leftFrame - rightFrame);
}

function shiftActionFrames(action, delta) {
  if (action.schedule?.mode === 'absolute') {
    action.schedule.frame = Math.max(0, Number(action.schedule.frame) + delta);
  }
  const physical = action.intent?.physicalInput;
  if (!physical) return;
  for (const field of ['releaseFrame', 'pressFrame', 'executionFrame']) {
    if (physical[field] == null) continue;
    physical[field] = Math.max(0, Number(physical[field]) + delta);
  }
}

function normalizeProvenance(value, issues) {
  const source = isRecord(value) ? value : {};
  const authority = textOrNull(source.authority);
  if (authority !== 'ai-authored-coarse-axis') {
    issues.push(
      issue(
        'coarse-plan-provenance-authority-invalid',
        'provenance.authority',
        'provenance.authority must be ai-authored-coarse-axis'
      )
    );
  }
  const model = textOrNull(source.model);
  if (!model) {
    issues.push(
      issue(
        'coarse-plan-provenance-model-required',
        'provenance.model',
        'provenance.model is required'
      )
    );
  }
  return {
    authority,
    model,
    promptHash: textOrNull(source.promptHash),
    createdAt: textOrNull(source.createdAt),
    note: textOrNull(source.note),
  };
}

function normalizeSeeds(value, issues) {
  const source = Array.isArray(value) ? value : [];
  if (source.length === 0) {
    issues.push(
      issue(
        'coarse-plan-seeds-required',
        'seeds',
        'at least one seed is required'
      )
    );
  }
  if (source.length > MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxSeeds) {
    issues.push(
      issue(
        'coarse-plan-seed-limit-exceeded',
        'seeds',
        `seed count exceeds ${MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxSeeds}`
      )
    );
  }
  const ids = new Set();
  return source
    .slice(0, MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxSeeds)
    .map((entry, seedIndex) => {
      const seed = isRecord(entry) ? entry : {};
      const path = `seeds.${seedIndex}`;
      const seedId = textOrNull(seed.seedId);
      if (!seedId || ids.has(seedId)) {
        issues.push(
          issue(
            'coarse-plan-seed-id-invalid',
            `${path}.seedId`,
            'seedId must be non-empty and unique'
          )
        );
      }
      ids.add(seedId);
      const actions = Array.isArray(seed.actions)
        ? structuredClone(seed.actions)
        : [];
      if (
        actions.length === 0 ||
        actions.length > MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxActionsPerSeed
      ) {
        issues.push(
          issue(
            'coarse-plan-seed-action-count-invalid',
            `${path}.actions`,
            `seed actions must contain 1..${MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxActionsPerSeed} entries`
          )
        );
      }
      const actionIds = new Set(
        actions.map(action => textOrNull(action?.id)).filter(Boolean)
      );
      if (actionIds.size !== actions.length) {
        issues.push(
          issue(
            'coarse-plan-seed-action-id-invalid',
            `${path}.actions`,
            'every seed action must have a unique id'
          )
        );
      }
      const variables = normalizeVariables(
        seed.variables,
        actionIds,
        path,
        issues
      );
      return {
        seedId,
        rationale: textOrNull(seed.rationale),
        actions,
        variables,
        maxChangedVariables: boundedOrDefault(
          seed.maxChangedVariables,
          0,
          MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxMutationDepth,
          Math.min(1, variables.length),
          issues,
          `${path}.maxChangedVariables`
        ),
        maxCandidates: boundedOrDefault(
          seed.maxCandidates,
          1,
          MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxCandidatesPerSeed,
          64,
          issues,
          `${path}.maxCandidates`
        ),
      };
    });
}

function normalizeVariables(value, actionIds, seedPath, issues) {
  const source = Array.isArray(value) ? value : [];
  if (source.length > MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxVariablesPerSeed) {
    issues.push(
      issue(
        'coarse-plan-variable-limit-exceeded',
        `${seedPath}.variables`,
        `variable count exceeds ${MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxVariablesPerSeed}`
      )
    );
  }
  const ids = new Set();
  return source
    .slice(0, MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxVariablesPerSeed)
    .map((entry, variableIndex) => {
      const variable = isRecord(entry) ? entry : {};
      const path = `${seedPath}.variables.${variableIndex}`;
      const variableId = textOrNull(variable.variableId);
      const kind = textOrNull(variable.kind);
      if (!variableId || ids.has(variableId)) {
        issues.push(
          issue(
            'coarse-plan-variable-id-invalid',
            `${path}.variableId`,
            'variableId must be non-empty and unique within the seed'
          )
        );
      }
      ids.add(variableId);
      if (!VARIABLE_KINDS.has(kind)) {
        issues.push(
          issue(
            'coarse-plan-variable-kind-unsupported',
            `${path}.kind`,
            `unsupported local variable kind: ${String(kind)}`
          )
        );
      }
      if (kind === 'adjacent-frame-swap') {
        const leftActionId = textOrNull(variable.leftActionId);
        const rightActionId = textOrNull(variable.rightActionId);
        const leftIndex = [...actionIds].indexOf(leftActionId);
        const rightIndex = [...actionIds].indexOf(rightActionId);
        if (
          !actionIds.has(leftActionId) ||
          !actionIds.has(rightActionId) ||
          leftActionId === rightActionId ||
          Math.abs(leftIndex - rightIndex) !== 1
        ) {
          issues.push(
            issue(
              'coarse-plan-variable-action-reference-invalid',
              path,
              'adjacent-frame-swap must reference two adjacent, distinct seed actions'
            )
          );
        }
        return {
          variableId,
          kind,
          leftActionId,
          rightActionId,
          values: ['keep', 'swap'],
        };
      }
      const actionId = textOrNull(variable.actionId);
      if (!actionIds.has(actionId)) {
        issues.push(
          issue(
            'coarse-plan-variable-action-reference-invalid',
            `${path}.actionId`,
            `unknown seed action: ${String(actionId)}`
          )
        );
      }
      const rawValues = Array.isArray(variable.values) ? variable.values : [];
      const values = [...new Set(rawValues.map(Number))].filter(number =>
        kind === 'schedule-frame-offset'
          ? Number.isInteger(number) && number >= -30 && number <= 30
          : Number.isInteger(number) && number >= 0 && number <= 10_000
      );
      values.sort((left, right) => left - right);
      if (
        values.length === 0 ||
        values.length > MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxValuesPerVariable
      ) {
        issues.push(
          issue(
            'coarse-plan-variable-values-invalid',
            `${path}.values`,
            `values must contain 1..${MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxValuesPerVariable} bounded entries`
          )
        );
      }
      return {
        variableId,
        kind,
        actionId,
        values,
        ...(kind === 'schedule-frame-offset'
          ? {
              cascade: variable.cascade === 'suffix' ? 'suffix' : 'single',
            }
          : {}),
      };
    });
}

function normalizeBudget(value, issues) {
  const source = isRecord(value) ? value : {};
  const perShard = isRecord(source.perShard) ? source.perShard : {};
  const budget = {
    maxCandidatesTotal: boundedOrDefault(
      source.maxCandidatesTotal,
      1,
      MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxCandidatesTotal,
      DEFAULT_BUDGET.maxCandidatesTotal,
      issues,
      'budget.maxCandidatesTotal'
    ),
    maxShards: boundedOrDefault(
      source.maxShards,
      1,
      MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxShards,
      DEFAULT_BUDGET.maxShards,
      issues,
      'budget.maxShards'
    ),
    maxWallTimeMs: boundedOrDefault(
      source.maxWallTimeMs,
      1_000,
      MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxWallTimeMsTotal,
      DEFAULT_BUDGET.maxWallTimeMs,
      issues,
      'budget.maxWallTimeMs'
    ),
    perShard: {
      maxCandidates: boundedOrDefault(
        perShard.maxCandidates,
        1,
        MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxCandidatesPerShard,
        DEFAULT_BUDGET.perShard.maxCandidates,
        issues,
        'budget.perShard.maxCandidates'
      ),
      maxEvaluations: boundedOrDefault(
        perShard.maxEvaluations,
        1,
        MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxCandidatesPerShard,
        DEFAULT_BUDGET.perShard.maxEvaluations,
        issues,
        'budget.perShard.maxEvaluations'
      ),
      maxSimulations: boundedOrDefault(
        perShard.maxSimulations,
        1,
        MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxSimulationsPerShard,
        DEFAULT_BUDGET.perShard.maxSimulations,
        issues,
        'budget.perShard.maxSimulations'
      ),
      maxWallTimeMs: boundedOrDefault(
        perShard.maxWallTimeMs,
        1_000,
        MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxWallTimeMsPerShard,
        DEFAULT_BUDGET.perShard.maxWallTimeMs,
        issues,
        'budget.perShard.maxWallTimeMs'
      ),
    },
  };
  if (
    perShard.maxEvaluations == null &&
    budget.perShard.maxEvaluations > budget.perShard.maxCandidates
  ) {
    budget.perShard.maxEvaluations = budget.perShard.maxCandidates;
  }
  if (budget.perShard.maxEvaluations > budget.perShard.maxCandidates) {
    issues.push(
      issue(
        'coarse-plan-shard-evaluation-budget-invalid',
        'budget.perShard.maxEvaluations',
        'maxEvaluations cannot exceed maxCandidates'
      )
    );
  }
  return budget;
}

function normalizeParallelism(value, issues) {
  const source = isRecord(value) ? value : {};
  const workers = boundedOrDefault(
    source.workers,
    1,
    MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxWorkers,
    DEFAULT_PARALLELISM.workers,
    issues,
    'parallelism.workers'
  );
  const memoryMbPerWorker = boundedOrDefault(
    source.memoryMbPerWorker,
    512,
    MACHINE_AXIS_LOCAL_SEARCH_LIMITS.maxMemoryMbPerWorker,
    DEFAULT_PARALLELISM.memoryMbPerWorker,
    issues,
    'parallelism.memoryMbPerWorker'
  );
  if (workers * memoryMbPerWorker > 16_384) {
    issues.push(
      issue(
        'coarse-plan-parallel-memory-budget-exceeded',
        'parallelism',
        'workers * memoryMbPerWorker must not exceed 16384 MB'
      )
    );
  }
  return { workers, memoryMbPerWorker };
}

function countBoundedCombinations(valuesByVariable, maxDepth) {
  let total = 1n;
  function visit(index, remaining, product) {
    if (remaining === 0) {
      total += product;
      return;
    }
    for (
      let variableIndex = index;
      variableIndex <= valuesByVariable.length - remaining;
      variableIndex += 1
    ) {
      visit(
        variableIndex + 1,
        remaining - 1,
        product * BigInt(valuesByVariable[variableIndex].length)
      );
    }
  }
  for (let depth = 1; depth <= maxDepth; depth += 1) {
    visit(0, depth, 1n);
  }
  return total.toString();
}

function isBaselineValue(variable, value, actions) {
  if (variable.kind === 'schedule-frame-offset') return Number(value) === 0;
  if (variable.kind === 'adjacent-frame-swap') return value === 'keep';
  if (variable.kind === 'charging-release-frame') {
    const action = findAction(actions, variable.actionId);
    return (
      Number(value) === Number(action?.intent?.semanticVariant?.inputFrame)
    );
  }
  return false;
}

function findAction(actions, actionId) {
  return (actions ?? []).find(action => String(action.id) === String(actionId));
}

function issue(code, path, message, details = {}) {
  return { code, path, message, ...details };
}

function boundedInteger(value, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function boundedOrDefault(value, minimum, maximum, fallback, issues, path) {
  if (value == null) return fallback;
  const normalized = boundedInteger(value, minimum, maximum);
  if (normalized != null) return normalized;
  issues.push(
    issue(
      'coarse-plan-bounded-integer-invalid',
      path,
      `${path} must be an integer in [${minimum}, ${maximum}]`,
      { actual: value, minimum, maximum }
    )
  );
  return fallback;
}

function textOrNull(value) {
  const text = value == null ? '' : String(value).trim();
  return text || null;
}

function isRecord(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}
