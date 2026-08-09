import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const repoRoot = path.resolve(import.meta.dirname, '../../..')
const outputPath = path.join(import.meta.dirname, 'resource-graph-excerpt.json')
const generatedRoot = path.join(repoRoot, 'src/data/generated')
const newTableRoot = 'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable'
const languageRoot = 'C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table'
const extractorBattleRoot =
  'C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle'
const skillListRoot = path.join(extractorBattleRoot, 'SkillList')
const battleElementIndexPath =
  'C:/PC2/Codex/AzPr/work/combat-formulas/battle-element-assets.jsonl'
const tuningConsumePriorityEvidencePath = path.join(
  repoRoot,
  'scripts/evidence/tuning-consume-priority-runtime-evidence.json',
)

const INHERITED_EVIDENCE_BASELINE = '140eefcd233cd9c1d136728f1c94b91aff632278'
const EXPECTED_PRODUCTION_BASELINE = '1a56e0a295f31298da6c3ddb5d70db90183971fb'
const EXPECTED_BRANCH = 'fix/m12-b3-107002-charged-absorb'
const ALLOWED_EVIDENCE_CARRIER_PREFIX = 'work/m12-b3/parallel-evidence-107002/'
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
const supportedFlags = new Set(['--assert-clean', '--assert-current'])
const flags = new Set(process.argv.slice(2))
for (const flag of flags) {
  if (!supportedFlags.has(flag)) throw new Error(`unsupported argument: ${flag}`)
}
if (flags.has('--assert-clean') && flags.has('--assert-current')) {
  throw new Error('--assert-clean and --assert-current are mutually exclusive')
}
const artifactMode = flags.has('--assert-clean')
  ? 'assert-clean'
  : flags.has('--assert-current')
    ? 'assert-current'
    : 'write-if-changed'

const TARGET_CHARACTER_ID = 107002
const TARGET_CONTROL_IDS = new Set([
  10700201,
  10700202,
  10700203,
  10700204,
  10700205,
  10700210,
  10700211,
  10700212,
  10700213,
  10700215,
  10700222,
  10700225,
  10700226,
  10700227,
])
const PICKUP_CONTROL_IDS = [48004101, 48004102, 48004201, 48004202]
const PASSIVE_CONTROL_IDS = [10700261]
const FOCUSED_TRACK_CONTROL_IDS = new Set([
  10700203,
  10700204,
  10700210,
  10700211,
  10700212,
  10700213,
  10700215,
  10700222,
  10700225,
  10700226,
  10700227,
  ...PICKUP_CONTROL_IDS,
  ...PASSIVE_CONTROL_IDS,
])
const RAW_CONTROL_IDS = [...TARGET_CONTROL_IDS, ...PICKUP_CONTROL_IDS, ...PASSIVE_CONTROL_IDS]

function normalizePath(value) {
  return value.replaceAll('\\', '/')
}

function isAllowedCarrierPath(value) {
  const normalized = normalizePath(value)
  return (
    normalized.startsWith(ALLOWED_EVIDENCE_CARRIER_PREFIX) ||
    ALLOWED_IMPLEMENTATION_PATHS.some(allowed =>
      allowed.endsWith('/**')
        ? normalized.startsWith(allowed.slice(0, -2))
        : normalized === allowed,
    )
  )
}

function parseLosslessJson(text) {
  // Unity PathIDs and localization IDs exceed Number.MAX_SAFE_INTEGER. Quote only
  // integer tokens with at least 16 digits before parsing so evidence identities
  // stay exact in the generated sidecar.
  const protectedText = text.replace(
    /([:\[,]\s*)(-?\d{16,})(?=\s*[,}\]])/g,
    '$1"$2"',
  )
  return JSON.parse(protectedText)
}

function readJson(filePath) {
  return parseLosslessJson(fs.readFileSync(filePath, 'utf8'))
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function sha256Bytes(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: options.encoding ?? 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  })
}

function gitLines(args) {
  return git(args)
    .split(/\r?\n/u)
    .map(entry => entry.trim())
    .filter(Boolean)
}

