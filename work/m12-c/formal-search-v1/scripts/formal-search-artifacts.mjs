import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION = 1;
export const FORMAL_SEARCH_RANKING_CLAIM = 'AI-guided heuristic Top-N';

const CYCLE_OBJECTIVES = new Set([
  'cycle-dps-no-toughness',
  'cycle-dps-with-toughness',
]);
const FASTEST_KILL_OBJECTIVE = 'fastest-kill';
const CYCLE_PRESET_ID = 'm12c-cycle-cold-zero-state-v1';
const KILL_PRESET_ID = 'm12c-kill-full-sp-ruby12-zero-marks-v1';
const INITIAL_STATE_POLICY_ID = 'm12c-initial-state-v1';
const INITIAL_STATE_POLICY_VERSION = '1.0.0';
const INITIAL_STATE_POLICY_HASH =
  'd73197058df0f0de30dc6a480a4d768001b674f0ef111b6abd21ec6d540761cf';
const MECHANICS_PACKAGE_ID = 'azpr-tc-2026-07-18';
const MECHANICS_PACKAGE_HASH =
  'fb3fafcd488371274e0c58bb9d3b62a6670abdc365fb210102905539cc827a58';
const ENEMY_PROFILE_HASH = 'cb1edcc277fcda5b';
const RUBY_RESOURCE_IDENTITY = 'actor:103002:element:103002047';
const RUBY_RESOURCE_SOURCE_IDENTITY =
  'C:/PC2/Codex/AzPr/outputs/il2cpp-tc-catch-20260709/dump.cs#ModuleChargingSkill103002._burstElementId|C:/Codex/AzPr Extractor/ExtractedAssets/Unity/default_package/ResourcesAssets/Config/Battle/Element/ast_103002047.asset/MonoBehaviour/ast_103002047__3663436943335475859.json#elementConfigId=103002047';
const FINAL_INITIAL_RUNTIME_STATE_KEYS = new Set([
  'controlledActor',
  'kiboEnergyBySlot',
  'tuningMarks',
  'specialResourcesByActor',
]);
const FINAL_RUBY_RESOURCE_KEYS = new Set([
  'actorId',
  'characterId',
  'resourceIdentity',
  'currentValue',
  'maxValue',
  'inputStep',
  'scenarioConfigurable',
  'activeStates',
]);

export function stableJson(value) {
  return JSON.stringify(normalizeStableValue(value));
}

export function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function sha256Canonical(value) {
  return sha256Text(stableJson(value));
}

export async function writeJsonAtomic(filePath, value) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  await fs.mkdir(directory, { recursive: true });
  const temporaryPath = path.join(
    directory,
    `.${path.basename(absolutePath)}.${process.pid}.${crypto.randomUUID()}.tmp`
  );
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(temporaryPath, text, 'utf8');
  await fs.rename(temporaryPath, absolutePath);
  return {
    path: absolutePath,
    sha256: sha256Text(text),
    bytes: Buffer.byteLength(text),
  };
}

export async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

export function createCandidateRawIdentity(result, objective) {
  const payload = {
    objective: String(objective),
    buildHash: result?.m12c?.buildHash ?? null,
    sourceConfigIdentity: result?.m12c?.sourceConfigIdentity ?? null,
    initialFront: result?.m12c?.initialFront ?? null,
    initialStatePresetHash:
      result?.axis?.scenario?.initialStatePreset?.presetHash ?? null,
    inputHash: result?.hashes?.input ?? null,
    traceHash: result?.hashes?.trace ?? null,
  };
  return {
    schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
    kind: 'azpr-m12c-raw-candidate-identity',
    identityHash: sha256Canonical(payload),
    ...payload,
  };
}

