import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import {
  createOptimizationScenarioPolicy,
  M12C_OPTIMIZATION_SCENARIO_POLICY_REASON,
} from '../optimization-scenario/optimization-scenario-policy-source.mjs';
import { hashCanonicalValue } from '../../src/simulation/headless/canonicalSerialization.js';

export const SET_THREE_SOURCE_IDENTITY_EVIDENCE_RELATIVE_PATH =
  'scripts/optimization-qualification/evidence/set-three-source-identity-evidence.json';

const LOCALIZATION_KEY = '85890777460246016';
const EXPECTED_LOCALIZATIONS = Object.freeze({
  chs: '5件套 普攻命中时，提升自身攻击力1%，持续12秒，最多叠加10层',
  jp: '5枚セット：通常攻撃が命中時、自身の攻撃力が1%アップ、12秒間持続し、最大10回までスタック可能',
  kr: '5세트 - 일반 공격 명중 시 공격력 +1% (12초 지속, 최대 10회 중첩)',
  cht: '5件套 普攻命中時，提升自身攻擊力1%，持續12秒，最多疊加10層',
});

const OLD_GRAPH_PATH_IDS = Object.freeze([
  '-3122175980655524829',
  '-2059155062252145035',
  '-5654239168115731706',
  '1357144959877628433',
  '-6648394533564013865',
]);
const NEAR_MATCH_PATH_IDS = Object.freeze([
  '6898765742999894817',
  '-4495644276298113682',
]);
const REVERSE_SCAN_CONCURRENCY = 32;

const REQUIRED_OLD_GRAPH = Object.freeze([
  {
    elementId: 199999022,
    pathId: '-3122175980655524829',
    elementName: '装备 铁鬃霸主5件套装 冰翼挽歌',
    describe: '受到5次伤害后生命上限提升',
    triggerEventId: 4,
    triggerIntervalTimes: 5,
    targetPathId: '-2059155062252145035',
  },
  {
    elementId: 199999023,
    pathId: '-2059155062252145035',
    elementName: '装备 铁鬃霸主套装 加生命上限5%',
    attributeId: 5,
    sourceRawA: 500,
    durationMs: -1,
    combineType: 3,
  },
  {
    elementId: 199999086,
    pathId: '-5654239168115731706',
    elementName: '装备 铁鬃霸主套装 进战斗时 加生命上限2%',
    attributeId: 5,
    sourceRawA: 200,
    durationMs: -1,
    combineType: 3,
  },
  {
    elementId: 199999043,
    pathId: '1357144959877628433',
    elementName: '装备 铁鬃霸主5件套 移除器',
    triggerEventId: 36,
    conditionType: 5,
    conditionValue: 19998005,
    targetPathId: '-6648394533564013865',
  },
  {
    elementId: 199999044,
    pathId: '-6648394533564013865',
    elementName: '移除装备 铁鬃霸主5件套',
    removedPathIds: [
      '1357144959877628433',
      '-3122175980655524829',
      '-5654239168115731706',
    ],
  },
]);

const REQUIRED_NEAR_MATCH = Object.freeze({
  triggerElementId: 199999018,
  triggerPathId: '6898765742999894817',
  eventId: 1,
  conditionType: 11,
  conditionValue: 1,
  propertyElementId: 199999019,
  propertyPathId: '-4495644276298113682',
  attributeId: 1,
  sourceRawA: 100,
  durationMs: 24000,
  combineType: 4,
  combineNumber: 7,
  actualControlSkillId: 19998003,
  rejectedAsSetThreeCandidate: true,
});

const REQUIRED_ATTACK_A100_CENSUS = Object.freeze(
  [
    [520076003, -1, 4, 16],
    [103002253, -1, 4, 30],
    [199999019, 24000, 4, 7],
    [19003203, 16000, 3, 1],
    [107001168, 10000, 4, 5],
    [520110004, -1, 4, 4],
  ].map(([elementId, durationMs, combineType, combineNumber]) => ({
    elementId,
    durationMs,
    combineType,
    combineNumber,
  }))
);