function assertFrozenProductionSourceTree() {
  try {
    git(['merge-base', '--is-ancestor', EXPECTED_PRODUCTION_BASELINE, 'HEAD'], {
      stdio: 'ignore',
    })
  } catch {
    throw new Error(
      `carrier HEAD is not descended from frozen production baseline ${EXPECTED_PRODUCTION_BASELINE}`,
    )
  }
  const branch = git(['branch', '--show-current']).trim()
  if (branch !== EXPECTED_BRANCH) {
    throw new Error(`unexpected carrier branch: ${branch}`)
  }
  const touched = new Set([
    ...gitLines(['diff', '--name-only', `${EXPECTED_PRODUCTION_BASELINE}..HEAD`]),
    ...gitLines(['diff', '--name-only']),
    ...gitLines(['diff', '--cached', '--name-only']),
    ...gitLines(['ls-files', '--others', '--exclude-standard']),
  ])
  const forbidden = [...touched].filter(entry => !isAllowedCarrierPath(entry))
  if (forbidden.length > 0) {
    throw new Error(
      `repository drift outside evidence carrier and R2 implementation allowlist: ${forbidden.join(', ')}`,
    )
  }
}

function deterministicSourceMetadata() {
  return {
    frozenProductionBaseline: {
      commit: EXPECTED_PRODUCTION_BASELINE,
      inheritedEvidenceBaselineCommit: INHERITED_EVIDENCE_BASELINE,
      comparisonPolicy:
        'reject-repository-drift-outside-evidence-carrier-and-r2-implementation-allowlist',
      allowedEvidenceCarrierPrefix: ALLOWED_EVIDENCE_CARRIER_PREFIX,
      allowedImplementationPaths: [...ALLOWED_IMPLEMENTATION_PATHS],
      scopeGuard: 'passed',
    },
    evidenceCarrier: {
      policy: 'sidecar-commit-agnostic',
      commitEmbedded: false,
      branchEmbedded: false,
    },
    artifactDeterminism: {
      serialization: 'utf8-json-pretty-2-lf',
      volatileFields: [],
      assertCleanSupported: true,
    },
  }
}

function committedArtifactBytes() {
  const relativeOutput = normalizePath(path.relative(repoRoot, outputPath))
  try {
    return execFileSync('git', ['show', `HEAD:${relativeOutput}`], {
      cwd: repoRoot,
      maxBuffer: 32 * 1024 * 1024,
    })
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? '').trim()
    throw new Error(
      `cannot read committed artifact at HEAD:${relativeOutput}${detail ? `: ${detail}` : ''}`,
      { cause: error },
    )
  }
}

function finalizeArtifact(serialized) {
  const generatedBytes = Buffer.from(serialized, 'utf8')
  const workingBytes = fs.existsSync(outputPath) ? fs.readFileSync(outputPath) : null
  if (artifactMode === 'assert-clean') {
    const committedBytes = committedArtifactBytes()
    if (workingBytes == null || !workingBytes.equals(committedBytes)) {
      throw new Error(
        `working artifact differs from committed artifact: ${sourceIdentity(outputPath)}`,
      )
    }
    if (!generatedBytes.equals(committedBytes)) {
      throw new Error(
        `recomputed artifact differs from committed artifact: ${sourceIdentity(outputPath)}`,
      )
    }
    return { wrote: false, sha256: sha256Bytes(generatedBytes) }
  }
  if (artifactMode === 'assert-current') {
    if (workingBytes == null || !generatedBytes.equals(workingBytes)) {
      throw new Error(
        `recomputed artifact differs from working artifact: ${sourceIdentity(outputPath)}`,
      )
    }
    return { wrote: false, sha256: sha256Bytes(generatedBytes) }
  }
  const wrote = workingBytes == null || !generatedBytes.equals(workingBytes)
  if (wrote) fs.writeFileSync(outputPath, generatedBytes)
  return { wrote, sha256: sha256Bytes(generatedBytes) }
}

function sourceIdentity(filePath) {
  return normalizePath(path.resolve(filePath))
}

function sourceRecord(filePath) {
  const stat = fs.statSync(filePath)
  return {
    sourceIdentity: sourceIdentity(filePath),
    bytes: stat.size,
    sha256: sha256(filePath),
  }
}

function tableRows(fileName, predicate) {
  const filePath = path.join(newTableRoot, fileName)
  const table = readJson(filePath)
  return {
    source: sourceRecord(filePath),
    fields: table.fields,
    rows: table.rows.filter(predicate),
  }
}

