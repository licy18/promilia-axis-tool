import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const INHERITED_EVIDENCE_BASELINE = '140eefcd233cd9c1d136728f1c94b91aff632278'
const BASELINE = '1a56e0a295f31298da6c3ddb5d70db90183971fb'
const ALLOWED_PREFIX = 'work/m12-b3/parallel-evidence-107002/'
const EXPECTED_BRANCH = 'fix/m12-b3-107002-charged-absorb'
const ALLOWED_IMPLEMENTATION_PATHS = Object.freeze([
  'fixtures/character-acceptance/107002-visual.json',
  'reports/m10/107002/**',
  'reports/m11/character-acceptance/107002/**',
  'schemas/azpr-machine-axis-v1.schema.json',
  'scripts/generate-character-acceptance.mjs',
  'scripts/character-acceptance/acceptance-recipes/107002.json',
  'scripts/character-combat/character-combat-contract-compiler.mjs',
  'scripts/character-combat/character-combat-golden-runtime.mjs',
  'scripts/character-combat/character-combat-production-orchestrator.mjs',
  'scripts/character-combat/character-combat-profile-pipeline.mjs',
  'scripts/character-combat/profile-recipes/107002.json',
  'scripts/optimization-scenario/optimization-scenario-policy-source.mjs',
  'scripts/sync-verified-combat-mechanics.mjs',
  'src/__tests__/character-acceptance/characterAcceptance107002.test.js',
  'src/__tests__/data/misaCharacterCombatProfile.test.js',
  'src/__tests__/simulation/actionRuleDiagnostics.test.js',
  'src/__tests__/simulation/effectRuntimeTimeline.test.js',
  'src/__tests__/simulation/verifiedBattleEffectFormulaRuntime.test.js',
  'src/__tests__/simulation/verifiedPickupEntityGeneration.test.js',
  'src/__tests__/simulation/verifiedPickupOwnerActionAbsorb.test.js',
  'src/__tests__/simulation/verifiedTargetStateRuntime.test.js',
  'src/__tests__/simulation/verifiedTuningMarkRuntime.test.js',
  'src/data/generated/character-combat-owner-contracts/107002.json',
  'src/data/generated/character-combat-profiles/107002.json',
  'src/domain/combatScenario.js',
  'src/machine-axis/machineAxisContract.js',
  'src/machine-axis/machineAxisService.js',
  'src/machine-axis/workbenchMachineAxisAdapter.js',
  'src/simulation/engine/simulateScenario.js',
  'src/simulation/mechanics/verifiedBattleEffectFormulaRuntime.js',
  'src/simulation/mechanics/verifiedBattleEffectGeneration.js',
  'src/simulation/mechanics/verifiedCombatRuntime.js',
  'src/simulation/mechanics/verifiedPickupEntityGeneration.js',
  'src/simulation/mechanics/verifiedTargetStateRuntime.js',
  'src/simulation/mechanics/verifiedTuningMarkGeneration.js',
  'src/simulation/projection/projectSimulationResult.js',
  'src/simulation/runtime/effectRuntimeTimeline.js',
])
const sidecarRoot = import.meta.dirname
const repoRoot = path.resolve(sidecarRoot, '../../..')
const supportedFlags = new Set(['--allow-dirty-sidecar'])
const flags = new Set(process.argv.slice(2))
for (const flag of flags) {
  if (!supportedFlags.has(flag)) throw new Error(`unsupported argument: ${flag}`)
}
const allowDirtySidecar = flags.has('--allow-dirty-sidecar')

function parseLosslessJson(text) {
  return JSON.parse(
    text.replace(/([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g, '$1"$2"'),
  )
}

function readJson(name) {
  return parseLosslessJson(fs.readFileSync(path.join(sidecarRoot, name), 'utf8'))
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function lines(value) {
  return value.split(/\r?\n/u).map((entry) => entry.trim()).filter(Boolean)
}

function isAllowedCarrierPath(value) {
  const normalized = value.replaceAll('\\', '/')
  return (
    normalized.startsWith(ALLOWED_PREFIX) ||
    ALLOWED_IMPLEMENTATION_PATHS.some(allowed =>
      allowed.endsWith('/**')
        ? normalized.startsWith(allowed.slice(0, -2))
        : normalized === allowed,
    )
  )
}

function collectObjects(value, output = []) {
  if (value === null || typeof value !== 'object') return output
  if (!Array.isArray(value)) output.push(value)
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    collectObjects(child, output)
  }
  return output
}

function refPathIds(refs = []) {
  return refs.map((entry) => String(entry.m_PathID))
}

function same(actual, expected, label) {
  assert.deepEqual(actual, expected, label)
}

function fileSha256(name) {
  return crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(sidecarRoot, name)))
    .digest('hex')
}

