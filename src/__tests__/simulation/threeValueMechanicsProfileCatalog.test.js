import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WORKBENCH_SELECTION,
  createWorkbenchProject,
  getWorkbenchGameData,
} from '../../domain/workbenchProjectFactory';
import { compileProject } from '../../simulation/compiler/compileProject';
import { DEFAULT_THREE_VALUE_MECHANICS_PROFILE } from '../../simulation/mechanics/threeValueMechanicsProfile';
import {
  DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
  createThreeValueMechanicsProfileCatalog,
  createWorkbenchProfileCompatibilityReport,
  resolveThreeValueMechanicsProfileCatalogSelection,
} from '../../simulation/mechanics/threeValueMechanicsProfileCatalog';

describe('three value mechanics profile catalog', () => {
  it('exposes the built-in production profile as an exact trusted selection', () => {
    const resolution = resolveThreeValueMechanicsProfileCatalogSelection(
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
      {
        profileId: 'azpr-three-value-preview-v1',
        profileVersion: 1,
      }
    );

    expect(DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG).toMatchObject({
      contractName: 'AzPrThreeValueMechanicsProfileCatalog',
      contractVersion: 1,
      catalogId: 'azpr-production-profile-catalog',
      status: 'mechanics-profile-catalog-ready',
      ready: true,
      summary: {
        profileCount: 1,
        validProfileCount: 1,
        invalidProfileCount: 0,
        issueCount: 0,
      },
    });
    expect(resolution).toMatchObject({
      status: 'exact',
      resolutionStatus: 'exact',
      issueKind: null,
      compatible: true,
      requestedProfileId: 'azpr-three-value-preview-v1',
      resolvedProfileId: 'azpr-three-value-preview-v1',
      fallback: false,
    });
  });

  it('distinguishes missing and invalid selections while describing fallback', () => {
    const missing = resolveThreeValueMechanicsProfileCatalogSelection(
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
      { profileId: 'missing-profile', profileVersion: 1 }
    );
    const invalid = resolveThreeValueMechanicsProfileCatalogSelection(
      DEFAULT_THREE_VALUE_MECHANICS_PROFILE_CATALOG,
      { profileId: 'azpr-three-value-preview-v1', profileVersion: 99 }
    );

    expect(missing).toMatchObject({
      status: 'missing',
      resolutionStatus: 'fallback',
      issueKind: 'missing',
      compatible: false,
      resolvedProfileId: 'azpr-three-value-preview-v1',
      fallback: true,
      fallbackReason: 'mechanics-profile-not-registered',
    });
    expect(invalid).toMatchObject({
      status: 'invalid',
      resolutionStatus: 'fallback',
      issueKind: 'invalid',
      compatible: false,
      resolvedProfileId: 'azpr-three-value-preview-v1',
      fallback: true,
    });
  });

  it('reports every scenario and disallows imports that would change binding', () => {
    const report = createWorkbenchProfileCompatibilityReport({
      scenarioWorkspace: {
        activeScenarioId: 'scenario-exact',
        scenarios: [
          {
            id: 'scenario-exact',
            name: '精确方案',
            draft: {
              mechanicsProfileSelection: {
                profileId: 'azpr-three-value-preview-v1',
                profileVersion: 1,
              },
            },
          },
          {
            id: 'scenario-missing',
            name: '缺失方案',
            draft: {
              mechanicsProfileSelection: {
                profileId: 'missing-profile',
                profileVersion: 2,
              },
            },
          },
        ],
      },
    });

    expect(report).toMatchObject({
      contractName: 'AzPrWorkbenchProfileCompatibilityReport',
      status: 'workbench-profile-compatibility-missing',
      compatible: false,
      importAllowed: false,
      scenarios: [
        expect.objectContaining({
          scenarioId: 'scenario-exact',
          status: 'exact',
          resolutionStatus: 'exact',
        }),
        expect.objectContaining({
          scenarioId: 'scenario-missing',
          status: 'missing',
          resolutionStatus: 'fallback',
        }),
      ],
      summary: {
        scenarioCount: 2,
        exactCount: 1,
        fallbackCount: 1,
        missingCount: 1,
        invalidCount: 0,
      },
    });
  });

  it('binds the production catalog result into Scenario and runtime configuration', () => {
    const report = createWorkbenchProfileCompatibilityReport({
      mechanicsProfileSelection: {
        profileId: 'azpr-three-value-preview-v1',
        profileVersion: 1,
      },
    });
    const project = createWorkbenchProject(DEFAULT_WORKBENCH_SELECTION, {
      mechanicsProfileCompatibilityReport: report,
    });
    const scenario = compileProject(project, getWorkbenchGameData());

    expect(scenario.sourceProject.metadata).toMatchObject({
      mechanicsProfileCompatibilityReport: {
        status: 'workbench-profile-compatibility-exact',
        importAllowed: true,
      },
    });
    expect(scenario).toMatchObject({
      mechanicsProfileCatalog: {
        contractName: 'AzPrThreeValueMechanicsProfileCatalog',
        catalogId: 'azpr-production-profile-catalog',
        status: 'mechanics-profile-catalog-ready',
        ready: true,
        profileCount: 1,
      },
      mechanicsProfileCompatibility: {
        status: 'exact',
        resolutionStatus: 'exact',
        issueKind: null,
        compatible: true,
      },
      mechanismConfiguration: {
        runtimeBinding: {
          mechanicsProfile: {
            requestedProfileId: 'azpr-three-value-preview-v1',
            profileId: 'azpr-three-value-preview-v1',
            compatibilityStatus: 'exact',
            resolutionStatus: 'exact',
            catalogId: 'azpr-production-profile-catalog',
            catalogVersion: 1,
          },
        },
      },
    });
  });

  it('keeps invalid profiles outside the executable catalog profile list', () => {
    const invalidProfile = JSON.parse(
      JSON.stringify(DEFAULT_THREE_VALUE_MECHANICS_PROFILE)
    );
    invalidProfile.profileId = 'invalid-profile';
    invalidProfile.contractName = 'UntrustedProfile';
    const catalog = createThreeValueMechanicsProfileCatalog({
      catalogId: 'invalid-test-catalog',
      profiles: [DEFAULT_THREE_VALUE_MECHANICS_PROFILE, invalidProfile],
    });

    expect(catalog).toMatchObject({
      status: 'mechanics-profile-catalog-invalid',
      ready: false,
      summary: {
        profileCount: 2,
        validProfileCount: 1,
        invalidProfileCount: 1,
      },
      issues: expect.arrayContaining(['profile-invalid:invalid-profile@1']),
    });
    expect(catalog.profiles).toEqual([DEFAULT_THREE_VALUE_MECHANICS_PROFILE]);
  });
});