function findControlRoot(controlSkillId) {
  const directory = path.join(skillListRoot, `skill_control_${controlSkillId}.asset`, 'MonoBehaviour')
  if (!fs.existsSync(directory)) {
    return { controlSkillId, status: 'source-directory-missing', directory: sourceIdentity(directory) }
  }

  const candidates = fs
    .readdirSync(directory)
    .filter(fileName => fileName.startsWith(`skill_control_${controlSkillId}__`) && fileName.endsWith('.json'))

  for (const fileName of candidates) {
    const filePath = path.join(directory, fileName)
    const parsed = readJson(filePath)
    if (parsed.skillControlData?.skillId === controlSkillId) {
      return {
        controlSkillId,
        status: 'source-control-root-found',
        directory: sourceIdentity(directory),
        file: sourceRecord(filePath),
        data: parsed,
      }
    }
  }

  return {
    controlSkillId,
    status: 'source-control-root-unresolved',
    directory: sourceIdentity(directory),
    candidates,
  }
}

function collectPathIds(value, result = new Set()) {
  if (Array.isArray(value)) {
    for (const entry of value) collectPathIds(entry, result)
    return result
  }
  if (!value || typeof value !== 'object') return result
  for (const [key, child] of Object.entries(value)) {
    if (key === 'm_PathID' && String(child) !== '0') result.add(String(child))
    else collectPathIds(child, result)
  }
  return result
}

function controlRootSummary(control) {
  if (!control.data) return control
  return {
    controlSkillId: control.controlSkillId,
    status: control.status,
    directory: control.directory,
    file: control.file,
    skillControlData: control.data.skillControlData,
    skillResourceMaps: control.data.skillResourceMaps,
  }
}

function resolveControlTrackClosure(control) {
  if (!control.data) return []
  const directory = control.directory.replaceAll('/', path.sep)
  const files = fs.readdirSync(directory)
  const queue = [...collectPathIds(control.data.skillControlData)]
  const seen = new Set()
  const closure = []

  while (queue.length > 0) {
    const pathId = queue.shift()
    if (seen.has(pathId)) continue
    seen.add(pathId)
    const suffix = `__${pathId}.json`
    const fileName = files.find(candidate => candidate.endsWith(suffix))
    if (!fileName) {
      closure.push({ pathId, status: 'external-or-unresolved-control-reference' })
      continue
    }
    const filePath = path.join(directory, fileName)
    const data = readJson(filePath)
    closure.push({ pathId, status: 'resolved-control-reference', file: sourceRecord(filePath), data })
    for (const childPathId of collectPathIds(data)) {
      if (!seen.has(childPathId)) queue.push(childPathId)
    }
  }
  return closure
}

function buildBattleElementLineIndex() {
  const index = new Map()
  const lines = fs.readFileSync(battleElementIndexPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line) continue
    const match = line.match(/"path_id":\s*(-?\d+)/)
    if (match) index.set(match[1], line)
  }
  return index
}

function collectBattleElementClosure(rootPathIds, lineIndex) {
  const queue = [...rootPathIds]
  const seen = new Set()
  const nodes = []

  while (queue.length > 0) {
    const pathId = String(queue.shift())
    if (seen.has(pathId)) continue
    seen.add(pathId)
    const line = lineIndex.get(pathId)
    if (!line) {
      nodes.push({ pathId, status: 'not-in-battle-element-index' })
      continue
    }
    const data = parseLosslessJson(line)
    nodes.push({ pathId, status: 'resolved-battle-element', data })
    for (const childPathId of collectPathIds(data.typetree)) {
      if (!seen.has(childPathId) && lineIndex.has(childPathId)) queue.push(childPathId)
    }
  }

  return nodes
}

function summarizeHit(hit) {
  return {
    hitIdentity: hit.hitIdentity,
    mapIndex: hit.mapIndex,
    referenceKind: hit.referenceKind,
    elementId: hit.elementId,
    pathId: hit.pathId,
    name: hit.name,
    displayLabel: hit.displayLabel,
    hitIndex: hit.hitIndex,
    trigger: hit.trigger,
    runtimeCondition: hit.runtimeCondition,
    scenarioRuntimeStatus: hit.scenarioRuntimeStatus,
    damage: hit.damage,
    energy: hit.energy,
    sourceIdentity: hit.sourceIdentity,
  }
}