function runArtifactAssertion(command, args, label) {
  try {
    execFileSync(command, args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const stderr = String(error?.stderr ?? '').trim()
    const stdout = String(error?.stdout ?? '').trim()
    throw new Error(
      `${label} failed${stderr ? `: ${stderr}` : stdout ? `: ${stdout}` : ''}`,
      { cause: error },
    )
  }
}

function assertDeterministicMetadata(artifact, label) {
  assert.equal(artifact.schemaVersion, 2, `${label} schema version drifted`)
  assert.equal(artifact.generatedAt, undefined, `${label} embeds generatedAt`)
  assert.equal(artifact.frozenBaseline, undefined, `${label} embeds legacy frozenBaseline`)
  same(artifact.frozenProductionBaseline, {
    commit: BASELINE,
    inheritedEvidenceBaselineCommit: INHERITED_EVIDENCE_BASELINE,
    comparisonPolicy:
      'reject-repository-drift-outside-evidence-carrier-and-r2-implementation-allowlist',
    allowedEvidenceCarrierPrefix: ALLOWED_PREFIX,
    allowedImplementationPaths: [...ALLOWED_IMPLEMENTATION_PATHS],
    scopeGuard: 'passed',
  }, `${label} frozen production model drifted`)
  same(artifact.evidenceCarrier, {
    policy: 'sidecar-commit-agnostic',
    commitEmbedded: false,
    branchEmbedded: false,
  }, `${label} carrier model drifted`)
  same(artifact.artifactDeterminism, {
    serialization: 'utf8-json-pretty-2-lf',
    volatileFields: [],
    assertCleanSupported: true,
  }, `${label} determinism contract drifted`)
  const carrierHead = git(['rev-parse', 'HEAD'])
  if (carrierHead !== BASELINE) {
    assert.ok(
      !JSON.stringify(artifact).includes(carrierHead),
      `${label} embeds current/future sidecar carrier SHA`,
    )
  }
}

// Default mode is a post-commit gate: both core generators recompute in memory,
// compare byte-for-byte with HEAD and the working files, and never write. The
// explicit development flag compares against current working artifacts instead.
const generatorAssertionFlag = allowDirtySidecar ? '--assert-current' : '--assert-clean'
runArtifactAssertion(
  process.execPath,
  [path.join(sidecarRoot, 'extract-107002-evidence.mjs'), generatorAssertionFlag],
  'resource artifact assertion',
)
runArtifactAssertion(
  'python',
  [path.join(sidecarRoot, 'extract-107002-runtime-evidence.py'), generatorAssertionFlag],
  'runtime artifact assertion',
)

const resource = readJson('resource-graph-excerpt.json')
const runtime = readJson('runtime-evidence-excerpt.json')
const contract = readJson('mechanism-contract.json')
const conflictSnapshotPath = path.join(sidecarRoot, 'integration-conflict-snapshot.json')
const conflicts = fs.existsSync(conflictSnapshotPath)
  ? readJson('integration-conflict-snapshot.json')
  : null

// Every baseline, staged, working-tree, or untracked path must remain inside the
// evidence carrier or the frozen R2 implementation allowlist. Strict/default
// mode additionally requires byte-clean status.
execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, 'HEAD'], {
  cwd: repoRoot,
  stdio: 'ignore',
})
const touchedPaths = new Set([
  ...lines(git(['diff', '--name-only', `${BASELINE}..HEAD`])),
  ...lines(git(['diff', '--name-only'])),
  ...lines(git(['diff', '--cached', '--name-only'])),
  ...lines(git(['ls-files', '--others', '--exclude-standard'])),
])
for (const changedPath of touchedPaths) {
  assert.ok(
    isAllowedCarrierPath(changedPath),
    `out-of-scope path detected: ${changedPath}`,
  )
}

assert.equal(git(['branch', '--show-current']), EXPECTED_BRANCH)
if (!allowDirtySidecar) {
  assert.equal(
    git(['status', '--porcelain=v1', '--untracked-files=all']),
    '',
    'strict validator requires a clean tracked/index/working tree',
  )
}
assert.equal(contract.frozenBaselineCommit, INHERITED_EVIDENCE_BASELINE)
assert.equal(contract.r2IntegrationBaselineCommit, BASELINE)
assert.equal(
  contract.status,
  'accepted-evidence-with-r2-charged-absorb-implementation-scope',
)
assert.equal(contract.character.id, 107002)
assert.equal(contract.character.name, '米砂')
same(contract.artifactReproducibility, {
  coreArtifacts: [
    'resource-graph-excerpt.json',
    'runtime-evidence-excerpt.json',
  ],
  frozenProductionBaselineCommit: BASELINE,
  inheritedEvidenceBaselineCommit: INHERITED_EVIDENCE_BASELINE,
  allowedEvidenceCarrierPrefix: ALLOWED_PREFIX,
  allowedImplementationPaths: [...ALLOWED_IMPLEMENTATION_PATHS],
  carrierCommitEmbedded: false,
  serialization: 'utf8-json-pretty-2-lf',
  postCommitGate: '--assert-clean-byte-compare-working-recomputed-and-head',
  dynamicSnapshotsExcluded: ['integration-conflict-snapshot.json'],
}, 'artifact reproducibility contract drifted')
assert.equal(contract.productScenario.id, 'm12c-zero-distance-passive-boss-v1')
assert.equal(contract.productScenario.distance, 0)
assert.equal(contract.productScenario.bossAttacks, false)
same(
  {
    pickupPolicyId: contract.productScenario.pickupPolicyId,
    pickupPolicyHash: contract.productScenario.pickupPolicyHash,
    pickupAutoCollect: contract.productScenario.pickupAutoCollect,
    pickupMovementPolicy: contract.productScenario.pickupMovementPolicy,
    pickupCollectionPolicy: contract.productScenario.pickupCollectionPolicy,
  },
  {
    pickupPolicyId: 'm12c-pickup-owner-source-action-absorb-v1',
    pickupPolicyHash: '2d4b4c4977e689bc',
    pickupAutoCollect: false,
    pickupMovementPolicy: 'no-implicit-movement',
    pickupCollectionPolicy: 'owner-source-action-absorb-only',
  },
  'R2 pickup product-scenario policy drifted',
)
assert.equal(contract.frozenBoundaries.formalRosterDenominator, 9)
same(contract.frozenBoundaries.kiboDna, [], 'Kibo DNA must remain empty')
assert.equal(contract.frozenBoundaries.heroRank, 'unimplemented-dead-config')
assert.equal(contract.frozenBoundaries.formalAdmissionClaim, false)
assert.equal(contract.frozenBoundaries.optimizationReadyClaim, false)
assert.equal(contract.frozenBoundaries.m12cSearchAllowed, false)
assert.equal(contract.frozenBoundaries.productionImplementationAllowed, true)
assert.equal(
  contract.frozenBoundaries.productionImplementationScope,
  'r2-charged-absorb-allowlist-only',
)
assert.equal(
  contract.frozenBoundaries.productVisualAcceptanceStatus,
  'pending-stale-previous-record',
)