export function validateFinalCandidate(result, objective) {
  const issues = [];
  if (!result || typeof result !== 'object') {
    return { valid: false, issues: ['candidate-not-object'] };
  }
  if (result.finalScoreEligible !== true) {
    issues.push('candidate-final-score-ineligible');
  }
  if (!Number.isFinite(Number(result.score))) {
    issues.push('candidate-score-invalid');
  }
  if (result.legality?.valid !== true) {
    issues.push('candidate-legality-invalid');
  }
  if (result.legality?.proof?.passed !== true) {
    issues.push('candidate-legality-proof-failed');
  }
  if (Number(result.legality?.proof?.skippedActionCount ?? 0) !== 0) {
    issues.push('candidate-legality-skipped-actions-present');
  }
  if (Number(result.legality?.proof?.unresolvedActionCount ?? 0) !== 0) {
    issues.push('candidate-legality-unresolved-actions-present');
  }
  if (Number(result.legality?.invalidActionCount ?? 0) !== 0) {
    issues.push('candidate-legality-invalid-actions-present');
  }
  if (result.objectiveProof?.valid !== true) {
    issues.push('candidate-objective-proof-failed');
  }
  if (!Number.isFinite(Number(result.objectiveProof?.formalScore))) {
    issues.push('candidate-formal-score-missing');
  }
  if ((result.objectiveIssues ?? []).length > 0) {
    issues.push('candidate-objective-issues-present');
  }
  if (!result.m12c?.buildHash || !result.m12c?.sourceConfigIdentity) {
    issues.push('candidate-m12c-build-identity-missing');
  }
  if (!result.axis?.scenario?.initialStatePreset?.presetHash) {
    issues.push('candidate-initial-state-preset-hash-missing');
  }
  if (
    result.axis?.scenario?.objectiveContract?.objectiveId !== String(objective)
  ) {
    issues.push('candidate-objective-contract-mismatch');
  }
  if (Number(result.axis?.scenario?.enemy?.enemyId) !== 310054) {
    issues.push('candidate-enemy-id-mismatch');
  }
  if (Number(result.axis?.scenario?.enemy?.level) !== 80) {
    issues.push('candidate-enemy-level-mismatch');
  }
  if (result.axis?.scenario?.enemy?.profile?.profileHash !== ENEMY_PROFILE_HASH) {
    issues.push('candidate-enemy-profile-hash-mismatch');
  }
  if (result.axis?.scenario?.optimizationQualification?.mode !== 'formal') {
    issues.push('candidate-qualification-mode-not-formal');
  }
  if (result.axis?.scenario?.critical?.policy !== 'expected') {
    issues.push('candidate-critical-policy-not-expected');
  }
  if (result.axis?.scenario?.critical?.seed != null) {
    issues.push('candidate-critical-seed-not-null');
  }
  if (result.axis?.scenario?.jointAttackRuntime?.formalReady !== true) {
    issues.push('candidate-joint-attack-runtime-not-formal-ready');
  }
  if (result.axis?.scenario?.jointAttackRuntime?.clientParityReady !== false) {
    issues.push('candidate-client-parity-boundary-invalid');
  }
  validateBuildAndFront(result, issues);
  validateActionSurface(result, issues);
  issues.push(
    ...analyzeFinalCandidateInitialState(result, String(objective)).issues
  );
  return { valid: issues.length === 0, issues };
}

export function analyzeFinalCandidateInitialState(result, objective) {
  const issues = [];
  const details = validateObjectiveScopedInitialState(
    result,
    String(objective),
    issues
  );
  return {
    valid: issues.length === 0,
    issues,
    ...details,
  };
}