function summarizeEffect(effect) {
  return {
    effectIdentity: effect.effectIdentity,
    graphIdentity: effect.graphIdentity,
    mapIndex: effect.mapIndex,
    elementId: effect.elementId,
    pathId: effect.pathId,
    rootElementId: effect.rootElementId,
    rootPathId: effect.rootPathId,
    depth: effect.depth,
    kind: effect.kind,
    name: effect.name,
    displayLabel: effect.displayLabel,
    classification: effect.classification,
    status: effect.status,
    applied: effect.applied,
    scenarioRuntimeStatus: effect.scenarioRuntimeStatus,
    trigger: effect.trigger,
    target: effect.target,
    activationConditions: effect.activationConditions,
    lifecycle: effect.lifecycle,
    dimensions: effect.dimensions,
    damage: effect.damage,
    heal: effect.heal,
    directSp: effect.directSp,
    directSpPresence: effect.directSpPresence,
    propertyChange: effect.propertyChange,
    tuningMark: effect.tuningMark,
    tuningOverlimit: effect.tuningOverlimit,
    relationPath: effect.relationPath,
    sourceOrder: effect.sourceOrder,
    reasons: effect.reasons,
    sourceIdentity: effect.sourceIdentity,
  }
}

function summarizeAction(action) {
  return {
    identity: action.identity,
    sourceSkillId: action.sourceSkillId,
    sourceSkillName: action.sourceSkillName,
    actionVariantIndex: action.actionVariantIndex,
    actionVariantLabel: action.actionVariantLabel,
    actionKind: action.actionKind,
    controlSkillId: action.controlSkillId,
    selectedSubSkillIndex: action.selectedSubSkillIndex,
    inputTrigger: action.inputTrigger,
    runtimeHitCount: action.runtimeHitCount,
    runtimeEffectCount: action.runtimeEffectCount,
    runtimeResourceTransactionCount: action.runtimeResourceTransactionCount,
    selectedHitIdentities: action.selectedHitIdentities,
    selectedEffectIdentities: action.selectedEffectIdentities,
    selectedResourceTransactionIdentities: action.selectedResourceTransactionIdentities,
    classification: action.classification,
    mechanicsClassification: action.mechanicsClassification,
    scenarioRuntimeStatus: action.scenarioRuntimeStatus,
    actionScheduling: action.actionScheduling,
    timingStatus: action.timingStatus,
    reasons: action.reasons,
    attackInputSegments: (action.attackInputSegments ?? []).map(segment => ({
      identity: segment.identity,
      label: segment.label,
      controlSkillId: segment.controlSkillId,
      selectedSubSkillIndex: segment.selectedSubSkillIndex,
      inputTrigger: segment.inputTrigger,
      durationFrames: segment.durationFrames,
      hitEndFrame: segment.hitEndFrame,
      linkWindow: segment.linkWindow,
      selectedHitIdentities: segment.selectedHitIdentities,
      selectedEffectIdentities: segment.selectedEffectIdentities,
      scenarioRuntimeStatus: segment.scenarioRuntimeStatus,
      reasons: segment.reasons,
    })),
  }
}

function parseBattleItemGraph() {
  const filePath = path.join(
    extractorBattleRoot,
    'Graph/ast_battle_item_107002.asset/MonoBehaviour/ast_battle_item_107002__-2780452238923438569.json',
  )
  const raw = readJson(filePath)
  const graph = JSON.parse(raw._serializedGraph)
  return {
    file: sourceRecord(filePath),
    graph: {
      type: graph.type,
      nodes: graph.nodes.map(node => ({
        id: node.$id ?? null,
        type: node.$type,
        eventValue: node.eventValue ?? null,
        filterType: node.m_filterType ?? null,
        updateInterval: node.updateInterval?._value ?? null,
        value: node.value?._value ?? node.value?._name ?? null,
        targetVariable: node.targetVariable?._name ?? null,
      })),
      connections: graph.connections.map(connection => ({
        sourceNode: connection._sourceNode?.$ref ?? null,
        sourcePort: connection._sourcePortName,
        targetNode: connection._targetNode?.$ref ?? null,
        targetPort: connection._targetPortName,
        type: connection.$type,
      })),
      localBlackboard: graph.localBlackboard,
    },
  }
}

assertFrozenProductionSourceTree()