const pickupFamily = contract.mechanismFamilies.find(
  family => family.id === 'pickup-lifecycle-routing-and-tuning-intensity',
)
same(
  {
    controlSkillId: pickupFamily.chargedAbsorb.controlSkillId,
    subSkillIndex: pickupFamily.chargedAbsorb.subSkillIndex,
    triggerFrame: pickupFamily.chargedAbsorb.triggerFrame,
    sourceTrackOrder: pickupFamily.chargedAbsorb.sourceTrackOrder,
    elementId: pickupFamily.chargedAbsorb.elementId,
    collector: pickupFamily.chargedAbsorb.collector,
    settlementGate: pickupFamily.chargedAbsorb.settlementGate,
    requiresHit: pickupFamily.chargedAbsorb.requiresHit,
    sameFrameSpawnPolicy: pickupFamily.chargedAbsorb.sameFrameSpawnPolicy,
    sameFrameExpiryPolicy: pickupFamily.chargedAbsorb.sameFrameExpiryPolicy,
    autoCollect: pickupFamily.lifecycle.autoCollect,
    projectileDistanceCoupling: pickupFamily.lifecycle.projectileDistanceCoupling,
    automaticCollectionReachable:
      pickupFamily.zeroDistanceReachability.automaticCollectionReachable,
  },
  {
    controlSkillId: 10700210,
    subSkillIndex: 0,
    triggerFrame: 70,
    sourceTrackOrder: 15,
    elementId: 107002233,
    collector: 'action-owner',
    settlementGate: 'successful-action-execute',
    requiresHit: false,
    sameFrameSpawnPolicy: 'exclude-same-frame-fail-closed',
    sameFrameExpiryPolicy: 'expire-before-absorb',
    autoCollect: false,
    projectileDistanceCoupling: false,
    automaticCollectionReachable: false,
  },
  'R2 charged absorb mechanism contract drifted',
)

assertDeterministicMetadata(resource, 'resource artifact')
assert.equal(resource.kind, 'm12-b3-107002-read-only-evidence-excerpt')
assert.equal(resource.scope.characterId, 107002)
assert.equal(resource.scope.productScenario, 'm12c-zero-distance-passive-boss-v1')
assertDeterministicMetadata(runtime, 'runtime artifact')
assert.equal(runtime.kind, 'm12-b3-107002-runtime-and-external-track-evidence-excerpt')
assert.equal(runtime.scope.characterId, 107002)

assert.equal(resource.generatedProjection.actions.length, 10)
assert.equal(resource.generatedProjection.controls.length, 14)
assert.equal(resource.generatedProjection.semanticEffects.length, 30)
assert.equal(resource.rawUnity.battleElementRootPathIds.length, 74)
assert.equal(resource.rawUnity.battleElementClosure.length, 74)
assert.equal(resource.rawTables.skillElementValues.rows.length, 168)
assert.equal(runtime.runtimeEnums.length, 7)
same(
  runtime.consumePackExecute.verifiedDirectCallOrder.map((entry) => entry.targetMethod),
  ['CalculateConsumeCount', 'CastPassiveSkill', 'DoConsume', 'DoInject'],
  'ConsumePackElement.Execute direct call order drifted',
)

