import { getInstalledVerifiedCombatMechanicsPackage } from '../data/verifiedCombatMechanicsPackage';
import { getOptimizationQualificationCatalog } from '../optimization-qualification/optimizationQualificationProtocol';
import {
  createM12cBuildEnumerationPlan,
  createM12cOuterBuildPool,
  iterateM12cBuildCandidates,
} from './m12cOuterBuildPool';

export const M12C_OUTER_BUILD_SERVICE_SCHEMA_VERSION = 1;
export const M12C_OUTER_BUILD_SERVICE_CONTRACT_NAME =
  'AzPrM12COuterBuildService';

export class M12cOuterBuildServiceError extends Error {
  constructor(message, issues = []) {
    super(message);
    this.name = 'M12cOuterBuildServiceError';
    this.issues = [...issues];
  }
}

export function createM12cOuterBuildService({
  qualification = getOptimizationQualificationCatalog(),
  getMechanicsPackage = getInstalledVerifiedCombatMechanicsPackage,
} = {}) {
  function pool() {
    const mechanicsPackage = getMechanicsPackage();
    if (!mechanicsPackage) {
      throw new M12cOuterBuildServiceError(
        'Verified combat mechanics package is not installed',
        ['machine-axis-mechanics-package-not-installed']
      );
    }
    const value = createM12cOuterBuildPool({ qualification });
    if (
      value.authority.verifiedMechanicsPackageHash !==
      mechanicsPackage.packageHash
    ) {
      throw new M12cOuterBuildServiceError(
        'M12-C outer build authority does not match the installed mechanics package',
        ['machine-axis-m12c-mechanics-package-authority-mismatch']
      );
    }
    return value;
  }

  function plan(input) {
    return createM12cBuildEnumerationPlan(input, { pool: pool() });
  }

  function iterate(planValue, options = {}) {
    return iterateM12cBuildCandidates(planValue, {
      pool: pool(),
      maxCandidates: options.maxCandidates,
      shouldPrune: options.shouldPrune,
    });
  }

  return Object.freeze({
    schemaVersion: M12C_OUTER_BUILD_SERVICE_SCHEMA_VERSION,
    contractName: M12C_OUTER_BUILD_SERVICE_CONTRACT_NAME,
    pool,
    plan,
    iterate,
  });
}
