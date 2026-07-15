import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const generatedRoot = path.join(projectRoot, 'src', 'data', 'generated');
const reportsRoot = path.join(projectRoot, 'reports');
const catalogPath = path.join(
  generatedRoot,
  'workbench-action-status-catalog.json'
);
const reportPath = path.join(
  reportsRoot,
  'action-status-generation-audit.json'
);
const rawBuffInfoPath =
  'C:/PC2/Codex/AzPr/Assets/ResourcesAssets/Config/NewTable/buff_info.json';
const rawBuffLangPath =
  'C:/PC2/Codex/AzPr/Assets/ResourcesLang/chs/Table/lang_buff_info.json';
const writeMode = process.argv.includes('--write');
const assertClean = process.argv.includes('--assert-clean');

const [seed, skillCore, diagnostics, kiboCatalog, existingCatalog] =
  await Promise.all([
    readJson(path.join(generatedRoot, 'workbench-seed.json')),
    readJson(path.join(generatedRoot, 'workbench-skill-core.json')),
    readJson(path.join(generatedRoot, 'workbench-skill-diagnostics.json')),
    readJson(path.join(generatedRoot, 'workbench-kibo-action-catalog.json')),
    readJsonIfExists(catalogPath),
  ]);

const buffDisplayById = await loadBuffDisplayById(existingCatalog);
const catalog = buildActionStatusCatalog({
  seed,
  skillCore,
  diagnostics,
  kiboCatalog,
  buffDisplayById,
});
const report = buildAuditReport(catalog);

if (writeMode) {
  await fs.mkdir(generatedRoot, { recursive: true });
  await fs.mkdir(reportsRoot, { recursive: true });
  await Promise.all([
    writeJson(catalogPath, catalog),
    writeJson(reportPath, report),
  ]);
}

if (assertClean) {
  if (!existingCatalog) {
    throw new Error(
      'Missing generated action status catalog. Run npm run data:generate first.'
    );
  }
  if (stableJson(existingCatalog) !== stableJson(catalog)) {
    throw new Error(
      'workbench-action-status-catalog.json is stale. Run npm run data:generate.'
    );
  }
  if (!report.valid) {
    throw new Error(
      `Action status generation audit failed: ${report.issues
        .map(issue => issue.code)
        .join(', ')}`
    );
  }
}

console.log(JSON.stringify(report.summary, null, 2));