const sourceByHash = new Set(resource.sourceFiles.map((entry) => entry.sha256))
for (const requiredHash of [
  '313758c59b0bcb94dda079bb10c40caa645b50fea20b94d7069649ac6573d198',
  '059535b45b7b64db59e5cdc49eb6f60bf9fc4b1bb547aaa74f773f2752406346',
  'ca6da39f122466a32b229b9599ecfc34dbdbbf6e10a157c529d43d1043b8f4b7',
  '102de0686bab70718cffd5ac238499d4c43024929d35b2592a37a09eb39e4680',
  '840740680e79624dd154db91091956d8a811a9381f1fe0f90d53c9d6d42b0444',
  '4b5ddb03534713fcecbbc41c911c88a3eb57c5f6f3d06cc68a7c3f08f39c34b7',
]) {
  assert.ok(sourceByHash.has(requiredHash), `required source hash missing: ${requiredHash}`)
}
same(
  resource.rawTables.chargedAbsorbGuidance.guidePic.rows.map(row => [
    String(row.id),
    row.value,
  ]),
  [
    [
      '48979807044608',
      '使用重击可以把召唤物和敌人聚拢向米砂，对敌方造成伤害的同时吸收所有召唤物恢复生命和星决蓄能',
    ],
    [
      '48979807045120',
      '使用重击可以把召唤物和敌人聚拢向米砂，对敌方造成伤害的同时吸收所有召唤物恢复生命和星决蓄能',
    ],
    [
      '48979807045632',
      '使用重击可以把召唤物和敌人聚拢向米砂，对敌方造成伤害的同时吸收所有召唤物恢复生命和星决蓄能',
    ],
  ],
  'charged absorb guide source drifted',
)
same(
  resource.rawTables.chargedAbsorbGuidance.words.rows.map(row => [
    String(row.id),
    row.value,
  ]),
  [
    [
      '3261540932764438781',
      '长按普攻键，使用重击，吸收周围召唤物并聚拢敌方单位 {0}/{1}',
    ],
  ],
  'charged absorb word source drifted',
)
assert.equal(runtime.sources.manifest.sha256, 'b72e1835d4dacd21589bc22d1a6afef871e43239e567ead5d061ca67b14fc513')
assert.equal(runtime.sources.dump.sha256, '0ea1f95a5fe8beb0c4b6c5dc2434c72c3e2a38cf94701b240aac35bca6bd817a')
assert.equal(runtime.sources.gameAssembly.sha256, 'c60d13795629f0851b1399338f375eb378aef2098515d41841f30ccc3463c22b')

function control(controlSkillId) {
  const found = resource.generatedProjection.controls.find(
    (entry) => entry.controlSkillId === controlSkillId,
  )
  assert.ok(found, `generated control missing: ${controlSkillId}`)
  return found
}

function rawControl(controlSkillId) {
  const found = resource.rawUnity.focusedControlTrackClosures.find(
    (entry) => entry.controlSkillId === controlSkillId,
  )
  assert.ok(found, `raw control closure missing: ${controlSkillId}`)
  return found
}

function controlRoot(controlSkillId) {
  const found = resource.rawUnity.controlRoots.find(
    (entry) => entry.controlSkillId === controlSkillId,
  )
  assert.ok(found, `raw control root missing: ${controlSkillId}`)
  return found
}

function rawObjects(controlSkillId) {
  return collectObjects(rawControl(controlSkillId).closure)
}

function rawClosureEntry(controlSkillId, pathId) {
  const found = rawControl(controlSkillId).closure.find(
    (entry) => entry.pathId === String(pathId),
  )
  assert.ok(found, `raw closure path missing: control=${controlSkillId} path=${pathId}`)
  return found.data
}

function behavior(controlSkillId, frame, predicate = () => true) {
  const found = rawObjects(controlSkillId).find(
    (entry) => entry.startFrame === frame && predicate(entry),
  )
  assert.ok(found, `behavior missing: control=${controlSkillId} frame=${frame}`)
  return found
}

function battleElement(pathId) {
  const found = resource.rawUnity.battleElementClosure.find(
    (entry) => entry.pathId === String(pathId),
  )
  assert.ok(found, `battle element missing: ${pathId}`)
  return found.data.typetree
}

function hitFrames(controlSkillId) {
  return control(controlSkillId).hits.map((entry) => entry.trigger.startFrame).sort((a, b) => a - b)
}

function effectFrames(controlSkillId, elementId) {
  return control(controlSkillId).effects
    .filter((entry) => entry.elementId === elementId)
    .map((entry) => entry.trigger.startFrame)
    .sort((a, b) => a - b)
}

function spawnFrames(controlSkillId, summonPathId) {
  return [...new Set(
    rawObjects(controlSkillId)
      .filter(
        (entry) =>
          Number.isInteger(entry.startFrame) &&
          Array.isArray(entry.toOwnElementBaseDatas) &&
          refPathIds(entry.toOwnElementBaseDatas).includes(String(summonPathId)),
      )
      .map((entry) => entry.startFrame),
  )].sort((a, b) => a - b)
}

function action(controlSkillId) {
  const found = resource.generatedProjection.actions.find(
    (entry) => entry.controlSkillId === controlSkillId,
  )
  assert.ok(found, `action missing: ${controlSkillId}`)
  return found
}