const mechanicsPath = path.join(generatedRoot, 'verified-combat-mechanics-package.json')
const charactersPath = path.join(generatedRoot, 'characters.json')
const skillsPath = path.join(generatedRoot, 'skills.json')
const mechanics = readJson(mechanicsPath)
const characters = readJson(charactersPath)
const skills = readJson(skillsPath)
const rawControls = RAW_CONTROL_IDS.map(findControlRoot)
const rawControlSummaries = rawControls.map(controlRootSummary)

const packageControls = mechanics.controlBindings.filter(control =>
  TARGET_CONTROL_IDS.has(control.controlSkillId),
)
const packageVariantControls = mechanics.actionVariantControlBindings.filter(control =>
  TARGET_CONTROL_IDS.has(control.controlSkillId),
)
const allPackageControls = [...packageControls, ...packageVariantControls]
const packageEffects = allPackageControls.flatMap(control => control.effects ?? [])
const packageGraphPathIds = new Set(
  allPackageControls.flatMap(control =>
    (control.effectGraph ?? []).flatMap(graph => [
      graph.rootPathId,
      ...(graph.nodeIdentities ?? []).map(identity => identity.split('element:').at(-1)),
    ]),
  ),
)

const rawResourcePathIds = new Set()
for (const control of rawControls) {
  for (const resourceMap of control.data?.skillResourceMaps ?? []) {
    for (const pathId of collectPathIds(resourceMap)) rawResourcePathIds.add(pathId)
  }
}
for (const pathId of packageGraphPathIds) {
  if (pathId != null) rawResourcePathIds.add(String(pathId))
}

const battleElementLineIndex = buildBattleElementLineIndex()
const battleElementClosure = collectBattleElementClosure(rawResourcePathIds, battleElementLineIndex)
const closurePathIds = new Set(battleElementClosure.map(node => node.pathId))
const closureElementIds = new Set(
  battleElementClosure
    .map(node => node.data?.typetree?.elementConfigId)
    .filter(value => value != null)
    .map(String),
)

const selectedBattleCatalogNodes = mechanics.battleEffectCatalog.nodes.filter(
  node => closurePathIds.has(String(node.pathId)) || closureElementIds.has(String(node.elementId)),
)
const selectedSemanticEffects = mechanics.semanticEffectCatalog.semanticEffects.filter(effect => {
  if (TARGET_CONTROL_IDS.has(effect.controlSkillId)) return true
  return closurePathIds.has(String(effect.pathId)) || closureElementIds.has(String(effect.elementId))
})

const battlefieldItems = tableRows(
  'battlefield_item.json',
  row => row.path === 'Config/Battle/Graph/ast_battle_item_107002.asset',
)
const battlefieldLangPath = path.join(languageRoot, 'lang_battlefield_item.json')
const battlefieldLang = readJson(battlefieldLangPath)
const battlefieldNameIds = new Set(battlefieldItems.rows.map(row => String(row.displayName)))
const guidePicLangPath = path.join(languageRoot, 'lang_guide_pic.json')
const wordsLangPath = path.join(languageRoot, 'lang_words.json')
const guidePicLang = readJson(guidePicLangPath)
const wordsLang = readJson(wordsLangPath)
const chargedAbsorbGuideIds = new Set([
  '48979807044608',
  '48979807045120',
  '48979807045632',
])
const chargedAbsorbWordIds = new Set(['3261540932764438781'])

const selectedElementIds = new Set([
  ...closureElementIds,
  ...packageEffects.map(effect => String(effect.elementId)),
])
const skillsubElementValues = tableRows(
  'skillsub_ele_value.json',
  row => selectedElementIds.has(String(row.elementId)),
)
const elementFormulas = tableRows('element_formula.json', row => [104, 1006].includes(row.id))

const focusedTrackClosures = rawControls
  .filter(control => FOCUSED_TRACK_CONTROL_IDS.has(control.controlSkillId))
  .map(control => ({
    controlSkillId: control.controlSkillId,
    closure: resolveControlTrackClosure(control),
  }))

const sourceFiles = [
  mechanicsPath,
  charactersPath,
  skillsPath,
  battleElementIndexPath,
  path.join(newTableRoot, 'hero.json'),
  path.join(newTableRoot, 'skill.json'),
  path.join(newTableRoot, 'skill_level.json'),
  path.join(newTableRoot, 'skillsub_logic.json'),
  path.join(newTableRoot, 'skillsub_ele_value.json'),
  path.join(newTableRoot, 'element_formula.json'),
  path.join(newTableRoot, 'battlefield_item.json'),
  battlefieldLangPath,
  guidePicLangPath,
  wordsLangPath,
  tuningConsumePriorityEvidencePath,
]

