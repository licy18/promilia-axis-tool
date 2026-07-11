export const WORKBENCH_SCENARIO_WORKSPACE_SCHEMA_VERSION = 1;
export const MAX_WORKBENCH_SCENARIOS = 14;
export const DEFAULT_WORKBENCH_SCENARIO_ID = 'scenario-0001';
export const DEFAULT_WORKBENCH_SCENARIO_NAME = '方案 1';

export function createDefaultWorkbenchScenarioWorkspace(activeDraft) {
  return {
    schemaVersion: WORKBENCH_SCENARIO_WORKSPACE_SCHEMA_VERSION,
    activeScenarioId: DEFAULT_WORKBENCH_SCENARIO_ID,
    scenarios: [
      createWorkbenchScenarioRecord({
        id: DEFAULT_WORKBENCH_SCENARIO_ID,
        name: DEFAULT_WORKBENCH_SCENARIO_NAME,
        draft: activeDraft,
      }),
    ],
  };
}

export function normalizeWorkbenchScenarioWorkspace(
  workspace,
  activeDraft,
  normalizeDraft = cloneScenarioDraft
) {
  const sourceScenarios = Array.isArray(workspace?.scenarios)
    ? workspace.scenarios
    : [];
  const usedIds = new Set();
  const scenarios = sourceScenarios
    .slice(0, MAX_WORKBENCH_SCENARIOS)
    .map((scenario, index) => {
      const requestedId = normalizeText(scenario?.id);
      const id =
        requestedId && !usedIds.has(requestedId)
          ? requestedId
          : createNextWorkbenchScenarioId(usedIds);
      usedIds.add(id);
      return createWorkbenchScenarioRecord({
        id,
        name:
          normalizeWorkbenchScenarioName(scenario?.name) ?? `方案 ${index + 1}`,
        draft: normalizeDraft(scenario?.draft ?? scenario?.data ?? activeDraft),
      });
    });

  if (scenarios.length === 0) {
    return createDefaultWorkbenchScenarioWorkspace(normalizeDraft(activeDraft));
  }

  const requestedActiveScenarioId = normalizeText(workspace?.activeScenarioId);
  const activeScenarioId = scenarios.some(
    scenario => scenario.id === requestedActiveScenarioId
  )
    ? requestedActiveScenarioId
    : scenarios[0].id;
  const normalizedActiveDraft = normalizeDraft(activeDraft);

  return {
    schemaVersion: WORKBENCH_SCENARIO_WORKSPACE_SCHEMA_VERSION,
    activeScenarioId,
    scenarios: scenarios.map(scenario =>
      scenario.id === activeScenarioId
        ? { ...scenario, draft: cloneScenarioDraft(normalizedActiveDraft) }
        : scenario
    ),
  };
}

export function synchronizeActiveWorkbenchScenario(workspace, activeDraft) {
  const activeScenarioId = workspace?.activeScenarioId;
  if (!Array.isArray(workspace?.scenarios) || !activeScenarioId) {
    return createDefaultWorkbenchScenarioWorkspace(activeDraft);
  }
  return {
    schemaVersion: WORKBENCH_SCENARIO_WORKSPACE_SCHEMA_VERSION,
    activeScenarioId,
    scenarios: workspace.scenarios.map(scenario =>
      scenario.id === activeScenarioId
        ? { ...scenario, draft: cloneScenarioDraft(activeDraft) }
        : createWorkbenchScenarioRecord(scenario)
    ),
  };
}

export function switchWorkbenchScenario(
  workspace,
  targetScenarioId,
  currentDraft
) {
  const synchronized = synchronizeActiveWorkbenchScenario(
    workspace,
    currentDraft
  );
  const targetScenario = synchronized.scenarios.find(
    scenario => scenario.id === targetScenarioId
  );
  if (!targetScenario || targetScenario.id === synchronized.activeScenarioId) {
    return createWorkspaceMutationResult(synchronized, null, false);
  }
  const nextWorkspace = {
    ...synchronized,
    activeScenarioId: targetScenario.id,
  };
  return createWorkspaceMutationResult(nextWorkspace, targetScenario, true);
}

export function addWorkbenchScenario(workspace, currentDraft, emptyDraft) {
  const synchronized = synchronizeActiveWorkbenchScenario(
    workspace,
    currentDraft
  );
  if (synchronized.scenarios.length >= MAX_WORKBENCH_SCENARIOS) {
    return createWorkspaceMutationResult(
      synchronized,
      null,
      false,
      'scenario-limit-reached'
    );
  }
  const usedIds = new Set(synchronized.scenarios.map(scenario => scenario.id));
  const scenario = createWorkbenchScenarioRecord({
    id: createNextWorkbenchScenarioId(usedIds),
    name: `方案 ${synchronized.scenarios.length + 1}`,
    draft: emptyDraft,
  });
  return createWorkspaceMutationResult(
    {
      ...synchronized,
      activeScenarioId: scenario.id,
      scenarios: [...synchronized.scenarios, scenario],
    },
    scenario,
    true
  );
}