function selectedActionHitFrames(controlSkillId) {
  const selected = new Set(action(controlSkillId).selectedHitIdentities)
  return resource.generatedProjection.controls
    .flatMap(entry => entry.hits ?? [])
    .filter((entry) => selected.has(entry.hitIdentity))
    .map((entry) => entry.trigger.startFrame)
    .sort((a, b) => a - b)
}

// Action and runtime resource/cooldown facts.
assert.equal(action(10700210).actionScheduling.durationFrames, 330)
assert.equal(action(10700210).inputTrigger.holdTriggerTimeMs, 250)
assert.equal(action(10700212).actionScheduling.durationFrames, 218)
assert.equal(action(10700226).actionScheduling.durationFrames, 218)
assert.equal(action(10700226).selectedSubSkillIndex, 0)
assert.equal(action(10700213).actionScheduling.durationFrames, 298)
assert.equal(action(10700222).actionScheduling.durationFrames, 150)
assert.equal(control(10700210).logic.cooldownMs, 100)
assert.equal(control(10700212).logic.cooldownMs, 24000)
assert.equal(control(10700213).logic.cooldownMs, 0)
assert.equal(control(10700213).logic.spCost, 100)
assert.equal(control(10700222).logic.cooldownMs, 24000)

same(hitFrames(10700203), [40, 46, 52, 58, 64, 70, 76, 82, 88, 94, 100])
same(spawnFrames(10700203, '3434452943307337244'), [40, 46, 52, 58, 64, 70])
const hpNormalSummon = battleElement('3434452943307337244')
assert.equal(hpNormalSummon.elementConfigId, 107002220)
assert.equal(hpNormalSummon.summonUnitId, 480042)
assert.equal(hpNormalSummon.summonLifeTime, 15000)
assert.equal(hpNormalSummon.summonCount, 1)
assert.equal(hpNormalSummon.summonTotalMaxCount, 6)
assert.equal(hpNormalSummon.summonCountType, 2)

same(hitFrames(10700204), [49, 56, 63, 70, 77, 84, 90, 96, 102])
same(hitFrames(10700210), [48, 51, 63, 69, 76, 83, 90])
const chargedRoot = controlRoot(10700210)
const chargedTrackRefs = refPathIds(
  chargedRoot.skillControlData.skillPlayers[0].skillTrackDatas,
)
assert.equal(chargedTrackRefs[15], '4813059941072756916')
assert.equal(chargedTrackRefs[16], '492007593651855540')
const summonAbsorbTrack = rawClosureEntry(10700210, '4813059941072756916')
same(
  [
    String(summonAbsorbTrack.subSkillUniqueId),
    summonAbsorbTrack.trackIndex,
    summonAbsorbTrack.behaviorlineControl[0].startFrame,
    summonAbsorbTrack.behaviorlineControl[0].endFrame,
    ...refPathIds(summonAbsorbTrack.behaviorlineControl[0].behaviorList),
  ],
  ['17340006214530000', 92, 70, 71, '3637962353715634356'],
  'charged summon-absorb track drifted',
)
const summonAbsorbBehavior = rawClosureEntry(10700210, '3637962353715634356')
same(
  [
    summonAbsorbBehavior.startFrame,
    summonAbsorbBehavior.frameCount,
    summonAbsorbBehavior.directInjectTargetType,
    ...refPathIds(summonAbsorbBehavior.elementDataList),
  ],
  [70, 1, 17, '-2816437001102957180'],
  'charged summon-absorb behavior drifted',
)
const summonAbsorbElement = battleElement('-2816437001102957180')
same(
  [
    summonAbsorbElement.elementConfigId,
    summonAbsorbElement.displacementType,
    summonAbsorbElement.targetType,
    summonAbsorbElement.entityFilterData,
    summonAbsorbElement.radius,
  ],
  [107002233, 2, 2, 64, 9],
  'charged summon-absorb element drifted',
)
const enemyGatherTrack = rawClosureEntry(10700210, '492007593651855540')
same(
  [
    String(enemyGatherTrack.subSkillUniqueId),
    enemyGatherTrack.behaviorlineControl[0].startFrame,
    enemyGatherTrack.behaviorlineControl[0].endFrame,
    ...refPathIds(enemyGatherTrack.behaviorlineControl[0].behaviorList),
  ],
  ['17340006214530000', 70, 71, '5068420164240990388'],
  'charged enemy-gather track drifted',
)
const enemyGatherBehavior = rawClosureEntry(10700210, '5068420164240990388')
same(
  [
    enemyGatherBehavior.startFrame,
    enemyGatherBehavior.frameCount,
    enemyGatherBehavior.directInjectTargetType,
    ...refPathIds(enemyGatherBehavior.elementDataList),
  ],
  [70, 1, 17, '5001916014055185626'],
  'charged enemy-gather behavior drifted',
)
const enemyGatherElement = battleElement('5001916014055185626')
same(
  [
    enemyGatherElement.elementConfigId,
    enemyGatherElement.displacementType,
    enemyGatherElement.targetType,
    enemyGatherElement.entityFilterData,
    enemyGatherElement.radius,
  ],
  [107002230, 2, 1, 18752, 12],
  'charged enemy-gather element drifted',
)
same(
  refPathIds(behavior(10700204, 84, (entry) => Array.isArray(entry.elementBaseDatas)).elementBaseDatas),
  ['1159803510611510720', '-5490397539017617711', '7790264186762117375'],
  'A4 frame 84 source order drifted',
)
same(
  refPathIds(behavior(10700210, 76, (entry) => Array.isArray(entry.elementBaseDatas)).elementBaseDatas),
  ['-1320777497519764210', '-1211965369219084289', '7790264186762117375'],
  'charged frame 76 source order drifted',
)
const defWrapper = battleElement('7790264186762117375')
assert.equal(defWrapper.elementConfigId, 107002256)
assert.equal(defWrapper.combineType, 3)
assert.equal(defWrapper.time, 24000)
const physicalDef = battleElement('-3902053340404252506')
const magicDef = battleElement('1466117413664505892')
same([physicalDef.attributeID, physicalDef.calculateType, physicalDef.functionParams[0]], [3, 2, -1000])
same([magicDef.attributeID, magicDef.calculateType, magicDef.functionParams[0]], [4, 2, -1000])

