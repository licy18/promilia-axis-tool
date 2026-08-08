import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  assertSetThreeSourceIdentityEvidenceReference,
  readSetThreeSourceIdentityEvidenceSource,
  SET_THREE_SOURCE_IDENTITY_EVIDENCE_RELATIVE_PATH,
  validateSetThreeSourceIdentityEvidence,
} from '../../../scripts/optimization-qualification/set-three-source-identity-evidence.mjs';
import { createOptimizationQualificationArtifacts } from '../../../scripts/optimization-qualification/optimization-qualification-generation.mjs';
import { createOptimizationScenarioPolicy } from '../../../scripts/optimization-scenario/optimization-scenario-policy-source.mjs';

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);
const evidencePath = path.join(
  projectRoot,
  ...SET_THREE_SOURCE_IDENTITY_EVIDENCE_RELATIVE_PATH.split('/')
);
const skillControlRoot =
  'C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/SkillList';
const staticSkillControlRoot =
  'C:/Codex/AzPr Extractor/ExtractedAssets/Unity/static_package/ResourcesAssets/Config/Battle/SkillList';

function createReadOptions(overrides = {}) {
  const formalRoot = path.join(
    skillControlRoot,
    'skill_control_19998005.asset',
    'MonoBehaviour'
  );
  const nearMatchRoot = path.join(
    skillControlRoot,
    'skill_control_19998003.asset',
    'MonoBehaviour'
  );
  return {
    sourcePath: evidencePath,
    accessorySetPath:
      'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/accessory_set.json',
    skillTablePath:
      'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/skill.json',
    localizationPaths: {
      chs: 'C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table/lang_skill.json',
      jp: 'C:/PC2/Codex/AzPr/Assets_JP_JA_CB2/ResourcesLang/jp/Table/lang_skill.json',
      kr: 'C:/PC2/Codex/AzPr/Assets_KR_KO_CB2/ResourcesLang/kr/Table/lang_skill.json',
      cht: 'C:/PC2/Codex/AzPr/Assets_TW_TC_CB2/ResourcesLang/cht/Table/lang_skill.json',
    },
    battleElementAssetsPath:
      'C:/PC2/Codex/AzPr/work/combat-formulas/battle-element-assets.jsonl',
    formalControlFiles: {
      main: path.join(
        formalRoot,
        'skill_control_19998005__-2339022120750825272.json'
      ),
      trackInstall: path.join(
        formalRoot,
        'MonoBehaviour_-5874771271388107138__-5874771271388107138.json'
      ),
      trackUnload: path.join(
        formalRoot,
        'MonoBehaviour_-4955137497584177538__-4955137497584177538.json'
      ),
      behaviorInstall: path.join(
        formalRoot,
        'MonoBehaviour_-7665508558900367746__-7665508558900367746.json'
      ),
      behaviorUnload: path.join(
        formalRoot,
        'MonoBehaviour_-7993432668986282370__-7993432668986282370.json'
      ),
    },
    nearMatchControlFiles: {
      main: path.join(
        nearMatchRoot,
        'skill_control_19998003__-3103682062580946589.json'
      ),
      behavior: path.join(
        nearMatchRoot,
        'MonoBehaviour_-6651836192383337979__-6651836192383337979.json'
      ),
    },
    battleElementBundlePath:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/azurpromilia_Data/StreamingAssets/.res/default_package/fwtvymrpqatpf4ytyfvwqg',
    skillControlBundlePath:
      'C:/AP/AzurPromilia_TC/AzurPromilia_game/azurpromilia_Data/StreamingAssets/.res/default_package/sxtotgjsgmmqba8fd86yjw',
    extractedUnityRoot: 'C:/Codex/AzPr Extractor/ExtractedAssets/Unity',
    projectRoot,
    ...overrides,
  };
}