const REQUIRED_REVERSE_REFERENCE_CENSUS = Object.freeze({
  scannedDefaultPackageFileCount: 212053,
  scannedStaticPackageFileCount: 0,
  oldGraphMatches: [
    {
      suffix:
        'skill_control_19998005.asset/MonoBehaviour/MonoBehaviour_-7665508558900367746__-7665508558900367746.json',
      pathIds: ['-3122175980655524829', '-5654239168115731706'],
    },
    {
      suffix:
        'skill_control_19998005.asset/MonoBehaviour/MonoBehaviour_-7993432668986282370__-7993432668986282370.json',
      pathIds: ['1357144959877628433'],
    },
    {
      suffix:
        'skill_control_19998005.asset/MonoBehaviour/skill_control_19998005__-2339022120750825272.json',
      pathIds: [...OLD_GRAPH_PATH_IDS],
    },
  ],
  nearMatchGraphMatches: [
    {
      suffix:
        'skill_control_19998003.asset/MonoBehaviour/MonoBehaviour_-6651836192383337979__-6651836192383337979.json',
      pathIds: ['6898765742999894817'],
    },
    {
      suffix:
        'skill_control_19998003.asset/MonoBehaviour/skill_control_19998003__-3103682062580946589.json',
      pathIds: [...NEAR_MATCH_PATH_IDS],
    },
  ],
});

const OPTIMIZATION_SCENARIO_POLICY = createOptimizationScenarioPolicy();
const OPTIMIZATION_SCENARIO_POLICY_BINDING = Object.freeze({
  policyId: OPTIMIZATION_SCENARIO_POLICY.policyId,
  policyHash: OPTIMIZATION_SCENARIO_POLICY.policyHash,
  rosterPolicyId: OPTIMIZATION_SCENARIO_POLICY.candidateRoster.rosterPolicyId,
  rosterHash: OPTIMIZATION_SCENARIO_POLICY.candidateRoster.rosterHash,
});

const REQUIRED_RUNTIME_CONTRACT = Object.freeze({
  authority:
    'current-client-executable-skill-control-and-reachable-battle-element-graph',
  staticRoot: {
    elementId: 199999086,
    attributeId: 5,
    sourceRawA: 200,
    durationMs: -1,
    combineType: 3,
    combineNumber: 0,
    installation: 'scenario-start-self-actor',
    unloadElementIds: [199999043, 199999044],
  },
  scenarioExcludedReactiveBranch: {
    triggerElementId: 199999022,
    triggerEventId: 4,
    triggerEventName: 'AfterReceiveDamage',
    triggerIntervalTimes: 5,
    propertyElementId: 199999023,
    attributeId: 5,
    sourceRawA: 500,
    durationMs: -1,
    combineType: 3,
    combineNumber: 0,
    scenarioBoundary: {
      disposition: 'scenario-out-of-scope',
      reason: M12C_OPTIMIZATION_SCENARIO_POLICY_REASON,
      bossAttacks: OPTIMIZATION_SCENARIO_POLICY.assumptions.enemyActiveAttacks,
      ...OPTIMIZATION_SCENARIO_POLICY_BINDING,
      mechanismReality:
        'source-closed-runtime-not-required-for-first-optimization-scenario',
    },
  },
});

const scanCache = new Map();