same(selectedActionHitFrames(10700212), [74, 82, 90, 99, 107, 114])
same(spawnFrames(10700212, '513582975064864872'), [28, 74, 82, 90, 99])
const star82 = behavior(10700212, 82, (entry) => Array.isArray(entry.elementBaseDatas))
same(
  refPathIds(star82.elementBaseDatas),
  ['6857014326835818730', '-3883846112050479707', '-2174275479014567856', '-6104701335743815286'],
  'star frame 82 source order drifted',
)
const star90 = behavior(10700212, 90, (entry) => Array.isArray(entry.toOwnElementBaseDatas))
same(
  refPathIds(star90.toOwnElementBaseDatas),
  ['1474042154774785480', '513582975064864872'],
  'star frame 90 to-own order drifted',
)
const availability = battleElement('-2174275479014567856')
same([availability.elementConfigId, availability.consumeMode, availability.checkTarget, availability.executeTarget, availability.consume], [107002272, 0, 1, 2, 0])
same(availability.elementArr, [550, 750])
assert.equal(availability.consumeLayerNum, 1)
same(refPathIds(availability.injectElementDataList_2), ['3375530858005333853'])
const consuming = battleElement('-6104701335743815286')
same([consuming.elementConfigId, consuming.consumeMode, consuming.checkTarget, consuming.executeTarget, consuming.consume], [107002264, 0, 1, 0, 1])
same(consuming.elementArr, [550, 750])
assert.equal(consuming.consumeLayerNum, 1)
same(
  consuming.injectElementDataEffects.map((entry) => [entry.elementAttr, refPathIds(entry.elements)]),
  [[550, ['2120617582505955581']], [750, ['4731523060341306954']]],
)
const damageBuff = battleElement('3375530858005333853')
same([damageBuff.elementConfigId, damageBuff.combineType, damageBuff.time], [107002265, 3, 30000])
same(refPathIds(damageBuff.injectElementDataList), ['623176689467243005', '1913468686735845945'])
const woodBuff = battleElement('623176689467243005')
const windBuff = battleElement('1913468686735845945')
same([woodBuff.elementConfigId, woodBuff.attributeID, woodBuff.calculateType, woodBuff.functionParams[0]], [107002266, 55, 1, 5])
same([windBuff.elementConfigId, windBuff.attributeID, windBuff.calculateType, windBuff.functionParams[0]], [107002267, 53, 1, 5])
const spSummon = battleElement('513582975064864872')
same(
  [spSummon.elementConfigId, spSummon.summonUnitId, spSummon.summonLifeTime, spSummon.summonCount, spSummon.summonTotalMaxCount, spSummon.summonCountType],
  [107002214, 480041, 15000, 1, 6, 2],
)

same(effectFrames(10700213, 107002022), [143, 155, 167, 181, 193])
for (const effect of control(10700213).effects.filter((entry) => entry.elementId === 107002022)) {
  assert.equal(effect.trigger.targetCode, 3)
  assert.equal(effect.target.kind, 'team-actors')
}
const ultimateHeal = control(10700213).effects.find((entry) => entry.elementId === 107002022)
same(Object.values(ultimateHeal.heal.valueByLevel).map(Number), [600, 660, 720, 780, 840, 900, 960, 1020, 1080, 1140, 1200, 1260])
same(effectFrames(10700213, 550), [144, 150])