export function addWorkbenchScenarioFromDraft(
  workspace,
  currentDraft,
  nextDraft,
  name
) {
  const synchronized = synchronizeActiveWorkbenchScenario(
    workspace,
    currentDraft
  );
  if (synchronized.scenarios.length >= MAX_WORKBENCH_SCENARIOS) {
    return createWorkspaceMutationResult(
      synchronized,
      null,
      false,
      'scenario-limit-reached'
    );
  }
  const usedIds = new Set(synchronized.scenarios.map(scenario => scenario.id));
  const scenario = createWorkbenchScenarioRecord({
    id: createNextWorkbenchScenarioId(usedIds),
    name:
      normalizeWorkbenchScenarioName(name) ??
      `方案 ${synchronized.scenarios.length + 1}`,
    draft: nextDraft,
  });
  return createWorkspaceMutationResult(
    {
      ...synchronized,
      activeScenarioId: scenario.id,
      scenarios: [...synchronized.scenarios, scenario],
    },
    scenario,
    true
  );
}

export function duplicateWorkbenchScenario(
  workspace,
  sourceScenarioId,
  currentDraft
) {
  const synchronized = synchronizeActiveWorkbenchScenario(
    workspace,
    currentDraft
  );
  if (synchronized.scenarios.length >= MAX_WORKBENCH_SCENARIOS) {
    return createWorkspaceMutationResult(
      synchronized,
      null,
      false,
      'scenario-limit-reached'
    );
  }
  const sourceScenario = synchronized.scenarios.find(
    scenario => scenario.id === sourceScenarioId
  );
  if (!sourceScenario) {
    return createWorkspaceMutationResult(
      synchronized,
      null,
      false,
      'scenario-not-found'
    );
  }
  const usedIds = new Set(synchronized.scenarios.map(scenario => scenario.id));
  const scenario = createWorkbenchScenarioRecord({
    id: createNextWorkbenchScenarioId(usedIds),
    name: `${sourceScenario.name} 副本`,
    draft: sourceScenario.draft,
  });
  return createWorkspaceMutationResult(
    {
      ...synchronized,
      activeScenarioId: scenario.id,
      scenarios: [...synchronized.scenarios, scenario],
    },
    scenario,
    true
  );
}

export function renameWorkbenchScenario(workspace, scenarioId, name) {
  const normalizedName = normalizeWorkbenchScenarioName(name);
  const sourceScenario = workspace?.scenarios?.find(
    scenario => scenario.id === scenarioId
  );
  if (
    !sourceScenario ||
    !normalizedName ||
    sourceScenario.name === normalizedName
  ) {
    return createWorkspaceMutationResult(workspace, sourceScenario, false);
  }
  const scenarios = workspace.scenarios.map(scenario =>
    scenario.id === scenarioId
      ? { ...scenario, name: normalizedName }
      : scenario
  );
  return createWorkspaceMutationResult(
    { ...workspace, scenarios },
    scenarios.find(scenario => scenario.id === scenarioId),
    true
  );
}

export function deleteWorkbenchScenario(workspace, scenarioId, currentDraft) {
  const synchronized = synchronizeActiveWorkbenchScenario(
    workspace,
    currentDraft
  );
  if (synchronized.scenarios.length <= 1) {
    return createWorkspaceMutationResult(
      synchronized,
      null,
      false,
      'last-scenario'
    );
  }
  const deletedIndex = synchronized.scenarios.findIndex(
    scenario => scenario.id === scenarioId
  );
  if (deletedIndex < 0) {
    return createWorkspaceMutationResult(
      synchronized,
      null,
      false,
      'scenario-not-found'
    );
  }
  const scenarios = synchronized.scenarios.filter(
    scenario => scenario.id !== scenarioId
  );
  const activeScenarioId =
    synchronized.activeScenarioId === scenarioId
      ? (scenarios[Math.max(0, deletedIndex - 1)]?.id ?? scenarios[0].id)
      : synchronized.activeScenarioId;
  const activeScenario = scenarios.find(
    scenario => scenario.id === activeScenarioId
  );
  return createWorkspaceMutationResult(
    {
      ...synchronized,
      activeScenarioId,
      scenarios,
    },
    activeScenario,
    true
  );
}

export function getActiveWorkbenchScenario(workspace) {
  return (
    workspace?.scenarios?.find(
      scenario => scenario.id === workspace.activeScenarioId
    ) ??
    workspace?.scenarios?.[0] ??
    null
  );
}

export function createNextWorkbenchScenarioId(usedScenarioIds) {
  const usedIds = usedScenarioIds ?? new Set();
  const maximum = [...usedIds].reduce((current, scenarioId) => {
    const match = String(scenarioId).match(/^scenario-(\d+)$/u);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  let index = maximum + 1;
  let id = `scenario-${String(index).padStart(4, '0')}`;
  while (usedIds.has(id)) {
    index += 1;
    id = `scenario-${String(index).padStart(4, '0')}`;
  }
  return id;
}

function createWorkbenchScenarioRecord({ id, name, draft } = {}) {
  return {
    id: normalizeText(id) ?? DEFAULT_WORKBENCH_SCENARIO_ID,
    name:
      normalizeWorkbenchScenarioName(name) ?? DEFAULT_WORKBENCH_SCENARIO_NAME,
    draft: cloneScenarioDraft(draft),
  };
}

function createWorkspaceMutationResult(
  workspace,
  scenario,
  changed,
  reason = ''
) {
  return { workspace, scenario, changed, reason };
}

function normalizeWorkbenchScenarioName(value) {
  return normalizeText(value)?.slice(0, 48) ?? null;
}

function cloneScenarioDraft(value) {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return JSON.parse(JSON.stringify(value));
}

function normalizeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}