export async function readSetThreeSourceIdentityEvidenceSource({
  sourcePath,
  accessorySetPath,
  skillTablePath,
  localizationPaths,
  battleElementAssetsPath,
  formalControlFiles,
  nearMatchControlFiles,
  battleElementBundlePath,
  skillControlBundlePath,
  extractedUnityRoot,
  projectRoot,
  skillControlRoots = null,
  verifyFullReverseReferences = false,
}) {
  const reviewedPaths = {
    accessorySet: accessorySetPath,
    skillTable: skillTablePath,
    localizationChs: localizationPaths.chs,
    localizationJp: localizationPaths.jp,
    localizationKr: localizationPaths.kr,
    localizationCht: localizationPaths.cht,
    battleElementAssets: battleElementAssetsPath,
    formalControlMain: formalControlFiles.main,
    formalControlTrackInstall: formalControlFiles.trackInstall,
    formalControlTrackUnload: formalControlFiles.trackUnload,
    formalControlBehaviorInstall: formalControlFiles.behaviorInstall,
    formalControlBehaviorUnload: formalControlFiles.behaviorUnload,
    nearMatchControlMain: nearMatchControlFiles.main,
    nearMatchControlBehavior: nearMatchControlFiles.behavior,
    battleElementBundle: battleElementBundlePath,
    skillControlBundle: skillControlBundlePath,
  };
  const entries = await Promise.all(
    Object.entries({ evidence: sourcePath, ...reviewedPaths }).map(
      async ([key, filePath]) => {
        const bytes = await fs.readFile(filePath);
        return [key, { bytes, identity: createFileIdentity(filePath, bytes) }];
      }
    )
  );
  const files = Object.fromEntries(entries);
  const battleRows = parseBattleElementRows(
    files.battleElementAssets.bytes.toString('utf8')
  );
  const observations = {
    reviewedSources: Object.fromEntries(
      Object.entries(reviewedPaths).map(([key]) => [key, files[key].identity])
    ),
    formalEntry: {
      accessorySet: requireRow(
        JSON.parse(files.accessorySet.bytes.toString('utf8')).rows,
        row => Number(row.id) === 3,
        'accessory-set-row-missing'
      ),
      skill: requireRow(
        JSON.parse(files.skillTable.bytes.toString('utf8')).rows,
        row => Number(row.id) === 19998005,
        'skill-row-missing'
      ),
      localizations: Object.fromEntries(
        ['chs', 'jp', 'kr', 'cht'].map(locale => [
          locale,
          extractLocalization(
            files[`localization${capitalize(locale)}`].bytes.toString('utf8'),
            LOCALIZATION_KEY
          ),
        ])
      ),
    },
    formalControl: projectFormalControl({
      main: JSON.parse(files.formalControlMain.bytes.toString('utf8')),
      trackInstall: JSON.parse(
        files.formalControlTrackInstall.bytes.toString('utf8')
      ),
      trackUnload: JSON.parse(
        files.formalControlTrackUnload.bytes.toString('utf8')
      ),
      behaviorInstall: JSON.parse(
        files.formalControlBehaviorInstall.bytes.toString('utf8')
      ),
      behaviorUnload: JSON.parse(
        files.formalControlBehaviorUnload.bytes.toString('utf8')
      ),
    }),
    nearMatchControl: projectNearMatchControl({
      main: JSON.parse(files.nearMatchControlMain.bytes.toString('utf8')),
      behavior: JSON.parse(
        files.nearMatchControlBehavior.bytes.toString('utf8')
      ),
    }),
    battleElementCensus: projectBattleElementCensus(battleRows),
    packageCensus: await projectPackageCensus(extractedUnityRoot),
    reverseReferenceCensus: verifyFullReverseReferences
      ? await scanSetThreeSkillListReverseReferences(skillControlRoots)
      : null,
  };
  const value = JSON.parse(files.evidence.bytes.toString('utf8'));
  validateSetThreeSourceIdentityEvidence(value, observations, {
    requireFullReverseReferenceObservation: verifyFullReverseReferences,
  });
  return {
    path: normalizeSourcePath(sourcePath, projectRoot),
    bytes: files.evidence.bytes.byteLength,
    sha256: hashBytes(files.evidence.bytes),
    value: structuredClone(value),
    observations,
  };
}