function validateBuildAndFront(result, issues) {
  const actors = Array.isArray(result.m12c?.build?.actors)
    ? result.m12c.build.actors
    : [];
  if (actors.length !== 3) {
    issues.push('candidate-build-actor-count-not-three');
    return;
  }
  const optimizationObjectIds = actors.map(actor =>
    String(actor?.optimizationObjectId ?? '')
  );
  if (new Set(optimizationObjectIds).size !== 3) {
    issues.push('candidate-build-optimization-object-duplicate');
  }
  if (!optimizationObjectIds.includes('109001')) {
    issues.push('candidate-build-moyin-missing');
  }
  const sourceCharacterIds = actors.map(actor => Number(actor?.sourceCharacterId));
  if (
    sourceCharacterIds.filter(characterId =>
      characterId === 199001 || characterId === 199002
    ).length > 1
  ) {
    issues.push('candidate-starborn-source-alias-double-counted');
  }
  for (const actor of actors) {
    if (
      actor?.optimizationObjectId === 'STARBORN' &&
      ![199001, 199002].includes(Number(actor?.sourceCharacterId))
    ) {
      issues.push('candidate-starborn-source-alias-invalid');
    }
    if (
      ['199001', '199002'].includes(String(actor?.optimizationObjectId ?? ''))
    ) {
      issues.push('candidate-starborn-source-used-as-optimization-object');
    }
  }
  const initialFront = result.m12c?.initialFront;
  const frontActor = actors.find(
    actor => actor?.actorSlotId === initialFront?.actorSlotId
  );
  if (
    !frontActor ||
    String(frontActor.optimizationObjectId) !==
      String(initialFront?.optimizationObjectId ?? '') ||
    Number(frontActor.sourceCharacterId) !==
      Number(initialFront?.sourceCharacterId)
  ) {
    issues.push('candidate-initial-front-not-build-axis-identity');
  }
  const controlledActor = result.axis?.scenario?.initialRuntimeState?.controlledActor;
  if (
    Number(controlledActor?.characterId) !== Number(initialFront?.sourceCharacterId) ||
    controlledActor?.actorId !== `actor-${Number(initialFront?.sourceCharacterId)}`
  ) {
    issues.push('candidate-controlled-actor-initial-front-mismatch');
  }
  const scenarioTeam = Array.isArray(result.axis?.scenario?.team)
    ? result.axis.scenario.team
    : [];
  if (scenarioTeam.length !== 3) {
    issues.push('candidate-scenario-team-count-not-three');
  }
  for (const actor of actors) {
    const slot = scenarioTeam.find(row => row?.slotId === actor?.actorSlotId);
    if (!slot || Number(slot.characterId) !== Number(actor?.sourceCharacterId)) {
      issues.push('candidate-scenario-team-build-binding-mismatch');
      break;
    }
  }
  const qualificationCatalogHash =
    result.axis?.scenario?.optimizationQualification?.catalogHash;
  if (
    !qualificationCatalogHash ||
    qualificationCatalogHash !==
      result.m12c?.build?.authority?.qualificationCatalogHash
  ) {
    issues.push('candidate-qualification-catalog-binding-mismatch');
  }
  if (!result.m12c?.build?.authority?.qualificationBindingMatrixHash) {
    issues.push('candidate-qualification-binding-matrix-hash-missing');
  }
}

function validateActionSurface(result, issues) {
  for (const action of result.axis?.actions ?? []) {
    const ownerKind = String(action?.owner?.kind ?? '');
    const actionKind = String(action?.intent?.actionKind ?? '').toLowerCase();
    if (
      ownerKind === 'kibo' ||
      actionKind === 'kibo-normal-attack' ||
      actionKind === 'kibo-active' ||
      actionKind === 'kibo-active-skill'
    ) {
      issues.push('candidate-autonomous-kibo-action-present');
      break;
    }
  }
}