function buildActionStatusCatalog({
  seed,
  skillCore,
  diagnostics,
  kiboCatalog,
  buffDisplayById,
}) {
  const skills = seed?.gameData?.skills ?? [];
  const skillById = new Map(skills.map(skill => [Number(skill.id), skill]));
  const logicItems = skillCore?.skillLogicIndex?.items ?? [];
  const cooldownBySkillId = new Map(
    logicItems.map(item => [
      Number(item.skillId),
      summarizeCooldownCoverage(item),
    ])
  );
  const evidence = diagnostics?.skillAssetEvidence ?? {};
  const externalSkills = evidence.externalElementObjectEvidence?.skills ?? [];
  const controlBySkillId = new Map(
    (evidence.currentSkillControlEvidence ?? []).map(item => [
      Number(item.skillId),
      item,
    ])
  );
  const effectCandidates = [];

  for (const externalSkill of externalSkills) {
    const skillId = Number(externalSkill.skillId);
    const skill = skillById.get(skillId) ?? null;
    const control = controlBySkillId.get(skillId) ?? null;
    const actionBinding = resolveStructuredActionBinding(skill);
    for (const object of externalSkill.objects ?? []) {
      if (object.scriptTypeCandidate?.className !== 'TBuffElementParams') {
        continue;
      }
      const durationMs = positiveNumberOrNull(object.timingFields?.time);
      const elementPathId = String(object.pathId ?? '');
      const directBindings = findDirectBuffBehaviorBindings(
        control,
        elementPathId
      );
      const lifecycleBindings = directBindings.filter(
        binding =>
          binding.behaviorClassName === 'InjectToTargetKeyFrameBehaviorData' &&
          binding.targetType === 1 &&
          binding.triggerFrame != null &&
          durationMs != null &&
          actionBinding.actionVariantIndex != null
      );
      const selectedBinding = lifecycleBindings[0] ?? null;
      const buffId = Number(object.elementConfigId);
      const display = buffDisplayById.get(buffId) ?? null;
      const bindingStatus = selectedBinding
        ? 'lifecycle-bound'
        : directBindings.length > 0
          ? 'tracking-only-behavior-binding-unconfirmed'
          : 'tracking-only-resource-identity';

      effectCandidates.push({
        schemaVersion: 1,
        sourceKind: 'azpr-action-status-effect-candidate',
        status: bindingStatus,
        skillId,
        requiredActionKind: actionBinding.actionKind,
        requiredActionVariantIndex: actionBinding.actionVariantIndex,
        effectId: `buff-${buffId}`,
        buffId,
        effectName:
          cleanText(display?.name) ||
          cleanText(display?.tips) ||
          `Buff ${buffId}`,
        icon: cleanText(display?.icon),
        targetKind: selectedBinding ? 'enemy' : null,
        durationMs,
        operation: selectedBinding ? 'apply' : null,
        stackMode: null,
        triggerFrame: selectedBinding?.triggerFrame ?? null,
        triggerFrames: uniqueNumbers(
          directBindings.map(binding => binding.triggerFrame)
        ),
        confidence: selectedBinding ? 'medium' : 'tracking-only',
        trackingStatus: 'unapplied',
        appliedToCalculators: false,
        sourceIdentity: {
          sourceKind: 'azpr-skill-control-buff-lifecycle',
          skillId,
          elementConfigId: buffId,
          elementPathId,
          elementContainerPath: cleanText(object.containerPath),
          buffClassName: object.scriptTypeCandidate.className,
          durationField: 'TBuffElementParams.time',
          behaviorPathId: selectedBinding?.behaviorPathId ?? null,
          behaviorClassName: selectedBinding?.behaviorClassName ?? null,
          behaviorSourceFile: selectedBinding?.sourceFile ?? null,
          triggerFrameField: selectedBinding
            ? 'SkillBehaviorData.startFrame'
            : null,
          actionBindingSource: actionBinding.source,
          stackingStatus: selectedBinding
            ? 'unconfirmed-single-instance-runtime-projection'
            : null,
        },
      });
    }
  }

  const cooldownSkillCount = [...cooldownBySkillId.values()].filter(
    item => item.status === 'confirmed-cooldown'
  ).length;
  const logicCooldownSkillCount = [...cooldownBySkillId.values()].filter(
    item => item.sourceKind === 'skillsub-logic'
  ).length;
  const displayCooldownFallbackSkillCount = [
    ...cooldownBySkillId.values(),
  ].filter(item => item.sourceKind === 'skill-level-display').length;
  const ultimateDisplayCooldownFallbackSkillCount = [
    ...cooldownBySkillId.entries(),
  ].filter(
    ([skillId, item]) =>
      item.sourceKind === 'skill-level-display' &&
      Number(skillById.get(skillId)?.displayType) === 2
  ).length;
  const lifecycleBoundEffectCount = effectCandidates.filter(
    item => item.status === 'lifecycle-bound'
  ).length;
  const trackingOnlyEffectCount =
    effectCandidates.length - lifecycleBoundEffectCount;
  const kiboActionCount = (kiboCatalog?.items ?? []).reduce(
    (sum, kibo) => sum + (kibo.actions?.length ?? 0),
    0
  );
  const kiboCooldowns = (kiboCatalog?.items ?? [])
    .flatMap(kibo =>
      (kibo.actions ?? []).map(action => ({
        kiboId: Number(kibo.kiboId),
        skillId: Number(action.skillId),
        cooldownMs: positiveNumberOrNull(action.cooldownMs),
        cooldownCount: Math.max(
          1,
          Math.trunc(Number(action.cooldownCount) || 1)
        ),
        cooldownDefaultMs: nonNegativeNumberOrNull(action.cooldownDefaultMs),
        kiboVersusCooldownMs: positiveNumberOrNull(action.kiboVersusCooldownMs),
        kiboVersusCooldownDefaultMs: nonNegativeNumberOrNull(
          action.kiboVersusCooldownDefaultMs
        ),
      }))
    )
    .filter(row => row.kiboId > 0 && row.skillId > 0 && row.cooldownMs != null)
    .sort(
      (left, right) =>
        left.kiboId - right.kiboId || left.skillId - right.skillId
    );

  return {
    schemaVersion: 2,
    generatedAt: diagnostics.generatedAt ?? seed.generatedAt ?? null,
    sourceKind: 'azpr-workbench-action-status-catalog',
    status: 'action-status-catalog-ready',
    policy: {
      descriptionTextInferenceAllowed: false,
      lifecycleRequiresDirectBehaviorBinding: true,
      unsupportedCandidatesRemainTrackingOnly: true,
      unconfirmedStackingUsesSingleInstanceRuntimeProjection: true,
      appliedToCalculators: false,
    },
    sources: {
      workbenchSeed: 'workbench-seed.json',
      skillLogic: 'workbench-skill-core.json',
      skillAssetEvidence: 'workbench-skill-diagnostics.json',
      kiboActions: 'workbench-kibo-action-catalog.json',
      kiboCooldown:
        'Config/NewTable/skillsub_logic.json.coolDown (standard battle)',
      buffInfo: 'Config/NewTable/buff_info.json',
    },
    summary: {
      skillCount: skills.length,
      cooldownSkillCount,
      logicCooldownSkillCount,
      displayCooldownFallbackSkillCount,
      ultimateDisplayCooldownFallbackSkillCount,
      noConfirmedCooldownSkillCount: Math.max(
        0,
        skills.length - cooldownSkillCount
      ),
      effectCandidateCount: effectCandidates.length,
      lifecycleBoundEffectCount,
      trackingOnlyEffectCount,
      kiboActionCount,
      kiboConfirmedCooldownActionCount: kiboCooldowns.length,
      kiboConfirmedStatusActionCount: 0,
      calculatorAppliedEffectCount: 0,
    },
    kiboCooldowns,
    effectCandidates: effectCandidates.sort(
      (left, right) =>
        left.skillId - right.skillId ||
        left.buffId - right.buffId ||
        String(left.status).localeCompare(String(right.status))
    ),
  };
}