export function validateSetThreeSourceIdentityEvidence(
  value,
  observations,
  { requireFullReverseReferenceObservation = false } = {}
) {
  if (
    Number(value?.schemaVersion) !== 1 ||
    value?.contractName !== 'AzPrSetThreeSourceIdentityEvidence' ||
    value?.conclusion?.status !== 'product-resolved' ||
    value?.conclusion?.runtimeApplied !== true ||
    value?.conclusion?.authority !== 'current-client-executable-graph' ||
    value?.conclusion?.staleSource !== 'formal-localization' ||
    value?.conclusion?.gapCode !== null
  ) {
    fail('contract-invalid');
  }
  for (const [key, observed] of Object.entries(
    observations?.reviewedSources ?? {}
  )) {
    assertIdentity(
      value.reviewedSources?.[key],
      observed,
      `source-drift:${key}`
    );
  }
  assertCanonicalEqual(
    value.formalEntry?.accessorySet,
    { id: 3, skill: '2#19998105|4#19998005', name: '12884902656' },
    'formal-accessory-set-drift'
  );
  assertCanonicalEqual(
    observations?.formalEntry?.accessorySet,
    value.formalEntry.accessorySet,
    'formal-accessory-set-source-drift'
  );
  assertCanonicalEqual(
    value.formalEntry?.skill,
    {
      id: 19998005,
      skillType: 1,
      name: LOCALIZATION_KEY,
      skillModuleTag: 2,
    },
    'formal-skill-drift'
  );
  const observedSkill = observations?.formalEntry?.skill;
  for (const [key, expected] of Object.entries(value.formalEntry.skill)) {
    if (String(observedSkill?.[key]) !== String(expected)) {
      fail('formal-skill-source-drift', key);
    }
  }
  if (value.formalEntry?.localizationKey !== LOCALIZATION_KEY) {
    fail('localization-key-drift');
  }
  for (const [locale, expected] of Object.entries(EXPECTED_LOCALIZATIONS)) {
    if (
      value.formalEntry?.localizations?.[locale] !== expected ||
      observations?.formalEntry?.localizations?.[locale] !== expected
    ) {
      fail('localization-drift', locale);
    }
  }
  assertCanonicalEqual(
    value.formalControl,
    observations?.formalControl,
    'formal-control-drift'
  );
  if (
    Number(value.formalControl?.skillId) !== 19998005 ||
    !arraysEqual(value.formalControl?.resourcePathIds, OLD_GRAPH_PATH_IDS) ||
    value.formalControl?.injectedPathIds?.some(pathId =>
      NEAR_MATCH_PATH_IDS.includes(pathId)
    )
  ) {
    fail('formal-control-binding-invalid');
  }
  assertCanonicalEqual(
    value.reachableGraph,
    REQUIRED_OLD_GRAPH,
    'reachable-old-graph-drift'
  );
  assertCanonicalEqual(
    observations?.battleElementCensus?.oldGraph,
    REQUIRED_OLD_GRAPH,
    'reachable-old-graph-source-drift'
  );
  assertCanonicalEqual(
    value.expectedMechanismSearch?.requiredSignature,
    {
      trigger: 'landed-normal-attack-or-equivalent-native-selector',
      attributeId: 1,
      sourceRawA: 100,
      durationMs: 12000,
      combineType: 4,
      combineNumber: 10,
    },
    'expected-signature-drift'
  );
  if (
    Number(value.expectedMechanismSearch?.battleElementLineCount) !== 14781 ||
    Number(value.expectedMechanismSearch?.battleElementCount) !== 14779 ||
    Number(value.expectedMechanismSearch?.exactPropertySignatureMatchCount) !==
      0 ||
    Number(
      observations?.battleElementCensus?.exactPropertySignatureMatchCount
    ) !== 0
  ) {
    fail('expected-signature-census-drift');
  }
  assertCanonicalEqual(
    value.expectedMechanismSearch?.attackA100PropertyCensus,
    REQUIRED_ATTACK_A100_CENSUS,
    'attack-a100-census-drift'
  );
  assertCanonicalEqual(
    observations?.battleElementCensus?.attackA100PropertyCensus,
    REQUIRED_ATTACK_A100_CENSUS,
    'attack-a100-source-census-drift'
  );
  assertCanonicalEqual(
    value.expectedMechanismSearch?.nearMatch,
    REQUIRED_NEAR_MATCH,
    'near-match-drift'
  );
  assertCanonicalEqual(
    observations?.battleElementCensus?.nearMatch,
    REQUIRED_NEAR_MATCH,
    'near-match-source-drift'
  );
  assertCanonicalEqual(
    value.nearMatchControl,
    observations?.nearMatchControl,
    'near-match-control-drift'
  );
  if (
    Number(value.nearMatchControl?.skillId) !== 19998003 ||
    !arraysEqual(value.nearMatchControl?.resourcePathIds, NEAR_MATCH_PATH_IDS)
  ) {
    fail('near-match-control-binding-invalid');
  }
  assertCanonicalEqual(
    value.reverseReferenceCensus,
    REQUIRED_REVERSE_REFERENCE_CENSUS,
    'reverse-reference-census-drift'
  );
  if (requireFullReverseReferenceObservation) {
    assertCanonicalEqual(
      observations?.reverseReferenceCensus,
      REQUIRED_REVERSE_REFERENCE_CENSUS,
      'reverse-reference-source-drift'
    );
  }
  assertCanonicalEqual(
    value.packageCensus,
    observations?.packageCensus,
    'package-census-drift'
  );
  if (
    value.sourceConflict?.formalTextSemantics !==
      'normal-attack-hit-self-attack-plus-one-percent-twelve-seconds-max-ten' ||
    value.sourceConflict?.reachableGraphSemantics !==
      'after-receive-damage-every-five-max-hp-plus-two-and-five-percent' ||
    value.sourceConflict?.whichSourceIsStale !== 'formal-localization' ||
    value.sourceConflict?.safeRuntimeDisposition !==
      'apply-current-executable-graph-with-passive-boss-scenario-boundary'
  ) {
    fail('source-conflict-disposition-drift');
  }
  assertCanonicalEqual(
    value.runtimeContract,
    REQUIRED_RUNTIME_CONTRACT,
    'runtime-contract-drift'
  );
  validateSetThreeOptimizationScenarioPolicy(
    value.runtimeContract?.scenarioExcludedReactiveBranch?.scenarioBoundary
  );
  if (
    !String(value.conclusion?.decisionSource ?? '').startsWith(
      'user-directive-2026-08-08:'
    )
  ) {
    fail('product-decision-source-drift');
  }
  return true;
}