function validateObjectiveScopedInitialState(result, objective, issues) {
  const scenario = result.axis?.scenario ?? {};
  const preset = scenario.initialStatePreset ?? {};
  const team = Array.isArray(scenario.team) ? scenario.team : [];
  const state = scenario.initialRuntimeState ?? {};
  const isCycle = CYCLE_OBJECTIVES.has(objective);
  const isKill = objective === FASTEST_KILL_OBJECTIVE;
  if (!isCycle && !isKill) {
    issues.push('candidate-objective-unsupported');
    return {
      expectedPresetId: null,
      expectedPresetHash: null,
      actualPresetHash: preset?.presetHash ?? null,
      expectedObjectiveScope: null,
    };
  }
  const expectedPresetId = isCycle ? CYCLE_PRESET_ID : KILL_PRESET_ID;
  const expectedScope = isCycle ? 'cycle' : 'kill';
  const expectedSp = isCycle ? 0 : 100;
  if (
    Object.keys(state).some(key => !FINAL_INITIAL_RUNTIME_STATE_KEYS.has(key))
  ) {
    issues.push('candidate-initial-runtime-state-field-forbidden');
  }
  for (const [key, expected] of Object.entries({
    schemaVersion: 1,
    contractName: 'AzPrM12CInitialStatePreset',
    policyId: INITIAL_STATE_POLICY_ID,
    policyVersion: INITIAL_STATE_POLICY_VERSION,
    policyHash: INITIAL_STATE_POLICY_HASH,
    presetId: expectedPresetId,
    objectiveId: objective,
    objectiveScope: expectedScope,
    mechanicsPackageId: MECHANICS_PACKAGE_ID,
    mechanicsPackageHash: MECHANICS_PACKAGE_HASH,
  })) {
    if (preset?.[key] !== expected) {
      issues.push(`candidate-initial-state-binding-${key}-mismatch`);
    }
  }
  if (
    scenario?.dataIdentity?.verifiedMechanicsPackageId != null ||
    scenario?.dataIdentity?.verifiedMechanicsPackageHash != null
  ) {
    issues.push('candidate-mechanics-package-binding-misplaced');
  }
  if (
    result.axis?.dataIdentity?.verifiedMechanicsPackageId !==
      MECHANICS_PACKAGE_ID ||
    result.axis?.dataIdentity?.verifiedMechanicsPackageHash !==
      MECHANICS_PACKAGE_HASH
  ) {
    issues.push('candidate-mechanics-package-binding-mismatch');
  }
  if (
    team.length !== 3 ||
    team.some(
      slot =>
        typeof slot?.initialSp !== 'number' ||
        !Number.isInteger(slot.initialSp) ||
        slot.initialSp !== expectedSp
    )
  ) {
    issues.push('candidate-actor-sp-preset-mismatch');
  }
  const kiboEnergy = Array.isArray(state.kiboEnergyBySlot)
    ? state.kiboEnergyBySlot
    : [];
  if (kiboEnergy.length !== team.length) {
    issues.push('candidate-kibo-sp-slot-coverage-mismatch');
  }
  for (const slot of team) {
    const energy = kiboEnergy.find(row => row?.slotId === slot?.slotId);
    if (
      !energy ||
      Number(energy.characterId) !== Number(slot.characterId) ||
      energy.actorId !== `actor-${Number(slot.characterId)}` ||
      Number(energy.kiboId) !== Number(slot?.loadout?.kiboId) ||
      typeof energy.currentValue !== 'number' ||
      !Number.isInteger(energy.currentValue) ||
      energy.currentValue !== expectedSp ||
      typeof energy.maxValue !== 'number' ||
      energy.maxValue !== 100
    ) {
      issues.push('candidate-kibo-sp-preset-mismatch');
      break;
    }
  }
  if (!Array.isArray(state.tuningMarks) || state.tuningMarks.length !== 0) {
    issues.push('candidate-initial-tuning-marks-not-zero');
  }
  const specialResources = Array.isArray(state.specialResourcesByActor)
    ? state.specialResourcesByActor
    : [];
  const hasRubyActor = team.some(slot => Number(slot?.characterId) === 103002);
  if (isCycle && specialResources.length !== 0) {
    issues.push('candidate-cycle-special-resources-not-empty');
  }
  if (isKill) {
    const expectedResourceCount = hasRubyActor ? 1 : 0;
    if (specialResources.length !== expectedResourceCount) {
      issues.push('candidate-kill-special-resource-count-mismatch');
    }
    if (hasRubyActor) {
      const ruby = specialResources[0];
      if (
        !sameKeySet(ruby, FINAL_RUBY_RESOURCE_KEYS) ||
        ruby?.actorId !== 'actor-103002' ||
        Number(ruby?.characterId) !== 103002 ||
        ruby?.resourceIdentity !== RUBY_RESOURCE_IDENTITY ||
        typeof ruby?.currentValue !== 'number' ||
        ruby.currentValue !== 12 ||
        typeof ruby?.maxValue !== 'number' ||
        ruby.maxValue !== 12 ||
        typeof ruby?.inputStep !== 'number' ||
        ruby.inputStep !== 1 ||
        ruby?.scenarioConfigurable !== true ||
        !Array.isArray(ruby?.activeStates) ||
        ruby.activeStates.length !== 0
      ) {
        issues.push('candidate-kill-ruby-ammunition-preset-mismatch');
      }
    }
  }
  const actorSp = team
    .map(slot => ({
      slotId: String(slot?.slotId ?? ''),
      currentValue: Number(slot?.initialSp ?? 0),
    }))
    .sort(compareBySlotId);
  const kiboSp = kiboEnergy
    .map(row => ({
      slotId: String(row?.slotId ?? ''),
      currentValue: Number(row?.currentValue),
    }))
    .sort(compareBySlotId);
  const projectedResources =
    isKill && hasRubyActor && specialResources.length === 1
      ? [
          {
            actorId: 'actor-103002',
            characterId: 103002,
            resourceIdentity: RUBY_RESOURCE_IDENTITY,
            currentValue: Number(specialResources[0]?.currentValue),
            capacity: 12,
            inputStep: 1,
            activeStates: [],
            sourceIdentity: RUBY_RESOURCE_SOURCE_IDENTITY,
          },
        ]
      : [];
  const expectedPresetHash = sha256Canonical({
    policyId: INITIAL_STATE_POLICY_ID,
    policyVersion: INITIAL_STATE_POLICY_VERSION,
    objectiveScope: expectedScope,
    mechanicsPackageId: MECHANICS_PACKAGE_ID,
    mechanicsPackageHash: MECHANICS_PACKAGE_HASH,
    actorSp,
    kiboSp,
    tuningMarks: [],
    specialResources: projectedResources,
  });
  if (preset?.presetHash !== expectedPresetHash) {
    issues.push('candidate-initial-state-preset-hash-mismatch');
  }
  const expectedTarget = isCycle
    ? objective === 'cycle-dps-no-toughness'
      ? {
          hpMode: 'infinite',
          toughnessMode: 'disabled',
          breakMode: 'disabled',
          deathTruncation: 'disabled',
        }
      : {
          hpMode: 'infinite',
          toughnessMode: 'enabled',
          breakMode: 'enabled',
          deathTruncation: 'disabled',
        }
    : {
        hpMode: 'finite',
        toughnessMode: 'enabled',
        breakMode: 'enabled',
        deathTruncation: 'enabled',
      };
  if (stableJson(scenario.target ?? {}) !== stableJson(expectedTarget)) {
    issues.push('candidate-objective-target-policy-mismatch');
  }
  return {
    expectedPresetId,
    expectedPresetHash,
    actualPresetHash: preset?.presetHash ?? null,
    expectedObjectiveScope: expectedScope,
    expectedActorSp: expectedSp,
    expectedKiboSp: expectedSp,
    expectedSpecialResources: projectedResources,
    actualSpecialResources: structuredClone(specialResources),
  };
}