const ultimateRoot = controlRoot(10700213)
const ultimateTrackRefs = refPathIds(ultimateRoot.skillControlData.skillPlayers[0].skillTrackDatas)
assert.equal(ultimateTrackRefs[20], '-8475613963682858525')
assert.equal(ultimateTrackRefs[21], '2533660507039054307')
const hpTrack = rawClosureEntry(10700213, '-8475613963682858525')
const spTrack = rawClosureEntry(10700213, '2533660507039054307')
assert.equal(hpTrack.trackIndex, 23)
assert.equal(spTrack.trackIndex, 24)
same(refPathIds(hpTrack.behaviorlineControl[0].behaviorList), ['5308513824935950819'])
same(refPathIds(spTrack.behaviorlineControl[0].behaviorList), ['-2302479272537638429'])
const hpUltimateSummon = rawClosureEntry(10700213, '5308513824935950819')
const spUltimateSummon = rawClosureEntry(10700213, '-2302479272537638429')
same(
  [hpUltimateSummon.startFrame, hpUltimateSummon.summonUnitId, hpUltimateSummon.summonCount, hpUltimateSummon.summonTotalMaxCount, hpUltimateSummon.summonCountType, hpUltimateSummon.summonLifeTime],
  [135, 480042, 3, 6, 1, 15000],
)
same(
  [spUltimateSummon.startFrame, spUltimateSummon.summonUnitId, spUltimateSummon.summonCount, spUltimateSummon.summonTotalMaxCount, spUltimateSummon.summonCountType, spUltimateSummon.summonLifeTime],
  [135, 480041, 3, 6, 1, 15000],
)

same(effectFrames(10700222, 107002240), [46, 61, 79, 98])
for (const effect of control(10700222).effects.filter((entry) => entry.elementId === 107002240)) {
  assert.equal(effect.trigger.targetCode, 3)
  assert.equal(effect.target.kind, 'team-actors')
}
const starCarryHeal = control(10700222).effects.find((entry) => entry.elementId === 107002240)
same(Object.values(starCarryHeal.heal.valueByLevel).map(Number), [200, 220, 240, 260, 280, 300, 320, 340, 360, 380, 400, 420])

const formulas = new Map(resource.rawTables.elementFormulas.rows.map((row) => [row.id, row.functionOutput]))
assert.equal(formulas.get(104), '(self.MAXHP[0]*A)/10000')
assert.equal(formulas.get(1006), 'IF(target.ELEMENT_LAYERS[F]>I,G,0)')
same(
  resource.rawTables.battlefieldItems.rows.map((row) => [row.id, row.param, row.skillList]),
  [[480041, 'Delay#0.1', '1#48004101|2#48004102'], [480042, 'Delay#0.1', '1#48004201|2#48004202']],
)

function pickupCollision(controlSkillId) {
  const found = rawObjects(controlSkillId).find(
    (entry) => entry.targetType === 2 && entry.toOwnMaxCount === 1,
  )
  assert.ok(found, `pickup collision missing: ${controlSkillId}`)
  return found
}

const spCollision = pickupCollision(48004101)
const hpCollision = pickupCollision(48004201)
same(
  controlRoot(48004101).skillControlData.skillPlayers.map((entry) => entry.frameCountDict[0].frameCount),
  [920, 65],
)
same(
  controlRoot(48004201).skillControlData.skillPlayers.map((entry) => entry.frameCountDict[0].frameCount),
  [920, 65],
)
for (const collision of [spCollision, hpCollision]) {
  same(
    [collision.startFrame, collision.frameCount, collision.targetType, collision.interval, collision.toOwnMaxCount],
    [2, 900, 2, 99999, 1],
  )
  assert.equal(collision.keyFrameDatas[0].size.x._serializedValue, 39321)
}
same(refPathIds(spCollision.elementIdDatas), ['-5003344262624947112', '2597380282862822327', '-2125812726072660913'])
same(refPathIds(hpCollision.elementIdDatas), ['5147380714789007564', '-2125812726072660913', '5779641518556524675'])
same(
  rawObjects(48004101)
    .filter((entry) => entry.boardCastType === 1 && entry.value === 1)
    .map((entry) => entry.startFrame),
  [30],
)
same(
  rawObjects(48004201)
    .filter((entry) => entry.boardCastType === 1 && entry.value === 1)
    .map((entry) => entry.startFrame),
  [25],
)
const spReward = battleElement('-5003344262624947112')
assert.equal(spReward.elementConfigId, 107002215)
assert.equal(spReward.shareType, 2)
const hpReward = battleElement('-8742085360987801148')
assert.equal(hpReward.elementConfigId, 107002216)
assert.equal(hpReward.formulaParams.function_2, 104)
assert.equal(hpReward.formulaParams.formulaParamValues[0], 300)

assert.equal(String(runtime.passiveTrack.markerElement.pathId), '7643301625766811642')
assert.equal(runtime.passiveTrack.markerElement.row.typetree.elementConfigId, 107002271)
assert.equal(runtime.passiveTrack.markerElement.row.typetree.combineType, 3)
assert.equal(runtime.passiveTrack.markerElement.row.typetree.time, -1)
same(
  runtime.passiveTrack.resolvedReferenceChain.map((entry) => String(entry.toPathId)),
  ['-2651181542894854447', '-3169485345798086959', '7643301625766811642'],
)
const passiveGate = battleElement('-2125812726072660913')
assert.equal(passiveGate.elementConfigId, 480042003)
assert.equal(passiveGate.formulaParams.function_1, 1006)
assert.equal(passiveGate.formulaParams.formulaParamValues[5], 107002271)
const tuningIntensity = battleElement('-5253142493209012449')
same(
  [tuningIntensity.elementConfigId, tuningIntensity.attributeID, tuningIntensity.calculateType, tuningIntensity.functionParams[0], tuningIntensity.combineType, tuningIntensity.combineNumber, tuningIntensity.time],
  [480041002, 229, 2, 600, 4, 4, 24000],
)