const output = {
  schemaVersion: 2,
  kind: 'm12-b3-107002-read-only-evidence-excerpt',
  ...deterministicSourceMetadata(),
  scope: {
    characterId: TARGET_CHARACTER_ID,
    characterName: '米砂',
    productScenario: 'm12c-zero-distance-passive-boss-v1',
    sourceOnly: true,
  },
  sourceFiles: sourceFiles.map(sourceRecord),
  generatedProjection: {
    character: characters.items.find(item => item.id === TARGET_CHARACTER_ID),
    skills: skills.items.filter(item => item.characterId === TARGET_CHARACTER_ID),
    actions: mechanics.actionMappings
      .filter(action => action.ownerKind === 'actor' && action.ownerId === TARGET_CHARACTER_ID)
      .map(summarizeAction),
    controls: allPackageControls.map(control => ({
      controlSkillId: control.controlSkillId,
      status: control.status,
      applied: control.applied,
      confidence: control.confidence,
      sourcePath: control.sourcePath,
      frameRate: control.frameRate,
      frameCounts: control.frameCounts,
      logic: control.logic,
      variants: control.variants,
      hits: (control.hits ?? []).map(summarizeHit),
      effects: (control.effects ?? []).map(summarizeEffect),
      effectGraph: control.effectGraph,
    })),
    battleEffectCatalogNodes: selectedBattleCatalogNodes,
    semanticEffects: selectedSemanticEffects,
  },
  rawTables: {
    hero: tableRows('hero.json', row => row.id === TARGET_CHARACTER_ID),
    skills: tableRows(
      'skill.json',
      row => row.id >= TARGET_CHARACTER_ID * 100 && row.id < (TARGET_CHARACTER_ID + 1) * 100,
    ),
    skillLevels: tableRows(
      'skill_level.json',
      row => [10700201, 10700212, 10700213, 10700222, 10700261, 10700262].includes(row.skillId),
    ),
    skillLogic: tableRows('skillsub_logic.json', row => RAW_CONTROL_IDS.includes(row.skillId)),
    skillElementValues: skillsubElementValues,
    elementFormulas,
    battlefieldItems,
    battlefieldItemNames: {
      source: sourceRecord(battlefieldLangPath),
      rows: battlefieldLang.rows.filter(row => battlefieldNameIds.has(String(row.id))),
    },
    chargedAbsorbGuidance: {
      guidePic: {
        source: sourceRecord(guidePicLangPath),
        rows: guidePicLang.rows.filter(row => chargedAbsorbGuideIds.has(String(row.id))),
      },
      words: {
        source: sourceRecord(wordsLangPath),
        rows: wordsLang.rows.filter(row => chargedAbsorbWordIds.has(String(row.id))),
      },
    },
  },
  rawUnity: {
    controlRoots: rawControlSummaries,
    focusedControlTrackClosures: focusedTrackClosures,
    battlefieldItemGraph: parseBattleItemGraph(),
    battleElementIndex: sourceRecord(battleElementIndexPath),
    battleElementRootPathIds: [...rawResourcePathIds].sort(),
    battleElementClosure,
  },
  existingRuntimeEvidence: {
    tuningConsumePriority: {
      source: sourceRecord(tuningConsumePriorityEvidencePath),
      data: readJson(tuningConsumePriorityEvidencePath),
    },
  },
}

const artifactResult = finalizeArtifact(`${JSON.stringify(output, null, 2)}\n`)
console.log(
  JSON.stringify(
    {
      outputPath: sourceIdentity(outputPath),
      mode: artifactMode,
      wrote: artifactResult.wrote,
      sha256: artifactResult.sha256,
      actions: output.generatedProjection.actions.length,
      controls: output.generatedProjection.controls.length,
      semanticEffects: selectedSemanticEffects.length,
      battleElementRoots: rawResourcePathIds.size,
      battleElementClosure: battleElementClosure.length,
      skillElementValueRows: skillsubElementValues.rows.length,
    },
    null,
    2,
  ),
)