function compareBySlotId(left, right) {
  return String(left?.slotId ?? '').localeCompare(
    String(right?.slotId ?? ''),
    'en'
  );
}

function sameKeySet(value, expectedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  return stableJson(actual) === stableJson(expected);
}

export function aggregateShardResults({
  runId,
  roundId,
  objective,
  topN = 5,
  baseline,
  expectedSourceConfigIdentities = [],
  shardArtifacts = [],
  guidanceHash = null,
  presetSpecHash = null,
  contractTemplateHash = null,
  orchestrationIdentityHash = null,
} = {}) {
  const expected = [...new Set(expectedSourceConfigIdentities.map(String))].sort(
    compareText
  );
  const completed = [];
  const failed = [];
  const inProgress = [];
  const checkpointsBySource = new Map();
  const invalidCandidates = [];
  const candidatesByIdentity = new Map();
  const summaryCounters = {};
  let aggregateWallTimeMs = 0;

  for (const artifact of [...shardArtifacts].sort(compareShardArtifact)) {
    const checkpoint = artifact?.checkpoint ?? artifact;
    const sourceConfigIdentity = String(
      checkpoint?.coverage?.sourceConfigIdentity ??
        checkpoint?.sourceConfigIdentity ??
        ''
    );
    if (!sourceConfigIdentity) continue;
    checkpointsBySource.set(sourceConfigIdentity, checkpoint);
    if (checkpoint.status === 'failed') {
      failed.push(sourceConfigIdentity);
      continue;
    }
    if (checkpoint.status !== 'completed') {
      inProgress.push(sourceConfigIdentity);
      continue;
    }

    const resultArtifact = artifact?.result ?? null;
    const serviceResult = resultArtifact?.serviceResult ?? resultArtifact;
    if (!serviceResult || serviceResult.objective !== objective) {
      failed.push(sourceConfigIdentity);
      continue;
    }
    completed.push(sourceConfigIdentity);
    aggregateWallTimeMs += Number(serviceResult.summary?.wallTimeMs ?? 0);
    for (const [key, value] of Object.entries(serviceResult.summary ?? {})) {
      if (Number.isFinite(Number(value)) && isSummaryCounter(key)) {
        summaryCounters[key] =
          Number(summaryCounters[key] ?? 0) + Number(value ?? 0);
      }
    }
    for (const result of serviceResult.results ?? []) {
      const validation = validateFinalCandidate(result, objective);
      const identity = createCandidateRawIdentity(result, objective);
      if (!validation.valid) {
        invalidCandidates.push({
          sourceConfigIdentity,
          identityHash: identity.identityHash,
          issues: validation.issues,
        });
        continue;
      }
      const entry = {
        rawIdentity: identity,
        sourceConfigIdentity,
        shardId: checkpoint.shardId ?? null,
        result,
      };
      const existing = candidatesByIdentity.get(identity.identityHash);
      if (!existing || compareCandidateEntries(entry, existing, objective) < 0) {
        candidatesByIdentity.set(identity.identityHash, entry);
      }
    }
  }

  const candidates = [...candidatesByIdentity.values()].sort((left, right) =>
    compareCandidateEntries(left, right, objective)
  );
  const ranked = candidates.slice(0, Math.max(1, Number(topN) || 5));
  const cutoffScore =
    ranked.length >= topN ? Number(ranked[topN - 1].result.score) : null;
  const cutoffTies =
    cutoffScore == null
      ? []
      : candidates.slice(topN).filter(entry =>
          scoresTie(Number(entry.result.score), cutoffScore)
        );
  const completedUnique = [...new Set(completed)].sort(compareText);
  const failedUnique = [...new Set(failed)]
    .filter(identity => !completedUnique.includes(identity))
    .sort(compareText);
  const inProgressUnique = [...new Set(inProgress)]
    .filter(
      identity =>
        !completedUnique.includes(identity) && !failedUnique.includes(identity)
    )
    .sort(compareText);
  const missing = expected.filter(
    identity => !checkpointsBySource.has(identity)
  );
  const candidateFamilyIdentities = [
    ...new Set(
      ranked.map(entry =>
        String(
          entry.result?.m12c?.teamIdentity ??
            entry.result?.m12c?.sourceConfigIdentity ??
            ''
        )
      )
    ),
  ]
    .filter(Boolean)
    .sort(compareText);
  const deterministicPayload = {
    schemaVersion: FORMAL_SEARCH_ARTIFACT_SCHEMA_VERSION,
    kind: 'azpr-m12c-formal-search-round-aggregate',
    runId,
    roundId,
    objective,
    rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
    formalRankingReady: false,
    baseline,
    guidanceHash,
    presetSpecHash,
    contractTemplateHash,
    orchestrationIdentityHash,
    coverage: {
      expectedSourceConfigIdentities: expected,
      completedSourceConfigIdentities: completedUnique,
      failedSourceConfigIdentities: failedUnique,
      inProgressSourceConfigIdentities: inProgressUnique,
      missingSourceConfigIdentities: missing,
    },
    summary: {
      ...summaryCounters,
      aggregateWallTimeMs,
      validDistinctCandidateCount: candidates.length,
      invalidCandidateCount: invalidCandidates.length,
      topNRequested: topN,
      topNReady: ranked.length === topN,
      cutoffScore,
      cutoffTieCount: cutoffTies.length,
      topNFamilyCount: candidateFamilyIdentities.length,
    },
    candidateIdentities: ranked.map(entry => entry.rawIdentity),
    cutoffTieIdentities: cutoffTies.map(entry => entry.rawIdentity),
  };
  const aggregateHash = sha256Canonical({
    ...deterministicPayload,
    summary: {
      ...deterministicPayload.summary,
      aggregateWallTimeMs: undefined,
    },
  });
  return {
    ...deterministicPayload,
    aggregateHash,
    invalidCandidates,
    results: ranked.map((entry, index) => ({
      rank: index + 1,
      rawIdentity: entry.rawIdentity,
      sourceConfigIdentity: entry.sourceConfigIdentity,
      shardId: entry.shardId,
      ...entry.result,
    })),
    cutoffTies: cutoffTies.map(entry => ({
      rawIdentity: entry.rawIdentity,
      sourceConfigIdentity: entry.sourceConfigIdentity,
      shardId: entry.shardId,
      ...entry.result,
    })),
  };
}