function summarizeCooldownCoverage(item) {
  const logicRows = (item?.subSkills ?? [])
    .map(subSkill => ({
      subSkillId: Number(subSkill.subSkillId),
      cooldownMs: Number(subSkill.logic?.cooldownMs) || 0,
      cooldownCount: Math.max(
        1,
        Math.trunc(Number(subSkill.logic?.cooldownCount) || 1)
      ),
      sourceKind: 'skillsub-logic',
    }))
    .filter(row => row.cooldownMs > 0);
  if (logicRows.length > 0) {
    return {
      status: 'confirmed-cooldown',
      sourceKind: 'skillsub-logic',
      rows: logicRows,
    };
  }
  const fallbackSubSkillId =
    (item?.subSkills ?? []).length === 1
      ? Number(item.subSkills[0].subSkillId)
      : null;
  const cooldownRows = uniqueByKey(
    (item?.levels ?? [])
      .map(level => ({
        subSkillId: fallbackSubSkillId,
        cooldownMs: Number(level.display?.cooldownMs) || 0,
        cooldownCount: 1,
        sourceKind: 'skill-level-display',
        skillLevelRowId: Number(level.skillLevelRowId) || null,
      }))
      .filter(row => row.cooldownMs > 0),
    row => `${row.subSkillId}|${row.cooldownMs}`
  );
  return {
    status:
      cooldownRows.length > 0 ? 'confirmed-cooldown' : 'no-confirmed-cooldown',
    sourceKind: cooldownRows.length > 0 ? 'skill-level-display' : 'unconfirmed',
    rows: cooldownRows,
  };
}

