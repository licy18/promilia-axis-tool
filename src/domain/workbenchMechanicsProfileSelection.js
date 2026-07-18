export const WORKBENCH_MECHANICS_PROFILE_SELECTION_CONTRACT_NAME =
  'AzPrWorkbenchMechanicsProfileSelection';
export const WORKBENCH_MECHANICS_PROFILE_SELECTION_SCHEMA_VERSION = 1;
export const DEFAULT_WORKBENCH_MECHANICS_PROFILE_ID =
  'azpr-three-value-preview-v1';
export const DEFAULT_WORKBENCH_MECHANICS_PROFILE_VERSION = 1;
export const VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID =
  'azpr-three-value-verified-tc-20260718';
export const VERIFIED_WORKBENCH_MECHANICS_PROFILE_VERSION = 1;

export function createVerifiedWorkbenchMechanicsProfileSelection() {
  return normalizeWorkbenchMechanicsProfileSelection({
    profileId: VERIFIED_WORKBENCH_MECHANICS_PROFILE_ID,
    profileVersion: VERIFIED_WORKBENCH_MECHANICS_PROFILE_VERSION,
  });
}

export function normalizeWorkbenchMechanicsProfileSelection(value = {}) {
  const profileId = String(value?.profileId ?? '').trim();
  const profileVersion = Number(value?.profileVersion);
  return {
    schemaVersion: WORKBENCH_MECHANICS_PROFILE_SELECTION_SCHEMA_VERSION,
    contractName: WORKBENCH_MECHANICS_PROFILE_SELECTION_CONTRACT_NAME,
    profileId: profileId || DEFAULT_WORKBENCH_MECHANICS_PROFILE_ID,
    profileVersion:
      Number.isInteger(profileVersion) && profileVersion > 0
        ? profileVersion
        : DEFAULT_WORKBENCH_MECHANICS_PROFILE_VERSION,
  };
}