export function aggregateRoundAggregates({
  runId,
  objective,
  topN = 5,
  baseline,
  roundAggregates = [],
  presetSpecHash = null,
  contractTemplateHash = null,
} = {}) {
  const pseudoShards = [];
  const expected = new Set();
  for (const aggregate of roundAggregates) {
    for (const identity of
      aggregate?.coverage?.expectedSourceConfigIdentities ?? []) {
      expected.add(String(identity));
    }
    pseudoShards.push({
      checkpoint: {
        status: 'completed',
        shardId: `round:${aggregate?.roundId ?? 'unknown'}`,
        coverage: {
          sourceConfigIdentity: `round:${aggregate?.roundId ?? 'unknown'}`,
        },
      },
      result: {
        objective,
        summary: aggregate?.summary ?? {},
        results: [
          ...(aggregate?.results ?? []),
          ...(aggregate?.cutoffTies ?? []),
        ],
      },
    });
  }
  const combined = aggregateShardResults({
    runId,
    roundId: 'combined',
    objective,
    topN,
    baseline,
    expectedSourceConfigIdentities: pseudoShards.map(
      artifact => artifact.checkpoint.coverage.sourceConfigIdentity
    ),
    shardArtifacts: pseudoShards,
    guidanceHash: null,
    presetSpecHash,
    contractTemplateHash,
    orchestrationIdentityHash: null,
  });
  return {
    ...combined,
    kind: 'azpr-m12c-formal-search-objective-aggregate',
    roundIds: roundAggregates
      .map(aggregate => String(aggregate?.roundId ?? ''))
      .filter(Boolean)
      .sort(compareText),
    sourceConfigUniverse: [...expected].sort(compareText),
    aggregateHash: sha256Canonical({
      runId,
      objective,
      baseline,
      roundAggregateHashes: roundAggregates
        .map(aggregate => aggregate?.aggregateHash ?? null)
        .sort(compareText),
      candidateIdentityHashes: combined.results.map(
        result => result.rawIdentity.identityHash
      ),
      cutoffTieIdentityHashes: combined.cutoffTies.map(
        result => result.rawIdentity.identityHash
      ),
      rankingClaim: FORMAL_SEARCH_RANKING_CLAIM,
      formalRankingReady: false,
    }),
  };
}