function validateSetThreeOptimizationScenarioPolicy(scenarioBoundary) {
  const policy = structuredClone(OPTIMIZATION_SCENARIO_POLICY);
  const policyHash = policy.policyHash;
  delete policy.policyHash;
  const roster = structuredClone(OPTIMIZATION_SCENARIO_POLICY.candidateRoster);
  const rosterHash = roster.rosterHash;
  delete roster.rosterHash;
  if (
    policyHash !== hashCanonicalValue(policy) ||
    rosterHash !== hashCanonicalValue(roster) ||
    OPTIMIZATION_SCENARIO_POLICY.reason !==
      M12C_OPTIMIZATION_SCENARIO_POLICY_REASON ||
    OPTIMIZATION_SCENARIO_POLICY.assumptions?.enemyActiveAttacks !== false ||
    !OPTIMIZATION_SCENARIO_POLICY.optimizationSurface?.excludedTriggerFamilies?.includes(
      'player-receive-damage'
    ) ||
    scenarioBoundary?.policyId !==
      OPTIMIZATION_SCENARIO_POLICY_BINDING.policyId ||
    scenarioBoundary?.policyHash !==
      OPTIMIZATION_SCENARIO_POLICY_BINDING.policyHash ||
    scenarioBoundary?.rosterPolicyId !==
      OPTIMIZATION_SCENARIO_POLICY_BINDING.rosterPolicyId ||
    scenarioBoundary?.rosterHash !==
      OPTIMIZATION_SCENARIO_POLICY_BINDING.rosterHash
  ) {
    fail('optimization-scenario-policy-drift');
  }
}

export async function scanSetThreeSkillListReverseReferences(roots) {
  const normalizedRoots = normalizeScanRoots(roots);
  const cacheKey = JSON.stringify(normalizedRoots);
  if (!scanCache.has(cacheKey)) {
    scanCache.set(cacheKey, runReverseReferenceScan(normalizedRoots));
  }
  return structuredClone(await scanCache.get(cacheKey));
}

export function assertSetThreeSourceIdentityEvidenceReference(
  reference,
  source
) {
  assertExactProperties(
    reference,
    {
      path: source?.path,
      bytes: source?.bytes,
      sha256: source?.sha256,
      battleElementAssetsSha256:
        source?.value?.reviewedSources?.battleElementAssets?.sha256,
      battleElementBundleSha256:
        source?.value?.reviewedSources?.battleElementBundle?.sha256,
      skillControlBundleSha256:
        source?.value?.reviewedSources?.skillControlBundle?.sha256,
      conclusionStatus: source?.value?.conclusion?.status,
      gapCode: source?.value?.conclusion?.gapCode,
    },
    'report-reference-drift'
  );
  return true;
}

