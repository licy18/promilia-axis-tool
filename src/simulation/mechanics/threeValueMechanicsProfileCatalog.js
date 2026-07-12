import { normalizeWorkbenchMechanicsProfileSelection } from '../../domain/workbenchMechanicsProfileSelection';
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE,
  resolveThreeValueMechanicsProfileSelection,
  validateThreeValueMechanicsProfile,
} from './threeValueMechanicsProfile';

export const THREE_VALUE_MECHANICS_PROFILE_CATALOG_CONTRACT_NAME =
  'AzPrThreeValueMechanicsProfileCatalog';
export const THREE_VALUE_MECHANICS_PROFILE_CATALOG_CONTRACT_VERSION = 1;
export const WORKBENCH_PROFILE_COMPATIBILITY_REPORT_CONTRACT_NAME =
  'AzPrWorkbenchProfileCompatibilityReport';

export const DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG =
  createThreeValueMechanicsProfileCatalog();

export function createThreeValueMechanicsProfileCatalog({
  catalogId = 'azpr-production-profile-catalog',
  catalogVersion = 1,
  profiles = [DEFAULT_THREE_VALUE_MECHANICS_PROFILE],
  defaultSelection,
} = {}) {
  const entries = [];
  const issues = [];
  const usedKeys = new Set();
  for (const profile of Array.isArray(profiles) ? profiles : []) {
    const validation = validateThreeValueMechanicsProfile(profile);
    const key = createProfileKey(profile?.profileId, profile?.profileVersion);
    if (usedKeys.has(key)) issues.push(`profile-duplicate:${key}`);
    usedKeys.add(key);
    if (!validation.valid) issues.push(`profile-invalid:${key}`);
    entries.push({
      key,
      profileId: profile?.profileId ?? null,
      profileVersion: Number(profile?.profileVersion) || null,
      sourceKind: profile?.sourceKind ?? null,
      valid: validation.valid,
      validationStatus: validation.status,
      validationIssues: validation.issues,
      profile,
    });
  }
  const normalizedDefaultSelection =
    normalizeWorkbenchMechanicsProfileSelection(defaultSelection);
  const defaultEntry = entries.find(
    entry =>
      entry.profileId === normalizedDefaultSelection.profileId &&
      entry.profileVersion === normalizedDefaultSelection.profileVersion &&
      entry.valid
  );
  if (!defaultEntry) issues.push('default-profile-missing');
  const ready = issues.length === 0;
  return {
    schemaVersion: 1,
    contractName: THREE_VALUE_MECHANICS_PROFILE_CATALOG_CONTRACT_NAME,
    contractVersion: THREE_VALUE_MECHANICS_PROFILE_CATALOG_CONTRACT_VERSION,
    catalogId,
    catalogVersion,
    status: ready
      ? 'mechanics-profile-catalog-ready'
      : 'mechanics-profile-catalog-invalid',
    ready,
    defaultSelection: normalizedDefaultSelection,
    entries,
    profiles: entries.filter(entry => entry.valid).map(entry => entry.profile),
    issues,
    summary: {
      profileCount: entries.length,
      validProfileCount: entries.filter(entry => entry.valid).length,
      invalidProfileCount: entries.filter(entry => !entry.valid).length,
      issueCount: issues.length,
    },
  };
}

export function resolveThreeValueMechanicsProfileCatalogSelection(
  catalog,
  selection
) {
  const activeCatalog =
    catalog ?? DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG;
  const normalizedSelection =
    normalizeWorkbenchMechanicsProfileSelection(selection);
  const selectionShapeValid = isMechanicsProfileSelectionShapeValid(selection);
  const matchingIdEntries = activeCatalog.entries.filter(
    entry => entry.profileId === normalizedSelection.profileId
  );
  const exactEntry = matchingIdEntries.find(
    entry => entry.profileVersion === normalizedSelection.profileVersion
  );
  const issueKind = !activeCatalog.ready
    ? 'invalid'
    : !selectionShapeValid
      ? 'invalid'
      : matchingIdEntries.length === 0
        ? 'missing'
        : !exactEntry?.valid
          ? 'invalid'
          : null;
  const profileResolution = resolveThreeValueMechanicsProfileSelection(
    normalizedSelection,
    activeCatalog.profiles
  );
  const resolutionStatus = profileResolution.fallback ? 'fallback' : 'exact';
  return {
    status: issueKind ?? resolutionStatus,
    resolutionStatus,
    issueKind,
    compatible: issueKind == null && resolutionStatus === 'exact',
    requestedProfileId: normalizedSelection.profileId,
    requestedProfileVersion: normalizedSelection.profileVersion,
    resolvedProfileId: profileResolution.profile.profileId,
    resolvedProfileVersion: profileResolution.profile.profileVersion,
    fallback: profileResolution.fallback,
    fallbackReason: profileResolution.fallbackReason,
    catalogId: activeCatalog.catalogId,
    catalogVersion: activeCatalog.catalogVersion,
    catalogReady: activeCatalog.ready,
    profileResolution,
  };
}