function resolveStructuredActionBinding(skill) {
  const displayType = Number(skill?.displayType);
  const actionKindByDisplayType = new Map([
    [1, 'star-skill'],
    [2, 'ultimate'],
    [5, 'star-carry'],
  ]);
  const actionKind = actionKindByDisplayType.get(displayType) ?? null;
  if (!actionKind) {
    return {
      actionKind: null,
      actionVariantIndex: null,
      source: 'workbench-skill-display-type-unmapped',
    };
  }
  const labels = skill?.level?.labels ?? [];
  const actionVariantIndex = labels.findIndex(label =>
    labelMatchesActionKind(label, actionKind)
  );
  return {
    actionKind,
    actionVariantIndex: actionVariantIndex >= 0 ? actionVariantIndex : null,
    source: 'workbench-skill-display-type-and-structured-level-label',
  };
}

function labelMatchesActionKind(label, actionKind) {
  const text = cleanText(label);
  if (actionKind === 'star-skill') return text === '星鸣技';
  if (actionKind === 'ultimate') return text === '星决技';
  if (actionKind === 'star-carry') return /^星携技(?:·|$)/u.test(text);
  return false;
}

function findDirectBuffBehaviorBindings(control, elementPathId) {
  if (!control || !elementPathId) return [];
  const bindings = [];
  for (const [laneKey, chains] of Object.entries(
    control.effectLaneBehaviorChainsByLane ?? {}
  )) {
    for (const chain of chains ?? []) {
      for (const behavior of chain.resolvedBehaviors ?? []) {
        const hasDirectReference = (behavior.elementBaseDataRefs ?? []).some(
          reference => String(reference.pathId ?? '') === elementPathId
        );
        if (!hasDirectReference) continue;
        bindings.push({
          laneKey,
          sourceFile: cleanText(chain.sourceFile),
          triggerFrame: nonNegativeIntegerOrNull(
            behavior.startFrame ?? chain.sourceStartFrame
          ),
          behaviorPathId: cleanText(behavior.pathId),
          behaviorClassName: cleanText(behavior.scriptTypeCandidate?.className),
          targetType: numberOrNull(behavior.targetType),
        });
      }
    }
  }
  return bindings.sort(
    (left, right) =>
      compareOptionalNumber(left.triggerFrame, right.triggerFrame) ||
      String(left.behaviorPathId).localeCompare(String(right.behaviorPathId))
  );
}