async function runReverseReferenceScan(roots) {
  const oldGraphMatches = [];
  const nearMatchGraphMatches = [];
  let scannedDefaultPackageFileCount = 0;
  let scannedStaticPackageFileCount = 0;
  for (const root of roots) {
    const files = await listJsonFiles(root.path);
    if (root.package === 'default_package') {
      scannedDefaultPackageFileCount += files.length;
    } else if (root.package === 'static_package') {
      scannedStaticPackageFileCount += files.length;
    }
    await forEachWithConcurrency(
      files,
      REVERSE_SCAN_CONCURRENCY,
      async filePath => {
        const text = await fs.readFile(filePath, 'utf8');
        const oldHits = OLD_GRAPH_PATH_IDS.filter(pathId =>
          text.includes(`\"m_PathID\": ${pathId}`)
        );
        const nearHits = NEAR_MATCH_PATH_IDS.filter(pathId =>
          text.includes(`\"m_PathID\": ${pathId}`)
        );
        if (oldHits.length) {
          oldGraphMatches.push({
            suffix: normalizeMatchSuffix(filePath),
            pathIds: oldHits,
          });
        }
        if (nearHits.length) {
          nearMatchGraphMatches.push({
            suffix: normalizeMatchSuffix(filePath),
            pathIds: nearHits,
          });
        }
      }
    );
  }
  return {
    scannedDefaultPackageFileCount,
    scannedStaticPackageFileCount,
    oldGraphMatches: oldGraphMatches.sort(compareMatchRows),
    nearMatchGraphMatches: nearMatchGraphMatches.sort(compareMatchRows),
  };
}

async function forEachWithConcurrency(values, concurrency, visit) {
  let nextIndex = 0;
  const workerCount = Math.min(concurrency, values.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const value = values[nextIndex];
        nextIndex += 1;
        await visit(value);
      }
    })
  );
}