const naControls = contract.optimizationSurface.scenarioOutOfScopeNA.map((entry) => entry.control)
same(naControls, [10700215, 10700211, 10700225, 10700227])
for (const entry of contract.optimizationSurface.scenarioOutOfScopeNA) {
  assert.match(entry.reason, /frozen|outside|requires|forbids/u)
}
assert.equal(contract.implementationSplit.genuinelyMissingGenericPrimitives.length, 0)
assert.ok(contract.implementationSplit.reuseExistingPrimitives.length >= 7)
assert.ok(
  contract.implementationSplit.implementedGenericPrimitives.some(
    (entry) => entry.primitive === 'generic direct-heal formula 104 evaluator',
  ),
)
assert.ok(contract.implementationSplit.implementedGenericPrimitives.length >= 8)
const battleFormulaRuntimeSource = fs.readFileSync(
  path.join(repoRoot, 'src/simulation/mechanics/verifiedBattleEffectFormulaRuntime.js'),
  'utf8',
)
const combatRuntimeSource = fs.readFileSync(
  path.join(repoRoot, 'src/simulation/mechanics/verifiedCombatRuntime.js'),
  'utf8',
)
const compilerSource = fs.readFileSync(
  path.join(repoRoot, 'scripts/character-combat/character-combat-contract-compiler.mjs'),
  'utf8',
)
assert.match(
  battleFormulaRuntimeSource,
  /baseFunctionId\s*===\s*104/u,
  'formula 104 evaluator is missing from the accepted S1 implementation',
)
assert.match(combatRuntimeSource, /usesSourceMaximumHpRatioFormula\s*=\s*baseFunctionId\s*===\s*104/u)
const directSpCompilerStart = compilerSource.indexOf('function compileRuntimeDirectSp')
const directSpCompilerEnd = compilerSource.indexOf('\nfunction ', directSpCompilerStart + 1)
const directSpCompilerSource = compilerSource.slice(directSpCompilerStart, directSpCompilerEnd)
assert.ok(directSpCompilerStart >= 0 && directSpCompilerEnd > directSpCompilerStart)
assert.match(
  directSpCompilerSource,
  /asset\.tree\?\.shareType/u,
  'direct-SP compiler must read source shareType',
)
assert.match(directSpCompilerSource, /expectedShareType/u)
assert.doesNotMatch(directSpCompilerSource, /shareType:\s*0/u)
assert.ok(
  contract.implementationSplit.implementedGenericPrimitives.some(
    (entry) => entry.primitive === 'direct-SP ShareAll compiler binding',
  ),
)
assert.ok(contract.potentialIntegrationConflicts.knownParallelCharacters.some((entry) => entry.id === 108003))
assert.ok(contract.potentialIntegrationConflicts.knownParallelCharacters.some((entry) => entry.id === 107001))
assert.ok(contract.potentialIntegrationConflicts.knownParallelCharacters.some((entry) => entry.id === 102001))
if (conflicts) {
  assert.equal(conflicts.kind, 'm12-b3-parallel-integration-conflict-read-only-snapshot')
  same(conflicts.worktrees.map((entry) => entry.characterId), [108003, 102001, 107001])
  const conflictsByCharacter = new Map(
    conflicts.worktrees.map((entry) => [entry.characterId, entry]),
  )
  assert.ok(
    conflictsByCharacter.get(108003).directSharedRuntimeCompilerTest.some(
      (entry) =>
        entry.path === 'scripts/character-combat/character-combat-contract-compiler.mjs',
    ),
  )
  assert.ok(
    conflictsByCharacter.get(102001).directSharedRuntimeCompilerTest.some(
      (entry) => entry.path === 'src/simulation/mechanics/verifiedTargetStateRuntime.js',
    ),
  )
  assert.ok(
    conflictsByCharacter.get(107001).directSharedRuntimeCompilerTest.some(
      (entry) => entry.path === 'src/simulation/mechanics/verifiedTuningMarkGeneration.js',
    ),
  )
}

console.log(JSON.stringify({
  status: 'ok',
  mode: allowDirtySidecar ? 'allow-dirty-sidecar' : 'strict-post-commit-clean',
  characterId: 107002,
  inheritedEvidenceBaseline: INHERITED_EVIDENCE_BASELINE,
  r2IntegrationBaseline: BASELINE,
  dynamicConflictSnapshotPresent: conflicts != null,
  touchedPathCount: touchedPaths.size,
  coreArtifactHashes: {
    resource: fileSha256('resource-graph-excerpt.json'),
    runtime: fileSha256('runtime-evidence-excerpt.json'),
  },
  evidence: {
    actions: resource.generatedProjection.actions.length,
    controls: resource.generatedProjection.controls.length,
    battleElementClosure: resource.rawUnity.battleElementClosure.length,
    runtimeEnums: runtime.runtimeEnums.length,
    consumePackExecuteOrder: runtime.consumePackExecute.verifiedDirectCallOrder.map((entry) => entry.targetMethod),
  },
  claims: {
    formalAdmission: false,
    optimizationReady: false,
  },
}, null, 2))