function buildAuditReport(catalog) {
  const issues = [];
  for (const candidate of catalog.effectCandidates) {
    if (candidate.status !== 'lifecycle-bound') continue;
    if (
      candidate.sourceIdentity.behaviorClassName !==
      'InjectToTargetKeyFrameBehaviorData'
    ) {
      issues.push({
        code: 'lifecycle-behavior-binding-not-direct',
        skillId: candidate.skillId,
        buffId: candidate.buffId,
      });
    }
    if (
      candidate.triggerFrame == null ||
      candidate.durationMs == null ||
      candidate.requiredActionVariantIndex == null
    ) {
      issues.push({
        code: 'lifecycle-timing-or-action-binding-missing',
        skillId: candidate.skillId,
        buffId: candidate.buffId,
      });
    }
    if (candidate.appliedToCalculators !== false) {
      issues.push({
        code: 'lifecycle-candidate-must-remain-unapplied',
        skillId: candidate.skillId,
        buffId: candidate.buffId,
      });
    }
  }
  if (catalog.summary.kiboConfirmedStatusActionCount !== 0) {
    issues.push({ code: 'kibo-status-source-must-remain-unconfirmed' });
  }
  if (
    catalog.summary.kiboConfirmedCooldownActionCount !==
    catalog.summary.kiboActionCount
  ) {
    issues.push({
      code: 'kibo-cooldown-coverage-incomplete',
      expectedCount: catalog.summary.kiboActionCount,
      actualCount: catalog.summary.kiboConfirmedCooldownActionCount,
    });
  }
  for (const cooldown of catalog.kiboCooldowns ?? []) {
    if (!(Number(cooldown.cooldownMs) > 0)) {
      issues.push({
        code: 'kibo-cooldown-must-not-use-zero-placeholder',
        kiboId: cooldown.kiboId,
        skillId: cooldown.skillId,
      });
    }
  }
  if (catalog.summary.calculatorAppliedEffectCount !== 0) {
    issues.push({ code: 'generated-status-must-not-apply-to-calculators' });
  }
  return {
    schemaVersion: 1,
    generatedAt: catalog.generatedAt,
    sourceKind: 'azpr-action-status-generation-audit',
    status: issues.length
      ? 'action-status-generation-audit-failed'
      : 'action-status-generation-audit-passed',
    valid: issues.length === 0,
    summary: {
      ...catalog.summary,
      issueCount: issues.length,
      valid: issues.length === 0,
    },
    coverage: catalog.effectCandidates.map(candidate => ({
      skillId: candidate.skillId,
      requiredActionKind: candidate.requiredActionKind,
      requiredActionVariantIndex: candidate.requiredActionVariantIndex,
      effectId: candidate.effectId,
      effectName: candidate.effectName,
      status: candidate.status,
      triggerFrame: candidate.triggerFrame,
      durationMs: candidate.durationMs,
      confidence: candidate.confidence,
      trackingStatus: candidate.trackingStatus,
      appliedToCalculators: false,
    })),
    issues,
  };
}

async function loadBuffDisplayById(existingCatalog) {
  const fallback = new Map(
    (existingCatalog?.effectCandidates ?? []).map(candidate => [
      Number(candidate.buffId),
      {
        name: candidate.effectName,
        tips: candidate.effectName,
        icon: candidate.icon,
      },
    ])
  );
  const [buffInfo, buffLang] = await Promise.all([
    readJsonIfExists(rawBuffInfoPath),
    readJsonIfExists(rawBuffLangPath),
  ]);
  if (!buffInfo || !buffLang) return fallback;
  const langRows = buffLang.rows ?? [];
  const resolveLang = id => resolveLargeNumericLangValue(langRows, id);
  for (const row of buffInfo.rows ?? []) {
    const id = Number(row.id);
    if (!Number.isFinite(id)) continue;
    fallback.set(id, {
      name: resolveLang(row.name),
      tips: resolveLang(row.tips),
      icon: assetFileName(row.unitId),
    });
  }
  return fallback;
}

function resolveLargeNumericLangValue(rows, requestedId) {
  if (requestedId == null || requestedId === '') return null;
  const target = BigInt(String(requestedId));
  let nearest = null;
  let nearestDistance = null;
  for (const row of rows) {
    if (row?.id == null) continue;
    let rowId;
    try {
      rowId = BigInt(String(Math.trunc(Number(row.id))));
    } catch {
      continue;
    }
    const distance = rowId >= target ? rowId - target : target - rowId;
    if (
      distance <= 256n &&
      (nearestDistance == null || distance < nearestDistance)
    ) {
      nearest = row.value;
      nearestDistance = distance;
      if (distance === 0n) break;
    }
  }
  return cleanText(nearest);
}

function assetFileName(value) {
  const text = cleanText(value).replace(/\\/gu, '/');
  return text ? text.split('/').pop() : null;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readJsonIfExists(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, stableJson(value), 'utf8');
}

function cleanText(value) {
  return String(value ?? '').trim();
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function positiveNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nonNegativeIntegerOrNull(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function uniqueNumbers(values) {
  return [...new Set(values.filter(value => Number.isFinite(value)))].sort(
    (left, right) => left - right
  );
}

function uniqueByKey(values, createKey) {
  const seen = new Set();
  return values.filter(value => {
    const key = createKey(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function nonNegativeNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function compareOptionalNumber(left, right) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}