describe('set-skill:3:4 executable graph product resolution', () => {
  let source;
  let report;

  beforeAll(async () => {
    [source, report] = await Promise.all([
      readSetThreeSourceIdentityEvidenceSource(createReadOptions()),
      fs
        .readFile(
          path.join(
            projectRoot,
            'reports',
            'm12',
            'm12-b3-c-dynamic-loadout-effect-acceptance.json'
          ),
          'utf8'
        )
        .then(JSON.parse),
    ]);
  }, 30_000);

  it('keeps stale formal text as evidence while applying the current executable graph within the passive-boss scenario', () => {
    expect(source.value).toMatchObject({
      contractName: 'AzPrSetThreeSourceIdentityEvidence',
      formalEntry: {
        accessorySet: {
          id: 3,
          skill: '2#19998105|4#19998005',
        },
        skill: { id: 19998005 },
        localizations: {
          chs: expect.stringContaining('攻击力1%'),
          jp: expect.stringContaining('攻撃力が1%'),
          kr: expect.stringContaining('공격력 +1%'),
          cht: expect.stringContaining('攻擊力1%'),
        },
      },
      formalControl: {
        skillId: 19998005,
        sourcePackage: 'default_package',
      },
      expectedMechanismSearch: {
        exactPropertySignatureMatchCount: 0,
        nearMatch: {
          actualControlSkillId: 19998003,
          durationMs: 24000,
          combineNumber: 7,
          rejectedAsSetThreeCandidate: true,
        },
      },
      sourceConflict: {
        whichSourceIsStale: 'formal-localization',
        safeRuntimeDisposition:
          'apply-current-executable-graph-with-passive-boss-scenario-boundary',
      },
      runtimeContract: {
        staticRoot: {
          elementId: 199999086,
          attributeId: 5,
          sourceRawA: 200,
        },
        scenarioExcludedReactiveBranch: {
          triggerElementId: 199999022,
          propertyElementId: 199999023,
          scenarioBoundary: {
            disposition: 'scenario-out-of-scope',
            reason: 'm12c-zero-distance-passive-boss-out-of-scope',
            bossAttacks: false,
          },
        },
      },
      conclusion: {
        status: 'product-resolved',
        runtimeApplied: true,
        setSkillIdentity: 'set-skill:3:4',
        authority: 'current-client-executable-graph',
        staleSource: 'formal-localization',
        gapCode: null,
      },
    });
    expect(source.value.reachableGraph.map(row => row.elementId)).toEqual([
      199999022, 199999023, 199999086, 199999043, 199999044,
    ]);
    const scenarioPolicy = createOptimizationScenarioPolicy();
    expect(
      source.value.runtimeContract.scenarioExcludedReactiveBranch
        .scenarioBoundary
    ).toMatchObject({
      policyId: scenarioPolicy.policyId,
      policyHash: scenarioPolicy.policyHash,
      rosterPolicyId: scenarioPolicy.candidateRoster.rosterPolicyId,
      rosterHash: scenarioPolicy.candidateRoster.rosterHash,
    });
    expect(() =>
      assertSetThreeSourceIdentityEvidenceReference(
        report.sourceClosure.setThreeSourceIdentityEvidence,
        source
      )
    ).not.toThrow();
  });

  it('rejects source, graph, signature, reference census, and disposition drift', () => {
    const mutations = [
      value => {
        value.reviewedSources.battleElementAssets.sha256 = '0'.repeat(64);
      },
      value => {
        value.formalEntry.localizations.chs = 'stale';
      },
      value => {
        value.formalControl.resourcePathIds.pop();
      },
      value => {
        value.reachableGraph[0].triggerEventId = 1;
      },
      value => {
        value.expectedMechanismSearch.exactPropertySignatureMatchCount = 1;
      },
      value => {
        value.expectedMechanismSearch.nearMatch.actualControlSkillId = 19998005;
      },
      value => {
        value.reverseReferenceCensus.oldGraphMatches.pop();
      },
      value => {
        value.packageCensus.expectedMechanismGraphFound = true;
      },
      value => {
        value.sourceConflict.whichSourceIsStale = 'unresolved';
      },
      value => {
        value.runtimeContract.staticRoot.sourceRawA = 100;
      },
      value => {
        value.conclusion.runtimeApplied = false;
      },
    ];
    for (const mutate of mutations) {
      const value = structuredClone(source.value);
      mutate(value);
      expect(() =>
        validateSetThreeSourceIdentityEvidence(value, source.observations)
      ).toThrow(/optimization-qualification-set-three-source-identity-/u);
    }
  });

  it('recomputes all current SkillList reverse references without finding another binding', async () => {
    const verified = await readSetThreeSourceIdentityEvidenceSource(
      createReadOptions({
        verifyFullReverseReferences: true,
        skillControlRoots: [
          { package: 'default_package', path: skillControlRoot },
          { package: 'static_package', path: staticSkillControlRoot },
        ],
      })
    );
    expect(verified.observations.reverseReferenceCensus).toEqual(
      verified.value.reverseReferenceCensus
    );
    expect(
      verified.observations.reverseReferenceCensus.oldGraphMatches.map(
        row => row.suffix.split('/')[0]
      )
    ).toEqual([
      'skill_control_19998005.asset',
      'skill_control_19998005.asset',
      'skill_control_19998005.asset',
    ]);
    expect(
      verified.observations.reverseReferenceCensus.nearMatchGraphMatches.map(
        row => row.suffix.split('/')[0]
      )
    ).toEqual(['skill_control_19998003.asset', 'skill_control_19998003.asset']);
  }, 240_000);

  it('rejects a stale acceptance-report evidence reference before generation', async () => {
    const tempRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'azpr-set-three-source-report-')
    );
    const tamperedReport = structuredClone(report);
    tamperedReport.sourceClosure.setThreeSourceIdentityEvidence.sha256 =
      '0'.repeat(64);
    const reportPath = path.join(tempRoot, 'acceptance.json');
    try {
      await fs.writeFile(
        reportPath,
        `${JSON.stringify(tamperedReport, null, 2)}\n`,
        'utf8'
      );
      await expect(
        createOptimizationQualificationArtifacts({
          projectRoot,
          dynamicLoadoutAcceptanceReportPath: reportPath,
        })
      ).rejects.toThrow(
        /set-three-source-identity-evidence-report-reference-drift/u
      );
    } finally {
      await fs.rm(tempRoot, { recursive: true, force: true });
    }
  }, 30_000);
});