export function compareCandidateEntries(left, right, objective) {
  const leftScore = Number(left?.result?.score);
  const rightScore = Number(right?.result?.score);
  if (objective === 'fastest-kill') {
    if (leftScore !== rightScore) return leftScore - rightScore;
  } else if (leftScore !== rightScore) {
    return rightScore - leftScore;
  }
  return compareText(
    left?.rawIdentity?.identityHash ?? '',
    right?.rawIdentity?.identityHash ?? ''
  );
}

function normalizeStableValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value);
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(normalizeStableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .filter(key => value[key] !== undefined)
        .sort(compareText)
        .map(key => [key, normalizeStableValue(value[key])])
    );
  }
  return value == null ? null : String(value);
}

function compareText(left, right) {
  return String(left).localeCompare(String(right), 'en');
}

function compareShardArtifact(left, right) {
  const leftIdentity =
    left?.checkpoint?.coverage?.sourceConfigIdentity ??
    left?.coverage?.sourceConfigIdentity ??
    '';
  const rightIdentity =
    right?.checkpoint?.coverage?.sourceConfigIdentity ??
    right?.coverage?.sourceConfigIdentity ??
    '';
  return compareText(leftIdentity, rightIdentity);
}

function scoresTie(left, right) {
  return Object.is(left, right) || Math.abs(left - right) <= 1e-12;
}

function isSummaryCounter(key) {
  return new Set([
    'steps',
    'candidatesEvaluated',
    'invalidCandidates',
    'mergedCandidates',
    'prunedCandidates',
    'expandedCandidates',
    'completedCandidates',
    'formalSurfaceRejectedCandidates',
    'buildCount',
    'variantSearchCount',
    'candidateResultCount',
    'failureCount',
  ]).has(key);
}