export function createWorkbenchProfileCompatibilityReport(
  draft,
  catalog = DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG
) {
  const scenarios = resolveWorkbenchProfileScenarios(draft);
  const scenarioResults = scenarios.map(scenario => {
    const resolution = resolveThreeValueMechanicsProfileCatalogSelection(
      catalog,
      scenario.draft?.mechanicsProfileSelection
    );
    return {
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      status: resolution.status,
      resolutionStatus: resolution.resolutionStatus,
      issueKind: resolution.issueKind,
      compatible: resolution.compatible,
      requestedProfileId: resolution.requestedProfileId,
      requestedProfileVersion: resolution.requestedProfileVersion,
      resolvedProfileId: resolution.resolvedProfileId,
      resolvedProfileVersion: resolution.resolvedProfileVersion,
      fallback: resolution.fallback,
      fallbackReason: resolution.fallbackReason,
    };
  });
  const exactCount = scenarioResults.filter(
    row => row.status === 'exact'
  ).length;
  const fallbackCount = scenarioResults.filter(
    row => row.resolutionStatus === 'fallback'
  ).length;
  const missingCount = scenarioResults.filter(
    row => row.status === 'missing'
  ).length;
  const invalidCount = scenarioResults.filter(
    row => row.status === 'invalid'
  ).length;
  const importAllowed = Boolean(
    catalog?.ready &&
    scenarioResults.length > 0 &&
    scenarioResults.every(row => row.compatible)
  );
  return {
    schemaVersion: 1,
    contractName: WORKBENCH_PROFILE_COMPATIBILITY_REPORT_CONTRACT_NAME,
    status: importAllowed
      ? 'workbench-profile-compatibility-exact'
      : invalidCount > 0
        ? 'workbench-profile-compatibility-invalid'
        : missingCount > 0
          ? 'workbench-profile-compatibility-missing'
          : 'workbench-profile-compatibility-fallback',
    compatible: importAllowed,
    importAllowed,
    catalog: {
      catalogId: catalog?.catalogId ?? null,
      catalogVersion: catalog?.catalogVersion ?? null,
      ready: catalog?.ready === true,
    },
    scenarios: scenarioResults,
    summary: {
      scenarioCount: scenarioResults.length,
      exactCount,
      fallbackCount,
      missingCount,
      invalidCount,
    },
  };
}

function resolveWorkbenchProfileScenarios(draft = {}) {
  const workspaceScenarios = draft?.scenarioWorkspace?.scenarios;
  if (Array.isArray(workspaceScenarios) && workspaceScenarios.length > 0) {
    return workspaceScenarios.map((scenario, index) => ({
      id: scenario?.id ?? `scenario-${index + 1}`,
      name: scenario?.name ?? `方案 ${index + 1}`,
      draft: scenario?.draft ?? {},
    }));
  }
  return [{ id: 'scenario-0001', name: '方案 1', draft }];
}

function isMechanicsProfileSelectionShapeValid(selection) {
  if (selection == null) return true;
  const profileId = String(selection?.profileId ?? '').trim();
  const profileVersion = Number(selection?.profileVersion);
  return Boolean(
    profileId && Number.isInteger(profileVersion) && profileVersion > 0
  );
}

function createProfileKey(profileId, profileVersion) {
  return `${String(profileId ?? 'missing')}@${Number(profileVersion) || 0}`;
}