async function projectPackageCensus(extractedUnityRoot) {
  const packageEntries = await fs.readdir(extractedUnityRoot, {
    withFileTypes: true,
  });
  const packages = packageEntries
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();
  const matchingPackages = [];
  for (const packageName of packages) {
    const controlPath = path.join(
      extractedUnityRoot,
      packageName,
      'ResourcesAssets',
      'Config',
      'Battle',
      'SkillList',
      'skill_control_19998005.asset'
    );
    if (await pathExists(controlPath)) matchingPackages.push(packageName);
  }
  const staticSkillListPath = path.join(
    extractedUnityRoot,
    'static_package',
    'ResourcesAssets',
    'Config',
    'Battle',
    'SkillList'
  );
  return {
    currentSkillControlPackages: matchingPackages,
    duplicate19998005ControlCount: Math.max(0, matchingPackages.length - 1),
    staticPackageBattleSkillListPresent: await pathExists(staticSkillListPath),
    expectedMechanismGraphFound: false,
    scanScope:
      'all 212053 current default-package SkillList JSON files plus the absent static-package SkillList root',
  };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function listJsonFiles(root) {
  try {
    const entries = await fs.readdir(root, {
      recursive: true,
      withFileTypes: true,
    });
    return entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
      .map(entry => path.join(entry.parentPath ?? entry.path, entry.name))
      .sort();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

function parseBattleElementRows(text) {
  return String(text)
    .trim()
    .split(/\r?\n/u)
    .map(line => ({
      line,
      pathId: line.match(/"path_id":\s*(-?\d+)/u)?.[1] ?? null,
      value: JSON.parse(line),
    }));
}

function projectBattleElementCensus(rows) {
  const elements = rows.filter(row =>
    Number.isInteger(Number(row.value?.typetree?.elementConfigId))
  );
  const byElementId = new Map(
    elements.map(row => [Number(row.value.typetree.elementConfigId), row])
  );
  const oldGraph = REQUIRED_OLD_GRAPH.map(required => {
    const row = byElementId.get(required.elementId);
    if (!row) fail('battle-element-row-missing', String(required.elementId));
    return projectOldGraphRow(row);
  });
  const exactPropertySignatureMatchCount = elements.filter(row => {
    const tree = row.value.typetree;
    return (
      Number(tree.attributeID) === 1 &&
      sourceRawA(tree) === 100 &&
      Number(tree.time) === 12000 &&
      Number(tree.combineType) === 4 &&
      Number(tree.combineNumber) === 10
    );
  }).length;
  const attackA100PropertyCensus = elements
    .filter(row => {
      const tree = row.value.typetree;
      return Number(tree.attributeID) === 1 && sourceRawA(tree) === 100;
    })
    .map(row => ({
      elementId: Number(row.value.typetree.elementConfigId),
      durationMs: Number(row.value.typetree.time),
      combineType: Number(row.value.typetree.combineType),
      combineNumber: Number(row.value.typetree.combineNumber),
    }));
  const trigger = byElementId.get(199999018);
  const property = byElementId.get(199999019);
  return {
    lineCount: rows.length,
    elementCount: elements.length,
    oldGraph,
    exactPropertySignatureMatchCount,
    attackA100PropertyCensus,
    nearMatch: {
      triggerElementId: 199999018,
      triggerPathId: trigger?.pathId,
      eventId: Number(trigger?.value?.typetree?.triggerParam1),
      conditionType: Number(
        trigger?.value?.typetree?.triggerConditionList?.[0]?.conditionParam1
      ),
      conditionValue: Number(
        trigger?.value?.typetree?.triggerConditionList?.[0]?.conditionParam2
      ),
      propertyElementId: 199999019,
      propertyPathId: property?.pathId,
      attributeId: Number(property?.value?.typetree?.attributeID),
      sourceRawA: sourceRawA(property?.value?.typetree),
      durationMs: Number(property?.value?.typetree?.time),
      combineType: Number(property?.value?.typetree?.combineType),
      combineNumber: Number(property?.value?.typetree?.combineNumber),
      actualControlSkillId: 19998003,
      rejectedAsSetThreeCandidate: true,
    },
  };
}

function projectOldGraphRow(row) {
  const tree = row.value.typetree;
  const base = {
    elementId: Number(tree.elementConfigId),
    pathId: row.pathId,
    elementName: tree.elementName,
  };
  if (base.elementId === 199999022) {
    return {
      ...base,
      describe: tree.describe,
      triggerEventId: Number(tree.triggerParam1),
      triggerIntervalTimes: Number(tree.triggerIntervalTimes),
      targetPathId: extractPathIds(row.line, 'targetElement')[0],
    };
  }
  if ([199999023, 199999086].includes(base.elementId)) {
    return {
      ...base,
      attributeId: Number(tree.attributeID),
      sourceRawA: sourceRawA(tree),
      durationMs: Number(tree.time),
      combineType: Number(tree.combineType),
    };
  }
  if (base.elementId === 199999043) {
    return {
      ...base,
      triggerEventId: Number(tree.triggerParam1),
      conditionType: Number(tree.triggerConditionList?.[0]?.conditionParam1),
      conditionValue: Number(tree.triggerConditionList?.[0]?.conditionParam2),
      targetPathId: extractPathIds(row.line, 'targetElement')[0],
    };
  }
  return {
    ...base,
    removedPathIds: extractPathIds(row.line, 'elementDataList'),
  };
}

function projectFormalControl({
  main,
  trackInstall,
  trackUnload,
  behaviorInstall,
  behaviorUnload,
}) {
  return {
    skillId: Number(main.skillControlData?.skillId),
    sourcePackage: 'default_package',
    bundleIndex: 75791,
    logicalName:
      'd_assets_resourcesassets_config_battle_skilllist_skill_control_19998005',
    packName: 'sxtotgjsgmmqba8fd86yjw',
    resourcePathIds: main.skillResourceMaps?.[0]?.elements?.map(item =>
      exactPathId(item.m_PathID, OLD_GRAPH_PATH_IDS)
    ),
    trackPathIds:
      main.skillControlData?.skillPlayers?.[0]?.skillTrackDatas?.map(item =>
        exactPathId(item.m_PathID, [
          '-5874771271388107138',
          '-4955137497584177538',
        ])
      ),
    installTrackName: trackInstall.behaviorlineControl?.[0]?.name,
    unloadTrackName: trackUnload.behaviorlineControl?.[0]?.name,
    injectedPathIds: [
      ...(behaviorInstall.elementDataList ?? []),
      ...(behaviorUnload.elementDataList ?? []),
    ].map(item => exactPathId(item.m_PathID, OLD_GRAPH_PATH_IDS)),
  };
}

function projectNearMatchControl({ main, behavior }) {
  return {
    skillId: Number(main.skillControlData?.skillId),
    sourcePackage: 'default_package',
    bundleIndex: 75789,
    logicalName:
      'd_assets_resourcesassets_config_battle_skilllist_skill_control_19998003',
    packName: 'sxtotgjsgmmqba8fd86yjw',
    resourcePathIds: main.skillResourceMaps?.[0]?.elements
      ?.map(item => exactPathId(item.m_PathID, NEAR_MATCH_PATH_IDS))
      .filter(Boolean),
    injectedPathIds: (behavior.elementDataList ?? [])
      .map(item => exactPathId(item.m_PathID, NEAR_MATCH_PATH_IDS))
      .filter(Boolean),
  };
}

function extractLocalization(text, key) {
  const pattern = new RegExp(
    `\"id\"\\s*:\\s*${key}\\s*,\\s*\"value\"\\s*:\\s*(\"(?:\\\\.|[^\"\\\\])*\")`,
    'u'
  );
  const match = String(text).match(pattern);
  if (!match) fail('localization-row-missing', key);
  return JSON.parse(match[1]);
}

function extractPathIds(line, anchor) {
  const anchorIndex = line.indexOf(`\"${anchor}\"`);
  const source = anchorIndex >= 0 ? line.slice(anchorIndex) : line;
  return [...source.matchAll(/"m_PathID":\s*(-?\d+)/gu)].map(match => match[1]);
}

function sourceRawA(tree) {
  return Number(
    tree?.formulaParams?.formulaParamValues?.[0] ?? tree?.functionParams?.[0]
  );
}

function exactPathId(value, candidates) {
  const numeric = Number(value);
  return candidates.find(candidate => Number(candidate) === numeric) ?? null;
}

function normalizeScanRoots(roots) {
  if (!Array.isArray(roots) || roots.length === 0) {
    fail('reverse-reference-roots-missing');
  }
  return roots.map(root => ({
    package: root.package,
    path: path.resolve(root.path),
  }));
}

function normalizeMatchSuffix(filePath) {
  const normalized = filePath.replaceAll('\\', '/');
  const marker = '/SkillList/';
  const index = normalized.indexOf(marker);
  return index >= 0 ? normalized.slice(index + marker.length) : normalized;
}

function compareMatchRows(left, right) {
  return left.suffix.localeCompare(right.suffix);
}

function createFileIdentity(filePath, bytes) {
  return {
    path: filePath.replaceAll('\\', '/'),
    bytes: bytes.byteLength,
    sha256: hashBytes(bytes),
  };
}

function assertIdentity(expected, observed, code) {
  if (
    normalizeIdentityPath(expected?.path) !==
      normalizeIdentityPath(observed?.path) ||
    Number(expected?.bytes) !== Number(observed?.bytes) ||
    expected?.sha256 !== observed?.sha256
  ) {
    fail(code);
  }
}

function assertCanonicalEqual(actual, expected, code) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
}

function assertExactProperties(actual, expected, code) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual?.[key] !== value) fail(code, key);
  }
}

function arraysEqual(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function requireRow(rows, predicate, code) {
  const row = (rows ?? []).find(predicate);
  if (!row) fail(code);
  return row;
}

function capitalize(value) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function normalizeIdentityPath(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

function normalizeSourcePath(sourcePath, projectRoot) {
  const relative = path.relative(projectRoot, sourcePath);
  return relative.startsWith('..')
    ? sourcePath.replaceAll('\\', '/')
    : relative.replaceAll('\\', '/');
}

function hashBytes(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function fail(code, detail = null) {
  throw new Error(
    `optimization-qualification-set-three-source-identity-evidence-${code}${detail ? `:${detail}` : ''}`
  );
}
